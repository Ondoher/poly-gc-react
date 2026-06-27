# Reality-Aligned Daytime Atmosphere Plan

Goal: make the fixed daytime flat-simulation sky read as a believable blue
daylight sky and naturally crush external light-source contrast, while moving
current tuning knobs toward real-world concepts or clearly named renderer
controls.

This plan intentionally precedes the terrain pass. Terrain remains deferred
until the atmosphere/light contract is easier to reason about.

## Design Direction

Keep the standard Earth atmosphere profile as the physical anchor:

```js
profile: {
	topAltitudeKm: 100,
	seaLevelDensityKgM3: 1.225,
	rayleighScaleHeightKm: 8.0, // current 8.5 is also acceptable
	aerosolScaleHeightKm: 1.2,
	rayleighBetaKm: { r: 0.005802, g: 0.013558, b: 0.0331 },
	aerosolOpticalDepth550nm: 0.08,
	aerosolSingleScatteringAlbedo: 0.95,
	aerosolAngstromExponent: 1.3,
	mieAnisotropy: 0.8,
}
```

The Rayleigh coefficients are the main blue-sky anchor and should not be
treated as arbitrary color grading. Blue sky should emerge from:

```text
sceneColor * transmittance + inScatteredLight
```

with bright sun-driven Rayleigh in-scattering reducing star/external-source
contrast.

Keep one sun object with separate light facets:

- `scene.sun`: visible flat-simulation body and user-facing evidence.
- `scene.lighting.sun`: solid-scene light source derived from the current
  resolved `scene.sun` position, radius, and motion.
- `scene.lighting.atmosphereSun`: atmosphere scattering source derived from
  that same resolved `scene.sun`. Its color/intensity/irradiance can differ
  from the rendered material color, but it must not be a separate positioned
  sun.

Suggested first linked atmosphere-radiance facet on `scene.sun`:

```js
sun: {
	atmosphere: {
		kind: 'point',
		// position, radius, apparent size, and motion come from scene.sun
		color: { r: 1, g: 0.98, b: 0.95 },
		intensity: 1,
		solarIrradianceScale: 58,
		anchor: {
			kind: 'flat-simulation-visible-sun-atmosphere',
			status: 'open',
		},
	},
}
```

The prior directional daylight analog produced the cleanest Phase 4 blue-sky
capture, but it split atmospheric illumination from the rendered false sun.
That split is now rejected: the flat-simulation POC should keep the
atmospheric sun and rendered sun linked to the same object, then tune the
linked object's atmosphere-radiance facet.

The first linked false sun therefore carries:

```js
scene.lighting.atmosphereSun = {
	kind: 'point',
	position: resolvedSceneSun.position,
	radiusKm: resolvedSceneSun.radiusKm,
	color: { r: 1, g: 0.98, b: 0.95 },
	intensity: 1,
	solarIrradianceScale: 58,
	anchor: {
		kind: 'flat-simulation-visible-sun-atmosphere',
		status: 'open',
	},
}
```

If we keep point-sun scattering for false-model inspection, name it as a
false-model radiance bridge rather than a physical solar constant:

```js
falseSunRadiance: {
	model: 'point-inverse-square-reference',
	referenceDistanceKm: 4800,
}
```

Move display and engine bridge controls out of physical atmosphere naming:

```js
rendering: {
	backgroundAtmosphereViewDistanceKm: 100,
	flatSlabHorizonViewDistanceFactor: 0.25,
	sampleToSunTransmittanceModel: 'air-mass',
	sampleToSunTransmittanceSteps: 4, // comparison path for light-march only
	skyExposure: 1,
	solidSceneExposure: 1,
	starExposure: 0.02,
	constellationOverlayExposure: 0.04,
	threeLightUnitScale: 0.04,
	skyDiffuseIrradianceScale: 0.35,
}
```

