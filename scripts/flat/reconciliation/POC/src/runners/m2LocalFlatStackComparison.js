// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.5 diagnostic imagery.
// - tmp/atmosphere/reconciliation/NNN-m2-local-flat-assets, full-size local/flat PNG artifacts.
// - tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes, historical guide imagery.

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
const sourceRecordDirectory = parseStringOption(
    process.argv,
    '--source-record',
    'tmp/atmosphere/reconciliation/029-m2-local-flat-assets',
);
const guideRoot = M2_LOCAL_FLAT_SEED_CONSTANTS.guideArtifactRoot;
const newRoot = resolve(sourceRecordDirectory, 'artifacts');
const artifactDirectory = resolve(recordDirectory, 'artifacts');
const outputPath = resolve(artifactDirectory, 'local-flat-skydome-side-by-side-stack.png');
const diffVisualScale = 3;
const comparisonBackground = '#101114';
const rows = [];
const diffBuffers = [];

await appendRunLog(recordDirectory, `m2LocalFlatStackComparison started sourceRecord=${sourceRecordDirectory}.`);
await mkdir(artifactDirectory, { recursive: true });

for (const scene of M2_LOCAL_FLAT_SEED_CONSTANTS.scenes) {
    await appendRunLog(recordDirectory, `m2LocalFlatStackComparison scene=${scene.id} metadata-started.`);

    const guidePath = resolve(guideRoot, scene.guideImageFilename);
    const newPath = resolve(newRoot, scene.guideImageFilename);
    const guideMetadata = await sharp(guidePath).metadata();
    const newMetadata = await sharp(newPath).metadata();

    assert(guideMetadata.width === newMetadata.width, 'Guide and new skydome image widths must match.');
    assert(guideMetadata.height === newMetadata.height, 'Guide and new skydome image heights must match.');

    const diff = await createDiffBuffer(
        guidePath,
        newPath,
        guideMetadata.width,
        guideMetadata.height,
        diffVisualScale,
        comparisonBackground,
        (progress) => appendRunLog(
            recordDirectory,
            `m2LocalFlatStackComparison diff-progress scene=${scene.id} stage=${progress.stage} rows=${progress.completedRows}/${progress.totalRows}.`,
        ),
    );

    diffBuffers.push(diff.buffer);
    rows.push(Object.freeze({
        sceneId: scene.id,
        offsetDegrees: scene.offsetDegrees,
        guideImageFilename: scene.guideImageFilename,
        guidePath,
        newPath,
        width: guideMetadata.width,
        height: guideMetadata.height,
        diffStats: diff.stats,
    }));

    await appendRunLog(recordDirectory, `m2LocalFlatStackComparison scene=${scene.id} diff-complete maxAbsRgbaDelta=${diff.stats.maxAbsRgbaDelta}.`);
}

const layout = buildLayout(rows[0].width, rows[0].height, rows.length);
const composites = [];

for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const top = layout.firstRowTop + rowIndex * (layout.imageHeight + layout.rowGap);

    composites.push(
        Object.freeze({ input: row.guidePath, left: layout.leftColumnX, top }),
        Object.freeze({ input: row.newPath, left: layout.rightColumnX, top }),
        Object.freeze({
            input: diffBuffers[rowIndex],
            raw: {
                width: row.width,
                height: row.height,
                channels: 4,
            },
            left: layout.diffColumnX,
            top,
        }),
    );
}

composites.push(Object.freeze({
    input: Buffer.from(buildLabelSvg(rows, layout)),
    left: 0,
    top: 0,
}));

await appendRunLog(recordDirectory, `m2LocalFlatStackComparison composite-started output=${outputPath}.`);

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

await appendRunLog(recordDirectory, `m2LocalFlatStackComparison composite-complete bytes=${fileStats.size}.`);

