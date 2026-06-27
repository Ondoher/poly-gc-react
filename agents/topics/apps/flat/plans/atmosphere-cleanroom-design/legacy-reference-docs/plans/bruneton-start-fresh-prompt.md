# Bruneton Start-Fresh Skydome Prompt

## Goal

Create a new self-contained experimental script at:

`scripts/flat/experimental/bruneton-start-fresh.js`

The script must render two fisheye skydome images that closely resemble the
Bruneton 2016 clear-sky skydome examples:

- one sunset / low-Sun dome
- one midday / high-Sun dome

For this task, a skydome is a 2D fisheye image of the visible upper sky
hemisphere as seen from a ground observer. The image center is the zenith
straight overhead, the circular edge is the horizon in every azimuth direction,
and pixels outside the circle are not part of the sky. It is an output image
for comparing sky appearance, not a 3D mesh, app background, shader component,
or reused project rendering artifact.

This is a clean-room fresh start. Do not import, reuse, inspect, cite, or derive
equations/constants from previous local project implementations, including
existing project atmosphere, color, rendering, reference-probe, sidecar, or
skydome code. Do not use older local docs, status entries, work logs, generated
artifacts, or prior experiment conclusions as technical guidance. The script
may use Node built-ins. If an external package is considered, record the reason
in the work log before using it; prefer a fully self-contained implementation.

Clean-room source boundary: implementation decisions may reference only
external sources, including external papers, standards, datasets, and
third-party source code already downloaded into the workspace. Downloaded or
extracted external source files are allowed even if an earlier session placed
them in `tmp/`, but only when cited directly as external primary material.
Previously written local project code, older local documentation, older rerun
logs, local summaries of external sources, and older generated local artifacts
are not acceptable sources for equations, constants, algorithms, expected
colors, visual targets, or design decisions. If an already-downloaded file is
used, the step report must identify why it is an external source rather than a
previous local implementation or local summary.

Bootstrap docs are routing only. If required bootstrap files mention previous
project atmosphere work, ignore those details for this task except for locating
this prompt/worklog and the requested script/artifact paths. Do not follow
links from bootstrap or README files into older local atmosphere plans unless a
future user explicitly changes the clean-room rule.

Repository architecture or convention docs may guide file placement, naming,
and how to avoid disrupting unrelated work. They must not guide atmosphere
physics, rendering equations, color conversion, constants, sampling strategy,
target colors, or visual interpretation for this task. Use filesystem search to
locate already-downloaded external source files when needed; do not read older
local logs to discover or interpret them.

## Operating Mode

Work one step at a time without asking the user for interaction. Each step may
replace, revise, or undo the work of an earlier step within this fresh
experiment. Keep the work log current after every step so a later agent can see
exactly what changed inside this clean-room lane and avoid duplicating rejected
fresh-lane effort.

No unit tests are required for this task. Use command-line runs and image/log
artifacts as verification.

## Artifact Contract

Every implementation or evaluation step must create a sortable numbered folder
under:

`tmp/atmosphere/bruneton_start_fresh/`

Use a three-digit prefix and short label, for example:

`tmp/atmosphere/bruneton_start_fresh/001-single-scatter-baseline/`

Each numbered folder must contain enough information to reconstruct how the two
images were made:

- the sunset skydome output
- the midday skydome output
- a machine-readable parameters/provenance file, preferably JSON
- a human-readable notes or report file
- command line or run log output
- a copy or embedded record of the equations/constants/model switches used for
  that step

If a fresh-lane step is rejected, keep its folder and record why it was
rejected. Do not delete fresh-lane artifact folders just because a later
fresh-lane step supersedes them.

File deletion safety rule: do not delete any file that is not tracked by Git.
This includes scratch files, downloaded external sources, temporary folders,
generated images, logs, JSON reports, and numbered artifact folders. If a step
needs to undo earlier work, prefer writing a new numbered artifact folder or
editing tracked files. Before deleting any file for this task, first verify it
is tracked by Git; if it is untracked, leave it in place.

## Physics Standard

Every equation, constant, approximation, and visual decision must have a
physics-based justification. The report for each step should identify the
source or physical principle used, such as:

- Beer-Lambert transmittance
- Rayleigh scattering wavelength dependence and phase function
- aerosol/Mie approximation and phase function
- spherical atmosphere geometry and optical depth integration
- solar irradiance/spectrum assumptions
- ground albedo or boundary assumptions
- color matching functions and display/tone mapping
- Bruneton 2016 external paper/source assumptions where relevant

Avoid hidden RGB painting, undocumented color grades, or image-space fixes that
cannot be tied to a physical model or to Bruneton's documented display
transform. If a visual approximation is used temporarily, label it as such and
replace it with a justified transport/display decision in a later step.

