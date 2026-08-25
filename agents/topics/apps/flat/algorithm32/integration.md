# Algorithm32 App Integration Guide

This guide is the prescriptive production integration path for using
Algorithm32 inside a new React app. It assumes you have access to the
Algorithm32 production API, Three.js, and `@react-three/fiber`. It does not
assume a prebuilt app structure.

Algorithm32 is a postprocess atmosphere composer, not a scene replacement. The
app still owns its renderer, camera controls, visible meshes, materials,
shadows, UI state, and frame loop. Algorithm32 owns the atmospheric transport
config, incident-radiance cache preparation, shader assembly, scene
depth/hit capture, and final composition over the scene color produced by the
app's normal render.

The user rolled back record-067's typed celestial/CPU-frame production
promotion. No physical Sun/Moon/star browser feature currently exists in the
production package. The selected successor is a camera-independent,
ray-queryable cache of atmosphere-transported celestial contribution fields,
but that surface is design-only and must not be added to app integration until
its producer, resource lifecycle, shader query, and fresh parity proof exist.

## Integration Contract

Use this shape for every production app integration:

1. Create or select a Three scene that contains the opaque endpoint surfaces
   Algorithm32 should composite through atmosphere.
2. Create an `EffectComposer` for the app renderer and add a `RenderPass` for
   that scene and camera as the first pass.
3. Create a configured `Algorithm32` facade with concrete `lightSource`,
   `atmosphere`, `geometry`, `color`, `spectral`, `execution`, and `shader`
   entries.
4. Prepare mutable shader binding values for the live camera matrices,
   camera position in Algorithm32 model meters, and scene termination.
5. Await `algorithm32.setupShader(...)`, passing `THREE`, the existing
   composer, scene, camera, viewport, scene-to-meter scale, binding values,
   and logger. Pass `sceneDepthMaxMeters` only when intentionally overriding
   the geometry-owned default.
6. In every frame, update camera/model-space bindings, update any owner-created
   source-light objects or material uniforms from the same app state, then call
   `composer.render(delta)`.
7. On resize, update the renderer/composer size. The Three `EffectComposer`
   calls `setSize(...)` on each pass; a custom composer must do the same for
   Algorithm32's installed capture/runtime passes.
8. On Algorithm32 config replacement, prefer the returned shader handle's
   awaited `setConfig(nextConfig)`. If the scene, composer, or camera object
   changes, dispose and run setup again.
9. On teardown, dispose the shader handle, the facade, the composer, and any
   render targets/materials the app created.

The minimum pass order is:

```text
EffectComposer
  -> RenderPass(scene, camera)
  -> SceneInputCapture       installed by setupShader when depth/hit are needed
  -> ShaderRuntimePass       installed by setupShader
```

The runtime pass reads the composer `readBuffer.texture` as scene color,
reads `SceneInputCapture`'s RGB24 packed scene-depth texture and hit mask, and
writes the final atmosphere-composited fullscreen output.

### Planned celestial contribution-cache extension

This is not a currently callable API. The selected extension preserves the
existing composer shape and places its awaited resource lifecycle behind the
existing Algorithm32 setup/update handle. The app will continue to supply
camera, viewport, and scene inputs; it will not pack textures, calculate fields,
or author celestial shader source.

[CelestialContributionCache Design](celestial-contribution-cache-design.md)
owns the field, runtime, invalidation, qualification, and failure contract. The
exact app configuration/provider packet remains open until qualification
passes. XA-G12 becomes applicable when the selected visible-celestial shader
path is implemented and requires a fresh GPU/browser proof.

## Ownership Boundaries

Keep the ownership split crisp:

- The app owns renderer setup, camera controls, scene graph placement and
  lifecycle, app-authored endpoint materials, shadows, overlays, and the frame
  loop.
- `Algorithm32` owns production configuration validation, shared model
  snapshots, CPU/reference evaluation for validation, awaited shader setup,
  shader-handle config refresh, diagnostics, and disposal.
- `ShaderBuilder` owns shader descriptor synthesis, contribution collection,
  cache texture preparation, required binding validation, pass installation,
  and cleanup.
- `SceneInputCapture` owns renderer-produced scene distance and hit mask
  capture. It does not know material identity or object IDs in the first
  production contract.
- Geometry models own scene-frame interpretation, camera/model ray conversion,
  atmosphere coordinates, source-relative coordinates, path termination, cache
  spatial domains, and any Algorithm32-required endpoint objects they expose
  through `createThreeEndpointObjects(...)`.
- Light-source models own source behavior, incident-radiance cache families,
  and any renderer-lighting helpers they expose through
  `addSceneLighting(...)`.
- Color/display owns spectral-to-display conversion, inverse tone mapping for
  captured endpoint color, and final RGB composition policy.
- The planned `CelestialContributionCache` owns derived transported fields;
  the canonical design owns its boundary, and the app owns neither field
  construction nor packing.

Do not move renderer state, camera controls, app scene ownership, or
non-Algorithm32 content into Algorithm32. Do not make the app build cache
textures, shader source, scene-depth textures, or Algorithm32 pass internals.
Do not hand-build Algorithm32 ground or source-light helpers in application
screens when the configured geometry or light-source owner exposes a factory
for those objects.

## Algorithm32 Config

Create one Algorithm32 config per independent simulation view. The facade
receives concrete model instances; do not pass a broad profile description and
expect Algorithm32 to infer models.

The config shape is:

```js
{
  lightSource,
  atmosphere,
  geometry,
  color,
  spectral,
  execution,
  shader,
}
```

Until the runtime shader performance work resumes, app integrations should
default interactive rendering to the promoted `fast` quality profile and treat
`ideal` as the reference/comparison profile.

Use a distant Sun with spherical geometry for a globe-like scene:

