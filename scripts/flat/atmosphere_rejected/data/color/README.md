# CIE 1931 2-Degree Color Matching Data

This folder stores source colorimetry data consumed by the atmosphere color
package. The raw CSV is intentionally kept as downloaded so checksum
verification can compare against the publisher's artifact.

## `cie-1931-2deg.csv`

- Source: https://files.cie.co.at/CIE_xyz_1931_2deg.csv
- Publisher page:
  https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer
- DOI: https://doi.org/10.25039/CIE.DS.xvudnb9b
- Dataset: CIE 1931 colour-matching functions, 2 degree observer
- Source publication noted by CIE: CIE 018:2019, Table 6
- Downloaded: 2026-06-17
- Wavelength range: 360-830 nm
- Step: 1 nm
- Rows: 471
- Published MD5: `17cca777db64b17170f06f67ce9d3ab7`
- Local verification: `Get-FileHash -Algorithm MD5` matched the published MD5

## `cie-1931-2deg-metadata.json`

- Source: https://files.cie.co.at/CIE_xyz_1931_2deg.csv_metadata.json
- Purpose: publisher metadata for provenance, citation, and future tests.

The color ingestion code treats the CSV and metadata as canonical input
artifacts, then exposes a parsed table with explicit interpolation and
integration policy.
