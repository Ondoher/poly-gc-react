# Algorithm32 Production Design

Status: active surrounding production architecture. The optional
`CelestialContributionCache` extension is selected but unimplemented; its
canonical contract lives in
[CelestialContributionCache Design](celestial-contribution-cache-design.md).
Current implementation truth remains `shared/algorithm32/production/`.

This document defines the current surrounding production shape. API design is
derived from [Algorithm32 Requirements](requirements.md). Accepted
reconciliation behavior and immutable records are CPU oracles and evidence;
they are not a class/schema promotion plan or runtime dependency. Older
pre-reconciliation POC, cleanroom, shader-lab, local-second-order, and scattered
experiment sources are not current implementation references.
Use [Reconciliation To Production Deltas](reconciliation-production-deltas.md)
to track and resolve differences between accepted reconciliation behavior and
the current production implementation before changing contracts.
The current caller-facing API sketch is
[Algorithm32 Primary Facade API Draft](api-facade-draft.md).
As a production design rule, the top-level production shape remains the
primary API boundary: the `Algorithm32` facade, the production dependency
aggregate, and the `Reference` and `ShaderBuilder` implementation classes stay
in place while reconciled collaborators and ownership details are promoted
beneath them.
Promote only the accepted behavior needed by a selected production slice.
Retain the top-level production shape, explicit unit-bearing boundaries for
convertible quantities, deferred diagnostics, and the
config/setup-vs-runtime failure policy.
Type definitions and property names should use the reconciliation POC shapes
and names because most production implementation code will be lifted from that
code base. Rename only when a POC name is actively misleading in the production
contract, and document the one-to-one mapping. Any quantity that can be
represented in different units through conversion must use an explicit
unit-bearing packet at durable/API boundaries; avoid implicit unit scalar
types there.
`SpectralCalculator` is a common internal production utility/collaborator used
by both `Reference` evaluation and incident-radiance cache building. It is not
owned exclusively by `Reference` and is not a primary public facade API.
Shader assembly is split by ownership: specific abstraction interfaces own
their shader contributions and cache/source/geometry/atmosphere semantics;
`ShaderBuilder` owns the remaining mechanical shader work, including source
assembly, compatibility checks, texture/resource preparation, bindings,
pass/material installation, frame updates, and cleanup.
Facade configuration is an object graph of concrete configured abstraction
instances. The application constructs and supplies the `LightSourceModel`,
`AtmosphereModel`, `GeometryModel`, optional `Color`, spectral basis,
execution controls, and shader policy at facade creation or full config
replacement. The core facade must not interpret broad app descriptions or
profile names into domain objects; a later convenience factory may do that
outside the facade if there is a concrete need. Each abstraction instance owns
its own configuration/options, validation, descriptors, CPU/reference hooks
where relevant, and shader contribution specifics.
The core Algorithm32 API owns the required contracts: interface shapes,
descriptor sections, required shader capabilities, binding requirements, and
fail-loud validation points. Concrete abstractions own implementations of
those contracts. `ShaderBuilder` validates that the configured abstraction
instances collectively satisfy the required shader symbols and resources; it
does not author source, atmosphere, geometry, cache, Color, or transport
semantics.
Operation-ready incident-radiance support uses the reconciliation POC
`IncidentRadianceSampling` name. Durable facade configuration stores only
incident-radiance policy/intent. CPU/reference setup state may configure a
default `IncidentRadianceSampling` on `Reference`, and an evaluation request
property overrides that default, including explicit `null` to disable sampling
for one evaluation. Shader setup/handle state owns the GPU cache/resource
equivalent, not a per-evaluation override.
Diagnostics remain deferred. The first implementation slice should implement
only basic fail-loud validation/setup/resource errors and should not add
diagnostic envelopes, per-helper callbacks, or a stable public diagnostics
taxonomy.
Failure policy is split by lifecycle phase: fail loudly during configuration
and setup, including constructor validation, `setConfig`, `setupShader`,
awaited handle config updates, and resource build/bind setup. Once the
runtime render path is live, log runtime failures and continue with the last
valid state, no-op, or fallback path when possible.

## Design Goal

Create a stable production Algorithm32 module under:

```text
shared/algorithm32/production/
```

The production module should satisfy the accepted requirements by delivering a
usable shader/runtime atmosphere pass for the app render path. That shader
should support both spherical distant-Sun atmosphere rendering and flat local
point-Sun atmosphere rendering, including the accepted local second-order
incident-cache contract. CPU/oracle tools, cache builders, and validation
harnesses are support surfaces for proving and feeding the shader, not the
end-user product surface. Shader texture/cache builders are internal resource
preparation support and may share mechanics with the CPU reference path; they
are not part of the primary consumer facade. `SpectralCalculator` is one of
the shared internal mechanics that both the CPU reference path and
incident-radiance cache builder consume.

The accepted reconciliation handoff defines strict source, geometry,
atmosphere, incident-radiance, and external Color/display boundaries. A
production slice selects the smallest required behavior independently; it does
not automatically promote every POC class, packet, acquisition path, or CPU
renderer.

## Celestial Contribution Cache Extension

The selected extension preserves the existing facade, base atmosphere
transport, configured owners, incident-radiance caches, shader lifecycle,
scene capture, and Color. It adds one separate derived resource family and one
shader contribution slot after base transport and before Color.

[CelestialContributionCache Design](celestial-contribution-cache-design.md)
owns its physical measures, camera-independence rule, field qualification,
descriptor/payload contract, runtime behavior, invalidation, failure policy,
verification, and textured-Moon successor. This surrounding design owns only
the architectural placement: `ShaderBuilder` coordinates awaited resource
lifecycle, `ShaderRuntimePass` supplies live query/raster state, and Color
converts the completed spectral sum.

The [cache reference/evidence dossier](celestial-contribution-cache-references.md)
owns the locally mined external-source identities, accepted oracle claim
boundaries, and production-promotion crosswalk used by its plan.

The cache is categorically separate from incident-radiance/L2 caches and
renderer RGB. No production runtime imports reconciliation code or records.

## Production Inputs

- The [CelestialContributionCache Reference And Evidence Dossier](celestial-contribution-cache-references.md)
  supplies the cache's normal external research, accepted CPU-oracle claim
  map, exact retained identities, and promotion routing. The production cache
  contract remains governed by its focused design.
- The reconciliation topic, POC code, and experiment records are exact audit
  or selected-fixture extraction sources behind that dossier, not routine
  implementation instructions:
  `agents/topics/apps/flat/reconciliation/`,
  `scripts/flat/reconciliation/POC/`, and
  `tmp/atmosphere/reconciliation/`.
- `shared/algorithm32/POC/`, `scripts/flat/local-second-order/`, cleanroom
  docs, shader-lab docs, source-contract docs, and numbered older
  pre-reconciliation experiment artifacts are archived history for production
  implementation purposes. Do not use them as implementation references when
  building the production reference or shader unless the user explicitly asks
  for historical archaeology.
- [External Reference Log](external-reference-log.md),
  [Fixture Sources](fixture-sources.md), and
  [Reference Fixtures Evidence](evidence/reference-fixtures/README.md) are
  provenance catalogs only when a named source/provenance gap requires them.
  They are not alternate implementation references.
- Record `065-er8-cpu-convergence-and-poc-cleanup` remains an accepted CPU
  convergence input. Record `067-er9-production-promotion-proof` describes a
  rolled-back promotion attempt and cannot accept this cache. Record `066`
  remains an invalid infrastructure predecessor whose `spawn EPERM` occurred
  before its production test process started.

## Current Production Implementation

The existing production implementation remains the product being extended. Its
current components include:

- `shared/algorithm32/production/Algorithm32.js` as the documented primary
  facade class with first-slice config validation, shared-model construction,
  collaborator wiring, evaluation delegation, awaited shader setup handles,
  config replacement, and disposal failures;
- `npm run test:algorithm32:production` for focused direct-Jasmine specs;
- `spec/support/jasmine-algorithm32-production.json` as the test config;
- `shared/algorithm32/production/types.d.ts` as the ambient complex-type home;
- `shared/algorithm32/production/types/LightSourceModel.d.ts`,
  `shared/algorithm32/production/types/AtmosphereModel.d.ts`, and
  `shared/algorithm32/production/types/GeometryModel.d.ts` as the first
  ambient consumer-provided model interface contracts;
- `shared/algorithm32/production/types/Color.d.ts` as the caller-provided
  spectral-output to display-color conversion interface, adjacent to
  Algorithm32 core output rather than facade-owned configuration;
- `shared/algorithm32/production/types/types.d.ts` as the supporting
  request/sample/descriptor type home for those focused interface files,
  including the `SpectralBasis` union used by consumer-provided model calls.
  Canonical production config uses the complete `SpectralDensityBasisDescriptor`
  as the single owner of channel shape and bin meaning. Focused noncanonical
  test bases may retain an explicit wavelength-sample list but may not
  masquerade as the canonical density basis;
- `shared/algorithm32/production/implementation/Reference.js` as the
  CPU/reference algorithm execution collaborator. It now orchestrates the
  reconciled owner-query flow through `SpectralCalculator` and applies
  request/default/null `IncidentRadianceSampling` precedence;
- `shared/algorithm32/production/implementation/SpectralCalculator.js` as the
  common internal radiance/math collaborator used by `Reference` and cache
  building;
- `shared/algorithm32/production/implementation/buildIncidentRadianceCache.js`
  and `shared/algorithm32/production/implementation/noIncidentRadiance.js` as
  the first setup-bound incident-radiance support utilities;
- `shared/algorithm32/production/light-sources/DistantSunIncidentRadianceCache.js`
  and
  `shared/algorithm32/production/light-sources/LocalSunIncidentRadianceCache.js`
  as the first source-owned concrete incident-radiance cache families, with
  coordinate generation, cache population, CPU samplers, and shader payload
  descriptors plus cache-owned descriptor facts;
- `shared/algorithm32/production/light-sources/DistantSunLightSource.js` and
  `shared/algorithm32/production/light-sources/LocalSunLightSource.js` as the
  first concrete light-source implementations for direct lighting,
  source-path limits, cache policy, cache creation, and source-owned Three
  renderer-light creation;
- `shared/algorithm32/production/light-sources/types.d.ts` as the
  source-specific ambient type home for the concrete light-source and cache
  configuration packets;
- `shared/algorithm32/production/atmospheres/CanonicalAtmosphere.js` as the
  first concrete atmosphere model for medium sampling, optical-depth
  integration, and Rayleigh/Mie phase sampling;
- `shared/algorithm32/production/atmospheres/types.d.ts` as the
  atmosphere-specific ambient type home;
- `shared/algorithm32/production/geometries/SphericalEarthGeometry.js` and
  `shared/algorithm32/production/geometries/FlatEarthGeometry.js` as the first
  concrete geometry models for view-ray segments, atmosphere paths,
  source-relative coordinates, cache access, cache-build rays, and
  geometry-owned Three endpoint object creation;
- `shared/algorithm32/production/geometries/types.d.ts` as the
  geometry-specific ambient type home;
- `shared/algorithm32/production/implementation/ShaderBuilder.js` as the
  runtime shader artifact builder with fail-loud setup attachment validation
  and a first artifact packet shape;
- `shared/algorithm32/production/implementation/types.d.ts` as the local
  ambient type home for implementation-only complex packet shapes;
- `shared/algorithm32/production/models/SharedModel.js` as the documented
  aggregate model accepting caller-provided light source, atmosphere, and geometry
  implementations plus the accepted spectral basis, constructing the
  facade-owned `SpectralModel`, and exposing `lightSource`, `atmosphere`,
  `geometry`, `spectral`, `version`, and `snapshot`;
- `shared/algorithm32/production/models/SpectralModel.js` as the documented
  spectral component model owning the active spectral basis, channel shape,
  fingerprint, and version, with basis replacement, wavelength lookup,
  descriptor snapshots, and alignment checks;
- `shared/algorithm32/production/models/types.d.ts` as the local ambient type
  home for model-only complex packet shapes;
- `shared/algorithm32/production/utils/ScalarMath.js`,
  `shared/algorithm32/production/utils/AngleMath.js`,
  `shared/algorithm32/production/utils/DistanceMath.js`,
  `shared/algorithm32/production/utils/WavelengthMath.js`,
  `shared/algorithm32/production/utils/VectorMath.js`,
  `shared/algorithm32/production/utils/ArrayMath.js`, and
  `shared/algorithm32/production/utils/SampleMath.js` as default-exported
  generic pure numeric utility objects with call-local options and no hidden
  mutable state;
- `shared/algorithm32/production/utils/MathUtils.js` as the named re-export
  entry point for grouped utility imports;
- `shared/algorithm32/production/utils/types.d.ts` as the local ambient type
  home for utility-only complex option/result shapes;
- `shared/algorithm32/production/references.md` for AMA-style third-party
  source references used by physics implementation, algorithm variations, test
  fixtures, and non-fixture algorithm tests, plus first-pass internal
  experiment short-code references cited as `(script <code>)`;
- `shared/algorithm32/production/evidence.md` for accepted first-party
  Algorithm32 experimental evidence details once scripts, records, artifacts,
  criteria, and run ids are collected for experimentally determined production
  values;
