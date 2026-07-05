// References:
// - agents/topics/apps/flat/algorithm32/conclusions.md, canonical constants and Figure 1 scene constants.
// - agents/topics/apps/flat/reconciliation/bruneton-start-fresh-source-audit.md, retained Step 032 baseline sources.
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 shared constants used by atmosphere, artifact rendering, and primary runner.
// - agents/topics/apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md, annual tropic-migration local Sun setup and M2 finite dome domain.

/** @type {CanonicalAtmosphereConstants} */
export const CANONICAL_ATMOSPHERE_CONSTANTS = Object.freeze({
    bottomRadiusMeters: 6360000,
    topRadiusMeters: 6420000,
    rayleighScaleHeightMeters: 8000,
    mieScaleHeightMeters: 1200,
    rayleighCoefficientScale: 0.00000124062,
    mieAngstromAlpha: 0.8,
    mieAngstromBeta: 0.04,
    mieSingleScatteringAlbedo: 0.8,
    miePhaseFunctionG: 0.7,
    ozoneAbsorptionEnabled: false,
});

/** @type {DistantSunConstants} */
export const DISTANT_SUN_CONSTANTS = Object.freeze({
    angularRadiusRadians: 0.004675,
});

/** @type {readonly SpectralChannelConstant[]} */
export const CANONICAL_SPECTRAL_CHANNELS = Object.freeze([
    freezeSpectralChannel('lambda-376', 375.6666666666667, 1.0688666666666664),
    freezeSpectralChannel('lambda-407', 407, 1.729673),
    freezeSpectralChannel('lambda-438', 438.3333333333333, 1.8620716666666661),
    freezeSpectralChannel('lambda-470', 469.66666666666663, 2.0220633333333335),
    freezeSpectralChannel('lambda-501', 501, 1.9081540000000001),
    freezeSpectralChannel('lambda-532', 532.3333333333333, 1.8833910000000003),
    freezeSpectralChannel('lambda-564', 563.6666666666666, 1.8342466666666666),
    freezeSpectralChannel('lambda-595', 595, 1.7674400000000001),
    freezeSpectralChannel('lambda-626', 626.3333333333333, 1.65952),
    freezeSpectralChannel('lambda-658', 657.6666666666666, 1.548102333333333),
    freezeSpectralChannel('lambda-689', 689, 1.45078),
    freezeSpectralChannel('lambda-720', 720.3333333333333, 1.3409603333333335),
    freezeSpectralChannel('lambda-752', 751.6666666666666, 1.2624333333333335),
    freezeSpectralChannel('lambda-783', 783, 1.175208),
    freezeSpectralChannel('lambda-814', 814.3333333333333, 1.090824),
]);

/** @type {SpectralBasis} */
export const CANONICAL_SPECTRAL_BASIS = Object.freeze({
    wavelengthsNanometers: Object.freeze(
        CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.wavelengthNanometers),
    ),
});

/** @type {Figure1DisplayConstants} */
export const FIGURE1_DISPLAY_CONSTANTS = Object.freeze({
    conversionKind: 'cie-xyz-to-linear-srgb-paper-figure1-tone-map',
    outputColorSpace: 'linear-srgb',
    maxLuminousEfficacyLumensPerWatt: 683,
    brunetonComparisonToneMapExposureScale: 5,
    paperFigure1ToneMapK: 1 / (5 * 683),
    xyzToLinearSrgbMatrix: Object.freeze([
        Object.freeze([3.2406, -1.5372, -0.4986]),
        Object.freeze([-0.9689, 1.8758, 0.0415]),
        Object.freeze([0.0557, -0.204, 1.057]),
    ]),
    demoGammaPowerOmitted: true,
    demoWhitePointOmitted: true,
});

/** @type {Figure1RenderConstants} */
export const FIGURE1_RENDER_CONSTANTS = Object.freeze({
    imageSizePixels: 320,
    skyRadiusScale: 0.47,
    skyRadiusPixels: 150.4,
    centerPixels: Object.freeze([159.5, 159.5]),
    maxViewZenithRadians: Math.PI / 2,
    outsideSkyAlpha: 0,
    observerHeightMeters: 2,
    directSolarDiscRendered: false,
    targetArtifactRoot:
        'tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline',
    targetImageFilenames: Object.freeze([
        'figure1-06h00-z87-figure1-four-view-source-k-no-ground.png',
        'figure1-10h15-z41-figure1-four-view-source-k-no-ground.png',
        'figure1-11h15-z31-figure1-four-view-source-k-no-ground.png',
        'figure1-13h15-z21-figure1-four-view-source-k-no-ground.png',
    ]),
});

/** @type {readonly Figure1SceneConstants[]} */
export const FIGURE1_SCENES = Object.freeze([
    freezeFigure1Scene('figure1-06h00-z87', '06h00', 87, 3, -25.83454348280912, '35-Im6.png', [238, 181]),
    freezeFigure1Scene('figure1-10h15-z41', '10h15', 41, 49, 9.544525565558136, '06-Im15.png', [184, 118]),
    freezeFigure1Scene('figure1-11h15-z31', '11h15', 31, 59, 22.166345822082455, '17-Im25.png', [168, 111]),
    freezeFigure1Scene('figure1-13h15-z21', '13h15', 21, 69, 85.31410016049729, '28-Im35.png', [130, 97]),
]);

/** @type {Algorithm32NumericalControls} */
export const RUNTIME_NUMERICAL_CONTROLS = Object.freeze({
    pathIntervalCount: 40,
    sourceTransmittanceIntervalCount: 20,
    incidentDirectionCount: 34,
    incidentAltitudeBinCount: 48,
});

/** @type {Algorithm32NumericalControls} */
export const VALIDATION_NUMERICAL_CONTROLS = Object.freeze({
    pathIntervalCount: 80,
    sourceTransmittanceIntervalCount: 40,
    incidentDirectionCount: 68,
    incidentAltitudeBinCount: 96,
});

/** @type {Algorithm32NumericalControls} */
export const STEP032_ARTIFACT_NUMERICAL_CONTROLS = Object.freeze({
    pathIntervalCount: 20,
    sourceTransmittanceIntervalCount: 10,
    incidentDirectionCount: 17,
    incidentAltitudeBinCount: 24,
});

/** @type {LocalFlatNumericalControls} */
export const M2_LOCAL_FLAT_NUMERICAL_CONTROLS = Object.freeze({
    pathIntervalCount: 24,
    sourceTransmittanceIntervalCount: 12,
    incidentDirectionCount: 9,
    incidentZBinCount: 5,
    incidentRhoBinCount: 7,
});

const M2_LOCAL_FLAT_KM_PER_MILE = 1.609344;
const M2_LOCAL_FLAT_TRANSPORT_OBSERVER_HEIGHT_METERS = 2;

/** @type {LocalFlatFalseSunLatitudeModel} */
export const M2_LOCAL_FLAT_FALSE_SUN_LATITUDE_MODEL = Object.freeze({
    type: 'annual-tropic-migration',
    northLimitDeg: 23.5,
    southLimitDeg: -23.5,
    northernSolsticeDayOfYear: 172,
    periodDays: 365.2422,
});

export const M2_LOCAL_FLAT_SUMMER_SOLSTICE_SIMULATION_TIME = '2026-06-21T12:00:00-07:00';
export const M2_LOCAL_FLAT_OBSERVER_LONGITUDE_DEGREES = -121.8863;
export const M2_LOCAL_FLAT_OBSERVER_ELEVATION_METERS = 30.48;
export const M2_LOCAL_FLAT_PROJECTION_SPHERE_RADIUS_METERS = 6371008.8;
export const M2_LOCAL_FLAT_FALSE_SUN_INITIAL_LONGITUDE_DEGREES = 58.1137;
export const M2_LOCAL_FLAT_FALSE_SUN_ALTITUDE_METERS = 3000 * M2_LOCAL_FLAT_KM_PER_MILE * 1000;
export const M2_LOCAL_FLAT_SOURCE_RADIUS_METERS = (32 * M2_LOCAL_FLAT_KM_PER_MILE * 1000) / 2;
export const M2_LOCAL_FLAT_REFERENCE_DISTANCE_METERS = 4800000;
export const M2_LOCAL_FLAT_REFERENCE_SPECTRAL_INCIDENT_SCALE = 1.1071748923354825;
export const M2_LOCAL_FLAT_TARGET_INCIDENT_SCALE_AT_CALIBRATION = 1;
export const M2_LOCAL_FLAT_GREENWICH_SOLAR_NOON_LONGITUDE_DEGREES = 0;
export const M2_LOCAL_FLAT_45_DEGREE_EAST_SOLAR_NOON_LONGITUDE_DEGREES =
    M2_LOCAL_FLAT_OBSERVER_LONGITUDE_DEGREES + 45;
