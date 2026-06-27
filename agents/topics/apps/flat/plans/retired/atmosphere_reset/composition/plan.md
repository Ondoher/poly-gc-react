# Atmosphere Composition Plan

This plan tracks the next fidelity work after the color/output bridge. The
goal is to improve the physical atmosphere inputs that feed the reference
pipeline, especially for sunset/horizon artifacts where color plumbing has
produced only incremental movement.

## Top-Level Improvements

### Rayleigh Model

Replace the current simple `lambda^-4` style scaling with a sourced Rayleigh
coefficient model. This gives us better wavelength-dependent molecular
scattering and extinction, especially across blue/green/red.

Best next action: use Bucholtz 1995 as the Rayleigh source, pin a few
visible-band coefficient or optical-depth rows, then implement a named
`bucholtz-standard-air` Rayleigh policy.

#### Rayleigh Implementation Substeps

1. Confirm the Bucholtz source data to use.
   - Done: Bucholtz 1995 Table 2 standard-air volume-scattering coefficients
     and cross sections are the first source data.
   - Done: selected Table 4 optical-depth rows are retained as secondary
     validation data for named atmosphere-column checks.
2. Decide which quantity becomes the first pinned data artifact.
   - Done: primary artifact is standard-air volume scattering coefficients in
     `1/km`, because those feed the sky-patch coefficients directly.
   - Table 4 vertical Rayleigh optical depths remain secondary validation rows
     because they also depend on a named atmosphere profile.
3. Fetch or extract the source.
   - Done: the curated source artifact records the DOI/source URL, table
     locators, extraction method, units, and exponent-expansion notes.
4. Store source data and provenance locally.
   - Done:
     `scripts/flat/atmosphere_rejected/data/composition/rayleigh/bucholtz-1995-standard-air.json`.
   - The artifact includes pinned visible rows, units, source locator,
     extraction notes, and independence notes for tests.
5. Implement named Rayleigh policies.
   - Done: `rayleigh-lambda4-preview` preserves the current behavior/control.
   - Done: `bucholtz-standard-air` evaluates the sourced Bucholtz 1995 Table 3
     formula constants from the local data artifact.
   - Done: the default policy remains `rayleigh-lambda4-preview` until the
     comparison artifact has been reviewed.
6. Add focused tests.
   - Done: source table and provenance shape
   - Done: pinned visible rows
   - Done: policy scaling behavior
   - Done: malformed data rejection
   - Done: default policy remains current unless explicitly switched
   - Done: JSON/Markdown diagnostics include the selected Rayleigh policy
7. Generate comparison artifacts.
   - Done: compare current preview Rayleigh against Bucholtz Rayleigh at
     `benchmark-5nm`, probably with `astm-g173` solar input.
   - Done: include sunset horizon in the comparison grid because that is the
     current subjective fidelity target.
   - Artifact set:
     `tmp/atmosphere-rayleigh-comparison/sunset-preview.png`,
     `tmp/atmosphere-rayleigh-comparison/sunset-bucholtz.png`, with companion
     JSON/Markdown and a local comparison README.
   - Initial center swatches: preview `#ef8000`; Bucholtz `#ff9c00`.
   - Larger review PNGs were also generated at `132x84` using the new
     `--patch-size` option: preview `#ee8300`; Bucholtz `#ff9f12`.

### Ozone Absorption

The current ozone is an approximate Chappuis-band curve. Sunset is a long
slant path, so ozone can matter for the orange/red balance.

Best next action: add a sourced ozone cross-section table and a named ozone
profile/column policy, probably keeping `300 DU` as the default column but
making the spectral absorption more real.

#### Ozone Implementation Substeps

1. Select the first cross-section source.
   - Done: use MPI-Mainz UV/VIS Spectral Atlas data for Brion 1998 ozone at
     `295 K`, wavelength range `345-829 nm`, `1 nm` spacing.
   - Source page:
     `https://www.uv-vis-spectral-atlas-mainz.org/uvvis/cross_sections/Ozone/O3.spc`.
   - Raw table URL:
     `https://www.uv-vis-spectral-atlas-mainz.org/uvvis_data/cross_sections/Ozone/O3_Brion%281998%29_295K_345-829nm%281nm%29.txt`.
   - Atlas citation DOI: `10.5194/essd-5-365-2013`.
2. Store source data and provenance locally.
   - Done:
     `scripts/flat/atmosphere_rejected/data/composition/ozone/O3_Brion-1998_295K_345-829nm_1nm.txt`.
   - Done: metadata records source URLs, temperature, range, row count,
     SHA-256, selected pinned rows, and retrieval notes.