- `shared/algorithm32/production/fixtures/analytic-invariants.json` as the
  first production fixture ledger, promoted from externally referenced rejected
  analytic fixture rows and normalized to numbered references plus compact
  reference pointer objects;
- `shared/algorithm32/production/_tests/scaffold.spec.js` for package-level
  guardrail specs, including rejection of inherited flat-app local source tint
  identifiers and the unsourced `{ r: 1, g: 0.98, b: 0.95 }` tint value from
  production source/type/reference files;
- `shared/algorithm32/production/_tests/fixtures.spec.js` for package-level
  fixture-envelope validation and the guard that app-spec-only citations are
  not promoted as production physics fixture references; bracket citation
  numbers must match each row's compact reference pointer numbers and
  superscript citations must not be used;
- local class specs named after each class, including
  `shared/algorithm32/production/_tests/Algorithm32.spec.js`,
  `shared/algorithm32/production/implementation/_tests/Reference.spec.js`,
  `shared/algorithm32/production/implementation/_tests/SpectralCalculator.spec.js`,
  `shared/algorithm32/production/implementation/_tests/ShaderBuilder.spec.js`,
  `shared/algorithm32/production/atmospheres/_tests/CanonicalAtmosphere.spec.js`,
  `shared/algorithm32/production/geometries/_tests/SphericalEarthGeometry.spec.js`,
  `shared/algorithm32/production/geometries/_tests/FlatEarthGeometry.spec.js`,
  `shared/algorithm32/production/light-sources/_tests/DistantSunLightSource.spec.js`,
  `shared/algorithm32/production/light-sources/_tests/DistantSunIncidentRadianceCache.spec.js`,
  `shared/algorithm32/production/light-sources/_tests/LocalSunLightSource.spec.js`,
  `shared/algorithm32/production/light-sources/_tests/LocalSunIncidentRadianceCache.spec.js`,
  `shared/algorithm32/production/models/_tests/SharedModel.spec.js`, and
  `shared/algorithm32/production/models/_tests/SpectralModel.spec.js`.

Latest verification: `npm run test:algorithm32:production` passes 229 specs
with 0 failures after the facade lifecycle, contract-alignment,
`SpectralCalculator`, cache-coordinator, concrete cache-family, light-source,
atmosphere, geometry, canonical data, Color/display conversion, concrete
geometry, atmosphere, light-source, source-created cache, Color, and core
transport owner shader contributions, shader descriptor/assembly, cache texture resource,
cache descriptor/payload validation, reusable scene depth/hit capture,
geometry-owned Three endpoints, and source-owned Three lighting,
geometry-owned scene-depth cap resolution, scene-input exclusion during
capture, real flat/globe app composer integration, and runtime pass
implementation slices.

The scaffold specs are expected to stay green while real contracts are added.
Each new source-backed physics implementation, algorithm variation, fixture,
non-fixture algorithm test, or experimentally determined value should add an
AMA-style numbered entry to `shared/algorithm32/production/references.md`
before depending on a third-party algorithm, paper, dataset, curated fixture,
or source-backed fixture source. First-party internal experiments may use the
first-pass short-code path in `references.md`: add a stable code and brief
description, then cite it as `(script <code>)` until the experiment code and
record locators are collected in `shared/algorithm32/production/evidence.md`.

Production code reference standard:

- Use AMA-style numbered references in
  `shared/algorithm32/production/references.md`.
- In code comments, JSDoc comments, and JSON fixture text fields, cite sources
  with ASCII bracket tokens. Examples: `[1]`, `[2]`, `[1][2]`, and
  `[10][11]`.
- Cite first-pass internal experiments with ASCII short-code tokens of the
  form `(script <code>)`, where `<code>` is listed with a brief description in
  `shared/algorithm32/production/references.md`.
- Do not use Unicode superscripts, Markdown footnotes, or HTML citation markup
  for inline production citations.
- Precede each citation with a short description of the data, formula,
  algorithm decision, or algorithm variation being cited.
- Cite the algorithm as a whole and cite meaningful variations or source-backed
  fixture/test decisions. Do not cite every branch when the branch is merely a
  structural implementation detail of an already cited algorithm.
- Test fixtures should cite their source data. Non-fixture algorithm tests
  should cite the physics or algorithm behavior they assert.
- Use compact reference pointer objects when an implementation note, fixture
  row, expected value, or validation claim needs a precise locator beyond the
  AMA entry. The pointer should identify the numbered `references.md` entry
  and may include a section, equation, figure, table, row, page, local artifact
  path, or short note. First-party experimental provenance should use an
  evidence pointer that names the first-pass `(script <code>)` reference or
  the accepted `evidence.md` entry plus the exact script, record, artifact,
  criterion, or run id that fixed the value. This is a shared production
  locator shape, not a fixture-local reference-object standard.
- Do not require citations for API-shape compliance, validation plumbing,
  guardrail mechanics, architectural choices, module boundaries, class/file
  placement, JSDoc style, or incidental limitations that come from
  data-structure or platform constraints. If a test intentionally enforces
  operational extents caused by a language or platform limit, such as
  JavaScript number precision or floating-point resolution, cite the relevant
  language/runtime specification.
- The intent is to justify physics and algorithm decisions. Reconciliation
  conclusions own accepted implementation behavior. Archived experiment
  outputs are not production references or citations by default, but relevant
  scripts and records may be promoted first into short-code internal
  experiment references in `references.md`, then into detailed first-party
  evidence entries in `evidence.md` when they are the provenance for an
  experimentally determined value.

Algorithm vocabulary guidance:

- We may adopt established domain vocabulary from the references, but should
  paraphrase explanations instead of copying source prose.
- Prefer industry-standard terminology whenever it exists. The goal is for a
  coder to be able to move from the code into the rendering/atmospheric
  scattering literature without translating project slang, and for a domain
  reader to recognize the code concepts from the literature. Standard terms
  also improve the perceived legitimacy of the code by making the implementation
  read like it belongs to the same professional vocabulary as the references.
- Use PBRT terminology for the core transport/evaluation surface: `ray`,
  `radiance`, `incident radiance`, `transmittance`, `optical depth`,
  `Beer-Lambert attenuation`, `absorption coefficient`, `scattering
  coefficient`, `extinction coefficient`, `phase function`, `in-scattering`,
  and `diffuse reflection`.
- Use Bruneton atmosphere-rendering terminology for the atmosphere and shader
  architecture surface: `spectral radiance`, `single scattering`, `multiple
  scattering`, `irradiance`, `transmittance`, `scattering`, `precomputed`
  texture data, dimensional consistency, and explicit spectral-to-display
  conversion.
- Use selected data/model references for facts rather than broad algorithm
  names: CIE for color matching functions and visible-grid metadata, ASTM
  G-173/SMARTS for solar spectral reference conditions, U.S. Standard
  Atmosphere for profile rows, Bucholtz for Rayleigh coefficient data, Brion
  for ozone cross sections, Kasten-Young for air-mass rows, and IAU nominal
  constants for solar irradiance anchors.
- Prefer generic `light source` language in core API names. Terms such as
  `Sun`, `Moon`, or other concrete source kinds belong only in specific
  light-source implementations or cited source-data fixtures.
- Prefer method names that describe the operation being performed. Use
  `resolve...` when a model answers a deterministic question from owned data.
- Methods should generally be verb phrases, with the verb as the first word.
  Types should generally be nouns or noun phrases. Properties should generally
  be nouns or noun phrases that describe the fact they store.
- Reconciliation POC type and property names carry into production unless they
  are actively misleading in the production contract. Do not rename POC fields
  merely to make them feel more polished or locally idiomatic. When a rename is
  required, document the one-to-one mapping next to the promoted type.
- The same rule applies beyond types: POC method flow, ownership boundaries,
  packet structure, defaults, descriptors, and shader/cache setup details are
  production details unless they conflict with an explicit recorded production
  exception.
- Durable public/configuration/API types should not encode units in property
  names such as `distanceMeters`, `angularRadiusRadians`, or `wavelengthsNm`.
  Any quantity that can be represented in different units through conversion
  must use a unit-bearing value packet such as `Distance`, `Angle`,
  `Wavelength`, or `Position` at durable boundaries. Canonicalize once into
  hot-path scalar values before expensive loops. Unit strings inside those
  packets use plural spellings such as `meters`, `kilometers`, `radians`,
  `degrees`, `nanometers`, and `micrometers`; singular unit spellings fail
  validation.
- Unit utility constructors may use `in<Unit>(value)` names, such as
  `inKilometers(10000)`, because they read like unit literals and deconstruct
  well. Unit conversions should use `to<Unit>(unitValue)` names, such as
  `toKilometers(distance)`, and should accept the unit-bearing value packet
  rather than pairwise scalar conversion names.
- Unit utility objects may also expose small unit-aware math operators such as
  `add`, `subtract`, and `scale` for readable one-line operations where
  canonicalizing first would be ceremony. These operators should accept
  unit-bearing packets, return unit-bearing packets, and keep the result in the
  left operand's units. Expensive loops should still canonicalize once to plain
  scalars before iteration.
- Avoid raw verbs such as `sample(...)`, `resolve(...)`, or `convert(...)`
  unless the receiver and call context make the target domain unmistakable.
  Use the accepted reconciliation method names when promoting POC code; when a
  new name is required, prefer specific method names such as
  `sampleDirectLighting(...)`, `sampleMedium(...)`, `samplePhase(...)`,
  `resolveViewRaySegment(...)`, or `convertSpectralRadiance(...)` when the
  extra noun prevents ambiguity.
- `sample` is the official noun and verb for Algorithm32 field,
  distribution, path, quadrature, light-source, phase-function, and texture
  sample contexts. PBRT uses sampling vocabulary for light and
  phase/distribution evaluation, and Bruneton-style shader paths also sample
  precomputed functions or textures. In Algorithm32, a name such as
  `LightSourceModel.sampleDirectLighting(...)` means "evaluate or select the
  direct incoming lighting contribution for the requested position/path and
  spectral basis"; the owner supplies the light-source context, and a returned
  `sample` is the data packet produced by that operation.
- Use `resolve...` instead for deterministic ownership questions that are not
  samples of a field or distribution, such as
  `GeometryModel.resolveViewRaySegment(...)`.

The production scaffold also carries a package guardrail against the local
source tint that leaked from the flat app into later shader-lab experiments.
Production Algorithm32 may accept source facts only through sourced spectral
data or explicitly accepted reference-backed configuration; the inherited app
RGB tint and its rough wavelength grouping must remain outside the production
physics/runtime code.

Generic production code uses light-source terminology. Solar-specific language is
reserved for concrete light-source implementations, such as a future solar
implementation, and must not appear in the core facade, shared model,
algorithm/reference execution, shader builder, generic types, or generic
utilities.

Class-specific specs live in local `_tests/` folders beside their classes and
use `ClassName.spec.js` filenames. `SpectralModel` is the first model promoted
into implementation. Existing `Reference` helper methods and specs are useful
scaffold guardrails, but they are not the final transport architecture: the
reconciliation POC replaces the distance-only and one-sample helper shape with
geometry-owned view segments, atmosphere coordinates/paths, source-path
optical depth, separate Rayleigh/Mie phase facts, setup-bound
`IncidentRadianceSampling`, and a shared `SpectralCalculator`. As production
promotion proceeds, retain only helper behavior that still matches the
reconciled contracts and rewrite stale helper tests into calculator,
reference, cache, or contract tests as appropriate.

Production physical and algorithm expectations must be fixture-backed. Keep
expected physics values, algorithm invariants, tolerance rules, and source
packets in JSON expectation ledgers rather than inline spec literals. Each
fixture row should carry a stable id, production citation, assumptions, inputs,
expected data, tolerance metadata, and an independence note. Fixture citations
use the same AMA-style numbered entries in
`shared/algorithm32/production/references.md` and bracket citation tokens used
by production code comments for third-party sources. Experimentally determined
values use concise accepted evidence names from
`shared/algorithm32/production/evidence.md` in prose or fixture metadata rather
than bracket citation tokens. Fixture rows may include compact provenance
pointer objects that identify either a numbered reference plus precise source
locators such as sections, equations, figures, tables, rows, pages, or local
artifact paths, or an accepted evidence name plus the exact script, record,
artifact, criterion, or run id. The first production ledger is
`shared/algorithm32/production/fixtures/analytic-invariants.json`, which
promotes externally backed analytic rows from the rejected fixture file and
omits rows whose citations only referenced local app/stage specs. Prefer
actual source data, authoritative tables,
published examples, or external-tool artifacts over reference calculations
when possible. Hand-derived calculations
are acceptable mainly for source-backed analytic invariants. Physics and
algorithm tests should cover sourced extents that cap or bound the calculation
domain, not only central happy paths. Those extents may be physics-based, such
as an optical wavelength range, a valid coefficient domain, a vacuum/no-medium
limit, a zero-length or zero-weight path, or a monotonic transport limit. They
may also be operational, such as JavaScript number precision, representable
finite values, or floating-point resolution. Physics extents must be backed by
third-party references, empirical sources, published algorithm papers,
source-backed fixture rows, or accepted first-party Algorithm32 evidence
entries; operational extents may cite the relevant language/runtime
specification. Practical caps
are acceptable when the cap and its reason come from the cited source, such as
a Bruneton-style paper or empirical dataset, instead of from an invented local
rationale. Do not choose extent values as arbitrary convenient numbers. Before consuming a
fixture family, add a fixture validation spec that validates the row envelope
and provenance, following the precedent from
`scripts/flat/atmosphere_rejected/reference/_tests/expectation-fixtures.spec.js`
and `test-expectations.js`. Inline spec literals remain acceptable for
bookkeeping, API shape, validation plumbing, and other non-physics behavior.
Reconciliation records are supporting evidence until promoted into a checked-in
production fixture ledger with citations to
`shared/algorithm32/production/references.md` or accepted evidence names in
`shared/algorithm32/production/evidence.md`; do not treat generated record
outputs as canonical test facts without that promotion step.

