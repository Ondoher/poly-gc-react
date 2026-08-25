// References:
// - Kieffer & Stone (2005), The Astronomical Journal 129, 2887-2901,
//   doi:10.1086/430185, equations 10-11 and Table 4 (model version 311g).
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER5.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { binPiecewiseLinearSpectralDensity } from './binPiecewiseLinearSpectralDensity.js';
import SpectralDensityBasis from './SpectralDensityBasis.js';

const DEGREES_TO_RADIANS = Math.PI / 180;
const PUBLISHED_FIT_PHASE_MINIMUM_DEGREES = 1.55;
const PUBLISHED_FIT_PHASE_MAXIMUM_DEGREES = 97;

const LIBRATION_COEFFICIENTS = Object.freeze([
    0.00034115,
    -0.0013425,
    0.00095906,
    0.00066229,
]);

const NONLINEAR_PARAMETERS_DEGREES = Object.freeze([
    4.06054,
    12.8802,
    -30.5858,
    16.7498,
]);

// Columns are wavelength, a0..a3, b1..b3, and d1..d3. The task deliberately
// keeps the published table beside its evaluator so each literal can be audited
// against the retained publication without introducing a second data owner.
const TABLE_4_ROWS = Object.freeze([
    [350.0, -2.67511, -1.78539, 0.50612, -0.25578, 0.03744, 0.00981, -0.00322, 0.34185, 0.01441, -0.01602],
    [355.1, -2.71924, -1.74298, 0.44523, -0.23315, 0.03492, 0.01142, -0.00383, 0.33875, 0.01612, -0.00996],
    [405.0, -2.35754, -1.72134, 0.40337, -0.21105, 0.03505, 0.01043, -0.00341, 0.35235, -0.03818, -0.00006],
    [412.3, -2.34185, -1.74337, 0.42156, -0.21512, 0.03141, 0.01364, -0.00472, 0.36591, -0.05902, 0.00080],
    [414.4, -2.43367, -1.72184, 0.43600, -0.22675, 0.03474, 0.01188, -0.00422, 0.35558, -0.03247, -0.00503],
    [441.6, -2.31964, -1.72114, 0.37286, -0.19304, 0.03736, 0.01545, -0.00559, 0.37935, -0.09562, 0.00970],
    [465.8, -2.35085, -1.66538, 0.41802, -0.22541, 0.04274, 0.01127, -0.00439, 0.33450, -0.02546, -0.00484],
    [475.0, -2.28999, -1.63180, 0.36193, -0.20381, 0.04007, 0.01216, -0.00437, 0.33024, -0.03131, 0.00222],
    [486.9, -2.23351, -1.68573, 0.37632, -0.19877, 0.03881, 0.01566, -0.00555, 0.36590, -0.08945, 0.00678],
    [544.0, -2.13864, -1.60613, 0.27886, -0.16426, 0.03833, 0.01189, -0.00390, 0.37190, -0.10629, 0.01428],
    [549.1, -2.10782, -1.66736, 0.41697, -0.22026, 0.03451, 0.01452, -0.00517, 0.36814, -0.09815, -0.00000],
    [553.8, -2.12504, -1.65970, 0.38409, -0.20655, 0.04052, 0.01009, -0.00388, 0.37206, -0.10745, 0.00347],
    [665.1, -1.88914, -1.58096, 0.30477, -0.17908, 0.04415, 0.00983, -0.00389, 0.37141, -0.13514, 0.01248],
    [693.1, -1.89410, -1.58509, 0.28080, -0.16427, 0.04429, 0.00914, -0.00351, 0.39109, -0.17048, 0.01754],
    [703.6, -1.92103, -1.60151, 0.36924, -0.20567, 0.04494, 0.00987, -0.00386, 0.37155, -0.13989, 0.00412],
    [745.3, -1.86896, -1.57522, 0.33712, -0.19415, 0.03967, 0.01318, -0.00464, 0.36888, -0.14828, 0.00958],
    [763.7, -1.85258, -1.47181, 0.14377, -0.11589, 0.04435, 0.02000, -0.00738, 0.39126, -0.16957, 0.03053],
    [774.8, -1.80271, -1.59357, 0.36351, -0.20326, 0.04710, 0.01196, -0.00476, 0.36908, -0.16182, 0.00830],
    [865.3, -1.74561, -1.58482, 0.35009, -0.19569, 0.04142, 0.01612, -0.00550, 0.39200, -0.18837, 0.00978],
    [872.6, -1.76779, -1.60345, 0.37974, -0.20625, 0.04645, 0.01170, -0.00424, 0.39354, -0.19360, 0.00568],
    [882.0, -1.73011, -1.61156, 0.36115, -0.19576, 0.04847, 0.01065, -0.00404, 0.40714, -0.21499, 0.01146],
    [928.4, -1.75981, -1.45395, 0.13780, -0.11254, 0.05000, 0.01476, -0.00513, 0.41900, -0.19963, 0.02940],
    [939.3, -1.76245, -1.49892, 0.07956, -0.07546, 0.05461, 0.01355, -0.00464, 0.47936, -0.29463, 0.04706],
    [942.1, -1.66473, -1.61875, 0.14630, -0.09216, 0.04533, 0.03010, -0.01166, 0.57275, -0.38204, 0.04902],
    [1059.5, -1.59323, -1.71358, 0.50599, -0.25178, 0.04906, 0.03178, -0.01138, 0.48160, -0.29486, 0.00116],
    [1243.2, -1.53594, -1.55214, 0.31479, -0.18178, 0.03965, 0.03009, -0.01123, 0.49040, -0.30970, 0.01237],
    [1538.7, -1.33802, -1.46208, 0.15784, -0.11712, 0.04674, 0.01471, -0.00656, 0.53831, -0.38432, 0.03473],
    [1633.6, -1.34567, -1.46057, 0.23813, -0.15494, 0.03883, 0.02280, -0.00877, 0.54393, -0.37182, 0.01845],
    [1981.5, -1.26203, -1.25138, -0.06569, -0.04005, 0.04157, 0.02036, -0.00772, 0.49099, -0.36092, 0.04707],
    [2126.3, -1.18946, -2.55069, 2.10026, -0.87285, 0.03819, -0.00685, -0.00200, 0.29239, -0.34784, -0.13444],
    [2250.9, -1.04232, -1.46809, 0.43817, -0.24632, 0.04893, 0.00617, -0.00259, 0.38154, -0.28937, -0.01110],
    [2383.6, -1.08403, -1.31032, 0.20323, -0.15863, 0.05955, -0.00940, 0.00083, 0.36134, -0.28408, 0.01010],
].map((row) => Object.freeze(row)));

