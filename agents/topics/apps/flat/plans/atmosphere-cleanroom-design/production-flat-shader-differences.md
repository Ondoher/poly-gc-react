# Production Flat Shader Differences

This document records the specific production shader differences needed to
support the Flat geometry model using Algorithm32 atmosphere transport.

The important boundary is:

```text
flat support changes geometry, path resolution, and cache coordinates;
it does not change the clear-air Rayleigh/Mie atmosphere constants or
transport equation.
```

The current evidence is the shader-lab flat visibility offshoot:

- `056-browser-flat-earth-visibility-search`: first accepted cannot-see
  distance for the `10 km x 10 km` black card.
- `062-browser-flat-earth-visibility-search`: accepted visibility-loss
  milestone distances.
- `065-browser-flat-earth-visibility-search/canvas-image.png`: accepted
  high-resolution milestone inspection gallery.

Those artifacts are experimental evidence, not production code. The production
shader still needs its own geometry adapter, cache contract, and parity tests.

## Unchanged Physics

Flat support should reuse the same source-backed Algorithm32 clear-air kernels:

- Rayleigh density profile and coefficient law;
- Mie density profile, Angstrom extinction, single-scattering albedo, and
  phase-function `g`;
- Beer-Lambert optical depth and transmittance;
- Rayleigh and Mie phase functions;
- first-order in-scattered path radiance equation;
- finite-object composition:

```text
L_camera(lambda) =
  T_view(lambda) * L_object(lambda) +
  L_path(lambda)
```

Display conversion remains a consumer step. The flat shader must not hide
geometry differences in RGB tints, exposure changes, or fitted display
constants.

## Geometry Model Switch

The production shader should make geometry model an explicit input:

```text
geometryModel = "spherical-shell" | "flat-slab"
```

This can be a compile-time shader variant, a material/program define, or a
uniform branch after profiling. It should not be inferred from camera position
or from app route names.

The flat variant needs these canonical inputs:

- flat up axis;
- ground/reference plane height;
- camera position in flat model coordinates;
- atmosphere top height above the flat ground plane;
- sky path cap or optical-saturation policy for near-horizontal rays;
- scene depth or object-hit distance in the same flat coordinate space;
- Sun configuration, including whether it is distant directional or a
  configurable local finite source.

For the Flat app's proposed local-Sun mode, treat latitude, altitude,
radius/size, and brightness/luminosity as explicit flat-model hypothesis
parameters. Older Flat POC/status notes already identified
`config.sun.lat`, `config.sun.altitudeKm`, and `config.sun.radiusKm` as the
first false-Sun controls, and the older atmosphere-reset research framed
local-Sun height, radius, disk edge, dome height, and no-occlusion behavior as
proposed physical assumptions rather than Earth-atmosphere constants. Those
older local notes are routing/provenance context only; equations, constants,
and production defaults still need direct external or explicitly
hypothesis-labeled support.

## Required Shader Differences

| Area | Spherical shader | Flat shader |
| --- | --- | --- |
| Altitude | `altitude = length(position) - bottomRadius` | `altitude = dot(position - groundOrigin, upAxis)` |
| Sky boundary | ray intersects top-atmosphere sphere | ray intersects top-atmosphere plane/slab; near-horizontal rays need a cap or saturation policy |
| Ground boundary | ray intersects planet sphere | ray intersects flat ground plane or future terrain heightfield |
| Object segment | scene depth/object hit distance in spherical world coordinates | scene depth/object hit distance in flat world coordinates |
| Optical length | integrate exponential density along spherical-shell path | integrate along flat straight segment; analytic exponential integral is available when altitude varies linearly |
| Sun transmittance | ray-to-Sun may intersect spherical ground; integrate to top sphere | distant Sun: if `dot(sun, upAxis) <= 0`, direct Sun transmittance is zero; otherwise integrate to top slab. Local Sun: compute sample-to-source direction/distance per sample, then integrate through the flat slab or named boundary policy. |
| Cache coordinates | Bruneton-style radius/view-angle/Sun-angle coordinates | flat-specific coordinates such as altitude, vertical ray component, segment distance/end altitude, and Sun configuration |
| Horizon behavior | finite atmosphere exit from spherical shell | horizontal flat rays do not naturally leave the slab; require explicit path cap, optical-depth saturation, or cache-domain limit |