GPU-vs-reference display parity follows the reconciliation shader evidence,
not an exact-browser-readback rule. Selected-pixel comparisons against
`Reference` plus the production `Color` display path use evidence
`gpu-selected-rgba-byte-parity`: max absolute RGB byte delta `3` for
deterministic 8-bit display readbacks, with alpha exact unless the scene
declares an alpha-composition claim. The M4 local/flat record's looser `10`
byte runner tolerance remains an integration-probe bound; its observed max
delta was `1`, so it does not relax the production baseline.

Whole-image and controlled-region comparisons remain scene-owned claims.
They should record exact byte metrics for audit, and visual-quality/profile
claims should also use evidence `gpu-perceptual-quality-metrics`: Rec.709
display-luma deltas, weighted-RGB proxy deltas, and CIEDE2000-style residual
diffs with a `1.0 Delta E 2000` just-noticeable threshold as a review aid.
Those perceptual metrics explain quality and profile choices; they are not a
blanket proof that a rendered difference is invisible under all conditions.

## Production Boundaries

`shared/algorithm32/production/` should become the only production
implementation owner for Algorithm32 atmosphere behavior. It should not import
from `shared/algorithm32/POC/` once a promoted module exists.

The assumed public shape is a configured facade instance, created once per
independent simulation window. The facade contains the validated Algorithm32
configuration, creates a facade-owned shared configuration/facts model from
that configuration, and coordinates two primary internal implementation
classes: a CPU/reference algorithm execution class for selected-ray evaluation
and validation/oracle support, plus a runtime shader builder for building the
Algorithm32 runtime shader and providing the composer-attachable
pass/material/binding information. Cache construction is setup/resource
preparation that may consume shared calculator utilities without becoming
`Reference` ownership. Both implementations receive a reference to the shared
model instead of duplicating configuration interpretation. Validation/error
handling, display conversion, concrete runtime packing, and generally useful
pure math utilities are separate owners. Shared model state should be
immutable snapshots or explicitly versioned facade-local state so multiple
simulation windows can run side by side without global mutable configuration
or resource leakage.

Facade reconfiguration updates the shared model, not the consumers directly.
The CPU/reference algorithm execution class and runtime shader builder
should observe model changes through explicit model versions or snapshots
captured at operation boundaries. Long-running texture/cache builds and
awaited shader resource updates must either complete against the captured
model version or fail/restart when the facade replaces the model facts.

Core responsibility terminology:

- Algorithm configuration facts:
  the durable facts and typed abstractions the Algorithm32 algorithm consumes,
  including Sun/source, atmosphere medium, geometry, spectral basis, and
  execution settings. These facts live below the algorithm itself and are
  owned by their subordinate abstractions.
- Validation/error handling:
  the separate class that accepts or rejects configuration facts, requests,
  descriptors, runtime capabilities, and cache compatibility. It does not own
  the physics facts and does not execute the algorithm.
- Algorithm execution:
  running the Algorithm32 calculations for one specific input/request. It
  consumes validated configuration abstractions, asks them for the typed data
  it needs, computes spectral transmittance/radiance results, and owns only
  the computed results and transient calculation state for that run.
- Workflow, builders, and adapters:
  higher-level consumers around the core. The CPU/reference algorithm
  execution class, texture/cache build workflow, runtime shader builder,
  Three/runtime adapter behavior, facade, display conversion, and pure math
  namespace coordinate or support the core, but they are not the shared model
  itself.

The current POC and latest experimental-lane audit add these external API
requirements:

- The normal renderer input is a live Three scene rendered into color and
  depth textures, followed by an Algorithm32 fullscreen shader pass. Scene
  packets and Raycaster captures are validation/oracle inputs only.
- The facade must reduce caller domain knowledge by owning or exposing
  source-driven synchronization for scene lights and atmosphere uniforms, plus
  geometry-driven camera/world/depth/no-hit sky policy.
- The runtime shader builder and the runtime pass it creates must fail loudly
  for
  unsupported WebGL/Three features, accidental software-renderer fallback,
  unsupported source/geometry/scattering combinations, and missing or stale
  local second-order cache resources. Stable capability diagnostics are
  deferred. During live runtime frames after successful setup, failures should
  be logged and rendering should continue with the last valid state, no-op, or
  fallback path when possible.
- Local second-order rendering requires an explicit validated incident-cache
  texture/descriptor; it must not silently fall back to first-order when the
  requested second-order feature set cannot be satisfied.
- Validation scene packets, selected-pixel readbacks, image-delta summaries,
  and postprocess-versus-integrated galleries remain validation evidence, not
  normal app render input. CPU/reference evaluation is only an oracle for
  selected rays and fixtures.

Planned module boundaries should follow the ownership domains in the
requirements. Each boundary should be implementable and testable as a mostly
self-contained code surface with explicit interfaces to adjacent boundaries:

- `api-contract`: public interface definitions, version markers,
  serialization contracts, validation metadata requirements, interface
  encapsulation rules, and eventual public error taxonomy. This boundary owns
  the API surface that the other modules implement against; stable diagnostics
  and public error taxonomy are deferred from the first implementation slice.
- `input-contracts`: the three algorithm input abstractions: Sun, atmosphere
  composition, and geometry. Sun covers distant directional Sun and flat local
  finite Sun. Atmosphere composition covers spectral channels, scattering,
  extinction, absorption, density profiles, phase parameters, and provenance.
  Geometry covers spherical atmosphere geometry and flat z-up atmosphere
  geometry. This boundary must publish the public API interfaces for those
  inputs and for the combined algorithm-input packet. Each input interface owns
  its domain's external state: Sun-related, composition-related, and
  geometry-related details stay behind resolvers or factories unless
  explicitly exposed by the corresponding public interface or its public
  input/resolver types.
- `calibration`: local-Sun clock synchronization and source-power calibration
  helpers that derive a resolved public `Sun` input from
  user-understandable normalized location/date/time-zone/view context.
- `transport`: CPU/reference algorithm execution support for validation,
  future diagnostics, cache construction, shader texture building,
  optical-depth/transmittance helpers, and first-order and second-order path
  radiance. This boundary consumes the facade-owned shared model and owns the
  CPU/reference execution surface rather than serving as a shared mutable
  operations service for every consumer.
- `local-incident-cache`: local direct incoming-radiance oracle, cache config,
  Sun-subpoint local radial/tangential/up frame transforms, cache keying,
  fail-loud stale/mismatch behavior, and GPU packing metadata.
- `celestial-contribution-cache`: optional camera-independent field resource in
  geometry-owned coordinates. It contains already atmosphere-transported
  extended radiance and point irradiance over selected source/geometry domains.
  Current shader rays supply camera projection, pixel footprint, and foreground
  depth at query time. It is neither shared-model truth, a viewport image, nor
  an incident-radiance cache.
- `texture-builder`: internal shader/runtime resource preparation that builds,
  keys, packs, and describes shader textures from the same public Sun,
  atmosphere-composition, geometry, and execution-configuration facts used by
  CPU reference and cache support. This boundary is separate from per-path
  evaluation but is not a first-production public texture-artifact API; it is
  owned under `ShaderBuilder` and awaited shader setup/handle updates. It
  consumes the same shared model but owns grid traversal, packing,
  descriptors, and cache validation.
- `runtime-shader`: the production shader/runtime surface, centered on the
  runtime shader builder. The builder consumes the shared model, packaged
  shader source, facade `ShaderRuntimeConfig`, runtime attachment request,
  cache/display descriptors, and capability validation, then constructs the
  runtime shader artifacts and a shader binder that applies those artifacts to
  the caller's composer/runtime surface. Runtime configuration is part of
  facade configuration and participates in setup plus later config updates; it
  is not just creation-time setup data. Runtime attachment handles such as
  composer, scene, camera, renderer-compatible surface, and pass insertion
  location remain setup/handle inputs. This boundary also owns the first Three
  pass, WebGL texture upload policy, uniform mapping, source/geometry/light
  synchronization, live scene color/depth composition, basic fail-loud
  capability/resource validation, and explicit rejection of deferred debug
  modes in the first production slice. Stable diagnostics remain deferred.
- `display`: spectral-to-output-color conversion, including CIE/XYZ/RGB
  mapping, display color space, exposure, tone mapping, and future deferred
  debug-display policy. Algorithm32 core output is spectral or spectral-group
  radiance and transmittance, not display-converted color. Display conversion must live in
  its own class/module and must not change the Sun, atmosphere composition,
  geometry, or transport facts. This boundary must publish the public display
  conversion interface separately from the algorithm-input interfaces.
- `validation`: deterministic smoke/parity helpers that prove promoted modules
  satisfy the reconciliation acceptance contract without generating new
  numbered artifacts.

The flat app owns user/session context: current view location, date/time,
time-zone selection, geocoding, terrain asset policy, and camera choreography.
Algorithm32 owns pure Sun, atmosphere composition, geometry, calibration,
execution configuration, transport, cache, shader texture building, adapter,
validation contracts, and a separate display-conversion class for consumers
that need output colors from spectral results.
Calibration helpers may compute deterministic solar-zenith and local-source
synchronization values from a normalized app-provided context packet, but
Algorithm32 must not own or persist the app's live UI state.
Local Sun configuration and calibration state must not influence transport,
texture building, cache sampling, or runtime shader behavior except by
resolving to the public Sun interface.

## Validation And Error Handling Class

The facade is expected to coordinate one CPU/reference algorithm execution
class, one runtime shader builder class, one shared
configuration/facts model class, and one validation/error handling class. A
display-conversion class may live beside the facade as an adjacent consumer,
but it is not facade-owned state.
The validation/error class should be the single owner of contract checks,
canonical config snapshots, compatibility decisions, and structured
Algorithm32 errors. This keeps the shared model focused on canonical facts,
data descriptors, and narrow data-access/descriptor-derivation methods.

The validation/error class should be instance-bound to the facade, or receive
an explicit validation context for each operation. It should not be a global
mutable singleton. Its candidate responsibilities are:

- validate public `Algorithm32Config` and enforce the public Sun,
  atmosphere-composition, geometry, execution, and shader boundaries;
- apply non-physics defaults and return immutable canonical config snapshots;
- maintain the facade-local config version and identify which prepared shader
  or cache resources are invalidated by full config replacement;
- compute or coordinate stable public-interface fingerprints for Sun,
  atmosphere composition, geometry, execution configuration, shader resource
  policy, wavelength grid, direction sets, cache bins, and packing version;
- own deterministic Algorithm32 error construction for invalid inputs,
  unsupported source/geometry/scattering combinations, invalid shader
  descriptors, cache-key mismatches, stale cache data, missing cache samples,
  malformed incoming-radiance samples, invalid vectors, and unsupported GPU
  packing;
- validate IncidentRadianceCache descriptors, source keys, stale keys, bin
  ranges, direction sets, wavelength grids, packing versions, and
  target-device requirements before CPU sampling or GPU binding;
- validate runtime capability status reported by the runtime shader builder
  against the requirements derived from the selected configuration;
- define validation-only scene packet checks and adapters for GPU shader
  comparison against `Reference` evaluation, including scene color, depth or
  hit distance, hit mask, ray directions, selected pixels, source, geometry,
  camera, and diagnostics;
- normalize diagnostics and deterministic summaries from CPU transfer outputs,
  shader resources, cache descriptors, and validation readbacks without
  exposing private implementation fields beyond public descriptor types.

The CPU/reference algorithm execution class and runtime shader builder
should call this class when they need to accept external input,
replace config, bind resources, prepare caches, preflight renderer
capabilities, or report failures. They should not invent their own error
strings or compatibility policies.

## Display Conversion Class

Algorithm32 core output is spectral or spectral-group radiance and
transmittance. Display conversion is therefore owned by the production
`Color` abstraction rather than by the shared model, the main Algorithm32
config, or the Algorithm32 facade itself. The Color implementation supplies
the Bruneton-backed spectral-to-display conversion and any shader-facing
descriptor needed by the runtime shader builder.

