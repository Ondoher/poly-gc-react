import { SpectralModel } from './SpectralModel.js';

/**
 * Aggregate the canonical Algorithm32 configuration/facts component models.
 */
export class SharedModel {
	/**
	 * Create the shared configuration/facts model for one facade instance.
	 *
	 * @param {SharedModelDependencies} dependencies - Supplies accepted
	 * component models and the facade-local model version.
	 */
	constructor(dependencies) {
		this._version = dependencies.version;
		this._lightSource = dependencies.lightSource;
		this._atmosphere = dependencies.atmosphere;
		this._geometry = dependencies.geometry;
		this._spectral = new SpectralModel({
			basis: dependencies.spectralBasis,
			fingerprint: dependencies.spectralFingerprint,
			version: dependencies.version,
		});
	}

	/**
	 * Return the facade-local shared model version.
	 *
	 * @returns {number} The shared model version.
	 */
	get version() {
		return this._version;
	}

	/**
	 * Return the configured light-source model.
	 *
	 * @returns {LightSourceModel} The configured light-source model.
	 */
	get lightSource() {
		return this._lightSource;
	}

	/**
	 * Return the configured atmosphere model.
	 *
	 * @returns {AtmosphereModel} The configured atmosphere model.
	 */
	get atmosphere() {
		return this._atmosphere;
	}

	/**
	 * Return the configured geometry model.
	 *
	 * @returns {GeometryModel} The configured geometry model.
	 */
	get geometry() {
		return this._geometry;
	}

	/**
	 * Return the configured spectral model.
	 *
	 * @returns {SpectralModel} The configured spectral model.
	 */
	get spectral() {
		return this._spectral;
	}

	/**
	 * Return a serializable snapshot of the shared model descriptors and
	 * version. The snapshot is for inspection and compatibility checks, not
	 * mutation.
	 *
	 * @returns {SharedModelSnapshot} The shared model snapshot.
	 */
	snapshot() {
		return {
			version: this.version,
			lightSource: this.lightSource.describe(),
			atmosphere: this.atmosphere.describe(),
			geometry: this.geometry.describe(),
			spectral: this.spectral.describe(),
		};
	}
}
