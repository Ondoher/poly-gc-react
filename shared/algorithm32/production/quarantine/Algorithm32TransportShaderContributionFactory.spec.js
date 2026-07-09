import { readFileSync } from 'node:fs';

import { Algorithm32TransportShaderContributionFactory } from '../Algorithm32TransportShaderContributionFactory.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../Algorithm32TransportShaderContributionFactory.js', import.meta.url), 'utf8');
}

describe('Algorithm32TransportShaderContributionFactory', () => {
	it('keeps the core transport contribution factory documented', () => {
		const source = readSource();

		expect(source).toContain('export class Algorithm32TransportShaderContributionFactory');
		expect(source).toContain('mainRequiredSymbols()');
		expect(source).toContain('createShaderContribution(request)');
	});

	it('declares the complete Algorithm32 shader symbol set', () => {
		const factory = new Algorithm32TransportShaderContributionFactory();

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

	it('selects spherical or flat transport from the active descriptor geometry', () => {
		const factory = new Algorithm32TransportShaderContributionFactory();
		const spherical = factory.createShaderContribution({
			descriptor: createDescriptor('spherical-earth-geometry'),
		});
		const flat = factory.createShaderContribution({
			descriptor: createDescriptor('flat-earth-geometry'),
		});

		expect(spherical.id).toBe('transport-algorithm32');
		expect(spherical.owner).toBe('transport');
		expect(flat.id).toBe('transport-algorithm32-local-flat');
		expect(flat.owner).toBe('transport');
	});

	it('fails loudly for unsupported geometry kinds', () => {
		const factory = new Algorithm32TransportShaderContributionFactory();

		expect(() => factory.createShaderContribution({
			descriptor: createDescriptor('other-geometry'),
		})).toThrowError(/does not support geometry kind other-geometry/);
	});
});

function createDescriptor(geometryKind) {
	return {
		descriptorId: 'descriptor',
		variantId: 'variant',
		fingerprint: 'descriptor',
		compatibilityTags: [],
		spectralBasis: createSection('basis', {
			channelCount: 15,
		}),
		geometry: createSection('geometry', {
			kind: geometryKind,
			sourceTransmittanceIntervalCount: 12,
		}),
		atmosphere: createSection('atmosphere', {}),
		lightSource: createSection('light-source', {}),
		cache: createSection('cache', {}),
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

function createSection(fingerprint, facts) {
	return {
		descriptorId: fingerprint,
		fingerprint,
		compatibilityTags: [fingerprint],
		facts,
	};
}
