# Active Topic

Current active topic: `algorithm32/reconciliation`

Parent app/topic: `flat`

## Current Focus

Reconciliation experimental lane for Algorithm32 under:

```text
agents/topics/apps/flat/reconciliation/
```

This is an experimental-lane planning and evidence topic. Its immediate job is
to reconcile the accepted Algorithm32 evidence into a fully sourced CPU
reference target, a later GPU shader target, and a complete data-flow contract.
Do not promote new API surface, runtime implementation, ambient types, scaffold
tests, or production behavior into `shared/algorithm32/production/` from this
topic unless the user explicitly asks for production scaffold work or the
reconciliation lane closes an accepted interface decision.

The lane-owned locations are:

```text
agents/topics/apps/flat/reconciliation/
scripts/flat/reconciliation/POC/
tmp/atmosphere/reconciliation/NNN-*
```

This lane is different from earlier cumulative rerunnable experiment lanes:
`scripts/flat/reconciliation/POC/` is the living implementation. Milestone 0
is scaffold preparation, not a formal experiment, and is accepted when the
mutable skeleton exists. Numbered records under
`tmp/atmosphere/reconciliation/` preserve what changed, when, why, what was
checked, and which facts/references/artifacts were produced once substantive
verification begins. Mutable current-state notes are still expected in
parallel. This active-topic file, the reconciliation README/status docs, and
the POC `CURRENT_STATE.md` should summarize the current architecture,
parity status, active blockers, latest accepted record, and next actions while
the numbered records preserve history.
Historical POC and experiment code may be mined, copied, or ported into the
new POC with provenance, but the reconciliation POC must not import, symlink,
re-export, or otherwise runtime-link to old code where it currently lives.

The future production implementation destination remains
`shared/algorithm32/production/`, but that folder is supporting context for
this topic, not the active work surface.

## New Agent Quick Start

- Active work is Milestone 3 preparation / GPU distant Sun, spherical Earth
  planning under `scripts/flat/reconciliation/POC/`.
  Subgoal 3.3 is complete in records
  `tmp/atmosphere/reconciliation/063-m3-shader-descriptor` and
  `tmp/atmosphere/reconciliation/064-m3-shader-assembly`: the POC now has
  deterministic shader descriptors, abstraction-owned contribution assembly,
  cache-owned texture/access assembly shape through `TextureBuilder`, and a
  profile-generic `Algorithm32ShaderAssembler`.
  Subgoal 3.4 implementation is complete in
  `tmp/atmosphere/reconciliation/065-m3-browser-watcher-dry-run` and
  `tmp/atmosphere/reconciliation/066-m3-browser-diagnostics-readiness`; the
  user-run watcher command is
  `node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --watch`.
  The first accepted user-run browser evidence is
  `tmp/atmosphere/reconciliation/068-m3-browser-watcher-user-run-evidence`,
  preserving watcher output `tmp/atmosphere/reconciliation/browser/001-capability-smoke`.
  Record `tmp/atmosphere/reconciliation/070-m3-browser-output-root-alignment`
  makes future watcher outputs ordinary
  `tmp/atmosphere/reconciliation/NNN-*` records.
  Records `tmp/atmosphere/reconciliation/071-m3-assembled-shader-browser-smoke`
  and `tmp/atmosphere/reconciliation/072-assembled-distant-spherical-smoke`
  are the first Subgoal 3.5 browser smoke evidence: the assembled
  distant/spherical Algorithm32 fragment shader compiled, linked, rendered,
  read three selected pixels, wrote PNG artifacts, and marked the watched
  command done. The selected pixels were black, so this is compile/link/readback
  plumbing evidence only, not objective scene parity.
  Records `tmp/atmosphere/reconciliation/073-m3-assembled-shader-visible-smoke`
  and `tmp/atmosphere/reconciliation/074-assembled-distant-spherical-smoke`
  rerun that smoke with visible-range diagnostic bindings and a non-black
  selected-pixel criterion. The assembled shader source hash stayed unchanged,
  and record `074` accepted with selected readbacks
  `[174, 174, 174, 255]`, `[255, 255, 255, 255]`, and `[6, 6, 6, 255]`.
  This still does not claim objective scene parity.
  Records `tmp/atmosphere/reconciliation/075-m3-integrated-objective-scene-comparison`
  and `tmp/atmosphere/reconciliation/076-m3-integrated-objective-scene` are
  the first integrated objective-scene browser run using the accepted
  Node/Three controlled scene and real camera inverse matrices. Browser
  criteria accepted, PNGs were written, and CPU/GPU selected-pixel packets are
  recorded side by side. This is not parity yet: GPU selected pixels are
  uniform grey because the assembled shader still lacks per-pixel scene
  depth/hit termination and endpoint composition.
  Records `tmp/atmosphere/reconciliation/077-*` through
  `tmp/atmosphere/reconciliation/086-m3-integrated-objective-scene` iterate
  that blocker to an accepted selected-pixel POC gate. The current shader
  reads per-pixel fixture depth, composes endpoint color for hit pixels, and
  record `085` accepts CPU/GPU selected RGBA within max byte delta `3`; record
  `086` is the matching browser artifact folder. Final objective-scene numeric
  RGBA gates still need external fixture or external-source-backed
  materialization before final M3 parity closeout.
  Records `tmp/atmosphere/reconciliation/087-*` through
  `tmp/atmosphere/reconciliation/092-m3-integrated-objective-scene` move the
  browser artifact from a synthetic fixture texture canvas to the first real
  browser Three scene integration. Records `087/088` and `089/090` preserve
  rejected local Three module import attempts. Record `091` submits the
  accepted `assembled-three-scene-comparison` command, and browser artifact
  `092` renders the controlled card/ground/sky Three scene to a 320x180 render
  target, builds a matching `THREE.Raycaster` hit-distance texture, runs the
  assembled Algorithm32 shader over the full-scene textures, and writes a
  scene-shaped PNG. This remains a controlled POC scene, not the final
  external-fixture-backed numeric parity gate.
  Records `tmp/atmosphere/reconciliation/093-*` through
  `tmp/atmosphere/reconciliation/100-m3-integrated-objective-scene` complete
  the first visually readable real Three scene pass. The shader now uses
  RGB-channel Rayleigh/Mie atmosphere coefficients, maps browser Three rays
  into the spherical observer-local frame, and uses a 40-sample view-path loop
  rather than a single midpoint sample. Record `100` is the current best real
  Three integration artifact, with blue sky, horizon gradient, ground plane,
  centered card, per-pixel hit termination, and endpoint scene color
  composition visible in one PNG.
  Records `tmp/atmosphere/reconciliation/101-m3-subjective-southern-france-solar-noon`
  and `tmp/atmosphere/reconciliation/102-m3-subjective-southern-france-solar-noon`
  are superseded for camera framing. Records
  `tmp/atmosphere/reconciliation/103-m3-subjective-southern-france-high-camera-solar-noon`
  and `tmp/atmosphere/reconciliation/104-m3-subjective-southern-france-solar-noon`
  rerender the same Southern France subjective scene through the same assembled
  distant/spherical browser shader path with the accepted high camera profile:
  camera `[0, 6200, 15800]`, look-at `[0, 4200, -56000]`, and FOV `62`. The
  render interprets "today" as `2026-07-04`, uses the no-shadow Southern
  France OBJ lineage as a geometry-only matte terrain fixture, approximates
  the review location as `44N`, `6E`, and renders local solar noon on the
  meridian. Record `104` owns the current browser PNG artifacts and
  selected-pixel diagnostics. This is subjective review evidence, not a final
  numeric parity gate.
  Records `tmp/atmosphere/reconciliation/105-*` through `114-*` iterate the
  Southern France sunrise-to-sunset subjective gallery against the
  local-second-order `097` left-column visual target. Records `107/108` copy
  the accepted `097` sunset-yawed camera/look-at and terrain fit; records
  `109/110` copy the `960 x 540` row output, 2x internal render/downsample
  path, `13:09` local-solar-noon clock, row times, and scene-light intensity;
  records `111/112` are the first close-match result with copied 097 framing,
  diffuse TGA terrain, dark orange sunrise/sunset rows, and a
  reference/latest/diff comparison under
  `tmp/atmosphere/reconciliation/112-m3-subjective-southern-france-daylight-stack/comparison/`.
  Record `113/114` is preserved as a rejected/rolled-back tuning attempt.
  Records `115-*` through `142-*` then diagnose the missing sunset-gradient
  path. The no-mesh ocean diagnostic ruled out terrain mesh occlusion. The
  accepted fix is that the distant/spherical browser scene floor must be an
  observer-local spherical Earth mesh, not a flat catch plane, and the depth
  texture must distinguish real early scene hits from no-hit pixels with a
  chroma mask: grayscale means early scene-hit distance, magenta means no
  early scene hit. The shader uses that mask so early scene hits terminate the
  normal ray segment length calculation, while no-hit pixels resolve through
  geometry to atmosphere exit. Record `140` verifies the no-mesh ocean
  diagnostic now has about `46%` early scene hits and `54%`
  no-hit/atmosphere-exit pixels. Record `142` is the current full Southern
  France subjective review artifact with all 28 diffuse textures loaded, about
  `48%` early scene hits, and restored warm sunrise/sunset horizon gradients.
  Milestone 1 is complete: the CPU Algorithm32 distant-Sun/spherical-Earth
  reference path, including distant L2 incident-radiance cache sampling,
  generated all four full-size Figure 1 sky-dome artifacts and matched the
  accepted Step 032 decoded RGBA targets exactly in
  `tmp/atmosphere/reconciliation/016-step032-full-image-comparison`.
  Production runtime/API/code is out of scope unless the user explicitly asks
  to promote an accepted decision.
