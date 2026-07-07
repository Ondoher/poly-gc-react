// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.1 flat geometry.
// - agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md, ext-002, ext-003, ext-011, ext-014, ext-015, ext-018.
// - tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership.
// - tmp/atmosphere/reconciliation/037-m2-coordinate-warning-fix-check.
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, Geometry Ray-Length Resolution.

import * as THREE from 'three';

import { addScaled, clamp, dot, isFiniteVector3, magnitude, normalize, scale } from '../math/vector.js';
import ExactFlatGroundObject from '../three/ExactFlatGroundObject.js';

const EPSILON = 1e-9;
const FLAT_OBSERVER_LOCAL_SCENE_FRAME = Object.freeze({
    up: Object.freeze([0, 0, 1]),
    right: Object.freeze([1, 0, 0]),
    forward: Object.freeze([0, -1, 0]),
});

export default class FlatEarthGeometry {
    /**
     * @param {FlatEarthGeometryConfig} configuration - Flat z-up geometry configuration.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new TypeError('FlatEarthGeometry configuration is required.');
        }

        const {
            observerPositionMeters = [0, 0, 2],
            sourcePositionMeters,
            topAltitudeMeters,
            sceneSkyRayLimitMeters = null,
            observerCenteredDome = null,
            sourceTransmittanceIntervalCount = 10,
            cacheZBinsMeters = [0],
            cacheRhoBinsMeters = [0],
            runtimeDiagnosticLimit = 50,
        } = configuration;

        if (!isFiniteVector3(observerPositionMeters) || !isFiniteVector3(sourcePositionMeters)) {
            throw new TypeError('FlatEarthGeometry requires finite observer and source positions.');
        }

        if (!Number.isFinite(topAltitudeMeters) || topAltitudeMeters <= 0) {
            throw new RangeError('FlatEarthGeometry requires a positive supplied topAltitudeMeters.');
        }

        this._configuration = Object.freeze({
            observerPositionMeters: Object.freeze([...observerPositionMeters]),
            sourcePositionMeters: Object.freeze([...sourcePositionMeters]),
            sourceSubpointMeters: Object.freeze([sourcePositionMeters[0], sourcePositionMeters[1], 0]),
            topAltitudeMeters,
            sceneSkyRayLimitMeters,
            observerCenteredDome: buildObserverCenteredDomeDescriptor(observerPositionMeters, observerCenteredDome),
            sourceTransmittanceIntervalCount,
            cacheZBinsMeters: Object.freeze([...cacheZBinsMeters]),
            cacheRhoBinsMeters: Object.freeze([...cacheRhoBinsMeters]),
            runtimeDiagnosticLimit,
            cacheRadialAxis: buildCacheRadialAxis(observerPositionMeters, sourcePositionMeters),
            observerLocalSceneFrame: FLAT_OBSERVER_LOCAL_SCENE_FRAME,
        });
        this._runtimeDiagnostics = [];
    }

    get configuration() {
        return this._configuration;
    }

    get runtimeDiagnostics() {
        return Object.freeze([...this._runtimeDiagnostics]);
    }

    /**
     * @param {{
     *   readonly raySegment?: RaySegment,
     *   readonly ray?: Ray,
     *   readonly origin?: Position,
     *   readonly direction?: UnitVector3,
     *   readonly viewDirection?: UnitVector3,
     *   readonly endDistanceMeters?: number,
     *   readonly maxDistanceMeters?: number
     * }} request - View ray request.
     * @returns {RaySegment} Clipped finite view ray segment.
     */
    resolveViewRaySegment(request = {}) {
        if (request.raySegment) {
            return request.raySegment;
        }

        const origin = request.origin
            ?? request.ray?.origin
            ?? this._configuration.observerPositionMeters;
        const direction = normalize(request.direction ?? request.viewDirection ?? request.ray?.direction ?? [0, 0, 1]);

        if (!isFiniteVector3(origin)) {
            throw new TypeError('Flat view ray origin must be a finite Position.');
        }

        let endDistanceMeters = this._resolveFlatExitDistance(origin, direction, 'view-ray');

        if (
            !this._configuration.observerCenteredDome
            && Number.isFinite(this._configuration.sceneSkyRayLimitMeters)
        ) {
            endDistanceMeters = Math.min(endDistanceMeters, this._configuration.sceneSkyRayLimitMeters);
        }

        const requestedEndDistanceMeters = Number.isFinite(request.endDistanceMeters)
            ? request.endDistanceMeters
            : request.maxDistanceMeters;

        if (Number.isFinite(requestedEndDistanceMeters)) {
            endDistanceMeters = Math.min(endDistanceMeters, requestedEndDistanceMeters);
        }

        return Object.freeze({
            ray: Object.freeze({
                origin: Object.freeze([...origin]),
                direction,
            }),
            startDistanceMeters: 0,
            endDistanceMeters: Math.max(0, endDistanceMeters),
        });
    }

