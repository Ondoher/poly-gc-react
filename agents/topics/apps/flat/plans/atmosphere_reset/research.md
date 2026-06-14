# Atmosphere Reset Research

This note resets the atmosphere work around one rule:

> Given physical constants, documented environmental conditions, numerical
> approximation controls, and explicit camera/display choices, the renderer
> should produce a plausible daylight sky and surface color without hidden
> magic-number tuning.

The immediate target is a clear-day Earth atmosphere for the
`globe-simulation` calibration scene. The flat-simulation atmosphere should
reuse the same physical inputs later, but the spherical Earth path is the
truth model because its geometry matches the real atmosphere.

## What We Are Building

We are building a physically grounded sky and airlight renderer. For each
camera pixel, the renderer should solve an approximate light-transport problem
through a chosen atmosphere geometry around a surface world:

1. Sunlight arrives from the active solar source: a distant Sun expressed as
   top-of-atmosphere spectral irradiance, or a local finite Sun expressed as
   spectral radiance/power and geometry.
2. Atmospheric molecules, aerosols, and absorbers remove some light along the
   path.
3. Some sunlight is scattered into the camera ray, creating blue sky, horizon
   haze, and airlight over distant surfaces.
4. Some camera rays hit terrain or objects; those surfaces reflect direct Sun
   and diffuse sky illumination.
5. The resulting spectral radiance is converted to human-visible color and then
   mapped through a chosen camera/display model.

The important boundary is that the atmosphere should compute radiance. RGB
display color is a final presentation step, not an input to the physics.

## Parameter Rule

Every input parameter should be one of these:

- Physical constant: Earth radius, astronomical unit, solar radius, gravity,
  molecular properties, refractive-index model, standard atmosphere values.
- Documented environmental condition: aerosol optical depth, ozone column,
  surface albedo, observer altitude, humidity/water vapor if included later.
- Numerical approximation control: wavelength sample count, ray-march step
  count, atmosphere top altitude, integration tolerance.
- Camera/display choice: exposure, aperture/shutter/ISO analog if we model a
  camera, white balance, tone mapping, output color space.

Anything else is suspect. If a value exists only because it made a screenshot
look better, it should be named as a temporary calibration bridge or removed.
For the counterfactual flat-world model, non-Earth values such as local Sun
height, local Sun radius, disk edge, dome height, or no-occlusion rules are
hypothesis parameters. They are allowed, but they must be named as proposed
physical assumptions rather than hidden tuning knobs.

## Model Families

The governing light-transport equation should not care whether the world is a
real spherical Earth with a distant Sun or a proposed flat world with a local
Sun. What changes are the physical properties queried by the integrator:

- Surface geometry: sphere, plane, finite disk, terrain mesh, or another
  explicit surface.
- Atmosphere volume: spherical shell, flat slab, dome, finite cylinder, or a
  named local computational window.
- Altitude rule: distance above a spherical surface, vertical height above a
  plane, or another documented field.
- Density field: how molecular air, aerosols, and absorbers vary with position.
- Up/normal field: radial on a sphere, constant vertical on a plane, or terrain
  normal at a surface hit.
- Solar source: distant directional solar spectrum or nearby finite luminous
  body with radius, position, spectral radiance, and motion.
- Occlusion/boundary rule: Earth blocks the Sun below the spherical horizon;
  a flat model needs an explicit boundary, dome, disk edge, terrain occluder,
  or no-occlusion rule.

This contract boundary lets the flat Earth simulation be "just changing
physical properties" at the renderer level. It is not just changing scalar
constants in the current shader. The integrator must be written against a
geometry/source contract.

### Geometry/Source Contract

A shared atmosphere integrator should ask the active model for these operations:

```text
altitudeAt(position) -> km
upAt(position) -> unit vector
densityAt(position, species) -> relative density
intersectAtmosphere(ray) -> near/far distances
intersectSurface(ray) -> optional hit
surfaceNormalAt(hit) -> unit vector
sunDirectionsAt(position) -> one direction or sampled finite disk directions
solarRadiance(lambda, direction_or_sample) -> W / m2 / sr / nm
sunVisibility(position, direction) -> 0..1 or boolean
```

