// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.5 exact image comparison.
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md, Step 032 decoded RGBA parity gate.
// - tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity.
// - tmp/atmosphere/reconciliation/015-first-sky-dome-artifacts.

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
    ImageComparison,
    SpectralReferenceEvaluator,
    buildIncidentRadianceCache,
} from '../index.js';
import { createM1DistantSphericalModels } from './createM1Models.js';
import {
    appendRunLog,
    assert,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const sizePixels = parsePositiveIntegerOption(
    process.argv,
    '--size',
    FIGURE1_RENDER_CONSTANTS.imageSizePixels,
);
const useIncidentCache = !process.argv.includes('--no-cache');
const artifactDirectory = resolve(recordDirectory, 'artifacts');
const renderer = new Figure1SkyDomeRenderer();
const imageComparison = new ImageComparison();
const renderResults = [];
const comparisonResults = [];
const cacheDiagnostics = [];

await appendRunLog(recordDirectory, `m1Step032ImageComparison started sizePixels=${sizePixels} cacheMode=${useIncidentCache ? 'distant-l2' : 'none'}.`);
await mkdir(artifactDirectory, { recursive: true });

for (let sceneIndex = 0; sceneIndex < FIGURE1_SCENES.length; sceneIndex += 1) {
    const scene = FIGURE1_SCENES[sceneIndex];
    const targetFilename = FIGURE1_RENDER_CONSTANTS.targetImageFilenames[sceneIndex];
    const actualPath = resolve(artifactDirectory, targetFilename);
    const expectedPath = resolve(FIGURE1_RENDER_CONSTANTS.targetArtifactRoot, targetFilename);

    await appendRunLog(recordDirectory, `m1Step032ImageComparison scene=${scene.id} model-build-started.`);

    const models = createM1DistantSphericalModels(scene);
    const evaluator = useIncidentCache
        ? createCachedEvaluator(scene, models, cacheDiagnostics)
        : models.evaluator;

    await appendRunLog(recordDirectory, `m1Step032ImageComparison scene=${scene.id} render-started output=${actualPath}.`);

    const renderResult = await renderer.render({
        scene,
        evaluator,
        outputPath: actualPath,
        width: sizePixels,
        height: sizePixels,
        progress: makeRenderProgressLogger(scene.id, actualPath),
        progressRowInterval: 8,
    });
    const fileStats = await stat(actualPath);

    await appendRunLog(recordDirectory, `m1Step032ImageComparison scene=${scene.id} render-complete bytes=${fileStats.size}.`);
    await appendRunLog(recordDirectory, `m1Step032ImageComparison scene=${scene.id} compare-started expected=${expectedPath}.`);

    const comparison = await imageComparison.compare({
        actualPath,
        expectedPath,
        metadata: Object.freeze({
            sceneId: scene.id,
            targetFilename,
        }),
    });

    assert(fileStats.size > 0, 'Rendered PNG file must be nonempty.');

    renderResults.push(Object.freeze({
        artifact: renderResult.artifact,
        diagnostics: renderResult.diagnostics,
        fileSizeBytes: fileStats.size,
    }));
    comparisonResults.push(comparison);
    await appendRunLog(recordDirectory, `m1Step032ImageComparison scene=${scene.id} compare-complete exact=${comparison.exactMatch} maxAbsRgbaDelta=${comparison.maxAbsRgbaDelta}.`);
}

const summary = summarizeComparisons(comparisonResults);
const status = summary.status === 'accepted' ? 'accepted' : 'rejected';

await writeRecord({
    recordDirectory,
    status,
    sizePixels,
    useIncidentCache,
    renderResults,
    comparisonResults,
    cacheDiagnostics,
    summary,
});

console.log(JSON.stringify({
    status,
    artifactCount: renderResults.length,
    exactMatchCount: summary.exactMatchCount,
    maxAbsRgbaDelta: summary.maxAbsRgbaDelta,
    mismatchedPixelCount: summary.mismatchedPixelCount,
}));

if (status !== 'accepted') {
    process.exitCode = 1;
}

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
        shaderPayload: cache.createShaderPayload(),
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

function summarizeComparisons(comparisons) {
    return Object.freeze({
        status: comparisons.every((comparison) => comparison.exactMatch) ? 'accepted' : 'rejected',
        comparisons,
        exactMatchCount: comparisons.filter((comparison) => comparison.exactMatch).length,
        maxAbsRgbaDelta: Math.max(...comparisons.map((comparison) => comparison.maxAbsRgbaDelta)),
        mismatchedByteCount: comparisons.reduce(
            (sum, comparison) => sum + comparison.mismatchedByteCount,
            0,
        ),
        mismatchedPixelCount: comparisons.reduce(
            (sum, comparison) => sum + comparison.mismatchedPixelCount,
            0,
        ),
    });
}

async function writeRecord(result) {
    await writeText(result.recordDirectory, 'state-goal.md', `# State Goal

Generate the full-size M1 Figure 1 CPU sky-dome artifacts and compare decoded
RGBA bytes exactly against the accepted Bruneton start-fresh Step 032 targets.
Generated PNGs are retained under \`artifacts/\` whether the comparison is
accepted or rejected.
`);
    await writeJson(result.recordDirectory, 'inputs.json', {
        trigger: 'M1 Subgoal 1.5 full Step 032 image comparison',
        scenes: FIGURE1_SCENES.map((scene) => scene.id),
        requestedSizePixels: result.sizePixels,
        targetArtifactSizePixels: FIGURE1_RENDER_CONSTANTS.imageSizePixels,
        incidentRadianceCache: result.useIncidentCache ? 'distant-l2' : 'disabled-by-runner-option',
        numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
        targetArtifactRoot: FIGURE1_RENDER_CONSTANTS.targetArtifactRoot,
        runtimeCodeChanged: true,
    });
    await writeJson(result.recordDirectory, 'provenance.json', {
        generatedAt: nowIso(),
        sourceTrails: [
            'agents/topics/apps/flat/reconciliation/action-plan.md',
            'agents/topics/apps/flat/reconciliation/experimental-guidelines.md',
            'agents/topics/apps/flat/reconciliation/bruneton-start-fresh-source-audit.md',
            'tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity',
            'tmp/atmosphere/reconciliation/014-distant-l2-cache-build-bind-sample',
            'tmp/atmosphere/reconciliation/015-first-sky-dome-artifacts',
        ],
    });
    await writeJson(result.recordDirectory, 'equations-and-constants.json', {
        status: result.status,
        renderConstants: FIGURE1_RENDER_CONSTANTS,
        displayConstants: FIGURE1_DISPLAY_CONSTANTS,
        numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
        cacheMode: result.useIncidentCache ? 'distant-l2' : 'none',
        comparisonCriteria: {
            sameDimensions: true,
            maxAbsRgbaDelta: 0,
            mismatchedByteCount: 0,
            mismatchedPixelCount: 0,
        },
    });
    await writeJson(result.recordDirectory, 'criteria-results.json', {
        criteria: [
            {
                name: 'four full-size sky-dome PNG artifacts written',
                status: result.renderResults.length === FIGURE1_SCENES.length ? 'accepted' : 'rejected',
                result: `${result.renderResults.length} PNG files written and retained under artifacts/.`,
            },
            {
                name: 'exact Step 032 decoded RGBA parity',
                status: result.status,
                result: `${result.summary.exactMatchCount}/${result.comparisonResults.length} images matched exactly.`,
                maxAbsRgbaDelta: result.summary.maxAbsRgbaDelta,
                mismatchedByteCount: result.summary.mismatchedByteCount,
                mismatchedPixelCount: result.summary.mismatchedPixelCount,
            },
        ],
    });
    await writeJson(result.recordDirectory, 'diagnostics.json', {
        artifacts: result.renderResults,
        comparisons: result.comparisonResults,
        summary: result.summary,
        cacheDiagnostics: result.cacheDiagnostics,
    });
    await writeJson(result.recordDirectory, 'command.json', {
        commands: [
            {
                command: `node scripts/flat/reconciliation/POC/src/runners/m1Step032ImageComparison.js --record ${result.recordDirectory} --size ${result.sizePixels}${result.useIncidentCache ? '' : ' --no-cache'}`,
                purpose: 'Generate full-size M1 Figure 1 CPU artifacts and compare decoded RGBA bytes to accepted Step 032 targets.',
            },
        ],
    });
    await writeJson(result.recordDirectory, 'result.json', {
        status: result.status,
        claim: result.status === 'accepted'
            ? 'M1 CPU distant/spherical artifacts exactly match accepted Step 032 decoded RGBA targets.'
            : 'M1 CPU distant/spherical artifacts do not yet exactly match accepted Step 032 decoded RGBA targets.',
        runtimeCodeChanged: true,
        artifactCount: result.renderResults.length,
        exactMatchCount: result.summary.exactMatchCount,
        maxAbsRgbaDelta: result.summary.maxAbsRgbaDelta,
        mismatchedByteCount: result.summary.mismatchedByteCount,
        mismatchedPixelCount: result.summary.mismatchedPixelCount,
        nextStep: result.status === 'accepted'
            ? 'Close Milestone 1 current-state docs.'
            : 'Classify the mismatch and fix transport, cache, renderer, display, or artifact-tool drift before rerunning in a fresh numbered record.',
    });
    await writeText(result.recordDirectory, 'report.md', `# Report

Generated ${result.renderResults.length} full-size Figure 1 sky-dome PNG
artifacts and compared decoded RGBA bytes against the accepted Step 032 target
set.
The generated PNGs are retained under \`artifacts/\` regardless of accepted or
rejected comparison status.

Status: ${result.status}

- Exact matches: ${result.summary.exactMatchCount}/${result.comparisonResults.length}
- Max absolute RGBA delta: ${result.summary.maxAbsRgbaDelta}
- Mismatched bytes: ${result.summary.mismatchedByteCount}
- Mismatched pixels: ${result.summary.mismatchedPixelCount}
`);
    await appendRunLog(
        result.recordDirectory,
        `m1Step032ImageComparison ${result.status} exactMatches=${result.summary.exactMatchCount}/${result.comparisonResults.length} maxAbsRgbaDelta=${result.summary.maxAbsRgbaDelta} mismatchedPixels=${result.summary.mismatchedPixelCount}.`,
    );
}

function makeRenderProgressLogger(sceneId, outputPath) {
    return (progress) => appendRunLog(
        recordDirectory,
        `m1Step032ImageComparison render-progress scene=${sceneId} stage=${progress.stage} rows=${progress.completedRows}/${progress.totalRows} pixels=${progress.completedPixels}/${progress.totalPixels} sky=${progress.skyPixelCount} transparent=${progress.transparentPixelCount} output=${outputPath}.`,
    );
}
