# Local Sun Second-Order Experiment Plan

Status: accepted through Milestone 12, with the initial Milestone 13
`three.terrain.js` distant-midday integrated-shader spike accepted and an
asset-backed Rocky Land heightmap follow-up accepted at
`047-rocky-land-heightmap-integrated-distant-midday-v3`. The
centralized POC implementation bundle
imports successfully from `shared/algorithm32/POC/` and the copied runners
have been reduced to pure importable implementation modules. The original
non-shader `bruneton-start-fresh` base algorithm is also preserved there as an
algorithm-only POC module. The lane browser harness is implemented under
`scripts/flat/local-second-order/`. The harness timeout recovery path is fixed
and the local harness now defaults to hardware WebGL instead of forced
SwiftShader software rendering. Do not track live watcher state in
documentation; inspect heartbeat/process state at execution time. The initial
browser smoke artifact
`tmp/atmosphere/local-second-order/001-browser-runner-smoke/` is accepted.
Milestones 1 through 12 have accepted artifacts in the local lane. Rejected
diagnostic artifacts `002` and `010`, plus blocked artifact `013`, remain in
sequence as evidence. The old `013-three-integrated-gpu-local-l2-blocked`
stop point is superseded by accepted browser artifacts `018` and `019`, runner
acceptance artifact `020-three-integrated-gpu-local-l2`, matrix artifact
`021-objective-subjective-local-l2-matrix`, and promotion artifact
`022-promotion-notes`. This is still POC evidence; durable production
contracts are summarized under `agents/topics/apps/flat/algorithm32/README.md`
before promotion into `shared/algorithm32/`.

Post-milestone subjective follow-up: accepted artifact
`030-subjective-l2-cache-comparison` regenerates the four shader-lab
subjective source scenes from this lane and writes first-order versus
second-order/cache side-by-side images. It supersedes `025`, whose terrain
silhouette differed because the browser fallback used a different RNG. The
corrected run passes the full `mountain-detail-v1` scene spec generated with
`src/gc/utils/random.js` into the browser command and matches the accepted
shader-lab `157`/`158` elevated-camera skyline counts for distant midday.
Milestone 13 is partially accepted as focused distant-midday
integrated-shader subjective terrain work: first through `three.terrain.js`,
then through the `rocky-land-heightmap` backend using the CC0 Rocky Land and
Rivers height map. The Southern France OBJ terrain runway is accepted through
Milestone 16: `048` proves geometry placement and `049` proves real diffuse
terrain color/detail with the `southern-france-obj-diffuse` backend. Current
review-quality subjective evidence is the `059` shader-on render plus the
paired `060` shader-off comparison. Milestone 17 is accepted as the split
one-case no-shadows with/without full-shader matrix in artifacts `070` through
`073`, without changing the Algorithm32/cache path. Follow-up fitted
local-angle views are accepted as `077` through `079`, adding local `135` and
local `180` and rerendering local `90` with yaw aimed toward the local `180`
degree Sun bearing. The fitted rerenders rotate and widen the staged Southern
France OBJ footprint for this 180-facing view so the finite mesh does not end
before the right edge. Artifacts `074` through `076` are superseded by this
terrain-fit rerender. The earlier all-four-cases command timed out in the
browser and consumed too much CPU. Shader-only vertical local stack artifact
`080` is also accepted for local closest, `45`, `90`, `135`, and `180`, all
looking toward the local `180` degree Sun bearing with the integrated
Algorithm32 shader. The browser source placement now derives local Sun
positions from the flat app's `annual-tropic-migration` latitude model for the
configured date, then rotates that north-pole azimuthal-equidistant latitude
ring clockwise by the requested forward-time offsets from closest San Jose
approach; the old baked fixed-`24 deg N` local-source table is superseded.
The accepted forward-time rerender is
`087-southern-france-obj-diffuse-high-local-stack-toward-180sun-fit-w`, with
`30/30` passing criteria and no page errors. Artifact `068` records that rejected
timeout, while partial artifacts `066`, `067`, and `069` are command-only.
The harness now defaults to hardware WebGL instead of forced SwiftShader CPU
software rendering, treats browser evaluation timeouts as page/browser recovery
failures, and split one-case commands validate only their requested rows.

## Primary Objectives

Build one focused experimental loop for local Sun second-order scattering
outside the shader lab, while borrowing useful shader-lab code and patterns as
needed.

Before adding local second-order behavior, prove that the clean shared POC
modules did not lose behavior when they were extracted from the original
scripts/runners. The new lane must import from `shared/algorithm32/POC/`,
not copy old runners or reimplement their kernels.

The end goal is the same kind of proof produced by the shader lab:

- objective measurements against rendered scenes;
- selected-pixel and cache/source diagnostics;
- full-image CPU-vs-GPU comparison summaries;
- subjective images for human review.

The loop must prove local Sun parity with distant Sun at the scattering-order
contract level:

```text
distant Sun:
  L_camera = T_view * L_scene + L1_path + L2_path

local Sun:
  L_camera = T_view * L_scene + L1_path + L2_path
```

Local and distant Sun use different incident-field lookup coordinates, but the
second-order accumulation after lookup must be shared.

The core abstraction to prove is:

```text
L1_incident = incidentField.sample(position, incomingDirection, wavelength)
```

Required implementation sequence:

```text
distant cache:
  lookup(z, omega_i, lambda)

local direct oracle:
  traceFirstOrderIncidentRadiance(position, omega_i, lambda)

local CPU grid cache:
  lookup(z, rho, omega_i, lambda)

local integrated GPU cache:
  sample the same logical z/rho/omega cache from texture storage
```

Lazy CPU memoization is allowed as an intermediate diagnostic while building
Milestone 8, but Milestone 8 acceptance requires a named cache grid/config that
can be serialized and compared against the direct oracle.

Skip the standalone packet/postprocess GPU path for this lane. The GPU target
is the Three-integrated shader path because that is the production direction.

## Proposed Lane

New script lane:

```text
scripts/flat/local-second-order/
```

New artifact root:

```text
tmp/atmosphere/local-second-order/
```

Borrow patterns and helpers only from:

- `scripts/flat/algorithm32-shader-lab/` for Three scene setup,
  source/light adapters, depth/ray reconstruction, integrated pass wiring,
  diagnostics, comparisons, and gallery generation;
- `scripts/flat/atmosflat32/` for source abstraction and local Sun placement
  ideas;
- [Scattering Notes](scattering-notes.md) for the current discussion note on
  cache shape, incident-field lookup, CPU/GPU cache storage, and direction
  semantics.

Do not copy old runner bodies into the new lane. Import centralized modules
from `shared/algorithm32/POC/` where possible, and use older scripts only as
oracles or evidence sources.

Centralized POC implementation inputs:

```text
shared/algorithm32/POC/
```

This folder preserves the final accepted shader-lab and `atmosflat32` POC code
needed by this lane, plus the original non-shader `bruneton-start-fresh` base
algorithm. It includes source/geometry factories, distant directional Sun
configuration, flat/local point Sun configuration, the CPU transport, the CPU
soft shader, the Three-native atmosphere pass source, and the flat/local
single-scattering helper. Treat these as the clean POC implementation basis
for production. They are not the production module boundary yet; promote only
validated contracts into `shared/algorithm32/` outside the `POC` folder.

Run the import smoke proof before depending on the centralized copies:

```text
node shared/algorithm32/POC/validate-poc-imports.js
```

That smoke proof is necessary but not sufficient. Milestones 1 through 6 must
prove extraction parity against original runners or the checked-in evidence
registry below before new local second-order behavior is added.

Browser harness command shape:

```text
node scripts/flat/local-second-order/harness.js --watch
```

Current lane rule: do not run the harness manually with `--once` for
experiment work. Browser commands must go through the user-owned watch process
by editing `tmp/atmosphere/local-second-order/browser-command.json`. The
harness recovery and hardware-WebGL launch patches are in place and
syntax-checked. Documentation must not record whether the watcher is currently
running; use the heartbeat/process state at execution time.

The browser harness must exist before Milestone 1 starts because later module
parity and integrated-shader checks need a long-lived browser process like the
shader lab. Its default command path is:

```text
tmp/atmosphere/local-second-order/browser-command.json
```

Its heartbeat path is:

```text
tmp/atmosphere/local-second-order/harness-heartbeat.json
```

The initial `browser-smoke` command proves only the browser-loop contract:
page load, command reload, WebGL2 availability, selected canvas diagnostics,
PNG capture, criteria output, state-goal/provenance output, and running-log
continuity. It does not prove local second-order physics.

The initial browser smoke artifact is accepted at
`tmp/atmosphere/local-second-order/001-browser-runner-smoke/`. Do not start a
duplicate watcher or run `--once`. Determine live watcher state from the
heartbeat/process state when issuing commands, not from documentation.