    /**
     * @param {Position} position - Flat model-space position.
     * @returns {AtmosphereCoordinate} Altitude-only atmosphere coordinate.
     */
    resolveAtmosphereCoordinate(position) {
        if (!isFiniteVector3(position)) {
            this._diagnose('flat-atmosphere-coordinate-non-finite', 'error',
                'Flat atmosphere coordinate received a non-finite position.', { position });

            return Object.freeze({ altitudeMeters: 0 });
        }

        const altitudeMeters = position[2];

        if (altitudeMeters < -EPSILON || altitudeMeters > this._configuration.topAltitudeMeters + EPSILON) {
            this._diagnose('flat-atmosphere-coordinate-out-of-domain', 'warning',
                'Flat atmosphere coordinate is outside the supplied atmosphere/profile domain.', {
                    altitudeMeters,
                    topAltitudeMeters: this._configuration.topAltitudeMeters,
                });
        }

        return Object.freeze({ altitudeMeters });
    }

    /**
     * @param {{
     *   readonly startPosition?: Position,
     *   readonly direction?: UnitVector3,
     *   readonly ray?: Ray,
     *   readonly startDistanceMeters?: number,
     *   readonly endDistanceMeters?: number,
     *   readonly sourcePathLimit?: SourcePathLimit,
     *   readonly sampleCount?: number
     * }} request - Source or incident path request.
     * @returns {AtmospherePath} Geometry-resolved atmosphere path.
     */
    resolveAtmospherePath(request = {}) {
        const ray = request.ray ?? Object.freeze({
            origin: request.startPosition,
            direction: normalize(request.direction),
        });

        if (!ray?.origin || !ray?.direction) {
            throw new TypeError('resolveAtmospherePath requires a ray or startPosition/direction.');
        }

        const startDistanceMeters = request.startDistanceMeters ?? 0;
        const sourceLimitMeters = request.sourcePathLimit?.maxDistanceMeters;
        const explicitEndDistanceMeters = Number.isFinite(request.endDistanceMeters)
            ? request.endDistanceMeters
            : null;
        let candidateEndDistanceMeters = explicitEndDistanceMeters
            ?? (Number.isFinite(sourceLimitMeters) ? sourceLimitMeters : null);
        const topDistance = this.distanceToTopAtmosphereBoundary(ray.origin, ray.direction);
        const groundDistance = this.distanceToGroundBoundary(ray.origin, ray.direction);
        const domeDistance = this.distanceToObserverCenteredDomeBoundary(ray.origin, ray.direction);

        if (
            groundDistance !== null
            && groundDistance >= startDistanceMeters
            && (candidateEndDistanceMeters === null || groundDistance < candidateEndDistanceMeters)
        ) {
            return this._blockedPath(ray.origin, 'ground-before-source-or-exit', {
                groundDistanceMeters: groundDistance,
                sourceLimitMeters,
            });
        }

        for (const domainDistance of [topDistance, domeDistance]) {
            if (
                domainDistance !== null
                && domainDistance >= startDistanceMeters
                && (candidateEndDistanceMeters === null || domainDistance < candidateEndDistanceMeters)
            ) {
                candidateEndDistanceMeters = domainDistance;
            }
        }

        if (candidateEndDistanceMeters === null) {
            candidateEndDistanceMeters = this._configuration.sceneSkyRayLimitMeters;
            this._diagnose('flat-atmosphere-path-unbounded', 'warning',
                'Flat atmosphere path had no top, ground, or finite source limit; using scene cap as safe path length.', {
                    sceneSkyRayLimitMeters: candidateEndDistanceMeters,
                });
        }

        if (!Number.isFinite(candidateEndDistanceMeters)) {
            this._diagnose('flat-atmosphere-path-non-finite', 'error',
                'Flat atmosphere path could not resolve a finite distance; returning zero-length path.', {});

            return this._zeroLengthPath(ray.origin, 'non-finite-path');
        }

        const endDistanceMeters = Math.max(startDistanceMeters, candidateEndDistanceMeters);
        const sampleCount = request.sampleCount
            ?? this._configuration.sourceTransmittanceIntervalCount;
        const samples = this._buildAtmospherePathSamples(ray, startDistanceMeters, endDistanceMeters, sampleCount);
        const start = samples[0]?.atmosphereCoordinate ?? this.resolveAtmosphereCoordinate(ray.origin);
        const end = samples[samples.length - 1]?.atmosphereCoordinate ?? start;

        return Object.freeze({
            start,
            end,
            lengthMeters: Math.max(0, endDistanceMeters - startDistanceMeters),
            samples,
            metadata: Object.freeze({
                startDistanceMeters,
                endDistanceMeters,
                topDistanceMeters: topDistance,
                domeDistanceMeters: domeDistance,
                groundDistanceMeters: groundDistance,
                sourceLimitMeters,
            }),
        });
    }

