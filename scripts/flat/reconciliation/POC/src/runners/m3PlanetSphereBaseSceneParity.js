// References:
// - agents/topics/apps/flat/reconciliation/status.md, CPU/GPU base-scene parity requirement.
// - tmp/atmosphere/reconciliation/348-m3-constructed-scene-cpu-320x180, CPU base-scene evidence.
// - tmp/atmosphere/reconciliation/369-m3-planet-sphere-ground-shader-scene, browser base-scene evidence.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
const browserRecordDirectory = requiredStringArg('--browser-record');
const cpuRawImagePath = resolve(cpuRecordDirectory, 'raw-spherical-ground-object-scene.png');
const browserPreShaderImagePath = resolve(browserRecordDirectory, 'images/pre-shader-scene-color.png');
const imageComparison = new ImageComparison();
const failures = [];

await appendRunLog(recordDirectory, 'm3PlanetSphereBaseSceneParity started.');

let cpuInputs = null;
let cpuDiagnostics = null;
let browserDiagnostics = null;
let comparison = null;

try {
    cpuInputs = await readJson(resolve(cpuRecordDirectory, 'inputs.json'));
    cpuDiagnostics = await readJson(resolve(cpuRecordDirectory, 'diagnostics.json'));
    browserDiagnostics = await readJson(resolve(browserRecordDirectory, 'diagnostics.json'));
    comparison = await imageComparison.compare({
        actualPath: browserPreShaderImagePath,
        expectedPath: cpuRawImagePath,
        metadata: Object.freeze({
            comparisonKind: 'cpu-gpu-base-scene-parity',
            actualRole: 'browser-pre-shader-scene-color',
            expectedRole: 'cpu-raw-scene-color',
        }),
    });
} catch (error) {
    failures.push(failure('base-scene-parity-crash', error.message, { stack: error.stack }));
}

const browserSceneSummary = browserDiagnostics?.scene?.browserThreeScene ?? null;
const cpuSceneDefinition = cpuInputs?.planetSceneDefinition ?? null;
const browserSceneDefinition = browserSceneSummary?.planetSceneDefinition ?? null;
const cpuRawCounts = cpuDiagnostics?.rawSceneDiagnostics?.colorCounts ?? null;
const cpuObjectHitCounts = cpuDiagnostics?.renderDiagnostics?.objectHitCounts
    ?? cpuDiagnostics?.rawSceneDiagnostics?.objectHitCounts
    ?? null;
const cpuHitPixelCount = cpuDiagnostics?.renderDiagnostics?.aggregateDiagnostics?.hitPixelCount
    ?? cpuDiagnostics?.rawSceneDiagnostics?.hitPixelCount
    ?? null;
const cpuNoHitPixelCount = cpuDiagnostics?.renderDiagnostics?.aggregateDiagnostics?.noHitPixelCount
    ?? cpuDiagnostics?.rawSceneDiagnostics?.noHitPixelCount
    ?? null;
