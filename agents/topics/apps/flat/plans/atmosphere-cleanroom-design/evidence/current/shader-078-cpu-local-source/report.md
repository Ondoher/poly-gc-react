# CPU Local-Source Integrated Render

Artifact: `tmp/atmosphere/algorithm32_shader_lab/078-cpu-local-source-integrated-render`

Status: accepted (11 passed, 0 failed, 0 unresolved).

This POC fully routes the CPU image renderer through the Algorithm32 source/geometry contract for flat/local point Sun cases. The first-order local path evaluates source direction, distance falloff, spectral incident scale, source-path transmittance, and phase at each atmosphere sample. It does not render a visible solar disc, ground bounce, local second-order cache behavior, or shader output.

## Distant Control

- `tmp/atmosphere/algorithm32_shader_lab/078-cpu-local-source-integrated-render/cases/001-distant-sun-regression-control`: accepted, exact image delta 0.

## Local Images

- `tmp/atmosphere/algorithm32_shader_lab/078-cpu-local-source-integrated-render/local-source-closest-day.png`: day-closest-approach, offset 0 deg, distance 5050.674 km, incident scale 1.
- `tmp/atmosphere/algorithm32_shader_lab/078-cpu-local-source-integrated-render/local-source-090deg-rise-sunset.png`: rise-sunset-90deg-orbit-offset, offset 90 deg, distance 10557.381 km, incident scale 0.22886864160388085.

## Flat Scene Ray Policy

- Limit: 1926774 m (1926.774 km).
- Policy: accepted-062-flat-visibility-100-percent-lost-poc-default.
- This is a renderer-owned no-hit sky segment policy seeded by the accepted flat visibility run, not an atmosphere constant. A shorter practical cap can be tested later for realistic object angular-resolution loss.

## Outputs

- `distant-control.json`: default distant-Sun no-regression control.
- `local-render-cases.json`: nested run summaries, source contracts, traces, and transport summaries.
- `local-source-closest-day.png`: closest-approach local-source CPU image.
- `local-source-090deg-rise-sunset.png`: 90-degree orbit-offset local-source CPU image.
- `criteria-results.json`: aggregate criteria.