The scattering math then stays the same:

```text
surface_radiance * view_transmittance + in_scattered_radiance
```

But the path lengths, altitudes, Sun angles, and source irradiance come from
the active model.

### Real Globe Configuration

The real-world calibration configuration is:

```text
surface: sphere(center, R_earth)
atmosphere: spherical shell(R_earth, R_earth + H_top)
altitude: length(position - center) - R_earth
up: normalize(position - center)
solar source: distant Sun with spectral irradiance at 1 AU
```

For sky scattering, the Sun can be approximated as directional:

```text
E_sun_TOA(lambda, date) =
  E_sun_1AU(lambda) * (AU / sun_distance(date))^2
```

The sample-to-Sun path exits the spherical atmosphere. The planet itself
occludes the Sun when that path intersects the solid Earth.

### Flat World With Local Sun Configuration

A proposed flat model should be represented as a different physical world and
source configuration:

```text
surface: plane(z = 0) or finite disk
atmosphere: slab(0 <= z <= H_top), dome, finite cylinder, or finite local patch
altitude: z
up: (0, 0, 1)
solar source: finite sphere or disk at position S(t)
```

The atmosphere can still use the same exponential density law if the model
keeps approximately constant downward gravity and temperature:

```text
rho_R(z) = exp(-z / H_R)
rho_M(z) = exp(-z / H_M)
```

The local Sun should be parameterized by spectral radiance or spectral power,
not by an RGB brightness multiplier. For a finite solar disk seen from a point
`x`, direct irradiance is:

```text
E_direct(x, normal, lambda) =
  integral_sun_disk [
    L_sun(lambda)
    * T_sun_to_x(lambda, direction)
    * max(dot(normal, direction), 0)
  ] d_omega
```

For a small local Sun disk, a useful approximation is:

```text
E_direct ~= L_sun(lambda) * Omega_sun(x) *
  T_sun_to_x(lambda) * max(dot(normal, sun_dir), 0)

Omega_sun(x) = 2 * pi * (1 - sqrt(d^2 - R_sun_local^2) / d)
Omega_sun(x) ~= pi * (R_sun_local / d)^2   when R_sun_local << d
```

Where:

- `L_sun(lambda)` is solar spectral radiance.
- `Omega_sun(x)` is the solid angle of the local Sun as seen from `x`.
- `d = length(S(t) - x)`.
- `sun_dir = normalize(S(t) - x)`.

This replaces the globe model's nearly constant top-of-atmosphere solar
irradiance with a position-dependent finite-source calculation. The same source
also drives in-scattering by using the direction, transmittance, and phase
function from each atmosphere sample toward the local Sun.

### Local Sun Calibration

A flat local Sun can be physically parameterized without magic numbers by
choosing observable target properties at a reference observer:

- Reference observer position.
- Reference Sun altitude/azimuth or local Sun position.
- Reference apparent angular radius.
- Reference direct normal irradiance at the surface.
- Solar spectral shape, usually the same measured solar spectrum normalized to
  the chosen irradiance.

If the local Sun should match the real Sun's apparent angular radius at the
reference observer:

```text
R_sun_local / d_reference ~= R_sun_real / AU ~= 0.00465
```

If it should also match a target direct normal irradiance at that observer,
choose `L_sun(lambda)` so that:

```text
E_target(lambda) =
  L_sun(lambda) * Omega_sun(reference)
  * T_sun_to_reference(lambda)
```

That is a physical calibration rule. It will still create consequences away
from the reference observer: distance falloff, changing angular size, changing
incidence angle, and different atmospheric path lengths. Those consequences are
exactly what the simulation should reveal rather than hide.

### Flat Model Consequences

A flat atmosphere with a local Sun changes the rendered sky in ways that are
not cosmetic:

- There is no spherical geometric horizon unless the model adds a finite edge,
  dome, terrain, or other occluder.
- Near-horizontal rays through a slab can travel a very long distance in dense
  air. A finite atmosphere boundary is therefore a physical model choice, not
  just a renderer optimization.
- Sunlight is no longer approximately parallel across the scene. Surface
  lighting, scattering angle, and sample-to-Sun path length vary strongly with
  position.
