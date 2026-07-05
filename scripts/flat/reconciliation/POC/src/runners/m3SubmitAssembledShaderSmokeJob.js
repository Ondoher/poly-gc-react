// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 3.5 integrated GPU distant/spherical parity.
// - tmp/atmosphere/reconciliation/064-m3-shader-assembly.
// - tmp/atmosphere/reconciliation/070-m3-browser-output-root-alignment.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
    Algorithm32ShaderAssembler,
    DistantSphericalShaderContributionFactory,
    DistantSphericalShaderDescriptorBuilder,
} from '../index.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const COMMAND_PATH = resolve('scripts/flat/reconciliation/POC/browser-jobs/browser-command.json');
const WATCHER_OUT_ROOT = resolve('tmp/atmosphere/reconciliation');
const WATCH_TIMEOUT_MS = 120000;
const POLL_MS = 750;
const recordDirectory = parseRecordDirectory(process.argv);
const artifactRunDirectory = resolve(recordDirectory);
const failures = [];

await appendRunLog(recordDirectory, 'm3SubmitAssembledShaderSmokeJob started.');

let descriptor = null;
let assembly = null;
let command = null;
let latest = null;
let progress = null;
let selectedPixels = null;
let browserDiagnostics = null;

try {
    descriptor = new DistantSphericalShaderDescriptorBuilder().build();
    const factory = new DistantSphericalShaderContributionFactory();
    assembly = new Algorithm32ShaderAssembler().assemble({
        descriptor,
        contributions: factory.createContributions(descriptor),
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });
    command = makeCommand({ descriptor, assembly });
    await writeFile(COMMAND_PATH, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
    await appendRunLog(recordDirectory, `submitted browser command ${command.id}.`);
    latest = await waitForWatcherResult(command.id);
    progress = await readJsonIfExists(resolve(WATCHER_OUT_ROOT, 'progress.json'));
    selectedPixels = latest?.artifact?.paths?.selectedPixelsPath
        ? await readJsonIfExists(latest.artifact.paths.selectedPixelsPath)
        : null;
    browserDiagnostics = latest?.artifact?.paths?.browserDiagnosticsPath
        ? await readJsonIfExists(latest.artifact.paths.browserDiagnosticsPath)
        : null;
} catch (error) {
    failures.push(failure('assembled-shader-smoke-submit-crash', error.message, { stack: error.stack }));
}

const shaderDiagnostics = latest?.result?.diagnostics?.shader ?? null;
const criteria = Object.freeze([
    criterion('command-submitted-pending', command?.status === 'pending'),
    criterion('watcher-completed-matching-command', latest?.command?.id === command?.id),
    criterion('watcher-marked-command-done', await commandFileIsDone(command?.id)),
    criterion('browser-artifacts-written-in-record-directory',
        sameResolvedPath(latest?.artifact?.runDir, artifactRunDirectory)),
    criterion('assembled-shader-source-hash-carried',
        latest?.command?.payload?.sourceHash === assembly?.sourceHash),
    criterion('browser-job-accepted', latest?.status === 'accepted'),
    criterion('assembled-shader-compile-link-accepted', shaderDiagnostics?.status === 'accepted'),
    criterion('selected-pixel-readback-recorded',
        Array.isArray(selectedPixels?.selectedPixels) && selectedPixels.selectedPixels.length === 3),
    criterion('png-artifacts-written',
        browserArtifactSaved(latest, 'images/canvas-image.png') && browserArtifactSaved(latest, 'images/screenshot.png')),
]);
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Assembled shader browser smoke criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Submit the first browser job that compiles and renders the actual
reconciliation Algorithm32 assembled distant/spherical fragment shader. This
is a smoke-level GPU execution record, not the final objective-scene parity
claim.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5.1-first-assembled-shader-smoke',
    runner: 'm3SubmitAssembledShaderSmokeJob',
    commandPath: COMMAND_PATH,
    watcherOutRoot: WATCHER_OUT_ROOT,
    artifactRunDirectory,
    timeoutMs: WATCH_TIMEOUT_MS,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'tmp/atmosphere/reconciliation/064-m3-shader-assembly',
        'tmp/atmosphere/reconciliation/070-m3-browser-output-root-alignment',
        'scripts/flat/reconciliation/POC/browser-page/runner.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    descriptorFingerprint: descriptor?.fingerprint ?? null,
    sourceHash: assembly?.sourceHash ?? null,
    command,
    progress,
    latestSummary: summarizeLatest(latest),
    browserDiagnostics,
    selectedPixels,
    shaderDiagnostics: summarizeShader(shaderDiagnostics),
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3SubmitAssembledShaderSmokeJob.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    artifactDirectory: latest?.artifact?.runDir ?? null,
    sourceHash: assembly?.sourceHash ?? null,
});
await writeText(recordDirectory, 'report.md', `# Report

Assembled distant/spherical shader browser smoke finished with status:
${status}.

- Command id: \`${command?.id ?? 'not-submitted'}\`
- Source hash: \`${assembly?.sourceHash ?? 'not-built'}\`
- Artifact directory: \`${latest?.artifact?.runDir ?? 'not-completed'}\`
- Browser status: \`${latest?.status ?? 'not-completed'}\`
- Shader status: \`${shaderDiagnostics?.status ?? 'not-reported'}\`
- Selected pixels: ${selectedPixels?.selectedPixels?.length ?? 0}

Expectation failures, if any, are recorded without attempting repair during
this run.
`);
await appendRunLog(recordDirectory, `m3SubmitAssembledShaderSmokeJob ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    artifactDirectory: latest?.artifact?.runDir ?? null,
}));

function makeCommand({ descriptor, assembly }) {
    return Object.freeze({
        id: `assembled-distant-spherical-smoke-${Date.now()}`,
        label: 'assembled-distant-spherical-smoke',
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        artifactRunDirectory,
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal:
            'Compile and render the current Algorithm32 distant/spherical assembled fragment shader in the browser watcher.',
        payload: Object.freeze({
            jobType: 'assembled-distant-spherical-smoke',
            descriptorFingerprint: descriptor.fingerprint,
            sourceHash: assembly.sourceHash,
            fragmentShaderSource: assembly.fragmentShaderSource,
        }),
    });
}

async function waitForWatcherResult(commandId) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < WATCH_TIMEOUT_MS) {
        const candidate = await readJsonIfExists(resolve(WATCHER_OUT_ROOT, 'latest.json'));
        if (candidate?.command?.id === commandId) {
            return candidate;
        }

        await appendRunLog(recordDirectory, `waiting for watcher result command=${commandId}.`);
        await delay(POLL_MS);
    }

    throw new Error(`Timed out waiting ${WATCH_TIMEOUT_MS} ms for watcher command ${commandId}.`);
}

async function commandFileIsDone(commandId) {
    const current = await readJsonIfExists(COMMAND_PATH);
    return current?.id === commandId && current?.status === 'done';
}

async function readJsonIfExists(filePath) {
    try {
        return JSON.parse(await readFile(filePath, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

function summarizeLatest(value) {
    if (!value) {
        return null;
    }

    return Object.freeze({
        status: value.status,
        commandId: value.command?.id ?? null,
        runDir: value.artifact?.runDir ?? null,
        pageErrors: value.browser?.pageErrors ?? [],
        fatalErrors: value.browser?.fatalErrors ?? [],
        savedArtifactNames: savedArtifactNames(value),
        wroteCanvasImage: browserArtifactSaved(value, 'images/canvas-image.png'),
        requiresPageRecovery: value.browser?.requiresPageRecovery ?? null,
    });
}

function browserArtifactSaved(value, artifactName) {
    return savedArtifactNames(value).includes(artifactName);
}

function savedArtifactNames(value) {
    const artifacts = Array.isArray(value?.artifact?.savedArtifacts)
        ? value.artifact.savedArtifacts
        : Array.isArray(value?.browser?.savedArtifacts)
            ? value.browser.savedArtifacts
            : [];

    return artifacts.map((artifact) => artifact.name).filter(Boolean);
}

function sameResolvedPath(left, right) {
    return typeof left === 'string'
        && typeof right === 'string'
        && resolve(left).toLowerCase() === resolve(right).toLowerCase();
}

function summarizeShader(shader) {
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

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
