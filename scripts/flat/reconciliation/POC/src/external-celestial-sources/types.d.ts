type SpectralDensityQuantity =
    | 'spectral-irradiance-density'
    | 'spectral-radiance-density';

type CelestialSourceKind = 'point' | 'extended';

type SpectralDensityChannel = {
    readonly id: string;
    readonly centerNanometers: number;
    readonly lowerBoundNanometers: number;
    readonly upperBoundNanometers: number;
    readonly widthNanometers: number;
};

type SpectralDensityBasisConfiguration = {
    readonly id: string;
    readonly wavelengthUnits: 'nm';
    readonly sampleSemantics: 'bin-average-spectral-density';
    readonly quadrature: string;
    readonly channels: readonly SpectralDensityChannel[];
    readonly provenance: Readonly<Record<string, unknown>>;
};

type SpectralDensityBasisDescriptor = SpectralDensityBasisConfiguration & {
    readonly fingerprint: string;
};

type SpectralDensityUncertainty = Readonly<{
    readonly status: 'known' | 'partial' | 'unknown' | 'analytic-fixture';
    readonly model: string;
    readonly values?: readonly number[];
    readonly systematicValues?: readonly number[];
    readonly notes?: readonly string[];
}>;

type SpectralDensityPacketConfiguration = {
    readonly quantity: SpectralDensityQuantity;
    readonly units: string;
    readonly basis: import('./SpectralDensityBasis.js').default;
    readonly values: readonly number[];
    readonly provenance: Readonly<Record<string, unknown>>;
    readonly uncertainty: SpectralDensityUncertainty;
};

type SpectralDensityPacketDescriptor = {
    readonly quantity: SpectralDensityQuantity;
    readonly units: string;
    readonly basis: SpectralDensityBasisDescriptor;
    readonly values: readonly number[];
    readonly provenance: Readonly<Record<string, unknown>>;
    readonly uncertainty: SpectralDensityUncertainty;
    readonly fingerprint: string;
};

type CelestialGeometryOwnershipDescriptor = Readonly<{
    readonly kind: string;
    readonly owner: string;
    readonly [key: string]: unknown;
}>;

type ExternalCelestialSourceConfiguration = {
    readonly id: string;
    readonly kind: CelestialSourceKind;
    readonly geometry: CelestialGeometryOwnershipDescriptor;
    readonly spectralMeasure: import('./SpectralDensityPacket.js').default;
};

type PiecewiseLinearSpectralSampleSet = {
    readonly wavelengthsNanometers: readonly number[];
    readonly densityValues: readonly number[];
};

type BinnedSpectralDensityChannel = SpectralDensityChannel & {
    readonly integratedValue: number;
    readonly densityValue: number;
    readonly contributingSegmentCount: number;
};

type BinnedSpectralDensityResult = {
    readonly method: 'piecewise-linear-exact-bin-integral-v1';
    readonly sourceMinimumNanometers: number;
    readonly sourceMaximumNanometers: number;
    readonly channels: readonly BinnedSpectralDensityChannel[];
    readonly values: readonly number[];
    readonly representedIntegral: number;
};

type LimeNumericDataset = Readonly<{
    readonly name: string;
    readonly shape: readonly number[];
    readonly dtype: string;
    readonly attributes: Readonly<Record<string, unknown>>;
    readonly values: readonly number[] | Float64Array;
}>;

type LimeCalibrationEntry = Readonly<{
    readonly name: string;
    readonly byteLength: number;
    readonly sourceHashSha256: string;
    readonly text: string;
}>;

