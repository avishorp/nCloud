"""
nanoCloud - Tiny virtual computer management system
"""

import cherrypy
import vboxapi

class NCloudRoot:

    def __init__(self):
		self.vbox = VirtualBoxManager()

    @cherrypy.expose
    def index(self):
        raise cherrypy.HTTPRedirect(["/static/index.html"], 301)

class VirtualBoxManager(object):
	def __init__(self):
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
		
	@cherrypy.expose
	def dlist(self):
		ml = ''.join(["<li>%s: <em>%s</em></li>" % (m, self.machines[m].name) for m in self.machines])
		return "<html><body><ul>%s</ul></body></html>" % ml
		



import os.path
tutconf = os.path.join(os.path.dirname(__file__), 'ncloud.conf')

if __name__ == '__main__':
    # CherryPy always starts with app.root when trying to map request URIs
    # to objects, so we need to mount a request handler root. A request
    # to '/' will be mapped to HelloWorld().index().
    cherrypy.quickstart(NCloudRoot(), config=tutconf)
