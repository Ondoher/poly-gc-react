# Spherical Sun Atmosphere Plan

Goal: create a correct-geometry atmosphere calibration view before continuing
flat-model atmosphere tuning. For now, the Sun is the only modeled celestial
body; the selected bright stars are calibration evidence for daytime
visibility, not a full celestial-object scope.

The reason for this plan is that a realistic atmosphere model may be hard to
judge when rendered through intentionally wrong flat-model geometry. The
spherical model should become the calibration reference for Earth-like physical
inputs. The flat model should then reuse those inputs and reveal the
consequences of its geometry, rather than being tuned until it looks normal.

## Calibration Stance

Default values should approximate the real world:

- solar output and spectrum
- Sun angular size or Earth-like target irradiance
- atmosphere composition
- Rayleigh coefficients
- aerosol optical depth, albedo, and Angstrom exponent
- Mie anisotropy and aerosol scale height
- observer elevation
- surface albedo
- human/display exposure

The spherical view should use correct geometry. The flat view should use the
same physical defaults unless the user explicitly changes them. This keeps the
comparison honest:

```text
real physical inputs + correct geometry = calibration reference
real physical inputs + false geometry = model consequences
```

## Scope

In scope:

- one observer on spherical Earth, starting with San Jose
- one Sun
- 50 brightest northern-celestial-hemisphere stars from the existing flat POC
  star fixture as a daytime visibility calibration layer
- spherical-shell atmosphere
- daytime sky, sun visibility, and surface irradiance probes
- reusable services/models outside React where possible

Out of scope for this first pass:

- broader star catalogs, constellations, planets, Moon, and catalog ingestion
- terrain
- clouds
- complex weather
- multiple scattering
- full HDR camera simulation

## Active Plan: Globe Atmosphere Integration

Status: active. Phases 1 through 4.4 are implemented; the next useful work is
Phase 4.5 or 4.6.

With the globe scene, Sun state, observer camera, matte Earth surface,
synthetic red mountain markers, spherical atmosphere composer, physical solar
source probes, radiometric display bridge, and radiometric surface lighting in
place, the remaining work is calibration and cleanup rather than basic
integration. The immediate visual symptoms are a muted blue-gray sky, brown
horizon at some viewing angles, and pink/red marker shifts where atmosphere
airlight is added over red radiometric surfaces.

Implementation phases:

1. Add globe atmosphere uniform adaptation. Status: implemented.
   - Reuse the shared `Atmosphere` profile and `Sun`/light-source data.
   - Adapt `scene.atmosphere.frame.kind === "spherical-shell"` into shader
     uniforms.
   - Feed the date-derived real Sun from `scene.sun.position`,
     `scene.sun.radiusKm`, and the globe solar-source fields.

2. Add a globe solid-scene render target. Status: implemented.
   - Render the globe surface, synthetic mountain markers, Sun, and other solid
     objects to color/depth textures.
   - Keep the globe scene model as the source of truth for Earth radius,
     observer position, camera, Sun position, and atmosphere frame.
   - Preserve render-target color space and final shader output conversion so
     this phase remains visually neutral before atmosphere scattering is added.
   - Exclude placeholder atmosphere shell geometry from the solid pass; sky
     color should come from the composition shader, not translucent geometry.
   - Include the selected bright-star evidence layer without depth writes so
     the atmosphere composer can test whether daytime sky in-scattering
     overwhelms external star radiance.

3. Add a `GlobeAtmosphereComposer`. Status: implemented; physical/display
   refinement remains active.
   - Reconstruct camera rays from the globe camera and depth buffer.
   - For solid pixels, integrate atmosphere from the camera to the depth hit.
   - For no-depth sky pixels, integrate to the spherical atmosphere shell exit.
   - Use spherical altitude:

     ```text
     altitudeKm = length(samplePosition - planetCenter) - planetRadiusKm
     ```

   - Initial implemented composition:

     ```text
     finalPixel =
       sceneColor * cameraToSceneTransmittance
       + cameraRayInScattering
     ```

   - The current shader uses 32 view samples, camera-basis sky-ray
     reconstruction, spherical altitude, spherical ground/atmosphere
     intersections, Rayleigh/Mie phase terms, and an air-mass-style
     sample-to-sun transmittance approximation.

