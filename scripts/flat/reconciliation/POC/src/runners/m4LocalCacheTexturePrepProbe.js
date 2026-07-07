// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 4.1 local cache texture prep.
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, shader cache texture building.

import {
    CANONICAL_SPECTRAL_BASIS,
    M2_LOCAL_FLAT_SEED_CONSTANTS,
    TextureBuilder,
    buildIncidentRadianceCache,
} from '../index.js';
import { stableHash } from '../shader/stableHash.js';
import { createM2LocalFlatModels, makeM2SeedSummary } from './createM2Models.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
const scene = seed.currentReviewScenes[0];
const failures = [];

await appendRunLog(recordDirectory, 'm4LocalCacheTexturePrepProbe started.');

let diagnostics = null;
let textureBuildResult = null;

try {
    const models = createM2LocalFlatModels(scene);
    const cache = models.lightSource.createIncidentRadianceCache({
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
    });
    const buildResult = buildIncidentRadianceCache({
        cache,
        geometry: models.geometry,
        atmosphere: models.atmosphere,
        lightSource: models.lightSource,
        calculator: models.calculator,
        pathIntervalCount: seed.numericalControls.pathIntervalCount,
        sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
    });
    const shaderPayload = buildResult.cache.createShaderPayload();
    const repeatedShaderPayload = buildResult.cache.createShaderPayload();
    const texture = shaderPayload.texture;
    const textureBuilder = new TextureBuilder();

    textureBuildResult = textureBuilder.createTexture({
        textureId: texture.textureId,
        owner: 'cache',
        dimensionality: texture.dimensionality,
        dimensions: Object.freeze([texture.width, texture.height, texture.depth]),
        formatPreference: Object.freeze(['float32', 'half-float']),
        samplerPolicy: texture.samplerPolicy,
        valueKey: 'cache.localIncidentRadianceTexture',
        accessFunctionName: 'readLocalIncidentRadianceTexture',
    });

    const expectedCoordinateCount =
        seed.localCacheZBinsMeters.length
        * seed.localCacheRhoBinsMeters.length
        * seed.localCacheDirectionCount;
    const expectedSpectralGroupCount = Math.ceil(
        CANONICAL_SPECTRAL_BASIS.wavelengthsNanometers.length / texture.spectralGroupSize,
    );
    const expectedUploadValueCount =
        expectedCoordinateCount
        * expectedSpectralGroupCount
        * texture.spectralGroupSize;
    const geometryAccessProbe = probeGeometryResolvedCacheAccess(models, buildResult.incidentRadianceSampling);

    diagnostics = Object.freeze({
        scene: Object.freeze({
            sceneSetId: seed.currentReviewSceneSetId,
            sceneId: scene.id,
            offsetDegrees: scene.offsetDegrees,
        }),
        cache: Object.freeze({
            descriptor: buildResult.cache.descriptor,
            descriptorFingerprint: stableHash(buildResult.cache.descriptor),
            coordinateCount: buildResult.coordinateCount,
            valueCount: buildResult.cache.valueCount,
            expectedCoordinateCount,
            runtimeDiagnosticCount: buildResult.cache.runtimeDiagnostics.length,
        }),
        shaderPayload: Object.freeze({
            payloadKind: shaderPayload.payloadKind,
            payloadFingerprint: stableHash(shaderPayload),
            repeatedPayloadFingerprint: stableHash(repeatedShaderPayload),
            dimensions: shaderPayload.dimensions,
            format: shaderPayload.format,
            texture: Object.freeze({
                kind: texture.kind,
                textureId: texture.textureId,
                width: texture.width,
                height: texture.height,
                depth: texture.depth,
                dimensionality: texture.dimensionality,
                format: texture.format,
                samplerPolicy: texture.samplerPolicy,
                coordinateOrder: texture.coordinateOrder,
                spectralGroupSize: texture.spectralGroupSize,
                spectralGroupCount: texture.spectralGroupCount,
                spectralChannelCount: texture.spectralChannelCount,
                rgbaFloat32Length: texture.rgbaFloat32.length,
            }),
            lookup: shaderPayload.lookup,
            metadata: shaderPayload.metadata,
            expectedSpectralGroupCount,
            expectedUploadValueCount,
        }),
        textureBuilder: textureBuildResult,
        geometryAccessProbe,
        m4Handoff: Object.freeze({
            readyForTextureUpload: true,
            remainingM4_2Work: Object.freeze([
                'create local/flat shader descriptor and owner contributions',
                'bind the local incident-radiance texture in the browser/GPU path',
                'implement local GLSL lookup that unpacks z/rho/direction/spectral-group layout',
                'validate local/flat selected-pixel CPU/GPU parity',
            ]),
        }),
    });
} catch (error) {
    failures.push(failure('m4-local-cache-texture-prep-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion(
        'local-cache-builds-all-coordinates',
        diagnostics?.cache.coordinateCount === diagnostics?.cache.expectedCoordinateCount
        && diagnostics?.cache.valueCount === diagnostics?.cache.expectedCoordinateCount,
    ),
    criterion(
        'local-cache-descriptor-is-local',
        diagnostics?.cache.descriptor?.cacheKind === 'local'
        && diagnostics?.cache.descriptor?.dimensions?.join(',') === 'z,rho,incomingDirection,wavelength',
    ),
    criterion(
        'shader-payload-is-deterministic',
        diagnostics?.shaderPayload.payloadFingerprint === diagnostics?.shaderPayload.repeatedPayloadFingerprint,
    ),
    criterion(
        'shader-payload-has-uploadable-rgba32f-texture',
        diagnostics?.shaderPayload.texture?.kind === 'rgba32f-3d-texture-v1'
        && diagnostics?.shaderPayload.texture?.format === 'rgba32f'
        && diagnostics?.shaderPayload.texture?.rgbaFloat32Length
            === diagnostics?.shaderPayload.expectedUploadValueCount,
    ),
    criterion(
        'shader-payload-records-local-lookup-mapping',
        diagnostics?.shaderPayload.lookup?.policy === 'z-rho-bin-all-directions'
        && diagnostics?.shaderPayload.lookup?.depthPacking === 'z-bin-major-spectral-group-minor'
        && Array.isArray(diagnostics?.shaderPayload.lookup?.zBinsMeters)
        && Array.isArray(diagnostics?.shaderPayload.lookup?.rhoBinsMeters),
    ),
    criterion(
        'texture-builder-can-materialize-cache-request',
        diagnostics?.textureBuilder?.owner === 'cache'
        && diagnostics?.textureBuilder?.valueKey === 'cache.localIncidentRadianceTexture'
        && diagnostics?.textureBuilder?.dimensionality === '3d',
    ),
    criterion(
        'runtime-cache-access-is-geometry-resolved',
        diagnostics?.geometryAccessProbe?.resolveCacheAccessCallCount > 0
        && diagnostics?.geometryAccessProbe?.samplerCallCount > 0
        && diagnostics?.geometryAccessProbe?.allSamplerCallsUsedGeometryPackets === true,
    ),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Local cache texture-prep criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Prove the current local/flat L2 incident-radiance cache is ready for M4 GPU
texture work without starting local GLSL lookup yet.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '4.1-local-cache-texture-prep',
    runner: 'm4LocalCacheTexturePrepProbe',
    sceneSetId: seed.currentReviewSceneSetId,
    sceneId: scene.id,
    seed: makeM2SeedSummary(),
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-41-local-cache-texture-prep',
        'agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md#shader-cache-texture-building',
        'scripts/flat/reconciliation/POC/src/incident-radiance/LocalSunIncidentRadianceCache.js',
        'scripts/flat/reconciliation/POC/src/shader/TextureBuilder.js',
        'scripts/flat/reconciliation/POC/src/geometry/FlatEarthGeometry.js',
    ]),
});
await writeJson(recordDirectory, 'diagnostics.json', diagnostics);
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m4LocalCacheTexturePrepProbe.js --record ${recordDirectory}`,
            timestamp: nowIso(),
        }),
    ]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    stage: '4.1-local-cache-texture-prep',
    recordDirectory,
    sceneId: scene.id,
    cacheCoordinateCount: diagnostics?.cache.coordinateCount ?? null,
    cacheValueCount: diagnostics?.cache.valueCount ?? null,
    textureId: diagnostics?.shaderPayload.texture?.textureId ?? null,
    textureDimensions: diagnostics?.textureBuilder?.dimensions ?? null,
    uploadValueCount: diagnostics?.shaderPayload.texture?.rgbaFloat32Length ?? null,
    failureCount: failures.length,
    remainingM4_2Work: diagnostics?.m4Handoff.remainingM4_2Work ?? null,
});
await writeText(recordDirectory, 'report.md', `# Report

