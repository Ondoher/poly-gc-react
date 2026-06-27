# Bruneton Start-Fresh Base Algorithm

This folder preserves the original non-shader Algorithm32 base algorithm shape
from:

```text
scripts/flat/experimental/bruneton-start-fresh.js
```

Unlike the original experiment runner, this POC module contains only the core
final-profile algorithms and constants: Figure 1 scenes, spherical atmosphere
transport, distant Sun transmittance, first-order scattering, the original
altitude/direction second-order incident cache, fisheye sampling, and spectral
display conversion.

It intentionally omits step history, source prose, artifact generation, PNG
writing, command parsing, and `main()` runner behavior.
