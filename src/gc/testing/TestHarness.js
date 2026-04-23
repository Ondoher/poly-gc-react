import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { Registry } from '@polylith/core';

import GameCenterContext from 'common/GameCenterContext.js';

if (typeof globalThis !== 'undefined') {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

/**
 * Create one DOM container for rendering a component under test.
 *
 * @returns {HTMLDivElement}
 */
function makeContainer() {
	var container = document.createElement('div');
	document.body.appendChild(container);
	return container;
}

/**
 * Render React components inside the same GameCenter context shape used by the
 * app while allowing tests to provide isolated registry services.
 */
export default class TestHarness {
	constructor() {
		this.app = {};
		this.props = {};
		this.context = {};
		this.registry = new Registry();
		this.container = null;
		this.root = null;
	}

	/**
	 * Merge app-level context data into the harness.
	 *
	 * @param {object} app - Specify app data to expose as `context.app`.
	 * @returns {TestHarness}
	 */
	withApp(app = {}) {
		this.app = {...this.app, ...app};
		return this;
	}

	/**
	 * Merge default component props into the harness.
	 *
	 * @param {object} props - Specify props to pass to each rendered component.
	 * @returns {TestHarness}
	 */
	withProps(props = {}) {
		this.props = {...this.props, ...props};
		return this;
	}

	/**
	 * Merge additional values into the GameCenter context.
	 *
	 * @param {object} context - Specify extra context values for the render.
	 * @returns {TestHarness}
	 */
	withContext(context = {}) {
		this.context = {...this.context, ...context};
		return this;
	}

	/**
	 * Replace the test registry or register a group of services.
	 *
	 * @param {Registry | Record<string, any>} registryOrServices - Specify a
	 * registry instance or a service map keyed by registry name.
	 * @returns {TestHarness}
	 */
	withRegistry(registryOrServices = {}) {
		if (typeof registryOrServices?.subscribe === 'function') {
			this.registry = registryOrServices;
			return this;
		}

		Object.entries(registryOrServices).forEach(function([name, service]) {
			this.registry.register(name, service);
		}, this);
		return this;
	}

	/**
	 * Register one fake or real service in the test registry.
	 *
	 * @param {string} name - Specify the registry service name.
	 * @param {any} service - Specify the service instance or test double.
	 * @returns {TestHarness}
	 */
	withService(name, service) {
		this.registry.register(name, service);
		return this;
	}

	/**
	 * Build the context value passed to GameCenterContext.Provider.
	 *
	 * @returns {{app: object, registry: Registry}}
	 */
	makeContextValue() {
		return {
			app: this.app,
			registry: this.registry,
			...this.context,
		};
	}

	/**
	 * Render a component inside the harness context.
	 *
	 * @param {React.ComponentType<any>} Component - Specify the component to render.
	 * @param {object} props - Specify props that override harness defaults for this render.
	 * @returns {{container: HTMLDivElement, context: object, props: object, unmount: Function}}
	 */
	render(Component, props = {}) {
		var mergedProps = {...this.props, ...props};
		var contextValue = this.makeContextValue();

		if (!this.container) {
			this.container = makeContainer();
		}

		if (!this.root) {
			this.root = createRoot(this.container);
		}

		act(() => {
			this.root.render(
				<GameCenterContext.Provider value={contextValue}>
					<Component {...mergedProps} />
				</GameCenterContext.Provider>
			);
		});

		return {
			container: this.container,
			context: contextValue,
			props: mergedProps,
			unmount: this.unmount.bind(this),
		};
	}

	/**
	 * Unmount the current React root and remove the test container.
	 */
	unmount() {
		if (!this.root || !this.container) return;

		act(() => {
			this.root.unmount();
		});

		this.root = null;
		this.container.remove();
		this.container = null;
	}
}

/**
 * Create a new component test harness.
 *
 * @returns {TestHarness}
 */
export function createTestHarness() {
	return new TestHarness();
}
