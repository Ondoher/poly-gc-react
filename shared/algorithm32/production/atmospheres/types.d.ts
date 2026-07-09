/**
 * Configure the canonical Algorithm32 atmosphere profile.
 */
type CanonicalAtmosphereConfig = {
	/**
	 * Store atmosphere constants.
	 */
	readonly constants: CanonicalAtmosphereConstants;

	/**
	 * Store spectral channels used by coefficient calculations.
	 */
	readonly spectralChannels: readonly SpectralChannelConstant[];
};

/**
 * Store constants for canonical atmosphere density, scattering, and phase.
 */
type CanonicalAtmosphereConstants = {
	/**
	 * Store Rayleigh scale height in meters.
	 */
	readonly rayleighScaleHeightMeters: number;

	/**
	 * Store Mie scale height in meters.
	 */
	readonly mieScaleHeightMeters: number;

	/**
	 * Store Rayleigh beta coefficient scale with wavelength in micrometers.
	 */
	readonly rayleighCoefficientScale: number;

	/**
	 * Store Angstrom aerosol alpha.
	 */
	readonly mieAngstromAlpha: number;

	/**
	 * Store Angstrom aerosol beta.
	 */
	readonly mieAngstromBeta: number;

	/**
	 * Store Mie single-scattering albedo.
	 */
	readonly mieSingleScatteringAlbedo: number;

	/**
	 * Store Mie phase asymmetry parameter.
	 */
	readonly miePhaseFunctionG: number;
};
