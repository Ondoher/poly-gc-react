// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.4.1.
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md, browser harness rules.

import { readFile } from 'node:fs/promises';
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
const outRoot = resolve(recordDirectory, 'browser-output');
const commandPath = resolve('scripts/flat/reconciliation/POC/browser-jobs/browser-command.json');

await appendRunLog(recordDirectory, 'm3BrowserWatcherDryRunProbe started.');

let dryRun = null;
let progress = null;
let latest = null;

try {
    const runner = new BrowserShaderJobRunner({
        mode: 'dry-run',
        outRoot,
        commandPath,
    });
    dryRun = await runner.dryRun();
    progress = JSON.parse(await readFile(dryRun.progressPath, 'utf8'));
    latest = JSON.parse(await readFile(dryRun.latestPath, 'utf8'));
} catch (error) {
    failures.push(failure('browser-watcher-dry-run-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('dry-run-accepted', dryRun?.status === 'accepted'),
    criterion('progress-file-written', progress?.kind === 'algorithm32-reconciliation-browser-progress'),
    criterion('progress-names-command-and-output-root',
        progress?.commandPath === commandPath && progress?.outRoot === outRoot),
    criterion('latest-dry-run-packet-written', latest?.kind === 'algorithm32-reconciliation-browser-dry-run'),
]);
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Browser watcher dry-run criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Finish the non-browser-verifiable part of Subgoal 3.4.1 by proving the
reconciliation browser watcher can normalize a JSON job, create its output
root, and update live progress without launching Chromium.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.4.1',
    runner: 'm3BrowserWatcherDryRunProbe',
    outRoot,
    commandPath,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-34-browser-job-watcher',
        'agents/topics/apps/flat/reconciliation/experimental-guidelines.md#browser-harness-rules',
        'scripts/flat/local-second-order/harness.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    dryRun,
    progress,
    latest,
    userRunCommand:
        'node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --watch',
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3BrowserWatcherDryRunProbe.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    progressPath: dryRun?.progressPath ?? null,
    latestPath: dryRun?.latestPath ?? null,
});
await writeText(recordDirectory, 'report.md', `# Report

Subgoal 3.4.1 dry-run probe finished with status: ${status}.

The browser watcher command for user-run operation is:

\`\`\`powershell
node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --watch
\`\`\`

This record does not launch Chromium; user-run browser evidence should be
captured by the watcher output folders.
`);
await appendRunLog(recordDirectory, `m3BrowserWatcherDryRunProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    userRunCommand: 'node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --watch',
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