export const M2_LOCAL_FLAT_POLAR_RENDER_LONGITUDE_DEGREES = 0;
export const M2_LOCAL_FLAT_POLAR_RENDER_ELEVATION_METERS = 0;
export const M2_LOCAL_FLAT_NORTH_POLE_SUMMER_SOLSTICE_DATE_UTC = '2026-06-21';
export const M2_LOCAL_FLAT_SOUTH_POLE_WINTER_SOLSTICE_DATE_UTC = '2025-12-21';
export const M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_LATITUDE_DEGREES = -79.768036;
export const M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_LONGITUDE_DEGREES = -83.261666;
export const M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_ELEVATION_METERS = 700;
export const M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_DATE_UTC = '2024-12-15';
export const M2_LOCAL_FLAT_UNION_GLACIER_CALIBRATION_LONGITUDE_DEGREES = 0;
export const M2_LOCAL_FLAT_UNION_GLACIER_CALIBRATION_ELEVATION_METERS = 0;

/** @type {readonly number[]} */
export const M2_LOCAL_FLAT_POLAR_TIME_SWEEP_UTC_HOURS = Object.freeze([0, 4, 8, 12, 16, 20]);

/** @type {FlatObserverCenteredDomeConfig} */
export const M2_LOCAL_FLAT_OBSERVER_CENTERED_DOME = Object.freeze({
    centerPolicy: 'observer-centered',
    apexAltitudeMeters: 60000,
    maxObserverViewRayExtentMeters: 875656.6450361694,
});

/** @type {readonly number[]} */
export const M2_LOCAL_FLAT_SUMMER_SOLSTICE_OBSERVER_LATITUDES_DEGREES = Object.freeze([
    80,
    30,
    0,
    -30,
    -80,
]);

/** @type {LocalFlatSourceBrightnessCalibration} */
export const M2_LOCAL_FLAT_SUMMER_SOLSTICE_LATITUDE_SWEEP_BRIGHTNESS_CALIBRATION =
    createSummerSolsticeLatitudeSweepBrightnessCalibration();

/** @type {LocalFlatSourceBrightnessCalibration} */
export const M2_LOCAL_FLAT_NORTH_POLE_SUMMER_SOLSTICE_TIME_SWEEP_BRIGHTNESS_CALIBRATION =
    createSynchronizedClockBrightnessCalibration(
        `${M2_LOCAL_FLAT_NORTH_POLE_SUMMER_SOLSTICE_DATE_UTC}T12:00:00Z`,
        M2_LOCAL_FLAT_POLAR_RENDER_LONGITUDE_DEGREES,
        M2_LOCAL_FLAT_POLAR_RENDER_ELEVATION_METERS,
        'subsolar-latitude-north-pole-summer-solstice-clock-sweep-unit-incident-scale',
    );

/** @type {LocalFlatSourceBrightnessCalibration} */
export const M2_LOCAL_FLAT_SOUTH_POLE_WINTER_SOLSTICE_TIME_SWEEP_BRIGHTNESS_CALIBRATION =
    createSynchronizedClockBrightnessCalibration(
        `${M2_LOCAL_FLAT_SOUTH_POLE_WINTER_SOLSTICE_DATE_UTC}T12:00:00Z`,
        M2_LOCAL_FLAT_POLAR_RENDER_LONGITUDE_DEGREES,
        M2_LOCAL_FLAT_POLAR_RENDER_ELEVATION_METERS,
        'subsolar-latitude-south-pole-winter-solstice-clock-sweep-unit-incident-scale',
    );

/** @type {LocalFlatSourceBrightnessCalibration} */
export const M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_TIME_SWEEP_BRIGHTNESS_CALIBRATION =
    createSynchronizedClockBrightnessCalibration(
        `${M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_DATE_UTC}T12:00:00Z`,
        M2_LOCAL_FLAT_UNION_GLACIER_CALIBRATION_LONGITUDE_DEGREES,
        M2_LOCAL_FLAT_UNION_GLACIER_CALIBRATION_ELEVATION_METERS,
        'subsolar-latitude-union-glacier-final-experiment-clock-sweep-unit-incident-scale',
    );

/** @type {readonly LocalFlatSceneConstants[]} */
export const M2_LOCAL_FLAT_SCENES = Object.freeze([
    freezeLocalFlatScene(
        'san-jose-000deg-closest',
        0,
        'flat-app-skydome-000deg-closest.png',
        [-1259333.1191633441, -783448.107576714, 4828003.52],
        5050.674164842701,
        72.9232574407232,
        -121.88630000000008,
        0.9031996723576283,
        1.0000000000000002,
    ),
    freezeLocalFlatScene(
        'san-jose-045deg-from-closest',
        45,
        'flat-app-skydome-045deg-from-closest.png',
        [-2175398.8819482913, 4758279.812089166, 4828003.52],
        7119.212438383862,
        42.70042449580308,
        -24.569016394925313,
        0.4545886305746889,
        0.5033091181134656,
    ),
    freezeLocalFlatScene(
        'san-jose-090deg-from-closest',
        90,
        'flat-app-skydome-090deg-from-closest.png',
        [1095438.1966602097, 9324629.516453793, 4828003.5200000005],
        10557.381263312685,
        27.213696005808067,
        12.711784749564578,
        0.2067140821095606,
        0.22886864160388085,
    ),
    freezeLocalFlatScene(
        'san-jose-135deg-from-closest',
        135,
        'flat-app-skydome-135deg-from-closest.png',
        [6637166.116326089, 10240695.279238738, 4828003.52],
        13123.772801106092,
        21.58506204803698,
        37.79772350452877,
        0.1337719531935246,
        0.1481089478745478,
    ),
    freezeLocalFlatScene(
        'san-jose-180deg-from-closest',
        180,
        'flat-app-skydome-180deg-from-closest.png',
        [11203515.820690716, 6969858.200630237, 4828003.5200000005],
        14050.17041741779,
        20.097934087510392,
        58.1137,
        0.11671301573969893,
        0.12922172063575063,
    ),
]);

/** @type {readonly LocalFlatSceneConstants[]} */
export const M2_LOCAL_FLAT_SUMMER_SOLSTICE_LATITUDE_SCENES = Object.freeze(
    M2_LOCAL_FLAT_SUMMER_SOLSTICE_OBSERVER_LATITUDES_DEGREES.map((latitudeDegrees) =>
        createSummerSolsticeLatitudeScene(latitudeDegrees)),
);

/** @type {readonly LocalFlatSceneConstants[]} */
export const M2_LOCAL_FLAT_SYNCHRONIZED_SOLAR_NOON_LATITUDE_SCENES = Object.freeze(
    M2_LOCAL_FLAT_SUMMER_SOLSTICE_OBSERVER_LATITUDES_DEGREES.map((latitudeDegrees) =>
        createSynchronizedSolarNoonLatitudeScene(latitudeDegrees)),
);

/** @type {readonly LocalFlatSceneConstants[]} */
export const M2_LOCAL_FLAT_GREENWICH_SOLAR_NOON_LATITUDE_SCENES = Object.freeze(
    M2_LOCAL_FLAT_SUMMER_SOLSTICE_OBSERVER_LATITUDES_DEGREES.map((latitudeDegrees) =>
        createGreenwichSolarNoonLatitudeScene(latitudeDegrees)),
);

/** @type {readonly LocalFlatSceneConstants[]} */
export const M2_LOCAL_FLAT_45_DEGREE_EAST_SOLAR_NOON_LATITUDE_SCENES = Object.freeze(
    M2_LOCAL_FLAT_SUMMER_SOLSTICE_OBSERVER_LATITUDES_DEGREES.map((latitudeDegrees) =>
        create45DegreeEastSolarNoonLatitudeScene(latitudeDegrees)),
);

/** @type {readonly LocalFlatSceneConstants[]} */
export const M2_LOCAL_FLAT_NORTH_POLE_SUMMER_SOLSTICE_TIME_SWEEP_SCENES = Object.freeze(
    M2_LOCAL_FLAT_POLAR_TIME_SWEEP_UTC_HOURS.map((utcHour) =>
        createPolarTimeSweepScene(
            90,
            M2_LOCAL_FLAT_NORTH_POLE_SUMMER_SOLSTICE_DATE_UTC,
            utcHour,
            'north-pole-summer-solstice-2026',
            'summer-solstice-2026-north-pole-gmt-clock-sweep',
            M2_LOCAL_FLAT_NORTH_POLE_SUMMER_SOLSTICE_TIME_SWEEP_BRIGHTNESS_CALIBRATION,
        )),
);