4. Verify against the current mountain markers. Status: in progress.
   - The red markers should remain grounded on the rendered sphere.
   - Distance should visibly affect transmittance and airlight.
   - The sky should become daylight blue from the real Sun and Earth-like
     atmosphere profile rather than flat-model tuning.
   - The selected bright stars should disappear in daytime because atmospheric
     in-scattering dominates them, not because the renderer manually hides
     them.
   - Current state: markers are grounded with a small visual contact inset
     (`0.02 km`) to avoid depth fighting with the globe surface. Star probe
     captures are sky-colored rather than bright star pixels. The sky color and
     horizon color are still wrong enough to need Phase 4.6 calibration.

5. Compare with flat only after the globe path is stable.
   - Reuse the same physical atmosphere defaults in both geometries.
   - Treat differences as geometry/source consequences, not as values to hide
     with flat-specific magic constants.

Verification:

- Unit tests for globe atmosphere uniform adaptation and spherical frame values.
- `npm run test:ui:flat`
- `npm run build`
- Browser check for nonblank render, blue sky, grounded red markers, and
  visible atmospheric attenuation with distance.

## Phase 0A: Globe Simulation Feature Shell

Status: implemented.

- Added `src/flat/features/globe-simulation` as a sibling page feature inside
  the existing `flat` app.
- Registered the `globe-simulation` page at `/flat/globe-simulation` through
  the existing `app-pages` and `views` services.
- Added the first `GlobeSimulationSceneModel` contract with San Jose as the
  observer, spherical Earth geometry, `frame.kind: 'spherical-shell'`,
  clear-day Earth atmosphere defaults, Earth-like solar-source defaults, and a
  fixed initial Sun altitude/azimuth.
- Added a simple React/CSS shell for the page and focused scene-model tests.

Verification:

- `npm run test:ui:flat`
- `npm run build`

## Phase 0: Contract And Reuse Audit

Status: mostly implemented.

- Inventory reusable pieces already present in `src/flat/shared`:
  `Atmosphere`, `Sun`, math helpers, observer/location fields, and animation
  time service.
- Identify which flat-simulation pieces are flat-specific and should not be
  reused directly.
- Define a spherical scene model contract with observer, Sun, atmosphere,
  surface, and render settings. Implemented for the current
  `globe-simulation` feature.
- Keep the contract framework-free so React is only presentation.

Verification:

- Unit tests for the spherical scene model defaults.
- No browser view required yet.

## Phase 1: Spherical Geometry And Sun State

Status: implemented for the current calibration scope.

- Add a spherical observer frame:
  latitude, longitude, elevation, local ENU basis, Earth radius, and world
  position.
- Resolve Sun position for an initial fixed daytime calibration pose.
  Start with a known simple pose if full ephemeris is not ready:

  ```text
  sunAltitudeDeg ~= 45
  sunAzimuthDeg ~= 180
  ```

- Then add a real solar-position resolver for date/time/location if the local
  codebase already has a suitable path, or introduce a focused shared module.
- Represent the Sun from date-derived real solar-system state for the current
  calibration scene. The atmosphere source should derive from Earth-like solar
  irradiance rather than a nearby point-light hack.

Verification:

- Tests confirm ENU basis orientation.
- Tests confirm Sun altitude/azimuth converts to a normalized world direction.
- Tests confirm the directional Sun exposes Earth-like source fields.

## Phase 2: Minimal Spherical Atmosphere View

Status: implemented; visual calibration remains intentionally unfinished.

- Use the existing `globe-simulation` page as the spherical Sun/atmosphere
  calibration view.
- Render the existing globe surface and synthetic mountain markers through a
  globe atmosphere composer.
- Use `Atmosphere` with `frame.kind: 'spherical-shell'`.
- Use the existing depth-aware composition shape where practical, but avoid
  importing flat-simulation-only scene contracts.
