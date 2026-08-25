# Extra-Atmosphere Reset Plan

Status: ER0 through ER8 and the observer-independent CPU exit are complete.
ER9's scope decision and record-067 execution are retained as history, but the
user rolled back that production promotion after a later unit-boundary audit.
No record-067 celestial implementation remains current. Records 054 and 056 accept ER6
exact acquisition, 13/13, and physical rendering, 22/22. Record 050 accepts the combined ER4C
physical frame correction and remaining ER5 Sun/Sirius closure, 39/39, while
inheriting record 049 only for lunar XA-G09. Record 059 accepts ER7's pre-
display-only claim boundary, 13/13. Record 065 accepts ER8 convergence and
cleanup, 26/26. Record 067 reports the selected ER9 production execution as
23/23, with 268/268 production specs and 2/2 app syntax checks, but its criteria
did not enforce the governing unit-bearing durable-boundary rule. The selected
successor is the Algorithm32
[CelestialContributionCache](../algorithm32/celestial-contribution-cache-design.md)
extension; it is designed but not implemented or proved.

This is a progress plan, not a running history. Checked items retain only the
accepted outcome and its essential evidence pointer. Attempt chronology and
detailed findings belong in the
[reconciliation running log](../../../../../tmp/atmosphere/reconciliation/running-log.md)
and the immutable numbered records.

This plan executes the
[Extra-Atmosphere Reset Design](extra-atmosphere-reset-design.md). The
[Extra-Atmosphere Objects](extra-atmosphere-objects.md) tracker owns per-object
research and physical acceptance gates. This plan owns execution order,
dependencies, record boundaries, and reset exit.

## Goal

Replace prototype celestial brightness and coverage behavior with the smallest
physically typed source-to-pixel pipeline:

1. Point sources own top-of-atmosphere spectral irradiance density.
2. Extended sources own directional spectral radiance density.
3. Geometry and visibility remain independent of brightness.
4. Conservative pixel integration applies exact-direction transport and a
   normalized source response.
5. The frozen Algorithm32 atmosphere supplies path radiance and
   transmittance.
6. One global Color/display transform follows full spectral composition.

The target is physical source transport, not a tuned image. Real Flat32 scenes
become validation fixtures only after isolated quantity, conservation, and
transport gates pass.

## Governing Rules

- Preserve the accepted atmosphere, canonical spectral basis, globe ephemeris,
  geometry, depth, occlusion, source-owned Sun facts, and real-scene schedule.
- Point irradiance and extended radiance remain distinct typed measures.
  Geometry, opacity, source response, atmosphere, and display do not own or
  alter source magnitude.
- Treat the coverage-resolved ExternalBoundaryRadiance v1 packet, scalar
  candidate-coverage compositor, prototype star calibration, neutral Moon
  calibration, and celestial GPU slice as non-governing reset inputs.
- Do not add compatibility aliases, legacy fallbacks, or a migration bridge.
  Replace all POC integrations once the new contract is accepted and let stale
  consumers fail loudly.
- Do not modify or rerun an immutable numbered record. Records through 050 are
  sealed. Every result-bearing execution must use the next fresh numbered
  directory after its complete boundary is predeclared.
- Keep implementation under scripts/flat/reconciliation/POC/, topic
  documentation under this topic, and evidence under
  tmp/atmosphere/reconciliation/.
- Do not modify or runtime-link src/flat32/, production, archived, or external
  experiment code during the CPU reset. Copy only bounded facts with
  provenance when a proof requires them.
- Do not render subjective scene images before applicable isolated quantity,
  conservation, invariance, and transport gates pass.
- Do not move to GPU until the CPU source/raster/transport contract and bounded
  convergence are accepted.
- Apply one global review transform only after physical composition. Do not
  add source-specific exposure, footprint gain, or visibility thresholds.
- Observer/background work is conditional on a named real-world human/camera
  visibility claim and cannot repair failed source conservation.