const PROVENANCE = Object.freeze({
    sourceId: 'usgs-rolo-lunar-irradiance-model-311g',
    sourceVersion: '311g-published-2005',
    publication: 'Kieffer & Stone (2005), The Astronomical Journal 129, 2887-2901',
    doi: '10.1086/430185',
    coefficientSource: 'equations 10-11 and Table 4',
    retainedPayload:
        'external-celestial-sources/fixtures/kieffer-stone-2005-rolo-311g.pdf',
    retainedPayloadSha256:
        '1666a5414916c2e38fcf34097aad3794cc1aae9d4a7d090bef2a049219316e96',
    quantity: 'dimensionless disk-equivalent lunar reflectance',
    wavelengthSupportNanometers: Object.freeze([350, 2383.6]),
    coefficientRowCount: 32,
});

const QUALIFICATIONS = Object.freeze({
    status: 'qualified-independent-model-reference',
    runtimeOwner: false,
    siTraceableMeasurement: false,
    resolvedRadianceModel: false,
    referenceRole:
        'Independent model-form comparison, especially the Air-LUSI-uncovered first canonical bin; not an SI measurement or runtime lunar source.',
    quantityQualification:
        'The result is disk-equivalent reflectance for the entire lunar disk, not spatially resolved BRDF or radiance.',
    interpolationQualification:
        'Exact bin integrals use a declared piecewise-linear interpolation between the 32 published bands; the paper does not define this continuum reconstruction.',
    fitQualification:
        'The published coefficient fit used observations constrained to 1.55 < absolute phase < 97 degrees. Values at or outside those limits are extrapolations.',
    uncertaintyQualification:
        'The publication reports roughly 1% relative photometric-model performance and a several-percent absolute-scale limitation; this class does not synthesize per-wavelength SI uncertainty.',
});

