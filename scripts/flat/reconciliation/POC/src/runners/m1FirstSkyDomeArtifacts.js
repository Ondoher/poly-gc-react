// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.5.
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md, Step 032 display and record rules.
// - tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity.
// - tmp/atmosphere/reconciliation/014-distant-l2-cache-build-bind-sample.

import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    FIGURE1_DISPLAY_CONSTANTS,
    FIGURE1_RENDER_CONSTANTS,
    FIGURE1_SCENES,
    STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    Figure1SkyDomeRenderer,
    SpectralReferenceEvaluator,
    buildIncidentRadianceCache,
} from '../index.js';
import { createM1DistantSphericalModels } from './createM1Models.js';
import {
    appendRunLog,
    assert,
    finiteSpectral,
    nonnegativeSpectral,
    nowIso,
    parseRecordDirectory,
    spectralMean,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const sizePixels = parsePositiveIntegerOption(process.argv, '--size', 96);
const useIncidentCache = process.argv.includes('--with-cache');
const artifactDirectory = resolve(recordDirectory, 'artifacts');
const renderer = new Figure1SkyDomeRenderer();
const renderResults = [];
const cacheDiagnostics = [];

await appendRunLog(recordDirectory, `m1FirstSkyDomeArtifacts started sizePixels=${sizePixels} cacheMode=${useIncidentCache ? 'distant-l2' : 'none'}.`);
await mkdir(artifactDirectory, { recursive: true });

for (let sceneIndex = 0; sceneIndex < FIGURE1_SCENES.length; sceneIndex += 1) {
    const scene = FIGURE1_SCENES[sceneIndex];

    await appendRunLog(recordDirectory, `m1FirstSkyDomeArtifacts scene=${scene.id} model-build-started.`);

    const models = createM1DistantSphericalModels(scene);
    const evaluator = useIncidentCache
        ? createCachedEvaluator(scene, models, cacheDiagnostics)
        : models.evaluator;
    const outputPath = resolve(artifactDirectory, FIGURE1_RENDER_CONSTANTS.targetImageFilenames[sceneIndex]);

    await appendRunLog(recordDirectory, `m1FirstSkyDomeArtifacts scene=${scene.id} render-started output=${outputPath}.`);

    const renderResult = await renderer.render({
        scene,
        evaluator,
        outputPath,
        width: sizePixels,
        height: sizePixels,
        progress: makeRenderProgressLogger(scene.id, outputPath),
        progressRowInterval: 8,
    });
    const fileStats = await stat(outputPath);

    await appendRunLog(recordDirectory, `m1FirstSkyDomeArtifacts scene=${scene.id} render-complete bytes=${fileStats.size}.`);

    assert(renderResult.artifact.width === sizePixels, 'Rendered PNG width must match requested size.');
    assert(renderResult.artifact.height === sizePixels, 'Rendered PNG height must match requested size.');
    assert(fileStats.size > 0, 'Rendered PNG file must be nonempty.');
    assert(renderResult.diagnostics.skyPixelCount > 0, 'Rendered sky dome must contain sky pixels.');
    assert(renderResult.diagnostics.transparentPixelCount > 0, 'Rendered sky dome must contain transparent outside-sky pixels.');
    assert(finiteSpectral(renderResult.diagnostics.maxRadiance), 'Rendered max radiance must be finite.');
    assert(nonnegativeSpectral(renderResult.diagnostics.maxRadiance), 'Rendered max radiance must be nonnegative.');
    assert(renderResult.diagnostics.maxDisplayRgb.some((value) => value > 0),
        'Rendered sky dome must have nonzero display output.');

    renderResults.push(Object.freeze({
        artifact: renderResult.artifact,
        diagnostics: renderResult.diagnostics,
        fileSizeBytes: fileStats.size,
        meanMaxRadiance: spectralMean(renderResult.diagnostics.maxRadiance),
    }));
}

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Produce the first reconciliation POC sky-dome PNG artifacts using the ported
Figure 1 renderer path, with a reduced image size for fast evidence. This
record proves artifact generation exists; it does not claim exact Step 032
decoded RGBA parity.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'M1 Subgoal 1.5 first sky dome artifact generation',
    scenes: FIGURE1_SCENES.map((scene) => ({
        id: scene.id,
        sourceTimeOfDay: scene.sourceTimeOfDay,
        sourceSunZenithDegrees: scene.sourceSunZenithDegrees,
        sunAltitudeDegrees: scene.sunAltitudeDegrees,
        sunAzimuthDegrees: scene.sunAzimuthDegrees,
    })),
    requestedSizePixels: sizePixels,
    targetArtifactSizePixels: FIGURE1_RENDER_CONSTANTS.imageSizePixels,
    incidentRadianceCache: useIncidentCache ? 'distant-l2' : 'omitted-for-first-artifact-smoke',
    numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'agents/topics/apps/flat/reconciliation/action-plan.md',
        'agents/topics/apps/flat/reconciliation/experimental-guidelines.md',
        'agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md',
        'agents/topics/apps/flat/reconciliation/bruneton-start-fresh-source-audit.md',
        'tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity',
        'tmp/atmosphere/reconciliation/011-parameter-provenance-extraction',
        'tmp/atmosphere/reconciliation/012-transport-helper-invariants',
        'tmp/atmosphere/reconciliation/013-concrete-distant-spherical-run',
        'tmp/atmosphere/reconciliation/014-distant-l2-cache-build-bind-sample',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'first-artifact-smoke',
    renderConstants: FIGURE1_RENDER_CONSTANTS,
    displayConstants: FIGURE1_DISPLAY_CONSTANTS,
    numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    cacheMode: useIncidentCache ? 'distant-l2' : 'none',
    rendererPath: [
        'fisheye sky-disc projection',
        'spectral radiance to CIE XYZ integration',
        'XYZ to linear sRGB',
        'paper Figure 1 tone map',
        'RGBA byte packing',
        'raw PNG write',
    ],
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        {
            name: 'four sky-dome PNG artifacts written',
            status: 'accepted',
            result: `${renderResults.length} PNG files written under artifacts/.`,
        },
        {
            name: 'requested dimensions',
            status: 'accepted',
            result: `All artifacts are ${sizePixels}x${sizePixels}.`,
        },
        {
            name: 'sky mask present',
            status: 'accepted',
            result: 'Each image has nonzero sky pixels and nonzero transparent outside-sky pixels.',
        },
        {
            name: 'nonzero display output',
            status: 'accepted',
            result: 'Each image has at least one nonzero display RGB channel.',
        },
        {
            name: 'exact Step 032 decoded RGBA parity',
            status: 'unresolved',
            result: 'This first-artifact smoke record uses reduced dimensions and does not compare to the accepted 320px targets.',
        },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', {
    artifacts: renderResults,
    cacheDiagnostics,
});
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m1FirstSkyDomeArtifacts.js --record ${recordDirectory} --size ${sizePixels}${useIncidentCache ? ' --with-cache' : ''}`,
            purpose: 'Generate the first reduced-size M1 Figure 1 sky-dome artifacts through the reconciliation POC renderer.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'The reconciliation POC can now render Figure 1-style sky-dome PNG artifacts from spectral CPU transport output.',
    runtimeCodeChanged: true,
    artifactCount: renderResults.length,
    sizePixels,
    cacheMode: useIncidentCache ? 'distant-l2' : 'none',
    exactStep032Parity: 'unresolved',
    nextStep: 'Run full-size complete CPU artifact generation and exact decoded RGBA comparison against the accepted Step 032 targets.',
});
await writeText(recordDirectory, 'report.md', `# Report

