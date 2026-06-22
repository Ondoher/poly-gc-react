// Numerical policy source: ECMAScript numbers are binary64 values, while
// toPrecision controls decimal significant-digit formatting. These constants
// are local reviewability policies for duplicate-sum comparisons and stable
// fixture-facing sums, not physical atmosphere tolerances.
// See Reference Decision Log, evaluateMedium Numerical Policy Source Map.
const EVALUATE_MEDIUM_DUPLICATE_SUM_TOLERANCE = 1e-12;
const EVALUATE_MEDIUM_REVIEW_SIGNIFICANT_DIGITS = 15;

/**
 * Evaluate atmosphere density and coefficients at view samples.
 */
export default class EvaluateMediumStage {
	/**
	 * Create the evaluateMedium stage helper.
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
	 * Evaluate model-owned medium state at each sampled view position.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide sampled view data.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		const viewSamples = this.validateViewSamples(packet.viewSamples);
		const wavelengthsNm = this.resolveWavelengths(packet);
		const { model, observer, ray } = this.resolveTransportInputs(packet);

		// Algorithm reference: evaluateMedium is a packet transform over already
		// sampled ray positions. It does not choose samples or integrate optical
		// depth; it evaluates medium state at each sample.
		// Source: Reference Code Design, evaluateMedium Output Shape.
		const mediumSamples = viewSamples.map((sample, fallbackIndex) => {
			return this.evaluateSample({
				model,
				observer,
				ray,
				wavelengthsNm,
				sample,
				fallbackIndex,
			});
		});

		return {
			...packet,
			mediumSamples,
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
		};
	}

	/**
	 * Evaluate one view sample.
	 *
	 * @param {{ model: AtmosphereReferenceModel, observer: AtmosphereReferenceObserver, ray: AtmosphereReferenceRay, wavelengthsNm: readonly number[], sample: AtmosphereReferenceViewSample, fallbackIndex: number }} options - Provide sample context.
	 * @returns {AtmosphereReferenceMediumSample}
	 */
	evaluateSample({
		model,
		observer,
		ray,
		wavelengthsNm,
		sample,
		fallbackIndex,
	}) {
		const sampleIndex = this.resolveSampleIndex(sample, fallbackIndex);
		const positionKm = this.evaluateRayPositionKm(observer, ray, sample, sampleIndex);
		const world = this.resolveWorldModel(model);
		const altitudeKm = this.resolveAltitudeKm(world, positionKm, sampleIndex);
		const atmosphere = this.resolveAtmosphereModel(model);

		if (
			typeof atmosphere.contains === 'function'
			&& atmosphere.contains(positionKm, sample) === false
		) {
			// Branch source: the atmosphere adapter owns volume membership.
			// Outside-volume samples are explicit nonparticipating medium samples,
			// so PBRT volume-process semantics require zero coefficients.
			// See Reference Decision Log, evaluateMedium Implementation Branch Source Map.
			return this.createMediumSample({
				sample,
				sampleIndex,
				positionKm,
				altitudeKm,
				mediumState: { contains: false },
				coefficients: this.createZeroCoefficients(wavelengthsNm, 'outside-atmosphere-vacuum'),
				species: [],
			});
		}

		const mediumState = this.lookupMediumState(atmosphere, positionKm, wavelengthsNm, sample);

		if (mediumState?.vacuum || mediumState?.contains === false) {
			// Branch source: model-declared vacuum or outside-volume medium state
			// is valid only when it does not also report nonzero coefficients.
			// See Code Design, evaluateMedium Contract Notes.
			this.validateVacuumMediumState(mediumState, wavelengthsNm, sampleIndex);

			return this.createMediumSample({
				sample,
				sampleIndex,
				positionKm,
				altitudeKm,
				mediumState,
				coefficients: this.createZeroCoefficients(
					wavelengthsNm,
					mediumState?.contains === false ? 'outside-atmosphere-vacuum' : 'vacuum',
				),
				species: [],
			});
		}

		const species = this.validateSpecies(mediumState?.species, wavelengthsNm, sampleIndex);
		const coefficients = this.resolveCoefficients(
			mediumState?.coefficients,
			species,
			wavelengthsNm,
			sampleIndex,
		);

		return this.createMediumSample({
			sample,
			sampleIndex,
			positionKm,
			altitudeKm,
			mediumState,
			coefficients,
			species,
		});
	}

