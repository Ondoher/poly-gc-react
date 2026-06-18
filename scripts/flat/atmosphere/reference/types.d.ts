/**
 * Describe a three-dimensional vector in model coordinates.
 */
type AtmosphereReferenceVector3Tuple = readonly [number, number, number];

/**
 * Configure vector normalization.
 */
type AtmosphereReferenceNormalizeVector3Options = {
	/**
	 * Label the vector in error messages.
	 */
	label?: string;

	/**
	 * Store the minimum vector length accepted before normalization.
	 */
	minLength?: number;
}

/**
 * Configure ray-path segment normalization.
 */
type AtmosphereReferenceNormalizeRayPathSegmentOptions = {
	/**
	 * Label the segment in error messages.
	 */
	label?: string;

	/**
	 * Store the absolute kilometer tolerance for reconciling length with endpoints.
	 */
	lengthToleranceKm?: number;
}

/**
 * Describe a camera or integration ray.
 */
type AtmosphereReferenceRay = {
	/**
	 * Store the normalized ray direction.
	 */
	direction: AtmosphereReferenceVector3Tuple;
}

/**
 * Describe the observer for one reference ray.
 */
type AtmosphereReferenceObserver = {
	/**
	 * Store the observer position in model coordinates, measured in kilometers.
	 */
	positionKm: AtmosphereReferenceVector3Tuple;
}

/**
 * Describe the concrete ray object passed to model intersection methods.
 */
type AtmosphereReferenceTransportRay = {
	/**
	 * Store the ray origin in model coordinates, measured in kilometers.
	 */
	originKm: AtmosphereReferenceVector3Tuple;

	/**
	 * Store the normalized ray direction.
	 */
	direction: AtmosphereReferenceVector3Tuple;
}

/**
 * Describe a model-returned atmosphere interval along a transport ray.
 */
type AtmosphereReferenceAtmosphereIntersection = {
	/**
	 * Store the interval entry distance along the ray, in kilometers.
	 */
	tMinKm?: number;

	/**
	 * Store the interval exit distance along the ray, in kilometers.
	 */
	tMaxKm?: number;

	/**
	 * Mark an explicitly unbounded atmosphere path.
	 */
	unbounded?: boolean;

	/**
	 * Explain which boundary ended the interval.
	 */
	boundaryReason?: string;

	/**
	 * Identify the model-owned boundary, when one exists.
	 */
	boundaryId?: string | null;

	/**
	 * Preserve model-owned diagnostics for reports.
	 */
	metadata?: Record<string, unknown>;
}

/**
 * Describe a model-returned opaque surface hit along a transport ray.
 */
type AtmosphereReferenceSurfaceHit = {
	/**
	 * Store the hit distance along the ray, in kilometers.
	 */
	tKm?: number;

	/**
	 * Explain the surface boundary kind.
	 */
	boundaryReason?: string;

	/**
	 * Identify the model-owned surface boundary, when one exists.
	 */
	boundaryId?: string | null;

	/**
	 * Preserve model-owned diagnostics for reports.
	 */
	metadata?: Record<string, unknown>;

	/**
	 * Allow model-specific hit data to travel with the packet.
	 */
	[key: string]: unknown;
}

/**
 * Describe the selected view-transport segment.
 */
type AtmosphereReferenceRayPathSegment = {
	/**
	 * Store the selected segment start distance, in kilometers.
	 */
	startKm: number;

	/**
	 * Store the selected segment end distance, in kilometers.
	 */
	endKm: number;

	/**
	 * Store the selected segment length, in kilometers.
	 */
	lengthKm: number;
}

/**
 * Describe the ray-path output produced by resolveRayPath.
 */
type AtmosphereReferenceRayPath = {
	/**
	 * Identify whether downstream stages should integrate no atmosphere distance.
	 */
	isEmpty: boolean;

	/**
	 * Store the selected camera-ray segment.
	 */
	viewSegment: AtmosphereReferenceRayPathSegment;

	/**
	 * Explain why the path ended or why it is empty.
	 */
	boundaryReason: string;

	/**
	 * Identify the model-owned ending boundary, when one exists.
	 */
	boundaryId: string | null;

	/**
	 * Preserve the visible surface hit when it clips or blocks the path.
	 */
	surfaceHit: AtmosphereReferenceSurfaceHit | null;

	/**
	 * Preserve model-owned diagnostics for reports.
	 */
	metadata?: Record<string, unknown>;
}

/**
 * Describe one midpoint sample along the selected view ray.
 */
