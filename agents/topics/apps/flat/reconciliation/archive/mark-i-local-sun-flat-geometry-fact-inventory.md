# Local Sun Flat Geometry Fact Inventory

Status: initial reconciliation intake inventory. This is not the final
parameter ledger.

This note inventories the facts used by the local Sun / flat-geometry
implementation and separates source-backed facts from accepted experimental
facts, artificial model choices, and display fixtures. The key reconciliation
rule is that the combined flat world is not a real-world physical model: a
finite false Sun, flat z-up atmosphere, and million-meter sightlines can use
source-backed pieces, but the assembled model must be treated as a named
Algorithm32 extension profile rather than as an externally validated Earth
atmosphere.

The app purpose matters here. The flat app is meant to steel-man the flat Earth
model and let a user change model parameters to inspect their real-world
consequences. Therefore local Sun and flat-geometry configurability is product
intent, not a provenance flaw. Reconciliation should source the physical and
mathematical algorithms that act on user/model configuration, record defaults
and ranges honestly, and make geometry-driven consequences visible instead of
tuning them away.

## Support Labels

- `source-backed candidate`: external source found for the equation, unit, or
  domain concept, but the value still needs final ledger citation format.
- `Algorithm32 baseline`: inherited from the accepted Step 032 / Algorithm32
  profile and should trace through the Step 032 audit.
- `accepted experiment`: supported by accepted Algorithm32 POC evidence, not
  by an external physics reference.
- `artificial model parameter`: valid only as part of a named local-source or
  flat-geometry model, not as a real-world constant.
- `display fixture`: affects review images, Three scene lighting, terrain,
  stars, camera setup, or capture process, not Algorithm32 transport physics.
- `missing source`: no adequate external source or accepted decision has been
  found yet.

## Immediate Conclusions

- The local Sun stack is supportable only if it is named as an artificial
  source/geometry extension. We can externally source some sub-equations, but
  not the full false-Sun flat-world construction.
- Reconciliation must keep three categories separate: user/model configuration,
  sourced or accepted algorithms that act on that configuration, and resolved
  derived outputs. A configured false-Sun altitude is not the same kind of fact
  as the inverse-square law; a resolved source position is not a constant and
  should be regenerated from the authored inputs. That resolved position can
  reasonably be a geometry-owned derived fact when the selected geometry owns
  the frame, projection, orbit/time resolver, or source placement rule.
- Local finite-source behavior should be separable from flat geometry. A
  local source ought to run with spherical geometry when supplied the required
  source and view configuration; if it cannot, reconciliation should treat
  that as a light/source versus geometry boundary gap to classify before
  deciding whether the problem is missing data, missing resolver behavior, or
  improper coupling.
- Separation does not mean geometry-blindness. The amount of light from a
  finite source legitimately depends on geometry-resolved facts such as frame,
  source position, sample position, distance, apparent size, path clipping, and
  calibration reference event. The boundary should be explicit data flow:
  geometry may supply the resolved source position plus plain
  frame/sample/path facts, light/source resolves radiance or incident scale
  from those facts, and neither side reaches into the other's private model.
- The largest source gap is not "find a real-world source for false-Sun
  values." It is defining which knobs are user/model configuration, which
  defaults seed the steel-man profile, which equations are source-backed, and
  which diagnostics show the resulting consequences.
- User view placement belongs in the configuration category. Algorithm32
  receives view latitude, longitude, local time, and view altitude as
  configuration. How the app derives or defaults altitude is separate upstream
  policy. Historical observer heights remain fixtures unless the app
  intentionally passes them as configuration.
- The projection choice is settled for Milestone 2 as north-polar azimuthal
  equidistant. Record
  `tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision`
  sources the AEQD projection identity and parameters to PROJ. Legacy flat
  docs confirm the north-polar use was a deliberate flat/flat simulation
  choice, and that generated flat scene coordinates are render endpoints in a
  flat-world hypothesis, not an Earth-validation model.
- Source-backed pieces found so far: NOAA-style equation-of-time / solar-noon
  calculations, NREL Solar Position Algorithm as a higher-precision future
  option, azimuthal-equidistant projection mechanics, point-light inverse-square
  falloff, and Three `Data3DTexture` as a GPU storage API. Exact
  mile-to-kilometer conversion and Earth mean-radius constants are sourceable
  but still need authoritative final ledger citations.
- The default false-Sun altitude, size, and annual latitude migration should
  be treated as steel-man profile defaults with source-recovery tasks, not as
  known-unsourced constants. The missing work is to pin their sources,
  ownership, units, ranges, and user configurability.
- The largest remaining unsourced/model-only facts are false-Sun brightness or
  power, real-time synchronization for a model with no time standard,
  false-Sun longitude/phase, reference distance, target incident scale,
  calibration target, atmosphere top-altitude choice, flat sky-ray cap, local cache
  bins/direction count, terrain, stars, and Three scene-light intensity
  mapping. The calibration algorithm exists to bridge the brightness and
  time-anchor gap, not to source the default geometry.
- Local Sun degree inputs are orbit phase, not apparent sky elevation. A degree
  value means degrees traveled along the configured finite Sun's local orbit
  from closest approach; apparent altitude, azimuth, source position, lighting
  direction, and shadow direction are resolved outputs.
- The local L2 cache has useful accepted experimental support, but exact grid
  values remain execution configuration until reconciliation reruns convergence
  and CPU/GPU parity under finalized sourced parameters.
