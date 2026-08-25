# Extra-Atmosphere Reset Conclusions

This document summarizes the completed extra-atmosphere work: what changed,
what it established, why those changes were made, and which conclusions remain
qualified. It is a synthesis of the governing design and immutable evidence,
not an attempt chronology. Chronology remains in
`tmp/atmosphere/reconciliation/running-log.md`.

## Executive Conclusion

The reset successfully replaced the POC's universal coverage-resolved
celestial-radiance model with physically distinct point-irradiance and
extended-radiance paths. The accepted CPU evidence conserves source flux,
orders visibility and atmospheric transport correctly, composes in the
canonical spectral basis, and validates the result across the real San Jose
and Union Glacier scene matrix. The Sun, Moon, and Sirius source-reference
slices are bounded and independently evidenced for the claims they make.

The later ER9 production promotion attempted to copy selected typed-source,
CPU integration, and canonical-Sun contracts into production ownership. A
post-promotion audit found that its durable types used unit-suffixed scalar
properties such as
`distanceMeters`, `angularRadiusRadians`, `centerNanometers`, and
`pixelSolidAngleSteradians`. The production design requires convertible
quantities at durable boundaries to use unit-bearing value packets instead.
Record 067's `basis-rich` criterion checked the promoted scalar schema and
therefore did not detect this violation. Record 067 remains immutable evidence
of what ran and passed, but it cannot establish compliance with the production
unit-boundary rule. The user subsequently rolled back the production changes,
so record 067 is historical execution evidence and no promoted celestial
implementation from that attempt remains current.

The selected successor is a smaller additive path: build camera-independent
transported celestial contribution fields over the supported geometry domains,
then have current shader rays query those fields, complete current
raster/foreground behavior, and add `celestialRadiance` before Color. Camera
movement changes queries rather than rebuilding the fields. That path is
documented under `flat/algorithm32`; it is not implemented or accepted here.

The post-reset scene captures are presentation artifacts. Record 071 proves a
controlled day/night comparison in which the Moon distinguishes during the day
while Sirius does not, and both distinguish at night. It deliberately moves
both objects into controlled camera positions and applies a global review
exposure, so it makes no astronomical-position or real-world visibility claim.

## Problem That Was Addressed

The earlier celestial POC treated every visible object as a per-camera-ray
spectral-radiance packet with a scalar coverage value. That model conflated
several different facts:

- an unresolved star's source irradiance;
- an extended body's directional radiance;
- angular coverage inside a pixel;
- point-response energy distribution;
- geometric opacity and depth; and
- display exposure.

This caused incorrect operation ordering for stars, allowed raster controls to
change physical source energy, and made source-specific brightness tuning look
like radiometry. The reset was justified because those problems could not be
repaired by further calibration of the old universal packet.

## Changes Made

### Typed celestial source quantities

The POC introduced a discriminated external-source contract:

- point sources own spectral irradiance density in `W m^-2 nm^-1`;
- extended sources own directional spectral radiance density in
  `W m^-2 sr^-1 nm^-1`;
- typed packets retain quantity, units, spectral basis, values, provenance,
  uncertainty status, and compatibility fingerprints; and
- geometry, atmosphere, response, and display remain outside source magnitude
  ownership.

This separation was necessary because unresolved stellar flux is an angular
delta and cannot be transported as independently sampled radiance in every
neighboring camera ray.

### Exact point-source raster and transport

The point path now:

1. resolves the exact source direction and source depth;
2. tests horizon, scene, globe, and finite-body visibility at that direction;
3. evaluates atmospheric transmittance once at that direction;
4. applies a normalized point response across the full frame; and
5. divides distributed irradiance by each destination pixel's exact solid
   angle before spectral composition.

This ordering conserves flux and prevents neighboring destination pixels from
applying different atmosphere answers to already-spread stellar energy.

### Conservative extended-source integration

The extended path uses directional spherical-cap quadrature for Sun and Moon
disks. Each quadrature direction receives its own visibility and atmospheric
transmittance result. Angular coverage is produced by the integral and is not
applied again as a brightness or opacity multiplier. One conservative path is
used; no separate collapsed-disk optimization was promoted.

### Geometry, visibility, and depth separation

The reset retained returned-epoch globe ephemeris, observer transforms,
finite Moon depth, horizon behavior, scene intersections, and deterministic
depth ties. Point emitters add rather than consume shared opacity. Opaque
finite bodies may block farther sources at their exact directions.

This preserved the accepted geometry while removing brightness-weighted
candidate composition.

### Spectral frame composition and display

