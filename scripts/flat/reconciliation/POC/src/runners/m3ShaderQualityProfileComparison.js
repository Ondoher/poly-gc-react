// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, ideal GPU shader and optimized implementation boundary.
// - scripts/flat/reconciliation/POC/src/shader/shaderQualityProfiles.js, quality profile work estimates.

import { mkdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import sharp from 'sharp';

import { ImageComparison } from '../index.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const DEFAULT_PERCEPTUAL_DIFF_JND_DELTA_E = 1;
const recordDirectory = parseRecordDirectory(process.argv);
const idealRecordDirectory = requiredStringArg('--ideal-record');
const candidateRecordDirectories = requiredStringArg('--candidate-records')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
const diffVisualScale = numberArg('--diff-visual-scale', 4);
const perceptualDiffVisualScale = numberArg('--perceptual-diff-visual-scale', diffVisualScale);
const perceptualDiffJndThreshold = numberArg(
    '--perceptual-diff-jnd-threshold',
    DEFAULT_PERCEPTUAL_DIFF_JND_DELTA_E,
);
const imageComparison = new ImageComparison();
const failures = [];

await appendRunLog(recordDirectory, 'm3ShaderQualityProfileComparison started.');
await mkdir(resolve(recordDirectory, 'images'), { recursive: true });

let ideal = null;
const candidateComparisons = [];

try {
    ideal = await readShaderQualityRecord(idealRecordDirectory);
    for (const candidateRecordDirectory of candidateRecordDirectories) {
        const candidate = await readShaderQualityRecord(candidateRecordDirectory);
        const comparison = await imageComparison.compare({
            actualPath: candidate.canvasImagePath,
            expectedPath: ideal.canvasImagePath,
            metadata: Object.freeze({
                comparisonKind: 'shader-quality-profile-vs-ideal',
                actualRole: candidate.profile?.id ?? 'candidate',
                expectedRole: ideal.profile?.id ?? 'ideal',
            }),
        });
        const diffImagePath = resolve(
            recordDirectory,
            'images',
            `${safeFilePart(candidate.profile?.id ?? basename(candidateRecordDirectory))}-vs-ideal-diff-x${diffVisualScale}.png`,
        );
        const diffSummary = await writeDiffImage({
            expectedPath: ideal.canvasImagePath,
            actualPath: candidate.canvasImagePath,
            outputPath: diffImagePath,
            visualScale: diffVisualScale,
        });
        const perceptualDiffImagePath = resolve(
            recordDirectory,
            'images',
            `${safeFilePart(candidate.profile?.id ?? basename(candidateRecordDirectory))}-vs-ideal-detectable-diff-de${safeNumberPart(perceptualDiffJndThreshold)}-x${perceptualDiffVisualScale}.png`,
        );
        const perceptualDiffSummary = await writePerceptualResidualDiffImage({
            expectedPath: ideal.canvasImagePath,
            actualPath: candidate.canvasImagePath,
            outputPath: perceptualDiffImagePath,
            visualScale: perceptualDiffVisualScale,
            jndThresholdDeltaE2000: perceptualDiffJndThreshold,
        });

        candidateComparisons.push(Object.freeze({
            candidate,
            comparison,
            diffImagePath,
            diffSummary,
            perceptualDiffImagePath,
            perceptualDiffSummary,
        }));
    }
} catch (error) {
    failures.push(failure('shader-quality-profile-comparison-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('ideal-record-read', Boolean(ideal)),
    criterion('candidate-records-present', candidateRecordDirectories.length > 0),
    criterion('all-candidates-compared',
        candidateComparisons.length === candidateRecordDirectories.length
            && candidateComparisons.every((entry) => entry.comparison?.sameDimensions === true)),
    criterion('ideal-profile-is-reference', ideal?.profile?.id === 'ideal'),
    criterion('candidate-profiles-are-not-ideal',
        candidateComparisons.every((entry) => entry.candidate?.profile?.id !== 'ideal')),
    criterion('diff-images-written',
        candidateComparisons.every((entry) => typeof entry.diffImagePath === 'string')),
    criterion('perceptual-residual-diff-images-written',
        candidateComparisons.every((entry) => typeof entry.perceptualDiffImagePath === 'string')),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Shader quality profile comparison criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';
const summaryRows = candidateComparisons.map((entry) => summarizeComparison(entry));
const conclusions = summarizeConclusions(summaryRows);

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Compare reduced-cost GPU shader quality profiles against the current ideal GPU
shader output for the same scene, camera, Sun sample, and endpoint composition
policy. This record does not promote an optimized shader; it measures which
loop-count reductions are plausible candidates for a separate implementation.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5-shader-quality-profile-evaluation',
    runner: 'm3ShaderQualityProfileComparison',
    idealRecordDirectory,
    candidateRecordDirectories,
    diffVisualScale,
    perceptualDiffVisualScale,
    perceptualDiffJndThreshold,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        idealRecordDirectory,
        ...candidateRecordDirectories,
        'scripts/flat/reconciliation/POC/src/runners/m3PlanetSphereGroundScene.js',
        'scripts/flat/reconciliation/POC/src/shader/shaderQualityProfiles.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    ideal,
    comparisons: candidateComparisons,
    summaryRows,
    conclusions,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3ShaderQualityProfileComparison.js --record ${recordDirectory} --ideal-record ${idealRecordDirectory} --candidate-records ${candidateRecordDirectories.join(',')} --diff-visual-scale ${diffVisualScale}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    summaryRows,
    conclusions,
});
await writeText(recordDirectory, 'report.md', `# Report

Shader quality profile comparison finished with status: ${status}.

- Ideal record: \`${idealRecordDirectory}\`
- Ideal profile: \`${ideal?.profile?.id ?? 'not-read'}\`
- Candidate count: \`${candidateComparisons.length}\`
- Diff visual scale: \`${diffVisualScale}x\`
- Detectable residual diff visual scale: \`${perceptualDiffVisualScale}x\`
- Detectable residual JND threshold: \`${formatNumber(perceptualDiffJndThreshold)} Delta E 2000\`

## Conclusions

${conclusions.map((conclusion) => `- ${conclusion}`).join('\n')}

| Profile | Work ratio | Dominant steps/pixel | Max byte delta | Mean byte delta | RMSE byte delta | Mean luma delta | RMSE luma delta | Detectable pixels | Mean residual Delta E | Mismatched pixels | Diff image | Detectable diff image |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
${summaryRows.map((row) => `| \`${row.profileId}\` | \`${formatNumber(row.estimatedWorkRatioToIdeal)}\` | \`${row.totalDominantSpectralSteps}\` | \`${row.maxAbsRgbaDelta}\` | \`${formatNumber(row.meanAbsRgbaDelta)}\` | \`${formatNumber(row.rmseRgbaDelta)}\` | \`${formatNumber(row.meanAbsDisplayLumaDelta)}\` | \`${formatNumber(row.rmseDisplayLumaDelta)}\` | \`${formatPercent(row.detectablePixelFraction)}\` | \`${formatNumber(row.meanResidualDeltaE2000)}\` | \`${row.mismatchedPixelCount}\` | \`${row.diffImagePath}\` | \`${row.perceptualDiffImagePath}\` |`).join('\n')}

The current full shader remains the ideal GPU reference. These candidates only
change numerical controls and cache dimensions through setup/configuration, so
the per-pixel shader still performs the GPU equivalent of \`evaluate(...)\`.
The luma and weighted RGB columns are Rec.709 display-byte proxy metrics
intended to keep human eye sensitivity in view during tuning; exact byte
metrics remain available for regression and audit. Detectable residual diff
images use a CIEDE2000-style display-byte proxy and subtract a configurable
just-noticeable threshold before visualization; they are review aids, not
formal proof that a difference is invisible.
`);
await appendRunLog(recordDirectory, `m3ShaderQualityProfileComparison ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    summaryRows,
}));

async function readShaderQualityRecord(recordDir) {
    const absoluteRecordDirectory = resolve(recordDir);
    const inputs = await readJson(resolve(absoluteRecordDirectory, 'inputs.json'));
    const diagnostics = await readJson(resolve(absoluteRecordDirectory, 'diagnostics.json'));
    const result = await readJson(resolve(absoluteRecordDirectory, 'result.json'));
    const profile = inputs.shaderQualityProfile
        ?? diagnostics.shaderQualityProfile
        ?? diagnostics.command?.payload?.shaderQualityProfile
        ?? diagnostics.latestSummary?.command?.payload?.shaderQualityProfile
        ?? null;

    return Object.freeze({
        recordDirectory: absoluteRecordDirectory,
        canvasImagePath: resolve(absoluteRecordDirectory, 'images', 'canvas-image.png'),
        inputs,
        diagnostics,
        result,
        profile,
        descriptorFingerprint: diagnostics.descriptorFingerprint ?? null,
        sourceHash: diagnostics.sourceHash ?? null,
    });
}

async function writeDiffImage({ expectedPath, actualPath, outputPath, visualScale }) {
    const expected = await decodeRgba(expectedPath);
    const actual = await decodeRgba(actualPath);
    const width = Math.min(expected.info.width, actual.info.width);
    const height = Math.min(expected.info.height, actual.info.height);
    const diff = Buffer.alloc(width * height * 4);
    let maxRgbDelta = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const expectedOffset = (y * expected.info.width + x) * 4;
            const actualOffset = (y * actual.info.width + x) * 4;
            const outputOffset = (y * width + x) * 4;

            for (let channelIndex = 0; channelIndex < 3; channelIndex += 1) {
                const delta = Math.abs(actual.data[actualOffset + channelIndex]
                    - expected.data[expectedOffset + channelIndex]);
                maxRgbDelta = Math.max(maxRgbDelta, delta);
                diff[outputOffset + channelIndex] = Math.min(255, delta * visualScale);
            }
            diff[outputOffset + 3] = 255;
        }
    }

    await sharp(diff, {
        raw: {
            width,
            height,
            channels: 4,
        },
    }).png().toFile(outputPath);

    return Object.freeze({
        width,
        height,
        visualScale,
        maxRgbDelta,
    });
}

async function writePerceptualResidualDiffImage({
    expectedPath,
    actualPath,
    outputPath,
    visualScale,
    jndThresholdDeltaE2000,
}) {
    const expected = await decodeRgba(expectedPath);
    const actual = await decodeRgba(actualPath);
    const width = Math.min(expected.info.width, actual.info.width);
    const height = Math.min(expected.info.height, actual.info.height);
    const diff = Buffer.alloc(width * height * 4);
    let maxDeltaE2000 = 0;
    let totalDeltaE2000 = 0;
    let maxResidualDeltaE2000 = 0;
    let totalResidualDeltaE2000 = 0;
    let detectablePixelCount = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const expectedOffset = (y * expected.info.width + x) * 4;
            const actualOffset = (y * actual.info.width + x) * 4;
            const outputOffset = (y * width + x) * 4;
            const expectedLab = srgbBytesToLab(
                expected.data[expectedOffset],
                expected.data[expectedOffset + 1],
                expected.data[expectedOffset + 2],
            );
            const actualLab = srgbBytesToLab(
                actual.data[actualOffset],
                actual.data[actualOffset + 1],
                actual.data[actualOffset + 2],
            );
            const deltaE2000 = colorDeltaE2000(expectedLab, actualLab);
            const residualDeltaE2000 = Math.max(0, deltaE2000 - jndThresholdDeltaE2000);
            const residualRatio = deltaE2000 > 0 ? residualDeltaE2000 / deltaE2000 : 0;

            maxDeltaE2000 = Math.max(maxDeltaE2000, deltaE2000);
            totalDeltaE2000 += deltaE2000;
            maxResidualDeltaE2000 = Math.max(maxResidualDeltaE2000, residualDeltaE2000);
            totalResidualDeltaE2000 += residualDeltaE2000;

            if (residualDeltaE2000 > 0) {
                detectablePixelCount += 1;
            }

            for (let channelIndex = 0; channelIndex < 3; channelIndex += 1) {
                const delta = Math.abs(actual.data[actualOffset + channelIndex]
                    - expected.data[expectedOffset + channelIndex]);
                diff[outputOffset + channelIndex] = clampByte(delta * visualScale * residualRatio);
            }
            diff[outputOffset + 3] = 255;
        }
    }

    await sharp(diff, {
        raw: {
            width,
            height,
            channels: 4,
        },
    }).png().toFile(outputPath);

    const pixelCount = width * height;

    return Object.freeze({
        kind: 'cie-de2000-display-byte-jnd-residual-diff-v1',
        width,
        height,
        visualScale,
        jndThresholdDeltaE2000,
        maxDeltaE2000,
        meanDeltaE2000: pixelCount > 0 ? totalDeltaE2000 / pixelCount : 0,
        maxResidualDeltaE2000,
        meanResidualDeltaE2000: pixelCount > 0 ? totalResidualDeltaE2000 / pixelCount : 0,
        detectablePixelCount,
        detectablePixelFraction: pixelCount > 0 ? detectablePixelCount / pixelCount : 0,
    });
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

async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, 'utf8'));
}

function summarizeComparison(entry) {
    return Object.freeze({
        profileId: entry.candidate.profile?.id ?? 'unknown',
        estimatedWorkRatioToIdeal: entry.candidate.profile?.estimatedWorkRatioToIdeal ?? null,
        totalDominantSpectralSteps: entry.candidate.profile?.workEstimate?.totalDominantSpectralSteps ?? null,
        maxAbsRgbaDelta: entry.comparison.maxAbsRgbaDelta,
        meanAbsRgbaDelta: entry.comparison.meanAbsRgbaDelta,
        rmseRgbaDelta: entry.comparison.rmseRgbaDelta,
        maxAbsDisplayLumaDelta: entry.comparison.perceptualProxy?.maxAbsDisplayLumaDelta ?? null,
        meanAbsDisplayLumaDelta: entry.comparison.perceptualProxy?.meanAbsDisplayLumaDelta ?? null,
        rmseDisplayLumaDelta: entry.comparison.perceptualProxy?.rmseDisplayLumaDelta ?? null,
        maxWeightedRgbDelta: entry.comparison.perceptualProxy?.maxWeightedRgbDelta ?? null,
        meanWeightedRgbDelta: entry.comparison.perceptualProxy?.meanWeightedRgbDelta ?? null,
        rmseWeightedRgbDelta: entry.comparison.perceptualProxy?.rmseWeightedRgbDelta ?? null,
        mismatchedPixelCount: entry.comparison.mismatchedPixelCount,
        diffImagePath: entry.diffImagePath,
        perceptualDiffImagePath: entry.perceptualDiffImagePath,
        maxDeltaE2000: entry.perceptualDiffSummary?.maxDeltaE2000 ?? null,
        meanDeltaE2000: entry.perceptualDiffSummary?.meanDeltaE2000 ?? null,
        maxResidualDeltaE2000: entry.perceptualDiffSummary?.maxResidualDeltaE2000 ?? null,
        meanResidualDeltaE2000: entry.perceptualDiffSummary?.meanResidualDeltaE2000 ?? null,
        detectablePixelCount: entry.perceptualDiffSummary?.detectablePixelCount ?? null,
        detectablePixelFraction: entry.perceptualDiffSummary?.detectablePixelFraction ?? null,
    });
}

function summarizeConclusions(summaryRows) {
    if (summaryRows.length === 0) {
        return Object.freeze([
            'No candidates were compared, so no quality ranking is available.',
        ]);
    }

    const rowsById = new Map(summaryRows.map((row) => [row.profileId, row]));
    const rankedByLuma = [...summaryRows]
        .filter((row) => Number.isFinite(row.meanAbsDisplayLumaDelta))
        .sort((left, right) => left.meanAbsDisplayLumaDelta - right.meanAbsDisplayLumaDelta);
    const best = rankedByLuma[0] ?? summaryRows[0];
    const balanced = rowsById.get('balanced');
    const balancedCacheInterp = rowsById.get('balanced-cache-interp');
    const adaptiveBalanced = rowsById.get('adaptive-balanced');
    const adaptiveBalancedSoft = rowsById.get('adaptive-balanced-soft');
    const fast = rowsById.get('fast');
    const fastCacheInterp = rowsById.get('fast-cache-interp');
    const draft = rowsById.get('draft');
    const conclusions = [
        `Best candidate by the Rec.709 display-luma proxy is \`${best.profileId}\` at ${formatPercent(best.estimatedWorkRatioToIdeal)} of ideal work, mean luma delta ${formatNumber(best.meanAbsDisplayLumaDelta)}, and RMSE luma delta ${formatNumber(best.rmseDisplayLumaDelta)}.`,
    ];

    if (balanced && balancedCacheInterp) {
        const delta = balanced.meanAbsDisplayLumaDelta - balancedCacheInterp.meanAbsDisplayLumaDelta;
        conclusions.push(delta > 0
            ? `Linear altitude interpolation helps the balanced profile slightly: mean luma delta improves from ${formatNumber(balanced.meanAbsDisplayLumaDelta)} to ${formatNumber(balancedCacheInterp.meanAbsDisplayLumaDelta)} without increasing the dominant per-pixel work estimate.`
            : `Linear altitude interpolation does not improve the balanced profile in this run: mean luma delta changes from ${formatNumber(balanced.meanAbsDisplayLumaDelta)} to ${formatNumber(balancedCacheInterp.meanAbsDisplayLumaDelta)}.`);
    }

    if (balanced && adaptiveBalanced && adaptiveBalancedSoft) {
        conclusions.push(`The tested nonuniform/adaptive view-path distributions are not ready to promote: \`adaptive-balanced\` rises to mean luma delta ${formatNumber(adaptiveBalanced.meanAbsDisplayLumaDelta)}, and \`adaptive-balanced-soft\` still trails regular \`balanced\` at ${formatNumber(adaptiveBalancedSoft.meanAbsDisplayLumaDelta)} versus ${formatNumber(balanced.meanAbsDisplayLumaDelta)}.`);
    }

    if (fast && fastCacheInterp) {
        conclusions.push(`The fast profiles are visibly risky by the luma proxy: \`fast\` reports mean luma delta ${formatNumber(fast.meanAbsDisplayLumaDelta)}, and cache interpolation does not rescue it (${formatNumber(fastCacheInterp.meanAbsDisplayLumaDelta)}).`);
    }

    if (draft) {
        conclusions.push(`\`draft\` remains useful only as a quick preview profile: it is very cheap at ${formatPercent(draft.estimatedWorkRatioToIdeal)} of ideal work, but its max byte delta ${draft.maxAbsRgbaDelta} and RMSE luma delta ${formatNumber(draft.rmseDisplayLumaDelta)} are too high for quality evaluation.`);
    }

    conclusions.push('The perceptual proxy does not overturn the byte-metric ranking; it mainly makes the same conclusion more legible by weighting green/luma errors more heavily than blue-only drift.');

    return Object.freeze(conclusions);
}

