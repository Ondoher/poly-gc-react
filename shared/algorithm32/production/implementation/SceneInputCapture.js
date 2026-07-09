/**
 * Composer-compatible pass that captures renderer-produced scene inputs
 * consumed by the Algorithm32 runtime shader.
 */
export class SceneInputCapture {
	/**
	 * Track whether capture runs during rendering.
	 *
	 * @type {boolean}
	 */
	enabled = true;

	/**
	 * Track whether the composer should swap buffers after this pass.
	 *
	 * @type {boolean}
	 */
	needsSwap = false;

	/**
	 * Track whether the pass should clear composer buffers before drawing.
	 *
	 * @type {boolean}
	 */
	clear = false;

	/**
	 * Track whether this capture pass renders directly to the screen.
	 *
	 * @type {boolean}
	 */
	renderToScreen = false;

	/**
	 * Store the caller-provided Three namespace.
	 *
	 * @type {unknown}
	 */
	_THREE;

	/**
	 * Store the live scene to capture.
	 *
	 * @type {unknown}
	 */
	_scene;

	/**
	 * Store the live camera to capture from.
	 *
	 * @type {unknown}
	 */
	_camera;

	/**
	 * Store the render target carrying packed scene-hit distance.
	 *
	 * @type {unknown}
	 */
	_depthTarget;

	/**
	 * Store the render target carrying explicit scene-hit mask.
	 *
	 * @type {unknown}
	 */
	_hitTarget;

	/**
	 * Store the override material that packs hit distance.
	 *
	 * @type {unknown}
	 */
	_depthMaterial;

	/**
	 * Store the override material that captures hit coverage.
	 *
	 * @type {unknown}
	 */
	_hitMaterial;

	/**
	 * Store viewport dimensions as a shader uniform value.
	 *
	 * @type {unknown}
	 */
	_viewportPixels;

	/**
	 * Store scene units to Algorithm32 meters scale.
	 *
	 * @type {number}
	 */
	_distanceMultiplier;

	/**
	 * Store the largest representable scene distance.
	 *
	 * @type {number}
	 */
	_sceneDepthMaxMeters;

	/**
	 * Store capture width in pixels.
	 *
	 * @type {number}
	 */
	_width;

	/**
	 * Store capture height in pixels.
	 *
	 * @type {number}
	 */
	_height;

	/**
	 * Count completed capture frames.
	 *
	 * @type {number}
	 */
	_frameCount = 0;

	/**
	 * Track whether owned GPU resources have been disposed.
	 *
	 * @type {boolean}
	 */
	_disposed = false;

	/**
	 * Create reusable scene input capture resources.
	 *
	 * @param {SceneInputCaptureConfiguration} configuration - Supplies the
	 * renderer attachment and capture policy.
	 */
	constructor(configuration) {
		if (!configuration || typeof configuration !== 'object') {
			throw new TypeError('Scene input capture configuration is required.');
		}

		const THREE = configuration.THREE;

		for (const constructorName of ['WebGLRenderTarget', 'ShaderMaterial', 'Vector3']) {
			if (typeof THREE?.[constructorName] !== 'function') {
				throw new TypeError(`Scene input capture requires THREE.${constructorName}.`);
			}
		}

		if (!configuration.scene || typeof configuration.scene !== 'object') {
			throw new TypeError('Scene input capture requires scene.');
		}

		if (!configuration.camera || typeof configuration.camera !== 'object') {
			throw new TypeError('Scene input capture requires camera.');
		}

		this._THREE = THREE;
		this._scene = configuration.scene;
		this._camera = configuration.camera;
		this._distanceMultiplier = positiveFiniteOrDefault(configuration.distanceMultiplier, 1);
		this._sceneDepthMaxMeters = positiveFiniteOrDefault(configuration.sceneDepthMaxMeters, 100000);
		this._width = positiveIntegerOrDefault(configuration.width, 1);
		this._height = positiveIntegerOrDefault(configuration.height, 1);
		this._viewportPixels = createViewportPixels(THREE, this._width, this._height);
		this._depthTarget = createRenderTarget(THREE, this._width, this._height, 'Algorithm32.scene-depth-rgb24');
		this._hitTarget = createRenderTarget(THREE, this._width, this._height, 'Algorithm32.scene-hit-r8');
		this._depthMaterial = createDepthMaterial({
			THREE,
			camera: this._camera,
			distanceMultiplier: this._distanceMultiplier,
			sceneDepthMaxMeters: this._sceneDepthMaxMeters,
		});
		this._hitMaterial = createHitMaterial(THREE);
	}

