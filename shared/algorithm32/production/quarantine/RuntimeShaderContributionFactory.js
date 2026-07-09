/**
 * Create the shared runtime shader contribution used by profile assemblies.
 */
export class RuntimeShaderContributionFactory {
	/**
	 * Create the runtime contribution for one descriptor.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the runtime contribution.
	 */
	createContribution(descriptor) {
		if (!descriptor?.runtime) {
			throw new TypeError('Runtime shader contribution requires a descriptor runtime section.');
		}

		const channelCount = descriptor.spectralBasis?.facts?.channelCount
			?? descriptor.spectralBasis?.facts?.channels?.length
			?? descriptor.spectralBasis?.facts?.wavelengths?.length
			?? 1;

		return contribution({
			id: 'runtime-three-single-camera',
			owner: 'runtime',
			descriptorFingerprint: descriptor.runtime.fingerprint,
			compatibilityTags: descriptor.runtime.compatibilityTags,
			provides: Object.freeze([
				'runtime.initialState',
				'runtime.sceneColorTexture',
				'runtime.depthTexture',
				'runtime.sceneHitTexture',
				'createInitialShaderState',
			]),
			requires: Object.freeze([]),
			textures: Object.freeze([
				texture('uSceneColorTexture', 'sampler2D', 'runtime.sceneColorTexture'),
				texture('uSceneDepthTexture', 'sampler2D', 'runtime.sceneDepthTexture'),
				texture('uSceneHitTexture', 'sampler2D', 'runtime.sceneHitTexture'),
			]),
			uniforms: Object.freeze([
				uniform('uViewportPixels', 'vec2', 'runtime.viewportPixels'),
			]),
			functions: Object.freeze([
				block('runtime-types', 'declareTypes', 0, runtimeTypesBlock(channelCount)),
				block('runtime-initial-state', 'declareHelpers', 0, runtimeInitialStateBlock()),
			]),
			bindingRequirements: Object.freeze([
				binding('runtime.scene-color-texture', 'texture', 'frame', 'runtime.sceneColorTexture', false),
				binding('runtime.depth-texture', 'texture', 'frame', 'runtime.sceneDepthTexture', false),
				binding('runtime.scene-hit-texture', 'texture', 'frame', 'runtime.sceneHitTexture', false),
				binding('runtime.viewport-pixels', 'uniform', 'config', 'runtime.viewportPixels', false),
			]),
		});
	}
}

/**
 * Create the shared runtime type/helper block.
 *
 * @param {number} channelCount - Supplies the spectral channel count.
 * @returns {string} Return GLSL source.
 */
function runtimeTypesBlock(channelCount) {
	return `const int SPECTRAL_CHANNEL_COUNT = ${channelCount};

struct SpectralValue {
	float c[${channelCount}];
};

struct ViewRay {
	vec3 originMeters;
	vec3 direction;
};

struct PathBounds {
	float startDistanceMeters;
	float endDistanceMeters;
	float endpointDistanceMeters;
	bool hasSceneEndpoint;
	bool hasGroundEndpoint;
	bool valid;
};

struct MediumSample {
	SpectralValue rayleighScattering;
	SpectralValue mieScattering;
	SpectralValue scattering;
	SpectralValue extinction;
};

struct ShaderState {
	vec2 uv;
	float sceneDepth;
	float sceneHitMask;
	ViewRay ray;
	PathBounds bounds;
	MediumSample medium;
	SpectralValue lightRadiance;
	SpectralValue incidentRadiance;
	SpectralValue pathRadiance;
	SpectralValue transmittance;
	vec3 sceneDisplayRgb;
	vec4 outputRgba;
};

SpectralValue zeroSpectral() {
	SpectralValue value;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		value.c[channelIndex] = 0.0;
	}
	return value;
}

SpectralValue oneSpectral() {
	SpectralValue value;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		value.c[channelIndex] = 1.0;
	}
	return value;
}`;
}