/** @type {readonly LocalFlatSceneConstants[]} */
export const M2_LOCAL_FLAT_SOUTH_POLE_WINTER_SOLSTICE_TIME_SWEEP_SCENES = Object.freeze(
    M2_LOCAL_FLAT_POLAR_TIME_SWEEP_UTC_HOURS.map((utcHour) =>
        createPolarTimeSweepScene(
            -90,
            M2_LOCAL_FLAT_SOUTH_POLE_WINTER_SOLSTICE_DATE_UTC,
            utcHour,
            'south-pole-winter-solstice-2025',
            'winter-solstice-2025-south-pole-gmt-clock-sweep',
            M2_LOCAL_FLAT_SOUTH_POLE_WINTER_SOLSTICE_TIME_SWEEP_BRIGHTNESS_CALIBRATION,
        )),
);

/** @type {readonly LocalFlatSceneConstants[]} */
export const M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_TIME_SWEEP_SCENES = Object.freeze(
    M2_LOCAL_FLAT_POLAR_TIME_SWEEP_UTC_HOURS.map((utcHour) =>
        createLocationTimeSweepScene({
            observerLatitudeDegrees: M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_LATITUDE_DEGREES,
            observerLongitudeDegrees: M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_LONGITUDE_DEGREES,
            observerElevationMeters: M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_ELEVATION_METERS,
            simulationDateUtc: M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_DATE_UTC,
            utcHour,
            slugPrefix: 'union-glacier-final-experiment-2024-dec15',
            seasonLabel: 'final-experiment-union-glacier-2024-dec15-gmt-clock-sweep',
            calibration: M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_TIME_SWEEP_BRIGHTNESS_CALIBRATION,
        })),
);

/** @type {Readonly<Record<string, LocalFlatSceneSetConstants>>} */
export const M2_LOCAL_FLAT_SCENE_SETS = Object.freeze({
    'step018-rotation': freezeLocalFlatSceneSet(
        'step018-rotation',
        'Step 018 rotation guide set',
        'Historical San Jose longitude rotation set used for Step 018 guide-image diagnostics.',
        M2_LOCAL_FLAT_SCENES,
        'tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes',
        true,
    ),
    'san-jose-longitude-summer-solstice-latitude-sweep': freezeLocalFlatSceneSet(
        'san-jose-longitude-summer-solstice-latitude-sweep',
        'San Jose longitude summer-solstice latitude sweep',
        'Additional subjective local/flat skydome set at San Jose longitude for observer latitudes 80N, 30N, equator, 30S, and 80S, each using annual-tropic-migration summer-solstice source latitude before closest false-Sun approach rotation.',
        M2_LOCAL_FLAT_SUMMER_SOLSTICE_LATITUDE_SCENES,
        null,
        false,
        M2_LOCAL_FLAT_SUMMER_SOLSTICE_LATITUDE_SWEEP_BRIGHTNESS_CALIBRATION,
    ),
    'san-jose-longitude-summer-solstice-synchronized-noon-latitude-sweep': freezeLocalFlatSceneSet(
        'san-jose-longitude-summer-solstice-synchronized-noon-latitude-sweep',
        'San Jose longitude summer-solstice synchronized-noon latitude sweep',
        'Subjective north-up flat/spherical skydome comparison set at San Jose longitude for observer latitudes 80N, 30N, equator, 30S, and 80S. All rows share the same summer-solstice source latitude and synchronized solar-noon source longitude.',
        M2_LOCAL_FLAT_SYNCHRONIZED_SOLAR_NOON_LATITUDE_SCENES,
        null,
        false,
        M2_LOCAL_FLAT_SUMMER_SOLSTICE_LATITUDE_SWEEP_BRIGHTNESS_CALIBRATION,
    ),
    'san-jose-longitude-summer-solstice-greenwich-noon-latitude-sweep': freezeLocalFlatSceneSet(
        'san-jose-longitude-summer-solstice-greenwich-noon-latitude-sweep',
        'San Jose longitude summer-solstice Greenwich-noon latitude sweep',
        'Subjective north-up flat/spherical skydome comparison set at San Jose longitude for observer latitudes 80N, 30N, equator, 30S, and 80S. All rows use the same summer-solstice source latitude and the render time synchronized to solar noon at longitude 0.',
        M2_LOCAL_FLAT_GREENWICH_SOLAR_NOON_LATITUDE_SCENES,
        null,
        false,
        M2_LOCAL_FLAT_SUMMER_SOLSTICE_LATITUDE_SWEEP_BRIGHTNESS_CALIBRATION,
    ),
    'san-jose-longitude-summer-solstice-45east-noon-latitude-sweep': freezeLocalFlatSceneSet(
        'san-jose-longitude-summer-solstice-45east-noon-latitude-sweep',
        'San Jose longitude summer-solstice 45-degree-east-noon latitude sweep',
        'Subjective north-up flat/spherical skydome comparison set at San Jose longitude for observer latitudes 80N, 30N, equator, 30S, and 80S. All rows use the same summer-solstice source latitude and the render time synchronized to solar noon 45 degrees east of San Jose longitude.',
        M2_LOCAL_FLAT_45_DEGREE_EAST_SOLAR_NOON_LATITUDE_SCENES,
        null,
        false,
        M2_LOCAL_FLAT_SUMMER_SOLSTICE_LATITUDE_SWEEP_BRIGHTNESS_CALIBRATION,
    ),
    'north-pole-summer-solstice-2026-gmt-4hour-sweep': freezeLocalFlatSceneSet(
        'north-pole-summer-solstice-2026-gmt-4hour-sweep',
        'North Pole summer-solstice 2026 GMT four-hour sweep',
        'Subjective north-up flat/spherical skydome comparison set at 90N, longitude 0, on 2026-06-21. Rows render every four hours from 00:00 GMT through 20:00 GMT, with source subpoint longitude derived from the UTC clock.',
        M2_LOCAL_FLAT_NORTH_POLE_SUMMER_SOLSTICE_TIME_SWEEP_SCENES,
        null,
        false,
        M2_LOCAL_FLAT_NORTH_POLE_SUMMER_SOLSTICE_TIME_SWEEP_BRIGHTNESS_CALIBRATION,
    ),
    'south-pole-winter-solstice-2025-gmt-4hour-sweep': freezeLocalFlatSceneSet(
        'south-pole-winter-solstice-2025-gmt-4hour-sweep',
        'South Pole winter-solstice 2025 GMT four-hour sweep',
        'Deferred subjective north-up flat/spherical skydome comparison set at 90S, longitude 0, on 2025-12-21. Rows render every four hours from 00:00 GMT through 20:00 GMT, with source subpoint longitude derived from the UTC clock.',
        M2_LOCAL_FLAT_SOUTH_POLE_WINTER_SOLSTICE_TIME_SWEEP_SCENES,
        null,
        false,
        M2_LOCAL_FLAT_SOUTH_POLE_WINTER_SOLSTICE_TIME_SWEEP_BRIGHTNESS_CALIBRATION,
    ),
    'union-glacier-final-experiment-2024-dec15-gmt-4hour-sweep': freezeLocalFlatSceneSet(
        'union-glacier-final-experiment-2024-dec15-gmt-4hour-sweep',
        'Union Glacier Final Experiment 2024-12-15 GMT four-hour sweep',
        'Subjective north-up flat/spherical skydome comparison set at Union Glacier Camp, latitude -79.768036, longitude -83.261666, on 2024-12-15. Rows render every four hours from 00:00 GMT through 20:00 GMT, with source subpoint longitude derived from the UTC clock and brightness calibrated at the migrated source latitude on the longitude 0 meridian.',
        M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_TIME_SWEEP_SCENES,
        null,
        false,
        M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_TIME_SWEEP_BRIGHTNESS_CALIBRATION,
    ),
});

