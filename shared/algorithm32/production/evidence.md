# Algorithm32 Production Evidence

This file is the canonical catalog for accepted first-party Algorithm32
experimental evidence used by production constants, defaults, tolerances, and
algorithm decisions.

Evidence entries are not AMA references and should not receive bracket
citation numbers. Use concise lowercase kebab-case names in code comments,
fixture rows, design prose, and compact provenance pointers. Each accepted
entry should identify the scripts, records, artifacts, criteria, and run ids
needed to reproduce or audit the value it supports.

Generated scripts, records, screenshots, and logs are supporting evidence only
until a focused entry in this catalog accepts them for production use.

First-pass internal experiment references may start as short-code entries in
`references.md` and be cited as `(script <code>)` before the experiment code is
collected. When those experiments are promoted here, preserve the short code
and add the exact scripts, records, artifacts, criteria, and run ids needed to
audit the supported value or decision.

## Entry Shape

- `name`: stable lowercase kebab-case evidence name.
- `summary`: the production fact, value, or decision the evidence supports.
- `scripts`: relevant script names and project-relative paths.
- `records`: accepted record, artifact, criterion, and run id locators.
- `accepted`: date and reviewer/decision note when known.

## Accepted Evidence

### `gpu-selected-rgba-byte-parity`

- `summary`: GPU/browser selected-pixel readback parity against the
  `Reference` plus `Color` display path uses an 8-bit display RGBA tolerance
  of max absolute RGB byte delta `3` for deterministic selected pixels. Alpha
  remains exact unless a scene explicitly declares an alpha-composition claim.
- `scripts`:
  - `scripts/flat/reconciliation/POC/src/runners/m3IntegratedGpuObjectiveSceneComparison.js`
  - `scripts/flat/reconciliation/POC/src/runners/m4LocalFlatGpuIntegratedSelectedPixelParityProbe.js`
- `records`:
  - `tmp/atmosphere/reconciliation/085-m3-integrated-scene-selected-pixel-parity`, criterion `cpu-gpu-selected-rgba-within-3-bytes`, accepted selected-pixel max byte delta `3`.
  - `tmp/atmosphere/reconciliation/086-m3-integrated-objective-scene`, browser artifact for the accepted M3 selected-pixel gate.
  - `tmp/atmosphere/reconciliation/537-m4-local-flat-gpu-integrated-selected-pixel-parity`, accepted local/flat integrated CPU/GPU selected-pixel parity, observed max byte delta `1`; its runner tolerance `10` was an integration-probe bound, not the production baseline.
- `accepted`: production tolerance policy mined from reconciliation M3/M4 GPU
  parity evidence.

### `gpu-perceptual-quality-metrics`

- `summary`: Whole-image or controlled-region shader quality review keeps
  exact byte metrics for audit, adds Rec.709 display-luma and weighted-RGB
  proxy metrics to keep human eye sensitivity visible, and uses a
  CIEDE2000-style residual diff with threshold `1.0 Delta E 2000` as a review
  aid. These metrics guide quality/performance profile selection; they do not
  replace scene-owned pass thresholds or prove invisibility under all viewing
  conditions.
- `scripts`:
  - `scripts/flat/reconciliation/POC/src/runners/m3ShaderQualityProfileComparison.js`
- `records`:
  - `tmp/atmosphere/reconciliation/427-m3-gpu-quality-perceptual-comparison-320x180`, Rec.709 luma and weighted-RGB comparison; `balanced-cache-interp` best with mean luma delta `3.3851` and luma RMSE `4.4805`.
  - `tmp/atmosphere/reconciliation/429-m3-gpu-quality-detectable-diff-comparison-320x180`, detectable residual diff using `1.0 Delta E 2000`; `balanced-cache-interp` detectable pixels about `56.3%` and mean residual Delta E about `0.5254`.
  - `tmp/atmosphere/reconciliation/445-m3-gpu-colored-quality-detectable-diff-comparison-320x180` and `tmp/atmosphere/reconciliation/446-m3-gpu-colored-quality-diff-and-perceptual-diff-composite-320x180`, broader-color confirmation with `balanced-cache-interp` still best serious candidate, max byte delta `24`, mean byte delta `2.6715`, mean luma delta `3.4994`, detectable pixels about `56.0%`, and mean residual Delta E `0.5276`.
- `accepted`: production image/quality review metric policy mined from
  reconciliation human-visual-sensitivity evidence.
