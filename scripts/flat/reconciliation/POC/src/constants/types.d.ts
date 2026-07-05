type SpectralChannelConstant = {
    /** Stable channel label used in diagnostics and provenance. */
    readonly name: string;
    /** Center wavelength for the spectral channel. */
    readonly wavelengthNanometers: number;
    /** Channel solar irradiance sample from the accepted baseline table. */
    readonly solarIrradiance: number;
    /** Width of the centered wavelength bin represented by this channel. */
    readonly wavelengthBinWidthNanometers: number;
};

type CanonicalAtmosphereConstants = {
    /** Radius of the planet surface shell used by spherical geometry. */
    readonly bottomRadiusMeters: number;
    /** Radius of the top atmosphere boundary used by spherical geometry. */
    readonly topRadiusMeters: number;
    /** Rayleigh exponential density scale height. */
    readonly rayleighScaleHeightMeters: number;
    /** Mie/aerosol exponential density scale height. */
    readonly mieScaleHeightMeters: number;
    /** Rayleigh beta coefficient scale, with wavelength expressed in micrometers. */
    readonly rayleighCoefficientScale: number;
    /** Active Angstrom aerosol alpha for the Figure 1 clear-sky comparison profile. */
    readonly mieAngstromAlpha: number;
    /** Active Angstrom aerosol beta for the Figure 1 clear-sky comparison profile. */
    readonly mieAngstromBeta: number;
    /** Active aerosol single-scattering albedo. */
    readonly mieSingleScatteringAlbedo: number;
    /** Active Cornette-Shanks aerosol phase asymmetry parameter. */
    readonly miePhaseFunctionG: number;
    /** Whether ozone absorption is active in the canonical Figure 1 profile. */
    readonly ozoneAbsorptionEnabled: boolean;
};

type DistantSunConstants = {
    /** Apparent angular radius used for source diagnostics and optional disc paths. */
    readonly angularRadiusRadians: number;
};

type Matrix3x3 = readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
];

type Figure1DisplayConstants = {
    /** Display conversion kind for the Bruneton Figure 1 comparison path. */
    readonly conversionKind: string;
    /** Linear output space before tone mapping. */
    readonly outputColorSpace: string;
    /** Maximum luminous efficacy used by the source-derived Figure 1 display scalar. */
    readonly maxLuminousEfficacyLumensPerWatt: number;
    /** Bruneton comparison-source denominator scale for the Figure 1 tone map. */
    readonly brunetonComparisonToneMapExposureScale: number;
    /** Reciprocal tone-map scale used as k in 1 - exp(-kL). */
    readonly paperFigure1ToneMapK: number;
    /** XYZ to linear sRGB conversion matrix. */
    readonly xyzToLinearSrgbMatrix: Matrix3x3;
    /** Whether the inactive Bruneton demo gamma path is part of this display policy. */
    readonly demoGammaPowerOmitted: boolean;
    /** Whether the inactive Bruneton demo white-balance path is part of this display policy. */
    readonly demoWhitePointOmitted: boolean;
};

type Figure1SceneConstants = {
    /** Stable scene id and output prefix. */
    readonly id: string;
    /** Source row time label from the Figure 1 comparison target. */
    readonly sourceTimeOfDay: string;
    /** Source row Sun zenith angle. */
    readonly sourceSunZenithDegrees: number;
    /** Sun altitude derived from the source zenith angle. */
    readonly sunAltitudeDegrees: number;
    /** Sun azimuth measured from the extracted Figure 1 target tile. */
    readonly sunAzimuthDegrees: number;
    /** Source tile name in the extracted external Figure 1 image set. */
    readonly sourceTile: string;
    /** Measured red-cross center used to derive the scene azimuth. */
    readonly sourceRedCrossCenterPixels: readonly [number, number];
};

