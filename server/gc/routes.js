export default function(router) {
	router.get('/api/health', function(req, res) {
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({result: 'ok'}));
	})
}
