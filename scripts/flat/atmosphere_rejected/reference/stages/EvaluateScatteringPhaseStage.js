import { evaluatePhaseByWavelength } from '../phase-functions.js';

const SCATTERING_PHASE_CONVENTION =
	'cosTheta = dot(sourceDirectionFromSample, directionFromSampleToCamera)';

/**
 * Evaluate angular scattering phase terms.
 */
export default class EvaluateScatteringPhaseStage {
	/**
	 * Create the scattering phase stage helper.
	 *
	 * @param {{ descriptor: AtmosphereReferenceStageDescriptor, context?: Readonly<AtmosphereReferenceIntegratorOptions> }} options - Configure the stage helper.
	 */
	constructor({ descriptor, context } = {}) {
		/**
		 * Store this stage's descriptor for history and error context.
		 *
		 * @type {AtmosphereReferenceStageDescriptor}
		 */
		this.descriptor = descriptor;

		/**
		 * Store integrator defaults for helpers that need them.
		 *
		 * @type {Readonly<AtmosphereReferenceIntegratorOptions> | undefined}
		 */
		this.context = context;
	}

	/**
	 * Evaluate phase functions for every medium/source sample pair.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide the prepared stage packet.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		if (!Array.isArray(packet.mediumSamples)) {
			// Reason: phase evaluation is sample-aligned to mediumSamples from evaluateMedium.
			// Source: Stage Contracts, evaluateScatteringPhase consumes mediumSamples.
			throw new Error('evaluateScatteringPhase requires mediumSamples array');
		}

		const sourceSampleGroups = this.resolveSolarTransmittanceSamples(packet.solarTransmittance);
		const wavelengthsNm = this.validateWavelengths(packet.validatedRequest?.wavelengthsNm);
		const rayDirection = this.validateVector3(
			packet.validatedRequest?.ray?.direction,
			'validatedRequest.ray.direction',
		);

		// Branch source: the stage owns the sign convention for source-to-camera
		// scattering diagnostics so downstream radiance integration does not
		// silently reinterpret source directions.
		// See Stage Contracts, evaluateScatteringPhase ownership.
		const directionFromSampleToCamera = rayDirection.map((component) => -component);
		const samples = packet.mediumSamples.map((mediumSample, sampleIndex) => {
			const sourceSamples = sourceSampleGroups[sampleIndex]?.sourceSamples ?? [];

			return {
				sampleIndex: mediumSample.sampleIndex ?? sampleIndex,
				sourceSamples: sourceSamples.map((sourceSample, sourceSampleIndex) => {
					return this.evaluateSourceSample({
						mediumSample,
						sourceSample,
						sourceSampleIndex,
						directionFromSampleToCamera,
						wavelengthsNm,
					});
				}),
			};
		});

		const sourceSampleCount = samples.reduce((sum, sample) => {
			return sum + sample.sourceSamples.length;
		}, 0);

		return {
			...packet,
			scatteringPhase: {
				samples,
				metadata: {
					convention: SCATTERING_PHASE_CONVENTION,
					sampleCount: samples.length,
					sourceSampleCount,
				},
			},
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
		};
	}

	/**
	 * Evaluate one source sample against one medium sample.
	 *
	 * @param {{ mediumSample: AtmosphereReferenceMediumSample, sourceSample: AtmosphereReferenceSolarTransmittanceSourceSample, sourceSampleIndex: number, directionFromSampleToCamera: number[], wavelengthsNm: readonly number[] }} options - Provide phase context.
	 * @returns {AtmosphereReferenceScatteringPhaseSourceSample}
	 */
	evaluateSourceSample({
		mediumSample,
		sourceSample,
		sourceSampleIndex,
		directionFromSampleToCamera,
		wavelengthsNm,
	}) {
		const sourceDirection = this.validateVector3(
			sourceSample.direction,
			`source sample ${sourceSampleIndex} direction`,
		);
		const cosTheta = this.clampCosTheta(
			this.dot(sourceDirection, directionFromSampleToCamera),
		);

		return {
			sourceSampleIndex: sourceSample.sourceSampleIndex ?? sourceSampleIndex,
			sourceSampleId: sourceSample.sourceSampleId ?? sourceSampleIndex,
			cosTheta,
			scatteringAngleRad: Math.acos(cosTheta),
			species: this.evaluateSpeciesPhase(
				mediumSample.species ?? [],
				wavelengthsNm,
				cosTheta,
			),
		};
	}

