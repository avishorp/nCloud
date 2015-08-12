define(["jquery", "jquery-ui", "datatables", "noty"], function($) {
// Machine state/control plugin
  (function($) {
	  $.fn.machineCtrl = function(initState) {
  	
		  $.each(this, function(index, el) {

			  var uuid = el.id.substr(7);
			  
			  // Check if a popup menu for this element has already been
			  // created, if not create one
			  if (this._mach_popup === undefined) {
				  createPopupMenu($(this), uuid);
				  $.extend(this, {_mach_popup: true});
			  }

			  // Set the class to the state icon
			  setStateClass(el, stateToClass(initState));
			  
			  // Enable/disable appropriate menu items
			  $('#mach-control-menu-' + uuid).find("li").each(function(indx, val) {
				 if (_machControlMenu[indx].enabled.indexOf(initState) != -1)
					 // Enable the item
					 $(val).removeClass('menu-grayed');
				 else
					 $(val).addClass('menu-grayed');
			  });
		 
		    });
  		    
  	    return this;
	}
	  var _machControlMenu = [
			  { title: 'Start', op: 'vmstart', img: 'control.png', enabled: ['PoweredOff', 'Aborted'] },
			  { title: 'Power Off (ACPI)', op: 'vmpoweroffacpi', img: 'control-power.png', enabled: ['FirstOnline', 'Paused'] },
			  { title: 'Power Off', op: 'vmpoweroff', img: 'control-stop-square.png', enabled: ['FirstOnline'] },
			  { title: 'Pause', op: 'vmpause', img: 'control-pause.png', enabled: ['FirstOnline'] },
			  { title: 'Resume', op: 'vmresume', img: 'control-double.png', enabled: ['Paused'] },
	  ]
 
	  function stateToClass(state) {
		  // Make sure the state is legal
		  var states = ["PoweredOff", "Starting", "FirstOnline", "Paused", "Aborted", "Stopping", "_pending"];
		  if (states.indexOf(state) >= 0) {
			  return "vm-state-" + state;
		  }
		  else {
			  console.error("Illegal state [" + state + "] received");
		  }
	  }
	  
	  function setStateClass(obj, clz) {
		cl = obj.classList;
		ncl = []
		cl.forEach(function(el) {
			if (!el.startsWith("vm-state-"))
				ncl.push(el);
		})
		ncl.push(clz);
		obj.className = ncl.join(" ");
	  }
	  
	  function createMenu() {
		  var menu = $('<ul class="machine-menu"><div class="machine-menu-gutter"></div></ul>');
		  
	  }
	  
	  function createPopupMenu(target, uuid) {
		  var menu = $('<ul>');
		  menu.addClass("mach-control-menu");
		  menu.attr('id', 'mach-control-menu-' + uuid)
		  
		  // Create menu items
		  $.each(_machControlMenu, function(indx, val) {
			 menu.append(createPopupMenuItem(val['title'], uuid, val['op'], val['img'], "")); 
		  });

		  // Append the menu to the target element
		  target.append(menu);
		  
		  // Bind the click event
		  target.click(function(e) {
			   // Calculate the pop-up menu position
			   var left = e.pageX + 5; /* nudge to the right, so the pointer is covering the title */
			   var top = e.pageY;
			   if (top + menu.height() >= $(window).height()) {
			 	  top -= menu.height();
			   }
			   if (left + menu.width() >= $(window).width()) {
			      left -= menu.width();
			   }

			   // Position and show menu
			   menu.css({zIndex:1000001, left:left, top:top}).show();

			   // Show the screen
			   $('#mach-control-menu-screen').off('click')
			     .click(function() {
				   menu.hide();
				   $(this).hide();
			     })
			     .show();
		  });
		  
		  $('body').append(menu);
	  }
	  
	  function createPopupMenuItem(title, uuid, op, img, clazz) {
		  var li = $('<li>');
		  var hl = $('<a>');
		  hl.attr('href', '#');
		  hl.append(title);
		  
		  var icon = $('<img/>');
		  icon.attr('src', "img/" + img);
		  
		  hl.click(function() {
			// Check if the item is not grayed
			if ($(this).parent().hasClass('menu-grayed'))
				// Grayed - return without doing anything (not even close the menu)
			    return
			    
			// Execute the menu operation
           	var opurl = "/vbox/" + op + "?uuid=" + uuid;
       		$.ajax({
  			  url: opurl
       		}).done(function() {
	        			
	        });
			  
			// Hide the menu
			$(this).parent().parent().hide();
			$('#mach-control-menu-screen').hide();
			
			// Change the machine state to "pending"
			cmd = { op: 'machstate', uuid: uuid, newstate: '_pending' };
			execTableCommand(cmd);
		  });
		  
		  return li.append(icon).append(hl);
	  }
	  
	  
  }(jQuery));
  
  
  // shortener Plugin
  ///////////////////
  (function($) {
	  $.fn.shortener = function(text, shortLen) {
		  // Short form
		  var shorttext = $('<span class="shortener-short">' + text.substr(0, shortLen) + '</span>');
		  $(this).append(shorttext);
		  
		  // Long form
		  var longtext = $('<span class="shortener-long">' + text + '</span>');
		  $(this).append(longtext);
		  
		  // Attach the hover process
		  $(this).hover(
				  // Handler In
				  function(e) {
					  longtext.css(shorttext.position());
					  longtext.show();
				  },
				  
		          // Handler Out
		          function(e) {
					  longtext.hide();
				  }
		  );
	  }
  }(jQuery));
  
  $(function() {
	  // Enable tooltips
//	  $( document ).tooltip({ tooltipClass: "uuid shortuuid-tooltip" });
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
