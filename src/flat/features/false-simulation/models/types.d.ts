/**
 * Describe a selected observer or root location for the false simulation.
 */
type FalseSimulationLocation = {
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
 * Describe false-simulation projection and sizing options.
 */
type FalseSimulationProjectionOptions = {
	/**
	 * Store the mean Earth radius in kilometers.
	 */
	meanEarthRadiusKm: number;

	/**
	 * Store the projected Earth floor radius in kilometers.
	 */
	earthProjectionRadiusKm: number;

	/**
	 * Store the sky dome radius in kilometers.
	 */
	domeRadiusKm: number;

	/**
	 * Store the right ascension used as the projection reference.
	 */
	referenceRightAscensionDeg: number;
}

/**
 * Describe the default elevated view used to inspect the flat floor context.
 */
type FalseSimulationObserverView = {
	/**
	 * Store camera altitude above the projected observer in kilometers.
	 */
	altitudeKm: number;

	/**
	 * Explain why the view override exists.
	 */
	purpose: string;
}

/**
 * Describe the Earth floor texture source and projection contract.
 */
type FalseSimulationFloorTexture = {
	/**
	 * Store the runtime asset URL.
	 */
	url: string;

	/**
	 * Name the source dataset.
	 */
	source: string;

	/**
	 * Store the source dataset URL.
	 */
	sourceUrl: string;

	/**
	 * Identify the raster projection used by the source image.
	 */
	sourceProjection: string;

	/**
	 * Identify the projection used by the rendered floor.
	 */
	floorProjection: string;

	/**
	 * Store a texture rotation offset in radians.
	 */
	textureRotationRad: number;

	/**
	 * Describe the runtime orientation convention.
	 */
	orientation: string;
}

/**
 * Describe the shared-atmosphere settings attached to the false-simulation
 * scene before the light-aware renderer is wired in.
 */
type FalseSimulationAtmosphereSettings = {
	/**
	 * Indicate whether the future atmosphere renderer should run.
	 */
	enabled: boolean;

	/**
	 * Identify the atmosphere implementation family.
	 */
	model: string;

	/**
	 * Store the atmosphere frame used by shared atmosphere calculations.
	 */
	frame: FlatAtmosphereFrame;

	/**
	 * Store the atmosphere profile used by shared atmosphere calculations.
	 */
	profile: FlatAtmosphereProfile;

	/**
	 * Store renderer integration status for the shared atmosphere model.
	 */
	rendering: {
		/**
		 * Describe whether the light-aware shader has been wired yet.
		 */
		status: string;

		/**
		 * Identify the intended atmosphere render target.
		 */
		target: string;

		/**
		 * Select a temporary background-pixel debug visualization.
		 *
		 * `scattering` shows amplified in-scattered light. `diagnostics` shows
		 * unshadowed sample ratio in red, average light transmittance in green,
		 * and scattering strength in blue. `unattenuated-scattering` shows
		 * scattering with sample-to-light transmittance bypassed.
		 * `scattering-inputs` shows atmosphere sample ratio in red, average
		 * density in green, and average phase strength in blue. `view-path`
		 * shows normalized ray distance in red, average view transmittance in
		 * green, and average optical depth in blue. `scattering-source` shows
		 * the averaged raw Rayleigh and Mie sunlight-to-air source term before
		 * view accumulation, light attenuation, or exposure.
		 * `scattering-factors` shows normalized sun intensity in red, sun
		 * color length in green, and scattering coefficient strength in blue.
		 * `scattering-angles` shows valid angle sample ratio in red, average
		 * Rayleigh phase in green, and average Mie phase in blue.
		 * `scattering-components` shows source density in red, source phase in
		 * green, and coefficient-times-light strength in blue.
		 * `scattering-sanity` shows final valid scattering sample ratio in
		 * red, reconstructed scalar source in green, and accumulated source
		 * vector strength in blue.
		 */
		backgroundDebugMode?: "none" | "scattering" | "diagnostics" | "unattenuated-scattering" | "scattering-inputs" | "view-path" | "scattering-source" | "scattering-factors" | "scattering-angles" | "scattering-components" | "scattering-sanity";

		/**
		 * Scale temporary background debug scattering output for inspection.
		 */
		backgroundDebugScale?: number;

		/**
		 * Scale the physically shaped single-scattering source term for solid
		 * surface/object pixels.
		 */
		solidScatteringSourceGain?: number;

		/**
		 * Scale the physically shaped single-scattering source term for
		 * no-depth background sky pixels.
		 */
		skyScatteringSourceGain?: number;

		/**
		 * Keep a minimum sample-to-light transmittance for no-depth sky pixels.
		 *
		 * This diagnoses whether the false point-sun light path is over-
		 * attenuating the computed sky contribution.
		 */
		skyLightTransmittanceFloor?: number;

		/**
		 * Scale the first shell-pass in-scattered light for visual inspection.
		 */
		shellExposure?: number;

		/**
		 * Scale the first shell-pass alpha for visual inspection.
		 */
		shellOpacity?: number;
	};
}

/**
 * Describe the renderer-owned uniform adapter for shared atmosphere data.
 */
type FalseSimulationAtmosphereUniformAdapter = {
	/**
	 * Indicate whether the atmosphere pass should render.
	 */
	enabled: boolean;

	/**
	 * Store the shared atmosphere model used to create the uniforms.
	 */
	atmosphere: object;

	/**
	 * Store the plain shader values before wrapping them as uniforms.
	 */
	values: Record<string, unknown>;

	/**
	 * Store Three/R3F-style uniform objects.
	 */
	uniforms: Record<string, { value: unknown }>;

	/**
	 * Update sun uniforms in place from the latest resolved sun state.
	 */
	updateSunUniforms: (nextSunLight: FlatSunLightState | FlatSunState | null | undefined) => Record<string, { value: unknown }>;
}

/**
 * Describe the visible false-simulation sun rendering contract.
 */
type FalseSimulationSunRendering = {
	/**
	 * Indicate that the sun body should be rendered as simulation evidence.
	 */
	renderBody: boolean;

	/**
	 * Identify how renderer size should be derived.
	 */
	sizeModel: string;

	/**
	 * Identify the source for apparent-size calculations.
	 */
	apparentSizeSource: string;
}

/**
 * Describe the false-simulation sun animation contract.
 */
type FalseSimulationSunAnimation = {
	/**
	 * Identify the animation model.
	 */
	type: string;

	/**
	 * Store the simulated period in hours.
	 */
	simulatedDurationHours: number;

	/**
	 * Store the displayed loop duration in seconds.
	 */
	displayDurationSeconds: number;
}

/**
 * Describe optional inputs for resolving the animated false-simulation sun.
 */
type FalseSimulationSunAnimationOptions = {
	/**
	 * Provide the observer position when it should not be inferred from the
	 * initial light state.
	 */
	observerPosition?: FlatVector3;
}

/**
 * Describe configurable false-sun assumptions before projection.
 */
type FalseSimulationSunConfig = {
	/**
	 * Identify the false-sun body.
	 */
	id: string;

	/**
	 * Identify the pre-projection sun source kind.
	 */
	kind: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store projected-model latitude in decimal degrees.
	 */
	lat: number;

	/**
	 * Store projected-model longitude in decimal degrees.
	 */
	lon: number;

	/**
	 * Store elevation above the projected floor in kilometers.
	 */
	altitudeKm: number;

	/**
	 * Store physical radius in kilometers.
	 */
	radiusKm: number;

	/**
	 * Store render styling for the visible body.
	 */
	style: {
		/**
		 * Store the visible body color as a CSS color string.
		 */
		color: string;
	};

	/**
	 * Store render-body and apparent-size behavior.
	 */
	rendering: FalseSimulationSunRendering;

	/**
	 * Store the light-source defaults derived from the visible body.
	 */
	light: FlatSunConfig;

	/**
	 * Store solar-day animation behavior.
	 */
	animation: FalseSimulationSunAnimation;
}

/**
 * Describe a geodetic source object that can be projected into the false scene.
 */
type FalseSimulationGeodeticSourceObject = {
	/**
	 * Identify the source object kind.
	 */
	kind: string;

	/**
	 * Identify the object.
	 */
	id: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store source latitude in decimal degrees.
	 */
	lat: number;

	/**
	 * Store source longitude in decimal degrees.
	 */
	lon: number;

	/**
	 * Store elevation above the projected floor in kilometers.
	 */
	altitudeKm: number;

	/**
	 * Store physical radius in kilometers.
	 */
	radiusKm: number;

	/**
	 * Store render styling.
	 */
	style?: {
		/**
		 * Store the visible color as a CSS color string.
		 */
		color: string;
	};

	/**
	 * Store optional animation behavior.
	 */
	animation?: FalseSimulationSunAnimation;
}

/**
 * Describe a fake observer-relative terrain rectangle before projection.
 */
type FalseSimulationMountainRectangleSource = {
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
	};
}

