import React from 'react';
import { createPortal } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

import { Algorithm32 } from '../Algorithm32.js';
import {
	algorithm32ViewportPixels,
	createAlgorithm32BindingValues,
	createAlgorithm32RequiredThreeObjects,
	createAlgorithm32SceneColorRenderTarget,
} from './Algorithm32ReactUtils.js';

/**
 * Wrap arbitrary Three/R3F children in a production Algorithm32 composer chain.
 */
export default class Algorithm32AtmosphereComposer extends React.Component {
	static defaultProps = {
		enabled: true,
		background: '#060912',
		metersPerSceneUnit: 1,
		distanceMultiplier: null,
		sceneDepthMaxMeters: null,
		logger: console,
		setupOptions: null,
		includeRequiredObjects: true,
		createRequiredObjects: createAlgorithm32RequiredThreeObjects,
		geometryEndpointRequest: null,
		lightingRequest: null,
		requiredObjectsKey: null,
		createAlgorithm32: (config) => new Algorithm32(config),
		createBindingValues: ({ THREE: threeNamespace }) =>
			createAlgorithm32BindingValues(threeNamespace),
		createRenderTarget: ({ THREE: threeNamespace, width, height }) =>
			createAlgorithm32SceneColorRenderTarget({
				THREE: threeNamespace,
				width,
				height,
			}),
		updateBindingValues: null,
		onSetupError: null,
		onSetupReady: null,
	};

	constructor(props) {
		super(props);

		this.state = {
			setupError: null,
			shaderReady: false,
		};

		this._mounted = false;
		this._setupGeneration = 0;
		this._composer = null;
		this._renderTarget = null;
		this._renderPass = null;
		this._algorithm32 = null;
		this._shaderHandle = null;
		this._bindingValues = null;
		this._solidScene = new THREE.Scene();
		this._requiredObjects = [];
		this._requiredObjectsPacket = null;
		this._requiredObjectsInput = null;
		this._requiredObjectsError = null;
		this._composerNeedsSetup = false;
		this._updateBackground(props);
		this._syncRequiredObjects(props);
	}

	componentDidMount() {
		this._mounted = true;
		this._ensureComposer();
		this._setupRuntime();
	}

	componentDidUpdate(previousProps) {
		this._updateBackground(this.props);
		this._syncRequiredObjects(this.props);

		if (this._composerInputsChanged(previousProps)) {
			this._recreateComposer();
		} else if (this._composer) {
			const [width, height] = this._viewportPixels();

			this._composer.setPixelRatio(1);
			this._composer.setSize(width, height);
		}

		if (this._setupInputsChanged(previousProps) || this._composerNeedsSetup) {
			this._setupRuntime();
		}
	}

	componentWillUnmount() {
		this._mounted = false;
		this._disposeRuntime();
		this._disposeComposer();
		this._disposeRequiredObjects();
	}

	/**
	 * Called by the R3F bridge on each frame.
	 *
	 * @param {object} frameState - Supplies R3F frame state.
	 * @param {number} delta - Supplies frame delta time.
	 * @returns {boolean} True when the Algorithm32 composer rendered the frame.
	 */
	renderAlgorithm32Frame(frameState, delta) {
		if (!this.props.enabled || !this.state.shaderReady || this.state.setupError || !this._composer) {
			return false;
		}

		this._updateBindingValues(frameState, delta);
		this._composer.render(delta);

		return true;
	}

	/**
	 * Return the composer scene that receives endpoint children.
	 *
	 * @returns {THREE.Scene} The solid scene.
	 */
	getSolidScene() {
		return this._solidScene;
	}

	/**
	 * Return the scene the bridge should render while Algorithm32 is not ready.
	 *
	 * @returns {THREE.Scene | null} The fallback scene, or null when disabled.
	 */
	getFallbackScene() {
		return this.props.enabled ? this._solidScene : null;
	}

	_composerInputsChanged(previousProps) {
		return previousProps.renderer !== this.props.renderer
			|| previousProps.camera !== this.props.camera
			|| previousProps.createRenderTarget !== this.props.createRenderTarget;
	}

