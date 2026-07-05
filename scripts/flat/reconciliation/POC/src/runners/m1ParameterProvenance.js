// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 parameter/provenance extraction.
// - tmp/atmosphere/reconciliation/010-cli-experiment-run-record-rule.

import buildParameterLedger from '../provenance/buildParameterLedger.js';
import { assert, nowIso, parseRecordDirectory, writeJson, writeText } from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const ledger = buildParameterLedger();
const unresolvedEntries = ledger.filter((entry) => entry.provenanceClassification === 'unresolved');
const pendingEntries = ledger.filter((entry) => entry.verificationStatus !== 'accepted');

assert(ledger.length >= 10, 'Parameter ledger should contain the active baseline groups.');
assert(unresolvedEntries.length === 0, 'M1 pre-artifact parameter ledger must not have unresolved entries.');
assert(pendingEntries.length === 0, 'M1 pre-artifact parameter ledger entries must be accepted.');

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Extract the M1 pre-artifact parameter/provenance ledger from the shared
baseline constants and classify each retained value before implementation uses
it as accepted runtime data.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'M1 Subgoal 1.1 parameter/provenance extraction',
    runtimeCodeChanged: true,
    ledgerSource: 'scripts/flat/reconciliation/POC/src/provenance/buildParameterLedger.js',
    parameterDoc: 'scripts/flat/reconciliation/POC/parameters.md',
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'agents/topics/apps/flat/algorithm32/conclusions.md',
        'agents/topics/apps/flat/reconciliation/bruneton-start-fresh-source-audit.md',
        'tmp/atmosphere/reconciliation/005-shared-baseline-constants',
    ],
    unresolvedEntries: unresolvedEntries.length,
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'accepted',
    entries: ledger,
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        {
            name: 'ledger populated',
            status: 'accepted',
            result: `${ledger.length} entries emitted.`,
        },
        {
            name: 'no unresolved provenance',
            status: 'accepted',
            result: `${unresolvedEntries.length} unresolved entries.`,
        },
        {
            name: 'no pending verification entries',
            status: 'accepted',
            result: `${pendingEntries.length} pending entries.`,
        },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', {
    diagnostics: [
        {
            name: 'ledgerEntryCount',
            status: 'accepted',
            value: ledger.length,
        },
    ],
});
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m1ParameterProvenance.js --record ${recordDirectory}`,
            purpose: 'Emit the M1 parameter/provenance ledger into its own experiment record.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'M1 pre-artifact parameter/provenance ledger is populated with no unresolved entries.',
    runtimeCodeChanged: true,
    ledgerEntryCount: ledger.length,
    unresolvedEntryCount: unresolvedEntries.length,
    pendingEntryCount: pendingEntries.length,
    nextStep: 'Run transport helper invariant experiment before concrete distant/spherical execution.',
});
await writeText(recordDirectory, 'report.md', `# Report

The M1 pre-artifact parameter/provenance ledger emitted ${ledger.length}
accepted entries. No unresolved or pending entries were found.
`);
await writeText(recordDirectory, 'run.log', `${nowIso()} m1ParameterProvenance accepted ${ledger.length} ledger entries.\n`);

console.log(JSON.stringify({
    status: 'accepted',
    ledgerEntryCount: ledger.length,
    unresolvedEntryCount: unresolvedEntries.length,
}));