function criterion(name, condition) {
    return Object.freeze({
        name,
        status: condition ? 'accepted' : 'rejected',
    });
}

function failure(name, message, details = undefined) {
    return Object.freeze({
        name,
        message,
        ...(details ? { details } : {}),
    });
}

function requiredStringArg(name) {
    const index = process.argv.indexOf(name);
    if (index < 0 || index + 1 >= process.argv.length || process.argv[index + 1].startsWith('--')) {
        throw new Error(`Missing required argument ${name}`);
    }
    return process.argv[index + 1];
}

function numberArg(name, defaultValue) {
    const index = process.argv.indexOf(name);
    if (index < 0 || index + 1 >= process.argv.length) {
        return defaultValue;
    }
    const value = Number(process.argv[index + 1]);
    return Number.isFinite(value) ? value : defaultValue;
}

function safeFilePart(value) {
    return String(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function safeNumberPart(value) {
    return Number.isFinite(value)
        ? String(value).replace(/[^0-9]+/g, '-').replace(/^-+|-+$/g, '')
        : 'unknown';
}

function formatNumber(value) {
    return Number.isFinite(value) ? Number(value).toFixed(4) : 'not-reported';
}

function formatPercent(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'not-reported';
}

function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function srgbBytesToLab(redByte, greenByte, blueByte) {
    const red = srgbByteToLinear(redByte);
    const green = srgbByteToLinear(greenByte);
    const blue = srgbByteToLinear(blueByte);
    const x = (0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) * 100;
    const y = (0.2126729 * red + 0.7151522 * green + 0.0721750 * blue) * 100;
    const z = (0.0193339 * red + 0.1191920 * green + 0.9503041 * blue) * 100;
    const fx = labPivot(x / 95.047);
    const fy = labPivot(y / 100);
    const fz = labPivot(z / 108.883);

    return Object.freeze({
        l: 116 * fy - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz),
    });
}

function srgbByteToLinear(byte) {
    const value = byte / 255;

    return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
}

function labPivot(value) {
    const epsilon = 216 / 24389;
    const kappa = 24389 / 27;

    return value > epsilon
        ? Math.cbrt(value)
        : (kappa * value + 16) / 116;
}

function colorDeltaE2000(left, right) {
    const leftChroma = Math.hypot(left.a, left.b);
    const rightChroma = Math.hypot(right.a, right.b);
    const meanChroma = (leftChroma + rightChroma) / 2;
    const meanChroma7 = meanChroma ** 7;
    const chromaCompensation = 0.5 * (1 - Math.sqrt(meanChroma7 / (meanChroma7 + 25 ** 7)));
    const leftA = (1 + chromaCompensation) * left.a;
    const rightA = (1 + chromaCompensation) * right.a;
    const leftPrimeChroma = Math.hypot(leftA, left.b);
    const rightPrimeChroma = Math.hypot(rightA, right.b);
    const leftHue = hueDegrees(left.b, leftA);
    const rightHue = hueDegrees(right.b, rightA);
    const deltaLightness = right.l - left.l;
    const deltaChroma = rightPrimeChroma - leftPrimeChroma;
    const deltaHue = hueDelta(leftHue, rightHue, leftPrimeChroma, rightPrimeChroma);
    const deltaPrimeHue = 2
        * Math.sqrt(leftPrimeChroma * rightPrimeChroma)
        * Math.sin(degreesToRadians(deltaHue / 2));
    const meanLightness = (left.l + right.l) / 2;
    const meanPrimeChroma = (leftPrimeChroma + rightPrimeChroma) / 2;
    const meanHue = meanHueDegrees(leftHue, rightHue, leftPrimeChroma, rightPrimeChroma);
    const meanPrimeChroma7 = meanPrimeChroma ** 7;
    const hueWeight = 1
        - 0.17 * Math.cos(degreesToRadians(meanHue - 30))
        + 0.24 * Math.cos(degreesToRadians(2 * meanHue))
        + 0.32 * Math.cos(degreesToRadians(3 * meanHue + 6))
        - 0.20 * Math.cos(degreesToRadians(4 * meanHue - 63));
    const lightnessWeight = 1
        + (0.015 * (meanLightness - 50) ** 2)
            / Math.sqrt(20 + (meanLightness - 50) ** 2);
    const chromaWeight = 1 + 0.045 * meanPrimeChroma;
    const hueScale = 1 + 0.015 * meanPrimeChroma * hueWeight;
    const rotationAngle = 30 * Math.exp(-(((meanHue - 275) / 25) ** 2));
    const rotationChroma = 2 * Math.sqrt(meanPrimeChroma7 / (meanPrimeChroma7 + 25 ** 7));
    const rotationTerm = -Math.sin(degreesToRadians(2 * rotationAngle)) * rotationChroma;
    const lightnessTerm = deltaLightness / lightnessWeight;
    const chromaTerm = deltaChroma / chromaWeight;
    const hueTerm = deltaPrimeHue / hueScale;

    return Math.sqrt(
        lightnessTerm ** 2
        + chromaTerm ** 2
        + hueTerm ** 2
        + rotationTerm * chromaTerm * hueTerm,
    );
}

function hueDegrees(b, a) {
    if (a === 0 && b === 0) {
        return 0;
    }

    const hue = radiansToDegrees(Math.atan2(b, a));

    return hue >= 0 ? hue : hue + 360;
}

function hueDelta(leftHue, rightHue, leftChroma, rightChroma) {
    if (leftChroma * rightChroma === 0) {
        return 0;
    }

    const hueDifference = rightHue - leftHue;

    if (Math.abs(hueDifference) <= 180) {
        return hueDifference;
    }

    return hueDifference > 180
        ? hueDifference - 360
        : hueDifference + 360;
}

function meanHueDegrees(leftHue, rightHue, leftChroma, rightChroma) {
    if (leftChroma * rightChroma === 0) {
        return leftHue + rightHue;
    }

    if (Math.abs(leftHue - rightHue) <= 180) {
        return (leftHue + rightHue) / 2;
    }

    return leftHue + rightHue < 360
        ? (leftHue + rightHue + 360) / 2
        : (leftHue + rightHue - 360) / 2;
}

function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

function radiansToDegrees(radians) {
    return radians * 180 / Math.PI;
}
