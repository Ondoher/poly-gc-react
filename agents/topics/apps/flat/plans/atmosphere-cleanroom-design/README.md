# Atmosphere Cleanroom Design

This folder is the documentation home for the new atmosphere reset design that
will supersede the rejected reference pipeline.

## Scope

- Incorporate the completed Bruneton start-fresh evidence lane into a new
  design rather than continuing numbered fresh-lane visual iterations by
  default.
- Treat step 032,
  `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/`,
  as the current Figure 1 visual handoff candidate.
- Use `scripts/flat/experimental/bruneton-start-fresh.js` as the cleanroom
  experimental implementation record.
- Use `scripts/flat/atmosphere_rejected/` only for architecture comparison and
  integration mapping while it is temporarily retained for reference.

## Current Active Lane

The current task is production promotion from the accepted Algorithm32
shader-lab POC. For a fresh or compacted agent, start with the canonical
summary, then load only the minimal source-contract sections when implementation
detail is needed:

1. [Algorithm32 Canonical Reference](algorithm32-canonical-reference.md)
   - Treat this as the current source of truth for Algorithm32 steps,
     abstractions, source ownership, accepted endpoints, open issues, and
     production followups.
2. [Algorithm32 Shader Iteration Plan](algorithm32-shader-iteration-plan.md)
   - Read the accepted Milestone 8 through Milestone 13 summary.
   - Read `Shared Soft-Shader Contract` and the accepted Milestone 14 through
     Milestone 29 soft-shader/shader runway.
   - Read the accepted Milestone 30 through Milestone 38 Three-native
     atmosphere-pass runway.
   - Read `Current Next Iteration`.
3. `scripts/flat/algorithm32-shader-lab/README.md`
   - Read the source-contract block beginning with
     `The accepted CPU source-contract runway is`.
   - Read command examples only when needed.

Then follow the shader iteration plan. Do not load the detailed shader-lab
plan, production flat shader, object-color, rejected atmosphere,
`atmosflat32` local-Sun, or historical artifact docs unless the prompt or user
explicitly asks for that context. This active lane builds POC shader-lab
artifacts, not production/shared app code, and does not require unit tests.

Current shader-lab endpoint is accepted by
`tmp/atmosphere/algorithm32_shader_lab/226-three-native-production-shape-review/`.
It records the accepted production target shape: live Three scene color plus a
Three `DepthTexture` into `Algorithm32AtmospherePass`. The objective live-pass
parity evidence is
`tmp/atmosphere/algorithm32_shader_lab/224-three-native-live-pass-soft-shader-matrix/`.
The packet-based shader endpoint
`193-soft-shader-capability-parity-matrix` remains accepted as the corrected
soft-shader/GPU parity endpoint, but it is not the current integration target.
The older `054-browser-gpu-direct-scene-input-second-order-image` remains
accepted only as the prior fixed spherical distant-Sun browser shader endpoint.

