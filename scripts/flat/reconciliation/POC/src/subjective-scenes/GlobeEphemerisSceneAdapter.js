import GlobeMoonStateResolver from '../globe-moon/GlobeMoonStateResolver.js';

const J2000_MEAN_OBLIQUITY_RADIANS = 84381.448 / 3600 * Math.PI / 180;

export default class GlobeEphemerisSceneAdapter {
    /**
     * Transform one Horizons J2000 world/observer packet into Algorithm32's
     * observer-local `[up, east, north]` model frame.
     *
     * @param {{
     *   readonly ephemerisState: Readonly<Record<string, unknown>>,
     *   readonly flat32ApproximateSunDirectionModel?: readonly [number, number, number],
     *   readonly moonDirectionSceneOverride?: readonly [number, number, number],
     *   readonly moonDirectionOverrideId?: string
     * }} request - Ephemeris state and optional Flat32 source-direction comparison.
     * @returns {Readonly<Record<string, unknown>>} Observer-local Sun/Moon geometry.
     */
    resolve(request) {
        if (!request?.ephemerisState) {
            throw new TypeError('Globe ephemeris scene adaptation requires ephemerisState.');
        }

        const { worldState, observerState } = request.ephemerisState;
        const observation = new GlobeMoonStateResolver().resolve({ worldState, observerState });
        const basis = observerLocalBasis(observerState);
        const physicalMoonDirectionModel = directionToObserverLocal(observation.direction, basis);
        const observerToSun = subtract(worldState.sun.positionKm, observerState.positionKm);
        const sunDistanceKm = Math.hypot(...observerToSun);
        const sunDirectionJ2000 = normalize(observerToSun);
        const sunDirectionModel = directionToObserverLocal(sunDirectionJ2000, basis);
        const moonToSunJ2000 = normalize(subtract(
            worldState.sun.positionKm,
            worldState.moon.positionKm,
        ));
        const physicalMoonToSunDirectionModel = directionToObserverLocal(moonToSunJ2000, basis);
        const controlledMoonDirectionModel = request.moonDirectionSceneOverride
            ? sceneDirectionToModel(request.moonDirectionSceneOverride)
            : null;
        const moonDirectionModel = controlledMoonDirectionModel ?? physicalMoonDirectionModel;
        const moonToSunDirectionModel = controlledMoonDirectionModel
            ? rotateFromTo(
                physicalMoonToSunDirectionModel,
                physicalMoonDirectionModel,
                controlledMoonDirectionModel,
            )
            : physicalMoonToSunDirectionModel;
        const moonPresentationOverride = controlledMoonDirectionModel
            ? Object.freeze({
                id: request.moonDirectionOverrideId ?? 'controlled-moon-direction',
                astronomicalPosition: false,
                directionPolicy: 'controlled-presentation-frame-override',
                phasePolicy: 'shortest-arc-relative-light-rotation-preserves-ephemeris-phase-angle',
                limbPositionAnglePolicy: 'controlled-frame-dependent-not-ephemeris-preserved',
                physicalDirectionModel: physicalMoonDirectionModel,
                physicalDirectionScene: modelDirectionToScene(physicalMoonDirectionModel),
                controlledDirectionModel: moonDirectionModel,
                controlledDirectionScene: modelDirectionToScene(moonDirectionModel),
            })
            : null;
        const approximateSunDirection = request.flat32ApproximateSunDirectionModel;
        const flat32ApproximateSunAngularErrorRadians = Array.isArray(approximateSunDirection)
            ? angleBetween(sunDirectionModel, normalize(approximateSunDirection))
            : null;

        return Object.freeze({
            schemaVersion: 1,
            epochIso: worldState.epochIso,
            observerId: observerState.id,
            frame: 'algorithm32-observer-local-up-east-north',
            basis,
            observation,
            moon: Object.freeze({
                bodyId: moonPresentationOverride ? 'controlled-moon' : 'moon',
                radiusKm: worldState.moon.radiusKm,
                directionModel: moonDirectionModel,
                directionScene: modelDirectionToScene(moonDirectionModel),
                distanceKm: observation.distanceKm,
                angularRadiusRadians: observation.angularRadiusRadians,
                phaseAngleRadians: observation.phaseAngleRadians,
                illuminatedFraction: observation.illuminatedFraction,
                moonToSunDirectionModel,
                presentationOverride: moonPresentationOverride,
            }),
            sun: Object.freeze({
                bodyId: 'distant-sun',
                radiusKm: worldState.sun.radiusKm,
                distanceKm: sunDistanceKm,
                angularRadiusRadians: Math.asin(worldState.sun.radiusKm / sunDistanceKm),
                directionModel: sunDirectionModel,
                directionScene: modelDirectionToScene(sunDirectionModel),
                flat32ApproximateAngularErrorRadians: flat32ApproximateSunAngularErrorRadians,
            }),
            provenance: Object.freeze({
                source: worldState.provenance.source,
                sourceVersion: worldState.provenance.sourceVersion,
                sourceFrame: worldState.frame,
                transform: 'J2000 ecliptic to geodetic observer-local up/east/north',
                j2000MeanObliquityArcseconds: 84381.448,
                observerElevationKm: observerState.elevationKm,
                observerPositionAgreementKm:
                    observerState.validation?.observerPositionAgreementKm ?? null,
                moonPresentationOverride,
            }),
        });
    }
}

