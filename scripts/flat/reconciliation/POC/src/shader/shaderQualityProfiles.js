// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, ideal GPU shader and setup/config lifecycle.
// - scripts/flat/reconciliation/POC/src/constants/consts.js, current Algorithm32 runtime controls.

import {
    ALGORITHM32_BASELINE_CONSTANTS,
    RUNTIME_NUMERICAL_CONTROLS,
    STEP032_ARTIFACT_NUMERICAL_CONTROLS,
} from '../constants/consts.js';

const QUALITY_PROFILES = Object.freeze([
    freezeProfile({
        id: 'ideal',
        label: 'Ideal GPU Algorithm32',
        role: 'reference',
        numericalControls: RUNTIME_NUMERICAL_CONTROLS,
        notes: 'Current full distant/spherical GPU shader. Keep as the quality reference before creating optimized implementations.',
    }),
    freezeProfile({
        id: 'balanced',
        label: 'Balanced GPU Algorithm32',
        role: 'candidate',
        numericalControls: {
            pathIntervalCount: 28,
            sourceTransmittanceIntervalCount: 14,
            incidentDirectionCount: 24,
            incidentAltitudeBinCount: 36,
        },
        notes: 'First reduced-cost candidate; trims all dominant loops while keeping more than half of ideal path and incident samples.',
    }),
    freezeProfile({
        id: 'adaptive-balanced',
        label: 'Adaptive Balanced GPU Algorithm32',
        role: 'candidate',
        numericalControls: {
            pathIntervalCount: 28,
            sourceTransmittanceIntervalCount: 14,
            incidentDirectionCount: 24,
            incidentAltitudeBinCount: 36,
        },
        transportOptimization: Object.freeze({
            pathSampleDistribution: Object.freeze({
                kind: 'tangent-density-adaptive-v1',
            }),
        }),
        notes: 'Balanced loop counts with non-uniform view-path samples: tangent-clustered for horizon rays and camera-biased otherwise.',
    }),
    freezeProfile({
        id: 'adaptive-balanced-soft',
        label: 'Soft Adaptive Balanced GPU Algorithm32',
        role: 'candidate',
        numericalControls: {
            pathIntervalCount: 28,
            sourceTransmittanceIntervalCount: 14,
            incidentDirectionCount: 24,
            incidentAltitudeBinCount: 36,
        },
        transportOptimization: Object.freeze({
            pathSampleDistribution: Object.freeze({
                kind: 'tangent-density-adaptive-soft-v1',
            }),
        }),
        notes: 'Balanced loop counts with a partial blend toward tangent/density-biased view-path samples.',
    }),
    freezeProfile({
        id: 'balanced-cache-interp',
        label: 'Balanced GPU Algorithm32 With Cache Interpolation',
        role: 'candidate',
        numericalControls: {
            pathIntervalCount: 28,
            sourceTransmittanceIntervalCount: 14,
            incidentDirectionCount: 24,
            incidentAltitudeBinCount: 36,
        },
        cacheOptimization: Object.freeze({
            altitudeLookup: Object.freeze({
                kind: 'linear-altitude-v1',
            }),
        }),
        notes: 'Balanced loop counts with linear interpolation between incident-radiance cache altitude bins.',
    }),
    freezeProfile({
        id: 'fast-cache-interp',
        label: 'Fast GPU Algorithm32 With Cache Interpolation',
        role: 'candidate',
        numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
        cacheOptimization: Object.freeze({
            altitudeLookup: Object.freeze({
                kind: 'linear-altitude-v1',
            }),
        }),
        notes: 'Fast loop counts with linear interpolation between incident-radiance cache altitude bins.',
    }),
    freezeProfile({
        id: 'fast',
        label: 'Fast GPU Algorithm32',
        role: 'candidate',
        numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
        notes: 'Reuses the lower Step032 artifact controls as an aggressive but historically exercised candidate.',
    }),
    freezeProfile({
        id: 'draft',
        label: 'Draft GPU Algorithm32',
        role: 'candidate',
        numericalControls: {
            pathIntervalCount: 12,
            sourceTransmittanceIntervalCount: 6,
            incidentDirectionCount: 9,
            incidentAltitudeBinCount: 16,
        },
        notes: 'Very low-cost diagnostic candidate; useful for finding the visible failure threshold, not expected to be final.',
    }),
]);

export const SHADER_QUALITY_PROFILES = QUALITY_PROFILES;

/**
 * @param {string} profileId - Requested quality profile id.
 * @returns {ShaderQualityProfile} Matching profile.
 */
export function shaderQualityProfileById(profileId) {
    const profile = QUALITY_PROFILES.find((entry) => entry.id === profileId);

    if (!profile) {
        throw new Error(`Unknown shader quality profile: ${profileId}`);
    }

    return profile;
}

/**
 * @param {ShaderQualityProfile} profile - Active quality profile.
 * @returns {Algorithm32BaselineConstants} Baseline constants with profile controls.
 */
export function algorithm32ConstantsForShaderQualityProfile(profile) {
    return Object.freeze({
        ...ALGORITHM32_BASELINE_CONSTANTS,
        runtimeNumericalControls: profile.numericalControls,
    });
}

/**
 * @param {Algorithm32NumericalControls} controls - Numerical controls.
 * @returns {ShaderQualityWorkEstimate} Approximate per-pixel loop work.
 */
export function estimateShaderQualityWork(controls) {
    const pathPointCount = controls.pathIntervalCount + 1;
    const sourceTransmittancePointCount = controls.sourceTransmittanceIntervalCount + 1;
    const spectralChannelCount = ALGORITHM32_BASELINE_CONSTANTS.spectralChannels.length;
    const incidentSpectralSteps = pathPointCount
        * controls.incidentDirectionCount
        * spectralChannelCount;
    const sourceTransmittanceSpectralSteps = pathPointCount
        * sourceTransmittancePointCount
        * spectralChannelCount;
    const totalDominantSpectralSteps = incidentSpectralSteps + sourceTransmittanceSpectralSteps;

    return Object.freeze({
        pathPointCount,
        sourceTransmittancePointCount,
        spectralChannelCount,
        incidentDirectionCount: controls.incidentDirectionCount,
        incidentAltitudeBinCount: controls.incidentAltitudeBinCount,
        incidentSpectralSteps,
        sourceTransmittanceSpectralSteps,
        totalDominantSpectralSteps,
    });
}

function freezeProfile(profile) {
    const numericalControls = Object.freeze({ ...profile.numericalControls });
    const workEstimate = estimateShaderQualityWork(numericalControls);
    const idealWork = estimateShaderQualityWork(RUNTIME_NUMERICAL_CONTROLS);

    return Object.freeze({
        ...profile,
        numericalControls,
        workEstimate,
        estimatedWorkRatioToIdeal: workEstimate.totalDominantSpectralSteps
            / idealWork.totalDominantSpectralSteps,
        transportOptimization: profile.transportOptimization ?? null,
        cacheOptimization: profile.cacheOptimization ?? null,
    });
}
