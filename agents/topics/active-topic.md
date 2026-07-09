# Active Topic

Current active topic: `algorithm32/production-shader`

Parent app/topic: `flat`

## Current Focus

Production shader/runtime implementation for Algorithm32. Current checkpoint:
POC-backed canonical data, Color/display conversion, and owner-local shader
contributions for the distant spherical and local flat paths are promoted into
production. The old aggregate profile and shader contribution factories are
quarantined under `shared/algorithm32/production/quarantine/` for later
deletion. Missing Color configuration now fails loudly instead of using a
default output contribution. Renderer-produced depth/hit capture is promoted
as a reusable runtime helper under `SceneInputCapture`. The atmosphere shader
does not need shader-facing object/material ID textures; it needs ray length,
hit mask, and renderer-produced scene color for final Color/display
composition. Spectral wavelength boundaries now use unit-neutral `wavelength`
and `wavelengthBinWidth` packets with plural unit strings. Next work is
runtime resource/capability polish, optional source-light or scene-mapping
adapters only where real integration needs them, and browser/readback parity
fixtures once the real app composer provides stable readback surfaces.

## Reload Sources

Load these after the shared bootstrap docs:

- [Algorithm32 Production Documentation](apps/flat/algorithm32/README.md)
- [Algorithm32 Status](apps/flat/algorithm32/status.md)
- [Production Code Architecture And POC Review](apps/flat/algorithm32/production-code-architecture-poc-review.md)
- [Algorithm32 Requirements](apps/flat/algorithm32/requirements.md)
- [Algorithm32 Production Design](apps/flat/algorithm32/production-design.md)
- [Algorithm32 Implementation Plan](apps/flat/algorithm32/implementation-plan.md)
- [Algorithm32 Primary Facade API Draft](apps/flat/algorithm32/api-facade-draft.md)
- [Reconciliation Conclusions](apps/flat/reconciliation/conclusions.md)
- [Reconciliation To Production Deltas](apps/flat/algorithm32/reconciliation-production-deltas.md)
- [Reconciliation Lane](apps/flat/reconciliation/README.md)
- [Unsourced And Partially Sourced Facts](apps/flat/reconciliation/unsourced-and-partially-sourced-facts.md)
- [Algorithm32 Production Module README](../../shared/algorithm32/production/README.md)
- [Algorithm32 Production References](../../shared/algorithm32/production/references.md)
- [Algorithm32 Production Types](../../shared/algorithm32/production/types/types.d.ts)
- [Algorithm32 Canonical Data](../../shared/algorithm32/production/constants/Algorithm32CanonicalData.js)
- [Algorithm32 Wavelength Math](../../shared/algorithm32/production/utils/WavelengthMath.js)
- [Algorithm32 Color Display Model](../../shared/algorithm32/production/color/BrunetonColorDisplayModel.js)
- [Algorithm32 Spherical Geometry](../../shared/algorithm32/production/geometries/SphericalEarthGeometry.js)
- [Algorithm32 Flat Geometry](../../shared/algorithm32/production/geometries/FlatEarthGeometry.js)
- [Algorithm32 Canonical Atmosphere](../../shared/algorithm32/production/atmospheres/CanonicalAtmosphere.js)
- [Algorithm32 Distant Sun Light Source](../../shared/algorithm32/production/light-sources/DistantSunLightSource.js)
- [Algorithm32 Local Sun Light Source](../../shared/algorithm32/production/light-sources/LocalSunLightSource.js)
- [Algorithm32 Distant Incident Cache](../../shared/algorithm32/production/light-sources/DistantSunIncidentRadianceCache.js)
- [Algorithm32 Local Incident Cache](../../shared/algorithm32/production/light-sources/LocalSunIncidentRadianceCache.js)
- [Algorithm32 Transport](../../shared/algorithm32/production/transport/Algorithm32Transport.js)
- [Algorithm32 Shader Builder](../../shared/algorithm32/production/implementation/ShaderBuilder.js)
- [Algorithm32 Scene Input Capture](../../shared/algorithm32/production/implementation/SceneInputCapture.js)

## Active Rules

- Work belongs in `shared/algorithm32/production/` and the production
  Algorithm32 docs under `agents/topics/apps/flat/algorithm32/`.
