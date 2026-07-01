/**
 * Supplies construction dependencies for the CPU/reference algorithm execution
 * collaborator.
 */
type ReferenceDependencies = {
	/**
	 * Store the facade-owned shared model consumed by reference evaluations.
	 */
	readonly model: SharedModel;
};

/**
 * Store one canonicalized path integration sample.
 */
type PathSample = {
	/**
	 * Store the model-space sample position.
	 */
	readonly position: Position;

	/**
	 * Store the canonical distance along the evaluation ray.
	 */
	readonly distance: number;

	/**
	 * Store the canonical integration weight for this path sample.
	 */
	readonly weight: number;
};

/**
 * Store the immutable spectral transport state accumulated during evaluation.
 */
type TransportState = {
	/**
	 * Store accumulated spectral path radiance.
	 */
	readonly radiance: readonly number[];

	/**
	 * Store current spectral view transmittance.
	 */
	readonly transmittance: readonly number[];
};

/**
 * Supplies construction dependencies for the runtime shader builder.
 */
type ShaderBuilderDependencies = {
	/**
	 * Store the facade-owned shared model consumed by shader builds.
	 */
	readonly model: SharedModel;
};

/**
 * Supplies one accepted request to build runtime shader artifacts.
 */
type ShaderBuildRequest = {
	/**
	 * Store the caller-owned Three runtime attachment request.
	 */
	readonly setup: ShaderSetupRequest;
};

/**
 * Describes runtime shader artifacts produced by the shader builder for facade
 * attachment. The packet is intentionally skeletal until the shader runtime
 * contract is accepted.
 */
type ShaderBuildResult = {
	/**
	 * Store the shared model version used while building the artifacts.
	 */
	readonly modelVersion: number;
};
