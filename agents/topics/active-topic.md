# Active Topic

Current active topic: `flat`

Current focus: Algorithm32 shader iteration ladder, with the immediate design
discussion diverted from performance to configurable flat-earth local Sun
support in the shader. The accepted spherical browser shader endpoint remains
`054`. `browser-shader-benchmark` now exists in the shader lab, but performance
work is parked for now: `067-browser-shader-benchmark` proved structured
diagnostics, timer queries were unavailable, and
`069-browser-shader-benchmark` showed aggressive batching is unsafe for an
interactive session. If performance work resumes later, use the conservative
benchmark command from a user-owned/dedicated browser harness. Do not launch or
kill generic Chrome processes from the agent tool path without explicit user
permission and exact process ownership.

## Bootstrap Override

For the current task, this compact section is the authoritative bootstrap. The
older detailed artifact history later in this file is background only; do not
reload it unless the user explicitly asks for closed artifact detail.

- Immediate workbench:
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md`.
- Supporting shader-lab plan:
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md`.
- Production flat shader differences:
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/production-flat-shader-differences.md`.
  This is now the working note for the configurable flat-earth local Sun
  contract. The current design direction is a user-configured local Sun moving
  around a fixed projected latitude on a solar-day period, with altitude,
  radius/size, and brightness/luminosity treated as explicit flat-model
  hypothesis parameters. Keep sidereal rotation reserved for the star dome or
  an explicit advanced option, not the default time-of-day Sun motion.
- Shader-lab implementation folder:
  `scripts/flat/algorithm32-shader-lab/`.
- Shader-lab artifact root:
  `tmp/atmosphere/algorithm32_shader_lab/`.
- Shader benchmark smoke:
  `tmp/atmosphere/algorithm32_shader_lab/067-browser-shader-benchmark/`.
  Treat `069-browser-shader-benchmark` as a cautionary aggressive-batching
  artifact, not a performance baseline. The runnable conservative command is
  `tmp/atmosphere/algorithm32_shader_lab/browser-shader-benchmark-command.json`.
  It defaults to small batches, yields between samples, and keeps
  `gl.finish()` fallback timing disabled unless explicitly requested. Do not
  clean up browser experiments by killing generic `chrome` processes.
- Objective CPU/Three oracle artifact:
  `tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference/`.
- Subjective mountain visual references:
  `tmp/atmosphere/algorithm32_shader_lab/012-mountain-ridges-framed-large/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/013-mountain-ridges-sunset-behind-camera/`.
  These have `0` formal criteria by design and are not shader pass/fail gates.
  A fresh CPU-only forward rerun exists at
  `tmp/atmosphere/algorithm32_shader_lab/029-mountain-ridges-framed-large/`,
  and the current CPU Algorithm32 reference pair is
  `tmp/atmosphere/algorithm32_shader_lab/033-mountain-ridges-algorithm32-front-high-sun/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/034-mountain-ridges-algorithm32-sunset-behind-camera/`.
  Older first-order browser shader side-by-side pairings are accepted in
  `tmp/atmosphere/algorithm32_shader_lab/035-browser-mountain-shader-front-high-sun/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/036-browser-mountain-shader-sunset-behind-camera/`.
  Current second-order browser shader progress pairings are accepted in
  `tmp/atmosphere/algorithm32_shader_lab/049-browser-mountain-second-order-front-high-sun/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/050-browser-mountain-second-order-sunset-behind-camera/`;
  use each artifact's `side-by-side.png` for visual comparison. Shader image
  artifacts should include an Algorithm32 reference image beside the shader
  image whenever practical.
- Closed environment-object color experiment handoff:
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-object-color-closeout.md`.
  Do not continue artifacts under `tmp/atmosphere/cleanroom_environment/`
  unless the user explicitly asks.

