import Sun from '../../../shared/Sun.js';
import {
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
 * @param {FalseSimulationSunScene} sceneSun - Provide the scene sun to inspect.
 * @param {FalseSimulationSunAnimationOptions} options - Configure resolution.
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
 * Resolve animation angle for a scene sun at a given elapsed time.
 *
 * @param {FalseSimulationSunScene} sceneSun - Provide the scene sun to animate.
 * @param {number} elapsedSeconds - Specify elapsed render time in seconds.
 * @returns {number}
 */
function resolveAnimationAngleRad(sceneSun, elapsedSeconds) {
	const animation = sceneSun.animation;

	if (!animation) {
		return 0;
	}

	if (animation.type !== 'solar-day-fixed-latitude-rotation') {
		throw new Error(`Unknown false-simulation sun animation "${animation.type}".`);
	}

	const displayDurationSeconds = Number(animation.displayDurationSeconds);

	if (!Number.isFinite(displayDurationSeconds) || displayDurationSeconds <= 0) {
		return 0;
	}

	const elapsed = Number(elapsedSeconds) || 0;
	const cycleRatio = ((elapsed % displayDurationSeconds) + displayDurationSeconds) % displayDurationSeconds
		/ displayDurationSeconds;

	return cycleRatio * Math.PI * 2;
}

/**
 * Resolve the animated false-simulation sun for the current render time.
 *
 * The returned sun keeps the visible body, point-light state, observer-relative
 * apparent size, and object compatibility view in sync.
 *
 * @param {FalseSimulationSunScene | null | undefined} sceneSun - Provide the scene sun.
 * @param {number} elapsedSeconds - Specify elapsed render time in seconds.
 * @param {FalseSimulationSunAnimationOptions} options - Configure resolution.
 * @returns {FalseSimulationSunScene | null}
 */
export function resolveAnimatedSun(sceneSun, elapsedSeconds, options = {}) {
	if (!sceneSun) {
		return null;
	}

	const observerPosition = resolveObserverPosition(sceneSun, options);
	const position = rotateAroundWorldY(
		vectorFrom(sceneSun.position),
		resolveAnimationAngleRad(sceneSun, elapsedSeconds),
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
 * Resolve the normalized direction from an observer toward a scene position.
 *
 * @param {FlatVector3} observerPosition - Provide the observer position.
 * @param {FlatVector3} position - Provide the target position.
 * @returns {FlatVector3}
 */
export function directionFromObserver(observerPosition, position) {
	return normalize(subtract(position, observerPosition));
}
