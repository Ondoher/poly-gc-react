# Flat-Earth Moon Model Research

This is the active research document for Milestone 5 external celestial
geometry. It is not an implementation plan and does not assume that one
flat-earth Moon model represents all flat-earth proposals.

## Target Order

The first implementation target is the globe Moon. Its position, distance,
orientation, illumination, apparent phase, and observer-dependent view are
derived from reality-based astronomical configuration/ephemeris. It is not
calibrated into an invented orbit merely to resemble a recognized phase.

The flat physical Moon is the second target. The research below remains the
design input for that later model, but it no longer blocks defining and proving
the globe Moon contract. Both targets should ultimately expose compatible
physical-body/depth/radiance roles where their actual geometry permits it.

## Globe Ephemeris Deployment Boundary

JPL Horizons cannot be called directly from the public browser application.
The real application architecture is:

```text
browser -> application Moon-state endpoint -> normalized cache
                                      -> queued JPL Horizons request on miss
```

Requirements:

- only the application server contacts Horizons;
- validate and bound requested time/location inputs rather than exposing a
  general-purpose Horizons proxy;
- serialize outbound requests to honor the one-request-at-a-time fair-use rule;
- cache normalized results by canonical timestamp, observer location/elevation,
  query profile, and source/API version;
- retain the exact query, raw response or response hash, Horizons version,
  normalization version, and fetch time as provenance;
- return a stable application-owned packet to the browser so JPL format changes
  do not become a browser contract;
- use cached/precomputed values during ordinary rendering and define explicit
  unavailable/stale behavior rather than making every frame network-dependent.

The reconciliation POC does not modify the real application server. It proves
the same acquisition/normalization boundary with an explicit Node-only script
and local fixtures. Server promotion is a later, separately authorized step.

## Research Gate

Pause Phase 2 implementation until this research produces an explicit model
inventory, observational criteria, and a recommendation about which Moon model
families the reconciliation POC should represent.

## Governing Selection Requirement

The proposal selected for implementation must be representable in one shared
physical space and must not be observer-dependent at the model level.

- The Moon, Sun, stars, and any eclipse/shadow object must have shared world
  positions, shapes, paths, and material/visibility properties.
- Observer location may change apparent direction, angular size, orientation,
  illuminated fraction/phase, parallax, and occultation through rays through
  that shared space.
- The model must not create a separate Moon, celestial sphere, trajectory, or
  eclipse mask for each observer.
- Empirical ephemerides may calibrate or validate a shared physical model, but
  per-observer apparent coordinates are not themselves an acceptable physical
  explanation.
- A non-Euclidean proposal remains eligible only if it defines one shared
  metric/ray geometry that all observers use; observer-specific projections do
  not satisfy this requirement.

The selected proposal is not required, and is not expected, to correspond to
real astronomical geometry or observations. Acceptance means that the world
is internally coherent enough to exist and render in real three-dimensional
space:

- every body has an unambiguous position, shape, size, material, and path;
- one world state is shared by all observers;
- ray intersections produce deterministic front-to-back occlusion;
- eclipse and phase behavior follows the declared geometry and light rules,
  even when the resulting events differ from reality;
- contradictions are not repaired with observer-specific masks or apparent
  coordinates.

The proposal must still have the naive appearance of supporting the major
observations it is intended to explain. This is a qualitative plausibility
requirement, not an ephemeris-accuracy requirement:

- repeating, location-dependent changes in illuminated Moon appearance must
  arise from declared geometry and lighting and read naturally as lunar
  phases;
- a solar eclipse must arise when a nearer physical body blocks some or all of
  the visible Sun for observers in the resulting shadow/visibility region;
- lunar-eclipse support is deferred and is not required for the first physical
  Moon proposal;
- partial, total, and preferably annular-looking events must follow from body
  silhouettes, angular sizes, and depth rather than a screen-space animation;
- the proposal need not match real dates, paths, periods, frequencies, or
  measured dimensions unless those are separately chosen goals.

A model fails the initial gate if it cannot produce recognizable phases, star
occultation, and Moon-caused solar eclipses from its physical world. Lunar
eclipses do not participate in the initial pass/fail result.

### Local Apparent Phase

The model is not required to maintain the same apparent Moon phase globally.
For a nearby physical Moon, observers at different positions can see different
surface normals, illuminated fractions, terminator orientations, and even
different phase categories at the same world time. This is acceptable and
expected.

