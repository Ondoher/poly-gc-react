# Reconciliation Status

Status: the reconciliation POC is now considered exhausted as an
evidence-generating lane. Final architectural and technical decisions are
captured in [Conclusions](conclusions.md), including the separate Three
integration lessons. Milestone 2 is closed by record `050-m2-closeout`. CPU
distant-Sun/spherical-Earth parity against the accepted Step 032 four-view
sky-dome artifacts remains accepted. The POC now has concrete flat geometry,
local Sun, local incident-cache, pre-asset diagnostic, local/flat skydome
asset, and local/flat stack-comparison records in
`tmp/atmosphere/reconciliation/025-*` through `050-*`.

Temporary divergence `3.D1` is complete and parked as visual-review evidence
before returning to the remaining shader design. The installed
local-second-order GPU shader now composes captured
scene color as an inverse-tone-mapped endpoint-radiance proxy before tone
mapping instead of adding tone-mapped scene RGB after atmosphere display
conversion. This is a visual/plausibility proxy for the settled
matte/Lambertian endpoint policy, not full
`albedo * surfaceIrradiance / PI`, because the installed shader does not yet
have clean albedo, normal, or surface-irradiance buffers. The first
`captured-linear-scene-color` proxy render, record
`096-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset`, looked
overly blue and almost snow-field-like; the likely proxy error was that
`0..1` captured scene color was not in the same pre-tone-map scale as
`skyLinearSrgb`. Camera distance remains a possible contributor to washed-blue
terrain, but the same-scene inverse-tone-map proxy rerun, record
`097-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset`, looked
much more plausible in review. Treat `097` as the current `3.D1`
visual/plausibility result for the artifact-092 sunrise-to-sunset lineage:
spherical distant Sun on the left, flat local Sun on the right, and rows from
sunrise through sunset. This remains review evidence, not a new reconciliation
milestone gate. The active design thread is again the Milestone 3 shader
design. Hit-data ownership and the CPU postprocess soft-shader contract are
settled, and the GPU validation scene-set design questions are closed into
`shader-design.md#gpu-validation-scene-set` and `shader-test-design.md`. The
ThreeGateway design questions are also closed into
`shader-design.md#threegateway-scene-synchronization`. Endpoint/depth
semantics are also settled in `shader-design.md#hit-data-itemization-and-routing`.
Shader contribution assembly is settled in
`shader-design.md#partial-shader-assemblies`. Cache texture and lookup are
settled in `shader-design.md#cache-texture-and-access-assembly` and
`shader-design.md#cache-texture-lifecycle`. Binding lifecycle is settled in
`shader-design.md#binding-contract-and-value-resolution`. The focused shader
design backlog is currently empty; implementation work can begin turning the
settled CPU soft-shader and validation scene-set contracts into types, probes,
and code.
Stage 3.1.3 is now implemented in record
`058-m3-node-three-scene-bridge`: `ThreeSceneSoftShaderBridge` captures a
Node-only Three controlled scene through `PerspectiveCamera` and `Raycaster`,
converts selected rays to the reconciliation coordinate convention, emits
`SoftShaderScenePixelInput`, and feeds those pixels through
`CpuPostprocessSoftShader`. The accepted probe covers one sky/no-hit pixel,
one fixture card hit, one ground hit, finite positive hit distances,
normalized rays, endpoint fixture ids kept out of `evaluate(...)`, and finite
soft-shader output. Browser/WebGL render-target input remains a later GPU
runner concern.
Stage 3.2.1 is now implemented in record
`059-m3-shader-scene-registry`: `scenes/shader-scene-inventory.json` seeds
the validation inventory with the accepted Node bridge row plus planned
objective rows `obj-001` through `obj-014`, and
`ShaderSceneRegistry` validates descriptor shape, stable ids, provenance ids,
extent tags, selected pixel or controlled-region targets, expected
display-pixel claims, and absence of live-browser descriptor requirements.
The record deliberately reports every seed row as pending externally sourced
final numeric RGBA materialization. Those final pixel values must come from
external fixtures or external-source-backed accepted records before a row is
used as a final numeric acceptance gate; they must not be invented from local
implementation code.
Record `060-m3-sourced-values-inventory` records the first source hunt for
those values. Source-backed numeric inputs are available for CIE 1931
2-degree color matching, ASTM G-173 solar spectrum ingestion, U.S. Standard
Atmosphere 1976 density checkpoints, and Bucholtz 1995 standard-air Rayleigh
coefficients. Final screen-pixel RGBA values are not directly available from
those references; they must be materialized as derived reconciliation-owned
fixtures through public `evaluate(...)`, the selected scene fixture data, and
`BrunetonColorDisplayModel`.
Stage 3.2.2 is now implemented in record
`061-m3-objective-scene-criteria`: every objective inventory row carries an
explicit criterion naming the claim, measurement, owner, and failure
classification. The registry validates these criteria, and the probe accepted
all 15 objective descriptors with 14 planned rows marked as required before
GPU objective runs. Final numeric RGBA materialization remains pending for
every row.
Subgoal 3.2 is now complete in record `062-m3-scene-set-completion`.
Subjective lineage rows carry the active first GPU review Southern France
no-shadow records `070` through `073`, deferred local/flat follow-on records
`077` through `080` and `086`, and the explicit Southern France shadowed
variant exclusion. The CPU scene-set completion probe generated provisional
selected-pixel CPU soft-shader outputs for every objective scene with selected
pixels and recorded zero expectation failures. Final numeric RGBA gates remain
pending external fixture or external-source-backed record materialization.
For that active endpoint/depth pass, invalid depth in objective scenes follows
the log-and-continue rule: classify affected pixels as `invalid`, omit their
scene-hit contribution, and keep the run alive.

Records 034 through 037 diagnose and fix the local/flat coordinate warnings
observed during the stack-comparison review. Records 038 and 039 regenerate
the full-size local/flat domes after the fix and create a six-column
diagnostic stack; record 029 and latest differ by 0 decoded RGBA bytes. Step
018 atmosflat images remain guide imagery only, not exact-match canon.

Follow-up blue-ring diagnosis pointed away from the warning fix and toward the
scalar no-hit cap transition. Record 040 implements the M2 observer-centered
finite dome in `FlatEarthGeometry`, using apex altitude `60000 m` and
`maxObserverViewRayExtentMeters = 875656.6450361694` to derive sphere center
`[0, 0, -6360000]` and radius `6420000`, then regenerates all five full-size
Step 018-rotation PNGs. Record 041 creates the requested two-column stack:
atmosflat Step 018 guide imagery on the left and the new observer-dome
reconciliation imagery on the right, with no diff column. Record 042 adds the
requested third-column absolute diff x3 stack against the same latest
observer-dome images.

More generally, flat geometry should resolve ray lengths by candidate-distance
selection across ground/top planes, dome spheres, optional radial map extents,
supplied scene/hit/max distances, and source-owned path limits. Map-centered
dome behavior is a separate full-world profile. This change moves the images
away from atmosflat Step 018, so the new local/flat dome artifacts are
subjective model-inspection and error-spotting images backed by selected-ray
diagnostics, not exact-match targets. The dome truncates the unchanged
altitude-based atmosphere composition; it should not compress or rescale
density, scattering, or absorption profiles near the edge. A future
compressed-atmosphere model would be a separate 3D medium/composition profile,
not a one-dimensional altitude adjustment. Reflective dome properties are also
a future named extension: the dome would become an optical boundary/material,
not merely the current spatial exit surface.

An additional subjective M2 skydome scene set is rendered in
`043-m2-summer-solstice-latitude-skydomes`:
`san-jose-longitude-summer-solstice-latitude-sweep`. It keeps the San Jose
longitude, uses observer latitudes `80N`, `30N`, equator, `30S`, and `80S`,
and uses closest false-Sun approach on summer solstice. The source latitude is
resolved from the documented `annual-tropic-migration` model at
`2026-06-21T12:00:00-07:00`, which resolves to `23.5 deg N`, before applying
the closest-horizontal-approach rotation. Brightness calibration for the set
is anchored once at that same `23.5N` source latitude and San Jose longitude,
representing the local solar-noon/subsolar reference event, and the resulting
reference spectral incident scale is reused for all five latitude rows. It
does not replace the Step 018 rotation set and has no guide-image parity
target.

Record `044-m2-synchronized-noon-flat-spherical-skydomes` adds the reusable
`san-jose-longitude-summer-solstice-synchronized-noon-latitude-sweep` set. It
uses the same latitude list, common longitude, source-latitude brightness
calibration, and summer-solstice source latitude, but every row is rendered at
the same synchronized solar-noon source longitude. The scene frame is
observer-local `x=east`, `y=north`, `z=up`, so north is up in each flat and
spherical source PNG. The final artifact is a two-column stack with flat
finite-source rendering on the left and matching spherical distant-source
rendering on the right:
`tmp/atmosphere/reconciliation/044-m2-synchronized-noon-flat-spherical-skydomes/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.

Record `045-m2-greenwich-noon-flat-spherical-skydomes` adds the
Greenwich-noon reusable comparison set
`san-jose-longitude-summer-solstice-greenwich-noon-latitude-sweep`: the
observer/render longitude remains San Jose, but the render clock is
synchronized to solar noon at longitude `0`, so the Sun is off the north/south
meridian in the north-up images. Its final two-column stack labels every flat
and spherical image with Sun azimuth clockwise from north and altitude above
the horizon:
`tmp/atmosphere/reconciliation/045-m2-greenwich-noon-flat-spherical-skydomes/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.

Record `046-m2-45east-noon-flat-spherical-skydomes` supersedes that default
with `san-jose-longitude-summer-solstice-45east-noon-latitude-sweep`: the
observer/render longitude remains San Jose (`-121.8863`), while the
synchronized solar-noon/source-subpoint longitude is `-76.8863`, exactly 45
degrees east of San Jose. This keeps the Sun off the north/south meridian and
keeps the spherical distant Sun above the horizon through the `30S` row. Its
captioned two-column stack is
`tmp/atmosphere/reconciliation/046-m2-45east-noon-flat-spherical-skydomes/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.

Record `047-m2-north-pole-summer-solstice-gmt-sweep` adds the requested North
Pole GMT clock sweep, `north-pole-summer-solstice-2026-gmt-4hour-sweep`: it
renders at latitude `90N`, longitude `0`, date `2026-06-21`, every four hours
from `00:00 GMT` through `20:00 GMT`. The source subpoint longitudes are
derived from the UTC clock as `180`, `120`, `60`, `0`, `-60`, and `-120`,
with source latitude `23.5N`. Its captioned two-column stack is
`tmp/atmosphere/reconciliation/047-m2-north-pole-summer-solstice-gmt-sweep/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.

Record `048-m2-south-pole-winter-solstice-gmt-sweep` renders the South Pole
winter-solstice counterpart, `south-pole-winter-solstice-2025-gmt-4hour-sweep`:
latitude `90S`, longitude `0`, date `2025-12-21`, every four hours from
`00:00 GMT` through `20:00 GMT`, using the same UTC source-longitude cadence
and a source latitude of about `23.4995S`. Its captioned two-column stack is
`tmp/atmosphere/reconciliation/048-m2-south-pole-winter-solstice-gmt-sweep/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.

Record `049-m2-union-glacier-final-experiment-gmt-sweep` renders the Union
Glacier Final Experiment review set,
`union-glacier-final-experiment-2024-dec15-gmt-4hour-sweep`: latitude
`-79.768036`, longitude `-83.261666`, elevation `700 m`, date `2024-12-15`,
and UTC rows every four hours from `00:00 GMT` through `20:00 GMT`. Its source
latitude resolves to about `23.4258S`, and its captioned two-column stack is
`tmp/atmosphere/reconciliation/049-m2-union-glacier-final-experiment-gmt-sweep/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.

Record `050-m2-closeout` accepts M2 as a CPU local/flat method-confidence POC
milestone and explicitly leaves production/shader requirements outside the M2
acceptance claim. This is subjective model-inspection evidence, not a new
exact parity target.

The previous next work was Milestone 4.3.2 review-gallery recreation, but the
POC is now closed for conclusions instead of more review tuning. Keep browser
execution, screenshots, CPU postprocess checks, and parity records in the
action plan / experiment runner layer rather than in the shader operation
design if a future focused experiment resumes this lane.

Non-negotiable M3 baseline rule: do not reimplement validated behavior in
adapters, runners, comparisons, or shader-support helpers. The only baseline
surfaces are public `evaluate(...)`, already implemented configuration
endpoints, and the validated Bruneton-based dome rendering color adapter
outside Algorithm32 transport. Do not call lower-level algorithm, calculator,
cache, geometry, source, or atmosphere internals, and do not recreate copied,
derived, or approximate baseline behavior. New GPU GLSL is the implementation
under test, never the CPU/reference baseline.

The hit-data itemization and ownership design pass is complete and has been
removed from the focused shader-design backlog. Its conclusions now live in
`shader-design.md#hit-data-itemization-and-routing` and
`shader-test-design.md`: opaque matte/Lambertian color contributes after
transport as `albedo * surfaceIrradiance / PI`, then composes as
`endpointRadiance * T_view + L_path`; geometry receives only spatial hit facts
through `evaluate(...)`; endpoint color/material facts stay outside
`evaluate(...)`; RGB/display color never enters `evaluate(...)`; objective
scenes use canonical spectral fixtures keyed by `spectralReferenceId`; and
fixture values must be proven through to rendered pixels. The CPU postprocess
soft-shader contract design questions are also complete and have been removed
from the focused backlog. Its conclusions now live in
`shader-design.md#cpu-postprocess-shader`: baseline access is fixed to
`evaluate(...)`, implemented configuration endpoints, and the validated color
adapter; shader output packet shape belongs to shader/comparison diagnostics,
not the CPU soft-shader input contract; executable profile support follows
milestone needs; diagnostics are selected/aggregate/bounded-probe only, never
per rendered pixel; and scene input source support follows
`shader-test-design.md`. The GPU validation scene-set questions are also
settled and now live in `shader-design.md#gpu-validation-scene-set` and
`shader-test-design.md`. ThreeGateway questions are also settled and live in
`shader-design.md#threegateway-scene-synchronization`. Endpoint/depth
semantics are also settled in `shader-design.md#hit-data-itemization-and-routing`.
Shader contribution assembly is settled in
`shader-design.md#partial-shader-assemblies`. Cache texture and lookup are
settled in `shader-design.md#cache-texture-and-access-assembly` and
`shader-design.md#cache-texture-lifecycle`; the contract anticipates
local-source cache textures so M4 local/flat GPU work should be implementation
against the settled abstraction, not a redesign. Binding lifecycle is settled
against setup/config/frame ownership, single-pass frame bindings,
rebuild-vs-refresh policy, and stable hash fingerprints. The focused
shader-design backlog is currently empty.

The shader design now has a dedicated
`Hit Data Itemization And Routing` section. It is the canonical home for
scene-hit datum ownership and routing. The completed decision is
geometry-only hit input for `evaluate(...)`, with endpoint contribution
introduced after transport. Display-domain RGB remains diagnostic unless a
later named color/material policy accepts it outside `evaluate(...)`. The
preferred RGB-to-spectrum direction, if ever needed, is an inverse-fit against
the validated Bruneton-based spectral-to-display adapter; all such conversion
belongs to the color abstraction and remains gated behind Stage 3.1.0b only if
RGB-derived endpoint spectra become necessary. Mined soft-shader evidence
supports the settled direction: hit mask and hit distance drive transport,
while `spectrum-id` fixtures and captured RGB are post-transfer composition
policies. Stage 3.1.0a is now optional validation evidence, not a fork-closing
decision for the first contract.
Objective scenes should resolve endpoint spectral radiance from a small
canonical fixture table keyed by `spectralReferenceId`, with explicit values
over `CANONICAL_SPECTRAL_CHANNELS`. This is the first validation path for
wavelength-specific expectations. Direct per-scene spectral authoring is only
for adding or diagnosing fixtures with provenance, and renderer material-id
lookup is deferred as a later production/material policy.
The key verification is fixture-to-pixel propagation: objective records must
show the fixture lookup values, the pre-display composed spectrum, the
expected display RGB/RGBA from the validated Bruneton-based color adapter, and
the observed CPU/GPU rendered pixels at selected pixels or controlled regions.
`shader-test-design.md` is now the focused test-design document for Milestone
3. It specifies what shader scenes should test, how to build objective and
subjective scenes, and how rendered pixels prove or fail shader correctness.
The shader design and action plan now include a required experimental data
checklist for that stage limited to measurements: hit facts, endpoint fixture
values, `L_path`, `T_view`, endpoint-enabled/disabled outputs, post-spectral
color-composed output, deltas, visibility metrics, and classification. That
stage is now validation evidence, not a fork-closing decision for the first
contract: scene-hit `evaluate(...)` input is spatial only, such as ray
distance or equivalent geometry context, and matte/Lambertian endpoint
radiance is introduced after `evaluate(...)`. If research resolves later
RGB-derived endpoint questions, the record can classify additional
experiments as not required for the current contract. Scene
descriptors, provenance, tolerances, and `run.log` remain required record
metadata, not experimental measurements. Temporary divergence `3.D1` is the
installed-GPU-shader review pass for this policy. It targets the
local-second-order artifact-092 sunrise-to-sunset gallery, with spherical
distant Sun on the left and flat local Sun on the right. The current proxy
uses the inverse of the installed shader's display tone map to place captured
scene color in the same pre-tone-map composition scale as the sky radiance.
That divergence is review evidence only and is not required for progress on
the first reconciliation implementation.
All focused shader-design backlog items now follow the same review shape:
current unresolved scope, recommendation, and open questions requiring user
input. This makes the backlog a design review queue rather than a loose list
of reminders.

Scene-object intersections are a geometry-boundary concern. Scene inputs may
carry finite hit facts or a scene-intersection provider into `evaluate(...)`;
`evaluate(...)` passes that spatial context to geometry for view-ray
segmentation and future source/light path occlusion. That spatial context is
optional: when no early scene-object termination is supplied, geometry already
has enough information to resolve the ray from its atmosphere, ground, and
domain-boundary rules. Endpoint radiance or captured scene color remains
outside geometry and is used only by postprocess composition. This is an
additive Algorithm32 evaluation parameter, but it must be validated in M3
before promotion: no-hit rays must preserve baseline behavior, finite scene
hits must shorten only geometry-resolved segments, and endpoint radiance/color
must not leak into geometry or transport. The same contract is mirrored in the
Algorithm32 production design.
This ray termination is required for correct scene-object color: `T_view` and
`L_path` must be computed for the viewer-to-object path before composition
uses `endpointRadiance * T_view + L_path`.

If a scene hit contributes color, material, or surface radiance, that endpoint
contribution travels beside the spatial hit facts but goes to the color/display
or postprocess composition boundary. Geometry receives only the spatial hit
context needed for segment length and occlusion.

General rule for M3: scene-derived effects that affect Algorithm32 are routed
by descriptor/setup configuration, then adapters compile them into typed
domain fields. For scene-hit handling, `evaluate(...)` receives only typed
scene-intersection context or equivalent spatial/domain facts such as ray
distance. It must not receive endpoint spectral contribution,
caller-supplied owner/route metadata, material/color facts, or any RGB/display
color data. Contributions without a
descriptor-declared owner should be rejected by setup or scene-input
validation instead of becoming transport branches. The settled CPU
soft-shader and GPU validation scene-set design sections carry that rule for
baseline and scene inventory work; the settled ThreeGateway, endpoint/depth
semantics, display/composition, and objective verification sections carry it
through the shader design.

The first real Milestone 3 deliverables are the CPU postprocess soft-shader
and the reusable GPU validation scene set. The soft-shader must consume
reconciliation-owned scene inputs, create evaluation requests from scene
facts, compose every pixel as `endpointRadiance * T_view + L_path`, and route
all atmosphere calculation through the public reconciliation `evaluate(...)`
operation. It must not call
`SpectralCalculator`, geometry, atmosphere, light-source, cache, or other
algorithm internals independently. Rays that exit the atmosphere simply have
no endpoint radiance contribution; they are not a separate transport branch.
The scene set must be usable by both CPU
postprocess and GPU shader runs. Both run against the same objective tests as
the primary gate; comparison between CPU soft-shader and GPU shader outputs is
secondary consistency and mismatch-classification evidence. It must separate
objective scenes that test specific hypotheses/facts from subjective review
scenes used for human plausibility inspection. Numeric tolerances are owned by
`shader-test-design.md`, not by individual scene descriptors, and should be
based on human vision limitations. Objective tests should be grouped into
themed composite scenes that amortize long CPU soft-shader runs without making
the artifact too cluttered to understand. Shader-lab and local-second-order
implementations are
scene-input/composition/scene-lineage references, not substitute transport
implementations. The subjective local-scene lineage to borrow is the Southern
France mesh family. The first GPU review gallery must carry the accepted
no-shadows Southern France OBJ diffuse source-matrix rows `070` through
`073`. The Southern France mesh lineage is no-shadow only because the mesh has
baked shadow/detail and is not suitable evidence for shadow validation.
Preserve fitted local-angle rows `077` through `079`, local vertical
stack `080`, and optional star-field stack `086` as local/flat follow-on
review scenes unless a nearer GPU review need pulls them forward.

[Shader Design](shader-design.md) is the current Milestone 3 architecture
target for shader operation. It defines setup/config/runtime lifecycles,
abstraction-owned shader contributions, binding resolution, symbol inventory,
cache texture handling, `ThreeGateway`, pass installation, diagnostics,
invalidation, and the CPU postprocess shader scene-input contract. It is
deliberately not a browser/test-runner design: scene capture, screenshots,
image comparison, and artifact records stay outside it. The document is now
organized into six architectural parts: orientation, responsibility model,
shader product assembly, runtime data and binding, lifecycle operations, and
integration/policy.

