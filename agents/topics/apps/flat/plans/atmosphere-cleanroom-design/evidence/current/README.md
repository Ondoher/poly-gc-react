# Current Algorithm32 Evidence

This folder preserves the current non-historical evidence copied from
`tmp/atmosphere` before that temp tree may be emptied. It is a compact evidence
bundle for the accepted Algorithm32 source-abstraction, CPU soft-shader,
packet GPU shader, and Three-native integrated shader POCs.

The canonical narrative remains:

- `../../algorithm32-canonical-reference.md`
- `../../algorithm32-shader-iteration-plan.md`

This folder is supporting evidence, not a new source of design ownership.

## Included Artifacts

- `atmosflat-018-local-skydomes/`
  - Source: `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes/`
  - Preserves the accepted flat/local Sun rotation skydomes, diagnostics,
    inputs, equations/constants, criteria, and report.
- `atmosflat-019-distant-baseline/`
  - Source: `tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/`
  - Preserves the default distant-Sun source-abstraction regression evidence.
- `shader-078-cpu-local-source/`
  - Source: `tmp/atmosphere/algorithm32_shader_lab/078-cpu-local-source-integrated-render/`
  - Preserves the CPU first-order local-source integration evidence and the
    exact distant-Sun regression control.
- `shader-094-cpu-soft-shader-matrix/`
  - Source: `tmp/atmosphere/algorithm32_shader_lab/094-cpu-unified-source-driven-soft-shader-matrix/`
  - Preserves the unified CPU soft-shader oracle matrix for distant and local
    sources.
- `shader-193-packet-gpu-parity/`
  - Source: `tmp/atmosphere/algorithm32_shader_lab/193-soft-shader-capability-parity-matrix/`
  - Preserves the accepted packet-based GPU/soft-shader parity endpoint.
- `shader-220-three-local/`
  - Source: `tmp/atmosphere/algorithm32_shader_lab/220-three-native-flat-local-first-order-atmosphere/`
  - Preserves the Three-native flat/local first-order atmosphere pass evidence.
- `shader-224-live-pass-matrix/`
  - Source: `tmp/atmosphere/algorithm32_shader_lab/224-three-native-live-pass-soft-shader-matrix/`
  - Preserves the objective live-pass versus CPU soft-shader matrix evidence.
- `shader-226-production-shape/`
  - Source: `tmp/atmosphere/algorithm32_shader_lab/226-three-native-production-shape-review/`
  - Preserves the accepted Three-native production-shape review.
- `shader-227-postprocess-vs-integrated/`
  - Source: `tmp/atmosphere/algorithm32_shader_lab/227-postprocess-gpu-vs-integrated-shader-subjective-scenes/`
  - Preserves the latest visual-only postprocess GPU versus integrated shader
    comparison, including the gallery and per-case comparison files.

## Exclusions

- Superseded or historical artifact directories were not copied.
- `script-snapshot.js` files were omitted. The maintained source under
  `scripts/flat/` is the implementation reference; this bundle preserves
  evidence outputs rather than temporary script snapshots.
- Broader rejected/reset/prototype atmosphere temp folders were not copied.

## Copy Date

Copied into docs on 2026-06-25.
