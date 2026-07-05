// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 3.3.2.
// - agents/topics/apps/flat/reconciliation/shader-design.md, contribution contract and assembly rules.

import { readFile } from 'node:fs/promises';

import {
    Algorithm32ShaderAssembler,
    DistantSphericalShaderContributionFactory,
    DistantSphericalShaderDescriptorBuilder,
} from '../index.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const failures = [];

await appendRunLog(recordDirectory, 'm3ShaderAssemblyProbe started.');

let descriptor = null;
let contributions = [];
let assembly = null;
let repeatedAssembly = null;
let assemblerSource = '';

try {
    descriptor = new DistantSphericalShaderDescriptorBuilder().build();
    const factory = new DistantSphericalShaderContributionFactory();
    contributions = factory.createContributions(descriptor);
    const assembler = new Algorithm32ShaderAssembler();
    assembly = assembler.assemble({
        descriptor,
        contributions,
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });
    repeatedAssembly = assembler.assemble({
        descriptor,
        contributions: factory.createContributions(descriptor),
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });
    assemblerSource = await readFile('scripts/flat/reconciliation/POC/src/shader/Algorithm32ShaderAssembler.js', 'utf8');
} catch (error) {
    failures.push(failure('shader-assembly-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion(
        'assembly-created',
        assembly?.status === 'accepted' && typeof assembly.fragmentShaderSource === 'string',
    ),
    criterion(
        'symbol-validation-accepted-without-missing-or-duplicates',
        assembly?.validationReport?.status === 'accepted'
        && assembly.validationReport.missingRequiredSymbols.length === 0
        && assembly.validationReport.duplicateProvidedSymbols.length === 0,
    ),
    criterion(
        'source-build-deterministic',
        assembly?.sourceHash === repeatedAssembly?.sourceHash,
    ),
    criterion(
        'source-has-three-fragment-rgba-output',
        assembly?.fragmentShaderSource?.includes('out vec4 outColor;') === true
        && assembly.fragmentShaderSource.includes('void main()') === true
        && assembly.fragmentShaderSource.includes('outColor = state.outputRgba;') === true,
    ),
    criterion(
        'cache-owns-texture-and-lookup-access',
        contributions.some((contribution) =>
            contribution.owner === 'cache'
            && contribution.textures.some((texture) => texture.valueKey === 'cache.incidentRadianceTexture')
            && contribution.functions.some((block) => block.code.includes('texelFetch(sourceTexture'))),
    ),
    criterion(
        'scene-endpoint-signal-uses-explicit-hit-texture',
        assembly?.fragmentShaderSource?.includes('uniform sampler2D uSceneHitTexture;') === true
        && assembly.fragmentShaderSource.includes('texture(uSceneHitTexture, uv)') === true
        && assembly.fragmentShaderSource.includes('resolveAtmospherePath(ViewRay ray, float sceneTerminationMeters, bool hasSceneEndpoint)') === true
        && !assembly.fragmentShaderSource.includes('depthQuantizationToleranceMeters')
        && !assembly.fragmentShaderSource.includes('sceneDepthSample.r > 0.98'),
    ),
    criterion(
        'runtime-depth-policy-names-explicit-hit-mask',
        descriptor?.runtime?.facts?.depthPolicy === 'explicit-hit-mask-plus-opaque-hit-distance',
    ),
    criterion(
        'cache-lookup-uses-cache-owned-packed-texture-and-all-directions',
        assembly?.fragmentShaderSource?.includes('GEOMETRY_CACHE_BOUNDARY_ALTITUDE_METERS') === true
        && assembly.fragmentShaderSource.includes('resolveCacheAltitudeBinIndex(vec3 positionMeters)') === true
        && assembly.fragmentShaderSource.includes('length(positionMeters) - GEOMETRY_BOTTOM_RADIUS_METERS') === true
        && assembly.fragmentShaderSource.includes('SpectralValue incidentRadiance = lookupIncidentRadiance(positionMeters, directionIndex);') === true
        && assembly.fragmentShaderSource.includes('for (int directionIndex = 0; directionIndex < CACHE_INCIDENT_DIRECTION_COUNT; directionIndex += 1)') === true
        && !assembly.fragmentShaderSource.includes('state.incidentRadiance * medium.scattering'),
    ),
    criterion(
        'transport-uses-spectral-state-and-endpoint-trapezoid-view-rule',
        assembly?.fragmentShaderSource?.includes('struct SpectralValue') === true
        && assembly.fragmentShaderSource.includes('for (int pointIndex = 0; pointIndex <= TRANSPORT_PATH_INTERVAL_COUNT; pointIndex += 1)') === true
        && assembly.fragmentShaderSource.includes('computeTrapezoidSegmentTransmittance(previousMedium, medium, stepMeters)') === true
        && !assembly.fragmentShaderSource.includes('(float(sampleIndex) + 0.5) * stepMeters'),
    ),
    criterion(
        'captured-scene-rgb-stays-display-composition-only',
        assembly?.fragmentShaderSource?.includes('displayRgbToLinearSrgb(state.sceneDisplayRgb)') === true
        && assembly.fragmentShaderSource.includes('spectralRadianceToLinearSrgb(state.pathRadiance)') === true
        && !assembly.fragmentShaderSource.includes('uGroundRadianceRgb')
        && !assembly.fragmentShaderSource.includes('uDistantSunRadianceRgb'),
    ),
    criterion(
        'assembler-does-not-name-concrete-distant-or-spherical-variant',
        !/\bdistant\b|\bspherical\b/i.test(assemblerSource),
    ),
]);
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Assembly criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Verify the assembled distant/spherical shader contract through the generic
Algorithm32 assembler. The concrete variant is expressed only through owner
contributions, scene endpoints are signaled through an explicit hit-mask
texture instead of depth-byte values or tolerances, and incident-radiance cache
access is derived from transport sample positions.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.3.2',
    runner: 'm3ShaderAssemblyProbe',
    contributionIds: contributions.map((contribution) => contribution.id),
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-33-shader-contract-and-source-assembly',
        'agents/topics/apps/flat/reconciliation/shader-design.md#contribution-contract-and-composition-rules',
        'agents/topics/apps/flat/reconciliation/shader-design.md#cache-texture-lifecycle',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    descriptorFingerprint: descriptor?.fingerprint ?? null,
    contributionIds: contributions.map((contribution) => contribution.id),
    providedSymbols: assembly?.validationReport?.providedSymbols ?? [],
    requiredSymbols: assembly?.validationReport?.requiredSymbols ?? [],
    unusedProvidedSymbols: assembly?.validationReport?.unusedProvidedSymbols ?? [],
    warnings: assembly?.validationReport?.warnings ?? [],
    bindingRequirements: assembly?.bindingRequirements ?? [],
    sourceHash: assembly?.sourceHash ?? null,
});
await writeText(recordDirectory, 'fragment-shader.glsl', assembly?.fragmentShaderSource ?? '');
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m3ShaderAssemblyProbe.js --record ${recordDirectory}`,
            timestamp: nowIso(),
        }),
    ]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    descriptorFingerprint: descriptor?.fingerprint ?? null,
    sourceHash: assembly?.sourceHash ?? null,
    failureCount: failures.length,
});
await writeText(recordDirectory, 'report.md', `# Report

Subgoal 3.3.2 shader assembly probe finished with status: ${status}.

- Source hash: ${assembly?.sourceHash ?? 'not-created'}.
- Fragment source was saved to \`fragment-shader.glsl\`.
- Symbol warnings are allowed; missing or duplicate required symbols reject the
  assembly.
- Criteria failures, if any, are listed in \`criteria-results.json\`.
`);
await appendRunLog(recordDirectory, `m3ShaderAssemblyProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    sourceHash: assembly?.sourceHash ?? null,
    failureCount: failures.length,
    warnings: assembly?.validationReport?.warnings ?? [],
}));

function criterion(name, accepted) {
    return Object.freeze({
        name,
        status: accepted ? 'accepted' : 'rejected',
    });
}

function failure(id, message, details = null) {
    return Object.freeze({ id, message, details });
}