Current shader handoff facts:

- `ThreeGateway` is the Three/WebGL boundary for setup/runtime capability
  facts and pass attachment. It does not own Algorithm32 physical facts.
- Image capture stays in the experiment/browser-runner layer. Other useful
  operational information should flow through bounded diagnostics, capability
  packets, setup reports, or selected shader diagnostic outputs.
- Scene builders decide whether to include scene lighting. Algorithm32/source
  configuration supplies lighting parameters in predefined units, and
  `ThreeGateway` only synchronizes those values onto requested app-owned or
  scene-builder-owned Three light handles.
- Setup and configuration update lifecycles are owner-centered tables. They
  identify which abstraction contributes descriptors, assemblies, values,
  validation, bindings, resources, pass installation, and diagnostics.
- First POC shader assemblies are plain objects returned by the owning
  abstractions, not separate assembly classes per owner.
- The incident-radiance cache owns cache data, cache texture shape, texture
  creation requests through `TextureBuilder`, cache lookup/access assembly,
  sampler requirements, and coordinate requirements. `TextureBuilder` is only
  a mechanical texture helper. It may choose the available texture
  format/packing/kind for the requested dimensions, but must return the
  matching low-level access contribution, commonly a generated global fetch
  helper function with its function name/call target. The helper may be
  generated for a specific texture instance when packing/layout/sampler facts
  require it, so cache-owned semantic lookup stays correct.
- Cache miss diagnostics are POC debug/validation-only and bounded, such as
  selected-pixel GPU diagnostic passes or aggregate counters. Production
  diagnostics are deferred until there is a holistic diagnostics plan.
- `ShaderBuilder` consumes the cache-owned texture handle, binding
  requirement, and access contribution; it validates the symbol inventory,
  assembles source, and compiles. It does not infer cache semantics.
- Symbol validation treats unused provided symbols as warnings, including
  objective GPU runs. Missing required symbols and duplicate providers are
  setup failures unless explicitly allowed.
- `ShaderResourcePreparer` handles non-cache GPU resources; `ShaderBinder`
  resolves and applies setup/config/frame bindings, including the cache
  texture sampler supplied by the cache.
- Binding lifecycle first design assumes one camera/pass per frame. Multi-view
  can be modeled later as repeated pass invocations with distinct frame
  bindings.
- Binding lifecycle rebuild policy: full shader rebuild happens only when a
  change affects shader assembly/source/material shape. Existing binding value
  changes refresh uniforms, textures, or resources without recompile.
- Binding fingerprints require a stable hash for compatibility and reuse
  decisions. Human-readable JSON snapshots are deferred diagnostic support.
- Display/composition policy now treats the installed GPU shader's primary
  operational output as display RGB/RGBA written to the active Three render
  target or canvas. Spectral or diagnostic buffers are optional
  validation/debug outputs, not the shader product output. This is rooted in
  Three shader semantics: fragment shaders define per-fragment color in the
  `WebGLRenderer` render pipeline.
- Endpoint RGB diagnostic composition is not retained as a shader-owned
  per-pixel diagnostic. Any endpoint-RGB comparison belongs to the test runner,
  compares rendered display output only, and must not claim spectral parity.
- Exposure/debug modes are not part of first shader operation unless a
  specific validation or product need arises. Runner-side visualization
  controls are the default home for those concerns.
- First-pass browser/GPU numeric tolerance for secondary CPU-vs-GPU comparison
  should be grounded in human visual perception. The shader test design owns
  the specific threshold and evidence.
- Image-level acceptance metrics are selected by objective test need: specific
  pixels, controlled regions, whole-image metrics, or a documented
  combination. Both soft-shader and GPU shader runs are gated against the same
  objective scene claims; soft-vs-GPU comparison is secondary evidence.
- Browser/GPU rendered artifacts do not get a default exact pixel-match gate.
  Exact match is reserved for CPU-only artifacts, deterministic descriptor
  snapshots, and other non-browser/reference outputs unless a later GPU test
  proves the whole browser/render-target/readback path is deterministic enough
  for an exact claim.
- Browser runner protocol follows the local-Sun experiment model: a
  long-running watcher monitors for JSON job files to open. Liveness is judged
  from an updating progress log. Comparisons may use in-memory buffers, but
  all retained visual artifacts should be saved as PNG files.
- Local/flat GPU follow-on is anticipated through abstraction boundaries,
  cache ownership, and contribution assembly shape, without unused local/flat
  branches in the distant/spherical shader. Descriptor/schema validation tests
  only mandatory contract facts and accepts them from any abstraction; optional
  unsupported facts are profile-specific unsupported classifications rather
  than concrete-type gates. The first local/flat subjective smoke scene is
  user-selected when requested, and finite-dome versus local-cache validation
  has no required ordering.
- The CPU postprocess shader section records the accepted
  `postprocessSceneInput(...)` scene-input lineage from shader-lab and
  local-second-order, but normalizes the composition contract to
  `endpointRadiance * T_view + L_path`. The references define scene-input
  lineage only; the reconciliation implementation must route all atmosphere
  calculation through the public `evaluate(...)` operation from the completed
  CPU work.
- The focused shader-design backlog is currently empty. Add new items only
  when implementation reveals a focused design gap that should be settled
  before more code is written.
- Current CPU hit-color status: records `218` through `220` restore the
  local-second-order captured scene-color composition path. Only ray and
  finite hit distance enter `evaluate(...)`; captured hit color remains
  outside transport and is composed with spectral path radiance/transmittance
  in the display/color layer. The matte/Lambertian record `215` is retained as
  a superseded detour for this lane, not the current blocker.
- Color/display must use the current Bruneton-based display conversion
  directly through `color/BrunetonColorDisplayModel.js` and
  `FIGURE1_DISPLAY_CONSTANTS`, which preserve the accepted Step 032 dome
  artifact color path. `Figure1SkyDomeRenderer` consumes that
  `ColorDisplayModel`; the CPU soft-shader and GPU shader should use the
  color model boundary without reimplementing, deriving, or approximating a
  parallel color conversion.
- Implementation inventory decisions are settled: the CPU postprocess
  soft-shader lives in `soft-shader/`, parallel to the GPU `shader/` folder;
  scene ids live in a JSON inventory that can carry metadata and later resolve
  to code modules; every implementation folder owns its own `types.d.ts`.
- `action-plan.md` Milestone 3 now matches the settled shader design: objective
  scene claims are the primary gate for both CPU soft-shader and GPU shader
  runs, CPU-vs-GPU comparison is secondary evidence, browser work follows the
  JSON-job/progress-log/PNG-artifact protocol, and planned files follow the
  `soft-shader/`, `shader/`, `scenes/`, `comparison/`, and `browser/` folder
  split.
- `shader-test-design.md` now carries the first explicit objective test
  inventory, data-source/provenance table, and extent coverage matrix.
  Objective shader tests must prove actual screen pixels or controlled pixel
  regions, and each objective scene must name selected pixels, expected
  display output, and a data source or accepted fixture trail. Current local
  provenance includes the accepted Step 032 display basis, CIE 1931 2-degree
  CMFs, ASTM G-173, U.S. Standard Atmosphere rows, Bucholtz Rayleigh rows,
  controlled ray-path fixtures, and mined shader-lab endpoint spectra as seed
  material only until copied into reconciliation-owned fixture data.
- Stage 3.1.1 is complete in record
  `tmp/atmosphere/reconciliation/055-m3-ambient-types-cleanup-scene-input-contract`
  after the ambient type-file cleanup. The original acceptance record is
  `tmp/atmosphere/reconciliation/051-m3-soft-shader-scene-input-contract`.
  The POC now has the CPU soft-shader scene-input adapter contract under
  `scripts/flat/reconciliation/POC/src/soft-shader/`: ambient contract types
  live in `types.d.ts`, and `SoftShaderSceneInputAdapter.js` prepares one
  scene pixel into a geometry-facing `SpectralEvaluationRequest` plus
  separate endpoint contribution data. The accepted probe verified finite
  hits become `viewRayRequest.endDistanceMeters`, no-hit and invalid
  intersections do not invent finite caps, endpoint contribution does not
  enter `evaluate(...)`, RGB/display fields are rejected before request
  construction, and non-opaque endpoints are rejected.
- Stage 3.1.2 is complete in record
  `tmp/atmosphere/reconciliation/056-m3-ambient-types-cleanup-soft-shader`
  after the ambient type-file cleanup. The previous color-boundary acceptance
  record is
  `tmp/atmosphere/reconciliation/054-m3-cpu-soft-shader-color-model-rerun`.
  The earlier `052-m3-cpu-postprocess-soft-shader` run was superseded by the
  color-boundary correction. The POC now has
  `soft-shader/CpuPostprocessSoftShader.js`, which prepares pixels through
  `SoftShaderSceneInputAdapter`, calls the public evaluator surface, composes
  endpoint radiance after transport, and emits bounded selected-pixel and
  aggregate diagnostics. The Step 032 spectral-to-display conversion now
  lives behind `color/BrunetonColorDisplayModel.js`, an implementation of the
  expanded `ColorDisplayModel` contract; `Figure1SkyDomeRenderer` consumes
  that model instead of owning color conversion.
- All POC `types.d.ts` files under `scripts/flat/reconciliation/POC/src/`
  now follow the production ambient declaration style: no `export {}`, no
  imports, and no `declare global` wrapper. This keeps the types visible to
  VS Code as standard ambient declarations.
- The color-display implementation formerly named `Figure1ColorDisplayModel`
  is now `BrunetonColorDisplayModel`, verified in
  `tmp/atmosphere/reconciliation/057-m3-bruneton-color-display-model-rename`.
  The Figure 1 name remains only on the artifact renderer and constants that
  are actually Figure 1 specific.
- The initial implementation inventory now uses `TextureBuilder`; do not add
  another generic intermediate builder between the cache and its
  texture/access representation.
- Subgoal 3.3 is complete. Stage 3.3.1 accepted in
  `tmp/atmosphere/reconciliation/063-m3-shader-descriptor` with a
  deterministic distant/spherical shader descriptor built from CPU-side
  Algorithm32 constants and the validated Bruneton display model. Stage 3.3.2
  accepted in `tmp/atmosphere/reconciliation/064-m3-shader-assembly` with
  `Algorithm32ShaderAssembler`, `DistantSphericalShaderContributionFactory`,
  `ShaderCompatibilityValidator`, and `TextureBuilder`. The assembler is
  profile-generic; local/flat should arrive through abstraction-owned
  contributions and cache texture/access ownership, not assembler branches.
  The accepted assembly emitted one allowed unused-symbol warning for
  `light.sourceDirection`.
- Subgoal 3.4 implementation is complete. Stage 3.4.1 accepted in
  `tmp/atmosphere/reconciliation/065-m3-browser-watcher-dry-run` with a
  reconciliation-owned `BrowserShaderJobRunner`, ambient browser types,
  `browserShaderWatcher.js`, a JSON command file, and live `progress.json`
  output verified without launching Chromium. Stage 3.4.2 accepted in
  `tmp/atmosphere/reconciliation/066-m3-browser-diagnostics-readiness` with
  the browser page wired for WebGL vendor/renderer/version, precision,
  extensions, shader compile/link logs, selected-pixel readback, PNG output,
  and artifact diagnostics. Real browser values and PNGs are produced by the
  user-run watcher:
  `node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --watch`.
  The first user-run watcher evidence is accepted in
  `tmp/atmosphere/reconciliation/068-m3-browser-watcher-user-run-evidence`.
  It snapshots watcher output
  `tmp/atmosphere/reconciliation/browser/001-capability-smoke`, with WebGL2
  on `ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 Direct3D11 vs_5_0 ps_5_0,
  D3D11)`, high-float precision `23`, clean vertex/fragment compile and link
  logs, three selected pixel readbacks, and both screenshot/canvas PNG
  artifacts present. Record `067-m3-browser-watcher-user-run-evidence` is a
  rejected probe-shape attempt that read the wrong diagnostics packet.
  The watcher now also echoes startup details, job transitions, completion
  status, output paths, and periodic heartbeat status to the terminal; the
  canonical liveness packet for future runs is
  `tmp/atmosphere/reconciliation/progress.json`.
  Record `tmp/atmosphere/reconciliation/069-m3-browser-command-done-guard`
  verifies the watched command file now carries `status: "done"` plus
  completion metadata after the accepted run, so restarting the watcher does
  not rerun the same command.
  Record `tmp/atmosphere/reconciliation/070-m3-browser-output-root-alignment`
  changes the default watcher output root to the main reconciliation record
  folder, so future browser jobs create ordinary
  `tmp/atmosphere/reconciliation/NNN-*` records with the rest of the lane.
  The earlier `tmp/atmosphere/reconciliation/browser/001-*` through `003-*`
  folders are legacy watcher output from before this correction.
- Subgoal 3.5 has first browser smoke evidence in
  `tmp/atmosphere/reconciliation/071-m3-assembled-shader-browser-smoke` and
  `tmp/atmosphere/reconciliation/072-assembled-distant-spherical-smoke`.
  The current assembled distant/spherical Algorithm32 fragment shader was
  submitted through the user-run watcher, compiled, linked, rendered, produced
  three selected-pixel readbacks, wrote screenshot/canvas PNGs, and left the
  watched command file marked `status: "done"`. This is only a
  compile/link/readback smoke; all three selected pixels were black
  `[0, 0, 0, 255]`, so it is not objective scene parity and makes no rendered
  physics/color claim. The next Subgoal 3.5 work is integrated objective
  scene comparison against the validation scene set and CPU soft-shader
  outputs.
- Records `tmp/atmosphere/reconciliation/073-m3-assembled-shader-visible-smoke`
  and `tmp/atmosphere/reconciliation/074-assembled-distant-spherical-smoke`
  supersede the first black-canvas smoke diagnostic with visible-range browser
  smoke bindings. The assembled shader source hash was unchanged, the browser
  page now requires at least one selected pixel to be non-black, and record
  `074` accepted 10/10 browser criteria with selected readbacks
  `[174, 174, 174, 255]`, `[255, 255, 255, 255]`, and `[6, 6, 6, 255]`.
  This remains diagnostic plumbing evidence only; objective scene parity is
  still the next Subgoal 3.5 task.
- Records `tmp/atmosphere/reconciliation/075-m3-integrated-objective-scene-comparison`
  and `tmp/atmosphere/reconciliation/076-m3-integrated-objective-scene`
  complete the first integrated objective-scene browser plumbing run. The
  runner uses the accepted `shader-lab-node-controlled-reference` scene and
  sends its Three camera matrices plus selected-pixel coordinates through the
  browser watcher. Browser criteria accepted 12/12, including camera matrix
  bindings, assembled shader compile/link, selected-pixel readback, non-black
  output, and PNG artifacts. The record deliberately does not claim parity:
  all three GPU selected pixels read `[179, 179, 179, 255]`, while the CPU
  soft-shader bridge records distinct sky/card/ground outputs. The next real
  implementation gap is per-pixel scene depth/hit termination and endpoint
  composition in the assembled shader; today it still has only uniform
  `uSceneTerminationMeters`.
- Records `tmp/atmosphere/reconciliation/077-*` through
  `tmp/atmosphere/reconciliation/086-m3-integrated-objective-scene` iterate
  that blocker to an accepted selected-pixel POC gate. The shader now reads
  per-pixel fixture depth as scene termination, composes endpoint color for
  hit pixels, and the browser harness creates/binds scene color and depth
  textures without overwriting texture unit 0. Record `085` accepts
  `cpu-gpu-selected-rgba-within-3-bytes`; record `086` is the browser
  artifact folder. Selected comparisons are sky CPU `[3, 2, 2, 255]` vs GPU
  `[5, 5, 5, 255]` with max delta `3`, card CPU `[13, 10, 10, 255]` vs GPU
  `[13, 11, 9, 255]` with max delta `1`, and ground CPU `[8, 6, 6, 255]` vs
  GPU `[9, 7, 5, 255]` with max delta `1`. This is still a POC
  selected-pixel gate: final objective-scene numeric RGBA gates need external
  fixture or external-source-backed materialization before final M3 parity
  closeout.
- Records `tmp/atmosphere/reconciliation/087-*` through
  `tmp/atmosphere/reconciliation/092-m3-integrated-objective-scene` move the
  browser artifact from the synthetic fixture texture canvas to a real browser
  Three scene render. Records `087/088` and `089/090` are rejected local Three
  module import attempts while the already running watcher could not load the
  full module dependency chain. Record
  `091-m3-real-browser-three-scene-three-core` submits the accepted
  `assembled-three-scene-comparison` command, and record `092` is the browser
  artifact. The browser page renders the controlled card/ground/sky Three
  scene into a 320x180 render target, builds a per-pixel hit-distance texture
  with `THREE.Raycaster`, runs the assembled Algorithm32 shader over those
  full-scene textures, and writes a scene-shaped `canvas-image.png`. Selected
  readbacks are sky `[4, 4, 4, 255]`, card `[13, 11, 9, 255]`, and ground
  `[9, 7, 5, 255]`. This is the first real Three integration image; final M3
  numeric parity still requires external fixture or external-source-backed
  expected RGBA materialization.
- Records `tmp/atmosphere/reconciliation/093-*` through
  `tmp/atmosphere/reconciliation/100-m3-integrated-objective-scene` iterate the
  real Three scene from "technically integrated" to visually complete. The
  shader now uses RGB-channel Rayleigh/Mie coefficients instead of equal-channel
  atmosphere shortcuts, maps browser Three camera rays into the spherical
  observer-local frame, and integrates the view path with a 40-sample loop
  instead of a single midpoint sample. Record `100` is the current best real
  Three integration artifact: its PNG shows blue sky, horizon gradient, ground
  plane, centered card, per-pixel hit termination, and endpoint scene color
  composition together. Selected readbacks are sky `[112, 180, 231, 255]`,
  card `[91, 80, 68, 255]`, and ground `[68, 53, 40, 255]`.
- Records `tmp/atmosphere/reconciliation/101-m3-subjective-southern-france-solar-noon`
  and `tmp/atmosphere/reconciliation/102-m3-subjective-southern-france-solar-noon`
  are superseded for camera framing: they used the early low Southern France
  ridge-view camera rather than the later accepted high review camera. Records
  `tmp/atmosphere/reconciliation/103-m3-subjective-southern-france-high-camera-solar-noon`
  and `tmp/atmosphere/reconciliation/104-m3-subjective-southern-france-solar-noon`
  rerender the same request through that assembled distant/spherical browser
  shader path with the accepted high Southern France camera profile: camera
  `[0, 6200, 15800]`, look-at `[0, 4200, -56000]`, and vertical FOV `62`.
  The run treats "today" as `2026-07-04`, uses the no-shadow Southern France
  OBJ lineage as a geometry-only matte terrain fixture, approximates the
  review location as `44N`, `6E`, and places the Sun on the local solar-noon
  meridian. Browser criteria accepted, PNG artifacts were written, the shader
  compile/link logs were clean, and selected readbacks were sky
  `[109, 172, 223, 255]`, ridge `[205, 240, 249, 255]`, and lower terrain
  `[57, 106, 164, 255]`. This is subjective review evidence, not an
  externally sourced numeric parity gate.
- Records `tmp/atmosphere/reconciliation/105-*` through `114-*` iterate the
  Southern France sunrise-to-sunset subjective gallery against the
  local-second-order `097` left-column visual target. Records `107/108` copy
  the accepted `097` sunset-yawed camera/look-at and yaw-aligned terrain fit.
  Records `109/110` copy the `097` `960 x 540` row size, 2x internal
  render/downsample path, `13:09` local-solar-noon clock, row times, solar
  declination seed, and scene directional-light intensity. Records `111/112`
  are the current best close-match result: diffuse textured terrain, copied
  framing, dark orange sunrise/sunset rows, extracted row PNGs, and a
  reference/latest/diff comparison under
  `tmp/atmosphere/reconciliation/112-m3-subjective-southern-france-daylight-stack/comparison/`.
  Record `113/114` is preserved as a rejected/rolled-back tuning attempt. This
  is subjective review evidence, not an externally sourced numeric parity gate.
- Records `tmp/atmosphere/reconciliation/115-*` through `142-*` diagnose and
  fix the missing Southern France sunset-gradient path. The no-mesh ocean
  diagnostic ruled out terrain mesh occlusion as the primary cause. The
  browser scene had been using a flat catch floor in a distant/spherical
  shader pass, and the one-channel depth no-hit sentinel collided with
  color-managed readback values. The helper floor is now an observer-local
  spherical Earth mesh centered one Earth radius below the camera tangent
  point. The depth texture encodes real early scene hits as grayscale distance
  and no-hit pixels as magenta; the assembled shader uses that chroma mask so
  an early scene hit terminates the normal ray segment length calculation,
  while no-hit pixels resolve through geometry to atmosphere exit. Record
  `140` verifies the no-mesh ocean diagnostic now has about `46%` early scene
  hits and `54%` no-hit/atmosphere-exit pixels. Record `142` applies the same
  fix to the full Southern France diffuse stack, keeps all 28 diffuse textures
  loaded, reports about `48%` early scene hits and `52%`
  no-hit/atmosphere-exit pixels, and restores a strong warm sunrise/sunset
  horizon gradient. Record `142` is the current subjective review artifact,
  not an objective numeric parity gate.