- Use the correct spherical atmosphere exit distance for background sky rays.
- For solid ground pixels, compose:

  ```text
  finalPixel = surfaceRadiance * viewTransmittance + cameraRayInScattering
  ```

Verification:

- Browser capture shows nonblack sky and no shader/WebGL errors.
- Capture samples include upper sky, near-sun sky, horizon, and ground.
- `npm run test:ui:flat`
- `npm run build`
- `git diff --check`

## Phase 3: Physical Solar Source Defaults

Status: implemented for first-pass probes; renderer/display calibration remains
Phase 4.

- Replace atmosphere source tuning in the spherical view with explicit
  real-world defaults:

  ```text
  totalSolarIrradianceWm2 ~= 1361 at top of atmosphere
  colorTemperatureK ~= 5778
  clear-sky direct normal irradiance target near surface ~= 900-1050 W/m^2
  ```

- Decide whether the renderer derives an internal source scale from physical
  irradiance plus exposure, or temporarily caches a derived value while the
  display bridge is introduced. The current implementation keeps the derived
  value as a legacy diagnostic and uses the named display bridge for globe
  atmosphere in-scattering.
- Add named probes for:

  ```text
  topOfAtmosphereIrradianceWm2
  directNormalIrradianceAtObserverWm2
  directHorizontalIrradianceAtObserverWm2
  estimatedDiffuseSkyIrradianceWm2
  ```

- `GlobeSimulationSceneModel` now derives:

  ```text
  topOfAtmosphereIrradianceWm2 =
    totalSolarIrradianceWm2 * (astronomicalUnitKm / sunDistanceKm)^2

  directNormalIrradianceAtObserverWm2 =
    topOfAtmosphereIrradianceWm2 * luminanceWeightedDirectSunTransmittance

  directHorizontalIrradianceAtObserverWm2 =
    directNormalIrradianceAtObserverWm2 * max(sin(sunAltitude), 0)

  estimatedDiffuseSkyIrradianceWm2 =
    max(topOfAtmosphereIrradianceWm2 - directNormalIrradianceAtObserverWm2, 0)
      * max(sin(sunAltitude), 0)
      * diffuseSkyIrradianceLossFraction
  ```

- The globe model still exposes a legacy compatibility probe derived from
  named physical values:

  ```text
  rendererAtmosphereSourceScale =
    topOfAtmosphereIrradianceWm2 / rendererIrradianceReferenceWm2
  ```

  This value is no longer consumed by the globe atmosphere shader source term.
  It remains available as diagnostics/compatibility until the display and
  surface-lighting path no longer needs the old bridge vocabulary.

Verification:

- Tests confirm derived irradiance values respond to sun altitude and
  atmosphere transmittance.
- Captures record visual samples and numeric irradiance probes together.

## Phase 4: Exposure And Human-View Display Bridge

Status: active.

Goal: replace the remaining unitless brightness bridges with a physical
radiance/irradiance-to-display pipeline. This phase should make the globe view
look plausible by changing observation/display mapping, not by pushing
atmosphere coefficients or solar constants away from real-world values.

