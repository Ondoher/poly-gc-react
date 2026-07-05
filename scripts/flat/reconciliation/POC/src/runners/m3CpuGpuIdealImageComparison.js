// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, CPU/GPU integrated shader parity.
// - scripts/flat/reconciliation/POC/src/runners/m3PlanetSphereGroundScene.js, constructed scene renderer.

import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import sharp from 'sharp';

import { ImageComparison } from '../index.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const cpuRecordDirectory = requiredStringArg('--cpu-record');
const gpuRecordDirectory = requiredStringArg('--gpu-record');
const diffVisualScale = numberArg('--diff-visual-scale', 4);
const imageComparison = new ImageComparison();
const imagesDirectory = resolve(recordDirectory, 'images');
const diffImagePath = resolve(imagesDirectory, `cpu-vs-gpu-ideal-diff-x${diffVisualScale}.png`);
const compositeImagePath = resolve(imagesDirectory, `cpu-gpu-ideal-diff-x${diffVisualScale}.png`);
const failures = [];
const SHARED_SCENE_INPUT_KEYS = Object.freeze([
    'sceneName',
    'requestedSceneName',
    'effectiveSceneName',
    'allowShading',
    'withShadows',
    'bottomRadiusMeters',
    'observerAltitudeMeters',
    'scaleDenominator',
    'sceneDepthMaxMeters',
    'verticalFovDegrees',
    'width',
    'height',
    'withShader',
    'solarNoon',
    'sunSample',
    'endpointRadianceScale',
    'groundDisplayMode',
]);

await appendRunLog(recordDirectory, 'm3CpuGpuIdealImageComparison started.');
await mkdir(imagesDirectory, { recursive: true });

let cpuRecord = null;
let gpuRecord = null;
let comparison = null;
let diffSummary = null;
let composite = null;

