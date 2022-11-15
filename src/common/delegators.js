import {registry} from '@polylith/core';

export class ServiceDelegator {
	constructor(serviceName) {
		this.serviceName = serviceName;
		this.service = registry.subscribe(serviceName);
	}

	bindInbound(that, method) {
		return that[method].bind(that);
	}

	boundOutbound(method, ...args) {
		this.service.fire(method, ...args)
	}

	delegateInbound(that, methods) {
		methods.forEach(function(method) {
			this.service.listen(method, this.bindInbound(that, method));
		}, this)
	}

	delegateOutbound(that, methods) {
		methods.forEach(function (method) {
			that[method] = this.boundOutbound.bind(this, method)
		}, this);
	}

	newDelegator() {
		return new ServiceDelegator(this.serviceName);
	}
}