- The canonical Sun packet remains the single source of solar runtime facts.
  Reference models may quantify uncertainty but may not become shadow owners.

## Continuous Execution Loop

1. Expand the active unchecked item into file-level work, a test matrix,
   artifacts, tolerances, and stop conditions before runtime implementation.
2. Execute it in the assigned fresh immutable record.
3. Classify mechanical, physical, reviewability, observational, and overall
   status independently where applicable.
4. Update checked state here only for accepted plan outcomes. Put chronology in
   the reconciliation running log and detailed evidence in the numbered record.
5. On acceptance, check the item, expand the next dependency, and continue.
   A phase exit is a checkpoint, not a stopping condition.
6. On rejection or invalidity, preserve the record, diagnose the owning layer,
   update current docs, and retry in the next unused record without weakening a
   criterion or tuning another layer.
7. When a required source or method is missing, research authoritative
   references, record alternatives and provenance, adopt a defensible
   recommendation, and continue.
8. Stop only for an unresolved material choice with no defensible
   recommendation, missing authority, or unavoidable external state.

## Phase Progress

- [x] ER0 declared and routed the scoped reset.
- [x] ER1 accepted typed quantities and physical source fixtures.
- [x] ER2 accepted unresolved point-source conservation.
- [x] ER3 accepted extended-source conservation.
- [x] ER4 accepts physically typed frozen-atmosphere CPU integration through
  record 050; record 042 retains only a mechanical array-arithmetic probe.
- [x] ER4C accepts the missing full-frame exact-direction point/extended
  raster, visibility, atmosphere, composition, and single-display pipeline.
- [x] ER5 accepts calibrated star, Sun-disk, and globe-Moon radiometry.
- [x] ER6 validates the accepted pipeline in the real Flat32 globe matrix.
- [x] ER7 bounds observer/background validation out; no observational claim is
  selected.
- [x] ER8 bounds CPU convergence and removes superseded POC behavior.
- [ ] ER9 production exit remains open: record 067's execution is retained but
  its implementation was rolled back. The selected successor is a
  camera-independent transported contribution-field cache with unit-bearing
  durable boundaries and a fresh GPU/browser proof.

## ER0: Reset Declaration And Routing

- [x] Make the reset design, plan, and object tracker authoritative without
  erasing accepted evidence.
- [x] Route bootstrap and current-status documents to the reset.
- [x] Qualify pre-reset POC material as reference-only where applicable.
- [x] Align the fact ledger, experimental rules, POC pointers, and running log.
- [x] Complete the documentation-only reset boundary without changing runtime,
  production, Flat32, shaders, or immutable records.

## ER1: Typed Quantity And Source-Fixture Contract

Accepted evidence: record 033-er1-typed-celestial-sources-contract, 16/16.

- [x] Freeze the accepted 15-channel, 360..830 nm basis as contiguous
  bin-average-density samples with explicit widths and a stable fingerprint.
- [x] Accept immutable SI point-irradiance and extended-radiance packets plus
  fail-loud kind, unit, basis, provenance, and value validation.
- [x] Accept exact source-to-bin integration and same-support synthetic
  photometry checks.
- [x] Reuse the canonical solar owner, accept direct CALSPEC Sirius spectral
  irradiance, retain Gaia version-2 G as an independent photometry reference,
  and seal the pinned LIME lunar candidate without claiming calibration.
- [x] Keep camera, atmosphere, response, display, and image output outside the
  ER1 source contract.

## ER2: Point-Source Conservation Reference

Accepted evidence: record 034-er2-point-source-conservation, 15/15 across nine
cameras and 252 point cases.

- [x] Accept exact perspective-pixel solid angle and camera/raster transforms.
- [x] Accept the normalized cardinal bilinear point response with explicit
  on-raster and off-raster accounting.
- [x] Prove channel-wise point-flux conservation, additivity, edge accounting,
  and resolution/FOV/subpixel invariance without atmosphere or display.
