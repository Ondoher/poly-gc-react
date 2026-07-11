# Algorithm32 Abstraction Design

This archived summary is superseded by the active Milestone 5 boundary-radiance
design. Older design notes live in this archive.

## Active Addition

Add `ExternalBoundaryRadiance` as a camera-ray visibility role adjacent to,
but separate from, existing atmosphere illumination and incident-radiance cache
roles.

It answers:

```text
what radiance arrives from beyond the atmosphere along this camera ray?
```

The active composition target is:

```text
pathRadiance + viewTransmittance * celestialRadiance
```

## Ownership

- Light sources own canonical source facts.
- A light source may expose a companion visible-body provider for its own
  visible disk, starting with the Sun disk.
- The visible-body provider is a view over source-owned facts, not a second
  owner of source data.
- General starfields, Moon, planets, and decorative backgrounds are not owned
  by the Sun light source. They may provide their own boundary-radiance
  providers or app-owned adapters.
- Optional Moon/starfield contribution to atmosphere illumination is a later
  source/cache design, not part of the first visibility proof.

## Does Not Own

- Incident-radiance/L2 cache sampling.
- Atmosphere path-radiance integration.
- Decorative/fallback app backgrounds.
- Full exposure, bloom, or tone-mapping policy beyond the current Color
  composition boundary.

## Promotion Target

After acceptance, promote only the accepted descriptor, owner boundary, and
composition contract into `shared/algorithm32/production/`.
