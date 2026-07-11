/**
 * Create mutable binding values for the common Algorithm32 camera uniforms.
 *
 * @param {object} THREE - Supplies the Three namespace.
 * @param {number | null} [sceneDepthMaxMeters] - Supplies an optional app
 * override for the geometry-owned scene-depth cap.
 * @returns {Record<string, unknown>} Mutable shader binding values.
 */
export function createAlgorithm32BindingValues(THREE, sceneDepthMaxMeters = null) {
	const bindings = {
		'geometry.inverseProjectionMatrix': new THREE.Matrix4(),
		'geometry.inverseViewMatrix': new THREE.Matrix4(),
		'geometry.cameraWorldPositionMeters': new THREE.Vector3(),
		'geometry.sceneTerminationMeters': 0,
	};

	if (Number.isFinite(sceneDepthMaxMeters) && sceneDepthMaxMeters > 0) {
		bindings['geometry.sceneDepthMaxMeters'] = sceneDepthMaxMeters;
	}

	return bindings;
}

/**
 * Create geometry- and light-source-owned Three objects required by Algorithm32.
 *
 * @param {object} request - Supplies config, Three, scale, and owner requests.
 * @returns {object} The created owner object packet.
 */
export function createAlgorithm32RequiredThreeObjects(request = {}) {
	const config = request.config;
	const geometry = config?.geometry;
	const lightSource = config?.lightSource;
	const metersPerSceneUnit = request.metersPerSceneUnit;
	const geometryRequest = resolveOwnerRequest(request.geometryEndpointRequest, request);
	const lightingRequest = resolveOwnerRequest(request.lightingRequest, request);
	const endpointObjects = typeof geometry?.createThreeEndpointObjects === 'function'
		? geometry.createThreeEndpointObjects({
			metersPerSceneUnit,
			...geometryRequest,
		})
		: null;
	const createLightingObjects = typeof lightSource?.addSceneLighting === 'function'
		? lightSource.addSceneLighting.bind(lightSource)
		: null;
	const lightingObjects = typeof createLightingObjects === 'function'
		? createLightingObjects({
			THREE: request.THREE,
			...lightingRequest,
		})
		: null;

	for (const object of [
		...(lightingObjects?.lights || []),
		...(lightingObjects?.sceneObjects || []),
	]) {
		if (object?.userData) {
			object.userData.algorithm32SceneInput = false;
		}
	}

	return Object.freeze({
		objects: Object.freeze([
			...(endpointObjects?.visualObjects || []),
			...(endpointObjects?.raycastObjects || []),
			...(lightingObjects?.lights || []),
			...(lightingObjects?.sceneObjects || []),
		]),
		endpointObjects,
		lightingObjects,
		metadata: Object.freeze({
			geometry: endpointObjects?.metadata ?? null,
			lighting: lightingObjects?.metadata ?? null,
		}),
	});
}

/**
 * Create the default Algorithm32 scene-color render target.
 *
 * @param {object} request - Supplies render target facts.
 * @param {object} request.THREE - Supplies the Three namespace.
 * @param {number} request.width - Supplies target width.
 * @param {number} request.height - Supplies target height.
 * @param {number} [request.type] - Supplies the texture type.
 * @param {string} [request.name] - Supplies the texture name.
 * @param {string} [request.colorSpace] - Supplies optional texture color space.
 * @returns {unknown} The created render target.
 */
export function createAlgorithm32SceneColorRenderTarget({
	THREE,
	width,
	height,
	type = THREE.UnsignedByteType,
	name = 'Algorithm32.sceneColor',
	colorSpace = null,
}) {
	const target = new THREE.WebGLRenderTarget(width, height, {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBAFormat,
		type,
		depthBuffer: true,
		stencilBuffer: false,
	});

	target.texture.name = name;

	if (colorSpace) {
		target.texture.colorSpace = colorSpace;
	}

	return target;
}

/**
 * Resolve a positive integer viewport size from R3F size state.
 *
 * @param {object | null | undefined} size - Supplies a size-like object.
 * @returns {readonly [number, number]} Viewport width and height.
 */
export function algorithm32ViewportPixels(size) {
	const width = Math.max(1, Math.floor(Number(size?.width) || 1));
	const height = Math.max(1, Math.floor(Number(size?.height) || 1));

	return Object.freeze([width, height]);
}

function resolveOwnerRequest(value, context) {
	if (typeof value === 'function') {
		return value(context) ?? {};
	}

	return value ?? {};
}
