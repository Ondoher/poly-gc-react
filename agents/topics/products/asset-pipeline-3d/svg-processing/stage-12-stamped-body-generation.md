## Stage 12: Stamped Body Generation

Description:

Stamped Body Generation subtracts the cutter from the selected reusable base
tile. It is where SVG-derived cutter defects become physical recess defects if
the cutter contract was not clean enough.

Input SVG contract:

- Does not read SVG directly.
- Reads the selected base tile GLB and the cutter GLB/metadata generated from
  the final-rendering SVG.

Output contract:

- Writes `models/stamped-body/<faceKey>.glb`.
- Writes `json/stamped-body/<faceKey>.json`.
- The stamped body is a base tile with the cutter geometry subtracted.

SVG boundary:

- Any visible SVG defect present in the cutter input will be carved into the
  body.
- Any cutter-side internal wall that survives Stage 11 can appear as unwanted
  recess walls after subtraction.
- Stamped body generation should not reinterpret SVG semantics. If it needs
  semantic knowledge, the contract is wrong upstream.
- The current implementation reads only the selected base tile and cutter
  artifacts. It does not read source SVGs or final-rendering SVGs directly.
- At this point SVG issues have become geometry issues. Fix bad source
  meaning, layout, color, or simplification upstream instead of adding
  semantic SVG logic to stamped body generation.