```js
import { Algorithm32 } from 'algorithm32/production/Algorithm32.js';
import CanonicalAtmosphere from 'algorithm32/production/atmospheres/CanonicalAtmosphere.js';
import BrunetonColorDisplayModel from 'algorithm32/production/color/BrunetonColorDisplayModel.js';
import {
  CANONICAL_ATMOSPHERE_CONSTANTS,
  CANONICAL_SPECTRAL_BASIS,
  CANONICAL_SPECTRAL_CHANNELS,
  FIGURE1_DISPLAY_CONSTANTS,
  shaderQualityProfileById,
} from 'algorithm32/production/constants/Algorithm32CanonicalData.js';
import SphericalEarthGeometry from 'algorithm32/production/geometries/SphericalEarthGeometry.js';
import DistantSunLightSource from 'algorithm32/production/light-sources/DistantSunLightSource.js';

const DEFAULT_SUN_ANGULAR_RADIUS_RADIANS = 0.004675;
const DEFAULT_SHADER_QUALITY_PROFILE = shaderQualityProfileById('fast');

export function createSphericalDistantSunConfig({
  bottomRadiusMeters = CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
  topRadiusMeters = CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
  observerHeightMeters = 2,
  observerUpDirection = [0, 1, 0],
  directionToLight = [0, 1, 0],
  sceneDepthMaxMeters = null,
  metersPerSceneUnit = 1000,
} = {}) {
  const controls = DEFAULT_SHADER_QUALITY_PROFILE.numericalControls;
  const geometry = new SphericalEarthGeometry({
    bottomRadiusMeters,
    topRadiusMeters,
    observerHeightMeters,
    observerUpDirection,
    sceneFrame: { kind: 'model-space' },
    sourceDirection: directionToLight,
    cacheAltitudeBinCount: controls.incidentAltitudeBinCount,
    sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
  });
  const shader = {
    metersPerSceneUnit,
    distanceMultiplier: metersPerSceneUnit,
  };

  if (sceneDepthMaxMeters !== null) {
    shader.sceneDepthMaxMeters = sceneDepthMaxMeters;
  }

  return {
    lightSource: new DistantSunLightSource({
      directionToLight,
      angularRadiusRadians: DEFAULT_SUN_ANGULAR_RADIUS_RADIANS,
      spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
      cacheAltitudeBinCount: controls.incidentAltitudeBinCount,
      cacheDirectionCount: controls.incidentDirectionCount,
      cacheAltitudeLookup:
        DEFAULT_SHADER_QUALITY_PROFILE.cacheOptimization?.altitudeLookup ?? null,
    }),
    atmosphere: new CanonicalAtmosphere({
      constants: CANONICAL_ATMOSPHERE_CONSTANTS,
      spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    }),
    geometry,
    color: new BrunetonColorDisplayModel({
      displayConstants: FIGURE1_DISPLAY_CONSTANTS,
    }),
    spectral: CANONICAL_SPECTRAL_BASIS,
    execution: {
      pathIntervalCount: controls.pathIntervalCount,
      sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
      incidentDirectionCount: controls.incidentDirectionCount,
      incidentAltitudeBinCount: controls.incidentAltitudeBinCount,
      cachePathIntervalCount: controls.pathIntervalCount,
      pathSampleDistribution:
        DEFAULT_SHADER_QUALITY_PROFILE.transportOptimization?.pathSampleDistribution ?? null,
    },
    shader,
  };
}
```

`CANONICAL_SPECTRAL_CHANNELS` remains the current numerical solar owner. Do not
copy those values into app config, a visible-disk mesh, a contribution-cache
payload, or another shader constant. The future cache producer must derive its
visible-Sun contribution from canonical source facts without creating a second
owner. LocalSun retains its existing separate contract.

Use a local finite source with flat geometry for a local flat scene:

```js
import CanonicalAtmosphere from 'algorithm32/production/atmospheres/CanonicalAtmosphere.js';
import BrunetonColorDisplayModel from 'algorithm32/production/color/BrunetonColorDisplayModel.js';
import {
  CANONICAL_ATMOSPHERE_CONSTANTS,
  CANONICAL_SPECTRAL_BASIS,
  CANONICAL_SPECTRAL_CHANNELS,
  FIGURE1_DISPLAY_CONSTANTS,
  shaderQualityProfileById,
} from 'algorithm32/production/constants/Algorithm32CanonicalData.js';
import FlatEarthGeometry from 'algorithm32/production/geometries/FlatEarthGeometry.js';
import LocalSunLightSource from 'algorithm32/production/light-sources/LocalSunLightSource.js';

const DEFAULT_SHADER_QUALITY_PROFILE = shaderQualityProfileById('fast');

export function createFlatLocalSunConfig({
  observerPositionMeters = [0, 0, 2],
  sourcePositionMeters = [0, 100000, 100000],
  topAltitudeMeters = 60000,
  sceneSkyRayLimitMeters = 500000,
  sceneDepthMaxMeters = null,
  metersPerSceneUnit = 1000,
  sourceRadiusMeters = 1000,
  referenceDistanceMeters = 100000,
  referenceSpectralIncidentScale = 1,
  cacheZBinsMeters = [0, 1000, 4000, 10000, 25000, 60000],
  cacheRhoBinsMeters = [0, 10000, 50000, 100000, 250000],
} = {}) {
  const controls = DEFAULT_SHADER_QUALITY_PROFILE.numericalControls;
  const geometry = new FlatEarthGeometry({
    observerPositionMeters,
    sourcePositionMeters,
    topAltitudeMeters,
    sceneSkyRayLimitMeters,
    sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
    cacheZBinsMeters,
    cacheRhoBinsMeters,
  });
  const shader = {
    metersPerSceneUnit,
    distanceMultiplier: metersPerSceneUnit,
  };

  if (sceneDepthMaxMeters !== null) {
    shader.sceneDepthMaxMeters = sceneDepthMaxMeters;
  }

  return {
    lightSource: new LocalSunLightSource({
      sourceKey: 'local-sun',
      spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
      referenceDistanceMeters,
      referenceSpectralIncidentScale,
      radiusMeters: sourceRadiusMeters,
      distanceFalloff: true,
      cacheZBinsMeters,
      cacheRhoBinsMeters,
      cacheDirectionCount: controls.incidentDirectionCount,
    }),
    atmosphere: new CanonicalAtmosphere({
      constants: CANONICAL_ATMOSPHERE_CONSTANTS,
      spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    }),
    geometry,
    color: new BrunetonColorDisplayModel({
      displayConstants: FIGURE1_DISPLAY_CONSTANTS,
    }),
    spectral: CANONICAL_SPECTRAL_BASIS,
    execution: {
      pathIntervalCount: controls.pathIntervalCount,
      sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
      incidentDirectionCount: controls.incidentDirectionCount,
      incidentAltitudeBinCount: controls.incidentAltitudeBinCount,
      cachePathIntervalCount: controls.pathIntervalCount,
      pathSampleDistribution:
        DEFAULT_SHADER_QUALITY_PROFILE.transportOptimization?.pathSampleDistribution ?? null,
    },
    shader,
  };
}

```

Export `createAlgorithm32(config)` once from the same module if you include
both config factories:

```js
export function createAlgorithm32(config) {
  return new Algorithm32(config);
}
```

Pick one factory, or write your own using the same facade shape. If your Three
scene uses model-space coordinates, multiply scene units by
`metersPerSceneUnit` to get Algorithm32 meters. If your Three scene uses a
different basis, define that conversion once and reuse it for camera bindings,
ground placement, source placement, and lights.

## Runtime Bindings

Algorithm32 shader setup needs mutable values for the live camera and scene
scale. Create them once per setup and mutate them each frame.

```js
export function createAlgorithm32Bindings(THREE) {
  return {
    'geometry.inverseProjectionMatrix': new THREE.Matrix4(),
    'geometry.inverseViewMatrix': new THREE.Matrix4(),
    'geometry.cameraWorldPositionMeters': new THREE.Vector3(),
    'geometry.sceneTerminationMeters': 0,
  };
}

export function modelSpacePositionToMeters(position, metersPerSceneUnit) {
  return [
    position.x * metersPerSceneUnit,
    position.y * metersPerSceneUnit,
    position.z * metersPerSceneUnit,
  ];
}

export function updateAlgorithm32CameraBindings({
  bindings,
  camera,
  cameraWorldPositionToMeters,
}) {
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  bindings['geometry.inverseProjectionMatrix'].copy(camera.projectionMatrixInverse);
  bindings['geometry.inverseViewMatrix'].copy(camera.matrixWorld);

  const positionMeters = cameraWorldPositionToMeters(camera.position);
  bindings['geometry.cameraWorldPositionMeters'].set(
    positionMeters[0],
    positionMeters[1],
    positionMeters[2],
  );
}
```

