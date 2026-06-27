# Reference Code Design

This document designs the slow truth engine for the atmosphere reset. It is a
focused companion to the project-level [Atmosphere Reset Design](../design.md).
The canonical stage input/output packet contracts live in
[Stage Contracts](stage_contracts.md). The implementation sequence lives in
[Plan](plan.md), and the stage test matrix lives in [Test Design](test_design.md).

## Purpose

The CPU spectral reference integrator answers one question:

```text
Given a world model, atmosphere model, solar source, observer, and camera ray,
what spectral radiance reaches the camera?
```

It should be slow, explicit, deterministic, and heavily diagnosed. It is not
the production renderer. It is the reference that production shaders, display
bridges, and shortcuts must be compared against.

The first implementation should live under:

```text
scripts/flat/atmosphere_rejected/reference/
```

This keeps the truth engine outside app runtime code while we are still
validating contracts. Later, proven pure helpers can be promoted into
`src/flat/shared` if app reuse becomes necessary.

## Non-Goals

- It is not optimized for frame-rate rendering.
- It does not own React, Three.js, render targets, or browser capture.
- It does not tune screenshots.
- It does not hide missing physics behind display multipliers.
- It does not implement multiple scattering in the first pass.

## Package-Separable Direction

Treat this reference as a candidate standalone package even while it still
lives inside the repo. The first goal remains correctness for the flat project,
but local design choices should not trap the integrator inside this app.

Package-ready constraints:

- The core library must stay framework-free: no React, Three.js, DOM, browser
  renderer, route, or local app-service dependency.
- Public inputs and outputs must be plain data structures that can be built
  from JSON and inspected in tests.
- The public API must be explicitly documented before it is treated as stable.
  Until then, the future package should be considered `0.y.z` initial
  development under Semantic Versioning.
- Physical constants, model choices, spectral data, and reference fixtures must
  be externally justified and traceable through
  [Reference Decision Log](references.md).
- Runtime code must not depend on repository-relative paths. Fixtures, optional
  data importers, and CLI examples can use repo paths while the package is
  incubating.
- Runtime dependencies should be minimal and boring. Heavy or licensed data
  tables should be optional fixtures or importer inputs unless their
  redistribution rights are clear.
- Internal math helpers are acceptable while the domain contract is being
  discovered, but they should remain replaceable. Prefer a validated external
  library when it has stronger provenance, standards alignment, numerical
  coverage, licensing, and maintenance than a local helper.
- The CLI should be a package-facing executable over the same public API, not a
  second implementation path.
- Test fixtures should be publishable evidence: analytic cases, invariants,
  pinned external datasets, deterministic JSON probes, and human-readable
  Markdown reports.

External precedent:

- libRadtran is a standalone radiative-transfer software package with programs,
  documentation, reference publications, and releases.
- SMARTS is a standalone clear-sky spectral irradiance model with text inputs,
  ASCII outputs, specified atmospheric conditions, and reference-spectrum use.
- Bruneton's atmosphere implementation separates a CPU reference/testing path
  from shader use and uses full spectral CPU renderings as validation evidence.
- SemVer requires a clear public API and ties version changes to compatibility.

Promotion to a separate package should therefore be a documentation and
validation milestone, not just a file move. Before extraction, the reference
needs a named public API, stable fixtures, clear data licensing/provenance,
external-reference citations, and a repeatable verification command.

## External Dependency Policy

The reference can start with small internal helpers where they make the domain
contract easier to see. That should not become a permanent bias toward
hand-rolled math. If a well-validated external library provides a stronger
implementation for colorimetry, spectral interpolation, quadrature, linear
algebra, solar geometry, atmospheric profiles, or data ingestion, we should be
willing to replace local helpers.

Adoption rules:

- The expected behavior must already be stated by domain tests or pinned
  reference data before swapping the implementation.
- The library must not become the test oracle merely because the code calls it.
  Tests still derive expectations from physics, standards, analytic answers,
  invariants, or pinned external data.
- The library's provenance must be recorded in
  [Reference Decision Log](references.md): source, purpose, validation basis,
  license, redistribution constraints, version policy, and assumptions.
- Use a narrow local wrapper around external library calls so package users do
  not inherit accidental vendor API shape.
- Keep units explicit at the wrapper boundary.
- Compare the library-backed path against existing fixtures before removing the
  local helper.
- Prefer deterministic, pure, Node-friendly dependencies. Native, networked,
  heavyweight, or data-licensed dependencies need an explicit reason and may be
  better as optional importers or comparison tools.
- If an external dependency changes numerical behavior, treat that as a
  domain-facing change and update tests, tolerances, release notes, and SemVer
  impact deliberately.

Candidate areas to research before promotion:

- CIE/colorimetry table handling and XYZ/RGB conversion.
- Spectral table interpolation and integration.
- Numerical quadrature and convergence checks.
- Vector and matrix math for plain-data rays and transforms.
- Solar position and astronomical constants.
- Atmospheric profile tables and interpolation.
- Radiative-transfer comparison tooling for full-run validation.

## Inputs

The integrator takes an immutable request object:

```text
{
  model,
  observer,
  ray,
  wavelengthsNm,
  numerical
}
```

Where:

- `model.world` answers surface/altitude/up questions.
- `model.atmosphere` answers volume, density, extinction, and scattering
  questions.
- `model.solarSource` answers distant-Sun or local finite-Sun source questions.
- `model.surface` answers material reflection for surface hits.
- `observer.positionKm` is the camera origin in model coordinates.
- `ray.direction` is a finite nonzero orientation vector. Its magnitude is not
  physical input; `validateRequest` canonicalizes it to a unit vector for
  downstream transport.
- `wavelengthsNm` is the spectral sample grid.
- `numerical` contains only approximation controls.

This is a greenfield reference contract. Keep one current name for each
concept, and do not add alternate names, fallback behavior, or migration
bridges.

Camera/display conversion and report shaping are consumers of the pipeline
result, not pipeline inputs. They should be modeled as separate APIs that take
the spectral result or diagnostics after transport has completed. No pipeline
stage should receive camera/display settings, report-format options, exposure,
tone mapping, or output-selection flags as input.

## Public API Shape

Use a class facade over explicit pipeline stages. The class makes the reference
pleasant to use from tests and the CLI; the stages keep the physical flow
visible and independently testable.

```js
const integrator = new CpuSpectralReferenceIntegrator({
	model,
	wavelengthsNm,
	numerical,
});

const result = integrator.traceRay({ observer, ray });
const partial = integrator.runUntil('integrateViewOpticalDepth', { observer, ray });
const packet = integrator.runStage('evaluateMedium', preparedPacket);
```

Preferred methods:

- `traceRay({ observer, ray })`: run the full pipeline for one explicit ray.
- `traceProbe(probe)`: resolve a named or JSON-defined probe to a ray, then
  run it.
