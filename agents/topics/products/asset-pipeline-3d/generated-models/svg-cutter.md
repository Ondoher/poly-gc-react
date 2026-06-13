# SVG Cutter

SVG Cutter Generation turns the cutter-2D SVG artwork into 3D cutter volumes.

Current handoff:

```text
final-rendering color SVG -> cutter-2D SVG -> svg-cutter
```

The active queue uses the Paper.js `unite-all` cutter-2D stage before invoking
`svg-cutter` with `--skip-union`.

Detailed contract:

- [Generated Assets](../contracts/generated-assets.md)
- [Stage 11: SVG Cutter Generation](../svg-processing/stage-11-svg-cutter-generation.md)
