// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stages 3.2.3 and 3.2.4.
// - agents/topics/apps/flat/reconciliation/shader-test-design.md, subjective review scenes and diagnostics.
// - tmp/atmosphere/reconciliation/061-m3-objective-scene-criteria.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
    CANONICAL_SPECTRAL_CHANNELS,
    CpuPostprocessSoftShader,
    ShaderSceneRegistry,
} from '../index.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const INVENTORY_PATH = 'scripts/flat/reconciliation/POC/src/scenes/shader-scene-inventory.json';
const ACTIVE_SUBJECTIVE_LINEAGE_IDS = Object.freeze([
    'southern-france-070-distant-midday-no-shadows',
    'southern-france-071-distant-sunset-no-shadows',
    'southern-france-072-local-closest-no-shadows',
    'southern-france-073-local-090-no-shadows',
]);
const DEFERRED_SUBJECTIVE_LINEAGE_IDS = Object.freeze([
    'southern-france-077-local-180-fit-no-shadows',
    'southern-france-078-local-090-fit-no-shadows',
    'southern-france-079-local-135-fit-no-shadows',
    'southern-france-080-local-stack-no-shadows',
    'southern-france-086-local-stack-stars-no-shadows',
]);
const EXCLUDED_SUBJECTIVE_LINEAGE_IDS = Object.freeze([
    'southern-france-shadowed-variants-excluded',
]);

const recordDirectory = parseRecordDirectory(process.argv);
const failures = [];

await appendRunLog(recordDirectory, 'm3SceneSetCompletionProbe started.');

const inventory = JSON.parse(await readFile(resolve(INVENTORY_PATH), 'utf8'));
let registry = null;
let validationReport = null;
let subjectiveLineage = [];
let objectiveOutputs = [];

try {
    registry = new ShaderSceneRegistry(inventory);
    validationReport = registry.validate();
    subjectiveLineage = registry.listSubjectiveLineage();
    recordSubjectiveLineageFailures(subjectiveLineage, failures);
    objectiveOutputs = runCpuObjectiveOutputs(registry, failures);
} catch (error) {
    failures.push(failure('registry-or-runner-crash', error.message, {
        stack: error.stack,
    }));
}

const status = failures.length === 0 ? 'accepted' : 'rejected';
const criteria = Object.freeze([
    criterion('active-subjective-southern-france-070-through-073-recorded',
        hasAllLineageIds(subjectiveLineage, ACTIVE_SUBJECTIVE_LINEAGE_IDS)
        && subjectiveLineage.filter((row) => row.reviewStatus === 'active-first-gpu-review').length === 4),
    criterion('deferred-local-flat-subjective-077-through-080-and-086-recorded',
        hasAllLineageIds(subjectiveLineage, DEFERRED_SUBJECTIVE_LINEAGE_IDS)),
    criterion('shadowed-southern-france-variants-explicitly-excluded',
        hasAllLineageIds(subjectiveLineage, EXCLUDED_SUBJECTIVE_LINEAGE_IDS)
        && subjectiveLineage.some((row) =>
            row.lineageId === 'southern-france-shadowed-variants-excluded'
            && row.reviewStatus === 'excluded'
            && row.shadowPolicy === 'excluded-shadowed')),
    criterion('cpu-soft-shader-ran-every-objective-scene-with-selected-pixels',
        objectiveOutputs.filter((entry) => entry.skippedReason == null).length === 14),
    criterion('cpu-soft-shader-output-finite-for-rendered-objective-scenes',
        objectiveOutputs
            .filter((entry) => entry.skippedReason == null)
            .every((entry) => entry.allDisplayRgbaFinite === true)),
    criterion('final-rgba-still-pending-materialization',
        validationReport?.pendingExternalNumericRgbaSceneIds?.length === validationReport?.sceneCount),
]);

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Finish Subgoal 3.2 by recording subjective review scene lineage and generating
CPU soft-shader selected-pixel outputs for the objective scene inventory. This
probe collects expectation failures and continues through the remaining scenes
instead of correcting failed cases during the run.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.2.3-3.2.4',
    runner: 'm3SceneSetCompletionProbe',
    inventoryPath: INVENTORY_PATH,
    activeSubjectiveLineageIds: ACTIVE_SUBJECTIVE_LINEAGE_IDS,
    deferredSubjectiveLineageIds: DEFERRED_SUBJECTIVE_LINEAGE_IDS,
    excludedSubjectiveLineageIds: EXCLUDED_SUBJECTIVE_LINEAGE_IDS,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-32-gpu-validation-scene-set',
        'agents/topics/apps/flat/reconciliation/shader-test-design.md#subjective-review-scenes',
        'scripts/flat/local-second-order/README.md',
        'tmp/atmosphere/reconciliation/061-m3-objective-scene-criteria',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    validationReport,
    subjectiveLineage,
    objectiveOutputs,
    failures,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m3SceneSetCompletionProbe.js --record ${recordDirectory}`,
            timestamp: nowIso(),
        }),
    ]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    acceptedCriteriaCount: criteria.filter((entry) => entry.status === 'accepted').length,
    criteriaCount: criteria.length,
    failureCount: failures.length,
    validationReport,
});
await writeText(recordDirectory, 'report.md', `# Report

