/**
 * Run CPU/reference Algorithm32 evaluations against a configured shared model.
 */
export class Reference {
	/**
	 * Store the facade-owned shared model consumed by reference evaluations.
	 *
	 * @type {SharedModel}
	 */
	_model;

	/**
	 * Create a CPU/reference algorithm execution collaborator.
	 *
	 * @param {ReferenceDependencies} dependencies - Supplies the shared model
	 * and implementation services used by reference evaluations.
	 */
	constructor(dependencies) {
		this._model = dependencies.model;
	}

	/**
	 * Get the facade-owned shared model consumed by reference evaluations.
	 *
	 * @returns {SharedModel} The shared model.
	 */
	get model() {
		return this._model;
	}

	/**
	 * Dispose resources owned by the reference execution collaborator.
	 *
	 * @returns {void}
	 */
	dispose() {
	}

	/**
	 * Create the geometry-owned ray distance request for one evaluation.
	 *
	 * @param {EvaluationRequest} request - Supplies the accepted evaluation
	 * request.
	 * @returns {RayDistanceRequest} The geometry ray distance request.
	 */
	_createRayDistanceRequest(request) {
	}

	/**
	 * Create canonical path samples for the resolved ray distance.
	 *
	 * @param {EvaluationRequest} request - Supplies the accepted evaluation
	 * request.
	 * @param {ResolvedRayDistance} rayDistance - Supplies the resolved
	 * geometry distance.
	 * @param {SpectralModel} spectral - Supplies the active spectral model.
	 * @returns {readonly PathSample[]} The ordered path samples.
	 */
	_createPathSamples(request, rayDistance, spectral) {
	}

	/**
	 * Create the initial immutable transport state for a spectral evaluation.
	 *
	 * @param {number} channelCount - Supplies the active spectral channel count.
	 * @returns {TransportState} The initial transport state.
	 */
	_createTransportState(channelCount) {
		return {
			radiance: Array.from({ length: channelCount }, () => 0),
			transmittance: Array.from({ length: channelCount }, () => 1),
		};
	}

	/**
	 * Sample atmosphere medium facts at one path sample.
	 *
	 * @param {PathSample} pathSample - Supplies the current path sample.
	 * @param {SpectralModel} spectral - Supplies the active spectral model.
	 * @returns {AtmosphereSample} The sampled medium facts.
	 */
	_sampleMedium(pathSample, spectral) {
	}

	/**
	 * Sample light-source radiance facts for one path sample.
	 *
	 * @param {EvaluationRequest} request - Supplies the accepted evaluation
	 * request.
	 * @param {PathSample} pathSample - Supplies the current path sample.
	 * @param {SpectralModel} spectral - Supplies the active spectral model.
	 * @returns {RadianceSample} The sampled light-source radiance facts.
	 */
	_sampleRadiance(request, pathSample, spectral) {
	}

	/**
	 * Sample the scattering phase function for the current radiance direction.
	 *
	 * @param {EvaluationRequest} request - Supplies the accepted evaluation
	 * request.
	 * @param {RadianceSample} radianceSample - Supplies the light-source sample.
	 * @returns {PhaseSample} The sampled phase-function facts.
	 */
	_samplePhase(request, radianceSample) {
	}

	/**
	 * Compute source-path transmittance from the path sample to the light source.
	 *
	 * @param {PathSample} pathSample - Supplies the current path sample.
	 * @param {RadianceSample} radianceSample - Supplies the light-source sample.
	 * @param {SpectralModel} spectral - Supplies the active spectral model.
	 * @returns {readonly number[]} The spectral source-path transmittance.
	 */
	_computeSourceTransmittance(pathSample, radianceSample, spectral) {
	}

	/**
	 * Compute direct light-source in-scattering for one path sample.
	 *
	 * @param {AtmosphereSample} mediumSample - Supplies the sampled medium facts.
	 * @param {PhaseSample} phaseSample - Supplies the sampled phase facts.
	 * @param {RadianceSample} radianceSample - Supplies the light-source sample.
	 * @param {readonly number[]} sourceTransmittance - Supplies spectral
	 * source-path transmittance.
	 * @param {readonly number[]} viewTransmittance - Supplies spectral
	 * transmittance from the observer to the current sample.
	 * @param {number} weight - Supplies the path sample integration weight.
	 * @returns {readonly number[]} The direct spectral in-scattering.
	 */
	_computeDirectInScattering(
		mediumSample,
		phaseSample,
		radianceSample,
		sourceTransmittance,
		viewTransmittance,
		weight,
	) {
		return radianceSample.spectralRadiance.map((radiance, channelIndex) => {
			// Single-scattering in-scattering multiplies view survival, scattering,
			// phase, incoming radiance, source-path survival, and path measure. [2][3]
			return viewTransmittance[channelIndex]
				* mediumSample.scatteringCoefficient[channelIndex]
				* phaseSample.value
				* radiance
				* sourceTransmittance[channelIndex]
				* weight;
		});
	}

	/**
	 * Sample light-source-owned incident radiance for one path sample.
	 *
	 * @param {EvaluationRequest} request - Supplies the accepted evaluation
	 * request.
	 * @param {PathSample} pathSample - Supplies the current path sample.
	 * @param {SpectralModel} spectral - Supplies the active spectral model.
	 * @returns {IncidentRadianceSample} The sampled incident radiance facts.
	 */
	_sampleIncidentRadiance(request, pathSample, spectral) {
	}

