# Algorithm32 Canonical Reference

This document is the canonical summary of the current Algorithm32 atmosphere
work. It consolidates the cleanroom reference, local-Sun source abstraction,
CPU soft-shader, packet GPU shader, and Three-native integrated shader lanes.

Use this as the first reference before opening the detailed experiment plans.
Older documents remain useful evidence, but this document owns the current
status and the production direction.

## Current Status

Current accepted endpoint:

```text
tmp/atmosphere/algorithm32_shader_lab/226-three-native-production-shape-review/
```

Current objective live-pass parity evidence:

```text
tmp/atmosphere/algorithm32_shader_lab/224-three-native-live-pass-soft-shader-matrix/
```

Latest visual-only shader comparison:

```text
tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/
```

Compact evidence copied out of `tmp/atmosphere`:

```text
agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/
```

Use the copied evidence package if `tmp/atmosphere` has been emptied. The
package preserves reports, criteria, diagnostics, selected images, and
comparison JSON for the current accepted endpoints; it intentionally omits
superseded historical artifacts and temporary script snapshots.

The accepted production target shape is:

```text
Three scene render
  -> scene color render target + depth texture
  -> Algorithm32AtmospherePass
  -> final camera view
```

JSON scene packets are validation/oracle artifacts only. They are not the
normal render input for the integrated shader.

Production placement:

- `agents/topics/apps/flat/algorithm32/` is the documentation home for the
  official production Algorithm32 module.
- `shared/algorithm32/` is the shared implementation location for production
  Algorithm32 code.
- This cleanroom folder remains evidence/design history until durable
  contracts are promoted into the production documentation home.

## Algorithm32 Steps

Algorithm32 is a clear-air spectral atmosphere transport model. Its core job is
to transport an incident light field through the atmosphere; it should not own
app-specific Sun orbit policy, renderer-specific ray limits, Three.js scene
lighting, or display tuning.

The current trace flow is:

1. Resolve an explicit profile, geometry, source, numerical policy, and
   renderer-provided ray/segment endpoint.
2. Build the camera/view ray.
3. Resolve the segment endpoint:
   - sky ray: atmosphere boundary or configured flat sky policy;
   - hit ray: object, terrain, or ground distance from the renderer;
   - flat no-hit downward ray: ground plane or later terrain policy.
4. Integrate along the view segment.
5. At each integration sample, compute altitude and atmospheric density from
   the active geometry.
6. Compute view optical length and view transmittance.
7. Ask the active source abstraction for incident source sample data at the
   atmosphere sample position.
8. Compute source-path transmittance through the active geometry.
9. Compute phase functions using the view direction and the source-sample
   direction.
10. Accumulate Rayleigh and Mie path radiance.
11. For hit/object rays, compose:

```text
L_camera(lambda) =
  T_view(lambda) * L_object(lambda) +
  L_path(lambda)
```

12. For sky rays, return path radiance only.
13. Convert spectral radiance to display RGB only after transport. Display
   conversion is a consumer step, not part of the atmosphere physics.

## Configuration And Abstractions

The production module should be plain-data first, with behavior-bearing
adapters reconstructed from canonical config when needed.

Core inputs:

- `Algorithm32Profile`: atmosphere constants, spectral channels, density
  laws, coefficients, phase parameters, scattering-order policy, and named
  assumptions such as no ozone or no ground coupling.
- `Algorithm32Geometry`: endpoint and altitude model. Current required
  families are spherical shell and flat z-up slab.
- `Algorithm32Source`: source-sampling abstraction. Current required families
  are distant directional Sun and flat/local point Sun.
- `Algorithm32NumericalPolicy`: sample counts, integration method, precision,
  and convergence/debug settings.
- `Algorithm32CachePlan`: cache keys, texture coordinate meanings, stored
  quantities, resolution, and source/geometry dependencies.
- `SceneInput` or live renderer inputs: scene color, hit/miss classification,
  hit distance or depth, camera matrices, material/spectrum/object radiance,
  and ray reconstruction data.
- `DisplayPolicy`: tone mapping, color space, RGB/spectral bridge, debug view,
  and HDR/float policy.

Important adapters:

