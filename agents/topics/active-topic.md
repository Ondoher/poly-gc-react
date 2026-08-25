# Active Topic

Current active topic: `flat/algorithm32`

Parent app/topic: `flat`

## Current Focus

The active lane is the optional **camera-independent, ray-queryable
`CelestialContributionCache`** extension for the existing production
Algorithm32 shader/runtime. Its canonical contract is
[CelestialContributionCache Design](apps/flat/algorithm32/celestial-contribution-cache-design.md),
and its ordered work is
[CelestialContributionCache Implementation Plan](apps/flat/algorithm32/celestial-contribution-cache-plan.md).
Applicable external research and accepted oracle routing have been mined into
the cache-local
[Reference And Evidence Dossier](apps/flat/algorithm32/celestial-contribution-cache-references.md).

The user rolled back record-067's production promotion. Record `067` remains
immutable historical evidence of that attempt, but its removed modules and
hashes do not describe current production. Reconciliation ER0 through ER8
remain the accepted CPU behavior/oracle.

The selected cache stores already atmosphere-transported extended radiance and
point irradiance over bounded geometry-owned domains. Camera changes query the
same generation; they do not create final cached pixels or rebuild the field.
The design remains unimplemented and requires dimensionality/resource
qualification plus a fresh proof.

Topic README: [Algorithm32 Production](apps/flat/algorithm32/README.md)

## Fresh Agent Route

After bootstrap, compaction, or interruption:

1. Read this file.
2. Read [Algorithm32 Production](apps/flat/algorithm32/README.md).
3. Read only the four files under `Minimal Reload Sources`.
4. Treat `shared/algorithm32/production/` as current implementation truth.
5. Before production Reference/shader coding, testing, fixture, citation, or
   evidence work, open the topic-local rules and guidance document. Open the
   redundancy audit only for documentation cleanup.
6. Open the cache-local reference/evidence dossier when a phase needs source or
   oracle detail. Open reconciliation records or POC code only to audit or
   extract an exact dossier-listed artifact.
7. Announce `flat/algorithm32`, the rolled-back ER9 promotion, and the
   camera-independent celestial contribution-cache focus.

## Current Handoff

- Existing production topology remains fixed around `Algorithm32`,
  `SharedModel`, `Reference`, `SpectralCalculator`, `ShaderBuilder`,
  `ShaderRuntimePass`, configured source/atmosphere/geometry owners,
  incident-radiance caches, and Color.
- The cache is derived shader resource state, not `SharedModel` truth,
  captured scene RGB, an incident-radiance/L2 cache, or a per-pixel frame.
- Runtime adds cache results through a separate `celestialRadiance` term after
  base atmosphere transport and before Color, without applying transmittance a
  second time.
- Camera/projection/viewport and foreground scene changes remain live inputs.
  Transported-field dependencies and exact invalidation rules are owned by the
  canonical cache design.
- An optional disabled cache preserves current output exactly. A configured
  missing, stale, or incompatible cache is a setup/update error.
- The companion plan remains at Phase A0. Its cache-local source/evidence
  inventory is complete; next freeze the common qualification harness,
  immutable oracle manifest, samples, measurements, timing method, and budgets
  before the bounded coordinate/resource lanes run in parallel. It is not
  production code based on an assumed dense texture.
- Current baseline is 229 passing production specs. The cache extension has no
  implementation or parity result.

## Minimal Reload Sources

- [Algorithm32 Status](apps/flat/algorithm32/status.md)
- [CelestialContributionCache Design](apps/flat/algorithm32/celestial-contribution-cache-design.md)
- [CelestialContributionCache Plan](apps/flat/algorithm32/celestial-contribution-cache-plan.md)
- [Reconciliation To Production Deltas](apps/flat/algorithm32/reconciliation-production-deltas.md)

## Open When Needed

- [Production Reference And GPU Shader Rules And Guidance](apps/flat/algorithm32/production-reference-and-gpu-shader-rules.md)
- [Production Reference And GPU Shader Documentation Redundancy Audit](apps/flat/algorithm32/production-reference-and-gpu-shader-redundancy-audit.md)
- [App Integration Guide](apps/flat/algorithm32/integration.md)
- [Algorithm32 Production Design](apps/flat/algorithm32/production-design.md)
- [Algorithm32 Implementation Plan](apps/flat/algorithm32/implementation-plan.md)
- [CelestialContributionCache Reference And Evidence Dossier](apps/flat/algorithm32/celestial-contribution-cache-references.md)
- [Reconciliation Conclusions](apps/flat/reconciliation/conclusions.md)
- [Extra-Atmosphere Reset Design](apps/flat/reconciliation/extra-atmosphere-reset-design.md)
- [Extra-Atmosphere Reset Plan](apps/flat/reconciliation/extra-atmosphere-reset-plan.md)
- [Production Package README](../../shared/algorithm32/production/README.md)
- [Production Implementation](../../shared/algorithm32/production/)
- [Reconciliation POC](../../scripts/flat/reconciliation/POC/)

## Documentation Ownership

- Current routing and handoff: this file.
- Current production state and next actions: Algorithm32 `status.md`.
- Cross-cutting production Reference/shader coding, testing, fixture,
  citation, evidence, and claim rules:
  `production-reference-and-gpu-shader-rules.md`.
- Topic-local documentation cleanup inventory:
  `production-reference-and-gpu-shader-redundancy-audit.md`.
- Cache-specific contract: `celestial-contribution-cache-design.md`.
- Cache-specific ordered work, gates, and checked progress:
  `celestial-contribution-cache-plan.md`.
- Cache-local external research, retained source identities, oracle claim
  boundaries, and promotion crosswalk:
  `celestial-contribution-cache-references.md`.
- Surrounding production architecture: `production-design.md`.
- Current reconciliation-to-production gap: `reconciliation-production-deltas.md`.
- Broader production milestone sequence: `implementation-plan.md`.
- App integration after implementation: `integration.md`.
- Accepted CPU behavior/evidence: reconciliation docs and numbered records.
  Routine cache planning uses the local dossier; those records are exact audit
  inputs until selected claims are promoted to production evidence.

## Active Rules

- Extend the existing production architecture; do not replace its facade,
  transport, incident caches, runtime pass, configured owners, or Color.
- Do not runtime-link production to reconciliation POC code or records.
- Do not cache camera-specific final pixels in the canonical contribution cache.
- Do not use captured RGB, authored meshes, or source-only exposure as
  physical celestial radiometry.
- Preserve one canonical owner for every source fact.
- Use unit-bearing packets at durable/API boundaries and private canonical
  scalars only inside validated hot paths.
- Treat record `067` as historical only; never amend or rerun it.
- A future proof uses a fresh numbered record and applicable GPU/browser parity.
