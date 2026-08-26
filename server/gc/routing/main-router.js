import { registry } from "@polylith/core";
var routers;

export default async function mainRouter(express, router, app, sharedRegistry) {
    if (!sharedRegistry) {
        throw new Error('Polylith did not provide the shared registry');
    }

    registry.attach('shared', sharedRegistry);
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
