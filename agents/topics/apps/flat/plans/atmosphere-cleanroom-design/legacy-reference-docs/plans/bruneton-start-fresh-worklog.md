# Bruneton Start-Fresh Skydome Work Log

## Restart Instructions

On compression or a fresh agent restart, load only:

1. `agents/topics/active-topic.md`
2. `agents/topics/README.md`
3. `agents/topics/standards/architecture/overview.md`
4. `agents/topics/apps/flat/README.md` only through its
   `Current Active Task` routing note
5. `agents/topics/apps/flat/plans/bruneton-start-fresh-prompt.md`
6. this file

Then inspect:

- `scripts/flat/experimental/bruneton-start-fresh.js`
- the latest numbered folder under
  `tmp/atmosphere/bruneton_start_fresh/`

Do not load `agents/topics/apps/flat/status.md`, `atmosphere-design.md`, older
Flat atmosphere plans, previous skydome logs, local comparison galleries,
archive/migration docs, or `agents/topics.bak` for this task.

Do not reload older local implementation logs, previous skydome rerun
artifacts, older local atmosphere docs, or existing project code. Treat any
required bootstrap docs as routing only. External-source downloads already
present in the workspace may be used directly when they are cited as external
sources. Do not use local summaries of external sources or local generated
images as source material or visual targets.

## Active Goal

Closed. This lane built a self-contained experimental script that renders
Bruneton-like fisheye skydomes with physics-justified equations, constants,
approximations, display choices, and numbered provenance artifacts. Future
work should incorporate the lessons from this lane into the reference
implementation rather than continuing fresh-lane visual iteration.

## Current Status

The start-fresh Bruneton skydome experiment is closed except for explicit
source-audit reruns requested by the user. The latest generated artifact and
best current Figure 1 comparison fit is step 032. Step 029 remains the prior
simplified fitted-k anchor, and step 031 remains the prior fitted-k four-row
orientation artifact. Do not create further numbered fresh-lane steps unless
the user explicitly reopens this experiment.

Step 029,
`tmp/atmosphere/bruneton_start_fresh/029-paper-figure1-derived-k-no-ground-baseline/`,
is the prior simplified fitted-k visual-equivalent anchor. It keeps step 021's
accepted visual setup while using the fitted Figure 1 tone-map value
`k = 0.0002454` and turning off both ground-coupling terms. User subjective
review says there is no clear visual difference between steps 021, 029, and
030. Step 029 remains useful as the cleanest pre-source-k anchor because it
removes the inactive ground/display bookkeeping knobs while preserving the
older closest visual family, but step 032 supersedes it for the Figure 1
comparison fit.

Step 031,
`tmp/atmosphere/bruneton_start_fresh/031-figure1-four-view-derived-k-no-ground-baseline/`,
is a four-view Figure 1 render using the step 029 model, not a new model
baseline. It uses the PDF Figure 1 row labels 06h00 / 87 degrees,
10h15 / 41 degrees, 11h15 / 31 degrees, and 13h15 / 21 degrees; Sun azimuths
are measured from the red-cross centers in the directly extracted external
Bruneton-column tiles Im6, Im15, Im25, and Im35. It produced four generated
skydomes plus a generated-only contact sheet and an external-Bruneton-column
comparison sheet. Step 031 remains the fitted-k four-row orientation artifact,
but step 032 supersedes it as the best fit because the Bruneton comparison
source-derived `k` brightens the result toward the external paper tiles.

