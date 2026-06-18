const DEFAULT_DIFFUSE_SKY_AIRLIGHT_STRENGTH = 0;
const ACTIVATION_TAU_MIN = 1;
const ACTIVATION_TAU_MAX = 8;
const AEROSOL_NEUTRAL_MIX_MAX = 0.6;
const AEROSOL_MULTIPLE_SCATTER_GAIN = 1.5;
const DIAGNOSTIC_CONTRACT = Object.freeze({
	transportOrder: 'higher-order-surrogate',
	bounded: true,
	calibrationStatus: 'uncalibrated-reference-proxy',
	approximationWarning: 'diagnostic approximation; not a full multiple-scattering solver',
});

/**
 * Integrate a named diagnostic diffuse-sky-airlight approximation.
 */
export default class IntegrateDiffuseSkyAirlightStage {
	/**
	 * Create the diffuse-sky-airlight approximation stage helper.
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
	 * Add an explicit high-tau sky-airlight approximation without rewriting canonical single scattering.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide prepared transport diagnostics.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		const wavelengthsNm = this.resolveWavelengths(packet);
		const strength = this.resolveStrength(packet);
		const canonicalSingleScatteringByWavelength = this.validateNonnegativeArray(
			packet.singleScattering?.inScatteredRadianceByWavelength,
			wavelengthsNm,
			'singleScattering.inScatteredRadianceByWavelength',
		);
		const viewOpticalDepthByWavelength = this.validateNonnegativeArray(
			packet.viewOpticalDepth?.pathEnd?.cumulativeOpticalDepthByWavelength,
			wavelengthsNm,
			'viewOpticalDepth.pathEnd.cumulativeOpticalDepthByWavelength',
		);
		const viewTransmittanceByWavelength = this.validateTransmittanceArray(
			packet.viewOpticalDepth?.pathEnd?.viewTransmittanceByWavelength,
			wavelengthsNm,
			'viewOpticalDepth.pathEnd.viewTransmittanceByWavelength',
		);
		const aerosolOpticalDepthByWavelength = this.resolveAerosolOpticalDepth(packet, wavelengthsNm);
		const aerosolOpticalDepthFractionByWavelength = aerosolOpticalDepthByWavelength.map((value, index) => {
			const total = viewOpticalDepthByWavelength[index];
			return total === 0 ? 0 : value / total;
		});
		const sourceSpectrumByWavelength = this.resolveSourceSpectrum(packet, wavelengthsNm);
		const neutralSourceSpectrum = this.mean(sourceSpectrumByWavelength);
		const activationTau = Math.max(...viewOpticalDepthByWavelength);
		const activation = this.smoothstep(ACTIVATION_TAU_MIN, ACTIVATION_TAU_MAX, activationTau);
		const lostViewTransmittanceByWavelength = viewTransmittanceByWavelength.map((value) => 1 - value);
		const aerosolSaturationByWavelength = aerosolOpticalDepthByWavelength.map((value) => {
			return 1 - Math.exp(-value);
		});
		const aerosolParticipationByWavelength = aerosolOpticalDepthFractionByWavelength.map((fraction, index) => {
			return fraction * aerosolSaturationByWavelength[index];
		});
		const neutralMixByWavelength = aerosolParticipationByWavelength.map((value) => {
			return Math.min(AEROSOL_NEUTRAL_MIX_MAX, value);
		});
		const aerosolGainByWavelength = aerosolParticipationByWavelength.map((value) => {
			return 1 + AEROSOL_MULTIPLE_SCATTER_GAIN * value;
		});

		// Algorithm source: diffuse-sky-airlight-contracts rows
		// diffuse-sky-airlight.high-tau.*. PBRT volume scattering integrators
		// justify a separate transport-order component; Beer-Lambert
		// transmittance supplies the surviving direct-view fraction; Bruneton
		// 2016 and libRadtran motivate an aerosol-aware bounded approximation
		// for high-tau diffuse sky radiance until full multiple scattering is
		// calibrated.
		const radianceByWavelength = wavelengthsNm.map((_, index) => {
			const neutralMix = neutralMixByWavelength[index];
			const veilSource = sourceSpectrumByWavelength[index] * (1 - neutralMix)
				+ neutralSourceSpectrum * neutralMix;
			const value = veilSource
				* lostViewTransmittanceByWavelength[index]
				* activation
				* strength
				* aerosolGainByWavelength[index];

			return this.validateNonnegativeFinite(value, 'radianceByWavelength');
		});
		const renderedSinglePlusSkyAirlightByWavelength = canonicalSingleScatteringByWavelength.map((value, index) => {
			return value + radianceByWavelength[index];
		});

		return {
			...packet,
			diffuseSkyAirlight: {
				mode: 'aerosol-aware-lost-transmittance-haze-lift',
				radianceByWavelength,
				renderedSinglePlusSkyAirlightByWavelength,
				diagnostics: {
					contract: { ...DIAGNOSTIC_CONTRACT },
					activation,
					activationTau,
					activationPolicy: `smoothstep(${ACTIVATION_TAU_MIN}, ${ACTIVATION_TAU_MAX}, maxVisibleTau)`,
					strength,
					aerosolOpticalDepthByWavelength,
					aerosolOpticalDepthFractionByWavelength,
					maxAerosolOpticalDepth: Math.max(...aerosolOpticalDepthByWavelength),
					aerosolSaturationByWavelength,
					aerosolParticipationByWavelength,
					neutralSourceSpectrum,
					neutralMixByWavelength,
					aerosolGainByWavelength,
					aerosolPolicy: {
						neutralMixMax: AEROSOL_NEUTRAL_MIX_MAX,
						multipleScatterGain: AEROSOL_MULTIPLE_SCATTER_GAIN,
					},
					tauRegime: this.classifyTauRegime(activationTau),
					flatGeometryLimitPolicy: 'bounded-asymptotic-required',
					lostViewTransmittanceByWavelength,
					sourceSpectrumByWavelength,
					canonicalSingleScatteringByWavelength,
					approximationWarning: DIAGNOSTIC_CONTRACT.approximationWarning,
				},
			},
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
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
			// Reason: the approximation is wavelength-aligned with upstream optical-depth and radiance packets.
			// Source: Stage Contracts, integrateDiffuseSkyAirlight input contract.
			throw new Error('integrateDiffuseSkyAirlight requires validatedRequest.wavelengthsNm');
		}

		return wavelengthsNm;
	}

	/**
	 * Resolve the nonnegative diagnostic strength.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide packet.
	 * @returns {number}
	 */
	resolveStrength(packet) {
		const value = packet.validatedRequest?.numerical?.diffuseSkyAirlightStrength
			?? DEFAULT_DIFFUSE_SKY_AIRLIGHT_STRENGTH;

		if (!Number.isFinite(value) || value < 0) {
			// Reason: the approximation strength is a scale on added radiance; negative values would subtract light.
			// Source: diffuse-sky-airlight-contracts row contract for nonnegative strength.
			throw new RangeError('integrateDiffuseSkyAirlight diffuseSkyAirlightStrength must be nonnegative finite');
		}

		return value;
	}

