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
	createFlatAlgorithm32Config,
	updateFlatAlgorithm32BindingValues,
} from '../../../shared/algorithm32-production-config.js';

const DEFAULT_SKY_DIFFUSE_IRRADIANCE_SCALE = 0.35;
const DEFAULT_FLAT_GROUND_COLOR = 0x4fa33d;

/**
 * Create the flat scene-color render target.
 *
 * @param {number} width - Store target width in pixels.
 * @param {number} height - Store target height in pixels.
 * @returns {THREE.WebGLRenderTarget} The color render target.
 */
export function createFlatSceneColorRenderTarget(width, height) {
	return createAlgorithm32SceneColorRenderTarget({
		THREE,
		width,
		height,
		type: THREE.UnsignedByteType,
		name: 'FlatSimulation.Algorithm32.sceneColor',
	});
}

/**
 * Render solid scene contents through the production Algorithm32 atmosphere.
 */
export default class FlatAlgorithm32AtmosphereComposer extends React.Component {
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
			this._config = createFlatAlgorithm32Config(scene, scene?.lighting?.atmosphereSun);
		}

		return this._config;
	}

	_createBindingValues({ THREE: threeNamespace }) {
		return createAlgorithm32BindingValues(threeNamespace);
	}

	_createGeometryEndpointRequest() {
		return {
			name: 'flat-simulation-algorithm32-ground',
			visualMaterialColor: DEFAULT_FLAT_GROUND_COLOR,
			visualMaterialLighting: 'lambert',
		};
	}

	_createLightingRequest({ config }) {
		const scene = this.props.scene;
		const observerPosition = scene?.observer?.position || {};
		const cameraHeightKm = positiveFiniteOrDefault(
			Number(scene?.observer?.view?.cameraHeightKm),
			0.01,
		);
		const source = scene?.lighting?.atmosphereSun ?? scene?.lighting?.sun ?? {};
		const observerScenePositionUnits = [0, cameraHeightKm, 0];
		const sourcePositionSceneUnits = scenePointToObserverLocalSceneUnits(source.position, observerPosition);

		return {
			sourcePositionSceneUnits,
			observerScenePositionUnits,
			sourceRelativePosition: config.geometry.resolveSourceRelativePosition({
				position: [0, 0, cameraHeightKm * 1000],
			}),
			ambientIntensity: positiveFiniteOrDefault(
				Number(scene?.atmosphere?.rendering?.skyDiffuseIrradianceScale),
				DEFAULT_SKY_DIFFUSE_IRRADIANCE_SCALE,
			),
			endpointColorStatus: 'abstraction-owned-required-flat-endpoints',
			endpointSceneLightScalePolicy: 'observer-incident-scale',
		};
	}

	_createRenderTarget({ width, height }) {
		return createFlatSceneColorRenderTarget(width, height);
	}

	_updateBindingValues({ bindingValues, camera }) {
		updateFlatAlgorithm32BindingValues(bindingValues, camera, this.props.scene, this._config);
	}

	render() {
		const { children, scene } = this.props;
		const enabled = algorithm32AtmosphereEnabled(scene);
		const config = this._getConfig(scene, enabled);

		return (
			<Algorithm32R3FAtmosphereComposer
				background="#060912"
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

function scenePointToObserverLocalSceneUnits(point, observerPosition) {
	const sourcePoint = point || {};
	const observerPoint = observerPosition || {};

	return [
		(Number(sourcePoint.x) || 0) - (Number(observerPoint.x) || 0),
		Number(sourcePoint.y) || 0,
		(Number(sourcePoint.z) || 0) - (Number(observerPoint.z) || 0),
	];
}

function positiveFiniteOrDefault(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}