- Records `tmp/atmosphere/reconciliation/143-*` through `154-*` continue the
  no-mesh ocean diagnostic. The ocean helper floor is now a high-poly
  observer-local spherical Earth mesh, and one-row renders at 5, 15, and 30
  minutes before sunset show the expected increasing near-sunset brightness
  while retaining the same camera, FOV, and early-hit split. Record `154`
  renders the 30-minute case as a browser-side CPU-diagnostic-shader/GPU-
  assembled-shader side-by-side image. That comparison is now explicitly
  classified as a GPU self-mirror diagnostic only: it proves the browser-side
  translated shader math matches the GPU, not that the GPU matches the
  canonical CPU `evaluate(...)` baseline.
- Records `tmp/atmosphere/reconciliation/155-*` and `156-*` add the corrected
  canonical CPU/GPU direction. `m3CanonicalCpuGpuOceanComparison.js` renders
  the no-mesh ocean scene through public CPU `evaluate(...)` plus
  `BrunetonColorDisplayModel`, then compares it with the installed GPU shader
  canvas for the same camera/time. This also fixed `endDistanceMeters`
  handling in spherical and flat geometry so scene intersections actually cap
  ray length. The side-by-side artifact
  `155-m3-canonical-cpu-gpu-ocean-comparison/canonical-cpu-left-gpu-right.png`
  shows a real mismatch: sampled upper sky CPU `[219, 187, 127, 255]` vs GPU
  `[64, 90, 84, 255]`, so the GPU shader still needs to move toward the CPU
  reference rather than the reverse.
- Records `tmp/atmosphere/reconciliation/157-*` and `158-*` apply the first
  shader-side physics diagnosis: GPU Mie extinction now uses the CPU formula,
  and Rayleigh/Mie scattering stay separated through their phase functions.
  This made the GPU hue warmer but did not solve parity; upper sky is still
  CPU `[219, 187, 127, 255]` vs GPU `[23, 16, 8, 255]`. Future diagnosis
  should reuse the CPU baseline image from record `155`; the comparison runner
  now accepts `--cpu-baseline-image` so GPU-only shader iterations do not
  recompute the CPU reference.
- Records `tmp/atmosphere/reconciliation/159-*` through `168-*` complete the
  no-mesh ocean CPU/GPU diagnosis. Source-path transmittance now uses a
  shader source-ray optical-depth loop instead of the old local air-mass
  shortcut. The GPU solar radiance binding now uses the canonical solar
  spectrum converted through `BrunetonColorDisplayModel.radianceToLinearSrgb`
  rather than the old flat `[9000, 9000, 9000]` RGB value. Finally, GPU
  spherical geometry now clips view rays against the bottom/ground boundary,
  and endpoint color contributes only when the scene hit occurs at or before
  that geometry boundary. This fixed the apparent color leaking through the
  floor. Record `167/168` is the current accepted canonical diagnostic:
  selected upper sky CPU `[219, 187, 127, 255]` vs GPU `[224, 195, 134, 255]`,
  horizon CPU `[6, 4, 2, 255]` vs GPU `[5, 2, 0, 255]`, and lower floor CPU
  `[1, 2, 1, 255]` vs GPU `[0, 0, 0, 255]`.
- Records `tmp/atmosphere/reconciliation/169-*` and `170-*` refine that fix:
  geometry ground/domain termination is now treated as an endpoint hit for
  composition, with geometry owning the endpoint radiance. The shader path
  bounds distinguish `hasSceneEndpoint` from `hasGroundEndpoint`, then color
  composition applies the same endpoint equation to both owners. Selected
  ground pixels now match the CPU baseline exactly in the no-mesh ocean
  diagnostic: horizon `[6, 4, 2, 255]`, lower ocean `[1, 2, 1, 255]`.
- Records `tmp/atmosphere/reconciliation/171-*` through `195-*` replace the
  fallback-boundary coloring idea with the intended design: the Three scene
  now contains a ground mesh shaped from the active Algorithm32 spherical
  geometry/camera transform. The CPU analytic ocean hit uses the same center.
  Record `173/174` made the diagnostic ocean endpoint visibly colored and
  exposed that near ground hits encoded to byte zero. Record `175/176` fixes
  that by treating encoded scene-hit zero depth as a tiny positive endpoint
  distance. Record `177/178` and `179/180` are superseded diagnostics: the
  ground-boundary fallback-radiance approach removed a GPU black band but is
  not retained because it special-cases ground instead of following the
  generic endpoint rule. Records `181-*` through `186-*` explored scene-depth
  packing and raycaster distance textures; they are GPU/input diagnostics, not
  accepted parity fixes. Record `187` is the current accepted CPU reference
  diagnostic: it renders the scene with `CpuPostprocessSoftShader` and public
  `evaluate(...)`, using the regular CPU setup/cache/support. The CPU ground
  is affected by atmosphere near the horizon: upper ground samples are
  `[73, 129, 110, 255]`, `[80, 131, 110, 255]`, and
  `[71, 128, 110, 255]`; lower ground remains nearly uniform at
  `[69, 128, 111, 255]` for this low-contrast fixture. A fully uniform or
  dark/speckled GPU ground should be diagnosed as GPU shader/input/depth
  handling, not as a CPU reference composition failure. Records `188` through
  `191` add CPU-reference green box diagnostics with a lower camera and solar
  noon, but the composed output remains visually color-washed. Record `192`
  renders the same low-camera, solar-noon, near/far green-box layout with no
  CPU postprocess shader, no `evaluate(...)`, and no GPU shader. Its raw
  `raw-scene.png` reads as earth-colored ground plus green boxes. Record
  `193` removes the ground object from that raw control and leaves only sky
  plus green boxes, confirming that the previous raw ground region came from
  the explicit ground intersection while the cyan/mask-like look is introduced
  by the diagnostic endpoint/display/transport path. The visual comparison
  also shows that the current diagnostic ground object was geometrically
  wrong: it behaved like a broad rectangular overlay cutting off the bottoms
  of the green boxes. Records `194/195` start the replacement from a clean
  browser Three scene containing only one scaled planet-size sphere. The
  watcher artifact `195-m3-planet-sphere-ground-scene/canvas-image.png`
  reads as a sphere-derived curved horizon, not a rectangular slab, and is
  the high-altitude baseline for rebuilding the ground object before boxes,
  terrain, Algorithm32 transport, or the assembled shader are reintroduced.
  Records `196/197` rerender the sphere at `2 m` observer altitude and expose
  the first scale-compensation issue: a fixed `0.01` scene-unit near plane is
  `10 m` in algorithm space at `scaleDenominator = 1000`, clipping immediate
  foreground ground. Records `198/199` fix the diagnostic near plane to scale
  with observer altitude; `199-m3-planet-sphere-ground-scene/canvas-image.png`
  is the corrected near-zero baseline, with a nearly flat horizon and filled
  foreground. The practical rule is that Three proxy geometry can be scaled,
  but camera clip planes, raycaster hit distances, depth encodings, and shader
  bindings must be transformed consistently between scene units and
  Algorithm32 meters. Shader mode for the same clean sphere scene is now wired
  through `m3PlanetSphereGroundScene.js --with-shader --solar-noon` and
  browser `sceneKind: "planet-sphere-ground"`. Record `200/201` is a rejected
  stale pre-analytic-depth attempt; the replacement browser capture uses
  analytic ray-sphere depth and encodes distances in Algorithm32 meters.
  Records `202/203` are the first accepted optimized shader artifact for this
  scene. The geometry alignment is broadly working, with one scaled sphere,
  Algorithm32 camera `[6360002, 0, 0]`, and a near-zero flat horizon plus
  atmospheric sky gradient. The shader-composed ground is still visibly
  speckled and remains the next diagnostic issue before this becomes a clean
  ground-shader fixture.
- Records `tmp/atmosphere/reconciliation/208-*` and `209-*` correct the CPU
  proof for the clean sphere scene so it operates on actual Three scene data.
  `m3CpuPlanetSphereGroundScene.js` now constructs one scaled planet-size
  `THREE.Mesh`, captures per-pixel rays and hit distances with
  `THREE.PerspectiveCamera` plus `THREE.Raycaster`, converts those hit
  distances from scene units to Algorithm32 meters, and feeds the captured
  scene data into `CpuPostprocessSoftShader` with public
  `SpectralReferenceEvaluator.evaluate(...)`. Record `208` is preserved as a
  rejected aggregate-accounting attempt. Record
  `209-m3-cpu-three-spherical-ground-object` is accepted: it writes both a raw
  Three hit/no-hit preview PNG and a CPU soft-shader PNG, renders `8160`
  pixels, and reports `3890` sphere-hit pixels, `4270` no-hit sky pixels, no
  invalid pixels, no warnings, and no errors. This is the current accepted
  evidence that the CPU soft shader handles a spherical ground object as
  ordinary Three scene input rather than as a parallel analytic scene model.
- Record `tmp/atmosphere/reconciliation/210-m3-geometry-owned-three-spherical-ground-object`
  supersedes `209` for the spherical ground CPU proof. The POC now has
  `three/ExactSphereGroundObject.js`, a Three `Object3D` with exact
  ray/sphere `raycast(...)`, and
  `SphericalEarthGeometry.createThreeEndpointObjects(...)`, which returns a
  geometry-owned visual sphere plus exact raycast endpoint object. The runner
  uses the same `SphericalEarthGeometry` instance for endpoint construction
  and public `evaluate(...)`, removing the ground-level tangent mismatch where
  Three triangle raycasting missed the mesh while Algorithm32 clipped the ray
  to ground. Record `210` renders `8160` pixels with `4080` exact sphere hits
  and `4080` no-hit sky pixels; the previous black center-horizon row is now
  an endpoint hit around `[117, 114, 66, 255]`. This proves ownership and
  capture alignment, not long-distance ground haze: this near-ground frame's
  exact hit distances top out around `315.57 m`.
- Records `tmp/atmosphere/reconciliation/211-*` through `214-*` raise that
  runner's default observer altitude to `202 m` and add two ordinary Three
  green diagnostic boxes on the geometry-owned spherical ground. Record `214`
  is retained as a spectrum-fixture routing diagnostic only: endpoint routing
  used each hit object's `userData.spectralReferenceId`, so it proved object
  routing was no longer hard-coded to the ground fixture, but it did not prove
  renderer material-color handling. Record `215` tried a
  `matte-lambertian-linear-srgb` RGB-to-spectrum endpoint policy, and
  diagnostics `216/217` confirmed that path was the active color drift for
  this lane rather than the documented local-second-order behavior. Records
  `218` and `219` lock the corrected contract: only ray and finite hit
  distance enter public `evaluate(...)`; captured scene color is accepted only
  under the named post-transport endpoint policy; spectral path
  radiance/transmittance comes out; final RGB is produced in the display/color
  layer. Record
  `tmp/atmosphere/reconciliation/220-m3-captured-scene-color-green-boxes-120x68`
  is the accepted hit-color proof: all `4129` hit pixels use
  `captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy`, the
  scene still has `4031` no-hit sky pixels, no invalid pixels, no warnings,
  and no errors, and green-box CPU pixels average
  `[68.1, 153.3, 114.8, 255]`.
- Record
  `tmp/atmosphere/reconciliation/221-m3-captured-scene-color-green-boxes-320x180`
  rerenders the same current CPU scene at `320 x 180` for the requested
  180-line artifact. It accepted all criteria with `28866` hit pixels,
  `28734` no-hit sky pixels, no invalid pixels, no warnings, no errors, and
  green-box CPU average `[67.3, 152.3, 113.3, 255]`.
- Record
  `tmp/atmosphere/reconciliation/222-m3-captured-scene-color-green-boxes-2m-320x180`
  rerenders the same current CPU scene at `320 x 180` with
  `--observer-altitude-meters 2`. It accepted all criteria with `29234` hit
  pixels, `28366` no-hit sky pixels, no invalid pixels, no warnings, no
  errors, average hit distance about `307.44 m`, and green-box CPU average
  `[66.6, 150.1, 110.2, 255]`.
- Record
  `tmp/atmosphere/reconciliation/223-m3-cache-backed-cpu-green-boxes-2m-120x68`
  restores the full Algorithm32 CPU scene path for sky/horizon comparison.
  `m3CpuPlanetSphereGroundScene.js` now builds the distant L2 incident-radiance
  cache by default, passes `incidentRadianceSampling` into public
  `SpectralReferenceEvaluator.evaluate(...)`, and records cache diagnostics;
  `--no-incident-cache` is only a stripped diagnostic option. The captured
  scene color contract is unchanged: only ray plus finite hit distance enter
  `evaluate(...)`, and hit color is composed afterward by the display/color
  layer. The cache-backed `120 x 68`, 2 m run accepted all criteria with
  `4140` hit pixels, `4020` no-hit sky pixels, no invalid pixels, no warnings,
  no errors, incident cache mode `distant-l2`, `1632` cache coordinates,
  shader payload dimensions `48 x 34 x 15`, and green-box CPU average
  `[66.38, 150.35, 110.15, 255]`. Records `220` through `222` remain useful
  hit-color and requested-size diagnostics, but `223` supersedes them for
  comparisons against the cache-backed Algorithm32 sky-dome path.
- Record
  `tmp/atmosphere/reconciliation/225-m3-shader-ground-boundary-depth-tie-contract`
  fixes the assembled-shader scene endpoint / ground boundary tie. Scene depth
  is RGB24-packed against `sceneDepthMaxMeters`; at `150000 m`, one encoded
  quantum is about `0.009 m`. The old shader accepted scene endpoints only
  within `0.001 m` of the analytic ground boundary, so a real endpoint decoded
  a few millimeters past ground could fall through to `hasGroundEndpoint` and
  use black `uGroundRadianceRgb`, visually removing geometry exactly where it
  touched ground. `DistantSphericalShaderContributionFactory` now uses
  `max(uSceneDepthMaxMeters / 16777214.0, 0.001)` for that tie. The accepted
  assembly probe records source hash
  `639721530553fdb649f907316e55b30296d0404ba238d1e0de925f79cac64677` and
  proves the previous tolerance would lose the quantized endpoint while the
  new tolerance keeps it. This is a color-layer/geometry classification fix;
  it does not pass scene color into Algorithm32 transport.
- Record
  `tmp/atmosphere/reconciliation/228-m3-planet-sphere-ground-shader-depth-tie-2m-120x68`
  is the accepted browser smoke for the depth-tie patch. An intermediate run,
  `226`, rejected before shader execution because the browser planet-sphere
  capture referenced a missing `applyBackgroundColorMaskToDepthBytes(...)`
  helper. Restoring that helper lets the depth pass mask background-colored
  pixels back to the magenta no-hit sentinel before shader input. The rerun
  accepted all criteria and wrote
  `tmp/atmosphere/reconciliation/229-m3-planet-sphere-ground-shader-scene/canvas-image.png`.
  Record `228` still used the older POC cache-coordinate shortcut; records
  `230` through `233` supersede that part of the diagnosis with source-owned
  cache boundary handling and per-sample-position shader lookup.
- Record
  `tmp/atmosphere/reconciliation/230-m1-distant-cache-boundary-source-policy`
  moves the boundary behavior into the distant cache/geometry source contract.
  The distant incident-radiance cache now declares `boundaryAltitudeMeters: 2`
  and uses altitude bin zero as an explicit minimum in-atmosphere sample.
  `SphericalEarthGeometry.resolveCacheAccess(...)` clamps runtime cache queries
  at or below the ground boundary to that same effective altitude before bin
  selection, while preserving the requested altitude in metadata. The focused
  M1 cache run accepted with `408` cache coordinates, `17` incident-direction
  samples for boundary access, and positive selected zenith L2 contribution
  (`0.004288843904891116` mean incident delta).
- Record
  `tmp/atmosphere/reconciliation/231-m3-shader-cache-sample-position-boundary-source`
  updates the assembled distant/spherical shader to derive cache access from
  the actual transport sample position. The generated shader defines
  `GEOMETRY_CACHE_BOUNDARY_ALTITUDE_METERS`, computes
  `lightSourceRelativeCacheCoordinate(vec3 positionMeters)` from sample
  altitude, clamps to the source-owned boundary altitude, and calls
  `lookupIncidentRadiance(positionMeters, state.ray.direction)` inside the
  transport loop. The probe rejects the old `state.incidentRadiance *
  medium.scattering` shortcut. Accepted shader source hash:
  `2241b0d82ea92d29cf6ae15a23271e83f001b51dd33d55fa319756b75042f044`.
- Record
  `tmp/atmosphere/reconciliation/232-m3-cache-boundary-source-cpu-green-boxes-2m-120x68`
  reruns the cache-backed CPU green-box scene after the source-owned boundary
  fix. It accepted all criteria with `1632` cache coordinates, boundary cache
  altitude `2 m`, `4140` hit pixels, `4020` no-hit sky pixels, no invalid
  pixels, no warnings, no errors, and green-box CPU average
  `[66.38, 150.35, 110.15, 255]`.
- Record
  `tmp/atmosphere/reconciliation/233-m3-cache-boundary-source-shader-2m-120x68`
  reruns the `120 x 68`, 2 m browser shader smoke with the source-owned cache
  lookup. The watcher accepted the job and wrote
  `tmp/atmosphere/reconciliation/234-m3-planet-sphere-ground-shader-scene/canvas-image.png`
  with shader source hash
  `2241b0d82ea92d29cf6ae15a23271e83f001b51dd33d55fa319756b75042f044`.
- Records
  `tmp/atmosphere/reconciliation/235-m3-explicit-scene-hit-mask-shader-contract`
  and
  `tmp/atmosphere/reconciliation/236-m3-explicit-scene-hit-mask-shader-2m-120x68`
  supersede the current depth-tie/magenta no-hit mechanism from records `225`
  and `228`. Scene depth now carries packed finite distance only; the
  endpoint signal is the explicit `uSceneHitTexture` mask, and
  `resolveAtmospherePath(...)` receives `bool hasSceneEndpoint` instead of
  deriving it from depth byte values or tolerance windows. The runtime
  descriptor names this as
  `explicit-hit-mask-plus-opaque-hit-distance`. The browser capture now
  raycasts once per pixel to produce both distance bytes and hit-mask bytes,
  and the browser-side CPU mirror consumes that same mask. Record `235`
  accepted shader source hash
  `3f2547da129abe62749bbb7b9b3cbc056ca9129478a4e177bcb05c26bdecd220`;
  record `236` accepted the `120 x 68`, 2 m shader smoke and wrote
  `tmp/atmosphere/reconciliation/237-m3-planet-sphere-ground-shader-scene/canvas-image.png`
  with `3960` hit pixels and `4200` no-hit pixels counted from the explicit
  mask.
- Records
  `tmp/atmosphere/reconciliation/261-m3-1500m-dense-ground-sphere-cpu-120x68`
  and
  `tmp/atmosphere/reconciliation/262-m3-1500m-dense-ground-sphere-shader-120x68`
  are the accepted pre-lighting CPU/browser pair for the `120 x 68`, 1500 m
  planet-ground color scene. Intermediate records `238`, `240`, `241`,
  `242`, `243`, `245`, `246`, `252`, and `253` are superseded: `238` removed
  the black horizon line by making one raycaster hit own distance, explicit
  hit mask, and captured display color; `241` moved boxes closer but visual
  review still showed their bases hidden by the spherical ground limb;
  `242/243` proved the visible ground pattern but still used a `2 m` observer
  with only two close boxes; `245/246` added four boxes at `500 m`; `252/253`
  raised the camera to `1500 m`. Records `255` and `256` are a `320 x 180`
  shader-only visual diagnostic after increasing the ground visual mesh to
  `512 x 256`; records `261/262` are the matching CPU/browser pair with that
  segment count recorded in diagnostics. That scene derives ground
  display color from the ground hit point as a visible pattern and places four
  green boxes from foreground to farther ground. Record `262` writes
  `tmp/atmosphere/reconciliation/263-m3-planet-sphere-ground-shader-scene/canvas-image.png`;
  the CPU and shader diagnostics both report `3837` ground hits, `49`
  near-box hits, `62` middle-box hits, `30` far-box hits, `20` very-far-box
  hits, and accept
  `ground-color-varies-from-hit-geometry`. Captured color still stays outside
  public `evaluate(...)`; only ray plus finite hit distance enter Algorithm32
  transport.
- Record
  `tmp/atmosphere/reconciliation/282-m3-lit-three-render-color-depth-only-ground-shader-640x360`
  introduced the lit Three `WebGLRenderTarget` scene-color source, but its
  depth-only ground made ground pixels sample sky-clear color. Records `284`
  and `286` tried a black/no-color clear for that depth-only ground path and
  were user-rejected because midday ground became too dark. Record `288`
  lowered the planet-sphere default observer elevation to `150 m` but still
  used the depth-only ground color path.
- Record
  `tmp/atmosphere/reconciliation/302-m3-150m-colored-ground-mesh-exact-ground-hit-shader-640x360`
  superseded the earlier planet-ground color-source records by restoring a
  visible `MeshLambertMaterial` ground mesh that wrote rendered color into
  `uSceneColorTexture`, but it still split ground authority: the separate
  exact spherical raycast object owned ground hit distance and explicit hit
  mask. Records `304` and `307` tried to make the visible mesh own those facts
  through per-pixel mesh raycasts, but that path timed out at `640 x 360`.
  Records `308/309` and `310/311` introduced a rendered distance pass from
  the visible meshes, but initially classified all pixels as hits because the
  background participated in the pass. Record
  `tmp/atmosphere/reconciliation/312-m3-150m-rendered-distance-no-background-hit-mask-shader-640x360`
  is the current accepted hit/color alignment record: the distance pass clears
  background to `null`, visible meshes own rendered scene color, hit distance,
  and hit mask, and the exact sphere is no longer the ground hit authority for
  this browser scene. The accepted browser artifact is
  `tmp/atmosphere/reconciliation/313-m3-planet-sphere-ground-shader-scene/`,
  including `pre-shader-scene-color.png` and `canvas-image.png`. Diagnostics
  report `128283` hit pixels, `102117` no-hit pixels, `109110` ground hits,
  `12790` near-box hits, `5139` middle-box hits, and `1244` very-far-box
  hits. The public `evaluate(...)` and spectral path/transmittance plus
  rendered-hit-color composition contract remain unchanged.
