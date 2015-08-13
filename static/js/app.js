define(["jquery", "jquery-ui", "datatables", "noty", "stateReflectorController", "shortener"], function($) {
  
  var vmStateIcon = {
    "states": {
	  "FirstOnline": { "clazz": "vm-state-FirstOnline" },
	  "PoweredOff": { "clazz": "vm-state-PoweredOff" },
      "Aborted": { "clazz": "vm-state-Aborted" },
	  "Paused": { "clazz": "vm-state-Paused" },
	  "Starting": { "clazz": "vm-state-Starting" },
	  "Stopping": { "clazz": "vm-state-Stopping" },
	  "_pending": { "clazz": "vm-state-_pending"}
	},
	"menu": [
	  { title: 'Start', img: 'control.png', enabled: ['PoweredOff', 'Aborted'],
		  onclick: function(id) { execVBoxCommand(id, 'vmstart'); },
	  },
	  { title: 'Power Off (ACPI)', img: 'control-power.png', enabled: ['FirstOnline', 'Paused'],
		  onclick: function(id) { execVBoxCommand(id, 'vmpoweroffacpi'); },
	  },
	  { title: 'Power Off', img: 'control-stop-square.png', enabled: ['FirstOnline'],
		  onclick: function(id) { execVBoxCommand(id, 'vmpoweroff'); },		  
	  },
	  { title: 'Pause', img: 'control-pause.png', enabled: ['FirstOnline'],
		  onclick: function(id) { execVBoxCommand(id, 'vmpause'); },	  
	  },
	  { title: 'Resume', op: 'vmresume', img: 'control-double.png', enabled: ['Paused'],
	  onclick: function(id) { execVBoxCommand(id, 'vmresume'); },	
	  },					  
	 ]
  };
  
  function execVBoxCommand(uuid, command) {
	  d
  }
	  
  $(function() {
    // Create the VM table
    $("#tabs").tabs();
	var t = $("#vmtable").DataTable(
	 {
	   "paging": false,
	   "ordering": false,
	   "info": false,
	   "searching": false
	 }
	);
	t.column(0).visible(false); // Column 0 is the raw UUID
	
	// Populate it
	$.ajax({
	  url: "/vbox/list",
	  dataType: 'json'
	  }).done(function(data) {
	    $.each(data, function(index, value) { execTableCommand(value) })
	  });
	
	// Create a websocket to receive update feed
	websocket = 'ws://localhost:8085/vbox/feed';
    if (window.WebSocket) {
      ws = new WebSocket(websocket);
    }
    else if (window.MozWebSocket) {
      ws = MozWebSocket(websocket);
    }
    else {
      console.log('WebSocket Not Supported');
    }

    ws.onmessage = function (evt) {
    	var cmd = $.parseJSON(evt.data);
    	execTableCommand(cmd);
    };
  
    ws.onclose = function (evt) {
		fatalAppError("Disconnected from server. <a href='#' onclick='javascript: location.reload()'>Reload the page</a>")
    }
    
    
    // noty defaults
    ////////////////
    $.noty.defaults.timeout = 5000;

  });
  
  function fatalAppError(message) {
	  $('#screen').show();
	  $('#fatal-notification').html(message);
	  $('#fatal-notification').show();
  }
  
  function execTableCommand(cmd)
  {
    op = cmd.op;
    var table = $("#vmtable").DataTable(); 
    
    switch(op) {
      case "add":
      case 'modify':
    	// Add machine to the list
        var uuid = cmd.uuid

        if (op === 'add') {
          // Set-up a new row
          var drow = [
              uuid,
			  "", //"<span id='mstate-" + uuid + "'></span>", // state
			  cmd.name, // name
			  '', // uuid
			  "<span class='mach-memory'>" + cmd.memory + "</span>", // Memory size
			  "<span class='mach-cpus'>" + cmd.cpus + "</span>", // Number of CPUs
			  cmd.ostype, // OS Type
			  cmd.description // Description
              ];
        
       	  var rr = table.row.add(drow).draw().node();
       	  var uuid_cell = $(rr.cells[0])
       	  uuid_cell.stateReflectorController(uuid, cmd.state, vmStateIcon);
       	  uuid_cell.attr('id', 'mstate-' + uuid)
       	  $(rr.cells[2]).shortener(uuid, 6);
        }
        
      	try {
          var r = findRowByUUID(cmd.uuid).node().cells;
          $(r[1]).html(cmd.name);
          $(r[3]).find('span').html(cmd.memory);
          $(r[4]).find('span').html(cmd.cpus);
          $(r[5]).html(cmd.ostype);
          $(r[6]).html(cmd.description);
          table.draw();
    	}
    	catch(err) {
    		console.error("[modify] " + err);
    	}
        break;
        
      case "del":
      	// delete machine from the list
    	  try {
    		  findRowByUUID(cmd.uuid).remove().draw()
    	  }
    	  catch(err) {
    		  console.error("[del] " + err);
    	  }
    	  break;
    	  
      case "machstate":
    	  // Update a machine state
    	  var el = machineStateElement(cmd.uuid)
    	  if (el === undefined)
    		  console.log("Trying to change state of an unregistered machine " + cmd.uuid);
    	  else
    		  el.setState(cmd.newstate);
    	  break;
    	  
      case "asyncerror":
    	  // Asynchronous error
    	  noty({text: cmd.message, type: "error"});
    	  break;
    }
  }
  
  function findRowByUUID(uuid) {
	  var table = $("#vmtable").DataTable(); 
	  var ids = table.column(0).data()
	  var irow = ids.indexOf(uuid)
	  if (irow >= 0) {
		  return table.row(irow)
	  }
	  else {
		  throw "Row with UUID " + uuid + " not found on the table";
	  }
  }
  
  function machineStateElement(uuid) {
	  return $("#mstate-"+uuid)[0];
  }
  
  function uuidtest() {
	  var e = $('<span style="position: absolute"/>');
	  var t = $(this);
  }
   

});