type AtmosphereReferenceViewSample = {
	/**
	 * Store the zero-based sample index.
	 */
	sampleIndex: number;

	/**
	 * Store the midpoint distance from the observer, in kilometers.
	 */
	distanceFromObserverKm: number;

	/**
	 * Store the path-distance integration weight, in kilometers.
	 */
	weightKm: number;

	/**
	 * Store the subinterval start distance from the observer, in kilometers.
	 */
	intervalStartKm: number;

	/**
	 * Store the subinterval end distance from the observer, in kilometers.
	 */
	intervalEndKm: number;

	/**
	 * Identify the numerical rule used for this sample.
	 */
	integrationMethod: "midpoint";
}

/**
 * Describe run-level metadata for view-path sampling.
 */
type AtmosphereReferenceViewSampleMetadata = {
	/**
	 * Identify the numerical rule used by sampleViewPath.
	 */
	integrationMethod: "midpoint";

	/**
	 * Count emitted view samples.
	 */
	sampleCount: number;

	/**
	 * Store the selected path length, in kilometers.
	 */
	pathLengthKm: number;
}

/**
 * Describe numerical approximation controls for the reference integrator.
 *
 * These controls are not physical constants.
 */
type AtmosphereReferenceNumericalControls = {
	/**
	 * Select how many samples to use along the view ray.
	 */
	viewSteps?: number;

	/**
	 * Select how many samples to use along sample-to-source transmittance rays.
	 */
	sunTransmittanceSteps?: number;

	/**
	 * Select how many samples to use for diffuse sky irradiance integration.
	 */
	diffuseSkyHemisphereSamples?: number;

	/**
	 * Select how many source samples to use for finite solar disks.
	 */
	finiteSunSamples?: number;

	/**
	 * Scale the named diffuse-sky-airlight diagnostic approximation.
	 */
	diffuseSkyAirlightStrength?: number;

	/**
	 * Store the smallest allowed integration step in kilometers.
	 */
	minStepKm?: number;

	/**
	 * Store the largest allowed integration step in kilometers.
	 */
	maxStepKm?: number;

	/**
	 * Select the numerical integration method.
	 */
	integrationMethod?: string;
}

/**
 * Store wavelength-aligned medium coefficients, in inverse kilometers.
 */
type AtmosphereReferenceMediumCoefficients = {
	/**
	 * Store total extinction coefficients aligned to wavelengthsNm.
	 */
	extinctionByWavelength?: readonly number[];

	/**
	 * Store total scattering coefficients aligned to wavelengthsNm.
	 */
	scatteringByWavelength?: readonly number[];

	/**
	 * Store total absorption coefficients aligned to wavelengthsNm.
	 */
	absorptionByWavelength?: readonly number[];

	/**
	 * Identify whether totals were direct, species-summed, vacuum, or derived.
	 */
	derivation?: string;
}

/**
 * Store resolved downstream-ready medium coefficients.
 */
type AtmosphereReferenceResolvedMediumCoefficients = {
	/**
	 * Store total extinction coefficients aligned to wavelengthsNm.
	 */
	extinctionByWavelength: number[];

	/**
	 * Store total scattering coefficients aligned to wavelengthsNm.
	 */
	scatteringByWavelength: number[];

	/**
	 * Store total absorption coefficients aligned to wavelengthsNm.
	 */
	absorptionByWavelength: number[];

	/**
	 * Identify whether totals were direct, species-summed, vacuum, or derived.
	 */
	derivation: string;
}

/**
 * Store one species or component contribution at a medium sample.
 */
type AtmosphereReferenceMediumSpecies = AtmosphereReferenceMediumCoefficients & {
	/**
	 * Identify the model-owned species or component name.
	 */
	name: string;

	/**
	 * Preserve optional model-owned phase-function metadata.
	 */
	phase?: {
		/**
		 * Identify the phase function to evaluate.
		 */
		kind: string;

		/**
		 * Preserve phase-function parameters.
		 */
		parameters?: Record<string, unknown>;
	};
}

/**
 * Store fractional-volume composition diagnostics supplied by the model.
 */
type AtmosphereReferenceCompositionDiagnostics = {
	/**
	 * Store listed fractional-volume components by species name.
	 */
	fractions?: Record<string, number>;

	/**
	 * Store the model-supplied sum of listed fractions.
	 */
	listedFractionSum?: number;

	/**
	 * Store the model-supplied residual for unlisted gases/components.
	 */
	unlistedResidual?: number;

	/**
	 * Preserve model-specific composition diagnostics.
	 */
	[key: string]: unknown;
}

/**
 * Store model-owned medium profile diagnostics at one sample.
 */
type AtmosphereReferenceMediumProfile = {
	/**
	 * Store density in kilograms per cubic meter, when supplied.
	 */
	densityKgPerM3?: number;

	/**
	 * Store pressure in pascals, when supplied.
	 */
	pressurePa?: number;

	/**
	 * Store temperature in kelvin, when supplied.
	 */
	temperatureK?: number;

	/**
	 * Store number density in inverse cubic meters, when supplied.
	 */
	numberDensityPerM3?: number;

	/**
	 * Store model-owned composition diagnostics, when supplied.
	 */
	composition?: AtmosphereReferenceCompositionDiagnostics;
}

