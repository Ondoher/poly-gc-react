// References:
// - tmp/atmosphere/reconciliation/427-m3-gpu-quality-perceptual-comparison-320x180.
// - scripts/flat/reconciliation/POC/src/runners/m3ShaderQualityProfileComparison.js.

import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import sharp from 'sharp';

import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const comparisonRecordDirectory = requiredStringArg('--comparison-record');
const idealRecordDirectory = requiredStringArg('--ideal-record');
const diffKind = optionalStringArg('--diff-kind', 'absolute');
const outputImagePath = resolve(recordDirectory, 'images', outputFileNameForDiffKind(diffKind));
const failures = [];

await appendRunLog(recordDirectory, 'm3ShaderQualityComposite started.');
await mkdir(resolve(recordDirectory, 'images'), { recursive: true });

let comparisonDiagnostics = null;
let idealImagePath = null;
let rows = [];
let composite = null;

try {
    comparisonDiagnostics = await readJson(resolve(comparisonRecordDirectory, 'diagnostics.json'));
    idealImagePath = resolve(idealRecordDirectory, 'images', 'canvas-image.png');
    rows = comparisonDiagnostics.comparisons.map((entry) => compositeRowFromComparison(entry, diffKind));
    composite = await writeCompositeImage({
        idealImagePath,
        rows,
        outputImagePath,
        diffKind,
    });
} catch (error) {
    failures.push(failure('shader-quality-composite-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('diff-kind-supported', isSupportedDiffKind(diffKind)),
    criterion('comparison-record-read', Boolean(comparisonDiagnostics)),
    criterion('rows-present', rows.length > 0),
    criterion('composite-image-written', typeof composite?.outputImagePath === 'string'),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Shader quality composite criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Create a single composite image for the shader quality candidates. Each
candidate row shows the ideal render on the left, the candidate render in the
middle, and the selected candidate-vs-ideal diff view on the right.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5-shader-quality-candidate-composite',
    runner: 'm3ShaderQualityComposite',
    comparisonRecordDirectory,
    idealRecordDirectory,
    diffKind,
    idealImagePath,
    outputImagePath,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        comparisonRecordDirectory,
        idealRecordDirectory,
        'scripts/flat/reconciliation/POC/src/runners/m3ShaderQualityProfileComparison.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    idealImagePath,
    rows,
    composite,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3ShaderQualityComposite.js --record ${recordDirectory} --comparison-record ${comparisonRecordDirectory} --ideal-record ${idealRecordDirectory} --diff-kind ${diffKind}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    outputImagePath: composite?.outputImagePath ?? null,
});
await writeText(recordDirectory, 'report.md', `# Report

Shader quality candidate composite finished with status: ${status}.

- Comparison record: \`${comparisonRecordDirectory}\`
- Ideal record: \`${idealRecordDirectory}\`
- Diff kind: \`${diffKind}\`
- Composite image: \`${composite?.outputImagePath ?? 'not-written'}\`
- Candidate rows: \`${rows.length}\`

Each row is arranged as \`${layoutDescriptionForKind(diffKind)}\`.
`);
await appendRunLog(recordDirectory, `m3ShaderQualityComposite ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    outputImagePath: composite?.outputImagePath ?? null,
}));

function compositeRowFromComparison(entry, diffKind) {
    const candidate = entry.candidate;
    const summary = entry.comparison;
    const perceptualDiffSummary = entry.perceptualDiffSummary ?? null;

    return Object.freeze({
        profileId: candidate.profile?.id ?? 'unknown',
        candidateImagePath: candidate.canvasImagePath,
        absoluteDiffImagePath: entry.diffImagePath,
        perceptualDiffImagePath: entry.perceptualDiffImagePath ?? null,
        diffImagePath: selectedDiffImagePath(entry, diffKind),
        diffKind,
        estimatedWorkRatioToIdeal: candidate.profile?.estimatedWorkRatioToIdeal ?? null,
        meanAbsRgbaDelta: summary.meanAbsRgbaDelta,
        meanAbsDisplayLumaDelta: summary.perceptualProxy?.meanAbsDisplayLumaDelta ?? null,
        rmseDisplayLumaDelta: summary.perceptualProxy?.rmseDisplayLumaDelta ?? null,
        detectablePixelFraction: perceptualDiffSummary?.detectablePixelFraction ?? null,
        meanResidualDeltaE2000: perceptualDiffSummary?.meanResidualDeltaE2000 ?? null,
    });
}

async function writeCompositeImage({ idealImagePath, rows, outputImagePath, diffKind }) {
    const idealMetadata = await sharp(idealImagePath).metadata();
    const imageWidth = idealMetadata.width;
    const imageHeight = idealMetadata.height;
    const layout = buildLayout(imageWidth, imageHeight, rows.length, diffKind);
    const composites = [{
        input: Buffer.from(buildLabelSvg(rows, layout, diffKind)),
        left: 0,
        top: 0,
    }];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const top = layout.firstImageTop + rowIndex * layout.rowStride;

        composites.push(
            { input: idealImagePath, left: layout.idealX, top },
            { input: row.candidateImagePath, left: layout.candidateX, top },
            { input: row.diffImagePath, left: layout.diffX, top },
        );

        if (diffKind === 'absolute-and-perceptual') {
            composites.push({
                input: row.perceptualDiffImagePath,
                left: layout.perceptualDiffX,
                top,
            });
        }
    }

    await sharp({
        create: {
            width: layout.outputWidth,
            height: layout.outputHeight,
            channels: 4,
            background: '#10151d',
        },
    })
        .composite(composites)
        .png()
        .toFile(outputImagePath);

    return Object.freeze({
        outputImagePath,
        layout,
    });
}

function buildLayout(imageWidth, imageHeight, rowCount, diffKind) {
    const padding = 18;
    const columnGap = 10;
    const headerHeight = 38;
    const captionHeight = 26;
    const rowGap = 14;
    const idealX = padding;
    const candidateX = idealX + imageWidth + columnGap;
    const diffX = candidateX + imageWidth + columnGap;
    const perceptualDiffX = diffX + imageWidth + columnGap;
    const firstImageTop = padding + headerHeight + captionHeight;
    const rowStride = captionHeight + imageHeight + rowGap;
    const columnCount = diffKind === 'absolute-and-perceptual' ? 4 : 3;

    return Object.freeze({
        padding,
        columnGap,
        headerHeight,
        captionHeight,
        rowGap,
        imageWidth,
        imageHeight,
        idealX,
        candidateX,
        diffX,
        perceptualDiffX,
        firstImageTop,
        rowStride,
        outputWidth: padding + imageWidth * columnCount + columnGap * (columnCount - 1) + padding,
        outputHeight: firstImageTop + rowCount * imageHeight + Math.max(0, rowCount - 1) * (captionHeight + rowGap) + padding,
    });
}

function buildLabelSvg(rows, layout, diffKind) {
    const headerY = layout.padding + 24;
    const rowLabels = rows.map((row, rowIndex) => {
        const y = layout.firstImageTop + rowIndex * layout.rowStride - 7;
        const caption = rowCaption(row, diffKind);

        return `<text x="${layout.idealX}" y="${y}" class="caption">${escapeXml(caption)}</text>`;
    }).join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.outputWidth}" height="${layout.outputHeight}" viewBox="0 0 ${layout.outputWidth} ${layout.outputHeight}">
    <style>
        .header { fill: #f3f6fb; font: 700 18px Arial, sans-serif; }
        .caption { fill: #c7cedd; font: 700 15px Arial, sans-serif; }
    </style>
    <text x="${layout.idealX}" y="${headerY}" class="header">ideal</text>
    <text x="${layout.candidateX}" y="${headerY}" class="header">candidate</text>
    <text x="${layout.diffX}" y="${headerY}" class="header">${escapeXml(diffLabelForKind(diffKind))}</text>
    ${diffKind === 'absolute-and-perceptual'
        ? `<text x="${layout.perceptualDiffX}" y="${headerY}" class="header">perceptual diff</text>`
        : ''}
    ${rowLabels}
</svg>`;
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

function optionalStringArg(name, defaultValue) {
    const index = process.argv.indexOf(name);

    if (index < 0 || index + 1 >= process.argv.length || process.argv[index + 1].startsWith('--')) {
        return defaultValue;
    }

    return process.argv[index + 1];
}

function selectedDiffImagePath(entry, diffKind) {
    if (diffKind === 'absolute' || diffKind === 'absolute-and-perceptual') {
        return entry.diffImagePath;
    }

    if (diffKind === 'perceptual-visible' && entry.perceptualDiffImagePath) {
        return entry.perceptualDiffImagePath;
    }

    throw new Error(`Comparison record does not contain a ${diffKind} diff image for ${entry.candidate?.profile?.id ?? 'unknown'}.`);
}

function outputFileNameForDiffKind(diffKind) {
    if (diffKind === 'perceptual-visible') {
        return 'quality-candidates-ideal-candidate-detectable-diff.png';
    }

    if (diffKind === 'absolute-and-perceptual') {
        return 'quality-candidates-ideal-candidate-diff-perceptual-diff.png';
    }

    return 'quality-candidates-ideal-candidate-diff.png';
}

function diffLabelForKind(diffKind) {
    if (diffKind === 'perceptual-visible') {
        return 'detectable diff';
    }

    return 'diff x4';
}

function rowCaption(row, diffKind) {
    const parts = [
        row.profileId,
        `work ${formatPercent(row.estimatedWorkRatioToIdeal)}`,
        `mean ${formatNumber(row.meanAbsRgbaDelta)}`,
        `luma ${formatNumber(row.meanAbsDisplayLumaDelta)}`,
    ];

    if (diffKind === 'perceptual-visible' || diffKind === 'absolute-and-perceptual') {
        parts.push(
            `visible ${formatPercent(row.detectablePixelFraction)}`,
            `residual dE ${formatNumber(row.meanResidualDeltaE2000)}`,
        );
    }

    return parts.join('  |  ');
}

function isSupportedDiffKind(diffKind) {
    return diffKind === 'absolute'
        || diffKind === 'perceptual-visible'
        || diffKind === 'absolute-and-perceptual';
}

function layoutDescriptionForKind(diffKind) {
    if (diffKind === 'absolute-and-perceptual') {
        return 'ideal | candidate | diff x4 | perceptual diff';
    }

    return `ideal | candidate | ${diffLabelForKind(diffKind)}`;
}

function formatPercent(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function formatNumber(value) {
    return Number.isFinite(value) ? Number(value).toFixed(2) : 'n/a';
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