	/**
	 * Create one medium sample from view sample and model-owned medium state.
	 *
	 * @param {{ sample: AtmosphereReferenceViewSample, sampleIndex: number, positionKm: AtmosphereReferenceVector3Tuple, altitudeKm: number, mediumState: AtmosphereReferenceMediumState, coefficients: AtmosphereReferenceResolvedMediumCoefficients, species?: AtmosphereReferenceMediumSpecies[] }} options - Provide sample data.
	 * @returns {AtmosphereReferenceMediumSample}
	 */
	createMediumSample({
		sample,
		sampleIndex,
		positionKm,
		altitudeKm,
		mediumState,
		coefficients,
		species,
	}) {
		/** @type {AtmosphereReferenceMediumSample} */
		const mediumSample = {
			// Branch source: evaluateMedium preserves view-sample integration
			// fields because downstream transport consumes the same distances and
			// weights without re-querying sampleViewPath.
			// See Stage Contracts, evaluateMedium downstream handoff.
			sampleIndex,
			distanceFromObserverKm: sample.distanceFromObserverKm,
			weightKm: sample.weightKm,
			intervalStartKm: sample.intervalStartKm,
			intervalEndKm: sample.intervalEndKm,
			integrationMethod: sample.integrationMethod,
			positionKm,
			altitudeKm,
		};

		if (mediumState?.profile !== undefined) {
			// Branch source: profile diagnostics are model-owned optional data.
			// Preserve them only after validating fields this stage exposes.
			// See Code Design, evaluateMedium profile diagnostics.
			mediumSample.profile = this.validateProfile(mediumState.profile, sampleIndex);
		}

		mediumSample.coefficients = coefficients;

		if (species !== undefined) {
			// Branch source: species diagnostics are optional, but when supplied
			// they are preserved for later scattering diagnostics while totals are
			// derived for transport.
			// See Reference Decision Log, evaluateMedium Implementation Branch Source Map.
			mediumSample.species = species;
		}

		return mediumSample;
	}

	/**
	 * Evaluate the model-space position for one sample.
	 *
	 * @param {AtmosphereReferenceObserver} observer - Provide validated observer data.
	 * @param {AtmosphereReferenceRay} ray - Provide validated ray data.
	 * @param {AtmosphereReferenceViewSample} sample - Provide the view sample.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @returns {AtmosphereReferenceVector3Tuple}
	 */
	evaluateRayPositionKm(observer, ray, sample, sampleIndex) {
		const distanceFromObserverKm = this.validateFiniteNumber(
			sample.distanceFromObserverKm,
			`sample ${sampleIndex} distanceFromObserverKm`,
		);

		// Algorithm reference: PBRT Rays define positions parametrically as
		// r(t) = origin + t * direction. validateRequest canonicalizes direction
		// to unit length so t remains a kilometer distance.
		return /** @type {AtmosphereReferenceVector3Tuple} */ (
			observer.positionKm.map((component, axisIndex) => {
				return component + ray.direction[axisIndex] * distanceFromObserverKm;
			})
		);
	}

