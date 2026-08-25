# Extra-Atmosphere Objects

This is the living research and test tracker for visible light that reaches the
renderer from outside the atmosphere. It is a current work inventory, not a
chronological log and not a replacement for numbered experiment records.

The immediate scope is the reality-configured globe path used by the Flat32 San
Jose and Union Glacier scenes. The fictional flat Moon, lunar-eclipse dark
body, and other flat-model celestial systems remain deferred. Flat-Moon
research is not an input to this globe gate.

## Current Decision

- The scoped Phase 6 extra-atmosphere source-model reset is complete.
  [Reset Design](extra-atmosphere-reset-design.md) replaces the universal
  source/pixel contract; [Reset Plan](extra-atmosphere-reset-plan.md) owns the
  new execution route.
- Algorithm32 atmosphere composition and transport are accepted, well-sourced,
  frozen inputs for this work. This tracker does not reopen atmosphere
  composition, density, scattering, cache construction, or its 15-channel
  spectral representation.
- Record `050` accepts the physically typed ER4C source-to-pixel and full-frame
  contract and completes the ER5 Sun/Moon/Sirius physical-reference exit,
  39/39. Record `049` remains the lunar XA-G09 owner.
- Point transport, one-path conservative extended integration, exact
  blockers/partial occlusion, off-raster accounting, retained component
  spectra, and one final display pass are accepted isolated inputs.
- `ER6` real-scene validation is accepted. Record 054 accepts exact returned-
  epoch acquisition, and record 056 accepts all eight physical scene cases,
  22/22. Record 059 accepts ER7's pre-display-only claim boundary, 13/13, and
  record 065 accepts ER8 CPU convergence and cleanup, 26/26. Record 067 reports
  the selected ER9 production execution as 23/23, but a later durable unit-
  boundary audit qualified its proof and the user later rolled back the
  implementation. Production conformance and the full Reset Exit remain open.
- No record-067 typed-source, CPU integration, or canonical-Sun implementation
  remains current in production. The selected successor is a camera-independent
  transported celestial contribution-field cache owned by
  [CelestialContributionCache Design](../algorithm32/celestial-contribution-cache-design.md);
  implementation and applicable GPU/browser parity are pending.
- A row advances only within its own claim layer. Geometry acceptance cannot
  accept radiometry, and a reviewable image cannot backfill a physical-source
  or raster-conservation gate.

## Document Ownership

- This document owns the active extra-atmosphere research questions, per-object
  maturity, physical gates, and candidate reference inventory.
- [Extra-Atmosphere Reset Design](extra-atmosphere-reset-design.md) owns the
  replacement architecture and source/pixel contract.
- [Extra-Atmosphere Reset Plan](extra-atmosphere-reset-plan.md) owns experiment
  order, dependencies, cleanup, and reset exit.
- [Unsourced And Partially Sourced Facts](unsourced-and-partially-sourced-facts.md)
  owns unresolved factual claims and their disposition.
- Immutable directories under `tmp/atmosphere/reconciliation/NNN-*` own
  evidence. [Reconciliation Status](status.md) owns only the current snapshot.
- `tmp/atmosphere/reconciliation/running-log.md` is the only chronology source.
- [Experimental Guidelines](experimental-guidelines.md) govern every new
  record. This tracker does not reserve record numbers.

Tracker states are `accepted`, `ready for POC`, `research`, `blocked`, and
`deferred`. `Accepted` always names the layer that the evidence actually
supports.

## Frozen Continuous Transport Boundary

At a physical direction, visible extra-atmosphere input obeys:

```text
L_final,lambda = L_path,lambda
               + T_view,lambda * L_boundary,lambda
```

This continuous law remains frozen. Its old universal discrete implementation
as one coverage-resolved boundary-radiance packet per destination camera ray
does not. Extended sources may still use directional boundary-radiance
sampling; unresolved points require exact-direction transport followed by a
separate normalized frame-aware accumulator.

Composition occurs before one global display transform. Visible Sun, Moon,
stars, planets, and diffuse celestial fields remain outside the incident-
radiance/L2 cache. Any later illumination of the atmosphere, ground, or scene
by the Moon, stars, or diffuse field is a separate source/cache project.

The equation is shared; the boundary quantity is not. An unresolved point
source owns irradiance, while an extended body or field owns directional
radiance. The raster adapter must not pretend those are interchangeable source
facts.

