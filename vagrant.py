
import os, os.path
import cherrypy
import subprocess
import re

VAGRANT_WORKING_DIR = r"c:\temp\Vargrant_workspace"
VAGRAN_EXE = "c:\\Vagrant\\bin\\vagrant.exe"

class VagrantCtrl:
    def __init__(self, workdir):
        self.parseRx = re.compile(r"(?P<timestamp>[0-9]+),(?P<target>[a-zA-Z0-9_\-]*),(?P<type>[a-z\-]+),(?P<data>.*)")
        self.workdir = workdir
        self.scan()
        
    def scan(self):
        # Scan the working directory to find environments
        dirs = filter(lambda f: os.path.isdir(os.path.join(self.workdir, f)), os.listdir(self.workdir))
        
        envs = []
        for d in dirs:
            envdir = os.path.join(self.workdir, d)
            vagrantfile = os.path.join(envdir, "Vagrantfile")
            if os.path.exists(vagrantfile):
                e = { "name": d, "workdir": envdir }
                envs.append(e)
                
        self.envs = envs;
        
    def getEnv(self, name):
        l = filter(lambda entry: entry["name"]==name, self.envs)
        if len(l) == 0:
            # Found nothing
            return None
        elif len(l) == 1:
            # Entry found, return it
            return l[0]
        else:
            # Found more than one entry - BAD
            raise ValueError
        
    def execVagrant(self, envdir, command, parse = None):
        # Execute Vagrant and read all the output
        fullcommand = [VAGRAN_EXE] + command
        vag = subprocess.Popen(fullcommand, stdout = subprocess.PIPE, cwd = envdir)
        vagout = vag.communicate()[0]
        
        # Handle returncode
        
        # Parse the output (if desirable)
        if parse is not None:
            ret = parse(vagout)
        else:
            ret = vagout
        
        return ret
    
    def vagrantMachineReadableParser(self, data):
        r = {}
        for l in data.split('\n'):
            lc = l.strip()
            mc = self.parseRx.match(lc)
            if mc is not None:
                fields = mc.groupdict()
                target = fields['target']
                if target not in r:
                    r[target] = {}
                    
                targetdata = r[target]
                targetdata[fields["type"]] = fields["data"].replace("%!(VAGRANT_COMMA)", ",")
                
        return r

        
    @cherrypy.expose
    @cherrypy.tools.json_out()       
    def listenvs(self):
        return self.envs
    
    @cherrypy.expose
    @cherrypy.tools.json_out()
    def envinfo(self, name):
        # First, check if the given name is in the list
        env = self.getEnv(name)
        if env is None:
            raise cherrypy.HTTPError(404);
        
        # Execute vagrant to gather information
        r = self.execVagrant(env["workdir"], ["status", "--machine-readable"], parse = self.vagrantMachineReadableParser)
        
        return r

