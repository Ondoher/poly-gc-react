# Algorithm32 Status

This document is not a historical record. Maintain only the current state,
active open items, current verification, and source pointers needed for a fresh
handoff. Remove completed chronology, superseded implementation notes, and
archaeology as soon as they stop describing the current working state.

For the active reconciliation proof, keep lightweight chronology in
`tmp/atmosphere/reconciliation/running-log.md` when needed, and keep durable
evidence in numbered records under `tmp/atmosphere/reconciliation/NNN-*`.

## Current Focus

- Active production handoff: the `flat32` globe atmosphere/star dimming
  diagnostic has moved back to the reconciliation experimental lane for the
  next proof. Production should wait for the accepted reconciliation contract
  before promoting new boundary-radiance APIs.
- Immediate code truth:
  - `src/flat32/index.js`
  - `shared/algorithm32/production/color/BrunetonColorDisplayModel.js`
  - `shared/algorithm32/production/color/_tests/BrunetonColorDisplayModel.spec.js`
  - `shared/algorithm32/production/types/types.d.ts`
- Latest behavior to preserve: Color-owned final composition is
  `pathRadiance + sceneDisplayRgb * sceneTransmittance`. Runtime composer
  scene color is captured as linear sRGB, so the Color shader first converts
  renderer scene RGB to display RGB before applying the Figure 1 inverse
  tone-map bridge. It then applies accumulated view transmittance to captured
  scene color only when the captured endpoint lies inside the atmosphere path.
  If the ray reaches the atmosphere boundary before the scene endpoint,
  `sceneTransmittance` is identity so outside-atmosphere stars/backgrounds are
  not globally dimmed.
- Current diagnostic result: the color-space bridge fixes the black/dim
  outside-atmosphere scene. In globe mode at San Jose, the `0.03`-reference
  star calibration left only A-H ladder stars F/G/H visible, but those same
  ladder stars were visible at solar noon, sunset, and sunset + 1 hour. After
  lowering the calibration again, H still remains visible at solar noon,
  sunset, and sunset + 1 hour. Treat this as evidence that captured display
  RGB brightness tuning is not the real solution.
- Current experiment: `flat32` star diagnostics remain unlit display-style
  scene meshes. The current synthetic analog color uses magnitude flux scaling
  from `0.004` renderer-linear RGB at magnitude `-1.46` down to about
  `0.0000096` at magnitude `5.09`. The A-H brightness ladder now spans
  `0.000005` through `0.012`.
- Current proof lane: reconciliation Milestone 5. Prototype an explicit
  external boundary-radiance field there, then promote only the accepted
  source/layer/composition contract into production. Include a source-provided
  companion boundary-radiance object in that prototype, so
  illumination-capable bodies such as the Sun can expose their visible disk
  while keeping atmospheric illumination and camera-ray visibility as separate
  roles.

## Current State

- Production Algorithm32 lives under `shared/algorithm32/production/`.
- The production shape stays fixed around `Algorithm32`, `Reference`,
  `ShaderBuilder`, the facade-owned shared model, and concrete configured
  owner instances supplied by the app.
- The active owner boundaries are light source, geometry, atmosphere,
  incident-radiance cache/sampler, and Color/display. Keep renderer RGB,
  materials, Three scene objects, shadows, and camera choreography outside
  CPU/reference transport.
- `Reference` is the CPU/reference oracle for validation and tooling. Runtime
  rendering uses the GPU shader path; do not promote CPU rendering or POC
  postprocess validation harnesses as product runtime.
- `SpectralCalculator` is the common internal transport/math collaborator used
  by `Reference` and cache construction.
- Incident-radiance support is setup-bound. The light source creates the
  source-shaped cache, the cache owns coordinates/descriptors/sampler/shader
  payload, and `ShaderBuilder` owns GPU texture creation and binding.
- `ShaderBuilder` owns mechanical runtime shader work: descriptor synthesis,
  owner contribution collection, compatibility checks, resource preparation,
  required binding validation, pass installation, frame binding, and cleanup.
  Domain semantics stay with the owner abstractions.
- Runtime Three integration is composer-based:
  `RenderPass(scene, camera)` -> `SceneInputCapture` -> `ShaderRuntimePass`.
  `SceneInputCapture` produces pixel-exact RGB24 scene-depth and R8 hit-mask
  inputs with nearest filtering, no mipmaps, and shader-side `texelFetch`.