| Source class | Canonical top-of-atmosphere quantity | Conservative pixel adaptation |
| --- | --- | --- |
| Unresolved point source | Spectral irradiance `F_lambda` in `W m^-2 nm^-1`, on a plane normal to the incident direction | Integrate a normalized point response over pixels. With exact pixel solid angle `Omega_i` and weight `p_i`, `L_lambda,i = F_lambda p_i / Omega_i`, `p_i >= 0`, and `sum_on_frame p_i + p_off_raster = 1`; image-edge loss is reported, not renormalized. |
| Resolved extended source | Directional spectral radiance `L_lambda(omega)` in `W m^-2 sr^-1 nm^-1` | Pixel-average the angular field: `L_bar_lambda,i = integral_pixel L_lambda(omega) dOmega / Omega_i`. Coverage is part of this integral, not a later brightness multiplier. |
| Body that crosses the resolution limit | A physical angular radiance field plus its disk-integrated spectral irradiance | The resolved and collapsed paths must converge to the same integrated flux. A change of FOV or resolution must not create or destroy source energy. |
| Diffuse celestial field | Directional spectral radiance map or function `L_lambda(omega, t)` | Conservatively resample the field in its declared celestial frame and preserve surface brightness and angular integrals. |

Implementation channels must declare whether they store spectral density or
bin-integrated energy and retain the wavelength bounds and quadrature used to
move between them. A visual magnitude, RGB color, display exposure, angular
diameter, or texture byte value is not a substitute for either physical source
quantity.

## Claim Layers And Required Evidence

| Layer | Required contract | Decisive gate |
| --- | --- | --- |
| Ephemeris and geometry | One epoch-tagged world state; observer-derived topocentric direction, distance, angular size, phase or pose, finite or infinite depth, and explicit frames and units. Artificial presentation overrides are separate derived state. | Verify returned epoch and observer site; derive multiple observers from one world state; test horizon, ray/body, scene-depth, occultation, and eclipse-contact behavior. |
| Source radiometry | Point source: `F_lambda`. Extended source: `L_lambda(omega)`. A reflected body also declares a spectral BRDF `f_r,lambda` in `sr^-1`; for collimated illumination, `L_o,lambda = f_r,lambda E_i,lambda max(n dot l, 0)`. | Reconstruct the quantity from retained inputs and independently check band-integrated flux, surface brightness, or a calibrated reference without display exposure. |
| Raster integration | Exact perspective-pixel `Omega_i`; a nonnegative normalized point response; angular integration for extended disks and fields; no duplicate coverage factors. | Per-channel conservation plus resolution, FOV, field-position, subpixel-position, edge, and limb convergence. |
| Atmosphere interaction | Extended radiance transports along each contributing direction. A point source is occluded and attenuated at its exact source direction before an optical or display PSF spreads its transmitted flux. | Prove transport order with selected spectral values and an atmosphere-free control; no double transmittance, no spreading of path radiance, and no center-pixel approximation for source direction. |
| Display | One named transform after full atmosphere/celestial composition. Tone map, exposure or adaptation, gamut conversion, and output transfer are global rather than body-specific. | Retain pre-display spectral/HDR values and prove the same transform is applied to sky, Sun, Moon, and stars. Label linear and sRGB/OETF review outputs separately. |
| Observer or visibility claim | A named camera or human observer, including aperture or pupil, exposure/adaptation, optical PSF or glare, display luminance and dynamic range, and a sufficiently complete local sky background. | Validate against an independent sky-radiance, calibrated image, or observer threshold. Report automated reviewability and human review separately. |

The point-source transport seam is now decided. The current camera-ray boundary
packet remains suitable only for extended directional samples. A delta source
uses a separate post-transport point accumulator: exact source-center
visibility, exact source-direction transmittance, transmitted irradiance,
normalized response spreading into the HDR spectral frame, then one display
pass. Neighboring-pixel transmittance must not be applied to already spread
point flux.

Geometric `coverage` or opacity is not the same quantity as point-response
energy weight `p_i`. Point response does not enter the extended boundary packet:
multiple point sources add, while the finite
opaque Moon, terrain, and scene solids occlude them at the source direction.
An optical halo from an unoccluded star may overlap the Moon's image; a star
whose center ray is behind the Moon contributes no transmitted point flux.

## Object Maturity Matrix

