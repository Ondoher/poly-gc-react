// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.1.
// - agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md, ext-002, ext-003, ext-011, ext-014, ext-015, ext-018.
// - tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership.

import {
    M2_LOCAL_FLAT_SEED_CONSTANTS,
} from '../index.js';
import { createM2LocalFlatModels, makeM2SeedSummary } from './createM2Models.js';
import {
    assert,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
const scene = seed.scenes[0];
const { geometry } = createM2LocalFlatModels(scene);
const observer = seed.observerPositionMeters;
const zenithSegment = geometry.resolveViewRaySegment({ direction: Object.freeze([0, 0, 1]) });
const horizonSegment = geometry.resolveViewRaySegment({ direction: Object.freeze([1, 0, 0]) });
const groundSegment = geometry.resolveViewRaySegment({ direction: Object.freeze([0, 0, -1]) });
const observerCoordinate = geometry.resolveAtmosphereCoordinate(observer);
const sourceRelativePosition = geometry.resolveSourceRelativePosition({ position: observer });
const sourcePath = geometry.resolveAtmospherePath({
    startPosition: observer,
    direction: sourceRelativePosition.directionToSource,
    sourcePathLimit: Object.freeze({
        maxDistanceMeters: sourceRelativePosition.distanceFromSourceMeters,
        reason: 'finite-local-source-distance',
    }),
});
const cacheAccess = geometry.resolveCacheAccess({
    position: observer,
    atmosphereCoordinate: observerCoordinate,
    sourceRelativePosition,
});
const expectedZenithEnd = seed.observerCenteredDome.apexAltitudeMeters - observer[2];
const expectedHorizonEnd = seed.observerCenteredDome.maxObserverViewRayExtentMeters;
const expectedGroundEnd = observer[2];

assert(Math.abs(zenithSegment.endDistanceMeters - expectedZenithEnd) < 1e-9,
    'Zenith flat view ray must clip at the observer-centered dome apex.');
assert(Math.abs(horizonSegment.endDistanceMeters - expectedHorizonEnd) < 1e-9,
    'Horizontal flat view ray must clip at the observer-centered dome horizon extent.');
assert(Math.abs(groundSegment.endDistanceMeters - expectedGroundEnd) < 1e-9,
    'Downward flat view ray must clip at the ground plane.');
assert(observerCoordinate.altitudeMeters === observer[2],
    'Flat atmosphere altitude must be position[2].');
assert(sourceRelativePosition.distanceFromSourceMeters > 0,
    'Source-relative local source distance must be finite and positive.');
assert(sourcePath.lengthMeters > 0 && sourcePath.lengthMeters < sourceRelativePosition.distanceFromSourceMeters,
    'Observer-to-source atmosphere path must clip at a finite domain boundary before reaching the above-atmosphere source.');
assert(cacheAccess.coordinates.length === 2,
    'Local cache access must produce z/rho coordinates.');

const diagnostics = Object.freeze({
    selectedSceneId: scene.id,
    observerCoordinate,
    zenithSegment,
    horizonSegment,
    groundSegment,
    sourceRelativePosition,
    sourcePathMetadata: sourcePath.metadata,
    cacheAccess,
    runtimeDiagnostics: geometry.runtimeDiagnostics,
});

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Implement and verify the M2 flat z-up geometry profile against analytic
clipping and coordinate-handoff checks, without claiming local/flat visual
acceptance.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'M2 Subgoal 2.1 flat geometry profile checks',
    selectedSceneId: scene.id,
    seed: makeM2SeedSummary(),
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'agents/topics/apps/flat/reconciliation/action-plan.md',
        'agents/topics/apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md',
        'agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md',
        'tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision',
        'tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership',
        'tmp/atmosphere/reconciliation/021-m2-poc-runtime-boundary-diagnostics',
        'tmp/atmosphere/reconciliation/022-m2-general-runtime-boundary-policy',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'accepted-for-m2-seed-fixtures',
    geometryEquations: [
        'altitudeMeters = position[2]',
        'top-plane distance = (topAltitudeMeters - origin.z) / direction.z',
        'ground-plane distance = -origin.z / direction.z',
        'observer-centered dome centerZ = (H^2 - oz^2 - D^2) / (2 * (H - oz))',
        'observer-centered dome radius = H - centerZ',
        'ray-dome distance uses the positive ray-sphere exit root',
        'local source-relative direction and distance are resolved from geometry-owned model-space positions',
    ],
    seed: makeM2SeedSummary(),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        { name: 'flat altitude coordinate', status: 'accepted' },
        { name: 'zenith clips to observer-centered dome apex', status: 'accepted' },
        { name: 'horizontal view ray clips to observer-centered dome horizon extent', status: 'accepted' },
        { name: 'downward ray clips to ground plane', status: 'accepted' },
        { name: 'finite local source-relative packet', status: 'accepted' },
        { name: 'source path clips against supplied finite domain', status: 'accepted' },
        { name: 'local cache access exposes z/rho coordinates', status: 'accepted' },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', diagnostics);
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m2FlatGeometryProfile.js --record ${recordDirectory}`,
            purpose: 'Verify the M2 flat geometry profile and handoff packets.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'FlatEarthGeometry resolves flat altitude, ground/top/dome clipping, local source-relative packets, and z/rho cache access through the M1 abstraction surface.',
    runtimeCodeChanged: true,
    nextStep: 'Run local light-source calibration and packet checks.',
});
await writeText(recordDirectory, 'report.md', `# Report

Flat geometry analytic checks passed for the M2 seed profile. The atmosphere
top altitude, observer-centered dome descriptor, and legacy no-hit view cap
are supplied configuration; geometry consumes them for clipping but does not
promote the scalar cap as atmosphere extent.
`);
await writeText(recordDirectory, 'run.log', `${nowIso()} m2FlatGeometryProfile accepted selectedScene=${scene.id} diagnostics=${geometry.runtimeDiagnostics.length}.\n`);

console.log(JSON.stringify({
    status: 'accepted',
    selectedSceneId: scene.id,
    runtimeDiagnosticCount: geometry.runtimeDiagnostics.length,
}));