- `ShaderRuntimePass` samples renderer-produced scene color plus capture
  depth/hit inputs and delegates final pixel composition to the Color-owned
  shader contribution.
- `BrunetonColorDisplayModel` owns the accepted Figure 1 spectral-to-display
  conversion, renderer linear-sRGB scene-color conversion into display RGB,
  inverse tone-map support for captured scene RGB, RGB-band transmittance
  collapse, and Color-owned shader contribution.
- Current concrete production owners include `CanonicalAtmosphere`,
  `SphericalEarthGeometry`, `FlatEarthGeometry`, `DistantSunLightSource`,
  `LocalSunLightSource`, source-owned distant/local incident-radiance caches,
  `FlatSynchronizer`, and the promoted shader quality profiles in
  `Algorithm32CanonicalData`.
- Production geometries own Three endpoint object creation and default
  scene-depth caps through `createThreeEndpointObjects(...)` and
  `resolveSceneDepthMaxMeters(...)`.
- Production light sources own Three endpoint lighting helpers and shadow
  object configuration through `addSceneLighting(...)` and related helper
  surfaces.
- The React flat/globe app integration is preliminary consumer scaffolding. It
  creates real `EffectComposer` / `RenderPass` pipelines and uses the reusable
  class wrapper plus tiny R3F bridge, but it is not correctness evidence for
  the shader output.
- The vanilla `flat32` app is the current runtime debugging baseline. It
  bypasses React, creates the Algorithm32 config and composer directly, starts
  on the `fast` quality profile, caps live rendering to 20 fps, supports
  shader on/off isolation, and rebuilds setup when mode/quality/time/location
  controls change.
- `flat32` currently includes captured synthetic star analog endpoints, an
  antisolar A-H brightness ladder, `Full Scene` / `Atmosphere Only`, and
  mutually exclusive `Green Shell` diagnostic modes. The DOM labels for the
  ladder remain outside the atmosphere pass. The current synthetic star
  brightness calibration is intentionally app-owned diagnostic content and is
  not a physical radiance/exposure model.
- Diagnostic caveat: the current camera-centered green shell is captured as a
  normal scene endpoint, so it is not a perfect beyond-atmosphere probe for
  every low-elevation ray.

## Current Verification

Recorded current verification:

- `npm run test:algorithm32:production` passes 229 specs after the Color-owned
  renderer-linear scene color bridge.
- `npm run build` passes after the synthetic-star magnitude calibration with
  the known Babel deoptimisation and existing circular-dependency warnings.
- The broader flat UI checkpoint records `npm run test:ui:flat` passing 120
  specs.

`npm run test:ui:flat` was not rerun for the renderer-linear scene color
bridge.

## Open Items

- Follow the reconciliation Milestone 5 proof for the separate celestial
  boundary-radiance/source policy instead of tuning captured scene RGB further.
  The proof should treat stars, Moon, planets, and the Sun disk as external
  radiance contributors sampled along the camera ray, composed as
  `pathRadiance + viewTransmittance * celestialRadiance`, while keeping
  optional sky/atmosphere illumination through incident-radiance/L2 support as
  a separate later concern. The prototype should include a light-source-owned
  external boundary-radiance provider for the visible Sun disk, with that
  provider remaining a separate role from atmosphere illumination.
- Keep blue/background fallback cleanup separate: app backgrounds should not be
  treated as celestial light.
- If the visual retest still looks wrong, replace the current green-shell
  probe with a cleaner diagnostic that renders a green background/shell into
  scene color while excluding it from scene-depth/hit capture, so the shader
  must treat it as beyond the atmosphere.
- Add browser/readback parity coverage for scene color, ray-length/depth
  capture, hit mask, and selected-pixel output against `Reference` plus Color.
  Use the real app composer path when practical.
- Re-check the live flat/globe canvases with lightweight instrumentation after
  the bridge fallback and camera-binding fixes. Avoid long Puppeteer/readback
  loops; earlier attempts consumed excessive CPU.
- Continue runtime resource/capability polish without moving domain semantics
  into `ShaderBuilder`.
- Strengthen incident-cache stale/key mismatch validation.
- Add source-light synchronization and scene-mapping adapters only where real
  app integration needs them.
- Define the normalized location/date/time-zone packet accepted by Algorithm32
  calibration helpers from app-owned services.