| Object | Geometry and ownership | Source radiometry | Raster integration | CPU atmosphere evidence | Observer/display claim | GPU/production |
| --- | --- | --- | --- | --- | --- | --- |
| Real distant Sun | `accepted`: one canonical owner supplies direction, size, and spectrum | `accepted`: canonical packet passes independent TSIS closure | `accepted`: one conservative directional path; collapsed optimization absent | `accepted real matrix`: record 056 | `accepted one global display boundary`; observer claim deferred | Contribution-cache integration selected; implementation and GPU/browser parity pending |
| Globe Moon | `accepted POC geometry`: returned epoch, phase, finite center depth, horizon, and scene occlusion | `accepted disk-integrated reference`: record 049 LIME/Air-LUSI/ROLO | `accepted ER6 surrogate`: calibrated uniform finite disk; resolved spatial profile remains qualified | `accepted real matrix`: record 056 | `deferred`; artificial placement is presentation-only | Contribution-cache integration selected; object-specific production acquisition, implementation, and parity pending |
| Calibrated catalog star | `accepted bounded ER6 geometry`: fixed catalog-J2000 direction and exact occultation; apparent-place astrometry excluded | `accepted first fixture and reference`: CALSPEC Sirius plus Rieke/MSX | `accepted` normalized point response | `accepted real matrix`: record 056 | `deferred` until any observer/background claim is named | Contribution-cache integration selected; catalog acquisition, implementation, and parity pending |
| Flat32 synthetic star analogs and A-H ladder | `accepted diagnostic input`, not real identities or physical angular diameters | `research`: each retained source needs a declared SED class and normalized physical quantity | `diagnostic only`: authored disks are not physical footprints | `accepted routing mechanics` only | `no physical claim` until independently calibrated | Not selected for production radiometry or assembled GPU |
| Configured local Sun | `accepted mechanics` for finite source ownership/depth | `research`: declare radius, spectral power, reference distance, falloff, and physical/fictional intent | `research`: conserve declared source power and disk flux with distance/resolution changes | `accepted mechanics` only | `deferred` | `deferred` |
| Planet | `deferred`: classify each body as finite and resolved or conservatively collapsed at runtime | `deferred`: reflected/emitted spectral model and phase law | `deferred`: resolved/unresolved transition | `not yet tested` | `deferred` | `deferred` |
| Milky Way and other external diffuse fields | `deferred`: celestial frame, time transform, and disk-masking policy remain open | `deferred`: calibrated radiance map/spectrum and catalog-star double-count policy | `deferred`: solid-angle-conservative map sampling | `not yet tested` | `deferred` | `deferred` |
| Fictional flat Moon and eclipse dark body | Outside the current globe scope | `deferred` | `deferred` | `not applicable` to this gate | `deferred` | `deferred` |

No object-radiometry slice can be promoted merely because another row passes.
The descriptor, depth, and composition contracts may be promoted separately
only when Phase 6 explicitly chooses that smaller scope.

## Object Research Questions And Tests

### Real Distant Sun

Research:

- Keep the accepted canonical Sun packet as the sole owner of disk-integrated
  spectral irradiance; do not introduce a second visible-disk spectrum.
- Decide whether a sourced wavelength-dependent limb-darkening profile is
  required beyond the accepted normalized uniform-disk route.
- Retain exact apparent angular radius and observer direction at the returned
  epoch. Separate ephemeris accuracy from Flat32's approximate synchronization
  comparison.

Tests:

- For a uniform disk of angular radius `alpha`, verify
  `E_lambda = pi L_lambda sin(alpha)^2`; for a limb profile, numerically verify
  the corresponding disk integral.
- Conserve disk-integrated flux across resolution, FOV, field position, and
  subpixel placement; converge the limb and eclipse/occlusion boundary.
- Prove the illumination source and visible-disk provider retain one identity,
  epoch, direction, angular radius, and spectrum.
- Pass the calibrated disk through the unchanged CPU atmosphere and one global
  display transform without a Sun-only gain.

### Globe Moon

Research:

- Obtain authoritative resolution of the LIME payload/ATBD c-row order and the
  ATBD-cubic/release-linear spectral interpolation conflict exposed by record
  048, or select an unambiguous replacement reference.
- Propagate the retained coefficient covariance, ASD wavelength/phase
  correlation, and interpolation-method uncertainty into all 15 canonical
  channels without treating model-assisted regions as fitted observations.
- Treat the accepted staged Lambertian reference only as a conservation
  scaffold. Neutral `0.12` is not the real-world acceptance model.
- Retain the canonical Sun as the sole runtime owner while treating the
  quantified TSIS/canonical difference as a deterministic reference-standard
  transfer, not random uncertainty. Define BRDF/phase behavior, opposition
  behavior, roughness, and the treatment of Earthshine and eclipses.