The Color abstraction consumes the already-composed atmosphere plus celestial
spectral output and produces display-facing color for CPU/offline tools and
runtime shader builder inputs. It does not build, sample, transport, or
validate the celestial contribution cache.
It may receive the current spectral component model or a spectral descriptor
for wavelength alignment, but it treats radiance and transmittance as inputs
produced by Algorithm32 rather than values it computes. Debug-view output is
deferred with diagnostics rather than promoted as first-production Color or
shader API.

The Color abstraction should own:

- display configuration defaults and canonical display-conversion snapshots;
- versioned spectral-to-output-color conversion, including CIE/XYZ/RGB
  mapping, output color space, exposure, and tone mapping;
- alignment/interpolation from Algorithm32 spectral wavelengths to the
  display-conversion basis;
- shader display-conversion descriptors, uniforms, constants, or shader
  snippets emitted through `Color.describe()` or a promoted Color-owned
  descriptor needed by the runtime shader builder to convert spectral shader
  output to screen color;
- CPU/offline display conversion helpers for reports, fixtures, and parity
  comparisons that need RGB output from spectral transport results;
- one post-composition display boundary for both extended and point source
  contributions. Color does not own source magnitude, point response, angular
  integration, visibility, or atmosphere ordering.

The Color abstraction should not own Sun, atmosphere composition,
geometry, execution configuration, cache keys, calibrated source power,
transport facts, Algorithm32 spectral output generation, or the Algorithm32
facade lifecycle. It is outside the Algorithm32 facade border. Runtime shader
or application integration code may use its descriptors when a usable screen
pass is needed, but it is not a core Algorithm32 algorithm input and not
facade-owned state.

## Pure Math API Namespace

Generally useful pure math functions should live in their own API namespace
rather than inside the shared model. The current production utility files are
domain-agnostic default-exported objects under `utils/`: `ScalarMath`,
`AngleMath`, `DistanceMath`, `WavelengthMath`, `VectorMath`, `ArrayMath`, and
`SampleMath`. A later facade-level
export may gather them under a single namespace, but the functions must remain
pure: deterministic, side-effect-free, and configured only through explicit
call-local options.

This namespace should contain deterministic, side-effect-free helpers that have
no Algorithm32 physics meaning on their own:

- scalar helpers:
  `clamp`, finite-number checks, safe numeric defaults, tolerant equality,
  range checks, linear interpolation, and stable numeric formatting;
- angle and unit helpers:
  unit-packet constructors such as `inDegrees`, `inMeters`, and
  `inNanometers`; unit-packet conversions such as `toRadians`, `toKilometers`,
  and `toMicrometers`; unit-aware one-line operators such as `add`,
  `subtract`, and `scale`; and normalized angle wrapping when no
  domain-specific clock or orbit semantics are involved;
- vector helpers:
  vector add/subtract/scale, `addScaled`, dot, cross, length, distance,
  normalize, and finite/normalized tuple checks for plain numeric vectors;
- numeric-array helpers:
  fixed-length zero arrays, add/multiply arrays, mean, weighted sum, and
  element-wise map helpers that do not know whether the numbers represent
  spectra, colors, cache bins, or positions;
- sample-domain helpers:
  nearest-sample lookup, padded samples, monotonic sample traversal, and stable
  sample signatures.

The pure math namespace should not know about Sun, atmosphere composition,
geometry, spectral radiance, wavelength grids, transmittance, phase functions,
cache `z`/`rho`, source-frame transforms, shader packing, display conversion,
or validation/error taxonomy. If a helper needs those words in its name or
contract, it belongs to a more specific Algorithm32 class.

## Shared Aggregate Model Component Models

The shared aggregate model class sits below the Algorithm32 calculations. It
should concentrate shared canonical configuration facts and descriptors needed
by both the CPU/reference algorithm execution class and the runtime shader
builder. Candidate
names include `Algorithm32SharedModel`, `Algorithm32ConfigurationModel`, or
`Algorithm32Facts`; exact naming remains open. It is not the workflow, not
validation, not display conversion, not pure math, and not the execution of
the Algorithm32 algorithm for a specific input.

The facade creates and owns the aggregate model from validated `Algorithm32Config`
data. The CPU/reference algorithm execution class and shader/resource
builder both hold a reference to that facade-owned model.
Reconfiguration should replace or version the model's immutable canonical
facts so those consumers can pick up new facts at operation boundaries without
observing partially-updated state.

The aggregate model is the canonical shared configuration snapshot, not a
home for every operational descriptor in the system. It should expose only the
configuration views needed by both top implementation domains:
CPU/reference algorithm execution and runtime shader building.
The three root component models are canonical views over consumer-provided
inputs; the fourth is the canonical spectral basis/shape derived from
configuration. Existing production top-level class names remain fixed, and
promoted reconciliation POC type, property, and method names carry forward
unless they are actively misleading in the production contract.

The real shared aggregate model is likely:

```js
model.source
model.atmosphere
model.geometry
model.spectral
```

Component models may share public types, immutable descriptors, and
sample/result packet shapes, but typed domain data remains owned by the
component model that defines the fact. Algorithm execution and
shader/resource preparation consume these component models through explicit
samples/descriptors; sibling component models should not reach directly into
each other's internals.

Interface boundary rule:

- A consumer-provided model interface must not receive peer model
  implementations as request data. For example, a light-source call should not
  receive the full atmosphere or geometry model object.
- Hot-path calls should pass only the direct data needed to answer the request,
  such as positions, directions, spectral basis, or previously sampled plain
  result packets.
- Build/setup/compatibility flows may use immutable descriptors,
  fingerprints, versions, and narrow plain data packets from peer models, but
  not peer model objects.
- One model must not call another model directly. The CPU/reference execution
  class, shader builder, facade, or a dedicated coordinator is responsible for
  asking one model for facts and passing the resulting plain data to another
  when that is truly needed.
- If a request packet starts carrying broad `context` objects, treat that as a
  design smell and split the packet into explicit owned facts, descriptors, or
  coordinator-managed setup state.

- Light-source model:
  canonical view of the consumer-provided public `LightSourceModel` value plus
  resolved lighting-fact samples. It owns spectral irradiance/radiance
  interpretation, source-specific falloff, apparent extent policy,
  calibration, direct lighting, source path limits, and incident-radiance cache
  family creation. Runtime incident-radiance sampling is setup-bound
  `IncidentRadianceSampling`, not a generic light-source per-sample method. It
  consumes geometry-owned
  `SourceRelativePosition` and explicit placement/frame facts instead of
  interpreting raw flat or spherical coordinates. It owns interpretation of
  that position as incoming direction, distance-use treatment, source path
  limits, falloff, angular extent, and spectral scale.
  Concrete solar, lunar, or other illumination behavior belongs in specific
  source implementations. Point sources own typed spectral irradiance density;
  extended sources own typed directional spectral radiance density. A
  `CanonicalUniformSunDiskSource` may derive disk radiance from the same
  canonical solar irradiance packet retained by `DistantSunLightSource` so the
  visible disk and illumination never create separate solar arrays.
  Atmospheric illumination and camera-ray visibility remain separate roles
  with separate composition paths. A source-owned cache-family method may create an
  incident-radiance cache, but the concrete cache artifact owns its generated
  values, sampler, shader payload, and packing/access descriptors. Its
  descriptor must record the geometry, atmosphere, spectral,
  execution-control, and packing dependencies used to build it.
- Atmosphere medium model:
  canonical view of the consumer-provided public atmosphere composition value
  plus local medium samples. It owns density/profile sampling, wavelength
  coefficient lookup, Rayleigh/Mie/absorption coefficients, phase parameters,
  and any composition-level provenance or formula version that is part of the
  public atmosphere interface.
- Geometry model:
  canonical view of the consumer-provided public geometry value plus
  model-space frame and ray/path descriptors. It owns altitude,
  atmosphere-boundary intersections, flat top and ground behavior, no-hit
  sky-ray distances, source-path clipping after light-source path limits,
  view-segment clipping, and numeric Three-to-Algorithm position/direction
  transforms. It also owns
  observer and light placement resolution into its model-space frame,
  `SourceRelativePosition` values for observer-source and path-point-source
  relations, and bidirectional or representative mapping between model-space and
  source-relative cache coordinates. This can include resolved Sun/source
  position when placement is part of the selected geometry, projection,
  orbit/time, or ephemeris adapter. Those facts must cross the boundary as
  explicit descriptors, not as source-side access to geometry internals.
  Runtime shader code owns actual Three objects and camera matrices; generic
  vector math and unit conversion come from the pure math API namespace.
- Spectral model:
  encapsulates the wavelength grid and spectral channel shape. It owns the
  active basis data, descriptor identity, replacement/mutation of that basis,
  and queries that compare values or other bases to the owned channel shape.
  Generic vector-space construction and arithmetic come from `VectorMath`,
  shader/cache packing belongs to the runtime shader builder, and RGB/tone-map
  output belongs to the display-conversion class.

### Domain-Specific Models Outside The Shared Aggregate

The following model-like objects are still useful, but they are not shared
aggregate model components because they are needed by only one top
implementation domain or by a specific operation request.

Algorithm execution specific abstractions:

- Evaluation request:
  the caller-supplied one-call request packet. It carries the ray origin,
  direction, optional scene-hit distance or equivalent spatial hit context,
  requested output kind, and optional `incidentRadianceSampling` override. It
  does not carry renderer RGB, material lighting, endpoint radiance, display
  color, cache build state, texture payloads, or diagnostics envelopes. It is
  not a model because it does not own durable state, lifecycle, or mutation
  methods beyond the evaluation call boundary. The CPU/reference algorithm
  execution class may validate or canonicalize it into an immutable internal
  snapshot for one selected-ray or fixture run.
- Evaluation scene-intersection context:
  an additive optional field on the evaluation request can carry scene
  intersection facts or a scene-intersection provider for the requested ray.
  This is allowed because it narrows or annotates one evaluation's spatial
  context without changing the accepted Algorithm32 transport equations. The
  execution class should validate and canonicalize this context, then pass it
  to geometry for view-segment/path segmentation. The context must be spatial
  only: hit distance, hit position, surface normal, object/surface id,
  confidence/source metadata, or an equivalent query provider. It must not
  carry endpoint radiance, captured color, material lighting, display
  conversion, cache data, or transport results.
- Endpoint contribution context:
  endpoint renderer color, material facts, captured RGB, surface radiance, and
  final display composition are outside `Reference.evaluate(...)`. GPU runtime
  composition uses renderer-produced scene color plus Algorithm32 path
  radiance/transmittance. Validation or offline tools may compare equivalent
  endpoint composition through Color/display helpers, but those facts must not
  influence `GeometryModel.resolveViewRaySegment(...)`, source path clipping,
  atmosphere sampling, cache lookup, or transport integration.
- Geometry view-segment resolution:
  the geometry interface owns the POC-derived distinction between bounded
  hit/surface rays and unbounded sky rays. Production `Reference.evaluate`
  should not branch on finite renderer segments versus sky-boundary distance.
  Instead it passes the canonical view-segment request to
  `GeometryModel.resolveViewRaySegment(...)`. When scene-hit distance is
  present, geometry uses that hit-limited segment, matching the POC
  `traceSegmentForThreeHit(...)` path where Three supplied
  `hitDistanceMeters`. When no scene hit is present, geometry resolves the
  appropriate top/sky/ground-limited segment, matching the POC
  `traceSkyForThreeRay(...)` path through `distanceToSkyBoundary(...)`.
  Geometry returns the integration segment needed by execution; distance-only
  helpers may exist privately behind the geometry boundary.
  Scene-intersection context is the production-compatible replacement for
  ad hoc renderer hit branching: `Reference.evaluate(...)` may receive it as
  an additive request parameter, but only geometry uses it to resolve spatial
  segmentation. Clipping, termination reasons, entry/exit facts, surface hits,
  and preserved boundary metadata are diagnostics and should be designed
  separately.
- Transport path:
  the resolved path artifact for one algorithm execution. It is created from
  the evaluation request plus shared source, atmosphere, geometry, and
  spectral facts. It carries clipped view/source segments, boundary
  intersections, sample/step traversal state, path weights, phase-angle inputs,
  optical-depth intervals, and transient spectral transmittance/radiance
  accumulation state. It is not a model because it is not durable and does not
  own identity or lifecycle beyond the execution that produced it.
- IncidentRadianceCache:
  an internal generated field created through source-owned cache-family
  methods and setup/cache-build coordination, then exposed to CPU transport as
  operation-ready `IncidentRadianceSampling`.
  It stores spectral radiance arriving at a sample point from incoming
  directions and is named for what it holds, not for the second-order operation
  that consumes it. It is a mixed-domain derived artifact: cache construction
  consumes light placement/radiometry, geometry mapping and path rules,
  atmosphere composition, spectral basis, execution controls, and packing
  policy. A concrete cache owns runtime sampler creation and shader payloads,
  and the cache descriptor/key must expose all build dependencies, including
  the geometry-owned `SourceRelativePosition` mapping and source-relative cache-coordinate
  mapping. The facade or shader setup may help construct configured
  light-source implementations or pass resource artifacts to them, but the
  generic reference executor does not own the cache or receive it as a
  dependency. The cache may
  privately own L2/local incident radiance data, fixture/oracle data used by
  tests, sampled direction state, derived direction descriptors, calculated
  `solidAngleWeights`, spectral alignment state, provenance, or sample caches.
  Those backing facts belong behind the light-source implementation boundary.
