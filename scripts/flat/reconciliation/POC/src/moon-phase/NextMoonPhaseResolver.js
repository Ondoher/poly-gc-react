import MoonPhaseCalculator from './MoonPhaseCalculator.js';

export default class NextMoonPhaseResolver {
    constructor({ sampleProvider, calculator = new MoonPhaseCalculator() }) {
        if (!sampleProvider || typeof sampleProvider.sampleRange !== 'function') {
            throw new TypeError('NextMoonPhaseResolver requires a sampleProvider.');
        }
        this.sampleProvider = sampleProvider;
        this.calculator = calculator;
    }

    /**
     * Find the next named phase after the inclusive input timestamp.
     *
     * @param {object} request - Supplies phase, starting time, horizon, and resolution controls.
     * @returns {Promise<NextMoonPhaseResult>} The normalized phase event.
     */
    async resolve(request) {
        const afterTimeIso = validIso(request.afterTimeIso);
        const phase = request.phase;
        const targetDegrees = this.calculator.phaseDegrees(phase);
        const horizonDays = positive(request.horizonDays ?? 40, 'horizonDays');
        const coarseStepMinutes = positive(request.coarseStepMinutes ?? 360, 'coarseStepMinutes');
        const refinementStepMinutes = positive(request.refinementStepMinutes ?? 1, 'refinementStepMinutes');
        const stopTimeIso = new Date(Date.parse(afterTimeIso) + horizonDays * 86400000).toISOString();
        const coarse = await this.sampleProvider.sampleRange({ startTimeIso: afterTimeIso, stopTimeIso, stepMinutes: coarseStepMinutes });
        const bracket = findCrossing(coarse, targetDegrees);
        if (!bracket) throw new RangeError(`No ${phase} Moon was found within ${horizonDays} days.`);
        const refined = await this.sampleProvider.sampleRange({
            startTimeIso: bracket[0].timeIso,
            stopTimeIso: bracket[1].timeIso,
            stepMinutes: refinementStepMinutes,
        });
        const refinedBracket = findCrossing(refined, targetDegrees) ?? bracket;
        const eventTimeIso = interpolateCrossing(refinedBracket, targetDegrees);
        const provenance = mergeProvenance([...coarse, ...refined]);

        return Object.freeze({
            schemaVersion: 1,
            eventKind: 'moon-phase',
            phase,
            phaseDegrees: targetDegrees,
            eventTimeIso,
            illuminatedFraction: (1 - Math.cos(targetDegrees * Math.PI / 180)) / 2,
            search: Object.freeze({
                afterTimeIso,
                horizonDays,
                coarseStepMinutes,
                refinementStepMinutes,
                toleranceSeconds: refinementStepMinutes * 60,
            }),
            provenance,
        });
    }
}

function findCrossing(samples, targetDegrees) {
    if (!Array.isArray(samples) || samples.length < 2) return null;
    let previous = sampleWithUnwrapped(samples[0], samples[0].cycleAngleDegrees);
    let cycleBase = 0;
    for (let index = 1; index < samples.length; index += 1) {
        const sample = samples[index];
        if (sample.cycleAngleDegrees + cycleBase < previous.unwrappedDegrees - 180) cycleBase += 360;
        const current = sampleWithUnwrapped(sample, sample.cycleAngleDegrees + cycleBase);
        const target = targetDegrees + Math.ceil((previous.unwrappedDegrees - targetDegrees) / 360) * 360;
        if (target >= previous.unwrappedDegrees - 1e-9 && target <= current.unwrappedDegrees + 1e-9
            && Date.parse(current.timeIso) > Date.parse(samples[0].timeIso)) {
            return [previous, current];
        }
        previous = current;
    }
    return null;
}

function sampleWithUnwrapped(sample, unwrappedDegrees) {
    return Object.freeze({ ...sample, unwrappedDegrees });
}

function interpolateCrossing(bracket, targetDegrees) {
    const [first, second] = bracket;
    const target = targetDegrees + Math.round((first.unwrappedDegrees - targetDegrees) / 360) * 360;
    const fraction = (target - first.unwrappedDegrees) / (second.unwrappedDegrees - first.unwrappedDegrees);
    return new Date(Date.parse(first.timeIso) + fraction * (Date.parse(second.timeIso) - Date.parse(first.timeIso))).toISOString();
}

function mergeProvenance(samples) {
    const values = samples.map((sample) => sample.provenance);
    return Object.freeze({
        source: values[0].source,
        sourceVersion: values[0].sourceVersion,
        queryHashes: Object.freeze([...new Set(values.flatMap((value) => value.queryHashes))]),
        fetchedAtIso: values.map((value) => value.fetchedAtIso).sort().at(-1),
        normalizationVersion: values[0].normalizationVersion,
    });
}

function validIso(value) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new TypeError('afterTimeIso must be valid.');
    return new Date(value).toISOString();
}

function positive(value, name) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be positive.`);
    return value;
}
