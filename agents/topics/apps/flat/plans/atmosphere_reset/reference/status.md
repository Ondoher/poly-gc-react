# Reference Status

Current diffuse-sky-airlight checkpoint:

- Source-backed fixtures and direct specs now exist for the
  `integrateDiffuseSkyAirlight` contract. The fixture ledger is
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/diffuse-sky-airlight-contracts.json`,
  and the stage spec is
  `scripts/flat/atmosphere/reference/stages/_tests/IntegrateDiffuseSkyAirlightStage.spec.js`.
- The fixture rows preserve the low/high tau fallback behavior under the final
  stage/packet vocabulary, and the direct stage spec now pins the aerosol-aware
  bounded formula when Mie optical depth is present.
- The production stage lives at
  `scripts/flat/atmosphere/reference/stages/IntegrateDiffuseSkyAirlightStage.js`,
  is registered after `integrateSingleScattering`, and emits an explicit
  `diffuseSkyAirlight` packet field.
- `composeSpectralRadiance` now includes
  `diffuseSkyAirlightRadianceByWavelength` as an explicit component. The
  stage defaults to zero strength unless callers provide
  `numerical.diffuseSkyAirlightStrength`.
- Verification: `npm run test:scripts:flat` passes with 353 specs and
  0 failures after the packet/type/docs contract update and aerosol-aware
  formula implementation.
- The renamed stage is wired through the sky-patch CLI. A full-stack review
  run generated:
  `tmp/atmosphere-diffuse-sky-airlight-stack/sky-patches-full-stack-132x84-fov72.png`,
  `tmp/atmosphere-diffuse-sky-airlight-stack/sky-patches-full-stack-132x84-fov72.md`,
  and
  `tmp/atmosphere-diffuse-sky-airlight-stack/sky-patches-full-stack-132x84-fov72.json`.
  It used `benchmark-5nm`, `astm-g173`, `bucholtz-standard-air`,
  `brion-1998-ozone-295k`, `clear-maritime`,
  `us-standard-atmosphere-1976-density`, `preserve-hue`,
  `single-plus-haze-lift`, strength `0.02`, patch size `132x84`, and
  `72 deg` FOV. Center swatches: midday zenith `#798bad`, midday horizon
  `#caccbc`, sunset horizon `#e59963`.
- Follow-up review artifacts without the wide-FOV override were generated so
  the horizon fade occupies more vertical pixels:
  `tmp/atmosphere-diffuse-sky-airlight-stack/sky-patches-full-stack-132x84-default-fov.png`
  and
  `tmp/atmosphere-diffuse-sky-airlight-stack/midday-horizon-full-stack-132x168-default-fov.png`.
  Centers: three-patch default-FOV midday horizon `#c6cbbd`, sunset horizon
  `#e09761`; horizon-only default-FOV center `#c5cabd`.
- After implementing the fixture-backed aerosol-aware bounded formula, the
  latest review artifacts were copied into `tmp/atmosphere-images/` as
  `059_atmosphere-diffuse-sky-airlight-stack-sky-patches-full-stack-132x84-aerosol-aware.png`
  and
  `060_atmosphere-diffuse-sky-airlight-stack-midday-horizon-full-stack-132x168-aerosol-aware.png`.
  The pipeline output improved the numeric horizon profile, but it is not yet
  close to a real midday sky photo. Compared with the latest user-provided
  reference image, the simulated upper sky is too muted/gray, the near-horizon
  band is too beige instead of pale blue/cyan-white, and the full gradient
  lacks the saturated clean blue-to-light-horizon daylight progression.
  Treat these images as implementation evidence only, not as a convincing sky
  benchmark.
- Next model step: calibrate the bounded aerosol-aware approximation against a
  stronger reference such as libRadtran/DISORT or a Bruneton-style benchmark,
  or move to the multiple-scattering design if this single-scattering
  approximation keeps accumulating compensatory rules.

Current script-runner checkpoint:

- `scripts/flat/atmosphere/run-reference-probe.js` now exists as the
  first reference probe runner.
- The runner supports built-in controlled probe ids, `--probe`, `--config`,
  `--stage`, `--out`, `--report`, `--image`, `--format json|summary`, and
  `--help`.
- The first visual-evidence command generated deterministic JSON, an
  IDE-readable Markdown report, and a linked SVG at
  `tmp/flat-reference-visual-evidence/`.
- The runner also has a `--sky-patches` mode that renders no-celestial
  sky preview panels from many `traceRay` calls. The current default benchmark
  set is `midday.zenith`, `midday.horizon`, and `sunset.horizon`;
  `midnight.zenith` remains available only when explicitly selected, and will
  stay out of routine future experiment sets until celestial objects or another
  nighttime light source are added. The preview uses shared Earth-like
  inputs rather than scene-colored shortcuts: a `6371.0088 km` radius,
  `100 km` atmosphere shell, `8 km` Rayleigh scale height, Rayleigh phase, and
  Henyey-Greenstein aerosol phase with `g = 0.8`. It now renders on a
  `380-780 nm` / `20 nm` grid with official CIE 1931 2-degree table-backed XYZ
  to sRGB display, blackbody-shaped solar samples, and approximate `300 DU`
  Chappuis-band ozone absorption. Generated artifacts live at
  `tmp/flat-reference-sky-patches/result.json`,
  `tmp/flat-reference-sky-patches/report.md`, and
  `tmp/flat-reference-sky-patches/sky-patches.svg`.
- The runner now also has a `--light-extent` mode for flat finite-Sun
  source-path classification. It loads named scenarios from
  `scripts/flat/atmosphere/data/reference/light-extent-scenarios.json`, integrates
  source-path optical depth through a simple flat atmosphere profile, applies
  finite solar-disk solid-angle falloff, and reports where configurable loss
  thresholds are crossed. Thresholds are fractions in `[0, 1)`, where values
  close to `1` mean almost nothing remains; exact `1` stays invalid because
  Beer-Lambert transmittance reaches zero only asymptotically.
- Light-extent scenarios now expose user-facing Sun controls explicitly:
  `sun.brightnessScale` scales absolute effective irradiance, and
  `sun.elevationDeg` sets the source path angle above the flat horizon.
  `sun.directLightAvailable` handles no-direct-source cases such as real-Sun
  midnight while retaining source brightness diagnostics. The current
  loss-fraction crossings intentionally remain brightness-independent;
  brightness should affect visible terrain distance later through an absolute
  brightness, exposure, or contrast threshold.
- Light-extent scenarios now also support named absolute effective-irradiance
  floors. These are calculated engineering anchors, not perceptual visibility
  thresholds. Current named floor sets cover current app flat defaults
  (`app.flatDefaults.midday`, `app.flatDefaults.midnight`) and real-Sun San
  Jose defaults (`realSun.sanJose.midday`, `realSun.sanJose.midnight`).
- Incorporating the light-extent probe into the running app is plausible as a
  configuration-time calculation. Do not run it per pixel or per frame. A
  future browser-safe kernel or adapter can run on debounced Sun/atmosphere
  control changes, cache results by physical configuration, and feed derived
  extents or curve samples to renderer/terrain systems.
- The regenerated light-extent artifacts live at
  `tmp/flat-light-extent/result.json`, `tmp/flat-light-extent/report.md`, and
  `tmp/flat-light-extent/light-extent.svg`. Current default scenario
  summaries: close horizontal dense air becomes useful-light limited at
  `310.865 km` and near-opaque at `1424 km`; close shallow-upward air becomes
  useful-light limited at `549.0064 km` without reaching the near-opaque
  threshold by `4000 km`; distant finite horizontal dense air becomes
  useful-light limited at `613.3115 km` and near-opaque at `1424 km`;
  constant dense air becomes useful-light limited at `270.6049 km` and
  near-opaque at `1151 km`; app flat closest false-Sun crosses the app
  `0.1%` effective-source floor at `147800 km`; app flat opposite false-Sun
  remains direct-lit at about `20.1 deg` elevation and crosses that same floor
  at `121300 km`; real-Sun San Jose solar noon does not cross its `0.1%` TOA
  irradiance floor within the sampled `500000 km` span; real-Sun San Jose
  midnight marks direct light unavailable and is below its floor at path start.
- The built-in probes are explicitly controlled smoke probes through the
  canonical transport stages. They are useful evidence that stage composition,
  spectral component summation, view transmittance, surface handoff, and the
  report path work. They are not yet full globe/flat physical adapters, and
  their swatches use a debug `650/550/450 nm -> R/G/B` mapping rather than CIE
  colorimetry.
- The sky-patch mode adds basic camera rays and a spherical sky-volume/source
  adapter. It is intentionally a preview adapter, not a full physical
  globe/flat world implementation. Its display conversion now consumes the
  package-level official CIE 1931 2-degree table path.
- Integration coverage has been filled out under the documented test split:
  `pipeline-stages.spec.js` is registry-only, `pipeline-handoffs.spec.js`
  covers adjacent packet compatibility, and `trace-ray.integration.spec.js`
  covers full `traceRay` known-answer fixtures for vacuum, homogeneous
  isotropic sky scattering, and Lambertian surface attenuation.
- Reference-integrator-only testing closure is complete for the current API
  boundary. `CpuSpectralReferenceIntegrator` now rejects non-array custom
  stage lists, duplicate custom stage ids, descriptors without `StageClass`,
  scalar probes, and name-only probes before a named probe registry exists.
  The obsolete placeholder-stage fallback was removed, and the local test
  README now reflects the active registry/facade/handoff/trace/stage split.
- The reset design now names the next layer explicitly: a benchmark world and
  camera harness that assembles reusable globe/flat model adapters,
  camera-relative probes, post-pipeline color/display consumers, and CLI
  benchmark scenario files. This layer turns the trusted transport core into
  deterministic JSON, Markdown, and visual artifacts before shader parity.
  It is still script-owned and framework-free; shader/browser work remains
  downstream of these benchmark scenarios.
