# M2 Calibration And Evidence Plan

Status: Milestone 2 tracker closed for M2 POC acceptance by
`tmp/atmosphere/reconciliation/050-m2-closeout`. Deferred production/shader
items remain tracked here. Initial tracking snapshot recorded in
`tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward`; the
north-polar azimuthal-equidistant projection source decision is recorded in
`tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision`; the
atmosphere-boundary ownership correction is recorded in
`tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership`; cutoff
tolerance justification guidance is recorded in
`tmp/atmosphere/reconciliation/020-m2-cutoff-tolerance-justification`; POC
runtime boundary diagnostics policy is recorded in
`tmp/atmosphere/reconciliation/021-m2-poc-runtime-boundary-diagnostics` and
generalized by
`tmp/atmosphere/reconciliation/022-m2-general-runtime-boundary-policy`;
flat/local path-integration convergence planning is recorded in
`tmp/atmosphere/reconciliation/023-m2-path-integration-convergence-plan`; the
pre-asset experiment gate is recorded in
`tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate`. Subgoals 2.1
through 2.5 have now produced implementation records
`025-m2-flat-geometry-profile` through
`030-m2-local-flat-assets-quick-rerun`, follow-up warning/stack records
through `039-m2-warning-fix-six-column-stack`, and observer-centered finite
dome image records `040-m2-observer-centered-dome-local-flat-assets` and
`041-m2-observer-centered-dome-side-by-side-stack`, followed by the
observer-dome diff stack `042-m2-observer-centered-dome-diff-stack`, the
summer-solstice closest-approach latitude sweep
`043-m2-summer-solstice-latitude-skydomes`, and the north-up synchronized-noon
flat/spherical comparison set
`044-m2-synchronized-noon-flat-spherical-skydomes`, plus the Greenwich-noon
captioned flat/spherical comparison set
`045-m2-greenwich-noon-flat-spherical-skydomes`, plus the current
45-degree-east-noon default variant
`046-m2-45east-noon-flat-spherical-skydomes`, plus the North Pole GMT
four-hour sweep `047-m2-north-pole-summer-solstice-gmt-sweep`, plus the South
Pole GMT four-hour sweep `048-m2-south-pole-winter-solstice-gmt-sweep`, plus
the Union Glacier Final Experiment GMT sweep
`049-m2-union-glacier-final-experiment-gmt-sweep`; Subgoal 2.6 closeout is
recorded in `050-m2-closeout`.
The current flat-domain design direction is that a finite flat-world profile
should exit against a spherical dome with an explicit horizontal center,
rather than relying on a single scalar no-hit cap. For M2 skydome inspection,
the preferred center is observer-centric: the dome axis runs through the
observer footprint, so the finite sky domain is radial around the rendered
view point. The primary extent for that profile is the furthest observer view
ray length, matching atmosflat Step 018's round-equivalent artificial cap
footprint, not a global map radius and not the cap sphere's mathematical
radius. A map-centered dome remains a possible full-world profile, not the
default skydome-inspection profile. More broadly, geometry should resolve ray
lengths by candidate-distance selection across ground/top planes, dome
spheres, optional radial map extents, supplied scene/hit/max distances, and
source-owned path limits. The observer-centered dome view-ray extent is one
spherical candidate in that resolver, not a standalone renderer cap. This is
now implemented for the M2 skydome POC profile in record 040 and rendered in
records 040 through 044. The change moves local/flat skydome artifacts away from
atmosflat Step 018, so image review becomes subjective model-inspection and
error-spotting backed by selected-ray diagnostics rather than pixel parity.
The dome truncates the unchanged
atmosphere composition; it does not compress, rescale, or remap the
altitude-based density and scattering profiles into the smaller edge volume. A
proper compressed atmosphere would be a separate three-dimensional
medium/composition model, not a one-dimensional altitude change. Reflective
dome properties are another future extension: they would turn the dome from a
pure exit boundary into an optical boundary/material, and are not part of M2
closeout.

This plan is the separate tracking surface for two things that should not get
lost inside implementation:

- values or behaviors that were previously supported by calibration and must
  be reproven by the reconciliation POC code;
