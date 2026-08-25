// References:
// - agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md.
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md.

import { readFile } from 'node:fs/promises';

import SubjectiveSceneTimeResolver from '../subjective-scenes/SubjectiveSceneTimeResolver.js';
import {
    FLAT32_SUBJECTIVE_FLAT_TIME_PRESETS,
    FLAT32_SUBJECTIVE_GLOBE_TIME_PRESETS,
    FLAT32_SUBJECTIVE_LOCATION_PRESETS,
    FLAT32_SUBJECTIVE_TIME_SNAPSHOT,
} from '../subjective-scenes/consts.js';
import {
    appendRunLog,
    assert,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const runnerName = 'm5SubjectiveSceneTimeContract';

await appendRunLog(recordDirectory, `${runnerName} started.`);

const resolver = new SubjectiveSceneTimeResolver();
const sanJoseNoon = resolver.resolve({
    locationKey: 'san-jose',
    timeBasis: 'globe',
    timePresetKey: 'globe-solar-noon',
});
const sanJoseSunset = resolver.resolve({
    locationKey: 'san-jose',
    timeBasis: 'globe',
    timePresetKey: 'globe-sunset',
});
const sanJosePostSunset = resolver.resolve({
    locationKey: 'san-jose',
    timeBasis: 'globe',
    timePresetKey: 'globe-sunset',
    hourOffset: 1,
});
const sanJoseFlatZero = resolver.resolve({
    locationKey: 'san-jose',
    timeBasis: 'flat',
    timePresetKey: 'flat-0',
});
const sanJoseFlatNinety = resolver.resolve({
    locationKey: 'san-jose',
    timeBasis: 'flat',
    timePresetKey: 'flat-90',
});
const unionGlacierNoon = resolver.resolve({
    locationKey: 'union-glacier',
    timeBasis: 'globe',
    timePresetKey: 'globe-solar-noon',
});
const unionGlacierSunset = resolver.resolve({
    locationKey: 'union-glacier',
    timeBasis: 'globe',
    timePresetKey: 'globe-sunset',
});
const unionGlacierFlatOneEighty = resolver.resolve({
    locationKey: 'union-glacier',
    timeBasis: 'flat',
    timePresetKey: 'flat-180',
});

const sourceText = await readFile(
    new URL('../subjective-scenes/SubjectiveSceneTimeResolver.js', import.meta.url),
    'utf8',
);
const runtimeImports = [...sourceText.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
const invalidBasisError = captureError(() => resolver.resolve({
    locationKey: 'san-jose',
    timeBasis: 'sidereal',
    timePresetKey: 'globe-solar-noon',
}));

assert(FLAT32_SUBJECTIVE_LOCATION_PRESETS.map((preset) => preset.key).join(',')
    === 'san-jose,union-glacier', 'The snapshot must contain only the two requested flat32 locations.');
assert(sanJoseNoon.synchronizedTimeIso === '2024-06-20T20:08:46.261Z',
    'San Jose synchronized solar noon must match the captured flat32 calibration.');
assert(sanJoseSunset.finalTimeIso === '2024-06-21T03:26:03.503Z',
    'San Jose sunset must match the captured flat32 calibration.');
assert(millisecondsBetween(sanJoseSunset.finalTimeIso, sanJosePostSunset.finalTimeIso) === 60 * 60 * 1000,
    'Post-sunset explicit adjustment must apply after the globe basis resolves sunset.');
assert(sanJoseFlatZero.synchronizedTimeIso === sanJoseFlatZero.basisResolvedTimeIso,
    'Flat zero basis must preserve the synchronized time.');
assert(millisecondsBetween(sanJoseFlatZero.finalTimeIso, sanJoseFlatNinety.finalTimeIso) === 6 * 60 * 60 * 1000,
    'Flat 90 must apply a six-hour basis adjustment after synchronization.');
assert(unionGlacierNoon.finalTimeIso === '2024-12-14T17:27:41.487Z',
    'Union Glacier synchronized solar noon must match the captured flat32 calibration.');
assert(unionGlacierSunset.eventAvailability.status === 'unavailable'
    && unionGlacierSunset.eventAvailability.fallbackReason === 'polar-day'
    && unionGlacierSunset.finalTimeIso === unionGlacierSunset.synchronizedTimeIso,
    'Union Glacier sunset must report polar daylight and fall back to synchronized solar noon.');
assert(millisecondsBetween(
    unionGlacierNoon.finalTimeIso,
    unionGlacierFlatOneEighty.finalTimeIso,
) === 12 * 60 * 60 * 1000,
    'Union Glacier flat 180 must remain an explicitly labeled flat-basis darkening adjustment.');
assert(runtimeImports.length === 1 && runtimeImports[0] === './consts.js',
    'The POC resolver must not runtime-link flat32 or production code.');
assert(invalidBasisError instanceof TypeError && /Unsupported subjective scene time basis/.test(invalidBasisError.message),
    'Unsupported time bases must fail loudly.');

const diagnostics = Object.freeze({
    runtimeImports: Object.freeze(runtimeImports),
    resolutions: Object.freeze({
        sanJoseNoon,
        sanJoseSunset,
        sanJosePostSunset,
        sanJoseFlatZero,
        sanJoseFlatNinety,
        unionGlacierNoon,
        unionGlacierSunset,
        unionGlacierFlatOneEighty,
    }),
    invalidBasisError: summarizeError(invalidBasisError),
});
const criteria = Object.freeze([
    criterion('snapshot-contains-requested-flat32-locations',
        FLAT32_SUBJECTIVE_LOCATION_PRESETS.length === 2),
    criterion('san-jose-synchronization-matches-captured-calibration',
        sanJoseNoon.synchronizedTimeIso === '2024-06-20T20:08:46.261Z'),
    criterion('san-jose-globe-sunset-resolves-after-synchronization',
        sanJoseSunset.finalTimeIso === '2024-06-21T03:26:03.503Z'
        && sanJoseSunset.eventAvailability.status === 'available'),
    criterion('explicit-offset-applies-after-globe-basis',
        sanJosePostSunset.basisResolvedTimeIso === sanJoseSunset.basisResolvedTimeIso
        && millisecondsBetween(sanJoseSunset.finalTimeIso, sanJosePostSunset.finalTimeIso) === 60 * 60 * 1000),
    criterion('flat-basis-adjusts-synchronized-time',
        sanJoseFlatZero.synchronizedTimeIso === sanJoseFlatZero.basisResolvedTimeIso
        && millisecondsBetween(sanJoseFlatZero.finalTimeIso, sanJoseFlatNinety.finalTimeIso) === 6 * 60 * 60 * 1000),
    criterion('union-glacier-polar-day-fallback-is-explicit',
        unionGlacierSunset.eventAvailability.fallbackReason === 'polar-day'
        && unionGlacierSunset.finalTimeIso === unionGlacierSunset.synchronizedTimeIso),
    criterion('union-glacier-flat-darkening-remains-labeled-flat',
        unionGlacierFlatOneEighty.timeBasis === 'flat'
        && unionGlacierFlatOneEighty.basisAdjustment.offsetDegrees === 180),
    criterion('resolver-has-no-external-runtime-links',
        runtimeImports.length === 1 && runtimeImports[0] === './consts.js'),
    criterion('unsupported-time-basis-fails-loudly', invalidBasisError instanceof TypeError),
]);
const status = criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Create a self-contained Milestone 5 subjective-scene time contract inside the
reconciliation POC. The contract must snapshot the requested San Jose and Union
Glacier Camp scene facts, synchronize location/date first, apply the selected
time basis second, apply explicit offsets last, and runtime-link no flat32 or
production code.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '5.0-subjective-scene-time-contract',
    runner: runnerName,
    snapshot: FLAT32_SUBJECTIVE_TIME_SNAPSHOT,
    locations: FLAT32_SUBJECTIVE_LOCATION_PRESETS,
    flatTimePresets: FLAT32_SUBJECTIVE_FLAT_TIME_PRESETS,
    globeTimePresets: FLAT32_SUBJECTIVE_GLOBE_TIME_PRESETS,
});
await writeJson(recordDirectory, 'provenance.json', {
    snapshot: FLAT32_SUBJECTIVE_TIME_SNAPSHOT,
    references: Object.freeze([
        'src/flat32/index.js @ 514d5f6080d2dd485efdb07b5da9a203357a40c0',
        'shared/algorithm32/production/light-sources/FlatSynchronizer.js @ 514d5f6080d2dd485efdb07b5da9a203357a40c0',
        'agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md',
        'agents/topics/apps/flat/reconciliation/experimental-guidelines.md',
    ]),
    runtimeLinkPolicy: 'reference-only-no-runtime-link',
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    synchronization: 'world solar-noon anchor + normalized closest-longitude orbit angle',
    flatBasis: 'basis time = synchronized time + normalized offsetDegrees / 360 * 24 hours',
    globeBasis: 'cos(hourAngle) = -tan(latitude) * tan(solarDeclination)',
    explicitAdjustment: 'final time = basis-resolved time + hourOffset + minuteOffset',
    millisecondsPerDay: 24 * 60 * 60 * 1000,
    degreesPerOrbit: 360,
});
await writeJson(recordDirectory, 'criteria-results.json', { status, criteria });
await writeJson(recordDirectory, 'diagnostics.json', diagnostics);
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([Object.freeze({
        command: `node scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    })]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    acceptedCriteriaCount: criteria.filter((entry) => entry.status === 'accepted').length,
    criteriaCount: criteria.length,
});
await writeText(recordDirectory, 'report.md', `# Report

Milestone 5 subjective-scene time contract status: **${status}**.

- The POC snapshot contains only San Jose and Union Glacier Camp.
- Location/date synchronization occurs before flat or globe basis adjustment.
- Explicit hour/minute offsets apply after the selected basis.
- San Jose solar noon and sunset match the captured flat32 calibration.
- Union Glacier's December sunset is explicitly unavailable because of polar
  daylight and falls back to synchronized solar noon.
- Flat 180 remains available as a labeled flat-time darkening view for Union
  Glacier; it is not described as a geographical sunset.
- The resolver imports only its POC-local constants and has no runtime link to
  flat32 or production code.
`);
await appendRunLog(recordDirectory, `${runnerName} ${status} criteria=${criteria.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    criteriaCount: criteria.length,
    sanJoseSunset: sanJoseSunset.finalTimeIso,
    unionGlacierSunsetAvailability: unionGlacierSunset.eventAvailability,
}));

/**
 * Create a criterion result.
 *
 * @param {string} name - Supplies the criterion name.
 * @param {boolean} accepted - Supplies whether the criterion passed.
 * @returns {{ readonly name: string, readonly status: 'accepted' | 'rejected' }} The criterion row.
 */
function criterion(name, accepted) {
    return Object.freeze({ name, status: accepted ? 'accepted' : 'rejected' });
}

/**
 * Resolve the positive duration between two ISO times.
 *
 * @param {string} firstIso - Supplies the earlier time.
 * @param {string} secondIso - Supplies the later time.
 * @returns {number} The duration in milliseconds.
 */
function millisecondsBetween(firstIso, secondIso) {
    return new Date(secondIso).getTime() - new Date(firstIso).getTime();
}

/**
 * Capture a synchronous error.
 *
 * @param {() => unknown} action - Supplies the action to run.
 * @returns {Error | null} The captured error.
 */
function captureError(action) {
    try {
        action();
        return null;
    } catch (error) {
        return error;
    }
}

/**
 * Summarize an error for JSON diagnostics.
 *
 * @param {Error | null} error - Supplies the captured error.
 * @returns {{ readonly name: string | null, readonly message: string | null }} The diagnostic summary.
 */
function summarizeError(error) {
    return Object.freeze({
        name: error?.name ?? null,
        message: error?.message ?? null,
    });
}
