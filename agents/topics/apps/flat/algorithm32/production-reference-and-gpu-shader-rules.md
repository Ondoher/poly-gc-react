# Production Reference And GPU Shader Rules And Guidance

Status: canonical topic guidance for production Algorithm32 CPU-reference and
GPU-shader coding, testing, and provenance.

This document owns the cross-cutting working rules for `Reference`,
`SpectralCalculator`, `ShaderBuilder`, shader assembly and resources,
`SceneInputCapture`, `ShaderRuntimePass`, and their Color/display boundary. It
also states how the selected `CelestialContributionCache` may extend those
surfaces without replacing them.

Current implementation truth remains `shared/algorithm32/production/`.
[Algorithm32 Status](status.md) owns current completion and verification state.
[Production Design](production-design.md) owns surrounding architecture.
[CelestialContributionCache Design](celestial-contribution-cache-design.md)
owns cache-specific physics and behavior. Requirements and plans may state the
outcome they require, but they should link here instead of restating these
cross-cutting implementation, testing, and citation rules.

## Governing Split

The CPU and GPU paths share canonical facts and transport semantics. They do
not share orchestration or become alternate owners of configuration.

| Surface | Governing role |
| --- | --- |
| `Algorithm32` | Own the configured facade lifecycle, facade-local versioned shared model, per-ray evaluation entry point, awaited shader setup, handle lifecycle, and disposal. |
| Configured source, atmosphere, geometry, spectral, and Color owners | Own their canonical facts, validation, narrow operations, descriptors, and shader semantics. |
| `Reference` | Orchestrate deterministic CPU/reference evaluation for one selected ray. It is an oracle and tooling surface, not the product frame renderer. |
| `SpectralCalculator` | Own reusable spectral transport calculations shared by `Reference` and internal builders. It is not `Reference`-private state or a primary facade API. |
| `ShaderBuilder` | Own mechanical shader assembly, compatibility validation, resource preparation, binding, pass installation, update coordination, and cleanup. It does not author domain physics. |
| `SceneInputCapture` | Capture renderer-produced scene color, distance/depth, and hit state needed by the fullscreen pass. It does not create celestial radiometry. |
| `ShaderRuntimePass` | Execute the installed fullscreen GPU product with live scene and camera inputs. |
| Color/display owner | Convert completed spectral radiance into display output and compose captured scene color. It does not own transport or celestial-source facts. |

## Shared Coding Rules

- Extend the existing facade, shared model, configured owners, transport,
  incident-radiance caches, runtime pass, and Color boundary. Do not introduce a
  parallel CPU renderer or shader architecture for a new feature.
- Keep one canonical owner for every fact. Derived descriptors, payloads,
  uniforms, fixtures, and caches retain fingerprints or provenance; they do not
  become mutable shadow configuration.
- Both CPU and GPU work consume the same facade-owned immutable or explicitly
  versioned model facts captured at operation boundaries. Long-running builds
  must not commit artifacts for a superseded model version.
- Public and durable boundaries use explicit unit-bearing packets for
  convertible quantities. Unit strings use plural spellings such as `meters`,
  `kilometers`, `radians`, `degrees`, `nanometers`, and `micrometers`. Private
  validated hot paths may canonicalize once to plain scalars.
- Production runtime code must not import reconciliation POC modules, numbered
  records, `tmp` artifacts, archived POC code, or topic documentation.
- Configuration, setup, capability, compatibility, build, and awaited update
  failures are loud. After a runtime path has been installed successfully,
  frame failures log and continue with the last valid state, a safe no-op, or
  an explicitly designed fallback when possible.
- A requested feature must not silently downgrade when a required resource is
  missing, stale, incompatible, or unsupported. An explicitly configured
  simpler mode is different from fallback caused by failed setup.

### Naming, placement, and JSDoc

These are repository conventions applied to Algorithm32:

- Class files use PascalCase and normally export only the class they implement.
  Reusable constants and stateless helpers live in focused adjacent modules.
- Class-specific specs live in adjacent `_tests/` directories and use
  `ClassName.spec.js` filenames.
- Complex packet and API shapes live in the appropriate ambient `types.d.ts`
  home with property-level documentation.
