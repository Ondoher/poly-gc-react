// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.1.1.
// - agents/topics/apps/flat/reconciliation/shader-design.md, CPU postprocess shader contract.
// - agents/topics/apps/flat/reconciliation/shader-test-design.md, objective scene-input rules.

import { SoftShaderSceneInputAdapter } from '../index.js';
import {
    appendRunLog,
    assert,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const CAPTURED_SCENE_ENDPOINT_POLICY =
    'captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy';

await appendRunLog(recordDirectory, 'm3SoftShaderSceneInputContract started.');

const adapter = new SoftShaderSceneInputAdapter();
const hitPixel = createPixelInput({
    pixelId: 'fixture-card-near-center',
    sceneIntersection: Object.freeze({
        kind: 'hit',
        distanceMeters: 42,
        hitPosition: Object.freeze([0, 0, 42]),
    }),
    endpointContribution: Object.freeze({
        policy: 'spectrum-id-reference-radiance',
        opacity: 'opaque',
        spectralReferenceId: 'fixture-neutral-medium',
    }),
});

const preparedHit = adapter.preparePixel(hitPixel);
assert(preparedHit.evaluationRequest.viewRayRequest.endDistanceMeters === 42,
    'Hit distance must become geometry-facing viewRayRequest.endDistanceMeters.');
assert(preparedHit.evaluationRequest.viewRayRequest.groundBoundaryMode === 'scene-hit-owned',
    'Finite scene hits must terminate at the scene/mesh hit distance, not a hidden analytic ground boundary.');
assert(preparedHit.endpointContribution?.spectralReferenceId === 'fixture-neutral-medium',
    'Endpoint spectral reference must remain available outside evaluate request.');
assert(!Object.hasOwn(preparedHit.evaluationRequest, 'endpointContribution'),
    'Endpoint contribution must not enter the evaluate request.');
assert(!JSON.stringify(preparedHit.evaluationRequest).includes('fixture-neutral-medium'),
    'Endpoint spectral reference id must not be hidden inside evaluate metadata.');
assert(!JSON.stringify(preparedHit.evaluationRequest).includes('hitPosition'),
    'Scene hit position must not be hidden inside evaluate metadata.');
assert(!Object.hasOwn(preparedHit.evaluationRequest.viewRayRequest, 'sceneIntersection'),
    'Only ray plus endDistanceMeters should reach evaluate for finite hits.');

const capturedColorPixel = createPixelInput({
    pixelId: 'captured-scene-color-hit',
    sceneIntersection: Object.freeze({
        kind: 'hit',
        distanceMeters: 17,
        hitPosition: Object.freeze([0, 0, 17]),
    }),
    endpointContribution: Object.freeze({
        policy: CAPTURED_SCENE_ENDPOINT_POLICY,
        opacity: 'opaque',
        capturedSceneColorDisplayRgb: Object.freeze([0, 0.66, 0.16]),
    }),
});
const preparedCapturedColor = adapter.preparePixel(capturedColorPixel);
assert(preparedCapturedColor.evaluationRequest.viewRayRequest.endDistanceMeters === 17,
    'Captured-color hit distance must remain the only geometry-facing hit input.');
assert(preparedCapturedColor.endpointContribution?.capturedSceneColorDisplayRgb?.[1] === 0.66,
    'Captured scene color must remain available outside evaluate request.');
assert(!Object.hasOwn(preparedCapturedColor.evaluationRequest, 'endpointContribution'),
    'Captured scene color contribution must not enter the evaluate request.');
assert(!JSON.stringify(preparedCapturedColor.evaluationRequest).includes('capturedSceneColorDisplayRgb'),
    'Captured scene color must not be hidden inside evaluate metadata.');
assert(!Object.hasOwn(preparedCapturedColor.evaluationRequest.viewRayRequest, 'sceneIntersection'),
    'Captured-color hit should pass only ray plus endDistanceMeters into evaluate.');

const noHitPixel = createPixelInput({
    pixelId: 'sky-control',
    sceneIntersection: Object.freeze({ kind: 'no-hit' }),
    endpointContribution: null,
});
const preparedNoHit = adapter.preparePixel(noHitPixel);
assert(!Object.hasOwn(preparedNoHit.evaluationRequest.viewRayRequest, 'endDistanceMeters'),
    'No-hit pixels must not invent a finite hit cap.');
assert(preparedNoHit.evaluationRequest.viewRayRequest.groundBoundaryMode === 'scene-hit-owned',
    'No-hit pixels must not invent a hidden analytic ground endpoint.');
assert(preparedNoHit.endpointContribution === null,
    'No-hit pixels should carry no endpoint contribution.');

const invalidPixel = createPixelInput({
    pixelId: 'invalid-depth-control',
    sceneIntersection: Object.freeze({
        kind: 'invalid',
        invalidReason: 'depth-out-of-range',
    }),
    endpointContribution: null,
});
const preparedInvalid = adapter.preparePixel(invalidPixel);
assert(!Object.hasOwn(preparedInvalid.evaluationRequest.viewRayRequest, 'endDistanceMeters'),
    'Invalid intersections must not be promoted to finite hit caps.');
assert(preparedInvalid.diagnostics.some((diagnostic) => diagnostic.severity === 'warning'),
    'Invalid intersections must emit a bounded selected-pixel warning.');

const rgbRejection = captureError(() => adapter.preparePixel(createPixelInput({
    pixelId: 'rgb-rejection',
    metadata: Object.freeze({ capturedRgb: Object.freeze([1, 0, 0]) }),
})));
assert(rgbRejection?.code === 'RGB_FIELD_REJECTED_FROM_EVALUATE_INPUT',
    'RGB/display fields must be rejected before building an evaluate request.');

const transparentRejection = captureError(() => adapter.preparePixel(createPixelInput({
    pixelId: 'transparent-rejection',
    endpointContribution: Object.freeze({
        policy: 'spectrum-id-reference-radiance',
        opacity: 'transparent',
        spectralReferenceId: 'fixture-neutral-medium',
    }),
})));
assert(transparentRejection?.code === 'UNSUPPORTED_ENDPOINT_OPACITY',
    'Non-opaque endpoints must be rejected by the first contract.');

const diagnostics = Object.freeze({
    preparedHit,
    preparedCapturedColor,
    preparedNoHit,
    preparedInvalid,
    rgbRejection: summarizeError(rgbRejection),
    transparentRejection: summarizeError(transparentRejection),
});

const criteria = Object.freeze([
    Object.freeze({
        name: 'finite scene hit becomes geometry-facing endDistanceMeters',
        status: preparedHit.evaluationRequest.viewRayRequest.endDistanceMeters === 42
            && preparedHit.evaluationRequest.viewRayRequest.groundBoundaryMode === 'scene-hit-owned'
            ? 'accepted'
            : 'rejected',
    }),
    Object.freeze({
        name: 'endpoint contribution remains outside evaluate request',
        status: !Object.hasOwn(preparedHit.evaluationRequest, 'endpointContribution')
            && !Object.hasOwn(preparedHit.evaluationRequest.viewRayRequest, 'sceneIntersection')
            ? 'accepted'
            : 'rejected',
    }),
    Object.freeze({
        name: 'captured scene color endpoint remains outside evaluate request',
        status: preparedCapturedColor.endpointContribution?.policy === CAPTURED_SCENE_ENDPOINT_POLICY
            && !JSON.stringify(preparedCapturedColor.evaluationRequest).includes('capturedSceneColorDisplayRgb')
            ? 'accepted'
            : 'rejected',
    }),
    Object.freeze({
        name: 'no-hit and invalid intersections do not invent finite hit caps',
        status: !Object.hasOwn(preparedNoHit.evaluationRequest.viewRayRequest, 'endDistanceMeters')
            && !Object.hasOwn(preparedInvalid.evaluationRequest.viewRayRequest, 'endDistanceMeters')
            && preparedNoHit.evaluationRequest.viewRayRequest.groundBoundaryMode === 'scene-hit-owned'
            ? 'accepted'
            : 'rejected',
    }),
    Object.freeze({
        name: 'RGB/display fields are rejected before evaluate request construction',
        status: rgbRejection?.code === 'RGB_FIELD_REJECTED_FROM_EVALUATE_INPUT' ? 'accepted' : 'rejected',
    }),
    Object.freeze({
        name: 'non-opaque endpoints are rejected',
        status: transparentRejection?.code === 'UNSUPPORTED_ENDPOINT_OPACITY' ? 'accepted' : 'rejected',
    }),
]);

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Implement and verify the Stage 3.1.1 CPU soft-shader scene-input adapter
contract. The contract must prepare geometry-facing spatial input for
\`evaluate(...)\` while keeping endpoint contribution facts outside transport.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.1.1',
    runner: 'm3SoftShaderSceneInputContract',
    pixelIds: Object.freeze([
        hitPixel.pixelId,
        capturedColorPixel.pixelId,
        noHitPixel.pixelId,
        invalidPixel.pixelId,
        'rgb-rejection',
        'transparent-rejection',
    ]),
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-31-cpu-postprocess-soft-shader',
        'agents/topics/apps/flat/reconciliation/shader-design.md#cpu-postprocess-shader',
        'agents/topics/apps/flat/reconciliation/shader-test-design.md#scene-construction-rules',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status: criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected',
    criteria,
});
await writeJson(recordDirectory, 'diagnostics.json', diagnostics);
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m3SoftShaderSceneInputContract.js --record ${recordDirectory}`,
            timestamp: nowIso(),
        }),
    ]),
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    acceptedCriteriaCount: criteria.filter((entry) => entry.status === 'accepted').length,
    criteriaCount: criteria.length,
});
await writeText(recordDirectory, 'report.md', `# Report

Stage 3.1.1 scene-input adapter contract is implemented.

- Finite scene hits become geometry-facing \`endDistanceMeters\`.
- No-hit and invalid intersections do not create hit caps.
- Endpoint spectral fixture data remains outside \`evaluate(...)\`.
- Captured scene color is accepted only under the named post-transport
  endpoint policy and remains outside \`evaluate(...)\`.
- RGB/display fields are rejected before evaluate request construction.
- Non-opaque endpoints are rejected for the first contract.
`);
await appendRunLog(recordDirectory, `m3SoftShaderSceneInputContract accepted criteria=${criteria.length}.`);

console.log(JSON.stringify({
    status: 'accepted',
    recordDirectory,
    criteriaCount: criteria.length,
}));

function createPixelInput(overrides = {}) {
    return Object.freeze({
        pixelId: overrides.pixelId ?? 'test-pixel',
        coordinate: overrides.coordinate ?? Object.freeze({ x: 8, y: 4 }),
        ray: overrides.ray ?? Object.freeze({
            origin: Object.freeze([0, 0, 0]),
            direction: Object.freeze([0, 0, 1]),
        }),
        sceneIntersection: Object.hasOwn(overrides, 'sceneIntersection')
            ? overrides.sceneIntersection
            : Object.freeze({ kind: 'no-hit' }),
        endpointContribution: Object.hasOwn(overrides, 'endpointContribution')
            ? overrides.endpointContribution
            : null,
        metadata: overrides.metadata ?? Object.freeze({ source: 'contract-probe' }),
    });
}

function captureError(action) {
    try {
        action();
        return null;
    } catch (error) {
        return error;
    }
}

function summarizeError(error) {
    if (!error) {
        return null;
    }

    return Object.freeze({
        name: error.name,
        code: error.code ?? null,
        message: error.message,
        details: error.details ?? null,
    });
}