- A nearby Sun has a larger and variable solid angle unless radius and height
  are chosen to match the real apparent Sun only at one reference point.
- Inverse-square falloff becomes visible across large flat-world distances
  unless the source is given a different physical emission model.
- The same Rayleigh/Mie coefficients can be reused, but the optical paths they
  integrate over will be different, so sky color can change dramatically without
  changing air chemistry.

This is useful for the project: the flat simulation can reuse the same
atmospheric physics while swapping the world geometry and solar source. If the
result looks unlike Earth, that is evidence from the chosen physical
properties, not a renderer failure.

## Physical Properties

### Planet Geometry

Earth is modeled as a sphere with mean radius `R_earth`, plus a spherical
atmosphere shell with top radius:

```text
R_atmosphere = R_earth + H_top
```

Useful starting values:

- Mean Earth radius: `6371.0088 km`.
- Atmosphere top for optical integration: often `80-120 km`; `100 km` is a
  reasonable first cutoff for visible scattering because most mass is below it.

Contribution:

- Determines camera-ray path length through the atmosphere.
- Determines solar-ray path length from each sample point.
- Produces real horizon behavior and long grazing paths near the horizon.

Simplification:

- Use a spherical Earth rather than ellipsoid. The sky-color error is small
  compared with aerosol uncertainty, and it keeps the first implementation
  tractable.

References:

- U.S. Standard Atmosphere, 1976, NOAA/NASA/USAF.
- Bruneton, "Precomputed Atmospheric Scattering: a New Implementation":
  https://ebruneton.github.io/precomputed_atmospheric_scattering/

### Solar Geometry

The Sun is located relative to the observer by date, time, latitude, longitude,
Earth axial tilt, Earth rotation, and Earth-Sun distance.

Useful values:

- Astronomical unit: `149597870.7 km`.
- Mean solar radius: `696340 km`.
- Earth axial tilt: about `23.43928 deg`.
- Solar constant near 1 AU: about `1361 W/m2` integrated over wavelength.

Contribution:

- Sun direction controls the scattering angle and surface incidence.
- Sun distance controls top-of-atmosphere irradiance by inverse square law.
- Solar angular radius matters for rendering the solar disk and for very
  accurate near-Sun scattering.

Simplification:

- Treat the Sun as directional for sky scattering at first. The solar disk is
  only about `0.53 deg` wide, so a directional Sun is fine for most sky pixels.
- Render the visible solar disk separately using angular size and solar
  radiance, not by coloring an AU-distant mesh with arbitrary emissive RGB.

References:

- NREL/NLR solar spectra and ASTM G-173 reference spectra:
  https://www.nlr.gov/grid/solar-resource/spectra
- ASTM G-173 AM1.5 reference spectra:
  https://www.nlr.gov/grid/solar-resource/spectra-am1.5

### Solar Spectrum

The physically correct input is spectral solar irradiance:

```text
E_sun_TOA(lambda)  [W / m2 / nm]
```

The wavelength-integrated solar constant is useful as a sanity check, but it is
not enough for color. Rayleigh scattering varies strongly by wavelength, so the
renderer needs several visible wavelength samples and a final spectral-to-color
conversion.

Contribution:

- Provides the source energy for direct sunlight and sky scattering.
- Determines warm/cool balance after atmospheric filtering.
- Prevents "RGB Sun color times scalar irradiance" from becoming a hidden
  color-tuning knob.

Simplification:

- Sample the visible spectrum at a modest number of wavelengths, such as
  `15-31` samples from about `360-830 nm`, then integrate to CIE XYZ.
- Use a known reference spectrum instead of a blackbody-only approximation.
  A `5778 K` blackbody is useful for intuition, but real solar spectra include
  absorption structure and standardized irradiance datasets already exist.

References:

- NREL/NLR reference solar spectra:
  https://www.nlr.gov/grid/solar-resource/spectra
- ASTM G-173 AM1.5 reference spectra:
  https://www.nlr.gov/grid/solar-resource/spectra-am1.5
- CIE 1931 2-degree color-matching functions:
  https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer

### Atmospheric Density

