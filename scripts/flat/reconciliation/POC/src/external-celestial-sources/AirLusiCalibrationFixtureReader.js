// References:
// - https://doi.org/10.18434/mds2-3397, NIST air-LUSI 2022 campaign data.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER5.
// - NIST h5wasm Node API, pinned through the repository dependency lock.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as h5wasm from 'h5wasm/node';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';

const FIXTURE_PATH =
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/air_lusi_spectra.nc';
const EXPECTED_SOURCE_HASH_SHA256 =
    'ab428b8e91ca02cbcd4f154cb5e524dada87514447bb3384af318d255bb9459a';
const EXPECTED_DOI = 'https://doi.org/10.18434/mds2-3397';
const EXPECTED_FLIGHT_IDS = Object.freeze([1, 3, 4, 5]);
const FLIGHT_COUNT = EXPECTED_FLIGHT_IDS.length;
const WAVELENGTH_COUNT = 834;
const IRRADIANCE_UNITS = '$\\mu$W m$^{-2}$ nm$^{-1}$';
const TIME_UNITS = 'microseconds since 2022-03-13T06:10:13.282187';

const DATASET_SCHEMA = Object.freeze({
    Irradiance: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', IRRADIANCE_UNITS),
    GPS_alt_km: schema([FLIGHT_COUNT], '<d', 'km'),
    Press_alt_km: schema([FLIGHT_COUNT], '<d', 'km'),
    Lat: schema([FLIGHT_COUNT], '<d', 'deg'),
    Lon: schema([FLIGHT_COUNT], '<d', 'deg'),
    Irradiance_stat_err: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    slc_rel_err: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    Wavelength_thermal_uncertainty_rel_err:
        schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    Calibration_Coefficients_total_rel_err:
        schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    Wavelength_uncertainty_rel_err: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    Linearity_rel_err: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    Camera_alignment_err: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    Sensitivity_drift_err: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    Time: schema([FLIGHT_COUNT], '<q', TIME_UNITS),
    Wavelength: schema([WAVELENGTH_COUNT], '<d', 'nm'),
    Flight_Number: schema([FLIGHT_COUNT], '<q', ''),
    Combined_atmospheric_rel_err: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    Total_rel_err: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    Time_String: schema([FLIGHT_COUNT], 'S', 'yyyy-mm-ddTHH:MM:SS (UTC)'),
    Lunar_Disk_Reflectance: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    Lunar_Reflectance: schema([FLIGHT_COUNT, WAVELENGTH_COUNT], '<d', ''),
    ephemeris_time: schema([FLIGHT_COUNT], '<d', 'seconds'),
    signed_phase: schema([FLIGHT_COUNT], '<d', 'deg'),
    subobserver_lon: schema([FLIGHT_COUNT], '<d', 'deg'),
    subobserver_lat: schema([FLIGHT_COUNT], '<d', 'deg'),
    subsolar_lon: schema([FLIGHT_COUNT], '<d', 'deg'),
    subsolar_lat: schema([FLIGHT_COUNT], '<d', 'deg'),
    d_observer_moon: schema([FLIGHT_COUNT], '<d', 'km'),
    d_sun_moon: schema([FLIGHT_COUNT], '<d', 'km'),
    distance_correction_factor: schema([FLIGHT_COUNT], '<d', 'km'),
    observer_pos_x: schema([FLIGHT_COUNT], '<d', 'km in J2000'),
    observer_pos_y: schema([FLIGHT_COUNT], '<d', 'km in J2000'),
    observer_pos_z: schema([FLIGHT_COUNT], '<d', 'km in J2000'),
    lunar_zenith_angle: schema([FLIGHT_COUNT], '<d', 'deg'),
});

const ROOT_ATTRIBUTE_NAMES = Object.freeze([
    'description',
    'authors',
    'campaign',
    'email',
    'usage',
    'DOI',
    'creation time',
    'license',
    'dependencies',
    '_NCProperties',
]);

