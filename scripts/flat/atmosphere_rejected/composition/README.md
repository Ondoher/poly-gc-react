# Atmosphere Composition

This package-shaped script folder owns atmosphere-composition inputs for the
flat atmosphere reference work: Rayleigh, aerosol/Mie, ozone, species
diagnostics, and future profile policies.

The reference pipeline stays responsible for transport. This folder supplies
physical composition data and, later, named policy helpers that a reference
world/atmosphere adapter can consume.

## Current Data

- `../data/composition/rayleigh/bucholtz-1995-standard-air.json`: curated
  Bucholtz 1995 standard-air Rayleigh source artifact with formula constants,
  pinned volume-scattering coefficient rows, and selected optical-depth
  validation rows.
- `../data/composition/ozone/O3_Brion-1998_295K_345-829nm_1nm.txt`: raw
  MPI-Mainz UV/VIS Spectral Atlas ozone cross-section table for Brion 1998 at
  `295 K`, with local metadata and pinned validation rows in the same folder.
- `../data/composition/aerosol/aerosol-presets.json`: first named aerosol/Mie
  comparison presets for clear-sky sunset review.
- `../data/composition/profile/us-standard-atmosphere-1976-density.json`:
  table-backed U.S. Standard Atmosphere 1976 density-ratio checkpoints for
  molecular Rayleigh scaling.
- `rayleigh-policy.js`: named Rayleigh policy helper. The default remains
  `rayleigh-lambda4-preview`; `bucholtz-standard-air` is available for sourced
  comparison runs.
- `aerosol-policy.js`: named aerosol/Mie helper. `preview-earthlike-aerosol`
  preserves the former hardcoded behavior; `rayleigh-only`,
  `clear-maritime`, `clear-continental`, and `hazy-continental` are comparison
  presets.
- `ozone-policy.js`: named ozone absorption helper. The default remains
  `preview-chappuis`; `brion-1998-ozone-295k` is available for sourced ozone
  comparison runs.
- `profile-policy.js`: named molecular density-profile helper. The default
  remains `preview-exponential-8km`; `us-standard-atmosphere-1976-density` is
  available for sourced profile comparisons.
