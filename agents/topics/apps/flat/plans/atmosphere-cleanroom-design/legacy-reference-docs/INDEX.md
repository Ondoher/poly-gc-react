# Legacy Flat Reference Documents

This folder preserves Flat documentation outside
`plans/atmosphere-cleanroom-design/` that contains source, reference,
provenance, or model-design material that may be useful during the upcoming
documentation reorg.

These are copied documents, not active design authority. They are not stale by
default: several, especially the Bruneton start-fresh prompt/worklog, are
pre-cleanroom predecessor/source material that led to the cleanroom folder and
Algorithm32. The current canonical Algorithm32 source remains
`../algorithm32-canonical-reference.md`.

## Selection Rule

Copied markdown documents were selected from `agents/topics/apps/flat/` when
they were outside the cleanroom folder, outside visual baseline screenshot
folders, and matched reference/source terms such as external URLs, DOI/source
language, Bruneton, PBRT, libRadtran, SMARTS, ASTM, CIE, NASA, WGS84, Rayleigh,
Mie, ozone, aerosol, or related source-data markers.

Copied on 2026-06-25.

After this copy sweep, the original atmosphere-centric docs and visual
baselines were moved under `../../retired/` so they no longer sit in the active
Flat documentation lane.

## Copied Documents

Root Flat docs:

- `README.md`
- `status.md`
- `prompt.md`
- `projection-model-api.md`
- `atmosphere-design.md`
- `atmosphere-rejected.md`
- `terrain-data-options.md`

Top-level plan docs:

- `plans/README.md`
- `plans/poc-phase-1-plan.md`
- `plans/reality-aligned-daytime-atmosphere-plan.md`
- `plans/spherical-sun-atmosphere-plan.md`
- `plans/bruneton-skydome-prompt.md`
- `plans/bruneton-skydome-worklog.md`
- `plans/bruneton-start-fresh-prompt.md`
- `plans/bruneton-start-fresh-worklog.md`

Atmosphere reset predecessor docs:

- `plans/atmosphere_reset/research.md`
- `plans/atmosphere_reset/design.md`
- `plans/atmosphere_reset/plan.md`
- `plans/atmosphere_reset/multiple_scattering_design.md`
- `plans/atmosphere_reset/multiple_scattering_plan.md`
- `plans/atmosphere_reset/color/plan.md`
- `plans/atmosphere_reset/composition/plan.md`
- `plans/atmosphere_reset/sun/sun_visual_plan.md`
- `plans/atmosphere_reset/reference/README.md`
- `plans/atmosphere_reset/reference/code_design.md`
- `plans/atmosphere_reset/reference/fixture_sources.md`
- `plans/atmosphere_reset/reference/plan.md`
- `plans/atmosphere_reset/reference/references.md`
- `plans/atmosphere_reset/reference/stage_contracts.md`
- `plans/atmosphere_reset/reference/status.md`
- `plans/atmosphere_reset/reference/test_design.md`
- `plans/atmosphere_reset/reference/test_plan.md`

## Likely Useful Later

- `plans/atmosphere_reset/reference/references.md`: densest source and
  decision log.
- `plans/atmosphere_reset/reference/fixture_sources.md`: source-data readiness
  inventory.
- `plans/atmosphere_reset/color/plan.md`: CIE, solar spectrum, and display
  policy provenance.
- `plans/atmosphere_reset/composition/plan.md`: Rayleigh, ozone, aerosol, and
  phase-policy source candidates.
- `plans/bruneton-start-fresh-prompt.md`: predecessor prompt that initiated
  the start-fresh lane which produced the cleanroom Algorithm32 result.
- `plans/bruneton-start-fresh-worklog.md`: step-032 ancestry and incorporation
  notes from that same predecessor lane.
- `plans/spherical-sun-atmosphere-plan.md`: prior Three color/depth atmosphere
  integration framing.

## Exclusions

- `plans/atmosphere-cleanroom-design/` was excluded because it is already the
  current working doc tree.
- `baselines/daytime-atmosphere/` was excluded because it contains old
  screenshot/sample metadata rather than reusable source references. The
  original baseline tree now lives under
  `../../retired/baselines/daytime-atmosphere/`.
- Non-markdown source artifacts, generated images, and temp outputs were not
  copied in this sweep.
