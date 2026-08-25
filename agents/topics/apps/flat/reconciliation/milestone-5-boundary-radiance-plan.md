# Milestone 5 Boundary Radiance Plan

This plan retains the pre-reset Milestone 5 phase/evidence trail. Active work is
owned by [Extra-Atmosphere Reset Plan](extra-atmosphere-reset-plan.md); its
[Reset Design](extra-atmosphere-reset-design.md) supersedes the source,
coverage, point-response, and discrete-composition assumptions here.

## Goal

Prove the external-boundary-radiance contract before promoting anything into
production:

```text
pathRadiance + viewTransmittance * celestialRadiance
```

Development and testing happen first in the CPU/soft-shader reconciliation
path. GPU shader work begins only after the CPU/soft-shader proof has accepted
diagnostics for the contract.

## Globe-Moon Gate Before Phase 2

Status: complete for the reality-configured globe Moon through the physical
state/depth gates and record-026 corrected CPU review guard. Record 025 remains
mechanics-only correction evidence and is invalid as the subjective baseline.
The flat Moon research is preserved for a later second target and does not
block the globe contract.

The gate must define the globe Moon's authoritative astronomical state input,
shared physical sphere, material/illumination policy, ray intersection and
distance, phases, parallax, background-star masking, solar occultation, and
location-dependent viewing. Do not replace astronomical state with a fitted
phase or fictional orbit. Flat-Moon and lunar-eclipse/dark-body work are later
targets.

The POC ephemeris acquisition path is Node-only and writes local normalized
fixtures. The later real-app integration must put Horizons access behind an
application-owned server endpoint with bounded inputs, sequential outbound
requests, caching, version/provenance retention, and a stable browser packet.
Do not call Horizons from browser code or create an unrestricted public proxy.

Do not extend the runtime candidate/resolver contract until the globe Moon
state and physical-body contracts are explicit. Records `001` and `002` remain
accepted evidence for the existing scene/time and final atmosphere-boundary
contracts.

Do not jump directly to a Three/browser Moon scene. The first legitimate San
Jose subjective capture occurs only after the physical Moon state/provider,
multi-body depth resolution, external-boundary composition, and CPU/soft-shader
proof have each reached their planned accepted records. Records 003/004 are
retained procedural framing sketches, not verification or phase completion.

## Prerequisite Phase G0: Next Full Moon Resolver

Status: complete. Record `006-m5-moon-phase-contract` accepts phase-at-time
information plus next new, first-quarter, full, and last-quarter events with
provenance and existing-browser-runner packet parity. Record 005 is preserved
as rejected because its test expectation disagreed with the documented phase
name bucket. A general ephemeris engine was not required.

Steps:

1. Define phase-at-time input/output for any supported timestamp, returning
   signed cycle angle, illuminated fraction, waxing/waning state, and a derived
   phase name.
2. Define next-phase input with inclusive `afterTimeIso`, one of the four
   principal named phases, and a bounded search horizon.
3. Define the next-phase result containing event time, phase/elongation
   diagnostic, search/refinement tolerance, source/API version, exact query
   provenance, and explicit unavailable/error state.
4. Implement a POC-only Node resolver using sequential Horizons requests:
   - sample a bounded future window coarsely;
   - bracket the maximum geocentric solar elongation/minimum lunar phase angle;
   - refine the bracket to a named time tolerance;
   - reject malformed payloads and never hide upstream errors;
   - retain raw responses or content hashes plus exact queries.
5. Add deterministic local fixtures so contract tests do not require network
   access.
6. Add a Node contract probe for known timestamps, waxing/waning classification,
   principal phase events, monotonic `next` behavior,
   behavior, bounded convergence, provenance, and fail-loud cases.
7. Add an existing-browser-runner contract job. Its Node runner resolves or
   loads the event, embeds the normalized result in `browser-command.json`, and
   verifies that `browser-page/runner.js` validates and returns the identical
   event timestamp/provenance. The browser never calls Horizons.