- The immediate continuation path is:
  1. read the minimal reload sources below;
  2. read `scripts/flat/reconciliation/POC/CURRENT_STATE.md`;
  3. note that Subgoal 2.0 is complete in
     `tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward`, and
     that the north-polar azimuthal-equidistant projection source decision is
     recorded in
     `tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision`,
     with atmosphere-boundary ownership corrected in
     `tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership`;
  4. note that records `025-m2-flat-geometry-profile`,
     `026-m2-local-sun-source`, `027-m2-local-flat-cpu`,
     `028-m2-pre-asset-experiments`, `029-m2-local-flat-assets`, and
     `030-m2-local-flat-assets-quick-rerun` run M2 through Subgoal 2.5 asset
     generation; record 029 retained full-size 320px PNGs but the shell
     command timed out after writing the accepted result, while record 030 is
     the clean reduced-size CLI completion. Records
     `031-m2-local-flat-stack-comparison` and
     `032-m2-local-flat-stack-comparison` preserve rejected stack-comparison
     attempts, and record `033-m2-local-flat-stack-comparison` creates the
     full-size three-column diagnostic stack with atmosflat Step 018 on the
     left, reconciliation M2 in the middle, and absolute diff x3 on the right.
     Records `034-m2-coordinate-warning-diagnostics` through
     `037-m2-coordinate-warning-fix-check` diagnose and fix the local/flat
     coordinate warnings as source-path sampling from a top-boundary endpoint
     with tiny floating-point overshoot; record `036` is the interrupted slow
     full-scan fix check and record `037` is the accepted targeted no-warning
     check. Record `038-m2-warning-fix-local-flat-assets` regenerates the five
     full-size local/flat PNGs with the fix in place, and record
     `039-m2-warning-fix-six-column-stack` creates the requested six-column
     diagnostic stack. The 029-vs-latest diff is objectively zero for all five
     rows. Follow-up blue-ring diagnosis found that the sharp outer ring
     aligns with the scalar no-hit cap transition, not the coordinate warning.
     Record `040-m2-observer-centered-dome-local-flat-assets` implements the
     observer-centered finite-dome geometry profile in `FlatEarthGeometry`,
     using apex altitude `60000 m` and
     `maxObserverViewRayExtentMeters = 875656.6450361694`; the derived sphere
     center is `[0, 0, -6360000]` and the radius is `6420000`. It regenerates
     the five full-size Step 018-rotation PNGs; the shell wrapper timed out
     after the accepted result and all artifacts were written. Record
     `041-m2-observer-centered-dome-side-by-side-stack` creates the requested
     two-column stack with atmosflat on the left and the new observer-dome POC
     on the right, with no diff column. Record
     `042-m2-observer-centered-dome-diff-stack` adds the requested
     three-column stack with atmosflat, latest observer-dome imagery, and
     absolute diff x3. Record `043-m2-summer-solstice-latitude-skydomes`
     renders the additional subjective San Jose-longitude summer-solstice
     latitude set at 80N, 30N, equator, 30S, and 80S with no guide-image
     parity target. Record
     `044-m2-synchronized-noon-flat-spherical-skydomes` renders the reusable
     north-up synchronized-noon version of the same latitude list, saving five
     flat finite-source PNGs, five matching spherical distant-source PNGs, and
     the final two-column stack
     `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`. The
     scene frame for record 044 is observer-local `x=east`, `y=north`,
     `z=up`, so north is up in every source image; all rows share the same
     source subpoint longitude at the San Jose meridian and the same
     source-latitude brightness calibration. Record
     `045-m2-greenwich-noon-flat-spherical-skydomes` adds the
     Greenwich-noon reusable comparison set
     `san-jose-longitude-summer-solstice-greenwich-noon-latitude-sweep`: the
     observer/render longitude remains San Jose, but the clock is synchronized
     to solar noon at longitude `0`, moving the Sun off the image's
     north/south meridian. The record writes the same flat-left/spherical-right
     stack with a Sun azimuth/altitude caption on each image. Record
     `046-m2-45east-noon-flat-spherical-skydomes` supersedes that default with
     `san-jose-longitude-summer-solstice-45east-noon-latitude-sweep`: the
     observer/render longitude remains San Jose (`-121.8863`), while the
     synchronized solar-noon/source-subpoint longitude is `-76.8863`, exactly
     45 degrees east of San Jose. It keeps the Sun off the image's
     north/south meridian while keeping the spherical Sun above the horizon
     through the `30S` row. Record
     `047-m2-north-pole-summer-solstice-gmt-sweep` renders the requested
     `north-pole-summer-solstice-2026-gmt-4hour-sweep`: render location
     `90N`, longitude `0`, date `2026-06-21`, and rows every four hours from
     `00:00 GMT` through `20:00 GMT`. Record
     `048-m2-south-pole-winter-solstice-gmt-sweep` renders
     `south-pole-winter-solstice-2025-gmt-4hour-sweep`: render location
     `90S`, longitude `0`, date `2025-12-21`, and the same UTC cadence. Do
     Record `049-m2-union-glacier-final-experiment-gmt-sweep` renders
     `union-glacier-final-experiment-2024-dec15-gmt-4hour-sweep`: render
     location latitude `-79.768036`, longitude `-83.261666`, elevation
     `700 m`, date `2024-12-15`, and rows every four hours from `00:00 GMT`
     through `20:00 GMT`. Brightness is calibrated at `2024-12-15T12:00:00Z`
     directly under the migrated source latitude on longitude `0`, sea-level
     elevation. The model latitude migration resolves the source latitude to
     about `23.4258S`, and record 049 writes the same flat-left/spherical-right
     captioned stack shape as records 047 and 048.
     Record `050-m2-closeout` closes Milestone 2 as a CPU local/flat
     method-confidence POC milestone. Do
     not promote the scalar cap as final
     flat atmosphere extent; it is now a legacy fallback/diagnostic seed for
     this profile. More generally, flat geometry should resolve ray lengths by
     candidate-distance selection across ground/top planes, dome spheres,
     optional radial map extents, supplied scene/hit/max distances, and
     source-owned path limits. This is expected to change the local/flat
     skydome artifacts away from atmosflat Step 018, so the observer-dome
     images are subjective model-inspection/error-spotting artifacts backed by selected-ray
     diagnostics, not parity targets. Map-centered dome behavior is a separate
     full-world profile. The dome truncates the existing altitude-based
     atmosphere composition; it should not compress or rescale density,
     scattering, or absorption profiles near the domain edge. A future
     compressed atmosphere would be a separate 3D medium/composition model, not
     a one-dimensional altitude adjustment. Reflective dome properties are
     another future extension: the dome would become an optical
     boundary/material, not just the current geometry exit.
     Track `ext-025` before claiming local/flat production or integrated shader
     readiness: observer-centered skydomes are diagnostic only and are not
     representative of in-world edge-of-domain views. A user near the southern
     finite-domain edge should use actual map/world-centered geometry; south
     near-horizontal rays should exit almost immediately and contribute little
     atmospheric in-scattering, while upward south rays lengthen gradually.
     The additional subjective M2 skydome scene set
     `san-jose-longitude-summer-solstice-latitude-sweep` is rendered in
     record `043-m2-summer-solstice-latitude-skydomes`. It keeps
     the San Jose longitude, uses observer latitudes `80N`, `30N`, equator,
     `30S`, and `80S`, and uses closest false-Sun approach on summer solstice.
     The source latitude is resolved from the documented
     `annual-tropic-migration` model at `2026-06-21T12:00:00-07:00`, which
     resolves to `23.5 deg N`, before the closest-horizontal-approach rotation
     is applied. Brightness calibration for this set is anchored once at that
     same `23.5N` source latitude and the San Jose longitude, representing the
     local solar-noon/subsolar reference event, and the resulting reference
     spectral incident scale is reused for all five latitude rows. It does not
     replace the Step 018 rotation set and has no guide-image parity target.
     The synchronized-noon flat/spherical comparison set
     `san-jose-longitude-summer-solstice-synchronized-noon-latitude-sweep` is
     rendered in record
     `044-m2-synchronized-noon-flat-spherical-skydomes`. It is subjective
     model-inspection evidence, not a new exact parity target; the dark
     spherical 80S row is expected because the distant Sun is below the
     spherical horizon at northern summer solar noon.
     The Greenwich-noon flat/spherical comparison set
     `san-jose-longitude-summer-solstice-greenwich-noon-latitude-sweep` is
     rendered in record
     `045-m2-greenwich-noon-flat-spherical-skydomes`. It includes per-image
     Sun captions but is no longer the runner's default.
     The 45-degree-east flat/spherical comparison set
     `san-jose-longitude-summer-solstice-45east-noon-latitude-sweep` is
     rendered in record
     `046-m2-45east-noon-flat-spherical-skydomes`. It is now the runner's
     default reusable comparison set and includes per-image Sun captions.
     The North Pole GMT four-hour comparison set
     `north-pole-summer-solstice-2026-gmt-4hour-sweep` is rendered in record
     `047-m2-north-pole-summer-solstice-gmt-sweep`. It includes time row
     labels and per-image Sun captions.
     The South Pole GMT four-hour comparison set
     `south-pole-winter-solstice-2025-gmt-4hour-sweep` is rendered in record
     `048-m2-south-pole-winter-solstice-gmt-sweep`. It includes time row
     labels and per-image Sun captions.
     Continue with Milestone 3 preparation rather than adding more local/flat
     assets by default.
     Every CLI-launched reconciliation experiment run gets its own fresh
     `NNN-*` folder, including reruns; ordinary record verification commands
     are logged inside the active record.
     The atmosflat32 Step 018 sky-dome results are guide images and diagnostic
     comparison material only; they are not canonical exact-match targets for
     Milestone 2. Confidence in the methods is more important than reproducing
     those historical pixels.
     Anything previously supported by calibration must be reproven in the new
     reconciliation POC code before it can support M2 acceptance.
- Milestone 0 is complete: the mutable scaffold exists and its smoke runner
  passed. Do not create a formal numbered record for M0; create the first
  numbered record when Milestone 1 substantive verification begins.
- Treat accepted Step 032 as the authoritative pure Algorithm32 baseline.
  Reconciliation should produce a sourced CPU reference first, then a GPU
  shader validated against that CPU reference. The hard artifact rule is
  matching the accepted Bruneton start-fresh Experiment 32 / Step 032 sky
  dome/four-view artifacts; other artifact or evidence gaps are recorded
  unless they block the current verification claim.
- Current abstraction split is light/source, geometry, atmosphere, incident
  radiance cache/support, and color/display, with Algorithm32 transport
  coordinating the spectral calculation. Milestone 1 must finish this
  abstraction shape, not only make the distant/spherical case work:
  transport must not assume distant light, spherical geometry, a specific
  atmosphere implementation, absent L2 incident sampling, rendering, or color.
  Color/display remains outside CPU transport.
