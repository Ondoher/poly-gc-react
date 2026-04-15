import { Service } from "@polylith/core";

export default class RoutersService extends Service {
    constructor(registry) {
        super('routers', registry);

        this.implement(['start', 'add', 'get']);
    }

    start() {
        this.serviceNames = [];
    }

    add(name) {
        this.serviceNames.push(name)
    }

    get() {
        return this.serviceNames;
    }
}

new RoutersService();
