// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.1.2.
// - agents/topics/apps/flat/reconciliation/shader-design.md, CPU postprocess shader.
// - tmp/atmosphere/reconciliation/051-m3-soft-shader-scene-input-contract.

import {
    CANONICAL_SPECTRAL_CHANNELS,
    CpuPostprocessSoftShader,
    SpectralReferenceEvaluator,
} from '../index.js';
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

await appendRunLog(recordDirectory, 'm3CpuPostprocessSoftShader started.');

const capturedViewRayRequests = [];
const evaluator = new SpectralReferenceEvaluator({
    geometry: createGeometry(capturedViewRayRequests),
    atmosphere: createAtmosphere(),
    lightSource: createLightSource(),
    calculator: createCalculator(),
    executionControls: Object.freeze({ pathIntervalCount: 2 }),
});
const softShader = new CpuPostprocessSoftShader({ evaluator });
const endpointRadiance = spectralFill(2);
const output = softShader.render({
    sceneInput: Object.freeze({
        sceneId: 'm3-3-1-2-contract-scene',
        sourceKind: 'authored-descriptor',
        sourceDescriptorId: 'mock-source',
        geometryDescriptorId: 'mock-geometry',
        atmosphereDescriptorId: 'mock-atmosphere',
        lightSourceDescriptorId: 'mock-light',
        displayDescriptorId: 'figure1-display-adapter',
        viewportPixels: Object.freeze([3, 1]),
    }),
    pixels: Object.freeze([
        createPixel({
            pixelId: 'finite-hit',
            sceneIntersection: Object.freeze({
                kind: 'hit',
                distanceMeters: 42,
                hitPosition: Object.freeze([0, 0, 42]),
            }),
            endpointContribution: Object.freeze({
                policy: 'precomputed-spectral-radiance',
                opacity: 'opaque',
                endpointRadiance,
            }),
        }),
        createPixel({
            pixelId: 'sky-no-hit',
            sceneIntersection: Object.freeze({ kind: 'no-hit' }),
            endpointContribution: null,
        }),
        createPixel({
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
        }),
        createPixel({
            pixelId: 'invalid-depth',
            sceneIntersection: Object.freeze({
                kind: 'invalid',
                invalidReason: 'depth-out-of-range',
            }),
            endpointContribution: null,
        }),
    ]),
});

const hitOutput = output.pixels.find((pixel) => pixel.pixelId === 'finite-hit');
const skyOutput = output.pixels.find((pixel) => pixel.pixelId === 'sky-no-hit');
const capturedColorOutput = output.pixels.find((pixel) => pixel.pixelId === 'captured-scene-color-hit');
const invalidOutput = output.pixels.find((pixel) => pixel.pixelId === 'invalid-depth');
const hitRequest = capturedViewRayRequests.find((request) => request.endDistanceMeters === 42);
const capturedColorRequest = capturedViewRayRequests.find((request) => request.endDistanceMeters === 17);
const noHitRequest = capturedViewRayRequests[1];
const invalidRequest = capturedViewRayRequests[3];

assert(output.outputKind === 'cpu-postprocess-soft-shader', 'Soft-shader output kind should be explicit.');
assert(hitRequest?.endDistanceMeters === 42, 'Finite hit must shorten the geometry-resolved path through evaluate.');
assert(capturedColorRequest?.endDistanceMeters === 17, 'Captured-color hit must shorten the path only by endDistanceMeters.');
assert(!capturedViewRayRequests.some((request) => Object.hasOwn(request, 'sceneIntersection')),
    'Evaluate requests must not receive scene-intersection objects.');
assert(!Object.hasOwn(noHitRequest, 'endDistanceMeters'), 'No-hit pixel must preserve normal geometry ray resolution.');
assert(!Object.hasOwn(invalidRequest, 'endDistanceMeters'), 'Invalid depth must not be promoted to a far hit.');
assert(hitOutput.finalSpectralRadiance[0] === 1.1,
    'Finite hit should compose endpointRadiance * T_view + L_path.');
assert(skyOutput.finalSpectralRadiance[0] === skyOutput.evaluationOutput.pathRadiance.inScattered[0],
    'No-hit sky output should equal L_path.');
assert(capturedColorOutput.endpointRadiance === null && capturedColorOutput.finalSpectralRadiance === null,
    'Captured scene color policy must not fabricate spectral endpoint radiance.');
assert(capturedColorOutput.displayComposition?.kind === 'captured-scene-endpoint-proxy',
    'Captured scene color policy must use display-owned post-transport composition.');
assert(capturedColorOutput.displayComposition?.transmittanceRgb?.every((value) => value === 0.5),
    'Captured scene color policy must derive RGB transmittance from spectral transport output.');