- `resolveProbeRequest(probe)`: resolve an inline or nested probe to a trace
  request. Scalar probes and name-only probe objects reject until a named probe
  fixture registry exists.
- `mergeRequest(request)`: merge per-call request values over integrator
  defaults.
- `createInitialPacket(request)`: validate only the request envelope and build
  the initial packet shape for direct stage tests.
- `runStage(stageId, packet)`: run exactly one stage against an already prepared
  packet.
- `runUntil(stageId, request)`: run stages through a named point for tests and
  diagnostics.
- `listStages()`: return stable stage ids for tests and CLI help.
- `getStage(stageId)`: return the declarative stage descriptor with `requires`
  and `provides`.

### Integrator Facade Contract

The public facade contract is:

- `traceRay(request)` returns the full internal packet after the final
  transport stage. The full packet is the public diagnostic result boundary for
  now.
- `stageHistory` is public diagnostic metadata. It is an ordered array of
  successfully executed stage ids, starting as `[]` in `createInitialPacket`,
  appending one id per successful `runStage`, stopping at and including the
  target for `runUntil`, and containing the full configured stage order for
  `traceRay`.
- Normal public construction uses the canonical stage registry. Passing a
  custom `stages` list into the constructor is an internal test harness
  capability, not an officially supported package/API contract.
- Custom stage harness descriptors must be an ordered array with unique ids,
  `requires`/`provides` arrays, and a `StageClass` constructor. The integrator
  no longer falls back to placeholder helpers; every configured descriptor must
  name its executable helper.
- `mergeRequest(request)` clones caller/default data, then shallow-merges
  request values over constructor defaults. `numerical` controls shallow-merge
  by control name.
- `createInitialPacket(request)` builds a cloned packet from the merged request
  and carries convenience `model`, `observer`, `ray`, `wavelengthsNm`, and
  `numerical` fields beside the canonical `request` envelope.
- The model bundle is preserved by reference because it is a behavior provider
  with functions and model-owned state. Request data objects and arrays owned
  by the facade are cloned before reuse.
- No facade method or stage dispatch path may mutate caller-owned requests,
  constructor default data, probes, or prepared stage packets. Stages return
  new packets with appended derived data.
- Constructor defaults are validated when supplied. Missing defaults are
  allowed so callers can provide required request fields per trace.
- `runStage(stageId, packet)` accepts only registered stage ids and prepared
  packets with the descriptor-required fields.
- `traceRay(request)` always runs every configured stage in order.
- `runUntil(stageId, request)` returns the packet immediately after the
  requested stage has run.