4.1. Define internal radiometric outputs.
   Status: implemented for the shared model and globe scene contract.
   - Keep physical irradiance/radiance separate from display exposure.
   - Make the atmosphere shader/source contract explicit about whether a value
     represents irradiance, radiance, relative radiance, or display RGB.
   - Keep the existing physical probes stable while this changes.
   - Concrete next implementation step:
     - Add a framework-free shared display model at
       `src/flat/shared/RadiometricDisplay.js`. Status: implemented.
     - The first API should be small and plain-data oriented:

       ```js
       createRadiometricDisplayConfig({
       	radiometricToSceneRgbScale,
       	exposure,
       	toneMapping,
       })

       mapRadianceToDisplayRgb(rgbRadiance, displayConfig)
       ```

     - The first mapping may be intentionally simple:

       ```text
       exposedRgb = rgbRadiance
         * radiometricToSceneRgbScale
         * exposure

       toneMapping = 'linear-clamp' | 'reinhard'
       displayRgb = toneMap(exposedRgb)
       ```

       Status: implemented with `linear-clamp` and `reinhard`.

     - Add explicit display settings to the globe scene model, separate from
       `scene.atmosphere` and `scene.sun`:

       ```js
       scene.display = {
       	model: 'radiometric-display-v1',
       	radiometricToSceneRgbScale: <number>,
       	exposure: <number>,
      	toneMapping: 'reinhard',
       }
       ```

       Status: implemented. `GlobeSimulationSceneModel` now exposes normalized
       `scene.display` settings from the shared display model.

     - Keep the current shader behavior working. The existing
       `sun.irradiance.renderer.atmosphereSourceScale` should remain marked as
       a compatibility input for the old shader source term until 4.2 replaces
       it.
       Status: unchanged and still the active shader compatibility input.
     - Add globe panel diagnostics for display state:

       ```text
       Display model
       Exposure
       Tone mapping
       Radiometric scale
       ```

       Status: implemented in the globe diagnostics panel.

     - Add unit tests:
       - zero radiance maps to black
       - increasing exposure increases mapped output
       - Reinhard tone mapping compresses high values below display white
       - linear clamp clips high values at display white
       - unknown tone mapping fails loudly
       - `GlobeSimulationSceneModel` exposes display settings separately from
         atmosphere profile and solar irradiance probes
       Status: implemented.
     - Verification for this subphase:
       - `npm run test:ui:flat` passed with 107 specs.
       - `npm run build` passed.
       - Browser capture `/flat/globe-simulation` remains optional for the next
         visual shader/display step because this subphase only adds scene
         metadata and diagnostics.
       - Existing physical solar probe tests remain unchanged while display
         settings are added.
       - visual output may remain nearly unchanged; success is the contract
         boundary, not final sky color

4.2. Replace `solarIrradianceScale` as a hand-tuned source term.
   Status: implemented for the globe atmosphere shader.
   - Treat current `sunSolarIrradianceScale` as a compatibility bridge only.
   - Derive the atmosphere source from named solar-source properties:

     ```text
     totalSolarIrradianceWm2
     sunDistanceKm
     colorTemperatureK or spectral/color approximation
     atmosphere transmittance
     ```

   - `GlobeAtmosphereComposer` now uses
     `sunTopOfAtmosphereIrradianceWm2` as the atmosphere source strength.
   - `radiometricToSceneRgbScale`, `exposure`, and `toneMapping` are exported
     to the shader as display uniforms.
   - The default globe display scale is now
     `1 / rendererIrradianceReferenceWm2`, moving the old renderer divisor out
     of the Sun source term and into the named display bridge.
   - Historical note for continuity: at the end of 4.2 the solid scene target
     was still display-space color, so the shader display-mapped atmosphere
     in-scattering before adding it to `sceneColor * transmittance`. Phase 4.4
     has since replaced that mixed-unit path for the globe surface and marker
     faces.
   - Verification:
     - `npm run test:ui:flat` passed with 108 specs.
     - `npm run build` passed.
     - Runtime capture passed for `/flat/globe-simulation` at
       `tmp/globe-phase-4-2-display-source-compat/phase-4-2-display-source-compat`.
       Capture samples show the surface is no longer crushed black, but the
       sky is still gray/yellow near the Sun and bright stars remain visible.

4.3. Add one named display bridge for the spherical calibration view.
   Status: implemented as the simple `radiometric-display-v1` bridge; further
   exposure comparisons remain useful during Phase 4.6.

  ```text
  radiometricToSceneRgbScale
  exposure
  toneMapping
  ```

   - This is where human daylight adaptation currently belongs.
   - Future capture comparisons should prove physical probes remain unchanged
     when only exposure/tone mapping changes.

