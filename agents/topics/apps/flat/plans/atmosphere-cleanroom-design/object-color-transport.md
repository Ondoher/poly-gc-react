# Object Color Transport

The cleanroom atmosphere design must support more than sky coloring. A primary
use is predicting how the atmosphere changes the apparent color of objects in
the environment.

The sky-dome path is one special case of the transport solver: a ray with no
visible surface endpoint. Object color requires the finite-segment case: a
camera ray reaches an object or ground point, and the atmosphere both attenuates
the object's outgoing radiance and adds in-scattered path radiance between the
object and the camera.

## Core Equation

For a camera ray that reaches an object point:

```text
L_camera(lambda) =
  T_view(lambda) * L_object(lambda) +
  L_path(lambda)
```

Where:

- `L_object(lambda)` is the spectral radiance leaving the object toward the
  camera before atmospheric view-path effects.
- `T_view(lambda)` is spectral transmittance from the object point to the
  camera.
- `L_path(lambda)` is spectral in-scattered radiance accumulated along the
  object-to-camera segment.

For sky rays, there is no object endpoint, so the object term is zero and the
solver returns only the path/scattered sky radiance for the segment ending at
the atmosphere boundary.

External source anchor: Bruneton's demo applies this exact composition shape
for finite objects and ground: compute object or ground reflected radiance,
call `GetSkyRadianceToPoint` to get finite-segment in-scatter and
transmittance, then use `radiance = radiance * transmittance + in_scatter`.
See `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2017-demo.glsl`
and the upstream source `atmosphere/demo/demo.glsl`.

## Required Solver Outputs

The transport solver should expose an atmospheric transfer packet for any
finite camera-to-point segment:

```js
{
  wavelengthsNm,
  segment: {
    origin,
    target,
    length
  },
  transmittanceByWavelength,
  pathRadianceByWavelength,
  components: {
    rayleighPathRadianceByWavelength,
    miePathRadianceByWavelength,
    higherOrderPathRadianceByWavelength
  },
  diagnostics
}
```

The caller can then combine it with object radiance:

```js
cameraRadianceByWavelength =
  objectLeavingRadianceByWavelength * transmittanceByWavelength +
  pathRadianceByWavelength;
```

This packet is useful for both production rendering and tests because it
separates the atmosphere's view-path effect from the object's material model.

## Object Radiance Inputs

The cleanest production contract is spectral:

```js
traceObjectRay({
  camera,
  targetPoint,
  sunDirection,
  objectLeavingRadianceByWavelength
})
```

This mode lets an existing renderer own object material, texture, BRDF,
emission, and direct scene lighting, while the atmosphere owns only the spectral
view-path transfer.

For a fully physical surface path, the atmosphere system can also provide
irradiance helpers:

```text
E_direct(lambda) =
  E_sun(lambda) * max(0, dot(normal, sun)) * T_object_to_sun(lambda)

L_lambertian(lambda) =
  reflectance(lambda) / pi * (E_direct(lambda) + E_sky(lambda))
```

`E_sky(lambda)` is hemispherical sky irradiance at the object. It requires an
incoming-direction integral over sky radiance and should be an explicit
optional subsystem, not silently folded into the view-path transfer.

External source anchor: Bruneton's demo computes Sun and sky irradiance at the
surface, applies a Lambertian albedo over `pi`, then applies
finite-segment aerial perspective with `GetSkyRadianceToPoint`.

## RGB Caller Data

If the caller only has linear RGB object colors, the atmosphere cannot
uniquely know the object's spectral radiance. Many different spectra can map to
the same RGB, and atmospheric transmittance is wavelength dependent.

Therefore the cleanroom design should support RGB objects only through an
explicit post-pipeline bridge:

- Preferred: caller supplies spectral reflectance or spectral radiance.
- Acceptable approximation: caller chooses a documented RGB-to-spectrum or
  RGB-through-atmosphere policy, with an external reference and visible
  diagnostics.
- Not acceptable: hidden per-channel tint constants or fitting knobs inside the
  transport solver.

This keeps object color changes useful without pretending that RGB input is
physically complete.

## API Shape

The public solver should make the endpoint difference explicit:

```js
traceSkyRay({
  camera,
  direction,
  sunDirection,
  wavelengthsNm,
  profile
}) -> spectralRadiancePacket

traceAtmosphereSegment({
  camera,
  targetPoint,
  sunDirection,
  wavelengthsNm,
  profile
}) -> atmosphericTransferPacket

applyAtmosphereToObjectRadiance({
  transfer,
  objectLeavingRadianceByWavelength
}) -> spectralRadiancePacket
```

`traceSkyRay` can be implemented as a convenience wrapper over the same solver
with an atmosphere-boundary target and no object radiance. The shared kernels
remain density, optical depth, transmittance, phase functions, and path
in-scattering.

## Design Requirements

- Object support is first-class, not a later display trick.
- The atmosphere owns path transmittance and path radiance.
- The caller or surface subsystem owns object material radiance.
- Surface irradiance helpers are optional but must be spectral.
- RGB object support must be labeled as an approximation unless backed by a
  chosen spectral reconstruction policy.
- Tests must include both sky rays and finite object rays.
- Parity images should include colored test surfaces at several distances, not
  only sky domes.

## Fit With Experiment 032

Experiment 032 does not prove object-color behavior by itself because it renders
only sky radiance and deliberately omits ground/object coupling for the Figure 1
target. It still provides useful kernels and constants:

- spectral grid and solar spectrum handling;
- Rayleigh/Mie density and coefficients;
- view and Sun transmittance;
- single-scattering and second-order path radiance;
- spectral-to-display consumer separation.

The production cleanroom design should generalize those kernels from an
atmosphere-boundary sky ray to a finite camera-to-object segment, then compose
the result with caller-provided object radiance.