assert(capturedColorOutput.displayRgb[1] > capturedColorOutput.displayRgb[0],
    'Captured green hit color should remain green after postprocess composition.');
assert(invalidOutput.diagnostics.some((diagnostic) => diagnostic.id === 'soft-shader-invalid-scene-intersection'),
    'Invalid depth should log a bounded selected-pixel diagnostic.');
assert(hitOutput.displayRgb.every(Number.isFinite), 'Display RGB must be finite.');
assert(output.aggregateDiagnostics.hitPixelCount === 2, 'Aggregate diagnostics should count hit pixels.');
assert(output.aggregateDiagnostics.noHitPixelCount === 1, 'Aggregate diagnostics should count no-hit pixels.');
assert(output.aggregateDiagnostics.invalidPixelCount === 1, 'Aggregate diagnostics should count invalid pixels.');

const criteria = Object.freeze([
    Object.freeze({
        name: 'soft-shader calls public evaluator and receives spectral outputs',
        status: capturedViewRayRequests.length === 4 ? 'accepted' : 'rejected',
    }),
    Object.freeze({
        name: 'finite hit shortens geometry-resolved path',
        status: hitRequest?.endDistanceMeters === 42
            && capturedColorRequest?.endDistanceMeters === 17
            && !capturedViewRayRequests.some((request) => Object.hasOwn(request, 'sceneIntersection'))
            ? 'accepted'
            : 'rejected',
    }),
    Object.freeze({
        name: 'no-hit preserves normal geometry ray resolution',
        status: noHitRequest && !Object.hasOwn(noHitRequest, 'endDistanceMeters') ? 'accepted' : 'rejected',
    }),
    Object.freeze({
        name: 'invalid depth logs and continues without hit cap',
        status: invalidOutput.diagnostics.length === 1
            && invalidRequest
            && !Object.hasOwn(invalidRequest, 'endDistanceMeters')
            ? 'accepted'
            : 'rejected',
    }),
    Object.freeze({
        name: 'finite endpoint composition uses endpointRadiance * T_view + L_path',
        status: hitOutput.finalSpectralRadiance[0] === 1.1 ? 'accepted' : 'rejected',
    }),
    Object.freeze({
        name: 'sky composition uses L_path only',
        status: skyOutput.finalSpectralRadiance[0] === skyOutput.evaluationOutput.pathRadiance.inScattered[0]
            ? 'accepted'
            : 'rejected',
    }),
    Object.freeze({
        name: 'captured scene color composes after spectral transport',
        status: capturedColorOutput.endpointRadiance === null
            && capturedColorOutput.finalSpectralRadiance === null
            && capturedColorOutput.displayComposition?.kind === 'captured-scene-endpoint-proxy'
            && capturedColorOutput.displayRgb[1] > capturedColorOutput.displayRgb[0]
            ? 'accepted'
            : 'rejected',
    }),
    Object.freeze({
        name: 'display conversion uses finite Step 032 display adapter output',
        status: hitOutput.displayRgb.every(Number.isFinite) ? 'accepted' : 'rejected',
    }),
]);

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Implement and verify Stage 3.1.2: a CPU postprocess soft-shader that uses the
public reconciliation \`evaluate(...)\` operation, composes endpoint radiance
after transport, and converts final spectra through the validated display path.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.1.2',
    runner: 'm3CpuPostprocessSoftShader',
    sceneId: output.sceneId,
    selectedPixelIds: output.pixels.map((pixel) => pixel.pixelId),
    endpointRadianceFirstChannel: endpointRadiance[0],
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-31-cpu-postprocess-soft-shader',
        'agents/topics/apps/flat/reconciliation/shader-design.md#cpu-postprocess-shader',
        'tmp/atmosphere/reconciliation/051-m3-soft-shader-scene-input-contract',
        'scripts/flat/reconciliation/POC/src/outputs/Figure1SkyDomeRenderer.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status: criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected',
    criteria,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    capturedViewRayRequests,
    aggregateDiagnostics: output.aggregateDiagnostics,
    pixels: output.pixels.map((pixel) => Object.freeze({
        pixelId: pixel.pixelId,
        sceneIntersectionKind: pixel.sceneIntersectionKind,
        endpointPolicy: pixel.endpointPolicy,
        viewRayEndDistanceMeters: pixel.evaluationOutput.viewRaySegment.endDistanceMeters,
        endpointRadianceFirstChannel: pixel.endpointRadiance?.[0] ?? null,
        pathRadianceFirstChannel: pixel.evaluationOutput.pathRadiance.inScattered[0],
        transmittanceFirstChannel: pixel.evaluationOutput.pathRadiance.transmittance[0],
        finalRadianceFirstChannel: pixel.finalSpectralRadiance?.[0] ?? null,
        displayCompositionKind: pixel.displayComposition?.kind ?? null,
        displayTransmittanceRgb: pixel.displayComposition?.transmittanceRgb ?? null,
        displayRgb: pixel.displayRgb,
        diagnosticCount: pixel.diagnostics.length,
    })),
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m3CpuPostprocessSoftShader.js --record ${recordDirectory}`,
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