- The inherited RGB source tint was reversed in the latest accepted
  local-sun-second-order diagnostic, `095-local-source-neutral-white-stack`,
  by rerendering the accepted local-source stack with neutral white source
  scale. The old tint and rough RGB-to-spectral grouping are stale POC residue,
  not current local-lane behavior or production physics.

## Configuration Versus Resolved Facts

The local Sun ledger should not ask every number to have the same kind of
provenance. Some values are authored model configuration. They still need
ownership and defaults, but they are allowed to be "the selected false-world
profile says so" when the model is explicitly artificial. The equations that
consume those values need stronger support.

For user-authored configuration, the source requirement shifts from "prove this
value is real" to "prove the app applies it with correct math, clear units,
documented ranges, reproducible defaults, and honest diagnostics." This is what
lets a user vary the model and judge the consequences.

| Category | Examples | Promotion rule |
| --- | --- | --- |
| User/model configuration | View/root latitude, longitude, local time, view altitude, false-Sun latitude model limits, false-Sun longitude/phase, altitude, radius, source brightness or calibration target, reference distance, target reference incident scale or irradiance, real-time synchronization anchor, atmosphere top boundary, sky cap, cache grid, display exposure. | May be promoted only as named profile/configuration. The ledger should say who supplies it, units, allowed range, default source, and whether it is user-authored, app default, or accepted experiment. It should not be presented as a real-world physical constant unless separately sourced. |
| Source-backed or accepted equations acting on configuration | Azimuthal-equidistant projection math, local solar-noon/equation-of-time math, closest-approach rotation, ray-plane and source-path clipping, apparent angular radius, solid angle, small-disk limit, inverse-square falloff, Beer-Lambert transmittance, calibration equation. | Needs external source, source-backed derivation, or accepted Algorithm32 experiment. These are the "real facts" or accepted model rules that act on authored configuration. |
| Resolved derived outputs | `positionMeters`, `distanceKm`, `referenceSpectralIncidentScale`, `observerIncidentScale`, `skyPosition`, `sourceLongitudeDegrees` after rotation, cache keys, texture dimensions, selected local solar-time labels. | Do not treat as hand-authored constants. Store only when emitted as artifact evidence with input/config hashes and algorithm provenance; regenerate from canonical inputs in production. |
| Display/review configuration | Three light intensity scale, point-light `decay=0`, camera yaw/fit, terrain asset, star exposure, labels, render scale, antialiasing. | Keep outside Algorithm32 physics. Promote only as display/review policy or artifact recreation configuration. |

## Geometry And Long Sightlines