If the Three scene already uses Algorithm32 model-space coordinates, the
`modelSpacePositionToMeters(...)` helper is enough. If not, replace it with an
explicit app-specific mapper. Keep that mapper as the single source of truth
for camera bindings, source placement, and ground scale.

## Shader Setup Request

`algorithm32.setupShader(...)` is the handoff from app-owned Three state to
Algorithm32-owned runtime resources. It does not create the app renderer,
camera, scene, or composer. It attaches Algorithm32 passes and GPU resources to
the objects the app already owns.

Use this shape:

```js
const shaderHandle = await algorithm32.setupShader({
  THREE,
  composer,
  scene,
  camera,
  viewportPixels: [width, height],
  metersPerSceneUnit,
  distanceMultiplier: metersPerSceneUnit,
  bindingValues,
  logger: console,
  performanceCallback: undefined,
});
```

### `THREE`

Pass the same Three.js namespace object used by the renderer and app scene:

```js
import * as THREE from 'three';
```

Algorithm32 uses this namespace to construct runtime objects such as cache
textures, render targets, vectors, override materials, and the fullscreen
`RawShaderMaterial` pass. Pass the namespace explicitly; do not rely on a
global `THREE`.

### `composer`

Pass the app's final `EffectComposer` for this view. The composer should
already contain the normal solid-scene `RenderPass(scene, camera)` before
setup runs.

Algorithm32 uses `composer.addPass(...)` to install:

1. `SceneInputCapture`, when the active shader needs renderer-produced depth
   or hit-mask textures.
2. `ShaderRuntimePass`, the fullscreen atmosphere composition pass.

The returned shader handle removes and disposes those Algorithm32-owned passes
on teardown or compatible config refresh. On resize, the app still calls
`composer.setSize(width, height)`; the composer forwards that size to installed
Algorithm32 passes.

### `scene`

Pass the Three scene that contains the solid endpoint objects Algorithm32
should capture. In React/R3F, this is usually a dedicated composer scene that
receives portaled children.

`SceneInputCapture` renders this scene with override materials to produce:

- packed camera-hit distance in `runtime.sceneDepthTexture`
- explicit hit coverage in `runtime.sceneHitTexture`

Objects with `object.userData.algorithm32SceneInput === false` are hidden only
for the capture pass. Untagged visible objects are captured.

Scene input is pixel-exact data. Production depth and hit render targets use
nearest filtering with mipmaps disabled, and the runtime shader samples scene
color, scene depth, and hit mask through integer-pixel lookup. Do not add
app-side blur, interpolation, color-ID textures, or material-ID textures to
solve atmosphere/object edge mismatch unless a later Algorithm32 contract
explicitly adds that semantic input.

### `camera`

Pass the same camera used by the solid `RenderPass`. `SceneInputCapture` uses
this camera when rendering depth and hit-mask targets.

The runtime shader does not read the camera object directly for view-ray
math. It reads camera matrices and model-space camera position from
`bindingValues`, so the app must update those bindings before each
`composer.render(...)`. If the camera object itself changes, dispose the old
shader handle and run setup again.

### `viewportPixels`

Pass the initial render size as `[width, height]` in physical render pixels.
Algorithm32 uses it to size capture render targets and initialize viewport
uniforms. The builder can infer a fallback from composer/render-target
surfaces, but explicit pixels make setup deterministic.

On resize, update the renderer and composer. Do not call `setupShader(...)`
again only because the viewport changed.

### `sceneDepthMaxMeters`

Let the configured geometry provide the default maximum endpoint distance, in
Algorithm32 meters, that the scene depth capture should represent. The
production `ShaderBuilder` asks `geometry.resolveSceneDepthMaxMeters(...)`
when setup/config does not supply an explicit override. `SceneInputCapture`
encodes:

```text
normalizedDepth = cameraDistanceSceneUnits * distanceMultiplier / sceneDepthMaxMeters
```

into RGB24. The runtime shader decodes that normalized value and multiplies it
by `sceneDepthMaxMeters` to recover the atmosphere ray termination distance.

Override this value only when the app adds solid endpoint objects outside the
geometry-owned endpoint range. The override must still be chosen from intended
opaque endpoint distances, not from astronomical decorations or a huge camera
`far` plane. Too small clips valid endpoints; too large wastes RGB24 precision
and can create horizon/edge artifacts.

### `metersPerSceneUnit`

Pass the uniform scale from Three scene units to Algorithm32 meters when your
scene has a simple scale relationship:

```text
meters = sceneUnits * metersPerSceneUnit
```

Use the same value for:

- geometry endpoint-object factory requests
- camera model-position conversion
- source scene-position conversion
- default depth-capture distance scaling

If your scene basis is not a simple uniform scale, still define one explicit
mapper for camera/source/object positions and pass `distanceMultiplier`
separately for depth capture.

### `distanceMultiplier`

Pass the exact multiplier that converts renderer world-unit distances into
Algorithm32 meters for `SceneInputCapture`. In most integrations it is the
same number as `metersPerSceneUnit`.

Algorithm32 resolves capture scale in this order:

```text
setup.distanceMultiplier
setup.metersPerSceneUnit
config.shader.distanceMultiplier
config.shader.metersPerSceneUnit
1
```

Use an explicit `distanceMultiplier` when scene positions and renderer
distances are not identical to your model-space conversion.

### `bindingValues`

Pass a record of setup-time shader values keyed by contribution `valueKey`.
The common live camera bindings are:

```js
{
  'geometry.inverseProjectionMatrix': new THREE.Matrix4(),
  'geometry.inverseViewMatrix': new THREE.Matrix4(),
  'geometry.cameraWorldPositionMeters': new THREE.Vector3(),
  'geometry.sceneTerminationMeters': 0,
}
```

`ShaderBuilder` uses `bindingValues` during setup to satisfy required uniforms
and textures. The runtime pass stores those values in Three uniform objects.
For live values, pass mutable objects such as `Matrix4`, `Vector2`, or
`Vector3` and mutate them in place each frame. Reassigning a new value into
the `bindingValues` record after setup does not replace the already-created
uniform value.

Required dynamic updates before each render usually include:

- `geometry.inverseProjectionMatrix`
- `geometry.inverseViewMatrix`
- `geometry.cameraWorldPositionMeters`

Static scalar policy values, such as `geometry.sceneDepthMaxMeters`, should be
treated as setup/config values. When setup/config omits
`sceneDepthMaxMeters`, `ShaderBuilder` binds the geometry-resolved cap for the
runtime shader. If the app intentionally overrides `sceneDepthMaxMeters`, pass
that same override in setup/config and, for low-level custom assembly paths,
in `'geometry.sceneDepthMaxMeters'`.

### `logger`

Pass a console-compatible object, usually `console`. Setup errors still reject
the `setupShader(...)` promise. The logger is used for non-fatal runtime pass
warnings after setup, such as a render failure where Algorithm32 can keep the
previous composer state or no-op safely.

### `performanceCallback`

Pass a callback only while actively collecting shader performance data:

```js
const shaderHandle = await algorithm32.setupShader({
  // ...
  performanceCallback(sample) {
    // sample.event: 'cpu-submit', 'gpu-elapsed', or 'gpu-query-error'
    // sample.passName: 'algorithm32-runtime-shader',
    //                  'algorithm32-scene-depth-capture',
    //                  'algorithm32-scene-hit-capture'
  },
  performanceSampleIntervalFrames: 120,
  performanceMaxPendingQueries: 1,
});
```

When no callback is supplied, Algorithm32 does not create pass-local GPU timer
query helpers. When supplied, each timed pass emits an immediate CPU submit
sample and, when WebGL2 timer queries are available, a later GPU elapsed
sample. GPU elapsed values are per measured pass invocation, not cumulative.
Use `performanceSampleIntervalFrames` to sample less often during live
rendering, and keep `performanceMaxPendingQueries` low so slow GPU query
readback skips samples instead of accumulating unresolved work.

For stable benchmark runs, use a fixed viewport and device pixel ratio, record
the active quality profile, and compare milliseconds-per-megapixel as well as
raw milliseconds. For day-to-day app work, leave the callback unset.

## React/R3F Composer

React should wrap the same composer contract, not create a separate per-object
atmosphere material. Use a reusable Algorithm32 wrapper that creates a
separate scene for the solid endpoint pass, mounts required owner-created
geometry/source objects into that scene, portals optional app-authored children
there, and takes over the R3F render loop with the Algorithm32 composer.

Ship the reusable React pieces beside Algorithm32, not inside an app feature.
In this repo the public React/R3F entry is
`shared/algorithm32/production/react/index.js`, backed by:

- `shared/algorithm32/production/react/Algorithm32AtmosphereComposer.jsx`:
  class component that
  owns the `EffectComposer`, `RenderPass`, Algorithm32 facade, shader handle,
  binding values, required geometry/source Three objects, setup, resize,
  frame render, and teardown.
- `shared/algorithm32/production/react/Algorithm32R3FAtmosphereComposer.jsx`:
  very small function bridge that reads R3F `gl`, `camera`, `size`, and
  `useFrame(...)`, then delegates to the class component. This is the only
  hook-only layer.
- `shared/algorithm32/production/react/Algorithm32ReactUtils.js`: shared
  binding, viewport, required-object, and render-target helpers.

An app-specific composer should usually be a thin class component that receives
or creates a stable Algorithm32 config and supplies scene-to-model binding plus
required-object factory-request facts. Children are optional ordinary Three/R3F
content. The wrapper owns the Algorithm32-required ground and source-light
objects by calling the configured geometry/light-source owners.

```jsx
import React from 'react';
import * as THREE from 'three';

import {
  Algorithm32R3FAtmosphereComposer,
} from './algorithm32/production/react/index.js';
import {
  createAlgorithm32Bindings,
  createAlgorithm32,
  updateAlgorithm32CameraBindings,
} from './algorithm32-app-adapter.js';

export default class AppAlgorithm32Composer extends React.Component {
  constructor(props) {
    super(props);

    this._createBindingValues = this._createBindingValues.bind(this);
    this._createGeometryEndpointRequest = this._createGeometryEndpointRequest.bind(this);
    this._createLightingRequest = this._createLightingRequest.bind(this);
    this._updateBindingValues = this._updateBindingValues.bind(this);
  }

  _createBindingValues({ THREE: threeNamespace }) {
    return createAlgorithm32Bindings(threeNamespace);
  }

  _createGeometryEndpointRequest() {
    return {
      visualMaterialLighting: 'lambert',
      name: 'app-algorithm32-ground',
    };
  }

  _createLightingRequest({ config }) {
    return createAlgorithm32LightingRequest({
      config,
      scene: this.props.scene,
      metersPerSceneUnit: this.props.metersPerSceneUnit,
    });
  }

  _updateBindingValues({ bindingValues, camera }) {
    updateAlgorithm32CameraBindings({
      bindings: bindingValues,
      camera,
      config: this.props.config,
      scene: this.props.scene,
      metersPerSceneUnit: this.props.metersPerSceneUnit,
    });
  }

  render() {
    const {
      background = '#060912',
      children,
      config,
      enabled = true,
      metersPerSceneUnit,
    } = this.props;

    return (
      <Algorithm32R3FAtmosphereComposer
        background={background}
        config={enabled ? config : null}
        createAlgorithm32={createAlgorithm32}
        createBindingValues={this._createBindingValues}
        geometryEndpointRequest={this._createGeometryEndpointRequest}
        lightingRequest={this._createLightingRequest}
        enabled={enabled}
        metersPerSceneUnit={metersPerSceneUnit}
        requiredObjectsKey={this.props.scene}
        updateBindingValues={this._updateBindingValues}
      >
        {children}
      </Algorithm32R3FAtmosphereComposer>
    );
  }
}
```

Important React details:

- Keep `config` stable. Recreating it on every React render will tear down and
  rebuild the Algorithm32 shader chain. In class components, cache the config
  by the scene/config input identity or have the owner pass a stable config.
- The reusable R3F bridge uses positive `useFrame` priority and calls the
  class component's frame method. Once ready, the composer should be the final
  render path for this view.
- Fallback rendering is intentional while setup is pending or failed. Because
  positive `useFrame` priority takes over R3F's automatic renderer, the bridge
  explicitly renders the wrapper's solid scene whenever the Algorithm32
  composer does not render a frame. This keeps abstraction-created ground and
  source-light objects visible during setup and setup-error fallback.
- Use the normal R3F frame loop for the smallest integration. A demand-driven
  frame loop, canvas markers, render-scale caps, and app-specific diagnostics
  are optional app-layer additions, not part of the base wrapper contract.
- If the camera, composer, scene, renderer, or WebGL context changes, dispose
  and run setup again. The reusable wrapper does this for the handles it owns.
- If only camera position changes, mutate bindings each frame. Do not rebuild
  config for camera motion.
- Pass `sceneDepthMaxMeters` to the reusable wrapper only when deliberately
  overriding the geometry-owned cap for app-authored endpoint objects.

## Required Scene Objects

Algorithm32 does not take over the whole visible world for the app. The app
may add ordinary endpoint meshes to the composer scene, but
Algorithm32-specific ground and source-light helpers should come from the
configured owners and be mounted by the reusable wrapper. The app-specific
composer supplies request facts; the base component calls the owner factories:

```js
const requiredObjects = createAlgorithm32RequiredThreeObjects({
  THREE,
  config,
  metersPerSceneUnit,
  geometryEndpointRequest: {
    visualMaterialLighting: 'lambert',
    name: 'app-algorithm32-ground',
    shadow: {
      enabled: true,
    },
  },
  lightingRequest: {
    sourceRelativePosition,
    sourcePositionSceneUnits,
    observerScenePositionUnits,
  },
});
```

The production `SphericalEarthGeometry`, `FlatEarthGeometry`,
`DistantSunLightSource`, and `LocalSunLightSource` models expose these
factories. If you supply a custom geometry or source model, put the equivalent
factory on that model or on a narrow Algorithm32-boundary adapter; do not
duplicate Algorithm32 ground/light construction inside page components. The
wrapper adds `requiredObjects.objects` to its solid scene and disposes them
when the config or `requiredObjectsKey` changes.

