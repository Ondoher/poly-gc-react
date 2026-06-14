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
 * Describe a local observer-relative flat placement frame.
 */
type FlatObserverRelativeFlatFrame = {
	/**
	 * Identify the frame as a flat plane.
	 */
	kind: "flat-plane";

	/**
	 * Store the surface point under the observer.
	 */
	origin: FlatVector3;

	/**
	 * Store the local east axis.
	 */
	east: FlatVector3;

	/**
	 * Store the local north axis.
	 */
	north: FlatVector3;

	/**
	 * Store the local up axis.
	 */
	up: FlatVector3;
}

/**
 * Describe a local observer-relative spherical placement frame.
 */
type FlatObserverRelativeSphericalFrame = {
	/**
	 * Identify the frame as a spherical surface.
	 */
	kind: "spherical-surface";

	/**
	 * Store the sphere radius in kilometers.
	 */
	planetRadiusKm: number;

	/**
	 * Store the local east axis at the observer.
	 */
	east: FlatVector3;

	/**
	 * Store the local north axis at the observer.
	 */
	north: FlatVector3;

	/**
	 * Store the local up axis at the observer.
	 */
	up: FlatVector3;
}

/**
 * Describe any observer-relative placement frame.
 */
type FlatObserverRelativeFrame = FlatObserverRelativeFlatFrame | FlatObserverRelativeSphericalFrame;

/**
 * Configure observer-relative placement.
 *
 * Placement frames describe the active surface, not the observer eye position.
 * Returned object centers are offset from that surface by half the requested
 * height along the local surface normal, so placed objects contact the surface.
 */
type FlatObserverRelativePlacementConfig = {
	/**
	 * Store the placement frame.
	 */
	frame: FlatObserverRelativeFrame;

	/**
	 * Store clockwise bearing from local north in radians.
	 */
	bearingRad: number;

	/**
	 * Store requested distance from the observer in kilometers.
	 */
	distanceKm: number;

	/**
	 * Select whether distance refers to the center or nearest edge.
	 */
	distanceReference?: "center" | "near-edge";

	/**
	 * Store object depth in kilometers when near-edge placement is used.
	 */
	depthKm?: number;

	/**
	 * Store object height in kilometers.
	 */
	heightKm?: number;
}

/**
 * Describe observer-relative placement output.
 */
type FlatObserverRelativePlacement = {
	/**
	 * Store the object center position.
	 */
	position: FlatVector3;

	/**
	 * Store local object axes in scene coordinates.
	 */
	orientation: {
		/**
		 * Store the local width axis.
		 */
		xAxis: FlatVector3;

		/**
		 * Store the local height/up axis.
		 */
		yAxis: FlatVector3;

		/**
		 * Store the local depth/bearing axis.
		 */
		zAxis: FlatVector3;
	};

	/**
	 * Store resolved surface placement information.
	 */
	surface: {
		/**
		 * Store the surface point below the object center.
		 */
		centerKm: FlatVector3;

		/**
		 * Store the local surface normal.
		 */
		normal: FlatVector3;

		/**
		 * Store the local bearing direction.
		 */
		bearingDirection: FlatVector3;

		/**
		 * Store center distance along a flat placement plane.
		 */
		linearDistanceKm?: number;

		/**
		 * Store center distance along a spherical surface.
		 */
		geodesicDistanceKm?: number;

		/**
		 * Store the nearest-edge surface point.
		 */
		nearEdgeCenterKm: FlatVector3;

		/**
		 * Store the nearest-edge distance.
		 */
		nearEdgeDistanceKm: number;
	};
}

/**
 * Configure rigid object placement against a spherical surface.
 */
type FlatSphereObjectPlacementConfig = {
	/**
	 * Store the sphere center.
	 */
	sphereCenter?: FlatVector3;

	/**
	 * Store the sphere radius in kilometers.
	 */
	sphereRadiusKm: number;

	/**
	 * Store the radial surface normal where the object is placed.
	 */
	surfaceNormal: FlatVector3;

	/**
	 * Store the tangent reference direction for zero bearing.
	 */
	referenceDirection?: FlatVector3;

	/**
	 * Rotate the object around the radial surface normal.
	 */
	bearingRad?: number;

	/**
	 * Choose surface-mounted outward placement or fully inside placement.
	 */
	side?: "outside" | "inside";

	/**
	 * Store local object bounds in kilometers, or centered size.
	 */
	bounds?: {
		/**
		 * Store minimum local bounds.
		 */
		min?: FlatVector3;

		/**
		 * Store maximum local bounds.
		 */
		max?: FlatVector3;

		/**
		 * Store centered dimensions when min/max are omitted.
		 */
		size?: FlatVector3;
	};
}