export default class Rolo311gReferenceModel {
    /**
     * Create a qualified ROLO 311g comparison on one spectral basis.
     *
     * @param {Rolo311gReferenceModelConfiguration} configuration - Destination basis.
     */
    constructor(configuration) {
        if (!configuration || !(configuration.basis instanceof SpectralDensityBasis)) {
            throw configurationError(
                'ER5_ROLO_BASIS_REQUIRED',
                'ROLO 311g evaluation requires a SpectralDensityBasis.',
            );
        }
        this.basis = configuration.basis;
        Object.freeze(this);
    }

    /**
     * Validate and freeze one LIME-compatible lunar geometry.
     *
     * @param {LimeGeometryInput} geometry - Lunar phase and selenographic geometry.
     * @returns {LimeGeometryInput} Validated geometry.
     */
    _validateGeometry(geometry) {
        if (!geometry || typeof geometry !== 'object') {
            throw configurationError(
                'ER5_ROLO_GEOMETRY_REQUIRED',
                'ROLO 311g evaluation requires LIME-compatible geometry.',
            );
        }
        const fields = [
            'absolutePhaseDegrees',
            'sunSelenographicLongitudeRadians',
            'observerSelenographicLatitudeDegrees',
            'observerSelenographicLongitudeDegrees',
        ];
        for (const field of fields) {
            if (!Number.isFinite(geometry[field])) {
                throw configurationError(
                    'ER5_ROLO_GEOMETRY_NONFINITE',
                    `ROLO geometry field ${field} must be finite.`,
                );
            }
        }
        if (geometry.absolutePhaseDegrees < 0 || geometry.absolutePhaseDegrees > 90) {
            throw configurationError(
                'ER5_ROLO_PHASE_OUTSIDE_LIME_DOMAIN',
                'ROLO comparison phase must be inside the LIME-compatible 0..90 degree domain.',
            );
        }
        if (Math.abs(geometry.sunSelenographicLongitudeRadians) > Math.PI) {
            throw configurationError(
                'ER5_ROLO_SUN_LONGITUDE_INVALID',
                'ROLO selenographic Sun longitude must be inside -pi..pi radians.',
            );
        }
        if (Math.abs(geometry.observerSelenographicLatitudeDegrees) > 90) {
            throw configurationError(
                'ER5_ROLO_OBSERVER_LATITUDE_INVALID',
                'ROLO observer selenographic latitude must be inside -90..90 degrees.',
            );
        }
        if (Math.abs(geometry.observerSelenographicLongitudeDegrees) > 180) {
            throw configurationError(
                'ER5_ROLO_OBSERVER_LONGITUDE_INVALID',
                'ROLO observer selenographic longitude must be inside -180..180 degrees.',
            );
        }
        return Object.freeze(Object.fromEntries(fields.map((field) => [field, geometry[field]])));
    }

    /**
     * Evaluate equation 10 for one published wavelength row.
     *
     * @param {LimeGeometryInput} geometry - Validated lunar geometry.
     * @param {readonly number[]} row - One Table 4 coefficient row.
     * @returns {Readonly<Record<string, unknown>>} Term-level reflectance evaluation.
     */
    _evaluateRow(geometry, row) {
        const [
            wavelengthNanometers,
            a0,
            a1,
            a2,
            a3,
            b1,
            b2,
            b3,
            d1,
            d2,
            d3,
        ] = row;
        const phaseRadians = geometry.absolutePhaseDegrees * DEGREES_TO_RADIANS;
        const sunLongitudeRadians = geometry.sunSelenographicLongitudeRadians;
        const observerLatitudeDegrees = geometry.observerSelenographicLatitudeDegrees;
        const observerLongitudeDegrees = geometry.observerSelenographicLongitudeDegrees;
        const [c1, c2, c3, c4] = LIBRATION_COEFFICIENTS;
        const [p1, p2, p3, p4] = NONLINEAR_PARAMETERS_DEGREES;
        const phaseTerms = Object.freeze([
            a0,
            a1 * phaseRadians,
            a2 * phaseRadians ** 2,
            a3 * phaseRadians ** 3,
        ]);
        const sunLongitudeTerms = Object.freeze([
            b1 * sunLongitudeRadians,
            b2 * sunLongitudeRadians ** 3,
            b3 * sunLongitudeRadians ** 5,
        ]);
        const librationTerms = Object.freeze([
            c1 * observerLatitudeDegrees,
            c2 * observerLongitudeDegrees,
            c3 * sunLongitudeRadians * observerLatitudeDegrees,
            c4 * sunLongitudeRadians * observerLongitudeDegrees,
        ]);
        const nonlinearTerms = Object.freeze([
            d1 * Math.exp(-geometry.absolutePhaseDegrees / p1),
            d2 * Math.exp(-geometry.absolutePhaseDegrees / p2),
            d3 * Math.cos((geometry.absolutePhaseDegrees - p3) / p4),
        ]);
        const logDiskEquivalentReflectance = [
            ...phaseTerms,
            ...sunLongitudeTerms,
            ...librationTerms,
            ...nonlinearTerms,
        ].reduce((sum, value) => sum + value, 0);
        return Object.freeze({
            wavelengthNanometers,
            phaseTerms,
            sunLongitudeTerms,
            librationTerms,
            nonlinearTerms,
            logDiskEquivalentReflectance,
            diskEquivalentReflectance: Math.exp(logDiskEquivalentReflectance),
        });
    }

