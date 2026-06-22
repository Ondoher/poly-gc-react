# Atmosphere Scripts

This folder owns the script-side atmosphere reference proof work.

- `run-reference-probe.js` is the atmosphere-level CLI for producing JSON,
  Markdown, SVG, PPM, and PNG evidence artifacts. For `--sky-dome-grid`,
  `--dome-sample-mask horizon-ring` traces only the current perimeter metric
  band while marking skipped interior pixels in the output.
- `display-parity-audit.js` is a display-only diagnostic CLI for comparing
  CIE scale, exposure, tone mapping, and byte encoding without running
  atmosphere transport.
- `aerosol-mie-parity-audit.js` is a coefficient, phase, and optional masked
  image-sweep diagnostic for deciding whether aerosol/Mie issues look like
  parameter/environment problems or missing basic algorithms.
- `weakness-factor-audit.js` ranks current output weaknesses with a controlled
  source-quadrature diagnostic, real aerosol-policy sweeps, and labeled
  display-side sensitivity proxies for surface coupling and aureole movement.
- `reference/` owns the transport reference pipeline and stage tests.
- `color/` owns post-pipeline color and pixel output consumers.
- `composition/` owns atmosphere-composition policy/data tests and future
  policy helpers.
- `data/` owns shared source artifacts and scenario inputs consumed by those
  packages.
