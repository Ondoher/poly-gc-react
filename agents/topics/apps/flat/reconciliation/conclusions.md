# Reconciliation Conclusions

This document captures the production implementation decisions learned from
the Algorithm32 reconciliation work.

## Production Direction

Algorithm32 should be implemented as a source-neutral, geometry-neutral
spectral transport system with a renderer integration layer around it. The
important product is the boundary shape:

- `evaluate(...)` owns spectral atmospheric transport.
- Geometry owns spatial truth and coordinate conversion.
- Light sources own source facts and source-facing renderer-light adapters.
- Incident radiance is prepared before frame rendering and sampled through an
  operation-ready sampler.
- Color/display owns RGB output and endpoint scene-color composition.
- CPU and GPU paths consume the same logical inputs and produce the same
  atmospheric result within documented tolerance.

Renderer color, material color, Three objects, shadows, and display RGB do not
belong inside the core evaluator. They are part of the renderer/display
composition layer.

## Core Architecture

Keep the five-interface architecture:

- light/source;
- geometry;
- atmosphere;
- incident radiance cache/sampler;
- color/display.

Transport coordinates these interfaces but does not absorb their state.
Consumer-provided models should not call each other directly. A coordinator
asks each owner for plain facts and passes those facts onward.

This matters because the same transport path must support distant sources,
finite local sources, spherical geometry, flat geometry, CPU execution, GPU
execution, scene-hit termination, and higher-order incident radiance without
forking the algorithm.

## Evaluation Contract

The evaluator accepts ray/path facts and resolved model facts. It returns
spectral radiance, transmittance, and diagnostics.

It must not accept:

- renderer RGB;
- material ids;
- Three lights;
- shadows;
- scene graph objects;
- display-converted color.

For object hits, only the path length and spatial hit facts affect transport.
Endpoint color is composed afterward:

```text
final display = atmosphere/path contribution + endpoint scene contribution through view transmittance
```

The GPU shader does not call the JavaScript `evaluate(...)` function, but it
must implement the same logical operation from the same prepared facts.

## Geometry

Geometry is the owner of:

- renderer-to-model ray conversion;
- model-to-renderer scene-frame conversion;
- ray termination against ground, atmosphere top, scene hit distance, and
  other spatial bounds;
- atmosphere coordinates;
- source-relative coordinates;
- incident-radiance lookup coordinates;
- ground endpoint object creation when a renderer needs a visible or hittable
  ground object.

The implementation should avoid sentinel values and tolerance-as-control-flow.
Hit state, no-hit state, invalid state, and boundary state should be explicit.

The ground has one conceptual owner: geometry. A renderer may draw a mesh or
proxy, but that visible surface and the path/termination interpretation must
come from the same geometry contract.

## Light Sources

Light sources own source behavior:

- distant or finite placement;
- source direction and apparent source facts;
- source path limits;
- source radiance/incident scale facts;
- optional renderer-light helpers for endpoint shading and shadows.

They consume geometry-resolved source-relative positions. They do not own
Three-to-model conversion.

For local Sun behavior, degree inputs mean motion along the local source orbit
from closest approach. They are not apparent sky elevation. Apparent altitude,
azimuth, source position, lighting direction, and shadow direction are derived
facts.

When local Sun behavior is synchronized to real-world time, the default rule is
`real-subsolar-longitude0-noon`: the local source latitude follows the
real-world subsolar latitude for the date at solar noon on longitude `0`, and
local orbit offsets advance from that synchronized state.

## Incident Radiance

Incident radiance support is prepared before per-frame rendering. The cache or
sampler owns:

- logical lookup coordinates;
- generated spectral values;
- descriptor/fingerprint facts;
- GPU texture shape and packing;
- shader lookup code.

Frame rendering should only sample the prepared incident-radiance support. It
should not rebuild tables, infer missing resources, or silently fall back to a
different scattering path.

## Shader Assembly

Shader source should be assembled from abstraction-owned contributions. The
shader builder owns mechanical GPU work:

- source assembly;
- compatibility checks;
- uniform and texture bindings;
- resource upload;
- pass/material installation;
- lifecycle cleanup.

It should not own atmosphere equations, geometry transforms, source behavior,
or cache semantics.

Separate the lifecycle clearly:

- preparation may build caches, assemble shader source, upload textures, and
  install passes;
- frame rendering updates camera, viewport, scene color, depth/hit textures,
  and other cheap live values;
- frame rendering performs only the per-pixel transport and composition work.

The CPU integrated shader is useful only if it consumes the same scene-input
contract as the GPU shader. Do not maintain separate CPU-only and GPU-only
interpretations of the same scene.

## Color And Display

Color stays outside atmospheric transport.

Display composition owns:

- spectral-to-display conversion;
- endpoint scene-color composition;
- tone mapping and exposure;
- debug display modes;
- any future RGB-to-spectrum inverse mapping.

Captured renderer color can be used as endpoint color, but it is not a
spectral source term inside `evaluate(...)`. If production later needs
spectral material reconstruction from RGB, that should live in the color
abstraction and report that the conversion is lossy and non-unique.

