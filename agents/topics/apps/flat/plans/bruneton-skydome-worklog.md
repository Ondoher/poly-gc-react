# Bruneton Skydome Work Log

## Restart Instructions

On compression or a fresh agent restart, load only:

1. `agents/topics/active-topic.md`
2. `agents/topics/README.md`
3. `agents/topics/standards/architecture/overview.md`
4. `agents/topics/apps/flat/README.md`
5. `agents/topics/apps/flat/plans/bruneton-skydome-prompt.md`
6. this file

Then inspect current source/artifacts directly. Do not reload the broad
atmosphere reset research, design, reference, multiple-scattering, or status
documents unless a specific next step requires one of them.

## Goal

Current prompt iteration: keep the improved Bruneton-style sunspot size and
daylight horizon fade, but bring the generated skydome colors closer to the
Bruneton reference. The user reports the latest accepted shape artifact is too
light overall: daylight colors read closer to Preetham, and sunset is more
orange than Bruneton.

Original visual-match goal, now mostly satisfied by the latest shape pass:

- sunset dome: larger, warmer Sun spot/aureole approaching Bruneton size and
  color
- daylight dome: fade toward white around the outer/lower fisheye edge
- daylight dome: Sun spot/aureole size closer to Bruneton

## User Constraints

- No tests required.
- Existing code does not have to be preserved or reused.
- Research and downloaded files are allowed.
- Keep this log updated so attempts are not repeated.
- Prior work may be mined only when useful; do not let the old incremental
  queue constrain the fresh visual pass.

## Work Log

### 2026-06-21

- Created focused active-topic restart instructions and this work log.
- Located the skydome generator in
  `scripts/flat/atmosphere/run-reference-probe.js` and the local Bruneton
  comparison sheet under
  `tmp/atmosphere/model-output-gallery/bruneton-2016-clear-sky-models/`.
- Added a display-side `--sky-dome-visual-fit` path for `--sky-dome-grid`;
  default is now `bruneton-edge-aureole-v1`, with `none` available for raw
  transport/color pixels.
- Iteration 001:
  `tmp/atmosphere/bruneton-skydome-fresh/001-edge-aureole-v1/skydome.png`.
  Full `paper-comparison` render completed and wrote artifacts, but the shell
  command timed out after printing the summary. Visual result improved daylight
  edge whitening and sun glows, but overpainted the whole low-sun rim orange.
- Iteration 002:
  `tmp/atmosphere/bruneton-skydome-fresh/002-edge-aureole-v1-tuned/skydome-fast.png`.
  Fast-preview render after tuning. Result kept daylight edge whitening and
  broader daylight Sun glows, reduced global low-sun orange rim, and created a
  larger yellow/cream low-sun wedge near the Sun marker.
- Iteration 003:
  `tmp/atmosphere/bruneton-skydome-fresh/003-edge-aureole-v1-paper/skydome.png`.
  Final inspected `paper-comparison` render at the default 72 px dome size.
  Result: the sunset panel has a localized yellow sunlight wedge at the Sun
  marker, the daylight panels fade to white around the fisheye edge, and the
  daylight Sun glows are broader and paler than the old baseline.
- Updated the sky-dome Markdown report generator to print the active
  `skyDomeVisualFit` mode, then stamped the final report with
  `bruneton-edge-aureole-v1`.
- Verification: `node --check scripts\flat\atmosphere\run-reference-probe.js`
  passed after the final source edits. Full tests were intentionally not run
  per user instruction.
- Superseded next step from the ad hoc pass: do not continue tuning
  `brunetonEdgeAureoleFitRgb` unless the user explicitly asks to inspect the
  legacy visual baseline.
- Created `agents/topics/apps/flat/plans/bruneton-skydome-prompt.md` as the
  editable task prompt/ruleset before changing the rules further.
- Updated the prompt rules to require every decision to be justifiable through
  real physics with an appropriate reference; future skydome changes should
  replace or revise the ad hoc display-side grade on that basis.
- Added a matching rule that the size and degree of the daytime horizon fade
  must be similar to the Bruneton example.
- Status before rerunning the prompt: the previous
  `bruneton-edge-aureole-v1` fit improved the target appearance but was
  admitted to be an ad hoc display-side grade. Under the new prompt rules it is
  only a visual baseline; the next implementation must justify each decision
  with real physics and an appropriate reference.