type Figure1RenderConstants = {
    /** Square output size for each Figure 1 skydome tile. */
    readonly imageSizePixels: number;
    /** Equidistant fisheye sky radius as a fraction of image size. */
    readonly skyRadiusScale: number;
    /** Equidistant fisheye sky radius in pixels. */
    readonly skyRadiusPixels: number;
    /** Pixel-space skydome center. */
    readonly centerPixels: readonly [number, number];
    /** Maximum view zenith angle represented by the fisheye sky disc. */
    readonly maxViewZenithRadians: number;
    /** Alpha value outside the sky disc. */
    readonly outsideSkyAlpha: number;
    /** Observer height used by the Figure 1 comparison scene. */
    readonly observerHeightMeters: number;
    /** Whether direct solar-disc camera radiance is rendered in the target path. */
    readonly directSolarDiscRendered: boolean;
    /** Accepted Step 032 artifact root used by the primary M1 comparison runner. */
    readonly targetArtifactRoot: string;
    /** Accepted Step 032 target image filenames. */
    readonly targetImageFilenames: readonly string[];
};

type Algorithm32NumericalControls = {
    /** View-ray path interval count. */
    readonly pathIntervalCount: number;
    /** Sample-to-source transmittance interval count. */
    readonly sourceTransmittanceIntervalCount: number;
    /** Incoming-direction count for incident-radiance integration. */
    readonly incidentDirectionCount: number;
    /** Altitude bin count for the distant incident-radiance cache. */
    readonly incidentAltitudeBinCount: number;
};

type LocalFlatNumericalControls = {
    /** View-ray path interval count. */
    readonly pathIntervalCount: number;
    /** Sample-to-local-source transmittance interval count. */
    readonly sourceTransmittanceIntervalCount: number;
    /** Incoming-direction count for local incident-radiance integration. */
    readonly incidentDirectionCount: number;
    /** Local cache vertical bin count. */
    readonly incidentZBinCount: number;
    /** Local cache source-subpoint radial bin count. */
    readonly incidentRhoBinCount: number;
};

type LocalFlatFalseSunLatitudeModel = {
    /** Latitude migration model kind. */
    readonly type: "annual-tropic-migration";
    /** Northern latitude limit in degrees. */
    readonly northLimitDeg: number;
    /** Southern latitude limit in degrees. */
    readonly southLimitDeg: number;
    /** Calendar day whose cosine phase resolves to the northern limit. */
    readonly northernSolsticeDayOfYear: number;
    /** Model period in days. */
    readonly periodDays: number;
};

type LocalFlatSourceBrightnessCalibration = {
    /** Calibration kind. */
    readonly kind: string;
    /** Human-readable calibration target. */
    readonly target: string;
    /** Reference observer latitude in degrees. */
    readonly calibrationObserverLatitudeDegrees: number;
    /** Reference observer longitude in degrees. */
    readonly calibrationObserverLongitudeDegrees: number;
    /** Simulation time used to resolve the reference source state. */
    readonly calibrationSimulationTime: string;
    /** Source latitude resolved at the reference time. */
    readonly sourceSubpointLatitudeDegrees: number;
    /** Source longitude after closest-approach alignment. */
    readonly sourceSubpointLongitudeDegrees: number;
    /** Calibration source distance in kilometers. */
    readonly calibrationDistanceKilometers: number;
    /** Inverse-square falloff at the calibration observer. */
    readonly calibrationDistanceFalloffScale: number;
    /** Target incident scale at the calibration observer. */
    readonly targetIncidentScaleAtCalibration: number;
    /** Reference spectral incident scale reused for scenes using this calibration. */
    readonly referenceSpectralIncidentScale: number;
    /** Named rule used to derive the reference event. */
    readonly calibrationRule: string;
};

