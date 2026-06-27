# Sun Visual Plan

This plan tracks sunlight-specific atmosphere work that cuts across the
reference, composition, color/display, shader parity, and later app-rendering
topics. The atmosphere is already lit by the sun in transport. What is
missing is the visible and near-visible sun behavior that shapes the image
around a low sun: disk, aureole, occlusion, and camera/display response.

## Active Focus

Reset the next implementation focus to **midday horizon first**.

The sunset horizon and midday horizon failures are causally related: both are
low-elevation, high-optical-depth atmosphere views where the current
single-scattering model does not yet produce the pale haze/glow we expect.
Midday horizon is the better first target because it removes sunset-specific
confounders: low solar elevation, visible disk/aureole placement, red/orange
expectation, and stronger display-response ambiguity.

Use this benchmark order:

1. `midday.zenith`
   - Clear-day blue-sky anchor.
   - Shorter path and simpler expectation.
2. `midday.horizon`
   - First active haze/completeness benchmark.
   - Expected visual direction: should trend pale/whitish or hazy rather than
     brown/olive when the missing physical terms are handled well.
   - Current latest-stack artifact:
     `tmp/atmosphere-sun-diagnostic/midday-horizon-latest-stack.png`, center
     swatch `#a4a791`, center tau class `single-scattering warning`.
3. `sunset.horizon`
   - Keep as a downstream stress/visual target after midday horizon is better
     understood.
   - Still important for sun disk, aureole, glare, and display response, but
     no longer the first place to solve haze completeness.

Leave `midnight.zenith` out of routine future experiment sets until celestial
objects, airglow, moonlight, or another nighttime source is intentionally added.
It remains a useful explicit no-celestial control because it should render
black with the current source model, but it no longer earns pixels in the
default visual loop.

First midday-horizon work should stay diagnostic and physical:

- Done: report scattering angle and per-species phase values at center/edge
  samples
- Done: compare Rayleigh, aerosol/Mie, and total single-scattered radiance for
  `midday.zenith` versus `midday.horizon`
- Done: estimate whether the missing multiple-scattering/ambient haze term is
  likely needed without adding a hidden color/display patch
- Done: keep surface/cloud/terrain bounce explicit as disabled terms in the
  reports
- Done: expose reference sampling controls (`--view-steps`,
  `--sun-transmittance-steps`) and report the resolved per-patch counts, so
  convergence can be checked before accepting another physics change
- only return to sunset once midday horizon has a credible pale-haze baseline

## Midday Horizon Roadmap

Address the current `midday.horizon` weaknesses in layers, starting with the
least speculative work and only then changing the physical model.

1. **Lock midday horizon as the haze benchmark**
   - Keep `midday.zenith`, `midday.horizon`, and `sunset.horizon` as a fixed
     comparison trio.
   - Treat `midday.horizon` as the first target.
   - Every change should regenerate the trio and report:
     - center swatches
     - tau class
     - scattering angle
     - Rayleigh/Mie radiance
     - phase values
     - disabled completeness terms

2. **Use model-family comparison before adding another approximation**
   - Keep the current single-scattering output as the baseline.
   - Compare it against the Bruneton-style model gallery, analytic sky models,
     and later libRadtran/DISORT artifacts.
   - Do not add a display-side or packet fallback to force a pale horizon.

3. **Find a stronger reference for the approximation**
   - Use Bruneton 2016 or libRadtran as the external comparison target.
   - Start with one or two anchor scenarios:
     - `midday.zenith`
     - `midday.horizon`
     - later `sunset.horizon`
   - Goal: calibrate whether the approximation moves in the right direction
     and roughly how much horizon lift is plausible.

4. **Improve aerosol phase model**
   - After the multiple-scattering diagnostic is in place, replace or
     supplement the single Henyey-Greenstein `g` assumption with named phase
     policies:
     - current single-HG
     - two-lobe HG
     - tabulated/source-backed phase if available
   - Target near-horizon and near-sun behavior explicitly. The sensitivity
     grid showed `g` is a large visual lever, so this must remain named and
     sourced.

5. **Add surface/cloud bounce as explicit optional terms**
   - Add only after atmosphere-only haze is better understood.
   - Use separately named switches such as:
     - `groundAlbedoContribution: disabled | lambertian-earth`
     - `cloudContribution: disabled | simple-bright-layer`
   - Do not smuggle "white horizon" in as anonymous ambient light.

