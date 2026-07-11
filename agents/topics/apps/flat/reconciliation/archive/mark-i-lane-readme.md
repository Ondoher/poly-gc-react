# Reconciliation Lane

Current status lives in [Status](status.md), and final POC decisions live in
[Conclusions](conclusions.md). The reconciliation POC is reopened for a
focused boundary-radiance experiment after the production `flat32` star
diagnostic showed that captured display-style scene RGB is not a sufficient
visibility model for stars or other outside-atmosphere bodies.

The active reopened work is narrow: prototype an explicit external
boundary-radiance provider sampled along the camera ray and composed as
`pathRadiance + viewTransmittance * celestialRadiance`. The prototype must
also include a source-provided companion boundary-radiance provider for the
visible Sun disk, proving that one illumination-capable source can expose both
atmosphere illumination and camera-ray visibility roles without duplicating
source facts. Stars and visible disks must not be folded into the
incident-radiance/L2 cache. Optional sky illumination from Moon or starfield
radiance remains a separate later source/cache concern.

Milestone 2 is closed by record `050-m2-closeout`; Milestone 3 Subgoals 3.3
and 3.4 are closed by records `063-m3-shader-descriptor` through
`066-m3-browser-diagnostics-readiness`. Earlier reconciliation closeout
decisions remain valid unless this focused experiment explicitly supersedes a
visibility/composition contract.

