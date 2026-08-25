// References:
// - agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md.
// - agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-plan.md, Phase 1.
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md.

import { readFile } from 'node:fs/promises';

import ExternalBoundaryRadiance from '../external-boundary-radiance/ExternalBoundaryRadiance.js';
import {
    EXTERNAL_BOUNDARY_RADIANCE_CONTRACT,
    EXTERNAL_BOUNDARY_RADIANCE_SPACE,
} from '../external-boundary-radiance/consts.js';
import {
    appendRunLog,
    assert,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const runnerName = 'm5ExternalBoundaryRadianceContract';
const providerCalls = [];
const provider = Object.freeze({
    sample(request) {
        providerCalls.push(request);
        const directionX = request.cameraRay.direction[0];
        const diagnostics = Object.freeze([Object.freeze({
            kind: 'controlled-boundary-provider',
            directionX,
            sceneIntersectionKind: request.sceneIntersection.kind,
        })]);

        if (directionX < -0.05) {
            return Object.freeze({
                state: 'no-body',
                providerId: 'controlled-celestial-provider',
                diagnostics,
            });
        }

        const apparentCoverage = directionX > 0.05 ? 0.25 : 1;
        const bodyFacts = {
            providerId: 'controlled-celestial-provider',
            bodyId: directionX > 0.05 ? 'partial-bright-disk' : 'full-bright-disk',
            bodyKind: 'synthetic-bright-disk',
            apparentCoverage,
            apparentFootprint: Object.freeze({
                kind: 'angular-disk',
                angularRadiusRadians: 0.01,
            }),
            diagnostics,
        };

        if (request.sceneIntersection.kind === 'hit') {
            return Object.freeze({
                state: 'occluded',
                ...bodyFacts,
                celestialRadiance: spectralConstant(0),
                occlusionState: 'scene-occluded',
            });
        }

        return Object.freeze({
            state: 'visible',
            ...bodyFacts,
            celestialRadiance: spectralConstant(0.8 * apparentCoverage),
            occlusionState: 'unoccluded',
        });
    },
});

await appendRunLog(recordDirectory, `${runnerName} started.`);

const boundary = new ExternalBoundaryRadiance({ provider });
const descriptor = boundary.describe();
const fullVisible = boundary.sample(createRequest({
    direction: Object.freeze([0, 0, 1]),
    diagnosticsEnabled: true,
}));
const partialVisible = boundary.sample(createRequest({
    direction: normalizedDirection(0.1, 0, 1),
    diagnosticsEnabled: true,
}));
const noBody = boundary.sample(createRequest({
    direction: normalizedDirection(-0.1, 0, 1),
    diagnosticsEnabled: true,
}));
const occluded = boundary.sample(createRequest({
    direction: Object.freeze([0, 0, 1]),
    sceneIntersection: Object.freeze({ kind: 'hit', distanceMeters: 125 }),
    diagnosticsEnabled: true,
}));
const diagnosticsDisabled = boundary.sample(createRequest({
    direction: Object.freeze([0, 0, 1]),
    diagnosticsEnabled: false,
}));

const invalidRayError = captureError(() => boundary.sample(createRequest({
    direction: Object.freeze([0, 0, 2]),
})));
const forbiddenCacheError = captureError(() => boundary.sample({
    ...createRequest({ direction: Object.freeze([0, 0, 1]) }),
    incidentRadianceSampling: Object.freeze({}),
}));
const invalidSpectrumError = captureError(() => new ExternalBoundaryRadiance({
    provider: Object.freeze({
        sample() {
            return visibleProviderOutput({ celestialRadiance: Object.freeze(Array(14).fill(1)) });
        },
    }),
}).sample(createRequest({ direction: Object.freeze([0, 0, 1]) })));
const forbiddenBackgroundError = captureError(() => new ExternalBoundaryRadiance({
    provider: Object.freeze({
        sample() {
            return Object.freeze({
                state: 'no-body',
                providerId: 'forbidden-background-provider',
                backgroundColor: Object.freeze([0, 0, 0]),
                diagnostics: Object.freeze([]),
            });
        },
    }),
}).sample(createRequest({ direction: Object.freeze([0, 0, 1]) })));
const nonzeroNoBodyError = captureError(() => new ExternalBoundaryRadiance({
    provider: Object.freeze({
        sample() {
            return Object.freeze({
                state: 'no-body',
                providerId: 'invalid-no-body-provider',
                celestialRadiance: spectralConstant(1),
                diagnostics: Object.freeze([]),
            });
        },
    }),
}).sample(createRequest({ direction: Object.freeze([0, 0, 1]) })));
const visibleBehindHitError = captureError(() => new ExternalBoundaryRadiance({
    provider: Object.freeze({
        sample() {
            return visibleProviderOutput({ celestialRadiance: spectralConstant(1) });
        },
    }),
}).sample(createRequest({
    direction: Object.freeze([0, 0, 1]),
    sceneIntersection: Object.freeze({ kind: 'hit', distanceMeters: 10 }),
})));

const compositionAudit = await auditCompositionPoints();

assert(descriptor.compositionPoint === 'post-transport-pre-display',
    'External boundary radiance must compose after transport and before display encoding.');
assert(descriptor.composition === 'pathRadiance + viewTransmittance * celestialRadiance',
    'External boundary radiance must name the Milestone 5 composition equation.');
assert(descriptor.incidentRadianceCachePolicy === 'excluded-from-incident-radiance-and-l2-cache',
    'External boundary radiance must remain outside incident-radiance/L2 caches.');
assert(descriptor.fallbackBackgroundPolicy === 'fallback-and-decorative-backgrounds-are-not-boundary-radiance',
    'Fallback backgrounds must remain outside physical boundary radiance.');
assert(fullVisible.state === 'visible' && fullVisible.apparentCoverage === 1
    && spectralEvery(fullVisible.celestialRadiance, 0.8),
    'The controlled full-coverage ray must return visible coverage-resolved radiance.');
assert(partialVisible.state === 'visible' && partialVisible.apparentCoverage === 0.25
    && spectralEvery(partialVisible.celestialRadiance, 0.2),
    'The controlled partial-coverage ray must return pixel-coverage-resolved radiance.');
assert(noBody.state === 'no-body' && noBody.bodyId === null && noBody.apparentCoverage === 0
    && spectralEvery(noBody.celestialRadiance, 0),
    'The miss ray must return explicit no-body state and canonical zero radiance.');
assert(occluded.state === 'occluded' && occluded.occlusionState === 'scene-occluded'
    && spectralEvery(occluded.celestialRadiance, 0),
    'An opaque scene hit must zero the boundary contribution and report occlusion.');
assert(fullVisible.diagnostics.length === 1 && diagnosticsDisabled.diagnostics.length === 0,
    'Selected-pixel diagnostics must be explicit and suppressible.');
assert(providerCalls.every((request) => !JSON.stringify(request).includes('incidentRadiance')
    && !JSON.stringify(request).includes('l2Cache')),
    'Provider input packets must contain no incident-radiance/L2 cache facts.');
assert(providerCalls.every(Object.isFrozen), 'Provider input packets must be frozen.');
assert(invalidRayError?.code === 'NON_UNIT_EXTERNAL_BOUNDARY_CAMERA_RAY',
    'Non-unit camera rays must fail loudly.');
assert(forbiddenCacheError?.code === 'FORBIDDEN_EXTERNAL_BOUNDARY_FIELD',
    'Cache fields must be rejected from boundary input.');
assert(invalidSpectrumError?.code === 'INVALID_EXTERNAL_BOUNDARY_SPECTRAL_RADIANCE',
    'Wrong-channel spectral radiance must fail loudly.');
assert(forbiddenBackgroundError?.code === 'FORBIDDEN_EXTERNAL_BOUNDARY_FIELD',
    'Fallback/background fields must be rejected from boundary output.');
assert(nonzeroNoBodyError?.code === 'INACTIVE_EXTERNAL_BOUNDARY_HAS_RADIANCE',
    'No-body output must reject hidden nonzero radiance.');
assert(visibleBehindHitError?.code === 'VISIBLE_EXTERNAL_BOUNDARY_BEHIND_SCENE_HIT',
    'Visible boundary output must not pass through an opaque scene hit.');
assert(Object.values(compositionAudit).every((entry) => entry.status === 'accepted'),
    'All POC composition-point audit rows must be accepted.');

const criteria = Object.freeze([
    criterion('named-external-boundary-role-and-question',
        descriptor.id === 'external-boundary-radiance-v1'
        && descriptor.roleQuestion.includes('beyond the atmosphere')),
    criterion('composition-point-is-post-transport-pre-display',
        descriptor.compositionPoint === 'post-transport-pre-display'
        && Object.values(compositionAudit).every((entry) => entry.status === 'accepted')),
    criterion('radiance-space-is-explicit-and-calibration-open',
        descriptor.radianceSpace.id === 'poc-canonical-15-channel-spectral-radiance-v1'
        && descriptor.radianceSpace.channelCount === 15
        && descriptor.radianceSpace.unitsStatus === 'physical-calibration-open'),
    criterion('full-visible-hit-shape-accepted',
        fullVisible.state === 'visible'
        && fullVisible.bodyId === 'full-bright-disk'
        && fullVisible.apparentCoverage === 1),
    criterion('partial-coverage-shape-and-radiance-accepted',
        partialVisible.apparentCoverage === 0.25
        && spectralEvery(partialVisible.celestialRadiance, 0.2)),
    criterion('no-body-is-explicit-zero-not-background',
        noBody.state === 'no-body'
        && spectralEvery(noBody.celestialRadiance, 0)
        && noBody.apparentFootprint.kind === 'none'),
    criterion('opaque-scene-hit-occludes-boundary-radiance',
        occluded.state === 'occluded'
        && occluded.occlusionState === 'scene-occluded'
        && spectralEvery(occluded.celestialRadiance, 0)),
    criterion('selected-pixel-diagnostics-flag-controls-output',
        fullVisible.diagnostics.length === 1 && diagnosticsDisabled.diagnostics.length === 0),
    criterion('boundary-input-is-independent-from-incident-radiance-cache',
        providerCalls.every((request) => !JSON.stringify(request).includes('incidentRadiance')
        && !JSON.stringify(request).includes('l2Cache'))),
    criterion('invalid-ray-and-spectrum-fail-loudly',
        invalidRayError?.code === 'NON_UNIT_EXTERNAL_BOUNDARY_CAMERA_RAY'
        && invalidSpectrumError?.code === 'INVALID_EXTERNAL_BOUNDARY_SPECTRAL_RADIANCE'),
    criterion('cache-and-background-fields-fail-loudly',
        forbiddenCacheError?.code === 'FORBIDDEN_EXTERNAL_BOUNDARY_FIELD'
        && forbiddenBackgroundError?.code === 'FORBIDDEN_EXTERNAL_BOUNDARY_FIELD'),
    criterion('inactive-and-occluded-state-invariants-fail-loudly',
        nonzeroNoBodyError?.code === 'INACTIVE_EXTERNAL_BOUNDARY_HAS_RADIANCE'
        && visibleBehindHitError?.code === 'VISIBLE_EXTERNAL_BOUNDARY_BEHIND_SCENE_HIT'),
]);
const status = criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';
const errors = Object.freeze({
    invalidRayError: summarizeError(invalidRayError),
    forbiddenCacheError: summarizeError(forbiddenCacheError),
    invalidSpectrumError: summarizeError(invalidSpectrumError),
    forbiddenBackgroundError: summarizeError(forbiddenBackgroundError),
    nonzeroNoBodyError: summarizeError(nonzeroNoBodyError),
    visibleBehindHitError: summarizeError(visibleBehindHitError),
});

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Complete Milestone 5 Phase 1 by naming and validating the POC-local
ExternalBoundaryRadiance role. The role must answer one camera-ray question,
use an explicit canonical spectral space, report visible/no-body/occluded
states, expose coverage and selected-pixel diagnostics, compose at the same
post-transport/pre-display boundary in each POC lane, and remain independent
from incident-radiance/L2 caches and fallback backgrounds.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '5.1-external-boundary-radiance-contract',
    runner: runnerName,
    descriptor: EXTERNAL_BOUNDARY_RADIANCE_CONTRACT,
    radianceSpace: EXTERNAL_BOUNDARY_RADIANCE_SPACE,
    controlledRays: Object.freeze([
        Object.freeze({ id: 'full-visible', direction: [0, 0, 1], sceneIntersection: 'no-hit' }),
        Object.freeze({ id: 'partial-visible', direction: normalizedDirection(0.1, 0, 1), sceneIntersection: 'no-hit' }),
        Object.freeze({ id: 'no-body', direction: normalizedDirection(-0.1, 0, 1), sceneIntersection: 'no-hit' }),
        Object.freeze({ id: 'occluded', direction: [0, 0, 1], sceneIntersection: 'hit@125m' }),
    ]),
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md',
        'agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-plan.md#phase-1-name-the-boundary',
        'agents/topics/apps/flat/reconciliation/experimental-guidelines.md',
        'scripts/flat/reconciliation/POC/src/evaluation/SpectralReferenceEvaluator.js',
        'scripts/flat/reconciliation/POC/src/soft-shader/CpuPostprocessSoftShader.js',
        'scripts/flat/reconciliation/POC/src/shader/Algorithm32ShaderAssembler.js',
        'scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderContributionFactory.js',
        'scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderContributionFactory.js',
        'scripts/flat/reconciliation/POC/browser-page/runner.js',
    ]),
    runtimeLinkPolicy: 'poc-local-only-no-flat32-or-production-runtime-links',
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    composition: descriptor.composition,
    coveragePolicy: descriptor.coveragePolicy,
    radianceSpace: descriptor.radianceSpace,
    noBodyRadiance: spectralConstant(0),
    occludedRadiance: spectralConstant(0),
});
await writeJson(recordDirectory, 'composition-points.json', compositionAudit);
await writeJson(recordDirectory, 'criteria-results.json', { status, criteria });
await writeJson(recordDirectory, 'diagnostics.json', {
    descriptor,
    samples: Object.freeze({ fullVisible, partialVisible, noBody, occluded, diagnosticsDisabled }),
    providerCalls: Object.freeze(providerCalls),
    errors,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([Object.freeze({
        command: `node scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    })]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    acceptedCriteriaCount: criteria.filter((entry) => entry.status === 'accepted').length,
    criteriaCount: criteria.length,
    compositionPoint: descriptor.compositionPoint,
});
await writeText(recordDirectory, 'report.md', `# Report

Milestone 5 Phase 1 external-boundary-radiance contract status: **${status}**.

- The named role answers what visible radiance arrives from beyond the
  atmosphere along one camera ray.
- The accepted composition point is post-transport and pre-display in the
  CPU/reference, CPU-postprocess, and assembled shader/browser lanes.
- The CPU/reference evaluator remains transport-only.
- The first proof uses the POC canonical 15-channel spectral basis. Physical
  radiance units/calibration remain explicitly open rather than being hidden
  behind a display-RGB shortcut.
- Visible, partial-coverage, no-body, and scene-occluded packets passed.
- No-body and occluded packets produce canonical zero celestial radiance.
- Cache, background, invalid-ray, wrong-spectrum, and invalid-occlusion cases
  fail loudly.
- The provider input contains no incident-radiance/L2 cache facts.
- No browser execution was required for the Phase 1 composition audit.
`);
await appendRunLog(recordDirectory, `${runnerName} ${status} criteria=${criteria.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    criteriaCount: criteria.length,
    compositionPoint: descriptor.compositionPoint,
    radianceSpaceId: descriptor.radianceSpace.id,
}));

async function auditCompositionPoints() {
    const sources = await Promise.all([
        readPocSource('../evaluation/SpectralReferenceEvaluator.js'),
        readPocSource('../soft-shader/CpuPostprocessSoftShader.js'),
        readPocSource('../shader/Algorithm32ShaderAssembler.js'),
        readPocSource('../shader/DistantSphericalShaderContributionFactory.js'),
        readPocSource('../shader/LocalFlatShaderContributionFactory.js'),
        readPocSource('../../browser-page/runner.js'),
    ]);
    const [evaluator, softShader, assembler, distantShader, localShader, browserRunner] = sources;
    const evaluateIndex = softShader.indexOf('this._configuration.evaluator.evaluate');
    const composeIndex = softShader.indexOf('composeFinalSpectralRadiance', evaluateIndex);
    const displayIndex = softShader.indexOf('radianceToDisplayRgb', composeIndex);
    const transportSlotIndex = assembler.indexOf("'evaluateTransport'");
    const composeSlotIndex = assembler.indexOf("'composeSceneColor'", transportSlotIndex);
    const encodeSlotIndex = assembler.indexOf("'encodeOutput'", composeSlotIndex);

    return Object.freeze({
        cpuReference: auditRow(
            evaluator.includes('const pathRadiance = calculator.computeRadiance')
            && evaluator.includes('pathRadiance,')
            && !evaluator.includes('radianceToDisplayRgb'),
            'SpectralReferenceEvaluator ends at pathRadiance/transmittance and remains transport-only.',
            'Sample boundary radiance outside evaluate(...) after transport returns.',
        ),
        cpuPostprocess: auditRow(
            evaluateIndex >= 0 && composeIndex > evaluateIndex && displayIndex > composeIndex,
            'CpuPostprocessSoftShader orders evaluate, spectral composition, then display conversion.',
            'Insert boundary sampling after evaluate(...) and before spectral composition/display conversion.',
        ),
        assembledShader: auditRow(
            transportSlotIndex >= 0 && composeSlotIndex > transportSlotIndex && encodeSlotIndex > composeSlotIndex
            && distantShader.includes('return skyLinearSrgb;')
            && localShader.includes('return skyLinearSrgb;'),
            'Assembler and both geometry lanes order transport, scene composition, then output encoding.',
            'Future GPU boundary sampling belongs after evaluateTransport and before composeSceneColor.',
        ),
        browserRunner: auditRow(
            browserRunner.includes('payload.fragmentShaderSource')
            && browserRunner.includes('compileShader(gl, gl.FRAGMENT_SHADER'),
            'Browser runner compiles the assembled fragment source supplied by the POC shader lane.',
            'No distinct browser composition point exists outside the assembled shader.',
        ),
    });
}

async function readPocSource(relativePath) {
    return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

function auditRow(accepted, evidence, insertionDecision) {
    return Object.freeze({
        status: accepted ? 'accepted' : 'rejected',
        evidence,
        insertionDecision,
    });
}

function createRequest(overrides) {
    return Object.freeze({
        cameraRay: Object.freeze({
            origin: Object.freeze([0, 2, 0]),
            direction: overrides.direction,
        }),
        atmosphereContext: Object.freeze({
            atmosphereId: 'canonical-atmosphere-proof',
            geometryId: 'controlled-camera-ray-geometry',
            boundary: Object.freeze({ kind: 'atmosphere-exit', distanceMeters: 100000 }),
        }),
        sceneIntersection: overrides.sceneIntersection ?? Object.freeze({ kind: 'no-hit' }),
        diagnosticsEnabled: overrides.diagnosticsEnabled ?? false,
    });
}

function visibleProviderOutput(overrides = {}) {
    return Object.freeze({
        state: 'visible',
        providerId: 'controlled-invalid-provider',
        bodyId: 'controlled-body',
        bodyKind: 'synthetic-body',
        celestialRadiance: overrides.celestialRadiance ?? spectralConstant(1),
        apparentCoverage: 1,
        apparentFootprint: Object.freeze({ kind: 'angular-disk', angularRadiusRadians: 0.01 }),
        occlusionState: 'unoccluded',
        diagnostics: Object.freeze([]),
    });
}

function spectralConstant(value) {
    return Object.freeze(Array(EXTERNAL_BOUNDARY_RADIANCE_SPACE.channelCount).fill(value));
}

function normalizedDirection(x, y, z) {
    const length = Math.hypot(x, y, z);
    return Object.freeze([x / length, y / length, z / length]);
}

function spectralEvery(value, expected) {
    return value.length === EXTERNAL_BOUNDARY_RADIANCE_SPACE.channelCount
        && value.every((entry) => Math.abs(entry - expected) < 1e-12);
}

function criterion(name, accepted) {
    return Object.freeze({ name, status: accepted ? 'accepted' : 'rejected' });
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
    return Object.freeze({
        name: error?.name ?? null,
        code: error?.code ?? null,
        message: error?.message ?? null,
        details: error?.details ?? null,
    });
}