6. **Promote the best stack only after comparison artifacts**
   - For each improvement, generate a comparison grid:
     - baseline single scattering
     - single plus approximate multiple scattering
     - improved aerosol phase
     - optional surface/cloud context
   - Promote a change into the reference baseline only after the artifacts and
     diagnostics are reviewed.

Recommended first implementation step: keep the backed-out haze-lift proxy out
of the pipeline and use the model-output comparison lane to choose the next
transport reference.

Source-backed rationale:

- The local sensitivity pass found no aerosol-policy-only fix for
  `midday.horizon`. `rayleigh-only` and lower-AOD variants are paler, but
  every useful variant remains in a high-tau warning regime and the reports
  continue to flag `multiple-scattering-likely`.
- Bruneton's clear-sky model evaluation compares graphics sky models with
  measurements and a physics reference model, and its broad conclusion is that
  fewer physical simplifications give more accurate sky results:
  `https://arxiv.org/abs/1612.04336`.
- libRadtran is a maintained atmospheric radiative-transfer package for solar
  and thermal radiation in Earth's atmosphere, with DISORT-style solver paths
  available for multiple-scattering comparison:
  `https://www.libradtran.org/`.
- PBRT's volume transport reference separates phase-function choice from
  recursive volumetric path transport, which matches the diagnostic lesson
  here: changing single-HG `g` is not a substitute for missing higher-order
  scattering:
  `https://pbr-book.org/4ed/Light_Transport_II_Volume_Rendering/Volume_Scattering_Integrators`
  and `https://pbr-book.org/4ed/Volume_Scattering/Phase_Functions`.

### Haze-Lift Experiment Result

Historical result: `scatteringMode: single-plus-haze-lift` was implemented as
a named diagnostic comparison mode in the atmosphere CLI, then backed out. It
brightened high-tau horizons but also reduced daylight contrast and pushed the
output toward gray/beige. It is no longer part of the current CLI or reference
pipeline contract.

Historical formula:

- activation: `smoothstep(1, 8, maxVisibleTau)`
- per-wavelength added radiance:
  `solarSpectrum[w] * (1 - viewTransmittance[w]) * activation * strength`
- default diagnostic strength: `0.015`
- recommended first comparison strength: `0.02`

Experiment artifacts:

- Summary:
  `tmp/atmosphere-haze-lift-diagnostic/README.md`
- Baseline trio:
  `tmp/atmosphere-haze-lift-diagnostic/trio-single-88.png`
- Recommended comparison trio:
  `tmp/atmosphere-haze-lift-diagnostic/trio-haze-maxtau-002.png`
- Midday strength sweep:
  `tmp/atmosphere-haze-lift-diagnostic/midday-haze-maxtau-001.png`
  through
  `tmp/atmosphere-haze-lift-diagnostic/midday-haze-maxtau-003.png`

Findings:

- `midday.zenith` remains unchanged at `#798bad`; its activation is `0`.
- `midday.horizon` moves from `#a4a286` to `#cdcdbb` at strength `0.02`,
  with rendered radiance changing from `440nm:0.0298`, `560nm:0.0443`,
  `660nm:0.0361` to `440nm:0.0641`, `560nm:0.0744`, `660nm:0.0577`.
- `sunset.horizon` moves from `#d87c01` to `#e89a65` at strength `0.02`,
  with rendered radiance changing from `440nm:0.004`, `560nm:0.065`,
  `660nm:0.2009` to `440nm:0.0384`, `560nm:0.095`, `660nm:0.2224`.
- The first tau560-gated attempt required a much larger strength because the
  warning regime was driven by shorter-wavelength max tau. The corrected
  max-tau activation is the better model shape.

Recommendation: keep the model-improvement direction and continue calibration,
not the exact heuristic as final physics. The next real model improvement
should be an explicit higher-order scattering/airlight term, with the current
max-tau/lost-transmittance haze lift as the first diagnostic proxy. Calibrate
or replace that proxy with a Bruneton/libRadtran-style reference before making
it canonical.

## Missing Pieces

1. **Finite solar disk**
   - Current state: sky-patch transport treats the sun mostly as a direction.
   - Missing behavior: the real sun spans about `0.53 deg` of sky from Earth.
     Near the sun, a ray may directly intersect the disk, pass near an edge,
     or sample a different point across the solar disk.
   - Why it matters: the disk supplies the bright core that anchors the
     perceived sunset glow and gives the aureole a spatial center.

