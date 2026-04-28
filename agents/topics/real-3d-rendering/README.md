# Real 3D Rendering Topics

Use this topic as the index for renderer-side 3D work: the `3d-poc` app,
scene setup, camera behavior, lighting, materials, visual diagnostics, and
research experiments that are about how generated assets look once loaded.

Do not use this topic as the owner for generated asset pipeline contracts.
Generated prepared SVGs, cutter GLBs, stamped tile bodies, colored inlay GLBs,
asset invalidation, build queues, and Asset Review belong to
[3D Asset Pipeline](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/summary.md).

## Routing

- Use [3D Asset Pipeline](/c:/dev/poly-gc-react/agents/topics/3d-asset-pipeline/summary.md)
  for source/reference SVG review, prepared SVG export, generated model
  contracts, asset build invalidation, queues, progress, and asset review.
- Use [Pipeline App Summary](/c:/dev/poly-gc-react/agents/topics/pipeline-app/app-summary.md)
  for the Polylith `pipeline` app shell, feature/page structure, routing, and
  future Asset Review page architecture.
- Use this topic for `src/3d-poc`, renderer diagnostics, material/camera
  experiments, and visual research notes.
- If 3D research grows beyond the current POC/renderer notes, split it into a
  dedicated `3d-research` topic and keep this topic as the renderer/POC index.

## Main Documents

- [poc-status.md](/c:/dev/poly-gc-react/agents/topics/real-3d-rendering/poc-status.md)
  is the running ledger for the current `3d-poc` viewer, material experiments,
  carved/inlay visual findings, and failed branches.
- [contractor-brief.md](/c:/dev/poly-gc-react/agents/topics/real-3d-rendering/contractor-brief.md)
  is a reusable-body/material contractor brief. It is still useful for artist
  conversations about carve-friendly tile body geometry.
- [svg-face-contractor-brief.md](/c:/dev/poly-gc-react/agents/topics/real-3d-rendering/svg-face-contractor-brief.md)
  is an SVG face-art input brief. It overlaps the asset pipeline topic and
  should be treated as a contractor-facing reference, not the canonical
  pipeline contract.

## Current Boundary

This topic owns:

- `src/3d-poc` viewer behavior
- scene graph structure and model loading diagnostics
- camera/orbit/framing behavior
- lighting and shadow setup
- opaque, plastic, glass, resin, and other material experiments
- screenshots or visual criteria for evaluating generated GLBs
- renderer-only experiments that do not change canonical asset generation

This topic does not own:

- SVG preprocessing stage contracts
- prepared SVG schemas
- cutter/stamped/inlay GLB generation contracts
- generated asset hash/invalidation rules
- build queue persistence or progress events
- pipeline review page architecture

## Current Viewer Posture

The active `3d-poc` viewer is a diagnostic scene for generated GLB assets. It
should stay runtime-simple:

- load generated GLBs
- arrange them for comparison
- make material, lighting, and camera behavior easy to inspect
- avoid runtime CSG, SVG parsing, or generated geometry construction

The current production direction is offline generation: the asset pipeline
creates per-face generated tile assets, and renderer-side work focuses on
whether those assets read well under game-like materials, lighting, and camera
conditions.

## Related Paths

- [3d-poc App](/c:/dev/poly-gc-react/src/3d-poc)
- [3d-poc Main App](/c:/dev/poly-gc-react/src/3d-poc/main/App.jsx)
- [Generated Models](/c:/dev/poly-gc-react/scripts/output/3d-assets/models)
- [Asset Pipeline Config](/c:/dev/poly-gc-react/scripts/data/3d-assets/json/asset-pipeline.json)
- [Asset Pipeline Scripts](/c:/dev/poly-gc-react/scripts/3d-assets/asset-pipeline)

## Resume Rule

Before changing renderer-side behavior, read this README and then
[poc-status.md](/c:/dev/poly-gc-react/agents/topics/real-3d-rendering/poc-status.md).
If the change needs new generated GLBs, switch to the 3D Asset Pipeline topic
for the generation contract first, then return here to inspect the result in
the viewer.