	/**
	 * Compute incident radiance in-scattering for one path sample.
	 *
	 * @param {AtmosphereSample} mediumSample - Supplies the sampled medium facts.
	 * @param {IncidentRadianceSample} incidentRadianceSample - Supplies the
	 * incident radiance sample.
	 * @param {readonly number[]} viewTransmittance - Supplies spectral
	 * transmittance from the observer to the current sample.
	 * @param {number} weight - Supplies the path sample integration weight.
	 * @param {SpectralModel} spectral - Supplies the active spectral model.
	 * @returns {readonly number[]} The incident spectral in-scattering.
	 */
	_computeIncidentInScattering(
		mediumSample,
		incidentRadianceSample,
		viewTransmittance,
		weight,
		spectral,
	) {
		return Array.from(
			{ length: spectral.channelCount },
			(_, channelIndex) => {
				// The light-source model supplies sampled incident radiance; the
				// reference helper applies scattering, view survival, and path
				// measure for the higher-order in-scattering contribution. [2]
				return viewTransmittance[channelIndex]
					* mediumSample.scatteringCoefficient[channelIndex]
					* incidentRadianceSample.spectralRadiance[channelIndex]
					* weight;
			},
		);
	}

	/**
	 * Compute the spectral transmittance for one view-path segment.
	 *
	 * @param {AtmosphereSample} mediumSample - Supplies the sampled medium facts.
	 * @param {number} weight - Supplies the path sample integration weight.
	 * @param {SpectralModel} spectral - Supplies the active spectral model.
	 * @returns {readonly number[]} The segment spectral transmittance.
	 */
	_computeSegmentTransmittance(mediumSample, weight, spectral) {
		return Array.from(
			{ length: spectral.channelCount },
			(_, channelIndex) => {
				const opticalDepth = mediumSample.extinctionCoefficient[channelIndex] * weight;

				// Beer-Lambert attenuation converts segment optical depth to transmittance. [1]
				return Math.exp(-opticalDepth);
			},
		);
	}

	/**
	 * Integrate one path sample into the immutable transport state.
	 *
	 * @param {TransportState} transportState - Supplies the current transport
	 * state.
	 * @param {readonly number[]} directInScattering - Supplies direct spectral
	 * in-scattering.
	 * @param {readonly number[]} incidentInScattering - Supplies incident
	 * spectral in-scattering.
	 * @param {readonly number[]} segmentTransmittance - Supplies spectral
	 * transmittance for the current path segment.
	 * @returns {TransportState} The next immutable transport state.
	 */
	_integratePathSample(
		transportState,
		directInScattering,
		incidentInScattering,
		segmentTransmittance,
	) {
		return {
			radiance: transportState.radiance.map(
				(value, channelIndex) => value
					+ directInScattering[channelIndex]
					+ incidentInScattering[channelIndex],
			),
			transmittance: transportState.transmittance.map(
				(value, channelIndex) => value * segmentTransmittance[channelIndex],
			),
		};
	}

	/**
	 * Create the public spectral evaluation result from the final transport
	 * state.
	 *
	 * @param {TransportState} transportState - Supplies the final transport
	 * state.
	 * @returns {EvaluationResult} The spectral evaluation result.
	 */
	_createEvaluationResult(transportState) {
		return {
			pathRadiance: [...transportState.radiance],
			transmittance: [...transportState.transmittance],
		};
	}

	/**
	 * Evaluate Algorithm32 spectral radiance and transmittance for one ray
	 * request.
	 *
	 * The evaluation integrates volume transport along the resolved ray path:
	 * optical-depth and Beer-Lambert transmittance track path survival, direct
	 * in-scattering adds light-source radiance scattered into the view path, and
	 * light-source incident radiance adds the higher-order in-scattering
	 * term. [1][2]
	 *
	 * @param {EvaluationRequest} request - Supplies one accepted evaluation
	 * request.
	 * @returns {EvaluationResult} The spectral evaluation result.
	 */
	evaluate(request) {
		const model = this.model;
		const spectral = model.spectral;

		const rayDistance = model.geometry.resolveRayDistance(this._createRayDistanceRequest(request));
		const pathSamples = this._createPathSamples(request, rayDistance, spectral);
		let transportState = this._createTransportState(spectral.channelCount);

		for (const pathSample of pathSamples) {
			const mediumSample = this._sampleMedium(pathSample, spectral);
			const radianceSample = this._sampleRadiance(request, pathSample, spectral);
			const phaseSample = this._samplePhase(request, radianceSample);

			// Source-path transmittance applies Beer-Lambert attenuation from the
			// sample point to the light source. [1]
			const sourceTransmittance = this._computeSourceTransmittance(pathSample, radianceSample, spectral);

			// Direct in-scattering adds light-source radiance scattered into the view path. [2]
			const directInScattering = this._computeDirectInScattering(
				mediumSample,
				phaseSample,
				radianceSample,
				sourceTransmittance,
				transportState.transmittance,
				pathSample.weight,
			);

			// Light-source incident radiance supplies the higher-order in-scattering term. [2]
			const incidentRadianceSample = this._sampleIncidentRadiance(
				request,
				pathSample,
				spectral,
			);

			const incidentInScattering = this._computeIncidentInScattering(
				mediumSample,
				incidentRadianceSample,
				transportState.transmittance,
				pathSample.weight,
				spectral,
			);

			// Segment transmittance attenuates the view path by this segment's extinction. [1]
			const segmentTransmittance = this._computeSegmentTransmittance(
				mediumSample,
				pathSample.weight,
				spectral,
			);

			const nextTransportState = this._integratePathSample(
				transportState,
				directInScattering,
				incidentInScattering,
				segmentTransmittance,
			);

			transportState = nextTransportState;
		}

		return this._createEvaluationResult(transportState);
	}
}