- Decide the fidelity needed for the first accepted benchmark: disk-integrated
  phase radiometry first, then spatial albedo/texture, shared orientation, and
  terrain or normal detail.

Tests:

- Hold the accepted exact ephemeris geometry fixed while validating disk-
  integrated spectral flux at several phase angles and distances against an
  independent lunar reference.
- Verify terminator, limb, illuminated fraction, finite depth, horizon, scene
  occlusion, and Moon-over-star behavior without display tuning.
- Prove resolved and collapsed disk paths converge across resolution, FOV,
  field position, and subpixel placement.
- Use actual ephemeris direction for astronomical acceptance. An artificial
  direction can remain a labeled presentation diagnostic only.
- A real daytime-Moon visibility record must choose an epoch/location where the
  physical Moon is above the horizon; it must not rewrite the canonical
  Flat32 schedule to force that condition.

### Calibrated Stars

Research:

- Keep the accepted CALSPEC Sirius packet as the first physical point-source
  fixture, with its version/hash, wavelength grid, units, and uncertainty.
- For catalog stars without full spectra, declare the photometric passband,
  response curve, zero point, magnitude system, extinction status, and the SED
  family used to distribute band flux over Algorithm32 channels. Do not scale
  the solar spectrum uniformly by visual magnitude.
- Declare the star-direction accuracy contract: catalog frame/epoch, proper
  motion, precession/nutation, aberration, parallax when material, and whether
  atmospheric refraction is modeled or explicitly excluded.
- Choose an ideal point response for the transport proof and separately name
  any later camera, seeing, glare, or display PSF. Its angular or sensor scale
  must not silently vary with resolution.

Tests:

- Before atmosphere composition, prove in every channel that
  `sum_i L_lambda,i Omega_i = F_lambda` when fully on-frame; at an image edge,
  add the explicitly measured off-raster flux to reconstruct `F_lambda`.
- Repeat at multiple resolutions, FOVs, field positions, and subpixel offsets,
  including image edges. Test magnitude ratios against `10^(-0.4 Delta m)` in
  the passband used to define them.
- Resolve source-center scene/Moon occlusion and source-center transmittance
  before spreading the transmitted point flux.
- Run an atmosphere-free control, then the unchanged CPU atmosphere using the
  same source facts and one global display transform.
- Use a calibrated catalog star for physical validation. Flat32 synthetic
  analogs may run beside it to validate authored application behavior, but
  must retain their artificial identity and declared SED class.

### Planets And Diffuse Fields

Research and tests remain deferred until Sun, globe Moon, and one calibrated
star pass. A planet must declare its phase/radiance model and conserve flux
through the resolved-to-point transition. A diffuse field must declare its
map projection, celestial frame, spectral radiance units, resampling filter,
and how catalog stars are removed or combined to avoid double counting.

Milky Way, zodiacal light, and diffuse galactic light can be extra-atmosphere
boundary radiance when sourced as such. Airglow and aurora are atmospheric
emission; local light pollution and scene reflections are environmental
sources. Those terms must not be hidden in a star or Milky Way gain.

## Cross-Cutting Work Register

