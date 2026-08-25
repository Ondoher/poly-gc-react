# CelestialContributionCache Reference And Evidence Dossier

Status: cache-local research inventory complete; production promotion not
started.

This document brings the external-source research, claim boundaries, and
accepted first-party oracle inventory needed by the
`CelestialContributionCache` plan into the Algorithm32 topic. Reconciliation
was the mining source. Routine cache design and planning should use this
dossier rather than reopening reconciliation documents.

This is not a production citation registry or a second source owner.
Third-party references selected by the accepted first matrix must be promoted
to `shared/algorithm32/production/references.md`; accepted experiment claims
must be promoted to `shared/algorithm32/production/evidence.md`; selected raw
fixture bytes must be promoted to their production fixture home. Until then, the
exact retained reconciliation paths below are audit inputs only and may not be
runtime imports.

## Identifier And Claim Rules

- `CCC-XR-*` identifies an external authority or versioned external data
  source in this planning dossier.
- `CCC-EV-*` identifies immutable first-party evidence. It is not an AMA
  third-party reference.
- Production code and fixtures do not cite these planning ids. They cite the
  numbered production reference or named production evidence entry created by
  the promotion phase.
- A source supports only the claim stated here. A reference for radiometric
  definitions does not accept a cache coordinate system; a source-data record
  does not accept a renderer; a Three API reference does not accept physics.
- Cache-specific coordinate reductions, interpolation policies, precision,
  packing, and performance are accepted by qualification measurements, not by
  stretching a nearby external citation.

## External Physics And Geometry References