	/**
	 * Return the packed scene-depth texture.
	 *
	 * @returns {unknown} Return texture.
	 */
	get depthTexture() {
		return this._depthTarget.texture;
	}

	/**
	 * Return the explicit scene-hit mask texture.
	 *
	 * @returns {unknown} Return texture.
	 */
	get hitTexture() {
		return this._hitTarget.texture;
	}

	/**
	 * Return viewport dimensions as a shader uniform value.
	 *
	 * @returns {unknown} Return viewport dimensions.
	 */
	get viewportPixels() {
		return this._viewportPixels;
	}

	/**
	 * Return binding values produced by this capture helper.
	 *
	 * @returns {SceneInputCaptureBindingValues} Return runtime binding values.
	 */
	bindingValues() {
		return Object.freeze({
			'runtime.sceneDepthTexture': this.depthTexture,
			'runtime.sceneHitTexture': this.hitTexture,
			'runtime.viewportPixels': this.viewportPixels,
		});
	}

	/**
	 * Resize owned capture resources.
	 *
	 * @param {number} width - Supplies the viewport width.
	 * @param {number} height - Supplies the viewport height.
	 * @returns {void}
	 */
	setSize(width, height) {
		this._assertUsable();

		const nextWidth = positiveIntegerOrDefault(width, this._width);
		const nextHeight = positiveIntegerOrDefault(height, this._height);

		this._width = nextWidth;
		this._height = nextHeight;
		setViewportPixels(this._viewportPixels, nextWidth, nextHeight);
		resizeRenderTarget(this._depthTarget, nextWidth, nextHeight);
		resizeRenderTarget(this._hitTarget, nextWidth, nextHeight);
	}

	/**
	 * Capture scene inputs for one composer invocation.
	 *
	 * @param {unknown} renderer - Supplies the active Three renderer.
	 * @returns {void}
	 */
	render(renderer) {
		this.capture(renderer);
	}

	/**
	 * Capture scene depth and hit mask for one render frame.
	 *
	 * @param {unknown} renderer - Supplies the active Three renderer.
	 * @returns {void}
	 */
	capture(renderer) {
		this._assertUsable();

		if (!this.enabled) {
			return;
		}

		if (!renderer || typeof renderer !== 'object') {
			throw new TypeError('Scene input capture requires renderer.');
		}

		updateCameraWorldPosition(this._camera, this._depthMaterial.uniforms.uCameraWorldPosition.value);
		this._renderWithOverride(renderer, this._depthTarget, this._depthMaterial);
		this._renderWithOverride(renderer, this._hitTarget, this._hitMaterial);
		this._frameCount += 1;
	}

	/**
	 * Return capture diagnostics for runtime inspection.
	 *
	 * @returns {unknown} Return diagnostics.
	 */
	getDiagnostics() {
		return Object.freeze({
			kind: 'algorithm32-scene-input-capture-pass',
			status: this._disposed ? 'disposed' : 'ready',
			capturePolicy: 'renderer-override-material-distance-plus-hit-mask',
			sceneDepthEncoding: 'rgb24-normalized-distance-times-sceneDepthMaxMeters',
			sceneHitMaskEncoding: 'r8-explicit-hit-mask',
			sceneDepthMaxMeters: this._sceneDepthMaxMeters,
			distanceMultiplier: this._distanceMultiplier,
			viewportPixels: Object.freeze([this._width, this._height]),
			frameCount: this._frameCount,
		});
	}

	/**
	 * Dispose owned capture resources.
	 *
	 * @returns {void}
	 */
	dispose() {
		if (this._disposed) {
			return;
		}

		this._disposed = true;
		this.enabled = false;
		this._depthMaterial?.dispose?.();
		this._hitMaterial?.dispose?.();
		this._depthTarget?.dispose?.();
		this._hitTarget?.dispose?.();
	}

	/**
	 * Assert that capture resources are still usable.
	 *
	 * @returns {void}
	 */
	_assertUsable() {
		if (this._disposed) {
			throw new Error('SceneInputCapture has been disposed.');
		}
	}

