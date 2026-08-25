// References:
// - scripts/flat/reconciliation/POC/src/constants/consts.js, accepted Algorithm32 channel centers and widths.

import { CANONICAL_SPECTRAL_CHANNELS } from '../constants/consts.js';
import SpectralDensityBasis from './SpectralDensityBasis.js';
import {
    CANONICAL_DENSITY_BASIS_ID,
    CANONICAL_DENSITY_QUADRATURE,
    CANONICAL_DENSITY_SAMPLE_SEMANTICS,
    WAVELENGTH_UNITS_NANOMETERS,
} from './consts.js';

/**
 * Wrap the accepted Algorithm32 channels with explicit density/bin semantics.
 *
 * @returns {SpectralDensityBasis} Canonical quantity-bearing basis.
 */
export function createCanonicalSpectralDensityBasis() {
    const boundariesNanometers = Object.freeze([
        canonicalizeIntegerEndpoint(
            CANONICAL_SPECTRAL_CHANNELS[0].wavelengthNanometers
            - CANONICAL_SPECTRAL_CHANNELS[0].wavelengthBinWidthNanometers / 2,
        ),
        ...CANONICAL_SPECTRAL_CHANNELS.map((channel) => canonicalizeIntegerEndpoint(
            channel.wavelengthNanometers + channel.wavelengthBinWidthNanometers / 2,
        )),
    ]);
    return new SpectralDensityBasis({
        id: CANONICAL_DENSITY_BASIS_ID,
        wavelengthUnits: WAVELENGTH_UNITS_NANOMETERS,
        sampleSemantics: CANONICAL_DENSITY_SAMPLE_SEMANTICS,
        quadrature: CANONICAL_DENSITY_QUADRATURE,
        channels: CANONICAL_SPECTRAL_CHANNELS.map((channel, index) => ({
            id: channel.name,
            centerNanometers: channel.wavelengthNanometers,
            lowerBoundNanometers: boundariesNanometers[index],
            upperBoundNanometers: boundariesNanometers[index + 1],
            widthNanometers: channel.wavelengthBinWidthNanometers,
        })),
        provenance: {
            owner: 'scripts/flat/reconciliation/POC/src/constants/consts.js#CANONICAL_SPECTRAL_CHANNELS',
            preservationDecision:
                'Phase 6 preserves the accepted 15 numerical channels and restores quantity/bin semantics.',
            channelCount: CANONICAL_SPECTRAL_CHANNELS.length,
        },
    });
}

function canonicalizeIntegerEndpoint(value) {
    const nearestInteger = Math.round(value);
    return Math.abs(value - nearestInteger) <= 1e-12 ? nearestInteger : value;
}
