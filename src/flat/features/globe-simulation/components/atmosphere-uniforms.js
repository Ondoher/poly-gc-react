import Atmosphere from '../../../shared/Atmosphere.js';
import Sun from '../../../shared/Sun.js';

const FRAME_KIND_IDS = Object.freeze({
	'flat-slab': 0,
	'spherical-shell': 1,
});

const DISPLAY_TONE_MAPPING_IDS = Object.freeze({
	'linear-clamp': 0,
	reinhard: 1,
});

/**
 * Convert a vector object into a fixed three-number array.
 *
 * @param {Partial<FlatVector3> | null | undefined} vector - Provide the source vector.
 * @param {[number, number, number] | null} fallback - Provide an optional fallback vector.
 * @returns {[number, number, number] | null}
 */
function vectorArray(vector, fallback = null) {
	if (!vector) {
		return fallback ? [...fallback] : null;
	}

	return [
		Number(vector.x) || 0,
		Number(vector.y) || 0,
		Number(vector.z) || 0,
	];
}

/**
 * Convert a plain RGB object into a fixed three-number array.
 *
 * @param {Partial<FlatRgbColor> | null | undefined} color - Provide the source color.
 * @returns {[number, number, number]}
 */
function colorArray(color) {
	return [
		Number(color?.r) || 0,
		Number(color?.g) || 0,
		Number(color?.b) || 0,
	];
}

/**
 * Convert a CSS hex color string into a fixed normalized RGB array.
 *
 * @param {string | null | undefined} color - Provide the CSS color string.
 * @returns {[number, number, number]}
 */
