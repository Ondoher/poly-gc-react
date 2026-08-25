import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import MoonPhaseCalculator, {
    validateMoonPhaseAtTimeResult,
    validateNextMoonPhaseResult,
} from '../moon-phase/MoonPhaseCalculator.js';
import MoonPhaseFixtureSampleProvider from '../moon-phase/MoonPhaseFixtureSampleProvider.js';
import NextMoonPhaseResolver from '../moon-phase/NextMoonPhaseResolver.js';
import { appendRunLog, nowIso, parseRecordDirectory, writeJson, writeText } from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const commandPath = resolve('scripts/flat/reconciliation/POC/browser-jobs/browser-command.json');
const watcherOutRoot = resolve('tmp/atmosphere/reconciliation');
const fixturePath = resolve('scripts/flat/reconciliation/POC/src/moon-phase/fixtures/san-jose-date-basis-moon-phases.json');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
const calculator = new MoonPhaseCalculator();
const provider = new MoonPhaseFixtureSampleProvider({ fixture, calculator });
const resolver = new NextMoonPhaseResolver({ sampleProvider: provider, calculator });
await appendRunLog(recordDirectory, 'm5MoonPhaseContract started.');

const exactSample = fixture.samples.find((sample) => sample.timeIso === '2024-06-20T12:00:00.000Z');
const atTime = validateMoonPhaseAtTimeResult(Object.freeze({ ...exactSample, provenance: fixture.provenance }));
const phases = ['new', 'first-quarter', 'full', 'last-quarter'];
const events = [];
for (const phase of phases) {
    events.push(validateNextMoonPhaseResult(await resolver.resolve({
        afterTimeIso: fixture.afterTimeIso,
        phase,
    })));
}
const fullMoon = events.find((event) => event.phase === 'full');
const invalidPhaseError = captureErrorAsync(() => resolver.resolve({ afterTimeIso: fixture.afterTimeIso, phase: 'blue' }));
const command = {
    id: `m5-moon-phase-packet-parity-${Date.now()}`,
    label: 'm5-moon-phase-packet-parity',
    page: 'index.html',
    entrypoint: 'runReconciliationShaderJob',
    artifactRunDirectory: resolve(recordDirectory),
    status: 'pending',
    createdAt: new Date().toISOString(),
    stateGoal: 'Validate identical normalized Moon phase packets in Node and the existing browser runner.',
    payload: { jobType: 'moon-phase-packet-parity', atTime, events },
};

await writeFile(commandPath, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
await appendRunLog(recordDirectory, `submitted browser command ${command.id}.`);
let latest = null;
let browserError = null;
try {
    latest = await waitForWatcherResult(command.id);
} catch (error) {
    browserError = summarizeError(error);
}
const browserScene = latest?.result?.diagnostics?.scene ?? null;
const browserFullMoon = browserScene?.events?.find((event) => event.phase === 'full') ?? null;
const invalidError = await invalidPhaseError;
const criteria = [
    criterion('phase-at-time-packet-valid', atTime.schemaVersion === 1
        && atTime.phaseName === 'full'
        && atTime.waxing === true
        && atTime.illuminatedFraction > 0.97),
    criterion('four-principal-phases-resolved', events.length === 4),
    criterion('full-moon-time-matches-retained-horizons-fixture', fullMoon?.eventTimeIso === '2024-06-22T01:08:30.083Z'),
    criterion('full-moon-illumination-is-one', fullMoon?.illuminatedFraction === 1),
    criterion('events-follow-inclusive-start', events.every((event) => Date.parse(event.eventTimeIso) >= Date.parse(fixture.afterTimeIso))),
    criterion('invalid-phase-fails-loudly', invalidError instanceof TypeError),
    criterion('browser-runner-accepted-packet', latest?.status === 'accepted'),
    criterion('browser-created-no-three-scene', browserScene?.threeSceneCreated === false),
    criterion('node-browser-full-moon-packet-identical', JSON.stringify(browserFullMoon) === JSON.stringify(fullMoon)),
];
const status = criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Prove POC-local Moon phase-at-time and next principal-phase contracts from a
retained JPL Horizons fixture, then pass the identical normalized packets
through the existing browser runner without a network call or Three scene.
`);
await writeJson(recordDirectory, 'inputs.json', { stage: 'G0-next-and-at-time-moon-phase', fixturePath, afterTimeIso: fixture.afterTimeIso, atTimeIso: atTime.timeIso, phases });
await writeJson(recordDirectory, 'provenance.json', { fixture: fixture.provenance, rawQueryCount: fixture.rawQueries.length, runtimeLinkPolicy: 'browser-payload-only-no-browser-horizons' });
await writeJson(recordDirectory, 'equations-and-constants.json', {
    cycleAngle: 'normalizeDegrees(moonEclipticLongitude - sunEclipticLongitude)',
    illuminatedFraction: '(1 - cos(cycleAngle)) / 2',
    phaseAnglesDegrees: { new: 0, firstQuarter: 90, full: 180, lastQuarter: 270 },
    coarseStepMinutes: 360,
    refinementStepMinutes: 1,
});
await writeJson(recordDirectory, 'criteria-results.json', { status, criteria });
await writeJson(recordDirectory, 'diagnostics.json', { atTime, events, invalidPhaseError: summarizeError(invalidError), browserError, browserScene });
await writeJson(recordDirectory, 'command.json', { commands: [{ command: `node scripts/flat/reconciliation/POC/src/runners/m5MoonPhaseContract.js --record ${recordDirectory}`, timestamp: nowIso() }] });
await writeJson(recordDirectory, 'result.json', { status, atTime, events, browserStatus: latest?.status ?? 'unavailable', browserError });
await writeText(recordDirectory, 'report.md', `# Report

Status: **${status}**

- Phase at ${atTime.timeIso}: ${atTime.phaseName}, illuminated fraction ${atTime.illuminatedFraction}.
- Next full Moon: ${fullMoon.eventTimeIso}.
- Principal phase events resolved: ${events.length}.
- Browser runner: ${latest?.status ?? 'unavailable'}.
- Three scene created: ${browserScene?.threeSceneCreated ?? 'not-run'}.
`);
await appendRunLog(recordDirectory, `m5MoonPhaseContract ${status}.`);
console.log(JSON.stringify({ status, recordDirectory, nextFullMoon: fullMoon.eventTimeIso, browserStatus: latest?.status ?? 'unavailable', browserError }));

async function waitForWatcherResult(commandId) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 120000) {
        const candidate = await readJsonIfExists(resolve(watcherOutRoot, 'latest.json'));
        if (candidate?.command?.id === commandId) return candidate;
        await new Promise((done) => setTimeout(done, 750));
    }
    throw new Error(`Timed out waiting for browser command ${commandId}.`);
}

async function readJsonIfExists(path) {
    try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function criterion(name, accepted) { return Object.freeze({ name, status: accepted ? 'accepted' : 'rejected' }); }
function captureErrorAsync(action) { return action().then(() => null, (error) => error); }
function summarizeError(error) { return error ? { name: error.name, message: error.message } : null; }