    /**
     * Evaluate all 32 published ROLO bands.
     *
     * @param {LimeGeometryInput} geometry - Lunar phase and selenographic geometry.
     * @returns {readonly Readonly<Record<string, unknown>>[]} Published-band evaluations.
     */
    _evaluateSamples(geometry) {
        return Object.freeze(TABLE_4_ROWS.map((row) => this._evaluateRow(geometry, row)));
    }

    /**
     * Integrate one interval exactly under the declared piecewise-linear reconstruction.
     *
     * @param {readonly Readonly<Record<string, unknown>>[]} samples - Evaluated bands.
     * @param {number} lowerBoundNanometers - Inclusive lower wavelength bound.
     * @param {number} upperBoundNanometers - Inclusive upper wavelength bound.
     * @returns {Readonly<Record<string, unknown>>} Exact integral and bin average.
     */
    _integrateBin(samples, lowerBoundNanometers, upperBoundNanometers) {
        if (
            !Number.isFinite(lowerBoundNanometers)
            || !Number.isFinite(upperBoundNanometers)
            || lowerBoundNanometers >= upperBoundNanometers
        ) {
            throw configurationError(
                'ER5_ROLO_BIN_BOUNDS_INVALID',
                'ROLO bin bounds must be finite and strictly increasing.',
            );
        }
        if (
            lowerBoundNanometers < TABLE_4_ROWS[0][0]
            || upperBoundNanometers > TABLE_4_ROWS.at(-1)[0]
        ) {
            throw configurationError(
                'ER5_ROLO_BIN_OUTSIDE_SUPPORT',
                'ROLO bin evaluation cannot extrapolate beyond the published wavelength support.',
            );
        }
        let integratedReflectanceNanometers = 0;
        let contributingSegmentCount = 0;
        for (let index = 0; index < samples.length - 1; index += 1) {
            const left = samples[index];
            const right = samples[index + 1];
            const segmentLower = Math.max(lowerBoundNanometers, left.wavelengthNanometers);
            const segmentUpper = Math.min(upperBoundNanometers, right.wavelengthNanometers);
            if (segmentUpper <= segmentLower) {
                continue;
            }
            const width = right.wavelengthNanometers - left.wavelengthNanometers;
            const valueAt = (wavelength) => left.diskEquivalentReflectance
                + (right.diskEquivalentReflectance - left.diskEquivalentReflectance)
                * (wavelength - left.wavelengthNanometers) / width;
            integratedReflectanceNanometers += (
                valueAt(segmentLower) + valueAt(segmentUpper)
            ) * (segmentUpper - segmentLower) / 2;
            contributingSegmentCount += 1;
        }
        return Object.freeze({
            lowerBoundNanometers,
            upperBoundNanometers,
            widthNanometers: upperBoundNanometers - lowerBoundNanometers,
            integratedReflectanceNanometers,
            diskEquivalentReflectance: integratedReflectanceNanometers
                / (upperBoundNanometers - lowerBoundNanometers),
            contributingSegmentCount,
            method: 'piecewise-linear-exact-bin-integral-v1',
        });
    }

    /**
     * Return immutable model identity and use qualifications.
     *
     * @returns {Readonly<Record<string, unknown>>} Model descriptor.
     */
    describe() {
        return Object.freeze({
            modelId: 'rolo-311g-qualified-reference',
            provenance: PROVENANCE,
            qualifications: QUALIFICATIONS,
            constants: Object.freeze({
                c: LIBRATION_COEFFICIENTS,
                pDegrees: NONLINEAR_PARAMETERS_DEGREES,
            }),
            basis: this.basis.describe(),
        });
    }