This lane expands the
[Algorithm32 conclusions follow-up](../algorithm32/conclusions.md#follow-up-reconciliation-lane)
into the working plan for the next atmosphere implementation pass. It is the
bridge between the accepted Algorithm32 experiments and production promotion
under `shared/algorithm32/production/`.

The accepted Step 032 result is the authoritative pure Algorithm32 baseline
for this lane. The Bruneton start-fresh source audit found no active retained
Step 032 pure-algorithm ingredient with neither an external reference nor
accepted experimental support. Reconciliation therefore starts from that
baseline, tightens the parameter ledger, and reruns evidence under finalized
parameters rather than rediscovering the algorithm from scratch.
This baseline also becomes the comparison anchor for future atmosphere
experimental lanes: intentional deviations must be named, justified by source
or accepted experiment, and measured against the baseline; unjustified drift
must remain rejected or unresolved rather than becoming a new default.

## Goal

Reconciliation has three concrete end results:

1. Build a new CPU reference implementation of Algorithm32 with
   reference-backed algorithms, reference-backed or explicitly accepted
   constants, and strict separation between the light/source, geometry,
   atmosphere, incident radiance cache/sampler, and color boundaries.
2. Build a GPU shader implementation that implements the CPU reference within
   documented tolerances. The shader may take named implementation shortcuts,
   but those shortcuts must be bounded and tested against the CPU reference.
3. Finish with the exact shape and flow of all data known and documented,
   including configuration, model facts, spectral basis, ray/path requests,
   source samples, geometry intersections, medium samples, transport state,
   incident-radiance cache descriptors, sampler bindings, shader
   textures/uniforms, spectral outputs, diagnostics, and color/display
   requests.

The CPU reference uses light/source, geometry, atmosphere, and bound incident
radiance sampler callbacks to execute spectral transport. The color/display
boundary is defined during the CPU reference phase but is not required to
execute CPU transport. The later GPU shader phase needs the color/display
interface to convert spectral transport output into renderable output.
Milestone 1 is where the whole CPU Algorithm32 path and abstraction surface
must become complete: the main algorithm should produce spectral data only and
should not contain distant-source, spherical-geometry, specific-atmosphere,
absent-L2-cache, rendering, or color assumptions. Milestone 1 also builds,
binds, and samples the distant-source L2 incident-radiance cache needed for
the Bruneton Step 032 parity gate. Milestone 2 should then be mostly concrete
local-source and flat-geometry implementation against the established
contracts, with acceptance based on confidence in the methods rather than
exact reproduction of the historical atmosflat32 sky domes.

## Lane Roots

- Documentation: `agents/topics/apps/flat/reconciliation/`
- Mutable POC implementation: `scripts/flat/reconciliation/POC/`
- Numbered evidence records: `tmp/atmosphere/reconciliation/NNN-*`
- Production destination: `shared/algorithm32/production/`
- Source synthesis: `agents/topics/apps/flat/algorithm32/conclusions.md`
- Historical local second-order lane:
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/`

Artifact reset note: the previous `tmp/atmosphere/reconciliation/` evidence
set is being preserved by renaming it to
`tmp/atmosphere/reconciliation_mark_i/`. Fresh Milestone 5 work should create
new numbered records under a new `tmp/atmosphere/reconciliation/NNN-*` root
after that rename. The Mark I folder is archive/evidence material only; do
not runtime-link active POC code to it. Older record references in this lane's
historical sections may need to be read under the Mark I archive after the
rename.

Do not write new reconciliation artifacts under the historical
`tmp/atmosphere/local-second-order/` root. Recreate accepted evidence into the
new reconciliation artifact root when it becomes part of this lane.

This lane differs from the previous cumulative experiment lanes. The POC code
is a living implementation that will be updated in place under
`scripts/flat/reconciliation/POC/`. Milestone 0 is scaffold preparation, not a
formal experiment. It is accepted when the mutable skeleton exists, even if
that skeleton is imperfect and later iterated. The durable history for later
substantive verification comes from numbered record folders under
`tmp/atmosphere/reconciliation/`, one folder per significant run, parity
target, rejected attempt, or design-verification step. Those folders record
what changed, when, why, what was checked, and which facts, references, or
artifacts were produced; they do not need to be self-contained rerunnable
experiments.

Mutable current-state notes are also part of the lane. Use the topic README,
Algorithm32 status, active-topic handoff, and the POC `CURRENT_STATE.md` to
summarize the current architecture, current parity status, active blockers,
latest accepted record, and next actions. These notes may be rewritten as the
living POC changes; numbered records remain the append-only history.

Historical POC and experiment code may be mined, copied, or ported into the
new POC with provenance, but `scripts/flat/reconciliation/POC/` must own its
runtime code. Do not import, symlink, re-export, or otherwise link to preserved
POC bundles or earlier experiment scripts in place.

Artifact and evidence gaps should be recorded unless they are egregious. The
hard artifact rule for this lane is matching the sky dome/four-view artifacts
created by Bruneton start-fresh Experiment 32 / Step 032 at
`tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`.
Other missing diagnostics, criteria files, or historical convenience artifacts
are findings unless they make the current milestone's verification claim
impossible.

All complex POC types must have named ambient declarations in an owning
`types.d.ts` file, and JavaScript code must use JSDoc to record where those
types are consumed or produced. This applies to packets, descriptors,
requests, samples, callbacks, handles, diagnostics, shader contribution
packets, cache keys, and persisted artifact shapes. It keeps the mutable POC
productizable without later inferring type shapes from implementation object
literals.
Abstraction contracts must be ambient `interface` declarations, not `type`
aliases. Value packets, descriptors, records, discriminated unions, and tuple
aliases can remain `type`s when that better matches their data role.
Behavior members on abstraction interfaces use regular method signatures, not
properties with function types. Callable callback interfaces may use call
signatures.
Runtime class modules use one file per class, with that class as the file's
single default export. Required complex types stay in `types.d.ts`, not inline
in class files.
POC class names only need to be clear working names for the current
architecture. They are not production API commitments and should not block
Milestone 1 implementation work.

Use [Experimental Guidelines](experimental-guidelines.md) as the operating
rulebook for reconciliation artifacts, criteria, provenance, tolerance policy,
browser runs, display outputs, and closeout updates.
Use [Action Plan](action-plan.md) as the living milestone order for the
mutable POC lane. It may be updated during execution as numbered records and
current-state notes reveal better sequencing.
Use [Algorithm32 Abstraction Design](algorithm32-abstraction-design.md) as the
current design target for separating geometry-owned spatial/source-relative
facts from light-source-owned lighting facts while preserving the accepted
Algorithm32 transport algorithm. It now treats incident radiance cache/sampler
as a fifth abstraction boundary for generated incoming-radiance fields, with
`null`, `distant`, and `local` cache variants selected at configuration/setup
time and runtime sampling reduced to an `IncidentRadianceSampler` callback.
It also has the coordinate-systems reference
for configuration space, geometry model space, ray/path parameter space,
observer-local sky space, source-relative space, cache space, shader inputs,
and display/color output, plus the synthesized source-relative position and
cache-indexing requirements that encompass both distant and local Sun
implementations. It also contains the owner-query `evaluate(...)` Markdown
algorithm, listing only calculation-consumed outputs with function-style
owner-query notation, bold variable names, and plain Markdown calculations
using `<sub>`/`<sup>` tags where subscript or exponent notation helps. The
source-backed portion of that loop is the optical-depth/transmittance and
volume in-scattering equation family; local cache dimensions, sample counts,
finite-source bounds, and direction-set choices remain configuration/evidence
decisions rather than external physics constants. The canonical path rule is
fixed endpoint/trapezoid. The
algorithm now explicitly surfaces `AtmosphereCoordinate`,
`SourceRelativePosition`, light-source-owned `sourcePathLimit`, and
geometry-owned `sourceAtmospherePath` handoffs to reduce cross-interface
leakage; the coordinate-space section now names `AtmospherePath` as the
geometry-owned path transform into atmosphere coordinates plus segment
measures. The cache design now treats `IncidentRadianceCache` as a coordinated
generated incident-radiance field: the light source creates the source-shaped
concrete cache, such as a local-Sun or distant-source cache. The
concrete cache owns its configured coordinate generator and keying; the
setup/build coordinator is generic and passes each cache-owned coordinate back
to the cache with geometry, atmosphere, light source, and the general
calculator.
Geometry maps cache build coordinates
and runtime path integration points into the same source/atmosphere-relative cache-access
domain, atmosphere/transport produce the radiance values, and setup validates
the built cache against active context descriptors before evaluation receives
an optional `IncidentRadianceSampling` value. When present, that value contains
the operation-ready `IncidentRadianceSampler` callback plus cache-access
metadata; when omitted, no cache lookup occurs and incident in-scattering sees
an empty sample set. The public operation is
`incidentRadianceSampler(cacheAccess)`, where `cacheAccess` is resolved by
geometry from current path-integration-point facts such as point position and
`AtmosphereCoordinate`. Shader setup uses the same logical cache through
cache-owned texture creation requests and cache-owned access assemblies:
`IncidentRadianceCache` owns the cache data, texture shape, texture creation
call through `TextureBuilder`, and lookup code; `ShaderBuilder` consumes those
contributions and assembles/compiles them. The design explains how coordinate
spaces transform across configuration acceptance, cache building, shader
packing, and the sample loop.
Use [Shader Design](shader-design.md) as the Milestone 3 GPU design target for
shader operation: setup/config/runtime lifecycles, abstraction-owned
contributions, cache texture/access ownership, bindings, symbol inventory,
`ThreeGateway`, pass installation, invalidation, diagnostics, and the CPU
postprocess shader scene-input contract. Browser job execution, screenshots, image
comparison, and parity records remain action-plan / experiment-runner
concerns, not shader design responsibilities.
Use [Shader Test Design](shader-test-design.md) as the Milestone 3 scene and
validation target for proving the shader modifies pixels correctly. It defines
objective scene families, canonical spectral fixture scenes, fixture-to-pixel
propagation checks, selected-pixel diagnostics, rendered-pixel acceptance, and
failure classification.
Use [Post-Step032 Product Facts Audit](post-step032-lane-source-audit.md)
to audit retained product-driving facts from atmosflat, shader-lab, and local
second-order without promoting generated artifacts as facts or reviving
superseded branches.
Use
[Local Sun Flat Geometry Fact Inventory](local-sun-flat-geometry-fact-inventory.md)
when reconciling local-source, false-Sun, flat-geometry, long-sightline, and
local L2 cache facts. It separates source-backed sub-equations from artificial
model parameters and display fixtures.
Use
[Unsourced And Partially Sourced Facts](unsourced-and-partially-sourced-facts.md)
as the actionable checklist for source gaps, partial provenance, model-only
configuration, experiment-backed controls, and display fixtures that must not
enter production silently.

## New Agent Handoff

Start here if picking up the reopened lane from a compacted or fresh session:

- The immediate continuation task is Milestone 5: external boundary radiance
  and source-provided visible disks. Read [Status](status.md),
  [Action Plan](action-plan.md), [Shader Design](shader-design.md),
  [Algorithm32 Abstraction Design](algorithm32-abstraction-design.md), and
  `scripts/flat/reconciliation/POC/CURRENT_STATE.md`. The first proof should
  add an external boundary-radiance path for camera-ray composition, include a
  light-source-owned visible Sun disk provider, and demonstrate the same
  boundary path can represent starfield/Moon/planet radiance without using the
  L2 incident-radiance cache for visible point sources.
  Milestone 2 is closed in record
  `tmp/atmosphere/reconciliation/050-m2-closeout`; do not repeat the
  completed Subgoal 2.0 source-mining work or M2 records unless a future
  production/shader task specifically needs one of their deferred rows.
  Track calibration reproof and still-needed external evidence in the M2
  tracker, not in the action plan.
  Every consumed local fact must be called out before it becomes an acceptance
  fact. Anything previously proven by calibration must be reproven by the
  reconciliation POC code. The atmosflat32 Step 018 sky-dome artifacts are
  guide images and diagnostic comparison material, not canonical exact-match
  targets. Keep the `NNN-*` prefixed record-folder convention for every
  CLI-launched experiment runner.
  Long-running experiment runners must create `<record>/run.log` before
  expensive work begins and append live progress while they run. Image
  generation should report progress from inside the image/pixel loop, such as
  completed rows or scanlines, rather than only after a whole image has
  finished.
- Current shader design split: `shader-design.md` describes shader operation
  plus the CPU postprocess shader scene-input contract.
  It includes `ThreeGateway`, setup/config owner tables, `TextureBuilder`,
  cache-owned texture/access assembly, bindings, symbol inventory, and
  invalidation. Browser watcher, screenshot/capture, image comparison,
  parity tolerance, and artifact records belong in the action plan and
  experiment records.
- Current shader implementation state: Subgoal 3.3 is complete in records
  `063-m3-shader-descriptor` and `064-m3-shader-assembly`. The POC has
  `DistantSphericalShaderDescriptorBuilder`,
  `DistantSphericalShaderContributionFactory`,
  `Algorithm32ShaderAssembler`, `ShaderCompatibilityValidator`, and
  `TextureBuilder`. The assembler is generic and should not gain local/flat
  branches; future profiles arrive through abstraction-owned contributions.
- Browser watcher implementation state: Subgoal 3.4 is implemented in records
  `065-m3-browser-watcher-dry-run` and
  `066-m3-browser-diagnostics-readiness`. The user-run watcher command is
  `node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --watch`.
  Do not record live watcher state in docs; use `progress.json` and the
  watcher output folders at execution time.
  The first accepted user-run watcher evidence is record
  `068-m3-browser-watcher-user-run-evidence`, preserving watcher output
  `browser/001-capability-smoke`; record `067` is a rejected probe-shape
  attempt. Record `069-m3-browser-command-done-guard` verifies completed
  command files are marked `status: "done"` so the watcher does not replay
  the last command on restart. Record
  `070-m3-browser-output-root-alignment` makes future watcher outputs ordinary
  `tmp/atmosphere/reconciliation/NNN-*` records instead of placing them under
  a separate browser subfolder.
  Records `071-m3-assembled-shader-browser-smoke` and
  `072-assembled-distant-spherical-smoke` are the first Subgoal 3.5 browser
  smoke evidence: the assembled distant/spherical Algorithm32 fragment shader
  compiled, linked, rendered, read three pixels, wrote PNG artifacts, and
  marked the watched command done. This is not objective scene parity; the
  smoke readbacks were black and only prove compile/link/readback plumbing for
  the assembled shader.
  Records `073-m3-assembled-shader-visible-smoke` and
  `074-assembled-distant-spherical-smoke` rerun that smoke with visible-range
  diagnostic bindings and a non-black selected-pixel criterion. The shader
  source hash stayed unchanged, browser criteria accepted, and the retained
  canvas PNG is visibly non-black. This remains plumbing evidence, not the
  objective scene parity gate.
  Records `075-m3-integrated-objective-scene-comparison` and
  `076-m3-integrated-objective-scene` are the first integrated objective-scene
  browser run. They use the accepted Node/Three controlled scene, real camera
  inverse matrices, selected-pixel readback, CPU soft-shader selected output,
  and browser PNG artifacts. This is still not parity: the GPU path currently
  lacks per-pixel scene depth/hit termination and endpoint composition, so the
  selected GPU pixels are uniform grey while the CPU bridge distinguishes
  sky/card/ground.
  Records `077-*` through `086-m3-integrated-objective-scene` iterate that
  blocker to an accepted selected-pixel POC gate. The current shader reads
  per-pixel fixture depth, composes endpoint color for hit pixels, and the
  browser harness correctly keeps scene color and depth textures on separate
  texture units. Record `085` accepts selected CPU/GPU RGBA within max byte
  delta `3`, and record `086` is the browser artifact folder. Final M3
  objective-scene parity still needs external fixture or external-source-backed
  numeric RGBA materialization.
  Records `087-*` through `092-m3-integrated-objective-scene` replace the
  synthetic fixture canvas with the first real browser Three scene integration.
  Records `087/088` and `089/090` preserve rejected local Three module import
  attempts. Record `091` submits the accepted
  `assembled-three-scene-comparison` command, and record `092` is the browser
  artifact: the browser renders the controlled card/ground/sky Three scene to a
  320x180 render target, builds a matching `THREE.Raycaster` hit-distance
  texture, runs the assembled Algorithm32 shader over the full-scene textures,
  and writes a scene-shaped `canvas-image.png`. This is still a controlled POC
  scene, not the final external-fixture-backed numeric parity gate.
  Records `093-*` through `100-m3-integrated-objective-scene` complete the
  first visually readable real Three scene pass: RGB-channel Rayleigh/Mie
  atmosphere coefficients replace equal-channel shortcuts, browser Three rays
  are mapped into the spherical observer-local frame, and transport uses a
  40-sample view-path loop instead of a single midpoint sample. Record `100`
  is the current best real Three integration artifact, with blue sky, horizon
  gradient, ground plane, centered card, per-pixel hit termination, and endpoint
  scene color composition all visible in one PNG.
  Records `101-m3-subjective-southern-france-solar-noon` and
  `102-m3-subjective-southern-france-solar-noon` are superseded for camera
  framing. Records `103-m3-subjective-southern-france-high-camera-solar-noon`
  and `104-m3-subjective-southern-france-solar-noon` rerender the same
  Southern France subjective scene through the same assembled distant/spherical
  browser shader path with the accepted high camera profile: camera
  `[0, 6200, 15800]`, look-at `[0, 4200, -56000]`, and FOV `62`. The render
  interprets "today" as `2026-07-04`, uses the no-shadow Southern France OBJ
  lineage as a geometry-only matte terrain fixture, approximates the review
  location as `44N`, `6E`, and renders local solar noon on the meridian.
  Record `104` owns the current browser PNG artifacts and selected-pixel
  diagnostics. This is subjective review evidence, not a final numeric parity
  gate.
  Records `105-m3-subjective-southern-france-daylight-stack` through
  `114-m3-subjective-southern-france-daylight-stack` iterate the requested
  Southern France sunrise-to-sunset subjective gallery against the
  local-second-order `097` left-column visual target. The current best
  close-match result is record `112`: copied `097` camera/framing, `960 x 540`
  rows, 2x internal render/downsample behavior, `13:09` local-solar-noon
  clock, row times, diffuse TGA terrain, dark orange sunrise/sunset rows, and
  comparison artifacts under
  `tmp/atmosphere/reconciliation/112-m3-subjective-southern-france-daylight-stack/comparison/`.
  Record `113/114` is preserved as a rejected/rolled-back tuning attempt.
- Shader test design split: `shader-test-design.md` describes what to test
  and how to build test scenes. Its center of gravity is rendered-pixel
  modification: spectral diagnostics explain failures, but objective shader
  tests pass only when expected values reach final pixels.
- M3 baseline rule: do not reimplement validated behavior in adapters,
  runners, comparisons, or shader-support helpers. Use only public
  `evaluate(...)`, already implemented configuration endpoints, and the
  validated Bruneton-based dome rendering color adapter for baseline work. Do
  not call lower-level algorithm, calculator, cache, geometry, source, or
  atmosphere internals. New GPU GLSL is the implementation under test, not the
  CPU/reference baseline.
- The first concrete Milestone 3 deliverables are the CPU postprocess
  soft-shader and the reusable GPU validation scene set. Build the
  soft-shader as a scene-input adapter over the public reconciliation
  `evaluate(...)` operation before GPU/browser parity work. It must not call
  `SpectralCalculator`, geometry, atmosphere, light-source, cache, or other
  algorithm internals independently. Its composition contract is
  `endpointRadiance * T_view + L_path`, with spatial endpoint facts resolved
  by evaluation/geometry rather than direct soft-shader geometry calls.
  Before finalizing the scene-input contract, run the new hit-data
  itemization design step: list every hit datum, assign exactly one owner and
  route in descriptor/setup configuration. The first implementation endpoint
  policy is settled: opaque matte/Lambertian color contributes after transport
  as `albedo * surfaceIrradiance / PI`, then composes as
  `endpointRadiance * T_view + L_path`. Richer Three.js material facts and
  RGB-to-spectrum/material policies are non-blocking follow-up questions. If
  an RGB-derived spectral endpoint path is later selected, the preferred
  RGB-to-spectrum direction is an inverse fit against the validated
  Bruneton-based spectral-to-display adapter, with explicit constraints and
  error reporting because the conversion is lossy and non-unique. Stage 3.1.0b
  runs focused inverse-fit experiments only if RGB-derived endpoint spectra are
  needed. RGB/display color must never enter `evaluate(...)`. All color
  conversion, including RGB-to-spectrum inverse fitting, belongs to the color
  abstraction. Mining the current soft-shader favors geometry-only hit input
  for the first contract: hit mask/distance drive transport, while spectrum-id
  fixtures and captured RGB are post-transfer composition policies. Stage
  3.1.0a objective contribution-strength experiments are optional unless
  matte/Lambertian subjective review or later design choices show they are
  needed. A temporary divergence should introduce matte endpoint contribution
  into the latest local-second-order subjective scene path to update the
  visual review set. Bruneton 2017 and the accepted Step 032 Bruneton-based
  color adapter remain the primary authority for physical endpoint radiance
  composition; broader color-science sources are reserved mainly for inverse
  RGB-to-spectrum ambiguity.
  Current POC implementation state for renderer hit color: record `214` is
  only a spectral-fixture routing diagnostic, and record `215` is a superseded
  matte/RGB-to-spectrum detour for this lane. Records `218` and `219` now
  verify the intended local-second-order contract: only ray and finite hit
  distance enter `evaluate(...)`, captured scene color remains outside
  transport, and final RGB is composed in the display/color layer from
  spectral path radiance/transmittance plus hit color. Record
  `220-m3-captured-scene-color-green-boxes-120x68` is the current accepted
  scene proof; it uses
  `captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy` for
  hit pixels and keeps the green boxes green.
  Scene-object intersection context is an additive `evaluate(...)` parameter
  and must be validated in M3: no-hit rays preserve baseline behavior, finite
  scene hits shorten only geometry-resolved segments, and endpoint radiance or
  captured color remains postprocess composition data. If the hit contributes
  material/color/surface-radiance facts, those facts go to the color/display
  or postprocess composition boundary, not to geometry. More generally,
  scene-derived effects that affect Algorithm32 are routed by descriptor/setup
  configuration and compiled by the adapter into typed request or composition
  fields. `evaluate(...)` must not receive caller-supplied owner/route labels;
  it also must not receive RGB/display color. Contributions without a
  descriptor-declared owner are rejected by setup or scene-input validation.
  Then
  define scene descriptors and CPU soft-shader baseline outputs shared by CPU and GPU
  runs. The scene set must separate objective hypothesis/fact scenes from
  subjective plausibility-review scenes.
  Shader-lab and local-second-order code are references for scene-input,
  composition, and scene lineage only; borrow the latest accepted
  local-second-order subjective scenes for review imagery, especially the
  Southern France no-shadows terrain views, fitted local-angle views, local
  vertical stack `080`, and optional star-field stack `086`.
- M2 Subgoal 2.0 is complete in
  `tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward`. It
  carries forward the existing reference-gap analysis, snapshots the separate
  calibration/evidence tracker, classifies Step 018 as guide imagery only, and
  records seed implementation defaults as non-final. Record
  `tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision`
  settles the M2 projection as north-polar azimuthal equidistant, sources the
  projection facts to PROJ, and leaves Earth-radius source precision open.
  Record `tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership`
  corrects flat top-boundary ownership: atmosphere/profile supplies the medium
  domain, geometry calculates ray exits against it, and renderer/view policy
  owns no-hit caps. Records `025-m2-flat-geometry-profile`,
  `026-m2-local-sun-source`, `027-m2-local-flat-cpu`,
  `028-m2-pre-asset-experiments`, `029-m2-local-flat-assets`, and
  `030-m2-local-flat-assets-quick-rerun` run the M2 implementation through
  Subgoal 2.5 asset generation. Record 029 retained five full-size 320px PNGs
  but the shell command timed out after writing the accepted result; record
  030 is the clean reduced-size CLI completion. Records 031 and 032 preserve
  rejected stack-comparison attempts, and record
  `033-m2-local-flat-stack-comparison` creates the full-size three-column
  diagnostic stack with atmosflat Step 018 guide imagery on the left,
  reconciliation M2 imagery in the middle, and a 3x visual absolute-difference
  column on the right. Records `034-m2-coordinate-warning-diagnostics` through
  `037-m2-coordinate-warning-fix-check` diagnose the coordinate warnings as
  source-path sampling launched from a top-boundary endpoint with tiny
  floating-point overshoot, then verify the boundary-tolerance fix with zero
  reproduced warning events. The `036` record is the interrupted slow full-scan
  fix check; `037` is the accepted targeted fix check. Record
  `038-m2-warning-fix-local-flat-assets` regenerates the five full-size
  local/flat PNGs with the fix in place. Record
  `039-m2-warning-fix-six-column-stack` creates the requested six-column stack:
  atmosflat, record 029, atmosflat-vs-029 diff, latest, atmosflat-vs-latest
  diff, and 029-vs-latest diff. The 029-vs-latest max absolute RGBA delta is
  0 for all five rows. The subsequent blue-ring diagnosis is implemented as a
  domain-model correction in record
  `040-m2-observer-centered-dome-local-flat-assets`: scalar no-hit caps are
  interim diagnostics/fallbacks, while the M2 skydome profile now exits
  against a geometry-owned observer-centered spherical dome. That record uses
  apex altitude `60000 m`,
  `maxObserverViewRayExtentMeters = 875656.6450361694`, derived sphere center
  `[0, 0, -6360000]`, and sphere radius `6420000`, then regenerates five
  full-size 320px local/flat PNGs. The shell wrapper timed out after the
  accepted result and artifacts were written. Record
  `041-m2-observer-centered-dome-side-by-side-stack` creates the requested
  two-column no-diff stack with atmosflat on the left and record 040 on the
  right. Record `042-m2-observer-centered-dome-diff-stack` adds the requested
  three-column stack with atmosflat, record 040, and absolute diff x3. Record
  `043-m2-summer-solstice-latitude-skydomes` renders the additional
  subjective San Jose-longitude summer-solstice latitude set at 80N, 30N,
  equator, 30S, and 80S with no guide-image parity target. Record
  `044-m2-synchronized-noon-flat-spherical-skydomes` renders the reusable
  north-up synchronized-noon version of that latitude list, saving five flat
  PNGs, five spherical PNGs, and the final two-column flat-left/spherical-right
  stack. Record `045-m2-greenwich-noon-flat-spherical-skydomes` adds the
  Greenwich-noon comparison variant while keeping the
  render longitude at San Jose; it also labels every stacked image with Sun
  azimuth and altitude. Record
  `046-m2-45east-noon-flat-spherical-skydomes` makes the reusable default a
  45-degree-east clock at source longitude `-76.8863`, keeps the Sun off the
  vertical meridian, and keeps the spherical Sun above the horizon through
  `30S`. Record `047-m2-north-pole-summer-solstice-gmt-sweep` renders the
  North Pole summer-solstice GMT four-hour sweep. Record
  `048-m2-south-pole-winter-solstice-gmt-sweep` renders the South Pole
  winter-solstice counterpart. Record
  `049-m2-union-glacier-final-experiment-gmt-sweep` renders the Union Glacier
  Final Experiment review set. Record `050-m2-closeout` closes M2; the
  historical next task after that closeout was Milestone 3 preparation, not
  more local/flat asset generation by default.
- Subgoal 1.0 is complete in
  `tmp/atmosphere/reconciliation/001-abstraction-closure-contract`, with the
  interface-declaration refinement in
  `tmp/atmosphere/reconciliation/002-interface-contract-declarations` and the
  method-signature refinement in
  `tmp/atmosphere/reconciliation/003-interface-method-signatures`. The POC has
  a spectral-only `SpectralReferenceEvaluator`, tightened ambient `interface`
  contracts, post-transport output/comparison type homes, and a contract probe
  that uses non-spherical/non-distant mocks.
- The Milestone 0 scaffold already exists under
  `scripts/flat/reconciliation/POC/`; the canonical scaffold inventory remains
  in the
  [M0 Scaffold Inventory](algorithm32-abstraction-design.md#m0-scaffold-inventory)
  for orientation and later iteration. Do not create a formal numbered record
  for M0.
- Use [Experimental Guidelines](experimental-guidelines.md) for artifact,
  ambient type, JSDoc, and one-class-default-export rules.
- Shared active-baseline constants live in
  `scripts/flat/reconciliation/POC/src/constants/consts.js`, with ambient
  declarations in `constants/types.d.ts`. Future atmosphere,
  artifact-rendering, source setup, and primary-runner modules should import
  those constants instead of carrying private copies of Step 032 values. The
  M1 Figure 1 artifact renderer invokes the validated display conversion after
  spectral transport so Step 032 comparison is apples to apples. The conversion
  policy remains color-abstraction work, not CPU transport.
- M1 pre-artifact implementation is complete through record
  `tmp/atmosphere/reconciliation/014-distant-l2-cache-build-bind-sample`.
  The accepted pre-artifact sequence is:
  `011-parameter-provenance-extraction`,
  `012-transport-helper-invariants`,
  `013-concrete-distant-spherical-run`, and
  `014-distant-l2-cache-build-bind-sample`.
  Record `015-first-sky-dome-artifacts` adds the first image-producing
  evidence: four reduced-size 96px sky-dome PNGs through the POC renderer. It
  intentionally does not claim full-size, L2-backed, exact Step 032 parity.
  Record `016-step032-full-image-comparison` closes Milestone 1 by generating
  the full-size cache-backed four-view artifacts and matching all four
  accepted Step 032 decoded RGBA targets exactly.
  Record `017-m2-reference-gap-carry-forward` opens Milestone 2 by carrying
  forward local/flat evidence obligations without changing runtime domain code.
  Record `018-m2-north-polar-aeqd-source-decision` closes the projection
  choice/source part of the flat-geometry gap by selecting north-polar
  azimuthal equidistant and citing PROJ `+proj=aeqd`; it does not close the
  exact Earth-radius numeric source. Record
  `019-m2-atmosphere-boundary-ownership` corrects top-altitude ownership so
  `FlatEarthGeometry` does not choose atmosphere-domain values while still
  computing ray exits against the active atmosphere/profile domain.
- Load broader source audits, product-fact ledgers, and production docs only
  when the task needs their specific evidence. The local inventory and
  unsourced-facts checklist are no longer optional for Milestone 2; they are
  the starting gate for local-source and flat-geometry work.
- Scope is reconciliation planning and evidence. Do not edit production
  runtime/API/code unless the user explicitly asks to promote an accepted
  reconciliation decision.
- Step 032 from the Bruneton start-fresh lane is the authoritative pure
  Algorithm32 baseline. Reconciliation should prove that the new full CPU
  reference, including the L2 incident-radiance cache, preserves this baseline
  under finalized, sourced parameters before using the CPU reference as the
  shader oracle. The hard artifact gate is exact decoded RGBA match against
  the accepted Step 032 sky dome/four-view artifact set; other artifact gaps
  are recorded unless they block the current verification claim.
- The active abstraction split is five interfaces plus transport:
  light/source, geometry, atmosphere, incident radiance cache/sampler, and
  color/display. Transport coordinates the spectral calculation. Color/display
  consumes spectral output outside CPU transport. Milestone 1 must close this
  abstraction contract and implement the full CPU Algorithm32 path so
  distant/spherical and distant L2 cache are concrete implementations, not
  hidden assumptions inside the algorithm.
- Complex POC types belong in ambient `types.d.ts` files at their owning
  shared or module-local boundary. Implementation code should reference those
  types with JSDoc rather than relying on inferred object shapes.
- Abstraction contracts belong in ambient `interface` declarations; value
  packets and descriptors may remain `type` aliases. Behavior members use
  method signatures rather than properties with function types.
- POC implementation files should keep a compact file-level `References:`
  comment naming the relevant design section, action-plan stage, numbered
  record, source audit, or external source. The selected scheme is a directly
  resolvable inline trail, not `[n]` citations against a separate index.
  Detailed source trails still belong in numbered records and provenance
  artifacts.
- Runtime class files should define one class and default-export only that
  class. Required declarations live in `types.d.ts`; interface contracts should
  not be represented by empty abstract base classes. POC class names may be
  clear working names rather than production-final names.
- Geometry owns spatial interpretation, including observer/light placement
  resolution, `AtmosphereCoordinate`, `AtmospherePath`,
  `SourceRelativePosition`, clipping, and source-relative/cache coordinate
  mapping. Light source consumes resolved source-relative facts and supplies
  lighting facts. Atmosphere consumes atmosphere coordinates/paths and
  supplies medium, phase, and optical-depth facts.
- Incident radiance cache/sampler owns the generated-field descriptor,
  generated values, binding contract, compatibility validation, runtime
  `IncidentRadianceSampler` callback, and returned `IncidentRadianceSamples`
  packet. Building that field is coordinated by setup/build code across light
  source, geometry, atmosphere, and the general calculator.
- Runtime `evaluate(...)` must not know cache shape, source kind, raw
  source-local/cache coordinates, or display conversion. It asks geometry to
  resolve the bound cache's `cacheAccess` packet from current path-integration-point facts only
  when optional `IncidentRadianceSampling` is present, then invokes that
  value's `incidentRadianceSampler` callback for incident samples.
- The general calculator, provisionally `SpectralCalculator`,
  subsumes the old radiance-port idea. It is the reusable readable home of
  `computeRadiance(...)` for both primary evaluation and cache generation.
  It is configured with geometry, atmosphere, light source, spectral basis, and
  execution controls; `computeRadiance(...)` receives the resolved `RaySegment`, the
  prebuilt `PathIntegrationPoint[]` value packet, and optional operation-specific
  `IncidentRadianceSampling`. Cache generation omits that optional value rather
  than using a no-op placeholder or a separate first-order calculator.
  `computeRadiance(...)` returns `PathRadiance`: `inScattered` plus final
  `transmittance`. `inScattered` is path-added spectral radiance;
  the "in" means light scattered into the evaluated ray. `transmittance` is the
  dimensionless surviving endpoint multiplier. Cache builds store the
  first-order `inScattered` value; endpoint composition remains explicit. Both fields use the shared
  `SpectralValue` type; the field/parameter name carries physical meaning and
  units. Higher-order field preparation can happen during setup/cache building,
  but higher-order contribution is still sampled and weighted inside each
  path-integration-point loop.
  Shader building consumes the same logical cache via cache-owned texture
  creation requests and cache-owned lookup/access assemblies. The cache owns
  the texture shape and calls `TextureBuilder`; `ShaderBuilder` assembles and
  compiles the contributed shader code, while `ShaderBinder` applies the
  sampler binding.
- Shared CPU/shader logic is setup/build logic: canonical descriptors,
  fingerprints, spectral/channel utilities, numerical-control descriptors,
  the cache-build coordinator, concrete incident-cache families, cache-access
  contracts, cache texture/access contribution contracts, provenance,
  diagnostics, and fail-loud validation. CPU transport remains JavaScript,
  while shader runtime
  transport is assembled into GLSL and validated by descriptor-backed parity
  tests.
- The shared `SpectralCalculator` general calculator owns the
  reusable readable radiance loop for both primary evaluation and cache
  generation; its lower-level helper methods own named equation terms,
  spectral-channel math, fixture-backed calculations, and small convenience
  loops such as
  spectral-channel or directional-sample reductions. Helper methods take
  explicit calculation parameters instead of broad request objects. Atomic
  inner-loop helpers reduce explicit inputs to one returned value packet, such
  as one `SpectralValue`. They may also take the exact interface
  instance they need, such as atmosphere phase sampling for a directional
  incident loop, and call it directly inside that named calculation. Moving
  stable collaborators into calculator configuration shrinks orchestration
  signatures only; the lower-level helper surface remains explicit and
  fixtureable. Path integration point construction can live on the calculator
  because it creates endpoint/trapezoid `PathIntegrationPoint[]` value objects from a
  geometry-resolved `RaySegment` and interval count, with no geometry,
  atmosphere, light, or cache queries. Each point is defined by
  `distanceAlongRayMeters` within the owning segment plus integration weights;
  `measureMeters` is the effective path length represented by that point.
  Model-space position is derived from the segment ray when needed. The coarse
  transport split is now:

  ```text
viewRaySegment = geometry.resolveViewRaySegment(...)
pathIntegrationPoints = calculator.buildEndpointTrapezoidPathIntegrationPoints(
  viewRaySegment,
  pathIntervalCount)
pathRadiance = calculator.computeRadiance(
  viewRaySegment,
  pathIntegrationPoints,
  incidentRadianceSampling)
  ```

  The helper methods must not own the cache coordinate loop, setup lifecycle,
  or shader resources.
- The cache-build method surface is now explicit: coordinator
  `buildIncidentRadianceCache(...)`; light source
  `describeIncidentRadianceCache(...)` and
  `createIncidentRadianceCache(...)`; cache `coordinates()`,
  `addCoordinateToCache(...)`, `createIncidentRadianceSampler(...)`,
  cache-owned shader texture creation through `TextureBuilder`, and
  cache-owned shader access assembly; sampler callback
  `incidentRadianceSampler(cacheAccess)`;
  geometry `resolveViewRaySegment(...)` plus mapping/build/access resolvers; atmosphere
  cache-dependency descriptors;
  `calculator.buildEndpointTrapezoidPathIntegrationPoints(...)`;
  `calculator.computeRadiance(...)`; and `ShaderBuilder` composition of the
  cache-owned texture/access contribution.
- The next concrete deliverable is Milestone 2: add flat geometry and a local
  light source through the accepted Milestone 1 contracts. The full CPU
  abstraction contract was first checked
  in record
  `tmp/atmosphere/reconciliation/001-abstraction-closure-contract` and refined
  in `tmp/atmosphere/reconciliation/002-interface-contract-declarations` and
  `tmp/atmosphere/reconciliation/003-interface-method-signatures`. Record
  `tmp/atmosphere/reconciliation/009-m1-granular-record-strategy` keeps the
  `NNN-*` folder convention and says M1 evidence should be split across
  parameter/provenance, transport-helper, concrete distant/spherical execution,
  and Step 032 image-comparison records. Records 011 through 016 close those
  anchors for Milestone 1.
- The current living milestone plan is [Action Plan](action-plan.md):
  Milestone 0 is complete, then CPU distant/spherical, CPU local/flat
  method-confidence work, GPU distant/spherical parity, and GPU local/flat
  parity against the reconciled CPU behavior.

## Major POC Goals

1. CPU reference, distant Sun, spherical Earth parity against the accepted
   Bruneton start-fresh Experiment 32 / Step 032 sky dome/four-view artifacts at
   `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`.
   This is the lane's hard artifact rule.
2. CPU reference, local Sun, flat Earth method-confidence work, using
   `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes` as historical
   guide imagery and diagnostic comparison material. Because this is an
   artificial configuration, acceptance comes from sourced/classified facts,
   analytic geometry, transport invariants, source/cache handoff diagnostics,
   convergence where needed, and explainable image behavior rather than exact
   reproduction of those old sky domes.
3. GPU integrated shader, spherical Earth, distant Sun parity against the CPU
   reference. This requires browser execution and a long-running browser
   process that can watch for job updates.
4. GPU integrated shader, local Sun, flat Earth parity, informed by the
   shader-lab implementation and the later local-second-order lane.

Current Milestone 4 checkpoint: record
`tmp/atmosphere/reconciliation/534-m4-local-cache-texture-prep` accepts M4.1
local cache texture prep, record
`tmp/atmosphere/reconciliation/535-m4-local-gpu-cache-texture-lookup` accepts
M4.2 browser/GPU cache texture upload, binding, and local GLSL lookup, and
records
`tmp/atmosphere/reconciliation/536-m4-flat-geometry-gpu-selected-ray-parity`
and
`tmp/atmosphere/reconciliation/537-m4-local-flat-gpu-integrated-selected-pixel-parity`
accept M4.3.1. Record `536` proves selected-ray flat-geometry GPU parity
against `FlatEarthGeometry` for ray reconstruction, scene-hit termination,
ground/top/observer-dome bounds, and z/rho cache coordinates. Record `537`
runs the same constructed local-flat scene through integrated CPU and GPU
composer backends with the local L2 cache contract and matches selected
browser readbacks with max byte delta `1`. The old M4 next step was M4.3.2
review gallery recreation followed by M4.4 local/GPU closeout classification;
that closeout remains historical context. The lane is now reopened only for
Milestone 5 external boundary radiance, and [Conclusions](conclusions.md)
remains the durable handoff for all prior accepted work.

Each goal's numbered records should capture code/config changes, criteria,
diagnostics, visual artifacts, facts, references, and any rejected or
superseded attempts. For M2, image criteria are diagnostic and explanatory
unless a later record deliberately promotes a deterministic local/flat image
target.

The browser watcher can be designed and implemented before Milestone 3. Running
the long-lived browser process is a user-run step when sandbox restrictions
prevent the agent from launching or controlling the browser directly.

## Supporting Workstreams

Use [Action Plan](action-plan.md) for the living milestone plan. The sections
below are supporting workstreams that may be touched by more than one
milestone.

### Workstream: Lane Scaffold

- Create the mutable reconciliation POC root under
  `scripts/flat/reconciliation/POC/`.
- Milestone 0 is accepted: the scaffold exists. Do not require a formal
  numbered experiment record for scaffold-only work.
- Include ambient `types.d.ts` files for complex POC packets, descriptors,
  callbacks, records, and handles, with implementation JSDoc referencing those
  names.
- Use one file per runtime class and make the class the file's single default
  export. Keep required complex types in the owning `types.d.ts`.
- Create the first numbered record folder under `tmp/atmosphere/reconciliation/`
  when substantive verification, parity comparison, or a rejected/accepted run
  needs durable evidence.
- Every CLI invocation of a reconciliation experiment runner is one experiment
  with its own fresh `NNN-*` folder. Reruns use the next folder and cite the
  prior attempt. Supporting verification commands such as smoke checks,
  contract probes, JSON validation, and whitespace checks are logged inside the
  active record rather than becoming separate experiment folders.
- Create record-writing helpers only where they reduce friction. They should
  capture the accepted record file set: `state-goal.md`, `inputs.json`,
  `provenance.json`, `equations-and-constants.json`,
  `criteria-results.json`, `diagnostics.json`, `report.md`, and `run.log`,
  but the lane does not require each record to be a standalone rerunnable
  experiment.
- Maintain an append-only `tmp/atmosphere/reconciliation/running-log.md` once
  numbered records begin.
- Follow the artifact state, criterion state, tolerance, provenance, and
  reporting rules in
  [Experimental Guidelines](experimental-guidelines.md).

### M0 Scaffold Inventory

The canonical M0 file/class/type inventory lives in
[Algorithm32 Abstraction Design](algorithm32-abstraction-design.md#m0-scaffold-inventory).
Keep the full inventory there so the design contract remains the single source
of truth; this lane README only links to it.

### Workstream: Parameter And Provenance Ledger

- Build the canonical parameter ledger for the initial Algorithm32 atmosphere
  profile, light/source model, geometry policy, spectral basis, numerical
  controls, cache policy, shader packing policy, and display/comparison
  policy.
- Require every promoted constant to carry per-value provenance: external
  source, source-backed derivation, or accepted Algorithm32
  experiment/decision.
- For choices settled by subjective Algorithm32 review, record the candidate
  set, the retained/omitted decision, and the source trail for every retained
  equation, constant, approximation, or display choice. Subjective acceptance
  can select a baseline; it cannot promote unsourced ingredients.
- Treat unclear provenance as a reconciliation finding. Recover the trace,
  record an Algorithm32 decision, or keep the value out of the promoted
  initial profile.
- Treat view latitude, longitude, local time, and view altitude as
  Algorithm32 configuration. The app's method for deriving or defaulting
  altitude is a separate upstream policy, and historical fixture heights should
  not be promoted silently.
- For local Sun work, treat default altitude, size, and annual latitude
  migration as source-recovery profile defaults. Treat source brightness/power
  and real-time synchronization as calibration outputs because the flat model
  has no independently sourced brightness or time standard.
- Keep alternate atmosphere profiles out of the initial run. Bucholtz
  Rayleigh, ozone-bearing profiles, and alternate aerosol presets remain
  future named profiles unless a later explicit decision changes the first
  implementation scope.

Expected outputs:

- `parameters.md` or equivalent.
- Machine-readable `equations-and-constants.json`.
- A source/provenance report naming unresolved constants and decisions.

### Workstream: CPU Reference

- Implement the CPU reference Algorithm32 path in the reconciliation POC first,
  with later production promotion only after accepted records close the
  contract.
- Keep the transport core source-neutral. Light/source, geometry, atmosphere,
  and the bound incident radiance sampler provide facts and samples; transport
  coordinates the spectral calculation.
- Complete that source-neutral contract during Milestone 1. M2 should add
  local light source and flat geometry through the existing boundary rather
  than changing the main algorithm flow.
- Keep color/display outside CPU transport. The CPU reference may expose or
  test the color boundary, but spectral transport must run without color. For
  the M1 Figure 1 artifacts, display conversion can be ordinary
  artifact-rendering code executed by the experiment runner.
- Use direct general-calculator calculations before accepting cache or
  shader approximations.
- Test algorithms and constants against the parameter ledger and cited
  sources.
- Prove the complete CPU reference, including L2 incident-radiance cache
  construction and sampling, preserves the accepted Step 032/parameter-ledger
  baseline before using it as the oracle for shader parity.
- Test the ownership boundaries so implementation-private source, geometry,
  atmosphere, cache, and color state cannot leak across public interfaces.

Minimum CPU evidence:

- High-level Algorithm32 transport tests.
- Finite object composition tests.
- Convergence-backed numerical-control tests.
- Local-source behavior tests.
- Direct general-calculator incident-radiance tests.
- Second-order incident-radiance/cache tests.
- Display-boundary tests proving color is outside CPU transport.

### Workstream: Data-Flow Contract

Document the exact data objects that cross every boundary. At minimum, name
the owner, inputs, outputs, units, provenance requirements, cache-key
requirements, and failure behavior for:

Every complex data object in this contract should also exist as a named
ambient type in an owning `types.d.ts` file, with JavaScript implementation
code using JSDoc to record its use.

- Algorithm32 configuration.
- Resolved light/source model facts.
- Resolved geometry facts and ray/path requests.
- Geometry-owned `SourceRelativePosition` values, observer-source diagnostic
  facts, and source-relative cache coordinates.
- Resolved atmosphere profile and medium samples.
- Spectral basis and spectral-channel descriptors.
- Evaluation requests and transport state.
- Radiance calculator requests and `PathRadiance` values for cache generation
  and CPU reference reuse.
- Shared CPU/shader setup descriptors, fingerprints, numerical controls,
  cache-build coordinator packets, shader contribution contracts,
  diagnostics, and provenance.
- Light-source lighting fact packets and resolved light-path descriptors.
- Incident-radiance cache descriptors, sampler callbacks, sampling requests,
  generated-value payloads, and optional emitted artifact descriptors.
- Cache-build coordinator requests and cache-owned build coordinates.
- Cache-owned shader texture creation requests, cache access assemblies,
  shader textures, uniforms, defines, modes, and debug views.
- `PathRadiance` values and diagnostics.
- Color/display conversion requests for the GPU render path.

This contract is a deliverable, not a byproduct. The GPU phase should not
start until the CPU reference data flow is stable enough to bind.

### Workstream: GPU Shader

- Build the GPU shader implementation against the CPU reference.
- Treat shader matching as implementation parity against the CPU reference, not
  as independent algorithm validation. Its force depends on the CPU reference
  already being proven baseline-faithful.
- Allow shader-specific shortcuts for performance, packing, precision,
  interpolation, branching, or cache use only when they are explicit,
  tolerance-bounded, and tested against the CPU reference.
- Keep shader texture packing, precision, branching, and approximation choices
  explicit.
- Validate selected diagnostics against the CPU reference before relying on
  images.
- Validate full-image shader output against the CPU reference where practical,
  with named tolerances.
- Use the color/display interface in this phase to turn spectral transport
  output into renderable output.
- Fail loudly when required cache, shader, color/display, or capability inputs
  are missing or mismatched. Do not silently fall back to first-order,
  distant-Sun, default-Sun, or no-cache behavior.

### Workstream: Evidence Recreation

Recreate accepted artifact families from the historical local second-order
lane under the reconciled parameters and the new artifact root. Classify each
artifact as objective, subjective/review, rejected, or superseded.

Objective artifacts to recreate:

- Module/reference parity.
- Bruneton Figure 1 accepted-baseline image regression against the generated
  Experiment 32 Step 032 outputs. The external Bruneton comparison images
  explain the source target, but the reconciliation regression target is the
  accepted generated Algorithm32 artifact set.
- Direct general-calculator incident-radiance checks.
- Cache shape and cache-key checks.
- CPU soft-shader/reference local second-order checks.
- Integrated GPU local second-order checks.
- CPU/GPU selected-pixel parity.
- Criteria/results JSON, diagnostics, and reports.

Optional further validation artifact:

- Real-Sun-matched local-source comparison on spherical geometry. For a chosen
  view latitude, longitude, local time, and altitude, resolve the reference
  distant/real Sun state under the canonical spherical geometry, then configure
  a finite local Sun on that same spherical geometry to match the same apparent
  direction, angular size, incident spectral scale or calibration target, and
  atmosphere/numerical controls at the reference view point as closely as the
  local-source model permits. Record the explicit handoff facts that make the
  match possible: geometry frame, observer/root position, local source
  position, sample-to-source distances, angular size or solid angle, source
  path and clipping descriptor, inverse-square/falloff inputs, calibration
  reference event, and spectral incident scale. Compare distant-source and
  local-source CPU/GPU outputs, selected pixels, spectra, and diagnostics.
  Treat this as a limiting-case/source-geometry-separation diagnostic, not
  proof that the local Sun model is physically valid at other view positions.
  If the local source cannot run on spherical geometry, record whether the
  missing dependency is source configuration, geometry-resolved fact,
  coordinator data flow, or improper coupling before promotion.

Subjective/review artifacts to recreate:

- First-order versus second-order/cache galleries.
- Terrain and Southern France OBJ browser captures.
- With/without shader source matrices.
- Local-vs-distant time-aligned galleries.
- Local-source neutral-spectrum comparisons.
- Optional star/sky review galleries.

Subjective/review images can also become objective regression artifacts when
the artifact defines a deterministic target and numeric image criteria. For
example, the Bruneton start-fresh Figure 1 external comparison image explains
where the target came from, but reconciliation should prove visual regression
against the accepted generated Experiment 32 Step 032 images. This kind of
evidence proves the scoped regression claim, not physics correctness by
itself. The final Algorithm32 visual result was accepted by subjective review
among source-backed candidates, so artifact reports should preserve that
selection history while separately proving that the retained algorithms,
constants, approximations, and display choices are sourced or explicitly
accepted Algorithm32 decisions.

### Workstream: Closeout

- Update Algorithm32 conclusions, requirements, production design, status, and
  active-topic handoff with the reconciled contracts.
- Promote only accepted, source-backed contracts into production docs/code.
- Record rejected/superseded decisions so future agents do not revive them.
- Leave a concise final lane closeout that names what shipped, what remains
  open, and which artifacts are the canonical evidence.

## Local Second-Order Lessons To Carry Forward

The historical local second-order lane is useful process and evidence, not the
production boundary. Carry these lessons forward:

- Use direct general-calculator transport before cache or shader
  approximation.
- Keep the incident-radiance abstraction source-neutral:
  `L1_incident = incidentField.sample(position, incomingDirection, wavelength)`.
- Keep geometry responsible for mapping model-space positions to
  `SourceRelativePosition`: direction from source plus measured source distance
  when finite placement exists. Light sources consume that position and supply
  lighting facts, including distance-use treatment for the geometry-measured
  source distance. Source-relative cache coordinates are a separate
  descriptor-driven mapping.
- Define the logical cache contract before GPU texture packing.
- For local source cache work, the accepted POC shape is
  `z/rho/incomingDirection/wavelength`, using a Sun-subpoint
  radial/tangential/up direction frame instead of raw world-space incoming
  directions.
- Source configuration belongs in cache keys, not hidden global state.
- Direction sign conventions must be explicit and consistent across source
  sampling, cache lookup, phase evaluation, shader code, and diagnostics.
- Hardware WebGL diagnostics must be recorded for GPU/browser artifacts.
- Browser evaluation timeouts require recovery. Do not keep reading canvases
  from a page that may still be doing WebGL work after the timeout.
- Review-quality terrain imagery should use antialiasing/supersampling when
  judging directional-light terrain detail.

Useful source files:

- [Algorithm32 Abstraction Design](algorithm32-abstraction-design.md)
- [Status](status.md)
- [Action Plan](action-plan.md)
- [Shader Design](shader-design.md)
- [Experimental Guidelines](experimental-guidelines.md)
- [Bruneton Start-Fresh Source Audit](bruneton-start-fresh-source-audit.md)
- [Post-Step032 Product Facts Audit](post-step032-lane-source-audit.md)
- [Local Sun Flat Geometry Fact Inventory](local-sun-flat-geometry-fact-inventory.md)
- [Unsourced And Partially Sourced Facts](unsourced-and-partially-sourced-facts.md)
- [Local Sun Second-Order README](../plans/atmosphere-cleanroom-design/local-sun-second-order/README.md)
- [Local Sun Second-Order Experiment Plan](../plans/atmosphere-cleanroom-design/local-sun-second-order/experiment-plan.md)
- [Local Sun Second-Order Scattering Notes](../plans/atmosphere-cleanroom-design/local-sun-second-order/scattering-notes.md)
- `scripts/flat/local-second-order/run-milestones.js`
- `scripts/flat/local-second-order/harness.js`
- `scripts/flat/local-second-order/README.md`

## Prep Decisions

The listed prep decisions no longer block Milestone 0. Milestone 0 starts with
the mutable POC bootstrap/skeleton, accepts the skeleton by existence, and does
not require a formal numbered experiment. Record-template helpers, artifact
inventory, watcher protocol, and provenance ledger shape may be added during
M0, but imperfections there can be iterated later.

Deferred decisions:

- Constants from `conclusions.md` become a Milestone 1 provenance task. M0
  needs only a ledger shape that can classify values.
- The first CPU reference artifact proving the five-interface data flow is a
  Milestone 1 verification artifact.
- The first accepted data-contract slice for `SourceRelativePosition`,
  `AtmospherePath`, `IncidentRadianceSampler`, and
  `IncidentRadianceSamples` can evolve during M0 and is accepted through the
  later CPU reference evidence. Abstraction contracts should be ambient
  `interface` declarations while value packets remain data `type`s.
- Shader parity tolerances are a Milestone 3 decision.
- Mandatory versus optional local-second-order subjective artifacts are a
  Milestone 4 or closeout decision.