8. Record the future real-app design without implementing it in this POC:
   - browser calls `GET /api/moon/phase?at=<ISO time>` or
     `GET /api/moon/events/next?after=<ISO time>&phase=<name>`;
   - application server validates and bounds `after`;
   - server serializes Horizons requests and caches normalized event results;
   - endpoint returns the same stable packet used by POC fixtures;
   - stale/upstream-unavailable/malformed behavior is explicit;
   - no unrestricted proxy or browser-to-Horizons call is allowed.
9. Create a fresh numbered record containing retained query/response evidence,
   normalized fixtures, Node/browser-runner diagnostics, tolerance, and
   accepted/rejected criteria.

Exit condition: accepted by record 006. Node and the existing browser runner
agree on normalized phase-at-time and four principal next-phase results;
fixtures make tests deterministic without network access; no Three scene was
created; and the real-app server endpoints are specified.

## Prerequisite Phase G1: Globe Moon Physical State

Status: complete. Record `008-m5-globe-moon-state-contract` accepts exact
Horizons Earth-centered Moon/Sun state at the G0 full-Moon event, independently
validated San Jose observer state, physical sphere intersection/depth, and
existing-browser-runner parity. Record 007 is preserved rejected because it
incorrectly required exact 100% illumination at ecliptic-longitude opposition.

Implemented scope:

1. Versioned `CelestialWorldState` in Earth-centered ecliptic J2000, kilometers
   and kilometers/second, with Moon/Sun positions, velocities, radii, and
   source provenance.
2. Separate `GlobeObserverState`; San Jose position is reconstructed from both
   Moon and Sun geocentric/topocentric queries and checked for agreement.
3. Observer-relative Moon direction, distance, angular radius, physical phase
   angle, and illuminated fraction derived from shared geometry.
4. Opaque physical Moon sphere with ray hit, miss, nearest positive distance,
   and finite-depth facts suitable for masking infinite stars.
5. Deterministic exact-time fixture plus identical Node/existing-browser-runner
   geometry and ray results, with no Three scene.

Exit condition: accepted by record 008 with 12/12 criteria. The conventional
180-degree opposition event produces 99.7800% illumination for San Jose because
the Moon is not exactly coplanar; physical geometry, not an event label, owns
the rendered fraction.

## Prerequisite Phase G2: External Celestial Candidates And Depth Resolution

Status: complete. Record `009-m5-external-celestial-depth-contract` adapts the
accepted G1 physical Moon into the Phase 1 external-boundary role and resolves
overlapping celestial bodies before atmosphere integration or scene rendering.

Steps:

1. Define a versioned `ExternalCelestialCandidate` packet containing:
   - provider/body identity and body kind;
   - hit/no-hit state;
   - finite distance in canonical units or explicit infinite-distance policy;
   - opacity/transmission policy;
   - apparent coverage/footprint;
   - prototype 15-channel celestial radiance;
   - selected-ray diagnostics and provenance.
2. Keep candidates distinct from the final Phase 1
   `ExternalBoundaryRadiance` result. A candidate reports one body's claim on a
   ray; the resolver owns ordering, masking, and final selection/composition.
3. Add a `GlobeMoonBoundaryCandidateProvider` that adapts the accepted G1
   shared state, observer state, physical sphere intersection, finite hit
   distance, opacity, coverage, and controlled spectral radiance.
4. Add controlled synthetic candidate providers for:
   - finite Sun disk;
   - infinite-distance point/background star;
   - non-overlapping star;
   - no-hit.
   These are ordering fixtures, not final source-owned Sun/star implementations.
5. Implement `ExternalCelestialDepthResolver` with explicit rules:
   - reject malformed, negative-distance, duplicate-identity, or incompatible-
     spectral candidates;
   - nearer opaque finite candidates mask farther candidates within covered
     pixels;
   - a finite opaque Moon masks infinite-distance stars behind its disk;
   - controlled Moon-before-Sun alignment masks the farther Sun candidate;
   - non-overlapping candidates do not mask one another;
   - scene-hit distance nearer than the first celestial candidate produces the
     accepted scene-occluded zero-radiance result;
   - no candidate produces the accepted no-body zero-radiance result.
6. Specify partial coverage behavior. For the first proof, resolve coverage into
   the winning candidate's final `celestialRadiance` while retaining coverage
   separately for diagnostics, matching the accepted Phase 1 composition rule.