- JavaScript JSDoc uses active voice, explicit types, documented parameters and
  returns, and `@param {Type} name - description` form.
- Private state and methods use a leading underscore. Public read access uses
  getters. Mutation that validates, normalizes, invalidates, derives state, or
  performs resource work uses an explicit verb-named method rather than a
  setter.
- Prefer established rendering vocabulary: ray, radiance, incident radiance,
  irradiance, transmittance, optical depth, extinction, phase function,
  in-scattering, spectral radiance, and precomputed texture data. Generic core
  APIs use `light source`; concrete Sun or Moon names remain in their specific
  owners.

## CPU `Reference` Rules

`Algorithm32.evaluate(...)` and `Reference.evaluate(...)` are selected-ray
spectral operations. They do not render a frame and do not perform Color or
display conversion.

One evaluation follows this ownership order:

```text
EvaluationRequest
    -> geometry resolves the finite view-ray segment
    -> Reference resolves execution and incident-sampling precedence
    -> SpectralCalculator builds endpoint/trapezoid integration points
    -> SpectralCalculator evaluates spectral transport
    -> immutable pathRadiance + transmittance result
```

Rules:

- Geometry owns ray/path resolution. Atmosphere owns medium, optical-depth,
  and phase sampling. The source owns direct-light and source-path facts.
  `Reference` coordinates their packets instead of reimplementing them.
- `SpectralCalculator` owns reusable Beer-Lambert, transmittance, scattering,
  and integration operations. Cache builders may use it and narrower owner
  operations directly; they do not need to wrap each build sample in a full
  `Reference.evaluate(...)` workflow.
- Incident-radiance sampling precedence is request property, including explicit
  `null`, then a configured `Reference` default, then no incident sampling.
  A non-null operation-ready packet includes a cache descriptor and callable
  sampler.
- Per-request numerical overrides must be validated and bounded. Defaults are
  execution configuration, not hidden physics facts.
- Results preserve the canonical spectral channel order and contain spectral
  path radiance, transmittance, the resolved view segment, and integration
  points. Display RGB is outside the result.
- `Reference` remains the CPU oracle when builders or GPU paths add optimized
  representations. It does not become a frame-level or per-pixel response
  orchestrator merely to validate those representations.

## GPU Shader Rules

The current product topology is:

```text
RenderPass(scene, camera)
    -> SceneInputCapture
    -> ShaderRuntimePass
```

### Contribution ownership and assembly

- Geometry, atmosphere, light source, source-created incident cache, transport,
  and Color owners provide their shader contributions and semantic payloads.
  `ShaderBuilder` collects them; it does not recreate their equations or facts.
- Each contribution declares a stable id and owner, compatible descriptor
  fingerprint, provided and required symbols, ordered GLSL blocks or hooks,
  uniforms, textures, and binding requirements.
- Assembly is deterministic. The current owner order is runtime, geometry,
  light source, atmosphere, incident cache, transport, then Color. The current
  hook order reconstructs the ray and path, samples owners, looks up incident
  radiance, evaluates transport, composes scene color, and encodes output.
- Missing required symbols, duplicate symbol providers, descriptor fingerprint
  mismatches, malformed contributions, missing required bindings, and
  descriptor/payload mismatches fail before pass installation.
- A required uniform may use an owner-declared default. A required texture or
  a uniform without a declared value/default may not be silently bound to an
  unusable value.

### Resources and runtime

- The normal application supplies configured owners plus Three attachment
  handles and live binding values. It does not author Algorithm32 GLSL, select
  internal packing, construct cache textures, or choose internal pass order.
- The fullscreen pass uses GLSL3 `RawShaderMaterial` with depth testing and
  writing disabled. Keep atmosphere composition in this pass rather than
  duplicating it in object materials.
- `SceneInputCapture` owns renderer-produced scene color, packed scene distance,
  and hit mask. Its depth is current destination-ray scene information, not an
  automatic exact-visibility result along another source direction.
- `ShaderRuntimePass` refreshes live scene textures, responds to resize,
  executes the fullscreen draw, reports bounded runtime diagnostics, and
  disposes its material and geometry.
- Current generic resource preparation is only the implemented incident-cache
  `Data3DTexture` path. A new texture family must add its own validated
  descriptor, payload, capability, packing, binding, restoration, and disposal
  contract rather than assuming that path is generalized.