| Fact | Implementation trail | Current support | Reconciliation action |
| --- | --- | --- | --- |
| Flat geometry kind is `flat-z-up-atmosphere`; ground is `z=0`; altitude is `position[2]`; the atmosphere/profile supplies any top boundary such as `z=topAltitudeMeters` for geometry to intersect. | `shared/algorithm32/POC/source-contract/algorithm32-source-contract.js`; `shared/algorithm32/POC/atmosflat32/local-sun.js`; shader-lab/local L2 packets; record `019-m2-atmosphere-boundary-ownership`. | Accepted experiment plus M2 boundary correction. Plane and ray intersections are basic analytic geometry, but the flat atmosphere domain itself is an atmosphere/profile decision inside an artificial model. | Promote only as a named geometry plus atmosphere profile pairing. Geometry must not choose the atmosphere top altitude; it computes intersections when setup/request data supplies the active medium domain. |
| Density sampling uses the Algorithm32 exponential vertical profiles with flat altitude. | `shared/algorithm32/POC/cpu/algorithm32-transport.js`; `shared/algorithm32/POC/atmosflat32/local-sun.js`. | Algorithm32 baseline plus artificial flat projection. | Trace coefficients and scale heights through Step 032. Record the flat-altitude reuse as a model decision. |
| The POC contains both `topAltitudeMeters: 60000` and `topAltitudeMeters: 100000` defaults. Browser/local scenes and accepted shader-lab/local-source packets commonly use `100000`. | `createFlatZUpAtmosphereGeometry` path in `local-sun.js`; `scripts/flat/local-second-order/page/*`; `evidence/current/shader-094-*`; record `019-m2-atmosphere-boundary-ownership`. | Accepted POC behavior with unresolved final atmosphere/profile default. | Decide the production flat atmosphere/profile top boundary during reconciliation. If it is `100000`, record it as an atmosphere/model parameter or source it; if it is Step 032 top-minus-bottom, align with the Step 032 source trail. Geometry consumes this value for ray exits and clipping but does not own it. |
| Flat source-path transmittance integrates only the finite segment from sample to source, clipping by flat top and ground. Ground before source gives zero source transmittance. | `algorithm32-source-contract.js`; `atmosflat32/local-sun.js`; shader-lab source sample traces. | Accepted experiment plus analytic geometry. | Keep geometry-owned clipping. Record source path descriptor shape and ground/top failure states in the data-flow contract. |
| No-hit scene sky rays use `FLAT_SCENE_SKY_RAY_LIMIT_METERS = 1926774`. | `shared/algorithm32/POC/cpu/algorithm32-transport.js`; `scripts/flat/local-second-order/page/subjective-scenes.js`; shader uniforms; M2 records 038/039 and follow-up radial probing; record 040 finite-dome implementation. | Accepted experiment / interim renderer policy. The M2 blue-ring investigation showed the scalar cap can create a sharp near-rim discontinuity. Record 040 demotes the scalar cap to a legacy fallback/diagnostic seed for the M2 skydome profile. | Do not promote as atmosphere physics. The M2 skydome profile now uses geometry-owned observer-centered finite dome exit. |
| Earlier skydome-only round-equivalent observer cap used footprint radius `875656.6450361694 m`. | `evidence/current/atmosflat-018-local-skydomes/equations-and-constants.json`; M2 blue-ring probing; record 040 geometry probe. | Accepted atmosflat `018` renderer-scoped geometry and useful evidence for direction-sensitive horizon exits. This value is now expressed as `maxObserverViewRayExtentMeters`, the furthest observer skydome ray length, not the mathematical sphere radius. | Preserve as historical evidence for the Step 018 skydome view policy. In the M2 seed it lives in `M2_LOCAL_FLAT_OBSERVER_CENTERED_DOME.maxObserverViewRayExtentMeters`, with derived sphere center/radius instead of scalar scene-ray distance. |
| Finite flat-world atmosphere domain should use a spherical dome whose apex is the configured dome height and whose horizontal center policy is explicit. For M2 skydome inspection, the dome should be observer-centered: its axis runs through the observer footprint, and its primary extent is the furthest view ray from that observer. For observer altitude `oz`, max observer extent `D`, and apex height `H`, derive `centerZ = (H^2 - oz^2 - D^2) / (2 * (H - oz))` and `sphereRadius = H - centerZ`. For each unit view ray direction `d`, derive the exit as `tDome = -b + sqrt(b^2 - c)`, where `Q = O - S`, `b = dot(Q, d)`, and `c = dot(Q, Q) - sphereRadius^2`. | User design decision during M2 blue-ring investigation; analytic sphere-through-rim/apex geometry; atmosflat Step 018 round-equivalent artificial-cap evidence; records 040/041; edge-view follow-up tracked as `ext-025`; M2 closeout record 050. | Implemented and accepted for the M2 skydome POC profile. Record 040 uses `H = 60000 m`, `D = 875656.6450361694 m`, observer altitude `2 m`, derived center `[0, 0, -6360000]`, and radius `6420000`, then regenerates the five full-size local/flat skydomes. Record 041 shows atmosflat beside the new domes with no diff. A map-centered dome remains the expected full-world profile for in-world user placement. The atmosphere composition is not compressed into the dome; existing altitude-based density, scattering, and absorption profiles are only truncated by the finite geometry. A proper compressed atmosphere would be a separate 3D medium/composition model, not a one-dimensional altitude rescale. | Treat as accepted M2 inspection/error-spotting evidence only. Do not treat observer-centered skydomes as final in-world shader evidence near map/domain edges. Production/integrated shader verification must include a user near the southern finite-domain edge where south-facing near-horizontal rays exit almost immediately and therefore show little in-scattering. Atmosphere can still use altitude-only density samples initially; geometry owns the dome/domain exit boundary and should report boundary-hit classification. |
| Reflective dome properties are a possible future flat-world extension. | User follow-up idea during M2 dome/domain discussion. | Future extension only. Once reflective, the dome is no longer just a geometry exit; it becomes an optical boundary/material. | Keep out of M2 truncation. If pursued, add an explicit boundary-material/profile contract for reflected/transmitted radiance rather than hiding reflection in geometry or altitude sampling. |
| Observer position in flat local scenes is commonly `[0, 0, 2]` meters. | Shader-lab/local source packets and local scene capture packets. | Display/model fixture. | Keep as historical test-scene input. Production view placement should resolve from configured latitude, longitude, local time, and view altitude. App derivation/defaulting of altitude is outside Algorithm32. |

## Local Source Placement And Solar Time

