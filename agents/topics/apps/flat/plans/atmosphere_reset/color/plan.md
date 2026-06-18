# Atmosphere Color Plan

This package is a post-pipeline consumer for the atmosphere reference work. It
does not own transport physics, geometry, atmospheric coefficients, or pipeline
stage behavior. It consumes completed reference output and turns spectral or
linear color diagnostics into inspectable pixels and image artifacts.

Current package boundary:

- `scripts/flat/atmosphere/data/color/cie-1931-2deg.csv` stores the official
  CIE 1931 2-degree color matching functions as a raw source artifact. Its
  sibling metadata JSON and README record DOI/source provenance, `360-830 nm`
  range, `1 nm` spacing, `471` rows, and the verified CIE-published MD5.
- `scripts/flat/atmosphere/color/spectral-color.js` owns the domain API for
  `spectralRadiance + wavelengthsNm -> CIE XYZ -> unclamped linear sRGB` using
  the official CIE table. It also keeps the analytic approximation as an
  explicitly named preview/fallback path.
- `scripts/flat/atmosphere/color/pixel-output.js` owns display exposure,
  tone mapping, output encoding, byte pixels, PPM/PNG generation, and
  display-only clamping metadata/provenance.
- `scripts/flat/atmosphere/color/solar-spectrum.js` owns named solar spectrum
  policies for sky-patch source input. It keeps `blackbody-5778k` as the
  smooth preview/control path and adds `astm-g173` as the first sourced
  extraterrestrial solar benchmark path.
- `scripts/flat/atmosphere/run-reference-probe.js` may import the
  color package as a consumer. The reference pipeline and
  `scripts/flat/atmosphere/reference/index.js` must not import or export color
  helpers.

## Goal

Strengthen output fidelity without weakening the reference pipeline boundary.
The pipeline remains the well-sourced physical truth engine. Color and pixel
output are trustworthy, explicit consumers of that output.

## Completed Improvements

1. Replace the analytic CIE preview with the official CIE 1931 2-degree color
   matching function table.
   - Source data is present and checksum-verified at
     `scripts/flat/atmosphere/data/color/cie-1931-2deg.csv`; publisher
     metadata is stored beside it.
   - `spectral-color.js` loads and validates the official `360-830 nm`, `1 nm`,
     `471` row table, interpolates linearly between table rows, contributes
     zero outside the published wavelength range, and records those policies in
     color provenance.
   - The sky-patch CLI uses the official-table path by default.
   - The analytic approximation remains only as a named preview/fallback path.

2. Add a real spectral-to-color module.
   - `spectralRadianceToXyz` converts `spectralRadiance + wavelengthsNm` to
     CIE XYZ through the official CIE table.
   - `spectralRadianceToLinearSrgb` converts CIE XYZ to unclamped linear sRGB.
   - Clamping, exposure, gamma, and byte conversion stay in `pixel-output.js`.

3. Add provenance to color packets.
   - Spectral color packets record CMF source, DOI/checksum-backed table
     metadata, interpolation/integration policy, RGB matrix, output color
     space, and clamping policy.
   - Pixel packets record source color space, output encoding, exposure policy,
     alpha policy, clamped display channels, and source color provenance.
   - Pixel-image packets summarize display policy and carry representative
     color provenance.

4. Expand color tests.
   - Spectral tests pin zero radiance, equal-energy visible radiance, narrow
     red/green/blue channel dominance, out-of-gamut negative-channel
     preservation, non-finite radiance rejection, and official CIE metadata.
   - Pixel tests pin display exposure, output encoding, clamped-channel
     metadata, source provenance, PPM output, PNG signature/chunks, and
     malformed-input failures.

5. Add explicit CLI color options.
   - `--color preview-cie|official-cie` selects the spectral color path.
   - `--encoding srgb|linear` selects pixel byte encoding.
   - `--tone-map clip|preserve-hue` selects display tone mapping.
   - `--exposure <scale>` overrides per-scene preview exposure.
   - CLI JSON records the selected color/display policy in `visual`, per-patch
     display fields, and pixel-image metadata.

6. Add PNG output after the deterministic baseline is stable.
   - PPM remains the deterministic text baseline.
   - PNG output is written from the same composed pixel packets as PPM.
   - The implementation uses Node built-ins rather than adding a new runtime
     image dependency at this boundary.

## Completed Fidelity Follow-Ups

- Add spectral-resolution controls for visual benchmarks.
  - `run-reference-probe.js --sky-patches` now accepts
    `--wavelength-grid preview-20nm|benchmark-5nm|cie-1nm`.
  - `preview-20nm` remains the default quick proof grid at `380-780 nm / 20 nm`
    with `21` samples.
  - `benchmark-5nm` provides the next benchmark-quality visible grid at
    `380-780 nm / 5 nm` with `81` samples.
  - `cie-1nm` exposes the full official CIE table domain at `360-830 nm / 1 nm`
    with `471` samples for spot checks.
  - JSON and Markdown report grid id, range, step, count, relation to the CIE
    table, and resampling policy.

