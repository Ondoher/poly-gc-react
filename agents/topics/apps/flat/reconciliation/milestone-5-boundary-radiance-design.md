# Milestone 5 Boundary Radiance Design

This document retains the accepted pre-reset mechanics and evidence for the
Milestone 5 external-boundary-radiance experiment. The active
[Extra-Atmosphere Reset Design](extra-atmosphere-reset-design.md) supersedes its
source-quantity, point/extended raster, coverage, and discrete-composition
contracts. This document does not govern new source/raster implementation.

## Starting Point

The production `flat32` globe/San Jose diagnostic showed that captured
display-style star meshes can remain visible at solar noon even after major
brightness reduction. Tuning renderer scene RGB is therefore not the accepted
fix for daylight star visibility.

The accepted direction is to stop treating visible outside-atmosphere bodies as
ordinary captured scene color. They should be sampled through a camera-ray
boundary-radiance role and composed with the atmosphere as:

```text
pathRadiance + viewTransmittance * celestialRadiance
```

## Problem To Solve

The atmosphere shader currently has a physical path-radiance and
view-transmittance model, but visible celestial bodies are still represented
like scene endpoints or background/display artifacts. That loses the
distinction between:

- atmosphere light added along the view path;
- attenuation between the camera and the outside-atmosphere body;
- the body radiance that enters from beyond the atmosphere;
- decorative or fallback display background color.

Milestone 5 adds the missing boundary: visible radiance arriving from beyond
the atmosphere along the camera ray.

## Active Design Shape

Phase 1 accepts an `ExternalBoundaryRadiance` role. It answers:

```text
what visible radiance arrives from beyond the atmosphere along this camera ray?
```

The accepted POC contract is implemented in
`scripts/flat/reconciliation/POC/src/external-boundary-radiance/` and recorded
by `tmp/atmosphere/reconciliation/002-m5-external-boundary-radiance-contract/`.

Input contains a normalized camera ray, atmosphere/geometry boundary context,
optional opaque scene-hit facts, and a selected-pixel diagnostics flag. Output
contains provider/body identity, body kind, coverage-resolved
`celestialRadiance`, apparent coverage and footprint, occlusion state, and
diagnostics.

The first proof uses the POC canonical 15-channel spectral basis under the
explicitly bounded `prototype-relative-spectral-radiance` unit label. Physical
calibration remains open; the contract does not hide that gap behind display
RGB.

The accepted composition point is `post-transport-pre-display` in every lane:

- CPU/reference remains transport-only and returns `pathRadiance` plus
  transmittance;
- CPU postprocess samples boundary radiance after `evaluate(...)` and before
  spectral composition/display conversion;
- the accepted GPU implementation samples after `evaluateTransport` and before
  `composeSceneColor`;
- the browser runner has no separate composition point outside the assembled
  shader.

No-body and scene-occluded results expose canonical zero
`celestialRadiance`. Decorative/fallback backgrounds and incident-radiance/L2
cache fields are rejected from the boundary contract. The atmosphere/transport
path still owns `pathRadiance` and `viewTransmittance`.

## Next Full Moon Foundation

The accepted prerequisite is intentionally narrow: describe the Moon phase at
a timestamp and find the next principal phase after a starting timestamp. Do
not require a general Earth-Moon-Sun state service merely to select test times.

Phase-at-time output contains signed cycle angle, illuminated fraction,
waxing/waning state, and a derived phase name. Next-phase output additionally
contains inclusive input time, event time, event kind/name/angle, search and
refinement tolerance, Horizons API/source version, exact-query identity, fetch
time, and explicit unavailable/error state.

The POC implementation is Node-only. It searches a bounded future interval
using sequential Horizons samples, brackets full phase, refines to a named time
tolerance, retains raw/query provenance, and writes deterministic local
fixtures. Browser/runtime modules never contact JPL.

For the existing browser runner, its Node runner embeds the normalized event
packet in `browser-command.json`. `browser-page/runner.js` validates and returns
the same timestamp and provenance through normal diagnostics. This is a
contract/parity test only; it creates no Three scene.

### Real Application Design

The public browser calls an application-owned endpoint:

```text
GET /api/moon/phase?at=<ISO time>
GET /api/moon/events/next?after=<ISO time>&phase=<name>
  -> validated/versioned event cache
  -> sequential Horizons search on cache miss
```

