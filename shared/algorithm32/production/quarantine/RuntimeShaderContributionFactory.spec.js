import { readFileSync } from 'node:fs';

import { RuntimeShaderContributionFactory } from '../RuntimeShaderContributionFactory.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../RuntimeShaderContributionFactory.js', import.meta.url), 'utf8');
}

/**
 * Create a descriptor for runtime contribution specs.
 *
 * @returns {Algorithm32ShaderDescriptor} Return descriptor.
 */
function createDescriptor() {
	return {
		descriptorId: 'descriptor',
		variantId: 'variant',
		fingerprint: 'descriptor',
		compatibilityTags: [],
		spectralBasis: createSection('basis', {
			channelCount: 3,
		}),
		geometry: createSection('geometry', {}),
		atmosphere: createSection('atmosphere', {}),
		lightSource: createSection('light-source', {}),
		cache: createSection('cache', {}),
		transport: createSection('transport', {}),
		color: createSection('color', {}),
		runtime: createSection('runtime', {}),
	};
}

/**
 * Create one descriptor section.
 *
 * @param {string} fingerprint - Supplies the fingerprint.
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

describe('RuntimeShaderContributionFactory', () => {
	it('keeps the runtime contribution factory documented', () => {
		const source = readSource();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class RuntimeShaderContributionFactory');
		expect(source).toContain('createContribution(descriptor)');
		expect(source).toContain('@returns {ShaderContribution}');
	});

	it('creates the shared runtime state and texture binding contribution', () => {
		const factory = new RuntimeShaderContributionFactory();
		const contribution = factory.createContribution(createDescriptor());

		expect(contribution).toEqual(jasmine.objectContaining({
			id: 'runtime-three-single-camera',
			owner: 'runtime',
			descriptorFingerprint: 'runtime',
		}));
		expect(contribution.provides).toContain('runtime.initialState');
		expect(contribution.provides).toContain('createInitialShaderState');
		expect(contribution.textures.map((texture) => texture.name)).toEqual([
			'uSceneColorTexture',
			'uSceneDepthTexture',
			'uSceneHitTexture',
		]);
		expect(contribution.uniforms.map((uniform) => uniform.name)).toEqual(['uViewportPixels']);
		expect(contribution.functions.map((block) => block.id)).toEqual([
			'runtime-types',
			'runtime-initial-state',
		]);
		expect(contribution.functions[0].code).toContain('const int SPECTRAL_CHANNEL_COUNT = 3;');
		expect(contribution.functions[1].code).toContain('ShaderState createInitialShaderState(vec2 uv)');
	});
});
