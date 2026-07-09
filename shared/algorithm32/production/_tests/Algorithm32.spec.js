import { readFileSync } from 'node:fs';

import { Algorithm32 } from '../Algorithm32.js';

/**
 * Read the Algorithm32 facade source.
 *
 * @returns {string} The Algorithm32 facade source text.
 */
function readAlgorithm32Source() {
	return readFileSync(new URL('../Algorithm32.js', import.meta.url), 'utf8');
}

/**
 * Create a wavelength test packet.
 *
 * @param {number} value - Supplies the wavelength value.
 * @returns {{ value: number, units: string }} The wavelength packet.
 */
function wavelength(value) {
	return {
		value,
		units: 'nanometers',
	};
}

/**
 * Create a production-shaped set of model doubles.
 *
 * @param {string} id - Supplies an id suffix.
 * @returns {{ lightSource: object, atmosphere: object, geometry: object }} The models.
 */
function createModels(id = 'test') {
	return {
		lightSource: {
			describe() {
				return { kind: 'algorithm32-light-source-model', id: `light-${id}`, fingerprint: `light:${id}` };
			},
			createIncidentRadianceCache() {
				return {
					descriptor: { cacheKind: 'none', sourceKey: `light-${id}`, version: 1 },
					coordinates: function* coordinates() {},
					addCoordinateToCache() {},
					createIncidentRadianceSampler() {
						return () => [];
					},
				};
			},
			sampleDirectLighting() {
				return {
					incidentRadiance: [1],
					directionToLight: [0, 0, 1],
				};
			},
			resolveSourcePathLimit() {
				return {
					maxDistanceMeters: null,
					reason: 'test-directional',
				};
			},
		},
		atmosphere: {
			describe() {
				return { kind: 'algorithm32-atmosphere-model', id: `atmosphere-${id}`, fingerprint: `atmosphere:${id}` };
			},
			sampleMedium() {
				return {
					extinction: [0],
					scattering: [0],
					rayleighScattering: [0],
					mieScattering: [0],
					absorption: [0],
					density: {},
				};
			},
			integrateOpticalDepth() {
				return {
					opticalDepth: [0],
					transmittance: [1],
				};
			},
			samplePhase() {
				return {
					rayleighPhase: 1,
					miePhase: 0,
				};
			},
		},
		geometry: {
			describe() {
				return { kind: 'algorithm32-geometry-model', id: `geometry-${id}`, fingerprint: `geometry:${id}` };
			},
			resolveViewRaySegment() {
				return {
					ray: {
						origin: [0, 0, 0],
						direction: [0, 0, 1],
					},
					startDistanceMeters: 0,
					endDistanceMeters: 0,
				};
			},
			resolveAtmosphereCoordinate() {
				return {
					altitudeMeters: 0,
				};
			},
			resolveAtmospherePath() {
				return {
					start: { altitudeMeters: 0 },
					end: { altitudeMeters: 0 },
					lengthMeters: 0,
				};
			},
			resolveSourceRelativePosition() {
				return {
					directionFromSource: [0, 0, -1],
					distanceFromSourceMeters: null,
				};
			},
			resolveCacheAccess() {
				return {
					cacheKey: 'none',
					coordinates: [],
				};
			},
		},
	};
}

/**
 * Create a valid Algorithm32 config for tests.
 *
 * @param {string} id - Supplies an id suffix.
 * @returns {object} The config.
 */
function createConfig(id = 'test') {
	return {
		...createModels(id),
		spectral: {
			wavelengths: [wavelength(550)],
		},
		execution: {
			pathIntervalCount: 1,
		},
		shader: {
			mode: 'test',
		},
	};
}

describe('Algorithm32', () => {
	it('keeps the primary facade surface documented', () => {
		const source = readAlgorithm32Source();
		const expectedSnippets = [
			'export class Algorithm32',
			'constructor(config)',
			'get config()',
			'setConfig(config)',
			'async setupShader(request)',
			'evaluate(request)',
			'dispose()',
			'@param {Config} config -',
			'@returns {Promise<ShaderHandle>} The installed runtime shader handle.',
			'@returns {EvaluationResult} The spectral evaluation result.',
		];

		for (const expectedSnippet of expectedSnippets) {
			// Reason: each production class keeps its own local class-named spec file.
			// Source: Algorithm32 production test placement convention, 2026-06-28.
			expect(source).toContain(expectedSnippet);
		}
	});

	it('creates immutable config snapshots with shared model descriptors', () => {
		const config = createConfig();
		const algorithm32 = new Algorithm32(config);
		const snapshot = algorithm32.config;

		config.spectral.wavelengths[0] = wavelength(999);

		expect(snapshot.version).toBe(1);
		expect(snapshot.config.spectral.wavelengths).toEqual([wavelength(550)]);
		expect(snapshot.model.version).toBe(1);
		expect(snapshot.model.lightSource.id).toBe('light-test');
		expect(snapshot.model.atmosphere.id).toBe('atmosphere-test');
		expect(snapshot.model.geometry.id).toBe('geometry-test');
	});

	it('accepts an optional configured Color instance at facade creation', () => {
		const color = {
			describe() {
				return { kind: 'algorithm32-color', id: 'color-test', fingerprint: 'color:test' };
			},
			convert() {
				return { rgba: [1, 1, 1, 1] };
			},
		};
		const algorithm32 = new Algorithm32({
			...createConfig(),
			color,
		});

		expect(algorithm32.config.config.color).toBe(color);
	});

	it('replaces config as a full lifecycle version update', () => {
		const algorithm32 = new Algorithm32(createConfig('first'));
		const nextSnapshot = algorithm32.setConfig(createConfig('second'));

		expect(nextSnapshot.version).toBe(2);
		expect(nextSnapshot.model.lightSource.id).toBe('light-second');
		expect(algorithm32.config.version).toBe(2);
	});

	it('delegates CPU/reference evaluation through the configured reference collaborator', () => {
		const algorithm32 = new Algorithm32(createConfig());
		const result = algorithm32.evaluate({});

		expect(result.pathRadiance).toEqual([0]);
		expect(result.transmittance).toEqual([1]);
		expect(result.viewRaySegment.endDistanceMeters).toBe(0);
	});

	it('builds an awaited shader handle through setup-time attachment', async () => {
		const algorithm32 = new Algorithm32(createConfig());
		const handle = await algorithm32.setupShader({
			composer: {},
			scene: {},
			camera: {},
		});

		expect(handle.getDiagnostics()).toEqual({
			status: 'deferred',
			modelVersion: 1,
		});
		expect(handle.setConfig).toEqual(jasmine.any(Function));
		expect(handle.setColor).toBeUndefined();
		expect(handle.setScene).toBeUndefined();
		expect(handle.setCamera).toBeUndefined();
	});

	it('fails loudly for deferred debug views and disposed operations', () => {
		expect(() => new Algorithm32({
			...createConfig(),
			shader: {
				debugView: 'experiment-only',
			},
		})).toThrowError(/debug views are deferred/);

		const algorithm32 = new Algorithm32(createConfig());
		algorithm32.dispose();

		expect(() => algorithm32.config).toThrowError(/disposed/);
	});
});