The invariant is the physical state, not the rendered phase label: all
observers must query the same Moon pose, shape, material, light sources, and
shadow geometry. Each apparent phase is then derived locally from the
observer-to-Moon and Moon-to-light directions. The implementation must not
store a global `moonPhase` value as the source of truth or assign phases by
observer-specific animation.

This requirement excludes the observer-specific celestial-sphere/projection
family from selection as the physical Moon model. That family remains in the
comparison as evidence and as a useful negative/control case.

Do not silently treat a Moon model as a generic additive radiance provider.
For every model family, determine whether the Moon is:

- a finite physical object in a shared spatial frame;
- an effectively distant object on a celestial sphere;
- an observer-specific apparent projection;
- a luminous/translucent phenomenon rather than an opaque body;
- accompanied or replaced by a separate eclipse/shadow object.

## Research Method

- Prefer primary descriptions written by proponents of each model family.
- Treat forum statements as proposals by their authors, not consensus.
- Record whether a source supplies equations, quantitative geometry,
  ephemerides, or only qualitative explanation.
- Compare every proposal against the same observations to describe its
  consequences, not to require agreement with reality.
- Keep accepted astronomical ephemeris/occultation geometry as the measurement
  baseline, not as evidence that flat-earth proposals agree with it.
- Separate a coordinate transformation that reproduces observations from a
  physical model that independently specifies positions, distances, and light
  transport.

## Initial Consensus Finding

There is no single documented flat-earth consensus about the Moon. The Flat
Earth Society describes its Wiki as non-official because its members belong to
different schools with widely varying beliefs. This prevents the POC from
having one unnamed `FlatEarthMoon` contract.

Primary source:

- Flat Earth Society home page, Wiki disclaimer:
  <https://www.theflatearthsociety.org/home/index.php?lang=en>

## Initial Model Families

### 1. Classical Parallaxian / Rowbotham Local Moon

Samuel Rowbotham describes the Sun and Moon as bodies above the plane. A solar
eclipse occurs when the Moon passes between the observer and Sun. He describes
the Moon as self-luminous and semi-transparent, and attributes a lunar eclipse
to a separate semi-transparent body passing between the observer and Moon.

Consequences for the renderer:

- the Moon is not an ordinary Lambertian reflector;
- star masking may be partial or model-dependent because opacity is disputed;
- solar eclipse geometry requires the Moon to be nearer than the Sun along the
  observer ray, even though the source does not provide a complete predictive
  orbit for that ordering;
- lunar eclipses require an additional external object rather than Earth-shadow
  transport.

Primary sources:

- Rowbotham, *Zetetic Astronomy*, Chapter XI:
  <https://sacred-texts.com/earth/za/za29.htm>
- Rowbotham, Moon transparency discussion:
  <https://sacred-texts.com/earth/za/za63.htm>

### 2. Modern Small Local Luminary / Shadow-Object Proposals

Flat Earth Society materials and forum discussions repeat a small local Sun
and Moon, often described as roughly 32 miles in diameter and about 3,000 miles
above the surface. Solar-eclipse explanations vary: some say the Moon passes in
front of the Sun, some introduce a separate dark body, and some place the Moon
slightly below the Sun. The Wiki-derived lunar-eclipse account uses a separate
`Shadow Object` whose orbital plane is tilted relative to the Sun.

This is not yet a coherent quantitative family. The initial sources do not
establish one agreed altitude ordering, Moon orbit, shadow path, annular/total
eclipse rule, or observer-dependent ephemeris.

Consequences for the renderer:

- a same-altitude Sun and Moon cannot occult one another as distinct physical
  objects for a surface observer;
- an occulting version must specify different altitude/depth, intersection
  timing, and angular-size policy;
- a shadow-object version requires another physical/external candidate with
  its own orbit and visibility rules;
- no implementation should infer missing geometry from a diagram alone.

Primary/proponent-community sources:

- Flat Earth Society discussion of local Sun/Moon size and distance:
  <https://www.theflatearthsociety.org/forum/index.php?topic=31504.0>
- Flat Earth Society solar-eclipse discussion showing competing proposals:
  <https://www.theflatearthsociety.org/forum/index.php?topic=61203.0>
- Flat Earth Society discussion quoting the Wiki `Shadow Object` account:
  <https://www.theflatearthsociety.org/forum/index.php?topic=82663.0>