- Complex POC types must have named ambient declarations in an owning
  `types.d.ts` file, and JavaScript implementation code must use JSDoc to
  record those types at parameters, returns, properties, callbacks, and handoff
  values. Runtime class modules use one file per class with that class as the
  single default export; required complex types stay in `types.d.ts`.
  POC class names may be clear working names rather than production-final API
  names; do not pause Milestone 1 for naming polish alone.
  Abstraction contracts must be ambient `interface` declarations, not `type`
  aliases; behavior members use regular method signatures rather than
  properties with function types; value packets and descriptors may remain
  `type`s.
- POC implementation files must keep a compact code reference trail, usually a
  file-level `References:` comment naming the relevant design section,
  action-plan stage, numbered record, source audit, or external source.
  The selected scheme is a directly resolvable inline trail, not `[n]`
  citations against a separate index. Detailed trails still belong in numbered
  records and provenance artifacts.
- Long-running experiment runners must create `<record>/run.log` before
  expensive work begins and append live progress while they run. Image
  generation should log progress from inside the image/pixel loop, such as
  completed rows or scanlines, rather than only after a whole image is done.
  Other nested scans should report row or item progress at a readable cadence.
- Geometry owns spatial interpretation: observer/light placement resolution,
  atmosphere coordinates and paths, source-relative positions, clipping, and
  cache-coordinate mapping. Light source supplies lighting facts from resolved
  source-relative facts. Atmosphere supplies medium, phase, and optical-depth
  facts.
- Incident radiance cache/support owns generated-field descriptors, bindings,
  compatibility validation, sampling, variants, and returned
  `IncidentRadianceSample` packets. Cache building is a setup/build
  coordination across light source, geometry, atmosphere, and
  the general calculator.
- Shared active-baseline constants now live in
  `scripts/flat/reconciliation/POC/src/constants/consts.js`, with ambient
  packets in `constants/types.d.ts`. Atmosphere, artifact-rendering, source
  setup, and primary M1 runners should import those packets instead of copying
  atmosphere, spectral-basis, display, Figure 1 scene/render, or numerical
  control values. The M1 Figure 1 artifact renderer invokes the validated
  display conversion after spectral transport, but the conversion policy
  remains color-abstraction work and not CPU transport. The artifact renderer
  should port the accepted Bruneton start-fresh renderer path for projection,
  sky-disc masking, display conversion, byte packing, and PNG writing,
  adapting only the spectral transport data source.
- Milestone 1 Subgoal 1.0 is complete in numbered record
  `tmp/atmosphere/reconciliation/001-abstraction-closure-contract`, with
  interface declarations refined in
  `tmp/atmosphere/reconciliation/002-interface-contract-declarations` and
  method signatures refined in
  `tmp/atmosphere/reconciliation/003-interface-method-signatures`: the POC now
  has a spectral-only `SpectralReferenceEvaluator`, tightened abstract
  `interface` contracts, post-transport output/comparison type homes, and a
  contract probe proving the evaluator can run through non-spherical/non-
  distant mocks without rendering/color dependencies. Records
  `tmp/atmosphere/reconciliation/011-parameter-provenance-extraction`,
  `tmp/atmosphere/reconciliation/012-transport-helper-invariants`,
  `tmp/atmosphere/reconciliation/013-concrete-distant-spherical-run`, and
  `tmp/atmosphere/reconciliation/014-distant-l2-cache-build-bind-sample`
  complete the pre-artifact M1 implementation through distant L2 cache
  build/bind/sample. Record
  `tmp/atmosphere/reconciliation/015-first-sky-dome-artifacts` produced the
  first four reduced-size 96px Figure 1 sky-dome PNGs through the POC renderer
  with no exact Step 032 parity claim. Record
  `tmp/atmosphere/reconciliation/016-step032-full-image-comparison` closes
  Milestone 1 with full-size cache-backed Step 032 decoded RGBA parity across
  all four accepted PNG targets. Record
  `tmp/atmosphere/reconciliation/005-shared-baseline-constants` adds the
  constants module that those concrete M1 pieces should consume, and record
  `tmp/atmosphere/reconciliation/006-artifact-renderer-display-conversion`
  records the artifact-renderer ownership for M1 display conversion. Record
  `tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity` makes the
  M1 comparison gate exact decoded RGBA match across the four accepted Step
  032 PNGs. Record
  `tmp/atmosphere/reconciliation/009-m1-granular-record-strategy` keeps the
  `NNN-*` folder convention and says M1 evidence should be split across
  parameter/provenance, transport-helper, concrete distant/spherical execution,
  and Step 032 image-comparison records. Record
  `tmp/atmosphere/reconciliation/010-cli-experiment-run-record-rule` says each
  CLI-launched experiment runner invocation gets its own fresh `NNN-*` folder.
  Milestone 2 is concrete local light source plus flat geometry implementation
  on the same contracts, reusing the M1 algorithm/cache lifecycle, with
  method-confidence criteria rather than exact reproduction of atmosflat32 Step
  018 sky domes. Record
  `tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward` completes
  the M2 carry-forward/tracker setup. Record
  `tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision`
  settles the flat projection as north-polar azimuthal equidistant and sources
  the projection facts to PROJ while leaving Earth-radius source precision
  open. Record
  `tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership`
  clarifies that atmosphere/profile owns top altitude, geometry calculates ray
  exits against supplied domain boundaries, and renderer/view policy owns
  no-hit sky caps. Records 025 through 030 run M2 through Subgoal 2.5 asset
  generation, records 031 and 032 preserve rejected stack-comparison attempts,
  record 033 adds the requested three-column diagnostic stack, records 034
  through 037 diagnose and fix the observed local/flat coordinate warnings,
  record 038 regenerates fixed full-size local/flat domes, and record 039
  creates the six-column warning-fix comparison stack with zero 029-vs-latest
  pixel delta. Record 040 implements the observer-centered finite-dome
  skydome profile and regenerates the five full-size local/flat domes; record
  041 creates the requested two-column atmosflat/new stack with no diff
  column; record 042 adds the requested three-column diff stack; record 043
  renders the subjective summer-solstice latitude skydome set; record 044
  renders the north-up synchronized-noon flat/spherical comparison stack;
  record 045 renders the Greenwich-noon captioned flat/spherical comparison
  stack; record 046 renders the 45-degree-east-noon captioned comparison
  stack and is now the reusable default; record 047 renders the North Pole
  summer-solstice GMT four-hour comparison stack; record 048 renders the
  South Pole winter-solstice GMT four-hour comparison stack; record 049
  renders the Union Glacier Final Experiment GMT sweep; and record 050 closes
  M2. Next is Milestone 3.
  The current milestone order is recorded in the reconciliation action plan:
  Milestone 0 preparation, then CPU distant-sun spherical-earth against
  accepted Bruneton Step 032 sky dome/four-view visuals, CPU local-sun
  flat-earth method-confidence work guided by atmosflat32 Step 018 visuals,
  GPU distant-sun
  spherical-earth against the CPU reference through browser-run jobs, and GPU
  local-sun flat-earth informed by shader-lab plus local-second-order evidence.
  The browser watcher may be designed and implemented before Milestone 3, but
  the long-lived browser process itself is a user-run step when sandbox
  restrictions prevent the agent from launching or controlling the browser.

## Reload Sources

Load these docs to continue the current Milestone 3 handoff:

- [Reconciliation Lane](apps/flat/reconciliation/README.md)
- [Reconciliation Status](apps/flat/reconciliation/status.md)
- [Reconciliation Action Plan](apps/flat/reconciliation/action-plan.md)
- [Algorithm32 Abstraction Design](apps/flat/reconciliation/algorithm32-abstraction-design.md)
- [Reconciliation Shader Design](apps/flat/reconciliation/shader-design.md)
- [Reconciliation Experimental Guidelines](apps/flat/reconciliation/experimental-guidelines.md)
- [Local Sun Flat Geometry Fact Inventory](apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md)
- [Unsourced And Partially Sourced Facts](apps/flat/reconciliation/unsourced-and-partially-sourced-facts.md)
- [M2 Calibration And Evidence Plan](apps/flat/reconciliation/m2-calibration-and-evidence-plan.md)

Those documents contain the current status, plan, scaffold inventory,
type/module rules, artifact policy, and the local Sun / flat-geometry
reference gap ledger carried forward for production and shader work. The M2
calibration/evidence tracker owns the lists of calibration reproof obligations
and still-needed external evidence outside the action plan. Also read
`scripts/flat/reconciliation/POC/CURRENT_STATE.md` for the mutable POC state.

