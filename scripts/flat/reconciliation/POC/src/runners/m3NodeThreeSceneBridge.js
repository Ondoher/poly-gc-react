// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.1.3.
// - agents/topics/apps/flat/reconciliation/shader-design.md, ThreeGateway and CPU postprocess shader.
// - tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference.

import {
    CANONICAL_SPECTRAL_CHANNELS,
    CpuPostprocessSoftShader,
    ThreeSceneSoftShaderBridge,
    createShaderLabReferenceScene,
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

await appendRunLog(recordDirectory, 'm3NodeThreeSceneBridge started.');

const controlledScene = createShaderLabReferenceScene();
const bridge = new ThreeSceneSoftShaderBridge({
    sceneId: controlledScene.sceneId,
    camera: controlledScene.camera,
    meshes: controlledScene.meshes,
    viewportPixels: controlledScene.viewportPixels,
    defaultPathIntervalCount: 4,
});

const capture = bridge.captureSceneInput({
    selectedPixels: controlledScene.selectedPixels,
    sourceDescriptorId: 'node-three-reference-fixture-source',
    geometryDescriptorId: 'node-three-reference-fixture-geometry',
    atmosphereDescriptorId: 'node-three-reference-fixture-atmosphere',
    lightSourceDescriptorId: 'node-three-reference-fixture-light-source',
    displayDescriptorId: 'bruneton-color-display',
    metadata: controlledScene.metadata,
});

const evaluatorCalls = [];
const evaluator = Object.freeze({
    /**
     * @param {SpectralEvaluationRequest} request - Public evaluation request.
     * @returns {SpectralEvaluationOutput} Deterministic spectral output.
     */
    evaluate(request) {
        evaluatorCalls.push(request);
        const viewRayRequest = request.viewRayRequest;
        const endDistanceMeters = viewRayRequest?.endDistanceMeters ?? 1000;
        const hit = Number.isFinite(viewRayRequest?.endDistanceMeters);
        const transmittance = spectralConstant(hit ? 0.75 : 1);
        const inScattered = spectralConstant(hit ? 0.0001 : 0.0004);

        return Object.freeze({
            outputKind: 'spectral',
            viewRaySegment: Object.freeze({
                ray: viewRayRequest.ray,
                startDistanceMeters: 0,
                endDistanceMeters,
            }),
            pathIntegrationPoints: Object.freeze([]),
            pathRadiance: Object.freeze({
                inScattered,
                transmittance,
            }),
            diagnostics: Object.freeze([]),
        });
    },
});

const softShader = new CpuPostprocessSoftShader({
    evaluator,
    endpointRadianceResolver(endpointContribution) {
        return endpointContribution.spectralReferenceId === 'fixture-ground-matte'
            ? spectralConstant(0.0015)
            : spectralConstant(0.0025);
    },
});
const softShaderOutput = softShader.render({
    sceneInput: capture.sceneInput,
    pixels: capture.pixels,
});

const upperSky = capture.pixels.find((pixel) => pixel.pixelId === 'upper-sky-control');
const centerCard = capture.pixels.find((pixel) => pixel.pixelId === 'center-card-hit');
const lowerGround = capture.pixels.find((pixel) => pixel.pixelId === 'lower-ground-hit');

assert(upperSky?.sceneIntersection?.kind === 'no-hit',
    'Upper selected pixel must be classified as sky/no-hit.');
assert(centerCard?.sceneIntersection?.kind === 'hit',
    'Center selected pixel must hit the fixture card.');
assert(lowerGround?.sceneIntersection?.kind === 'hit',
    'Lower selected pixel must hit the fixture ground plane.');
assert(Number.isFinite(centerCard.sceneIntersection.distanceMeters) && centerCard.sceneIntersection.distanceMeters > 0,
    'Card hit distance must be finite and positive.');
assert(Number.isFinite(lowerGround.sceneIntersection.distanceMeters) && lowerGround.sceneIntersection.distanceMeters > 0,
    'Ground hit distance must be finite and positive.');
assert(!Object.hasOwn(upperSky.sceneIntersection, 'distanceMeters')
        || upperSky.sceneIntersection.distanceMeters == null,
    'Sky/no-hit selected pixel must not receive a supplied finite distance.');
assert(capture.pixels.every((pixel) => isUnitVector(pixel.ray.direction)),
    'All bridge output rays must be normalized.');
assert(evaluatorCalls.length === capture.pixels.length,
    'Soft-shader must call public evaluate once per captured selected pixel.');
assert(evaluatorCalls.every((call) => !JSON.stringify(call).includes('fixture-neutral-medium')),
    'Endpoint spectral fixture ids must not enter evaluate requests.');
assert(evaluatorCalls.every((call) => !JSON.stringify(call).includes('fixture-ground-matte')),
    'Ground endpoint spectral fixture ids must not enter evaluate requests.');
assert(softShaderOutput.pixels.every((pixel) => pixel.displayRgba.every(Number.isFinite)),
    'CPU soft-shader bridge output must contain finite display RGBA values.');

const criteria = Object.freeze([
    criterion('node-three-captures-hit-and-sky-selected-pixels',
        capture.summary.hitPixelCount === 2 && capture.summary.noHitPixelCount === 1),
    criterion('hit-distances-are-finite-positive',
        [centerCard, lowerGround].every((pixel) =>
            Number.isFinite(pixel.sceneIntersection.distanceMeters)
            && pixel.sceneIntersection.distanceMeters > 0)),
    criterion('sky-pixel-does-not-invent-hit-cap',
        upperSky.sceneIntersection.kind === 'no-hit'
        && (upperSky.sceneIntersection.distanceMeters == null)),
    criterion('bridge-rays-are-normalized',
        capture.pixels.every((pixel) => isUnitVector(pixel.ray.direction))),
    criterion('soft-shader-uses-public-evaluate-per-pixel',
        evaluatorCalls.length === capture.pixels.length),
    criterion('endpoint-fixture-ids-stay-out-of-evaluate',
        evaluatorCalls.every((call) =>
            !JSON.stringify(call).includes('fixture-neutral-medium')
            && !JSON.stringify(call).includes('fixture-ground-matte'))),
    criterion('soft-shader-output-finite',
        softShaderOutput.pixels.every((pixel) => pixel.displayRgba.every(Number.isFinite))),
]);
const status = criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Implement and verify the Stage 3.1.3 Node-only Three scene bridge. The bridge
must use Three camera rays and Raycaster hits to produce soft-shader scene
pixel inputs without requiring a browser or WebGL render target.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.1.3',
    runner: 'm3NodeThreeSceneBridge',
    sceneId: controlledScene.sceneId,
    viewportPixels: controlledScene.viewportPixels,
    selectedPixels: controlledScene.selectedPixels,
    sceneMetadata: controlledScene.metadata,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-31-cpu-postprocess-soft-shader',
        'agents/topics/apps/flat/reconciliation/shader-design.md#threegateway-scene-synchronization',
        'agents/topics/apps/flat/reconciliation/shader-test-design.md#scene-construction-rules',
        'tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference',
        'scripts/flat/algorithm32-shader-lab/node-three-reference.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    captureSummary: capture.summary,
    capturedPixels: capture.pixels,
    evaluatorCallCount: evaluatorCalls.length,
    evaluatorRequests: evaluatorCalls,
    softShaderAggregateDiagnostics: softShaderOutput.aggregateDiagnostics,
    softShaderPixels: softShaderOutput.pixels,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m3NodeThreeSceneBridge.js --record ${recordDirectory}`,
            timestamp: nowIso(),
        }),
    ]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    acceptedCriteriaCount: criteria.filter((entry) => entry.status === 'accepted').length,
    criteriaCount: criteria.length,
    captureSummary: capture.summary,
});
await writeText(recordDirectory, 'report.md', `# Report

Stage 3.1.3 Node-only Three scene bridge is implemented.

- Three \`PerspectiveCamera\` plus \`Raycaster\` produced selected-pixel rays.
- The controlled scene produced one sky/no-hit pixel, one card hit, and one
  ground hit.
- Hit distances are finite and positive.
- The sky pixel does not receive a supplied hit distance.
- The CPU soft-shader consumed the captured pixels through public
  \`evaluate(...)\` calls.
- Endpoint spectral fixture ids stayed outside \`evaluate(...)\`.
- Browser/WebGL render targets were not required for this bridge probe.
`);
await appendRunLog(recordDirectory, `m3NodeThreeSceneBridge ${status} criteria=${criteria.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    criteriaCount: criteria.length,
    captureSummary: capture.summary,
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

/**
 * @param {number} value - Spectral constant.
 * @returns {SpectralValue} Constant spectral vector.
 */
function spectralConstant(value) {
    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map(() => value));
}

/**
 * @param {unknown} vector - Candidate vector.
 * @returns {boolean} Whether vector is unit length within a small tolerance.
 */
function isUnitVector(vector) {
    return Array.isArray(vector)
        && vector.length === 3
        && vector.every(Number.isFinite)
        && Math.abs(Math.hypot(vector[0], vector[1], vector[2]) - 1) < 1e-12;
}
