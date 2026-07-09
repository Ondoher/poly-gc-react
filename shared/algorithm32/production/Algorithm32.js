import { Reference } from './implementation/Reference.js';
import { ShaderBuilder } from './implementation/ShaderBuilder.js';
import { SharedModel } from './models/SharedModel.js';
import WavelengthMath from './utils/WavelengthMath.js';

/**
 * Provide the primary production facade for Algorithm32.
 */
export class Algorithm32 {
	/**
	 * Store the current accepted configuration.
	 *
	 * @type {Config}
	 */
	_config;

	/**
	 * Store the current facade-local configuration version.
	 *
	 * @type {number}
	 */
	_version = 0;

	/**
	 * Store the facade-owned shared model.
	 *
	 * @type {SharedModel}
	 */
	_model;

	/**
	 * Store the CPU/reference implementation collaborator.
	 *
	 * @type {Reference}
	 */
	_reference;

	/**
	 * Store the runtime shader builder.
	 *
	 * @type {ShaderBuilder}
	 */
	_shaderBuilder;

	/**
	 * Track handles created by this facade.
	 *
	 * @type {Set<Algorithm32ShaderHandle>}
	 */
	_shaderHandles = new Set();

	/**
	 * Track whether this facade has been disposed.
	 *
	 * @type {boolean}
	 */
	_disposed = false;

	/**
	 * Create a facade for one configured Algorithm32 simulation/render context.
	 *
	 * @param {Config} config - Supplies the consumer-provided light-source,
	 * atmosphere, and geometry models plus Algorithm32 runtime configuration.
	 */
	constructor(config) {
		this._replaceConfig(config);
	}

	/**
	 * Return the current canonical configuration snapshot. The returned packet
	 * is for inspection and compatibility checks, not mutation.
	 *
	 * @returns {ConfigSnapshot} The current configuration snapshot.
	 */
	get config() {
		this._assertUsable();

		return this._createConfigSnapshot();
	}

	/**
	 * Replace the facade configuration with a new complete configuration. The
	 * returned snapshot describes the accepted configuration state and version.
	 *
	 * @param {Config} config - Supplies the replacement Algorithm32
	 * configuration.
	 * @returns {ConfigSnapshot} The accepted configuration snapshot.
	 */
	setConfig(config) {
		this._assertUsable();

		return this._replaceConfig(config);
	}

	/**
	 * Build and attach the runtime shader integration. The returned handle owns
	 * Algorithm32-specific shader resources, binding lifecycle, resizing,
	 * configuration refresh, and disposal for the installed pass.
	 *
	 * @param {ShaderSetupRequest} request - Supplies the caller-owned Three
	 * runtime attachment handles.
	 * @returns {Promise<ShaderHandle>} The installed runtime shader handle.
	 */
	async setupShader(request) {
		this._assertUsable();
		const buildResult = await this._shaderBuilder.build({
			setup: request,
			config: this.config,
		});
		const handle = new Algorithm32ShaderHandle({
			facade: this,
			setup: request,
			buildResult,
		});

		this._shaderHandles.add(handle);

		return handle;
	}

	/**
	 * Run one CPU/reference Algorithm32 evaluation request. The returned result
	 * contains spectral radiance/transmittance information; it does not contain
	 * display-converted color.
	 *
	 * @param {EvaluationRequest} request - Supplies one accepted evaluation
	 * request.
	 * @returns {EvaluationResult} The spectral evaluation result.
	 */
	evaluate(request) {
		this._assertUsable();

		return this._reference.evaluate(request);
	}

	/**
	 * Dispose resources owned by this facade.
	 *
	 * @returns {void}
	 */
	dispose() {
		if (this._disposed) {
			return;
		}

		for (const handle of this._shaderHandles) {
			handle.dispose();
		}

		this._reference?.dispose();
		this._shaderBuilder?.dispose();
		this._disposed = true;
	}

	/**
	 * Replace config and implementation collaborators.
	 *
	 * @param {Config} config - Supplies the replacement configuration.
	 * @returns {ConfigSnapshot} The accepted configuration snapshot.
	 */
	_replaceConfig(config) {
		this._assertConfig(config);

		this._reference?.dispose();
		this._shaderBuilder?.dispose();

		this._version += 1;
		this._config = this._copyConfig(config);
		this._model = new SharedModel({
			version: this._version,
			lightSource: config.lightSource,
			atmosphere: config.atmosphere,
			geometry: config.geometry,
			spectralBasis: config.spectral,
		});
		this._reference = new Reference({
			model: this._model,
			executionControls: config.execution,
		});
		this._shaderBuilder = new ShaderBuilder({
			model: this._model,
		});

		return this._createConfigSnapshot();
	}

	/**
	 * Create the current configuration snapshot.
	 *
	 * @returns {ConfigSnapshot} The current configuration snapshot.
	 */
	_createConfigSnapshot() {
		return Object.freeze({
			config: this._copyConfig(this._config),
			version: this._version,
			model: this._model.snapshot(),
		});
	}

	/**
	 * Copy facade configuration without cloning consumer-owned model objects.
	 *
	 * @param {Config} config - Supplies configuration to copy.
	 * @returns {Config} The copied configuration wrapper.
	 */
	_copyConfig(config) {
		return Object.freeze({
			lightSource: config.lightSource,
			atmosphere: config.atmosphere,
			geometry: config.geometry,
			color: config.color ?? null,
			spectral: Object.freeze({
				wavelengths: Object.freeze(config.spectral.wavelengths.map((wavelength) => Object.freeze({
					value: wavelength.value,
					units: wavelength.units,
				}))),
			}),
			execution: Object.freeze({ ...(config.execution ?? {}) }),
			shader: Object.freeze({ ...(config.shader ?? {}) }),
		});
	}