- Flat Earth Society 2024 discussion containing a different dark-body proposal:
  <https://www.theflatearthsociety.org/forum/index.php?topic=92408.0>

### 3. Observer-Specific Celestial-Sphere / Projection Model

Shane's personal celestial-sphere model does not require one physical local Sun
or Moon shared by all observers. It maps observed Sun, Moon, and star tracks to
an observer-specific celestial sphere. Eclipses occur at intersections or
`knots` of mapped Sun/Moon tracks, and eclipse paths use observed cycle/ratio
data. The document states that many physical aspects remain unsolved and that
the model no longer assumes a physical Sun or Moon requiring convergence among
observers.

Consequences for the renderer:

- this family is an apparent-sky field, not finite shared celestial geometry;
- observer location directly selects the projected Moon track and orientation;
- eclipse masking can be rendered in angular space, but it is not evidence of
  a physical Moon position or Moon-to-Sun distance;
- predictions derived by importing observed/globe-coordinate cycles must be
  labeled as empirical projection input rather than independent flat-world
  dynamics.
- this family is ineligible under the governing shared-physical-space
  requirement and will not be proposed for implementation.

Primary model document:

- Shane's Personal Celestial Sphere Model:
  <https://walter.bislins.ch/blog/media/Shane%2427s%20Personal%20Celestial%20Sphere%20Model.pdf>

### 4. Davis Relativity / Non-Euclidean Reinterpretation

The Davis Relativity proposal retains approximately mainstream Sun, Moon, and
star distances and allows celestial orbits and space travel, but interprets
their geometry through curved non-Euclidean `aether`. In this family the Moon
can remain a finite physical body at mainstream lunar distance, so ordinary
topocentric position and occultation relationships can be retained even though
the interpretation of `flat` differs radically from the local-luminary model.

Consequences for the renderer:

- a physical finite Moon and normal background-star occultation are suitable;
- the geometry is not interchangeable with the POC's current Euclidean local
  flat Sun model;
- supporting this family would require an explicit non-Euclidean coordinate or
  ray model rather than relabeling local Euclidean coordinates.

Primary proponent source:

- Davis Relativity Model forum proposal:
  <https://www.theflatearthsociety.org/forum/index.php?topic=72087.0>

### 5. Flat Phase-Projecting Moon

Some proposals describe a physically flat Moon that displays or projects the
currently recognized lunar phase rather than deriving its appearance from
ordinary illumination of a spherical body. This can place an object in shared
3D space, but the displayed phase is a separate emission/projection mechanism
whose physical rules must be specified.

Open problems include:

- whether the phase image is emitted from one face, both faces, or toward a
  changing region of the plane;
- how observers at different bearings and elevations see the projection;
- what happens near an edge-on view and whether the disk always faces viewers;
- whether the projected phase is globally uniform or spatially directional;
- what physical clock or geometry selects the displayed phase;
- whether the flat object is opaque to stars and can physically occult the
  Sun independently of its displayed image;
- whether lunar eclipses affect the physical disk, its projector, or only the
  displayed image.

Research disposition: back-burnered. Preserve this as a separate model family,
but do not include it in the first proposal shortlist or let its projection
requirements shape the initial physical Moon contract. Revisit it only through
a focused phase-projector study.

## Accepted Astronomical Measurement Baseline

The comparison baseline treats the Moon as a finite body whose apparent
position depends on observer location. JPL Horizons explicitly distinguishes
topocentric from body-centered observers and produces apparent observables as
seen from a selected surface location. NASA eclipse geometry uses a lunar orbit
inclined to the ecliptic; solar eclipses occur when the Moon passes between the
observer/Earth and Sun near an orbital node. Occultation tools treat the Moon as
an interfering foreground body.

These sources provide a comparison baseline for explaining how a candidate
world differs from reality. Reproducing them is not an acceptance criterion
for the selected model.

Primary sources:

- JPL Horizons observer and topocentric ephemeris documentation:
  <https://ssd.jpl.nasa.gov/horizons/manual.html>
- NASA eclipse geometry:
  <https://science.nasa.gov/eclipses/geometry/>
- NASA Moon orbit and eclipse cycles:
  <https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html>
- JPL SPICE geometry/occultation capabilities:
  <https://naif.jpl.nasa.gov/naif/spiceconcept.html>

