// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.4.
// - agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md, ext-003, ext-011, ext-012, ext-014, ext-015, ext-016, ext-017.
// - tmp/atmosphere/reconciliation/023-m2-path-integration-convergence-plan.
// - tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate.

import {
    M2_LOCAL_FLAT_SEED_CONSTANTS,
    buildIncidentRadianceCache,
} from '../index.js';
import { addScaled, scale } from '../math/vector.js';
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
const scene = seed.scenes[0];
const referenceControls = Object.freeze({
    ...seed.numericalControls,
    pathIntervalCount: 96,
    sourceTransmittanceIntervalCount: 48,
});
const convergenceDiagnostics = runPathConvergence(scene, referenceControls);
const capDiagnostics = runCapSweep(scene);
const handoffDiagnostics = runCoordinateHandoff(scene);
const cacheDiagnostics = runLocalCacheOracle(scene);

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Run the M2 pre-asset local/flat experiments before any local/flat PNG asset
claim: path convergence, no-hit cap sensitivity, coordinate handoff/runtime
boundary diagnostics, and local cache direct/oracle checks.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'M2 Subgoal 2.4 pre-asset local/flat experiments',
    seed: makeM2SeedSummary(),
    selectedSceneId: scene.id,
    referenceControls,
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'agents/topics/apps/flat/reconciliation/action-plan.md',
        'agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md',
        'tmp/atmosphere/reconciliation/020-m2-cutoff-tolerance-justification',
        'tmp/atmosphere/reconciliation/021-m2-poc-runtime-boundary-diagnostics',
        'tmp/atmosphere/reconciliation/022-m2-general-runtime-boundary-policy',
        'tmp/atmosphere/reconciliation/023-m2-path-integration-convergence-plan',
        'tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'diagnostic-gate-ran',
    seed: makeM2SeedSummary(),
    pathConvergence: {
        candidatePathIntervalCounts: [12, 24, 48],
        referencePathIntervalCount: referenceControls.pathIntervalCount,
        referenceSourceTransmittanceIntervalCount: referenceControls.sourceTransmittanceIntervalCount,
        spacingRule: 'endpoint-trapezoid-uniform',
    },
    noHitCapSweepMeters: capDiagnostics.capsMeters,
    cacheDescriptor: cacheDiagnostics.cacheDescriptor,
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        {
            name: 'path integration convergence diagnostics produced',
            status: 'accepted',
            result: `${convergenceDiagnostics.rows.length} candidate/reference comparisons recorded.`,
        },
        {
            name: 'no-hit cap sensitivity diagnostics produced',
            status: 'accepted',
            result: `${capDiagnostics.rows.length} cap comparisons recorded.`,
        },
        {
            name: 'coordinate handoff diagnostics produced',
            status: 'accepted',
            result: 'Atmosphere, source-relative, source-path, and cache-access packets were emitted.',
        },
        {
            name: 'runtime-boundary diagnostics degrade safely',
            status: handoffDiagnostics.runtimeBoundaryDiagnosticCount > 0 ? 'accepted' : 'rejected',
            result: `${handoffDiagnostics.runtimeBoundaryDiagnosticCount} bounded diagnostics recorded.`,
        },
        {
            name: 'local cache direct/oracle edge check',
            status: cacheDiagnostics.maxAbsOracleDelta <= 1e-15 ? 'accepted' : 'unresolved',
            result: `maxAbsOracleDelta=${cacheDiagnostics.maxAbsOracleDelta}`,
        },
        {
            name: 'final local/flat numerical controls promoted',
            status: 'unresolved',
            result: 'This diagnostic run records deltas; closeout must decide whether to promote or adjust controls.',
        },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', {
    pathConvergence: convergenceDiagnostics,
    noHitCap: capDiagnostics,
    coordinateHandoff: handoffDiagnostics,
    localCache: cacheDiagnostics,
});
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m2PreAssetExperiments.js --record ${recordDirectory}`,
            purpose: 'Run the M2 pre-asset diagnostic gate before local/flat image generation.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'The M2 pre-asset gate ran and recorded convergence, cap, coordinate-handoff, runtime-boundary, and local cache oracle diagnostics before image asset generation.',
    runtimeCodeChanged: true,
    promotedNumericalControls: false,
    nextStep: 'Generate local/flat diagnostic PNG assets without treating Step 018 as exact canon.',
});
await writeText(recordDirectory, 'report.md', `# Report

The M2 pre-asset experiment gate ran for scene \`${scene.id}\`. It produced
path convergence rows, no-hit cap sensitivity rows, coordinate handoff
diagnostics, bounded runtime-boundary diagnostics, and a local cache
direct/oracle check. The run does not promote final local/flat numerical
controls; it records the diagnostics needed for later closeout.
`);
await writeText(recordDirectory, 'run.log', `${nowIso()} m2PreAssetExperiments accepted pathRows=${convergenceDiagnostics.rows.length} capRows=${capDiagnostics.rows.length} cacheCoordinates=${cacheDiagnostics.coordinateCount}.\n`);