type LocalFlatSceneConstants = {
    /** Stable scene id and output suffix. */
    readonly id: string;
    /** Offset from the historical closest-approach local-source state. */
    readonly offsetDegrees: number;
    /** Output filename; also the Step 018 guide filename when guide imagery exists. */
    readonly guideImageFilename: string;
    /** Geometry/model-space local source position in meters, z up. */
    readonly sourcePositionMeters: Position;
    /** Historical guide distance from observer to source, in kilometers. */
    readonly observerDistanceKilometers: number;
    /** Historical guide source altitude angle from observer. */
    readonly sourceAltitudeDegrees: number;
    /** Historical guide source azimuth angle from observer. */
    readonly sourceAzimuthDegrees: number;
    /** Historical guide inverse-square falloff at the observer. */
    readonly distanceFalloffScale: number;
    /** Historical guide incident scale after calibration at observer. */
    readonly incidentScaleAtObserver: number;
    /** Optional reference scale override for this scene. */
    readonly referenceSpectralIncidentScale?: number;
    /** Optional brightness calibration used by this scene. */
    readonly sourceBrightnessCalibration?: LocalFlatSourceBrightnessCalibration;
    /** Optional modeled observer latitude for derived local/flat review scenes. */
    readonly observerLatitudeDegrees?: number;
    /** Optional modeled observer longitude for derived local/flat review scenes. */
    readonly observerLongitudeDegrees?: number;
    /** Optional modeled observer elevation for derived local/flat review scenes. */
    readonly observerElevationMeters?: number;
    /** Optional modeled source subpoint latitude for derived local/flat review scenes. */
    readonly sourceSubpointLatitudeDegrees?: number;
    /** Optional modeled source subpoint longitude for derived local/flat review scenes. */
    readonly sourceSubpointLongitudeDegrees?: number;
    /** Optional initial source longitude before closest-approach rotation. */
    readonly sourceInitialLongitudeDegrees?: number;
    /** Optional latitude model used to resolve source latitude. */
    readonly sourceLatitudeModel?: LocalFlatFalseSunLatitudeModel;
    /** Optional simulation time used to resolve source latitude. */
    readonly sourceLatitudeResolvedAt?: string;
    /** Optional named rule used to derive closest approach. */
    readonly sourceClosestApproachRule?: string;
    /** Optional season/date label for derived local/flat review scenes. */
    readonly solarSeasonLabel?: string;
    /** Optional sky-disc orientation policy for derived review scenes. */
    readonly skyOrientation?: "north-up" | string;
    /** Optional model-space horizontal frame used by the scene. */
    readonly horizontalFrame?: "observer-local-east-north-up" | string;
    /** Optional named solar-time synchronization rule. */
    readonly solarTimeRule?: string;
    /** Optional UTC render date for time-sweep review scenes. */
    readonly renderDateUtc?: string;
    /** Optional UTC render time for time-sweep review scenes. */
    readonly renderTimeUtc?: string;
    /** Optional UTC render hour for time-sweep review scenes. */
    readonly renderHourUtc?: number;
    /** Optional stack row label for non-latitude review sweeps. */
    readonly rowLabel?: string;
    /** Optional longitude whose meridian is synchronized to solar noon. */
    readonly synchronizedSolarNoonLongitudeDegrees?: number;
    /** Optional spherical/distant Sun altitude for matched comparison renders. */
    readonly sphericalSunAltitudeDegrees?: number;
    /** Optional spherical/distant Sun azimuth for matched comparison renders. */
    readonly sphericalSunAzimuthDegrees?: number;
    /** Optional spherical/distant Sun direction in the scene horizontal frame. */
    readonly sphericalDirectionToLight?: UnitVector3;
    /** Optional output filename for matched spherical skydome renders. */
    readonly sphericalSkydomeFilename?: string;
};

type LocalFlatSceneSetConstants = {
    /** Stable scene-set id used by runners. */
    readonly id: string;
    /** Human-readable scene-set label. */
    readonly label: string;
    /** Scene-set purpose and scope. */
    readonly description: string;
    /** Whether scene outputs have historical guide images to compare. */
    readonly guideComparisonAvailable: boolean;
    /** Optional guide artifact root when guide comparison is available. */
    readonly guideArtifactRoot: string | null;
    /** Whether this scene set is an exact parity target. */
    readonly exactParityTarget: boolean;
    /** Local/flat scenes included in this set. */
    readonly scenes: readonly LocalFlatSceneConstants[];
    /** Optional shared brightness calibration for all scenes in this set. */
    readonly sourceBrightnessCalibration?: LocalFlatSourceBrightnessCalibration | null;
};