Step 032,
`tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/`,
is the current best Figure 1 comparison fit. It keeps the same no-ground,
no-direct-disc, no-ozone, Bruneton 2016 aerosol, 15-sample CIE, full-sphere
Fibonacci second-order path as step 031, but computes the Figure 1 tone-map
scalar from Bruneton's comparison source as `k = 1 / (5 * 683) =
0.00029282576866764275` instead of using the fitted step 021/029 value
`0.0002454`. User review says step 31 was already slightly darker than
Bruneton and this source-backed `k` moves the result closer, so treat step 032
as the best current visual/reference handoff candidate for the comparison
target.

Step 030,
`tmp/atmosphere/bruneton_start_fresh/030-paper-figure1-derived-k-direct-ground-baseline/`,
is accepted as ground-term equivalence evidence, not as the simpler anchor. It
keeps direct-Sun Lambertian ground bounce while omitting the sky-irradiance
ground term, and it remains subjectively tied with steps 021 and 029. Step 028,
`tmp/atmosphere/bruneton_start_fresh/028-paper-figure1-derived-k-no-ground-baseline/`,
used the intended no-ground step id before the id was fully wired into the
physical-render helper gates, so it is an invalid diagnostic rerun kept only
as audit evidence.

Step 027,
`tmp/atmosphere/bruneton_start_fresh/027-second-order-sun-view-angle-cache-baseline/`,
remains accepted as transport-coordinate evidence, not as the visual baseline
and not as a final visual solution. It keeps the step 018 Figure 1
target-contract separation, step 019 full-sphere Fibonacci second-order
quadrature, step 022 Figure 1 row-label Sun zenith angles, step 023
40-wavelength spectral sampling, step 024 refitted paper Figure 1 tone-map
scalar, and step 025 shadowed-ground sky-irradiance correction, then adds both
local solar-zenith (`mu_s`) and local incoming-view zenith (`mu`) bins to the
second-order incident-radiance cache. Treat steps 022-027 as source-backed
evidence about scene angles, spectral sampling, lower-boundary coupling, and
second-order cache coordinates that did not beat the step 021/029 visual
family.

Step 023,
`tmp/atmosphere/bruneton_start_fresh/023-paper-40-wavelength-baseline/`,
is accepted as spectral-sampling evidence, not final. It replaced the prior
15-sample spectral approximation with the Bruneton 2016 paper comparison's 40
wavelengths between 360 nm and 830 nm. The visual change from step 022 was
small, which is useful evidence that wavelength count was not the main
remaining mismatch.

Step 024 modestly improves the global target fit relative to step 023,
especially the high-Sun bright area, but it does not change the mismatch
structure and is not the visual baseline after user review. Step 025 is
byte-identical to step 024 for both rendered PNGs, so the shadowed-ground sky
irradiance correction is real but visually neutral in the current setup. Step
026 changes the output in plausible but mixed ways: the low-Sun center is
darker and the high-Sun dome is slightly stronger/bluer, but the low-Sun
Sun-side band becomes too concentrated and the high-Sun anti-Sun side remains
too dark. Step 027 softens step 026 slightly, but it still leaves the high-Sun
anti-Sun side too dark and the low-Sun rim too warm/ring-like. Reference
incorporation should move to real higher-order scattering/irradiance
computation, not more partial coordinate-cache patches, and should be judged by
whether reference outputs clearly improve on the step 032 comparison fit.

Step 018 remains the target-contract diagnostic. Step 015 remains the cleaner
direct-Sun baseline before the Figure 1 sky-radiance target-contract
separation. Step 016 tests the paper-described Nishita96 plane directions for
second-order scattering and is useful evidence only. Step 017 tried
pixel-footprint filtering of the direct solar disc and was rejected as too
patch-like for this task. The step 009 proxy remains useful only as a
diagnostic artifact and must not be revived as the solution.

Reference incorporation notes:

- Incorporate the step 032 visual family into the reference as the current
  comparison anchor: no direct solar disc in the Figure 1 sky-radiance camera
  pass, Bruneton 2016 paper aerosols, no ozone for the paper comparison,
  15-sample CIE spectral conversion, full-sphere Fibonacci second-order
  quadrature, no ground coupling, and Bruneton comparison-source tone-map value
  `k = 1 / (5 * 683) = 0.00029282576866764275`.
- Preserve the step 015 paper aerosol improvement while developing a better
  sourced higher-order scattering quadrature/precompute than the equal-weight
  step 016 plane sum.
- For the paper Figure 1 target, keep direct solar-disc radiance separate from
  scattered sky radiance unless a later external source proves the target
  includes the direct disc.
- If a later render includes the direct disc, handle its size and brightness
  through a sourced finite-Sun/display model, not the rejected step 017 pixel
  filter.
- Improve the high-Sun dome's anti-Sun side: it is still too dark/directional
  compared with the external high-Sun target.
- Improve the high-Sun white/aureole shape without reviving direct-disc pixel
  artifacts.
- Reduce the low-Sun rim's too-uniform yellow warmth and recover subtler
  variation in the low-Sun interior.
- Broaden and shape the fading horizon band through transport/irradiance
  physics instead of additional global tone-map fitting.
- Use step 032's four generated views, external-Bruneton-column comparison
  sheet, and step31/Bruneton/step32 three-column sheet as the primary
  orientation/scene-position and display-constant check when adding reference
  outputs for Figure 1 rows.
- Keep step 031 only as the previous fitted-k comparison artifact. It is useful
  for showing that the fitted `k = 0.0002454` was close to the source-backed
  value, but it is no longer the recorded best fit.
- Architectural incorporation should treat step 032 as a named
  Figure-1-comparison profile and parity target for the staged reference
  integrator, not as a monolithic script to transplant. The overlapping stage
  sequence is ray/path geometry, view sampling, medium coefficients,
  view/source transmittance, phase evaluation, single-scattering integration,
  spectral radiance composition, then post-pipeline CIE/linear-sRGB/source-`k`
  display. The reference pipeline already owns these boundaries, but it needs a
  step-032 profile for the 15-sample spectral grid, no-ground/no-direct-disc
  target contract, `k = 1 / (5 * 683)` display policy, Figure 1 scene
  orientations, and an explicit higher-order/second-order transport extension
  or sidecar boundary before it can reproduce the cleanroom result exactly.

Do not solve these remaining deltas with hidden RGB grading. Continue to use
direct external Bruneton paper/source images or outputs as visual targets.

## Constraints

- Script path:
  `scripts/flat/experimental/bruneton-start-fresh.js`.
- Do not import, reuse, inspect, cite, or derive equations/constants from
  existing project atmosphere/rendering/color/reference-probe/skydome code,
  older local docs, or older local implementation logs/artifacts.
- Only external sources may justify equations, constants, algorithms, expected
  colors, and display decisions. External papers, standards, datasets, and
  third-party source code already downloaded into the workspace are allowed
  when cited directly as external primary material. Local summaries of those
  sources are not allowed as substitutes.
- Repository architecture/convention docs may guide file placement and avoiding
  unrelated churn only; they must not guide the physics, rendering model,
  constants, color conversion, sampling, or visual interpretation.
- External target images are allowed only when they are direct copies or
  extractions from external Bruneton paper/source materials, not prior local
  renders or local comparison galleries.
- Work one step at a time without user interaction.
- Every step creates a sortable numbered folder under
  `tmp/atmosphere/bruneton_start_fresh/`.
- Every numbered folder includes both rendered skydomes plus enough logs and
  provenance to reconstruct the run.
- Keep rejected and superseded artifacts; record why each step was accepted,
  rejected, or superseded within this fresh lane.
- Do not delete any file that is not tracked by Git. This includes scratch
  files, downloaded external sources, temporary folders, generated images,
  logs, JSON reports, and numbered artifact folders. Verify Git tracking before
  any deletion; if the file is untracked, leave it in place.
- No unit tests are required.

## Step Log

### 2026-06-21

- Created this prompt/worklog pair and switched the active topic continuity to
  the clean-room self-contained Bruneton skydome experiment.
- No script or numbered artifact folder has been created yet. The first
  implementation step should scaffold
  `scripts/flat/experimental/bruneton-start-fresh.js` and produce
  `tmp/atmosphere/bruneton_start_fresh/001-.../` with two diagnostic skydome
  outputs plus reproducibility logs.
- Tightened the rules after user clarification: this is a clean-room lane, not
  merely a new script. Older local implementation code, docs, status entries,
  work logs, rerun logs, and generated artifacts must not be inspected or used
  as technical guidance. Required bootstrap docs are routing only. Only direct
  external sources, including already-downloaded external-source files, may
  justify equations, constants, algorithms, visual targets, and display
  decisions.
- Audited the clean-room wording for remaining ambiguity. Clarified that
  already-downloaded external source files are allowed only as direct external
  primary material, while local summaries and local generated images are not
  allowed as source material or visual targets.
- Clarified the remaining boundary around repo bootstrap material: architecture
  and convention docs may only guide file placement/housekeeping, not the
  atmosphere or display model. Visual targets must be direct external Bruneton
  paper/source images or outputs, not prior local renders or galleries.
- Tightened shared bootstrap routing so a fresh agent can find this task
  without loading unrelated context: the Flat README now has a top-level
  `Current Active Task` gate, active-topic says to read only that gate before
  the prompt/worklog, and shared bootstrap/topic docs now say clean-room or
  focused reload rules override archive/migration mining.
- Added the file-safety rule requested by the user: never delete files that are
  not tracked by Git, including scratch/generated/downloaded files and numbered
  artifact folders.
- Added an explicit `Bootstrap For This Task` checklist to the active topic so
  a freshly bootstrapped agent can find the current task without loading
  unrelated Flat status/design/plans, old logs, local galleries, archives,
  migration docs, or `topics.bak`.
- Added a prompt definition of `skydome` as a 2D fisheye image of the visible
  upper sky hemisphere, with zenith at the center and horizon at the circular
  edge, explicitly not a 3D mesh or reused project rendering artifact.
- Created the first implementation scaffold at
  `scripts/flat/experimental/bruneton-start-fresh.js`. The script
  is self-contained ES module code using only Node built-ins.
- Ran the scaffold and produced
  `tmp/atmosphere/bruneton_start_fresh/001-scaffold-diagnostic/` with
  `sunset-diagnostic.png`, `midday-diagnostic.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, and `run.log`.
