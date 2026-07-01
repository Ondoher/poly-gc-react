# Bruneton Start-Fresh Source Audit

Status: reconciliation source audit for the closed Bruneton start-fresh lane.

This note classifies the start-fresh documentation, script, preserved POC copy,
and Step 032 artifact as source evidence for the reconciliation parameter
ledger. It is an audit map, not the canonical parameter ledger. The detailed
algorithm record remains
[Experiment 032 Algorithm](../plans/atmosphere-cleanroom-design/experiment-032-algorithm.md).

## Scope Inspected

Primary local evidence:

- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/legacy-reference-docs/plans/bruneton-start-fresh-prompt.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/legacy-reference-docs/plans/bruneton-start-fresh-worklog.md`
- `scripts/flat/experimental/bruneton-start-fresh.js`
- `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/`
- `tmp/atmosphere/bruneton_start_fresh/external_sources/`
- `shared/algorithm32/POC/bruneton-start-fresh/`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/experiment-032-algorithm.md`

Step 032 is the accepted start-fresh handoff candidate. It keeps the same
no-ground, no-direct-disc, no-ozone, Bruneton 2016 aerosol, 15-sample CIE,
full-sphere Fibonacci second-order path as Step 031, but replaces the fitted
display scalar with Bruneton's comparison-source value
`k = 1 / (5 * 683) = 0.00029282576866764275`.

The preserved POC copy under `shared/algorithm32/POC/bruneton-start-fresh/`
is implementation evidence. It intentionally removed source prose and artifact
generation, so the original script and artifacts remain the provenance
authority.

## Local External Files Observed

These hashes identify the local external files inspected during this audit.
They are useful handles for reconciliation, but they do not replace a full
download/extraction provenance artifact.

| File | SHA-256 |
| --- | --- |
| `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2016-clear-sky-models.pdf` | `A1220D40BC0ED6FD35E8FE728365FB5B371A615051D505DCD611F61FF22DD5C5` |
| `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2017-demo.cc` | `7E3659CDD8C23FECA988B49801029E36E201FF0701E693FEE2069B441FFA40D2` |
| `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2017-model.cc` | `5AE93AA940787F0D20DCECDEFDE3FF512D4F228C4111AA5DF3EBFDD0F952AFF2` |
| `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2017-demo.glsl` | `9267398E301B9ED6A356EF24C2A0EA2EEEC346448B361B72C2CC500AF7E9B296` |
| `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2016-page4-images/35-Im6.png` | `4D525B0E3F8A086E71E1BDE698C87D333E40C8DF42F042997CE994716A4A804E` |
| `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2016-page4-images/06-Im15.png` | `BEF2022EDFAE4EC7E8F0C345906BBBAFCE6D20C1D087FA2E90F21C0567EEFF0E` |
| `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2016-page4-images/17-Im25.png` | `D7167B2FEB1440D98387113040C079E042BFBAFF8E97ACA7929AC98AD98E7420` |
| `tmp/atmosphere/bruneton_start_fresh/external_sources/bruneton-2016-page4-images/28-Im35.png` | `2273676AF4539D658956DE452A7B07C8A588072DF3DA5BF71BDDD3ABAB79EB38` |

## Retained Baseline Sources