- The benchmark camera design is now explicit. The camera adapter is a
  pre-transport pinhole ray generator that resolves WGS84 geodetic or flat
  observer definitions, local east/north/up frames, azimuth/elevation,
  `towardSun`, target, and NDC views into the existing `observer.positionKm`
  plus normalized `ray.direction` request shape. PBRT's camera interface
  supplies the camera-to-ray separation, EPSG 7030 supplies the WGS84
  ellipsoid constants, and ESA Navipedia's ECEF/ENU transform supplies the
  globe local-frame reference. Target encoding is now decided: hand-authored
  benchmark targets default to geodetic latitude/longitude plus
  `elevationKmMsl` so location changes do not require rewriting
  observer-relative offsets, flat hypothesis runs adapt those anchors through
  the north-pole-centered azimuthal equidistant projection, and
  colored/hittable markers are fixture-owned surfaces. The coordinate-role
  rule is also explicit: geodetic coordinates own permanent facts,
  observer-relative coordinates own subjective/view-local intent, and
  Three/app scene coordinates are future generated render endpoints. Repeated
  coordinate bridge calculations may be precomputed or cached as generated
  artifacts when their keys include the canonical source inputs and frame
  metadata; cached transforms must not replace source geodetic, observer, or
  target facts. The design now treats coordinate spaces and transforms as core
  shared functionality and includes an explicit full-roadmap transform
  inventory for WGS84 datum/geodetic/ECEF/ENU, flat projection,
  camera/view rays, source-to-sample geometry, fixture surfaces, and later
  Three.js camera state, shader reconstruction, floor textures, and sky-dome
  endpoint projections. Current implementation is scoped to proving the CPU
  reference, so app/browser/shader endpoint adapters remain deferred. Open
  implementation is now the camera-bridge first slice under the reference
  package: WGS84 datum/height/geodetic/ECEF/ENU, first
  ECEF-to-globe model adapter, flat north-pole azimuthal equidistant
  projection, flat local frames, observer/target/source direction resolution,
  plumb-aligned pinhole basis/NDC rays, provenance metadata, and deterministic
  cache-key fields. `rollDeg = 0` now means image vertical is parallel to the
  local plumb line, and roll degrees increase clockwise in the image plane
  with `0` at plumb-up/12 o'clock; missing `rollDeg` defaults to that normal
  unrolled state. Open items are first `frameId` metadata names, first
  FOV/aspect/NDC artifact layout, whether Phase 6A needs a real
  geoid/terrain sea-level datum, and later browser/Three.js parity
  confirmation for the same clock-angle roll convention after reference
  benchmarks are trusted.
- Scope correction: the current goal is proving the reference, not designing
  app integration. Phase 6A now stops at CPU trace requests, deterministic
  JSON/Markdown/visual CLI artifacts, and the first-slice transform/camera
  helpers needed to feed them. Three.js, shader, floor texture, sky-dome, and
  app-specific endpoint rows remain deferred parity roadmap. Verification:
  `git diff --check` passed, and the trailing-whitespace scan across the
  updated docs returned no matches.
- Scope refinement: the next reference-proof bottleneck is not heavy
  coordinate/app bridging. The plan and design now prioritize two concrete
  proof targets: a deterministic post-pipeline output path that converts
  reference results into image pixels, and an Earth-like atmosphere model whose
  constants and omissions are sourced and diagnosed. Camera/coordinate work is
  now explicitly minimal for this slice: enough to aim midday, midnight, and
  sunset sky patches, or to allow explicit low-level rays for early analytic
  probes, without building renderer-facing infrastructure.
- Minimal color consumer package implemented beside the reference package:
  `scripts/flat/atmosphere/color/spectral-color.js` now loads and validates
  the official CIE 1931 2-degree color matching table, linearly interpolates
  within the published `360-830 nm` range, contributes zero outside that range,
  exposes `spectralRadianceToXyz` and `spectralRadianceToLinearSrgb` as the
  domain API, preserves unclamped out-of-gamut linear RGB, records color
  provenance, and keeps the analytic approximation as a named preview/fallback
  path. `scripts/flat/atmosphere/color/pixel-output.js` converts post-pipeline
  linear sRGB into deterministic pixel packets, supports explicit `srgb` or
  `linear` byte encoding, applies display exposure only after physical color is
  complete, records clamped channels, preserves source diagnostics, builds
  row-major pixel images, and emits dependency-free ASCII PPM plus PNG
  artifacts from the same pixel packets. Color/pixel packets now carry CMF,
  interpolation, integration, RGB matrix, output color space, encoding,
  exposure, alpha, clamped-channel, and source-provenance diagnostics for the
  current benchmark path.
  The color fidelity roadmap now lives in
  `agents/topics/apps/flat/plans/atmosphere_reset/color/plan.md`.
- Official CIE source data for the next color-fidelity pass is now stored in
  `scripts/flat/atmosphere/data/color/cie-1931-2deg.csv`, with publisher
  metadata in `cie-1931-2deg-metadata.json` and local provenance in the data
  README. The CSV was verified against CIE's published MD5
  `17cca777db64b17170f06f67ce9d3ab7` and contains `471` rows from `360` to
  `830 nm`; ingestion/parsing is now implemented in `spectral-color.js`.
- CLI hookup implemented: `run-reference-probe.js --image <path>.ppm|.png`
  now uses the sibling `color` post-pipeline pixel bridge for
  sky-patch artifacts, while other image paths keep the existing SVG output.
  Sky-patch runs accept `--color preview-cie|official-cie`,
  `--encoding srgb|linear`, and `--exposure <scale>`. Sky-patch cells are also
  colored through `linearRgbToPixel`, and each patch carries a `pixelImage`
  packet in JSON so pixel bytes remain traceable to reference diagnostics. The
  reference package index no longer exports color helpers; color remains a
  consumer of completed pipeline output, not part of transport.
- Generated proof artifact:
  `node scripts/flat/atmosphere/run-reference-probe.js --sky-patches --patch midday.zenith,sunset.horizon,midnight.zenith --image tmp/atmosphere-reference-sky-patches.png --report tmp/atmosphere-reference-sky-patches.md --out tmp/atmosphere-reference-sky-patches.json --format summary`
  produced a 132x28 PNG image plus Markdown/JSON using the official CIE table
  color path. Summary centers were midday `#8b9cbd`, sunset `#f28000`, and
  midnight `#000000`.
- Verification after moving color beside the reference package:
  `npm run test:scripts:flat` passed with 301 specs and 0 failures after
  official CIE ingestion, spectral-to-linear-sRGB domain API coverage, pixel
  provenance, CLI color/display flags, PNG output, and CLI wiring;
  `git diff --check` passed.
- Sky-patch wavelength-grid controls are implemented:
  `--wavelength-grid preview-20nm|benchmark-5nm|cie-1nm`. The default remains
  `preview-20nm` (`380-780 nm / 20 nm`, `21` samples); `benchmark-5nm`
  provides `380-780 nm / 5 nm`, `81` samples; and `cie-1nm` exposes the full
  official CIE `360-830 nm / 1 nm`, `471` sample domain for spot checks. The
  `benchmark-5nm` proof command generated
  `tmp/atmosphere-reference-sky-patches-5nm.png` plus Markdown/JSON with
  centers midday `#8b9cbd`, sunset `#f18000`, and midnight `#000000`.
  `npm run test:scripts:flat` passed with 302 specs and 0 failures after this
  change.
- The color plan still records the next output-fidelity roadmap: sourced solar
  spectra, better absorber spectra, display/tone-mapping policies,
  white-balance diagnostics, per-pixel supersampling, CIE-table-aligned
  workflows, and comparison artifacts.
- Sourced solar-spectrum controls are implemented for sky patches:
  `--solar-spectrum blackbody-5778k|astm-g173`. The ASTM path reads
  `ASTMG173.csv` directly from
  `scripts/flat/atmosphere/data/color/astm-g173/astmg173.zip`, uses the
  Gueymard 2002 extraterrestrial `Etr W*m-2*nm-1` column, and records source
  provenance in JSON/Markdown. A `benchmark-5nm` comparison generated
  `tmp/atmosphere-reference-sky-patches-5nm-blackbody.png` with centers
  midday `#8b9cbd`, sunset `#f18000`, midnight `#000000`, and
  `tmp/atmosphere-reference-sky-patches-5nm-astm-g173.png` with centers
  midday `#889cbe`, sunset `#ef8000`, midnight `#000000`.
  `npm run test:scripts:flat` passed with 308 specs and 0 failures after this
  change.
- Direction update: color/output improvements are now considered sufficient
  for the current proof loop. The next fidelity focus is sourced atmospheric
  composition: Rayleigh coefficient model, ozone absorber policy, aerosol/Mie
  policy, and species/profile provenance in diagnostics. This is recorded in
  the new
  [Atmosphere Composition Plan](../composition/plan.md); remaining color
  follow-ups stay lower priority until the atmosphere model improves.
- The atmosphere reset plan now clarifies that the immediate composition
  implementation step is the first item from the fidelity list: close the
  Rayleigh model with clean Bucholtz 1995 data/provenance, tests, and a named
  `bucholtz-standard-air` policy. Minimal policy scaffolding should support
  comparing preview Rayleigh against Bucholtz Rayleigh; broader aerosol/ozone
  policy work follows after that path is proven. If the checklist grows, it
  now lives in the focused atmosphere-composition plan folder.
- The atmosphere composition plan now includes the detailed Rayleigh substeps:
  confirm clean source data, choose the pinned coefficient/cross-section or
  optical-depth artifact, record Bucholtz extraction/provenance, implement
  named preview and `bucholtz-standard-air` policies, add focused tests, and
  generate preview-vs-Bucholtz sunset comparison artifacts.
- Rayleigh substeps 1-4 are complete for the composition source-data slice.
  The new composition-owned folder
  `scripts/flat/atmosphere/composition/` contains a curated Bucholtz 1995
  standard-air Rayleigh artifact at
  `scripts/flat/atmosphere/data/composition/rayleigh/bucholtz-1995-standard-air.json`,
  with Table 2 pinned volume-scattering coefficient rows, Table 3 formula
  constants, selected Table 4 optical-depth validation rows, and source-data
  specs wired into the flat script Jasmine lane. The selected primary quantity
  is the local standard-air volume-scattering coefficient in `1/km`; optical
  depth remains secondary validation data for named atmosphere columns.
  `npm run test:scripts:flat` passed with 313 specs and 0 failures after the
  composition source-data artifact and spec were added.
- The script-side atmosphere packages are now consolidated under one
  `scripts/flat/atmosphere/` folder with `reference`, `color`, and
  `composition` child folders. The flat script Jasmine config now discovers
  specs from that shared parent, and the reference CLI imports color helpers
  from the sibling `color` folder.