- [x] Remove fixed solid-angle divisors, authored physical disks, and
  source-only exposure from the accepted point reference.

## ER3: Extended-Source Conservation Reference

Accepted evidence: record 040-er3-extended-source-conservation, 10/10.

- [x] Accept deterministic physical solid-angle quadrature and exactly one
  coverage/integration operation.
- [x] Accept analytic uniform-disk, normalized limb-profile, and Lambert-sphere
  checks for angular and projected irradiance.
- [x] Accept analytic extended integration, small-disk total-flux accounting,
  and explicit off-raster accounting in one camera.
- [x] Retain one conservative directional spherical-cap path and make the
  collapsed optimization explicitly absent; record 050 verifies the runtime
  and higher-order paths use that same implementation.
- [x] Keep atmosphere, display, real scenes, and physical Sun/Moon calibration
  outside ER3.

## ER4: Frozen-Atmosphere CPU Integration

Retained bounded evidence: record
042-er4-frozen-atmosphere-cpu-integration mechanically passes its five sealed
array criteria, but it is not physical ER4 evidence. It multiplies point
spectral irradiance by transmittance and adds that value directly to spectral
radiance without normalized response weight or pixel solid angle. It also has
no independent source direction, extended quadrature, vacuum, visibility,
occlusion, frame, or display path.

- [x] Compose only like radiance-density quantities; convert transported point
  irradiance with `F_lambda T_lambda p_i / Omega_i` before addition.
- [x] ER4C transports point irradiance using exact source-center visibility and
  transmittance before normalized full-frame response spreading.
- [x] ER4C transports extended radiance using visibility and transmittance at
  every physical quadrature direction.
- [x] ER4C retains path, endpoint, point, extended, and final pre-display
  spectra, then applies exactly one global display transform.
- [x] ER4C accepts vacuum controls, source conservation, off-raster accounting,
  deterministic depth/occlusion, no-double-transmittance, and composition
  residuals in a fresh immutable record.

Accepted evidence: record
`050-er4c-sun-sirius-physical-transport-closure`, 39/39.

Record 042 remains immutable and retains its mechanical criterion results; its
current physical-transport status is rejected and it does not satisfy ER4.

## ER5: Physical Source Calibration

Purpose: replace analytic inputs with sourced Sirius, canonical-Sun-disk, and
globe-Moon radiometry while preserving ER1 through ER3. ER4C replaces record
042's dimensionally invalid physical-composition claim.

Accepted progress:

- [x] Record 044-er5-physical-source-calibration accepts the
  Sirius/canonical-solar source slice, 4/4.
- [x] Record 046-er5-lunar-phase-calibration accepts the pinned LIME candidate and
  staged Lambert phase checks. It does not accept independent lunar coefficient
  calibration and remains immutable.
- [x] Record 048-er5-lunar-coefficient-calibration accepts mechanical parsing
  and a bounded zero-libration central prediction, 12 accepted criteria and
  four explicit deferrals. It does not accept XA-G09 or general lunar
  calibration.
- [x] Record 049-er5-lunar-physical-reference-calibration accepts the
  disk-integrated lunar source-reference slice, 15/15, including 56/56 direct
  Air-LUSI and 4/4 qualified ROLO blue-bin comparisons. It does not claim
  resolved lunar radiance or transport closure.

Record 048 accepted scope:

- [x] Parse and hash the retained 20251010_v1 coefficient, ASD v2.0.0, ATBD
  v3.3, release implementation, CIMEL response, and TSIS reference payloads.
- [x] Reconstruct the six-anchor zero-libration phase prediction at 0, 30, 60,
  and 85 degrees with full coefficient covariance.
- [x] Map linear-release and cubic-ATBD diagnostic spectra to all 15 canonical
  channels with exact bin bounds and model-assisted-region qualifications.