2. **Angular resolution near the sun**
   - Current state: each output pixel uses one camera ray.
   - Missing behavior: the aureole changes very quickly near the solar disk,
     so a coarse grid can miss or alias the steep gradient.
   - Why it matters: without supersampling or adaptive angular sampling near
     the sun, the most important warm halo can be under-resolved.

3. **Better aerosol phase model**
   - Current state: aerosol scattering uses a single Henyey-Greenstein `g`
     parameter per named preset.
   - Missing behavior: real aerosol forward scattering can have a sharper
     near-forward peak than one HG lobe represents.
   - Why it matters: the near-sun aureole is mainly controlled by
     forward-scattering aerosol behavior, so the approximation can shift both
     brightness and falloff around the disk.

4. **Direct solar radiance path**
   - Current state: the sun illuminates the atmosphere, but the image does not
     include direct solar disk radiance.
   - Missing behavior: pixels whose view rays intersect the visible solar disk
     should receive direct, spectrally attenuated solar radiance.
   - Why it matters: without direct disk radiance there is no physically
     meaningful brightness relationship between disk, aureole, and surrounding
     sky.

5. **Disk occlusion**
   - Current state: horizon/ground intersection can darken the view, but the
     solar disk itself is not rendered or partially hidden.
   - Missing behavior: the reference needs to know whether the disk is fully
     visible, fully hidden, or partly occluded by the horizon/terrain/clouds or
     by model boundaries.
   - Why it matters: a partially occluded sun creates a high-contrast bright
     horizon anchor and changes the nearby glow shape.

6. **Multiple scattering**
   - Current state: the reference sky-patch evidence is single-scattering.
   - Missing behavior: hazy and near-horizon cases can include light that
     scatters more than once before reaching the camera.
   - Why it matters: multiple scattering can lift dark horizon regions and
     soften contrast, especially in sunset and high-aerosol cases.

7. **Camera/display response**
   - Current state: display conversion supports exposure, clipping, and
     preserve-hue tone mapping.
   - Missing behavior: a real-looking sunset needs a camera/display model for
     bright disk clipping, tone compression, bloom/glare, and possibly local
     adaptation.
   - Why it matters: the physical sky around the sun can be low-brightness
     amber, while the photographed result reads as glowing orange because the
     bright disk and aureole drive display response.

8. **Surface reflection and lower-frame context**
   - Current state: the sky-patch horizon surface is effectively black.
   - Missing behavior: terrain, ocean, haze layers, clouds, or a simple
     surface reflection model should provide context below the horizon.
   - Why it matters: a black lower frame makes the horizon band feel heavier
     and browner; reflected or silhouetted context makes the same sky colors
     read more like a sunset scene.

## Recommended First Step

Start with a **diagnostic sun/aureole visual mode**, not a full photographic
sunset renderer.

First implementation slice:

1. Add a named sky-patch option such as `--sun-visual diagnostic` or
   `--sun-visual none|diagnostic`.
   - Done: `--sun-visual none|diagnostic` is implemented in the sky-patch CLI.
2. Keep the current single-scattering transport and composition policies.
   - Done: the diagnostic panels are generated CLI-side and do not alter
     canonical transport stages.
3. Add finite-disk awareness:
   - source angular radius
   - per-pixel angular distance from the solar center
   - whether the camera ray intersects the disk
   - whether the disk is below or clipped by the horizon
   - Done: patch outputs now record solar angular radius/diameter,
     angular-distance diagnostics, disk-hit counts, closest-sun pixel, and
     simple horizon occlusion flags.
4. Render direct disk radiance as a separate, clearly labeled visual component
   outside the transport stages at first.
   - Done: direct-disk output is a diagnostic approximation using source
     spectrum times camera-path transmittance, kept separate from transport
     radiance.
5. Add a near-sun/aureole diagnostic overlay or report fields:
   - angular distance from sun center
   - disk-hit flag
   - estimated disk transmittance
   - aerosol/Rayleigh/ozone species optical depths at key pixels
   - Done for the first diagnostic slice: reports include closest-pixel angle,
     disk-hit count, angle range, direct-disk policy, and fixed angular bucket
     rows for `0-0.25`, `0.25-0.5`, `0.5-1`, `1-2`, `2-5`, and `5-10 deg`.
     Each bucket averages sky radiance, direct-disk approximation,
     sky-plus-disk, view transmittance, and Rayleigh/Mie/ozone optical depth
     at selected wavelengths.