| Id | Work item | State | Completion evidence |
| --- | --- | --- | --- |
| `XA-R01` | Declare point, extended, reflected-body, and diffuse quantities, units, cosine conventions, channel integration, and uncertainty fields | `accepted` for point and extended measures; reflected/diffuse refinements follow their phases | Unit-bearing schemas and reconstructable fixture calculations |
| `XA-R02` | Select and retain versioned solar, stellar, and lunar primary/reference data | `accepted` for the first Sun/Sirius/Moon set | Source identifiers, raw snapshots or hashes, normalization notes, and uncertainty |
| `XA-R03` | Exact pixel solid angle from runtime corner rays | `accepted` | Analytic checks plus perspective-camera tests over FOV and field position |
| `XA-R04` | Normalized ideal point response, separation from geometric coverage/opacity, point-source additivity, and exact-direction transport ordering | `accepted` | Nonnegative full-response weights, explicit off-raster loss, source-center occlusion, exact-direction atmosphere ordering, and per-channel conservation |
| `XA-R05` | Conservative extended-disk integration and resolved/collapsed transition | `accepted one-path contract`: directional integration only; collapsed optimization absent | Record 050 camera matrix, conservation, off-raster, and high-order evidence |
| `XA-R06` | Source-owned visible Sun disk calibration | `accepted real-scene POC`; record 056 | Integrated disk recovers canonical source irradiance without duplicate facts or body-specific gain |
| `XA-R07` | Physical lunar reflected-radiance model | `accepted disk-integrated source reference and ER6 uniform transport surrogate`; resolved spatial radiance qualified/deferred | Records 049 and 056 |
| `XA-R08` | Real-star spectrum/passband and synthetic-star SED policy | `accepted` for CALSPEC Sirius/Rieke; broader catalog and synthetic policies remain research | One calibrated reference plus explicit policies for catalog and Flat32 synthetic sources |
| `XA-R09` | One global HDR/display transform | `accepted reset POC`; record 056 | Identical post-composition transform for sky and all bodies, retained pre-display values, labeled output transfer |
| `XA-R10` | CPU sampling convergence | `accepted selected no-Algorithm32-transport-cache operation`; record 065 | Runtime 192/128 path/source-transmittance controls bounded against 384/256; source quadrature 6x24 retained after prior acceptance. This does not refer to the new celestial contribution cache. |
| `XA-R11` | Real-world observer and complete local sky background | `deferred by accepted ER7 decision`; record 059 selects no human/camera visibility claim | Named observer/camera and independently bounded sky/background comparison if scope later expands |
| `XA-R12` | CPU/GPU parity and promotion | `contribution-cache integration selected; implementation and parity pending` | Record 067 is rolled-back historical execution evidence. The successor needs a fresh proof of exact cache construction, pre-Color shader addition, and applicable GPU/browser parity. |
| `XA-R13` | Moon/star/diffuse illumination of atmosphere or scene | `deferred` | Separate source/cache design; not part of visible boundary-radiance acceptance |
| `XA-R14` | Real-app ephemeris/source-data acquisition boundary | `accepted POC acquisition`, record 054; production acquisition remains deferred | Validated five-query state matrix, serialization, caching policy, returned-epoch checks, provenance, and stable normalized packets |

## Acceptance Gates

Every physical source record must state which gates it claims. Gates that do
not apply must be justified rather than silently omitted.

1. `XA-G01 source`: quantity, SI units, spectral/bin semantics, provenance,
   version/hash, normalization, uncertainty, and no display-derived source
   value.
2. `XA-G02 geometry`: exact epoch, coordinate frames, observer, direction,
   distance/depth, angular support, and artificial overrides clearly separated.
3. `XA-G03 raster`: exact `Omega_i`, normalized point weights or conservative
   angular integration, no double coverage, and bounded numerical residuals.
4. `XA-G04 conservation`: per-channel input and reconstructed output agree
   before atmosphere and display.
5. `XA-G05 invariance`: total accounted source result remains stable across
   named resolutions, FOVs, field positions, subpixel offsets, and support;
   on-frame loss at an image edge is measured and never renormalized away.
6. `XA-G06 transport`: exact-direction transmittance/occlusion for points;
   directional transport for extended sources; canonical composition unchanged.
7. `XA-G07 depth`: ground, authored scene solids, Moon/source overlaps, horizon,
   partial coverage, and deterministic tie-breaking behave physically.
8. `XA-G08 display`: one global transform, retained pre-display spectral/HDR
   values, no source-only exposure, and explicit output transfer.
9. `XA-G09 reference`: compare the source or disk integral with an independent
   physical reference within a tolerance derived before looking at the result.
10. `XA-G10 review`: mechanical, automated reviewability, human review, and
    physical/observational status are reported independently.
11. `XA-G11 convergence`: CPU transport/cache/source integration is bounded
    against a higher-accuracy reference profile.
12. `XA-G12 parity`: only after CPU acceptance, GPU/browser output preserves
    the same quantities, ordering, conservation, and tolerances. It was N/A to
    record 067's unselected assembled slice, but it is applicable to the newly
    selected contribution-cache shader integration. Existing GPU atmosphere
    evaluation remains independently owned.

`XA-G01` through `XA-G08` are the minimum transport gate. `XA-G09` is required
before calling a source real-world calibrated. `XA-G10` does not replace any
earlier gate. A human/camera visibility claim additionally requires `XA-R11`.

## Globe Scene Matrix

The combined proof uses the bounded real Flat32 scene snapshot, not a newly
invented terrain or camera:

