// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.5.
// - tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity.
// - tmp/atmosphere/reconciliation/015-first-sky-dome-artifacts.

import {
    CANONICAL_SPECTRAL_CHANNELS,
    FIGURE1_DISPLAY_CONSTANTS,
    FIGURE1_RENDER_CONSTANTS,
} from '../constants/consts.js';
import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import { normalize } from '../math/vector.js';
import { writePng } from './pngWriter.js';

export default class Figure1SkyDomeRenderer {
    /**
     * @param {{ readonly renderConstants?: Figure1RenderConstants, readonly displayConstants?: Figure1DisplayConstants, readonly colorDisplayModel?: ColorDisplayModel }} [configuration]
     *   Renderer configuration.
     */
    constructor(configuration = {}) {
        this._renderConstants = configuration.renderConstants ?? FIGURE1_RENDER_CONSTANTS;
        this._colorDisplayModel = configuration.colorDisplayModel
            ?? new BrunetonColorDisplayModel({
                displayConstants: configuration.displayConstants ?? FIGURE1_DISPLAY_CONSTANTS,
            });
    }

    /**
     * @param {Figure1SkyDomeRenderRequest} request - Render request.
     * @returns {Promise<Figure1SkyDomeRenderResult>} Rendered artifact result.
     */
    async render(request) {
        if (!request || typeof request !== 'object') {
            throw new TypeError('Figure1 sky dome render request is required.');
        }

        const width = request.width ?? this._renderConstants.imageSizePixels;
        const height = request.height ?? this._renderConstants.imageSizePixels;
        const progressRowInterval = Math.max(1, Math.floor(request.progressRowInterval ?? 8));
        const pixels = Buffer.alloc(width * height * 4);
        const stats = makeStats();

        await emitRenderProgress(request.progress, makeProgressEvent({
            stage: 'started',
            request,
            width,
            height,
            completedRows: 0,
            stats,
        }));

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const offset = (y * width + x) * 4;
                const sample = this._fisheyeSample(x, y, width, height);

                if (!sample) {
                    putPixel(pixels, offset, [0, 0, 0, this._renderConstants.outsideSkyAlpha * 255]);
                    stats.transparentPixelCount += 1;
                    continue;
                }

                const spectralOutput = request.evaluator.evaluate({
                    viewRayRequest: Object.freeze({
                        direction: sample.direction,
                    }),
                });
                const radiance = spectralOutput.pathRadiance.inScattered;
                const displayRgb = this._colorDisplayModel.radianceToDisplayRgb(radiance);

                updateStats(stats, radiance, displayRgb);
                stats.skyPixelCount += 1;

                putPixel(pixels, offset, [
                    displayRgb[0] * 255,
                    displayRgb[1] * 255,
                    displayRgb[2] * 255,
                    255,
                ]);
            }