Current shader-design split: [Reconciliation Shader Design](apps/flat/reconciliation/shader-design.md)
is an operation design plus the CPU postprocess shader scene-input contract, not a
browser/test-runner design. It covers setup/config/runtime lifecycles,
abstraction-owned shader contributions, cache-owned texture/access assembly
through `TextureBuilder`, bindings, symbol inventory, `ThreeGateway`, pass
installation, invalidation, diagnostics, and the `postprocessSceneInput(...)`
composition shape. Browser watcher, screenshot/capture, image comparison,
parity tolerance, and comparison records stay in the action plan and numbered
experiment records.
M3 baseline rule: do not reimplement validated behavior in adapters, runners,
comparisons, or shader-support helpers. Use only public `evaluate(...)`,
already implemented configuration endpoints, and the validated Bruneton-based
dome rendering color adapter for baseline work. Do not call lower-level
algorithm, calculator, cache, geometry, source, or atmosphere internals. New
GPU GLSL is the implementation under test, not the CPU/reference baseline.
The first concrete Milestone 3 deliverables are the CPU postprocess
soft-shader and the reusable GPU validation scene set. The soft-shader must
act as a scene-input adapter over the public reconciliation `evaluate(...)`
operation, not call `SpectralCalculator`, geometry, atmosphere, light-source,
cache, or other algorithm internals independently. Its composition contract is
`endpointRadiance * T_view + L_path`, with spatial endpoint facts coming from
the evaluation/geometry result. Before the scene-input contract is finalized,
the action plan now requires a hit-data itemization pass that assigns every hit
datum to one owner/route in descriptor/setup configuration and decides whether
the first validation target needs endpoint radiance contribution at all. If it
does, the preferred physical path is authored/resolved spectral endpoint
radiance composed after transport; renderer RGB-derived material color needs a
separate color/material policy. If an RGB-derived spectral endpoint path is
selected, the preferred RGB-to-spectrum direction is an inverse fit against
the validated Bruneton-based spectral-to-display adapter, with explicit
constraints and error reporting because the conversion is lossy and
non-unique. Stage 3.1.0b runs focused inverse-fit experiments only if
RGB-derived endpoint spectra are needed. RGB/display color must never enter
`evaluate(...)`. All color
conversion, including RGB-to-spectrum inverse fitting, belongs to the color
abstraction. Mining the current soft-shader favors geometry-only hit input for
the first contract: hit mask/distance drive transport, while spectrum-id
fixtures and captured RGB are post-transfer composition policies. The current
practical bridge for renderer hit color is the local-second-order captured
scene-color policy: the installed local-second-order GPU shader composes
captured scene color as an inverse-tone-mapped endpoint proxy before tone
mapping instead of adding tone-mapped scene RGB after atmosphere display
conversion. For the reconciliation CPU color task, this is the canonical
diagnostic scene-color mechanism to mirror outside `evaluate(...)`, not an
RGB-to-spectrum or matte/Lambertian endpoint-radiance reconstruction.
The first `captured-linear-scene-color` proxy render, record
`096-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset`, looked
overly blue; likely cause is proxy scale mismatch, with camera distance still
a plausible separate contributor. The same-scene inverse-tone-map proxy rerun,
record `097-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset`,
looked much more plausible in review and is the current `3.D1`
visual/plausibility result for
`with-shader-distant-local-sunrise-sunset-side-by-side`, the artifact-092
lineage with spherical distant Sun on the left, flat local Sun on the right,
and rows from sunrise through sunset. Avoid treating it as a new
reconciliation milestone gate. The active thread is back to Milestone 3 shader
design, with records `218` through `220` now proving the CPU postprocess
soft-shader hit-color contract and reusable GPU validation scene set.
Bruneton 2017 and the accepted Step 032 Bruneton-based color
adapter remain the primary authority for physical endpoint radiance
composition; broader color-science sources are reserved mainly for inverse
RGB-to-spectrum ambiguity.
Scene-object intersection context is an additive
`evaluate(...)` parameter and must be validated in M3: no-hit rays preserve
baseline behavior, finite scene hits shorten only geometry-resolved segments,
and endpoint radiance or captured color remains postprocess composition data.
If the hit contributes material/color/surface-radiance facts, those facts go
to the color/display or postprocess composition boundary, not to geometry.
More generally, scene-derived effects that affect Algorithm32 are routed by
descriptor/setup configuration and compiled by the adapter into typed request
or composition fields. `evaluate(...)` must not receive caller-supplied
owner/route labels or RGB/display color; contributions without a
descriptor-declared owner are rejected by setup or scene-input validation.
This contract is mirrored in the Algorithm32 production design. The scene set
must produce CPU soft-shader baseline outputs before
GPU comparison and must separate objective hypothesis/fact scenes from
subjective plausibility-review scenes.
Current POC handoff for scene hit color: record
`214-m3-geometry-owned-ground-green-boxes-202m` is only a spectrum-fixture
routing diagnostic. Record `215-m3-matte-lambertian-three-color-202m` and
diagnostic records `216/217` showed the matte/RGB-to-spectrum detour did not
match the current local-second-order composition behavior; at `120 x 68`,
record `217` still averaged green-box CPU pixels around
`[75.9, 159.2, 121.1, 255]`. Records `218` and `219` lock the intended
contract: only ray and finite hit distance enter `evaluate(...)`; captured
scene color remains a named endpoint contribution outside transport; spectral
path radiance/transmittance comes out; then the display/color layer composes
that spectral output with hit color. Record
`220-m3-captured-scene-color-green-boxes-120x68` is the current accepted
scene proof. It uses the local-second-order
`captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy` policy
for all hit pixels and renders the green boxes as green again, with average
green-box CPU RGBA `[68.1, 153.3, 114.8, 255]`. Do not reintroduce spectral
fixture shortcuts or pass RGB/display color into `evaluate(...)`.
Records `223` and `232` are the current cache-backed CPU green-box references
at `120 x 68`, 2 m observer altitude; both keep the color contract unchanged,
with only ray plus finite hit distance entering `evaluate(...)` and captured
scene color composed afterward. Records `230` and `231` move cache boundary
handling to geometry/cache ownership and make the assembled shader look up
incident radiance from the actual transport sample position. Records `235` and
`236` supersede the depth-tie/magenta no-hit browser mechanism from records
`225` and `228`: scene depth now carries packed finite distance only, the
endpoint signal is the explicit `uSceneHitTexture` mask, and
`resolveAtmospherePath(...)` receives `bool hasSceneEndpoint` rather than
deriving that fact from depth bytes or tolerances. Record `236` accepted the
`120 x 68`, 2 m browser shader smoke and wrote
`tmp/atmosphere/reconciliation/237-m3-planet-sphere-ground-shader-scene/canvas-image.png`
with shader source hash
`3f2547da129abe62749bbb7b9b3cbc056ca9129478a4e177bcb05c26bdecd220`.
Records `261` and `262` superseded the intermediate shader color scene fixes
for the pre-lighting CPU/browser pair: the `120 x 68`, 1500 m scene places
four green boxes from foreground to farther ground, uses a denser `512 x 256`
visual ground sphere, derives ground display color from the ground hit point
as a visible pattern, and writes the shader artifact at
`tmp/atmosphere/reconciliation/263-m3-planet-sphere-ground-shader-scene/canvas-image.png`.
The matching CPU and shader diagnostics report `3837` ground hits, `49`
near-box hits, `62` middle-box hits, `30` far-box hits, `20` very-far-box
hits, and an accepted `ground-color-varies-from-hit-geometry` criterion. The
CPU diagnostics now also record geometry endpoint metadata with
`widthSegments: 512` and `heightSegments: 256`; browser diagnostics record
`groundSphereWidthSegments: 512` and `groundSphereHeightSegments: 256`.
Record `255` is a `320 x 180` shader-only visual diagnostic at the same
`1500 m` elevation after the mesh-density change. Records `241`, `242`,
`243`, `245`, `246`, `252`, and `253` are superseded by visual review because
the earlier lower-camera or lower-density setups made placement, pattern
aliasing, and flat unlit faces too easy to confuse with the horizon problem.
Record `302-m3-150m-colored-ground-mesh-exact-ground-hit-shader-640x360`
superseded the recent planet-sphere color-source behavior by restoring a
visible `MeshLambertMaterial` ground mesh that wrote rendered color into
`uSceneColorTexture`, but it still kept a separate exact spherical raycast
object as the ground hit-distance and hit-mask authority. Records `304` and
`307` tried to make the visible mesh own those facts through per-pixel mesh
raycasts, but that path timed out at `640 x 360`. Records `308/309` and
`310/311` introduced a rendered distance pass from the visible meshes, then
showed that background pixels must be excluded from that pass. Record
`312-m3-150m-rendered-distance-no-background-hit-mask-shader-640x360` is the
current accepted hit/color alignment record: the distance pass clears
background to `null`, visible meshes own rendered scene color, hit distance,
and explicit hit mask, and the exact sphere is no longer the ground hit
authority for this browser scene. The accepted browser artifact is
`tmp/atmosphere/reconciliation/313-m3-planet-sphere-ground-shader-scene/`,
including both `pre-shader-scene-color.png` and post-shader
`canvas-image.png`. Diagnostics report `128283` hit pixels, `102117` no-hit
pixels, `109110` ground hits, `12790` near-box hits, `5139` middle-box hits,
and `1244` very-far-box hits. Public `evaluate(...)` remains unchanged: only
ray facts plus finite hit distance enter transport, and rendered hit color is
composed after spectral path radiance/transmittance.
For the current apparent-curvature investigation, the planet-sphere camera
look target has been corrected to the actual spherical horizon tangent point.
Records `268` and `270` are GPU-only visual diagnostics, not accepted
all-boxes-visible contract records: `268` renders `4500 m` at `640 x 360`
with tangent target `[0, -4.4968, -239.1220]` scene units and horizon distance
about `239.29 km`; `270` renders `150 m` at `640 x 360`, with
`observerAltitudeSceneUnits: 0.15` and horizon distance about `43.68 km`. Both
write useful shader images but reject because the existing box-hit criterion
does not fit those framings. The similar curve read across `150 m` and
`4500 m` points away from simple altitude scaling and toward projection/FOV or
the diagnostic ground pattern.
Records `272` and `274` add GPU-only solid-ground diagnostics via
`--ground-display-mode solid`, which keeps the same ray/hit shader path but
removes the hit-point `60 m` checker and `140 m` depth band from captured
ground color. Those records intentionally reject the ground-color-variation
criterion, but their images show the bowl-like ground read is much weaker with
solid ground. Treat the remaining slight horizon sag as expected wide-FOV
spherical-limb behavior unless a later numeric projection check says
otherwise; the pronounced curved-ground impression is now most likely the
diagnostic pattern/projection combination.
Record `276` raises the solid-ground GPU diagnostic to `6000 m` and adds a
mathematical horizon trace overlay. The trace confirms the altitude is scaled
to `6` scene units, horizon distance is about `276.33 km`, and the projected
horizon line sits at pixel `y=180` near center and `y=186` at both image edges
in the current `640 x 360`, `62 deg` vertical-FOV projection.
Record `278` changes the planet-sphere diagnostic default vertical FOV to
`35 deg` and adds `--vertical-fov-degrees` for future comparisons. The same
`6000 m`, `640 x 360`, solid-ground trace now sits at `y=180` near center and
`y=184` at both edges, reducing edge sag from `6 px` to `4 px`. The accepted
`261/262` CPU/GPU color-contract pair predates this FOV default change; rerun
that pair before treating `35 deg` as refreshed accepted contract evidence.
For review imagery, borrow the latest accepted local-second-order subjective
scene lineage: Southern France no-shadows terrain, fitted local-angle views,
local vertical stack `080`, and optional star-field stack `086`. Shader-lab
is older corroborating history for this task; the local-second-order lane and
record `097` are the current source for captured scene-color endpoint
composition behavior.

Load these only when the task needs their specific evidence:

- [Algorithm32 Status](apps/flat/algorithm32/status.md)
- [Algorithm32 Conclusions](apps/flat/algorithm32/conclusions.md)
- [Bruneton Start-Fresh Source Audit](apps/flat/reconciliation/bruneton-start-fresh-source-audit.md)
- [Post-Step032 Product Facts Audit](apps/flat/reconciliation/post-step032-lane-source-audit.md)

Load these production docs only as supporting context when the task needs the
future promotion boundary or existing scaffold shape:

- [Algorithm32 Production Documentation](apps/flat/algorithm32/README.md)
- [Algorithm32 Requirements](apps/flat/algorithm32/requirements.md)
- [Algorithm32 Production Design](apps/flat/algorithm32/production-design.md)
- [Algorithm32 Primary Facade API Draft](apps/flat/algorithm32/api-facade-draft.md)

Use broader flat docs only when the task needs current app status or historical
experiment evidence. The sections below are supporting historical/context
notes; the quick start, minimal reload sources, and POC `CURRENT_STATE.md` are
sufficient for fresh-agent Milestone 2 continuation.

## Current Checkpoint

- Active scope: plan and run the `reconciliation` experimental lane. Work in
  the lane docs, reconciliation scripts, and reconciliation output artifacts.
  Treat production scaffold/API/code changes as out of scope unless the user
  explicitly asks for them.
- The lane must first produce a reference-backed CPU Algorithm32 design and
  experimental target, then a GPU shader target validated against that CPU
  reference.
- The GPU shader may take named implementation shortcuts relative to the CPU
  reference, but only when they are tolerance-bounded and tested against the
  baseline-faithful CPU reference. Shader shortcuts do not redefine Algorithm32.
- The initial implementation ships one atmosphere profile: the accepted
  Algorithm32 canonical profile. Alternate profiles are future named
  extensions.
- Every promoted constant needs per-value provenance: external source,
  source-backed derivation, or accepted Algorithm32 experiment/decision.
- The lane is not complete until the shape and flow of all data is known and
  documented across configuration, light/source, geometry, atmosphere,
  incident radiance cache/support, Algorithm32 transport, shader resources,
  spectral output, diagnostics, and external color/display conversion.
- Complex shape documentation is part of that contract: packets, descriptors,
  requests, samples, callbacks, handles, diagnostics, shader contribution
  packets, cache keys, and persisted artifact shapes live in ambient
  `types.d.ts` files, with JS implementation files referencing those names
  through JSDoc. Runtime class files should contain one class and
  default-export only that class.
- Light/source, geometry, atmosphere, and optional incident radiance
  cache/support feed Algorithm32 transport. Color is a published boundary
  outside the algorithm itself. The CPU reference transport should not depend
  on color, but the later GPU shader build will need the color/display
  interface for renderable output.
- Reconciliation must preserve the accepted Algorithm32 transport algorithm
  while sharpening its production abstractions. Geometry owns observer/light
  placement resolution, model-space meaning, source-relative positions,
  geometry clipping, and source-relative cache-coordinate mapping. Light
  source owns lighting facts such as spectrum, radiometry, angular extent,
  falloff, calibration, distance-use treatment for geometry-measured source
  distance, source path limits, and the source-declared incident cache family.
  Atmosphere owns medium and phase facts. Incident radiance cache/support is
  now a fifth abstraction interface that owns generated incident-field
  descriptors, bindings, variants, lookup/sampling policy, and returned
  `IncidentRadianceSample` facts. Transport consumes those packets and must not
  derive light-source distance or interpret geometry coordinates. The
  abstraction design now has a dedicated
  `Algorithm` section for the owner-query `evaluate(...)` Markdown algorithm,
  listing only calculation-consumed outputs with function-style owner-query
  notation, bold variable names, and plain Markdown calculations using
  `<sub>`/`<sup>` tags where subscript or exponent notation helps. The
  algorithm now explicitly surfaces `AtmosphereCoordinate`,
  `SourceRelativePosition`, light-source-owned `sourcePathLimit`, and
  geometry-owned `sourceAtmospherePath` handoffs to reduce cross-interface
  leakage; the coordinate-space section now names `AtmospherePath` as the
  geometry-owned path transform into atmosphere coordinates plus segment
  measures. The cache design now treats `IncidentRadianceCache` as a
  coordinated generated incident-radiance field: the light source creates the
  concrete source-shaped cache, the cache owns its logical coordinate
  generator/keying/generated values, and a generic setup/build coordinator
  passes each cache-owned coordinate back to the cache with geometry,
  atmosphere, light source, and the general calculator.
  Geometry maps both cache build coordinates and runtime path
  samples into the same source/atmosphere-relative cache-access domain, and
  setup validates the built cache against active context descriptors before
  evaluation receives operation-ready incident radiance sampling.
  The general calculator, provisionally `SpectralCalculator`,
  subsumes the old radiance-port idea and owns the reusable readable
  `computeRadiance(...)` loop used by both primary evaluation and cache
  generation. It is configured with geometry, atmosphere, light source,
  spectral basis, and execution controls; `computeRadiance(...)` receives the
  resolved `RaySegment`, the prebuilt `PathIntegrationPoint[]` value packet, and optional
  operation-specific `IncidentRadianceSampling`. Cache generation omits that
  optional value.
  `computeRadiance(...)` returns `PathRadiance`: `inScattered` plus final
  `transmittance`; `inScattered` is path-added spectral radiance,
  with "in" meaning light scattered into the evaluated ray, `transmittance` is
  the dimensionless surviving endpoint multiplier, cache builds store
  first-order `inScattered`, and endpoint composition remains explicit. Both fields use the shared `SpectralValue`
  type; the field/parameter name carries physical meaning and units.
  Higher-order field preparation can happen during setup/cache building, but
  higher-order contribution is still sampled and weighted inside each
  path-integration-point loop.
  The public operation is `incidentRadianceSampler(cacheAccess)`,
  where `cacheAccess` is a geometry-resolved packet derived from the current
  path-integration-point facts and consumed by the bound support. Configuration-time variants
  are `null`, `distant`, and `local`; the null variant skips cache lookup and
  contributes zero incident in-scattering. Separate artifacts are optional
  persistence, diagnostic, or shader-packing outputs, not required runtime
  objects. Shader setup uses the same logical cache through cache-owned
  texture creation requests and cache-owned lookup/access assemblies. The
  cache owns the texture shape and calls `TextureBuilder`; `ShaderBuilder`
  assembles and compiles the contributed shader code, while `ShaderBinder`
  applies sampler bindings. Shared CPU/shader logic is limited to setup/build
  contracts and utilities: canonical descriptors, fingerprints,
  spectral/channel helpers, numerical-control descriptors, cache-build
  coordination, concrete cache families, cache-access contracts, cache
  texture/access contribution contracts, diagnostics, provenance, and
  fail-loud validation.
  CPU transport remains JavaScript, while shader runtime transport is assembled
  into GLSL and validated by descriptor-backed parity tests. The shared
  `SpectralCalculator` general calculator owns the reusable
  readable radiance loop for both primary evaluation and cache generation,
  while its lower-level helper methods own named equation terms,
  spectral-channel math, fixture-backed calculations, and small convenience
  loops such as spectral-channel or directional-sample reductions. Helper
  methods take explicit calculation parameters instead of broad request
  objects. Atomic inner-loop helpers reduce explicit inputs to one returned
  value packet, such as one `SpectralValue`. They may also take the
  exact interface instance they need, such as atmosphere phase sampling for a
  directional incident loop, and call it directly inside that named
  calculation. Moving stable collaborators into calculator configuration
  shrinks orchestration signatures only; the lower-level helper surface remains
  explicit and fixtureable. Path integration point construction can live on the calculator
  because it creates endpoint/trapezoid `PathIntegrationPoint[]` value objects from a
  geometry-resolved `RaySegment` and interval count, with no geometry,
  atmosphere, light, or cache queries. Each point is defined by
  `distanceAlongRayMeters` within the owning segment plus integration weights;
  `measureMeters` is the effective path length represented by that point.
  Model-space position is derived from the segment ray when needed. The coarse
  transport split is now
  `viewRaySegment = geometry.resolveViewRaySegment(...)`, then
  `pathIntegrationPoints = calculator.buildEndpointTrapezoidPathIntegrationPoints(...)`,
  then `pathRadiance = calculator.computeRadiance(viewRaySegment, pathIntegrationPoints,
  incidentRadianceSampling)`. Its helper methods must not own the cache
  coordinate loop, setup lifecycle, or
  shader resources. The cache-build method surface is now explicit:
  coordinator
  `buildIncidentRadianceCache(...)`; light source
  `describeIncidentRadianceCache(...)` and
  `createIncidentRadianceCache(...)`; cache `coordinates()`,
  `addCoordinateToCache(...)`, `createIncidentRadianceSampler(...)`,
  cache-owned shader texture creation through `TextureBuilder`, and
  cache-owned shader access assembly; sampler callback
  `incidentRadianceSampler(cacheAccess)`;
  geometry
  `resolveViewRaySegment(...)` plus cache mapping/build/access resolvers; atmosphere
  cache-dependency descriptors;
  `calculator.buildEndpointTrapezoidPathIntegrationPoints(...)`;
  `calculator.computeRadiance(...)`; and `ShaderBuilder` composition of the
  cache-owned texture/access contribution. The design also has a
  coordinate-systems section for configuration, model, ray/path,
  observer-local sky, source-relative, cache, shader input, and display/color
  spaces plus their transforms. The source-relative position synthesis now
  covers both distant and local Sun: geometry resolves `SourceRelativePosition`
  as only direction from source plus `distanceFromSourceMeters` when geometry
  has a finite placement; optional source-relative frame facts, geometry
  boundary context, and descriptor-driven cache coordinates are adjacent
  contracts, not fields on that position. The coordinate zero/source origin
  must be explicit in placement
  descriptors: finite sources use a geometry-resolved source anchor, while
  source orientation can also be geometry-resolved into the source-relative
  frame when relevant, and directional sources declare no finite origin and use
  `distanceFromSourceMeters = null`. The light source interprets that position
  into incoming direction, distance-use treatment, angular extent, falloff,
  spectral scale, and source path limit. Distant cache indexing collapses to
  altitude/incoming direction/spectrum, while local finite indexing also needs
  source-relative radial distance.
- The initial production atmosphere coordinate is altitude-only vertical
  stratification: reconciliation should require a geometry-owned resolver,
  provisionally `GeometryModel.resolveAtmosphereCoordinate(...)`, that maps
  model-space positions to `altitudeMeters`. Atmosphere samples
  density/coefficient profiles from that resolved coordinate. Earth/geographic
  coordinates, ocean/land selectors, season, weather, and regional aerosol
  families are later profile-selector extensions, not first-pass transport
  requirements.
- The reconciliation lane must recreate the objective and subjective artifact
  families from `scripts/flat/local-second-order/`, including criteria JSON,
  diagnostics/reports, browser captures, source matrices, and review galleries.
