# MJ Topic Index

Use these notes for Mahjongg-specific implementation topics.

Use this index to find the right level of detail quickly. The current docs are
deliberately split so we do not have to rediscover the same material from three
slightly different writeups later.

Recommended reading order for generator and difficulty work:

1. [Engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
   for the current runtime model, current ladder, and current measured shape.
2. [Difficulty Measurement](/c:/dev/poly-gc-react/agents/topics/mj/difficulty-measurement.md)
   for what the analyzer metrics mean and how they are sampled.
3. [Difficulty Tuning Knobs](/c:/dev/poly-gc-react/agents/topics/mj/difficulty-tuning-knobs.md)
   for which levers move which metrics and the latest tuning conclusions.
4. [Generation Difficulty](/c:/dev/poly-gc-react/agents/topics/mj/generation-difficulty.md)
   for the original generation-time framing, suspension design intent, and
   future-facing generation notes that are still useful but are no longer the
   canonical description of the live engine.
5. [Strategy Advice Proxy Research](/c:/dev/poly-gc-react/agents/topics/mj/strategy-advice-proxy-research.md)
   for public Mahjong Solitaire strategy and pitfall themes mapped back to the
   current heuristics as a rough human-difficulty proxy.

Redundancy note:

- treat the engine README as the canonical "how it works now" document
- treat the topic notes as supporting material, tuning history, and analysis
  context
- if two docs disagree, the engine README and the live code win

Primary topic entry points:

- [Engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
- [Layout Implementation Plan](/c:/dev/poly-gc-react/agents/topics/mj/layout-implementation-plan.md)
- [Game Number Field](/c:/dev/poly-gc-react/agents/topics/mj/game-number-field.md)
- [Difficulty Measurement](/c:/dev/poly-gc-react/agents/topics/mj/difficulty-measurement.md)
- [Difficulty Tuning Knobs](/c:/dev/poly-gc-react/agents/topics/mj/difficulty-tuning-knobs.md)
- [Generation Difficulty](/c:/dev/poly-gc-react/agents/topics/mj/generation-difficulty.md)
- [Strategy Advice Proxy Research](/c:/dev/poly-gc-react/agents/topics/mj/strategy-advice-proxy-research.md)
- [Solver Paper Notes](/c:/dev/poly-gc-react/agents/topics/mj/solver-paper-notes.md)
- [Solver And Analysis Tool](/c:/dev/poly-gc-react/agents/topics/mj/solver-analysis-tool.md)
- [Settings Preview Area](/c:/dev/poly-gc-react/agents/topics/mj/settings-preview-area.md)

Fast path:

- current runtime engine and difficulty model: [engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)
- current tiny minimum viewport: [layout-implementation-plan.md](/c:/dev/poly-gc-react/agents/topics/mj/layout-implementation-plan.md)
- game number control treatment: [game-number-field.md](/c:/dev/poly-gc-react/agents/topics/mj/game-number-field.md)
- difficulty tuning and validation: [difficulty-measurement.md](/c:/dev/poly-gc-react/agents/topics/mj/difficulty-measurement.md)
- difficulty knob effects: [difficulty-tuning-knobs.md](/c:/dev/poly-gc-react/agents/topics/mj/difficulty-tuning-knobs.md)
- generation-time difficulty ideas: [generation-difficulty.md](/c:/dev/poly-gc-react/agents/topics/mj/generation-difficulty.md)
- public strategy advice mapped to current heuristics: [strategy-advice-proxy-research.md](/c:/dev/poly-gc-react/agents/topics/mj/strategy-advice-proxy-research.md)
- solver ideas from academic work: [solver-paper-notes.md](/c:/dev/poly-gc-react/agents/topics/mj/solver-paper-notes.md)
- future solver tooling notes: [solver-analysis-tool.md](/c:/dev/poly-gc-react/agents/topics/mj/solver-analysis-tool.md)
- current settings popup and message treatment: [layout-implementation-plan.md](/c:/dev/poly-gc-react/agents/topics/mj/layout-implementation-plan.md)
- preview sizing and rendering direction: [settings-preview-area.md](/c:/dev/poly-gc-react/agents/topics/mj/settings-preview-area.md)
