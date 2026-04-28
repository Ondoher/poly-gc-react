# 3D Asset Script Archive

This folder holds historical one-off scripts from earlier SVG preprocessing
and 3D asset POC work. They are kept for reference, not as live pipeline entry
points.

Current scripts should stay in `scripts/3d-assets/svg-preprocessor`,
`scripts/3d-assets/asset-pipeline`, or `scripts/3d-assets/shared` only when
they are imported by active code, called by the Polylith pipeline server, used
by `run-preprocessed-face-pipeline.js` / `run-asset-pipeline.js`, or documented
as current commands.

Archived scripts may need relative import paths adjusted before they can be
run again from this folder.

## Archived Scripts

- `analyze-mjt7-alignment.js`: MJT7 alignment investigation.
- `boolean-carve-tile.js`: older standalone boolean subtraction experiment.
- `compare-flower1-face.js`: one-off flower comparison helper.
- `compare-mjt7-face.js`: one-off MJT7 comparison helper.
- `download-wiki-full-set-svgs.js`: one-time wiki SVG acquisition helper;
  active wiki intake now starts from checked-in source SVGs.
- `export-preprocessed-bamboo-face-svg.js`: face-specific exporter replaced by
  generic preprocessing.
- `export-preprocessed-character-face-svg.js`: face-specific exporter replaced
  by generic preprocessing.
- `export-preprocessed-flower-face-svg.js`: face-specific exporter replaced by
  generic-special preprocessing.
- `export-preprocessed-standard-face-svg.js`: older standard-face exporter
  replaced by generic preprocessing.
- `export-presentation-flower-tile.js`: presentation/relief POC exporter.
- `extract-mjt7-face.js`: one-off d-7 extraction/recolor experiment.
- `palette-color.js`: unused OKLab/OKLCH palette helper superseded by the
  active color utilities.
- `review-reference-glyph-metadata-server.js`: legacy standalone review server
  replaced by the Polylith pipeline app.
