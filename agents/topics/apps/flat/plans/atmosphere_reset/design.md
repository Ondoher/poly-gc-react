# Atmosphere Reset Design

This design turns the atmosphere reset research into an implementation shape.
The companion documents are:

- [Research](research.md): physical model, equations, simplifications, and
  references.
- [Reference README](reference/README.md): human-facing purpose and navigation
  for the CPU reference docs.
- [Reference Stage Contracts](reference/stage_contracts.md):
  canonical input/output packet contracts for every reference pipeline stage.
- [Reference Code Design](reference/code_design.md):
  focused contract for the slow CPU truth engine.
- [Reference Plan](reference/plan.md):
  focused script implementation plan for the slow CPU truth engine.
- [Reference Test Design](reference/test_design.md):
  high-level stage test matrix for the slow CPU truth engine.
- [Reference Status](reference/status.md): current status for the slow CPU
  truth engine.
- [Plan](plan.md): test-first implementation sequence.

## Design Goal

Build a framework-free physical atmosphere reference module that can compute a
camera ray's spectral radiance for both:

- a real globe benchmark model: WGS84 ellipsoid, ellipsoid-relative atmosphere,
  distant Sun
- a counterfactual flat model: flat surface/disk, slab/dome/local atmosphere,
  local finite Sun

The scattering equation should be shared. The world geometry, atmosphere
volume, density field, source geometry, and boundary/occlusion rules should be
swappable physical properties.

## Ownership Boundary

The reset reference implementation should initially live under `scripts/flat`:

```text
scripts/flat/atmosphere/reference/
```

It must not depend on React, Three.js, browser canvas state, render targets, or
shader implementation details. Treat it as a script-owned laboratory and truth
oracle, not app runtime code. If pieces later need to be reused by the app,
promote the small pure modules deliberately into `src/flat/shared` after their
contracts are proven by tests.

The design has three layers:

1. Physical data and utilities:
   - wavelength grids
   - solar spectra
   - CIE color matching
   - spectral interpolation/integration
   - radiometric helpers
2. Model contracts:
   - world geometry
   - atmosphere volume/profile
   - solar source
   - surface reflection
3. Reference solver:
   - optical depth
   - transmittance
   - single scattering
   - surface radiance
   - spectral to XYZ to linear RGB conversion
   - diagnostics
4. Script runner:
   - JSON run configs
   - named probe selection
   - optional stage-limited diagnostics
   - deterministic JSON output
   - Markdown reports for IDE-readable human output
   - optional linked SVG/PNG artifacts

## Module Layout

Preferred first layout:

```text
scripts/flat/atmosphere/reference/
  spectral-grid.js
  colorimetry.js
  radiometry.js
  atmosphere-profile.js
  CpuSpectralReferenceIntegrator.js
  pipeline-stages.js
  types.d.ts
  diagnostics.js
  geometry/
    wgs84-world.js
    spherical-world.js
    flat-world.js
  sources/
    distant-sun.js
    local-finite-sun.js
  surfaces/
    lambertian-surface.js
  index.js
  _tests/
```

The names can shift during implementation if local conventions suggest a
better split, but the dependency direction should not: low-level physical data
and math should not import feature models or shaders. Script fixtures may adapt
current app data into reference inputs, but the solver itself should remain
plain JavaScript.

## Units

Use explicit unit conventions at every public boundary:

- distance: kilometers
- wavelength: nanometers
- spectral radiance: `W / m2 / sr / nm`
- spectral irradiance: `W / m2 / nm`
- extinction/scattering coefficient: `1 / km`
- optical depth: unitless
- transmittance: unitless `[0, 1]`
- CIE XYZ and linear RGB: display-facing numeric values after spectral
  integration

JavaScript will not enforce dimensions at compile time, so the reference
module should compensate with clear names, test fixtures, and debug validation.

## Core Contracts

The reference integrator should consume model objects. It should not branch on
`globe` or `flat` internally.

```text
world.altitudeAt(positionKm) -> km
world.upAt(positionKm) -> unit vector
world.intersectSurface(ray) -> hit | null
world.surfaceNormalAt(hit) -> unit vector

atmosphere.intersect(ray) -> { tMinKm, tMaxKm } | null
atmosphere.densityAt(positionKm, species) -> unitless density
atmosphere.extinctionAt(positionKm, wavelengthNm) -> 1/km
atmosphere.scatteringAt(positionKm, wavelengthNm) -> species coefficients

solarSource.samplesAt(positionKm, wavelengthNm) -> sun samples
sun sample:
  direction
  spectralRadiance or spectralIrradiance
  solidAngle
  visibility

surface.radianceAt(hit, wavelengthNm, lighting) -> W / m2 / sr / nm
```

These contracts are the design feature that keeps the flat comparison honest.
The real globe and proposed flat model can use the same solver because they
answer the same questions differently.

The `atmosphere` contract should be read as the initial clear-air medium
provider, not as a permanent limit to gas-only atmospheres. Its methods already
take full 3D positions and species names so later media can add aerosols, cloud
liquid water, cloud ice, dust, smoke, or absorbing layers without changing the
camera-ray transport shape. The first implementation may use one continuous
atmosphere interval and altitude-only analytic density, but it should not bake
that simplification into low-level integrator assumptions.

## Globe Model

The Phase 6A globe benchmark should start with WGS84 rather than a spherical
intermediate. Spherical globe fixtures may still be used for closed-form
geometry tests or explicitly named comparison runs, but the Earth-calibration
benchmark path should not build against mean-radius assumptions first.

The WGS84 benchmark fixture should start with:

```text
surface: WGS84 reference ellipsoid (EPSG 7030)
atmosphere: ellipsoid-relative clear-air volume from height 0 to H_top
altitude: ellipsoidal height above the WGS84 surface
up: local ellipsoid normal / ENU up vector
source: distant Sun with spectral irradiance at 1 AU
occlusion: solid Earth blocks sample-to-Sun rays
```

Use the EPSG 7030 WGS84 ellipsoid constants as the canonical data:

```text
semiMajorAxisKm = 6378.137
inverseFlattening = 298.257223563
```

Derive flattening, semi-minor axis, eccentricity, and any top-atmosphere
ellipsoid axes from those constants instead of keeping duplicate canonical
values. The app's existing `6371.0088 km` mean Earth radius remains useful for
spherical toy fixtures and older context, not for first benchmark globe
camera/world adapters.

The distant Sun source may use a single directional sample for atmosphere
scattering at first. Solar disk rendering can be angular/radiance based later.

## Flat Model

The flat fixture should start with:

```text
surface: plane or finite disk
atmosphere: slab, dome, finite cylinder, or named local patch
altitude: vertical height above the plane
up: constant vertical unless terrain overrides it
source: finite local Sun with position, radius, spectral radiance, and motion
occlusion: explicit boundary, disk edge, dome, terrain, or no-occlusion rule
```

Flat-model-only values such as local Sun height, local Sun radius, disk edge,
dome height, and no-occlusion rules are hypothesis parameters. They are allowed
only when named as proposed physical assumptions.

The flat model has one special path-length hazard that must stay explicit:
looking nearly horizontally across a large flat surface can produce a much
longer atmosphere path than a comparable globe ray. On a globe, curvature lets
many near-horizon rays leave the lower atmosphere. In a flat slab, a horizontal
ray never exits through the top of the slab, so its optical depth is controlled
by a named lateral boundary such as disk edge, finite local patch, dome/cylinder
wall, terrain/occluder, or an explicit maximum integration domain. That boundary
is not a shader tuning constant; it is part of the proposed world geometry.

This consequence affects both view rays and sample-to-source rays for a local
Sun. Any flat-world run with a large lateral extent should therefore report the
chosen boundary reason, path length, optical depth, and transmittance
diagnostics so large horizontal thickness cannot be hidden by display exposure
or arbitrary scattering multipliers.

## Spectral Pipeline

The reference path is:

```text
spectral source
  -> spectral optical depth/transmittance
  -> spectral in-scattering and surface radiance
  -> CIE XYZ
  -> linear RGB
  -> optional exposure/tone mapping outside the physical reference
```

RGB is not a physics transport domain. Any RGB shader approximation must be
compared against this spectral reference.

## Canonical Pipeline Stages

The stage ids below are the shared vocabulary for the reference API, CLI
diagnostics, tests, Markdown reports, and later shader design. The CPU
reference should expose them through `listStages()`, support direct
`runStage(stageId, packet)` calls, accept them in `runUntil(stageId, request)`,
and support them through the CLI `--stage` option. A shader may fuse,
precompute, or approximate stages, but shader design should still explain which
canonical stages each approximation replaces.

Each stage consumes the packet produced by previous stages and appends derived
data. Source inputs remain immutable: world geometry, atmosphere properties,
solar-source properties, surface properties, wavelength grid, and numerical
controls should not be silently rewritten inside the pipeline.