M4 local cache texture-prep probe finished with status: ${status}.

- Scene seed: \`${scene.id}\`.
- Cache coordinates/values: \`${diagnostics?.cache.coordinateCount ?? 'n/a'} / ${diagnostics?.cache.valueCount ?? 'n/a'}\`.
- Texture payload: \`${diagnostics?.shaderPayload.texture?.textureId ?? 'n/a'}\`,
  dimensions \`${diagnostics?.textureBuilder?.dimensions?.join(' x ') ?? 'n/a'}\`,
  upload floats \`${diagnostics?.shaderPayload.texture?.rgbaFloat32Length ?? 'n/a'}\`.
- Geometry-resolved cache access calls:
  \`${diagnostics?.geometryAccessProbe?.resolveCacheAccessCallCount ?? 'n/a'}\`.

Remaining work belongs to M4.2: build the local/flat shader descriptor,
bind/upload this texture in the browser/GPU path, implement local GLSL lookup
for the packed z/rho/direction/spectral-group layout, and run CPU/GPU parity.
`);
await appendRunLog(recordDirectory, `m4LocalCacheTexturePrepProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    cacheCoordinateCount: diagnostics?.cache.coordinateCount ?? null,
    cacheValueCount: diagnostics?.cache.valueCount ?? null,
    textureId: diagnostics?.shaderPayload.texture?.textureId ?? null,
    uploadValueCount: diagnostics?.shaderPayload.texture?.rgbaFloat32Length ?? null,
    failureCount: failures.length,
}));

function probeGeometryResolvedCacheAccess(models, incidentRadianceSampling) {
    const originalResolveCacheAccess = models.geometry.resolveCacheAccess.bind(models.geometry);
    const resolveCacheAccessPackets = [];
    let samplerCallCount = 0;

    models.geometry.resolveCacheAccess = (request) => {
        const packet = originalResolveCacheAccess(request);
        resolveCacheAccessPackets.push(packet);
        return packet;
    };

    const wrappedSampling = Object.freeze({
        cacheDescriptor: incidentRadianceSampling.cacheDescriptor,
        incidentRadianceSampler: (cacheAccess) => {
            samplerCallCount += 1;
            return incidentRadianceSampling.incidentRadianceSampler(cacheAccess);
        },
    });

    const output = models.evaluator.evaluate({
        viewDirection: [0, 0, 1],
        maxDistanceMeters: 5000,
        pathIntervalCount: 2,
        incidentRadianceSampling: wrappedSampling,
    });

    return Object.freeze({
        resolveCacheAccessCallCount: resolveCacheAccessPackets.length,
        samplerCallCount,
        allSamplerCallsUsedGeometryPackets: resolveCacheAccessPackets.every((packet) =>
            packet?.metadata?.coordinateSystem === 'local-source-z-rho'
            && typeof packet.cacheKey === 'string'
            && packet.cacheKey.startsWith('z:')
            && Array.isArray(packet.coordinates)
            && packet.coordinates.length === 2),
        firstPacket: resolveCacheAccessPackets[0] ?? null,
        lastPacket: resolveCacheAccessPackets[resolveCacheAccessPackets.length - 1] ?? null,
        selectedOutputMeanIncidentAwareRadiance: mean(output.pathRadiance.inScattered),
        viewRayEndDistanceMeters: output.viewRaySegment.endDistanceMeters,
    });
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

function mean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
