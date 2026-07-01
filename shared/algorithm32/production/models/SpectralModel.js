import { ScalarMath, SampleMath } from '../utils/MathUtils.js';

/**
 * Own the canonical spectral basis and spectral channel shape for one
 * Algorithm32 configuration.
 */
export class SpectralModel {
	/**
	 * Create a spectral component model from accepted spectral configuration.
	 *
	 * @param {SpectralModelDependencies} dependencies - Supplies the accepted
	 * spectral basis and descriptor metadata.
	 */
	constructor(dependencies) {
		const basis = this._copyBasis(dependencies.basis);

		this._basis = basis;
		this._fingerprint = dependencies.fingerprint ?? this._createFingerprint(basis);
		this._version = dependencies.version;
	}

	/**
	 * Return the canonical spectral basis.
	 *
	 * @returns {SpectralBasis} The active spectral basis.
	 */
	get basis() {
		return this._copyBasis(this._basis);
	}

	/**
	 * Return the active wavelength samples.
	 *
	 * @returns {readonly Wavelength[]} The active wavelength samples.
	 */
	get wavelengths() {
		return this._basis.wavelengths;
	}

	/**
	 * Return the active spectral channel count.
	 *
	 * @returns {number} The active spectral channel count.
	 */
	get channelCount() {
		return this._basis.wavelengths.length;
	}

	/**
	 * Return the stable compatibility fingerprint for this spectral model.
	 *
	 * @returns {string} The spectral compatibility fingerprint.
	 */
	get fingerprint() {
		return this._fingerprint;
	}

	/**
	 * Return the facade-local spectral model version.
	 *
	 * @returns {number} The spectral model version.
	 */
	get version() {
		return this._version;
	}

	/**
	 * Return a serializable descriptor for compatibility checks and shader
	 * construction.
	 *
	 * @returns {SpectralModelDescriptor} The spectral model descriptor.
	 */
	describe() {
		return {
			kind: 'algorithm32-spectral-model',
			wavelengths: this.wavelengths,
			channelCount: this.channelCount,
			fingerprint: this.fingerprint,
			version: this.version,
		};
	}

	/**
	 * Replace the active spectral basis and derived descriptor identity.
	 *
	 * @param {SpectralBasis} basis - Supplies the replacement spectral basis.
	 * @returns {SpectralModelDescriptor} The updated spectral model descriptor.
	 */
	replaceBasis(basis) {
		const nextBasis = this._copyBasis(basis);

		this._basis = nextBasis;
		this._fingerprint = this._createFingerprint(nextBasis);
		this._version += 1;

		return this.describe();
	}

	/**
	 * Return the wavelength for one active channel.
	 *
	 * @param {number} index - Supplies the active channel index.
	 * @returns {Wavelength} The wavelength.
	 */
	getWavelength(index) {
		if (!Number.isInteger(index) || index < 0 || index >= this.channelCount) {
			throw new RangeError(`Spectral channel index ${index} is outside the active channel range.`);
		}

		return this._basis.wavelengths[index];
	}

	/**
	 * Check that a spectral numeric vector is aligned to this model.
	 *
	 * @param {readonly number[]} values - Supplies the spectral numeric vector
	 * to inspect.
	 * @returns {boolean} True when the vector is aligned to this model.
	 */
	isAligned(values) {
		return values.length === this.channelCount;
	}

	/**
	 * Check that another spectral basis is aligned to this model.
	 *
	 * @param {SpectralBasis} basis - Supplies the spectral basis to inspect.
	 * @param {ToleranceOptions} [options] - Supplies call-local wavelength
	 * tolerance behavior.
	 * @returns {boolean} True when the basis is aligned to this model.
	 */
	isBasisAligned(basis, options = {}) {
		if (basis.wavelengths.length !== this.wavelengths.length) {
			return false;
		}

		for (let index = 0; index < this.wavelengths.length; index += 1) {
			const left = basis.wavelengths[index];
			const right = this.wavelengths[index];

			if (left.units !== right.units || !ScalarMath.nearlyEqual(left.value, right.value, options)) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Copy a spectral basis into model-owned immutable data.
	 *
	 * @param {SpectralBasis} basis - Supplies the spectral basis to copy.
	 * @returns {SpectralBasis} The copied spectral basis.
	 */
	_copyBasis(basis) {
		return Object.freeze({
			wavelengths: Object.freeze(basis.wavelengths.map((wavelength) => Object.freeze({
				value: wavelength.value,
				units: wavelength.units,
			}))),
		});
	}

	/**
	 * Create a deterministic fingerprint for a spectral basis.
	 *
	 * @param {SpectralBasis} basis - Supplies the spectral basis to fingerprint.
	 * @returns {string} The deterministic spectral basis fingerprint.
	 */
	_createFingerprint(basis) {
		const samples = basis.wavelengths.map((wavelength) => `${wavelength.value}:${wavelength.units}`).join(',');
		const signature = SampleMath.sampleSignature(basis.wavelengths.map((wavelength) => wavelength.value), {
			precision: 12,
			separator: ',',
		});

		return `spectral:${basis.wavelengths.length}:${signature}:${samples}`;
	}
}
