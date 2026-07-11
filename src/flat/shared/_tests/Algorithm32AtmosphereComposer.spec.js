import React from 'react';
import * as THREE from 'three';

import {
	Algorithm32AtmosphereComposer,
} from '../../../../shared/algorithm32/production/react/index.js';

describe('Algorithm32AtmosphereComposer', () => {
	it('is implemented as a class component', () => {
		expect(Object.getPrototypeOf(Algorithm32AtmosphereComposer.prototype))
			.toBe(React.Component.prototype);
	});

	it('reports whether the Algorithm32 composer rendered a frame', () => {
		const updateBindingValues = jasmine.createSpy('updateBindingValues');
		const component = new Algorithm32AtmosphereComposer({
			enabled: true,
			updateBindingValues,
			camera: {},
		});
		const composer = {
			render: jasmine.createSpy('render'),
		};

		expect(component.renderAlgorithm32Frame({}, 0.016)).toBe(false);

		component.state.shaderReady = true;
		component._composer = composer;
		component._bindingValues = {};

		expect(component.renderAlgorithm32Frame({ frame: true }, 0.016)).toBe(true);
		expect(updateBindingValues).toHaveBeenCalledWith(jasmine.objectContaining({
			bindingValues: component._bindingValues,
			delta: 0.016,
			frameState: { frame: true },
		}));
		expect(composer.render).toHaveBeenCalledWith(0.016);
	});

	it('mounts required abstraction-created objects into the solid fallback scene', () => {
		const requiredObject = new THREE.Object3D();
		const createRequiredObjects = jasmine.createSpy('createRequiredObjects').and.returnValue({
			objects: [requiredObject],
		});
		const component = new Algorithm32AtmosphereComposer({
			enabled: true,
			config: { id: 'test-config' },
			includeRequiredObjects: true,
			createRequiredObjects,
			metersPerSceneUnit: 1000,
			requiredObjectsKey: 'test-key',
		});

		expect(createRequiredObjects).toHaveBeenCalledWith(jasmine.objectContaining({
			config: { id: 'test-config' },
			metersPerSceneUnit: 1000,
		}));
		expect(component.getSolidScene().children).toContain(requiredObject);
		expect(component.getFallbackScene()).toBe(component.getSolidScene());

		component.componentWillUnmount();

		expect(requiredObject.parent).toBeNull();
	});

});
