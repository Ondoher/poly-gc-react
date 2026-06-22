# Active Topic

Current active topic: `flat`

Current focus: The start-fresh Bruneton skydome experiment is closed as an
experimental lane. Step 029 is the cleanest simplified visual-equivalent anchor
for step 021: it keeps the step 021 visual setup, uses the direct derived
Figure 1 tone-map value `k = 0.0002454`, and turns off both ground-coupling
terms. User review says steps 021, 029, and 030 have no clear subjective visual
difference; step 030 is supporting ground-term equivalence evidence rather
than the simpler anchor. Step 031 is the final generated artifact and renders
the four Bruneton Figure 1 skydome row views using the step 029 model with the
same row sun zeniths and measured red-cross orientations. Do not keep
iterating numbered fresh-lane artifacts unless the user explicitly reopens
this experiment. Future work should incorporate the lessons from this lane
into the reference implementation.

## Bootstrap For This Task

Load only:

1. `agents/topics/active-topic.md`
2. `agents/topics/README.md`
3. `agents/topics/context/bootstrap.md`
4. `agents/topics/context/routing.md`
5. `agents/topics/standards/architecture/overview.md` as file-placement
   context only
6. `agents/topics/apps/flat/README.md` only through its
   `Current Active Task` routing note
7. `agents/topics/apps/flat/plans/bruneton-start-fresh-prompt.md`
8. `agents/topics/apps/flat/plans/bruneton-start-fresh-worklog.md`

Then inspect only:

- `scripts/flat/atmosphere/experimental/bruneton-start-fresh.js`
- the latest numbered folder under `tmp/atmosphere/bruneton_start_fresh/`

Do not load `agents/topics/apps/flat/status.md`, `atmosphere-design.md`,
older Flat atmosphere plans, previous skydome logs, local comparison galleries,
archive/migration docs, or `agents/topics.bak` for this task.

Current subtopic: Close out the new independent script at
`scripts/flat/atmosphere/experimental/bruneton-start-fresh.js` as a completed
experimental evidence lane. The final simplified visual anchor is step 029,
`tmp/atmosphere/bruneton_start_fresh/029-paper-figure1-derived-k-no-ground-baseline/`.
It is subjectively equivalent to step 021 and step 030, while turning off both
ground-coupling terms and using the direct derived paper Figure 1 tone-map
`k`. The final rendered run is step 031,
`tmp/atmosphere/bruneton_start_fresh/031-figure1-four-view-derived-k-no-ground-baseline/`,
which uses the step 029 model to render the four Figure 1 rows: 06h00 / 87
degrees, 10h15 / 41 degrees, 11h15 / 31 degrees, and 13h15 / 21 degrees, with
Sun azimuths measured from the external Bruneton-column red-cross tiles. Step
030 preserves direct-Sun ground bounce only and confirms the 021/029/030
subjective equivalence. Treat steps 022-027 as evidence about scene angles,
spectral sampling, lower-boundary coupling, and cache-coordinate
approximations. Step 017 tried pixel-footprint filtering of the direct solar
disc and is rejected as too patch-like. The next implementation phase is not
more fresh-lane visual iteration; it is incorporating the source-backed
findings into the reference implementation.
This was a clean-room fresh experimental lane: do not
import, reuse,
inspect, cite, or derive equations/constants from existing project atmosphere,
color, rendering, reference-probe, sidecar, skydome code, older local docs,
older local logs, or older generated artifacts when interpreting the lane's
results. The numbered folders under `tmp/atmosphere/bruneton_start_fresh/`
are retained as provenance and visual evidence.

Every equation, constant, approximation, and display decision must be justified
through external sources only: external papers, standards, datasets, or
third-party source code, including external-source downloads already present in
the workspace. Already-downloaded external files are allowed only as direct
external primary material; local summaries of those sources are not allowed as
substitutes. Older local project code, docs, prior rerun logs, and previous
local artifacts are not valid sources for equations, constants, algorithms,
expected colors, visual targets, or design decisions. Do not use hidden RGB
grades as the solution. A step may undo or replace an earlier step inside this
fresh lane, but only fresh-lane rejected/superseded artifacts should be used to
avoid duplicate fresh-lane effort. Required bootstrap docs are routing only;
ignore previous project atmosphere implementation details in them and do not
follow their links into older local atmosphere plans. Repository architecture
or convention docs may guide file placement and avoiding unrelated churn only;
they must not guide physics, rendering, constants, color conversion, sampling,
or visual interpretation. Visual targets must be direct external Bruneton
paper/source images or outputs, not prior local renders or galleries. Do not
delete any file that is not tracked by Git; verify tracking before any deletion,
and leave untracked files in place. Unit tests are not required for this task.

Additional reload sources for the closed experiment record:

- [Bruneton Start-Fresh Prompt](apps/flat/plans/bruneton-start-fresh-prompt.md)
- [Bruneton Start-Fresh Work Log](apps/flat/plans/bruneton-start-fresh-worklog.md)

When switching topics, update this file with the new topic id from
[Routing](context/routing.md). On bootstrap, load the active topic README after
the lightweight shared context only far enough to see its `Current Active Task`
routing note, then load only the additional reload sources above. Do not load
the older Flat status/design/plan links for this clean-room task.
