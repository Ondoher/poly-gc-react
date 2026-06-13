# Glossary

## Reference Structure

PNG-derived semantic structure for Mahjong faces: parts, target bounds, colors,
component evidence, and generated slots.

## Source SVG

The donor SVG artwork for one face in a source tileset.

## Source Component

A non-semantic normalized SVG geometry unit. Component ids are extraction ids,
not Mahjong meaning.

## Source Shape

A cohesive group of one or more source components emitted by normalization for
selection and alignment.

## Semantic Part

A named Mahjong face slot such as label, glyph, dot, bamboo stroke group,
dragon artwork, or main artwork.

## Binding

A compact component-to-part relation stored under `state.bindings`.

## Accepted Source Absence

A reviewed part state saying the source does not provide a component for that
part. Rendering later decides whether output is generated or omitted.

## Alignment Match

The compact selected handoff from Source Alignment to Source Assignment and
Final Rendering.

## Prepared SVG

Canonical output SVG in prepared face space for downstream 3D generation.

## Base Tile Variant

Reusable physical tile body variant selected before generated asset planning.

## Asset Pipeline

The generated-asset namespace under `assetPipeline`, including selected base
tile, hashes, queue/build state, generated artifacts, and reviewable status.
