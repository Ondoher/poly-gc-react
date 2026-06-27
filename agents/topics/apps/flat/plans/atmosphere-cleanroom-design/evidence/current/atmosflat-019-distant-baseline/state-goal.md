# 001 Distant Source Abstraction Baseline

Goal: prove that Algorithm32 can receive the default distant directional Sun
through a source object while preserving the named step-032 Figure 1 sky-dome
output.

Success criteria:

- source abstraction is used by the sky-radiance path;
- only the distant directional Sun adapter is active;
- all four Figure 1 domes are generated at 320 x 320;
- generated domes match step-032 reference PNGs with maxAbsRgbDelta <= 1 and unchanged alpha;
- selected spectral radiance, sample-to-Sun transmittance, and second-order diagnostics match the copied legacy path;
- display conversion remains post-transport.

Status: accepted

Next artifact if not accepted: diagnose the first failing criterion and create
002 with the same step label or a more specific diagnostic label.
