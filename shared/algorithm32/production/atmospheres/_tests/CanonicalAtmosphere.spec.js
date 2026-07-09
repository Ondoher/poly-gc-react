import CanonicalAtmosphere from '../CanonicalAtmosphere.js';

describe('CanonicalAtmosphere', () => {
	it('describes immutable canonical atmosphere configuration', () => {
		const atmosphere = createAtmosphere();

		expect(atmosphere.id).toBe('canonical-atmosphere');
		expect(atmosphere.describe()).toEqual(jasmine.objectContaining({
			kind: 'canonical-atmosphere',
			spectralChannelCount: 2,
			constants: createConstants(),
		}));
		expect(atmosphere.spectralChannels).toEqual(createSpectralChannels());
	});

	it('creates atmosphere-owned shader contributions for spherical and flat geometry', () => {
		const atmosphere = createAtmosphere();
		const spherical = atmosphere.createShaderContribution({
			descriptor: createSphericalDescriptor(),
		});
		const flat = atmosphere.createShaderContribution({
			descriptor: createFlatDescriptor(),
		});

		expect(spherical.id).toBe('atmosphere-canonical');
		expect(spherical.owner).toBe('atmosphere');
		expect(flat.id).toBe('atmosphere-canonical-flat-altitude');
		expect(flat.owner).toBe('atmosphere');
	});

	it('samples Rayleigh and Mie medium coefficients by wavelength and density', () => {
		const medium = createAtmosphere().sampleMedium({ altitudeMeters: 0 });

		expectSpectralClose(medium.rayleighScattering, [2, 0.125]);
		expectSpectralClose(medium.mieExtinction, [2, 1]);
		expectSpectralClose(medium.mieScattering, [1, 0.5]);
		expectSpectralClose(medium.extinction, [4, 1.125]);
		expectSpectralClose(medium.scattering, [3, 0.625]);
		expect(medium.density).toEqual({
			rayleigh: 1,
			mie: 1,
			absorption: 0,
		});
	});

	it('applies exponential density profiles above the ground', () => {
		const medium = createAtmosphere().sampleMedium({ altitudeMeters: 10 });

		expectSpectralClose(medium.rayleighScattering, [2 * Math.exp(-1), 0.125 * Math.exp(-1)]);
		expectSpectralClose(medium.mieExtinction, [2 * Math.exp(-2), Math.exp(-2)]);
	});

	it('integrates optical depth and transmittance over path samples', () => {
		const result = createAtmosphere().integrateOpticalDepth({
			samples: [
				{ atmosphereCoordinate: { altitudeMeters: 0 }, measureMeters: 0.5 },
				{ atmosphereCoordinate: { altitudeMeters: 0 }, measureMeters: 0.5 },
			],
		});

		expectSpectralClose(result.opticalDepth, [4, 1.125]);
		expectSpectralClose(result.transmittance, [Math.exp(-4), Math.exp(-1.125)]);
	});

	it('returns opaque transmittance for ground-blocked source paths', () => {
		const result = createAtmosphere().integrateOpticalDepth({ blockedByGround: true });

		expect(result.opticalDepth).toEqual([Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]);
		expect(result.transmittance).toEqual([0, 0]);
	});

	it('samples Rayleigh and Mie phase values for direction pairs', () => {
		const result = createAtmosphere().samplePhase({
			viewDirection: [1, 0, 0],
			incomingDirection: [1, 0, 0],
		});
		const rayleighPhase = 3 / (8 * Math.PI);
		const miePhase = miePhaseFunction(0.25, 1);

		expect(result.rayleighPhase).toBeCloseTo(rayleighPhase, 12);
		expect(result.miePhase).toBeCloseTo(miePhase, 12);
		expectSpectralClose(result.phase, [rayleighPhase + miePhase, rayleighPhase + miePhase]);
	});

	it('fails loudly for invalid configuration or sample packets', () => {
		expect(() => new CanonicalAtmosphere()).toThrowError(/configuration/);
		expect(() => createAtmosphere({ constants: { ...createConstants(), mieScaleHeightMeters: 0 } }))
			.toThrowError(/positive/);
		expect(() => createAtmosphere({ spectralChannels: [] })).toThrowError(/spectral channels/);
		expect(() => createAtmosphere().sampleMedium({})).toThrowError(/altitudeMeters/);
		expect(() => createAtmosphere().integrateOpticalDepth({})).toThrowError(/samples/);
		expect(() => createAtmosphere().samplePhase({ viewDirection: [1, 0, 0] })).toThrowError(/incomingDirection/);
	});
});

