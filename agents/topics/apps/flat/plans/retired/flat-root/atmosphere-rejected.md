# Atmosphere Rejected Ideas

This note records atmosphere ideas that were explicitly rejected so they do not
keep resurfacing during tuning. It is intentionally separate from
[Atmosphere Design](atmosphere-design.md), which should describe only current
state.

## Separate Atmosphere Sun

Rejected: using a separate directional atmosphere sun while the rendered false
sun remains a local point source.

Reason: it can make the sky bluer, but it lets atmospheric lighting drift away
from the visible simulation evidence. The active contract links the rendered
sun body, solid-scene light, and atmosphere-scattering source to the same
resolved `scene.sun` identity.

## Star-Specific Atmosphere Branches

Rejected: adding star-specific visibility exceptions, background preservation
branches, or custom atmosphere shader rules for constellation lines.

Reason: the generic composition rule should decide whether objects are visible
through the atmosphere. Stars and guide overlays may have renderer/material
exposure controls before composition, but the atmosphere shader should not know
that an object is a star or annotation.

## Painted Daylight Or Final Sky Brightening

Rejected: solving the dark daytime sky with a painted blue fallback,
emergency background color, final-display `skyExposure`, or separate
`solidScatteringSourceGain`/`skyScatteringSourceGain` hacks.

Reason: daylight sky color should come from source radiance, Rayleigh/Mie
scattering, transmittance, and explicit renderer/display calibration. Final
display exposure may exist later, but it should not masquerade as atmosphere
physics.

## Tuning Flat Geometry To Look Real

Rejected: calibrating the flat atmosphere until the false geometry visually
matches the real sky.

Reason: that hides the consequences of the false geometry. The atmosphere
should be calibrated against the spherical/correct-geometry model first, then
the flat model should reuse the same named physical inputs and show its own
implications.

## Renderer Bridges As Atmosphere Facts

Rejected: treating `threeLightUnitScale`, `skyDiffuseIrradianceScale`,
`backgroundAtmosphereViewDistanceKm`, `flatSlabHorizonViewDistanceFactor`,
`starExposure`, or `constellationOverlayExposure` as physical atmosphere
properties.

Reason: these are renderer bridges, geometry abstractions, material controls,
or guide-overlay controls. They may remain in the scene settings, but their
names and documentation must keep them separate from atmosphere profile
physics.

## Reviving Linear Haze As The Main Atmosphere

Rejected: returning to the old linear haze / `AltitudeHaze` style shell as the
primary atmosphere renderer.

Reason: the current contract is depth-aware composition with optical depth,
transmittance, and sun-driven single scattering. A diagnostic fallback may be
useful during debugging, but the design target is not distance opacity or
painted haze.