The CPU frame retains path, transported endpoint, extended-source,
point-source, and final spectral-radiance components. Those components remain
in the canonical 15-channel density basis until one global Color/display
conversion. No celestial source converts itself to RGB, and no accepted source
uses a source-specific exposure.

This was required to keep source facts, atmosphere transport, and review
presentation from becoming shadow owners of one another.

### Physical source references

The work established bounded reference slices for:

- the canonical production Sun packet, compared with TSIS-1 HSRS v2 over the
  represented band;
- CALSPEC Sirius, compared with independent Rieke/MSX absolute anchors; and
- the globe Moon's disk-integrated LIME model, compared with Air-LUSI and a
  qualified ROLO blue-channel supplement.

The Moon transport used in the real-scene matrix is a flux-conserving uniform
disk surrogate. It is not a resolved lunar texture, spatial BRDF, Earthshine,
or eclipse model.

### Real-scene acquisition and validation

The exact returned-epoch San Jose and Union Glacier eight-case matrix was
acquired and retained with source directions, Moon state, observer
reconstruction, and attachment identity. The accepted CPU renderer then ran
the typed source, visibility, atmosphere, integration, composition, and display
contracts together without source-specific tuning.

The real scenes were validation fixtures, not calibration targets.

### Convergence and cleanup

The selected CPU runtime profile was bounded against a higher-accuracy profile.
Superseded v1 boundary/candidate renderers, fixed-solid-angle star behavior,
authored physical star disks, inverse-display calibration, source-only
exposure, legacy aliases, and old celestial entry points were removed from the
active POC surface.

This left one accepted point/extended contract rather than parallel legacy and
replacement paths.

### Rolled-back production promotion

ER9 selected and temporarily copied the following into
`shared/algorithm32/production/` before the user rolled it back:

- typed spectral-density basis and source packets;
- point/extended external-source discrimination;
- exact perspective camera and pixel solid angle;
- exact directional visibility;
- normalized point accumulation;
- conservative extended integration;
- CPU spectral-frame evaluation and composition; and
- one canonical Sun packet across CPU lighting, descriptors, shader constants,
  and the derived visible uniform disk.

The attempt did not select assembled visible-celestial GPU/browser rendering, live
CALSPEC/LIME/Horizons acquisition, observer/background modeling, diffuse
fields, or object-specific Moon/star production acquisition.

Those copied modules no longer describe current production ownership. Record
067 remains immutable evidence of the attempted execution and audit defect;
the successor contribution cache requires its own implementation and proof.

### Post-reset review captures

Record 068 generated the first bounded CPU-only eight-scene review set. Record
070 repeated all eight cases at 384x288 native and 768x576 review resolution
using a compact-review result shape that avoided record 069's oversized
diagnostic serialization.

Record 071 added a presentation-only renderer request that can override Moon
and Sirius camera directions while retaining their physical source packets.
Compact review also gained exact Moon-free and Sirius-free counterfactual RGB.
The paired San Jose noon/night runner uses identical target pixels and one
scene-wide exposure per scene. Its maximum output-byte residuals are:

| Scene | Moon | Sirius |
| --- | ---: | ---: |
| San Jose solar noon | 29 | 0 |
| San Jose sunset plus one hour | 255 | 255 |

This establishes the intended controlled presentation behavior only.

## What Was Accomplished

| Outcome | Evidence | Conclusion |
| --- | --- | --- |
| Typed point and extended quantities | Record 033, 16/16 | Accepted in the POC claim boundary |
| Point-source conservation | Record 034, 15/15 across 252 cases | Accepted |
| Extended-source conservation | Record 040, 10/10 | Accepted one-path contract |
| Physical Sun/Sirius transport and references | Record 050, 39/39 | Accepted for the bounded CPU/source claims |
| Lunar disk-integrated reference | Record 049, 15/15 | Accepted with stated model qualifications |
| Exact real-scene acquisition | Record 054, 13/13 | Accepted |
| Eight-case physical CPU rendering | Record 056, 22/22 | Accepted pre-display physical matrix |
| Observer/background decision | Record 059, 13/13 | Explicitly out of scope; no visibility claim |
| CPU convergence and POC cleanup | Record 065, 26/26 | Accepted |
| Rolled-back production promotion execution | Record 067, reported 23/23 | Historical execution retained; implementation removed and successor cache unproved |
| High-resolution eight-scene capture | Record 070, 8/8 | Accepted review artifact, not human/observational evidence |
| Controlled day/night Moon and Sirius capture | Record 071, 10/10 | Accepted presentation mechanics only |