| Fact | Implementation trail | Current support | Reconciliation action |
| --- | --- | --- | --- |
| Local source kind is `flat-local-point-sun`: finite position, finite distance, radius, reference distance, optional inverse-square falloff, and spectral incident scale. | `algorithm32-source-contract.js`; `atmosflat32/local-sun.js`; `local-second-order/local-sun-source.js`. | Accepted experiment plus source-backed point-light falloff candidate. | Promote as a named light/source implementation only. Separate physical point-light math from false-Sun model parameters. |
| Optional source/geometry separation diagnostic runs a finite local Sun on canonical spherical geometry, configured to match the resolved distant/real Sun at a reference view point. | Proposed reconciliation experiment seeded by current source/geometry boundary decision. | Planned diagnostic. It tests explicit source/geometry handoff and limiting-case consistency, not external validation of local-Sun physics. | Record the handoff facts that make the match possible: frame, observer/root position, source position, sample-to-source distance, angular radius or solid angle, inverse-square inputs, source-path clipping descriptor, calibration reference event, and spectral incident scale. If the finite local source cannot run on spherical geometry, classify whether the missing dependency is source config, geometry resolver output, coordinator data flow, or improper coupling before promotion. |
| Geometry-owned `SourceRelativePosition` is the reconciliation target for separating local-source placement from lighting facts. Geometry maps observer/path model-space positions to direction from source plus measured distance from source when finite placement exists. For cache construction, geometry separately maps source-relative cache coordinates back to model-space positions or representative positions. Light source interprets `SourceRelativePosition` into incoming direction, distance-use treatment, falloff, angular extent, spectral scale, and source path limits. | `algorithm32-abstraction-design.md`; current design discussion. | Design target. It preserves the core Algorithm32 transport while moving flat/spherical coordinate interpretation out of light-source radiometry and keeping lighting use of source distance inside the light-source boundary. | Use this as the preferred production abstraction when replacing POC local-source `positionMeters` coupling. Cache descriptors must define the mapping and declare whether reverse mapping is exact or representative. |
| Inverse-square finite-source falloff is `(referenceDistanceKm / distanceKm)^2`. | `algorithm32-source-contract.js`; `atmosflat32/local-sun.js`; shader pass. | Source-backed candidate. PBRT point-light sampling divides spectral intensity by squared distance; radiometry texts also support point-source irradiance falloff. | Cite final source in the production reference ledger and state the point-source approximation limits. |
| Apparent source angular radius uses `atan2(radiusKm, distanceKm)`. | `algorithm32-source-contract.js`; source sample traces. | Analytic geometry candidate, but the false-Sun radius is artificial. | Source the geometry formula if promoted; source/model the radius separately. |
| `KM_PER_MILE = 1.609344`. | `local-second-order/local-sun-source.js`. | Source-backed candidate. Exact international mile conversion follows from the 1959 yard definition. | Cite a standards source in the final ledger or avoid miles in promoted config by storing canonical kilometers. |
| `MEAN_EARTH_RADIUS_KM = 6371.0088` used by the projection helper. | `local-second-order/local-sun-source.js`. | Source-backed candidate, but exact rounding should be pinned. GRS80/IUGG arithmetic mean radius is the likely source family. | Pin an authoritative geodesy reference or replace with a cited model-specific Earth radius constant. |
| View/root placement is configured latitude, longitude, local time, and view altitude. Historical local-source scenes used San Jose at lat `37.3382`, lon `-121.8863`, elevation `30.48 m`. | `local-second-order/local-sun-source.js`; local scene packet ids. | Configuration contract plus app/test fixture. | Treat San Jose as a fixture, not a production constant. Define the public view config schema with lat/lon/local-time/altitude ownership, units, and validation. App-side derivation of altitude is a separate policy. |
| False Sun latitude model is annual tropic migration: north `23.5`, south `-23.5`, northern solstice day `172`, period `365.2422` days. | `local-second-order/local-sun-source.js`; local lane README. | Source-recovery/default configuration candidate plus local simplification. Earth's obliquity/tropical-year concepts are sourceable; the exact cosine resolver and date anchor must be specified as model behavior. | Retain as a default profile only after pinning the obliquity/year/solstice source trail and documenting the simplified migration rule as model configuration. |
| Default false-Sun geometry uses altitude `3000 miles = 4828.032 km` and radius `16 miles = 25.749504 km` / diameter `32 miles`. | `local-second-order/local-sun-source.js`; atmosflat `018` equations/constants; legacy flat docs pending source recovery. | Source-recovery/default configuration candidate plus accepted POC lineage. These are profile defaults, not resolved packet constants. | Recover the expected flat-Earth/local-Sun sources for altitude and size, then keep the values as configurable defaults with canonical kilometers and diagnostics. |
| False Sun longitude/phase is `58.1137 deg`; reference distance is `4800 km`; target closest incident scale is `1`. | `local-second-order/local-sun-source.js`; atmosflat `018` equations/constants; legacy atmosphere design. | Artificial model/calibration configuration, with no external physical source found so far. | Treat longitude/phase and calibration targets as authored profile or calibration inputs. Do not promote them as real-world constants unless a source is recovered. |
| Local Sun degree requests are `degreesFromClosestApproach`: the number of degrees the configured finite local Sun moves along its local orbit from closest approach. They are not apparent altitude/elevation angles. | User clarification during integrated flat/local shader review; `local-second-order/local-sun-source.js` orbit-state lineage. | Current POC/user-language convention. It is an authored orbit-phase input inside the artificial model, while source position, apparent altitude/azimuth, lighting direction, and shadow direction are derived outputs. | Name this explicitly in runner payloads, scene presets, diagnostics, and UI labels. Do not name these values `altitudeDegrees` or use them as sky-elevation overrides. |
| `real-subsolar-longitude0-noon` is the default local Sun latitude/time synchronization policy unless a scene/profile explicitly selects another named policy: for a given date, the local Sun latitude is the latitude where the real Sun is directly overhead at solar noon on longitude `0`. The local source clock is synchronized to that date-derived latitude/longitude-0 noon anchor, not to an arbitrary configured source latitude. | User design decision during Union Glacier flat/spherical clock-sync review; current Union Glacier `2021-12-14` scene-set/runners. | Current POC default synchronization policy for real-world-correspondence review scenes. This keeps the artificial finite local Sun model, but makes its latitude and clock anchor correspond to the real-world date before applying closest-approach/orbit offsets. Other named synchronization policies may coexist for authored fixtures, diagnostics, or legacy comparison scenes when explicitly selected. | Store the selected policy name in scene metadata/diagnostics. For this policy, date and location remain scene inputs while local Sun latitude is derived. Do not allow scene config to independently override source latitude for scenes that explicitly select this policy. |
| Closest approach can be aligned to a selected synchronization anchor, and positive local orbit degrees advance model local time at `15 deg/hour`. Historical scenes used the San Jose fixture. | `local-second-order/local-sun-source.js`; local README; subjective scene labels; Union Glacier clock-sync review. | User local time configuration plus NOAA/NREL solar-clock candidate for comparison labels. The flat model has no independent time standard, so synchronization to real time is a calibration convention, and different scene families may select different named anchors. | Cite solar-time/noon math only for any spherical-Earth comparison labels. Record local time as user configuration, and record the false-Sun 360-degree-per-day orbit plus selected synchronization anchor as model rules. |
| The code uses a NOAA-style equation-of-time approximation and solar-noon formula. | `local-second-order/local-sun-source.js`. | Source-backed candidate. NOAA publishes the same equation-of-time form and solar-noon relation; NOAA also notes its legacy calculator is approximate/no longer maintained. | Use NOAA as the source for reproduced POC labels. For final validation constants, consider NREL SPA or another maintained ephemeris if precision matters. |
| North-pole projected source placement uses a polar azimuthal-equidistant style formula with radius `R * (pi/2 - lat)`, `x = radius * sin(lon)`, `z = radius * cos(lon)`. | Legacy projection docs and local-source implementation lineage, carried through record `018-m2-north-polar-aeqd-source-decision`. | Projection identity and source parameters are now sourced to PROJ `+proj=aeqd`; north-polar use and scene-axis endpoint convention remain artificial model configuration. Formula-level production citation is still useful if the final implementation hand-codes the polar simplification. | Implement Milestone 2 geometry as north-polar AEQD with `lat_0 = 90 deg`; keep `lon_0`, radius, and scene-axis convention explicit in configuration/diagnostics. Treat the projection's use as a false-Sun scene layout rule. |
| Resolved local-source packet fields such as `positionMeters`, `distanceKm`, `observerIncidentScale`, `referenceSpectralIncidentScale`, and `skyPosition` are derived from the authored false-Sun configuration plus projection/orbit/calibration formulas. | `flatLocalSunSourceDefinition` and `flatLocalSunOrbitState` in `local-second-order/local-sun-source.js`. | Derived output from accepted POC formulas. | Do not copy resolved values as constants. Production should regenerate them from canonical source config and cited/accepted algorithms, then store them only in diagnostics/artifacts. |

