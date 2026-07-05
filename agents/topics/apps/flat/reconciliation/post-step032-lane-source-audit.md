# Post-Step032 Product Facts Audit

Status: reconciliation intake audit for post-Step032 product-driving facts.

This note mines the accepted source-abstraction, shader-lab, and local
second-order lanes in reverse chronological order. Its purpose is to identify
pure facts that drove, constrain, or must be excluded from the final product.

Generated artifacts are not product facts. They are evidence handles. A
numbered output, screenshot, comparison image, or browser capture is useful
only when it supports a retained algorithm/model/interface fact, records a
selection among supported candidates, or defines a regression target that must
be recreated. Otherwise it remains review history.

This is not the final parameter ledger. Use it with
[Bruneton Start-Fresh Source Audit](bruneton-start-fresh-source-audit.md),
which establishes Step 032 as the authoritative pure Algorithm32 baseline.

## Product Fact Filter

A retained post-Step032 fact is product-driving only when it changes or
constrains one of these things:

- The canonical Algorithm32 baseline, or a named deviation/extension from it.
- A light/source, geometry, atmosphere, color/display, cache, shader, or
  validation responsibility boundary.
- The shape, unit, owner, or flow of data crossing a boundary.
- A formula, numerical control, cache contract, shader binding, or tolerance
  that production would need to reproduce.
- A fail-loud rule or explicit non-promotable exclusion.

Audit newest accepted decisions first and treat earlier lane material as
history only when it explains the latest retained state. Do not reopen
reversed branches just because they contain constants. A retained fact is
promotable only when it has one of these support types:

- Exact Step 032 preservation or regression parity.
- External reference or source-backed derivation.
- Accepted Algorithm32 experiment/decision with recorded criteria.

Anything else is a reconciliation finding. It may still be useful POC evidence,
but it must not become a silent production default.

## Product Facts Summary

No post-Step032 lane was found to invalidate the Step 032 pure Algorithm32
baseline. The later lanes mostly add source abstraction, renderer/geometry
boundaries, CPU/GPU parity evidence, local-source model behavior, local
second-order cache evidence, and evidence-only subjective display/terrain
fixtures.

The largest reference gaps are in the local Sun family. The local lanes have
accepted experimental support, but many local-source, scene-light, terrain,
time-sync, star-display, and RGB-tint choices are model/display fixtures rather
than externally sourced atmosphere constants. Reconciliation should keep those
separate from the canonical Algorithm32 profile and either source them, record
them as named model decisions, or leave them out of the initial production
profile.
Use
[Local Sun Flat Geometry Fact Inventory](local-sun-flat-geometry-fact-inventory.md)
for the detailed local Sun / flat-geometry inventory, including external-source
candidates, model-only parameters, and long-sightline/cache reconciliation
tasks.
Use
[Unsourced And Partially Sourced Facts](unsourced-and-partially-sourced-facts.md)
as the single actionable checklist for source gaps and non-promotable fixture
facts.

