// References:
// - scripts/flat/reconciliation/POC/src/runners/m3CpuIntegratedFlatLocalSunScene.js,
//   integrated CPU flat/local source row renderer.
// - agents/topics/apps/flat/reconciliation/status.md, flat/local review evidence.

import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import sharp from 'sharp';

import {
    appendRunLog,
    assert,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const sourceRecordDirectories = stringListArg('--source-records');
const rowLabels = stringListArg('--row-labels');
const outputName = stringArg('--output-name', 'local-sun-tilted-up-phase-stack.png');
const labelWidth = numberArg('--label-width', 46);
const imagesDirectory = resolve(recordDirectory, 'images');
const outputImagePath = resolve(imagesDirectory, outputName);
const failures = [];

await appendRunLog(recordDirectory, 'm3CpuIntegratedFlatLocalSunPhaseStack started.');

let stack = null;

try {
    assert(sourceRecordDirectories.length > 0, '--source-records requires at least one source record directory.');
    assert(rowLabels.length === sourceRecordDirectories.length, '--row-labels count must match --source-records count.');

    const rows = sourceRecordDirectories.map((sourceRecordDirectory, index) => Object.freeze({
        label: rowLabels[index],
        sourceRecordDirectory,
        imagePath: resolve(sourceRecordDirectory, 'images', 'canvas-image.png'),
    }));

    stack = await writePhaseStack(rows);
} catch (error) {
    failures.push(failure('local-sun-phase-stack-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('source-records-present', sourceRecordDirectories.length > 0),
    criterion('row-labels-match-source-records', rowLabels.length === sourceRecordDirectories.length),
    criterion('stack-image-written', typeof stack?.outputImagePath === 'string' && stack.fileSizeBytes > 0),
]);
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Local Sun phase stack criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Create a single stacked review image from integrated CPU flat/local Sun phase
renders. The rows preserve their source rendered pixels and use only a narrow
label strip for phase identification.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: 'm3-cpu-integrated-flat-local-sun-phase-stack',
    runner: 'm3CpuIntegratedFlatLocalSunPhaseStack',
    sourceRecordDirectories,
    rowLabels,
    outputName,
    labelWidth,
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'result.json', {
    status,
    outputImagePath: stack?.outputImagePath ?? null,
    width: stack?.width ?? null,
    height: stack?.height ?? null,
    rowCount: stack?.rowCount ?? null,
    fileSizeBytes: stack?.fileSizeBytes ?? null,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: runnerInvocationCommand(),
        timestamp: nowIso(),
    }]),
});
await writeText(recordDirectory, 'report.md', `# Report

Local Sun phase stack finished with status: ${status}.

- Stack image: \`${stack?.outputImagePath ?? 'not-written'}\`
- Row order: ${rowLabels.join(', ')}
- Source records: ${sourceRecordDirectories.map((entry) => `\`${entry}\``).join(', ')}
`);
await appendRunLog(recordDirectory, `m3CpuIntegratedFlatLocalSunPhaseStack ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    outputImagePath: stack?.outputImagePath ?? null,
    width: stack?.width ?? null,
    height: stack?.height ?? null,
    rowCount: stack?.rowCount ?? null,
    failureCount: failures.length,
}));

async function writePhaseStack(rows) {
    const metadataRows = [];

    for (const row of rows) {
        const metadata = await sharp(row.imagePath).metadata();
        metadataRows.push(Object.freeze({
            ...row,
            width: metadata.width,
            height: metadata.height,
        }));
    }

    const imageWidth = metadataRows[0].width;
    const imageHeight = metadataRows[0].height;
    assert(Number.isInteger(imageWidth) && imageWidth > 0, 'Source image width must be positive.');
    assert(Number.isInteger(imageHeight) && imageHeight > 0, 'Source image height must be positive.');
    assert(
        metadataRows.every((row) => row.width === imageWidth && row.height === imageHeight),
        'All source images must have matching dimensions.',
    );

    const outputWidth = labelWidth + imageWidth;
    const outputHeight = imageHeight * metadataRows.length;
    const composites = [
        Object.freeze({
            input: Buffer.from(buildLabelSvg(metadataRows, {
                outputWidth,
                outputHeight,
                imageHeight,
                labelWidth,
            })),
            left: 0,
            top: 0,
        }),
    ];

    for (let rowIndex = 0; rowIndex < metadataRows.length; rowIndex += 1) {
        composites.push(Object.freeze({
            input: metadataRows[rowIndex].imagePath,
            left: labelWidth,
            top: rowIndex * imageHeight,
        }));
    }

    await mkdir(imagesDirectory, { recursive: true });

    await sharp({
        create: {
            width: outputWidth,
            height: outputHeight,
            channels: 4,
            background: '#10151dff',
        },
    })
        .composite(composites)
        .png()
        .toFile(outputImagePath);

    const fileStats = await stat(outputImagePath);
    assert(fileStats.size > 0, 'Stack image must be nonempty.');

    return Object.freeze({
        outputImagePath,
        width: outputWidth,
        height: outputHeight,
        rowCount: metadataRows.length,
        fileSizeBytes: fileStats.size,
        rows: metadataRows,
    });
}

function buildLabelSvg(rows, layout) {
    const labels = rows.map((row, rowIndex) => {
        const y = rowIndex * layout.imageHeight + Math.floor(layout.imageHeight / 2) + 5;
        return `<text x="${Math.floor(layout.labelWidth / 2)}" y="${y}" text-anchor="middle" class="label">${escapeXml(row.label)}</text>`;
    }).join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.outputWidth}" height="${layout.outputHeight}" viewBox="0 0 ${layout.outputWidth} ${layout.outputHeight}">
    <style>
        .label { fill: #d9e2f1; font: 700 12px Arial, sans-serif; }
    </style>
    <rect x="0" y="0" width="${layout.labelWidth}" height="${layout.outputHeight}" fill="#10151d"/>
    ${labels}
</svg>`;
}

function stringListArg(name) {
    const rawValue = stringArg(name, '');
    return rawValue
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function numberArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }

    const value = Number(process.argv[index + 1]);
    return Number.isFinite(value) ? value : fallback;
}

function stringArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }

    return typeof process.argv[index + 1] === 'string' ? process.argv[index + 1] : fallback;
}

function runnerInvocationCommand() {
    return [
        'node',
        'scripts/flat/reconciliation/POC/src/runners/m3CpuIntegratedFlatLocalSunPhaseStack.js',
        '--record',
        recordDirectory,
        '--source-records',
        sourceRecordDirectories.join(','),
        '--row-labels',
        rowLabels.join(','),
        '--output-name',
        outputName,
        '--label-width',
        String(labelWidth),
    ].join(' ');
}

function criterion(name, condition) {
    return Object.freeze({
        name,
        status: condition ? 'accepted' : 'rejected',
    });
}

function failure(name, message, details = {}) {
    return Object.freeze({ name, message, details });
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}
