import { Algorithm32ShaderAssembler } from '../shader/Algorithm32ShaderAssembler.js';
import { ShaderDescriptorBuilder } from '../shader/ShaderDescriptorBuilder.js';
import { Algorithm32Transport } from '../transport/Algorithm32Transport.js';
import SpectralCalculator from './SpectralCalculator.js';
import buildIncidentRadianceCache from './buildIncidentRadianceCache.js';
import { SceneInputCapture } from './SceneInputCapture.js';
import { ShaderResourceBuilder } from './ShaderResourceBuilder.js';
import { ShaderRuntimePass } from './ShaderRuntimePass.js';

/**
 * Build Algorithm32 runtime shader artifacts from the configured shared model.
 */
export class ShaderBuilder {
	/**
	 * Store the facade-owned shared model consumed by shader builds.
	 *
	 * @type {SharedModel}
	 */
	_model;

	/**
	 * Store the generic shader assembler.
	 *
	 * @type {ShaderAssembler}
	 */
	_assembler;

	/**
	 * Store the shader descriptor builder.
	 *
	 * @type {ShaderDescriptorBuilder}
	 */
	_descriptorBuilder;

	/**
	 * Store the core transport implementation.
	 *
	 * @type {Algorithm32Transport}
	 */
	_transport;

	/**
	 * Store the runtime resource builder.
	 *
	 * @type {ShaderResourceBuilder}
	 */
	_resourceBuilder;

	/**
	 * Store the last accepted config snapshot.
	 *
	 * @type {ConfigSnapshot | undefined}
	 */
	_lastConfig;

	/**
	 * Track whether this builder has been disposed.
	 *
	 * @type {boolean}
	 */
	_disposed = false;

	/**
	 * Create a runtime shader builder.
	 *
	 * @param {ShaderBuilderDependencies} dependencies - Supplies the shared
	 * model and implementation services used to build shader artifacts.
	 */
	constructor(dependencies) {
		if (!dependencies || typeof dependencies !== 'object') {
			throw new TypeError('ShaderBuilder dependencies are required.');
		}

		if (!dependencies.model) {
			throw new TypeError('ShaderBuilder requires a shared model.');
		}

		this._model = dependencies.model;
		this._assembler = dependencies.assembler ?? new Algorithm32ShaderAssembler();
		this._descriptorBuilder = dependencies.descriptorBuilder ?? new ShaderDescriptorBuilder();
		this._transport = dependencies.transport ?? new Algorithm32Transport();
		this._resourceBuilder = dependencies.resourceBuilder ?? new ShaderResourceBuilder();
	}

	/**
	 * Return the shared model consumed by shader builds.
	 *
	 * @returns {SharedModel} The shared model.
	 */
	get model() {
		return this._model;
	}

	/**
	 * Build the runtime shader artifacts needed by the facade to attach
	 * Algorithm32 to a Three composer. The returned packet contains the
	 * shader-facing resources, binding description, and lifecycle hooks needed
	 * by the facade or shader handle.
	 *
	 * @param {ShaderBuildRequest} request - Supplies the accepted shader build
	 * request.
	 * @returns {Promise<ShaderBuildResult>} The built runtime shader artifact
	 * packet.
	 */
	async build(request) {
		this._assertUsable();
		this._assertBuildRequest(request);

		const buildContext = this._createBuildContext(request);
		const assembly = this._assembleIfRequested(request, buildContext);
		const runtime = assembly ? this._installRuntimeIfPossible(request, assembly, buildContext) : null;
		const result = {
			modelVersion: this.model.version,
			setup: request.setup,
			diagnostics: Object.freeze({
				status: runtime ? 'installed' : assembly ? 'assembled' : 'deferred',
			}),
		};

		if (assembly) {
			result.assembly = assembly;
			result.bindingRequirements = assembly.bindingRequirements;
		}

		if (buildContext.cacheBuild) {
			result.cacheBuild = buildContext.cacheBuild;
		}

		if (runtime) {
			result.runtime = runtime;
		}

		return Object.freeze(result);
	}

	/**
	 * Refresh builder state for a new accepted facade configuration.
	 *
	 * @param {ConfigSnapshot} config - Supplies the accepted configuration
	 * snapshot.
	 * @returns {void}
	 */
	refreshConfig(config) {
		this._assertUsable();
		this._lastConfig = config;
	}

	/**
	 * Dispose resources owned by the runtime shader builder.
	 *
	 * @returns {void}
	 */
	dispose() {
		this._disposed = true;
	}

	/**
	 * Assert that this builder can still be used.
	 *
	 * @returns {void}
	 */
	_assertUsable() {
		if (this._disposed) {
			throw new Error('ShaderBuilder has been disposed.');
		}
	}