- Verified the two diagnostic PNGs visually. They show a circular fisheye
  hemisphere with zenith at center, horizon at the edge, transparent outside
  the disk, grid guides, and different low/high Sun markers. This step is
  accepted only as artifact/projection scaffolding; it makes no atmospheric
  physics, colorimetry, tone mapping, or Bruneton appearance claim.
- The next step should create a new numbered folder by adding externally
  justified spherical atmosphere geometry and Beer-Lambert transmittance
  diagnostics before any sky radiance model.
- Updated the script so the default run is now
  `geometry-transmittance-baseline`, while the original scaffold can still be
  run with `--step=scaffold-diagnostic`.
- Added external-source-cited spherical atmosphere geometry and Beer-Lambert
  transmittance diagnostics using direct Bruneton 2017 implementation links for
  boundary distance, optical-length integration, Beer-Lambert transmittance,
  and atmosphere constants. The fisheye projection mapping cites an external
  fisheye mapping reference.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/002-geometry-transmittance-baseline/`
  with `sunset-transmittance.png`, `midday-transmittance.png`,
  `provenance.json`, `equations-and-constants.json`, `notes.md`, `run.log`,
  and `script-snapshot.js`.
- Verified the step 2 metrics and images. Zenith 550 nm transmittance is about
  `0.892`, horizon transmittance is about `0.0133`, low-Sun direct
  transmittance is about `0.314`, and midday direct Sun transmittance is about
  `0.882`. The images are accepted only as false diagnostic channel maps, not
  as sky color or Bruneton appearance.
- The next step should add externally justified Rayleigh and Mie single
  scattering, phase functions, and radiance integration while keeping
  color/display decisions explicit.
- Updated the script so the default run became
  `single-scattering-baseline`. Added externally cited Rayleigh and Mie
  single-scattering integration from Bruneton's implementation, including
  Beer-Lambert observer-to-sample and sample-to-Sun transmittance, Rayleigh and
  Cornette-Shanks Mie phase functions, RGB radiance wavelengths, solar
  irradiance constants, direct Sun radiance, and the Bruneton demo exposure
  display transform.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/003-single-scattering-baseline/` with
  `sunset-single-scattering.png`, `midday-single-scattering.png`,
  `provenance.json`, `equations-and-constants.json`, `notes.md`, `run.log`,
  and `script-snapshot.js`.
- Visually inspected step 3. The midday result is a plausible first
  single-scattering sky with a blue dome and pale horizon. The sunset result is
  physically coherent but not yet target-like: the dome interior is too
  gray/green and the whole horizon rim is uniformly warm. Accepted as a
  single-scattering baseline only, not as the final Bruneton-like result.
- Updated the script so the default run became
  `luminance-conversion-baseline`. Added Bruneton's approximate
  three-wavelength spectral radiance-to-luminance conversion using the external
  CIE 1931 color matching table, XYZ-to-sRGB matrix, solar spectrum, and
  separate sky/Sun luminance factors.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/004-luminance-conversion-baseline/`
  with `sunset-luminance.png`, `midday-luminance.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`, and
  `script-snapshot.js`.
- Visually inspected step 4. Luminance conversion improves the display contract
  but does not solve the sunset mismatch. The sunset remains too gray in the
  interior and too uniformly gold around the rim. The next step should use
  externally sourced Bruneton 2016 clear-sky evaluation aerosol parameters
  before considering more complex missing transport terms.
- Downloaded the Bruneton 2016 clear-sky evaluation PDF into
  `tmp/atmosphere/bruneton_start_fresh/external_sources/` as direct external
  primary source material. Extracted the page 4 Figure 1 image tiles into
  `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2016-page4-images/`
  and created `contact-sheet.png` plus `contact-sheet-numeric.png`.
- Updated the script so the default run became
  `bruneton-2016-parameters`. Switched aerosols to the rounded Bruneton 2016
  clear-sky evaluation parameters: Angstrom alpha `0.8`, Angstrom beta `0.04`,
  single-scattering albedo `0.8`, and Cornette-Shanks `g = 0.7`.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/005-bruneton-2016-parameters/`.
  This strengthened the Sun-side aureole and made the sunset more directional,
  but the high-Sun result became too gray/hazy. Accepted as a sourced parameter
  experiment, not final.
- Updated the script so the default run became `ozone-absorption-baseline`.
  Added Bruneton's default ozone absorption cross sections, 300 Dobson unit
  ozone amount, and piecewise linear 10 km to 40 km ozone density profile to
  Beer-Lambert transmittance.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/006-ozone-absorption-baseline/`.
  Ozone shifted the sunset toward purple-gray and did not fix the high-Sun
  desaturation. Accepted as a sourced absorption step, not final.
- Updated the script so the default run became `spectral-cie-baseline`.
  Replaced the three-wavelength luminance approximation with 15 centered
  spectral samples from 360 nm to 830 nm, integrated through the CIE 1931 color
  matching functions and XYZ-to-linear-sRGB matrix before Bruneton-style demo
  exposure display. Reduced future render size to 384 px and scattering sample
  counts to keep runtime reasonable.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/007-spectral-cie-baseline/`. The sunset
  became the best match so far, but the high-Sun dome remained too dim and gray
  compared with the extracted external Bruneton target family.