    /**
     * @param {{ readonly position: Position }} request - Source-relative request.
     * @returns {SourceRelativePosition} Local source relation packet.
     */
    resolveSourceRelativePosition(request = {}) {
        if (!request.position) {
            throw new TypeError('resolveSourceRelativePosition requires position.');
        }

        const toSource = subtract(this._configuration.sourcePositionMeters, request.position);
        const distanceFromSourceMeters = magnitude(toSource);
        const directionToSource = distanceFromSourceMeters > EPSILON
            ? scale(toSource, 1 / distanceFromSourceMeters)
            : Object.freeze([0, 0, 1]);
        const sourceSubpointDelta = subtractHorizontal(request.position, this._configuration.sourceSubpointMeters);

        if (distanceFromSourceMeters <= EPSILON) {
            this._diagnose('flat-source-relative-zero-distance', 'error',
                'Path sample landed on the local source position; using safe upward direction.', {
                    position: request.position,
                });
        }

        return Object.freeze({
            directionFromSource: scale(directionToSource, -1),
            directionToSource,
            distanceFromSourceMeters,
            radialDistanceFromSourceSubpointMeters: magnitude(sourceSubpointDelta),
            altitudeMeters: request.position[2],
            metadata: Object.freeze({
                sourcePositionMeters: this._configuration.sourcePositionMeters,
                sourceSubpointMeters: this._configuration.sourceSubpointMeters,
            }),
        });
    }

    /**
     * @param {{
     *   readonly atmosphereCoordinate?: AtmosphereCoordinate,
     *   readonly position?: Position,
     *   readonly sourceRelativePosition?: SourceRelativePosition
     * }} request - Runtime cache access request.
     * @returns {CacheAccess} Local cache z/rho access packet.
     */
    resolveCacheAccess(request = {}) {
        const position = request.position;
        const atmosphereCoordinate = request.atmosphereCoordinate
            ?? (position ? this.resolveAtmosphereCoordinate(position) : null);
        const altitudeMeters = request.sourceRelativePosition?.altitudeMeters
            ?? atmosphereCoordinate?.altitudeMeters;
        const rhoMeters = request.sourceRelativePosition?.radialDistanceFromSourceSubpointMeters
            ?? (position ? magnitude(subtractHorizontal(position, this._configuration.sourceSubpointMeters)) : 0);
        const zBinIndex = this._nearestBinIndex(
            this._configuration.cacheZBinsMeters,
            altitudeMeters,
            'z',
        );
        const rhoBinIndex = this._nearestBinIndex(
            this._configuration.cacheRhoBinsMeters,
            rhoMeters,
            'rho',
        );

        return Object.freeze({
            cacheKey: `z:${zBinIndex}/rho:${rhoBinIndex}`,
            coordinates: Object.freeze([zBinIndex, rhoBinIndex]),
            metadata: Object.freeze({
                altitudeMeters,
                rhoMeters,
                zBinIndex,
                rhoBinIndex,
                coordinateSystem: 'local-source-z-rho',
            }),
        });
    }

    /**
     * @param {unknown} point - Observer-local Three-style scene point.
     * @param {{ readonly metersPerSceneUnit?: number, readonly scaleDenominator?: number }} [request]
     *   Scene unit conversion request.
     * @returns {Position} Model-space position in flat Algorithm32 meters.
     */
    mapObserverLocalScenePointToModelPosition(point, request = {}) {
        const vector = vector3Tuple(point, 'Observer-local scene point');
        const metersPerSceneUnit = metersPerSceneUnitFromRequest(request);
        const observer = this._configuration.observerPositionMeters;

        return Object.freeze([
            observer[0] + vector[0] * metersPerSceneUnit,
            observer[1] - vector[2] * metersPerSceneUnit,
            vector[1] * metersPerSceneUnit,
        ]);
    }