/**
 * Describe a rigid object placement against a sphere.
 */
type FlatSphereObjectPlacement = {
	/**
	 * Store whether the object is outside or inside the sphere.
	 */
	side: "outside" | "inside";

	/**
	 * Store the object center in scene coordinates.
	 */
	position: FlatVector3;

	/**
	 * Store local object axes in scene coordinates.
	 */
	orientation: {
		/**
		 * Store the local width axis.
		 */
		xAxis: FlatVector3;

		/**
		 * Store the local height/radial axis.
		 */
		yAxis: FlatVector3;

		/**
		 * Store the local depth/bearing axis.
		 */
		zAxis: FlatVector3;
	};

	/**
	 * Store sphere-relative placement details.
	 */
	sphere: {
		/**
		 * Store the sphere center.
		 */
		center: FlatVector3;

		/**
		 * Store the sphere radius in kilometers.
		 */
		radiusKm: number;

		/**
		 * Store the radial surface normal at the placement point.
		 */
		surfaceNormal: FlatVector3;

		/**
		 * Store the surface point selected by the normal.
		 */
		surfacePoint: FlatVector3;

		/**
		 * Store object-center distance from sphere center.
		 */
		centerRadiusKm: number;

		/**
		 * Store the largest local tangent offset used for inside placement.
		 */
		tangentRadiusKm: number;
	};

	/**
	 * Store normalized local object bounds in kilometers.
	 */
	bounds: {
		/**
		 * Store minimum local bounds.
		 */
		min: FlatVector3;

		/**
		 * Store maximum local bounds.
		 */
		max: FlatVector3;
	};
}

/**
 * Describe geometry that can receive generic object placement.
 */
type FlatObjectPlacementGeometry = {
	/**
	 * Identify flat-plane placement geometry.
	 */
	kind: "flat-plane";

	/**
	 * Store a point on the flat surface.
	 */
	origin?: FlatVector3;

	/**
	 * Store the flat surface normal.
	 */
	normal?: FlatVector3;

	/**
	 * Store the flat surface up direction.
	 */
	up?: FlatVector3;
} | {
	/**
	 * Identify spherical placement geometry.
	 */
	kind: "sphere" | "spherical-surface";

	/**
	 * Store the sphere center.
	 */
	center?: FlatVector3;

	/**
	 * Store the sphere center using atmosphere-style naming.
	 */
	planetCenter?: FlatVector3;

	/**
	 * Store the sphere radius in kilometers.
	 */
	radiusKm?: number;

	/**
	 * Store the sphere radius using atmosphere-style naming.
	 */
	planetRadiusKm?: number;
};

/**
 * Describe the requested surface position for generic object placement.
 */
type FlatObjectPlacementPosition = FlatVector3 | {
	/**
	 * Store an explicit point on the target surface.
	 */
	point?: FlatVector3;

	/**
	 * Store an explicit point on the target surface.
	 */
	surfacePoint?: FlatVector3;

	/**
	 * Store an explicit surface normal.
	 */
	surfaceNormal?: FlatVector3;
};

/**
 * Configure generic object placement against a known geometry.
 */
type FlatObjectPlacementConfig = {
	/**
	 * Store the geometry that decides the placement rule.
	 */
	geometry: FlatObjectPlacementGeometry;

	/**
	 * Store the selected surface position or normal.
	 */
	position: FlatObjectPlacementPosition;

	/**
	 * Store the tangent reference direction for zero bearing.
	 */
	referenceDirection?: FlatVector3;

	/**
	 * Rotate the object around the local surface normal.
	 */
	bearingRad?: number;

	/**
	 * Choose surface-mounted outward placement or fully inside placement.
	 */
	side?: "outside" | "inside";

	/**
	 * Store local object bounds in kilometers, or centered size.
	 */
	bounds?: FlatSphereObjectPlacementConfig["bounds"];
}

/**
 * Describe generic flat-plane object placement output.
 */