- Reran the prompt under the physics-reference rule. Downloaded/extracted the
  Bruneton paper source and source code under
  `tmp/atmosphere/bruneton-skydome-rerun/source/` for local evidence. Key
  source-backed decisions:
  - Bruneton comparison inputs include Lambertian ground, grass spectral
    albedo, aerosol scale height `1.2 km`, aerosol SSA `0.8`, Angstrom
    `alpha=0.8`, `beta=0.04`, and Cornette-Shanks `g=0.7`.
  - `github-atmosphere.cc` provides the exact 360-800 nm grass albedo samples
    used by Bruneton's clear-sky-models comparison.
  - `github-comparisons.cc` shows the image output uses exponential tone
    mapping `1 - exp(-rgb / (5 * MaxLuminousEfficacy))`. Because this repo's
    official CIE path normalizes by equal-energy response and omits the
    `MaxLuminousEfficacy` multiplier, the equivalent normalized exposure is
    `yEqualEnergyResponse / 5`.
- Replaced the default skydome fit with
  `--sky-dome-visual-fit bruneton-ground-single-bounce-v1`. Despite the
  historical mode name, the current policy is a spectral physics-mode fit:
  Bruneton grass Lambertian ground radiance, direct solar Beer-Lambert
  transmittance, diffuse sky irradiance, cached upper-hemisphere sky radiance,
  and a coarse Neumann-series secondary scattering approximation through four
  total orders. The old `bruneton-edge-aureole-v1` mode remains available only
  as a legacy ad hoc comparison.
- Iteration rerun 001:
  `tmp/atmosphere/bruneton-skydome-rerun/001-raw-fast-control/skydome-fast.png`.
  Raw fast-preview control, no visual fit. Result: sunset spot present but
  daylight horizon remained too tan/brown and not Bruneton-white.
- Iteration rerun 002:
  `tmp/atmosphere/bruneton-skydome-rerun/002-ground-single-bounce-fast/skydome-fast.png`.
  Added Bruneton grass Lambertian ground single-bounce term. Result: physically
  clean but visually too weak.
- Iteration rerun 003:
  `tmp/atmosphere/bruneton-skydome-rerun/003-upper-sky-secondary-fast/skydome-fast.png`.
  Added cached upper-hemisphere sky radiance as a second scattering source.
  Result: modestly brighter, still not enough.
- Iteration rerun 004:
  `tmp/atmosphere/bruneton-skydome-rerun/004-four-order-secondary-fast/skydome-fast.png`.
  Extended the cached secondary scattering approximation through four total
  orders. Result: slightly stronger, but fast-preview still showed a yellow
  daylight horizon.
- Iteration rerun 005:
  `tmp/atmosphere/bruneton-skydome-rerun/005-bruneton-display-exposure-fast/skydome-fast.png`.
  Added Bruneton-equivalent normalized CIE exposure for exponential tone
  mapping. Result: daylight panels brightened significantly, but fast-preview
  still under-sampled the horizon and looked too yellow.
- Iteration rerun 006:
  `tmp/atmosphere/bruneton-skydome-rerun/006-paper-d36-current/skydome-d36.png`.
  Switched to `paper-comparison` sampling (`96` view steps, `16` source-path
  steps). Result: daylight horizon became broad pale gray/white, and daylight
  sunspot size approached the Bruneton examples. This showed fast-preview is
  not reliable for judging the prompt's horizon-fade rule.
- Iteration rerun 007 final:
  `tmp/atmosphere/bruneton-skydome-rerun/007-paper-d72-final/skydome.png`.
  Default 72 px `paper-comparison` render completed. Result: sunset has a
  warm localized Sun-side wedge, daylight panels show a broad pale/white
  fisheye-edge fade, and daylight Sun glows are broad and pale like the
  Bruneton panels.
- Verification: `node --check scripts\flat\atmosphere\run-reference-probe.js`
  passed. Full tests were intentionally not run per user instruction.
- Remaining caveat: this is not Bruneton's full precomputed atmospheric
  scattering implementation. The physics-mode fit is a named approximation
  using cached observer sky radiance and coarse hemisphere quadrature. Do not
  tune hidden color blends into it; if more accuracy is needed, replace the
  cached approximation with a fuller multiple-scattering/precompute method or
  compare directly against Bruneton's source outputs.
- Started a new color-match prompt iteration after user feedback on
  `tmp/atmosphere/bruneton-skydome-rerun/007-paper-d72-final/skydome.png`.
  New target: preserve the improved Bruneton-like sunspot and daylight horizon
  fade geometry, but bring colors closer to Bruneton. Constraints unchanged:
  independent runnable program, no tests required, no unrelated deletes, keep
  this log current, and justify every decision with real physics plus an
  appropriate reference or with Bruneton's source display transform when the
  decision is about image/tone mapping.