	/**
	 * Resolve optional aerosol/Mie optical depth diagnostics from the view path.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide packet.
	 * @param {readonly number[]} wavelengthsNm - Provide wavelength grid.
	 * @returns {number[]}
	 */
	resolveAerosolOpticalDepth(packet, wavelengthsNm) {
		const speciesOpticalDepth = packet.viewOpticalDepth?.pathEnd?.speciesOpticalDepth;
		const mieOpticalDepth = speciesOpticalDepth?.mie?.cumulativeOpticalDepthByWavelength;

		if (mieOpticalDepth === undefined || mieOpticalDepth === null) {
			return wavelengthsNm.map(() => 0);
		}

		return this.validateNonnegativeArray(
			mieOpticalDepth,
			wavelengthsNm,
			'viewOpticalDepth.pathEnd.speciesOpticalDepth.mie.cumulativeOpticalDepthByWavelength',
		);
	}

	/**
	 * Resolve the first visible source spectrum used by this diagnostic proxy.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide packet.
	 * @param {readonly number[]} wavelengthsNm - Provide wavelength grid.
	 * @returns {number[]}
	 */
	resolveSourceSpectrum(packet, wavelengthsNm) {
		for (const sample of packet.solarTransmittance?.samples ?? []) {
			for (const sourceSample of sample.sourceSamples ?? []) {
				if (sourceSample.visible === false) {
					continue;
				}

				return this.validateNonnegativeArray(
					sourceSample.sourceSpectrum?.valuesByWavelength,
					wavelengthsNm,
					'solarTransmittance sourceSpectrum.valuesByWavelength',
				);
			}
		}

		// Reason: no visible source means this diagnostic has no source energy to redistribute.
		// Source: Stage Contracts, integrateDiffuseSkyAirlight consumes solarTransmittance source energy.
		return wavelengthsNm.map(() => 0);
	}