The ideal physical model starts with hydrostatic equilibrium and the ideal gas
law:

```text
dP/dh = -rho(h) * g(h)
P = rho * R_specific * T
```

If temperature is known as a function of altitude, pressure and density can be
derived. For the first renderer, we can use exponential density profiles:

```text
rho_R(h) = exp(-h / H_R)
rho_M(h) = exp(-h / H_M)
```

Typical scale heights:

- Molecular/Rayleigh scale height `H_R`: about `8 km`.
- Aerosol/Mie scale height `H_M`: often about `1-2 km`, depending on local
  conditions.

Contribution:

- Controls how much material exists at each altitude.
- Makes blue sky strongest near denser air.
- Makes haze concentrate near the ground.

Simplification:

- Use exponential profiles for first-pass rendering. This is the common
  real-time atmosphere approximation and is reasonable because visible
  scattering is dominated by low altitudes.
- Keep a later path open for tabulated U.S. Standard Atmosphere density,
  pressure, and temperature.

References:

- U.S. Standard Atmosphere, 1976, NOAA/NASA/USAF.
- Bruneton atmosphere implementation notes:
  https://ebruneton.github.io/precomputed_atmospheric_scattering/

### Rayleigh Scattering

Rayleigh scattering is molecular scattering by particles much smaller than the
wavelength of visible light. Its wavelength dependence is approximately:

```text
beta_R(lambda) proportional to 1 / lambda^4
```

At sea level, many atmosphere renderers use RGB-equivalent coefficients near:

```text
beta_R = (0.005802, 0.013558, 0.033100) 1/km
```

Those RGB coefficients are useful for comparison, but the reset implementation
should derive or tabulate spectral `beta_R(lambda)` and integrate to color at
the end.

Rayleigh phase function:

```text
P_R(cos_theta) = 3 / (16 * pi) * (1 + cos_theta^2)
```

Contribution:

- Dominates clear blue daylight sky.
- Is symmetric forward/backward, so sky brightness is strong both near and
  opposite the Sun, with a minimum near `90 deg` scattering angle.
- Provides the basic reason shorter wavelengths scatter more strongly.

Simplification:

- Ignore polarization initially. Rayleigh scattering is polarized, especially
  near `90 deg` from the Sun, but polarization is not needed for first-order
  sky color.

References:

- PBRT v4, volume scattering phase functions:
  https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions
- Bruneton atmosphere implementation:
  https://ebruneton.github.io/precomputed_atmospheric_scattering/

### Aerosols And Mie Scattering

Aerosols are larger particles: dust, salt, smoke, pollution, and water droplets.
They scatter more broadly across visible wavelengths and are strongly
forward-scattering.

Aerosol optical depth is commonly parameterized by the Angstrom relation:

```text
tau_A(lambda) = tau_A(lambda0) * (lambda / lambda0)^(-alpha)
```

Where:

- `tau_A(lambda0)` is aerosol optical depth at a reference wavelength such as
  `500 nm` or `550 nm`.
- `alpha` is the Angstrom exponent.

Aerosol extinction can be related to scale height:

```text
beta_M_ext(lambda, sea_level) = tau_A(lambda) / H_M
```

If single-scattering albedo is `omega_M`:

```text
beta_M_sca = omega_M * beta_M_ext
beta_M_abs = (1 - omega_M) * beta_M_ext
```

Common phase approximation: Henyey-Greenstein:

```text
P_HG(cos_theta, g) =
  (1 - g^2) / (4 * pi * (1 + g^2 - 2 * g * cos_theta)^(3/2))
```

Typical `g` for aerosols is around `0.7-0.9`.

Contribution:

- Adds white/gray horizon haze.
- Brightens the sky around the Sun.
- Reduces saturation and visibility along long paths.
- Can make the horizon brown or dirty if tuned to compensate for other errors.

Simplification:

- Use one aerosol population with one optical depth, one scale height, one
  single-scattering albedo, one Angstrom exponent, and one `g`.
- Do not tune aerosols until the spectral pipeline and display mapping are
  coherent, because aerosol values can easily hide upstream mistakes.

References:

