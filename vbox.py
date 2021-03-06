import sys
sys.path.append('lib')

import pythoncom
import cherrypy, threading, logging
from cherrypy.process import wspbus, plugins
import os.path, json
from ws4py.websocket import WebSocket
from ws4py.messaging import TextMessage
from ws4py.server.cherrypyserver import WebSocketTool

import vboxapi
import time

# Register the websocket tool
cherrypy.tools.websocket = WebSocketTool()

class VBoxEventDispatcher(object):
	def __init__(self, vbmgr, source, eventMap, timeout = 500):
		self.vbmgr = vbmgr
		self.eventSource = source
		self.eventMap = eventMap
		self.timeout = timeout
		
		# Create a name list for the events
		names = self.vbmgr.constants.all_values('VBoxEventType')
		inames = { names[k]: k for k in names.keys() }
		self.eventName = { v: inames[v] for v in eventMap }

		# Create an event listener and register it
		evfilter = eventMap.keys()
		self.listener = source.createListener()
		source.registerListener(self.listener, evfilter, False)
		
		self.registered = True
		self.started = False
		
	def process(self):
		# Make sure the event is registered
		if not self.registered:
			raise Exception("Cannot process an unregistered event")
			
		event = self.eventSource.getEvent(self.listener, self.timeout)
		if event is not None:
			cherrypy.log("Received event: %s(%d)" % (self.eventName[event.type], event.type))
			
			# Acknowledge the event
			self.eventSource.eventProcessed(self.listener, event)
			
			# TODO: Call the handler
			try:
				handler, clsname = self.eventMap[event.type]
			except KeyError:
				cherrypy.log("Event handler not found, skipping")
				
			# Downcast the event class into the appropriate type
			sev = self.vbmgr.queryInterface(event, clsname)
			
			# Finally, call the handler
			handler(sev)
	
	def unregister(self):
		self.registered = False
		self.eventSource.unregisterListener(self.listener)

