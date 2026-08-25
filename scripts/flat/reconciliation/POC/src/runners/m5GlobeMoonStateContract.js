import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import GlobeMoonStateResolver, { validateCelestialWorldState, validateObserverState } from '../globe-moon/GlobeMoonStateResolver.js';
import GlobeMoonBody from '../globe-moon/GlobeMoonBody.js';
import { appendRunLog, nowIso, parseRecordDirectory, writeJson, writeText } from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv); const commandPath = resolve('scripts/flat/reconciliation/POC/browser-jobs/browser-command.json');
const fixturePath = resolve('scripts/flat/reconciliation/POC/src/globe-moon/fixtures/san-jose-2024-06-full-moon-state.json'); const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
await appendRunLog(recordDirectory, 'm5GlobeMoonStateContract started.');
const worldState = validateCelestialWorldState(fixture.worldState); const observerState = validateObserverState(fixture.observerState);
const observation = new GlobeMoonStateResolver().resolve({ worldState, observerState });
const body = new GlobeMoonBody({ centerKm: worldState.moon.positionKm, radiusKm: worldState.moon.radiusKm, opaque: true });
const hitRay = { originKm: observerState.positionKm, direction: observation.direction };
const missDirection = normalize([observation.direction[1], -observation.direction[0], observation.direction[2] * 0.2]);
const rays = [hitRay, { originKm: observerState.positionKm, direction: missDirection }]; const rayResults = rays.map((ray) => body.intersectRay(ray));
const command = { id: `m5-globe-moon-state-parity-${Date.now()}`, label: 'm5-globe-moon-state-parity', page: 'index.html', entrypoint: 'runReconciliationShaderJob', artifactRunDirectory: resolve(recordDirectory), status: 'pending', createdAt: new Date().toISOString(), payload: { jobType: 'globe-moon-state-parity', worldState, observerState, rays } };
await writeFile(commandPath, `${JSON.stringify(command, null, 2)}\n`, 'utf8'); const latest = await wait(command.id); const browser = latest?.result?.diagnostics?.scene;
const criteria = [
    criterion('world-state-valid', worldState.frame === 'earth-centered-ecliptic-j2000'), criterion('observer-state-valid', observerState.id === 'san-jose'),
    criterion('independent-observer-reconstructions-agree', observerState.validation.observerPositionAgreementKm < 1e-6), criterion('opposition-event-produces-near-full-geometry', observation.illuminatedFraction > 0.997 && observation.illuminatedFraction < 1),
    criterion('physical-angular-radius', observation.angularRadiusRadians > 0 && observation.angularRadiusRadians < 0.01), criterion('center-ray-hits-opaque-moon', rayResults[0].hit && rayResults[0].opaque),
    criterion('off-axis-ray-misses', !rayResults[1].hit), criterion('finite-depth-precedes-infinite-stars', rayResults[0].distanceKm > 0 && Number.isFinite(rayResults[0].distanceKm)),
    criterion('browser-runner-accepted', latest?.status === 'accepted'), criterion('browser-created-no-three-scene', browser?.threeSceneCreated === false),
    criterion('node-browser-observation-identical', JSON.stringify(browser?.observation) === JSON.stringify(observation)), criterion('node-browser-rays-identical', JSON.stringify(browser?.rayResults) === JSON.stringify(rayResults)),
]; const status = criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';
await writeText(recordDirectory, 'state-goal.md', '# State Goal\n\nProve the exact full-Moon shared world/observer packets, physical sphere intersections, finite depth, and existing-browser-runner geometry parity without rendering.\n');
await writeJson(recordDirectory, 'inputs.json', { stage: 'G1-globe-moon-state', fixturePath, epochIso: worldState.epochIso, observerId: observerState.id });
await writeJson(recordDirectory, 'provenance.json', fixture.provenance); await writeJson(recordDirectory, 'equations-and-constants.json', { angularRadius: 'asin(radius/distance)', illuminatedFraction: '(1+cos(phaseAngle))/2', raySphere: 'quadratic nearest nonnegative root' });
await writeJson(recordDirectory, 'criteria-results.json', { status, criteria }); await writeJson(recordDirectory, 'diagnostics.json', { observation, rayResults, browser });
await writeJson(recordDirectory, 'command.json', { commands: [{ command: `node scripts/flat/reconciliation/POC/src/runners/m5GlobeMoonStateContract.js --record ${recordDirectory}`, timestamp: nowIso() }] });
await writeJson(recordDirectory, 'result.json', { status, observation, rayResults, browserStatus: latest?.status }); await writeText(recordDirectory, 'report.md', `# Report\n\nStatus: **${status}**\n\n- Epoch: ${worldState.epochIso}\n- Distance: ${observation.distanceKm} km\n- Illuminated fraction: ${observation.illuminatedFraction}\n- Browser: ${latest?.status}\n- Three scene: false\n`);
await appendRunLog(recordDirectory, `m5GlobeMoonStateContract ${status}.`); console.log(JSON.stringify({ status, distanceKm: observation.distanceKm, illuminatedFraction: observation.illuminatedFraction, browserStatus: latest?.status }));

async function wait(id) { const start = Date.now(); while (Date.now() - start < 120000) { try { const value = JSON.parse(await readFile(resolve('tmp/atmosphere/reconciliation/latest.json'), 'utf8')); if (value?.command?.id === id) return value; } catch (error) { if (error.code !== 'ENOENT') throw error; } await new Promise((done) => setTimeout(done, 750)); } throw new Error('Browser watcher timed out.'); }
function criterion(name, value) { return { name, status: value ? 'accepted' : 'rejected' }; }
function normalize(a) { const m = Math.hypot(...a); return a.map((value) => value / m); }
