import { mkdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';

import { writePng } from '../outputs/pngWriter.js';
import Flat32CpuSoftShaderSceneRenderer from '../subjective-scenes/Flat32CpuSoftShaderSceneRenderer.js';
import Flat32SceneStateResolver from '../subjective-scenes/Flat32SceneStateResolver.js';
import FLAT32_SCENE_SNAPSHOT from '../subjective-scenes/flat32SceneSnapshot.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const runnerName = 'm5Flat32RealScenesCpuSoftShader';
const recordDirectory = parseRecordDirectory(process.argv);
const width = numberArg('--width', 128);
const height = numberArg('--height', 96);
const incidentCacheEnabled = !process.argv.includes('--no-incident-cache');
const caseRequests = Object.freeze([
    Object.freeze({ id: 'union-glacier-flat-0', locationKey: 'union-glacier', timePresetKey: 'flat-0' }),
    Object.freeze({ id: 'union-glacier-flat-180', locationKey: 'union-glacier', timePresetKey: 'flat-180' }),
    Object.freeze({ id: 'san-jose-flat-0', locationKey: 'san-jose', timePresetKey: 'flat-0' }),
    Object.freeze({ id: 'san-jose-flat-180', locationKey: 'san-jose', timePresetKey: 'flat-180' }),
]);

await createFreshRecordDirectory(recordDirectory);
const imagesDirectory = resolve(recordDirectory, 'images');
await mkdir(imagesDirectory, { recursive: false });
await appendRunLog(recordDirectory, `${runnerName} started.`);

const sourceRevisionAtExecution = await resolveGitHeadRevision();
const stateResolver = new Flat32SceneStateResolver();
const sceneStates = caseRequests.map((request) => stateResolver.resolve(request));
const renderer = new Flat32CpuSoftShaderSceneRenderer({
    width,
    height,
    incidentCacheEnabled,
    onProgress: (message) => appendRunLog(recordDirectory, message),
});
const commandText = `node scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory} --width ${width} --height ${height}${incidentCacheEnabled ? '' : ' --no-incident-cache'}`;

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Render the real Flat32 flat-mode scene through the CPU spectral soft shader
before any GPU promotion. Preserve the app's normal Union Glacier startup
presentation frame while running Union Glacier and San Jose at Flat-0 and
Flat-180. Route ground and all six authored boxes as finite solid endpoints,
and route the source-owned local Sun, 192 synthetic star analogs, and A-H
calibration ladder through external boundary radiance.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '5.6-real-flat32-scenes-cpu-soft-shader-experiment',
    runner: runnerName,
    caseRequests,
    resolvedTimes: sceneStates.map((state) => Object.freeze({
        id: state.id,
        synchronizedTimeIso: state.time.synchronizedTimeIso,
        basisResolvedTimeIso: state.time.basisResolvedTimeIso,
        finalTimeIso: state.time.finalTimeIso,
        basisAdjustment: state.time.basisAdjustment,
    })),
    sceneSnapshot: FLAT32_SCENE_SNAPSHOT,
    generatedObjectManifest: Object.freeze({
        solidEndpoints: sceneStates[0].objectInventory.solidEndpointIds,
        externalBoundaryCandidates: sceneStates[0].objectInventory.externalBoundaryIds,
        syntheticStarSpecs: sceneStates[0].syntheticStars,
    }),
    renderer: renderer.describe(),
});
await writeJson(recordDirectory, 'provenance.json', {
    sourceRevisionAtExecution,
    snapshotRevision: FLAT32_SCENE_SNAPSHOT.sourceRevision,
    runtimeLinkPolicy: FLAT32_SCENE_SNAPSHOT.runtimeLinkPolicy,
    references: Object.freeze([
        `src/flat32/index.js @ ${sourceRevisionAtExecution}`,
        `shared/algorithm32/production/light-sources/FlatSynchronizer.js @ ${sourceRevisionAtExecution}`,
        'scripts/flat/reconciliation/POC/src/subjective-scenes/consts.js',
        'scripts/flat/reconciliation/POC/src/scenes/planetSphereSceneDefinition.js',
        'agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md',
        'agents/topics/apps/flat/reconciliation/experimental-guidelines.md',
    ]),
    boundedAdaptation: 'The POC owns copied scene/source formulas and imports no Flat32 or production runtime module.',
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    canonicalComposition: 'finalSpectralRadiance = pathRadiance + viewTransmittance * endpointOrCelestialRadiance',
    sceneScale: '1 scene unit = 1000 meters',
    presentationFrame: 'Union Glacier Flat-0 startup camera and box transforms remain fixed across normal location/time switches.',
    localSourcePlacement: 'north-pole azimuthal-equidistant(source subpoint) - projection(observer)',
    sourceSynchronization: 'NOAA-style declination/equation-of-time anchor followed by one clockwise 24-hour orbit',
    endpointRadiance: 'incidentRadiance * sourceTransmittance * spectralAlbedo * max(dot(normal, directionToSource), 0) / pi',
    endpointShadow: 'analytic hard ray from endpoint toward finite local-source sphere; blocked endpoints receive zero direct radiance',
    starAngularFootprint: 'asin(flat32 sphere radius / flat32 sphere distance)',
    starRadianceBridge: 'legacy neutral display scalar inverted through Figure-1 tone map and fitted to the canonical 15-channel neutral basis',
    starRadianceQualification: 'bounded prototype bridge, not physical photometric calibration',
    numericalControls: renderer.describe().executionControls,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([Object.freeze({ command: commandText, timestamp: nowIso() })]),
});

