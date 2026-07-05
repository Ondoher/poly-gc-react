// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 3.4 browser watcher command protocol.
// - tmp/atmosphere/reconciliation/068-m3-browser-watcher-user-run-evidence.

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

const COMMAND_PATH = resolve('scripts/flat/reconciliation/POC/browser-jobs/browser-command.json');
const recordDirectory = parseRecordDirectory(process.argv);
const failures = [];

await appendRunLog(recordDirectory, 'm3BrowserCommandDoneGuardProbe started.');

let command = null;
let rawCommand = null;

try {
    rawCommand = JSON.parse(await readFile(COMMAND_PATH, 'utf8'));
    const runner = new BrowserShaderJobRunner({
        mode: 'dry-run',
        commandPath: COMMAND_PATH,
        outRoot: resolve(recordDirectory, 'browser-output'),
    });
    command = await runner.readOrCreateCommand();
} catch (error) {
    failures.push(failure('browser-command-done-guard-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('command-file-has-done-status', rawCommand?.status === 'done'),
    criterion('normalized-command-preserves-done-status', command?.status === 'done'),
    criterion('completion-records-status-and-run-dir',
        typeof command?.completion?.status === 'string' && typeof command?.completion?.runDir === 'string'),
]);
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Done-command guard criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Verify that the current reconciliation browser command is marked \`done\`
after the accepted watcher run, preventing a fresh watcher process from
rerunning the same command.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.4-command-done-guard',
    runner: 'm3BrowserCommandDoneGuardProbe',
    commandPath: COMMAND_PATH,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'tmp/atmosphere/reconciliation/068-m3-browser-watcher-user-run-evidence',
        'scripts/flat/reconciliation/POC/src/browser/BrowserShaderJobRunner.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    rawCommand,
    normalizedCommand: command,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3BrowserCommandDoneGuardProbe.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
});
await writeText(recordDirectory, 'report.md', `# Report

Browser command done-guard probe finished with status: ${status}.

The command file currently has status \`${command?.status ?? 'unknown'}\`.
`);
await appendRunLog(recordDirectory, `m3BrowserCommandDoneGuardProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
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
