# Source Manifest Contract

This document owns source SVG manifest shape and tileset routing manifest
behavior.

## Source SVG Manifest

Source SVG manifests live at:

```text
scripts/data/asset-pipeline/manifests/<tilesetId>.json
```

They describe source material before it is copied into the pipeline workspace.
The intake script expects:

```json
{
  "description": "...",
  "source": "scripts/data/3d-assets/sprite-sheets/traditional.svg",
  "sheetId": "traditional",
  "outputDir": "scripts/data/3d-assets/sprite-source-svgs/traditional",
  "sourceSvgHints": {},
  "faces": {
    "b-1": {
      "sourceGroupId": "BAMBOO_1",
      "output": "scripts/data/3d-assets/sprite-source-svgs/traditional/b-1.svg",
      "viewBox": {
        "left": 0,
        "top": 205,
        "width": 69,
        "height": 89
      }
    }
  }
}
```

For each face, intake accepts either `source` or `output` as the source SVG
path. Face-level `sourceSvgHints` merge over manifest-level hints.

## Intake Output

Manifest intake copies and annotates each face SVG to:

```text
scripts/output/asset-pipeline/source-svgs/<tilesetId>/<faceKey>.svg
```

Then it builds `scripts/output/asset-pipeline/<tilesetId>/pipeline.json` from
the semantic bootstrap and records each copied SVG as
`svgPipeline.faces[faceKey].artifacts.sourceSvg`.

## Source Layer Hints

`sourceSvgHints` can mark tile/background layers before normalization. The
intake script adds `data-source-layer="tile-background"` to configured group or
element ids so later stages can ignore tile chrome while preserving source
artwork.

## Tileset Registry

The active/known tileset manifest lives at:

```text
scripts/output/asset-pipeline/tilesets.json
```

Shape:

```json
{
  "schemaVersion": 1,
  "activeTilesetId": "wiki",
  "tilesets": [
    { "tilesetId": "traditional" },
    { "tilesetId": "wiki" }
  ],
  "updatedOn": "2026-05-16T00:00:00.000Z"
}
```

It is routing-only. It must not store progress, source paths, generated asset
state, or face counts.