The CPU source-contract runway is accepted through Milestone 12:
`071-cpu-source-contract-distant-sun`, `074-cpu-source-contract-distant-sun-matrix`,
`075-cpu-local-source-first-order-diagnostics`, and
`076-cpu-source-contract-shader-packet`, plus
`078-cpu-local-source-integrated-render`. The packet dry run in `076`
rehydrated the distant-Sun JSON packet into the CPU renderer with exact raw
image, selected diagnostics, and source-sample trace parity against Milestone
8. Its local packet is pure data and explicitly marks local second-order cache,
direct local solar-disc camera radiance, and local ground bounce as unsupported
or deferred. `078` proves the flat/local point Sun is integrated into the CPU
image renderer's first-order scattering integral while the default spherical
distant-Sun control still matches `037` exactly. The local render uses
`atmosflat32` artifact `018` for source placement and brightness calibration.
Its flat scene no-hit sky ray limit defaults to the accepted visibility
offshoot result `1,926.774 km`, but that is a renderer-owned POC policy, not an
Algorithm32 atmosphere constant; shorter practical caps may be tested later.
Visual-only gallery `079-cpu-source-subjective-gallery` renders first-order
distant high/low Sun panels and local flat-Sun orbit offsets `0`, `45`, `90`,
`135`, and `180` degrees for inspection only. Objective CPU local-source
integration remains owned by `078`.
Milestone 13 is accepted by
`080-browser-lit-scene-input-capture` and
`081-browser-lit-scene-input-cpu-postprocessor`. It used the current
user-owned watch harness without relaunch to capture a real Three-lit browser
scene packet with scene color, hit distance/mask, camera, and source metadata,
then ran CPU Algorithm32 over that packet as `sceneColor * T_view + L_path`
before shader code. The required old-renderer validation compared the original
CPU renderer against the new CPU postprocessor with an unlit/material-color
packet and no Three lighting or shadows; it passed with `maxAbsRgbDelta = 0`.
The zero-density scene-color passthrough also passed with `maxAbsDelta = 0`.
Milestone 14 is accepted by
`083-cpu-soft-shader-unlit-parity-matrix`: the CPU soft-shader unlit parity
matrix matched the original CPU renderer exactly for full Algorithm32
simple-card, first-order simple-card, and sunset-floor cases. Milestone 15 is
accepted by `084-cpu-soft-shader-lit-scene-matrix`: the lit packet kept exact
zero-density passthrough, replaced sky with Algorithm32 radiance, preserved
shadow/lit separation after atmosphere, and produced finite RGBA over all
pixels. Milestone 16 is accepted by `085-browser-source-light-coupling` and
`086-cpu-source-light-coupling-validation`: the distant Sun packet now drives
both Algorithm32 and the Three `DirectionalLight`, direction agreement is
`3.46944695195361e-18`, no default-Sun fallback was used, zero-density
passthrough stayed exact, and shadow/lit separation survived the postprocess.
Milestone 17 is accepted by browser captures `087` through `090` and
aggregate artifact `091-cpu-distant-sun-position-matrix`: high, low,
synthetic side, and synthetic behind-camera distant Sun cases passed `39/39`,
and packet-supplied synthetic Sun cases now drive Algorithm32 without a
default high-Sun fallback. Milestone 18 is accepted by
`093-cpu-local-sun-soft-shader-source-matrix`: local offsets `0`, `45`, `90`,
`135`, and `180` degrees all resolved as `packet-supplied-flat-local-point-sun`,
matched the original CPU local renderer exactly, and passed finite-source
trace checks. Milestone 19 is accepted by
`094-cpu-unified-source-driven-soft-shader-matrix`: distant high, distant low,
and the five local offsets all reprocessed through the same
`postprocessSceneInput` CPU soft-shader kernel and passed `56/56` criteria.
Milestones 20 through 29 are accepted by `162`, `167`, `171`, `172`, `174`,
`176`, `177`, `185`, `192`, and `193`, with browser evidence in `166`, `169`,
`170`, `173`, `175`, `180` through `184`, and `187` through `191`. The shader
runway froze the GPU packet inventory, proved exact no-atmosphere passthrough,
made distant Sun uniforms packet-driven, matched distant high/low CPU
soft-shader output with `maxAbsRgbDelta = 1`, preserved lit Three scene
shadows through shader composition, matched local closest/`90` first-order
selected diagnostics with max RGB delta `0`, then accepted local full-image
spectrum parity and local scene-color-composition parity for offsets `0`,
`45`, `90`, `135`, and `180` degrees. Milestone 29 accepted the corrected
capability matrix with `6/6` criteria. The CPU/browser postprocessor runway
and POC browser shader runway are complete through Milestone 29, and the
Three-native atmosphere-pass runway is complete through Milestone 38. Use
`226-three-native-production-shape-review` as the current shader-lab endpoint,
`224-three-native-live-pass-soft-shader-matrix` as the current objective
live-pass parity evidence, `094` as the unified source-driven CPU oracle, and
`054` only as the prior fixed distant-Sun browser shader endpoint. Milestones
30 through 38 moved the accepted shader math into the actual target POC: a
Three-native `Algorithm32AtmospherePass` over live Three scene color and
depth render targets with camera controls. JSON scene packets remain
validation/oracle artifacts only; they are not the normal render input.
Evidence: `218` pass shell, `212` depth-to-ray reconstruction, `216` distant
first-order atmosphere, `217` live camera controls, `220` flat/local
first-order atmosphere, `222` unified source/geometry adapter switching,
`224` live-pass-vs-soft-shader matrix, `225` scenario/debug controls, and
`226` production-shape review.
Visual-only artifact
`227-postprocess-gpu-vs-integrated-shader-subjective-scenes` compares the
packet/postprocess GPU shader against the integrated Three-native shader for
the same four source scenarios. Treat it as inspection material, not a new
objective shader milestone.
Before triggering another browser run,
read `tmp/atmosphere/algorithm32_shader_lab/harness-heartbeat.json` and write
the command to its `commandPath` when the watch loop is current; if it is
stale or unavailable, use the approved direct one-shot
`harness.js --once --command ...` shell command. Do not launch Chrome from
nested experiment code or the agent tool path unless explicitly asked.

Performance benchmark scaffolding exists but is parked. Accepted smoke
artifact `067-browser-shader-benchmark` proves structured benchmark
diagnostics for the current second-order GPU-direct pass, but no isolated GPU
timing baseline exists because the current Chromium/WebGL backend did not
expose `EXT_disjoint_timer_query_webgl2`. Artifact
`069-browser-shader-benchmark` is cautionary only.

Recent background only: the `atmosflat32` source-abstraction POC is accepted at
`019` for default distant-Sun parity and `018` for first-order flat/local
rotation skydomes. Reload it only when work returns to configurable local Sun
behavior.

