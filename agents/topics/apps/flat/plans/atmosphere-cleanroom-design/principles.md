# Atmosphere Design Principles

This document collects useful principles mined from older Flat atmosphere
plans. It is a staging document for the upcoming documentation reorg, not a
replacement for [Algorithm32 Canonical Reference](algorithm32-canonical-reference.md).

Use it to decide what ideas should be preserved, merged, or deleted when the
docs are reorganized. Older lanes are not active authority unless a principle
here is explicitly promoted into the canonical Algorithm32 design, but
pre-cleanroom predecessor docs may still be important source/provenance
material.

## Source Lanes Reviewed

Useful principles were collected from:

- `../poc-phase-1-plan.md`
- `../retired/reality-aligned-daytime-atmosphere-plan.md`
- `../retired/spherical-sun-atmosphere-plan.md`
- `../retired/bruneton-start-fresh-prompt.md`
- `../retired/bruneton-start-fresh-worklog.md`
- `../retired/bruneton-skydome-prompt.md`
- `../retired/bruneton-skydome-worklog.md`
- `../retired/atmosphere_reset/`
- `../retired/atmosphere_reset/color/plan.md`
- `../retired/atmosphere_reset/composition/plan.md`
- `../retired/atmosphere_reset/sun/sun_visual_plan.md`
- `../retired/atmosphere_reset/reference/`

These atmosphere lanes have been moved under `../retired/` because they are no
longer the active documentation home. The Bruneton start-fresh prompt/worklog
are pre-cleanroom predecessor material that led to Algorithm32. The
`atmosphere_reset` lane is the predecessor/rejected reference-pipeline
approach; its implementation shape should not be revived as the current
architecture, but several principles are still useful.

## Authority And Provenance

- External papers, standards, datasets, and third-party source code are the
  authority for equations, constants, approximations, display policy, expected
  colors, and visual targets.
- Local summaries, older local docs, generated artifacts, and previous local
  implementations may provide context, but they are not physics authority.
- Every physical constant, coefficient, expected value, or validation fixture
  should name its source and assumptions.
- For proposed flat-world geometry, distinguish Earth-atmosphere source data
  from hypothesis parameters. A flat disk radius, dome wall, local-Sun height,
  flashlight beam, or finite lateral boundary is a model assumption, not a
  sourced Earth constant.
- Use externally sourced values directly when possible. Do not compute an
  expected value by calling the implementation being tested.
- Keep source provenance near the artifact or fixture that depends on it:
  citation, URL/DOI/path, units, assumptions, derivation summary, and tolerance
  policy.

## Algorithm Boundary

- The atmosphere algorithm computes spectral radiance. RGB display output is a
  consumer step after transport.
- The scattering equation should be shared across supported worlds. Globe,
  flat, distant Sun, and local Sun differences should enter through geometry,
  source, boundary, and cache adapters.
- Algorithm32 should stay focused on light-source interaction with the
  atmosphere: density, optical depth, transmittance, phase, and path radiance.
- App-specific Sun orbit policy, Three.js light-unit calibration, visible-Sun
  sprite/disc rendering, camera UI, and subjective display tuning should live
  outside the transport kernel.
- Renderer-owned endpoint data belongs at the renderer boundary. Object hits,
  terrain hits, depth-buffer reconstruction, ground policy, and sky-ray length
  caps should not become hidden Algorithm32 constants.
- No direct branch in the core integrator should ask "flat or globe" or
  "local or distant" when the same behavior can be expressed by source and
  geometry interfaces.

## Geometry And Source Abstractions

- Treat world geometry, atmosphere volume, density field, source geometry, and
  boundary/occlusion rules as swappable physical properties.
- Geometry owns altitude, atmosphere bounds, surface intersections, up/normal
  fields, and model-specific source-path segments.
- A distant Sun is an effectively infinite directional source. It supplies a
  constant source direction and solar irradiance at the atmosphere boundary.
- A local Sun is a finite source. It supplies per-sample direction, distance,
  visibility/source-path segments, incident scale or falloff, and source
  metadata.
- The local Sun should be an object/configuration that offloads differences
  from Algorithm32 instead of increasing conditional complexity in the
  integrator.
- The same source object should drive atmosphere source samples and scene
  lighting adapters when a rendered scene is involved.
- The app can provide configuration for false-Sun assumptions, but transport
  code should compute placement, distance, falloff, and source-path
  transmittance from explicit model inputs.

## Scene And Shader Integration

- The production target is live Three rendering into scene color plus depth,
  followed by an Algorithm32 atmosphere pass.
- JSON scene packets are validation/oracle artifacts, not the normal render
  path.
- The CPU soft-shader is valuable because it shares the shader input contract:
  scene color, depth or hit distance, hit mask, camera/ray data, geometry
  packet, source packet, numerical/display policy, and diagnostics.
- Hit pixels compose as:

```text
L_camera(lambda) = T_view(lambda) * L_object(lambda) + L_path(lambda)
```

