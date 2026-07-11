# Unsourced And Partially Sourced Facts

Status: actionable reconciliation gap ledger.

This document is the single working list of known facts that are not yet ready
for production promotion because they are unsourced, only partially sourced,
experiment-backed rather than externally sourced, internally documented but not
externally validated, or display/review fixtures that need to stay out of
Algorithm32 physics.

Use this as the reconciliation intake checklist. The final parameter ledger may
promote a row only after its action is resolved, or explicitly exclude it from
the initial profile.

The app purpose is to steel-man the flat Earth model and expose consequences
as users change model parameters. For `authored-config` rows, the gap is not
that every value lacks a real-world source. The gap is whether the parameter is
owned, named, unit-bearing, range-checked, defaulted with provenance, and acted
on by sourced or accepted equations with diagnostics.

Default false-Sun altitude, size, and annual latitude migration are currently
treated as source-recovery tasks for the initial steel-man profile. The larger
local-source gap is brightness and real-time synchronization: the model has no
independent time standard or externally sourced source power, which is why the
calibration algorithm is required.

View latitude, longitude, local time, and view altitude are also authored
configuration into Algorithm32. How the app derives or defaults altitude is a
separate upstream question, so historical observer heights remain fixtures
unless they are explicitly passed as configuration.

## Fact Roles

| Role | Meaning | Promotion rule |
| --- | --- | --- |
| `authored-config` | User/app/model input, such as false-Sun altitude or cache grid. | Promote only as named profile configuration with owner, units, valid range, default provenance, and diagnostics. Do not call it a real-world constant unless separately sourced. |
| `equation` | A formula or model rule that acts on configuration. | Needs external source, source-backed derivation, or accepted Algorithm32 experiment. |
| `derived-output` | Resolved value produced from configuration plus equations. | Do not promote as a hand-authored constant. Regenerate from canonical inputs; store only in diagnostics/artifacts. |
| `implementation-policy` | Shader packing, runtime failure behavior, cache lookup, or precision policy. | Promote only when named, tested, and bounded by tolerances. |
| `display-fixture` | Terrain, stars, Three lights, labels, camera fit, render scale, or review-only images. | Keep outside Algorithm32 transport unless promoted as display/review policy. |
| `source-precision` | Externally supported, but citation/pinning/locator detail is insufficient. | Pin or cite precisely before production reference-ledger promotion. |

## Baseline Algorithm32 Precision Gaps

The Bruneton start-fresh audit found no active retained Step 032 pure-algorithm
ingredient with neither external reference nor accepted experimental support.
The rows here are therefore provenance precision or scope-filtering tasks, not
evidence that Step 032 is invalid.