| Id | Authority | Applicable support | Explicit limit |
| --- | --- | --- | --- |
| `CCC-XR-RAD-01` | Pharr M, Jakob W, Humphreys G. [Radiometry](https://pbr-book.org/4ed/Radiometry%2C_Spectra%2C_and_Color/Radiometry). In: *Physically Based Rendering*, 4th ed. | Distinguishes flux, irradiance, radiance, solid angle, and their spectral-density forms. Supports keeping point irradiance and extended radiance as different measures and interpreting radiance as directional density. | Does not define the Algorithm32 basis, cache coordinates, point-response kernel, or source calibration. |
| `CCC-XR-RAD-02` | Pharr M, Jakob W, Humphreys G. [Working with Radiometric Integrals](https://pbr-book.org/4ed/Radiometry%2C_Spectra%2C_and_Color/Working_with_Radiometric_Integrals). In: *Physically Based Rendering*, 4th ed. | Supports integration over solid angle and the relationship between radiance and irradiance. This is the external radiometric basis for disk integration and for converting a conserved point irradiance distribution into per-pixel radiance density. | Does not prove the selected quadrature, response policy, or finite-disk profile. |
| `CCC-XR-TRN-01` | Pharr M, Jakob W, Humphreys G. [Transmittance](https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance). In: *Physically Based Rendering*, 4th ed. This is already production reference `[1]`. | Optical-depth integration, Beer-Lambert transmittance, multiplicativity, and vacuum/zero-length invariants used by the production transport primitives. | Does not accept a cache grid or authorize applying transmittance twice. Cache construction must use the production transport owner. |
| `CCC-XR-TRN-02` | Pharr M, Jakob W, Humphreys G. [Volume Scattering Processes](https://www.pbr-book.org/4ed/Volume_Scattering/Volume_Scattering_Processes). In: *Physically Based Rendering*, 4th ed. This is already production reference `[2]`. | Nonnegative attenuation and additive extinction semantics used by the existing atmosphere implementation. | Does not calibrate the configured atmosphere or celestial sources. |
| `CCC-XR-GEO-01` | Van Oosterom A, Strackee J. [The Solid Angle of a Plane Triangle](https://doi.org/10.1109/TBME.1983.325207). *IEEE Trans Biomed Eng*. 1983;BME-30(2):125-126. | Primary source for the `2 * atan2(...)` triangle-solid-angle form used to compute a perspective pixel from two corner-ray triangles. This closes an external-citation gap found while mining reconciliation. | Production must still prove corner ordering, orientation, projection convention, positivity, and whole-frustum closure against `CCC-EV-034`. |
| `CCC-XR-CAM-01` | Pharr M, Jakob W, Humphreys G. [Camera Interface](https://www.pbr-book.org/4ed/Cameras_and_Film/Camera_Interface). In: *Physically Based Rendering*, 4th ed. | Supports the camera-to-ray separation: camera/projection state generates rays while transport evaluates radiance along those rays. | Does not itself prove camera-independent cache identity or the Algorithm32 matrix conventions. |
| `CCC-XR-LIGHT-01` | Pharr M, Jakob W, Humphreys G. [Point Lights](https://pbr-book.org/4ed/Light_Sources/Point_Lights). In: *Physically Based Rendering*, 4th ed. | Candidate support for inverse-square received measure from a compatible finite isotropic point source. | Applies only if the selected source contract owns compatible spectral intensity/power and units. It does not make the current configured local Sun a physical point source. |
| `CCC-XR-ATM-01` | Bruneton E. [Precomputed Atmospheric Scattering: A New Implementation](https://ebruneton.github.io/precomputed_atmospheric_scattering/). | Atmosphere-LUT architecture, dimensional reduction, and CPU/GPU validation precedent for a spherically symmetric atmosphere. | It is not evidence that this cache's `(h, mu)` candidate, value, interpolation, source support, or error budget is correct. Those remain Gate-A measurements. |

The ideal normalized bilinear point response is a selected renderer policy,
not a natural constant requiring an external authority. Its acceptance input
is `CCC-EV-034`. Equal-solid-angle spherical-cap quadrature and conservative
footprint treatment likewise remain first-party numerical choices backed by
`CCC-EV-040` and fresh cache qualification.

## External Celestial Source References

The retained payload root for the source rows in this section is:

```text
scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/
```

The hashes are part of source identity. Mutable aliases or freshly downloaded
bytes may not silently replace them.

### Sun

#### `CCC-XR-SUN-01`: canonical ASTM G173 extraterrestrial spectrum

- Authority: NREL-hosted *ASTM G173-03 Reference Spectra Derived from SMARTS
  v. 2.9.2*, table `ASTMG173.csv`, column `Etr W*m-2*nm-1`.
- Source page:
  [Reference Air Mass 1.5 Spectra](https://www.nrel.gov/grid/solar-resource/spectra-am1.5).
- Retained payload: `astmg173.zip`, 25,833 bytes, SHA-256
  `de6ed831cd7426d9a7147d5c0a48b1e67a483cb7f8ecd6d3ae846848154a5657`.
- Selected role: provenance for the existing accepted 15-channel Algorithm32
  solar packet. The configured Sun owner remains the sole runtime owner; the
  raw table must not create a second spectrum.

#### `CCC-XR-SUN-02`: TSIS-1 HSRS v2 independent closure

- Authority: LASP TSIS-1 Hybrid Solar Reference Spectrum v2,
  `HSRS-v2-2022EA002637`.
- Dataset: [TSIS-1 HSRS 1 nm CSV](https://lasp.colorado.edu/lisird/latis/dap/tsis1_hsrs_1nm.csv),
  dataset DOI [10.25980/ta3f-7h90](https://doi.org/10.25980/ta3f-7h90),
  paper DOI [10.1029/2022EA002637](https://doi.org/10.1029/2022EA002637).
- Retained payload: `tsis1_hsrs_1nm.csv`, 1,298,915 bytes, SHA-256
  `1cf3b07e6ac9669c429ad7ce9e92d50dfd741422efcfffa3d1e0eeb5f901616f`.
- Quantity: spectral irradiance density in `W m^-2 nm^-1`, with published
  uncertainty density; 25,281 samples span 202--2730 nm.
- Selected role: independent modern absolute-scale check on common 360--830 nm
  support. It never replaces or recalibrates the canonical per-channel Sun
  owner. The accepted conservative check treats the published uncertainty
  density as fully correlated over the common-support integral.

### Sirius and stellar validation

#### `CCC-XR-STAR-01`: STScI CALSPEC Sirius

- Authority: STScI CALSPEC `sirius_stis_005`, DOI
  [10.17909/t9-khb7-4049](https://doi.org/10.17909/t9-khb7-4049).
- Pinned payload:
  [sirius_stis_005.fits](https://archive.stsci.edu/hlsps/reference-atlases/cdbs/calspec/sirius_stis_005.fits).
- Documentation: [CALSPEC](https://www.stsci.edu/hst/instrumentation/reference-data-for-calibration-and-tools/astronomical-catalogs/calspec).
- Retained payload: `sirius_stis_005.fits`, 282,240 bytes, SHA-256
  `1349da7b8b59ad035aefea8d7948f552b41b3897d07e5ad82ca162a53af97271`.
- The mutable `current_calspec` alias is prohibited; the retained pinned path
  and hash are the source identity.
- Quantity: absolute Earth-observer spectral irradiance density. Original
  units are `erg s^-1 cm^-2 Angstrom^-1`; the accepted conversion to
  `W m^-2 nm^-1` is a factor of `0.01`. `DATAQUAL=1` rows only.
- Selected role: sole Sirius spectrum owner. Do not apply a second magnitude
  scale or infer a general catalog-star policy from this one source.

#### `CCC-XR-STAR-02`: Gaia EDR3/DR3 passband validation

- Authority: Gaia EDR3/DR3 passbands and zero points, version 2,
  [landing page](https://www.cosmos.esa.int/web/gaia/edr3-passbands), release
  paper DOI [10.1051/0004-6361/202039587](https://doi.org/10.1051/0004-6361/202039587).
- Pinned payload:
  [GaiaEDR3_passbands_zeropoints.zip](https://www.cosmos.esa.int/documents/29201/4226701/GaiaEDR3_passbands_zeropoints.zip/b03ab6ac-8b02-9850-7586-7dd7cdbc84c9?t=1603980987171).
- Retained payload: `GaiaEDR3_passbands_zeropoints_version2.zip`, 27,941
  bytes, SHA-256
  `d22a1d765a2e3e6815a9cb7e9bf0cf999c4bd1473148c0b031e57e6aac0e3b8f`.
- Response values are dimensionless despite the source ReadMe's `mag` label;
  sentinel `99.99` is undefined response and becomes flagged zero.
- Selected role: synthetic-AB validation on identical clipped 360--830 nm
  support. Packaged 25.x catalog zero points do not rescale CALSPEC physical
  flux and Gaia does not become the Sirius owner.

#### `CCC-XR-STAR-03`: Rieke et al. Sirius anchors

- Authority: Rieke et al., *Absolute Calibration. III. Improved Absolute
  Calibration for the Visible through the Mid-infrared*, DOI
  [10.3847/1538-3881/ac9f1b](https://doi.org/10.3847/1538-3881/ac9f1b).
- Retained institutional PDF:
  [download](https://openresearch-repository.anu.edu.au/bitstreams/7566b264-4d1e-48c6-92db-871815597356/download),
  1,262,848 bytes, SHA-256
  `752967e0ca7d13997824bbe2894b8bc625ddc9c4b81c02ef43545fb01039280c`.
- Visible anchor: `1.3436e-10 W m^-2 nm^-1` at 555.75 nm with standard
  uncertainty `0.0081e-10`, compared over 554.5--557 nm.
- MSX-transferred anchor: `15.20e-14 W cm^-2 micrometer^-1` at pivot
  2.1603 micrometers with standard uncertainty `0.21e-14`, fit over
  2--2.31 micrometers while excluding Brackett-gamma 2.14--2.18 micrometers.
- Selected role: these are independent absolute-scale anchors. They do not
  validate every Algorithm32 channel.

#### `CCC-XR-STAR-04`: MSX SPIRIT III response provenance

- Authority: official IRSA
  [MSX relative spectral responses](https://irsa.ipac.caltech.edu/data/MSX/docs/rsr/),
  point-source catalog v1.2.
- Retained files and SHA-256 values:
  - `msx_rsr_a.tbl`: `dcdb6d607ecd983fa0e8fbdac12c31cc2f4cd92175d77b718a9cfd18ea170f99`;
  - `msx_rsr_c.tbl`: `55abc0027286771e674245da3d6efcffc78ba9648927daa8cc0ad5f6da36ad83`;
  - `msx_rsr_d.tbl`: `935461d3c1dc7c54d0cd52c23d7acc4d6cb5699eb7ed18ec391f353ad56ab3a0`;
  - `msx_rsr_e.tbl`: `fff30ea8aa95316e2a1613f54b2b2b860f03597eb56845ab2bd8db3f4452b795`.
- Selected role: instrument provenance for Rieke's published MSX anchor. The
  cache work does not refit the published transfer from these tables.

### Moon

#### `CCC-XR-MOON-01`: release-authoritative LIME model stack

- Toolbox: ESA LIME-TBX `v1.4.1`,
  [release](https://github.com/LIME-ESA/lime_tbx/releases/tag/v1.4.1),
  [tag archive](https://github.com/LIME-ESA/lime_tbx/archive/refs/tags/v1.4.1.zip), retained
  `lime_tbx-v1.4.1.zip`, 132,331,903 bytes, SHA-256
  `2731da32927c9933a0ff728719069f4b75099ff33fe1b8c48ab5e39f9a7926b5`.
  The unsigned tag is not treated as immutable; the retained archive hash is
  authoritative.
- Coefficients: explicitly selected model `20251010_v1`,
  [LIME_MODEL_COEFS_20251010_V01.nc](https://raw.githubusercontent.com/LIME-ESA/lime_tbx/v1.4.1/coeff_data/versions/LIME_MODEL_COEFS_20251010_V01.nc),
  154,366 bytes, SHA-256
  `8e6839d95315eb2d797484be559ad70b69010cc1eb9b614770f61bb5ce2cf691`.
- Spectral reference: ASD `v2.0.0`, DOI
  [10.5281/zenodo.17332582](https://doi.org/10.5281/zenodo.17332582), embedded
  archive entry
  `lime_tbx-1.4.1/lime_tbx/business/interpolation/interp_data/assets/ds_ASD_32.nc`,
  43,488,052 bytes, SHA-256
  `360044078e42d31ff5e9dffb085f5b3bd455db30a7b46a82c4f68c96fc4b522d`.
- Governing document: LIME Model ATBD v3.3,
  [PDF](https://lime.uva.es/wp-content/uploads/2025/11/D5_LIME_ModelATBD_final.pdf),
  retained `LIME-Model-ATBD-v3.3.pdf`, 3,809,214 bytes, SHA-256
  `fc3c8e88f7c9821aa81e856cea0e5aa61e2ac43bd55b09d5b01a7758fc706598`.
- Selected role: disk-integrated lunar reflectance/model authority under the
  accepted release changelog/native-payload-order semantics for absolute phase
  angle at most 90 degrees. The fitted anchors inside the canonical interval
  are 440, 500, and 675 nm; ASD/model-assisted regions retain their stated
  qualification. It does not supply a resolved lunar texture, spatial BRDF,
  Earthshine, eclipse behavior, or a textured 3D Moon.

#### `CCC-XR-MOON-02`: NIST Air-LUSI direct measurement

- Authority: NIST Air-LUSI 2022 open data, DOI
  [10.18434/mds2-3397](https://doi.org/10.18434/mds2-3397),
  [landing page](https://data.nist.gov/od/id/mds2-3397).
- Pinned payload:
  [air_lusi_spectra.nc](https://media.githubusercontent.com/media/usnistgov/air-lusi/098c63aaee0b197054721eb7dcc4f73bfde10871/data/air_lusi_spectra.nc),
  retained as 471,191 bytes with SHA-256
  `ab428b8e91ca02cbcd4f154cb5e524dada87514447bb3384af318d255bb9459a`.
- The DOI landing page remains the citation, but its direct file endpoint
  served older prepublication bytes during acquisition; the pinned repository
  commit and retained hash above are the payload identity.
- Quantity: disk-integrated lunar spectral irradiance density in
  `microW m^-2 nm^-1`, converted to `W m^-2 nm^-1` by `1e-6` and standardized
  to 1 au Sun-Moon distance and 384,400 km observer-Moon distance.
- Selected role: decisive SI-traceable comparison for fully covered canonical
  bins 2--15. It only partially samples bin 1 and supplies no resolved surface
  radiance.

#### `CCC-XR-MOON-03`: ROLO 311g blue-bin complement

- Authority: Kieffer HH, Stone TC. ROLO 311g lunar irradiance model, DOI
  [10.1086/430185](https://doi.org/10.1086/430185), equation 10 and table 4.
- NASA-hosted retained PDF:
  [kieffer_stone_irradiance_moon_aj.pdf](https://oceancolor.gsfc.nasa.gov/SeaWiFS/On_Orbit/lcal/docs/kieffer_stone_irradiance_moon_aj.pdf),
  461,609 bytes, SHA-256
  `1666a5414916c2e38fcf34097aad3794cc1aae9d4a7d090bef2a049219316e96`.
- Selected role: qualified model-reference complement for canonical bin 1
  only, under the record's predeclared 15% blue-bin comparison tolerance. It
  does not displace Air-LUSI as the decisive measured reference; the source
  itself reports about 1% relative model precision with several-percent
  absolute-scale uncertainty.

#### `CCC-XR-NUM-01`: interpolation uncertainty oracle

- Authority: `comet-maths` 1.0.8,
  [package](https://pypi.org/project/comet-maths/1.0.8/).
- Pinned
  [source archive](https://files.pythonhosted.org/packages/fb/48/feda1a53693f790b23e9e80550d7a269b9c1d2e01d605944e6a3b02f7ad0/comet_maths-1.0.8.tar.gz),
  retained as `comet_maths-1.0.8.tar.gz`, 46,748 bytes,
  SHA-256
  `d8c245e45b62d1be79c209257018110af0c866d60016c95e0bf88b940d618e4c`.
- Selected role: independent interpolation-model uncertainty semantics and
  SciPy-compatible quadratic/cubic oracle used by the lunar calibration
  evidence. It is not a production runtime dependency or a cache
  interpolation prescription.

## External Placement And Platform References

| Id | Authority and retained identity | Applicable support | Explicit limit |
| --- | --- | --- | --- |
| `CCC-XR-STATE-01` | NASA/JPL [Horizons API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html), API v1.2, endpoint `https://ssd.jpl.nasa.gov/api/horizons.api`; [manual](https://ssd.jpl.nasa.gov/horizons/manual.html). | Provenance for the exact returned-epoch Sun/Moon directions, positions, phase, and depth in retained globe fixtures. | Live acquisition is deferred. A cache may consume configured placement without importing the acquirer. |
| `CCC-XR-WEBGL-01` | Khronos [WebGL 2.0 Specification](https://registry.khronos.org/webgl/specs/latest/2.0/). | Defines 3D/array texture operations, sized formats, and capability queries including texture dimensions/layers, fragment and combined sampler counts, draw buffers/color attachments, and fragment uniforms. | Specification minima are not a measured target-device budget. The implementation must query and report actual values and test the selected resource combination. |
| `CCC-XR-WEBGL-02` | Khronos [EXT_color_buffer_float](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/), revision 8. | Float color-renderability requirements for a source-sized preparation target when that strategy and format are selected. | It is irrelevant to a read-only cache texture unless the selected path renders into that format; extension presence and framebuffer completeness must be tested. |
| `CCC-XR-WEBGL-03` | Khronos [OES_texture_float_linear](https://registry.khronos.org/webgl/extensions/OES_texture_float_linear/), revision 5. | Capability source when a selected float format relies on hardware linear filtering. | Does not authorize assuming support. A nearest/manual interpolation route remains a separate measured candidate. |
| `CCC-XR-WEBGL-04` | Khronos [EXT_disjoint_timer_query_webgl2](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/), revision 4. | Optional nonblocking GPU-time measurement for qualification, including disjoint-result rejection. | The extension may be absent. Wall-clock and repeated-frame measurements still need a declared fallback methodology. |
| `CCC-XR-THREE-01` | three.js `0.180.0`, repository tag `r180`; locked tarball `https://registry.npmjs.org/three/-/three-0.180.0.tgz`, integrity `sha512-o+qycAMZrh+TsE01GqWUxUIKR1AL0S8pq7zDkYOQw8GqfX8b8VoCKYUoHbhiX5j+7hr8XsuHDVU6+gkQJQKg9w==`. Relevant sources: [Data3DTexture](https://github.com/mrdoob/three.js/blob/r180/src/textures/Data3DTexture.js), [DataArrayTexture](https://github.com/mrdoob/three.js/blob/r180/src/textures/DataArrayTexture.js), and [WebGLRenderTarget](https://github.com/mrdoob/three.js/blob/r180/src/renderers/WebGLRenderTarget.js). | Version-pinned wrapper behavior for candidate texture uploads and the optional preparation target. Existing production reference `[5]` covers `Data3DTexture` only and currently points at mutable `master`; promotion should pin the selected r180 source. | Three resource classes do not choose the cache grid, prove filterability/renderability, or accept CPU/GPU parity. |

## First-Party Oracle And Evidence Register

| Id | Immutable record | Accepted use by the cache plan | Must not be claimed |
| --- | --- | --- | --- |
| `CCC-EV-033` | `tmp/atmosphere/reconciliation/033-er1-typed-celestial-sources-contract/` | Discriminated point spectral irradiance and extended spectral radiance, canonical basis/source packet checks, and initial retained source provenance. | Cache coordinates, GPU representation, or production API acceptance. |
| `CCC-EV-034` | `tmp/atmosphere/reconciliation/034-er2-point-source-conservation/` | Exact corner-ray pixel solid angle, ideal normalized bilinear response, on-frame plus off-raster conservation, resolution/FOV/subpixel invariance, and point additivity over 252 cases. | A physical camera PSF, observer visibility, atmosphere transport, or cache layout. |
| `CCC-EV-040` | `tmp/atmosphere/reconciliation/040-er3-extended-source-conservation/` | Spherical-cap quadrature, uniform and limb-profile conservation, per-pixel averaging, edge loss, and resolved/collapsed convergence. | Atmosphere transport, cache interpolation, or a resolved lunar surface BRDF. |
| `CCC-EV-049` | `tmp/atmosphere/reconciliation/049-er5-lunar-physical-reference-calibration/` | Accepted LIME/Air-LUSI/ROLO disk-integrated lunar reference slice and its uncertainty/model-authority qualifications. | Textured/resolved lunar radiance, Earthshine, eclipse behavior, or production Moon ownership. |
| `CCC-EV-050` | `tmp/atmosphere/reconciliation/050-er4c-sun-sirius-physical-transport-closure/` | Exact-source point transport before response, per-direction extended transport, no destination/double transmittance, Sun/Sirius independent closure, component conservation, and one post-composition display pass. | Contribution-cache coordinates, interpolation, resource packing, or current production acceptance. |
| `CCC-EV-054` | `tmp/atmosphere/reconciliation/054-er6-globe-state-acquisition/` | Exact returned-epoch JPL Horizons geometry and retained raw-query identity for eight globe cases. | Radiometry, live deployment acquisition, display, GPU, or production. |
| `CCC-EV-056` | `tmp/atmosphere/reconciliation/056-er6-physical-globe-scene-validation/` | Eight-case Sun/Moon/Sirius physical-scene matrix, finite depth/visibility, exact source identities, conservation, and one shared display boundary. | Human/camera detectability, arbitrary source families, or a cache implementation. |
| `CCC-EV-059` | `tmp/atmosphere/reconciliation/059-er7-pre-display-claim-boundary/` | The accepted terminal claim is transported pre-display spectral radiance; display review is not observer or sky-background validation. | Visibility to a person/camera, a complete sky, or source-specific exposure. |
| `CCC-EV-065` | `tmp/atmosphere/reconciliation/065-er8-cpu-convergence-and-poc-cleanup/` | Runtime/reference path and source-transmittance convergence, point response, source quadrature, composition, and cleanup/public-surface evidence. | Evidence for the new contribution cache. Its incident-radiance cache was explicitly inactive and not applicable. |
| `CCC-EV-LOCAL-L2` | `tmp/atmosphere/local-second-order/011-local-cache-shape/`, `018-three-integrated-local-l2-probe/`, `019-three-integrated-local-l2-probe/`, and `020-three-integrated-gpu-local-l2/` | Historical evidence that a source-relative `z/rho` mapping, RGBA spectral groups, Three `Data3DTexture`, and CPU/GPU cache parity can work for the distinct local incident-radiance problem. | The celestial cache's domain, payload, interpolation, value semantics, or production packing. |
| `gpu-selected-rgba-byte-parity` | Named entry in `shared/algorithm32/production/evidence.md`. | Existing production selected-pixel display readback tolerance policy used as an input when Gate G declares its fresh cache criteria. | Cache-specific acceptance without a fresh record. |
| `gpu-perceptual-quality-metrics` | Named entry in `shared/algorithm32/production/evidence.md`. | Existing production image-quality review metric policy when performance/quality candidates need whole-image comparison. | Physical radiometry or a substitute for exact spectral/cache parity. |

Record `067` is deliberately absent from the accepted evidence table. It is a
rolled-back production attempt and cannot satisfy any successor gate. Earlier
record `042` likewise is not physical source-transport evidence.

## Cache Decisions That References Do Not Settle

| Decision | Available support | Required acceptance |
| --- | --- | --- |
| Spherical `(h, mu)` reduction | Spherical atmosphere symmetry hypothesis, current production geometry/transport, and `CCC-XR-ATM-01` as architecture precedent. | A1 error, seam, horizon, resource, and performance measurements against the accepted oracle rows. |
| Flat finite-point `(z, rho)` reduction | Horizontal-homogeneity hypothesis, `CCC-XR-LIGHT-01` when its source contract applies, and `CCC-EV-LOCAL-L2` as distinct-cache precedent. | A2 proof including exact distance law, dome policy, boundaries, interpolation, and out-of-domain behavior. |
| Flat extended `(z, mu)` reduction | Plane-parallel/top-boundary hypothesis. | A2 proof; the fixed observer-centered dome must be resolved explicitly. |
| Ideal bilinear point response | Local deterministic renderer policy accepted by `CCC-EV-034`. | A3/F parity under the production projection, pixel-center, clipping, and exact-visibility contract. It is not a claim about a physical optical PSF. |
| Extended source quadrature | `CCC-XR-RAD-02`, `CCC-EV-040`, and `CCC-EV-050`. | Fresh cache-query and foreground-depth error bounds; the cited sources do not select sample counts. |
| Interpolation and discontinuity classification | No external or reconciliation result accepts it for this cache. | Gate-A measurements at horizon, support, occultation, domain, pole, and coordinate seams. |
| Precision, texture kind, packing, and source capacity | WebGL/Three capability references and current production resource patterns. | Measured target capability, all-channel CPU/GPU parity, bytes, upload cost, and frame cost. |
| Direct lookup versus preparation shader | WebGL/Three pass/resource feasibility only. | A3 pipeline/visibility feasibility followed by A5 measured performance with provisional A4 layouts. |
| Physical configured local Sun | No accepted radius, spectral power, reference distance, falloff, or intent exists. | Keep unsupported unless a separate canonical source contract and provenance are selected. |
| Near-contact finite Moon depth | Record 056 covers its bounded scene matrix, not per-quadrature lunar surface contact depth. | Exclude near-contact claims or add a separately proved per-sample sphere-depth contract. |
| Textured 3D Moon | None of the accepted disk-integrated sources supplies resolved surface radiometry. | Follow-up design with calibrated spectral surface radiometry or reflectance, canonical illumination, geometry, orientation, and BRDF. |

## Phase Reference Map

| Plan work | Required external inputs | Required first-party inputs |
| --- | --- | --- |
| A0 common oracle and budgets | `CCC-XR-RAD-01`, `CCC-XR-RAD-02`, `CCC-XR-TRN-01`, `CCC-XR-WEBGL-01`, `CCC-XR-WEBGL-04` | `CCC-EV-033`, `CCC-EV-034`, `CCC-EV-040`, `CCC-EV-049`, `CCC-EV-050`, `CCC-EV-054`, `CCC-EV-056`, `CCC-EV-059`, and `CCC-EV-065`, each only within its stated claim |
| A1 spherical | `CCC-XR-TRN-01`, `CCC-XR-ATM-01`; selected Sun/star/Moon rows | `CCC-EV-034`, `CCC-EV-040`, `CCC-EV-049`, `CCC-EV-050`, `CCC-EV-056`, and `CCC-EV-065` |
| A2 flat | `CCC-XR-TRN-01`, conditionally `CCC-XR-LIGHT-01` | `CCC-EV-034`, `CCC-EV-040`, `CCC-EV-050`, and `CCC-EV-LOCAL-L2` as precedent only |
| A3/A5 point strategy | `CCC-XR-GEO-01`, `CCC-XR-CAM-01`, WebGL/Three rows | `CCC-EV-034`, `CCC-EV-050`, and `CCC-EV-056` plus new measurements |
| B source/contracts | Only the celestial source rows selected by the frozen first matrix; `CCC-XR-STATE-01` for retained placement fixtures | `CCC-EV-033`, `049`, `050`, `054` |
| C builder | `CCC-XR-RAD-01`, `CCC-XR-RAD-02`, `CCC-XR-TRN-01`, `CCC-XR-TRN-02`, and selected source rows | Selected promoted subsets of `CCC-EV-033`, `CCC-EV-034`, `CCC-EV-040`, `CCC-EV-049`, and `CCC-EV-050` |
| D resources | `CCC-XR-WEBGL-01` through `CCC-XR-WEBGL-04` and the exact selected r180 Three resources | New qualification and CPU/GPU packing evidence; `CCC-EV-LOCAL-L2` remains precedent only |
| E0/E1 promotion | Exact selected external rows from this dossier | Exact selected record claims and artifacts from this dossier |
| F runtime | `CCC-XR-RAD-01`, `CCC-XR-RAD-02`, `CCC-XR-GEO-01`, and `CCC-XR-CAM-01` | Promoted point, extended, transport, depth, scene, and claim-boundary evidence |
| G proof | Production numbered references after E0 and named evidence after E0/E1 | Fresh cache-specific CPU/GPU/browser record plus existing production readback policy |

## Promotion Protocol

1. A0 may read the immutable records above directly as nonproduction
   qualification oracles. Qualification must not wait for production fixture
   promotion, and production code must not import those records.
2. A6 freezes the accepted family/source/layout matrix. Contract Gate B then
   identifies the minimum external rows, raw payloads, and first-party oracle
   slices actually required.
3. E0 promotes that minimum set: numbered third-party rows into
   `references.md`, named record claims into `evidence.md`, and selected raw or
   reduced fixtures into their production fixture home with hashes rechecked.
   Retained reconciliation bytes remain immutable audit evidence, while the
   promoted path becomes the sole production fixture owner.
   Builder Gate C cannot pass until E0 is complete, although implementation and
   promotion may proceed in parallel.
4. E1 promotes the selected overlap, foreground/depth, camera-motion,
   real-scene, and display-readback fixtures after the CPU artifact is stable
   and alongside GPU resource work. Runtime Phase F waits for its applicable
   E1 rows.
5. Once promoted, the production registries are canonical. This dossier stays
   as the cache plan's source-selection and claim-boundary crosswalk; it must be
   updated to point at the production ids rather than becoming an independently
   maintained source packet.

The large retained external payloads are not copied merely to make this
document self-contained. Their exact identities, hashes, roles, and audit
paths are local here; copying only the A6-selected bytes during E0 avoids
creating duplicate unselected fixture owners.
