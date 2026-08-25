const PHASE_DEGREES = Object.freeze({
    new: 0,
    'first-quarter': 90,
    full: 180,
    'last-quarter': 270,
});

export default class MoonPhaseCalculator {
    /**
     * Derive phase information from shared Earth-centered ecliptic vectors.
     *
     * @param {object} request - Supplies Moon/Sun vectors and packet provenance.
     * @returns {MoonPhaseAtTimeResult} The normalized phase result.
     */
    calculate(request) {
        const moonPositionKm = vector3(request.moonPositionKm, 'moonPositionKm');
        const sunPositionKm = vector3(request.sunPositionKm, 'sunPositionKm');
        const cycleAngleDegrees = positiveDegrees(
            longitudeDegrees(moonPositionKm) - longitudeDegrees(sunPositionKm),
        );
        const illuminatedFraction = (1 - Math.cos(cycleAngleDegrees * Math.PI / 180)) / 2;

        return Object.freeze({
            schemaVersion: 1,
            timeIso: validIso(request.timeIso),
            cycleAngleDegrees,
            illuminatedFraction,
            phaseName: phaseName(cycleAngleDegrees),
            waxing: cycleAngleDegrees > 0 && cycleAngleDegrees < 180,
            provenance: validateProvenance(request.provenance),
        });
    }

    /**
     * Return the canonical cycle angle for a named phase.
     *
     * @param {MoonPhaseKind} phase - Supplies the named phase.
     * @returns {number} The cycle angle in degrees.
     */
    phaseDegrees(phase) {
        if (!Object.hasOwn(PHASE_DEGREES, phase)) {
            throw new TypeError(`Unsupported Moon phase: ${String(phase)}.`);
        }
        return PHASE_DEGREES[phase];
    }
}

export function validateMoonPhaseAtTimeResult(value) {
    if (!value || value.schemaVersion !== 1) throw new TypeError('Moon phase packet schemaVersion must equal 1.');
    validIso(value.timeIso);
    finite(value.cycleAngleDegrees, 'cycleAngleDegrees');
    finite(value.illuminatedFraction, 'illuminatedFraction');
    if (value.cycleAngleDegrees < 0 || value.cycleAngleDegrees >= 360) throw new RangeError('cycleAngleDegrees must be in [0, 360).');
    if (value.illuminatedFraction < 0 || value.illuminatedFraction > 1) throw new RangeError('illuminatedFraction must be in [0, 1].');
    validateProvenance(value.provenance);
    return value;
}

export function validateNextMoonPhaseResult(value) {
    if (!value || value.schemaVersion !== 1 || value.eventKind !== 'moon-phase') throw new TypeError('Next Moon phase packet is invalid.');
    validIso(value.eventTimeIso);
    finite(value.phaseDegrees, 'phaseDegrees');
    finite(value.illuminatedFraction, 'illuminatedFraction');
    validateProvenance(value.provenance);
    return value;
}

function phaseName(angle) {
    if (angle < 22.5 || angle >= 337.5) return 'new';
    if (angle < 67.5) return 'waxing-crescent';
    if (angle < 112.5) return 'first-quarter';
    if (angle < 157.5) return 'waxing-gibbous';
    if (angle < 202.5) return 'full';
    if (angle < 247.5) return 'waning-gibbous';
    if (angle < 292.5) return 'last-quarter';
    return 'waning-crescent';
}

function longitudeDegrees(vector) {
    return Math.atan2(vector[1], vector[0]) * 180 / Math.PI;
}

function positiveDegrees(value) {
    return ((value % 360) + 360) % 360;
}

function vector3(value, name) {
    if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${name} must contain three values.`);
    return value.map((entry, index) => finite(entry, `${name}[${index}]`));
}

function validIso(value) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new TypeError('A valid ISO timestamp is required.');
    return new Date(value).toISOString();
}

function validateProvenance(value) {
    if (!value || typeof value.source !== 'string' || typeof value.sourceVersion !== 'string'
        || !Array.isArray(value.queryHashes) || typeof value.fetchedAtIso !== 'string'
        || typeof value.normalizationVersion !== 'string') {
        throw new TypeError('Complete Moon phase provenance is required.');
    }
    validIso(value.fetchedAtIso);
    return Object.freeze({ ...value, queryHashes: Object.freeze([...value.queryHashes]) });
}

function finite(value, name) {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite.`);
    return value;
}