assert(fileStats.size > 0, 'Side-by-side stack PNG must be nonempty.');

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Create a single image stack comparing the atmosflat Step 018 guide skydomes on
the left, the M2 reconciliation local/flat skydomes in the middle, and a visual
absolute-difference image as the third column.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'User-requested M2 local/flat side-by-side skydome stack',
    guideRoot,
    sourceRecordDirectory,
    newRoot,
    scenes: rows.map((row) => Object.freeze({
        sceneId: row.sceneId,
        offsetDegrees: row.offsetDegrees,
        guideImageFilename: row.guideImageFilename,
    })),
    runtimeCodeChanged: false,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes',
        sourceRecordDirectory,
        'agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'diagnostic-stack-generated',
    layout,
    comparisonPolicy: {
        leftColumn: 'atmosflat Step 018 guide imagery',
        middleColumn: 'M2 reconciliation generated imagery',
        rightColumn: 'visual absolute difference against composited pixels',
        diffVisualScale,
        comparisonBackground,
        exactParityTarget: false,
    },
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        {
            name: 'single stack PNG written',
            status: 'accepted',
            result: outputPath,
        },
        {
            name: 'all five rotation rows included',
            status: rows.length === M2_LOCAL_FLAT_SEED_CONSTANTS.scenes.length ? 'accepted' : 'rejected',
            result: `${rows.length} rows included.`,
        },
        {
            name: 'left/middle/right image dimensions match per row',
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
            command: `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatStackComparison.js --record ${recordDirectory} --source-record ${sourceRecordDirectory}`,
            purpose: 'Create a side-by-side stacked PNG comparing atmosflat guide skydomes to M2 reconciliation skydomes.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'Created a single diagnostic skydome stack with atmosflat guide images on the left, M2 reconciliation images in the middle, and visual absolute differences on the right.',
    runtimeCodeChanged: false,
    outputPath,
    rowCount: rows.length,
    nextStep: 'Continue to Subgoal 2.6 closeout when requested.',
});
await writeText(recordDirectory, 'report.md', `# Report

Created one side-by-side skydome comparison stack:

\`${outputPath}\`

The left column is the atmosflat Step 018 guide output. The middle column is
the M2 reconciliation output from \`${sourceRecordDirectory}\`. The right
column is an absolute-difference image, visually scaled by ${diffVisualScale}x.
`);
await appendRunLog(recordDirectory, `m2LocalFlatStackComparison accepted rows=${rows.length} output=${outputPath}.`);

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

function buildLayout(imageWidth, imageHeight, rowCount) {
    const padding = 18;
    const labelWidth = 108;
    const columnGap = 20;
    const headerHeight = 44;
    const rowGap = 12;
    const leftColumnX = padding + labelWidth;
    const rightColumnX = leftColumnX + imageWidth + columnGap;
    const diffColumnX = rightColumnX + imageWidth + columnGap;
    const firstRowTop = padding + headerHeight;

    return Object.freeze({
        padding,
        labelWidth,
        columnGap,
        headerHeight,
        rowGap,
        imageWidth,
        imageHeight,
        leftColumnX,
        rightColumnX,
        diffColumnX,
        firstRowTop,
        outputWidth: padding + labelWidth + imageWidth + columnGap + imageWidth + columnGap + imageWidth + padding,
        outputHeight: firstRowTop + rowCount * imageHeight + (rowCount - 1) * rowGap + padding,
    });
}

function buildLabelSvg(rows, layout) {
    const textRows = rows.map((row, rowIndex) => {
        const y = layout.firstRowTop + rowIndex * (layout.imageHeight + layout.rowGap) + layout.imageHeight / 2;

        return `<text x="${layout.padding}" y="${y}" class="row">${escapeXml(`${row.offsetDegrees} deg`)}</text>`;
    }).join('\n');
    const headerY = layout.padding + 26;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.outputWidth}" height="${layout.outputHeight}" viewBox="0 0 ${layout.outputWidth} ${layout.outputHeight}">
    <style>
        .header { fill: #f4f6fb; font: 700 18px Arial, sans-serif; }
        .row { fill: #c7ccd8; font: 700 17px Arial, sans-serif; dominant-baseline: middle; }
        .note { fill: #8991a3; font: 12px Arial, sans-serif; }
    </style>
    <text x="${layout.leftColumnX}" y="${headerY}" class="header">atmosflat Step 018</text>
    <text x="${layout.rightColumnX}" y="${headerY}" class="header">reconciliation M2</text>
    <text x="${layout.diffColumnX}" y="${headerY}" class="header">absolute diff x3</text>
    <text x="${layout.padding}" y="${headerY}" class="note">offset</text>
    ${textRows}
</svg>`;
}

async function createDiffBuffer(guidePath, newPath, width, height, visualScale, background, progress) {
    const guide = await readCompositedRgba(guidePath, background);
    const generated = await readCompositedRgba(newPath, background);
    const diff = Buffer.alloc(width * height * 4);
    let maxAbsRgbaDelta = 0;
    let totalAbsDelta = 0;
    let totalSquaredDelta = 0;

    await emitDiffProgress(progress, 'started', 0, height);

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;

            for (let channelIndex = 0; channelIndex < 4; channelIndex += 1) {
                const delta = Math.abs(guide[offset + channelIndex] - generated[offset + channelIndex]);

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