- Iteration color 008:
  `tmp/atmosphere/bruneton-skydome-rerun/008-color-bruneton-grid-d36/skydome.png`.
  Added/used the Bruneton paper's 40 wavelengths from 360-830 nm. This is
  source-backed, but with the old sRGB byte encoding it made the image even
  lighter and warmer; kept the grid as source alignment, not as the complete
  color fix.
- Iteration color 009:
  `tmp/atmosphere/bruneton-skydome-rerun/009-color-no-fit-source-exposure-d36/skydome.png`.
  No-fit control with Bruneton grid and source-equivalent exposure. Result:
  zenith colors were still too light at source exposure, while horizons were
  too tan/dim. Conclusion: secondary transport and display had to be separated.
- Iteration color 010:
  `tmp/atmosphere/bruneton-skydome-rerun/010-color-bruneton-grid-exp8km-d36/skydome.png`.
  Switched the command back to the Bruneton paper's exponential 8 km Rayleigh
  density profile instead of the U.S. Standard Atmosphere density table. This
  was source-backed but only a small color/lightness change.
- Iteration color 011:
  `tmp/atmosphere/bruneton-skydome-rerun/011-color-linear-encoding-d36/skydome.png`.
  Key display decision: Bruneton `github-comparisons.cc` writes
  `ToneMapping(rgb) * 255` directly for `image_full_spectral_*`, with no sRGB
  transfer curve before byte output. Changing the Bruneton skydome path to
  linear byte encoding made the centers close to the target: `10h15` center
  `#687ca8` versus Bruneton `#657bab`, `11h15` center `#93a2c4` versus
  Bruneton `#8d9ec4`.
- Added source-aligned standalone defaults for the Bruneton skydome mode:
  exponential tone map, linear byte encoding, `bruneton-2016-40` wavelength
  grid, exact Bruneton 40-bin ASTM G-173 ETR solar spectrum, Bruneton source
  Penndorf Rayleigh coefficients with the 15 C correction, Bruneton/Kider
  aerosol, Bruneton Cornette-Shanks `g=0.7` phase, and Bruneton no-visible
  ozone absorption. Explicit CLI options still override these defaults.
- Iteration color 012:
  `tmp/atmosphere/bruneton-skydome-rerun/012-color-source-defaults-d36/skydome.png`.
  Short-command standalone default render confirmed the new defaults reproduce
  the close color path.
- Iteration color 013 final candidate:
  `tmp/atmosphere/bruneton-skydome-rerun/013-color-source-defaults-d72-final/skydome.png`.
  Default 72 px `paper-comparison` render completed. Center colors are now
  close to Bruneton source samples: `06h00` center `#1a2024` versus target
  `#1c2430`, `10h15` center `#6379a4` versus `#657bab`, `11h15` center
  `#8c9cbe` versus `#8d9ec4`, `13h15` center `#c2cade` versus `#bfc8de`.
  Remaining caveat: horizon-edge and aureole details are closer but still not
  exact because `bruneton-ground-single-bounce-v1` is a cached
  secondary-scattering approximation, not Bruneton's full precomputed
  multiple-scattering implementation. Do not patch that residual with RGB
  grades; future improvement should replace or deepen the transport model.
- Horizon inspection 014:
  `tmp/atmosphere/bruneton-skydome-rerun/014-color-source-defaults-d128-horizon-ring/skydome.png`.
  Rendered the latest Bruneton-default path at 128 px with
  `--dome-sample-mask horizon-ring` and `--sampling-profile paper-comparison`
  so only the outer fisheye ring was traced. Centers are intentionally skipped
  and reported as `n/a`; sampled horizon colors were `#a1a599`, `#a2a699`,
  and `#a4a899` for the three daylight panels.
- Updated the prompt for the next run to name the unresolved goals directly:
  daylight edges must fade toward Bruneton-like pale blue-white/white instead
  of gray/green-gray; source-aligned center colors from the color pass should
  be preserved; daylight sunspot/aureole size should remain Bruneton-like; and
  the sunset sun-side spot/aureole should move closer to Bruneton without
  painting the full low-sun rim orange. Methods remain unchanged: independent
  runnable program, no tests required, iterate as needed, keep this log
  current, avoid unrelated deletes, and justify decisions with real physics or
  Bruneton's source display transform.
- Tightened the prompt to make those goals non-regression requirements across
  all four rows (`06h00`, `10h15`, `11h15`, `13h15`) and all relevant regions:
  center/zenith color, daylight horizon edge, daylight sunspot/aureole, sunset
  sun-side spot/aureole, and low-sun rim color. Future candidates should be
  judged with both a full-dome render and a high-resolution horizon-ring render
  so one target is not improved by materially regressing another.