- Updated the script so the default run became
  `spectral-demo-aerosol-baseline`. Kept spectral CIE conversion and ozone but
  switched aerosols back to Bruneton's 2017 demo defaults:
  Angstrom alpha `0`, Angstrom beta `5.328e-3`, single-scattering albedo `0.9`,
  and Cornette-Shanks `g = 0.8`.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/008-spectral-demo-aerosol-baseline/`.
  Created `external-target-comparison.png` comparing the run against extracted
  Bruneton Figure 1 tiles `Im6` and `Im35`. The high-Sun dome became bluer and
  closer, while the sunset remained structurally close.
- Updated the script so the default run became
  `multiple-scattering-proxy-baseline`. Added a documented scalar proxy for
  missing multiple-scattering irradiance: sky-scattered radiance is multiplied
  by `1.5` before display, while direct Sun radiance is not scaled. This proxy
  is sourced to the Bruneton 2016 discussion that ignored multiple scattering
  leaves computed irradiance about one third below measured values.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/009-multiple-scattering-proxy-baseline/`
  with `sunset-multiple-scattering-proxy.png`,
  `midday-multiple-scattering-proxy.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 9 against the extracted external Bruneton Figure 1
  tiles. Step 9 is now retained as a useful hypothesis test, not as the
  satisfactory endpoint. It improved the broad color family but still misses
  important target traits: the scalar multiple-scattering proxy must be
  replaced by real physics, the Sun spots/aureoles are far too small, midday is
  too muted, sunset's darkest region is too bright, and the fading horizon band
  is too narrow for both scenes.
- Updated current status after user feedback. The next implementation should
  create step 010 or later with real physical transport replacing the proxy and
  should explicitly evaluate the five visual deltas above against direct
  external Bruneton targets.
- Updated the script so the default run became
  `second-order-scattering-baseline`. Replaced the scalar proxy in the current
  render path with an explicit directional second-order scattering
  approximation: at each primary ray sample, the script integrates cached
  incident first-scattered sky radiance over eight incoming sky directions and
  scatters that radiance toward the camera. The direct Sun disc also uses
  finite angular visibility based on Bruneton's solar angular radius and the
  fisheye pixel angular footprint.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/010-second-order-scattering-baseline/`
  with `sunset-second-order.png`, `midday-second-order.png`,
  `provenance.json`, `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 010 against the direct external Bruneton Figure 1
  tiles. The scalar proxy is now replaced in the current physics path and the
  Sun disc is larger, but the Sun-side aureole remains too compact, the
  high-Sun dome is still muted, and the horizon fade remains too narrow.
- Downloaded the upstream Bruneton `demo.glsl` into
  `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2017-demo.glsl`
  as direct external source material for the ground reflection shader path.
- Updated the script so the default run became
  `ground-bounce-coupling-baseline`. Added a direct-Sun Lambertian ground
  bounce term using Bruneton's `ground_albedo = 0.1` and shader behavior:
  ground radiance is albedo/pi times incident irradiance, attenuated from the
  ground to the atmospheric sample, then scattered toward the camera. The step
  intentionally records that sky-irradiance ground reflection is still omitted.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/011-ground-bounce-coupling-baseline/`
  with `sunset-ground-bounce.png`, `midday-ground-bounce.png`,
  `provenance.json`, `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 011. It is accepted as a real lower-boundary
  transport step and slightly broadens/brightens the horizon/edge fade,
  especially in the high-Sun dome. It is not a satisfactory endpoint: the
  Sun-side aureole is still too compact, the high-Sun dome remains too muted
  and lacks broad central whitening, the low-Sun darkest region remains too
  bright, and the horizon fade is still too narrow and too uniform.
- Updated the script so the default run became
  `ground-sky-irradiance-coupling-baseline`. Completed the first-order
  Bruneton ground-reflection structure by adding a sky-irradiance estimate at
  the ground: eight upper-hemisphere directions integrate first-scattered sky
  radiance with cosine weighting, and that sky irradiance is added to the
  direct Sun irradiance before Lambertian albedo/pi reflection.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/012-ground-sky-irradiance-coupling-baseline/`
  with `sunset-ground-sky-irradiance.png`,
  `midday-ground-sky-irradiance.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 012. It is accepted as a physical
  ground-reflection-completion step, but it changes the image only subtly
  relative to step 011. The remaining deltas are essentially unchanged: both
  aureoles are too compact, the high-Sun dome is muted and lacks broad central
  whitening, the low-Sun darkest region is too bright, and the horizon fade is
  still too narrow and too uniform. The next step should move toward a true
  Bruneton-style scattering/irradiance precompute or a finite-source/display
  audit rather than further direct ground tweaks.
- Audited the Bruneton 2016 paper text directly from the downloaded PDF. Figure
  1 uses spectral radiance convolved with CIE color matching functions,
  converted from XYZ to linear sRGB, and tone mapped with `1 - exp(-kL)`. The
  paper comparison implementation also states that ozone absorption is
  neglected, unlike the Bruneton 2017 demo atmosphere defaults.
- Fixed the script's ozone switch so ozone absorption is controlled by the
  current step policy instead of only by the global atmosphere constants. This
  makes older step reruns match their recorded ozone/no-ozone intent.
- Updated the script so the default run became
  `paper-comparison-no-ozone-baseline`. It keeps the step 012 transport path
  but disables ozone absorption with an explicit Bruneton 2016
  paper-comparison provenance entry.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/013-paper-comparison-no-ozone-baseline/`
  with `sunset-paper-no-ozone.png`, `midday-paper-no-ozone.png`,
  `provenance.json`, `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 013. It is accepted as a paper-alignment correction,
  but it is not a visual solution. The low-Sun dome shifts slightly
  brighter/greener, the high-Sun dome remains close to step 012, and the main
  deltas remain: compact aureoles, muted high-Sun dome, too-bright low-Sun
  minimum, and a horizon fade that is still too narrow and too uniform.
- Updated the script so the default run became
  `demo-white-balance-display-baseline`. Added Bruneton's optional demo
  white-balance path as an explicit display hypothesis: the extraterrestrial
  solar spectrum is converted through the script's CIE/linear-sRGB path,
  normalized by the average RGB value, and used as the `white_point` divisor in
  the existing demo-style exposure transform.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/014-demo-white-balance-display-baseline/`
  with `sunset-white-balance.png`, `midday-white-balance.png`,
  `provenance.json`, `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 014. It is accepted as a sourced display hypothesis,
  but it is not a visual solution. The high-Sun dome becomes slightly
  cleaner/cooler and marginally closer to the external target's blue family,
  but the broad central whitening and large aureole remain missing; the
  low-Sun dome still has a too-compact aureole, too-bright darkest region, and
  too-narrow horizon fade. Next work should move to a true Bruneton-style
  scattering/irradiance precompute, a deeper `1 - exp(-kL)` exposure audit, or
  a sourced aerosol phase / finite-source treatment.
- Found and fixed an important fresh-lane script issue: the
  `usesBruneton2016Aerosols()` step switch existed, but the Mie coefficient and
  phase calculations still read the demo aerosol constants directly. Added an
  active aerosol policy helper so the Bruneton 2016 fitted parameters drive the
  actual extinction, scattering, and Cornette-Shanks `g` values when selected.
- Updated the script so the default run became
  `paper-aerosol-transport-baseline`. This keeps the current
  second-order/sun-plus-sky-ground/no-ozone/white-balance path and activates the
  Bruneton 2016 fitted aerosol parameters: alpha `0.8`, beta `0.04`,
  single-scattering albedo `0.8`, and `g = 0.7`.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/015-paper-aerosol-transport-baseline/`
  with `sunset-paper-aerosol.png`, `midday-paper-aerosol.png`,
  `provenance.json`, `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 015. This is the first substantial improvement after
  the proxy was replaced: the high-Sun dome gains a broad central whitening,
  and the low-Sun Sun-side band becomes wider and less pinched. It is accepted
  as the new best baseline, but not satisfactory. The low-Sun interior remains
  too flat/bright, the direct Sun/core remains too small, and the horizon fade
  remains too narrow and too uniform.
- Updated the script so the default run became
  `nishita96-plane-second-order-baseline`. Replaced the arbitrary two-ring
  upper-hemisphere second-order directions with the paper-described Nishita96
  plane set: zenith, nadir, Sun, anti-Sun, directions orthogonal to the Sun in
  the vertical-Sun plane, and sunward/anti-sunward horizon directions. Incoming
  sky directions that intersect the ground now return zero sky radiance instead
  of integrating through the planet.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/016-nishita96-plane-second-order-baseline/`
  with `sunset-nishita96-plane-second-order.png`,
  `midday-nishita96-plane-second-order.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 016. It is useful evidence but not a final baseline.
  The high-Sun dome is paler and the low-Sun Sun-side fade is broader, but the
  low-Sun interior and lower rim are over-lifted and too uniformly yellow.
  Step 015 remains the cleaner baseline; step 016 points toward needing a true
  Bruneton-style scattering/irradiance precompute or a better sourced
  higher-order quadrature/normalization.
- Recorded follow-up visual feedback after step 016: the midday Sun spot has a
  couple of overly bright center pixels; in the sunset dome the Sun-location
  bright area is too bright while the center/dark interior is not dark enough;
  and the midday blue remains too muted/gray. Carry these as current deltas in
  the next implementation step.
- Ran step 017,
  `tmp/atmosphere/bruneton_start_fresh/017-pixel-filtered-solar-disc-baseline/`,
  which tried pixel-footprint filtering of the direct solar disc. User review
  rejected it as a patch rather than a physics-based adjustment. Updated its
  artifact notes/provenance to `rejected after review`, changed the script
  metadata accordingly, and kept the folder only as audit evidence.
- Updated the script so the default run became
  `paper-sky-radiance-no-direct-sun-baseline`. Added an explicit
  external-source entry for the Bruneton 2016 Figure 1 target-contract
  observation: the direct paper extraction shows the Sun direction with a red
  cross overlay. The step omits the added direct solar-disc radiance from the
  camera pass while keeping direct sunlight in the atmospheric scattering
  integral.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/018-paper-sky-radiance-no-direct-sun-baseline/`
  with `sunset-paper-sky-no-direct-sun.png`,
  `midday-paper-sky-no-direct-sun.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 018 against the extracted external Figure 1 low-Sun
  and high-Sun tiles. It removes the tiny blown direct-disc pixels without
  using the rejected pixel filter and is accepted as a target-contract
  diagnostic. It is not a final visual match: the high-Sun dome is still too
  muted/gray and its scattered white/aureole area remains too small, the
  low-Sun center remains too lifted, and the horizon/edge fade remains too
  uniform. Next work should improve the sourced scattering/precompute,
  quadrature, or display model.
- Audited the downloaded Bruneton 2016 paper text directly for the relevant
  target/display language. The Figure 1 caption describes fisheye skydome
  rendering of spectral radiance convolved with CIE color matching functions,
  converted from XYZ to linear sRGB, and tone mapped with `1 - exp(-kL)`; the
  red cross indicates the Sun direction. The paper also diagnoses Nishita96's
  double-scattering error as partly due to using only eight directions in a
  single plane instead of many directions over the whole unit sphere.
- Updated the script so the default run became
  `fibonacci-sphere-second-order-baseline`. Added a sourced 17-direction
  full-sphere Fibonacci lattice quadrature for the second-order incoming
  radiance integral, using `4*pi/N` solid-angle weight and retaining the step
  018 sky-radiance/no-direct-disc target contract. Added an external source
  entry for Gonzalez 2009 on Fibonacci sphere lattices.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/019-fibonacci-sphere-second-order-baseline/`
  with `sunset-fibonacci-sphere-second-order.png`,
  `midday-fibonacci-sphere-second-order.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 019 against step 018 and the extracted external
  Figure 1 low-Sun/high-Sun tiles. It is accepted as sourced quadrature
  evidence, not satisfactory. The high-Sun dome is slightly cleaner/bluer and
  the low-Sun center is a little less lifted, but the white/aureole area is
  still too small and subdued, the midday blue remains too gray, and the
  low-Sun horizon/edge fade remains too uniform.
- Updated the script so the default run became
  `paper-figure1-tone-map-baseline`. This keeps the step 019 transport and
  target contract, disables demo white balance, and replaces the demo shader
  display path with the paper Figure 1 tone-map form `1 - exp(-kL)` after
  CIE/XYZ-to-linear-sRGB conversion. Because the paper caption does not specify
  numeric `k`, this step held `k` to the previous externally sourced display
  exposure scalar as a controlled display-form audit.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/020-paper-figure1-tone-map-baseline/`
  with `sunset-paper-figure1-tone-map.png`,
  `midday-paper-figure1-tone-map.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 020. It moved in the right direction: sunset became
  darker and midday became less gray, but the held-over `k` made both scenes
  too dark/saturated, especially high Sun.
- Fit a single global multiplier for the paper tone-map scalar `k` against the
  direct external low-Sun and high-Sun Figure 1 target tiles, excluding
  non-sky pixels and red Sun-direction cross pixels. The fitted multiplier was
  `2.454`; this is recorded as a scalar tone-map fit, not an RGB grade.
- Updated the script so the default run became
  `paper-figure1-fitted-tone-map-baseline`. This keeps step 020's paper display
  form but uses the fitted global `k` multiplier.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/021-paper-figure1-fitted-tone-map-baseline/`
  with `sunset-paper-figure1-fitted-tone-map.png`,
  `midday-paper-figure1-fitted-tone-map.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 021. This is the current best display baseline: it
  keeps the low-Sun interior dark without crushing as badly as step 020, and
  the high-Sun dome returns to the pale blue family with a stronger central
  white area. It is still not final; the high-Sun anti-Sun side is too dark and
  the low-Sun rim remains too uniformly warm.
- Updated the script so the default run became
  `figure1-sun-zenith-baseline`. This keeps step 021's fitted paper tone map,
  step 019's full-sphere Fibonacci second-order quadrature, and step 018's
  no-direct-disc sky-radiance target, then changes the two scenes to the
  Bruneton 2016 Figure 1 row-label Sun zenith angles: 87 degrees and 21
  degrees.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/022-figure1-sun-zenith-baseline/`
  with `sunset-figure1-sun-zenith.png`, `midday-figure1-sun-zenith.png`,
  `provenance.json`, `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 022. The source-aligned sun zeniths help placement a
  little, but the run is still not satisfactory: the high-Sun dome has too much
  directional darkening, the high-Sun white/aureole area is still not
  target-shaped, and the low-Sun rim remains too uniformly yellow. The next
  source-based step should replace the current 15 spectral samples with the
  paper's 40 wavelengths between 360 nm and 830 nm if runtime allows.
- Updated the script so the default run became
  `paper-40-wavelength-baseline`. This keeps the step 022 scene angles, step
  021 fitted paper tone map, step 019 full-sphere Fibonacci second-order
  quadrature, and step 018 no-direct-disc sky-radiance target, then replaces
  the 15-sample spectral approximation with the Bruneton 2016 paper
  comparison's 40 wavelengths between 360 nm and 830 nm.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/023-paper-40-wavelength-baseline/`
  with `sunset-paper-40-wavelength.png`,
  `midday-paper-40-wavelength.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, and `external-target-comparison.png`.
- Visually inspected step 023. It is accepted as spectral-sampling evidence,
  not final. The visual change from step 022 is small, which means wavelength
  count was not the main remaining mismatch. The high-Sun dome remains too
  gray/directional, and the low-Sun rim remains too uniformly warm.
- Refit the single global paper Figure 1 tone-map scalar `k` after the
  40-wavelength change. The fitted multiplier is `2.672406`, recorded as a
  global display scalar against the direct external low-Sun and high-Sun
  Figure 1 target tiles, not as an RGB grade.
- Updated the script so the default run became
  `paper-40-wavelength-refit-tone-map-baseline`.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/024-paper-40-wavelength-refit-tone-map-baseline/`
  with `sunset-paper-40-wavelength-refit-tone-map.png`,
  `midday-paper-40-wavelength-refit-tone-map.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, `make-external-target-comparison.cjs`, and
  `external-target-comparison.png`.
- Visually inspected step 024 against the direct external Figure 1 low-Sun and
  high-Sun tiles. It is accepted as the current 40-wavelength display baseline,
  not final. The refit modestly improves the high-Sun bright area, but the
  mismatch remains structural: high Sun is still too gray and dark on the
  anti-Sun side, and low Sun still has a too-uniform warm rim and flat dark
  interior. Next work should address missing transport/irradiance physics
  rather than more display fitting or image-space filtering.
- Audited the lower-boundary ground reflection code against the downloaded
  external Bruneton shader source. The shader separates direct Sun visibility
  from sky visibility in the reflected ground radiance term. The script's
  earlier `sunCosine <= 0` early return discarded sky irradiance for shadowed
  ground before this correction.
- Updated the script so the default run became
  `shadowed-ground-sky-irradiance-baseline`. This keeps step 024's visual
  setup but allows the sky-irradiance ground term to contribute when direct Sun
  visibility is zero, while leaving the direct Sun term zero.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/025-shadowed-ground-sky-irradiance-baseline/`
  with `sunset-shadowed-ground-sky-irradiance.png`,
  `midday-shadowed-ground-sky-irradiance.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, `make-external-target-comparison.cjs`, and
  `external-target-comparison.png`.
- Visually inspected step 025 and checked SHA-256 hashes against step 024. Both
  scene PNGs are byte-identical to step 024. The step is accepted as a sourced
  physics-correctness audit, not as a visual improvement. The next useful
  source-based correction should move to a larger scattering/irradiance
  transport upgrade.
- Audited the second-order incident-radiance cache against the downloaded
  external Bruneton model source. Bruneton's scattering texture coordinates
  include radius `r`, view zenith cosine `mu`, solar zenith cosine `mu_s`, and
  scattering angle cosine `nu`; the fresh-lane cache had only altitude and
  incoming direction index.
- Updated the script so the default run became
  `second-order-sun-angle-cache-baseline`. This adds five local solar-zenith
  (`mu_s`) bins to the second-order incident-radiance cache while keeping the
  step 025 setup.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/026-second-order-sun-angle-cache-baseline/`
  with `sunset-second-order-sun-angle-cache.png`,
  `midday-second-order-sun-angle-cache.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, `make-external-target-comparison.cjs`, and
  `external-target-comparison.png`.
- Visually inspected step 026 against the direct external Figure 1 low-Sun and
  high-Sun tiles. It is accepted as transport-coordinate evidence, not final.
  The local `mu_s` cache makes the low-Sun center darker and the high-Sun dome
  slightly stronger/bluer, but the low-Sun Sun-side band becomes too
  concentrated and high-Sun anti-Sun darkness remains. The next step should add
  local incoming-view zenith (`mu`) dependence or move to a fuller
  scattering/irradiance precompute.
- Updated the script so the default run became
  `second-order-sun-view-angle-cache-baseline`. This keeps step 026's local
  solar-zenith (`mu_s`) cache bins and adds five local incoming-view zenith
  (`mu`) bins. It reconstructs a representative cached incident direction that
  preserves the scattering-angle cosine `nu` as closely as possible for the
  binned geometry.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/027-second-order-sun-view-angle-cache-baseline/`
  with `sunset-second-order-sun-view-angle-cache.png`,
  `midday-second-order-sun-view-angle-cache.png`, `provenance.json`,
  `equations-and-constants.json`, `notes.md`, `run.log`,
  `script-snapshot.js`, `make-external-target-comparison.cjs`, and
  `external-target-comparison.png`.