The watch runner must survive fatal page-level failures. A page crash, closed
page, Puppeteer protocol disconnect-style error, or unexpected harness-side
command error must produce a rejected artifact, update heartbeat recovery
state, and let the watch loop reopen the page before the next command instead
of exiting silently.

Plain browser-side evaluation errors must also be contained. A failure like
`Evaluation failed: ReferenceError: lerp is not defined` must write a
rejected artifact and keep the watch loop alive; it must not request page
recovery unless Puppeteer also reports a closed or disconnected target. The
lane page includes a `throw-reference-error` probe command for this class of
harness validation.

Browser evaluation timeouts are different from normal browser-side exceptions.
When the harness-side timeout fires, the in-page promise may continue doing
WebGL work and consuming CPU even after a rejected artifact is written. The
local harness now classifies `Browser command evaluation timed out.` as a
recovery-required failure, skips post-timeout screenshot/canvas capture, closes
the page/browser before accepting another command, and avoids tight retry/poll
behavior after timeout artifacts. The local harness also no longer forces
`--use-gl=swiftshader` by default; use `--use-swiftshader` only for explicit
software-rendering fallback diagnostics.

Preflight gate before Milestone 1:

1. Run `node shared/algorithm32/POC/validate-poc-imports.js`.
2. Confirm the browser smoke artifact is accepted under
   `tmp/atmosphere/local-second-order/001-browser-runner-smoke/`.
3. For normal browser milestones, confirm the watcher heartbeat/process state
   at execution time before issuing browser commands.

The import proof and browser smoke are accepted as of this handoff. If either
must be rerun and fails, do not start Milestone 1.

## Reusable Guidance From Other Experiment Lanes

This lane must borrow the process discipline from the environment-object,
shader-lab, source-abstraction, and module-design lanes without inheriting
their old runners or historical baggage.

Mined source docs:

- [Environment Object Color Prompt](../environment-object-color-prompt.md);
- [Environment Experiment Run Shape](../environment-experiment-run-shape.md);
- [Environment Experiment Preflight Spec](../environment-experiment-preflight-spec.md);
- [Objective Success Criteria](../objective-success-criteria.md);
- [Object Transport Experiment Plan](../object-transport-experiment-plan.md);
- [Algorithm32 Shader Iteration Plan](../algorithm32-shader-iteration-plan.md);
- [Atmosflat32 Source Abstraction Prompt](../atmosflat32-source-abstraction-prompt.md);
- [Reference To Shader Goal](../reference-to-shader-goal.md);
- [Algorithm32 Module Design](../algorithm32-module-design.md).

### Evidence Registry

When a milestone says "accepted evidence", use these checked-in evidence
folders before looking anywhere under `tmp/`:

- Base/source-abstraction distant control:
  `../evidence/current/atmosflat-019-distant-baseline/`.
- Flat/local source placement and five orbit skydomes:
  `../evidence/current/atmosflat-018-local-skydomes/`.
- CPU first-order local-source integration and exact distant control:
  `../evidence/current/shader-078-cpu-local-source/`.
- Unified CPU soft-shader oracle matrix:
  `../evidence/current/shader-094-cpu-soft-shader-matrix/`.
- Packet GPU parity endpoint, for historical comparison only:
  `../evidence/current/shader-193-packet-gpu-parity/`.
- Three-native local first-order pass:
  `../evidence/current/shader-220-three-local/`.
- Three-native live-pass versus CPU soft-shader matrix:
  `../evidence/current/shader-224-live-pass-matrix/`.
- Three-native production-shape review:
  `../evidence/current/shader-226-production-shape/`.

The original non-shader base runner is
`scripts/flat/experimental/bruneton-start-fresh.js`; use it as an oracle only.
The maintained shared POC modules under `shared/algorithm32/POC/` are the
system under test for Milestones 1 through 6.

Do not depend on uncopied `tmp/atmosphere` artifacts for acceptance unless the
milestone deliberately regenerates a fresh artifact in
`tmp/atmosphere/local-second-order/` and records that provenance.

### Iteration And Artifact Rules

- Work one numbered artifact at a time under the lane output root.
- Artifact numbering is append-only: inspect existing `NNN-*` folders, choose
  `max(existing NNN) + 1`, and never overwrite an existing artifact.
- Every artifact must declare its state goal before the run and end as
  `accepted`, `rejected`, `superseded`, or `blocked`.
- Rejected or superseded artifacts stay visible in the sequence. A failed
  artifact must lead to the next diagnostic artifact when the next step is
  clear.
- The output root must contain an append-only `running-log.md`. Treat that
  log as the compact cross-artifact narrative for future agents.
- Each run must record enough inputs, provenance, criteria, diagnostics, and
  implementation version data that a compacted agent can understand what was
  tested without rereading temporary scripts.

### Validation Tiers

Use the objective-success-criteria tiering from the object-color lane:

1. hard transport identities;
2. objective demonstration checks;
3. convergence-backed numerical thresholds;
4. display-only subjective checks.

For this lane, hard checks include composition identities, finite/nonnegative
radiance where expected, transmittance bounds, source-kind ownership, cache-key
ownership, no-atmosphere passthrough, and distant-control parity.

Demonstration checks include local `L2` being nonzero and attributable,
closest-vs-`90` degree local source trends, source direction/distance/incident
scale changing with orbit position, and CPU/GPU diagnostics agreeing on the
same configured source/cache sample.

Convergence checks must compare the local direct oracle against the local
cache, and must label arbitrary tolerances as experiment thresholds rather
than physics constants.

Subjective images are required for human review, but they do not replace the
machine-readable criteria unless a milestone explicitly defines visual
acceptance.

Criterion statuses must use the shared vocabulary:

- `pass`: evaluated and within the stated threshold;
- `fail`: evaluated and outside the stated threshold;
- `unresolved`: data exists, but the effect is smaller than current numerical
  error or a needed convergence run has not happened;
- `not-applicable`: outside the current milestone scope.

### Tolerance Policy

Use the copied evidence artifact's own `criteria-results.json` thresholds when
they exist. If a milestone must introduce a new extraction-parity tolerance,
record it in `equations-and-constants.json` and `report.md` before evaluating
the result.

Default extraction gates when no copied criterion exists:

- normalized direction component max absolute delta: `<= 1e-12`;
- unit-vector angle delta: `<= 1e-9 deg`;
- scalar source/config values: exact JSON equality unless the value is a
  floating result of the extracted algorithm;
- floating radiance/transmittance diagnostics: absolute delta `<= 1e-12` or
  relative delta `<= 1e-9`, whichever is less strict near zero;
- CPU display RGBA byte parity: exact unless comparing against a browser/GPU
  render path;
- browser/GPU display RGBA byte parity: `maxAbsRgbDelta <= 1` only when the
  milestone explicitly names browser/GPU parity.

Do not loosen a threshold to make an artifact pass. If a copied evidence file
does not contain enough data for a claimed pass, mark the criterion
`unresolved` or generate a fresh local-second-order artifact.

### Source, Geometry, And Cache Rules

- Use the accepted distant Sun as the regression oracle before every
  local-source/cache change.
- Keep the Algorithm32 accumulator source-neutral. Source-specific behavior
  belongs in source objects, geometry helpers, incident-field implementations,
  or cache-plan adapters.
- Missing or unsupported source/geometry/cache combinations must fail loudly.
  Do not fall back to the default high Sun, distant cache, or first-order-only
  local source when a milestone requests local `L2`.
- Runtime source configurations may be behavior-bearing objects, but artifacts,
  cache keys, and reports must serialize the canonical input data needed to
  reproduce them.
- Cache keys must include every source, geometry, profile, spectral, numerical,
  and cache-resolution input that can change the stored incident field.
- A stale cache must be rejected or explicitly superseded; it must not be
  silently reused after the source or cache configuration changes.
- Direct trace is the oracle. Cache-builder results and shader sampling are
  optimized approximations that must be compared back to direct trace or the
  accepted CPU soft-shader oracle.
- Local Sun source falloff and source-path transmittance must be recorded as
  separate diagnostics. Do not hide inverse-square falloff inside extinction,
  optical depth, exposure, or RGB display tuning.
- Flat skydome ray limits remain renderer-owned. Scene traces must get their
  view segment length from scene geometry/depth, and local source-path
  transmittance must use the configured flat atmosphere geometry and finite
  source distance.

### Scene, Shader, And Lighting Rules

- The CPU soft shader and integrated GPU shader must consume the same logical
  inputs: scene color, depth or hit distance, hit mask, camera/ray data,
  geometry configuration, source configuration, cache configuration, numerical
  policy, display policy, and diagnostics policy.
- JSON scene packets are oracle/debug artifacts only. The production-shaped GPU
  target is the Three-native atmosphere pass over live scene color and depth
  render targets.
