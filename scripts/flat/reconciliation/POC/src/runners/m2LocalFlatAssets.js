// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.5.
// - agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md, Step 018 guide-image policy.
// - tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate.

import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
    M2_LOCAL_FLAT_SEED_CONSTANTS,
    ImageComparison,
    Step018SkydomeImageWriter,
} from '../index.js';
import { createM2LocalFlatModels, makeM2SeedSummary } from './createM2Models.js';
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
const sizePixels = parsePositiveIntegerOption(process.argv, '--size', 320);
const sceneSetId = parseStringOption(process.argv, '--scene-set', 'step018-rotation');
const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
const sceneSet = resolveSceneSet(seed, sceneSetId);
const scenes = sceneSet.scenes;
const artifactDirectory = resolve(recordDirectory, 'artifacts');
const writer = new Step018SkydomeImageWriter();
const imageComparison = new ImageComparison();
const artifacts = [];
const comparisons = [];

await appendRunLog(recordDirectory, `m2LocalFlatAssets started sizePixels=${sizePixels} sceneSet=${sceneSet.id} scenes=${scenes.length}.`);
await mkdir(artifactDirectory, { recursive: true });

for (const scene of scenes) {
    await appendRunLog(recordDirectory, `m2LocalFlatAssets scene=${scene.id} model-build-started.`);

    const models = createM2LocalFlatModels(scene);
    const outputPath = resolve(artifactDirectory, scene.guideImageFilename);

    await appendRunLog(recordDirectory, `m2LocalFlatAssets scene=${scene.id} render-started output=${outputPath}.`);

    const renderResult = await writer.write({
        scene,
        evaluator: models.evaluator,
        outputPath,
        width: sizePixels,
        height: sizePixels,
        progress: makeRenderProgressLogger(scene.id, outputPath),
        progressRowInterval: 8,
    });
    const fileStats = await stat(outputPath);

    await appendRunLog(recordDirectory, `m2LocalFlatAssets scene=${scene.id} render-complete bytes=${fileStats.size}.`);

    assert(fileStats.size > 0, 'Rendered local/flat PNG file must be nonempty.');
    assert(renderResult.diagnostics.skyPixelCount > 0,
        'Rendered local/flat skydome must contain sky pixels.');
    assert(renderResult.diagnostics.transparentPixelCount > 0,
        'Rendered local/flat skydome must contain transparent outside-sky pixels.');
    assert(finiteSpectral(renderResult.diagnostics.maxRadiance),
        'Rendered local/flat max radiance must be finite.');
    assert(nonnegativeSpectral(renderResult.diagnostics.maxRadiance),
        'Rendered local/flat max radiance must be nonnegative.');

    artifacts.push(Object.freeze({
        artifact: renderResult.artifact,
        diagnostics: renderResult.diagnostics,
        fileSizeBytes: fileStats.size,
        meanMaxRadiance: spectralMean(renderResult.diagnostics.maxRadiance),
        geometryRuntimeDiagnostics: models.geometry.runtimeDiagnostics,
    }));

    if (sceneSet.guideComparisonAvailable && sceneSet.guideArtifactRoot) {
        const guidePath = resolve(sceneSet.guideArtifactRoot, scene.guideImageFilename);

        await appendRunLog(recordDirectory, `m2LocalFlatAssets scene=${scene.id} guide-compare-started guide=${guidePath}.`);

        const comparison = await imageComparison.compare({
            actualPath: outputPath,
            expectedPath: guidePath,
            metadata: Object.freeze({
                sceneId: scene.id,
                guideImageFilename: scene.guideImageFilename,
                guideRole: 'diagnostic-not-canonical',
                sceneSetId: sceneSet.id,
            }),
        });

        comparisons.push(comparison);
        await appendRunLog(recordDirectory, `m2LocalFlatAssets scene=${scene.id} guide-compare-complete exact=${comparison.exactMatch} maxAbsRgbaDelta=${comparison.maxAbsRgbaDelta}.`);
    } else {
        await appendRunLog(recordDirectory, `m2LocalFlatAssets scene=${scene.id} guide-compare-skipped sceneSet=${sceneSet.id}.`);
    }
}

