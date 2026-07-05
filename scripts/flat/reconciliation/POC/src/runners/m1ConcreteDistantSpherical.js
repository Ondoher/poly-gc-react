// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 concrete distant/spherical execution.
// - agents/topics/apps/flat/algorithm32/conclusions.md, finite/nonnegative selected-ray diagnostics.
// - tmp/atmosphere/reconciliation/010-cli-experiment-run-record-rule.

import {
    FIGURE1_SCENES,
    STEP032_ARTIFACT_NUMERICAL_CONTROLS,
} from '../index.js';
import { createM1DistantSphericalModels } from './createM1Models.js';
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
const selectedDirections = Object.freeze([
    Object.freeze({ id: 'zenith', direction: Object.freeze([0, 0, 1]) }),
    Object.freeze({ id: 'horizon-east', direction: Object.freeze([1, 0, 0]) }),
]);
const diagnostics = [];

for (const scene of FIGURE1_SCENES) {
    const { evaluator } = createM1DistantSphericalModels(scene);

    for (const selected of selectedDirections) {
        const output = evaluator.evaluate({
            viewRayRequest: Object.freeze({
                direction: selected.direction,
            }),
        });

        assert(output.outputKind === 'spectral', 'Concrete run must emit spectral output.');
        assert(finiteSpectral(output.pathRadiance.inScattered), 'In-scattered radiance must be finite.');
        assert(nonnegativeSpectral(output.pathRadiance.inScattered), 'In-scattered radiance must be nonnegative.');
        assert(finiteSpectral(output.pathRadiance.transmittance), 'Transmittance must be finite.');
        assert(output.pathRadiance.transmittance.every((value) => value >= 0 && value <= 1),
            'Transmittance must stay in [0, 1].');

        diagnostics.push(Object.freeze({
            sceneId: scene.id,
            rayId: selected.id,
            pathPointCount: output.pathIntegrationPoints.length,
            meanInScattered: spectralMean(output.pathRadiance.inScattered),
            meanTransmittance: spectralMean(output.pathRadiance.transmittance),
            maxInScattered: Math.max(...output.pathRadiance.inScattered),
            minTransmittance: Math.min(...output.pathRadiance.transmittance),
            maxTransmittance: Math.max(...output.pathRadiance.transmittance),
        }));
    }
}

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Run concrete distant-Sun/spherical-Earth CPU transport through the abstract
evaluator and calculator, stopping before any image artifact generation.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'M1 concrete distant/spherical CPU execution before artifact generation',
    scenes: FIGURE1_SCENES.map((scene) => scene.id),
    selectedDirections: selectedDirections.map((direction) => direction.id),
    numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'agents/topics/apps/flat/algorithm32/conclusions.md',
        'agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md',
        'tmp/atmosphere/reconciliation/005-shared-baseline-constants',
        'tmp/atmosphere/reconciliation/012-transport-helper-invariants',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'accepted',
    numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    concreteClasses: [
        'CanonicalAtmosphere',
        'SphericalEarthGeometry',
        'DistantSunLightSource',
        'SpectralCalculator',
        'SpectralReferenceEvaluator',
    ],
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        { name: 'spectral output only', status: 'accepted' },
        { name: 'finite nonnegative in-scattered radiance', status: 'accepted' },
        { name: 'finite transmittance in [0, 1]', status: 'accepted' },
        { name: 'no image artifacts generated', status: 'accepted' },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', { diagnostics });
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m1ConcreteDistantSpherical.js --record ${recordDirectory}`,
            purpose: 'Run concrete distant/spherical CPU transport without image artifact generation.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'Concrete distant/spherical CPU transport runs through the abstract evaluator and calculator for selected rays without generating artifacts.',
    runtimeCodeChanged: true,
    diagnosticCount: diagnostics.length,
    nextStep: 'Build, bind, and sample the distant L2 incident-radiance cache.',
});
await writeText(recordDirectory, 'report.md', `# Report

Concrete distant-Sun/spherical-Earth CPU transport produced finite spectral
outputs for ${diagnostics.length} selected scene/ray cases. No image artifacts
were generated.
`);
await writeText(recordDirectory, 'run.log', `${nowIso()} m1ConcreteDistantSpherical accepted ${diagnostics.length} selected ray diagnostics.\n`);

console.log(JSON.stringify({
    status: 'accepted',
    diagnosticCount: diagnostics.length,
}));