6. Generate comparison artifacts:
   - sky-only current view
   - diagnostic disk-only view
   - sky plus diagnostic disk
   - near-sun angular-distance heatmap if useful
   - Done:
     `tmp/atmosphere-sun-diagnostic/sunset-horizon-wide-diagnostic.png` and
     `tmp/atmosphere-sun-diagnostic/sunset-sun-tight-diagnostic.png`.

Implementation choice:

- Implement the first slice as a CLI-side diagnostic image/report component,
  not as a canonical transport stage.
- Keep the existing sky-patch `traceRay` calls and single-scattering pipeline
  unchanged.
- Store diagnostic disk/direct-sun outputs separately from
  `spectralRadiance.finalByWavelength` so the report can compare sky-only,
  disk-only, and sky-plus-disk without hiding a display shortcut inside the
  physical reference result.
- Use `132x84`, `72 deg` FOV for context artifacts and one tighter crop such
  as `8-12 deg` FOV centered near the sun when the disk needs to occupy
  enough pixels for inspection.

This keeps the first step honest: it does not claim to solve multiple
scattering, physically perfect aerosol phase functions, bloom, or terrain
reflection. It gives us a way to see whether the missing visible sun core and
near-sun angular geometry explain the current brown sunset read before we
invest in the heavier model.

## Diagnostic Results

The first diagnostic artifacts were generated under
`tmp/atmosphere-sun-diagnostic/` using the current best composition stack:
`bucholtz-standard-air` Rayleigh, `clear-maritime` aerosol,
`brion-1998-ozone-295k`, `us-standard-atmosphere-1976-density`,
`astm-g173`, `benchmark-5nm`, and preserve-hue tone mapping.

Largest contributors observed in the sunset diagnostics:

1. **Aerosol/Mie optical depth**
   - Largest physical contributor in the near-horizon buckets.
   - In the wide horizon `5-10 deg` bucket, Mie optical depth is about
     `21.67` at `560 nm` and `19.32` at `660 nm`, larger than Rayleigh or
     ozone.
   - Practical read: aerosol choice is the strongest atmosphere-side lever for
     horizon brightness, haze, and the orange/brown balance.

2. **Rayleigh optical depth**
   - Still very large on long near-horizon paths, especially in blue.
   - In the wide horizon `5-10 deg` bucket, Rayleigh optical depth is about
     `16.45` at `440 nm`, `6.11` at `560 nm`, and `3.13` at `660 nm`.
   - Practical read: Rayleigh strongly removes blue and pushes the sky warm,
     but in these near-horizon buckets it is not the largest opacity term.

3. **Missing direct solar disk in the wide context image**
   - The wide `72 deg` horizon diagnostic has `0 / 11088` disk-hit pixels.
   - Practical read: the broad sunset patch is judged without a bright solar
     anchor, so it can read as a brown atmospheric band even when the
     transport is physically lit by the low sun.

4. **Direct disk contribution when the disk is sampled**
   - The tight sun-centered crop has `24 / 11088` disk-hit pixels.
   - Direct disk appears only in the `0-0.25 deg` bucket. In that bucket, the
     sky radiance averages `560nm:0.0167`, `660nm:0.0957`, while the
     diagnostic direct-disk approximation adds `560nm:0.0053`,
     `660nm:0.0274`.
   - Practical read: the direct disk term matters and gives the near-sun core
     a brighter anchor, but the current approximation is not yet the full
     photographic disk/aureole/glare stack.

5. **Ozone absorption**
   - Smaller than Rayleigh and Mie in these diagnostics, but still visible on
     long slant paths.
   - Around the tight disk bucket, ozone optical depth is about `0.388` at
     `560 nm` and `0.205` at `660 nm`.
   - Practical read: sourced ozone can nudge orange/red balance, but it is not
     the main brown-horizon contributor in the current clear-maritime run.

6. **Camera/display response**
   - Preserve-hue tone mapping prevents channel-by-channel red clipping, but
     the reference still lacks bloom, glare, local adaptation, and full
     bright-disk display response.
   - Practical read: a familiar sunset photo gets much of its perceived
     orange glow from disk/aureole intensity interacting with camera/display
     response, not from sky radiance alone.