- Add a sourced solar spectrum option.
  - `run-reference-probe.js --sky-patches` now accepts
    `--solar-spectrum blackbody-5778k|astm-g173`.
  - `blackbody-5778k` remains the default/control and is normalized to
    `1.87 W m-2 nm-1` at `550 nm`.
  - `astm-g173` samples the ASTM G-173 `Etr W*m-2*nm-1` extraterrestrial
    spectral irradiance column from the downloaded `ASTMG173.csv` zip artifact.
  - The ASTM zip is stored at
    `scripts/flat/atmosphere/data/color/astm-g173/astmg173.zip`, with local
    README provenance, `2002` rows, `280-4000 nm` range, nonuniform spacing,
    MD5, and SHA256.
  - The loader interpolates linearly on the nonuniform ASTM grid and returns
    zero outside `280-4000 nm`.
  - JSON and Markdown report the selected solar spectrum policy and per-patch
    provenance.

- Add display tone-mapping controls.
  - `run-reference-probe.js --sky-patches` now accepts
    `--tone-map clip|preserve-hue`.
  - `clip` remains the default for reproducible scalar-exposure artifacts.
  - `preserve-hue` applies scalar exposure, then scales all display-linear
    channels together when any channel would exceed `1`, preventing
    channel-by-channel red clipping in sunset review images.
  - Pixel packets preserve unchanged physical `linearRgb`, report
    `exposedLinearRgb`, `displayLinearRgb`, tone-map scale, prevented clip
    channels, and remaining display-only clamped channels.
  - The first Bucholtz sunset `132x84` preserve-hue artifact was generated at
    `tmp/atmosphere-rayleigh-comparison/sunset-bucholtz-132x84-preserve-hue.png`
    with center swatch `#ff9811`.

## Remaining Color Follow-Ups

These are intentionally lower priority than the next atmosphere-composition
pass. The recent wavelength-grid and solar-spectrum comparisons produced only
incremental sunset movement, which suggests the next meaningful output-fidelity
work belongs in sourced atmospheric composition rather than more display/color
plumbing.

- Improve atmospheric absorption spectra.
  - Replace the approximate Chappuis-band ozone curve with sourced ozone
    absorption cross-section data.
  - Add water vapor and oxygen visible-band absorption only when the expected
    visual impact and source data justify the extra model complexity.
  - Keep every absorber policy named and visible in diagnostics so display
    differences can be tied back to actual atmospheric inputs.

- Add broader photographic tone-mapping curves only if comparison shows a
  concrete need.
  - `preserve-hue` handles channel-clipping diagnosis, but is intentionally a
    transparent scaling policy rather than a photographic response curve.
  - Add named preview display policies such as `reinhard` or `filmic-preview`
    only as display consumers.
  - JSON/Markdown must continue to report unclamped linear RGB and any
    tone-mapping policy so display changes are not mistaken for transport
    changes.

- Add white-balance and illuminant diagnostics.
  - Report equal-energy response, D65-ish reference behavior, and any selected
    scene-white/display-adaptation assumption.
  - Use these diagnostics to explain color appearance, not to silently correct
    reference radiance.

- Add per-pixel supersampling for visual artifacts.
  - Current patch cells are single rays.
  - Add a small named sample pattern, especially for horizon/sunset patches
    where gradients change quickly.
  - Report sample count and sample pattern in artifact metadata.

- Prefer grids that align with the official CIE table when feasible.
  - Since the official CIE table is available at `1 nm`, future
    benchmark-quality spectra should either be generated on that grid or
    resampled to it with a stated policy before color integration.
  - Keep lower-resolution grids for quick preview runs.

- Add comparison artifacts.
  - Generate side-by-side reports for official CIE vs preview CIE, `20 nm` vs
    `5 nm` vs `1 nm`, blackbody Sun vs sourced solar spectrum, and selected
    display policies.
  - Treat these as evidence matrices: they should help identify whether a color
    change came from spectrum resolution, solar input, atmosphere input, or
    display mapping.

- Add more named color policies only when there is a concrete comparison need,
  such as a different observer table, illuminant convention, or tone-mapping
  experiment.
- Add PNG metadata chunks only if generated images need to be self-describing
  outside the companion JSON/Markdown artifacts.
- Add broader perceptual/tone-mapping controls after the reference atmosphere
  model itself is stronger; do not use display controls to hide missing
  transport physics.

## Non-Goals

- Do not modify atmosphere transport stages.
- Do not tune atmospheric constants to make colors look right.
- Do not hide missing physics with display exposure or clamping.
- Do not make pixels the source of truth; JSON diagnostics remain canonical.
