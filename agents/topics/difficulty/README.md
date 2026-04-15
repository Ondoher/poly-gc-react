# Difficulty Topic Index

Use this topic for notes about Mahjongg difficulty modeling, analyzer metrics,
tuning knobs, and real-world validation.

Use this folder when the task involves:

- interpreting Mahjongg difficulty metrics
- tuning the generated difficulty ladder
- understanding generation-time difficulty design
- planning or reviewing real-world difficulty validation telemetry

## Current Source Of Truth

Start with the runtime engine writeup when the question is about how the system
works now:

- [Engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md)

Use the difficulty topic documents as focused companions:

- `difficulty-measurement.md` for metric semantics
- `difficulty-tuning-knobs.md` for practical tuning levers
- `difficulty-history-and-experiments.md` for historical baselines and earlier experiment notes
- `generation-difficulty.md` for the original design framing
- `difficulty-validation-data-collection.md` for the first live telemetry rollout
- `solver-paper-notes.md` for academic solver-analysis context
- `engine-design-notes.md` for engine-local design framing and future cleanup ideas
- `strategy-advice-proxy-research.md` for public human strategy themes mapped to the current heuristics

## External Research Anchor

The strongest current external academic anchor for this topic appears to be the
de Bondt paper on solving Mahjong Solitaire boards with peeking:

- [Solver Paper Notes](/c:/dev/poly-gc-react/agents/topics/difficulty/solver-paper-notes.md)
- [Solving_Mahjong_Solitaire_boards_with_peeking.pdf](/c:/dev/poly-gc-react/agents/topics/difficulty/Solving_Mahjong_Solitaire_boards_with_peeking.pdf)

That paper is not a direct recipe for board-generator difficulty, but it is the
most relevant academic reference currently collected here for solver behavior,
search-space reasoning, and board-analysis thinking.

## Main Documents

- [Difficulty Measurement](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-measurement.md)
- [Difficulty Tuning Knobs](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-tuning-knobs.md)
- [Difficulty History And Experiments](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-history-and-experiments.md)
- [Generation Difficulty](/c:/dev/poly-gc-react/agents/topics/difficulty/generation-difficulty.md)
- [Difficulty Validation Data Collection](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-validation-data-collection.md)
- [Solver Paper Notes](/c:/dev/poly-gc-react/agents/topics/difficulty/solver-paper-notes.md)
- [Engine Design Notes](/c:/dev/poly-gc-react/agents/topics/difficulty/engine-design-notes.md)
- [Strategy Advice Proxy Research](/c:/dev/poly-gc-react/agents/topics/difficulty/strategy-advice-proxy-research.md)

## Suggested Reading Order

1. Start with the [Engine README](/c:/dev/poly-gc-react/src/gc/features/mj/src/engine/README.md) for the current runtime model and current ladder.
2. Then read [Difficulty Measurement](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-measurement.md) for the analyzer semantics.
3. Use [Difficulty Tuning Knobs](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-tuning-knobs.md) for the practical tuning levers and current preset interpretation.
4. Use [Difficulty Validation Data Collection](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-validation-data-collection.md) for the first live telemetry rollout.
5. Use [Difficulty History And Experiments](/c:/dev/poly-gc-react/agents/topics/difficulty/difficulty-history-and-experiments.md) for historical baselines and older experiment notes.
6. Use [Generation Difficulty](/c:/dev/poly-gc-react/agents/topics/difficulty/generation-difficulty.md) for the original design framing and suspension intent.
7. Use [Solver Paper Notes](/c:/dev/poly-gc-react/agents/topics/difficulty/solver-paper-notes.md) when you want solver-analysis context from the academic paper.
8. Use [Engine Design Notes](/c:/dev/poly-gc-react/agents/topics/difficulty/engine-design-notes.md) for engine-local design framing and future-facing cleanup ideas.
9. Use [Strategy Advice Proxy Research](/c:/dev/poly-gc-react/agents/topics/difficulty/strategy-advice-proxy-research.md) when you want public human strategy themes mapped back to the analyzer and heuristics.