/**
 * Describe a source object that can be projected into the false scene.
 */
type FalseSimulationSourceObject = FalseSimulationGeodeticSourceObject | FalseSimulationMountainRectangleSource;

/**
 * Describe observer-relative apparent size for the false-model sun.
 */
type FalseSimulationSunApparent = {
	/**
	 * Store distance from observer to sun body in kilometers.
	 */
	distanceKm: number;

	/**
	 * Store apparent angular radius in radians.
	 */
	angularRadiusRad: number;

	/**
	 * Store apparent angular diameter in radians.
	 */
	angularDiameterRad: number;

	/**
	 * Identify which assumptions produced the apparent size.
	 */
	source: string;
}

/**
 * Describe the projected source fields for a rendered false-simulation body.
 */
type FalseSimulationBodySource = {
	/**
	 * Store source latitude in decimal degrees.
	 */
	lat: number;

	/**
	 * Store source longitude in decimal degrees.
	 */
	lon: number;

	/**
	 * Store source altitude in kilometers.
	 */
	altitudeKm: number;

	/**
	 * Store physical diameter in kilometers.
	 */
	diameterKm: number;
}

/**
 * Describe a renderable sphere in the false-simulation scene.
 */
type FalseSimulationRenderableSphere = {
	/**
	 * Identify the renderable geometry kind.
	 */
	kind: "sphere";

	/**
	 * Identify the semantic role when one exists.
	 */
	role?: string;

	/**
	 * Identify the rendered object.
	 */
	id: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store projected scene position in kilometers.
	 */
	position: FlatVector3;

	/**
	 * Store physical render radius in kilometers.
	 */
	radiusKm: number;

	/**
	 * Indicate whether the object should render.
	 */
	visible: boolean;

	/**
	 * Store render styling.
	 */
	style?: {
		/**
		 * Store the visible color as a CSS color string.
		 */
		color: string;
	};

	/**
	 * Store sun-specific rendering behavior when this sphere is the sun body.
	 */
	rendering?: FalseSimulationSunRendering;

	/**
	 * Store apparent size when this sphere is the sun body.
	 */
	apparent?: FalseSimulationSunApparent;

	/**
	 * Store animation behavior.
	 */
	animation?: FalseSimulationSunAnimation;

	/**
	 * Store source assumptions used to project this body.
	 */
	source: FalseSimulationBodySource;
}

