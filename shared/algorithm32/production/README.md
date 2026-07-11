# Algorithm32 Production

This folder owns the production Algorithm32 implementation. It currently holds
the test lane, public/API contracts, models, utilities, fixtures, and promoted
CPU/reference plus shader/runtime implementation slices. Additional production
algorithm code should be added only after the corresponding design/API step is
accepted.

The preserved POC implementation at `shared/algorithm32/POC/` is reference
material for promotion and parity checks. Production modules in this folder
should not import from `POC` as runtime dependencies.

## Current Handoff

The current implementation driver is the reconciliation POC and its summary in
`agents/topics/apps/flat/reconciliation/conclusions.md`. The reconciliation
topic, POC code, and experiment records remain supporting promotion material,
but production modules must promote the accepted behavior into this folder
rather than runtime-linking to those sources. Older local-second-order,
cleanroom, shader-lab, and `shared/algorithm32/POC/` lanes are historical
evidence only unless a future task explicitly asks for archaeology.

Incident-radiance support is setup-bound. The cache family owns generated
values, lookup coordinates, descriptors, sampler, shader payload, and packing.
`Reference` consumes an operation-ready `IncidentRadianceSampling` packet using
request override precedence over its configured default, including explicit
`null` for no incident sampling. The runtime shader handle owns the GPU
resource equivalent. Geometry owns ray/path resolution, atmosphere/source
coordinates, and source-relative cache spatial domains. Production `z`/`rho`
cache resolution is derived from geometry/cache-domain descriptors; fixed
dimensions are validation fixtures or named local-domain quality presets, not
universal global defaults. Atmosphere owns medium coefficients, optical-depth
integration, and separate Rayleigh/Mie phase facts; transport execution
coordinates plain packets and applies the selected integration rule.

`ShaderBuilder` and the shader handle own awaited runtime texture/cache
preparation for first production. Serializable descriptors and packed payloads
may support tests and internal validation, but there is no separate public
texture-artifact import/export API unless a later concrete non-app tool
requires one.

Current implementation progress: `Algorithm32` now performs first-slice config
validation, shared-model versioning, `Reference`/`ShaderBuilder` wiring,
config replacement, delegated CPU/reference evaluation, awaited shader setup,
shader-handle config refresh, and disposed-state failures.
`SpectralCalculator` now owns reusable endpoint/trapezoid path integration and
radiance math, while `Reference` orchestrates through it. Incident-radiance
support now includes `buildIncidentRadianceCache`, `noIncidentRadiance`,
source-owned distant/local cache families, matching distant/local source
models for direct lighting and cache creation, the canonical atmosphere model,
the `FlatSynchronizer` local-source synchronization helper, and spherical/flat
geometry models. Canonical constants now live in a
production data module, and `BrunetonColorDisplayModel` supplies the concrete
Color CPU conversion plus Color-owned display shader contribution. Shader
runtime support now includes
descriptor synthesis, owner-provided contribution plumbing, compatibility
validation, deterministic GLSL assembly, builder-owned runtime and required
Color-owned output contributions, concrete geometry, atmosphere, and light-source owner contributions
for the distant spherical and local flat paths, source-created incident-cache
shader setup with cache-owned descriptors, contributions, and texture
payloads, a core transport contribution provider, cache texture resource
preparation, cache descriptor/payload compatibility validation, Three
`RawShaderMaterial`/pass installation when an assembled setup supplies composer
and Three handles, reusable renderer-produced scene depth/hit capture through the
`SceneInputCapture` composer pass installed ahead of the fullscreen
Algorithm32 pass, fail-loud required binding validation before pass
installation, facade-forwarded setup `bindingValues` for live app camera
bindings, real `EffectComposer`/`RenderPass` integration for the flat app's
flat and globe simulations, and handle-owned runtime disposal. The old distant spherical and local flat
aggregate profile factories are quarantined under `quarantine/` for later
deletion; active setup now uses owner-local contribution methods instead. The
old flat/globe feature-local atmosphere shader components and their direct
legacy spec were removed. The production React wrapper creates and mounts
required geometry endpoint and source-light objects from
`config.geometry.createThreeEndpointObjects(...)` and
`config.lightSource.addSceneLighting(...)`; the owner-created flat
ground and globe surface endpoints carry the `geometry-ground-boundary` tags
and `metersPerSceneUnit = 1000` scale facts consumed by `SceneInputCapture`.
This follows the reconciliation browser runner's composer and km-to-meter
scene-scale conventions. The
spherical geometry shader contribution now supports explicit observer-local
and model-space scene frames; the flat app globe bridge uses model-space
because its Three globe is planet-centered, while the reconciliation planet
runner remains observer-local. Production geometries now resolve default
scene-depth capture caps from local horizon/object endpoint ranges instead of
scene camera star-scale `far` values. The flat and globe calibration app views
now default the rendered camera to 10 meters above modeled ground; the flat
renderer now consumes `observer.view.cameraHeightKm` directly instead of the old
altitude/1.7-meter fallback, starts the camera at
`[0, cameraHeightKm, 0]`, and initially looks horizontally along `-Z` with
pitch `0`. Flat live shader bindings map the R3F observer-local camera
position through `FlatEarthGeometry.mapObserverLocalScenePointToModelPosition(...)`,
matching the flat ground basis used by the owner-created endpoints. Flat/globe
scene components are minimal camera/canvas wrappers around the base composer.
The R3F bridge marks the canvas with `data-algorithm32-composer-mode` so live
checks can distinguish fallback frames from Algorithm32-composited frames, and
it passes R3F `invalidate` into the class wrapper so demand-loop canvases
redraw on async setup ready/failure. This app bridge is provisional consumer scaffolding, not
correctness evidence for Algorithm32 output. Browser reconciliation smoke record
`tmp/atmosphere/reconciliation/902-production-globe-frame-depth-smoke`
accepted the ground-inclusive scene shape with a geometry-ground sphere hit
mask and `sceneDepthMaxMeters = 250000`. The focused lane
currently passes
`npm run test:algorithm32:production` with 226 specs and 0 failures; the
preliminary app bridge also passes `npm run test:ui:flat` with 125 specs and
0 failures.