Scalar proxy constants are allowed only as short-lived hypothesis tests. A
proxy may demonstrate that missing transport likely matters, but it is not an
acceptable final solution. Once a proxy improves the result, replace it with a
real externally justified physical model, such as a documented
multiple-scattering computation/precompute, finite-Sun integration, ground or
lower-boundary coupling, or another sourced transport/display mechanism.

## Suggested Step Sequence

This sequence is guidance, not a lock. Change course when evidence says to.

1. Scaffold the script and artifact writer.
   Produce blank or simple diagnostic fisheye domes plus complete provenance
   files to prove the run structure is reproducible.
2. Add spherical atmosphere geometry, camera rays, Sun direction, and
   Beer-Lambert optical-depth integration.
3. Add single scattering from Rayleigh and aerosol terms with documented phase
   functions and spectral sampling.
4. Add color conversion and tone mapping with an explicit display contract.
5. Add external-source-aligned constants from Bruneton or documented physical
   sources.
6. Add ground or lower-boundary coupling if needed.
7. Add a multiple-scattering approximation or precompute if the horizon/aureole
   cannot be matched with single scattering.
8. If a scalar proxy is used to test a missing-physics hypothesis, keep it
   clearly labeled and then replace it with real physical transport in a later
   numbered step.
9. Compare sunset and midday domes against external Bruneton paper/source
   targets only, record what remains visibly wrong, then iterate.

## Acceptance Target

The result should be close enough to Bruneton's sunset and midday skydomes that
the difference is not obvious to a casual viewer. This is not a pixel-perfect
target, but the final report should discuss visible similarity for:

- sky color at zenith/center
- horizon/outer fisheye edge brightness and color
- Sun-side aureole size and softness
- sunset warmth without painting the whole rim orange
- midday pale blue-white horizon fade

## Experiment Closed

This start-fresh experimental lane is closed after step 031. Do not continue
creating numbered fresh-lane visual iterations unless the user explicitly
reopens the experiment. Future work should incorporate the source-backed
findings into the reference implementation.

Closed-lane findings to carry into reference work:

- the closed-lane anchor keeps the step 021 visual setup but simplifies its
  inactive bookkeeping/ground terms: step 029 uses the direct derived Figure 1
  tone-map value `k = 0.0002454` and turns off both ground-coupling terms.
  Step 028 used the same step id but was an invalid diagnostic rerun because
  the new id was missing from the physical-render gates; keep it only as audit
  evidence. Step 030 keeps direct-Sun Lambertian ground bounce but turns off
  the sky-irradiance ground term; user subjective review says steps 021, 029,
  and 030 have no clear visual difference. Treat step 029 as the cleanest
  simplified visual-equivalent anchor, and treat step 030 as supporting
  ground-term equivalence evidence.
- step 031 is a generated view-set artifact, not a new model baseline: it uses
  the step 029 model to render the four Bruneton Figure 1 skydome rows
  06h00 / 87 degrees, 10h15 / 41 degrees, 11h15 / 31 degrees, and
  13h15 / 21 degrees. Sun azimuths are measured from the red-cross centers in
  the directly extracted Bruneton-column tiles Im6, Im15, Im25, and Im35, so
  the four outputs match the paper's orientation and Sun positions.
- earlier source-backed context remains important: step 015 activates the
  Bruneton 2016 fitted aerosol parameters in the actual Mie coefficient and
  phase calculations; step 018 tests the Figure 1 target contract by rendering
  the scattered sky/aureole without adding direct solar-disc radiance to the
  camera pass; step 019 replaces the earlier upper-hemisphere/two-ring
  second-order directions with a sourced 17-direction full-sphere Fibonacci
  quadrature; step 021 replaces the demo shader display path with the paper
  Figure 1 tone-map form and a recorded single global fitted `k`; step 022
  uses the external Figure 1 row-label Sun zenith angles; step 023 replaces the
  15-sample spectral approximation with the paper comparison's 40 wavelengths;
  step 024 refits the single global paper tone-map `k` after that spectral
  change; step 025 corrects the shadowed-ground sky-irradiance term but has no
  visible effect; step 026 adds local solar-zenith bins to the second-order
  incident-radiance cache; step 027 adds local incoming-view zenith bins too.
  Do not regress to scalar brightness proxies.
- step 016 makes the high-Sun dome paler and broadens the low-Sun fade, but it
  over-lifts the low-Sun interior; treat it as evidence, not a final answer
- step 017 tried pixel-footprint filtering of the direct solar disc and is
  rejected as too patch-like; solve Sun/core brightness through the finite
  source, atmospheric transport, and display model rather than pixel filtering
