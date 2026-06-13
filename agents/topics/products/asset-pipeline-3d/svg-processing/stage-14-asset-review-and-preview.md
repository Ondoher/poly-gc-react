## Stage 14: Asset Review And Preview

Description:

Asset Review presents generated asset readiness and preview state. It
synthesizes status from hashes, artifacts, and queue state rather than
reinterpreting SVG geometry.

Input SVG contract:

- Asset Review does not own SVG state.
- Preview PNG generation consumes the generated GLB, not source SVG, but its
  readiness is hashed with the generated asset stage inputs.
- Final-rendering review PNGs consume the final-rendering SVG text through
  Sharp and therefore require valid XML.
- Final-rendering review PNGs and generated asset preview PNGs are separate
  preview surfaces. The first validates/render-previews SVG text; the second
  previews generated geometry.

Output contract:

- Asset Review synthesizes face state from `assetPipeline`, generated artifact
  existence, hashes, and live/persisted queue state.
- It should show queued/building/stale/ready based on generated asset state,
  not by reinterpreting SVGs.

Boundary:

- A stale preview PNG does not mean cutter/stamped/inlay geometry is stale.
  The stage hashes distinguish those facts.
- Preview renderer timeout issues should not cause SVG normalization or cutter
  contracts to drift.
- The current generated asset preview consumes the final colored-inlay GLB,
  not source SVG text. Preview failures should be handled as preview/runtime
  issues unless the generated model itself proves that an upstream SVG contract
  was violated.