| Matrix | Required cases | Claim boundary |
| --- | --- | --- |
| San Jose | Authored June date at globe sunrise, solar noon, sunset, and sunset plus one hour | Actual returned-epoch Sun/Moon geometry. Physical catalog reference sources and explicitly labeled Flat32 synthetic sources may be shown together but reported separately. |
| Union Glacier | Authored December date with San Jose's signed event offsets applied around Union's own solar noon | Offset labels are not Union-local sunrise/sunset claims. Preserve native polar-day event availability and exact returned epoch. |
| Controlled Moon | A separate San Jose-noon frame may override only Moon presentation direction while retaining named scalars | Presentation/reviewability only. It cannot satisfy ephemeris, daytime-Moon, or observational gates. |
| Physical daytime Moon | Separate epoch/location selected because the actual globe Moon is above the horizon in daylight | Required only for a real daytime-Moon claim. It supplements rather than replaces the Flat32 schedule. |

The canonical resolver and numbered record own the exact UTC instants. Do not
copy them into a second configuration in this tracker. Every case reports
source altitude, Moon altitude, returned epoch, native event availability,
named occluder, pre-display values, and the particular claim layer under test.

## Reset Execution Route

[Extra-Atmosphere Reset Plan](extra-atmosphere-reset-plan.md) is the single
owner of phase order, dependencies, stop conditions, cleanup, and promotion.
This tracker supplies the per-object `XA-R*` work items and `XA-G*` physical
gates consumed by that plan. Records `049` and `050` accept source references
and isolated transport; records 054 and 056 accept ER6 acquisition and real-
scene transport. Record 059 accepts ER7 claim selection and record 065 accepts
ER8 convergence/cleanup. Record 067 retains historical execution evidence, but
the audited implementation was rolled back. The selected contribution-cache
successor, its applicable parity gate, production conformance, and the full
Reset Exit remain open.
Use
`tmp/atmosphere/reconciliation/running-log.md` for chronology and
`tmp/atmosphere/reconciliation/NNN-*` for durable evidence; do not reconstruct
either in this tracker.

## Candidate Reference Register

This register states the current reference disposition. A numbered record must
retain the exact version, quantity, units, transform, source identifier, and
hash or immutable raw payload used.

| Need | Current reference | Open question | State |
| --- | --- | --- | --- |
| Canonical solar spectrum | Existing accepted Algorithm32 source packet plus reference-only TSIS-1 HSRS v2 | What additional references are needed beyond the accepted bounded-band absolute-scale check? | `accepted runtime owner and first independent closure` |
| Flux-calibrated star | Pinned STScI CALSPEC Sirius spectrum plus Rieke/MSX absolute anchors | What additional named fixtures are needed beyond the first accepted physical point source? | `accepted first fixture and independent closure` |
| Catalog photometry and geometry | Versioned bright-star/Gaia-style catalog plus published passband response and zero point | Which magnitude system, extinction state, epoch transforms, and uncertainties are required? | `research` |
| Lunar radiometry | Release-authoritative ESA LIME `v1.4.1`/`20251010_v1`; NIST Air-LUSI 2022 direct measurement; ROLO 311g qualified blue supplement | Resolved spatial profile and transport remain outside the disk-integrated source gate | `accepted source-reference slice`, record 049 |
| Globe ephemeris | Existing returned-epoch JPL Horizons acquisition and retained fixtures | Which normalized state fields and server acquisition boundary are promoted? | `accepted POC geometry`; deployment deferred |
| Human/camera visibility | Named CIE response functions and a separately sourced threshold or calibrated camera model | What observer, adaptation, optics, display, and sky background does the application actually claim? | `deferred` |
| Diffuse external sky | Versioned calibrated all-sky radiance map | What projection, bands, star subtraction, resolution, and license support conservative use? | `deferred` |

## Explicit Non-Goals

- Do not tune another star, Moon, or Sun-only exposure.
- Do not use an authored angular disk as a stellar diameter or as a hidden flux
  multiplier.
- Do not modify actual ephemeris state to make an object visible. Artificial
  placement remains a labeled presentation test.
- Do not reopen accepted Algorithm32 atmosphere composition to explain a
  source/raster failure.
- Do not use airglow, light pollution, or a decorative background as an
  untracked gain. Model them only in the layer that owns them.
- Do not require the deferred observer/background layer merely to accept
  wavelength-wise source conservation and atmosphere transport. Do require it
  before claiming agreement with real naked-eye or camera visibility.
- Do not infer current production ownership from record 067. The selected
  contribution-cache successor requires its own implementation, applicable
  parity/conservation gates, and fresh proof; additional object-specific scope
  remains independently selected.
