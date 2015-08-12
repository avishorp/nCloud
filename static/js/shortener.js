define(["jquery"], function($) {
// Machine state/control plugin

  
  
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

});