- Visually inspected step 027 against step 026 and the direct external Figure
  1 low-Sun/high-Sun tiles. It is accepted as transport-coordinate evidence,
  not final. It softens step 026 slightly, but the high-Sun anti-Sun
  side remains too dark and the low-Sun rim remains too warm/ring-like. The
  next correction should move to real higher-order scattering/irradiance
  computation instead of more partial cache-coordinate patches.
- User review after comparing all versions so far: step 021 appears to be the
  closest match. Updated current status and prompt guidance so step 021 is the
  visual anchor. Steps 022-027 remain useful source-backed evidence but should
  not be treated as visual improvements over step 021 unless a future run
  clearly beats it against the external Figure 1 targets.
- Audited the step 021 generation path for knobs that appeared inactive. The
  useful hypothesis was to keep the step 021 visual setup but replace the
  exposure-times-fit decomposition with the direct derived paper Figure 1
  value `k = 0.0002454`, then test ground-coupling removal.
- Added `paperFigure1ToneMapFittedK` and new derived-k step helpers to
  `scripts/flat/experimental/bruneton-start-fresh.js`.
- First ran step 028,
  `tmp/atmosphere/bruneton_start_fresh/028-paper-figure1-derived-k-no-ground-baseline/`,
  but it produced diagnostic projection PNGs because the new step id was
  missing from the physical-render helper gates. The folder is retained as an
  invalid diagnostic rerun and audit artifact only.