/** @type {LocalFlatSeedConstants} */
export const M2_LOCAL_FLAT_SEED_CONSTANTS = Object.freeze({
    profileKind: 'm2-flat-local-artificial-seed',
    observerPositionMeters: Object.freeze([0, 0, 2]),
    topAltitudeMeters: 100000,
    sceneSkyRayLimitMeters: 1926774,
    observerCenteredDome: M2_LOCAL_FLAT_OBSERVER_CENTERED_DOME,
    sourceRadiusMeters: M2_LOCAL_FLAT_SOURCE_RADIUS_METERS,
    referenceDistanceMeters: M2_LOCAL_FLAT_REFERENCE_DISTANCE_METERS,
    referenceSpectralIncidentScale: M2_LOCAL_FLAT_REFERENCE_SPECTRAL_INCIDENT_SCALE,
    distanceFalloff: true,
    falseSunLatitudeModel: M2_LOCAL_FLAT_FALSE_SUN_LATITUDE_MODEL,
    summerSolsticeSimulationTime: M2_LOCAL_FLAT_SUMMER_SOLSTICE_SIMULATION_TIME,
    latitudeSweepObserverLatitudesDegrees: M2_LOCAL_FLAT_SUMMER_SOLSTICE_OBSERVER_LATITUDES_DEGREES,
    summerSolsticeLatitudeSweepBrightnessCalibration:
        M2_LOCAL_FLAT_SUMMER_SOLSTICE_LATITUDE_SWEEP_BRIGHTNESS_CALIBRATION,
    localCacheZBinsMeters: Object.freeze([2, 1000, 5000, 15000, 45000]),
    localCacheRhoBinsMeters: Object.freeze([0, 500000, 1250000, 2500000, 5000000, 9000000, 13000000]),
    localCacheDirectionCount: 9,
    numericalControls: M2_LOCAL_FLAT_NUMERICAL_CONTROLS,
    guideArtifactRoot: 'tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes',
    scenes: M2_LOCAL_FLAT_SCENES,
    sceneSets: M2_LOCAL_FLAT_SCENE_SETS,
});

/** @type {Algorithm32BaselineConstants} */
export const ALGORITHM32_BASELINE_CONSTANTS = Object.freeze({
    atmosphere: CANONICAL_ATMOSPHERE_CONSTANTS,
    distantSun: DISTANT_SUN_CONSTANTS,
    spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    spectralBasis: CANONICAL_SPECTRAL_BASIS,
    figure1Display: FIGURE1_DISPLAY_CONSTANTS,
    figure1Render: FIGURE1_RENDER_CONSTANTS,
    figure1Scenes: FIGURE1_SCENES,
    runtimeNumericalControls: RUNTIME_NUMERICAL_CONTROLS,
    validationNumericalControls: VALIDATION_NUMERICAL_CONTROLS,
    step032ArtifactNumericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    m2LocalFlatSeed: M2_LOCAL_FLAT_SEED_CONSTANTS,
});

/**
 * @param {string} name - Stable channel label.
 * @param {number} wavelengthNanometers - Channel center wavelength.
 * @param {number} solarIrradiance - Channel solar irradiance.
 * @returns {SpectralChannelConstant} Frozen spectral channel constant.
 */
function freezeSpectralChannel(name, wavelengthNanometers, solarIrradiance) {
    return Object.freeze({
        name,
        wavelengthNanometers,
        solarIrradiance,
        wavelengthBinWidthNanometers: 31.333333333333332,
    });
}

/**
 * @param {string} id - Stable scene id.
 * @param {string} sourceTimeOfDay - Figure 1 row time label.
 * @param {number} sourceSunZenithDegrees - Source Sun zenith angle.
 * @param {number} sunAltitudeDegrees - Derived Sun altitude angle.
 * @param {number} sunAzimuthDegrees - Measured Sun azimuth angle.
 * @param {string} sourceTile - Extracted source tile filename.
 * @param {readonly [number, number]} sourceRedCrossCenterPixels - Measured red-cross center.
 * @returns {Figure1SceneConstants} Frozen Figure 1 scene constant.
 */
function freezeFigure1Scene(
    id,
    sourceTimeOfDay,
    sourceSunZenithDegrees,
    sunAltitudeDegrees,
    sunAzimuthDegrees,
    sourceTile,
    sourceRedCrossCenterPixels,
) {
    return Object.freeze({
        id,
        sourceTimeOfDay,
        sourceSunZenithDegrees,
        sunAltitudeDegrees,
        sunAzimuthDegrees,
        sourceTile,
        sourceRedCrossCenterPixels: Object.freeze([...sourceRedCrossCenterPixels]),
    });
}

/**
 * @returns {LocalFlatSourceBrightnessCalibration} Summer-solstice latitude-sweep brightness calibration.
 */
function createSummerSolsticeLatitudeSweepBrightnessCalibration() {
    const sourceLatitudeDegrees = falseSunLatitudeDegreesForTime(
        M2_LOCAL_FLAT_SUMMER_SOLSTICE_SIMULATION_TIME,
        M2_LOCAL_FLAT_FALSE_SUN_LATITUDE_MODEL,
    );
    const calibrationState = resolveSummerSolsticeClosestApproachState(sourceLatitudeDegrees);
    const calibrationDistanceFalloffScale =
        (M2_LOCAL_FLAT_REFERENCE_DISTANCE_METERS / (calibrationState.observerDistanceKilometers * 1000)) ** 2;
    const referenceSpectralIncidentScale =
        M2_LOCAL_FLAT_TARGET_INCIDENT_SCALE_AT_CALIBRATION / calibrationDistanceFalloffScale;

    return Object.freeze({
        kind: 'subsolar-latitude-summer-solstice-unit-incident-scale',
        target: 'distant-solar-noon-unit-incident-scale-at-source-latitude',
        calibrationObserverLatitudeDegrees: sourceLatitudeDegrees,
        calibrationObserverLongitudeDegrees: M2_LOCAL_FLAT_OBSERVER_LONGITUDE_DEGREES,
        calibrationSimulationTime: M2_LOCAL_FLAT_SUMMER_SOLSTICE_SIMULATION_TIME,
        sourceSubpointLatitudeDegrees: sourceLatitudeDegrees,
        sourceSubpointLongitudeDegrees: calibrationState.sourceSubpointLongitudeDegrees,
        calibrationDistanceKilometers: calibrationState.observerDistanceKilometers,
        calibrationDistanceFalloffScale,
        targetIncidentScaleAtCalibration: M2_LOCAL_FLAT_TARGET_INCIDENT_SCALE_AT_CALIBRATION,
        referenceSpectralIncidentScale,
        calibrationRule: 'calibrate-on-source-latitude-closest-approach-and-reuse-for-latitude-sweep',
    });
}

/**
 * @param {string} simulationTime - UTC simulation time used to resolve source latitude.
 * @param {number} observerLongitudeDegrees - Calibration longitude in degrees.
 * @param {number} observerElevationMeters - Calibration observer elevation in meters.
 * @param {string} kind - Calibration packet kind.
 * @returns {LocalFlatSourceBrightnessCalibration} Synchronized-clock brightness calibration.
 */
function createSynchronizedClockBrightnessCalibration(
    simulationTime,
    observerLongitudeDegrees,
    observerElevationMeters,
    kind,
) {
    const sourceLatitudeDegrees = falseSunLatitudeDegreesForTime(
        simulationTime,
        M2_LOCAL_FLAT_FALSE_SUN_LATITUDE_MODEL,
    );
    const calibrationState = resolveSynchronizedSolarNoonState({
        observerLatitudeDegrees: sourceLatitudeDegrees,
        observerLongitudeDegrees,
        observerElevationMeters,
        simulationTime,
        solarNoonLongitudeDegrees: observerLongitudeDegrees,
    });
    const calibrationDistanceFalloffScale =
        (M2_LOCAL_FLAT_REFERENCE_DISTANCE_METERS / (calibrationState.observerDistanceKilometers * 1000)) ** 2;
    const referenceSpectralIncidentScale =
        M2_LOCAL_FLAT_TARGET_INCIDENT_SCALE_AT_CALIBRATION / calibrationDistanceFalloffScale;

    return Object.freeze({
        kind,
        target: 'distant-solar-noon-unit-incident-scale-at-source-latitude',
        calibrationObserverLatitudeDegrees: sourceLatitudeDegrees,
        calibrationObserverLongitudeDegrees: observerLongitudeDegrees,
        calibrationSimulationTime: simulationTime,
        sourceSubpointLatitudeDegrees: sourceLatitudeDegrees,
        sourceSubpointLongitudeDegrees: observerLongitudeDegrees,
        calibrationDistanceKilometers: calibrationState.observerDistanceKilometers,
        calibrationDistanceFalloffScale,
        targetIncidentScaleAtCalibration: M2_LOCAL_FLAT_TARGET_INCIDENT_SCALE_AT_CALIBRATION,
        referenceSpectralIncidentScale,
        calibrationRule: 'calibrate-on-source-latitude-synchronized-solar-noon-and-reuse-for-clock-sweep',
    });
}