- Setup must clean partially prepared or installed passes and resources after
  failure. A stronger complete-successor-before-install and context-restoration
  guarantee must be implemented and tested before it is claimed for a new
  resource family.

## Celestial Contribution-Cache Extension

These rules constrain the selected extension; they do not describe current
implemented behavior.

- Do not add production cache or shader modules until the cache plan's
  Qualification Gate A accepts at least one bounded source/geometry
  representation.
- Use a distinct `celestialContribution.*` descriptor, resource, payload, and
  binding namespace. The existing `cache.*` path is incident radiance used to
  illuminate atmosphere transport and must not be overloaded.
- Add a separate zero-initialized `celestialRadiance` spectral term after base
  `evaluateTransport` and before Color. Color consumes
  `pathRadiance + celestialRadiance` exactly once.
- Cached celestial values are already atmosphere transported. Runtime must not
  multiply them by the view-ray transmittance again.
- Camera pose, projection, viewport, pixel ratio, response, pixel footprint,
  and renderer scene depth remain live query/raster inputs. They never enter
  transported-field identity and never trigger a rebuild merely because the
  camera changed.
- A source-sized preparation pass, if qualification selects it, is transient
  per-frame query/projection/visibility state. It is not a cache generation.
- A disabled optional cache contributes exact zero. A configured missing,
  malformed, stale, incompatible, or unsupported cache fails during setup or
  awaited replacement.
- Future resource work must prove capability preflight, all-channel packing,
  stale-generation rejection, complete successor preparation, failed-update
  retention, context restoration, and disposal.

## Testing Rules

### Test lanes and placement

- Run the focused production lane with
  `npm run test:algorithm32:production`.
- Jasmine discovers class-local `**/_tests/**/*.spec.?(m)js` specs in a stable,
  non-random order.
- Run `npm run build` for the production cut and for source/type changes whose
  integration is not established by direct Node parsing.
- Shader/runtime changes also require the selected app-integration lane and the
  applicable GPU/browser proof. Unit assembly tests alone do not establish GPU
  physical correctness.
- Status owns the current passing counts and most recent recorded commands. Do
  not copy those changing counts into this guide.

### Physical fixtures and expectations

- Checked-in production fixture ledgers own physical values, algorithm
  invariants, source packets, and tolerances used by specs. Do not duplicate
  those facts as inline spec literals.
- Each physical/oracle row carries a stable id, quantity, citation, precise
  provenance pointer, assumptions, inputs, expected value or expected error,
  tolerance metadata, and an independence note.
- Add or update a fixture-envelope validation spec before production specs
  consume a new fixture family.
- Prefer authoritative tables, source data, published examples, independent
  external-tool artifacts, or source-backed analytic invariants. Do not derive
  an expected value by calling the production implementation under test or a
  second new local implementation of the same algorithm.
- Inline literals remain appropriate for API shape, bookkeeping, binding
  plumbing, and other non-physics mechanics.
- Cover sourced domain boundaries and failure limits, not only central happy
  paths. Declare tolerances and performance budgets before running an
  acceptance experiment.

### CPU-reference coverage

Reference and calculator tests cover:

- geometry-owned path orchestration and immutable result shape;
- request, explicit-null, configured-default, and no-incident sampling cases;
- endpoint/trapezoid scheduling and execution-control validation;
- source optical depth and Beer-Lambert transmittance;
- Rayleigh/Mie phase and direct plus incident scattering;
- all canonical spectral channels and channel ordering;
- vacuum, zero-length, zero-weight, monotonic, invalid, and non-finite limits;
  and
- accepted selected-ray oracle fixtures after their evidence is promoted.

### Shader and resource coverage

Shader tests cover:

- deterministic contribution and block ordering;
- defines, uniforms, textures, samplers, required symbols, duplicate symbols,
  descriptor fingerprints, and stable binding order;
- missing/defaulted bindings and unsupported source/geometry combinations;
- descriptor/payload compatibility, dimensions, channel packing, filtering,
  upload metadata, and capability failures;
- capture-before-runtime pass order, renderer/scene state restoration, resize,
  live input refresh, partial-install cleanup, and idempotent disposal;
