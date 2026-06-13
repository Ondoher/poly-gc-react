/**
 * Describe a three-dimensional vector in flat scene coordinates.
 *
 * Distances are in kilometers unless a caller explicitly documents another
 * unit for the same shape.
 */
type FlatVector3 = {
	/**
	 * Store the horizontal x coordinate.
	 */
	x: number;

	/**
	 * Store the vertical y coordinate.
	 */
	y: number;

	/**
	 * Store the horizontal z coordinate.
	 */
	z: number;
}

/**
 * Describe a linear RGB color or wavelength coefficient triplet.
 */
type FlatRgbColor = {
	/**
	 * Store the red channel or red wavelength coefficient.
	 */
	r: number;

	/**
	 * Store the green channel or green wavelength coefficient.
	 */
	g: number;

	/**
	 * Store the blue channel or blue wavelength coefficient.
	 */
	b: number;
}

/**
 * Describe accepted RGB input forms for shared math helpers.
 */
type FlatRgbColorInput = Partial<FlatRgbColor> | readonly [number, number, number];

/**
 * Describe the supported atmosphere density layers.
 */
type FlatAtmosphereLayer = "rayleigh" | "aerosol";

/**
 * Describe the atmospheric density and scattering constants used by
 * `Atmosphere`.
 */
type FlatAtmosphereProfile = {
	/**
	 * Identify the profile for debugging or UI display.
	 */
	id: string;

	/**
	 * Store the top altitude of the atmosphere in kilometers.
	 */
	topAltitudeKm: number;

	/**
	 * Store sea-level air density in kilograms per cubic meter.
	 */
	seaLevelDensityKgM3: number;

	/**
	 * Store the Rayleigh density scale height in kilometers.
	 */
	rayleighScaleHeightKm: number;

	/**
	 * Store the aerosol/Mie density scale height in kilometers.
	 */
	aerosolScaleHeightKm: number;

	/**
	 * Store per-channel Rayleigh extinction coefficients per kilometer.
	 */
	rayleighBetaKm: FlatRgbColor;

	/**
	 * Store per-channel Mie extinction coefficients per kilometer.
	 */
	mieBetaKm: FlatRgbColor;

	/**
	 * Scale the aerosol/Mie contribution.
	 */
	mieStrength: number;

	/**
	 * Store the Henyey-Greenstein anisotropy value for Mie scattering.
	 */
	mieAnisotropy: number;

	/**
	 * Store the fallback airlight tint as a CSS color string.
	 */
	airlightColor: string;

	/**
	 * Clamp accumulated airlight to this normalized upper bound.
	 */
	maxAirlight: number;

	/**
	 * Store the default integration step count.
	 */
	integrationSteps: number;
}

/**
 * Describe a flat slab atmosphere above a ground plane.
 */
type FlatAtmosphereFlatSlabFrame = {
	/**
	 * Identify the frame kind.
	 */
	kind: "flat-slab";

	/**
	 * Store a point on the ground plane.
	 */
	origin: FlatVector3;

	/**
	 * Store the normalized up vector away from the ground plane.
	 */
	up: FlatVector3;
}

/**
 * Describe a spherical atmosphere shell around a planet.
 */
type FlatAtmosphereSphericalShellFrame = {
	/**
	 * Identify the frame kind.
	 */
	kind: "spherical-shell";

	/**
	 * Store the planet center in scene coordinates.
	 */
	planetCenter: FlatVector3;

	/**
	 * Store the planet radius in kilometers.
	 */
	planetRadiusKm: number;
}

/**
 * Describe any atmosphere frame supported by `Atmosphere`.
 */
type FlatAtmosphereFrame = FlatAtmosphereFlatSlabFrame | FlatAtmosphereSphericalShellFrame;

/**
 * Describe optional atmosphere construction settings.
 */
type FlatAtmosphereConfig = {
	/**
	 * Override the default atmosphere profile.
	 */
	profile?: Partial<Omit<FlatAtmosphereProfile, "rayleighBetaKm" | "mieBetaKm">> & {
		/**
		 * Override per-channel Rayleigh extinction coefficients.
		 */
		rayleighBetaKm?: FlatRgbColorInput;

		/**
		 * Override per-channel Mie extinction coefficients.
		 */
		mieBetaKm?: FlatRgbColorInput;
	};

	/**
	 * Select the atmosphere frame.
	 */
	frame?: Partial<FlatAtmosphereFrame>;

	/**
	 * Provide the default sun/light state used by scattering methods.
	 */
	sun?: FlatSunConfig | null;
}

/**
 * Describe basic atmosphere integration options.
 */
type FlatAtmosphereSampleOptions = {
	/**
	 * Override the number of integration steps.
	 */
	steps?: number;
}