## Current Shader-Lab Status

The shader-lab status below is retained as the detailed run history. Iteration 1,
Browser Three Scene Baseline, is accepted. Agent-launched browser control is
rejected in this session, but the user manually ran the Puppeteer `--once`
harness and produced accepted artifact
`tmp/atmosphere/algorithm32_shader_lab/018-browser-three-baseline/` in
`629 ms`. The user also ran the persistent `--watch` harness; editing the
watched command file produced accepted reload artifact
`tmp/atmosphere/algorithm32_shader_lab/020-browser-three-baseline-watch-reload-check/`.
Iteration 2 is accepted by `021-browser-ray-depth-diagnostics` and
`022-browser-ray-depth-diagnostics-comparison`. Iteration 3 is accepted by
`025-browser-atmosphere-components` and
`026-browser-atmosphere-components-shader-comparison`; browser JS atmosphere
components, Node recomputation, and WebGL2 diagnostic shader readback agree
for selected sky, object, and ground pixels. Iteration 4.1 is accepted by
`027-browser-direct-radiance` and
`028-browser-direct-radiance-comparison`; one-wavelength 532 nm first-order
selected-pixel radiance agrees across browser JS, independent Node
recomputation, and WebGL2 shader readback. Iteration 4.2 is accepted by
`030-browser-direct-radiance-spectral` and
`031-browser-direct-radiance-spectral-comparison`; all 15 Algorithm32
first-order spectral channels agree across browser JS, independent Node
recomputation, and WebGL2 shader readback for selected pixels. Iteration 5.1
is accepted by `032-browser-first-order-image`, proving full-image
first-order shader composition on the simple browser scene. Selected-pixel
second-order diagnostics are accepted in `041` through `045`, and full-image
second-order simple-scene parity is accepted by
`048-browser-second-order-image` against CPU Algorithm32 reference `037`.
Scene-input second-order parity is accepted by `051`, which feeds the shader
from a per-pixel browser JS Three Raycaster distance/spectrum texture, and
`053`, which feeds the shader from a GPU-rendered scene-input target through a
readback/upload bridge. `052` is rejected because the scene background was
incorrectly encoded as sky hits before the background-clear fix. Direct GPU
texture scene-input parity is accepted by `054`, which binds the Three render
target texture directly into the experimental atmosphere pass without
scene-input readback/upload for shader input.
Shader benchmark mode now exists as `browser-shader-benchmark`. Accepted smoke
artifact `tmp/atmosphere/algorithm32_shader_lab/067-browser-shader-benchmark/`
proves the mode can return structured timing diagnostics for the current
second-order GPU-direct scene-input atmosphere pass. The current Chromium
WebGL backend did not expose `EXT_disjoint_timer_query_webgl2`, so `067` does
not provide isolated GPU pass time. `069-browser-shader-benchmark` is only a
cautionary aggressive-batching artifact; benchmark defaults now use small
sample counts, yield between samples, and keep `gl.finish()` fallback timing
opt-in. Performance work remains parked unless the user explicitly resumes it.
If performance resumes later, use
`tmp/atmosphere/algorithm32_shader_lab/browser-shader-benchmark-command.json`
from a dedicated user-owned browser/harness process or exact process
ownership. Do not clean up benchmark runs by killing generic `chrome`
processes.
The latest user-directed flat-earth visibility offshoot is accepted in
`tmp/atmosphere/algorithm32_shader_lab/056-browser-flat-earth-visibility-search/`.
It keeps the standard Algorithm32 atmosphere constants but uses flat-slab
geometry and first-order scattering to binary-search the nearest distance where
an object-present render no longer differs from the no-object render by more
than `1` encoded RGB value. With the recorded `10 km x 10 km` matte black
vertical card, `2 m` camera height, and `24 deg` vertical FOV, that distance is
`1,926.774 km`. `055` is rejected because the first bracketing run skipped the
configured max distance; `057` is rejected because a `100 km`-wide stress card
remained visible at the `3,000 km` cap, showing the result depends on physical
target dimensions and image resolution.
Visibility-loss milestones for the original target are accepted in
`tmp/atmosphere/algorithm32_shader_lab/062-browser-flat-earth-visibility-search/`.
The user clarified that `100%` means cannot see, so the requested milestones
are percent lost rather than percent retained. The accepted distances are
`50% lost = 21.480 km`, `75% lost = 601.563 km`, `80% lost = 776.563 km`,
`90% lost = 1,228.125 km`, `95% lost = 1,543.750 km`, and
`100% lost/cannot see = 1,926.774 km`. `059` is incomplete, `060` is
superseded because it did not serialize the milestone table into diagnostics,
and `061` is incomplete from a screenshot-label helper error.
High-resolution visual inspection of those milestone distances is accepted in
`tmp/atmosphere/algorithm32_shader_lab/065-browser-flat-earth-visibility-search/`;
use its native `canvas-image.png` for inspection. It supersedes `064`, whose
gallery content was laid out too small because of stale canvas dimensions.
Historical subjective progress snapshots `049` and `050` render the mountain
pair through the current second-order shader path with CPU Algorithm32
reference images beside them, but those comparisons are only for visual
progress. The CPU source-contract runway is now accepted through `078`; `076`
is the source-packet dry run and `078` is the CPU local-source integrated
render proof. Milestone 13 is accepted by `080` and `081`, proving
browser-lit scene-input capture plus CPU Algorithm32 postprocessing. If the
next step is shader work, formalizing the production depth/material texture
contract, packing distant-Sun uniforms/defines/textures, or replacing the
private-handle proof with a Three-owned composition pass now follows that
CPU-postprocessor gate.

