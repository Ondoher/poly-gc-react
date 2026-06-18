# Mahjong Tile SVG Face Contractor Brief

This brief is for creating SVG artwork for Mahjong tile faces that can be used
in an offline 3D asset generation pipeline.

## Goal

Create one clean SVG per Mahjong tile face.

The SVGs should be visually faithful to the supplied reference images and easy
for software to process into:

- carved/stamped tile geometry
- colored inlay geometry

The SVGs are not final rendered tiles. They are face artwork inputs for a 3D
generation pipeline.

## Canvas And File Contract

Each face SVG should:

- use `viewBox="0 0 94 136"`
- contain only the face artwork, not the tile body
- have no tile background, border, frame, drop shadow, or decorative tile edge
- use paths for all visible geometry
- contain no live text; convert numbers, letters, and Chinese characters to
  paths
- contain no raster images
- avoid filters, gradients, masks, clipping tricks, and blend modes unless
  discussed first

## Color Palette

For newly authored contractor SVGs, prefer these exact family anchor colors:

- red: `#FC1D05`
- green: `#2FC906`
- blue: `#0505D1`
- yellow: `#F6F610`
- orange: `#FF9900`
- pink/purple: `#BC197A`
- black: `#000000`
- white/near-white paint: `#F4F4F4`
- negative space / tile body: `#FFFFFF`

White shapes should be used for internal negative-space details, such as holes
inside dot patterns. Draw them as solid white path shapes in contractor/source
artwork so the intent is explicit. The repo preprocessing step may later bake
those white source shapes into transparent compound-path holes for cutter and
inlay generation.

The current repo preprocessing pipeline can also ingest alternate source
colors from real tilesets. It classifies colors by perceived family and maps
shade details around reference anchors, so contractor art does not need to
invent extra shade colors unless the reference clearly needs them. Pure
`#FFFFFF` should still be reserved for negative space/cutouts.

## Layer / Group Strategy

Group artwork by semantic role and color, not by drawing-app export order.

Preferred top-level shape:

```xml
<svg viewBox="0 0 94 136" xmlns="http://www.w3.org/2000/svg">
  <g id="face">
    ...
  </g>
</svg>
```

Use clear group names for independently meaningful parts.

### Standard Suit Tiles

Use:

```xml
<g id="number">...</g>
<g id="suit-art">...</g>
<g id="negative-space">...</g>
```

`negative-space` is optional but preferred when the face contains white internal
details.

For repeated suit motifs, keep the broad `suit-art` group and add one nested
group around each independently meaningful repeated unit:

```xml
<g id="suit-art">
  <g id="bamboo-1">...</g>
  <g id="bamboo-2">...</g>
</g>
```

The broad group is enough for preprocessing to distinguish suit artwork from
the number label. The nested repeated-unit groups are the preferred handoff for
shape identification when the pipeline needs to align or review each dot,
bamboo, or character unit separately.

Do not put all repeated units only inside one shared group. Without the
per-unit nesting, preprocessing can preserve the broad artwork group but may
not produce one source shape per repeated motif, which makes repeated-part
alignment ambiguous or fail.

### Flowers And Seasons

Use:

```xml
<g id="number">...</g>
<g id="character">...</g>
<g id="botanical-art">...</g>
```

For seasons, `season-art` is also acceptable instead of `botanical-art`.

The number, Chinese character, and main artwork must be independently grouped
because their placement may need to be adjusted separately.

### Winds

Use:

```xml
<g id="wind-label">...</g>
<g id="character-art">...</g>
```

The wind-label group contains the `N`, `S`, `E`, or `W` marker.

### Dragons

Use:

```xml
<g id="dragon-art">...</g>
<g id="negative-space">...</g>
```

Only include `negative-space` when the artwork needs it. Dragon faces should
not include numbers or wind-style letters.

### Special Faces

Use descriptive names for independent artwork units, such as:

```xml
<g id="bird-body">...</g>
<g id="bamboo-stalks">...</g>
<g id="center-number">...</g>
```

## Reference Images

The supplied reference images are the visual authority for:

- composition
- orientation
- label placement
- color assignment
- special-case layout

The SVG does not need to be pixel-identical to the reference, but analogous
parts should be recognizable and colored according to the reference.

## Special Notes

- `b-8` is special: its number is centered inside the main motif, not placed in
  the normal upper-left number position.
- `b-1`, `d-1`, and season tiles are high-variation faces and should be
  discussed before finalizing.
- Flowers and seasons should keep their Chinese character as path geometry and
  group it independently from the main artwork.
- Winds need the `N`, `S`, `E`, or `W` marker placed according to the reference
  image.
- Some dragons may vary between tile sets; ask for clarification if the source
  style differs substantially from the reference.
- New/nonstandard faces, such as jokers, should be discussed before production.

## What To Avoid

Avoid:

- one giant ungrouped path blob
- live text
- embedded PNGs or JPGs
- Illustrator/Inkscape export leftovers that are not visible face artwork
- tile body, tile edge, or tile background layers
- drop shadows and effects
- color approximations instead of the agreed anchor palette
- using pure white for visible paint; use near-white only when the face really
  contains white paint
- missing/implicit holes for white internal details in contractor source art;
  draw explicit white negative-space paths so preprocessing can decide how to
  bake them

## Delivery

Deliver:

- one SVG file per tile face
- filenames matching the provided face keys when possible
- editable source files if the SVGs were created from another tool
- a note listing any faces where the reference was ambiguous or a special
  decision was made