- Cache spatial resolution:
  production `z` and `rho` cache dimensions are derived from the selected
  geometry/cache-domain descriptors, not from global fixed defaults. Geometry
  owns the source-relative cache coordinate mapping, domain ranges, binning
  policy, and resolution descriptors used by cache keys and shader texture
  dimensions. Validation fixtures may pin specific `z`/`rho` dimensions for
  reproducible parity checks. Incoming direction counts remain
  execution/source-sampling policy, and spectral groups remain
  spectral-model/packing policy.

Production execution contract notes from reconciliation conclusions:

- Altitude is geometry/world-owned. The current POC derives altitude from the
  configured geometry shape, and production should define a geometry-owned
  atmosphere-coordinate resolver,
  `GeometryModel.resolveAtmosphereCoordinate(...)`, or create
  altitude-bearing path samples before `_sampleMedium(...)` is implemented.
  The first coordinate should be altitude-only vertical stratification:
  geometry maps model-space sample positions to `altitudeMeters`, and
  atmosphere samples medium facts from that resolved coordinate rather than
  inferring altitude from raw model-space position.
- View-path sampling should follow the reconciliation-settled
  endpoint/trapezoid transport rule for the production reference/shader path.
- Source-path transmittance has a deliberate ownership split. The
  production boundary is: geometry owns resolved
  `SourceRelativePosition`, separate boundary context, clipping, local frame,
  and altitude policy; light-source implementations consume that position and
  supply lighting facts, including distance-use treatment and source path
  limits; geometry then resolves the clipped source path for
  transmittance; atmosphere owns medium coefficients; and the reference
  executor coordinates only plain packets between those owners while owning
  the selected transport quadrature.

### Initial Profile Constant Inventory

The canonical baseline is the accepted Algorithm32 atmosphere profile. Every
promoted constant must carry per-value provenance: an external source, a
source-backed derivation, or an accepted Algorithm32 experiment/decision. The
reconciliation conclusions replace older POC lineages as implementation
authority; rows here are ledger/provenance material, not a pointer back to
older implementation sources. Values whose pedigree is not yet recovered
remain pending evidence.

The initial implementation ships with this one Algorithm32 canonical
atmosphere profile. Alternate atmosphere profiles, including Bucholtz Rayleigh,
ozone-bearing, or alternate aerosol profiles, are future named-profile
extensions rather than first-implementation choices.

Algorithm32 canonical atmosphere/transport constants with current source
traces:

- spherical atmosphere radii: `bottomRadiusMeters = 6360000`,
  `topRadiusMeters = 6420000`;
- scale heights: `rayleighScaleHeightMeters = 8000`,
  `mieScaleHeightMeters = 1200`;
- coefficient and phase parameters:
  `rayleighCoefficientScale = 1.24062e-6`,
  `mieAngstromAlpha = 0.8`, `mieAngstromBeta = 0.04`,
  `mieSingleScatteringAlbedo = 0.8`, `miePhaseFunctionG = 0.7`;
- current ozone placeholder: `ozoneAbsorption = 0`;

Source-traced comparison/setup constants:

- observer height: `observerHeightMeters = 2`;
- spectral shape: `15` centered wavelength samples from `360 nm` to `830 nm`
  with `SPECTRAL_DELTA_NM = 31.333333333333332`;
- spectral channel centers:
  `375.666666666667`, `407`, `438.333333333333`,
  `469.666666666667`, `501`, `532.333333333333`,
  `563.666666666667`, `595`, `626.333333333333`,
  `657.666666666667`, `689`, `720.333333333333`,
  `751.666666666667`, `783`, and `814.333333333333`;
- solar irradiance rows by spectral channel:
  `1.068866666667`, `1.729673`, `1.862071666667`,
  `2.022063333333`, `1.908154`, `1.883391`,
  `1.834246666667`, `1.76744`, `1.65952`,
  `1.548102333333`, `1.45078`, `1.340960333333`,
  `1.262433333333`, `1.175208`, and `1.090824`.

Source-traced derived constants are acceptable when the formula and every input
constant are cited. The Figure 1 display scalar `k` is the model example:
Bruneton's clear-sky comparison source computes tone mapping as
`1 - exp(-rgb / c)` with
`c = 5.0 * MaxLuminousEfficacy * watt_per_square_meter_per_sr`; using
`MaxLuminousEfficacy = 683` gives Algorithm32's reciprocal display scalar
`k = 1 / (5 * 683) = 0.00029282576866764276`. This remains a comparison
display constant, not an atmosphere transport coefficient.

Both the `15` and `40` spectral grids are sourceable, but they come from
different Bruneton contexts. The `15` centered wavelength grid traces to
Bruneton's 2017 precomputed luminance/illuminance mode: the demo passes `15`,
and the model derives centered wavelengths between `360 nm` and `830 nm` from
`num_precomputed_wavelengths`. The `40` grid traces to the Bruneton 2016
clear-sky comparison paper, which uses the same 40 wavelengths between
`360 nm` and `830 nm` as the Kider measurement set. That paper also reports,
for RGB rendering, no significant differences between `n_lambda = 40`, `15`,
`11`, or `8`; this is the source to cite for the limited-significance claim
about spectral sample count in Bruneton-family RGB rendering. It supports 15
as a display-facing choice without proving it as a universal spectral-output
basis. The earlier 40-wavelength paper-comparison lane was tested in steps
023 and 024;
the notes record that the visual change was small, spectral sample count was
not the main remaining mismatch, and the 40-wavelength tone-map refit produced
only a modest target-fit improvement. Resolved production policy: Algorithm32
uses the 15-channel centered grid as the Bruneton-family runtime/default
spectral basis, and keeps the 40-wavelength paper setup as a source-backed
validation/reference mode. Future non-Bruneton physical spectral-output
profiles may define their own source-backed basis as an extension, not as a
current production blocker.

Experiment-backed numerical controls:

- support type: accepted local convergence experiment, not external-reference
  constants;
- interpretation:
  this lane runs Algorithm32 at runtime/default and doubled validation sample
  counts to find a practical diminishing-returns point for the fixed
  finite-object transfer matrix. It is not a fit to external reference output;
- justification boundary:
  this is numerical verification / refinement evidence. It is valid because
  the experiment holds the model equations, constants, spectral basis, Sun
  cases, object inputs, and distances fixed while changing the quadrature and
  sampling resolution. It supports the runtime/default counts as an acceptable
  approximation to the higher-sample run for this covered case matrix. It does
  not validate physical sky accuracy, Bruneton output parity, the aerosol
  profile, local-Sun cache design, or measured object color. If the selected
  physics is wrong, both runs can still converge to the wrong physical answer;
- runtime/default packet:
  `viewRayScatteringIntervals = 40`,
  `sampleToSunTransmittanceIntervals = 20`,
  `secondOrderIncomingDirections = 34`,
  `secondOrderIncidentAltitudeBins = 48` for the accepted local finite-object
  evidence domain;
- convergence validation/reference packet:
  `viewRayScatteringIntervals = 80`,
  `sampleToSunTransmittanceIntervals = 40`,
  `secondOrderIncomingDirections = 68`,
  `secondOrderIncidentAltitudeBins = 96` for the accepted local finite-object
  evidence domain;
- production cache-resolution ownership:
  these accepted bin counts are numerical-control evidence for the covered
  local finite-object domain, not universal global cache dimensions. The
  production cache builder derives spatial cache resolution from the
  geometry-owned cache domain and may use the accepted counts as the initial
  local-domain quality preset or as pinned validation-fixture dimensions.
- derived uniform incoming-direction solid-angle weights:
  runtime/default `4 * pi / 34 = 0.36959913571644626 sr`,
  validation/reference `4 * pi / 68 = 0.18479956785822313 sr`;
- evidence trail:
  `005-transfer-refined-baseline` accepted the runtime/default packet, and
  `006-transfer-refined-convergence` accepted the proof/reference packet
  against the refined baseline with `15` passing criteria, `0` failures, and
  minimum convergence margin `6.4074899093834174`.
- baseline data provenance:
  `006-transfer-refined-convergence` compares against the generated local
  artifact
  `tmp/atmosphere/cleanroom_environment/005-transfer-refined-baseline/transfer-cases.json`,
  not an external measured dataset. That artifact is produced from fixed
  Bruneton/CIE/ASTM-backed atmosphere/source/spectral inputs plus local
  synthetic object spectra and target distances; the validation run regenerates
  the same case matrix at higher sample counts and compares spectral arrays
  case-by-case to show that the extra samples have diminishing impact relative
  to the demonstrated effects.
- synthetic case rationale:
  the invented object spectra are transfer-equation stress inputs, not material
  measurements. They isolate path radiance, baseline object radiance, linear
  scaling, wavelength-separated attenuation, and middle-spectrum response. The
  invented distances cover zero-length identity, near-field transfer,
  mid-distance transfer, and long finite-path extinction stress. Expected
  values come from transport identities such as
  `L_final = T_view * L_object + L_path`, zero-path identity, black-object
  identity, linearity, split-segment recomposition, and
  `T = exp(-opticalDepth)`; distance and Sun-position effects are accepted
  only when they exceed the high-sample convergence delta by the configured
  margin.

Accepted POC operational constants:

- flat geometry defaults: `topAltitudeMeters = 100000`,
  `observerPositionMeters = [0, 0, 2]`,
  `sceneSkyRayLimitMeters = 1926774`;
- flat scene sky limit policy:
  `accepted-062-flat-visibility-100-percent-lost-poc-default`;
- local source defaults used by the browser POC:
  `radiusKm = 25.749504`, `referenceDistanceKm = 4800`,
  `referenceSpectralIncidentScale = 1.1071748923354825`,
  `distanceFalloff = true`;
- local source default position:
  `[-1259333.1191633441, -783448.107576714, 4828003.52]`;
- local IncidentRadianceCache kind and packing:
  `local-z-rho-direction-wavelength-grid` and `rgba-3d-texture-v1`;
- local IncidentRadianceCache spectral groups:
  `[0,1,2,3]`, `[4,5,6,7]`, `[8,9,10,11]`, and `[12,13,14,null]`;
- local IncidentRadianceCache browser POC sample grid:
  `zMeters = [2, 1000, 5000, 15000, 45000]`,
  `rhoMeters = [0, 500000, 1250000, 2500000, 5000000, 9000000, 13000000]`,
  and `incomingDirectionCount = 9`. These are accepted POC evidence values
  for the covered local domain, not universal production cache defaults;
- local incoming direction generation uses the golden ratio,
  `z` values from `-0.8` to `0.8`, and the
  `sun-subpoint-local-radial-tangential-up` frame;
- cache lookup policy is `nearest-neighbor-poc-grid`; invalid policy is
  `throw-on-invalid-or-source-key-mismatch`.

Known app/stage constants that must not silently become production physics:

- stale/reverted local source RGB tint `{ r: 1, g: 0.98, b: 0.95 }`;
- raw flat-app `solarIrradianceScale = 58`;
- browser/gallery scene camera, terrain, capture, star-field, and UI constants.

Unresolved constant issues before production promotion:

- reconcile the local cache default `incomingDirectionCount = 9`,
  runtime/default `secondOrderIncomingDirections = 34`, validation/reference
  `68`, and shader uniform `MAX_LOCAL_CACHE_DIRECTION_BINS = 16`;
- implement geometry-driven spatial cache-resolution descriptors, while
  keeping accepted fixed dimensions available as validation fixtures or named
  local-domain quality presets;

POC-derived unit and coefficient facts:

- Distance and position units:
  the POC uses meters for geometry, positions, path distances, altitude, cache
  `z`, and cache `rho`: examples include `bottomRadiusMeters`,
  `topRadiusMeters`, `observerHeightMeters`, `distanceMeters`,
  `topAltitudeMeters`, `zMeters`, and `rhoMeters`.
- Local Sun size and calibration units:
  the POC uses kilometers where explicitly named, including `radiusKm`,
  `referenceDistanceKm`, and derived `distanceKm`. The local finite-source
  sample carries size/calibration facts such as `radiusKm`,
  `apparentAngularRadiusRad`, `referenceDistanceKm`,
  `referenceSpectralIncidentScale`, `distanceFalloffScale`, and
  `incidentScale`.
- Spectral units:
  the POC labels spectral channels in nanometers through
  `wavelengthNanometers`. The transport coefficient formulas convert those
  wavelengths to micrometers with `wavelengthNanometersToMicrometers(...)`
  before evaluating Rayleigh and Mie coefficient formulas.
- Atmosphere sampling convention:
  the POC `densityAtPosition(...)` returns scalar medium facts:
  `altitudeMeters`, `rayleigh`, `mie`, and `absorption`. It does not return
  ready-made spectral coefficient arrays. Transport derives per-channel
  coefficients by combining those scalar density/optical-length values with
  wavelength-dependent formulas such as
  `rayleighScatteringCoefficientAt(...)`, `mieExtinctionCoefficientAt(...)`,
  and `mieScatteringCoefficientAt(...)`.