Live app checkpoint: the local Polylith server is HTTPS on port 443. Probe the
globe route at `https://localhost/flat/globe-simulation/` with local
certificate validation disabled. The latest retained live artifact is
`tmp/atmosphere/app-globe-localhost-https/images/initial-page.png`; it shows
the Globe Simulation page shell with an empty black render area. Subsequent
Puppeteer/canvas readback probes consumed excessive CPU and were killed, so a
fresh agent should use lighter instrumentation and tight timeouts before
attempting more live browser automation. The reconciliation browser runner
still accepts the ground-inclusive composer/raycast scene, so the next live
debug target is the app composer/Canvas render path after the fallback,
observer-local flat binding, and demand-loop fixes, starting with the
`data-algorithm32-composer-mode` canvas marker.

GPU/browser selected-pixel parity against `Reference` plus `Color` uses the
accepted evidence `gpu-selected-rgba-byte-parity`: max absolute RGB byte delta
`3` for deterministic 8-bit display readbacks, with exact alpha unless a
scene declares alpha-composition behavior. Whole-image and controlled-region
quality review uses scene-owned thresholds plus the
`gpu-perceptual-quality-metrics` evidence: exact byte metrics, Rec.709
luma/weighted-RGB proxy metrics, and CIEDE2000-style residual diffs with
`1.0 Delta E 2000` as a review threshold.

Debug views are deferred with diagnostics and are not first-production runtime
shader API. Visible stars and celestial point sources are app scene content
outside the Algorithm32 shader.

The production app integration contract lives in
`agents/topics/apps/flat/algorithm32/integration.md`. Use it for standalone
React/R3F setup details: API-shaped config factories, composer pass order,
the production-shipped class-based Algorithm32 wrapper plus tiny R3F bridge in
`shared/algorithm32/production/react/`,
base-wrapper-owned geometry endpoint objects, source-owned lighting objects,
app-authored solid scene inputs, scene input tags, camera/model bindings, config refresh,
diagnostics, and troubleshooting.

