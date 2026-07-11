/**
 * Describe a selected observer for the globe calibration view.
 */
type GlobeLocation = {
	/**
	 * Identify the location record.
	 */
	id: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store the first administrative region.
	 */
	admin1: string;

	/**
	 * Store the country code.
	 */
	country: string;

	/**
	 * Store latitude in decimal degrees.
	 */
	lat: number;

	/**
	 * Store longitude in decimal degrees.
	 */
	lon: number;

	/**
	 * Store elevation above sea level in meters.
	 */
	elevationMeters: number;
}

/**
 * Describe the visual surface material used for globe atmosphere calibration.
 */
type GlobeSurfaceMaterial = {
	/**
	 * Identify the material model.
	 */
	model: "matte-solid-color";

	/**
	 * Store the solid material color.
	 */
	color: string;

	/**
	 * Store diffuse roughness from 0 to 1.
	 */
	roughness: number;

	/**
	 * Store metallic response from 0 to 1.
	 */
	metalness: number;

	/**
	 * Indicate whether the material includes map/terrain surface features.
	 */
	surfaceFeatures: boolean;
}

/**
 * Describe physical and renderer-bridge solar-source settings.
 */
type GlobeSolarSource = {
	/**
	 * Identify the solar-source model.
	 */
	model: string;

	/**
	 * Store total solar irradiance at one astronomical unit.
	 */
	totalSolarIrradianceWm2: number;

	/**
	 * Store approximate solar color temperature.
	 */
	colorTemperatureK: number;

	/**
	 * Store the clear-day reference direct normal irradiance near the surface.
	 */
	targetDirectNormalIrradianceWm2AtReferencePoint: number;

	/**
	 * Store the astronomical unit in kilometers.
	 */
	astronomicalUnitKm: number;

	/**
	 * Approximate the fraction of removed direct irradiance treated as diffuse sky irradiance.
	 */
	diffuseSkyIrradianceLossFraction: number;

	/**
	 * Store the temporary renderer bridge reference irradiance.
	 */
	rendererIrradianceReferenceWm2: number;

	/**
	 * Describe the temporary renderer bridge.
	 */
	rendererBridge: {
		model: string;
		status: string;
	};
}

/**
 * Describe solar irradiance probes for the globe calibration scene.
 */
type GlobeSolarIrradianceProbes = {
	/**
	 * Identify the probe model.
	 */
	model: string;

	/**
	 * Store top-of-atmosphere irradiance adjusted by current Sun distance.
	 */
	topOfAtmosphereIrradianceWm2: number;

	/**
	 * Store direct normal irradiance at the observer after atmosphere transmittance.
	 */
	directNormalIrradianceAtObserverWm2: number;

	/**
	 * Store direct horizontal irradiance at the observer.
	 */
	directHorizontalIrradianceAtObserverWm2: number;

	/**
	 * Store the first diffuse-sky irradiance estimate.
	 */
	estimatedDiffuseSkyIrradianceWm2: number;

	/**
	 * Store relative optical air mass, or null below the horizon.
	 */
	relativeAirMass: number | null;

	/**
	 * Store the cosine of the local solar zenith angle.
	 */
	sunUpCos: number;

	/**
	 * Store luminance-weighted direct-sun transmittance.
	 */
	visibleTransmittance: number;

	/**
	 * Store per-channel direct-sun transmittance.
	 */
	transmittance: FlatRgbColor;

	/**
	 * Store per-channel optical depth when available.
	 */
	opticalDepth: FlatRgbColor | null;

	/**
	 * Indicate whether the observer is shadowed from direct Sun.
	 */
	shadowed: boolean;

	/**
	 * Store the current renderer bridge derived from physical irradiance.
	 */
	renderer: {
		atmosphereSourceScale: number;
		irradianceReferenceWm2: number;
		bridge: GlobeSolarSource["rendererBridge"];
	};
}

/**
 * Describe the globe camera in kilometer scene coordinates.
 */
type GlobeCamera = {
	/**
	 * Store the camera position in kilometers.
	 */
	positionKm: FlatVector3;

	/**
	 * Store the camera target in kilometers.
	 */
	targetKm: FlatVector3;

	/**
	 * Store the camera up vector in kilometers scene coordinates.
	 */
	up: FlatVector3;

	/**
	 * Store the camera height above the rendered spherical ground in kilometers.
	 */
	heightAboveSurfaceKm: number;

	/**
	 * Store the near clipping plane in kilometers.
	 */
	nearKm: number;

	/**
	 * Store the far clipping plane in kilometers.
	 */
	farKm: number;

	/**
	 * Store the camera field of view in degrees.
	 */
	fov: number;
}

/**
 * Describe atmosphere uniform adapter output for the globe renderer.
 */
type GlobeSimulationAtmosphereUniformAdapter = {
	/**
	 * Indicate whether globe atmosphere composition is available.
	 */
	enabled: boolean;

	/**
	 * Store the shared atmosphere model.
	 */
	atmosphere: import("../../../shared/Atmosphere.js").default;

	/**
	 * Store the resolved globe Sun light used by atmosphere sampling.
	 */
	sun: FlatSunLightState;

	/**
	 * Store plain shader uniform values.
	 */
	values: Record<string, unknown>;

	/**
	 * Store Three/R3F-style mutable uniforms.
	 */
	uniforms: Record<string, { value: unknown }>;
}

