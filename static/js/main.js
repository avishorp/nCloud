requirejs.config({
	"baseUrl": "/static/js",
	"paths": {
		"jquery": "//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min",
		"jquery-ui": "//ajax.googleapis.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min",
		"datatables": "//cdn.datatables.net/1.10.7/js/jquery.dataTables.min",
		"noty": "jquery.noty.packaged.min"
	}
});

requirejs(["app"]);
