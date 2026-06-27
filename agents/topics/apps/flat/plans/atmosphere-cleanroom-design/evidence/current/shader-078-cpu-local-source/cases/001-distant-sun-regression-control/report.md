# Algorithm32 Node/Three Reference

Artifact: `tmp/atmosphere/algorithm32_shader_lab/078-cpu-local-source-integrated-render/cases/001-distant-sun-regression-control`

Status: accepted (16 passed, 0 failed, 0 unresolved).

This run uses a Three.js scene as the geometry source, then sends each Raycaster hit or sky ray into a CPU Algorithm32 transport path. The rendered PNG is a display preview; the verification criteria use the spectral transfer arrays and geometry diagnostics.

## Outputs

- `reference-image.png`: low-resolution Algorithm32 preview assembled from Three rays.
- `object-mask.png`: Three hit classification mask.
- `geometry-diagnostics.json`: camera ray and analytic card-hit checks.
- `transport-diagnostics.json`: selected spectral packets and transfer identity checks.
- `criteria-results.json`: pass/fail criteria.

## Key Measurements

- Sky pixels: 14957
- Hit pixels: 13843
- Incident sky cache entries: 408
- Split-segment max T error: 1.1102230246251565e-16
- Split-segment max path-radiance error: 6.938893903907228e-18
- Low-vs-high Sun path-radiance max delta: 0.02635203452149221

## Interpretation

The baseline bootstrap problem is solved for the CPU side: Three can provide the camera rays, hit distances, and object metadata needed by Algorithm32. The next shader-lab step can reuse this scene definition as the oracle path when a browser shader adapter is added.
