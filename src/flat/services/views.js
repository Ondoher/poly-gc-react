import { Service } from '@polylith/core';

export default class ViewsService extends Service {
	constructor(registry) {
		super('views', registry);
		this.implement(['start', 'add', 'get', 'has']);
	}

	start() {
		this.views = {};
	}

	add(viewId, serviceName) {
		const view = this.registry.subscribe(serviceName);

		if (!view) {
			throw new Error(`View service "${serviceName}" is not registered for view "${viewId}".`);
		}

		this.views[viewId] = view;
		this.fire('view-added', {
			viewId,
			serviceName,
		});
	}

	get(viewId, props = {}) {
		const view = this.views[viewId];

		if (!view) {
			return null;
		}

		return view.getComponent(props);
	}

	has(viewId) {
		return Boolean(this.views[viewId]);
	}
}

new ViewsService();
