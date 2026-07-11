/**
 * Describe a selected observer or root location for the flat simulation.
 */
type FlatSimulationLocation = {
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
 * Describe flat-simulation projection and sizing options.
 */
type FlatSimulationProjectionOptions = {
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
type FlatSimulationObserverView = {
	/**
	 * Store camera altitude above the projected observer in kilometers.
	 */
	altitudeKm: number;

	/**
	 * Store absolute camera height above the rendered ground in kilometers.
	 */
	cameraHeightKm?: number;

	/**
	 * Explain why the view override exists.
	 */
	purpose: string;
}

/**
 * Describe the Earth floor texture source and projection contract.
 */
type FlatSimulationFloorTexture = {
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
 * Describe the shared-atmosphere settings attached to the flat-simulation
 * scene before the light-aware renderer is wired in.
 */
type FlatSimulationAtmosphereSettings = {
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
		 * Select a minimal compositor debug visualization.
		 *
		 * `none` shows the sun-scattered atmosphere composition. `ray-length`
		 * shows normalized camera ray length in red, solid-depth mask in green,
		 * and background/no-depth mask in blue. `optical-depth` shows average
		 * optical depth in red, average transmittance in green, and solid-depth
		 * mask in blue. `scattering` shows accumulated in-scattered light before
		 * scene-color composition. `phase-angle` shows light/view phase inputs:
		 * cosine in red, Rayleigh phase in green, and Mie phase in blue.
		 */
		debugMode?: "none" | "ray-length" | "optical-depth" | "scattering" | "phase-angle";

		/**
		 * Configure the false-model point-sun radiance bridge when solid-scene
		 * lighting uses the visible false sun.
		 */
		falseSunRadiance?: {
			/**
			 * Select the false-sun radiance bridge model.
			 */
			model: "point-inverse-square-reference";

			/**
			 * Store the distance where false-sun intensity is interpreted as the
			 * configured radiance baseline.
			 */
			referenceDistanceKm: number;

			/**
			 * Indicate whether point sun radiance falls off with sample-to-sun
			 * distance.
			 */
			distanceFalloff: boolean;
		};

		/**
		 * Convert false-sun radiance units into Three.js scene-light units for
		 * solid-object lighting.
		 */
		threeLightUnitScale?: number;

		/**
		 * Approximate broad diffuse skylight received by lit solid materials.
		 */
		skyDiffuseIrradianceScale?: number;

		/**
		 * Select the simplified model used to estimate atmospheric
		 * transmittance from each camera-ray sample toward the sun.
		 */
		sampleToSunTransmittanceModel?: "none" | "light-march" | "air-mass";

		/**
		 * Select how many shader steps estimate atmospheric transmittance from
		 * each camera-ray sample toward the sun when using `light-march`.
		 */
		sampleToSunTransmittanceSteps?: number;

		/**
		 * Limit no-depth background sky integration distance so empty sky does
		 * not become an artificial long horizontal flat-slab atmosphere path.
		 */
		backgroundAtmosphereViewDistanceKm?: number;

		/**
		 * Scale the background sky integration distance for near-horizontal
		 * no-depth rays so flat-slab empty sky does not form a fake horizon band.
		 */
		flatSlabHorizonViewDistanceFactor?: number;

		/**
		 * Scale star material radiance before atmosphere composition.
		 */
		starExposure?: number;

		/**
		 * Scale constellation guide overlay opacity before atmosphere composition.
		 */
		constellationOverlayExposure?: number;
	};
}

/**
 * Describe the renderer-owned uniform adapter for shared atmosphere data.
 */
type FlatSimulationAtmosphereUniformAdapter = {
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
 * Describe the visible flat-simulation sun rendering contract.
 */
type FlatSimulationSunRendering = {
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
 * Describe the flat-simulation sun animation contract.
 */
type FlatSimulationSunAnimation = {
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
 * Describe how the false-model Sun latitude is selected before projection.
 */
type FlatSimulationSunLatitudeModel = {
	/**
	 * Select fixed latitude or annual migration between tropic limits.
	 */
	type: "annual-tropic-migration" | "fixed-latitude";

	/**
	 * Store the northern latitude limit in decimal degrees.
	 */
	northLimitDeg?: number;

	/**
	 * Store the southern latitude limit in decimal degrees.
	 */
	southLimitDeg?: number;

	/**
	 * Store the day-of-year where the northern limit is reached.
	 */
	northernSolsticeDayOfYear?: number;

	/**
	 * Store the annual cycle length.
	 */
	periodDays?: number;

	/**
	 * Store the latitude for fixed-latitude diagnostic overrides.
	 */
	latitudeDeg?: number;
}

/**
 * Describe optional inputs for resolving the animated flat-simulation sun.
 */
type FlatSimulationSunAnimationOptions = {
	/**
	 * Provide the observer position when it should not be inferred from the
	 * initial light state.
	 */
	observerPosition?: FlatVector3;
}

/**
 * Describe configurable false-sun assumptions before projection.
 */
type FlatSimulationSunConfig = {
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
	 * Store the projected-model latitude rule.
	 */
	latitude: FlatSimulationSunLatitudeModel;

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
	rendering: FlatSimulationSunRendering;

	/**
	 * Store the light-source defaults derived from the visible body.
	 */
	light: FlatSunConfig;

	/**
	 * Store atmosphere-scattering radiance defaults for this same sun body.
	 */
	atmosphere: FlatSunConfig;

	/**
	 * Store solar-day animation behavior.
	 */
	animation: FlatSimulationSunAnimation;
}

/**
 * Describe a geodetic source object that can be projected into the false scene.
 */
type FlatSimulationGeodeticSourceObject = {
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
	animation?: FlatSimulationSunAnimation;
}

type FlatSimulationMountainRectangleSource = FlatMountainSimulationRectangleSource;

/**
 * Describe a source object that can be projected into the false scene.
 */
type FlatSimulationSourceObject = FlatSimulationGeodeticSourceObject | FlatSimulationMountainRectangleSource;

/**
 * Describe observer-relative apparent size for the false-model sun.
 */
type FlatSimulationSunApparent = {
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
 * Describe the projected source fields for a rendered flat-simulation body.
 */
type FlatSimulationBodySource = {
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

	/**
	 * Store the latitude rule that produced `lat` when available.
	 */
	latitude?: FlatSimulationSunLatitudeModel;

	/**
	 * Store the scene time used to resolve annual latitude when available.
	 */
	latitudeResolvedAt?: string;
}

/**
 * Describe a renderable sphere in the flat-simulation scene.
 */
type FlatSimulationRenderableSphere = {
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
	rendering?: FlatSimulationSunRendering;

	/**
	 * Store apparent size when this sphere is the sun body.
	 */
	apparent?: FlatSimulationSunApparent;

	/**
	 * Store animation behavior.
	 */
	animation?: FlatSimulationSunAnimation;

	/**
	 * Store source assumptions used to project this body.
	 */
	source: FlatSimulationBodySource;
}

/**
 * Describe a renderable rectangular prism in the flat-simulation scene.
 */
type FlatSimulationRenderableBox = {
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
type FlatSimulationProjectedObject = FlatSimulationRenderableSphere | FlatSimulationRenderableBox | (FlatSimulationSourceObject & {
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
 * Describe a projected star record used by the flat-simulation scene model.
 */
type FlatSimulationProjectedStar = {
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
 * Describe a projected flat-simulation sun body and its matching light state.
 */
type FlatSimulationSunScene = {
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
	rendering: FlatSimulationSunRendering;

	/**
	 * Store observer-relative apparent size.
	 */
	apparent: FlatSimulationSunApparent;

	/**
	 * Store the renderable sun sphere.
	 */
	object: FlatSimulationRenderableSphere;

	/**
	 * Store the point-light state derived from the rendered body.
	 */
	light: FlatSunLightState;

	/**
	 * Store atmosphere-scattering radiance settings for this same sun body.
	 */
	atmosphere: FlatSunConfig;

	/**
	 * Store solar-day animation behavior.
	 */
	animation: FlatSimulationSunAnimation;

	/**
	 * Store source assumptions used to project the sun.
	 */
	source: FlatSimulationBodySource;
}

/**
 * Describe a projected constellation overlay.
 */
type FlatSimulationProjectedConstellation = {
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
 * Describe animation playback behavior for renderer calibration.
 */
type FlatSimulationAnimationPlayback = {
	/**
	 * Select live interval-driven playback or a fixed simulation pose.
	 */
	mode: "live" | "fixed";

	/**
	 * Store the fixed simulated elapsed time in seconds.
	 */
	fixedSimulatedElapsedSeconds?: number;

	/**
	 * Store the fixed solar-day rotation angle in radians.
	 */
	fixedSolarRotationAngleRad?: number;

	/**
	 * Explain why a fixed playback pose was selected.
	 */
	reason?: string;
}

/**
 * Describe flat-simulation animation periods.
 */
type FlatSimulationAnimationPeriods = {
	/**
	 * Store animation playback behavior for renderer calibration.
	 */
	playback: FlatSimulationAnimationPlayback;

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
 * Describe the flat-simulation scene-model configuration.
 */
type FlatSimulationConfig = {
	/**
	 * Store the selected observer/root location.
	 */
	root: FlatSimulationLocation;

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
	options: FlatSimulationProjectionOptions;

	/**
	 * Override the observer camera view.
	 */
	observerView?: Partial<FlatSimulationObserverView>;

	/**
	 * Override Earth presentation settings.
	 */
	earth?: {
		/**
		 * Override floor texture settings.
		 */
		floorTexture?: Partial<FlatSimulationFloorTexture>;
	};

	/**
	 * Override atmosphere presentation settings.
	 */
	atmosphere?: Partial<FlatSimulationAtmosphereSettings>;

	/**
	 * Override or disable the flat-simulation sun.
	 */
	sun?: Partial<FlatSimulationSunConfig> | null;

	/**
	 * Override debug camera settings.
	 */
	camera?: object | null;

	/**
	 * Override generic source objects projected into the scene.
	 */
	objects?: FlatSimulationSourceObject[];

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
 * Describe the plain scene view model consumed by the flat-simulation
 * renderer.
 */
type FlatSimulationScene = {
	/**
	 * Store the active observer/root location.
	 */
	root: FlatSimulationLocation;

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
		floorTexture: FlatSimulationFloorTexture;
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
	atmosphere: FlatSimulationAtmosphereSettings;

	/**
	 * Store the first-class rendered flat-simulation sun.
	 */
	sun: FlatSimulationSunScene | null;

	/**
	 * Store scene lighting derived from rendered bodies.
	 */
	lighting: {
		/**
		 * Store the light state derived from `scene.sun`.
		 */
		sun: FlatSunLightState | null;

		/**
		 * Store the atmosphere scattering source derived from `scene.sun`.
		 */
		atmosphereSun: FlatSunLightState | null;
	};

	/**
	 * Store optional debug camera settings.
	 */
	camera: object | null;

	/**
	 * Store projected star records.
	 */
	stars: FlatSimulationProjectedStar[];

	/**
	 * Store projected constellation overlays.
	 */
	constellations: FlatSimulationProjectedConstellation[];

	/**
	 * Store generic renderable objects derived from canonical scene state.
	 */
	objects: FlatSimulationProjectedObject[];

	/**
	 * Store animation periods used by scene renderers.
	 */
	animation: FlatSimulationAnimationPeriods;
}