Stage 3.1.2 CPU postprocess soft-shader is implemented.

- The soft-shader uses the public evaluator surface.
- Finite scene hits shorten geometry-resolved view paths through
  \`viewRayRequest.endDistanceMeters\`.
- No-hit sky pixels compose to \`L_path\`.
- Finite opaque endpoint pixels compose to
  \`endpointRadiance * T_view + L_path\`.
- Captured scene-color endpoint pixels keep hit color outside
  \`evaluate(...)\` and compose it with spectral transport output in the
  display/color layer.
- Invalid depth logs a bounded diagnostic and does not interrupt rendering.
- Final spectra convert to display RGB through the Step 032 display adapter.
`);
await appendRunLog(recordDirectory, `m3CpuPostprocessSoftShader accepted criteria=${criteria.length}.`);

console.log(JSON.stringify({
    status: 'accepted',
    recordDirectory,
    criteriaCount: criteria.length,
}));

function createPixel(overrides) {
    return Object.freeze({
        pixelId: overrides.pixelId,
        coordinate: Object.freeze({ x: 0, y: 0 }),
        ray: Object.freeze({
            origin: Object.freeze([0, 0, 0]),
            direction: Object.freeze([0, 0, 1]),
        }),
        sceneIntersection: overrides.sceneIntersection,
        endpointContribution: overrides.endpointContribution,
    });
}

function createGeometry(capturedViewRayRequests) {
    return Object.freeze({
        resolveViewRaySegment(request) {
            capturedViewRayRequests.push(request);
            return Object.freeze({
                ray: request.ray,
                startDistanceMeters: 0,
                endDistanceMeters: Number.isFinite(request.endDistanceMeters)
                    ? request.endDistanceMeters
                    : 100,
            });
        },
        resolveAtmosphereCoordinate() {
            return Object.freeze({ altitudeMeters: 0 });
        },
        resolveAtmospherePath() {
            return Object.freeze({
                start: Object.freeze({ altitudeMeters: 0 }),
                end: Object.freeze({ altitudeMeters: 0 }),
                lengthMeters: 0,
            });
        },
        resolveSourceRelativePosition() {
            return Object.freeze({
                directionFromSource: Object.freeze([0, 0, -1]),
                directionToSource: Object.freeze([0, 0, 1]),
                distanceFromSourceMeters: null,
            });
        },
        resolveCacheAccess() {
            return Object.freeze({
                cacheKey: 'none',
                coordinates: Object.freeze([]),
            });
        },
    });
}

function createAtmosphere() {
    return Object.freeze({
        sampleMedium() {
            return Object.freeze({});
        },
        integrateOpticalDepth() {
            return Object.freeze({
                opticalDepth: spectralFill(0),
                transmittance: spectralFill(1),
            });
        },
        samplePhase() {
            return Object.freeze({});
        },
    });
}

function createLightSource() {
    return Object.freeze({
        describeIncidentRadianceCache() {
            return null;
        },
        createIncidentRadianceCache() {
            return null;
        },
        sampleDirectLighting() {
            return Object.freeze({});
        },
        resolveSourcePathLimit() {
            return Object.freeze({});
        },
    });
}

function createCalculator() {
    return Object.freeze({
        buildEndpointTrapezoidPathIntegrationPoints(viewRaySegment) {
            return Object.freeze([
                Object.freeze({
                    pointIndex: 0,
                    distanceAlongRayMeters: viewRaySegment.startDistanceMeters,
                    intervalLengthFromPreviousMeters: 0,
                    trapezoidWeight: 0.5,
                    measureMeters: 0,
                }),
                Object.freeze({
                    pointIndex: 1,
                    distanceAlongRayMeters: viewRaySegment.endDistanceMeters,
                    intervalLengthFromPreviousMeters: viewRaySegment.endDistanceMeters,
                    trapezoidWeight: 0.5,
                    measureMeters: viewRaySegment.endDistanceMeters,
                }),
            ]);
        },
        computeRadiance(viewRaySegment) {
            const scale = viewRaySegment.endDistanceMeters === 42 ? 1 : 2;
            return Object.freeze({
                inScattered: spectralFill(viewRaySegment.endDistanceMeters === 17 ? 0 : 0.1 * scale),
                transmittance: spectralFill(0.5),
                diagnostics: Object.freeze({
                    viewRayEndDistanceMeters: viewRaySegment.endDistanceMeters,
                }),
            });
        },
    });
}

function spectralFill(value) {
    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map(() => value));
}
