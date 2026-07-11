# Milestone 5 Boundary Radiance Design

This design document is not a historical log. It records the current starting
point for the Milestone 5 external-boundary-radiance experiment.

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

Introduce an `ExternalBoundaryRadiance` role. It answers:

```text
what visible radiance arrives from beyond the atmosphere along this camera ray?
```

It should provide `celestialRadiance` plus enough diagnostic data to explain
selected pixels. The atmosphere/transport path still owns `pathRadiance` and
`viewTransmittance`.

## Source-Owned Visible Bodies

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

Visible stars, Moon, planets, and Sun disks should use the same composition
point. They may differ in ownership and calibration:

- Sun disk: companion provider from the light source.
- Stars: catalog or synthetic provider with point/footprint policy.
- Moon and planets: later body providers with their own radiance and angular
  footprint policy.

None of these visible bodies should be folded into the incident-radiance/L2
cache for this proof. Optional sky illumination from Moon or starfield
radiance remains a later source/cache design.

## Boundary Rules

- `pathRadiance` is atmosphere radiance integrated along the camera path.
- `viewTransmittance` attenuates radiance from the body to the camera.
- `celestialRadiance` is supplied by an external boundary-radiance provider.
- Captured scene RGB is not the physical visibility model for celestial bodies.
- Decorative or fallback backgrounds are not physical boundary radiance unless
  a provider explicitly turns them into radiance.

## Initial Success Criteria

- Dim synthetic stars disappear in the brightest daytime atmosphere.
- The same stars can be visible when path radiance and transmittance permit it.
- A bright disk can remain visible through the same composition path when its
  radiance and footprint justify it.
- The Sun disk proof uses source-owned facts rather than duplicated source
  data.
- The first accepted behavior is recorded under
  `tmp/atmosphere/reconciliation/NNN-*`.
