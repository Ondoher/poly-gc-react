/**
 * Integrate single-scattered spectral radiance along the view ray.
 */
export default class IntegrateSingleScatteringStage {
	/**
	 * Create the single-scattering stage helper.
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
	 * Accumulate single-scattered radiance from medium, source, phase, and transmittance packets.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide prepared transport diagnostics.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		const wavelengthsNm = this.resolveWavelengths(packet);
		const mediumSamples = this.resolveArray(packet.mediumSamples, 'mediumSamples');
		const viewSamples = this.resolveArray(packet.viewOpticalDepth?.samples, 'viewOpticalDepth.samples');
		const solarSamples = this.resolveArray(packet.solarTransmittance?.samples, 'solarTransmittance.samples');
		const phaseSamples = this.resolveArray(packet.scatteringPhase?.samples, 'scatteringPhase.samples');
		const totals = wavelengthsNm.map(() => 0);
		const bySpecies = {};

		// Algorithm source: PBRT Volume Scattering Processes expresses
		// single-scattering as incident radiance times scattering coefficient,
		// phase, transmittance, source quadrature weight, and path length. This
		// stage consumes those factors from earlier packets rather than
		// recomputing them.
		// See analytic-invariants row single-scattering.one-sample.scalar-product.
		const samples = mediumSamples.map((mediumSample, sampleIndex) => {
			const sampleTotals = wavelengthsNm.map(() => 0);
			const sourceSamples = (solarSamples[sampleIndex]?.sourceSamples ?? []).map((
				sourceSample,
				sourceSampleIndex,
			) => {
				return this.integrateSourceSample({
					mediumSample,
					viewSample: viewSamples[sampleIndex],
					sourceSample,
					phaseSample: phaseSamples[sampleIndex]?.sourceSamples?.[sourceSampleIndex],
					wavelengthsNm,
					bySpecies,
					sampleTotals,
					totals,
					sourceSampleIndex,
				});
			});

			return {
				sampleIndex: mediumSample.sampleIndex ?? sampleIndex,
				sourceSamples,
				contributionByWavelength: sampleTotals,
			};
		});

		return {
			...packet,
			singleScattering: {
				samples,
				components: {
					bySpecies,
					rayleighInScatteredRadianceByWavelength: bySpecies.rayleigh?.radianceByWavelength ?? wavelengthsNm.map(() => 0),
					mieInScatteredRadianceByWavelength: bySpecies.mie?.radianceByWavelength ?? wavelengthsNm.map(() => 0),
					cloudInScatteredRadianceByWavelength: bySpecies.cloud?.radianceByWavelength ?? wavelengthsNm.map(() => 0),
				},
				inScatteredRadianceByWavelength: totals,
			},
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
		};
	}

	/**
	 * Integrate one source sample for one medium sample.
	 *
	 * @param {{ mediumSample: AtmosphereReferenceMediumSample, viewSample: unknown, sourceSample: AtmosphereReferenceSolarTransmittanceSourceSample, phaseSample: unknown, wavelengthsNm: readonly number[], bySpecies: Record<string, { radianceByWavelength: number[] }>, sampleTotals: number[], totals: number[], sourceSampleIndex: number }} options - Provide factor packets.
	 * @returns {unknown}
	 */
	integrateSourceSample({
		mediumSample,
		viewSample,
		sourceSample,
		phaseSample,
		wavelengthsNm,
		bySpecies,
		sampleTotals,
		totals,
		sourceSampleIndex,
	}) {
		const viewTransmittance = this.validateArray(
			viewSample?.viewTransmittanceByWavelength,
			wavelengthsNm,
			'viewTransmittanceByWavelength',
		);
		const sourceTransmittance = this.validateArray(
			sourceSample.sourceTransmittanceByWavelength,
			wavelengthsNm,
			'sourceTransmittanceByWavelength',
		);
		const sourceSpectrum = this.validateArray(
			sourceSample.sourceSpectrum?.valuesByWavelength,
			wavelengthsNm,
			'sourceSpectrum',
		);
		const sourceWeight = this.validateRequiredSourceWeight(
			sourceSample.weight,
			sourceSampleIndex,
		);
		const sourceTotal = wavelengthsNm.map(() => 0);

		const species = (phaseSample?.species ?? []).map((phaseSpecies) => {
			const mediumSpecies = this.findMediumSpecies(mediumSample, phaseSpecies.name);
			const scattering = this.validateArray(
				mediumSpecies.scatteringByWavelength,
				wavelengthsNm,
				`${phaseSpecies.name} scatteringByWavelength`,
			);
			const phase = this.validateArray(
				phaseSpecies.phaseByWavelength,
				wavelengthsNm,
				`${phaseSpecies.name} phaseByWavelength`,
			);
			const contribution = wavelengthsNm.map((_, wavelengthIndex) => {
				const value =
					viewTransmittance[wavelengthIndex]
					* scattering[wavelengthIndex]
					* phase[wavelengthIndex]
					* sourceSpectrum[wavelengthIndex]
					* sourceTransmittance[wavelengthIndex]
					* sourceWeight
					* this.validateNonnegativeFinite(mediumSample.weightKm, 'sample weightKm');

				return this.validateNonnegativeFinite(value, `${phaseSpecies.name} contribution`);
			});

			this.addInto(sourceTotal, contribution);
			this.addInto(sampleTotals, contribution);
			this.addInto(totals, contribution);
			this.addSpeciesContribution(bySpecies, phaseSpecies.name, contribution, wavelengthsNm);

			return {
				name: phaseSpecies.name,
				contributionByWavelength: contribution,
			};
		});

		return {
			sourceSampleIndex: sourceSample.sourceSampleIndex ?? sourceSampleIndex,
			sourceSampleId: sourceSample.sourceSampleId ?? sourceSampleIndex,
			species,
			contributionByWavelength: sourceTotal,
		};
	}