7. Adapt the resolved result into the accepted `ExternalBoundaryRadiance`
   packet without introducing cache fields, fallback backgrounds, captured
   scene RGB, or display-space ownership.
8. Add controlled CPU probes for Moon hit/miss/tangent, Moon-over-star,
   Moon-over-Sun, star beside Moon, scene-over-Moon, partial coverage, no-body,
   deterministic tie handling, and fail-loud invariants.
9. Add a geometry/packet-only existing-browser-runner parity job after the CPU
   contract passes. Send identical candidates through `browser-command.json`
   and compare resolved identity, distance, coverage, occlusion state, and
   spectral output. Create no Three scene and no bitmap.
10. Create a fresh numbered record with objective inputs, candidate lists,
    selected-ray diagnostics, Node/browser results, tolerances, and explicit
    accepted/rejected criteria.

Exit condition: one accepted record proves that the G1 Moon participates as a
finite opaque external-boundary candidate; it masks farther stars and a
controlled farther Sun, respects nearer scene geometry, preserves non-overlap,
and produces identical CPU/browser-runner packets. Atmosphere transport,
source-owned Sun calibration, Three scenes, and subjective images remain later.

Accepted by record 009. Seven controlled cases prove finite Moon ordering,
infinite-star and farther-Sun masking, non-overlap/no-body behavior, nearer
scene occlusion, partial-coverage radiance, and empty input. Malformed spectral
values, negative distances, and duplicate body ids fail loudly. CPU and browser
packets are identical; no Three scene or bitmap was created.

## Phase 1: Name The Boundary

Status: complete. Records
`001-m5-subjective-scene-time-contract` and
`002-m5-external-boundary-radiance-contract` accept the Phase 1 scene/time
prerequisite, contract packets, spectral space, isolation rules, composition
point, and controlled-ray probe.

Steps:

1. Inspect the current POC composition points in the CPU/reference,
   CPU-postprocess, and shader/browser paths so the new boundary is inserted
   at the same logical place in each lane.
2. Add a POC-owned `ExternalBoundaryRadiance` provider or descriptor shape.
   It should answer one camera-ray question: what visible radiance arrives
   from beyond the atmosphere along this ray?
3. Define the provider input packet:
   - camera ray direction and origin;
   - atmosphere/geometry context needed to know the outside-atmosphere
     boundary;
   - optional scene-hit/depth facts for occlusion;
   - selected-pixel diagnostics flag.
4. Define the provider output packet:
   - provider/body id;
   - body kind;
   - `celestialRadiance`;
   - apparent coverage or footprint;
   - occlusion state;
   - no-hit/no-visible-body state;
   - diagnostics needed to explain selected pixels.
5. Explicitly name the radiance color/spectral space used by the first proof.
   If the first proof uses a display-space shortcut, record that as a bounded
   prototype shortcut rather than the final physical contract.
6. Define the no-visible-body result as zero boundary radiance with a clear
   provider state, not as a fallback background color.
7. Keep the shape independent of incident-radiance/L2 cache construction,
   sampling, and source illumination.
8. Add a narrow contract probe that can call the provider with controlled rays
   and verify hit, no-hit, radiance, coverage, and diagnostics shape.
9. Copy a bounded, provenance-labeled snapshot of the existing `flat32`
   `san-jose` and `union-glacier` location presets, flat/globe time presets,
   and required time-calibration formulas into the reconciliation POC. Do not
   modify or runtime-import `flat32` or production code.
10. Preserve the time-resolution sequence as an explicit contract:
    synchronize the location/date first, apply the selected flat or globe time
    basis second, then apply explicit hour/minute adjustment last.
11. Make time resolution return the synchronized time, selected basis,
    basis-resolved time, applied adjustment, final time, event availability,
    and fallback reason. Keep UI status behavior outside the POC resolver.

Exit condition: the POC has a named role that can be implemented by stars,
Moon/planet analogs, and a source-owned Sun disk provider, with an explicit
no-hit state and a named radiance space. **Accepted by record `002`.**

## Phase 2: Source-Owned Sun Disk

