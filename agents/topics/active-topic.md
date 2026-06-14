# Active Topic

Current active topic: `flat`

Current focus: Flat application globe atmosphere calibration for the false-sky
/ sky-comparison project.

Current subtopic: Physical atmosphere reset for globe calibration and the
flat-world/local-Sun comparison. Treat the current globe atmosphere
implementation as mineable context, but use the research note as the baseline
for a physical-constants-first model with a CPU spectral reference integrator,
explicit CIE/display conversion, documented environmental inputs, and swappable
world-geometry/solar-source properties before shader tuning.

Additional reload sources:

- [Flat App](apps/flat/README.md)
- [Flat App Status](apps/flat/status.md)
- [Flat Atmosphere Design](apps/flat/atmosphere-design.md)
- [Atmosphere Reset Research](apps/flat/plans/atmosphere_reset/research.md)
- [Atmosphere Reset Design](apps/flat/plans/atmosphere_reset/design.md)
- [CPU Spectral Reference Integrator Design](apps/flat/plans/atmosphere_reset/cpu-spectral-reference-integrator-design.md)
- [Atmosphere Reset Plan](apps/flat/plans/atmosphere_reset/plan.md)
- [Reality-Aligned Daytime Atmosphere Plan](apps/flat/plans/reality-aligned-daytime-atmosphere-plan.md)
- [Spherical Sun Atmosphere Plan](apps/flat/plans/spherical-sun-atmosphere-plan.md)

When switching topics, update this file with the new topic id from
[Routing](context/routing.md). On bootstrap, load the active topic README after
the lightweight shared context.