- Three lighting and Algorithm32 scattering must be driven by the same source
  configuration. A distant source maps to `DirectionalLight`; a local finite
  source maps to `PointLight` or a recorded proxy light adapter if Three's
  physical scale is impractical.
- Algorithm32 source sampling remains authoritative for atmosphere. A Three
  light or proxy transform may help render surface lighting and shadows, but
  it must not replace the configured source position, distance, falloff, or
  source-path transmittance used by transport.
- No-atmosphere passthrough and unlit parity must be proven before lit/shadow
  composition. Lit/shadow tests must show shadows remain darker after
  atmosphere composition.
- Selected diagnostics and full-image diffs both matter. Selected diagnostics
  explain the physics path; full-image deltas prove the shader is not only
  correct at handpicked pixels.

### Display And Reporting Rules

- Spectral or transport-domain values are the proof. PNGs and galleries are
  review aids generated from recorded data.
- Use one fixed display mapping for comparable images in a single artifact. If
  an auto-exposure or alternate tone-map image is useful, label it display-only.
- Do not use hidden RGB grading, image-space darkening, or per-case exposure
  changes to make local Sun results look plausible.
- Every numeric scalar or array must record units and whether it is
  source-backed, inherited from the accepted POC, or an algorithmic stress
  control.

## Matrix Cases

Use a small fixed matrix so every milestone can converge toward the same final
proof set:

- distant midday control;
- distant sunset behind camera control;
- local closest approach;
- local `90` degree orbit position.

For local-source extraction parity in Milestone 4, also include local `45`,
`135`, and `180` degree orbit positions because checked-in evidence already
exists for those source samples. For local second-order implementation
Milestones 7 through 11, the required matrix is the four-case list above.

Milestones 9 through 11 must output both first-order-only and
first-plus-second-order local images so the contribution of local `L2` is
visible. Earlier milestones must emit images only when they are part of the
milestone's evidence.

## Expected Artifact Shape

Each accepted physics run must produce enough data for both machine review and human
inspection:

```text
tmp/atmosphere/local-second-order/NNN-label/
  state-goal.md
  inputs.json
  provenance.json
  equations-and-constants.json
  source-config.json
  cache-config.json
  scene-config.json
  criteria-results.json
  report.md
  run.log
  diagnostics/
    selected-pixels.json
    source-sample-trace.json
    cache-sample-trace.json
    l1-l2-summary.json
  images/
    distant-midday/
    distant-sunset-behind-camera/
    local-closest/
    local-090deg/
    gallery.png
```

The output root should also contain:

```text
tmp/atmosphere/local-second-order/running-log.md
```

The browser-smoke preflight artifact is a harness artifact, not a physics
artifact. It does not need `source-config.json`, `cache-config.json`,
`scene-config.json`, `l1-l2-summary.json`, or `images/`. It must include
`state-goal.md`, `inputs.json`, `provenance.json`,
`equations-and-constants.json`, `criteria-results.json`, `report.md`,
`run.log`, `console.json`, `diagnostics.json`, `selected-pixels.json`,
`screenshot.png`, `canvas-image.png`, and a root `running-log.md` entry.

## Proof Families

Across Milestones 1 through 12, objective criteria must cover:

- original-base-module-matches-source-runner-or-accepted-evidence;
- cpu-transport-module-matches-accepted-shader-lab-reference;
- soft-shader-module-matches-accepted-postprocessor behavior;
- flat-local-source-module-matches-accepted-atmosflat behavior;
- three-pass-module-matches-accepted-integrated-pass contract;
- distant-control-unchanged;
- local-direct-oracle-finite;
- local-grid-cache-approximates-direct-oracle;
- local-l2-nonzero;
- same-second-order-accumulator-used;
- source-kind-not-defaulted;
- cache-key-includes-source-config;
- stale or missing cache fails loudly;
- CPU soft-shader finite and bounded;
- integrated GPU finite and bounded;
- selected `L2` diagnostics match CPU reference within tolerance;
- full-image CPU soft-shader vs integrated GPU delta within tolerance.

Milestone 11 subjective outputs must include compact side-by-side galleries
for:

- distant midday;
- distant sunset behind camera;
- local closest approach;
- local `90` degree orbit.

Preferred per-case layout:

```text
first-order CPU | second-order CPU | integrated GPU second-order | CPU/GPU diff
```

## Milestones

### Milestone 0: Centralized POC Extraction

Goal: prove the accepted POC implementations can be imported from
`shared/algorithm32/POC/` before building the local second-order lane, without
depending on old runner side effects.

Required contents:

- source/geometry and source-packet factories for distant directional Sun and
  flat/local point Sun;
- pared-down module for the original non-shader `bruneton-start-fresh` base
  algorithm;
- pure CPU Algorithm32 transport;
- pure CPU soft-shader postprocessor;
- importable Three-native `Algorithm32AtmospherePass` POC source and shader
  strings;
- pure `atmosflat32` flat/local source and first-order transport helpers;
- compatibility re-export shims for the old runner filenames.

Acceptance:

- `node --check` passes for every centralized POC JavaScript entry;
- `node shared/algorithm32/POC/validate-poc-imports.js` returns `status: ok`;
- distant source samples report infinite distance;
- local source samples report finite distance;
- original `bruneton-start-fresh` base radiance executes with finite spectral
  output;
- the CPU soft-shader export is available;
- the `atmosflat32` local source factory and single-scattering transport export
  are available;
- CPU distant radiance, flat/local single scattering, and one-pixel soft-shader
  execution are finite;
- the preserved Three-native pass exports an importable
  `Algorithm32AtmospherePass` class.

### Milestone 1: Original Base Algorithm Parity

Goal: prove the pared-down
`shared/algorithm32/POC/bruneton-start-fresh/` module still represents the
original non-shader Algorithm32 base algorithm.

Compare the shared module against the original
`scripts/flat/experimental/bruneton-start-fresh.js` runner. If the original
runner cannot be executed cleanly as an oracle, use checked-in evidence from
`../evidence/current/atmosflat-019-distant-baseline/` plus
`../experiment-032-algorithm.md`, and record that fallback in `provenance.json`.
The new lane must not copy runner code into the lane.

Validation cases:

- Figure 1 high-Sun scene `figure1-13h15-z21`;
- Figure 1 low-Sun scene `figure1-06h00-z87`;
- selected fisheye samples in the base runner frame: zenith `[0, 0, 1]`,
  horizon-forward `[0, 1, 0]`, horizon-side `[1, 0, 0]`, and mid-sky
  normalized `[0, 1, 1]`;
- first-order-only and accepted base second-order mode.

Acceptance:

- scene ids, Sun directions, atmosphere constants, spectral channels, and
  display tone-map policy match the original base profile;
- selected spectral radiance samples match the original runner/evidence within
  the evidence artifact's tolerance or the default extraction tolerance policy
  above;
- selected display RGB samples match within the evidence artifact's tolerance
  or the default extraction tolerance policy above;
- second-order incident-cache key shape is the original distant
  altitude/direction cache, not the future local cache;
- no artifact-generation, PNG-writing, CLI, or `main()` runner behavior is
  required by the shared module.

### Milestone 2: CPU Transport Module Parity

Goal: prove `shared/algorithm32/POC/cpu/algorithm32-transport.js` still matches
the accepted shader-lab CPU reference behavior it was extracted from.

Compare against preserved shader-lab evidence from
`../evidence/current/shader-078-cpu-local-source/`, especially the
`001-distant-sun-regression-control` case, and against
`../evidence/current/shader-094-cpu-soft-shader-matrix/` for distant high/low
source behavior. If the old `node-three-reference.js` runner is invoked, use
it only as an oracle. The shared module is the system under test.

Validation cases:

- distant midday control;
- distant sunset control;
- simple card hit path;
- sky path;
- first-order-only and Algorithm32 second-order distant mode.

Acceptance:

- selected transfer diagnostics match the evidence artifact's recorded CPU
  reference tolerance, or the default extraction tolerance policy above when
  the evidence lacks a threshold;
- path radiance, first-order, second-order, optical depth, and transmittance
  fields are present and finite;
- default distant-Sun output remains stable;
- the source/geometry model is supplied through configuration objects;
- the validation artifact records any tolerance as extraction/roundoff
  tolerance, not a new physics allowance.

### Milestone 3: CPU Soft-Shader Module Parity

Goal: prove `shared/algorithm32/POC/cpu/soft-shader.js` still matches the
accepted CPU postprocessor behavior.

The shared soft shader must process scene packets as:

```text
if sky:
  final = L_path
if hit:
  final = sceneColor * T_view + L_path
```

Validation cases:

- one-pixel smoke case from `validate-poc-imports.js`;
- accepted unlit packet parity case;
- accepted lit/shadow packet case;
- local first-order packet case from
  `../evidence/current/shader-094-cpu-soft-shader-matrix/`.

