define(["jquery"], function($) {
// Machine state/control plugin

  
  
  // shortener Plugin
  ///////////////////
  (function($) {
	  $.fn.shortener = function(maxShortLength, options) {
		  var defaults = {
				  'class-prefix': 'shortener'
		  };
		  $.extend(defaults, options);
		  
		  // Short form
		  var text = $(this).text()
		  var textsh = text.substr(0, maxShortLength);
		  $(this).text('');
		  var shortClass = defaults['class-prefix'] + '-short';
		  if (defaults['class-short'] !== undefined)
		    shortClass = defaults['class-short'];
  		
		  var shorttext = $('<span class="' + shortClass + '">' + textsh + '</span>');
		  $(this).append(shorttext);
		  
		  // Long form
		  // The long form gets both the sort form class with long form class that may
		  // override it
		  var longClass = shortClass + ' ' + defaults['class-prefix'] + '-long';
		  if (defaults['class-long'] !== undefined)
			  longClass = defaults['class-long'];
		  var longtext = $('<span class="' + longClass + '">' + text + '</span>');

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

});