    /**
     * @param {unknown} direction - Observer-local Three-style scene direction.
     * @returns {UnitVector3} Model-space direction.
     */
    mapObserverLocalSceneDirectionToModelDirection(direction) {
        const vector = vector3Tuple(direction, 'Observer-local scene direction');

        return normalize([
            vector[0],
            -vector[2],
            vector[1],
        ]);
    }

    /**
     * @param {unknown} position - Model-space position in flat Algorithm32 meters.
     * @param {{ readonly metersPerSceneUnit?: number, readonly scaleDenominator?: number }} [request]
     *   Scene unit conversion request.
     * @returns {Position} Observer-local Three-style scene point.
     */
    mapModelPositionToObserverLocalScenePoint(position, request = {}) {
        const vector = vector3Tuple(position, 'Model-space position');
        const metersPerSceneUnit = metersPerSceneUnitFromRequest(request);

        return this._modelPositionToObserverLocalScenePoint(vector, metersPerSceneUnit);
    }

    /**
     * @param {GeometryThreeEndpointObjectsRequest} request - Three endpoint object request.
     * @returns {GeometryThreeEndpointObjects} Geometry-owned Three endpoint objects.
     */
    createThreeEndpointObjects(request = {}) {
        const metersPerSceneUnit = metersPerSceneUnitFromRequest(request);
        const groundExtentMeters = flatGroundExtentMeters(this._configuration);
        const widthSceneUnits = groundExtentMeters / metersPerSceneUnit;
        const depthSceneUnits = groundExtentMeters / metersPerSceneUnit;
        const centerSceneUnits = this._modelPositionToObserverLocalScenePoint(
            [
                this._configuration.observerPositionMeters[0],
                this._configuration.observerPositionMeters[1],
                0,
            ],
            metersPerSceneUnit,
        );
        const spectralReferenceId = request.spectralReferenceId ?? 'diagnostic-flat-ground-object-matte';
        const visualMaterialDisplayRgba = displayRgbaOrNull(request.visualMaterialDisplayRgba);
        const visualMaterialColor = visualMaterialDisplayRgba
            ? new THREE.Color(
                visualMaterialDisplayRgba[0] / 255,
                visualMaterialDisplayRgba[1] / 255,
                visualMaterialDisplayRgba[2] / 255,
            )
            : request.visualMaterialColor ?? 0x566942;
        const visualMaterial = request.visualMaterialLighting === 'lambert'
            ? new THREE.MeshLambertMaterial({
                color: visualMaterialColor,
                side: THREE.DoubleSide,
            })
            : new THREE.MeshBasicMaterial({
                color: visualMaterialColor,
                side: THREE.DoubleSide,
            });
        const widthSegments = request.widthSegments ?? 32;
        const heightSegments = request.heightSegments ?? 32;
        const visualObject = new THREE.Mesh(
            new THREE.PlaneGeometry(
                widthSceneUnits,
                depthSceneUnits,
                widthSegments,
                heightSegments,
            ),
            visualMaterial,
        );
        const raycastObject = new ExactFlatGroundObject({
            centerSceneUnits,
            widthSceneUnits,
            depthSceneUnits,
            metersPerSceneUnit,
            spectralReferenceId,
            name: request.name ?? 'flat-earth-ground-endpoint',
        });

        visualObject.name = `${request.name ?? 'flat-earth-ground'}-visual`;
        visualObject.rotation.x = -Math.PI / 2;
        visualObject.position.set(centerSceneUnits[0], centerSceneUnits[1], centerSceneUnits[2]);
        visualObject.userData.spectralReferenceId = spectralReferenceId;
        visualObject.userData.endpointKind = 'geometry-ground-boundary-visual';
        visualObject.userData.metersPerSceneUnit = metersPerSceneUnit;
        visualObject.updateMatrixWorld(true);
        raycastObject.updateMatrixWorld(true);

        return Object.freeze({
            visualObjects: Object.freeze([visualObject]),
            raycastObjects: Object.freeze([raycastObject]),
            metadata: Object.freeze({
                owner: 'FlatEarthGeometry',
                endpointKind: 'ground-boundary',
                groundPlane: 'z=0 in flat model space; y=0 in Three scene space',
                widthSceneUnits,
                depthSceneUnits,
                groundExtentMeters,
                centerSceneUnits,
                metersPerSceneUnit,
                spectralReferenceId,
                visualMaterialDisplayRgba,
                visualMaterialLighting: request.visualMaterialLighting === 'lambert' ? 'lambert' : 'basic',
                widthSegments,
                heightSegments,
                observerLocalSceneFrame: this._configuration.observerLocalSceneFrame,
            }),
        });
    }