## Same-Plane Occlusion Constraint

For a Euclidean flat-world observer below a horizontal celestial plane, one
camera ray intersects that plane at one point. Therefore two distinct physical
bodies at the same altitude cannot occupy the same observer ray. If they also
share the same circular track, apparent overlap requires spatial coincidence,
not an ordinary near/far occultation.

A local physical solar eclipse consequently requires at least one of:

- different Sun/Moon altitude or three-dimensional paths;
- a non-Euclidean or refracted ray model;
- an observer-specific projection rather than shared physical positions;
- a separate occulting body;
- a nonphysical angular masking rule.

This constraint must become an explicit test for every local-luminary model.

## Required Comparison Matrix

For each researched model family, record:

| Requirement | Question |
| --- | --- |
| Model identity | Which source and version define the model? |
| Moon ontology | Physical sphere, disk, translucent body, projection, or other? |
| Coordinate frame | Is there one shared frame for observer, Moon, Sun, and stars? |
| Physical eligibility | Does one observer-independent world state generate every view? |
| Observer dependence | How are San Jose and Union Glacier views derived? |
| Position and distance | Are quantitative Moon position, altitude, and distance supplied? |
| Orbit/path | Is the Moon path predictive, empirical, or unspecified? |
| Phases | Reflected sunlight, self-luminosity, projection, or another mechanism? |
| Phase plausibility | Does declared 3D lighting naturally produce recognizable, potentially location-dependent phase cycles? |
| Phase locality | Do simultaneous observer differences derive from one Moon/light state rather than per-observer phase assignments? |
| Star occultation | Does the Moon fully, partially, or never mask background stars? |
| Solar eclipse | What passes in front of what, at what depth, and why only at nodes? |
| Solar-eclipse plausibility | Does shared geometry produce a physical occlusion region for one or more observers? |
| Annular eclipse | How can apparent Moon/Sun diameter ordering vary? |
| Lunar eclipse | Earth shadow, shadow object, foreground body, or angular effect? |
| Lunar-eclipse plausibility | Does a declared physical shadowing relationship visibly affect the Moon? |
| Eclipse path | Can the model predict time, location, duration, and totality width? |
| Parallax | Does observer location change apparent Moon direction quantitatively? |
| Surface orientation | Does it predict lunar libration and field rotation? |
| Renderer form | Finite geometry, external candidate, diffuse/angle field, or projection? |
| Source quality | Equations/data, qualitative proposal, or imported observations? |

## Research Deliverables Before Implementation Resumes

1. Expand the initial family inventory with primary sources and versioned model
   definitions.
2. Complete the comparison matrix without filling missing facts by assumption.
3. Select a small reference set with known times/locations to expose and
   document the consequences of each model, including:
   - ordinary Moon/star occultation;
   - total and annular solar eclipse;
   - lunar eclipse;
   - simultaneous San Jose and Union Glacier Moon direction/orientation;
   - Moon phases and angular diameter over time.
4. Determine what each model generates from its own parameters, where it
   intentionally differs from reality, and which proposals only replay
   imported apparent coordinates/cycles.
5. Demonstrate qualitatively that each surviving candidate can generate a
   recognizable, potentially location-dependent phase cycle, star occultation,
   and solar eclipses from shared 3D geometry, without requiring correct
   real-world timing or one globally uniform apparent phase.
6. Reject observer-specific apparent-field families as implementation
   candidates while retaining them as comparison/control cases.
7. Recommend a renderer contract for shared physical finite bodies and, if a
   viable model requires them, shared auxiliary shadow objects or a shared
   non-Euclidean ray metric.
8. Decide whether the reconciliation POC supports one selected physical family
   or a model-pluggable architecture limited to observer-independent physical
   families.
9. Only then revise the external-boundary candidate/resolver contract and
   resume Sun/Moon implementation.

## Current Research Status

- Status: initial source survey complete; comparison and internal-coherence
  evaluation remain open.
- Selection constraint: only observer-independent proposals in one shared
  physical space are eligible; observer-specific projection models are
  excluded from implementation consideration.
- Acceptance constraint: internal 3D coherence and deterministic physical
  visibility are required; correspondence with real astronomy is not.
- Qualitative plausibility constraint: recognizable Moon phases, star
  occultation, and solar eclipses must emerge from the declared physical model.