Generated ${renderResults.length} reduced-size Figure 1 sky-dome PNG artifacts
under \`artifacts/\` using the reconciliation POC spectral evaluator and the
ported renderer path. This is the first image-producing M1 Subgoal 1.5 record.

The run intentionally keeps the claim narrow: the artifacts prove the renderer
and CPU spectral output can produce sky-dome PNG files. Exact decoded RGBA
parity against the accepted 320px Step 032 targets remains unresolved and is
the next gate.
`);
await appendRunLog(recordDirectory, `m1FirstSkyDomeArtifacts accepted ${renderResults.length} sky-dome artifacts at ${sizePixels}px, cacheMode=${useIncidentCache ? 'distant-l2' : 'none'}.`);

console.log(JSON.stringify({
    status: 'accepted',
    artifactCount: renderResults.length,
    sizePixels,
    cacheMode: useIncidentCache ? 'distant-l2' : 'none',
    exactStep032Parity: 'unresolved',
}));

function parsePositiveIntegerOption(argv, optionName, defaultValue) {
    const optionIndex = argv.indexOf(optionName);

    if (optionIndex === -1) {
        return defaultValue;
    }

    const value = Number(argv[optionIndex + 1]);

    if (!Number.isInteger(value) || value < 8) {
        throw new RangeError(`${optionName} must be an integer >= 8.`);
    }

    return value;
}

function createCachedEvaluator(scene, models, diagnostics) {
    const cache = models.lightSource.createIncidentRadianceCache({
        bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
        topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
    });
    const buildResult = buildIncidentRadianceCache({
        cache,
        geometry: models.geometry,
        atmosphere: models.atmosphere,
        lightSource: models.lightSource,
        calculator: models.calculator,
        pathIntervalCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.pathIntervalCount,
        sourceTransmittanceIntervalCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
    });

    diagnostics.push(Object.freeze({
        sceneId: scene.id,
        coordinateCount: buildResult.coordinateCount,
        cacheDescriptor: cache.descriptor,
    }));

    return new SpectralReferenceEvaluator({
        geometry: models.geometry,
        atmosphere: models.atmosphere,
        lightSource: models.lightSource,
        calculator: models.calculator,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
        incidentRadianceSampling: buildResult.incidentRadianceSampling,
    });
}

function makeRenderProgressLogger(sceneId, outputPath) {
    return (progress) => appendRunLog(
        recordDirectory,
        `m1FirstSkyDomeArtifacts render-progress scene=${sceneId} stage=${progress.stage} rows=${progress.completedRows}/${progress.totalRows} pixels=${progress.completedPixels}/${progress.totalPixels} sky=${progress.skyPixelCount} transparent=${progress.transparentPixelCount} output=${outputPath}.`,
    );
}