- Records
  `tmp/atmosphere/reconciliation/268-m3-4500m-tangent-target-dense-ground-sphere-shader-640x360`
  and
  `tmp/atmosphere/reconciliation/270-m3-150m-tangent-target-dense-ground-sphere-shader-640x360`
  are GPU-only visual diagnostics for the apparent horizon/ground curvature
  question. The planet-sphere camera now targets the actual spherical horizon
  tangent point instead of `[0, 0, -horizonDistance]`; at `4500 m` diagnostics
  report tangent point `[0, -4.4968, -239.1220]` scene units and horizon
  distance about `239.29 km`, while at `150 m` they report
  `observerAltitudeSceneUnits: 0.15` and horizon distance about `43.68 km`.
  Both records wrote shader images but rejected the all-boxes-visible
  criterion because the existing diagnostic boxes are not all in-frame/hit in
  those camera setups. Treat them as visual evidence only: the similar curve
  read across `150 m` and `4500 m` points away from simple altitude scaling
  and toward projection/FOV or the diagnostic ground pattern.
- Records
  `tmp/atmosphere/reconciliation/272-m3-150m-solid-ground-sphere-shader-640x360`
  and
  `tmp/atmosphere/reconciliation/274-m3-4500m-solid-ground-sphere-shader-640x360`
  add a GPU-only `--ground-display-mode solid` diagnostic. Solid mode keeps
  the same ray/hit shader path but uses the base captured ground color instead
  of the hit-point-derived `60 m` checker and `140 m` depth band. These records
  intentionally reject the ground-color-variation criterion, but the images
  show the bowl-like ground read is much weaker without the diagnostic pattern.
  The remaining small horizon sag is consistent with the wide-FOV spherical
  limb; the pronounced curved-ground impression is primarily a
  pattern/projection artifact.
- Record
  `tmp/atmosphere/reconciliation/276-m3-6000m-solid-ground-sphere-shader-640x360`
  raises that solid-ground GPU diagnostic to `6000 m` and adds a mathematical
  `horizon-trace-overlay.png`. Diagnostics confirm `observerAltitudeSceneUnits:
  6` and horizon distance about `276.33 km`; the trace measures the projected
  horizon at pixel `y=180` near center and `y=186` at both image edges, a
  definite `6 px` sag in the current `640 x 360`, `62 deg` vertical-FOV
  projection.
- Record
  `tmp/atmosphere/reconciliation/278-m3-6000m-35deg-solid-ground-sphere-shader-640x360`
  changes the planet-sphere diagnostic default to `35 deg` vertical FOV and
  adds a `--vertical-fov-degrees` runner override. The same `6000 m`,
  `640 x 360`, solid-ground horizon trace now measures `y=180` near center
  and `y=184` at both edges, reducing edge sag from `6 px` to `4 px`. The
  accepted `261/262` CPU/GPU color-contract pair predates this FOV default
  change; rerun that pair before using `35 deg` as refreshed accepted contract
  evidence.
- Deferred performance note: CPU soft-shader/reference renders can later be
  tiled across Node `worker_threads` or browser Web Workers because pixel rays
  are independent once scene/config/cache inputs are fixed. This should remain
  a throughput optimization only; workers must use the public `evaluate(...)`
  path and must not introduce alternate transport or comparison semantics.
- Parity repair update: records `314` through `324` resolve the Subgoal 3.5
  distant/spherical GPU repair queue. The browser now consumes a real packed
  `rgba32f` distant L2 incident-radiance cache payload, the generated shader
  uses canonical 15-channel spectral transport with endpoint/trapezoid
  integration, captured scene RGB stays outside the generated shader's
  atmosphere transport stages and is composed only in the display step, and
  objective browser records now gate on the real incident-radiance payload
  diagnostics. This mirrors the CPU public `evaluate(...)` boundary; the GPU
  shader does not literally call `evaluate(...)`. The subjective command producers now
  emit the same cache payload shape without creating new subjective review
  evidence, and the old browser CPU side-by-side RGB approximation fails
  loudly instead of masquerading as parity evidence. Final objective RGB fixture
  materialization and numeric image/selected-pixel comparisons remain the next
  M3 validation work before broader promotion.
- Horizon-color diagnostic: record `325` reruns the CPU soft-shader
  planet-sphere scene at the same `120 x 68`, `150 m`, `35 deg` setup as
  watcher record `324`. Sampled no-hit sky rows match between CPU and GPU
  center pixels, including rows `32` and `33` near the horizon. The dim band
  above the horizon is therefore inherited from the current canonical spectral
  transport/display path for long tangent sky rays, not from GPU hit-color
  composition or browser-only blending.
- Cache isolation diagnostic: record `326` reruns the same CPU scene with
  `--no-incident-cache`. Sampled sky/horizon pixels match record `325`
  byte-for-byte. Follow-up payload inspection showed this did not rule out the
  distant L2 cache; it exposed that the cache was structurally enabled but
  contained only zero radiance in the planet-scene frame.
- Geometry-frame cache repair: records `327` through `329` fix and verify the
  coordinate-frame cause. `SphericalEarthGeometry` now owns the observer-local
  scene-frame mapping: the planet/Three scene uses model `+X` as radial up,
  model `+Y` as scene right, and model `-Z` as scene forward. CPU scene capture
  now asks geometry to map Three ray origins, directions, hit points, and
  normals into model space, and the distant cache's representative build rays
  use the same geometry-owned frame. Record `327` accepted the cache-enabled
  `120 x 68`, `150 m`, `35 deg` CPU scene with `13125` nonzero packed cache
  floats and max packed radiance `0.21923798368243805`; record `328` accepted
  the matching no-cache run; the decoded comparison reports all `8160` pixels
  differ, with max byte delta `55`. Those records are cache-frame diagnostic
  evidence only; they still used the older standalone CPU scene-color policy.
  Record `329` accepted shader assembly after moving the browser shader ray
  reconstruction to descriptor-owned geometry frame constants instead of an
  unowned swizzle. Record `330` reruns the existing M1 distant L2 cache probe
  and confirms the default `+Z` spherical baseline still contributes positive
  incident radiance, with `408` cache coordinates and mean incident delta
  `0.004288843904891116`.
- Shared planet scene facts refresh: records `334` and `332` supersede
  `327/328` for planet-scene color/lighting inputs. Planet scene display
  colors, Lambert material policy, ambient intensity `1.1`, directional
  intensity `4.0`, ground sphere segments `512 x 256`, and endpoint radiance
  scale `5200` now live in `scenes/planetSphereSceneFacts.js`; the CPU runner
  imports those facts and the browser shader command sends them in
  `payload.planetSceneFacts`. The browser page consumes the payload for
  pre-shader scene color, ground/box materials, lighting, and diagnostics.
  Record `331` accepted mechanically but is superseded for raw/color evidence:
  its Node-side Lambert-style byte multiplier saturated ground hits to white,
  so the raw image appeared to have no ground despite `3891` ground
  intersections. Record `334` removes that pseudo-lighting from the CPU
  raycaster hit-color capture, uses shared material display colors directly,
  adds a `raw-scene-ground-color-present` criterion, and accepts with `3891`
  exact shared ground-color pixels. Record `332` accepted the matching browser
  shader run, with watcher artifact `333` writing `canvas-image.png` and
  `pre-shader-scene-color.png` and reporting the same object hit counts as
  the CPU run. Final visual CPU/GPU parity still requires a CPU pass fed by
  the browser-captured scene color/depth/hit textures, not a separately
  rendered Node scene color approximation.
- Constructed-scene contract refresh: records `335` and `336` reshape the
  planet scene around a named scene definition and object renderer map.
  At that point `planetSphereSceneDefinition.js` defined the now-superseded
  `planet-sphere-ground-solar-noon` with object names `distant-sun-light`,
  `near-green-box`, `middle-green-box`, `far-green-box`, and
  `very-far-green-box`; the spherical ground remained geometry-owned outside
  that object list. Records `379` through `389` later split that ambiguous
  single scene into explicit lit and unlit presets. The CPU path constructs
  the scene first, records
  `sceneDefinition` and `sceneObjects`, then the raw image and soft renderer
  consume that constructed scene. The browser path now does the same split:
  construct the scene from the object-name map, then pass the constructed
  scene to the shader capture. CPU record `335` accepted with visible raw
  ground/boxes. Shader record `342` and direct browser record `344` are the
  current browser evidence after tightening the object renderer contract so
  object color and light intensities are owned by the registered renderer
  functions/constants, not passed as renderer input data. Watcher artifacts
  `343` and `345` report the same scene definition/object list; shader
  artifact `343` reports `meshCount: 5`, `threeObjectCount: 8`, and
  `raycastObjectCount: 4`. Earlier record `338` is retained as stale
  shader-only wrapper criteria evidence for the direct path.
- Current low-elevation `320 x 180` scene presets: the scene definition now
  has separate presets for
  `planet-sphere-ground-solar-noon-unlit` and
  `planet-sphere-ground-solar-noon-lit`. The unlit preset excludes the
  `distant-sun-light` scene object and uses `lightingPolicy:
  unlit-endpoint-color`; the lit preset includes `distant-sun-light` and uses
  `lightingPolicy: directional-light-from-distant-sun`. Both presets share the
  scene-definition-owned green-box specs (`centerXZ`, `sizeSceneUnits`), and
  CPU/browser construction consumes those specs from the preset/payload rather
  than duplicating placement constants. The browser fallback copy of those
  specs was removed, so missing required specs fail at construction.
- Base-scene parity gates: unlit record `389` compares CPU record `388`
  `raw-spherical-ground-object-scene.png` against browser artifact `381`
  `pre-shader-scene-color.png`; lit record `387` compares CPU record `384`
  against browser artifact `386`. Both presets accepted with exact decoded
  RGBA parity (`maxAbsRgbaDelta: 0`, `mismatchedPixelCount: 0`), matching
  scene-definition object specs, and matching hit classifications (`32165`
  total hit pixels, `25435` no-hit pixels, `27361` ground hits, `3225`
  near-box hits, `1285` middle-box hits, and `294` very-far-box hits). Record
  `371` intentionally reruns the same gate against old browser artifact `347`
  and rejects it (`maxAbsRgbaDelta: 124`, `mismatchedPixelCount: 32165`),
  preserving that `347` used the superseded browser lit/rendered-distance base
  scene and must not be used for CPU/GPU shader comparison.
- Scene-hit termination fix: records `349`, `366`, `367`, and `380/381` are
  the current accepted evidence. Finite constructed-scene hits terminate the
  ray through typed spatial endpoint distance; no-hit pixels do not invent a
  hidden analytic ground endpoint. Endpoint color stays outside transport and
  is composed after spectral output. The lit preset browser run `385/386`
  confirms the same constructed-scene endpoint capture path applies
  deterministic directional-light endpoint color when the selected preset asks
  for it. Earlier browser artifact `352` removed the dark line by changing
  no-hit boundary behavior while still using the visible mesh/raster edge as
  ground-hit authority, so it is superseded. The denser-mesh diagnostic
  `354/355` confirmed the raster-edge coupling but was rejected as a fix;
  scene facts are back to `512 x 256` ground mesh segments.
- Browser artifact ownership update: records `390` through `393` replace the
  submitter-folder plus watcher-folder pattern for command-submitted browser
  jobs. Submitters now include `artifactRunDirectory` in the browser command,
  and the watcher writes browser artifacts into that existing experiment
  folder. Browser-owned record metadata is namespaced as `browser-*`, while
  high-value visual artifacts keep their expected names (`canvas-image.png`,
  `pre-shader-scene-color.png`, `screenshot.png`, and
  `selected-pixels.json`). Record `390` rejected only because the running
  watcher still had the old code loaded and created stale folder `391`.
  Records `392` and `393` accepted after watcher restart, proving direct scene
  and shader-mode planet-scene jobs both keep artifacts in one folder.
- Planet-scene shadow option: records `394` through `398` add shadow policy as
  a distinct scene/capture option from shading. `--allow-shading` enables the
  directional-light/Lambert endpoint-color path; `--with-shadows` implies that
  same shading path and switches `shadowPolicy` to
  `raycast-shadows-from-distant-sun`. The CPU and browser constructed-scene
  color resolvers both cast a light ray from the hit point toward the distant
  Sun and remove the direct Lambert term when another scene object blocks it;
  this remains endpoint color/display work outside `evaluate(...)`. Browser
  direct rendering also enables Three shadow maps for the same policy.
  Records `394` and `396` accepted mechanically but are superseded for visual
  color evidence because the first manual endpoint resolver multiplied display
  bytes by renderer light intensities and saturated lit ground to white.
  Records `397` and `398` normalize the endpoint-light factor so material
  color remains visible while shading and shadows still darken pixels. Record
  `398` is the current browser shader shadow smoke and reports
  `shadowedHitPixelCount: 1`.
- Browser integrated CPU/GPU shader architecture: records `399` through `405`
  replace the planet-sphere shader path's old direct fullscreen WebGL harness
  with a Three `EffectComposer` runtime. The constructed scene is rendered once
  into the composer read buffer; the GPU backend is an Algorithm32 shader pass,
  and the CPU backend is an Algorithm32 CPU pass running in browser JavaScript.
  Both backends consume the same runtime packet: composer scene color,
  constructed-scene raycast distance bytes, explicit hit-mask bytes, camera
  inverse matrices, camera world position, distant Sun direction, scene-depth
  bounds, and the packed distant L2 cache payload. Record `399` is retained as
  the rejected first attempt with stale criteria and a Three shader-attribute
  collision. Record `400` accepts the GPU composer smoke at `120 x 68`; record
  `401` accepts the CPU composer smoke at `60 x 34`, with all pixels routed
  through public `SpectralReferenceEvaluator.evaluate(...)` and hit color kept
  outside transport through the captured-scene endpoint proxy. Record `402`
  accepts the GPU composer smoke at the same `60 x 34` viewport as `401` with
  no browser console/page errors. Record `403` accepts a CPU composer progress
  smoke at `60 x 34`. Records `404` and `405` refactor the watcher into a thin
  browser job host: commands name `page`, `entrypoint`, `captures`, and
  `payload.jobType`; the page calls `window.shaderHost.progress(...)` and
  `window.shaderHost.saveArtifact(...)`; the watcher no longer parses
  CPU-specific console progress or infers shader image artifacts from result
  fields. Record `405` accepts at `60 x 34`, records progress from `0/34`
  through `34/34`, leaves `browser-console.json` empty, and saves the
  page-requested `canvas-image.png`, `pre-shader-scene-color.png`,
  `selected-pixels.json`, `browser-diagnostics.json`, and `screenshot.png`.
  Next parity work should compare CPU/GPU outputs from this shared composer
  input instead of maintaining separate CPU scene-rendering code paths.
- Shadowed planet render: record `406` accepts the `320 x 180` GPU composer
  render and verifies the retained image artifact layout (`images/` for PNGs,
  root for JSON). Records `407` and `408` render the
  halfway-between-noon-and-sunset Sun sample and expose misplaced Three cast
  shadows when the DirectionalLight shadow camera uses the planet-radius light
  distance/depth range. The first fix is scene/light setup, not Algorithm32:
  the distant Sun object preserves the same Sun direction but centers a local
  shadow frustum on the green-box field. Record `409` verifies that direct
  no-shader improvement. Records `411` and `412` then fix the receiver side by
  replacing the visible global `SphereGeometry` receiver with a local
  spherical ground patch sampled from the same analytic scaled-sphere surface
  used to place boxes. The exact geometry raycast ground still owns hit
  distance and hit mask. Record `412` is the current accepted `320 x 180` GPU
  composer render with the midpoint Sun sample and attached foreground shadow.
  The GPU composer path still does not report a shadowed-hit pixel count
  diagnostic, despite the shadow policy being enabled.
- Sunset planet render: record `413` adds the `sunset` Sun sample and renders
  the same shadowed GPU composer scene at `320 x 180`. The sample is 15
  minutes before apparent sunset, keeping the Sun above the local ground with
  altitude about `1.76` degrees and azimuth about `298.58` degrees. The run
  accepted with empty browser console/page/fatal errors.
- Browser runner boundary note: the watcher is now intended to stay a thin job
  host that loads the requested page, mirrors progress, and persists requested
  artifacts. Native browser modules/import maps remain the default page shape,
  but a lightweight Rollup build is allowed if page-only dependency wiring
  starts pushing bundler complexity into the watcher.
- Shader lifecycle boundary decision: all setup/configuration work must finish
  before the Algorithm32 shader pass renders. That includes incident-radiance
  cache construction or selection, cache texture creation/upload, descriptor
  compatibility checks, resource allocation, binding-map creation, material
  construction, and pass installation. The render pass consumes prepared state
  and may only refresh frame-owned inputs such as the composer read buffer or
  already prepared frame uniforms/textures; it must not build caches, choose
  cache artifacts, repack cache textures, validate a new configuration, or
  install/rebuild the pass. Per pixel, the Algorithm32 shader body should do
  only the GPU equivalent of `evaluate(...)`: consume prepared ray/scene-hit
  facts and bound incident-radiance support, produce spectral transport
  output, then let separate post-evaluate composition/display code combine
  that result with endpoint hit color and encode final RGBA.
- GPU shader quality profile evaluation: records `415` through `419` add the
  `ideal`, `balanced`, `fast`, and `draft` shader quality profiles and compare
  reduced profiles against `ideal` on the `320 x 180` midpoint-Sun shadowed
  planet scene. `ideal` preserves the current full shader controls
  (`40/20/34/48` for path/source-transmittance/incident-direction/cache-altitude
  counts) and is now the POC quality reference. `balanced` uses about `50%` of
  the estimated dominant spectral work and compares with max byte delta `26`,
  mean byte delta about `2.70`, and RMSE about `4.12`; visually it is close,
  with most error in the horizon/sky gradient. `fast` uses about `26%` of the
  estimated work and remains coherent but visibly shifts the horizon/ground,
  with max byte delta `50` and mean byte delta about `6.33`. `draft` uses about
  `9%` of estimated work and is retained as a lower-bound diagnostic rather
  than a likely candidate. Future optimized shader work should branch into a
  separate implementation or explicit profile and compare back to `ideal`
  rather than mutating the ideal shader in place.
- Adaptive/interpolated sampling evaluation: records `420` through `426`
  extend the quality-profile harness with setup/config-owned optimization
  flags. `adaptive-balanced` and `adaptive-balanced-soft` keep the same loop
  counts as `balanced` but use non-uniform view-path sample placement with
  matching trapezoid weights. Both accepted mechanically, but both compared
  worse than regular `balanced` on the current midpoint-Sun planet scene:
  hard adaptive reported mean byte delta about `4.07` and RMSE about `6.60`,
  while soft adaptive reported mean byte delta about `3.22` and RMSE about
  `4.97`. `balanced-cache-interp` keeps regular path sampling and linearly
  interpolates incident-radiance cache altitude bins; that is the best
  candidate so far, improving `balanced` slightly to mean byte delta about
  `2.61` and RMSE about `4.03`, with max byte delta still `26`.
  `fast-cache-interp` did not help the `fast` profile, suggesting its
  remaining error is dominated by low path/direction counts rather than
  altitude-bin snapping.
- Human-eye sensitivity tuning metric: record `427` reruns the quality-profile
  comparison with Rec.709 display-luma and weighted-RGB proxy metrics in
  addition to exact RGBA byte deltas. This does not replace exact regression
  checks; it adds an early tuning signal that weights green/luminance changes
  more heavily than blue-channel-only drift. The perceptual-proxy ranking
  matches the byte-delta ranking for the current scene:
  `balanced-cache-interp` remains the best candidate with mean luma delta
  about `3.39` and luma RMSE about `4.48`, compared with regular `balanced`
  at mean luma delta about `3.50` and luma RMSE about `4.61`. `fast` and
  `fast-cache-interp` look worse under luma weighting, consistent with their
  visible sky/ground brightness drift. The comparison runner now writes these
  recommendations as an explicit `Conclusions` section in `report.md`, so the
  perceptual run does not require reading the metric table by eye.
- Candidate composite review image: record `428` creates a single stacked
  review image from record `427`. Each candidate row is arranged
  `ideal | candidate | diff x4`, with the profile id, estimated work ratio,
  mean byte delta, and mean luma delta in the row caption. The composite image
  is
  `tmp/atmosphere/reconciliation/428-m3-gpu-quality-candidate-composite-320x180/images/quality-candidates-ideal-candidate-diff.png`.
- Detectable residual diff review: records `429` and `430` add a second visual
  diff artifact that subtracts a configurable just-noticeable threshold before
  visualization. The comparison runner converts display bytes to Lab, computes
  a CIEDE2000-style proxy, zeros differences at or below `1.0 Delta E 2000`,
  and scales only the residual. This is a POC review aid, not proof of
  invisibility under all viewing conditions. In the current run,
  `balanced-cache-interp` remains the best serious candidate: detectable
  pixels fall to about `56.3%` with mean residual Delta E about `0.525`,
  compared with regular `balanced` at about `58.6%` and `0.554`. The composite
  image is
  `tmp/atmosphere/reconciliation/430-m3-gpu-quality-detectable-diff-composite-320x180/images/quality-candidates-ideal-candidate-detectable-diff.png`.
- Combined diff review image: record `431` creates the four-column review
  layout requested for side-by-side inspection:
  `ideal | candidate | diff x4 | perceptual diff`. It uses the record `429`
  comparison artifacts and places the detectable residual/perceptual diff on
  the far right of each candidate row. The composite image is
  `tmp/atmosphere/reconciliation/431-m3-gpu-quality-diff-and-perceptual-diff-composite-320x180/images/quality-candidates-ideal-candidate-diff-perceptual-diff.png`.
