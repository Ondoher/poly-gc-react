import { registry } from "@polylith/core";
var routers;

export default async function mainRouter(express, router, app) {
    await registry.start();

    var routerService = registry.subscribe('routers');
    var routerNames = routerService.get();
    routers = routerNames.reduce(function(routers, name) {
        var service = registry.subscribe(name);
        if (service) {
             service.routes(express, router, app);
            routers.push(service);
        }

        return routers;
    }.bind(this), []);

    return true;
}
