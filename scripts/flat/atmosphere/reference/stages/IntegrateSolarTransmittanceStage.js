import ValidateRequestStage from './ValidateRequestStage.js';

/**
 * Integrate sample-to-source transmittance for solar source samples.
 */
export default class IntegrateSolarTransmittanceStage {
	/**
	 * Create the solar transmittance stage helper.
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
		 * @type {ValidateRequestStage}
		 */
		this.requestValidator = new ValidateRequestStage({ descriptor, context });
	}

	/**
	 * Integrate source-path optical depth from each medium sample to each solar source sample.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide medium samples and a validated model.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		const validatedRequest = this.resolveValidatedRequest(packet.validatedRequest);
		const mediumSamples = this.validateMediumSamples(packet.mediumSamples);
		const rayPath = this.validateRayPath(packet.rayPath);
		const wavelengthsNm = this.resolveWavelengths(validatedRequest);
		const solarSource = this.resolveSolarSource(validatedRequest.model);

		let sourceSampleCount = 0;

		// Algorithm reference: source transmittance is the same optical-depth
		// integral as camera-view transmittance, but over sample-to-source
		// segments owned by the model/solar adapter.
		// Source: PBRT Transmittance; Reference Code Design, solarSource.transmittanceSegment.
		const samples = mediumSamples.map((mediumSample, fallbackIndex) => {
			const sampleIndex = this.resolveSampleIndex(mediumSample, fallbackIndex);
			const positionKm = this.validatePositionKm(mediumSample.positionKm, sampleIndex);
			const sourceSamples = this.lookupSourceSamples(
				solarSource,
				positionKm,
				validatedRequest.numerical,
			);
			// Branch source: metadata.sourceSampleCount is a diagnostic count of
			// every model-owned source sample emitted for medium and surface
			// points, not a physical quantity.
			// See Reference Decision Log, integrateSolarTransmittance Implementation Branch Source Map.
			sourceSampleCount += sourceSamples.length;

			return {
				sampleIndex,
				distanceFromObserverKm: mediumSample.distanceFromObserverKm,
				positionKm,
				sourceSamples: sourceSamples.map((sourceSample, sourceSampleIndex) => {
					return this.integrateSourceSample({
						solarSource,
						positionKm,
						mediumSample,
						sourceSample,
						sourceSampleIndex,
						wavelengthsNm,
						numerical: validatedRequest.numerical,
					});
				}),
			};
		});
		const surfacePoint = this.evaluateSurfacePoint({
			rayPath,
			validatedRequest,
			solarSource,
			wavelengthsNm,
		});

		if (surfacePoint) {
			// Branch source: optional surface-point source samples are included
			// only when resolveRayPath selected a visible surface hit.
			// See Stage Contracts, integrateSolarTransmittance surfacePoint.
			sourceSampleCount += surfacePoint.sourceSamples.length;
		}

		const solarTransmittance = {
			samples,
			metadata: {
				sampleCount: samples.length,
				sourceSampleCount,
				includesSurfacePoint: Boolean(surfacePoint),
			},
		};

		if (surfacePoint) {
			// Branch source: omit the optional surfacePoint field when there is
			// no selected surface endpoint, rather than inventing an empty
			// surface handoff.
			// See Stage Contracts, optional surfacePoint ownership.
			solarTransmittance.surfacePoint = surfacePoint;
		}

		return {
			...packet,
			solarTransmittance,
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
		};
	}

	/**
	 * Integrate one source sample from one medium sample.
	 *
	 * @param {{ solarSource: AtmosphereReferenceSolarSourceModel, positionKm: AtmosphereReferenceVector3Tuple, mediumSample: AtmosphereReferenceMediumSample, sourceSample: AtmosphereReferenceSolarSourceSample, sourceSampleIndex: number, wavelengthsNm: readonly number[], numerical: Readonly<AtmosphereReferenceNumericalControls> }} options - Provide source-sample context.
	 * @returns {AtmosphereReferenceSolarTransmittanceSourceSample}
	 */
	integrateSourceSample({
		solarSource,
		positionKm,
		mediumSample,
		sourceSample,
		sourceSampleIndex,
		wavelengthsNm,
		numerical,
	}) {
		const segment = this.lookupSourceSegment(solarSource, positionKm, sourceSample, {
			wavelengthsNm,
			numerical,
			...(mediumSample ? { mediumSample } : {}),
		});
		const sourceSampleId = sourceSample.id ?? sourceSampleIndex;
		const baseOutput = {
			// Branch source: preserve source-sample identity and metadata because
			// downstream phase, scattering, and surface stages consume the
			// model-owned source facts without re-querying solarSource.
			// See Reference Decision Log, integrateSolarTransmittance Implementation Branch Source Map.
			sourceSampleIndex,
			sourceSampleId,
			direction: this.validateSourceDirection(
				sourceSample.direction,
				sourceSampleIndex,
			),
			weight: this.validateOptionalNonnegativeFinite(
				sourceSample.weight,
				`source sample ${sourceSampleIndex} weight`,
			),
			solidAngleSr: this.validateOptionalNonnegativeFinite(
				sourceSample.solidAngleSr,
				`source sample ${sourceSampleIndex} solidAngleSr`,
			),
			sourceSpectrum: this.validateSourceSpectrum(
				sourceSample.sourceSpectrum,
				wavelengthsNm,
				sourceSampleIndex,
			),
			boundaryReason: segment.boundaryReason,
		};

		if (segment.visible === false) {
			// Reason: a model-owned occlusion says the direct source path is not
			// visible, so later source terms receive zero transmittance without
			// inventing an optical-depth value for a blocked path.
			// Source: Reference Code Design, integrateSolarTransmittance visibility contract.
			return {
				...baseOutput,
				visible: false,
				pathLengthKm: 0,
				opticalDepthByWavelength: null,
				sourceTransmittanceByWavelength: wavelengthsNm.map(() => 0),
			};
		}

		const integration = this.integrateSegmentSamples(
			segment.samples ?? [],
			wavelengthsNm,
			sourceSampleIndex,
		);

		return {
			...baseOutput,
			visible: true,
			pathLengthKm: integration.pathLengthKm,
			opticalDepthByWavelength: integration.opticalDepthByWavelength,
			sourceTransmittanceByWavelength: this.transmittanceFromOpticalDepth(
				integration.opticalDepthByWavelength,
			),
		};
	}

	/**
	 * Evaluate source transmittance at the selected visible surface point.
	 *
	 * @param {{ rayPath: AtmosphereReferenceRayPath, validatedRequest: AtmosphereReferenceValidatedTraceRequest, solarSource: AtmosphereReferenceSolarSourceModel, wavelengthsNm: readonly number[] }} options - Provide surface and source context.
	 * @returns {AtmosphereReferenceSolarTransmittanceSurfacePoint | undefined}
	 */
	evaluateSurfacePoint({
		rayPath,
		validatedRequest,
		solarSource,
		wavelengthsNm,
	}) {
		if (!rayPath.surfaceHit) {
			// Branch source: surface source transmittance is optional and exists
			// only for a selected visible surface endpoint from resolveRayPath.
			// See Stage Contracts, integrateSolarTransmittance surfacePoint.
			return undefined;
		}

		const distanceFromObserverKm = this.validateSurfaceDistanceKm(rayPath.surfaceHit);
		// Algorithm source: surface position is evaluated on the already
		// validated camera ray using the same parametric ray equation as view
		// sample positions.
		// See PBRT Rays; Reference Decision Log, integrateSolarTransmittance Implementation Branch Source Map.
		const positionKm = this.evaluateRayPositionKm(
			validatedRequest.observer,
			validatedRequest.ray,
			distanceFromObserverKm,
		);
		const surfacePointContext = {
			distanceFromObserverKm,
			positionKm,
			surfaceHit: rayPath.surfaceHit,
		};
		const sourceSamples = this.lookupSourceSamples(
			solarSource,
			positionKm,
			validatedRequest.numerical,
		);

		return {
			...surfacePointContext,
			sourceSamples: sourceSamples.map((sourceSample, sourceSampleIndex) => {
				return this.integrateSurfaceSourceSample({
					solarSource,
					positionKm,
					surfacePoint: surfacePointContext,
					sourceSample,
					sourceSampleIndex,
					wavelengthsNm,
					numerical: validatedRequest.numerical,
				});
			}),
		};
	}

	/**
	 * Integrate one source sample from the selected surface point.
	 *
	 * @param {{ solarSource: AtmosphereReferenceSolarSourceModel, positionKm: AtmosphereReferenceVector3Tuple, surfacePoint: Omit<AtmosphereReferenceSolarTransmittanceSurfacePoint, 'sourceSamples'>, sourceSample: AtmosphereReferenceSolarSourceSample, sourceSampleIndex: number, wavelengthsNm: readonly number[], numerical: Readonly<AtmosphereReferenceNumericalControls> }} options - Provide surface source context.
	 * @returns {AtmosphereReferenceSolarTransmittanceSourceSample}
	 */
	integrateSurfaceSourceSample({
		solarSource,
		positionKm,
		surfacePoint,
		sourceSample,
		sourceSampleIndex,
		wavelengthsNm,
		numerical,
	}) {
		const segment = this.lookupSourceSegment(solarSource, positionKm, sourceSample, {
			wavelengthsNm,
			surfacePoint,
			numerical,
		});
		const sourceSampleId = sourceSample.id ?? sourceSampleIndex;
		const baseOutput = {
			// Branch source: surface-point source samples use the same downstream
			// handoff shape as medium-sample source samples so surface radiance can
			// consume direct-source data without a second model query.
			// See Stage Contracts, integrateSolarTransmittance output.
			sourceSampleIndex,
			sourceSampleId,
			direction: this.validateSourceDirection(
				sourceSample.direction,
				sourceSampleIndex,
			),
			weight: this.validateOptionalNonnegativeFinite(
				sourceSample.weight,
				`source sample ${sourceSampleIndex} weight`,
			),
			solidAngleSr: this.validateOptionalNonnegativeFinite(
				sourceSample.solidAngleSr,
				`source sample ${sourceSampleIndex} solidAngleSr`,
			),
			sourceSpectrum: this.validateSourceSpectrum(
				sourceSample.sourceSpectrum,
				wavelengthsNm,
				sourceSampleIndex,
			),
			boundaryReason: segment.boundaryReason,
		};

		if (segment.visible === false) {
			// Branch source: same model-declared occlusion contract as medium
			// source samples; the stage records zero transmittance rather than a
			// synthetic optical depth.
			// See Reference Decision Log, integrateSolarTransmittance Implementation Branch Source Map.
			return {
				...baseOutput,
				visible: false,
				pathLengthKm: 0,
				opticalDepthByWavelength: null,
				sourceTransmittanceByWavelength: wavelengthsNm.map(() => 0),
			};
		}

		const integration = this.integrateSegmentSamples(
			segment.samples ?? [],
			wavelengthsNm,
			sourceSampleIndex,
		);

		return {
			...baseOutput,
			visible: true,
			pathLengthKm: integration.pathLengthKm,
			opticalDepthByWavelength: integration.opticalDepthByWavelength,
			sourceTransmittanceByWavelength: this.transmittanceFromOpticalDepth(
				integration.opticalDepthByWavelength,
			),
		};
	}

	/**
	 * Integrate source-path segment samples into optical depth.
	 *
	 * @param {readonly AtmosphereReferenceSolarTransmittanceSegmentSample[]} segmentSamples - Provide source-path samples.
	 * @param {readonly number[]} wavelengthsNm - Provide the spectral grid.
	 * @param {number} sourceSampleIndex - Identify the source sample in errors.
	 * @returns {{ pathLengthKm: number, opticalDepthByWavelength: number[] }}
	 */
	integrateSegmentSamples(segmentSamples, wavelengthsNm, sourceSampleIndex) {
		const opticalDepthByWavelength = wavelengthsNm.map(() => 0);
		let pathLengthKm = 0;

		for (const [segmentSampleIndex, segmentSample] of segmentSamples.entries()) {
			const weightKm = this.validateSegmentWeightKm(
				segmentSample.weightKm,
				sourceSampleIndex,
				segmentSampleIndex,
			);
			const extinctionByWavelength = this.validateExtinctionArray(
				segmentSample.extinctionByWavelength,
				wavelengthsNm,
				sourceSampleIndex,
				segmentSampleIndex,
			);

			pathLengthKm += weightKm;

			for (const [wavelengthIndex, extinctionPerKm] of extinctionByWavelength.entries()) {
				// Algorithm reference: piecewise-constant source-path samples use
				// the same optical-depth contribution sigma_t(lambda) * ds as the
				// view-path integrator.
				// Source: PBRT Transmittance; solar-transmittance homogeneous fixture rows.
				opticalDepthByWavelength[wavelengthIndex] += extinctionPerKm * weightKm;
			}
		}

		return { pathLengthKm, opticalDepthByWavelength };
	}

	/**
	 * Convert optical depth to Beer-Lambert transmittance.
	 *
	 * @param {readonly number[]} opticalDepthByWavelength - Provide optical depth values.
	 * @returns {number[]}
	 */
	transmittanceFromOpticalDepth(opticalDepthByWavelength) {
		// Algorithm reference: Beer-Lambert transmittance T(lambda) = exp(-tau(lambda)).
		// Source: PBRT Transmittance; solar-transmittance Beer-Lambert fixture row.
		return opticalDepthByWavelength.map((opticalDepth) => Math.exp(-opticalDepth));
	}

	/**
	 * Resolve the validated request required by this stage.
	 *
	 * @param {AtmosphereReferenceValidatedTraceRequest | undefined} validatedRequest - Provide packet field.
	 * @returns {AtmosphereReferenceValidatedTraceRequest}
	 */
	resolveValidatedRequest(validatedRequest) {
		if (!validatedRequest || typeof validatedRequest !== 'object') {
			// Reason: source-path integration needs the validated model, wavelength grid, and numerical controls.
			// Source: Reference Code Design, canonical stage descriptors.
			throw new Error('integrateSolarTransmittance requires validatedRequest');
		}

		return /** @type {AtmosphereReferenceValidatedTraceRequest} */ (validatedRequest);
	}

	/**
	 * Validate medium sample input.
	 *
	 * @param {AtmosphereReferenceMediumSample[] | undefined} mediumSamples - Provide medium samples.
	 * @returns {AtmosphereReferenceMediumSample[]}
	 */
	validateMediumSamples(mediumSamples) {
		if (!Array.isArray(mediumSamples)) {
			// Reason: solar transmittance is evaluated from already materialized medium sample positions.
			// Source: Reference Code Design, integrateSolarTransmittance requires mediumSamples.
			throw new Error('integrateSolarTransmittance requires mediumSamples array');
		}

		return mediumSamples;
	}

	/**
	 * Validate the ray path needed for optional surface-point transmittance.
	 *
	 * @param {AtmosphereReferenceRayPath | undefined} rayPath - Provide selected ray path.
	 * @returns {AtmosphereReferenceRayPath}
	 */
	validateRayPath(rayPath) {
		if (!rayPath || typeof rayPath !== 'object') {
			// Reason: surface-point source transmittance is keyed from the resolved ray path.
			// Source: Reference Stage Contracts, integrateSolarTransmittance consumes rayPath.
			throw new Error('integrateSolarTransmittance requires rayPath');
		}

		return /** @type {AtmosphereReferenceRayPath} */ (rayPath);
	}

	/**
	 * Resolve active wavelength grid.
	 *
	 * @param {AtmosphereReferenceValidatedTraceRequest} validatedRequest - Provide canonical request.
	 * @returns {readonly number[]}
	 */
	resolveWavelengths(validatedRequest) {
		// Branch source: reuse validateRequest's spectral-grid contract so this
		// stage does not define a parallel wavelength validator.
		// See Stage Contracts, wavelength ownership.
		return this.requestValidator.validateWavelengthGrid(validatedRequest.wavelengthsNm);
	}

	/**
	 * Resolve the model-owned solar source adapter.
	 *
	 * @param {AtmosphereReferenceModel} model - Provide validated model.
	 * @returns {AtmosphereReferenceSolarSourceModel}
	 */
	resolveSolarSource(model) {
		const solarSource = model?.solarSource;

		if (!solarSource || typeof solarSource.samplesAt !== 'function') {
			// Reason: source samples are model-owned; the stage must not invent a Sun shape.
			// Source: Reference Code Design, Model Interface.
			throw new Error('integrateSolarTransmittance requires model.solarSource.samplesAt');
		}

		return solarSource;
	}

	/**
	 * Look up source samples for one medium sample.
	 *
	 * @param {AtmosphereReferenceSolarSourceModel} solarSource - Provide source model.
	 * @param {AtmosphereReferenceVector3Tuple} positionKm - Provide sample position.
	 * @param {Readonly<AtmosphereReferenceNumericalControls>} numerical - Provide numerical controls.
	 * @returns {AtmosphereReferenceSolarSourceSample[]}
	 */
	lookupSourceSamples(solarSource, positionKm, numerical) {
		// Branch source: wavelength argument is intentionally undefined here;
		// source models return source samples for the whole active handoff, while
		// spectrum arrays are later validated against wavelengthsNm.
		// See Code Design, solarSource.samplesAt model interface.
		const sourceSamples = solarSource.samplesAt(positionKm, undefined, numerical);

		if (!Array.isArray(sourceSamples)) {
			// Reason: finite and directional solar models both expose a list of source samples.
			// Source: Reference Code Design, solarSource.samplesAt.
			throw new RangeError('integrateSolarTransmittance source samples must be an array');
		}

		return /** @type {AtmosphereReferenceSolarSourceSample[]} */ (sourceSamples);
	}

	/**
	 * Look up one model-owned source-path segment.
	 *
	 * @param {AtmosphereReferenceSolarSourceModel} solarSource - Provide source model.
	 * @param {AtmosphereReferenceVector3Tuple} positionKm - Provide sample position.
	 * @param {AtmosphereReferenceSolarSourceSample} sourceSample - Provide source sample.
	 * @param {{ wavelengthsNm: readonly number[], mediumSample?: AtmosphereReferenceMediumSample, surfacePoint?: Omit<AtmosphereReferenceSolarTransmittanceSurfacePoint, 'sourceSamples'>, numerical: Readonly<AtmosphereReferenceNumericalControls> }} query - Provide query context.
	 * @returns {AtmosphereReferenceSolarTransmittanceSegment}
	 */
	lookupSourceSegment(solarSource, positionKm, sourceSample, query) {
		if (typeof solarSource.transmittanceSegment !== 'function') {
			// Reason: this stage integrates model-owned source-path segments; source geometry belongs in adapters.
			// Source: Reference Code Design, solarSource.transmittanceSegment.
			throw new Error('integrateSolarTransmittance requires model.solarSource.transmittanceSegment');
		}

		const segment = solarSource.transmittanceSegment(positionKm, sourceSample, query);

		if (!segment || typeof segment !== 'object') {
			// Reason: source-path transport needs explicit visibility and segment sample data.
			// Source: Reference Code Design, solarSource.transmittanceSegment.
			throw new RangeError('integrateSolarTransmittance source segment must be an object');
		}

		return /** @type {AtmosphereReferenceSolarTransmittanceSegment} */ (segment);
	}

	/**
	 * Validate model-supplied source spectral energy.
	 *
	 * @param {unknown} sourceSpectrum - Provide model-owned source spectrum.
	 * @param {readonly number[]} wavelengthsNm - Provide active wavelength grid.
	 * @param {number} sourceSampleIndex - Identify source sample in errors.
	 * @returns {AtmosphereReferenceSourceSpectrum}
	 */
	validateSourceSpectrum(sourceSpectrum, wavelengthsNm, sourceSampleIndex) {
		if (!sourceSpectrum || typeof sourceSpectrum !== 'object') {
			// Reason: downstream single scattering needs source energy aligned to the same wavelength grid.
			// Source: Reference Stage Contracts, integrateSolarTransmittance sourceSpectrum handoff.
			throw new Error(`integrateSolarTransmittance source sample ${sourceSampleIndex} requires sourceSpectrum`);
		}

		const spectrum = /** @type {AtmosphereReferenceSourceSpectrum} */ (sourceSpectrum);

		if (!['spectral-radiance', 'spectral-irradiance'].includes(spectrum.kind)) {
			// Branch source: downstream radiance math needs to distinguish source
			// radiance from irradiance instead of treating source energy as an
			// anonymous scalar array.
			// See Stage Contracts, sourceSpectrum handoff.
			throw new RangeError(
				`integrateSolarTransmittance source sample ${sourceSampleIndex} sourceSpectrum.kind is invalid`,
			);
		}

		if (typeof spectrum.units !== 'string' || spectrum.units.length === 0) {
			// Branch source: sourceSpectrum is model-owned physical data; units
			// must travel with values until radiance stages pin their
			// interpretation.
			// See Code Design, physical units and package traceability.
			throw new RangeError(
				`integrateSolarTransmittance source sample ${sourceSampleIndex} sourceSpectrum.units is required`,
			);
		}

		if (typeof spectrum.derivation !== 'string' || spectrum.derivation.length === 0) {
			// Branch source: source energy must carry provenance because this
			// stage transports it but does not define solar spectrum truth.
			// See Reference Decision Log, integrateSolarTransmittance Implementation Branch Source Map.
			throw new RangeError(
				`integrateSolarTransmittance source sample ${sourceSampleIndex} sourceSpectrum.derivation is required`,
			);
		}

		return {
			kind: spectrum.kind,
			valuesByWavelength: this.validateSourceSpectrumValues(
				spectrum.valuesByWavelength,
				wavelengthsNm,
				sourceSampleIndex,
			),
			units: spectrum.units,
			derivation: spectrum.derivation,
		};
	}

	/**
	 * Validate source spectrum values against the active wavelength grid.
	 *
	 * @param {readonly number[] | undefined} valuesByWavelength - Provide spectral values.
	 * @param {readonly number[]} wavelengthsNm - Provide active wavelength grid.
	 * @param {number} sourceSampleIndex - Identify source sample in errors.
	 * @returns {number[]}
	 */
	validateSourceSpectrumValues(valuesByWavelength, wavelengthsNm, sourceSampleIndex) {
		if (
			!Array.isArray(valuesByWavelength)
			|| valuesByWavelength.length !== wavelengthsNm.length
		) {
			// Branch source: source-spectrum values are wavelength-indexed; no
			// interpolation, broadcast, or truncation policy belongs to this
			// stage.
			// See Stage Contracts, sourceSpectrum valuesByWavelength.
			throw new RangeError(
				`integrateSolarTransmittance source sample ${sourceSampleIndex} sourceSpectrum must align to wavelengthsNm`,
			);
		}

		return valuesByWavelength.map((value, wavelengthIndex) => {
			const wavelengthNm = wavelengthsNm[wavelengthIndex];

			if (!Number.isFinite(value) || value < 0) {
				// Branch source: source spectra are transported as nonnegative
				// finite energy values; negative or non-finite source energy would
				// make downstream radiance terms invalid.
				// See Code Design, physical units and source handoff.
				throw new RangeError(
					`integrateSolarTransmittance source sample ${sourceSampleIndex} sourceSpectrum at ${wavelengthNm} nm must be nonnegative finite`,
				);
			}

			return value;
		});
	}

	/**
	 * Validate a source direction used by downstream phase evaluation.
	 *
	 * @param {AtmosphereReferenceVector3Tuple | undefined} direction - Provide source direction.
	 * @param {number} sourceSampleIndex - Identify source sample in errors.
	 * @returns {AtmosphereReferenceVector3Tuple}
	 */
	validateSourceDirection(direction, sourceSampleIndex) {
		if (!Array.isArray(direction) || direction.length !== 3) {
			// Branch source: downstream phase evaluation needs a concrete
			// model-owned source direction vector for each source sample.
			// See Stage Contracts, downstream use.
			throw new RangeError(
				`integrateSolarTransmittance source sample ${sourceSampleIndex} direction must be a finite 3-vector`,
			);
		}

		return /** @type {AtmosphereReferenceVector3Tuple} */ (
			direction.map((component) => {
				if (!Number.isFinite(component)) {
					// Branch source: non-finite direction components do not define
					// a usable scattering-angle input.
					// See PBRT Rays; Stage Contracts, source direction handoff.
					throw new RangeError(
						`integrateSolarTransmittance source sample ${sourceSampleIndex} direction must be finite`,
					);
				}

				return component;
			})
		);
	}

	/**
	 * Evaluate a model-space position on the validated camera ray.
	 *
	 * @param {AtmosphereReferenceObserver} observer - Provide observer data.
	 * @param {AtmosphereReferenceRay} ray - Provide normalized ray data.
	 * @param {number} distanceFromObserverKm - Provide ray distance.
	 * @returns {AtmosphereReferenceVector3Tuple}
	 */
	evaluateRayPositionKm(observer, ray, distanceFromObserverKm) {
		// Algorithm source: PBRT Rays define positions parametrically as origin
		// plus distance-like parameter times direction. validateRequest already
		// canonicalizes the direction for kilometer distances.
		// See PBRT Rays; Stage Contracts, surfacePoint position.
		return /** @type {AtmosphereReferenceVector3Tuple} */ (
			observer.positionKm.map((component, axisIndex) => {
				return component + ray.direction[axisIndex] * distanceFromObserverKm;
			})
		);
	}

	/**
	 * Validate the surface-hit distance used to create surface source samples.
	 *
	 * @param {AtmosphereReferenceSurfaceHit} surfaceHit - Provide selected surface hit.
	 * @returns {number}
	 */
	validateSurfaceDistanceKm(surfaceHit) {
		if (!Number.isFinite(surfaceHit.tKm) || surfaceHit.tKm < 0) {
			// Branch source: a selected forward surface endpoint must be a finite
			// nonnegative camera-ray distance before this stage can query source
			// visibility from that point.
			// See Stage Contracts, rayPath.surfaceHit handoff.
			throw new RangeError('integrateSolarTransmittance requires finite nonnegative surfaceHit.tKm');
		}

		return surfaceHit.tKm;
	}

	/**
	 * Resolve a sample index.
	 *
	 * @param {AtmosphereReferenceMediumSample} mediumSample - Provide medium sample.
	 * @param {number} fallbackIndex - Provide array index.
	 * @returns {number}
	 */
	resolveSampleIndex(mediumSample, fallbackIndex) {
		const sampleIndex = mediumSample.sampleIndex ?? fallbackIndex;

		if (!Number.isInteger(sampleIndex) || sampleIndex < 0) {
			// Reason: sample-index diagnostics must be stable nonnegative integers.
			// Source: Reference Code Design, sample/medium packet diagnostics.
			throw new RangeError('integrateSolarTransmittance sampleIndex must be a nonnegative integer');
		}

		return sampleIndex;
	}

	/**
	 * Validate sample position.
	 *
	 * @param {AtmosphereReferenceVector3Tuple | undefined} positionKm - Provide position.
	 * @param {number} sampleIndex - Identify sample in errors.
	 * @returns {AtmosphereReferenceVector3Tuple}
	 */
	validatePositionKm(positionKm, sampleIndex) {
		if (!Array.isArray(positionKm) || positionKm.length !== 3) {
			// Reason: source samples are queried from a concrete model-space position.
			// Source: Reference Code Design, Inputs and Units.
			throw new RangeError(`integrateSolarTransmittance sample ${sampleIndex} positionKm must be a finite 3-vector`);
		}

		return /** @type {AtmosphereReferenceVector3Tuple} */ (
			positionKm.map((component) => {
				if (!Number.isFinite(component)) {
					throw new RangeError(`integrateSolarTransmittance sample ${sampleIndex} positionKm must be finite`);
				}

				return component;
			})
		);
	}

	/**
	 * Validate a segment integration weight.
	 *
	 * @param {number} weightKm - Provide path-distance weight.
	 * @param {number} sourceSampleIndex - Identify source sample.
	 * @param {number} segmentSampleIndex - Identify segment sample.
	 * @returns {number}
	 */
	validateSegmentWeightKm(weightKm, sourceSampleIndex, segmentSampleIndex) {
		if (!Number.isFinite(weightKm)) {
			// Reason: PBRT optical depth integrates extinction over finite path length ds.
			// Source: PBRT Transmittance.
			throw new RangeError(`source sample ${sourceSampleIndex} segment ${segmentSampleIndex} weight must be finite`);
		}

		if (weightKm < 0) {
			// Reason: negative path length would subtract optical depth.
			// Source: PBRT Transmittance, optical depth as distance integral.
			throw new RangeError(`source sample ${sourceSampleIndex} segment ${segmentSampleIndex} weight is negative`);
		}

		return weightKm;
	}

	/**
	 * Validate source-path extinction.
	 *
	 * @param {readonly number[] | undefined} extinctionByWavelength - Provide extinction coefficients.
	 * @param {readonly number[]} wavelengthsNm - Provide spectral grid.
	 * @param {number} sourceSampleIndex - Identify source sample.
	 * @param {number} segmentSampleIndex - Identify segment sample.
	 * @returns {number[]}
	 */
	validateExtinctionArray(
		extinctionByWavelength,
		wavelengthsNm,
		sourceSampleIndex,
		segmentSampleIndex,
	) {
		if (
			!Array.isArray(extinctionByWavelength)
			|| extinctionByWavelength.length !== wavelengthsNm.length
		) {
			// Reason: source-path extinction arrays are wavelength-indexed; no broadcast/truncate policy exists.
			// Source: Reference Code Design, spectral-array contract.
			throw new RangeError(
				`source sample ${sourceSampleIndex} segment ${segmentSampleIndex} extinction must align to wavelengthsNm`,
			);
		}

		return extinctionByWavelength.map((extinctionPerKm, wavelengthIndex) => {
			const wavelengthNm = wavelengthsNm[wavelengthIndex];

			if (!Number.isFinite(extinctionPerKm)) {
				// Reason: non-finite coefficients make Beer-Lambert transport undefined.
				// Source: Reference Test Design, transport hard invariants.
				throw new RangeError(
					`source sample ${sourceSampleIndex} extinction at ${wavelengthNm} nm must be finite`,
				);
			}

			if (extinctionPerKm < 0) {
				// Reason: extinction is a nonnegative attenuation rate from absorption and out-scattering.
				// Source: PBRT Volume Scattering Processes.
				throw new RangeError(
					`negative extinction at ${wavelengthNm} nm in source sample ${sourceSampleIndex}`,
				);
			}

			return extinctionPerKm;
		});
	}

	/**
	 * Validate optional nonnegative finite metadata.
	 *
	 * @param {number | undefined} value - Provide value.
	 * @param {string} label - Identify value in errors.
	 * @returns {number | undefined}
	 */
	validateOptionalNonnegativeFinite(value, label) {
		if (value === undefined) {
			// Branch source: source weight and solid angle are optional
			// model-owned metadata. Missing metadata is omitted, not invented.
			// See Stage Contracts, source sample output.
			return undefined;
		}

		if (!Number.isFinite(value) || value < 0) {
			// Reason: source quadrature weights and solid angles are nonnegative finite diagnostics.
			// Source: Reference Code Design, solarSource.samplesAt source-sample metadata.
			throw new RangeError(`${label} must be nonnegative finite`);
		}

		return value;
	}
}