Current next iteration: move from analytic simple-scene shader parity to real
Three scene integration, using shared depth/material or object-hit inputs
instead of hard-coded analytic intersections. The analytic full-image
second-order Algorithm32 shader path is accepted for the simple browser card
scene in
`tmp/atmosphere/algorithm32_shader_lab/048-browser-second-order-image/`. It
uses the same 15-channel spectral profile and the same altitude/direction
second-order incident-sky cache proven by selected-pixel diagnostics. Its
selected display pixels match CPU Algorithm32 exactly at encoded RGB
(`maxSelectedRgbDelta = 0`), and its side-by-side pairing against
`037-algorithm32-simple-card-reference` records display-space
`maxAbsRgbDelta = 1`, `meanAbsRgbDelta = 0.0017824074074074075`,
`p95PixelMaxAbsRgbDelta = 0`, and `p99PixelMaxAbsRgbDelta = 0`. The first
scene-input objective rung is accepted in
`tmp/atmosphere/algorithm32_shader_lab/051-browser-scene-input-second-order-image/`:
the shader consumes a per-pixel Three Raycaster distance/spectrum texture,
selected pixels match CPU Algorithm32 with `maxSelectedRgbDelta = 0`, and the
side-by-side pairing against `037` matches `048`'s image diff. The first GPU
scene-input rung is accepted in
`tmp/atmosphere/algorithm32_shader_lab/053-browser-gpu-scene-input-second-order-image/`:
a GPU render target writes per-fragment distance/spectrum/hit flag, then the
experimental raw WebGL atmosphere pass consumes that texture after readback and
upload. It has selected-pixel `maxSelectedRgbDelta = 1`; image diff against
`037` is `maxAbsRgbDelta = 182`, `meanAbsRgbDelta = 0.8947337962962963`,
`p95PixelMaxAbsRgbDelta = 4`, and `p99PixelMaxAbsRgbDelta = 21`, classified as
edge/rasterization placement rather than radiance drift. The direct GPU texture
rung is accepted in
`tmp/atmosphere/algorithm32_shader_lab/054-browser-gpu-direct-scene-input-second-order-image/`:
it binds the Three GPU render-target texture directly into the experimental
raw WebGL atmosphere pass with no scene-input readback/upload used for shader
input, selected-pixel `maxSelectedRgbDelta = 1`, and the same image diff as
`053`. This is the current best shader-lab endpoint for fixed spherical,
distant-Sun Algorithm32 over a browser-rendered Three scene input. A
performance-measurement scaffold now exists, but no reliable isolated GPU
timing baseline exists yet because the local Chromium/WebGL backend did not
expose `EXT_disjoint_timer_query_webgl2`; use `067` only as a smoke proof and
`069` only as a cautionary aggressive-batching artifact. The earlier
first-order objective gap remains documented in `038`, and first-order
isolation remains documented in `040`. Subjective second-order mountain
progress images are accepted in `049` and `050`; they are visual review
artifacts only, not objective pass/fail gates. The flat-earth visibility
offshoot is accepted in
`tmp/atmosphere/algorithm32_shader_lab/056-browser-flat-earth-visibility-search/`:
with a flat slab, standard Algorithm32 Rayleigh/Mie constants, first-order
scattering, a `10 km x 10 km` matte black vertical card, a `2 m` camera height,
`24 deg` vertical FOV, and display criterion `maxAbsRgbDelta <= 1`, the closest
non-appearing distance is `1,926.774 km`. The card still covered `2` search
pixels at that threshold; zero-pixel disappearance occurred later in the sweep.
Visibility-loss milestones are accepted in
`tmp/atmosphere/algorithm32_shader_lab/062-browser-flat-earth-visibility-search/`:
using the same target and defining `100%` as cannot see, the distances are
`50% lost = 21.480 km`, `75% lost = 601.563 km`, `80% lost = 776.563 km`,
`90% lost = 1,228.125 km`, `95% lost = 1,543.750 km`, and `100% lost/cannot
see = 1,926.774 km`. `055` is rejected because the first bracket search
skipped the configured max distance, `057` is rejected because a `100 km`-wide
stress card was still visible at the `3,000 km` cap, `058` is the wide-target
diff/mask diagnostic, `059` is an incomplete over-expensive watch run, `060` is
superseded because it drew the milestone table but did not serialize it into
diagnostics, and `061` is an incomplete run from a screenshot-label helper
error. High-resolution visual inspection of the milestone distances is
accepted in
`tmp/atmosphere/algorithm32_shader_lab/065-browser-flat-earth-visibility-search/`,
using the native `canvas-image.png`; it supersedes `064`, where the gallery
content was accidentally laid out using stale canvas dimensions. Iteration 1 is
accepted by
`tmp/atmosphere/algorithm32_shader_lab/018-browser-three-baseline/`. Watch
reload is accepted by
`tmp/atmosphere/algorithm32_shader_lab/020-browser-three-baseline-watch-reload-check/`.
Iteration 2 is accepted by browser artifact
`tmp/atmosphere/algorithm32_shader_lab/021-browser-ray-depth-diagnostics/`
and comparison artifact
`tmp/atmosphere/algorithm32_shader_lab/022-browser-ray-depth-diagnostics-comparison/`.
The comparison passed `7/7` criteria with zero ray-origin delta, zero ray-
direction angle, zero finite-hit-distance delta, and zero classification
mismatches. Iteration 3 is accepted by browser artifact
`tmp/atmosphere/algorithm32_shader_lab/025-browser-atmosphere-components/`
and comparison artifact
`tmp/atmosphere/algorithm32_shader_lab/026-browser-atmosphere-components-shader-comparison/`.
The comparison passed `10/10` criteria; browser JS and Node atmosphere
components matched with max transmittance delta `1.1102230246251565e-16`, and
the WebGL2 diagnostic shader readback matched the JS component packet with max
shader transmittance delta `0.000007160129086525302`. Iteration 4.1 is
accepted by browser artifact
`tmp/atmosphere/algorithm32_shader_lab/027-browser-direct-radiance/` and
comparison artifact
`tmp/atmosphere/algorithm32_shader_lab/028-browser-direct-radiance-comparison/`.
It passed `10/10` criteria for one-wavelength first-order 532 nm direct
radiance: JS/Node path and final radiance deltas were `0`, shader max path and
final radiance deltas were `2.0880918986942998e-7`, and the artifact
explicitly records that full spectral conversion and Algorithm32 second-order
approximation are still deferred. Iteration 4.2 is accepted by browser
artifact
`tmp/atmosphere/algorithm32_shader_lab/030-browser-direct-radiance-spectral/`
and comparison artifact
`tmp/atmosphere/algorithm32_shader_lab/031-browser-direct-radiance-spectral-comparison/`.
It passed `9/9` criteria for 5 selected pixels x 15 Algorithm32 wavelengths:
JS/Node max path radiance delta `3.469446951953614e-18`, max final radiance
delta `1.3877787807814457e-17`, shader max path radiance delta
`6.091299753485657e-7`, and shader max final radiance delta
`9.326382049076876e-7`. Iteration 5.1 is accepted by
`tmp/atmosphere/algorithm32_shader_lab/032-browser-first-order-image/`, proving
the simple browser scene can be rendered as a full first-order 15-channel
spectral shader image. Subjective Iteration 7 is accepted by `033` through
`036`, producing CPU Algorithm32 reference images and browser shader
side-by-side images for the forward high-Sun and low-Sun-behind-camera
mountain views.