class VBoxStateTracker(threading.Thread, plugins.SimplePlugin):
	def __init__(self):
		super(VBoxStateTracker, self).__init__()
		self.running = False
		
		# Initialize VirtualBox
		self.manager = vboxapi.VirtualBoxManager()
		cherrypy.log("Connected to VirtualBox manager, revision %d" % self.manager.getPythonApiRevision())
		self.vb = self.manager.vbox
		self.const = self.manager.constants
		self.type = self.manager.type

		# Get initial machine list
		machlist = self.manager.getArray(self.vb, 'machines')
		self.machines = {m.id: m for m in machlist}
		cherrypy.log("Initial machine list has %d entries" % len(machlist))
		
		# Register an event handler for creating & deleting of machines
		e = VBoxEventDispatcher(self.manager, self.vb.eventSource, { 
			self.const.VBoxEventType_OnMachineRegistered: (self.machineRegisteredHandler, 'IMachineRegisteredEvent'),
			self.const.VBoxEventType_OnMachineStateChanged: (self.machineStateChangedHandler, 'IMachineStateChangedEvent'),
			self.const.VBoxEventType_OnMachineDataChanged: (self.machineDataChangedHandler, 'IMachineDataChangedEvent'),
			})
		self.eventDispatchers = [ e ]

		# Progress monitor list		
		self.progressMonitors = []

		
		# Create a map from to decode MachineState enum
		d = self.const.all_values('MachineState')
		self.machineStateEnum = { d[k]: k for k in d } 
		
		# Register this object globally
		globals()['gVBoxStateTracker'] = self
		
	def getVBoxManager(self):
		return self.vb
	
	def getVBoxConstants(self):
		return self.const

	def getSessionAndMachine(self, uuid, attach = False):
		# Create a session object
		sess = self.manager.getSessionObject(self.vb)
		
		# Get the machine object
		mach = self.machines[uuid]
		
		# If requested, try to attach the new session to the machine
		if attach:
			mach.lockMachine(sess, self.const.LockType_Shared)
		
		return (sess, mach)
	
	def handleCOMError(self, uuid, operation, err):
			message = "Error while %s: %s" % (operation, err.excepinfo[2])
			
			# Log the message
			cherrypy.log.error("Machine %s: %s" % (uuid, message))
			
			# Report to the client
			op = self._opAsyncError(message, uuid) 
			cherrypy.engine.publish('websocket-broadcast', TextMessage(json.dumps(op)))
			
			# Refresh the machine state
			op = self._opMachState(uuid, self.machines[uuid].state)
			cherrypy.engine.publish('websocket-broadcast', TextMessage(json.dumps(op)))
			
	def startMachine(self, uuid):
		sess, mach = self.getSessionAndMachine(uuid) 
		
		# Power up the machine
		try:
			progress = mach.launchVMProcess(sess, "headless", "")
		except pythoncom.com_error, e:
			self.handleCOMError(uuid, "Starting VM", e)
			
			return
		
		# Add the progress object to the monitor list
		self.progressMonitors.append((progress, mach))
		
	def controlMachine(self, uuid, command):
		try:
			# Create a session object
			sess, mach = self.getSessionAndMachine(uuid, True)

			# Find the appropriate function to call
			fn = {
				'powerdown': sess.console.powerDown,
				'powerdownacpi': sess.console.powerButton,
				'pause': sess.console.pause,
				'resume': sess.console.resume,
				'reset': sess.console.reset
			}[command]
			
			# Execute the command
			fn();
			
		except pythoncom.com_error, e:
			self.handleCOMError(uuid, "Stopping VM", e)
		
	
	def getMachines(self):
		return self.machines
	
	def getMachineListOp(self):
		l = [ self._opModify(m, True) for m in self.machines.values() ]
		return l

	# Machine state update communication protocol
	def _opModify(self, machine, new = False):
		if new:
			op = 'add'
		else:
			op = 'modify'
			
		return {
			'op': op, 
			'uuid': machine.id,
			'name': machine.name,
			'description': machine.description,
			'ostype': machine.OSTypeId,
			'cpus': machine.CPUCount,
			'memory': machine.memorySize,
			'state': self.machineStateEnum[machine.state]
			}
	
	def _opDelete(self, uuid):
		return {'op': 'del', 'uuid': uuid}
	
	def _opMachState(self, uuid, newstate):
		return {
			'op': 'machstate',
			'uuid': uuid,
			'newstate': self.machineStateEnum[newstate]
			}
		
	def _opAsyncError(self, message, uuid):
		return {
			'op': 'asyncerror',
			'uuid': uuid,
			'message': message
			}

	
	def run(self):
		cherrypy.log("VBoxStateTracker event dispatching thread is starting")
		self.running = True
		while(self.running):
			# Wait for events
			for dsp in self.eventDispatchers:
				dsp.process()
				
			# Watch progress monitors for completion
			for pmpair in self.progressMonitors:
				pm = pmpair[0]   # IProgress interface
				mach = pmpair[1] # IMachine interface
				
				if pm.completed == 1:
					# Task completed OK. Remove it from the monitor list
					self.progressMonitors.remove(pmpair)
					
					if pm.resultCode != 0:
						# Task completed with error.
						message = "Error while %s <em>%s</em>: %s" % (pm.description, mach.name, pm.errorInfo.text)
						op = self._opAsyncError(message, mach.id) 
						cherrypy.engine.publish('websocket-broadcast', TextMessage(json.dumps(op)))
	
	def machineRegisteredHandler(self, ev):
		cherrypy.log("Machine %s got %s" % (ev.machineId, "registered" if ev.registered else "unregistered"))
		if ev.registered:
			# New machine got registered
			
			# Add the new machine to the internal cache
			machlist = self.manager.getArray(self.vb, 'machines')
			newMachine = None
			for m in machlist:
				if m.id == ev.machineId:
					newMachine = m
					break
				
			if newMachine is None:
				cherrypy.log.error("New machine registered, but not found on the list")
				return
			
			self.machines[newMachine.id] = newMachine
			
			# Broadcast the message to the clients
			op = self._opModify(newMachine, True)
			cherrypy.engine.publish('websocket-broadcast', TextMessage(json.dumps(op)))
			
		else:
			# Machine got unregistered
			
			# Remove the machine from the internal cache
			try:
				del self.machines[ev.machineId]
			except KeyError:
				cherrypy.log.error("Unregistered machine could not be found in the internal cache")
				
			# Broadcast the message to all clients
			op = self._opDelete(ev.machineId)
			cherrypy.engine.publish('websocket-broadcast', TextMessage(json.dumps(op)))			

		
	def machineStateChangedHandler(self, ev):
		cherrypy.log("Machine %s state changed to %s" % (ev.machineId, self.machineStateEnum[ev.state]))
		op = self._opMachState(ev.machineId, ev.state)
		cherrypy.engine.publish('websocket-broadcast', TextMessage(json.dumps(op)))

	def machineDataChangedHandler(self, ev):
		# Something has change with a currently listed machine.
		# Get the machine from the list
		try:
			mach = self.machines[ev.machineId]
		except KeyError:
			cherrypy.log.error("Modified machine could not be found in the internal cache")
			return
		
		op = self._opModify(mach)
		cherrypy.engine.publish('websocket-broadcast', TextMessage(json.dumps(op)))
		
	def stop(self):
		# When deleting the object, stop the running thread first
		if self.running == True:
			cherrypy.log("VBoxStateTracker event dispatching thread is terminating")
			self.running = False
			self.join()
			
		# Unregister all events
		for dsp in self.eventDispatchers:
			dsp.unregister()
			
		# Remove the object instance from the global scope
		globals()['gVBoxStateTracker'] = None
		

