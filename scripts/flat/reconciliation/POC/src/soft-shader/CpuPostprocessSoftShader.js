// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.1.2.
// - agents/topics/apps/flat/reconciliation/shader-design.md, CPU postprocess shader contract.
// - tmp/atmosphere/reconciliation/051-m3-soft-shader-scene-input-contract.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import SoftShaderSceneInputAdapter from './SoftShaderSceneInputAdapter.js';

const CAPTURED_SCENE_ENDPOINT_POLICY =
    'captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy';

export default class CpuPostprocessSoftShader {
    /**
     * @param {CpuPostprocessSoftShaderConfig} configuration - Soft-shader collaborators.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new ReconciliationConfigurationError('CPU postprocess soft-shader configuration is required.', {
                code: 'MISSING_CPU_SOFT_SHADER_CONFIGURATION',
            });
        }

        if (!configuration.evaluator || typeof configuration.evaluator.evaluate !== 'function') {
            throw new ReconciliationConfigurationError('CPU soft-shader requires a public evaluator with evaluate(...).', {
                code: 'MISSING_CPU_SOFT_SHADER_EVALUATOR',
            });
        }

        const displayAdapter = configuration.displayAdapter ?? new BrunetonColorDisplayModel();
        if (typeof displayAdapter.radianceToDisplayRgb !== 'function') {
            throw new ReconciliationConfigurationError('CPU soft-shader display adapter must expose radianceToDisplayRgb(...).', {
                code: 'MISSING_CPU_SOFT_SHADER_DISPLAY_ADAPTER',
            });
        }

        this._configuration = Object.freeze({
            evaluator: configuration.evaluator,
            sceneInputAdapter: configuration.sceneInputAdapter ?? new SoftShaderSceneInputAdapter(),
            displayAdapter,
            endpointRadianceResolver: configuration.endpointRadianceResolver ?? null,
        });
    }

    /**
     * @param {CpuPostprocessSoftShaderRequest} request - CPU postprocess request.
     * @returns {CpuPostprocessSoftShaderOutput} CPU soft-shader output.
     */
    render(request) {
        if (!request || typeof request !== 'object') {
            throw new ReconciliationConfigurationError('CPU soft-shader render request is required.', {
                code: 'MISSING_CPU_SOFT_SHADER_RENDER_REQUEST',
            });
        }

        if (!request.sceneInput || typeof request.sceneInput.sceneId !== 'string') {
            throw new ReconciliationConfigurationError('CPU soft-shader request requires sceneInput.sceneId.', {
                code: 'MISSING_CPU_SOFT_SHADER_SCENE_INPUT',
            });
        }

        if (!Array.isArray(request.pixels)) {
            throw new ReconciliationConfigurationError('CPU soft-shader request pixels must be an array.', {
                code: 'INVALID_CPU_SOFT_SHADER_PIXELS',
            });
        }

        const pixels = request.pixels.map((pixelInput) => this._renderPixel(pixelInput));
        const aggregateDiagnostics = this._summarizePixels(pixels);

        return Object.freeze({
            outputKind: 'cpu-postprocess-soft-shader',
            sceneId: request.sceneInput.sceneId,
            pixels: Object.freeze(pixels),
            aggregateDiagnostics,
            controlledRegions: Object.freeze([]),
            diagnostics: Object.freeze([]),
        });
    }