- [x] Keep the canonical Sun as sole runtime owner, prove explicit inverse-
  square distances, and retain the TSIS/canonical transfer as a deterministic
  reference-standard difference.
- [x] Compare LIME with the staged Lambert scaffold and retain source terms,
  corrections, spectra, residuals, statuses, and no resolved-radiance claim.

Record 049 predeclared scope:

- [x] Adopt LIME-TBX `v1.4.1` plus coefficient set `20251010_v1` as the
  versioned executable central authority: native payload/covariance order,
  nearest signed integer ASD phase, release linear interpolation, and release
  response-correction sign. Retain quadratic/cubic interpolation and the ATBD
  sign as model-form alternatives rather than compatibility paths.
- [x] Define deterministic linearized propagation from coefficient covariance
  and separable ASD wavelength/phase correlation into the joint four-phase by
  15-channel covariance. Retain interpolation/sign populations separately and
  validate the non-linear interpolation implementation against the pinned
  NumPy `1.26.4`/SciPy `1.13.1` oracle.
- [x] Pin the independent 2022 NIST Air-LUSI spectra and published ROLO 311g
  coefficient reference with exact source hashes and qualifications.
- [x] Execute record `049-er5-lunar-physical-reference-calibration` exactly
  once after its reader, model, uncertainty propagator, and runner preflights
  pass.
- [x] Require every one of the 56 Air-LUSI flight/channel comparisons in fully
  measured channels 2 through 15 to satisfy
  `max(5%, 2*sqrt(u_air^2 + u_lime^2 + u_numeric^2))`, with the Air-LUSI term
  using the maximum published bin uncertainty plus a `0.3%` uniformity term,
  LIME uncertainty floored at `1%`, and numerical integration bounded at
  `0.25%` by full-versus-half-grid convergence.
- [x] Require the incompletely Air-LUSI-covered first channel to agree with the
  qualified ROLO 311g model reference within `15%`; do not label that result a
  direct SI-measurement comparison.
- [x] If multiple coefficient/interpolation authority variants pass the
  independent comparison, retain the versioned release semantics. A sole
  release branch may pass directly; a sole alternate branch identifies the
  required authority but must route to a fresh record that recomputes its
  matching central covariance. If none passes, reject the attempt. Never
  weaken a tolerance.

Combined ER4C and remaining ER5 closure:

Accepted evidence: record
`050-er4c-sun-sirius-physical-transport-closure`, 39/39. It accepts the
calibrated point/extended transport matrix, single conservative Sun path,
physical full-frame seam, TSIS solar and Rieke Sirius references, exact
component/display ordering, and complete hashed executable/reference
provenance. It makes no observer, GPU, or production claim.

- [x] Use calibrated Sirius and the one canonical Sun packet as the real
  fixtures for the physically typed frame correction.
- [x] Compare Sirius with an independently sourced measured photometric datum
  and the canonical solar packet with an independently versioned solar
  reference under uncertainty-derived tolerances; neither reference becomes a
  second runtime owner.
- [x] Require the canonical `360..830 nm` solar integral to agree with official
  TSIS-1 HSRS v2 within
  `max(2%, 2*u_HSRS/I_HSRS, 0.05%)`; keep individual channel differences
  diagnostic and reconstruct the uniform Sun disk within `1e-10` relative.
- [x] Require the CALSPEC Sirius `554.5..557.0 nm` average to agree with the
  Rieke et al. `555.75 nm` absolute anchor within `3%`, and its declared
  `2.00..2.31 micrometer` Br-gamma-excluded continuum fit to agree with the
  MSX-transferred `2.1603 micrometer` anchor within `4%`.
- [x] Convert transported point irradiance to pixel radiance only through
  `F_lambda T_lambda p_i / Omega_i`; prove exact-source visibility and
  transmittance precede the normalized full-frame response.
- [x] Evaluate extended Sun samples at their own quadrature directions with
  per-direction visibility/transmittance, reconstruct the source-owned solar
  irradiance, and bound a higher-order reference.