- Source adapter: owns distant-vs-local source sampling, local falloff,
  calibrated incident scale, source color/spectrum, and future emission
  profiles such as a flashlight/spotlight Sun.
- Geometry adapter: owns spherical-vs-flat altitude, top/ground endpoint
  policy, source transmittance path, ray length/cap policy, and coordinate
  conversion.
- Scene-light adapter: maps source config to Three lights for scene materials
  and shadows. It is not the authority for atmospheric transport.
- Shader adapter: maps the canonical config into uniforms, defines, textures,
  and debug views.
- Validation adapter: captures packets and selected diagnostics for CPU/GPU
  parity. It is not the production render path.

## Distant Sun Versus Local Sun

The main Algorithm32 transport loop should not branch directly on distant
versus local Sun except through source and geometry interfaces.

| Concern | Distant directional Sun | Flat/local point Sun | Owner |
| --- | --- | --- | --- |
| Direction | Constant for the scene | Varies per atmosphere sample | Source adapter |
| Distance | Infinite or already normalized | Finite, sample-dependent | Source adapter |
| Incident scale | Solar irradiance by wavelength | Calibrated spectrum times distance/falloff policy | Source adapter |
| Source transmittance | Sample to spherical top-atmosphere boundary along parallel Sun ray | Sample to source/top plane/boundary policy through flat geometry | Geometry + source adapter |
| Phase angle | `dot(viewRay, constantSunDirection)` | `dot(viewRay, sampleToSourceDirection)` | Core transport consumes source sample |
| Second-order cache | Existing distant-Sun cache assumptions remain usable | Deferred; weaker symmetry requires a new cache plan | Cache planner |
| Scene lighting | Three `DirectionalLight` | Three `PointLight` or explicit local-light adapter | Scene-light adapter |
| Time/position | Sun direction/preset | Solar-day circular flat-local source configuration | App/source config |

Local Sun is currently less complete because it is first-order only. It uses
finite direction, finite distance, inverse-square/calibrated incident scale,
source-path transmittance, and correct phase per sample. It does not yet have
a local-source second-order cache.

Current local-source anchor artifacts:

- `tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/`
  proves default distant-source parity after source abstraction.
- `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes/` proves the
  first-order flat/local source through the observer angular sky image loop.
- `tmp/atmosphere/algorithm32_shader_lab/078-cpu-local-source-integrated-render/`
  proves local finite-source sampling inside the CPU renderer.
- `tmp/atmosphere/algorithm32_shader_lab/220-three-native-flat-local-first-order-atmosphere/`
  proves flat/local first-order behavior in the integrated Three-native pass.

## End State Of Algorithm32

The current Algorithm32 reference state is a proven POC, not yet a production
module.

Accepted:

- Experiment 032 remains the cleanroom spherical/distant baseline for sky
  radiance.
- Distant directional Sun source abstraction preserves the Experiment 032 dome
  output exactly via `atmosflat32` artifact `019`.
- Finite object transport uses:

```text
T_view(lambda) * L_object(lambda) + L_path(lambda)
```

- CPU local-source first-order transport is integrated through the source
  abstraction.
- Source, geometry, and renderer ray-length responsibilities are separated.

Not productionized yet:

- The reusable framework-free Algorithm32 module is not yet extracted.
- Cache builder APIs are designed but not production-built.
- Local-source second-order cache is not implemented.
- Direct solar-disc camera radiance is not implemented.
- Local ground bounce and sky irradiance are not implemented.
- Mars or other non-Earth profiles remain aspirational.

## End State Of The CPU Soft-Shader

The CPU soft-shader is the accepted CPU oracle for scene-input composition.

Current endpoint:

```text
tmp/atmosphere/algorithm32_shader_lab/094-cpu-unified-source-driven-soft-shader-matrix/
```

Accepted:

- It runs pixel-for-pixel over scene packets.
- It supports distant high/low cases and local offsets `0`, `45`, `90`,
  `135`, and `180`.
- It uses the shared composition:

```text
hit: final = sceneColor * T_view + L_path
sky: final = L_path
```

- It is the main CPU oracle for shader parity.
- Local source remains first-order only, matching the current CPU capability.

Role:

- Reference/oracle for GPU parity.
- Deterministic diagnostic and artifact generator.
- Bridge from original CPU renderer to shader-shaped inputs.

