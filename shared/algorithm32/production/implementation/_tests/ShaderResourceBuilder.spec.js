import { readFileSync } from 'node:fs';

import { ShaderResourceBuilder } from '../ShaderResourceBuilder.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../ShaderResourceBuilder.js', import.meta.url), 'utf8');
}

/**
 * Create a fake Three namespace with texture constants.
 *
 * @returns {object} Return fake Three namespace.
 */
function createThreeDouble() {
	return {
		RGBAFormat: 'RGBAFormat',
		FloatType: 'FloatType',
		NearestFilter: 'NearestFilter',
		LinearFilter: 'LinearFilter',
		ClampToEdgeWrapping: 'ClampToEdgeWrapping',
		Data3DTexture: class Data3DTexture {
			constructor(data, width, height, depth) {
				this.image = {
					data,
					width,
					height,
					depth,
				};
				this.disposed = false;
			}

			dispose() {
				this.disposed = true;
			}
		},
	};
}

/**
 * Create a cache texture payload descriptor.
 *
 * @param {object} [overrides] - Supplies overrides.
 * @returns {CacheShaderPayloadDescriptor} Return payload descriptor.
 */
function createPayload(overrides = {}) {
	const { texture: textureOverrides = {}, ...payloadOverrides } = overrides;

	return {
		payloadKind: 'test-cache',
		dimensions: [2, 1, 1],
		format: 'float32-spectral',
		texture: {
			kind: 'rgba32f-3d-texture-v1',
			textureId: 'test-cache-texture',
			width: 2,
			height: 1,
			depth: 1,
			dimensionality: '3d',
			format: 'rgba32f',
			samplerPolicy: 'nearest-clamp',
			coordinateOrder: ['x', 'y', 'z'],
			spectralGroupSize: 4,
			spectralGroupCount: 1,
			spectralChannelCount: 3,
			rgbaFloat32: [1, 2, 3, 0, 4, 5, 6, 0],
			...textureOverrides,
		},
		...payloadOverrides,
	};
}

describe('ShaderResourceBuilder', () => {
	it('keeps the shader resource builder documented', () => {
		const source = readSource();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class ShaderResourceBuilder');
		expect(source).toContain('createCacheTexture(request)');
		expect(source).toContain('@returns {ShaderTextureResource}');
		expect(source).toContain('[5]');
	});

	it('creates a disposable Three Data3DTexture from a cache payload', () => {
		const builder = new ShaderResourceBuilder();
		const result = builder.createCacheTexture({
			THREE: createThreeDouble(),
			valueKey: 'incidentRadianceTexture',
			payload: createPayload(),
		});

		expect(result.textureId).toBe('test-cache-texture');
		expect(result.valueKey).toBe('incidentRadianceTexture');
		expect(result.texture.image.width).toBe(2);
		expect(result.texture.image.height).toBe(1);
		expect(result.texture.image.depth).toBe(1);
		expect(Array.from(result.texture.image.data)).toEqual([1, 2, 3, 0, 4, 5, 6, 0]);
		expect(result.texture.format).toBe('RGBAFormat');
		expect(result.texture.type).toBe('FloatType');
		expect(result.texture.minFilter).toBe('NearestFilter');
		expect(result.texture.wrapR).toBe('ClampToEdgeWrapping');
		expect(result.texture.needsUpdate).toBe(true);

		result.dispose();
		result.dispose();

		expect(result.texture.disposed).toBe(true);
	});

	it('supports linear-clamp sampler policy when requested by payload metadata', () => {
		const builder = new ShaderResourceBuilder();
		const result = builder.createCacheTexture({
			THREE: createThreeDouble(),
			valueKey: 'incidentRadianceTexture',
			payload: createPayload({
				texture: {
					samplerPolicy: 'linear-clamp',
				},
			}),
		});

		expect(result.texture.minFilter).toBe('LinearFilter');
		expect(result.texture.magFilter).toBe('LinearFilter');
	});

	it('fails loudly when payload value count does not match dimensions', () => {
		const builder = new ShaderResourceBuilder();

		expect(() => builder.createCacheTexture({
			THREE: createThreeDouble(),
			valueKey: 'incidentRadianceTexture',
			payload: createPayload({
				texture: {
					rgbaFloat32: [1, 2, 3, 4],
				},
			}),
		})).toThrowError(/expected 8/);
	});
});
