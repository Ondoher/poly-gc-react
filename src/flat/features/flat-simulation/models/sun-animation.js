import Sun from '../../../shared/Sun.js';
import {
	dot,
	length,
	normalize,
	scale,
	subtract,
	vectorFrom,
} from '../../../shared/math-primitives.js';

/**
 * Rotate a vector around the scene's vertical y axis.
 *
 * This matches the Three.js group rotation used by the current visible sun
 * animation.
 *
 * @param {FlatVector3} position - Specify the position to rotate.
 * @param {number} angleRad - Specify rotation angle in radians.
 * @returns {FlatVector3}
 */
function rotateAroundWorldY(position, angleRad) {
	const rotationCos = Math.cos(angleRad);
	const rotationSin = Math.sin(angleRad);

	return {
		x: position.x * rotationCos + position.z * rotationSin,
		y: position.y,
		z: -position.x * rotationSin + position.z * rotationCos,
	};
}

/**
 * Resolve the observer position used by a sun/light state.
 *
 * The scene model already stores light direction and distance from the
 * observer to the initial point sun, so the resolver can reconstruct the
 * observer when the caller does not provide it explicitly.
 *
 * @param {FlatSimulationSunScene} sceneSun - Provide the scene sun to inspect.
 * @param {FlatSimulationSunAnimationOptions} options - Configure resolution.
 * @returns {FlatVector3}
 */
function resolveObserverPosition(sceneSun, options = {}) {
	if (options.observerPosition) {
		return vectorFrom(options.observerPosition);
	}

	const light = sceneSun.light;

	if (!light?.direction || !Number.isFinite(light.distanceKm)) {
		throw new Error('Cannot resolve animated sun without an observer position or finite light direction/distance.');
	}

	return subtract(light.position || sceneSun.position, scale(light.direction, light.distanceKm));
}

/**
 * Resolve animation angle for a scene sun.
 *
 * @param {FlatSimulationSunScene} sceneSun - Provide the scene sun to animate.
 * @param {number} solarRotationAngleRad - Specify the solar-day rotation angle in radians.
 * @returns {number}
 */
function resolveAnimationAngleRad(sceneSun, solarRotationAngleRad) {
	const animation = sceneSun.animation;

	if (!animation) {
		return 0;
	}

	if (animation.type !== 'solar-day-latitude-ring-rotation') {
		throw new Error(`Unknown flat-simulation sun animation "${animation.type}".`);
	}

	const angle = Number(solarRotationAngleRad);

	return Number.isFinite(angle) ? angle : 0;
}

/**
 * Resolve the solar rotation angle where the sun is horizontally closest to
 * the observer during its daily latitude-ring rotation.
 *
 * @param {FlatSimulationSunScene} sceneSun - Provide the scene sun to inspect.
 * @param {FlatVector3} observerPosition - Provide the projected observer position.
 * @returns {number}
 */
export function resolveClosestSunRotationAngleRad(sceneSun, observerPosition) {
	if (!sceneSun?.animation || sceneSun.animation.type !== 'solar-day-latitude-ring-rotation') {
		return 0;
	}

	const sun = vectorFrom(sceneSun.position);
	const observer = vectorFrom(observerPosition);
	const sunHorizontal = { x: sun.x, y: 0, z: sun.z };
	const observerHorizontal = { x: observer.x, y: 0, z: observer.z };

	if (length(sunHorizontal) === 0 || length(observerHorizontal) === 0) {
		return 0;
	}

	const aligned = dot(observerHorizontal, sunHorizontal);
	const crossY = (observerHorizontal.x * sunHorizontal.z)
		- (observerHorizontal.z * sunHorizontal.x);
	const angleRad = Math.atan2(crossY, aligned);

	return ((angleRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}

/**
 * Resolve the animated flat-simulation sun for the current solar rotation.
 *
 * The returned sun keeps the visible body, point-light state, observer-relative
 * apparent size, and object compatibility view in sync.
 *
 * @param {FlatSimulationSunScene | null | undefined} sceneSun - Provide the scene sun.
 * @param {number} solarRotationAngleRad - Specify the solar-day rotation angle in radians.
 * @param {FlatSimulationSunAnimationOptions} options - Configure resolution.
 * @returns {FlatSimulationSunScene | null}
 */
export function resolveAnimatedSun(sceneSun, solarRotationAngleRad, options = {}) {
	if (!sceneSun) {
		return null;
	}

	const observerPosition = resolveObserverPosition(sceneSun, options);
	const position = rotateAroundWorldY(
		vectorFrom(sceneSun.position),
		resolveAnimationAngleRad(sceneSun, solarRotationAngleRad),
	);
	const light = new Sun({
		...sceneSun.light,
		position,
		radiusKm: sceneSun.radiusKm,
	}).lightFrom(observerPosition);
	const apparent = {
		distanceKm: light.distanceKm,
		angularRadiusRad: light.apparentAngularRadiusRad,
		angularDiameterRad: light.apparentAngularDiameterRad,
		source: sceneSun.apparent.source,
	};
	const object = {
		...sceneSun.object,
		position,
		apparent,
	};

	return {
		...sceneSun,
		position,
		apparent,
		object,
		light,
	};
}

/**
 * Resolve the atmosphere scattering source from the same animated sun body
 * used for rendering.
 *
 * The visible sun may expose different material color and atmosphere radiance
 * assumptions, but position, radius, apparent size, and motion all come from
 * one `scene.sun` object.
 *
 * @param {FlatSimulationSunScene | null | undefined} sceneSun - Provide the scene sun.
 * @param {number} solarRotationAngleRad - Specify the solar-day rotation angle in radians.
 * @param {FlatSimulationSunAnimationOptions} options - Configure resolution.
 * @returns {FlatSunLightState | null}
 */
export function resolveAnimatedAtmosphereSun(sceneSun, solarRotationAngleRad, options = {}) {
	if (!sceneSun) {
		return null;
	}

	const observerPosition = resolveObserverPosition(sceneSun, options);
	const resolvedSun = resolveAnimatedSun(sceneSun, solarRotationAngleRad, {
		...options,
		observerPosition,
	});
	const atmosphere = resolvedSun?.atmosphere || {};

	if (!resolvedSun?.light) {
		return null;
	}

	return new Sun({
		...resolvedSun.light,
		...atmosphere,
		kind: resolvedSun.light.kind,
		position: resolvedSun.light.position,
		radiusKm: resolvedSun.radiusKm,
		anchor: {
			...resolvedSun.light.anchor,
			...(atmosphere.anchor || {}),
		},
	}).lightFrom(observerPosition);
}

/**
 * Resolve the normalized direction from an observer toward a scene position.
 *
 * @param {FlatVector3} observerPosition - Provide the observer position.
 * @param {FlatVector3} position - Provide the target position.
 * @returns {FlatVector3}
 */
export function directionFromObserver(observerPosition, position) {
	return normalize(subtract(position, observerPosition));
}
