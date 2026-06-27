# Three-Native Production Shape Review

Status: accepted.

Milestone 38 closes the Three-native `Algorithm32AtmospherePass` runway. The
accepted POC path is:

```text
Three scene + camera + Three lights
  -> Three-owned color render target + DepthTexture
  -> Algorithm32AtmospherePass fullscreen ShaderMaterial
  -> final camera view
```

JSON scene packets and Raycaster captures remain validation artifacts only.
They are useful for CPU soft-shader oracle comparisons, but they are not the
normal render input for production.

## Evidence Chain

- M30: `218-three-native-atmosphere-pass-shell`
- M31: `212-three-native-depth-to-ray-contract`
- M32: `216-three-native-distant-first-order-atmosphere`
- M33: `217-three-native-live-scene-camera-controls`
- M34: `220-three-native-flat-local-first-order-atmosphere`
- M35: `222-three-native-unified-source-geometry-adapter`
- M36: `224-three-native-live-pass-soft-shader-matrix`
- M37: `225-three-native-scenario-controls-poc`
- M38: `226-three-native-production-shape-review`

## Keep

- The Three-native pass shape: render scene color and depth in the active Three
  renderer, then apply Algorithm32 atmosphere in a fullscreen pass.
- The `setConfig({ source, geometry, atmosphere, display })` contract.
- Source adapters that drive both Three lights and atmosphere uniforms from the
  same source config.
- Geometry adapters that own camera/world conversion and sky/no-hit distance
  policy.
- The CPU soft-shader oracle matrix as the validation reference.

## Rewrite

- Move lab inline GLSL strings into production shader modules with stable
  uniforms and feature gates.
- Replace lab-only controls with app-owned state and UI, while preserving the
  same scenario/debug concepts.
- Convert artifact diagnostics into a smaller production debug surface.
- Promote render-target and depth handling into a reusable pass lifecycle with
  explicit resize, dispose, color-space, and precision policies.

## Discard

- Packet replay as the renderer architecture.
- Standalone raw-WebGL atmosphere renderers as the target integration.
- Per-object material duplication as the primary atmosphere strategy.
- Hidden default-Sun fallbacks.

## Production Assumptions

Safe seed assumptions:

- The normal input is live scene color plus live depth.
- The source config owns both Three light setup and atmosphere source uniforms.
- Unsupported source or geometry combinations fail loudly.
- The pass can expose debug views for final, scene color, depth,
  transmittance, and path radiance.

Assumptions that must become configuration:

- Depth near/far planes and precision policy.
- Flat sky ray limit and top altitude.
- Source brightness calibration.
- Display color-space, tone mapping, and HDR/float transport.
- Debug view selection.

## Deferred Physics

The current pass proves integration shape and first-order local-source support.
The following remain future physics/model work, not unresolved Three shader
integration:

- Local second-order cache.
- Direct local solar-disc camera radiance.
- Local ground bounce.
- Mars and other non-Earth atmosphere presets.
- Production HDR/float transport beyond the current RGBA8 POC readback path.