const browserObjectHitCounts = browserSceneSummary?.objectHitCounts ?? null;
const browserDepthSummary = browserSceneSummary?.depthSummary ?? null;
const criteria = Object.freeze([
    criterion('same-scene-name-and-object-list',
        sameSceneDefinition(cpuSceneDefinition, browserSceneDefinition)),
    criterion('same-base-scene-image-dimensions',
        comparison?.sameDimensions === true
            && comparison.width === cpuInputs?.width
            && comparison.height === cpuInputs?.height
            && sameViewport(browserSceneSummary?.viewportPixels, cpuInputs?.width, cpuInputs?.height)),
    criterion('base-scene-pngs-byte-identical',
        comparison?.exactMatch === true
            && comparison.maxAbsRgbaDelta === 0
            && comparison.mismatchedPixelCount === 0),
    criterion('cpu-and-browser-hit-counts-match',
        sameObjectHitCounts(cpuObjectHitCounts, browserObjectHitCounts)
            && cpuHitPixelCount === browserSceneSummary?.hitPixelCount
            && cpuNoHitPixelCount === browserDepthSummary?.noHitBucket),
    criterion('cpu-color-counts-match-browser-hit-classification',
        cpuSceneDefinition?.lightingPolicy !== 'unlit-endpoint-color'
            || (cpuRawCounts?.sky === browserDepthSummary?.noHitBucket
                && cpuRawCounts?.ground === browserObjectHitCounts?.['scaled-planet-size-ground-sphere']
                && cpuRawCounts?.greenBox === greenBoxHitCount(browserObjectHitCounts)
                && cpuRawCounts?.other === 0)),
    criterion('browser-base-scene-is-constructed-raycast-endpoint-color',
        browserSceneSummary?.colorSource === 'constructed scene raycast endpoint color'
            && browserSceneSummary?.groundColorPolicy?.includes('exact ground raycast')),
    criterion('cpu-base-scene-is-node-raycaster-shared-display-color',
        typeof cpuDiagnostics?.rawSceneDiagnostics?.colorPolicy === 'string'
            && cpuDiagnostics.rawSceneDiagnostics.colorPolicy.startsWith('node-raycaster-shared-display-rgba-')),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'CPU/browser base-scene parity criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Prove that the CPU raw scene and browser pre-shader scene are the same base
scene for the same planet scene name before any atmosphere shader output is
compared.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5-planet-sphere-base-scene-parity',
    runner: 'm3PlanetSphereBaseSceneParity',
    cpuRecordDirectory,
    browserRecordDirectory,
    cpuRawImagePath,
    browserPreShaderImagePath,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        cpuRecordDirectory,
        browserRecordDirectory,
        'scripts/flat/reconciliation/POC/src/runners/m3CpuPlanetSphereGroundScene.js',
        'scripts/flat/reconciliation/POC/src/runners/m3PlanetSphereGroundScene.js',
        'scripts/flat/reconciliation/POC/browser-page/runner.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    comparison,
    cpuSceneDefinition,
    browserSceneDefinition,
    cpuRawCounts,
    cpuObjectHitCounts,
    cpuHitPixelCount,
    cpuNoHitPixelCount,
    browserObjectHitCounts,
    browserDepthSummary,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3PlanetSphereBaseSceneParity.js --record ${recordDirectory} --cpu-record ${cpuRecordDirectory} --browser-record ${browserRecordDirectory}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    exactMatch: comparison?.exactMatch ?? false,
    maxAbsRgbaDelta: comparison?.maxAbsRgbaDelta ?? null,
    mismatchedPixelCount: comparison?.mismatchedPixelCount ?? null,
});
await writeText(recordDirectory, 'report.md', `# Report

Planet sphere base-scene parity finished with status: ${status}.

- Scene name: \`${cpuSceneDefinition?.name ?? 'not-read'}\`
- CPU raw scene: \`${cpuRawImagePath}\`
- Browser pre-shader scene: \`${browserPreShaderImagePath}\`
- Exact image match: \`${comparison?.exactMatch ?? false}\`
- Max byte delta: \`${comparison?.maxAbsRgbaDelta ?? 'not-compared'}\`
- Mismatched pixels: \`${comparison?.mismatchedPixelCount ?? 'not-compared'}\`
- CPU raw counts: \`${JSON.stringify(cpuRawCounts ?? null)}\`
- Browser hit counts: \`${JSON.stringify(browserObjectHitCounts ?? null)}\`
- Browser no-hit pixels: \`${browserDepthSummary?.noHitBucket ?? 'not-reported'}\`

This record is a prerequisite gate for shader comparison. A shader output
comparison is meaningful only after this base scene is exact.
`);
await appendRunLog(recordDirectory, `m3PlanetSphereBaseSceneParity ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    exactMatch: comparison?.exactMatch ?? false,
    maxAbsRgbaDelta: comparison?.maxAbsRgbaDelta ?? null,
    mismatchedPixelCount: comparison?.mismatchedPixelCount ?? null,
}));

async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, 'utf8'));
}

function sameSceneDefinition(left, right) {
    return left?.name === right?.name
        && arraysEqual(left?.objectNames, right?.objectNames)
        && canonicalJson(left?.objectSpecs ?? null) === canonicalJson(right?.objectSpecs ?? null)
        && left?.groundPolicy === right?.groundPolicy
        && left?.lightingPolicy === right?.lightingPolicy
        && (left?.shadowPolicy ?? 'shadows-disabled') === (right?.shadowPolicy ?? 'shadows-disabled');
}

function sameViewport(viewportPixels, width, height) {
    return Array.isArray(viewportPixels)
        && viewportPixels[0] === width
        && viewportPixels[1] === height;
}

function sameObjectHitCounts(left, right) {
    const keys = new Set([
        ...Object.keys(left ?? {}),
        ...Object.keys(right ?? {}),
    ]);

    for (const key of keys) {
        if ((left?.[key] ?? 0) !== (right?.[key] ?? 0)) {
            return false;
        }
    }

    return keys.size > 0;
}

function greenBoxHitCount(objectHitCounts) {
    return [
        'near-green-box',
        'middle-green-box',
        'far-green-box',
        'very-far-green-box',
    ].reduce((sum, key) => sum + (objectHitCounts?.[key] ?? 0), 0);
}

function arraysEqual(left, right) {
    return Array.isArray(left)
        && Array.isArray(right)
        && left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function canonicalJson(value) {
    return JSON.stringify(sortValue(value));
}

function sortValue(value) {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, entry]) => [key, sortValue(entry)]),
        );
    }

    return value;
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

function requiredStringArg(name) {
    const index = process.argv.indexOf(name);
    if (index === -1 || typeof process.argv[index + 1] !== 'string') {
        throw new Error(`Runner requires ${name} <path>.`);
    }

    return process.argv[index + 1];
}