3. Implement named ozone policies.
   - Done: `preview-chappuis` preserves the prior approximate control curve
     and remains the default.
   - Done: `brion-1998-ozone-295k` reads and validates the local Brion table,
     linearly interpolates cross sections, and returns zero outside the table
     range.
   - Current column/profile behavior still uses the existing simple `300 DU`
     column distributed by the preview vertical profile; a sourced ozone
     profile/column policy remains separate follow-up work.
4. Add focused tests.
   - Done: raw table shape, checksum, wavelength range, `1 nm` spacing,
     pinned rows, malformed data rejection, policy interpolation, default
     policy preservation, and CLI diagnostics.
5. Generate comparison artifacts.
   - Done: compare `preview-chappuis` and `brion-1998-ozone-295k` on
     `sunset.horizon` with Bucholtz Rayleigh, ASTM G-173 solar input,
     `benchmark-5nm`, `132x84`, and `--tone-map preserve-hue`.
   - Artifact:
     `tmp/atmosphere-rayleigh-comparison/sunset-bucholtz-brion-ozone-132x84-preserve-hue.png`.
   - Initial center swatches: preview ozone `#ff9811`; Brion ozone `#ff990f`.
   - Initial read: the sourced ozone table creates a measurable but subtle
     shift in this probe, slightly reducing long-red sunset radiance and
     transmittance rather than dramatically changing the image.

### Aerosol/Mie Model

This is probably the biggest sunset lever. Aerosol optical depth, Angstrom
exponent, single-scattering albedo, scale height, and phase asymmetry all
affect horizon brightness, haze, and orange/brown balance.

Best next action: define named aerosol presets rather than one hardcoded
"Earth-like" set:

- `clear-maritime`
- `clear-continental`
- `hazy-continental`
- maybe `rayleigh-only` for control

#### Aerosol Implementation Substeps

1. Select first comparison parameters.
   - Done: use compact clear-sky presets with aerosol optical depth at
     `550 nm`, Angstrom exponent, single-scattering albedo, exponential
     aerosol scale height, and Henyey-Greenstein asymmetry `g`.
   - Done: preserve the previous hardcoded behavior as
     `preview-earthlike-aerosol` instead of silently changing defaults.
   - Source families recorded: Angstrom optical-depth scaling, AERONET
     measurement/inversion precedent, and SMARTS-style explicit clear-sky
     aerosol scenario selection.
2. Store source data and provenance locally.
   - Done:
     `scripts/flat/atmosphere_rejected/data/composition/aerosol/aerosol-presets.json`.
3. Implement named aerosol policies.
   - Done: `rayleigh-only`, `preview-earthlike-aerosol`,
     `clear-maritime`, `clear-continental`, and `hazy-continental`.
   - Done: diagnostic sensitivity variants extend `clear-maritime` with
     `clear-maritime-low-aod`, `clear-maritime-low-g`,
     `clear-maritime-high-g`, `clear-maritime-shallow-aerosol`, and
     `clear-maritime-deep-aerosol`.
   - Done: CLI accepts `--aerosol-policy`.
4. Add focused tests.
   - Done: preset shape, default preservation, AOD/Angstrom coefficient
     conversion, Rayleigh-only zero aerosol, malformed data rejection, CLI
     selection, and Markdown diagnostics.
5. Generate comparison artifacts.
   - Done: generated fixed sunset comparisons under
     `tmp/atmosphere-composition-comparison/`.
   - Initial center swatches: Rayleigh-only `#665b38`, clear maritime
     `#df8c25`, clear continental `#bc7114`, hazy continental `#7e3c00`.
   - Initial read: aerosol is the strongest visual lever so far. Low-AOD,
     high-SSA, forward-scattering maritime aerosol gives the best current
     orange sunset; hazy continental is a darker/browner stress case.
   - Follow-up diagnostic read: fixed-geometry sun diagnostics show `g` is the
     strongest tested visual lever among the clear-maritime variants, while
     scale-height changes are visible but less dramatic.

### Species Diagnostics

Right now we mostly see final color/radiance. We should report per-species
contributions: Rayleigh, aerosol/Mie, ozone absorption, surface, view
transmittance, source transmittance. Then we can tell whether sunset is brown
because of aerosol absorption, too much ozone, exposure, or path geometry.

#### Species Diagnostics Implementation Substeps