- [x] Include real vacuum, near-horizon wrong-order discriminators,
  deterministic blockers/partial occlusion, off-raster accounting, additive
  point overlap, retained component spectra, and one final global display pass.
- [x] Keep separate `er4TransportStatus`, `siriusReferenceStatus`,
  `solarReferenceStatus`, observational status, and overall AND status in
  record 050.

ER5 exit:

- [x] XA-G09 reference passes independently for every promoted source class.
- [x] Sirius, Sun, and Moon retain physical source hashes, transformations, and
  uncertainty qualifications.
- [x] Disk integration reconstructs the canonical solar irradiance, and lunar
  phase/distance behavior passes its independent physical reference.
- [x] No source-specific exposure, authored physical footprint, moved body, or
  duplicated solar fact is required.

## ER6: Real Flat32 Globe Validation

Dependency: ER4C and ER5 exits.

Accepted evidence: record `054-er6-globe-state-acquisition`, 13/13, retains
eight exact cases, 40 unique Horizons API 1.2 payloads, returned-epoch
attachments, signed lunar aspects, and observer reconstruction. Record
`056-er6-physical-globe-scene-validation`, 22/22, accepts physical scene
transport. Immutable record 055 remains the rejected status-wiring attempt.

- [x] Reuse the bounded hashed scene snapshot and time resolver without
  changing accepted source, response, display, atmosphere, or tolerances.
- [x] Run San Jose at authored June sunrise, solar noon, sunset, and sunset plus
  one hour.
- [x] Run Union Glacier at its authored December date with the same signed
  offsets around its own solar noon and native polar-day availability.
- [x] Preserve exact returned-epoch Sun/Moon state for every case; record 054.
- [x] Report calibrated catalog stars separately from Flat32 synthetic analogs;
  label any artificial Moon placement as presentation-only.
- [x] Retain pre-display source/path/final spectra and object/depth identities.
- [x] Report mechanical, physical-radiometry, automated-reviewability, and
  human-review statuses independently.
- [x] Accept the matrix only if ephemeris, geometry, depth, conservation, and
  frozen-atmosphere composition coexist without source-specific tuning.
- [x] Route a failure back to its isolated owning phase.

## ER7: Conditional Observer And Sky-Background Validation

Dependency: ER6 plus an explicit observational claim.

- [x] Decide that the active reset claims only physically transported
  pre-display radiance and does not claim visibility for a named person/camera.
- [x] Record observer/background
  validation as explicitly out of scope and continue to ER8.
- [x] Do not select the conditional visibility branch; no observer, diffuse
  background, optical/display response, or detection criterion is required for
  the selected claim.
- [x] Leave observer/background validation explicitly out of scope without
  changing physical source flux or Algorithm32 constants.
- [x] Report human review and numerical detection separately as not claimed.

## ER8: CPU Convergence And POC Cleanup

Dependency: ER6, and ER7 only when an observational claim is selected.

- [x] Compare runtime CPU settings with a higher-accuracy reference for path,
  transmittance, point response, and extended quadrature.
- [x] Bound spectral, integrated-flux, and display residuals over the accepted
  scene/source matrix.
- [x] Inventory every v1 boundary, candidate, renderer, and consumer.
- [x] Delete or replace superseded calibration, scalar coverage/opacity
  coupling, fixed solid angles, authored physical star disks, source-only
  exposures, and duplicate display paths.
- [x] Retain no legacy alias or fallback behavior.
- [x] Update POC and topic current-state documentation to the accepted
  replacement contract.
- [x] Accept XA-G11 convergence and verify that only the accepted
  point/extended contract remains active.

## ER9: GPU And Production Promotion Decision

Dependency: ER8.

Retained execution evidence: record `067-er9-production-promotion-proof`,
reported 23/23, with
268/268 production specs and 2/2 app syntax checks. Record 066 remains
immutable invalid because `spawn EPERM` occurred before any production test
began and supplies no acceptance evidence.

