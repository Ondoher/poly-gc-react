# ER1 External Celestial Source Fixtures

This directory retains byte-identical source/reference payloads selected by
reset phase ER1. `fixture-manifest.json` is written only after acquisition and
hash verification. Derived 15-channel values are reproducible outputs, not a
second source of truth.

- `sirius_stis_005.fits`: pinned STScI CALSPEC all-version Sirius composite.
- `GaiaEDR3_passbands_zeropoints_version2.zip`: pinned Gaia EDR3/DR3 passband
  version 2 reference used for synthetic-photometry validation.
- `astmg173.zip`: bounded copy of the already accepted ASTM G173 provenance
  payload. The canonical Algorithm32 solar channel values remain the runtime
  owner.
- `lime_tbx-v1.4.1.zip`: pinned LIME implementation tag. It contains the ASD
  v2.0.0 NetCDF byte-identical to the retained Zenodo hash.
- `LIME_MODEL_COEFS_20251010_V01.nc`: explicitly selected LIME `20251010_v1`
  coefficient payload, byte-identical to the tag entry.
- `LIME-Model-ATBD-v3.3.pdf`: governing model document. These LIME payloads
  form an ER1 research fixture only; they are not accepted lunar radiometry
  until ER5.
- `air_lusi_spectra.nc`: DOI-bearing NIST Air-LUSI 2022 open release pinned at
  its payload-changing commit. It supplies the independent SI-traceable ER5
  lunar irradiance comparison for fully covered canonical bins 2 through 15.
- `kieffer-stone-2005-rolo-311g.pdf`: NASA-hosted publication containing the
  USGS ROLO 311g equation and coefficient table. It supplies only the
  qualified model-reference complement for canonical bin 1, which Air-LUSI
  does not fully cover.
- `comet_maths-1.0.8.tar.gz`: pinned CoMet interpolation source used to define
  the linear/quadratic/cubic model-form uncertainty ensemble and validate the
  POC's SciPy-compatible interpolation weights. It is reference source, not a
  Python runtime dependency.
- `tsis1_hsrs_1nm.csv`: official TSIS-1 Hybrid Solar Reference Spectrum v2
  used only for the independent common-support canonical-Sun absolute-scale
  gate. It never replaces the canonical runtime solar packet.
- `rieke-2023-absolute-calibration-iii.pdf`: open institutional copy of Rieke
  et al. (2023), retaining the independent visible Sirius and MSX-transferred
  infrared absolute anchors used by the ER5 closure.
- `msx_rsr_[a,c,d,e].tbl`: official IRSA MSX SPIRIT III response tables kept as
  instrument provenance for the published MSX anchor. The POC does not refit
  Rieke et al.'s transfer from these tables.

Do not replace a pinned file through a mutable `current` URL. A new upstream
version requires a new filename, hash, fixture decision, and immutable record.