    /**
     * @param {CacheBuildCoordinate} coordinate - Cache-owned logical coordinate.
     * @returns {RaySegment | null} Representative incident ray segment, or null when ground-blocked.
     */
    resolveCacheBuildRay(coordinate) {
        const altitudeMeters = coordinate.altitudeMeters;
        const rhoMeters = coordinate.rhoMeters ?? 0;
        const incomingDirection = coordinate.incomingDirection;

        if (!Number.isFinite(altitudeMeters) || !Number.isFinite(rhoMeters) || !incomingDirection) {
            throw new TypeError('Local cache build coordinate requires altitudeMeters, rhoMeters, and incomingDirection.');
        }

        const origin = Object.freeze([
            this._configuration.sourceSubpointMeters[0] + this._configuration.cacheRadialAxis[0] * rhoMeters,
            this._configuration.sourceSubpointMeters[1] + this._configuration.cacheRadialAxis[1] * rhoMeters,
            altitudeMeters,
        ]);
        const direction = normalize(incomingDirection);
        const groundDistance = this.distanceToGroundBoundary(origin, direction);

        if (groundDistance !== null && groundDistance >= 0) {
            return null;
        }

        return Object.freeze({
            ray: Object.freeze({ origin, direction }),
            startDistanceMeters: 0,
            endDistanceMeters: this._resolveFlatExitDistance(origin, direction, 'cache-build-ray'),
        });
    }

    /**
     * @param {Position} origin - Ray origin.
     * @param {UnitVector3} direction - Ray direction.
     * @returns {number | null} Distance to top atmosphere plane.
     */
    distanceToTopAtmosphereBoundary(origin, direction) {
        if (Math.abs(direction[2]) <= EPSILON) {
            return null;
        }

        const distance = (this._configuration.topAltitudeMeters - origin[2]) / direction[2];

        if (distance >= -EPSILON) {
            return Math.max(0, distance);
        }

        return null;
    }

    /**
     * @param {Position} origin - Ray origin.
     * @param {UnitVector3} direction - Ray direction.
     * @returns {number | null} Distance to ground plane.
     */
    distanceToGroundBoundary(origin, direction) {
        if (direction[2] >= -EPSILON) {
            return null;
        }

        const distance = -origin[2] / direction[2];

        if (distance >= -EPSILON) {
            return Math.max(0, distance);
        }

        return null;
    }

    /**
     * @param {Position} origin - Ray origin.
     * @param {UnitVector3} direction - Ray direction.
     * @returns {number | null} Distance to the observer-centered spherical dome boundary.
     */
    distanceToObserverCenteredDomeBoundary(origin, direction) {
        const dome = this._configuration.observerCenteredDome;

        if (!dome) {
            return null;
        }

        const offsetFromCenter = subtract(origin, dome.sphereCenterMeters);
        const b = dot(offsetFromCenter, direction);
        const c = dot(offsetFromCenter, offsetFromCenter) - dome.sphereRadiusMeters ** 2;
        const discriminant = b ** 2 - c;

        if (discriminant < -EPSILON) {
            return null;
        }

        const root = Math.sqrt(Math.max(0, discriminant));
        const near = -b - root;
        const far = -b + root;

        if (c <= EPSILON && far >= -EPSILON) {
            return Math.max(0, far);
        }

        if (near >= -EPSILON) {
            return Math.max(0, near);
        }

        if (far >= -EPSILON) {
            return Math.max(0, far);
        }

        return null;
    }