Acceptance:

- no-atmosphere passthrough remains exact for packet scene color;
- unlit/material-control behavior matches the accepted reference;
- lit/shadow separation is preserved after atmosphere composition;
- selected diagnostics expose hit/sky classification, hit distance, scene
  color, postprocess color, and transfer summary;
- no dependency on artifact folder creation or browser runner state.

### Milestone 4: Flat/Local Source Module Parity

Goal: prove `shared/algorithm32/POC/atmosflat32/local-sun.js` still matches the
accepted `atmosflat32` local-source behavior.

Validation cases:

- distant-source abstraction control;
- local closest approach;
- local `90` degree orbit position;
- local `45`, `135`, and `180` degree positions for source-sample trend
  checks.

Acceptance:

- local source position, observer direction, source distance, apparent angular
  radius, incident scale, distance falloff, and spectral scale match
  `../evidence/current/atmosflat-018-local-skydomes/` within that artifact's
  recorded tolerance or the default extraction tolerance policy above;
- single-scattering radiance is finite for the closest and `90` degree cases;
- closest remains brighter than farther orbit positions under the accepted
  configuration;
- local source-path transmittance is computed from configured geometry and
  source distance;
- no flat/local behavior is hard-coded into the main CPU transport integrator.

### Milestone 5: Three Pass Module Parity

Goal: prove `shared/algorithm32/POC/three/shader-lab-page.js` still represents
the accepted Three-native `Algorithm32AtmospherePass` POC contract after the
shader-lab page harness was removed.

Static/import checks and browser render checks are both required for
acceptance. The browser check must use the local lane harness under
`scripts/flat/local-second-order/`, not the shader-lab watch runner. If the
browser harness smoke preflight is blocked, this milestone is blocked rather
than accepted as static-only.

Validation cases:

- import/static pass contract check;
- identity pass over live Three color/depth target;
- depth-distance debug mode;
- distant first-order atmosphere mode;
- flat/local first-order atmosphere mode.

Acceptance:

- exported `Algorithm32AtmospherePass` class exists and constructs in a
  browser/Three context;
- uniforms and pass modes match the accepted integrated-pass contract;
- depth reconstruction remains compatible with Three color/depth render
  targets;
- distant and flat/local first-order shader bodies are present, rendered
  through the local lane browser harness, and selected diagnostics match
  `../evidence/current/shader-220-three-local/` or
  `../evidence/current/shader-224-live-pass-matrix/` within the recorded
  tolerance;
- JSON packet replay is not treated as the normal production path.

### Milestone 6: Shared POC Validation Closeout

Goal: produce a short validation report that declares the shared POC modules
ready to serve as the implementation basis for local second-order experiments.

Acceptance:

- Milestones 1 through 5 have accepted artifacts;
- the report identifies the shared module paths that future milestones must
  import;
- the report lists any tolerated extraction deltas;
- the report forbids copying old noisy runners into the new lane;
- the next milestone is cleared to begin local incident-field work.

### Milestone 7: Local Incident-Field Oracle

Goal: define the local Sun second-order input without changing the primary
Algorithm32 path-integral algorithm.

Implement an `incidentField.sample(position, incomingDirection, wavelength)`
interface outside the main algorithm. For distant Sun it must wrap the
existing distant altitude/direction cache contract. For local Sun the first
accepted implementation must be a direct oracle: trace the first-order
local-source radiance along the incoming ray using the same source abstraction
and flat geometry already proven in the centralized POC code.

Acceptance:

- distant controls are unchanged against the accepted POC reference;
- local closest and local `90` degree cases produce finite oracle samples;
- source kind, source position/direction, incident scale, and source-path
  transmittance come from configuration rather than hard-coded branches;
- the primary Algorithm32 accumulator consumes only the incident-field
  interface.

### Milestone 8: Local Cache Shape

Goal: prove a cacheable local incident field.

Use local cache coordinates:

```text
z, rho, incomingDirection, wavelength
```

Where `z` is altitude, `rho` is horizontal distance from the local Sun
subpoint on the flat plane, `incomingDirection` uses the same sign convention
as the distant-Sun cache, and `wavelength` is the Algorithm32 spectral channel.
Invalid regions should fail loudly or report a marked invalid sample, not
silently fall back to distant Sun behavior.

`rho` is measured on the flat `x/y` ground plane from the sample position to
the local Sun subpoint. It is not the 3D distance to the Sun. Invalid regions
include `z` outside the flat atmosphere height range, `rho` outside the cache
range, non-finite or unnormalized incoming directions, wavelengths outside the
active spectral grid, source/cache key mismatches, and stale cache data.

Accepted refinement from `011-local-cache-shape`: the cached
`incomingDirection` is not a raw world-space vector. It is stored in the
Sun-subpoint local radial/tangential/up frame for the sample's `rho`, with the
same ray-direction sign convention as Algorithm32. Artifact
`010-local-cache-shape` rejected the raw-world-vector version because equal
`rho` samples at different azimuths did not match the direct oracle.

The cache builder lives outside the primary algorithms. Milestone 8 acceptance
requires an explicit CPU grid cache with serializable dimensions, ranges,
direction set, wavelength set, source key, cache key, and lookup policy. Lazy
memoization may be used while developing the artifact, but a lazy-only cache is
not accepted for Milestone 8.

Acceptance:

- cache keys include source configuration and cache configuration;
- stale or missing caches fail loudly;
- a sign-convention probe records the sampled `incomingDirection`, the
  direction used by the distant cache wrapper, and the local source/sample
  geometry; shader coordinate conversion must not silently flip this sign;
- local cache samples approximate the direct oracle within a threshold recorded
  before evaluation in `equations-and-constants.json`;
- the second-order accumulator is identical after the cache lookup for local
  and distant Sun.

### Milestone 9: CPU Soft-Shader Local L2

Goal: run the scene-level CPU soft shader with local first-plus-second-order
scattering.

Use the centralized CPU soft-shader POC as the starting point. Preserve the
existing distant controls, then add local incident-field support through the
same scene/source packet contract.

Acceptance:

- distant midday and distant sunset controls remain within accepted POC
  tolerance;
- local closest and local `90` degree cases are finite and bounded;
- selected diagnostics expose `L1`, `L2`, transmittance, source sample, and
  cache sample data;
- first-order-only and first-plus-second-order images are generated for local
  cases;
- no production tests are required; numbered experiment criteria and artifacts
  are the proof for this POC lane.

### Milestone 10: Three-Integrated GPU Shader Local L2

Goal: implement the local second-order cache lookup in the Three-native
integrated atmosphere pass, skipping the standalone packet/postprocess GPU
path.

Current status: accepted by `020-three-integrated-gpu-local-l2`, using browser
evidence from `018-three-integrated-local-l2-probe` and
`019-three-integrated-local-l2-probe`. The old blocker
`013-three-integrated-gpu-local-l2-blocked` is retained only as history. The
centralized Three pass now exposes `flat-local-second-order-atmosphere`, local
incident cache uniforms, `Data3DTexture` upload/packing, and GLSL lookup in the
Sun-subpoint local radial/tangential/up frame.

Resolution plan:

1. Extract the accepted Milestone 8 CPU cache shape into a reusable POC helper
   that can be imported by both the CPU soft-shader proof and the browser/GPU
   command. The logical cache remains:

   ```text
   z, rho, incomingDirectionLocalFrame, wavelength
   ```

   The cache key must include source config, geometry config, spectral grid,
   numerical controls, cache resolution, incoming-direction set, and packing
   version.
2. Add a GPU cache packer for the same logical cache. The preferred POC
   storage is WebGL2/Three `Data3DTexture`; if that is blocked by the browser
   environment, record a blocked artifact before switching to a 2D atlas. A 2D
   atlas is allowed only as an equivalent packing of the same logical
   coordinates.
3. Pack the 15 spectral channels into recorded texture groups. Preferred POC
   layout: RGBA groups for wavelengths, with an explicit mapping such as
   `group0 = channels 0..3`, `group1 = channels 4..7`,
   `group2 = channels 8..11`, and `group3 = channels 12..14 plus padding`.
   The exact packing belongs in `cache-config.json`.
4. Extend `Algorithm32AtmospherePass` with a new
   `flat-local-second-order-atmosphere` mode and uniforms for:

   - local incident cache texture or atlas texture;
   - cache dimensions and bin ranges for `z`, `rho`, direction, and spectral
     group;
   - source key/cache key metadata used by diagnostics;
   - local source position and source radiance/falloff config;
   - debug switches for cache coordinates, sampled incident radiance, `L1`,
     `L2`, and final composition.

