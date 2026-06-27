const DEFAULT_ANNUAL_PERIOD_DAYS = 365.2422;
const DEFAULT_NORTHERN_SOLSTICE_DAY_OF_YEAR = 172;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function finiteNumber(value, fallback = 0) {
	const number = Number(value);

	return Number.isFinite(number) ? number : fallback;
}

function dayOfYear(time) {
	if (typeof time === 'string') {
		const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(time);

		if (match) {
			const year = Number(match[1]);
			const monthIndex = Number(match[2]) - 1;
			const day = Number(match[3]);
			const start = Date.UTC(year, 0, 1);
			const current = Date.UTC(year, monthIndex, day);

			return Math.floor((current - start) / MS_PER_DAY) + 1;
		}
	}

	const date = time instanceof Date ? time : new Date(time);

	if (Number.isNaN(date.getTime())) {
		return DEFAULT_NORTHERN_SOLSTICE_DAY_OF_YEAR;
	}

	const start = Date.UTC(date.getUTCFullYear(), 0, 1);
	const current = Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate(),
	);

	return Math.floor((current - start) / MS_PER_DAY) + 1;
}

/**
 * Resolve the flat-model false Sun latitude for a configured date.
 *
 * @param {FlatSimulationSunConfig | object} sun - Provide the false-sun config.
 * @param {string | Date} time - Provide the scene simulation date/time.
 * @returns {number}
 */
export function resolveFalseSunLatitudeDeg(sun, time) {
	const model = sun?.latitude;

	if (!model || model.type === 'annual-tropic-migration') {
		const northLimitDeg = finiteNumber(model?.northLimitDeg, 23.5);
		const southLimitDeg = finiteNumber(model?.southLimitDeg, -23.5);
		const periodDays = finiteNumber(
			model?.periodDays,
			DEFAULT_ANNUAL_PERIOD_DAYS,
		);
		const northernSolsticeDayOfYear = finiteNumber(
			model?.northernSolsticeDayOfYear,
			DEFAULT_NORTHERN_SOLSTICE_DAY_OF_YEAR,
		);
		const amplitudeDeg = (northLimitDeg - southLimitDeg) / 2;
		const centerDeg = (northLimitDeg + southLimitDeg) / 2;
		const phase =
			(2 * Math.PI * (dayOfYear(time) - northernSolsticeDayOfYear)) /
			Math.max(periodDays, 1);

		return centerDeg + amplitudeDeg * Math.cos(phase);
	}

	if (model.type === 'fixed-latitude') {
		return finiteNumber(model.latitudeDeg);
	}

	throw new Error(`Unknown flat-simulation false Sun latitude model "${model.type}".`);
}