console.log(JSON.stringify({
    status: 'accepted',
    pathRows: convergenceDiagnostics.rows.length,
    capRows: capDiagnostics.rows.length,
    cacheCoordinateCount: cacheDiagnostics.coordinateCount,
    maxAbsOracleDelta: cacheDiagnostics.maxAbsOracleDelta,
}));

function runPathConvergence(selectedScene, controls) {
    const candidates = [12, 24, 48];
    const hardDirections = buildHardDirections(selectedScene);
    const rows = [];

    for (const direction of hardDirections) {
        const reference = evaluateMean(selectedScene, direction.direction, controls);

        for (const pathIntervalCount of candidates) {
            const candidateControls = Object.freeze({
                ...seed.numericalControls,
                pathIntervalCount,
                sourceTransmittanceIntervalCount: Math.max(6, Math.floor(pathIntervalCount / 2)),
            });
            const candidate = evaluateMean(selectedScene, direction.direction, candidateControls);
            const radianceDelta = Math.abs(candidate.meanInScattered - reference.meanInScattered);
            const transmittanceDelta = Math.abs(candidate.meanTransmittance - reference.meanTransmittance);

            assert(Number.isFinite(radianceDelta), 'Path convergence radiance delta must be finite.');
            assert(Number.isFinite(transmittanceDelta), 'Path convergence transmittance delta must be finite.');

            rows.push(Object.freeze({
                rayId: direction.id,
                pathIntervalCount,
                sourceTransmittanceIntervalCount: candidateControls.sourceTransmittanceIntervalCount,
                candidate,
                reference,
                meanInScatteredAbsDelta: radianceDelta,
                meanTransmittanceAbsDelta: transmittanceDelta,
            }));
        }
    }

    return Object.freeze({
        selectedSceneId: selectedScene.id,
        referenceControls: controls,
        rows: Object.freeze(rows),
    });
}

function runCapSweep(selectedScene) {
    const capsMeters = Object.freeze([250000, 500000, 1000000, seed.sceneSkyRayLimitMeters, 3000000]);
    const direction = Object.freeze([1, 0, 0]);
    const reference = evaluateMean(selectedScene, direction, referenceControls, capsMeters[capsMeters.length - 1]);
    const rows = capsMeters.map((capMeters) => {
        const candidate = evaluateMean(selectedScene, direction, referenceControls, capMeters);

        return Object.freeze({
            capMeters,
            candidate,
            reference,
            meanInScatteredAbsDelta: Math.abs(candidate.meanInScattered - reference.meanInScattered),
            meanTransmittanceAbsDelta: Math.abs(candidate.meanTransmittance - reference.meanTransmittance),
        });
    });

    return Object.freeze({
        selectedSceneId: selectedScene.id,
        rayId: 'horizon-east',
        capsMeters,
        rows: Object.freeze(rows),
        selectedSeedCapMeters: seed.sceneSkyRayLimitMeters,
        promotedCutoffTolerance: null,
    });
}

function runCoordinateHandoff(selectedScene) {
    const models = createM2LocalFlatModels(selectedScene, referenceControls);
    const viewRay = models.geometry.resolveViewRaySegment({
        direction: buildHardDirections(selectedScene)[1].direction,
        maxDistanceMeters: 50000,
    });
    const samplePosition = addScaled(viewRay.ray.origin, viewRay.ray.direction, viewRay.endDistanceMeters * 0.5);
    const atmosphereCoordinate = models.geometry.resolveAtmosphereCoordinate(samplePosition);
    const sourceRelativePosition = models.geometry.resolveSourceRelativePosition({
        position: samplePosition,
        atmosphereCoordinate,
        viewDirection: viewRay.ray.direction,
    });
    const directLighting = models.lightSource.sampleDirectLighting({
        sourceRelativePosition,
        atmosphereCoordinate,
    });
    const sourcePath = models.geometry.resolveAtmospherePath({
        startPosition: samplePosition,
        direction: directLighting.directionToLight,
        sourcePathLimit: models.lightSource.resolveSourcePathLimit({
            sourceRelativePosition,
            directLighting,
        }),
        sampleCount: referenceControls.sourceTransmittanceIntervalCount,
    });
    const cacheAccess = models.geometry.resolveCacheAccess({
        position: samplePosition,
        atmosphereCoordinate,
        sourceRelativePosition,
    });
    const diagnosticCountBeforeBoundaryProbe = models.geometry.runtimeDiagnostics.length;

    models.geometry.resolveCacheAccess({
        position: Object.freeze([20000000, 20000000, seed.topAltitudeMeters * 2]),
        atmosphereCoordinate: Object.freeze({ altitudeMeters: seed.topAltitudeMeters * 2 }),
    });

    const runtimeBoundaryDiagnosticCount =
        models.geometry.runtimeDiagnostics.length - diagnosticCountBeforeBoundaryProbe;

    assert(cacheAccess.coordinates.length === 2,
        'Coordinate handoff must produce local z/rho cache access.');

    return Object.freeze({
        selectedSceneId: selectedScene.id,
        samplePosition,
        atmosphereCoordinate,
        sourceRelativePosition,
        directLightingMetadata: directLighting.metadata,
        sourcePathMetadata: sourcePath.metadata,
        cacheAccess,
        runtimeBoundaryDiagnosticCount,
        geometryRuntimeDiagnostics: models.geometry.runtimeDiagnostics,
    });
}

