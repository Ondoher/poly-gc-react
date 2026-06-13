## Stage 7: Visual Approval

Description:

Visual Approval is the future human gate for accepting the composed SVG result
as visually correct for exact inputs. It is intended to approve or route
corrections, not to introduce hidden SVG mutations.

Input SVG contract:

- Future gate, expected to review final-rendering SVG output and associated
  rendered previews.
- It should consume the current final-rendering SVG and exact input hashes, not
  raw source SVGs.

Output contract:

- No new SVG shape is owned by this stage unless the future design explicitly
  promotes a reviewed SVG artifact.
- Approval should record that the visual result is accepted for exact inputs.

Boundary:

- Visual Approval should not mutate normalized source geometry or silently
  patch final-rendering SVG text.
- Corrections should route back to the owning stage: normalization for source
  decomposition, assignment for meaning, rendering for output policy.
- This gate is not active in the current implementation. Current accepted
  final-rendering output can initialize generated asset state without a
  separate visual-approval record.