	/**
	 * Resolve total coefficients from model totals or species/component data.
	 *
	 * @param {AtmosphereReferenceMediumCoefficients | undefined} modelCoefficients - Provide model-owned total coefficients.
	 * @param {AtmosphereReferenceMediumSpecies[] | undefined} species - Provide model-owned species data.
	 * @param {readonly number[]} wavelengthsNm - Provide the active wavelength grid.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @returns {{ extinctionByWavelength: number[], scatteringByWavelength: number[], absorptionByWavelength: number[], derivation: string }}
	 */
	resolveCoefficients(modelCoefficients, species, wavelengthsNm, sampleIndex) {
		if (species && species.length > 0) {
			// Algorithm reference: participating-media contributors add
			// wavelength by wavelength, while species diagnostics remain present.
			// Source: PBRT Volume Scattering Processes; Reference Code Design
			// coefficient precedence.
			return this.sumSpeciesCoefficients(species, wavelengthsNm, sampleIndex);
		}

		if (!modelCoefficients) {
			// Branch source: with no species and no model totals, this stage has
			// no participating-medium coefficients to consume, so it emits the
			// explicit vacuum arrays required by the packet contract.
			// See Stage Contracts, evaluateMedium; PBRT Volume Scattering Processes.
			return this.createZeroCoefficients(wavelengthsNm, 'vacuum');
		}

		const scatteringByWavelength = this.validateOptionalCoefficientArray(
			modelCoefficients.scatteringByWavelength,
			wavelengthsNm,
			{ sampleIndex, coefficientName: 'scattering' },
		);
		const absorptionByWavelength = this.validateOptionalCoefficientArray(
			modelCoefficients.absorptionByWavelength,
			wavelengthsNm,
			{ sampleIndex, coefficientName: 'absorption' },
		);
		const directExtinctionByWavelength = this.validateOptionalCoefficientArray(
			modelCoefficients.extinctionByWavelength,
			wavelengthsNm,
			{ sampleIndex, coefficientName: 'extinction' },
		);

		if (!directExtinctionByWavelength && scatteringByWavelength && absorptionByWavelength) {
			// Algorithm reference: extinction is absorption plus out-scattering.
			// Source: PBRT Volume Scattering Processes; Reference Code Design
			// coefficient precedence.
			return {
				extinctionByWavelength: this.addCoefficientArrays(
					scatteringByWavelength,
					absorptionByWavelength,
				),
				scatteringByWavelength,
				absorptionByWavelength,
				derivation: 'absorption-plus-scattering',
			};
		}

		if (!directExtinctionByWavelength) {
			// Branch source: downstream transport requires total extinction.
			// Without direct extinction or an absorption+scattering derivation,
			// accepting the sample would invent model data.
			// See Code Design, coefficient precedence.
			throw new RangeError(
				`evaluateMedium sample ${sampleIndex} extinction must align to wavelengthsNm`,
			);
		}

		const resolvedScatteringByWavelength = scatteringByWavelength
			?? wavelengthsNm.map(() => 0);
		const resolvedAbsorptionByWavelength = absorptionByWavelength
			?? wavelengthsNm.map(() => 0);

		if (scatteringByWavelength && absorptionByWavelength) {
			// Branch source: duplicate direct extinction and derived extinction
			// must agree because they describe the same physical total
			// sigma_t = sigma_a + sigma_s.
			// See PBRT Volume Scattering Processes; Code Design, coefficient precedence.
			this.validateExtinctionConsistency(
				directExtinctionByWavelength,
				this.addCoefficientArrays(scatteringByWavelength, absorptionByWavelength),
				sampleIndex,
			);
		}

		return {
			// Branch source: direct model totals are accepted when they are the
			// only available total-extinction source or agree with supplied
			// absorption/scattering components.
			// See Reference Decision Log, evaluateMedium Implementation Branch Source Map.
			extinctionByWavelength: directExtinctionByWavelength,
			scatteringByWavelength: resolvedScatteringByWavelength,
			absorptionByWavelength: resolvedAbsorptionByWavelength,
			derivation: 'direct-model-totals',
		};
	}

	/**
	 * Sum species/component coefficient arrays into totals.
	 *
	 * @param {readonly AtmosphereReferenceMediumSpecies[]} species - Provide validated species data.
	 * @param {readonly number[]} wavelengthsNm - Provide the active wavelength grid.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @returns {{ extinctionByWavelength: number[], scatteringByWavelength: number[], absorptionByWavelength: number[], derivation: string }}
	 */
	sumSpeciesCoefficients(species, wavelengthsNm, sampleIndex) {
		const totals = {
			extinctionByWavelength: wavelengthsNm.map(() => 0),
			scatteringByWavelength: wavelengthsNm.map(() => 0),
			absorptionByWavelength: wavelengthsNm.map(() => 0),
			derivation: 'species-sum',
		};

		for (const speciesEntry of species) {
			for (const coefficientName of [
				'extinctionByWavelength',
				'scatteringByWavelength',
				'absorptionByWavelength',
			]) {
				const readableName = coefficientName.replace('ByWavelength', '');
				const coefficients = this.validateCoefficientArray(
					speciesEntry?.[coefficientName],
					wavelengthsNm,
					{
						sampleIndex,
						coefficientName: readableName,
						speciesName: speciesEntry?.name ?? 'species',
					},
				);

				totals[coefficientName] = this.addCoefficientArrays(
					totals[coefficientName],
					coefficients,
				);
			}
		}

		return totals;
	}