Subgoal 3.2 scene-set completion probe finished with status: ${status}.

- Active first GPU review subjective rows: ${ACTIVE_SUBJECTIVE_LINEAGE_IDS.join(', ')}.
- Deferred local/flat subjective rows: ${DEFERRED_SUBJECTIVE_LINEAGE_IDS.join(', ')}.
- Explicit subjective exclusion: ${EXCLUDED_SUBJECTIVE_LINEAGE_IDS.join(', ')}.
- CPU soft-shader selected-pixel outputs were generated for objective scenes
  with selected pixels.
- Final numeric RGBA values remain pending external fixture or
  external-source-backed record materialization.
- Expectation failures, if any, are listed in \`criteria-results.json\` and
  \`diagnostics.json\`; this runner does not correct them.
`);
await appendRunLog(recordDirectory, `m3SceneSetCompletionProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    criteriaCount: criteria.length,
    failureCount: failures.length,
    validationReport,
}));

/**
 * @param {ShaderSceneRegistry} registry - Scene registry.
 * @param {Array<unknown>} collectedFailures - Failure collector.
 * @returns {readonly unknown[]} CPU output summaries.
 */
function runCpuObjectiveOutputs(registry, collectedFailures) {
    const softShader = new CpuPostprocessSoftShader({
        evaluator: makeDeterministicEvaluator(),
        endpointRadianceResolver(endpointContribution) {
            return spectralFixture(endpointContribution.spectralReferenceId ?? 'fixture-neutral-medium');
        },
    });

    return Object.freeze(registry.listObjectiveScenes().map((scene) => {
        if (scene.selectedPixels.length === 0) {
            return Object.freeze({
                sceneId: scene.sceneId,
                skippedReason: 'no-selected-pixels-runner-policy-or-controlled-region-only',
            });
        }

        try {
            const pixels = scene.selectedPixels.map((selection, index) =>
                makeScenePixel(scene, selection, index));
            const output = softShader.render({
                sceneInput: Object.freeze({
                    sceneId: scene.sceneId,
                    sourceKind: 'descriptor-synthetic-selected-pixels',
                    sourceDescriptorId: scene.sourceDescriptorId,
                    geometryDescriptorId: scene.geometryDescriptorId,
                    atmosphereDescriptorId: scene.atmosphereDescriptorId,
                    lightSourceDescriptorId: scene.lightSourceDescriptorId,
                    cacheDescriptorId: scene.cacheDescriptorId,
                    displayDescriptorId: scene.displayDescriptorId,
                    viewportPixels: scene.viewportPixels,
                    metadata: Object.freeze({
                        materializationStatus: 'provisional-cpu-output-not-final-rgba-gate',
                    }),
                }),
                pixels,
            });
            const allDisplayRgbaFinite = output.pixels.every((pixel) =>
                pixel.displayRgba.every(Number.isFinite));
            if (!allDisplayRgbaFinite) {
                collectedFailures.push(failure('nonfinite-cpu-display-rgba', 'CPU soft-shader emitted non-finite RGBA.', {
                    sceneId: scene.sceneId,
                }));
            }

            return Object.freeze({
                sceneId: scene.sceneId,
                selectedPixelCount: scene.selectedPixels.length,
                aggregateDiagnostics: output.aggregateDiagnostics,
                allDisplayRgbaFinite,
                pixels: output.pixels.map((pixel) => Object.freeze({
                    pixelId: pixel.pixelId,
                    sceneIntersectionKind: pixel.sceneIntersectionKind,
                    endpointPolicy: pixel.endpointPolicy,
                    displayRgba: pixel.displayRgba,
                    finalSpectralMean: spectralMean(pixel.finalSpectralRadiance),
                    transmittanceMean: spectralMean(pixel.evaluationOutput.pathRadiance.transmittance),
                    diagnosticCount: pixel.diagnostics.length,
                })),
            });
        } catch (error) {
            collectedFailures.push(failure('cpu-soft-shader-scene-failed', error.message, {
                sceneId: scene.sceneId,
                stack: error.stack,
            }));
            return Object.freeze({
                sceneId: scene.sceneId,
                skippedReason: 'cpu-soft-shader-scene-failed',
                error: error.message,
            });
        }
    }));
}

/**
 * @returns {{ evaluate(request: SpectralEvaluationRequest): SpectralEvaluationOutput; }} Deterministic evaluator.
 */
function makeDeterministicEvaluator() {
    return Object.freeze({
        evaluate(request) {
            const hitDistance = request.viewRayRequest?.endDistanceMeters ?? null;
            const kind = Number.isFinite(hitDistance) ? 'hit' : 'no-hit';
            const distanceFactor = Number.isFinite(hitDistance)
                ? Math.min(1, hitDistance / 10000)
                : 1;
            const transmittanceBase = kind === 'hit'
                ? 0.82 - 0.18 * distanceFactor
                : kind === 'invalid'
                    ? 1
                    : 0.92;
            const inScatteredBase = kind === 'hit'
                ? 0.00008 + 0.00002 * distanceFactor
                : kind === 'invalid'
                    ? 0
                    : 0.00018;

            return Object.freeze({
                outputKind: 'spectral',
                viewRaySegment: Object.freeze({
                    ray: request.viewRayRequest.ray,
                    startDistanceMeters: 0,
                    endDistanceMeters: Number.isFinite(hitDistance) ? hitDistance : 1000,
                }),
                pathIntegrationPoints: Object.freeze([]),
                pathRadiance: Object.freeze({
                    inScattered: spectralConstant(inScatteredBase),
                    transmittance: spectralConstant(transmittanceBase),
                }),
                diagnostics: Object.freeze([]),
            });
        },
    });
}

/**
 * @param {ShaderValidationSceneDescriptor} scene - Scene descriptor.
 * @param {ThreeSceneBridgePixelSelection} selection - Selected pixel.
 * @param {number} index - Pixel index.
 * @returns {SoftShaderScenePixelInput} Synthetic selected-pixel input.
 */
function makeScenePixel(scene, selection, index) {
    const invalid = selection.pixelId.includes('invalid') || scene.sceneId.includes('invalid-depth');
    const sky = selection.pixelId.includes('sky')
        || selection.pixelId.includes('horizon')
        || selection.pixelId.includes('altitude')
        || selection.pixelId.includes('cache-miss')
        || selection.pixelId.includes('first-channel')
        || selection.pixelId.includes('last-channel');
    const hit = !invalid && !sky;
    const distanceMeters = distanceForPixel(selection.pixelId, index);

    return Object.freeze({
        pixelId: selection.pixelId,
        coordinate: Object.freeze({ x: selection.x, y: selection.y }),
        ray: Object.freeze({
            origin: Object.freeze([0, 0, 0]),
            direction: unitDirectionForIndex(index),
        }),
        sceneIntersection: invalid
            ? Object.freeze({ kind: 'invalid', invalidReason: 'synthetic-invalid-depth-fixture' })
            : hit
                ? Object.freeze({
                    kind: 'hit',
                    distanceMeters,
                    hitPosition: Object.freeze([0, distanceMeters, 0]),
                })
                : Object.freeze({ kind: 'no-hit' }),
        endpointContribution: hit
            ? Object.freeze({
                policy: 'spectrum-id-reference-radiance',
                opacity: 'opaque',
                spectralReferenceId: spectralReferenceForPixel(selection.pixelId),
            })
            : null,
        pathIntervalCount: 4,
        metadata: Object.freeze({
            sceneId: scene.sceneId,
            syntheticFor: 'm3-cpu-objective-scene-output-probe',
        }),
    });
}

/**
 * @param {readonly ShaderSubjectiveSceneLineageDescriptor[]} lineage - Subjective lineage rows.
 * @param {Array<unknown>} collectedFailures - Failure collector.
 * @returns {void}
 */
function recordSubjectiveLineageFailures(lineage, collectedFailures) {
    const activeRows = lineage.filter((row) => row.reviewStatus === 'active-first-gpu-review');
    if (!hasAllLineageIds(lineage, ACTIVE_SUBJECTIVE_LINEAGE_IDS) || activeRows.length !== 4) {
        collectedFailures.push(failure('subjective-active-lineage-mismatch', 'Active subjective lineage rows do not match expected Southern France 070-073 set.', {
            expected: ACTIVE_SUBJECTIVE_LINEAGE_IDS,
            actual: activeRows.map((row) => row.lineageId),
        }));
    }

    if (!hasAllLineageIds(lineage, DEFERRED_SUBJECTIVE_LINEAGE_IDS)) {
        collectedFailures.push(failure('subjective-deferred-lineage-mismatch', 'Deferred subjective lineage rows do not include expected 077-080 and 086 set.', {
            expected: DEFERRED_SUBJECTIVE_LINEAGE_IDS,
            actual: lineage.filter((row) => row.reviewStatus === 'deferred-local-flat-follow-on').map((row) => row.lineageId),
        }));
    }

    if (!hasAllLineageIds(lineage, EXCLUDED_SUBJECTIVE_LINEAGE_IDS)) {
        collectedFailures.push(failure('subjective-excluded-lineage-missing', 'Excluded shadowed Southern France variants are not recorded.', {
            expected: EXCLUDED_SUBJECTIVE_LINEAGE_IDS,
        }));
    }
}

function hasAllLineageIds(lineage, expectedIds) {
    const ids = new Set(lineage.map((row) => row.lineageId));
    return expectedIds.every((id) => ids.has(id));
}

function spectralReferenceForPixel(pixelId) {
    if (pixelId.includes('red')) return 'fixture-red';
    if (pixelId.includes('green')) return 'fixture-green';
    if (pixelId.includes('blue')) return 'fixture-blue';
    if (pixelId.includes('ground')) return 'fixture-ground-like';
    if (pixelId.includes('near')) return 'fixture-neutral-bright';
    if (pixelId.includes('far')) return 'fixture-neutral-dim';
    return 'fixture-neutral-medium';
}

function spectralFixture(referenceId) {
    const scale = {
        'fixture-red': 0.0022,
        'fixture-green': 0.0019,
        'fixture-blue': 0.0016,
        'fixture-ground-like': 0.0012,
        'fixture-neutral-bright': 0.0025,
        'fixture-neutral-dim': 0.0014,
        'fixture-neutral-medium': 0.0018,
    }[referenceId] ?? 0.0018;

    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map((channel, index) => {
        if (referenceId === 'fixture-red') return scale * (index > 9 ? 1.4 : 0.55);
        if (referenceId === 'fixture-green') return scale * (index > 4 && index < 11 ? 1.35 : 0.65);
        if (referenceId === 'fixture-blue') return scale * (index < 6 ? 1.45 : 0.5);
        return scale * (1 + index * 0.01);
    }));
}

function distanceForPixel(pixelId, index) {
    if (pixelId.includes('near')) return 850;
    if (pixelId.includes('mid')) return 3500;
    if (pixelId.includes('far')) return 9000;
    return 1800 + index * 725;
}

function unitDirectionForIndex(index) {
    const x = (index % 3 - 1) * 0.08;
    const y = 1;
    const z = 0.15 + index * 0.02;
    const length = Math.hypot(x, y, z);
    return Object.freeze([x / length, y / length, z / length]);
}

function spectralConstant(value) {
    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map(() => value));
}

function spectralMean(value) {
    return value.reduce((sum, entry) => sum + entry, 0) / value.length;
}

function criterion(name, accepted) {
    return Object.freeze({
        name,
        status: accepted ? 'accepted' : 'rejected',
    });
}

function failure(id, message, details = null) {
    return Object.freeze({ id, message, details });
}