| Product-driving fact | Support type | Reconciliation action |
| --- | --- | --- |
| Step 032 remains the canonical pure Algorithm32 baseline. Later lanes do not replace its pure atmosphere profile, equations, or constants. | Step 032 audit; atmosflat exact preservation. | Build the final parameter ledger from Step 032 first. Layer later facts only as named extensions, implementation contracts, or exclusions. |
| Source abstraction is retained. Algorithm32 transport asks a light/source boundary for incident/source facts instead of hardcoding the Sun path inside transport. | Atmosflat `019` exact parity; shader-lab source-driven pass; local L2 incident-field work. | Promote source abstraction while preserving exact distant-source parity with Step 032. |
| Geometry owns ray distance, altitude resolution, intersection mechanics, and flat-vs-spherical coordinate policy. It can calculate atmosphere exits when given the active atmosphere/profile domain. Renderer-owned sky caps or terrain fixtures do not become generic transport constants. | Atmosflat local cap scoping; shader-lab live scene-depth shape; production-design mining; record `019-m2-atmosphere-boundary-ownership`. | Keep renderer fixtures out of the algorithm ledger. Define geometry request/result data explicitly and pass atmosphere-domain descriptors into geometry instead of hard-coding them there. |
| Atmosphere owns medium samples, density facts, extinction/scattering coefficients, medium-domain descriptors such as top altitude/radius, and the canonical initial atmosphere profile. | Step 032 baseline; production scaffold direction; record `019-m2-atmosphere-boundary-ownership`. | Source every promoted atmosphere value in the final ledger. Do not infer new atmosphere constants from local Sun or terrain artifacts. |
| Color/display is outside CPU transport. The GPU phase needs a color/display interface to produce renderable output, but spectral CPU transport must not depend on it. | Shader-lab production-shape decisions; current Algorithm32 status/design. | Define the display boundary during CPU reference design, then bind it during GPU shader work. |
| The product shader shape is live Three scene color plus live depth into an Algorithm32 fullscreen pass. JSON/Raycaster packets are validation-only. | Shader-lab `224`, `226`, `227`. | Rebuild GPU integration against the CPU reference and do not promote packet replay as the runtime path. |
| Shader-lab justification is implementation parity against an Algorithm32-backed CPU reference, not independent algorithm/reference support. | Shader-lab `094`, `193`, `224`; accepted CPU/GPU comparison workflow. | Reconciliation must first prove the CPU reference stayed baseline-faithful, then use shader parity to prove the GPU implements that CPU reference within stated tolerances. |
| The shader is allowed to take implementation shortcuts relative to the CPU reference. Shortcuts do not redefine Algorithm32. | Shader-lab approximation/packing work; accepted parity workflow. | Promote shader shortcuts only when they are named, bounded, and tested against the baseline-faithful CPU reference. |
| Local Sun behavior is a named light/source extension, not a replacement for the canonical distant-source baseline. | Atmosflat `018`; shader-lab local first-order; local-second-order lane. | Decide whether local Sun belongs in the first production profile. If included, specify/source its model and calibration separately. |
| Local second-order is represented through a source-owned incident-radiance boundary: `L1_incident = incidentField.sample(position, incomingDirection, wavelength)`. | Local second-order scattering notes and accepted cache/GPU lane criteria. | Promote the interface shape only after sign, unit, descriptor, and cache-key tests are recreated under reconciliation. |
| Local incident-radiance cache is a light/source implementation detail behind the source interface. Its logical POC domain is `z/rho/incomingDirection/wavelength`; exact grid and packing values are experimental configuration. | Local-second-order accepted cache-shape and GPU integration work. | Rerun convergence and parity before promoting exact bins, counts, or packing defaults. |
| Fail-loud behavior for unsupported or mismatched source/cache/shader combinations is retained. | Atmosflat, shader-lab, and local-second-order guardrails; current production design. | Preserve as production invariant. No silent fallback to distant Sun, first-order-only, default source, stale cache, or no-cache behavior. |
| Stale inherited RGB source tint, terrain assets, stars, render scale, antialiasing, shadows, camera fits, and time-sync labels are not Algorithm32 physics facts. | Local-second-order and production guardrail mining. The tint was specifically reversed in accepted artifact `095-local-source-neutral-white-stack`. | Keep display/review fixtures out of physics. Treat the old tint and rough RGB grouping as stale POC residue; current local-lane recreation should use the neutral-white reversal unless a later source-backed spectrum replaces it. |

## Local Sun Second-Order Facts

Evidence handles consulted:

- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/README.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/experiment-plan.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/scattering-notes.md`
- `scripts/flat/local-second-order/README.md`
- `tmp/atmosphere/local-second-order/009-local-incident-field-oracle/`
- `tmp/atmosphere/local-second-order/011-local-cache-shape/`
- `tmp/atmosphere/local-second-order/012-cpu-soft-shader-local-l2/`
- `tmp/atmosphere/local-second-order/020-three-integrated-gpu-local-l2/`
- `tmp/atmosphere/local-second-order/021-objective-subjective-local-l2-matrix/`
- `tmp/atmosphere/local-second-order/022-promotion-notes/`
- `tmp/atmosphere/local-second-order/030-subjective-l2-cache-comparison/`
- `tmp/atmosphere/local-second-order/088-southern-france-obj-diffuse-high-local-stack-toward-180sun-fit-w/`
- `tmp/atmosphere/local-second-order/092-southern-france-obj-diffuse-high-distant-local-solstice-daylight/`
- `tmp/atmosphere/local-second-order/093-southern-france-obj-diffuse-high-local-distant-solstice-time-pai/`
- `tmp/atmosphere/local-second-order/095-local-source-neutral-white-stack/`

Product-driving facts and audit result:

| Product-driving fact | Support trail | Audit result |
| --- | --- | --- |
| Source-neutral incident-radiance boundary: `L1_incident = incidentField.sample(position, incomingDirection, wavelength)` | Scattering notes; accepted evidence handles `009`, `011`, `012`, `020`, `021`, `022` | Accepted experimental design support. This is a clean extension boundary, not a change to Step 032 pure transport. Reconciliation should promote the interface only with final data-shape and sign-convention tests. |
| Local second-order cache stores first-order incident radiance over `z/rho/incomingDirection/wavelength` | Accepted `011-local-cache-shape`; `010` rejection showed raw world-direction caching was wrong; `020` and `021` prove GPU/local L2 path | Accepted experimental support. Exact grid values and counts are not external constants. |
| Accepted local cache grid for subjective rows uses `z=2,1000,5000,15000,45000 m`, `rho=0,500000,1250000,2500000,5000000,9000000,13000000 m`, `9` incoming directions, and `15` wavelengths, for `315` cache entries per local source | Cache keys in `011`, `020`, `088`, `095`; local runner reports | Experiment-backed execution configuration only. Needs convergence rerun under reconciliation before production default promotion. |
| GPU cache packing uses Three `Data3DTexture`, with RGBA groups for the 15 spectral channels | `020-three-integrated-gpu-local-l2`; `scripts/flat/local-second-order/README.md`; POC helper in `shared/algorithm32/POC/local-second-order/` | Accepted GPU implementation evidence. Texture packing is a shader-builder implementation decision, not Algorithm32 physics. |
| Local source cache key includes source/config/grid/packing and fails on mismatches | Accepted `011-local-cache-shape`; criteria require source/cache key inclusion and fail-loud invalid lookup | Accepted experimental guardrail. Reconciliation should keep fail-loud behavior as a production invariant. |
| Local closest and local `90` are retained validation cases for integrated GPU L2 parity under the POC config | Accepted `018`, `019`, `020`, `021`; `021` records CPU/GPU selected diagnostics with small byte deltas and nonzero local L2 image effect | Accepted local L2 proof. It proves implementation/parity under the POC config, not absolute physical validation. |
| Final local source position family derives from the flat app annual tropic-migration latitude model and forward-time offsets, superseding the fixed `24 deg N` table | Local README and runner README; accepted `088`, `092`, `093` | Accepted model/fixture support, but not external-source support. The production local Sun model needs its own source/spec if promoted. |
| Summer-solstice comparison uses `2026-06-21`, San Jose solar-noon sync at `13:09`, and rows tied to local solar time/sun sky labels | Accepted `092` and `093` | Useful subjective/model comparison evidence. Exact solar-time values need reproducible solar-position provenance before becoming validation constants. |
| Local source RGB tint from flat-app config was reverted to neutral white in the latest local-sun-second-order diagnostic | Accepted artifact `095-local-source-neutral-white-stack`; production guardrails already reject inherited tint identifiers and `{ r: 1, g: 0.98, b: 0.95 }` from production source/type/reference files | Treat `095` as current local-lane evidence that the tint was a stale fixture, not a retained product-driving fact. Reconciliation should recreate neutral/no-tint behavior and only introduce non-neutral source spectrum through a backed spectral model. |
| Southern France OBJ, Rocky Land heightmap, and `three-terrain-js` are retained as display/review fixtures only | Accepted terrain sequence through `095`; lane README summarizes superseded/rejected terrain attempts | Subjective/display evidence only. Terrain assets, material policies, antialiasing, render scale, shadows, and camera fits are not Algorithm32 constants. |
| Review-quality terrain captures used hardware WebGL diagnostics, antialiasing, and `renderScale: 2` when judging directional terrain detail | Accepted diagnostics `058`, `059`, later Southern France matrices | Display/review process fact. Not a transport constant. |
| Optional procedural star field is sky-ray-only, composed before tone map, and does not light terrain | Accepted `086`, inherited in later stack commands; `088`, `092`, `093`, `095` mention star field in command goals | Display extension evidence only. `density`, `pointSize`, and `intensity` are not Algorithm32 physics constants and need separate source/model support if promoted. |

Local lane findings:

- The core local L2 abstraction has strong experimental support but weak
  external-reference support. That is acceptable if production labels it as an
  Algorithm32 extension and reruns convergence/parity under finalized
  parameters.
- Exact local cache resolution values are the most important numerical
  reconciliation target in this lane.
- Local source placement and calibration are the largest provenance gap. They
  descend from the flat-app false-Sun model and accepted atmosflat evidence,
  not from the Bruneton/Step032 atmosphere references.
- Local RGB tint must remain excluded from production physics. The accepted
  `095` neutral-white diagnostic is the latest local-lane evidence and records
  the reversal/removal of that inherited fixture.
- Terrain, stars, live shadows, render scale, and camera yaw/footprint fits are
  review/display fixtures. Preserve them as evidence recreation targets, not
  as Algorithm32 constants.

## Shader-Lab Facts

Evidence handles consulted:

- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-canonical-reference.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/README.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/shader-078-cpu-local-source/`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/shader-094-cpu-soft-shader-matrix/`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/shader-193-packet-gpu-parity/`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/shader-220-three-local/`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/shader-224-live-pass-matrix/`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/shader-226-production-shape/`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/shader-227-postprocess-vs-integrated/`

