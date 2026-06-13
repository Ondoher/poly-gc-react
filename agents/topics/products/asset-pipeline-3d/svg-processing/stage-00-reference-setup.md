## Stage 0: Reference Setup

Description:

Reference Setup establishes what each Mahjong tile face is supposed to contain
before any source SVG is considered. It creates the target structure that later
SVG stages align to and render into.

Input SVG contract:

- None. Reference setup currently starts from reference face images and
  reference metadata, not source SVGs.

Output contract:

- No source SVG is produced.
- Reference setup owns semantic target structure: part ids, target bounds,
  colors, and generated glyph slots.
- Later SVG stages may align or render into this structure, but the reference
  structure is not donor SVG geometry.
- The current implementation extracts reference components from reference
  images, auto-assigns them to semantic parts from bootstrap data, and records
  prepared-space `targetBounds` for parts using the reference set's prepared
  `viewBox`.

Boundary:

- Reference geometry is the target contract, not a cutter or inlay source.
- Do not infer source SVG splitting rules from reference parts. Source
  normalization owns source decomposition.
- Later source stages assume reference parts and components are semantically
  trustworthy enough to align against. If reference structure is wrong, fix
  Reference Setup rather than compensating in source normalization.