| ID | Owner | Role | Fact / value | Current support | Gap | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `base-001` | Atmosphere / transport | `source-precision` | Spherical shell transport, top-boundary distance, optical-length integration, Beer-Lambert transmittance. | Bruneton/PBRT source trail. | Some cited source files, especially `functions.glsl`, are URL-cited but not pinned as local audited files. | Pin source file or add precise production reference pointer. |
| `base-002` | Atmosphere | `source-precision` | Bruneton 2016 aerosol alpha/beta/single-scattering albedo, Cornette-Shanks `g`, no-ozone comparison policy, 40-wavelength comparison, Figure 1 claims. | Bruneton 2016 paper and accepted Step 032. | Current references are broad; final ledger needs page/figure/table/caption/equation locators. | Add exact locators. |
| `base-003` | Color / comparison | `source-precision` | Figure 1 tile extraction, row labels, red-cross measurements, measured Sun azimuths. | Extracted Bruneton Figure 1 image tiles and accepted artifacts. | Extraction command/tool, crop boxes, PDF checksum, and measurement procedure are not machine-readable. | Recreate/document extraction under `tmp/atmosphere/reconciliation/`. |
| `base-004` | Parameter ledger | `source-precision` | Step 032 script-carried inactive constants: demo aerosol defaults, ozone, ground, demo exposure, fitted `k`, direct-Sun constants. | Present in script/JSON objects. | They are not active retained baseline constants but can be accidentally copied. | Filter final ledger to active constants only; list inactive constants as rejected/inactive. |
| `base-005` | Execution config | `authored-config` | Runtime/default numerical controls `40/20/34/48`; validation/reference `80/40/68/96`; earlier Step 032 `20/10/17/24`. | Accepted convergence/refinement evidence, not external physics. | Counts are implementation verification choices, not sourced constants. | Rerun under reconciled parameters and record as experiment-backed execution packets. |
| `base-006` | Color / comparison | `display-fixture` | Figure 1 render constants: `320 px`, `0.47 * size`, transparent outside-sky pixels, observer height `2 m`, red-cross-derived azimuths. | Accepted comparison artifact setup. | These are comparison/reproduction values, not atmosphere constants. | Relabel as comparison-scene/display fixture or source where appropriate. |
| `base-007` | Spectral / color | `source-precision` | CIE and ASTM authority path for production tables. | Traceable through Bruneton; official CIE/ASTM anchors identified. | Final ledger must choose whether Bruneton binned data or official CIE/ASTM sources own each table. | Choose canonical source path per table. |
| `base-008` | Multiple scattering | `implementation-policy` | Step 032 second-order approximation and full-sphere direction sampling. | Source-informed and visually accepted. | Not Bruneton's full precomputed multiple-scattering texture algorithm. | Keep as accepted Algorithm32 approximation or replace only through a sourced/accepted reconciliation decision. |
| `base-009` | Color / comparison | `source-precision` | Maximum luminous efficacy `683`, XYZ-to-linear-sRGB matrix, and Bruneton color constants. | Source-backed through Bruneton/CIE/sRGB trails. | `constants.h` was not locally pinned in the start-fresh source folder; direct official source pointers are still preferable for production. | Pin Bruneton color source or cite official photometry/sRGB/CIE sources directly. |
| `base-010` | Color / comparison | `source-precision` | Figure 1 `k = 1 / (5 * 683)`. | Source-backed derivation from Bruneton comparison source and luminous efficacy. | `comparisons.cc` was cited by URL but not locally pinned in start-fresh external sources. | Pin source or add precise production URL/line pointer. |

## Local Sun And Flat Geometry Gaps

These rows are the largest source gap family. Most are legitimate as authored
configuration for a named artificial local-source / flat-geometry profile. The
reconciliation task is to preserve user configurability while ensuring the
math, units, defaults, ranges, derived outputs, and diagnostics are sourced,
accepted, or explicitly modeled.