const renderedCases = [];
const failures = [];

try {
    for (const sceneState of sceneStates) {
        await appendRunLog(recordDirectory, `${sceneState.id} render started.`);
        const rendered = await renderer.render(sceneState);
        const softShaderFilename = `${sceneState.id}-cpu-soft-shader.png`;
        const objectIdFilename = `${sceneState.id}-object-id.png`;
        const softShaderPath = resolve(imagesDirectory, softShaderFilename);
        const objectIdPath = resolve(imagesDirectory, objectIdFilename);
        await writePng(softShaderPath, width, height, rendered.softShaderBytes);
        await writePng(objectIdPath, width, height, rendered.objectIdBytes);
        renderedCases.push(Object.freeze({
            request: caseRequests.find((entry) => entry.id === sceneState.id),
            sceneState,
            rendered,
            softShaderPath,
            objectIdPath,
            softShaderRecordPath: `images/${softShaderFilename}`,
            objectIdRecordPath: `images/${objectIdFilename}`,
            meanDisplayLuminance: meanByteLuminance(rendered.softShaderBytes),
        }));
        await appendRunLog(recordDirectory, `${sceneState.id} images written.`);
    }
} catch (error) {
    failures.push(failure('render-crash', error));
    await appendRunLog(recordDirectory, `${runnerName} render crash: ${error.message}`);
}

let overviewSoftShaderPath = null;
let overviewObjectIdPath = null;
if (renderedCases.length === caseRequests.length) {
    overviewSoftShaderPath = resolve(imagesDirectory, 'overview-cpu-soft-shader.png');
    overviewObjectIdPath = resolve(imagesDirectory, 'overview-object-id.png');
    await writePng(
        overviewSoftShaderPath,
        width * 2,
        height * 2,
        montageBytes(renderedCases.map((entry) => entry.rendered.softShaderBytes), width, height, 2),
    );
    await writePng(
        overviewObjectIdPath,
        width * 2,
        height * 2,
        montageBytes(renderedCases.map((entry) => entry.rendered.objectIdBytes), width, height, 2),
    );
}