	/**
	 * Validate species diagnostics while preserving model-owned fields.
	 *
	 * @param {readonly AtmosphereReferenceMediumSpecies[] | undefined} species - Provide species data.
	 * @param {readonly number[]} wavelengthsNm - Provide the active wavelength grid.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @returns {AtmosphereReferenceMediumSpecies[] | undefined}
	 */
	validateSpecies(species, wavelengthsNm, sampleIndex) {
		if (species === undefined) {
			// Branch source: species diagnostics are optional model-owned data;
			// missing species should not invent a species list.
			// See Code Design, evaluateMedium Output Shape.
			return undefined;
		}

		return species.map((speciesEntry) => {
			// Branch source: preserve model-owned species metadata while
			// validating every coefficient array consumed by downstream stages.
			// See Stage Contracts, evaluateMedium species diagnostics.
			const nextSpeciesEntry = { ...speciesEntry };

			for (const coefficientName of [
				'extinctionByWavelength',
				'scatteringByWavelength',
				'absorptionByWavelength',
			]) {
				const readableName = coefficientName.replace('ByWavelength', '');
				nextSpeciesEntry[coefficientName] = this.validateCoefficientArray(
					speciesEntry?.[coefficientName],
					wavelengthsNm,
					{
						sampleIndex,
						coefficientName: readableName,
						speciesName: speciesEntry?.name ?? 'species',
					},
				);
			}

			return nextSpeciesEntry;
		});
	}

	/**
	 * Validate profile diagnostics when the model supplies them.
	 *
	 * @param {AtmosphereReferenceMediumProfile} profile - Provide model-owned profile data.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @returns {AtmosphereReferenceMediumProfile}
	 */
	validateProfile(profile, sampleIndex) {
		const nextProfile = structuredClone(profile);

		if (Object.prototype.hasOwnProperty.call(profile, 'densityKgPerM3')) {
			const densityKgPerM3 = profile.densityKgPerM3;
			if (
				typeof densityKgPerM3 !== 'number'
				|| !Number.isFinite(densityKgPerM3)
				|| densityKgPerM3 < 0
			) {
				// Reason: density diagnostics exposed to downstream reports must be
				// finite and nonnegative.
				// Source: Reference Code Design, evaluateMedium Output Shape and
				// medium.invalid.density-rejects fixture.
				throw new RangeError(
					`evaluateMedium sample ${sampleIndex} density must be nonnegative finite`,
				);
			}
		}

		if (Object.prototype.hasOwnProperty.call(profile, 'composition')) {
			// Branch source: composition is optional diagnostic model data, but
			// once exposed downstream it must be finite unit-fraction accounting,
			// not a value later reports need to repair.
			// See Code Design, Stage validation ownership.
			nextProfile.composition = this.validateComposition(
				profile.composition,
				sampleIndex,
			);
		}

		return nextProfile;
	}

