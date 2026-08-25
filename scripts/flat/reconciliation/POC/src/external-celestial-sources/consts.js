// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md, canonical source contract.

export const SPECTRAL_IRRADIANCE_DENSITY = 'spectral-irradiance-density';
export const SPECTRAL_RADIANCE_DENSITY = 'spectral-radiance-density';

export const SPECTRAL_DENSITY_UNITS = Object.freeze({
    [SPECTRAL_IRRADIANCE_DENSITY]: 'W m^-2 nm^-1',
    [SPECTRAL_RADIANCE_DENSITY]: 'W m^-2 sr^-1 nm^-1',
});

export const POINT_CELESTIAL_SOURCE = 'point';
export const EXTENDED_CELESTIAL_SOURCE = 'extended';

export const CELESTIAL_SOURCE_MEASURE_QUANTITY = Object.freeze({
    [POINT_CELESTIAL_SOURCE]: SPECTRAL_IRRADIANCE_DENSITY,
    [EXTENDED_CELESTIAL_SOURCE]: SPECTRAL_RADIANCE_DENSITY,
});

export const CANONICAL_DENSITY_BASIS_ID = 'algorithm32-canonical-15-channel-density-v1';
export const CANONICAL_DENSITY_SAMPLE_SEMANTICS = 'bin-average-spectral-density';
export const CANONICAL_DENSITY_QUADRATURE = 'midpoint-bin-average-density-v1';
export const WAVELENGTH_UNITS_NANOMETERS = 'nm';

// References:
// - LIME Model ATBD v3.3, Table 2 and sections 2.6.1, 2.6.2, and 2.7.1.
// - LIME-TBX v1.4.1 elref.py and eli.py retained in the pinned release fixture.

export const LIME_REFERENCE_MOON_SOLID_ANGLE_STERADIANS = 6.4177e-5;
export const LIME_REFERENCE_EARTH_MOON_DISTANCE_KILOMETERS = 384400;

export const LIME_RELEASE_EXECUTABLE_COEFFICIENT_ROW_NAMES = Object.freeze([
    'a0', 'a1', 'a2', 'a3',
    'b1', 'b2', 'b3',
    'c1', 'c2', 'c3', 'c4',
    'd1', 'd2', 'd3',
    'p1', 'p2', 'p3', 'p4',
]);

export const LIME_PAYLOAD_ATBD_TABLE_ROW_MATCHES = Object.freeze([
    'a0', 'a1', 'a2', 'a3',
    'b1', 'b2', 'b3',
    'c2', 'c1', 'c4', 'c3',
    'd1', 'd2', 'd3',
    'p1', 'p2', 'p3', 'p4',
]);

export const LIME_ATBD_TABLE_COEFFICIENT_ROWS = Object.freeze({
    a0: Object.freeze([-2.845826, -2.835119, -2.488881, -2.401018, -2.323384, -1.852121]),
    a1: Object.freeze([-0.638992, -0.256738, -0.371945, -0.144913, -0.129630, -0.268270]),
    a2: Object.freeze([-0.356838, -0.669409, -0.538320, -0.711386, -0.713925, -0.543445]),
    a3: Object.freeze([-0.018674, 0.070965, 0.030280, 0.079849, 0.081491, 0.027159]),
    b1: Object.freeze([0.044132, 0.045100, 0.036971, 0.042253, 0.044992, 0.041477]),
    b2: Object.freeze([0.017323, 0.017509, 0.028278, 0.027430, 0.032692, 0.021095]),
    b3: Object.freeze([-0.007338, -0.008108, -0.011261, -0.011410, -0.013497, -0.008795]),
    c1: Object.freeze([0.0005468, 0.0004583, 0.0004844, 0.0003814, 0.0004653, 0.0002790]),
    c2: Object.freeze([-0.0010941, -0.0013349, -0.0011166, -0.0012480, -0.0012740, -0.0010727]),
    c3: Object.freeze([0.0010326, 0.0011645, 0.0010767, 0.0012339, 0.0012905, 0.0012639]),
    c4: Object.freeze([0.0003428, 0.0003892, 0.0004950, 0.0005315, 0.0006455, 0.0005961]),
    d1: Object.freeze([0.5303836, 0.3989398, 0.4117637, 0.4127379, 0.4148628, 0.4021542]),
    d2: Object.freeze([0.6239650, 0.7587000, 0.6268670, 0.6766222, 0.6541983, 0.4805239]),
    d3: Object.freeze([-0.0039817, -0.0025670, -0.0020087, -0.0008233, -0.0013789, -0.0018533]),
    p1: Object.freeze([1.306236, 1.306236, 1.306236, 1.306236, 1.306236, 1.306236]),
    p2: Object.freeze([18.771380, 18.771380, 18.771380, 18.771380, 18.771380, 18.771380]),
    p3: Object.freeze([12.315492, 12.315492, 12.315492, 12.315492, 12.315492, 12.315492]),
    p4: Object.freeze([8.973327, 8.973327, 8.973327, 8.973327, 8.973327, 8.973327]),
});

export const LIME_ATBD_MODEL_ASSISTED_RANGES_NANOMETERS = Object.freeze([
    Object.freeze([300, 400]),
    Object.freeze([680, 690]),
    Object.freeze([713, 740]),
    Object.freeze([757, 769]),
    Object.freeze([809, 840]),
    Object.freeze([890, 1000]),
    Object.freeze([1080, 1230]),
    Object.freeze([1295, 1540]),
    Object.freeze([1700, 2080]),
    Object.freeze([2345, 2500]),
]);

// Generated with NumPy 1.26.4 and SciPy 1.13.1 interp1d using the LIME
// anchors, nearest endpoint extrapolation, and identity-vector ordinates.
export const LIME_SCIPY_INTERPOLATION_WEIGHT_ORACLE = Object.freeze({
    numpyVersion: '1.26.4',
    scipyVersion: '1.13.1',
    anchorsNanometers: Object.freeze([440, 500, 675, 870, 1020, 1640]),
    samples: Object.freeze([
        Object.freeze({
            wavelengthNanometers: 450,
            quadratic: Object.freeze([
                0.7880716537571456,
                0.22997761083377638,
                -0.02075179331114161,
                0.003291706241349044,
                -0.0005961195478499313,
                0.0000069420267204717424,
            ]),
            cubic: Object.freeze([
                0.771612304035436,
                0.2568838660788089,
                -0.036752868448263025,
                0.010502418250706675,
                -0.002262445440057461,
                0.000016725523368943622,
            ]),
        }),
        Object.freeze({
            wavelengthNanometers: 600,
            quadratic: Object.freeze([
                -0.23474407285059384,
                0.6670564225248303,
                0.6496321818781359,
                -0.09980923567519069,
                0.018075196290164,
                -0.0002104921673457326,
            ]),
            cubic: Object.freeze([
                -0.2518078387893314,
                0.6884768570641342,
                0.6514024306213909,
                -0.11202579467420454,
                0.024132751360612905,
                -0.0001784055826020652,
            ]),
        }),
        Object.freeze({
            wavelengthNanometers: 830,
            quadratic: Object.freeze([
                0.0168795533975531,
                -0.0479654901035774,
                0.17836657979703252,
                0.9627972276171142,
                -0.11137487117467694,
                0.001297000466554646,
            ]),
            cubic: Object.freeze([
                0.03833847549108392,
                -0.09283768025447947,
                0.23174090555276228,
                0.9099416184580745,
                -0.08783263737149546,
                0.000649318124054116,
            ]),
        }),
    ]),
});