The server bounds and validates `after`, never exposes a general Horizons
proxy, serializes outbound calls, caches normalized results, preserves exact
query/API/raw-response provenance, and returns the same stable packet used by
POC fixtures. It explicitly reports stale, unavailable, malformed-upstream, and
unsupported-request states. The browser never contacts Horizons directly.

Record `006-m5-moon-phase-contract` accepts this boundary. It resolves the June
2024 full Moon as `2024-06-22T01:08:30.083Z` at a named one-minute search
tolerance and passes identical normalized packets through the existing browser
runner without a Three scene. Record 005 remains the rejected expectation-fix
predecessor.

General Moon position/state acquisition remains a later capability to add only
when physical globe-Moon placement requires it. It is not a prerequisite for
the next-full-Moon resolver.

## Accepted Globe Moon Physical State

Record `008-m5-globe-moon-state-contract` now supplies that later capability
for the selected G0 event. Canonical state uses Earth-centered ecliptic J2000
Moon/Sun vectors in kilometers and kilometers/second. Observer state remains
separate and is derived/validated from topocentric vectors in the same frame.

The physical Moon is an opaque sphere of radius `1737.4 km`. Shared geometry
derives direction, distance, angular radius, phase angle, illuminated fraction,
and ray/sphere hit distance. Finite Moon depth can therefore precede infinite
star depth without using a display mask. The conventional opposition event is
not forced to exactly 100% illumination; the retained San Jose state derives
`0.9978002611122996` because lunar latitude prevents exact Sun-Earth-Moon
coplanarity.

Node and the existing browser runner return identical observation and ray
results. This acceptance creates no Three scene and performs no atmosphere or
radiance composition.

## Accepted External Celestial Depth Contract

Record `009-m5-external-celestial-depth-contract` defines candidates with body
identity/kind, hit state, finite or infinite distance, opacity, pixel coverage,
canonical 15-channel radiance, footprint, and provenance. Candidates are not
final boundary samples: `ExternalCelestialDepthResolver` owns ordering,
masking, scene occlusion, and front-to-back coverage resolution, after which
the existing `ExternalBoundaryRadiance` contract validates the result.

Finite candidates sort by ascending distance, infinite candidates sort last,
and body id breaks equal-depth ties. Opaque coverage reduces remaining
transmission. A nearer opaque scene hit produces canonical scene-occluded zero
radiance. The G1 Moon adapter derives its finite hit from its physical sphere,
not an observer-dependent display mask. CPU and browser packets are identical;
the contract remains independent of Three, atmosphere transport, caches,
background RGB, and bitmap rendering.

## Source-Owned Visible Bodies

Record `010-m5-source-owned-sun-disk-contract` accepts the first source-owned
visible bodies. `DistantSunLightSource` exposes an infinite angular-disk
candidate; `LocalSunLightSource` exposes a finite ray/sphere candidate from its
source key, position, radius, distance policy, and spectrum. Both derive
uniform-disk spectral radiance by dividing source incident radiance by
`pi * sin(angularRadius)^2`, retain a linear subpixel edge-coverage policy, and
flow through the accepted G2 depth resolver and Phase 1 packet. Diagnostics
retain the source owner, hit facts, coverage, calibration policy, and resolved
contribution. This adds no display RGB, duplicate Sun configuration, Three
scene, or bitmap dependency.

Implementation first targets the reality-configured globe Moon after the
next-full-Moon resolver is accepted. Flat-Moon variants remain later work under
[Flat-Earth Moon Model Research](moon-model-research.md).

A light source may expose a companion visible-body provider for its own visible
disk. The first required case is the Sun disk.

The light source remains the canonical owner of source facts:

- direction or position;
- spectrum or radiance calibration;
- angular size or physical radius;
- source-path or distance semantics;
- any source identity needed by cache or shader setup.

The visible-body provider adapts those facts for camera-ray visibility. It does
not duplicate source ownership.

## Shared Celestial Path

Visible stars, Moon, planets, and Sun disks share the continuous atmosphere
composition law, but the reset gives point and extended sources separate
discrete integration paths:

- Sun disk: companion provider from the light source.
- Stars: point spectral irradiance plus exact-source transport and a normalized
  post-transport accumulator.
- Moon: the accepted finite globe-body provider with its own radiance, angular
  footprint, depth, and occultation policy.
- Planets: later body providers using the same contract with their own
  radiance and footprint policies.
