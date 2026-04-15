# MJ Topic Index

Use these notes for Mahjongg-specific implementation topics.

Use this index to find the right level of detail quickly. The current docs are
deliberately split so we do not have to rediscover the same material from three
slightly different writeups later.

Recommended reading order for generator and difficulty work:

1. [Engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
   for the current runtime model, current ladder, and current measured shape.
2. [Difficulty Topic Index](/c:/dev/poly-gc-react/agents/topics/difficulty/README.md)
   for the difficulty-specific notes, tuning docs, and telemetry plan.
3. [Difficulty Topic Index](/c:/dev/poly-gc-react/agents/topics/difficulty/README.md)
   for public Mahjong Solitaire strategy and pitfall themes mapped back to the
   current heuristics and the broader difficulty notes.

Redundancy note:

- treat the engine README as the canonical "how it works now" document
- treat the topic notes as supporting material, tuning history, and analysis
  context
- if two docs disagree, the engine README and the live code win

Primary topic entry points:

- [Engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
- [Difficulty Topic Index](/c:/dev/poly-gc-react/agents/topics/difficulty/README.md)
- [Layout Implementation Plan](/c:/dev/poly-gc-react/agents/topics/mj/layout-implementation-plan.md)
- [Game Number Field](/c:/dev/poly-gc-react/agents/topics/mj/game-number-field.md)
- [Solver And Analysis Tool](/c:/dev/poly-gc-react/agents/topics/mj/solver-analysis-tool.md)
- [Settings Preview Area](/c:/dev/poly-gc-react/agents/topics/mj/settings-preview-area.md)

Fast path:

- current runtime engine and difficulty model: [engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
- dedicated difficulty docs and telemetry plan: [difficulty topic index](/c:/dev/poly-gc-react/agents/topics/difficulty/README.md)
- current tiny minimum viewport: [layout-implementation-plan.md](/c:/dev/poly-gc-react/agents/topics/mj/layout-implementation-plan.md)
- game number control treatment: [game-number-field.md](/c:/dev/poly-gc-react/agents/topics/mj/game-number-field.md)
- future solver tooling notes: [solver-analysis-tool.md](/c:/dev/poly-gc-react/agents/topics/mj/solver-analysis-tool.md)
- current settings popup and message treatment: [layout-implementation-plan.md](/c:/dev/poly-gc-react/agents/topics/mj/layout-implementation-plan.md)
- preview sizing and rendering direction: [settings-preview-area.md](/c:/dev/poly-gc-react/agents/topics/mj/settings-preview-area.md)