- values or behaviors that still need external evidence, explicit model-policy
  classification, or deliberate deferral before they can support a Milestone 2
  acceptance claim.

Step 018 atmosflat sky domes are guide imagery only. Historical calibrated
outputs may be comparison inputs, but they are not proof by themselves.

## Tracking Rules

- Do not repeat the completed local reference-gap analysis. Carry forward and
  cite rows from `local-sun-flat-geometry-fact-inventory.md`,
  `unsourced-and-partially-sourced-facts.md`, and
  `post-step032-lane-source-audit.md`.
- A calibration-backed fact is accepted only after the reconciliation POC
  recomputes it from canonical M2 inputs and records diagnostics.
- External evidence gaps can close by finding a source, marking the value as
  named artificial model configuration, marking it as display/fixture policy,
  or deferring it out of M2 acceptance.
- Authored configuration such as false-Sun size, false-Sun placement, observer
  placement, and local time does not need external evidence to exist as
  configurable input. The tracked risk is only whether a particular default is
  sourced, intentionally selected as a named profile default, or kept as a
  fixture/calibration input.
- Resolved outputs such as source position, source distance, incident scale,
  and sky position are generated diagnostics, not copied constants.
- Human-visibility research can support display-facing cutoff choices, but it
  is secondary to spectral transport convergence. For no-hit sky-ray caps,
  prefer a convergence study over increasing path lengths, then optionally add
  a perceptual/display check using sourced contrast-sensitivity or color-
  difference thresholds.
- Any selected cutoff tolerance must be named and justified from recorded
  diagnostics. The justification order is spectral convergence first, then
  rendered-display visibility only after the display transform, view
  assumptions, and comparison metric are named.
- Falloff/transmittance/density-based negligible-contribution thresholds are
  transport/execution approximations, not geometry boundaries. They may reduce
  effective work only when named and convergence-backed; they must not alter
  geometry-resolved ray lengths, source-path boundaries, cache coordinates, or
  medium-domain descriptors. Distant-source paths have no finite
  source-distance limit and are clipped by the active medium/domain exit.
- The POC should not abort a long render for one unexpected per-sample boundary
  condition. Setup-time incompatibilities still fail before the run starts, but
  runtime cache misses, out-of-domain accesses, non-finite lookup/path facts,
  unresolved ray/source-path limits, or unexpected atmosphere-domain misses
  should return a safe contribution for the affected operation and record
  bounded error diagnostics that can fail acceptance after the run.
- Path integration controls for flat/local rays are experiment-backed
  execution configuration. Seed sweeps from the accepted Algorithm32 packets,
  but promote M2 values only after convergence records cover long shallow flat
  rays, geometry ray-length candidate selection, source-path clipping cases,
  observer-centered dome exits, optional map extents, supplied max distances,
  any interim no-hit caps, and cache-access edges.
- Basic local/flat CPU wiring must run before the pre-asset experiments, and
  real skydome/image asset generation must wait until those experiments have
  produced or classified the required numerical, boundary, cutoff, and
  cache/handoff evidence.

## Human-Visibility Source Notes

These sources may support display-facing cutoff decisions after spectral
transport convergence is already demonstrated:

- National Research Council Committee on Vision, "Contrast Sensitivity
  Function," NCBI Bookshelf / National Academies Press:
  https://www.ncbi.nlm.nih.gov/books/NBK219042/. Use this for the principle
  that visible detection depends on contrast, spatial frequency, and viewing
  conditions; it is not a single absolute pixel or radiance delta.
- Gaurav Sharma's CIEDE2000 implementation notes and supplementary test data:
  https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/. Use this only as a
  software-validation trail if a rendered-output color-difference check is
  added; the page explicitly says it is not an official CIE implementation.

Tolerance selection should record both the physics-facing threshold and any
display-facing threshold. A display-facing threshold can justify why residual
differences are unlikely to matter visually, but it must not hide spectral
non-convergence.

## Calibration Reproof Tracker