At minimum, a real integration needs:

- Geometry-owned renderable endpoint objects, usually returned as
  `requiredObjects.endpointObjects.visualObjects`, that terminate atmosphere rays and
  contribute endpoint scene color.
- Optional geometry-owned `requiredObjects.endpointObjects.raycastObjects`
  registered with validation or raycast tooling when your integration uses
  exact analytical hit tests.
- Source-owned renderer lighting helpers, usually returned as
  `requiredObjects.lightingObjects.lights` plus optional
  `requiredObjects.lightingObjects.sceneObjects`, for endpoint shading.
- Any app-authored solid endpoint meshes whose color should be
  attenuated/composited through atmosphere.

It may also include decorative or overlay objects, but those should usually be
excluded from Algorithm32 scene input.

### Ground

Ground is required for a horizon/terrain/surface render. Ask the configured
geometry for its endpoint objects and add the returned renderable objects to
the composer scene. Algorithm32 uses renderer-produced scene depth and hit
masks, so a ground surface that should terminate rays must exist as actual
renderer geometry in that scene. The default owner-created ground material is
a grass-toned matte green (`#4fa33d`); pass `visualMaterialColor` or
`visualMaterialDisplayRgba` to the endpoint-object request when an app needs a
different surface color.

If source shadows are enabled and ground should display them, enable shadow
receiving on the geometry-owned visual endpoint through the same endpoint
object request:

```js
geometry.createThreeEndpointObjects({
  metersPerSceneUnit,
  visualMaterialLighting: 'lambert',
  shadow: {
    enabled: true,
    receiveShadow: true,
  },
});
```

This sets `receiveShadow` on the renderer-visible ground object and records
shadow receiver metadata. It does not configure the light, renderer shadow map,
or app-authored shadow-casting objects; those remain source/app renderer setup.

For spherical/globe integrations:

- Use `SphericalEarthGeometry.createThreeEndpointObjects(...)` to create the
  ground endpoint objects. The returned visual object matches the configured
  `bottomRadiusMeters` after applying `metersPerSceneUnit`.
- The default spherical visual receiver is a full `SphereGeometry`. For
  near-horizon globe views where the visible raster/shadow receiver needs the
  reconciliation-style local ground patch, pass
  `groundVisualMesh: { kind: 'local-spherical-patch' }` plus optional
  `widthSegments`, `heightSegments`, `xExtentSceneUnits`, `zMinSceneUnits`, and
  `zMaxSceneUnits` overrides. This changes the returned visual receiver, which
  is what renderer-produced depth/hit capture sees in the live shader path;
  the geometry-owned exact sphere raycast object remains available for
  validation and raycast tooling.
- If the Three scene is planet-centered/model-space, configure
  `SphericalEarthGeometry` with `sceneFrame: { kind: 'model-space' }`.
- For app-authored ground-relative objects in a spherical scene, ask geometry
  to normalize horizontal offsets and altitude before placing meshes or
  passing bounding points to the scene-depth cap. Use
  `geometry.mapGroundOffsetToScenePoint([x, z], { metersPerSceneUnit, heightAboveGroundSceneUnits })`
  so the geometry projects the offset onto the curved surface and applies
  height along the local surface normal.
- Preserve the geometry-owned endpoint tags.
- Keep the depth cap on local horizon/object scale, not star/Sun/camera-far
  scale.

For flat/local integrations:

- Use `FlatEarthGeometry.createThreeEndpointObjects(...)` to create the
  floor/terrain endpoint objects in the same observer-local basis the flat
  geometry uses.
- Preserve the geometry-owned elevation, scene-to-meter scale, and endpoint
  tags.
- Use a depth cap large enough for expected local scene hits, but not so large
  that RGB24 distance precision is wasted.

Recommended user data for app-authored endpoint objects or adapter-created
objects:

```js
export const ALGORITHM32_GROUND_INPUT = Object.freeze({
  algorithm32SceneInput: true,
  endpointKind: 'geometry-ground-boundary',
  metersPerSceneUnit: 1000,
});
```

The current `SceneInputCapture` only filters on
`userData.algorithm32SceneInput === false`; untagged visible meshes are still
captured. Use explicit positive tags anyway so scene ownership is readable and
future adapters can distinguish ground from ordinary solids.

### Solid Endpoint Objects

Ordinary solid meshes should be in the same composer scene if their rendered
color should be the endpoint color Algorithm32 attenuates/composes. Examples
include buildings, mountains, terrain props, probe spheres, and any opaque
diagnostic geometry.

Do not hand-solve geometry coordinates in the app. For ground-relative solid
objects, convert authored offsets through the active geometry first, then use
those normalized scene points for mesh placement, shadow focus points, and
`endpointPositionsSceneUnits` passed into
`geometry.resolveSceneDepthMaxMeters(...)`. Flat geometry returns the direct
`[x, height, z]` scene point; spherical geometry owns the curved-surface
projection and altitude normalization.

Current production only promotes point-level normalization through
`geometry.mapGroundOffsetToScenePoint(...)`. A richer future geometry
placement-frame API is intentionally deferred: it should return normalized
position, rotation/quaternion, and bounding points. Spherical geometry should
align placed objects to the local surface normal; flat geometry may apply a
projection transform for large objects whose footprint should not remain a
small local tangent approximation.

Recommended user data:

```js
export const ALGORITHM32_SOLID_SCENE_INPUT = Object.freeze({
  algorithm32SceneInput: true,
  metersPerSceneUnit: 1000,
});
```

Use normal Three materials or app-specific radiometric materials. Algorithm32
does not inspect material identity in the first production shader contract;
it receives scene color, hit/no-hit, and distance.

### Excluded Visual Objects

Exclude objects that should be visible to the user but should not terminate
Algorithm32 atmosphere rays:

- constellation and grid overlays
- decorative sky domes and source-direction markers
- decorative atmosphere shells
- Earth-disc decorations that are not the local ground endpoint
- labels, helper axes, selection gizmos, and UI-adjacent overlays

Recommended user data:

```js
export const ALGORITHM32_SCENE_INPUT_EXCLUDED = Object.freeze({
  algorithm32SceneInput: false,
});
```

`SceneInputCapture` temporarily hides excluded objects while rendering the
depth and hit-mask targets, then restores visibility for the app render. The
normal `RenderPass` still renders excluded objects into the scene-color
read buffer when they are visible, but the current Color composition only uses
scene color for hit endpoints. Decorative sky/source visuals that must appear
in final no-hit sky pixels should usually move to a deliberate overlay pass or
receive an explicit future composition policy.

This exclusion flag is scene-capture policy only. It does not turn an authored
star or Sun mesh into physical celestial radiometry. The planned contribution
cache has no production consumer yet; use reconciliation CPU results only as
validation oracles until the cache slice is implemented and proved.

Transparent and alpha-blended meshes need deliberate policy. The first
production capture treats captured geometry as an opaque hit. Exclude
transparent overlays from Algorithm32 input unless they really should behave
as opaque ray terminators.

## Lights And Endpoint Shading

Algorithm32 transport does not read Three lights, shadow maps, or material
graphs directly. Three lights affect the scene color produced by `RenderPass`;
Algorithm32 then composes that scene color with atmospheric path radiance and
transmittance.