class VBoxStatePlugin(plugins.SimplePlugin):
	def __init__(self, bus):
		plugins.SimplePlugin.__init__(self, bus)
		self.vboxTracker = VBoxStateTracker()
		
	def start(self):
		self.vboxTracker.start()
		
	def stop(self):
		self.vboxTracker.stop()
			
class VBoxAPI(object):
	def __init__(self):
		# For speed and convenience, create a map to decode
		# MachineState
		trk = self.getStateTracker(ValueError)

		
	def getStateTracker(self, exc = cherrypy.HTTPError(500)):
		try:
			# Try to obtain a global instance of VBoxStateTracker. If not found
			# (or found, but it's None), log an error and abort
			trk = globals()['gVBoxStateTracker']
			if trk is None:
				raise KeyError
			
			return trk
		
		except KeyError:
			cherrypy.log.error('VBoxStateTracker instance not found')
			raise exc
		
	@cherrypy.expose
	@cherrypy.tools.json_out()
	def list(self):
		# Retrieves an initial list of registered machines
		trk = self.getStateTracker()
		machines = trk.getMachineListOp()
		return machines
	
	@cherrypy.expose
	@cherrypy.tools.websocket()
	def feed(self):
		# Request for a WebSocket for getting constant updated
		pass
	
	@cherrypy.expose
	def vmstart(self, uuid=''):
		"Start a VirtualBox machine"
		cherrypy.log("VirtualBox: START %s" % uuid)
		self.getStateTracker().startMachine(uuid)

		

	@cherrypy.expose	
	def vmpoweroffacpi(self, uuid=''):
		"Power off (ACPI) a VirtualBox machine"
		cherrypy.log("VirtualBox: ACPI POWEROFF %s" % uuid)
		self.getStateTracker().controlMachine(uuid, 'powerdownacpi')

	@cherrypy.expose
	def vmpoweroff(self, uuid=''):
		"Power off a VirtualBox machine"
		cherrypy.log("VirtualBox: ACPI POWEROFF %s" % uuid)
		self.getStateTracker().controlMachine(uuid, 'powerdown')

	@cherrypy.expose		
	def vmpause(self, uuid=''):
		"Pause a VirtualBox machine"
		cherrypy.log("VirtualBox: PAUSE %s" % uuid)
		self.getStateTracker().controlMachine(uuid, 'pause')

	@cherrypy.expose
	def vmresume(self, uuid=''):
		"Resume a VirtualBox machine"
		cherrypy.log("VirtualBox: RESUME %s" % uuid)
		self.getStateTracker().controlMachine(uuid, 'resume')



