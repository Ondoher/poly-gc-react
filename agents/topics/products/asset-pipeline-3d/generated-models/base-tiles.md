# Base Tiles

Base tile selection chooses the physical tile body variant used by generated
asset stages.

Current production variant:

- `mark-iii`, shown in the app as "Ivory and Bamboo"

Current promoted files:

- `scripts/data/3d-assets/models/base-tiles/mark-iii.glb`
- `scripts/data/3d-assets/models/base-tiles/mark-iii.json`
- `scripts/data/3d-assets/models/base-tiles/mark-iii-textures/`

The generated asset contract owns detailed base-tile behavior:

- [Generated Assets](../contracts/generated-assets.md)
- [Status](../status.md)

Mark III preserves the artist material stack, including embedded texture maps
that rely on secondary UV channels. Generated exports must preserve embedded
materials for variants that declare embedded preview material sourcing.