	_setupInputsChanged(previousProps) {
		return previousProps.enabled !== this.props.enabled
			|| previousProps.config !== this.props.config
			|| previousProps.camera !== this.props.camera
			|| previousProps.metersPerSceneUnit !== this.props.metersPerSceneUnit
			|| previousProps.distanceMultiplier !== this.props.distanceMultiplier
			|| previousProps.sceneDepthMaxMeters !== this.props.sceneDepthMaxMeters
			|| previousProps.createAlgorithm32 !== this.props.createAlgorithm32
			|| previousProps.createBindingValues !== this.props.createBindingValues
			|| previousProps.setupOptions !== this.props.setupOptions;
	}

	_requiredObjectsInputsFor(props) {
		return Object.freeze({
			enabled: props.enabled,
			config: props.config,
			metersPerSceneUnit: props.metersPerSceneUnit,
			includeRequiredObjects: props.includeRequiredObjects,
			createRequiredObjects: props.createRequiredObjects,
			geometryEndpointRequest: props.geometryEndpointRequest,
			lightingRequest: props.lightingRequest,
			requiredObjectsKey: props.requiredObjectsKey,
		});
	}

	_syncRequiredObjects(props) {
		const nextInput = this._requiredObjectsInputsFor(props);

		if (shallowEqualObject(nextInput, this._requiredObjectsInput)) {
			return;
		}

		this._disposeRequiredObjects();
		this._requiredObjectsInput = nextInput;
		this._requiredObjectsError = null;

		if (!props.enabled || !props.includeRequiredObjects || !props.config) {
			this._requiredObjectsPacket = null;
			return;
		}

		try {
			this._requiredObjectsPacket = props.createRequiredObjects({
				THREE,
				config: props.config,
				metersPerSceneUnit: props.metersPerSceneUnit,
				geometryEndpointRequest: props.geometryEndpointRequest,
				lightingRequest: props.lightingRequest,
				props,
			});
			this._requiredObjects = [...(this._requiredObjectsPacket?.objects || [])];

			for (const object of this._requiredObjects) {
				if (object && !object.parent) {
					this._solidScene.add(object);
				}
			}
		} catch (error) {
			this._requiredObjectsError = error;
			this._requiredObjectsPacket = null;
			this._requiredObjects = [];
			this.props.logger?.error?.('Algorithm32 required Three object setup failed.', error);
		}
	}

	_updateBackground(props) {
		if (!props.background) {
			this._solidScene.background = null;
			return;
		}

		this._solidScene.background = props.background.isColor
			? props.background
			: new THREE.Color(props.background);
	}

	_ensureComposer() {
		if (!this._composer && this.props.renderer && this.props.camera) {
			this._recreateComposer();
		}
	}

	_recreateComposer() {
		this._disposeRuntime();
		this._disposeComposer();

		if (!this.props.renderer || !this.props.camera) {
			return;
		}

		const [width, height] = this._viewportPixels();

		this._renderTarget = this.props.createRenderTarget({
			THREE,
			width,
			height,
			props: this.props,
		});
		this._composer = new EffectComposer(this.props.renderer, this._renderTarget);
		this._renderPass = new RenderPass(this._solidScene, this.props.camera);
		this._composer.setPixelRatio(1);
		this._composer.setSize(width, height);
		this._composer.addPass(this._renderPass);
		this._composerNeedsSetup = true;
	}

