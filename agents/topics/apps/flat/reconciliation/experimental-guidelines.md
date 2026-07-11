# Reconciliation Experimental Guidelines

This guideline is not a historical record. Keep it limited to rules needed for
new Milestone 5 records. The archived Mark I guideline is
[archive/mark-i-experimental-guidelines.md](archive/mark-i-experimental-guidelines.md).

## Current Rules

- Write fresh substantive evidence under `tmp/atmosphere/reconciliation/NNN-*`.
- Keep status/current-state docs as snapshots of current facts and open items,
  not running histories.
- Use `tmp/atmosphere/reconciliation/running-log.md` for lightweight
  chronological notes when a separate log is useful.
- Treat `tmp/atmosphere/reconciliation_mark_i/` as archived evidence only.
- Do not runtime-link active POC code to archived artifacts or archived POC
  notes.
- Each numbered record should state the goal, inputs, commands, criteria,
  results, and accepted/rejected status.
- Rejected or superseded records remain in place; create a new numbered record
  for the next attempt.
- Keep active status docs concise. Put detailed evidence in numbered records.
- Before production promotion, update the active design docs with the accepted
  contract and leave older exploratory notes in the archive.

## Runner And Experiment Scripts

- Runner folder: `scripts/flat/reconciliation/POC/src/runners/`.
- Record helper: `scripts/flat/reconciliation/POC/src/runners/recordWriter.js`.
- Browser runner: `scripts/flat/reconciliation/POC/browser-page/runner.js`.
- Browser command channel:
  `scripts/flat/reconciliation/POC/browser-jobs/browser-command.json`.
- POC script overview: `scripts/flat/reconciliation/POC/README.md`.