The reusable Algorithm32 module remains the end product of the cleanroom
"reference" effort, but the next practical work is shader validation. The
accepted spherical shader endpoint is still `054`; the flat-earth visibility
work is a documented experimental offshoot requested by the user, not a
replacement for the spherical shader endpoint. The current flat-production
design discussion targets a configurable local Sun whose latitude, altitude,
radius/size, and brightness/luminosity are explicit flat-model hypothesis
parameters, with time-of-day motion using a solar-day period by default.
Sidereal rotation remains the star-dome period or an explicit advanced option.
The environment-object color experiment is closed and should be treated as a
handoff proof, not an active artifact-generation lane.

Start here after context compaction or a fresh agent bootstrap:

1. [Algorithm32 Shader Iteration Plan](algorithm32-shader-iteration-plan.md)
   - Read the accepted Milestone 8 through Milestone 13 summary.
   - Read `Shared Soft-Shader Contract`, the accepted Milestone 14 through
     Milestone 19 soft-shader runway, and the accepted Milestone 20 through
     Milestone 29 shader/soft-shader parity runway.
   - Read the accepted Milestone 30 through Milestone 38 Three-native
     atmosphere-pass runway.
   - Read `Current Next Iteration`.
2. `scripts/flat/algorithm32-shader-lab/README.md`
   - Read the source-contract block beginning with
     `The accepted CPU source-contract runway is`.
   - Read command examples only when needed.

Optional only when explicitly needed:

- [Algorithm32 Shader Lab Plan](algorithm32-shader-lab-plan.md)
- [Production Flat Shader Differences](production-flat-shader-differences.md)
- [Algorithm32 Module Design](algorithm32-module-design.md)
- [Experiment 032 Algorithm](experiment-032-algorithm.md)
- [Atmosflat32 Source Abstraction Prompt](atmosflat32-source-abstraction-prompt.md)
- [Environment Object Color Closeout](environment-object-color-closeout.md)

Minimal bootstrap ends here. The remaining implementation state is historical
background unless the prompt or user asks for it.

Implementation state:

- `scripts/flat/algorithm32-shader-lab/` exists as an experimental shader-lab
  workbench. The earlier Puppeteer smoke artifact validated a browser reload
  loop, and `018-browser-three-baseline` validates the browser baseline when
  the user launches the harness manually. `020-browser-three-baseline-watch-reload-check`
  validates command-file reloads through the persistent watch loop.
  Agent-launched browser starts remain unreliable in this session.
  `node-three-reference.js` validates the first Node/Three CPU
  reference path: Three camera rays and Raycaster hits can drive Algorithm32
  sky/object spectral transfer packets without Chromium. The accepted artifact
  is
  `tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference/`
  with `11` passing criteria, `0` failing, and `0` unresolved. It is not
  production code and does not require unit tests. See
  [Algorithm32 Shader Lab Plan](algorithm32-shader-lab-plan.md).
- The immediate shader iteration plan is
  [Algorithm32 Shader Iteration Plan](algorithm32-shader-iteration-plan.md).
  Its current accepted endpoint is Milestone 13, Browser Lit Scene Input CPU
  Postprocessor, after the accepted CPU/data-contract runway:
  `071-cpu-source-contract-distant-sun`, `074-cpu-source-contract-distant-sun-matrix`,
  `075-cpu-local-source-first-order-diagnostics`, and
  `076-cpu-source-contract-shader-packet`, plus `078`. The accepted browser
  shader endpoint remains `054`; accepted artifacts `080` and `081` now prove
  the browser-lit scene input plus CPU postprocessor shape. Local Sun shader
  behavior remains deferred.
  The earlier ladder remains accepted: first useful browser baseline `018`,
  watch-mode reload `020`, browser ray/depth parity `022`, atmosphere-component
  plus WebGL2 diagnostic shader parity `026`, one-wavelength first-order direct
  radiance `028`, 15-channel first-order selected-pixel spectral radiance
  `031`, full-image first-order shader composition `032`, objective full
  Algorithm32 pairing `038`, first-order isolation pairing `040`,
  selected-pixel second-order diagnostics `041` through `045`, full-image
  second-order simple-scene parity `048`, JS Raycaster scene-input parity
  `051`, GPU scene-input parity `053`, and direct GPU texture scene-input
  parity `054`.
  Historical subjective mountain shader progress snapshots with Algorithm32
  references are accepted as `049` and `050` for progress visibility only. Use
  the user-owned watch loop for further browser runs.