Every app should obtain endpoint lighting helpers from the configured
`lightSource` through `addSceneLighting(...)`:

```js
const sourceLighting = config.lightSource.addSceneLighting({
  THREE,
  sourceRelativePosition,
  sourcePositionSceneUnits,
  observerScenePositionUnits,
  calibrationScalar: 4,
  endpointSceneLightScalePolicy: 'observer-incident-scale',
  shadow: {
    enabled: true,
    focusSceneUnits: [0, 0, 0],
    extentSceneUnits: 100,
    mapSize: 2048,
  },
});
```

Add `sourceLighting.lights` to the composer scene. Add
`sourceLighting.sceneObjects` too when the source factory returns helper
targets, shadow focus objects, or visible/excluded source markers. Preserve
source-owned metadata and tags; do not reinterpret the source's calibration in
app components. If `addSceneLighting(...)` receives a `scene`, the source may
mount its returned lighting objects itself; otherwise add the returned arrays
from the app. Keep ambient/fill values as source-owned scene-lighting facts:
by default the source scales its computed local light percentage across an
absolute ambient range of `{ min: 0.06, max: 0.5 }`. The small floor keeps
night/twilight scenes readable without pretending the local source is up.
Apps can override those bounds with `ambientIntensityRange` when a scene needs
different visual balance, but the default should be usable for ordinary integrations. Local
finite sources use their reference-relative incident scale; distant globe
sources use a twilight-aware source-up mapping so sunrise/sunset ambient can
differ from direct source light.

When an app-authored mesh should participate in source-owned shadows, ask the
light source to configure the mesh instead of setting ad hoc shadow flags:

```js
config.lightSource.configureThreeShadowObject?.(endpointMesh, {
  castShadow: true,
  receiveShadow: true,
  includeDescendants: true,
});
```

The helper sets Three `castShadow` / `receiveShadow` flags and stamps readable
`userData` describing the source key and shadow policy. It does not add the
mesh to the scene and it does not replace geometry-owned placement or endpoint
tags; call it after creating the mesh and before rendering it in the composer
scene.

For a distant Sun, the source-owned helper should resolve the directional
light or source-driven material-uniform facts from the same configured
direction used by Algorithm32 transport. Ambient, hemisphere, or environment
fill remains renderer display policy, not atmosphere physics.

For a local/finite Sun, the source-owned helper should resolve the scene-space
source position, local distance/falloff policy, optional point or directional
shadow light, and any endpoint fill helpers from the same source-relative
facts used by Algorithm32 transport. Keep visible source meshes excluded from
scene input unless they are intentionally opaque endpoints.

For shadows:

- Shadow maps are renderer state. Configure shadow enablement, extent, bias,
  normal bias, and map size through the source lighting request or an adjacent
  renderer policy object.
- `shadow.objects` describes object-owned shadow coverage. Each object request
  creates one source-owned directional shadow light focused on that caster.
- Derive each shadow request's `focusSceneUnits` and `extentSceneUnits` from
  the same geometry-normalized, transformed bounds that create the rendered
  object. Do not maintain a separate shadow-only placement approximation.
- Three directional lights are still additive lighting terms. This object
  shadow-light path is a renderer approximation for review and endpoint scene
  capture, not a final physical single-Sun shadow model.
- A future high-precision shadow path should render a separate shadow mask or
  composite pass. That is the right place for one shadow camera per object
  without multiplying endpoint lighting.
- Choose `receiveShadow` from the scene's material truth. Disabling it can be
  useful for overlay/debug helpers, but opaque scene objects that should be
  affected by the local light environment should remain shadow receivers.
- Configure app-authored shadow-casting/receiving meshes with
  `lightSource.configureThreeShadowObject(...)` when the concrete source
  exposes it.
- Shadows enter Algorithm32 only because they darken the renderer-produced
  scene color at hit pixels.
- `normalBias` is in Three scene units. Keep it proportional to the visible
  object scale; a value that represents tens of meters can erase shadows from
  small buildings.
- Shadow darkness is bounded by the fraction of endpoint scene light that can
  actually be shadowed. High ambient fill or multiple unshadowed sibling
  source lights will keep shadowed pixels bright. When source-owned lighting
  splits one source into multiple per-object shadow lights, the default
  `shadowIntensity` compensates for that split so each object can still cast a
  useful shadow while total direct illumination remains divided across the
  sibling lights. Tune ambient/fill defaults before treating explicit
  `shadowIntensity` as a scene darkness control.
- If the source moves, update Algorithm32 config, geometry/source scene-object
  factories or update hooks, material uniforms, and camera/model bindings from
  the same simulation tick.
- Avoid applying local source falloff twice. Endpoint shading and Algorithm32
  transport should share one explicit falloff policy.

## React Scene Example

This scene includes the three things a useful first integration needs:
geometry-owned endpoint objects, source-owned lighting objects, and one
app-authored opaque endpoint object. The concrete example uses a flat/local
source because finite sources need a scene-space source position; a
distant/spherical source should use the same owner-factory pattern with that
source's direction-based lighting request.

```jsx
import React from 'react';
import * as THREE from 'three';

import { ALGORITHM32_SOLID_SCENE_INPUT } from '../algorithm32/sceneInputTags.js';

export class Algorithm32OwnerSceneObjects extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      ownerObjects: createOwnerSceneObjects(props),
    };
  }

  componentDidUpdate(previousProps) {
    if (!this._ownerInputsChanged(previousProps)) {
      return;
    }

    const previousOwnerObjects = this.state.ownerObjects;
    const ownerObjects = createOwnerSceneObjects(this.props);

    this.setState({ ownerObjects }, () => {
      disposeObjectTrees(previousOwnerObjects.renderedObjects);
    });
  }

  componentWillUnmount() {
    disposeObjectTrees(this.state.ownerObjects.renderedObjects);
  }

  _ownerInputsChanged(previousProps) {
    return previousProps.config !== this.props.config
      || previousProps.metersPerSceneUnit !== this.props.metersPerSceneUnit
      || previousProps.geometryOptions !== this.props.geometryOptions
      || previousProps.lightingOptions !== this.props.lightingOptions;
  }

  render() {
    return (
      <React.Fragment>
        {this.state.ownerObjects.renderedObjects.map((object) => (
          <primitive key={object.uuid ?? object.name} object={object} />
        ))}
      </React.Fragment>
    );
  }
}

export class DemoSolidEndpoint extends React.Component {
  render() {
    return (
      <mesh
        position={[0, 1, -10]}
        userData={ALGORITHM32_SOLID_SCENE_INPUT}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#3d87c7" roughness={0.65} />
      </mesh>
    );
  }
}

function createOwnerSceneObjects({
  config,
  metersPerSceneUnit,
  geometryOptions,
  lightingOptions,
}) {
  const geometry = config.geometry;
  const lightSource = config.lightSource;
  const createEndpointObjects = requireOwnerFactory(
    geometry,
    'createThreeEndpointObjects',
    'geometry',
  );
  const createLightingObjects = requireOwnerFactory(
    lightSource,
    'addSceneLighting',
    'lightSource',
  );

  const endpointObjects = createEndpointObjects.call(geometry, {
    metersPerSceneUnit,
    visualMaterialLighting: 'lambert',
    shadow: {
      enabled: true,
    },
    ...geometryOptions,
  });

  const observerPositionMeters = geometry.configuration.observerPositionMeters;
  const sourcePositionMeters = geometry.configuration.sourcePositionMeters;
  const sourceRelativePosition = geometry.resolveSourceRelativePosition({
    position: observerPositionMeters,
  });
  const observerScenePositionUnits =
    geometry.mapModelPositionToObserverLocalScenePoint?.(
      observerPositionMeters,
      { metersPerSceneUnit },
    ) ?? [0, 0, 0];
  const sourcePositionSceneUnits =
    geometry.mapModelPositionToObserverLocalScenePoint?.(
      sourcePositionMeters,
      { metersPerSceneUnit },
    );

  const lightingObjects = createLightingObjects.call(lightSource, {
    THREE,
    sourceRelativePosition,
    sourcePositionSceneUnits,
    observerScenePositionUnits,
    shadow: { enabled: true },
    ...lightingOptions,
  });

  const renderedObjects = [
    ...toArray(endpointObjects.visualObjects),
    ...toArray(lightingObjects.lights),
    ...toArray(lightingObjects.sceneObjects),
  ];

  return {
    renderedObjects,
    raycastObjects: toArray(endpointObjects.raycastObjects),
    metadata: {
      endpointObjects: endpointObjects.metadata,
      lightingObjects: lightingObjects.metadata,
    },
  };
}

function requireOwnerFactory(owner, methodName, ownerName) {
  if (typeof owner?.[methodName] !== 'function') {
    throw new Error(`${ownerName}.${methodName} must be provided by Algorithm32.`);
  }

  return owner[methodName];
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function disposeObjectTrees(objects) {
  for (const object of objects) {
    object.traverse?.((node) => {
      node.geometry?.dispose?.();

      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material].filter(Boolean);

      for (const material of materials) {
        material.dispose?.();
      }
    });
  }
}
```

