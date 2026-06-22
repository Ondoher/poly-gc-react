# ASTM G-173 Solar Spectrum Data

This folder stores the downloaded compressed ASTM G-173 reference spectra
artifact. The loader reads `ASTMG173.csv` directly from the zip so the raw
download remains the canonical source artifact.

## `astmg173.zip`

- Source page: https://www.nlr.gov/grid/solar-resource/spectra-am1.5
- Download URL:
  https://www.nlr.gov/media/docs/libraries/grid/zip/astmg173.zip?sfvrsn=1ef05e45_5
- Downloaded: 2026-06-17
- Zip entry used: `ASTMG173.csv`
- Table title: ASTM G173-03 Reference Spectra Derived from SMARTS v. 2.9.2
- Rows: 2002 spectral rows
- Wavelength range: 280-4000 nm
- Grid: nonuniform wavelength spacing
- Units: W m-2 nm-1
- Column used for sky-patch source input:
  `Etr W*m-2*nm-1`, the Gueymard 2002 extraterrestrial spectral irradiance
- Zip MD5: `f643261ed8a6ca6b6b5af4dccadb16b4`
- Zip SHA256:
  `de6ed831cd7426d9a7147d5c0a48b1e67a483cb7f8ecd6d3ae846848154a5657`

The table also contains terrestrial `Global tilt` and `Direct+circumsolar`
columns for the ASTM AM1.5 reference conditions. Those are retained in the
parsed data for diagnostics, but the current sky-patch source policy uses only
the extraterrestrial column as a top-of-atmosphere solar input.
