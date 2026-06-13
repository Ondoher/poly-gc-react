# Progress Events

Generated asset progress event details are currently migrated together with
routes and queue behavior in:

- [Routes And Queue](routes-and-queue.md)

`svg-cutter` reports runtime-only progress on stdout as newline-delimited JSON
records with `event: "assetStageProgress"`. The queue runner forwards these
records to Asset Review as live progress state.