    /**
     * @param {SoftShaderScenePixelInput} pixelInput - Scene pixel input.
     * @returns {SoftShaderPixelOutput} Rendered pixel output.
     */
    _renderPixel(pixelInput) {
        const prepared = this._configuration.sceneInputAdapter.preparePixel(pixelInput);
        const evaluationOutput = this._configuration.evaluator.evaluate(prepared.evaluationRequest);

        if (prepared.endpointContribution?.policy === CAPTURED_SCENE_ENDPOINT_POLICY) {
            return this._renderCapturedSceneEndpointProxyPixel(prepared, evaluationOutput);
        }

        const endpointRadiance = this._resolveEndpointRadiance(prepared.endpointContribution, evaluationOutput);
        const finalSpectralRadiance = composeFinalSpectralRadiance(
            evaluationOutput.pathRadiance.inScattered,
            evaluationOutput.pathRadiance.transmittance,
            endpointRadiance,
        );
        const displayRgb = this._configuration.displayAdapter.radianceToDisplayRgb(finalSpectralRadiance);

        return Object.freeze({
            pixelId: prepared.pixelId,
            coordinate: prepared.coordinate,
            sceneIntersectionKind: prepared.sceneIntersectionKind,
            endpointPolicy: prepared.endpointContribution?.policy ?? 'none',
            evaluationOutput,
            endpointRadiance,
            finalSpectralRadiance,
            displayComposition: Object.freeze({ kind: 'spectral-radiance' }),
            displayRgb,
            displayRgba: Object.freeze([displayRgb[0], displayRgb[1], displayRgb[2], 1]),
            diagnostics: prepared.diagnostics,
        });
    }

    /**
     * @param {SoftShaderPreparedPixel} prepared - Prepared pixel request.
     * @param {SpectralEvaluationOutput} evaluationOutput - Spectral transport output.
     * @returns {SoftShaderPixelOutput} Display-composed hit color output.
     */
    _renderCapturedSceneEndpointProxyPixel(prepared, evaluationOutput) {
        const composition = composeCapturedSceneEndpointProxy({
            endpointContribution: prepared.endpointContribution,
            pathRadiance: evaluationOutput.pathRadiance.inScattered,
            viewTransmittance: evaluationOutput.pathRadiance.transmittance,
            displayAdapter: this._configuration.displayAdapter,
        });
        const displayRgb = composition.displayRgb;

        return Object.freeze({
            pixelId: prepared.pixelId,
            coordinate: prepared.coordinate,
            sceneIntersectionKind: prepared.sceneIntersectionKind,
            endpointPolicy: prepared.endpointContribution?.policy ?? 'none',
            evaluationOutput,
            endpointRadiance: null,
            finalSpectralRadiance: null,
            displayComposition: Object.freeze({
                kind: 'captured-scene-endpoint-proxy',
                skyLinearSrgb: composition.skyLinearSrgb,
                transmittanceRgb: composition.transmittanceRgb,
                endpointLinearSrgb: composition.endpointLinearSrgb,
                finalLinearSrgb: composition.finalLinearSrgb,
            }),
            displayRgb,
            displayRgba: Object.freeze([displayRgb[0], displayRgb[1], displayRgb[2], 1]),
            diagnostics: prepared.diagnostics,
        });
    }

    /**
     * @param {SoftShaderEndpointContribution | null} endpointContribution - Endpoint contribution data.
     * @param {SpectralEvaluationOutput} evaluationOutput - Spectral evaluation output.
     * @returns {SpectralValue | null} Endpoint radiance, or null for sky/no-hit output.
     */
    _resolveEndpointRadiance(endpointContribution, evaluationOutput) {
        if (!endpointContribution || endpointContribution.policy === 'none') {
            return null;
        }

        if (endpointContribution.policy === CAPTURED_SCENE_ENDPOINT_POLICY) {
            return null;
        }

        if (endpointContribution.policy === 'precomputed-spectral-radiance') {
            if (!isSpectralValue(endpointContribution.endpointRadiance)) {
                throw new ReconciliationConfigurationError('Precomputed endpoint radiance must be a spectral value.', {
                    code: 'INVALID_PRECOMPUTED_ENDPOINT_RADIANCE',
                    details: { endpointContribution },
                });
            }

            return Object.freeze([...endpointContribution.endpointRadiance]);
        }

        if (
            endpointContribution.policy === 'spectrum-id-reference-radiance'
            || endpointContribution.policy === 'matte-lambertian-linear-srgb'
        ) {
            if (typeof this._configuration.endpointRadianceResolver !== 'function') {
                throw new ReconciliationConfigurationError('Endpoint radiance policy requires endpointRadianceResolver.', {
                    code: 'MISSING_ENDPOINT_RADIANCE_RESOLVER',
                    details: {
                        policy: endpointContribution.policy,
                        spectralReferenceId: endpointContribution.spectralReferenceId ?? null,
                    },
                });
            }

            const endpointRadiance = this._configuration.endpointRadianceResolver(endpointContribution);
            if (!isSpectralValue(endpointRadiance)) {
                throw new ReconciliationConfigurationError('Endpoint radiance resolver must return a spectral value.', {
                    code: 'INVALID_RESOLVED_ENDPOINT_RADIANCE',
                    details: { spectralReferenceId: endpointContribution.spectralReferenceId ?? null },
                });
            }

            return Object.freeze([...endpointRadiance]);
        }

        throw new ReconciliationConfigurationError('Unsupported endpoint contribution policy.', {
            code: 'UNSUPPORTED_ENDPOINT_CONTRIBUTION_POLICY',
            details: {
                policy: endpointContribution.policy,
                evaluationOutputKind: evaluationOutput.outputKind,
            },
        });
    }