## Radiance, Spectrum, And Calibration

| Fact | Implementation trail | Current support | Reconciliation action |
| --- | --- | --- | --- |
| Local source calibration matches closest approach to the distant high-Sun `1x` incident scale. | Atmosflat `018`; `local-second-order/local-sun-source.js`. | Accepted experiment/model calibration, not external physics. It exists because false-Sun brightness and absolute real-time synchronization are not independently sourced. | Keep only as a named local-source calibration rule if local Sun enters production. Treat the target event as authored config and rerun under finalized parameters. |
| Atmosflat `018` recorded closest distance `5050.674164842701 km`, closest falloff `0.9031996723576281`, raw app `solarIrradianceScale: 58`, raw closest incident scale `52.38558099674243`, calibrated scale `1.1071748923354825`, and multiplier `0.01908922228164625`. | `evidence/current/atmosflat-018-local-skydomes/equations-and-constants.json`; local-source code. | Accepted experiment / app-fixture provenance. The raw brightness scale is not externally sourced. | Preserve in provenance, but do not promote the raw `58` or derived calibration as source-independent physics. Reconciliation should replace ad hoc brightness with an explicit calibration rule. |
| Planned reference-lane calibration model chose source radiance from target irradiance: `E_target(lambda) = L_sun(lambda) * Omega_reference * T_reference(lambda)`. | Legacy atmosphere reset `plan.md`, Phase 6. | Internal planned design plus source-backed radiometry candidate. | Use this as reconciliation seed for a cleaner local-source calibration, with external radiometry citations for irradiance/radiance/solid-angle units before promotion. |
| Local finite-Sun solid angle was planned as `2*pi*(1 - sqrt(d^2 - R^2)/d)`, with small-disk limit `pi*(R/d)^2`. | Legacy atmosphere reset `reference/plan.md` and `plan.md`; `reference/code_design.md` lists the small-disk fixture. | Source-backed analytic geometry candidate plus internal planned test. | Add to reconciliation analytic fixtures. It acts on configured source radius and distance; it does not source those config values. |
| The current POC calibration computes `closestFalloff = (referenceDistanceKm / closestDistanceKm)^2`, then `referenceSpectralIncidentScale = targetClosestIncidentScale / closestFalloff`; per-row observer scale applies the same inverse-square falloff at the row distance. | `flatLocalSunSourceDefinition` in `local-second-order/local-sun-source.js`. | Accepted POC derivation from artificial config plus inverse-square falloff. | Keep as current lineage. During reconciliation, decide whether to preserve this unit-incident-scale calibration or replace it with the planned radiance/solid-angle/transmittance calibration. |
| Preferred local-source brightness calibration anchor is likely local solar noon at the source latitude. | User design decision during M2 latitude-sweep setup; consistent with the new summer-solstice latitude-sweep calibration packet. | Working model-policy direction, not external physics proof. It separates source-power calibration from per-observer view selection. | Treat the source-latitude solar-noon event as the default calibration reference unless a profile declares another explicit event. After source power is calibrated there, observer latitude/time rows should be handled by clock synchronization or orbit offset mapping, not by recalibrating brightness per observer. |
| Production local-source brightness should be unit-bearing source radiance or power, not the POC `referenceSpectralIncidentScale` bridge. | User design note after the polar clock-sweep review; current POC `LocalSunLightSource` computes `incidentRadiance(lambda) = canonicalSolarIrradiance(lambda) * referenceSpectralIncidentScale * falloffScale`. | Production calibration target. The current POC scale is dimensionless and deliberately named as an incident-scale bridge. | Carry forward to production: choose a target sea-level direct normal irradiance directly under the finite Sun at the calibration event, account for source-path transmittance plus apparent solid angle/finite-source geometry, and solve for a fixed source spectral radiance/power for the configured Sun altitude/size. Calculate or invalidate that derived brightness when relevant user/profile configuration changes, then treat it as resolved source configuration. Once derived, that source brightness should be reused for other observer rows; later changes should come from geometry, transmittance, solid angle, and distance, not per-observer brightness recalibration. |
| Stale POC local source tint `{ r: 1, g: 0.98, b: 0.95 }` and rough RGB-to-15-channel grouping were inherited from earlier flat-app/shader-lab paths, then reversed by the latest local-sun-second-order diagnostic. | Stale fallback paths remain in `shared/algorithm32/POC/three/shader-lab-page.js`, `shared/algorithm32/POC/local-second-order/local-sun-source.js`, and related review harness fallbacks; accepted artifact `tmp/atmosphere/local-second-order/095-local-source-neutral-white-stack/` uses `sourceColorOverride = { r: 1, g: 1, b: 1 }` and passed `30/30` criteria. | Reverted/stale fixture residue. The neutral-white reversal is accepted local-lane evidence, not a new physical spectrum model. | Treat neutral/no-tint source scale as the current local-lane baseline for reconciliation recreation. Keep the old tint and RGB grouping out of production and remove or guard stale POC fallbacks before promotion. If non-neutral source spectrum is required, replace it with a source-backed spectral model. |
| Direct solar-disc camera radiance and local ground bounce were deferred/excluded in shader-lab/local-source work. | Shader-lab plans and local post-step audit. | Accepted scope decision. | Preserve as explicit non-features unless a later lane sources and tests them. |

