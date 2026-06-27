# Local Sun Second-Order Scattering Notes

Status: discussion note only. This is not canonical Algorithm32 design until it
has been implemented, validated, and promoted into the production contract.

## Goal

Local Sun should not fall out of parity with distant Sun because of missing
scattering order. One of the main goals is to show the honest implications of
a local Sun, so the comparison must not quietly give distant Sun second-order
transport while local Sun remains first-order only.

The intended parity target is:

```text
distant Sun:
  L_camera = T_view * L_scene + L1_path + L2_path

local Sun:
  L_camera = T_view * L_scene + L1_path + L2_path
```

The source abstraction may provide different source samples for distant and
local sources, but the transport contract should stay shared.

## Current POC Gap

The accepted local-Sun POC integrates finite local source samples into
first-order scattering. It explicitly defers local second-order cache work.

This is a known parity gap, not an acceptable production endpoint.

## Cached Quantity

The cache should store the first-order incident radiance used by the
second-order integral:

```text
L1_incident(samplePoint, incomingDirection, wavelength)
```

At the Algorithm32 core boundary, this should look like an incident-field
lookup, not a local-vs-distant branch:

```text
L1_incident = incidentField.sample(position, incomingDirection, wavelength)
```

Implementations may differ:

```text
distant cache:
  incidentField.sample(position, omega_i, lambda)
    -> lookup(z, omega_i, lambda)

local cache:
  incidentField.sample(position, omega_i, lambda)
    -> lookup(z, rho, omega_i, lambda)

direct oracle:
  incidentField.sample(position, omega_i, lambda)
    -> traceFirstOrderIncidentRadiance(position, omega_i, lambda)

GPU texture:
  incidentField.sample(position, omega_i, lambda)
    -> texture(cacheTexture, cacheCoordinates)
```

Once `L1_incident` is returned, the second-order accumulation should be shared
between distant and local Sun paths.

Second order then uses that cached incident radiance:

```text
L2(sample, viewDirection) =
  integral over incomingDirection:
    L1_incident(sample, incomingDirection, lambda)
    * density(sample)
    * phase(viewDirection, incomingDirection)
    * viewTransmittance(sample -> camera)
```

## Distant Sun Cache Dimensions

For the current distant directional Sun shape, the conceptual dimensions are:

```text
L1_incident(z, omega_i, lambda)
```

Where:

- `z` is atmosphere sample altitude.
- `omega_i` is the incoming-direction sample for the second-order lookup.
- `lambda` is the wavelength/spectral channel.

Wavelength may be stored as channels in the cache value rather than as a
texture dimension.

## Local Sun Cache Dimensions

For a flat/local point Sun, the proposed extra spatial coordinate is horizontal
distance from the Sun subpoint on the flat plane:

```text
L1_incident(z, rho, omega_i, lambda)
```

Where:

- `z` is sample altitude.
- `rho` is horizontal distance from the sample projection to the Sun subpoint.
- `omega_i` is the incoming-direction sample used for the second-order
  incident-radiance lookup.
- `lambda` is the wavelength/spectral channel, which may be stored as channels
  in the cache value rather than as a texture axis.

The true Euclidean distance to the Sun is derived when transport needs it:

```text
dz = sunAltitude - z
d_sun = sqrt(rho^2 + dz^2)
```

This avoids the invalid low-distance region that appears when Euclidean
distance is used directly as a cache axis. `rho = 0` is valid at every
altitude, so the cache domain stays rectangular and easier to interpolate.

This `z + rho` shape assumes the local source is radially symmetric around the
Sun subpoint. If a future cone/flashlight source is added, the working
assumption for this note is that it points straight down at the Sun subpoint
and remains circular/axisymmetric.

A cone/flashlight source can change the required cache coordinates:

- If the beam is circular and points straight down at the Sun subpoint, the
  radial symmetry still holds and `z + rho` may remain sufficient, with cone
  angle and emission profile in the source cache key.