    /**
     * @param {readonly SoftShaderPixelOutput[]} pixels - Rendered pixel outputs.
     * @returns {SoftShaderAggregateDiagnostics} Aggregate diagnostics.
     */
    _summarizePixels(pixels) {
        const warningCount = pixels.reduce(
            (count, pixel) => count + pixel.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length,
            0,
        );
        const errorCount = pixels.reduce(
            (count, pixel) => count + pixel.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length,
            0,
        );

        return Object.freeze({
            selectedPixelCount: pixels.length,
            validPixelCount: pixels.filter((pixel) => pixel.sceneIntersectionKind !== 'invalid').length,
            invalidPixelCount: pixels.filter((pixel) => pixel.sceneIntersectionKind === 'invalid').length,
            hitPixelCount: pixels.filter((pixel) => pixel.sceneIntersectionKind === 'hit').length,
            noHitPixelCount: pixels.filter((pixel) => pixel.sceneIntersectionKind === 'no-hit').length,
            warningCount,
            errorCount,
        });
    }
}

/**
 * @param {SpectralValue} pathRadiance - Path-added spectral radiance.
 * @param {SpectralValue} viewTransmittance - View-path spectral transmittance.
 * @param {SpectralValue | null} endpointRadiance - Endpoint spectral radiance.
 * @returns {SpectralValue} Final spectral radiance.
 */
function composeFinalSpectralRadiance(pathRadiance, viewTransmittance, endpointRadiance) {
    if (!isSpectralValue(pathRadiance) || !isSpectralValue(viewTransmittance)) {
        throw new ReconciliationConfigurationError('Path radiance and transmittance must be spectral values.', {
            code: 'INVALID_SOFT_SHADER_PATH_RADIANCE',
        });
    }

    if (endpointRadiance == null) {
        return Object.freeze([...pathRadiance]);
    }

    if (!isSpectralValue(endpointRadiance) || endpointRadiance.length !== pathRadiance.length) {
        throw new ReconciliationConfigurationError('Endpoint radiance must align to path radiance channels.', {
            code: 'ENDPOINT_RADIANCE_CHANNEL_MISMATCH',
            details: {
                endpointChannelCount: endpointRadiance?.length ?? null,
                pathChannelCount: pathRadiance.length,
            },
        });
    }

    if (viewTransmittance.length !== pathRadiance.length) {
        throw new ReconciliationConfigurationError('View transmittance must align to path radiance channels.', {
            code: 'VIEW_TRANSMITTANCE_CHANNEL_MISMATCH',
            details: {
                transmittanceChannelCount: viewTransmittance.length,
                pathChannelCount: pathRadiance.length,
            },
        });
    }

    return Object.freeze(pathRadiance.map((value, index) =>
        value + endpointRadiance[index] * viewTransmittance[index]));
}

