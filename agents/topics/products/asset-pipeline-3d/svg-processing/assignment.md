# Alignment Assignment Contract

This document owns the integration boundary between Source Alignment, Source
Assignment, and Final Rendering.

## Alignment Consumes

Source Alignment consumes:

- accepted reference structure
- normalized source components through canonical artifact pointers
- optional part decisions from canonical `state.parts` and `state.bindings`
- source assignment configuration from `configuration`

It does not consume optional part sidecars or previous source assignment maps
as active state.

## Alignment Writes

Alignment writes:

- compact selected matches to `state.alignment.matches`
- placement fields needed by rendering onto `state.parts[partId]`
- tentative component bindings when source assignment should review them

Diagnostic candidates, rejected alternatives, and score traces are not
canonical state.

## Source Assignment Consumes

Source Assignment consumes the canonical alignment handoff and normalized
source geometry to synthesize a review view. It lets the reviewer accept or
correct component bindings and source absence.

## Source Assignment Writes

Source Assignment writes:

- compact `state.bindings` records
- accepted source absence on `state.parts`
- accepted source bindings with `strength: "accepted"`

Manual bind/unbind actions are request behavior. They should reconcile into
canonical bindings and part state instead of becoming a second durable action
log.

## Rendering Can Rely On

Final Rendering can rely on:

- accepted bindings in `state.bindings`
- accepted source absence in `state.parts`
- placement fields on `state.parts`
- `state.alignment.matches` when it needs the compact alignment handoff
- normalized components through `artifacts.normalizedComponents`

Rendering must not treat diagnostic alignment artifacts as mutable state.

## Boundary Rule

Alignment answers how source geometry can fit reference structure. Source
Assignment answers what source geometry means. Final Rendering answers what
the accepted source/reference facts should output.

