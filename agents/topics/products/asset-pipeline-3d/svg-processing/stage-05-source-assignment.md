## Stage 5: Source Assignment

Description:

Source Assignment turns alignment candidates into reviewed semantic bindings.
It answers what the selected source components mean in Mahjong terms and which
accepted source facts final rendering may use.

Input SVG contract:

- Reads normalized component facts plus alignment handoff and optional part
  state.
- May display source SVG previews and normalized component overlays.

Output contract:

- No canonical output SVG is produced.
- The stage records accepted bindings from source components to semantic
  reference parts and accepted source absence.
- Diagnostic review SVGs can show selected/bound geometry, but final rendering
  owns the first canonical composed SVG output.
- The current implementation consumes compact alignment matches from model
  state, expects a match to resolve to one reference part when possible, writes
  a semantic-map diagnostic artifact, and reconciles accepted bindings back
  into `state.bindings` and `state.parts`.

Boundary:

- Assignment answers "what does this source geometry mean?"
- It does not reshape source paths for 3D except by selecting which normalized
  components are eligible for rendering.
- Assignment depends on Alignment for placement. If a source component cannot
  be positioned, fix alignment or source normalization rather than hiding a
  transform decision in assignment.
