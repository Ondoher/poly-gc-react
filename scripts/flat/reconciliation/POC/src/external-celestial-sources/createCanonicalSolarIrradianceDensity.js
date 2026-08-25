// References:
// - scripts/flat/reconciliation/POC/src/constants/consts.js, accepted canonical solar owner.

import { CANONICAL_SPECTRAL_CHANNELS } from '../constants/consts.js';
import SpectralDensityPacket from './SpectralDensityPacket.js';
import { SPECTRAL_DENSITY_UNITS, SPECTRAL_IRRADIANCE_DENSITY } from './consts.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from './fixtureManifest.js';

/**
 * Wrap the existing canonical solar density samples without duplicating ownership.
 *
 * @param {import('./SpectralDensityBasis.js').default} basis - Canonical quantity-bearing basis.
 * @returns {SpectralDensityPacket} Canonical solar irradiance-density packet.
 */
export function createCanonicalSolarIrradianceDensity(basis) {
    const source = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.canonicalSolar;
    return new SpectralDensityPacket({
        quantity: SPECTRAL_IRRADIANCE_DENSITY,
        units: SPECTRAL_DENSITY_UNITS[SPECTRAL_IRRADIANCE_DENSITY],
        basis,
        values: CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.solarIrradiance),
        provenance: {
            ...source,
            sourceHashSha256: source.sourceHashSha256,
            wrappingPolicy: 'Typed wrapper selects the existing owner values; it does not resample them.',
        },
        uncertainty: {
            status: 'partial',
            model: 'accepted-source-provenance-without-channel-covariance',
            notes: [
                'ER1 retains source identity and units but does not invent per-channel uncertainty.',
                'The bounded-band invariant is not a total-solar-irradiance uncertainty claim.',
            ],
        },
    });
}