| ID | Item | Existing support | Reconciliation-code proof needed | Closeout state |
| --- | --- | --- | --- | --- |
| `cal-001` | Closest-approach local-source calibration: `referenceSpectralIncidentScale = targetClosestIncidentScale / closestFalloff`. | `local-013`, local inventory calibration rows, atmosflat/local-source lineage. | A focused M2 runner recomputes closest distance, falloff, target scale, and resulting spectral incident scale from selected M2 config. | Recomputed by record `026-m2-local-sun-source`; closeout still needs to decide whether this seed calibration is promoted, replaced, or kept as model policy. |
| `cal-002` | Brightness/source-power replacement for raw `solarIrradianceScale: 58`. | `local-006b`, atmosflat `018` provenance, accepted model calibration history. | Decide the M2 calibration rule, then recompute source scale from that rule. Raw `58` must remain provenance or fixture input, not proof. | Record `026-m2-local-sun-source` proves the new POC uses the calibrated seed scale and not raw `58`; final unit-bearing source-power policy is deferred to `cal-008`. |
| `cal-003` | Reference distance and target closest incident scale. | `local-006a`, `local-013`. | Record whether these are authored calibration inputs or replaced by a radiance/solid-angle/transmittance rule; generate diagnostics from the selected rule. | Record `026-m2-local-sun-source` regenerates diagnostics from the seed rule; final classification as authored calibration input versus replacement remains pending. |
| `cal-004` | Source-time anchor and local orbit synchronization. | `local-012`, local-source scene labels. | Recompute any retained time labels from a cited solar-position policy, or classify the time anchor as artificial calibration/display policy. | Classified for M2 as artificial clock/orbit synchronization policy and subjective display labeling; production precision remains separate work. |
| `cal-005` | Derived local-source outputs: `positionMeters`, `distanceKm`, `observerIncidentScale`, `referenceSpectralIncidentScale`, `skyPosition`, rotated longitude. | `local-016`. | Prove these are regenerated from canonical config in the new code; compare historical values only as diagnostics. | Records `025-m2-flat-geometry-profile`, `026-m2-local-sun-source`, and scene-set records through `049` regenerate source-relative distance, incident-scale, sky-position, and time-sweep diagnostics from M2 seed config. |
| `cal-006` | Local source neutral spectral scale and stale tint exclusion. | `local-017`, local-second-order `095-local-source-neutral-white-stack`. | Recreate the no-tint behavior or guard against stale tint fallback in the new POC path. Non-neutral spectrum requires a backed spectral model. | Record `026-m2-local-sun-source` verifies neutral/no-tint spectral scaling in the M2 POC path; final production guardrail remains pending promotion closeout. |
| `cal-007` | Preferred local-source brightness calibration anchor: local solar noon at the source latitude. | New M2 design note and latitude-sweep calibration packet. | Decide whether this becomes the default local-source calibration policy. If accepted, calibration derives source power once at the source-latitude solar-noon reference event; other observer rows use clock synchronization or orbit offsets rather than per-observer recalibration. | Accepted as M2 POC calibration policy and exercised by records `043` through `049`; production replacement is tracked by `cal-008`. |
| `cal-008` | Production local-source radiometric calibration should replace the POC unitless incident-scale bridge. | User design note after records 047/048; local inventory rows for planned radiance/solid-angle/transmittance calibration. | Define unit-bearing source brightness for production. The current POC uses dimensionless `referenceSpectralIncidentScale` and computes `incidentRadiance(lambda) = canonicalSolarIrradiance(lambda) * referenceSpectralIncidentScale * falloffScale`; this is a calibration bridge, not source radiance. Production should choose a target sea-level direct normal irradiance directly under the finite Sun at the calibration event, account for source-path transmittance and apparent solid angle/finite-source geometry, and derive fixed source spectral radiance or power for a given configured Sun altitude/size. The derived value should be calculated or invalidated when relevant user/profile configuration changes, then consumed as resolved source configuration by transport, cache building, and shader setup. | Carry forward to production design. Do not promote `referenceSpectralIncidentScale`, raw `solarIrradianceScale`, or per-observer recalibration as source physics. M2 can keep the bridge for subjective inspection until the radiometric calibration is sourced and fixture-backed. |