Fresh bootstrap pointers: after the topic docs, inspect this README,
`references.md`, `types/types.d.ts`, `constants/Algorithm32CanonicalData.js`,
`utils/WavelengthMath.js`,
`color/BrunetonColorDisplayModel.js`,
`geometries/SphericalEarthGeometry.js`, `geometries/FlatEarthGeometry.js`,
`atmospheres/CanonicalAtmosphere.js`,
`light-sources/DistantSunLightSource.js`,
`light-sources/LocalSunLightSource.js`,
`light-sources/FlatSynchronizer.js`,
`light-sources/DistantSunIncidentRadianceCache.js`,
`light-sources/LocalSunIncidentRadianceCache.js`,
`transport/Algorithm32Transport.js`, and
`implementation/ShaderBuilder.js`, plus
`implementation/SceneInputCapture.js` and
`implementation/ShaderRuntimePass.js`, then
`react/Algorithm32AtmosphereComposer.jsx`,
`react/Algorithm32R3FAtmosphereComposer.jsx`, and
`react/Algorithm32ReactUtils.js` to recover the current production state.
The promoted POC constants, display facts, and profile shader facts use the
internal short-code citation `(script a32-poc-color-032)` until exact
experiment records are collected in `evidence.md`. Remaining concrete runtime
work is capability/resource polish around the promoted contribution path,
source-light synchronization and scene-mapping adapters where the preliminary
real app integration needs them, browser/readback parity fixtures for scene
color, ray-length/depth capture, hit mask, and selected-pixel output, and
visual review. The atmosphere shader does not require
shader-facing object/material ID textures for the transport algorithm. Final
Color/display composition still consumes renderer-produced hit-pixel scene
color.

The mined POC constant inventory and unresolved promotion questions are in the
topic design doc:
`agents/topics/apps/flat/algorithm32/production-design.md#latest-poc-constant-inventory`.

## Facade

`Algorithm32.js` defines the primary production facade. It now implements the
first lifecycle slice: constructor config validation, canonical shared-model
creation, config snapshots, full config replacement, CPU/reference delegation,
awaited shader setup, shader-handle config refresh, and disposal failures.

## Implementation Classes

Implementation collaborators live under `implementation/`. `Reference` runs
CPU/reference Algorithm32 evaluations by orchestrating geometry ray segments,
endpoint/trapezoid integration points, `SpectralCalculator.computeRadiance`,
and setup-bound incident sampling precedence. `SpectralCalculator` is the
common internal radiance/math collaborator for `Reference` and cache building.
`ShaderBuilder` now validates setup-time attachment handles, synthesizes
shader descriptors from the shared model, fails loudly when a Color
abstraction is required but absent, collects optional owner shader
contributions, owns the runtime initial-state contribution, assembles
deterministic GLSL, prepares cache texture resources, and installs the
Three-compatible capture/runtime pass chain for assembled composer setups.
`SceneInputCapture` owns the reusable Three override-material depth and
hit-mask composer pass used by `ShaderBuilder` ahead of `ShaderRuntimePass`
when the runtime shader requires scene depth and hit textures.
Incident-radiance and source support currently includes
`buildIncidentRadianceCache`, `noIncidentRadiance`, and the concrete
distant/local source/cache families under `light-sources/`. The old
aggregate profile and shader contribution factories live only in
`quarantine/` as archival files pending deletion.
`ShaderRuntimePass` uses Three `RawShaderMaterial` for the fullscreen GLSL3
pass so Three does not inject duplicate built-in attributes into the vertex
source.
Implementation-only complex packet shapes live in `implementation/types.d.ts`.
The current top-level implementation plan lives in
`agents/topics/apps/flat/algorithm32/implementation-plan.md`.

## Concrete Models