/**
 * Describe globe atmosphere composition uniforms.
 */
type GlobeSimulationCompositionUniforms = {
	/**
	 * Store the solid-scene color texture.
	 */
	sceneColorTexture: { value: unknown };

	/**
	 * Store the solid-scene depth texture.
	 */
	sceneDepthTexture: { value: unknown };

	/**
	 * Store the active camera inverse projection matrix.
	 */
	cameraProjectionMatrixInverse: { value: unknown };

	/**
	 * Store the active camera world matrix.
	 */
	cameraViewMatrixInverse: { value: unknown };

	/**
	 * Store the active camera world position.
	 */
	cameraWorldPosition: { value: unknown };

	/**
	 * Store the active camera forward direction.
	 */
	cameraForward: { value: unknown };

	/**
	 * Store the active camera right direction.
	 */
	cameraRight: { value: unknown };

	/**
	 * Store the active camera up direction.
	 */
	cameraUp: { value: unknown };

	/**
	 * Store tangent of half the camera vertical field of view.
	 */
	cameraTanHalfFov: { value: unknown };

	/**
	 * Store the active camera aspect ratio.
	 */
	cameraAspect: { value: unknown };
}

/**
 * Describe a synthetic mountain marker projected onto the globe surface.
 */
type GlobeSimulationMountainBox = {
	/**
	 * Identify the renderable geometry kind.
	 */
	kind: "box";

	/**
	 * Identify the semantic role.
	 */
	role: "mountain-simulation";

	/**
	 * Identify the marker.
	 */
	id: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store the box center in globe scene kilometers.
	 */
	position: FlatVector3;

	/**
	 * Store render dimensions in kilometers.
	 */
	size: FlatVector3;

	/**
	 * Store local box axes in globe scene coordinates.
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
	 * Store the corresponding surface placement.
	 */
	surface: {
		/**
		 * Store the surface-center point beneath the marker.
		 */
		centerKm: FlatVector3;

		/**
		 * Store the outward surface normal.
		 */
		normal: FlatVector3;

		/**
		 * Store the tangent bearing direction at the marker.
		 */
		bearingDirection: FlatVector3;

		/**
		 * Store geodesic distance from the observer in kilometers.
		 */
		geodesicDistanceKm: number;

		/**
		 * Store the surface point centered on the marker's near edge.
		 */
		nearEdgeCenterKm: FlatVector3;

		/**
		 * Store geodesic distance from the observer to the marker's near edge.
		 */
		nearEdgeDistanceKm: number;
	};

	/**
	 * Indicate whether the object should render.
	 */
	visible: boolean;

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
	 * Store human-unit source values used to create this local terrain marker.
	 */
	source: FlatMountainSimulationRectangleSource["source"];
}

/**
 * Describe a star used to test daytime atmosphere visibility.
 */
type GlobeSimulationStar = {
	/**
	 * Identify the renderable kind.
	 */
	kind: "star";

	/**
	 * Identify the semantic role.
	 */
	role: "daytime-sky-visibility-calibration";

	/**
	 * Identify the source star.
	 */
	id: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store the normalized inertial scene direction.
	 */
	direction: FlatVector3;

	/**
	 * Store the render position in globe scene kilometers.
	 */
	position: FlatVector3;

	/**
	 * Store right ascension in degrees.
	 */
	raDeg: number;

	/**
	 * Store declination in degrees.
	 */
	decDeg: number;

	/**
	 * Store visual magnitude.
	 */
	magnitude: number;

	/**
	 * Store flux relative to a magnitude-zero star.
	 */
	relativeFlux: number;

	/**
	 * Store local apparent altitude in degrees for diagnostics.
	 */
	altitudeDeg: number;

	/**
	 * Store local apparent azimuth in degrees for diagnostics.
	 */
	azimuthDeg: number;

	/**
	 * Indicate whether the star should render.
	 */
	visible: boolean;

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
	 * Store source catalog tag.
	 */
	source: string;
}

/**
 * Describe the configurable globe scene model input.
 */
type GlobeSceneConfig = {
	/**
	 * Store the root observer.
	 */
	root: GlobeLocation;

	/**
	 * Store the scene timestamp. Omit to use the current system time.
	 */
	time?: string;

	/**
	 * Store the spherical Earth radius in kilometers.
	 */
	earthRadiusKm: number;

	/**
	 * Store the camera height above the rendered spherical ground in meters.
	 */
	cameraHeightMeters: number;

	/**
	 * Override the source star records used for daytime visibility tests.
	 */
	stars?: Array<{
		id: string;
		name: string;
		raDeg: number;
		decDeg: number;
		magnitude: number;
		source: string;
	}>;

	/**
	 * Override the radiometric-to-display mapping used by the scene.
	 */
	display?: Partial<FlatRadiometricDisplayConfig>;
}