	/**
	 * Resolve the wavelength grid.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide packet.
	 * @returns {readonly number[]}
	 */
	resolveWavelengths(packet) {
		const wavelengthsNm = packet.validatedRequest?.wavelengthsNm;

		if (!Array.isArray(wavelengthsNm) || wavelengthsNm.length === 0) {
			// Reason: every spectral contribution must align to the validated wavelength grid.
			// Source: Stage Contracts, integrateSingleScattering input contract.
			throw new Error('integrateSingleScattering requires validatedRequest.wavelengthsNm');
		}

		return wavelengthsNm;
	}

	/**
	 * Resolve a required array.
	 *
	 * @param {unknown} value - Provide candidate array.
	 * @param {string} label - Identify array.
	 * @returns {unknown[]}
	 */
	resolveArray(value, label) {
		if (!Array.isArray(value)) {
			// Reason: stage inputs are packet arrays emitted by upstream stages.
			// Source: Stage Contracts, integrateSingleScattering consumes sample-aligned arrays.
			throw new Error(`integrateSingleScattering requires ${label} array`);
		}

		return value;
	}

	/**
	 * Find matching medium species diagnostics.
	 *
	 * @param {AtmosphereReferenceMediumSample} mediumSample - Provide medium sample.
	 * @param {string} name - Provide species name.
	 * @returns {AtmosphereReferenceMediumSpecies}
	 */
	findMediumSpecies(mediumSample, name) {
		const match = (mediumSample.species ?? []).find((species) => species.name === name);

		if (!match) {
			// Reason: phase values are species-specific and must match model-owned scattering coefficients.
			// Source: Stage Contracts, integrateSingleScattering component ownership.
			throw new Error(`integrateSingleScattering missing medium species ${name}`);
		}

		return match;
	}

	/**
	 * Validate a wavelength-aligned nonnegative numeric array.
	 *
	 * @param {unknown} values - Provide candidate values.
	 * @param {readonly number[]} wavelengthsNm - Provide wavelength grid.
	 * @param {string} label - Identify values.
	 * @returns {number[]}
	 */
	validateArray(values, wavelengthsNm, label) {
		if (!Array.isArray(values) || values.length !== wavelengthsNm.length) {
			// Reason: spectral factor arrays multiply wavelength by wavelength.
			// Source: Stage Contracts, integrateSingleScattering wavelength alignment.
			throw new RangeError(`integrateSingleScattering ${label} must align to wavelengthsNm`);
		}

		return values.map((value) => this.validateNonnegativeFinite(value, label));
	}

	/**
	 * Validate a nonnegative finite scalar.
	 *
	 * @param {unknown} value - Provide candidate scalar.
	 * @param {string} label - Identify value.
	 * @returns {number}
	 */
	validateNonnegativeFinite(value, label) {
		if (!Number.isFinite(value) || value < 0) {
			// Reason: radiance, transmittance factors, scattering coefficients, phase, and path length are nonnegative.
			// Source: PBRT Volume Scattering Processes and Stage Contracts, integrateSingleScattering.
			throw new RangeError(`integrateSingleScattering ${label} must be nonnegative finite`);
		}

		return value;
	}

	/**
	 * Validate a required source quadrature weight.
	 *
	 * @param {unknown} value - Provide source sample weight.
	 * @param {number} sourceSampleIndex - Identify source sample in errors.
	 * @returns {number}
	 */
	validateRequiredSourceWeight(value, sourceSampleIndex) {
		if (value === undefined) {
			// Reason: source quadrature weight is a required transport multiplier, so the consuming stage must not invent a fallback.
			// Source: Stage Contracts, integrateSingleScattering source-weight contract.
			throw new RangeError(`integrateSingleScattering source sample ${sourceSampleIndex} weight is required`);
		}

		if (!Number.isFinite(value) || value < 0) {
			// Reason: source quadrature weights represent nonnegative finite measure in the source-direction integral.
			// Source: PBRT Volume Scattering Processes; Stage Contracts, integrateSingleScattering source-weight contract.
			throw new RangeError(`integrateSingleScattering source sample ${sourceSampleIndex} weight must be nonnegative finite`);
		}

		return value;
	}

	/**
	 * Add contribution into an accumulator.
	 *
	 * @param {number[]} target - Provide target accumulator.
	 * @param {readonly number[]} contribution - Provide contribution.
	 * @returns {void}
	 */
	addInto(target, contribution) {
		for (const [index, value] of contribution.entries()) {
			target[index] += value;
		}
	}

	/**
	 * Add contribution into the species summary.
	 *
	 * @param {Record<string, { radianceByWavelength: number[] }>} bySpecies - Provide species map.
	 * @param {string} name - Provide species name.
	 * @param {readonly number[]} contribution - Provide contribution.
	 * @param {readonly number[]} wavelengthsNm - Provide wavelengths.
	 * @returns {void}
	 */
	addSpeciesContribution(bySpecies, name, contribution, wavelengthsNm) {
		if (!bySpecies[name]) {
			bySpecies[name] = { radianceByWavelength: wavelengthsNm.map(() => 0) };
		}

		this.addInto(bySpecies[name].radianceByWavelength, contribution);
	}
}