- Milky Way: follow-on diffuse boundary-radiance field with extended angular
  surface brightness rather than point-star footprint policy.

The active architecture lives in
[Extra-Atmosphere Reset Design](extra-atmosphere-reset-design.md), execution in
[Extra-Atmosphere Reset Plan](extra-atmosphere-reset-plan.md), and the object
inventory/gates in [Extra-Atmosphere Objects](extra-atmosphere-objects.md).
Algorithm32 atmosphere ownership remains unchanged.

None of these visible bodies should be folded into the incident-radiance/L2
cache for this proof. Optional sky illumination from Moon or starfield
radiance remains a later source/cache design.

### Star implementation audit

Records 013, 015, and 016 did not fulfill this star design. Their
celestial contribution bound one active candidate, used by the Moon;
the Three star points in records 013, 015, and 016 are depth-only scaffolding
with `colorWrite: false`. They prove object presence/depth configuration but
provide no visible star radiance and cannot exercise multiple simultaneous
stars or Moon-over-star occultation in the rendered image.

Two existing Flat precedents are relevant but must be adapted rather than
runtime-linked:

- The Flat app owns a compact fixture of 129 named stars with stable ids, J2000
  right ascension/declination, visual magnitude, and source tags. This is the
  preferred source shape for deterministic catalog-star identity and direction.
- The Algorithm32 shader-lab procedural field models apparent magnitudes from a
  bounded distribution, converts magnitude relative to the Sun into spectral
  flux, divides by pixel solid angle, applies a point-spread footprint, limits
  stars to sky rays, multiplies by view transmittance, and composes before the
  shared tone map. Its accepted display controls were `intensity: 1`,
  `density: 1.15`, and `pointSize: 1.15`, although fixed-exposure PNGs placed
  that contribution below practical visibility.

The procedural implementation is useful math/provenance, not the final
contract: it converts the star contribution to XYZ/linear RGB before final
composition and its density/size controls are display POC values. The
reconciliation implementation must instead preserve each selected star's
15-channel top-of-atmosphere radiance through
`pathRadiance + transmittance * celestialRadiance`, use pixel-solid-angle and
point-spread coverage explicitly, and let the celestial depth resolver mask
stars behind the finite Moon. A bounded POC-local catalog snapshot may be
copied with provenance; active code must not runtime-link Flat or production.

Record `018-m5-visible-catalog-stars` proves the first visible implementation
and candidate/occultation mechanics. It snapshots Sirius, Canopus, Vega, and Polaris and derives
each 15-channel top-of-atmosphere spectrum from visual magnitude relative to
the Sun, divided by the named pixel-solid-angle estimate. A documented
prototype exposure multiplier makes the point samples reviewable at the
current fixed display exposure; it remains calibration debt rather than a
physical constant. Four candidates resolve simultaneously. Its noon conclusion
is superseded because the labeled source vector put the Sun only about 11.5
degrees above the horizon. Record 019 preserves the corrected-altitude run
rejected for excessive daytime star exposure. Fresh record 020 accepts the
corrected solar altitudes and calibrated day/night visibility: Canopus and Vega
remain visible at true night, the sampled stars are buried at noon, and Sirius
shares the Moon direction and is masked by the finite opaque Moon. Record 017
is preserved rejected because its first noon criterion compared against
nonlocal zenith sky.

Record 020 remains accepted evidence for candidate binding, simultaneous-star
composition, tuned review visibility, local noon/night comparison, and finite
Moon occultation. It is not accepted stellar radiometry. Record
`029-m5-flat32-celestial-physical-validity-audit` shows that record 020's
`0.009 rad` uniform top-hat footprint, fixed `1.6e-5 sr` divisor, and star-only
`2500` exposure imply about `39760.5x` the magnitude-derived integrated flux.
That review calibration must not be copied into a physical point-source path
or used as production input.

Record `011-m5-controlled-celestial-samples-contract` accepts the synthetic
proof provider. It supplies explicit 15-channel dim stars, bright stars, a
finite opaque bright body, and empty rays without captured RGB or decorative
background ownership. Finite distance orders first; equal-depth candidates
use the deterministic class order Sun, Moon/planet disk, star, then diffuse
field, followed by body id. Noon, sunset, and post-sunset fixtures establish
unattenuated inputs and overlap behavior. They do not claim daylight
visibility; atmosphere transport decides that in Phase 4.