    _resolveFlatExitDistance(origin, direction, operationKind) {
        const candidates = [
            this.distanceToGroundBoundary(origin, direction),
            this.distanceToTopAtmosphereBoundary(origin, direction),
            this.distanceToObserverCenteredDomeBoundary(origin, direction),
        ].filter((distance) => distance !== null);

        if (candidates.length > 0) {
            return Math.min(...candidates);
        }

        if (Number.isFinite(this._configuration.sceneSkyRayLimitMeters)) {
            this._diagnose('flat-ray-parallel-no-boundary-hit', 'warning',
                'Flat ray found no configured ground/top/dome boundary; using supplied no-hit cap.', {
                    operationKind,
                    sceneSkyRayLimitMeters: this._configuration.sceneSkyRayLimitMeters,
                });

            return this._configuration.sceneSkyRayLimitMeters;
        }

        this._diagnose('flat-ray-parallel-no-boundary-cap', 'error',
            'Flat ray found no configured ground/top/dome boundary and no cap was supplied; returning zero length.', {
                operationKind,
            });

        return 0;
    }

    _buildAtmospherePathSamples(ray, startDistanceMeters, endDistanceMeters, sampleCount) {
        if (!Number.isInteger(sampleCount) || sampleCount < 1) {
            throw new RangeError('Atmosphere path sampleCount must be a positive integer.');
        }

        const intervalLengthMeters = (endDistanceMeters - startDistanceMeters) / sampleCount;
        const samples = [];

        for (let pointIndex = 0; pointIndex <= sampleCount; pointIndex += 1) {
            const isEndpoint = pointIndex === 0 || pointIndex === sampleCount;
            const distance = startDistanceMeters + intervalLengthMeters * pointIndex;
            const position = addScaled(ray.origin, ray.direction, distance);

            samples.push(Object.freeze({
                atmosphereCoordinate: this.resolveAtmosphereCoordinate(position),
                intervalLengthFromPreviousMeters: pointIndex === 0 ? 0 : intervalLengthMeters,
                measureMeters: intervalLengthMeters * (isEndpoint ? 0.5 : 1),
            }));
        }

        return Object.freeze(samples);
    }

    _nearestBinIndex(bins, value, axisName) {
        if (!Array.isArray(bins) || bins.length < 1) {
            this._diagnose('flat-cache-empty-bin-axis', 'error',
                'Flat cache access found an empty bin axis; using index 0.', { axisName });

            return 0;
        }

        if (!Number.isFinite(value)) {
            this._diagnose('flat-cache-non-finite-access', 'error',
                'Flat cache access received a non-finite coordinate; using index 0.', { axisName, value });

            return 0;
        }

        let nearestIndex = 0;
        let nearestDistance = Math.abs(value - bins[0]);

        for (let index = 1; index < bins.length; index += 1) {
            const distance = Math.abs(value - bins[index]);

            if (distance < nearestDistance) {
                nearestIndex = index;
                nearestDistance = distance;
            }
        }

        if (value < bins[0] || value > bins[bins.length - 1]) {
            this._diagnose('flat-cache-coordinate-out-of-range', 'warning',
                'Flat cache access coordinate was outside the configured local cache range; nearest-bin access was used.', {
                    axisName,
                    value,
                    min: bins[0],
                    max: bins[bins.length - 1],
                    nearestIndex,
                });
        }

        return clamp(nearestIndex, 0, bins.length - 1);
    }

    _blockedPath(position, reason, details) {
        const coordinate = this.resolveAtmosphereCoordinate(position);

        this._diagnose('flat-atmosphere-path-ground-blocked', 'warning',
            'Flat source or incident path hit ground before source/exit; returning blocked path.', {
                reason,
                details,
            });

        return Object.freeze({
            start: coordinate,
            end: coordinate,
            lengthMeters: 0,
            samples: Object.freeze([]),
            blockedByGround: true,
            metadata: Object.freeze({ reason, details }),
        });
    }

    _zeroLengthPath(position, reason) {
        const coordinate = this.resolveAtmosphereCoordinate(position);

        return Object.freeze({
            start: coordinate,
            end: coordinate,
            lengthMeters: 0,
            samples: Object.freeze([]),
            metadata: Object.freeze({ reason }),
        });
    }

    _modelPositionToObserverLocalScenePoint(position, metersPerSceneUnit) {
        const observer = this._configuration.observerPositionMeters;

        return Object.freeze([
            (position[0] - observer[0]) / metersPerSceneUnit,
            position[2] / metersPerSceneUnit,
            -(position[1] - observer[1]) / metersPerSceneUnit,
        ]);
    }