| Stage id | Question answered | Packet fields added |
| --- | --- | --- |
| `validateRequest` | Is the request physically and numerically well-formed? | normalized ray, validated wavelength grid, validated model interfaces, unit-bearing numerical controls |
| `resolveRayPath` | What segment of the camera ray participates in atmosphere transport? | atmosphere entry/exit distances, surface hit if any, chosen view segment, boundary reason |
| `sampleViewPath` | Where will the view integral be evaluated? | sample positions, distances from observer, step lengths/weights, integration method metadata |
| `evaluateMedium` | What atmosphere exists at each view sample? | altitude, density by species, extinction coefficients, scattering coefficients, absorption coefficients |
| `integrateViewOpticalDepth` | How much light is removed between the observer and each view sample or surface? | view optical depth by wavelength/species, view transmittance by wavelength, end-of-segment transmittance |
| `integrateSolarTransmittance` | How much source light reaches each view sample or surface point? | solar samples, source direction/solid angle/radiance or irradiance, visibility, source optical depth, source transmittance |
| `evaluateScatteringPhase` | What angular phase terms convert source light into the camera ray? | scattering angles, cosines, Rayleigh phase values, Mie phase values, later cloud phase values |
| `integrateSingleScattering` | How much light is scattered into the camera ray before any surface contribution? | Rayleigh in-scattered radiance, Mie in-scattered radiance, per-species single-scattering component summaries |
| `resolveSurfaceRadiance` | If the ray hits a surface, what radiance leaves that surface toward the camera? | direct source irradiance, optional diffuse sky irradiance, BRDF/albedo terms, emitted/reflected surface radiance, view-attenuated surface radiance |
| `composeSpectralRadiance` | What spectral radiance reaches the observer along this ray? | component sums, final spectral radiance by wavelength |

The pipeline is intentionally more explicit than a production shader. That is
the point: it lets tests stop at a stage with known answers, lets the CLI print
stage-limited diagnostics, and gives the later shader document a precise list
of physical quantities it must either compute, approximate, precompute, or
declare out of scope.

Color conversion and report building are post-pipeline API consumers. They may
have their own testable APIs, but they consume the spectral radiance and
transport diagnostics produced by the pipeline rather than becoming inputs to,
or canonical stages inside, the transport pipeline.

The detailed input/output packet contract for each stage lives in
[Reference Stage Contracts](reference/stage_contracts.md). This table defines
the shared vocabulary and stage order; the contract document is the authority
for nested packet fields, ownership, and downstream handoff requirements.

## Pipeline Control Flow

For the CPU reference, each canonical stage should be an independently runnable
packet transform. The full pipeline is just the normal composition of those
stage functions. That gives tests a stable way to run one stage with a crafted
packet and inspect only the quantity under test.

The outer shape is:

```text
for each probe/ray requested by the CLI or test:
  packet = createInitialPacket(request)
  for each canonical stage in order:
    packet = runStage(stage.id, packet)
    if stage id matches requested stop stage:
      return packet
  return completed result
```

`runStage(stageId, packet)` should be equivalent to calling the exported stage
function directly. It should not depend on private class state from prior runs.
If a packet is missing required fields, the stage should fail loudly with a
message that names the missing dependency.

Each stage descriptor should declare:

- `id`: stable canonical stage id
- `requires`: packet fields required before the stage can run
- `provides`: packet fields written by the stage
- `run(packet, context)`: pure packet transform except for optional diagnostic
  logging selected by the caller

The transport-heavy stages still own internal loops:

- `sampleViewPath`: loop over view-ray sample intervals.
- `evaluateMedium`: loop over view samples, species, and wavelengths where
  coefficients are wavelength-dependent.
- `integrateViewOpticalDepth`: loop over view samples, intervals, species, and
  wavelengths.
- `integrateSolarTransmittance`: loop over view samples, solar-source samples,
  source-path intervals, species, and wavelengths.
- `evaluateScatteringPhase`: loop over view samples, solar-source samples,
  species phase functions, and wavelengths when phase data is
  wavelength-dependent.
- `integrateSingleScattering`: loop over view samples, solar-source samples,
  species, and wavelengths.
- `resolveSurfaceRadiance`: loop over wavelengths and, when enabled, sky
  hemisphere samples.

This lets tests target very small pieces:

- one medium sample at one position
- one optical-depth step over one interval
- one sample-to-source transmittance ray
- one Rayleigh or Mie scattering contribution
- one full stage run over a tiny two-sample packet
- one completed ray packet at a canonical stage boundary

Avoid an outer loop that reruns the whole pipeline once per wavelength. Geometry
and density are mostly wavelength-independent and should be computed once per
ray/sample, then reused across the wavelength grid.

The production shader may later fuse stages for performance. Its likely shape
is still one fragment or compute invocation tracing one camera ray, marching
view samples, evaluating medium/source terms at each sample, and accumulating
radiance channels. The CPU reference keeps canonical stages separate for tests;
the shader can collapse those boundaries once parity probes exist.

## Reference Integrator

The focused integrator contract lives in
[Reference Code Design](reference/code_design.md).
This section is the project-level summary.

For one ray:

1. Validate the active model, observer, ray, wavelength grid, and numerical
   controls.
2. Resolve the active atmosphere segment, active surface hit, and chosen view
   path.
3. Sample the view path.
4. Evaluate the medium at all view samples.
5. Integrate camera-ray optical depth and transmittance.
6. Integrate sample-to-source optical depth and transmittance.
7. Evaluate scattering angles and Rayleigh/Mie phase terms.
8. Accumulate Rayleigh and Mie single-scattered spectral radiance.
9. If the ray hits a surface, compute direct source irradiance, optional
   diffuse sky irradiance, surface radiance, and view attenuation.
10. Compose the final spectral radiance.
11. Return spectral radiance and transport diagnostics.

Post-pipeline consumers can then convert spectral radiance to XYZ/linear RGB or
shape Markdown/JSON reports without feeding display choices back into the
transport calculation.

## CLI Runner

