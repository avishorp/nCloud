define(["jquery", "jquery-ui"], function($) {
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
});