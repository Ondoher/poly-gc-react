import {App} from '@polylith/builder';
import server from 'node-static';
import http from 'http';
import path from "path/posix";


var projectPath = path.join(App.fileToPath(import.meta.url), '../');
class GcApp extends App {
	constructor() {
		super('gc', projectPath, 'src/index.js', 'dist/gc');
		this.setHtmlTemplate('src/templates/main.html', 'dist/gc/index.html');
		this.addManualChunk([
			{includes: 'node_modules', name: 'vendor'},
			{includes: 'src/init.js', name: 'init'},
		])
	}

	async getFeatures() {
		var featureList = [

		]

		return featureList;
	}
}

var app = new GcApp();
try {
	await app.build();
	app.watch();
}
catch (e) {
	console.log(e)
}

var file = new server.Server('../dist');

http.createServer(function (request, response) {
    request.addListener('end', function () {
        file.serve(request, response);
    }).resume();
}).listen(8080);