function createAtmosphere(overrides = {}) {
	return new CanonicalAtmosphere({
		constants: createConstants(),
		spectralChannels: createSpectralChannels(),
		...overrides,
	});
}

function createConstants() {
	return {
		rayleighScaleHeightMeters: 10,
		mieScaleHeightMeters: 5,
		rayleighCoefficientScale: 2,
		mieAngstromAlpha: 1,
		mieAngstromBeta: 10,
		mieSingleScatteringAlbedo: 0.5,
		miePhaseFunctionG: 0.25,
	};
}

function createSpectralChannels() {
	return [
		{
			name: 'a',
			wavelength: {
				value: 1000,
				units: 'nanometers',
			},
			solarIrradiance: 1,
		},
		{
			name: 'b',
			wavelength: {
				value: 2000,
				units: 'nanometers',
			},
			solarIrradiance: 1,
		},
	];
}

function createSphericalDescriptor() {
	return createDescriptor({
		geometry: {
			kind: 'spherical-earth-geometry',
			bottomRadiusMeters: 10,
			topRadiusMeters: 20,
			observerHeightMeters: 1,
			cacheAltitudeBinCount: 2,
			cacheBoundaryAltitudeMeters: 2,
			sourceTransmittanceIntervalCount: 2,
		},
		lightSource: {
			kind: 'distant-sun-light-source',
			directionToLight: [0, 1, 0],
		},
		cache: {
			cacheKind: 'distant',
			metadata: {
				altitudeBinCount: 2,
				directionCount: 4,
			},
		},
		transport: {
			execution: {
				pathIntervalCount: 2,
				sourceTransmittanceIntervalCount: 2,
			},
		},
	});
}

function createFlatDescriptor() {
	return createDescriptor({
		geometry: {
			kind: 'flat-earth-geometry',
			observerPositionMeters: [0, 0, 2],
			sourcePositionMeters: [10, 0, 5],
			sourceSubpointMeters: [10, 0, 0],
			topAltitudeMeters: 12,
			sceneSkyRayLimitMeters: 100,
			sourceTransmittanceIntervalCount: 2,
			cacheZBinsMeters: [0, 5, 10],
			cacheRhoBinsMeters: [0, 10, 20],
		},
		lightSource: {
			kind: 'local-sun-light-source',
			sourceKey: 'local-test',
			referenceDistanceMeters: 4800000,
			referenceSpectralIncidentScale: 1.25,
			radiusMeters: 25749.504,
			distanceFalloff: true,
		},
		cache: {
			cacheKind: 'local',
			metadata: {
				zBinCount: 3,
				rhoBinCount: 3,
				directionCount: 9,
			},
		},
		transport: {
			execution: {
				pathIntervalCount: 2,
				sourceTransmittanceIntervalCount: 2,
			},
		},
	});
}

function createDescriptor(overrides) {
	return {
		descriptorId: 'descriptor',
		variantId: 'variant',
		fingerprint: 'descriptor',
		compatibilityTags: [],
		spectralBasis: createSection('basis', {
			channelCount: 15,
		}),
		geometry: createSection('geometry', overrides.geometry),
		atmosphere: createSection('atmosphere', {
			kind: 'canonical-atmosphere',
			constants: createConstants(),
		}),
		lightSource: createSection('light-source', overrides.lightSource),
		cache: createSection('cache', overrides.cache),
		transport: createSection('transport', overrides.transport),
		color: createSection('color', {}),
		runtime: createSection('runtime', {}),
	};
}

function createSection(fingerprint, facts) {
	return {
		descriptorId: fingerprint,
		fingerprint,
		compatibilityTags: [fingerprint],
		facts,
	};
}

function expectSpectralClose(actual, expected) {
	expect(actual.length).toBe(expected.length);

	for (let index = 0; index < actual.length; index += 1) {
		expect(actual[index]).withContext(`channel ${index}`).toBeCloseTo(expected[index], 12);
	}
}

function miePhaseFunction(g, nu) {
	const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));
	const denominator = Math.max(1 + g * g - 2 * g * nu, Number.EPSILON);

	return (k * (1 + nu * nu)) / denominator ** 1.5;
}
