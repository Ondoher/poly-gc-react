# Shader Test Design

Status: first-pass test design for Milestone 3 shader validation.

This document defines what the shader validation scenes need to prove and how
to build scenes that prove it. The shader exists to modify rendered pixels.
Spectral diagnostics explain the pixel result, but they are not a substitute
for proving the expected values reach the final pixels.

## Table Of Contents

- [Purpose](#purpose)
- [Primary Contract](#primary-contract)
- [Test Layers](#test-layers)
- [Scene Construction Rules](#scene-construction-rules)
- [Data Sources And Fixture Provenance](#data-sources-and-fixture-provenance)
- [Extent Coverage Matrix](#extent-coverage-matrix)
- [Objective Test Inventory](#objective-test-inventory)
- [Objective Scene Families](#objective-scene-families)
- [Canonical Spectral Fixture Scenes](#canonical-spectral-fixture-scenes)
- [Subjective Review Scenes](#subjective-review-scenes)
- [Diagnostics And Packets](#diagnostics-and-packets)
- [Acceptance Rules](#acceptance-rules)
- [Open Design Work](#open-design-work)

## Purpose

The shader validation suite must prove that a scene input pixel is transformed
into the correct output pixel for the active Algorithm32 configuration.

The central question is:

```text
scene input pixel + depth/hit facts + endpoint/source/cache facts
  -> installed shader
  -> modified output pixel
```

The CPU postprocess soft-shader and GPU shader run against the same objective
scene set. The objective scene claim is the primary gate for both
implementations: each must produce the expected rendered pixels or controlled
regions for the configured facts. Soft-shader-vs-GPU comparison is a secondary
consistency check, useful for classifying mismatches and proving the GPU path
follows the same public `evaluate(...)` and validated color-adapter contract.

## Primary Contract

The primary shader contract is deterministic pixel transformation.

For every objective scene, the expected output is not merely an accepted
spectral packet. The expected output is a rendered pixel or controlled pixel
region. Selected-pixel spectral diagnostics must support the pixel result by
showing how the value was produced:

```text
geometry/depth/hit facts
  -> evaluate(...) baseline
  -> L_path and T_view
  -> endpointRadiance when present
  -> final spectral radiance
  -> validated color adapter
  -> expected RGB/RGBA
  -> observed CPU/GPU output pixels
```

If spectral diagnostics look correct but rendered pixels are wrong, the test
fails as a shader/display/composition problem. The diagnostic packet explains
the failure; it does not make the test pass.

## Test Layers

Use layered tests so failures can be classified without weakening the pixel
requirement.

1. Descriptor/setup layer.
   - Proves the scene descriptor, source, geometry, atmosphere, cache, color
     adapter, and shader descriptors are compatible.
   - Rejects unsupported scene facts before rendering.

2. Scene-input layer.
   - Proves camera rays, depth or hit distance, endpoint fixture ids, and
     selected pixels are deterministic.
   - Proves spatial hit facts are the only scene-hit facts passed through
     `evaluate(...)`.

3. CPU baseline layer.
   - Runs the CPU postprocess soft-shader through public `evaluate(...)`.
   - Produces expected final spectral radiance and expected display pixels.

4. GPU shader layer.
   - Runs the installed shader against the same scene input.
   - Produces shader diagnostics and rendered pixels.

5. Pixel comparison layer.
   - Compares expected CPU output pixels to observed GPU output pixels.
   - For fixture scenes, also compares fixture-derived expected display pixels
     to CPU and GPU output pixels.

## Scene Construction Rules

Objective scenes should be small, deterministic, and purpose-built. They
should avoid complex terrain or artistic materials unless the tested claim is
specifically about scene integration.

Scene-set size should be driven by themed composites. Group tests that share a
common claim family into one scene when that lets a single long CPU
soft-shader run prove multiple facts without making the rendered artifact hard
to read. Do not make the first set a broad matrix for its own sake; split a
scene when the visual output, selected pixels, or diagnostic regions become too
cluttered to understand.

Each objective scene descriptor should include:

- stable scene id;
- tested claim;
- expected failure classification;
- source, geometry, atmosphere, cache, and display descriptor ids;
- camera pose, projection, viewport size, and selected pixels;
- scene-object geometry or analytic hit fixture;
- depth/hit-distance policy;
- endpoint contribution policy;
- expected diagnostic bands;
- expected pixel or controlled-region outputs;
- comparison intent and readback format.

Objective scenes should prefer analytic or fixture geometry: flat cards,
full-screen quads, simple depth planes, known sky/no-hit pixels, and controlled
near/far endpoint distances. Subjective assets are useful later, but they are
too noisy to prove exact routing or fixture propagation.

The descriptor may declare owner/routing metadata during setup validation.
Runtime `evaluate(...)` requests must receive only typed spatial/domain data,
not caller-visible owner labels, RGB/display color, material ids, spectral
fixture ids, or endpoint contribution packets.

Scene input source policy:

- The shader test design decides the source of scene inputs.
- Objective scenes should start with authored deterministic descriptors or
  serialized JSON fixtures when that gives the cleanest expected pixels.
- Three captures should be introduced when the scene family specifically needs
  renderer-derived color/depth/camera facts or when validating the
  `ThreeGateway` path.
- The CPU soft-shader should support whichever input source a required test
  scene uses before GPU shader work depends on that scene.
- Do not implement both JSON fixtures and Three captures merely for symmetry;
  support both when the required scene set needs both.

## Data Sources And Fixture Provenance

Every objective test must name a data source, accepted fixture record, or
explicitly classified model-policy source before it becomes a gate. Prefer
dataset rows, accepted fixture rows, and recorded baseline constants over new
calculations. Calculated expectations are allowed only when the calculation is
itself source-backed and the record names the inputs, equation, units, and
rounding policy.

Current source trail:

| Source id | Data/reference | Use | Current local trail |
| --- | --- | --- | --- |
| `step032-display-basis` | Accepted Algorithm32 15-channel basis, Step 032 display constants, and Bruneton-based color adapter. | Active display conversion, RGB/RGBA expectations, spectral channel shape. | `scripts/flat/reconciliation/POC/src/constants/consts.js`, `scripts/flat/reconciliation/POC/src/color/BrunetonColorDisplayModel.js`, `scripts/flat/reconciliation/POC/src/outputs/Figure1SkyDomeRenderer.js`, `agents/topics/apps/flat/algorithm32/conclusions.md`. |
| `cie-1931-2deg` | CIE 1931 2-degree color matching functions, DOI `10.25039/CIE.DS.xvudnb9b`, `360-830 nm`, `1 nm`, `471` rows. | Display adapter provenance, CIE grid alignment, wavelength extent tests. | `agents/topics/apps/flat/algorithm32/fixture-sources.md`, `agents/topics/apps/flat/algorithm32/conclusions.md`. |
| `astm-g173` | ASTM G-173 solar spectrum table, `ASTMG173.csv`, `280-4000 nm`, `2002` rows. | Solar table ingestion and source-spectrum sanity; not generic clear-sky output unless full assumptions match. | `agents/topics/apps/flat/algorithm32/fixture-sources.md`, `agents/topics/apps/flat/algorithm32/conclusions.md`. |
| `us-standard-atmosphere-1976` | U.S. Standard Atmosphere / PDAS profile rows, including sea level and high-altitude checkpoints such as `80 km` and `85 km`; NASA NTRS `19770009539`. | Atmosphere/profile altitude extent, high-altitude boundary and density sanity. | `agents/topics/apps/flat/algorithm32/fixture-sources.md`. |
| `bucholtz-rayleigh-1995` | Bucholtz standard-air Rayleigh coefficient rows at `200`, `450`, `550`, `650`, `800`, and `1000 nm`, DOI `10.1364/AO.34.002765`. | Named Rayleigh coefficient-policy fixtures and spectral coefficient sanity. | `agents/topics/apps/flat/algorithm32/fixture-sources.md`, `scripts/flat/atmosphere_rejected/data/composition/rayleigh/bucholtz-1995-standard-air.json`. |
| `controlled-ray-path-fixtures` | Fixture-owned ray-path segment cases: empty path, zero length, crossing observer, behind observer, inverted/non-finite intervals, missing intersections, surface-before-entry occlusion, finite-vs-unbounded paths. | Geometry ray termination, no-hit, invalid-depth, and finite-endpoint tests. | `agents/topics/apps/flat/algorithm32/fixture-sources.md`, `agents/topics/apps/flat/algorithm32/evidence/reference-fixtures/analytic-invariants.json`. |
| `shader-lab-endpoint-spectra-seed` | Historical shader-lab `objectRadianceAtWavelength(...)` red/green/blue/ground curves. | Seed provenance for canonical endpoint spectral fixtures only after values are copied into reconciliation-owned fixture data. | `scripts/flat/algorithm32-shader-lab/page/shader-lab.js`. |

The historical shader-lab endpoint spectra are not a live dependency and are
not canonical by path. They are a mined source. The reconciliation POC must
materialize any accepted endpoint fixture values in its own fixture module or
data artifact with provenance.

## Extent Coverage Matrix

The first objective suite must explicitly cover the extents most likely to
hide shader mistakes:

| Extent | Required coverage | Data/provenance |
| --- | --- | --- |
| Spectral basis | First and last active channels, channel count, channel spacing, red/green/blue/neutral/ground-like fixtures, and CIE interpolation endpoints. | `step032-display-basis`, `cie-1931-2deg`, `shader-lab-endpoint-spectra-seed` after materialization. |
| Solar/source table | Solar source values on the active 15-channel basis and rejection of mismatched basis shapes. | `step032-display-basis`, `astm-g173`. |
| Atmosphere altitude/profile | Sea-level row, high-altitude rows near the top of the active profile, and atmosphere-exit/no-hit classification. | `us-standard-atmosphere-1976`, accepted M1/M2 records. |
| View-ray distance | Zero/empty path, near endpoint, middle endpoint, far endpoint, no-hit atmosphere exit, surface-before-atmosphere-exit, invalid/non-finite/out-of-range depth. | `controlled-ray-path-fixtures`. |
| Cache participation | Cache disabled, cache enabled with expected nonzero contribution, expected small/zero contribution, cache boundary/miss log-and-continue behavior, descriptor/access mismatch failure. | M1 distant cache records, current incident-radiance cache descriptors, and cache-owned fixtures when materialized. |
| Display/readback | Black, white, saturated/channel-biased values, tone/display adapter propagation, PNG retention, and browser readback tolerance. | `step032-display-basis`, `cie-1931-2deg`, accepted Step 032 artifacts. |

Do not use arbitrary large finite distances as extent coverage. Large-distance
rows need either a model-owned boundary, a sourced fixture row, or an explicit
hypothesis label that prevents them from becoming silent truth.

## Objective Test Inventory

The first objective inventory should be implemented as stable scene/test ids
in `scenes/shader-scene-inventory.json` and backed by reconciliation-owned
scene modules or fixture artifacts. Each test must name selected pixels or
controlled regions and must assert rendered screen pixels, not only internal
packets.

| Test id | Scene claim | Data/provenance | Extent covered | Required screen-pixel assertion |
| --- | --- | --- | --- | --- |
| `obj-001-zero-atmosphere-passthrough` | With zero atmosphere contribution, fixture/input pixels pass through the selected display policy without hidden shader modification. | `step032-display-basis`; zero-density profile as explicit test policy. | Display/readback, no-atmosphere baseline. | Selected color-bar pixels equal expected passthrough RGBA within test-owned tolerance; diagnostics report no path radiance and unit or absent atmospheric modification. |
| `obj-002-display-adapter-cie-propagation` | Fixture spectra reach output pixels through the validated Bruneton-based color adapter. | `step032-display-basis`, `cie-1931-2deg`. | Spectral basis, display/readback. | Selected fixture pixels equal adapter-produced expected RGB/RGBA; no alternate color conversion is used. |
| `obj-003-sky-no-hit-atmosphere-exit` | No-hit sky rays compose as `final = L_path` with no endpoint radiance. | Accepted M1 distant/spherical records, `controlled-ray-path-fixtures`. | Atmosphere exit, no-hit view ray. | Selected sky pixels in CPU and GPU each match expected display pixels for the configured ray; diagnostics classify no endpoint and geometry-owned atmosphere exit. |
| `obj-004-finite-endpoint-near-mid-far` | Opaque endpoints cap the view ray and compose as `endpointRadiance * T_view + L_path`. | `controlled-ray-path-fixtures`, materialized canonical endpoint fixture table. | Near/mid/far endpoint distance. | Same fixture at near/mid/far selected pixels follows expected rendered-pixel trend and exact fixture-derived expected values for each distance. |
| `obj-005-invalid-depth-log-continue` | Invalid depth is logged, classified, and omitted without aborting the render. | `controlled-ray-path-fixtures`. | Invalid/non-finite/out-of-range depth. | Invalid selected pixels are marked invalid and use the configured fallback/omission policy; neighboring valid pixels still match their expected output. |
| `obj-006-routing-same-distance-different-fixture` | Endpoint fixture identity does not alter geometry-resolved ray length. | `controlled-ray-path-fixtures`, canonical endpoint fixture table. | Scene-intersection routing. | Cards at the same distance have identical hit distance/`T_view` diagnostics but different fixture-derived final pixels. |
| `obj-007-routing-same-fixture-different-distance` | Hit distance changes transport for the same endpoint fixture. | `controlled-ray-path-fixtures`, canonical endpoint fixture table. | Scene-intersection routing, distance. | Same fixture at different distances produces expected pixel deltas from path radiance and transmittance changes. |
| `obj-008-spectral-fixture-wavelength-bands` | Red/green/blue/ground-like endpoint spectra remain distinguishable after transport and display. | Materialized endpoint table, `shader-lab-endpoint-spectra-seed`, `cie-1931-2deg`. | Spectral colors and display conversion. | Selected card pixels match fixture-derived display RGB/RGBA and remain separable within the declared tolerance. |
| `obj-009-spectral-basis-extent` | The active basis shape is enforced and endpoints at the first/last channels are preserved. | `step032-display-basis`, `cie-1931-2deg`, `astm-g173`. | Spectral first/last channels, channel count. | First/last-channel-biased fixture pixels match expected display behavior; mismatched basis descriptors fail setup. |
| `obj-010-cache-off-on-nonzero` | Cache-enabled output changes only through accepted incident-radiance contribution. | M1 cache records, cache-owned descriptors/fixtures. | Cache nonzero contribution. | Cache-on selected pixels match expected cache-on display output; cache-off/control deltas match expected diagnostic bands. |
| `obj-011-cache-boundary-miss-log-continue` | Unexpected cache boundary/miss conditions log and continue without silent invalid data. | Cache-owned descriptors/fixtures. | Cache boundary/miss. | Affected selected pixels are classified by the configured miss policy; valid control pixels still match expected output. |
| `obj-012-horizon-long-path` | Long shallow view rays preserve finite diagnostics and expected horizon behavior. | Accepted M1 records plus sourced/model-owned ray-path boundary rows. | Long distance/horizon. | Controlled horizon region and selected pixels match expected display trend and do not show non-finite or clipped artifact classifications. |
| `obj-013-high-altitude-atmosphere-boundary` | High-altitude rays use sourced profile rows and correct atmosphere boundary classification. | `us-standard-atmosphere-1976`, accepted M1/M2 records. | High altitude/profile edge. | Selected high-altitude sky pixels match expected display values for the configured profile and classify top-boundary/exit consistently. |
| `obj-014-readback-png-artifact` | Browser and runner retain comparable PNG artifacts while comparison can use in-memory buffers. | Runner protocol and accepted browser job convention. | Display/readback artifact policy. | Each retained objective render writes PNG artifacts, progress logs, and comparison metadata; PNG pixels decode to the same compared values within encoding policy. |

## Objective Scene Families

Start with these scene families before broad subjective galleries.

### Passthrough And Zero-Atmosphere

Claim: with no atmosphere contribution, the shader does not modify pixels
except for explicitly selected display policy.

Scene shape:

- simple color bars or fixture quads;
- depth disabled or fixed no-hit;
- atmosphere disabled or zero-density test profile;
- selected pixels across distinct input colors.

Acceptance:

- rendered output equals expected passthrough pixels within readback tolerance;
- diagnostics classify no atmosphere contribution;
- no hidden tone/display change is introduced by the shader.

### Sky / Atmosphere Exit

Claim: no-hit rays use the same composition equation with absent endpoint
radiance.

Scene shape:

- selected sky pixels with no finite scene hit;
- distant/spherical setup first;
- later local/flat finite-dome setup.

Acceptance:

- CPU and GPU pixels each satisfy the expected display-pixel claim for the
  selected sky rays; CPU-vs-GPU matching is secondary consistency evidence;
- selected diagnostics show `endpointRadiance = 0` or absent,
  `final = L_path`, and correct atmosphere-exit classification;
- absence of a scene-object termination preserves the geometry model's normal
  atmosphere, ground, and domain-boundary ray resolution.

### Finite Endpoint Distance

Claim: finite scene hits cap the geometry-resolved view ray and modify pixels
through `endpointRadiance * T_view + L_path`.

Scene shape:

- flat opaque card at known distances;
- same endpoint fixture repeated at near, middle, and far distances;
- matching sky control pixels.

Acceptance:

- hit pixels differ from sky controls in the expected direction;
- near/far monotonicity follows the expected transmittance/path-radiance trend;
- diagnostics show hit distance enters geometry, while endpoint fixture facts
  stay outside `evaluate(...)`;
- no-hit control pixels use geometry's normal atmosphere/domain ray bounds,
  proving scene-object termination is optional;
- final object pixels show the endpoint fixture radiance attenuated by the
  geometry-resolved viewer-to-object path, not by an atmosphere-exit or far
  policy path.

### Scene-Intersection Routing

Claim: scene intersections are spatial inputs to geometry, not color inputs to
transport.

Scene shape:

- two cards with identical distance and different endpoint fixture ids;
- two cards with different distance and identical endpoint fixture ids;
- invalid/out-of-range depth sample.

Acceptance:

- changing fixture id does not alter geometry-resolved ray length;
- changing hit distance alters ray length, transmittance, path radiance, and
  final object color for the same endpoint fixture;
- invalid depth is logged, the affected pixels are classified as `invalid`,
  their scene-hit contribution is omitted, the run continues, and the invalid
  depth is never silently promoted to a far hit.

### Cache Participation

Claim: cache-enabled shader output changes only through the accepted incident
radiance contribution for the active cache descriptor.

Scene shape:

- cache-off and cache-on variants for the same camera/source/geometry;
- selected pixels where cache contribution is expected to be nonzero;
- selected control pixels where contribution is expected to be zero or small.

Acceptance:

- CPU and GPU cache-on pixels each satisfy the expected cache-on display-pixel
  or controlled-region claim; CPU-vs-GPU matching is secondary consistency
  evidence;
- cache-off to cache-on deltas match expected diagnostic bands;
- cache descriptor, texture id, access assembly, and sampler policy are
  recorded.

## Canonical Spectral Fixture Scenes

Canonical spectral fixtures are the primary objective mechanism for proving
wavelength-specific endpoint values reach rendered pixels.

Fixture table requirements:

- one canonical fixture module in the reconciliation POC;
- ambient fixture types in an owning `types.d.ts`;
- fixture ids used as `spectralReferenceId`;
- explicit values over `CANONICAL_SPECTRAL_CHANNELS`;
- provenance for any fixture derived from historical shader-lab curves;
- no renderer material-id lookup as the objective source of truth.

Initial fixture rows:

- zero/black;
- neutral low, medium, and high;
- red-biased;
- green-peaked;
- blue-biased;
- broad warm or ground-like.

Scene shape:

- deterministic opaque cards or regions, one fixture per region;
- selected pixels centered inside each region;
- at least one sky/no-hit control;
- near and far variants for a subset of fixtures;
- no texture filtering, lighting, shadow, alpha, or material behavior that can
  obscure the fixture value.

Required propagation check:

```text
fixture spectrum
  -> endpointRadiance
  -> endpointRadiance * T_view + L_path
  -> expected display RGB/RGBA from validated color adapter
  -> CPU soft-shader output pixel
  -> GPU shader output pixel
```

Acceptance:

- fixture lookup values match the canonical fixture table exactly;
- pre-display composed spectrum matches expected per channel;
- expected display RGB/RGBA is produced through the validated Bruneton-based
  color adapter, not a reimplemented conversion;
- CPU rendered pixels match expected display pixels;
- GPU rendered pixels match expected display pixels within recorded tolerance;
- CPU-vs-GPU rendered-pixel comparison is recorded as secondary consistency
  evidence;
- saturated fixtures remain separable after atmosphere where the scene claims
  separability.

## Subjective Review Scenes

Subjective scenes are for plausibility and regression review. They are not the
source of objective correctness.

Use them after objective scenes cover the relevant facts. Borrow scene lineage
from shader-lab and local-second-order only as scene-input/composition
reference material. Do not use historical shader outputs as authority when the
reconciliation CPU baseline exists.

The Southern France mesh lineage is useful only for no-shadow plausibility
review. The mesh already carries baked shadow/detail and is not constructed
well enough for shadow validation, so do not use its shadow-enabled variants as
objective or subjective shadow evidence.

Subjective scene records should say what they are meant to reveal, such as:

- horizon color plausibility;
- terrain color contribution visibility;
- local-vs-distant source differences;
- sunrise-to-sunset progression;
- star visibility or dimming;
- flat/local polar edge cases.

## Diagnostics And Packets

Objective records should include enough diagnostics to explain each pixel
comparison:

- scene descriptor and descriptor fingerprints;
- selected pixel ids and coordinates;
- input scene RGB/depth/hit data;
- ray origin and direction;
- geometry hit/exit classification;
- source descriptor and source direction/position facts;
- cache descriptor, texture descriptor, and cache access facts when active;
- `spectralReferenceId` and fixture spectral values when active;
- `endpointRadiance`;
- `L_path`;
- `T_view`;
- final spectral radiance before display;
- expected RGB/RGBA from the validated color adapter;
- CPU soft-shader RGB/RGBA;
- GPU shader RGB/RGBA;
- per-channel deltas and selected-pixel or controlled-region deltas;
- readback format, encoding, and tolerance;
- failure classification.

Diagnostics must stay bounded. They should not carry one full diagnostic
packet per rendered pixel. The default diagnostic shape is:

- selected-pixel packets for pixels named by the scene descriptor;
- aggregate counters and summary metrics for the whole scene;
- controlled-region summaries when a scene is explicitly designed around a
  region instead of individual pixels.

When tracking a specific problem, a diagnostic mode may request extra samples,
extra controlled regions, or targeted GPU readback buffers. That mode must
name the problem being investigated, bound the amount of data emitted, and
record why the default selected-pixel diagnostics were insufficient.

## Acceptance Rules

An objective shader scene passes only when the pixel claim passes.

Numeric tolerances are owned by this test design, not by individual scene
descriptors. Scene descriptors may declare selected pixels, controlled
regions, expected fixture facts, and comparison intent, but the allowed error
thresholds live here so CPU display output, browser readback, and image metrics
use one policy. Tolerances should be justified from human vision limitations:
differences below the configured threshold should be below meaningful visual
detectability for the tested display space, while differences above it should
remain actionable rendering errors.
The first-pass browser/GPU tolerance for secondary CPU-vs-GPU comparison
should start from that visual-perception threshold; browser, GPU, packing, and
readback behavior may explain a mismatch classification, but they should not
define an arbitrary acceptance band by themselves.
Image-level acceptance uses whichever metric the scene's objective claim needs:
selected-pixel deltas for targeted facts, controlled-region deltas for local
patterns, whole-image metrics for full-frame claims, or a combination. Max
absolute error, RMSE, percentile thresholds, and selected-pixel parity are
tools selected by the test design, not universal gates.
Exact match is reserved for CPU-only artifacts, deterministic descriptor
snapshots, and other non-browser/reference outputs. Browser/GPU rendered
artifacts should not use a default exact pixel-match gate; they pass by
satisfying the objective scene's human-visual-perception-grounded tolerance. A
later GPU test may declare an exact gate only after proving the relevant
browser, renderer, render target, packing, readback, and encoding path is
deterministic enough for that claim.

Minimum pass requirements:

- setup descriptors are accepted and recorded;
- CPU soft-shader uses public `evaluate(...)` and the validated color adapter;
- GPU shader compiles and runs with recorded capabilities;
- both CPU soft-shader and GPU shader satisfy the scene's objective expected
  pixel or controlled-region claims;
- selected diagnostics are finite and internally consistent;
- expected fixture values, when present, are visible in final pixel
  comparisons;
- CPU and GPU rendered pixels match within the scene tolerance as a secondary
  consistency check;
- any mismatch is classified without changing the expected result after the
  fact.

Non-passing classifications:

- setup rejected;
- unsupported scene fact;
- CPU baseline invalid;
- GPU capability unsupported;
- shader compile/link failure;
- descriptor mismatch;
- spectral diagnostic mismatch;
- display/color adapter mismatch;
- rendered-pixel mismatch;
- inconclusive due to missing readback or missing selected diagnostics.

## Open Design Work

- Materialize the objective test inventory rows in
  `scenes/shader-scene-inventory.json` and the owning scene modules/fixtures.
- Define the exact canonical fixture table values and provenance, including
  whether any red/green/blue/ground-like rows are accepted from mined
  shader-lab endpoint spectra.
- Attach data-source ids from this document to every objective scene and
  selected-pixel expectation.
- Define first selected-pixel tolerances for CPU display output and GPU
  browser readback in this document, justified against human vision
  limitations.
- Decide whether controlled-region image metrics are required in addition to
  selected pixels for fixture scenes.
- Define the first GPU output packet shape needed for pixel comparison.
