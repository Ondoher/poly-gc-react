# Algorithm32 Local-Source CPU Render

Artifact: `tmp/atmosphere/algorithm32_shader_lab/078-cpu-local-source-integrated-render/cases/002-local-source-closest-day`

Status: accepted (8 passed, 0 failed, 0 unresolved).

This run renders a Three scene through the CPU Algorithm32 transport path using the configured flat/local point Sun source contract. It is first-order local-source POC work; direct solar-disc camera radiance, ground bounce, local second-order caches, and shader work remain deferred.

## Source

- Source id: san-jose-000deg-closest-algorithm32-flat-cap-first-order
- Source kind: flat-local-point-sun
- Geometry kind: flat-z-up-atmosphere
- Scene sky-ray limit: 1926774 m
- Scene sky-ray policy: accepted-062-flat-visibility-100-percent-lost-poc-default

## Outputs

- `reference-image.png`: CPU local-source Algorithm32 preview assembled from Three rays.
- `object-mask.png`: Three hit classification mask.
- `source-contract.json`: active source/geometry contract.
- `source-sample-traces.json`: source samples at observer, 10 km, and camera positions.
- `transport-diagnostics.json`: selected-ray spectral transport using the active local source.
- `criteria-results.json`: local-source acceptance criteria.

## Key Measurements

- Sky pixels: 14957
- Hit pixels: 13843
- Max path-radiance mean: 0.07760511228261947
- Incident sky cache entries: 0
- Selected source samples: 5

## Interpretation

The local source is now integrated into the CPU path-radiance integrator itself: source direction, distance falloff, spectral incident scale, and source-path transmittance are evaluated per sample. The configured scene sky-ray limit is a renderer policy seeded by the accepted flat visibility experiments, not an atmosphere constant; shorter practical-resolution caps can be tried later without changing the source contract.
