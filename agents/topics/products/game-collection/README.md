# Game Collection

This product area owns the game collection domain. Mahjongg Solitaire is the
current concentration, but it is not the whole product. Future restored games
and shared game UI should live beside Mahjongg instead of inside it.

## Areas

- [GC App](gc-app/README.md): deployable game collection app surface, PWA
  behavior, routing, and app-level integration.
- [Mahjongg Solitaire](mahjongg-solitaire/README.md): current active game,
  including engine, difficulty, layout, scaling, animation, solver analysis,
  and telemetry.
- [Restored Games](restored-games/README.md): future home for older games
  restored to the collection.
- [Shared Game UI](shared-game-ui/README.md): cross-game UI and presentation
  patterns.

## Current Direction

- Progressive Web App notes belong under [GC App](gc-app/README.md). PWA is
  currently implemented only for Mahjongg/GC.
- Engine refactor and experimental engine work are active under Mahjongg
  Solitaire.
- Difficulty history remains active because difficulty modeling is ongoing
  research.
- MVP notes are historical. Keep only the brief [MVP Summary](../../archive/mvp-summary.md);
  current feedback, telemetry, PWA, and release-readiness facts belong in
  active Game Collection/Mahjongg docs.

## Migration Note

This product area was migrated from the old `mj`, `difficulty`, `scaling`,
`css-animations`, `engine-refactor`, `telemetry-analysis`,
`progressive-web-app`, and historical `mvp` topics during Phase 3.