	/**
	 * Assert that the facade is still usable.
	 *
	 * @returns {void}
	 */
	_assertUsable() {
		if (this._disposed) {
			throw new Error('Algorithm32 facade has been disposed.');
		}
	}

	/**
	 * Assert that configuration has the first-slice required shape.
	 *
	 * @param {Config} config - Supplies the candidate configuration.
	 * @returns {void}
	 */
	_assertConfig(config) {
		if (!config || typeof config !== 'object') {
			throw new TypeError('Algorithm32 config is required.');
		}

		this._assertModel('lightSource', config.lightSource, [
			'describe',
			'createIncidentRadianceCache',
			'sampleDirectLighting',
			'resolveSourcePathLimit',
		]);
		this._assertModel('atmosphere', config.atmosphere, [
			'describe',
			'sampleMedium',
			'integrateOpticalDepth',
			'samplePhase',
		]);
		this._assertModel('geometry', config.geometry, [
			'describe',
			'resolveViewRaySegment',
			'resolveAtmosphereCoordinate',
			'resolveAtmospherePath',
			'resolveSourceRelativePosition',
			'resolveCacheAccess',
		]);
		if (config.color !== undefined && config.color !== null) {
			this._assertModel('color', config.color, [
				'describe',
				'convert',
			]);
		}

		if (!config.spectral || !Array.isArray(config.spectral.wavelengths) || config.spectral.wavelengths.length === 0) {
			throw new TypeError('Algorithm32 config requires a non-empty spectral basis.');
		}

		for (const wavelength of config.spectral.wavelengths) {
			WavelengthMath.assertWavelength(wavelength, 'Algorithm32 spectral wavelength');
		}

		const deferredDebugViewProperty = ['debug', 'View'].join('');

		if (config.shader && Object.hasOwn(config.shader, deferredDebugViewProperty)) {
			throw new TypeError('Shader debug views are deferred and are not part of first production config.');
		}
	}

	/**
	 * Assert that one configured model exposes required methods.
	 *
	 * @param {string} name - Supplies the model name.
	 * @param {unknown} model - Supplies the candidate model.
	 * @param {readonly string[]} methods - Supplies required method names.
	 * @returns {void}
	 */
	_assertModel(name, model, methods) {
		if (!model || typeof model !== 'object') {
			throw new TypeError(`Algorithm32 config requires ${name}.`);
		}

		for (const methodName of methods) {
			if (typeof model[methodName] !== 'function') {
				throw new TypeError(`Algorithm32 ${name} model requires ${methodName}().`);
			}
		}
	}

	/**
	 * Forget a disposed shader handle.
	 *
	 * @param {Algorithm32ShaderHandle} handle - Supplies the disposed handle.
	 * @returns {void}
	 */
	_forgetShaderHandle(handle) {
		this._shaderHandles.delete(handle);
	}
}

/**
 * Control one installed Algorithm32 runtime shader integration.
 */
class Algorithm32ShaderHandle {
	/**
	 * Create a shader handle.
	 *
	 * @param {object} state - Supplies facade, setup, and build state.
	 */
	constructor(state) {
		this._facade = state.facade;
		this._setup = state.setup;
		this._buildResult = state.buildResult;
		this._disposed = false;
	}

	/**
	 * Replace facade config and refresh runtime shader resources.
	 *
	 * @param {Config} config - Supplies the replacement facade config.
	 * @returns {Promise<ConfigSnapshot>} The accepted config snapshot.
	 */
	async setConfig(config) {
		this._assertUsable();
		const snapshot = this._facade.setConfig(config);

		const nextBuildResult = await this._facade._shaderBuilder.build({
			setup: this._setup,
			config: snapshot,
		});
		this._disposeBuildResult();
		this._buildResult = nextBuildResult;

		return snapshot;
	}

	/**
	 * Return deferred diagnostics placeholder data.
	 *
	 * @returns {unknown} Deferred diagnostics placeholder data.
	 */
	getDiagnostics() {
		this._assertUsable();

		if (this._buildResult.runtime) {
			return Object.freeze({
				status: 'installed',
				modelVersion: this._buildResult.modelVersion,
				runtime: this._buildResult.runtime.getDiagnostics(),
			});
		}

		return Object.freeze({
			status: 'deferred',
			modelVersion: this._buildResult.modelVersion,
		});
	}

	/**
	 * Dispose resources owned by this handle.
	 *
	 * @returns {void}
	 */
	dispose() {
		if (this._disposed) {
			return;
		}

		this._disposed = true;
		this._disposeBuildResult();
		this._facade._forgetShaderHandle(this);
	}

	/**
	 * Dispose runtime resources owned by the current build result.
	 *
	 * @returns {void}
	 */
	_disposeBuildResult() {
		this._buildResult?.runtime?.dispose?.();
	}

	/**
	 * Assert that the handle is still usable.
	 *
	 * @returns {void}
	 */
	_assertUsable() {
		if (this._disposed) {
			throw new Error('Algorithm32 shader handle has been disposed.');
		}
	}
}