function cssHexColorArray(color) {
	const hex = typeof color === 'string' ? color.trim().replace(/^#/, '') : '';
	const normalizedHex = hex.length === 3
		? hex.split('').map((character) => character + character).join('')
		: hex;

	if (!/^[0-9a-fA-F]{6}$/.test(normalizedHex)) {
		return [1, 1, 1];
	}

	return [
		parseInt(normalizedHex.slice(0, 2), 16) / 255,
		parseInt(normalizedHex.slice(2, 4), 16) / 255,
		parseInt(normalizedHex.slice(4, 6), 16) / 255,
	];
}

/**
 * Create a Three/R3F-style uniform map from plain shader values.
 *
 * @param {Record<string, unknown>} values - Provide plain uniform values.
 * @returns {Record<string, { value: unknown }>}
 */
function createUniformMap(values) {
	return Object.fromEntries(
		Object.entries(values).map(([key, value]) => [key, { value }]),
	);
}

/**
 * Flatten spherical atmosphere frame details into shader-friendly uniforms.
 *
 * @param {FlatAtmosphereFrame} frame - Provide the normalized atmosphere frame.
 * @returns {Record<string, unknown>}
 */
function frameUniformValues(frame) {
	if (frame.kind !== 'spherical-shell') {
		throw new Error(`Globe atmosphere requires a spherical-shell frame, received "${frame.kind}".`);
	}

	return {
		atmosphereFrameKindId: FRAME_KIND_IDS[frame.kind],
		atmosphereFrameOrigin: [0, 0, 0],
		atmosphereFrameUp: [0, 1, 0],
		atmospherePlanetCenter: vectorArray(frame.planetCenter),
		atmospherePlanetRadiusKm: frame.planetRadiusKm,
	};
}

/**
 * Convert a resolved light state into shader-friendly sun uniforms.
 *
 * @param {FlatSunLightState | FlatSunState | null | undefined} sun - Provide the resolved sun/light state.
 * @returns {Record<string, unknown>}
 */
function sunUniformValues(sun) {
	return {
		sunKind: sun?.kind || 'point',
		sunKindId: sun?.kind === 'directional' ? 0 : 1,
		sunDirection: vectorArray(sun?.direction, [0, 1, 0]),
		sunPosition: vectorArray(sun?.position, [0, 0, 0]),
		sunColor: colorArray(sun?.color || { r: 1, g: 1, b: 1 }),
		sunIntensity: Number(sun?.intensity) || 0,
		sunSolarIrradianceScale: Number(sun?.solarIrradianceScale) || 0,
		sunAngularRadiusRad: sun?.kind === 'point'
			? Number(sun?.apparentAngularRadiusRad) || 0
			: Number(sun?.angularRadiusRad) || 0,
		sunRadiusKm: Number(sun?.radiusKm) || 0,
		sunDistanceKm: Number(sun?.distanceKm) || 0,
		sunAnchor: { ...(sun?.anchor || {}) },
	};
}

/**
 * Convert scene physical solar probes into shader-friendly uniforms.
 *
 * @param {object | null | undefined} scene - Provide the globe scene view model.
 * @returns {Record<string, unknown>}
 */
function solarIrradianceUniformValues(scene) {
	return {
		sunTopOfAtmosphereIrradianceWm2:
			Number(scene?.sun?.irradiance?.topOfAtmosphereIrradianceWm2) || 0,
	};
}

/**
 * Convert scene display settings into shader-friendly uniforms.
 *
 * @param {Partial<FlatRadiometricDisplayConfig> | null | undefined} display - Provide scene display settings.
 * @returns {Record<string, unknown>}
 */
function displayUniformValues(display) {
	const toneMapping = display?.toneMapping || 'linear-clamp';

	if (!Object.hasOwn(DISPLAY_TONE_MAPPING_IDS, toneMapping)) {
		throw new Error(`Unknown globe display tone mapping "${toneMapping}".`);
	}

	return {
		displayModel: display?.model || 'radiometric-display-v1',
		displayRadiometricToSceneRgbScale:
			Number(display?.radiometricToSceneRgbScale) || 0,
		displayExposure: Number(display?.exposure) || 0,
		displayToneMapping: toneMapping,
		displayToneMappingId: DISPLAY_TONE_MAPPING_IDS[toneMapping],
	};
}

/**
 * Resolve the globe scene Sun into point-light state for atmosphere sampling.
 *
 * @param {object} scene - Provide the globe scene view model.
 * @returns {FlatSunLightState}
 */
export function resolveGlobeAtmosphereSun(scene) {
	const observerPosition = scene?.camera?.positionKm || scene?.observer?.positionKm || { x: 0, y: 0, z: 0 };
	const sun = new Sun({
		kind: scene?.sun?.kind || 'point',
		position: scene?.sun?.position,
		direction: scene?.sun?.direction,
		color: scene?.sun?.color,
		intensity: scene?.sun?.intensity,
		solarIrradianceScale: scene?.sun?.solarIrradianceScale,
		angularRadiusRad: scene?.sun?.angularRadiusRad,
		radiusKm: scene?.sun?.radiusKm,
		anchor: scene?.sun?.anchor || {
			kind: 'globe-simulation-date-derived-sun-atmosphere',
			status: 'open',
		},
	});

	return sun.lightFrom(observerPosition);
}

/**
 * Create atmosphere uniforms for the globe-simulation renderer.
 *
 * @param {object} scene - Provide the globe scene view model.
 * @returns {GlobeSimulationAtmosphereUniformAdapter}
 */
export function createGlobeAtmosphereUniformAdapter(scene) {
	const resolvedSunLight = resolveGlobeAtmosphereSun(scene);
	const atmosphere = new Atmosphere({
		frame: scene?.atmosphere?.frame,
		profile: scene?.atmosphere?.profile,
		sun: resolvedSunLight,
	});
	const shaderValues = atmosphere.createShaderUniforms();
	const values = {
		...shaderValues,
		atmosphereAirlightRgb: cssHexColorArray(shaderValues.atmosphereAirlightColor),
		...frameUniformValues(shaderValues.atmosphereFrame),
		...sunUniformValues(resolvedSunLight),
		...solarIrradianceUniformValues(scene),
		...displayUniformValues(scene?.display),
	};
	const uniforms = createUniformMap(values);

	return {
		enabled: Boolean(scene?.atmosphere),
		atmosphere,
		sun: resolvedSunLight,
		values,
		uniforms,
	};
}
