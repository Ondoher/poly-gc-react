# Phase 4 Migration Decision

## Decision

Preserve the old `agents/topics.bak/flat/README.md` content as
`apps/flat/status.md` during the first app-doc migration pass, with only light
path/link edits for the new tree.

## Rationale

The old Flat README mixes current status, implementation history, POC scope,
development breakdown, city picking, celestial data-source evaluation, terrain
ideas, atmosphere references, open questions, and related paths. Splitting all
of that aggressively during Phase 4 risks losing or over-editing useful
context.

The first pass therefore creates a clean app README and moves already separate
source docs into focused files:

- `prompt.md`
- `projection-model-api.md`
- `plans/poc-phase-1-plan.md`

## Follow-Up

During the second content pass, split `status.md` into smaller current-state,
data-source, rendering, controls, and decision docs as needed.