## Local Second-Order Cache And Shader Packing

| Fact | Implementation trail | Current support | Reconciliation action |
| --- | --- | --- | --- |
| Local L2 interface is source-neutral: `L1_incident = incidentField.sample(position, incomingDirection, wavelength)`. | `local-sun-second-order/scattering-notes.md`; `experiment-plan.md`; `run-milestones.js`; `local-cache.js`. | Accepted experiment. | Promote the interface after sign/unit/descriptor tests are recreated under reconciliation. |
| Local incident cache logical domain is `z/rho/incomingDirection/wavelength`; incoming direction is stored in a Sun-subpoint radial/tangential/up frame. | `local-cache.js`; accepted `011`, `020`, `021` lane artifacts. | Accepted experiment. | Promote the logical domain only after final data-shape and cache-key tests. |
| Default POC cache bins are `z = [2, 1000, 5000, 15000, 45000] m`, `rho = [0, 500000, 1250000, 2500000, 5000000, 9000000, 13000000] m`, `9` incoming directions, and `15` wavelengths. | `shared/algorithm32/POC/local-second-order/local-cache.js`; local runner evidence. | Accepted experiment / execution configuration. | Rerun convergence before treating exact bins or counts as production defaults. |
| Incoming directions are generated by a golden-ratio angular sequence over `z` from `-0.8` to `0.8`. | `local-cache.js`; `run-milestones.js`. | Experimental sampling choice. | Source Fibonacci/golden-angle sampling only if the final algorithm uses this family; exact count/range remain convergence-backed choices. |
| Lookup policy is `nearest-neighbor-poc-grid`; invalid ranges and source-key mismatches fail loudly. | `local-cache.js`; accepted cache criteria. | Accepted experiment / production guardrail. | Keep fail-loud behavior. Decide interpolation policy during reconciliation. |
| GPU packing uses Three `Data3DTexture`, RGBA spectral groups, and `x=rho`, `y=z`, `z=directionIndex*spectralGroupCount+groupIndex`. | `local-cache.js`; `three/local-second-order-renderer.js`; `scripts/flat/local-second-order/page/local-second-order.js`. | Accepted GPU implementation evidence plus Three API source candidate. | Treat packing as shader-builder implementation detail. Recreate CPU/GPU parity before finalizing. |

## Display And Review Fixtures

| Fact | Implementation trail | Current support | Reconciliation action |
| --- | --- | --- | --- |
| Three point/directional lights are synchronized from source direction and use display intensities such as `2.4`, with point-light `decay=0` in subjective scenes. | Shader-lab/local scene capture code and comparison JSON. | Display fixture. | Keep outside Algorithm32 radiometry. If product needs scene-light coupling, document as display policy. |
| Terrain assets, star field, shadows, antialiasing, render scale, camera fit/yaw, and labels drive subjective evidence. | `scripts/flat/local-second-order/README.md`; `page/subjective-scenes.js`; local artifacts. | Display/review fixtures. | Recreate as subjective or deterministic regression artifacts only. Do not promote their numeric values as algorithm constants. |
| Summer-solstice local-vs-distant labels use San Jose date/time rows such as `2026-06-21` and local solar-noon sync around `13:09`. | Local lane README and scene config. | Reproducible fixture with source-backed solar-clock candidate. | If retained as validation constants, recompute under a cited solar-position algorithm and record inputs, timezone, and rounding. |
| Additional San Jose-longitude summer-solstice latitude skydome set uses observer latitudes `80N`, `30N`, equator, `30S`, and `80S`, with closest false-Sun approach for each row. | User request during M2 subjective review planning; `M2_LOCAL_FLAT_SEED_CONSTANTS.sceneSets.san-jose-longitude-summer-solstice-latitude-sweep`; documented `annual-tropic-migration` false-Sun latitude setup; record `043-m2-summer-solstice-latitude-skydomes`. | Display/review fixture plus artificial model configuration. Rendered in the reconciliation POC as five 320px PNGs with no guide-image parity target. | Keep as subjective model-inspection material. Resolve source latitude from the annual tropic-migration model for `2026-06-21T12:00:00-07:00` before closest-approach rotation; the current POC probe resolves this to `23.5 deg N`. Calibrate source brightness once at that same `23.5N` latitude and San Jose longitude, then reuse the resulting reference spectral incident scale for all five rows. It does not replace the Step 018 rotation guide set and has no guide-image parity target. |

