// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.6 diagnostics.
// - tmp/atmosphere/reconciliation/029-m2-local-flat-assets, pre-warning-fix full-size domes.
// - tmp/atmosphere/reconciliation/037-m2-coordinate-warning-fix-check, warning fix verification.
// - tmp/atmosphere/reconciliation/038-m2-warning-fix-local-flat-assets, post-warning-fix domes.

import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import sharp from 'sharp';

import {
    M2_LOCAL_FLAT_SEED_CONSTANTS,
} from '../index.js';
import {
    appendRunLog,
    assert,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const baselineRecordDirectory = parseStringOption(
    process.argv,
    '--baseline-record',
    'tmp/atmosphere/reconciliation/029-m2-local-flat-assets',
);
const latestRecordDirectory = parseStringOption(
    process.argv,
    '--latest-record',
    'tmp/atmosphere/reconciliation/038-m2-warning-fix-local-flat-assets',
);
const guideRoot = M2_LOCAL_FLAT_SEED_CONSTANTS.guideArtifactRoot;
const baselineRoot = resolve(baselineRecordDirectory, 'artifacts');
const latestRoot = resolve(latestRecordDirectory, 'artifacts');
const artifactDirectory = resolve(recordDirectory, 'artifacts');
const outputPath = resolve(artifactDirectory, 'local-flat-warning-fix-six-column-stack.png');
const diffVisualScale = 3;
const comparisonBackground = '#101114';
const rows = [];
const diffBuffers = [];

await appendRunLog(recordDirectory, `m2LocalFlatWarningFixStackComparison started baseline=${baselineRecordDirectory} latest=${latestRecordDirectory}.`);
await mkdir(artifactDirectory, { recursive: true });

for (const scene of M2_LOCAL_FLAT_SEED_CONSTANTS.scenes) {
    await appendRunLog(recordDirectory, `m2LocalFlatWarningFixStackComparison scene=${scene.id} metadata-started.`);

    const guidePath = resolve(guideRoot, scene.guideImageFilename);
    const baselinePath = resolve(baselineRoot, scene.guideImageFilename);
    const latestPath = resolve(latestRoot, scene.guideImageFilename);
    const guideMetadata = await sharp(guidePath).metadata();
    const baselineMetadata = await sharp(baselinePath).metadata();
    const latestMetadata = await sharp(latestPath).metadata();

    assertSameDimensions(guideMetadata, baselineMetadata, 'atmosflat and 029 skydome images');
    assertSameDimensions(guideMetadata, latestMetadata, 'atmosflat and latest skydome images');

    const atmosflat029Diff = await createDiffBuffer(
        guidePath,
        baselinePath,
        guideMetadata.width,
        guideMetadata.height,
        diffVisualScale,
        comparisonBackground,
        makeDiffProgressLogger(scene.id, 'atmosflat-029'),
    );
    const atmosflatLatestDiff = await createDiffBuffer(
        guidePath,
        latestPath,
        guideMetadata.width,
        guideMetadata.height,
        diffVisualScale,
        comparisonBackground,
        makeDiffProgressLogger(scene.id, 'atmosflat-latest'),
    );
    const baselineLatestDiff = await createDiffBuffer(
        baselinePath,
        latestPath,
        guideMetadata.width,
        guideMetadata.height,
        diffVisualScale,
        comparisonBackground,
        makeDiffProgressLogger(scene.id, '029-latest'),
    );

    diffBuffers.push(Object.freeze({
        atmosflat029: atmosflat029Diff.buffer,
        atmosflatLatest: atmosflatLatestDiff.buffer,
        baselineLatest: baselineLatestDiff.buffer,
    }));
    rows.push(Object.freeze({
        sceneId: scene.id,
        offsetDegrees: scene.offsetDegrees,
        guideImageFilename: scene.guideImageFilename,
        guidePath,
        baselinePath,
        latestPath,
        width: guideMetadata.width,
        height: guideMetadata.height,
        diffStats: Object.freeze({
            atmosflat029: atmosflat029Diff.stats,
            atmosflatLatest: atmosflatLatestDiff.stats,
            baselineLatest: baselineLatestDiff.stats,
        }),
    }));

    await appendRunLog(
        recordDirectory,
        `m2LocalFlatWarningFixStackComparison scene=${scene.id} diff-complete atmosflat029Max=${atmosflat029Diff.stats.maxAbsRgbaDelta} atmosflatLatestMax=${atmosflatLatestDiff.stats.maxAbsRgbaDelta} baselineLatestMax=${baselineLatestDiff.stats.maxAbsRgbaDelta}.`,
    );
}

const layout = buildLayout(rows[0].width, rows[0].height, rows.length);
const composites = [];

for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const diffs = diffBuffers[rowIndex];
    const top = layout.firstRowTop + rowIndex * (layout.imageHeight + layout.rowGap);

    composites.push(
        Object.freeze({ input: row.guidePath, left: layout.columnXs[0], top }),
        Object.freeze({ input: row.baselinePath, left: layout.columnXs[1], top }),
        makeRawComposite(diffs.atmosflat029, row, layout.columnXs[2], top),
        Object.freeze({ input: row.latestPath, left: layout.columnXs[3], top }),
        makeRawComposite(diffs.atmosflatLatest, row, layout.columnXs[4], top),
        makeRawComposite(diffs.baselineLatest, row, layout.columnXs[5], top),
    );
}