Concrete atmosphere and geometry models live under `atmospheres/` and
`geometries/`. `CanonicalAtmosphere` owns density, optical-depth, and phase
sampling over configured constants and spectral channels. `SphericalEarthGeometry`
and `FlatEarthGeometry` own view-ray segments, atmosphere paths, source-relative
coordinates, cache access, and cache-build rays for their respective domains.
Concrete display conversion lives under `color/`, where
`BrunetonColorDisplayModel` owns the accepted Figure 1 spectral-to-display
adapter and shader display blocks. Production Three endpoint helpers now live
under `three/`: concrete spherical/flat geometries expose
`createThreeEndpointObjects(...)` for visual ground objects plus exact raycast
endpoints plus `resolveSceneDepthMaxMeters(...)` for the default scene-depth
capture cap, and concrete distant/local sources expose
`addSceneLighting(...)` for source-owned renderer lights and required
directional-light targets.

## Models

Shared configuration/facts models live under `models/`. `SharedModel`
aggregates the facade-owned light-source, atmosphere, geometry, and spectral component
models. It accepts the caller-provided light source, atmosphere, and geometry
implementations plus the accepted spectral basis, then constructs the
facade-owned `SpectralModel`. `SpectralModel` owns the active spectral basis,
channel shape, fingerprint, and version, and it provides basis replacement,
wavelength lookup, descriptor snapshots, and alignment queries. Model-only
complex packet shapes live in `models/types.d.ts`.

## Utilities

Generic pure numeric utilities live under `utils/`. The initial utility objects
are `ScalarMath`, `AngleMath`, `DistanceMath`, `WavelengthMath`, `VectorMath`,
`ArrayMath`, and `SampleMath`. They are domain-agnostic, deterministic helpers
with call-local options and no hidden mutable state. Utility-only complex option types live in
`utils/types.d.ts`. `utils/MathUtils.js` re-exports the utility objects by name
for convenient grouped imports.

## Test Lane

Run the production unit-test lane with:

```text
npm run test:algorithm32:production
```

Specs live near the code they exercise in local `_tests/` folders and use
Jasmine directly through `spec/support/jasmine-algorithm32-production.json`.
Each class should have a class-named spec file beside its implementation
folder, such as `models/_tests/SpectralModel.spec.js`.

Physical and algorithm expectation data should live in checked-in JSON fixture
ledgers, not inline spec literals. Each fixture row should carry stable ids,
citations, assumptions, input packets, expected data, tolerance metadata, and
an independence note. Fixture citations for third-party sources use the same
AMA-style numbered entries in `references.md` and bracket citation tokens used
by production code comments. Values determined experimentally use first-pass
internal experiment short codes from `references.md`, cited as
`(script <code>)`, until their exact scripts and record locators are collected
in `evidence.md`. Fixture rows may include compact shared provenance pointers
that identify either a numbered reference plus a precise section, equation,
figure, table, row, page, or local artifact path, or an accepted evidence name
plus the exact script, record, artifact, criterion, or run id.
Validation fixtures are unit-test artifacts: keep them in production fixture
ledgers consumed by specs, and promote generated reconciliation records into
fixtures only after adding formal source citations to `references.md` or
short-code internal experiment references to `references.md`, with later
detail collection in `evidence.md`.
The first production fixture ledger is
`fixtures/analytic-invariants.json`; it promotes externally backed analytic
rows from the rejected reference fixture file and omits rows whose only
citations were local app or stage specs. Its shape is guarded by
`_tests/fixtures.spec.js`, including a check that bracket citation numbers
match the row's compact reference pointer numbers and that superscript
citations are not used.
Prefer actual source data,
authoritative tables, published examples, or external-tool artifacts over
reference calculations when such data exists. Physics and algorithm tests
should cover sourced extents that cap or bound the calculation domain, not only
central happy paths. Those extents may be physics-based, such as an optical
wavelength range, a valid coefficient domain, a vacuum/no-medium limit, a
zero-length or zero-weight path, or a monotonic transport limit. They may also
be operational, such as JavaScript number precision, representable finite
values, or floating-point resolution. Physics extents must come from
third-party references, empirical sources, published algorithm papers,
source-backed fixture rows, or accepted first-party Algorithm32 evidence
entries; operational extents may cite the relevant language/runtime
specification. Practical caps are acceptable when
the cap and its reason come from the cited source, such as a Bruneton-style
paper or empirical dataset, instead of from an invented local rationale. Do not
choose extent values as arbitrary convenient numbers. Before production specs consume
a fixture family, add a fixture validation spec following the precedent from
`scripts/flat/atmosphere_rejected/reference/_tests/expectation-fixtures.spec.js`
and `test-expectations.js`. Inline expectations are reserved for bookkeeping,
API shape, validation plumbing, and other non-physics behavior.