            if ((y + 1) % progressRowInterval === 0 || y + 1 === height) {
                await emitRenderProgress(request.progress, makeProgressEvent({
                    stage: 'row-complete',
                    request,
                    width,
                    height,
                    completedRows: y + 1,
                    stats,
                }));
            }
        }

        stats.zenithRadiance = request.evaluator.evaluate({
            viewRayRequest: Object.freeze({ direction: Object.freeze([0, 0, 1]) }),
        }).pathRadiance.inScattered;
        stats.horizonAzimuth0Radiance = request.evaluator.evaluate({
            viewRayRequest: Object.freeze({ direction: Object.freeze([1, 0, 0]) }),
        }).pathRadiance.inScattered;

        await emitRenderProgress(request.progress, makeProgressEvent({
            stage: 'png-write-started',
            request,
            width,
            height,
            completedRows: height,
            stats,
        }));

        await writePng(request.outputPath, width, height, pixels);

        await emitRenderProgress(request.progress, makeProgressEvent({
            stage: 'completed',
            request,
            width,
            height,
            completedRows: height,
            stats,
        }));

        return Object.freeze({
            artifact: Object.freeze({
                outputPath: request.outputPath,
                width,
                height,
                metadata: Object.freeze({
                    sceneId: request.scene.id,
                    renderer: 'Figure1SkyDomeRenderer',
                }),
            }),
            diagnostics: Object.freeze({
                sceneId: request.scene.id,
                skyPixelCount: stats.skyPixelCount,
                transparentPixelCount: stats.transparentPixelCount,
                maxRadiance: Object.freeze(stats.maxRadiance),
                maxDisplayRgb: Object.freeze(stats.maxDisplayRgb),
                zenithRadiance: Object.freeze([...stats.zenithRadiance]),
                horizonAzimuth0Radiance: Object.freeze([...stats.horizonAzimuth0Radiance]),
            }),
        });
    }

    /**
     * @param {SpectralValue} radiance - Spectral radiance on the active Algorithm32 basis.
     * @returns {readonly [number, number, number]} Display RGB through the accepted Step 032 adapter.
     */
    radianceToDisplayRgb(radiance) {
        const displayRgb = this._colorDisplayModel.radianceToDisplayRgb(radiance);

        return Object.freeze([displayRgb[0], displayRgb[1], displayRgb[2]]);
    }

    _fisheyeSample(x, y, width, height) {
        const scaleX = width / this._renderConstants.imageSizePixels;
        const scaleY = height / this._renderConstants.imageSizePixels;
        const centerX = this._renderConstants.centerPixels[0] * scaleX;
        const centerY = this._renderConstants.centerPixels[1] * scaleY;
        const skyRadiusPixels = this._renderConstants.skyRadiusPixels * Math.min(scaleX, scaleY);
        const dx = x - centerX;
        const dy = y - centerY;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const normalizedRadius = radius / skyRadiusPixels;

        if (normalizedRadius > 1) {
            return null;
        }

        const azimuth = Math.atan2(-dy, dx);
        const zenithAngle = normalizedRadius * this._renderConstants.maxViewZenithRadians;
        const horizontalLength = Math.sin(zenithAngle);

        return Object.freeze({
            normalizedRadius,
            azimuth,
            zenithAngle,
            direction: normalize([
                horizontalLength * Math.cos(azimuth),
                horizontalLength * Math.sin(azimuth),
                Math.cos(zenithAngle),
            ]),
        });
    }

}

function makeStats() {
    return {
        skyPixelCount: 0,
        transparentPixelCount: 0,
        maxRadiance: CANONICAL_SPECTRAL_CHANNELS.map(() => 0),
        maxDisplayRgb: [0, 0, 0],
        zenithRadiance: CANONICAL_SPECTRAL_CHANNELS.map(() => 0),
        horizonAzimuth0Radiance: CANONICAL_SPECTRAL_CHANNELS.map(() => 0),
    };
}

function makeProgressEvent({ stage, request, width, height, completedRows, stats }) {
    return Object.freeze({
        stage,
        sceneId: request.scene.id,
        outputPath: request.outputPath,
        width,
        height,
        completedRows,
        totalRows: height,
        completedPixels: completedRows * width,
        totalPixels: width * height,
        skyPixelCount: stats.skyPixelCount,
        transparentPixelCount: stats.transparentPixelCount,
    });
}

async function emitRenderProgress(progress, event) {
    if (typeof progress === 'function') {
        await progress(event);
    }
}

function updateStats(stats, radiance, displayRgb) {
    for (let index = 0; index < radiance.length; index += 1) {
        stats.maxRadiance[index] = Math.max(stats.maxRadiance[index], radiance[index]);
    }

    for (let index = 0; index < displayRgb.length; index += 1) {
        stats.maxDisplayRgb[index] = Math.max(stats.maxDisplayRgb[index], displayRgb[index]);
    }
}

function putPixel(pixels, offset, rgba) {
    pixels[offset] = clampByte(rgba[0]);
    pixels[offset + 1] = clampByte(rgba[1]);
    pixels[offset + 2] = clampByte(rgba[2]);
    pixels[offset + 3] = clampByte(rgba[3]);
}

function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}