	/**
	 * Validate composition diagnostics when the profile supplies them.
	 *
	 * @param {AtmosphereReferenceCompositionDiagnostics} composition - Provide profile composition diagnostics.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @returns {AtmosphereReferenceCompositionDiagnostics}
	 */
	validateComposition(composition, sampleIndex) {
		const nextComposition = structuredClone(composition);

		if (Object.prototype.hasOwnProperty.call(composition, 'fractions')) {
			const fractions = composition.fractions;

			if (!fractions || typeof fractions !== 'object' || Array.isArray(fractions)) {
				// Branch source: composition fractions are keyed diagnostics, not
				// positional arrays; accepting other shapes would make species
				// identity ambiguous.
				// See Stage Contracts, diagnostics consume composition data.
				throw new RangeError(
					`evaluateMedium sample ${sampleIndex} composition fractions must be an object`,
				);
			}

			let listedSum = 0;

			for (const [speciesName, fraction] of Object.entries(fractions)) {
				if (
					typeof fraction !== 'number'
					|| !Number.isFinite(fraction)
					|| fraction < 0
					|| fraction > 1
				) {
					// Reason: fractional-volume composition entries consumed by
					// evaluateMedium must be finite fractions inside [0, 1].
					// Source: Reference Code Design, Stage validation ownership;
					// NASA U.S. Standard Atmosphere 1976 Table 3 positive examples.
					throw new RangeError(
						`evaluateMedium sample ${sampleIndex} composition ${speciesName} must be a finite fraction`,
					);
				}

				listedSum += fraction;
			}

			if (listedSum > 1 + EVALUATE_MEDIUM_DUPLICATE_SUM_TOLERANCE) {
				// Branch source: listed fractional-volume entries cannot account
				// for more than the whole mixture; this rejects malformed model
				// data instead of normalizing it.
				// Numerical policy: the tolerance only absorbs binary64 addition
				// noise from recomputing a duplicate sum.
				// See Code Design, composition no-repair policy.
				throw new RangeError(
					`evaluateMedium sample ${sampleIndex} composition listed fractions must not exceed one`,
				);
			}

			if (Object.prototype.hasOwnProperty.call(composition, 'listedFractionSum')) {
				// Branch source: a supplied listedFractionSum is duplicate model
				// accounting and must match the listed entries it summarizes.
				// See Reference Decision Log, evaluateMedium Implementation Branch Source Map.
				this.validateUnitFraction(
					composition.listedFractionSum,
					sampleIndex,
					'composition listedFractionSum',
				);

				if (
					Math.abs(listedSum - composition.listedFractionSum)
					> EVALUATE_MEDIUM_DUPLICATE_SUM_TOLERANCE
				) {
					// Numerical policy: compare duplicate composition sums with a
					// small absolute tolerance because the stage recomputes the
					// listed sum from binary64 inputs before checking model-supplied
					// accounting. This tolerance is not a physical composition error
					// allowance.
					// See Reference Decision Log, evaluateMedium Numerical Policy Source Map.
					throw new RangeError(
						`evaluateMedium sample ${sampleIndex} composition listedFractionSum must equal listed fractions`,
					);
				}
			}
		}

		const hasListedFractionSum = Object.prototype.hasOwnProperty.call(
			composition,
			'listedFractionSum',
		);
		const hasUnlistedResidual = Object.prototype.hasOwnProperty.call(
			composition,
			'unlistedResidual',
		);

		if (hasListedFractionSum) {
			// Branch source: listedFractionSum is optional, but if supplied it is
			// a dimensionless mixture fraction and must stay inside [0, 1].
			// See Code Design, profile composition diagnostics.
			this.validateUnitFraction(
				composition.listedFractionSum,
				sampleIndex,
				'composition listedFractionSum',
			);
		}

		if (hasUnlistedResidual) {
			// Branch source: unlistedResidual is optional explicit accounting for
			// omitted species and must also be a valid unit fraction.
			// See NASA U.S. Standard Atmosphere Table 3 fixture provenance and Code Design.
			this.validateUnitFraction(
				composition.unlistedResidual,
				sampleIndex,
				'composition unlistedResidual',
			);
		}

		if (
			hasListedFractionSum
			&& hasUnlistedResidual
			&& Math.abs(composition.listedFractionSum + composition.unlistedResidual - 1)
				> EVALUATE_MEDIUM_DUPLICATE_SUM_TOLERANCE
		) {
			// Reason: when a model supplies both a listed composition sum and a
			// residual, evaluateMedium consumes that accounting and validates it
			// rather than normalizing or repairing it.
			// Numerical policy: the tolerance only absorbs binary64 addition
			// noise from adding two duplicate accounting fields.
			// Source: Reference Code Design, Stage validation ownership;
			// medium.extreme.composition.invalid-fraction-boundaries fixture.
			throw new RangeError(
				`evaluateMedium sample ${sampleIndex} composition listed sum and residual must account for one`,
			);
		}

		return nextComposition;
	}

	/**
	 * Validate one dimensionless unit fraction.
	 *
	 * @param {number} value - Provide the fraction.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @param {string} label - Identify the field in errors.
	 * @returns {number}
	 */
	validateUnitFraction(value, sampleIndex, label) {
		if (
			!Number.isFinite(value)
			|| value < 0
			|| value > 1
		) {
			// Branch source: profile composition diagnostics use dimensionless
			// unit fractions; non-finite or out-of-range values are malformed
			// model data consumed at this stage boundary.
			// See Code Design, evaluateMedium Contract Notes.
			throw new RangeError(
				`evaluateMedium sample ${sampleIndex} ${label} must be a finite fraction`,
			);
		}

		return value;
	}

