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
					  _srcContextMenuDef: options.menu,
					  _srcContextMenu: undefined,
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
			  
			  // Menu
			  // Enable/disable appropriate menu items
			  $(el._srcContextMenu).find("li").each(function(indx, val) {
				 if (el._srcContextMenuDef[indx].enabled.indexOf(newState) != -1)
					 // Enable the item
					 $(val).removeClass('menu-grayed');
				 else
					 $(val).addClass('menu-grayed');
			  });

		  }
	 
		  	  
		  function createPopupMenu(target, menudef) {
			  var menu = $('<ul>');
			  menu.addClass("mach-control-menu");
			  var uuid = target.get(0)._srcUuid;
			  
			  // Create menu items
			  $.each(menudef, function(indx, val) {
				 menu.append(createPopupMenuItem(val['title'], uuid, val['onclick'], val['img'], "")); 
			  });
		  
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
			  
			  // Add the menu to body (so it can be placed anywhere)
			  $('body').append(menu);
			  
			  // Insert a reference to the menu
			  target.get(0)._srcContextMenu =  menu;
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
				    return;
				    
				// Execute the menu operation
				op(uuid);
				  
				// Hide the menu
				$(this).parent().parent().hide();
				$('#mach-control-menu-screen').hide();			
			  });
			  
			  return li.append(icon).append(hl);
		  }
		  
		  
	  }(jQuery));	
});