Non-role:

- It is not the production renderer.
- It should not become a second source of truth for Algorithm32 physics.

## End State Of The Packet GPU Postprocess Shader

The packet GPU postprocess shader is the accepted browser GPU parity proof for
the soft-shader contract.

Current endpoint:

```text
tmp/atmosphere/algorithm32_shader_lab/193-soft-shader-capability-parity-matrix/
```

Accepted:

- Distant full-image CPU/GPU parity.
- Distant lit scene composition with preserved Three shadows.
- Local full-image spectrum-mode parity for offsets `0`, `45`, `90`, `135`,
  and `180`.
- Local scene-color-composition parity for those same offsets.
- Packet-driven source behavior with no silent fallback to the default Sun.

Role:

- Proves the shader math can match the CPU soft shader.
- Proves source-driven local and distant packet paths.
- Provides useful parity and debugging evidence.

Limit:

- It is packet/replay based. It is not the final integration architecture.
- It uses RGBA8/display-domain POC transport in places where production should
  make HDR/float policy explicit.

## End State Of The Three.js Integrated GPU Shader

The Three-native integrated POC is accepted through Milestone 38.

Current endpoint:

```text
tmp/atmosphere/algorithm32_shader_lab/226-three-native-production-shape-review/
```

Current objective live-pass evidence:

```text
tmp/atmosphere/algorithm32_shader_lab/224-three-native-live-pass-soft-shader-matrix/
```

Visual inspection:

```text
tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/
```

Accepted:

- `Algorithm32AtmospherePass` renders a live Three scene into Three-owned color
  and depth targets.
- The pass reconstructs per-pixel ray/distance from a Three `DepthTexture`.
- The same pass contract handles distant/spherical and flat/local cases.
- Source config drives both Three scene lights and atmosphere uniforms.
- Scenario/debug controls exist for final, scene color, depth,
  transmittance, and path radiance.
- The pass compares against the CPU/GPU soft-shader oracle for the four core
  cases:
  - distant midday;
  - distant sunset behind camera;
  - local closest approach;
  - local `90` degree orbit.

The production target is this shape, not packet replay and not per-object
material duplication.

## Production Algorithm32 Module Requirements

Production documentation belongs under
`agents/topics/apps/flat/algorithm32/`. Production implementation code belongs
under `shared/algorithm32/`.

To support the integrated shader and testing, the production module must
provide:

1. Framework-free transport kernels.
   - No React, DOM, or Three dependencies.
   - Pure functions for density, optical depth, transmittance, source sampling
     consumption, phase, path radiance, and object composition.

2. Canonical plain-data config schemas.
   - Profile, geometry, source, numerical policy, cache plan, display policy,
     and diagnostics must serialize without hidden behavior.
   - Behavior-bearing source objects are allowed at runtime, but artifacts and
     cache keys must preserve canonical inputs.

3. Source abstraction.
   - `distant-directional-sun`.
   - `flat-local-point-sun`.
   - Future source-owned angular emission profile for flashlight/spotlight Sun.
   - No distant/local branching scattered through core transport loops.

4. Geometry abstraction.
   - Spherical shell.
   - Flat z-up slab.
   - Renderer-provided ray/segment lengths.
   - Flat sky cap or saturation policy as renderer/geometry config, not a
     hidden Algorithm32 constant.

5. Cache builder contract.
   - `describeCachePlan()` and `buildCache()` style APIs.
   - Explicit cache keys for profile, geometry, source, spectral policy,
     numerical policy, and resolution.
   - Distant second-order cache preservation.
   - Local second-order cache left as a named future plan until designed.

6. Shader contract generation.
   - Uniform/define/texture payloads derived from canonical config.
   - Shared GLSL kernels or generated shader chunks where practical.
   - Debug view support for final, scene color, depth, transmittance, path
     radiance, and selected diagnostics.

7. Validation and parity surfaces.
   - CPU direct trace comparisons.
   - CPU soft-shader packet parity.
   - GPU postprocess parity.
   - Three-native integrated pass parity.
   - Selected-pixel diagnostics and full-image summaries.
   - Fail-loud unsupported source/geometry/cache combinations.