Record `012-m5-cpu-celestial-atmosphere-composition` accepts the CPU
integration seam. `CpuPostprocessSoftShader` may resolve a canonical external
boundary sample for a no-hit ray and uses its coverage-resolved 15-channel
celestial radiance as the endpoint in
`pathRadiance + viewTransmittance * celestialRadiance`. No-body and occluded
samples carry zero celestial radiance, so they preserve path radiance.

The first visibility diagnostic classifies a body when mean transmitted
celestial contribution divided by mean path radiance reaches `0.05`. This is a
named POC threshold, not a calibrated human-vision model. With unchanged dim
star radiance, canonical transport places San Jose noon at `0.0470` (buried),
sunset at `4.71`, and post-sunset against zero modeled path radiance (visible).
The retained CPU artifacts include both subjective locations and the paired
off-center full-Moon proof with fixed camera, terrain, sphere, coverage, and
radiance; its noon member is a controlled counterfactual rather than an
ephemeris claim.

Record `013-m5-gpu-celestial-browser-parity` accepts the browser rendering
bridge. Browser JavaScript preserves the authoritative 15-channel equation for
all 18 Phase 4 packets. Raster materials pack those spectra into linear RGB
bands (`8..14`, `4..8`, and `0..4`) and perform the same
`path + transmittance * celestial` composition in a Three shader. This packing
is a documented POC shortcut, not a replacement for the canonical spectrum.

The browser scene contains an actual depth-writing sphere Moon and depth-tested
star point geometry with fixed camera and terrain. Celestial shader uniforms
come from boundary packets, not captured scene RGB. Night and controlled-noon
captures preserve identical geometry; selected Moon readbacks match the packed
CPU expectation with zero measured normalized error against a `2/255`
tolerance.

Record 013 is now explicitly an intermediate bridge, not final GPU atmosphere
acceptance. Its Three materials receive path-radiance and transmittance values
calculated by the CPU proof and pack them into three raster bands. Therefore it
proves packet transfer, geometry, depth, material composition, and readback,
but it does not prove that the assembled Algorithm32 fragment shader evaluates
atmospheric transport and celestial composition together.

The accepted expanded Phase 5 design adds a focused celestial shader
contribution to the assembled distant/spherical path. The assembled shader
reconstructs
the ray, resolve scene depth and celestial candidates, independently calculate
15-channel `state.pathRadiance` and `state.transmittance`, add
`state.transmittance * celestialRadiance` channel-by-channel, and only then use
the existing spectral-to-display conversion. CPU atmosphere results must not be
uploaded as the final GPU atmosphere answer, and celestial radiance must not be
routed through captured scene RGB or a precomposed RGB material.

The final Phase 5 evidence repeats the selected-ray matrix and matched San Jose
Three captures with spatially varying assembled-shader atmosphere output. It
retains explicit bindings and diagnostics for Sun, physical globe Moon, stars,
coverage, depth, occlusion, packing, precision, and CPU/GPU tolerances. Records
015 and 020 satisfy the assembled-atmosphere and prototype visible-star
mechanics portions of this gate. They open Phase 6 contract review, but record
029 now prevents physical star calibration, GPU star promotion, or production
star promotion from relying on record 020's footprint/exposure values.

Record 014 is invalid because multiple attempts overwrote its artifact folder.
Its contents must not support an accepted or rejected conclusion. The initial
constant-filled
incident texture is structurally valid shader input but is not a meaningful
atmospheric illumination cache: it discards the directional, altitude, source-
state, and spectral structure that the real cache owns. Combined with the
generic card fixture and an unaligned celestial footprint, it created images
that cannot demonstrate sky gradients, horizon behavior, or Moon attenuation.
Future acceptance must use `buildIncidentRadianceCache(...)` (or an equivalent
accepted canonical builder) for each condition and must measure multiple sky
directions, horizon/zenith separation, Moon center/edge, adjacent sky, star,
terrain, and scene-occluded pixels. Fresh immutable record 015 satisfies those
requirements: it builds canonical incident caches per unique source direction,
uses a dedicated card-free Moon scene, aligns the physical sphere with a
bounded shader footprint, and retains the full five-point readback matrix for
all six original conditions. Record 020 adds the corrected seven-condition
solar-altitude and visible-star matrix. Together with records 012 and 013,
records 015 and 020 are the accepted expanded Phase 5 exit evidence.

## Deferred Moon Surface Appearance