4.4. Put surface albedo and solid-scene lighting on the same path.
   Status: implemented for the globe surface and synthetic mountain markers.
   - Replace primitive surface brightness with an irradiance/albedo/radiance
     calculation for the matte globe surface.
   - Keep direct solar irradiance and estimated diffuse sky irradiance separate.
   - Treat `skyDiffuseIrradianceScale` as a flat-model compatibility bridge
     until it can be replaced by computed diffuse sky irradiance.
   - `GlobeSkyScene` now renders the globe surface and synthetic mountain
     marker faces with a Lambertian radiometric shader:

     ```text
     surfaceRadiance =
       albedoRgb
       * (directNormalIrradiance * max(dot(surfaceNormal, sunDirection), 0)
          + estimatedDiffuseSkyIrradiance)
       / pi
     ```

   - The globe solid-scene target now stores linear half-float color so surface
     radiance can exceed display white before tone mapping.
   - `GlobeAtmosphereComposer` now composes radiometric solid scene color and
     atmospheric in-scattering first, then applies the display bridge once:

     ```text
     finalRadiometric =
       surfaceRadiance * cameraToSceneTransmittance
       + cameraRayInScattering

     finalPixel =
       toneMap(finalRadiometric * radiometricToSceneRgbScale * exposure)
     ```

   - The Three.js ambient/directional light path is no longer used for the
     globe surface or mountain markers.
   - Runtime capture
     `tmp/globe-phase-4-4-surface-radiance-rebuilt/phase-4-4-surface-radiance-rebuilt`
     passed and shows the selected star probes sampling sky color rather than
     bright star pixels. The sky remains muted blue-gray, so color calibration
     still belongs to the next atmosphere/display refinement step rather than
     surface unit mixing.
   - Marker contact rendering now starts the radius-sampled face `0.02 km`
     below the mathematical globe surface to avoid bottom-edge depth fighting.
     This is a visual contact/depth stabilization value, not a physical
     atmosphere parameter.

4.5. Put star brightness on the same display path.
   - Keep catalog visual magnitude as the source property.
   - Convert magnitude to relative flux/radiance through a named photometric
     bridge.
   - Let the shared exposure/tone mapping decide whether stars are visible in
     daytime, rather than hiding them manually or using standalone
     `STAR_DISPLAY_EXPOSURE` tuning.

4.6. Recheck aerosol/Mie only after source and display units are coherent.
   Status: active candidate next step.
   - Validate aerosol optical depth, single-scattering albedo, Angstrom
     exponent, scale height, and Mie anisotropy against plausible radiance
     distribution.
   - Do not use these coefficients as color grading controls.
   - Concrete first checks:
     - confirm the shader Rayleigh phase angle sign convention is correct
     - compare directional sky samples away from, near, and opposite the Sun
     - isolate Rayleigh-only and Mie-only captures without changing source
       irradiance
     - inspect whether the brown horizon is coming from Mie/aerosol weighting,
       tone mapping, or surface/atmosphere composition over red markers

Verification:

- Capture comparisons show physical probes unchanged when only display
  exposure changes.
- Daytime sky remains blue without changing Rayleigh coefficients.
- Brightest-star probes become display-dimmed by sky radiance/exposure, not by
  star-specific hiding.
- Surface samples change through irradiance/albedo/display mapping while the
  atmosphere source probes remain stable.

## Phase 5: Reuse Physical Defaults In The Flat Model

Status: planned.

- Feed the same atmosphere and solar-source defaults into the flat model.
- Keep flat-specific geometry and Sun path explicit.
- Split local false-sun energy into two named modes:

  ```text
  comparison mode:
    calibrate to Earth-like target irradiance at the observer/reference point

  consequence mode:
    use configured luminosity/radius/temperature and let false geometry decide
    delivered irradiance
  ```

- Compare spherical and flat captures using the same sample/probe vocabulary.

Verification:

- Captures include paired spherical and flat samples.
- Numeric probes show whether differences come from geometry, source energy,
  atmosphere, or display exposure.

## Open Decisions

- Should the first spherical Sun pose be a fixed simple altitude/azimuth, or
  should the first implementation go straight to date/time/location solar
  position?
- Should the spherical calibration view be a separate route/page or a mode
  inside the flat-simulation feature?
- Which value should be canonical for the default Sun source:
  top-of-atmosphere total solar irradiance, direct normal irradiance target at
  the observer, or solar luminosity plus distance?
- How much display exposure should model human visual adaptation now, versus
  staying a simple named renderer bridge until the physical probes are stable?