8. Production Three integration support.
   - Render target lifecycle.
   - Depth precision policy.
   - Camera matrix/ray reconstruction contract.
   - Color-space and tone-mapping ownership.
   - HDR/float transport policy.
   - Scene-light adapter that shares source config with the atmosphere pass.

## Open Issues And Questions

- Local second-order cache: required for local-Sun multiple scattering, not yet
  designed or implemented.
- Direct solar-disc camera radiance: visible Sun body/radiance is separate
  from atmosphere scattering and remains future work.
- Local ground bounce and sky irradiance: surface lighting helpers remain
  optional and separate from view-path atmospheric transfer.
- HDR/float production transport: current POC uses RGBA8/display-domain paths
  in places; production needs explicit precision and color policy.
- Flat sky cap/saturation policy: accepted POC has a renderer-owned cap, but
  production must choose a durable policy for near-horizontal flat rays.
- Cache layout for flat/local Sun: direct first-order is proven; optimized LUT
  coordinates are not settled.
- Brightness calibration: local closest approach is calibrated to distant high
  Sun incident scale in the POC; production needs named user-facing policies.
- Three light intensity mapping: Three light units and Algorithm32 spectral
  irradiance are not the same system. The adapter needs a stable calibration
  policy.
- Measured real-world validation: current work proves internal transport
  behavior and parity, not absolute outdoor color accuracy against measured
  spectra/aerosols/materials.
- Mars/non-Earth profiles: architecture should allow them later, but no
  constants, validation plan, or preset exists yet.
- Flashlight local Sun: if implemented, it belongs in the source abstraction as
  an angular emission profile with explicit beam-axis and energy policy.

## Suggested Immediate Production Followups

1. Create the production Algorithm32 module boundary.
   - Start framework-free.
   - Do not copy the lab artifact writers as module code.

2. Extract the accepted core transport kernels.
   - Preserve Experiment 032 spherical/distant behavior first.
   - Add source and geometry adapters without changing baseline output.

3. Define canonical config types.
   - Profile, source, geometry, numerical policy, cache plan, display policy,
     and diagnostics.
   - Keep plain-data serialization as the cache/artifact source of truth.

4. Promote source adapters.
   - Default distant directional Sun.
   - Flat/local point Sun with accepted calibration and source-sample
     diagnostics.

5. Promote geometry adapters.
   - Spherical shell.
   - Flat z-up slab.
   - Renderer-owned sky cap/segment-length policy.

6. Promote the CPU oracle surfaces.
   - Direct trace API.
   - Soft-shader CPU postprocess API.
   - Selected-pixel and full-image comparison helpers.

7. Promote the Three-native pass shape.
   - Convert lab `Algorithm32AtmospherePass` into a production-facing pass or
     service boundary.
   - Keep normal rendering on live Three color/depth targets.
   - Keep packets as validation capture only.

8. Establish production parity gates.
   - Distant default regression.
   - Distant high/low scene pass.
   - Local closest and local `90` first-order pass.
   - Debug views and fail-loud unsupported combinations.

9. Decide HDR/depth/color policy before visual tuning.
   - Depth near/far precision.
   - Render target type.
   - Tone mapping and output color space.
   - Debug readback format.

10. Defer optimization until parity is stable.
    - Start with direct first-order local evaluation.
    - Add LUTs/cache acceleration only with named error evidence.

## Documents By Role

Canonical current reference:

- This document.

Current detailed plan and evidence:

- `evidence/current/README.md`
- `algorithm32-shader-iteration-plan.md`
- `scripts/flat/algorithm32-shader-lab/README.md`

Production design inputs:

- `algorithm32-module-design.md`
- `reference-to-shader-goal.md`
- `production-flat-shader-differences.md`
- `object-color-transport.md`
- `objective-success-criteria.md`

Accepted source-abstraction evidence:

- `atmosflat32-source-abstraction-prompt.md`
- `experiment-032-algorithm.md`

Closed or historical lanes:

- `environment-object-color-closeout.md`
- `environment-object-color-prompt.md`
- `environment-experiment-preflight-spec.md`
- `environment-experiment-run-shape.md`
- `object-transport-experiment-plan.md`
- older shader-lab subjective progress artifacts

These closed lanes may be cited as evidence, but they should not drive new
numbered experiment loops unless the user explicitly reopens them.