Use the owner-created scene objects in the composer:

```jsx
import React from 'react';
import { Canvas } from '@react-three/fiber';

import AppAlgorithm32Composer from './algorithm32/AppAlgorithm32Composer.jsx';
import { createFlatLocalSunConfig } from './algorithm32/createAlgorithm32Config.js';
import {
  Algorithm32OwnerSceneObjects,
  DemoSolidEndpoint,
} from './scene/Algorithm32OwnerSceneObjects.jsx';

const metersPerSceneUnit = 1000;
const geometryOptions = Object.freeze({
  visualMaterialDisplayRgba: [92, 110, 74, 255],
  visualMaterialLighting: 'lambert',
});
const lightingOptions = Object.freeze({
  calibrationScalar: 4,
  endpointSceneLightScalePolicy: 'observer-incident-scale',
  shadow: {
    enabled: true,
    objects: [
      {
        objectKey: 'near-box',
        layerIndex: 1,
        focusSceneUnits: [0, 0, -10],
        extentSceneUnits: 24,
      },
      {
        objectKey: 'distant-box',
        layerIndex: 2,
        focusSceneUnits: [0, 0, -180],
        extentSceneUnits: 120,
      },
    ],
    mapSize: 2048,
    bias: -0.0001,
    normalBias: 0.0005,
  },
});

export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.config = createFlatLocalSunConfig({
      observerPositionMeters: [0, 0, 2],
      sourcePositionMeters: [0, 100000, 100000],
      metersPerSceneUnit,
    });
  }

  render() {
    return (
      <Canvas
        camera={{
          position: [0, 4, 18],
          near: 0.1,
          far: 1000,
          fov: 60,
        }}
        shadows
      >
        <AppAlgorithm32Composer
          config={this.config}
          metersPerSceneUnit={metersPerSceneUnit}
        >
          <Algorithm32OwnerSceneObjects
            config={this.config}
            metersPerSceneUnit={metersPerSceneUnit}
            geometryOptions={geometryOptions}
            lightingOptions={lightingOptions}
          />
          <DemoSolidEndpoint />
        </AppAlgorithm32Composer>
      </Canvas>
    );
  }
}
```

Keep `geometryOptions` and `lightingOptions` stable. Changing them replaces
the owner-created Three objects, which is correct for a profile change but too
expensive for ordinary camera motion.

## Units, Bindings, And Scene Frames

Algorithm32 shader contributions expect camera and scene facts in geometry
model coordinates, usually meters.

Always provide these mutable binding values unless the active geometry
contribution supplies defaults:

```js
{
  'geometry.inverseProjectionMatrix': new THREE.Matrix4(),
  'geometry.inverseViewMatrix': new THREE.Matrix4(),
  'geometry.cameraWorldPositionMeters': new THREE.Vector3(),
  'geometry.sceneTerminationMeters': 0,
}
```

Update the camera matrices every frame before rendering:

```js
camera.updateMatrixWorld();
camera.updateProjectionMatrix();
bindings['geometry.inverseProjectionMatrix'].copy(camera.projectionMatrixInverse);
bindings['geometry.inverseViewMatrix'].copy(camera.matrixWorld);
```

Convert camera world position into model meters according to the geometry:

- Spherical model-space globe: multiply planet-centered scene coordinates by
  `metersPerSceneUnit`.
- Flat observer-local app: convert your scene basis into the flat model's
  meter basis with
  `geometry.mapObserverLocalScenePointToModelPosition(camera.position, { metersPerSceneUnit })`.
  Define which Three axis is east/right, which axis is north or forward, and
  which axis is altitude, then use that same mapping for camera bindings,
  source placement, and ground placement.
- Observer-local spherical profiles can use geometry-owned observer frame
  defaults, but app integrations still need a clear model-space camera
  position contract before shipping.

Pass the same scale to setup:

```js
await algorithm32.setupShader({
  // ...
  metersPerSceneUnit: 1000,
  distanceMultiplier: 1000,
  bindingValues,
});
```

`SceneInputCapture` encodes world-space distance from the camera multiplied by
`distanceMultiplier`, normalized by the geometry-resolved
`sceneDepthMaxMeters`, into RGB24. Use the geometry default unless app-authored
solid endpoints extend the endpoint range:

- The geometry default should exceed the farthest geometry-owned opaque
  endpoint distance.
- An app override must exceed the farthest intended opaque endpoint distance.
- The cap should be as tight as practical to preserve distance precision.
- It should exclude decorative astronomical objects, stars, and source meshes
  that are not endpoints.
- If overridden, the setup/config value and any manual
  `'geometry.sceneDepthMaxMeters'` binding must match.
- For app-authored ground-relative objects, feed the cap with geometry-normalized
  bounding points from `mapGroundOffsetToScenePoint(...)`, not raw authored
  local offsets.

## Runtime Loop

The live frame order should be:

```text
read/update app simulation state
update camera controls and matrices
update source-owned lighting objects, update hooks, or material uniforms
update Algorithm32 mutable binding values
composer.render(delta)
```

Do not call both `renderer.render(scene, camera)` and `composer.render(...)`
for the same final view unless the renderer draw is a deliberate fallback or
overlay. The composer owns the final render once Algorithm32 is ready.