function observerLocalBasis(observerState) {
    const sineObliquity = Math.sin(J2000_MEAN_OBLIQUITY_RADIANS);
    const cosineObliquity = Math.cos(J2000_MEAN_OBLIQUITY_RADIANS);
    const pole = Object.freeze([0, sineObliquity, cosineObliquity]);
    const observer = observerState.positionKm;
    const equatorialProjection = subtract(observer, scale(pole, dot(observer, pole)));
    const q = normalize(equatorialProjection);
    const latitudeRadians = observerState.latitudeDegrees * Math.PI / 180;
    const up = normalize(add(
        scale(q, Math.cos(latitudeRadians)),
        scale(pole, Math.sin(latitudeRadians)),
    ));
    const east = normalize(cross(pole, q));
    const north = normalize(cross(up, east));

    return Object.freeze({ pole, equatorialRadial: q, up, east, north });
}

function directionToObserverLocal(direction, basis) {
    return normalize([
        dot(direction, basis.up),
        dot(direction, basis.east),
        dot(direction, basis.north),
    ]);
}

function modelDirectionToScene(direction) {
    return Object.freeze([direction[1], direction[0], -direction[2]]);
}

function sceneDirectionToModel(direction) {
    if (!Array.isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite)) {
        throw new TypeError('Moon scene-direction override must be a finite three-vector.');
    }

    return normalize([direction[1], direction[0], -direction[2]]);
}

function rotateFromTo(value, from, to) {
    const cosine = Math.min(1, Math.max(-1, dot(from, to)));
    if (cosine > 1 - 1e-14) {
        return normalize(value);
    }
    if (cosine < -1 + 1e-14) {
        const seed = Math.abs(from[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
        const axis = normalize(cross(from, seed));
        return normalize(value.map((entry, index) =>
            2 * axis[index] * dot(axis, value) - entry));
    }
    const axis = normalize(cross(from, to));
    const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
    const axisCrossValue = cross(axis, value);
    const axisProjection = dot(axis, value);

    return normalize(value.map((entry, index) =>
        entry * cosine
        + axisCrossValue[index] * sine
        + axis[index] * axisProjection * (1 - cosine)));
}

function add(left, right) {
    return left.map((value, index) => value + right[index]);
}

function subtract(left, right) {
    return left.map((value, index) => value - right[index]);
}

function scale(value, scalar) {
    return value.map((entry) => entry * scalar);
}

function dot(left, right) {
    return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function cross(left, right) {
    return [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ];
}

function normalize(value) {
    const length = Math.hypot(...value);
    if (!(length > 0)) {
        throw new RangeError('Cannot normalize a zero-length ephemeris vector.');
    }

    return Object.freeze(value.map((entry) => entry / length));
}

function angleBetween(left, right) {
    return Math.acos(Math.min(1, Math.max(-1, dot(left, right))));
}
