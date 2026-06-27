# Bruneton Skydome Prompt

## Purpose

Use this file as the editable prompt/ruleset for continuing or reshaping the
Bruneton-style skydome visual-match task.

This prompt captures the task-level instructions that started the fresh
skydome pass. It intentionally does not include hidden platform, system, or
developer instructions.

## Original Task Prompt

You currently have one goal. Other than the recent script to play a chime, and
past iterations of this prompt,the repo has been checked in, so you are free to do
anything needed for this task.

Get the skydome we are producing to:

1. Create the sunlight spot on the sunset dome so it approaches the size and
   color of the Bruneton version.
2. Make the daylight dome fade to white around the edges, again similar to the
   Bruneton version.
3. Make the daylight sunspot similar in size to the Bruneton version.

Rules for this work:

1. Start fresh.
2. You do not need to write any tests.
3. You do not need to use any existing code.
4. You are free to do any research and pull down files.
5. You must keep a log of all work so nothing is repeated.
6. Update the agents file so that on agent compression, the next agent
   immediately restarts this task without taking on any other context except
   what is needed to continue.
7. Iterate as often as necessary.
8. Do not delete any unrelated files, or files not in the repo.
9. All decisions have to be justifiable through real physics with an
   appropriate reference.
10. The size and degree of the daytime horizon fade must be similar to the
    Bruneton example.

## Current Color-Match Task Prompt

The previous physics-justified rerun improved the Bruneton-style sunspot and
horizon-fade geometry, but the rendered colors are now too light: daylight is
closer to the Preetham example, and sunset is more orange than the Bruneton
example. Start a new prompt iteration with the same independence rules and a
new goal:

Get the skydome colors closer to Bruneton while preserving the improved
Bruneton-like sunspot size and daylight horizon fade.

Rules for this iteration:

1. The program must be runnable independently.
2. You do not need to write tests.
3. You do not need to preserve or use existing code if a cleaner path is
   needed.
4. You are free to do research and pull down files.
5. You must keep the work log updated so attempts are not repeated.
6. Update agent continuity docs so a compressed or restarted agent immediately
   resumes this task with only the focused context needed.
7. Iterate as often as necessary.
8. Do not delete unrelated files, or files not in the repo.
9. All decisions have to be justifiable through real physics with an
   appropriate reference, or through the referenced Bruneton source display
   transform when the decision is about image formation/tone mapping rather
   than atmospheric transport.
10. The size and degree of the daytime horizon fade should remain similar to
    the Bruneton example.

## Current Horizon/Aureole Task Prompt

The latest source-aligned color pass fixed the broad center-color/lightness
mismatch, but the 128 px horizon-ring inspection artifact shows the original
horizon problem is still unresolved: the daylight dome edge fades to
gray/green-gray instead of Bruneton-like pale blue-white or white.

Start a new prompt iteration with the same methods and constraints, and use
this overall visual standard:

Get the generated skydome close enough to Bruneton in all visible aspects that
the difference would not be obvious to a casual viewer. This is not a
pixel-by-pixel matching goal; it is a perceptual model-output match across the
same rows and regions.

Use these specific goals as guardrails for that standard:

1. Make the daylight dome edge fade to Bruneton-like pale blue-white or white,
   not gray or green-gray.
2. Preserve the improved source-aligned center colors from the latest color
   pass while fixing the horizon edge.
3. Keep the daylight sunspot/aureole similar in size to the Bruneton example.
4. Improve the sunset sun-side spot/aureole size and color toward Bruneton,
   without turning the entire low-sun rim orange.
5. Do not use hidden RGB grades or display-side color painting. Changes must
   be justified by real atmospheric physics with an appropriate reference, or
   by Bruneton's source display transform when the decision is strictly about
   image formation/tone mapping.

These goals are non-regression goals across all comparison cases. A candidate
must not solve one target by materially worsening another. Apply this across:

- all four time rows: `06h00`, `10h15`, `11h15`, and `13h15`
- all relevant regions: center/zenith color, daylight horizon edge, daylight
  sunspot/aureole, sunset sun-side spot/aureole, and low-sun rim color
- both inspection modes: a full-dome render for overall shape/color and a
  high-resolution `horizon-ring` render for the daylight edge