## External Sources Found

- NOAA Global Monitoring Laboratory,
  `General Solar Position Calculations`:
  https://gml.noaa.gov/grad/solcalc/solareqns.PDF. This supports the POC's
  NOAA-style equation-of-time form and solar-noon relation for labels and
  time-sync fixtures.
- NOAA Solar Calculation Details:
  https://gml.noaa.gov/grad/solcalc/calcdetails.html. This records that the
  NOAA calculator is based on Meeus-style equations, gives approximate accuracy
  expectations, and warns the legacy calculator is no longer maintained.
- NREL, Reda and Andreas, `Solar Position Algorithm for Solar Radiation
  Applications`: https://www.nrel.gov/docs/fy08osti/34302.pdf. This is a better
  candidate for final high-precision solar-position validation if reconciliation
  needs exact solar time, zenith, or azimuth fixtures.
- PROJ `Azimuthal Equidistant` documentation:
  https://proj.org/en/stable/operations/projections/aeqd.html. This supports
  the AEQD projection family, `+proj=aeqd` identifier, geodetic-to-projected
  role, projection-center parameters `+lat_0`/`+lon_0`, and optional spherical
  radius parameter `+R`. It supports the projection reference used by the
  north-polar scene placement, but not the false-Sun model itself.
- PBRT v4 `Point Lights`:
  https://pbr-book.org/4ed/Light_Sources/Point_Lights. This supports treating a
  point light's received illumination as spectral intensity divided by squared
  distance, while also noting the radiometric-unit caveat for point lights.
- Three.js `Data3DTexture` documentation:
  https://threejs.org/docs/#api/en/textures/Data3DTexture. This supports the
  chosen GPU storage API, not the physics or cache grid.

## Internal Legacy Provenance Found

- [ProjectionModel API Draft](../plans/atmosphere-cleanroom-design/legacy-reference-docs/projection-model-api.md)
  records `north-pole-azimuthal-equidistant` as the first flat/flat Earth
  projection, paired with `north-celestial-pole-azimuthal-equidistant` and
  `upper-hemisphere-radial-lift`. It also records the San Jose root,
  `meanEarthRadiusKm: 6371.0088`, and projected Earth/dome radius
  `20015.114442035923 km`.
- [Legacy Flat Prompt](../plans/atmosphere-cleanroom-design/legacy-reference-docs/prompt.md)
  states the broad false-model outline: treat Earth as an azimuthal equidistant
  projection centered on the north pole, treat the sky as a similar celestial
  projection, and map that sky onto the underside of a half sphere.
- [Atmosphere Reset Design](../plans/atmosphere-cleanroom-design/legacy-reference-docs/plans/atmosphere_reset/design.md)
  contains the most directly useful transform inventory: geodetic anchors map
  through `north-pole-azimuthal-equidistant` with
  `angularDistance = pi / 2 - latitude`, `radius = R * angularDistance`, and
  longitude selecting azimuth. It also records the current app endpoint
  convention `x = radius * sin(lon)`, `z = radius * cos(lon)`,
  `y = elevationMeters / 1000`, while explicitly calling that a render endpoint
  convention rather than generic flat-world truth.
- [Atmosphere Reset References](../plans/atmosphere-cleanroom-design/legacy-reference-docs/plans/atmosphere_reset/reference/references.md)
  says flat-world hypothesis runs adapt geodetic target anchors through the
  north-pole-centered azimuthal equidistant projection unless a scenario
  declares another projection, and explicitly labels that projection as the
  current flat hypothesis projection, not an Earth-validation model.
- [Atmosphere Design](../plans/atmosphere-cleanroom-design/legacy-reference-docs/atmosphere-design.md)
  records `falseSunRadiance` as `point-inverse-square-reference`,
  `referenceDistanceKm: 4800`, and `distanceFalloff: true`, and repeats the
  false-Sun defaults inherited by later local-source work. It also states that
  false-model assumptions should remain explicit and that the flat model should
  reuse named physical inputs while revealing geometry-driven consequences.
- [Atmosphere Reset Plan](../plans/atmosphere-cleanroom-design/legacy-reference-docs/plans/atmosphere_reset/plan.md)
  contains the useful local-Sun configuration/calibration split: add a named
  flat-world fixture with local finite Sun and reference-position calibration;
  choose source radiance so target irradiance equals source radiance times
  reference solid angle times reference transmittance; and expose how local Sun
  irradiance changes with observer position.
- [Atmosphere Reset Reference Plan](../plans/atmosphere-cleanroom-design/legacy-reference-docs/plans/atmosphere_reset/reference/plan.md)
  records local finite-Sun solid-angle tests, the small-disk limit, calibration
  to target direct normal irradiance at the reference observer in vacuum, and
  the `4x` irradiance drop when distance doubles under equal incidence.
