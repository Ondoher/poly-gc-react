# Environment Object Color Closeout

This closes the cleanroom environment-object color experiment lane. The lane
proved that the experiment 032 atmosphere kernels can color finite environment
objects, not only sky rays, and that the production pipeline should expose a
spectral finite-segment transfer API.

## Final Accepted Artifacts

Current final source artifacts:

- `035-transfer-refined-convergence`: finite object-transfer convergence proof,
  `15` passing criteria, `0` failing, `0` unresolved.
- `036-lambertian-surface-lighting`: matte surface-radiance proof, `8`
  passing criteria, `0` failing, `0` unresolved.
- `037-local-sun-follow-up`: finite local-source proof, `8` passing criteria,
  `0` failing, `0` unresolved.
- `038-flat-long-sightline-follow-up`: flat long-line-of-sight proof, `9`
  passing criteria, `0` failing, `0` unresolved.
- `040-scene-gallery`: current scene-gallery display proof, `7` passing
  criteria, `0` failing, `0` unresolved.

Current output image:

```text
tmp/atmosphere/cleanroom_environment/040-scene-gallery/scene-gallery.png
```

The final gallery reads accepted artifacts `035`, `036`, `037`, and `038`,
selects `282` recorded spectral cases, samples `11040` sky blocks and `21600`
ground-atmosphere blocks through the cleanroom spectral kernels, and renders
red, blue, and dark forest-green recorded object-spectrum stacks in each
scene/source view.

## What Was Proven

The transport proof is spectral first:

```text
L_camera(lambda) =
  T_view(lambda) * L_object(lambda) +
  L_path(lambda)
```

The experiment validates:

- zero-distance identity;
- black-object path-radiance identity;
- linearity under view transmittance;
- segment-composition identity;
- Beer-Lambert and optical-depth bounds;
- distance response and contrast loss;
- Sun-position response;
- convergence-backed effect margins for the refined transfer baseline;
- display-boundary separation between spectral outputs and CIE/sRGB/PNG
  previews.

The scene-gallery artifacts are display consumers. The object colors in the
scene previews come from recorded `displayPreview.finalRadiance.encodedRgb`
values generated from spectral arrays. They are not hidden RGB grades.

## What Did Not Change

No baseline atmosphere equations were tuned during the object-color work.

The baseline transfer, Lambertian, and scene-gallery phases keep the experiment
032 atmosphere assumptions:

- spherical Earth atmosphere;
- no ozone;
- no ground coupling;
- no direct solar-disc camera radiance;
- Bruneton 2016 aerosol constants;
- 15 centered wavelength samples;
- full-sphere Fibonacci second-order path radiance for the refined transfer
  baseline;
- Bruneton comparison display scalar `k = 1 / (5 * 683)` as display-only.

Changes made during the scene iterations were experimental/display controls:

- synthetic object spectra, including user-directed green color variants;
- perspective scene layout;
- scene-gallery background sample block size, finally `8 px`;
- report and audit wording.

## Production Carry-Forward

The production cleanroom pipeline should expose at least these spectral
contracts:

```text
traceSkyRay(...) -> spectral radiance packet

traceAtmosphereSegment(...) -> {
  wavelengthsNm,
  transmittanceByWavelength,
  pathRadianceByWavelength,
  diagnostics
}

applyAtmosphereToObjectRadiance(...) -> spectral radiance packet
```

The atmosphere owns `T_view(lambda)` and `L_path(lambda)`. The caller or
surface subsystem owns `L_object(lambda)`.

Lambertian surface lighting should remain a separate optional surface/material
helper. It changes how `L_object(lambda)` is produced; it does not define a
different atmosphere.

Local Sun and flat long-line-of-sight behavior should remain separate model
variants, not hidden flags inside the baseline spherical/directional-Sun path.

## Experimental Caveats

- The green object colors are user-directed synthetic spectral stress inputs,
  not measured vegetation reflectance spectra.
- The scene-gallery background is a display-only preview. The remaining hard
  line near the horizon is the preview renderer's sky-vs-ground classification,
  not an atmosphere transport discontinuity.
- The final scene gallery uses algorithmic range compression so distant object
  cards are visible together. It is not a metric 3D renderer.
- The current successful artifacts prove transport behavior and design utility;
  they do not claim absolute real-world color accuracy for a measured outdoor
  target.

## Next Topic

Return to the production cleanroom pipeline design. Use this closeout as the
environment-object proof handoff, not as a reason to continue generating
numbered experiment artifacts by default.