| Retained decision | Applicable source trail | Audit result |
| --- | --- | --- |
| Spherical Earth shell, top-atmosphere ray distance, optical-length integration, and Beer-Lambert transmittance | `bruneton-functions-glsl`; Step 032 `equations-and-constants.json`; Experiment 032 algorithm doc | Source-backed, but `functions.glsl` is cited by GitHub URL and was not found as a pinned local file under `tmp/atmosphere/bruneton_start_fresh/external_sources/`. |
| Bottom radius `6360000 m`, top radius `6420000 m`, Rayleigh scale height `8000 m`, Mie scale height `1200 m`, Rayleigh coefficient scale `1.24062e-6` | Downloaded `bruneton-2017-demo.cc`; Step 032 constants | Source-backed through Bruneton's demo source. The Rayleigh formula uses wavelength in micrometers: `beta_R(lambda_um) = 1.24062e-6 * lambda_um^-4`. |
| Active aerosol alpha `0.8`, beta `0.04`, single-scattering albedo `0.8`, and Cornette-Shanks `g = 0.7` | Bruneton 2016 clear-sky comparison paper; Step 015 fix; Step 032 `activeAerosol` | Source-backed and retained. Exact paper/source locators should be made page/table/line-specific before promotion. |
| Rayleigh and Cornette-Shanks Mie phase functions, first-order sky-radiance integrand | `bruneton-single-scattering`; Step 032 equations | Source-backed, but the cited `functions.glsl` file still needs a pinned local copy or precise production reference pointer. |
| No ozone for the Figure 1 comparison profile | `bruneton-2016-no-ozone-comparison-policy`; Step 013/015 onward; Step 032 `ozoneAbsorptionEnabled = false` | Source-backed as a comparison policy, not a general Earth claim. Needs precise Bruneton 2016 locator in the final ledger. |
| Direct solar-disc camera radiance omitted from the Figure 1 sky pass | Bruneton 2016 Figure 1 target extraction, red-cross Sun marker, and Bruneton render-time direct-sun separation | Retained for the Figure 1 target contract. Direct sunlight still illuminates scattering. If a visible solar disc is later rendered, it needs its own sourced emitter/display path. |
| Four Figure 1 views | Bruneton 2016 Figure 1 row labels; extracted tiles `35-Im6.png`, `06-Im15.png`, `17-Im25.png`, `28-Im35.png`; Step 032 scenes | Source-backed for row labels and comparison targets. Sun azimuths and red-cross centers are local measurements from extracted external tiles and need reproducible extraction/measurement metadata before promotion. |
| 15 centered wavelengths from `360 nm` to `830 nm` | Downloaded `bruneton-2017-demo.cc` passes `15` for precomputed luminance/illuminance; downloaded `bruneton-2017-model.cc` constructs centered samples from `kLambdaMin = 360`, `kLambdaMax = 830`, and `num_precomputed_wavelengths` | Source-backed for Bruneton-family RGB/display use. The 40-wavelength paper comparison path is separately source-backed but was not selected as the accepted visual baseline. |
| Solar irradiance samples used for the 15-bin table | Downloaded `bruneton-2017-demo.cc` table, documented there as ASTM G-173 ETR binned values | Source-backed through Bruneton. Reconciliation should decide whether the production ledger cites Bruneton's binned table only or also carries the official ASTM G-173 source path. |
| CIE integration, XYZ-to-linear-sRGB matrix, maximum luminous efficacy `683` | `bruneton-color-constants`; Bruneton model/display code; CIE/photometry references already listed in Algorithm32 conclusions | Source-backed. `constants.h` was not found as a pinned local external file in the start-fresh source folder, so production references should either pin it or cite official CIE/sRGB/photometry sources directly. |
| Figure 1 tone-map form and source-derived `k` | Bruneton 2016 Figure 1 caption for `1 - exp(-kL)` plus `clear-sky-models` `comparisons.cc` for `5 * MaxLuminousEfficacy`; Step 032 source-k audit | Source-backed and retained as display/comparison policy only. `comparisons.cc` was cited by URL but was not found pinned locally in the start-fresh external source folder. |
| Full-sphere second-order incoming-radiance integral shape | Bruneton 2016 discussion of incoming-direction integration for double scattering; Gonzalez Fibonacci sphere lattice source | The need for incoming-direction integration and the full-sphere sampling family are source-backed. The exact Step 032 `17` directions and `24` altitude bins are experiment choices, not external constants. |

## Supporting Or Inactive Sources

These sources are useful evidence but are not active Step 032 baseline
ingredients:

- Bruneton 2016 `40`-wavelength comparison setup. Source-backed and tested in
  Steps 023/024, but retained as validation/reference evidence rather than
  the active 15-channel runtime basis.
- Bruneton ground reflection. Downloaded `bruneton-2017-demo.glsl` sources the
  Lambertian ground term and separate Sun/sky visibility handling, but Step
  032 has ground coupling off. Step 030 is visual-equivalence evidence, not a
  production ground-bounce decision.
- Bruneton ozone constants and profile. Downloaded `bruneton-2017-demo.cc`
  sources the demo ozone path, but Step 032 disables ozone to match the
  Figure 1 comparison policy.
- Demo display exposure, white balance, and gamma path. These were explored
  earlier and are inactive for Step 032's Figure 1 comparison display.
- Fitted tone-map values `0.0002454`, `2.454`, and `2.672406`. These are
  artifact evidence only. Step 032 supersedes them with source-derived `k`.
- Direct Sun angular size and pixel-footprint filtering. Bruneton sources a
  finite solar angular radius, but the Step 017 pixel filter was rejected and
  Step 032 omits direct solar-disc camera radiance.