The central physical accomplishment is a source-to-pixel CPU pipeline whose
quantities and ordering are explicit and independently testable. The central
software accomplishment is the removal of the old universal celestial packet
from the active POC and the creation of a coherent typed CPU seam. The central
limitation is that the production copy did not honor the pre-existing durable
unit-packet rule.

## Justification For The Major Decisions

| Decision | Justification |
| --- | --- |
| Separate point irradiance from extended radiance | They are different physical measures and require different raster operations. |
| Transport point sources before spreading | Atmospheric visibility and transmittance belong to the exact source direction. |
| Normalize the point response over the frame | The raster response must distribute, not create or destroy, source flux. |
| Integrate extended disks directionally | Limb, horizon, atmosphere, and occlusion vary across angular support. |
| Keep opacity separate from source response | Point energy weight is not geometric area and point emitters do not occlude one another. |
| Retain one canonical Sun owner | Duplicate solar arrays would create inconsistent illumination, disk, CPU, and shader facts. |
| Compose spectrally before display | RGB and exposure are presentation results, not top-of-atmosphere source quantities. |
| Use real scenes only after isolated acceptance | Scene tuning would hide whether a failure belonged to source, raster, atmosphere, or display. |
| Exclude observer/background validation | No named human or camera visibility claim was selected. Physical transport does not require inventing one. |
| Leave assembled celestial GPU unselected | CPU quantities, conservation, and convergence were accepted first; the GPU slice requires its own parity gate. |
| Label controlled object placement nonastronomical | Moving an object can test presentation mechanics but cannot satisfy ephemeris or daytime-visibility claims. |

## Production Unit-Boundary Audit

The production design requires durable public, configuration, API, descriptor,
and comparable persisted boundaries to use unit-bearing packets for convertible
quantities. Examples include:

```text
distance: { value: 10, units: "meters" }
angularRadius: { value: 0.00465, units: "radians" }
wavelength: { value: 555.75, units: "nanometers" }
```

The promoted implementation instead exposes unit-suffixed numeric properties,
including:

- `verticalFovDegrees`;
- `centerNanometers`, `lowerBoundNanometers`, `upperBoundNanometers`, and
  `widthNanometers`;
- `distanceMeters` and `depthTieToleranceMeters`;
- `angularRadiusRadians`;
- `solidAngleWeightSteradians` and `pixelSolidAngleSteradians`; and
- `pathLengthMeters`.

These names are acceptable only for private scalars after a unit-bearing value
has been validated and canonicalized. They are not compliant when exposed in
production configurations, exported types, descriptors, or durable results.
A sibling string such as `wavelengthUnits: "nanometers"` does not make
`centerNanometers: number` a unit-bearing value and duplicates ownership of the
unit fact.

The promotion error came from copying reconciliation hot-path schemas too
literally and treating their unit-suffixed fields as if they remained private
canonical scalars. ER9 then verified those same shapes instead of auditing them
against the production boundary rule. The result is a proof-design defect, not
merely missing test coverage.

Current disposition:

- do not amend or rerun record 067;
- do not claim that record 067 establishes production unit-boundary
  compliance;
- treat the production changes as rolled back and preserve only their immutable
  evidence;
- apply the unit-bearing durable-boundary rule to the successor contribution
  cache without compatibility aliases; and
- require a fresh numbered production proof for that new implementation.

## Claim Boundaries And Deferred Work

The completed evidence does not establish:

- naked-eye, camera, or real-world numerical visibility;
- a complete local sky background, light pollution, airglow, glare, adaptation,
  or display-luminance model;
- assembled visible-celestial GPU/browser rendering or XA-G12 parity;
- live production acquisition from CALSPEC, LIME, or Horizons;
- additional object-specific Moon or star production radiometry;
- resolved lunar surface appearance, Earthshine, or eclipses;
- Moon/star illumination of the atmosphere, terrain, or scene;
- planets, Milky Way, zodiacal light, or other diffuse celestial fields; or
- astronomical validity for record 071's controlled camera positions.

These are separate future scopes, not missing evidence that may be inferred
from the accepted CPU transport records.

## Final Disposition

The extra-atmosphere reset achieved its observer-independent CPU physics goal:
typed source measures, conservative rasterization, correct atmosphere ordering,
spectral composition, real-scene validation, and bounded convergence. The
review captures also demonstrate the expected controlled day/night behavior.

The production promotion does not receive the same conclusion. Its
implementation was rolled back, and production currently contains no accepted
celestial implementation from record 067. The selected successor is the
camera-independent transported contribution-field cache described by
[CelestialContributionCache Design](../algorithm32/celestial-contribution-cache-design.md).
Until it is implemented and accepted by a
fresh proof, the reconciliation result remains an accepted CPU oracle rather
than a production feature.
