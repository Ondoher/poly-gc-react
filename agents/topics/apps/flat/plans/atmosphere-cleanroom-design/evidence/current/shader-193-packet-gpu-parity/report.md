# Milestone 29 - Soft-Shader Capability Parity Matrix

Status: accepted

Milestone 29 is the corrected soft-shader parity endpoint. It keeps the
accepted distant source shader evidence and adds the missing full-image local
source parity plus local scene-color composition parity.

Criteria: 6 passed, 0 failed.

Evidence:

- Distant full-image parity: 172-distant-soft-shader-gpu-parity
- Distant lit composition: 174-lit-scene-shader-composition
- Local full-image spectrum parity: 185-local-sun-full-image-shader-parity
- Local scene-color composition parity: 192-local-sun-scene-color-composition-parity

Cases:

- distant-high: distant-directional-sun, full-image-second-order, status=accepted, maxAbsRgbDelta=1
- distant-low: distant-directional-sun, full-image-second-order, status=accepted, maxAbsRgbDelta=1
- local-000deg: flat-local-point-sun, full-image-first-order-spectrum, status=accepted, maxAbsRgbDelta=1
- local-045deg: flat-local-point-sun, full-image-first-order-spectrum, status=accepted, maxAbsRgbDelta=1
- local-090deg: flat-local-point-sun, full-image-first-order-spectrum, status=accepted, maxAbsRgbDelta=1
- local-135deg: flat-local-point-sun, full-image-first-order-spectrum, status=accepted, maxAbsRgbDelta=1
- local-180deg: flat-local-point-sun, full-image-first-order-spectrum, status=accepted, maxAbsRgbDelta=1
- local-000deg: flat-local-point-sun, full-image-first-order-scene-color-composition, status=accepted, maxAbsRgbDelta=1
- local-045deg: flat-local-point-sun, full-image-first-order-scene-color-composition, status=accepted, maxAbsRgbDelta=1
- local-090deg: flat-local-point-sun, full-image-first-order-scene-color-composition, status=accepted, maxAbsRgbDelta=1
- local-135deg: flat-local-point-sun, full-image-first-order-scene-color-composition, status=accepted, maxAbsRgbDelta=1
- local-180deg: flat-local-point-sun, full-image-first-order-scene-color-composition, status=accepted, maxAbsRgbDelta=1
