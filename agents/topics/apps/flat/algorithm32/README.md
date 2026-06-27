# Algorithm32 Production Documentation

This folder is the documentation home for the production Algorithm32 module.

Current status: production Algorithm32 is in design stage only. The local
second-order experimental lane is closed as accepted evidence, but no
production implementation has been promoted into `shared/algorithm32/` outside
the preserved `POC` bundle yet. The production deliverable is a usable
shader/runtime atmosphere pass; CPU reference code is support for validation,
internal shader texture building, cache construction, diagnostics, and future
tests.
The three algorithm input abstractions are Sun, atmosphere composition, and
geometry; display conversion is a separate spectral-to-output-color concern.
Those abstractions should be defined as public interfaces in the Algorithm32
API itself, not only as implementation-private packet shapes.
Numerical controls are execution configuration, not a fourth algorithm input
abstraction.
Per-path evaluation and shader resource building are separate implementation
responsibilities over a shared transport core. CPU/reference evaluation may
remain public for validation and tooling consumers. Shader texture/cache
building is internal resource preparation behind awaited shader setup and
awaited shader-handle config updates.
The current assumed API shape is a configured Algorithm32 facade instance, one
per independent simulation window, coordinating an algorithm/reference
implementation and a runtime shader implementation over a shared private core.
The normal renderer input is a live Three scene rendered into color/depth
targets, then composed by an Algorithm32 fullscreen shader pass. JSON scene
packets and Raycaster captures are validation/oracle inputs only. The facade
should own or expose source-driven scene-light synchronization, geometry/depth
policy, runtime capability diagnostics, and fail-loud local-cache binding so
callers do not need Algorithm32 shader/cache domain knowledge.
The production runtime shader integration should require a composer-style
Three render pipeline. Algorithm32 setup installs its pass into the caller's
existing composer, and the app continues to invoke that composer in its normal
frame loop.
The current primary facade draft is
[Algorithm32 Primary Facade API Draft](api-facade-draft.md). It defines the
provisional caller-facing class, returned shader handle, minimal Three
integration path, configuration boundary, and explicit exclusions. The current
primary facade surface is `constructor`, `getConfig`, `setConfig`, awaited
`setupShader`, `evaluate`, `getDiagnostics`, and `dispose`; `buildTexture`
and `validate` are not primary app-facing methods.
Local Sun configuration and calibration must resolve to the public Sun
interface before reaching transport, texture building, cache, or runtime
shader code. For Sun, atmosphere composition, and geometry, anything not
defined by the corresponding public interface or public input/resolver types
stays private to that owner domain.

The implementation lives in:

```text
shared/algorithm32/
```

The cleanroom experiment and shader-lab docs remain the evidence and design
history for the production build. Use them as inputs, then promote durable
contracts here as the official production documentation.

## Current Authority

- [Algorithm32 Requirements](requirements.md) is the current requirements
  entry point. It divides requirements into implementable ownership domains;
  define and accept this layer before freezing production API names or packet
  shapes.
- [Algorithm32 Production Design](production-design.md) records the
  design-stage module boundaries, local Sun solar-zenith calibration UX/API
  notes, non-goals, promotion sequence, and open questions needed to satisfy
  the requirements.
- [Algorithm32 Primary Facade API Draft](api-facade-draft.md) is the current
  design draft for the main configured facade class and the runtime shader
  handle it returns.
- [Algorithm32 Canonical Reference](../plans/atmosphere-cleanroom-design/algorithm32-canonical-reference.md)
  is the current source of truth for accepted Algorithm32 behavior, endpoints,
  abstractions, open issues, and production followups.
- [Algorithm32 Module Design](../plans/atmosphere-cleanroom-design/algorithm32-module-design.md)
  is the current working design for module boundaries and API shape.
- [Algorithm32 Shader Iteration Plan](../plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md)
  records accepted shader-lab milestones and parity evidence.

## Source Mining

These catalogs are available when production Algorithm32 needs external
reference provenance, source-backed constants, or validation-fixture rationale.
They are not default reload sources.

- [External Reference Log](external-reference-log.md): imported external
  source and decision catalog from the retired atmosphere reference lane.
- [Fixture Sources](fixture-sources.md): imported fixture-readiness inventory
  for source-backed validation data.
- [Reference Fixtures Evidence](evidence/reference-fixtures/README.md):
  copied JSON expectation fixtures with embedded reference objects and
  derivation notes.

## Production Split

- `agents/topics/apps/flat/algorithm32/`: production documentation for the
  official Algorithm32 module.
- `shared/algorithm32/`: production implementation code for the usable
  shader/runtime atmosphere pass, plus supporting cache builders,
  shader texture builders, validation/oracle tools, and diagnostics.
