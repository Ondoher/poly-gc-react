# Reference To Shader Goal

The cleanroom reference project is not the final renderer. Its end goal is to
make the production atmosphere shader possible, inspectable, and testable.

The reference should define the source-backed transport contract, produce
trusted spectral results and diagnostics, and give the shader/cache builder a
target to match. The shader can then use precomputed textures, reduced channel
counts, lower resolution passes, and other documented approximations without
turning those approximations into hidden physics.

## Reference End Product

The end product of what this project has been calling the reference should be
the reusable Algorithm32 module, not a separate final renderer and not a revival
of the retired one-stage-per-calculation reference pipeline.

In this context, "reference" means:

- Algorithm32 direct trace APIs that produce trusted spectral packets;
- Algorithm32 cache-builder APIs that create shader/app texture data;
- Algorithm32 parity APIs and fixtures that compare shader/cache output against
  direct traces;
- Algorithm32 profile/preset data that maps app-facing choices to explicit
  source-backed parameters.

The reference is therefore complete when Algorithm32 can be reused by tests,
artifact generation, app cache rebuilds, and shader parity. Any report images,
PNG galleries, or CLI outputs are consumers of that module, not the reference's
primary product.

## Final Target

The production path should end in a shader-driven atmosphere system that can:

- render sky rays;
- apply aerial perspective to scene objects and terrain;
- support the cleanroom spectral transport contract as the reference truth;
- use display/color transforms only after transport;
- expose diagnostics and parity captures that can be compared back to the
  cleanroom reference.

The reference owns correctness evidence. The shader owns real-time or
interactive delivery.

Long term, this same reference-to-shader shape should be able to support
non-Earth atmosphere scenes, including a possible Mars scene. That goal should
guide separation of profile, geometry, source, cache plan, and renderer
responsibilities, but it is not a current acceptance target and should not
introduce Mars constants or visual claims without a separate source-backed
profile and validation plan.

## Reference Responsibilities

The reference project should provide:

- source-backed equations, constants, and assumptions;
- canonical spectral transport outputs;
- finite object-segment transfer outputs for atmospheric color change on
  objects;
- diagnostics for optical depth, transmittance, path radiance, scattering
  components, sample counts, source configuration, and omitted effects;
- deterministic artifact generation for parity scenes;
- convergence or tolerance evidence for numerical choices;
- cache-builder algorithms that can be compared with direct reference traces.

The reference should stay independent from React, Three.js, browser render
targets, and display tuning. It can generate images and reports, but those are
evidence consumers, not the physical endpoint.

## Shader Responsibilities

The shader does not need to literally run the experiment 032 loops for every
fragment. It should implement the same public transport meaning using cheaper
runtime forms:

- precomputed transmittance, scattering, path-radiance, or irradiance textures;
- documented RGB or reduced-spectral approximations where full spectra are too
  expensive;
- depth-buffer aerial perspective for scene objects;
- quality tiers for interactive preview, settled configuration rebuilds, and
  validation capture;
- parity hooks that expose the inputs and outputs needed to compare against
  reference packets.

The shader must not hide atmosphere corrections in per-channel tint constants,
display exposure changes, or screenshot matching. If a shader approximation is
used, it needs a named policy, a cache or formula source, and a comparison
against the reference.

## Cache Strategy

The baseline spherical, distant-Sun model can use Bruneton-style lookup
textures whose coordinates include Sun/view geometry. In that model, clock time
usually changes lookup coordinates rather than forcing a texture rebuild.
Textures should be rebuilt when the atmosphere profile, coefficients, spectral
policy, resolution, or other cache-key inputs change.

The flat/local-Sun model has weaker symmetry. Source-dependent path-radiance
and scattering caches should be treated as configuration artifacts keyed by the
accepted Sun and atmosphere setup. A configuration-dialog flow can therefore
rebuild those caches after the user applies a change. Rebuilds taking seconds
are acceptable; multi-second rebuilds should report progress and allow newer
configurations to supersede stale work.

Atmosphere-only view transmittance can often be cached separately from
source-dependent path radiance because it depends on the view path and medium,
not direct source geometry. The exact split should be decided by parity tests
and cache-build cost, not by display convenience.

The production flat shader must treat flat support as a geometry and cache
coordinate variant, not as a new atmosphere model. See
[Production Flat Shader Differences](production-flat-shader-differences.md) for
the required changes to altitude, top/ground boundaries, optical-length path
geometry, Sun transmittance, cache keys, diagnostics, and parity scenes.

## Application Promotion Path

The experiment 032 algorithm may need to move into application-reachable code if
the Flat app rebuilds source-dependent atmosphere textures from a configuration
dialog. That should be treated as promoting the source-backed transport kernels
and cache-builder contracts, not copying the experimental script wholesale.

The promoted code should remain framework-free and usable by both reference
artifacts and app cache builds. The app-facing layer can own configuration,
progress reporting, cancellation, worker or GPU dispatch, texture upload, and
renderer integration. The promoted transport/cache code should own only the
canonicalized physical inputs, cache-key-relevant assumptions, texture
coordinate mapping, spectral transport calculation, and diagnostics.
The runtime Sun configuration may be a behavior-bearing object or adapter, but
cache keys, accepted app settings, and generated artifacts must serialize the
plain canonical inputs needed to recreate it.
Keep the promoted Algorithm32 transport/cache code small: prefer source
objects, geometry helpers, and cache-plan adapters for local-vs-distant Sun
differences instead of adding those policies directly to the core transport
loops.
The promoted Algorithm32 code should stay focused on transporting the incident
light field through the atmosphere, not constructing each possible light field.
If the flat local Sun later needs a "flashlight" or spotlight emission model,
that should be another source-owned angular emission profile. The reference
and shader should evaluate it before transport as part of the incident light
sample; they should not fake the effect by darkening the final rendered image.
The key model choices are beam-axis policy and energy policy: whether the cone
points by configured vector, flat-center/sub-source geometry, or diagnostic
observer targeting, and whether narrowing the cone keeps peak brightness fixed
or conserves total emitted power by brightening the beam.

