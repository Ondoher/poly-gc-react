import Atmosphere from '../../../shared/Atmosphere.js';

const FRAME_KIND_IDS = Object.freeze({
	'flat-slab': 0,
	'spherical-shell': 1,
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
 * Copy one vector array into another stable uniform value.
 *
 * @param {number[] | null} target - Provide the existing uniform value.
 * @param {number[] | null} next - Provide the next vector value.
 * @returns {number[] | null}
 */
function updateArrayValue(target, next) {
	if (!next) {
		return null;
	}

	if (!target) {
		return [...next];
	}

	target[0] = next[0];
	target[1] = next[1];
	target[2] = next[2];

	return target;
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
 * Flatten atmosphere frame details into shader-friendly uniforms.
 *
 * @param {FlatAtmosphereFrame} frame - Provide the normalized atmosphere frame.
 * @returns {Record<string, unknown>}
 */
function frameUniformValues(frame) {
	if (frame.kind === 'spherical-shell') {
		return {
			atmosphereFrameKindId: FRAME_KIND_IDS[frame.kind],
			atmosphereFrameOrigin: [0, 0, 0],
			atmosphereFrameUp: [0, 1, 0],
			atmospherePlanetCenter: vectorArray(frame.planetCenter),
			atmospherePlanetRadiusKm: frame.planetRadiusKm,
		};
	}

	return {
		atmosphereFrameKindId: FRAME_KIND_IDS[frame.kind],
		atmosphereFrameOrigin: vectorArray(frame.origin),
		atmosphereFrameUp: vectorArray(frame.up),
		atmospherePlanetCenter: [0, 0, 0],
		atmospherePlanetRadiusKm: 0,
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
		sunKind: sun?.kind || 'directional',
		sunKindId: sun?.kind === 'point' ? 1 : 0,
		sunDirection: vectorArray(sun?.direction, [0, 1, 0]),
		sunPosition: vectorArray(sun?.position, [0, 0, 0]),
		sunColor: colorArray(sun?.color || { r: 1, g: 1, b: 1 }),
		sunIntensity: Number(sun?.intensity) || 0,
		sunSolarIrradianceScale: Number(sun?.solarIrradianceScale) || 0,
		sunAngularRadiusRad: sun?.kind === 'point'
			? Number(sun?.apparentAngularRadiusRad) || 0
			: Number(sun?.angularRadiusRad) || 0,
		sunRadiusKm: Number(sun?.radiusKm) || 0,
		sunAnchor: { ...(sun?.anchor || {}) },
	};
}

/**
 * Create atmosphere uniforms for the flat-simulation renderer.
 *
 * @param {FlatSimulationAtmosphereSettings | null | undefined} atmosphereSettings - Provide scene atmosphere settings.
 * @param {FlatSunLightState | FlatSunState | null | undefined} resolvedSunLight - Provide the resolved animated sun light.
 * @returns {FlatSimulationAtmosphereUniformAdapter}
 */
export function createAtmosphereUniformAdapter(atmosphereSettings, resolvedSunLight) {
	const atmosphere = new Atmosphere({
		frame: atmosphereSettings?.frame,
		profile: atmosphereSettings?.profile,
		sun: resolvedSunLight,
	});
	const shaderValues = atmosphere.createShaderUniforms();
	const values = {
		...shaderValues,
		atmosphereAirlightRgb: cssHexColorArray(shaderValues.atmosphereAirlightColor),
		...frameUniformValues(shaderValues.atmosphereFrame),
		...sunUniformValues(resolvedSunLight || atmosphere.getSun()),
	};
	const uniforms = createUniformMap(values);

	return {
		enabled: Boolean(atmosphereSettings?.enabled),
		atmosphere,
		values,
		uniforms,
		updateSunUniforms: (nextSunLight) => updateAtmosphereSunUniforms(uniforms, nextSunLight),
	};
}

/**
 * Update mutable sun uniforms without replacing the uniform map.
 *
 * @param {Record<string, { value: unknown }>} uniforms - Provide the existing uniform map.
 * @param {FlatSunLightState | FlatSunState | null | undefined} resolvedSunLight - Provide the next resolved sun/light state.
 * @returns {Record<string, { value: unknown }>}
 */
export function updateAtmosphereSunUniforms(uniforms, resolvedSunLight) {
	const values = sunUniformValues(resolvedSunLight);

	uniforms.sunKind.value = values.sunKind;
	uniforms.sunKindId.value = values.sunKindId;
	uniforms.sunDirection.value = updateArrayValue(uniforms.sunDirection.value, values.sunDirection);
	uniforms.sunPosition.value = updateArrayValue(uniforms.sunPosition.value, values.sunPosition);
	uniforms.sunColor.value = updateArrayValue(uniforms.sunColor.value, values.sunColor);
	uniforms.sunIntensity.value = values.sunIntensity;
	uniforms.sunSolarIrradianceScale.value = values.sunSolarIrradianceScale;
	uniforms.sunAngularRadiusRad.value = values.sunAngularRadiusRad;
	uniforms.sunRadiusKm.value = values.sunRadiusKm;
	uniforms.sunAnchor.value = values.sunAnchor;

	return uniforms;
}