/**
 * Describe sample-to-light transmittance options.
 */
type FlatAtmosphereLightSampleOptions = FlatAtmosphereSampleOptions & {
	/**
	 * Limit sample-to-light integration distance in kilometers.
	 */
	maxLightDistanceKm?: number;
}

/**
 * Describe an optical-depth/transmittance sample along a view segment.
 */
type FlatAtmosphereSample = {
	/**
	 * Store the total segment distance in kilometers.
	 */
	distanceKm: number;

	/**
	 * Store the portion of the segment inside the atmosphere in kilometers.
	 */
	atmosphereDistanceKm: number;

	/**
	 * Store integrated Rayleigh density over the atmospheric path.
	 */
	rayleighColumnDensityKgM3Km: number;

	/**
	 * Store integrated aerosol density over the atmospheric path.
	 */
	aerosolColumnDensityKgM3Km: number;

	/**
	 * Store average Rayleigh density over the atmospheric path.
	 */
	averageRayleighDensityKgM3: number;

	/**
	 * Store average aerosol density over the atmospheric path.
	 */
	averageAerosolDensityKgM3: number;

	/**
	 * Store per-channel optical depth accumulated along the segment.
	 */
	opticalDepth: FlatRgbColor;

	/**
	 * Store per-channel transmittance for the segment.
	 */
	transmittance: FlatRgbColor;

	/**
	 * Store a normalized scalar airlight approximation.
	 */
	airlight: number;
}

/**
 * Describe per-layer scattering coefficients at a sample altitude.
 */
type FlatAtmosphereScatteringCoefficients = {
	/**
	 * Store Rayleigh scattering coefficients.
	 */
	rayleigh: FlatRgbColor;

	/**
	 * Store Mie scattering coefficients.
	 */
	mie: FlatRgbColor;

	/**
	 * Store combined Rayleigh and Mie scattering coefficients.
	 */
	combined: FlatRgbColor;
}

/**
 * Describe transmittance from one atmospheric point toward a light source.
 */
type FlatAtmosphereLightTransmittanceSample = {
	/**
	 * Indicate whether the ground or planet blocks direct light.
	 */
	shadowed: boolean;

	/**
	 * Store the sampled light path distance in kilometers.
	 */
	distanceKm: number;

	/**
	 * Store per-channel light-path transmittance.
	 */
	transmittance: FlatRgbColor;

	/**
	 * Store per-channel light-path optical depth when the path was sampled.
	 */
	opticalDepth?: FlatRgbColor;
}

/**
 * Describe single-scattering integration options.
 */
type FlatAtmosphereSingleScatteringOptions = FlatAtmosphereLightSampleOptions & {
	/**
	 * Override the default light source.
	 */
	light?: FlatSunConfig | null;

	/**
	 * Override the default light source using the legacy option name.
	 */
	sun?: FlatSunConfig | null;

	/**
	 * Override the number of sample-to-light integration steps.
	 */
	lightSteps?: number;
}

/**
 * Describe the result of single-scattering integration along a view ray.
 */
type FlatAtmosphereSingleScatteringSample = {
	/**
	 * Store the total sampled view distance in kilometers.
	 */
	distanceKm: number;

	/**
	 * Store the portion of the view ray inside the atmosphere in kilometers.
	 */
	atmosphereDistanceKm: number;

	/**
	 * Count atmospheric samples that could not see direct sunlight.
	 */
	shadowedSamples: number;

	/**
	 * Store the resolved light state used for the sample.
	 */
	light: FlatSunState | null;

	/**
	 * Store accumulated per-channel optical depth.
	 */
	opticalDepth: FlatRgbColor;

	/**
	 * Store per-channel transmittance along the sampled view ray.
	 */
	transmittance: FlatRgbColor;

	/**
	 * Store accumulated RGB in-scattered light.
	 */
	inScatteredLight: FlatRgbColor;

	/**
	 * Store a normalized scalar airlight approximation.
	 */
	airlight: number;
}

/**
 * Describe shader-uniform-ready atmosphere state.
 */