Current conclusion: aerosol/Mie is the largest physical lever, Rayleigh is the
second largest physical lever, and the largest visual gap is the missing
rendered sun disk/aureole/glare stack in the wide sunset evidence.

## Diagnostic Follow-Ups

The current best reference-proof baseline is intentionally not final Earth
truth. The sunset horizon case is already a high-optical-depth stress case for
the current single-scattering pipeline, so the next work should improve
diagnostics and reference comparisons rather than hand-tuning colors around an
incomplete model.

Current execution scope: complete the diagnostic/reporting work that can be
done without changing the physical transport model. This includes
optical-depth validity classes, high-tau labeling, extinction-versus-radiance
reporting, comparison-reference notes/artifacts where available, and aerosol
sensitivity grids. The actual aerosol phase-data replacement remains a later
model-improvement step.

1. Add optical-depth validity diagnostics.
   - Done: diagnostic reports now classify center pixels, closest-sun pixels,
     and angular buckets by total optical-depth regime.
   - Classify pixels, samples, and angular buckets by total and per-species
     optical-depth regime:
     - `tau < 0.1`: optically thin
     - `0.1 <= tau < 1`: moderate
     - `1 <= tau < 5`: thick
     - `tau >= 5`: single-scattering warning
     - `tau >= 10` or `tau >= 20`: extreme horizon path
   - Purpose: tell the report reader when a value is useful as quantitative
     evidence and when it should be treated as qualitative/stress evidence.
   - This should not alter radiance, color, exposure, or any transport stage.

2. Mark sunset horizon as a high-tau benchmark.
   - Done: generated reports explicitly label `sunset.horizon` center and
     near-sun buckets as high-tau where applicable.
   - The wide `sunset.horizon` image is useful, but it should be labeled as a
     stress case rather than a simple validation image.
   - Reports should explicitly flag when center pixels, angular buckets, or
     image regions fall into the high-tau warning/extreme regimes.
   - Purpose: keep the baseline honest while preserving the image as a useful
     shader/app comparison artifact.

3. Separate extinction diagnostics from radiance contribution.
   - Done: angular-bucket reports now include average total tau, per-species
     tau, tau class, and per-species single-scattered radiance contribution.
   - Extend bucket and patch reports so high aerosol optical depth is not
     confused with largest visible brightness contribution.
   - Report both:
     - extinction/optical-depth contribution by species
     - single-scattered radiance contribution by species, when available
   - Purpose: distinguish "aerosol is making the path opaque" from "aerosol is
     brightening this pixel."

4. Add a comparison reference.
   - Partially done: candidate external references are selected, but no
     external radiative-transfer run has been executed locally yet.
   - Preferred candidates:
     - Bruneton 2016 clear-sky model evaluation, because it compares
       graphics-oriented sky models against measurements and a physics
       reference model:
       `https://arxiv.org/abs/1612.04336`.
     - libRadtran/DISORT, because it is a widely used atmospheric
       radiative-transfer code path for stronger sky-radiance comparison:
       `https://www.libradtran.org/`.
   - Select one known atmospheric model, published sky-radiance benchmark, or
     external radiative-transfer run for one or two baseline scenarios.
   - Compare the current single-scattering reference against that stronger
     reference and document the expected bias.
   - Purpose: validate the direction of the baseline without pretending the
     current pipeline already includes multiple scattering.

5. Generate aerosol sensitivity grids.
   - Done: generated fixed-geometry wide-horizon diagnostic artifacts for
     `rayleigh-only`, `clear-maritime`, `clear-continental`,
     `hazy-continental`, and clear-maritime variants for lower AOD, lower
     `g`, higher `g`, shallow aerosol, and deep aerosol.
   - Artifact summary:
     `tmp/atmosphere-sun-diagnostic/README.md`.
   - Keep camera, sun geometry, solar spectrum, Rayleigh, ozone, molecular
     profile, wavelength grid, exposure, and tone map fixed.
   - Compare:
     - `rayleigh-only`
     - `clear-maritime`
     - `clear-continental`
     - lower-AOD variants
     - different Henyey-Greenstein `g` values
     - different aerosol scale heights
   - Purpose: separate robust sunset/horizon behavior from policy choice.
   - These are plausible variations and controls, not a linear completeness
     ladder.

