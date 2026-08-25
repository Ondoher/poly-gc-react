# Reconciliation Lane

This is the current routing document for `flat/reconciliation`. It contains no
attempt chronology. Chronology belongs in
`tmp/atmosphere/reconciliation/running-log.md`; detailed evidence belongs in
immutable numbered records under `tmp/atmosphere/reconciliation/`.

## Current Purpose

The observer-independent Phase 6 CPU source-model reset is complete. Record `050`
accepts ER4C and completes ER5, 39/39, using exact-direction point and extended
transport, one conservative Sun path, full-frame typed composition, TSIS solar
and Rieke Sirius references, and the sealed record-049 lunar XA-G09
dependency.

Record 056 accepts ER6 real Flat32 globe validation across the exact San Jose
and Union Glacier eight-case matrix, 22/22, after record 054 accepted exact
returned-epoch acquisition. Record 059 accepts ER7's pre-display-only claim
boundary, 13/13; observer/background validation is out of scope. Record 065
accepts ER8 CPU convergence and POC cleanup, 26/26. Record 067 reports the ER9
selected production execution as 23/23, with 268/268 production specs and 2/2
app syntax checks. A later audit found its durable unit-suffixed scalar
properties violate the production unit-packet rule, so record 067 does not
complete production conformance or the full Reset Exit. The user subsequently
rolled back that production promotion. Record 067 remains immutable historical
execution evidence, but no promoted celestial implementation from it remains
in the current production tree. Record 066 remains immutable invalid because
`spawn EPERM` occurred before any production test began.

The successor production direction is now owned by
[CelestialContributionCache Design](../algorithm32/celestial-contribution-cache-design.md):
a camera-independent, geometry-domain cache of atmosphere-transported celestial
contribution fields queried by current shader rays and added before Color.
Camera movement changes queries rather than rebuilding the cache. That
direction is designed but not implemented or accepted.

Post-reset record 068 accepts an 8/8 CPU-only review capture of the same exact
San Jose/Union Glacier matrix. It retains eight 512x384 PNGs and one ordered
montage derived from 64x48 physical frames. The capture is generated but not
human-reviewed and makes no browser, GPU, or observational claim.

Record 069 is the immutable invalid full-diagnostic high-resolution attempt;
Node's string-size ceiling was reached before its first image. Fresh record
070 accepts the corrected compact-review route, 8/8, retaining identical
physical evaluation at 384x288 native pixels and eight 768x576 PNGs plus a
montage. Compact-review omits only the oversized per-pixel spectral diagnostic
payload from the returned object.

Record 071 accepts a 10/10 controlled day/night presentation follow-on at
384x288 native and 768x576 review resolution. The accepted record-056 San Jose
noon and sunset-plus-one packets are retained, while Moon and Sirius directions
are explicitly overridden to the same on-frame target pixels. One scene-wide
upper-sky exposure is shared by the full image and exact object-free
counterfactuals. The Moon/Sirius maximum output-byte residuals are 29/0 by day
and 255/255 by night. This is automated presentation evidence only; moved
geometry, human/camera visibility, astronomical placement, browser, and GPU
parity remain unclaimed.

## Sources Of Truth

- [Conclusions](conclusions.md) summarizes what the completed reset changed,
  accomplished, and justified, including the rolled-back production attempt.
  It is synthesis, not chronology.
- [Extra-Atmosphere Reset Design](extra-atmosphere-reset-design.md) owns the
  replacement architecture, frozen/reset boundaries, and accepted design
  decisions.
- [Extra-Atmosphere Reset Plan](extra-atmosphere-reset-plan.md) owns the checked
  execution sequence and active phase gates.
- [Extra-Atmosphere Objects](extra-atmosphere-objects.md) owns current
  per-object research requirements, maturity, physical gates, and scene matrix.
- [Status](status.md) is the concise present-state snapshot.
- [Unsourced And Partially Sourced Facts](unsourced-and-partially-sourced-facts.md)
  owns open provenance and sourcing gaps.
- Numbered records own detailed evidence. They are immutable after creation.
- The running log owns lightweight chronology.

Do not duplicate canonical facts among these sources. Production is a
destination for an accepted contract, not a source or runtime dependency of
the POC.

## Governing Boundaries

- Algorithm32 atmosphere transport and composition are frozen inputs.
- Preserve the continuous directional law
  `pathRadiance + viewTransmittance * boundaryRadiance` in the canonical
  15-channel spectral-density basis before display conversion.
- Use boundary radiance for typed extended directional sources.
- Point sources own spectral irradiance. Apply exact-source visibility and
  transmittance, then accumulate them through a separate normalized HDR-frame
  point response.
- Keep extended angular coverage, point-response weight, and opacity as
  distinct quantities. Do not restore generic scalar coverage/opacity
  brightness compositing or legacy aliases and fallbacks.
- Apply deterministic depth and occlusion to finite and infinite candidates.
  Opaque finite bodies mask farther celestial candidates; nearer scene
  geometry masks celestial candidates.
- Visible Sun, Moon, planet, and star representations do not enter the
  incident-radiance/L2 cache. Optional atmosphere illumination by those sources
  is a separate concern.
- A light source may expose a companion visible-disk boundary-radiance
  provider while one canonical owner retains the source facts.
- Keep decorative and fallback backgrounds separate from physical celestial
  radiance.

## Minimal Bootstrap

After [Active Topic](../../../active-topic.md), load this README and only:

- [Extra-Atmosphere Reset Design](extra-atmosphere-reset-design.md)
- [Extra-Atmosphere Reset Plan](extra-atmosphere-reset-plan.md)
- [Extra-Atmosphere Objects](extra-atmosphere-objects.md)
- [Status](status.md)

Open the fact ledger, implementation, evidence records, or running log only
when the current task requires them. Use the completed reset plan and current
status to preserve the accepted boundary; follow-on work needs a new scope.

## Active Roots

- Documentation: `agents/topics/apps/flat/reconciliation/`
- POC implementation: `scripts/flat/reconciliation/POC/`
- Fresh records: `tmp/atmosphere/reconciliation/NNN-*`
- Running log: `tmp/atmosphere/reconciliation/running-log.md`
- Preserved Mark I evidence: `tmp/atmosphere/reconciliation_mark_i/`
- Successor production design and implementation target:
  `agents/topics/apps/flat/algorithm32/` and
  `shared/algorithm32/production/`

Every attempt uses the next unused numbered directory. Never rerun into,
overwrite, or amend an existing evidence record, including after rejection or
an interrupted run.