/**
 * Describe one model-owned medium-state lookup.
 */
type AtmosphereReferenceMediumState = {
	/**
	 * Mark this sample as vacuum or outside the participating medium.
	 */
	vacuum?: boolean;

	/**
	 * Store whether the queried position is inside the atmosphere volume.
	 */
	contains?: boolean;

	/**
	 * Store profile diagnostics, when supplied.
	 */
	profile?: AtmosphereReferenceMediumProfile;

	/**
	 * Store total coefficient arrays, when supplied.
	 */
	coefficients?: AtmosphereReferenceMediumCoefficients;

	/**
	 * Store per-species/component coefficient arrays, when supplied.
	 */
	species?: readonly AtmosphereReferenceMediumSpecies[];
}

/**
 * Describe one medium evaluation emitted by evaluateMedium.
 */
type AtmosphereReferenceMediumSample = AtmosphereReferenceViewSample & {
	/**
	 * Store the model-space sample position, in kilometers.
	 */
	positionKm: AtmosphereReferenceVector3Tuple;

	/**
	 * Store geometric altitude, in kilometers.
	 */
	altitudeKm: number;

	/**
	 * Store profile diagnostics, when supplied.
	 */
	profile?: AtmosphereReferenceMediumProfile;

	/**
	 * Store downstream-ready coefficient totals.
	 */
	coefficients: AtmosphereReferenceResolvedMediumCoefficients;

	/**
	 * Store per-species/component diagnostics, when supplied.
	 */
	species?: AtmosphereReferenceMediumSpecies[];
}

/**
 * Store cumulative optical-depth diagnostics for one species.
 */
type AtmosphereReferenceSpeciesOpticalDepth = {
	/**
	 * Store cumulative optical depth aligned to wavelengthsNm.
	 */
	cumulativeOpticalDepthByWavelength: number[];
}

/**
 * Store one camera-to-sample optical-depth diagnostic.
 */
type AtmosphereReferenceViewOpticalDepthSample = {
	/**
	 * Store the sample index.
	 */
	sampleIndex: number;

	/**
	 * Store sample distance from observer, in kilometers.
	 */
	distanceFromObserverKm: number;

	/**
	 * Store cumulative optical depth aligned to wavelengthsNm.
	 */
	cumulativeOpticalDepthByWavelength: number[];

	/**
	 * Store Beer-Lambert transmittance aligned to wavelengthsNm.
	 */
	viewTransmittanceByWavelength: number[];

	/**
	 * Store cumulative species optical-depth diagnostics.
	 */
	speciesOpticalDepth: Record<string, AtmosphereReferenceSpeciesOpticalDepth>;
}

/**
 * Store camera-to-path-end optical-depth diagnostics.
 */
type AtmosphereReferenceViewOpticalDepthPathEnd = {
	/**
	 * Store the selected path end distance from observer, in kilometers.
	 */
	distanceFromObserverKm: number;

	/**
	 * Store cumulative optical depth aligned to wavelengthsNm.
	 */
	cumulativeOpticalDepthByWavelength: number[];

	/**
	 * Store Beer-Lambert transmittance aligned to wavelengthsNm.
	 */
	viewTransmittanceByWavelength: number[];

	/**
	 * Store cumulative species optical-depth diagnostics.
	 */
	speciesOpticalDepth: Record<string, AtmosphereReferenceSpeciesOpticalDepth>;
}

/**
 * Store optical-depth output emitted by integrateViewOpticalDepth.
 */
type AtmosphereReferenceViewOpticalDepth = {
	/**
	 * Store camera-to-sample diagnostics.
	 */
	samples: AtmosphereReferenceViewOpticalDepthSample[];

	/**
	 * Store camera-to-path-end diagnostics.
	 */
	pathEnd: AtmosphereReferenceViewOpticalDepthPathEnd;
}

/**
 * Store one model-owned source-path integration sample.
 */
type AtmosphereReferenceSolarTransmittanceSegmentSample = {
	/**
	 * Store source-path distance weight in kilometers.
	 */
	weightKm: number;

	/**
	 * Store source-path extinction coefficients aligned to wavelengthsNm.
	 */
	extinctionByWavelength: readonly number[];
}

/**
 * Store a model-owned source-path segment from a medium sample to a source sample.
 */
type AtmosphereReferenceSolarTransmittanceSegment = {
	/**
	 * Identify whether the source path is visible.
	 */
	visible?: boolean;

	/**
	 * Store source-path integration samples.
	 */
	samples?: readonly AtmosphereReferenceSolarTransmittanceSegmentSample[];

	/**
	 * Explain which model boundary affected the source path.
	 */
	boundaryReason?: string;
}