## Configuration, External Evidence, Or Model-Policy Tracker

| ID | Item | Existing gap rows | Needed before M2 closeout | Closeout state |
| --- | --- | --- | --- | --- |
| `ext-001` | Combined flat z-up atmosphere plus finite false Sun. | `local-001`. | Name as artificial Algorithm32 extension profile; do not present as real-world source-backed geometry. | Tracked by record `017-m2-reference-gap-carry-forward`; closeout pending. |
| `ext-002` | Flat atmosphere/profile top boundary: `60000 m` versus `100000 m`. | `local-002`. | Pick M2 profile value and classify it as sourced, model config, or deferred. Geometry needs the active boundary to calculate ray exits, but does not choose it. | M2 seed `100000 m` selected by record `017-m2-reference-gap-carry-forward`; owner corrected by record `019-m2-atmosphere-boundary-ownership`; final closeout pending. |
| `ext-003` | No-hit sky-ray cap `1926774 m`. | `local-003`. | Treat as an interim renderer/view-ray policy outside core physics, source paths, and cache bounds. The stronger flat-world model replaces scalar no-hit caps with geometry-owned atmosphere exits against the finite dome/domain profile. For M2 skydome inspection, that profile is observer-centered. Any retained scalar cap is now a legacy fallback/diagnostic seed and must not be promoted as atmosphere extent. | Record `028-m2-pre-asset-experiments` produced cap-sweep diagnostics; records 038/039 plus radial probing showed a sharp near-rim artifact consistent with scalar-cap discontinuity; record 040 implements the observer-centered finite dome for the M2 skydome profile, and record 041 provides the no-diff guide/new stack. No final cutoff tolerance is promoted. |
| `ext-004` | Round-equivalent skydome cap footprint / max observer view-ray extent `875656.6450361694 m`. | `local-004`. | Treat as historical skydome evidence for the observer-centered view-domain extent. It must not leak into source transmittance as a magic distance; express it as `maxObserverViewRayExtentMeters` for the M2 skydome profile, with sphere center/radius and per-ray exit distances derived from observer height and dome apex altitude. In atmosflat Step 018, the view-cap apex was the round-equivalent `60000 m`, while the separate flat atmosphere/source-path top plane was `100000 m`. | Implemented as `M2_LOCAL_FLAT_OBSERVER_CENTERED_DOME.maxObserverViewRayExtentMeters` in record 040; direct probe derived sphere center `[0, 0, -6360000]`, radius `6420000`, zenith distance `59998`, and horizon distance `875656.6450361694`. Accepted as M2 skydome-profile configuration only, not production in-world geometry. |
| `ext-005` | Observer altitude/defaulting, including `[0, 0, 2] m` fixture. | `local-005`, `local-008`. | Treat observer placement as explicit view configuration or fixture; app-side altitude derivation remains outside Algorithm32. Only defaulting/provenance needs closeout. | Tracked by record `017-m2-reference-gap-carry-forward`; configuration role accepted, defaulting closeout pending. |
| `ext-006` | Configurable false-Sun size and altitude defaults: altitude `3000 mi`, radius `16 mi`, diameter `32 mi`. | `local-006`, `local-010`. | Treat Sun size and placement as authored profile configuration with canonical units, ranges, and diagnostics. Recover source trail only for the default values, or classify them as steel-man profile defaults. | M2 kilometer seed values selected by record `017-m2-reference-gap-carry-forward`; configuration role accepted, default provenance/policy closeout pending. |
| `ext-007` | Configurable false-Sun longitude/phase `58.1137 deg`. | `local-006a`. | Treat longitude/phase as authored model or calibration configuration. Source trail is needed only if this exact default is promoted as more than a named profile/calibration default. | Tracked by record `017-m2-reference-gap-carry-forward`; configuration role accepted, default provenance/policy closeout pending. |
| `ext-008` | Annual latitude migration and date anchor. | `local-007`, `local-012`. | Pin astronomical source concepts and label simplified cosine/date-anchor rule as model behavior. | Tracked by record `017-m2-reference-gap-carry-forward`; closeout pending. |
| `ext-009` | Mean Earth radius `6371.0088 km` and north-polar azimuthal equidistant projection. | `local-009`, `local-011`. | Projection choice is settled as north-polar azimuthal equidistant, sourced to PROJ `+proj=aeqd` with `lat_0`/`lon_0` projection-center parameters and optional spherical radius `+R`. The needed radius is the spherical AEQD projection radius, not an equatorial or polar radius. Geometry may use it to derive the finite projected Earth disk/domain, `projectionSphereRadiusMeters * pi`, for inside-domain and ground-hit decisions. Source as a mean spherical Earth radius, likely the IUGG/NGA arithmetic mean radius family, and pin the exact selected rounding or replace with a cited value. | Projection source/choice recorded by `018-m2-north-polar-aeqd-source-decision`; radius purpose now classified as projection/domain scale; source-precision closeout pending but expected to be straightforward. |
| `ext-010` | Inverse-square falloff and apparent angular radius. | `local-019`, `local-020`. | Cite or derive equations, then apply them only to configured source radius/distance. | Tracked by record `017-m2-reference-gap-carry-forward`; closeout pending. |
| `ext-011` | Finite local-source path clipping by flat top/ground. | `local-021`. | Add geometry-owned request/result descriptors, analytic fixtures, and diagnostics. Keep source-owned finite path limits separate from light-source falloff and from any negligible-contribution cutoff. Distant-source paths should have no finite source-distance limit and should clip to the active medium/domain exit. | Records `025-m2-flat-geometry-profile` and `028-m2-pre-asset-experiments` add geometry-owned source-path fixtures and diagnostics; final descriptor polish remains closeout work. |
| `ext-012` | Local L2 cache grid, direction count/range, nearest-neighbor lookup, and runtime miss behavior. | `cache-001` through `cache-005`. | Rerun direct/oracle and convergence checks before promoting exact defaults; otherwise keep as execution config. Setup-time descriptor mismatches must reject the cache before rendering. POC runtime misses or out-of-domain lookup conditions should degrade to safe empty/zero contribution with bounded error diagnostics, not abort the whole render. | Record `028-m2-pre-asset-experiments` builds 315 local cache coordinates and selected direct/oracle delta 0; exact bins/counts/lookup remain execution config pending convergence/promotion closeout. |
| `ext-013` | Display fixtures: scene lights, terrain, stars, render scale, camera fit, labels. | `display-001` through `display-005`. | Keep outside transport unless a later display policy promotes them explicitly. | Tracked by record `017-m2-reference-gap-carry-forward`; display-policy closeout pending. |
| `ext-014` | Coordinate handoff assertions for geometry/world, atmosphere, light-source-relative, and cache coordinates. | `local-001`, `local-011`, `cache-001`, `cache-002`. | Add diagnostic checks that cache-access facts are available from runtime path points, use the bound descriptor's coordinate system, and do not require geometry-relative values where source-relative cache coordinates are expected. Unexpected runtime boundary failures use the POC diagnostic-degradation policy; setup descriptor mismatches still fail before a render starts. | Records `025-m2-flat-geometry-profile` and `028-m2-pre-asset-experiments` emit coordinate-handoff diagnostics through the M2 POC classes; closeout should decide if more edge fixtures are needed. |
| `ext-015` | General POC runtime boundary diagnostics for unexpected per-sample failures. | `local-002`, `local-003`, `local-021`, `cache-001` through `cache-005`. | Apply log-and-continue to any unexpected runtime boundary condition after setup has produced a valid run context. Examples include ray/source-path bounds, atmosphere-domain misses, cache lookup misses, out-of-domain coordinates, and non-finite path/access facts. Return a safe contribution for the affected operation, record bounded error diagnostics, and let post-run acceptance decide whether the run is valid. | Implemented in the M2 flat geometry/local cache path and exercised by record `028-m2-pre-asset-experiments`; accepted as POC runtime-boundary policy for M2. |
| `ext-016` | Flat/local path integration controls: view-ray sample count, source-transmittance sample count, interval spacing, and convergence criteria. | `base-005`, `local-002`, `local-003`, `local-021`. | Find values experimentally. Sweep path and source-transmittance interval counts from existing Algorithm32 seed packets, compare against higher-resolution reference runs, and include hard rays: low-altitude near-horizon, rays exiting through the observer-centered dome boundary, historical long no-hit capped diagnostics, toward/away local source, source-path ground/top/dome clipping, optional map-extent exits, supplied max-distance truncation, near atmosphere top, and cache-domain edges. Keep endpoint/trapezoid spacing unless a recorded convergence experiment justifies another spacing rule as an explicit algorithmic change. If a negligible-contribution cutoff is tested because falloff, transmittance, density, or another integrand factor makes later samples irrelevant, classify it as an execution approximation and prove it does not redefine geometry ray length. Promote only named runtime and validation packets whose spectral radiance/transmittance deltas fall below selected criteria. | Record `028-m2-pre-asset-experiments` produced first convergence diagnostics; no final runtime/validation packet is promoted yet. |
| `ext-017` | Pre-asset experiment gate before real local/flat asset generation. | `ext-003`, `ext-011`, `ext-012`, `ext-014`, `ext-015`, `ext-016`. | After basic local/flat CPU wiring exists, run and record the pre-asset experiments before generating Step 018-style skydome or image assets: path integration convergence, geometry ray-length candidate-selection checks, observer-centered dome exit and any interim no-hit cutoff convergence, coordinate handoff/runtime-boundary diagnostics, and local cache direct/oracle edge checks if local L2 is enabled. Asset generation may proceed only after each item is accepted, classified, deferred out of the asset claim, or explicitly recorded as unresolved without being used for acceptance. | Gate run completed in `028-m2-pre-asset-experiments`; diagnostic assets generated in records `029` and `030` without using unresolved items as exact acceptance claims. |
| `ext-018` | Finite flat-world dome atmosphere domain. | User design decision during M2 blue-ring investigation; supersedes scalar no-hit cap as the preferred long-term model. | Define a geometry-owned atmosphere-domain descriptor with explicit dome center policy. For M2 skydome inspection, use an observer-centered dome whose axis runs through the observer footprint. Its primary extent is `maxObserverViewRayExtentMeters`, the furthest ray length from the observer, so the sky dome demonstrates what that observer sees. A map-centered dome is a separate full-world variant. For observer altitude `oz`, dome apex altitude `H`, and max observer extent `D`, derive `centerZ = (H^2 - oz^2 - D^2) / (2 * (H - oz))` and `sphereRadius = H - centerZ`. For each unit view direction `d`, with observer `O`, sphere center `S`, `Q = O - S`, `b = dot(Q, d)`, and `c = dot(Q, Q) - sphereRadius^2`, derive `tDome = -b + sqrt(b^2 - c)` for the observer-inside-dome exit root, then exit view rays at the first ground/profile/dome/map boundary declared by the active profile. The zenith-angle equivalent is `tDome(theta) = -h * cos(theta) + sqrt(sphereRadius^2 - h^2 * sin(theta)^2)`, with `h = oz - centerZ`, `tZenith = H - oz`, and `tHorizon = D`. The dome truncates the existing altitude-based atmosphere composition; it does not compress or rescale density, scattering, or absorption profiles near the edge. A real compressed-atmosphere variant would require a separate three-dimensional medium/composition model. | Implemented in `FlatEarthGeometry` and `M2_LOCAL_FLAT_OBSERVER_CENTERED_DOME` by record 040; accepted as M2 skydome-profile evidence. Map-centered/full-world behavior remains deferred to `ext-025` and production/shader verification. |
| `ext-019` | Reflective dome optical boundary. | User follow-up idea during M2 dome/domain discussion. | Keep out of the current truncation model. If pursued, define a boundary material/profile that receives geometry-resolved dome hits and contributes reflected/transmitted radiance with explicit wavelength and angular behavior. Do not hide reflection in geometry intersection or altitude sampling. | Future extension only; no M2 implementation or acceptance claim. |
| `ext-020` | Additional San Jose-longitude summer-solstice latitude skydome set. | User request during M2 subjective review planning; uses existing M2 local/flat seed projection/calibration and the documented `annual-tropic-migration` source-latitude setup. | Keep as subjective model-inspection material. The set uses San Jose longitude, observer latitudes `80N`, `30N`, equator, `30S`, and `80S`; resolves source latitude from `annual-tropic-migration` at `2026-06-21T12:00:00-07:00` to `23.5 deg N`; then applies closest-horizontal-approach rotation for each row. Brightness is calibrated once at that same `23.5N` source latitude and San Jose longitude, representing the local solar-noon/subsolar reference event, and the resulting reference spectral incident scale is reused for all five rows. It does not replace the Step 018 rotation set and has no guide-image parity target. | Rendered in record `043-m2-summer-solstice-latitude-skydomes` as five 320px PNGs; accepted as subjective M2 inspection material only. |
| `ext-021` | Synchronized-noon flat/spherical latitude skydome set. | User request following record 043; reuses the same latitude list, San Jose longitude, source-latitude brightness calibration, and summer-solstice source latitude, then adds a matched spherical distant-source render for each row. | Keep as subjective model-inspection material. The set synchronizes all rows to the same solar-noon clock by setting the source subpoint longitude to the common San Jose meridian. It maps north-polar AEQD source/observer positions into an observer-local `x=east`, `y=north`, `z=up` frame so north is up in all flat and spherical source images. The spherical comparison uses the distant-source noon direction for the same source latitude, common longitude, and observer latitude rather than apparent-angle-matching the finite flat source. | Rendered in record `044-m2-synchronized-noon-flat-spherical-skydomes`; accepted as subjective M2 inspection material only. |
| `ext-022` | Greenwich-noon flat/spherical latitude skydome set with Sun captions. | User request after record 044 to avoid straight north/south Sun placement: synchronize the clock at longitude `0`, keep the render longitude at San Jose, and indicate Sun azimuth/altitude for each image. | Keep as subjective model-inspection material. The set uses the same latitude list, summer-solstice source latitude, north-up east/north/up frame, and shared brightness calibration, but source subpoint longitude is `0` while observer longitude remains `-121.8863`. Stack captions use compass azimuth clockwise from north and altitude above the horizon for every flat and spherical source image. | Rendered in record `045-m2-greenwich-noon-flat-spherical-skydomes`; accepted as subjective M2 inspection material only. |
| `ext-023` | 45-degree-east-noon flat/spherical latitude skydome set with Sun captions. | User request after the longitude-offset review: set the reusable synchronized clock longitude to 45 degrees east of San Jose so the Sun is off the north/south meridian while remaining above the spherical horizon through `30S`. | Keep as subjective model-inspection material. The set uses the same latitude list, summer-solstice source latitude, north-up east/north/up frame, and shared brightness calibration, but source subpoint longitude is `-76.8863` while observer longitude remains `-121.8863`. This supersedes the Greenwich-noon set as the runner default, but does not replace records 044 or 045 as historical evidence. | Rendered in record `046-m2-45east-noon-flat-spherical-skydomes`; accepted as subjective M2 inspection material only. |
| `ext-024` | Polar GMT four-hour flat/spherical skydome sweeps. | User requests after record 047 planning: render the North Pole on `2026-06-21` every four hours from `00:00 GMT`, then render the South Pole winter 2025 counterpart. | Keep as subjective model-inspection material. The North set uses latitude `90N`, longitude `0`, sea-level elevation, source latitude `23.5N`, and source subpoint longitudes derived from the UTC clock as `180`, `120`, `60`, `0`, `-60`, and `-120`. The South set uses latitude `90S`, longitude `0`, date `2025-12-21`, the same UTC cadence, source latitude about `23.4995S`, and its own winter source-latitude calibration. Brightness is calibrated at the source latitude, longitude `0`, and local solar noon for each set. At the poles, local north/east is the chosen longitude-0 ENU frame, so azimuth labels are frame diagnostics rather than a unique geographic bearing. | North set rendered in record `047-m2-north-pole-summer-solstice-gmt-sweep` as six flat 320px PNGs, six spherical 320px PNGs, and a captioned `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`; South set rendered in record `048-m2-south-pole-winter-solstice-gmt-sweep` with the same artifact shape. |
| `ext-025` | In-world finite-domain edge-view verification. | User review after records 043 through 048: observer-centered diagnostic skydomes are not representative of final in-world flat geometry near map/domain edges. | Add explicit CPU and shader verification for a user placed near the finite flat-world southern boundary. The in-world geometry must use the actual projected user position inside a map/world-centered domain, not an observer-centered skydome domain. South-facing near-horizontal view rays should exit the atmosphere/domain almost immediately and produce little atmospheric in-scattering; upward south-facing rays should gain path length gradually; north/east/west directions should retain their own geometry-resolved path lengths. Geometry should report boundary-hit classification such as ground, top atmosphere, physical dome, map edge, or transparent atmosphere exit so transport and shader code can distinguish atmosphere truncation from opaque/reflective boundary behavior. | Pending. Treat current observer-centered M2 skydomes as diagnostic inspection artifacts only, not final in-world shader acceptance evidence. Add this case before claiming local/flat production or integrated shader readiness. |
| `ext-026` | Union Glacier Final Experiment GMT flat/spherical skydome sweep. | User request based on the December 14-17, 2024 Final Experiment trip to Union Glacier Camp and its 24-hour Sun video context. User supplied coordinates latitude `79.768036S`, longitude `83.261666W`; camp elevation is seeded as `700 m` from Union Glacier Camp location metadata. | Keep as subjective model-inspection material. The set renders Union Glacier Camp at latitude `-79.768036`, longitude `-83.261666`, elevation `700 m`, on `2024-12-15`, every four hours from `00:00 GMT` through `20:00 GMT`. It resolves the false-Sun latitude through the documented `annual-tropic-migration` model for each render time; the shared brightness calibration is at `2024-12-15T12:00:00Z`, directly under the migrated source latitude on longitude `0`, sea-level elevation. The calibration source latitude resolves to about `23.4258S`, with `referenceSpectralIncidentScale = 1.0117141056`. | Rendered in record `049-m2-union-glacier-final-experiment-gmt-sweep` as six flat 320px PNGs, six spherical 320px PNGs, and a captioned `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`. The shell command timed out after printing an accepted result, but the record contains accepted criteria JSON, all PNGs, and the final stack. |