The current source-aligned color result is the baseline to preserve unless a
source-backed correction improves the full set of goals together. Do not accept
a change that makes the centers Preetham-light again, makes the daylight edge
gray/green-gray, shrinks or over-expands the sunspot/aureole, or paints the
entire sunset rim orange in order to satisfy a different target.

Use the Bruneton `image_full_spectral_*_bruneton.png` source outputs as the
visual target. Differences can remain where the implementation is still an
approximation, but they should not be obvious to a casual viewer in the full
dome or high-resolution horizon-ring artifacts.

Rules for this iteration stay the same as the current color-match prompt:
independent runnable program, no tests required, existing code may be replaced
if a cleaner path is needed, research/downloads are allowed, keep the work log
current, update continuity docs, iterate as needed, and do not delete unrelated
files or files outside the repo.

## Current Continuation Context

- Work log:
  `agents/topics/apps/flat/plans/bruneton-skydome-worklog.md`
- Final inspected artifact from the physics-justified rerun:
  `tmp/atmosphere/bruneton-skydome-rerun/007-paper-d72-final/skydome.png`
- User feedback on that artifact: shape is much better, but colors are too
  light; daylight reads closer to Preetham, and sunset is more orange than the
  Bruneton mode.
- Final inspected artifact from the color-match rerun:
  `tmp/atmosphere/bruneton-skydome-rerun/013-color-source-defaults-d72-final/skydome.png`
- High-resolution horizon-only artifact exposing the unresolved gray-edge
  problem:
  `tmp/atmosphere/bruneton-skydome-rerun/014-color-source-defaults-d128-horizon-ring/skydome.png`
- Current implementation:
  `scripts/flat/atmosphere_rejected/run-reference-probe.js`
- Current default physics mode:
  `--sky-dome-visual-fit bruneton-ground-single-bounce-v1`
- Current Bruneton skydome defaults now align to source/display references:
  `bruneton-2016-40` wavelength grid, `bruneton-2016-astm-40` solar spectrum,
  `bruneton-2016-penndorf-standard-air` Rayleigh, Bruneton/Kider aerosol and
  Cornette-Shanks phase, Bruneton no-visible-ozone policy, exponential tone
  mapping, and linear byte encoding.
- Legacy ad hoc comparison mode, not accepted as physics:
  `--sky-dome-visual-fit bruneton-edge-aureole-v1`
- Fast-preview artifacts are useful for smoke checks but under-sample
  near-horizon paths; use `--sampling-profile paper-comparison` for judging
  the Bruneton horizon fade.
- The current accepted color/display defaults should be preserved unless a
  source/reference reason proves they are wrong. The likely remaining issue is
  transport fidelity, especially horizon/aureole secondary or multiple
  scattering, not center-color display calibration.

## Rules To Modify

Use this section to replace or refine the original rules.

- Completed decision: replace the default ad hoc display-side grade with the
  source-referenced `bruneton-ground-single-bounce-v1` physics mode. Keep
  `bruneton-edge-aureole-v1` only as a legacy comparison option.
- Current decision target: reduce the color/lightness mismatch against
  Bruneton using source-backed spectral, transport, or display-model changes;
  do not add a hidden RGB grade.
- Completed decision: the major lightness mismatch came from using sRGB byte
  encoding after tone mapping. Bruneton's `image_full_spectral` source path
  writes `ToneMapping(rgb) * 255` directly, so the Bruneton skydome default now
  uses linear byte encoding with exponential tone mapping.
- Current decision target: solve the daylight gray horizon-ring fade and the
  remaining sunset/daylight aureole mismatch through source-backed physics or
  Bruneton-source display logic, while preserving the source-aligned center
  colors.
- Non-regression decision target: judge changes across all four Bruneton time
  rows and across center color, daylight edge fade, daylight sunspot/aureole,
  sunset sun-side aureole, and low-sun rim color. Do not trade one goal away to
  support another.
- Overall acceptance target: close enough to Bruneton in all visible aspects
  that differences are not obvious to a casual viewer, while still avoiding a
  pixel-by-pixel target or unjustified image painting.
- Decide whether tests remain optional.
- Decide whether existing code may still be ignored, or whether future changes
  should integrate with the current renderer architecture.
- Decide whether generated comparison artifacts should be committed, ignored,
  or regenerated on demand.
