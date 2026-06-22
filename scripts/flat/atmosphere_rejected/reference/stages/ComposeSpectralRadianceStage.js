/**
 * Compose final spectral radiance from transport components.
 */
export default class ComposeSpectralRadianceStage {
	/**
	 * Create the spectral-radiance composition stage helper.
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
	 * Sum transport radiance components wavelength by wavelength.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide completed transport components.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		const wavelengthsNm = this.resolveWavelengths(packet);
		const inScatteredRadianceByWavelength = this.validateComponent(
			packet.singleScattering?.inScatteredRadianceByWavelength,
			wavelengthsNm,
			'singleScattering.inScatteredRadianceByWavelength',
		);
		const surfaceViewAttenuatedRadianceByWavelength = this.validateComponent(
			packet.surfaceRadiance?.viewAttenuatedRadianceByWavelength,
			wavelengthsNm,
			'surfaceRadiance.viewAttenuatedRadianceByWavelength',
		);

		// Algorithm source: final transport spectral radiance is the
		// wavelength-aligned component sum before color conversion or display
		// tone mapping.
		// See Stage Contracts, composeSpectralRadiance ownership.
		const finalByWavelength = wavelengthsNm.map((_, index) => {
			return inScatteredRadianceByWavelength[index]
				+ surfaceViewAttenuatedRadianceByWavelength[index];
		});

		return {
			...packet,
			spectralRadiance: {
				wavelengthsNm: [...wavelengthsNm],
				finalByWavelength,
				components: {
					inScatteredRadianceByWavelength,
					surfaceViewAttenuatedRadianceByWavelength,
				},
				metadata: {
					clamped: false,
					colorConverted: false,
				},
			},
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
		};
	}

	/**
	 * Resolve wavelength grid.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide packet.
	 * @returns {readonly number[]}
	 */
	resolveWavelengths(packet) {
		const wavelengthsNm = packet.validatedRequest?.wavelengthsNm;

		if (!Array.isArray(wavelengthsNm) || wavelengthsNm.length === 0) {
			// Reason: component composition is wavelength-aligned.
			// Source: Stage Contracts, composeSpectralRadiance input contract.
			throw new Error('composeSpectralRadiance requires validatedRequest.wavelengthsNm');
		}

		return wavelengthsNm;
	}

	/**
	 * Validate one wavelength-aligned radiance component.
	 *
	 * @param {unknown} values - Provide candidate component.
	 * @param {readonly number[]} wavelengthsNm - Provide wavelengths.
	 * @param {string} label - Identify component.
	 * @returns {number[]}
	 */
	validateComponent(values, wavelengthsNm, label) {
		if (!Array.isArray(values) || values.length !== wavelengthsNm.length) {
			// Reason: component arrays must align one-to-one with wavelengths before summation.
			// Source: Stage Contracts, composeSpectralRadiance wavelength mismatch policy.
			throw new RangeError(`composeSpectralRadiance ${label} must align to wavelengthsNm`);
		}

		return values.map((value) => {
			if (!Number.isFinite(value)) {
				throw new RangeError(`composeSpectralRadiance ${label} must be finite`);
			}

			if (value < 0) {
				// Reason: physical radiance components are nonnegative and should fail before display clamping.
				// Source: Stage Contracts, composeSpectralRadiance ownership.
				throw new RangeError(`composeSpectralRadiance ${label} is negative`);
			}

			return value;
		});
	}

}
