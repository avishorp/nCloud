define(["jquery", "jquery-ui"], function($) {
	  (function($) {
		  $.fn.stateReflectorController = function(uuid, initState, options) {
  
			  $.each(this, function(index, el) {

				  // Create per-instance state
				  $.extend(el, {
					  _srcState: undefined,
					  _srcClass: undefined,
					  _srcUuid: uuid,
					  _states: options.states,
					  setState: function(newState) { _setState(el, newState); }
				  });
				  
				  // Create an img tag for the icon
				  $(el).html('<img class="state-icon"></img>');
				  
				  // Create the popup menu
				  createPopupMenu($(this), options.menu);
				  
				  el.setState(initState);		 
			    });
	  		    
	  	    return this;
		  }
		  
		  function _setState(el, newState) {
			  // Make sure the state is legal
			  var s = el._states[newState];
			  if (s === undefined) {
				  console.error("Illegal state [" + newState + "] received");
				  return;
			  }
			  
			  var clz = s.clazz;
			  
			  // Remove current state class, if applied 
			  if (el._srcClass !== undefined)
				  $(el).removeClass(el._srcClass);
			  
			  $(el).addClass(clz);
			  el._srcClass = clz;
			  
			  // State icon
			  $(el).find('.state-icon').attr('src', s.icon);
/*			  
			  // Menu
			  // Enable/disable appropriate menu items
			  $('#mach-control-menu-' + uuid).find("li").each(function(indx, val) {
				 if (_machControlMenu[indx].enabled.indexOf(initState) != -1)
					 // Enable the item
					 $(val).removeClass('menu-grayed');
				 else
					 $(val).addClass('menu-grayed');
			  });*/

		  }
	 
		  	  
		  function createPopupMenu(target, menudef) {
			  var menu = $('<ul>');
			  menu.addClass("mach-control-menu");
			  //menu.attr('id', 'mach-control-menu-' + uuid)
			  
			  // Create menu items
			  $.each(menudef, function(indx, val) {
				 menu.append(createPopupMenuItem(val['title'], "", val['op'], val['img'], "")); 
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