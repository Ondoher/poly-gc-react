import {registry} from '@polylith/core';

var counter = 0;

export class ServiceDelegator {
	constructor(serviceName) {
		this.serviceName = serviceName;
		this.service = registry.subscribe(serviceName);
		this.inboundMethods = []
		counter++;
		this.uniqueId = `delegator-${counter}`
	}

	bindInbound(that, method) {
		return that[method].bind(that);
	}

	boundOutbound(method, ...args) {
		this.service.fire(method, ...args)
	}

	delegateInbound(that, methods) {
		methods.forEach(function(method) {
			var listener = this.service.listen(method, this.bindInbound(that, method));
			this.inboundMethods.push({method, listener});
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

	freeDelegator() {
		var methods = [];
		this.inboundMethods.forEach(function({method, listener}) {
			this.service.unlisten(method, listener);
			methods.push(arguments[0]);
		}.bind(this));
		this.inboundMethods = [];
	}
}
