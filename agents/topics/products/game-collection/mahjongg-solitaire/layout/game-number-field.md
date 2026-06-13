# Game Number Field

## Current Status

The `Game #` field is now implemented as a local Mahjongg component using:

- `GameNumberControl.jsx`
- `TextEditControl.jsx`
- `CssRect.jsx`

The live control no longer uses the image-cut small rectangle directly. It now renders through the MJ CSS rectangle path so the border, transparency, and inset feel can be tuned more easily against the PSD.

## Historical Source Rectangle

The board-number field rectangle source is:

- size: `54x23`
- file: `Designs/mj-page/edit-rect.png`

This is distinct from the larger generic rectangle source:

- `Designs/mj-page/standard-rect.png`

Those source images were the original reference for the board-number field treatment. They remain useful as historical design reference even though the live field is now using the CSS rectangle path.

## Historical Asset Treatment

The earlier MJ implementation used image-backed rectangle assembly:

- 4 corner assets
- stretched top, bottom, left, and right center segments

Small rectangle assets:

- `editrect-tl.png`
- `editrect-tr.png`
- `editrect-bl.png`
- `editrect-br.png`
- `editrect-top-stretch.png`
- `editrect-bottom-stretch.png`
- `editrect-left-stretch.png`
- `editrect-right-stretch.png`

Large rectangle assets:

- `stdrect-tl.png`
- `stdrect-tr.png`
- `stdrect-bl.png`
- `stdrect-br.png`
- `stdrect-top-stretch.png`
- `stdrect-bottom-stretch.png`
- `stdrect-left-stretch.png`
- `stdrect-right-stretch.png`

That image-backed approach had a known limitation:

- these two rectangle families do not cover every target size cleanly
- when a rectangle is shrunk enough that the corner pieces separate before the stretch segments take over, the result starts to blur
- more cut sets will be needed later for smaller rectangles and for square, portrait, and landscape variants

## Current Rectangle System

The live field is now built around `CssRect`, while the older image-cut rectangle path still exists in the codebase through `OrnamentalRect`.

Current working direction:

- use `CssRect` for the live `Game #` field
- keep the field and shuffle action inside one composite control with an internal separator
- tune border color, outer highlight, interior transparency, and inner-shadow cues against the PSD
- preserve the grouped-control seam between the field and shuffle region

## Current Live Sizing

In the MJ page CSS, the board-number control currently uses:

- width: `64px`
- height: `28px`

## Visual Notes

The live result is now structurally closer to the PSD in a different way:

- the field uses a simpler CSS-tuned border treatment closer to the settings dialog language
- the field interior is semi-transparent rather than fully opaque
- the field and shuffle action now sit inside one grouped control rather than as two independently framed boxes
- the text remains visible and legible inside the darker red-brown fill

Still pending tuning:

- final font size
- final text padding/alignment
- final interior red-brown color
- final transparency level
- final inset/shadow feel of the editor surface
- final seam treatment between the field and shuffle button

These should be tuned against the PSD using the current `CssRect` path rather than by trying to restore the earlier image-cut rectangle exactly.

## Responsive UI Note

The `Game #` control is a likely candidate for alternate-size overrides when larger icon assets are enabled.

Planned direction:

- use the same runtime sizing logic that limits available tile sizes to also attach a parent MJ UI scale class
- use that class to override control-specific dimensions rather than replacing the base control rules
- likely override targets include:
  - `Game #` control width and height
  - shuffle button width
  - shuffle icon dimensions
  - right-HUD rail and icon sizes

Example pattern:

- `.mj-ui-large .mj-game-number-control { ... }`
- `.mj-ui-large .mj-shuffle-button-control { ... }`
- `.mj-ui-large .mj-shuffle-button-icon { ... }`

## Photoshop Export Note

When a new icon variant needs to be created from the PSD and the Photoshop layer effects must be preserved:

- select the shape-based icon layer in Photoshop
- use `File > Export > Export As`
- export as `PNG`
- set the export scale to the needed size such as `200%` for a larger icon

This is preferred over SVG when the final icon appearance depends on Photoshop effects that SVG may not preserve accurately.

## Historical Photoshop Data

Earlier Photoshop measurements and styling still matter as reference:

- original observed rectangle size: `52x20`
- stroke width: `2px`
- stroke color: `#ff9800`
- corner radius: `0px`

Layer-style reference values captured from Photoshop:

### Drop Shadow

- blend mode: `Multiply`
- opacity: `50%`
- angle: `90deg`
- distance: `2px`
- spread: `2%`
- size: `2px`

### Bevel & Emboss

- style: `Inner Bevel`
- technique: `Chisel Hard`
- depth: `100%`
- direction: `Up`
- size: `1px`
- soften: `1px`

Shading:

- angle: `90deg`
- altitude: `30deg`
- highlight mode: `Screen`
- highlight color: white
- highlight opacity: `100%`
- shadow mode: `Multiply`
- shadow color: black
- shadow opacity: `100%`

These values were useful during the CSS prototyping phase, but the current implementation is now CSS-tuned rather than driven directly by Photoshop bevel effects or the older image-cut rectangle assembly.
