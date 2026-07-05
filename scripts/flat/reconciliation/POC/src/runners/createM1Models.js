// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 concrete distant/spherical setup.
// - tmp/atmosphere/reconciliation/005-shared-baseline-constants.

import {
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    CANONICAL_SPECTRAL_CHANNELS,
    DISTANT_SUN_CONSTANTS,
    FIGURE1_RENDER_CONSTANTS,
    STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    CanonicalAtmosphere,
    DistantSunLightSource,
    SpectralCalculator,
    SpectralReferenceEvaluator,
    SphericalEarthGeometry,
} from '../index.js';
import { sphericalDirectionFromAltitudeAzimuth } from '../math/vector.js';

export function createM1DistantSphericalModels(scene, controls = STEP032_ARTIFACT_NUMERICAL_CONTROLS) {
    const directionToLight = sphericalDirectionFromAltitudeAzimuth(
        scene.sunAltitudeDegrees,
        scene.sunAzimuthDegrees,
    );
    const geometry = new SphericalEarthGeometry({
        bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
        topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
        observerHeightMeters: FIGURE1_RENDER_CONSTANTS.observerHeightMeters,
        sourceDirection: directionToLight,
        cacheAltitudeBinCount: controls.incidentAltitudeBinCount,
        sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
    });
    const atmosphere = new CanonicalAtmosphere({
        constants: CANONICAL_ATMOSPHERE_CONSTANTS,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    });
    const lightSource = new DistantSunLightSource({
        directionToLight,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
        angularRadiusRadians: DISTANT_SUN_CONSTANTS.angularRadiusRadians,
        cacheAltitudeBinCount: controls.incidentAltitudeBinCount,
        cacheDirectionCount: controls.incidentDirectionCount,
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