- Phase-locality constraint: simultaneous observers may see different phases;
  those differences must be derived from one shared Moon and lighting state.
- Deferred family: flat phase-projecting Moon proposals remain inventoried but
  are outside the initial shortlist and current comparison priority.
- Deferred mechanism: the extra dark body and all lunar-eclipse reproduction,
  alignment, and configuration work do not block the initial Moon proposal.
- Minimum-requirements finding: no surveyed documented proposal yet supplies a
  complete shared 3D specification covering physical placement, local apparent
  phases, star occultation, and both eclipse classes. The sources provide
  partial mechanisms or qualitative claims, not all renderer-ready rules.
- No Moon implementation is authorized by this research checkpoint.
- Phase 1 records `001` and `002` remain evidence for scene/time inputs and the
  final atmospheric composition boundary, but their single-provider shape is
  not sufficient evidence for multi-body celestial depth resolution.

## Minimum-Requirement Assessment

None of the initially surveyed proposals currently passes the complete gate:

- Rowbotham supplies physical solar occultation and a separate lunar-eclipse
  body, but not enough quantitative paths, lighting, opacity, and phase rules
  to instantiate one deterministic 3D system.
- Modern local-luminary/shadow-object discussions contain the necessary pieces
  in outline, but disagree about altitude ordering and do not define one
  complete set of orbits, sizes, materials, and eclipse interactions.
- Observer-specific celestial-sphere models fail the shared-world requirement.
- Davis-style non-Euclidean models may be spatially coherent, but the surveyed
  proposal does not define a renderer-ready shared metric and ray model.
- Flat phase-projecting models are deferred and require a separate directional
  display mechanism.

This is a specification-completeness finding, not a reality-accuracy finding.

A deliberately specified hybrid could meet the minimum without claiming to be
an established consensus model:

1. Use one opaque spherical Moon on a three-dimensional path below and
   geometrically distinct from the local Sun path.
2. Illuminate it from the physical local Sun so each observer's apparent phase
   follows from the shared Sun-Moon-observer geometry.
3. Let it mask farther stars and occasionally cross observer-to-Sun rays,
   producing physical partial, total, or annular-looking solar eclipses.
4. Add one shared physical dark body or declared shadow-casting mechanism for
   lunar eclipses, because the flat ground below both luminaries cannot pass
   between them.
5. Explicitly define all trajectories, radii, materials, opacity, lighting,
   and intersection rules, even if the resulting sky differs from reality.

This should be labeled a new reconciliation proposal assembled from documented
motifs, not attributed wholesale to any surveyed source.

## Configuration-Driven Synchronization Candidate

Status: deferred to the later flat-Moon target. The globe Moon uses
reality-based astronomical state and does not use this best-fit fictional-orbit
policy.

The detailed Moon system may remain configuration rather than being presented
as a uniquely correct orbit. A configured synchronization policy can use the
selected scene's anchor location and synchronized time to choose the global
Moon orbital state that best matches the recognized phase at that location.

This remains compatible with an observer-independent physical world only under
the following contract:

1. Synchronization runs once for the world/scene time basis, not once per
   camera or observer render.
2. The anchor location is calibration input identifying which local appearance
   should be matched; it does not own a separate Moon.
3. The solver writes one shared Moon orbit/state, after which San Jose, Union
   Glacier, and every other observer query that same state.
4. Moving the camera without resynchronizing cannot move the Moon or change its
   physical illumination state.
5. An explicit resynchronization from another anchor may produce a different
   configured world solution. That is a scene recalibration, not simultaneous
   observer dependence.

Phase alone does not uniquely determine a three-dimensional Moon position.
Many positions can expose the same illuminated fraction, so configuration must
also provide constraints or deterministic tie-breakers. Candidate inputs are:

- orbit family/path and its allowed altitude/radius range;
- Moon radius and material/reflectance model;
- synchronized world time and anchor location;
- recognized local illuminated fraction and waxing/waning sense;
- optionally recognized local Moon azimuth/elevation or rise/set relation;
- deterministic objective weights and tie-breaking rules;
- behavior when no state on the configured orbit can meet the requested fit.

The canonical stored result should be physical state such as orbit phase,
position, pose, and velocity—not a global apparent `moonPhase` label. The
recognized phase is synchronization/calibration evidence. After solving, the
renderer derives each observer's apparent phase from geometry.