    _diagnose(id, severity, message, details) {
        if (this._runtimeDiagnostics.length >= this._configuration.runtimeDiagnosticLimit) {
            return;
        }

        this._runtimeDiagnostics.push(Object.freeze({
            id,
            severity,
            message,
            details: Object.freeze({ ...details }),
        }));
    }
}

function subtract(a, b) {
    return Object.freeze([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
}

function subtractHorizontal(a, b) {
    return Object.freeze([a[0] - b[0], a[1] - b[1], 0]);
}

function vector3Tuple(value, label) {
    if (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) {
        return value;
    }

    if (
        value
        && Number.isFinite(value.x)
        && Number.isFinite(value.y)
        && Number.isFinite(value.z)
    ) {
        return [value.x, value.y, value.z];
    }

    throw new TypeError(`${label} must be a finite 3D vector.`);
}

function metersPerSceneUnitFromRequest(request) {
    const metersPerSceneUnit = request.metersPerSceneUnit ?? request.scaleDenominator ?? 1;

    if (!Number.isFinite(metersPerSceneUnit) || metersPerSceneUnit <= 0) {
        throw new TypeError('Flat geometry Three endpoint conversion requires a positive metersPerSceneUnit.');
    }

    return metersPerSceneUnit;
}

function displayRgbaOrNull(value) {
    if (!Array.isArray(value) || value.length < 3 || !value.every(Number.isFinite)) {
        return null;
    }

    return Object.freeze([
        clampByte(value[0]),
        clampByte(value[1]),
        clampByte(value[2]),
        Number.isFinite(value[3]) ? clampByte(value[3]) : 255,
    ]);
}

function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function flatGroundExtentMeters(configuration) {
    const extentCandidates = [
        configuration.sceneSkyRayLimitMeters,
        configuration.observerCenteredDome?.maxObserverViewRayExtentMeters,
        configuration.topAltitudeMeters * 20,
        10000,
    ].filter((value) => Number.isFinite(value) && value > 0);

    return Math.max(...extentCandidates) * 2;
}

function buildCacheRadialAxis(observerPositionMeters, sourcePositionMeters) {
    const horizontal = subtractHorizontal(observerPositionMeters, sourcePositionMeters);

    if (magnitude(horizontal) <= EPSILON) {
        return Object.freeze([1, 0, 0]);
    }

    return normalize(horizontal);
}

/**
 * @param {Position} observerPositionMeters - Observer position in flat geometry coordinates.
 * @param {FlatObserverCenteredDomeConfig | null} domeConfig - Dome config, when enabled.
 * @returns {FlatObserverCenteredDomeDescriptor | null} Derived dome descriptor.
 */
function buildObserverCenteredDomeDescriptor(observerPositionMeters, domeConfig) {
    if (!domeConfig) {
        return null;
    }

    const {
        centerPolicy = 'observer-centered',
        apexAltitudeMeters,
        maxObserverViewRayExtentMeters,
    } = domeConfig;
    const observerAltitudeMeters = observerPositionMeters[2];

    if (centerPolicy !== 'observer-centered') {
        throw new RangeError('FlatEarthGeometry only supports observer-centered dome policy in the current POC.');
    }

    if (!Number.isFinite(apexAltitudeMeters) || apexAltitudeMeters <= observerAltitudeMeters) {
        throw new RangeError('observerCenteredDome.apexAltitudeMeters must be finite and above the observer.');
    }

    if (!Number.isFinite(maxObserverViewRayExtentMeters) || maxObserverViewRayExtentMeters <= 0) {
        throw new RangeError('observerCenteredDome.maxObserverViewRayExtentMeters must be finite and positive.');
    }

    const centerZ = (
        apexAltitudeMeters ** 2
        - observerAltitudeMeters ** 2
        - maxObserverViewRayExtentMeters ** 2
    ) / (2 * (apexAltitudeMeters - observerAltitudeMeters));
    const sphereRadiusMeters = apexAltitudeMeters - centerZ;

    if (!Number.isFinite(centerZ) || !Number.isFinite(sphereRadiusMeters) || sphereRadiusMeters <= 0) {
        throw new RangeError('observerCenteredDome produced an invalid derived sphere.');
    }

    return Object.freeze({
        centerPolicy,
        apexAltitudeMeters,
        maxObserverViewRayExtentMeters,
        observerAltitudeMeters,
        sphereCenterMeters: Object.freeze([
            observerPositionMeters[0],
            observerPositionMeters[1],
            centerZ,
        ]),
        sphereRadiusMeters,
    });
}