Status: complete. Record `010-m5-source-owned-sun-disk-contract` accepts the
distant and local source-owned visible-disk providers through the G2 depth
resolver and Phase 1 boundary contract.

Steps:

1. Identify the current source facts already owned by distant and local Sun
   sources:
   - source identity;
   - direction or position;
   - angular size or physical radius;
   - spectrum/radiance or calibration facts;
   - source-path and distance semantics.
2. Add an optional light-source method or factory that exposes a companion
   visible-body provider from those facts.
3. Implement the distant-Sun hit policy as an angular-radius test against the
   camera ray direction.
4. Implement the local-Sun hit policy as a ray/sphere or equivalent finite-body
   test using source-owned radius/position facts.
5. Add a first radiance calibration policy:
   - prefer a source-owned physical radiance derivation if available;
   - otherwise use an explicitly named prototype calibration value;
   - record any shortcut in diagnostics and in the first numbered record.
6. Add coverage/antialiasing policy for subpixel disks so a tiny Sun disk does
   not flicker or vanish only because the selected pixel misses the exact
   center.
7. Apply scene-hit/depth occlusion: an ordinary scene object in front of the
   disk should hide the visible disk for that ray.
8. Emit selected-pixel diagnostics showing source id, hit test result,
   angular distance or ray/sphere hit facts, radiance, coverage, occlusion,
   and final composed contribution.

Exit condition: the POC can identify and compose a visible Sun disk through the
same boundary-radiance path planned for other celestial bodies, without
duplicating source ownership.

Accepted by record 010. Nine controlled cases prove distant angular-disk and
local finite-sphere hits, misses, subpixel edge coverage, scene occlusion, Moon
masking of a farther local Sun, physical uniform-disk spectral calibration,
source-fact diagnostics, and identical CPU/browser packets. No Three scene or
bitmap was created.

## Phase 3: Controlled Celestial Samples

Status: complete. Record `011-m5-controlled-celestial-samples-contract`
accepts the controlled celestial provider and noon, sunset, and post-sunset
selected-ray fixtures through the shared boundary path.

Steps:

1. Add a synthetic test provider for controlled non-source celestial bodies.
   This provider is test/proof scaffolding, not final catalog ownership.
2. Create a small set of ray-addressable samples:
   - dim star samples below daylight visibility;
   - one or more brighter star samples for twilight/night checks;
   - a bright Moon/planet-like disk sample;
   - an empty/no-body ray.
3. Give every sample explicit radiance, angular footprint, and body kind.
4. Keep the synthetic samples independent from renderer-captured scene RGB.
5. Keep decorative backgrounds out of the provider list unless a later provider
   intentionally turns a background into physical radiance.
6. Compose multiple providers in a deterministic order:
   - source-owned Sun disk;
   - opaque bright disks or bodies;
   - point stars;
   - optional diffuse fields in later follow-on work.
7. Decide and document first-pass overlap rules. For the first proof, bright
   disks may mask lower-priority background/diffuse radiance in their footprint;
   point stars and non-overlapping bodies can add.
8. Add selected-pixel fixtures for solar noon, sunset, and post-sunset views.
   Each fixture should include at least one dim-star pixel and one bright-body
   pixel.

Exit condition: stars, bright analogs, and the Sun disk use one composition
point with different provider policies.

Accepted by record 011. Twelve rays prove dim and bright stars, a finite opaque
bright body, empty rays, Moon-over-star and source-owned-Sun-over-star masking,
explicit synthetic provenance, deterministic body-class ordering, and exact
CPU/browser packets. These remain unattenuated celestial inputs; daylight
visibility is intentionally deferred to Phase 4. No Three scene or bitmap was
created.

## Phase 4: CPU / Soft-Shader First Proof

Status: complete. Record `012-m5-cpu-celestial-atmosphere-composition`
accepts canonical external-boundary composition in the CPU soft-shader.

Steps:

1. Use the CPU/soft-shader path as the first development and testing lane.
   Pick the exact POC surface inside that lane:
   - CPU/reference if the existing evaluator can expose the needed composition
     facts cheaply;
   - CPU postprocess if it is the fastest path to reuse path radiance,
     transmittance, selected scene facts, and controlled rays.