const RETAINED_DATASET_ATTRIBUTE_NAMES = Object.freeze([
    'long_name',
    'units',
    'standard_name',
    'short_name',
    'description',
    'coordinates',
    'calendar',
]);

const RETAINED_DATASET_NAMES = Object.freeze([
    'Wavelength',
    'Irradiance',
    'Lunar_Disk_Reflectance',
    'Total_rel_err',
    'signed_phase',
    'subobserver_lon',
    'subobserver_lat',
    'subsolar_lon',
    'subsolar_lat',
    'd_observer_moon',
    'd_sun_moon',
    'Time',
    'Time_String',
    'Flight_Number',
]);

export default class AirLusiCalibrationFixtureReader {
    /**
     * Create a fail-loud fixture error.
     *
     * @param {string} code - Stable error code.
     * @param {string} message - Human-readable failure.
     * @param {unknown} details - Optional structured diagnostics.
     * @returns {ReconciliationConfigurationError} Configuration error.
     */
    _configurationError(code, message, details = null) {
        return new ReconciliationConfigurationError(message, { code, details });
    }

    /**
     * Hash complete retained bytes with SHA-256.
     *
     * @param {Buffer} bytes - Complete fixture bytes.
     * @returns {string} Lowercase SHA-256 digest.
     */
    _hashBytes(bytes) {
        return createHash('sha256').update(bytes).digest('hex');
    }