type LimeCalibrationFixtures = Readonly<{
    readonly coefficients: Readonly<{
        readonly attributes: Readonly<Record<string, unknown>>;
        readonly keys: readonly string[];
        readonly wavelength: LimeNumericDataset;
        readonly coefficients: LimeNumericDataset;
        readonly relativeUncertaintyPercent: LimeNumericDataset;
        readonly errorCorrelation: LimeNumericDataset;
    }>;
    readonly asd: Readonly<{
        readonly attributes: Readonly<Record<string, unknown>>;
        readonly keys: readonly string[];
        readonly wavelength: LimeNumericDataset;
        readonly phaseAngle: LimeNumericDataset;
        readonly reflectance: LimeNumericDataset;
        readonly relativeUncertaintyPercent: LimeNumericDataset;
        readonly wavelengthCorrelation: Readonly<{
            readonly name: string;
            readonly shape: readonly number[];
            readonly dtype: string;
            readonly attributes: Readonly<Record<string, unknown>>;
            readonly values: Float64Array;
        }>;
        readonly phaseCorrelation: Readonly<{
            readonly name: string;
            readonly shape: readonly number[];
            readonly dtype: string;
            readonly attributes: Readonly<Record<string, unknown>>;
            readonly values: Float64Array;
        }>;
    }>;
    readonly entries: Readonly<{
        readonly changelog: LimeCalibrationEntry;
        readonly reflectanceEvaluator: LimeCalibrationEntry;
        readonly irradianceEvaluator: LimeCalibrationEntry;
        readonly spectralInterpolation: LimeCalibrationEntry;
        readonly interpolationSettings: LimeCalibrationEntry;
        readonly cimelResponses: LimeCalibrationEntry;
        readonly defaultTsisSolarReference: LimeCalibrationEntry;
    }>;
    readonly provenance: Readonly<Record<string, unknown>>;
}>;

type LimeCoefficientModelConfiguration = Readonly<{
    readonly fixtures: LimeCalibrationFixtures;
    readonly basis: import('./SpectralDensityBasis.js').default;
    readonly canonicalSolar: import('./SpectralDensityPacket.js').default;
}>;

type LimeGeometryInput = Readonly<{
    readonly absolutePhaseDegrees: number;
    readonly sunSelenographicLongitudeRadians: number;
    readonly observerSelenographicLatitudeDegrees: number;
    readonly observerSelenographicLongitudeDegrees: number;
}>;

type LimeDistanceInput = Readonly<{
    readonly id: string;
    readonly sunMoonDistanceAstronomicalUnits: number;
    readonly observerMoonDistanceKilometers: number;
}>;

type LimeCalibrationRequest = Readonly<{
    readonly id: string;
    readonly signedPhaseDegrees: number;
    readonly geometry: LimeGeometryInput;
    readonly distanceCases: readonly LimeDistanceInput[];
}>;

type LimeAnchorTermEvaluation = Readonly<{
    readonly wavelengthNanometers: number;
    readonly interpretation: string;
    readonly aTerms: readonly number[];
    readonly bTerms: readonly number[];
    readonly cTerms: readonly number[];
    readonly dTerms: readonly number[];
    readonly logReflectance: number;
    readonly reflectance: number;
}>;

type LimeAnchorUncertainty = Readonly<{
    readonly method: string;
    readonly standardUncertainties: readonly number[];
    readonly relativeStandardUncertaintyPercent: readonly number[];
    readonly covariance: readonly (readonly number[])[];
    readonly correlation: readonly (readonly number[])[];
}>;

type LimeResponseSample = Readonly<{
    readonly wavelengthNanometers: number;
    readonly response: number;
}>;

type LimeReferenceSpectrum = Readonly<{
    readonly wavelengthsNanometers: readonly number[];
    readonly values: readonly number[];
    readonly uncertainties: readonly number[];
}>;

type LimeSelectedAsdSpectrum = Readonly<{
    readonly requestedSignedPhaseDegrees: number;
    readonly selectedSignedPhaseDegrees: number;
    readonly phaseSelectionOffsetDegrees: number;
    readonly phaseSelectionMethod: string;
    readonly phaseIndex: number;
    readonly wavelengthsNanometers: readonly number[];
    readonly reflectance: readonly number[];
    readonly relativeUncertaintyPercent: readonly number[];
}>;

type LimeAnchorSpectralCorrectionRow = Readonly<{
    readonly wavelengthNanometers: number;
    readonly rawReflectance: number;
    readonly asdPointReflectance: number;
    readonly asdResponseIntegratedReflectance: number;
    readonly responseCorrection: number;
    readonly correctedReflectance: number;
    readonly residualRatio: number;
}>;

type LimeAnchorSpectralCorrection = Readonly<{
    readonly method: string;
    readonly rows: readonly LimeAnchorSpectralCorrectionRow[];
}>;

type LimeHyperspectralReflectance = Readonly<{
    readonly method: string;
    readonly residualExtrapolation: string;
    readonly wavelengthsNanometers: readonly number[];
    readonly residualRatios: readonly number[];
    readonly reflectance: readonly number[];
    readonly cubicSecondDerivatives: readonly number[] | null;
}>;