- GPU shader quality performance benchmark: records `432` and `433` add a
  browser-side benchmark runner for all shader quality profiles. Record `433`
  is the current citeable performance record because it reports setup and
  warmup timing separately from steady-state measured frames. The browser uses
  `performance.now()` around each EffectComposer render, calls `gl.finish()`
  by default to wait for GPU completion, excludes setup/cache construction and
  diagnostic readbacks from the measured loop, and yields `10 ms` every `5`
  measured runs plus `50 ms` between profiles. At `320 x 180` over `100`
  measured runs/profile, `ideal` averaged about `0.469 ms`; the best
  quality/performance candidate remains `balanced-cache-interp`, averaging
  about `0.278 ms` (`1.69x` faster than ideal) while preserving the best
  perceptual ranking from records `429/431`. Lower-quality profiles are faster
  (`draft` about `0.208 ms`), but remain quality diagnostics. Warmup max values
  still show first-use shader/pipeline costs, especially `balanced` at about
  `161 ms` and `ideal` at about `59 ms`; those are tracked separately from the
  steady-state frame mean. The report is
  `tmp/atmosphere/reconciliation/433-m3-gpu-quality-performance-benchmark-setup-warmup-320x180/report.md`.
- Colored endpoint diagnostic boxes: records `434` through `437` replace the
  green-only planet scene boxes with scene-owned diagnostic color boxes so
  shader diffs exercise a wider display/spectral range. The default planet
  scene now includes red, two greens, yellow, blue, cyan, and magenta boxes,
  each with its own `displayRgba` and spectral-coverage hint. Record `437` is
  the accepted GPU composer verification after moving magenta out from behind
  the blue box and tightening the runner criterion so every scene-listed
  diagnostic color box must have raycast hit pixels and color extents. Hit
  counts were red `3625`, near green `1444`, middle green `1285`, yellow
  `438`, blue `1213`, cyan `330`, and magenta `562`. This is still endpoint
  scene-color/display coverage only: color remains outside `evaluate(...)`;
  only ray/hit distance facts feed Algorithm32 transport.
- Colored-scene shader quality diffs: records `438` through `444` rerender the
  broader-color scene for every candidate shader quality profile, using record
  `437` as the `ideal` reference. Record `445` runs the absolute and
  detectable-residual diff comparison, and record `446` creates the requested
  four-column composite, arranged
  `ideal | candidate | diff x4 | perceptual diff`. The ranking remains the
  same as the previous green-heavy scene: `balanced-cache-interp` is still the
  best serious candidate at about `50.2%` of ideal work, with max byte delta
  `24`, mean byte delta `2.6715`, mean luma delta `3.4994`, detectable pixels
  about `56.0%`, and mean residual Delta E `0.5276`. Regular `balanced`
  trails slightly; the adaptive profiles are worse; the fast profiles remain
  visibly risky; and `draft` is still only a preview/diagnostic profile. The
  composite image is
  `tmp/atmosphere/reconciliation/446-m3-gpu-colored-quality-diff-and-perceptual-diff-composite-320x180/images/quality-candidates-ideal-candidate-diff-perceptual-diff.png`.
- App-like shader performance benchmark: record `447` reruns the browser-side
  performance benchmark at `1024 x 768` on the broader-color shadowed planet
  scene, with `100` measured runs/profile, `5` warmups/profile,
  `performance.now()`, `gl.finish()`, diagnostic readbacks disabled inside the
  measured loop, and `10 ms` yields every `5` measured runs. The browser
  reported the intended `786432` pixel runtime input and accepted all
  criteria. Steady-state means remained fractional on the RTX 2060 browser
  run: `ideal` `0.3990 ms`, `balanced` `0.2710 ms`,
  `balanced-cache-interp` `0.2900 ms`, `adaptive-balanced-soft` `0.2070 ms`,
  `fast` `0.2100 ms`, `fast-cache-interp` `0.2520 ms`, and `draft`
  `0.2310 ms`. Treat those absolute numbers with timer/granularity caution;
  the more important new signal is warmup/pipeline creation, where first
  warmup frames spiked from about `50 ms` for `ideal` up to about `1.5-6.2 s`
  for several candidate shaders. Quality selection is still governed by the
  diff records: `balanced-cache-interp` remains the best serious quality
  candidate even though some lower-quality profiles report faster steady-state
  means. Report:
  `tmp/atmosphere/reconciliation/447-m3-gpu-quality-performance-benchmark-setup-warmup-1024x768/report.md`.
- Runtime quality policy design: `shader-design.md#runtime-quality-policy`
  now records the hybrid policy for production use. `Auto` is the default:
  user preference sets the allowed quality range, while runtime adaptation may
  move one tier at a time inside that range after sustained frame-budget
  pressure or a longer stable under-budget window. Tier changes must select
  among already installed and warmed shader handles, or schedule setup/config
  work outside frame rendering while the prior valid tier remains active.
  `balanced-cache-interp` is the preferred first production candidate from
  current quality evidence; `ideal` remains reference/high-quality;
  `fast` is a pressure fallback; and `draft` stays diagnostic/preview only.
  Warmup/pipeline spikes from record `447` are treated as a first-class reason
  to prebuild/prewarm allowed tiers and avoid surprise shader compilation
  during interaction.
- CPU/GPU ideal visual parity guardrail: CPU-vs-GPU planet-scene comparisons
  must use the integrated browser constructed-scene path only:
  `m3PlanetSphereGroundScene --with-shader --shader-backend cpu|gpu`.
  The older Node CPU planet renderer is not a valid substitute for this parity
  comparison because it owns separate scene construction and can drift from the
  browser scene. Record `448` is a rejected pre-fix CPU integrated attempt at
  `456 x 256`: the page was still making row progress, but the submitter and
  browser wrapper used fixed wall-clock timeouts. The runner, browser wrapper,
  and CPU composer pass now use progress/inactivity semantics instead:
  progress is reported at least every `5 s` while CPU rows advance, and
  timeouts fire only after the timeout window passes without fresh watcher/page
  progress. The user-run watcher must be restarted to pick up the browser
  wrapper and page-side progress changes before rerunning the CPU integrated
  `256 px` comparison.
- CPU/GPU ideal `256 px` comparison: records `451` through `454` complete the
  requested side-by-side using only the integrated constructed-scene shader
  path. Record `451` renders the CPU integrated ideal shader at `456 x 256`
  for the broader-color shadowed midpoint-Sun scene; it took about `1571 s`
  and accepted after the progress/inactivity timeout fix. Record `452` renders
  the matching GPU ideal scene and accepts. Record `454` compares CPU as the
  actual image against GPU ideal as expected and writes the requested composite
  `tmp/atmosphere/reconciliation/454-m3-cpu-gpu-ideal-comparison-456x256/images/cpu-gpu-ideal-diff-x4.png`.
  Metrics are very tight but not byte-identical: max RGBA byte delta `1`,
  mean RGBA byte delta `0.0219`, mean display-luma byte delta `0.0294`,
  and `9861` mismatched pixels out of `116736`. Record `453` was a rejected
  comparison-runner initialization bug before `454` accepted.
- Milestone 4 status classification: implementation is ahead of the formal
  M4 checklist only in pre-GPU local/flat support and subjective review
  tooling. Prepared work includes browser-integrated CPU composer support for
  `flat-earth` / `local-sun`, geometry-owned flat ground and scene-frame
  conversion, local L2 cache binding, local Sun
  `degreesFromClosestApproach` source-phase semantics, source-owned endpoint
  Three lighting through the optional
  `LightSourceModel.createThreeLightingObjects(...)` integration adapter,
  optional source-owned shadows, and user-requested local/flat subjective
  review renders. The design now records that this adapter is renderer
  integration/display capture: geometry maps model/source positions into
  observer-local Three scene coordinates, the light source creates endpoint
  scene lights/shadow helpers plus metadata, and the resulting shaded scene
  color is composed after `evaluate(...)`. These records are useful M4
  preparation and defect-finding context. Record
  `534-m4-local-cache-texture-prep` now accepts M4.1 local cache texture prep:
  the local L2 cache builds `315 / 315` coordinates/values, emits a
  deterministic packed `rgba32f` 3D shader payload
  `incident-radiance-local-l2` with texture dimensions `9 x 7 x 20` and
  `5040` upload floats, records z/rho/direction/spectral-group lookup
  metadata, proves `TextureBuilder` can materialize the cache request, and
  verifies runtime cache access is still geometry-resolved through
  `local-source-z-rho` packets. Record `533` is preserved as a rejected
  probe-criterion bug before `534` accepted. Record
  `535-m4-local-gpu-cache-texture-lookup` accepts M4.2: the browser WebGL2
  path uploads the real `incident-radiance-local-l2` payload as a `9 x 7 x 20`
  `rgba32f` 3D texture with `5040` floats, compiles the new local/flat shader
  descriptor/contribution set, binds the local cache sampler, and verifies
  GLSL lookup by matching the expected packed-cache texel readback
  `[128, 182, 204, 255]`. That record includes an initial flat-geometry GPU
  contribution for assembly/compile and diagnostic cache-coordinate lookup,
  and records `536-m4-flat-geometry-gpu-selected-ray-parity` and
  `537-m4-local-flat-gpu-integrated-selected-pixel-parity` accept M4.3.1.
  Record `536` proves selected-ray/path-bound parity against CPU
  `FlatEarthGeometry`, including browser ray reconstruction, scene-hit
  termination, ground/top/observer-dome clipping, and z/rho cache access.
  Record `537` runs the same constructed local-flat scene through integrated
  CPU and GPU composer backends with the local L2 cache contract and matches
  selected browser readbacks with max byte delta `1`. Still open M4 work begins
  at M4.3.2: required review galleries, any remaining local-second-order
  evidence recreation beyond the accepted objective records, and final
  local/GPU closeout.
- M4.3.2 review-gallery recreation has started with GPU Union Glacier Camp
  rows. Records `538` through `542` render the
  `union-glacier-camp-2021-dec14-degree-offsets` reference-box scene through
  the integrated GPU local/flat shader for local Sun offsets `180`, `135`,
  `90`, `45`, and `0` degrees from closest approach. Record
  `543-m4-gpu-integrated-flat-local-sun-union-glacier-2021-dec14-reference-boxes-phase-stack-180-to-000-228x128`
  composites those accepted rows into
  `images/union-glacier-2021-dec14-gpu-reference-boxes-phase-stack-180-to-000.png`.
  Records `544` through `548` repeat those GPU Union Glacier rows with an
  added centered Denali-scale review box at `200 km` front-face distance,
  height `6.2 km`, width `50 km`, and depth `100 km`. Record
  `549-m4-gpu-union-glacier-2021-dec14-denali-200km-phase-stack-180-to-000-228x128`
  writes the accepted stack
  `images/union-glacier-2021-dec14-gpu-denali-200km-phase-stack-180-to-000.png`.
- Flat/local integrated CPU verification: record
  `456-m3-cpu-integrated-flat-local-sun-96x54` accepts a browser-integrated
  CPU EffectComposer smoke for `flat-earth` geometry with `local-sun`
  lighting. `FlatEarthGeometry` now owns the flat Three ground endpoint
  factory and observer-local scene frame conversion (`scene.x, -scene.z,
  scene.y` into flat model space), parallel to the spherical geometry ground
  object contract. The browser CPU composer now chooses the local/flat
  evaluator from explicit runtime `geometryKind`/`lightSourceKind` fields and
  still calls public `SpectralReferenceEvaluator.evaluate(...)`. Record `456`
  verifies the flat/local input contract, geometry-owned ground, hit/no-hit
  pixels, local scene object hits, positive selected-pixel path radiance, and
  saved `images/canvas-image.png` plus `images/pre-shader-scene-color.png`.
  Record `455` was a rejected submitter-criterion typo before `456` accepted.
  Record `458-m3-cpu-integrated-flat-local-sun-l2-more-boxes-96x54` supersedes
  `456` as the current flat/local CPU integrated smoke because it explicitly
  builds and binds the local L2 incident-radiance cache. It reports
  `local-l2-cache-sampler`, cache coordinate/value count `315 / 315`, and
  positive selected-pixel `incidentInScatteringMean` values. The local-flat
  diagnostic scene now includes farther yellow, cyan, and magenta boxes in
  addition to the near green and far blue boxes, and record `458` verifies
  every listed diagnostic box has raycast hit pixels. Record `457` rejected
  only because two newly added far boxes were hidden behind nearer boxes at
  the tiny `96 x 54` review resolution before their angular placement was
  separated. Records `459` through `464` supersede `458` for endpoint-visibility
  diagnostics. The local-flat scene now uses a distance ladder for the
  diagnostic boxes, selected CPU diagnostics are chosen from actual raycast
  object-hit pixels, and each selected pixel reports captured scene RGBA,
  final output RGBA, byte delta, display-composition details, and decoded hit
  distance. Record `459` first isolated the original symptom: endpoint hits
  were being composed, but the previous scene's selected hit distances were too
  short to move visibly. Record `460` then corrected the flat ground visual
  input to use explicit display RGBA, so the pre-shader selected ground pixel
  was `[86,105,66]` instead of the earlier dark linearized value. The current
  flat/local endpoint-color setup is accepted in
  `464-m3-cpu-integrated-flat-local-sun-planet-scale-high-observer-final-160x90`,
  and record
  `465-m3-cpu-integrated-flat-local-sun-planet-scale-high-observer-final-320x180`
  rerenders the same setup at doubled review resolution.
  It scales the Three scene like the planet path (`1000 m/scene-unit`),
  spaces the boxes from about `12 km` through `58 km`, and sets
  `sceneDepthMaxMeters` to the flat geometry sky-ray limit (`1926774 m`). The
  raycast capture now respects the representable scene-depth range before
  marking a hit. Record `464` reports `nearMaxDepthHitBucket: 0`; record `465`
  accepts the unlit `320 x 180` review render. Record
  `466-m3-cpu-integrated-flat-local-sun-planet-scale-high-observer-shaded-320x180`
  turns on Three Lambert endpoint shading for the flat ground visual mesh and
  diagnostic boxes, adds a DirectionalLight from the resolved local Sun
  direction plus ambient fill, and keeps lighting strictly in the captured
  composer RenderPass scene color. Record
  `467-m3-cpu-integrated-flat-local-sun-planet-scale-150m-shaded-320x180`
  lowers the observer/camera height to `150 m` (`0.15` scene units). Record
  `468-m3-cpu-integrated-flat-local-sun-planet-scale-150m-close-boxes-shaded-320x180`
  adds close red, orange, and white diagnostic boxes at roughly `0.9 km`,
  `1.8 km`, and `3.5 km` in front of the camera. Record
  `469-m3-cpu-integrated-flat-local-sun-planet-scale-150m-rotated-close-boxes-shaded-320x180`
  rotates the diagnostic boxes so their faces are no longer square to the
  camera: close red `18 deg`, close orange `-24 deg`, close white `31 deg`,
  near green `-16 deg`, far blue `22 deg`, mid yellow `-12 deg`, far cyan
  `17 deg`, and far magenta `-20 deg`. Record
  `470-m3-cpu-integrated-flat-local-sun-source-driven-light-rotated-close-boxes-480x270`
  supersedes `469` as the current flat/local visual review artifact. It raises
  the image size by 50% to `480 x 270` and replaces the hardcoded
  DirectionalLight endpoint-scene light with the older shader-lab-style
  source-driven local PointLight policy: white point light at the configured
  local source position, `decay = 0`, intensity
  `2.4 * observerIncidentScale`, and low ambient fill. The integrated CPU pass
  still calls `SpectralReferenceEvaluator.evaluate` with flat/local ray and
  hit-distance facts only, then composes the lit captured endpoint color after
  spectral transport. Record `470` accepts with local L2 still bound
  (`315 / 315` cache values), all listed diagnostic boxes hit, selected ground
  hit distance about `333 m`, `observerIncidentScale` about `1.00006`, and
  point-light intensity about `2.40013`.
- Flat/local source-owned Three lighting: record
  `471-m3-cpu-integrated-flat-local-sun-source-owned-three-light-smoke-160x90`
  keeps the same visual policy but moves the Three-light conversion to the
  light-source abstraction. The browser scene runner now asks
  `FlatEarthGeometry` for the source's observer-local Three placement and
  source-relative packet, then asks
  `LocalSunLightSource.createThreeLightingObjects(...)` for the ambient fill
  and source-driven `PointLight`. The runner no longer duplicates local-source
  falloff or incident-scale math. Record `471` accepted at `160 x 90`, reports
  lighting owner `LocalSunLightSource`, keeps the local L2 cache bound
  (`315 / 315` cache values), and verifies all diagnostic boxes plus ground
  hits.
- Flat/local wide box layout: record
  `473-m3-cpu-integrated-flat-local-sun-wide-box-layout-480x270` first spread
  the same diagnostic boxes across the horizontal field of view while
  preserving their distance ladder, colors, Lambert endpoint materials,
  source-owned Three light conversion, and integrated CPU shader path. It
  still left two side clusters, so record
  `475-m3-cpu-integrated-flat-local-sun-even-box-layout-480x270` supersedes it
  as the current layout record. Record `475` changes only diagnostic box
  horizontal placement: selected object hits now span the `480`-wide frame at
  about x=`31`, `91`, `134`, `183`, `239`, `288`, `342`, and `383`, giving
  left, middle, and right coverage. Record `474` accepted the same layout as a
  `160 x 90` smoke; record `475` accepts at `480 x 270`, keeps local L2 bound
  (`315 / 315` cache values), and reports hit pixels for every listed
  diagnostic box plus the geometry-owned flat ground.
- Flat/local shadows and pixelation note: record
  `477-m3-cpu-integrated-flat-local-sun-shadows-480x270` supersedes `475` as
  the current visual record. It turns on source-owned Three shadows through
  `LocalSunLightSource.createThreeLightingObjects(...)`: when shadows are
  enabled, the light source returns a source-directional shadow light using
  the local source direction and `observerIncidentScale` for endpoint scene
  brightness, while Algorithm32 still samples the true finite local source.
  The flat scene renderer enables Three shadow maps, diagnostic boxes cast and
  receive shadows, and the geometry-owned flat ground visual mesh receives
  shadows. Record `477` accepts at `480 x 270`, keeps local L2 bound
  (`315 / 315` cache values), reports hit pixels for every diagnostic box, and
  adds the `local-flat-shadows-enabled` acceptance criterion. Render-quality
  diagnostics now record Three-side antialiasing/MSAA-capable composer targets
  separately from the single-center-sample raycast hit mask, which remains the
  main source of visible stair-stepping at this review resolution.
- Local Sun degree-language clarification: when a review or runner request
  gives a local Sun degree value, it means `degreesFromClosestApproach`, the
  orbit phase measured along the configured local orbit from closest approach.
  It is not an apparent sky-altitude/elevation angle. Source position,
  apparent altitude/azimuth, lighting direction, and shadow direction must be
  derived from the resolved orbit state.
- 45-degree local Sun render: record
  `478-m3-cpu-integrated-flat-local-sun-045deg-shadows-480x270` renders the
  integrated CPU flat/local shadow scene using seed
  `san-jose-045deg-from-closest`, so the Sun is `45` degrees along its local
  orbit from closest approach rather than at `45` degrees apparent elevation.
  The record accepts at `480 x 270` with `flat-earth / local-sun`,
  `local-l2-cache-sampler` (`315 / 315` values), source-owned Three shadows,
  and hit pixels for every diagnostic box plus the geometry-owned flat ground.
- Contact-shadow follow-up: record
  `479-m3-cpu-integrated-flat-local-sun-045deg-contact-shadows-480x270`
  rerenders the same scene after removing the local flat shadow-map
  `normalBias`. The prior `0.02` scene-unit normal bias equaled `20 m` at the
  current `1000 m / scene unit` scale and could produce shadow
  peter-panning. The diagnostic boxes are grounded: their center heights equal
  half their box heights, placing bottom faces at scene `y = 0`, and the
  geometry-owned visual/raycast flat ground is also scene `y = 0`. Record
  `479` accepts with `normalBias: 0`, source-owned Three shadows, local L2
  bound (`315 / 315` values), and hit pixels for every diagnostic box.
- Compact shadow camera and lighting parity check: record
  `480-m3-cpu-integrated-flat-local-sun-045deg-compact-shadow-camera-480x270`
  supersedes `479` for current shadow-contact review. It keeps the same
  `san-jose-045deg-from-closest` scene and `normalBias: 0`, but places the
  source-owned directional shadow camera in a compact scene-object frame
  instead of at the finite local Sun distance:
  `lightDistanceSceneUnits = shadowFrame.extentSceneUnits * 4` and
  `cameraFar = shadowFrame.extentSceneUnits * 8`. Record `480` accepts at
  `480 x 270` with source-owned Three shadows, local L2 bound (`315 / 315`
  values), and hit pixels for every diagnostic box plus the flat ground.
  A local-second-order source-contract check against the same `150 m`
  `san-jose-045deg-from-closest` input shows the source-scale math still
  matches exactly: both paths compute distance `7119112.070777757 m`, falloff
  `0.45460144854799356`, incident scale `0.5033233098516792`, and endpoint
  light intensity `1.20797594364403`. The remaining lighting-policy mismatch
  is in the Three endpoint light object under shadows: local-second-order used
  a white `PointLight` with `decay = 0`, while the current reconciliation
  shadow path uses a compact `DirectionalLight`. Treat dark 45-degree review
  output as endpoint Three lighting/shadow policy until proven otherwise, not
  as an `evaluate(...)` or spectral-transport source-scale issue.
