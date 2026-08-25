// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER5 record 047.
// - NIST h5wasm Node API, pinned through the repository dependency lock.

import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as h5wasm from 'h5wasm/node';
import ZipArchiveReader from './ZipArchiveReader.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from './fixtureManifest.js';

const FIXTURE_ROOT =
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures';

export default class LimeCalibrationFixtureReader {
    constructor() {
        this.candidate = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.limeLunarCandidate;
    }

    /**
     * Hash retained bytes with SHA-256.
     *
     * @param {Buffer} bytes - Complete retained bytes.
     * @returns {string} Lowercase SHA-256 digest.
     */
    _hashBytes(bytes) {
        return createHash('sha256').update(bytes).digest('hex');
    }

    /**
     * Assert one retained payload hash before parsing it.
     *
     * @param {Buffer} bytes - Complete retained bytes.
     * @param {string} expectedHash - Manifest-owned SHA-256 digest.
     * @param {string} label - Payload label used in an error.
     * @returns {string} Verified digest.
     */
    _assertHash(bytes, expectedHash, label) {
        const actualHash = this._hashBytes(bytes);
        if (actualHash !== expectedHash) {
            throw new Error(
                label + ' SHA-256 mismatch: expected ' + expectedHash + ', received ' + actualHash + '.',
            );
        }
        return actualHash;
    }

    /**
     * Convert HDF5 values to JSON-compatible primitives.
     *
     * @param {unknown} value - HDF5 attribute or dataset value.
     * @returns {unknown} JSON-compatible value.
     */
    _normalizeHdf5Value(value) {
        if (typeof value === 'bigint') {
            return Number(value);
        }
        if (ArrayBuffer.isView(value)) {
            const normalized = Array.from(value, (entry) => this._normalizeHdf5Value(entry));
            return normalized.length === 1 ? normalized[0] : normalized;
        }
        if (Array.isArray(value)) {
            return value.map((entry) => this._normalizeHdf5Value(entry));
        }
        if (value && typeof value === 'object') {
            return String(value);
        }
        return value;
    }

    /**
     * Read selected HDF5 attributes without retaining NetCDF reference objects.
     *
     * @param {Readonly<Record<string, unknown>>} attributes - HDF5 attribute mapping.
     * @param {readonly string[]} names - Attribute names to retain.
     * @returns {Readonly<Record<string, unknown>>} JSON-compatible attributes.
     */
    _readAttributes(attributes, names) {
        return Object.freeze(Object.fromEntries(names
            .filter((name) => Object.hasOwn(attributes, name))
            .map((name) => [
                name,
                this._normalizeHdf5Value(attributes[name].value),
            ])));
    }

    /**
     * Read one complete numeric HDF5 dataset.
     *
     * @param {unknown} file - Open h5wasm file.
     * @param {string} name - Root dataset name.
     * @param {readonly string[]} attributeNames - Attributes to retain.
     * @returns {Readonly<Record<string, unknown>>} Dataset descriptor and numeric values.
     */
    _readNumericDataset(file, name, attributeNames = []) {
        const dataset = file.get(name);
        if (!dataset || !dataset.value || !ArrayBuffer.isView(dataset.value)) {
            throw new Error('LIME HDF5 dataset ' + name + ' is missing or not numeric.');
        }
        return Object.freeze({
            name,
            shape: Object.freeze([...dataset.shape]),
            dtype: dataset.dtype,
            attributes: this._readAttributes(dataset.attrs, attributeNames),
            values: Object.freeze(Array.from(
                dataset.value,
                (entry) => Number(this._normalizeHdf5Value(entry)),
            )),
        });
    }

    /**
     * Read one complete numeric HDF5 dataset without expanding it to boxed numbers.
     *
     * @param {unknown} file - Open h5wasm file.
     * @param {string} name - Root dataset name.
     * @param {readonly string[]} attributeNames - Attributes to retain.
     * @returns {Readonly<Record<string, unknown>>} Dataset descriptor and Float64 values.
     */
    _readTypedNumericDataset(file, name, attributeNames = []) {
        const dataset = file.get(name);
        if (!dataset || !dataset.value || !ArrayBuffer.isView(dataset.value)) {
            throw new Error('LIME HDF5 dataset ' + name + ' is missing or not numeric.');
        }
        const values = Float64Array.from(dataset.value, Number);
        if (values.some((value) => !Number.isFinite(value))) {
            throw new Error('LIME HDF5 dataset ' + name + ' contains a nonfinite value.');
        }
        return Object.freeze({
            name,
            shape: Object.freeze([...dataset.shape]),
            dtype: dataset.dtype,
            attributes: this._readAttributes(dataset.attrs, attributeNames),
            values,
        });
    }

    /**
     * Read the standalone coefficient NetCDF through the HDF5 C API.
     *
     * @param {string} path - Coefficient fixture path.
     * @returns {Readonly<Record<string, unknown>>} Parsed coefficient payload.
     */
    async _readCoefficientPayload(path) {
        await h5wasm.ready;
        const file = new h5wasm.File(path.replaceAll('\\', '/'), 'r');
        try {
            return Object.freeze({
                attributes: this._readAttributes(file.attrs, [
                    'file_version',
                    'creation_date',
                    'release_date',
                    'software_version',
                    'data_origin',
                    'data_origin_release_date',
                    '_NCProperties',
                ]),
                keys: Object.freeze(file.keys()),
                wavelength: this._readNumericDataset(file, 'wavelength'),
                coefficients: this._readNumericDataset(file, 'coeff', [
                    'standard_name',
                    'units',
                    'u_components',
                    '_FillValue',
                ]),
                relativeUncertaintyPercent: this._readNumericDataset(file, 'u_coeff', [
                    'units',
                    'pdf_shape',
                    'err_corr_1_form',
                    'err_corr_1_params',
                    '_FillValue',
                ]),
                errorCorrelation: this._readNumericDataset(file, 'err_corr_coeff', [
                    '_FillValue',
                ]),
            });
        } finally {
            file.close();
        }
    }