/**
 * Store model-supplied source spectral energy aligned to wavelengthsNm.
 */
type AtmosphereReferenceSourceSpectrum = {
	/**
	 * Identify whether the values represent radiance or irradiance.
	 */
	kind: "spectral-radiance" | "spectral-irradiance";

	/**
	 * Store source energy values aligned to wavelengthsNm.
	 */
	valuesByWavelength: readonly number[];

	/**
	 * Store physical units for the source energy values.
	 */
	units: string;

	/**
	 * Explain how the model supplied or derived the spectrum.
	 */
	derivation: string;
}

/**
 * Store one model-owned solar source sample.
 */
type AtmosphereReferenceSolarSourceSample = {
	/**
	 * Identify the source sample.
	 */
	id?: string | number;

	/**
	 * Store the source direction used for phase evaluation.
	 */
	direction: AtmosphereReferenceVector3Tuple;

	/**
	 * Store source quadrature weight, when supplied.
	 */
	weight?: number;

	/**
	 * Store source sample solid angle in steradians, when supplied.
	 */
	solidAngleSr?: number;

	/**
	 * Store model-supplied source spectral energy.
	 */
	sourceSpectrum: AtmosphereReferenceSourceSpectrum;

	/**
	 * Allow controlled test adapters to carry the source-path segment with the sample.
	 */
	segment?: AtmosphereReferenceSolarTransmittanceSegment;

	/**
	 * Preserve model-specific source-sample diagnostics.
	 */
	[key: string]: unknown;
}

/**
 * Store one integrated source sample emitted by integrateSolarTransmittance.
 */
type AtmosphereReferenceSolarTransmittanceSourceSample = {
	/**
	 * Store source sample index for this medium sample.
	 */
	sourceSampleIndex: number;

	/**
	 * Preserve model-owned source sample id.
	 */
	sourceSampleId: string | number;

	/**
	 * Preserve model-owned source direction for phase evaluation.
	 */
	direction: AtmosphereReferenceVector3Tuple;

	/**
	 * Preserve source quadrature weight, when supplied.
	 */
	weight?: number;

	/**
	 * Preserve source solid angle in steradians, when supplied.
	 */
	solidAngleSr?: number;

	/**
	 * Preserve model-supplied source spectral energy for downstream radiance integration.
	 */
	sourceSpectrum: AtmosphereReferenceSourceSpectrum;

	/**
	 * Identify whether this source path reaches the source.
	 */
	visible: boolean;

	/**
	 * Store integrated source-path length in kilometers for visible paths.
	 */
	pathLengthKm: number;

	/**
	 * Store source-path optical depth aligned to wavelengthsNm, or null when occluded.
	 */
	opticalDepthByWavelength: number[] | null;

	/**
	 * Store source-path Beer-Lambert transmittance aligned to wavelengthsNm.
	 */
	sourceTransmittanceByWavelength: number[];

	/**
	 * Explain which model boundary affected the source path.
	 */
	boundaryReason?: string;
}

/**
 * Store one medium-sample solar-transmittance packet.
 */
type AtmosphereReferenceSolarTransmittanceSample = {
	/**
	 * Store the medium sample index.
	 */
	sampleIndex: number;

	/**
	 * Store medium sample distance from observer, in kilometers.
	 */
	distanceFromObserverKm: number;

	/**
	 * Store medium sample position in model kilometers.
	 */
	positionKm: AtmosphereReferenceVector3Tuple;

	/**
	 * Store integrated source samples for this medium sample.
	 */
	sourceSamples: AtmosphereReferenceSolarTransmittanceSourceSample[];
}

/**
 * Store solar transmittance evaluated at the selected surface hit.
 */
type AtmosphereReferenceSolarTransmittanceSurfacePoint = {
	/**
	 * Store selected surface distance from the observer, in kilometers.
	 */
	distanceFromObserverKm: number;

	/**
	 * Store selected surface position in model kilometers.
	 */
	positionKm: AtmosphereReferenceVector3Tuple;

	/**
	 * Preserve the model-owned surface hit.
	 */
	surfaceHit: AtmosphereReferenceSurfaceHit;

	/**
	 * Store integrated source samples for the surface point.
	 */
	sourceSamples: AtmosphereReferenceSolarTransmittanceSourceSample[];
}

/**
 * Store source-path transmittance output emitted by integrateSolarTransmittance.
 */
