# Colored Inlay

Colored Inlay Generation places colored geometry into the stamped recesses.

It reads the final-rendering color SVG for paint/material regions. It does not
use the cutter-2D SVG as its color source because the SVG-side union/flattening
pass can collapse distinct colored regions.

Detailed contract:

- [Generated Assets](../contracts/generated-assets.md)
- [Stage 13: Colored Inlay Generation](../svg-processing/stage-13-colored-inlay-generation.md)