- No-shadow brightness diagnostic and 90-degree render: record
  `482-m3-cpu-integrated-flat-local-sun-045deg-shaded-no-shadows-240x135`
  accepts the smaller source-owned shading diagnostic with Three shadows
  disabled. Record `481` wrote the same images but was rejected only because
  the browser-side criterion still assumed shadows-on; the submitter and
  browser criteria now honor `--shadows-enabled false`. Record `482` uses the
  old-runner-style `source-driven-flat-local-point-light`, reports
  `observerIncidentScale = 0.5033233098516792`, `falloffScale =
  0.45460144854799356`, `pointLightIntensity = 1.20797594364403`, and
  `shadowPolicy: shadows-disabled`, and still looks dark in the pre-shader
  endpoint scene. That supports the user decision to treat the 45-degree scene
  as intrinsically dark rather than as a DirectionalLight bug. Record
  `483-m3-cpu-integrated-flat-local-sun-090deg-shadows-480x270` then accepts
  the larger `480 x 270` render for `san-jose-090deg-from-closest`, with
  source-owned shadows, local L2 bound (`315 / 315` values), every diagnostic
  box hit, and `pointLightIntensity = 0.5492917826134377`. Primary artifact:
  `tmp/atmosphere/reconciliation/483-m3-cpu-integrated-flat-local-sun-090deg-shadows-480x270/images/canvas-image.png`.
- Fixed endpoint-light scale: record
  `484-m3-cpu-integrated-flat-local-sun-090deg-fixed-endpoint-light-240x135`
  changes source-owned Three endpoint lighting so the local Sun direction still
  shades and shadows scene objects, but the captured endpoint scene no longer
  multiplies the Three light intensity by `observerIncidentScale`. That scale
  remains reported and consumed by Algorithm32 transport; it is not pre-applied
  to hit color. Record `484` accepts at `240 x 135` for
  `san-jose-090deg-from-closest`, with source-owned shadows, local L2 bound
  (`315 / 315` values), every diagnostic box hit, `endpointSceneIncidentScale
  = 1`, `pointLightIntensity = 2.4`, and transport diagnostics still reporting
  `observerIncidentScale = 0.22887157608893238`. Primary artifact:
  `tmp/atmosphere/reconciliation/484-m3-cpu-integrated-flat-local-sun-090deg-fixed-endpoint-light-240x135/images/canvas-image.png`.
- Small 135/180-degree review images: records
  `485-m3-cpu-integrated-flat-local-sun-135deg-fixed-endpoint-light-240x135`
  and
  `486-m3-cpu-integrated-flat-local-sun-180deg-fixed-endpoint-light-240x135`
  render the requested `135` and `180` degrees-from-closest small review
  images. Both use the fixed endpoint-light policy from `484`, source-owned
  shadows, integrated CPU `evaluate(...)`, local L2 bound (`315 / 315`
  values), and every diagnostic box hit. Both keep `endpointSceneIncidentScale
  = 1` and `pointLightIntensity = 2.4`; the transport-only
  `observerIncidentScale` values are `0.14811017678417482` for `135` degrees
  and `0.1292226561015886` for `180` degrees. Primary artifacts:
  `tmp/atmosphere/reconciliation/485-m3-cpu-integrated-flat-local-sun-135deg-fixed-endpoint-light-240x135/images/canvas-image.png`
  and
  `tmp/atmosphere/reconciliation/486-m3-cpu-integrated-flat-local-sun-180deg-fixed-endpoint-light-240x135/images/canvas-image.png`.
- Tilted-up local Sun phase stack: records
  `487-m3-cpu-integrated-flat-local-sun-000deg-tilted-up-fixed-endpoint-light-240x135`
  through
  `491-m3-cpu-integrated-flat-local-sun-180deg-tilted-up-fixed-endpoint-light-240x135`
  rerender `0`, `45`, `90`, `135`, and `180` degrees from closest approach
  with the camera still at `150 m`, but explicitly looking at `250 m` height
  `800 m` out. The frame now keeps more sky and less unused foreground while
  preserving the fixed endpoint-light policy, source-owned shadows, integrated
  CPU shader path, and local L2 cache binding. Record
  `492-m3-cpu-integrated-flat-local-sun-tilted-up-phase-stack-240x135` writes
  the single requested stacked image:
  `tmp/atmosphere/reconciliation/492-m3-cpu-integrated-flat-local-sun-tilted-up-phase-stack-240x135/images/local-sun-tilted-up-phase-stack.png`.
- Source-scaled local endpoint light review: records
  `493-m3-cpu-integrated-flat-local-sun-000deg-tilted-up-source-scaled-light-240x135`
  through
  `497-m3-cpu-integrated-flat-local-sun-180deg-tilted-up-source-scaled-light-240x135`
  rerun the same tilted-up five-phase set with
  `endpointSceneLightScalePolicy = observer-incident-scale`. This turns the
  local endpoint light scale back on, so source-owned Three Lambert/shadow
  lighting tracks the local Sun observer incident scale again while the CPU
  shader path, camera, shadows, and local L2 cache binding remain unchanged.
  The recorded endpoint scales/intensities are approximately `1.000056 /
  2.400134`, `0.503323 / 1.207976`, `0.228872 / 0.549292`, `0.148110 /
  0.355464`, and `0.129223 / 0.310134` for `0`, `45`, `90`, `135`, and
  `180` degrees from closest approach. Record
  `498-m3-cpu-integrated-flat-local-sun-tilted-up-source-scaled-light-phase-stack-240x135`
  writes the matching stack:
  `tmp/atmosphere/reconciliation/498-m3-cpu-integrated-flat-local-sun-tilted-up-source-scaled-light-phase-stack-240x135/images/local-sun-tilted-up-source-scaled-light-phase-stack.png`.
- Sunward-camera local Sun review: records
  `499-m3-cpu-integrated-flat-local-sun-180deg-camera-toward-180sun-source-scaled-light-240x135`
  through
  `503-m3-cpu-integrated-flat-local-sun-135deg-camera-toward-180sun-source-scaled-light-240x135`
  keep the source-scaled endpoint light, `150 m` camera height, `250 m`
  look-at height, `800 m` look-at distance, shadows, and CPU shader path, but
  rotate the camera toward the `180`-degree local Sun source direction via
  `--look-toward-scene-index 4`. The scene can now add deterministic
  camera-forward review boxes, and both browser and runner criteria accept a
  payload-provided minimum diagnostic-box hit count for rotated review cameras.
  This set uses `cameraForwardReviewBoxes = true` and minimum visible
  diagnostic box count `3`. Record
  `504-m3-cpu-integrated-flat-local-sun-camera-toward-180sun-source-scaled-light-phase-stack-240x135`
  writes the stack ordered `0`, `45`, `90`, `135`, `180`:
  `tmp/atmosphere/reconciliation/504-m3-cpu-integrated-flat-local-sun-camera-toward-180sun-source-scaled-light-phase-stack-240x135/images/local-sun-camera-toward-180sun-source-scaled-light-phase-stack.png`.
- Ocean-colored flat-ground closest-approach view: record
  `505-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-ocean-flat-ground-240x135`
  renders the requested single `240 x 135` scene with local Sun at closest
  approach and the camera aimed toward that same source direction. It keeps
  the integrated CPU shader path, source-scaled endpoint light, local L2 cache,
  `150 m` camera height, `250 m` look-at height, and `800 m` look-at distance.
  The geometry-owned flat ground uses `groundDisplayRgba = [69, 128, 111,
  255]`, matching the earlier diagnostic ocean matte color, and diagnostic
  boxes are disabled for a clean ocean-ground view. Primary artifact:
  `tmp/atmosphere/reconciliation/505-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-ocean-flat-ground-240x135/images/canvas-image.png`.
- Water.js POC ground trial: record
  `507-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-water-js-ground-240x135`
  renders that same closest-approach camera-toward-sun ocean scene with a
  Three.js `Water` addon mesh as the visible ground. Hit distance and ground
  termination still come from the geometry-owned exact flat ground raycast;
  the Water mesh is coplanar visible material only. The runner keeps
  integrated CPU `evaluate(...)`, source-scaled endpoint light, local L2 cache
  binding (`315 / 315` values), `150 m` camera height, `250 m` look-at height,
  `800 m` look-at distance, `240 x 135`, and no diagnostic boxes. Record
  `506` first revealed that returning the Water mesh in browser diagnostics
  dropped the structured page result; the summary now records only JSON-safe
  Water material facts. Record `507` accepts with `flat-earth / local-sun`,
  `SpectralReferenceEvaluator.evaluate`, source-owned shadows, and ground-only
  hit pixels. Primary artifact:
  `tmp/atmosphere/reconciliation/507-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-water-js-ground-240x135/images/canvas-image.png`.
  Both the pre-shader and shader outputs show a right-edge Water.js visual
  artifact, so this is useful POC evidence but not final ocean rendering.
- One-meter Water.js camera check: record
  `508-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-water-js-ground-1m-240x135`
  rerenders the same Water.js closest-approach ocean scene with the camera at
  `1 m` above the flat ground. The look target was also lowered by `149 m`
  (`101 m` look-at height at the same `800 m` look-at distance) to preserve the
  previous pitch while isolating camera height. The browser job accepted and
  wrote both images; the right-edge Water.js visual artifact is still visible
  in the pre-shader capture, confirming it is upstream of Algorithm32
  composition. The submitter record is rejected only because the selected
  ground hit is about `4.6 m` away, so the computed hit-pixel atmosphere
  contribution is positive but rounds to `0` RGBA byte delta for
  `selected-hit-pixel-atmosphere-delta-present`. Primary artifact:
  `tmp/atmosphere/reconciliation/508-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-water-js-ground-1m-240x135/images/canvas-image.png`.
- Current ocean matte baseline after Water.js removal: record
  `509-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-ocean-matte-ground-150m-240x135`
  removes the Water.js quick-test path from the active renderer and returns the
  closest-approach camera-toward-sun ocean scene to geometry-owned Lambert
  matte ground. The ocean color remains `groundDisplayRgba = [69, 128, 111,
  255]`; the camera is back at `150 m` with `250 m` look-at height and `800 m`
  look-at distance. The scene keeps the integrated CPU shader path,
  source-scaled endpoint light, local L2 cache binding (`315 / 315` values),
  source-owned shadows, and diagnostic boxes disabled. Record `509` accepts
  with ground hit distances from about `571 m` to `48.7 km`. Primary artifact:
  `tmp/atmosphere/reconciliation/509-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-ocean-matte-ground-150m-240x135/images/canvas-image.png`.
- Far-horizon review box: record
  `511-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-500m-box-240x135`
  adds one grounded review box to the current ocean matte scene. The box is
  `500 m` tall, `1 km x 1 km` wide/deep, and placed `160 km` along the
  camera/source-facing direction with diagnostic boxes still disabled. Record
  `510` tried a `300 m` tall version and was rejected because the object was
  visible in the pre-shader image but missed by the single center-ray hit mask.
  For this optional far-review-box path, the raycast hit/depth capture now
  uses a small subpixel sample grid and prefers non-ground subpixel hits for
  the review object. Record `511` accepts with `2` review-box hit pixels at
  about `159.5 km`, local L2 cache binding (`315 / 315` values), and selected
  hit-pixel transmittance mean about `0.00136`, so the box is heavily fogged by
  the integrated CPU shader. Primary artifact:
  `tmp/atmosphere/reconciliation/511-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-500m-box-240x135/images/canvas-image.png`.
- Enlarged far-horizon review box: record
  `512-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-20kmx100kmx100km-box-240x135`
  supersedes `511` for visibility. The box is now `20 km` tall and `100 km x
  100 km` wide/deep. Its near/front face is placed at about `160 km` along the
  camera/source-facing direction, while its center is about `210 km` out due to
  the `100 km` depth. Diagnostic boxes remain disabled and the optional
  far-review-box subpixel hit/depth capture remains enabled. Record `512`
  accepts with `2154` review-box hit pixels, hit distances from about
  `160.0 km` to `168.6 km`, local L2 cache binding (`315 / 315` values), and
  selected review-box transmittance mean about `0.00101`. Primary artifact:
  `tmp/atmosphere/reconciliation/512-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-20kmx100kmx100km-box-240x135/images/canvas-image.png`.
- Denali-height far-horizon review box: record
  `513-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-6p2kmx100kmx100km-box-240x135`
  supersedes `512` for the current review scale. The box is now `6.2 km` tall
  with the same `100 km x 100 km` footprint, near/front face at about
  `160 km`, and center at about `210 km`. Diagnostic boxes remain disabled and
  the optional far-review-box subpixel hit/depth capture remains enabled.
  Record `513` accepts with `726` review-box hit pixels, hit distances from
  about `160.0 km` to `167.7 km`, local L2 cache binding (`315 / 315` values),
  and selected review-box transmittance mean about `0.00101`. Primary
  artifact:
  `tmp/atmosphere/reconciliation/513-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-6p2kmx100kmx100km-box-240x135/images/canvas-image.png`.
- 256-line current flat/local render: record
  `514-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-6p2kmx100kmx100km-box-455x256`
  rerenders the same Denali-height ocean-matte scene at `455 x 256`. This
  remains the flat-earth/local-Sun current scene
  (`local-flat-ground-san-jose-000deg-closest`), not the spherical/globe
  renderer. Record `514` accepts with `2535` review-box hit pixels, local L2
  cache binding (`315 / 315` values), and review-box hit distances from about
  `160.0 km` to `167.7 km`. Primary artifact:
  `tmp/atmosphere/reconciliation/514-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-6p2kmx100kmx100km-box-455x256/images/canvas-image.png`.
- Two Denali-height far-review boxes: record
  `515-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-228x128`
  replaces the single centered `6.2 km x 100 km x 100 km` review box with two
  grounded `6.2 km x 50 km x 100 km` orange boxes in the same current
  flat-earth/local-Sun ocean-matte scene. The left box is offset `-35 km` with
  near/front face at `160 km`; the right box is offset `+35 km` with near/front
  face at `240 km`, interpreting "further back by half" as `50%` farther than
  `160 km`. Record `515` accepts at `228 x 128` with both review boxes hit:
  `368` left-box pixels and `174` right-box pixels, with hit-distance ranges
  about `160.3-225.9 km` and `240.2-317.9 km`. Primary artifact:
  `tmp/atmosphere/reconciliation/515-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-228x128/images/canvas-image.png`.
- Two-box 256-line render: record
  `516-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-455x256`
  rerenders the same two-box current flat/local ocean-matte scene at
  `455 x 256`. Record `516` accepts with both review boxes hit: `1350`
  left-box pixels and `624` right-box pixels. The left box hit-distance range
  is about `160.3-251.3 km`; the right box hit-distance range is about
  `240.2-331.4 km`. Primary artifact:
  `tmp/atmosphere/reconciliation/516-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-455x256/images/canvas-image.png`.
- Two-box 180-degree local Sun render: record
  `517-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-180deg-228x128`
  rerenders the same two-box flat/local ocean-matte scene at `228 x 128` with
  scene seed `san-jose-180deg-from-closest`. The camera remains aimed along
  the closest-approach direction, so this isolates the Sun phase from the
  object/camera layout. Record `517` accepts with both review boxes hit (`368`
  left, `174` right) and reports `observerIncidentScale =
  0.1292226561015886` plus `pointLightIntensity = 0.3101343746438126`.
  Primary artifact:
  `tmp/atmosphere/reconciliation/517-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-180deg-228x128/images/canvas-image.png`.
- Raised-camera 180-degree two-box render: record
  `518-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-180deg-228x128`
  rerenders record `517` with camera elevation `500 m`. The look target is
  raised from `250 m` to `600 m` to preserve pitch over the same `800 m`
  look-at distance. The scene seed remains `san-jose-180deg-from-closest`, and
  the two review boxes keep the same placement. Record `518` accepts with both
  boxes hit (`367` left, `173` right); ground hit distances shift from about
  `566 m-49.6 km` in record `517` to about `1.89 km-165.5 km`. Primary
  artifact:
  `tmp/atmosphere/reconciliation/518-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-180deg-228x128/images/canvas-image.png`.
- Winter-solstice 2025 current review default: record
  `519-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-winter-solstice-2025-180deg-228x128`
  switches the current integrated flat/local review scenes from the historical
  Step018/summer-derived degree seeds to
  `san-jose-winter-solstice-2025-degree-offsets`. The set uses San Jose local
  noon on `2025-12-21T12:00:00-08:00`, which the annual-tropic-migration model
  resolves to a source subpoint latitude near `23.4995S`. The rendered
  180-degree-from-closest row keeps the `500 m` camera, `600 m` look target,
  ocean matte ground, two Denali-height review boxes, source-scaled endpoint
  light, source-owned shadows, integrated CPU shader path, and local L2 cache
  binding. The resolved 180-degree source altitude is about `14.64 deg`,
  azimuth about `58.11 deg`, and observer transport incident scale about
  `0.1894`. Record `519` accepts with both boxes hit (`367` left, `173`
  right). Primary artifact:
  `tmp/atmosphere/reconciliation/519-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-winter-solstice-2025-180deg-228x128/images/canvas-image.png`.
- Winter 180-degree sunward camera: record
  `520-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-winter-solstice-2025-180deg-camera-toward-180-228x128`
  rerenders the same winter-solstice 2025 two-box ocean-ground scene, but sets
  `look-toward-scene-index 4` so the camera points toward the recomputed
  winter `180` degree local Sun direction. The scene seed remains
  `san-jose-winter-solstice-2025-180deg-from-closest`, with source subpoint
  latitude near `23.4995S`, altitude about `14.64 deg`, azimuth about
  `58.11 deg`, and observer incident scale about `0.1894`. Record `520`
  accepts at `228 x 128`, with local L2 cache binding, source-owned shadows,
  both boxes hit (`367` left, `173` right), and a warmer sunward horizon/box
  output. Primary artifact:
  `tmp/atmosphere/reconciliation/520-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-winter-solstice-2025-180deg-camera-toward-180-228x128/images/canvas-image.png`.
- Winter 180-degree many-box ground scene: record
  `521-m3-cpu-integrated-flat-local-sun-ground-many-boxes-winter-solstice-2025-180deg-camera-toward-180-228x128`
  corrects the review back to the normal green ground / many-box fixture. It
  keeps the winter-solstice 2025 `180` degree seed and
  `look-toward-scene-index 4`, but uses default ground RGBA
  `[86, 105, 66, 255]`, diagnostic boxes enabled, camera-forward review boxes
  enabled for the turned camera, far-horizon review boxes disabled, `150 m`
  camera height, `250 m` look target, source-scaled endpoint light,
  source-owned shadows, integrated CPU shader path, and local L2 cache
  binding. Record `521` accepts at `228 x 128`; five non-ground boxes are hit:
  the near green box, very-far magenta box, and the three sunward
  near/mid/far review boxes. Primary artifact:
  `tmp/atmosphere/reconciliation/521-m3-cpu-integrated-flat-local-sun-ground-many-boxes-winter-solstice-2025-180deg-camera-toward-180-228x128/images/canvas-image.png`.
- Future follow-up added: visible Sun disk / direct solar-disc camera radiance
  is now recorded as deferred row `future-004` in
  `unsourced-and-partially-sourced-facts.md` and in the saved-for-later
  section of `algorithm32-abstraction-design.md`. The intended shape is a
  source-owned visible-emitter endpoint composed after `evaluate(...)` as
  `sourceEndpointRadiance * T_view + L_path`, with distant angular-radius or
  local ray-sphere disk tests, scene-hit occlusion, subpixel coverage, CPU/GPU
  parity, and explicit display/tone-map policy. It is not part of the current
  transport core and should not be implemented as a regular Three mesh whose
  captured RGB becomes hit color.
- Union Glacier Camp far-side source scene: record
  `522-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-far-side-orbit-plain-ground-camera-at-sun-228x128`
  adds a reusable Union Glacier Camp `2021-12-14` far-side orbit scene set and
  renders it as a plain ground/sky review. The scene uses Union Glacier Camp
  at `79.768036S`, `83.261666W`, elevation `700 m`; interprets the local Sun
  latitude as the real-world subsolar latitude for `2021-12-14` at longitude-0
  solar noon, approximated by the current annual-tropic-migration resolver at
  about `23.3477S`; aligns closest approach for that observer; then places the
  source at the `180` degree far-side orbit offset. The source subpoint
  longitude is about `96.7383E`,
  source altitude about `8.72 deg`, azimuth about `96.74 deg`, observer
  distance about `31,849 km`, and observer incident scale about `0.0618`. The
  camera is pointed toward that source azimuth and pitched from the source
  altitude (`150 m` camera, `800 m` look distance, `272.67 m` look-at height).
  Diagnostic boxes, camera-forward boxes, and far-horizon review boxes are all
  disabled, leaving only the geometry-owned flat ground. Record `522` accepts
  at `228 x 128` with local L2 cache binding. Primary artifact:
  `tmp/atmosphere/reconciliation/522-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-far-side-orbit-plain-ground-camera-at-sun-228x128/images/canvas-image.png`.
- Union Glacier reference-box scene: record
  `524-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-far-side-orbit-reference-boxes-accepted-camera-at-sun-228x128`
  rerenders the same far-side source view with grounded reference boxes in the
  landscape. Record `523` is preserved as a rejected visual attempt because
  the first submission left the diagnostic-box criterion disabled; record
  `524` enables diagnostic boxes and camera-forward review boxes, keeps the
  same source-facing camera, and accepts at `228 x 128` with local L2 cache
  binding and source-owned shadows. Three reference boxes are hit:
  `local-flat-sunward-near-yellow-box` (`470` pixels, about `1.52-1.69 km`),
  `local-flat-sunward-mid-white-box` (`496` pixels, about `3.41-3.82 km`),
  and `local-flat-sunward-far-orange-box` (`188` pixels, about
  `7.76-8.60 km`). Primary artifact:
  `tmp/atmosphere/reconciliation/524-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-far-side-orbit-reference-boxes-accepted-camera-at-sun-228x128/images/canvas-image.png`.