- Promote a richer geometry-owned placement frame API when app-authored
  endpoint objects need normalized scene position, orientation, and
  depth-cap/bounding points instead of point-level placement only.
- Continue the broader unit-bearing configuration cleanup for non-spectral
  distance/angle fields when those APIs are next touched.
- Keep diagnostics, debug views, public error taxonomy, and runtime capability
  diagnostic API deferred until a specific diagnostics design is accepted.
- Resolve provenance gaps only through
  `agents/topics/apps/flat/reconciliation/unsourced-and-partially-sourced-facts.md`
  and targeted reference/evidence updates.

## Future Ideas

- Multi-source atmosphere illumination: support a future
  `LightSourceSet` / `AtmosphereIlluminationSet` for Tatooine-style worlds
  where two or more suns are true scattering light sources. Each source needs
  independent direction or position, spectrum/radiance, angular size,
  source-path transmittance, and visibility/occlusion state. Direct path
  radiance can sum per-source contributions so one sun can set while another
  remains above the horizon. Visible disks for those same suns should still
  compose through the external boundary-radiance path, not through the L2 cache.

## Working Rules

- Reconciliation conclusions are the current implementation authority unless a
  recorded production exception says otherwise.
- Do not runtime-link production code to reconciliation POC, archived POC, or
  historical experiment code. Promote accepted behavior into production files.
- Keep top-level production API names stable: `Algorithm32`, `Reference`, and
  `ShaderBuilder`.
- Use explicit unit-bearing packets at durable/API boundaries for convertible
  quantities. Wavelength units use plural spellings such as `nanometers` and
  `micrometers`; singular spellings fail validation.
- Runtime setup/config surfaces fail loudly. Live frame failures should log
  and continue with the last valid state, no-op, or fallback path when
  possible.
- Stars and celestial bodies are app-owned celestial content, but the current
  captured scene-color path is not a sufficient physical visibility model for
  them. Do not fold visible stars into the incident-radiance/L2 cache; prove an
  explicit external boundary-radiance layer first, then decide the narrow
  production API surface.
- POC endpoint radiance and camera-distance display scales are intentionally
  excluded from production. Any future artistic endpoint display controls need
  explicit app/Color policy.

## Source Pointers

Current docs:

- `agents/topics/active-topic.md`
- `agents/topics/apps/flat/algorithm32/README.md`
- `agents/topics/apps/flat/algorithm32/integration.md`
- `agents/topics/apps/flat/algorithm32/reconciliation-production-deltas.md`
- `agents/topics/apps/flat/reconciliation/conclusions.md`
- `shared/algorithm32/production/README.md`
- `shared/algorithm32/production/references.md`

Current implementation files:

- `src/flat32/index.js`
- `shared/algorithm32/production/color/BrunetonColorDisplayModel.js`
- `shared/algorithm32/production/constants/Algorithm32CanonicalData.js`
- `shared/algorithm32/production/implementation/ShaderBuilder.js`
- `shared/algorithm32/production/implementation/SceneInputCapture.js`
- `shared/algorithm32/production/implementation/ShaderRuntimePass.js`
- `shared/algorithm32/production/transport/Algorithm32Transport.js`
- `shared/algorithm32/production/geometries/SphericalEarthGeometry.js`
- `shared/algorithm32/production/geometries/FlatEarthGeometry.js`
- `shared/algorithm32/production/atmospheres/CanonicalAtmosphere.js`
- `shared/algorithm32/production/light-sources/DistantSunLightSource.js`
- `shared/algorithm32/production/light-sources/LocalSunLightSource.js`
- `shared/algorithm32/production/light-sources/DistantSunIncidentRadianceCache.js`
- `shared/algorithm32/production/light-sources/LocalSunIncidentRadianceCache.js`
- `shared/algorithm32/production/react/Algorithm32AtmosphereComposer.jsx`
- `shared/algorithm32/production/react/Algorithm32R3FAtmosphereComposer.jsx`
- `shared/algorithm32/production/react/Algorithm32ReactUtils.js`
- `src/flat/shared/algorithm32-production-config.js`
- `src/flat/features/flat-simulation/components/FlatAlgorithm32AtmosphereComposer.jsx`
- `src/flat/features/globe-simulation/components/GlobeAlgorithm32AtmosphereComposer.jsx`