	_setupRuntime() {
		this._composerNeedsSetup = false;
		this._disposeRuntime();

		if (this._requiredObjectsError) {
			this._setStateIfMounted({
				setupError: this._requiredObjectsError,
				shaderReady: false,
			});
			return;
		}

		if (!this.props.enabled || !this.props.config || !this._composer || !this.props.camera) {
			this._setStateIfMounted({
				setupError: null,
				shaderReady: false,
			});
			return;
		}

		const generation = ++this._setupGeneration;
		const [width, height] = this._viewportPixels();
		const algorithm32 = this.props.createAlgorithm32(this.props.config);
		const bindingValues = this.props.createBindingValues({
			THREE,
			config: this.props.config,
			props: this.props,
		});
		const setupRequest = {
			THREE,
			composer: this._composer,
			scene: this._solidScene,
			camera: this.props.camera,
			viewportPixels: [width, height],
			metersPerSceneUnit: this.props.metersPerSceneUnit,
			distanceMultiplier: this.props.distanceMultiplier ?? this.props.metersPerSceneUnit,
			bindingValues,
			logger: this.props.logger,
			...(this.props.setupOptions ?? {}),
		};

		if (Number.isFinite(this.props.sceneDepthMaxMeters) && this.props.sceneDepthMaxMeters > 0) {
			setupRequest.sceneDepthMaxMeters = this.props.sceneDepthMaxMeters;
		}

		this._algorithm32 = algorithm32;
		this._bindingValues = bindingValues;
		this._setStateIfMounted({
			setupError: null,
			shaderReady: false,
		});
		this._updateBindingValues(null, 0);

		algorithm32.setupShader(setupRequest).then((shaderHandle) => {
			if (!this._isCurrentSetup(generation)) {
				shaderHandle.dispose();
				return;
			}

			this._shaderHandle = shaderHandle;
			this._setStateIfMounted({
				setupError: null,
				shaderReady: true,
			});
			this.props.onSetupReady?.({
				algorithm32,
				bindingValues,
				shaderHandle,
				solidScene: this._solidScene,
			});
		}).catch((error) => {
			if (!this._isCurrentSetup(generation)) {
				return;
			}

			this.props.logger?.error?.('Algorithm32 shader setup failed.', error);
			this._disposeRuntime();
			this._setStateIfMounted({
				setupError: error,
				shaderReady: false,
			});
			this.props.onSetupError?.(error);
		});
	}

	_updateBindingValues(frameState, delta) {
		if (!this._bindingValues || typeof this.props.updateBindingValues !== 'function') {
			return;
		}

		this.props.updateBindingValues({
			bindingValues: this._bindingValues,
			camera: this.props.camera,
			delta,
			frameState,
			props: this.props,
		});
	}

	_isCurrentSetup(generation) {
		return this._mounted && generation === this._setupGeneration;
	}

	_viewportPixels() {
		return algorithm32ViewportPixels(this.props.size);
	}

	_setStateIfMounted(nextState) {
		if (this._mounted) {
			this.setState(nextState);
		} else {
			this.state = {
				...this.state,
				...nextState,
			};
		}
	}

	_disposeRuntime() {
		this._setupGeneration += 1;
		this._shaderHandle?.dispose?.();
		this._algorithm32?.dispose?.();
		this._shaderHandle = null;
		this._algorithm32 = null;
		this._bindingValues = null;
	}

	_disposeComposer() {
		this._composer?.dispose?.();
		this._renderTarget?.dispose?.();
		this._composer = null;
		this._renderTarget = null;
		this._renderPass = null;
	}

	_disposeRequiredObjects() {
		for (const object of this._requiredObjects) {
			disposeThreeObject(object);
		}

		this._requiredObjects = [];
		this._requiredObjectsPacket = null;
	}

	render() {
		if (!this.props.enabled) {
			return <React.Fragment>{this.props.children}</React.Fragment>;
		}

		return createPortal(this.props.children, this._solidScene);
	}
}

function shallowEqualObject(left, right) {
	if (left === right) {
		return true;
	}

	if (!left || !right) {
		return false;
	}

	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);

	if (leftKeys.length !== rightKeys.length) {
		return false;
	}

	return leftKeys.every((key) => left[key] === right[key]);
}

function disposeThreeObject(object) {
	object?.parent?.remove?.(object);
	object?.traverse?.((child) => {
		child.geometry?.dispose?.();
		disposeMaterial(child.material);
	});
}

function disposeMaterial(material) {
	if (Array.isArray(material)) {
		for (const entry of material) {
			entry?.dispose?.();
		}
		return;
	}

	material?.dispose?.();
}