- step 018 is accepted only as a target-contract diagnostic: it removes the
  tiny over-bright direct-disc pixels by separating direct solar radiance from
  sky radiance, but it does not solve the atmospheric color/transport mismatch
- step 019 is accepted only as quadrature evidence: the full-sphere Fibonacci
  second-order directions modestly improve the sky but do not close the visual
  gap; do not just increase direction count blindly without auditing display or
  moving to a real scattering/irradiance precompute
- step 020 is accepted only as display-form evidence: the paper tone-map form
  fixed the direction of the color/darkness feedback but the unfitted `k` was
  too dark
- step 021 is accepted as the fitted-tone-map visual baseline that step 029
  simplifies without a clear subjective visual difference. The fitted single
  `k` is recorded and sourced to direct external target tiles, not an RGB
  grade
- step 022 is accepted only as scene-angle evidence: Figure 1 sun zenith angles
  help placement but do not solve the atmospheric mismatch
- step 023 is accepted only as spectral-sampling evidence: switching to the
  paper's 40 wavelengths changed the output only subtly, so wavelength count is
  not the main remaining mismatch
- step 024 is accepted as 40-wavelength display evidence, not the visual
  baseline: refitting the single global `k` modestly improves the fit,
  especially the high-Sun bright area, but user review still prefers step 021
- step 025 is accepted only as a physics-correctness audit: it keeps sky
  irradiance in the ground-reflection term even when direct Sun visibility is
  zero, matching the external shader's separate Sun and sky visibility factors,
  but the rendered PNGs are byte-identical to step 024
- step 026 is accepted only as transport-coordinate evidence: adding local
  solar-zenith (`mu_s`) bins to the second-order incident-radiance cache
  changes the result in plausible ways, but over-concentrates the low-Sun
  Sun-side band and does not fix high-Sun anti-Sun darkness
- step 027 is accepted as transport-coordinate evidence, not the visual
  baseline: adding local incoming-view zenith (`mu`) bins softens step 026 a
  little, but the high-Sun anti-Sun side is still too dark, the low-Sun rim is
  still too warm/ring-like, and user review still prefers the step 021/029
  visual family
- step 028 is rejected as an invalid diagnostic rerun: it used the intended
  no-ground derived-k step id before that id was fully wired into the
  physical-render helper gates
- step 029 is accepted as the final simplified visual-equivalent anchor: it
  uses the derived Figure 1 tone-map product `k = 0.0002454` directly and turns
  off both ground-coupling terms. User subjective review says there is no clear
  visual difference between steps 021, 029, and 030, even though byte RMSE
  against step 021 is larger for the high-Sun image.
- step 030 is accepted as ground-term equivalence evidence, not the simpler
  anchor: keeping direct-Sun ground bounce while omitting sky-irradiance ground
  reflection also remains subjectively tied with steps 021 and 029.
- step 031 is accepted as the Figure 1 four-view render request using the step
  029 model. It produced four generated skydomes plus
  `figure1-four-view-contact-sheet.png` and
  `external-bruneton-column-step31-comparison.png`.
- if a future output includes the direct solar disc, its apparent size and
  brightness must be handled by a sourced finite-Sun/display model, not a
  pixel-footprint filter
- the high-Sun dome still has too much directional darkening on the anti-Sun
  side and the white/aureole region is not target-shaped
- the low-Sun rim remains too uniformly yellow/warm
- the fading horizon band is still too uniform and likely needs a real
  scattering/irradiance precompute or another sourced transport correction
- reference incorporation should move toward real higher-order
  scattering/irradiance computation, not additional display fitting,
  image-space filtering, local ground-term patches, or more partial
  cache-coordinate patches; it should be judged by whether reference outputs
  clearly improve on the step 029 visual family

Allowed visual targets are direct external Bruneton paper/source images or
outputs, including direct copies or extractions from those external materials.
Do not use prior local renders, local contact sheets, local sampled colors, or
local model-output galleries unless the file being cited is identified as a
direct external copy/extraction rather than a locally generated result.

## Continuation Rules

On restart or compaction, load:

1. `agents/topics/active-topic.md`
2. `agents/topics/README.md`
3. `agents/topics/standards/architecture/overview.md`
4. `agents/topics/apps/flat/README.md` only through its
   `Current Active Task` routing note
5. this prompt
6. `agents/topics/apps/flat/plans/bruneton-start-fresh-worklog.md`

Then inspect the current script and latest numbered fresh-lane artifact folder
directly. Do not load older local implementation logs, previous skydome rerun
artifacts, or previous local atmosphere docs. External-source downloads already
present in the workspace may be inspected directly when they are cited as
external sources. Do not use local images generated by previous implementations
as visual targets; use external Bruneton paper/source outputs only.
Never delete untracked files during continuation.