- Source scale convention:
  the POC keeps source sampling aligned to spectral channels with
  `spectralIncidentScaleByWavelength`. For finite local sources, direct source
  power is scaled by `incidentScale`, where the accepted POC computes
  `incidentScale = referenceSpectralIncidentScale * distanceFalloffScale` and
  `distanceFalloffScale = (referenceDistanceKm / distanceKm) ** 2` when
  distance falloff is enabled. First-order transport then uses
  `channel.solarIrradiance * sourceIncidentScale` per channel. The POC's
  RGB-style `sourceColor` default and rough channel grouping are not
  source-backed and must not be promoted as production physics data. The
  runner trail shows the tint already existed as flat-app configuration
  (`DEFAULT_FLAT_SIMULATION_SUN.atmosphere.color = { r: 1, g: 0.98, b: 0.95 }`)
  before the local-source Algorithm32 shader-lab work. The retired
  reality-aligned daytime-atmosphere plan records the flat-app intent as
  keeping the visible false Sun orange while using a daylight-white
  atmosphere Sun for Earth-like scattering calibration; it also records a
  linked-radiance sweep where `solarIrradianceScale: 58` was selected over
  `60` and `65` to improve daytime blue while avoiding the worst clipping.
  That is flat-app experiment provenance, not an external physical source for
  the exact `{ r: 1, g: 0.98, b: 0.95 }` tint values. The later
  Algorithm32 local-source/shader-lab path pulled that app-facing
  atmosphere-radiance color into `atmosflat32`, adapted it into a
  `flat-local-point-sun` source, and mapped it onto spectral channels with a
  local threshold helper (`<500 nm` blue, `<600 nm` green, otherwise red).
  The `algorithm32_shader_lab` branch preserved that tint/grouping through
  accepted `atmosflat32/018` parity and shader packet propagation, but the
  later local-sun-second-order lane reverted it in accepted artifact
  `095-local-source-neutral-white-stack` by using neutral white source scale.
  Treat the tint/grouping as stale POC residue and guard it out of production.
  Any production spectral variation in source scale must come from a
  source-backed spectral model, not an implicit color bias.

These POC facts settle source evidence but not durable boundary unit packets.
Production durable/API boundaries must use explicit unit-bearing packets for
convertible quantities, then adapt to the POC's hot-path scalar values. The
reference implementation currently operates in meters for spatial transport,
nanometers for spectral basis identity, micrometers for coefficient formulas,
scalar density facts for atmosphere sampling, and explicit local Sun
size/distance scale factors for finite-source calibration. POC values or
algorithms that lack reference support remain rejected evidence until a source
is added.

Required object-shape identifiers should use reconciliation POC names unless a
name is actively misleading in the production contract. The notes below record
field meaning and any allowed rename pressure; they are not invitations to
rename every local identifier.

- Ray distance request labels:
  the POC distinguishes finite renderer hit segments from sky rays, but final
  production should favor the reconciliation view-segment/path terminology.
  Legacy labels such as `RayDistanceRequest`, `suppliedDistance`, `distance`,
  and termination labels may survive only as private helpers or explicit
  mappings when they do not misrepresent the reconciled contract.
- Source sample scale fields:
  physical terms such as irradiance, direction, distance, and angular radius
  are standard. Identifiers such as `incidentScale`,
  `referenceSpectralIncidentScale`, `distanceFalloffScale`,
  `spectralIncidentScaleByWavelength`, and the exact source-to-sample
  direction field should carry forward from the POC unless they are actively
  misleading. The source scale used by execution should be physically or
  reference backed; unsourced POC color bias fields stay out of the core
  contract.
- Atmosphere medium scalar fields:
  the POC returns scalar `rayleigh`, `mie`, and `absorption` values from
  `densityAtPosition(...)`. Carry these names forward if the surrounding type
  makes their density/profile meaning clear. If the public production context
  would make them misleading, rename to explicit identifiers such as
  `rayleighDensity`, `mieDensity`, and `absorptionDensity`, and document the
  mapping.
- Phase sample fields:
  Rayleigh phase, Mie phase, and cosine of the scattering angle are standard
  concepts. Use the POC identifiers for these facts unless a name such as
  `nu` would be misleading in the promoted type. The reconciliation contract
  keeps separate Rayleigh and Mie phase values, not a single combined phase
  value.
- IncidentRadianceCache indexing fields:
  `z` and `rho` are recognizable coordinate names, but their Algorithm32
  meaning must stay explicit: vertical altitude and horizontal distance from
  the local Sun subpoint. Use POC names for direction index, direction-frame
  descriptor, spectral group index, packing version, cache key, source key,
  and cache-miss/stale-key status unless a promoted public context makes a
  name misleading.
- Spectral array shape fields:
  wavelength and radiance/transmittance are standard. Use POC identifiers for
  channel-indexed arrays, spectral groups, padding, alignment fingerprints,
  and descriptor versions unless an explicit unit-bearing boundary or
  misleading name requires a documented adapter.
- Descriptor, provenance, and diagnostic fields:
  fingerprints, versions, provenance ids, cache/build descriptors, and
  compatibility labels are required for validation and runtime binding. POC
  debug-view labels move into deferred diagnostics and should not become
  first-production runtime shader API. Use the POC names unless a field moves
  into deferred diagnostics or becomes misleading in the production contract.

Diagnostics boundary note:

- Diagnostic result fields are intentionally out of the immediate execution
  shape. The reconciliation execution contract only needs a resolved distance. Rich
  fields such as segment start/end distances, atmosphere-entry/exit status,
  ground-hit or sky-exit status, clipping reason, raw intersections,
  `surfaceHit`, `boundaryReason`, `boundaryId`, and preserved boundary metadata
  belong to a holistic diagnostics design rather than `ResolvedRayDistance`.
- Primary execution should not be polluted with per-step diagnostic callouts or
  expensive diagnostic work that is not required to compute spectral output.
  `Reference.evaluate(...)` should return the primary algorithm result, not a
  diagnostic trace envelope.
- A later holistic diagnostics strategy may install diagnostics through a
  registry keyed by method name, for example `Reference.evaluate`, and a
  class/method wrapper that calls registered before/after/error callbacks. This
  can provide decorator-like behavior without relying on JavaScript decorator
  syntax, which is not yet a fully finalized ECMAScript feature.
- Tracing can use the same deferred instrumentation mechanism. A trace
  consumer can be registered for the same method key and receive the same
  boundary events, or a richer trace-specific event stream if that is later
  justified. The distinction should be in the registered consumer and event
  shape, not in diagnostic/tracing callouts scattered through the algorithm.
- The diagnostics wrapper/registry approach is deferred until the diagnostic
  event model is designed. Do not add scattered per-helper callbacks,
  `{ result, diagnostics }` envelopes, or unconditional trace construction to
  the primary algorithm code while the execution path is still being defined.
- If a detailed execution trace is needed later, prefer a separate method such
  as `traceEvaluation(...)` or `diagnoseEvaluation(...)` that deliberately
  computes trace-shaped data and can reuse lower-level pure helpers without
  changing the hot `evaluate(...)` path.

Compact `Reference.evaluate` algorithm:

```text
Reference.evaluate(request)

1. Get current model facts.
   Read geometry, atmosphere, light-source, and spectral setup from the shared
   model.

2. Ask geometry to resolve the requested view ray segment.
   Geometry owns `resolveViewRaySegment(...)` and returns the integration
   segment through the atmosphere. If the request includes
   scene-intersection context, the reference executor forwards that additive
   spatial context to geometry; geometry decides whether scene geometry
   terminates or clips the view ray.

3. Prepare spectral result containers.
   Create empty spectral arrays for total path radiance, first-order radiance,
   higher-order radiance, and transmittance.

4. Resolve incident radiance sampling support.
   Setup may provide operation-ready `IncidentRadianceSampling` aligned with
   the current light source, atmosphere, geometry, spectral basis, and
   execution settings. `Reference` uses its configured default unless the
   evaluation request contains an `incidentRadianceSampling` property; an
   explicit request value wins, and explicit `null` disables incident sampling
   for that evaluation. Evaluation does not quietly rebuild the cache as a
   per-request side effect.

5. Walk the resolved path.
   For each atmospheric segment, divide the segment into integration samples
   and visit each sample point in order.

6. At each sample point, ask owners for facts.
   Atmosphere supplies medium and phase facts. The light source supplies direct
   illumination facts and source path limits. Geometry resolves
   source-to-sample paths and cache access when needed and supplies explicit
   frame/position/path facts needed by finite-source direction, distance,
   apparent-size, falloff, and incident-scale evaluation.

7. Accumulate direct scattering.
   Use light-source radiance, atmosphere coefficients, phase, source
   transmittance, and view transmittance to add first-order spectral radiance.

8. Accumulate incident/higher-order scattering.
   Use `incidentRadianceSampling.incidentRadianceSampler(cacheAccess)` when
   operation-ready sampling is present, plus atmosphere coefficients, phase,
   and view transmittance, to add higher-order spectral radiance.

9. Track transmittance.
   Accumulate optical depth along the view path and update view
   transmittance.

10. Assemble the result.
   Combine first-order and higher-order spectral radiance. Return spectral
   radiance and spectral transmittance.
```

Short form:

```text
Resolve the path.
Walk the path.
At each point, gather geometry/atmosphere/light-source incident-radiance facts.
Accumulate spectral transmittance and radiance.
Return spectral output.
```

One-evaluation algorithm sequence:

This sequence shows algorithm execution talking directly to the configured
component models. The facade may still hold those component models in an
aggregate internally, but the aggregate is not shown as a separate runtime
actor because it does not answer the domain questions itself. Validation is
also omitted from this diagram so the sequence can focus on one already
accepted evaluation request.

```mermaid
sequenceDiagram
  autonumber

  participant Caller
  participant Source as Light Source Model
  participant Atmosphere as Atmosphere Model
  participant Geometry as Geometry Model
  participant Facade as Algorithm32 Facade
  participant Executor as Algorithm Execution

  participant Spectral as Spectral Model
  participant Result as Result Assembler

  Note over Caller,Geometry: Consumer provided actors and configuration models

  Caller->>Facade: evaluate(EvaluationRequest)
  Facade->>Executor: execute(canonicalRequest, Source, Atmosphere, Geometry, Spectral)

  Executor->>Geometry: resolveViewRaySegment(ray facts)
  Geometry-->>Executor: resolved view ray segment

  Executor->>Spectral: resolve spectral basis
  Spectral-->>Executor: wavelength grid + channel shape

  Executor->>Source: resolve source sample(s) for path
  Source-->>Executor: direct source direction/radiance/path facts

  Executor->>Atmosphere: sample medium along path
  Atmosphere-->>Executor: density, extinction, scattering, phase inputs

  Executor->>Executor: build TransportPath artifact
  Note over Executor: TransportPath is a per-run artifact,<br/>not a durable model.

  loop each integration step / segment
    Executor->>Atmosphere: sample coefficients at step
    Atmosphere-->>Executor: spectral scattering/extinction

    alt direct / first-order contribution
      Executor->>Source: sample direct source radiance
      Source-->>Executor: incoming direct spectral radiance
    else higher-order contribution
      Executor->>Geometry: resolveCacheAccess(path sample facts)
      Geometry-->>Executor: CacheAccess
      Executor->>Sampler: incidentRadianceSampler(cacheAccess)
      Sampler-->>Executor: directional incident radiance samples
      Note over Sampler: Sampler comes from setup-bound IncidentRadianceSampling;<br/>request value overrides Reference default.
    end

    Executor->>Executor: accumulate optical depth, transmittance, path radiance
  end

  Executor->>Result: assemble spectral EvaluationResult
  Result-->>Executor: spectral radiance/transmittance

  Executor-->>Facade: EvaluationResult
  Facade-->>Caller: EvaluationResult
```

Runtime shader builder specific abstractions:

These abstractions are distinct from the shared aggregate model. They are
private to the shader-building/runtime attachment domain because they describe
how a configured Algorithm32 model becomes an installable Three/composer
shader pass, not the physics facts shared by CPU/reference execution. A model
owns coherent data and methods that mutate that data. An assembler consumes
existing facts and produces shader-shaped artifacts. A binder applies those
artifacts to live runtime objects.

Specific abstraction interfaces own only their shader contributions and
semantic payload descriptors: the GLSL snippets, required symbols, uniforms,
textures, binding requirements, and cache/source/geometry/atmosphere/display
facts that belong to that abstraction. Everything else in shader assembly
goes with `ShaderBuilder`: generic source assembly, contribution ordering,
compatibility checks, `TextureBuilder`, texture/resource preparation, runtime
binding, pass/material installation, frame/update lifecycle, and cleanup.

Shader construction assemblers:

- Shader source composer:
  assembles final shader source from packaged Algorithm32 shader modules,
  shared-model descriptors, `ShaderRuntimeConfig`, runtime capability facts,
  local-cache/cache-layout descriptors, selected first-production feature path,
  and the caller-provided display conversion shader descriptor. Its inputs are code modules,
  descriptor facts, selected feature path, display-conversion function
  contract, and required binding declarations. Its output is the shader source
  package: GLSL source, defines, declarations, required binding slots, and
  source diagnostics. It is an assembler, not a model.