- Treat [Reconciliation Conclusions](apps/flat/reconciliation/conclusions.md)
  as the consolidated implementation driver for the production
  shader/reference work, including its adjusted abstraction ownership and data
  flow.
- Use [Reconciliation To Production Deltas](apps/flat/algorithm32/reconciliation-production-deltas.md)
  to resolve architecture/API gaps before changing production contracts.
- Keep the production top-level shape as the primary API boundary:
  `Algorithm32` facade, production dependency aggregate, `Reference`, and
  `ShaderBuilder`. Align the internal details and owned abstractions with the
  reconciliation POC beneath that shape.
- Treat `SpectralCalculator` as a common internal utility/collaborator used by
  both `Reference` evaluation and incident-radiance cache building. It is not
  owned exclusively by `Reference` and is not a primary public facade API.
- Shader assembly is split by ownership: specific abstraction interfaces own
  their shader contributions and cache/source/geometry/atmosphere semantics;
  `ShaderBuilder` owns the remaining mechanical shader work, including source
  assembly, compatibility checks, texture/resource preparation, bindings,
  pass/material installation, frame updates, and cleanup.
- No separate public texture-artifact import/export API ships in the first
  production API. `ShaderBuilder` and the shader handle own awaited runtime
  texture/cache preparation; serializable descriptors and packed payloads stay
  internal/test support unless a later concrete non-app tooling consumer
  requires a narrow public artifact surface.
- `setupShader` receives the live Three attachment handles, including scene,
  composer, and camera, as setup-time attachment state. Scene binding is not
  durable Algorithm32 configuration and is not normal mutable shader-handle
  state. Moving an installed pass to another scene/composer/camera should use
  explicit teardown/re-setup unless a later framework integration need
  justifies a narrow rebind operation.
- CPU-side production work is `Reference` evaluation only. Keep it as the
  validation/oracle path for selected rays, fixtures, and cache support; the
  production render product is the GPU shader/runtime path, and the POC
  postprocess validation harness is not promoted.
- First integration assumes WebGL2/Three `Data3DTexture` is available for
  incident-radiance cache resources. A 2D atlas fallback is a later
  compatibility extension only if target devices require it.
- Incident-radiance cache spatial resolution is geometry/cache-domain driven.
  Geometry owns the source-relative `z`/`rho` coordinate mapping, domain
  ranges, binning policy, and resolution descriptors used by cache keys and
  shader texture dimensions. Fixed `z`/`rho` dimensions are allowed for
  validation fixtures or named local-domain quality presets, not as universal
  global defaults. Incoming direction counts remain execution/source-sampling
  policy, and spectral groups remain spectral-model/packing policy.
- GPU-vs-reference display parity uses reconciliation-mined tolerance
  evidence. Selected-pixel comparisons against `Reference` plus `Color` use
  evidence `gpu-selected-rgba-byte-parity`: max absolute RGB byte delta `3`
  for deterministic 8-bit display readbacks, with alpha exact unless a scene
  declares alpha-composition behavior. Whole-image and controlled-region
  quality claims use scene-owned thresholds and should report evidence
  `gpu-perceptual-quality-metrics`: exact byte metrics, Rec.709
  luma/weighted-RGB proxy metrics, and CIEDE2000-style residual diffs with
  `1.0 Delta E 2000` as a review threshold.
- Debug views are deferred with diagnostics. Experiment/dev debug modes must
  not become first-production runtime shader API until a later diagnostics
  design accepts them.
- Visible stars and celestial point-source display are handled outside the
  Algorithm32 shader as part of the app's scene. They are not first-production
  shader facade features, hidden shader constants, atmosphere inputs, or Color
  extensions.
- Display conversion is resolved to the `Color` abstraction. `Color`
  owns the Bruneton-backed spectral-to-display conversion, output color-space
  descriptor, exposure/tone-map policy, CPU `convert(...)` support, and any
  shader-facing descriptor emitted through `describe()` or a promoted
  Color-owned descriptor. `setupShader`/shader-handle updates should consume
  the Color abstraction or its descriptor; do not introduce a separate
  `Algorithm32DisplayConversion` owner.
