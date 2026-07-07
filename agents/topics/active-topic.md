# Active Topic

Current active topic: `algorithm32/production-shader`

Parent app/topic: `flat`

## Current Focus

Production shader/runtime implementation for Algorithm32.

## Reload Sources

Load these after the shared bootstrap docs:

- [Algorithm32 Production Documentation](apps/flat/algorithm32/README.md)
- [Algorithm32 Status](apps/flat/algorithm32/status.md)
- [Algorithm32 Requirements](apps/flat/algorithm32/requirements.md)
- [Algorithm32 Production Design](apps/flat/algorithm32/production-design.md)
- [Algorithm32 Primary Facade API Draft](apps/flat/algorithm32/api-facade-draft.md)
- [Reconciliation Conclusions](apps/flat/reconciliation/conclusions.md)
- [Reconciliation To Production Deltas](apps/flat/algorithm32/reconciliation-production-deltas.md)
- [Reconciliation Lane](apps/flat/reconciliation/README.md)
- [Unsourced And Partially Sourced Facts](apps/flat/reconciliation/unsourced-and-partially-sourced-facts.md)

## Active Rules

- Work belongs in `shared/algorithm32/production/` and the production
  Algorithm32 docs under `agents/topics/apps/flat/algorithm32/`.
- Treat [Reconciliation Conclusions](apps/flat/reconciliation/conclusions.md)
  as the consolidated implementation driver for the production
  shader/reference work, including its adjusted abstraction ownership and data
  flow.
- Use [Reconciliation To Production Deltas](apps/flat/algorithm32/reconciliation-production-deltas.md)
  to resolve architecture/API gaps before changing production contracts.
- Keep the production top-level shape as the primary API boundary:
  `Algorithm32` facade, production dependency aggregate, `Reference`, and
  `ShaderBuilder`. Align the internal details and owned abstractions with the
  reconciliation POC beneath that shape.
- For type definitions, follow the reconciliation POC type shapes by default
  because most production implementation code will be lifted from that code
  base. Keep production unit-bearing packet boundaries where units matter,
  such as distance.
- Diagnostics remain deferred. Implement only the basic fail-loud validation
  and setup/resource errors needed for the promoted runtime path; do not add
  diagnostic envelopes, per-helper callbacks, or a stable public diagnostics
  taxonomy in the first slice.
- Failure policy: fail loudly on configuration and setup surfaces, including
  constructor validation, `setConfig`, `setupShader`, awaited handle config
  updates, and resource build/bind setup. Once the runtime render path is
  live, log runtime failures and continue with the last valid state, no-op, or
  fallback path when possible.
- The reconciliation topic, reconciliation POC code, and reconciliation
  experiment records remain relevant supporting implementation material:
  `agents/topics/apps/flat/reconciliation/`,
  `scripts/flat/reconciliation/POC/`, and
  `tmp/atmosphere/reconciliation/`.
- Older pre-reconciliation cleanroom, shader-lab, local-second-order,
  `shared/algorithm32/POC/`, source-contract, and scattered experiment lanes
  are no longer production implementation references.
- Do not runtime-link production code to reconciliation POC or experiment code.
  Promote the accepted behavior and contracts into
  `shared/algorithm32/production/`.
- Keep unresolved source/provenance work tracked through
  [Unsourced And Partially Sourced Facts](apps/flat/reconciliation/unsourced-and-partially-sourced-facts.md).