- Fixed the physical-render gates and reran the no-ground derived-k variant as
  step 029,
  `tmp/atmosphere/bruneton_start_fresh/029-paper-figure1-derived-k-no-ground-baseline/`.
  It turns off both ground-coupling terms and uses `k = 0.0002454` directly.
  It produced `external-step21-step29-comparison.png` and
  `step21-step29-diff-metrics.json`; byte RMSE against step 021 is about
  `1.0641` for sunset and `9.9877` for midday.
- Added step 030,
  `tmp/atmosphere/bruneton_start_fresh/030-paper-figure1-derived-k-direct-ground-baseline/`,
  to isolate whether only the sky-irradiance ground term could be removed
  while preserving direct-Sun ground bounce. It produced
  `external-step21-step30-comparison.png` and
  `step21-step30-diff-metrics.json`; byte RMSE against step 021 is about
  `0.9081` for sunset and `1.1375` for midday.
- User subjective review after comparing steps 021, 029, and 030: there is no
  clear visual difference between them. Updated the script default and status
  docs so step 029 is the cleanest simplified visual-equivalent anchor, while
  step 030 is supporting ground-term equivalence evidence. The next meaningful
  phase is reference incorporation with real higher-order
  scattering/irradiance physics, not more display fitting or local ground-term
  patching.
