# Custom SVG Face Artwork Contractor Package

This package is for creating or revising custom Mahjong SVG face artwork.

## Game Reference

Play/reference the current game here:

https://apps.uber-geek.com/gc

## Included Files

- `large-faces-pngs.zip`: PNG reference faces for the current full tile set.
- `color-palette.md`: human-readable palette with color names and hex values.
- `color-palette.csv`: palette in spreadsheet-friendly form.
- `color-palette.json`: palette in machine-readable form.
- `palette-builder-traditional.svg`: existing palette/reference SVG from the
  asset-pipeline notes, included as visual context.

## Artwork Notes

- Deliver custom artwork as SVG.
- Match the supplied palette as closely as practical.
- Preserve clear separations between distinct artwork regions so the asset
  pipeline can identify and review source components.
- Avoid relying on raster effects when possible. If masks, clips, filters,
  gradients, symbols, or reused definitions are necessary, keep them explicit
  and well named.
- Keep source element ids/classes meaningful where possible. They help review
  and pipeline diagnostics.

The large-face PNGs are reference artwork, not the required delivery format.