## Altitude And Density

The flat shader should replace radial altitude with local height:

```text
h = max(0, dot(point - groundOrigin, upAxis))
rho_R(h) = exp(-h / H_R)
rho_M(h) = exp(-h / H_M)
```

The density equations are unchanged; only `h` changes.

The shader must keep altitude units and coordinate ownership explicit. A
camera-space `z` value is not automatically altitude unless the camera basis
has been transformed into the flat model frame.

## Path Endpoints

### Sky Rays

For upward flat sky rays:

```text
d_top = (topHeight - h_camera) / dot(viewRay, upAxis)
```

For near-horizontal rays where `dot(viewRay, upAxis)` is near zero, the flat
slab has no natural top-atmosphere exit. Production must choose and document
one policy:

- finite max sky distance;
- optical-depth saturation cutoff;
- cache-domain clamp with diagnostics;
- a future model-specific horizon/terrain endpoint.

The visibility artifacts used a finite cap for this reason.

### Ground And Object Rays

For scene objects, the shader should continue to use a depth/material or
object-hit input, but the distance and reconstructed target point must be in
flat model coordinates. The object transfer remains:

```text
T_view(lambda) * L_object(lambda) + L_path(lambda)
```

For missing object hits on downward rays, the flat shader intersects the ground
plane or future terrain heightfield. It should not fall back to spherical
ground logic.

## Optical Length

In spherical geometry, Algorithm32 samples the path because altitude changes
according to shell curvature.

In flat geometry, altitude changes linearly along a straight ray:

```text
h(s) = h0 + s * dot(viewRay, upAxis)
```

That allows an analytic exponential optical length for each density:

```text
if abs(dh_ds) is small:
  L = d * exp(-h0 / H)
else:
  L = exp(-h0 / H) * H / dh_ds * (1 - exp(-dh_ds * d / H))
```

The production shader may use this analytic form, a LUT, or sampled marching.
The choice is an algorithmic/performance decision, but it must be documented
and compared against the direct flat reference.

## Sun Motion And Configuration

The configurable flat-earth Sun should be represented as a local finite-source
model, not as a hidden variation of the spherical distant-Sun uniform:

```js
{
  kind: "flat-local-circular-sun",
  latitudeDeg,
  altitudeKm,
  radiusKm,
  period: "solar-day",
  phaseLongitudeDeg,
  spectralShapeId,
  brightnessPolicy,
  brightnessScale
}
```

The default time-of-day motion should use a solar-day period. The user expects
"time of day" to move the Sun through a day/night cycle; sidereal rotation
should remain the star-dome period or an explicit advanced option. The Sun
position can be derived by moving around the configured projected latitude ring
with the selected solar-day phase.

Local claim-style presets should stay labeled as hypotheses. The older
rejected-reference source index records secondary breadcrumbs for commonly
repeated flat-earth claims such as a small local Sun around `32 mi` across and
`3000 mi` above Earth. Those links explain why the app has historically used
similar defaults; they are not scientific authorities or validation sources.

Brightness should be explicit and spectral. Preferred policy:

- reuse the Algorithm32/solar spectral shape as the source spectrum;
- choose a calibration rule such as target direct normal irradiance at a
  reference observer and reference Sun pose;
- expose user brightness/luminosity as a named multiplier on that calibrated
  source;
- keep RGB tint, exposure changes, or hidden per-channel factors out of the
  transport solver.

The visible Sun body and the atmosphere scattering source should derive from
the same canonical Sun config. They are still separate consumers: the visible
body is rendered and attenuated like an emissive object, while the atmosphere
pass samples the same source for in-scattering.

## Sun Transmittance

For the current distant directional Sun case:

```text
sunUp = dot(sunDirection, upAxis)
if sunUp <= 0:
  T_sun = 0
else:
  d_sun_top = (topHeight - h_sample) / sunUp
```

The same Beer-Lambert transmittance equation applies along that sample-to-top
segment.

The configurable local finite-Sun case requires:

