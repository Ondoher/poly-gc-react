// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoals 2.1 through 2.5.
// - agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md, seed configuration and calibration reproof tracker.
// - tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate.

import {
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    CANONICAL_SPECTRAL_CHANNELS,
    M2_LOCAL_FLAT_SEED_CONSTANTS,
    CanonicalAtmosphere,
    FlatEarthGeometry,
    LocalSunLightSource,
    SpectralCalculator,
    SpectralReferenceEvaluator,
} from '../index.js';

export function createM2LocalFlatModels(scene, controls = M2_LOCAL_FLAT_SEED_CONSTANTS.numericalControls) {
    const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
    const referenceSpectralIncidentScale =
        scene.referenceSpectralIncidentScale ?? seed.referenceSpectralIncidentScale;
    const geometry = new FlatEarthGeometry({
        observerPositionMeters: seed.observerPositionMeters,
        sourcePositionMeters: scene.sourcePositionMeters,
        topAltitudeMeters: seed.topAltitudeMeters,
        sceneSkyRayLimitMeters: seed.sceneSkyRayLimitMeters,
        observerCenteredDome: seed.observerCenteredDome,
        sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
        cacheZBinsMeters: seed.localCacheZBinsMeters,
        cacheRhoBinsMeters: seed.localCacheRhoBinsMeters,
    });
    const atmosphere = new CanonicalAtmosphere({
        constants: CANONICAL_ATMOSPHERE_CONSTANTS,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    });
    const lightSource = new LocalSunLightSource({
        sourceKey: scene.id,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
        referenceDistanceMeters: seed.referenceDistanceMeters,
        referenceSpectralIncidentScale,
        radiusMeters: seed.sourceRadiusMeters,
        distanceFalloff: seed.distanceFalloff,
        cacheZBinsMeters: seed.localCacheZBinsMeters,
        cacheRhoBinsMeters: seed.localCacheRhoBinsMeters,
        cacheDirectionCount: seed.localCacheDirectionCount,
    });
    const calculator = new SpectralCalculator({
        geometry,
        atmosphere,
        lightSource,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: controls,
    });
    const evaluator = new SpectralReferenceEvaluator({
        geometry,
        atmosphere,
        lightSource,
        calculator,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: controls,
    });

    return Object.freeze({
        geometry,
        atmosphere,
        lightSource,
        calculator,
        evaluator,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: controls,
    });
}

export function makeM2SeedSummary() {
    const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;

    return Object.freeze({
        profileKind: seed.profileKind,
        observerPositionMeters: seed.observerPositionMeters,
        topAltitudeMeters: seed.topAltitudeMeters,
        sceneSkyRayLimitMeters: seed.sceneSkyRayLimitMeters,
        observerCenteredDome: seed.observerCenteredDome,
        sourceRadiusMeters: seed.sourceRadiusMeters,
        referenceDistanceMeters: seed.referenceDistanceMeters,
        referenceSpectralIncidentScale: seed.referenceSpectralIncidentScale,
        distanceFalloff: seed.distanceFalloff,
        falseSunLatitudeModel: seed.falseSunLatitudeModel,
        summerSolsticeSimulationTime: seed.summerSolsticeSimulationTime,
        winterSolstice2025SimulationTime: seed.winterSolstice2025SimulationTime,
        currentReviewSceneSetId: seed.currentReviewSceneSetId,
        currentReviewSceneCount: seed.currentReviewScenes?.length ?? null,
        latitudeSweepObserverLatitudesDegrees: seed.latitudeSweepObserverLatitudesDegrees,
        summerSolsticeLatitudeSweepBrightnessCalibration:
            seed.summerSolsticeLatitudeSweepBrightnessCalibration,
        winterSolstice2025DegreeBrightnessCalibration:
            seed.winterSolstice2025DegreeBrightnessCalibration,
        localCacheZBinsMeters: seed.localCacheZBinsMeters,
        localCacheRhoBinsMeters: seed.localCacheRhoBinsMeters,
        localCacheDirectionCount: seed.localCacheDirectionCount,
        numericalControls: seed.numericalControls,
        guideArtifactRoot: seed.guideArtifactRoot,
        sceneSets: Object.freeze(Object.fromEntries(
            Object.entries(seed.sceneSets).map(([sceneSetId, sceneSet]) => [
                sceneSetId,
                Object.freeze({
                    id: sceneSet.id,
                    label: sceneSet.label,
                    guideComparisonAvailable: sceneSet.guideComparisonAvailable,
                    guideArtifactRoot: sceneSet.guideArtifactRoot,
                    exactParityTarget: sceneSet.exactParityTarget,
                    sourceBrightnessCalibration: sceneSet.sourceBrightnessCalibration ?? null,
                    sceneCount: sceneSet.scenes.length,
                }),
            ]),
        )),
        seedClassification: 'non-final M2 implementation seed; closeout must classify or replace before promotion',
    });
}
