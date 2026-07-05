// References:
// - agents/topics/apps/flat/algorithm32/conclusions.md, spherical top-boundary and atmosphere-coordinate equations.
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, geometry-owned path and cache-coordinate mapping.
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.2.

import * as THREE from 'three';

import { add, addScaled, clamp, cross, dot, isFiniteVector3, magnitude, normalize, scale } from '../math/vector.js';
import ExactSphereGroundObject from '../three/ExactSphereGroundObject.js';

export default class SphericalEarthGeometry {
    /**
     * @param {SphericalGeometryConfig} configuration - Spherical geometry configuration.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new TypeError('SphericalEarthGeometry configuration is required.');
        }

        const {
            bottomRadiusMeters,
            topRadiusMeters,
            observerHeightMeters = 0,
            observerUpDirection = [0, 0, 1],
            sourceDirection = [0, 0, 1],
            cacheAltitudeBinCount = 1,
            cacheBoundaryAltitudeMeters = 2,
            sourceTransmittanceIntervalCount = 10,
        } = configuration;

        if (![bottomRadiusMeters, topRadiusMeters, observerHeightMeters, cacheBoundaryAltitudeMeters].every(Number.isFinite)) {
            throw new TypeError('SphericalEarthGeometry radii and observer height must be finite.');
        }
        if (!isFiniteVector3(observerUpDirection)) {
            throw new TypeError('SphericalEarthGeometry observerUpDirection must be a finite vector.');
        }

        const normalizedObserverUpDirection = normalize(observerUpDirection);

        this._configuration = Object.freeze({
            bottomRadiusMeters,
            topRadiusMeters,
            observerHeightMeters,
            observerUpDirection: normalizedObserverUpDirection,
            observerLocalSceneFrame: makeObserverLocalSceneFrame(normalizedObserverUpDirection),
            sourceDirection: normalize(sourceDirection),
            cacheAltitudeBinCount,
            cacheBoundaryAltitudeMeters,
            sourceTransmittanceIntervalCount,
        });
    }

    get configuration() {
        return this._configuration;
    }

    /**
     * @param {{
     *   readonly raySegment?: RaySegment,
     *   readonly ray?: Ray,
     *   readonly origin?: Position,
     *   readonly direction?: UnitVector3,
     *   readonly endDistanceMeters?: number,
     *   readonly maxDistanceMeters?: number,
     *   readonly groundBoundaryMode?: 'clip' | 'scene-hit-owned'
     * }} request
     *   View ray request.
     * @returns {RaySegment} Clipped finite view ray segment.
     */
    resolveViewRaySegment(request = {}) {
        if (request.raySegment) {
            return request.raySegment;
        }

        const origin = request.origin
            ?? request.ray?.origin
            ?? this._originAtAltitude(this._configuration.observerHeightMeters);
        const direction = normalize(request.direction ?? request.viewDirection ?? [0, 0, 1]);

        if (!isFiniteVector3(origin)) {
            throw new TypeError('View ray origin must be a finite Position.');
        }

        const groundBoundaryMode = request.groundBoundaryMode ?? 'clip';
        if (!['clip', 'scene-hit-owned'].includes(groundBoundaryMode)) {
            throw new RangeError('groundBoundaryMode must be "clip" or "scene-hit-owned".');
        }

        let endDistanceMeters = groundBoundaryMode === 'scene-hit-owned'
            ? this.distanceToTopAtmosphereBoundary(origin, direction)
            : this._resolveAtmosphereExitDistance(origin, direction);
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
     * @param {Position} position - Model-space position.
     * @returns {AtmosphereCoordinate} Altitude-only atmosphere coordinate.
     */
    resolveAtmosphereCoordinate(position) {
        return Object.freeze({
            altitudeMeters: magnitude(position) - this._configuration.bottomRadiusMeters,
        });
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
     * }} request - Path request.
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
        let endDistanceMeters = request.endDistanceMeters;

        if (!Number.isFinite(endDistanceMeters)) {
            const groundDistance = this.distanceToGroundBoundary(ray.origin, ray.direction);

            if (groundDistance !== null && groundDistance >= 0) {
                return this._blockedPath(ray.origin);
            }

            endDistanceMeters = this.distanceToTopAtmosphereBoundary(ray.origin, ray.direction);
        }