5. Port the accepted Milestone 8 lookup into GLSL:

   - compute sample altitude `z`;
   - compute `rho` as horizontal distance from the local Sun subpoint;
   - convert the world-space incoming direction into the Sun-subpoint local
     radial/tangential/up frame;
   - choose the POC nearest-neighbor cache bin unless a recorded interpolation
     policy is explicitly added;
   - sample the packed spectral incident radiance;
   - feed that `L1_incident` into the same second-order accumulator shape
     proven by the CPU path.

6. Add a local browser command type behind the existing long-lived harness,
   for example `three-integrated-local-l2`. It must render through the
   Three-native pass over live Three scene color and depth targets, not JSON
   packet replay.
7. Compare the integrated GPU output against the accepted CPU soft-shader
   reference from Milestone 9 for the required matrix. The shader must fail
   loudly if L2 is requested without a cache, with a stale cache key, or with
   a source/cache mismatch.

Use the same logical cache contract as the CPU soft shader. The GPU work is
packing, upload, coordinate conversion, GLSL lookup, and validation against
the CPU oracle; it must not introduce new scattering physics. The default POC
GPU packing is WebGL2/Three 3D texture storage. Pack `z`, `rho`, and
`incomingDirectionIndex` as texture coordinates, and pack spectral channels
into one or more texture values/textures with the mapping recorded in
`cache-config.json`.

Acceptance:

- a reusable CPU/GPU cache config object records logical dimensions, source
  key, cache key, spectral packing, and invalid-region policy;
- the cache packer writes a `Data3DTexture` or explicitly equivalent 2D atlas
  from the accepted CPU cache values;
- `Algorithm32AtmospherePass` exposes and uses a
  `flat-local-second-order-atmosphere` mode;
- the shader computes `z`, `rho`, and Sun-subpoint local-frame incoming
  direction consistently with `011-local-cache-shape`;
- the integrated shader still supports distant Sun controls;
- local closest and local `90` degree cases use the local cache path;
- selected GPU diagnostics match the CPU soft-shader reference within recorded
  tolerance;
- scene color/depth inputs still come from the live Three render path;
- no silent fallback to first-order-only local Sun, default distant Sun, stale
  cache, or raw world-direction cache is allowed when L2 is requested.

### Milestone 11: Objective And Subjective Matrix

Goal: close the lane with the same style of proof as the shader lab.

Current status: accepted by `021-objective-subjective-local-l2-matrix`.
Closest and local `90` integrated GPU selected-center diagnostics match the
CPU source-looking oracle within `0` and `2` RGB bytes respectively. The
artifact copies CPU control images and local integrated GPU review images into
its `images/` folder.

Required matrix:

- distant midday;
- distant sunset behind camera;
- local closest approach;
- local `90` degree orbit.

Each case must produce:

- source/geometry/cache configs;
- GPU cache packing config;
- selected-pixel diagnostics;
- source and cache sample traces;
- CPU soft-shader output;
- integrated GPU shader output;
- full-image CPU-vs-GPU diff metrics;
- compact subjective galleries.

Preferred subjective gallery layout:

```text
first-order CPU | second-order CPU | integrated GPU second-order | CPU/GPU diff
```

Acceptance:

- distant controls remain stable;
- local `L2` contribution is nonzero and explainable;
- CPU/GPU selected diagnostics match tolerance;
- full-image deltas are recorded and either accepted or explained;
- subjective images are generated for human review.

### Milestone 12: Promotion Notes

Goal: produce the handoff for production Algorithm32 work.

Current status: accepted by `022-promotion-notes`. Production-facing promotion
notes are recorded in `agents/topics/apps/flat/algorithm32/README.md`; the
cleanroom lane remains the POC evidence tracker.

Record:

- the final incident-field interface;
- local cache dimensions and invalid-region behavior;
- CPU cache builder shape;
- GPU texture/uniform packing shape, including whether the accepted POC used
  `Data3DTexture` or a 2D atlas;
- source configuration requirements;
- scene/debug diagnostics needed by production validation;
- known limitations and unresolved questions.

Acceptance:

- production docs under `agents/topics/apps/flat/algorithm32/` identify what
  can be promoted into `shared/algorithm32/`;
- cleanroom docs keep POC evidence and avoid becoming the production source of
  truth;
- open questions are explicit enough for the next production pass.

### Milestone 13: three.terrain.js Subjective Terrain Spike

Goal: improve the subjective mountain scene detail without changing
Algorithm32, the CPU soft shader, the local second-order cache contract, or
the scene packet/atmosphere composition path.

Current status:

- Initial focused spike accepted by
  `tmp/atmosphere/local-second-order/037-three-terrain-integrated-distant-midday/`.
- The accepted command type is `three-terrain-integrated-distant-midday`.
- It renders only the distant-midday case at `320 x 180` through the integrated
  `Algorithm32AtmospherePass` using `distant-first-order-atmosphere`.
- Criteria passed `10/10`: package backend used, integrated pass mode present,
  sparse coverage found both sky and terrain-hit samples, scene render target
  was nonzero, final image was finite/nonblank, selected pixels were finite,
  and the harness recorded no page/fatal errors.
- Output image:

  ```text
  tmp/atmosphere/local-second-order/037-three-terrain-integrated-distant-midday/canvas-image.png
  ```

- Implementation note: the first package attempt created partial folder `035`
  because full-pixel raycasting against the denser package terrain wedged the
  launcher. The accepted path uses a sparse coverage summary for
  integrated-shader-only spikes. Keep full per-pixel scene packets for the
  manual-heightfield soft-shader control path or for lower-resolution package
  comparison runs.
- Follow-up `040-three-terrain-integrated-distant-midday-wide-v3-480`
  accepted a richer package preset with `TerrainNS.PerlinLayers`,
  `ridge-valley-v2` after shaping, height/slope vertex colors, and a
  pulled-back wide camera. It passed `10/10`, but the camera height was
  `10500 m`, which visibly exposed the spherical-atmosphere horizon curvature.
- Follow-up `041-three-terrain-integrated-distant-midday-low-camera` accepted
  the same richer preset with the camera near the terrain start:

  ```text
  cameraPositionMeters: [0, 1200, 5200]
  lookAtMeters: [0, 1550, -36000]
  verticalFovDegrees: 58
  ```

  It passed `10/10` and moved terrain hit distances to `2.6-15.9 km`. It is
  the current accepted low-camera package-terrain image, but it still reads
  visually flat. Future terrain work should add real foreground/midground
  detail, texture/scatter, or stronger silhouettes rather than only changing
  procedural height noise.
- Follow-up `042-three-terrain-integrated-distant-midday-detail-v4` accepted
  the current detail update. It keeps the `041` low camera, adds a repeated
  deterministic surface texture, and adds one merged surface-detail mesh with
  `180` outcrops (`1,137` triangles) to the `three-terrain-js` scene before
  rendering through the integrated distant-midday pass. Criteria passed
  `10/10`; this is the current package-terrain subjective reference.
- Follow-up `044-three-terrain-integrated-distant-midday-ridge-lines-v6`
  supersedes `042` as the current package-terrain subjective reference. It
  raises the camera to `[0, 4200, 9800]`, looks toward `[0, 3900, -52000]`,
  widens FOV to `62 deg`, and strengthens the raised ridge-line strips so the
  view can see beyond the first foreground ridge. Criteria passed `10/10`;
  diagnostics record `14` ridge-line strips, `180` outcrops, and a merged
  detail mesh with `2,680` triangles.
- Follow-up `047-rocky-land-heightmap-integrated-distant-midday-v3` is the
  current accepted non-package asset terrain option. It uses the existing
  browser command with:

  ```json
  {
    "type": "three-terrain-integrated-distant-midday",
    "payload": {
      "terrainBackend": "rocky-land-heightmap",
      "terrainSeed": "rocky-land-and-rivers-heightmap-v1"
    }
  }
  ```

  The source asset is `Designs/landscapes/Rocky Land and Rivers.zip`; the
  CC0 height map PNG is copied for the browser page at
  `scripts/flat/local-second-order/page/assets/rocky-land-and-rivers/Height Map PNG.png`.
  The POC samples browser `getImageData` RGBA8 values from the original
  16-bit PNG, normalizes the sampled grid, builds one Three `BufferGeometry`,
  and keeps the same live scene/depth/integrated-pass path as the package
  backend. `047` passed `11/11` criteria with `36,864` vertices and `72,962`
  triangles, including a selected sparse hit on
  `rocky-land-and-rivers-heightmap-terrain`. `045` is superseded because its
  first camera/extent setup still let lower foreground rays hit the simple
  catch plane, and `046` is superseded by the same image with the stronger
  terrain-mesh-hit criterion.

Use the npm package `three.terrain.js` as an optional terrain backend in the
local second-order lane. The package to evaluate is exactly:

```text
three.terrain.js
```

Known package facts from the preflight review:

- latest checked version: `3.0.0`;
- package exports an ES module from `dist/three.terrain.js`;
- peer dependency is `three >=0.160.0`, compatible with the repo's current
  Three `0.180.0`;