    /**
     * Evaluate a linearly interpolated reflectance at one wavelength.
     *
     * @param {LimeGeometryInput} geometry - Lunar phase and selenographic geometry.
     * @param {number} wavelengthNanometers - Requested wavelength in published support.
     * @returns {number} Dimensionless disk-equivalent reflectance.
     */
    evaluateWavelength(geometry, wavelengthNanometers) {
        const validatedGeometry = this._validateGeometry(geometry);
        if (
            !Number.isFinite(wavelengthNanometers)
            || wavelengthNanometers < TABLE_4_ROWS[0][0]
            || wavelengthNanometers > TABLE_4_ROWS.at(-1)[0]
        ) {
            throw configurationError(
                'ER5_ROLO_WAVELENGTH_INVALID',
                'ROLO wavelength must be finite and inside published support.',
            );
        }
        const samples = this._evaluateSamples(validatedGeometry);
        const exact = samples.find((sample) =>
            sample.wavelengthNanometers === wavelengthNanometers);
        if (exact) {
            return exact.diskEquivalentReflectance;
        }
        const rightIndex = samples.findIndex((sample) =>
            sample.wavelengthNanometers > wavelengthNanometers);
        const left = samples[rightIndex - 1];
        const right = samples[rightIndex];
        return left.diskEquivalentReflectance
            + (right.diskEquivalentReflectance - left.diskEquivalentReflectance)
            * (wavelengthNanometers - left.wavelengthNanometers)
            / (right.wavelengthNanometers - left.wavelengthNanometers);
    }

    /**
     * Evaluate an exact average over one wavelength interval.
     *
     * @param {LimeGeometryInput} geometry - Lunar phase and selenographic geometry.
     * @param {number} lowerBoundNanometers - Inclusive lower wavelength bound.
     * @param {number} upperBoundNanometers - Inclusive upper wavelength bound.
     * @returns {Readonly<Record<string, unknown>>} Piecewise-linear bin evaluation.
     */
    evaluateBinAverage(geometry, lowerBoundNanometers, upperBoundNanometers) {
        const validatedGeometry = this._validateGeometry(geometry);
        return this._integrateBin(
            this._evaluateSamples(validatedGeometry),
            lowerBoundNanometers,
            upperBoundNanometers,
        );
    }

    /**
     * Evaluate published bands and conservative averages on the configured basis.
     *
     * @param {LimeGeometryInput} geometry - Lunar phase and selenographic geometry.
     * @returns {Rolo311gEvaluation} Qualified model-reference evaluation.
     */
    evaluate(geometry) {
        const validatedGeometry = this._validateGeometry(geometry);
        const samples = this._evaluateSamples(validatedGeometry);
        const binnedReflectance = binPiecewiseLinearSpectralDensity({
            wavelengthsNanometers: samples.map((sample) => sample.wavelengthNanometers),
            densityValues: samples.map((sample) => sample.diskEquivalentReflectance),
        }, this.basis);
        const insidePublishedFitDomain =
            validatedGeometry.absolutePhaseDegrees > PUBLISHED_FIT_PHASE_MINIMUM_DEGREES
            && validatedGeometry.absolutePhaseDegrees < PUBLISHED_FIT_PHASE_MAXIMUM_DEGREES;
        return Object.freeze({
            modelId: 'rolo-311g-qualified-reference',
            quantity: 'dimensionless-disk-equivalent-lunar-reflectance',
            units: '1',
            geometry: validatedGeometry,
            samples,
            binnedReflectance,
            geometryQualification: Object.freeze({
                insidePublishedFitDomain,
                publishedFitPhaseDomainDegrees: Object.freeze([
                    PUBLISHED_FIT_PHASE_MINIMUM_DEGREES,
                    PUBLISHED_FIT_PHASE_MAXIMUM_DEGREES,
                ]),
                phaseUse: insidePublishedFitDomain
                    ? 'interpolation-inside-published-fit-domain'
                    : 'extrapolation-outside-published-fit-domain',
            }),
            provenance: PROVENANCE,
            qualifications: QUALIFICATIONS,
        });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