- Optional further validation can add a real-Sun-matched local-source
  comparison on spherical geometry: configure a finite local Sun to match the
  resolved distant/real Sun at a reference view point, then compare outputs and
  diagnostics on the same geometry as limiting-case/source-geometry-separation
  evidence rather than external validation of local-Sun physics. This tests an
  explicit source/geometry handoff, not geometry-blind lighting: record frame,
  resolved positions, distances, apparent size, path clipping, falloff inputs,
  and calibration state. If the local source cannot run without flat geometry,
  classify whether the gap is missing source config, missing geometry fact,
  coordinator data flow, or improper coupling.
- The local Sun / flat-geometry inventory separates source-backed
  sub-equations from artificial false-Sun model parameters, long-sightline
  geometry policies, local L2 cache execution choices, and display fixtures.
  Promote this family only as a named Algorithm32 extension profile unless
  reconciliation replaces individual facts with fully sourced production
  parameters.
- Use the unsourced/partially sourced fact ledger as the action checklist for
  `parameters.md`: each row must be sourced, accepted, relabeled as authored
  configuration, rerun under reconciliation, or explicitly excluded before
  production promotion.
- Use `agents/topics/apps/flat/algorithm32/status.md` as the concise current
  handoff, `agents/topics/apps/flat/algorithm32/conclusions.md` for the
  detailed sourced conclusions, and
  `agents/topics/apps/flat/reconciliation/README.md` plus
  `agents/topics/apps/flat/reconciliation/status.md` for the expanded
  reconciliation lane plan and current lane status. Use
  `agents/topics/apps/flat/reconciliation/shader-design.md` for the current
  GPU shader architecture target. Use
  `agents/topics/apps/flat/reconciliation/experimental-guidelines.md` as the
  operating rulebook for reconciliation artifacts and criteria.

## Scope Boundary

- This active topic is the reconciliation lane. Default actions are
  documentation, design-contract clarification, source/provenance audit,
  experiment planning, and future reconciliation script/artifact work.
- Do not edit `shared/algorithm32/production/`, production ambient types,
  scaffold specs, or runtime code while working this topic unless the user
  explicitly redirects to production implementation or asks to promote an
  accepted reconciliation decision.
- Provisional names such as
  `GeometryModel.resolveAtmosphereCoordinate(...)` are lane design candidates.
  Keep them in reconciliation/design docs until accepted for production.
- Production docs may be read to understand the future promotion boundary, but
  they are not the active work surface for this lane.

## Supporting Production Context

The notes below describe existing production-design context and historical
handoff details. They are supporting context for reconciliation, not permission
to modify production scaffold or runtime files from this active topic.

- Algorithm32 should become the production owner for the usable
  shader/runtime atmosphere pass. Sun, atmosphere composition, geometry,
  execution configuration, calibration, IncidentRadianceCache, internal shader
  texture/cache builders, display conversion, Three adapter behavior, CPU
  reference code, and validation helpers support that shader product. The core
  transport fact providers are light/source, atmosphere, geometry, and optional
  incident radiance support; color/display is adjacent output conversion.
  Numerical controls are execution configuration, not a peer domain model.
  Per-path evaluation and shader texture/cache building should be separate
  implementation responsibilities that consume the same facade-owned shared
  configuration/facts model.
  CPU/reference evaluation may remain public; texture/cache building is
  implementation-owned behind awaited shader setup and awaited shader-handle
  config updates. Runtime shader behavior belongs to facade configuration,
  likely `Algorithm32Config.shader`, not just the one-time Three setup request:
  shader mode, debug view, cache/resource policy, capability failure policy,
  and render-target/HDR/depth policy are updateable configuration. The Three
  setup request supplies app-owned attachment handles such as composer, scene,
  camera, renderer-compatible surface, and pass insertion location. The current
  assumed public shape is
  a configured Algorithm32 facade object constructed once per independent
  simulation window. It coordinates two internal implementation classes: a
  CPU/reference algorithm execution class for evaluation and texture/cache
  work, and a runtime shader builder. The facade creates a
  shared configuration/facts model from validated config and passes that model
  reference to both implementation classes.
  Instance state owns configuration, validation state, the shared model,
  shader bindings, cache descriptors, GPU resources, and disposal scope; the
  shared model must not become a global mutable singleton. The current
  POC/lane audit adds that
  normal runtime input is a live Three scene rendered to scene-color plus
  depth textures and then composed by an Algorithm32 fullscreen pass;
  JSON/Raycaster scene inputs are validation-only. The facade should own or
  expose source-driven Three lighting synchronization,
  geometry/camera/depth policy, runtime capability diagnostics, stable debug
  views, and fail-loud local second-order cache binding. Latest POC
  consolidation: the shared shader class/GLSL,
  accepted local finite-Sun source resolver, IncidentRadianceCache
  `Data3DTexture` upload, and live Three scene-color/depth to Algorithm32
  display-pass wrapper are in `shared/algorithm32/POC/`. The
  `scripts/flat/local-second-order/page/` lane still owns browser harness,
  terrain/gallery composition, renderer diagnostics, render-scale/antialias
  controls, and remaining source-light review plumbing. The shared model
  provides canonical facts and descriptors; per-path evaluation owns
  `EvaluationRequest` and single-path output, while internal texture/cache
  building owns build request state, grid traversal, packing, descriptors,
  cache keys, and packed payload output. Local Sun calibration/resolution and calibration
  replay/invalidation belong to the upstream local Sun configuration layer;
  the main Algorithm32 facade receives the configured public `Sun`. From the
  API consumer point of view, the normal product path should likely be the
  runtime shader facade: build the runtime shader from packaged shader source
  and shared-model descriptors plus configured shader runtime policy, attach
  the resulting pass to the caller's composer, explicitly prepare/rebuild
  required textures outside the render frame behind awaited setup/config
  updates, update config/display state, render through the composer, and
  dispose. Per-path evaluation remains
  the CPU/reference/offline consumer method. Texture artifact building and
  validation are implementation-owned unless a later non-app tooling consumer
  justifies a narrow API. Packet construction/preflight, display conversion,
  and validation/parity helpers are support tiers with narrower consumers.
  The Three adapter call surface is
  distinct from Algorithm32 configuration: it wraps render-target, depth
  texture, ShaderMaterial, fullscreen quad, renderer target/render/clear,
  uniform update, texture upload, resize, and dispose calls. The candidate
  consumer-facing Three adapter method is
  `await algorithm32.setupShader({ THREE, composer, scene, camera })`;
  it receives the caller's existing Three composer pipeline, prepares and
  installs the runtime integration, returns a handle that owns the
  `ShaderMaterial`/fullscreen-pass lifecycle, and receives Algorithm32 inputs
  as uniforms/textures. The composer is required; Algorithm32 installs into
  the existing composer so the app keeps calling `composer.render()`. Its
  purpose is to reduce caller decisions and operations around
  Three-specific material, target/depth, upload, pass order, resize, and
  disposal details, and to reduce caller dependence on Algorithm32-specific
  shader/cache/spectral binding knowledge. Long work remains explicit because
  setup/config updates are awaited outside the frame render. Requested local
  second-order shader mode must validate its incident-cache texture/descriptor
  before rendering and must not silently fall back to first-order if the
  resource is missing or mismatched.
  The core
  abstractions should be public Algorithm32 API interfaces, not private factory
  packet conventions. The requirements are organized by implementable
  ownership domains, so API design should preserve those self-contained code
  seams.
- The current public facade draft is documented in
  `apps/flat/algorithm32/api-facade-draft.md`. It keeps the configured facade
  to `constructor`, `config` getter, `setConfig`, awaited `setupShader`,
  `evaluate`, `getDiagnostics`, and `dispose`.
  `setupShader` returns the handle that owns runtime Three resources, normal
  resource preparation, composer integration, diagnostics, and disposal.
  Algorithm32 should be installed into the app's existing composer or
  composer-compatible framework render hook; it should not require a second
  animation loop, raw-renderer-only production path, or separate normal-path
  resource-preparation checklist.
- Local Sun setup should default to calibration, not a brightness knob.
  User view latitude, longitude, local time, and altitude are authored
  configuration and may supply app context and comparison inputs, but the flat
  model has no independent real-time standard. Select a named calibration
  reference event, align local closest approach to that event, derive the
  clock offset and source power, and allow recalibration at any time.
  Current working policy is that the default brightness calibration anchor
  should probably be local solar noon at the source latitude; after that, scene
  rows should be synchronized by clock/orbit offset rather than by
  recalibrating source power per observer latitude.
  Production local-source brightness should replace the POC's dimensionless
  `referenceSpectralIncidentScale` bridge with unit-bearing radiometric source
  calibration. Use a target sea-level direct normal irradiance directly under
  the configured finite Sun at the calibration event, account for source-path
  transmittance and apparent solid angle / finite-source geometry, then solve
  for fixed source spectral radiance or power for that Sun altitude and size.
  Calculate or invalidate that derived value when relevant user/profile
  configuration changes, then expose it as resolved source configuration.
  Reuse that resolved source brightness for other observer rows; changes there
  should come from geometry, distance, transmittance, and solid angle rather
  than per-observer brightness recalibration or per-pixel transport work.
- Local Sun configuration/calibration must influence the main Algorithm32
  algorithm only by resolving to the public Sun interface. Public interfaces
  are encapsulation boundaries; for Sun, atmosphere composition, and geometry,
  nothing outside the corresponding public interface and public input/resolver
  types may leak into transport, shader texture builders, caches, runtime
  shader APIs, display, validation, cache keys, descriptors, uniforms,
  fixtures, or generated artifacts.
- Basic user-authored local Sun settings should stay limited to altitude,
  diameter, northern latitude limit, and southern latitude limit. The default
  altitude, size, and latitude migration are source-recovery tasks for the
  steel-man profile; source brightness and real-time synchronization are
  calibration outputs, not user-entered physical constants.
- User view placement is configured separately from local Sun parameters:
  latitude, longitude, local time, and view altitude are Algorithm32
  configuration. The app may derive or default altitude upstream, but
  Algorithm32 should receive the configured value. Do not promote historical
  San Jose fixture elevation or `[0, 0, 2]` observer height as production
  defaults.
- Orbit direction and period are standardized model behavior, not user-entered
  fields. Resolved orbital speed may be shown as an instantaneous derived
  display value for the current simulation time and location.