- segment-to-Sun geometry instead of a parallel direction;
- source distance and spectral radiance or irradiance falloff policy;
- finite angular source size or small-disk solid-angle approximation;
- sample-to-source transmittance through the flat slab, dome, finite local
  patch, disk edge, terrain occluder, or explicit no-occlusion policy;
- cache keys that include local source position and source parameters.

Do not silently mix local-Sun behavior into a distant directional-Sun shader.
If the first production branch targets the Flat app's configurable Sun, make
the local-source path the named branch and keep distant directional support as
its own comparison mode.

## Cache And Texture Contract

Spherical Bruneton lookup textures are not directly reusable for flat geometry
because their coordinates encode spherical symmetries such as radius and view
angle to the local radial direction.

Flat shader caches need their own coordinate contract. Candidate texture
families:

- view transmittance by start altitude, vertical ray component, and distance or
  end altitude;
- path radiance by start altitude, vertical ray component, distance/end
  altitude, and Sun direction;
- sky radiance by view direction and observer altitude;
- finite-object aerial perspective by segment distance, altitude range, and
  Sun configuration.

Cache keys must include:

- `geometryModel`;
- flat top height and ground/reference plane;
- atmosphere profile/preset id and coefficients;
- spectral/channel policy;
- numerical sample or analytic policy;
- Sun kind, direction or position, radius/size, period policy, phase, and
  brightness/luminosity calibration policy;
- sky path cap/saturation policy;
- cache resolution and coordinate mapping.

For the Flat app configuration-dialog flow, rebuilding flat/source-dependent
caches over seconds is acceptable. The UI should report progress and let a
newer configuration supersede stale work.

## Production Shader Pipeline Fit

The production path should keep the same broad pipeline:

```text
scene color/material/depth inputs
  -> reconstruct flat ray and endpoint
  -> compute or sample flat T_view and L_path
  -> compose atmosphere with object radiance
  -> display/color bridge
```

The depth/material pass should provide or allow reconstruction of:

- hit/miss classification;
- linear segment distance;
- target point in flat model coordinates;
- material/spectrum or object radiance input;
- optional object normal for future surface irradiance helpers.

The atmosphere pass should expose diagnostics for:

- geometry model;
- start/end altitude;
- segment distance;
- top/ground/object endpoint classification;
- Rayleigh and Mie optical lengths;
- view transmittance;
- Sun transmittance;
- local Sun distance, solid angle policy, and source visibility when
  `sun.kind` is local;
- path radiance;
- cache coordinate used, if any.

## Validation Requirements

Flat shader validation should compare against Algorithm32 direct flat traces,
not against subjective screenshots.

Minimum parity scenes:

- sky-only upward, near-horizon, and downward/ground rays;
- black object at the accepted visibility milestone distances;
- colored finite objects at near, middle, and long distances;
- ground-plane rays;
- horizon-cap stress rays;
- local Sun poses at noon-like, near-horizon, and opposite-side phases;
- local Sun brightness/radius/altitude sensitivity at a fixed observer;
- visible Sun body attenuation compared with the same Sun used for
  atmosphere scattering;
- cache-coordinate edge cases at top-atmosphere and near-ground altitudes.

The current artifact anchors are:

- cannot-see threshold: `056`;
- milestone threshold table: `062`;
- visual inspection gallery: `065`.

The wide-target stress artifacts `057` and `058` show that visibility distance
is target/render specific, not an atmosphere-only constant. Production tests
must therefore record target dimensions, camera FOV, resolution, and the
visibility metric with every claim.

## First Production Step

The first production-oriented implementation should not start by optimizing.
It should:

1. Add explicit `geometryModel` support to the shader/cache input contract.
2. Add a named `sun.kind` branch for the configurable flat local Sun, with
   solar-day time-to-position mapping around the configured latitude ring.
3. Implement the flat altitude, sky-boundary, ground-boundary, and
   local sample-to-Sun functions.
4. Keep first-order flat local-Sun transport direct and inspectable.
5. Validate selected pixels against the flat direct reference.
6. Only then introduce flat-specific LUTs, second-order cache approximations,
   or reduced-channel approximations.

This keeps flat support tied to Algorithm32 semantics while allowing the
runtime shader to become faster later.
