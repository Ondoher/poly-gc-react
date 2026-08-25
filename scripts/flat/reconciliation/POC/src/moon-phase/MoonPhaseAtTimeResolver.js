export default class MoonPhaseAtTimeResolver {
    constructor({ sampleProvider }) {
        if (!sampleProvider || typeof sampleProvider.sampleRange !== 'function') throw new TypeError('A sampleProvider is required.');
        this.sampleProvider = sampleProvider;
    }

    /**
     * Resolve phase information nearest an exact timestamp.
     *
     * @param {object} request - Supplies the requested timestamp.
     * @returns {Promise<MoonPhaseAtTimeResult>} The nearest normalized sample.
     */
    async resolve(request) {
        const target = new Date(request.timeIso);
        if (!Number.isFinite(target.getTime())) throw new TypeError('timeIso must be valid.');
        const samples = await this.sampleProvider.sampleRange({
            startTimeIso: new Date(target.getTime() - 60000).toISOString(),
            stopTimeIso: new Date(target.getTime() + 60000).toISOString(),
            stepMinutes: 1,
        });
        return samples.reduce((closest, sample) => Math.abs(Date.parse(sample.timeIso) - target.getTime())
            < Math.abs(Date.parse(closest.timeIso) - target.getTime()) ? sample : closest);
    }
}