try {
    cpuRecord = await readSceneRecord(cpuRecordDirectory);
    gpuRecord = await readSceneRecord(gpuRecordDirectory);
    comparison = await imageComparison.compare({
        actualPath: cpuRecord.canvasImagePath,
        expectedPath: gpuRecord.canvasImagePath,
        metadata: Object.freeze({
            comparisonKind: 'cpu-integrated-shader-vs-gpu-ideal',
            actualRole: 'cpu-integrated-shader',
            expectedRole: 'gpu-ideal-shader',
        }),
    });
    diffSummary = await writeDiffImage({
        expectedPath: gpuRecord.canvasImagePath,
        actualPath: cpuRecord.canvasImagePath,
        outputPath: diffImagePath,
        visualScale: diffVisualScale,
    });
    composite = await writeCompositeImage({
        cpuImagePath: cpuRecord.canvasImagePath,
        gpuImagePath: gpuRecord.canvasImagePath,
        diffImagePath,
        outputPath: compositeImagePath,
        diffVisualScale,
    });
} catch (error) {
    failures.push(failure('cpu-gpu-ideal-image-comparison-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('cpu-record-read', Boolean(cpuRecord)),
    criterion('gpu-record-read', Boolean(gpuRecord)),
    criterion('cpu-record-accepted', cpuRecord?.result?.status === 'accepted'),
    criterion('gpu-record-accepted', gpuRecord?.result?.status === 'accepted'),
    criterion('cpu-backend-as-requested', cpuRecord?.inputs?.shaderBackend === 'cpu'),
    criterion('gpu-backend-as-requested', gpuRecord?.inputs?.shaderBackend === 'gpu'),
    criterion('both-records-use-ideal-profile',
        cpuRecord?.shaderQualityProfileId === 'ideal' && gpuRecord?.shaderQualityProfileId === 'ideal'),
    criterion('shared-scene-inputs-match', sharedSceneInputsMatch(cpuRecord?.inputs, gpuRecord?.inputs)),
    criterion('same-image-dimensions', comparison?.sameDimensions === true),
    criterion('diff-image-written', typeof diffSummary?.outputPath === 'string'),
    criterion('composite-image-written', typeof composite?.outputPath === 'string'),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'CPU/GPU ideal image comparison criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Compare the integrated CPU shader output against the integrated GPU ideal
shader output for the same constructed planet-sphere scene. The only intended
render input difference is the shader backend. The composite image places CPU
on the left, GPU ideal in the middle, and a visually amplified absolute diff
on the right.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5-cpu-gpu-ideal-image-comparison',
    runner: 'm3CpuGpuIdealImageComparison',
    cpuRecordDirectory: resolve(cpuRecordDirectory),
    gpuRecordDirectory: resolve(gpuRecordDirectory),
    diffVisualScale,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        cpuRecordDirectory,
        gpuRecordDirectory,
        'scripts/flat/reconciliation/POC/src/runners/m3PlanetSphereGroundScene.js',
        'agents/topics/apps/flat/reconciliation/shader-design.md#cpu-postprocess-shader',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    cpuRecord,
    gpuRecord,
    comparison,
    diffSummary,
    composite,
    sharedSceneInputDiffs: sharedSceneInputDiffs(cpuRecord?.inputs, gpuRecord?.inputs),
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3CpuGpuIdealImageComparison.js --record ${recordDirectory} --cpu-record ${cpuRecordDirectory} --gpu-record ${gpuRecordDirectory} --diff-visual-scale ${diffVisualScale}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    cpuImagePath: cpuRecord?.canvasImagePath ?? null,
    gpuImagePath: gpuRecord?.canvasImagePath ?? null,
    diffImagePath: diffSummary?.outputPath ?? null,
    compositeImagePath: composite?.outputPath ?? null,
    comparison,
});
await writeText(recordDirectory, 'report.md', `# Report

CPU/GPU ideal image comparison finished with status: ${status}.

- CPU record: \`${resolve(cpuRecordDirectory)}\`
- GPU ideal record: \`${resolve(gpuRecordDirectory)}\`
- CPU image: \`${cpuRecord?.canvasImagePath ?? 'not-read'}\`
- GPU ideal image: \`${gpuRecord?.canvasImagePath ?? 'not-read'}\`
- Diff image: \`${diffSummary?.outputPath ?? 'not-written'}\`
- Composite image: \`${composite?.outputPath ?? 'not-written'}\`
- Diff visual scale: \`${diffVisualScale}x\`
- Exact match: \`${comparison?.exactMatch ?? 'not-compared'}\`
- Max RGBA byte delta: \`${comparison?.maxAbsRgbaDelta ?? 'not-compared'}\`
- Mean RGBA byte delta: \`${formatNumber(comparison?.meanAbsRgbaDelta)}\`
- Mean display-luma byte delta: \`${formatNumber(comparison?.perceptualProxy?.meanAbsDisplayLumaDelta)}\`
- Mismatched pixels: \`${comparison?.mismatchedPixelCount ?? 'not-compared'}\`

The diff treats GPU ideal as the expected image and CPU integrated shader as
the actual image. The composite order is CPU, GPU ideal, diff.
`);
await appendRunLog(recordDirectory, `m3CpuGpuIdealImageComparison ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    cpuImagePath: cpuRecord?.canvasImagePath ?? null,
    gpuImagePath: gpuRecord?.canvasImagePath ?? null,
    diffImagePath: diffSummary?.outputPath ?? null,
    compositeImagePath: composite?.outputPath ?? null,
    comparison: comparison
        ? {
            exactMatch: comparison.exactMatch,
            maxAbsRgbaDelta: comparison.maxAbsRgbaDelta,
            meanAbsRgbaDelta: comparison.meanAbsRgbaDelta,
            meanAbsDisplayLumaDelta: comparison.perceptualProxy?.meanAbsDisplayLumaDelta ?? null,
            mismatchedPixelCount: comparison.mismatchedPixelCount,
        }
        : null,
}));

async function readSceneRecord(recordDir) {
    const absoluteRecordDirectory = resolve(recordDir);
    const inputs = await readJson(resolve(absoluteRecordDirectory, 'inputs.json'));
    const diagnostics = await readJson(resolve(absoluteRecordDirectory, 'diagnostics.json'));
    const result = await readJson(resolve(absoluteRecordDirectory, 'result.json'));
    const canvasImagePath = result.canvasImagePath
        ? resolve(result.canvasImagePath)
        : resolve(absoluteRecordDirectory, 'images', 'canvas-image.png');

    return Object.freeze({
        recordDirectory: absoluteRecordDirectory,
        canvasImagePath,
        inputs,
        diagnostics,
        result,
        shaderQualityProfileId: inputs.shaderQualityProfile?.id
            ?? diagnostics.shaderQualityProfile?.id
            ?? diagnostics.command?.payload?.shaderQualityProfile?.id
            ?? null,
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
        outputPath,
        width,
        height,
        visualScale,
        maxRgbDelta,
    });
}

async function writeCompositeImage({
    cpuImagePath,
    gpuImagePath,
    diffImagePath,
    outputPath,
    diffVisualScale,
}) {
    const cpuMetadata = await sharp(cpuImagePath).metadata();
    const imageWidth = cpuMetadata.width;
    const imageHeight = cpuMetadata.height;
    const layout = buildLayout(imageWidth, imageHeight);

    await sharp({
        create: {
            width: layout.outputWidth,
            height: layout.outputHeight,
            channels: 4,
            background: '#10151d',
        },
    })
        .composite([
            { input: Buffer.from(buildLabelSvg(layout, diffVisualScale)), left: 0, top: 0 },
            { input: cpuImagePath, left: layout.cpuX, top: layout.imageTop },
            { input: gpuImagePath, left: layout.gpuX, top: layout.imageTop },
            { input: diffImagePath, left: layout.diffX, top: layout.imageTop },
        ])
        .png()
        .toFile(outputPath);

    return Object.freeze({
        outputPath,
        layout,
    });
}

function buildLayout(imageWidth, imageHeight) {
    const padding = 18;
    const columnGap = 10;
    const headerHeight = 40;
    const cpuX = padding;
    const gpuX = cpuX + imageWidth + columnGap;
    const diffX = gpuX + imageWidth + columnGap;
    const imageTop = padding + headerHeight;

    return Object.freeze({
        padding,
        columnGap,
        headerHeight,
        imageWidth,
        imageHeight,
        cpuX,
        gpuX,
        diffX,
        imageTop,
        outputWidth: padding + imageWidth * 3 + columnGap * 2 + padding,
        outputHeight: imageTop + imageHeight + padding,
    });
}

function buildLabelSvg(layout, diffVisualScale) {
    const headerY = layout.padding + 25;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.outputWidth}" height="${layout.outputHeight}" viewBox="0 0 ${layout.outputWidth} ${layout.outputHeight}">
    <style>
        .header { fill: #f3f6fb; font: 700 18px Arial, sans-serif; }
    </style>
    <text x="${layout.cpuX}" y="${headerY}" class="header">cpu</text>
    <text x="${layout.gpuX}" y="${headerY}" class="header">gpu ideal</text>
    <text x="${layout.diffX}" y="${headerY}" class="header">diff x${diffVisualScale}</text>
</svg>`;
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

function sharedSceneInputsMatch(cpuInputs, gpuInputs) {
    return sharedSceneInputDiffs(cpuInputs, gpuInputs).length === 0;
}

function sharedSceneInputDiffs(cpuInputs, gpuInputs) {
    if (!cpuInputs || !gpuInputs) {
        return Object.freeze(['missing-inputs']);
    }

    return SHARED_SCENE_INPUT_KEYS
        .filter((key) => JSON.stringify(cpuInputs[key] ?? null) !== JSON.stringify(gpuInputs[key] ?? null))
        .map((key) => Object.freeze({
            key,
            cpu: cpuInputs[key] ?? null,
            gpu: gpuInputs[key] ?? null,
        }));
}

async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, 'utf8'));
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

    if (index < 0 || index + 1 >= process.argv.length || process.argv[index + 1].startsWith('--')) {
        return defaultValue;
    }

    const value = Number(process.argv[index + 1]);
    if (!Number.isFinite(value)) {
        throw new Error(`Invalid numeric argument ${name}: ${process.argv[index + 1]}`);
    }

    return value;
}

function formatNumber(value) {
    return Number.isFinite(value) ? value.toFixed(4) : 'not-compared';
}
