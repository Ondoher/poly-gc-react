# Ozone Composition Data

This folder stores ozone absorption source artifacts for the atmosphere
composition package.

## Brion 1998, 295 K

- Raw data:
  `O3_Brion-1998_295K_345-829nm_1nm.txt`
- Metadata:
  `O3_Brion-1998_295K_345-829nm_1nm-metadata.json`
- Source:
  MPI-Mainz UV/VIS Spectral Atlas, O3 data set
  `O3 Brion(1998) 295K 345-829nm(1nm)`.
- Atlas citation:
  Keller-Rudek, H., Moortgat, G. K., Sander, R., and Sorensen, R.,
  Earth System Science Data, 5, 365-373, 2013,
  DOI `10.5194/essd-5-365-2013`.

The raw file is an ASCII two-column table:

```text
wavelength_nm cross_section_cm2_per_molecule
```

The first named policy should use this table to replace only the spectral
cross-section curve. The 300 DU column and current Gaussian vertical profile
remain the first comparison controls until a sourced ozone profile/column
policy is selected.