composites.push(Object.freeze({
    input: Buffer.from(buildLabelSvg(rows, layout)),
    left: 0,
    top: 0,
}));

await appendRunLog(recordDirectory, `m2LocalFlatWarningFixStackComparison composite-started output=${outputPath}.`);

await sharp({
    create: {
        width: layout.outputWidth,
        height: layout.outputHeight,
        channels: 4,
        background: `${comparisonBackground}ff`,
    },
})
    .composite(composites)
    .png()
    .toFile(outputPath);

const fileStats = await stat(outputPath);

await appendRunLog(recordDirectory, `m2LocalFlatWarningFixStackComparison composite-complete bytes=${fileStats.size}.`);

assert(fileStats.size > 0, 'Six-column stack PNG must be nonempty.');

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Create a single image stack comparing atmosflat Step 018 guide skydomes,
record 029 pre-warning-fix skydomes, and latest post-warning-fix skydomes in
the requested six-column order.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'User-requested post-warning-fix six-column local/flat comparison stack',
    guideRoot,
    baselineRecordDirectory,
    latestRecordDirectory,
    baselineRoot,
    latestRoot,
    scenes: rows.map((row) => Object.freeze({
        sceneId: row.sceneId,
        offsetDegrees: row.offsetDegrees,
        guideImageFilename: row.guideImageFilename,
    })),
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes',
        'tmp/atmosphere/reconciliation/029-m2-local-flat-assets',
        'tmp/atmosphere/reconciliation/037-m2-coordinate-warning-fix-check',
        'tmp/atmosphere/reconciliation/038-m2-warning-fix-local-flat-assets',
        'agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'warning-fix-diagnostic-stack-generated',
    layout,
    comparisonPolicy: {
        columns: [
            'atmosflat Step 018 guide imagery',
            'record 029 pre-warning-fix reconciliation imagery',
            'visual absolute difference: atmosflat vs 029',
            'latest post-warning-fix reconciliation imagery',
            'visual absolute difference: atmosflat vs latest',
            'visual absolute difference: 029 vs latest',
        ],
        diffVisualScale,
        comparisonBackground,
        exactParityTarget: false,
    },
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        {
            name: 'single six-column stack PNG written',
            status: 'accepted',
            result: outputPath,
        },
        {
            name: 'all five rotation rows included',
            status: rows.length === M2_LOCAL_FLAT_SEED_CONSTANTS.scenes.length ? 'accepted' : 'rejected',
            result: `${rows.length} rows included.`,
        },
        {
            name: 'all source image dimensions match per row',
            status: 'accepted',
            result: `${rows[0].width}x${rows[0].height} per source image.`,
        },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', {
    output: {
        outputPath,
        fileSizeBytes: fileStats.size,
        width: layout.outputWidth,
        height: layout.outputHeight,
        diffVisualScale,
        comparisonBackground,
    },
    rows,
});
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatWarningFixStackComparison.js --record ${recordDirectory} --baseline-record ${baselineRecordDirectory} --latest-record ${latestRecordDirectory}`,
            purpose: 'Create a six-column stack comparing atmosflat, record 029, latest domes, and the requested visual diffs.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'Created the requested six-column diagnostic skydome stack after regenerating local/flat domes with the coordinate-warning fix in place.',
    runtimeCodeChanged: true,
    outputPath,
    rowCount: rows.length,
    columnOrder: [
        'atmosflat',
        '029',
        'diff atmosflat vs 029',
        'latest',
        'diff atmosflat vs latest',
        'diff 029 vs latest',
    ],
    nextStep: 'Inspect the baseline/latest difference column to determine whether the coordinate-warning fix changed visible local/flat output.',
});
await writeText(recordDirectory, 'report.md', `# Report

Created one six-column skydome comparison stack:

\`${outputPath}\`

Column order:

1. atmosflat Step 018 guide imagery
2. record 029 pre-warning-fix reconciliation imagery
3. absolute diff x${diffVisualScale}: atmosflat vs 029
4. latest post-warning-fix reconciliation imagery from \`${latestRecordDirectory}\`
5. absolute diff x${diffVisualScale}: atmosflat vs latest
6. absolute diff x${diffVisualScale}: 029 vs latest
`);
await appendRunLog(recordDirectory, `m2LocalFlatWarningFixStackComparison accepted rows=${rows.length} output=${outputPath}.`);

console.log(JSON.stringify({
    status: 'accepted',
    outputPath,
    rowCount: rows.length,
    width: layout.outputWidth,
    height: layout.outputHeight,
}));

