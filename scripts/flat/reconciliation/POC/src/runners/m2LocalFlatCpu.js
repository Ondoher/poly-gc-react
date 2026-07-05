// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.3.
// - agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md, ext-011, ext-014, ext-015.
// - tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate.

import {
    M2_LOCAL_FLAT_SEED_CONSTANTS,
} from '../index.js';
import { createM2LocalFlatModels, makeM2SeedSummary } from './createM2Models.js';
import {
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
const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
const selectedDirections = Object.freeze([
    Object.freeze({ id: 'zenith', direction: Object.freeze([0, 0, 1]) }),
    Object.freeze({ id: 'horizon-east', direction: Object.freeze([1, 0, 0]) }),
]);
const selectedSceneIds = new Set([
    seed.scenes[0].id,
    seed.scenes[Math.floor(seed.scenes.length / 2)].id,
    seed.scenes[seed.scenes.length - 1].id,
]);
const diagnostics = [];

for (const scene of seed.scenes.filter((candidate) => selectedSceneIds.has(candidate.id))) {
    const models = createM2LocalFlatModels(scene);
    const observerSourceDirection = models.geometry.resolveSourceRelativePosition({
        position: seed.observerPositionMeters,
    }).directionToSource;
    const directions = [
        ...selectedDirections,
        Object.freeze({ id: 'toward-local-source', direction: observerSourceDirection }),
    ];

    for (const selected of directions) {
        const output = models.evaluator.evaluate({
            viewRayRequest: Object.freeze({
                direction: selected.direction,
            }),
        });

        assert(output.outputKind === 'spectral', 'Local/flat CPU run must emit spectral output.');
        assert(finiteSpectral(output.pathRadiance.inScattered), 'Local/flat in-scattered radiance must be finite.');
        assert(nonnegativeSpectral(output.pathRadiance.inScattered), 'Local/flat in-scattered radiance must be nonnegative.');
        assert(finiteSpectral(output.pathRadiance.transmittance), 'Local/flat transmittance must be finite.');
        assert(output.pathRadiance.transmittance.every((value) => value >= 0 && value <= 1),
            'Local/flat transmittance must stay in [0, 1].');

        diagnostics.push(Object.freeze({
            sceneId: scene.id,
            rayId: selected.id,
            pathPointCount: output.pathIntegrationPoints.length,
            rayEndDistanceMeters: output.viewRaySegment.endDistanceMeters,
            meanInScattered: spectralMean(output.pathRadiance.inScattered),
            maxInScattered: Math.max(...output.pathRadiance.inScattered),
            meanTransmittance: spectralMean(output.pathRadiance.transmittance),
            minTransmittance: Math.min(...output.pathRadiance.transmittance),
            maxTransmittance: Math.max(...output.pathRadiance.transmittance),
            geometryRuntimeDiagnosticCount: models.geometry.runtimeDiagnostics.length,
        }));
    }
}

assert(diagnostics.some((entry) => entry.meanInScattered > 0),
    'At least one local/flat selected ray must produce positive in-scattered radiance.');

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Run basic local-Sun/flat-Earth CPU spectral transport through the existing
Milestone 1 evaluator and calculator before pre-asset experiments.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'M2 Subgoal 2.3 basic local/flat CPU wiring',
    seed: makeM2SeedSummary(),
    selectedSceneIds: [...selectedSceneIds],
    selectedRayIds: diagnostics.map((entry) => entry.rayId),
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'agents/topics/apps/flat/reconciliation/action-plan.md',
        'agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md',
        'agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md',
        'tmp/atmosphere/reconciliation/012-transport-helper-invariants',
        'tmp/atmosphere/reconciliation/013-concrete-distant-spherical-run',
        'tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'accepted-for-basic-cpu-wiring',
    reusedAlgorithmSurface: [
        'SpectralReferenceEvaluator.evaluate',
        'SpectralCalculator.computeRadiance',
        'GeometryModel source-relative/cache/path resolvers',
        'LightSourceModel direct lighting/source path limit',
        'CanonicalAtmosphere sample/integrate/phase methods',
    ],
    seed: makeM2SeedSummary(),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        { name: 'spectral output only', status: 'accepted' },
        { name: 'finite nonnegative in-scattered radiance', status: 'accepted' },
        { name: 'finite transmittance in [0, 1]', status: 'accepted' },
        { name: 'positive local/flat contribution in selected rays', status: 'accepted' },
        { name: 'no image artifacts generated', status: 'accepted' },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', { diagnostics });
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatCpu.js --record ${recordDirectory}`,
            purpose: 'Run local/flat CPU spectral transport through the abstract evaluator without image artifacts.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'Basic local-Sun/flat-Earth CPU wiring runs through the Milestone 1 abstraction surface and produces finite spectral transport output for selected rays.',
    runtimeCodeChanged: true,
    diagnosticCount: diagnostics.length,
    nextStep: 'Run the M2 pre-asset experiments before generating local/flat PNG assets.',
});
await writeText(recordDirectory, 'report.md', `# Report

Basic local/flat CPU wiring produced finite spectral outputs for
${diagnostics.length} selected scene/ray cases. No image artifacts were
generated in this record.
`);
await writeText(recordDirectory, 'run.log', `${nowIso()} m2LocalFlatCpu accepted selectedRayDiagnostics=${diagnostics.length}.\n`);

console.log(JSON.stringify({
    status: 'accepted',
    diagnosticCount: diagnostics.length,
}));