type LimeCanonicalChannel = Readonly<{
    readonly id: string;
    readonly centerNanometers: number;
    readonly lowerBoundNanometers: number;
    readonly upperBoundNanometers: number;
    readonly widthNanometers: number;
    readonly value: number;
    readonly modelAssisted: Readonly<Record<string, unknown>>;
    readonly residualScalingSegments: readonly string[];
}>;

type AirLusiCalibrationFixture = Readonly<{
    /** Stores the strictly increasing 834-sample vacuum wavelength grid. */
    readonly wavelength: readonly number[];
    /** Stores four standardized disk-integrated irradiance spectra in microW m^-2 nm^-1. */
    readonly irradiance: readonly (readonly number[])[];
    /** Stores four dimensionless lunar disk-reflectance spectra. */
    readonly lunarDiskReflectance: readonly (readonly number[])[];
    /** Stores four relative standard-uncertainty spectra. */
    readonly totalRelativeError: readonly (readonly number[])[];
    /** Stores signed lunar phase in degrees for each flight. */
    readonly signedPhase: readonly number[];
    /** Stores observer selenographic longitude in degrees for each flight. */
    readonly subobserverLongitude: readonly number[];
    /** Stores observer selenographic latitude in degrees for each flight. */
    readonly subobserverLatitude: readonly number[];
    /** Stores Sun selenographic longitude in degrees for each flight. */
    readonly subsolarLongitude: readonly number[];
    /** Stores Sun selenographic latitude in degrees for each flight. */
    readonly subsolarLatitude: readonly number[];
    /** Stores observer-to-Moon distance in kilometers for each flight. */
    readonly observerMoonDistance: readonly number[];
    /** Stores Sun-to-Moon distance in kilometers for each flight. */
    readonly sunMoonDistance: readonly number[];
    /** Stores exact microsecond-resolution UTC timestamps. */
    readonly timestamps: readonly string[];
    /** Stores retained Air-LUSI flight identifiers. */
    readonly flightIds: readonly number[];
    /** Retains root and selected dataset attributes. */
    readonly attributes: Readonly<{
        readonly root: Readonly<Record<string, unknown>>;
        readonly datasets: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    }>;
    /** Retains the validated NetCDF schema. */
    readonly schema: Readonly<Record<string, unknown>>;
    /** Retains exact payload identity and time-coordinate provenance. */
    readonly provenance: Readonly<Record<string, unknown>>;
}>;

type LimeOutputOperatorConfiguration = Readonly<{
    /** Names the output transform. */
    readonly id: string;
    /** Names the physical output quantity. */
    readonly quantity: string;
    /** Names the output units. */
    readonly units: string;
    /** Applies one multiplicative weight at each ASD wavelength. */
    readonly spectralWeights: readonly number[] | Float64Array;
    /** Applies one multiplicative scale to each canonical channel. */
    readonly channelScales: readonly number[] | Float64Array;
    /** Describes the transform's claim boundary. */
    readonly qualification?: string;
}>;

type LimeOutputOperator = Readonly<{
    readonly id: string;
    readonly quantity: string;
    readonly units: string;
    readonly qualification: string;
    readonly shape: readonly [number, number];
    readonly values: Float64Array;
    readonly diagnostics: Readonly<Record<string, unknown>>;
}>;

type LimeJointUncertaintyResult = Readonly<{
    /** Names the deterministic propagation method. */
    readonly method: string;
    /** Describes the selected release-authoritative central branch. */
    readonly centralBranch: Readonly<Record<string, unknown>>;
    /** Describes evaluation, channel, covariance, and input dimensions. */
    readonly dimensions: Readonly<Record<string, unknown>>;
    /** Maps each stacked output index to its request and canonical channel. */
    readonly outputs: readonly Readonly<Record<string, unknown>>[];
    /** Stores the globally stacked central output vector. */
    readonly centralValues: readonly number[];
    /** Stores coherent interpolation and response-sign branch vectors. */
    readonly branchPredictions: Readonly<Record<string, unknown>>;
    /** Stores coefficient, ASD, model-form, and total covariance matrices. */
    readonly covariance: Readonly<Record<string, readonly (readonly number[])[]>>;
    /** Stores absolute and relative standard uncertainty. */
    readonly standardUncertainty: Readonly<{
        readonly values: readonly number[];
        readonly relativeValues: readonly number[];
    }>;
    /** Stores the total output correlation matrix. */
    readonly correlation: Readonly<Record<string, readonly (readonly number[])[]>>;
    /** Stores operator, input-correlation, covariance, and Jacobian checks. */
    readonly diagnostics: Readonly<Record<string, unknown>>;
}>;

