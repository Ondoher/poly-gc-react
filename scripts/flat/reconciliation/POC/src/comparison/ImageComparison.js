// References:
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md, exact Step 032 decoded RGBA policy.
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.5 image comparison.
// - tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity.

import sharp from 'sharp';

const DISPLAY_LUMA_WEIGHTS = Object.freeze([0.2126, 0.7152, 0.0722]);

export default class ImageComparison {
    /**
     * @param {ImageComparisonRequest} request - Actual and expected PNG paths.
     * @returns {Promise<ImageComparisonResult>} Decoded RGBA comparison metrics.
     */
    async compare(request) {
        if (!request || typeof request !== 'object') {
            throw new TypeError('Image comparison request is required.');
        }

        const actual = await decodeRgba(request.actualPath);
        const expected = await decodeRgba(request.expectedPath);
        const sameDimensions = actual.info.width === expected.info.width
            && actual.info.height === expected.info.height
            && actual.info.channels === expected.info.channels;
        const byteLength = Math.min(actual.data.length, expected.data.length);
        const pixelLength = Math.floor(byteLength / 4);
        let mismatchedByteCount = 0;
        let mismatchedPixelCount = 0;
        let maxAbsRgbaDelta = 0;
        let totalAbsDelta = 0;
        let totalSquaredDelta = 0;
        let maxAbsDisplayLumaDelta = 0;
        let totalAbsDisplayLumaDelta = 0;
        let totalSquaredDisplayLumaDelta = 0;
        let maxWeightedRgbDelta = 0;
        let totalWeightedRgbDelta = 0;
        let totalSquaredWeightedRgbDelta = 0;
        let firstMismatch = null;

        for (let pixelIndex = 0; pixelIndex < pixelLength; pixelIndex += 1) {
            const offset = pixelIndex * 4;
            let pixelMismatch = false;
            let actualDisplayLuma = 0;
            let expectedDisplayLuma = 0;
            let weightedRgbDelta = 0;

            for (let channelIndex = 0; channelIndex < 4; channelIndex += 1) {
                const actualByte = actual.data[offset + channelIndex];
                const expectedByte = expected.data[offset + channelIndex];
                const delta = Math.abs(actualByte - expectedByte);

                if (delta !== 0) {
                    mismatchedByteCount += 1;
                    pixelMismatch = true;
                }

                maxAbsRgbaDelta = Math.max(maxAbsRgbaDelta, delta);
                totalAbsDelta += delta;
                totalSquaredDelta += delta * delta;

                if (channelIndex < 3) {
                    actualDisplayLuma += actualByte * DISPLAY_LUMA_WEIGHTS[channelIndex];
                    expectedDisplayLuma += expectedByte * DISPLAY_LUMA_WEIGHTS[channelIndex];
                    weightedRgbDelta += delta * DISPLAY_LUMA_WEIGHTS[channelIndex];
                }
            }

            if (pixelMismatch) {
                mismatchedPixelCount += 1;

                if (!firstMismatch) {
                    firstMismatch = makeFirstMismatch(pixelIndex, actual.info.width, actual.data, expected.data);
                }
            }

            const displayLumaDelta = Math.abs(actualDisplayLuma - expectedDisplayLuma);
            maxAbsDisplayLumaDelta = Math.max(maxAbsDisplayLumaDelta, displayLumaDelta);
            totalAbsDisplayLumaDelta += displayLumaDelta;
            totalSquaredDisplayLumaDelta += displayLumaDelta * displayLumaDelta;
            maxWeightedRgbDelta = Math.max(maxWeightedRgbDelta, weightedRgbDelta);
            totalWeightedRgbDelta += weightedRgbDelta;
            totalSquaredWeightedRgbDelta += weightedRgbDelta * weightedRgbDelta;
        }

        const extraByteCount = Math.abs(actual.data.length - expected.data.length);

        if (extraByteCount > 0) {
            mismatchedByteCount += extraByteCount;
            maxAbsRgbaDelta = Math.max(maxAbsRgbaDelta, 255);
        }

        const comparedByteCount = Math.max(actual.data.length, expected.data.length);
        const exactMatch = sameDimensions && mismatchedByteCount === 0;

        return Object.freeze({
            actualPath: request.actualPath,
            expectedPath: request.expectedPath,
            width: sameDimensions ? actual.info.width : null,
            height: sameDimensions ? actual.info.height : null,
            expectedWidth: expected.info.width,
            expectedHeight: expected.info.height,
            actualWidth: actual.info.width,
            actualHeight: actual.info.height,
            sameDimensions,
            maxAbsRgbaDelta,
            mismatchedByteCount,
            mismatchedPixelCount,
            meanAbsRgbaDelta: comparedByteCount > 0 ? totalAbsDelta / comparedByteCount : 0,
            rmseRgbaDelta: comparedByteCount > 0 ? Math.sqrt(totalSquaredDelta / comparedByteCount) : 0,
            perceptualProxy: Object.freeze({
                kind: 'rec709-display-luma-byte-proxy',
                channelWeights: DISPLAY_LUMA_WEIGHTS,
                comparedPixelCount: pixelLength,
                maxAbsDisplayLumaDelta: maxAbsDisplayLumaDelta,
                meanAbsDisplayLumaDelta: pixelLength > 0
                    ? totalAbsDisplayLumaDelta / pixelLength
                    : 0,
                rmseDisplayLumaDelta: pixelLength > 0
                    ? Math.sqrt(totalSquaredDisplayLumaDelta / pixelLength)
                    : 0,
                maxWeightedRgbDelta,
                meanWeightedRgbDelta: pixelLength > 0
                    ? totalWeightedRgbDelta / pixelLength
                    : 0,
                rmseWeightedRgbDelta: pixelLength > 0
                    ? Math.sqrt(totalSquaredWeightedRgbDelta / pixelLength)
                    : 0,
            }),
            ...(firstMismatch ? { firstMismatch } : {}),
            exactMatch,
            metadata: request.metadata,
        });
    }
}

async function decodeRgba(filePath) {
    const { data, info } = await sharp(filePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    return Object.freeze({
        data,
        info: Object.freeze({
            width: info.width,
            height: info.height,
            channels: info.channels,
        }),
    });
}

function makeFirstMismatch(pixelIndex, width, actualData, expectedData) {
    const offset = pixelIndex * 4;

    return Object.freeze({
        pixelIndex,
        x: pixelIndex % width,
        y: Math.floor(pixelIndex / width),
        actualRgba: Object.freeze([
            actualData[offset],
            actualData[offset + 1],
            actualData[offset + 2],
            actualData[offset + 3],
        ]),
        expectedRgba: Object.freeze([
            expectedData[offset],
            expectedData[offset + 1],
            expectedData[offset + 2],
            expectedData[offset + 3],
        ]),
    });
}
