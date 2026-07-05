// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.5 diagnostic skydome assets.
// - agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md, Step 018 guide-image policy.
// - tmp/atmosphere/reconciliation/016-step032-full-image-comparison, renderer/display path retained outside transport.

import Figure1SkyDomeRenderer from './Figure1SkyDomeRenderer.js';

export default class Step018SkydomeImageWriter {
    /**
     * @param {{ readonly renderer?: Figure1SkyDomeRenderer }} [configuration] - Writer configuration.
     */
    constructor(configuration = {}) {
        this._renderer = configuration.renderer ?? new Figure1SkyDomeRenderer();
    }

    /**
     * @param {Step018SkydomeWriteRequest} request - Local/flat skydome write request.
     * @returns {Promise<Step018SkydomeWriteResult>} Written artifact result.
     */
    async write(request) {
        if (!request || typeof request !== 'object') {
            throw new TypeError('Step018 skydome write request is required.');
        }

        const renderResult = await this._renderer.render({
            scene: request.scene,
            evaluator: request.evaluator,
            outputPath: request.outputPath,
            width: request.width,
            height: request.height,
            progress: request.progress,
            progressRowInterval: request.progressRowInterval,
        });

        return Object.freeze({
            artifact: Object.freeze({
                ...renderResult.artifact,
                metadata: Object.freeze({
                    ...renderResult.artifact.metadata,
                    renderer: 'Step018SkydomeImageWriter',
                    guideImageFilename: request.scene.guideImageFilename,
                    exactParityTarget: false,
                }),
            }),
            diagnostics: Object.freeze({
                ...renderResult.diagnostics,
                offsetDegrees: request.scene.offsetDegrees,
                sourceAltitudeDegrees: request.scene.sourceAltitudeDegrees,
                sourceAzimuthDegrees: request.scene.sourceAzimuthDegrees,
                guideImageFilename: request.scene.guideImageFilename,
            }),
        });
    }
}