The final Moon should not remain a uniform circular disk. Its physical sphere
mesh must eventually carry a Moon surface texture with stable spherical UV
mapping, orientation, filtering, and lighting response so the visible face has
recognizable lunar detail. Texture orientation must derive from the shared Moon
pose rather than rotating independently for each observer.

This is deliberately deferred. The expanded Phase 5 atmosphere gate may retain
a uniform Moon material while proving assembled atmospheric transport,
15-channel boundary composition, geometry, coverage, and depth. A later visual-
fidelity step must add the texture without changing the accepted physical Moon
state, ephemeris, intersection, occultation, or boundary-radiance contracts.

## Follow-On Investigation: Milky Way

The Milky Way should be investigated as an extended
`ExternalBoundaryRadiance` provider. It is not a point-star catalog entry and
not a decorative background; it is a low-surface-brightness radiance field
beyond the atmosphere.

The likely provider shape is `MilkyWayDiffuseBoundaryRadianceProvider`.
Initial proof can be procedural: sample a broad galactic band by camera-ray
direction, return diffuse `celestialRadiance`, and compose it through the same
`pathRadiance + viewTransmittance * celestialRadiance` path. A later version
can replace the procedural band with a calibrated all-sky texture or map.

This investigation should also decide how angular bodies interact with diffuse
background fields. Sun and Moon disks may need to mask or dominate the diffuse
Milky Way radiance behind them, while point stars and diffuse Milky Way
radiance can usually add.

Milky Way visibility should stay out of the incident-radiance/L2 cache for the
first visibility proof. Any contribution to atmosphere illumination is a later
source/cache question.

## Boundary Rules

- `pathRadiance` is atmosphere radiance integrated along the camera path.
- `viewTransmittance` attenuates radiance from the body to the camera.
- `celestialRadiance` is supplied by an external boundary-radiance provider.
- Captured scene RGB is not the physical visibility model for celestial bodies.
- Decorative or fallback backgrounds are not physical boundary radiance unless
  a provider explicitly turns them into radiance.
- Phase 1 fixes `celestialRadiance` as pixel-coverage-resolved so the accepted
  composition equation remains unchanged; apparent coverage remains a separate
  diagnostic fact rather than a second multiplier at composition time.

## Subjective Validation Scenes

Use the two established `flat32` location presets for subjective Milestone 5
bitmap review:

- `san-jose`: San Jose, CA at latitude `37.3382`, longitude `-121.8863`, with
  the existing `2024-06-20T12:00:00.000Z` date basis.
- `union-glacier`: Union Glacier Camp at latitude `-79.768036`, longitude
  `-83.261666`, with the existing `2024-12-14T12:00:00.000Z` date basis.

`flat32` remains the provenance source for these subjective-scene facts, but
the experimental boundary is self-contained: Milestone 5 must not modify or
runtime-link `src/flat32/` or production code. The POC therefore owns a bounded,
explicitly versioned snapshot of the two locations, time presets, and required
calibration formulas. Treat that copy as experimental proof input, not as a
second production owner, and expose drift explicitly in a later numbered
record rather than silently synchronizing it.

The POC-local resolver must preserve the current two-stage time contract:

1. Synchronize the location and date basis to a canonical scene time through
   the calibrated `FlatSynchronizer`.
2. Apply the selected time basis to that synchronized time:
   - flat basis applies the selected angular offset;
   - globe basis resolves the selected solar event relative to synchronized
     solar noon;
   - explicit hour/minute offsets adjust the basis-resolved time last.

The resolver must also preserve the current globe-event behavior:

- derive solar noon through `FlatSynchronizer.getTimeFromClosest(...)`;
- derive sunrise/sunset hour angle from observer latitude and solar
  declination;
- report whether the requested event is available;
- report the fallback reason and resolved time when polar day or polar night
  makes sunrise/sunset unavailable;
- never apply a basis adjustment before location/date synchronization.

San Jose owns the reference sunrise, solar-noon, sunset, and sunset-plus-one-
hour offsets on its June date basis. Union Glacier keeps its authored December
date and applies those signed offsets around its own solar noon. The Union case
suffixes are schedule-offset labels, not claims of Union-local sunrise or
sunset; native Union sunrise/sunset remain unavailable under polar daylight
and that diagnosis must remain available when those events are queried.

Record 026 uses these exact UTC instants:

- San Jose: `2024-06-20T12:51:29.018Z`, `2024-06-20T20:08:46.261Z`,
  `2024-06-21T03:26:03.503Z`, and `2024-06-21T04:26:03.503Z`;