	/**
	 * Assert that a shader build request has the required setup-time
	 * attachment handles.
	 *
	 * @param {ShaderBuildRequest} request - Supplies the candidate build
	 * request.
	 * @returns {void}
	 */
	_assertBuildRequest(request) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Shader build request is required.');
		}

		const { setup } = request;

		if (!setup || typeof setup !== 'object') {
			throw new TypeError('Shader setup request is required.');
		}

		for (const fieldName of ['composer', 'scene', 'camera']) {
			if (!setup[fieldName]) {
				throw new TypeError(`Shader setup request requires ${fieldName}.`);
			}
		}
	}

	/**
	 * Assemble shader source when the request includes assembly inputs.
	 *
	 * @param {ShaderBuildRequest} request - Supplies the candidate request.
	 * @returns {ShaderAssemblyResult | null} Return assembled source or null.
	 */
	_assembleIfRequested(request, buildContext = EMPTY_BUILD_CONTEXT) {
		const shouldAssemble = this._hasAssemblyInputs(request) || buildContext.automaticAssembly;

		if (!shouldAssemble) {
			return null;
		}

		const color = request.config?.config?.color ?? null;
		const descriptor = request.descriptor ?? this._descriptorBuilder.build({
			model: this.model,
			config: request.config,
			color,
			cacheDescriptor: buildContext.cacheBuild?.cache.descriptor,
		});

		const contributions = this._collectContributions(request, descriptor, buildContext);

		return this._assembler.assemble({
			descriptor,
			contributions,
			mainRequiredSymbols: request.mainRequiredSymbols
				?? buildContext.mainRequiredSymbols
				?? [],
			systemProvidedSymbols: request.systemProvidedSymbols ?? [],
		});
	}

	/**
	 * Create setup-time cache and contribution context for automatic assembly.
	 *
	 * @param {ShaderBuildRequest} request - Supplies the build request.
	 * @returns {ShaderBuildContext} Return the setup build context.
	 */
	_createBuildContext(request) {
		if (this._hasAssemblyInputs(request) || !this._canAssembleFromConfiguredModel()) {
			return EMPTY_BUILD_CONTEXT;
		}

		const cacheBuild = this._buildSourceCreatedIncidentRadianceCache(request);
		const texturePayloads = this._createCacheTexturePayloads(cacheBuild.cache);

		return Object.freeze({
			automaticAssembly: true,
			cacheBuild,
			cache: cacheBuild.cache,
			texturePayloads,
			mainRequiredSymbols: this._transport.mainRequiredShaderSymbols(),
		});
	}

	/**
	 * Check whether the request already supplies low-level assembly inputs.
	 *
	 * @param {ShaderBuildRequest} request - Supplies the build request.
	 * @returns {boolean} True when low-level assembly inputs are present.
	 */
	_hasAssemblyInputs(request) {
		return Boolean(
			request.descriptor
			|| request.contributions
			|| request.mainRequiredSymbols
			|| request.systemProvidedSymbols,
		);
	}

	/**
	 * Check whether the configured model can provide a complete shader path.
	 *
	 * @returns {boolean} True when automatic setup assembly is supported.
	 */
	_canAssembleFromConfiguredModel() {
		return Boolean(
			typeof this.model.geometry?.createShaderContribution === 'function'
			&& typeof this.model.atmosphere?.createShaderContribution === 'function'
			&& typeof this.model.lightSource?.createShaderContribution === 'function'
			&& typeof this.model.lightSource?.createIncidentRadianceCache === 'function'
			&& typeof this._transport?.createShaderContribution === 'function'
			&& typeof this._transport?.mainRequiredShaderSymbols === 'function',
		);
	}

	/**
	 * Build the source-created incident-radiance cache for shader setup.
	 *
	 * @param {ShaderBuildRequest} request - Supplies the build request.
	 * @returns {CacheBuildResult} Return the built cache packet.
	 */
	_buildSourceCreatedIncidentRadianceCache(request) {
		const snapshot = this.model.snapshot();
		const geometryFacts = snapshot.geometry ?? {};
		const execution = request.config?.config?.execution ?? {};
		const cache = this.model.lightSource.createIncidentRadianceCache({
			geometry: this.model.geometry,
			atmosphere: this.model.atmosphere,
			lightSource: this.model.lightSource,
			spectralBasis: this.model.spectral?.basis ?? snapshot.spectral,
			geometryDescriptor: geometryFacts,
			bottomRadiusMeters: geometryFacts.bottomRadiusMeters,
			topRadiusMeters: geometryFacts.topRadiusMeters,
			boundaryAltitudeMeters: geometryFacts.cacheBoundaryAltitudeMeters,
			execution,
		});
		const calculator = new SpectralCalculator({
			geometry: this.model.geometry,
			atmosphere: this.model.atmosphere,
			lightSource: this.model.lightSource,
			spectralBasis: this.model.spectral?.basis ?? snapshot.spectral,
			executionControls: execution,
		});

		return buildIncidentRadianceCache({
			cache,
			geometry: this.model.geometry,
			atmosphere: this.model.atmosphere,
			lightSource: this.model.lightSource,
			calculator,
			pathIntervalCount: execution.cachePathIntervalCount ?? execution.pathIntervalCount,
			sourceTransmittanceIntervalCount: execution.sourceTransmittanceIntervalCount,
		});
	}

	/**
	 * Create texture payload map from a built cache.
	 *
	 * @param {IncidentRadianceCache} cache - Supplies the built cache.
	 * @returns {Record<string, CacheShaderPayloadDescriptor>} Return payloads by binding value key.
	 */
	_createCacheTexturePayloads(cache) {
		if (typeof cache?.createShaderPayload !== 'function') {
			throw new TypeError('Source-created shader cache must expose createShaderPayload().');
		}

		const payload = cache.createShaderPayload();

		return Object.freeze({
			[cacheTextureValueKey(payload)]: payload,
		});
	}

	/**
	 * Collect explicit and owner-provided shader contributions.
	 *
	 * @param {ShaderBuildRequest} request - Supplies the build request.
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the descriptor.
	 * @param {ShaderBuildContext} [buildContext] - Supplies automatic setup context.
	 * @returns {readonly ShaderContribution[]} Return collected contributions.
	 */
	_collectContributions(request, descriptor, buildContext = EMPTY_BUILD_CONTEXT) {
		const contributions = [...(request.contributions ?? [])];
		const providerRequest = Object.freeze({
			descriptor,
			config: request.config,
			setup: request.setup,
			model: this.model,
			cacheBuild: buildContext.cacheBuild ?? null,
			cache: buildContext.cache ?? null,
			texturePayloads: this._mergeTexturePayloads(request, buildContext),
		});
		const providers = [
			this.model.geometry,
			this.model.atmosphere,
			this.model.lightSource,
			buildContext.cache,
			buildContext.automaticAssembly ? this._transport : null,
			request.config?.config?.color,
		];

		for (const provider of providers) {
			if (typeof provider?.createShaderContribution !== 'function') {
				continue;
			}

			const provided = provider.createShaderContribution(providerRequest);
			const providedList = Array.isArray(provided) ? provided : [provided];

			for (const contribution of providedList) {
				if (!contribution || typeof contribution !== 'object') {
					throw new TypeError('Shader contribution provider returned an invalid contribution.');
				}

				contributions.push(contribution);
			}
		}

		const mainRequiredSymbols = request.mainRequiredSymbols
			?? buildContext.mainRequiredSymbols
			?? [];

		if (this._shouldAddRuntimeContribution(mainRequiredSymbols, contributions)) {
			contributions.unshift(this._createRuntimeShaderContribution(descriptor));
		}

		return Object.freeze(contributions);
	}

	/**
	 * Check whether the generic runtime initial-state contribution is needed.
	 *
	 * @param {readonly string[]} mainRequiredSymbols - Supplies the active main symbol set.
	 * @param {readonly ShaderContribution[]} contributions - Supplies collected contributions.
	 * @returns {boolean} Return true when runtime contribution should be added.
	 */
	_shouldAddRuntimeContribution(mainRequiredSymbols, contributions) {
		const providesRuntime = contributions.some((contribution) =>
			(contribution.provides ?? []).includes('runtime.initialState')
			|| (contribution.provides ?? []).includes('createInitialShaderState'));
		const needsRuntime = mainRequiredSymbols.includes('runtime.initialState')
			|| contributions.some((contribution) => (contribution.requires ?? []).includes('runtime.initialState'));

		return needsRuntime && !providesRuntime;
	}

	/**
	 * Create the shared runtime shader contribution used by assembled setups.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the runtime contribution.
	 */
	_createRuntimeShaderContribution(descriptor) {
		if (!descriptor?.runtime) {
			throw new TypeError('Runtime shader contribution requires a descriptor runtime section.');
		}

		const channelCount = descriptor.spectralBasis?.facts?.channelCount
			?? descriptor.spectralBasis?.facts?.channels?.length
			?? descriptor.spectralBasis?.facts?.wavelengths?.length
			?? 1;

		return runtimeContribution({
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
				runtimeTexture('uSceneColorTexture', 'sampler2D', 'runtime.sceneColorTexture'),
				runtimeTexture('uSceneDepthTexture', 'sampler2D', 'runtime.sceneDepthTexture'),
				runtimeTexture('uSceneHitTexture', 'sampler2D', 'runtime.sceneHitTexture'),
			]),
			uniforms: Object.freeze([
				runtimeUniform('uViewportPixels', 'vec2', 'runtime.viewportPixels'),
			]),
			functions: Object.freeze([
				runtimeBlock('runtime-types', 'declareTypes', 0, runtimeTypesBlock(channelCount)),
				runtimeBlock('runtime-initial-state', 'declareHelpers', 0, runtimeInitialStateBlock()),
			]),
			bindingRequirements: Object.freeze([
				runtimeBinding('runtime.scene-color-texture', 'texture', 'frame', 'runtime.sceneColorTexture', false),
				runtimeBinding('runtime.depth-texture', 'texture', 'frame', 'runtime.sceneDepthTexture', true),
				runtimeBinding('runtime.scene-hit-texture', 'texture', 'frame', 'runtime.sceneHitTexture', true),
				runtimeBinding('runtime.viewport-pixels', 'uniform', 'config', 'runtime.viewportPixels', true),
			]),
		});
	}

	/**
	 * Install a runtime pass when the setup names a composer pass surface.
	 *
	 * @param {ShaderBuildRequest} request - Supplies the build request.
	 * @param {ShaderAssemblyResult} assembly - Supplies accepted shader source.
	 * @param {ShaderBuildContext} [buildContext] - Supplies automatic setup context.
	 * @returns {ShaderRuntimeArtifact | null} Return installed runtime state.
	 */
	_installRuntimeIfPossible(request, assembly, buildContext = EMPTY_BUILD_CONTEXT) {
		const { composer, THREE } = request.setup;

		if (typeof composer.addPass !== 'function') {
			return null;
		}

		if (!THREE) {
			throw new TypeError('Shader setup requires THREE when installing a composer pass.');
		}

		const texturePayloads = this._mergeTexturePayloads(request, buildContext);
		this._assertCachePayloadsMatchDescriptor({
			descriptor: assembly.descriptor,
			texturePayloads,
		});
		const resources = this._prepareResources(request, buildContext, texturePayloads);
		let sceneInputCapture = null;
		let pass = null;
		let sceneInputCaptureInstalled = false;
		let passInstalled = false;

		try {
			const preparedBindingValues = {
				...(request.bindingValues ?? {}),
				...resources.bindingValues,
			};
			const runtimeSceneInputs = this._createRuntimeSceneInputBindings({
				request,
				assembly,
				bindingValues: preparedBindingValues,
			});
			sceneInputCapture = runtimeSceneInputs.sceneInputCapture;
			const bindingValues = {
				...preparedBindingValues,
				...runtimeSceneInputs.bindingValues,
			};
			this._assertRequiredBindingsAvailable({
				assembly,
				bindingValues,
			});
			const uniforms = this._createUniforms({
				assembly,
				bindingValues,
			});
			pass = new ShaderRuntimePass({
				THREE,
				fragmentShaderSource: assembly.fragmentShaderSource,
				sourceHash: assembly.sourceHash,
				uniforms,
				sceneInputCapture,
				logger: request.setup.logger ?? null,
				performanceCallback: request.setup.performanceCallback,
				performanceSampleIntervalFrames: request.setup.performanceSampleIntervalFrames,
				performanceMaxPendingQueries: request.setup.performanceMaxPendingQueries,
			});

			if (sceneInputCapture) {
				composer.addPass(sceneInputCapture);
				sceneInputCaptureInstalled = true;
			}

			composer.addPass(pass);
			passInstalled = true;

			return Object.freeze({
				pass,
				uniforms,
				material: pass.material,
				sceneInputCapture,
				resources: resources.resources,
				dispose: () => {
					removeComposerPass(composer, pass);
					pass.dispose();
					if (sceneInputCapture) {
						removeComposerPass(composer, sceneInputCapture);
						sceneInputCapture.dispose();
					}
					resources.dispose();
				},
				getDiagnostics: () => pass.getDiagnostics(),
			});
		} catch (error) {
			if (passInstalled && pass) {
				removeComposerPass(composer, pass);
			}

			if (sceneInputCaptureInstalled && sceneInputCapture) {
				removeComposerPass(composer, sceneInputCapture);
			}

			pass?.dispose?.();
			sceneInputCapture?.dispose?.();
			resources.dispose();
			throw error;
		}
	}

	/**
	 * Create renderer-produced scene input bindings needed by the runtime shader.
	 *
	 * @param {object} request - Supplies assembly and setup state.
	 * @param {ShaderBuildRequest} request.request - Supplies the build request.
	 * @param {ShaderAssemblyResult} request.assembly - Supplies accepted shader source.
	 * @param {Record<string, unknown>} request.bindingValues - Supplies known binding values.
	 * @returns {{ readonly sceneInputCapture: SceneInputCapture | null, readonly bindingValues: Record<string, unknown> }} Return scene input bindings.
	 */
	_createRuntimeSceneInputBindings({ request, assembly, bindingValues }) {
		const bindingPatch = {};
		const needsDepthTexture = assemblyUsesValueKey(assembly, 'runtime.sceneDepthTexture');
		const needsHitTexture = assemblyUsesValueKey(assembly, 'runtime.sceneHitTexture');
		const needsViewportPixels = assemblyUsesValueKey(assembly, 'runtime.viewportPixels');
		const needsSceneDepthMaxMeters = assemblyUsesValueKey(assembly, 'geometry.sceneDepthMaxMeters');
		const missingDepthTexture = needsDepthTexture
			&& !hasAvailableBindingValue(bindingValues, 'runtime.sceneDepthTexture');
		const missingHitTexture = needsHitTexture
			&& !hasAvailableBindingValue(bindingValues, 'runtime.sceneHitTexture');
		const missingViewportPixels = needsViewportPixels
			&& !hasAvailableBindingValue(bindingValues, 'runtime.viewportPixels');
		const missingSceneDepthMaxMeters = needsSceneDepthMaxMeters
			&& !hasAvailableBindingValue(bindingValues, 'geometry.sceneDepthMaxMeters');
		let captureConfig = null;
		let sceneInputCapture = null;

		if (missingDepthTexture || missingHitTexture) {
			captureConfig = runtimeSceneInputCaptureConfig(request, this.model.geometry);

			sceneInputCapture = new SceneInputCapture({
				THREE: request.setup.THREE,
				scene: request.setup.scene,
				camera: request.setup.camera,
				performanceCallback: request.setup.performanceCallback,
				performanceSampleIntervalFrames: request.setup.performanceSampleIntervalFrames,
				performanceMaxPendingQueries: request.setup.performanceMaxPendingQueries,
				...captureConfig,
			});
			const captureValues = sceneInputCapture.bindingValues();

			if (missingDepthTexture) {
				bindingPatch['runtime.sceneDepthTexture'] = captureValues['runtime.sceneDepthTexture'];
			}

			if (missingHitTexture) {
				bindingPatch['runtime.sceneHitTexture'] = captureValues['runtime.sceneHitTexture'];
			}

			if (missingViewportPixels) {
				bindingPatch['runtime.viewportPixels'] = captureValues['runtime.viewportPixels'];
			}
		} else if (missingViewportPixels) {
			bindingPatch['runtime.viewportPixels'] = createViewportPixelsBindingValue(request.setup);
		}

		if (missingSceneDepthMaxMeters) {
			if (!captureConfig) {
				captureConfig = runtimeSceneInputCaptureConfig(request, this.model.geometry);
			}
			bindingPatch['geometry.sceneDepthMaxMeters'] = captureConfig.sceneDepthMaxMeters;
		}

		return Object.freeze({
			sceneInputCapture,
			bindingValues: Object.freeze(bindingPatch),
		});
	}

	/**
	 * Prepare runtime resources requested by the build.
	 *
	 * @param {ShaderBuildRequest} request - Supplies the build request.
	 * @param {ShaderBuildContext} [buildContext] - Supplies automatic setup context.
	 * @param {Record<string, CacheShaderPayloadDescriptor | CacheShaderTexturePayload>} [texturePayloads] - Supplies premerged payloads.
	 * @returns {ShaderResourceBuildResult} Return prepared resources.
	 */
	_prepareResources(request, buildContext = EMPTY_BUILD_CONTEXT, texturePayloads = null) {
		const mergedTexturePayloads = texturePayloads ?? this._mergeTexturePayloads(request, buildContext);
		const entries = Object.entries(mergedTexturePayloads);
		const resources = [];
		const bindingValues = {};

		if (entries.length === 0) {
			return Object.freeze({
				resources: Object.freeze(resources),
				bindingValues: Object.freeze(bindingValues),
				dispose: () => {},
			});
		}

		for (const [valueKey, payload] of entries) {
			const resource = this._resourceBuilder.createCacheTexture({
				THREE: request.setup.THREE,
				valueKey,
				payload,
			});

			resources.push(resource);
			bindingValues[valueKey] = resource.texture;
		}

		return Object.freeze({
			resources: Object.freeze(resources),
			bindingValues: Object.freeze(bindingValues),
			dispose: () => {
				for (const resource of resources) {
					resource.dispose();
				}
			},
		});
	}

	/**
	 * Assert that all required shader bindings have setup values.
	 *
	 * @param {object} request - Supplies the accepted assembly and values.
	 * @param {ShaderAssemblyResult} request.assembly - Supplies shader binding requirements.
	 * @param {Record<string, unknown>} request.bindingValues - Supplies prepared binding values.
	 * @returns {void}
	 */
	_assertRequiredBindingsAvailable({ assembly, bindingValues }) {
		for (const binding of assembly.bindingRequirements ?? []) {
			if (!binding.required) {
				continue;
			}

			if (hasAvailableBindingValue(bindingValues, binding.valueKey)) {
				continue;
			}

			if (binding.kind === 'uniform' && hasAvailableUniformDefault(assembly.contributions, binding.valueKey)) {
				continue;
			}

			throw new TypeError(`Required shader binding ${binding.id} (${binding.valueKey}) is missing.`);
		}
	}

	/**
	 * Assert that cache-owned descriptor facts match supplied cache payloads.
	 *
	 * @param {object} request - Supplies descriptor and payloads.
	 * @param {Algorithm32ShaderDescriptor} request.descriptor - Supplies the active descriptor.
	 * @param {Record<string, CacheShaderPayloadDescriptor | CacheShaderTexturePayload>} request.texturePayloads - Supplies texture payloads.
	 * @returns {void}
	 */
	_assertCachePayloadsMatchDescriptor({ descriptor, texturePayloads }) {
		const cacheFacts = descriptor?.cache?.facts ?? {};

		if (!hasCachePayloadFacts(cacheFacts)) {
			return;
		}

		for (const [valueKey, payloadDescriptor] of Object.entries(texturePayloads ?? {})) {
			if (!shouldValidateCachePayload(cacheFacts, valueKey, payloadDescriptor)) {
				continue;
			}

			assertCachePayloadDescriptorMatches(cacheFacts, payloadDescriptor, valueKey);
		}
	}

	/**
	 * Create runtime uniforms from contribution declarations.
	 *
	 * @param {object} request - Supplies assembly and binding values.
	 * @param {ShaderAssemblyResult} request.assembly - Supplies the accepted assembly.
	 * @param {Record<string, unknown>} request.bindingValues - Supplies initial values.
	 * @returns {Record<string, { value: unknown }>} Return runtime uniforms.
	 */
	_createUniforms({ assembly, bindingValues }) {
		const uniforms = {};

		for (const contribution of assembly.contributions) {
			for (const uniform of contribution.uniforms ?? []) {
				uniforms[uniform.name] = {
					value: resolveBindingValue(bindingValues, uniform),
				};
			}

			for (const texture of contribution.textures ?? []) {
				uniforms[texture.name] = {
					value: Object.hasOwn(bindingValues, texture.valueKey)
						? bindingValues[texture.valueKey]
						: null,
				};
			}
		}

		return uniforms;
	}

	/**
	 * Merge caller-provided payloads with setup-created cache payloads.
	 *
	 * @param {ShaderBuildRequest} request - Supplies the build request.
	 * @param {ShaderBuildContext} buildContext - Supplies automatic setup context.
	 * @returns {Record<string, CacheShaderPayloadDescriptor | CacheShaderTexturePayload>} Return texture payloads.
	 */
	_mergeTexturePayloads(request, buildContext) {
		return Object.freeze({
			...(buildContext.texturePayloads ?? {}),
			...(request.texturePayloads ?? {}),
		});
	}
}