/**
 * Describe a renderable rectangular prism in the false-simulation scene.
 */
type FalseSimulationRenderableBox = {
	/**
	 * Identify the renderable geometry kind.
	 */
	kind: "box";

	/**
	 * Identify the semantic role when one exists.
	 */
	role?: string;

	/**
	 * Identify the rendered object.
	 */
	id: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store projected scene position in kilometers.
	 */
	position: FlatVector3;

	/**
	 * Store render dimensions in kilometers.
	 */
	size: FlatVector3;

	/**
	 * Store render rotation around the vertical axis in radians.
	 */
	rotationYRad: number;

	/**
	 * Indicate whether the object should render.
	 */
	visible: boolean;

	/**
	 * Store render styling.
	 */
	style?: {
		/**
		 * Store the visible color as a CSS color string.
		 */
		color: string;
	};

	/**
	 * Store human-unit source values used to create this local terrain marker.
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
	};
}

/**
 * Describe a generic source object after projection.
 */
type FalseSimulationProjectedObject = FalseSimulationRenderableSphere | FalseSimulationRenderableBox | (FalseSimulationSourceObject & {
	/**
	 * Store `null` when the source object is not projected into renderable scene geometry.
	 */
	position: null;

	/**
	 * Indicate that unsupported source objects are not visible.
	 */
	visible: false;
});

/**
 * Describe a projected star record used by the false-simulation scene model.
 */
type FalseSimulationProjectedStar = {
	/**
	 * Identify the projected object as a star.
	 */
	kind: "star";

	/**
	 * Identify the source star.
	 */
	id: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store projected scene position in kilometers.
	 */
	position: FlatVector3;

	/**
	 * Indicate whether the star is in the visible projection domain.
	 */
	visible: boolean;

	/**
	 * Store projected-coordinate details.
	 */
	projected?: object;

	/**
	 * Store source catalog fields.
	 */
	source?: object;

	/**
	 * Store render style fields.
	 */
	style?: object;
}

/**
 * Describe a projected false-simulation sun body and its matching light state.
 */
type FalseSimulationSunScene = {
	/**
	 * Identify this as the scene sun.
	 */
	kind: "sun";

	/**
	 * Identify the sun body.
	 */
	id: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store projected scene position in kilometers.
	 */
	position: FlatVector3;

	/**
	 * Store physical radius in kilometers.
	 */
	radiusKm: number;

	/**
	 * Indicate whether the sun is visible in the scene.
	 */
	visible: boolean;

	/**
	 * Store render-body and apparent-size behavior.
	 */
	rendering: FalseSimulationSunRendering;

	/**
	 * Store observer-relative apparent size.
	 */
	apparent: FalseSimulationSunApparent;

	/**
	 * Store the renderable sun sphere.
	 */
	object: FalseSimulationRenderableSphere;

	/**
	 * Store the point-light state derived from the rendered body.
	 */
	light: FlatSunLightState;

	/**
	 * Store solar-day animation behavior.
	 */
	animation: FalseSimulationSunAnimation;

	/**
	 * Store source assumptions used to project the sun.
	 */
	source: FalseSimulationBodySource;
}

/**
 * Describe a projected constellation overlay.
 */
type FalseSimulationProjectedConstellation = {
	/**
	 * Identify the constellation or asterism.
	 */
	id: string;

	/**
	 * Store the display name.
	 */
	name: string;

	/**
	 * Store the rendered line color as a CSS color string.
	 */
	color: string;

	/**
	 * Store projected line segments between named stars.
	 */
	segments: Array<{
		/**
		 * Store the source star name for the segment start.
		 */
		from: string;

		/**
		 * Store the source star name for the segment end.
		 */
		to: string;

		/**
		 * Store the projected segment endpoints.
		 */
		points: [FlatVector3, FlatVector3];

		/**
		 * Indicate whether both segment endpoints are visible.
		 */
		visible: boolean;
	}>;
}

/**
 * Describe false-simulation animation periods.
 */
type FalseSimulationAnimationPeriods = {
	/**
	 * Store the solar-day loop.
	 */
	solarDay: {
		/**
		 * Store simulated duration in hours.
		 */
		simulatedDurationHours: number;

		/**
		 * Store displayed duration in seconds.
		 */
		displayDurationSeconds: number;
	};

	/**
	 * Store the sidereal-day loop.
	 */
	siderealDay: {
		/**
		 * Store simulated duration in hours.
		 */
		simulatedDurationHours: number;

		/**
		 * Store displayed duration in seconds.
		 */
		displayDurationSeconds: number;
	};
}

/**
 * Describe the false-simulation scene-model configuration.
 */
type FalseSimulationConfig = {
	/**
	 * Store the selected observer/root location.
	 */
	root: FalseSimulationLocation;

	/**
	 * Store the selected simulation time.
	 */
	time: string;

	/**
	 * Identify the Earth projection implementation.
	 */
	earthProjection: string;

	/**
	 * Identify the celestial projection implementation.
	 */
	celestialProjection: string;

	/**
	 * Identify the sky-surface projection implementation.
	 */
	skySurfaceProjection: string;

	/**
	 * Store projection sizing and reference options.
	 */
	options: FalseSimulationProjectionOptions;

	/**
	 * Override the observer camera view.
	 */
	observerView?: Partial<FalseSimulationObserverView>;

	/**
	 * Override Earth presentation settings.
	 */
	earth?: {
		/**
		 * Override floor texture settings.
		 */
		floorTexture?: Partial<FalseSimulationFloorTexture>;
	};

	/**
	 * Override atmosphere presentation settings.
	 */
	atmosphere?: Partial<FalseSimulationAtmosphereSettings>;

	/**
	 * Override or disable the false-simulation sun.
	 */
	sun?: Partial<FalseSimulationSunConfig> | null;

	/**
	 * Override debug camera settings.
	 */
	camera?: object | null;

	/**
	 * Override generic source objects projected into the scene.
	 */
	objects?: FalseSimulationSourceObject[];

	/**
	 * Override source star records.
	 */
	stars?: object[];

	/**
	 * Override source constellation records.
	 */
	constellations?: object[];
}

/**
 * Describe the plain scene view model consumed by the false-simulation
 * renderer.
 */
type FalseSimulationScene = {
	/**
	 * Store the active observer/root location.
	 */
	root: FalseSimulationLocation;

	/**
	 * Store the active simulation time.
	 */
	time: string;

	/**
	 * Store the configured projection model description.
	 */
	model: object;

	/**
	 * Store the projected observer.
	 */
	observer: object;

	/**
	 * Store Earth floor presentation state.
	 */
	earth: {
		/**
		 * Store projected Earth radius in kilometers.
		 */
		radiusKm: number;

		/**
		 * Store floor texture configuration.
		 */
		floorTexture: FalseSimulationFloorTexture;
	};

	/**
	 * Store sky dome presentation state.
	 */
	dome: {
		/**
		 * Store dome radius in kilometers.
		 */
		radiusKm: number;
	};

	/**
	 * Store shared atmosphere settings.
	 */
	atmosphere: FalseSimulationAtmosphereSettings;

	/**
	 * Store the first-class rendered false-simulation sun.
	 */
	sun: FalseSimulationSunScene | null;

	/**
	 * Store scene lighting derived from rendered bodies.
	 */
	lighting: {
		/**
		 * Store the light state derived from `scene.sun`.
		 */
		sun: FlatSunLightState | null;
	};

	/**
	 * Store optional debug camera settings.
	 */
	camera: object | null;

	/**
	 * Store projected star records.
	 */
	stars: FalseSimulationProjectedStar[];

	/**
	 * Store projected constellation overlays.
	 */
	constellations: FalseSimulationProjectedConstellation[];

	/**
	 * Store generic renderable objects derived from canonical scene state.
	 */
	objects: FalseSimulationProjectedObject[];

	/**
	 * Store animation periods used by scene renderers.
	 */
	animation: FalseSimulationAnimationPeriods;
}