- Later second-order cache-coordinate experiments using `mu_s` and incoming
  `mu` bins. They are transport-coordinate evidence, but Step 032's accepted
  visual family uses the altitude/direction incident cache.

## Coverage Summary

This audit did not find an active retained Step 032 ingredient with neither an
external reference nor accepted experimental support. The remaining issues are
provenance quality issues: broad citations that need precise locators, local
measurements that need reproducible extraction metadata, script-carried
inactive constants that need to be filtered out of the promoted ledger, and
numerical controls that should be labeled as experiment-backed rather than
external constants.

In short: the current baseline appears covered for reconciliation intake, but
not yet packaged to production reference-ledger standards.
For the pure Algorithm32 transport baseline, this is enough to treat the
accepted Step 032 result as the authoritative starting point for the CPU
reference. Reconciliation should tighten the ledger and rerun evidence under
finalized parameters; it should not reopen the pure algorithm baseline unless
new evidence contradicts this audit. Future experimental lanes should use this
baseline to detect drift: deviations are valid only when the lane records the
changed ingredient, justification, and measured effect.

## Needs Precision Or Reconciliation

1. Pin or precisely reference every primary source file used by URL.
   Start-fresh locally pins `bruneton-2017-demo.cc`, `bruneton-2017-model.cc`,
   `bruneton-2017-demo.glsl`, the Bruneton 2016 PDF, and extracted Figure 1
   tiles. It does not appear to locally pin `functions.glsl`, `model.h`,
   `constants.h`, or `clear-sky-models` `comparisons.cc`, even though Step 032
   cites them.
2. Add precise locators for Bruneton 2016 paper claims. The artifacts cite the
   paper broadly for aerosol parameters, no-ozone comparison policy, Figure 1
   caption/display language, row labels, 40-wavelength comparison setup, and
   double-scattering undersampling. The reconciliation ledger should record
   page, figure, table, caption, equation, or source-line locators for each.
3. Recreate or document the Figure 1 tile extraction process. The worklog says
   page 4 tiles were extracted into `external_sources/bruneton-2016-page4-images/`,
   but the exact command/tool, source PDF checksum, tile checksums, crop boxes,
   and red-cross measurement procedure are not recorded in a machine-readable
   artifact.
4. Split active constants from script-carried inactive constants. The Step 032
   JSON still carries demo aerosol defaults, ozone constants, ground constants,
   demo exposure values, fitted `k` values, and direct-Sun constants because
   they live in the shared script object. The production ledger should promote
   only active Step 032 decisions or explicitly accepted later decisions.
5. Treat exact numerical controls as experiment-backed unless convergence
   promotes them. Start-fresh Step 032 uses `20` view-ray intervals, `10`
   sample-to-Sun intervals, `17` second-order directions, and `24` altitude
   bins. Sources justify the integration forms and sampling family, not those
   exact counts. Later Algorithm32 evidence promotes `40/20/34/48` as the
   runtime/default packet with `80/40/68/96` as validation/reference controls.
   Reconciliation should rerun the accepted visual and numerical artifacts
   under finalized counts and record any deliberate difference from Step 032.
6. Source or relabel comparison-only geometry/display values. `320 px`,
   `0.47 * size`, transparent outside-sky pixels, observer height `2 m`, and
   red-cross-derived azimuths are valid comparison artifact decisions, but
   they are not atmosphere constants.
7. Decide whether official CIE and ASTM sources become direct production
   authorities. Start-fresh can trace CIE and solar values through Bruneton
   source; the broader Algorithm32 conclusions already list official CIE and
   ASTM anchors. The production ledger should choose the canonical source path
   for each table instead of mixing implicit ownership.
8. Replace the Step 032 second-order approximation if the reconciliation CPU
   reference requires full Bruneton-style multiple scattering. Step 032's
   second-order path is source-informed and visually accepted, but it is not
   Bruneton's precomputed irradiance/scattering texture algorithm.

## Reconciliation Use

Use this audit in Phase 1 when building `parameters.md` and
`equations-and-constants.json`:

- Promote retained Step 032 constants only with per-value source trails.
- Record subjective Step 032 acceptance as the selected visual baseline, not
  as authority for unsourced values.
- Preserve Step 032 generated PNGs as visual-regression targets.
- Regenerate missing source/provenance artifacts under
  `tmp/atmosphere/reconciliation/` instead of mutating the closed
  `tmp/atmosphere/bruneton_start_fresh/` history.
