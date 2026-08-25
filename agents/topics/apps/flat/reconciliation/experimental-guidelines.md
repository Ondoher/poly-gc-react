# Reconciliation Experimental Guidelines

This guideline is not a historical record. Keep it limited to rules needed for
new Milestone 5 records. The archived Mark I guideline is
[archive/mark-i-experimental-guidelines.md](archive/mark-i-experimental-guidelines.md).

## Current Rules

- Write fresh substantive evidence under `tmp/atmosphere/reconciliation/NNN-*`.
- Put every result-bearing experiment, fixture evaluation, numerical smoke, or
  computational preflight in its own fresh numbered directory. Static source
  inspection and syntax-only checks may run without a record, but they must not
  emit or retain physical acceptance results.
- Keep Milestone 5 implementation changes inside
  `scripts/flat/reconciliation/POC/`. Supporting design/status changes belong
  inside `agents/topics/apps/flat/reconciliation/`, and generated evidence
  belongs inside `tmp/atmosphere/reconciliation/`.
- Treat `src/flat32/` and `shared/algorithm32/production/` as reference and
  provenance inputs only during the experimental proof. Do not modify them for
  reconciliation work and do not add reconciliation runtime imports from them.
- When Milestone 5 needs established `flat32` scene facts or calibration
  behavior, copy a bounded, explicitly provenance-labeled snapshot into the
  reconciliation POC. The snapshot is experimental proof input, not a second
  production owner. Record copied values/formulas and their source revision in
  the numbered record so later promotion can deliberately reconcile them.
- Do not silently keep the experimental snapshot synchronized with `flat32`.
  Let drift be visible and resolve it explicitly in a new numbered record.
- Treat Git revision as contextual provenance, not exact source identity, when
  the working tree is dirty or contains untracked experiment code. A substantive
  record must retain SHA-256 hashes for every executable POC source it uses,
  relevant dependency locks, and named external reference files. Acquisition
  records must also retain the upstream epoch actually returned rather than
  proving exact time from a request-derived label.
- Keep status/current-state docs as snapshots of current facts and open items,
  not running histories.
- Put chronology only in `tmp/atmosphere/reconciliation/running-log.md`.
  A plan may retain history only as checked progress items; design, routing,
  tracker, and status documents replace stale facts instead of appending them.
- Treat `tmp/atmosphere/reconciliation_mark_i/` as archived evidence only.
- Do not runtime-link active POC code to archived artifacts or archived POC
  notes.
- Each numbered record should state the goal, inputs, commands, criteria,
  results, and accepted/rejected status.
- Extra-atmosphere records must name the claimed layer and applicable `XA-G*`
  gates from [Extra-Atmosphere Objects](extra-atmosphere-objects.md). A result
  in one layer must not be promoted as evidence for another.
- Reset records must also name their `ER*` phase and follow
  [Extra-Atmosphere Reset Design](extra-atmosphere-reset-design.md) and
  [Extra-Atmosphere Reset Plan](extra-atmosphere-reset-plan.md). Do not extend
  the v1 point-source packet or merge point response back into coverage.
- Do not write subjective scene images before the reset phase's isolated
  quantity/conservation/invariance exit. An image may accompany a later phase,
  but it cannot be the accepting evidence for source or raster physics.
- Subjective bitmap records must report mechanical and reviewability status
  separately. A nonempty PNG, finite all-zero spectrum, or isolated hot pixel
  is not reviewability evidence; record black/clipping fractions, luminance
  range, and the named signal expected in intentionally dark frames.
- Preserve canonical numerical display output and label any review transfer or
  diagnostic exposure separately. Automated reviewability does not by itself
  establish human acceptance, photometric calibration, or numerical
  convergence.
- Do not use review thresholds, source-specific exposure, or authored angular
  footprints to accept a physical radiance or visibility claim. Exposure and
  other display transforms for physical comparisons must apply globally after
  atmosphere/celestial composition; validate sky radiance and the observer or
  camera response against independent sources.
- A physical point-source record must retain explicit spectral units; catalog,
  passband, SED, and external-source hashes; the exact perspective-pixel solid-
  angle derivation; and the PSF kind, support, parameters, and normalization
  residual. It must test spectral-flux conservation plus resolution, field-
  position, and subpixel-position invariance before subjective review.
- Point-response normalization applies to the full modeled response. Image-edge
  cropping must report off-raster loss and must not renormalize that lost flux
  back into the frame.
- Rejected or superseded records remain in place; create a new numbered record
  for the next attempt.
- Numbered record directories are immutable once any experiment run writes to
  them. Never rerun into, repair, refresh, or overwrite an existing record,
  regardless of whether it was accepted, rejected, incomplete, or crashed.
  Every retry and every changed criterion, fixture, shader, cache, or runner
  revision must use the next fresh numbered directory. If a record was
  accidentally overwritten, declare it invalid in the status documentation and
  rerun once in a new record; do not attempt to reconstruct its lost history.
- Keep active status docs concise. Put detailed evidence in numbered records.
- Before production promotion, replace the active design with the accepted
  contract. Keep chronology in the running log and detailed proof in immutable
  numbered records.

## Runner And Experiment Scripts

- Runner folder: `scripts/flat/reconciliation/POC/src/runners/`.
- Record helper: `scripts/flat/reconciliation/POC/src/runners/recordWriter.js`.
- Browser runner: `scripts/flat/reconciliation/POC/browser-page/runner.js`.
- Browser command channel:
  `scripts/flat/reconciliation/POC/browser-jobs/browser-command.json`.
- POC script overview: `scripts/flat/reconciliation/POC/README.md`.