- Sky pixels return path radiance only.
- Three lights should be driven by the same source definition used by
  Algorithm32. Distant sources map naturally to `DirectionalLight`; local
  sources map to `PointLight` or a controlled custom/proxy light path when
  Three's physical distance scale becomes impractical.
- Shadows belong to the scene render before the atmosphere pass. The
  atmosphere pass should preserve shadowed scene color via
  `sceneColor * T_view + L_path`.
- Integrated shader work should avoid duplicating Algorithm32 inside every
  object material. A fullscreen atmosphere pass over live color/depth targets
  matches the current production shape.

## Color And Display

- Spectral transport and display mapping must stay separate.
- CIE XYZ conversion, linear RGB conversion, exposure, tone mapping, white
  balance, output color space, PNG writing, and report swatches are
  post-transport concerns.
- Display-side controls are allowed, but they must be named as camera/display
  choices or renderer bridges, not physical atmosphere parameters.
- Avoid hidden RGB painting or undocumented color grades. If a visual
  approximation is used for diagnosis, label it as a proxy and replace it with
  transport/display logic before promotion.
- Official CIE color matching functions, ASTM G-173 solar spectrum data,
  Bruneton display transform choices, and similar source-backed display inputs
  are useful future production references.

## Validation And Evidence

- Prefer objective transport checks before subjective images.
- Good validation families include analytic identities, invariants,
  reference-data rows, convergence checks, CPU-vs-shader parity, selected-pixel
  diagnostics, full-image diffs, and same-config reproducibility.
- Useful analytic identities include:
  - vacuum transmittance is `1`;
  - zero-length transmittance is `1`;
  - homogeneous Beer-Lambert transmittance follows `T = exp(-sigma_t * d)`;
  - transmittance is multiplicative along split path segments;
  - phase functions should be normalized over solid angle.
- Every artifact should make enough of its inputs, numerical controls,
  equations/constants, criteria, and provenance explicit that a later agent can
  understand what was accepted or rejected.
- Numbered experiment artifacts are useful during POC work. Production
  promotion should reduce this into stable module APIs and repeatable parity
  gates.
- Subjective images are still valuable, but they should be labeled as visual
  inspection unless tied to explicit objective criteria.

## Production Module Shape

- Algorithm32 should become a framework-free module with plain-data inputs and
  deterministic outputs.
- The production module should expose direct CPU trace APIs, cache-builder or
  texture-building APIs, shader-uniform/texture contract helpers, and
  validation/oracle helpers.
- Public inputs should distinguish:
  - atmosphere profile;
  - geometry model;
  - source model;
  - numerical policy;
  - cache plan;
  - display policy;
  - renderer-provided scene endpoint data.
- Runtime Algorithm32 code should not depend on React, DOM, Three.js, browser
  canvas state, app route state, or temp artifact paths.
- Three.js integration should be an adapter layer around the module, not the
  module's core.
- Shader contract generation should fail loudly for unsupported combinations
  such as local second-order caches until those caches are designed.

## Flat And Local Sun Principles

- Flat/local Sun behavior should be treated as a configured hypothetical
  source, not as a post-render color adjustment.
- Local Sun brightness should be calibrated through source inputs and
  transport, not by faking the output image.
- Local finite-source distance, source-path transmittance, and incident scale
  are part of the physical source sample and should be inspectable in
  diagnostics.
- A flat sky cap or ray length can be useful for a sky-dome renderer, but scene
  renderers should provide their own segment lengths from geometry/depth.
- If a future flashlight-style local Sun is modeled, it should be a source
  emission-profile variant. Beam axis, cone angle, falloff, spectral scale,
  and energy policy should be source fields and cache-key inputs, not
  image-space darkening.

## Carry-Forward From Closed Lanes

- The start-fresh Bruneton lane produced the current Algorithm32 comparison
  anchor: step 032. Its useful pieces are already captured in the canonical
  Algorithm32 docs.
- The old globe/spherical Sun plan anticipated the current Three integration
  shape: render scene color/depth first, then compose atmosphere as a pass.
- The old reference-pipeline lane produced useful validation discipline:
  domain-first tests, explicit packet ownership, source-backed fixtures, and
  display-as-post-pipeline.
- The old color/composition lanes contain future source candidates, including
  official CIE data, ASTM G-173, Bucholtz Rayleigh, Brion ozone, aerosol
  presets, and Cornette-Shanks phase policy. These should not replace the
  step-032 Algorithm32 profile without a named production model decision.
- The old multiple-scattering lane is cautionary: generic higher-order sidecar
  work did not by itself solve muted daylight or brown-horizon output. Future
  local/distant second-order work needs named acceptance criteria and cache
  design, not just more residual light.

## Open Reorg Questions

- Which of these principles belong in the canonical Algorithm32 reference, and
  which belong in production module design?
- Which older docs should be marked historical once their useful principles are
  merged here or into canonical docs?
- Should source/provenance rules live in one shared project standard instead
  of inside the Flat atmosphere docs?
- Which future model-ingredient sources should become production presets, and
  which should remain comparison-only references?
- How much of the old reference-pipeline validation discipline should become
  required production tests versus optional experiment evidence?