## Lighting, Shading, And Shadows

Endpoint lighting is renderer integration. It should provide enough scene
color, material shading, and shadow information for endpoint composition while
Algorithm32 handles atmospheric transport.

Important boundaries:

- direct and indirect renderer lighting should not alter transport equations;
- shadows affect captured endpoint scene color and hit visibility, not the
  internal spectral algorithm;
- shadows imply endpoint shading;
- ambient or environment fill is a renderer-lighting problem, not an
  atmosphere shortcut;
- source-owned renderer-light helpers are useful because they keep light and
  shadow direction attached to the light-source abstraction.

Production still needs a deliberate endpoint-lighting model. Simple ambient
fill is readable, but it is not the same thing as reflected environmental
light.

## Performance And Quality

Keep one ideal shader path as the correctness target. Lower-cost variants
should be named and compared against it.

Useful quality policies:

- use perceptual image metrics, not only raw byte differences;
- allow sample count and interpolation choices to vary by quality level;
- keep cache resources prepared outside frame rendering;
- measure runtime cost in the production scene, not in isolated shader tests
  alone;
- prefer adaptive quality only after there is reliable frame-time
  instrumentation.

Sampling shortcuts are acceptable only when bounded against the ideal path.

## Three Integration

### Use Three As The Renderer

Three should render the ordinary scene first. Algorithm32 should be a
postprocess atmosphere pass over renderer-produced inputs:

1. Three renders scene color with ordinary materials, lights, and shadows.
2. A matching hit/depth/object pass writes the visible fragment facts needed
   by the atmosphere pass.
3. The Algorithm32 shader runs as a fullscreen pass.
4. Display composition combines atmospheric output with endpoint scene color.

This keeps app rendering in Three and atmospheric transport in Algorithm32.

### One Scene Input Contract

CPU and GPU atmosphere paths must consume the same constructed scene inputs.
The split should be:

```text
constructed scene -> color/hit/depth inputs -> CPU or GPU atmosphere backend
```

There should not be a separate CPU scene and GPU scene with different object
placement, lights, material behavior, or ground interpretation.

### Prefer Renderer-Generated Hit Data

CPU raycasting is useful for diagnostics and selected-pixel reasoning, but it
is not the best production source for full-frame hit data. Raycasting and
rasterization can disagree at silhouettes, under antialiasing, and around
thin or shadowed geometry.

Production should generate hit data from the same rasterization path that
created the color pixel. A replacement-material pass or multiple render
targets can write:

- hit mask or hit class;
- view distance;
- world position or reconstructable depth;
- object/material id when needed.

That data represents the fragment that actually won the depth test.

### Depth Is Not Enough By Itself

The atmosphere pass needs explicit state, not just a number:

- scene hit;
- ground hit;
- sky/no-hit;
- invalid/missing input.

Do not infer those states from magic distances, color values, or tolerances.
Encode them directly.

### Geometry Owns Coordinate Conversion

Three coordinates are renderer coordinates. Algorithm32 coordinates are model
coordinates. Geometry owns conversion between them.

This includes:

- camera ray conversion;
- hit point conversion;
- ground object/proxy placement;
- source-relative coordinates;
- incident-radiance lookup coordinates;
- scene scale handling.

Duplicating conversion in renderer code or shader helper code is a direct
route to parity drift.

### Ground Ownership

The renderer-visible ground and the atmosphere/path ground must share one
contract. The preferred shape is:

- geometry defines the abstract ground;
- geometry creates or describes any renderer endpoint object needed for that
  ground;
- renderer hits on that ground terminate rays;
- endpoint ground color comes from renderer scene color;
- atmospheric path behavior comes from geometry facts.

### Shadows Need Integration Policy

Three shadows are straightforward in ordinary scenes but need explicit policy
for large-scale scenes. The renderer integration must choose shadow camera
placement, receiver regions, bias, and filtering in terms of the visible scene
and light-source facts.

Do not treat shadow setup as an Algorithm32 feature. It belongs to endpoint
scene rendering.

### Antialiasing Must Be Consistent

Antialiasing blends color at edges. If hit/depth data is not resolved through
the same policy, edge pixels can contain blended color with single-sample hit
state.

Production should choose one of these:

- disable antialiasing for exact validation views;
- supersample color, hit, and depth together;
- use a multisampled render-target strategy that resolves all scene-input
  buffers consistently.

## Production Follow-Ups

- Resolve remaining source gaps through
  [Unsourced And Partially Sourced Facts](unsourced-and-partially-sourced-facts.md).
- Design the renderer-generated hit/depth/object pass.
- Define the material/color policy for endpoint composition.
- Define endpoint environment/reflected-light behavior.
- Define local Sun source calibration and provenance.
- Define direct Sun disk rendering.
- Define water/ocean rendering as renderer material work.
- Define production shadow quality policy.
- Define adaptive shader quality and perceptual thresholds.
- Define diagnostics for invalid pixels, missing resources, and shader
  capability limits.