- Brightness/source power is derived calibration state. Any later visual
  adjustment should be exposure or tone mapping, not source brightness.
- Production Algorithm32 must not promote any physics decision, algorithm,
  numeric value, default, spectral shape, or algorithm-test expectation unless
  it is backed by an external reference, source-backed fixture, or explicitly
  accepted reference log entry. POC behavior is implementation evidence only;
  unsourced POC tuning values are rejected as production physics facts.
  Production code now uses AMA-style numbered references in
  `shared/algorithm32/production/references.md`, with bracket citation tokens
  in code comments, JSDoc comments, and JSON fixture text fields preceded by a
  short description of the cited data, formula, algorithm decision, or
  variation. Use ASCII tokens such as `[1]`, `[2]`, `[1][2]`, and `[10][11]`,
  not Unicode superscripts, Markdown footnotes, or HTML citation markup.
  Citations are required for
  the algorithm as a whole, meaningful variations, test fixtures, and
  non-fixture algorithm tests, but not for API compliance, validation plumbing,
  guardrails, architectural choices, module boundaries, placement/JSDoc
  conventions, or incidental platform/data-structure limitations. If a test
  intentionally enforces operational extents caused by a language or platform
  limit, such as JavaScript number precision or floating-point resolution, cite
  the relevant language/runtime specification. When a citation needs a precise
  locator beyond the numbered AMA
  entry, use the shared `Algorithm32ProductionReferencePointer` shape to name
  the reference number plus section, equation, figure, table, row, page, local
  artifact path, or other locator.
- Initial production scaffold now exists under
  `shared/algorithm32/production/`: `Algorithm32.js` as the documented primary
  facade skeleton, a focused Jasmine lane,
  `types.d.ts` ambient type home, `types/LightSourceModel.d.ts`,
  `types/AtmosphereModel.d.ts`, `types/GeometryModel.d.ts`,
  `types/Color.d.ts`, `types/types.d.ts`, `implementation/Reference.js`,
  `implementation/ShaderBuilder.js`, `implementation/types.d.ts`,
  `models/SharedModel.js`, `models/SpectralModel.js`, `models/types.d.ts`,
  `references.md`, scaffold guardrail specs, utility specs,
  model specs, and the first production analytic fixture ledger
  `fixtures/analytic-invariants.json`.
  `implementation/` is the home for implementation classes and starts with the
  CPU/reference algorithm execution collaborator `Reference` plus the runtime
  shader artifact builder `ShaderBuilder`; implementation-only complex packet
  shapes live in its local `types.d.ts`. The private helper implementation
  sequence for `Reference` is tracked in
  `shared/algorithm32/production/implementation/reference_plan.md`, proceeding
  from least-dependent helper leaves toward `evaluate(...)`; top-level
  `evaluate(...)` unit tests should wait until its composed dependencies have
  real behavior. `Reference._createTransportState(...)` is now implemented as
  bookkeeping only, initializing spectral radiance to zero and spectral
  transmittance to one for the active channel count, with a focused helper
  spec. `Reference._createEvaluationResult(...)` is implemented as
  bookkeeping only, snapshotting final transport-state radiance into the legacy
  `pathRadiance` field and final transmittance as the public spectral
  evaluation result. The reconciliation design now names that radiance
  component `PathRadiance.inScattered`.
  Production physical and algorithm expectations must be fixture-backed JSON
  ledgers with stable row ids, production citations, assumptions, inputs,
  expected data, tolerances, and independence notes. Fixture citations use the
  same AMA-style numbered entries in
  `shared/algorithm32/production/references.md` and bracket citation tokens
  used by production code comments. Fixture rows may carry
  compact shared reference pointer objects for source locators such as
  sections, equations, figures, tables, rows, pages, or local artifact paths.
  Fixture validation now requires bracket citation numbers to match each row's
  compact reference pointer numbers and rejects superscript citations.
  The first production ledger promotes externally backed analytic invariant
  rows from the rejected reference fixture file and intentionally omits rows
  whose only citations were local app/stage specs.
  Prefer actual source data, authoritative tables, published examples, or
  external-tool artifacts over reference calculations when possible. Physics
  and algorithm tests should cover sourced extents that cap or bound the
  calculation domain, not only central happy paths. Those extents may be
  physics-based, such as optical wavelength ranges, valid coefficient domains,
  vacuum/no-medium limits, zero-length or zero-weight paths, or monotonic
  transport limits. They may also be operational, such as JavaScript number
  precision, representable finite values, or floating-point resolution.
  Physics extents must be backed by references, empirical sources, published
  algorithm papers, source-backed fixture rows, or accepted reference-log
  entries; operational extents may cite the relevant language/runtime
  specification. Practical caps are acceptable when the cap and its reason come
  from the cited source, such as a Bruneton-style paper or empirical dataset,
  instead of from an invented local rationale. Do not choose extent values as
  arbitrary convenient numbers. Add a
  fixture validation spec before consuming a fixture family.
  Inline spec literals are reserved for bookkeeping, API shape, validation
  plumbing, and other non-physics behavior.
  `Reference.evaluate(...)` now carries
  the cited top-level volume-transport orchestration using standard
  transmittance and in-scattering language, with private helper stubs for the
  unimplemented physics steps and PBRT reference citations in
  `shared/algorithm32/production/references.md`. `models/` is the home for shared
  configuration/facts model classes and now starts with `SharedModel` as the
  aggregate model plus implemented `SpectralModel` as the spectral component
  model. `SharedModel` accepts caller-provided light source, atmosphere, and
  geometry implementations plus the accepted spectral basis, then constructs the
  facade-owned `SpectralModel`; `SpectralModel` owns copied spectral basis data, channel count,
  fingerprint, version, basis replacement, descriptor snapshots, wavelength
  lookup, and vector/basis alignment queries. Model-only complex packet shapes
  live in `models/types.d.ts`. `types/Color.d.ts` defines the
  caller-provided spectral-to-display color conversion interface; it is
  adjacent to Algorithm32 core output and not part of the facade-owned shared
  model. Primary single-interface ambient type files use PascalCase
  names matching the interface name, omit the redundant `Algorithm32` package
  prefix, and keep supporting request/sample/descriptor shapes in
  `types/types.d.ts`. Consumer-provided model interfaces receive plain data
  contracts such as `SpectralBasis`, not internal Algorithm32 model objects.
  `SpectralBasis` owns only the ordered unit-bearing `wavelengths` list; `channelCount`
  is derived by `SpectralModel` and descriptor snapshots so the wavelength list
  remains the single source of truth for spectral channel shape.
  Function and method JSDoc documents parameters and returns; parameter tags
  use a hyphen after the name, and complex return details belong in the
  description instead of the `@returns` text. Private class methods and
  properties use a leading underscore. Public readable properties expose
  getters. Setters are used only for direct assignment with no processing;
  processed changes use explicit methods instead. The scaffold guardrails now
  also reject the inherited flat-app local source tint identifiers and the
  unsourced `{ r: 1, g: 0.98, b: 0.95 }` tint value from production
  source/type/reference files, so the shader-lab tint contamination cannot
  quietly enter production Algorithm32. Generic production code now uses
  light-source terminology; solar-specific language is reserved for concrete
  light-source implementations and is guarded out of the core facade, shared
  model, algorithm/reference execution, shader builder, generic types, and
  generic utilities.
  `Reference._computeSegmentTransmittance(...)` now computes per-channel
  Beer-Lambert attenuation from sampled extinction and path weight, and
  `Reference._integratePathSample(...)` now returns an immutable next transport
  state by adding direct plus incident in-scattering and attenuating
  transmittance. Fixture-backed specs cover vacuum transmittance,
  multi-wavelength Beer-Lambert transmittance, and split-path transmittance
  multiplication. Fixture-backed specs now cover
  `Reference._computeDirectInScattering(...)` and
  `Reference._computeIncidentInScattering(...)`; the incident row records that
  `IncidentRadianceSample` is already sampled/collapsed before the reference
  helper consumes it. Reconciliation now assigns that sampling boundary to
  incident radiance cache/support rather than to light source alone.
  Current verification command is
  `npm run test:algorithm32:production`; latest focused run covers 38 specs
  with 0 failures.
  Class-specific specs now live in local `_tests` folders beside the class and
  use `ClassName.spec.js` filenames; Jasmine discovers production specs with
  `**/_tests/**/*.spec.?(m)js`.
- Latest local-second-order POC mining should be treated as the freshest
  operational evidence. It leaves the following current handoff facts:
  endpoint/trapezoid transport is the accepted shader-lineage evidence, while
  midpoint fixtures are cleanroom/stage evidence only; the POC emitted
  source-path descriptors from light-source samples, but reconciliation should
  promote the cleaner boundary where geometry resolves source-relative
  coordinates, boundary context, clipping, and altitude while light-source
  implementations consume those coordinates to supply lighting facts,
  including distance-use treatment and source path limits. Geometry then
  resolves the clipped source path for transmittance. Atmosphere owns
  coefficients, and transport execution applies the integration rule;
  `IncidentRadianceCache` is a coordinated generated incident-radiance field:
  the light source creates the concrete source-shaped cache; the cache owns its
  logical coordinate generator, generated values, descriptor, binding contract,
  and runtime sampling operation; and the generic setup/build coordinator
  passes each cache-owned coordinate back to the cache with geometry,
  atmosphere, light source, and the general calculator.
  Setup must bind the built cache/support object to the active
  light/geometry/atmosphere/spectral/execution context before evaluation
  receives operation-ready incident radiance support. Optional generated
  artifacts are persistence, diagnostic, or shader-packing outputs rather than
  required runtime objects. Shader setup consumes the same logical cache
  through cache-owned texture creation requests and cache-owned access
  assemblies; the cache calls `TextureBuilder`, `ShaderBuilder` composes the
  contributed source, and `ShaderBinder` applies the sampler binding. The
  cache is not a loose runtime choice and is not owned by the generic
  `Reference` executor or shared model. The mined constant
  inventory and known unresolved constant issues are recorded in
  `apps/flat/algorithm32/production-design.md`.
