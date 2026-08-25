// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER1 analytic extended fixture.

import { stableHash } from '../provenance/stableHash.js';
import SpectralDensityPacket from './SpectralDensityPacket.js';
import { SPECTRAL_DENSITY_UNITS, SPECTRAL_RADIANCE_DENSITY } from './consts.js';

/**
 * Create one explicitly analytic constant extended-radiance fixture.
 *
 * @param {import('./SpectralDensityBasis.js').default} basis - Destination basis.
 * @param {number} densityValue - Constant radiance density.
 * @returns {SpectralDensityPacket} Typed analytic radiance packet.
 */
export function createAnalyticExtendedRadianceDensity(basis, densityValue = 1) {
    const definition = Object.freeze({
        kind: 'constant-spectral-radiance-density',
        densityValue,
        units: SPECTRAL_DENSITY_UNITS[SPECTRAL_RADIANCE_DENSITY],
        basisFingerprint: basis.fingerprint,
    });
    return new SpectralDensityPacket({
        quantity: SPECTRAL_RADIANCE_DENSITY,
        units: SPECTRAL_DENSITY_UNITS[SPECTRAL_RADIANCE_DENSITY],
        basis,
        values: basis.channels.map(() => densityValue),
        provenance: {
            sourceId: 'er1-analytic-constant-extended-radiance',
            sourceVersion: 'v1',
            sourceHashSha256: stableHash(definition),
            definition,
            claimBoundary: 'Analytic quantity/schema fixture only; not a physical Sun or Moon source.',
        },
        uncertainty: {
            status: 'analytic-fixture',
            model: 'exact-authored-constant',
            values: basis.channels.map(() => 0),
        },
    });
}