/**
 * @param {number} observerLatitudeDegrees - Observer latitude for the derived review scene.
 * @returns {LocalFlatSceneConstants} Frozen summer-solstice closest-approach scene.
 */
function createSummerSolsticeLatitudeScene(observerLatitudeDegrees) {
    const state = resolveSummerSolsticeClosestApproachState(observerLatitudeDegrees);
    const calibration = M2_LOCAL_FLAT_SUMMER_SOLSTICE_LATITUDE_SWEEP_BRIGHTNESS_CALIBRATION;
    const incidentScaleAtObserver = calibration.referenceSpectralIncidentScale * state.distanceFalloffScale;
    const latitudeId = latitudeSlug(observerLatitudeDegrees);

    return freezeLocalFlatScene(
        `san-jose-lon-summer-solstice-${latitudeId}-closest`,
        0,
        `flat-app-skydome-summer-solstice-${latitudeId}-closest.png`,
        state.sourcePositionMeters,
        state.observerDistanceKilometers,
        state.sourceAltitudeDegrees,
        state.sourceAzimuthDegrees,
        state.distanceFalloffScale,
        incidentScaleAtObserver,
        {
            referenceSpectralIncidentScale: calibration.referenceSpectralIncidentScale,
            sourceBrightnessCalibration: calibration,
            observerLatitudeDegrees,
            observerLongitudeDegrees: M2_LOCAL_FLAT_OBSERVER_LONGITUDE_DEGREES,
            observerElevationMeters: M2_LOCAL_FLAT_OBSERVER_ELEVATION_METERS,
            sourceSubpointLatitudeDegrees: state.sourceLatitudeDegrees,
            sourceSubpointLongitudeDegrees: state.sourceSubpointLongitudeDegrees,
            sourceInitialLongitudeDegrees: M2_LOCAL_FLAT_FALSE_SUN_INITIAL_LONGITUDE_DEGREES,
            sourceLatitudeModel: M2_LOCAL_FLAT_FALSE_SUN_LATITUDE_MODEL,
            sourceLatitudeResolvedAt: M2_LOCAL_FLAT_SUMMER_SOLSTICE_SIMULATION_TIME,
            sourceClosestApproachRule: 'annual-tropic-migration-latitude-then-closest-horizontal-approach',
            solarSeasonLabel: 'summer-solstice-closest-approach',
        },
    );
}

/**
 * @param {number} observerLatitudeDegrees - Observer latitude for the derived review scene.
 * @returns {LocalFlatSceneConstants} Frozen synchronized solar-noon scene.
 */
function createSynchronizedSolarNoonLatitudeScene(observerLatitudeDegrees) {
    return createSolarNoonLatitudeScene(
        observerLatitudeDegrees,
        M2_LOCAL_FLAT_OBSERVER_LONGITUDE_DEGREES,
        'synchronized-noon',
        'synchronized-solar-noon-common-longitude',
        'summer-solstice-synchronized-solar-noon',
        'all rows share solar noon at source latitude and common longitude',
    );
}

/**
 * @param {number} observerLatitudeDegrees - Observer latitude for the derived review scene.
 * @returns {LocalFlatSceneConstants} Frozen Greenwich solar-noon scene.
 */
function createGreenwichSolarNoonLatitudeScene(observerLatitudeDegrees) {
    return createSolarNoonLatitudeScene(
        observerLatitudeDegrees,
        M2_LOCAL_FLAT_GREENWICH_SOLAR_NOON_LONGITUDE_DEGREES,
        'greenwich-noon',
        'synchronized-solar-noon-greenwich-longitude',
        'summer-solstice-greenwich-solar-noon',
        'all rows use the render time synchronized to solar noon at longitude 0',
    );
}

/**
 * @param {number} observerLatitudeDegrees - Observer latitude for the derived review scene.
 * @returns {LocalFlatSceneConstants} Frozen 45-degree-east solar-noon scene.
 */
function create45DegreeEastSolarNoonLatitudeScene(observerLatitudeDegrees) {
    return createSolarNoonLatitudeScene(
        observerLatitudeDegrees,
        M2_LOCAL_FLAT_45_DEGREE_EAST_SOLAR_NOON_LONGITUDE_DEGREES,
        '45east-noon',
        'synchronized-solar-noon-45-degree-east-longitude',
        'summer-solstice-45-degree-east-solar-noon',
        'all rows use the render time synchronized to solar noon 45 degrees east of San Jose longitude',
    );
}

/**
 * @param {number} observerLatitudeDegrees - Polar observer latitude in degrees.
 * @param {string} simulationDateUtc - UTC date, YYYY-MM-DD.
 * @param {number} utcHour - UTC hour to render.
 * @param {string} slugPrefix - Stable scene and filename prefix.
 * @param {string} seasonLabel - Season/time label.
 * @param {LocalFlatSourceBrightnessCalibration} calibration - Shared source brightness calibration.
 * @returns {LocalFlatSceneConstants} Frozen polar time-sweep scene.
 */
function createPolarTimeSweepScene(
    observerLatitudeDegrees,
    simulationDateUtc,
    utcHour,
    slugPrefix,
    seasonLabel,
    calibration,
) {
    return createLocationTimeSweepScene({
        observerLatitudeDegrees,
        observerLongitudeDegrees: M2_LOCAL_FLAT_POLAR_RENDER_LONGITUDE_DEGREES,
        observerElevationMeters: M2_LOCAL_FLAT_POLAR_RENDER_ELEVATION_METERS,
        simulationDateUtc,
        utcHour,
        slugPrefix,
        seasonLabel,
        calibration,
    });
}

/**
 * @param {{
 *   readonly observerLatitudeDegrees: number,
 *   readonly observerLongitudeDegrees: number,
 *   readonly observerElevationMeters: number,
 *   readonly simulationDateUtc: string,
 *   readonly utcHour: number,
 *   readonly slugPrefix: string,
 *   readonly seasonLabel: string,
 *   readonly calibration: LocalFlatSourceBrightnessCalibration
 * }} request - Time-sweep scene request.
 * @returns {LocalFlatSceneConstants} Frozen time-sweep scene.
 */
function createLocationTimeSweepScene(request) {
    const hourLabel = `${String(request.utcHour).padStart(2, '0')}:00 GMT`;
    const hourSlug = `${String(request.utcHour).padStart(2, '0')}00gmt`;
    const simulationTime = `${request.simulationDateUtc}T${String(request.utcHour).padStart(2, '0')}:00:00Z`;
    const solarNoonLongitudeDegrees = solarNoonLongitudeDegreesForUtcHour(request.utcHour);
    const state = resolveSynchronizedSolarNoonState({
        observerLatitudeDegrees: request.observerLatitudeDegrees,
        observerLongitudeDegrees: request.observerLongitudeDegrees,
        observerElevationMeters: request.observerElevationMeters,
        simulationTime,
        solarNoonLongitudeDegrees,
    });
    const incidentScaleAtObserver = request.calibration.referenceSpectralIncidentScale * state.distanceFalloffScale;

    return freezeLocalFlatScene(
        `${request.slugPrefix}-${hourSlug}`,
        request.utcHour,
        `flat-skydome-${request.slugPrefix}-${hourSlug}-north-up.png`,
        state.sourcePositionMeters,
        state.observerDistanceKilometers,
        state.sourceAltitudeDegrees,
        state.sourceAzimuthDegrees,
        state.distanceFalloffScale,
        incidentScaleAtObserver,
        {
            referenceSpectralIncidentScale: request.calibration.referenceSpectralIncidentScale,
            sourceBrightnessCalibration: request.calibration,
            observerLatitudeDegrees: request.observerLatitudeDegrees,
            observerLongitudeDegrees: request.observerLongitudeDegrees,
            observerElevationMeters: request.observerElevationMeters,
            sourceSubpointLatitudeDegrees: state.sourceLatitudeDegrees,
            sourceSubpointLongitudeDegrees: state.sourceSubpointLongitudeDegrees,
            sourceInitialLongitudeDegrees: M2_LOCAL_FLAT_FALSE_SUN_INITIAL_LONGITUDE_DEGREES,
            sourceLatitudeModel: M2_LOCAL_FLAT_FALSE_SUN_LATITUDE_MODEL,
            sourceLatitudeResolvedAt: simulationTime,
            sourceClosestApproachRule: 'gmt-clock-source-subpoint-longitude',
            solarSeasonLabel: request.seasonLabel,
            skyOrientation: 'north-up',
            horizontalFrame: 'observer-local-east-north-up',
            solarTimeRule: 'gmt-clock-subsolar-longitude-15-degrees-per-hour',
            renderDateUtc: request.simulationDateUtc,
            renderTimeUtc: simulationTime,
            renderHourUtc: request.utcHour,
            rowLabel: hourLabel,
            synchronizedSolarNoonLongitudeDegrees: solarNoonLongitudeDegrees,
            sphericalSunAltitudeDegrees: state.sphericalSunAltitudeDegrees,
            sphericalSunAzimuthDegrees: state.sphericalSunAzimuthDegrees,
            sphericalDirectionToLight: state.sphericalDirectionToLight,
            sphericalSkydomeFilename: `spherical-skydome-${request.slugPrefix}-${hourSlug}-north-up.png`,
        },
    );
}