type AtmosphereReferenceSolarTransmittance = {
	/**
	 * Store source transmittance for each medium sample.
	 */
	samples: AtmosphereReferenceSolarTransmittanceSample[];

	/**
	 * Store source transmittance for the selected visible surface point.
	 */
	surfacePoint?: AtmosphereReferenceSolarTransmittanceSurfacePoint;

	/**
	 * Store run-level source-transmittance metadata.
	 */
	metadata: {
		/**
		 * Count medium samples evaluated.
		 */
		sampleCount: number;

		/**
		 * Count source samples evaluated.
		 */
		sourceSampleCount: number;

		/**
		 * Identify whether surfacePoint is present.
		 */
		includesSurfacePoint: boolean;
	};
}

/**
 * Store phase values for one species/source pair.
 */
type AtmosphereReferenceScatteringPhaseSpecies = {
	/**
	 * Preserve model-owned species or component name.
	 */
	name: string;

	/**
	 * Identify the evaluated phase function.
	 */
	phaseKind: string;

	/**
	 * Preserve phase-function parameters used by the evaluation.
	 */
	parameters: Record<string, unknown>;

	/**
	 * Store phase value aligned to wavelengthsNm, in inverse steradians.
	 */
	phaseByWavelength: number[];
}

/**
 * Store scattering angle diagnostics for one source sample.
 */
type AtmosphereReferenceScatteringPhaseSourceSample = {
	/**
	 * Store source sample index for this medium sample.
	 */
	sourceSampleIndex: number;

	/**
	 * Preserve model-owned source sample id.
	 */
	sourceSampleId: string | number;

	/**
	 * Store local scattering convention cosine.
	 */
	cosTheta: number;

	/**
	 * Store scattering angle in radians.
	 */
	scatteringAngleRad: number;

	/**
	 * Store per-species phase values for this source sample.
	 */
	species: AtmosphereReferenceScatteringPhaseSpecies[];
}

/**
 * Store phase diagnostics for one medium sample.
 */
type AtmosphereReferenceScatteringPhaseSample = {
	/**
	 * Store medium sample index.
	 */
	sampleIndex: number;

	/**
	 * Store source-sample phase diagnostics.
	 */
	sourceSamples: AtmosphereReferenceScatteringPhaseSourceSample[];
}

/**
 * Store scattering phase stage output.
 */
type AtmosphereReferenceScatteringPhase = {
	/**
	 * Store medium/source/species phase diagnostics.
	 */
	samples: AtmosphereReferenceScatteringPhaseSample[];

	/**
	 * Store phase-evaluation metadata.
	 */
	metadata: {
		/**
		 * Describe the local cosine/sign convention.
		 */
		convention: string;

		/**
		 * Count medium samples with phase diagnostics.
		 */
		sampleCount: number;

		/**
		 * Count source samples evaluated across all medium samples.
		 */
		sourceSampleCount: number;
	};
}

/**
 * Store one species contribution to single scattering.
 */
type AtmosphereReferenceSingleScatteringSpeciesContribution = {
	/**
	 * Preserve species name.
	 */
	name: string;

	/**
	 * Store spectral radiance contribution aligned to wavelengthsNm.
	 */
	contributionByWavelength: number[];
}

/**
 * Store one source-sample single-scattering contribution.
 */
type AtmosphereReferenceSingleScatteringSourceSample = {
	/**
	 * Store source sample index.
	 */
	sourceSampleIndex: number;

	/**
	 * Preserve source sample id.
	 */
	sourceSampleId: string | number;

	/**
	 * Store per-species contributions.
	 */
	species: AtmosphereReferenceSingleScatteringSpeciesContribution[];

	/**
	 * Store summed source contribution aligned to wavelengthsNm.
	 */
	contributionByWavelength: number[];
}

/**
 * Store one medium-sample single-scattering contribution.
 */
type AtmosphereReferenceSingleScatteringSample = {
	/**
	 * Store medium sample index.
	 */
	sampleIndex: number;

	/**
	 * Store source sample contributions.
	 */
	sourceSamples: AtmosphereReferenceSingleScatteringSourceSample[];

	/**
	 * Store summed medium-sample contribution aligned to wavelengthsNm.
	 */
	contributionByWavelength: number[];
}

/**
 * Store single-scattering output.
 */
type AtmosphereReferenceSingleScattering = {
	/**
	 * Store sample/source/species contribution diagnostics.
	 */
	samples: AtmosphereReferenceSingleScatteringSample[];

	/**
	 * Store component summaries.
	 */
	components: {
		bySpecies: Record<string, { radianceByWavelength: number[] }>;
		rayleighInScatteredRadianceByWavelength: number[];
		mieInScatteredRadianceByWavelength: number[];
		cloudInScatteredRadianceByWavelength: number[];
	};

	/**
	 * Store total in-scattered spectral radiance.
	 */
	inScatteredRadianceByWavelength: number[];
}

/**
 * Store diagnostic diffuse-sky-airlight approximation output.
 */