	/**
	 * Render one override-material capture pass and restore renderer state.
	 *
	 * @param {unknown} renderer - Supplies the active renderer.
	 * @param {unknown} target - Supplies the render target.
	 * @param {unknown} material - Supplies the scene override material.
	 * @returns {void}
	 */
	_renderWithOverride(renderer, target, material) {
		if (typeof renderer.setRenderTarget !== 'function') {
			throw new TypeError('Scene input capture requires renderer.setRenderTarget().');
		}

		if (typeof renderer.render !== 'function') {
			throw new TypeError('Scene input capture requires renderer.render().');
		}

		const previousTarget = typeof renderer.getRenderTarget === 'function'
			? renderer.getRenderTarget()
			: null;
		const previousOverrideMaterial = this._scene.overrideMaterial;
		const previousBackground = this._scene.background;
		const previousClearState = readRendererClearState(this._THREE, renderer);

		try {
			this._scene.overrideMaterial = material;
			this._scene.background = null;
			renderer.setRenderTarget(target);
			if (typeof renderer.setClearColor === 'function') {
				renderer.setClearColor(0x000000, 0);
			}
			if (typeof renderer.clear === 'function') {
				renderer.clear(true, true, true);
			}
			renderer.render(this._scene, this._camera);
		} finally {
			this._scene.overrideMaterial = previousOverrideMaterial;
			this._scene.background = previousBackground;
			restoreRendererClearState(renderer, previousClearState);
			renderer.setRenderTarget(previousTarget);
		}
	}
}

/**
 * Create a WebGL render target for one scene input texture.
 *
 * @param {unknown} THREE - Supplies the Three namespace.
 * @param {number} width - Supplies the target width.
 * @param {number} height - Supplies the target height.
 * @param {string} name - Supplies the texture diagnostic name.
 * @returns {unknown} Return render target.
 */
function createRenderTarget(THREE, width, height, name) {
	const target = new THREE.WebGLRenderTarget(width, height, {
		depthBuffer: true,
		stencilBuffer: false,
		format: THREE.RGBAFormat,
		type: THREE.UnsignedByteType,
	});

	if (target.texture && typeof target.texture === 'object') {
		target.texture.name = name;
	}

	return target;
}

/**
 * Create the override material that packs camera distance into RGB.
 *
 * @param {object} request - Supplies capture shader configuration.
 * @param {unknown} request.THREE - Supplies the Three namespace.
 * @param {unknown} request.camera - Supplies the active camera.
 * @param {number} request.distanceMultiplier - Supplies scene unit scale.
 * @param {number} request.sceneDepthMaxMeters - Supplies the depth cap.
 * @returns {unknown} Return material.
 */
function createDepthMaterial({ THREE, camera, distanceMultiplier, sceneDepthMaxMeters }) {
	const material = new THREE.ShaderMaterial({
		uniforms: {
			uCameraWorldPosition: {
				value: createVector3(THREE, camera),
			},
			uDistanceMultiplier: {
				value: distanceMultiplier,
			},
			uSceneDepthMaxMeters: {
				value: sceneDepthMaxMeters,
			},
		},
		vertexShader: distanceVertexShader(),
		fragmentShader: distanceFragmentShader(),
	});

	material.depthTest = true;
	material.depthWrite = true;

	return material;
}

/**
 * Create the override material that writes an explicit hit mask.
 *
 * @param {unknown} THREE - Supplies the Three namespace.
 * @returns {unknown} Return material.
 */
function createHitMaterial(THREE) {
	const material = new THREE.ShaderMaterial({
		vertexShader: hitVertexShader(),
		fragmentShader: hitFragmentShader(),
	});

	material.depthTest = true;
	material.depthWrite = true;

	return material;
}

/**
 * Create the mutable viewport uniform value.
 *
 * @param {unknown} THREE - Supplies the Three namespace.
 * @param {number} width - Supplies viewport width.
 * @param {number} height - Supplies viewport height.
 * @returns {unknown} Return vec2-like value.
 */
function createViewportPixels(THREE, width, height) {
	if (typeof THREE?.Vector2 === 'function') {
		return new THREE.Vector2(width, height);
	}

	return [width, height];
}

/**
 * Update a vec2-like viewport value.
 *
 * @param {unknown} viewportPixels - Supplies the current viewport value.
 * @param {number} width - Supplies viewport width.
 * @param {number} height - Supplies viewport height.
 * @returns {void}
 */
function setViewportPixels(viewportPixels, width, height) {
	if (viewportPixels && typeof viewportPixels.set === 'function') {
		viewportPixels.set(width, height);
		return;
	}

	if (Array.isArray(viewportPixels)) {
		viewportPixels[0] = width;
		viewportPixels[1] = height;
	}
}

/**
 * Create a vector initialized to the camera world position.
 *
 * @param {unknown} THREE - Supplies the Three namespace.
 * @param {unknown} camera - Supplies the active camera.
 * @returns {unknown} Return vector.
 */
function createVector3(THREE, camera) {
	const vector = new THREE.Vector3();
	updateCameraWorldPosition(camera, vector);

	return vector;
}