function parseStringOption(argv, optionName, defaultValue) {
    const optionIndex = argv.indexOf(optionName);

    if (optionIndex === -1) {
        return defaultValue;
    }

    return argv[optionIndex + 1] ?? defaultValue;
}

function assertSameDimensions(left, right, label) {
    assert(left.width === right.width, `${label} widths must match.`);
    assert(left.height === right.height, `${label} heights must match.`);
}

function buildLayout(imageWidth, imageHeight, rowCount) {
    const padding = 18;
    const labelWidth = 108;
    const columnGap = 20;
    const headerHeight = 44;
    const rowGap = 12;
    const firstColumnX = padding + labelWidth;
    const columnXs = Object.freeze(Array.from({ length: 6 }, (_, index) =>
        firstColumnX + index * (imageWidth + columnGap)));
    const firstRowTop = padding + headerHeight;

    return Object.freeze({
        padding,
        labelWidth,
        columnGap,
        headerHeight,
        rowGap,
        imageWidth,
        imageHeight,
        columnXs,
        firstRowTop,
        outputWidth: padding + labelWidth + 6 * imageWidth + 5 * columnGap + padding,
        outputHeight: firstRowTop + rowCount * imageHeight + (rowCount - 1) * rowGap + padding,
    });
}

function buildLabelSvg(rows, layout) {
    const textRows = rows.map((row, rowIndex) => {
        const y = layout.firstRowTop + rowIndex * (layout.imageHeight + layout.rowGap) + layout.imageHeight / 2;

        return `<text x="${layout.padding}" y="${y}" class="row">${escapeXml(`${row.offsetDegrees} deg`)}</text>`;
    }).join('\n');
    const headers = [
        'atmosflat',
        '029',
        'diff a/029',
        'latest',
        'diff a/latest',
        'diff 029/latest',
    ].map((label, index) =>
        `<text x="${layout.columnXs[index]}" y="${layout.padding + 26}" class="header">${escapeXml(label)}</text>`)
        .join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.outputWidth}" height="${layout.outputHeight}" viewBox="0 0 ${layout.outputWidth} ${layout.outputHeight}">
    <style>
        .header { fill: #f4f6fb; font: 700 16px Arial, sans-serif; }
        .row { fill: #c7ccd8; font: 700 17px Arial, sans-serif; dominant-baseline: middle; }
        .note { fill: #8991a3; font: 12px Arial, sans-serif; }
    </style>
    ${headers}
    <text x="${layout.padding}" y="${layout.padding + 26}" class="note">offset</text>
    ${textRows}
</svg>`;
}

function makeRawComposite(buffer, row, left, top) {
    return Object.freeze({
        input: buffer,
        raw: {
            width: row.width,
            height: row.height,
            channels: 4,
        },
        left,
        top,
    });
}

async function createDiffBuffer(leftPath, rightPath, width, height, visualScale, background, progress) {
    const left = await readCompositedRgba(leftPath, background);
    const right = await readCompositedRgba(rightPath, background);
    const diff = Buffer.alloc(width * height * 4);
    let maxAbsRgbaDelta = 0;
    let totalAbsDelta = 0;
    let totalSquaredDelta = 0;

    await emitDiffProgress(progress, 'started', 0, height);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;

            for (let channelIndex = 0; channelIndex < 4; channelIndex += 1) {
                const delta = Math.abs(left[offset + channelIndex] - right[offset + channelIndex]);

                maxAbsRgbaDelta = Math.max(maxAbsRgbaDelta, delta);
                totalAbsDelta += delta;
                totalSquaredDelta += delta * delta;

                if (channelIndex < 3) {
                    diff[offset + channelIndex] = Math.min(255, delta * visualScale);
                }
            }

            diff[offset + 3] = 255;
        }

        if ((y + 1) % 32 === 0 || y + 1 === height) {
            await emitDiffProgress(progress, 'row-complete', y + 1, height);
        }
    }

    return Object.freeze({
        buffer: diff,
        stats: Object.freeze({
            maxAbsRgbaDelta,
            meanAbsRgbaDelta: totalAbsDelta / diff.length,
            rmseRgbaDelta: Math.sqrt(totalSquaredDelta / diff.length),
        }),
    });
}

function makeDiffProgressLogger(sceneId, pair) {
    return (progress) => appendRunLog(
        recordDirectory,
        `m2LocalFlatWarningFixStackComparison diff-progress scene=${sceneId} pair=${pair} stage=${progress.stage} rows=${progress.completedRows}/${progress.totalRows}.`,
    );
}

async function emitDiffProgress(progress, stage, completedRows, totalRows) {
    if (typeof progress === 'function') {
        await progress(Object.freeze({ stage, completedRows, totalRows }));
    }
}

async function readCompositedRgba(imagePath, background) {
    return sharp(imagePath)
        .flatten({ background })
        .ensureAlpha()
        .raw()
        .toBuffer();
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