- The current optional subjective shader-lab mountain scene is
  `tmp/atmosphere/algorithm32_shader_lab/012-mountain-ridges-framed-large/`.
  It uses `node-three-reference.js --scene mountain-ridges` with procedural
  layered ridges and a valley floor through the same Three raycast plus
  Algorithm32 sky/object transfer path. It intentionally has `0` formal
  criteria because it is a visual composition target; `007` through `011` are
  superseded mountain-layout iterations.
- The alternate mountain view requested with the sunset behind the camera is
  `tmp/atmosphere/algorithm32_shader_lab/013-mountain-ridges-sunset-behind-camera/`.
  It uses `--mountain-view sunset-behind-camera`, the low-Sun
  `figure1-06h00-z87` case, and the same subjective `0`-criteria policy.
- The current shader-path subjective mountain progress snapshots are
  `tmp/atmosphere/algorithm32_shader_lab/049-browser-mountain-second-order-front-high-sun/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/050-browser-mountain-second-order-sunset-behind-camera/`.
  Each contains `side-by-side.png` for human progress review only. The CPU
  Algorithm32 references are `033` and `034`; the shader side uses the current
  second-order browser shader path with analytic procedural mountain
  intersections.
- `scripts/flat/atmosphere-environment/run.js` exists and owns the current
  self-contained experiment runner.
- `tmp/atmosphere/cleanroom_environment/` contains the current numbered
  artifact history and append-only `running-log.md`.
- `001-transfer-baseline` and `002-transfer-convergence` are rejected
  diagnostics. They exposed a segment-composition diagnostic bug: the full
  segment and two half segments used different quadrature partitions.
- `003-transfer-baseline` is accepted after the diagnostic fix, but its
  original `20/10/17/24` numerical controls did not meet the `5x`
  convergence-margin gate.
- `004-transfer-convergence` is rejected because the original baseline's
  minimum effect-to-convergence margin was `3.0292958740138496`.
- `005-transfer-refined-baseline` is the accepted current refined baseline
  using `40/20/34/48` numerical controls.
- `006-transfer-refined-convergence` is the accepted final convergence proof
  using `80/40/68/96` controls against `005`, with `15` passing criteria, `0`
  failing, `0` unresolved, and minimum convergence margin
  `6.4074899093834174`.
- `007-lambertian-surface-lighting` is a partial crash artifact caused by a
  report-writing bug after criteria generation.
- `008-lambertian-surface-lighting`, `009-local-sun-follow-up`, and
  `010-flat-long-sightline-follow-up` are accepted but superseded by cleaner
  final report reruns.
- `011-lambertian-surface-lighting` is the accepted final Lambertian
  surface-lighting proof with `8` passing criteria, `0` failing, `0`
  unresolved.
- `012-local-sun-follow-up` is the accepted final local finite-source proof
  with `8` passing criteria, `0` failing, `0` unresolved.
- `013-flat-long-sightline-follow-up` is the accepted final flat long-line-of-
  sight proof with `9` passing criteria, `0` failing, `0` unresolved.
- `014-scene-gallery` through `017-scene-gallery` are accepted but superseded
  scene-display iterations. `014` proved image generation but used a
  non-algorithmic illustrative sky; `015` and later moved the sky and
  ground-atmosphere context to cleanroom spectral atmosphere sampling; `017`
  still clustered the distance cards too tightly.
- `018-scene-gallery` is an accepted perspective scene-output proof with `6`
  passing criteria, `0` failing, `0` unresolved; it is superseded by `019` for
  the requested source-color selection.
- `019-scene-gallery` is an accepted source-colored scene-output proof with
  `7` passing criteria, `0` failing, `0` unresolved; it is superseded by the
  multicolor scene-display request.
- `020-scene-gallery` is an accepted multicolor scene-output proof with `7`
  passing criteria, `0` failing, `0` unresolved; it is superseded by `021`
  because the first multicolor layout read more like adjacent front cards than
  separated object sets.
- `021-scene-gallery` is an accepted multicolor scene-output proof with `7`
  passing criteria, `0` failing, `0` unresolved; it is superseded by the green
  spectrum correction because the previous broad green peak displayed
  yellow-green/yellow.