type FlatGenericObjectPlacement = {
	/**
	 * Store the resolved geometry kind.
	 */
	geometryKind: "flat-plane";

	/**
	 * Store whether the object is outside or inside the surface.
	 */
	side: "outside" | "inside";

	/**
	 * Store the object center in scene coordinates.
	 */
	position: FlatVector3;

	/**
	 * Store local object axes in scene coordinates.
	 */
	orientation: FlatSphereObjectPlacement["orientation"];

	/**
	 * Store flat surface placement details.
	 */
	surface: {
		/**
		 * Store the selected surface point.
		 */
		point: FlatVector3;

		/**
		 * Store the selected surface normal.
		 */
		normal: FlatVector3;
	};

	/**
	 * Store normalized local object bounds in kilometers.
	 */
	bounds: FlatSphereObjectPlacement["bounds"];
}

/**
 * Describe a fake observer-relative terrain rectangle before scene projection.
 */
type FlatMountainSimulationRectangleSource = {
	/**
	 * Identify the local simulation terrain source kind.
	 */
	kind: "mountain-simulation-rectangle";

	/**
	 * Identify the rectangle.
	 */
	id: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store clockwise bearing from projected north in radians.
	 */
	bearingRad: number;

	/**
	 * Store horizontal distance from the observer in kilometers.
	 */
	distanceKm: number;

	/**
	 * Store rectangle width in kilometers.
	 */
	widthKm: number;

	/**
	 * Store rectangle depth in kilometers.
	 */
	depthKm: number;

	/**
	 * Store rectangle height in kilometers.
	 */
	heightKm: number;

	/**
	 * Store render rotation around the vertical axis in radians.
	 */
	rotationYRad: number;

	/**
	 * Store render styling.
	 */
	style: {
		/**
		 * Store the visible color as a CSS color string.
		 */
		color: string;
	};

	/**
	 * Store human-unit source values used to generate the rectangle.
	 */
	source: {
		/**
		 * Store source height in feet.
		 */
		heightFeet: number;

		/**
		 * Store source distance from the observer in miles.
		 */
		distanceMiles: number;

		/**
		 * Store source bearing in degrees.
		 */
		bearingDeg: number;

		/**
		 * Store optional source role metadata.
		 */
		role?: string;
	};
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
 * Describe supported radiometric-to-display tone mapping curves.
 */
type FlatRadiometricDisplayToneMapping = "linear-clamp" | "reinhard";

/**
 * Describe renderer/display settings for mapping radiometric values to display RGB.
 */
type FlatRadiometricDisplayConfig = {
	/**
	 * Identify the display mapping model.
	 */
	model: string;

	/**
	 * Convert radiometric or relative-radiometric values into scene-linear RGB.
	 */
	radiometricToSceneRgbScale: number;

	/**
	 * Scale scene-linear RGB for viewer/display exposure.
	 */
	exposure: number;

	/**
	 * Select the output tone-mapping curve.
	 */
	toneMapping: FlatRadiometricDisplayToneMapping;
}

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
	 * Store aerosol optical depth at 550 nm for deriving Mie extinction.
	 */
	aerosolOpticalDepth550nm?: number;

	/**
	 * Store the fraction of aerosol extinction that scatters rather than absorbs.
	 */
	aerosolSingleScatteringAlbedo?: number;

	/**
	 * Store the Angstrom exponent for wavelength-dependent aerosol optical depth.
	 */
	aerosolAngstromExponent?: number;

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
	 * Store per-channel Mie extinction coefficients per kilometer.
	 */
	mieExtinctionBetaKm?: FlatRgbColor;

	/**
	 * Store per-channel Mie scattering coefficients per kilometer.
	 */
	mieScatteringBetaKm?: FlatRgbColor;

	/**
	 * Store per-channel Mie absorption coefficients per kilometer.
	 */
	mieAbsorptionBetaKm?: FlatRgbColor;

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
	 * Store per-channel Mie scattering coefficients for compatibility.
	 */
	atmosphereMieBetaKm: readonly [number, number, number];

	/**
	 * Store per-channel Mie extinction coefficients.
	 */
	atmosphereMieExtinctionBetaKm: readonly [number, number, number];

	/**
	 * Store per-channel Mie scattering coefficients.
	 */
	atmosphereMieScatteringBetaKm: readonly [number, number, number];

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
	 * Scale incoming sunlight available for atmosphere scattering.
	 */
	solarIrradianceScale?: number;

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
	 * Store incoming sunlight scale for atmosphere scattering.
	 */
	solarIrradianceScale: number;

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
	 * Store incoming sunlight scale for atmosphere scattering.
	 */
	sunSolarIrradianceScale: number;

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
