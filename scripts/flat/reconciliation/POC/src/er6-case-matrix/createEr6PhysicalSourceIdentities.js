// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   one canonical owner for physical source identity and source quantity.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md,
//   ER6 Sun, globe Moon, and calibrated Sirius scene matrix.

import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from
    '../external-celestial-sources/fixtureManifest.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';

/**
 * Create the canonical identity-only ER6 Sun, Moon, and Sirius source list.
 *
 * The returned descriptors intentionally retain only versioned source metadata.
 * They do not read or expose spectral values, irradiance, radiance, display
 * values, or scene calibration.
 *
 * @returns {Readonly<Record<string, unknown>>} Immutable source descriptors and identities.
 */
export default function createEr6PhysicalSourceIdentities() {
    const manifest = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST;
    const descriptors = Object.freeze([
        Object.freeze({
            id: manifest.canonicalSolar.sourceId,
            kind: 'extended',
            sourceVersion: manifest.canonicalSolar.sourceVersion,
            sourceHashSha256: manifest.canonicalSolar.sourceHashSha256,
            identityScope:
                'canonical-Sun source metadata only; no irradiance values are read here',
        }),
        Object.freeze({
            id: manifest.limeLunarCandidate.sourceId,
            kind: 'extended',
            sourceVersion: manifest.limeLunarCandidate.sourceVersion,
            releaseHashSha256:
                manifest.limeLunarCandidate.release.sourceHashSha256,
            coefficientHashSha256:
                manifest.limeLunarCandidate.coefficients.sourceHashSha256,
            spectralReferenceHashSha256:
                manifest.limeLunarCandidate.spectralReference.sourceHashSha256,
            identityScope:
                'accepted LIME source metadata only; no lunar radiometry is evaluated here',
        }),
        Object.freeze({
            id: manifest.siriusCalspec.sourceId,
            kind: 'point',
            sourceVersion: manifest.siriusCalspec.sourceVersion,
            sourceHashSha256: manifest.siriusCalspec.sourceHashSha256,
            identityScope:
                'CALSPEC Sirius source metadata only; no spectral values are read here',
        }),
    ]);
    const identities = Object.freeze(descriptors.map((descriptor) => Object.freeze({
        id: descriptor.id,
        kind: descriptor.kind,
        fingerprint: stableHash(descriptor),
    })));
    const core = {
        kind: 'er6-physical-source-identities-v1',
        manifestVersion: manifest.manifestVersion,
        descriptors,
        identities,
        qualification:
            'Identity and provenance routing only; source quantities remain outside this helper.',
    };
    return freezeJsonValue({
        ...core,
        fingerprint: stableHash(core),
    });
}