- The CLI is now atmosphere-owned at
  `scripts/flat/atmosphere/run-reference-probe.js` instead of living under the
  reference package. Shared source artifacts and scenario inputs now live under
  `scripts/flat/atmosphere/data/`, with `data/color`, `data/composition`, and
  `data/reference` subfolders. `npm run test:scripts:flat` passed with 313
  specs and 0 failures after the CLI and data moves.
- Rayleigh implementation substeps 5-7 are complete. The composition package
  now provides `rayleigh-policy.js` with `rayleigh-lambda4-preview` as the
  unchanged default/control and `bucholtz-standard-air` as an explicit sourced
  policy using the local Bucholtz 1995 artifact. The atmosphere CLI accepts
  `--rayleigh-policy` and `--patch-size WIDTHxHEIGHT`, and sky-patch
  JSON/Markdown include the selected policy and pixel dimensions.
  Preview-vs-Bucholtz `sunset.horizon` artifacts were generated at
  `tmp/atmosphere-rayleigh-comparison/` with `benchmark-5nm` plus
  `astm-g173`: preview center `#ef8000`, Bucholtz center `#ff9c00`.
  Larger `132x84` review PNGs were generated without full JSON output:
  preview center `#ee8300`, Bucholtz center `#ff9f12`.
  Exposure-check variants for the Bucholtz sunset show the same physical
  radiance at display exposure `2` (`#c3730a`) and `3` (`#ea8b0e`), confirming
  that the default exposure `4` red-clips the display channel and can make the
  patch read too yellow/green.
  The color output bridge now exposes `--tone-map clip|preserve-hue`;
  `preserve-hue` prevents channel-by-channel red clipping by scaling exposed
  display-linear RGB together. The generated Bucholtz `132x84` preserve-hue
  artifact has center `#ff9811` with unchanged physical linear RGB.
  `npm run test:scripts:flat` passed with 322 specs and 0 failures after the
  tone-map option, patch-size option, policy helper, CLI wiring, focused tests,
  and artifacts.
- Sourced ozone cross-section support is implemented for sky-patch
  composition comparisons. The MPI-Mainz/Brion 1998 `295 K` ozone table is
  stored under `scripts/flat/atmosphere/data/composition/ozone/` with local
  metadata, SHA-256, and pinned validation rows. The composition package now
  provides `ozone-policy.js` with `preview-chappuis` as the default/control
  and `brion-1998-ozone-295k` as the explicit sourced policy. The atmosphere
  CLI accepts `--ozone-policy` and includes policy provenance in JSON and
  Markdown outputs. A fixed Bucholtz Rayleigh, ASTM G-173, `benchmark-5nm`,
  `132x84`, preserve-hue sunset comparison generated
  `tmp/atmosphere-rayleigh-comparison/sunset-bucholtz-brion-ozone-132x84-preserve-hue.png`;
  the sourced table moved the center from preview ozone `#ff9811` to Brion
  ozone `#ff990f`, a measurable but small shift. The still-open ozone work is
  a sourced vertical profile/column policy rather than another preview curve.
  `npm run test:scripts:flat` passed with 332 specs and 0 failures after this
  change.
- The first aerosol/profile composition pass is complete. The composition
  package now exposes `aerosol-policy.js` with `rayleigh-only`,
  `preview-earthlike-aerosol`, `clear-maritime`, `clear-continental`, and
  `hazy-continental`; the former hardcoded aerosol is preserved as the
  `preview-earthlike-aerosol` default/control. It also exposes
  `profile-policy.js` with `preview-exponential-8km` and
  `us-standard-atmosphere-1976-density`, using local density-ratio checkpoints
  from the U.S. Standard Atmosphere 1976/PDAS table backed by NASA NTRS
  `19770009539`. The atmosphere CLI accepts `--aerosol-policy` and
  `--molecular-profile`, records selected policy provenance in JSON/Markdown,
  and center diagnostic samples now include species optical-depth summaries.
  Review artifacts were generated under
  `tmp/atmosphere-composition-comparison/`, with an embedded-image summary at
  `tmp/atmosphere-composition-comparison/README.md`. Initial center swatches:
  aerosol Rayleigh-only `#665b38`, clear maritime `#df8c25`, clear
  continental `#bc7114`, hazy continental `#7e3c00`; U.S. Standard Atmosphere
  profile with clear maritime `#d27d16`. `npm run test:scripts:flat` passed
  with 341 specs and 0 failures after this change.
- Wider-FOV visual review support is implemented through
  `--fov-y-deg <degrees>` on the sky-patch CLI. The built-in scene defaults
  remain unchanged, but generated review runs can override the vertical camera
  FOV and record the effective camera in patch metadata. `72 deg` FOV sunset
  and best-current three-patch PNGs were generated under
  `tmp/atmosphere-composition-comparison/` and embedded in the comparison
  README. `npm run test:scripts:flat` passed with 341 specs and 0 failures
  after this change.
- [Sun Visual Plan](../sun/sun_visual_plan.md) now tracks the sunlight-specific
  visual gap between physically lit sky patches and familiar sunset images.
  It records the missing stack: finite solar disk, near-sun angular
  resolution, better aerosol phase model, direct solar radiance, disk
  occlusion, multiple scattering, camera/display response, and surface
  context. Its recommended first slice is a diagnostic sun/aureole visual mode
  that adds finite-disk awareness and direct-disk diagnostics without claiming
  to solve bloom, multiple scattering, or terrain reflection.
- The first diagnostic sun/aureole visual mode is implemented in the
  sky-patch CLI as `--sun-visual none|diagnostic`. It remains CLI-side and
  does not alter canonical transport stages. Diagnostic PNG/PPM output stacks
  sky-only, angular-distance heatmap, disk mask, direct-disk approximation,
  and sky-plus-disk approximation panels. A new `sunset.sun` patch aims
  directly at the low sun for tight finite-disk checks. Generated artifacts
  live under `tmp/atmosphere-sun-diagnostic/`: the wide `72 deg` horizon view
  has `0 / 11088` disk-hit pixels because the closest pixel is still
  `0.4959 deg` from sun center, while the tight sun-centered crop has
  `24 / 11088` disk-hit pixels with a closest angle of `0.0675 deg`.
  The Markdown reports now also include fixed angular bucket rows for
  `0-0.25`, `0.25-0.5`, `0.5-1`, `1-2`, `2-5`, and `5-10 deg`, averaging
  sky radiance, direct-disk approximation, sky-plus-disk, view transmittance,
  and Rayleigh/Mie/ozone optical depth. The tight crop shows direct-disk
  contribution only in the `0-0.25 deg` bucket; the wide context has no direct
  disk contribution in any bucket. [Sun Visual Plan](../sun/sun_visual_plan.md) now
  records the diagnostic result sorted by contributor: aerosol/Mie is the
  largest physical lever, Rayleigh is second, ozone is smaller but nonzero,
  and the largest visual gap remains the missing rendered
  sun-disk/aureole/glare stack in the wide sunset evidence. `npm run
  test:scripts:flat` passed with 342 specs and 0 failures after this change.
- Earlier verification after the reference-integrator-only testing closure:
  `npm run test:scripts:flat` passed with 279 specs and 0 failures.

Current state: stage API scaffold exists, the first analytic expectation
fixture is encoded as JSON, validation specs cover that fixture's shape and
helper behavior, and `validateRequest` has completed its first red-to-green
loop with real domain tests and implementation. The
`integrateViewOpticalDepth` fixture rows have been generated, reviewed against
the domain contract, consumed by isolated real stage tests, and implemented.
The first `resolveRayPath` fixture-backed batch and the recommended hardening
batch have also completed their red-to-green loops. The `sampleViewPath`
fixture rows have now completed their red-to-green loop with a fixed midpoint
sampler implementation. The first `evaluateMedium` fixture-backed batch is
implemented and green, and the follow-up extreme fixture rows are now encoded
with references. The extreme inventory now pairs positive and negative cases
for profile density, vacuum/coefficient consistency, visible-grid shape, and
coefficient validity. Composition now has the same positive/negative pairing
because a stage owns validation of the inputs it consumes. The follow-up
extreme specs are wired and green. `integrateSolarTransmittance` has now
completed its first stage-owned fixture batch: controlled solar-source samples
and model-owned source-path segments are integrated with Beer-Lambert
transmittance, source visibility is preserved, invalid source-path data
rejects at the stage boundary, and the direct stage specs are green. The first
contract-alignment pass after that batch is also complete: stage descriptors,
ambient types, stage code, fixtures, and direct tests now agree on
`validatedRequest` ownership, `integrateSolarTransmittance`'s `rayPath`
prerequisite, source spectra, source directions, and optional surface-point
source transmittance. `evaluateScatteringPhase` has now completed its first
direct stage batch: explicit isotropic phase metadata evaluates to the
normalized PBRT value, Rayleigh phase uses the expected symmetric angular
shape, positive-`g` Henyey-Greenstein aerosol phase follows the documented
local sign convention, source-sample angle diagnostics use that convention,
empty medium-sample input emits explicit empty phase output, and unsupported
phase kinds reject at the stage boundary.
The final three transport stages are now implemented for their first sourced
or API-contract batches: `integrateSingleScattering` accumulates the one-sample
PBRT product and empty-path zeros, `resolveSurfaceRadiance` handles controlled
Lambertian model radiance and no-hit zeros, and `composeSpectralRadiance`
sums transport components without display clamping or color conversion.

The CPU spectral reference work is now encapsulated in this folder:

- [README](README.md): human-facing purpose and navigation.
- [Stage Contracts](stage_contracts.md): canonical input/output packet
  contracts for each reference pipeline stage.
- [Code Design](code_design.md): API and pipeline-stage contract.
- [Test Design](test_design.md): high-level stage test matrix.
- [Test Plan](test_plan.md): actionable stage-test sequence and current
  fixture-backed test batches.
- [Reference Decision Log](references.md): consulted references, decisions
  they informed, assumptions, limits, and open reference needs.
- [Fixture Sources](fixture_sources.md): fixture-readiness inventory and
  deficiency list for expected data.
- [Plan](plan.md): implementation checklist for `scripts/flat/atmosphere/reference`.