const comparisonSummary = summarizeComparisons(comparisons);

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Generate local-Sun/flat-Earth diagnostic skydome PNG artifacts after the
pre-asset experiment gate. The selected scene set is \`${sceneSet.id}\`.
Compare to Step 018 guide images only when the selected set has guide images;
guide comparisons are diagnostics only, not exact-match acceptance targets.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'M2 Subgoal 2.5 local/flat diagnostic asset generation',
    seed: makeM2SeedSummary(),
    selectedSceneSet: summarizeSceneSet(sceneSet),
    requestedSizePixels: sizePixels,
    scenes: scenes.map((scene) => scene.id),
    guideArtifactRoot: sceneSet.guideArtifactRoot,
    guideCanonicalExactMatchTarget: sceneSet.exactParityTarget,
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'agents/topics/apps/flat/reconciliation/action-plan.md',
        'agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md',
        'agents/topics/apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md',
        'tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate',
        'tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'diagnostic-assets-generated',
    seed: makeM2SeedSummary(),
    renderer: {
        writer: 'Step018SkydomeImageWriter',
        displayPath: 'Figure1SkyDomeRenderer display conversion reused outside transport',
        exactParityTarget: false,
    },
    selectedSceneSet: summarizeSceneSet(sceneSet),
    comparisonPolicy: {
        guideImages: sceneSet.guideComparisonAvailable ? 'diagnostic-only' : 'not-available-for-selected-scene-set',
        exactMatchRequired: false,
    },
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        {
            name: 'all local/flat PNG artifacts written',
            status: artifacts.length === scenes.length ? 'accepted' : 'rejected',
            result: `${artifacts.length}/${scenes.length} PNG files written under artifacts/.`,
        },
        {
            name: 'nonempty finite skydome diagnostics',
            status: artifacts.every((entry) => entry.fileSizeBytes > 0 && finiteSpectral(entry.diagnostics.maxRadiance))
                ? 'accepted'
                : 'rejected',
        },
        {
            name: 'Step 018 guide comparison metrics emitted',
            status: sceneSet.guideComparisonAvailable
                ? (comparisons.length === scenes.length ? 'accepted' : 'rejected')
                : 'not-applicable',
            result: sceneSet.guideComparisonAvailable
                ? `${comparisons.length} diagnostic comparisons emitted.`
                : `Scene set ${sceneSet.id} has no Step 018 guide images.`,
        },
        {
            name: 'exact Step 018 image parity',
            status: 'unresolved',
            result: 'Step 018 is guide imagery only and is not the M2 acceptance target.',
            exactMatchCount: comparisonSummary.exactMatchCount,
            maxAbsRgbaDelta: comparisonSummary.maxAbsRgbaDelta,
            mismatchedPixelCount: comparisonSummary.mismatchedPixelCount,
        },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', {
    artifacts,
    comparisons,
    comparisonSummary,
});
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatAssets.js --record ${recordDirectory} --size ${sizePixels} --scene-set ${sceneSet.id}`,
            purpose: 'Generate local/flat diagnostic PNG artifacts and optional guide-image metrics for the selected scene set.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: sceneSet.guideComparisonAvailable
        ? 'Local/flat diagnostic skydome PNG artifacts were generated and retained; Step 018 comparisons are diagnostic only.'
        : 'Local/flat diagnostic skydome PNG artifacts were generated and retained for the additional subjective scene set.',
    runtimeCodeChanged: true,
    artifactCount: artifacts.length,
    exactGuideMatchCount: comparisonSummary.exactMatchCount,
    maxAbsRgbaDelta: comparisonSummary.maxAbsRgbaDelta,
    nextStep: 'Stop before Subgoal 2.6 local CPU record closeout.',
});
await writeText(recordDirectory, 'report.md', `# Report

Generated ${artifacts.length} local/flat diagnostic skydome PNG artifacts under
\`artifacts/\` for scene set \`${sceneSet.id}\`.
${sceneSet.guideComparisonAvailable
        ? 'Emitted Step 018 guide-image metrics. These comparisons are diagnostic evidence, not exact canonical local/flat targets.'
        : 'No Step 018 guide-image metrics were emitted because this scene set is an additional subjective review set.'}

- Exact guide matches: ${comparisonSummary.exactMatchCount}/${comparisons.length}
- Max absolute RGBA delta: ${comparisonSummary.maxAbsRgbaDelta}
- Mismatched pixels: ${comparisonSummary.mismatchedPixelCount}
`);
await appendRunLog(recordDirectory, `m2LocalFlatAssets accepted artifacts=${artifacts.length} exactGuideMatches=${comparisonSummary.exactMatchCount}/${comparisons.length} maxAbsRgbaDelta=${comparisonSummary.maxAbsRgbaDelta}.`);