- Local incident cache assembler:
  prepares the shader-facing local second-order cache artifacts from validated
  shared-model facts, execution/cache policy, incoming-direction descriptors,
  cache keys, stale/mismatch descriptors, and cache samples. The CPU/reference
  algorithm may generate cache sample values through a request, but the
  cache supplies the cache descriptor/resource facts consumed by the shader
  source composer and shader binder. Its output is a cache artifact package:
  cache descriptor, source/cache key, direction/bin layout, packed sample
  reference or payload, staleness status, and binding requirements. It is not
  a shared model.
- Texture/cache packing assembler:
  assembles concrete GPU-facing layouts and payloads: 3D texture dimensions,
  texel coordinate mapping, packed payload construction, possible 2D-atlas
  fallback descriptors, and upload metadata. It consumes shared-model facts,
  cache descriptors, runtime capability facts, and cache/sample data. Its
  output is a packing artifact package: texture dimensions, format/type,
  sampler policy, coordinate decode constants, upload payload, and fallback
  metadata. It is runtime shader builder state, not shared configuration and
  not a model.

Runtime state and binding:

- Runtime capability model:
  owns detected WebGL/Three capability facts, selected feature support,
  software-renderer diagnostics, and pass/fail policy inputs reported to
  validation. It is specific to runtime shader builder setup. This can remain
  a model because it owns mutable capability state and exposes mutation
  methods such as probing, refreshing, or replacing the active capability
  snapshot. It is consumed by the shader source composer, texture/cache
  packing assembler, IncidentRadianceCache assembler, validation/error class,
  and diagnostics surface.
- Shader binder:
  the active object that applies and updates runtime shader bindings on Three
  shader/runtime objects. It owns the operation of binding uniforms, samplers,
  defines, textures, render targets, display conversion resources,
  IncidentRadianceCache resources, and frame/config update values
  to `ShaderMaterial`, pass state, and owned runtime resources. Its output is
  live applied runtime state: current values assigned to shader slots, plus
  binding diagnostics or update status such as current, stale, failed,
  uniform-only update, texture rebind, or material rebuild required. It may
  own an internal shader binding map that records binding facts such as names,
  slots, resource ids, descriptor versions, update categories, and
  compatibility labels. The shader binding map is internal data, not a peer
  model and not an executable plan.
- Runtime attachment model:
  owns the live Three/composer attachment facts: composer, scene, camera,
  renderer-compatible context, pass insertion point, render targets, resize
  state, and disposal scope. It qualifies as a model because these are related
  runtime facts with model-owned mutation methods such as replacing the scene
  or camera, updating size/pixel ratio, refreshing scene color/depth targets,
  and marking owned resources for disposal. Its output is not shader data; it
  is the attachment-state snapshot that lets the runtime shader builder
  install the pass, lets the shader binder locate live inputs such as scene
  color/depth and camera state, and lets the returned handle resize or dispose
  resources. It is not direct shader-source input except through capability
  facts.

External shader construction inputs:

- Color shader descriptor:
  the caller-provided Color-owned shader-construction input
  supplied to `setupShader` or the shader handle through the production
  `Color` abstraction. It may include a conversion function name/signature,
  GLSL snippet or known Bruneton-backed mode id, required
  uniforms/constants/textures, spectral input shape, output color space/type,
  and compatibility metadata. It is an input descriptor owned by Color, not a
  model, not shared configuration, and not Algorithm32 algorithm output.

### Spectral Component Model

The spectral component model is the aggregate model property that defines the
canonical spectral basis for one configured Algorithm32 facade. It exists
because Algorithm32's algorithm output is spectral radiance/transmittance, not
display color. It should make spectral channel shape and wavelength alignment
unambiguous for CPU/reference algorithm execution, incident-cache generation,
shader/resource preparation, fixtures, and validation.

The likely aggregate-model property is:

```js
model.spectral
```

Inputs to the spectral component model:

- `wavelengths` as ordered unit-bearing `Wavelength` packets from the validated
  atmosphere composition or spectral-basis configuration;
- optional spectral-basis metadata such as basis id, source
  registry ids, table version, interpolation policy, and provenance;
- validated wavelength-aligned shape requirements from source spectra,
  atmosphere coefficients, the internal incoming-radiance cache/provider,
  caches, and Algorithm32 spectral outputs.

Canonical properties on the spectral component model:

- `wavelengths`: the ordered active wavelength samples with explicit units;
- `channelCount`: the number of active spectral channels;
- `channelIndices`: stable zero-based indices for active channels;
- `fingerprint`: the stable compatibility fingerprint for the active spectral
  basis;
- `version`: the facade-local spectral model version;
- `descriptor`: a serializable spectral descriptor for validation, cache keys,
  and shader/resource preparation.

Methods on the spectral component model should stay focused on owned spectral
basis data and mutation/query behavior:

- `getWavelength(channelIndex)`: returns the wavelength for one active
  spectral channel;
- `replaceBasis(basis)`: replaces the owned spectral basis and updates
  descriptor identity/version;
- `isAligned(values)`: checks whether a spectral numeric vector length matches
  the current `channelCount`;
- `isBasisAligned(basis, options?)`: checks whether another spectral basis
  matches the current channel count and wavelength grid using explicit
  call-local tolerance options;
- `describe()`: returns the serializable spectral descriptor.

Working arrays such as zero radiance vectors or unit transmittance vectors
should be created by generic vector utilities, for example
`VectorMath.zero(model.spectral.channelCount)` or
`VectorMath.ones(model.spectral.channelCount)`, rather than by
`SpectralModel`.

The spectral component model should not own display conversion. RGB, XYZ,
color spaces, exposure, tone mapping, and false-color/debug display mapping
belong to the `Color` abstraction outside the Algorithm32 transport boundary;
false-color/debug display modes remain deferred until diagnostics accepts
them.
The spectral component model may provide the wavelength alignment descriptor
that Color consumes, but it does not turn Algorithm32 spectral output into
color.

The shared model should explicitly not own:

- validation/error taxonomy, config acceptance, descriptor compatibility
  decisions, or runtime capability pass/fail policy;
- generic scalar/vector/unit/sample helpers owned by the pure math API namespace;
- spectral-to-output display conversion, exposure, tone mapping, deferred
  debug colors, or app-owned star/celestial scene content;
- the public facade lifecycle, public API method naming, or app-facing
  `Algorithm32` object;
- raw Three objects, renderer calls, render targets, depth textures,
  `ShaderMaterial`, fullscreen quads, composer pass insertion, animation
  loops, resize listeners, or GPU disposal;
- local Sun configuration, clock synchronization, solar-zenith calibration,
  calibration replay, or app-owned location/date/time-zone state;
- specific public Sun implementation classes such as future distant-Sun or
  local-Sun classes, except through the public `Sun` interface and approved
  resolver/factory inputs;
- app UI state, runner/watch state, terrain asset selection, camera
  choreography, or experiment-gallery controls.

## Local Sun Calibration UX

The local Sun should use calibration as the normal setup path instead of asking
users for a raw brightness, luminosity, irradiance, or reference-distance
value. External physical units would be technically honest but poor UX for the
flat/local model, because most users do not have an intuitive feel for them and
the local model has no natural external clock reference.

Default UX:

```text
Use current view location
Use current date
Synchronize on solar zenith
Recalibrate
```

Basic user-authored local Sun settings should stay small:

- Sun altitude;
- Sun diameter;
- northern latitude limit;
- southern latitude limit.

Location/date should usually come from the current simulation context, with
overrides available when needed. Orbit direction and period are standardized
model behavior, not user-entered fields: clockwise, one orbit per solar day.

The basic flow is:

1. Use the current view location and current date by default. Allow explicit
   location/date overrides.
2. Compute standard-model solar zenith for that normalized location/date/time
   context. In ordinary UI language this is solar noon, the time when the
   standard Sun is highest.
3. Resolve the local-model closest approach for the same normalized context.
4. Synchronize clocks by aligning local closest approach with standard solar
   zenith.
5. Calibrate the local Sun's internal source power so closest approach matches
   the standard Sun's reference illumination at solar zenith.
6. Store the derived clock offset and derived source power as calibration
   results. Users can recalibrate at any time when normalized location, date,
   time-zone, or view context changes.

The user-facing story should be:

```text
Calibrate the local Sun by synchronizing closest approach with solar zenith.
```

After calibration, the UI should report the anchor rather than expose the raw
derived scalar:

```text
Calibrated to solar zenith
San Jose, CA
June 21, 2026
Standard solar noon: 1:09 PM
Local closest approach: synced
```

The app may also show derived display values after the location, clock, and
latitude model resolve. One useful value is the local Sun's instantaneous
orbital speed. This value should be evaluated from the current simulation time,
not treated as a daily constant, because the annual latitude migration changes
the orbit radius continuously.

```text
orbitRadiusNmi(t) = (90 - resolvedLatitudeDeg(t)) * 60
tangentialOrbitSpeed(t) = 2 * pi * orbitRadius(t) / 24 hours
```

If the UI chooses to display total spiral-path speed instead of tangential
orbit speed, include the slow radial term from latitude migration:

```text
totalPathSpeed(t) = sqrt(tangentialOrbitSpeed(t)^2 + radialSpeed(t)^2)
```

For the accepted San Jose summer-solstice calibration instant on
`2026-06-21`, the resolved latitude is approximately `23.5 deg N`, so the
tangential display value is approximately:

```text
Current orbital speed: 1,045 knots / 1,202 mph / 1,935 km/h
```

This is a derived explanatory value, not a configuration input.

The production API should expose calibration methods, not just source factory
methods. Proposed method responsibilities:

- accept normalized app-provided location/date/time-zone context without
  owning app UI state;
- compute the standard solar-zenith time for that normalized context;
- resolve the local Sun closest-approach phase for that normalized context;
- derive the clock offset that aligns closest approach to solar zenith;
- derive the local source-power scalar needed to match the standard solar
  zenith illumination;
- return a serializable calibration packet containing user inputs, derived
  values, assumptions, and versioned formulas;
- rebuild a resolved local Sun value that conforms to the public Sun interface
  at any requested view time.

Calibration packets and local Sun configuration are not main-algorithm inputs.
The main algorithm consumes only Sun, atmosphere composition, and geometry
interfaces, so local Sun details must be normalized into the public Sun
interface before transport, texture building, cache sampling, or shader
runtime execution.

The public Sun, atmosphere composition, and geometry interfaces, plus their
public input/resolver types, are the only external surfaces for their domains.
Any local orbit, calibration, composition preset, coefficient derivation,
geometry factory, scene-adapter, provenance, or source-factory detail not
present on the relevant public interface stays private to its owner domain.

Normal configuration should not include a brightness slider after calibration,
because it would undermine the promise that the local Sun is matched to the
standard Sun at solar zenith. If an artistic override is needed later, expose it
as render exposure or display tone mapping, not as source brightness.

## Non-Goals

- Do not add production code during this design stage.
- Do not preserve legacy aliases unless a migration bridge is explicitly
  requested.
- Do not make production consumers import from `shared/algorithm32/POC/`.
- Do not make generated artifacts, live runner state, selected UI state, or
  cache sidecars canonical sources of production facts.
- Do not make production design docs carry numbered artifact history. Keep
  that in experiment evidence, status/task trackers, or explicit evidence
  folders.
- Do not expose local Sun brightness as a primary basic-user setting once
  solar-zenith calibration exists; brightness/source power is derived
  calibration state.
- Do not fold terrain asset conversion, star-field display tuning, local solar
  disc rendering, ground bounce, or spotlight/cone source behavior into the
  first production Algorithm32 contract.

## Design Decisions

- A concrete light-source implementation owns the accepted
  incident-cache family and source semantics. The concrete cache owns generated
  values, coordinate domains, sampler creation, shader payload, and packing.
  The current local-source cache key includes the public light-source
  identity/configuration, atmosphere composition, geometry interface values,
  execution configuration, geometry-resolved `z`/`rho` cache-domain
  descriptors, incoming direction set, wavelength grid, and packing version.
- Local incoming directions use the Sun-subpoint local radial/tangential/up
  frame, not raw world coordinates.
- Setup-time and CPU/reference cache lookup must fail loudly on light-source
  mismatch, invalid position, stale key, or missing sample. Live shader
  runtime failures after successful setup follow the runtime policy: log and
  continue with last valid state, no-op, or fallback behavior where possible.
- Second-order incoming radiance is requested through operation-ready
  `IncidentRadianceSampling`, produced by setup/cache building. The light
  source owns cache-family creation and source semantics, the cache owns the
  sampler and shader payload, and `Reference` consumes the configured sampler
  by default. A per-evaluation request `incidentRadianceSampling` property may
  override that default, including explicit `null` for a no-cache evaluation.
  Tests and validation tools may fixture or inspect cache internals, but the
  generic production API does not branch around a light-source per-sample
  incident-radiance method.