/**
 * @param {number} observerLatitudeDegrees - Observer latitude for the derived review scene.
 * @param {number} solarNoonLongitudeDegrees - Longitude whose meridian is synchronized to solar noon.
 * @param {string} slug - Stable id and filename slug.
 * @param {string} sourceRule - Source placement rule label.
 * @param {string} seasonLabel - Season/time label.
 * @param {string} solarTimeRule - Solar-time synchronization label.
 * @returns {LocalFlatSceneConstants} Frozen solar-noon scene.
 */
function createSolarNoonLatitudeScene(
    observerLatitudeDegrees,
    solarNoonLongitudeDegrees,
    slug,
    sourceRule,
    seasonLabel,
    solarTimeRule,
) {
    const state = resolveSummerSolsticeSynchronizedSolarNoonState(
        observerLatitudeDegrees,
        solarNoonLongitudeDegrees,
    );
    const calibration = M2_LOCAL_FLAT_SUMMER_SOLSTICE_LATITUDE_SWEEP_BRIGHTNESS_CALIBRATION;
    const incidentScaleAtObserver = calibration.referenceSpectralIncidentScale * state.distanceFalloffScale;
    const latitudeId = latitudeSlug(observerLatitudeDegrees);

    return freezeLocalFlatScene(
        `san-jose-lon-summer-solstice-${latitudeId}-${slug}`,
        0,
        `flat-skydome-summer-solstice-${latitudeId}-${slug}-north-up.png`,
        state.sourcePositionMeters,
        state.observerDistanceKilometers,
        state.sourceAltitudeDegrees,
        state.sourceAzimuthDegrees,
        state.distanceFalloffScale,
        incidentScaleAtObserver,
        {
            referenceSpectralIncidentScale: calibration.referenceSpectralIncidentScale,
            sourceBrightnessCalibration: calibration,
            observerLatitudeDegrees,
            observerLongitudeDegrees: M2_LOCAL_FLAT_OBSERVER_LONGITUDE_DEGREES,
            observerElevationMeters: M2_LOCAL_FLAT_OBSERVER_ELEVATION_METERS,
            sourceSubpointLatitudeDegrees: state.sourceLatitudeDegrees,
            sourceSubpointLongitudeDegrees: state.sourceSubpointLongitudeDegrees,
            sourceInitialLongitudeDegrees: M2_LOCAL_FLAT_FALSE_SUN_INITIAL_LONGITUDE_DEGREES,
            sourceLatitudeModel: M2_LOCAL_FLAT_FALSE_SUN_LATITUDE_MODEL,
            sourceLatitudeResolvedAt: M2_LOCAL_FLAT_SUMMER_SOLSTICE_SIMULATION_TIME,
            sourceClosestApproachRule: sourceRule,
            solarSeasonLabel: seasonLabel,
            skyOrientation: 'north-up',
            horizontalFrame: 'observer-local-east-north-up',
            solarTimeRule,
            synchronizedSolarNoonLongitudeDegrees: solarNoonLongitudeDegrees,
            sphericalSunAltitudeDegrees: state.sphericalSunAltitudeDegrees,
            sphericalSunAzimuthDegrees: state.sphericalSunAzimuthDegrees,
            sphericalDirectionToLight: state.sphericalDirectionToLight,
            sphericalSkydomeFilename:
                `spherical-skydome-summer-solstice-${latitudeId}-${slug}-north-up.png`,
        },
    );
}

/**
 * @param {number} observerLatitudeDegrees - Observer latitude for the derived review scene.
 * @returns {{
 *   readonly sourcePositionMeters: Position,
 *   readonly observerDistanceKilometers: number,
 *   readonly sourceAltitudeDegrees: number,
 *   readonly sourceAzimuthDegrees: number,
 *   readonly distanceFalloffScale: number,
 *   readonly sourceLatitudeDegrees: number,
 *   readonly sourceSubpointLongitudeDegrees: number
 * }} Derived closest-approach state.
 */
function resolveSummerSolsticeClosestApproachState(observerLatitudeDegrees) {
    const sourceLatitudeDegrees = falseSunLatitudeDegreesForTime(
        M2_LOCAL_FLAT_SUMMER_SOLSTICE_SIMULATION_TIME,
        M2_LOCAL_FLAT_FALSE_SUN_LATITUDE_MODEL,
    );
    const observerScenePositionMeters = projectNorthPoleAeqdScenePositionMeters({
        latitudeDegrees: observerLatitudeDegrees,
        longitudeDegrees: M2_LOCAL_FLAT_OBSERVER_LONGITUDE_DEGREES,
        elevationMeters: M2_LOCAL_FLAT_OBSERVER_ELEVATION_METERS,
    });
    const initialSourceScenePositionMeters = projectNorthPoleAeqdScenePositionMeters({
        latitudeDegrees: sourceLatitudeDegrees,
        longitudeDegrees: M2_LOCAL_FLAT_FALSE_SUN_INITIAL_LONGITUDE_DEGREES,
        elevationMeters: M2_LOCAL_FLAT_FALSE_SUN_ALTITUDE_METERS,
    });
    const closestRotationRadians = closestHorizontalApproachRotationRadians(
        initialSourceScenePositionMeters,
        observerScenePositionMeters,
    );
    const sourceScenePositionMeters = rotateAroundFlatSceneUp(
        initialSourceScenePositionMeters,
        closestRotationRadians,
    );
    const sourcePositionMeters = Object.freeze([
        sourceScenePositionMeters[0] - observerScenePositionMeters[0],
        sourceScenePositionMeters[2] - observerScenePositionMeters[2],
        sourceScenePositionMeters[1]
            - M2_LOCAL_FLAT_OBSERVER_ELEVATION_METERS
            + M2_LOCAL_FLAT_TRANSPORT_OBSERVER_HEIGHT_METERS,
    ]);
    const sourceHorizontalDistanceMeters = Math.hypot(sourcePositionMeters[0], sourcePositionMeters[1]);
    const observerDistanceKilometers = Math.hypot(
        sourcePositionMeters[0],
        sourcePositionMeters[1],
        sourcePositionMeters[2] - M2_LOCAL_FLAT_TRANSPORT_OBSERVER_HEIGHT_METERS,
    ) / 1000;
    const sourceAltitudeDegrees = radiansToDegrees(
        Math.atan2(
            sourcePositionMeters[2] - M2_LOCAL_FLAT_TRANSPORT_OBSERVER_HEIGHT_METERS,
            sourceHorizontalDistanceMeters,
        ),
    );
    const sourceAzimuthDegrees = radiansToDegrees(Math.atan2(sourcePositionMeters[0], sourcePositionMeters[1]));
    const distanceFalloffScale = (M2_LOCAL_FLAT_REFERENCE_DISTANCE_METERS / (observerDistanceKilometers * 1000)) ** 2;

    return Object.freeze({
        sourcePositionMeters,
        observerDistanceKilometers,
        sourceAltitudeDegrees,
        sourceAzimuthDegrees,
        distanceFalloffScale,
        sourceLatitudeDegrees,
        sourceSubpointLongitudeDegrees: longitudeDegreesFromScenePosition(sourceScenePositionMeters),
    });
}

