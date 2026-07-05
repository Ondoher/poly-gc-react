// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 distant L2 cache build/bind/sample.
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, source-created cache and generic build coordinator.
// - tmp/atmosphere/reconciliation/010-cli-experiment-run-record-rule.

import {
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    FIGURE1_SCENES,
    STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    SpectralReferenceEvaluator,
    buildIncidentRadianceCache,
} from '../index.js';
import { createM1DistantSphericalModels } from './createM1Models.js';
import {
    assert,
    finiteSpectral,
    nonnegativeSpectral,
    nowIso,
    parseRecordDirectory,
    spectralMean,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const scene = FIGURE1_SCENES[1];
const models = createM1DistantSphericalModels(scene);
const cache = models.lightSource.createIncidentRadianceCache({
    bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
    topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
    spectralBasis: CANONICAL_SPECTRAL_BASIS,
});
const buildResult = buildIncidentRadianceCache({
    cache,
    geometry: models.geometry,
    atmosphere: models.atmosphere,
    lightSource: models.lightSource,
    calculator: models.calculator,
    pathIntervalCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.pathIntervalCount,
    sourceTransmittanceIntervalCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
});
const expectedCoordinateCount =
    STEP032_ARTIFACT_NUMERICAL_CONTROLS.incidentAltitudeBinCount
    * STEP032_ARTIFACT_NUMERICAL_CONTROLS.incidentDirectionCount;
const boundaryAltitudeMeters = cache.descriptor.metadata.boundaryAltitudeMeters;
const firstAltitudeCoordinate = [...cache.coordinates()].find((coordinate) =>
    coordinate.altitudeBinIndex === 0 && coordinate.directionIndex === 0);
const boundaryCacheAccess = models.geometry.resolveCacheAccess({
    position: Object.freeze([0, 0, CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters]),
});
const boundarySamples = buildResult.incidentRadianceSampling.incidentRadianceSampler(boundaryCacheAccess);

assert(buildResult.coordinateCount === expectedCoordinateCount,
    'Distant cache should build altitudeBinCount * directionCount coordinates.');
assert(cache.valueCount === expectedCoordinateCount,
    'Distant cache storage should contain one value per coordinate.');
assert(buildResult.incidentRadianceSampling.cacheDescriptor.cacheKind === 'distant',
    'Built sampler should carry the distant cache descriptor.');
assert(firstAltitudeCoordinate?.altitudeMeters === boundaryAltitudeMeters,
    'Distant cache first altitude bin should be an explicit near-boundary in-atmosphere sample.');
assert(boundaryCacheAccess.metadata.effectiveAltitudeMeters === boundaryAltitudeMeters,
    'Runtime cache access at the ground boundary should clamp to the cache boundary altitude.');
assert(boundarySamples.length === STEP032_ARTIFACT_NUMERICAL_CONTROLS.incidentDirectionCount,
    'Boundary cache access should return every incident direction sample.');
assert(boundarySamples.every((sample) => finiteSpectral(sample.radiance) && nonnegativeSpectral(sample.radiance)),
    'Boundary cache samples must be finite and nonnegative.');

const evaluatorWithCache = new SpectralReferenceEvaluator({
    geometry: models.geometry,
    atmosphere: models.atmosphere,
    lightSource: models.lightSource,
    calculator: models.calculator,
    spectralBasis: CANONICAL_SPECTRAL_BASIS,
    executionControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    incidentRadianceSampling: buildResult.incidentRadianceSampling,
});
const noCacheOutput = models.evaluator.evaluate({
    viewRayRequest: Object.freeze({ direction: Object.freeze([0, 0, 1]) }),
});
const cacheOutput = evaluatorWithCache.evaluate({
    viewRayRequest: Object.freeze({ direction: Object.freeze([0, 0, 1]) }),
});
const incidentDelta = cacheOutput.pathRadiance.inScattered.map((value, index) =>
    value - noCacheOutput.pathRadiance.inScattered[index]);

assert(finiteSpectral(cacheOutput.pathRadiance.inScattered), 'Cached run in-scattered radiance must be finite.');
assert(nonnegativeSpectral(cacheOutput.pathRadiance.inScattered), 'Cached run in-scattered radiance must be nonnegative.');
assert(incidentDelta.some((value) => value > 0), 'Distant L2 cache should add positive incident radiance for the selected zenith ray.');

const shaderPayload = cache.createShaderPayload();

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Build, bind, and sample the distant incident-radiance cache through the generic
cache builder and abstract evaluator, stopping before image artifact generation.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'M1 distant L2 cache build/bind/sample run',
    sceneId: scene.id,
    numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md',
        'agents/topics/apps/flat/algorithm32/conclusions.md',
        'tmp/atmosphere/reconciliation/009-m1-granular-record-strategy',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'accepted',
    cacheDescriptor: cache.descriptor,
    shaderPayload,
    numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        {
            name: 'coordinate count',
            status: 'accepted',
            result: `${buildResult.coordinateCount} coordinates built.`,
        },
        {
            name: 'operation-ready sampler',
            status: 'accepted',
            result: 'Build returned IncidentRadianceSampling.',
        },
        {
            name: 'boundary cache source sample',
            status: 'accepted',
            result: `Altitude bin 0 samples at ${firstAltitudeCoordinate.altitudeMeters} m and boundary access clamps to ${boundaryCacheAccess.metadata.effectiveAltitudeMeters} m.`,
        },
        {
            name: 'positive L2 contribution',
            status: 'accepted',
            result: `Mean incident delta ${spectralMean(incidentDelta)}.`,
        },
        {
            name: 'no image artifacts generated',
            status: 'accepted',
        },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', {
    build: {
        coordinateCount: buildResult.coordinateCount,
        expectedCoordinateCount,
        cacheValueCount: cache.valueCount,
        shaderPayload,
        boundary: {
            boundaryAltitudeMeters,
            firstAltitudeCoordinate,
            boundaryCacheAccess,
            boundarySampleCount: boundarySamples.length,
            boundaryMeanRadiance: spectralMean(boundarySamples.flatMap((sample) => sample.radiance)),
        },
    },
    selectedRay: {
        sceneId: scene.id,
        noCacheMeanInScattered: spectralMean(noCacheOutput.pathRadiance.inScattered),
        cacheMeanInScattered: spectralMean(cacheOutput.pathRadiance.inScattered),
        meanIncidentDelta: spectralMean(incidentDelta),
        maxIncidentDelta: Math.max(...incidentDelta),
    },
});
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m1DistantL2Cache.js --record ${recordDirectory}`,
            purpose: 'Build, bind, and sample the distant incident-radiance cache without generating image artifacts.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'Distant L2 cache builds through the generic coordinator, binds to an IncidentRadianceSampling value, and contributes positive incident radiance in CPU evaluation.',
    runtimeCodeChanged: true,
    coordinateCount: buildResult.coordinateCount,
    meanIncidentDelta: spectralMean(incidentDelta),
    nextStep: 'Stop before Subgoal 1.5 artifact generation.',
});
await writeText(recordDirectory, 'report.md', `# Report

The distant L2 incident-radiance cache built ${buildResult.coordinateCount}
coordinates, returned an operation-ready sampler, and added positive incident
radiance for the selected zenith ray. No image artifacts were generated.
`);
await writeText(recordDirectory, 'run.log', `${nowIso()} m1DistantL2Cache accepted ${buildResult.coordinateCount} cache coordinates.\n`);

console.log(JSON.stringify({
    status: 'accepted',
    coordinateCount: buildResult.coordinateCount,
    meanIncidentDelta: spectralMean(incidentDelta),
}));