## Starting Status

- Documentation is ready under
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/`.
- Fresh agents should treat
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md`
  as the current iteration workbench.
- Fresh agents should treat
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/reference-to-shader-goal.md`
  as the framing document for what "reference" means now: reusable Algorithm32
  module plus cache-building and shader-validation surfaces, not a separate
  renderer or revival of the rejected stage pipeline.
- Algorithm32 is the shorthand for the final cleanroom algorithm from
  experiment 032. It remains the direct-trace oracle for shader/cache
  validation and may also supply promoted kernels for app texture rebuilds.
- The environment-object color closeout is:
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-object-color-closeout.md`.
- The closed experiment implementation folder contains the self-contained
  runner:
  `scripts/flat/atmosphere-environment/`.
- The output root is:
  `tmp/atmosphere/cleanroom_environment/`.
- The shader-lab output root is:
  `tmp/atmosphere/algorithm32_shader_lab/`.
- Current shader-lab browser-control status:
  Agent-launched browser starts remain unreliable in this session, but the
  user-owned manual harness launch works. Rejected artifacts `014` and `015`
  record the failed Karma fallback attempts. Accepted artifact `018` records a
  successful manual Puppeteer `--once` browser baseline run with no page errors
  and a `629 ms` harness duration. It supersedes `017` because the projected
  card-center samples now hit all three intended card objects. Accepted
  artifact `020` records a successful user-owned `--watch` reload: the command
  file change was observed, the page load count advanced to `3`, and a fresh
  accepted artifact was written. Fresh agents should use the user-owned watch
  process for browser experiments rather than launching Chrome from the agent
  tool path.
