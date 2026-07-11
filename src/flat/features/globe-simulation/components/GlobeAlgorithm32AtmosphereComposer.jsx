import React from 'react';
import * as THREE from 'three';

import {
	Algorithm32R3FAtmosphereComposer,
	createAlgorithm32SceneColorRenderTarget,
} from '../../../../../shared/algorithm32/production/react/index.js';
import {
	ALGORITHM32_METERS_PER_SCENE_UNIT,
	algorithm32AtmosphereEnabled,
	createAlgorithm32,
	createAlgorithm32BindingValues,
	createGlobeAlgorithm32Config,
	updateGlobeAlgorithm32BindingValues,
} from '../../../shared/algorithm32-production-config.js';

const DEFAULT_GLOBE_GROUND_COLOR = '#4fa33d';

/**
 * Create the globe scene-color render target.
 *
 * @param {number} width - Store target width in pixels.
 * @param {number} height - Store target height in pixels.
 * @returns {THREE.WebGLRenderTarget} The color render target.
 */
export function createGlobeSceneColorRenderTarget(width, height) {
	return createAlgorithm32SceneColorRenderTarget({
		THREE,
		width,
		height,
		type: THREE.HalfFloatType,
		name: 'GlobeSimulation.Algorithm32.sceneColor',
		colorSpace: THREE.LinearSRGBColorSpace,
	});
}

/**
 * Render globe solid contents through the production Algorithm32 atmosphere.
 */
export default class GlobeAlgorithm32AtmosphereComposer extends React.Component {
	constructor(props) {
		super(props);

		this._configScene = null;
		this._configEnabled = null;
		this._config = null;
		this._createBindingValues = this._createBindingValues.bind(this);
		this._createGeometryEndpointRequest = this._createGeometryEndpointRequest.bind(this);
		this._createLightingRequest = this._createLightingRequest.bind(this);
		this._createRenderTarget = this._createRenderTarget.bind(this);
		this._updateBindingValues = this._updateBindingValues.bind(this);
	}

	_getConfig(scene, enabled) {
		if (!enabled) {
			return null;
		}

		if (scene !== this._configScene || enabled !== this._configEnabled) {
			this._configScene = scene;
			this._configEnabled = enabled;
			this._config = createGlobeAlgorithm32Config(scene);
		}

		return this._config;
	}

	_createBindingValues({ THREE: threeNamespace }) {
		return createAlgorithm32BindingValues(threeNamespace);
	}

	_createGeometryEndpointRequest() {
		const color = new THREE.Color(this.props.scene?.surface?.material?.color || DEFAULT_GLOBE_GROUND_COLOR);

		return {
			name: 'globe-simulation-algorithm32-ground',
			visualMaterialColor: color.getHex(),
			visualMaterialLighting: 'lambert',
			widthSegments: 256,
			heightSegments: 128,
		};
	}

	_createLightingRequest() {
		const scene = this.props.scene;
		const earthRadiusKm = positiveFiniteOrDefault(Number(scene?.geometry?.earthRadiusKm), 6371);

		return {
			directionToSourceScene: vectorArray(scene?.sun?.direction, [0, 1, 0]),
			focusSceneUnits: vectorArray(scene?.camera?.targetKm ?? scene?.observer?.positionKm, [0, 0, 0]),
			lightDistanceSceneUnits: earthRadiusKm * 3,
			intensity: 3,
			ambientIntensity: 0.15,
		};
	}

	_createRenderTarget({ width, height }) {
		return createGlobeSceneColorRenderTarget(width, height);
	}

	_updateBindingValues({ bindingValues, camera }) {
		updateGlobeAlgorithm32BindingValues(bindingValues, camera);
	}

	render() {
		const { children, scene } = this.props;
		const enabled = algorithm32AtmosphereEnabled(scene);
		const config = this._getConfig(scene, enabled);

		return (
			<Algorithm32R3FAtmosphereComposer
				background="#070910"
				config={config}
				createAlgorithm32={createAlgorithm32}
				createBindingValues={this._createBindingValues}
				geometryEndpointRequest={this._createGeometryEndpointRequest}
				lightingRequest={this._createLightingRequest}
				createRenderTarget={this._createRenderTarget}
				enabled={enabled}
				metersPerSceneUnit={ALGORITHM32_METERS_PER_SCENE_UNIT}
				requiredObjectsKey={scene}
				updateBindingValues={this._updateBindingValues}
			>
				{children}
			</Algorithm32R3FAtmosphereComposer>
		);
	}
}

function vectorArray(vector, fallback) {
	if (!vector) {
		return fallback;
	}

	return [
		Number(vector.x) || 0,
		Number(vector.y) || 0,
		Number(vector.z) || 0,
	];
}

function positiveFiniteOrDefault(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}