- NASA AERONET aerosol optical depth concepts:
  https://aeronet.gsfc.nasa.gov/
- PBRT v4, Henyey-Greenstein phase function:
  https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions
- ASTM G-173 reference conditions include Angstrom turbidity:
  https://www.nlr.gov/grid/solar-resource/spectra-am1.5

### Absorption

Absorption removes light without scattering it into the view ray. The first
visible absorber worth including is ozone, especially for long slant paths and
twilight.

Ozone optical contribution:

```text
beta_ozone_abs(lambda, h) =
  sigma_ozone(lambda) * number_density_ozone(h)
```

Contribution:

- Weakly absorbs visible light in the Chappuis bands.
- Matters more for long atmospheric paths.
- Helps prevent an over-simple Rayleigh/Mie model from producing unrealistic
  colors near the horizon and at low Sun angles.

Simplification:

- For clear noon calibration, ozone can be deferred or included with a simple
  prescribed vertical density profile and measured cross-section table.
- Water vapor and other gases can wait unless we need spectral accuracy beyond
  visible RGB appearance.

References:

- Ozone Chappuis absorption band overview:
  https://en.wikipedia.org/wiki/Chappuis_absorption
- Bruneton implementation includes ozone and dimensional checks:
  https://ebruneton.github.io/precomputed_atmospheric_scattering/

### Optical Depth And Transmittance

Extinction coefficient:

```text
beta_t(lambda, x) =
  beta_R(lambda, x)
  + beta_M_ext(lambda, x)
  + beta_abs(lambda, x)
```

Optical depth along a path:

```text
tau(lambda) = integral beta_t(lambda, x(s)) ds
```

Transmittance:

```text
T(lambda) = exp(-tau(lambda))
```

Contribution:

- Dims direct sunlight before it reaches a surface.
- Dims surface radiance before it reaches the camera.
- Dims sunlight before it reaches each in-scattering sample.
- Creates redder sunlight at long air mass because shorter wavelengths are
  removed more strongly.

Simplification:

- Compute numeric ray integrals through the spherical atmosphere.
- For shader performance, use fixed sample counts first. Later, introduce
  precomputed transmittance lookup tables or adaptive CPU references if needed.
- Avoid horizon clamps such as `max(cos_sun_zenith, 0.03)` in the reference
  model. Such clamps can be kept only as explicitly named shader stability
  approximations and must be compared against the reference integrator.

Reference:

- PBRT v4, transmittance and Beer-Lambert attenuation:
  https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance

### Single Scattering

The ideal radiative transfer equation is:

```text
dL(x, direction, lambda) / ds =
  -beta_t(x, lambda) * L(x, direction, lambda)
  + beta_s(x, lambda) * integral P(direction_i -> direction) *
      L_i(x, direction_i, lambda) d_omega_i
```

For first-pass clear sky, simplify to single scattering from the Sun:

```text
L_sky(lambda) =
  integral_view [
    T_camera_to_sample(lambda)
    * (
      beta_R_sca(lambda, sample) * P_R(cos_theta)
      + beta_M_sca(lambda, sample) * P_M(cos_theta)
    )
    * E_sun_TOA(lambda)
    * T_sun_to_sample(lambda)
  ] ds
```

Where:

- `T_camera_to_sample` is transmittance from the sample to the camera.
- `T_sun_to_sample` is transmittance from space to the sample along the Sun
  direction.
- `cos_theta` is the angle between incoming Sun direction and outgoing camera
  direction, with a convention that must be tested carefully.

Contribution:

- Produces sky color for rays that do not hit geometry.
- Adds airlight over surfaces for rays that do hit geometry.
- Provides the core atmosphere pass:
  `surface_radiance * T_view + in_scattered_radiance`.

Simplification:

- Use single scattering first. Multiple scattering is real and matters for sky
  brightness and horizon color, but single scattering is the right debug target
  because every term can be inspected.
- Add multiple scattering only after the single-scattering reference matches
  expected physical behavior.

References:

- PBRT v4, volume scattering:
  https://www.pbr-book.org/4ed/Volume_Scattering
- Bruneton precomputed scattering:
  https://ebruneton.github.io/precomputed_atmospheric_scattering/