The current bridge constants are documented in
[Magic Numbers And Mitigations](../atmosphere-design.md#magic-numbers-and-mitigations).
The mitigation direction is:

- derive aerosol/Mie extinction and scattering from `aerosolOpticalDepth550nm`,
  `aerosolSingleScatteringAlbedo`, and `aerosolAngstromExponent` rather than
  tuning `mieStrength`;
- replace `skyDiffuseIrradianceScale` with a diffuse-sky irradiance term
  computed from atmospheric scattering, transmittance, and sun irradiance;
- treat `solarIrradianceScale` as an interim calibration bridge until the
  atmosphere source can be calibrated from solar spectrum, sun distance,
  aperture/exposure, and renderer light units;
- treat `threeLightUnitScale` as the explicit Three.js unit bridge, not an
  atmosphere parameter;
- convert star brightness toward apparent magnitude/luminance style inputs,
  while keeping constellation overlay brightness as a named UI overlay control.

## Phase 0: Baseline And Vocabulary

Status: mostly complete. Phase 1 settled the first renamed-contract
vocabulary, and the first fixed San Jose daytime baseline is saved at
[phase-1 baseline](../baselines/daytime-atmosphere/phase-1/README.md).

- Capture the current fixed San Jose calibration state in browser samples:
  upper sky, center sky, horizon, local floor, mountain band, and visible star
  points.
- Current Phase 1 samples: upper sky `[2, 4, 8]`, center sky `[2, 4, 8]`,
  horizon `[1, 3, 6]`, mountain band `[84, 85, 48]`, and local floor
  `[255, 254, 110]`.
- Record the active atmosphere profile, sun color/intensity, radiance bridge,
  background distance cap, horizon factor, and star material intensity.
- Decided Phase 1 names:
  `falseSunRadiance.referenceDistanceKm`, `threeLightUnitScale`,
  `backgroundAtmosphereViewDistanceKm`, and
  `flatSlabHorizonViewDistanceFactor`.
- Add or update focused tests only around renamed contracts and unchanged
  behavior.

Verification:

- `npm run test:ui:flat`
- `npm run build`
- Browser console has no shader/WebGL errors.

## Phase 1: Split Physical Inputs From Renderer Controls

Status: implemented.

- Add explicit scene-model fields for atmosphere scattering source versus the
  visible false sun body.
- Keep the visible false sun orange if desired, but use a daylight-white
  `atmosphereSun` for Earth-like scattering calibration.
- Move renderer-only scale/exposure controls under a clearly named rendering
  object.
- Remove or rename legacy false-sun radiance bridge fields so physical and
  non-physical meanings are not mixed.
- Preserve the existing fixed closest-sun-to-San-Jose calibration pose.

Verification:

- Unit tests confirm the scene exposes visible sun, solid-scene sun, and
  atmosphere sun distinctly.
- Existing atmosphere composer tests continue to pass.
- Browser view should look no worse than the baseline.

## Phase 2: Earth-Like Atmosphere Preset

Status: implemented. The named preset is active, tests pass, and the
`phase-2-clear-day` browser capture is saved at
[phase-2-clear-day baseline](../baselines/daytime-atmosphere/phase-2-clear-day/README.md).
The capture stayed very dark: upper sky `[1, 4, 7]`, center sky `[2, 4, 7]`,
and horizon `[1, 3, 6]`. The clear-day profile improved the semantic contract
but did not create a bright daytime sky by itself.

- Create a named clear-day Earth atmosphere preset using the anchored values:
  Rayleigh scale height around `8.0` to `8.5 km`, aerosol scale height `1.2 km`,
  current Rayleigh beta, aerosol optical depth around `0.08` for clear-day
  conditions, aerosol single-scattering albedo around `0.95`, Angstrom exponent
  around `1.3`, and `mieAnisotropy: 0.8`.
- Keep a hazier preset available through higher aerosol optical depth rather
  than changing Rayleigh color balance.
- Ensure shader uniforms and CPU `Atmosphere` exports still derive from the
  canonical profile.

Verification:

- Tests confirm blue Rayleigh beta remains stronger than red.
- Browser samples were captured without relying on a painted fallback; they
  show the sky remains too dark, so the next pass should tune named
  source/radiance/exposure controls.

## Phase 2.5: Solar Irradiance Source Calibration

Status: implemented. Atmosphere scattering now uses explicit
`solarIrradianceScale` from shared `Sun` state instead of reusing generic
scene-light `intensity` as the scattering source strength. The first
flat-simulation daylight value is `solarIrradianceScale: 50` with
`intensity: 1`.

- Add `solarIrradianceScale` to shared sun config/state and shader uniforms.
- Update CPU and shader single-scattering paths to compute source radiance as
  `sunColor * solarIrradianceScale`.
- Keep visible false-sun rendering separate for now; later work may revisit
  the sun disk so brightness, color, glare, apparent size, and attenuation can
  derive from atmospheric radiance/transmittance.
- Capture a new fixed San Jose daytime baseline.

Verification:

- `npm run test:ui:flat`
- `npm run build`
- `npm run capture:flat-atmosphere -- --label phase-2-solar-irradiance-50`
- Browser capture saved at
  [phase-2-solar-irradiance-50 baseline](../baselines/daytime-atmosphere/phase-2-solar-irradiance-50/README.md):
  upper sky `[72, 154, 255]`, center sky `[81, 169, 255]`, horizon
  `[57, 119, 224]`, and star probes `[80, 169, 255]`.

## Phase 3: Daylight Star And External-Source Visibility

Status: implemented. The solar irradiance source pass made the fixed daytime
star-probe pixels read as blue sky, but visual inspection still showed bright
white star points and a red constellation overlay. The renderer now exposes
`starExposure: 0.02` and `constellationOverlayExposure: 0.04` as named
material controls before atmosphere composition.

- Add a named star/external-source exposure control rather than special-casing
  stars in the atmosphere shader.
- Tune star material intensity/exposure so daylight airlight naturally reduces
  contrast.
- Keep the generic composition rule for all objects:

  ```text
  finalColor = sceneColor * sceneTransmittance + inScatteredLight
  ```

Verification:

- `npm run test:ui:flat`
- `npm run build`
- `npm run capture:flat-atmosphere -- --label phase-3-star-exposure`
- Fixed daytime capture saved at
  [phase-3-star-exposure baseline](../baselines/daytime-atmosphere/phase-3-star-exposure/README.md):
  sky samples match the solar-irradiance baseline while the previously visible
  white star points and red constellation overlay are no longer apparent in
  the screenshot.
- Low-airlight/night-ish poses still need a later visibility check once the
  app exposes a non-daytime calibration pose again.

## Phase 4: Flat-Slab Background Distance Calibration

Status: implemented. The default flat-slab background distance is now
`100 km`, and near-horizontal no-depth rays use
`flatSlabHorizonViewDistanceFactor: 0.25`.

- Tune the Phase 1 `backgroundAtmosphereViewDistanceKm` flat-slab atmosphere
  view distance.
- Tune first from a realistic target of roughly `100 km` vertical atmosphere
  depth, then adjust the flat-slab horizon factor only enough to avoid fake
  horizon whitening.
- Start with:

  ```js
  backgroundAtmosphereViewDistanceKm: 100,
  flatSlabHorizonViewDistanceFactor: 0.25,
  ```

Verification:

- `npm run test:ui:flat`
- `npm run build`
- `npm run capture:flat-atmosphere -- --label phase-4-background-distance-100-horizon-025`
- Fixed daytime capture saved at
  [phase-4-background-distance-100-horizon-025 baseline](../baselines/daytime-atmosphere/phase-4-background-distance-100-horizon-025/README.md):
  upper sky stayed blue at `[72, 154, 255]`, center sky rose to
  `[91, 190, 255]`, horizon rose to `[108, 215, 255]`, and visual inspection
  showed a brighter cyan horizon rather than white/yellow clipping.
- Ground/mountains still pass through the depth-aware atmosphere path. The
  mountain band is much more airlit (`[156, 227, 254]`), so later terrain
  work should revisit solid-surface exposure and depth cues with real terrain.

## Phase 5: Browser Calibration Pass

Status: implemented, then corrected. The comparison pass originally showed
the separate directional daylight analog was bluer than a visible false-sun
point source, but the active design now rejects that split. The atmosphere sun
and rendered sun are linked to the same `scene.sun` object. Atmosphere
scattering uses the resolved visible false sun position/radius/motion plus the
`scene.sun.atmosphere` radiance facet.

- Compare point false-sun scattering against directional atmosphere-sun
  scattering and choose the default for the next POC step.
- Correct the source contract so the point false-sun path is not an inspection
  mode; it is the default linked atmosphere source.
- Tune only exposed named controls after this point; avoid adding hidden shader
  multipliers.

Verification:

- `npm run test:ui:flat`
- `npm run build`
- Historical fixed daytime point-source comparison saved at
  [phase-5-visible-false-sun-atmosphere baseline](../baselines/daytime-atmosphere/phase-5-visible-false-sun-atmosphere/README.md):
  upper sky `[53, 95, 131]`, center sky `[73, 126, 162]`, horizon
  `[100, 167, 196]`, mountain band `[154, 202, 197]`, local floor
  `[255, 255, 112]`, and star probes `[71, 124, 161]`.
- Compared with the Phase 4 directional default (`[72, 154, 255]` upper sky,
  `[91, 190, 255]` center sky, `[108, 215, 255]` horizon), the point-source
  mode was calmer but too muted for the daylight POC. The corrected follow-up
  still chooses the linked visible false sun as the default because one
  rendered sun object is the stronger model contract.
- Follow-up verification after the correction:
  `npm run test:ui:flat`,
  `npm run build`, and
  `npm run capture:flat-atmosphere -- --label phase-5-linked-visible-sun-atmosphere`.
- Active linked-sun capture saved at
  [phase-5-linked-visible-sun-atmosphere baseline](../baselines/daytime-atmosphere/phase-5-linked-visible-sun-atmosphere/README.md):
  upper sky `[53, 114, 226]`, center sky `[73, 151, 255]`, horizon
  `[100, 199, 255]`, mountain band `[154, 223, 253]`, local floor
  `[255, 255, 114]`, and star probes `[71, 148, 255]`.
- Follow-up linked-radiance sweep captured `58`, `60`, and `65`. `65` made
  center sky bright but clipped the horizon and mountain band to cyan-white;
  `60` stayed usable but still pushed the mountain band hard into blue.
  `58` is the selected default because it restores a stronger daytime blue
  while avoiding the worst visible clipping:
  [phase-5-linked-visible-sun-irradiance-58 baseline](../baselines/daytime-atmosphere/phase-5-linked-visible-sun-irradiance-58/README.md)
  captured upper sky `[61, 132, 255]`, center sky `[84, 175, 255]`, horizon
  `[116, 231, 255]`, mountain band `[165, 244, 255]`, local floor
  `[255, 255, 114]`, and star probes `[82, 172, 255]`.

## Open Decisions

- New direction: pause further flat-model atmosphere tuning until a Sun-only
  spherical atmosphere calibration view exists. A realistic atmosphere should
  be tuned against correct geometry first; the flat model should reuse those
  physical defaults and expose geometry-driven consequences.
- Superseded Phase 1 decision: the default flat simulation no longer uses a
  separate directional atmosphere sun analog.
- Resolved for Phase 1: the implementation renamed the current fields in one
  breaking contract change and deleted the legacy field names.
- Resolved for Phase 5 correction: the atmospheric sun and rendered sun are
  linked to the same `scene.sun` object. Solid-scene light and atmosphere
  scattering may use different radiance/color facets, but position, radius,
  apparent size, and motion have one owner.
- Future feature: add an atmosphere refractive-index or refractivity model for
  apparent altitude shifts, horizon bending, and sunrise/sunset timing after
  the scattering/radiance contract is stable.
- What browser sample thresholds count as "blue enough" and "stars obscured"
  for this POC?
