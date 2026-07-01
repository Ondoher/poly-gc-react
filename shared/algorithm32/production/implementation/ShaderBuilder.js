/**
 * Build Algorithm32 runtime shader artifacts from the configured shared model.
 */
export class ShaderBuilder {
	/**
	 * Create a runtime shader builder.
	 *
	 * @param {ShaderBuilderDependencies} dependencies - Supplies the shared
	 * model and implementation services used to build shader artifacts.
	 */
	constructor(dependencies) {
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
	}

	/**
	 * Refresh builder state for a new accepted facade configuration.
	 *
	 * @param {ConfigSnapshot} config - Supplies the accepted configuration
	 * snapshot.
	 * @returns {void}
	 */
	refreshConfig(config) {
	}

	/**
	 * Dispose resources owned by the runtime shader builder.
	 *
	 * @returns {void}
	 */
	dispose() {
	}
}
