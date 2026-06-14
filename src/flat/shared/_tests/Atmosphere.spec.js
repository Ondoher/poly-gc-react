import Atmosphere from '../Atmosphere.js';
import {
	CLEAR_DAY_EARTH_ATMOSPHERE,
	FLAT_ATMOSPHERE_FRAME,
	MEAN_EARTH_RADIUS_KM,
	SPHERICAL_ATMOSPHERE_FRAME,
	STANDARD_EARTH_ATMOSPHERE,
} from '../consts.js';
import Sun from '../Sun.js';

describe('Atmosphere', () => {
	it('uses the shared standard Earth atmosphere profile by default', () => {
		const atmosphere = new Atmosphere();
		const profile = atmosphere.getProfile();

		expect(profile.id).toBe('earth-standard');
		expect(profile.topAltitudeKm).toBe(100);
		expect(profile.seaLevelDensityKgM3).toBe(1.225);
		expect(profile.rayleighScaleHeightKm).toBe(8.5);
		expect(profile.aerosolScaleHeightKm).toBe(1.2);
		expect(profile.rayleighBetaKm.b).toBeGreaterThan(profile.rayleighBetaKm.r);
		expect(profile.mieAnisotropy).toBe(0.8);
		expect(atmosphere.getSun().kind).toBe('directional');
	});

	it('defines a clear-day Earth preset with aerosol optical depth and blue Rayleigh', () => {
		const preset = CLEAR_DAY_EARTH_ATMOSPHERE;

		expect(preset.id).toBe('earth-clear-day');
		expect(preset.topAltitudeKm).toBe(STANDARD_EARTH_ATMOSPHERE.topAltitudeKm);
		expect(preset.rayleighScaleHeightKm).toBe(8.0);
		expect(preset.aerosolScaleHeightKm).toBe(1.2);
		expect(preset.aerosolOpticalDepth550nm).toBe(0.08);
		expect(preset.aerosolSingleScatteringAlbedo).toBe(0.95);
		expect(preset.aerosolAngstromExponent).toBe(1.3);
		expect(preset.rayleighBetaKm).toEqual(STANDARD_EARTH_ATMOSPHERE.rayleighBetaKm);
		expect(preset.rayleighBetaKm.b).toBeGreaterThan(preset.rayleighBetaKm.g);
		expect(preset.rayleighBetaKm.g).toBeGreaterThan(preset.rayleighBetaKm.r);
		expect(preset.mieAnisotropy).toBe(0.8);
	});

	it('derives Mie extinction and scattering from aerosol optical depth', () => {
		const atmosphere = new Atmosphere({
			profile: CLEAR_DAY_EARTH_ATMOSPHERE,
		});
		const profile = atmosphere.getProfile();

		expect(profile.mieExtinctionBetaKm.g).toBeCloseTo(0.08 / 1.2, 8);
		expect(profile.mieScatteringBetaKm.g).toBeCloseTo((0.08 / 1.2) * 0.95, 8);
		expect(profile.mieAbsorptionBetaKm.g).toBeCloseTo((0.08 / 1.2) * 0.05, 8);
		expect(profile.mieExtinctionBetaKm.b).toBeGreaterThan(profile.mieExtinctionBetaKm.r);
		expect(profile.mieScatteringBetaKm.b).toBeGreaterThan(profile.mieScatteringBetaKm.r);
	});

	it('calculates real density from altitude and scale height', () => {
		const atmosphere = new Atmosphere();

		expect(atmosphere.densityKgM3AtAltitudeKm(0)).toBeCloseTo(STANDARD_EARTH_ATMOSPHERE.seaLevelDensityKgM3, 8);
		expect(atmosphere.densityKgM3AtAltitudeKm(STANDARD_EARTH_ATMOSPHERE.rayleighScaleHeightKm))
			.toBeCloseTo(STANDARD_EARTH_ATMOSPHERE.seaLevelDensityKgM3 / Math.E, 8);
		expect(atmosphere.densityKgM3AtAltitudeKm(STANDARD_EARTH_ATMOSPHERE.topAltitudeKm + 1)).toBe(0);
	});

	it('supports flat slab altitude for flat simulation', () => {
		const atmosphere = new Atmosphere({
			frame: FLAT_ATMOSPHERE_FRAME,
		});

		expect(atmosphere.altitudeKm({ x: 10, y: 3.5, z: -4 })).toBeCloseTo(3.5, 8);
	});

	it('supports spherical shell altitude for a standard sky view', () => {
		const atmosphere = new Atmosphere({
			frame: SPHERICAL_ATMOSPHERE_FRAME,
		});

		expect(atmosphere.altitudeKm({ x: 0, y: MEAN_EARTH_RADIUS_KM, z: 0 })).toBeCloseTo(0, 8);
		expect(atmosphere.altitudeKm({ x: 0, y: MEAN_EARTH_RADIUS_KM + 10, z: 0 })).toBeCloseTo(10, 8);
	});

	it('integrates density and extinction along a finite low-altitude view segment', () => {
		const atmosphere = new Atmosphere({
			frame: FLAT_ATMOSPHERE_FRAME,
		});

		const sample = atmosphere.sampleSegment(
			{ x: 0, y: 0, z: 0 },
			{ x: 100, y: 0, z: 0 },
		);

		expect(sample.distanceKm).toBeCloseTo(100, 8);
		expect(sample.atmosphereDistanceKm).toBeCloseTo(100, 8);
		expect(sample.averageRayleighDensityKgM3).toBeCloseTo(STANDARD_EARTH_ATMOSPHERE.seaLevelDensityKgM3, 8);
		expect(sample.opticalDepth.b).toBeGreaterThan(sample.opticalDepth.r);
		expect(sample.transmittance.b).toBeLessThan(sample.transmittance.r);
		expect(sample.airlight).toBeGreaterThan(0);
	});

	it('makes a horizontal sea-level path hazier than a vertical path through the atmosphere depth', () => {
		const atmosphere = new Atmosphere({
			frame: FLAT_ATMOSPHERE_FRAME,
		});

		const horizontal = atmosphere.sampleSegment(
			{ x: 0, y: 0, z: 0 },
			{ x: 100, y: 0, z: 0 },
		);
		const vertical = atmosphere.sampleSegment(
			{ x: 0, y: 0, z: 0 },
			{ x: 0, y: STANDARD_EARTH_ATMOSPHERE.topAltitudeKm, z: 0 },
		);

		expect(horizontal.averageRayleighDensityKgM3).toBeGreaterThan(vertical.averageRayleighDensityKgM3);
		expect(horizontal.opticalDepth.b).toBeGreaterThan(vertical.opticalDepth.b);
		expect(horizontal.transmittance.b).toBeLessThan(vertical.transmittance.b);
	});

	it('finds the spherical atmosphere exit distance for sky rays', () => {
		const atmosphere = new Atmosphere({
			frame: SPHERICAL_ATMOSPHERE_FRAME,
		});
		const origin = { x: 0, y: MEAN_EARTH_RADIUS_KM, z: 0 };
		const up = { x: 0, y: 1, z: 0 };

		expect(atmosphere.atmosphereExitDistanceKm(origin, up)).toBeCloseTo(STANDARD_EARTH_ATMOSPHERE.topAltitudeKm, 8);

		const sample = atmosphere.sampleToAtmosphereExit(origin, up);

		expect(sample.distanceKm).toBeCloseTo(STANDARD_EARTH_ATMOSPHERE.topAltitudeKm, 8);
		expect(sample.atmosphereDistanceKm).toBeCloseTo(STANDARD_EARTH_ATMOSPHERE.topAltitudeKm, 8);
		expect(sample.averageRayleighDensityKgM3).toBeGreaterThan(0);
		expect(sample.averageRayleighDensityKgM3).toBeLessThan(STANDARD_EARTH_ATMOSPHERE.seaLevelDensityKgM3);
	});

	it('models Rayleigh and Mie phase functions on the class', () => {
		const atmosphere = new Atmosphere();

		expect(atmosphere.rayleighPhase(1)).toBeCloseTo(atmosphere.rayleighPhase(-1), 8);
		expect(atmosphere.miePhase(1)).toBeGreaterThan(atmosphere.miePhase(0));
		expect(atmosphere.miePhase(0)).toBeGreaterThan(atmosphere.miePhase(-1));
	});

	it('checks whether flat-slab samples can see the sun', () => {
		const atmosphere = new Atmosphere({
			frame: FLAT_ATMOSPHERE_FRAME,
		});
		const samplePosition = { x: 0, y: 1, z: 0 };

		expect(atmosphere.isShadowedFromLight(samplePosition, new Sun({
			direction: { x: 0, y: 1, z: 0 },
		}))).toBeFalse();
		expect(atmosphere.isShadowedFromLight(samplePosition, new Sun({
			direction: { x: 0, y: -1, z: 0 },
		}))).toBeTrue();
	});

	it('checks whether spherical-shell samples can see the sun', () => {
		const atmosphere = new Atmosphere({
			frame: SPHERICAL_ATMOSPHERE_FRAME,
		});
		const samplePosition = { x: 0, y: MEAN_EARTH_RADIUS_KM + 1, z: 0 };

		expect(atmosphere.isShadowedFromLight(samplePosition, new Sun({
			direction: { x: 0, y: 1, z: 0 },
		}))).toBeFalse();
		expect(atmosphere.isShadowedFromLight(samplePosition, new Sun({
			direction: { x: 0, y: -1, z: 0 },
		}))).toBeTrue();
	});

	it('samples light transmittance from an atmospheric point to the sun', () => {
		const atmosphere = new Atmosphere({
			frame: FLAT_ATMOSPHERE_FRAME,
		});
		const result = atmosphere.sampleLightTransmittance(
			{ x: 0, y: 1, z: 0 },
			new Sun({ direction: { x: 0, y: 1, z: 0 } }),
			{ steps: 4 },
		);

		expect(result.shadowed).toBeFalse();
		expect(result.distanceKm).toBeCloseTo(STANDARD_EARTH_ATMOSPHERE.topAltitudeKm - 1, 8);
		expect(result.transmittance.r).toBeGreaterThan(0);
		expect(result.transmittance.r).toBeLessThan(1);
	});

	it('integrates sunlit single scattering along a view ray', () => {
		const atmosphere = new Atmosphere({
			frame: FLAT_ATMOSPHERE_FRAME,
			sun: new Sun({ direction: { x: 0, y: 1, z: 0 } }),
		});
		const sample = atmosphere.sampleSingleScatteringRay(
			{ x: 0, y: 1, z: 0 },
			{ x: 1, y: 0, z: 0 },
			10,
			{ steps: 4, lightSteps: 4 },
		);

		expect(sample.light.kind).toBe('directional');
		expect(sample.atmosphereDistanceKm).toBeCloseTo(10, 8);
		expect(sample.shadowedSamples).toBe(0);
		expect(sample.inScatteredLight.b).toBeGreaterThan(sample.inScatteredLight.r);
		expect(sample.airlight).toBeGreaterThan(0);
	});

	it('uses solar irradiance scale rather than light intensity for scattering source strength', () => {
		const atmosphere = new Atmosphere({
			frame: FLAT_ATMOSPHERE_FRAME,
		});
		const dimIntensityBrightSun = atmosphere.sampleSingleScatteringRay(
			{ x: 0, y: 1, z: 0 },
			{ x: 1, y: 0, z: 0 },
			10,
			{
				steps: 4,
				lightSteps: 4,
				light: new Sun({
					direction: { x: 0, y: 1, z: 0 },
					intensity: 1,
					solarIrradianceScale: 50,
				}),
			},
		);
		const brightIntensityDimSun = atmosphere.sampleSingleScatteringRay(
			{ x: 0, y: 1, z: 0 },
			{ x: 1, y: 0, z: 0 },
			10,
			{
				steps: 4,
				lightSteps: 4,
				light: new Sun({
					direction: { x: 0, y: 1, z: 0 },
					intensity: 50,
					solarIrradianceScale: 1,
				}),
			},
		);

		expect(dimIntensityBrightSun.inScatteredLight.b)
			.toBeGreaterThan(brightIntensityDimSun.inScatteredLight.b * 10);
		expect(dimIntensityBrightSun.light.intensity).toBe(1);
		expect(dimIntensityBrightSun.light.solarIrradianceScale).toBe(50);
	});

	it('does not add direct in-scattered light for shadowed flat-slab samples', () => {
		const atmosphere = new Atmosphere({
			frame: FLAT_ATMOSPHERE_FRAME,
			sun: new Sun({ direction: { x: 0, y: -1, z: 0 } }),
		});
		const sample = atmosphere.sampleSingleScatteringRay(
			{ x: 0, y: 1, z: 0 },
			{ x: 1, y: 0, z: 0 },
			10,
			{ steps: 4, lightSteps: 4 },
		);

		expect(sample.shadowedSamples).toBe(4);
		expect(sample.inScatteredLight).toEqual({ r: 0, g: 0, b: 0 });
		expect(sample.airlight).toBe(0);
	});

	it('exports plain shader uniforms without depending on Three.js objects', () => {
		const atmosphere = new Atmosphere({
			frame: SPHERICAL_ATMOSPHERE_FRAME,
		});
		const uniforms = atmosphere.createShaderUniforms();

		expect(uniforms.atmosphereFrameKind).toBe('spherical-shell');
		expect(uniforms.atmosphereTopAltitudeKm).toBe(100);
		expect(uniforms.atmosphereMieAnisotropy).toBe(0.8);
		expect(uniforms.atmosphereMieScatteringBetaKm[1])
			.toBeCloseTo(atmosphere.getProfile().mieScatteringBetaKm.g, 8);
		expect(uniforms.atmosphereMieExtinctionBetaKm[1])
			.toBeCloseTo(atmosphere.getProfile().mieExtinctionBetaKm.g, 8);
		expect(uniforms.atmosphereRayleighBetaKm).toEqual([
			STANDARD_EARTH_ATMOSPHERE.rayleighBetaKm.r,
			STANDARD_EARTH_ATMOSPHERE.rayleighBetaKm.g,
			STANDARD_EARTH_ATMOSPHERE.rayleighBetaKm.b,
		]);
		expect(uniforms.atmosphereFrame.planetRadiusKm).toBe(MEAN_EARTH_RADIUS_KM);
		expect(uniforms.sunKind).toBe('directional');
	});
});
