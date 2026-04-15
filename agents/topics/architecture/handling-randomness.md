# Handling Randomness

Use this note when code needs random behavior but still needs to remain
reproducible, testable, or easy to reason about.

## Core Rule

Prefer the shared [`Random`](/c:/dev/poly-gc-react/src/gc/utils/random.js) utility over direct `Math.random()`.

That gives us:

- deterministic replay from a seed
- one place for random helper behavior
- clearer intent for array selection operations
- easier debugging when generation or analysis depends on choice order

## Seeding

If a flow must be reproducible, seed `Random` at the entry point for that flow.

Common examples:

- board generation seeded by `boardNbr`
- scripts seeded by an explicit CLI argument
- experiments seeded once per run before repeated random operations

Do not reseed in the middle of a flow unless resetting the sequence is the
intent.

## Array Operations

When randomness is really "pick or choose items from a list", prefer the helper
methods on `Random` instead of hand-rolled index logic.

Important distinction:

- `pick...`
  mutates the source list by removing chosen items
- `choose...`
  does not mutate the source list

Examples:

- `pickOne(list)`
  remove and return one item
- `pickPair(list)`
  remove and return up to two items
- `chooseOne(list)`
  return one item without removal
- `choosePair(list)`
  return two unique items without removal

Use the method whose mutation behavior matches the intent instead of copying an
array and then compensating for the wrong helper.

## Distribution Helpers

`Random` already includes several distribution styles. Prefer using them
directly when the choice behavior matters semantically.

- uniform:
  `random(limit)`, `randomInt(start, end)`
- bell/curve approximations:
  `randomCurve(...)`, `randomCurveRange(...)`
- normal distributions:
  `randomNormal(...)`, `randomNormalRange(...)`, `randomBell(...)`

This is better than embedding custom mini-distributions inline in feature code.

## Design Guidance

Keep the randomness boundary near orchestration code.

Good pattern:

- entry point seeds `Random`
- orchestration layer performs random selections
- lower-level helpers stay deterministic given their inputs

For example:

- `GameGenerator.generate(...)` seeds randomness
- generator helpers use `Random` to choose tiles or face groups
- `GameRules` should remain question-answering logic, not random logic

## Testing Guidance

When tests care about exact random outcomes:

- seed `Random` explicitly at the start of the spec
- assert the resulting choices or generated artifacts

When tests care only about invariants:

- assert structural guarantees instead of one exact sequence
- for example:
  - a pair contains unique items
  - generation is deterministic for the same seed
  - a chosen value remains within range

## Practical Rule Of Thumb

Before writing custom random list logic, check `Random` first.

In many cases there is already a helper that better communicates intent than:

```js
let idx = Math.floor(Random.random() * list.length);
```
