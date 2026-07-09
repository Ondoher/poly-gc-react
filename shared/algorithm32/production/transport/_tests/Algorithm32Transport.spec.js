import { readFileSync } from 'node:fs';

import { Algorithm32Transport } from '../Algorithm32Transport.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../Algorithm32Transport.js', import.meta.url), 'utf8');
}

describe('Algorithm32Transport', () => {
	it('keeps the core transport implementation documented', () => {
		const source = readSource();

		expect(source).toContain('export class Algorithm32Transport');
		expect(source).toContain('mainRequiredShaderSymbols()');
		expect(source).toContain('createShaderContribution(request)');
	});

	it('declares the complete Algorithm32 shader symbol set', () => {
		const transport = new Algorithm32Transport();

		expect(transport.mainRequiredShaderSymbols()).toEqual([
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
		const transport = new Algorithm32Transport();
		const spherical = transport.createShaderContribution({
			descriptor: createDescriptor('spherical-earth-geometry'),
		});
		const flat = transport.createShaderContribution({
			descriptor: createDescriptor('flat-earth-geometry'),
		});

		expect(spherical.id).toBe('transport-algorithm32');
		expect(spherical.owner).toBe('transport');
		expect(flat.id).toBe('transport-algorithm32-local-flat');
		expect(flat.owner).toBe('transport');
	});

	it('fails loudly for unsupported geometry kinds', () => {
		const transport = new Algorithm32Transport();

		expect(() => transport.createShaderContribution({
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