- Added `figure1-four-view-derived-k-no-ground-baseline` as the default step
  to generate the four Bruneton Figure 1 skydome views using the step 029
  model path. The four scenes use the external row labels 06h00 / 87 degrees,
  10h15 / 41 degrees, 11h15 / 31 degrees, and 13h15 / 21 degrees. Sun azimuths
  are measured from red-cross centers in the directly extracted Bruneton-column
  tiles: Im6, Im15, Im25, and Im35.
- Ran the script and produced
  `tmp/atmosphere/bruneton_start_fresh/031-figure1-four-view-derived-k-no-ground-baseline/`
  with `figure1-06h00-z87-figure1-four-view-derived-k-no-ground.png`,
  `figure1-10h15-z41-figure1-four-view-derived-k-no-ground.png`,
  `figure1-11h15-z31-figure1-four-view-derived-k-no-ground.png`, and
  `figure1-13h15-z21-figure1-four-view-derived-k-no-ground.png`.
- Added `make-four-view-contact-sheets.cjs` and generated
  `figure1-four-view-contact-sheet.png` plus
  `external-bruneton-column-step31-comparison.png`. Visual inspection confirms
  the Sun-side aureole positions follow the external Figure 1 orientation:
  lower-right for 06h00, right side for 10h15, upper-right for 11h15, and near
  upper center for 13h15.
- Closed the start-fresh Bruneton skydome experiment. Future work should stop
  creating fresh-lane numbered visual iterations by default and instead
  incorporate the source-backed findings into the reference implementation:
  step 032 as the best current Figure 1 comparison fit, step 029 as the prior
  simplified fitted-k anchor, step 031 as the previous four-row orientation
  artifact, and steps 015/018/019/023/027 as supporting evidence about
  aerosols, target contract, quadrature, spectral sampling, and cache-coordinate
  effects.
- Reopened the lane only for a requested source-k audit after tracing
  Bruneton's 2016 comparison implementation. Added
  `figure1-four-view-source-k-no-ground-baseline`, which uses the same
  four-view no-ground output shape as step 031 but computes the paper Figure 1
  tone-map scalar as `k = 1 / (5 * MAX_LUMINOUS_EFFICACY) = 1 / (5 * 683) =
  0.00029282576866764275` from the comparison source, rather than the fitted
  step 021/029 value `0.0002454`.