The canonical stage input/output definitions live in
[Stage Contracts](stage_contracts.md). The project-level stage vocabulary lives
in [Atmosphere Reset Design](../design.md#canonical-pipeline-stages).
Preferred internal stage flow:

```text
validateRequest
resolveRayPath
sampleViewPath
evaluateMedium
integrateViewOpticalDepth
integrateSolarTransmittance
evaluateScatteringPhase
integrateSingleScattering
resolveSurfaceRadiance
composeSpectralRadiance
```

Each stage should accept and return a packet. The packet is append-only in
spirit: stages add derived data rather than mutating source inputs in
surprising ways.

### Stage Boundary Ownership

The canonical input/output contract for each stage lives in
[Stage Contracts](stage_contracts.md). This section records the implementation
rules that keep code and tests aligned with that contract.

Each stage is responsible for validating the packet fields and model-returned
data it consumes. Upstream stages should normally produce valid packets, but a
stage must still fail loudly at its own boundary when direct stage tests or a
broken neighbor provide malformed input.

When a producer and consumer disagree about packet shape, resolve the contract
by choosing the single canonical form that is most useful downstream. Prefer
fields that let later stages avoid re-querying models, preserve useful
diagnostics, and keep units and identifiers unambiguous. Do not preserve
alternate names, legacy shapes, or parallel sources of truth.

Derived values are allowed when they are cheap and unambiguous from canonical
input data. If a derived value is useful enough to carry downstream, derive it
once at the owning stage, record its provenance, and validate any
model-provided duplicate against the same relationship. If a value is easily
derived but not useful downstream, leave it out and let the consumer derive it
locally from the canonical source.

The main control flow is the independent stage runner described in
[Atmosphere Reset Design](../design.md#pipeline-control-flow). Every canonical
stage must be directly runnable through `CpuSpectralReferenceIntegrator` for
tests. The full `traceRay` method should compose those same class-owned stage
methods rather than using a hidden alternate path.

Stage descriptors should have this shape:

```js
{
	id: 'evaluateMedium',
	requires: ['model', 'wavelengthsNm', 'viewSamples'],
	provides: ['mediumSamples'],
	StageClass: EvaluateMediumStage,
}
```

`runStage` should validate the descriptor's `requires` list before dispatching
to the matching class-owned stage implementation. Missing prerequisites should
produce test-friendly errors such as
`evaluateMedium requires viewSamples`.

The integrator facade should live in `CpuSpectralReferenceIntegrator.js` to
match class file naming conventions. Stage helper classes live under
`scripts/flat/atmosphere_rejected/reference/stages`, also using class file names such as
`ResolveRayPathStage.js`. `pipeline-stages.js` remains the canonical registry:
it stores stage ids, prerequisites, provided packet fields, and the helper
class constructor. Complex API shapes should live in the nearby ambient
`types.d.ts` file and be referenced from JSDoc in the plain JavaScript
implementation.

Class files should export their class as the default export and should export
nothing else. Package barrels such as `index.js` may re-export those defaults
under public API names, but the class module itself stays single-purpose.

Each canonical physical stage should have a focused helper class. The helper is
an implementation detail behind the integrator facade, not a second public
pipeline surface. `runStage(stageId, packet)` remains the public way to run a
stage independently and the authority used by stage specs.

The common helper-class shape is:

```js
const helper = new ResolveRayPathStage({
	descriptor: integrator.getStage('resolveRayPath'),
	context: integrator.context,
});

const nextPacket = helper.run(packet);
```

So the shared helper method signature is:

```text
run(packet) -> packet
```

The stage descriptor and integrator context are constructor dependencies, not
per-call inputs. That keeps stage execution uniform, keeps prerequisite
checking in `CpuSpectralReferenceIntegrator.runStage`, and lets each helper
carry its own descriptor id/provided fields for history, diagnostics, and error
messages.

The integrator should own helper construction and dispatch:

```js
runStage(stageId, packet) {
	const descriptor = this.getStage(stageId);
	assertStagePrerequisites(descriptor, packet);
	return this.stageHelpers.get(stageId).run(packet);
}
```

Helper specs can exercise internal algorithms directly when useful, but
integrator stage specs should continue to assert public `runStage(stageId,
packet)` input/output behavior. Stage-local specs live under
`scripts/flat/atmosphere_rejected/reference/stages/_tests` and use
`<ClassName>.spec.js` file names.

## CLI Shape

The stage API and current reference-integrator boundary are now stable enough
for the CLI to become the benchmark harness entry point. Keep the runner
framework-free and deterministic. It should exercise the same public
integrator, model adapters, post-pipeline consumers, and scenario definitions
that later shader parity will use.

The CLI runner lives alongside the package:

```text
scripts/flat/atmosphere_rejected/run-reference-probe.js
```

Use repo-local script precedents:

- `scripts/flat/atmosphere_rejected/run-reference-probe.js`: explicit option
  parsing, `--help`, deterministic JSON output, Markdown reports, and linked
  visual artifacts.
- `scripts/3d-assets/asset-pipeline/run-asset-pipeline.js`: `--config` JSON
  plus optional positional selections.

The CLI should support both JSON-first usage and quick command-line probes:

```text
node scripts/flat/atmosphere_rejected/run-reference-probe.js --probe globe.zenith
node scripts/flat/atmosphere_rejected/run-reference-probe.js --probe flat.localSunReference --out tmp/flat-local-sun.json
node scripts/flat/atmosphere_rejected/run-reference-probe.js --probe globe.zenith --report tmp/globe-zenith.md
node scripts/flat/atmosphere_rejected/run-reference-probe.js --config scripts/flat/atmosphere_rejected/reference/fixtures/runs/globe-clear-day.json
node scripts/flat/atmosphere_rejected/run-reference-probe.js --config tmp/custom-atmosphere-run.json --probe horizon --stage integrateViewOpticalDepth
node scripts/flat/atmosphere_rejected/run-reference-probe.js --benchmark scripts/flat/atmosphere_rejected/reference/benchmarks/earth-globe-clear-day-basic-sky.json --report tmp/earth-globe-clear-day-basic-sky/report.md --image tmp/earth-globe-clear-day-basic-sky/preview.svg
```

Initial options:

- `--config <path>`: load a JSON run definition.
- `--probe <id>`: select one named probe from defaults or config.
- `--benchmark <path>`: load a benchmark scenario file with world, camera,
  probe, display, and review metadata.
- `--world <id>`: optionally override the world set when the benchmark config
  allows it.
- `--camera <id>`: optionally select or override cameras from a benchmark
  config.
- `--out <path>`: write JSON output; otherwise print JSON to stdout.
- `--report <path>`: write a human-facing Markdown report.
- `--image <path>`: optionally write a generated image artifact for visual
  runs.
- `--stage <id>`: run only through a pipeline stage for diagnostics.
- `--format json|summary`: choose full JSON or concise console summary for
  stdout.
- `--solar-source directional-sun|finite-sun-disc`: choose whether sky-patch
  and sky-dome evidence uses one weighted directional source sample or a
  deterministic finite solar-disc source adapter.
- `--finite-sun-samples <count>`: choose the deterministic finite-disc sample
  count. It is valid only with `--solar-source finite-sun-disc`; finite-disc
  source weights preserve the current source-energy convention by summing to
  `1`.
- `--help`: print usage and available built-in probes.

Do not add a broad CLI framework unless the existing local flag parsing becomes
painful. A small parser like the flat capture script is enough for first-pass
flags.

JSON config validation is a separate package-design decision. If run
definitions become schema-validated, prefer a standard JSON validation
framework with explicit schemas over a hand-rolled validator. Defer that
choice until the run-config shape is stable enough to justify a dependency and
schema contract. That includes tests for whether JSON inputs accept only a
given set of properties; those are schema tests, not physical pipeline-stage
tests.

Benchmark scenario files are separate from low-level stage fixtures. Stage
fixtures prove equations and packet contracts. Benchmark scenarios assemble
model adapters, cameras, probes, display conversion, and report metadata for
repeatable visual and numeric review.

Benchmark run definitions should be plain and explicit:

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
  "cameras": [
    {
      "id": "sanJose.eyeHeight.west",
      "observer": {
        "positionKind": "geodetic",
        "latitudeDeg": 37.3382,
        "longitudeDeg": -121.8863,
        "heightKm": 0.03048
      },
      "orientation": { "azimuthDeg": 270, "elevationDeg": 0, "rollDeg": 0 },
      "lens": { "verticalFovDeg": 60, "aspect": 1.7777777778 }
    }
  ],
  "probes": [
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
  ],
  "review": {
    "intent": "Evaluate daylight sky color and horizon gradient before shader parity.",
    "notes": []
  }
}
```

Benchmark output should include the exact scenario id, world id, camera id,
probe id, resolved observer/ray, display policy, warnings, spectral radiance,
XYZ, linear RGB, display RGB, component diagnostics, optical-depth summaries,
and stage history. Markdown and image outputs are review aids; JSON diagnostics
remain the source of truth.

For the current proof work, the output side matters more than any app bridge.
The benchmark harness should include a post-pipeline pixel path that converts
reference results into deterministic image artifacts. That path consumes
spectral radiance/XYZ/linear RGB/display RGB plus an explicit output policy
and writes pixels; it must not mutate transport diagnostics or hide missing
physics behind exposure, gamma, or clamping.

First pixel-output responsibilities:

- convert spectral radiance to XYZ with the selected color-matching data;
- convert XYZ to linear sRGB without silent clamping;
- apply named display/exposure policy after physical radiance is complete;
- encode pixels with a declared policy, such as linear byte values,
  sRGB-gamma byte values, or both as separate labeled artifacts;
- emit deterministic image metadata linking every pixel back to scenario,
  camera/probe, wavelength grid, display policy, and transport diagnostics.

First atmosphere-model responsibilities:

- make `earth.globe.clearDay` the primary proof world, not a tuned toy;
- use WGS84 and ellipsoid-relative clear-air altitude for the globe benchmark;
- use real-Sun spectral irradiance or a clearly labeled fallback only until
  the canonical spectrum source is selected;
- source Rayleigh coefficients and phase behavior, and name aerosol/Mie and
  absorber/ozone assumptions as model choices rather than visual tuning knobs;
- keep flat/local-Sun worlds as consequence or compatibility scenarios, not as
  the calibration source for expected Earth-like sky colors.

### Benchmark Camera Adapter Contract

Benchmark cameras are pre-transport adapters. They do not change the
integrator request contract; they produce the existing
`{ observer: { positionKm }, ray: { direction } }` request fragment plus
camera diagnostics that explain how the ray was resolved.

The first adapter should be a plain pinhole ray generator with no React,
Three.js, DOM, shader, exposure, or tone-mapping dependency. It accepts WGS84
geodetic globe observers or explicit/named flat observers, resolves a local
east/north/up frame, materializes `zenith`, `azimuthElevation`, `towardSun`,
`target`, and `ndc` views, and rejects invalid or ambiguous camera definitions
before `CpuSpectralReferenceIntegrator.traceRay` runs. Spherical globe cameras
are allowed only for explicit analytic fixtures or named comparison scenarios,
not as the Phase 6A benchmark default.

Coordinate ownership follows the project design: permanent benchmark facts use
geodetic coordinates, subjective/view-local intent uses observer-relative
coordinates, and Three/app scene coordinates are generated render endpoints.
ECEF, ENU, flat projection coordinates, object-local coordinates, view space,
clip/NDC, framebuffer UV, and texture UV are operational bridge spaces. The
CLI should report the bridge metadata that matters for review instead of
letting generated scene coordinates masquerade as source data. In the current
reference-proof slice, these endpoint spaces are vocabulary for diagnostics
and later parity, not an app integration requirement.

Current scope is reference proof, not app implementation. The first benchmark
camera work should produce CPU reference trace requests, deterministic JSON
diagnostics, and CLI visual artifacts. It should not construct Three.js
cameras, mutate app objects, pack shader uniforms, or perform browser/shader
ray reconstruction.

Implement the camera bridge only after the transform core first slice exists.
That slice should provide the shared plain-data transforms the camera needs:
WGS84 datum/height/geodetic/ECEF/ENU, the first ECEF-to-globe model-frame
adapter, flat north-pole azimuthal equidistant projection, flat local-frame
resolution, observer and target resolution, explicit source direction
resolution, plumb-aligned camera basis construction, NDC ray generation,
provenance metadata, and deterministic cache-key fields. `rollDeg = 0` keeps
image vertical parallel to the local plumb line by projecting local `up` into
the image plane, and roll degrees increase clockwise in the image plane with
`0` at plumb-up/12 o'clock. Missing `rollDeg` defaults to `0` and should
produce the same basis as an explicit zero while diagnostics record whether
the value was defaulted. The camera adapter consumes those helpers; it does not
own duplicate copies of the coordinate math.

Benchmark adapters may precompute and cache deterministic coordinate bridge
outputs, including WGS84-derived constants, ECEF/ENU bases, flat projection
results, target resolution, camera bases, and NDC ray grids. Those cache
entries are generated artifacts. Their keys must include the canonical source
inputs and frame metadata, and stale `frameId` or key mismatches should reject
instead of silently reusing a transform. Object placement transforms and shader
uniform matrices are later cache candidates after app and shader endpoint
adapters exist. Scenario files should not store cached coordinates as
permanent facts unless they are clearly marked as generated diagnostics with
reproducible provenance.

Hand-authored benchmark targets should be geodetic by default: latitude,
longitude, and `elevationKmMsl`. The target resolver materializes those anchors
through WGS84 for globe worlds and through the default north-pole-centered
azimuthal equidistant projection for flat-world hypothesis runs. Explicit
`distanceFromEarthCenterKm` targets are allowed for geocentric/shell probes,
but must not be mixed with `elevationKmMsl`. Visible markers such as
`marker.red` should be fixture-owned surfaces so anchor, shape, normal,
material, and hit ids have one source of truth. Observer-relative
bearing/range targets are convenience derivatives, not the default persisted
benchmark contract, because absolute anchors are easier to move between
observer locations and world adapters.

Required diagnostics:

- camera id, world frame id, probe id, and view kind;
- source frame, target frame, frame id, projection id, datum, handedness, and
  resolved basis vectors when a coordinate bridge is used;
- resolved model-space origin and normalized ray direction;
- local basis vectors and camera basis vectors;
- FOV/aspect and NDC sample coordinates when used;
- plumb-line reference, zero-roll basis, normalized `rollDeg`, roll value
  source (`explicit` or `default`), and roll fallback metadata when camera
  basis construction is used;
- source or target ids used to resolve special views;
- target datum, projection id, and marker-surface id when used;
- derived transform cache key/hash, cache hit or miss, and source-field
  provenance when a precomputed transform is used;
- warnings for unavailable direct source light, flat boundary dependencies, or
  hypothesis values.

The detailed camera algorithm, input data, outputs, first tests, and open
questions live in
[Atmosphere Reset Design](../design.md#benchmark-camera-adapter-details), with
shared coordinate-space and transform behavior owned by
[Coordinate Spaces And Transform Core](../design.md#coordinate-spaces-and-transform-core).
Keep this section as the CLI/API-facing summary so the implementation has one
deeper design source.

JSON run definitions should be plain and explicit:

```json
{
  "kind": "flat-atmosphere-reference-run",
  "model": "earth-clear-day-globe",
  "wavelengthsNm": { "start": 360, "end": 830, "step": 10 },
  "numerical": {
    "viewSteps": 64,
    "sunTransmittanceSteps": 32,
    "integrationMethod": "midpoint"
  },
  "probes": [
    {
      "id": "zenith",
      "observer": { "positionKm": [0, 6371.0088, 0] },
      "ray": { "direction": [0, 1, 0] }
    }
  ],
  "output": {
    "includeSamples": true,
    "includeDiagnostics": true
  }
}
```

CLI output should include run metadata and per-probe results:

```json
{
  "kind": "flat-atmosphere-reference-result",
  "generatedAt": "2026-06-14T00:00:00.000Z",
  "configPath": "scripts/flat/atmosphere_rejected/reference/fixtures/runs/globe-clear-day.json",
  "stage": "full",
  "probes": [
    {
      "id": "zenith",
      "result": {}
    }
  ]
}
```

This runner is not just convenience. It becomes the non-browser way to produce
known outputs, compare parameter changes, and inspect the pipeline before
shader work begins.

Initial implemented runner slice:

- `scripts/flat/atmosphere_rejected/run-reference-probe.js` runs controlled
  built-in smoke probes through the canonical integrator stages.
- The current built-ins intentionally exercise transport/report mechanics
  before package-level globe and flat/local-Sun adapters exist. They must be
  labeled as controlled evidence, not Earth-reference truth.
- The current Markdown/SVG swatches use a debug nearest-wavelength mapping
  from `650/550/450 nm` to `R/G/B`. CIE XYZ, linear RGB, exposure, and tone
  mapping remain post-pipeline consumers to add before display color is treated
  as physically meaningful.

## Human-Facing Reports

JSON is the canonical output. Markdown is the first human-facing report format
because it is readable directly in the IDE, diffable, and easy to link with
generated artifacts.

The CLI should support:

```text
--out tmp/globe-zenith.json
--report tmp/globe-zenith.md
--image tmp/globe-zenith.png
```

Report priority:

1. `result.json`: canonical machine truth.
2. `report.md`: human explanation of one run or probe set.
3. Optional `.svg` or `.png` artifacts linked from the Markdown.

The first Markdown report should include:

- run metadata and config path
- probe id and model id
- final color swatch as inline HTML or linked SVG
- XYZ and linear RGB values
- key geometry values
- optical-depth and transmittance summaries
- Rayleigh/Mie/surface contribution table
- links to JSON and any image artifacts

For a single-ray diagnostic image, prefer generating a small SVG first. The SVG
can contain a final-color swatch, simple spectral radiance curve,
transmittance curve, optical-depth curve, and contribution bars. PNG export can
be added later if needed; Markdown can link to SVG directly.

For multi-ray runs, add image artifacts later:

- horizon-to-zenith strip
- azimuth/altitude sky map
- sun-relative scattering-angle map
- future CPU-vs-shader-difference image

## Model Interface

The integrator must depend on behavior, not world type names.

```text
world.altitudeAt(positionKm) -> km
world.upAt(positionKm) -> unit vector
world.intersectSurface(ray) -> hit | null
world.surfaceNormalAt(hit) -> unit vector

atmosphere.intersect(ray) -> { tMinKm, tMaxKm } | null
atmosphere.contains(positionKm) -> boolean
atmosphere.mediumAt(positionKm, { wavelengthsNm, sample }) -> medium state
atmosphere.densityAt(positionKm, species) -> unitless density
atmosphere.extinctionAt(positionKm, wavelengthNm) -> extinction coefficients
atmosphere.scatteringAt(positionKm, wavelengthNm) -> scattering coefficients

solarSource.samplesAt(positionKm, wavelengthNm, numerical) -> source samples
solarSource.transmittanceSegment(samplePositionKm, sourceSample, query) -> source-path segment

surface.radianceAt(hit, wavelengthNm, lighting) -> spectral radiance
```

The globe adapter and flat/local-Sun adapter implement these interfaces. The
integrator should not contain `if globe` or `if flat` branches.

`mediumAt` is the preferred high-level lookup for `evaluateMedium`: it returns
model-owned profile diagnostics, species/component coefficients, direct totals,
or vacuum/outside-volume markers for one already sampled position and the
active wavelength grid. The older granular methods remain useful adapter
building blocks, but `evaluateMedium` tests target the stage contract through
one controlled medium-state lookup so expected packet output is easy to
inspect. Geometric altitude is not part of `mediumAt`; `evaluateMedium`
derives `mediumSample.altitudeKm` from `world.altitudeAt(positionKm)` so world
geometry remains the single source of truth for altitude.

Flat adapters must make lateral extent a model property, not an implicit
numerical cap. A large flat atmosphere can be vertically thin while still
optically very thick along near-horizontal view or source paths. A flat slab
with no side boundary gives a horizontal ray no physical atmosphere exit, so
`atmosphere.intersect(ray)` must either return a finite segment with a named
boundary reason or fail loudly before optical-depth integration. Valid boundary
reasons can include disk edge, finite local patch, dome/cylinder wall,
terrain/surface occlusion, or another explicitly named hypothesis. The
diagnostics should preserve that reason and the resulting path length because
it is central evidence for or against any proposed flat/local-Sun atmosphere.

The initial `atmosphere` object can be a clear-air provider, but the integrator
should treat it as a general medium provider at sample time. Later cloud
support should add species such as cloud liquid water or cloud ice through the
same `densityAt`, `extinctionAt`, and `scatteringAt` behavior rather than
through a separate overlay pass. The implementation should therefore avoid
hard-coding assumptions that density only depends on altitude, that species are
only Rayleigh/Mie/absorber, or that a ray can meet only one kind of volume.

### `resolveRayPath` Boundary Precedence

`resolveRayPath` owns atmosphere-transport segment selection. It does not own
geometry intersection math, future surface shading, or display behavior. The
model supplies atmosphere intervals and surface hits; the stage chooses the
forward transport segment and records why it ended.

Boundary policy:

- The transport ray passed to model interfaces is
  `{ originKm: validatedRequest.observer.positionKm, direction:
  validatedRequest.ray.direction }`. `validateRequest` owns direction
  normalization; `resolveRayPath` must not re-normalize or reshape that ray.
- A missing atmosphere intersection returns an explicit empty path with
  `boundaryReason: "atmosphere-miss"`.
- A finite atmosphere interval must include ordered finite `tMinKm` and
  `tMaxKm`. Missing, non-finite, or inverted endpoints reject before sampling.
- An explicit `{ unbounded: true }` atmosphere return rejects with an
  unbounded/lateral-boundary error. This is the named flat-horizontal-slab
  path, not a malformed finite interval.
- If `tMaxKm < 0`, the atmosphere interval is behind the observer and returns
  an explicit empty path.
- If `tMinKm < 0 < tMaxKm`, the selected segment starts at `0`; the observer is
  inside the model-returned interval.
- A surface hit after atmosphere exit does not clip the atmosphere segment and
  is not carried in `rayPath.surfaceHit`.
- A surface hit before atmosphere entry returns an explicit empty path with
  `boundaryReason: "surface-before-atmosphere-entry"`.
- A surface hit exactly at atmosphere entry returns an explicit empty path with
  `boundaryReason: "surface-at-atmosphere-entry"`. The stage does not invent an
  epsilon path.
- A surface hit before atmosphere exit clips the segment and becomes the
  selected boundary with `boundaryReason: "surface-hit"` unless the model
  supplied a more specific surface reason.
- A surface hit exactly at atmosphere exit uses surface-hit precedence because
  the visible endpoint is a surface. Atmosphere-exit diagnostics are preserved
  in `rayPath.metadata.coincidentAtmosphereBoundary`.
- A present surface hit must have finite `surfaceHit.tKm`; non-finite surface
  distances reject. Negative surface-hit distances are behind the observer and
  ignored for forward atmosphere transport.

External references justify the ordering and finite-segment principles, not the
local diagnostic labels. PBRT Rays supplies the ordered forward ray-parameter
model. PBRT Transmittance supplies the finite point-to-point transport segment
and zero-distance semantics. The exact `rayPath` field names, boundary labels,
and metadata precedence are local API decisions pinned by
`ray-path-contracts.json` and this design section.

## Units

Public quantities use these units:

- position/distance: kilometers
- wavelength: nanometers
- spectral radiance: `W / m2 / sr / nm`
- spectral irradiance: `W / m2 / nm`
- extinction/scattering: `1 / km`
- optical depth: unitless
- transmittance: unitless `[0, 1]`

Internal helper names should carry units where ambiguity is likely, such as
`distanceKm`, `wavelengthNm`, and `spectralRadianceWm2SrNm`.

## Numerical Controls

Numerical controls are not physical constants. They should be grouped and
reported separately:

```text
{
  viewSteps,
  sunTransmittanceSteps,
  diffuseSkyHemisphereSamples,
  finiteSunSamples,
  minStepKm,
  maxStepKm,
  integrationMethod
}
```

Initial defaults:

- fixed midpoint integration for view rays
- direct `sampleViewPath` packets with a missing `viewSteps` control default to
  one midpoint sample for a non-empty path
- fixed midpoint integration for sample-to-source transmittance
- single directional sample for distant Sun
- small-disk approximation for local finite Sun
- hemisphere diffuse sky disabled until direct/single scattering is trusted

Validation contract:

- Count controls (`viewSteps`, `sunTransmittanceSteps`,
  `diffuseSkyHemisphereSamples`, and `finiteSunSamples`) must be positive
  finite integers. They choose discrete loop/sample counts, so `0`,
  fractional values such as `1.5`, strings such as `"4"`, and non-finite
  values are invalid.
- Distance controls (`minStepKm` and `maxStepKm`) are finite nonnegative
  numbers. Fractional kilometer values are meaningful for distances; their
  zero value is valid. Each endpoint must be nonnegative independently, and
  `maxStepKm - minStepKm` must not be negative.
- Unknown numerical keys are not rejected by `validateRequest`, because
  allowed-property enforcement belongs to the future JSON schema layer. They
  are also not propagated into `validatedRequest.numerical`, because later
  stages should only see controls owned by this numerical-control contract or
  a future registry.
- `integrationMethod` is an algorithm dispatch key. Do not duplicate supported
  method names as a hardcoded `validateRequest` allow-list. If an
  integration-method registry exists as the single source of truth mapping
  method names to implementations, `validateRequest` may use that registry to
  reject missing methods early. Without that registry, the stage implementation
  that dispatches the method should fail loudly when no implementation exists.

### `sampleViewPath` Contract Notes

The canonical input/output shape lives in
[Stage Contracts](stage_contracts.md#sampleviewpath). The notes below explain
the current fixed-midpoint policy and validation rationale.

The initial `sampleViewPath` stage uses fixed midpoint integration. It consumes
`rayPath.viewSegment` and produces deterministic `viewSamples`:

```js
{
  sampleIndex,
  distanceFromObserverKm,
  weightKm,
  intervalStartKm,
  intervalEndKm,
  integrationMethod: 'midpoint'
}
```

The stage also adds run-level metadata:

```js
{
  viewSampleMetadata: {
    integrationMethod: 'midpoint',
    sampleCount,
    pathLengthKm
  }
}
```

For empty or zero-length paths, `viewSamples` is `[]`; no epsilon sample or
zero-weight placeholder sample is invented. Direct stage packets that omit
`numerical.viewSteps` use `1` as the default count for non-empty paths. Invalid
or unknown integration methods are deferred until an integration-method
registry exists; this first stage contract only records the fixed midpoint
method.

### `evaluateMedium` Contract Notes

The canonical input/output shape lives in
[Stage Contracts](stage_contracts.md#evaluatemedium). The notes below explain
the downstream-readiness and coefficient-precedence rationale.

`evaluateMedium` output decisions are governed by two questions:

1. What does the downstream pipeline need without re-querying the model?
2. What can be derived cheaply and unambiguously from already available data?

The stage should produce downstream-ready totals for transport and scattering,
but those totals must have explicit provenance. Do not omit a useful total just
to avoid duplication; instead, derive it once in this stage, validate any
model-provided duplicate, and record how the value was obtained. After
`evaluateMedium`, downstream stages should consume `mediumSamples` rather than
calling atmosphere/profile model methods again.

Each `mediumSample` should preserve the view-sample integration fields and add
the evaluated medium state:

```js
{
  sampleIndex,
  distanceFromObserverKm,
  weightKm,
  intervalStartKm,
  intervalEndKm,
  integrationMethod,
  positionKm,
  altitudeKm,
  profile: {
    densityKgPerM3,
    pressurePa,
    temperatureK,
    numberDensityPerM3,
    composition
  },
  coefficients: {
    extinctionByWavelength,
    scatteringByWavelength,
    absorptionByWavelength,
    derivation
  },
  species: [
    {
      name,
      extinctionByWavelength,
      scatteringByWavelength,
      absorptionByWavelength,
      phase
    }
  ]
}
```

Only fields available from the selected model or unambiguously derived by this
stage should be present. `altitudeKm` is the finite geometric altitude returned
by `world.altitudeAt(positionKm)` and carried downstream so later stages and
diagnostics do not re-query world geometry. A controlled toy medium does not
need to invent pressure or temperature if the model only supplies coefficients.
Earth profile fixtures may include pressure, temperature, density, and
composition because those are useful diagnostics and can be pinned to sourced
rows.

Stage validation ownership:

- Each stage validates the packet fields and model-returned data it consumes.
  Upstream stages should normally produce valid packets, but direct stage tests
  may call any stage in isolation, so malformed inputs must fail at the stage
  boundary where they are consumed.
- `evaluateMedium` consumes `world.altitudeAt(positionKm)` for geometric
  altitude and rejects non-finite altitude returns. It does not accept
  `altitudeKm` from `atmosphere.mediumAt`.
- When `evaluateMedium` accepts `profile` diagnostics, it owns validation of
  the profile fields it exposes downstream. Density must be finite and
  nonnegative. Composition diagnostics, when supplied, must be finite,
  nonnegative fractional-volume data; any provided listed sum or residual must
  be finite, nonnegative, and consistent with the declared residual policy.
- `evaluateMedium` does not infer a missing composition, normalize listed
  fractions to hide a residual, or repair invalid model data. It preserves
  valid model-owned diagnostics and rejects invalid diagnostics loudly.

Coefficient precedence:

- If model-returned species coefficients are present, sum them wavelength by
  wavelength into downstream totals.
- If no species coefficients are present, model-returned total coefficient
  arrays may be used directly.
- If extinction is omitted but absorption and scattering are present, derive
  `extinction = absorption + scattering` by wavelength.
- If extinction and absorption/scattering are both present, validate
  `extinction = absorption + scattering` within the row's tolerance or reject.
- If species totals and model totals are both present, validate that they agree
  within the row's tolerance or reject.
- Vacuum and outside-atmosphere samples emit explicit zero coefficient arrays
  aligned to `wavelengthsNm`.

Numerical review policy for this stage:

- Duplicate accounting checks use a named absolute tolerance only where the
  stage recomputes a sum from binary64 JavaScript numbers and compares it with
  a model-supplied duplicate total. Current uses are composition
  `listedFractionSum`, composition `listedFractionSum + unlistedResidual`, and
  duplicate extinction versus `absorption + scattering`.
- That tolerance is not a physical atmosphere tolerance and should not be used
  to widen fixture ranges, hide invalid negative coefficients, or accept real
  model disagreement. It is only for small floating-point addition residue in
  duplicate representations of the same fact.
- Derived coefficient sums are rounded to a named count of significant decimal
  digits before they enter fixture-facing packet arrays. This keeps
  deterministic JSON/test comparisons reviewable by avoiding binary64 decimal
  tails, while preserving enough significant digits for controlled toy
  coefficient rows.
- Any future real atmosphere coefficient fixture should carry its own
  row-level tolerance from the data source or convergence study instead of
  inheriting this local duplicate-sum policy.

This shape keeps the expensive or model-owned lookups in one stage, gives
`integrateViewOpticalDepth` the total extinction it needs, gives later
single-scattering stages species scattering and phase metadata, and gives
diagnostics enough profile/composition context to explain where a result came
from. The coefficient arrays are not independent facts; their `derivation`
metadata names whether they came from species summation, direct model totals,
or absorption-plus-scattering derivation.

### `integrateViewOpticalDepth` Contract Notes

The canonical input/output shape lives in
[Stage Contracts](stage_contracts.md#integrateviewopticaldepth). The notes
below explain wavelength ownership, cumulative species diagnostics, and
path-end distance semantics.

`integrateViewOpticalDepth` consumes the validated request and the
`mediumSamples` packet emitted by `evaluateMedium`. The wavelength grid comes
only from `validatedRequest.wavelengthsNm`; direct stage packets must not carry
or consult a second top-level wavelength-grid source after `validateRequest`.
Neighboring stage contracts must use one shape: species diagnostics are an
array of named entries. Integration tests should exercise that canonical
producer-to-consumer handoff directly so isolated direct-stage fixtures cannot
drift away from the packet shape produced by `evaluateMedium`.

For each medium sample, total extinction comes from
`mediumSample.coefficients.extinctionByWavelength`. Direct isolated stage tests
should build that same nested `coefficients` shape when they are testing total
extinction rather than species diagnostics.

The path-end diagnostic is not the last midpoint sample distance. When samples
include `intervalEndKm`, `viewOpticalDepth.pathEnd.distanceFromObserverKm` is
the final sample's interval endpoint. This keeps midpoint integration samples
usable as integrand evaluation points while preserving the true camera-to-end
distance for downstream diagnostics.

Open follow-up decisions for this stage:

- Decide whether `integrateViewOpticalDepth` should reject missing or
  non-finite path-end distance data when `mediumSamples` is non-empty, rather
  than falling back to `distanceFromObserverKm` or `0`.
- State which downstream stages consume `validatedRequest`, `mediumSamples`,
  and `viewOpticalDepth` for wavelength order, sample weights, interval
  endpoints, and accumulated transport diagnostics. Do not duplicate those
  facts in `viewOpticalDepth` unless carrying them removes real downstream
  ambiguity.
- Keep species optical-depth diagnostics explicitly cumulative. If later
  reports or scattering stages need per-interval species contribution, add a
  separate field with a distinct name instead of overloading the cumulative
  diagnostic.
- Keep source-path and solar visibility work out of this stage. Source
  transmittance belongs to `integrateSolarTransmittance`.

### `integrateSolarTransmittance` Contract Notes

The canonical input/output shape lives in
[Stage Contracts](stage_contracts.md#integratesolartransmittance). The notes
below explain the model-owned source/sample boundary and Beer-Lambert transport
rationale.

`integrateSolarTransmittance` consumes the validated request, the
`mediumSamples` emitted by `evaluateMedium`, and `rayPath` from
`resolveRayPath`. It does not redo view-path sampling, medium evaluation,
source geometry, or surface occlusion. For each medium sample, it asks the
solar-source model for source samples at the already evaluated position, then
asks the solar-source model for the corresponding sample-to-source transport
segment. When `rayPath.surfaceHit` selects a visible surface point, it also
asks for source samples and source-path segments at that surface point so
`resolveSurfaceRadiance` can consume direct-source handoff data without
re-querying solar visibility.

The solar-source model owns geometry-specific decisions:

- distant-Sun versus local finite-Sun source sampling;
- source direction, source spectrum, source-sample weight, and solid angle;
- whether a source sample is visible or occluded;
- the finite source-path segment and its sampled extinction coefficients.

The stage owns transport integration over those model-returned source-path
segment samples:

```text
tau_source(lambda) = sum_i sigma_t_i(lambda) * ds_i
T_source(lambda) = exp(-tau_source(lambda))
```

PBRT's transmittance definition supplies the optical-depth and
Beer-Lambert relationship. PBRT's volume-scattering definitions supply the
nonnegative attenuation-coefficient domain. The source-sample and
source-segment field names are local API contracts pinned by the
`solar-transmittance-contracts.json` fixture batch.

The stage output is:

```js
{
  solarTransmittance: {
    samples: [
      {
        sampleIndex,
        distanceFromObserverKm,
        positionKm,
        sourceSamples: [
          {
            sourceSampleIndex,
            sourceSampleId,
            direction,
            weight,
            solidAngleSr,
            sourceSpectrum,
            boundaryReason,
            visible,
            pathLengthKm,
            opticalDepthByWavelength,
            sourceTransmittanceByWavelength
          }
        ]
      }
    ],
    surfacePoint,
    metadata: {
      sampleCount,
      sourceSampleCount,
      includesSurfacePoint
    }
  }
}
```

Only model-supplied source-sample metadata should appear on a source-sample
output. The source adapter must provide an explicit finite nonnegative
`weight` for each source sample; this is the downstream source-quadrature
multiplier and is not defaulted by the transport stages. `solidAngleSr` is
preserved as source-shape provenance/diagnostic metadata under the current
contract. Required transport arrays are always aligned to
`validatedRequest.wavelengthsNm`. For a model-declared occluded source sample,
`visible` is `false`, `sourceTransmittanceByWavelength` is a zero array, and
`opticalDepthByWavelength` is `null`; the stage does not replace occlusion
with an arbitrary large optical depth. For a visible source sample, segment
samples must carry finite nonnegative `weightKm` values and finite
nonnegative extinction arrays aligned to the wavelength grid.

The first green implementation and contract-alignment batches cover
per-medium-sample source transmittance, source direction and source-spectrum
handoff, optional surface-point source transmittance, declared `rayPath`
input, and metadata counts.

This boundary keeps flat/local-Sun consequences visible without hard-coding a
flat-world shortcut in the transport stage. A flat model can return a long
finite source-path segment to a named lateral/top boundary; this stage will
accumulate the corresponding optical depth through the same Beer-Lambert math.
A globe model can return an occluded source sample when the path intersects
solid Earth. Both are model-owned inputs, not branches inside the reference
integrator.

## Output

The integrator currently returns the completed stage packet. Its physical
transport result is `spectralRadiance.finalByWavelength`, with intermediate
packet fields retained as public diagnostics. `stageHistory` is part of that
diagnostic result contract.

Colorimetry, `xyz`, `linearRgb`, exposure, display conversion, and report
shaping are post-pipeline consumers. They take the spectral packet result as
input and must not feed display choices back into transport stages.

## Algorithm

For one transport ray:

1. Validate and canonicalize the request, including converting the ray
   direction to a unit vector.
2. Intersect the ray with the active atmosphere volume.
3. Intersect the ray with the active surface.
4. Choose the view integration end:
   - surface hit distance if the surface is inside the atmosphere segment
   - atmosphere exit distance for sky rays
   - named lateral boundary distance for flat/local-patch rays that cannot exit
     vertically
5. Initialize spectral accumulators for each wavelength.
6. March along the view ray using the selected numerical method.
7. At each view sample:
   - compute altitude and densities
   - compute local extinction and scattering coefficients
   - update or compute camera-to-sample optical depth
   - request solar-source samples for this position and wavelength
   - integrate sample-to-source optical depth for each source sample
   - compute source transmittance
8. Evaluate scattering angles and Rayleigh/Mie phase terms.
9. Accumulate in-scattered spectral radiance.
10. If the ray hits a surface:
   - compute direct irradiance from the same solar source and transmittance
   - compute diffuse sky irradiance only when that subsystem is enabled
   - ask the surface model for reflected spectral radiance
   - attenuate surface radiance by camera-to-surface transmittance
11. Sum surface radiance and in-scattered radiance.
12. Return spectral radiance and transport diagnostics.

Post-pipeline consumers can then translate that result for display or reports:

1. Convert spectral radiance to CIE XYZ.
2. Convert XYZ to linear RGB.
3. Build report or CLI diagnostics from the transport result and any requested
   consumer options.

## Transmittance

Optical depth:

```text
tau(lambda) = integral beta_t(position, lambda) ds
```

Transmittance:

```text
T(lambda) = exp(-tau(lambda))
```

The integrator should expose both optical depth and transmittance. Tests should
cover vacuum, homogeneous media, exponential slab analytic cases, and split-ray
multiplicativity.

## Single Scattering

Initial reference scattering:

```text
dL(lambda) =
  T_view(lambda)
  * [
      beta_R_sca(position, lambda) * P_R(cosTheta)
      + beta_M_sca(position, lambda) * P_M(cosTheta)
    ]
  * source(lambda)
  * T_source(lambda)
  * ds
```

For a distant Sun, `source(lambda)` is directional spectral irradiance at the
top of the atmosphere. For a local finite Sun, source contribution comes from
spectral radiance times the Sun's solid angle, with optional finite-disk
sampling later.

## Surface Contribution

For the first pass, surface reflection is Lambertian:

```text
L_surface(lambda) =
  albedo(lambda) / pi
  * (E_direct(lambda) * max(dot(normal, sunDirection), 0)
     + E_diffuse_sky(lambda))
```

`E_diffuse_sky` must eventually come from hemisphere integration of sky
radiance. A fixed fraction of removed direct sunlight is not part of the
reference design.

## Future Cloud Extension

Clouds are deferred, but they should fit the same transport packet. The first
cloud extension should be tested as a controlled medium, for example a
homogeneous slab with known optical depth:

```text
tau_cloud(lambda) = beta_cloud_ext(lambda) * path_length
T_cloud(lambda) = exp(-tau_cloud(lambda))
```

After that, cloud support can add:

- cloud species in medium diagnostics
- cloud optical depth in view and source transmittance
- a cloud phase function or tabulated phase data
- single-scattering cloud radiance for optically thin cases
- cloud shadowing through source transmittance

Multiple scattering, bright cloud interiors, silver linings, and high
optical-depth volumetric rendering should be separate named extensions. They
are too large to smuggle into the clear-air reference and should receive their
own tests and approximation contracts.

## Deferred Pipeline Effects

Later, add an explicit omitted-effects ledger for physics that the first
pipeline leaves out even though it could materially affect results. Each entry
should name the omitted effect, likely visual/numeric impact, reason for
deferral, affected stage or model contract, and the reference/test evidence
needed before implementation.

Refraction is the first example to include in that ledger. It can curve view
and source paths, shift apparent near-horizon positions, and change optical
path lengths. The first reference pipeline intentionally starts with
straight-line transport so optical depth, transmittance, single scattering,
surface radiance, and spectral color conversion can be validated before curved
ray geometry is introduced.

## Spectral To Color

The integrator converts spectral radiance to CIE XYZ:

```text
X = integral L(lambda) * x_bar(lambda) d_lambda
Y = integral L(lambda) * y_bar(lambda) d_lambda
Z = integral L(lambda) * z_bar(lambda) d_lambda
```

Then XYZ converts to linear RGB. Tone mapping, exposure, white balance, and
display transforms should be separate camera/display choices, not hidden inside
the atmosphere reference.

## Error Handling

Fail loudly for:

- missing model interfaces
- missing, non-finite, or too-small ray direction
- negative wavelength
- unsorted wavelength grid
- negative extinction/scattering coefficients
- atmosphere paths with infinite length and no named boundary
- flat horizontal or near-horizontal atmosphere paths whose finite lateral
  boundary is missing, unnamed, or hidden as a numerical integration cap
- local Sun requests where observer/sample lies inside the Sun radius
- invalid transmittance outside `[0, 1]` after numerical tolerance

## Test-First Contract

Before implementing each subsystem, write its tests:

- `analytic`: closed-form expected value
- `invariant`: physics property
- `reference-data`: external source comparison
- `cross-model`: globe and flat produce same result under same local
  conditions
- `shader-parity`: shader compared with trusted CPU reference

Shader parity comes last. The CPU reference must first pass analytic and
invariant tests for the quantity being compared.

Implementation comments should cite the algorithm source for positive behavior
as well as for rejection cases. For example, optical-depth accumulation should
name the path-integral/Beer-Lambert source, and ray-path segment selection
should name the ray-parameter and model-interface contracts. Error branches
still need reasons, but they are not enough by themselves.

## First Test Fixtures

Start with small fixtures that have known answers:

- Vacuum: all optical depths zero, all transmittance one.
- Homogeneous medium: `T = exp(-beta * distance)`.
- Exponential slab: vertical optical depth
  `beta0 * H * (1 - exp(-H_top / H))`.
- Phase normalization: Rayleigh and Mie integrate to one over solid angle.
- Zero source: no in-scattering.
- Zero scattering: no in-scattering.
- Black Lambertian surface: zero reflected surface radiance.
- Uniform sky radiance: hemisphere irradiance equals `pi * L`.
- Local Sun small-disk limit: solid angle approaches `pi * (R / d)^2`.

## Shader Parity Interface

The browser/shader side should expose deterministic probe rays in model
coordinates:

- ray origin
- ray direction
- surface/depth hit if applicable
- scene atmosphere/source settings
- shader linear RGB result before display tone mapping when possible

The parity harness compares those against CPU outputs with named tolerances.
It should store the CPU diagnostics beside any screenshot/capture so failures
explain themselves.

## Relationship To Current Code

This module may mine ideas from `src/flat/shared/Atmosphere.js`, but it should
not preserve its RGB transport assumptions or display bridge. Current shader
code is an approximation target to test after the reference exists.

The first implementation should be separate enough that deleting or rewriting
the current atmosphere composer would not delete the reference truth engine.
The current iteration is useful for architecture and naming clues, but the
script reference should be free to start fresh and clean up previous decisions.