const imagePaths = renderedCases.flatMap((entry) => [entry.softShaderPath, entry.objectIdPath]);
if (overviewSoftShaderPath) imagePaths.push(overviewSoftShaderPath);
if (overviewObjectIdPath) imagePaths.push(overviewObjectIdPath);
const imageStats = await Promise.all(imagePaths.map(async (path) => Object.freeze({
    path: relative(recordDirectory, path).replaceAll('\\', '/'),
    sizeBytes: (await stat(path)).size,
})));
const diagnostics = renderedCases.map((entry) => Object.freeze({
    caseId: entry.sceneState.id,
    request: entry.request,
    softShaderRecordPath: entry.softShaderRecordPath,
    objectIdRecordPath: entry.objectIdRecordPath,
    meanDisplayLuminance: entry.meanDisplayLuminance,
    render: entry.rendered.diagnostics,
}));
const criteria = buildCriteria({
    sourceRevisionAtExecution,
    sceneStates,
    renderedCases,
    diagnostics,
    imageStats,
    incidentCacheEnabled,
});
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(Object.freeze({
            id: entry.name,
            message: entry.details ?? 'Experiment acceptance criterion was not met.',
        }));
    }
}
const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    cases: diagnostics,
    comparison: comparisonDiagnostics(renderedCases),
    imageStats,
});
await writeJson(recordDirectory, 'result.json', {
    status,
    caseCount: renderedCases.length,
    expectedCaseCount: caseRequests.length,
    acceptedCriteriaCount: criteria.filter((entry) => entry.status === 'accepted').length,
    criteriaCount: criteria.length,
    overviewSoftShaderPath: overviewSoftShaderPath ? 'images/overview-cpu-soft-shader.png' : null,
    overviewObjectIdPath: overviewObjectIdPath ? 'images/overview-object-id.png' : null,
    failures,
});
await writeText(recordDirectory, 'report.md', reportMarkdown({
    status,
    renderedCases,
    criteria,
    failures,
}));
await appendRunLog(recordDirectory, `${runnerName} ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    caseCount: renderedCases.length,
    criteriaCount: criteria.length,
    failureCount: failures.length,
    overviewSoftShaderPath,
    overviewObjectIdPath,
}));

function buildCriteria({
    sourceRevisionAtExecution,
    sceneStates: states,
    renderedCases: rendered,
    diagnostics: caseDiagnostics,
    imageStats: stats,
    incidentCacheEnabled: cacheEnabled,
}) {
    const expectedCaseIds = caseRequests.map((entry) => entry.id).join(',');
    const actualCaseIds = states.map((entry) => entry.id).join(',');
    const rendersComplete = rendered.length === caseRequests.length;
    const allRenderDiagnostics = caseDiagnostics.map((entry) => entry.render);
    const expectedSolidIds = states[0]?.objectInventory.solidEndpointIds ?? [];
    const expectedExternalIds = states[0]?.objectInventory.externalBoundaryIds ?? [];
    const flatZeroByLocation = Object.fromEntries(rendered
        .filter((entry) => entry.request.timePresetKey === 'flat-0')
        .map((entry) => [entry.request.locationKey, entry.meanDisplayLuminance]));
    const flatOneEightyByLocation = Object.fromEntries(rendered
        .filter((entry) => entry.request.timePresetKey === 'flat-180')
        .map((entry) => [entry.request.locationKey, entry.meanDisplayLuminance]));

    return Object.freeze([
        criterion('exact-two-location-four-state-matrix', actualCaseIds === expectedCaseIds),
        criterion('snapshot-revision-matches-executed-flat32-revision',
            sourceRevisionAtExecution === FLAT32_SCENE_SNAPSHOT.sourceRevision),
        criterion('union-startup-presentation-frame-is-fixed', states.every((state) =>
            state.presentationFrame.id === FLAT32_SCENE_SNAPSHOT.presentationFrame.id
            && state.presentationFrame.maximumExpectedDirectionError < 1e-9)),
        criterion('ground-and-six-authored-solid-endpoints-declared',
            expectedSolidIds.length === 7
            && expectedSolidIds[0] === FLAT32_SCENE_SNAPSHOT.ground.objectId),
        criterion('sun-192-analogs-and-eight-calibration-candidates-declared',
            expectedExternalIds.length === 201
            && states.every((state) => state.syntheticStars.length === 192 && state.starCalibration.length === 8)),
        criterion('external-bodies-are-not-solid-raycast-endpoints',
            allRenderDiagnostics.every((entry) =>
                Object.keys(entry.objectHitCounts).every((id) => !expectedExternalIds.includes(id)))),
        criterion('all-four-full-frames-rendered', rendersComplete),
        criterion('full-frames-have-hit-and-no-hit-pixels-without-errors',
            rendersComplete && allRenderDiagnostics.every((entry) =>
                entry.aggregateDiagnostics.hitPixelCount > 0
                && entry.aggregateDiagnostics.noHitPixelCount > 0
                && entry.aggregateDiagnostics.invalidPixelCount === 0
                && entry.aggregateDiagnostics.errorCount === 0)),
        criterion('every-review-object-is-visible-or-explicitly-occluded',
            rendersComplete && allRenderDiagnostics.every((entry) =>
                entry.reviewObjectDiagnostics.length === 6
                && entry.reviewObjectDiagnostics.every((object) =>
                    object.declaredInScene
                    && object.centerInFrustum
                    && (object.visibleHitPixelCount > 0 || object.centerOccludedBy)))),
        criterion('far-orange-depth-overlap-is-explicit',
            rendersComplete && allRenderDiagnostics.every((entry) => {
                const farOrange = entry.reviewObjectDiagnostics.find((object) =>
                    object.objectId === 'union-review-far-orange-box');
                return farOrange?.centerOccludedBy === 'union-review-near-yellow-box';
            })),
        criterion('spectral-outputs-are-finite-and-nonnegative',
            rendersComplete && allRenderDiagnostics.every((entry) =>
                entry.allSpectralOutputsFiniteNonnegative)),
        criterion('canonical-composition-equation-is-exact',
            rendersComplete && allRenderDiagnostics.every((entry) =>
                entry.maximumCompositionEquationError < 1e-12)),
        criterion('one-local-source-owns-lighting-cache-and-visible-disk',
            rendersComplete && allRenderDiagnostics.every((entry) =>
                entry.celestialProvider.sourceOwner === FLAT32_SCENE_SNAPSHOT.localSun.sourceKey
                && entry.celestialProvider.sourceCandidatePolicy
                    === 'source-owned-local-sun-visible-body-provider')),
        criterion('all-solid-hits-precede-finite-local-sun',
            rendersComplete && allRenderDiagnostics.every((entry) => entry.allSolidHitsPrecedeFiniteSun)),
        criterion('synthetic-star-facts-remain-identical-across-cases',
            states.length === 4 && states.slice(1).every((state) =>
                state.syntheticStars === states[0].syntheticStars)),
        criterion('flat-0-and-flat-180-produce-measurable-display-differences',
            ['union-glacier', 'san-jose'].every((locationKey) =>
                Number.isFinite(flatZeroByLocation[locationKey])
                && Number.isFinite(flatOneEightyByLocation[locationKey])
                && Math.abs(flatZeroByLocation[locationKey] - flatOneEightyByLocation[locationKey]) > 1e-6)),
        criterion('incident-cache-is-built-from-flat32-local-cache-facts',
            !cacheEnabled || (rendersComplete && allRenderDiagnostics.every((entry) =>
                entry.incidentRadianceCache.coordinateCount === 70
                && entry.incidentRadianceCache.descriptor.metadata.zBinCount === 5
                && entry.incidentRadianceCache.descriptor.metadata.rhoBinCount === 7))),
        criterion('cpu-only-no-browser-or-gpu-shader',
            rendersComplete && allRenderDiagnostics.every((entry) =>
                entry.gpuShaderUsed === false && entry.browserUsed === false)),
        criterion('case-and-overview-pngs-are-written',
            stats.length === 10 && stats.every((entry) => entry.sizeBytes > 0)),
    ]);
}

function comparisonDiagnostics(rendered) {
    const byId = Object.fromEntries(rendered.map((entry) => [entry.sceneState.id, entry]));

    return Object.freeze({
        meanDisplayLuminanceByCase: Object.freeze(Object.fromEntries(rendered.map((entry) => [
            entry.sceneState.id,
            entry.meanDisplayLuminance,
        ]))),
        unionFlatZeroMinusFlatOneEighty: difference(
            byId['union-glacier-flat-0']?.meanDisplayLuminance,
            byId['union-glacier-flat-180']?.meanDisplayLuminance,
        ),
        sanJoseFlatZeroMinusFlatOneEighty: difference(
            byId['san-jose-flat-0']?.meanDisplayLuminance,
            byId['san-jose-flat-180']?.meanDisplayLuminance,
        ),
        calibrationVisibilityByCase: Object.freeze(Object.fromEntries(rendered.map((entry) => [
            entry.sceneState.id,
            Object.entries(entry.rendered.diagnostics.boundaryBodyHitCounts)
                .filter(([bodyId]) => bodyId.startsWith('flat32-star-calibration-'))
                .reduce((sum, [, count]) => sum + count, 0),
        ]))),
        note: 'Star visibility is measured, not an acceptance threshold; the legacy-scalar spectral bridge remains prototype calibration.',
    });
}

function reportMarkdown({ status, renderedCases: rendered, criteria, failures: failed }) {
    const rows = rendered.map((entry) => {
        const missingOrOccluded = entry.rendered.diagnostics.reviewObjectDiagnostics
            .filter((object) => object.visibleHitPixelCount === 0)
            .map((object) => `${object.objectId} (occluded by ${object.centerOccludedBy ?? 'unknown'})`)
            .join(', ') || 'none';
        const bodyPixels = Object.values(entry.rendered.diagnostics.boundaryBodyHitCounts)
            .reduce((sum, count) => sum + count, 0);
        return `| ${entry.sceneState.id} | ${entry.sceneState.time.finalTimeIso} | ${entry.meanDisplayLuminance.toFixed(6)} | ${entry.rendered.diagnostics.aggregateDiagnostics.hitPixelCount} | ${bodyPixels} | ${missingOrOccluded} |`;
    }).join('\n');

    return `# Report

Status: **${status}**

This record renders the normal Flat32 flat-mode interaction lane through the
CPU spectral soft shader. Union Glacier and San Jose share the same real
authored layout and the cached Union-startup presentation frame; location and
Flat-0/Flat-180 change source/time state, not scene membership.

| Case | Final time | Mean display luminance | Solid-hit pixels | Boundary-body pixels | Authored objects with no direct pixels |
| --- | --- | ---: | ---: | ---: | --- |
${rows}

- Ground and the six boxes are finite matte endpoints.
- The local Sun comes from the same LocalSunLightSource that illuminates the
  atmosphere and endpoints.
- The 192 analogs and A-H ladder use external boundary radiance; no star mesh
  enters the solid raycast set.
- The far orange box is intentionally hidden behind the near yellow box in
  this camera-aligned layout and is retained as explicit depth/occlusion
  evidence.
- Endpoint shadows are analytic hard CPU rays. Flat32's GPU shadow-map PCF is
  outside this CPU experiment.
- Star radiance uses an explicitly provisional inverse-display bridge. This
  record measures visibility but does not accept a physical star calibration.

Accepted criteria: ${criteria.filter((entry) => entry.status === 'accepted').length}/${criteria.length}.
Failures: ${failed.length === 0 ? 'none' : failed.map((entry) => entry.id).join(', ')}.

Overview images:

- \`images/overview-cpu-soft-shader.png\`
- \`images/overview-object-id.png\`
`;
}

