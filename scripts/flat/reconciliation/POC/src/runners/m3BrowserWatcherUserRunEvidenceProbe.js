// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 3.4 user-run browser evidence.
// - tmp/atmosphere/reconciliation/065-m3-browser-watcher-dry-run.
// - tmp/atmosphere/reconciliation/066-m3-browser-diagnostics-readiness.

import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const WATCHER_OUT_ROOT = 'tmp/atmosphere/reconciliation';
const recordDirectory = parseRecordDirectory(process.argv);
const failures = [];

await appendRunLog(recordDirectory, 'm3BrowserWatcherUserRunEvidenceProbe started.');

let latest = null;
let progress = null;
let criteriaResults = null;
let browserDiagnostics = null;
let fullDiagnostics = null;
let selectedPixels = null;
let artifactFiles = {};

try {
    latest = JSON.parse(await readFile(resolve(WATCHER_OUT_ROOT, 'latest.json'), 'utf8'));
    progress = JSON.parse(await readFile(resolve(WATCHER_OUT_ROOT, 'progress.json'), 'utf8'));
    criteriaResults = JSON.parse(await readFile(latest.artifact.paths.criteriaPath, 'utf8'));
    browserDiagnostics = JSON.parse(await readFile(latest.artifact.paths.browserDiagnosticsPath, 'utf8'));
    fullDiagnostics = JSON.parse(await readFile(latest.artifact.paths.diagnosticsPath, 'utf8'));
    selectedPixels = JSON.parse(await readFile(latest.artifact.paths.selectedPixelsPath, 'utf8'));
    artifactFiles = await checkArtifactFiles(latest.artifact.paths);
} catch (error) {
    failures.push(failure('browser-watcher-user-run-read-failed', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('latest-browser-run-accepted', latest?.status === 'accepted'),
    criterion('watcher-progress-live', progress?.status === 'watching'),
    criterion('browser-reported-webgl2', browserDiagnostics?.webglVersion?.includes('WebGL 2.0') === true),
    criterion('shader-compile-link-accepted', fullDiagnostics?.shader?.status === 'accepted'),
    criterion('png-artifacts-written', artifactFiles.screenshot === true && artifactFiles.canvasImage === true),
    criterion('selected-pixel-readback-recorded',
        Array.isArray(selectedPixels?.selectedPixels) && selectedPixels.selectedPixels.length === 3),
    criterion('no-page-or-fatal-errors',
        latest?.browser?.pageErrors?.length === 0 && latest?.browser?.fatalErrors?.length === 0),
]);
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'User-run browser evidence criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Capture the first user-run reconciliation browser watcher evidence after
Subgoal 3.4 implementation. This record summarizes the live watcher output
folder and preserves the accepted capability-smoke diagnostics.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.4-user-run-evidence',
    runner: 'm3BrowserWatcherUserRunEvidenceProbe',
    watcherOutRoot: WATCHER_OUT_ROOT,
    latestPath: resolve(WATCHER_OUT_ROOT, 'latest.json'),
    progressPath: resolve(WATCHER_OUT_ROOT, 'progress.json'),
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'tmp/atmosphere/reconciliation/065-m3-browser-watcher-dry-run',
        'tmp/atmosphere/reconciliation/066-m3-browser-diagnostics-readiness',
        'scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    progress,
    latestSummary: latest
        ? Object.freeze({
            status: latest.status,
            runDir: latest.artifact.runDir,
            pageUrl: latest.browser.pageUrl,
            savedArtifactNames: savedArtifactNames(latest),
            wroteCanvasImage: savedArtifactNames(latest).includes('images/canvas-image.png'),
            requiresPageRecovery: latest.browser.requiresPageRecovery,
            pageErrors: latest.browser.pageErrors,
            fatalErrors: latest.browser.fatalErrors,
            selectedPixels: selectedPixels?.selectedPixels ?? [],
            browser: browserDiagnostics ?? null,
            shader: summarizeShaderDiagnostics(fullDiagnostics?.shader ?? null),
        })
        : null,
    artifactFiles,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3BrowserWatcherUserRunEvidenceProbe.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
});
await writeText(recordDirectory, 'report.md', `# Report

Subgoal 3.4 user-run browser watcher evidence finished with status: ${status}.

- Watcher run: \`${latest?.artifact?.runDir ?? 'not-found'}\`
- Browser status: \`${latest?.status ?? 'not-found'}\`
- WebGL renderer: \`${browserDiagnostics?.browser?.unmaskedRenderer ?? 'not-found'}\`
- Selected pixels: ${selectedPixels?.selectedPixels?.length ?? 0}
- PNG artifacts written: screenshot=${artifactFiles.screenshot === true}, canvas=${artifactFiles.canvasImage === true}
`);
await appendRunLog(recordDirectory, `m3BrowserWatcherUserRunEvidenceProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
}));

async function checkArtifactFiles(paths) {
    const checks = {
        screenshot: paths?.screenshotPath,
        canvasImage: paths?.canvasImagePath,
        result: paths?.resultPath,
        criteria: paths?.criteriaPath,
        diagnostics: paths?.diagnosticsPath,
    };
    const result = {};

    for (const [key, filePath] of Object.entries(checks)) {
        result[key] = await exists(filePath);
    }

    return Object.freeze(result);
}

async function exists(filePath) {
    if (!filePath) {
        return false;
    }

    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

function savedArtifactNames(value) {
    const artifacts = Array.isArray(value?.artifact?.savedArtifacts)
        ? value.artifact.savedArtifacts
        : Array.isArray(value?.browser?.savedArtifacts)
            ? value.browser.savedArtifacts
            : [];

    return artifacts.map((artifact) => artifact.name).filter(Boolean);
}

function summarizeShaderDiagnostics(shader) {
    if (!shader) {
        return null;
    }

    return Object.freeze({
        status: shader.status,
        vertexStatus: shader.vertex?.status ?? null,
        fragmentStatus: shader.fragment?.status ?? null,
        vertexCompileLog: shader.vertex?.compileLog ?? null,
        fragmentCompileLog: shader.fragment?.compileLog ?? null,
        linkLog: shader.linkLog ?? null,
    });
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