This keeps one source of truth for the cleanroom algorithm while still allowing
the app to rebuild flat/local-Sun textures when accepted Sun or atmosphere
configuration changes invalidate the current cache.

## Cloud Hook

Future clouds should enter as additional medium/species data consumed by the
transport kernels and cache builder, not as a display overlay. The first cloud
validation target should be a controlled optically thin or homogeneous slab
with known optical-depth and transmittance behavior. Dense visual clouds and
cloud multiple scattering are separate extensions, not baseline clear-air
shader requirements.

## Milestones

0. Refactor Algorithm32 around a source-sampling abstraction with no behavior
   change. Implement only the current default `distant-directional-sun` source
   adapter first, then prove it still reproduces the accepted Algorithm32 sky
   domes before adding local Sun support. The adapter should return the
   existing constant Sun direction, infinite source distance, current spectral
   solar irradiance, and the same sample-to-top-atmosphere
   visibility/transmittance meaning used by experiment 032. Acceptance should
   include rerunning the current Figure 1 / experiment 032 dome path, matching
   pre-refactor spectral diagnostics within tight floating tolerance,
   preserving the no-direct-solar-disc camera policy, preserving distant-Sun
   second-order cache behavior, and matching encoded RGB dome images exactly
   or within a documented `maxAbsRgbDelta <= 1` float-ordering tolerance. Run
   this as a new focused Algorithm32 source-abstraction lane that borrows the
   sky-dome generator from the original experiment only as a fixture, not as a
   continuation of the original `bruneton_start_fresh` artifact sequence. Use
   `scripts/flat/atmosflat32/` for lane scripts and
   `tmp/atmosphere/atmosflat32/` for append-only artifacts.
   Accepted first in
   `tmp/atmosphere/atmosflat32/002-distant-source-abstraction-baseline/`, then
   revalidated after the renderer-scoped flat sky ray-limit/source-
   configuration cleanup in
   `tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/`: the
   default `distant-directional-sun` source object reproduces the four step-032
   Figure 1 sky domes with exact PNG byte parity, `9` passing criteria, and
   zero selected-ray spectral deltas. `017` remains the previous calibrated
   observer-sky regression and `015` remains the previous artificial-cap
   regression.
   Follow-up source-placement fixture accepted in
   `tmp/atmosphere/atmosflat32/005-flat-app-closest-san-jose-position/`: the
   POC reads app configuration only, independently computes closest San Jose
   approach for a `flat-local-point-sun`, and records finite direction,
   distance, apparent-size diagnostics, and map/sky-marker PNGs. This is not
   local Sun scattering validation.
   Rotation-offset first-order observer sky fixture accepted in
   `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes/`: five pure
   Algorithm32 flat/local first-order observer angular sky PNGs for the same
   local false-Sun placement at `0`, `45`, `90`, `135`, and `180` degrees from
   closest San Jose approach. The image loop matches the round distant-Sun dome
   method; transport uses flat altitude/density on z and validates local-source
   behavior through `atmosphereGeometry` configuration. A round-equivalent
   artificial cap centered at `[0, 0, -6360000]` meters with radius `6420000`
   meters and observer-level footprint radius `875.656645 km` is now a
   skydome-renderer `skyViewRayLengthLimit`, not a source-transmittance or
   scene-renderer distance. Source transmittance uses the configured flat top
   atmosphere plane and finite source distance. Transport brightness is
   calibrated so closest approach equals `1x` distant-Sun incident scale,
   replacing raw app `solarIrradianceScale: 58` with calibrated transport
   `solarIrradianceScale: 1.1071748923354825`; the 180-degree case still has
   incident scale `0.12922172063575063` and remains lit because the source is
   above the flat horizon. Direct solar-disc camera radiance, ground bounce,
   and local-source second-order cache behavior remain deferred. `018`
   supersedes `016`, `014`, `012`, and `010`.
1. Define the production reference API and packet contracts around sky rays,
   finite object segments, and diagnostics.
2. Define the cache-builder inputs, outputs, cache keys, and texture coordinate
   meanings.
3. Decide the promotion boundary for experiment 032 kernels: script-only
   reference, shared framework-free cache builder, app worker, GPU precompute
   pass, or some staged combination.
4. Build parity scenes that include sky and colored objects at distance.
5. Implement the shader against the cache contracts.
6. Compare shader captures with cleanroom reference packets and artifacts.
7. Promote only the approximations that have named error/tolerance evidence.

## Existing Evidence

- [Experiment 032 Algorithm](experiment-032-algorithm.md) records the current
  source-backed sky transport candidate.
- [Object Color Transport](object-color-transport.md) records the finite
  object-segment contract.
- [Environment Object Color Closeout](environment-object-color-closeout.md)
  records the accepted object-color proof artifacts.
- [Algorithm32 Shader Lab Plan](algorithm32-shader-lab-plan.md) records the
  first accepted Node/Three CPU reference artifact:
  `tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference/`.
  That artifact proves Three camera rays and Raycaster hits can feed
  Algorithm32 spectral sky/object transfer packets before shader adapters are
  introduced.
- [Production Flat Shader Differences](production-flat-shader-differences.md)
  records the concrete production shader changes needed to support the flat
  geometry model while keeping Algorithm32 clear-air physics unchanged.