The existing POC-local `SubjectiveSceneTimeResolver.resolve(...)` is the
authoritative first stage. It already synchronizes location/date, applies the
selected time basis, and then applies any explicit time adjustment. The Moon
solver must consume its resolved timestamp and anchor-location result rather
than repeat or fork that calibration logic. It then solves the configured
celestial state. The solver and configuration must remain POC-local with no
runtime link to external or `flat32` code.

## Deferred: Configurable Dark-Body Candidate

Status: deferred. Preserve this explored design for later, but do not implement
it or constrain the first physical Moon contract around it.

A lunar-eclipse mechanism may add one shared physical dark body on a configured
orbit. Its minimum canonical configuration is:

- orbit latitude, or an explicit offset from the configured solar latitude;
- orbital longitude/phase, unless synchronization derives it;
- altitude;
- orbital rate and direction;
- physical radius or other silhouette dimensions;
- opacity/transmission, which controls actual occultation;
- albedo/emission, which controls the body's own visible radiance;
- orbit epoch defining the time at which the configured longitude applies.

Dark-body longitude uses an optional discriminated user preference:

- absent/`disabled`: create no active lunar-eclipse dark body and make no
  attempt to reproduce lunar eclipses;
- `align`: do not accept a user longitude; derive epoch longitude/orbit phase
  from the next recognized lunar-eclipse anchor and Moon azimuth described
  below;
- `longitude`: require the user-provided longitude and do not run the event
  alignment solver.

Providing both an alignment selection and an explicit longitude is invalid and
must fail loudly. Providing neither selects the disabled state. The resolved
epoch longitude is derived world state and must not be written back as a second
preference alongside `align`. Diagnostics may report it without making it
canonical configuration.

Albedo alone is not an occlusion control. A black-looking but transparent body
does not mask the Moon, while an opaque high-albedo body still occludes it.
Geometry and opacity must therefore remain separate from visible radiance.

This body has no role in solar eclipses. Those are already produced when the
nearer physical Moon intersects an observer-to-Sun ray. The dark body's sole
eclipse role is to cross an observer-to-Moon ray or otherwise physically
shadow the Moon, producing a lunar eclipse.

### Optional event-anchor solve

Instead of requiring the user to enter orbital longitude, synchronization may
solve the dark body's orbit phase from a configured recognized-event anchor:

1. Resolve the event time and anchor location through the existing calibration
   inputs.
2. Obtain a configured target sky direction at that event.
3. Solve the dark-body epoch longitude/phase so its shared orbit passes nearest
   that target direction at the event time.
4. Freeze that one shared orbit state and propagate it by the configured rate.

When the preference is `align`, the event anchor is the next recognized lunar
eclipse. At that event
time and the configured anchor location, synchronization obtains the Moon's
recognized projected azimuth and solves the dark body's epoch longitude/orbit
phase to match that azimuth as closely as the configured orbit permits.

This is intentionally an azimuth-only calibration. Latitude/offset, altitude,
radius, rate, and direction remain user configuration. The solver does not fit
elevation, angular separation, or disk coverage. Consequently the dark body
may cross above or below the Moon, overlap it only partially, or fail to
occlude it at all at the recognized event. Those are valid consequences of the
configured model, not calibration failures.

The solver should report azimuth residual plus the resulting elevation,
angular separation, apparent radii, and coverage as diagnostics. Only failure
to satisfy the azimuth objective within its configured tolerance is a
calibration failure. It must not silently alter other orbit parameters to force
an eclipse.

Once calibrated, the dark body follows its shared configured orbit. The anchor
event synchronizes orbital bearing but does not guarantee a recognizable lunar
eclipse. Any occlusion at the anchor or later is a prediction of the configured
fictional system and need not match real eclipses.

The recognized event time and Moon direction are calibration inputs, not
runtime external-code dependencies. They must be supplied through explicit
POC-local configuration/snapshots consistent with the existing code-isolation
rule.

When the preference is `longitude`, synchronization skips the event lookup and
azimuth fit. It interprets the configured longitude at the configured orbit
epoch, propagates it by the configured rate, and reports the same geometric
diagnostics without treating any recognized eclipse as a target.

When the preference is absent/`disabled`, synchronization performs no event
lookup or dark-body solve, and the renderer registers no active lunar-eclipse
occluder. Solar eclipses and Moon phases remain unaffected.