6. Improve aerosol phase data.
   - Replace or supplement the single Henyey-Greenstein `g` approximation with
     named phase policies:
     - two-lobe Henyey-Greenstein
     - tabulated phase function from an aerosol model/source
     - AERONET-style inversion-inspired presets
   - Purpose: target near-sun aureole shape and forward scattering directly,
     without using display or color adjustments as a proxy.
   - Open: this is the remaining model-improvement step after the current
     diagnostics. The new sensitivity grid shows that `g` is a strong visual
     lever, but does not replace the need for better sourced phase data.

### Current Diagnostic Findings

- The wide `sunset.horizon` center pixel is already a high-tau
  `single-scattering warning` with max tau `6.7054` at `380 nm`.
- The wide near-sun `2-5 deg` and `5-10 deg` buckets are
  `extreme horizon path` regions. In the `5-10 deg` baseline bucket, total tau
  reaches `560nm:27.9388` and `660nm:22.5333`.
- Mie optical depth and Mie radiance are now reported separately. In the
  baseline `5-10 deg` bucket, Mie dominates both opacity and red/green
  single-scattered radiance: Mie radiance is `560nm:0.015`,
  `660nm:0.049`, while Rayleigh radiance is `560nm:0.0067`,
  `660nm:0.0085`.
- The tight sun-centered crop samples the finite disk, but its disk bucket is
  also an `extreme horizon path`. Direct disk adds `560nm:0.0053` and
  `660nm:0.0274` to the `0-0.25 deg` bucket, which is meaningful but not a
  full photographic disk/aureole/glare solution.
- Sensitivity artifacts show that Henyey-Greenstein `g` is the strongest
  current visual lever among the tested aerosol variants: holding AOD fixed,
  lower `g` darkens the center to `#915b1b`, while higher `g` brightens it to
  `#ff8f00`.
- The `hazy-continental` variant is a stress case: the center becomes an
  `extreme horizon path` with max tau `10.2409` and reads much darker/browner.
- A `midday.horizon` patch now provides the clear-day low-elevation companion
  to `midday.zenith` under the current latest stack. Its generated artifact is
  `tmp/atmosphere-sun-diagnostic/midday-horizon-latest-stack.png`, with center
  swatch `#a4a791`.
- Midday-horizon diagnostics show why the current result is brown/olive rather
  than pale haze. `midday.zenith` is a moderate-tau view with max tau `0.4571`
  at `380 nm`, scattering angle `164.0355 deg`, Mie phase560 `0.8484`, and
  Mie/Rayleigh phase ratio `7.3865`. `midday.horizon` is a high-tau view with
  max tau `6.2285`, scattering angle `109.8424 deg`, Mie phase560 `0.0307`,
  and Mie/Rayleigh phase ratio `0.4617`. So the horizon path is optically
  thick, but the current single-HG phase geometry does not give it a strong
  Mie brightening term.
- The `midday.horizon` single-scattering budget at `560 nm` peaks in the
  lower atmosphere: sample `0`, distance `32.6682 km`, altitude `2.2726 km`,
  view transmittance `0.3747`, source transmittance `0.9249`. At that peak
  sample, Rayleigh contributes `0.0235` while Mie contributes `0.0076` at
  `560 nm`.
- The midday-horizon missing-light estimate is
  `multiple-scattering-likely`, while `midday.zenith` is
  `single-scattering-likely-sufficient`. Surface bounce, clouds,
  terrain/ocean reflection, and multiple scattering are explicitly disabled
  in the current report.
- The focused `midday.horizon` aerosol sensitivity pass does not find a
  physically honest knob-only solution. `rayleigh-only` is palest at
  `#afbdaa`; lower AOD is `#aab19a`; the baseline `clear-maritime` is
  `#a4a58b`; `clear-continental` is darker/browner at `#9e926d`; and
  `hazy-continental` becomes an `extreme horizon path` at `#775b2e`.
  Changing `g` also confirms the geometry issue: at about `109.5 deg`
  scattering angle, stronger forward scattering darkens the center to
  `#9c9f88`, while lower `g` brightens it to `#b1ae90`. This is sensitivity
  evidence, not a replacement for missing transport.

Conclusion: the current sunset baseline is useful, but it is already outside
the comfortable range of a simple single-scattering validation image. It
should be treated as a high-tau stress benchmark. The midday-horizon pass
makes the next recommendation sharper: the brown/olive low-elevation horizon
is not primarily a color-output failure or an aerosol-preset typo. The next
implementation step should be a stronger transport reference, calibrated
against Bruneton/libRadtran-style evidence, before changing canonical aerosol
or display defaults. Better sourced aerosol phase behavior remains important,
but it should follow the transport completeness comparison rather than stand
in for it.

