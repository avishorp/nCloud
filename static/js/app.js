define(["jquery", "jquery-ui", "datatables", "noty", "stateReflectorController", "shortener"], function($) {
  
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
      case "modify":
    	// Add machine to the list
        var uuid = cmd.uuid
      
        var drow = [
            uuid,
			"<span class='mach-state-icon' id='mstate-" + uuid + "'/>", // state
			cmd.name, // name
			'', // uuid
			"<span class='mach-memory'>" + cmd.memory + " MB</span>", // Memory size
			"<span class='mach-cpus'>" + cmd.cpus + "</span>", // Number of CPUs
			cmd.ostype, // OS Type
			cmd.description // Description
                   ]
        
        if (op === "add") {
        	var rr = table.row.add(drow).draw().node();
        	$(rr.cells[2]).shortener(uuid, 6);
			machineStateElement(uuid).machineCtrl(cmd.state);
        }
        else {
        	try {
        		r = findRowByUUID(uuid);
        		r.data(drow).draw()
        	}
        	catch(err) {
        		console.error("[modify] " + err);
        	}
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
    	  machineStateElement(cmd.uuid).machineCtrl(cmd.newstate);
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
	  return $("#mstate-"+uuid);
  }
  
  function uuidtest() {
	  var e = $('<span style="position: absolute"/>');
	  var t = $(this);
  }
   

});
