# Active Topic

Current active topic: `algorithm32`

Parent app/topic: `flat`

## Current Focus

Production Algorithm32 design under:

```text
agents/topics/apps/flat/algorithm32/
```

This is design stage. Do not promote implementation into `shared/algorithm32/`
until the production requirements, API, module boundaries, calibration packet
shape, and validation contract are explicitly accepted.

The production implementation destination is:

```text
shared/algorithm32/
```

## Reload Sources

Load these focused production docs first:

- [Algorithm32 Production Documentation](apps/flat/algorithm32/README.md)
- [Algorithm32 Requirements](apps/flat/algorithm32/requirements.md)
- [Algorithm32 Production Design](apps/flat/algorithm32/production-design.md)
- [Algorithm32 Primary Facade API Draft](apps/flat/algorithm32/api-facade-draft.md)

Use broader flat docs only when the task needs current app status or historical
experiment evidence.

## Current Design Notes

- Algorithm32 should become the production owner for the usable
  shader/runtime atmosphere pass. Sun, atmosphere composition, geometry,
  execution configuration, calibration, local incident caches, internal shader
  texture/cache builders, display conversion, Three adapter behavior, CPU
  reference code, and validation helpers support that shader product. The core
  algorithm input abstractions are Sun, atmosphere composition, and geometry.
  Numerical controls are execution configuration, not a fourth algorithm input
  abstraction. Per-path evaluation and shader texture/cache building should be
  separate implementation responsibilities over a shared transport core.
  CPU/reference evaluation may remain public; texture/cache building is
  implementation-owned behind awaited shader setup and awaited shader-handle
  config updates. The current assumed public shape is
  a configured Algorithm32 facade object constructed once per independent
  simulation window. It coordinates two internal implementation classes, one
  for algorithm/reference and texture/cache work and one for runtime shader/
  Three work, both sharing a private transport/core layer. Instance state owns
  configuration, validation state, shader bindings, cache descriptors, GPU
  resources, and disposal scope; the shared core must not become a global
  mutable singleton. The current POC/lane audit adds that normal runtime input
  is a live Three scene rendered to scene-color plus depth textures and then
  composed by an Algorithm32 fullscreen pass; JSON/Raycaster scene packets are
  validation-only. The facade should own or expose source-driven Three lighting
  synchronization, geometry/camera/depth policy, runtime capability
  diagnostics, stable debug views, and fail-loud local second-order cache
  binding. Latest POC consolidation: the shared shader class/GLSL,
  accepted local finite-Sun source resolver, local incident-cache
  `Data3DTexture` upload, and live Three scene-color/depth to Algorithm32
  display-pass wrapper are in `shared/algorithm32/POC/`. The
  `scripts/flat/local-second-order/page/` lane still owns browser harness,
  terrain/gallery composition, renderer diagnostics, render-scale/antialias
  controls, and remaining source-light review plumbing. Shared private operations should be
  transport and contract primitives; per-path evaluation owns
  `EvaluationRequest` and single-path output, while internal texture/cache
  building owns build request state, grid traversal, packing, descriptors,
  cache keys, and packed payload output. Local Sun calibration/resolution and calibration
  replay/invalidation belong to the upstream local Sun configuration layer;
  the main Algorithm32 facade receives the configured public `Sun`. From the
  API consumer point of view, the normal product path should likely be the
  runtime shader facade if Algorithm32 ships the production shader adapter:
  construct the pass, explicitly prepare/rebuild required textures outside the
  render frame behind awaited setup/config updates, update config/display
  state, render through the composer, and dispose. Per-path evaluation remains
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
  to `constructor`, `getConfig`, `setConfig`, awaited `setupShader`,
  `evaluate`, `getDiagnostics`, and `dispose`.
  `setupShader` returns the handle that owns runtime Three resources, normal
  resource preparation, composer integration, diagnostics, and disposal.
  Algorithm32 should be installed into the app's existing composer or
  composer-compatible framework render hook; it should not require a second
  animation loop, raw-renderer-only production path, or separate normal-path
  resource-preparation checklist.
- Local Sun setup should default to calibration, not a brightness knob.
  Use current view location/current date by default, synchronize local closest
  approach to standard solar zenith, derive the clock offset and source power,
  and allow recalibration at any time.
- Local Sun configuration/calibration must influence the main Algorithm32
  algorithm only by resolving to the public Sun interface. Public interfaces
  are encapsulation boundaries; for Sun, atmosphere composition, and geometry,
  nothing outside the corresponding public interface and public input/resolver
  types may leak into transport, shader texture builders, caches, runtime
  shader APIs, display, validation, cache keys, descriptors, uniforms,
  fixtures, or generated artifacts.
- Basic user-authored local Sun settings should stay limited to altitude,
  diameter, northern latitude limit, and southern latitude limit. Location/date
  usually come from current simulation context.
- Orbit direction and period are standardized model behavior, not user-entered
  fields. Resolved orbital speed may be shown as an instantaneous derived
  display value for the current simulation time and location.
- Brightness/source power is derived calibration state. Any later visual
  adjustment should be exposure or tone mapping, not source brightness.

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