| ID | Owner | Role | Fact / value | Current support | Gap | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `local-001` | Source + geometry | `authored-config` | Combined flat z-up atmosphere, finite false Sun, long flat sightlines. | Internal legacy design and accepted POC evidence; app purpose is steel-man configurable flat Earth consequences. | No external source is expected for the combined artificial world. | Name it as an artificial Algorithm32 extension profile with user-configurable parameters, source-backed equations, and consequence diagnostics. |
| `local-002` | Atmosphere / profile | `authored-config` | Flat atmosphere top boundary uses both `60000 m` and `100000 m` in POC paths. | Accepted POC behavior plus record `019-m2-atmosphere-boundary-ownership`. | Conflicting defaults; `100000 m` may be a Karman-style/model boundary but is not yet pinned for this profile. Geometry needs the selected boundary to calculate ray exits, but does not own the choice. | Pick final flat atmosphere/profile top boundary and source/relabel it; pass the active domain to geometry for clipping. |
| `local-003` | Renderer / view-ray policy | `authored-config` | No-hit sky ray cap `1926774 m`. | Accepted artifact `062` lineage; renderer/view policy; M2 blue-ring probe showed scalar-cap discontinuity near the skydome edge; record 040 observer-dome implementation demotes it to legacy fallback/diagnostic seed for the M2 skydome profile. | Not externally sourced as physical distance and unsuitable as final atmosphere exit. | Do not promote as atmosphere physics. Use the geometry-owned observer-centered finite dome exit for the M2 skydome profile. |
| `local-004` | Geometry | `authored-config` | Round-equivalent skydome cap footprint / max observer view-ray extent `875656.6450361694 m`. | Accepted atmosflat `018`, scoped to observer skydomes; M2 blue-ring probe showed this direction-sensitive cap moves rim pixels closer to historical output; record 040 expresses it as `maxObserverViewRayExtentMeters`. | Renderer-scoped historical cap, not scene/source transport. It is a skydome view extent, not the dome sphere radius. | Keep as historical evidence and M2 observer-centered skydome profile configuration. Do not use it as a magic scalar scene-ray distance. |
| `local-004a` | Geometry / atmosphere domain | `authored-config` / `model-policy` | Finite flat-world dome atmosphere domain: spherical dome with explicit center policy, apex at configured dome height, observer-view extent for skydome profiles, and per-ray exit distances from the derived dome. | User design decision during M2 reconciliation; analytic sphere cap and ray-sphere intersection geometry; records 040/041. | Implemented and rendered in the POC for the M2 skydome profile: center policy is observer-centric, `H = 60000 m`, `D = 875656.6450361694 m`, derived center `[0, 0, -6360000]`, and radius `6420000`. Map-centered behavior remains a separate full-world profile. Atmosphere compression/remapping is explicitly out of scope for this profile. | Keep as subjective M2 inspection evidence pending closeout classification. Geometry exits rays at ground/profile/dome/map boundaries while atmosphere keeps the same altitude-based composition and only truncates samples outside the finite domain. Later images are subjective inspection/error-spotting artifacts, not Step 018 parity targets. A compressed-atmosphere follow-up would need a separate 3D medium/composition model, not a one-dimensional altitude rescale. |
| `local-005` | Geometry / fixture | `authored-config` | Flat observer position `[0, 0, 2] m`. | POC scene setup. | Fixture/default height, not atmosphere constant or canonical production default. | Treat as historical test-scene input. If the app uses it as a default, pass it explicitly as view altitude configuration. |
| `local-006` | Source | `authored-config` | Default false-Sun geometry: altitude `3000 mi`, radius `16 mi` / diameter `32 mi`. | Legacy flat config, accepted atmosflat/local-source evidence, and expected source recovery for the steel-man default profile. | Exact external source pointers and canonical units/ranges are not pinned. | Recover the flat-Earth/local-Sun source trail, store canonical kilometers, and keep the values user-configurable with diagnostics. |
| `local-006a` | Source | `authored-config` | False Sun longitude/phase `58.1137 deg`, reference distance `4800 km`, target closest incident scale `1`. | Legacy flat config and accepted atmosflat/local-source evidence. | No external physical source found so far; these appear to be phase/calibration configuration. | Promote only as named profile/calibration config unless a source is recovered. |
| `local-006b` | Source calibration | `authored-config` / `equation` | False-Sun brightness or power, including raw `solarIrradianceScale: 58`, plus any synchronization to real time. | Accepted calibration lineage. | No source for absolute source brightness and no reasonable real-time synchronization standard inside the flat model. | Put brightness and time anchoring behind an explicit calibration algorithm with a named reference event. |
| `local-007` | Source | `authored-config` | Annual tropic-migration model: `23.5/-23.5 deg`, solstice day `172`, period `365.2422`, cosine rule. | Source-recovery/default configuration candidate plus local model. | Obliquity/year/solstice concepts are sourceable; exact simplified cosine rule and date anchor need profile documentation. | Recover astronomical source pointers and label the cosine migration rule as model behavior. |
| `local-008` | Geometry / source placement | `authored-config` | User view placement by latitude, longitude, local time, and view altitude. Historical fixture: San Jose root `37.3382`, `-121.8863`, elevation `30.48 m`. | App configuration contract plus POC fixture. | These are Algorithm32 configuration values, not source constants. App-side derivation/defaulting of altitude is a separate question. | Define public config schema, validation, units, and diagnostics; keep San Jose as fixture evidence only unless the app passes it as config. |
| `local-009` | Projection | `source-precision` | `MEAN_EARTH_RADIUS_KM = 6371.0088`. | Likely GRS80/IUGG family; legacy projection docs. | Exact authoritative source and rounding are not pinned. | Pin geodesy source or replace with cited radius value. |
| `local-010` | Units | `source-precision` | `KM_PER_MILE = 1.609344`. | Sourceable exact unit conversion. | Standards source not pinned. | Cite authoritative unit/standards reference or store canonical kilometers only. |
| `local-011` | Projection | `equation` / `model-config` | North-polar azimuthal-equidistant projection and app endpoint `x = r*sin(lon)`, `z = r*cos(lon)`. | Projection identity and source parameters are sourced to PROJ in record `018-m2-north-polar-aeqd-source-decision`; strong internal lineage supports the app model convention. | Projection source choice is closed for M2. App endpoint use is artificial, and formula-level production citation remains useful if the final implementation hand-codes the polar simplification. | Use north-polar AEQD for M2 flat geometry, keep `lat_0 = 90 deg`, `lon_0`, radius, and scene-axis convention explicit, and keep model use separate from external projection facts. |
| `local-012` | Solar clock | `equation` / `authored-config` | User local-time input, NOAA-style equation-of-time and solar-noon comparison labels, including `13:09` solstice sync rows. | User configuration plus NOAA/NREL source candidates for comparison labels. | Local time is configuration, not proof of real-time synchronization. Spherical-Earth comparison labels can be sourced, but the flat model has no independent real-time standard; synchronization is calibration policy. | Recompute comparison labels under cited NOAA or NREL SPA policy, and separately document the flat-model time anchor as configuration/calibration. |
| `local-013` | Source calibration | `equation` | Current POC closest calibration: `referenceSpectralIncidentScale = targetClosestIncidentScale / closestFalloff`. | Accepted POC derivation. | Artificial unit-scale calibration, not external radiometry; it compensates for missing source brightness and time-standard inputs. | Decide whether to preserve or replace with radiance/solid-angle/transmittance calibration, then test under finalized defaults. |
| `local-014` | Source calibration | `equation` | Planned cleaner calibration: `E_target(lambda) = L_sun(lambda) * Omega_reference * T_reference(lambda)`. | Legacy reset plan; radiometry source candidate. | Needs external radiometry citation and implementation evidence; still requires an authored reference event because real-time sync is not sourced by the model. | Promote as reconciliation candidate and test against POC behavior. |
| `local-015` | Source geometry | `equation` | Local Sun solid angle and small-disk limit. | Legacy reset plan; analytic geometry source candidate. | Needs final source citation and fixture rows. | Add analytic fixtures and cite geometry/radiometry source. |
| `local-016` | Source output | `derived-output` | `positionMeters`, `distanceKm`, `referenceSpectralIncidentScale`, `observerIncidentScale`, `skyPosition`, rotated longitude. | Derived by POC source module. | Risk of copying resolved packet values as constants. | Regenerate from canonical config; store only as diagnostics/artifact evidence. |
| `local-017` | Source spectrum | `display-fixture` | Stale local source tint `{ r: 1, g: 0.98, b: 0.95 }` and rough RGB-to-spectral grouping from earlier POC paths. | Inherited app fixture, reverted in accepted local-sun-second-order artifact `095-local-source-neutral-white-stack` with neutral white `sourceColorOverride = { r: 1, g: 1, b: 1 }`; `095` passed `30/30` criteria. | Old tint/grouping is stale POC residue, not current local-lane behavior or source-backed physics. | Recreate `095` under reconciliation, keep neutral/no-tint behavior as the current local-lane baseline, and guard production against stale tint fallbacks unless a source-backed spectral model replaces them. |
| `local-018` | Scope | `implementation-policy` | Local ground bounce remains deferred/excluded. Direct solar-disc camera radiance has moved to active Milestone 5 boundary-radiance prototype scope through row `future-004`. | Accepted scope decision; related Bruneton sources exist. | Ground bounce is not implemented in the local-source production path. | Keep ground bounce deferred unless a new sourced extension lane is opened. |
| `local-019` | Source | `equation` | Inverse-square finite-source falloff `(referenceDistanceKm / distanceKm)^2`. | PBRT/radiometry source candidate plus accepted POC use. | Final citation and point-source approximation limits are not in production ledger yet. | Cite point-light/radiometry source and state applicability limits. |
| `local-020` | Source geometry | `equation` | Apparent angular radius `atan2(radiusKm, distanceKm)`. | Analytic geometry candidate plus POC sample traces. | Final source/derivation row is missing. | Add analytic fixture and cite/derive from right-triangle geometry. |
| `local-021` | Source + geometry | `equation` | Finite local-source path clipping by flat top/ground; ground before source gives zero source transmittance. | Accepted atmosflat/shader-lab traces plus analytic geometry. | Needs final request/result descriptor and fixtures. | Add geometry-owned source-path fixtures and diagnostics. |