- Union Glacier closest-approach source scene: record
  `526-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-closest-approach-reference-boxes-current-camera-228x128`
  adds the reusable scene set
  `union-glacier-camp-2021-dec14-closest-approach` and rerenders the current
  Union Glacier reference-box landscape with the source moved to the `0`
  degree closest-approach orbit position. The closest source is at the same
  azimuth as the far-side scene (`96.74 deg`), but at about `37.58 deg`
  altitude with observer incident scale `1.0`. Record `525` is preserved as a
  rejected camera-at-source attempt because the high source pitch produced an
  all-sky no-hit frame. Record `526` keeps the landscape framing from record
  `524` (`150 m` camera, `800 m` look distance, `272.67 m` look-at height),
  changes only the source scene, and accepts at `228 x 128` with local L2
  cache binding, source-owned shadows, and the same three reference-box hit
  counts: near `470`, mid `496`, and far `188` pixels. Primary artifact:
  `tmp/atmosphere/reconciliation/526-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-closest-approach-reference-boxes-current-camera-228x128/images/canvas-image.png`.
- Union Glacier 180-to-0 phase stack: records `527` through `531` render the
  same Union Glacier reference-box landscape with the new
  `union-glacier-camp-2021-dec14-degree-offsets` scene set, ordered by local
  Sun offset from closest approach: `180`, `135`, `90`, `45`, and `0`
  degrees. Each row keeps the record `526` landscape framing (`150 m` camera,
  `800 m` look distance, `272.67 m` look-at height, camera aimed toward the
  closest-approach scene), diagnostic boxes, camera-forward review boxes,
  source-owned shadows, integrated CPU shader path, and local L2 cache
  binding. Record
  `532-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-reference-boxes-phase-stack-180-to-000-228x128`
  writes the requested labeled vertical composite, top-to-bottom `180`, `135`,
  `90`, `45`, `0`. Primary artifact:
  `tmp/atmosphere/reconciliation/532-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-reference-boxes-phase-stack-180-to-000-228x128/images/union-glacier-2021-dec14-reference-boxes-phase-stack-180-to-000.png`.
  This Union Glacier stack and the recent Denali/ocean/local-flat review
  scenes remain user-requested subjective inspection artifacts. They document
  observed behavior and can expose defects, but they are not design fixtures
  or milestone acceptance gates unless explicitly promoted later.
- Endpoint scene lighting policy update: the transport-neutral policy formerly
  named `fixed-review-light-intensity` is now `endpoint-material-shading` and
  is the default in the local-flat runner and light-source abstraction. It
  keeps Three endpoint lighting focused on material color, Lambert
  shading, and shadows while Algorithm32 applies finite-source and atmospheric
  transport. `observer-incident-scale` remains an explicit comparison/review
  mode for source-scaled endpoint lighting and should not be mixed into CPU/GPU
  parity comparisons unless both sides intentionally use it.
- Corrected CPU Union Glacier endpoint-material stack: records `550` through
  `554` rerender the `180`, `135`, `90`, `45`, and `0` degree
  `union-glacier-camp-2021-dec14-degree-offsets` rows through the integrated
  CPU composer shader path with
  `endpointSceneLightScalePolicy = endpoint-material-shading`. All five rows
  accepted at `228 x 128` with diagnostic boxes, camera-forward review boxes,
  source-owned shadows, and local L2 cache binding. Record
  `555-m4-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-endpoint-material-shading-phase-stack-180-to-000-228x128`
  writes the comparable CPU stack:
  `tmp/atmosphere/reconciliation/555-m4-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-endpoint-material-shading-phase-stack-180-to-000-228x128/images/union-glacier-2021-dec14-cpu-endpoint-material-shading-phase-stack-180-to-000.png`.
- Right-offset Denali review stacks: the Denali-sized review box now has a
  `100 km` camera-right lateral offset in the scene generator so it no longer
  hides behind the foreground boxes. Record `556` preserves the first
  corrected-CPU Denali row before this offset change. Records `557` through
  `561` render the right-offset Denali CPU rows, and record
  `562-m4-cpu-union-glacier-2021-dec14-denali-200km-right-offset-phase-stack-180-to-000-228x128`
  writes the CPU stack:
  `tmp/atmosphere/reconciliation/562-m4-cpu-union-glacier-2021-dec14-denali-200km-right-offset-phase-stack-180-to-000-228x128/images/union-glacier-2021-dec14-cpu-denali-200km-right-offset-phase-stack-180-to-000.png`.
  Records `563` through `567` render the matching GPU rows, and record
  `568-m4-gpu-union-glacier-2021-dec14-denali-200km-right-offset-phase-stack-180-to-000-228x128`
  writes the GPU stack:
  `tmp/atmosphere/reconciliation/568-m4-gpu-union-glacier-2021-dec14-denali-200km-right-offset-phase-stack-180-to-000-228x128/images/union-glacier-2021-dec14-gpu-denali-200km-right-offset-phase-stack-180-to-000.png`.
  CPU/GPU pre-shader scene-color comparison for the right-offset Denali rows
  reports max byte delta `0` and `0 / 29184` differing pixels for all five
  phases.
- Single-sample silhouette diagnostic: record
  `570-m4-cpu-union-glacier-2021-dec14-180deg-denali-200km-right-offset-no-antialias-nearest-output-228x128`
  adds `--no-antialias` support for the local-flat runner, forcing browser
  scene antialiasing off, composer render-target samples to `0`, and the CPU
  output texture copy to nearest filtering. The render accepted and records
  `rendererAntialias = false`, `renderTargetSampleCount = 0`,
  `renderTargetSamples = disabled-single-sample-composer-target`, and
  `cpuOutputTextureFilter = nearest-display-copy`. The diagnostic removes the
  soft antialias/linear-copy fringe component but leaves a hard edge
  stair-step, so coverage mismatch is a contributor, not yet the whole
  silhouette-brightness explanation.
- GPU path-only endpoint diagnostic: `--endpoint-radiance-scale` now controls
  captured endpoint-color contribution in the assembled GPU shader composition
  and the CPU soft-shader composition path. Record
  `571-m4-gpu-union-glacier-2021-dec14-000deg-denali-200km-right-offset-path-only-228x128`
  renders only the GPU backend with `endpointRadianceScale = 0`; scene hits
  still terminate view rays, but hit color is multiplied out so the image
  shows shader path radiance over the object/ground/sky ray lengths. Primary
  output:
  `tmp/atmosphere/reconciliation/571-m4-gpu-union-glacier-2021-dec14-000deg-denali-200km-right-offset-path-only-228x128/images/canvas-image.png`.
  Record
  `572-m4-gpu-union-glacier-2021-dec14-180deg-denali-200km-right-offset-path-only-228x128`
  renders the matching `180` degree GPU path-only row with the same
  right-offset Denali scene, source-owned shadows, local L2 cache binding, and
  `endpointRadianceScale = 0`; it accepted and preserves the path-radiance
  output at:
  `tmp/atmosphere/reconciliation/572-m4-gpu-union-glacier-2021-dec14-180deg-denali-200km-right-offset-path-only-228x128/images/canvas-image.png`.
- Box-owned endpoint indirect-fill contract: local-flat box placement can now
  opt boxes into a named endpoint indirect approximation. The current
  implementation ties the contract to the camera-forward review-box generator,
  computes a local fill anchor from those three foreground boxes, and passes
  the resulting packet to
  `LocalSunLightSource.createThreeLightingObjects(...)`. The light source adds
  a non-shadow-casting PointLight as a
  `vacuum-endpoint-indirect-approximation`; it modifies only captured endpoint
  scene color and does not enter `evaluate(...)`. Record
  `573-m4-gpu-union-glacier-2021-dec14-180deg-denali-200km-right-offset-endpoint-indirect-fill-smoke-228x128`
  preserves the broad-anchor first attempt, where legacy diagnostic boxes
  participated too. Record
  `574-m4-gpu-union-glacier-2021-dec14-180deg-review-box-cluster-endpoint-indirect-fill-228x128`
  tightens the contract to the three foreground review boxes but accidentally
  leaves the antialiasing/MSAA review path enabled. Record
  `575-m4-gpu-union-glacier-2021-dec14-180deg-review-box-cluster-endpoint-indirect-fill-no-antialias-228x128`
  fixes the antialiasing regression but remains visually ineffective because
  the fill is weak and centered inside the cluster; the near review box only
  reaches pre-shader max RGB `[13, 16, 10]`. Record
  `576-m4-gpu-union-glacier-2021-dec14-180deg-review-box-camera-side-endpoint-indirect-fill-no-antialias-228x128`
  proves a camera-side local point fill can move the foreground out of
  silhouette, but it also creates a visible local lighting patch on the ground.
  Record
  `577-m4-gpu-union-glacier-2021-dec14-180deg-general-ambient-endpoint-fill-r025-no-antialias-228x128`
  therefore supersedes the point-fill approach for now. The endpoint indirect
  approximation is now `general-ambient-fill`: a source-owned scene-wide
  ambient term derived from endpoint direct-light calibration through
  `--endpoint-ambient-fill-ratio`. Record `577` uses ratio `0.25`, fill
  intensity `0.6`, total ambient intensity `0.64`, direct endpoint intensity
  `2.4`, `rendererAntialias = false`, `renderTargetSampleCount = 0`,
  `cpuOutputTextureFilter = nearest-display-copy`, source-owned shadows still
  enabled, and GPU local/flat criteria accepted. The near review box
  pre-shader range becomes min/max RGB `[26, 19, 6]` / `[46, 36, 21]`,
  confirming visible non-silhouette endpoint color without a local ground glow
  patch. Primary output:
  `tmp/atmosphere/reconciliation/577-m4-gpu-union-glacier-2021-dec14-180deg-general-ambient-endpoint-fill-r025-no-antialias-228x128/images/canvas-image.png`.
  Record
  `578-m4-gpu-union-glacier-2021-dec14-180deg-opposite-directional-endpoint-fill-r025-no-antialias-228x128`
  adds `--endpoint-fill-policy opposite-directional-fill` as a selectable POC
  alternative to `general-ambient-fill`. It uses the same ratio flag
  (`--endpoint-ambient-fill-ratio 0.25`) but contributes a non-shadow-casting
  DirectionalLight from the anti-Sun horizontal direction while preserving the
  Sun altitude magnitude. The fill intensity is `0.6`, base ambient remains
  `0.04`, render quality remains single-sample/no-antialias, and GPU local/flat
  criteria accept. Near review box pre-shader range is min/max RGB
  `[12, 10, 2]` / `[44, 35, 10]`; ground minimum stays near `[4, 4, 3]`, so
  this option lifts the silhouette-facing boxes without the broad ambient
  ground lift seen in record `577`. Primary output:
  `tmp/atmosphere/reconciliation/578-m4-gpu-union-glacier-2021-dec14-180deg-opposite-directional-endpoint-fill-r025-no-antialias-228x128/images/canvas-image.png`.
  Record
  `579-m4-cpu-union-glacier-2021-dec14-180deg-opposite-directional-endpoint-fill-r025-no-antialias-228x128`
  rerenders that same scene through the integrated CPU composer shader by
  changing only `shaderBackend` from `gpu` to `cpu`. It keeps no-antialias,
  source-owned shadows, local L2 cache binding, the right-offset Denali box,
  and `opposite-directional-fill` at ratio `0.25`; it accepts with the same
  object hit counts as record `578`. Primary output:
  `tmp/atmosphere/reconciliation/579-m4-cpu-union-glacier-2021-dec14-180deg-opposite-directional-endpoint-fill-r025-no-antialias-228x128/images/canvas-image.png`.
  The local-flat integrated runner now also exposes
  `--scene-depth-capture-policy renderer-distance` as an opt-in alternative to
  the default `raycaster` depth/hit capture. The renderer-distance path renders
  the same scene and camera through a hidden override `ShaderMaterial`; each
  winning fragment writes packed camera-to-fragment distance, and no-fragment
  pixels remain no-hit. Record
  `580-m4-gpu-union-glacier-2021-dec14-180deg-renderer-distance-depth-opposite-fill-no-antialias-228x128`
  rerenders record `578` with that policy. It accepts with
  `sceneDepthCapturePolicy = renderer-distance`, keeps the same no-antialias,
  local L2 cache, source-owned shadows, right-offset Denali, and
  `opposite-directional-fill` settings, and reduces shader-input hit pixels
  from `10272` in record `578` to `10081`, consistent with resolving some
  raycaster/raster silhouette mismatch. Primary output:
  `tmp/atmosphere/reconciliation/580-m4-gpu-union-glacier-2021-dec14-180deg-renderer-distance-depth-opposite-fill-no-antialias-228x128/images/canvas-image.png`.
