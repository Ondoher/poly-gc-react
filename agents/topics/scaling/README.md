# Scaling Topic Index

Use these notes for Mahjongg board scaling, generated layout metrics, and
preview-fit direction.

Recommended reading order:

1. [Scaling Status](/c:/dev/poly-gc-react/agents/topics/scaling/status.md)
   for the current split between implemented groundwork and still-pending
   integration work.
2. [Tile Size Scaling](/c:/dev/poly-gc-react/agents/topics/scaling/tile-size-scaling.md)
   for the runtime fit model, current metric contract, and remaining migration
   plan away from preset-driven tile-size selection.
3. [Settings Preview Area](/c:/dev/poly-gc-react/agents/topics/scaling/settings-preview-area.md)
   for the preview-specific sizing notes that still matter after the broader
   scaling shift.
4. [Canvas Rescaling Policy](/c:/dev/poly-gc-react/agents/topics/scaling/canvas-rescaling-policy.md)
   for the event-driven rules that decide when auto-fit is allowed to update
   the board and when manual zoom/pan must be left alone.

Related docs:

- [MJ Topic Index](/c:/dev/poly-gc-react/agents/topics/mj/README.md)
  for broader Mahjongg UI and feature notes.
- [Scripts Overview](/c:/dev/poly-gc-react/agents/topics/scripts/scripts.md)
  for the current tile CSS and `layouts.css` generation pipeline.
- [Layout Scaling Remaining Test Ideas](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/_tests/layout-scaling-test-status.md)
  for the remaining worthwhile `mj:layout-scaling` tests.
- [Layout Implementation Plan](/c:/dev/poly-gc-react/agents/topics/mj/layout-implementation-plan.md)
  for the larger MJ UI/layout refactor that overlaps scaling but is not
  itself a scaling-only note.

Fast path:

- current status snapshot: [status.md](/c:/dev/poly-gc-react/agents/topics/scaling/status.md)
- runtime scaling model and migration plan: [tile-size-scaling.md](/c:/dev/poly-gc-react/agents/topics/scaling/tile-size-scaling.md)
- preview-specific scaling direction: [settings-preview-area.md](/c:/dev/poly-gc-react/agents/topics/scaling/settings-preview-area.md)
- auto-fit trigger rules: [canvas-rescaling-policy.md](/c:/dev/poly-gc-react/agents/topics/scaling/canvas-rescaling-policy.md)
