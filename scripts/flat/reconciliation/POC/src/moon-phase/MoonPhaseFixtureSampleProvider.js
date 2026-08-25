import MoonPhaseCalculator from './MoonPhaseCalculator.js';

export default class MoonPhaseFixtureSampleProvider {
    constructor({ fixture, calculator = new MoonPhaseCalculator() }) {
        if (!fixture || !Array.isArray(fixture.samples)) throw new TypeError('A Moon phase fixture with samples is required.');
        this.fixture = fixture;
        this.calculator = calculator;
    }

    /**
     * Return fixture samples within the requested inclusive interval.
     *
     * @param {object} request - Supplies start and stop timestamps.
     * @returns {Promise<readonly MoonPhaseAtTimeResult[]>} The matching samples.
     */
    async sampleRange(request) {
        const start = Date.parse(request.startTimeIso);
        const stop = Date.parse(request.stopTimeIso);
        const candidates = this.fixture.samples.filter((sample) => {
            const time = Date.parse(sample.timeIso);
            return time >= start && time <= stop;
        });
        if (candidates.length < 2) throw new RangeError('Fixture does not contain enough samples for the requested range.');
        return Object.freeze(candidates.map((sample) => sample.cycleAngleDegrees === undefined
            ? this.calculator.calculate({ ...sample, provenance: this.fixture.provenance })
            : Object.freeze({ ...sample, provenance: this.fixture.provenance })));
    }
}