- Union Glacier: `2024-12-14T10:10:24.244Z`,
  `2024-12-14T17:27:41.487Z`, `2024-12-15T00:44:58.729Z`, and
  `2024-12-15T01:44:58.729Z`.

A same-absolute-instant observer comparison is a separate valid experiment,
not a substitute for this location-owned-date review matrix. Record 025 used
San Jose's June instants for both observers; that remains mechanically useful
but put Union in polar night and invalidates it as the subjective baseline.

Use synthetic rays and celestial samples for objective contract assertions.
Use San Jose and Union Glacier Camp for subjective bitmap review with their
canonically resolved available time states, preserving the established
`flat32` scene and camera conventions rather than inventing separate
presentation scenes.

## Accepted Real-Scene Globe CPU Extension

Record `026-m5-flat32-globe-reviewable-cpu-soft-shader` is the corrected
real-scene globe CPU review candidate. Its mechanical and automated
reviewability gates accept 25/25 criteria over eight cases, 32 raw Horizons
queries, and 79 PNGs. It remains POC-owned and CPU-only; no production, browser,
or GPU shader code participates. Record 025 remains immutable and mechanically
useful, but five of eight main frames were effectively black, so it is not
accepted subjective evidence.

Record 026's automated reviewability acceptance is not human celestial-
visibility acceptance. Human review found neither the Moon nor stars
discernible in the delivered scene images. Retain record 026 for its corrected
schedule, ephemeris, geometry, composition, output-transfer, and nonblack-frame
evidence; reject it as the subjective Moon/star visibility exit.

Scene ownership is a bounded snapshot rather than a runtime link. The snapshot
contains Flat32's camera scale/FOV, exact spherical ground, six authored review
box facts, source modes, 192 synthetic star analogs, and A-H calibration
ladder. Box centers preserve Flat32's spherical placement and boxes preserve
its yaw-only orientation; they are not reinterpreted as tangent-aligned
physical buildings. Record provenance hashes every POC source file plus the
package lock and named Flat32/FlatSynchronizer sources, because Git HEAD alone
cannot identify uncommitted or untracked experiment code.

Each location/epoch acquisition performs four sequential Horizons VECTORS
queries: geocentric Moon, geocentric Sun, topocentric Moon, and topocentric
Sun. The provider parses and retains the UTC epoch actually returned in every
row, and `worldState.epochIso` derives from that returned Moon row rather than
echoing the request. Every scene owns its returned-epoch world state and a
separate 5 m topocentric observer; cross-date San Jose/Union cases do not share
a world state. Raw URL, target, center, site, returned calendar date/Julian
date, API version, and payload remain in the immutable record.

The scene adapter rotates Earth-centered ecliptic-J2000 Sun/Moon vectors into
geodetic observer-local `[up,east,north]`, then into scene
`[east,up,-north]`. The exact Horizons Sun owns both atmospheric illumination
and the companion visible disk. Flat32's approximate solar synchronizer is only
a coherence cross-check: record 026 observes at most
`0.012635870875743504 rad` (`0.7240` degrees) separation under a named
`0.015 rad` tolerance. Exact
Horizons direction remains authoritative.

The Moon is an opaque finite sphere at exact topocentric direction/distance.
Resolved angular patches use per-ray surface normals; unresolved main-frame
disks use the disk-integrated Lambert phase response instead of a single dark-
limb sample. Angular pixel coverage is applied once, and solid scene depth can
mask the Moon. Across this near-full schedule, derived illumination spans about
`97.006%` to `99.638%`. San Jose's Moon is ground-occluded at sunrise/noon and
visible at sunset/post-sunset; Union's is ground-occluded in all four December
polar-day offset cases. The neutral `0.12` spectral albedo and display exposure
remain prototype visual calibration, so this record accepts geometry/phase
mechanics rather than lunar surface appearance.

Canonical PNGs preserve tone-mapped linear-sRGB bytes for numerical continuity.
Separately labeled review PNGs apply the standard sRGB output transfer before
8-bit quantization without changing spectral radiance or exposure. The bounded
review profile uses 12 path intervals, 6 source-transmittance intervals, 12
altitude bins, 8 incident directions, and 12 cache-path intervals. Acceptance
establishes reviewability, not production numerical convergence.