const EMPTY_BUILD_CONTEXT = Object.freeze({
	automaticAssembly: false,
	cacheBuild: null,
	cache: null,
	texturePayloads: Object.freeze({}),
	mainRequiredSymbols: null,
});

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
	ivec2 sceneInputPixel = clamp(ivec2(floor(uv * uViewportPixels)), ivec2(0), ivec2(uViewportPixels) - ivec2(1));
	vec4 sceneDepthSample = texelFetch(uSceneDepthTexture, sceneInputPixel, 0);
	vec4 sceneHitSample = texelFetch(uSceneHitTexture, sceneInputPixel, 0);
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
	state.sceneDisplayRgb = texelFetch(uSceneColorTexture, sceneInputPixel, 0).rgb;
	state.outputRgba = vec4(state.sceneDisplayRgb, 1.0);
	return state;
}`;
}

/**
 * Create one runtime contribution.
 *
 * @param {Partial<ShaderContribution>} fields - Supplies contribution fields.
 * @returns {ShaderContribution} Return contribution.
 */
function runtimeContribution(fields) {
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
 * Create one runtime uniform descriptor.
 *
 * @param {string} name - Supplies the GLSL name.
 * @param {string} type - Supplies the GLSL type.
 * @param {string} valueKey - Supplies the runtime value key.
 * @returns {ShaderUniformDescriptor} Return descriptor.
 */
function runtimeUniform(name, type, valueKey) {
	return Object.freeze({
		name,
		type,
		valueKey,
	});
}

/**
 * Create one runtime texture descriptor.
 *
 * @param {string} name - Supplies the GLSL name.
 * @param {string} type - Supplies the GLSL sampler type.
 * @param {string} valueKey - Supplies the runtime value key.
 * @returns {ShaderTextureDescriptor} Return descriptor.
 */
function runtimeTexture(name, type, valueKey) {
	return Object.freeze({
		name,
		type,
		valueKey,
	});
}

/**
 * Create one runtime source block.
 *
 * @param {string} id - Supplies the block id.
 * @param {ShaderSourceSlot} slot - Supplies the assembly slot.
 * @param {number} order - Supplies the slot-local order.
 * @param {string} code - Supplies GLSL source.
 * @returns {ShaderSourceBlock} Return source block.
 */
function runtimeBlock(id, slot, order, code) {
	return Object.freeze({
		id,
		slot,
		order,
		code,
	});
}

/**
 * Create one runtime binding requirement.
 *
 * @param {string} id - Supplies the binding id.
 * @param {ShaderBindingKind} kind - Supplies the binding kind.
 * @param {ShaderUpdateFrequency} updateFrequency - Supplies the update cadence.
 * @param {string} valueKey - Supplies the runtime value key.
 * @param {boolean} required - Supplies whether setup requires the value.
 * @returns {ShaderBindingRequirement} Return binding requirement.
 */
function runtimeBinding(id, kind, updateFrequency, valueKey, required) {
	return Object.freeze({
		id,
		owner: 'runtime',
		kind,
		updateFrequency,
		valueKey,
		required,
	});
}

/**
 * Remove a pass from a composer when the composer exposes a removable surface.
 *
 * @param {unknown} composer - Supplies the composer.
 * @param {unknown} pass - Supplies the pass.
 * @returns {void}
 */
function removeComposerPass(composer, pass) {
	if (typeof composer?.removePass === 'function') {
		composer.removePass(pass);
		return;
	}

	if (Array.isArray(composer?.passes)) {
		const index = composer.passes.indexOf(pass);

		if (index !== -1) {
			composer.passes.splice(index, 1);
		}
	}
}

/**
 * Resolve a uniform value from setup-provided values or an owner default.
 *
 * @param {Record<string, unknown>} bindingValues - Supplies setup binding values.
 * @param {ShaderUniformDescriptor} uniform - Supplies uniform metadata.
 * @returns {unknown} Return the resolved uniform value.
 */
function resolveBindingValue(bindingValues, uniform) {
	if (Object.hasOwn(bindingValues, uniform.valueKey)) {
		return bindingValues[uniform.valueKey];
	}

	if (Object.hasOwn(uniform, 'defaultValue')) {
		return uniform.defaultValue;
	}

	return null;
}

/**
 * Check whether a prepared binding value is usable for a required binding.
 *
 * @param {Record<string, unknown>} bindingValues - Supplies prepared values.
 * @param {string} valueKey - Supplies the runtime binding key.
 * @returns {boolean} True when the key has a non-nullish value.
 */
function hasAvailableBindingValue(bindingValues, valueKey) {
	return Object.hasOwn(bindingValues, valueKey)
		&& bindingValues[valueKey] !== null
		&& bindingValues[valueKey] !== undefined;
}

/**
 * Check whether the accepted assembly references one binding value key.
 *
 * @param {ShaderAssemblyResult} assembly - Supplies accepted shader assembly.
 * @param {string} valueKey - Supplies the binding value key.
 * @returns {boolean} True when assembly references the value key.
 */
function assemblyUsesValueKey(assembly, valueKey) {
	for (const binding of assembly.bindingRequirements ?? []) {
		if (binding.valueKey === valueKey) {
			return true;
		}
	}

	for (const contribution of assembly.contributions ?? []) {
		for (const uniform of contribution.uniforms ?? []) {
			if (uniform.valueKey === valueKey) {
				return true;
			}
		}

		for (const texture of contribution.textures ?? []) {
			if (texture.valueKey === valueKey) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Create scene-input capture configuration from setup and facade config.
 *
 * @param {ShaderBuildRequest} request - Supplies the build request.
 * @returns {object} Return normalized capture config.
 */
function runtimeSceneInputCaptureConfig(request, geometry) {
	const [width, height] = initialViewportPixels(request.setup);
	const shaderConfig = request.config?.config?.shader ?? {};
	const setup = request.setup;
	const distanceMultiplier = positiveFiniteOrDefault(
		setup.distanceMultiplier
			?? setup.metersPerSceneUnit
			?? shaderConfig.distanceMultiplier
			?? shaderConfig.metersPerSceneUnit,
		1,
	);

	return {
		width,
		height,
		sceneDepthMaxMeters: positiveFiniteOrDefault(
			setup.sceneDepthMaxMeters
				?? shaderConfig.sceneDepthMaxMeters
				?? geometrySceneDepthMaxMeters(geometry, setup, distanceMultiplier),
			100000,
		),
		distanceMultiplier,
	};
}

/**
 * Resolve geometry-owned scene-depth cap fallback.
 *
 * @param {GeometryModel | undefined} geometry - Supplies configured geometry.
 * @param {ShaderSetupRequest} setup - Supplies setup-time runtime facts.
 * @param {number} distanceMultiplier - Supplies scene units to meters scale.
 * @returns {number | null} Geometry-owned cap or null.
 */
function geometrySceneDepthMaxMeters(geometry, setup, distanceMultiplier) {
	if (typeof geometry?.resolveSceneDepthMaxMeters !== 'function') {
		return null;
	}

	const cameraPositionSceneUnits = setup.camera?.position
		? Object.freeze([
			setup.camera.position.x,
			setup.camera.position.y,
			setup.camera.position.z,
		])
		: null;
	const value = geometry.resolveSceneDepthMaxMeters({
		camera: setup.camera,
		cameraPositionSceneUnits,
		metersPerSceneUnit: distanceMultiplier,
		distanceMultiplier,
	});

	return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Create a runtime viewport binding value when no capture is needed.
 *
 * @param {ShaderSetupRequest} setup - Supplies runtime setup facts.
 * @returns {unknown} Return vec2-like viewport value.
 */
function createViewportPixelsBindingValue(setup) {
	const [width, height] = initialViewportPixels(setup);

	if (typeof setup.THREE?.Vector2 === 'function') {
		return new setup.THREE.Vector2(width, height);
	}

	return [width, height];
}

/**
 * Resolve initial viewport dimensions from known setup surfaces.
 *
 * @param {ShaderSetupRequest} setup - Supplies runtime setup facts.
 * @returns {[number, number]} Return viewport width and height.
 */
function initialViewportPixels(setup) {
	const directViewportPixels = setup.viewportPixels;

	if (
		Array.isArray(directViewportPixels)
		&& Number.isInteger(directViewportPixels[0])
		&& Number.isInteger(directViewportPixels[1])
		&& directViewportPixels[0] > 0
		&& directViewportPixels[1] > 0
	) {
		return [directViewportPixels[0], directViewportPixels[1]];
	}

	for (const candidate of [
		setup,
		setup.composer,
		setup.composer?.renderer?.domElement,
		setup.renderer?.domElement,
		setup.composer?.readBuffer,
		setup.composer?.writeBuffer,
	]) {
		const width = candidate?.width ?? candidate?._width;
		const height = candidate?.height ?? candidate?._height;

		if (
			Number.isInteger(width)
			&& Number.isInteger(height)
			&& width > 0
			&& height > 0
		) {
			return [width, height];
		}
	}

	return [1, 1];
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
 * Check whether a required uniform has an owner-provided default.
 *
 * @param {readonly ShaderContribution[]} contributions - Supplies accepted contributions.
 * @param {string} valueKey - Supplies the runtime uniform key.
 * @returns {boolean} True when a non-nullish uniform default exists.
 */
function hasAvailableUniformDefault(contributions, valueKey) {
	for (const contribution of contributions) {
		for (const uniform of contribution.uniforms ?? []) {
			if (
				uniform.valueKey === valueKey
				&& Object.hasOwn(uniform, 'defaultValue')
				&& uniform.defaultValue !== null
				&& uniform.defaultValue !== undefined
			) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check whether cache facts contain payload/layout facts that can be validated.
 *
 * @param {unknown} cacheFacts - Supplies descriptor cache facts.
 * @returns {boolean} True when cache layout facts are present.
 */
function hasCachePayloadFacts(cacheFacts) {
	return Boolean(
		cacheFacts?.payloadKind
		|| cacheFacts?.payloadDimensions
		|| cacheFacts?.texture,
	);
}

/**
 * Check whether one payload should be validated against cache descriptor facts.
 *
 * @param {object} cacheFacts - Supplies descriptor cache facts.
 * @param {string} valueKey - Supplies the binding value key.
 * @param {CacheShaderPayloadDescriptor | CacheShaderTexturePayload} payloadDescriptor - Supplies the payload.
 * @returns {boolean} True when the payload targets the active cache descriptor.
 */
function shouldValidateCachePayload(cacheFacts, valueKey, payloadDescriptor) {
	const textureFacts = cacheFacts.texture ?? {};

	if (textureFacts.valueKey) {
		return valueKey === textureFacts.valueKey;
	}

	if (cacheFacts.payloadKind && payloadDescriptor?.payloadKind) {
		return payloadDescriptor.payloadKind === cacheFacts.payloadKind;
	}

	return Boolean(cacheFacts.payloadKind || cacheFacts.payloadDimensions || cacheFacts.texture);
}

/**
 * Assert that a payload descriptor matches cache-owned descriptor facts.
 *
 * @param {object} cacheFacts - Supplies descriptor cache facts.
 * @param {CacheShaderPayloadDescriptor | CacheShaderTexturePayload} payloadDescriptor - Supplies the payload.
 * @param {string} valueKey - Supplies the binding value key.
 * @returns {void}
 */
function assertCachePayloadDescriptorMatches(cacheFacts, payloadDescriptor, valueKey) {
	if (payloadDescriptor?.payloadKind) {
		assertDescriptorField(
			'payloadKind',
			payloadDescriptor.payloadKind,
			cacheFacts.payloadKind,
			valueKey,
		);
	}

	if (payloadDescriptor?.dimensions && cacheFacts.payloadDimensions) {
		assertDescriptorArray(
			'payloadDimensions',
			payloadDescriptor.dimensions,
			cacheFacts.payloadDimensions,
			valueKey,
		);
	}

	const payloadTexture = payloadDescriptor?.texture ?? payloadDescriptor;
	const textureFacts = cacheFacts.texture ?? {};

	for (const fieldName of [
		'textureId',
		'width',
		'height',
		'depth',
		'dimensionality',
		'format',
		'samplerPolicy',
		'spectralGroupSize',
		'spectralGroupCount',
		'spectralChannelCount',
	]) {
		assertDescriptorField(fieldName, payloadTexture?.[fieldName], textureFacts[fieldName], valueKey);
	}

	assertDescriptorArray(
		'coordinateOrder',
		payloadTexture?.coordinateOrder,
		textureFacts.coordinateOrder,
		valueKey,
	);

	const payloadMetadata = payloadDescriptor?.metadata ?? {};
	const cacheMetadata = cacheFacts.metadata ?? {};

	if (
		Object.hasOwn(payloadMetadata, 'uploadValueCount')
		&& Object.hasOwn(cacheMetadata, 'uploadValueCount')
	) {
		assertDescriptorField(
			'uploadValueCount',
			payloadMetadata.uploadValueCount,
			cacheMetadata.uploadValueCount,
			valueKey,
		);
	}
}

/**
 * Assert one payload field matches descriptor facts when both are present.
 *
 * @param {string} fieldName - Supplies the compared field name.
 * @param {unknown} actual - Supplies the payload value.
 * @param {unknown} expected - Supplies the descriptor value.
 * @param {string} valueKey - Supplies the binding value key.
 * @returns {void}
 */
function assertDescriptorField(fieldName, actual, expected, valueKey) {
	if (expected === undefined || actual === undefined) {
		return;
	}

	if (actual !== expected) {
		throw new TypeError(`Cache shader payload ${valueKey} ${fieldName} ${actual} does not match descriptor ${expected}.`);
	}
}

/**
 * Assert one payload array matches descriptor facts when both are present.
 *
 * @param {string} fieldName - Supplies the compared field name.
 * @param {unknown} actual - Supplies the payload value.
 * @param {unknown} expected - Supplies the descriptor value.
 * @param {string} valueKey - Supplies the binding value key.
 * @returns {void}
 */
function assertDescriptorArray(fieldName, actual, expected, valueKey) {
	if (expected === undefined || actual === undefined) {
		return;
	}

	if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
		throw new TypeError(`Cache shader payload ${valueKey} ${fieldName} does not match descriptor.`);
	}

	for (let index = 0; index < expected.length; index += 1) {
		if (actual[index] !== expected[index]) {
			throw new TypeError(`Cache shader payload ${valueKey} ${fieldName} does not match descriptor.`);
		}
	}
}

/**
 * Resolve the shader binding value key for one cache payload.
 *
 * @param {CacheShaderPayloadDescriptor} payload - Supplies cache shader payload.
 * @returns {string} Return the binding value key.
 */
function cacheTextureValueKey(payload) {
	if (payload?.payloadKind === 'distant-incident-radiance-cache') {
		return 'cache.incidentRadianceTexture';
	}

	if (payload?.payloadKind === 'local-incident-radiance-cache') {
		return 'cache.localIncidentRadianceTexture';
	}

	throw new TypeError(`Unsupported source-created cache payload kind ${payload?.payloadKind ?? '<missing>'}.`);
}

export default ShaderBuilder;
