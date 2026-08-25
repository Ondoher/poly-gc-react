import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import GlobeMoonSceneRenderer from '../moon/GlobeMoonSceneRenderer.js';
import SubjectiveSceneTimeResolver from '../subjective-scenes/SubjectiveSceneTimeResolver.js';
import { appendRunLog, assert, nowIso, parseRecordDirectory, writeJson, writeText } from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const runnerName = 'm5SanJoseGlobeFullMoonSolarNoonBitmap';
const outputPath = resolve(recordDirectory, 'images', 'san-jose-globe-full-moon-off-center-solar-noon.png');
await appendRunLog(recordDirectory, `${runnerName} started.`);

const sceneTime = new SubjectiveSceneTimeResolver().resolve({
    locationKey: 'san-jose',
    timeBasis: 'globe',
    timePresetKey: 'globe-solar-noon',
});
const renderResult = await new GlobeMoonSceneRenderer().render({
    outputPath,
    width: 640,
    height: 360,
    moonCenterNormalized: [0.72, 0.31],
    moonRadiusPixels: 34,
    lightingPreset: 'solar-noon',
});
const outputStats = await stat(outputPath);
const centerOffsetPixels = Math.hypot(
    renderResult.moonCenterPixels[0] - renderResult.frameCenterPixels[0],
    renderResult.moonCenterPixels[1] - renderResult.frameCenterPixels[1],
);

assert(sceneTime.finalTimeIso === '2024-06-20T20:08:46.261Z', 'Scene must use calibrated San Jose solar noon.');
assert(renderResult.phaseIlluminatedFraction === 1, 'Controlled comparison must retain the same full disk.');
assert(centerOffsetPixels > renderResult.moonRadiusPixels * 2, 'Moon must retain the same off-center framing.');
assert(outputStats.size > 0, 'Solar-noon bitmap must be nonempty.');

const criteria = [
    criterion('san-jose-solar-noon-calibration-used', sceneTime.finalTimeIso === '2024-06-20T20:08:46.261Z'),
    criterion('same-full-moon-state-retained', renderResult.phaseIlluminatedFraction === 1),
    criterion('same-off-center-geometry-retained', centerOffsetPixels > renderResult.moonRadiusPixels * 2),
    criterion('daylight-suppresses-stars', renderResult.starPixelCount === 0),
    criterion('png-written', outputStats.size > 0),
];
const status = criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Render the exact camera, terrain, Moon size, Moon position, and full-disk state
from record 003 while changing the San Jose globe time basis to solar noon.
This is a controlled visibility comparison, not a valid full-Moon ephemeris.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '5.1-san-jose-globe-full-moon-solar-noon-controlled-comparison',
    sceneTimeRequest: { locationKey: 'san-jose', timeBasis: 'globe', timePresetKey: 'globe-solar-noon' },
    retainedGeometry: { viewportPixels: [640, 360], moonCenterNormalized: [0.72, 0.31], moonRadiusPixels: 34, phaseIlluminatedFraction: 1 },
    changedInput: { lightingPreset: 'solar-noon' },
});
await writeJson(recordDirectory, 'provenance.json', {
    comparisonRecord: 'tmp/atmosphere/reconciliation/003-m5-san-jose-globe-full-moon-bitmap',
    runtimeLinkPolicy: 'poc-local-no-external-runtime-links',
    limitation: 'Counterfactual controlled visibility fixture: a full Moon held above the horizon at globe solar noon is not an astronomical ephemeris claim.',
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    phaseIlluminatedFraction: 1,
    moonCenterNormalized: [0.72, 0.31],
    moonRadiusPixels: 34,
    controlledVariable: 'lightingPreset night -> solar-noon',
});
await writeJson(recordDirectory, 'criteria-results.json', { status, criteria });
await writeJson(recordDirectory, 'diagnostics.json', { sceneTime, renderResult, centerOffsetPixels, outputSizeBytes: outputStats.size });
await writeJson(recordDirectory, 'command.json', { commands: [{ command: `node scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory}`, timestamp: nowIso() }] });
await writeJson(recordDirectory, 'result.json', { status, imagePath: outputPath, centerOffsetPixels, ...renderResult });
await writeText(recordDirectory, 'report.md', `# Report

Status: **${status}**

The scene retains record 003 camera and Moon geometry while using calibrated
San Jose solar noon. It is a controlled visibility comparison, not a coherent
full-Moon ephemeris state.
`);
await appendRunLog(recordDirectory, `${runnerName} ${status}.`);
console.log(JSON.stringify({ status, recordDirectory, outputPath, centerOffsetPixels }));

function criterion(name, accepted) {
    return Object.freeze({ name, status: accepted ? 'accepted' : 'rejected' });
}
