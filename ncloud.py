"""
nanoCloud - Tiny virtual computer management system
"""

import sys
sys.path.append('lib')
from ws4py.server.cherrypyserver import WebSocketPlugin, WebSocketTool
from ws4py import configure_logger
import cherrypy, logging
import os.path
from vbox import VBoxStatePlugin, VBoxAPI
import vbox

class NCloudRoot:

    def __init__(self):
        self.vbox = VBoxAPI()

    @cherrypy.expose
    def index(self):
        raise cherrypy.HTTPRedirect(["/static/index.html"], 301)


# Configure and register ws4py
configure_logger(level=logging.DEBUG)
WebSocketPlugin(cherrypy.engine).subscribe()
#cherrypy.tools.websocket = WebSocketTool()

# Configure the VBox State Tracker Plugin
VBoxStatePlugin(cherrypy.engine).subscribe()


tutconf = os.path.join(os.path.dirname(__file__), 'ncloud.conf')

#vbox.engine = cherrypy.engine


if __name__ == '__main__':
    # CherryPy always starts with app.root when trying to map request URIs
    # to objects, so we need to mount a request handler root. A request
    # to '/' will be mapped to HelloWorld().index().
    cherrypy.quickstart(NCloudRoot(), config=tutconf)