- If the beam is tilted, elliptical, off-axis, or otherwise azimuth-dependent,
  the cache likely needs an additional source-relative angular coordinate, or
  a different source-frame parameterization, because two samples with the same
  `z` and `rho` can receive different incident source illumination.

The source configuration is a cache key, not a sampled dimension:

```text
source kind
sun position / altitude
sun brightness or luminosity policy
sun spectrum
falloff policy
emission profile / cone parameters
atmosphere profile
geometry and boundary policy
numerical settings
cache resolution
```

## Direction Sign Note

Do not invent local-only direction semantics. Directions for local second-order
work should remain analogous to distant Sun and Algorithm32 direction usage.

Proposed convention:

```text
All Algorithm32 direction vectors are unit lookup directions.
```

Examples:

```text
viewRay:
  direction from camera/origin along the ray being traced

sourceDirection:
  direction from an atmosphere sample toward the light source

incomingDirection:
  direction from a second-scattering sample along the lookup ray used to
  evaluate first-order incident radiance
```

Under this convention, first and second order use analogous phase terms:

```text
first order:
  phase(dot(viewRay, sourceDirection))

second order:
  phase(dot(viewRay, incomingDirection))
```

The physical light associated with an incident-radiance lookup may travel
opposite the lookup ray depending on radiance convention. The implementation
must choose and document one sign convention before promotion, then keep
source sampling, cache lookup, phase evaluation, shader code, and diagnostics
consistent with it.

## GPU Shape

In a GPU shader, the cache is represented as texture data built before the
final atmosphere render. The final shader samples the cache; it does not
normally build the cache during final scene rendering.

The logical cache contract should be shared between CPU and GPU even when the
storage differs:

```text
CPU direct oracle:
  no grid required; compute incident radiance directly

CPU lazy cache:
  populate cache entries as requested

CPU grid cache:
  same logical grid as the GPU cache, stored in typed arrays or another CPU
  structure

GPU texture cache:
  same logical grid packed into texture storage
```

For distant Sun, the logical cache can be packed as:

```text
2D domain -> spectral value
(z, omega_i) -> [lambda values]
```

For local Sun, the logical cache can be packed as:

```text
3D domain -> spectral value
(z, rho, omega_i) -> [lambda values]
```

Possible GPU layouts:

- `Data3DTexture`: `x = z`, `y = rho`, `z = incomingDirection slice`.
- `DataArrayTexture`: layer per incoming direction, 2D `z x rho` per layer.
- 2D atlas: one tile per incoming direction, with `z x rho` inside each
  tile.

The mathematical cache dimensions should be defined first. Texture packing is
an implementation detail as long as shader sampling preserves the same
contract.

## Direct Oracle Before Cache

The cache should be an acceleration of a direct local second-order calculation,
not a separate physics model.

Before accepting a local cache design:

1. Implement a direct local second-order oracle path, even if slow.
2. Render local first-order-only and local first-plus-second-order diagnostics.
3. Compare local closest and local `90` degree orbit against distant cases
   using the same scattering-order setting.
4. Prove the cache approximates the direct oracle within named tolerances.

## Open Questions

- Is horizontal distance from Sun subpoint sufficient for the local
  source-relative spatial coordinate once validated against the direct oracle?
- If a future cone/flashlight source is enabled, does the beam remain
  axisymmetric around the Sun subpoint, or does it require an extra
  source-relative angular coordinate?
- How should distance bins be distributed: linear, logarithmic, optical-depth
  weighted, or source-distance weighted?
- How many incoming directions are needed for local second-order parity with
  the distant path?
- Should local second-order initially target selected diagnostics, low-res
  images, or full shader parity?
- How should local second-order interact with future flashlight/spotlight Sun
  emission profiles?
- Which texture layout is the best production target for Three/WebGL:
  3D texture, texture array, or 2D atlas?

## Promotion Requirement

Before this becomes canonical design:

- implement a direct local second-order oracle path;
- verify local and distant Sun use the same scattering-order contract;
- prove the cache approximates the direct oracle within named tolerances;
- record final cache dimensions, direction signs, and texture packing in the
  production Algorithm32 contract.