type Rolo311gReferenceModelConfiguration = Readonly<{
    /** Supplies the destination canonical spectral-density basis. */
    readonly basis: import('./SpectralDensityBasis.js').default;
}>;

type Rolo311gEvaluation = Readonly<{
    /** Names the qualified comparison model. */
    readonly modelId: 'rolo-311g-qualified-reference';
    /** Names the disk-integrated reflectance quantity. */
    readonly quantity: 'dimensionless-disk-equivalent-lunar-reflectance';
    /** Names dimensionless output units. */
    readonly units: '1';
    /** Retains the exact evaluated lunar geometry. */
    readonly geometry: LimeGeometryInput;
    /** Retains all 32 published-band term evaluations. */
    readonly samples: readonly Readonly<Record<string, unknown>>[];
    /** Stores exact piecewise-linear averages on the configured basis. */
    readonly binnedReflectance: BinnedSpectralDensityResult;
    /** Qualifies use inside or outside the published fit phase domain. */
    readonly geometryQualification: Readonly<Record<string, unknown>>;
    /** Retains publication and coefficient provenance. */
    readonly provenance: Readonly<Record<string, unknown>>;
    /** Retains the model-reference claim boundary. */
    readonly qualifications: Readonly<Record<string, unknown>>;
}>;

type TsisHsrsReferenceSample = Readonly<{
    /** Stores the zero-based official CSV data-row index. */
    readonly sourceRowIndex: number;
    /** Stores the official published wavelength grid in nanometers without conversion. */
    readonly wavelengthNanometers: number;
    /** Stores solar spectral irradiance density in W m^-2 nm^-1. */
    readonly irradianceWattsPerSquareMeterPerNanometer: number;
    /** Stores the published k=1 spectral standard uncertainty in W m^-2 nm^-1. */
    readonly standardUncertaintyWattsPerSquareMeterPerNanometer: number;
    /** Stores the official nominal spectral bandwidth in nanometers. */
    readonly bandwidthNanometers: number;
}>;

type TsisHsrsVisibleIntegral = Readonly<{
    /** Names the exact visible-band integration operator. */
    readonly id: 'tsis1-hsrs-exact-visible-360-830-integral-v1';
    /** Names the integrated physical quantity. */
    readonly quantity: 'solar-spectral-irradiance-density-integrated-over-wavelength';
    /** Names integrated irradiance units. */
    readonly units: 'W m^-2';
    /** Stores the inclusive lower integration bound. */
    readonly lowerNanometers: 360;
    /** Stores the inclusive upper integration bound. */
    readonly upperNanometers: 830;
    /** Stores the integration interval width. */
    readonly widthNanometers: 470;
    /** Describes native-grid interpolation. */
    readonly interpolation: string;
    /** Retains the irradiance-integration formula. */
    readonly irradianceFormula: string;
    /** Retains the fully correlated uncertainty formula. */
    readonly uncertaintyFormula: string;
    /** Names the wavelength-correlation assumption. */
    readonly uncertaintyCorrelationModel: 'fully-correlated-across-wavelength-k1';
    /** Stores every native row index inside the interval. */
    readonly selectedSourceRowIndices: readonly number[];
    /** Stores the number of selected native samples. */
    readonly selectedSampleCount: number;
    /** Stores the number of clipped trapezoidal segments. */
    readonly contributingSegmentCount: number;
    /** Stores exact visible integrated irradiance. */
    readonly integratedIrradianceWattsPerSquareMeter: number;
    /** Stores the equivalent interval-average spectral density. */
    readonly averageIrradianceWattsPerSquareMeterPerNanometer: number;
    /** Stores the k=1 fully correlated uncertainty integral. */
    readonly fullyCorrelatedStandardUncertaintyWattsPerSquareMeter: number;
    /** Stores the equivalent interval-average standard uncertainty density. */
    readonly fullyCorrelatedAverageStandardUncertaintyWattsPerSquareMeterPerNanometer: number;
    /** Retains sealed numerical oracle values, tolerances, and residuals. */
    readonly oracle: Readonly<Record<string, number>>;
}>;

