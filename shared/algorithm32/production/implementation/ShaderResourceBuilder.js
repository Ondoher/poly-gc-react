/**
 * Prepare runtime shader resources from owner-supplied payload descriptors.
 */
export class ShaderResourceBuilder {
	/**
	 * Create a Three 3D texture from a cache-owned shader payload.
	 *
	 * @param {ShaderCacheTextureResourceRequest} request - Supplies texture setup.
	 * @returns {ShaderTextureResource} Return the prepared texture resource.
	 */
	createCacheTexture(request) {
		this._assertCacheTextureRequest(request);

		const texturePayload = normalizeCacheTexturePayload(request.payload);
		const THREE = request.THREE;
		const data = new Float32Array(texturePayload.rgbaFloat32);
		const expectedValueCount = texturePayload.width * texturePayload.height * texturePayload.depth * 4;

		if (data.length !== expectedValueCount) {
			throw new RangeError(`Cache texture payload ${texturePayload.textureId} has ${data.length} values; expected ${expectedValueCount}.`);
		}

		// Source: Three Data3DTexture constructor and upload fields [5].
		const texture = new THREE.Data3DTexture(
			data,
			texturePayload.width,
			texturePayload.height,
			texturePayload.depth,
		);
		const selectedFilter = texturePayload.samplerPolicy === 'linear-clamp'
			? THREE.LinearFilter
			: THREE.NearestFilter;
		let disposed = false;

		texture.format = THREE.RGBAFormat;
		texture.type = THREE.FloatType;
		texture.minFilter = selectedFilter;
		texture.magFilter = selectedFilter;
		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;
		texture.wrapR = THREE.ClampToEdgeWrapping;
		texture.generateMipmaps = false;
		texture.unpackAlignment = 1;
		texture.needsUpdate = true;

		return Object.freeze({
			textureId: texturePayload.textureId,
			valueKey: request.valueKey,
			texture,
			dispose: () => {
				if (disposed) {
					return;
				}

				disposed = true;
				texture.dispose?.();
			},
			diagnostics: Object.freeze({
				dimensionality: texturePayload.dimensionality,
				width: texturePayload.width,
				height: texturePayload.height,
				depth: texturePayload.depth,
				format: texturePayload.format,
				samplerPolicy: texturePayload.samplerPolicy,
				uploadValueCount: data.length,
			}),
		});
	}

	/**
	 * Assert that a cache texture request can be materialized.
	 *
	 * @param {ShaderCacheTextureResourceRequest} request - Supplies the request.
	 * @returns {void}
	 */
	_assertCacheTextureRequest(request) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Shader cache texture resource request is required.');
		}

		if (!request.valueKey) {
			throw new TypeError('Shader cache texture resource request requires valueKey.');
		}

		if (typeof request.THREE?.Data3DTexture !== 'function') {
			throw new TypeError('Shader cache texture resource request requires THREE.Data3DTexture.');
		}

		for (const fieldName of ['RGBAFormat', 'FloatType', 'NearestFilter', 'ClampToEdgeWrapping']) {
			if (!request.THREE[fieldName]) {
				throw new TypeError(`Shader cache texture resource request requires THREE.${fieldName}.`);
			}
		}

		normalizeCacheTexturePayload(request.payload);
	}
}

/**
 * Return a texture payload whether the caller supplied the descriptor or the texture directly.
 *
 * @param {CacheShaderPayloadDescriptor | CacheShaderTexturePayload} payload - Supplies cache payload data.
 * @returns {CacheShaderTexturePayload} Return the texture payload.
 */
function normalizeCacheTexturePayload(payload) {
	const texturePayload = payload?.texture ?? payload;

	if (!texturePayload || typeof texturePayload !== 'object') {
		throw new TypeError('Cache texture payload is required.');
	}

	for (const fieldName of ['textureId', 'width', 'height', 'depth', 'dimensionality', 'format', 'samplerPolicy', 'rgbaFloat32']) {
		if (!texturePayload[fieldName]) {
			throw new TypeError(`Cache texture payload requires ${fieldName}.`);
		}
	}

	if (texturePayload.dimensionality !== '3d') {
		throw new TypeError('Cache texture payload must be three-dimensional.');
	}

	if (!Array.isArray(texturePayload.rgbaFloat32) && !ArrayBuffer.isView(texturePayload.rgbaFloat32)) {
		throw new TypeError('Cache texture payload requires Float32-compatible RGBA values.');
	}

	return texturePayload;
}

export default ShaderResourceBuilder;
