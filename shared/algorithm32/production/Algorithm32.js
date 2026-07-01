/**
 * Provide the primary production facade for Algorithm32.
 */
export class Algorithm32 {
	/**
	 * Create a facade for one configured Algorithm32 simulation/render context.
	 *
	 * @param {Config} config - Supplies the consumer-provided light-source,
	 * atmosphere, and geometry models plus Algorithm32 runtime configuration.
	 */
	constructor(config) {
	}

	/**
	 * Return the current canonical configuration snapshot. The returned packet
	 * is for inspection and compatibility checks, not mutation.
	 *
	 * @returns {ConfigSnapshot} The current configuration snapshot.
	 */
	get config() {
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
	}

	/**
	 * Dispose resources owned by this facade.
	 *
	 * @returns {void}
	 */
	dispose() {
	}
}