## Local Second-Order Cache And Shader Gaps

| ID | Owner | Role | Fact / value | Current support | Gap | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `cache-001` | Light/source implementation | `implementation-policy` | Local incident cache logical domain `z/rho/incomingDirection/wavelength`. | Accepted local L2 evidence. | Strong experimental support, weak external reference support. | Rerun oracle/cache parity under finalized parameters. |
| `cache-002` | Light/source implementation | `authored-config` | Exact cache bins: `z=[2,1000,5000,15000,45000]`, `rho=[0,500000,1250000,2500000,5000000,9000000,13000000]`. | Accepted POC execution config. | No convergence-backed production default yet. | Run convergence and choose final bins. |
| `cache-003` | Light/source implementation | `authored-config` | Direction counts: `9` cache directions, `34` runtime/default incident directions, `68` validation/reference directions. | POC evidence and Algorithm32 convergence packet. | Count mismatch needs explicit cache descriptor policy. | Resolve cache-vs-transport direction count before promotion. |
| `cache-004` | Light/source implementation | `authored-config` | Golden-ratio incoming directions over `z` from `-0.8` to `0.8`. | Experimental choice; Fibonacci/golden-angle source family exists. | Exact count/range are not sourced. | Source sampling family if retained; convergence-test exact range/count. |
| `cache-005` | Light/source implementation | `implementation-policy` | `nearest-neighbor-poc-grid` lookup. | Accepted POC guardrail. | Production interpolation policy not chosen. | Decide nearest-neighbor vs interpolation and test. |
| `cache-006` | Shader builder | `implementation-policy` | `rgba-3d-texture-v1`, spectral groups, `Data3DTexture` coordinates. | Accepted GPU evidence; Three API source exists. | Packing is implementation-specific and needs final shader parity. | Promote only with CPU/GPU parity and capability policy. |
| `cache-007` | Runtime shader | `implementation-policy` | HDR/float transport, depth precision, color-space/tone-map ownership, render-target lifecycle. | Shader-lab implementation notes. | Production policy not finalized. | Define before treating shader images as final appearance references. |
| `cache-008` | Runtime shader | `implementation-policy` | Shader shortcuts relative to CPU reference. | Allowed by design. | Must be named and tolerance-bounded. | Add shortcut registry in shader parity artifacts. |