2. Build a fresh numbered record folder under
   `tmp/atmosphere/reconciliation/NNN-*` before running the first substantive
   proof.
3. Record the state goal, inputs, command, and expected criteria before
   accepting the run.
4. Run selected pixels for both established `flat32` subjective locations:
   - San Jose, CA (`san-jose`);
   - Union Glacier Camp (`union-glacier`).
5. Resolve subjective times through the accepted POC-local `flat32` snapshot:
   - record the synchronized time, chosen time basis, basis adjustment, and
     final resolved time for every case;
   - resolve San Jose sunrise, solar noon, sunset, and sunset plus one hour;
   - derive their signed offsets around San Jose solar noon;
   - preserve Union Glacier's December date and apply those offsets around
     Union's own solar noon;
   - label Union cases as schedule offsets rather than local events, while
     retaining the native polar-day unavailable-event diagnosis when queried.
6. For each selected pixel, record:
   - `pathRadiance`;
   - `viewTransmittance`;
   - `celestialRadiance`;
   - provider/body id;
   - coverage;
   - occlusion state;
   - final composed color;
   - visible/not-visible classification.
7. Verify dim stars disappear or become visually buried in the brightest
   daytime atmosphere.
8. Verify the same star samples can become visible when the atmosphere state
   permits it.
9. Verify a high-radiance body can remain visible through the same path when
   radiance and angular footprint justify it.
10. Verify no visible celestial proof sample is represented by ordinary
   captured scene RGB or folded into incident-radiance/L2 sampling.
11. Generate CPU-only bitmap artifacts for the location-owned-date offset
    matrix. Include reference-offset provenance plus native event availability
    and fallback diagnostics in each artifact record. Treat bitmaps as visual
    evidence alongside, not in place of, objective selected-pixel criteria.
12. Once the physical Moon path is part of the accepted CPU integration, add a
    required paired San Jose Moon visibility test:
    - one night capture with a full Moon visible but deliberately off-center;
    - one calibrated solar-noon capture retaining the exact same camera,
      terrain, Moon position, radius, material, and full-disk state;
    - change only the atmosphere/time-lighting condition relevant to the
      visibility comparison;
    - label the held-full-Moon noon case as a controlled counterfactual, not a
      globe ephemeris claim;
    - retain selected-pixel path radiance, transmittance, Moon radiance,
      coverage, and final color for corresponding pixels in both images.
13. Write the record report with accepted/rejected status, diagnostic tables,
    and any shortcut or unresolved calibration note.

Exit condition: a fresh numbered CPU/soft-shader record accepts or rejects the
proposed contract with enough diagnostics to explain the outcome.

Accepted by record 012. Six resolved location/time cases retain path radiance,
view transmittance, celestial radiance, body/coverage/occlusion facts, final
spectra, display output, and a first-pass contrast classification. The same dim
star is buried at San Jose solar noon and visible after sunset; the bright body
remains visible at noon; no-body rays equal path radiance exactly. Eight CPU
bitmaps include the full subjective matrix and the held-geometry, off-center
San Jose full-Moon night/noon pair. The noon Moon is explicitly a controlled
counterfactual. The legacy CPU soft-shader contract regression remains accepted.

## Phase 5: GPU / Browser Parity

Status: complete. Record `013-m5-gpu-celestial-browser-parity`
accepts the browser packet, geometry, depth, and three-band material bridge
against record 012. Fresh record `015-m5-assembled-celestial-atmosphere`
completes the expanded gate because atmospheric
`pathRadiance` and `viewTransmittance` are independently evaluated by the
assembled GPU atmospheric shader using canonical per-condition cache inputs.

Steps:

1. Start GPU/browser work only after Phase 4 has an accepted
   CPU/soft-shader record.
2. Port the accepted provider packet shape into the shader/browser path without
   changing the accepted CPU/soft-shader semantics.
3. Add GPU-side provider data binding for the controlled Sun disk and synthetic
   celestial samples.
4. Add shader composition at the accepted point:

   ```text
   pathRadiance + viewTransmittance * celestialRadiance
   ```

5. Keep renderer-captured scene RGB available for ordinary scene endpoints, but
   do not route celestial visibility through captured scene RGB.
