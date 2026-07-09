import { readFileSync } from 'node:fs';

import { TextureBuilder } from '../TextureBuilder.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../TextureBuilder.js', import.meta.url), 'utf8');
}

/**
 * Create a texture request.
 *
 * @param {Partial<ShaderTextureBuildRequest>} [overrides] - Supplies overrides.
 * @returns {ShaderTextureBuildRequest} Return request.
 */
function createRequest(overrides = {}) {
	return {
		textureId: 'incident-radiance',
		owner: 'cache',
		dimensionality: '3d',
		dimensions: [4, 5, 6],
		formatPreference: ['rgba32f', 'float32'],
		samplerPolicy: {
			minFilter: 'linear',
			magFilter: 'linear',
			wrap: 'clamp',
		},
		valueKey: 'incidentRadianceTexture',
		accessFunctionName: 'readIncidentRadiance',
		...overrides,
	};
}

describe('TextureBuilder', () => {
	it('keeps the texture builder documented', () => {
		const source = readSource();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class TextureBuilder');
		expect(source).toContain('createTexture(request)');
		expect(source).toContain('@returns {ShaderTextureBuildResult}');
	});

	it('creates a three-dimensional sampler descriptor and access helper', () => {
		const builder = new TextureBuilder();
		const result = builder.createTexture(createRequest());

		expect(result).toEqual(jasmine.objectContaining({
			textureId: 'incident-radiance',
			owner: 'cache',
			dimensionality: '3d',
			dimensions: [4, 5, 6],
			selectedFormat: 'rgba32f',
			valueKey: 'incidentRadianceTexture',
			accessFunctionName: 'readIncidentRadiance',
		}));
		expect(result.accessFunctionBlock).toContain('sampler3D sourceTexture');
		expect(result.accessFunctionBlock).toContain('clamp(coordinate, vec3(0.0), vec3(1.0))');
	});

	it('creates one-dimensional access through a two-dimensional sampler row', () => {
		const builder = new TextureBuilder();
		const result = builder.createTexture(createRequest({
			dimensionality: '1d',
			dimensions: [8],
			formatPreference: [],
			accessFunctionName: 'readBasis',
		}));

		expect(result.selectedFormat).toBe('float32');
		expect(result.accessFunctionBlock).toContain('sampler2D sourceTexture, float coordinate');
		expect(result.accessFunctionBlock).toContain('vec2(clamp(coordinate, 0.0, 1.0), 0.5)');
	});

	it('fails loudly when required request fields are missing', () => {
		const builder = new TextureBuilder();

		expect(() => builder.createTexture({
			...createRequest(),
			textureId: '',
		})).toThrowError(/textureId/);
	});
});
