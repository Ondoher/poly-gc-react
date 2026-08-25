import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import GlobeMoonSceneRenderer from '../moon/GlobeMoonSceneRenderer.js';
import SubjectiveSceneTimeResolver from '../subjective-scenes/SubjectiveSceneTimeResolver.js';
import { appendRunLog, assert, nowIso, parseRecordDirectory, writeJson, writeText } from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const outputPath = resolve(recordDirectory, 'images', 'san-jose-globe-full-moon-off-center.png');
const runnerName = 'm5SanJoseGlobeFullMoonBitmap';
await appendRunLog(recordDirectory, `${runnerName} started.`);

const sceneTime = new SubjectiveSceneTimeResolver().resolve({
    locationKey: 'san-jose',
    timeBasis: 'globe',
    timePresetKey: 'globe-sunset',
    hourOffset: 24,
});
const renderResult = await new GlobeMoonSceneRenderer().render({
    outputPath,
    width: 640,
    height: 360,
    moonCenterNormalized: [0.72, 0.31],
    moonRadiusPixels: 34,
    lightingPreset: 'night',
});
const outputStats = await stat(outputPath);
const centerOffsetPixels = Math.hypot(
    renderResult.moonCenterPixels[0] - renderResult.frameCenterPixels[0],
    renderResult.moonCenterPixels[1] - renderResult.frameCenterPixels[1],
);

assert(sceneTime.location.key === 'san-jose' && sceneTime.timeBasis === 'globe', 'Scene must use San Jose globe calibration.');
assert(renderResult.phaseIlluminatedFraction === 1, 'Verification Moon must be full.');
assert(centerOffsetPixels > renderResult.moonRadiusPixels * 2, 'Moon must be visibly off-center.');
assert(renderResult.moonPixelCount > 0 && outputStats.size > 0, 'Bitmap must contain Moon pixels and be nonempty.');

const criteria = [
    criterion('san-jose-globe-calibration-used', sceneTime.location.key === 'san-jose' && sceneTime.timeBasis === 'globe'),
    criterion('full-moon-state-used', renderResult.phaseIlluminatedFraction === 1),
    criterion('moon-visible', renderResult.moonPixelCount > 0),
    criterion('moon-not-centered', centerOffsetPixels > renderResult.moonRadiusPixels * 2),
    criterion('png-written', outputStats.size > 0),
];
const status = criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Produce the first deterministic San Jose globe-model Moon verification bitmap.
Show a full Moon inside the frame but deliberately away from its center. This
is a CPU artifact and does not require the browser runner.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '5.1-san-jose-globe-full-moon-bitmap',
    sceneTimeRequest: { locationKey: 'san-jose', timeBasis: 'globe', timePresetKey: 'globe-sunset', hourOffset: 24 },
    moon: { phaseIlluminatedFraction: 1, centerNormalized: [0.72, 0.31], radiusPixels: 34 },
    viewportPixels: [640, 360],
});
await writeJson(recordDirectory, 'provenance.json', {
    runtimeLinkPolicy: 'poc-local-no-external-runtime-links',
    references: ['scripts/flat/reconciliation/POC/src/subjective-scenes/SubjectiveSceneTimeResolver.js'],
    limitation: 'Configured globe verification fixture; not yet an astronomical ephemeris position or atmosphere-transport integration.',
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    phaseIlluminatedFraction: 1,
    moonCenterNormalized: [0.72, 0.31],
    moonRadiusPixels: 34,
    fullMoonLighting: 'Moon-to-light direction is aligned with Moon-to-observer direction in the configured globe verification fixture.',
    offCenterMetric: 'distance(moonCenterPixels, frameCenterPixels)',
    occlusionRule: 'Moon sphere hit replaces background-star radiance for that pixel.',
});
await writeJson(recordDirectory, 'criteria-results.json', { status, criteria });
await writeJson(recordDirectory, 'diagnostics.json', { sceneTime, renderResult, centerOffsetPixels, outputSizeBytes: outputStats.size });
await writeJson(recordDirectory, 'command.json', { commands: [{ command: `node scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory}`, timestamp: nowIso() }] });
await writeJson(recordDirectory, 'result.json', { status, imagePath: outputPath, centerOffsetPixels, ...renderResult });
await writeText(recordDirectory, 'report.md', `# Report

Status: **${status}**

- Model: globe verification fixture
- Location: San Jose
- Calibrated time: ${sceneTime.finalTimeIso}
- Full-Moon illuminated fraction: 1
- Moon center: ${renderResult.moonCenterPixels.join(', ')} px
- Frame center: ${renderResult.frameCenterPixels.join(', ')} px
- Center offset: ${centerOffsetPixels.toFixed(2)} px
- Image: images/san-jose-globe-full-moon-off-center.png

This first image verifies framing, full-disk appearance, and foreground Moon
coverage over background stars. It does not yet prove ephemeris accuracy or
atmospheric transport.
`);
await appendRunLog(recordDirectory, `${runnerName} ${status}.`);
console.log(JSON.stringify({ status, recordDirectory, outputPath, centerOffsetPixels }));

function criterion(name, accepted) {
    return Object.freeze({ name, status: accepted ? 'accepted' : 'rejected' });
}
