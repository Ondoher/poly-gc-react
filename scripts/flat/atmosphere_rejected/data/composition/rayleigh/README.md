# Rayleigh Source Data

This folder stores atmosphere-composition source data for the reference proof
work. It belongs under `atmosphere/composition`, not `atmosphere/color`,
because these rows describe physical medium coefficients rather than
post-pipeline color/display conversion. The transport reference should consume
these values through a model/policy adapter rather than owning the data itself.

## Bucholtz 1995 Standard Air

`bucholtz-1995-standard-air.json` is a curated source artifact for:

- Bucholtz Table 2 standard-air Rayleigh volume-scattering coefficients in
  `1/km`
- Bucholtz Table 3 analytic formula constants for cross sections and
  volume-scattering coefficients
- selected Bucholtz Table 4 optical-depth rows for later column validation

The first pinned implementation quantity is the standard-air volume-scattering
coefficient, because the reference atmosphere model needs local scattering and
extinction coefficients by wavelength. Optical depth remains a secondary
validation quantity because it also depends on a named atmosphere profile.

The Optica table text uses repeated exponent markers visually. The JSON expands
those exponents in the pinned rows and records a per-row derivation note so
future tests can validate the source artifact without re-parsing the publisher
HTML.
