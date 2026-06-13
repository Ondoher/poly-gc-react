# Viewer Diagnostics

This doc records the current boundary for renderer-side diagnostics of
generated GLB assets.

## Current Boundary

The standalone `src/3d-poc` viewer is a diagnostic scene for generated GLB
assets. It should stay runtime-simple:

- load generated GLBs
- arrange them for comparison
- make material, lighting, and camera behavior easy to inspect
- avoid runtime CSG, SVG parsing, or generated geometry construction

Generated prepared SVGs, cutter GLBs, stamped tile bodies, colored inlay GLBs,
asset invalidation, build queues, and Asset Review readiness belong to the
Asset Pipeline 3D contracts and runtime docs.

Renderer-side work focuses on whether generated assets read well under
game-like materials, lighting, and camera conditions.

## Related Paths

- [3d-poc App](/c:/dev/poly-gc-react/src/3d-poc)
- [3d-poc Main App](/c:/dev/poly-gc-react/src/3d-poc/main/App.jsx)
- [Asset Pipeline Scripts](/c:/dev/poly-gc-react/scripts/3d-assets/asset-pipeline)
- [Generated Asset Contract](../contracts/generated-assets.md)

## Resume Rule

Before changing renderer-side behavior, read this doc and the relevant
generated asset contract. If the change needs new generated GLBs, use the Asset
Pipeline 3D generation contract first, then return here to inspect the result
in the viewer.