    /**
     * Read the ZIP-embedded ASD NetCDF through a temporary host file.
     *
     * @param {Buffer} bytes - Complete ASD NetCDF bytes.
     * @returns {Promise<Readonly<Record<string, unknown>>>} Parsed ASD payload.
     */
    async _readAsdPayload(bytes) {
        const directory = await mkdtemp(join(tmpdir(), 'poly-gc-lime-asd-'));
        const path = join(directory, 'LIME_ASD-v2.0.0.nc');
        try {
            await writeFile(path, bytes);
            await h5wasm.ready;
            const file = new h5wasm.File(path.replaceAll('\\', '/'), 'r');
            try {
                return Object.freeze({
                    attributes: this._readAttributes(file.attrs, ['_NCProperties']),
                    keys: Object.freeze(file.keys()),
                    wavelength: this._readNumericDataset(file, 'wavelength'),
                    phaseAngle: this._readNumericDataset(file, 'phase_angle'),
                    reflectance: this._readNumericDataset(file, 'reflectance', [
                        'units',
                        'u_components',
                        '_FillValue',
                    ]),
                    relativeUncertaintyPercent: this._readNumericDataset(
                        file,
                        'u_reflectance',
                        [
                            'units',
                            'pdf_shape',
                            'err_corr_1_form',
                            'err_corr_1_params',
                            'err_corr_2_form',
                            'err_corr_2_params',
                            '_FillValue',
                        ],
                    ),
                    wavelengthCorrelation: this._readTypedNumericDataset(
                        file,
                        'err_corr_reflectance_wavelength',
                    ),
                    phaseCorrelation: this._readTypedNumericDataset(
                        file,
                        'err_corr_reflectance_phase_angle',
                    ),
                });
            } finally {
                file.close();
            }
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    }

    /**
     * Load and verify every retained input needed by ER5 lunar calibration.
     *
     * @returns {Promise<LimeCalibrationFixtures>} Verified parsed fixtures and source bytes.
     */
    async read() {
        const coefficientPath = resolve(FIXTURE_ROOT, this.candidate.coefficients.fileName);
        const releasePath = resolve(FIXTURE_ROOT, this.candidate.release.fileName);
        const atbdPath = resolve(FIXTURE_ROOT, this.candidate.atbd.fileName);
        const [coefficientBytes, releaseBytes, atbdBytes] = await Promise.all([
            readFile(coefficientPath),
            readFile(releasePath),
            readFile(atbdPath),
        ]);
        const coefficientHash = this._assertHash(
            coefficientBytes,
            this.candidate.coefficients.sourceHashSha256,
            'LIME coefficient payload',
        );
        const releaseHash = this._assertHash(
            releaseBytes,
            this.candidate.release.sourceHashSha256,
            'LIME release payload',
        );
        const atbdHash = this._assertHash(
            atbdBytes,
            this.candidate.atbd.sourceHashSha256,
            'LIME ATBD payload',
        );
        const archive = new ZipArchiveReader(releaseBytes);
        const embeddedCoefficientBytes = archive.readEntry(
            this.candidate.coefficients.embeddedEntry,
        );
        if (!coefficientBytes.equals(embeddedCoefficientBytes)) {
            throw new Error('Standalone and release-embedded LIME coefficient payloads differ.');
        }
        const asdBytes = archive.readEntry(this.candidate.spectralReference.embeddedEntry);
        const asdHash = this._assertHash(
            asdBytes,
            this.candidate.spectralReference.sourceHashSha256,
            'LIME ASD spectral reference',
        );
        const entries = Object.fromEntries(Object.entries(this.candidate.implementationEntries)
            .map(([id, name]) => {
                const bytes = archive.readEntry(name);
                return [id, Object.freeze({
                    name,
                    byteLength: bytes.length,
                    sourceHashSha256: this._hashBytes(bytes),
                    text: bytes.toString('utf8'),
                })];
            }));
        const [coefficients, asd] = await Promise.all([
            this._readCoefficientPayload(coefficientPath),
            this._readAsdPayload(asdBytes),
        ]);
        return Object.freeze({
            coefficients,
            asd,
            entries: Object.freeze(entries),
            provenance: Object.freeze({
                coefficient: Object.freeze({
                    path: coefficientPath,
                    byteLength: coefficientBytes.length,
                    sourceHashSha256: coefficientHash,
                    embeddedByteIdentical: true,
                }),
                release: Object.freeze({
                    path: releasePath,
                    byteLength: releaseBytes.length,
                    sourceHashSha256: releaseHash,
                }),
                asd: Object.freeze({
                    embeddedEntry: this.candidate.spectralReference.embeddedEntry,
                    byteLength: asdBytes.length,
                    sourceHashSha256: asdHash,
                }),
                atbd: Object.freeze({
                    path: atbdPath,
                    byteLength: atbdBytes.length,
                    sourceHashSha256: atbdHash,
                }),
            }),
        });
    }
}