## Display, Review, And App Fixture Gaps

| ID | Owner | Role | Fact / value | Current support | Gap | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `display-001` | Display / Three adapter | `display-fixture` | Three point/directional light scalar `2.4`, point-light `decay=0`, source-driven scene-light sync. | Local scene capture and shader-lab evidence. | Display policy, not Algorithm32 radiometry. | Keep outside transport; document only if product needs scene-light coupling. |
| `display-002` | Display / review | `display-fixture` | Terrain assets, Southern France OBJ, Rocky Land heightmap, material choices. | Subjective evidence. | Not physics authority. | Recreate as review artifacts only, or add deterministic image criteria. |
| `display-003` | Display / review | `display-fixture` | Stars, constellation overlays, star exposure/intensity/density/point size. | Optional display evidence. | Not Algorithm32 transport; no photometric source path. | Keep review-only or create display/photometric source model. |
| `display-004` | Display / review | `display-fixture` | Antialiasing, render scale, shadows, camera fit/yaw, labels. | Review process evidence. | Not transport constants. | Keep as artifact recreation config. |
| `display-005` | Color/display | `implementation-policy` | App HDR/tone mapping outside Bruneton Figure 1 comparison `k`. | Open design. | Figure 1 `k` is comparison-only; app display policy not sourced/final. | Define separate app display policy after spectral transport. |

## Future Or Deferred Profile Decisions

These are not current first-profile gaps, but they must stay out of the initial
production constants unless explicitly reactivated.

