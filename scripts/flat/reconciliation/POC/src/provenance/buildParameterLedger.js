// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 parameter/provenance extraction.
// - agents/topics/apps/flat/algorithm32/conclusions.md, canonical constants and source classes.
// - tmp/atmosphere/reconciliation/010-cli-experiment-run-record-rule.

import {
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_CHANNELS,
    DISTANT_SUN_CONSTANTS,
    FIGURE1_DISPLAY_CONSTANTS,
    FIGURE1_RENDER_CONSTANTS,
    RUNTIME_NUMERICAL_CONTROLS,
    STEP032_ARTIFACT_NUMERICAL_CONTROLS,
    VALIDATION_NUMERICAL_CONTROLS,
} from '../constants/consts.js';

/**
 * @returns {readonly ParameterLedgerEntry[]} Current M1 parameter ledger entries.
 */
export default function buildParameterLedger() {
    return Object.freeze([
        entry('atmosphere.bottomRadiusMeters', 'atmosphere', CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters, 'meters',
            'accepted-experiment-decision', 'Algorithm32 conclusions canonical atmosphere constants', 'accepted',
            'Bottom planet radius used by spherical geometry.'),
        entry('atmosphere.topRadiusMeters', 'atmosphere', CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters, 'meters',
            'accepted-experiment-decision', 'Algorithm32 conclusions canonical atmosphere constants', 'accepted',
            'Top atmosphere radius used by spherical geometry.'),
        entry('atmosphere.rayleighScaleHeightMeters', 'atmosphere', CANONICAL_ATMOSPHERE_CONSTANTS.rayleighScaleHeightMeters, 'meters',
            'accepted-experiment-decision', 'Algorithm32 conclusions canonical atmosphere constants', 'accepted',
            'Rayleigh exponential density scale height.'),
        entry('atmosphere.mieScaleHeightMeters', 'atmosphere', CANONICAL_ATMOSPHERE_CONSTANTS.mieScaleHeightMeters, 'meters',
            'accepted-experiment-decision', 'Algorithm32 conclusions canonical atmosphere constants', 'accepted',
            'Mie exponential density scale height.'),
        entry('atmosphere.rayleighCoefficientScale', 'atmosphere', CANONICAL_ATMOSPHERE_CONSTANTS.rayleighCoefficientScale, 'coefficient scale',
            'accepted-experiment-decision', 'Algorithm32 conclusions Rayleigh coefficient row', 'accepted',
            'Rayleigh coefficient with wavelength in micrometers.'),
        entry('atmosphere.mieAngstromAlpha', 'atmosphere', CANONICAL_ATMOSPHERE_CONSTANTS.mieAngstromAlpha, 'dimensionless',
            'accepted-experiment-decision', 'Algorithm32 conclusions Bruneton 2016 aerosol fit rows', 'accepted',
            'Aerosol Angstrom alpha for Figure 1 clear-sky profile.'),
        entry('atmosphere.mieAngstromBeta', 'atmosphere', CANONICAL_ATMOSPHERE_CONSTANTS.mieAngstromBeta, 'dimensionless',
            'accepted-experiment-decision', 'Algorithm32 conclusions Bruneton 2016 aerosol fit rows', 'accepted',
            'Aerosol Angstrom beta for Figure 1 clear-sky profile.'),
        entry('atmosphere.mieSingleScatteringAlbedo', 'atmosphere', CANONICAL_ATMOSPHERE_CONSTANTS.mieSingleScatteringAlbedo, 'dimensionless',
            'accepted-experiment-decision', 'Algorithm32 conclusions Bruneton 2016 aerosol fit rows', 'accepted',
            'Mie scattering fraction of Mie extinction.'),
        entry('atmosphere.miePhaseFunctionG', 'atmosphere', CANONICAL_ATMOSPHERE_CONSTANTS.miePhaseFunctionG, 'dimensionless',
            'accepted-experiment-decision', 'Algorithm32 conclusions Bruneton 2016 aerosol fit rows', 'accepted',
            'Cornette-Shanks asymmetry parameter.'),
        entry('atmosphere.ozoneAbsorptionEnabled', 'atmosphere', CANONICAL_ATMOSPHERE_CONSTANTS.ozoneAbsorptionEnabled, 'boolean',
            'display-fixture', 'Algorithm32 conclusions Figure 1 no-ozone comparison policy', 'accepted',
            'No-ozone comparison policy for the accepted Figure 1 baseline.'),
        entry('spectral.channelCount', 'spectralBasis', CANONICAL_SPECTRAL_CHANNELS.length, 'count',
            'accepted-experiment-decision', 'Algorithm32 conclusions 15-channel active basis', 'accepted',
            'Active spectral channel count.'),
        entry('spectral.wavelengthsNanometers', 'spectralBasis', CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.wavelengthNanometers), 'nanometers',
            'source-backed-derivation', 'Algorithm32 conclusions centered 360-830 nm derivation', 'accepted',
            'Centered wavelength samples over the active 15-channel basis.'),
        entry('distantSun.angularRadiusRadians', 'lightSource', DISTANT_SUN_CONSTANTS.angularRadiusRadians, 'radians',
            'accepted-experiment-decision', 'Algorithm32 conclusions distant source constants', 'accepted',
            'Solar angular radius retained for source diagnostics and optional disc paths.'),
        entry('display.figure1ToneMapK', 'artifactDisplay', FIGURE1_DISPLAY_CONSTANTS.paperFigure1ToneMapK, 'reciprocal luminance scale',
            'source-backed-derivation', 'Algorithm32 conclusions Figure 1 k derivation', 'accepted',
            'Artifact-display constant, not CPU transport input.'),
        entry('render.figure1ImageSizePixels', 'artifactRender', FIGURE1_RENDER_CONSTANTS.imageSizePixels, 'pixels',
            'accepted-experiment-decision', 'Algorithm32 conclusions Figure 1 render constants', 'accepted',
            'Artifact-rendering constant used later by Subgoal 1.5.'),
        entry('controls.runtime', 'executionControls', RUNTIME_NUMERICAL_CONTROLS, 'Algorithm32NumericalControls',
            'accepted-experiment-decision', 'Algorithm32 conclusions accepted runtime/default baseline', 'accepted',
            'Runtime/default controls retained for product-style CPU runs.'),
        entry('controls.validation', 'executionControls', VALIDATION_NUMERICAL_CONTROLS, 'Algorithm32NumericalControls',
            'accepted-experiment-decision', 'Algorithm32 conclusions convergence validation baseline', 'accepted',
            'Higher-sample validation/reference controls.'),
        entry('controls.step032Artifact', 'executionControls', STEP032_ARTIFACT_NUMERICAL_CONTROLS, 'Algorithm32NumericalControls',
            'accepted-experiment-decision', 'Step 032 artifact baseline constants', 'accepted',
            'Artifact-parity controls used for pre-artifact M1 execution and later image comparison.'),
    ]);
}

function entry(
    id,
    owner,
    value,
    unitsOrKind,
    provenanceClassification,
    sourceOrDecision,
    verificationStatus,
    notes,
) {
    return Object.freeze({
        id,
        owner,
        value,
        unitsOrKind,
        provenanceClassification,
        sourceOrDecision,
        verificationStatus,
        notes,
    });
}