The focused CLI sketch lives in
[Reference Code Design](reference/code_design.md#cli-shape),
and the script implementation sequence lives in
[Reference Plan](reference/plan.md#cli-contract).
Treat those sections as provisional until the stage API and stage test design
are stable.

The runner should live at:

```text
scripts/flat/atmosphere/run-reference-probe.js
```

It should accept direct probe flags and JSON run definitions, then emit
deterministic JSON diagnostics. It should also support Markdown reports as the
first human-facing output, with optional linked SVG/PNG artifacts for swatches,
curves, and later sky maps. This lets us run the reference pipeline outside the
browser and compare parameter changes before any shader parity work.

## Benchmark Harness Overview

The next layer above the transport integrator is a benchmark harness. Its job
is not to add new physics to the core stages; its job is to assemble named
worlds, sources, surfaces, cameras, and probe rays so the CLI can produce
repeatable numeric and visual evidence. This is the bridge between the trusted
CPU reference and the eventual shader parity harness.

Keep this layer framework-free and script-owned. It may adapt current app
defaults into reference inputs, but the resulting benchmark scenarios should be
plain JSON plus pure JavaScript adapters. Do not read React state, Three.js
objects, render targets, or shader uniforms directly inside the reference
solver.

The current benchmark proof has two primary jobs:

- Convert completed reference output into image pixels correctly. The
  post-pipeline output path owns spectral radiance to XYZ, XYZ to linear sRGB,
  display RGB, output encoding, clamping, and image artifact layout. Those
  choices must be recorded in diagnostics and must not feed back into transport
  physics.
- Use an atmosphere model accurate enough for Earth-like visual evidence:
  WGS84 globe geometry, ellipsoid-relative altitude, real-Sun spectral
  irradiance, sourced Rayleigh coefficients, named aerosol/Mie defaults, and
  optional absorber/ozone variants with explicit provenance.

Everything else should stay as small as those two jobs allow. Camera and
coordinate adapters only need to aim deterministic sky patches and record the
resolved observer/ray metadata. Full app coordinate infrastructure is deferred
until the reference output is persuasive enough to become a parity target.

### Adapter Ownership

Use adapters to build the model object consumed by
`CpuSpectralReferenceIntegrator`. Each adapter should own one kind of fact:

- `world`: coordinates, altitude, up vector, surface intersections, and surface
  normals.
- `atmosphere`: volume boundaries, density profile, species coefficients, and
  named boundary diagnostics.
- `solarSource`: distant or local Sun geometry, source spectra, solid angle,
  visibility, source-path transport segments, and direct-light availability.
- `surface`: albedo, Lambertian or later BRDF behavior, emissive terms if any,
  and diagnostic material ids.
- `camera`: observer position, orientation basis, field of view, and conversion
  from named view directions to rays.
- `benchmark`: scenario metadata, probe ids, thresholds, image/report output
  shape, and subjective review notes.

The integrator should continue to receive only the composed model, observer,
ray, wavelength grid, and numerical controls. Adapter construction is allowed
to be opinionated and app-aware; stage execution should stay app-agnostic.

### First World Sets

The first reusable world/source sets should cover both the real calibration
path and the flat/local-Sun path:

- `earth.globe.clearDay`: WGS84 ellipsoid, ellipsoid-relative clear-air
  atmosphere, distant real Sun, Earth-like clear-air coefficients, and a simple
  Lambertian ground. Use this as the main shader-calibration target.
- `earth.globe.vacuum`: same geometry with no atmosphere. Use it for camera,
  surface, and direct-light sanity checks.
- `flat.appDefaults.localSun`: current flat app defaults adapted into the
  reference model, including the local false Sun size/height/brightness,
  San Jose observer convention, and the selected clear-air profile. Use it to
  explain what the current app configuration implies, not to force Earth-like
  output.
- `flat.hypothesis.localPatch`: a deliberately named flat slab/dome/cylinder
  patch with explicit lateral boundary and local finite Sun. Use it to test
  consequences of flat-world assumptions without silently inheriting app
  compatibility settings.
- `flat.vacuum`: flat surface/source geometry with no atmosphere. Use it to
  isolate camera, source falloff, and surface-lighting behavior.

Every flat-only distance, boundary, Sun height, Sun radius, source calibration,
or no-occlusion rule must be labeled as either an app default, a sourced claim
variant, or an explicit hypothesis. A finite lateral boundary is a world
property, not a numerical integration cap.

### Camera And Probe Contract

Benchmark probes should be defined in camera-relative language first, then
materialized into model-space rays by the selected camera adapter. A scenario
may also include explicit model-space rays when testing a stage or geometry
edge case, but visual benchmarks should prefer camera terms that can later map
to shader captures.

Suggested camera fields:

```json
{
  "id": "sanJose.eyeHeight.north",
  "observer": {
    "positionKind": "geodetic",
    "latitudeDeg": 37.3382,
    "longitudeDeg": -121.8863,
    "heightKm": 0.03048
  },
  "orientation": {
    "azimuthDeg": 0,
    "elevationDeg": 0,
    "rollDeg": 0
  },
  "lens": {
    "verticalFovDeg": 60,
    "aspect": 1.7777777778
  }
}
```

Suggested probe fields:

```json
{
  "id": "sunset.horizon.center",
  "camera": "sanJose.eyeHeight.west",
  "view": {
    "kind": "azimuthElevation",
    "azimuthDeg": 270,
    "elevationDeg": 0
  },
  "stage": "composeSpectralRadiance",
  "expectationClass": "visual-benchmark"
}
```

### Camera Adapter Design

The benchmark camera adapter has one narrow job: turn a human-readable camera
and view description into the `observer.positionKm` and normalized
`ray.direction` consumed by the reference integrator. It is a ray generator,
not a renderer. It must not own exposure, tone mapping, display color, depth of
field, antialiasing, browser canvas state, or Three.js camera objects.

For the current proof slice, keep this adapter intentionally boring. It only
needs enough observer and pinhole math to support the first midday, midnight,
and sunset sky-patch artifacts. If a hand-authored ray is simpler for an early
analytic or visual run, allow it as an explicit low-level probe while keeping
the benchmark diagnostics clear about bypassing the camera adapter.

The adapter should follow the same conceptual split as projective rendering
systems: a camera maps a point on an image/probe plane to a ray with an origin
and direction, and the transport integrator answers what radiance that ray
receives. PBRT's camera interface and projective camera model are the design
precedent for this separation. The local implementation should stay small and
plain-data based so it can later be matched by browser/shader capture code.

## Coordinate Spaces And Transform Core

Coordinate spaces and transforms are core shared functionality, not
camera-specific behavior. The benchmark camera consumes them, but so do world
adapters, source adapters, surface fixtures, the CLI/report layer, Three.js
scene placement, shader uniform packing, shader ray reconstruction, and
diagnostic round trips.

The current goal is narrower than that full consumer list: prove the CPU
reference and its benchmark inputs. The first implementation should support
reference scenario loading, reference world/camera/source adapters, CLI
diagnostics, and visual artifacts generated from CPU reference results. It does
not need to construct Three.js cameras, mutate app scene objects, pack shader
uniforms, or reconstruct shader rays. Those app/browser rows remain in the
inventory so later parity work has a known destination, but they are not part
of the first reference-proof slice.

The transform core should be framework-free and script/package friendly. It
should expose named transform adapters that accept plain data, return plain
data, and emit frame/provenance metadata. It must not import React, Three.js,
DOM, renderer state, or shader code. App-facing and shader-facing adapters may
consume its outputs and convert them into Three objects, uniforms, matrices, or
capture metadata.

Core responsibilities:

- Declare coordinate-space ownership and prevent parallel sources of truth.
- Resolve canonical inputs into derived frame data and CPU reference trace
  endpoints for the current proof slice.
- Validate coordinate packets, datums, projection ids, frame ids, handedness,
  basis orthonormality, finite vectors, and round-trip tolerances.
- Provide deterministic calculations for the implemented reference-proof
  transforms while keeping deferred endpoint rows as a roadmap.
- Provide optional precompute/cache hooks for expensive or repeated
  deterministic transforms.
- Emit diagnostics that explain which canonical inputs produced each derived
  point, vector, basis, matrix, or future endpoint packet.
- Fail loudly on unknown frames, mismatched cache keys, stale generated data,
  unsupported datums, or missing projection rules.

### Transform Core API Shape

The first implementation should be small and explicit rather than a general
graph solver. A caller asks a named adapter to resolve one thing, and the
adapter returns the resolved value plus metadata:

```text
resolveTransform(transformId, input, context) -> {
  id,
  value,
  frames: {
    sourceFrame,
    targetFrame,
    frameId,
    datum,
    projectionId,
    handedness
  },
  provenance: {
    sourceFields,
    derivedFields,
    assumptions,
    warnings
  },
  cache: {
    key,
    hit,
    generated
  }
}
```

The public API can be plain functions at first. A lightweight registry is useful
only if it removes duplication between the camera bridge, future world/source
adapters, and tests:

```text
listTransforms() -> transform descriptors
getTransform(id) -> descriptor
resolveTransform(id, input, context) -> result
createTransformCache() -> in-memory deterministic cache helper
createFrameDescriptor(fields) -> validated frame metadata
```

Each transform descriptor should name:

- `id`: stable transform id, such as `wgs84.geodeticToEcef`.
- `sourceFrames` and `targetFrame`: expected frame vocabulary.
- `requiredInputs`: canonical fields consumed by the transform.
- `calculation`: short local description or reference pointer.
- `cacheKeyFields`: fields that must enter the deterministic cache key.
- `provides`: output fields and diagnostic metadata.

The cache helper is optional for the first behavior pass. The first
implementation may compute every transform directly, as long as each result
contains the cache key fields and provenance needed to add caching without
changing the public result shape. Persistent caches are out of scope for the
first camera bridge; an in-memory per-configuration cache is enough once we
need repeated sky-patch or target-grid rays.

### Camera Bridge First Slice

Before implementing the whole transform inventory, build the smallest transform
core that can support the benchmark camera bridge and its tests. For the
current reference proof, that means plain CPU trace requests plus CLI
diagnostics and visual artifacts, not browser or renderer integration.

First-slice transforms:

| Transform | Why it is needed first | Deferred parts |
| --- | --- | --- |
| `wgs84.resolveDatum` | Converts EPSG 7030 canonical constants into the ellipsoid values used by globe observers and targets | Alternate datums |
| `wgs84.heightMslToEllipsoid` | Lets geodetic `elevationKmMsl` anchors resolve with explicit `wgs84-ellipsoid-as-msl` diagnostics | Real geoid/terrain sea-level offsets |
| `wgs84.geodeticToEcef` | Resolves globe observer and target anchors into a standard 3D frame | Inverse ECEF-to-geodetic diagnostics |
| `wgs84.geodeticToEnuBasis` | Provides local east/north/up for azimuth/elevation, roll, and surface-relative camera views | Geoid-normal or terrain-normal variants |
| `frame.ecefToReferenceGlobe` | Declares canonical ECEF points and ENU basis vectors as the first globe reference model frame | App/browser axis-map variants |
| `flat.geodeticToNorthPoleAe` | Resolves flat-world geodetic observers and targets through the declared default projection | Alternate flat projections |
| `flat.resolveLocalFrame` | Supplies constant flat `east`, `north`, `up`, origin, and boundary metadata for flat cameras | Terrain-varying local frames |
| `camera.resolveObserver` | Produces `observer.positionKm` plus local basis from WGS84 or flat observer definitions | Browser camera objects |
| `camera.resolveTarget` | Produces a model-space target point from geodetic anchors or explicit low-level test points | Full fixture-owned mesh construction |
| `camera.directionFromAzimuthElevation` | Produces horizon, zenith, north, east, and arbitrary view directions | Curved/refraction-adjusted view rays |
| `camera.directionTowardSource` | Produces `towardSun` directions for explicit distant Sun direction or local finite Sun position | Solar ephemeris-backed Sun position |
| `camera.buildPinholeBasis` | Resolves `forward`, `right`, plumb-aligned `cameraUp`, and defaulted `rollDeg = 0` with near-zenith fallback | Browser-specific parity checks for the clock-angle convention |
| `camera.rayFromNdc` | Produces deterministic sky-patch rays from FOV/aspect/NDC samples | Antialiasing, depth of field, lens distortion |

First-slice module placement should stay under the reference package until the
contracts are proven:

```text
scripts/flat/atmosphere/reference/transforms/
  transform-registry.js
  transform-cache.js
  frames.js
  vector-math.js
  wgs84-transforms.js
  flat-transforms.js
  camera-transforms.js
```

Later, proven pure helpers can be promoted deliberately into `src/flat/shared`
or a package-facing shared module. Do not import current app projection classes
directly into the reference transform core; instead, duplicate only the
currently needed projection math with tests and provenance, then decide whether
to converge implementations after the contract is stable.

First-slice exclusions:

- ECEF-to-geodetic inverse diagnostics.
- Real geoid/terrain sea-level conversion.
- App/Three.js model-frame axis adapters beyond the first reference globe
  frame.
- Three.js object mutation or camera object construction.
- Shader uniform packing and matrix/ray reconstruction.
- Floor texture UV inversion.
- Celestial RA/Dec and sky-dome projections.
- Source-path optical-depth segments.
- Full fixture mesh generation beyond resolving target points and marker
  centers.

First-slice tests:

- WGS84 derived constants match EPSG 7030 inputs and contain no duplicate
  canonical ellipsoid values.
- Geodetic-to-ECEF has pinned equator, pole, and San Jose rows.
- ENU basis is orthonormal and right-handed for simple and San Jose rows.
- ECEF-to-reference-globe adapter preserves basis orthonormality and reports
  frame metadata while using canonical ECEF as the first reference globe model
  frame.
- Flat north-pole AE projection maps the north pole to the origin, the equator
  to `R * pi / 2`, and `elevationKmMsl` to the flat height axis.
- Observer resolution emits the same public request shape for globe and flat
  cameras: `observer.positionKm`, local basis, frame metadata, and warnings.
- Azimuth/elevation resolves north, east, zenith, and a representative oblique
  direction.
- Target resolution rejects mixed height datums and observer/target
  coincidence.
- `towardSun` resolves explicit distant and local finite source directions and
  reports unavailable direct light.
- Pinhole basis and NDC rays pin center, left/right symmetry, top/bottom
  camera-up behavior, plumb-aligned zero roll, and clockwise clock-angle roll.
- Cache keys are deterministic and change when any first-slice source input or
  frame metadata changes, even if the first implementation does not reuse
  cached results yet.

Use three foundational coordinate systems, each with a different ownership
role:

- Geodetic coordinates are for permanent facts: observer locations, target
  anchors, real-world calibration sites, source-backed terrain points, and
  fixture locations intended to survive observer/camera changes. The default
  geodetic datum is WGS84 latitude/longitude plus `elevationKmMsl`, with
  explicit diagnostics when Phase 6A uses the WGS84 ellipsoid as a temporary
  sea-level approximation.
- Observer-relative coordinates are for subjective or view-local intent:
  azimuth/elevation probes, "look toward the horizon", short-range
  bearing/range convenience controls, and camera manipulation. They are
  resolved from a selected observer and local frame; they should usually be
  generated or transient rather than the persisted source for permanent
  markers.
- Three/app scene coordinates are future render endpoints: object placement,
  camera placement, shader uniforms, depth-bearing geometry, and browser
  capture parity. They are Cartesian `x/y/z` coordinates in kilometers for the
  selected render world. They should be generated by adapters, not hand-authored
  as permanent benchmark truth except for low-level tests or explicit parity
  snapshots. The current proof slice stops before these endpoints and emits
  reference model coordinates and rays instead.

Everything else is operational glue:

- WGS84 ECEF is the computation bridge from geodetic coordinates to the globe
  benchmark frame.
- ENU is the local tangent basis used to interpret azimuth, elevation, roll,
  local target orientation, and surface normals.
- The north-pole-centered azimuthal equidistant projection is the default flat
  hypothesis bridge from geodetic anchors to flat scene coordinates.
- Object-local coordinates belong to mesh/fixture construction before an
  object is placed into a scene world.
- Camera/view space, clip space, NDC, framebuffer UV, and texture UV are
  rendering/shader spaces derived from scene coordinates. Atmosphere transport
  should use scene/world coordinates after any screen-space ray reconstruction.

The relationship is:

```text
permanent geodetic fact
  -> world adapter / projection / ECEF-ENU bridge
  -> reference model endpoint
  -> future object, camera, shader, clip/NDC, UV spaces

observer-relative intent
  + selected geodetic observer
  -> local ENU frame
  -> reference model endpoint or ray direction
```

Every adapter that crosses one of these boundaries should emit frame metadata:
`frameId`, `sourceFrame`, `targetFrame`, datum, projection id when applicable,
handedness, and basis vectors. That metadata is how the benchmark layer proves
that the CPU reference is talking about the intended ray or surface now, and
how later app scene and shader captures can prove they are talking about the
same ray or surface.

### Derived Transform Precompute And Cache Policy

Complex or repeated transform calculations may be precomputed and cached when
they are deterministic functions of canonical inputs. Current reference-proof
candidates include WGS84-derived ellipsoid constants, per-observer ECEF/ENU
origins and bases, flat azimuthal-equidistant projection results, target
resolution, camera basis vectors, and NDC ray grids. Later app/shader parity
candidates may include object placement transforms and shader uniform matrices
for ray reconstruction after those endpoint adapters exist.

Cached transform data is a derived artifact, not a fourth foundational
coordinate system and not source data. Scenario JSON should store geodetic
anchors, observer-relative intent, and selected endpoint adapters. Generated
cache records may appear in diagnostics or temporary runtime artifacts only
when they carry enough provenance to be reproduced from the canonical inputs.

Each cache key must include every source input that can change the result:
world-set id, source and target frame ids, datum or height datum, projection id
and options, WGS84 constant version, observer and target anchors, selected time
or solar-ephemeris inputs when applicable, lens FOV/aspect/NDC grid,
orientation/roll, and flat projection or boundary settings. Cache consumers
must fail loudly on `frameId` or key mismatch and recompute when any source
input changes.

Diagnostics may report cache key/hash, cache hit or miss, source-field
provenance, and generated frame metadata. Rounded report values are display
diagnostics only; cached runtime values should retain full numeric precision
and must not feed rounded diagnostics back into transport physics.

### Transform Inventory

The rows below are the full transform roadmap. The current reference proof
should implement only the first-slice rows that produce CPU reference observer,
ray, target, source-direction, and diagnostic data. App, browser, shader,
texture, and sky-dome endpoint rows remain deferred until the reference
scenarios are trusted enough to become parity targets. Every implemented row
should have one source-of-truth input set, one calculation, and one derived
output shape. No row output becomes a persisted scenario fact unless it is
explicitly stored as a generated diagnostic artifact with provenance.

World and datum transforms:

| Transform | Source-of-truth input(s) | Calculation | Output |
| --- | --- | --- | --- |
| WGS84 datum constants to ellipsoid parameters | `worldSet` WGS84 datum id plus EPSG 7030 `semiMajorAxisKm` and `inverseFlattening` | `f = 1 / inverseFlattening`; `b = a * (1 - f)`; `e2 = f * (2 - f)`; derive any top-atmosphere ellipsoid axes from surface axes plus configured atmosphere height | WGS84 datum metadata, surface axes, eccentricity, flattening, top-atmosphere axes |
| Sea-level-relative height to ellipsoidal height | Geodetic anchor `latitudeDeg`, `longitudeDeg`, `elevationKmMsl`, selected `heightDatum` | Phase 6A may use `heightKm = elevationKmMsl` only when diagnostics say `heightDatum: "wgs84-ellipsoid-as-msl"`; later geoid/terrain mode adds the configured sea-level/geoid offset before WGS84 placement | Geodetic anchor with explicit ellipsoidal `heightKm` and datum diagnostics |
| Geocentric-distance anchor to ECEF radius | Geodetic anchor `latitudeDeg`, `longitudeDeg`, `distanceFromEarthCenterKm` | Build the geodetic-direction unit vector selected by the anchor datum and multiply by the configured center distance; reject anchors that also specify `elevationKmMsl` | ECEF point for controlled shell/geocentric fixtures |
| WGS84 geodetic to ECEF | Geodetic `latitudeDeg`, `longitudeDeg`, ellipsoidal `heightKm`, derived WGS84 datum | Use the WGS84 prime vertical radius `N = a / sqrt(1 - e2 * sin(lat)^2)` and compute `(x,y,z)` with the standard ellipsoid formula already listed in the globe algorithm | Canonical ECEF position in kilometers plus `sourceFrame: "wgs84-geodetic"` and `targetFrame: "wgs84-ecef"` metadata |
| ECEF to WGS84 geodetic diagnostics | ECEF point and WGS84 datum | Use a named inverse WGS84 solver, such as Bowring-style closed form or a bounded iterative solver, with declared tolerance; this is for diagnostics and hit reports, not a second source of truth | Diagnostic geodetic latitude, longitude, ellipsoidal height, solver metadata, and residual/tolerance |
| WGS84 geodetic to ENU basis | Geodetic latitude/longitude and WGS84 datum | Compute `east`, `north`, and ellipsoid-normal `up` from latitude/longitude; validate orthonormality and right-handedness | Local ENU basis vectors in canonical ECEF coordinates |
| ECEF frame to reference globe model frame | ECEF position/basis plus the selected globe reference world adapter | For the first reference-proof slice, use canonical ECEF kilometers directly as the globe model frame and declare that with frame metadata; later app/browser adapters may add explicit axis maps | Globe `observer.positionKm`, target positions, local ENU basis, surface normals, and frame metadata in reference model coordinates |
| Globe model frame to ECEF diagnostics | Globe model point plus the inverse of the selected globe frame adapter | Apply the inverse axis map/origin/scale transform and validate round-trip error against the forward adapter | ECEF diagnostic point for reports, inverse tests, and future geodetic hit reports |
| Surface hit to globe shading frame | Model-space surface hit, WGS84 world model, and material/fixture id | Ask the world adapter for altitude and surface normal; build tangent basis from local ENU when geodetic metadata is available or from a stable normal fallback for analytic fixtures | Surface point, normal, tangent frame, material id, and optional geodetic diagnostics |

Flat world and projection transforms:

| Transform | Source-of-truth input(s) | Calculation | Output |
| --- | --- | --- | --- |
| Geodetic anchor to north-pole AE flat coordinates | Geodetic `latitudeDeg`, `longitudeDeg`, `elevationKmMsl`, projection id `north-pole-azimuthal-equidistant`, configured Earth radius for the selected flat world | `angularDistance = pi / 2 - latitude`; `radius = R * angularDistance`; longitude selects azimuth; height maps along flat local `up` from the projected sea-level plane | Flat projected ground coordinate, height, visibility within configured projection extent, projection diagnostics |
| Current flat app AE endpoint | Deferred app-rendering input: app scene root/geodetic point, current projection id, `meanEarthRadiusKm`, and elevation meters from the scene model | Later, current app convention maps `x = radius * sin(lon)`, `z = radius * cos(lon)`, and `y = elevationMeters / 1000`; this is a render endpoint convention, not the generic flat-world mathematical truth | Deferred Three/app scene position for current flat objects, Sun body, observer, and floor-relative assets |
| Flat explicit local origin to model position | Flat world declared `originKm`, `east`, `north`, `up`, local offset, and height | Normalize/validate basis; compute `origin + east * x + north * y + up * height` using the selected flat-world axis names | Model-space position and local basis metadata |
| Model point to flat altitude/lateral coordinates | Model-space point and flat world's `originKm`, `east`, `north`, `up`, and boundary metadata | `altitudeKm = dot(point - origin, up)`; lateral components are dot products against `east` and `north`; boundary checks use the world-owned disk/patch/dome/cylinder rule | Altitude, lateral coordinates, boundary membership, and named boundary reason when applicable |
| Flat atmosphere frame to shader uniforms | Deferred shader-parity input: flat atmosphere frame, profile id, source id, and current scene adapter | Later, flatten frame kind, origin, up vector, planet center/radius placeholders, atmosphere coefficients, and source fields into shader uniform values | Deferred shader uniform packet such as `atmosphereFrameOrigin`, `atmosphereFrameUp`, source uniforms, and frame kind id |

Camera and view transforms:

| Transform | Source-of-truth input(s) | Calculation | Output |
| --- | --- | --- | --- |
| Observer anchor to camera origin | Camera observer definition and selected world adapter | For WGS84, resolve height datum, geodetic point, ECEF, ENU, then model frame; for flat, resolve explicit model position or projected geodetic/local origin plus height | `observer.positionKm`, observer local frame, frame metadata, and observer diagnostics |
| Local azimuth/elevation to model direction | Observer local `east`, `north`, `up`, view `azimuthDeg`, `elevationDeg` | `dir = cos(el) * cos(az) * north + cos(el) * sin(az) * east + sin(el) * up`; normalize and validate | Model-space unit view direction plus azimuth/elevation diagnostics |
| Zenith to model direction | Observer local `up` | Use normalized local `up` | Model-space unit zenith direction |
| Target anchor to look direction | Target resolver output, observer position, and fixture surface metadata when present | Resolve target through WGS84 or flat projection, choose requested target point such as anchor/center/surface point, then normalize `targetPositionKm - observer.positionKm`; reject observer/target coincidence | Model-space unit look direction, target id, target point, and target frame diagnostics |
| Source state to `towardSun` direction | Selected solar-source adapter output and observer position | Distant Sun uses the source direction in model coordinates; local finite Sun uses `normalize(sunCenterPositionKm - observer.positionKm)`; unavailable direct light emits a warning rather than a fallback direction | Model-space unit direction and source availability diagnostics |
| Forward direction plus roll to camera basis | Camera-center forward direction, observer local plumb/up-down line, local fallback basis, and optional `rollDeg` | Default missing `rollDeg` to `0`; build zero-roll `cameraUp` as the local `up` vector projected onto the image plane so image vertical is parallel to plumb; when `forward` is too close to the plumb line, use the local `north/east` fallback; interpret `rollDeg` as a clockwise clock angle in the image plane with `0` at plumb-up/12 o'clock, `90` at 3 o'clock, `180` at 6 o'clock, and `270` at 9 o'clock | Orthonormal camera basis `forward`, `right`, `cameraUp`, normalized `rollDeg`, roll default/source metadata, plumb-line metadata, and fallback warning if used |
| Pinhole NDC sample to model ray | Camera basis, `verticalFovDeg`, `aspect`, and NDC `x,y` in `[-1, 1]` | `tanY = tan(verticalFovDeg / 2)`; `tanX = tanY * aspect`; `ray = normalize(forward + x * tanX * right + y * tanY * cameraUp)` | Trace request ray direction for the CPU reference, plus NDC/lens diagnostics |
| Benchmark ray to Three camera pose | Deferred browser-parity input: benchmark observer position, camera basis or look direction, vertical FOV/aspect, and selected scene frame | Later, set Three camera position to the scene/model position, camera up to resolved `cameraUp` or local `up`, `lookAt(position + forward)`, and projection parameters from lens settings | Deferred Three camera object state for browser parity captures |
| Framebuffer UV/depth to shader world ray | Deferred shader-parity input: Three camera projection inverse, view/world matrix inverse, framebuffer UV/NDC, and optional depth | Later, reconstruct clip/NDC position, multiply by inverse projection and camera world matrix, divide by `w`, and normalize from camera origin for sky rays or keep world point for depth-bearing surface composition | Deferred shader-side model/world ray or world position matching the benchmark frame |

Source, light, and visibility transforms:

| Transform | Source-of-truth input(s) | Calculation | Output |
| --- | --- | --- | --- |
| Distant Sun scenario to model direction | Scenario date/time/location plus selected solar-position provider, or an explicitly authored source direction | If ephemeris-backed, compute topocentric azimuth/elevation and then use the local azimuth/elevation transform; if explicitly authored, normalize the supplied model-frame direction and record that it bypassed ephemeris | Distant-Sun unit direction, angular radius metadata, source spectrum id, and availability/occlusion policy |
| Local finite Sun anchor to model body | Flat or globe source anchor, source radius, source radiance/irradiance calibration, and world adapter | Resolve the source anchor through the same target/world transform path as other geodetic or flat objects; preserve radius and source calibration fields | Sun center position, radius, body/render endpoint metadata, and source calibration diagnostics |
| Sample point to source sample | Medium or surface sample position and solar-source model output | For distant Sun, use constant direction and configured angular radius/solid angle; for finite Sun, compute vector to source center, distance, direction, angular radius or sampled-disk directions, and solid angle | Source sample direction, distance, solid angle, source spectrum/radiance or irradiance, and visibility seed |
| Sample point to source-path segment | Sample point, source sample, world/atmosphere/source occlusion rules | Ask the source/world adapter for the finite source transport segment; globe can stop on Earth occlusion, flat can stop at lateral/top boundary or source surface; no hidden numerical cap may create physical extent | Source-path ray segment samples, path length, boundary reason, and source visibility |

Object, surface, and deferred app endpoint transforms:

| Transform | Source-of-truth input(s) | Calculation | Output |
| --- | --- | --- | --- |
| Fixture-owned marker to object frame | Marker fixture id, geodetic anchor, shape, size, normal rule, and material id | Resolve anchor to model position; resolve normal from `facesObserver`, local `up`, surface normal, or explicit fixture normal; build tangent axes and object-local vertices from shape/size | Marker surface geometry, material id, hit ids, object local-to-model transform, and diagnostics |
| Object-local geometry to scene geometry | Fixture/object local vertices, normals, and object local-to-model transform | Apply the object transform to positions and inverse-transpose normal transform to normals; preserve material and hit ids | Scene/model-space mesh data for ray hits, Three objects, or shader parity snapshots |
| Scene/model point to shader uniforms | Deferred shader-parity input: model/world frame metadata, atmosphere frame, object/source positions, and renderer adapter | Later, pack vector tuples, scalar radii, frame kind ids, matrix uniforms, and source metadata into the shader's uniform representation without changing physical values | Deferred shader uniform map for atmosphere, surface, source, and camera reconstruction |
| Scene point to floor texture UV | Deferred app-rendering input: current flat floor mesh UV, texture rotation, floor projection metadata, and equirectangular floor texture source | Later, current shader rotates centered plane UV, converts projected AE ratio back to longitude/angular ratio, then maps to equirectangular texture UV | Deferred floor texture sample UV and texture-source diagnostics for current flat app rendering |
| Celestial RA/Dec to projected sky coordinate | Deferred sky-rendering input: star/celestial source `raDeg`, `decDeg`, reference right ascension, and selected celestial projection id | Later, current flat app uses north-celestial-pole azimuthal equidistant projection: `theta = ra - referenceRA`, `angularDistance = pi / 2 - dec`, scaled by sky projection radius | Deferred projected sky coordinate, angular distance, visibility flag, and celestial projection metadata |
| Projected sky coordinate to dome surface | Deferred app-rendering input: projected sky coordinate, max angular distance, and dome radius | Later, current app's upper-hemisphere lift maps angular-distance ratio to a hemisphere polar angle; `x/z` follow `theta`, `y = domeRadius * cos(polarAngle)`, and normals point inward for the dome | Deferred Three/app sky dome position, normal, visibility, and surface metadata |

## Benchmark Camera Adapter Details

The benchmark camera adapter is one consumer of the coordinate/transform core.
It should call the shared transforms for observer resolution, target/source
resolution, local frame construction, camera basis construction, NDC ray
generation, and the metadata later Three.js/browser parity will need. For the
current reference proof, the adapter output stops at
`observer.positionKm`, normalized `ray.direction`, sample rays, and
diagnostics for CLI artifacts. It should not own duplicate copies of WGS84,
flat projection, future object placement, shader, or texture-coordinate math.

Inputs owned by the camera adapter:

- `worldSet`: selects the coordinate family and the world adapter that owns
  model axes, surface radius or flat plane, local-up definition, and source
  geometry.
- `observer`: the camera origin. For globe benchmarks this may be geodetic
  `{ latitudeDeg, longitudeDeg, heightKm }`. For flat benchmarks this should be
  explicit model-space position or a named local origin plus height.
- `orientation`: camera-center direction as local `azimuthDeg`,
  `elevationDeg`, and optional `rollDeg`. Azimuth is clockwise from local
  north. Elevation is measured from the local horizon. `rollDeg = 0` means the
  image vertical is parallel to the local plumb line, implemented as projected
  local `up` in the image plane. Roll degrees are measured clockwise in the
  image plane with `0` at plumb-up/12 o'clock. Missing `rollDeg` defaults to
  `0` and is the normal unrolled camera state.
- `lens`: first-pass pinhole lens settings: `verticalFovDeg`, `aspect`, and
  optional near/far metadata for later browser parity. The transport ray itself
  does not use clip planes.
- `view`: the probe-specific ray selector, such as `zenith`,
  `azimuthElevation`, `towardSun`, `target`, or `ndc`.
- `targets`: optional named target anchors or fixture-owned marker surfaces.
  Default authoring should be geodetic latitude/longitude plus
  `elevationKmMsl`, with explicit alternate datums only when needed.

Reference data needed by the adapter:

- WGS84 ellipsoid constants from EPSG 7030: semi-major axis
  `6378.137 km` and inverse flattening `298.257223563`. Derive flattening,
  semi-minor axis, first eccentricity squared, and any top-atmosphere
  ellipsoid axes from these values.
- Default calibration observer: San Jose `latitudeDeg = 37.3382`,
  `longitudeDeg = -121.8863`, `heightKm = 0.03048` for the current eye-height
  convention. Treat this height as ellipsoidal height unless a benchmark
  explicitly says otherwise.
- Local east/north/up basis rules. Use a standard ECEF-to-ENU derivation for
  globe cameras, then map that canonical basis into the project model axes in
  one tested adapter layer. ESA Navipedia's ECEF/ENU transform is the current
  source for the ENU basis.
- World-axis declarations for flat cameras: constant `up`, explicit `north`
  and `east`, lateral-boundary metadata, and the origin used by app defaults or
  hypothesis worlds.
- Flat projection declarations for adapting geodetic anchors. The default
  Phase 6A flat projection is north-pole-centered azimuthal equidistant unless
  a later benchmark explicitly selects another projection.
- Source state for `towardSun` views: distant-Sun direction or finite local
  Sun position/radius at the selected benchmark time/configuration.
- Review artifact settings: FOV, aspect, NDC sample layout, and patch/grid
  dimensions. These are camera/report facts, not transport-stage physics.

Outputs should be deterministic and inspectable:

- `traceRequest.observer.positionKm`: finite model-space origin in kilometers.
- `traceRequest.ray.direction`: finite normalized model-space direction.
- `cameraDiagnostics`: camera id, world frame id, observer source fields,
  resolved origin, local basis vectors, camera basis vectors, FOV/aspect,
  selected probe id, selected view kind, target/source ids used, and warnings.
- Optional `sampleRays`: named rays for a sky patch or NDC grid, each with the
  same observer origin and its own normalized direction.

First-pass globe algorithm:

1. Convert geodetic degrees to radians and resolve a WGS84 ellipsoid frame.
   Use EPSG 7030's semi-major axis and inverse flattening as the only
   canonical constants.
2. Compute derived ellipsoid values:

   ```text
   f = 1 / inverseFlattening
   e2 = f * (2 - f)
   N = semiMajorAxisKm / sqrt(1 - e2 * sin(latitude)^2)
   ```

3. Convert geodetic observer coordinates to canonical ECEF kilometers:

   ```text
   x = (N + heightKm) * cos(latitude) * cos(longitude)
   y = (N + heightKm) * cos(latitude) * sin(longitude)
   z = (N * (1 - e2) + heightKm) * sin(latitude)
   ```

4. Build canonical local ENU basis in the same ECEF frame using ellipsoidal
   latitude and longitude:

   ```text
   east  = [-sin(lon), cos(lon), 0]
   north = [-sin(lat) * cos(lon), -sin(lat) * sin(lon), cos(lat)]
   up    = [cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat)]
   ```

5. Map the ECEF observer and canonical ECEF basis into the project model axes
   exactly once. The mapper must be named and tested because the app's visual
   axes are a local convention, not an external geodesy fact.
6. Emit `observer.positionKm` from the mapped ECEF position. Emit local `up` as
   the mapped ellipsoid-normal ENU up vector, not a geocentric radial vector.

First-pass flat algorithm:

1. Resolve the flat world's declared local frame: origin, constant `up`,
   `north`, `east`, and distance units.
2. Resolve the observer from either explicit `positionKm` or from a named local
   origin plus height along `up`.
3. Preserve boundary/source hypothesis metadata in diagnostics so a camera ray
   looking across the plane cannot hide the chosen lateral extent.

Shared view-direction algorithm:

1. For `azimuthElevation`, compute a local direction from azimuth/elevation:

   ```text
   dir =
     cos(elevation) * cos(azimuth) * north
     + cos(elevation) * sin(azimuth) * east
     + sin(elevation) * up
   ```

   This convention makes `azimuthDeg = 0`, `elevationDeg = 0` point north along
   the horizon; `azimuthDeg = 90`, `elevationDeg = 0` point east; and
   `elevationDeg = 90` point to zenith.
2. For `zenith`, use `up`.
3. For `towardSun`, use the selected source adapter: distant Sun uses its
   source direction; local finite Sun uses
   `normalize(sunCenterPositionKm - observer.positionKm)`. If direct light is
   unavailable, return a diagnostic warning rather than inventing a fallback
   direction.
4. For `target`, use `normalize(targetPositionKm - observer.positionKm)` and
   reject a target at the observer position.
5. For `ndc`, first construct the camera-center `forward` direction from the
   camera orientation, then apply the pinhole ray step below.

Shared pinhole/NDC algorithm:

1. Resolve `forward` from camera orientation or a target direction.
2. Build a stable zero-roll camera basis from the plumb reference. Project the
   local `up` vector onto the image plane perpendicular to `forward`; the
   resulting `cameraUp` makes image vertical parallel to the local plumb
   up/down line. When `forward` is too close to the plumb line and the
   projection would be degenerate, use the local `north/east` fallback so
   zenith or nadir views do not produce a zero cross product.
3. Resolve missing `rollDeg` to `0`, recording whether the value was explicit
   or defaulted. Apply `rollDeg` as a clockwise clock angle in the image plane
   after the
   plumb-aligned basis is built: `0` keeps the top of the image at plumb-up/
   12 o'clock, `90` places it at 3 o'clock, `180` at 6 o'clock, and `270` at
   9 o'clock. The implementation may convert that screen convention into the
   required model-space rotation sign, but public diagnostics and tests should
   use the clock-angle convention.
4. Interpret NDC sample coordinates as `x,y` in `[-1, 1]`, with positive `y`
   up in the image.
5. Compute the ray:

   ```text
   tanY = tan(verticalFovDeg / 2)
   tanX = tanY * aspect
   ray = normalize(forward + x * tanX * right + y * tanY * cameraUp)
   ```

   The center sample `(0, 0)` must equal `forward`.

Target encoding:

- Default benchmark targets should be authored as geodetic anchors:

  ```json
  {
    "id": "marker.red.anchor",
    "kind": "geodetic",
    "latitudeDeg": 37.3382,
    "longitudeDeg": -121.9363,
    "elevationKmMsl": 0.05
  }
  ```

- `elevationKmMsl` means height above the benchmark's sea-level reference
  surface. For flat worlds, sea level maps naturally to the projected ground
  plane plus local `up`. For WGS84 worlds, the resolver must record which
  sea-level datum it used. If no geoid or terrain model is configured in Phase
  6A, use the WGS84 ellipsoid as the temporary sea-level surface and emit
  `heightDatum: "wgs84-ellipsoid-as-msl"` in diagnostics so the approximation
  is visible.
- A second geodetic anchor form may specify distance from Earth's center for
  cases that genuinely need a geocentric radius:

  ```json
  {
    "id": "target.geocentricShell",
    "kind": "geodetic",
    "latitudeDeg": 37.3382,
    "longitudeDeg": -121.9363,
    "distanceFromEarthCenterKm": 6378.5
  }
  ```

  Do not combine `elevationKmMsl` and `distanceFromEarthCenterKm` in one
  target. Center-distance targets are useful for controlled geometry and
  shell-like probes; sea-level-relative targets are the default for markers,
  terrain, and flat adaptation.
- Flat-world hypothesis runs adapt geodetic target anchors through the
  north-pole-centered azimuthal equidistant projection unless a scenario
  explicitly declares another projection later. In that default projection:
  longitude selects azimuth around the north-pole origin, distance from the
  pole is proportional to angular distance from `90 deg` north latitude, and
  `elevationKmMsl` becomes height along the flat world's local `up`.
- Direct model-space points remain allowed for low-level tests, generated
  diagnostics, and shader-parity snapshots after the camera/world transforms
  are already proven. They should not be the default hand-authored benchmark
  target format.
- Local bearing/range targets remain useful for short-range camera ergonomics,
  but they should usually be derived from, or expanded into, a named geodetic
  target anchor in generated diagnostics. Absolute geodetic anchors make it
  easier to change observer locations, compare globe and flat runs, and move a
  benchmark to another city without rewriting observer-relative offsets.
- Fixture-owned marker surfaces should wrap target anchors when the ray is
  supposed to hit a visible object. The fixture owns shape, size, normal,
  albedo/material, and target ids such as `marker.red.center`:

  ```json
  {
    "id": "marker.red",
    "kind": "fixtureSurface",
    "anchor": "marker.red.anchor",
    "surface": {
      "shape": "squarePatch",
      "sizeKm": 0.05,
      "normalKind": "facesObserver",
      "material": "lambertian.red"
    }
  }
  ```

  A bare point is enough to aim a ray. A colored marker, target patch, terrain
  sample, or surface-radiance benchmark must be fixture-owned so material and
  hit behavior have one source of truth.

Validation and diagnostics:

- Reject non-finite observer fields, invalid lat/lon ranges, unknown
  `positionKind`, unknown view kinds, invalid FOV, nonpositive aspect, unknown
  camera/probe/target ids, invalid or mixed target height datums,
  non-normalizable basis vectors, and observer/target coincidences.
- Accept `verticalFovDeg` only inside `(0, 180)`. Very wide FOVs may be useful
  later, but the first pinhole adapter should reject singular values.
- Emit warnings, not silent corrections, for source-unavailable `towardSun`
  views, flat-world boundary dependencies, or camera definitions that use
  hypothesis values rather than Earth-calibration values.

First tests for this adapter should be domain and contract tests, not image
approval tests:

- globe ENU basis vectors are orthonormal for a simple reference location;
- San Jose geodetic observer resolves to a finite model-space origin and local
  basis;
- flat cameras preserve the declared constant up/north/east frame;
- azimuth/elevation rows resolve north, east, and zenith directions;
- NDC center equals `forward`, symmetric left/right samples mirror the
  `right` component, and top samples increase the `cameraUp` component;
- `rollDeg = 0` keeps image vertical parallel to the local plumb line, and
  roll degrees increase clockwise with `0` at plumb-up/12 o'clock;
- missing `rollDeg` defaults to `0` and produces the same camera basis as an
  explicit `rollDeg: 0`, while diagnostics record whether the value was
  defaulted;
- `towardSun` uses the selected source adapter and reports unavailable direct
  light;
- geodetic targets resolve through WGS84 for globe benchmarks and through the
  north-pole-centered azimuthal equidistant projection for flat benchmarks;
- target rows reject mixed `elevationKmMsl` and
  `distanceFromEarthCenterKm` datums;
- fixture-owned marker surfaces preserve anchor, shape, material, and hit ids
  as one target source of truth;
- derived transform cache keys change when observer, target, projection,
  datum, time, lens, orientation, or frame metadata changes, while cache hits
  reproduce the same resolved observer/ray and scene endpoint data;
- invalid FOV/aspect/ids/targets fail before transport stages run;
- the adapter has no React, Three.js, DOM, renderer, or shader dependency.

Open camera questions:

- The exact named `frameId` values and emitted metadata shape for the first
  globe and flat reference model-frame adapters.
- First canonical FOV/aspect and NDC grid for sky-patch visual artifacts.
- Browser/Three.js parity confirmation that the screen uses the same clockwise
  clock-angle `rollDeg` convention. This is deferred from the reference-proof
  slice and should not block CPU reference camera benchmarks.
- Whether Phase 6A should add a real geoid/terrain sea-level source or keep
  the explicit `wgs84-ellipsoid-as-msl` approximation until terrain work.

The first named visual probes should be:

- `midday.zenith`: sky ray straight up with the Sun high.
- `midday.sideSky`: sky ray around `90 deg` scattering angle.
- `midday.horizon`: near-horizon sky ray away from the Sun.
- `sunset.horizon`: low-Sun horizon ray, no celestial disk required.
- `towardSun.nearDisk`: ray close to the Sun direction, initially excluding
  the visible disk if disk rendering is not implemented.
- `midnight.zenith`: no-direct-Sun sky ray, expected black unless diffuse,
  lunar, stellar, artificial, or emissive terms are explicitly configured.
- `surface.nearGround`: surface hit at a short known distance.
- `surface.farGround`: long surface or terrain-like hit for transmittance and
  haze diagnostics.
- `marker.red`: controlled colored Lambertian target for tracking spectral
  attenuation and display conversion.

Each probe should declare its purpose: `analytic`, `invariant`,
`reference-data`, `cross-model`, `visual-benchmark`, or future
`shader-parity`. Visual benchmarks can be subjective, but their inputs and
outputs must still be deterministic.

## Benchmark Scenario Files

Add a scenario format separate from the low-level stage fixtures. Stage
fixtures prove equations and packet contracts; benchmark scenarios assemble
worlds and cameras for visual/numeric review.

Suggested shape:

```json
{
  "kind": "flat-atmosphere-reference-benchmark",
  "id": "earth-globe-clear-day-basic-sky",
  "worldSet": "earth.globe.clearDay",
  "wavelengthsNm": { "start": 380, "end": 780, "step": 10 },
  "numerical": {
    "viewSteps": 64,
    "sunTransmittanceSteps": 32,
    "integrationMethod": "midpoint"
  },
  "display": {
    "colorMatching": "cie-1931-2deg",
    "rgbSpace": "linear-srgb",
    "exposure": { "kind": "fixed", "scale": 1 }
  },
  "cameras": [],
  "probes": [],
  "review": {
    "intent": "Evaluate daylight sky color and horizon gradient before shader parity.",
    "notes": []
  }
}
```

The CLI should be able to run one scenario file or a subset of probes. Outputs
should include:

- deterministic JSON with scenario metadata, exact world/camera/probe ids,
  spectral radiance, XYZ, linear RGB, display RGB, diagnostics, sample counts,
  thresholds, and warnings;
- Markdown report with tables, swatches, curves, and short diagnostic
  explanations;
- SVG, PNG, PPM, or another explicitly selected benchmark artifact with stable
  pixel/layout semantics for visual review;
- optional compact summary for terminal iteration.

Do not treat screenshots or generated SVGs as the only evidence. The JSON
diagnostics are the source of truth; images and Markdown make the results easy
to inspect.

Pixel artifact generation is a post-pipeline consumer. It takes display RGB or
linear RGB plus an explicit output-encoding policy and writes pixels. It does
not change spectral radiance, XYZ, linear RGB, optical depth, or component
diagnostics. First artifact tests should pin small known arrays so byte output,
gamma/clamp behavior, row order, and deterministic metadata are not guessed
from visual inspection.

## Quantitative And Subjective Review

The benchmark layer should support two review modes:

- Quantitative review: compare exact diagnostics, transmittance curves,
  spectral radiance arrays, XYZ/linear RGB values, threshold crossings, and
  later shader-vs-reference errors.
- Subjective review: inspect generated sky patches, horizon gradients, and
  surface/marker swatches to decide whether the benchmark looks plausible for
  the intended world.

Subjective review should never become an unrecorded tuning loop. If a result
looks wrong, record the suspected cause and the proposed physical/configuration
change: spectrum, colorimetry, atmosphere coefficients, aerosol phase, ozone,
Sun elevation, exposure, camera direction, flat boundary, or source
calibration. Then rerun the CLI and compare the updated diagnostics.

## Shader-Parity Readiness Gate

Before the shader parity harness starts, the benchmark layer should have:

- at least one globe sky scenario and one globe surface scenario;
- at least one flat sky scenario and one flat surface scenario;
- canonical spectral-to-XYZ-to-linear-RGB conversion outside transport stages;
- fixed camera/probe definitions that can be mapped to browser captures;
- deterministic JSON and visual artifacts committed or reproducible by command;
- documented tolerances or review bands for the quantities that will be
  compared to shader output;
- explicit notes for any benchmark that is a hypothesis rather than an
  Earth-validation case.

Only then should shader work consume the benchmarks as parity targets.

## Diagnostics Contract

The return value should include enough information to explain the pixel:

```text
{
  wavelengthsNm,
  spectralRadiance,
  xyz,
  linearRgb,
  components: {
    surfaceRadiance,
    rayleighInScattering,
    mieInScattering,
    absorptionLoss,
    directSolarIrradiance,
    diffuseSkyIrradiance
  },
  opticalDepth: {
    view,
    sun,
    rayleighView,
    mieView,
    absorberView
  },
  geometry: {
    viewDistanceKm,
    atmosphereDistanceKm,
    surfaceHit,
    sunSamples,
    scatteringAngles
  }
}
```

Diagnostics are not optional decoration. They are how we prevent muted
blue-gray skies, brown horizons, and pink marker airlight from being solved by
guessing at constants.

## Test-First Design

This module should be built test-first. For each physical subsystem:

1. Write the fixture.
2. Write analytic, invariant, reference-data, or cross-model tests.
3. Confirm the tests fail for missing behavior.
4. Implement until they pass.
5. Add diagnostics.
6. Only then compare shader output.

Shader parity tests should be last in the chain. They are meaningful only after
the CPU reference has earned trust with known-answer tests.

## Shader Boundary

The shader is allowed to be approximate. The CPU reference is allowed to be
slow. The comparison contract should be:

```text
CPU spectral reference -> expected physical radiance/color
GPU shader -> fast approximation
parity harness -> named per-probe tolerance
```

Tolerances should be strict for vacuum/transmittance-only cases, moderate for
clear-sky single scattering, and looser near the horizon or in Mie-heavy paths.

The expected shader shape should follow the same high-level control flow as the
reference transport core:

```text
one pixel invocation
  resolve camera ray
  march view samples
  evaluate atmosphere/source terms per sample
  accumulate RGB or reduced spectral radiance approximation
  composite surface term if present
  output pre-display linear color for parity
```

The difference is representation, not conceptual flow. The reference carries a
spectral grid, detailed diagnostics, and slower source-path integration. The
shader may use RGB coefficients, lookup tables, precomputed transmittance, fewer
samples, or fused math. Those approximations should be described later in terms
of which canonical pipeline quantities they replace.

A shader-specific design document is intentionally deferred. Create it later
only after the CPU spectral reference integrator has passing known-answer tests
and the project is ready to specify GPU approximation choices, shader parity
probes, tolerance budgets, and browser capture/debug hooks.

## Future Cloud Compatibility

Clouds are not part of the first reset, but the design should leave a clean
path for them. A cloud should enter the model as another participating medium,
not as a display overlay or color multiplier. The same camera ray should see
clear air, aerosols, and clouds through one transport calculation.

Cloud-relevant physical properties include:

- cloud volume or coverage field: where cloud material exists in 3D space
- liquid-water or ice-water content: how much condensate exists per volume
- particle effective radius and size distribution: controls extinction,
  scattering strength, and phase shape
- single-scattering albedo: fraction of extinction that scatters rather than
  absorbs
- phase function: strongly forward-scattering water/ice behavior, usually more
  complex than the clear-air aerosol approximation
- vertical and horizontal density structure: layers, cells, noise fields, or
  externally supplied grids

The current pipeline already has the right insertion points:

- `resolveRayPath` can later intersect cloud volumes or choose a sampling
  domain that covers both clear air and clouds.
- `evaluateMedium` can return cloud species coefficients beside Rayleigh,
  aerosol/Mie, and absorber coefficients.
- `integrateViewOpticalDepth` and `integrateSolarTransmittance` naturally
  include cloud extinction once cloud coefficients are present.
- `integrateSingleScattering` can add cloud in-scattering for optically thin
  cloud, mist, or haze cases.
- `resolveSurfaceRadiance` can receive reduced direct irradiance and cloud
  shadowing from the same source-transmittance calculation.
- A post-pipeline diagnostics consumer should separate clear-air, aerosol,
  cloud-water, and cloud-ice optical depths and radiance components when those
  species exist.

The first cloud-capable extension should probably be a simple homogeneous or
exponential cloud slab test, not a visual cloud system. That gives known-answer
optical depth and transmittance tests before adding procedural shapes.

Realistic clouds will eventually require physics beyond the first reference:
multiple scattering, self-shadowing, high optical-depth numerical methods,
possibly delta tracking or grid traversal, and practical shader approximations.
Those should be added as named extensions after the clear-air single-scattering
reference is trusted. The important design rule now is to keep the medium
interface spatial and species-based so cloud physics can be added without
rewriting the world/source/color contracts.

## Deferred Physical Effects Ledger

Later, before treating the reference design as complete, add an explicit ledger
of physical effects that are intentionally outside the first pipeline but could
nontrivially affect atmospheric appearance or diagnostics. The ledger should
not be a vague non-goals list. For each omitted effect, record:

- what physical effect is omitted
- what visible or numeric result it could change
- why it is deferred from the first clear-air single-scattering reference
- which canonical pipeline stage or model contract would need to change
- what external reference or known-answer test would be needed before adding it

Refraction is the anchor example for this ledger: it can bend near-horizon
view rays and solar paths, change apparent object and Sun positions, alter
optical path lengths, and affect horizon/terminator behavior. It is deferred
from the first pipeline so the initial reference can validate straight-line
radiative transfer, optical depth, single scattering, surface radiance, and
spectral color conversion before adding curved-ray geometry.

## Migration From Current Code

Current useful material to mine:

- `src/flat/shared/Atmosphere.js`: existing profile validation, density,
  phase-function, optical-depth, and frame ideas.
- `src/flat/shared/consts.js`: Earth radius and current atmosphere presets.
- `src/flat/features/globe-simulation/models/consts.js`: astronomical unit,
  solar radius, axial tilt, default solar source values.
- `src/flat/features/globe-simulation/components/GlobeAtmosphereComposer.jsx`:
  shader approximation to test against, not the source of truth.
- `src/flat/shared/RadiometricDisplay.js`: current display bridge to replace
  with explicit spectral-to-color and display choices.

Use the architecture of the current iteration as raw material, not as a
compatibility constraint. The first script implementation can start fresh,
borrow names and shapes that still make sense, and cleanly reject prior
mixed-unit bridges. Do not preserve compatibility aliases if a contract
changes. New physical contracts should replace old mixed-unit bridges across
code, tests, fixtures, and docs.

## Non-Goals

- No clouds in the first reset, but the medium contracts should remain
  cloud-compatible.
- No weather system in the first reset.
- No terrain dependency for the first reference integrator.
- No multiple scattering until single scattering and diagnostics are trusted.
- No shader-driven truth. The shader follows the reference, not the reverse.

## Open Design Decisions

- First canonical solar spectrum source and redistribution/attribution path.
- First canonical wavelength grid for tests versus browser parity.
- Whether ozone belongs in Phase 1 or after single-scattering parity.
- First canonical colorimetry data source, interpolation policy, and whether
  checked benchmark artifacts can bundle the selected CIE table or must load it
  from a generated/local-provenance artifact.
- Whether the first flat atmosphere is a slab, dome, finite cylinder, or local
  computational patch.
- What source-backed or explicitly hypothetical lateral boundary defines
  atmosphere path length when looking across a large flat Earth.
- Whether local Sun source calibration starts from target DNI, target spectral
  radiance, or target apparent angular size plus DNI.
- First benchmark world set names and defaults, especially whether
  `flat.appDefaults.localSun` is strictly a compatibility benchmark or also
  seeds a physically labeled hypothesis variant.
- First canonical camera/date/location for globe daylight, sunset, and
  midnight benchmarks.
- First camera coordinate convention for flat benchmarks: app world axes,
  local east/north/up, azimuth/elevation, or explicit model-space rays.
- First benchmark scenario JSON schema and whether it should be schema
  validated before or after the initial CLI benchmark runner lands.
- Which visual artifacts should be checked in as benchmark evidence versus
  generated under `tmp/`.
- Which fixed exposure or display-review policy makes benchmark images
  inspectable while preserving raw physical radiance diagnostics.
- What quantitative review bands are useful before shader parity: sky RGB
  ratios, horizon/zenith luminance ratio, transmittance floors, component
  percentages, or only raw diagnostics at first.
- When shader parity work begins, whether it needs its own shader-specific
  design document.