- Current shader-lab ray/depth status:
  Iteration 2 is accepted. The browser watch run
  `021-browser-ray-depth-diagnostics` returned selected camera rays and
  equivalent hit distances. The Node comparison run
  `022-browser-ray-depth-diagnostics-comparison` independently reconstructed
  the same Three scene and matched all selected rays, hit objects, and finite
  distances exactly within the recorded tolerances.
- Current shader-lab atmosphere-component status:
  Iteration 3 is accepted. The browser watch run
  `025-browser-atmosphere-components` returned selected-pixel path length,
  altitude range, optical lengths, optical depth, transmittance, and WebGL2
  diagnostic shader readback. The comparison run
  `026-browser-atmosphere-components-shader-comparison` passed `10` criteria,
  with `0` failures and `0` unresolved.
- Current shader-lab direct-radiance and image status:
  Iteration 4.1 is accepted. The browser watch run
  `027-browser-direct-radiance` returned first-order 532 nm Rayleigh, Mie,
  path, object-transmitted, and final radiance diagnostics, plus WebGL2 shader
  readback. The comparison run `028-browser-direct-radiance-comparison` passed
  `10` criteria, with `0` failures and `0` unresolved. Iteration 4.2 is also
  accepted. The browser watch run `030-browser-direct-radiance-spectral`
  returned 15-channel first-order spectral radiance diagnostics for selected
  sky/object/ground pixels, plus WebGL2 shader readback. The comparison run
  `031-browser-direct-radiance-spectral-comparison` passed `9` criteria, with
  `0` failures and `0` unresolved. Iteration 5.1 is accepted by
  `032-browser-first-order-image`: the simple browser scene now renders
  through the full-image first-order 15-channel spectral shader path, with
  selected display pixels matching the browser JS spectral preview. Objective
  image parity is now accepted through the full Algorithm32 second-order image
  path. `038` records the earlier first-order shader gap against full CPU
  Algorithm32 (`maxAbsRgbDelta = 38`, `meanAbsRgbDelta =
  11.354444444444445`), and `040` proves first-order-only parity
  (`maxAbsRgbDelta = 1`, `meanAbsRgbDelta = 0.0015277777777777779`). The
  selected-pixel second-order shader diagnostics are accepted in `041` through
  `045`. The full-image second-order simple-scene artifact `048` pairs against
  CPU Algorithm32 reference `037` and records `maxAbsRgbDelta = 1`,
  `meanAbsRgbDelta = 0.0017824074074074075`, `p95PixelMaxAbsRgbDelta = 0`,
  and `p99PixelMaxAbsRgbDelta = 0`, with both sides including the current
  Algorithm32 second-order approximation. Current subjective mountain shader
  images are accepted in `049` and `050` with paired CPU Algorithm32 references
  from `033` and `034`; these remain visual progress snapshots only.
- Current subjective-scene clarification:
  The current subjective mountain artifacts `049` and `050` are visual review
  artifacts only, not physics approval gates. They compare the CPU Algorithm32
  mountain references against the current second-order browser shader path
  using analytic procedural mountain intersections. Do not tune or accept the
  shader from these subjective scenes unless the user explicitly asks for that
  visual work.