	/**
	 * Evaluate phase functions for species with explicit phase metadata.
	 *
	 * @param {readonly AtmosphereReferenceMediumSpecies[]} species - Provide species diagnostics.
	 * @param {readonly number[]} wavelengthsNm - Provide active wavelength grid.
	 * @param {number} cosTheta - Provide local source-direction to sample-to-camera cosine.
	 * @returns {AtmosphereReferenceScatteringPhaseSpecies[]}
	 */
	evaluateSpeciesPhase(species, wavelengthsNm, cosTheta) {
		const phaseSpecies = [];

		for (const entry of species) {
			const phase = entry.phase ?? (
				typeof entry.phaseKind === 'string'
					? { kind: entry.phaseKind, parameters: entry.parameters }
					: undefined
			);

			if (!phase) {
				// Reason: phase parameters are model-owned; missing metadata means
				// this stage has no supported phase function to evaluate for that species.
				// Source: Stage Contracts, evaluateScatteringPhase ownership.
				continue;
			}

			const phaseKind = phase.kind;

			phaseSpecies.push({
				name: entry.name,
				phaseKind,
				parameters: phase.parameters ?? {},
				phaseByWavelength: this.phaseByWavelength({
					phaseKind,
					parameters: phase.parameters ?? {},
					wavelengthsNm,
					cosTheta,
				}),
			});
		}

		return phaseSpecies;
	}

	/**
	 * Evaluate one supported phase function.
	 *
	 * @param {{ phaseKind: string, parameters: Record<string, unknown>, wavelengthsNm: readonly number[], cosTheta: number }} options - Provide phase context.
	 * @returns {number[]}
	 */
	phaseByWavelength({
		phaseKind,
		parameters,
		wavelengthsNm,
		cosTheta,
	}) {
		return evaluatePhaseByWavelength({
			phaseKind,
			parameters,
			wavelengthsNm,
			cosTheta,
			errorPrefix: 'evaluateScatteringPhase',
		});
	}

	/**
	 * Resolve solar transmittance samples from the upstream packet.
	 *
	 * @param {AtmosphereReferenceSolarTransmittance | undefined} solarTransmittance - Provide upstream source data.
	 * @returns {AtmosphereReferenceSolarTransmittanceSample[]}
	 */
	resolveSolarTransmittanceSamples(solarTransmittance) {
		if (!solarTransmittance || !Array.isArray(solarTransmittance.samples)) {
			// Reason: this stage consumes source samples from integrateSolarTransmittance
			// and does not re-query the solar source model.
			// Source: Stage Contracts, evaluateScatteringPhase downstream use.
			throw new Error('evaluateScatteringPhase requires solarTransmittance.samples array');
		}

		return solarTransmittance.samples;
	}

	/**
	 * Validate the active wavelength grid for phase output alignment.
	 *
	 * @param {unknown} wavelengthsNm - Provide candidate wavelength grid.
	 * @returns {readonly number[]}
	 */
	validateWavelengths(wavelengthsNm) {
		if (
			!Array.isArray(wavelengthsNm)
			|| wavelengthsNm.length === 0
			|| wavelengthsNm.some((wavelengthNm) => !Number.isFinite(wavelengthNm))
		) {
			// Reason: phaseByWavelength arrays must align to validatedRequest.wavelengthsNm.
			// Source: Stage Contracts, evaluateScatteringPhase output shape.
			throw new Error('evaluateScatteringPhase requires validatedRequest.wavelengthsNm');
		}

		return wavelengthsNm;
	}

	/**
	 * Validate a 3D direction vector.
	 *
	 * @param {unknown} vector - Provide candidate vector.
	 * @param {string} label - Identify vector in errors.
	 * @returns {number[]}
	 */
	validateVector3(vector, label) {
		if (
			!Array.isArray(vector)
			|| vector.length !== 3
			|| vector.some((component) => !Number.isFinite(component))
		) {
			// Reason: scattering angles are defined by finite 3D direction vectors.
			// Source: PBRT Rays and Stage Contracts, evaluateScatteringPhase convention.
			throw new Error(`evaluateScatteringPhase ${label} must be a finite 3-vector`);
		}

		return vector;
	}

	/**
	 * Dot two equal-length vectors.
	 *
	 * @param {readonly number[]} a - Provide first vector.
	 * @param {readonly number[]} b - Provide second vector.
	 * @returns {number}
	 */
	dot(a, b) {
		return a.reduce((sum, component, index) => sum + component * b[index], 0);
	}

	/**
	 * Clamp cosine values to the valid acos domain.
	 *
	 * @param {number} value - Provide a cosine value.
	 * @returns {number}
	 */
	clampCosTheta(value) {
		// Reason: finite arithmetic near parallel directions can drift just
		// outside the mathematical acos domain while representing the same angle.
		// Source: local numerical policy for angle diagnostics.
		return Math.max(-1, Math.min(1, value));
	}
}