The shader setup is async because it may build cache payloads and GPU
resources. Keep a visible fallback path while setup is pending or has failed.
Setup failures should be loud in development; after a runtime pass is live,
render-time failures are logged and the pass should continue or no-op where
possible.

## Config Changes

`Algorithm32` config replacement is whole-config replacement. Do not mutate
old config objects in place and expect all owners to notice.

Use:

```js
await shaderHandle.setConfig(nextConfig);
```

for changes to light-source, atmosphere, geometry, Color/display, spectral,
execution, or shader policy that can keep the same scene/composer/camera
attachments.

Dispose and call `setupShader(...)` again when any setup attachment changes:

- a new Three scene object
- a new camera object
- a new composer
- a new renderer/context behind the composer

Camera movement and controls do not require config replacement. They require
updating the mutable camera matrix and camera model-position bindings before
each `composer.render(...)`.

## Diagnostics And Validation

Useful first checks:

1. Render the scene with only `RenderPass`, or temporarily omit/dispose the
   Algorithm32 shader handle, and confirm the geometry-owned
   endpoint objects, source-owned lights, and app-authored solids are visible.
2. Enable Algorithm32 setup and confirm `setupShader(...)` resolves without
   missing binding, missing Color, cache payload, or Three-constructor errors.
3. Call `shaderHandle.getDiagnostics()` after setup. The installed state
   should include runtime diagnostics; the scene input capture diagnostics
   report capture policy, depth encoding, hit-mask encoding,
   `sceneDepthMaxMeters`, `distanceMultiplier`, viewport, and frame count.
4. Confirm the frame loop calls `composer.render(...)`, not only the default
   renderer.
5. Confirm the geometry-owned endpoint visual objects and app-authored solids
   are in the composer scene, not only in the original React/R3F root scene.
6. Confirm decorative sky and source display objects have
   `algorithm32SceneInput: false`.
7. Confirm the geometry-resolved `sceneDepthMaxMeters` and
   `distanceMultiplier` match the app's actual scale. If the app overrides the
   cap for extra endpoint objects, confirm the override is still local to the
   intended endpoint range.
8. If app-authored ground-relative solids are present, confirm mesh placement,
   shadow focus points, and scene-depth endpoint points all come from geometry
   normalization.
9. For the existing atmosphere browser path, compare selected pixels against
   `Reference` plus `Color` after the live app visibly renders. A future
   contribution-cache slice needs its own visible-celestial parity proof.

Common failure modes:

| Symptom | Likely cause | First fix |
| --- | --- | --- |
| Black canvas after setup | Frame loop is not calling the composer, portal scene is empty, setup failed and fallback is hidden, or the runtime shader failed to compile | Log setup errors, verify `composer.render(...)`, inspect `shaderHandle.getDiagnostics()`, and render a plain `RenderPass` first |
| Atmosphere with no ground | Geometry endpoint visual objects were not created, not added to the composer scene, excluded, outside the depth cap, at the wrong scale, or not writing depth | Call `geometry.createThreeEndpointObjects(...)`, add `visualObjects`, preserve endpoint tags, tighten scale conversion, and use `geometry.resolveSceneDepthMaxMeters(...)` unless the app needs a deliberate tighter/looser endpoint override |
| Ground terminates too early or too late | `distanceMultiplier`, `metersPerSceneUnit`, or camera model-position conversion is inconsistent | Use one scene-unit-to-meter constant and update camera bindings from the same conversion |
| Flat mode shows the wrong horizon or appears empty | The camera is pitched upward, or the shader camera binding uses a different basis than the flat geometry-created ground | Start the camera at the observer height, target the same height along the forward axis for pitch `0`, and update `geometry.cameraWorldPositionMeters` through `FlatEarthGeometry.mapObserverLocalScenePointToModelPosition(...)` |
| Source direction and shadows disagree with atmosphere | Source lighting objects were not created from the same geometry/source facts or were not refreshed after a source change | Call `lightSource.addSceneLighting(...)` or its update hook from the same app state used for Algorithm32 config and bindings |
| Depth banding or horizon artifacts | `sceneDepthMaxMeters` is much larger than endpoint distances | Use a local horizon/object cap instead of star-scale `camera.far` |
| Decorative sky overlays affect atmosphere hits | Presentation meshes are captured as endpoints | Set `userData.algorithm32SceneInput = false` or render them in a separate overlay pass; do not treat them as physical source radiometry |
| Endpoint color looks washed out or tinted | Renderer endpoint material/display policy does not match Color/display assumptions | Check scene color space, tone mapping, exposure, and Color inverse-tone-map policy |
| Edge halos differ from reference | Antialiasing differs between scene color, depth, and hit captures, or app objects were placed in a different geometry frame than the depth-cap inputs | Use consistent pixel ratio/render scale, keep scene inputs pixel-exact, and route object placement plus bounding points through geometry normalization |
| Performance collection slows the whole app | Timer queries are being collected too often or unresolved queries are accumulating | Supply `performanceCallback` only while measuring, raise `performanceSampleIntervalFrames`, and keep `performanceMaxPendingQueries` low |

## Algorithm32 Runtime API

The app-facing runtime surface is:

- `new Algorithm32(config)`
- awaited `setupShader({ THREE, composer, scene, camera, ... })`
- owner-local shader contributions from geometry, atmosphere, light source,
  cache, Color, and transport
- `SceneInputCapture` for renderer-produced distance and hit mask
- `ShaderRuntimePass` with a fullscreen `RawShaderMaterial`
- shader-handle `setConfig(nextConfig)`, `getDiagnostics()`, and `dispose()`

## Integration Checklist

Before calling the integration done:

- The app has one `EffectComposer` for the final Algorithm32 view.
- The composer has `RenderPass(scene, camera)` before Algorithm32 setup.
- `setupShader(...)` receives `THREE`, `composer`, `scene`, `camera`,
  `viewportPixels`, `metersPerSceneUnit` or `distanceMultiplier`,
  `bindingValues`, a logger, and `sceneDepthMaxMeters` only when overriding
  the geometry default.
- `performanceCallback` is omitted unless actively measuring shader passes.
- The frame loop updates camera/model bindings before `composer.render(...)`.
- Resize calls update the renderer and composer.
- `geometry.createThreeEndpointObjects(...)` creates the required endpoint
  objects, and its renderable `visualObjects` exist in the composer scene with
  geometry-owned endpoint tags preserved.
- Ordinary opaque endpoint objects are in the composer scene.
- Decorative sky/source/overlay objects are excluded from scene input or
  rendered in a deliberate overlay path.
- `lightSource.addSceneLighting(...)` creates source-owned lighting
  objects, and any source update path is synchronized to Algorithm32 config
  and bindings.
- `geometry.resolveSceneDepthMaxMeters(...)` supplies the default depth cap, or
  an explicit app override is tight to the intended extra endpoint range.
- App-authored ground-relative solids use geometry-normalized placement and
  geometry-normalized bounding points for scene-depth cap inputs.
- Config replacement uses `shaderHandle.setConfig(...)`.
- Scene/composer/camera replacement uses dispose plus re-setup.
- Teardown disposes the shader handle, facade, composer, and app-owned GPU
  resources.
- Browser/readback validation starts only after the live app visibly renders.