/**
 * @param {{
 *   readonly endpointContribution: SoftShaderEndpointContribution,
 *   readonly pathRadiance: SpectralValue,
 *   readonly viewTransmittance: SpectralValue,
 *   readonly displayAdapter: ColorDisplayModel
 * }} request - Captured endpoint composition request.
 * @returns {{
 *   readonly skyLinearSrgb: readonly [number, number, number],
 *   readonly transmittanceRgb: readonly [number, number, number],
 *   readonly endpointLinearSrgb: readonly [number, number, number],
 *   readonly finalLinearSrgb: readonly [number, number, number],
 *   readonly displayRgb: readonly [number, number, number]
 * }} Display-domain composition diagnostics and output.
 */
function composeCapturedSceneEndpointProxy(request) {
    const {
        endpointContribution,
        pathRadiance,
        viewTransmittance,
        displayAdapter,
    } = request;

    if (!isSpectralValue(pathRadiance) || !isSpectralValue(viewTransmittance)) {
        throw new ReconciliationConfigurationError('Captured scene endpoint composition requires spectral path radiance and transmittance.', {
            code: 'INVALID_CAPTURED_SCENE_COMPOSITION_TRANSPORT',
        });
    }
    if (!isRgbTriplet(endpointContribution.capturedSceneColorDisplayRgb)) {
        throw new ReconciliationConfigurationError('Captured scene endpoint composition requires capturedSceneColorDisplayRgb.', {
            code: 'MISSING_CAPTURED_SCENE_ENDPOINT_COLOR',
            details: { policy: endpointContribution.policy },
        });
    }
    if (
        typeof displayAdapter.radianceToLinearSrgb !== 'function'
        || typeof displayAdapter.displayRgbToLinearSrgb !== 'function'
        || typeof displayAdapter.linearSrgbToDisplayRgb !== 'function'
    ) {
        throw new ReconciliationConfigurationError('Captured scene endpoint composition requires a display adapter with Figure 1 tone-map helpers.', {
            code: 'MISSING_CAPTURED_SCENE_DISPLAY_ADAPTER',
        });
    }

    const skyLinearSrgb = displayAdapter.radianceToLinearSrgb(pathRadiance);
    const transmittanceRgb = rgbTransmittanceBands(viewTransmittance);
    const endpointLinearSrgb = displayAdapter.displayRgbToLinearSrgb(endpointContribution.capturedSceneColorDisplayRgb);
    const finalLinearSrgb = Object.freeze(skyLinearSrgb.map((value, index) =>
        value + endpointLinearSrgb[index] * transmittanceRgb[index]));
    const displayRgb = displayAdapter.linearSrgbToDisplayRgb(finalLinearSrgb);

    return Object.freeze({
        skyLinearSrgb,
        transmittanceRgb,
        endpointLinearSrgb,
        finalLinearSrgb,
        displayRgb,
    });
}

/**
 * @param {SpectralValue} transmittanceByWavelength - Spectral transmittance on the active basis.
 * @returns {readonly [number, number, number]} Display RGB transmittance bands.
 */
function rgbTransmittanceBands(transmittanceByWavelength) {
    return Object.freeze([
        average(transmittanceByWavelength.slice(8)),
        average(transmittanceByWavelength.slice(4, 9)),
        average(transmittanceByWavelength.slice(0, 5)),
    ]);
}

/**
 * @param {readonly number[]} values - Values to average.
 * @returns {number} Average value.
 */
function average(values) {
    if (values.length === 0) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * @param {unknown} value - Candidate spectral value.
 * @returns {value is SpectralValue} Whether the value is finite spectral data.
 */
function isSpectralValue(value) {
    return Array.isArray(value) && value.length > 0 && value.every(Number.isFinite);
}

/**
 * @param {unknown} value - Candidate RGB tuple.
 * @returns {value is readonly [number, number, number]} Whether the tuple is finite RGB.
 */
function isRgbTriplet(value) {
    return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}
