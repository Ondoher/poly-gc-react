## Stage 10: Base Tile Selection And Asset Planning

Description:

Base Tile Selection and Asset Planning choose the physical tile body variant
and stage generated-asset work. The same rendered SVG becomes a different
generated asset when carved into a different base tile.

Input SVG contract:

- Does not read SVG text directly.
- Planning hashes source/review/rendering state and the selected base tile,
  then stages generated asset work for the final-rendering SVG artifacts.

Output contract:

- No SVG is produced.
- The selected base tile variant and generated-asset queue are recorded under
  `assetPipeline` and the persisted queue file.

Boundary:

- Base tile selection changes the generated-asset input hash, because the same
  final-rendering SVG carved into a different body is a different generated
  asset.
- Planning should not rewrite final-rendering SVGs or prepared SVGs.
- The current implementation hashes source/review/rendering state together
  with the selected base tile variant and initializes or refreshes generated
  asset state under `assetPipeline`.
- Planning assumes the rendered SVG artifact already exists. If the SVG is
  missing or stale, rerun the SVG-owning stages rather than fabricating a build
  fallback.
