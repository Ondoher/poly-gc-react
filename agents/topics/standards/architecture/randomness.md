# Handling Randomness

## Core Rule

The [GC randomness overlay](../overlay.md#add-gc-randomness-domain) owns the local rule and its domain boundaries. The implementation is [`Random`](../../../../src/gc/utils/random.js).

## Seeding

GC board generation uses `boardNbr` seeds; analysis scripts also accept CLI seeds. These are GC replay inputs. See the overlay for entry-point seeding and intentional sequence resets.

## Array Operations

Utility API:

- `pickOne(list)` removes and returns one item.
- `pickPair(list)` removes and returns up to two items.
- `chooseOne(list)` returns one item without removal.
- `choosePair(list)` returns two unique items without removal.

## Distribution Helpers

The utility exposes uniform `random`/`randomInt`, curve `randomCurve`/`randomCurveRange`, and normal-style `randomNormal`/`randomNormalRange`/`randomBell` methods.

## Design Guidance

GC examples include `GameGenerator.generate(...)` and deterministic question-answering in `GameRules`. The overlay owns the orchestration boundary.

## Testing Guidance

GC scenario examples include replaying the same seed, pair uniqueness, and selected-value bounds. [Canonical testing](C:/Users/gande/.codex/documentation/standards/testing.md) and the GC overlay own the testing rules.