console.log(JSON.stringify({
    status: 'accepted',
    artifactCount: artifacts.length,
    exactGuideMatchCount: comparisonSummary.exactMatchCount,
    maxAbsRgbaDelta: comparisonSummary.maxAbsRgbaDelta,
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

function parseStringOption(argv, optionName, defaultValue) {
    const optionIndex = argv.indexOf(optionName);

    if (optionIndex === -1) {
        return defaultValue;
    }

    const value = argv[optionIndex + 1];

    if (!value || value.startsWith('--')) {
        throw new RangeError(`${optionName} requires a value.`);
    }

    return value;
}

function resolveSceneSet(seedConstants, requestedSceneSetId) {
    const sceneSet = seedConstants.sceneSets[requestedSceneSetId]
        ?? Object.values(seedConstants.sceneSets).find((candidate) => candidate.id === requestedSceneSetId);

    if (!sceneSet) {
        const available = Object.keys(seedConstants.sceneSets).join(', ');

        throw new RangeError(`Unknown --scene-set "${requestedSceneSetId}". Available scene sets: ${available}.`);
    }

    return sceneSet;
}

function summarizeSceneSet(sceneSet) {
    return Object.freeze({
        id: sceneSet.id,
        label: sceneSet.label,
        description: sceneSet.description,
        guideComparisonAvailable: sceneSet.guideComparisonAvailable,
        guideArtifactRoot: sceneSet.guideArtifactRoot,
        exactParityTarget: sceneSet.exactParityTarget,
        sourceBrightnessCalibration: sceneSet.sourceBrightnessCalibration ?? null,
        sceneCount: sceneSet.scenes.length,
    });
}

function summarizeComparisons(comparisonResults) {
    if (comparisonResults.length === 0) {
        return Object.freeze({
            exactMatchCount: 0,
            maxAbsRgbaDelta: null,
            mismatchedByteCount: 0,
            mismatchedPixelCount: 0,
            meanAbsRgbaDelta: null,
            rmseRgbaDelta: null,
        });
    }

    return Object.freeze({
        exactMatchCount: comparisonResults.filter((comparison) => comparison.exactMatch).length,
        maxAbsRgbaDelta: Math.max(...comparisonResults.map((comparison) => comparison.maxAbsRgbaDelta)),
        mismatchedByteCount: comparisonResults.reduce(
            (sum, comparison) => sum + comparison.mismatchedByteCount,
            0,
        ),
        mismatchedPixelCount: comparisonResults.reduce(
            (sum, comparison) => sum + comparison.mismatchedPixelCount,
            0,
        ),
        meanAbsRgbaDelta: comparisonResults.reduce(
            (sum, comparison) => sum + comparison.meanAbsRgbaDelta,
            0,
        ) / comparisonResults.length,
        rmseRgbaDelta: comparisonResults.reduce(
            (sum, comparison) => sum + comparison.rmseRgbaDelta,
            0,
        ) / comparisonResults.length,
    });
}

function makeRenderProgressLogger(sceneId, outputPath) {
    return (progress) => appendRunLog(
        recordDirectory,
        `m2LocalFlatAssets render-progress scene=${sceneId} stage=${progress.stage} rows=${progress.completedRows}/${progress.totalRows} pixels=${progress.completedPixels}/${progress.totalPixels} sky=${progress.skyPixelCount} transparent=${progress.transparentPixelCount} output=${outputPath}.`,
    );
}
