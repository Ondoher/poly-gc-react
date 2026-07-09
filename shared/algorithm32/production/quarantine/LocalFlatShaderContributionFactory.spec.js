import { readFileSync } from 'node:fs';

import BrunetonColorDisplayModel from '../../color/BrunetonColorDisplayModel.js';
import { Algorithm32ShaderAssembler } from '../../shader/Algorithm32ShaderAssembler.js';
import { RuntimeShaderContributionFactory } from '../../shader/RuntimeShaderContributionFactory.js';
import LocalSunLightSource from '../LocalSunLightSource.js';
import LocalFlatShaderContributionFactory from '../LocalFlatShaderContributionFactory.js';
import {
	CANONICAL_ATMOSPHERE_CONSTANTS,
	CANONICAL_SPECTRAL_CHANNELS,
} from '../../constants/Algorithm32CanonicalData.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../LocalFlatShaderContributionFactory.js', import.meta.url), 'utf8');
}

describe('LocalFlatShaderContributionFactory', () => {
	it('keeps the local flat shader contribution factory documented', () => {
		const source = readSource();

		expect(source).toContain('export class LocalFlatShaderContributionFactory');
		expect(source).toContain('mainRequiredSymbols()');
		expect(source).toContain('createContributions(descriptor)');
		expect(source).toContain('@returns {readonly ShaderContribution[]}');
	});

	it('creates the POC-backed owner contributions for the local flat profile', () => {
		const factory = new LocalFlatShaderContributionFactory();
		const contributions = factory.createContributions(createDescriptor());

		expect(contributions.map((contribution) => contribution.id)).toEqual([
			'geometry-flat-earth',
			'atmosphere-canonical-flat-altitude',
			'light-local-sun',
			'cache-local-l2-incident-radiance',
			'transport-algorithm32-local-flat',
		]);
		expect(contributions[0].functions[0].code).toContain('GEOMETRY_TOP_ALTITUDE_METERS = 100000.0');
		expect(contributions[1].functions[1].code).toContain('clamp(positionMeters.z, 0.0, GEOMETRY_TOP_ALTITUDE_METERS)');
		expect(contributions[2].functions[0].code).toContain('LOCAL_LIGHT_REFERENCE_SPECTRAL_INCIDENT_SCALE = 1.25');
		expect(contributions[3].diagnostics.texture.dimensions).toEqual([9, 3, 8]);
		expect(contributions[4].functions[0].code).toContain('TRANSPORT_PATH_INTERVAL_COUNT = 24');
		expect(contributions[4].functions[0].code).toContain('SOURCE_TRANSMITTANCE_INTERVAL_COUNT = 12');
	});

	it('lets the local source model provide its light-source contribution', () => {
		const source = new LocalSunLightSource({
			sourceKey: 'local-test',
			spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
			referenceDistanceMeters: 4800000,
			referenceSpectralIncidentScale: 1.25,
			radiusMeters: 25749.504,
			distanceFalloff: true,
			cacheZBinsMeters: [2, 1000],
			cacheRhoBinsMeters: [0, 500000, 1250000],
			cacheDirectionCount: 9,
		});
		const contribution = source.createShaderContribution({
			descriptor: createDescriptor(source.describe()),
		});

		expect(contribution.id).toBe('light-local-sun');
		expect(contribution.owner).toBe('lightSource');
		expect(contribution.provides).toEqual(['light.sampleDirectRadiance', 'light.sourceDirection']);
	});

	it('assembles with runtime and Color contributions into a complete shader', () => {
		const descriptor = createDescriptor();
		const factory = new LocalFlatShaderContributionFactory();
		const assembly = new Algorithm32ShaderAssembler().assemble({
			descriptor,
			contributions: [
				new RuntimeShaderContributionFactory().createContribution(descriptor),
				...factory.createContributions(descriptor),
				new BrunetonColorDisplayModel().createShaderContribution({ descriptor }),
			],
			mainRequiredSymbols: factory.mainRequiredSymbols(),
			systemProvidedSymbols: [],
		});

		expect(assembly.status).toBe('accepted');
		expect(assembly.fragmentShaderSource).toContain('const int SPECTRAL_CHANNEL_COUNT = 15;');
		expect(assembly.fragmentShaderSource).toContain('void evaluatePathRadiance(inout ShaderState state)');
		expect(assembly.fragmentShaderSource).toContain('vec4 encodeDisplayOutput(vec3 linearSrgb)');
		expect(assembly.bindingRequirements.map((binding) => binding.id)).toEqual([
			'cache.localIncidentRadianceTexture',
			'runtime.depth-texture',
			'runtime.scene-color-texture',
			'runtime.scene-hit-texture',
			'runtime.viewport-pixels',
		]);
	});

	it('fails loudly when the descriptor is not canonical or not flat', () => {
		const factory = new LocalFlatShaderContributionFactory();

		expect(() => factory.createContributions(createDescriptor(null, {
			spectralChannelCount: 14,
		}))).toThrowError(/canonical spectral channel count/);
		expect(() => factory.createContributions(createDescriptor(null, {
			geometry: {
				kind: 'spherical-earth-geometry',
			},
		}))).toThrowError(/flat Earth geometry/);
	});
});

