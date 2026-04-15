import { Service } from "@polylith/core";

export default class HealthService extends Service {
	constructor(registry) {
		super("health", registry);
		this.implement(["ready", "routes"]);
	}

	ready() {
		this.routerService = this.registry.subscribe("routers");
		this.routerService.add(this.serviceName);
	}

	routes(express, router, app) {
		router.get("/api/health", this.getHealth.bind(this));
	}

	getHealth(req, res) {
		res.json({result: "ok"});
	}
}

new HealthService();
