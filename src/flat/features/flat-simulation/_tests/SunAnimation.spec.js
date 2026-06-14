import FlatSimulationSceneModel from '../models/FlatSimulationSceneModel.js';
import {
	directionFromObserver,
	resolveAnimatedSun,
	resolveClosestSunRotationAngleRad,
} from '../models/sun-animation.js';

function expectVectorClose(actual, expected) {
	expect(actual.x).toBeCloseTo(expected.x, 8);
	expect(actual.y).toBeCloseTo(expected.y, 8);
	expect(actual.z).toBeCloseTo(expected.z, 8);
}

function distanceBetween(left, right) {
	return Math.hypot(
		right.x - left.x,
		right.y - left.y,
		right.z - left.z,
	);
}

describe('flat-simulation sun animation', () => {
	it('returns null when the scene sun is disabled', () => {
		expect(resolveAnimatedSun(null, 0)).toBeNull();
		expect(resolveAnimatedSun(undefined, 0)).toBeNull();
	});

	it('keeps zero rotation at the projected scene-model sun position', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const resolved = resolveAnimatedSun(scene.sun, 0, {
			observerPosition: scene.observer.position,
		});

		expect(resolved).not.toBe(scene.sun);
		expect(resolved.object).not.toBe(scene.sun.object);
		expectVectorClose(resolved.position, scene.sun.position);
		expectVectorClose(resolved.object.position, scene.sun.object.position);
		expectVectorClose(resolved.light.position, scene.sun.light.position);
		expect(resolved.apparent).toBe(resolved.object.apparent);
	});

	it('rotates the sun around the world y axis for the solar-day loop', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const start = scene.sun.position;
		const resolved = resolveAnimatedSun(scene.sun, Math.PI / 2, {
			observerPosition: scene.observer.position,
		});
		const expectedPosition = {
			x: start.z,
			y: start.y,
			z: -start.x,
		};

		expectVectorClose(resolved.position, expectedPosition);
		expectVectorClose(resolved.object.position, expectedPosition);
		expectVectorClose(resolved.light.position, expectedPosition);
	});

	it('updates light direction, distance, and apparent size from the resolved position', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const resolved = resolveAnimatedSun(scene.sun, Math.PI, {
			observerPosition: scene.observer.position,
		});
		const distanceKm = distanceBetween(scene.observer.position, resolved.position);
		const direction = directionFromObserver(scene.observer.position, resolved.position);
		const apparentAngularRadiusRad = Math.asin(resolved.radiusKm / distanceKm);

		expect(resolved.light.distanceKm).toBeCloseTo(distanceKm, 8);
		expectVectorClose(resolved.light.direction, direction);
		expect(resolved.light.apparentAngularRadiusRad).toBeCloseTo(apparentAngularRadiusRad, 8);
		expect(resolved.light.apparentAngularDiameterRad).toBeCloseTo(apparentAngularRadiusRad * 2, 8);
		expect(resolved.apparent.distanceKm).toBeCloseTo(distanceKm, 8);
		expect(resolved.apparent.angularRadiusRad).toBeCloseTo(apparentAngularRadiusRad, 8);
		expect(resolved.object.apparent).toBe(resolved.apparent);
	});

	it('can infer the observer position from the initial light state', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const explicit = resolveAnimatedSun(scene.sun, 3, {
			observerPosition: scene.observer.position,
		});
		const inferred = resolveAnimatedSun(scene.sun, 3);

		expectVectorClose(inferred.position, explicit.position);
		expectVectorClose(inferred.light.direction, explicit.light.direction);
		expect(inferred.light.distanceKm).toBeCloseTo(explicit.light.distanceKm, 8);
		expect(inferred.light.apparentAngularRadiusRad).toBeCloseTo(explicit.light.apparentAngularRadiusRad, 8);
	});

	it('does not mutate the scene-model sun', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const startPosition = { ...scene.sun.position };

		resolveAnimatedSun(scene.sun, Math.PI, {
			observerPosition: scene.observer.position,
		});

		expectVectorClose(scene.sun.position, startPosition);
		expectVectorClose(scene.sun.object.position, startPosition);
		expectVectorClose(scene.sun.light.position, startPosition);
	});

	it('finds the fixed solar rotation angle where the sun is closest to the observer', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const solarRotationAngleRad = resolveClosestSunRotationAngleRad(scene.sun, scene.observer.position);
		const closestSun = resolveAnimatedSun(scene.sun, solarRotationAngleRad, {
			observerPosition: scene.observer.position,
		});
		const oppositeSun = resolveAnimatedSun(
			scene.sun,
			solarRotationAngleRad + Math.PI,
			{ observerPosition: scene.observer.position },
		);

		expect(solarRotationAngleRad).toBeGreaterThanOrEqual(0);
		expect(solarRotationAngleRad).toBeLessThan(Math.PI * 2);
		expect(closestSun.light.distanceKm).toBeLessThan(oppositeSun.light.distanceKm);
		expect(closestSun.light.distanceKm).toBeLessThan(scene.sun.light.distanceKm);
	});
});