        if (request.sourcePathLimit?.maxDistanceMeters != null) {
            endDistanceMeters = Math.min(endDistanceMeters, request.sourcePathLimit.maxDistanceMeters);
        }

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
            }),
        });
    }

    /**
     * @param {{ readonly position: Position }} request - Source-relative request.
     * @returns {SourceRelativePosition} Distant-source relation packet.
     */
    resolveSourceRelativePosition(request = {}) {
        const directionToSource = this._configuration.sourceDirection;

        if (!request.position) {
            throw new TypeError('resolveSourceRelativePosition requires position.');
        }

        return Object.freeze({
            directionFromSource: scale(directionToSource, -1),
            directionToSource,
            distanceFromSourceMeters: null,
        });
    }

    /**
     * @param {{ readonly atmosphereCoordinate?: AtmosphereCoordinate, readonly position?: Position }} request - Runtime cache access request.
     * @returns {CacheAccess} Distant cache altitude access packet.
     */
    resolveCacheAccess(request = {}) {
        const atmosphereCoordinate = request.atmosphereCoordinate
            ?? this.resolveAtmosphereCoordinate(request.position);
        const requestedAltitudeMeters = atmosphereCoordinate.altitudeMeters;
        const effectiveAltitudeMeters = Math.max(
            requestedAltitudeMeters,
            this._configuration.cacheBoundaryAltitudeMeters,
        );
        const altitudeBinIndex = this.altitudeToCacheBinIndex(effectiveAltitudeMeters);

        return Object.freeze({
            cacheKey: `altitude:${altitudeBinIndex}`,
            coordinates: Object.freeze([altitudeBinIndex]),
            metadata: Object.freeze({
                altitudeMeters: requestedAltitudeMeters,
                effectiveAltitudeMeters,
                altitudeBinIndex,
                boundaryClampApplied: effectiveAltitudeMeters !== requestedAltitudeMeters,
            }),
        });
    }

    /**
     * @param {unknown} point - Observer-local Three-style scene point.
     * @param {{ readonly metersPerSceneUnit?: number, readonly scaleDenominator?: number }} [request]
     *   Scene unit conversion request.
     * @returns {Position} Model-space position in Algorithm32 meters.
     */
    mapObserverLocalScenePointToModelPosition(point, request = {}) {
        const vector = vector3Tuple(point, 'Observer-local scene point');
        const metersPerSceneUnit = this._metersPerSceneUnit(request);
        const frame = this._configuration.observerLocalSceneFrame;

        return Object.freeze(add(
            add(
                scale(frame.up, this._configuration.bottomRadiusMeters + vector[1] * metersPerSceneUnit),
                scale(frame.right, vector[0] * metersPerSceneUnit),
            ),
            scale(frame.forward, vector[2] * metersPerSceneUnit),
        ));
    }

    /**
     * @param {unknown} direction - Observer-local Three-style scene direction.
     * @returns {UnitVector3} Model-space direction.
     */
    mapObserverLocalSceneDirectionToModelDirection(direction) {
        const vector = vector3Tuple(direction, 'Observer-local scene direction');
        const frame = this._configuration.observerLocalSceneFrame;

        return normalize(add(
            add(scale(frame.up, vector[1]), scale(frame.right, vector[0])),
            scale(frame.forward, vector[2]),
        ));
    }

    /**
     * @param {CacheBuildCoordinate} coordinate - Cache-owned logical coordinate.
     * @returns {RaySegment | null} Representative incident ray segment, or null when ground-blocked.
     */
    resolveCacheBuildRay(coordinate) {
        const altitudeMeters = coordinate.altitudeMeters;
        const incomingDirection = coordinate.incomingDirection;

        if (!Number.isFinite(altitudeMeters) || !incomingDirection) {
            throw new TypeError('Cache build coordinate requires altitudeMeters and incomingDirection.');
        }

        const origin = this._originAtAltitude(altitudeMeters);
        const direction = normalize(incomingDirection);
        const groundDistance = this.distanceToGroundBoundary(origin, direction);

        if (groundDistance !== null && groundDistance >= 0) {
            return null;
        }

        return Object.freeze({
            ray: Object.freeze({ origin, direction }),
            startDistanceMeters: 0,
            endDistanceMeters: this.distanceToTopAtmosphereBoundary(origin, direction),
        });
    }

    /**
     * @param {GeometryThreeEndpointObjectsRequest} request - Three endpoint object request.
     * @returns {GeometryThreeEndpointObjects} Geometry-owned Three endpoint objects.
     */
    createThreeEndpointObjects(request = {}) {
        const metersPerSceneUnit = request.metersPerSceneUnit ?? request.scaleDenominator ?? 1;

        if (!Number.isFinite(metersPerSceneUnit) || metersPerSceneUnit <= 0) {
            throw new TypeError('createThreeEndpointObjects requires a positive metersPerSceneUnit.');
        }

        const radiusSceneUnits = this._configuration.bottomRadiusMeters / metersPerSceneUnit;
        const observerAltitudeSceneUnits = this._configuration.observerHeightMeters / metersPerSceneUnit;
        const centerSceneUnits = Object.freeze([0, -radiusSceneUnits, 0]);
        const spectralReferenceId = request.spectralReferenceId ?? 'diagnostic-spherical-ground-object-matte';
        const visualMaterialColor = request.visualMaterialColor ?? 0x566942;
        const widthSegments = request.widthSegments ?? 128;
        const heightSegments = request.heightSegments ?? 64;
        const visualObject = new THREE.Mesh(
            new THREE.SphereGeometry(
                radiusSceneUnits,
                widthSegments,
                heightSegments,
            ),
            new THREE.MeshBasicMaterial({ color: visualMaterialColor }),
        );
        const raycastObject = new ExactSphereGroundObject({
            radiusSceneUnits,
            centerSceneUnits,
            metersPerSceneUnit,
            spectralReferenceId,
            name: request.name ?? 'spherical-earth-ground-endpoint',
        });

        visualObject.name = `${request.name ?? 'spherical-earth-ground'}-visual`;
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
                owner: 'SphericalEarthGeometry',
                endpointKind: 'ground-boundary',
                radiusSceneUnits,
                centerSceneUnits,
                observerAltitudeSceneUnits,
                metersPerSceneUnit,
                spectralReferenceId,
                widthSegments,
                heightSegments,
                observerUpDirection: this._configuration.observerUpDirection,
                observerLocalSceneFrame: this._configuration.observerLocalSceneFrame,
            }),
        });
    }

    /**
     * @param {number} altitudeMeters - Altitude to bin.
     * @returns {number} Cache altitude bin index.
     */
    altitudeToCacheBinIndex(altitudeMeters) {
        const atmosphereHeight = this._configuration.topRadiusMeters - this._configuration.bottomRadiusMeters;
        const normalized = clamp(altitudeMeters / atmosphereHeight, 0, 0.999999999);

        return clamp(
            Math.floor(normalized * this._configuration.cacheAltitudeBinCount),
            0,
            this._configuration.cacheAltitudeBinCount - 1,
        );
    }

    /**
     * @param {Position} origin - Ray origin.
     * @param {UnitVector3} direction - Ray direction.
     * @returns {number} Distance to top atmosphere boundary.
     */
    distanceToTopAtmosphereBoundary(origin, direction) {
        const radius = magnitude(origin);
        const mu = dot(origin, direction) / radius;
        const discriminant =
            radius * radius * (mu * mu - 1)
            + this._configuration.topRadiusMeters * this._configuration.topRadiusMeters;

        return Math.max(0, -radius * mu + Math.sqrt(Math.max(0, discriminant)));
    }

    /**
     * @param {Position} origin - Ray origin.
     * @param {UnitVector3} direction - Ray direction.
     * @returns {number | null} Distance to ground boundary.
     */
    distanceToGroundBoundary(origin, direction) {
        const radius = magnitude(origin);
        const mu = dot(origin, direction) / radius;
        const discriminant =
            radius * radius * (mu * mu - 1)
            + this._configuration.bottomRadiusMeters * this._configuration.bottomRadiusMeters;

        if (mu >= 0 || discriminant < 0) {
            return null;
        }

        const distance = -radius * mu - Math.sqrt(discriminant);

        return distance > 0 ? distance : null;
    }

    _resolveAtmosphereExitDistance(origin, direction) {
        const topDistance = this.distanceToTopAtmosphereBoundary(origin, direction);
        const groundDistance = this.distanceToGroundBoundary(origin, direction);

        if (groundDistance !== null && groundDistance > 0 && groundDistance < topDistance) {
            return groundDistance;
        }

        return topDistance;
    }

    _originAtAltitude(altitudeMeters) {
        return Object.freeze(scale(
            this._configuration.observerUpDirection,
            this._configuration.bottomRadiusMeters + altitudeMeters,
        ));
    }

    _metersPerSceneUnit(request) {
        const metersPerSceneUnit = request.metersPerSceneUnit ?? request.scaleDenominator ?? 1;

        if (!Number.isFinite(metersPerSceneUnit) || metersPerSceneUnit <= 0) {
            throw new TypeError('Observer-local scene mapping requires a positive metersPerSceneUnit.');
        }

        return metersPerSceneUnit;
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

    _blockedPath(position) {
        const coordinate = this.resolveAtmosphereCoordinate(position);

        return Object.freeze({
            start: coordinate,
            end: coordinate,
            lengthMeters: 0,
            samples: Object.freeze([]),
            blockedByGround: true,
        });
    }
}

function makeObserverLocalSceneFrame(observerUpDirection) {
    const reference = Math.abs(dot(observerUpDirection, [0, 0, 1])) < 0.95 ? [0, 0, 1] : [0, 1, 0];
    const tangent = normalize(add(reference, scale(observerUpDirection, -dot(reference, observerUpDirection))));

    return Object.freeze({
        up: observerUpDirection,
        right: normalize(cross(tangent, observerUpDirection)),
        forward: scale(tangent, -1),
    });
}

function vector3Tuple(value, fieldName) {
    if (isFiniteVector3(value)) {
        return value;
    }
    if (
        value
        && typeof value === 'object'
        && Number.isFinite(value.x)
        && Number.isFinite(value.y)
        && Number.isFinite(value.z)
    ) {
        return Object.freeze([value.x, value.y, value.z]);
    }

    throw new TypeError(`${fieldName} must be a finite three-component vector.`);
}