type TsisHsrsReferenceFixture = Readonly<{
    /** Retains every validated official spectrum row. */
    readonly samples: readonly TsisHsrsReferenceSample[];
    /** Stores the exact 360..830 nm operator result. */
    readonly visibleIntegral: TsisHsrsVisibleIntegral;
    /** Retains exact CSV columns, units, row count, and wavelength grid. */
    readonly schema: Readonly<Record<string, unknown>>;
    /** Retains source path, hash, DOI, URLs, and wavelength state. */
    readonly provenance: Readonly<Record<string, unknown>>;
    /** Retains uncertainty and runtime-ownership claim boundaries. */
    readonly qualifications: Readonly<Record<string, string>>;
}>;

type RiekeConvertedCalspecSample = Readonly<{
    /** Stores the zero-based CALSPEC SCI-table row index. */
    readonly sourceSampleIndex: number;
    /** Stores the native vacuum wavelength in Angstroms. */
    readonly wavelengthAngstroms: number;
    /** Stores converted vacuum wavelength in nanometers. */
    readonly wavelengthNanometers: number;
    /** Stores converted vacuum wavelength in micrometers. */
    readonly wavelengthMicrometers: number;
    /** Stores native FLAM in erg s^-1 cm^-2 Angstrom^-1. */
    readonly fluxFlam: number;
    /** Stores converted visible spectral irradiance density. */
    readonly fluxWattsPerSquareMeterPerNanometer: number;
    /** Stores converted near-infrared spectral irradiance density. */
    readonly fluxWattsPerSquareCentimeterPerMicrometer: number;
    /** Stores converted visible statistical error density. */
    readonly statisticalErrorWattsPerSquareMeterPerNanometer: number;
    /** Stores converted visible systematic error density. */
    readonly systematicErrorWattsPerSquareMeterPerNanometer: number;
    /** Stores converted near-infrared statistical error density. */
    readonly statisticalErrorWattsPerSquareCentimeterPerMicrometer: number;
    /** Stores converted near-infrared systematic error density. */
    readonly systematicErrorWattsPerSquareCentimeterPerMicrometer: number;
    /** Stores the required CALSPEC DATAQUAL value. */
    readonly dataQuality: number;
}>;

type RiekeSiriusVisibleSegment = Readonly<{
    /** Stores the lower source row index. */
    readonly lowerSourceSampleIndex: number;
    /** Stores the upper source row index. */
    readonly upperSourceSampleIndex: number;
    /** Stores the clipped segment lower wavelength. */
    readonly lowerNanometers: number;
    /** Stores the clipped segment upper wavelength. */
    readonly upperNanometers: number;
    /** Stores linearly interpolated lower flux density. */
    readonly lowerFluxWattsPerSquareMeterPerNanometer: number;
    /** Stores linearly interpolated upper flux density. */
    readonly upperFluxWattsPerSquareMeterPerNanometer: number;
    /** Stores this segment's exact flux integral contribution. */
    readonly fluxIntegralContributionWattsPerSquareMeter: number;
    /** Stores the conservative fully correlated statistical-error contribution. */
    readonly fullyCorrelatedStatisticalErrorIntegralContributionWattsPerSquareMeter: number;
    /** Stores the fully correlated systematic-error contribution. */
    readonly fullyCorrelatedSystematicErrorIntegralContributionWattsPerSquareMeter: number;
}>;

