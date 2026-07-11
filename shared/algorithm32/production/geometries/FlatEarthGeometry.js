import * as THREE from 'three';

import ExactFlatGroundObject from '../three/ExactFlatGroundObject.js';
import VectorMath from '../utils/VectorMath.js';

const EPSILON = 1e-9;
const IDENTITY_MATRIX4 = Object.freeze([
	1, 0, 0, 0,
	0, 1, 0, 0,
	0, 0, 1, 0,
	0, 0, 0, 1,
]);
const FLAT_OBSERVER_LOCAL_SCENE_FRAME = Object.freeze({
	up: Object.freeze([0, 0, 1]),
	right: Object.freeze([1, 0, 0]),
	forward: Object.freeze([0, -1, 0]),
});

/**
 * Own flat z-up atmosphere geometry for local-source transport.
 */
export class FlatEarthGeometry {
	/**
	 * Create flat Earth geometry.
	 *
	 * @param {FlatEarthGeometryConfig} configuration - Supplies observer,
	 * source, atmosphere domain, cache, and integration policy.
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

		const observerPosition = toVector3(observerPositionMeters, 'observerPositionMeters');
		const sourcePosition = toVector3(sourcePositionMeters, 'sourcePositionMeters');

		if (!Number.isFinite(topAltitudeMeters) || topAltitudeMeters <= 0) {
			throw new RangeError('FlatEarthGeometry requires a positive topAltitudeMeters.');
		}

		if (sceneSkyRayLimitMeters !== null && (!Number.isFinite(sceneSkyRayLimitMeters) || sceneSkyRayLimitMeters < 0)) {
			throw new RangeError('FlatEarthGeometry sceneSkyRayLimitMeters must be null or non-negative.');
		}

		if (!Number.isInteger(sourceTransmittanceIntervalCount) || sourceTransmittanceIntervalCount < 1) {
			throw new RangeError('FlatEarthGeometry sourceTransmittanceIntervalCount must be a positive integer.');
		}

		if (!isFiniteNumberArray(cacheZBinsMeters) || !isFiniteNumberArray(cacheRhoBinsMeters)) {
			throw new TypeError('FlatEarthGeometry cache z/rho bins must be finite arrays.');
		}

		this._configuration = Object.freeze({
			observerPositionMeters: observerPosition,
			sourcePositionMeters: sourcePosition,
			sourceSubpointMeters: Object.freeze([sourcePosition[0], sourcePosition[1], 0]),
			topAltitudeMeters,
			sceneSkyRayLimitMeters,
			observerCenteredDome: buildObserverCenteredDomeDescriptor(observerPosition, observerCenteredDome),
			sourceTransmittanceIntervalCount,
			cacheZBinsMeters: Object.freeze([...cacheZBinsMeters]),
			cacheRhoBinsMeters: Object.freeze([...cacheRhoBinsMeters]),
			runtimeDiagnosticLimit,
			cacheRadialAxis: buildCacheRadialAxis(observerPosition, sourcePosition),
			observerLocalSceneFrame: FLAT_OBSERVER_LOCAL_SCENE_FRAME,
		});
		this._runtimeDiagnostics = [];
	}

	/**
	 * Return immutable geometry configuration.
	 *
	 * @returns {FlatEarthGeometryConfig} The configuration.
	 */
	get configuration() {
		return this._configuration;
	}

	/**
	 * Return bounded runtime diagnostics recorded by tolerant paths.
	 *
	 * @returns {readonly unknown[]} Runtime diagnostics.
	 */
	get runtimeDiagnostics() {
		return Object.freeze([...this._runtimeDiagnostics]);
	}

	/**
	 * Identify this configured geometry model instance for compatibility.
	 *
	 * @returns {string} The geometry id.
	 */
	get id() {
		return 'flat-earth-geometry';
	}

	/**
	 * Return a serializable geometry descriptor.
	 *
	 * @returns {object} The geometry descriptor.
	 */
	describe() {
		return Object.freeze({
			kind: 'flat-earth-geometry',
			observerPositionMeters: this._configuration.observerPositionMeters,
			sourcePositionMeters: this._configuration.sourcePositionMeters,
			sourceSubpointMeters: this._configuration.sourceSubpointMeters,
			topAltitudeMeters: this._configuration.topAltitudeMeters,
			sceneSkyRayLimitMeters: this._configuration.sceneSkyRayLimitMeters,
			hasObserverCenteredDome: this._configuration.observerCenteredDome != null,
			observerCenteredDome: this._configuration.observerCenteredDome,
			sourceTransmittanceIntervalCount: this._configuration.sourceTransmittanceIntervalCount,
			cacheZBinsMeters: this._configuration.cacheZBinsMeters,
			cacheRhoBinsMeters: this._configuration.cacheRhoBinsMeters,
			cacheZBinCount: this._configuration.cacheZBinsMeters.length,
			cacheRhoBinCount: this._configuration.cacheRhoBinsMeters.length,
			observerLocalSceneFrame: this._configuration.observerLocalSceneFrame,
		});
	}

	/**
	 * Create the geometry-owned flat shader contribution.
	 *
	 * @param {ShaderContributionRequest} request - Supplies the active shader descriptor.
	 * @returns {ShaderContribution} The geometry shader contribution.
	 */
	createShaderContribution(request) {
		return this._createShaderContribution(request?.descriptor);
	}

	/**
	 * Return the model-space frame descriptor.
	 *
	 * @returns {object} The frame descriptor.
	 */
	getFrameDescriptor() {
		return Object.freeze({
			kind: 'observer-local-flat-frame',
			observerLocalSceneFrame: this._configuration.observerLocalSceneFrame,
		});
	}