type AtmosphereReferenceDiffuseSkyAirlight = {
	/**
	 * Identify the approximation mode.
	 */
	mode: "aerosol-aware-lost-transmittance-haze-lift";

	/**
	 * Store added approximate diffuse-sky-airlight spectral radiance.
	 */
	radianceByWavelength: number[];

	/**
	 * Store canonical single scattering plus the approximation.
	 */
	renderedSinglePlusSkyAirlightByWavelength: number[];

	/**
	 * Store approximation diagnostics.
	 */
	diagnostics: {
		contract: {
			transportOrder: string;
			bounded: boolean;
			calibrationStatus: string;
			approximationWarning: string;
		};
		activation: number;
		activationTau: number;
		activationPolicy: string;
		strength: number;
		aerosolOpticalDepthByWavelength: number[];
		aerosolOpticalDepthFractionByWavelength: number[];
		maxAerosolOpticalDepth: number;
		aerosolSaturationByWavelength: number[];
		aerosolParticipationByWavelength: number[];
		neutralSourceSpectrum: number;
		neutralMixByWavelength: number[];
		aerosolGainByWavelength: number[];
		aerosolPolicy: {
			neutralMixMax: number;
			multipleScatterGain: number;
		};
		tauRegime: string;
		flatGeometryLimitPolicy: string;
		lostViewTransmittanceByWavelength: number[];
		sourceSpectrumByWavelength: number[];
		canonicalSingleScatteringByWavelength: number[];
		approximationWarning: string;
	};
}

/**
 * Store surface-radiance output.
 */
type AtmosphereReferenceSurfaceRadiance = {
	/**
	 * Preserve selected surface hit, if any.
	 */
	hit: AtmosphereReferenceSurfaceHit | null;

	/**
	 * Store surface normal when a hit exists.
	 */
	normal?: AtmosphereReferenceVector3Tuple;

	/**
	 * Store direct irradiance reaching the surface.
	 */
	directIrradianceByWavelength?: number[];

	/**
	 * Store diffuse sky irradiance reaching the surface.
	 */
	diffuseSkyIrradianceByWavelength?: number[];

	/**
	 * Store surface-leaving radiance before view attenuation.
	 */
	surfaceLeavingRadianceByWavelength?: number[];

	/**
	 * Store camera-visible surface radiance after view attenuation.
	 */
	viewAttenuatedRadianceByWavelength: number[];

	/**
	 * Store component summaries.
	 */
	components?: {
		directByWavelength: number[];
		diffuseByWavelength: number[];
		emittedByWavelength: number[];
	};

	/**
	 * Store surface-stage diagnostics.
	 */
	metadata: Record<string, unknown>;
}

/**
 * Store final composed spectral radiance.
 */
type AtmosphereReferenceSpectralRadiance = {
	/**
	 * Preserve active wavelength grid.
	 */
	wavelengthsNm: number[];

	/**
	 * Store final spectral radiance aligned to wavelengthsNm.
	 */
	finalByWavelength: number[];

	/**
	 * Store component summaries consumed by composition.
	 */
	components: {
		inScatteredRadianceByWavelength: number[];
		diffuseSkyAirlightRadianceByWavelength: number[];
		surfaceViewAttenuatedRadianceByWavelength: number[];
	};

	/**
	 * Store composition diagnostics.
	 */
	metadata: {
		clamped: boolean;
		colorConverted: boolean;
	};
}

/**
 * Provide world geometry behavior.
 */
type AtmosphereReferenceWorldModel = {
	/**
	 * Return altitude at a model-space position, in kilometers.
	 */
	altitudeAt(positionKm: AtmosphereReferenceVector3Tuple): number;

	/**
	 * Return the local up direction at a model-space position.
	 */
	upAt(positionKm: AtmosphereReferenceVector3Tuple): AtmosphereReferenceVector3Tuple;

	/**
	 * Return the nearest opaque surface hit along a transport ray, if any.
	 */
	intersectSurface(
		ray: AtmosphereReferenceTransportRay
	): AtmosphereReferenceSurfaceHit | null;

	/**
	 * Return the surface normal for a model-owned surface hit.
	 */
	surfaceNormalAt(hit: AtmosphereReferenceSurfaceHit): AtmosphereReferenceVector3Tuple;
}

/**
 * Provide atmosphere medium behavior.
 */