## Source References

Third-party physics sources, algorithm papers, datasets, and source-backed
fixture sources belong in `references.md` using AMA-style numbered entries.
Code comments, JSDoc comments, and JSON fixture text fields should cite those
entries with bracketed reference numbers, preceded by a short description of
the data, formula, algorithm decision, or algorithm variation being cited. Use
ASCII tokens such as `[1]`, `[2]`, and `[1][2]`, not Unicode superscripts,
Markdown footnotes, or HTML citation markup.

First-pass internal Algorithm32 experiment references may be listed in
`references.md` with short codes and brief descriptions, then cited as
`(script <code>)` in prose, comments, fixture metadata, or compact provenance
pointers. Once the experiment code and records are collected, promote the
details into `evidence.md` while preserving the short code.

References or accepted evidence entries are required for Algorithm32 physics
and algorithm decisions, meaningful algorithm variations, experimentally
determined values, test fixtures, and non-fixture algorithm tests. They are not required for API-shape compliance, validation plumbing,
guardrail mechanics, architectural choices, module boundaries, file placement,
JSDoc style, or incidental platform/data-structure limitations. If a test
intentionally enforces operational extents caused by a language or platform
limit, cite the relevant language/runtime specification.

When provenance needs more precision than the numbered AMA entry or short
experiment code, use the shared compact pointer shape to identify either the
reference number plus a section, equation, figure, table, row, page, or local
artifact path, or the evidence name plus the exact script, record, artifact,
criterion, or run id that fixed an experimentally determined value.

## Types And JSDoc

Complex packet, fixture, registry, and API shapes belong in ambient `.d.ts`
files with property-level documentation. Shared scaffold registry types live
in `types.d.ts`. Primary single-interface model contracts live under
`types/` with PascalCase filenames that match the interface name, such as
`LightSourceModel.d.ts`, `AtmosphereModel.d.ts`, and `GeometryModel.d.ts`. The
caller-provided color conversion interface lives in `types/Color.d.ts` because
display conversion is adjacent to Algorithm32 core output rather than a shared
model owned by the facade. Supporting request, sample, and descriptor types
for those interfaces live in `types/types.d.ts` so the primary interface files
stay focused. Inside the
Algorithm32 production package, type names should not repeat the redundant
`Algorithm32` prefix unless a cross-package collision or existing scaffold
contract requires it. Consumer-provided model interfaces receive plain data
contracts such as `SpectralBasis`; they must not depend on internal
Algorithm32 model objects. Durable public/configuration types carry units as
data rather than property-name suffixes: `SpectralBasis` owns the ordered
`wavelengths` list of unit-bearing `Wavelength` packets as the canonical
spectral channel source; `channelCount` is derived by `SpectralModel` and
descriptors instead of repeated in the basis input.
Unit string values use plural spellings such as `nanometers`,
`micrometers`, `meters`, `kilometers`, `radians`, and `degrees`; singular
spellings fail at packet validation boundaries.
Unit utility constructors use `in<Unit>(value)` names, and unit conversions use
`to<Unit>(unitValue)` names that accept unit-bearing packets.
Unit utility objects may also expose small packet-in/packet-out operators such
as `add`, `subtract`, and `scale` for one-line calculations; hot loops should
still canonicalize once to plain scalar values.
JavaScript classes, methods, functions, and
non-trivial properties should use JSDoc with explicit types. Function and
method JSDoc must document parameters and return results. Parameter tags use a
hyphen after the parameter name, such as `@param request - ...`. When the
return shape is complex, explain the important returned fields in the
description and keep the `@returns` text concise.

## Class State

Private methods and properties use a leading underscore, such as `_config`.
Publicly readable properties should expose getters. Use setters only for direct
assignment with no processing; use explicit methods when setting a value needs
validation, normalization, cache invalidation, derived-state updates, resource
work, or other processing.
