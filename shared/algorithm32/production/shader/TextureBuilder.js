/**
 * Build shader texture descriptors and GLSL access helpers.
 */
export class TextureBuilder {
	/**
	 * Create one shader texture descriptor from an owner-supplied request.
	 *
	 * @param {ShaderTextureBuildRequest} request - Supplies the texture request.
	 * @returns {ShaderTextureBuildResult} Return the texture/access descriptor.
	 */
	createTexture(request) {
		this._assertTextureRequest(request);

		const selectedFormat = request.formatPreference[0] ?? 'float32';
		const samplerType = request.dimensionality === '3d'
			? 'sampler3D'
			: 'sampler2D';
		const coordinateType = request.dimensionality === '3d'
			? 'vec3'
			: request.dimensionality === '2d'
				? 'vec2'
				: 'float';

		return Object.freeze({
			textureId: request.textureId,
			owner: request.owner,
			dimensionality: request.dimensionality,
			dimensions: Object.freeze([...request.dimensions]),
			selectedFormat,
			samplerPolicy: request.samplerPolicy,
			valueKey: request.valueKey,
			accessFunctionName: request.accessFunctionName,
			accessFunctionBlock: `vec3 ${request.accessFunctionName}(${samplerType} sourceTexture, ${coordinateType} coordinate) {
	${sampleTextureLine(request.dimensionality, 'sourceTexture', 'coordinate')}
}`,
			diagnostics: Object.freeze({
				note: 'Owner-supplied texture request; runtime materialization consumes matching upload payloads.',
			}),
		});
	}

	/**
	 * Assert that a texture request has the fields needed for shader access.
	 *
	 * @param {ShaderTextureBuildRequest} request - Supplies the request.
	 * @returns {void}
	 */
	_assertTextureRequest(request) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Shader texture request is required.');
		}

		for (const fieldName of ['textureId', 'owner', 'dimensionality', 'valueKey', 'accessFunctionName']) {
			if (!request[fieldName]) {
				throw new TypeError(`Shader texture request requires ${fieldName}.`);
			}
		}

		if (!Array.isArray(request.dimensions) || request.dimensions.length === 0) {
			throw new TypeError('Shader texture request requires dimensions.');
		}

		if (!Array.isArray(request.formatPreference)) {
			throw new TypeError('Shader texture request requires formatPreference.');
		}
	}
}

/**
 * Create the GLSL read line for one dimensionality.
 *
 * @param {ShaderTextureDimensionality} dimensionality - Supplies the texture dimensionality.
 * @param {string} textureName - Supplies the GLSL texture variable.
 * @param {string} coordinateName - Supplies the GLSL coordinate variable.
 * @returns {string} Return the GLSL read line.
 */
function sampleTextureLine(dimensionality, textureName, coordinateName) {
	if (dimensionality === '3d') {
		return `return texture(${textureName}, clamp(${coordinateName}, vec3(0.0), vec3(1.0))).rgb;`;
	}

	if (dimensionality === '2d') {
		return `return texture(${textureName}, clamp(${coordinateName}, vec2(0.0), vec2(1.0))).rgb;`;
	}

	return `return texture(${textureName}, vec2(clamp(${coordinateName}, 0.0, 1.0), 0.5)).rgb;`;
}

export default TextureBuilder;