1. Expose existing species optical-depth diagnostics in sky-patch center
   samples.
   - Done: diagnostic samples now include `speciesOpticalDepth` for Rayleigh,
     Mie/aerosol, and ozone where present.
2. Preserve policy provenance in JSON and Markdown.
   - Done: sky-patch outputs report Rayleigh, aerosol, ozone, and molecular
     profile policies.
3. Remaining diagnostics.
   - Open: add per-species source-path optical-depth summaries and
     single-scattering radiance summaries to the Markdown tables.

### Atmosphere Profile

Current density profiles are simple exponentials. We can improve the molecular
profile using U.S. Standard Atmosphere checkpoints or a table-backed
density/pressure profile, while keeping exponential aerosols as a named
approximation.

#### Atmosphere Profile Implementation Substeps

1. Select first molecular profile source.
   - Done: use U.S. Standard Atmosphere 1976 density-ratio checkpoints from
     the PDAS SI table, backed by NASA NTRS record `19770009539`.
2. Store source data and provenance locally.
   - Done:
     `scripts/flat/atmosphere_rejected/data/composition/profile/us-standard-atmosphere-1976-density.json`.
3. Implement named profile policies.
   - Done: `preview-exponential-8km` remains the default/control.
   - Done: `us-standard-atmosphere-1976-density` linearly interpolates the
     table-backed density ratio for molecular Rayleigh scaling.
   - Done: CLI accepts `--molecular-profile`.
4. Add focused tests.
   - Done: preview exponential behavior, table interpolation, NASA record
     provenance, unknown-policy rejection, and malformed data rejection.
5. Generate comparison artifacts.
   - Done: clear-maritime sunset comparison generated under
     `tmp/atmosphere-composition-comparison/`.
   - Initial center swatches: preview exponential `#df8c25`; U.S. Standard
     Atmosphere density `#d27d16`.

### Comparison Artifacts

Once the named policies exist, generate sunset comparison grids:

- Done: Rayleigh-only vs Rayleigh+aerosol
- Done: approximate ozone vs sourced ozone
- Done: low/medium/high aerosol optical depth
- Partially done: different aerosol phase `g` through named presets
- Done: current vs Bucholtz Rayleigh
- Done: preview exponential vs U.S. Standard Atmosphere molecular profile

Summary artifact:
`tmp/atmosphere-composition-comparison/README.md` embeds the generated images
for later visual review. It now includes both the original sunset scene FOV
and wider `72 deg` FOV comparison images generated through the sky-patch CLI's
`--fov-y-deg` override.

### Current Baseline Stack

The current best reference-proof baseline is clear enough to use for future
comparisons:

- Rayleigh: `bucholtz-standard-air`
- Aerosol: `clear-maritime`
- Ozone: `brion-1998-ozone-295k`
- Molecular profile: `us-standard-atmosphere-1976-density`
- Solar spectrum: `astm-g173`
- Wavelength grid: `benchmark-5nm`
- Tone map: `preserve-hue`

The baseline is intentionally not final Earth truth. Sun/aureole diagnostics,
high-tau labeling, and reference-comparison follow-ups are owned by
[Sun Visual Plan](../sun/sun_visual_plan.md#diagnostic-follow-ups).

## First Implementation Slice

Start with the Rayleigh model, because it is the first top-level improvement
and has a clear source candidate already identified in the reference docs. The
Rayleigh substeps above are the working checklist for this slice.

1. Done: fetch or extract clean Bucholtz 1995 visible-band Rayleigh data.
2. Done: store a local data artifact or curated table under
   `scripts/flat/atmosphere_rejected/data/composition` with source/provenance, units,
   extraction notes, and pinned rows.
3. Done: add broader tests for table shape, pinned rows, policy scaling
   behavior, malformed data, default-policy preservation, and CLI diagnostics.
4. Done: implement a named `bucholtz-standard-air` Rayleigh policy beside the
   current preview policy.
5. Done: generate a sunset comparison artifact for current preview Rayleigh vs
   Bucholtz Rayleigh before changing defaults.

Next: review the generated composition comparison summary, then decide whether
to promote the current subjective stack for reference proof runs. Remaining
model-fidelity gaps are a sourced ozone vertical profile/column policy,
external-tool or site-specific aerosol validation, water vapor/other molecular
absorbers, and multiple-scattering behavior for high-haze cases.

## Split Rule

If any top-level improvement grows past a short checklist, split it into its
own focused document inside this folder.
