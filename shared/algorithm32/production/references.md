# Algorithm32 Production References

Use AMA-style numbered references for third-party production physics and
algorithm sources. Code comments, JSDoc comments, and JSON fixture text fields
should cite these entries with bracketed reference numbers after a short
description of the data, formula, algorithm decision, fixture expectation, or
algorithm variation being cited. Use ASCII tokens such as `[1]`, `[2]`, and
`[1][2]`, not Unicode superscripts, Markdown footnotes, or HTML citation
markup.

First-party Algorithm32 experimental evidence is not an AMA reference. Accepted
experimental scripts, records, artifacts, criteria, and run ids belong in
`evidence.md` under concise evidence names, then production prose and fixture
metadata should reference those names directly.

During the first production pass, internal experiment references may use a
short-code shorthand before the experiment code and full record locators are
collected. Add each named experiment under
`## Internal Experiment References` with a short stable code and a brief
description, then cite it in production prose, comments, or fixture metadata
with `(script <code>)`. These short-code entries are not AMA references and do
not receive bracketed numbers. Later evidence collection should preserve the
short code while adding exact script, record, artifact, criterion, and run
locators to `evidence.md` or a compact evidence pointer.

When a fixture row, expected value, implementation note, or validation claim
needs a more precise locator than the numbered AMA entry, use a compact
reference pointer object. The pointer should identify the numbered reference
entry and may include a section, equation, figure, table, row, page, local
artifact path, or short note explaining the exact cited fact. For
experimentally determined values, use either the first-pass `(script <code>)`
short-code citation or an evidence pointer to the accepted `evidence.md` name
plus the exact script, record, artifact, criterion, or run id that fixed the
value.

## Internal Experiment References

- `a32-poc-color-032` - Reconciliation POC Step 032 canonical
  atmosphere/spectral/display constants, Bruneton Figure 1 display adapter,
  CIE interpolation table, and Color-owned shader display contribution promoted
  from `scripts/flat/reconciliation/POC/src/constants/consts.js`,
  `scripts/flat/reconciliation/POC/src/color/BrunetonColorDisplayModel.js`,
  and
  `scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderContributionFactory.js`.

## Third-Party References

1. Pharr M, Jakob W, Humphreys G. Transmittance. In: *Physically Based
   Rendering: From Theory to Implementation*. 4th ed. Accessed June 29, 2026.
   https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance

2. Pharr M, Jakob W, Humphreys G. Volume Scattering Processes. In:
   *Physically Based Rendering: From Theory to Implementation*. 4th ed.
   Accessed June 29, 2026.
   https://www.pbr-book.org/4ed/Volume_Scattering/Volume_Scattering_Processes

3. Pharr M, Jakob W, Humphreys G. Phase Functions. In: *Physically Based
   Rendering: From Theory to Implementation*. 4th ed. Accessed June 29, 2026.
   https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions

4. Pharr M, Jakob W, Humphreys G. Diffuse Reflection. In: *Physically Based
   Rendering: From Theory to Implementation*. 4th ed. Accessed June 29, 2026.
   https://www.pbr-book.org/4ed/Reflection_Models/Diffuse_Reflection

5. three.js authors. Data3DTexture source documentation. Accessed July 8,
   2026.
   https://github.com/mrdoob/three.js/blob/master/src/textures/Data3DTexture.js
