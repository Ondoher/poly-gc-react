# Atmosflat32 Flat App Rotation Skydomes

Status: accepted (13 passed, 0 failed, 0 unresolved, 0 not-applicable).

This POC artifact generates first-order Algorithm32 flat/local observer angular
sky PNGs for the same app-config flat local Sun placement at offsets from
closest San Jose approach: 0, 45, 90, 135, 180 degrees.

The app is used only as the configuration source. Projection, closest approach,
rotation offsets, local point-source direction, configured source distance,
renderer-owned sky-view ray length, apparent size, and sky marker placement
are computed independently in atmosflat32.

Brightness calibration:

- target: match-distant-solar-noon-unit-incident-scale-at-closest-approach
- distant comparison scene: figure1-13h15-z21
- closest configured distance: 5050.674164842701 km
- closest falloff scale: 0.9031996723576281
- original app solarIrradianceScale: 58
- original closest incident scale: 52.38558099674243
- calibrated transport solarIrradianceScale: 1.1071748923354825
- calibrated closest incident scale: 1
- calibration multiplier: 0.01908922228164625

The generated PNGs are pure observer sky views. Diagnostic source marker
coordinates are recorded in JSON metadata but are not painted into the images.

The image loop is the same fisheye skydome method used by the round-geometry
distant-Sun domes. The atmosphere geometry is different: observer position is
0, 0, 2 meters in a
flat z-up atmosphere, density altitude remains flat z, and the skydome renderer
limits observer view rays with a round-equivalent artificial cap centered at
0, 0, -6360000 meters with
radius 6420000 meters. Its
observer-level footprint radius is
875656.6450361694 meters
(875.6566450361695 km), matching the round
Algorithm32 horizon distance for the same bottom and top radii. Source-path
transmittance is not capped by this renderer limit; it uses the configured flat
top atmosphere plane and the finite source distance.

The source object treats each finite source-to-sample distance as model data.
For this calibrated false Sun, source incident scale follows the configured
`point-inverse-square-reference` falloff rule:
`incidentScale = intensity * solarIrradianceScale * (referenceDistanceKm / distanceKm)^2`.
Here `solarIrradianceScale` is the calibrated transport value above, not the
raw app display/light scale.
The PNGs are rendered from first-order Algorithm32 flat/local scattering using
that source-sample incident scale. Display tone mapping is applied only after
transport. The display profile is full-spectral-cie,
bruneton-2016-clear-sky, ozoneAbsorption=false,
toneMap=bruneton-comparison-source-k, toneMapK=0.00029282576866764275. Local-
source second-order scattering/cache behavior is explicitly deferred.

Generated angular sky views:

- flat-app-skydome-000deg-closest.png: offset 0 deg
- flat-app-skydome-045deg-from-closest.png: offset 45 deg
- flat-app-skydome-090deg-from-closest.png: offset 90 deg
- flat-app-skydome-135deg-from-closest.png: offset 135 deg
- flat-app-skydome-180deg-from-closest.png: offset 180 deg

Source diagnostics:

- 000deg-closest: configuredDistanceKm=5050.674164842701, altitudeDeg=72.9232574407232, azimuthDeg=-121.88630000000008, distanceFalloffScale=0.9031996723576283, incidentScaleAtObserver=1.0000000000000002, relativeIncidentScaleToClosest=1.0000000000000002, displayToneMapK=0.00029282576866764275
- 045deg-from-closest: configuredDistanceKm=7119.212438383862, altitudeDeg=42.70042449580308, azimuthDeg=-24.569016394925313, distanceFalloffScale=0.4545886305746889, incidentScaleAtObserver=0.5033091181134656, relativeIncidentScaleToClosest=0.5033091181134656, displayToneMapK=0.00029282576866764275
- 090deg-from-closest: configuredDistanceKm=10557.381263312685, altitudeDeg=27.213696005808067, azimuthDeg=6.700278683890498, distanceFalloffScale=0.2067140821095606, incidentScaleAtObserver=0.22886864160388085, relativeIncidentScaleToClosest=0.22886864160388085, displayToneMapK=0.00029282576866764275
- 135deg-from-closest: configuredDistanceKm=13123.772801106092, altitudeDeg=21.58506204803698, azimuthDeg=32.9479481941797, distanceFalloffScale=0.1337719531935246, incidentScaleAtObserver=0.1481089478745478, relativeIncidentScaleToClosest=0.1481089478745478, displayToneMapK=0.00029282576866764275
- 180deg-from-closest: configuredDistanceKm=14050.17041741779, altitudeDeg=20.097934087510392, azimuthDeg=58.1137, distanceFalloffScale=0.11671301573969893, incidentScaleAtObserver=0.12922172063575063, relativeIncidentScaleToClosest=0.12922172063575063, displayToneMapK=0.00029282576866764275

Criteria:

- uses-app-config-only-for-source-definition: pass
- requested-rotation-offsets-present: pass
- all-skydome-images-generated: pass
- all-source-samples-match-configured-finite-source: pass
- all-diagnostic-suns-above-san-jose-horizon: pass
- closest-and-180-distance-ordering: pass
- source-sample-uses-configured-distance-falloff: pass
- closest-approach-brightness-calibrated-to-distant-sun: pass
- configured-distance-incident-scale-ordering: pass
- sky-views-render-through-shared-angular-image-loop: pass
- flat-sky-view-uses-round-equivalent-artificial-cap: pass
- sky-view-ray-length-limit-is-renderer-scoped: pass
- local-second-order-cache-explicitly-deferred: pass

Notes:

- These are first-order flat/local source scattering artifacts. They are
  not second-order local-source cache validation.
- No unit tests were added for this POC lane.