- `022-transfer-refined-baseline` is an accepted green-spectrum replacement
  baseline with `14` passing criteria, `0` failing, `1` unresolved convergence
  criterion. It changes only the algorithmic synthetic green spectrum, from
  the previous yellow-green broad peak to a 532 nm display-green stress peak.
- `023-transfer-refined-convergence` is an accepted green-corrected transfer
  convergence proof with `15` passing criteria, `0` failing, `0` unresolved;
  it is superseded by the foreground-olive green request.
- `024-lambertian-surface-lighting` is the accepted green-corrected Lambertian
  proof with `8` passing criteria, `0` failing, `0` unresolved.
- `025-local-sun-follow-up` is the accepted green-corrected local finite-source
  proof with `8` passing criteria, `0` failing, `0` unresolved.
- `026-flat-long-sightline-follow-up` is the accepted green-corrected flat
  long-line-of-sight proof with `9` passing criteria, `0` failing, `0`
  unresolved.
- `027-scene-gallery` is an accepted green-corrected multicolor scene-output
  proof with `7` passing criteria, `0` failing, `0` unresolved; it is
  superseded by the foreground-olive green request.
- `028-transfer-refined-baseline` is an accepted foreground-olive green
  baseline with `14` passing criteria, `0` failing, `1` unresolved convergence
  criterion. It changes only the algorithmic synthetic green spectrum to a
  user-directed muted foreground color target, encoded as `79/96/32` before
  atmosphere in the display preview.
- `029-transfer-refined-convergence` is an accepted foreground-olive transfer
  convergence proof with `15` passing criteria, `0` failing, `0` unresolved;
  it is superseded by the lower-right forest-green request.
- `030-lambertian-surface-lighting` is the accepted foreground-olive
  Lambertian proof with `8` passing criteria, `0` failing, `0` unresolved.
- `031-local-sun-follow-up` is the accepted foreground-olive local
  finite-source proof with `8` passing criteria, `0` failing, `0` unresolved.
- `032-flat-long-sightline-follow-up` is the accepted foreground-olive flat
  long-line-of-sight proof with `9` passing criteria, `0` failing, `0`
  unresolved.
- `033-scene-gallery` is an accepted foreground-olive multicolor
  scene-output proof with `7` passing criteria, `0` failing, `0` unresolved.
  It is superseded by the lower-right forest-green request.
- `034-transfer-refined-baseline` is an accepted lower-right forest-green
  baseline with `14` passing criteria, `0` failing, `1` unresolved convergence
  criterion. It changes only the algorithmic synthetic green spectrum to a
  user-directed dark forest color target from the lower-right foliage
  reference, encoded as `30/58/32` before atmosphere in the display preview.
- `035-transfer-refined-convergence` is the accepted final lower-right
  forest-green transfer convergence proof with `15` passing criteria, `0`
  failing, `0` unresolved.
- `036-lambertian-surface-lighting` is the accepted lower-right forest-green
  Lambertian proof with `8` passing criteria, `0` failing, `0` unresolved.
- `037-local-sun-follow-up` is the accepted lower-right forest-green local
  finite-source proof with `8` passing criteria, `0` failing, `0` unresolved.
- `038-flat-long-sightline-follow-up` is the accepted lower-right
  forest-green flat long-line-of-sight proof with `9` passing criteria, `0`
  failing, `0` unresolved.
- `039-scene-gallery` is an accepted lower-right forest-green
  multicolor scene-output proof with `7` passing criteria, `0` failing, `0`
  unresolved; it is superseded by `040` for the 8 px scene-background sampling
  request.
- `040-scene-gallery` is the accepted final high-resolution scene-output proof
  with `7` passing criteria, `0` failing, `0` unresolved. It reads accepted
  artifacts `035`, `036`, `037`, and `038`; changes only the algorithmic scene
  preview sky/ground block sampling from `24 px` to `8 px`; samples `11040`
  sky blocks and `21600` ground-atmosphere blocks; renders red, blue, and dark
  forest-green recorded object-spectrum stacks in each scene/source view; and
  generates `scene-preview-transfer.png`, `scene-preview-lambertian.png`,
  `scene-preview-local-sun.png`, `scene-preview-flat-long-sightline.png`, and
  `scene-gallery.png`.
- The successful refined baseline uses `84` primary transfer cases: `2` Sun
  cases, `7` distances, and `6` synthetic object spectra.
- Artifact numbering is append-only. Use `max(existing NNN) + 1`; never
  overwrite a numbered folder.
- Every artifact must include `state-goal.md`, `inputs.json`,
  `provenance.json`, `equations-and-constants.json`, `transfer-cases.json`,
  `criteria-results.json`, `report.md`, `contact-sheet.png`, `run.log`, and
  a script snapshot or script-snapshot folder.
- The full experiment state goal has been reached, including generated scenes
  for every phase. Do not continue generating numbered experiment artifacts
  unless the user explicitly asks for a new diagnostic.