The implemented-stage source-breadcrumb audit in
[Plan](plan.md#immediate-remediation-implemented-stage-source-breadcrumb-audit)
is complete. All implemented-stage code, direct specs, integration specs, shared utilities,
fixture validation, fixture-file sweeps, and source/design documentation rows
are marked `verified`. New reference work can build on green direct stage,
handoff, and full trace-ray coverage.
[Test Plan](test_plan.md#stage-execution-runbook) and
[Test Design](test_design.md#expected-value-policy) now carry the source
breadcrumb standards forward as future-stage implementation instructions, so
new stages must maintain the same code-branch, assertion, fixture, and
source-documentation traceability before they can be marked complete.
`npm run test:scripts:flat` passed with 217 specs, 0 failures, and
`git diff --check` passed after this instruction update.

Stage progress uses the status values defined in
[Test Plan](test_plan.md#stage-status-values). Run each stage through the
execution sequence in [Stage Execution Runbook](test_plan.md#stage-execution-runbook):
identify scope and extremes, add skeletons, source fixtures, wire red tests,
code with source breadcrumbs, then verify green and update docs. Current stage
ledger:

| Order | Stage | Status | Notes |
| --- | --- | --- | --- |
| 1 | `validateRequest` | `complete` | Direct stage tests and implementation are green. |
| 2 | `resolveRayPath` | `complete` | Fixture-backed contract and hardening batches are green. |
| 3 | `sampleViewPath` | `complete` | Fixed midpoint sampler tests and implementation are green. |
| 4 | `evaluateMedium` | `complete` | Contract batch and sourced/extreme follow-up batch are green. |
| 5 | `integrateViewOpticalDepth` | `complete` | Main stage tests and adjacent handoff regression are green. Follow-up below is separate. |
| 6 | `integrateSolarTransmittance` | `complete` | Controlled source-path and contract-alignment batches are green, including source spectra and optional surface-point transmittance. |
| 7 | `evaluateScatteringPhase` | `complete` | Explicit isotropic, Rayleigh, and Henyey-Greenstein phase behavior, angle diagnostics, empty output, and unsupported phase-kind rejection are green. |
| 8 | `integrateSingleScattering` | `complete` | One-sample product, empty output, and negative source-term rejection are green. |
| 9 | `resolveSurfaceRadiance` | `complete` | Black/white Lambertian controlled-model rows and no-hit output are green. |
| 10 | `composeSpectralRadiance` | `complete` | Wavelength component summation, bright unclamped output, and negative rejection are green. |

`integrateViewOpticalDepth` follow-up:

- Follow-up status: `complete`.
- Notes: hardening fixture rows are sourced and encoded in
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/view-optical-depth-hardening.json`;
  matching Jasmine tests are now active and green. Supplied non-finite
  `intervalEndKm` rejects; omitted or `undefined` endpoint data may fall back
  to the final sample distance.

Current decisions:

- [Stage Contracts](stage_contracts.md) is now the canonical input/output
  contract for every reference pipeline stage. Code, tests, fixtures, reports,
  and shader-parity notes should target that document for packet shape and
  ownership decisions. `pipeline-stages.js` should mirror its top-level
  prerequisites/provided fields, while `types.d.ts` should mirror the concrete
  nested packet shapes.
- Each canonical stage is independently runnable through
  `CpuSpectralReferenceIntegrator.runStage`.
- Stage descriptors declare `id`, `requires`, `provides`, and `StageClass`.
  `pipeline-stages.js` remains the canonical registry and
  `CpuSpectralReferenceIntegrator` constructs helper objects from those
  descriptors.
- Decision update: each canonical physical stage should move behind its own
  focused helper class. The public method remains
  `CpuSpectralReferenceIntegrator.runStage(stageId, packet) -> packet`; helper
  classes share `run(packet) -> packet`, with `descriptor` and integrator
  `context` supplied at construction.
- Class files export their class as the default export and export nothing else.
  Package barrels can re-export defaults under public API names, but class
  modules stay single-purpose.
- Pair the helper-class split with a test split: the helper spec owns internal
  algorithm and edge-case tests, while the integrator stage spec owns public
  `runStage(stageId, packet)` input/output behavior.
- Treat the reference as a potential future standalone package. Keep the core
  framework-free, plain-data based, externally justified, and browser-free so
  later extraction is a promotion step rather than a rewrite.
- Defer JSON config/schema validation until the CLI run-definition shape is
  stable. When that decision is made, prefer a standard JSON validation
  framework with explicit schemas over a hand-rolled validator. This includes
  tests that inputs accept only a given list of properties.
- Internal math helpers are acceptable during contract discovery, but they must
  remain replaceable. Prefer validated external libraries later when they have
  stronger provenance, standards alignment, numerical coverage, licensing, and
  maintenance; use narrow wrappers and keep domain tests as the authority.
- Physical behavior should be implemented one canonical stage at a time, with
  that stage's unit tests written and observed failing before implementation.
  `validateRequest` is the first completed example of that loop.
- From now on, stage implementation should proceed in canonical pipeline order.
  Do not implement a downstream stage while an earlier physical stage remains
  placeholder unless the user explicitly makes a scoped exception. The
  earlier `integrateViewOpticalDepth` scoped exception is complete, and the
  pipeline has since advanced through `integrateSolarTransmittance`. The
  implemented-stage source-breadcrumb audit recorded in
  [Plan](plan.md#immediate-remediation-implemented-stage-source-breadcrumb-audit)
  is now complete; the next canonical stage is `evaluateScatteringPhase`.
- Stage tests are the authority right now. Integration tests may keep checking
  API composition, stage history, and adjacent producer/consumer packet
  compatibility, but they should not be used as proof of physical correctness
  until every stage they compose has its own isolated known-answer tests.
- Stage boundary mismatches should be resolved by choosing one canonical packet
  form in [Stage Contracts](stage_contracts.md), not by supporting both forms.
  The preferred form is the one most useful downstream, with one source of
  truth, explicit units/identifiers, and cheap derived values carried only when
  they reduce downstream ambiguity or model re-querying.
- Stage tests must be domain-first: expected results come from physics, math,
  public API contracts, analytic known answers, invariants, or pinned external
  reference data, not from the current code shape or helper implementation.
- Tests may assert that required fields are present. Do not assert that a field
  is absent unless the field is mutually exclusive with another accepted field.
  Prefer positive output-contract assertions over "no extra field" shape checks.
- Code validates the input shape each stage consumes while tolerating unrelated
  extra fields. Code may require field absence when the input contract defines
  mutually exclusive alternatives. Tests may include extra input fields, then
  assert the contracted output fields and values produced by the stage.
- Expected values should be pinned directly in tests or fixtures whenever
  practical: authoritative table rows, standard metadata, hand-computed
  closed-form literals, or generated artifacts from an independent external
  source with versioned inputs and provenance. Do not justify one new local
  implementation with another new local implementation.
- Every expected datum that enters a spec or fixture must have a nearby
  derivation note naming the equation, table, metadata field, external
  tool/config, or provenance record well enough for a reviewer to locate it.
  In specs this is usually a comment; in JSON fixtures, use the canonical
  `reference` object with `id`, `kind`, `title`, `url` or `path`, `locator`,
  and `derivationSummary`, plus `expected.<quantity>.derivation` for exact
  value arithmetic.
- Implemented algorithm steps also need source breadcrumbs, not only rejection
  branches. Positive path selection, optical-depth accumulation, species
  summation, and Beer-Lambert conversion should cite the supporting source,
  fixture row, or local design contract near the code.
- [Test Design](test_design.md) now defines an expectation intake checklist:
  quantity, source class, source, assumptions, expected value, derivation note,
  tolerance, and review note before each pending shell becomes a real test.
- [Test Design](test_design.md) now distinguishes validation scopes:
  `validateRequest` validates request data against physical-unit sanity,
  model-interface contracts, and numerical-control limits; later transport and
  scattering stages validate computed values against physical equations,
  analytic invariants, independent fixtures, or numerical-convergence limits.
- [Test Design](test_design.md) now includes reference-mined verification
  ranges for hard transport invariants, solar-source sanity, ASTM G-173 AM1.5
  conditions, U.S. Standard Atmosphere checkpoints, CIE spectral-to-color
  checks, Rayleigh wavelength behavior, and Bruneton-style implementation
  discipline. These are sanity bands and known-value seeds, not substitutes for
  stage-specific analytic tests.
- [Test Design](test_design.md) now also defines the analytic invariant test
  pattern: start with toy fixtures such as vacuum, zero-length path,
  homogeneous medium, split path, isotropic phase, one-sample scattering, and
  Lambertian surfaces before importing external reference tables or broad
  sky-color comparisons.
- [Reference Decision Log](references.md) is the running traceability list for
  references consulted and decisions they informed. Update it whenever a source
  changes a value range, fixture, invariant, model assumption, or review
  checklist.
- [Fixture Sources](fixture_sources.md) now records which fixture inputs are
  ready, partially ready, or not ready. Ready sources include the analytic PBRT
  transport/phase/surface spine, CIE metadata, ASTM G-173 table metadata,
  PDAS atmosphere checkpoints, Kasten and Young air-mass rows, and explicitly
  named flat lateral-boundary hypotheses. Deficiencies remain for visible-band
  Rayleigh table extraction, aerosol/Mie, ozone, water vapor, full clear-air
  spectra, max species count, max sample count, and unsourced flat-world
  lateral extents.
- The fixture source inventory says we have enough to proceed with the next
  analytic `integrateViewOpticalDepth` test pass, but not enough yet for a full
  Earth clear-air spectral transmittance fixture. The coverage review found
  three gaps before implementation: weighted interval integration,
  coefficient/wavelength shape rejection, and invalid sample-weight rejection.
  Those are now represented as fixture rows and pending stage shells.
- [Reference Decision Log](references.md) now also owns the expected-value
  intake workflow and the first analytic expectation batch: vacuum
  transmittance, zero-length transmittance, homogeneous Beer-Lambert,
  split-path multiplicativity, isotropic phase, one-sample scattering, and
  black/white Lambertian cases.
- Package-shape precedent now includes libRadtran as a standalone
  radiative-transfer package, SMARTS as a standalone clear-sky spectral model
  with text inputs/outputs and reference-spectrum use, Bruneton as CPU-reference
  validation precedent, and SemVer as the future public-API/versioning rule.
- [Code Design](code_design.md) now includes an external dependency policy for
  replacing internal helpers with validated libraries without letting a library
  define expected behavior by accident.
- [Code Design](code_design.md) now also includes a deferred pipeline-effects
  note. Before the design is treated as complete, expand it into an
  omitted-effects ledger covering nontrivial deferred physics such as
  refraction, with likely impact, deferral reason, affected stage/model
  contract, and required reference/test evidence.
- `validateRequest` owns the ray-direction domain policy: input direction is a
  finite nonzero orientation vector, and validated output is a canonical unit
  vector for downstream distance math. Utility helpers can implement this, but
  they do not define the expectation.
- Flat/local-Sun geometry must treat large lateral atmosphere paths as a first
  class model consequence. A flat horizontal ray in a slab is infinite unless a
  named lateral boundary is configured; a large finite boundary should produce
  large optical depth through the same Beer-Lambert/path-integral math, not a
  special flat-world attenuation constant.
- Follow-up in progress: flat-world lit-terrain visibility depth. The
  reference now has an initial `--light-extent` classification probe for
  source-path extinction plus finite-Sun solid-angle falloff. The later
  terrain-visibility probe still needs to combine source-to-terrain,
  terrain-to-camera, and source-to-air sample paths so it can report how
  source-path extinction, view-path extinction, in-scattered airlight, and
  terrain contrast determine how far into a lit region detail remains visible.
  If modeled contrast/detail is functionally gone, a named low-detail visual
  proxy remains acceptable for rendering evidence, but it must be recorded as a
  visibility-threshold approximation rather than hidden ambient light or an
  unowned texture fade.
- Scattering phase evaluation is separate from single-scattering radiance
  accumulation so angle/phase-function tests can run independently.
- `traceRay` must compose the same public stages used by tests.
- CLI design is intentionally deferred until the API shape is stable.
- Shader design remains deferred until the CPU reference has trusted
  known-answer outputs.

Current implementation:

- `scripts/flat/atmosphere/reference` contains the declarative stage registry,
  the integrator facade, and focused stage helper classes under
  `scripts/flat/atmosphere/reference/stages`.
- `CpuSpectralReferenceIntegrator.js` follows class file naming conventions and
  now default-exports its class. `types.d.ts` defines ambient JSDoc contracts
  for the shell API.
- `types.d.ts` now includes concrete ambient contracts for transport rays,
  model-returned atmosphere intervals, surface hits, `resolveRayPath` output,
  and the world/atmosphere/solar/surface model modules so stage code gets
  useful IntelliSense for calls such as `model.atmosphere.intersect(ray)` and
  `model.world.intersectSurface(ray)`.
- [Code Design](code_design.md) now defines `resolveRayPath` boundary
  precedence: later surface hits are ignored, exact entry surface hits produce
  empty paths, exact exit surface hits use surface precedence with atmosphere
  metadata, non-finite surface-hit distances reject, negative surface hits are
  ignored as behind-observer, malformed finite atmosphere intervals reject, and
  model calls receive the validated transport ray.
- `spec/support/jasmine-flat-reference.json` defines the focused Jasmine lane.
- `npm run test:scripts:flat` runs only the flat reference script specs.
- The root pipeline scaffold spec now covers registry and composition behavior;
  stage-specific tests live in
  `scripts/flat/atmosphere/reference/stages/_tests` using
  `<ClassName>.spec.js` names.
- `scripts/flat/atmosphere/reference/stages/_tests/ValidateRequestStage.spec.js`
  now has
  real domain tests for valid canonical output and invalid named-error cases.
  They cover globe and flat model contracts, unit ray-direction
  canonicalization, wavelength-grid preservation, numerical-control merging,
  model-owned physical constants, request immutability, required model
  interface methods, invalid vectors/wavelengths/numerical controls, and
  rejection of request-level physical coefficients.
- The `validateRequest` expected values are source-aligned through inline
  comments that point back to [Code Design](code_design.md) sections such as
  Inputs, Model Interface, Public API Shape, Numerical Controls, and to
  [Test Design](test_design.md)'s `validateRequest` matrix. Arithmetic
  expectations, such as `[3, 4, 0] -> [0.6, 0.8, 0]`, include local derivation
  comments. Each validation limitation also has a nearby reason comment
  explaining the physical admissibility, numerical necessity, or API
  source-of-truth constraint behind the check.
- Shared stage contract data and reusable spec expectations live in
  `scripts/flat/atmosphere/reference/_tests/test-pipeline-stages.js` to keep
  stage specs small as physical behavior tests are added.
- The first expectation-ledger fixture lives at
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/analytic-invariants.json`.
  It encodes sixteen analytic/error-contract expectations with structured
  canonical `reference` provenance and per-expected-value derivation notes.
  Physics-backed rows now use external PBRT references rather than local-only
  design references: transmittance, phase, volume-scattering in-scattering,
  and diffuse reflection.
- Expectation fixture helpers live in
  `scripts/flat/atmosphere/reference/_tests/test-expectations.js`. They load
  the analytic fixture, index rows by `id`, retrieve individual expected data,
  and centralize exact, absolute, and relative tolerance assertions for future
  specs.
- Fixture validation specs live in
  `scripts/flat/atmosphere/reference/_tests/expectation-fixtures.spec.js`.
  They validate fixture metadata, pinned expectation ids, canonical `reference`
  objects, expected-value derivations, tolerance alignment, and helper
  tolerance behavior. They also reject physics-backed expectation rows whose
  canonical reference is not external. They now support array-valued numeric
  oracles for wavelength/sample-aligned expectations and structured
  `expectedError` rows for loud-failure fixtures such as negative extinction.
- The next optical-depth fixture rows have been added to
  `analytic-invariants.json`: empty explicit output, two-sample monotonic
  accumulation, multi-wavelength homogeneous transport, multi-species
  summation, negative-extinction rejection, weighted piecewise-constant sample
  integration, coefficient/wavelength shape rejection, and invalid
  sample-weight rejection.
- `scripts/flat/atmosphere/reference/stages/_tests/IntegrateViewOpticalDepthStage.spec.js`
  now contains real `integrateViewOpticalDepth` tests for the full analytic
  optical-depth batch. They use crafted packets with `wavelengthsNm`,
  `mediumSamples`, `weightKm`, wavelength-indexed extinction arrays, and
  species diagnostics to assert the public stage output shape and values.
- `scripts/flat/atmosphere/reference/stages/IntegrateViewOpticalDepthStage.js`
  now computes cumulative optical depth and Beer-Lambert transmittance by
  wavelength, accumulates species optical-depth diagnostics when species are
  supplied, and rejects negative extinction, wavelength-shape mismatches, and
  invalid sample weights. The implementation is intentionally driven by direct
  stage packets; placeholder `evaluateMedium` output still remains placeholder
  in broader pipeline composition until upstream stages are implemented.
- Keep code files generally below 1000 lines, with a little wiggle room for
  specs. Keep only light registry/scaffold assertions in the combined pipeline
  spec. Once a stage gets real fixture-backed behavior, put its public
  `runStage(stageId, packet)` tests in a focused stage spec and put helper
  internals in the matching helper spec when needed.
- The API shell includes `mergeRequest`, `resolveProbeRequest`,
  `createInitialPacket`, `runStage`, `runUntil`, `traceRay`, and `traceProbe`.
- `utils.js` exports generally useful reference helpers. `normalizeVector3`
  implements reusable finite-vector validation and unit-vector
  canonicalization, and `normalizeRayPathSegment` centralizes finite segment
  validation plus endpoint/length reconciliation for sampling stages. Both
  have dedicated tests in `utils.spec.js`; stage expectations should still be
  stated from the physical/API domain first.
- `scripts/flat/atmosphere/reference/stages/ValidateRequestStage.js` owns the
  real `validateRequest` implementation. The completed transport stages now
  run through focused helper classes; downstream scattering, surface, and
  composition stages still need test-first implementation.
- `validateRequest` validates request shape, model-interface requirements,
  finite observer origin, finite nonzero ray direction, positive strictly
  increasing wavelength grids, nonnegative finite numerical controls, positive
  integer sample-count controls, and tolerates unrelated extra request fields.
  Request-level physical coefficient fields remain outside the canonical
  output so constants stay model-owned.
- `validateRequest` canonicalizes the ray direction to a unit vector for
  downstream kilometer-distance math and preserves the supplied model bundle.
- Physics-backed code and tests now need an explicit reference plus a short
  description of what the source supports. The ray-origin/ray-direction
  validation cites PBRT v4 Rays for ray semantics, while local API choices such
  as near-zero rejection thresholds and model-owned coefficient placement are
  described as project policies rather than external physics.
- Every test expectation and code validation check should carry a nearby
  reason comment. When the reason is physical it should name the external
  reference; when it is local API/schema policy it should cite the reference
  code/test design instead of presenting the rule as physics.
- The shared integration fixture now uses the valid test model bundle, so
  pipeline composition tests exercise the same model-interface contract as
  direct `validateRequest` tests.
- A validation-test review found five grounding issues before moving to the
  next physical stage. Addressed: near-zero ray rejection is covered in the
  `validateRequest` stage tests; flat-model coverage proves interface
  compatibility without relying on `geometryKind` by using a model fixture
  created without that property; request-level physical coefficient extras are
  covered as accepted inputs that do not change contracted output fields; and
  placeholder scaffold assertions are documented as scaffold/API coverage, not
  physical validation coverage. The
  same review also identified useful additional hardening coverage. Addressed:
  fuller observer/ray vector shape cases, a valid single-wavelength grid case,
  missing model owner object cases, positive integer sample-count controls,
  display/report consumer extra-field tolerance, and integrator-default model,
  numerical-control, and wavelength-grid non-mutation coverage.
  Display/reporting consumer controls are tolerated as unrelated input extras
  because color conversion and report shaping consume pipeline results after
  transport. Generic allowed-property validation is deferred to a future
  standard JSON schema layer. Addressed: zero distance controls are valid,
  negative distance controls reject, and `minStepKm > maxStepKm` rejects.
  `integrationMethod` accepted names belong to the future integration-method
  registry/implementation, not to a duplicated hardcoded `validateRequest`
  allow-list. If the registry is the single source of truth, `validateRequest`
  may use it to validate input. Unknown numerical keys are not rejected, but
  are dropped from `validatedRequest.numerical` so later stages only see owned
  controls.

Latest verification:

- `scripts/flat/atmosphere/reference/stages/_tests/fixtures/analytic-invariants.json`
  parsed as valid JSON, and all 16 expectation rows include the canonical
  `reference` fields: `id`, `kind`, `title`, `locator`, `derivationSummary`,
  plus either `url` or `path`. Numeric rows carry expected data and tolerance;
  rejection rows carry structured expected-error data.
- Direct helper import check loaded all 16 analytic/error-contract expectations
  and retrieved `view-transmittance.homogeneous.beer-lambert-0p6`.
- `npm run test:scripts:flat` passed with 86 specs and 0 failures after making
  the stage request transport-focused, deferring generic allowed-property
  validation, verifying integrator default model non-mutation, accepting zero
  distance step controls while rejecting negative ones and inverted min/max
  ranges, dropping unknown numerical keys from validated controls, and keeping
  display/report consumers out of canonical stage output.
- `git diff --check` passed after the transport-only request and
  post-pipeline consumer-boundary updates.
- `npm run test:scripts:flat` passed with 120 specs, 0 failures, and
  13 pending resolve-ray-path shells after moving canonical stages behind
  helper classes and moving stage-specific specs under
  `scripts/flat/atmosphere/reference/stages/_tests`.
- Class files in `scripts/flat/atmosphere/reference` now default-export their
  class and export nothing else. A scan found no lingering named class exports
  or stage-class named imports, and `git diff --check` passed.
- The first `resolveRayPath` fixture-backed tests were wired and observed
  failing against placeholder behavior, then
  `scripts/flat/atmosphere/reference/stages/ResolveRayPathStage.js` was
  implemented to consume model-returned atmosphere intervals and surface hits.
  `npm run test:scripts:flat` then passed with 120 specs, 0 failures, and no
  pending specs.
- `ResolveRayPathStage` now narrows `packet.validatedRequest` to the concrete
  validated-request type before calling model interfaces, and implemented
  algorithm branches include source comments for PBRT ray-domain reasoning,
  PBRT transmittance segment reasoning, and the local model-interface contract.
  `IntegrateViewOpticalDepthStage` now also cites the positive Beer-Lambert
  accumulation and species-summation algorithms near the code.
- The `resolveRayPath` hardening batch is implemented through fixture-backed
  tests. Added rows cover surface hits after exit, exact entry, exact exit,
  non-finite and negative surface distances, malformed finite atmosphere
  interval returns, and the model-call transport ray shape. `npm run
  test:scripts:flat` now passes with 127 specs, 0 failures, and no pending
  specs.
- The `sampleViewPath` fixture-backed test batch is implemented. Direct stage
  tests load `view-samples-contracts.json`, compare midpoint sample arrays,
  metadata, weight sums, ordered distances, and ray-path diagnostic
  preservation, and batch invalid non-finite segment and invalid `viewSteps`
  cases through fixture-owned inputs. `SampleViewPathStage` now emits fixed
  midpoint samples, no samples for empty or zero-length paths, run metadata,
  segment validation errors through `normalizeRayPathSegment`, and
  positive-integer `viewSteps` errors. `npm run test:scripts:flat` passes with
  147 specs and 0 failures.
- The initial `evaluateMedium` skeleton inventory is added to
  `scripts/flat/atmosphere/reference/stages/_tests/EvaluateMediumStage.spec.js`.
  It includes 20 controlled-model pending rows for empty samples, sample
  positions, model-call shape, coefficient arrays, species diagnostics,
  world-derived altitude diagnostics, atmosphere/profile density diagnostics,
  outside-atmosphere vacuum behavior, and invalid coefficient/density data,
  plus 6 deferred sourced Earth-atmosphere fixture rows. The full row inventory is now preserved in both
  [Test Design](test_design.md) and [Test Plan](test_plan.md), including each
  row's intent, input shape, expected result, and source/readiness class.
  `npm run test:scripts:flat` passes with 173 specs, 0 failures, and 26 pending
  specs.
- The `evaluateMedium` sourcing pass is documented. [Fixture Sources](fixture_sources.md),
  [Reference Decision Log](references.md), [Test Design](test_design.md), and
  [Test Plan](test_plan.md) now state the data-first rule: real Earth
  atmosphere/profile and standard-grid fixture expectations should use pinned
  table or dataset rows before locally generated algorithms. Ready candidate
  data includes PDAS/NASA-backed U.S. Standard Atmosphere rows at `0 km`,
  `80 km`, and `85 km`, and the official CIE `360-830 nm` 1 nm grid metadata. Real
  coefficient fixtures remain blocked on the Rayleigh/aerosol/absorber source
  decision; controlled coefficient rows remain fixture-owned toy model data.
- The `evaluateMedium` expected-range inventory has been tightened to test only
  what this stage outputs for expected inputs. Sourced profile, composition,
  and visible-grid rows are representative input fixtures, not proof that this
  stage implements the U.S. Standard Atmosphere, CIE, or a coefficient model.
  Pending shells now include dense near-surface, low-density high-altitude,
  near-boundary, dry-air composition, repeated-composition, and visible-grid
  shape rows. The oracle is stage behavior: preserve diagnostics, align arrays,
  derive/sum coefficients, emit vacuum, or reject invalid model data.
- [Code Design](code_design.md) now pins the guiding rule for
  `mediumSamples`: output fields are chosen by downstream usefulness and
  unambiguous derivability. `evaluateMedium` should emit downstream-ready
  coefficient totals, preserve species/component data used to derive those
  totals, and record derivation metadata. Species sums, direct model totals,
  and `absorption + scattering` are valid sources of totals, but duplicate
  sources must agree within the fixture tolerance or reject loudly. Geometric
  altitude is owned by `world.altitudeAt` and carried as `mediumSample.altitudeKm`;
  it is not accepted from `atmosphere.mediumAt`.
- The `evaluateMedium` source pass now has exact U.S. Standard Atmosphere 1976
  Table 3 dry-air fractional-volume rows: `N2 0.78084`, `O2 0.209476`,
  `Ar 0.00934`, `CO2 0.000314`, `Ne 0.00001818`, `He 0.00000524`,
  `Kr 0.00000114`, `Xe 0.000000087`, `CH4 0.000002`, and `H2 0.00000005`.
  These listed fractions sum to `0.999996697`, leaving residual
  `0.000003303`, so tests should assert the listed source rows and residual
  rather than forcing an exact sum-to-one.
- The first `evaluateMedium` fixture-backed test batch is now encoded in
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/medium-contracts.json`
  and wired into
  `scripts/flat/atmosphere/reference/stages/_tests/EvaluateMediumStage.spec.js`.
  The batch covers empty samples, sample position/call arguments, sample-field
  preservation, vacuum/outside-volume zeros, direct coefficients,
  multi-wavelength alignment, species preservation and summation,
  absorption-plus-scattering derivation, altitude/profile/composition
  preservation, representative profile/composition/grid input ranges, and
  invalid coefficient/density rejection. `EvaluateMediumStage` now implements
  this batch by deriving sample positions from the validated ray, deriving
  finite `altitudeKm` from `world.altitudeAt(positionKm)`, calling
  `atmosphere.mediumAt(positionKm, { wavelengthsNm, sample })`, preserving
  model-owned medium/profile diagnostics, emitting explicit vacuum
  coefficients, summing or deriving coefficient totals, and rejecting invalid
  medium data. Direct stage coverage now rejects non-finite world altitude
  returns at the `evaluateMedium` boundary.
- [Code Design](code_design.md) and `types.d.ts` now document
  `atmosphere.mediumAt(positionKm, { wavelengthsNm, sample })` as the preferred
  high-level medium-state lookup for `evaluateMedium`; granular density and
  coefficient methods remain adapter-building-blocks. Geometric altitude stays
  world-owned through `world.altitudeAt`.
- `integrateViewOpticalDepth` now consumes the nested
  `mediumSample.coefficients.extinctionByWavelength` shape emitted by
  `evaluateMedium`. It consumes `mediumSample.species` as a named array, uses
  the final `intervalEndKm` as the path-end distance when available, validates
  the canonical species array at the stage boundary, and no longer falls back
  to placeholder optical-depth output. It now reads the spectral grid only from
  `validatedRequest.wavelengthsNm`; a stale top-level `packet.wavelengthsNm`
  is not a valid alternate source of truth. Direct optical-depth tests now
  build the same nested coefficient packet shape. The shared scaffold model now
  supplies a zero-coefficient `mediumAt` response, and `validateRequest`
  requires `atmosphere.mediumAt` as part of the model interface.
- Pipeline integration coverage now includes a real
  `sampleViewPath -> evaluateMedium -> integrateViewOpticalDepth` handoff
  regression. It checks that midpoint sample output, interval endpoint
  semantics, named species arrays, per-species optical depth, total optical
  depth, and transmittance all survive across adjacent stage boundaries.
- Stage-owned expectation fixtures now live under
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures`. The previous
  package-level expectation fixture folder was removed so there is one fixture
  location for stage tests.
- Stage helper JSDoc now uses concrete ambient packet/model types through the
  implemented transport stages instead of passing internal helper values as
  `unknown`. `types.d.ts` now includes medium-sample, resolved-coefficient,
  composition, species optical-depth, and view optical-depth output contracts.
  Runtime checks in those helpers now concentrate more on finite/nonnegative
  values and spectral-array alignment; broad `unknown` validation remains at
  true input boundaries such as `validateRequest` and placeholder scaffolds.
- The planned `evaluateMedium` follow-up extremes are now represented as eleven
  active direct stage specs in
  `scripts/flat/atmosphere/reference/stages/_tests/EvaluateMediumStage.spec.js`.
  They cover dense near-surface profile input, low-density upper-supported
  profile input, invalid density diagnostics, vacuum/zero coefficients,
  contradictory vacuum/nonzero coefficients, full selected visible-grid shape,
  full-grid shape mismatch, standard-composition residual, invalid composition
  diagnostics, zero/small positive finite coefficients, and invalid coefficient
  boundaries. Fixture rows with references and derivation notes are present.
  The first wired run failed on contradictory vacuum coefficients and invalid
  composition diagnostics, then passed after adding validation for those model
  returns.
- The first `integrateSolarTransmittance` fixture-backed and contract-alignment
  batches now live in
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/solar-transmittance-contracts.json`
  and are wired into
  `scripts/flat/atmosphere/reference/stages/_tests/IntegrateSolarTransmittanceStage.spec.js`.
  The batch covers empty medium samples, vacuum/unit source transmittance,
  homogeneous Beer-Lambert source-path integration, multi-wavelength
  independence, source-sample metadata preservation, occluded source samples,
  negative extinction rejection, wavelength-array shape rejection, non-finite
  source-path weight rejection, CIE visible-grid alignment, source spectrum
  handoff, source direction handoff, metadata counts, and surface-point source
  transmittance for a visible selected surface hit.
  `IntegrateSolarTransmittanceStage` now consumes `validatedRequest`,
  `mediumSamples`, and `rayPath`; asks `solarSource.samplesAt` for model-owned
  source samples; asks `solarSource.transmittanceSegment` for model-owned
  source-path segments from medium samples and surface points; integrates
  segment optical depth by wavelength; emits source-sample transmittance
  diagnostics; carries model-owned `sourceSpectrum`; and keeps source geometry
  decisions out of the stage. `pipeline-stages.js` now mirrors the canonical
  top-level prerequisites/provided fields through downstream placeholders, and
  implemented stages no longer fall back to duplicate top-level request facts
  where [Stage Contracts](stage_contracts.md) says to use `validatedRequest`.

Next documentation step:

- Fold any new stage input/output decisions into
  [Stage Contracts](stage_contracts.md) first. Update
  [Code Design](code_design.md) when the rationale, model interface, or
  algorithm decision changes, then update [Test Design](test_design.md) if the
  stage contract changes.
- Add each new decision-shaping external reference to
  [Reference Decision Log](references.md), including the assumptions needed
  before its values can become tests.
- Mark secondary references as secondary in [Reference Decision Log](references.md).
  Before any secondary-source-backed value or claim becomes package-facing,
  audit whether it should be replaced or reinforced by a primary source, or
  explicitly retain it with a stated limitation.
- Keep package-readiness decisions in sync between [Code Design](code_design.md),
  [Plan](plan.md), and [Reference Decision Log](references.md).
- When researching a dependency candidate, add its validation basis, license,
  wrapper boundary, and replacement-test evidence to
  [Reference Decision Log](references.md).

Latest verification:

- `npm run test:scripts:flat` passes with 216 specs, 0 failures after the first
  source-breadcrumb remediation row. `EvaluateMediumStage.js` now has branch
  and algorithm source breadcrumbs tied to the new
  [Reference Decision Log](references.md#evaluatemedium-implementation-branch-source-map)
  entry.
- `git diff --check` passed after that remediation row.
- `npm run test:scripts:flat` passes with 216 specs, 0 failures after the
  second remediation row. The `EvaluateMediumStage.js` duplicate-sum tolerance
  and significant-digit rounding policy is now named in production/test code
  and documented in
  [Reference Decision Log](references.md#evaluatemedium-numerical-policy-source-map).
- `git diff --check` passed after the numerical-policy remediation row.
- `npm run test:scripts:flat` passes with 216 specs, 0 failures after the
  third remediation row. `IntegrateSolarTransmittanceStage.js` now has
  branch-local source breadcrumbs tied to
  [Reference Decision Log](references.md#integratesolartransmittance-implementation-branch-source-map).
- `git diff --check` passed after the solar-transmittance branch remediation
  row.
- `npm run test:scripts:flat` passes with 216 specs, 0 failures after the
  `ValidateRequestStage.js` remediation row. Request-envelope validation,
  model-interface checks, wavelength and numerical-control validation, and
  tolerated-extra ownership now have branch-local source breadcrumbs tied to
  [Reference Decision Log](references.md#validaterequest-implementation-branch-source-map).
- `git diff --check` passed after the validate-request branch remediation row.
- `npm run test:scripts:flat` passes with 216 specs, 0 failures after the
  `ResolveRayPathStage.js` remediation row. Ray-domain ordering, surface
  precedence, empty-path output, unbounded flat-path rejection, and metadata
  preservation now have branch-local source breadcrumbs tied to
  [Reference Decision Log](references.md#resolveraypath-implementation-branch-source-map).
- `git diff --check` passed after the resolve-ray-path branch remediation row.
- `npm run test:scripts:flat` passes with 216 specs, 0 failures after the
  `SampleViewPathStage.js` remediation row. Empty/zero-length path handling,
  segment validation, fixed midpoint placement, view-step validation,
  metadata, and packet preservation now have branch-local source breadcrumbs
  tied to
  [Reference Decision Log](references.md#sampleviewpath-implementation-branch-source-map).
- `git diff --check` passed after the sample-view-path branch remediation row.
- `npm run test:scripts:flat` passes with 216 specs, 0 failures after the
  `IntegrateViewOpticalDepthStage.js` remediation row. Empty transport,
  wavelength ownership, sample weights, species accumulation, path-end
  semantics, transmittance conversion, and packet output now have branch-local
  source breadcrumbs tied to
  [Reference Decision Log](references.md#integrateviewopticaldepth-implementation-branch-source-map).
- `git diff --check` passed after the view-optical-depth branch remediation
  row.
- `npm run test:scripts:flat` passes with 217 specs, 0 failures after the
  single-file spec and fixture remediation batch. Direct assertions in the
  named stage specs now cite fixture rows, stage contracts, or the spec
  assertion source map. Fixture validation now checks expected datum units,
  derivation, numeric tolerance, and nonnumeric comparison policy across all
  expectation fixture files.
- `git diff --check` passed after the single-file spec and fixture remediation
  batch.
- `npm run test:scripts:flat` passes with 216 specs, 0 failures after the
  contract-alignment pass through stage descriptors, ambient types, implemented
  stage code, solar fixtures, and direct tests, plus the input-shape policy
  update that tolerates unrelated extra fields while asserting contracted
  output fields and values.
- `git diff --check` passed after the contract-alignment implementation and
  documentation update.

Completed implementation checkpoint:

- The implemented-stage source-breadcrumb audit has completed before
  `evaluateScatteringPhase`. The verified deficiency list is recorded in
  [Plan](plan.md#immediate-remediation-implemented-stage-source-breadcrumb-audit).
  The `integrateSolarTransmittance` implementation and contract-alignment
  batches remain complete and green.
- Proceed to the next canonical stage after `evaluateMedium` unless more
  hardening is requested for this stage. The current `evaluateMedium` batch has
  active positive and negative extreme coverage backed by sourced boundaries,
  hard invariants, or explicitly labeled controlled sentinels.
- The starting `sampleViewPath` skeleton specs have been replaced with real
  fixture-backed tests in
  `scripts/flat/atmosphere/reference/stages/_tests/SampleViewPathStage.spec.js`.
  [Test Plan](test_plan.md) now lists the planned fixture rows for empty paths,
  zero-length paths, midpoint samples, weight summation, monotonic order,
  ray-path diagnostic preservation, invalid segment distances, invalid
  view-step counts, and midpoint integration metadata. Those rows are now
  encoded in
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/view-samples-contracts.json`.
  The tests were observed failing against placeholder behavior, then the stage
  was implemented and verified green.
- [Test Plan](test_plan.md) and [Reference Decision Log](references.md) now
  include row-level reference maps for every planned `sampleViewPath` fixture
  row. Midpoint sample placement and weights cite numerical
  integration/quadrature sources; finite/zero-distance and ordered-ray
  constraints cite PBRT Rays/Transmittance where relevant; packet shape,
  diagnostics, metadata, and exact error labels remain local design contracts.
- The starting `resolveRayPath` test inventory has been added to
  [Test Design](test_design.md). It covers descriptor/prerequisite behavior,
  controlled atmosphere segment selection, surface clipping, empty paths,
  outside-observer entry, inside-volume clipping, behind-observer empty
  intervals, zero-length boundary paths, surface-before-entry occlusion,
  invalid intersection rejection, flat lateral-boundary recording, unbounded
  horizontal rejection, and boundary metadata preservation. The expected cases
  should be encoded as JSON expectation rows,
  following the same data/provenance pattern as
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/analytic-invariants.json`;
  JS test helpers should only adapt those rows into controlled model interfaces.
  [Fixture Sources](fixture_sources.md) now records controlled ray-path segment
  data as ready for stage-selection tests, but not as a source of arbitrary
  large-distance extremes. `resolveRayPath` extremes must be stage-contract
  boundaries or source-backed/model-hypothesis boundaries with provenance.
  Earth-radius-dependent ray geometry remains deferred.
  These fixture-backed behavior targets are now represented as pending Jasmine
  shells in
  `scripts/flat/atmosphere/reference/stages/_tests/ResolveRayPathStage.spec.js`;
  the next pass should wire the JSON expectation rows into real failing tests
  before implementation.
- Coverage recheck on the `resolveRayPath` inventory corrected an over-broad
  negative-distance expectation: `tMinKm < 0 < tMaxKm` is an inside-volume
  interval and should clip to the observer, while intervals entirely behind the
  observer become empty forward paths and inverted/non-finite intervals reject
  as invalid model returns.
- The `resolveRayPath` fixture rows have been created in
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/ray-path-contracts.json`.
  They encode controlled model-returned inputs, expected `rayPath` outputs or
  expected errors, canonical `reference` objects, supporting references, and
  derivation notes. The Jasmine shells have been wired to these rows as real
  tests and now pass against `ResolveRayPathStage`.
- [Plan](plan.md) now records the completed `resolveRayPath` hardening batch:
  surface hits after atmosphere exit, exact entry/exit surface-boundary
  precedence, invalid surface-hit distances, malformed atmosphere returns, and
  the model-call contract for passing validated observer/ray data to model
  interfaces.
- [Test Plan](test_plan.md) now owns the actionable test sequence: the current
  `resolveRayPath` fixture-backed batch, its completed hardening batch, next
  stage seeds for `sampleViewPath` and `evaluateMedium`, fixture intake rules,
  and the verification command.
- Fixture validation now loads every JSON fixture under
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures` and enforces that
  every row has a canonical `reference` object. Local design-contract rows may
  reference design docs, but those design docs then own the deeper rationale for
  the constraint.
- [Reference Decision Log](references.md) now includes a row-level source map
  for the planned `resolveRayPath` fixture rows. It distinguishes PBRT ray
  semantics, PBRT finite transmittance-segment reasoning, Bruneton reference
  testing discipline, and local packet/model-interface policy. Geometry-derived
  atmosphere-top conventions such as FAI `100 km` are explicitly outside this
  stage batch.
- The same source map now explicitly identifies the tested extremes:
  forward-ray lower bound, empty forward segment, zero-length segment, ordered
  finite interval requirement, surface-before-entry ordering, finite flat
  lateral path, and unbounded flat horizontal path.
- [Plan](plan.md) now tracks the next fixture rows to add for those optical
  depth shells: empty explicit output, two-sample monotonic accumulation,
  multi-wavelength homogeneous transport, multi-species summation, and
  negative-extinction rejection. It also lists the required references for each
  row, including the relevant PBRT transmittance/process sections and local
  code/test design locators for packet-schema or error-contract policy.
- [Plan](plan.md) now also tracks a flat-large-lateral-boundary fixture row:
  `resolveRayPath` owns the named finite side boundary and path length, while
  `integrateViewOpticalDepth` owns `tau = sigma_t * lateralDistance` and
  `T = exp(-tau)` for a simple homogeneous path.
- The optical-depth fixture plan now also tracks expected-input extremes:
  optically thin/thick transport, long-path low-extinction versus short-path
  high-extinction equivalence, and max supported wavelength/species/sample
  counts. This has been corrected to be data/reference based rather than
  arbitrary: CIE visible grid range, ASTM G-173 solar table range, PDAS/U.S.
  Standard Atmosphere table extents, ASTM AM1.5 reference conditions,
  published air-mass formulas after primary-source audit, selected clear-air
  coefficient models, and convergence studies. Do not create arbitrary
  optically-thin or optically-thick `tau` limits without source-backed data.
- Source-value pass completed for several expected-input extremes:
  NLR `ASTMG173.csv` was inspected and pinned as `2002` data rows from
  `280-4000 nm` with nonuniform spacing; Kasten and Young 1989 was added as
  the primary near-horizon air-mass source with horizon relative optical air
  mass `38.0868`; Bucholtz 1995 was added as the primary Rayleigh numeric
  source, with safe-to-pin `1962 U.S. Standard` rows including
  `tau = 8.645e-3` at `1.00 um` and `tau = 7.788` at `0.20 um`.
  Visible-band Rayleigh red/blue rows are intentionally not pinned yet because
  the source HTML compresses repeated scientific-notation exponents; inspect
  the PDF or another reliable table extraction before turning those into
  fixture literals.
- `npm run test:scripts:flat` passed with 173 specs, 0 failures, and
  26 pending `evaluateMedium` specs after adding the sourced profile-edge and
  composition-coverage skeletons.
- `git diff --check` passed after the sourced-extremes documentation and
  skeleton update.
- The implemented-stage source breadcrumb audit now marks
  `ValidateRequestStage.spec.js`, `ResolveRayPathStage.spec.js`, and
  `SampleViewPathStage.spec.js` verified as separate rows. Remaining direct
  assertions in those specs now have local reason/source comments or rely on
  fixture row provenance, and
  [Reference Decision Log](references.md#implemented-stage-spec-assertion-source-maps)
  now lists all six remediated implemented-stage spec files.
- `npm run test:scripts:flat` passed with 217 specs, 0 failures after the
  three-spec assertion breadcrumb pass.
- `git diff --check` passed after the three-spec assertion breadcrumb pass.
- [Plan](plan.md#immediate-remediation-implemented-stage-source-breadcrumb-audit)
  now splits the former shared implemented-stage test utility row into
  separate pending rows for `_tests/test-pipeline-stages.js`,
  `_tests/test-expectations.js`, `_tests/utils.spec.js`, and
  `_tests/pipeline-stages.spec.js`.
- The four shared utility rows are now verified. `test-pipeline-stages.js`
  has inline breadcrumbs for helper tables, request/model factories, registry
  copies, and packet cloning; `test-expectations.js` has fixture-ledger loader
  breadcrumbs; `utils.spec.js` and `pipeline-stages.spec.js` were confirmed to
  already carry reason/source comments for their direct assertions. The shared
  rationale lives in
  [Reference Decision Log](references.md#shared-test-utility-source-maps).
- `npm run test:scripts:flat` passed with 217 specs, 0 failures after the
  shared utility breadcrumb pass.
- `git diff --check` passed after the shared utility breadcrumb pass.
- [Plan](plan.md#immediate-remediation-implemented-stage-source-breadcrumb-audit)
  now replaces the broad `All implemented-stage fixture files` sweep row with
  per-fixture rows for `analytic-invariants.json`, `medium-contracts.json`,
  `ray-path-contracts.json`, `solar-transmittance-contracts.json`,
  `view-optical-depth-hardening.json`, and `view-samples-contracts.json`.
  The three fixture files already remediated by earlier specific rows are
  marked verified; the remaining fixture-file sweeps stay pending.
- The remaining fixture-file sweep rows are now verified:
  `analytic-invariants.json`, `medium-contracts.json`, and
  `view-samples-contracts.json`. The audit found no fixture data edits needed:
  analytic invariants currently use numeric scalar/array expected data with
  per-datum tolerance rules, while medium and view-samples fixtures already
  carry file-level exact structural comparison policies plus datum units,
  derivations, source references, and independence notes. The sweep rationale
  is recorded in
  [Reference Decision Log](references.md#fixture-file-metadata-sweep-source-map).
- `npm run test:scripts:flat` passed with 217 specs, 0 failures after the
  remaining fixture-file sweep.
- `git diff --check` passed after the remaining fixture-file sweep.
- The final `Source and design documentation` remediation row is now verified.
  `fixture_sources.md` no longer describes active optical-depth hardening specs
  as pending, and this status document now treats the source-breadcrumb audit
  as complete rather than next work. The remediation table has no pending rows.
- `npm run test:scripts:flat` passed with 217 specs, 0 failures after the final
  source/design documentation consistency pass.
- `git diff --check` passed after the final source/design documentation
  consistency pass.
- `evaluateScatteringPhase` is complete for the first explicit isotropic phase
  batch, and now has lightweight direct coverage for Rayleigh and
  Henyey-Greenstein phase behavior used by the sky-patch preview. Updated code,
  direct tests, ambient types, stage contract docs, reference source map, and
  test/status docs.
- `npm run test:scripts:flat` passed with 221 specs, 0 failures after the
  `evaluateScatteringPhase` batch.
- `git diff --check` passed after the `evaluateScatteringPhase` batch.
- Final transport stage batch is complete for `integrateSingleScattering`,
  `resolveSurfaceRadiance`, and `composeSpectralRadiance`. Updated code,
  direct tests, ambient types, reference source map, and test/status docs.
- `npm run test:scripts:flat` passed with 230 specs, 0 failures after the
  final transport stage batch.
- `git diff --check` passed after the final transport stage batch.
- [Test Plan](test_plan.md#test-file-ownership) now documents the intended
  split between `pipeline-stages.spec.js`,
  `CpuSpectralReferenceIntegrator.spec.js`, `pipeline-handoffs.spec.js`, and
  `trace-ray.integration.spec.js`. It also records the identified test domains
  for `CpuSpectralReferenceIntegrator`.
- The integrator facade contract is now explicit in
  [Code Design](code_design.md#integrator-facade-contract): `traceRay` returns
  the full internal packet, `stageHistory` is public diagnostic metadata,
  request/default/probe/packet data is cloned before reuse, constructor defaults
  are validated when supplied, custom constructor stages are internal test
  harness support rather than an official public contract, and `runStage`,
  `runUntil`, and `traceRay` have pinned execution boundaries.
- `_tests/CpuSpectralReferenceIntegrator.spec.js` now contains executable
  facade-domain coverage instead of pending scaffold specs. Facade-owned cases
  were removed from `pipeline-stages.spec.js`, leaving that file focused on
  registry behavior.
- `npm run test:scripts:flat` passed with 257 specs and 0 failures after the
  integrator facade contract implementation and spec extraction.
- `git diff --check` passed after the integrator facade contract implementation
  and spec extraction.
- `run-reference-probe.js --sky-patches` now renders the three requested
  no-celestial sky patches from Earth-like preview parameters, Rayleigh phase,
  Henyey-Greenstein aerosol phase, a denser visible wavelength grid,
  CIE-style display conversion, and approximate Chappuis-band ozone
  absorption. The regenerated artifacts live in `tmp/flat-reference-sky-patches/`.
- Current sky-patch center display swatches: midday zenith `#8a9abb`,
  midnight zenith `#000000`, and sunset horizon `#ef8100`.
- `npm run test:scripts:flat` passed with 264 specs and 0 failures after the
  CIE-style display and ozone sky-patch wiring.
- `git diff --check` passed after the CIE-style display and ozone sky-patch
  wiring.
- Integration coverage split is complete: `pipeline-stages.spec.js` is
  registry-only; `pipeline-handoffs.spec.js` covers view/medium/optical-depth,
  solar/phase, and scattering/surface/composition packet handoffs; and
  `trace-ray.integration.spec.js` covers vacuum, homogeneous isotropic sky
  scattering, and Lambertian surface attenuation full-pipeline fixtures.
- `npm run test:scripts:flat` passed with 269 specs and 0 failures after the
  integration-test split.
- `run-reference-probe.js --light-extent` now classifies flat finite-Sun
  source-path extent with named JSON scenario sets, configurable loss-fraction
  thresholds, calculated effective-irradiance floors, Beer-Lambert source-path
  attenuation, finite solar-disk solid-angle falloff, Markdown/SVG/JSON report
  output, and focused CLI helper specs. Generated artifacts live in
  `tmp/flat-light-extent/`.
- `npm run test:scripts:flat` passed with 274 specs and 0 failures after the
  app-linked and real-Sun light-extent floor-set coverage.
- `npm run test:scripts:flat` passed with 279 specs and 0 failures after the
  reference-integrator-only testing closure. Custom stage descriptors now fail
  loudly when malformed or ambiguous, name-only probes fail until a named
  probe registry exists, and placeholder-stage fallback scaffolding has been
  removed.