type LocalFlatSeedConstants = {
    /** Artificial profile kind. */
    readonly profileKind: string;
    /** Flat observer position fixture in meters. */
    readonly observerPositionMeters: Position;
    /** Active atmosphere/profile top altitude supplied to flat geometry. */
    readonly topAltitudeMeters: number;
    /** Renderer/view-ray no-hit cap seed, outside atmosphere ownership. */
    readonly sceneSkyRayLimitMeters: number;
    /** Observer-centered finite dome domain for M2 skydome inspection. */
    readonly observerCenteredDome: FlatObserverCenteredDomeConfig;
    /** False Sun radius seed in meters. */
    readonly sourceRadiusMeters: number;
    /** False Sun reference distance seed in meters. */
    readonly referenceDistanceMeters: number;
    /** Calibrated reference incident scale seed. */
    readonly referenceSpectralIncidentScale: number;
    /** Whether inverse-square falloff is enabled. */
    readonly distanceFalloff: boolean;
    /** False Sun latitude migration seed for derived local/flat review scenes. */
    readonly falseSunLatitudeModel: LocalFlatFalseSunLatitudeModel;
    /** Summer-solstice simulation time for derived local/flat review scenes. */
    readonly summerSolsticeSimulationTime: string;
    /** Observer latitudes for the additional summer-solstice latitude sweep. */
    readonly latitudeSweepObserverLatitudesDegrees: readonly number[];
    /** Shared brightness calibration for the summer-solstice latitude sweep. */
    readonly summerSolsticeLatitudeSweepBrightnessCalibration: LocalFlatSourceBrightnessCalibration;
    /** Local cache z bins in meters. */
    readonly localCacheZBinsMeters: readonly number[];
    /** Local cache rho bins in meters. */
    readonly localCacheRhoBinsMeters: readonly number[];
    /** Local cache incoming-direction count. */
    readonly localCacheDirectionCount: number;
    /** M2 execution controls seeded for convergence experiments. */
    readonly numericalControls: LocalFlatNumericalControls;
    /** Step 018 guide artifact root, diagnostic only. */
    readonly guideArtifactRoot: string;
    /** Local/flat seed scenes. */
    readonly scenes: readonly LocalFlatSceneConstants[];
    /** Additional named local/flat skydome scene sets. */
    readonly sceneSets: Readonly<Record<string, LocalFlatSceneSetConstants>>;
};

type Algorithm32BaselineConstants = {
    /** Canonical atmosphere profile constants. */
    readonly atmosphere: CanonicalAtmosphereConstants;
    /** Distant source constants. */
    readonly distantSun: DistantSunConstants;
    /** Active spectral channels. */
    readonly spectralChannels: readonly SpectralChannelConstant[];
    /** Shared spectral basis derived from the active channel centers. */
    readonly spectralBasis: SpectralBasis;
    /** Figure 1 display conversion constants. */
    readonly figure1Display: Figure1DisplayConstants;
    /** Figure 1 render/layout constants. */
    readonly figure1Render: Figure1RenderConstants;
    /** Four Figure 1 comparison scenes. */
    readonly figure1Scenes: readonly Figure1SceneConstants[];
    /** Accepted runtime/default numerical controls. */
    readonly runtimeNumericalControls: Algorithm32NumericalControls;
    /** Doubled validation/reference numerical controls. */
    readonly validationNumericalControls: Algorithm32NumericalControls;
    /** Step 032 artifact numerical controls. */
    readonly step032ArtifactNumericalControls: Algorithm32NumericalControls;
    /** M2 local/flat seed constants for method-confidence runs. */
    readonly m2LocalFlatSeed: LocalFlatSeedConstants;
};