Post-promotion audit qualification: record 067 validated production schemas
that expose unit-suffixed scalar properties at durable boundaries. That
conflicts with the governing production design and makes its production-
conformance proof insufficient. The record remains immutable and must not be
amended or rerun.

Post-rollback qualification: the checked items below describe what record 067
attempted and reported, not current production ownership. The removed scalar
schemas will not be corrected in place. The Algorithm32 production plan owns a
new additive contribution-cache implementation.

- [x] Decide promotion scope independently for typed source providers,
  visibility/pixel integration, CPU reference tooling, and assembled
  GPU/browser work: select the generic typed/CPU seam and canonical Sun owner;
  do not select assembled visible-celestial GPU/browser work.
- [x] Select no assembled visible-celestial GPU/browser slice; GPU build and
  CPU/GPU visible-celestial parity are explicitly N/A for ER9.
- [x] Prove CPU, descriptor, shader-illumination, and visible-disk bindings use
  the same fingerprinted canonical Sun packet without claiming assembled GPU
  raster/composition parity.
- [x] Keep existing GPU atmosphere evaluation independent; do not upload CPU
  atmosphere answers.
- [x] Prove the selected CPU/production spectral values, conservation,
  operation ordering, and depth within the predeclared tolerances.
- [x] Record XA-G12 as not applicable because ER9 promotes no assembled GPU
  slice.
- [x] Copy accepted behavior into production ownership without a runtime
  dependency on reconciliation.
- [x] Document the accepted records, contracts, provenance, numerical limits,
  and deferred observer/diffuse work in production ownership.
- [ ] Complete the production cache design's field/resource qualification gate,
  then implement its selected provider, artifact, resource lifecycle, and exact
  shader addition without a reconciliation runtime dependency or double
  transport.
- [ ] Execute a fresh numbered production proof that enforces unit-bearing
  durable boundaries and applicable visible-celestial GPU/browser parity.

## Evidence And Failure Routing

Every substantive phase uses a fresh record containing its goal, inputs,
commands, source/code hashes, equations, predeclared criteria, diagnostics,
results, and independent status classifications.

Reject and route to the owning phase when quantity, units, basis, provenance,
binning, conservation, invariance, transport ordering, source-independent
display, ephemeris, isolated reproduction, or convergence fails. Preserve the
attempt and create a fresh record; do not weaken a criterion after seeing the
result.

## Reset Exit Checklist

- [x] Typed SI point and extended source measures are accepted.
- [x] Exact pixel solid angle and normalized point response conserve flux.
- [x] Analytic extended disk/body integration conserves flux.
- [x] Any distinct resolved/collapsed runtime paths converge across the camera
  matrix, or the accepted runtime declares one conservative path only.
- [x] Physically typed frozen-atmosphere composition is accepted.
- [x] ER4C proves full-frame exact-direction point/extended transport,
  visibility, response/integration, and one final display pass.
- [x] One calibrated star, the source-owned Sun disk, and the globe Moon pass
  independent physical-reference gates.
- [x] The San Jose/Union real-scene matrix passes without source-specific
  tuning.
- [x] The visibility claim is explicitly bounded out through record 059.
- [x] CPU numerical convergence is bounded and reset-invalid POC behavior is
  removed.
- [ ] Record 067's selected production copy was rolled back. The Reset Exit
  requires the successor camera-independent transported contribution fields,
  live ray/raster query, exact pre-Color shader addition, unit-bearing durable
  boundaries, and a fresh applicable GPU/browser parity proof.

The observer-independent CPU reset-exit conditions are complete. Production
conformance is not complete after the audit and rollback. The selected cache
extension is owned by the Algorithm32 production topic. Any later
observer/background, diffuse-field, or additional object-specific production
work requires explicit scope and a fresh numbered record.