type FlatAtmosphereShaderUniforms = {
	/**
	 * Store the active atmosphere frame kind.
	 */
	atmosphereFrameKind: FlatAtmosphereFrame["kind"];

	/**
	 * Store the atmosphere top altitude in kilometers.
	 */
	atmosphereTopAltitudeKm: number;

	/**
	 * Store sea-level air density in kilograms per cubic meter.
	 */
	atmosphereSeaLevelDensityKgM3: number;

	/**
	 * Store the Rayleigh density scale height in kilometers.
	 */
	atmosphereRayleighScaleHeightKm: number;

	/**
	 * Store the aerosol/Mie density scale height in kilometers.
	 */
	atmosphereAerosolScaleHeightKm: number;

	/**
	 * Store per-channel Rayleigh extinction coefficients.
	 */
	atmosphereRayleighBetaKm: readonly [number, number, number];

	/**
	 * Store per-channel Mie extinction coefficients.
	 */
	atmosphereMieBetaKm: readonly [number, number, number];

	/**
	 * Store the Mie anisotropy value.
	 */
	atmosphereMieAnisotropy: number;

	/**
	 * Store the fallback airlight tint as a CSS color string.
	 */
	atmosphereAirlightColor: string;

	/**
	 * Store the normalized maximum airlight value.
	 */
	atmosphereMaxAirlight: number;

	/**
	 * Store the default integration step count.
	 */
	atmosphereIntegrationSteps: number;

	/**
	 * Store a clone of the active atmosphere frame.
	 */
	atmosphereFrame: FlatAtmosphereFrame;
} & Partial<FlatSunShaderUniforms>;

/**
 * Describe supported sun/light source kinds.
 */
type FlatSunKind = "directional" | "point";

/**
 * Describe why a sun/light source is positioned where it is.
 */
type FlatSunAnchor = {
	/**
	 * Identify the anchor source.
	 */
	kind: string;

	/**
	 * Mark whether the anchor is settled or still an open assumption.
	 */
	status: string;
}

/**
 * Describe optional construction settings for the shared `Sun` class.
 */
type FlatSunConfig = {
	/**
	 * Select directional or point-light behavior.
	 */
	kind?: FlatSunKind;

	/**
	 * Store the direction toward a distant sun.
	 */
	direction?: Partial<FlatVector3>;

	/**
	 * Store the scene position of a nearby point sun.
	 */
	position?: Partial<FlatVector3>;

	/**
	 * Store light color.
	 */
	color?: FlatRgbColorInput;

	/**
	 * Scale light contribution.
	 */
	intensity?: number;

	/**
	 * Store angular radius in radians for directional sunlight.
	 */
	angularRadiusRad?: number;

	/**
	 * Store physical radius in kilometers for a point sun body.
	 */
	radiusKm?: number;

	/**
	 * Describe the assumption that positioned the light.
	 */
	anchor?: Partial<FlatSunAnchor>;
}

/**
 * Describe the resolved, serializable state of a sun/light source.
 */
type FlatSunState = {
	/**
	 * Store directional or point-light behavior.
	 */
	kind: FlatSunKind;

	/**
	 * Store normalized distant-sun direction, or `null` for point lights.
	 */
	direction: FlatVector3 | null;

	/**
	 * Store point-sun position, or `null` for directional lights.
	 */
	position: FlatVector3 | null;

	/**
	 * Store light color.
	 */
	color: FlatRgbColor;

	/**
	 * Store light intensity multiplier.
	 */
	intensity: number;

	/**
	 * Store angular radius in radians for directional sunlight.
	 */
	angularRadiusRad: number;

	/**
	 * Store physical radius in kilometers.
	 */
	radiusKm: number;

	/**
	 * Store the positioning assumption for this light state.
	 */
	anchor: FlatSunAnchor;
}

/**
 * Describe sun state resolved from a sample position.
 */
type FlatSunLightState = FlatSunState & {
	/**
	 * Store the normalized direction from the sample point toward the light.
	 */
	direction: FlatVector3;

	/**
	 * Store the distance from the sample point to the light in kilometers.
	 */
	distanceKm: number;

	/**
	 * Store the apparent angular radius from the sample point in radians.
	 */
	apparentAngularRadiusRad: number;

	/**
	 * Store the apparent angular diameter from the sample point in radians.
	 */
	apparentAngularDiameterRad: number;
}

/**
 * Describe shader-uniform-ready sun state.
 */
type FlatSunShaderUniforms = {
	/**
	 * Store the active sun kind.
	 */
	sunKind: FlatSunKind;

	/**
	 * Store normalized directional-sun direction.
	 */
	sunDirection: readonly [number, number, number] | null;

	/**
	 * Store point-sun position.
	 */
	sunPosition: readonly [number, number, number] | null;

	/**
	 * Store light color.
	 */
	sunColor: readonly [number, number, number];

	/**
	 * Store light intensity.
	 */
	sunIntensity: number;

	/**
	 * Store directional-sun angular radius in radians.
	 */
	sunAngularRadiusRad: number;

	/**
	 * Store physical sun radius in kilometers.
	 */
	sunRadiusKm: number;

	/**
	 * Store the positioning assumption for the sun.
	 */
	sunAnchor: FlatSunAnchor;
}
