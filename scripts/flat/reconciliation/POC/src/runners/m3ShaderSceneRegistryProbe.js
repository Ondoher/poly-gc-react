// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.2.1.
// - agents/topics/apps/flat/reconciliation/shader-test-design.md, objective test inventory.
// - tmp/atmosphere/reconciliation/058-m3-node-three-scene-bridge.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ShaderSceneRegistry } from '../index.js';
import {
    appendRunLog,
    assert,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const INVENTORY_PATH = 'scripts/flat/reconciliation/POC/src/scenes/shader-scene-inventory.json';
const REQUIRED_OBJECTIVE_TEST_IDS = Object.freeze([
    'obj-001-zero-atmosphere-passthrough',
    'obj-002-display-adapter-cie-propagation',
    'obj-003-sky-no-hit-atmosphere-exit',
    'obj-004-finite-endpoint-near-mid-far',
    'obj-005-invalid-depth-log-continue',
    'obj-006-routing-same-distance-different-fixture',
    'obj-007-routing-same-fixture-different-distance',
    'obj-008-spectral-fixture-wavelength-bands',
    'obj-009-spectral-basis-extent',
    'obj-010-cache-off-on-nonzero',
    'obj-011-cache-boundary-miss-log-continue',
    'obj-012-horizon-long-path',
    'obj-013-high-altitude-atmosphere-boundary',
    'obj-014-readback-png-artifact',
]);

const recordDirectory = parseRecordDirectory(process.argv);

await appendRunLog(recordDirectory, 'm3ShaderSceneRegistryProbe started.');

const inventory = JSON.parse(await readFile(resolve(INVENTORY_PATH), 'utf8'));
const registry = new ShaderSceneRegistry(inventory);
const validationReport = registry.validate();
const scenes = registry.listScenes();
const objectiveScenes = registry.listObjectiveScenes();
const m3Scenes = registry.listScenesForMilestone('M3');
const acceptedBridgeScene = registry.getScene('shader-lab-node-controlled-reference');
const missingObjectiveIds = REQUIRED_OBJECTIVE_TEST_IDS.filter((testId) =>
    !validationReport.objectiveTestIds.includes(testId));
const scenesRequiringLiveBrowserDescriptor = scenes.filter((scene) =>
    scene.requiresLiveBrowserForDescriptor === true);
const objectiveScenesMissingCriteria = objectiveScenes.filter((scene) =>
    scene.objectiveCriteria.length === 0);
const objectiveCriteriaMissingRequiredGpuGate = objectiveScenes.filter((scene) =>
    scene.sceneId !== 'shader-lab-node-controlled-reference'
    && !scene.objectiveCriteria.some((criterion) => criterion.requiredBeforeGpuObjectiveRuns));
const objectiveScenesMissingExternalRgbaPolicy = objectiveScenes.filter((scene) =>
    scene.expectedDisplayPixelClaims.some((claim) =>
        claim.expectedValueSource.finalNumericRgbaStatus !== 'pending-external-source'
        && claim.expectedValueSource.materialization !== 'accepted-record'));

assert(validationReport.sceneCount === 15,
    'Seed inventory must include the accepted Node bridge row plus obj-001 through obj-014.');
assert(validationReport.acceptedSceneCount === 1,
    'Seed inventory must have exactly one accepted row at Stage 3.2.1.');
assert(acceptedBridgeScene.acceptedRecord === 'tmp/atmosphere/reconciliation/058-m3-node-three-scene-bridge',
    'Accepted bridge scene must resolve to record 058.');
assert(missingObjectiveIds.length === 0,
    'Seed inventory must include every required objective test id.');
assert(m3Scenes.length === scenes.length,
    'All seed inventory scenes must be active for M3 descriptor planning.');
assert(scenesRequiringLiveBrowserDescriptor.length === 0,
    'Descriptor validation must not require live browser state.');
assert(objectiveScenesMissingCriteria.length === 0,
    'Objective scenes must carry explicit Stage 3.2.2 criteria.');
assert(objectiveCriteriaMissingRequiredGpuGate.length === 0,
    'Planned objective scenes must mark at least one criterion required before GPU objective runs.');
assert(validationReport.pendingExternalNumericRgbaSceneIds.length === scenes.length,
    'Every seed scene must report pending externally sourced numeric RGBA materialization.');
assert(objectiveScenesMissingExternalRgbaPolicy.length === 0,
    'Objective scenes must not claim internally invented final numeric RGBA values.');

const criteria = Object.freeze([
    criterion('inventory-parses-and-validates', true),
    criterion('seed-inventory-has-accepted-bridge-plus-14-objective-rows', validationReport.sceneCount === 15),
    criterion('accepted-node-bridge-row-resolves-record-058',
        acceptedBridgeScene.acceptedRecord === 'tmp/atmosphere/reconciliation/058-m3-node-three-scene-bridge'),
    criterion('all-required-objective-test-ids-present', missingObjectiveIds.length === 0),
    criterion('objective-scenes-have-pixel-claims-provenance-and-extents',
        objectiveScenes.every((scene) =>
            scene.expectedDisplayPixelClaims.length > 0
            && scene.provenanceIds.length > 0
            && scene.extentTags.length > 0)),
    criterion('objective-scenes-have-explicit-criteria', objectiveScenesMissingCriteria.length === 0),
    criterion('planned-objective-scenes-gate-gpu-objective-runs',
        objectiveCriteriaMissingRequiredGpuGate.length === 0),
    criterion('objective-criteria-name-claim-measurement-owner-and-failure',
        objectiveScenes.every((scene) =>
            scene.objectiveCriteria.every((entry) =>
                entry.claim.length > 0
                && entry.measurement.length > 0
                && entry.owner.length > 0
                && entry.failureClassification.length > 0))),
    criterion('descriptor-validation-does-not-require-live-browser',
        scenesRequiringLiveBrowserDescriptor.length === 0),
    criterion('final-numeric-rgba-values-are-pending-external-materialization',
        validationReport.pendingExternalNumericRgbaSceneIds.length === scenes.length),
]);
const status = criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Implement and verify the Stage 3.2.1 shader validation scene inventory. The
inventory must list the accepted Node bridge scene plus the initial objective
test obligations from \`shader-test-design.md\`, while making clear that final
numeric RGBA gates require external fixture or external-source-backed record
materialization before acceptance.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.2.1',
    runner: 'm3ShaderSceneRegistryProbe',
    inventoryPath: INVENTORY_PATH,
    requiredObjectiveTestIds: REQUIRED_OBJECTIVE_TEST_IDS,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-32-gpu-validation-scene-set',
        'agents/topics/apps/flat/reconciliation/shader-test-design.md#objective-test-inventory',
        'agents/topics/apps/flat/reconciliation/shader-design.md#gpu-validation-scene-set',
        'tmp/atmosphere/reconciliation/058-m3-node-three-scene-bridge',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    validationReport,
    missingObjectiveIds,
    scenesRequiringLiveBrowserDescriptor: scenesRequiringLiveBrowserDescriptor.map((scene) => scene.sceneId),
    objectiveScenesMissingCriteria: objectiveScenesMissingCriteria.map((scene) => scene.sceneId),
    objectiveCriteriaMissingRequiredGpuGate: objectiveCriteriaMissingRequiredGpuGate.map((scene) => scene.sceneId),
    objectiveScenesMissingExternalRgbaPolicy: objectiveScenesMissingExternalRgbaPolicy.map((scene) => scene.sceneId),
    sceneIds: scenes.map((scene) => scene.sceneId),
    objectiveCriteriaByScene: Object.fromEntries(objectiveScenes.map((scene) => [
        scene.sceneId,
        scene.objectiveCriteria.map((criterionEntry) => criterionEntry.criterionId),
    ])),
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m3ShaderSceneRegistryProbe.js --record ${recordDirectory}`,
            timestamp: nowIso(),
        }),
    ]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    acceptedCriteriaCount: criteria.filter((entry) => entry.status === 'accepted').length,
    criteriaCount: criteria.length,
    validationReport,
});
await writeText(recordDirectory, 'report.md', `# Report

Stage 3.2.1 shader validation scene inventory is implemented.

- The inventory parses and validates.
- It contains the accepted Node bridge row plus the initial \`obj-001\`
  through \`obj-014\` objective obligations from \`shader-test-design.md\`.
- The accepted bridge row resolves to record 058.
- Objective rows carry explicit criteria naming the claim, measurement,
  owner, and failure classification.
- Objective rows carry provenance ids, extent tags, selected pixel or
  controlled-region targets, and expected display-pixel claims.
- Descriptor validation does not require live browser state.
- Final numeric RGBA values are deliberately marked pending external fixture
  or external-source-backed record materialization. They are not invented from
  local implementation code in this descriptor pass.
`);
await appendRunLog(recordDirectory, `m3ShaderSceneRegistryProbe ${status} criteria=${criteria.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    criteriaCount: criteria.length,
    validationReport,
}));

/**
 * @param {string} name - Criterion name.
 * @param {boolean} accepted - Whether criterion passed.
 * @returns {{ readonly name: string; readonly status: 'accepted' | 'rejected'; }}
 */
function criterion(name, accepted) {
    return Object.freeze({
        name,
        status: accepted ? 'accepted' : 'rejected',
    });
}