	/**
	 * Validate a vacuum/no-medium response before replacing coefficients with zeros.
	 *
	 * @param {AtmosphereReferenceMediumState} mediumState - Provide the model-owned medium state.
	 * @param {readonly number[]} wavelengthsNm - Provide the active wavelength grid.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @returns {void}
	 */
	validateVacuumMediumState(mediumState, wavelengthsNm, sampleIndex) {
		const coefficients = mediumState?.coefficients;

		if (!coefficients) {
			// Branch source: a vacuum marker without coefficient diagnostics is
			// already unambiguous, so this validation has nothing to reconcile.
			// See Stage Contracts, valid vacuum samples emit zero arrays.
			return;
		}

		for (const coefficientName of [
			'extinctionByWavelength',
			'scatteringByWavelength',
			'absorptionByWavelength',
		]) {
			if (!Object.prototype.hasOwnProperty.call(coefficients, coefficientName)) {
				// Branch source: absent optional coefficient arrays do not
				// contradict the vacuum marker; supplied arrays are checked below.
				// See Code Design, optional diagnostics policy.
				continue;
			}

			const readableName = coefficientName.replace('ByWavelength', '');
			const coefficientValues = this.validateCoefficientArray(
				coefficients[coefficientName],
				wavelengthsNm,
				{ sampleIndex, coefficientName: readableName },
			);

			if (coefficientValues.some((value) => value !== 0)) {
				// Reason: PBRT's participating-medium vocabulary gives vacuum no
				// absorption, scattering, or extinction. A stage owns validation
				// of consumed model data, so contradictory vacuum coefficients
				// reject instead of being silently zeroed.
				// Source: PBRT Volume Scattering Processes; Reference Code
				// Design, Stage validation ownership.
				throw new RangeError(
					`evaluateMedium sample ${sampleIndex} vacuum coefficients must be zero`,
				);
			}
		}
	}

	/**
	 * Create wavelength-aligned zero coefficient arrays.
	 *
	 * @param {readonly number[]} wavelengthsNm - Provide the active wavelength grid.
	 * @param {string} derivation - Identify why the sample is zero.
	 * @returns {AtmosphereReferenceResolvedMediumCoefficients}
	 */
	createZeroCoefficients(wavelengthsNm, derivation) {
		// Algorithm reference: no participating medium means no absorption,
		// scattering, or extinction at any wavelength.
		// Source: PBRT Volume Scattering Processes; Reference Code Design
		// coefficient precedence for vacuum samples.
		const zeroes = wavelengthsNm.map(() => 0);

		return {
			extinctionByWavelength: [...zeroes],
			scatteringByWavelength: [...zeroes],
			absorptionByWavelength: [...zeroes],
			derivation,
		};
	}

	/**
	 * Validate one required coefficient array.
	 *
	 * @param {readonly number[]} coefficients - Provide coefficient data.
	 * @param {readonly number[]} wavelengthsNm - Provide the active wavelength grid.
	 * @param {{ sampleIndex: number, coefficientName: string, speciesName?: string }} context - Identify errors.
	 * @returns {number[]}
	 */
	validateCoefficientArray(coefficients, wavelengthsNm, context) {
		if (coefficients.length !== wavelengthsNm.length) {
			// Reason: coefficient arrays are wavelength-indexed; implicit
			// broadcast, truncation, or padding would invent model data.
			// Source: Reference Code Design spectral-array contract.
			throw new RangeError(
				`evaluateMedium sample ${context.sampleIndex} ${context.coefficientName} must align to wavelengthsNm`,
			);
		}

		return coefficients.map((coefficient, wavelengthIndex) => {
			if (!Number.isFinite(coefficient)) {
				throw new RangeError(
					`evaluateMedium sample ${context.sampleIndex} ${context.coefficientName} at ${wavelengthsNm[wavelengthIndex]} nm must be finite`,
				);
			}

			if (coefficient < 0) {
				// Reason: absorption, scattering, and extinction are nonnegative
				// rates in participating media.
				// Source: PBRT Volume Scattering Processes.
				throw new RangeError(
					`evaluateMedium sample ${context.sampleIndex} ${context.coefficientName} must be nonnegative`,
				);
			}

			return coefficient;
		});
	}

	/**
	 * Validate one optional coefficient array.
	 *
	 * @param {readonly number[] | undefined} coefficients - Provide coefficient data.
	 * @param {readonly number[]} wavelengthsNm - Provide the active wavelength grid.
	 * @param {{ sampleIndex: number, coefficientName: string }} context - Identify errors.
	 * @returns {number[] | undefined}
	 */
	validateOptionalCoefficientArray(coefficients, wavelengthsNm, context) {
		if (coefficients === undefined) {
			// Branch source: scattering/absorption diagnostics are optional when
			// direct extinction is supplied; missing optional arrays should not
			// be invented.
			// See Code Design, coefficient precedence.
			return undefined;
		}

		return this.validateCoefficientArray(coefficients, wavelengthsNm, context);
	}