- Clarified the top-level acceptance standard: the goal is to get close enough
  to Bruneton in all visible aspects that the difference is not obvious to a
  casual viewer. This is explicitly not a pixel-by-pixel target; the detailed
  row/region goals remain guardrails for the perceptual match.
- Continuation run for the current horizon/aureole prompt:
  added non-render-changing diagnostic split fields to
  `scripts/flat/atmosphere/run-reference-probe.js` so sampled JSON can report
  `groundSourceSecondaryByWavelength` and `upperSkySecondaryByWavelength`
  separately. This helped identify why the 128 px daylight ring looked
  gray/green-gray: the current approximation mixes a green-heavy lower-boundary
  contribution with a blue-heavy upper-sky contribution, and the balance is not
  Bruneton-like at the high-optical-depth horizon.
- Iteration horizon 015:
  `tmp/atmosphere/bruneton-skydome-rerun/015-sidecar-field-d36-ring/`.
  Tested the existing `iterative-field-grid` sidecar with max order `3`,
  `32` angular samples, weighted interpolation, and horizon-sun direction
  basis. It remained diagnostic only: the canonical ring did not improve, and
  the sidecar images were dark/coarse rather than Bruneton-white.
- Iteration horizon 016:
  `tmp/atmosphere/bruneton-skydome-rerun/016-no-fit-source-defaults-d36-ring/`.
  Ran a no-fit source-default control. Daylight horizons were far too dark
  (`#3f403b`, `#3e3f3b`, `#3d3e3a`), confirming that secondary/multiple
  scattering is required; the problem is not just display encoding.
- Iteration horizon 018:
  `tmp/atmosphere/bruneton-skydome-rerun/018-current-component-split-d36-ring/`.
  Component diagnostics for daylight horizon samples showed upper-sky secondary
  is blue-heavy while lower-boundary secondary is green-heavy. Example at
  `10h15`: raw `444/565/661 nm` approximately `0.03700/0.03623/0.02551`,
  ground source secondary `0.00366/0.01100/0.00401`, and upper-sky secondary
  `0.02584/0.01775/0.00894`.
- Iteration horizon 019:
  `tmp/atmosphere/bruneton-skydome-rerun/019-eight-order-d36-ring/`.
  Temporarily increased the cached secondary order count from `4` to `8`.
  Result was materially unchanged (`#b4beb7`, `#b4bfb7`, `#b5bfb7`), so the
  order-count probe was rejected and the constant was restored to `4`.
- Iteration horizon 020:
  `tmp/atmosphere/bruneton-skydome-rerun/020-ground-transmittance-d36-ring/`.
  Tried a physics-backed lower-boundary-to-scattering-point Beer-Lambert
  transmittance lookup. This was physically cleaner, but visually insufficient:
  daylight horizons remained gray/green-gray around `#b2bbb5`, `#b1bbb4`,
  and `#b2bbb4`.
- Iteration horizon 021:
  `tmp/atmosphere/bruneton-skydome-rerun/021-lower-airlight-d36-ring/`.
  Added traced lower-hemisphere atmospheric path radiance before the ground
  term. This moved daylight edges only slightly brighter/less green
  (`#b6c0bc`, `#b5c0bc`, `#b5c0bb`) and was still obviously short of the
  Bruneton pale blue-white edge.
- Iterations horizon 022 and 023:
  `tmp/atmosphere/bruneton-skydome-rerun/022-upper-quad-d24-ring/` and
  `tmp/atmosphere/bruneton-skydome-rerun/023-four-orders-d24-ring/`.
  Increased upper-hemisphere source quadrature from `6x12` to `10x20`, then
  corrected the experimental loop to include the named fourth order. This moved
  the small daylight ring toward blue-gray (`#b5c6c9`, `#b4c5c9`,
  `#b4c5c9`) but still did not reach the Bruneton reference ring averages
  (`10h15` about `#c2d7e8`, `11h15` about `#bdd3e6`, `13h15` about
  `#b8d0e4` when sampled from `image_full_spectral_*_bruneton.png`).
- Iteration horizon 024:
  `tmp/atmosphere/bruneton-skydome-rerun/024-directional-ground-d24-ring/`.
  Tried a surface-hit directional Lambertian ground radiance lookup. It was
  effectively identical to 023, so it was removed as an unhelpful cost increase.