- Validation fixtures are unit-test artifacts. Keep checked-in fixture data
  with the relevant production tests/fixture ledgers. Third-party source
  citations use the main production reference file,
  `shared/algorithm32/production/references.md`, and the existing
  bracket-citation rules. Values determined experimentally should reference
  concise accepted first-party evidence names from
  `shared/algorithm32/production/evidence.md`, with compact pointers to the
  exact script, record, artifact, criterion, or run id.
- Use the POC `IncidentRadianceSampling` name for the operation-ready CPU
  incident-radiance sampler packet. It is setup/reference state, not durable
  public facade config. CPU evaluation precedence is request property first
  (including explicit `null`), then the `Reference` configured default, then
  no incident sampling. Shader setup/handle state owns the GPU resource
  equivalent instead of a per-evaluation override.
- Use the reconciliation POC for all production implementation details unless
  there is an explicit recorded production conflict. Current recorded
  conflicts/exceptions are the retained top-level production shape, explicit
  unit-bearing boundaries for convertible quantities, deferred diagnostics,
  and the config/setup-vs-runtime failure policy.
- For type definitions and property names, use the reconciliation POC shapes
  and names because most production implementation code will be lifted from
  that code base. Rename only when a POC name is actively misleading in the
  production contract, and document the one-to-one mapping. Any quantity that
  can be represented in different units through conversion must use an
  explicit unit-bearing packet at durable/API boundaries; avoid implicit unit
  scalar types there. Unit strings inside those packets use plural spellings
  such as `nanometers`, `micrometers`, `meters`, `kilometers`, `radians`, and
  `degrees`; singular spellings fail validation rather than acting as aliases.
- Diagnostics remain deferred. Implement only the basic fail-loud validation
  and setup/resource errors needed for the promoted runtime path; do not add
  diagnostic envelopes, per-helper callbacks, or a stable public diagnostics
  taxonomy in the first slice.
- Failure policy: fail loudly on configuration and setup surfaces, including
  constructor validation, `setConfig`, `setupShader`, awaited handle config
  updates, and resource build/bind setup. Once the runtime render path is
  live, log runtime failures and continue with the last valid state, no-op, or
  fallback path when possible.
- The reconciliation topic, reconciliation POC code, and reconciliation
  experiment records remain relevant supporting implementation material:
  `agents/topics/apps/flat/reconciliation/`,
  `scripts/flat/reconciliation/POC/`, and
  `tmp/atmosphere/reconciliation/`.
- Older pre-reconciliation cleanroom, shader-lab, local-second-order,
  `shared/algorithm32/POC/`, source-contract, and scattered experiment lanes
  are no longer production implementation references.
- Do not runtime-link production code to reconciliation POC or experiment code.
  Promote the accepted behavior and contracts into
  `shared/algorithm32/production/`.
- Keep unresolved source/provenance work tracked through
  [Unsourced And Partially Sourced Facts](apps/flat/reconciliation/unsourced-and-partially-sourced-facts.md).
- Current verification checkpoint: `npm run test:algorithm32:production`
  passes 168 specs, and `npm run build` passes with the known Babel
  deoptimisation and existing circular-dependency warnings.
- Current promoted shader pieces are the canonical constants/data module,
  `BrunetonColorDisplayModel`, Color-owned display shader contribution,
  owner-local geometry, atmosphere, light-source, source-created cache, and
  core transport shader contributions for the distant spherical and local flat
  paths, source/cache/geometry descriptors needed by those contributions, and
  `ShaderUniformDescriptor` defaults consumed by `ShaderBuilder`. Runtime
  setup also covers cache texture resources, required binding validation,
  cache descriptor/payload validation, and reusable scene depth/hit capture
  through `SceneInputCapture`.
- Promoted POC constants, display facts, and profile shader facts cite the
  internal short code `(script a32-poc-color-032)` in
  `shared/algorithm32/production/references.md` until exact experiment record
  locators are collected in `evidence.md`.
- Fresh agents should treat runtime resource/capability polish, optional
  source-light or scene-mapping adapters needed by real integration, and
  browser/readback parity fixtures as the next concrete work. Do not add
  shader-facing object/material ID textures for the atmosphere algorithm
  unless a later shader behavior explicitly needs semantic per-pixel labels.