### Multiple Scattering

Multiple scattering is light that scatters more than once before reaching the
camera. It brightens shadows, lifts horizon luminance, and changes sky color in
ways single scattering cannot fully reproduce.

Contribution:

- Makes the sky brighter and less harsh than pure single scattering.
- Adds indirect sky illumination to the ground.
- Improves low-Sun and horizon realism.

Simplification:

- Defer it for the first reset implementation.
- Use a CPU reference and image comparisons to decide when single scattering is
  no longer enough.
- If needed, adopt a known precomputation approach rather than inventing a
  fragile approximation.

Reference:

- Bruneton precomputed atmospheric scattering:
  https://ebruneton.github.io/precomputed_atmospheric_scattering/

### Surface Reflection

For a matte Lambertian surface:

```text
L_surface(lambda) =
  albedo(lambda) / pi *
  (
    E_direct(lambda) * max(dot(normal, sun_dir), 0)
    + E_diffuse_sky(lambda)
  )
```

Direct irradiance:

```text
E_direct_surface(lambda) =
  E_sun_TOA(lambda) * T_sun_to_surface(lambda)
```

Diffuse sky irradiance:

```text
E_diffuse_sky(lambda) =
  integral_hemisphere L_sky(lambda, omega) *
    max(dot(normal, omega), 0) d_omega
```

Contribution:

- Makes terrain, globe surface, and markers respond to physical sunlight.
- Prevents surface brightness from being tuned independently of sky brightness.
- Lets red markers become pink only if physically plausible sky airlight and
  surface reflection predict that outcome.

Simplification:

- Start with Lambertian albedo.
- Use measured or named albedo values for diagnostic surfaces.
- Compute diffuse sky irradiance by integrating sky radiance over a hemisphere,
  not by multiplying removed direct sunlight by an arbitrary fraction.

References:

- PBRT reflection and radiometry background:
  https://www.pbr-book.org/
- CIE and NREL references for spectral-to-visible conversion and solar input:
  https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer
  https://www.nlr.gov/grid/solar-resource/spectra

### Observer, Camera, And Display

The atmosphere produces spectral radiance:

```text
L(lambda) [W / m2 / sr / nm]
```

The display needs RGB code values. The physically grounded path is:

```text
spectral radiance -> CIE XYZ -> display RGB -> tone mapped output
```

Spectral to CIE XYZ:

```text
X = integral L(lambda) * x_bar(lambda) d_lambda
Y = integral L(lambda) * y_bar(lambda) d_lambda
Z = integral L(lambda) * z_bar(lambda) d_lambda
```

Then convert XYZ to a working RGB space, such as linear sRGB. Finally apply an
explicit exposure and tone mapper.

Contribution:

- Separates physics from presentation.
- Makes display brightness a camera/display choice, not a hidden atmosphere
  coefficient.
- Prevents an irradiance scalar such as `1 / 340.25` from pretending to be a
  real radiance-to-display mapping.

Simplification:

- Use a simple named exposure and tone mapper first.
- Later, decide whether the project wants camera-like controls, perceptual
  adaptation, or an artistic display bridge for screenshots.

Reference:

- CIE 1931 2-degree color-matching functions:
  https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer

## Pixel Calculation

For each pixel:

1. Build the camera ray in world coordinates.
2. Intersect the ray with scene geometry and with the active atmosphere volume.
3. Determine the integration segment:
   - If the ray hits a surface, integrate from camera to surface.
   - If it misses, integrate from camera to the atmosphere exit or model
     boundary.
4. For each wavelength sample, initialize:
   - `view_optical_depth = 0`
   - `in_scattered_radiance = 0`
5. March along the camera ray.
6. At each sample:
   - Compute altitude from the active geometry model.
   - Compute molecular density and aerosol density.
   - Compute Rayleigh scattering/extinction.
   - Compute aerosol scattering/extinction.
   - Compute absorber extinction if enabled.
   - Integrate camera-to-sample optical depth.
   - Trace or integrate the sample-to-Sun path through the active atmosphere.
   - For a distant Sun, use the single Sun direction.
   - For a finite local Sun, sample or approximate the solar disk solid angle.
   - Compute Sun transmittance and source radiance/irradiance at the sample.
   - Compute phase functions from each Sun/view scattering angle.
   - Add single-scattered solar radiance into the camera ray.