- default export `Terrain` builds a terrain object;
- `TerrainNS` exposes procedural generators and helpers such as
  `DiamondSquare`, smoothing, scatter helpers, and blended material support;
- the terrain geometry can be reached from `terrainScene.children[0].geometry`.

Implementation shape:

1. Add `three.terrain.js` as an experiment dependency only when starting this
   milestone.
2. Add a terrain backend option to the local subjective scene path, for
   example:

   ```text
   manual-heightfield
   three-terrain-js
   rocky-land-heightmap
   ```

3. Keep `manual-heightfield` as the control backend so artifact `030` can be
   reproduced and compared.
4. Build the `three-terrain-js` backend inside
   `scripts/flat/local-second-order/`, preferably by adding a focused helper
   rather than mixing package-specific code into Algorithm32 or the cache
   modules.
5. Use the existing local browser command flow:

   ```text
   Three lit scene -> sceneColor/rays/hit distances -> CPU soft shader
   ```

   The shader/cache inputs and output comparison remain unchanged.
6. Preserve source-driven Three lighting: distant cases use a white
   `DirectionalLight`, local cases use a white source-position `PointLight`
   with the same brightness policy accepted in the prior subjective scenes.
7. Preserve the broad bottom ground plane or an equivalent far-ground catch
   surface so rays beyond the finite terrain mesh hit scene geometry instead
   of becoming sky.

Coordinate and determinism rules:

- Maintain the accepted elevated subjective camera unless the artifact records
  an explicit visual-composition reason to change it:

  ```text
  cameraPositionMeters: [0, 6200, 1400]
  lookAtMeters: [0, 6200, -15000]
  ```

- Treat `src/gc/utils/random.js` as the deterministic source of truth for
  experiment seeds. If `three.terrain.js` only accepts `Math.random`-style
  callbacks for a selected helper, wrap the repo RNG or record exactly where a
  package-internal RNG could not be controlled.
- Resolve the terrain coordinate mapping explicitly. The likely mapping for a
  package terrain plane is:

  ```text
  package x -> Three scene x
  package height/up -> Three scene y
  package y/depth -> Three scene z
  ```

  Record the actual mapping in `scene-config.json` or equivalent artifact
  diagnostics. Do not silently flip axes to make the picture look better.
- The terrain must produce ordinary Three meshes or geometry that participate
  in normal Three rendering, raycasting, scene-color capture, and depth/hit
  diagnostics.

Required matrix:

- distant midday;
- distant sunset behind camera;
- local closest approach;
- local `90` degree orbit.

Required outputs:

- one accepted artifact under `tmp/atmosphere/local-second-order/`;
- per-case scene-color PNGs;
- per-case first-order and second-order/cache soft-shader PNGs;
- per-case side-by-side panels;
- one compact gallery for the four scenes;
- source/geometry/light packets;
- terrain backend/config diagnostics;
- selected-pixel diagnostics;
- criteria-results and report files.

Acceptance:

- package import works in the local browser harness;
- the `three-terrain-js` backend renders finite scene color for all four cases;
- every case has both sky pixels and hit pixels;
- every case uses the same scene packet and CPU soft-shader comparison path as
  artifact `030`;
- local closest and local `90` with-cache images use
  `local-grid-first-order-incident-field`;
- local closest and local `90` show a nonzero image delta between first-order
  and second-order/cache images;
- rerunning the same seed produces stable terrain diagnostics, including at
  least vertex/triangle counts and skyline/hit counts;
- the report compares the new terrain-backend skyline/hit counts against the
  accepted manual-heightfield control from `030`;
- no production code or production tests are required for this POC milestone.

Blocking conditions:

- If `three.terrain.js` cannot be imported in the harness after installation,
  record a rejected or blocked artifact before trying a different package.
- If package randomness cannot be made deterministic enough for repeatable
  subjective artifacts, record the limitation and keep `manual-heightfield` as
  the accepted control.
- If the generated terrain cannot provide raycast hits compatible with the
  scene packet contract, do not patch around it in Algorithm32; fix or reject
  the terrain backend.

### Milestone 14: Southern France OBJ Asset Preflight And Staging

Goal: make the Blender OBJ terrain package available to the local lane as a
tracked POC asset candidate without changing Algorithm32, the local
second-order cache, or the existing terrain backends.

Use this source package:

```text
Designs/landscapes/uploads_files_2061262_Mountain+Range+in+Southern+France_Blender_OBJ.zip
```

Known preflight facts from local inspection:

- it is the same geometry as the 3D Coat OBJ package;
- zip size is about `159.39 MB`;
- OBJ size is about `22.15 MB`;
- geometry has `268,472` vertices and `122,937` triangle faces;
- all faces are triangles;
- it has `207` groups/material switches and `28` materials;
- bounds are approximately:

  ```text
  x: -164125.0625 to 100434.75
  y: -112238.882813 to 114357.015625
  z: -10594.121094 to 43008.707031
  ```

- the mesh is exported as Z-up terrain, while the lane Three scene is Y-up;
- the Blender `.mtl` references `84` texture files and all `84` are present;
- the referenced texture maps are `28` diffuse, `28` roughness, and `28`
  normal-map files;
- the zip also contains `28` emissive and `28` reflection maps that are not
  referenced by the `.mtl`;
- no readme/license file was found in the zip during local inspection.

Stage only the files needed for the current POC step under the lane page
assets directory, for example:

```text
scripts/flat/local-second-order/page/assets/southern-france-blender-obj/
```

For the first accepted staging artifact, prefer:

- the OBJ file;
- a generated or copied material summary JSON;
- the original MTL for provenance;
- no textures yet, unless the implementation step needs them.

Do not extract the full expanded texture set into the page assets folder until
a milestone explicitly needs it. The diffuse textures alone are large enough
to affect browser load time, so texture staging must be a deliberate artifact.

Acceptance:

- a numbered artifact records the zip file name, size, entry inventory,
  mesh counts, bounds, material count, texture-reference completeness, and
  Z-up to Y-up mapping decision;
- the staged asset list is explicit and does not require a future agent to
  inspect the source zip again;
- the report states that the Blender OBJ package is preferred over the
  3D Coat OBJ package because the Blender MTL has `0` missing referenced
  texture files;
- the implementation plan keeps this as a terrain backend only and makes no
  Algorithm32/cache changes.

### Milestone 15: Southern France OBJ Geometry Backend

Goal: prove the Southern France OBJ can act as a live Three terrain backend
using geometry only, before adding material texture complexity.

Current status: accepted by
`tmp/atmosphere/local-second-order/048-southern-france-obj-geometry-distant-midday/`.
The artifact stages only the OBJ and MTL, loads the OBJ with Three
`OBJLoader`, applies one matte material, remaps source Z-up terrain to the
lane Y-up scene, renders through the integrated distant-midday
`Algorithm32AtmospherePass`, and passes `11/11` criteria including selected
sparse hits on `southern-france-obj-terrain-*` meshes. The image is
`canvas-image.png`. Milestone 16 should add diffuse texture color; do not
repeat geometry-only placement unless a later texture pass requires camera
adjustment.

Add a terrain backend value:

```text
southern-france-obj-geometry
```

Implementation shape:

1. Load the staged OBJ in the browser, preferably through Three's OBJ loader
   from the installed `three` package examples/addons path.
2. Ignore the MTL and textures for this milestone.
3. Apply one simple non-black matte material, such as a muted green/rock
   material, so the proof isolates mesh placement and atmosphere integration.
4. Convert from source Z-up to lane Y-up explicitly. Record the mapping in
   diagnostics. The expected mapping is:

   ```text
   source x -> Three x
   source y -> Three z
   source z -> Three y
   ```

   The final sign/rotation may be adjusted only with a recorded composition
   reason; do not silently flip axes.
5. Center and scale the mesh into the existing subjective scene. Record the
   translation, scale, and camera profile. The camera should start near the
   accepted asset-terrain view rather than returning to the earlier
   aircraft-height horizon framing.
6. Keep the broad bottom catch surface behind/beyond the mesh, but add a
   criterion that at least one selected sparse ray hits the OBJ terrain mesh,
   not only the catch plane.
7. Render through the existing live Three scene color/depth target and
   integrated `Algorithm32AtmospherePass`.

The first browser command can reuse the existing distant-midday spike command
type, with a payload like:

```json
{
  "type": "three-terrain-integrated-distant-midday",
  "payload": {
    "terrainBackend": "southern-france-obj-geometry",
    "terrainSeed": "southern-france-blender-obj-v1"
  }
}
```

Acceptance:

- the backend loads from staged assets in the long-lived browser harness;
- the scene renders finite/nonblank distant-midday output through the
  integrated pass;
