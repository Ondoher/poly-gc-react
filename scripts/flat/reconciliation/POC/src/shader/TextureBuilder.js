// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, cache-owned texture builder.

export default class TextureBuilder {
    /**
     * @param {ShaderTextureBuildRequest} request - Cache-owned texture request.
     * @returns {ShaderTextureBuildResult} Texture/access descriptor for shader assembly.
     */
    createTexture(request) {
        const selectedFormat = request.formatPreference[0] ?? 'float32';
        const samplerType = request.dimensionality === '3d'
            ? 'sampler3D'
            : request.dimensionality === '2d'
                ? 'sampler2D'
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
                note: 'Cache-owned texture request; browser materialization consumes matching upload payloads.',
            }),
        });
    }
}

function sampleTextureLine(dimensionality, textureName, coordinateName) {
    if (dimensionality === '3d') {
        return `return texture(${textureName}, clamp(${coordinateName}, vec3(0.0), vec3(1.0))).rgb;`;
    }

    if (dimensionality === '2d') {
        return `return texture(${textureName}, clamp(${coordinateName}, vec2(0.0), vec2(1.0))).rgb;`;
    }

    return `return texture(${textureName}, vec2(clamp(${coordinateName}, 0.0, 1.0), 0.5)).rgb;`;
}