6. Add selected-pixel browser readback for the same canonically resolved time
   cases and the same San Jose and Union Glacier Camp locations used by the
   CPU/soft-shader proof.
7. Compare GPU selected pixels against CPU/soft-shader selected pixels within a
   named tolerance.
8. Record any shader-specific shortcut, precision issue, packing policy, or
   display-space bridge in diagnostics.
9. Build the real Three scene only after the paired CPU images and their
   objective diagnostics are accepted. Reproduce the paired San Jose night and
   solar-noon captures through the browser with the same physical Moon mesh,
   depth-tested star geometry, camera, and scene geometry. Compare both GPU
   images and selected pixels with their accepted CPU counterparts.
10. Create a fresh numbered GPU/browser record rather than rewriting the CPU
    proof record.
11. Treat record 013 as an accepted intermediate prerequisite, not the Phase 5
    exit record. Preserve it unchanged as evidence for packet binding, Three
    geometry, depth testing, and the temporary three-band material bridge.
12. Add an assembled-shader celestial contribution at the canonical spectral
    seam. It must consume the reconstructed camera ray and scene-depth facts,
    resolve the controlled Sun/Moon/star candidates, and produce a 15-channel
    coverage-resolved `celestialRadiance` value inside the shader path.
13. Extend assembled shader state/ownership explicitly rather than hiding the
    feature in the color encoder:
    - add celestial boundary state or a focused contribution-owned result;
    - place celestial resolution after ray/path/depth resolution and before
      final color conversion;
    - define a stable assembler owner/order for the new contribution;
    - keep ordinary captured scene endpoints on their existing path.
14. Bind source-owned distant/local Sun facts and the accepted physical globe
    Moon facts to the assembled shader. Controlled star samples may use bounded
    uniform arrays or a POC texture, but their direction, footprint, radiance,
    distance policy, and opacity must remain explicit.
15. Perform the actual 15-channel GPU composition before display conversion:

    ```text
    state.pathRadiance[channel] +=
        state.transmittance[channel] * celestialRadiance[channel]
    ```

    Do not precompute either atmosphere term on the CPU and do not reduce the
    celestial value to RGB before this operation.
16. Implement shader-side hit, coverage, and depth rules for the controlled
    proof:
    - distant Sun angular disk;
    - finite physical globe Moon sphere/disk;
    - point-star angular footprints;
    - Moon/Sun/star overlap and ordinary scene occlusion;
    - no-body zero radiance.
17. Run the assembled distant/spherical atmospheric fragment shader through
    the existing browser composer with real per-pixel atmosphere evaluation.
    Verify the output is spatially varying and that celestial visibility is not
    supplied by a uniform CPU atmosphere color or a celestial Three material.
18. Repeat the accepted Phase 4 selected-ray matrix for San Jose and Union
    Glacier. Read back GPU diagnostics for path radiance, transmittance,
    celestial radiance, coverage/body selection, final spectral/raster result,
    and compare them with CPU values using named spectral and display
    tolerances.
19. Re-render the matched San Jose night and controlled solar-noon scene with
    the same camera, terrain, physical Moon, and star geometry. The assembled
    atmospheric shader must provide the background and attenuation. Retain the
    full-Moon counterfactual label and prove the two captures differ only in
    resolved atmosphere/time-lighting state.
20. Create a fresh next-numbered record. It must reject
    if the assembled shader is bypassed, if CPU atmosphere values are uploaded
    as the final path/transmittance result, if celestial radiance is composed in
    RGB, or if selected-pixel parity exceeds tolerance.
21. Keep lunar surface texturing outside this expanded atmosphere gate. The
    proof may use a uniform Moon material, but record the later requirement for
    a Moon texture wrapped on the physical sphere with stable UV orientation
    derived from the shared Moon pose. Adding texture must not replace or alter
    the accepted sphere, ephemeris, depth, occultation, or radiance contracts.
22. Replace depth-only star scaffolding with a bounded multi-star boundary
    provider in the assembled shader:
    - copy a focused, provenance-labeled subset of the Flat 129-star J2000
      fixture into the reconciliation POC; do not runtime-import it;
    - retain id, RA/Dec or resolved unit direction, visual magnitude, and source
      tag as canonical input facts;
    - resolve selected observer/time directions before GPU binding.