- [Atmosphere Reset Reference Code Design](../plans/atmosphere-cleanroom-design/legacy-reference-docs/plans/atmosphere_reset/reference/code_design.md)
  says flat/local-Sun worlds should remain consequence or compatibility
  scenarios, not the calibration source for expected Earth-like sky colors. It
  also lists the local-Sun small-disk limit as a first analytic fixture.
- [Atmosphere Rejected Ideas](../plans/atmosphere-cleanroom-design/legacy-reference-docs/atmosphere-rejected.md)
  explicitly rejects tuning the flat atmosphere until false geometry visually
  matches the real sky. This supports the reconciliation stance that the flat
  model should not hide geometry-driven consequences.
- [Reality-Aligned Daytime Atmosphere Plan](../plans/atmosphere-cleanroom-design/legacy-reference-docs/plans/reality-aligned-daytime-atmosphere-plan.md)
  says that if point-Sun scattering is kept for false-model inspection, it
  should be named as a false-model radiance bridge rather than a physical solar
  constant.

## Missing Or Model-Only Sources

- No external source was found, or is expected, for the combined flat
  z-up/finite false-Sun world. Treat it as a named Algorithm32 model extension.
  The legacy projection and atmosphere docs strengthen the internal model
  provenance, but they are not external validation.
- False-Sun altitude `3000 miles`, diameter `32 miles`, and annual latitude
  migration are now source-recovery tasks for the default steel-man profile,
  not confirmed-unsourced constants. They still need exact citations, units,
  ranges, and ownership before promotion.
- View latitude, longitude, local time, and view altitude are user/app
  configuration, not source-backed constants. The remaining app-side question
  is how altitude is derived or defaulted before it is passed into Algorithm32.
- No external source has been found for false-Sun brightness/power, the raw
  `solarIrradianceScale: 58`, reference distance `4800 km`, target closest
  incident scale `1`, or real-time synchronization in a model with no time
  standard. These belong behind an explicit calibration algorithm and time
  anchor policy.
- No external source has been found so far for false Sun longitude/phase
  `58.1137` as a real-world constant. Treat it as model configuration unless a
  source is recovered.
- No external source has been found for the POC sky-ray cap `1926774 m` as a
  physical constant. It is currently renderer/view-ray policy with accepted
  experimental lineage.
- No external source has been found for the exact local cache bins, direction
  count, z-range for golden-angle directions, or nearest-neighbor lookup as
  production defaults. These need reconciliation convergence/parity support.
- No physical source has been found for the inherited RGB tint
  `{ r: 1, g: 0.98, b: 0.95 }` or its rough spectral grouping, and the latest
  local-sun-second-order diagnostic reversed it with neutral white source
  scale. Production guardrails should continue rejecting the old tint and any
  stale POC fallback path that reintroduces it.
- The projection choice/source is closed by record
  `tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision`, but
  the exact `MEAN_EARTH_RADIUS_KM = 6371.0088` source should still be pinned to
  an authoritative geodesy reference or replaced with a more explicitly cited
  radius value.
- The exact `KM_PER_MILE = 1.609344` source should still be pinned to an
  authoritative unit/standards reference if miles remain in promoted fixtures.

## Reconciliation Tasks

1. Decide whether local Sun belongs in the first production profile. If yes,
   introduce it as a named artificial light/source plus flat-geometry profile,
   not as a real-world Sun/Earth model.
2. Build a machine-readable fact ledger from this inventory, with columns for
   owner subsystem, value, units, implementation path, support type, source
   pointer, accepted artifact pointer, and promotion status.
3. Add an explicit ledger column for fact role: authored configuration,
   source-backed/accepted equation, derived resolved output, or display/review
   configuration.
4. Define the public view-placement config: latitude, longitude, local time,
   view altitude, and the boundary between Algorithm32 config and app-side
   altitude derivation/defaulting.
5. Resolve `topAltitudeMeters` for the flat atmosphere/profile and separately
   decide the no-hit scene sky-ray policy.
6. Recover and pin the default-configuration sources for false-Sun altitude,
   size, and annual latitude migration, while keeping them user-configurable.
7. Recompute any spherical-Earth solar-time comparison labels with a cited
   algorithm and record all inputs, timezone handling, rounding, and expected
   tolerances. Separately document the flat model's time-synchronization anchor
   as calibration policy.
8. Reconcile local-source calibration: either preserve the accepted POC
   unit-incident-scale-at-closest rule as an artificial model decision, or
   replace it with the cleaner radiance/solid-angle/transmittance calibration
   seeded by the legacy reset plan. This is the promotion path for source
   brightness and time-anchor behavior.
9. Rerun direct/oracle versus cache convergence for local L2 before promoting
   exact cache bins, direction counts, interpolation policy, or packing
   defaults.
10. Keep display fixtures, terrain, stars, scene-light intensity, and stale
   inherited tint fallbacks outside Algorithm32 physics unless a later lane
   gives them explicit source/model provenance. Recreate the accepted `095`
   neutral-white reversal under reconciliation so the old tint cannot drift
   back in as a hidden default.
11. For the optional real-Sun-matched spherical-geometry diagnostic, define
   the source/geometry handoff facts before rendering. The experiment should
   test whether the finite source can consume geometry-owned facts through a
   public data contract, not whether light amount is independent of source
   position or geometry.
