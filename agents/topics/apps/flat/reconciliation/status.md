# Reconciliation Status

This is the present-state snapshot for `flat/reconciliation`. Checked progress
belongs in the reset plan, chronology in the running log, and exact evidence in
immutable numbered records.

## Present State

- The observer-independent Phase 6 CPU source-model reset is complete through
  ER8. Its accepted quantities, conservation, transport ordering, real-scene
  validation, and convergence remain unchanged by later production decisions.
- Record `049` accepts the bounded lunar source-reference slice. Record `050`
  accepts ER4C plus the complete Sun/Sirius physical transport and reference
  closure, 39/39.
- Record `054` accepts exact returned-epoch acquisition, 13/13. Record `056`
  accepts the eight-case San Jose/Union Glacier physical CPU matrix, 22/22.
- Record `059` accepts the pre-display-only claim boundary, 13/13. No named
  human/camera or real-world visibility claim is made.
- Record `065` accepts CPU convergence and POC cleanup, 26/26. The accepted
  active POC surface retains one point/extended contract and no legacy aliases.
- Record `066` is immutable invalid because `spawn EPERM` occurred before its
  production test process started.
- Record `067` reports a 23/23 production promotion execution with 268/268
  production specs and 2/2 app parse checks. A later audit found that its
  durable unit-suffixed scalar schemas violated the production unit-packet
  rule. The user subsequently rolled back the promoted production changes.
  Record 067 remains historical evidence of that attempt, not evidence for the
  current production tree.
- No record-067 typed-source, point/extended, physical-frame, or canonical-Sun
  promotion currently remains in `shared/algorithm32/production/`.
- The selected successor design is documented under `flat/algorithm32`: build
  camera-independent, geometry-domain fields of atmosphere-transported
  extended radiance and point irradiance; have current shader rays query them,
  complete live raster/foreground behavior, and add `celestialRadiance` before
  Color. It is not implemented or accepted.
- Records `068`, `070`, and `071` remain accepted within their narrow review
  and controlled-presentation claims. Record `069` remains immutable invalid
  because its full diagnostic serialization exceeded Node's string limit.

## Accepted CPU Contract

- Point sources own spectral irradiance density. Exact-source visibility and
  transmittance precede normalized response spreading and division by exact
  pixel solid angle.
- Extended sources own directional spectral radiance density. Conservative
  directional integration resolves partial support, visibility, and
  transmittance without a second coverage multiplier.
- Geometry/depth, source magnitude, atmosphere, point response, angular
  integration, opacity, and display remain separately owned.
- Path, transported endpoint, extended, point, and final values remain in the
  canonical 15-channel spectral-density basis until one global Color boundary.
- The canonical Sun remains single-owned. Independent TSIS, Rieke/MSX,
  Air-LUSI, ROLO, and LIME material remains qualified reference evidence rather
  than shadow runtime ownership.

## Production Handoff

- The Algorithm32 production topic owns the successor cache architecture,
  implementation plan, resource lifecycle, and fresh proof.
- The contribution cache is different from Algorithm32 incident-radiance/L2
  caches. It stores transported direct visible celestial fields; incident
  caches illuminate atmospheric scattering.
- Cache construction resolves source/atmosphere/geometry-domain transport.
  Runtime queries current ray origin/direction, integrates the current extended
  pixel footprint or applies current point response/pixel solid angle, rejects
  foreground scene occlusion, and adds the result before Color without applying
  atmosphere transmittance again.
- Camera pose/projection/viewport changes do not rebuild the cache while the
  camera remains inside its declared domain.
- Record 067 cannot accept this path. Applicable visible-celestial GPU/browser
  parity and a fresh numbered record are required.

## Current Constraints

- Existing records through `071` are immutable and may not be amended or
  rerun. Every future result-bearing attempt uses a fresh numbered directory.
- Production must not runtime-link reconciliation POC code or `tmp` artifacts.
- Durable production boundaries use unit-bearing packets. Private hot paths may
  canonicalize validated values to scalars.
- Captured RGB, authored star meshes, fixed physical star footprints, and
  source-only exposure remain presentation inputs, not physical radiometry.
- Naked-eye/camera visibility, complete sky background, diffuse fields,
  resolved lunar appearance, live acquisition, and Moon/star illumination of
  atmosphere or scene remain deferred.

## Routing

- [Reset Design](extra-atmosphere-reset-design.md): accepted CPU architecture.
- [Reset Plan](extra-atmosphere-reset-plan.md): checked execution and open
  production handoff.
- [Extra-Atmosphere Objects](extra-atmosphere-objects.md): object maturity and
  physical gates.
- [Conclusions](conclusions.md): synthesis and qualifications.
- [CelestialContributionCache Design](../algorithm32/celestial-contribution-cache-design.md):
  canonical successor cache contract.
- [Algorithm32 Production Design](../algorithm32/production-design.md):
  surrounding production architecture.
- [Algorithm32 Deltas](../algorithm32/reconciliation-production-deltas.md):
  current production gap and exit criteria.