- `apps/flat/algorithm32/production-design.md` now separates the
  validation/error handling class from the shared configuration/facts model. The
  validation/error class owns config acceptance, canonical snapshots,
  fingerprints, compatibility checks, structured Algorithm32 errors,
  descriptor/cache validation, runtime capability pass/fail policy,
  validation-scene descriptors, and deterministic diagnostic summaries. The
  current core responsibility split is: algorithm configuration facts,
  validation/error handling, and algorithm execution for one specific input.
  The shared model is about canonical configuration facts and descriptors
  beneath the algorithm. The shared model is a canonical configuration
  aggregate whose component model properties are limited to light source,
  atmosphere medium, geometry, and spectral. Light source, atmosphere, and
  geometry are canonical views over consumer-provided `LightSourceModel`,
  `AtmosphereComposition`, and `Geometry`; spectral is the canonical spectral
  basis/shape derived from configuration. The one-evaluation sequence diagram
  talks directly to the consumer-provided light source, atmosphere, and
  geometry component models instead
  of showing the aggregate as a separate runtime actor.
  Interface boundary rule: consumer-provided model interfaces must not receive
  peer model implementations as request data. Hot-path calls pass only direct
  data needed to answer the request, such as positions, directions, spectral
  basis, or previously sampled plain result packets. Build/setup compatibility
  may use immutable descriptors, fingerprints, versions, and narrow plain data
  packets from peer models, but not peer model objects. One model does not call
  another model directly; Reference, ShaderBuilder, facade, or a dedicated
  coordinator asks one model for facts and passes plain results onward. Broad
  `context` request objects are a design smell and should be split into
  explicit owned facts, descriptors, or coordinator-managed setup state.
  The spectral component model is likely `model.spectral`; it owns the active
  unit-bearing `wavelengths` channel set, spectral basis shape, alignment checks,
  descriptor snapshots, basis replacement, wavelength lookup, versioning, and
  fingerprinting. It does not produce RGB/XYZ/display colors, shader/cache
  packing descriptors, or per-evaluation radiance/transmittance work vectors.
  Algorithm execution receives `EvaluationRequest` as a one-call request
  packet, not a durable model. The transport path is a resolved per-run
  path/integration artifact, not a model, because it has no durable identity
  or lifecycle beyond the execution that produced it.
  The POC hit-vs-sky distance distinction is now documented as geometry-owned:
  `EvaluationRequest` carries ray facts plus optional
  `suppliedDistanceMeters`, and `GeometryModel.resolveRayDistance(...)`
  absorbs the branch between the POC
  `traceSegmentForThreeHit(...)`/`hitDistanceMeters` path and the
  `traceSkyForThreeRay(...)`/`distanceToSkyBoundary(...)` path. Algorithm
  execution integrates the resolved distance rather than branching on renderer
  path semantics. If `suppliedDistanceMeters` is omitted, geometry decides how
  to handle the unbounded case from its configured boundaries.
  `ResolvedRayDistance` is intentionally kept to execution data only: the
  resolved finite `distanceMeters`. Clipping reasons, entry/exit facts,
  ground-hit or sky-exit status, surface-hit details, raw intersections, and
  boundary metadata are diagnostics and should be addressed in a separate
  holistic diagnostics design rather than being carried by the hot-path result.
  `production-design.md` now includes a compact `Reference.evaluate`
  pseudocode definition immediately before the one-evaluation Mermaid sequence:
  get model facts, resolve ray distance, prepare spectral results, query
  setup-bound incident-radiance support, walk samples, gather model facts,
  accumulate direct and incident/higher-order scattering, and assemble
  spectral output.
  The same section now records POC-derived unit/coefficient facts: spatial
  transport is in meters, local Sun size/reference-distance fields use
  explicitly named kilometers, spectral channel identity uses nanometers,
  coefficient formulas convert wavelengths to micrometers, atmosphere sampling
  returns scalar density facts, and finite local source scaling uses
  `referenceSpectralIncidentScale`, `distanceFalloffScale`, `incidentScale`,
  and `spectralIncidentScaleByWavelength`. The POC RGB-style local
  `sourceColor` default and rough channel grouping are not source-backed and
  must not be promoted as production source physics. The runner trail shows
  the tint already existed as flat-app configuration
  `DEFAULT_FLAT_SIMULATION_SUN.atmosphere.color = { r: 1, g: 0.98, b: 0.95 }`
  before the Algorithm32 local-source/shader-lab work; the retired
  reality-aligned daytime-atmosphere plan records the flat-app intent as a
  daylight-white atmosphere Sun distinct from the orange visible false Sun and
  records `58` as the selected linked-radiance sweep value, but it does not
  externally source the exact tint values. The later Algorithm32 local-source
  path pulled that app-facing color into `atmosflat32`, adapted it into the
  local source, and mapped it to spectral channels with rough wavelength
  thresholds. The `algorithm32_shader_lab` branch carried that behavior
  forward through historical `atmosflat32/018` parity evidence and
  shader-packet propagation; in the reconciliation lane those sky domes are
  guide material rather than canonical acceptance targets. The later
  local-sun-second-order lane reverted the tint in
  accepted artifact `095-local-source-neutral-white-stack` by using neutral
  white source scale. Treat the old tint/grouping as stale POC residue and
  guard it out of production. Any spectral variation in source scale requires
  a backed spectral model.
  A new local-lane diagnostic runner,
  `scripts/flat/local-second-order/local-source-neutral-spectrum-comparison.js`,
  now reproduces the accepted Southern France local-source integrated-shader
  vertical stack and rerenders it with
  `payload.sourceColorOverride = { r: 1, g: 1, b: 1 }` to measure the actual
  output effect of removing the inherited app RGB source tint. This is the
  current local-lane reversal evidence, not a new physical spectrum contract.
  It requires the user-owned watcher
  `node scripts/flat/local-second-order/harness.js --watch` and writes a
  numbered comparison artifact with both browser-run links, side-by-side
  output, diff image, criteria, report, and run log.
  The same design section now records required object-shape identifiers whose
  final names are local API language rather than obvious standardized domain
  terms: ray distance request labels, geometry distance result fields, source sample
  scale fields, atmosphere medium scalar field names, phase sample fields,
  IncidentRadianceCache indexing/packing fields, spectral array shape fields,
  and descriptor/provenance/diagnostic identifiers.
  Incoming radiance is requested through setup-bound incident radiance support;
  setup must first bind any generated `IncidentRadianceCache` to the active
  context descriptors. The cache is named for spectral radiance arriving at a
  sample point from incoming directions, and callers do not select or override
  arbitrary cache artifacts during evaluation. IncidentRadianceCache may carry
  L2/local incident radiance data, fixture tables, calculator evaluation
  strategies, sampled direction state, weights, spectral alignment,
  provenance, or sample caches.
  Runtime shader
  builder collaborators such as the shader source composer,
  cache texture helper, shader binder, runtime attachment model, and runtime
  capability model also live outside the shared aggregate.
  IncidentRadianceCache owns generated cache values, cache texture shape, and
  shader access contribution; the texture helper is mechanical and creates the
  requested GPU texture from cache-supplied dimensions, format, sampler, and
  data. These are not peer models: they consume shared facts and cache/resource
  inputs to produce shader-facing artifacts. Shader binding
  is handled by an active shader binder, not by a peer model; the binder
  updates/provides runtime information available to the running shader by
  assigning current uniforms, samplers, textures, render targets,
  display-conversion resources, debug state, and frame/config values to the
  shader's binding slots. Its output is live applied runtime state plus
  binding diagnostics or update status, while its internal binding map records
  names, slots, resource ids, descriptor versions, update categories, and
  compatibility labels. Runtime attachment is a model when it owns the related
  Three/composer facts: composer, scene, camera, renderer context, pass
  insertion, resize state, render targets, and disposal scope, plus mutation
  methods for scene/camera replacement, resize, target refresh, and disposal.
  Runtime capability is also a model: it owns probed renderer/device
  capability facts and the selected legal feature path.
  Display conversion is supplied as a caller-provided shader descriptor
  through shader setup or the shader handle by an adjacent display-conversion
  consumer; it is not part of `Algorithm32Config` or the shared model.
  Algorithm execution consumes those abstractions through explicit
  samples/descriptors and owns only computed spectral results plus transient
  calculation state for the run.
  Facade reconfiguration updates the shared model by replacement or versioned
  canonical snapshots so the CPU/reference algorithm execution class and
  runtime shader builder pick up compatible changes at operation
  boundaries and can fail/restart/rebuild on incompatible model versions.
  Workflow/facade code, texture/cache build workflows, runtime shader builder,
  Three/runtime adapter behavior, display conversion, validation/error
  handling, and generally useful pure math
  are outside the shared model; pure math remains separated into generic
  utility objects under `shared/algorithm32/production/utils/`: `ScalarMath`,
  `AngleMath`, `DistanceMath`, `WavelengthMath`, `VectorMath`, `ArrayMath`, and `SampleMath`, with
  `MathUtils.js` re-exporting those objects by name for grouped imports. Unit
  utilities use `in<Unit>` constructors and `to<Unit>` conversions for
  unit-bearing packets; they may also expose packet-in/packet-out operators
  such as `add`, `subtract`, and `scale` for one-line work, while expensive
  loops should canonicalize once to plain scalars.
  Concrete GPU packing layouts, packed payload construction, `Data3DTexture`
  creation, and any 2D-atlas fallback belong to the runtime shader builder,
  not the CPU reference implementation and not the shared model. It explicitly
  does not own validation/error policy, raw
  Three resources, facade lifecycle, local Sun calibration, app state, display
  conversion, generic pure math helpers, or future specific public Sun
  implementation classes. Display conversion is now an adjacent consumer class
  outside the Algorithm32 facade border: Algorithm32 core output is spectral
  or spectral-group radiance and transmittance, while a separate
  `Algorithm32DisplayConversion`-style class consumes that output for RGB,
  exposure, tone mapping, debug-color mapping, and optional display-only
  celestial/star extensions.

## Evidence Boundary

Cleanroom, shader-lab, local-second-order, and numbered artifact docs are
background evidence, not the active topic entry path. Load them only when the
user asks about experiment history, accepted artifact details, parity evidence,
cache behavior, or POC implementation source.

The local Sun second-order experimental lane is closed as accepted POC
evidence. Its implementation bundle is preserved under:

```text
shared/algorithm32/POC/
```

Do not document live runner state. Inspect heartbeat/process state at execution
time only when a task explicitly requires it.

When a cleanroom, shader-lab, or local-second-order decision becomes production
policy, promote the durable contract into the Algorithm32 production docs
instead of making future agents mine experiment logs.

Current-state documentation is the default. Do not carry historical narrative
forward in Algorithm32 production docs except when writing an experiment
evidence source, an intentional status/task tracker, or a clearly marked
archive.