Use only `scripts/flat/experimental/bruneton-start-fresh.js` as the local
code/CLI guide. Do not load older Flat atmosphere docs, rejected pipeline code,
or previous skydome logs unless the user explicitly asks for source-audit or
architecture-comparison work.

## Endpoint Principle

The cleanroom transport pipeline should end at spectral radiance, not display
RGB. The canonical physical output should include the wavelength grid,
final spectral radiance by wavelength, and component diagnostics such as
in-scattered sky radiance, optional separated direct solar-disc radiance,
surface radiance, and higher-order scattering terms when enabled.

CIE XYZ conversion, linear RGB conversion, exposure, the Bruneton Figure 1
`k` tone-map, white balance, PNG writing, and report swatches are post-pipeline
consumer choices. They may be provided as reusable caller APIs, but they should
not feed back into transport stages or become the physical endpoint.

This fits the step 032 evidence: the comparison image is produced by taking
spectral sky radiance through CIE/linear-sRGB and then applying Bruneton's
source-backed Figure 1 display scalar `k = 1 / (5 * 683)`. That `k` belongs to
the comparison/display layer, not the atmospheric transport result.

## Architecture Shape

A literal calculation pipeline is still valid at the major contract boundaries,
but the rejected design's one-stage-per-calculation shape should not be copied
as the core architecture.

Use a coarse transport pipeline:

1. Validate and canonicalize the scene, source, geometry, spectral grid, and
   numerical controls.
2. Resolve the camera ray's atmosphere/surface path.
3. Solve spectral transport for that ray or pixel batch.
4. Return a spectral radiance packet plus diagnostics.
5. Let post-pipeline consumers perform colorimetry, display mapping, reporting,
   and image writing.

Inside the transport solver, use small source-backed kernels rather than packet
stages for every formula: density profiles, extinction/scattering coefficients,
phase functions, optical-depth integration, Beer-Lambert transmittance,
single-scattering accumulation, second-order incident-radiance lookup, and
optional surface/boundary radiance. These kernels should be pure and directly
testable, but they can be composed inside loops, caches, and iterative
radiance-field solvers where the physics requires coupling.

This shape better matches the cleanroom evidence. Step 032's important
transport behavior is not a flat left-to-right list of independent operations;
it includes a primary camera-ray integral plus a full-sphere second-order
incident-radiance approximation. Forcing that into many append-only packet
stages would either duplicate facts, expose implementation caches as public
contract, or hide the real solver inside one nominal stage anyway.

Keep the rejected pipeline's useful lessons: explicit units, immutable inputs,
single ownership of canonical facts, named diagnostics, and a clear public
spectral endpoint. Drop the rigid requirement that each physical subcalculation
must be its own public pipeline stage.

## Reference To Shader Goal

The cleanroom reference project is a means to the production atmosphere shader,
not the final renderer. Its job is to provide source-backed spectral transport
results, diagnostics, cache-builder contracts, and parity artifacts that let a
shader use cheaper runtime forms without losing the physical contract.

The end product of what this work has called the reference is the reusable
Algorithm32 module: direct trace APIs, cache-builder APIs, profile/preset data,
and shader parity fixtures. A script runner, report generator, or PNG gallery
can consume that module, but it is not the durable product by itself.

The production shader may use precomputed textures, reduced channel counts,
depth-buffer aerial perspective, lower resolution passes, and configuration
caches. Those approximations must be documented and compared against the
reference rather than hidden as display or tint adjustments.

If Flat must rebuild source-dependent textures from an application
configuration dialog, experiment 032 logic may need to be promoted into
application-reachable code. Promote reusable source-backed transport kernels
and cache-builder contracts rather than copying the experimental script
wholesale.

See [Reference To Shader Goal](reference-to-shader-goal.md) for the end-state
contract, cache strategy, flat/local-Sun rebuild expectations, and future cloud
insertion point.

See [Algorithm32 Module Design](algorithm32-module-design.md) for the reusable
module boundary and draft interfaces for direct traces, object transfer,
cache building, app presets, and shader parity.

## Object Color Requirement

The production design must treat object color transport as first-class, not as
a side effect of sky rendering. A sky dome is the no-surface case. A visible
object requires finite-segment aerial perspective:

```text
L_camera(lambda) =
  T_view(lambda) * L_object(lambda) +
  L_path(lambda)
```

The atmosphere solver owns `T_view(lambda)` and `L_path(lambda)`. The caller or
surface subsystem owns `L_object(lambda)`. See
[Object Color Transport](object-color-transport.md) for the API shape,
spectral/RGB boundary, and test requirements.

The finite-object contract has been proven in the separate experimental lane.
See [Environment Object Color Closeout](environment-object-color-closeout.md)
for the final artifacts, results, and production carry-forward notes. The
original experiment plan remains in
[Object Transport Experiment Plan](object-transport-experiment-plan.md) and
[Environment Object Color Prompt](environment-object-color-prompt.md). The
objective pass/fail criteria live in
[Objective Success Criteria](objective-success-criteria.md).

