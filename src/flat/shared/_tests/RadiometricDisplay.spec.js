import {
	createRadiometricDisplayConfig,
	mapRadianceToDisplayRgb,
} from '../RadiometricDisplay.js';

describe('RadiometricDisplay', () => {
	it('normalizes default display settings', () => {
		const config = createRadiometricDisplayConfig();

		expect(config).toEqual({
			model: 'radiometric-display-v1',
			radiometricToSceneRgbScale: 1,
			exposure: 1,
			toneMapping: 'linear-clamp',
		});
		expect(Object.isFrozen(config)).toBeTrue();
	});

	it('maps zero radiance to black', () => {
		const displayRgb = mapRadianceToDisplayRgb({ r: 0, g: 0, b: 0 });

		expect(displayRgb).toEqual({ r: 0, g: 0, b: 0 });
	});

	it('increases mapped output when exposure increases', () => {
		const lowExposure = mapRadianceToDisplayRgb(
			{ r: 0.1, g: 0.2, b: 0.3 },
			{ exposure: 1 },
		);
		const highExposure = mapRadianceToDisplayRgb(
			{ r: 0.1, g: 0.2, b: 0.3 },
			{ exposure: 2 },
		);

		expect(highExposure.r).toBeGreaterThan(lowExposure.r);
		expect(highExposure.g).toBeGreaterThan(lowExposure.g);
		expect(highExposure.b).toBeGreaterThan(lowExposure.b);
	});

	it('compresses high values with Reinhard tone mapping', () => {
		const displayRgb = mapRadianceToDisplayRgb(
			{ r: 10, g: 2, b: 0.5 },
			{ toneMapping: 'reinhard' },
		);

		expect(displayRgb.r).toBeGreaterThan(displayRgb.g);
		expect(displayRgb.g).toBeGreaterThan(displayRgb.b);
		expect(displayRgb.r).toBeLessThan(1);
		expect(displayRgb.r).toBeCloseTo(10 / 11, 8);
	});

	it('clips high values with linear clamp tone mapping', () => {
		const displayRgb = mapRadianceToDisplayRgb(
			{ r: 10, g: 0.5, b: 0.25 },
			{ toneMapping: 'linear-clamp' },
		);

		expect(displayRgb).toEqual({ r: 1, g: 0.5, b: 0.25 });
	});

	it('fails loudly for unknown tone mapping', () => {
		expect(() => createRadiometricDisplayConfig({
			toneMapping: 'filmic',
		})).toThrowError('Unknown radiometric display tone mapping "filmic".');
	});
});