    /**
     * Normalize one HDF5 value to immutable JSON-compatible primitives.
     *
     * @param {unknown} value - HDF5 attribute value.
     * @returns {unknown} Frozen JSON-compatible value.
     */
    _normalizeHdf5Value(value) {
        if (typeof value === 'bigint') {
            const numberValue = Number(value);
            if (!Number.isSafeInteger(numberValue)) {
                throw this._configurationError(
                    'ER5_AIR_LUSI_INTEGER_UNSAFE',
                    'AIR-LUSI contains an integer outside the JSON-safe range.',
                );
            }
            return numberValue;
        }
        if (ArrayBuffer.isView(value)) {
            return Object.freeze(Array.from(
                value,
                (entry) => this._normalizeHdf5Value(entry),
            ));
        }
        if (Array.isArray(value)) {
            return Object.freeze(value.map((entry) => this._normalizeHdf5Value(entry)));
        }
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
            return value;
        }
        if (value && typeof value === 'object') {
            return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [
                key,
                this._normalizeHdf5Value(entry),
            ])));
        }
        throw this._configurationError(
            'ER5_AIR_LUSI_ATTRIBUTE_VALUE_UNSUPPORTED',
            'AIR-LUSI contains an unsupported HDF5 attribute value.',
            { valueType: typeof value },
        );
    }

    /**
     * Read required HDF5 attributes without retaining HDF5 reference objects.
     *
     * @param {Readonly<Record<string, unknown>>} attributes - HDF5 attribute mapping.
     * @param {readonly string[]} names - Required attribute names.
     * @param {string} owner - Attribute owner used in an error.
     * @returns {Readonly<Record<string, unknown>>} Frozen JSON-compatible attributes.
     */
    _readRequiredAttributes(attributes, names, owner) {
        return Object.freeze(Object.fromEntries(names.map((name) => {
            if (!Object.hasOwn(attributes, name)) {
                throw this._configurationError(
                    'ER5_AIR_LUSI_ATTRIBUTE_REQUIRED',
                    `AIR-LUSI ${owner} is missing required attribute ${name}.`,
                );
            }
            return [name, this._normalizeHdf5Value(attributes[name].value)];
        })));
    }

    /**
     * Read available semantic HDF5 attributes without retaining internal references.
     *
     * @param {Readonly<Record<string, unknown>>} attributes - HDF5 attribute mapping.
     * @returns {Readonly<Record<string, unknown>>} Frozen JSON-compatible attributes.
     */
    _readSemanticAttributes(attributes) {
        return Object.freeze(Object.fromEntries(RETAINED_DATASET_ATTRIBUTE_NAMES
            .filter((name) => Object.hasOwn(attributes, name))
            .map((name) => [name, this._normalizeHdf5Value(attributes[name].value)])));
    }

    /**
     * Assert that one dataset has the authoritative shape, dtype, and units.
     *
     * @param {unknown} file - Open h5wasm file.
     * @param {string} name - Root dataset name.
     * @param {Readonly<Record<string, unknown>>} expected - Expected schema.
     * @returns {unknown} Validated h5wasm dataset.
     */
    _requireDataset(file, name, expected) {
        const dataset = file.get(name);
        if (!dataset) {
            throw this._configurationError(
                'ER5_AIR_LUSI_DATASET_REQUIRED',
                `AIR-LUSI is missing required dataset ${name}.`,
            );
        }
        const actualShape = Array.isArray(dataset.shape) ? dataset.shape : [...dataset.shape];
        if (
            actualShape.length !== expected.shape.length
            || actualShape.some((value, index) => value !== expected.shape[index])
        ) {
            throw this._configurationError(
                'ER5_AIR_LUSI_DATASET_SHAPE_MISMATCH',
                `AIR-LUSI dataset ${name} has an unexpected shape.`,
                { expected: expected.shape, actual: actualShape },
            );
        }
        if (dataset.dtype !== expected.dtype) {
            throw this._configurationError(
                'ER5_AIR_LUSI_DATASET_DTYPE_MISMATCH',
                `AIR-LUSI dataset ${name} has an unexpected dtype.`,
                { expected: expected.dtype, actual: dataset.dtype },
            );
        }
        if (!Object.hasOwn(dataset.attrs, 'units')) {
            throw this._configurationError(
                'ER5_AIR_LUSI_DATASET_UNITS_REQUIRED',
                `AIR-LUSI dataset ${name} is missing its units attribute.`,
            );
        }
        const actualUnits = this._normalizeHdf5Value(dataset.attrs.units.value);
        if (actualUnits !== expected.units) {
            throw this._configurationError(
                'ER5_AIR_LUSI_DATASET_UNITS_MISMATCH',
                `AIR-LUSI dataset ${name} has unexpected units.`,
                { expected: expected.units, actual: actualUnits },
            );
        }
        return dataset;
    }

    /**
     * Validate the exact authoritative root dataset schema.
     *
     * @param {unknown} file - Open h5wasm file.
     * @returns {Readonly<Record<string, unknown>>} Frozen schema provenance.
     */
    _validateSchema(file) {
        const expectedNames = Object.keys(DATASET_SCHEMA);
        const actualNames = file.keys();
        const unexpected = actualNames.filter((name) => !Object.hasOwn(DATASET_SCHEMA, name));
        const missing = expectedNames.filter((name) => !actualNames.includes(name));
        if (unexpected.length > 0 || missing.length > 0 || actualNames.length !== expectedNames.length) {
            throw this._configurationError(
                'ER5_AIR_LUSI_ROOT_SCHEMA_MISMATCH',
                'AIR-LUSI root datasets do not match the authoritative schema.',
                { missing, unexpected },
            );
        }
        for (const [name, expected] of Object.entries(DATASET_SCHEMA)) {
            this._requireDataset(file, name, expected);
        }
        return Object.freeze(Object.fromEntries(Object.entries(DATASET_SCHEMA).map(([name, entry]) => [
            name,
            Object.freeze({
                shape: entry.shape,
                dtype: entry.dtype,
                units: entry.units,
            }),
        ])));
    }

    /**
     * Read one finite numeric vector from a validated dataset.
     *
     * @param {unknown} file - Open h5wasm file.
     * @param {string} name - Root dataset name.
     * @returns {readonly number[]} Frozen numeric vector.
     */
    _readNumericVector(file, name) {
        const dataset = this._requireDataset(file, name, DATASET_SCHEMA[name]);
        if (!ArrayBuffer.isView(dataset.value)) {
            throw this._configurationError(
                'ER5_AIR_LUSI_NUMERIC_DATASET_REQUIRED',
                `AIR-LUSI dataset ${name} is not numeric.`,
            );
        }
        const values = Array.from(dataset.value, (entry) => Number(entry));
        if (values.length !== DATASET_SCHEMA[name].shape[0] || !values.every(Number.isFinite)) {
            throw this._configurationError(
                'ER5_AIR_LUSI_NUMERIC_VECTOR_INVALID',
                `AIR-LUSI dataset ${name} must contain the expected finite vector.`,
            );
        }
        return Object.freeze(values);
    }

    /**
     * Read one finite flight-by-wavelength matrix from a validated dataset.
     *
     * @param {unknown} file - Open h5wasm file.
     * @param {string} name - Root dataset name.
     * @returns {readonly (readonly number[])[]} Frozen numeric matrix.
     */
    _readNumericMatrix(file, name) {
        const dataset = this._requireDataset(file, name, DATASET_SCHEMA[name]);
        if (!ArrayBuffer.isView(dataset.value)) {
            throw this._configurationError(
                'ER5_AIR_LUSI_NUMERIC_DATASET_REQUIRED',
                `AIR-LUSI dataset ${name} is not numeric.`,
            );
        }
        const values = Array.from(dataset.value, (entry) => Number(entry));
        if (
            values.length !== FLIGHT_COUNT * WAVELENGTH_COUNT
            || !values.every(Number.isFinite)
        ) {
            throw this._configurationError(
                'ER5_AIR_LUSI_NUMERIC_MATRIX_INVALID',
                `AIR-LUSI dataset ${name} must contain four finite 834-sample spectra.`,
            );
        }
        return Object.freeze(Array.from({ length: FLIGHT_COUNT }, (_entry, flightIndex) => {
            const offset = flightIndex * WAVELENGTH_COUNT;
            return Object.freeze(values.slice(offset, offset + WAVELENGTH_COUNT));
        }));
    }

    /**
     * Read one string vector from a validated dataset.
     *
     * @param {unknown} file - Open h5wasm file.
     * @param {string} name - Root dataset name.
     * @returns {readonly string[]} Frozen string vector.
     */
    _readStringVector(file, name) {
        const dataset = this._requireDataset(file, name, DATASET_SCHEMA[name]);
        if (!Array.isArray(dataset.value)) {
            throw this._configurationError(
                'ER5_AIR_LUSI_STRING_DATASET_REQUIRED',
                `AIR-LUSI dataset ${name} is not a string vector.`,
            );
        }
        const values = dataset.value.map((entry) => String(entry));
        if (values.length !== FLIGHT_COUNT || values.some((entry) => entry.length === 0)) {
            throw this._configurationError(
                'ER5_AIR_LUSI_STRING_VECTOR_INVALID',
                `AIR-LUSI dataset ${name} must contain four nonempty strings.`,
            );
        }
        return Object.freeze(values);
    }

    /**
     * Format an exact Unix-microsecond timestamp as ISO 8601 UTC.
     *
     * @param {number} unixMicroseconds - JSON-safe integer microseconds since Unix epoch.
     * @returns {string} Six-fractional-digit ISO 8601 timestamp.
     */
    _formatUnixMicroseconds(unixMicroseconds) {
        const wholeSeconds = Math.floor(unixMicroseconds / 1_000_000);
        const fractionalMicroseconds = unixMicroseconds - wholeSeconds * 1_000_000;
        const prefix = new Date(wholeSeconds * 1000).toISOString().slice(0, 19);
        return `${prefix}.${String(fractionalMicroseconds).padStart(6, '0')}Z`;
    }

    /**
     * Reconstruct exact UTC timestamps from the NetCDF time coordinate.
     *
     * @param {readonly number[]} offsetsMicroseconds - Time-coordinate offsets.
     * @param {readonly string[]} sourceTimeStrings - Source second-resolution strings.
     * @returns {readonly string[]} Frozen exact UTC timestamps.
     */
    _buildTimestamps(offsetsMicroseconds, sourceTimeStrings) {
        const match = /^microseconds since (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{6})$/
            .exec(TIME_UNITS);
        if (!match) {
            throw this._configurationError(
                'ER5_AIR_LUSI_TIME_UNITS_INVALID',
                'AIR-LUSI time units do not contain the expected microsecond epoch.',
            );
        }
        const epochMilliseconds = Date.parse(`${match[1]}.${match[2].slice(0, 3)}Z`);
        const epochMicroseconds = epochMilliseconds * 1000 + Number(match[2].slice(3));
        const timestamps = offsetsMicroseconds.map((offset, index) => {
            if (!Number.isSafeInteger(offset) || offset < 0) {
                throw this._configurationError(
                    'ER5_AIR_LUSI_TIME_OFFSET_INVALID',
                    `AIR-LUSI time offset ${index} must be a nonnegative JSON-safe integer.`,
                );
            }
            const timestamp = this._formatUnixMicroseconds(epochMicroseconds + offset);
            if (timestamp.slice(0, 19) !== sourceTimeStrings[index]) {
                throw this._configurationError(
                    'ER5_AIR_LUSI_TIME_STRING_MISMATCH',
                    `AIR-LUSI time coordinates disagree for flight index ${index}.`,
                    { timestamp, sourceTimeString: sourceTimeStrings[index] },
                );
            }
            return timestamp;
        });
        return Object.freeze(timestamps);
    }

    /**
     * Validate physical-domain invariants needed to consume the retained arrays.
     *
     * @param {Readonly<Record<string, unknown>>} values - Parsed fixture arrays.
     * @returns {void}
     */
    _validateValues(values) {
        for (let index = 1; index < values.wavelength.length; index += 1) {
            if (values.wavelength[index] <= values.wavelength[index - 1]) {
                throw this._configurationError(
                    'ER5_AIR_LUSI_WAVELENGTH_ORDER_INVALID',
                    'AIR-LUSI wavelengths must be strictly increasing.',
                );
            }
        }
        for (const [name, matrix] of [
            ['Irradiance', values.irradiance],
            ['Lunar_Disk_Reflectance', values.lunarDiskReflectance],
            ['Total_rel_err', values.totalRelativeError],
        ]) {
            if (matrix.some((row) => row.some((entry) => entry < 0))) {
                throw this._configurationError(
                    'ER5_AIR_LUSI_NEGATIVE_SPECTRAL_VALUE',
                    `AIR-LUSI dataset ${name} contains a negative value.`,
                );
            }
        }
        for (const [name, vector] of [
            ['d_observer_moon', values.observerMoonDistance],
            ['d_sun_moon', values.sunMoonDistance],
        ]) {
            if (vector.some((entry) => entry <= 0)) {
                throw this._configurationError(
                    'ER5_AIR_LUSI_DISTANCE_INVALID',
                    `AIR-LUSI dataset ${name} contains a nonpositive distance.`,
                );
            }
        }
        if (
            values.flightIds.length !== EXPECTED_FLIGHT_IDS.length
            || values.flightIds.some((value, index) => value !== EXPECTED_FLIGHT_IDS[index])
        ) {
            throw this._configurationError(
                'ER5_AIR_LUSI_FLIGHT_IDS_MISMATCH',
                'AIR-LUSI flight identifiers do not match the retained campaign payload.',
                { expected: EXPECTED_FLIGHT_IDS, actual: values.flightIds },
            );
        }
    }

    /**
     * Read and verify the retained AIR-LUSI lunar calibration fixture.
     *
     * @returns {Promise<AirLusiCalibrationFixture>} Immutable parsed arrays, attributes,
     * schema, and byte provenance.
     */
    async read() {
        const path = resolve(FIXTURE_PATH);
        const bytes = await readFile(path);
        const sourceHashSha256 = this._hashBytes(bytes);
        if (sourceHashSha256 !== EXPECTED_SOURCE_HASH_SHA256) {
            throw this._configurationError(
                'ER5_AIR_LUSI_HASH_MISMATCH',
                'AIR-LUSI fixture SHA-256 does not match the retained authoritative payload.',
                { expected: EXPECTED_SOURCE_HASH_SHA256, actual: sourceHashSha256 },
            );
        }

        await h5wasm.ready;
        const file = new h5wasm.File(path.replaceAll('\\', '/'), 'r');
        try {
            const schemaProvenance = this._validateSchema(file);
            const rootAttributes = this._readRequiredAttributes(
                file.attrs,
                ROOT_ATTRIBUTE_NAMES,
                'root',
            );
            if (rootAttributes.DOI !== EXPECTED_DOI) {
                throw this._configurationError(
                    'ER5_AIR_LUSI_DOI_MISMATCH',
                    'AIR-LUSI root DOI does not match the authoritative NIST dataset.',
                    { expected: EXPECTED_DOI, actual: rootAttributes.DOI },
                );
            }

            const datasetAttributes = Object.freeze(Object.fromEntries(
                RETAINED_DATASET_NAMES.map((name) => [
                    name,
                    this._readSemanticAttributes(file.get(name).attrs),
                ]),
            ));
            const sourceTimeStrings = this._readStringVector(file, 'Time_String');
            const timeOffsetsMicroseconds = this._readNumericVector(file, 'Time');
            const values = Object.freeze({
                wavelength: this._readNumericVector(file, 'Wavelength'),
                irradiance: this._readNumericMatrix(file, 'Irradiance'),
                lunarDiskReflectance:
                    this._readNumericMatrix(file, 'Lunar_Disk_Reflectance'),
                totalRelativeError: this._readNumericMatrix(file, 'Total_rel_err'),
                signedPhase: this._readNumericVector(file, 'signed_phase'),
                subobserverLongitude: this._readNumericVector(file, 'subobserver_lon'),
                subobserverLatitude: this._readNumericVector(file, 'subobserver_lat'),
                subsolarLongitude: this._readNumericVector(file, 'subsolar_lon'),
                subsolarLatitude: this._readNumericVector(file, 'subsolar_lat'),
                observerMoonDistance: this._readNumericVector(file, 'd_observer_moon'),
                sunMoonDistance: this._readNumericVector(file, 'd_sun_moon'),
                timestamps: this._buildTimestamps(
                    timeOffsetsMicroseconds,
                    sourceTimeStrings,
                ),
                flightIds: this._readNumericVector(file, 'Flight_Number'),
            });
            this._validateValues(values);

            return Object.freeze({
                ...values,
                attributes: Object.freeze({
                    root: rootAttributes,
                    datasets: datasetAttributes,
                }),
                schema: Object.freeze({
                    format: 'NetCDF-4/HDF5',
                    flightCount: FLIGHT_COUNT,
                    wavelengthCount: WAVELENGTH_COUNT,
                    datasets: schemaProvenance,
                }),
                provenance: Object.freeze({
                    path,
                    fileName: 'air_lusi_spectra.nc',
                    byteLength: bytes.length,
                    sourceHashSha256,
                    doi: rootAttributes.DOI,
                    campaign: rootAttributes.campaign,
                    creationTime: rootAttributes['creation time'],
                    sourceTimeStrings,
                    timeOffsetsMicroseconds,
                }),
            });
        } finally {
            file.close();
        }
    }
}

/**
 * Create one immutable authoritative dataset-schema entry.
 *
 * @param {readonly number[]} shapeValue - Exact HDF5 dimensions.
 * @param {string} dtype - Exact h5wasm dtype.
 * @param {string} units - Exact NetCDF units attribute.
 * @returns {Readonly<Record<string, unknown>>} Frozen schema entry.
 */
function schema(shapeValue, dtype, units) {
    return Object.freeze({
        shape: Object.freeze([...shapeValue]),
        dtype,
        units,
    });
}
