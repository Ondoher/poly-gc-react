import ValidateRequestStage from './ValidateRequestStage.js';

/**
 * Integrate camera-ray optical depth and Beer-Lambert transmittance.
 */
export default class IntegrateViewOpticalDepthStage {
	/**
	 * Create the view optical-depth stage helper.
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

		/**
		 * Reuse the request validator's wavelength-grid contract.
		 *
		 * Branch source: validateRequest owns wavelength-grid validation, so this
		 * stage reuses that contract instead of defining a parallel validator.
		 * See Reference Decision Log, integrateViewOpticalDepth Implementation Branch Source Map.
		 *
		 * @type {ValidateRequestStage}
		 */
		this.requestValidator = new ValidateRequestStage({ descriptor, context });
	}

	/**
	 * Integrate optical depth and Beer-Lambert transmittance along view samples.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide sampled medium data.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		if (!Array.isArray(packet.mediumSamples)) {
			// Reason: optical-depth integration consumes a sample array produced by evaluateMedium.
			// Source: Reference Code Design, integrateViewOpticalDepth packet contract.
			throw new Error('integrateViewOpticalDepth requires mediumSamples array');
		}

		const wavelengthsNm = this.resolveWavelengths(packet);

		// Algorithm reference: PBRT Transmittance defines optical depth as the
		// path integral of extinction. This stage approximates that integral from
		// sample weights supplied by sampleViewPath.
		// See Reference Decision Log, integrateViewOpticalDepth Implementation Branch Source Map.
		const cumulativeOpticalDepthByWavelength = wavelengthsNm.map(() => 0);
		const speciesTotals = {};
		const outputSamples = [];

		for (const [sampleIndex, sample] of packet.mediumSamples.entries()) {
			const weightKm = this.validateSampleWeightKm(sample.weightKm, sampleIndex);
			const sampleSpeciesOpticalDepth = {};
			const extinctionByWavelength = this.resolveSampleExtinctionByWavelength(
				sample,
				sampleIndex,
				wavelengthsNm,
				speciesTotals,
				sampleSpeciesOpticalDepth,
			);

			for (const [wavelengthIndex, extinctionPerKm] of extinctionByWavelength.entries()) {
				// Algorithm reference: for a piecewise-constant sample,
				// tau contribution is sigma_t(lambda) * ds.
				// Source: PBRT Transmittance; analytic-invariants weighted-samples row.
				cumulativeOpticalDepthByWavelength[wavelengthIndex] += extinctionPerKm * weightKm;
			}

			outputSamples.push({
				// Branch source: per-sample diagnostics expose cumulative optical
				// depth and transmittance at each sampled checkpoint; sampleIndex
				// falls back to array order for direct stage packets.
				// See Stage Contracts, integrateViewOpticalDepth output shape.
				sampleIndex: sample.sampleIndex ?? sampleIndex,
				distanceFromObserverKm: sample.distanceFromObserverKm,
				cumulativeOpticalDepthByWavelength: [...cumulativeOpticalDepthByWavelength],
				viewTransmittanceByWavelength: this.transmittanceFromOpticalDepth(
					cumulativeOpticalDepthByWavelength,
				),
				speciesOpticalDepth: sampleSpeciesOpticalDepth,
			});
		}

		return {
			// Branch source: this stage preserves upstream packet fields, emits
			// only viewOpticalDepth, and appends its own stage id.
			// See Stage Contracts, integrateViewOpticalDepth packet contract.
			...packet,
			viewOpticalDepth: {
				samples: outputSamples,
				pathEnd: {
					distanceFromObserverKm: this.resolvePathEndDistanceKm(packet.mediumSamples),
					cumulativeOpticalDepthByWavelength: [...cumulativeOpticalDepthByWavelength],
					viewTransmittanceByWavelength: this.transmittanceFromOpticalDepth(
						cumulativeOpticalDepthByWavelength,
					),
					speciesOpticalDepth: this.cloneSpeciesOpticalDepth(speciesTotals),
				},
			},
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
		};
	}

	/**
	 * Resolve the canonical wavelength grid for this stage.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide the stage packet.
	 * @returns {number[]}
	 */
	resolveWavelengths(packet) {
		const wavelengthsNm = packet.validatedRequest?.wavelengthsNm;

		if (!Array.isArray(wavelengthsNm)) {
			// Reason: validateRequest owns the canonical wavelength grid after request validation;
			// this stage must not read duplicate packet fields that can drift from that source.
			// Source: Reference Code Design, Stage Boundary Ownership and integrateViewOpticalDepth input shape.
			throw new Error('integrateViewOpticalDepth requires validatedRequest.wavelengthsNm');
		}

		return this.requestValidator.validateWavelengthGrid(wavelengthsNm);
	}

	/**
	 * Validate one integration sample weight.
	 *
	 * @param {number} weightKm - Provide the path-distance weight.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @returns {number}
	 */
	validateSampleWeightKm(weightKm, sampleIndex) {
		if (!Number.isFinite(weightKm)) {
			// Reason: PBRT optical depth integrates extinction over finite path length ds.
			// Source: Reference Test Design, integrateViewOpticalDepth hard invariants.
			throw new RangeError(`sample ${sampleIndex} weight must be finite`);
		}

		if (weightKm < 0) {
			// Reason: a negative path length would subtract optical depth and violate the distance integral.
			// Source: PBRT Transmittance, optical depth as integral over distance.
			throw new RangeError(`sample ${sampleIndex} weight is negative`);
		}

		return weightKm;
	}

	/**
	 * Resolve total extinction for one sample and accumulate species diagnostics.
	 *
	 * @param {AtmosphereReferenceMediumSample} sample - Provide one medium sample.
	 * @param {number} sampleIndex - Identify the sample.
	 * @param {readonly number[]} wavelengthsNm - Provide the spectral grid.
	 * @param {Record<string, { cumulativeOpticalDepthByWavelength: number[] }>} speciesTotals - Accumulate path totals.
	 * @param {Record<string, { cumulativeOpticalDepthByWavelength: number[] }>} sampleSpeciesOpticalDepth - Store sample diagnostics.
	 * @returns {number[]}
	 */
	resolveSampleExtinctionByWavelength(
		sample,
		sampleIndex,
		wavelengthsNm,
		speciesTotals,
		sampleSpeciesOpticalDepth,
	) {
		if (sample.species && sample.species.length > 0) {
			// Branch source: when evaluateMedium provides named species
			// diagnostics, this stage sums species into total extinction while
			// preserving cumulative species optical-depth diagnostics.
			// See Code Design, integrateViewOpticalDepth Contract Notes.
			const totalExtinctionByWavelength = wavelengthsNm.map(() => 0);

			for (const species of sample.species) {
				const speciesName = this.resolveSpeciesName(species, sampleIndex);
				const extinctionByWavelength = this.validateExtinctionArray(
					species?.extinctionByWavelength,
					wavelengthsNm,
					{ sampleIndex, speciesName },
				);
				const speciesTotal = this.ensureSpeciesTotal(speciesTotals, speciesName, wavelengthsNm.length);
				const sampleSpeciesTotal = [];

				for (const [wavelengthIndex, extinctionPerKm] of extinctionByWavelength.entries()) {
					// Algorithm reference: extinction is the sum of absorption and
					// out-scattering contributions, so named species contributions add
					// into the wavelength total while remaining diagnosable.
					// Source: PBRT Volume Scattering Processes and Transmittance.
					const contribution = extinctionPerKm * sample.weightKm;
					speciesTotal.cumulativeOpticalDepthByWavelength[wavelengthIndex] += contribution;
					sampleSpeciesTotal[wavelengthIndex] =
						speciesTotal.cumulativeOpticalDepthByWavelength[wavelengthIndex];
					totalExtinctionByWavelength[wavelengthIndex] += extinctionPerKm;
				}

				sampleSpeciesOpticalDepth[speciesName] = {
					cumulativeOpticalDepthByWavelength: sampleSpeciesTotal,
				};
			}

			return totalExtinctionByWavelength;
		}

		// Algorithm reference: evaluateMedium emits downstream-ready totals
		// under sample.coefficients for the canonical stage packet.
		// Source: Reference Code Design, evaluateMedium Output Shape.
		// Branch source: no species entries means the canonical total
		// extinction array is the transport input.
		// See Stage Contracts, evaluateMedium -> integrateViewOpticalDepth handoff.
		return this.validateExtinctionArray(
			sample.coefficients?.extinctionByWavelength,
			wavelengthsNm,
			{ sampleIndex, speciesName: 'total' },
		);
	}

	/**
	 * Resolve the diagnostic name for one medium species.
	 *
	 * @param {AtmosphereReferenceMediumSpecies} species - Provide one medium species entry.
	 * @param {number} sampleIndex - Identify the sample.
	 * @returns {string}
	 */
	resolveSpeciesName(species, sampleIndex) {
		if (species.name.length === 0) {
			// Reason: species optical-depth diagnostics must remain attributable after evaluateMedium
			// collapses species into total coefficients.
			// Source: Reference Code Design, evaluateMedium Output Shape and diagnostics contract.
			throw new RangeError(`sample ${sampleIndex} species must include a name`);
		}

		return species.name;
	}

	/**
	 * Validate a wavelength-aligned extinction array.
	 *
	 * @param {readonly number[] | undefined} extinctionByWavelength - Provide extinction coefficients in 1/km.
	 * @param {readonly number[]} wavelengthsNm - Provide the spectral grid.
	 * @param {{ sampleIndex: number, speciesName: string }} context - Identify the source in errors.
	 * @returns {number[]}
	 */
	validateExtinctionArray(extinctionByWavelength, wavelengthsNm, {
		sampleIndex,
		speciesName,
	}) {
		if (
			!Array.isArray(extinctionByWavelength)
			|| extinctionByWavelength.length !== wavelengthsNm.length
		) {
			// Reason: extinction arrays are wavelength-indexed; implicit broadcast/truncate would invent model data.
			// Source: Reference Code Design, spectral-array contract.
			throw new RangeError(
				`sample ${sampleIndex} ${speciesName} extinction must align to wavelengthsNm`,
			);
		}

		return extinctionByWavelength.map((extinctionPerKm, wavelengthIndex) => {
			const wavelengthNm = wavelengthsNm[wavelengthIndex];

			if (!Number.isFinite(extinctionPerKm)) {
				// Reason: non-finite coefficients make Beer-Lambert transport undefined.
				// Source: Reference Test Design, integrateViewOpticalDepth hard invariants.
				throw new RangeError(
					`sample ${sampleIndex} ${speciesName} extinction at ${wavelengthNm} nm must be finite`,
				);
			}

			if (extinctionPerKm < 0) {
				// Reason: extinction is a nonnegative attenuation rate from absorption and out-scattering.
				// Source: PBRT Volume Scattering Processes.
				throw new RangeError(
					`negative extinction for ${speciesName} at ${wavelengthNm} nm in sample ${sampleIndex}`,
				);
			}

			return extinctionPerKm;
		});
	}

	/**
	 * Ensure a species diagnostic accumulator exists.
	 *
	 * @param {Record<string, { cumulativeOpticalDepthByWavelength: number[] }>} speciesTotals - Accumulate totals.
	 * @param {string} speciesName - Identify the species.
	 * @param {number} wavelengthCount - Match the spectral grid length.
	 * @returns {{ cumulativeOpticalDepthByWavelength: number[] }}
	 */
	ensureSpeciesTotal(speciesTotals, speciesName, wavelengthCount) {
		if (!speciesTotals[speciesName]) {
			// Branch source: species totals are cumulative path diagnostics
			// initialized lazily when a species first appears.
			// See Stage Contracts, cumulative species diagnostics.
			speciesTotals[speciesName] = {
				cumulativeOpticalDepthByWavelength: Array.from({ length: wavelengthCount }, () => 0),
			};
		}

		return speciesTotals[speciesName];
	}

	/**
	 * Convert optical depth to Beer-Lambert transmittance.
	 *
	 * @param {readonly number[]} opticalDepthByWavelength - Provide optical depth values.
	 * @returns {number[]}
	 */
	transmittanceFromOpticalDepth(opticalDepthByWavelength) {
		// Algorithm reference: Beer-Lambert transmittance T(lambda) = exp(-tau(lambda)).
		// Source: PBRT Transmittance; analytic-invariants Beer-Lambert rows.
		return opticalDepthByWavelength.map((opticalDepth) => Math.exp(-opticalDepth));
	}

	/**
	 * Resolve the final diagnostic distance for the path end.
	 *
	 * @param {readonly AtmosphereReferenceMediumSample[]} mediumSamples - Provide medium samples.
	 * @returns {number}
	 */
	resolvePathEndDistanceKm(mediumSamples) {
		if (mediumSamples.length === 0) {
			// Branch source: empty transport has an explicit zero-distance path
			// end and zero optical depth, matching the no-samples packet
			// contract.
			// See analytic-invariants empty transport row.
			return 0;
		}

		const lastSample = mediumSamples[mediumSamples.length - 1];

		if (lastSample.intervalEndKm !== undefined) {
			if (!Number.isFinite(lastSample.intervalEndKm)) {
				// Reason: a supplied path-end interval endpoint is the downstream distance diagnostic;
				// non-finite distance cannot represent a physical finite transport segment.
				// Source: Reference Code Design, integrateViewOpticalDepth path-end diagnostics;
				// PBRT Transmittance defines optical depth over finite path-distance intervals.
				throw new RangeError('path end intervalEndKm must be finite');
			}

			return lastSample.intervalEndKm;
		}

		// Branch source: direct packets that predate interval endpoint handoff
		// may omit intervalEndKm; fallback keeps those packets diagnosable while
		// canonical sampleViewPath/evaluateMedium output supplies intervalEndKm.
		// See Code Design, integrateViewOpticalDepth path-end diagnostics.
		return lastSample?.distanceFromObserverKm ?? 0;
	}

	/**
	 * Clone species optical-depth diagnostics for packet output.
	 *
	 * @param {Record<string, { cumulativeOpticalDepthByWavelength: number[] }>} speciesTotals - Provide totals.
	 * @returns {Record<string, { cumulativeOpticalDepthByWavelength: number[] }>}
	 */
	cloneSpeciesOpticalDepth(speciesTotals) {
		// Branch source: clone the accumulator into packet output so downstream
		// consumers receive diagnostics, not mutable integration state.
		// See Stage Contracts, diagnostics packet ownership.
		return Object.fromEntries(
			Object.entries(speciesTotals).map(([speciesName, opticalDepth]) => [
				speciesName,
				{
					cumulativeOpticalDepthByWavelength: [
						...opticalDepth.cumulativeOpticalDepthByWavelength,
					],
				},
			]),
		);
	}
}