	/**
	 * Validate duplicate extinction totals against absorption plus scattering.
	 *
	 * @param {readonly number[]} extinctionByWavelength - Provide direct extinction.
	 * @param {readonly number[]} derivedExtinctionByWavelength - Provide derived extinction.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @returns {void}
	 */
	validateExtinctionConsistency(
		extinctionByWavelength,
		derivedExtinctionByWavelength,
		sampleIndex,
	) {
		for (const [wavelengthIndex, extinction] of extinctionByWavelength.entries()) {
			if (
				Math.abs(extinction - derivedExtinctionByWavelength[wavelengthIndex])
				> EVALUATE_MEDIUM_DUPLICATE_SUM_TOLERANCE
			) {
				// Branch source: duplicate extinction totals and
				// absorption+scattering totals must describe the same
				// wavelength-indexed coefficient data.
				// See PBRT Volume Scattering Processes; Code Design, coefficient precedence.
				throw new RangeError(
					`evaluateMedium sample ${sampleIndex} extinction must equal absorption plus scattering`,
				);
			}
		}
	}

	/**
	 * Add coefficient arrays wavelength by wavelength.
	 *
	 * @param {readonly number[]} left - Provide first array.
	 * @param {readonly number[]} right - Provide second array.
	 * @returns {number[]}
	 */
	addCoefficientArrays(left, right) {
		return left.map((leftValue, index) => {
			// Numerical policy: clamp derived sums to 15 significant decimal
			// digits so fixture-facing arrays avoid binary64 decimal tails while
			// preserving reviewable precision for controlled coefficient rows.
			// See Reference Decision Log, evaluateMedium Numerical Policy Source Map.
			return Number(
				(leftValue + right[index])
					.toPrecision(EVALUATE_MEDIUM_REVIEW_SIGNIFICANT_DIGITS),
			);
		});
	}

	/**
	 * Lookup model-owned medium state.
	 *
	 * @param {AtmosphereReferenceAtmosphereModel} atmosphere - Provide atmosphere adapter.
	 * @param {AtmosphereReferenceVector3Tuple} positionKm - Provide sample position.
	 * @param {readonly number[]} wavelengthsNm - Provide active wavelength grid.
	 * @param {AtmosphereReferenceViewSample} sample - Provide source view sample.
	 * @returns {AtmosphereReferenceMediumState}
	 */
	lookupMediumState(atmosphere, positionKm, wavelengthsNm, sample) {
		if (typeof atmosphere.mediumAt !== 'function') {
			// Branch source: mediumAt is the canonical high-level lookup for this
			// stage; granular density/coefficient helpers are adapter building
			// blocks, not fallback packet contracts.
			// See Code Design, Model Interface.
			throw new Error('evaluateMedium requires atmosphere.mediumAt');
		}

		// Branch source: a nullish model response means "no model-owned
		// diagnostics"; resolveCoefficients then applies the explicit vacuum
		// packet contract instead of consulting legacy helper methods.
		// See Stage Contracts, evaluateMedium.
		return atmosphere.mediumAt(positionKm, {
			wavelengthsNm,
			sample,
		}) ?? {};
	}

	/**
	 * Resolve packet model, observer, and ray inputs.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide the prepared packet.
	 * @returns {{ model: AtmosphereReferenceModel, observer: AtmosphereReferenceObserver, ray: AtmosphereReferenceRay }}
	 */
	resolveTransportInputs(packet) {
		const validatedRequest = packet.validatedRequest;

		if (!validatedRequest || typeof validatedRequest !== 'object') {
			// Reason: model, observer, and ray are canonicalized by validateRequest before medium lookup.
			// Source: Reference Stage Contracts, evaluateMedium consumes validatedRequest.
			throw new Error('evaluateMedium requires validatedRequest');
		}

		return {
			model: /** @type {AtmosphereReferenceModel} */ (validatedRequest.model),
			observer: /** @type {AtmosphereReferenceObserver} */ (validatedRequest.observer),
			ray: /** @type {AtmosphereReferenceRay} */ (validatedRequest.ray),
		};
	}

