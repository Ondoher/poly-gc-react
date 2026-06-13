# Documentation Restructure

This topic owns the migration from the old flat `agents/topics.bak` tree to
the new purpose-first `agents/topics` tree.

## Current State

As of 2026-06-12, the new folder skeleton has been created, Phase 1 standards
content has been migrated, Phase 2 Asset Pipeline 3D has been migrated, Phase
3 Game Collection has been migrated, Phase 4 Deployable Apps has been
migrated, and Phase 5 References/Assets has moved bulky reference material for
a first pass. The old topic tree is preserved at:

```text
agents/topics.bak/
```

The standards area now contains real bootstrap and repo-wide guidance. Asset
Pipeline 3D, Game Collection, deployable SAT/Flat app docs, and the first
repo-level reference store have been migrated for a first pass. Archive and
compatibility cleanup still need focused migration.

## Phase Status

- Phase 0: structurally complete and fully closed by the Phase 1 standards
  migration.
- Phase 1: complete for the first migration pass. Standards docs have been
  copied into the new tree with light link/index edits. `scripts` keeps only
  general standards guidance; domain-specific script details are deferred to
  product/app phases.
- Phase 2: complete for the first migration pass. Asset Pipeline 3D docs have
  been moved into contracts, SVG processing, generated models, runtime,
  pipeline app, contractor handoff, experiments, and archive areas. The SVG
  stage contract has been split into one doc per stage plus a summary.
- Phase 3: complete for the first migration pass. Game Collection now owns
  Mahjongg Solitaire, GC app/PWA, restored-games stubs, shared-game-UI stubs,
  engine refactor, difficulty research/history, scaling, animation, solver
  analysis, and telemetry docs. MVP is represented only by the archive summary.
- Phase 4: complete for the first migration pass. SAT docs now live under
  `apps/sat`; Flat docs now live under `apps/flat`, with the old mixed README
  preserved as `status.md` and separate prompt, plan, API draft, and migration
  decision docs.
- Phase 5: complete for the first migration pass. Reference assets now live in
  the repo-level `references/` folder, grouped by domain.
- Phase 6: started. The remaining `agents/topics.bak` tree has been packaged
  as `archives/docs/topics.bak.zip` for the user to move out of the repo.

## Resume Point

Continue with Phase 6:

- move stale exploratory notes into archive where appropriate
- add redirect or compatibility notes for common old links if they are likely
  to be used during the transition
- search for remaining active references to `agents/topics.bak` and replace
  them where they no longer describe source history
- after the user moves `archives/docs` out of the repo, decide whether to
  remove the remaining `agents/topics.bak` working tree

Do not migrate MVP details beyond the existing archive summary. Do not move
large assets casually; the first reference pass moved the obvious binary and
package material, but cleanup should remain preservation-first.

## Documents

- [Restructure Plan](restructure-plan.md)
- [Document Migration Phases](migration-phases.md)
