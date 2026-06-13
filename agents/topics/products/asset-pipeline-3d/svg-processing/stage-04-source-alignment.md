## Stage 4: Source Alignment

Description:

Source Alignment compares normalized source geometry to reference target
structure and records plausible placements. It answers where source components
can fit, without deciding final meaning or paint policy.

Input SVG contract:

- Reads normalized source components and reference geometry.
- Uses source bounds, centers, areas, and shape evidence; it does not consume a
  final render SVG.

Output contract:

- No canonical output SVG is produced.
- Alignment writes compact match and placement facts that describe how source
  components can fit reference semantic targets.
- Diagnostic SVGs may show matches, boxes, and transforms, but those are not
  durable SVG inputs for generation.
- The current implementation reads normalized components and source shapes,
  source optional-part facts from canonical state, and reference components.
  It writes compact alignment matches plus placement fields such as source
  bounds, target bounds, aligned bounds, and transforms back onto canonical
  part state.
- Alignment may also write diagnostic alignment artifacts, but final rendering
  relies on the compact model handoff and part placement fields.

Boundary:

- Alignment answers "where could this source geometry fit?"
- It does not decide final color, whether a generated optional part appears, or
  whether source geometry should be flattened for 3D.
- Alignment assumes normalized source components and source shapes are useful
  visual units. It should not require them to be semantic units or
  cutter-ready geometry.