Named solid occlusion is valid evidence. At San Jose sunrise the exact Sun ray
is blocked by the authored close-building box; below-horizon cases are blocked
by the globe. A body patch passes only when it contains boundary hits or a
selected ray names a declared nearer solid. Record 024 is rejected because its
ground-only wording incorrectly excluded that real building.

The copied Flat32 stars are synthetic observer-centered diagnostics, not a
sidereal catalog. Their authored angular disks and neutral scalar bridge may
exercise routing and raster mechanics, but they do not define conserved point-
source energy or physical stellar spectra.

Record `027-m5-flat32-controlled-celestial-visibility-cpu-soft-shader`
accepts its mechanical and automated gates for a tightly framed Moon and two
star diagnostics; human review remains pending. Its daytime Moon direction is
explicitly artificial and nonastronomical. It preserves the exact noon Moon's
distance, angular size, phase angle, illuminated fraction, and relative light
geometry, so it is useful as a controlled presentation and true-angular-scale
sampling proof. It cannot validate the actual San Jose daytime Moon position.

Record `028-m5-flat32-calibrated-star-visibility-cpu-soft-shader` applies the
record-020 prototype magnitude/solid-angle/exposure bridge to the focused
Flat32 star pair. It is rejected: although night contrast becomes conspicuous,
both targets violate the solar-noon burial gate. This is evidence against
solving the problem with a larger or fitted star-only scalar, not an invitation
to search for a different exposure.

Record `029-m5-flat32-celestial-physical-validity-audit` accepts all `8/8`
audit criteria while reporting `physicalCalibrationStatus: rejected`. For the
current `256 x 256`, `10 degree` camera it calculates an exact center-pixel
solid angle of `4.6717911802e-7 sr`; the prototype `1.6e-5 sr` divisor is
`34.248x` larger. The two authored Flat32 disks imply continuous integrated-
flux scales of about `351.656x` and `343.722x`, while record 020's assembled
top-hat footprint implies about `39760.5x`. The external-boundary composition
contract survives this audit; the star source calibration and footprint do
not.

The well-sourced Algorithm32 atmosphere transport and the accepted spectral
composition point are frozen inputs to this correction. Record 029 does not
reject them and does not schedule a second atmosphere implementation or oracle
gate. Independent night-background or observer comparisons qualify only a
later claim about real-world human/camera visibility.

The next CPU star proof must start from a physically declared source and
observer contract rather than an exposure sweep:

- own top-of-atmosphere stellar spectral irradiance `F_lambda` in SI units,
  using a flux-calibrated stellar spectrum or a declared SED normalized through
  its catalog passband;
- derive every perspective-pixel solid angle `Omega_i` from that runtime
  camera;
- integrate a normalized point-spread or ideal point response into weights
  `p_i` with `sum(p_i) = 1`;
- form pixel-equivalent boundary radiance as
  `L_lambda_i = F_lambda * p_i / Omega_i` and prove
  `sum_i(L_lambda_i * Omega_i) = F_lambda` for every channel;
- prove flux conservation across resolution and subpixel placement before
  applying `pathRadiance + viewTransmittance * celestialRadiance`;
- keep one global display/observer transform for sky and stars, with no star-
  only exposure;
- if making a further real-world visibility claim, validate any additional
  night/twilight background and the camera or human-observer response
  independently without changing the accepted atmosphere composition.

GPU and production star work remain paused behind those CPU gates. Moon and
stars remain visible boundary radiance only; their illumination of the
atmosphere, terrain, or objects remains deferred source/cache work.

## Initial Success Criteria

- Dim synthetic stars disappear in the brightest daytime atmosphere.
- The same stars can be visible when path radiance and transmittance permit it.
- Physical point-star evidence conserves source spectral irradiance across
  normalized pixel weights, runtime pixel solid angle, resolution, and
  subpixel placement; tuned exposure or authored disk area cannot substitute.
- A bright disk can remain visible through the same composition path when its
  radiance and footprint justify it.
- The Sun disk proof uses source-owned facts rather than duplicated source
  data.
- Subjective artifacts preserve each `flat32` location's authored date.
  Cross-location offset schedules retain their reference-event provenance and
  do not relabel Union offset cases as local sunrise or sunset.
- Same-instant two-observer comparisons remain a distinct experiment and must
  not be substituted for the location-owned-date review matrix.
- The first accepted behavior is recorded under
  `tmp/atmosphere/reconciliation/NNN-*`.