/**
 * @param {number} observerLatitudeDegrees - Observer latitude for the derived review scene.
 * @returns {{
 *   readonly sourcePositionMeters: Position,
 *   readonly observerDistanceKilometers: number,
 *   readonly sourceAltitudeDegrees: number,
 *   readonly sourceAzimuthDegrees: number,
 *   readonly distanceFalloffScale: number,
 *   readonly sourceLatitudeDegrees: number,
 *   readonly sourceSubpointLongitudeDegrees: number,
 *   readonly sphericalSunAltitudeDegrees: number,
 *   readonly sphericalSunAzimuthDegrees: number,
 *   readonly sphericalDirectionToLight: UnitVector3
 * }} Derived synchronized solar-noon state.
 */
function resolveSummerSolsticeSynchronizedSolarNoonState(
    observerLatitudeDegrees,
    solarNoonLongitudeDegrees,
) {
    return resolveSynchronizedSolarNoonState({
        observerLatitudeDegrees,
        observerLongitudeDegrees: M2_LOCAL_FLAT_OBSERVER_LONGITUDE_DEGREES,
        observerElevationMeters: M2_LOCAL_FLAT_OBSERVER_ELEVATION_METERS,
        simulationTime: M2_LOCAL_FLAT_SUMMER_SOLSTICE_SIMULATION_TIME,
        solarNoonLongitudeDegrees,
    });
}

/**
 * @param {{
 *   readonly observerLatitudeDegrees: number,
 *   readonly observerLongitudeDegrees: number,
 *   readonly observerElevationMeters: number,
 *   readonly simulationTime: string,
 *   readonly solarNoonLongitudeDegrees: number
 * }} request - Synchronized-clock source/observer request.
 * @returns {{
 *   readonly sourcePositionMeters: Position,
 *   readonly observerDistanceKilometers: number,
 *   readonly sourceAltitudeDegrees: number,
 *   readonly sourceAzimuthDegrees: number,
 *   readonly distanceFalloffScale: number,
 *   readonly sourceLatitudeDegrees: number,
 *   readonly sourceSubpointLongitudeDegrees: number,
 *   readonly sphericalSunAltitudeDegrees: number,
 *   readonly sphericalSunAzimuthDegrees: number,
 *   readonly sphericalDirectionToLight: UnitVector3
 * }} Derived synchronized-clock source state.
 */
function resolveSynchronizedSolarNoonState(request) {
    const sourceLatitudeDegrees = falseSunLatitudeDegreesForTime(
        request.simulationTime,
        M2_LOCAL_FLAT_FALSE_SUN_LATITUDE_MODEL,
    );
    const observerScenePositionMeters = projectNorthPoleAeqdScenePositionMeters({
        latitudeDegrees: request.observerLatitudeDegrees,
        longitudeDegrees: request.observerLongitudeDegrees,
        elevationMeters: request.observerElevationMeters,
    });
    const sourceScenePositionMeters = projectNorthPoleAeqdScenePositionMeters({
        latitudeDegrees: sourceLatitudeDegrees,
        longitudeDegrees: request.solarNoonLongitudeDegrees,
        elevationMeters: M2_LOCAL_FLAT_FALSE_SUN_ALTITUDE_METERS,
    });
    const sourcePositionMeters = sourceRelativeEastNorthUpMeters(
        sourceScenePositionMeters,
        observerScenePositionMeters,
        request.observerLongitudeDegrees,
    );
    const sourceHorizontalDistanceMeters = Math.hypot(sourcePositionMeters[0], sourcePositionMeters[1]);
    const observerDistanceKilometers = Math.hypot(
        sourcePositionMeters[0],
        sourcePositionMeters[1],
        sourcePositionMeters[2] - M2_LOCAL_FLAT_TRANSPORT_OBSERVER_HEIGHT_METERS,
    ) / 1000;
    const sourceAltitudeDegrees = radiansToDegrees(
        Math.atan2(
            sourcePositionMeters[2] - M2_LOCAL_FLAT_TRANSPORT_OBSERVER_HEIGHT_METERS,
            sourceHorizontalDistanceMeters,
        ),
    );
    const sourceAzimuthDegrees = radiansToDegrees(Math.atan2(sourcePositionMeters[0], sourcePositionMeters[1]));
    const distanceFalloffScale = (M2_LOCAL_FLAT_REFERENCE_DISTANCE_METERS / (observerDistanceKilometers * 1000)) ** 2;
    const sphericalDirectionToLight = sphericalDirectionEastNorthUp(
        request.observerLatitudeDegrees,
        request.observerLongitudeDegrees,
        sourceLatitudeDegrees,
        request.solarNoonLongitudeDegrees,
    );
    const sphericalSunAltitudeDegrees = radiansToDegrees(Math.asin(sphericalDirectionToLight[2]));
    const sphericalSunAzimuthDegrees = radiansToDegrees(
        Math.atan2(sphericalDirectionToLight[1], sphericalDirectionToLight[0]),
    );

    return Object.freeze({
        sourcePositionMeters,
        observerDistanceKilometers,
        sourceAltitudeDegrees,
        sourceAzimuthDegrees,
        distanceFalloffScale,
        sourceLatitudeDegrees,
        sourceSubpointLongitudeDegrees: request.solarNoonLongitudeDegrees,
        sphericalSunAltitudeDegrees,
        sphericalSunAzimuthDegrees,
        sphericalDirectionToLight,
    });
}

/**
 * @param {string} time - ISO-like simulation time.
 * @param {LocalFlatFalseSunLatitudeModel} latitudeModel - False Sun latitude model.
 * @returns {number} Resolved false Sun latitude in degrees.
 */
function falseSunLatitudeDegreesForTime(time, latitudeModel) {
    const amplitudeDeg = (latitudeModel.northLimitDeg - latitudeModel.southLimitDeg) / 2;
    const centerDeg = (latitudeModel.northLimitDeg + latitudeModel.southLimitDeg) / 2;
    const phase = (
        2
        * Math.PI
        * (calendarDayOfYear(time) - latitudeModel.northernSolsticeDayOfYear)
    ) / Math.max(latitudeModel.periodDays, 1);

    return centerDeg + amplitudeDeg * Math.cos(phase);
}

/**
 * @param {string} time - ISO-like date/time string.
 * @returns {number} Calendar day of year, falling back to northern solstice.
 */