## Record Expectations

The first M2 record should include this plan or a record-local snapshot of its
tables. Later records should update closeout states by citing the record that
proved, classified, deferred, or rejected each item.

## Milestone 2 Closeout

Record `tmp/atmosphere/reconciliation/050-m2-closeout` closes Milestone 2 as
a CPU local/flat method-confidence POC milestone. The accepted M2 scope is the
concrete `FlatEarthGeometry`, `LocalSunLightSource`, optional
`LocalSunIncidentRadianceCache`, CPU local/flat transport through the
Milestone 1 evaluator/calculator, pre-asset diagnostics, and subjective
inspection imagery through record 049.

Accepted for M2 POC evidence:

- `cal-001` through `cal-007` are accepted or classified as M2 POC calibration
  evidence/model policy where records 026, 028, and 043 through 049 regenerated
  or consumed the selected calibration behavior.
- `ext-001` through `ext-018` are accepted or classified for M2 POC purposes:
  the POC uses north-polar AEQD flat geometry, supplied atmosphere/profile
  boundaries, bounded runtime diagnostics, selected pre-asset checks, and the
  observer-centered finite dome skydome profile.
- `ext-020` through `ext-024` and `ext-026` are accepted as subjective
  inspection imagery, not exact parity targets.

Deferred or excluded from the M2 acceptance claim:

- `cal-008` remains production work: replace the POC
  `referenceSpectralIncidentScale` bridge with unit-bearing local-source
  radiometric calibration calculated on relevant configuration changes.
- `ext-019` remains future work: reflective/transmissive dome optical boundary
  behavior.
- `ext-025` remains production/shader verification work: map/world-centered
  in-world finite-domain edge views, including the near-southern-edge
  low-scattering south-horizon case.
- Exact Step 018 pixel parity, final local/flat numerical controls, final
  local cache defaults, final false-Sun default provenance, and production
  local/flat readiness are not promoted by M2.