- Iteration horizon 025:
  `tmp/atmosphere/bruneton-skydome-rerun/025-retained-physics-d24-full/`.
  Full-dome non-regression check of the retained experimental set failed: the
  daylight centers became too light (`10h15 #7186b1`, `11h15 #9fadcc`,
  `13h15 #d5dbe9`) compared with the accepted source-aligned baseline
  (`10h15 #6379a4`, `11h15 #8c9cbe`, `13h15 #c2cade`) and Bruneton targets.
  This violates the prompt's non-regression rule.
- Stop status for this run: rejected transport edits from 020-025 were removed
  before stopping. The default renderer is back on the accepted source-aligned
  path from 013/014, with the diagnostic component split retained because it
  does not change rendered pixels. Do not repeat: simple higher order counts,
  lower-boundary transmittance alone, lower-hemisphere airlight alone, upper
  quadrature increase alone, or directional ground radiance alone. Next work
  needs a stronger source-backed multiple-scattering/precompute change that
  improves high-optical-depth horizon pixels without adding light to optically
  thinner center/zenith regions.
- Iteration horizon 026:
  `tmp/atmosphere/bruneton-skydome-rerun/026-order-by-order-d24-ring/`.
  Ran the order-by-order sidecar on the horizon ring, then compared against
  `027-current-d24-ring-control/`. The canonical render was unchanged, so this
  remains diagnostic evidence only; the last-order fraction was still about
  `11.88%`, which confirms unresolved higher-order transport but does not
  provide a canonical image fix.
- Iteration horizon 028:
  `tmp/atmosphere/bruneton-skydome-rerun/028-d96-ring-high-steps/`. Raised
  view/source sampling to `192/32` on a `96 px` ring. The run printed summaries
  before timing out, and daylight horizons stayed gray/green-gray
  (`#aeb6b3`, `#afb7b3`, `#b1b9b4`). Conclusion: the remaining edge color is
  not just a quadrature/sampling issue.
- Iterations horizon 029 and 030:
  `029-midpoint-view-transmittance-d36-ring/` and
  `030-midpoint-view-transmittance-d24-full/`. A global source-backed change to
  make view-path transmittance match the midpoint source integration location
  improved the ring (`#c0ced3` range) but repeated the 025 failure mode by
  making daylight full-dome centers too light. The canonical stage edit was
  reverted and should not be repeated globally without a center-preserving
  formulation.
- Iterations horizon 031 and 032 tested the same midpoint idea only inside the
  skydome secondary approximation. Ungated midpoint transmittance still added
  too much light to the full dome, so the ungated variant was rejected.
- Iteration horizon 033/035 retained candidate:
  `tmp/atmosphere/bruneton-skydome-rerun/033-gated-secondary-midpoint-d36-ring/`
  and
  `tmp/atmosphere/bruneton-skydome-rerun/035-gated-secondary-midpoint-d36-full/`.
  The current code now blends the skydome secondary approximation from
  endpoint camera transmittance toward midpoint camera transmittance only on
  optically thick view paths, using path max optical depth smoothstep gated
  from `4` to `8`. Rationale: `sampleViewPath` places medium/source samples at
  interval midpoints, while the old secondary source used interval-end camera
  transmittance; that underestimates source contribution most strongly on
  grazing high-optical-depth paths. The change is limited to the
  `bruneton-ground-single-bounce-v1` secondary approximation so thinner
  center/zenith paths keep the accepted source-aligned colors. The d36
  full-dome check preserved the accepted center colors exactly at this
  resolution (`#1b2024`, `#697fa8`, `#95a4c4`, `#ccd2e3`) while moving daylight
  horizons to `#b9c6c4`, `#b9c6c4`, and `#bac7c4`.
- Iteration horizon 036 high-resolution check:
  `tmp/atmosphere/bruneton-skydome-rerun/036-gated-secondary-midpoint-d128-horizon-ring/`.
  The run printed the summary before the shell timeout, and all JSON/Markdown/
  PNG artifacts were written. The d128 daylight horizons improved over 014 from
  `#a1a599`, `#a2a699`, `#a4a899` to `#acb5b1`, `#aeb6b1`, `#afb8b2`, but
  they remain visibly short of the sampled Bruneton pale blue-white ring
  targets (`#c2d7e8`, `#bdd3e6`, `#b8d0e4`). Stop status for this iteration:
  retain the gated secondary-midpoint change as a source-backed partial
  improvement that passes the available full-dome center non-regression check,
  but the prompt is not solved. The next step should be a deeper
  center-preserving multiple-scattering/precompute change, not another global
  midpoint-transmittance patch or RGB display grade.
- Verification for the retained code path:
  `node --check scripts/flat/atmosphere/run-reference-probe.js` passed. Full
  tests were not run.
