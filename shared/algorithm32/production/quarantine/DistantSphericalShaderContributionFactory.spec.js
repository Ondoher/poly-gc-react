import { readFileSync } from 'node:fs';

import BrunetonColorDisplayModel from '../../color/BrunetonColorDisplayModel.js';
import { Algorithm32ShaderAssembler } from '../../shader/Algorithm32ShaderAssembler.js';
import { RuntimeShaderContributionFactory } from '../../shader/RuntimeShaderContributionFactory.js';
import DistantSunLightSource from '../DistantSunLightSource.js';
import DistantSphericalShaderContributionFactory from '../DistantSphericalShaderContributionFactory.js';
import {
	CANONICAL_ATMOSPHERE_CONSTANTS,
	CANONICAL_SPECTRAL_CHANNELS,
	RUNTIME_NUMERICAL_CONTROLS,
} from '../../constants/Algorithm32CanonicalData.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../DistantSphericalShaderContributionFactory.js', import.meta.url), 'utf8');
}

describe('DistantSphericalShaderContributionFactory', () => {
	it('keeps the distant spherical shader contribution factory documented', () => {
		const source = readSource();

		expect(source).toContain('export class DistantSphericalShaderContributionFactory');
		expect(source).toContain('mainRequiredSymbols()');
		expect(source).toContain('createContributions(descriptor)');
		expect(source).toContain('@returns {readonly ShaderContribution[]}');
	});

	it('declares the complete distant spherical shader symbol set', () => {
		const factory = new DistantSphericalShaderContributionFactory();

		expect(factory.mainRequiredSymbols()).toEqual([
			'runtime.initialState',
			'geometry.reconstructViewRay',
			'geometry.resolveAtmospherePath',
			'atmosphere.sampleMedium',
			'light.sampleDirectRadiance',
			'cache.lookupIncidentRadiance',
			'transport.evaluatePathRadiance',
			'color.composeSceneColor',
			'color.encodeOutput',
		]);
	});

	it('creates the POC-backed owner contributions for the distant spherical profile', () => {
		const factory = new DistantSphericalShaderContributionFactory();
		const contributions = factory.createContributions(createDescriptor());

		expect(contributions.map((contribution) => contribution.id)).toEqual([
			'geometry-spherical-earth',
			'atmosphere-canonical',
			'light-distant-sun',
			'cache-distant-l2-incident-radiance',
			'transport-algorithm32',
		]);
		expect(contributions[0].provides).toEqual([
			'geometry.reconstructViewRay',
			'geometry.resolveAtmospherePath',
			'geometry.cacheAccessCoordinate',
		]);
		expect(contributions[0].uniforms.find((uniform) => uniform.name === 'uInverseProjectionMatrix').defaultValue)
			.toEqual([
				1, 0, 0, 0,
				0, 1, 0, 0,
				0, 0, 1, 0,
				0, 0, 0, 1,
			]);
		expect(contributions[1].functions[0].code).toContain('ATMOSPHERE_RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0');
		expect(contributions[2].uniforms[0]).toEqual({
			name: 'uDistantSunDirection',
			type: 'vec3',
			valueKey: 'lightSource.direction',
			defaultValue: [0, 1, 0],
		});
		expect(contributions[2].functions[0].code).toContain('LIGHT_SOURCE_SOLAR_IRRADIANCE');
		expect(contributions[3].diagnostics.texture.dimensions).toEqual([
			RUNTIME_NUMERICAL_CONTROLS.incidentDirectionCount,
			RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
			4,
		]);
		expect(contributions[4].functions[0].code).toContain('TRANSPORT_PATH_INTERVAL_COUNT = 40');
		expect(contributions[4].functions[0].code).toContain('SOURCE_TRANSMITTANCE_INTERVAL_COUNT = 20');
	});

	it('lets the distant source model provide its light-source contribution', () => {
		const source = new DistantSunLightSource({
			directionToLight: [0, 1, 0],
			spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
			angularRadiusRadians: 0.004675,
		});
		const contribution = source.createShaderContribution({
			descriptor: createDescriptor(source.describe()),
		});

		expect(source.describe().incidentRadianceCachePolicy).toEqual(jasmine.objectContaining({
			altitudeBinCount: RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
			directionCount: RUNTIME_NUMERICAL_CONTROLS.incidentDirectionCount,
		}));
		expect(contribution.id).toBe('light-distant-sun');
		expect(contribution.owner).toBe('lightSource');
		expect(contribution.provides).toEqual(['light.sampleDirectRadiance', 'light.sourceDirection']);
	});

	it('assembles with runtime and Color contributions into a complete shader', () => {
		const descriptor = createDescriptor();
		const factory = new DistantSphericalShaderContributionFactory();
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
			'cache.incidentRadianceTexture',
			'runtime.depth-texture',
			'runtime.scene-color-texture',
			'runtime.scene-hit-texture',
			'runtime.viewport-pixels',
		]);
	});

	it('fails loudly when the descriptor is not canonical or not spherical', () => {
		const factory = new DistantSphericalShaderContributionFactory();

		expect(() => factory.createContributions(createDescriptor(null, {
			spectralChannelCount: 14,
		}))).toThrowError(/canonical spectral channel count/);
		expect(() => factory.createContributions(createDescriptor(null, {
			geometry: {
				kind: 'flat-earth-geometry',
			},
		}))).toThrowError(/spherical Earth geometry/);
	});
});

/**
 * Create a complete shader descriptor.
 *
 * @param {object | null} [lightFacts] - Supplies optional light facts.
 * @param {object} [overrides] - Supplies descriptor section overrides.
 * @returns {Algorithm32ShaderDescriptor} Return descriptor.
 */
function createDescriptor(lightFacts = null, overrides = {}) {
	const geometryFacts = overrides.geometry ?? {
		kind: 'spherical-earth-geometry',
		bottomRadiusMeters: 6360000,
		topRadiusMeters: 6420000,
		observerHeightMeters: 2,
		cacheAltitudeBinCount: 48,
		cacheBoundaryAltitudeMeters: 2,
		sourceTransmittanceIntervalCount: 20,
		observerLocalSceneFrame: {
			up: [1, 0, 0],
			right: [0, 1, 0],
			forward: [0, 0, -1],
		},
	};
	const sourceFacts = lightFacts ?? {
		kind: 'distant-sun-light-source',
		directionToLight: [0, 1, 0],
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
			cacheKind: 'distant',
			metadata: {
				altitudeBinCount: 48,
				directionCount: 34,
			},
		}),
		transport: createSection('transport', {
			execution: {
				pathIntervalCount: 40,
				sourceTransmittanceIntervalCount: 20,
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