23. Adapt the shader-lab apparent-magnitude math to the canonical spectral
    contract. Derive top-of-atmosphere 15-channel star radiance from magnitude,
    divide by pixel solid angle, and apply bounded point-spread/coverage without
    converting to RGB before atmosphere composition.
24. Support multiple simultaneous star candidates plus Moon/Sun candidates.
    Enforce sky-ray-only visibility, scene occlusion, finite Moon-over-infinite-
    star masking, deterministic ordering, and no-body behavior in the assembled
    shader.
25. Add visible-star readbacks and images for San Jose true night, twilight,
    and noon. Require known catalog-star center/edge pixels, adjacent sky,
    Moon-over-star, non-overlapping star, horizon/terrain occlusion, and a
    bright/dim magnitude pair. Reject depth-only points and captured star RGB.
26. Create a fresh immutable record. Phase 5 completes only if the same stars
    are visible when atmosphere permits, buried at noon as expected, and
    occulted by the physical Moon through the 15-channel assembled path.

Exit condition: a fresh post-013 record proves that the real assembled GPU
atmospheric shader independently evaluates spatially varying path radiance and
view transmittance, composes 15-channel celestial boundary radiance before
display conversion, renders the matched physical Three scene, and matches the
accepted CPU/soft-shader behavior within named tolerances. Record 013 alone does
not satisfy this exit condition.

Intermediate gate accepted by record 013. The browser reproduces all 18 Phase 4 selected-pixel
15-channel equations exactly, then uses an explicit three-band linear packing
bridge for raster output. A real Three scene contains a physical sphere Moon,
depth-tested star points, fixed camera and terrain geometry, and boundary-
radiance material shaders rather than captured celestial scene RGB. The matched
San Jose night/noon images retain identical geometry. Selected Moon pixels have
zero normalized error against the packed CPU expectation, within the named
`2/255` tolerance.

Record 014 is invalid because repeated attempts overwrote the same artifact
directory. It is neither accepted nor usable rejected evidence. Fresh immutable
record 015 accepts the expanded gate and uses
`buildIncidentRadianceCache(...)` per unique source direction, a dedicated Moon
scene without the test card, an aligned bounded off-center Moon, physical
sphere/depth-tested star geometry, dark terrain, and zenith, horizon, Moon-
center, adjacent-sky, and terrain readbacks across all six conditions.

Record `017-m5-visible-catalog-stars` is preserved rejected because its noon
criterion compared star pixels to the zenith rather than their locally adjacent
sky. Record 018 proves simultaneous catalog candidates and Moon occultation,
but its noon conclusion is superseded because the labeled vector put the Sun
only about 11.5 degrees above the horizon. Record 019 preserves the corrected-
altitude run rejected for overexposed daytime stars. Fresh immutable record
`020-m5-day-night-star-calibration` accepts four simultaneous catalog-derived
15-channel candidates with corrected solar altitudes, true-night bright-star
visibility, local noon burial, and Sirius occultation by the Moon.

Record 020 remains accepted for assembled-shader routing, simultaneous
candidate mechanics, prototype review visibility, and occultation. Its star
calibration is not physical promotion evidence: record 029 measures about
`39760.5x` implied integrated flux from its fixed solid-angle divisor,
star-only exposure, and `0.009 rad` top-hat footprint.

## Phase 6: Promotion Decision

Status: active; production and GPU promotion are paused at the real Flat32
scene CPU and physical-validity guards. Use records 012, 013, 015, and 020 for
the composition, browser, assembled-atmosphere, candidate, and occultation
contracts they actually prove. Use record 026 for corrected real-scene
schedule/geometry/output mechanics, record 027 only for its controlled
presentation contract, and record 029 as the current physical-calibration
decision. Record 025 is mechanics-only correction evidence and is invalid as
subjective review evidence. Record 014 is invalid, records 017, 019, and 028
remain rejected, and record 018 is not valid evidence for the noon-visibility
conclusion.

Use [Extra-Atmosphere Reset Plan](extra-atmosphere-reset-plan.md) as the only
active execution route and [Extra-Atmosphere Objects](extra-atmosphere-objects.md)
for its object/gate matrix.