Product-driving facts and audit result:

| Product-driving fact | Support trail | Audit result |
| --- | --- | --- |
| CPU soft shader is the oracle for scene-input composition: hit pixels use `sceneColor * T_view + L_path`; sky pixels use `L_path` | Canonical reference; accepted `094-cpu-unified-source-driven-soft-shader-matrix` | Accepted parity/oracle support. It is validation infrastructure, not a second physics authority. |
| Packet GPU shader parity endpoint covers distant high/low and local `0/45/90/135/180` first-order cases with `maxAbsRgbDelta <= 1` | Accepted `193-soft-shader-capability-parity-matrix`, retaining `172`, `174`, `185`, `192` | Accepted GPU parity support. It proves shader implementation of the soft-shader packet contract; packet replay remains validation-only architecture. |
| Three-native production target shape is live scene color + live depth -> `Algorithm32AtmospherePass` fullscreen shader -> final camera view | Accepted `226-three-native-production-shape-review`; `224` live-pass matrix | Accepted integration support. This is architecture/implementation evidence, not an external atmosphere reference. |
| Source config drives both Three lights and atmosphere uniforms | Accepted `220`, `222`, `224`, `226`; source-light coupling documented in iteration plan | Accepted integration support. Three light intensity mapping remains a display/scene-light policy, not Algorithm32 radiometry. |
| Local first-order integrated shader uses flat/local source uniforms, finite source position/distance/falloff, source-path transmittance, and flat geometry | Accepted `220-three-native-flat-local-first-order-atmosphere`; local source packets trace to atmosflat `018` | Accepted experimental support, inherited from atmosflat local-source decisions. Local L2 was not part of shader-lab `220`; it was handled later in local-second-order. |
| Distant midday, distant sunset behind camera, local closest, and local `90` are retained live-pass validation cases against the CPU/GPU soft-shader oracle | Accepted `224-three-native-live-pass-soft-shader-matrix` | Accepted objective integration evidence. Full-image deltas in `227` are subjective inspection material, not a parity gate. |
| Production-shape review keeps `setConfig({ source, geometry, atmosphere, display })`, debug views, fail-loud unsupported combinations, and normal rendering on live Three targets | Accepted `226-production-shape` | Good production seed decisions. Reconciliation should convert these into explicit data-flow contracts. |

Shader-lab findings:

- Shader-lab does not appear to introduce new Algorithm32 atmosphere constants.
  Its retained value is CPU/GPU implementation parity,
  source/geometry/display boundaries, and the live Three pass shape.
- Most shader development was justified by matching shader-generated output
  against an Algorithm32-backed CPU reference. That proves shader
  implementation only if the CPU reference itself has not drifted from the
  Step 032/parameter-ledger baseline. Reconciliation must prove CPU baseline
  fidelity before treating shader parity as production evidence.
- Shader code may take shortcuts relative to the CPU reference, such as texture
  packing, interpolation, precision choices, branch reduction, cached incident
  radiance, or other GPU-oriented approximations. Those shortcuts are valid
  implementation choices only when named, bounded by tolerances, and tested
  against the baseline-faithful CPU reference. They are not new Algorithm32
  algorithm facts.
- Remaining shader-lab gaps are implementation policy gaps: HDR/float transport
  beyond RGBA8 POC readback, depth near/far and precision policy, render-target
  lifecycle, color-space/tone-map ownership, and final shader packing.
- Flat/local first-order behavior in shader-lab inherits atmosflat local-source
  provenance. It should not be promoted independently without the atmosflat and
  local-second-order audits.
- Direct solar-disc camera radiance, local ground bounce, local second-order in
  shader-lab, and non-Earth presets remain explicitly deferred.

## Atmosflat32 Source-Abstraction Facts

Evidence handles consulted:

- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/atmosflat32-source-abstraction-prompt.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/atmosflat-019-distant-baseline/`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/atmosflat-018-local-skydomes/`
- `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes/`
- `tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/`

Product-driving facts and audit result:

| Product-driving fact | Support trail | Audit result |
| --- | --- | --- |
| Default `distant-directional-sun` source abstraction preserves Step 032 behavior | Accepted `019-distant-source-abstraction-baseline`; exact PNG byte parity against all four Step 032 domes; selected-ray deltas all zero | Strong accepted support. This is the clean bridge from Step 032 into source abstraction. |
| Display conversion remains post-transport; no direct solar-disc camera radiance remains active for the Step 032 profile | `019` criteria and report | Preserves Step 032 target contract. |
| Local source adapter owns finite source direction, distance, inverse-square/reference falloff, incident scale, source-path transmittance, and future angular-emission profile | `atmosflat32-source-abstraction-prompt`; accepted `018-flat-app-rotation-skydomes` | Accepted model-extension support. It is not a Bruneton atmosphere constant. |
| Local finite source uses `incidentScale = intensity * solarIrradianceScale * (referenceDistanceKm / distanceKm)^2` | `018` equations/constants and criteria | POC model support. Needs a production source/model reference or explicit Algorithm32 model decision if promoted. |
| Local source calibration matches closest approach to `1x` distant high-Sun incident scale | Accepted `018`; closest distance `5050.674164842701 km`, falloff `0.9031996723576281`, calibrated scale `1.1071748923354825` | User/model calibration support, not external physics. Keep as a named local-source model decision if used. |
| Raw flat-app `solarIrradianceScale: 58`, `referenceDistanceKm: 4800`, and original closest incident scale `52.38558099674243` are provenance facts for the app fixture | Accepted `018` report | App-fixture provenance only. Do not promote as general atmosphere/source constants without a model spec. |
| Local observer skydomes use a flat z-up atmosphere and a round-equivalent artificial observer cap with footprint radius `875.656645 km` | Accepted `018`; cap uses Step032/Bruneton bottom/top radii and is scoped to observer angular sky rendering | Renderer-scoped experimental geometry. It must not leak into source transmittance or scene ray lengths. |
| Local offsets `0`, `45`, `90`, `135`, `180` are the accepted diagnostic/source-matrix family | Accepted `018`; user-requested diagnostic matrix | Diagnostic case set, not a physical constant. |

Atmosflat findings:

- `019` is high-quality evidence: source abstraction preserves Step 032 exactly.
- `018` is useful, but it begins the local Sun model gap. Its retained local
  source numbers are accepted POC/model decisions, not external atmosphere
  references.
- The artificial cap and flat sky ray policy are properly scoped in the
  artifact. Reconciliation should preserve that scoping and prevent cap values
  from becoming generic transport constants.

## Reconciliation Findings

1. Build the final parameter ledger from Step 032 first, then layer post-Step032
   decisions as named deviations or extensions.
2. For the local second-order cache, rerun direct/oracle versus cache
   convergence under finalized parameters before promoting exact `z/rho/dir`
   counts, bin values, and packing defaults.
3. Decide which local Sun model, if any, belongs in the first production
   implementation. If included, source or explicitly specify the annual
   tropic-migration model, source position rules, calibration target, reference
   distance, time-sync policy, and any latitude/altitude limits.
4. Keep inherited flat-app source tint out of production physics. Use the
   accepted `095` neutral-white diagnostic as evidence that the tint was
   reverted, not retained as a sourced spectral model.
5. Promote shader-lab's live Three pass shape, allowed shader shortcuts, and
   parity gates only as shader implementation evidence against a proven CPU
   reference. Keep JSON scene packets, RGBA8 readback, and packet replay as
   validation-only unless a later production decision says otherwise.
6. Define production HDR/float/color-space/depth policies before treating
   shader-lab images as final appearance references.
7. Classify terrain, antialiasing, render-scale, shadow, camera-fit, and star
   artifacts as subjective/display evidence unless a reconciliation evidence run
   gives them deterministic numeric criteria and source/model provenance.
8. Preserve fail-loud behavior for unsupported source/geometry/cache
   combinations. No future lane should silently fall back to distant Sun,
   first-order-only, default source, stale cache, or no-cache behavior.

## Reconciliation Use

Use this audit in Phase 1 when building `parameters.md`,
`equations-and-constants.json`, and the data-flow contract:

- Treat Step 032 plus atmosflat `019` as the authoritative pure/distant-source
  baseline and source-abstraction bridge.
- Treat shader-lab `226` and `224` as the accepted GPU integration/parity
  shape to reimplement against the reconciled CPU reference. This justifies the
  shader implementation, including named shortcuts within tolerance, not the
  algorithm by itself.
- Treat local-second-order `009`, `011`, `012`, `020`, `021`, and `022` as the
  accepted local L2 experimental support that must be rerun under finalized
  parameters.
- Treat local-second-order `030`, `088`, `092`, `093`, and `095` as evidence
  families to recreate or classify, not as physics authority by themselves.
- Record every post-Step032 deviation from the baseline by name, support type,
  and measured effect.