- GPU packing may begin with the accepted `rgba-3d-texture-v1` layout:
  `rho` on X, `z` on Y, and
  `incomingDirectionIndex * spectralGroupCount + spectralGroupIndex` on Z.
  First production integration assumes WebGL2/Three `Data3DTexture` is
  available. A 2D atlas fallback may be added later as a compatibility
  extension if target devices require it, but it should not block or broaden
  the initial cache contract.
- Spherical distant and flat local Sun models share the same Algorithm32
  transport shape. Differences belong in Sun, atmosphere-composition, and
  geometry contracts plus Sun sampling, not in duplicated render pipelines.
- Per-path evaluation and texture/cache building should remain separate
  implementation responsibilities over the facade-owned shared model rather
  than a shared operations class. Per-path evaluation may remain public for
  CPU/reference consumers. Texture/cache building should stay
  implementation-owned behind awaited shader setup and awaited shader-handle
  config updates unless a concrete tooling consumer justifies a later narrow
  API.
- Do not make callers mix `EvaluationRequest` responsibilities with texture
  build-domain, packing, descriptor, upload, or cache responsibilities in one
  request shape or lifecycle.
- Internal texture builders may generate evaluation contexts or use equivalent
  lower-level transport primitives for performance, but their internal
  requests must not extend or masquerade as `EvaluationRequest`.
- The production API can assume a simple object facade over a facade-owned
  shared model and two internal implementation classes. The facade is
  constructed with already-configured light-source, atmosphere, geometry, and
  optional Color abstraction instances plus spectral/execution/shader policy.
  One facade instance maps to one independent simulation window or render
  context, and facade instance state owns configuration, validators, the shared
  model, shader bindings, setup cache handles, and disposal scope. The facade
  does not resolve broad application profile descriptions into those objects;
  that can be a later app/helper factory outside the core facade. The
  CPU/reference algorithm execution
  class owns CPU/reference evaluation and reference/oracle diagnostics. Cache
  building is internal setup/resource preparation that can consume shared
  calculator utilities without becoming `Reference` ownership. The runtime
  shader builder owns runtime shader construction, mechanical shader assembly,
  texture/resource preparation, Three/WebGL setup artifacts, shader binder and
  internal binding-map shape, composer pass information, frame-pass resource
  shape, resize behavior, and GPU disposal. No separate public
  texture-artifact import/export API ships in the first production API;
  serializable descriptors and packed payloads remain internal/test support
  unless a later concrete non-app tooling consumer requires a narrow public
  artifact surface.
  The shared
  model owns Algorithm32-specific canonical facts and descriptors without
  becoming a global mutable singleton; generic scalar/vector/unit/sample helpers
  belong to the pure math API namespace, while concrete GPU packing belongs to
  runtime resource prep.
- Runtime shader behavior belongs to `Algorithm32Config.shader` as runtime
  configuration, not to the one-time Three setup request. It should include
  choices such as shader mode, cache/resource policy, capability failure
  policy, and render-target/HDR/depth policy. Stable debug views are deferred
  with diagnostics and are not first-production runtime shader API.
  `setupShader` receives attachment handles such as composer, scene, and
  camera; those handles locate where the configured runtime shader is
  installed. Scene binding is
  setup-time attachment state in the first production API, not durable
  Algorithm32 configuration and not normal mutable shader-handle state.
- The current public facade draft keeps the main class intentionally small:
  `constructor`, `config` getter, `setConfig`, `setupShader`, `evaluate`,
  deferred `getDiagnostics`, and `dispose`. The normal
  shader path is `await setupShader(...)`, which installs/prepares the runtime
  Three composer integration and returns a handle for config updates,
  future diagnostics, resize/frame resource updates, and disposal.
  Moving an installed Algorithm32 pass to a different scene/composer/camera
  should use explicit teardown/re-setup unless a later framework integration
  need justifies a narrow rebind operation.
- The normal production render path is not packet replay. It is:
  `Three scene + camera -> scene color render target + DepthTexture ->
  Algorithm32 fullscreen RawShaderMaterial -> output target or screen`.
  Raycaster/JSON scene inputs remain validation/oracle artifacts and should
  not be required by normal app rendering. CPU/reference validation may use
  selected-ray or fixture spatial hit facts equivalent to renderer hit/depth
  state. Those facts are validated as spatial input and passed to geometry;
  endpoint radiance, material color, captured RGB, and final display
  composition remain outside Algorithm32 transport and outside
  `Reference.evaluate(...)`.
- The normal consumer path should likely be the runtime shader facade if
  Algorithm32 ships the production renderer adapter. Awaited setup,
  composer-pass installation, awaited config updates, resize/frame resource
  updates, diagnostics, and disposal are consumer-facing handle
  lifecycle operations. Scene/composer/camera rebinding is not a normal handle
  operation in the first production API. Texture/cache preparation must be explicit as awaited
  setup/update work outside the render frame, but not exposed as a primary
  app-consumer method.
- A candidate runtime shader attachment entry point is
  `await algorithm32.setupShader({ THREE, composer, scene, camera })`.
  `THREE` means the caller-provided Three module/namespace when Algorithm32
  should avoid owning a separate Three instance; if the package imports
  `three` as a peer dependency, the public call can omit that argument. The
  composer is required. Algorithm32 should install its pass into the existing
  composer so the app continues to call `composer.render()`.
  This is a method on the configured facade, not the core Algorithm32
  configuration surface. It should return a handle that owns
  `ShaderMaterial`, fullscreen-pass/render-target setup, uniform and texture
  binding, composer pass lifecycle, and dispose lifecycle. Awaited
  `setupShader` and awaited handle config updates own normal resource
  preparation, so app callers do not need a separate `prepareResources`
  checklist. Public light-source, atmosphere, geometry, Color, execution,
  texture, and display-conversion descriptors may update the handle as
  uniforms/textures through config replacement. The API goal is to reduce
  caller decisions and operations: the
  caller should not need to choose
  material flags, fullscreen geometry, render-target/depth setup, texture
  upload policy, uniform mapping, pass ordering, composer-pass wiring, resize
  propagation, or disposal details. It should also reduce the domain knowledge
  required of the caller: shader packing, spectral grouping,
  IncidentRadianceCache layout,
  source-path distinctions, deferred debug-mode exclusions, and other
  Algorithm32-specific binding details belong inside the runtime shader
  builder, returned handle, and public packet contracts. Long-running
  texture/cache generation must be explicit as
  awaited setup or awaited config/resource update work, and must not be
  discovered by the first frame render.
- The returned shader handle should converge on a compact lifecycle:
  awaited setup, awaited handle `setConfig`, resize/frame resource updates,
  diagnostics, and `dispose`. Advanced/internal operations
  may still include resource preparation, prebuilt artifact binding,
  composer-pass construction, source-light synchronization, and low-level
  frame-pass rendering, but those should not be normal caller obligations.
  Scene/composer/camera rebinding can be added later only as a narrow framework
  integration feature. Exact names are not frozen. The app should install or call this
  through its existing composer, not create a second frame loop for
  Algorithm32 and not use a raw-renderer-only production integration.
- Source and geometry adapters are part of the runtime shader product. The
  same public Sun input should drive compatible Three scene lighting and
  atmosphere uniforms, while the public geometry input drives camera/world
  transforms, depth interpretation, top-altitude, and no-hit sky ray policy.
  The caller may opt into app-owned lights later, but should not have to know
  Algorithm32-specific source-to-light mapping to get a correct default.
- Runtime setup must fail loudly on unsupported renderer capability or active
  resource state, including software-renderer fallback, depth/3D texture
  support, IncidentRadianceCache descriptor compatibility, deferred debug-view
  requests, and unsupported source/geometry/scattering combinations. Stable
  runtime preflight diagnostics are deferred.
- Runtime frame failures after successful setup should be logged and should
  not crash the app render loop when a last valid state, no-op, or fallback
  path is available.
- Requested local second-order mode must validate IncidentRadianceCache
  texture/descriptor before rendering. Missing, stale, mismatched, or
  device-unsupported cache resources are setup/binding errors, not silent
  first-order fallbacks.
- The Three/runtime attachment call surface is distinct from Algorithm32
  configuration. The runtime shader builder should provide the information
  needed to install and run the
  shader: `new THREE.WebGLRenderTarget(width, height, options)`, assignment of
  `renderTarget.depthTexture = new THREE.DepthTexture(width, height, type)`,
  `new THREE.ShaderMaterial({ glslVersion, uniforms, vertexShader,
  fragmentShader, ...flags })`, `new THREE.Scene()`,
  `new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)`,
  `new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)`,
  `passScene.add(fullscreenQuad)`, `renderer.getRenderTarget()`,
  `renderer.setRenderTarget(targetOrNull)`, `renderer.clear(true, true, true)`,
  `renderer.render(scene, camera)`, `renderTarget.setSize(width, height)`,
  uniform `.copy()`, `.set()`, or `.fromArray()` updates, and `dispose()` on
  owned geometries, materials, textures, and render targets. If the adapter
  uploads prepared 3D cache artifacts, it should wrap
  `new THREE.Data3DTexture(data, width, height, depth)` plus format/type/
  filtering/wrap/`needsUpdate` setup.
- `evaluate` remains the consumer-facing CPU/reference/offline per-path
  transport method. Texture/cache build operations are internal resource
  preparation behind awaited shader setup and awaited shader-handle config
  updates. Local Sun calibration/resolution and calibration replay/invalidation
  belong to the upstream local Sun configuration layer; the main facade
  receives the configured public `Sun`.
- Other operation families are support tiers, not guaranteed main-facade
  calls. Packet construction/preflight is useful when consumers build public
  packets outside the facade, but the primary facade should validate
  internally instead of exposing a normal app-facing `validate()` method.
  Texture descriptor/cache-key validation is implementation-owned unless a
  later tooling API has a concrete external consumer. Spectral display
  conversion is public for CPU/reference/offline consumers or renderer
  adapters that need conversion outside the production shader path.
  Validation/parity helpers, selected-pixel readbacks, image deltas, and
  postprocess-versus-integrated galleries are dev/test support APIs, not
  normal production runtime calls. The POC postprocess validation harness is
  not promoted.
- Archived POC export notes are not production implementation references. The
  reconciliation conclusions now own the operation split and production should
  promote that accepted contract directly, keeping lower-level helpers private
  or dev/test scoped unless a specific consumer need appears.
- The local-second-order script lane and `shared/algorithm32/POC/` are archived
  pre-reconciliation implementation history. Production promotion should not
  start from those files or mine them for app-wrapper concerns; use the
  reconciliation conclusions, reconciliation topic/code/records, and current
  production docs as the implementation reference.
- The shared model should expose only canonical shared configuration facts and
  descriptors: source descriptors, atmosphere descriptors, geometry
  path/cache descriptors, and spectral layouts. Physics execution remains
  owned by the CPU/reference algorithm class. Concrete incident-radiance caches
  own their generated values, samplers, cache descriptors, and shader payload
  descriptors, while the shader binder, texture/cache resource preparation,
  runtime capabilities, and GPU resources belong to the runtime shader builder
  and the handle/pass it creates. Validation, canonicalization, fingerprints,
  deterministic errors, generic pure math, and concrete GPU packing belong to
  their separate owners.
- Per-path evaluation uniquely owns `EvaluationRequest`, selected-ray/segment
  path resolution, optional spatial scene-intersection context handoff to
  geometry, and per-path spectral transport output.
  Internal texture/cache building uniquely owns build request state, texture
  kind, sampled build domains, grid traversal, chunking/progress, packing,
  descriptors, cache keys, stale-key checks, and packed payload output.
- Local Sun configuration and calibration affect the main Algorithm32
  algorithm only through the resolved public Sun interface. No transport,
  texture-builder, cache, runtime-shader, display, or validation API should
  require local configuration fields, orbit parameters, calibration internals,
  private provenance, or source-factory details unless they are defined by the
  public Sun interface or its public input/resolver types.
- The same encapsulation rule applies to atmosphere composition and geometry.
  No transport, texture-builder, cache, runtime-shader, display, or validation
  API should require composition preset internals, coefficient derivation
  internals, geometry factory details, scene-adapter state, private
  provenance, or other non-interface fields unless they are defined by the
  corresponding public interface or public input/resolver types.
- Local Sun clock sync should default to solar-zenith calibration: standard
  solar noon for the location/date is aligned with the local model's closest
  approach. The resulting clock offset and source power are derived state.
- Physical point and extended source behavior is accepted in reconciliation,
  but no corresponding production primitives or assembled renderer currently
  exist. The selected cache contract and its exclusions are owned by
  [CelestialContributionCache Design](celestial-contribution-cache-design.md).
- The accepted composition invariant remains that zero path radiance plus
  identity transmittance preserves the incoming endpoint. This Color/display
  invariant is independent of whether a later celestial renderer is selected.

## Open Design Questions

- What exact normalized location/date/time-zone context packet should
  Algorithm32 calibration helpers accept from app-owned services?

Deferred with diagnostics:

- What is the public error taxonomy for invalid Sun, atmosphere composition,
  geometry, cache, and display-conversion packets?
- Which runtime capability diagnostics should eventually become stable public
  API versus dev-only diagnostics?