/**
 * Create a complete shader descriptor.
 *
 * @param {object | null} [lightFacts] - Supplies optional light facts.
 * @param {object} [overrides] - Supplies descriptor overrides.
 * @returns {Algorithm32ShaderDescriptor} Return descriptor.
 */
function createDescriptor(lightFacts = null, overrides = {}) {
	const geometryFacts = overrides.geometry ?? {
		kind: 'flat-earth-geometry',
		observerPositionMeters: [0, 0, 2],
		sourcePositionMeters: [4800000, 0, 4800000],
		sourceSubpointMeters: [4800000, 0, 0],
		topAltitudeMeters: 100000,
		sceneSkyRayLimitMeters: 1926774,
		sourceTransmittanceIntervalCount: 12,
		cacheZBinsMeters: [2, 1000],
		cacheRhoBinsMeters: [0, 500000, 1250000],
		observerLocalSceneFrame: {
			up: [0, 0, 1],
			right: [1, 0, 0],
			forward: [0, -1, 0],
		},
	};
	const sourceFacts = lightFacts ?? {
		kind: 'local-sun-light-source',
		sourceKey: 'local-test',
		referenceDistanceMeters: 4800000,
		referenceSpectralIncidentScale: 1.25,
		radiusMeters: 25749.504,
		distanceFalloff: true,
	};

	return {
		descriptorId: 'descriptor',
		variantId: 'variant',
		fingerprint: 'descriptor',
		compatibilityTags: [],
		spectralBasis: createSection('basis', {
			channelCount: overrides.spectralChannelCount ?? 15,
		}),
		geometry: createSection('geometry', geometryFacts),
		atmosphere: createSection('atmosphere', {
			kind: 'canonical-atmosphere',
			constants: CANONICAL_ATMOSPHERE_CONSTANTS,
		}),
		lightSource: createSection('light-source', sourceFacts),
		cache: createSection('cache', {
			cacheKind: 'local',
			metadata: {
				zBinCount: 2,
				rhoBinCount: 3,
				directionCount: 9,
			},
		}),
		transport: createSection('transport', {
			execution: {
				pathIntervalCount: 24,
				sourceTransmittanceIntervalCount: 12,
			},
		}),
		color: createSection('color', {}),
		runtime: createSection('runtime', {}),
	};
}

/**
 * Create a descriptor section.
 *
 * @param {string} fingerprint - Supplies section fingerprint.
 * @param {unknown} facts - Supplies section facts.
 * @returns {ShaderDescriptorSection} Return section.
 */
function createSection(fingerprint, facts) {
	return {
		descriptorId: fingerprint,
		fingerprint,
		compatibilityTags: [fingerprint],
		facts,
	};
}