	/**
	 * Resolve a finite view ray segment for atmosphere transport.
	 *
	 * @param {object} [request] - Supplies ray request facts.
	 * @returns {RaySegment} The clipped ray segment.
	 */
	resolveViewRaySegment(request = {}) {
		if (request.raySegment) {
			return request.raySegment;
		}

		const origin = toVector3(
			request.origin ?? request.ray?.origin ?? this._configuration.observerPositionMeters,
			'Flat view ray origin',
		);
		const direction = normalizeDirection(
			request.direction ?? request.viewDirection ?? request.ray?.direction ?? [0, 0, 1],
			'Flat view ray direction',
		);
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
	 * Resolve flat model-space position into altitude-only atmosphere
	 * coordinates.
	 *
	 * @param {Position | readonly [number, number, number]} position - Supplies
	 * model-space position.
	 * @returns {AtmosphereCoordinate} The atmosphere coordinate.
	 */
	resolveAtmosphereCoordinate(position) {
		let vector;

		try {
			vector = toVector3(position, 'Flat atmosphere position');
		} catch (error) {
			this._diagnose('flat-atmosphere-coordinate-non-finite', 'error',
				'Flat atmosphere coordinate received a non-finite position.', { position });

			return Object.freeze({ altitudeMeters: 0 });
		}

		const altitudeMeters = vector[2];

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
	 * Resolve a model-space ray into an atmosphere path.
	 *
	 * @param {object} [request] - Supplies path request facts.
	 * @returns {AtmospherePath} The atmosphere path.
	 */
	resolveAtmospherePath(request = {}) {
		const ray = request.ray ?? Object.freeze({
			origin: toVector3(request.startPosition, 'Flat atmosphere path startPosition'),
			direction: normalizeDirection(request.direction, 'Flat atmosphere path direction'),
		});
		const origin = toVector3(ray.origin, 'Flat atmosphere path origin');
		const direction = normalizeDirection(ray.direction, 'Flat atmosphere path direction');
		const startDistanceMeters = request.startDistanceMeters ?? 0;
		const sourceLimitMeters = request.sourcePathLimit?.maxDistanceMeters;
		const explicitEndDistanceMeters = Number.isFinite(request.endDistanceMeters)
			? request.endDistanceMeters
			: null;
		let candidateEndDistanceMeters = explicitEndDistanceMeters
			?? (Number.isFinite(sourceLimitMeters) ? sourceLimitMeters : null);
		const topDistance = this.distanceToTopAtmosphereBoundary(origin, direction);
		const groundDistance = this.distanceToGroundBoundary(origin, direction);
		const domeDistance = this.distanceToObserverCenteredDomeBoundary(origin, direction);

		if (
			groundDistance !== null
			&& groundDistance >= startDistanceMeters
			&& (candidateEndDistanceMeters === null || groundDistance < candidateEndDistanceMeters)
		) {
			return this._blockedPath(origin, 'ground-before-source-or-exit', {
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

			return this._zeroLengthPath(origin, 'non-finite-path');
		}

		const endDistanceMeters = Math.max(startDistanceMeters, candidateEndDistanceMeters);
		const sampleCount = request.sampleCount
			?? this._configuration.sourceTransmittanceIntervalCount;
		const samples = this._buildAtmospherePathSamples(
			Object.freeze({ origin, direction }),
			startDistanceMeters,
			endDistanceMeters,
			sampleCount,
		);
		const start = samples[0]?.atmosphereCoordinate ?? this.resolveAtmosphereCoordinate(origin);
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
	 * Resolve a sample point into local source-relative facts.
	 *
	 * @param {object} [request] - Supplies position facts.
	 * @returns {SourceRelativePosition} The source-relative packet.
	 */
	resolveSourceRelativePosition(request = {}) {
		if (!request.position) {
			throw new TypeError('resolveSourceRelativePosition requires position.');
		}

		const position = toVector3(request.position, 'Source-relative position');
		const toSource = subtract(this._configuration.sourcePositionMeters, position);
		const distanceFromSourceMeters = VectorMath.length(toSource);
		const directionToSource = distanceFromSourceMeters > EPSILON
			? Object.freeze(VectorMath.scale(toSource, 1 / distanceFromSourceMeters))
			: Object.freeze([0, 0, 1]);
		const sourceSubpointDelta = subtractHorizontal(position, this._configuration.sourceSubpointMeters);

		if (distanceFromSourceMeters <= EPSILON) {
			this._diagnose('flat-source-relative-zero-distance', 'error',
				'Path sample landed on the local source position; using safe upward direction.', {
					position,
				});
		}

		return Object.freeze({
			directionFromSource: Object.freeze(VectorMath.scale(directionToSource, -1)),
			directionToSource,
			distanceFromSourceMeters,
			radialDistanceFromSourceSubpointMeters: VectorMath.length(sourceSubpointDelta),
			altitudeMeters: position[2],
			metadata: Object.freeze({
				sourcePositionMeters: this._configuration.sourcePositionMeters,
				sourceSubpointMeters: this._configuration.sourceSubpointMeters,
			}),
		});
	}

	/**
	 * Resolve a sample point into local z/rho cache access.
	 *
	 * @param {object} [request] - Supplies sample facts.
	 * @returns {CacheAccess} The cache access packet.
	 */
	resolveCacheAccess(request = {}) {
		const position = request.position ? toVector3(request.position, 'Cache access position') : null;
		const atmosphereCoordinate = request.atmosphereCoordinate
			?? (position ? this.resolveAtmosphereCoordinate(position) : null);
		const altitudeMeters = request.sourceRelativePosition?.altitudeMeters
			?? atmosphereCoordinate?.altitudeMeters;
		const rhoMeters = request.sourceRelativePosition?.radialDistanceFromSourceSubpointMeters
			?? (position ? VectorMath.length(subtractHorizontal(position, this._configuration.sourceSubpointMeters)) : 0);
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
	 * Map observer-local scene point to flat model-space meters.
	 *
	 * @param {unknown} point - Supplies observer-local point.
	 * @param {object} [request] - Supplies scale facts.
	 * @returns {Position} Model-space position.
	 */
	mapObserverLocalScenePointToModelPosition(point, request = {}) {
		const vector = toVector3(point, 'Observer-local scene point');
		const metersPerSceneUnit = metersPerSceneUnitFromRequest(request);
		const observer = this._configuration.observerPositionMeters;

		return Object.freeze([
			observer[0] + vector[0] * metersPerSceneUnit,
			observer[1] - vector[2] * metersPerSceneUnit,
			vector[1] * metersPerSceneUnit,
		]);
	}

	/**
	 * Map observer-local scene direction to flat model-space direction.
	 *
	 * @param {unknown} direction - Supplies observer-local direction.
	 * @returns {UnitVector3} Model-space direction.
	 */
	mapObserverLocalSceneDirectionToModelDirection(direction) {
		const vector = toVector3(direction, 'Observer-local scene direction');

		return normalizeDirection([
			vector[0],
			-vector[2],
			vector[1],
		], 'Observer-local scene direction');
	}

	/**
	 * Map an app-authored ground offset to the configured Three scene point.
	 *
	 * @param {unknown} offset - Supplies horizontal scene offset `[x, z]`.
	 * @param {object} [request] - Supplies optional height above ground.
	 * @returns {Position} Configured Three scene point.
	 */
	mapGroundOffsetToScenePoint(offset, request = {}) {
		const vector = toVector2(offset, 'Ground scene offset');
		const heightAboveGroundSceneUnits = finiteNumberOrDefault(
			request.heightAboveGroundSceneUnits,
			0,
			'heightAboveGroundSceneUnits',
		);

		return Object.freeze([
			vector[0],
			heightAboveGroundSceneUnits,
			vector[1],
		]);
	}

	/**
	 * Project a scene point to the flat ground plane along a scene direction.
	 *
	 * @param {unknown} point - Supplies the scene point to project.
	 * @param {unknown} direction - Supplies the scene projection direction.
	 * @returns {SceneVector3} Projected ground point in scene units.
	 */
	projectScenePointToGroundAlongDirection(point, direction) {
		const vector = toVector3(point, 'Ground projection scene point');
		const directionVector = normalizeDirection(direction, 'Ground projection scene direction');

		if (Math.abs(directionVector[1]) <= Number.EPSILON) {
			return Object.freeze([vector[0], 0, vector[2]]);
		}

		const distance = -vector[1] / directionVector[1];

		if (!Number.isFinite(distance) || distance < 0) {
			return Object.freeze([vector[0], 0, vector[2]]);
		}

		const projected = VectorMath.addScaled(vector, directionVector, distance);

		return Object.freeze([projected[0], 0, projected[2]]);
	}

	/**
	 * Map flat model-space position to observer-local scene point.
	 *
	 * @param {unknown} position - Supplies model-space position.
	 * @param {object} [request] - Supplies scale facts.
	 * @returns {Position} Observer-local scene point.
	 */
	mapModelPositionToObserverLocalScenePoint(position, request = {}) {
		const vector = toVector3(position, 'Model-space position');
		const metersPerSceneUnit = metersPerSceneUnitFromRequest(request);

		return this._modelPositionToObserverLocalScenePoint(vector, metersPerSceneUnit);
	}

	/**
	 * Create geometry-owned Three ground endpoint objects.
	 *
	 * @param {GeometryThreeEndpointObjectsRequest} request - Supplies scene
	 * scale, material, segmentation, and metadata overrides.
	 * @returns {GeometryThreeEndpointObjects} The geometry-owned endpoint objects.
	 */
	createThreeEndpointObjects(request = {}) {
		const metersPerSceneUnit = metersPerSceneUnitFromRequest(request);
		const groundExtentMeters = positiveNumberOrDefault(
			request.groundExtentMeters,
			flatGroundExtentMeters(this._configuration),
			'groundExtentMeters',
		);
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
		const spectralReferenceId = request.spectralReferenceId ?? 'algorithm32-flat-ground-object-matte';
		const widthSegments = positiveIntegerOrDefault(request.widthSegments, 32, 'widthSegments');
		const heightSegments = positiveIntegerOrDefault(request.heightSegments, 32, 'heightSegments');
		const shadow = geometryEndpointShadowRequestOrNull(request.shadow);
		const visualObject = new THREE.Mesh(
			new THREE.PlaneGeometry(
				widthSceneUnits,
				depthSceneUnits,
				widthSegments,
				heightSegments,
			),
			createVisualMaterial(request),
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
		visualObject.userData.algorithm32SceneInput = true;
		visualObject.userData.algorithm32EndpointRole = 'geometry-ground-visual';
		visualObject.userData.endpointKind = 'geometry-ground-boundary';
		visualObject.userData.spectralReferenceId = spectralReferenceId;
		visualObject.userData.metersPerSceneUnit = metersPerSceneUnit;
		if (shadow) {
			visualObject.receiveShadow = shadow.receiveShadow;
			visualObject.userData.shadowPolicy = shadow.shadowPolicy;
			visualObject.userData.shadowReceiverPolicy = 'geometry-owned-ground-receives-three-shadow-map';
		}

		return Object.freeze({
			visualObjects: Object.freeze([visualObject]),
			raycastObjects: Object.freeze([raycastObject]),
			metadata: Object.freeze({
				owner: 'FlatEarthGeometry',
				endpointKind: 'geometry-ground-boundary',
				shape: 'plane',
				groundPlane: 'z-equals-zero',
				groundExtentMeters,
				widthSceneUnits,
				depthSceneUnits,
				centerSceneUnits,
				observerPositionMeters: this._configuration.observerPositionMeters,
				metersPerSceneUnit,
				spectralReferenceId,
				widthSegments,
				heightSegments,
				shadow: shadow ? Object.freeze({ ...shadow }) : null,
			}),
		});
	}

	/**
	 * Resolve the scene-depth capture cap for geometry-owned flat endpoints.
	 *
	 * @param {GeometrySceneDepthMaxMetersRequest} request - Supplies optional
	 * endpoint extent and minimum cap policy.
	 * @returns {number} Scene-depth cap in Algorithm32 meters.
	 */
	resolveSceneDepthMaxMeters(request = {}) {
		const groundExtentMeters = positiveNumberOrDefault(
			request.groundExtentMeters,
			flatGroundExtentMeters(this._configuration),
			'groundExtentMeters',
		);
		const halfExtentMeters = groundExtentMeters / 2;
		const cameraPositionMeters = cameraPositionMetersOrNull(request, this._configuration.observerPositionMeters)
			?? this._configuration.observerPositionMeters;
		const groundCenterMeters = Object.freeze([
			this._configuration.observerPositionMeters[0],
			this._configuration.observerPositionMeters[1],
			0,
		]);
		const farthestGroundEndpointMeters = Math.max(
			VectorMath.distance(cameraPositionMeters, [
				groundCenterMeters[0] - halfExtentMeters,
				groundCenterMeters[1] - halfExtentMeters,
				groundCenterMeters[2],
			]),
			VectorMath.distance(cameraPositionMeters, [
				groundCenterMeters[0] - halfExtentMeters,
				groundCenterMeters[1] + halfExtentMeters,
				groundCenterMeters[2],
			]),
			VectorMath.distance(cameraPositionMeters, [
				groundCenterMeters[0] + halfExtentMeters,
				groundCenterMeters[1] - halfExtentMeters,
				groundCenterMeters[2],
			]),
			VectorMath.distance(cameraPositionMeters, [
				groundCenterMeters[0] + halfExtentMeters,
				groundCenterMeters[1] + halfExtentMeters,
				groundCenterMeters[2],
			]),
		);

		return Math.max(
			positiveNumberOrDefault(request.minimumMeters, 1, 'minimumMeters'),
			farthestGroundEndpointMeters,
		);
	}

	/**
	 * Resolve a cache-owned coordinate into a representative incident ray.
	 *
	 * @param {CacheBuildCoordinate} coordinate - Supplies cache coordinate.
	 * @returns {RaySegment | null} The ray segment, or null when ground-blocked.
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
		const direction = normalizeDirection(incomingDirection, 'Local cache incomingDirection');
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
	 * Return distance to the top atmosphere plane.
	 *
	 * @param {Position | readonly [number, number, number]} origin - Supplies origin.
	 * @param {UnitVector3} direction - Supplies direction.
	 * @returns {number | null} Distance to boundary, or null.
	 */
	distanceToTopAtmosphereBoundary(origin, direction) {
		const originVector = toVector3(origin, 'Top boundary origin');
		const directionVector = normalizeDirection(direction, 'Top boundary direction');

		if (Math.abs(directionVector[2]) <= EPSILON) {
			return null;
		}

		const distance = (this._configuration.topAltitudeMeters - originVector[2]) / directionVector[2];

		if (distance >= -EPSILON) {
			return Math.max(0, distance);
		}

		return null;
	}

	/**
	 * Return distance to the ground plane.
	 *
	 * @param {Position | readonly [number, number, number]} origin - Supplies origin.
	 * @param {UnitVector3} direction - Supplies direction.
	 * @returns {number | null} Distance to boundary, or null.
	 */
	distanceToGroundBoundary(origin, direction) {
		const originVector = toVector3(origin, 'Ground boundary origin');
		const directionVector = normalizeDirection(direction, 'Ground boundary direction');

		if (directionVector[2] >= -EPSILON) {
			return null;
		}

		const distance = -originVector[2] / directionVector[2];

		if (distance >= -EPSILON) {
			return Math.max(0, distance);
		}

		return null;
	}

	/**
	 * Return distance to observer-centered dome boundary, when configured.
	 *
	 * @param {Position | readonly [number, number, number]} origin - Supplies origin.
	 * @param {UnitVector3} direction - Supplies direction.
	 * @returns {number | null} Distance to boundary, or null.
	 */
	distanceToObserverCenteredDomeBoundary(origin, direction) {
		const dome = this._configuration.observerCenteredDome;

		if (!dome) {
			return null;
		}

		const originVector = toVector3(origin, 'Dome boundary origin');
		const directionVector = normalizeDirection(direction, 'Dome boundary direction');
		const offsetFromCenter = subtract(originVector, dome.sphereCenterMeters);
		const b = VectorMath.dot(offsetFromCenter, directionVector);
		const c = VectorMath.dot(offsetFromCenter, offsetFromCenter) - dome.sphereRadiusMeters ** 2;
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
			const position = VectorMath.addScaled(ray.origin, ray.direction, distance);

			samples.push(Object.freeze({
				atmosphereCoordinate: this.resolveAtmosphereCoordinate(position),
				intervalLengthFromPreviousMeters: pointIndex === 0 ? 0 : intervalLengthMeters,
				measureMeters: intervalLengthMeters * (isEndpoint ? 0.5 : 1),
			}));
		}

		return Object.freeze(samples);
	}

	_nearestBinIndex(bins, value, axisName) {
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

	/**
	 * Create the geometry-owned flat shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the geometry contribution.
	 */
	_createShaderContribution(descriptor) {
		assertFlatGeometryDescriptor(descriptor);
		const facts = descriptor.geometry.facts ?? {};
		const frame = facts.observerLocalSceneFrame ?? FLAT_OBSERVER_LOCAL_SCENE_FRAME;
		const dome = facts.observerCenteredDome;
		const domeEnabled = Boolean(dome);
		const domeCenterMeters = domeEnabled ? dome.sphereCenterMeters : [0, 0, 0];
		const domeRadiusMeters = domeEnabled ? dome.sphereRadiusMeters : 0;

		return shaderContribution({
			id: 'geometry-flat-earth',
			owner: 'geometry',
			descriptorFingerprint: descriptor.geometry.fingerprint,
			compatibilityTags: descriptor.geometry.compatibilityTags,
			provides: Object.freeze([
				'geometry.reconstructViewRay',
				'geometry.resolveAtmospherePath',
				'geometry.cacheAccessCoordinate',
			]),
			requires: Object.freeze(['runtime.initialState', 'runtime.depthTexture', 'runtime.sceneHitTexture']),
			uniforms: Object.freeze([
				shaderUniform('uInverseProjectionMatrix', 'mat4', 'geometry.inverseProjectionMatrix', IDENTITY_MATRIX4),
				shaderUniform('uInverseViewMatrix', 'mat4', 'geometry.inverseViewMatrix', IDENTITY_MATRIX4),
				shaderUniform('uCameraWorldPositionMeters', 'vec3', 'geometry.cameraWorldPositionMeters', facts.observerPositionMeters ?? [0, 0, 2]),
				shaderUniform('uSceneTerminationMeters', 'float', 'geometry.sceneTerminationMeters', 0),
				shaderUniform('uSceneDepthMaxMeters', 'float', 'geometry.sceneDepthMaxMeters', facts.sceneSkyRayLimitMeters ?? facts.topAltitudeMeters),
			]),
			functions: Object.freeze([
				shaderBlock('geometry-constants', 'declareConstants', 0, `const float GEOMETRY_TOP_ALTITUDE_METERS = ${formatFloat(facts.topAltitudeMeters)};
const float GEOMETRY_SCENE_SKY_RAY_LIMIT_METERS = ${formatFloat(facts.sceneSkyRayLimitMeters ?? facts.topAltitudeMeters)};
const vec3 GEOMETRY_SOURCE_SUBPOINT_METERS = ${formatVec3(facts.sourceSubpointMeters ?? [facts.sourcePositionMeters[0], facts.sourcePositionMeters[1], 0])};
const vec3 GEOMETRY_OBSERVER_UP_DIRECTION = ${formatVec3(frame.up)};
const vec3 GEOMETRY_OBSERVER_RIGHT_DIRECTION = ${formatVec3(frame.right)};
const vec3 GEOMETRY_OBSERVER_FORWARD_DIRECTION = ${formatVec3(frame.forward)};
const bool GEOMETRY_OBSERVER_DOME_ENABLED = ${domeEnabled ? 'true' : 'false'};
const vec3 GEOMETRY_OBSERVER_DOME_CENTER_METERS = ${formatVec3(domeCenterMeters)};
const float GEOMETRY_OBSERVER_DOME_RADIUS_METERS = ${formatFloat(domeRadiusMeters)};`),
				shaderBlock('geometry-reconstruct-helper', 'reconstructRay', 0, `ViewRay reconstructViewRay(vec2 uv) {
	vec4 clip = vec4(uv * 2.0 - 1.0, 1.0, 1.0);
	vec4 view = uInverseProjectionMatrix * clip;
	view.xyz /= max(view.w, 0.000001);
	vec3 sceneDirection = normalize((uInverseViewMatrix * vec4(normalize(view.xyz), 0.0)).xyz);
	vec3 direction = normalize(
		GEOMETRY_OBSERVER_RIGHT_DIRECTION * sceneDirection.x
		+ GEOMETRY_OBSERVER_UP_DIRECTION * sceneDirection.y
		+ GEOMETRY_OBSERVER_FORWARD_DIRECTION * sceneDirection.z
	);
	return ViewRay(uCameraWorldPositionMeters, direction);
}`),
				shaderBlock('geometry-depth-helper', 'resolvePathBounds', 0, `float sceneTerminationMetersFromDepth(float sceneDepth) {
	float decodedTerminationMeters = max(sceneDepth * uSceneDepthMaxMeters, 0.0);
	return uSceneTerminationMeters > 0.0 ? uSceneTerminationMeters : decodedTerminationMeters;
}

float positiveBoundaryDistance(float distanceMeters) {
	return max(distanceMeters, 0.0);
}

bool observerDomeBoundaryDistance(vec3 originMeters, vec3 direction, out float distanceMeters) {
	if (!GEOMETRY_OBSERVER_DOME_ENABLED) {
		distanceMeters = 0.0;
		return false;
	}

	vec3 offsetFromCenter = originMeters - GEOMETRY_OBSERVER_DOME_CENTER_METERS;
	float b = dot(offsetFromCenter, direction);
	float c = dot(offsetFromCenter, offsetFromCenter)
		- GEOMETRY_OBSERVER_DOME_RADIUS_METERS * GEOMETRY_OBSERVER_DOME_RADIUS_METERS;
	float discriminant = b * b - c;

	if (discriminant < -0.000001) {
		distanceMeters = 0.0;
		return false;
	}

	float root = sqrt(max(discriminant, 0.0));
	float nearDistance = -b - root;
	float farDistance = -b + root;

	if (c <= 0.000001 && farDistance >= -0.000001) {
		distanceMeters = positiveBoundaryDistance(farDistance);
		return true;
	}
	if (nearDistance >= -0.000001) {
		distanceMeters = positiveBoundaryDistance(nearDistance);
		return true;
	}
	if (farDistance >= -0.000001) {
		distanceMeters = positiveBoundaryDistance(farDistance);
		return true;
	}

	distanceMeters = 0.0;
	return false;
}

void chooseNearestBoundary(float candidateDistanceMeters, bool hasCandidate, inout float selectedDistanceMeters, inout bool hasSelected) {
	if (hasCandidate && (!hasSelected || candidateDistanceMeters < selectedDistanceMeters)) {
		selectedDistanceMeters = candidateDistanceMeters;
		hasSelected = true;
	}
}`),
				shaderBlock('geometry-path-helper', 'resolvePathBounds', 0, `PathBounds resolveAtmospherePath(ViewRay ray, float sceneTerminationMeters, bool hasSceneEndpoint) {
	bool hasTopBoundary = ray.direction.z > 0.000001;
	bool hasGroundBoundary = ray.direction.z < -0.000001;
	float topDistanceMeters = hasTopBoundary
		? positiveBoundaryDistance((GEOMETRY_TOP_ALTITUDE_METERS - ray.originMeters.z) / ray.direction.z)
		: 0.0;
	float groundDistanceMeters = hasGroundBoundary
		? positiveBoundaryDistance((0.0 - ray.originMeters.z) / ray.direction.z)
		: 0.0;
	float domeDistanceMeters = 0.0;
	bool hasDomeBoundary = observerDomeBoundaryDistance(ray.originMeters, ray.direction, domeDistanceMeters);
	bool hasAtmosphereBoundary = false;
	float boundaryDistanceMeters = 0.0;
	bool usesGroundBoundary = false;

	chooseNearestBoundary(topDistanceMeters, hasTopBoundary, boundaryDistanceMeters, hasAtmosphereBoundary);
	bool groundWouldWin = hasGroundBoundary
		&& (!hasAtmosphereBoundary || groundDistanceMeters <= boundaryDistanceMeters);
	chooseNearestBoundary(groundDistanceMeters, hasGroundBoundary, boundaryDistanceMeters, hasAtmosphereBoundary);
	usesGroundBoundary = groundWouldWin;
	chooseNearestBoundary(domeDistanceMeters, hasDomeBoundary, boundaryDistanceMeters, hasAtmosphereBoundary);

	float fallbackSkyDistanceMeters = max(GEOMETRY_SCENE_SKY_RAY_LIMIT_METERS, 0.0);
	float selectedBoundaryDistanceMeters = hasAtmosphereBoundary
		? boundaryDistanceMeters
		: fallbackSkyDistanceMeters;
	float endDistanceMeters = hasSceneEndpoint
		? min(max(sceneTerminationMeters, 0.0), selectedBoundaryDistanceMeters)
		: selectedBoundaryDistanceMeters;
	bool hasGroundEndpoint = hasGroundBoundary && groundDistanceMeters <= endDistanceMeters;
	bool valid = endDistanceMeters >= 0.0;
	return PathBounds(0.0, max(0.0, endDistanceMeters), sceneTerminationMeters, hasSceneEndpoint, hasGroundEndpoint, valid);
}`),
				shaderBlock('geometry-cache-coordinate', 'lookupIncidentRadiance', 0, `int nearestLocalCacheZBinIndex(vec3 positionMeters) {
	float altitudeMeters = positionMeters.z;
	int bestIndex = 0;
	float bestDelta = abs(altitudeMeters - LOCAL_CACHE_Z_BINS_METERS[0]);
	for (int binIndex = 1; binIndex < LOCAL_CACHE_Z_BIN_COUNT; binIndex += 1) {
		float candidateDelta = abs(altitudeMeters - LOCAL_CACHE_Z_BINS_METERS[binIndex]);
		if (candidateDelta < bestDelta) {
			bestDelta = candidateDelta;
			bestIndex = binIndex;
		}
	}
	return bestIndex;
}

int nearestLocalCacheRhoBinIndex(vec3 positionMeters) {
	float rhoMeters = length(positionMeters.xy - GEOMETRY_SOURCE_SUBPOINT_METERS.xy);
	int bestIndex = 0;
	float bestDelta = abs(rhoMeters - LOCAL_CACHE_RHO_BINS_METERS[0]);
	for (int binIndex = 1; binIndex < LOCAL_CACHE_RHO_BIN_COUNT; binIndex += 1) {
		float candidateDelta = abs(rhoMeters - LOCAL_CACHE_RHO_BINS_METERS[binIndex]);
		if (candidateDelta < bestDelta) {
			bestDelta = candidateDelta;
			bestIndex = binIndex;
		}
	}
	return bestIndex;
}`),
			]),
			mainHooks: Object.freeze([
				shaderBlock('geometry-main-ray', 'reconstructRay', 0, 'state.ray = reconstructViewRay(state.uv);'),
				shaderBlock('geometry-main-bounds', 'resolvePathBounds', 0, 'state.bounds = resolveAtmospherePath(state.ray, sceneTerminationMetersFromDepth(state.sceneDepth), state.sceneHitMask > 0.5);'),
			]),
		});
	}
}

/**
 * Assert that a shader descriptor carries flat geometry facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the candidate descriptor.
 * @returns {void}
 */
function assertFlatGeometryDescriptor(descriptor) {
	const facts = descriptor?.geometry?.facts ?? {};

	if (!descriptor?.geometry) {
		throw new TypeError('FlatEarthGeometry shader contribution requires a geometry descriptor.');
	}

	if (facts.kind && facts.kind !== 'flat-earth-geometry') {
		throw new TypeError('FlatEarthGeometry shader contribution requires flat Earth geometry.');
	}

	if (!Number.isFinite(facts.topAltitudeMeters) || !Array.isArray(facts.sourcePositionMeters)) {
		throw new TypeError('FlatEarthGeometry shader contribution requires topAltitudeMeters and sourcePositionMeters.');
	}
}

/**
 * Create one contribution object.
 *
 * @param {Partial<ShaderContribution>} configuration - Supplies contribution fields.
 * @returns {ShaderContribution} Return contribution.
 */
function shaderContribution(configuration) {
	return Object.freeze({
		defines: Object.freeze([]),
		uniforms: Object.freeze([]),
		textures: Object.freeze([]),
		functions: Object.freeze([]),
		mainHooks: Object.freeze([]),
		bindingRequirements: Object.freeze([]),
		diagnostics: null,
		...configuration,
	});
}

/**
 * Create one shader source block.
 *
 * @param {string} id - Supplies block id.
 * @param {ShaderSourceSlot} slot - Supplies assembly slot.
 * @param {number} order - Supplies slot-local order.
 * @param {string} code - Supplies GLSL source.
 * @returns {ShaderSourceBlock} Return source block.
 */
function shaderBlock(id, slot, order, code) {
	return Object.freeze({ id, slot, order, code });
}

/**
 * Create one shader uniform descriptor.
 *
 * @param {string} name - Supplies GLSL uniform name.
 * @param {string} type - Supplies GLSL uniform type.
 * @param {string} valueKey - Supplies runtime value key.
 * @param {unknown} [defaultValue] - Supplies optional default value.
 * @returns {ShaderUniformDescriptor} Return uniform descriptor.
 */
function shaderUniform(name, type, valueKey, defaultValue) {
	const descriptor = { name, type, valueKey };

	if (arguments.length >= 4) {
		descriptor.defaultValue = defaultValue;
	}

	return Object.freeze(descriptor);
}

/**
 * Format one number for GLSL output.
 *
 * @param {number} value - Supplies the value.
 * @returns {string} Return formatted GLSL number text.
 */
function formatFloat(value) {
	if (Number.isInteger(value)) {
		return value.toFixed(1);
	}

	return Number(value).toPrecision(12);
}

/**
 * Format numeric array entries for GLSL output.
 *
 * @param {readonly number[]} values - Supplies values.
 * @returns {string} Return formatted entries.
 */
function formatFloatArray(values) {
	return values.map((value) => formatFloat(value)).join(', ');
}

/**
 * Format a GLSL vec3.
 *
 * @param {readonly number[]} values - Supplies vector values.
 * @returns {string} Return formatted vector source.
 */
function formatVec3(values) {
	return `vec3(${formatFloatArray(values)})`;
}

/**
 * Subtract two 3D vectors.
 *
 * @param {readonly number[]} a - Supplies left vector.
 * @param {readonly number[]} b - Supplies right vector.
 * @returns {readonly [number, number, number]} The difference.
 */
function subtract(a, b) {
	return Object.freeze([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
}

/**
 * Subtract horizontal components and zero altitude.
 *
 * @param {readonly number[]} a - Supplies left vector.
 * @param {readonly number[]} b - Supplies right vector.
 * @returns {readonly [number, number, number]} The horizontal difference.
 */
function subtractHorizontal(a, b) {
	return Object.freeze([a[0] - b[0], a[1] - b[1], 0]);
}

/**
 * Convert a production position packet or tuple to a vector tuple.
 *
 * @param {unknown} value - Supplies the candidate value.
 * @param {string} label - Supplies the error label.
 * @returns {readonly [number, number, number]} The vector tuple.
 */
function toVector3(value, label) {
	const vector = Array.isArray(value) ? value : value?.coordinates;

	if (Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite)) {
		return Object.freeze([vector[0], vector[1], vector[2]]);
	}

	if (Number.isFinite(value?.x) && Number.isFinite(value?.y) && Number.isFinite(value?.z)) {
		return Object.freeze([value.x, value.y, value.z]);
	}

	throw new TypeError(`${label} must be a finite three-component vector.`);
}

/**
 * Convert a production two-component packet or tuple to a vector tuple.
 *
 * @param {unknown} value - Supplies the candidate value.
 * @param {string} label - Supplies the error label.
 * @returns {readonly [number, number]} The vector tuple.
 */
function toVector2(value, label) {
	const vector = Array.isArray(value) ? value : value?.coordinates;

	if (Array.isArray(vector) && vector.length === 2 && vector.every(Number.isFinite)) {
		return Object.freeze([vector[0], vector[1]]);
	}

	if (Number.isFinite(value?.x) && Number.isFinite(value?.z)) {
		return Object.freeze([value.x, value.z]);
	}

	throw new TypeError(`${label} must be a finite two-component vector.`);
}

/**
 * Resolve finite number with fallback.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {number} fallback - Supplies fallback value.
 * @param {string} label - Supplies error label.
 * @returns {number} Finite number.
 */
function finiteNumberOrDefault(value, fallback, label) {
	if (value == null) {
		return fallback;
	}

	if (!Number.isFinite(value)) {
		throw new TypeError(`${label} must be finite.`);
	}

	return value;
}

/**
 * Normalize a non-zero direction.
 *
 * @param {unknown} direction - Supplies the direction candidate.
 * @param {string} label - Supplies the error label.
 * @returns {UnitVector3} The normalized direction.
 */
function normalizeDirection(direction, label) {
	const vector = toVector3(direction, label);

	if (VectorMath.length(vector) <= Number.EPSILON) {
		throw new RangeError(`${label} must be non-zero.`);
	}

	return Object.freeze(VectorMath.normalize(vector));
}

/**
 * Resolve meters per scene unit from request.
 *
 * @param {object} request - Supplies scale request.
 * @returns {number} Meters per scene unit.
 */
function metersPerSceneUnitFromRequest(request) {
	const metersPerSceneUnit = request.metersPerSceneUnit
		?? request.distanceMultiplier
		?? request.scaleDenominator
		?? 1;

	if (!Number.isFinite(metersPerSceneUnit) || metersPerSceneUnit <= 0) {
		throw new TypeError('Flat geometry scene conversion requires a positive metersPerSceneUnit.');
	}

	return metersPerSceneUnit;
}

/**
 * Resolve optional camera position in flat model-space meters.
 *
 * @param {GeometrySceneDepthMaxMetersRequest} request - Supplies camera facts.
 * @param {Position} observerPositionMeters - Supplies the observer model point.
 * @returns {readonly [number, number, number] | null} Camera position in meters.
 */
function cameraPositionMetersOrNull(request, observerPositionMeters) {
	if (request.cameraPositionMeters ?? request.cameraWorldPositionMeters) {
		return toVector3(
			request.cameraPositionMeters ?? request.cameraWorldPositionMeters,
			'Camera position in meters',
		);
	}

	const scenePosition = request.cameraPositionSceneUnits ?? request.camera?.position;

	if (!scenePosition) {
		return null;
	}

	const metersPerSceneUnit = request.metersPerSceneUnit ?? request.distanceMultiplier ?? request.scaleDenominator;

	if (!Number.isFinite(metersPerSceneUnit) || metersPerSceneUnit <= 0) {
		return null;
	}

	const vector = toVector3(scenePosition, 'Camera position in scene units');

	return Object.freeze([
		observerPositionMeters[0] + vector[0] * metersPerSceneUnit,
		observerPositionMeters[1] - vector[2] * metersPerSceneUnit,
		vector[1] * metersPerSceneUnit,
	]);
}

/**
 * Create the visual ground material requested by the integration.
 *
 * @param {GeometryThreeEndpointObjectsRequest} request - Supplies material options.
 * @returns {THREE.Material} The created material.
 */
function createVisualMaterial(request) {
	const displayRgba = displayRgbaOrNull(request.visualMaterialDisplayRgba);
	const materialParameters = {
		color: displayRgba
			? new THREE.Color(displayRgba[0] / 255, displayRgba[1] / 255, displayRgba[2] / 255)
			: request.visualMaterialColor ?? 0x4fa33d,
		side: THREE.DoubleSide,
	};

	if (displayRgba && displayRgba[3] < 255) {
		materialParameters.transparent = true;
		materialParameters.opacity = displayRgba[3] / 255;
	}

	return request.visualMaterialLighting === 'lambert'
		? new THREE.MeshLambertMaterial(materialParameters)
		: new THREE.MeshBasicMaterial(materialParameters);
}

/**
 * Normalize optional endpoint shadow receiver request.
 *
 * @param {unknown} value - Supplies shadow request.
 * @returns {object | null} Normalized shadow request.
 */
function geometryEndpointShadowRequestOrNull(value) {
	if (!value || value.enabled !== true) {
		return null;
	}

	return Object.freeze({
		enabled: true,
		receiveShadow: value.receiveShadow !== false,
		shadowPolicy: value.shadowPolicy ?? 'geometry-ground-receives-source-shadow-map',
	});
}

/**
 * Resolve a positive number with a default.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {number} defaultValue - Supplies default value.
 * @param {string} label - Supplies error label.
 * @returns {number} Positive number value.
 */
function positiveNumberOrDefault(value, defaultValue, label) {
	const candidate = value ?? defaultValue;

	if (!Number.isFinite(candidate) || candidate <= 0) {
		throw new RangeError(`${label} must be a positive finite number.`);
	}

	return candidate;
}

/**
 * Resolve a positive integer with a default.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {number} defaultValue - Supplies default value.
 * @param {string} label - Supplies error label.
 * @returns {number} Positive integer value.
 */
function positiveIntegerOrDefault(value, defaultValue, label) {
	const candidate = value ?? defaultValue;

	if (!Number.isFinite(candidate) || candidate < 1) {
		throw new RangeError(`${label} must be a positive finite number.`);
	}

	return Math.max(1, Math.floor(candidate));
}

/**
 * Normalize optional display rgba values.
 *
 * @param {unknown} value - Supplies candidate rgba tuple.
 * @returns {readonly [number, number, number, number] | null} Normalized rgba.
 */
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

/**
 * Clamp a display channel to a byte.
 *
 * @param {number} value - Supplies channel value.
 * @returns {number} Byte channel.
 */
function clampByte(value) {
	return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Resolve a renderable flat-ground extent in meters.
 *
 * @param {FlatEarthGeometryConfig} configuration - Supplies geometry config.
 * @returns {number} Full ground width/depth in meters.
 */
function flatGroundExtentMeters(configuration) {
	const extentCandidates = [
		configuration.sceneSkyRayLimitMeters,
		configuration.observerCenteredDome?.maxObserverViewRayExtentMeters,
		configuration.topAltitudeMeters * 20,
		10000,
	].filter((value) => Number.isFinite(value) && value > 0);

	return Math.max(...extentCandidates) * 2;
}

/**
 * Build radial cache axis from source to observer.
 *
 * @param {readonly number[]} observerPositionMeters - Supplies observer position.
 * @param {readonly number[]} sourcePositionMeters - Supplies source position.
 * @returns {UnitVector3} The radial axis.
 */
function buildCacheRadialAxis(observerPositionMeters, sourcePositionMeters) {
	const horizontal = subtractHorizontal(observerPositionMeters, sourcePositionMeters);

	if (VectorMath.length(horizontal) <= EPSILON) {
		return Object.freeze([1, 0, 0]);
	}

	return Object.freeze(VectorMath.normalize(horizontal));
}

/**
 * Build observer-centered dome descriptor when configured.
 *
 * @param {readonly number[]} observerPositionMeters - Supplies observer position.
 * @param {FlatObserverCenteredDomeConfig | null} domeConfig - Supplies dome config.
 * @returns {FlatObserverCenteredDomeDescriptor | null} Dome descriptor.
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
		throw new RangeError('FlatEarthGeometry only supports observer-centered dome policy in the current slice.');
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

/**
 * Check for a finite numeric array.
 *
 * @param {unknown} values - Supplies candidate values.
 * @returns {boolean} True when values are usable.
 */
function isFiniteNumberArray(values) {
	return Array.isArray(values) && values.length > 0 && values.every(Number.isFinite);
}

/**
 * Clamp a value into a range.
 *
 * @param {number} value - Supplies value.
 * @param {number} min - Supplies minimum.
 * @param {number} max - Supplies maximum.
 * @returns {number} Clamped value.
 */
function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

export default FlatEarthGeometry;
