// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.5 diagnostic imagery.
// - agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md, ext-018 finite dome domain.
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
    'tmp/atmosphere/reconciliation/040-m2-observer-centered-dome-local-flat-assets',
);
const guideRoot = M2_LOCAL_FLAT_SEED_CONSTANTS.guideArtifactRoot;
const newRoot = resolve(sourceRecordDirectory, 'artifacts');
const artifactDirectory = resolve(recordDirectory, 'artifacts');
const outputPath = resolve(artifactDirectory, 'local-flat-observer-dome-side-by-side-stack.png');
const comparisonBackground = '#101114';
const rows = [];

await appendRunLog(recordDirectory, `m2LocalFlatGuideSideBySideStack started sourceRecord=${sourceRecordDirectory}.`);
await mkdir(artifactDirectory, { recursive: true });

for (const scene of M2_LOCAL_FLAT_SEED_CONSTANTS.scenes) {
    await appendRunLog(recordDirectory, `m2LocalFlatGuideSideBySideStack scene=${scene.id} metadata-started.`);

    const guidePath = resolve(guideRoot, scene.guideImageFilename);
    const newPath = resolve(newRoot, scene.guideImageFilename);
    const guideMetadata = await sharp(guidePath).metadata();
    const newMetadata = await sharp(newPath).metadata();

    assertSameDimensions(guideMetadata, newMetadata, 'atmosflat and observer-dome skydome images');

    rows.push(Object.freeze({
        sceneId: scene.id,
        offsetDegrees: scene.offsetDegrees,
        guideImageFilename: scene.guideImageFilename,
        guidePath,
        newPath,
        width: guideMetadata.width,
        height: guideMetadata.height,
    }));

    await appendRunLog(recordDirectory, `m2LocalFlatGuideSideBySideStack scene=${scene.id} metadata-complete width=${guideMetadata.width} height=${guideMetadata.height}.`);
}

const layout = buildLayout(rows[0].width, rows[0].height, rows.length);
const composites = [];

for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const top = layout.firstRowTop + rowIndex * (layout.imageHeight + layout.rowGap);

    composites.push(
        Object.freeze({ input: row.guidePath, left: layout.leftColumnX, top }),
        Object.freeze({ input: row.newPath, left: layout.rightColumnX, top }),
    );
}

composites.push(Object.freeze({
    input: Buffer.from(buildLabelSvg(rows, layout)),
    left: 0,
    top: 0,
}));

await appendRunLog(recordDirectory, `m2LocalFlatGuideSideBySideStack composite-started output=${outputPath}.`);

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

await appendRunLog(recordDirectory, `m2LocalFlatGuideSideBySideStack composite-complete bytes=${fileStats.size}.`);

assert(fileStats.size > 0, 'Two-column side-by-side stack PNG must be nonempty.');

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Create a single two-column image stack comparing atmosflat Step 018 guide
skydomes beside the latest observer-centered finite-dome reconciliation
skydomes. Do not include a diff column.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'User-requested atmosflat beside new observer-centered dome stack without a diff',
    guideRoot,
    sourceRecordDirectory,
    newRoot,
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
        sourceRecordDirectory,
        'agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md',
        'agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'two-column-diagnostic-stack-generated',
    layout,
    comparisonPolicy: {
        leftColumn: 'atmosflat Step 018 guide imagery',
        rightColumn: 'M2 reconciliation observer-centered finite-dome imagery',
        diffColumnIncluded: false,
        comparisonBackground,
        exactParityTarget: false,
    },
    observerCenteredDome: M2_LOCAL_FLAT_SEED_CONSTANTS.observerCenteredDome,
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        {
            name: 'single two-column stack PNG written',
            status: 'accepted',
            result: outputPath,
        },
        {
            name: 'all five rotation rows included',
            status: rows.length === M2_LOCAL_FLAT_SEED_CONSTANTS.scenes.length ? 'accepted' : 'rejected',
            result: `${rows.length} rows included.`,
        },
        {
            name: 'source image dimensions match per row',
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
        comparisonBackground,
    },
    rows,
});
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatGuideSideBySideStack.js --record ${recordDirectory} --source-record ${sourceRecordDirectory}`,
            purpose: 'Create a two-column stacked PNG comparing atmosflat guide skydomes beside observer-centered dome reconciliation skydomes.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'Created a single diagnostic skydome stack with atmosflat guide images on the left and observer-centered finite-dome reconciliation images on the right, with no diff column.',
    runtimeCodeChanged: true,
    outputPath,
    rowCount: rows.length,
    columnOrder: [
        'atmosflat',
        'observer-centered finite-dome reconciliation',
    ],
    nextStep: 'Inspect as subjective M2 model-review evidence; Step 018 remains guide imagery only.',
});
await writeText(recordDirectory, 'report.md', `# Report

Created one two-column skydome comparison stack:

\`${outputPath}\`

The left column is atmosflat Step 018 guide imagery. The right column is the
observer-centered finite-dome reconciliation output from
\`${sourceRecordDirectory}\`. No diff column was generated.
`);
await appendRunLog(recordDirectory, `m2LocalFlatGuideSideBySideStack accepted rows=${rows.length} output=${outputPath}.`);

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
    const leftColumnX = padding + labelWidth;
    const rightColumnX = leftColumnX + imageWidth + columnGap;
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
        firstRowTop,
        outputWidth: padding + labelWidth + 2 * imageWidth + columnGap + padding,
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
    <text x="${layout.rightColumnX}" y="${headerY}" class="header">observer dome POC</text>
    <text x="${layout.padding}" y="${headerY}" class="note">offset</text>
    ${textRows}
</svg>`;
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