	/**
	 * Resolve the atmosphere model from a model bundle.
	 *
	 * @param {AtmosphereReferenceModel} model - Provide model bundle.
	 * @returns {AtmosphereReferenceAtmosphereModel}
	 */
	resolveAtmosphereModel(model) {
		const atmosphere = model.atmosphere;

		if (!atmosphere) {
			// Branch source: the validated model bundle must expose an
			// atmosphere owner before medium data can be evaluated.
			// See Stage Contracts, evaluateMedium prerequisites.
			throw new Error('evaluateMedium requires model.atmosphere');
		}

		return atmosphere;
	}

	/**
	 * Resolve the world model from a model bundle.
	 *
	 * @param {AtmosphereReferenceModel} model - Provide model bundle.
	 * @returns {AtmosphereReferenceWorldModel}
	 */
	resolveWorldModel(model) {
		const world = model.world;

		if (!world || typeof world.altitudeAt !== 'function') {
			// Branch source: world owns geometric altitude for diagnostics and
			// downstream handoff; atmosphere.mediumAt must not be a fallback
			// altitude source.
			// See Stage Contracts, evaluateMedium notes.
			throw new Error('evaluateMedium requires model.world.altitudeAt');
		}

		return world;
	}

	/**
	 * Resolve geometric altitude for one sample position.
	 *
	 * @param {AtmosphereReferenceWorldModel} world - Provide world adapter.
	 * @param {AtmosphereReferenceVector3Tuple} positionKm - Provide sample position.
	 * @param {number} sampleIndex - Identify the sample in errors.
	 * @returns {number}
	 */
	resolveAltitudeKm(world, positionKm, sampleIndex) {
		const altitudeKm = world.altitudeAt(positionKm);

		if (!Number.isFinite(altitudeKm)) {
			// Reason: geometric altitude is world-owned input consumed by
			// evaluateMedium and carried downstream as a finite kilometer value.
			// Source: Reference Code Design, Stage Boundary Ownership and Model Interface.
			throw new RangeError(`evaluateMedium sample ${sampleIndex} altitudeKm must be finite`);
		}

		return altitudeKm;
	}

	/**
	 * Resolve the active wavelength grid.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide the prepared packet.
	 * @returns {number[]}
	 */
	resolveWavelengths(packet) {
		const wavelengthsNm = packet.validatedRequest?.wavelengthsNm;

		if (!Array.isArray(wavelengthsNm)) {
			// Branch source: validateRequest owns the canonical spectral grid;
			// evaluateMedium must not accept a parallel top-level wavelength
			// source.
			// See Stage Contracts, wavelength ownership.
			throw new Error('evaluateMedium requires validatedRequest.wavelengthsNm');
		}

		return [...wavelengthsNm];
	}

	/**
	 * Validate the view-sample array.
	 *
	 * @param {AtmosphereReferenceViewSample[] | undefined} viewSamples - Provide view samples.
	 * @returns {AtmosphereReferenceViewSample[]}
	 */
	validateViewSamples(viewSamples) {
		if (!Array.isArray(viewSamples)) {
			// Branch source: sampleViewPath owns the view-sample array that this
			// stage evaluates; direct stage packets must supply that prerequisite.
			// See Stage Contracts, evaluateMedium consumes viewSamples.
			throw new Error('evaluateMedium requires viewSamples array');
		}

		return viewSamples;
	}

	/**
	 * Resolve one sample index.
	 *
	 * @param {AtmosphereReferenceViewSample} sample - Provide sample data.
	 * @param {number} fallbackIndex - Provide fallback array index.
	 * @returns {number}
	 */
	resolveSampleIndex(sample, fallbackIndex) {
		// Branch source: sampleIndex is diagnostic metadata when sampleViewPath
		// supplied it; fallbackIndex keeps direct stage fixtures identifiable
		// without changing transport math.
		// See Code Design, diagnostics shape.
		return Number.isInteger(sample?.sampleIndex) ? sample.sampleIndex : fallbackIndex;
	}

	/**
	 * Validate one finite number.
	 *
	 * @param {number} value - Provide value.
	 * @param {string} label - Identify value in errors.
	 * @returns {number}
	 */
	validateFiniteNumber(value, label) {
		if (!Number.isFinite(value)) {
			// Branch source: distances consumed by ray-position evaluation must
			// be finite kilometer values; non-finite path parameters do not
			// define a PBRT-style ray point.
			// See PBRT Rays and Stage Contracts, sample distance units.
			throw new Error(`evaluateMedium requires finite ${label}`);
		}

		return value;
	}
}