- Current shader-lab bootstrap result:
  `scripts/flat/algorithm32-shader-lab/node-three-reference.js` has been
  implemented and verified with `node --check` and a full run. The accepted
  artifact is
  `tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference/`
  with `11` passing criteria, `0` failing, and `0` unresolved. It proves
  Three camera rays and Raycaster hits can drive Algorithm32 sky/object
  transfer packets before the browser shader adapter exists.
- Latest shader-lab generated scene request:
  `tmp/atmosphere/algorithm32_shader_lab/005-sunset-floor/` is accepted with
  `7` passing criteria, `0` failing, and `0` unresolved. It was generated by
  `node scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene
  sunset-floor --width 320 --height 180 --label sunset-floor` and contains a
  grass-green floor, no card objects, and a low-Sun Algorithm32 sunset sky.
  `004-sunset-floor` is rejected because the first floor spectrum clipped to
  yellow.
- Latest less-zoom follow-up:
  `tmp/atmosphere/algorithm32_shader_lab/006-sunset-floor-less-zoom/` is
  accepted with `8` passing criteria, `0` failing, and `0` unresolved. It uses
  the same no-object grass-floor sunset scene with `--sunset-framing
  less-zoom`, a `92 deg` vertical FOV, and the low-Sun Algorithm32 sky.
- Latest subjective shader-lab scene:
  `tmp/atmosphere/algorithm32_shader_lab/029-mountain-ridges-framed-large/`
  is the latest CPU-only mountain-range preview. It was generated by `node
  scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene
  mountain-ridges --width 480 --height 270 --label
  mountain-ridges-framed-large`, uses procedural layered ridge silhouettes and
  a valley floor through the Three raycast plus Algorithm32 sky/object
  transfer path, and intentionally has `0` formal criteria because it is a
  subjective composition scene. It is not a shader-path render. The older
  `012-mountain-ridges-framed-large` remains the previous CPU-only reference;
  artifacts `007` through `011` are superseded mountain-layout iterations.
- Latest alternate subjective shader-lab mountain view:
  `tmp/atmosphere/algorithm32_shader_lab/013-mountain-ridges-sunset-behind-camera/`
  uses the same procedural ridge layout with `--mountain-view
  sunset-behind-camera`, the low-Sun `figure1-06h00-z87` case, and a camera
  orientation with the Sun behind the viewer. It intentionally has `0` formal
  criteria because it is subjective composition output.