- sparse coverage has both sky pixels and hit pixels;
- at least one selected sparse hit names the Southern France OBJ terrain mesh;
- diagnostics record source vertex/face counts, runtime mesh counts, bounds,
  scale, translation, coordinate mapping, camera profile, and source asset
  provenance;
- page errors, fatal page events, and missing-resource errors are zero;
- the artifact image is generated for subjective review.

Blocking conditions:

- if browser OBJ parsing of the full asset is too slow or times out, record a
  rejected/blocked artifact before adding conversion or simplification;
- if OBJLoader is unavailable from the current Three package, record the
  blocker before installing or copying loader code;
- if the mesh cannot be transformed into a useful view without hiding the
  terrain behind the catch plane, record the placement diagnostics before
  changing criteria.

### Milestone 16: Southern France Diffuse-Textured Backend

Goal: address the user's stated color/detail problem by adding real diffuse
texture color to the accepted Southern France OBJ geometry path.

Current status: accepted by
`tmp/atmosphere/local-second-order/049-southern-france-obj-diffuse-distant-midday/`.
The artifact extracts the `28` diffuse TGA maps into
`scripts/flat/local-second-order/page/assets/southern-france-blender-obj/diffuse-tga-source/`,
loads them in the browser with Three `TGALoader`, assigns matched
material-specific matte `MeshStandardMaterial` instances to the `207` runtime
OBJ meshes, records `0` fallback material ids, and renders through the live
integrated distant-midday `Algorithm32AtmospherePass`. Criteria passed
`11/11`; page errors and fatal page events were `0`; runtime was about
`16.4 s`. Image:
`tmp/atmosphere/local-second-order/049-southern-france-obj-diffuse-distant-midday/canvas-image.png`.
The accepted Milestone 17 split matrix uses `southern-france-obj-diffuse`.
This remains diffuse-only POC asset plumbing: normal, roughness, emissive,
reflection maps, GLB conversion, simplification, and LOD are outside
Milestone 16.

Dark-line diagnostic status: accepted artifacts
`050-southern-france-obj-diffuse-distant-midday-2x` and
`053-southern-france-obj-diffuse-shader-off-2x` show that the recurring black
terrain dots/lines are not caused by Algorithm32 leaving some pixels uncolored.
The marks persisted at `960x540`, and they were still visible when
`Algorithm32AtmospherePass` was intentionally skipped with
`disableAtmospherePass: true`. The shader-off artifact has criterion
`atmosphere-pass-disabled-for-diagnostic` and pass mode
`scene-only-no-atmosphere`. The next useful diagnostic should stay in the
Three scene/material path: compare diffuse `MeshStandardMaterial` against an
unlit/basic diffuse material and/or average flat material colors to determine
whether the marks come from texture content, normals/lighting, or mesh seams.
The Southern France OBJ diffuse backend does not use the procedural
vertex-color path.

Follow-up isolation status: accepted artifact
`054-southern-france-obj-mesh-only-white-shader-off-2x` adds the diagnostic
payload `sceneSimplification: "mesh-only-white"` with
`terrainBackend: "southern-france-obj-geometry"` and
`disableAtmospherePass: true`. The lane page removes the bottom catch plane,
keeps the OBJ mesh unchanged, and overrides the material to one unlit white
`MeshBasicMaterial`. The image has no visible black dots/lines and records
`minByte: 135`, `maxByte: 255`, so the artifact is not caused by raw geometry
coverage or an uncolored shader output. Reintroduce material/scene factors one
at a time if continuing: catch plane, lit `MeshStandardMaterial` normals, then
diffuse textures.

Accepted artifact
`055-southern-france-obj-mesh-only-white-standard-shader-off-2x` reintroduced
the lit `MeshStandardMaterial` path while keeping the `054` simplifications:
no textures, no vertex colors, no bottom catch plane, and atmosphere disabled.
The black dots/lines returned visually, and image stats recorded `minByte: 38`
versus `054`'s `minByte: 135`. This narrows the cause to standard-material
lighting/normals for the transformed OBJ mesh. Future diagnostics should test
normal handling directly, such as flat shading, original-vs-recomputed normals,
or a controlled normal override, before returning to textures or the catch
plane.

Accepted artifact
`056-southern-france-obj-white-standard-full-ambient-shader-off-2x` tests the
light-source/fill hypothesis directly. It keeps the `055` lit white
`MeshStandardMaterial`, no textures, no vertex colors, no catch plane, and
atmosphere disabled, but raises ambient fill to `1`. The black marks are
suppressed and image stats return to `minByte: 135`, `maxByte: 255`. Treat the
current cause as low-fill standard-material lighting/normal darkness: the
dark dots are faces or interpolated normals receiving little direct light under
the prior ambient `0.06`, not an uncolored shader path.

Accepted artifact
`057-southern-france-obj-white-standard-ambient-only-shader-off-2x` disables
the source `DirectionalLight` and keeps only full ambient on the same white
`MeshStandardMaterial`. The terrain renders as uniform gray, selected terrain
sample `[153, 153, 153]`, and the dot/line pattern disappears. This confirms
the direct source light plus normals/facets are required to produce the
artifact. Future work should diagnose normals and lighting policy before
returning to textures: inspect normals visually, compare recomputed versus
source OBJ normals, compare `flatShading`, or add realistic fill/skylight.

Accepted artifact
`058-southern-france-obj-white-standard-aa-downsample-shader-off` tests the
user hypothesis that the dark facets belong to the terrain lighting but were
too harsh because they collapsed to single pixels. It keeps the `055`
source-lit `MeshStandardMaterial` setup, renders internally at `1920x1080`
with WebGL antialiasing, and downsamples to `960x540`. `minByte` remains `38`,
so the facets are still present, but the subjective image reads as plausible
terrain detail. Future subjective outputs should distinguish review-quality
sampling from model validation: antialiasing/supersampling improves display,
while normal/light diagnostics explain the underlying signal.
Accepted conclusion for this diagnostic run: the dark dots were real
source-lit terrain detail made misleading by undersampling. Subjective terrain
artifacts should use review-quality antialiasing/supersampling when judging
surface lighting detail; objective tests can still use deterministic low-cost
settings when pixel-level presentation is not under review.

Accepted artifact
`059-southern-france-obj-diffuse-aa-downsample-atmosphere` restores the full
Milestone 16 diffuse-textured path with the display policy learned from `058`:
`southern-france-obj-diffuse`, source `DirectionalLight`, integrated
`distant-first-order-atmosphere`, `rendererAntialias: true`, and
`renderScale: 2`. The accepted run has `0` page errors, `0` material fallbacks,
and `11/11` passing criteria. Treat `059` as the subjective distant-midday
diffuse reference used before the accepted four-case source matrix. Milestone
17 uses the same review-quality sampling for the four source cases.

Accepted paired review artifact
`060-southern-france-obj-diffuse-aa-downsample-shader-off` renders the same
scene as `059` with `Algorithm32AtmospherePass` disabled. It passed `11/11`
criteria, recorded `0` page errors, and writes the side-by-side comparison at:

```text
tmp/atmosphere/local-second-order/060-southern-france-obj-diffuse-aa-downsample-shader-off/with-without-shader-comparison.png
```

Accepted shadow-map visual follow-up
`061-southern-france-obj-diffuse-aa-downsample-atmosphere-shadows` keeps the
`059` shader-on terrain/camera/source setup and adds payload
`enableShadows: true` with `shadowMapSize: 4096`. It passed `12/12` criteria,
including `three-shadow-maps-enabled`; diagnostics record a directional-light
shadow map and `208` scene meshes casting/receiving shadows. Comparison:

```text
tmp/atmosphere/local-second-order/061-southern-france-obj-diffuse-aa-downsample-atmosphere-shadows/with-without-three-shadows-comparison.png
```

The visual result confirms the asset's baked shadowing conflicts with live
Three shadow maps by making the scene much darker. Future terrain asset work
should prefer albedo-like textures, unbaked diffuse maps, or a material policy
that separates color from lighting before treating cast shadows as production
quality.

Accepted close-camera follow-up artifacts `062` and `063` add a
terrain-following camera override to inspect the shadow problem near the
surface. Payload shape:

```json
{
  "cameraOverride": {
    "cameraPositionMeters": [0, 6200, 15800],
    "cameraGroundClearanceMeters": 450,
    "lookAtMeters": [0, 4200, -22000],
    "lookAtGroundClearanceMeters": 700,
    "verticalFovDegrees": 70
  }
}
```

The accepted render placed the camera at
`[0, 3157.6099179376324, 15800]`, exactly `450 m` above the terrain raycast
height. `062` used this camera with Three shadows enabled and passed `12/12`;
`063` used the same camera with shadows disabled and passed `11/11`.
Comparison:

```text
tmp/atmosphere/local-second-order/063-southern-france-obj-diffuse-close-terrain-atmosphere-no-shadows/close-terrain-with-without-shadows-comparison.png
```

