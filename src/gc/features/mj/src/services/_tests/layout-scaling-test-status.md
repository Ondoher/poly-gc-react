# Layout Scaling Remaining Test Ideas

Focused note for additional `layout-scaling` tests that would still be useful
after the current spec expansion.

Primary spec:

- [layout-scaling.spec.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/_tests/layout-scaling.spec.js:1)

## Completed Since Last Rewrite

- deep stack end-to-end cases now have direct coverage in
  [layout-scaling.spec.js](/c:/dev/poly-gc-react/src/gc/features/mj/src/services/_tests/layout-scaling.spec.js:1)
  including:
  - a realistic stacked multi-`z` layout through `getDebugState()`
  - a case where depth contribution forces a larger family out of hard range
- malformed metric-family integration now has direct coverage including:
  - mixed valid and malformed families in one request
  - fully malformed-family requests surfacing as unavailable generated metrics

## Still-Useful Tests

### 1. Sparse Or Extreme Bounds End-To-End Cases

Useful because bounds math now has direct unit coverage, but extreme layouts
still have limited end-to-end coverage.

- sparse layout with large coordinate gaps
- layout using negative coordinates through the full `getDebugState()` path
- layout with far-apart min/max bounds that stress final pixel-size calculation

### 2. Pathological Available-Space Aspect Ratios

Useful because width-constrained and height-constrained cases exist, but the
most skewed aspect-ratio cases are still light.

- very wide but very short available space
- very tall but very narrow available space
- cases where multiple families fit the hard range but aspect ratio pushes the
  chooser toward one clear winner

### 3. Registry-Driven Lifecycle Sequencing

Useful because the suite currently proves subscription behavior, but not much
real lifecycle sequencing.

- `start()` followed by `ready()` through a real registry setup
- service behavior before `ready()` versus after `ready()`
- cache behavior across lifecycle boundaries if that ever becomes relevant

### 4. CSS / Board Integration Coverage Later

Still useful, but not as a `layout-scaling` unit test.

- confirm the board or wrapper consumes `metricSetId` and `scale` correctly
- confirm CSS centering / placement is handled outside the service as intended
- confirm runtime CSS variable availability lines up with the metric-family
  contract exported in `layouts.css`

## Summary

The most worthwhile remaining work is:

1. sparse / extreme-bounds end-to-end cases
2. very skewed available-space aspect ratios
3. lifecycle sequencing checks

Anything beyond that should probably shift from service-level unit tests toward
board/CSS integration coverage.