function runLocalCacheOracle(selectedScene) {
    const models = createM2LocalFlatModels(selectedScene, Object.freeze({
        ...seed.numericalControls,
        pathIntervalCount: 12,
        sourceTransmittanceIntervalCount: 6,
    }));
    const cache = models.lightSource.createIncidentRadianceCache({
        spectralBasis: models.spectralBasis,
    });
    const buildResult = buildIncidentRadianceCache({
        cache,
        geometry: models.geometry,
        atmosphere: models.atmosphere,
        lightSource: models.lightSource,
        calculator: models.calculator,
        pathIntervalCount: 12,
        sourceTransmittanceIntervalCount: 6,
    });
    const expectedCoordinateCount =
        seed.localCacheZBinsMeters.length
        * seed.localCacheRhoBinsMeters.length
        * seed.localCacheDirectionCount;
    const selectedCoordinate = [...cache.coordinates()].find((coordinate) =>
        coordinate.zBinIndex === 2
        && coordinate.rhoBinIndex === 1
        && coordinate.directionIndex === Math.floor(seed.localCacheDirectionCount / 2));
    const sampler = buildResult.incidentRadianceSampling.incidentRadianceSampler;
    const samples = sampler(Object.freeze({
        cacheKey: `z:${selectedCoordinate.zBinIndex}/rho:${selectedCoordinate.rhoBinIndex}`,
        coordinates: Object.freeze([selectedCoordinate.zBinIndex, selectedCoordinate.rhoBinIndex]),
    }));
    const sampled = samples[selectedCoordinate.directionIndex];
    const oracleRay = models.geometry.resolveCacheBuildRay(selectedCoordinate);
    const oracleRadiance = oracleRay == null
        ? models.spectralBasis.wavelengthsNanometers.map(() => 0)
        : models.calculator.computeRadiance(
            oracleRay,
            models.calculator.buildEndpointTrapezoidPathIntegrationPoints(oracleRay, 12),
        ).inScattered;
    const deltas = sampled.radiance.map((value, index) => Math.abs(value - oracleRadiance[index]));
    const maxAbsOracleDelta = Math.max(...deltas);

    assert(buildResult.coordinateCount === expectedCoordinateCount,
        'Local cache must build zBinCount * rhoBinCount * directionCount coordinates.');
    assert(cache.valueCount === expectedCoordinateCount,
        'Local cache storage must contain one value per coordinate.');
    assert(samples.length === seed.localCacheDirectionCount,
        'Local cache sampler must return one sample per configured direction.');
    assert(finiteSpectral(sampled.radiance), 'Sampled local cache radiance must be finite.');

    return Object.freeze({
        cacheDescriptor: cache.descriptor,
        shaderPayload: cache.createShaderPayload(),
        coordinateCount: buildResult.coordinateCount,
        expectedCoordinateCount,
        selectedCoordinate,
        sampleCount: samples.length,
        maxAbsOracleDelta,
        meanAbsOracleDelta: spectralMean(deltas),
        cacheRuntimeDiagnostics: cache.runtimeDiagnostics,
        geometryRuntimeDiagnostics: models.geometry.runtimeDiagnostics,
    });
}

function evaluateMean(selectedScene, direction, controls, maxDistanceMeters = null) {
    const models = createM2LocalFlatModels(selectedScene, controls);
    const output = models.evaluator.evaluate({
        viewRayRequest: Object.freeze({
            direction,
            ...(Number.isFinite(maxDistanceMeters) ? { maxDistanceMeters } : {}),
        }),
    });

    assert(finiteSpectral(output.pathRadiance.inScattered),
        'Pre-asset evaluated in-scattered radiance must be finite.');
    assert(finiteSpectral(output.pathRadiance.transmittance),
        'Pre-asset evaluated transmittance must be finite.');

    return Object.freeze({
        rayEndDistanceMeters: output.viewRaySegment.endDistanceMeters,
        pathPointCount: output.pathIntegrationPoints.length,
        meanInScattered: spectralMean(output.pathRadiance.inScattered),
        meanTransmittance: spectralMean(output.pathRadiance.transmittance),
    });
}

function buildHardDirections(selectedScene) {
    const models = createM2LocalFlatModels(selectedScene, seed.numericalControls);
    const towardSource = models.geometry.resolveSourceRelativePosition({
        position: seed.observerPositionMeters,
    }).directionToSource;

    return Object.freeze([
        Object.freeze({ id: 'zenith', direction: Object.freeze([0, 0, 1]) }),
        Object.freeze({ id: 'near-horizon-east', direction: Object.freeze([1, 0, 0]) }),
        Object.freeze({ id: 'toward-local-source', direction: towardSource }),
        Object.freeze({ id: 'away-from-local-source', direction: scale(towardSource, -1) }),
    ]);
}