async function createFreshRecordDirectory(value) {
    const root = resolve('tmp/atmosphere/reconciliation');
    const target = resolve(value);
    const name = basename(target);

    if (dirname(target) !== root || !/^\d{3}-[a-z0-9][a-z0-9-]*$/.test(name)) {
        throw new Error('Record path must be a direct NNN-kebab-case child of tmp/atmosphere/reconciliation.');
    }

    await mkdir(target, { recursive: false });
}

async function resolveGitHeadRevision() {
    const gitDirectory = resolve('.git');
    const head = (await readFile(resolve(gitDirectory, 'HEAD'), 'utf8')).trim();
    if (!head.startsWith('ref: ')) {
        return head;
    }

    const reference = head.slice('ref: '.length);
    try {
        return (await readFile(resolve(gitDirectory, reference), 'utf8')).trim();
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    const packedReferences = await readFile(resolve(gitDirectory, 'packed-refs'), 'utf8');
    const match = packedReferences.split(/\r?\n/)
        .map((line) => line.trim().split(' '))
        .find(([, name]) => name === reference);
    if (!match) {
        throw new Error(`Unable to resolve Git HEAD reference ${reference}.`);
    }

    return match[0];
}

function montageBytes(images, width, height, columns) {
    const rows = Math.ceil(images.length / columns);
    const output = new Uint8Array(width * columns * height * rows * 4);
    const outputWidth = width * columns;

    images.forEach((bytes, imageIndex) => {
        const column = imageIndex % columns;
        const row = Math.floor(imageIndex / columns);
        for (let y = 0; y < height; y += 1) {
            const sourceStart = y * width * 4;
            const destinationStart = ((row * height + y) * outputWidth + column * width) * 4;
            output.set(bytes.subarray(sourceStart, sourceStart + width * 4), destinationStart);
        }
    });

    return output;
}

function meanByteLuminance(bytes) {
    let sum = 0;
    const pixelCount = bytes.length / 4;
    for (let offset = 0; offset < bytes.length; offset += 4) {
        sum += (0.2126 * bytes[offset] + 0.7152 * bytes[offset + 1] + 0.0722 * bytes[offset + 2]) / 255;
    }

    return sum / pixelCount;
}

function criterion(name, accepted, details = null) {
    return Object.freeze({
        name,
        status: accepted ? 'accepted' : 'rejected',
        ...(details ? { details } : {}),
    });
}

function failure(id, error) {
    return Object.freeze({
        id,
        message: error.message,
        stack: error.stack,
    });
}

function difference(left, right) {
    return Number.isFinite(left) && Number.isFinite(right) ? left - right : null;
}

function numberArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }
    const value = Number(process.argv[index + 1]);
    if (!Number.isInteger(value) || value <= 0) {
        throw new TypeError(`${name} requires a positive integer.`);
    }

    return value;
}