/**
 * Create the shared runtime initial-state helper block.
 *
 * @returns {string} Return GLSL source.
 */
function runtimeInitialStateBlock() {
	return `ShaderState createInitialShaderState(vec2 uv) {
	ShaderState state;
	state.uv = uv;
	vec4 sceneDepthSample = texture(uSceneDepthTexture, uv);
	vec4 sceneHitSample = texture(uSceneHitTexture, uv);
	vec3 depthBytes = floor(sceneDepthSample.rgb * 255.0 + 0.5);
	state.sceneDepth = dot(depthBytes, vec3(65536.0, 256.0, 1.0)) / 16777214.0;
	state.sceneHitMask = sceneHitSample.r > 0.5 ? 1.0 : 0.0;
	state.ray = ViewRay(vec3(0.0), vec3(0.0, 0.0, 1.0));
	state.bounds = PathBounds(0.0, 0.0, 0.0, false, false, true);
	state.medium = MediumSample(zeroSpectral(), zeroSpectral(), zeroSpectral(), zeroSpectral());
	state.lightRadiance = zeroSpectral();
	state.incidentRadiance = zeroSpectral();
	state.pathRadiance = zeroSpectral();
	state.transmittance = oneSpectral();
	state.sceneDisplayRgb = texture(uSceneColorTexture, uv).rgb;
	state.outputRgba = vec4(state.sceneDisplayRgb, 1.0);
	return state;
}`;
}

/**
 * Create one contribution.
 *
 * @param {Partial<ShaderContribution>} fields - Supplies contribution fields.
 * @returns {ShaderContribution} Return contribution.
 */
function contribution(fields) {
	return Object.freeze({
		defines: Object.freeze([]),
		uniforms: Object.freeze([]),
		textures: Object.freeze([]),
		functions: Object.freeze([]),
		mainHooks: Object.freeze([]),
		bindingRequirements: Object.freeze([]),
		diagnostics: null,
		...fields,
	});
}

/**
 * Create one uniform descriptor.
 *
 * @param {string} name - Supplies the GLSL name.
 * @param {string} type - Supplies the GLSL type.
 * @param {string} valueKey - Supplies the runtime value key.
 * @returns {ShaderUniformDescriptor} Return descriptor.
 */
function uniform(name, type, valueKey) {
	return Object.freeze({
		name,
		type,
		valueKey,
	});
}

/**
 * Create one texture descriptor.
 *
 * @param {string} name - Supplies the GLSL name.
 * @param {string} type - Supplies the GLSL sampler type.
 * @param {string} valueKey - Supplies the runtime value key.
 * @returns {ShaderTextureDescriptor} Return descriptor.
 */
function texture(name, type, valueKey) {
	return Object.freeze({
		name,
		type,
		valueKey,
	});
}

/**
 * Create one source block.
 *
 * @param {string} id - Supplies the block id.
 * @param {ShaderSourceSlot} slot - Supplies the assembly slot.
 * @param {number} order - Supplies the slot-local order.
 * @param {string} code - Supplies GLSL source.
 * @returns {ShaderSourceBlock} Return source block.
 */
function block(id, slot, order, code) {
	return Object.freeze({
		id,
		slot,
		order,
		code,
	});
}

/**
 * Create one binding requirement.
 *
 * @param {string} id - Supplies the binding id.
 * @param {ShaderBindingKind} kind - Supplies the binding kind.
 * @param {ShaderUpdateFrequency} updateFrequency - Supplies the update cadence.
 * @param {string} valueKey - Supplies the runtime value key.
 * @param {boolean} required - Supplies whether setup requires the value.
 * @returns {ShaderBindingRequirement} Return binding requirement.
 */
function binding(id, kind, updateFrequency, valueKey, required) {
	return Object.freeze({
		id,
		owner: 'runtime',
		kind,
		updateFrequency,
		valueKey,
		required,
	});
}

export default RuntimeShaderContributionFactory;
