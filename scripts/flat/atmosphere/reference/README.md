# Atmosphere Reference Scripts

Script-owned CPU spectral atmosphere reference implementation.

This package is intentionally separate from React, Three.js, browser capture,
and shader code. The first scaffold only establishes the testable pipeline API:

- `CpuSpectralReferenceIntegrator.js`
- canonical stage registry
- direct `runStage(stageId, packet)` execution
- request/default merging through `mergeRequest(request)`
- inline or nested probe request resolution through `resolveProbeRequest(probe)`
- `runUntil(stageId, request)` composition
- `traceRay(request)` composition of the same public stages
- exported utility functions such as `normalizeVector3`
- ambient JSDoc contracts in `types.d.ts`
- stage-test expectation fixtures under `stages/_tests/fixtures`
- integration specs for adjacent packet handoffs and full `traceRay`
  known-answer fixtures under `_tests`
- `run-reference-probe.js` for first controlled probe runs, deterministic JSON,
  Markdown reports, and SVG/PPM/PNG visual evidence
- `light-extent-probe.js` plus `light-extent-scenarios.json` for flat
  finite-Sun source-path extent classification

The canonical transport stages now have first implementation slices. The
current probe runner uses controlled smoke probes to exercise those stages and
a separate sky-patch preview that uses a spherical Earth-like shell,
named top-of-atmosphere solar spectrum samples, Rayleigh phase,
Henyey-Greenstein aerosol phase, approximate Chappuis-band ozone absorption,
official CIE 1931 2-degree table-backed XYZ to sRGB display conversion, and
named wavelength grids for preview, benchmark, and full-CIE spot-check runs.
It does not yet provide full Earth/globe or flat/local-Sun geometry adapters,
and the controlled smoke-probe swatches still use a debug wavelength-to-RGB
mapping rather than CIE colorimetry.

The light-extent probe is a post-pipeline diagnostic for the flat/local-Sun
problem. It does not render terrain or replace the canonical transport stages.
It asks a narrower question: along a straight source path through a flat
atmosphere, where do useful source light and source-path transmittance cross
named loss thresholds? That keeps two effects visible at once:

- Beer-Lambert extinction through dense near-horizontal air.
- Finite solar-disk solid-angle falloff for a close or distant finite Sun.

Thresholds in `light-extent-scenarios.json` are loss fractions. `0` means no
loss. Values close to `1` mean almost nothing remains. Exact `1` is rejected
because exponential transmittance approaches zero asymptotically; use a named
near-opaque value such as `0.999999` instead.

User-facing Sun controls map into the light-extent scenarios through the
`sun` block:

- `sun.brightnessScale` scales absolute effective irradiance linearly.
- `sun.elevationDeg` sets the source path angle above the flat horizon.
- `sun.directLightAvailable`, when `false`, keeps the source brightness defined
  but reports zero direct effective irradiance at the observer path.

The current loss-fraction thresholds are intentionally relative to the start of
the sampled source path. That means `sun.brightnessScale` changes reported
absolute irradiance but does not move the current relative-loss crossing
distances. `sun.elevationDeg` does move the crossings because it changes how
long the source path remains in dense near-surface air. A later
terrain-visibility probe should add an absolute brightness, exposure, or
contrast threshold before using brightness to decide how far terrain detail is
actually visible.

Some named sets also carry absolute effective-irradiance floors under
`floors.effectiveIrradiance`. These are calculated engineering anchors, not
perceptual visibility thresholds:

- `app.flatDefaults.onePermilleMiddayEffective` is `0.1%` of the current flat
  app closest-false-sun source term:
  `0.001 * 58 * solidAngle(25.749504 km, 5050.674164842701 km)`
  equals `0.000004736087535019212 app-effective-source-units`.
- `realSun.sanJose.onePermilleToaIrradiance` is `0.1%` of the globe
  simulation real-Sun top-of-atmosphere irradiance for the named San Jose
  solar-noon or midnight pose, around `1.3195 W/m2`.

The app-linked flat default sets intentionally show that the current opposite
false-Sun pose is not a physical no-direct-light midnight: the app's local Sun
is still about `20.1 deg` above the flat horizon from the San Jose observer.
The real-Sun midnight set keeps the top-of-atmosphere source brightness in the
scenario but sets `directLightAvailable: false` because the Sun is below the
local globe horizon.

Plausible app integration: run this probe during configuration, not during the
render loop. A future app adapter can feed the current Sun/atmosphere controls
into the same pure calculation, debounce slider updates, cache by the physical
configuration, and pass derived extents or curve samples to the renderer. That
keeps this as a configuration classifier while the shader or terrain system
uses the result as ordinary render input.

Run the focused script specs with:

```text
npm run test:scripts:flat
```

They are also included in the broader scripts lane:

```text
npm run test:scripts
```

Generate the first visual evidence artifacts with:

```text
node scripts/flat/atmosphere/run-reference-probe.js --out tmp/flat-reference-visual-evidence/result.json --report tmp/flat-reference-visual-evidence/report.md --image tmp/flat-reference-visual-evidence/visual.svg --format summary
```

Generate the current sky-patch preview with:

```text
node scripts/flat/atmosphere/run-reference-probe.js --sky-patches --out tmp/flat-reference-sky-patches/result.json --report tmp/flat-reference-sky-patches/report.md --image tmp/flat-reference-sky-patches/sky-patches.svg --format summary
```

The sky-patch mode renders three basic camera/world/source views:
`midday.zenith`, `midnight.zenith`, and `sunset.horizon`. Its shared preview
inputs are Earth-like rather than scene-colored: radius `6371.0088 km`,
`100 km` atmosphere top, `8 km` Rayleigh scale height, and aerosol optical
depth `0.08` at `550 nm` with `g = 0.8`. The preview grid is `380-780 nm`
every `20 nm`, with an approximate `300 DU` ozone column.

Generate the current flat finite-Sun light-extent classification with:

```text
node scripts/flat/atmosphere/run-reference-probe.js --light-extent --out tmp/flat-light-extent/result.json --report tmp/flat-light-extent/report.md --image tmp/flat-light-extent/light-extent.svg --format summary
```

The default named sets are loaded from
`scripts/flat/atmosphere/data/reference/light-extent-scenarios.json`. Use
`--light-set <id[,id]>` to run a subset, or `--light-config <path>` to load a
different named-set file with the same shape.