- Endpoint camera-distance composition option: the integrated CPU/GPU composer
  now accepts `--endpoint-camera-distance-scale-policy reverse-square` plus
  reference/min/max flags. It applies an additive endpoint brightness boost,
  `1 + clamp((hitDistance / referenceDistance)^2, min, max)`, only to the
  captured endpoint scene-color contribution after Algorithm32 transport. It
  does not enter `evaluate(...)` and does not alter sky/path radiance. The
  local-flat runner suppresses endpoint indirect fill when this option is
  active, so it does not stack with the current reverse-facing
  `opposite-directional-fill` proxy. Browser composer, runner, local/distant
  shader factories, and CPU soft-shader syntax checks pass.
  Record
  `581-m4-gpu-union-glacier-2021-dec14-180deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128`
  rerenders the latest Union Glacier GPU scene with the reverse-square
  endpoint camera-distance composition option, reference `200000 m`, min
  `0.05`, max `1`, renderer-distance hit/depth capture, no antialiasing, and
  the same right-offset Denali/review-box layout as record `580`. It accepts
  with `effectiveEndpointIndirectFillEnabled = false`,
  `endpointIndirectFillSuppressedByCameraDistanceScale = true`, and
  `10081` shader-input hit pixels. Primary output:
  `tmp/atmosphere/reconciliation/581-m4-gpu-union-glacier-2021-dec14-180deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.
  Record
  `582-m4-gpu-union-glacier-2021-dec14-090deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128`
  renders the same GPU/review layout at `90` degrees from closest approach
  with renderer-distance hit/depth capture, no antialiasing, reverse-square
  endpoint distance scale, and endpoint indirect fill suppressed. It accepts
  with source altitude `12.006470321633222 deg`, azimuth
  `63.00878956315418 deg`, incident scale `0.11636135496061355`, and `10081`
  shader-input hit pixels. Primary output:
  `tmp/atmosphere/reconciliation/582-m4-gpu-union-glacier-2021-dec14-090deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.
  Record
  `583-m4-gpu-union-glacier-2021-dec14-045deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128`
  renders the same GPU/review layout at `45` degrees from closest approach
  with renderer-distance hit/depth capture, no antialiasing, reverse-square
  endpoint distance scale, and endpoint indirect fill suppressed. It accepts
  with source altitude `19.853746253559972 deg`, azimuth
  `54.93114692079673 deg`, incident scale `0.3101537614110556`, and `10081`
  shader-input hit pixels. Primary output:
  `tmp/atmosphere/reconciliation/583-m4-gpu-union-glacier-2021-dec14-045deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.
  Record
  `584-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128`
  renders the San Jose winter-solstice review scene with the source at `90`
  degrees from closest approach and the camera looking toward the `180` degree
  scene direction. It keeps the current GPU renderer-distance/no-antialias
  reverse-square endpoint-distance setup, suppresses endpoint indirect fill,
  and accepts with source altitude `19.13760122098663 deg`, azimuth
  `-6.995817502567756 deg`, incident scale `0.31848646265063413`, and `10319`
  shader-input hit pixels. Primary output:
  `tmp/atmosphere/reconciliation/584-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.
  Record
  `585-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128`
  renders the same San Jose winter-solstice review framing with the source at
  closest approach while the camera remains aimed at the `180` degree scene
  direction. It keeps the same GPU renderer-distance/no-antialias
  reverse-square endpoint-distance setup and endpoint indirect fill
  suppression, and accepts with source altitude `35.51503446712982 deg`,
  azimuth `-121.88630000000002 deg`, incident scale `1`, and `10319`
  shader-input hit pixels. Primary output:
  `tmp/atmosphere/reconciliation/585-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.
  Record
  `586-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-no-endpoint-distance-scale-no-antialias-228x128`
  rerenders record `585` with `endpointCameraDistanceScale.policy = none`.
  This corrects the too-blue review result from `585`: the reverse-square
  endpoint distance option had clamped near endpoint color to its `0.05`
  minimum, allowing atmospheric path radiance to dominate nearby ground/box
  pixels. Endpoint indirect fill is active again as
  `opposite-directional-fill` with intensity `0.6`; the run accepts with the
  same `10319` shader-input hit pixels and object-hit counts as `585`. Treat
  `586` as the intended closest/San-Jose look-180 review artifact unless the
  endpoint-distance option itself is under test. Primary output:
  `tmp/atmosphere/reconciliation/586-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-no-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.
  Record
  `587-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128`
  fixes the reverse-square endpoint camera-distance option so it adds
  brightness instead of setting/replacing endpoint brightness. CPU and GPU
  composition now use `1 + clamp((hitDistance / referenceDistance)^2, min,
  max)`. The record rerenders the same closest/San-Jose look-180 setup as
  `585` with reverse-square enabled, renderer-distance hit/depth capture, no
  antialiasing, source-owned shadows, and endpoint indirect fill suppressed.
  It accepts with `10319` shader-input hit pixels, and the generated GLSL
  contains `endpointCameraDistanceBoostScale(...)`. Primary output:
  `tmp/atmosphere/reconciliation/587-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128/images/canvas-image.png`.
  Record
  `588-m4-gpu-san-jose-2025-winter-180deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128`
  rerenders the San Jose winter-solstice `180` degree row with both source and
  camera aimed at `san-jose-winter-solstice-2025-180deg-from-closest`. It keeps
  renderer-distance hit/depth capture, no antialiasing, source-owned shadows,
  and the corrected additive reverse-square endpoint-distance composition
  option. It accepts with source altitude `14.644366689327432 deg`, azimuth
  `58.11369999999999 deg`, incident scale `0.18940463789109677`, endpoint
  indirect fill suppressed, and `10319` shader-input hit pixels. Primary
  output:
  `tmp/atmosphere/reconciliation/588-m4-gpu-san-jose-2025-winter-180deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128/images/canvas-image.png`.
  Record
  `589-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128`
  rerenders the San Jose winter-solstice `90` degree row with the camera still
  aimed at the `180` degree scene direction. It keeps renderer-distance
  hit/depth capture, no antialiasing, source-owned shadows, and the corrected
  additive reverse-square endpoint-distance composition option. It accepts
  with source altitude `19.13760122098663 deg`, azimuth
  `-6.995817502567756 deg`, incident scale `0.31848646265063413`, endpoint
  indirect fill suppressed, and `10319` shader-input hit pixels. Primary
  output:
  `tmp/atmosphere/reconciliation/589-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128/images/canvas-image.png`.
  Record
  `590-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-no-endpoint-distance-scale-no-antialias-228x128`
  rerenders record `589` with the new endpoint camera-distance/backlight option
  disabled (`endpointCameraDistanceScale.policy = none`). The older
  `opposite-directional-fill` endpoint fill is active again at ratio `0.25`
  (`intensity = 0.6`), so this is the comparison artifact for the
  pre-distance-boost lighting path. It accepts with the same `90` degree
  source, camera aimed at `180`, source altitude `19.13760122098663 deg`,
  azimuth `-6.995817502567756 deg`, incident scale `0.31848646265063413`, and
  `10319` shader-input hit pixels. Primary output:
  `tmp/atmosphere/reconciliation/590-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-no-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.
  The local Sun endpoint lighting ambient floor is now lower:
  `LocalSunLightSource` defaults `request.ambientIntensity` to `0.01` instead
  of `0.04`, keeping endpoint scene lighting owned by the light-source
  abstraction while reducing the pre-shader ambient wash around near-object
  shadows.
  Record
  `591-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-low-ambient-no-endpoint-distance-scale-no-antialias-228x128`
  rerenders record `590` after the ambient-floor reduction. It keeps the `90`
  degree source, camera aimed toward `180`, renderer-distance hit/depth
  capture, no antialiasing, `endpointCameraDistanceScale.policy = none`, and
  the older `opposite-directional-fill` endpoint fill. It accepts with
  `baseAmbientIntensity = 0.01`, `ambientIntensity = 0.01`, endpoint fill
  intensity `0.6`, and `10319` shader-input hit pixels. Primary output:
  `tmp/atmosphere/reconciliation/591-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-low-ambient-no-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.
  Record
  `592-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-low-ambient-no-fill-no-endpoint-distance-scale-no-antialias-228x128`
  rerenders the same `90` degree San Jose comparison with endpoint indirect
  fill disabled. This isolates the source-owned directional shadow light plus
  the new low ambient floor. It accepts with `baseAmbientIntensity = 0.01`,
  `ambientIntensity = 0.01`, `endpointIndirectFill =
  {"enabled":false,"policy":"none"}`, and `10319` shader-input hit pixels.
  Primary output:
  `tmp/atmosphere/reconciliation/592-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-low-ambient-no-fill-no-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.
  Records `593` through `597` rerender the Union Glacier Camp `2021-12-14`
  phase rows through the integrated GPU local/flat shader at `456 x 256`. The
  rows use scene set `union-glacier-camp-2021-dec14-degree-offsets`, source
  offsets `180`, `135`, `90`, `45`, and `0` degrees from closest approach,
  camera aimed toward closest approach, renderer-distance hit/depth capture,
  no antialiasing, source-owned shadows, the current low local-Sun ambient
  floor, the corrected additive reverse-square endpoint-distance option,
  camera-forward reference boxes, and the Denali review box. Record
  `598-m4-gpu-union-glacier-2021-dec14-current-lighting-phase-stack-180-to-000-456x256`
  composites the five accepted rows into a `502 x 1280` stack:
  `tmp/atmosphere/reconciliation/598-m4-gpu-union-glacier-2021-dec14-current-lighting-phase-stack-180-to-000-456x256/images/union-glacier-2021-dec14-gpu-current-lighting-phase-stack-180-to-000-456x256.png`.
  Records `599` through `603` rerender the same `456 x 256` Union Glacier GPU
  rows with the opposite-direction endpoint backlight active
  (`endpointFillPolicy = opposite-directional-fill`,
  `endpointCameraDistanceScale.policy = none`). This keeps the new low
  local-Sun ambient floor and source-owned shadows, but disables the
  endpoint-distance boost so the backlight is not suppressed. Record
  `604-m4-gpu-union-glacier-2021-dec14-opposite-backlight-phase-stack-180-to-000-456x256`
  composites the five accepted rows into a `502 x 1280` stack:
  `tmp/atmosphere/reconciliation/604-m4-gpu-union-glacier-2021-dec14-opposite-backlight-phase-stack-180-to-000-456x256/images/union-glacier-2021-dec14-gpu-opposite-backlight-phase-stack-180-to-000-456x256.png`.
  The local Sun endpoint scene ambient approximation now preserves color before
  the atmosphere shader by scaling the ambient floor by the light reaching the
  observer: `ambientIntensity = baseAmbientIntensity * observerIncidentScale`
  before optional endpoint fill. The default `baseAmbientIntensity` is now
  `1.00`, raised from `0.04` and then `0.20` after the closest-approach Union
  Glacier review still left endpoint boxes subjectively black.
  Record `605` was a transient rejected browser-session closure while testing
  an abandoned source-direction point-fill experiment; records `606` through
  `610` accepted that experiment but it did not materially improve the review
  image. Records `611` through `615` supersede it by rendering the Union
  Glacier GPU rows with the observer-scaled ambient approximation, endpoint
  indirect fill disabled, and endpoint-distance scaling disabled. Record
  `616-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-phase-stack-180-to-000-456x256`
  composites the five accepted rows into a `502 x 1280` stack:
  `tmp/atmosphere/reconciliation/616-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-phase-stack-180-to-000-456x256/images/union-glacier-2021-dec14-gpu-observer-scaled-ambient-phase-stack-180-to-000-456x256.png`.
  Record
  `617-m4-gpu-union-glacier-2021-dec14-000deg-observer-scaled-ambient-r020-456x256`
  rerenders the closest-approach Union Glacier GPU row with the raised
  observer-scaled ambient default, renderer-distance hit/depth capture, no
  antialiasing, source-owned shadows, endpoint indirect fill disabled, and
  endpoint-distance scaling disabled. It accepts with source altitude
  `37.57684752736655 deg`, azimuth `96.73833400000002 deg`,
  `observerIncidentScale = 1.0000228033251901`,
  `baseAmbientIntensity = 0.2`, `ambientIntensity = 0.20000456066503802`, and
  `40580` hit pixels. Primary output:
  `tmp/atmosphere/reconciliation/617-m4-gpu-union-glacier-2021-dec14-000deg-observer-scaled-ambient-r020-456x256/images/canvas-image.png`.
  Record
  `618-m4-gpu-union-glacier-2021-dec14-000deg-observer-scaled-ambient-r100-456x256`
  rerenders the same closest-approach GPU row with
  `baseAmbientIntensity = 1.0`. It accepts with
  `observerIncidentScale = 1.0000228033251901`,
  `ambientIntensity = 1.0000228033251901`, and `40580` hit pixels. The
  pre-shader capture now preserves recognizable endpoint colors for the
  yellow, white, and orange review boxes, though the final shader output
  remains hazy and muted by atmospheric composition. Primary output:
  `tmp/atmosphere/reconciliation/618-m4-gpu-union-glacier-2021-dec14-000deg-observer-scaled-ambient-r100-456x256/images/canvas-image.png`.
  Records `620` through `623` render the matching `180`, `135`, `90`, and
  `45` degree GPU rows with the same `baseAmbientIntensity = 1.0`
  observer-scaled ambient setup, renderer-distance hit/depth capture, no
  antialiasing, source-owned shadows, endpoint indirect fill disabled, and
  endpoint-distance scaling disabled. Record
  `624-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-phase-stack-180-to-000-456x256`
  composites those four rows plus the accepted `0` degree row from record
  `618` into the requested five-row stack. Primary output:
  `tmp/atmosphere/reconciliation/624-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-phase-stack-180-to-000-456x256/images/union-glacier-2021-dec14-gpu-observer-scaled-ambient-r100-phase-stack-180-to-000-456x256.png`.
  Records `625` through `629` rerender the same five GPU phase rows at
  `912 x 512`, preserving the `baseAmbientIntensity = 1.0` observer-scaled
  ambient setup and all other review settings from record `624`. Record
  `630-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-phase-stack-180-to-000-912x512`
  composites those rows into the higher-resolution POC review stack
  (`958 x 2560`, including labels). Primary output:
  `tmp/atmosphere/reconciliation/630-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-phase-stack-180-to-000-912x512/images/union-glacier-2021-dec14-gpu-observer-scaled-ambient-r100-phase-stack-180-to-000-912x512.png`.
  Records `631` through `635` rerender the same five GPU phase rows with the
  observer/camera elevation lowered from `150 m` to `5 m`, keeping the
  `912 x 512` row size, `baseAmbientIntensity = 1.0`, renderer-distance
  hit/depth capture, no antialiasing, source-owned shadows, endpoint indirect
  fill disabled, and endpoint-distance scaling disabled. Record
  `636-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-5m-phase-stack-180-to-000-912x512`
  composites those rows into the low-camera POC review stack (`958 x 2560`,
  including labels). Primary output:
  `tmp/atmosphere/reconciliation/636-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-5m-phase-stack-180-to-000-912x512/images/union-glacier-2021-dec14-gpu-observer-scaled-ambient-r100-5m-phase-stack-180-to-000-912x512.png`.
  The spherical distant-Sun planet scene runner now has an explicit Union
  Glacier clocked sample mode:
  `--sun-sample union-glacier-2021-dec14-solar-noon-offset
  --sun-clock-offset-degrees N`. The `0` degree row is anchored to real local
  solar noon at Union Glacier Camp on `2021-12-14`; positive degree offsets
  advance local solar time by four minutes per degree. This supersedes the
  earlier raw-vector-only spherical comparison attempt, because raw directions
  did not preserve the clock/date contract needed for the flat/local phase-row
  comparison.
  Local Sun synchronization policy note: `real-subsolar-longitude0-noon` is the
  default policy for real-world-correspondence local/flat review scenes unless
  a scene/profile explicitly selects another named policy. Under that policy,
  the finite local Sun latitude is derived from the date's real-world subsolar
  latitude: the latitude where the real Sun is directly overhead at solar noon
  on longitude `0`. The local source clock is synchronized to that
  date-derived longitude-0 noon anchor; closest approach and positive degree
  offsets are then phase/time offsets from that synchronized state. Scene
  location/date remain inputs, while source latitude is derived metadata for
  scenes selecting this policy.
  The spherical review scene preset `planet-sphere-union-review-shadowed`
  adds the same review-box family to the scaled planet-size spherical-ground
  scene: near yellow, mid white, far orange, and the right-offset Denali-scale
  orange box. The browser scene object map now registers those object names,
  and the planet box helper accepts scalar or `[width,height,depth]`
  scene-unit sizes so the Denali-scale box can match the flat/local review
  dimensions.
  Records `637` and `638` are preserved rejected attempts from missing browser
  scene-object registration/name-table wiring. Record `639` accepted a
  raw-direction `0` degree spherical row but is superseded by the clocked
  sample path. Records `641`, `642`, and `643` are rejected concurrent
  submissions through the single watcher command file; they were rerun
  sequentially as accepted records `645`, `646`, and `647`.
  Accepted clock-synced spherical/distant GPU rows are `640` (`0` degree
  solar-noon row), `645` (`45`), `646` (`90`), `647` (`135`), and `644`
  (`180`). They use `planet-sphere-union-review-shadowed`, `912 x 512`, `5 m`
  observer altitude, `45` degree FOV, solid spherical ground, shading and
  shadows enabled, the integrated GPU distant/spherical shader, and the Union
  Glacier `2021-12-14` real-solar-noon clock anchor. Record
  `648-m4-gpu-spherical-distant-union-review-solar-noon-clock-phase-stack-180-to-000-912x512`
  composites the accepted rows into the requested five-row stack. Primary
  output:
  `tmp/atmosphere/reconciliation/648-m4-gpu-spherical-distant-union-review-solar-noon-clock-phase-stack-180-to-000-912x512/images/union-glacier-2021-dec14-gpu-spherical-distant-solar-noon-clock-phase-stack-180-to-000-912x512.png`.
  The distant/spherical endpoint scene lighting no longer applies the POC
  ambient compensation used in record `648`.
  `PLANET_SCENE_AMBIENT_LIGHT_INTENSITY` is now `0`, the distant-Sun scene
  object installs only the directional light and its target, and
  `planetSceneEndpointLightFactor(...)` normalizes against the directional
  light only. This keeps directional shading/shadows while removing the
  ambient wash from distant-Sun spherical review captures.
  Records `649` through `653` rerender the same clock-synced Union Glacier
  spherical/distant GPU rows with no distant ambient compensation. Record
  `654` is a rejected stack attempt caused by an overlong output path failing
  before the `images` output could be written. Record
  `655-m4-gpu-spherical-distant-no-ambient-stack-912x512` uses the accepted
  rows and a shorter output path to write the current five-row stack. Primary
  output:
  `tmp/atmosphere/reconciliation/655-m4-gpu-spherical-distant-no-ambient-stack-912x512/images/union-glacier-spherical-distant-no-ambient-stack-912x512.png`.
  The spherical review scene set now also includes
  `planet-sphere-union-review-unlit`, which uses the same Union Glacier review
  boxes but omits the distant-Sun light object, uses
  `lightingPolicy = unlit-endpoint-color`, and disables shadows. Records `656`
  through `660` rerender the clock-synced spherical/distant GPU rows against
  that unlit endpoint scene. Record
  `661-m4-gpu-spherical-distant-unlit-stack-912x512` composites them into the
  current no-shading/no-shadow comparison stack. Primary output:
  `tmp/atmosphere/reconciliation/661-m4-gpu-spherical-distant-unlit-stack-912x512/images/union-glacier-spherical-distant-unlit-stack-912x512.png`.
  The comparison shows the spherical/distant washout is not only the Three
  ambient/directional endpoint scene lighting; even with MeshBasic/raw endpoint
  colors and no scene shadows, the final shader-composed result remains heavily
  brightened in most rows.
  Record
  `662-m4-gpu-spherical-distant-unlit-endpoint-scale-1-000deg-5m-912x512`
  rerenders the unlit `0` degree row with `endpointRadianceScale = 1` instead
  of the spherical default `5200`. This confirms the reverse-square/backlight
  distance boost is not the active washout source: the shader still compiles
  the generic `endpointCameraDistanceBoostScale(...)` helper, but the runtime
  policy is `none`, making that boost `0` and the endpoint distance multiplier
  `1`. The active whitening factor is the final composition term
  `endpointLinearSrgb * transmittanceRgb * uEndpointRadianceScale`, where
  `uEndpointRadianceScale` was still `5200` for records `648`, `649`-`653`,
  and `656`-`660`. Primary output:
  `tmp/atmosphere/reconciliation/662-m4-gpu-spherical-distant-unlit-endpoint-scale-1-000deg-5m-912x512/images/canvas-image.png`.
  The Union Glacier spherical review presets now include a close single-story
  building reference box named `union-review-close-single-story-building-box`.
  It is currently a blue field-building/module reference approximately
  `14 m x 6 m x 10 m`, centered at scene coordinates `[-0.012, -0.03]` km,
  placing it about `30 m` from the camera and left of center. This replaces
  the earlier long-building interpretation after the visual reference image
  showed a closer blue camp module. It is included in both
  `planet-sphere-union-review-shadowed` and `planet-sphere-union-review-unlit`,
  and the browser scene-object registry now registers that object name. Record
  `663-m4-gpu-spherical-distant-unlit-close-building-scale-1-000deg-5m-912x512`
  renders the earlier `0.5 km` placement. Record
  `664-m4-gpu-spherical-distant-unlit-close-building-10m-scale-1-000deg-5m-912x512`
  is preserved as a rejected visual attempt: moving the same building to about
  `10 m` made it fill/occlude the frame and broke the expected ground/box hit
  criteria. Record
  `665-m4-gpu-spherical-distant-unlit-close-building-100m-scale-1-000deg-5m-912x512`
  renders the intermediate `100 m` placement and accepts. Record
  `666-m4-gpu-spherical-distant-unlit-blue-cabin-30m-scale-1-000deg-5m-912x512`
  renders the right-of-center blue module placement. It is visually useful but
  rejected by the legacy all-diagnostic-box criteria because the close cabin
  occludes the far-right Denali-scale object; the browser job, canvas, ground,
  cabin, near yellow, mid white, and far orange hits all rendered. Record
  `667-m4-gpu-spherical-distant-unlit-blue-cabin-left-30m-scale-1-000deg-5m-912x512`
  shifts the blue module to the left while keeping the same scale and
  distance; it accepts with ground, cabin, near yellow, mid white, far orange,
  and Denali-scale hits all present. Primary current output:
  `tmp/atmosphere/reconciliation/667-m4-gpu-spherical-distant-unlit-blue-cabin-left-30m-scale-1-000deg-5m-912x512/images/canvas-image.png`.
  Record
  `668-m4-gpu-spherical-distant-shadowed-blue-cabin-left-30m-scale-1-000deg-5m-912x512`
  rerenders that same left-shifted cabin scene with distant-Sun endpoint
  directional lighting and raycast shadows enabled; it accepts with the same
  object hit counts as record `667`. Primary shadowed output:
  `tmp/atmosphere/reconciliation/668-m4-gpu-spherical-distant-shadowed-blue-cabin-left-30m-scale-1-000deg-5m-912x512/images/canvas-image.png`.
  Record
  `669-m4-gpu-spherical-distant-shadowed-blue-cabin-left-fill-r025-30m-scale-1-000deg-5m-912x512`
  supersedes `668` for shadowed review after adding a distant-Sun endpoint
  material-fill `AmbientLight` at `25%` of the directional key light. This is
  a pre-shader material color preservation step only: it keeps shadowed
  surfaces from collapsing to black before Algorithm32 composes endpoint color
  after transport. The record accepts with the same object hit counts as `667`
  and `668`. Primary current shadowed output:
  `tmp/atmosphere/reconciliation/669-m4-gpu-spherical-distant-shadowed-blue-cabin-left-fill-r025-30m-scale-1-000deg-5m-912x512/images/canvas-image.png`.
  Records `670` through `674` diagnose why that shadowed review still looked
  flat. The shadow frame was incorrectly derived from every object spec in the
  shared table, including inactive legacy boxes, and the Denali-scale reference
  was also too large/far to share one useful shadow-map frame with the close
  module. The browser scene now sizes the distant-Sun shadow frame from active
  scene objects only, and the Denali-scale reference remains visible and
  raycastable outside the camera-local shadow frame. The endpoint material fill
  is reduced to `10%` of the
  directional key light to preserve color without flattening shading. Record
  `673-m4-gpu-spherical-distant-shadowed-blue-cabin-left-active-shadow-frame-fill-r010-45deg-5m-912x512`
  is the readable side-light control with visible diagonal ground shadowing.
  Record
  `674-m4-gpu-spherical-distant-shadowed-blue-cabin-left-active-shadow-frame-fill-r010-000deg-5m-912x512`
  rerenders the original `0` degree view; because the camera is pointed almost
  toward the Sun, shadows project mostly in screen depth and read as a broad
  foreground band rather than long sideways shadows. Primary current shadowed
  output:
  `tmp/atmosphere/reconciliation/674-m4-gpu-spherical-distant-shadowed-blue-cabin-left-active-shadow-frame-fill-r010-000deg-5m-912x512/images/canvas-image.png`.
  Readable `45` degree shadow-control output:
  `tmp/atmosphere/reconciliation/673-m4-gpu-spherical-distant-shadowed-blue-cabin-left-active-shadow-frame-fill-r010-45deg-5m-912x512/images/canvas-image.png`.
  Follow-up implementation replaces the temporary Denali-specific exclusion
  marker with a per-box `shadowRegion` option. The close cabin, near yellow,
  mid white, and far orange review boxes are assigned `camera-local`; the
  Denali-scale reference is assigned `distant-reference`. The current POC uses
  the `camera-local` region to size the single high-detail review shadow
  frame, while all objects remain visible and raycastable. Record
  `675-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r010-000deg-5m-912x512`
  rerenders the original `0` degree view through that per-box `shadowRegion`
  implementation and accepts with the same visible/raycast hit set. Primary
  current shadow-region output:
  `tmp/atmosphere/reconciliation/675-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r010-000deg-5m-912x512/images/canvas-image.png`.
  Record
  `676-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-000deg-5m-912x512`
  restores the `25%` endpoint material fill from record `671` while keeping
  the per-box `shadowRegion` implementation. Record
  `677-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-45deg-5m-912x512`
  is the apples-to-apples successor to `671`: same `45` degree Sun offset and
  `25%` material fill, but with the new `shadowRegion` box option. Primary
  current color-preserving shadow-region output:
  `tmp/atmosphere/reconciliation/677-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-45deg-5m-912x512/images/canvas-image.png`.
  Records
  `678-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-090deg-5m-912x512`
  and
  `679-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-135deg-5m-912x512`
  rerender the same scene with later Union Glacier solar-noon clock offsets to
  avoid the awkward camera-facing `0` degree Sun placement. Both keep identical
  object hit coverage. The `90` degree row has Sun altitude/azimuth
  `22.890431330327957 / 265.6291059864785`; the `135` degree row has
  `15.87812592663214 / 222.4769102423786`. The current preferred composition
  is the `135` degree row because it keeps endpoint color while making object
  faces and ground shadow direction read more clearly:
  `tmp/atmosphere/reconciliation/679-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-135deg-5m-912x512/images/canvas-image.png`.
  Record
  `680-m4-gpu-spherical-distant-shadowed-blue-cabin-left-mid-distance-cyan-shadow-region-r025-135deg-5m-912x512`
  is preserved as a rejected wiring attempt: the submitter-side scene
  definition included a new Union cyan review box, but the browser-side scene
  object renderer map did not yet register that object name. Record
  `681-m4-gpu-spherical-distant-shadowed-blue-cabin-left-distant-cyan-r025-135deg-5m-912x512`
  accepted after registering the object, but its `60 km` cyan reference sat too
  close behind the white box to read cleanly. Record
  `682-m4-gpu-spherical-distant-shadowed-blue-cabin-left-distant-cyan-right-r025-135deg-5m-912x512`
  is the current preferred spherical/distant Union review image: it adds
  `union-review-distant-cyan-box`, a `6 km x 5 km x 6 km` cyan reference
  centered at `[18, -60]` scene km with `shadowRegion = distant-reference`.
  The accepted render keeps the `135` degree Sun offset and `25%` endpoint
  material fill, reports `3978` hit pixels for the distant cyan box, and
  provides a separate hazy reference behind the nearer yellow/white boxes:
  `tmp/atmosphere/reconciliation/682-m4-gpu-spherical-distant-shadowed-blue-cabin-left-distant-cyan-right-r025-135deg-5m-912x512/images/canvas-image.png`.
  Records `683`, `684`, `685`, and `686` render the matching `180`, `90`,
  `45`, and `0` degree rows for that same scene. Together with record `682`
  for `135` degrees, they preserve the clock-sync contract:
  `--sun-sample union-glacier-2021-dec14-solar-noon-offset`, where the `0`
  degree row is real local solar noon at Union Glacier on `2021-12-14` and the
  positive degree offsets advance the clock by four minutes per degree. Record
  `687-m4-gpu-spherical-distant-union-review-distant-cyan-clock-synced-phase-stack-180-to-000-912x512`
  stacks those five accepted GPU rows in `180, 135, 90, 45, 0` order. Primary
  current full stack:
  `tmp/atmosphere/reconciliation/687-m4-gpu-spherical-distant-union-review-distant-cyan-clock-synced-phase-stack-180-to-000-912x512/images/union-glacier-2021-dec14-gpu-spherical-distant-distant-cyan-clock-synced-stack-180-to-000-912x512.png`.
  Matching `0` degree shadow-region output:
  `tmp/atmosphere/reconciliation/676-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-000deg-5m-912x512/images/canvas-image.png`.
  Earlier right-of-center `30 m` output:
  `tmp/atmosphere/reconciliation/666-m4-gpu-spherical-distant-unlit-blue-cabin-30m-scale-1-000deg-5m-912x512/images/canvas-image.png`.
  Earlier `100 m` output:
  `tmp/atmosphere/reconciliation/665-m4-gpu-spherical-distant-unlit-close-building-100m-scale-1-000deg-5m-912x512/images/canvas-image.png`.
  Earlier `0.5 km` output:
  `tmp/atmosphere/reconciliation/663-m4-gpu-spherical-distant-unlit-close-building-scale-1-000deg-5m-912x512/images/canvas-image.png`.