- Generated artifacts:
  - `001-transfer-baseline`: rejected; the split-segment diagnostic compared
    different full-vs-split quadrature partitions.
  - `002-transfer-convergence`: rejected; confirmed the same diagnostic issue
    shrank under doubled sampling but still failed the gate.
  - `003-transfer-baseline`: accepted baseline after the diagnostic fix, but
    still required convergence-margin proof.
  - `004-transfer-convergence`: rejected; the original `20/10/17/24`
    numerical baseline did not meet the `5x` convergence-margin gate.
  - `005-transfer-refined-baseline`: accepted current refined baseline using
    `40/20/34/48` numerical controls.
  - `006-transfer-refined-convergence`: accepted final convergence proof using
    `80/40/68/96` controls against `005`, with `15` passing criteria, `0`
    failing, `0` unresolved, and minimum convergence margin
    `6.4074899093834174`.
  - `007-lambertian-surface-lighting`: partial crash artifact; report writing
    failed after criteria generation.
  - `008-lambertian-surface-lighting`, `009-local-sun-follow-up`, and
    `010-flat-long-sightline-follow-up`: accepted, but superseded by clean
    reruns after report prose was improved.
  - `011-lambertian-surface-lighting`: accepted final Lambertian proof with
    `8` passing criteria, `0` failing, `0` unresolved.
  - `012-local-sun-follow-up`: accepted final local finite-source proof with
    `8` passing criteria, `0` failing, `0` unresolved.
  - `013-flat-long-sightline-follow-up`: accepted final flat long-sightline
    proof with `9` passing criteria, `0` failing, `0` unresolved.
  - `014-scene-gallery` through `017-scene-gallery`: accepted but superseded
    scene-display iterations. `014` proved image generation but used a
    non-algorithmic illustrative sky; `015` and later moved the sky and
    ground-atmosphere context to cleanroom spectral atmosphere sampling; `017`
    still clustered the distance cards too tightly.
  - `018-scene-gallery`: accepted perspective scene-output proof with `6`
    passing criteria, `0` failing, `0` unresolved; superseded by `019` for the
    requested source-color selection.
  - `019-scene-gallery`: accepted source-colored scene-output proof with `7`
    passing criteria, `0` failing, `0` unresolved; superseded by the
    multicolor scene-display request.
  - `020-scene-gallery`: accepted multicolor scene-output proof with `7`
    passing criteria, `0` failing, `0` unresolved; superseded by `021` because
    the first multicolor layout read more like adjacent front cards than
    separated object sets.
  - `021-scene-gallery`: accepted multicolor scene-output proof with `7`
    passing criteria, `0` failing, `0` unresolved; superseded by the green
    spectrum correction because the previous broad green peak displayed
    yellow-green/yellow.
  - `022-transfer-refined-baseline`: accepted green-spectrum replacement
    baseline with `14` passing criteria, `0` failing, `1` unresolved
    convergence criterion. It changes only the algorithmic synthetic green
    spectrum, from the previous yellow-green broad peak to a 532 nm display-
    green stress peak.
  - `023-transfer-refined-convergence`: accepted green-corrected transfer
    convergence proof with `15` passing criteria, `0` failing, `0`
    unresolved; superseded by the foreground-olive green request.
  - `024-lambertian-surface-lighting`: accepted green-corrected Lambertian
    proof with `8` passing criteria, `0` failing, `0` unresolved.
  - `025-local-sun-follow-up`: accepted green-corrected local finite-source
    proof with `8` passing criteria, `0` failing, `0` unresolved.
  - `026-flat-long-sightline-follow-up`: accepted green-corrected flat
    long-sightline proof with `9` passing criteria, `0` failing, `0`
    unresolved.
  - `027-scene-gallery`: accepted green-corrected multicolor
    scene-output proof with `7` passing criteria, `0` failing, `0`
    unresolved; superseded by the foreground-olive green request.
  - `028-transfer-refined-baseline`: accepted foreground-olive green baseline
    with `14` passing criteria, `0` failing, `1` unresolved convergence
    criterion. It changes only the algorithmic synthetic green spectrum to a
    user-directed muted foreground color target, encoded as `79/96/32` before
    atmosphere in the display preview.
  - `029-transfer-refined-convergence`: accepted foreground-olive
    transfer convergence proof with `15` passing criteria, `0` failing, `0`
    unresolved; superseded by the lower-right forest-green request.
  - `030-lambertian-surface-lighting`: accepted foreground-olive Lambertian
    proof with `8` passing criteria, `0` failing, `0` unresolved.
  - `031-local-sun-follow-up`: accepted foreground-olive local finite-source
    proof with `8` passing criteria, `0` failing, `0` unresolved.
  - `032-flat-long-sightline-follow-up`: accepted foreground-olive flat
    long-sightline proof with `9` passing criteria, `0` failing, `0`
    unresolved.
  - `033-scene-gallery`: accepted foreground-olive multicolor
    scene-output proof with `7` passing criteria, `0` failing, `0`
    unresolved; superseded by the lower-right forest-green request.
  - `034-transfer-refined-baseline`: accepted lower-right forest-green
    baseline with `14` passing criteria, `0` failing, `1` unresolved
    convergence criterion. It changes only the algorithmic synthetic green
    spectrum to a user-directed dark forest color target from the lower-right
    foliage reference, encoded as `30/58/32` before atmosphere in the display
    preview.
  - `035-transfer-refined-convergence`: accepted final lower-right
    forest-green transfer convergence proof with `15` passing criteria, `0`
    failing, `0` unresolved.
  - `036-lambertian-surface-lighting`: accepted lower-right forest-green
    Lambertian proof with `8` passing criteria, `0` failing, `0` unresolved.
  - `037-local-sun-follow-up`: accepted lower-right forest-green local
    finite-source proof with `8` passing criteria, `0` failing, `0`
    unresolved.
  - `038-flat-long-sightline-follow-up`: accepted lower-right forest-green
    flat long-sightline proof with `9` passing criteria, `0` failing, `0`
    unresolved.
  - `039-scene-gallery`: accepted lower-right forest-green multicolor
    scene-output proof with `7` passing criteria, `0` failing, `0`
    unresolved; superseded by `040` for the 8 px scene-background sampling
    request.
  - `040-scene-gallery`: accepted final high-resolution scene-output proof
    with `7` passing criteria, `0` failing, `0` unresolved. It reads accepted
    artifacts `035`, `036`, `037`, and `038`; changes only the algorithmic
    scene preview sky/ground block sampling from `24 px` to `8 px`; samples
    `11040` sky blocks and `21600` ground-atmosphere blocks; renders red,
    blue, and dark forest-green recorded object-spectrum stacks in each
    scene/source view; and generates `scene-preview-transfer.png`,
    `scene-preview-lambertian.png`, `scene-preview-local-sun.png`,
    `scene-preview-flat-long-sightline.png`, and `scene-gallery.png`.