### Horizon-Row Diagnostic Result

Done: the sky-patch runner now reports a center-column horizon profile for
each patch. The profile records per-row elevation angle, sky-versus-surface
classification, display color, linear luminance, final radiance,
view transmittance, and optical-depth class. This was added specifically to
separate a true sky-gradient failure from the known black lower-frame surface
placeholder.

Generated focused artifacts:

- `tmp/atmosphere-horizon-profile/midday-horizon-haze-002.md`
- `tmp/atmosphere-horizon-profile/midday-horizon-haze-002.png`
- `tmp/atmosphere-horizon-profile/midday-horizon-single.md`
- `tmp/atmosphere-horizon-profile/midday-horizon-haze-004.md`
- `tmp/atmosphere-horizon-profile/midday-horizon-rayleigh-only-haze-002.md`
- `tmp/atmosphere-horizon-profile/midday-horizon-clear-continental-haze-002.md`

Findings:

- The center-column geometric horizon is between row `35` and row `36` for
  the `88x56` diagnostic. Row `35` is still sky at `0.4613 deg`; row `36`
  is a surface hit at `-0.009 deg` and renders black because surface radiance
  is currently disabled. This confirms that the hard black lower band is a
  lower-frame surface-context problem.
- There is also a true sky-side issue above the horizon. In the latest
  clear-maritime/haze `0.02` run, sky luminance peaks near `3.29 deg`
  elevation at `#cdcdbb`, but the last sky row at `0.46 deg` falls to
  `#b0a092`; near-horizon luminance is only `0.606` of the sky peak.
- The canonical single-scattering run shows the same shape more severely:
  the last sky row is only `0.183` of the peak. The removed haze-lift runs
  lifted that row but did not fix the gradient shape or color fidelity.
- The Rayleigh-only control does not show the same dip: the last sky row is
  `0.996` of the peak. Adding clear-maritime aerosol causes the ratio to drop
  to `0.606`; clear-continental aerosol drops it to `0.545`. The failure is
  therefore tied to aerosol extinction/phase in high optical-depth rows, plus
  missing higher-order aerosol airlight, not to CIE conversion or the basic
  Rayleigh profile.

Evidence-backed recommendation:

- The removed first model improvement was a named aerosol-aware
  diffuse-sky-airlight approximation, not a color/display patch. It helped
  diagnose the high-tau horizon limit, but should not remain in the current
  pipeline. Calibration against a stronger reference model such as
  libRadtran/DISORT or a Bruneton-style clear-sky comparison fixture remains
  future work.
- Latest visual comparison against the user-provided real midday sky photo:
  the current aerosol-aware output is still not visually credible as a real
  sky. It improved the high-tau horizon-profile diagnostic, but the rendered
  image is too gray/desaturated in the upper sky, too beige near the horizon,
  and does not reproduce the photo's clean saturated-blue-to-pale-cyan/white
  gradient. The latest image artifacts to compare are
  `tmp/atmosphere-images/059_atmosphere-diffuse-sky-airlight-stack-sky-patches-full-stack-132x84-aerosol-aware.png`
  and
  `tmp/atmosphere-images/060_atmosphere-diffuse-sky-airlight-stack-midday-horizon-full-stack-132x168-aerosol-aware.png`.
  Treat those artifacts as removed-experiment evidence, not as an accepted sky
  appearance baseline.
- First follow-up from that comparison: the reference sky-patch runner now
  trades speed for accuracy through `--view-steps` and
  `--sun-transmittance-steps`; `--progress` now writes row-level stderr
  heartbeat logs and `--progress-log <path>` writes the same progress to an
  explicit file for long artifact runs. Defaults are `64/16` for sky patches,
  with `sunset.horizon` using `64/32`; reports and summaries include the
  resolved counts. The historical full `132x84` sourced-stack comparison is
  `tmp/atmosphere-finer-sampling-sky-patches/sky-patches-full-stack-132x84-finer-defaults-progress.png`
  with Markdown/JSON/log siblings. Centers: `midday.zenith #c6cede`,
  `midday.horizon #dce0db`, `sunset.horizon #cf946b`. This is useful
  convergence evidence and should be used before promoting new model terms,
  but it does not by itself explain or fix the remaining photo mismatch.