7. If the ray hit a surface:
   - Compute direct solar irradiance at the surface from the active source.
   - Compute or sample diffuse sky irradiance.
   - Compute surface spectral radiance from albedo and lighting.
   - Attenuate surface radiance by camera-to-surface transmittance.
8. Add:

```text
L_pixel(lambda) =
  L_surface(lambda) * T_camera_to_surface(lambda)
  + L_in_scattered(lambda)
```

9. Convert `L_pixel(lambda)` to CIE XYZ.
10. Convert XYZ to linear RGB.
11. Apply exposure and tone mapping.
12. Write display RGB.

## Current Implementation Weaknesses This Reset Should Avoid

- Do not treat RGB as the physical transport domain if the stated goal is
  physical constants to realistic color. RGB approximations are acceptable only
  as a documented performance shortcut compared against a spectral reference.
- Do not use irradiance-to-scene scales as a hidden display model. A value like
  `1 / 340.25` is not a physical camera response.
- Do not estimate diffuse sky light as removed direct sunlight times a fixed
  fraction. Diffuse sky irradiance should come from sky radiance integrated
  over the hemisphere.
- Do not tune aerosols to fix muted sky color until the spectral and display
  bridge is coherent.
- Do not render the Sun as a world-space mesh whose emissive RGB is multiplied
  by irradiance. The solar disk should be angular and radiance based.
- Do not treat a flat atmosphere's edge, dome, or view-distance limit as a
  hidden renderer hack. Without spherical curvature, this boundary becomes part
  of the physical model and must be explicit.
- Do not rely on fixed screen-coordinate probes as physical tests. Probes
  should be tied to view directions, scattering angles, altitudes, and known
  radiometric quantities.
- Do not leave shader-only approximations untested. The reset needs a CPU
  reference integrator that the shader can be compared against.

## Recommended Implementation Path

The detailed implementation checklist lives in [Plan](plan.md), and the
implementation contract lives in [Design](design.md).

1. Write a small CPU spectral reference integrator.
   - Inputs: world geometry, atmosphere volume, solar source, spectral solar
     radiance/irradiance, atmosphere profile, observer, ray direction.
   - Outputs: spectral radiance, XYZ, linear RGB, and diagnostic optical depths.
2. Write reference tests before implementing each physical subsystem.
   - Start with failing tests for analytic answers and physical invariants.
   - Implement only after the expected result is written down.
3. Add reference tests for physical invariants.
   - Higher Rayleigh optical depth at shorter wavelengths.
   - Longer optical paths near the horizon.
   - Direct solar transmittance decreases with air mass.
   - Rayleigh-only sky is blue under noon daylight.
   - Aerosol increase desaturates and brightens horizon haze.
   - Globe and flat configurations use the same scattering math but produce
     different path lengths, Sun angles, and source irradiance.
4. Replace the display bridge with an explicit radiance-to-color path.
5. Compute surface direct irradiance from the same spectral Sun/transmittance.
6. Compute diffuse sky irradiance from hemisphere integration.
7. Port the validated reference model to the shader.
8. Compare shader output against the CPU reference before tuning environment
   values.

## Reference Set

- U.S. Standard Atmosphere, 1976, NOAA/NASA/USAF: standard pressure,
  temperature, density, and composition profile for an idealized atmosphere.
- NREL/NLR solar spectra:
  https://www.nlr.gov/grid/solar-resource/spectra
- ASTM G-173 AM1.5 reference spectra:
  https://www.nlr.gov/grid/solar-resource/spectra-am1.5
- CIE 1931 2-degree color-matching functions:
  https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer
- PBRT v4, transmittance:
  https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance
- PBRT v4, phase functions:
  https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions
- Eric Bruneton, "Precomputed Atmospheric Scattering: a New Implementation":
  https://ebruneton.github.io/precomputed_atmospheric_scattering/
- NASA AERONET aerosol data and concepts:
  https://aeronet.gsfc.nasa.gov/