type RiekeSiriusVisibleEvaluation = Readonly<{
    /** Stores the exact CALSPEC visible averaging operator and audit rows. */
    readonly operator: Readonly<{
        readonly id: 'rieke-visible-25-angstrom-piecewise-linear-average-v1';
        readonly quantity: 'spectral-irradiance-density';
        readonly units: 'W m^-2 nm^-1';
        readonly lowerNanometers: 554.5;
        readonly upperNanometers: 557;
        readonly widthNanometers: 2.5;
        readonly interpolation: string;
        readonly formula: string;
        readonly sourceSampleIndices: readonly number[];
        readonly selectedSampleCount: number;
        readonly nativeSamplesInsideIntervalCount: number;
        readonly contributingSegmentCount: number;
        readonly selectedSamples: readonly RiekeConvertedCalspecSample[];
        readonly segments: readonly RiekeSiriusVisibleSegment[];
        readonly integratedFluxWattsPerSquareMeter: number;
        readonly valueWattsPerSquareMeterPerNanometer: number;
        readonly conservativeFullyCorrelatedStatisticalErrorWattsPerSquareMeterPerNanometer:
            number;
        readonly fullyCorrelatedSystematicErrorWattsPerSquareMeterPerNanometer: number;
        readonly oracle: Readonly<Record<string, number>>;
    }>;
    /** Stores the publication value, uncertainty, original units, and conversion. */
    readonly reference: Readonly<Record<string, string | number>>;
    /** Stores all numerical inputs needed for a runner-owned tolerance formula. */
    readonly comparisonInputs: Readonly<Record<string, string | number>>;
    /** Retains smoothing and independence qualifications. */
    readonly qualifications: Readonly<Record<string, string>>;
}>;

type RiekeSiriusNearInfraredEvaluation = Readonly<{
    /** Stores native-row selection, logarithmic fit, and residual diagnostics. */
    readonly operator: Readonly<{
        readonly id: 'rieke-nir-native-log-log-power-law-v1';
        readonly quantity: 'spectral-irradiance-density';
        readonly units: 'W cm^-2 um^-1';
        readonly fitDomainMicrometers: readonly [2, 2.31];
        readonly excludedDomainMicrometers: readonly [2.14, 2.18];
        readonly evaluationWavelengthMicrometers: 2.1603;
        readonly samplePolicy: string;
        readonly fitMethod: string;
        readonly formula: string;
        readonly candidateSampleCount: number;
        readonly selectedSampleCount: number;
        readonly excludedSampleCount: number;
        readonly candidateSourceSampleIndices: readonly number[];
        readonly selectedSourceSampleIndices: readonly number[];
        readonly excludedSourceSampleIndices: readonly number[];
        readonly fitSamples: readonly RiekeConvertedCalspecSample[];
        readonly excludedSamples: readonly RiekeConvertedCalspecSample[];
        readonly transformedSamples: readonly Readonly<{
            readonly sourceSampleIndex: number;
            readonly logWavelengthMicrometers: number;
            readonly logFluxWattsPerSquareCentimeterPerMicrometer: number;
        }>[];
        readonly normalEquationSums: Readonly<Record<string, number>>;
        readonly fit: Readonly<{
            readonly intercept: number;
            readonly slope: number;
            readonly evaluationLogWavelength: number;
            readonly evaluationLogFlux: number;
            readonly valueWattsPerSquareCentimeterPerMicrometer: number;
        }>;
        readonly residualDiagnostics: Readonly<Record<string, number>>;
        readonly oracle: Readonly<Record<string, number>>;
    }>;
    /** Stores the MSX-transferred publication value and uncertainty. */
    readonly reference: Readonly<{
        readonly valueWattsPerSquareCentimeterPerMicrometer: number;
        readonly standardUncertaintyWattsPerSquareCentimeterPerMicrometer: number;
        readonly units: 'W cm^-2 um^-1';
        readonly sourceLocation: string;
        readonly transferWavelengthsMicrometers: readonly number[];
    }>;
    /** Stores all numerical inputs needed for a runner-owned tolerance formula. */
    readonly comparisonInputs: Readonly<Record<string, string | number>>;
    /** Retains source-segment, line-exclusion, and independence qualifications. */
    readonly qualifications: Readonly<Record<string, string>>;
}>;

type RiekeSiriusReferenceEvaluation = Readonly<{
    /** Names the two-band external reference evaluation. */
    readonly modelId: 'rieke-2023-sirius-reference-evaluation-v1';
    /** Stores the exact visible averaging result and publication comparison inputs. */
    readonly visible: RiekeSiriusVisibleEvaluation;
    /** Stores the near-infrared fit and MSX-transferred comparison inputs. */
    readonly nearInfrared: RiekeSiriusNearInfraredEvaluation;
    /** Retains publication hash/DOI, CALSPEC identity, and exact unit conversions. */
    readonly provenance: Readonly<Record<string, unknown>>;
    /** Retains the decision and data-quality claim boundaries. */
    readonly qualifications: Readonly<Record<string, string>>;
}>;