type AtmosphereReferenceAtmosphereModel = {
	/**
	 * Return the atmosphere interval along a transport ray, if any.
	 */
	intersect(
		ray: AtmosphereReferenceTransportRay
	): AtmosphereReferenceAtmosphereIntersection | null;

	/**
	 * Return whether a model-space position lies inside the atmosphere volume.
	 */
	contains(positionKm: AtmosphereReferenceVector3Tuple): boolean;

	/**
	 * Return complete medium state for one sampled position and active wavelength grid.
	 */
	mediumAt?(
		positionKm: AtmosphereReferenceVector3Tuple,
		query?: {
			wavelengthsNm?: readonly number[];
			sample?: AtmosphereReferenceViewSample;
		}
	): AtmosphereReferenceMediumState;

	/**
	 * Return normalized density for one medium species at a position.
	 */
	densityAt(positionKm: AtmosphereReferenceVector3Tuple, species: string): number;

	/**
	 * Return extinction coefficients aligned to the active wavelength grid.
	 */
	extinctionAt(positionKm: AtmosphereReferenceVector3Tuple, wavelengthNm: number): unknown;

	/**
	 * Return scattering coefficients aligned to the active wavelength grid.
	 */
	scatteringAt(positionKm: AtmosphereReferenceVector3Tuple, wavelengthNm: number): unknown;
}

/**
 * Provide solar-source behavior.
 */
type AtmosphereReferenceSolarSourceModel = {
	/**
	 * Return source samples visible from a model-space position.
	 */
	samplesAt(
		positionKm: AtmosphereReferenceVector3Tuple,
		wavelengthNm?: number,
		numerical?: AtmosphereReferenceNumericalControls
	): readonly AtmosphereReferenceSolarSourceSample[];

	/**
	 * Return a model-owned source-path segment from a medium sample to one source sample.
	 */
	transmittanceSegment(
		positionKm: AtmosphereReferenceVector3Tuple,
		sourceSample: AtmosphereReferenceSolarSourceSample,
		query?: {
			wavelengthsNm?: readonly number[];
			mediumSample?: AtmosphereReferenceMediumSample;
			surfacePoint?: Omit<AtmosphereReferenceSolarTransmittanceSurfacePoint, "sourceSamples">;
			numerical?: Readonly<AtmosphereReferenceNumericalControls>;
		}
	): AtmosphereReferenceSolarTransmittanceSegment;
}

/**
 * Provide surface-radiance behavior.
 */
type AtmosphereReferenceSurfaceModel = {
	/**
	 * Return reflected spectral radiance for a model-owned surface hit.
	 */
	radianceAt(
		hit: AtmosphereReferenceSurfaceHit,
		wavelengthNm?: number,
		lighting?: unknown
	): readonly number[];
}

/**
 * Describe the swappable physical model bundle consumed by the reference.
 */
type AtmosphereReferenceModel = {
	/**
	 * Provide world geometry behavior.
	 */
	world: AtmosphereReferenceWorldModel;

	/**
	 * Provide atmosphere medium behavior.
	 */
	atmosphere: AtmosphereReferenceAtmosphereModel;

	/**
	 * Provide solar source behavior.
	 */
	solarSource: AtmosphereReferenceSolarSourceModel;

	/**
	 * Provide surface reflection behavior.
	 */
	surface: AtmosphereReferenceSurfaceModel;
}

/**
 * Identify a canonical reference pipeline stage.
 */
type AtmosphereReferenceStageId =
	| "validateRequest"
	| "resolveRayPath"
	| "sampleViewPath"
	| "evaluateMedium"
	| "integrateViewOpticalDepth"
	| "integrateSolarTransmittance"
	| "evaluateScatteringPhase"
	| "integrateSingleScattering"
	| "integrateDiffuseSkyAirlight"
	| "resolveSurfaceRadiance"
	| "composeSpectralRadiance";

/**
 * Describe one pipeline stage.
 */
type AtmosphereReferenceStageDescriptor = {
	/**
	 * Store the stable canonical stage id.
	 */
	id: AtmosphereReferenceStageId | string;

	/**
	 * List packet fields required before the stage can run.
	 */
	requires: readonly string[];

	/**
	 * List packet fields added by the stage.
	 */
	provides: readonly string[];

	/**
	 * Construct the helper object that runs this stage.
	 */
	StageClass?: AtmosphereReferenceStageClass;

}

/**
 * Construct a pipeline-stage helper.
 */
type AtmosphereReferenceStageClass = new (
	options: AtmosphereReferenceStageHelperOptions
) => AtmosphereReferenceStageHelper;

/**
 * Configure one pipeline-stage helper.
 */
type AtmosphereReferenceStageHelperOptions = {
	/**
	 * Provide the public descriptor for this stage.
	 */
	descriptor: AtmosphereReferenceStageDescriptor;

	/**
	 * Provide integrator defaults for helpers that need them.
	 */
	context?: Readonly<AtmosphereReferenceIntegratorOptions>;
}

/**
 * Run one pipeline stage.
 */
type AtmosphereReferenceStageHelper = {
	/**
	 * Transform one prepared packet.
	 */
	run(packet: AtmosphereReferencePacket): AtmosphereReferencePacket;
}