## Source Boundary

External papers, standards, datasets, and third-party source code are the
authority for equations, constants, approximations, display policy, expected
colors, and visual targets. Already-downloaded external files are allowed only
when read and cited directly as external primary material.

Previous local project code, older local documentation, rejected reference
pipeline code, previous local artifacts, and local summaries of external
sources are not authority for physics, color, sampling, display constants, or
target appearance.

## Current Design Inputs

- [Algorithm32 Canonical Reference](algorithm32-canonical-reference.md) is the
  current source of truth for Algorithm32 steps, source/geometry abstractions,
  accepted POC endpoint status, production module requirements, open issues,
  and immediate production followups.
- Step 032 uses no ground coupling, no direct solar-disc camera term, no ozone,
  Bruneton 2016 aerosol constants, 15-sample CIE conversion, full-sphere
  Fibonacci second-order scattering, and `k = 1 / (5 * 683)`.
- [Experiment 032 Algorithm](experiment-032-algorithm.md) records the step 032
  algorithm, equations, active constants, inactive script-carried constants,
  external references, and algorithmic choices.
- [Object Color Transport](object-color-transport.md) records the finite-ray
  object/aerial-perspective contract needed to make the atmosphere useful for
  environment objects, not only sky color.
- [Environment Object Color Closeout](environment-object-color-closeout.md)
  records the accepted final artifacts, validated criteria, unchanged
  atmosphere-equation boundary, production carry-forward contracts, and
  experimental caveats from the object-color lane.
- [Reference To Shader Goal](reference-to-shader-goal.md) records that the
  reference project's end goal is to enable the production atmosphere shader,
  including cache-builder contracts, shader parity, flat/local-Sun rebuild
  behavior, and future cloud insertion.
- [Algorithm32 Module Design](algorithm32-module-design.md) records the working
  interface design for packaging Algorithm32 as reusable code for direct
  reference traces, app cache rebuilds, atmosphere presets, and shader
  validation.
- [Atmosflat32 Source Abstraction Prompt](atmosflat32-source-abstraction-prompt.md)
  records the working prompt for the `scripts/flat/atmosflat32/` lane, the
  accepted distant-Sun source-abstraction regression, and the accepted
  first-order local-source skydome milestone.
- [Algorithm32 Shader Lab Plan](algorithm32-shader-lab-plan.md) records how the
  experimental Puppeteer/Three harness should build from browser-control smoke
  tests to Node/Three CPU Algorithm32 reference images and shader parity runs.
- [Production Flat Shader Differences](production-flat-shader-differences.md)
  records the concrete production shader changes needed for flat geometry:
  altitude, boundaries, optical-length path geometry, Sun transmittance, cache
  coordinates, diagnostics, and validation.
- [Object Transport Experiment Plan](object-transport-experiment-plan.md)
  records the closed experimental lane that proved finite-segment object
  transfer before generating the production pipeline.
- [Environment Object Color Prompt](environment-object-color-prompt.md) is the
  closed implementation prompt for the environment-object color proof under
  `scripts/flat/atmosphere-environment/`, with outputs under
  `tmp/atmosphere/cleanroom_environment/`.
- [Objective Success Criteria](objective-success-criteria.md) defines the
  reference-backed transport identities, objective demonstration checks,
  convergence policy, display-only review checks, and follow-up experiment
  criteria for local-Sun and flat-Earth long-line-of-sight variants.
- [Environment Experiment Run Shape](environment-experiment-run-shape.md)
  defines the proposed run sequence, resolved inputs, artifact outputs, and
  minimal 3D ray-test environment for the cleanroom object-color experiments.
  It also defines the self-guided iteration contract: numbered artifacts should
  continue through verification and documentation until a state goal is
  reached, a dead end is documented, or the user interrupts.
- [Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md)
  locks the first-run decisions: use all active experiment 032 constants and
  assumptions, include the Bruneton Figure 1 sunrise/sunset and highest-Sun
  cases, use algorithmic stress spectra/distances/target placement, include
  the `84`-case baseline matrix, fixed unit conventions, append-only artifact
  numbering, explicit criterion statuses, audit-trail references in inputs and
  outputs, use the cleanroom script's `--step=<step-id>` CLI pattern as the
  local CLI guide, and update the root running log for every numbered
  iteration.
- Step 031 remains the prior fitted-k four-row artifact.
- Step 029 remains the prior simplified fitted-k anchor.
- Step 030 remains direct-ground equivalence evidence.

Future docs in this folder should define the reset architecture, stage
contracts, source-backed constants, display policy, cache-builder contracts,
shader parity checks, and the handoff path from the experimental script into
production shader code.
