# 3D Asset Pipeline Scripts

Live scripts for converting prepared face SVGs and generated maps into 3D asset
outputs.

Common entry points:

- `run-asset-pipeline.js`
- `export-mj-tile-bodies.js`
- `export-svg-cutter.js`
- `export-stamped-tile-pair.js`
- `export-stamped-tile-inlay.js`

This pipeline can call the SVG preprocessor as an upstream stage, but the
preprocessor scripts themselves live in `../svg-preprocessor/`.
