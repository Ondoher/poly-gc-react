// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.4.2.
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md, GPU/browser diagnostics.

import { readFile } from 'node:fs/promises';

import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const failures = [];

await appendRunLog(recordDirectory, 'm3BrowserDiagnosticsReadinessProbe started.');

let pageSource = '';
let runnerSource = '';

try {
    pageSource = await readFile('scripts/flat/reconciliation/POC/browser-page/runner.js', 'utf8');
    runnerSource = await readFile('scripts/flat/reconciliation/POC/src/browser/BrowserShaderJobRunner.js', 'utf8');
} catch (error) {
    failures.push(failure('browser-diagnostics-readiness-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('browser-page-collects-webgl-identification',
        includesAll(pageSource, ['WEBGL_debug_renderer_info', 'UNMASKED_VENDOR_WEBGL', 'UNMASKED_RENDERER_WEBGL'])),
    criterion('browser-page-collects-precision-extensions-and-readback',
        includesAll(pageSource, ['getShaderPrecisionFormat', 'getSupportedExtensions', 'readbackFormat', 'readPixels'])),
    criterion('browser-page-records-shader-compile-link-diagnostics',
        includesAll(pageSource, ['compileLog', 'linkLog', 'COMPILE_STATUS', 'LINK_STATUS'])),
    criterion('runner-writes-diagnostics-and-png-artifacts',
        includesAll(runnerSource, ['browser-diagnostics.json', 'images', 'canvas-image.png', 'screenshot.png', 'progress.json'])),
    criterion('runner-handles-timeout-with-page-recovery',
        includesAll(runnerSource, ['BROWSER_EVALUATION_TIMEOUT_MESSAGE', 'forceBrowserRecoveryAfterTimeout'])),
]);
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Browser diagnostics readiness criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Finish the locally verifiable part of Subgoal 3.4.2 by proving the browser
page and watcher are wired to emit WebGL, shader compile/link, readback, PNG,
and progress diagnostics when the user-run watcher executes a browser job.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.4.2',
    runner: 'm3BrowserDiagnosticsReadinessProbe',
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-34-browser-job-watcher',
        'agents/topics/apps/flat/reconciliation/experimental-guidelines.md#browser-harness-rules',
        'scripts/flat/algorithm32-shader-lab/harness.js',
        'scripts/flat/local-second-order/harness.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    checkedFiles: Object.freeze([
        'scripts/flat/reconciliation/POC/browser-page/runner.js',
        'scripts/flat/reconciliation/POC/src/browser/BrowserShaderJobRunner.js',
    ]),
    userOnceCommand:
        'node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --once',
    userWatchCommand:
        'node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --watch',
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3BrowserDiagnosticsReadinessProbe.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
});
await writeText(recordDirectory, 'report.md', `# Report

Subgoal 3.4.2 diagnostics readiness probe finished with status: ${status}.

The browser diagnostics are wired, but a real WebGL diagnostic packet requires
the user-run watcher because Chromium execution is outside the normal sandbox
path.
`);
await appendRunLog(recordDirectory, `m3BrowserDiagnosticsReadinessProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
}));

function includesAll(source, needles) {
    return needles.every((needle) => source.includes(needle));
}

function criterion(name, accepted) {
    return Object.freeze({
        name,
        status: accepted ? 'accepted' : 'rejected',
    });
}

function failure(id, message, details = null) {
    return Object.freeze({ id, message, details });
}