- Ran
  `node scripts/flat/experimental/bruneton-start-fresh.js --step=figure1-four-view-source-k-no-ground-baseline`
  and produced
  `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/`
  with `figure1-06h00-z87-figure1-four-view-source-k-no-ground.png`,
  `figure1-10h15-z41-figure1-four-view-source-k-no-ground.png`,
  `figure1-11h15-z31-figure1-four-view-source-k-no-ground.png`, and
  `figure1-13h15-z21-figure1-four-view-source-k-no-ground.png`. Copied and
  retargeted the step 031 contact-sheet helper, then generated
  `figure1-four-view-contact-sheet.png` and
  `external-bruneton-column-step32-comparison.png`. Verified that
  `equations-and-constants.json` records `sourceDerivedK =
  0.00029282576866764275`, `brunetonComparisonToneMapExposureScale = 5`, and
  `maxLuminousEfficacy = 683`.
- Added `step31-step32-source-k-comparison.png` in the step 032 artifact as a
  four-row side-by-side stack comparing step 031's fitted-k output against step
  032's Bruneton-source-k output for the same Figure 1 scenes.
- Added `step31-bruneton-step32-comparison.png` in the step 032 artifact as a
  three-column four-row stack: step 031 fitted-k output, external Bruneton
  Figure 1 tile, and step 032 source-k output.
- User review concluded that step 31 was still a bit darker than the external
  Bruneton tiles and that step 32's comparison-source `k` moves the render
  closer. Record step 032 as the best current fit rather than step 31.
- Compared the cleanroom algorithm against the older reference pipeline
  architecture. The main fit is to introduce a named Figure 1 comparison
  profile in the reference runner and then add parity checks at the staged
  packet boundaries. The main gap is that the cleanroom step 032 includes a
  local full-sphere second-order sky term, while the canonical reference stages
  currently stop at single scattering plus optional surface radiance and keep
  generic multiple scattering as sidecar-only diagnostics.
- Moved the cleanroom experiment script into `scripts/flat/experimental/` so
  the experimental script directory is a direct child of `scripts/flat/`.
  Updated the script's repository-root calculation and refreshed active-topic,
  prompt, worklog, and status path references.
- Renamed the older atmosphere reference/script tree to
  `scripts/flat/atmosphere_rejected/` at user request and refreshed path
  references so remaining links intentionally point at the rejected tree.
- Registered `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/` as
  the documentation home for the new reset that will supersede the rejected
  reference pipeline.
- Confirmed that the original spectral-radiance endpoint goal fits the
  cleanroom design. Recorded the principle that CIE conversion, linear RGB,
  exposure, tone mapping, PNGs, and report swatches are post-pipeline caller
  consumers rather than transport-stage outputs.
- Compared the rejected one-stage-per-calculation pipeline shape against the
  cleanroom evidence. Recorded the new architecture direction: keep explicit
  major contract boundaries, but implement the coupled spectral transport work
  as a solver composed from small source-backed pure kernels rather than public
  packet stages for every formula.
- Added
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/experiment-032-algorithm.md`
  with the step 032 algorithm, equations, active constants, inactive
  script-carried constants, source references, and explicit algorithmic
  decisions.
- Added
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/object-color-transport.md`
  to make environment-object coloration a first-class cleanroom requirement:
  finite object rays must compose caller-owned object radiance with spectral
  view transmittance and atmospheric path radiance.
- Added
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/object-transport-experiment-plan.md`
  as the next experimental effort: fork or factor experiment 032 kernels into
  a finite-segment object-transfer proof before generating the production
  pipeline.
- Added
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-object-color-prompt.md`
  as the active prompt for the next experimental effort. It uses the new script
  folder `scripts/flat/atmosphere-environment/`, writes numbered artifacts
  under `tmp/atmosphere/cleanroom_environment/`, and defines success criteria
  for spectral object transfer, black-object path radiance, linearity,
  distance effects, Sun-position effects, and keeping display conversion as a
  post-transport consumer.
- Added
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/objective-success-criteria.md`
  to make the success definition objective rather than visual-only. It defines
  hard spectral transport identities, finite-segment split/recomposition,
  objective distance and Sun-position checks, a convergence-backed threshold
  policy, and display-only CIE/RGB review checks. It also records the current
  limitation: without a measured object/material/atmosphere benchmark, this
  lane can prove correct transport behavior and usefulness for object
  coloration, but not absolute outdoor color accuracy.
- Added the two additional user-requested considerations to the cleanroom
  environment-object plan as candidate follow-up experiments: a local Sun
  variant with non-parallel source rays and inverse-square receiver irradiance
  falloff, and a flat-Earth long-line-of-sight variant using labeled
  plane-parallel or flat-slab geometry. The baseline remains the Bruneton-style
  distant directional Sun and spherical atmosphere; these source/geometry
  changes must be reported as named follow-up experiments with their own
  objective checks.
- Added
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-experiment-run-shape.md`
  with the proposed execution shape for the cleanroom environment-object
  experiments. The first run is `001-transfer-baseline`, followed by a
  convergence run, optional Lambertian surface lighting, and the local-Sun and
  flat long-sightline follow-ups. The first 3D environment is a deterministic
  local-ENU ray-test scene made of camera point, target cards, object spectra,
  and explicit finite object rays, with display images derived from recorded
  spectral transfer packets.
- Recorded the operating contract for the environment-object lane: once
  implementation starts, it should proceed as self-guided numbered iterations
  that survive context compaction and agent bootstraps. Each artifact should
  state its goal, status, verification, and next step, and work should stop
  only when the stated state goal is reached, a dead end is documented, or the
  user interrupts.
- Added
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-experiment-preflight-spec.md`
  to lock the first-run decisions before implementation. The first run uses all
  active experiment 032 constants and assumptions, includes the Bruneton
  sunrise/sunset and highest-Sun Figure 1 cases, uses algorithmic stress
  defaults for distances, target placement, and synthetic spectra, requires
  audit-trail references in the input/output packets, uses the cleanroom
  script's `--step=<step-id>` CLI shape as the guide for the new experiment
  CLI, and adds a root
  `tmp/atmosphere/cleanroom_environment/running-log.md` updated by every
  numbered iteration with what it is doing and what it learned.
- Updated the active-topic and Flat README bootstrap handoff so fresh or
  compacted agents load the minimal environment-object experiment docs first,
  inspect only `scripts/flat/atmosphere-environment/`, the cleanroom script,
  and any cleanroom-environment artifacts, and avoid the older skydome/rejected
  reference history unless explicitly asked for source-audit or architecture
  comparison work.