Record `026-m5-flat32-globe-reviewable-cpu-soft-shader` accepts 25/25
mechanical and automated reviewability criteria. Its eight cases preserve each
location's authored date and apply the San Jose event offsets around each
location's own solar noon. Every scene owns returned-epoch-verified Sun/Moon
state and a 5 m topocentric observer. The CPU proof uses exact spherical ground,
the six authored review-box centers/yaw, a source-owned ephemeris Sun, a finite
opaque Moon with resolved per-ray and unresolved disk-integrated physical phase
shading, and named solid occlusion. It retains 32 raw queries and 79 PNGs. All
four Union review frames are nonblack; San Jose post-sunset remains
appropriately dark while retaining celestial signal.

Record 026's 25/25 mechanical and automated reviewability result is not a
human celestial-visibility result. Human review found neither the Moon nor
stars discernible in the delivered scene images, so record 026 is rejected as
the subjective celestial-visibility exit while its narrower mechanical
evidence remains usable.

Record `027-m5-flat32-controlled-celestial-visibility-cpu-soft-shader`
accepts its mechanical and automated gates with human review still pending.
Its enlarged reviewability comes from narrower camera framing at true angular
scale. The daytime Moon uses an explicitly artificial, nonastronomical
direction while preserving exact noon distance, angular size, phase, and
relative illumination; it is a controlled presentation proof, not an actual
San Jose sky claim.

Record `028-m5-flat32-calibrated-star-visibility-cpu-soft-shader` is rejected.
Reusing record 020's prototype exposure makes the post-sunset pair obvious but
fails both local solar-noon burial requirements. Do not replace it with an
exposure sweep.

Record `029-m5-flat32-celestial-physical-validity-audit` accepts `8/8` audit
criteria and reports `physicalCalibrationStatus: rejected`. It proves that the
prototype fixed solid angle does not match the runtime camera, the authored
star disks do not normalize point-source energy, and record 020's assembled
footprint implies about `39760.5x` the magnitude-derived integrated flux. The
candidate/depth/composition mechanics remain accepted; the current stellar
radiometry, footprint, night-background, and observer-visibility contracts do
not.

Correction trail: record 021 is incomplete; 022 is invalid for endpoint
lighting because rotated box normals were not transformed to world space; 023
is rejected by an overly strict comparison with Flat32's approximate Sun
formula; and 024 is rejected because it treated a real building occlusion at
San Jose sunrise as invalid. Record 025 used San Jose's June absolute epochs
for Union, wrote tone-mapped linear-sRGB directly into 8-bit review images,
undersampled unresolved Moon disks, and lacked reviewability gates; five of
eight main frames were effectively black. Existing records remain immutable.

The former single-record point-source steps are superseded. The reset now
separates typed source/basis evidence, point conservation, extended
conservation, frozen-atmosphere CPU ordering, physical source calibration, real
scenes, conditional observer claims, convergence/cleanup, and GPU/promotion
into phases `ER1` through `ER9`.

Exit condition: the reset plan's conditions 1 through 8 pass before any GPU or
production celestial-radiometry decision. This pre-reset plan supplies evidence
qualification only.

## Follow-On Investigation: Milky Way

After the first boundary-radiance contract is accepted, investigate the Milky
Way as an extended diffuse boundary-radiance provider.

Questions to answer:

- Is the first provider procedural, texture-backed, or both?
- What coordinate frame owns the galactic band or all-sky map projection?
- How is low-surface-brightness radiance calibrated relative to point stars?
- Do Sun/Moon/planet disks mask the diffuse field behind them, or simply add
  over it in the first implementation?
- What selected-pixel diagnostics explain diffuse field visibility through
  daytime, twilight, and night atmosphere?

The likely first proof is a procedural
`MilkyWayDiffuseBoundaryRadianceProvider` sampled by camera-ray direction and
composed through:

```text
pathRadiance + viewTransmittance * celestialRadiance
```

This is follow-on work. It should not block the first Milestone 5 proof for
dim stars, source-owned Sun disk, and bright Moon/planet analog behavior.