function calendarDayOfYear(time) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(time));

    if (!match) {
        return M2_LOCAL_FLAT_FALSE_SUN_LATITUDE_MODEL.northernSolsticeDayOfYear;
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const start = Date.UTC(year, 0, 1);
    const current = Date.UTC(year, monthIndex, day);

    return Math.floor((current - start) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * @param {{
 *   readonly latitudeDegrees: number,
 *   readonly longitudeDegrees: number,
 *   readonly elevationMeters: number
 * }} point - North-polar AEQD scene point.
 * @returns {Position} Projected scene position in meters, y up.
 */
function projectNorthPoleAeqdScenePositionMeters(point) {
    const latitudeRadians = degreesToRadians(point.latitudeDegrees);
    const longitudeRadians = degreesToRadians(point.longitudeDegrees);
    const radiusMeters = M2_LOCAL_FLAT_PROJECTION_SPHERE_RADIUS_METERS * (Math.PI / 2 - latitudeRadians);

    return Object.freeze([
        radiusMeters * Math.sin(longitudeRadians),
        point.elevationMeters,
        radiusMeters * Math.cos(longitudeRadians),
    ]);
}

/**
 * @param {Position} sourceScenePositionMeters - Projected source scene position in meters, y up.
 * @param {Position} observerScenePositionMeters - Projected observer scene position in meters, y up.
 * @param {number} observerLongitudeDegrees - Observer longitude used to derive local east/north axes.
 * @returns {Position} Source position in transport model meters, x east, y north, z up.
 */
function sourceRelativeEastNorthUpMeters(
    sourceScenePositionMeters,
    observerScenePositionMeters,
    observerLongitudeDegrees,
) {
    const longitudeRadians = degreesToRadians(observerLongitudeDegrees);
    const eastAxis = Object.freeze([Math.cos(longitudeRadians), -Math.sin(longitudeRadians)]);
    const northAxis = Object.freeze([-Math.sin(longitudeRadians), -Math.cos(longitudeRadians)]);
    const deltaX = sourceScenePositionMeters[0] - observerScenePositionMeters[0];
    const deltaZ = sourceScenePositionMeters[2] - observerScenePositionMeters[2];

    return Object.freeze([
        deltaX * eastAxis[0] + deltaZ * eastAxis[1],
        deltaX * northAxis[0] + deltaZ * northAxis[1],
        sourceScenePositionMeters[1]
            - observerScenePositionMeters[1]
            + M2_LOCAL_FLAT_TRANSPORT_OBSERVER_HEIGHT_METERS,
    ]);
}

/**
 * @param {number} observerLatitudeDegrees - Observer latitude in degrees.
 * @param {number} observerLongitudeDegrees - Observer longitude in degrees.
 * @param {number} sourceLatitudeDegrees - Subsolar/source latitude in degrees.
 * @param {number} sourceLongitudeDegrees - Subsolar/source longitude in degrees.
 * @returns {UnitVector3} Distant source direction in x-east, y-north, z-up coordinates.
 */
function sphericalDirectionEastNorthUp(
    observerLatitudeDegrees,
    observerLongitudeDegrees,
    sourceLatitudeDegrees,
    sourceLongitudeDegrees,
) {
    const observerLatitudeRadians = degreesToRadians(observerLatitudeDegrees);
    const observerLongitudeRadians = degreesToRadians(observerLongitudeDegrees);
    const sourceLatitudeRadians = degreesToRadians(sourceLatitudeDegrees);
    const sourceLongitudeRadians = degreesToRadians(sourceLongitudeDegrees);
    const sourceDirectionEcef = Object.freeze([
        Math.cos(sourceLatitudeRadians) * Math.cos(sourceLongitudeRadians),
        Math.cos(sourceLatitudeRadians) * Math.sin(sourceLongitudeRadians),
        Math.sin(sourceLatitudeRadians),
    ]);
    const eastAxis = Object.freeze([
        -Math.sin(observerLongitudeRadians),
        Math.cos(observerLongitudeRadians),
        0,
    ]);
    const northAxis = Object.freeze([
        -Math.sin(observerLatitudeRadians) * Math.cos(observerLongitudeRadians),
        -Math.sin(observerLatitudeRadians) * Math.sin(observerLongitudeRadians),
        Math.cos(observerLatitudeRadians),
    ]);
    const upAxis = Object.freeze([
        Math.cos(observerLatitudeRadians) * Math.cos(observerLongitudeRadians),
        Math.cos(observerLatitudeRadians) * Math.sin(observerLongitudeRadians),
        Math.sin(observerLatitudeRadians),
    ]);
    const east = dot2Or3(sourceDirectionEcef, eastAxis);
    const north = dot2Or3(sourceDirectionEcef, northAxis);
    const up = dot2Or3(sourceDirectionEcef, upAxis);
    const length = Math.hypot(east, north, up);

    return Object.freeze([
        east / length,
        north / length,
        up / length,
    ]);
}

/**
 * @param {readonly number[]} a - First vector.
 * @param {readonly number[]} b - Second vector.
 * @returns {number} Dot product.
 */
function dot2Or3(a, b) {
    return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

/**
 * @param {Position} sourcePositionMeters - Source scene position in meters, y up.
 * @param {Position} observerPositionMeters - Observer scene position in meters, y up.
 * @returns {number} Rotation that aligns source and observer radial directions.
 */
function closestHorizontalApproachRotationRadians(sourcePositionMeters, observerPositionMeters) {
    const sourceHorizontalLength = Math.hypot(sourcePositionMeters[0], sourcePositionMeters[2]);
    const observerHorizontalLength = Math.hypot(observerPositionMeters[0], observerPositionMeters[2]);

    if (sourceHorizontalLength === 0 || observerHorizontalLength === 0) {
        return 0;
    }

    const aligned = observerPositionMeters[0] * sourcePositionMeters[0]
        + observerPositionMeters[2] * sourcePositionMeters[2];
    const crossY = observerPositionMeters[0] * sourcePositionMeters[2]
        - observerPositionMeters[2] * sourcePositionMeters[0];

    return ((Math.atan2(crossY, aligned) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

/**
 * @param {Position} positionMeters - Scene position in meters, y up.
 * @param {number} angleRadians - Rotation angle around scene up.
 * @returns {Position} Rotated scene position.
 */
function rotateAroundFlatSceneUp(positionMeters, angleRadians) {
    const rotationCos = Math.cos(angleRadians);
    const rotationSin = Math.sin(angleRadians);

    return Object.freeze([
        positionMeters[0] * rotationCos + positionMeters[2] * rotationSin,
        positionMeters[1],
        -positionMeters[0] * rotationSin + positionMeters[2] * rotationCos,
    ]);
}

/**
 * @param {Position} positionMeters - Scene position in meters, y up.
 * @returns {number} Longitude from projected scene position.
 */
function longitudeDegreesFromScenePosition(positionMeters) {
    return radiansToDegrees(Math.atan2(positionMeters[0], positionMeters[2]));
}

/**
 * @param {number} latitudeDegrees - Latitude in degrees.
 * @returns {string} Stable id slug.
 */
function latitudeSlug(latitudeDegrees) {
    if (Math.abs(latitudeDegrees) < 1e-9) {
        return 'equator';
    }

    return `${String(Math.abs(latitudeDegrees)).padStart(3, '0')}${latitudeDegrees < 0 ? 's' : 'n'}`;
}

/**
 * @param {number} utcHour - UTC clock hour.
 * @returns {number} Longitude synchronized to solar noon for that UTC hour.
 */
function solarNoonLongitudeDegreesForUtcHour(utcHour) {
    return normalizeLongitudeDegrees((12 - utcHour) * 15);
}

/**
 * @param {number} longitudeDegrees - Longitude in degrees.
 * @returns {number} Normalized longitude in the [-180, 180] range, preserving 180.
 */
function normalizeLongitudeDegrees(longitudeDegrees) {
    const normalized = ((((longitudeDegrees + 180) % 360) + 360) % 360) - 180;

    return Math.abs(normalized + 180) < 1e-9 ? 180 : normalized;
}

/**
 * @param {number} degrees - Degrees.
 * @returns {number} Radians.
 */
function degreesToRadians(degrees) {
    return (Number(degrees) || 0) * (Math.PI / 180);
}

/**
 * @param {number} radians - Radians.
 * @returns {number} Degrees.
 */
function radiansToDegrees(radians) {
    return (Number(radians) || 0) * (180 / Math.PI);
}

/**
 * @param {string} id - Stable local/flat scene id.
 * @param {number} offsetDegrees - Rotation offset from closest approach.
 * @param {string} guideImageFilename - Historical guide image filename.
 * @param {Position} sourcePositionMeters - Local source position in flat transport meters.
 * @param {number} observerDistanceKilometers - Historical guide observer/source distance.
 * @param {number} sourceAltitudeDegrees - Historical guide source altitude angle.
 * @param {number} sourceAzimuthDegrees - Historical guide source azimuth angle.
 * @param {number} distanceFalloffScale - Historical guide inverse-square falloff.
 * @param {number} incidentScaleAtObserver - Historical guide calibrated incident scale.
 * @param {Partial<LocalFlatSceneConstants>} [metadata] - Optional derived-scene metadata.
 * @returns {LocalFlatSceneConstants} Frozen local/flat scene constant.
 */
function freezeLocalFlatScene(
    id,
    offsetDegrees,
    guideImageFilename,
    sourcePositionMeters,
    observerDistanceKilometers,
    sourceAltitudeDegrees,
    sourceAzimuthDegrees,
    distanceFalloffScale,
    incidentScaleAtObserver,
    metadata = {},
) {
    return Object.freeze({
        id,
        offsetDegrees,
        guideImageFilename,
        sourcePositionMeters: Object.freeze([...sourcePositionMeters]),
        observerDistanceKilometers,
        sourceAltitudeDegrees,
        sourceAzimuthDegrees,
        distanceFalloffScale,
        incidentScaleAtObserver,
        ...metadata,
    });
}

/**
 * @param {string} id - Stable scene-set id.
 * @param {string} label - Human-readable label.
 * @param {string} description - Scene-set description.
 * @param {readonly LocalFlatSceneConstants[]} scenes - Included scenes.
 * @param {string | null} guideArtifactRoot - Optional guide artifact root.
 * @param {boolean} guideComparisonAvailable - Whether guide images exist.
 * @param {LocalFlatSourceBrightnessCalibration | null} [sourceBrightnessCalibration] - Optional shared source calibration.
 * @returns {LocalFlatSceneSetConstants} Frozen local/flat scene set.
 */
function freezeLocalFlatSceneSet(
    id,
    label,
    description,
    scenes,
    guideArtifactRoot,
    guideComparisonAvailable,
    sourceBrightnessCalibration = null,
) {
    return Object.freeze({
        id,
        label,
        description,
        guideComparisonAvailable,
        guideArtifactRoot,
        exactParityTarget: false,
        scenes,
        sourceBrightnessCalibration,
    });
}
