# Active Topic

Current active topic: `flat`

Current focus: The start-fresh Bruneton skydome experiment is closed as an
experimental lane, except for explicit source-audit reruns. Step 032 is the
best current Figure 1 comparison fit and reference handoff candidate: it keeps
the no-ground, no-direct-disc, no-ozone, Bruneton 2016 aerosol, 15-sample CIE,
full-sphere Fibonacci second-order setup from step 031, but uses the Bruneton
comparison-source tone-map scalar `k = 1 / (5 * 683) =
0.00029282576866764275`. User review says the source-backed `k` moves the
render closer to the external Bruneton tiles, so step 031 is now only the prior
fitted-k four-row artifact. Current work is comparing this cleanroom algorithm
against the older reference pipeline architecture and planning how to
incorporate the step 032 visual family without continuing numbered fresh-lane
iterations by default.

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

Then inspect:

- `scripts/flat/experimental/bruneton-start-fresh.js`
- the latest numbered folder under `tmp/atmosphere/bruneton_start_fresh/`
- when the task is reference incorporation or architecture comparison,
  `scripts/flat/atmosphere_rejected/run-reference-probe.js`,
  `scripts/flat/atmosphere_rejected/reference/`, and
  `agents/topics/apps/flat/plans/atmosphere_reset/reference/`

For clean-room source audits, do not load `agents/topics/apps/flat/status.md`,
`atmosphere-design.md`, older Flat atmosphere plans, previous skydome logs,
local comparison galleries, archive/migration docs, or `agents/topics.bak`.
For explicit reference-incorporation tasks, the reference pipeline docs/code
are in scope for architecture and integration only; do not use older local
project code/docs as sources for physics constants, display constants, expected
colors, or visual targets.

Current subtopic: Incorporate the completed cleanroom evidence lane into the
older reference implementation. The current visual handoff candidate is step
032,
`tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/`.
Step 032 uses the four Figure 1 rows, red-cross-derived Sun orientations, no
ground coupling, no direct solar-disc camera term, no ozone, Bruneton 2016
aerosol constants, 15-sample CIE conversion, full-sphere Fibonacci second-order
scattering, and `k = 1 / (5 * 683)`. Step 029 remains the prior simplified
fitted-k anchor, step 031 remains the prior fitted-k four-row orientation
artifact, and step 030 remains direct-ground equivalence evidence. The next
implementation phase is not more fresh-lane visual iteration; it is mapping
the step 032 profile into the reference pipeline with explicit stage contracts,
post-pipeline display policy, and parity checks.
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

Additional reload sources for the closed experiment and reference-incorporation
record:

- [Bruneton Start-Fresh Prompt](apps/flat/plans/bruneton-start-fresh-prompt.md)
- [Bruneton Start-Fresh Work Log](apps/flat/plans/bruneton-start-fresh-worklog.md)
- [Reference Stage Contracts](apps/flat/plans/atmosphere_reset/reference/stage_contracts.md)
- [Reference Code Design](apps/flat/plans/atmosphere_reset/reference/code_design.md)
- [Reference Status](apps/flat/plans/atmosphere_reset/reference/status.md)

When switching topics, update this file with the new topic id from
[Routing](context/routing.md). On bootstrap, load the active topic README after
the lightweight shared context only far enough to see its `Current Active Task`
routing note, then load only the additional reload sources above unless the
user explicitly asks for a broader architecture comparison.
