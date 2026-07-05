// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 3.4 browser watcher record placement.
// - tmp/atmosphere/reconciliation/069-m3-browser-command-done-guard.

import { resolve } from 'node:path';

import { BrowserShaderJobRunner } from '../index.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const failures = [];
const expectedOutRoot = resolve('tmp/atmosphere/reconciliation');

await appendRunLog(recordDirectory, 'm3BrowserOutputRootAlignmentProbe started.');

let options = null;

try {
    const runner = new BrowserShaderJobRunner({ mode: 'dry-run' });
    options = runner.describeOptions();
} catch (error) {
    failures.push(failure('browser-output-root-alignment-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('default-output-root-is-main-reconciliation-root', options?.outRoot === expectedOutRoot),
    criterion('progress-file-lives-in-main-reconciliation-root',
        options ? resolve(options.outRoot, 'progress.json') === resolve('tmp/atmosphere/reconciliation/progress.json') : false),
    criterion('latest-file-lives-in-main-reconciliation-root',
        options ? resolve(options.outRoot, 'latest.json') === resolve('tmp/atmosphere/reconciliation/latest.json') : false),
]);
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Browser output root alignment criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Verify that future reconciliation browser watcher runs write numbered folders
directly under \`tmp/atmosphere/reconciliation/NNN-*\`, alongside the rest of
the lane records, rather than under a separate browser subfolder.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.4-browser-output-root-alignment',
    runner: 'm3BrowserOutputRootAlignmentProbe',
    expectedOutRoot,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'scripts/flat/reconciliation/POC/src/browser/BrowserShaderJobRunner.js',
        'scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    options,
    expectedOutRoot,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3BrowserOutputRootAlignmentProbe.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
});
await writeText(recordDirectory, 'report.md', `# Report

Browser output-root alignment probe finished with status: ${status}.

Future watcher output root: \`${options?.outRoot ?? 'not-resolved'}\`.
`);
await appendRunLog(recordDirectory, `m3BrowserOutputRootAlignmentProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    outRoot: options?.outRoot ?? null,
}));

function criterion(name, accepted) {
    return Object.freeze({
        name,
        status: accepted ? 'accepted' : 'rejected',
    });
}

function failure(id, message, details = null) {
    return Object.freeze({ id, message, details });
}
