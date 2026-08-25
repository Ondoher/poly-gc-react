# Algorithm32 Status

This document is the current production handoff, not chronology. Replace stale
state rather than appending successor narratives.

## Current Focus

The current production implementation is the existing Algorithm32 atmosphere
and runtime path under `shared/algorithm32/production/`. The user rolled back
record-067's typed celestial/CPU-frame promotion; record `067` is historical
execution evidence and does not describe the current tree.

The selected next extension is a **camera-independent, ray-queryable celestial
contribution cache**:

```text
source + atmosphere + geometry domain
    -> camera-independent transported contribution field

current camera ray + scene depth + pixel footprint
    -> query cached support
    -> resolve current raster/foreground contribution
    -> pathRadiance + celestialRadiance
    -> existing Color conversion
```

Moving or rotating the camera changes only live rays and projection inputs. It
does not recreate the cache. Implementation and fresh parity evidence remain
open.

## Current State

- Production remains organized around `Algorithm32`, `SharedModel`, per-ray
  `Reference` and `SpectralCalculator`, `ShaderBuilder`, `ShaderRuntimePass`,
  configured source/atmosphere/geometry owners, source-owned incident-radiance
  caches, and Color.
- `Reference` remains the CPU/reference oracle. Product rendering remains the
  GPU shader path.
- Runtime Three integration remains:
  `RenderPass(scene, camera) -> SceneInputCapture -> ShaderRuntimePass`.
- `SceneInputCapture` supplies renderer scene color, scene depth, and hit state.
  It is a live visibility input, not celestial radiometry.
- `Algorithm32Transport` supplies current atmosphere path radiance and
  transmittance. Incident-radiance/L2 caches illuminate the atmosphere; they
  are not visible-source contribution caches.
- `BrunetonColorDisplayModel` remains the sole display owner.
- Physical visible Sun/Moon/star production rendering is currently absent.
  Captured celestial meshes and diagnostic stars remain presentation only.

## Selected Cache Contract

[CelestialContributionCache Design](celestial-contribution-cache-design.md) is
the canonical contract, and
[CelestialContributionCache Implementation Plan](celestial-contribution-cache-plan.md)
owns its ordered work and gates. The
[CelestialContributionCache Reference And Evidence Dossier](celestial-contribution-cache-references.md)
now contains the locally mined external research, exact retained source
identities, oracle claim boundaries, and production-promotion crosswalk. The
selected invariants are:

- distinct already transported extended-radiance and point-irradiance fields;
- geometry-domain identity with no camera or viewport pixels;
- live footprint, point-response, pixel-solid-angle, and foreground-depth work;
- one `celestialRadiance` addition after base transport and before Color; and
- exact zero only when the optional cache is disabled. A configured missing,
  stale, or incompatible generation fails during setup/update.

Physical field dimensions, coordinate reductions, packing, capability limits,
and the minimal canonical celestial-source provider remain unresolved until the
required qualification probe supplies measurements.

The preferred qualification candidates are now explicit but remain
unaccepted: `(source, altitude, local-zenith cosine)` for distant/spherical
point and extended fields, `(source, z, rho)` for finite local/flat point
fields, and `(source, z, vertical direction cosine)` for extra-atmosphere
extended disks over a plane-parallel flat atmosphere. A small optional
per-frame preparation shader may resolve point-cache queries, projection, and
exact-source visibility into transient source packets; it does not rebuild the
camera-independent field.

The current companion-plan phase is A0. Its source/evidence inventory is
complete. Next freeze the common qualification harness, immutable oracle
manifest, samples, measurements, GPU timing method, and predeclared budgets
before the spherical, flat, and point-query pipeline lanes run in parallel.
Qualification may read the dossier-listed immutable records directly; selected
production reference/evidence promotion follows Gate A and Contract Gate B.

## Current Verification

- `npm run test:algorithm32:production`: 229 specs passing.
- The last recorded build passes with known Babel deoptimisation and existing
  circular-dependency warnings.
- The last broader flat UI checkpoint records 120 passing specs.
- No contribution-cache implementation, runtime result, or parity proof exists.

## Open Items

1. Execute the cache design's coordinate/resource qualification gate for the
   selected distant/spherical and local/flat candidates. For each family,
   settle the physical index, the complete spectral value returned at that
   index, and the production calculation that creates it. Explicitly resolve
   whether the fixed flat observer dome is a view-ray cap or a direct-celestial
   transport boundary before accepting compact local coordinates. Use the
   local dossier's claim/reference map and treat every coordinate reduction as
   a hypothesis until measured.
2. Use those results to freeze the first source/pairing matrix, minimal
   canonical celestial-source provider, response/depth policy, representation,
   resource budget, and failure envelope.
3. Continue through
   [the companion cache plan](celestial-contribution-cache-plan.md#phase-a-representation-qualification),
   beginning with its parallel qualification lanes, then execute a fresh
   numbered GPU/browser proof. Record 067 cannot accept this design.

## Deferred

The canonical cache design owns the detailed exclusions. The explicit
post-first-slice follow-up is a textured 3D Moon with calibrated spectral
surface radiometry or reflectance/illumination/BRDF ownership; authored RGB is
not physical source data. Live acquisition, observer response, celestial
illumination of atmosphere/scene, Earthshine, eclipses, diffuse fields,
generalized plugins, and stable public diagnostics remain deferred.

## Working Rules

- Extend existing production topology; do not replace its core owners.
- Keep the cache distinct from incident-radiance/L2 caches and renderer RGB.
- Camera changes update rays/uniforms only; never rebuild the canonical cache
  merely because the camera moved.
- Use the cache design requirements ledger as the single owner of field,
  transport, response, invalidation, and failure invariants.
- Do not runtime-link production to reconciliation or `tmp`.
- Durable boundaries use unit-bearing packets; private hot paths may
  canonicalize after validation.
- Do not implement a generic dense field or GPU layout before the qualification
  gate establishes a bounded representation.

## Source Pointers

- `agents/topics/active-topic.md`
- `agents/topics/apps/flat/algorithm32/README.md`
- `agents/topics/apps/flat/algorithm32/production-reference-and-gpu-shader-rules.md`
- `agents/topics/apps/flat/algorithm32/production-reference-and-gpu-shader-redundancy-audit.md`
- `agents/topics/apps/flat/algorithm32/celestial-contribution-cache-design.md`
- `agents/topics/apps/flat/algorithm32/celestial-contribution-cache-plan.md`
- `agents/topics/apps/flat/algorithm32/celestial-contribution-cache-references.md`
- `agents/topics/apps/flat/algorithm32/production-design.md`
- `agents/topics/apps/flat/algorithm32/reconciliation-production-deltas.md`
- `agents/topics/apps/flat/algorithm32/implementation-plan.md`
- `agents/topics/apps/flat/algorithm32/integration.md`
- `agents/topics/apps/flat/reconciliation/conclusions.md`
- `agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md`
- `shared/algorithm32/production/README.md`
- `shared/algorithm32/production/implementation/ShaderBuilder.js`
- `shared/algorithm32/production/implementation/ShaderRuntimePass.js`
- `shared/algorithm32/production/transport/Algorithm32Transport.js`
- `shared/algorithm32/production/color/BrunetonColorDisplayModel.js`
