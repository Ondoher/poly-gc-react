export default class GlobeMoonStateResolver {
    /**
     * Derive observer-relative Moon geometry from one shared celestial state.
     *
     * @param {object} request - Supplies world and observer packets.
     * @returns {GlobeMoonObservation} The derived observation.
     */
    resolve(request) {
        const world = validateCelestialWorldState(request.worldState);
        const observer = validateObserverState(request.observerState);
        const observerToMoon = subtract(world.moon.positionKm, observer.positionKm);
        const distanceKm = magnitude(observerToMoon);
        const moonToObserver = scale(observerToMoon, -1 / distanceKm);
        const moonToSun = normalize(subtract(world.sun.positionKm, world.moon.positionKm));
        const phaseAngleRadians = Math.acos(clamp(dot(moonToSun, moonToObserver), -1, 1));
        return Object.freeze({
            direction: Object.freeze(scale(observerToMoon, 1 / distanceKm)),
            distanceKm,
            angularRadiusRadians: Math.asin(world.moon.radiusKm / distanceKm),
            phaseAngleRadians,
            illuminatedFraction: (1 + Math.cos(phaseAngleRadians)) / 2,
        });
    }
}

export function validateCelestialWorldState(value) {
    if (!value || value.schemaVersion !== 1) throw new TypeError('CelestialWorldState schemaVersion must equal 1.');
    if (value.frame !== 'earth-centered-ecliptic-j2000' || value.units !== 'km-km-per-second') throw new TypeError('CelestialWorldState frame or units are unsupported.');
    validIso(value.epochIso);
    validateBody(value.moon, 'moon'); validateBody(value.sun, 'sun');
    if (!value.provenance || typeof value.provenance.sourceVersion !== 'string') throw new TypeError('CelestialWorldState provenance is required.');
    return value;
}

export function validateObserverState(value) {
    if (!value || value.schemaVersion !== 1 || typeof value.id !== 'string') throw new TypeError('GlobeObserverState is invalid.');
    vector(value.positionKm, 'observer.positionKm');
    for (const name of ['latitudeDegrees', 'longitudeDegrees', 'elevationKm']) finite(value[name], name);
    return value;
}

function validateBody(value, name) { if (!value) throw new TypeError(`${name} is required.`); vector(value.positionKm, `${name}.positionKm`); vector(value.velocityKmPerSecond, `${name}.velocityKmPerSecond`); if (finite(value.radiusKm, `${name}.radiusKm`) <= 0) throw new RangeError(`${name}.radiusKm must be positive.`); }
function vector(value, name) { if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw new TypeError(`${name} must be a finite vector3.`); return value; }
function finite(value, name) { if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite.`); return value; }
function validIso(value) { if (!Number.isFinite(Date.parse(value))) throw new TypeError('epochIso must be valid.'); }
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, value) { return [a[0] * value, a[1] * value, a[2] * value]; }
function magnitude(a) { return Math.hypot(...a); }
function normalize(a) { return scale(a, 1 / magnitude(a)); }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