| ID | Owner | Role | Fact / value | Current support | Gap | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `future-001` | Atmosphere | `authored-config` | Bucholtz Rayleigh / alternate standard-air profile. | Future source candidate. | Not the current Algorithm32 canonical profile. | Keep as future named profile. |
| `future-002` | Atmosphere | `authored-config` | Ozone-enabled profile and absorption model. | Bruneton demo source exists; Step 032 disables ozone. | Not active Figure 1 profile. | Keep future named profile unless explicitly selected. |
| `future-003` | Atmosphere | `authored-config` | Alternate aerosol presets. | Source candidates exist. | Not initial profile. | Keep as future named profile. |
| `future-004` | Light source / color-display / shader composition | `implementation-policy` | Visible direct solar disc / Sun disk camera radiance. A view ray can terminate at the source itself: distant Sun by angular-radius test, local Sun by ray-sphere intersection against source position/radius; scene hits in front occlude it. The active Milestone 5 composition target is `pathRadiance + viewTransmittance * celestialRadiance`, with source spectral radiance and display/tone mapping outside `evaluate(...)`. | Bruneton rendering source exists, but Step 032 omits direct solar-disc camera radiance. Current POC facts already include distant angular radius `0.004675 rad` and local false-Sun radius `25749.504 m`; the winter-solstice 2025 local 180-degree scene has an apparent local-source diameter of about `0.1545 deg`, or only about `0.44 px` at `128` image lines with `45 deg` vertical FOV. A real distant Sun is only about `1.5 px` tall at that same resolution. | Needs a named source-owned visible-emitter descriptor, source-radiance calibration from spectral irradiance and apparent solid angle, antialiasing/subpixel coverage so tiny disks do not flicker or vanish, CPU/GPU parity implementation, occlusion against existing scene hit/depth facts, and an HDR/tone-map/display policy for saturated solar radiance. It should not be rendered as a normal Three mesh whose RGB is captured as hit color. | Active Milestone 5 prototype. First proof can be CPU-only in the postprocess shader path; promotion needs the shared descriptor, JS/GLSL hit tests, selected-pixel diagnostics, CPU/GPU comparison records, and a display shortcut registry entry for any nonphysical clamping or bloom. |
| `future-005` | Surface/atmosphere | `implementation-policy` | Ground bounce / surface reflection coupling. | Bruneton source exists; Algorithm32 Step 032 omits it. | Not first production contract. | Defer or create sourced surface/ground extension. |
| `future-006` | Boundary/atmosphere | `implementation-policy` | Reflective dome optical boundary. | User follow-up idea during M2 flat-domain discussion. | Not part of the current truncation profile; needs ownership and optical-material model. | Defer as a named boundary-material/profile extension. Geometry may report dome hits, but reflection/transmission must be explicit radiance behavior, not hidden in intersection or altitude sampling. |

## Immediate Action Order

1. Recover and pin the default-profile sources for false-Sun altitude, size,
   and annual latitude migration, while keeping those values configurable.
2. Define the public view-placement config: latitude, longitude, local time,
   view altitude, and the boundary where the app derives/defaults altitude
   before passing it into Algorithm32.
3. Define the steel-man flat-world profile boundary: which local Sun and flat
   geometry parameters are user-configurable, which defaults seed the initial
   profile, and which diagnostics show consequences.
4. Build `parameters.md` with a `factRole` field using this document's roles.
5. Source or accept the equations that act on authored configuration:
   projection, source placement, solid angle, inverse-square falloff,
   transmittance, calibration, and ray clipping.
6. Pin production reference pointers for baseline Step 032 source-precision
   rows before promoting constants.
7. Resolve flat atmosphere/profile top boundary and no-hit sky cap policy.
8. Resolve local-source calibration for brightness and time anchoring: current
   unit incident-scale rule or radiance/solid-angle/transmittance calibration.
9. Recompute spherical-Earth solar-time comparison labels with a cited
   solar-position policy, and document the flat-model time anchor separately.
10. Rerun local L2 cache convergence and CPU/GPU parity before promoting bins,
   direction counts, lookup, or texture packing.
11. Keep display/review fixture rows out of Algorithm32 physics unless a later
   display policy explicitly promotes them.