/**
 * Update a vector-like value from camera world position.
 *
 * @param {unknown} camera - Supplies the active camera.
 * @param {unknown} target - Supplies the vector to mutate.
 * @returns {void}
 */
function updateCameraWorldPosition(camera, target) {
	if (typeof camera?.getWorldPosition === 'function') {
		camera.getWorldPosition(target);
		return;
	}

	if (target && typeof target.set === 'function') {
		target.set(
			finiteOrDefault(camera?.position?.x, 0),
			finiteOrDefault(camera?.position?.y, 0),
			finiteOrDefault(camera?.position?.z, 0),
		);
	}
}

/**
 * Resize one render target.
 *
 * @param {unknown} target - Supplies the render target.
 * @param {number} width - Supplies target width.
 * @param {number} height - Supplies target height.
 * @returns {void}
 */
function resizeRenderTarget(target, width, height) {
	if (typeof target?.setSize === 'function') {
		target.setSize(width, height);
		return;
	}

	target.width = width;
	target.height = height;
}

/**
 * Read renderer clear state when the renderer exposes it.
 *
 * @param {unknown} THREE - Supplies the Three namespace.
 * @param {unknown} renderer - Supplies the active renderer.
 * @returns {object | null} Return clear state or null.
 */
function readRendererClearState(THREE, renderer) {
	if (
		typeof renderer.getClearColor !== 'function'
		|| typeof renderer.getClearAlpha !== 'function'
		|| typeof THREE?.Color !== 'function'
	) {
		return null;
	}

	return {
		color: renderer.getClearColor(new THREE.Color()),
		alpha: renderer.getClearAlpha(),
	};
}

/**
 * Restore renderer clear state when it was captured.
 *
 * @param {unknown} renderer - Supplies the active renderer.
 * @param {object | null} clearState - Supplies captured state.
 * @returns {void}
 */
function restoreRendererClearState(renderer, clearState) {
	if (!clearState || typeof renderer.setClearColor !== 'function') {
		return;
	}

	renderer.setClearColor(clearState.color, clearState.alpha);
}

/**
 * Return a positive finite number or fallback.
 *
 * @param {unknown} value - Supplies the candidate value.
 * @param {number} fallback - Supplies the fallback.
 * @returns {number} Return normalized value.
 */
function positiveFiniteOrDefault(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Return a positive integer or fallback.
 *
 * @param {unknown} value - Supplies the candidate value.
 * @param {number} fallback - Supplies the fallback.
 * @returns {number} Return normalized value.
 */
function positiveIntegerOrDefault(value, fallback) {
	return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Return a finite number or fallback.
 *
 * @param {unknown} value - Supplies the candidate value.
 * @param {number} fallback - Supplies the fallback.
 * @returns {number} Return normalized value.
 */
function finiteOrDefault(value, fallback) {
	return Number.isFinite(value) ? value : fallback;
}

/**
 * Return the shared distance-capture vertex shader.
 *
 * @returns {string} Return shader source.
 */
function distanceVertexShader() {
	return `
varying vec3 vWorldPosition;

void main() {
	vec4 worldPosition = modelMatrix * vec4(position, 1.0);
	vWorldPosition = worldPosition.xyz;
	gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;
}

/**
 * Return the distance-packing fragment shader.
 *
 * @returns {string} Return shader source.
 */
function distanceFragmentShader() {
	return `
precision highp float;

uniform vec3 uCameraWorldPosition;
uniform float uDistanceMultiplier;
uniform float uSceneDepthMaxMeters;
varying vec3 vWorldPosition;

vec3 packNormalizedDistance24(float value) {
	float normalized = clamp(value, 0.0, 1.0);
	float packed = floor(normalized * 16777214.0 + 0.5);
	float red = floor(packed / 65536.0);
	packed -= red * 65536.0;
	float green = floor(packed / 256.0);
	float blue = packed - green * 256.0;
	return vec3(red, green, blue) / 255.0;
}

void main() {
	float distanceMeters = distance(vWorldPosition, uCameraWorldPosition) * uDistanceMultiplier;
	gl_FragColor = vec4(packNormalizedDistance24(distanceMeters / uSceneDepthMaxMeters), 1.0);
}
`;
}

/**
 * Return the shared hit-mask vertex shader.
 *
 * @returns {string} Return shader source.
 */
function hitVertexShader() {
	return `
void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
}

/**
 * Return the hit-mask fragment shader.
 *
 * @returns {string} Return shader source.
 */
function hitFragmentShader() {
	return `
void main() {
	gl_FragColor = vec4(1.0);
}
`;
}

export default SceneInputCapture;
