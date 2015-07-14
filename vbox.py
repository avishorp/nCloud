import sys
sys.path.append('lib')

import cherrypy, threading, logging
from cherrypy.process import wspbus, plugins
import os.path
from ws4py.websocket import WebSocket
from ws4py.messaging import TextMessage
import vboxapi
import time

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
			})
		self.eventDispatchers = [ e ]
		
		
	def run(self):
		cherrypy.log("VBoxStateTracker event dispatching thread is starting")
		self.running = True
		while(self.running):
			# Wait for events
			for dsp in self.eventDispatchers:
				dsp.process()
	
	def machineRegisteredHandler(self, ev):
		cherrypy.log("Machine %s got %s" % (ev.machineId, "registered" if ev.registered else "unregistered"))
		
	def machineStateChangedHandler(self, ev):
		states = self.const.all_values('MachineState')
		istates = { states[k]:k for k in states }
		cherrypy.log("Machine %s state changed to %s" % (ev.machineId, istates[ev.state]))
		
	def stop(self):
		# When deleting the object, stop the running thread first
		if self.running == True:
			cherrypy.log("VBoxStateTracker event dispatching thread is terminating")
			self.running = False
			self.join()
			
		# Unregister all events
		for dsp in self.eventDispatchers:
			dsp.unregister()
		
	@cherrypy.expose
	def dlist(self):
		ml = ''.join(["<li>%s: <em>%s</em></li>" % (m, self.machines[m].name) for m in self.machines])
		return "<html><body><ul>%s</ul></body></html>" % ml

class VBoxStatePlugin(plugins.SimplePlugin):
	def __init__(self, bus):
		plugins.SimplePlugin.__init__(self, bus)
		self.vboxTracker = VBoxStateTracker()
		
	def start(self):
		self.vboxTracker.start()
		
	def stop(self):
		self.vboxTracker.stop()
			
class VBoxWebSocket(WebSocket):
	def ready(self):
		cherrypy.log("VBWebSocket opened")

class VBoxAPI(object):
	pass