	/**
	 * Compute a neutral source spectrum anchor for the haze veil proxy.
	 *
	 * @param {readonly number[]} values - Provide wavelength-aligned source values.
	 * @returns {number}
	 */
	mean(values) {
		if (values.length === 0) {
			return 0;
		}

		return values.reduce((sum, value) => sum + value, 0) / values.length;
	}

	/**
	 * Classify the total visible optical-depth regime for diagnostics.
	 *
	 * @param {number} maxTau - Provide maximum total view optical depth.
	 * @returns {string}
	 */
	classifyTauRegime(maxTau) {
		if (!Number.isFinite(maxTau) || maxTau < 0) {
			throw new RangeError('integrateDiffuseSkyAirlight maxTau must be nonnegative finite');
		}

		if (maxTau < 0.1) {
			return 'optically-thin';
		}

		if (maxTau < 1) {
			return 'moderate';
		}

		if (maxTau < 5) {
			return 'thick';
		}

		if (maxTau < 10) {
			return 'single-scattering-warning';
		}

		return 'extreme-horizon-path';
	}

	/**
	 * Smoothly activate between two optical-depth thresholds.
	 *
	 * @param {number} edge0 - Provide lower activation edge.
	 * @param {number} edge1 - Provide upper activation edge.
	 * @param {number} value - Provide optical-depth value.
	 * @returns {number}
	 */
	smoothstep(edge0, edge1, value) {
		if (!Number.isFinite(value) || value < 0) {
			// Reason: activation is based on physical optical depth, which is nonnegative.
			// Source: PBRT Transmittance and Stage Contracts, integrateViewOpticalDepth output contract.
			throw new RangeError('integrateDiffuseSkyAirlight activationTau must be nonnegative finite');
		}

		const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));

		return t * t * (3 - 2 * t);
	}

	/**
	 * Validate wavelength-aligned nonnegative finite values.
	 *
	 * @param {unknown} values - Provide candidate array.
	 * @param {readonly number[]} wavelengthsNm - Provide wavelengths.
	 * @param {string} label - Identify values.
	 * @returns {number[]}
	 */
	validateNonnegativeArray(values, wavelengthsNm, label) {
		if (!Array.isArray(values) || values.length !== wavelengthsNm.length) {
			// Reason: spectral proxy factors multiply wavelength by wavelength.
			// Source: Stage Contracts, integrateDiffuseSkyAirlight wavelength alignment.
			throw new RangeError(`integrateDiffuseSkyAirlight ${label} must align to wavelengthsNm`);
		}

		return values.map((value) => this.validateNonnegativeFinite(value, label));
	}

	/**
	 * Validate wavelength-aligned transmittance values.
	 *
	 * @param {unknown} values - Provide candidate array.
	 * @param {readonly number[]} wavelengthsNm - Provide wavelengths.
	 * @param {string} label - Identify values.
	 * @returns {number[]}
	 */
	validateTransmittanceArray(values, wavelengthsNm, label) {
		const result = this.validateNonnegativeArray(values, wavelengthsNm, label);

		for (const value of result) {
			if (value > 1) {
				// Reason: Beer-Lambert transmittance is a surviving fraction in [0, 1].
				// Source: PBRT Transmittance and Stage Contracts, integrateViewOpticalDepth ownership.
				throw new RangeError(`integrateDiffuseSkyAirlight ${label} must be <= 1`);
			}
		}

		return result;
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
			// Reason: radiance, source energy, optical depth, and lost-light factors are nonnegative physical quantities.
			// Source: PBRT Volume Scattering Integrators and diffuse-sky-airlight-contracts fixture derivations.
			throw new RangeError(`integrateDiffuseSkyAirlight ${label} must be nonnegative finite`);
		}

		return value;
	}
}
