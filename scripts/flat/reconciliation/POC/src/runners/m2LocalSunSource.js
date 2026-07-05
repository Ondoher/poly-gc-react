// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.2.
// - agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md, cal-001 through cal-006.
// - agents/topics/apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md, local-013, local-017, local-019, local-020.

import {
    CANONICAL_SPECTRAL_CHANNELS,
    M2_LOCAL_FLAT_SEED_CONSTANTS,
} from '../index.js';
import { createM2LocalFlatModels, makeM2SeedSummary } from './createM2Models.js';
import {
    assert,
    finiteSpectral,
    nowIso,
    parseRecordDirectory,
    spectralMean,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
const diagnostics = [];

for (const scene of seed.scenes) {
    const { geometry, lightSource } = createM2LocalFlatModels(scene);
    const sourceRelativePosition = geometry.resolveSourceRelativePosition({
        position: seed.observerPositionMeters,
    });
    const directLighting = lightSource.sampleDirectLighting({
        sourceRelativePosition,
    });
    const sourcePathLimit = lightSource.resolveSourcePathLimit({
        sourceRelativePosition,
        directLighting,
    });
    const expectedDistanceMeters = scene.observerDistanceKilometers * 1000;
    const expectedScale = seed.referenceSpectralIncidentScale * scene.distanceFalloffScale;
    const sourceScales = directLighting.incidentRadiance.map((radiance, index) =>
        radiance / CANONICAL_SPECTRAL_CHANNELS[index].solarIrradiance);
    const scaleMin = Math.min(...sourceScales);
    const scaleMax = Math.max(...sourceScales);

    assert(Math.abs(sourceRelativePosition.distanceFromSourceMeters - expectedDistanceMeters) < 1e-6,
        'Local geometry must regenerate scene source distance from source position.');
    assert(Math.abs(directLighting.metadata.incidentScale - expectedScale) < 1e-12,
        'Local light source must regenerate calibrated incident scale from falloff.');
    assert(Math.abs(scaleMax - scaleMin) < 1e-12,
        'Local light source must apply neutral/no-tint spectral scaling.');
    assert(finiteSpectral(directLighting.incidentRadiance),
        'Local direct incident radiance must be finite.');
    assert(sourcePathLimit.maxDistanceMeters === sourceRelativePosition.distanceFromSourceMeters,
        'Local source path limit must be the finite geometry-resolved source distance.');

    diagnostics.push(Object.freeze({
        sceneId: scene.id,
        observerDistanceMeters: sourceRelativePosition.distanceFromSourceMeters,
        expectedDistanceMeters,
        sourcePathLimit,
        falloffScale: directLighting.metadata.falloffScale,
        expectedFalloffScale: scene.distanceFalloffScale,
        incidentScale: directLighting.metadata.incidentScale,
        expectedIncidentScale: expectedScale,
        meanIncidentRadiance: spectralMean(directLighting.incidentRadiance),
        apparentAngularRadiusRadians: Math.atan2(
            seed.sourceRadiusMeters,
            sourceRelativePosition.distanceFromSourceMeters,
        ),
        neutralScaleMin: scaleMin,
        neutralScaleMax: scaleMax,
        staleTintExcluded: true,
    }));
}

const closest = diagnostics[0];

assert(Math.abs(closest.incidentScale - 1) < 1e-12,
    'Closest-approach M2 seed calibration should produce unit incident scale.');

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Verify the local finite-source lighting packet and seed calibration rule before
basic local/flat CPU transport wiring.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'M2 Subgoal 2.2 local Sun source packet and calibration checks',
    seed: makeM2SeedSummary(),
    scenes: seed.scenes.map((scene) => scene.id),
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'agents/topics/apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md',
        'agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md',
        'tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward',
        'tmp/atmosphere/local-second-order/095-local-source-neutral-white-stack',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'accepted-for-m2-seed-fixtures',
    equations: [
        'falloffScale = (referenceDistanceMeters / distanceFromSourceMeters)^2',
        'incidentScale = referenceSpectralIncidentScale * falloffScale',
        'incidentRadiance(lambda) = canonicalSolarIrradiance(lambda) * incidentScale',
        'apparentAngularRadiusRadians = atan2(sourceRadiusMeters, distanceFromSourceMeters)',
    ],
    seed: makeM2SeedSummary(),
    closestApproachCalibration: {
        referenceSpectralIncidentScale: seed.referenceSpectralIncidentScale,
        closestFalloffScale: seed.scenes[0].distanceFalloffScale,
        closestIncidentScale: closest.incidentScale,
    },
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        { name: 'source distances regenerated from geometry', status: 'accepted' },
        { name: 'inverse-square falloff applied from raw parameters', status: 'accepted' },
        { name: 'closest approach calibrates to unit incident scale', status: 'accepted' },
        { name: 'neutral spectral scale with stale tint excluded', status: 'accepted' },
        { name: 'finite local source path limit returned', status: 'accepted' },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', {
    scenes: diagnostics,
    calibrationRows: ['cal-001', 'cal-002', 'cal-003', 'cal-005', 'cal-006'],
});
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m2LocalSunSource.js --record ${recordDirectory}`,
            purpose: 'Verify local Sun source packet, falloff, calibration, and neutral spectral behavior.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'LocalSunLightSource consumes geometry-owned source-relative packets and regenerates finite-distance neutral incident radiance for all M2 seed scenes.',
    runtimeCodeChanged: true,
    diagnosticCount: diagnostics.length,
    nextStep: 'Wire local source and flat geometry through the CPU evaluator.',
});
await writeText(recordDirectory, 'report.md', `# Report

Local finite-source packet checks passed for ${diagnostics.length} M2 seed
scenes. The accepted claim is intentionally scoped to the M2 seed/calibration
behavior; default-profile source provenance still remains a closeout item.
`);
await writeText(recordDirectory, 'run.log', `${nowIso()} m2LocalSunSource accepted scenes=${diagnostics.length} closestIncidentScale=${closest.incidentScale}.\n`);

console.log(JSON.stringify({
    status: 'accepted',
    diagnosticCount: diagnostics.length,
    closestIncidentScale: closest.incidentScale,
}));
