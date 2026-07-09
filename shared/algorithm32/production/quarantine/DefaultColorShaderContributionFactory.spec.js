import { readFileSync } from 'node:fs';

import { DefaultColorShaderContributionFactory } from '../DefaultColorShaderContributionFactory.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../DefaultColorShaderContributionFactory.js', import.meta.url), 'utf8');
}

/**
 * Create a descriptor for color contribution specs.
 *
 * @returns {Algorithm32ShaderDescriptor} Return descriptor.
 */
function createDescriptor() {
	return {
		color: {
			descriptorId: 'color',
			fingerprint: 'color',
			compatibilityTags: ['display-color'],
			facts: {},
		},
	};
}

describe('DefaultColorShaderContributionFactory', () => {
	it('keeps the default color contribution factory documented', () => {
		const source = readSource();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class DefaultColorShaderContributionFactory');
		expect(source).toContain('createContribution(descriptor)');
		expect(source).toContain('@returns {ShaderContribution}');
	});

	it('creates scene-preserving output hooks', () => {
		const factory = new DefaultColorShaderContributionFactory();
		const contribution = factory.createContribution(createDescriptor());

		expect(contribution).toEqual(jasmine.objectContaining({
			id: 'color-default-scene-preserving-output',
			owner: 'color',
			descriptorFingerprint: 'color',
		}));
		expect(contribution.provides).toEqual(['color.composeSceneColor', 'color.encodeOutput']);
		expect(contribution.requires).toEqual(['runtime.initialState']);
		expect(contribution.mainHooks.map((block) => block.slot)).toEqual(['composeSceneColor', 'encodeOutput']);
		expect(contribution.mainHooks[1].code).toBe('outColor = state.outputRgba;');
	});
});
