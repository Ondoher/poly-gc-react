import { STANDARD_SUN } from '../consts.js';
import Sun from '../Sun.js';

describe('Sun', () => {
	it('normalizes directional sunlight', () => {
		const sun = new Sun({
			direction: { x: 0, y: 10, z: 0 },
		});
		const state = sun.getState();

		expect(state.kind).toBe('directional');
		expect(state.direction).toEqual({ x: 0, y: 1, z: 0 });
		expect(sun.directionFrom({ x: 10, y: 20, z: 30 })).toEqual({ x: 0, y: 1, z: 0 });
		expect(sun.distanceFrom({ x: 10, y: 20, z: 30 })).toBe(Infinity);
	});

	it('resolves point sunlight from the sample position', () => {
		const sun = new Sun({
			kind: 'point',
			position: { x: 0, y: 10, z: 0 },
			radiusKm: 5,
		});
		const light = sun.lightFrom({ x: 0, y: 4, z: 0 });

		expect(light.kind).toBe('point');
		expect(light.direction).toEqual({ x: 0, y: 1, z: 0 });
		expect(light.distanceKm).toBeCloseTo(6, 8);
		expect(light.radiusKm).toBe(5);
		expect(light.apparentAngularRadiusRad).toBeCloseTo(Math.asin(5 / 6), 8);
		expect(light.apparentAngularDiameterRad).toBeCloseTo(Math.asin(5 / 6) * 2, 8);
	});

	it('uses configured angular size for directional sunlight', () => {
		const sun = new Sun({
			direction: { x: 0, y: 1, z: 0 },
			angularRadiusRad: 0.01,
		});
		const light = sun.lightFrom({ x: 10, y: 20, z: 30 });

		expect(light.distanceKm).toBe(Infinity);
		expect(light.apparentAngularRadiusRad).toBe(0.01);
		expect(light.apparentAngularDiameterRad).toBe(0.02);
	});

	it('keeps the initial anchor explicit and open by default', () => {
		const sun = new Sun();
		const state = sun.getState();

		expect(state.anchor).toEqual(STANDARD_SUN.anchor);
		expect(state.anchor.status).toBe('open');
	});

	it('exports plain shader uniforms', () => {
		const sun = new Sun({
			color: { r: 1, g: 0.8, b: 0.6 },
			intensity: 2,
		});
		const uniforms = sun.createShaderUniforms();

		expect(uniforms.sunKind).toBe('directional');
		expect(uniforms.sunDirection).toEqual([0, 1, 0]);
		expect(uniforms.sunColor).toEqual([1, 0.8, 0.6]);
		expect(uniforms.sunIntensity).toBe(2);
	});
});