- The full environment-object experiment state goal has been reached,
  including generated scenes for every phase. Do not continue generating
  numbered experiment artifacts unless the user explicitly asks for a new
  diagnostic.
- The first artifact must use the locked baseline matrix: `2` Sun cases, `7`
  distances, and `6` synthetic object spectra, for `84` primary transfer
  cases before diagnostics.
- Artifact numbering is append-only under
  `tmp/atmosphere/cleanroom_environment/`; choose `max(existing NNN) + 1` and
  never overwrite an existing numbered folder.
- Every numbered artifact must include `state-goal.md`, `inputs.json`,
  `provenance.json`, `equations-and-constants.json`, `transfer-cases.json`,
  `criteria-results.json`, `report.md`, `contact-sheet.png`, `run.log`, and a
  script snapshot or script-snapshot folder.
- The implemented runner step ids are `transfer-baseline`,
  `transfer-convergence`, `transfer-refined-baseline`,
  `transfer-refined-convergence`, `lambertian-surface-lighting`,
  `local-sun-follow-up`, `flat-long-sightline-follow-up`, and
  `scene-gallery`.

- The successful refined baseline and convergence pass used all active
  constants and assumptions from cleanroom experiment 032, including no ozone,
  no ground coupling, no direct solar-disc camera radiance, Bruneton 2016
  aerosol constants, the 15-sample spectral grid, full-sphere Fibonacci
  second-order path radiance, and the distant directional Sun.
- The successful artifacts include the Bruneton Figure 1 sunrise/sunset
  low-Sun case `figure1-06h00-z87` and the highest-Sun case
  `figure1-13h15-z21`.
- The successful artifacts use algorithmic stress defaults for distances,
  target cards, and synthetic spectra as defined in the preflight spec.

## Bootstrap For This Task

Load only:

1. `agents/topics/active-topic.md`
2. `agents/topics/README.md`
3. `agents/topics/standards/architecture/overview.md` as file-placement
   context only
4. `agents/topics/apps/flat/README.md` only through its
   `Current Active Task` routing note
5. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/README.md`
6. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-object-color-closeout.md`
7. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/object-color-transport.md`
8. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/experiment-032-algorithm.md`
9. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/reference-to-shader-goal.md`
10. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md`
11. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md` only when browser harness or prior shader-lab detail is needed
12. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/production-flat-shader-differences.md` only when production flat-geometry shader support is in scope
13. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-module-design.md` only when reusable module interface detail is needed
14. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-experiment-preflight-spec.md` only when closed artifact-level detail is needed
15. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-experiment-run-shape.md` only when closed artifact-level detail is needed
16. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/objective-success-criteria.md` only when closed criterion detail is needed
17. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/object-transport-experiment-plan.md` only when historical experiment planning detail is needed

Then inspect:

- `scripts/flat/experimental/bruneton-start-fresh.js`
- `scripts/flat/algorithm32-shader-lab/README.md`
- `scripts/flat/algorithm32-shader-lab/`
- `scripts/flat/experimental/bruneton-start-fresh.js` only when Algorithm32
  equation/constant implementation detail is needed
- `scripts/flat/atmosphere-environment/` only if closed artifact
  implementation details are explicitly needed
- `tmp/atmosphere/cleanroom_environment/running-log.md` or the latest numbered
  folder only if the user asks for closed experiment artifact detail

Do not load `agents/topics/apps/flat/status.md`,
`agents/topics/apps/flat/plans/bruneton-start-fresh-prompt.md`,
`agents/topics/apps/flat/plans/bruneton-start-fresh-worklog.md`,
`atmosphere-design.md`, older Flat atmosphere plans, previous skydome logs,
local comparison galleries, archive/migration docs,
`scripts/flat/atmosphere_rejected/`, or `agents/topics.bak` unless the user
explicitly asks for source-audit, architecture-comparison, or historical
reference work.

Every equation, constant, approximation, and display decision must be justified
through external sources only: external papers, standards, datasets, or
third-party source code, including external-source downloads already present in
the workspace. Already-downloaded external files are allowed only as direct
external primary material; local summaries of those sources are not allowed as
substitutes. Older local project code, docs, prior rerun logs, and previous
local artifacts are not valid sources for equations, constants, algorithms,
expected colors, visual targets, or design decisions. Do not use hidden RGB
grades as the solution. For the environment-object proof, synthetic object
spectra, distances, tolerances, and scene controls may be algorithmic only when
they are labeled as such in the prompt and generated artifacts. Required
bootstrap docs are routing only; ignore previous project atmosphere
implementation details in them and do not follow their links into older local
atmosphere plans. Repository architecture or convention docs may guide file
placement and avoiding unrelated churn only; they must not guide physics,
rendering, constants, color conversion, sampling, or visual interpretation.
Do not delete any file that is not tracked by Git; verify tracking before any
deletion, and leave untracked files in place. Unit tests are not required for
this task.

Additional reload sources for this task:

- [Atmosphere Cleanroom Design](apps/flat/plans/atmosphere-cleanroom-design/README.md)
- [Environment Object Color Closeout](apps/flat/plans/atmosphere-cleanroom-design/environment-object-color-closeout.md)
- [Experiment 032 Algorithm](apps/flat/plans/atmosphere-cleanroom-design/experiment-032-algorithm.md)
- [Object Color Transport](apps/flat/plans/atmosphere-cleanroom-design/object-color-transport.md)
- [Reference To Shader Goal](apps/flat/plans/atmosphere-cleanroom-design/reference-to-shader-goal.md)
- [Algorithm32 Module Design](apps/flat/plans/atmosphere-cleanroom-design/algorithm32-module-design.md)
- [Algorithm32 Shader Iteration Plan](apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md)
- [Algorithm32 Shader Lab Plan](apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md)
- [Production Flat Shader Differences](apps/flat/plans/atmosphere-cleanroom-design/production-flat-shader-differences.md)
- [Environment Experiment Preflight Spec](apps/flat/plans/atmosphere-cleanroom-design/environment-experiment-preflight-spec.md) only for artifact detail
- [Environment Experiment Run Shape](apps/flat/plans/atmosphere-cleanroom-design/environment-experiment-run-shape.md) only for artifact detail
- [Objective Success Criteria](apps/flat/plans/atmosphere-cleanroom-design/objective-success-criteria.md) only for criterion detail
- [Object Transport Experiment Plan](apps/flat/plans/atmosphere-cleanroom-design/object-transport-experiment-plan.md) only for historical experiment planning detail

When switching topics, update this file with the new topic id from
[Routing](context/routing.md). On bootstrap, load the active topic README after
the lightweight shared context only far enough to see its `Current Active Task`
routing note, then load the pipeline handoff reload sources above. Do not
reopen the closed numbered experiment lane unless the user explicitly asks for
artifact diagnostics, architecture-comparison, or historical context.