/**
 * Describe options used to create the reference integrator.
 */
type AtmosphereReferenceIntegratorOptions = {
	/**
	 * Provide the default physical model bundle.
	 */
	model?: AtmosphereReferenceModel;

	/**
	 * Provide the default wavelength sample grid in nanometers.
	 */
	wavelengthsNm?: readonly number[];

	/**
	 * Provide default numerical approximation controls.
	 */
	numerical?: AtmosphereReferenceNumericalControls;

	/**
	 * Override stage descriptors for internal test harnesses.
	 *
	 * This is not part of the official public package contract.
	 */
	stages?: readonly AtmosphereReferenceStageDescriptor[];
}

/**
 * Describe one explicit ray request.
 */
type AtmosphereReferenceTraceRequest = {
	/**
	 * Override the integrator default physical model.
	 */
	model?: AtmosphereReferenceModel;

	/**
	 * Store the observer.
	 */
	observer?: AtmosphereReferenceObserver;

	/**
	 * Store the camera ray.
	 */
	ray?: AtmosphereReferenceRay;

	/**
	 * Override the wavelength grid in nanometers.
	 */
	wavelengthsNm?: readonly number[];

	/**
	 * Override numerical controls.
	 */
	numerical?: AtmosphereReferenceNumericalControls;
}

/**
 * Describe a request after validateRequest has canonicalized it.
 */
type AtmosphereReferenceValidatedTraceRequest = {
	/**
	 * Store the validated model bundle.
	 */
	model: AtmosphereReferenceModel;

	/**
	 * Store the validated observer.
	 */
	observer: AtmosphereReferenceObserver;

	/**
	 * Store the validated camera ray.
	 */
	ray: AtmosphereReferenceRay;

	/**
	 * Store the validated wavelength grid in nanometers.
	 */
	wavelengthsNm: readonly number[];

	/**
	 * Store validated numerical controls.
	 */
	numerical: Readonly<AtmosphereReferenceNumericalControls>;
}

/**
 * Describe a named or inline probe.
 */
type AtmosphereReferenceProbe = AtmosphereReferenceTraceRequest & {
	/**
	 * Identify the probe.
	 */
	id?: string;

	/**
	 * Provide an explicit nested request.
	 */
	request?: AtmosphereReferenceTraceRequest;
}

/**
 * Describe the packet passed between reference stages.
 */
type AtmosphereReferencePacket = AtmosphereReferenceTraceRequest & {
	/**
	 * Store the merged request used to create the packet.
	 */
	request?: AtmosphereReferenceTraceRequest;

	/**
	 * Store the public diagnostic list of successfully executed stage ids in order.
	 */
	stageHistory?: string[];

	/**
	 * Store the validated request after validateRequest has run.
	 */
	validatedRequest?: AtmosphereReferenceValidatedTraceRequest;

	/**
	 * Store the ray path selected by resolveRayPath.
	 */
	rayPath?: AtmosphereReferenceRayPath;

	/**
	 * Store midpoint samples along the selected view path.
	 */
	viewSamples?: AtmosphereReferenceViewSample[];

	/**
	 * Store medium evaluations along the selected view path.
	 */
	mediumSamples?: AtmosphereReferenceMediumSample[];

	/**
	 * Store view optical-depth diagnostics.
	 */
	viewOpticalDepth?: AtmosphereReferenceViewOpticalDepth;

	/**
	 * Store sample-to-source transmittance diagnostics.
	 */
	solarTransmittance?: AtmosphereReferenceSolarTransmittance;

	/**
	 * Store angular phase diagnostics.
	 */
	scatteringPhase?: AtmosphereReferenceScatteringPhase;

	/**
	 * Store single-scattering radiance diagnostics.
	 */
	singleScattering?: AtmosphereReferenceSingleScattering;

	/**
	 * Store diagnostic diffuse-sky-airlight approximation output.
	 */
	diffuseSkyAirlight?: AtmosphereReferenceDiffuseSkyAirlight;

	/**
	 * Store surface radiance diagnostics.
	 */
	surfaceRadiance?: AtmosphereReferenceSurfaceRadiance;

	/**
	 * Store final composed spectral radiance.
	 */
	spectralRadiance?: AtmosphereReferenceSpectralRadiance;

	/**
	 * Store diagnostic metadata for view-path sampling.
	 */
	viewSampleMetadata?: AtmosphereReferenceViewSampleMetadata;

	/**
	 * Allow stage-specific fields while the stage contracts are still evolving.
	 */
	[key: string]: unknown;
}

/**
 * Describe the full diagnostic packet returned by traceRay.
 */
type AtmosphereReferenceResult = AtmosphereReferencePacket;