- setup/config errors rejecting loudly and live draw errors logging without
  destroying a valid composer state; and
- complete distant/spherical and local/flat owner assemblies including Color.

### Layered parity

Acceptance proceeds in layers:

```text
independent physical or accepted first-party oracle
    -> CPU Reference or CPU cache query
    -> packed GPU query before Color
    -> selected-pixel Reference + Color comparison
    -> production-shaped browser/app proof
```

- Deterministic 8-bit selected-pixel display comparison uses accepted evidence
  `gpu-selected-rgba-byte-parity`: maximum absolute RGB byte delta `3`; alpha
  remains exact unless the scene declares an alpha-composition claim.
- Whole-image or controlled-region claims use scene-owned thresholds, retain
  exact byte metrics for audit, and may use the accepted perceptual metrics as
  review aids. They do not replace spectral or selected-pixel parity.
- Cache acceptance additionally proves all 15 spectral channels, no second
  transmittance, camera changes without cache-identity changes, invalidation,
  resource budgets, and optional-disabled equivalence.
- A new celestial cache requires a fresh numbered proof record. Rolled-back
  record `067` is never amended or reused.

## Reference And Evidence Rules

### Third-party references

- Third-party physics, algorithms, datasets, and platform facts use AMA-style
  numbered entries in `shared/algorithm32/production/references.md`.
- Cite them after a short claim using ASCII bracket tokens such as `[1]`,
  `[2]`, or `[1][2]`. Do not use Unicode superscripts, Markdown footnotes, or
  HTML citation markup.
- Cite the meaningful equation, algorithm, variation, source-backed limit, or
  fixture decision. Do not cite every structural branch of an already cited
  algorithm.
- A compact reference pointer may add an exact section, equation, figure,
  table, row, page, pinned artifact, or note when the numbered entry alone is
  not precise enough.

### First-party evidence

- First-party Algorithm32 experiment results are not AMA references and do not
  receive bracket numbers.
- Accepted claims use stable lowercase kebab-case names from
  `shared/algorithm32/production/evidence.md`. Each entry identifies the exact
  scripts, records, artifacts, criteria, run ids, and accepted claim boundary.
- A transitional internal experiment may use `(script <code>)` after the code
  and short description are registered in the production reference catalog.
  Promotion to accepted evidence preserves the short code and adds exact
  locators.
- Generated scripts, logs, screenshots, and records are supporting evidence
  until a focused production evidence entry or fixture ledger accepts a stated
  claim.

### Claim boundaries and promotion

- Every production physics/algorithm constant, meaningful variation, physical
  limit, experimentally selected default, fixture expectation, and tolerance
  has either a numbered reference, a source-backed derivation, or accepted
  first-party evidence.
- API shape, module placement, ordinary validation plumbing, JSDoc style,
  mechanical shader assembly, and lifecycle organization do not need physics
  citations. Operational limits asserted from WebGL, Three, JavaScript, or
  another platform cite the applicable platform/API authority.
- Preserve source claim boundaries. A radiometry source does not accept cache
  coordinates; a camera source does not accept local matrix conventions; a
  Three resource source does not accept physics or GPU parity; an accepted CPU
  record does not automatically accept a new cache layout.
- Pin mutable external data and library identities by exact version, tag,
  immutable path, checksum, integrity, or equivalent reproducible identity.
- Reconciliation and cache-dossier ids are planning and audit identifiers.
  Production code, tests, fixtures, and descriptors cite only promoted
  production numbered references and named evidence.
- Promote only the source rows, evidence claims, and fixture bytes needed by
  the selected production slice. Recheck hashes and make the production fixture
  path the sole canonical owner; retained reconciliation bytes remain immutable
  audit evidence.

## Claim Discipline

The aggregate production spec count does not by itself establish physical CPU
or GPU parity. A completion claim must name the layer actually tested:

- orchestration or contract unit coverage;
- analytic transport coverage;
- selected-ray CPU oracle parity;
- shader source/resource/lifecycle coverage;
- packed pre-display CPU/GPU parity;
- selected-pixel display parity; or
- browser/app integration proof.

Do not describe a planned gate, historical record, source-assembly spec, or
fake-Three lifecycle test as evidence for a layer it did not execute.