- `shared/algorithm32/POC/`: centralized POC implementation bundle, including
  a pared-down module for the original non-shader `bruneton-start-fresh` base
  algorithm, pure-module extraction of accepted later POCs, and compatibility
  shims for old runner filenames. These clean, tested POC modules are the
  starting basis for production code. Use them as the promotion source, but do
  not treat the `POC` folder itself as the production module boundary.
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/`: cleanroom and
  shader-lab evidence/design history, not the final production-doc home.
- `scripts/flat/algorithm32-shader-lab/`: POC experiment lane, not production
  code.

## POC Evidence

The local Sun second-order experimental lane is now closed as evidence for the
production-design pivot. Its tracker remains:

- [Local Sun Second-Order POC](../plans/atmosphere-cleanroom-design/local-sun-second-order/README.md)

The currently preserved POC implementation bundle is:

- `shared/algorithm32/POC/`

The preserved POC bundle contains the shared Three shader class and GLSL used
by the latest local lane. It now also contains the accepted local finite-Sun
source resolver, the local incident-cache `Data3DTexture` upload helper, and
the live Three scene-color/depth to Algorithm32 display-pass wrapper:

- `shared/algorithm32/POC/local-second-order/local-sun-source.js`
- `shared/algorithm32/POC/three/local-second-order-renderer.js`

The script lane still owns browser harness, terrain/gallery composition,
renderer diagnostics, render-scale/antialias controls, and remaining
source-light review plumbing:

- `scripts/flat/local-second-order/page/local-second-order.js`
- `scripts/flat/local-second-order/page/subjective-scenes.js`

Those scripts import the POC shader/render helpers; they do not carry a
separate shader body or local incident-cache texture builder.

The local Sun second-order POC lane has now moved past the original
`013-three-integrated-gpu-local-l2-blocked` stop point. The reusable cache
implementation lives in `shared/algorithm32/POC/local-second-order/local-cache.js`.
It preserves the accepted local incident-field shape:

```text
L1_incident = incidentField.sample(position, incomingDirection, wavelength)
cache lookup = z, rho, incomingDirection, wavelength
```

For local Sun caches, `rho` is horizontal distance from the local Sun
subpoint on the flat plane. Incoming direction is stored in the Sun-subpoint
local radial/tangential/up frame, not raw world coordinates. Cache keys must
include public Sun, atmosphere composition, and geometry interface values,
execution configuration, cache resolution, incoming-direction set, wavelength
grid, and packing version.

The Three POC pass now exposes `flat-local-second-order-atmosphere`. Its
accepted browser POC uploads the local incident cache as a WebGL2/Three
`Data3DTexture` with `rho` on X, `z` on Y, and
`directionIndex * spectralGroupCount + spectralGroupIndex` on Z. The 15
Algorithm32 spectral channels are packed into four RGBA groups:
`0..3`, `4..7`, `8..11`, and `12..14` plus padding. The shader reconstructs
the flat camera ray, converts each incoming direction to the same
Sun-subpoint local radial/tangential/up frame, samples the packed cache, and
feeds that `L1_incident` into the same second-order accumulation shape as the
CPU soft shader.

The current production-shape evidence keeps the Three-native render path:

```text
Three scene + camera
  -> scene color render target + DepthTexture
  -> Algorithm32 fullscreen ShaderMaterial
  -> output target or screen
```

It also keeps source/geometry adapters and CPU soft-shader validation. It
discards packet replay as the normal renderer architecture, standalone raw
WebGL renderers as the target integration, and per-object atmosphere material
duplication as the primary app strategy.

Accepted POC evidence in `tmp/atmosphere/local-second-order/`:

- `011-local-cache-shape`: accepted the local frame cache shape after
  rejecting raw world direction caching in `010`.
- `012-cpu-soft-shader-local-l2`: accepted CPU first-plus-second-order local
  closest and local 90 degree cases, with distant controls carried in the same
  matrix.
- `018-three-integrated-local-l2-probe`: accepted the integrated Three GPU
  cache path for local closest.
- `019-three-integrated-local-l2-probe`: accepted the integrated Three GPU
  cache path for local 90 degrees.

Open design followups before production promotion:

- promote the POC cache helper into a production `shared/algorithm32/` module
  with typed source/cache config contracts;
- replace the probe-scene validation with full-scene CPU/GPU image parity
  against the production scene renderer and stable camera controls;
- decide whether production GPU storage stays `Data3DTexture` or needs a 2D
  atlas fallback for target devices;
- add cache invalidation and stale-key failure behavior at the production
  cache manager boundary;
- keep local direct solar-disc radiance, local ground bounce, and cone/flashlight
  source behavior as separate future source models.

## Promotion Rule

When a cleanroom or shader-lab design decision becomes production policy,
promote the corresponding clean POC module/contract into `shared/algorithm32/`
and summarize the durable contract here instead of making production agents
mine the experiment lane. Keep only one canonical owner for each production
fact.