Interpretation: the close no-shadow frame already exposes OBJ stepping,
striping, material patches, and baked shadow-like texture detail. Live shadows
darken and emphasize those features, so this asset remains useful for stress
diagnostics but is not yet a clean production-style shadow evaluation asset.

Accepted receive-only follow-up artifact
`064-southern-france-obj-diffuse-close-terrain-atmosphere-shadows-rec` adds:

```json
{
  "enableShadows": true,
  "shadowPolicy": "receive-only"
}
```

The terrain meshes receive shadows but do not cast them. Criteria passed
`12/12`; diagnostics record `castShadowMeshCount: 0` and
`receiveShadowMeshCount: 208`. The receive-only output is byte-for-byte
identical to the no-shadows `063` output (`maxAbsByteDelta: 0`), while
cast+receive `062` shows the dark shingle bands. Comparison:

```text
tmp/atmosphere/local-second-order/064-southern-france-obj-diffuse-close-terrain-atmosphere-shadows-rec/close-terrain-shadow-policy-comparison.png
```

Conclusion: the shingle bands are terrain self-shadowing/shadow-map acne from
the OBJ mesh under cast+receive shadow maps. They are not produced by the
Algorithm32 atmosphere pass and are not baked texture alone. Future shadow
validation should use separate caster objects over a receive-only terrain, or
an asset/material pipeline designed for clean albedo and shadow evaluation.

Accepted high-altitude receive-only follow-up
`065-southern-france-obj-diffuse-high-altitude-atmosphere-shadows-rec` repeats
the same shadow policy at the original high Southern France camera
`[0, 6200, 15800]`, without `cameraOverride`. It passed `12/12`; diagnostics
record `castShadowMeshCount: 0` and `receiveShadowMeshCount: 208`. It is
byte-identical to high no-shadows `059` (`maxAbsByteDelta: 0`). Comparison:

```text
tmp/atmosphere/local-second-order/065-southern-france-obj-diffuse-high-altitude-atmosphere-shadows-rec/high-altitude-shadow-policy-comparison.png
```

Add a terrain backend value:

```text
southern-france-obj-diffuse
```

Implementation shape:

1. Stage only the diffuse maps required by the `28` OBJ materials, plus either
   a generated diffuse-only MTL or a custom material assignment manifest. Do
   not stage normal/roughness/emissive/reflection maps for this milestone.
2. Prefer a diffuse-only material path over naïvely loading the original MTL
   if the original MTL would make the browser load roughness or normal maps.
3. Use Three's TGA loading support or convert the diffuse maps to a web-native
   format as an explicit artifact step. Record which path was used. If
   conversion is used, preserve source filenames and mapping in a manifest.
4. Keep material response simple and matte. The purpose is real terrain color,
   not PBR fidelity.
5. Keep the same geometry transform and camera profile accepted in
   Milestone 15 unless the textured result reveals a clear composition issue.

Acceptance:

- the backend renders the same Southern France OBJ geometry with diffuse
  texture color through the live integrated pass;
- every material either uses its matched diffuse texture or a recorded fallback
  material;
- no missing texture requests occur in the browser console or page errors;
- selected diagnostics still prove a real OBJ terrain mesh hit;
- image statistics show nonblank output, and the subjective image visibly has
  more color/detail than the uniform-material geometry proof;
- staged texture inventory and material mapping are recorded in diagnostics;
- the report states whether this textured backend should supersede the
  `rocky-land-heightmap` terrain option for subjective terrain review.

Blocking conditions:

- if `.tga` loading is unsupported or too slow, record a rejected artifact and
  switch to an explicit PNG/JPG conversion milestone rather than silently
  changing the material contract;
- if the diffuse maps make the browser command exceed the harness timeout,
  record the timing data and either downscale/convert textures or move to a
  GLB conversion milestone.

### Milestone 17: Southern France Four-Case Terrain Matrix

Goal: prove the accepted Southern France backend is a usable terrain
alternative across the same subjective source cases used by the local
second-order lane, not only one distant-midday smoke image.

Current status: accepted by split one-case browser artifacts `070` through
`073`. Each artifact uses `southern-france-obj-diffuse`, WebGL antialiasing,
`renderScale: 2`, and Three shadows disabled. The left side is raw Three scene
color without the full Algorithm32 atmosphere shader; the right side is the
same scene rendered with the integrated Algorithm32 shader. All four passed
`10/10` criteria with hardware WebGL through the NVIDIA/ANGLE D3D11 renderer.
Local rows used `flat-local-second-order-atmosphere` with `315` local
incident-cache entries. Artifact `068` remains the rejected all-four-cases
timeout evidence; `066`, `067`, and `069` are command-only partial attempts.
Follow-up fitted local-angle subjective artifacts `077` through `079` are also
accepted. They rerender local `90` and add local `135` and local `180` degree
orbit rows in the same no-shadows side-by-side format. The camera policy keeps
the accepted high Southern France position, FOV, and look-at elevation while
rotating only yaw toward the local Sun bearing at `180` degrees. The fitted
rerenders rotate and widen the staged OBJ footprint for this local-180-facing
view so the finite mesh remains under the visible frame instead of exposing
the catch plane on the right edge. All three passed `10/10` criteria,
recorded hardware NVIDIA/ANGLE WebGL, and used
`flat-local-second-order-atmosphere`. Earlier artifacts `074` through `076`
are superseded by this terrain-fit rerender.
Shader-only local vertical stack artifact `080` is also accepted. It uses the
same Southern France diffuse backend and fitted local-180-facing terrain
footprint, but the gallery contains only integrated Algorithm32 shader images
for local closest, local `45`, local `90`, local `135`, and local `180`, all
looking toward the local `180` degree Sun bearing. The local `45` source uses
accepted atmosflat evidence position
`[-2175398.8819482913, 4758279.812089166, 4828003.52]` and observer incident
scale `0.5033091181134656`. Artifact `080` passed `30/30` criteria with
hardware NVIDIA/ANGLE WebGL; gallery size is `960 x 3010`.
Shader-only local vertical stack artifact `086` is accepted as the same stack
with optional procedural apparent-magnitude point sources enabled in the
integrated shader display config. Stars are added only on sky rays as
top-of-atmosphere radiance, divided by pixel solid angle, attenuated by view
transmittance, and composed before the shared tone map; they do not light
terrain. The command used `starField.enabled: true`, `intensity: 1`,
`density: 1.15`, and `pointSize: 1.15`; diagnostics record the display config
on all five `flat-local-second-order-atmosphere` rows. In the current
fixed-exposure PNG, the real-magnitude star contribution is sub-perceptual,
changing only `2` to `4` sampled sky pixels per local band by at most one byte
relative to `080`. Rejected artifact `081` is failure evidence for the
temporary GLSL brace syntax error. Artifacts `082` through `085` are
superseded star-visibility calibration attempts.

Use the best accepted backend from Milestone 15 or Milestone 16. If the
diffuse backend is accepted, use it. If texture loading blocks, use the
geometry backend and record that texture work remains open.

Required cases:

- distant midday;
- distant sunset behind camera;
- local closest approach;
- local `90` degree orbit.

Required outputs:

- split one-case browser artifacts for the four required cases;
- per-case side-by-side raw-scene/no-atmosphere versus integrated-shader PNGs;
- scene/source/light/geometry/terrain diagnostics;
- selected sparse coverage diagnostics;
- criteria-results and report files;
- provenance that links back to the source zip and staged asset manifest.

Acceptance:

- each case renders finite/nonblank output through the integrated
  `Algorithm32AtmospherePass`;
- each case has both sky and scene-hit coverage;
- each case records at least one selected hit on the Southern France terrain
  mesh, not only the catch plane;
- distant cases use source-driven `DirectionalLight`;
- local cases use the existing source-driven local `PointLight` policy and
  local Algorithm32 source configuration;
- the terrain backend does not change Algorithm32, the local incident cache,
  or the shader source/geometry abstraction;
- the report compares subjective usability against `047-rocky-land-heightmap`
  and the `044-three-terrain-js` raised-ridge reference.

### Milestone 18: Terrain Backend Closeout

Goal: decide which POC terrain backend should be the current subjective review
default and record any production-facing asset conversion recommendations.

Acceptance:

- current accepted terrain options are listed with artifact links:
  `three-terrain-js`, `rocky-land-heightmap`, and Southern France OBJ;
- the recommended default for future subjective atmosphere scenes is named;
- if Southern France wins, the docs state whether the production path should
  keep OBJ/TGA for POC only or convert to GLB plus web-native textures;
- open issues are explicit: licensing/source attribution status, browser load
  time, texture memory, material fidelity, simplification/LOD, and whether
  normal maps should be introduced later;
- active-topic, the local-lane README, the experiment plan, and the runner
  README all point a compacted agent to the accepted terrain backend and the
  next runnable command.