- Framing follow-up: `midday.horizonSky` is now a panned-up companion view for
  photo-style comparison. It centers the 26 degree FOV at 12 degrees elevation,
  keeping the horizon near the lower edge while preserving the original
  `midday.horizon` as the low-elevation transport stress diagnostic. Full
  `132x84` output:
  `tmp/atmosphere-finer-sampling-sky-patches/midday-horizon-sky-frame-132x84-finer-defaults.png`
  with Markdown/JSON/progress-log siblings. The report shows `81/84`
  center-column rows are sky, center `#96abc2`, top row `#8297b6`, nearest
  sky-horizon row `#f7e0cd`, and first surface row `81` at `-0.2503 deg`.
  The framing is much better, but the upper blue remains muted versus the
  user photo, so the next work should still target color/transport
  calibration rather than just camera placement.
- A taller `midday.horizonTallSky` scene is implemented for the next full-size
  sky comparison. It centers a 54 degree FOV at 25 degrees elevation, but no
  full `132x168` artifact has been generated for it yet.
- A separate follow-up should add explicit lower-frame surface context, likely
  an ocean/ground radiance model viewed through the same atmosphere. That
  fixes the black below-horizon band, but it is not sufficient for the sky
  gradient above the horizon.
- If this approximation layer keeps accumulating compensatory rules, pause the
  approximation path and use the broader
  [Multiple-Scattering Reference Design](../multiple_scattering_design.md) as
  potential future work for a slow benchmark or external-reference
  calibration mode.

Source support:

- Bruneton 2016 compares graphics sky models with measurements and libRadtran,
  and emphasizes that fewer simplifications in the physical equations produce
  more accurate results:
  `https://arxiv.org/abs/1612.04336`.
- The same paper names aerosols as complex, variable, anisotropic Mie
  scatterers with visible absorption and notes that ground albedo/BRDF also
  affects sky color.
- libRadtran/DISORT is the preferred external calibration target because it
  solves atmospheric radiative transfer with layer-configurable aerosol
  scattering/absorption, phase functions, ground spectral albedo/BRDF, and
  multiple-scattering solver paths:
  `https://www.libradtran.org/`.

Flat geometry impact:

- This recommendation matters even more for a true flat atmosphere because a
  near-parallel ground ray can remain in dense air for much longer than a
  spherical Earth horizon ray. The globe case eventually escapes dense lower
  atmosphere as curvature carries the ray upward; a flat slab or flat world
  with increasing path length can accumulate optical depth until direct
  single-scattered light, terrain contrast, and source visibility collapse.
- The multiple-scattering/diffuse-airlight term must therefore be bounded and
  regime-aware for flat geometry. It should not add brightness indefinitely
  along an effectively infinite dense path. High-tau flat rays should trend
  toward an asymptotic veil/airlight color and, beyond a visibility threshold,
  report that terrain detail is functionally unrecoverable.
- Flat-world follow-ups:
  - Add a flat-geometry horizon-profile diagnostic parallel to the globe
    `midday.horizon` profile, including path length, tau class, view
    transmittance, source transmittance, airlight contribution, and
    recoverable-detail/contrast classification.
  - Extend the light-extent probe into a visibility-depth probe that combines
    finite or distant Sun falloff, source-to-air/source-to-terrain
    transmittance, terrain-to-camera transmittance, in-scattered airlight,
    and terrain contrast.
  - Define flat-ray termination or asymptotic behavior for optically extreme
    paths so the renderer can choose between visible detail, qualitative
    haze, and no-detail proxy output.
  - Calibrate the flat approximation against a finite slab/reference setup
    where possible before using it as evidence for flat-world visual claims.

## Later Work

- Replace or supplement single-HG aerosol with a better near-forward phase
  model or a named multi-lobe approximation.
- Add near-sun supersampling/adaptive sampling.
- Move direct solar radiance from diagnostic overlay toward a first-class
  reference image component when its source units and display behavior are
  pinned.
- Add horizon/terrain/cloud occlusion for the solar disk.
- Add display-side bloom/glare/tone-compression policies after the physical
  disk and aureole are diagnosable.
- Add simple surface/ocean/terrain context for sunset horizon views.
- Investigate multiple-scattering approximations or external reference
  fixtures once the single-scattering sun diagnostics are understood.
