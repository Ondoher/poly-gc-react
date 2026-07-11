import * as THREE from 'three';

import ExactSphereGroundObject from '../three/ExactSphereGroundObject.js';
import VectorMath from '../utils/VectorMath.js';

const IDENTITY_MATRIX4 = Object.freeze([
	1, 0, 0, 0,
	0, 1, 0, 0,
	0, 0, 1, 0,
	0, 0, 0, 1,
]);
const MODEL_SPACE_SCENE_FRAME = Object.freeze({
	kind: 'model-space',
	up: Object.freeze([0, 1, 0]),
	right: Object.freeze([1, 0, 0]),
	forward: Object.freeze([0, 0, 1]),
});

/**
 * Own spherical atmosphere geometry for view rays, source paths, and cache
 * coordinates.
 */
export class SphericalEarthGeometry {
	/**
	 * Create spherical Earth geometry.
	 *
	 * @param {SphericalEarthGeometryConfig} configuration - Supplies radii,
	 * observer, source, cache, and integration policy.
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
			sceneFrame = null,
			sourceDirection = [0, 0, 1],
			cacheAltitudeBinCount = 1,
			cacheBoundaryAltitudeMeters = 2,
			sourceTransmittanceIntervalCount = 10,
		} = configuration;

		if (![bottomRadiusMeters, topRadiusMeters, observerHeightMeters, cacheBoundaryAltitudeMeters].every(Number.isFinite)) {
			throw new TypeError('SphericalEarthGeometry radii, observer height, and cache boundary must be finite.');
		}

		if (bottomRadiusMeters <= 0 || topRadiusMeters <= bottomRadiusMeters) {
			throw new RangeError('SphericalEarthGeometry requires positive radii with top above bottom.');
		}

		if (!Number.isInteger(cacheAltitudeBinCount) || cacheAltitudeBinCount < 1) {
			throw new RangeError('SphericalEarthGeometry cacheAltitudeBinCount must be a positive integer.');
		}

		if (!Number.isInteger(sourceTransmittanceIntervalCount) || sourceTransmittanceIntervalCount < 1) {
			throw new RangeError('SphericalEarthGeometry sourceTransmittanceIntervalCount must be a positive integer.');
		}

		const normalizedObserverUpDirection = normalizeDirection(observerUpDirection, 'observerUpDirection');
		const observerLocalSceneFrame = makeObserverLocalSceneFrame(normalizedObserverUpDirection);

		this._configuration = Object.freeze({
			bottomRadiusMeters,
			topRadiusMeters,
			observerHeightMeters,
			observerUpDirection: normalizedObserverUpDirection,
			observerLocalSceneFrame,
			sceneFrame: normalizeSceneFrame(sceneFrame, observerLocalSceneFrame),
			sourceDirection: normalizeDirection(sourceDirection, 'sourceDirection'),
			cacheAltitudeBinCount,
			cacheBoundaryAltitudeMeters,
			sourceTransmittanceIntervalCount,
		});
	}

	/**
	 * Return immutable geometry configuration.
	 *
	 * @returns {SphericalEarthGeometryConfig} The configuration.
	 */
	get configuration() {
		return this._configuration;
	}

	/**
	 * Identify this configured geometry model instance for compatibility.
	 *
	 * @returns {string} The geometry id.
	 */
	get id() {
		return 'spherical-earth-geometry';
	}

	/**
	 * Return a serializable geometry descriptor.
	 *
	 * @returns {object} The geometry descriptor.
	 */
	describe() {
		return Object.freeze({
			kind: 'spherical-earth-geometry',
			bottomRadiusMeters: this._configuration.bottomRadiusMeters,
			topRadiusMeters: this._configuration.topRadiusMeters,
			observerHeightMeters: this._configuration.observerHeightMeters,
			cacheAltitudeBinCount: this._configuration.cacheAltitudeBinCount,
			cacheBoundaryAltitudeMeters: this._configuration.cacheBoundaryAltitudeMeters,
			sourceTransmittanceIntervalCount: this._configuration.sourceTransmittanceIntervalCount,
			observerLocalSceneFrame: this._configuration.observerLocalSceneFrame,
			sceneFrame: this._configuration.sceneFrame,
		});
	}

	/**
	 * Create the geometry-owned spherical shader contribution.
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
			kind: this._configuration.sceneFrame.kind === 'model-space'
				? 'model-space-spherical-frame'
				: 'observer-local-spherical-frame',
			observerUpDirection: this._configuration.observerUpDirection,
			observerLocalSceneFrame: this._configuration.observerLocalSceneFrame,
			sceneFrame: this._configuration.sceneFrame,
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
			request.origin
			?? request.ray?.origin
			?? this._originAtAltitude(this._configuration.observerHeightMeters),
			'View ray origin',
		);
		const direction = normalizeDirection(
			request.direction ?? request.viewDirection ?? request.ray?.direction ?? [0, 0, 1],
			'View ray direction',
		);
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
	 * Resolve model-space position into altitude-only atmosphere coordinates.
	 *
	 * @param {Position | readonly [number, number, number]} position - Supplies
	 * model-space position.
	 * @returns {AtmosphereCoordinate} The atmosphere coordinate.
	 */
	resolveAtmosphereCoordinate(position) {
		const vector = toVector3(position, 'Atmosphere position');

		return Object.freeze({
			altitudeMeters: VectorMath.length(vector) - this._configuration.bottomRadiusMeters,
		});
	}

	/**
	 * Resolve a model-space ray into an atmosphere path.
	 *
	 * @param {object} [request] - Supplies path request facts.
	 * @returns {AtmospherePath} The atmosphere path.
	 */
	resolveAtmospherePath(request = {}) {
		const ray = request.ray ?? Object.freeze({
			origin: toVector3(request.startPosition, 'Atmosphere path startPosition'),
			direction: normalizeDirection(request.direction, 'Atmosphere path direction'),
		});
		const origin = toVector3(ray.origin, 'Atmosphere path origin');
		const direction = normalizeDirection(ray.direction, 'Atmosphere path direction');
		const startDistanceMeters = request.startDistanceMeters ?? 0;
		let endDistanceMeters = request.endDistanceMeters;

		if (!Number.isFinite(endDistanceMeters)) {
			const groundDistance = this.distanceToGroundBoundary(origin, direction);

			if (groundDistance !== null && groundDistance >= 0) {
				return this._blockedPath(origin);
			}

			endDistanceMeters = this.distanceToTopAtmosphereBoundary(origin, direction);
		}

		if (request.sourcePathLimit?.maxDistanceMeters != null) {
			endDistanceMeters = Math.min(endDistanceMeters, request.sourcePathLimit.maxDistanceMeters);
		}

		const sampleCount = request.sampleCount
			?? this._configuration.sourceTransmittanceIntervalCount;
		const samples = this._buildAtmospherePathSamples(
			Object.freeze({ origin, direction }),
			startDistanceMeters,
			Math.max(startDistanceMeters, endDistanceMeters),
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
			}),
		});
	}

	/**
	 * Resolve a sample point into source-relative facts.
	 *
	 * @param {object} [request] - Supplies position facts.
	 * @returns {SourceRelativePosition} The source-relative packet.
	 */
	resolveSourceRelativePosition(request = {}) {
		if (!request.position) {
			throw new TypeError('resolveSourceRelativePosition requires position.');
		}

		const directionToSource = this._configuration.sourceDirection;

		return Object.freeze({
			directionFromSource: Object.freeze(VectorMath.scale(directionToSource, -1)),
			directionToSource,
			distanceFromSourceMeters: null,
		});
	}

	/**
	 * Map observer-local Three scene point to spherical model-space meters.
	 *
	 * @param {unknown} point - Supplies observer-local point.
	 * @param {object} [request] - Supplies scale facts.
	 * @returns {Position} Model-space position.
	 */
	mapObserverLocalScenePointToModelPosition(point, request = {}) {
		const vector = toVector3(point, 'Observer-local scene point');
		const metersPerSceneUnit = metersPerSceneUnitFromRequest(
			request,
			'Spherical geometry observer-local scene conversion',
		);

		return this._scenePointToModelPosition(vector, metersPerSceneUnit);
	}

	/**
	 * Map observer-local Three scene direction to spherical model-space direction.
	 *
	 * @param {unknown} direction - Supplies observer-local direction.
	 * @returns {UnitVector3} Model-space direction.
	 */
	mapObserverLocalSceneDirectionToModelDirection(direction) {
		const vector = toVector3(direction, 'Observer-local scene direction');

		return this._sceneDirectionToModelDirection(vector);
	}

	/**
	 * Resolve a sample point into distant-cache altitude access.
	 *
	 * @param {object} [request] - Supplies sample and atmosphere facts.
	 * @returns {CacheAccess} The cache access packet.
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
	 * Resolve a cache-owned coordinate into a representative incident ray.
	 *
	 * @param {CacheBuildCoordinate} coordinate - Supplies cache coordinate.
	 * @returns {RaySegment | null} The ray segment, or null when ground-blocked.
	 */
	resolveCacheBuildRay(coordinate) {
		const altitudeMeters = coordinate.altitudeMeters;
		const incomingDirection = coordinate.incomingDirection;

		if (!Number.isFinite(altitudeMeters) || !incomingDirection) {
			throw new TypeError('Cache build coordinate requires altitudeMeters and incomingDirection.');
		}

		const origin = this._originAtAltitude(altitudeMeters);
		const direction = normalizeDirection(incomingDirection, 'Cache build incomingDirection');
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
	 * Map an app-authored ground offset to the configured Three scene point.
	 *
	 * The input offset is expressed in the active Three scene's horizontal
	 * ground plane as `[x, z]`. Spherical geometry owns the projection from
	 * that tangent-plane offset onto the curved ground surface and applies
	 * height along the normalized local surface normal.
	 *
	 * @param {unknown} offset - Supplies horizontal scene offset `[x, z]`.
	 * @param {object} [request] - Supplies scene scale and optional height.
	 * @returns {Position} Configured Three scene point.
	 */
	mapGroundOffsetToScenePoint(offset, request = {}) {
		const vector = toVector2(offset, 'Ground scene offset');
		const metersPerSceneUnit = metersPerSceneUnitFromRequest(
			request,
			'Spherical geometry ground scene conversion',
		);
		const heightAboveGroundSceneUnits = finiteNumberOrDefault(
			request.heightAboveGroundSceneUnits,
			0,
			'heightAboveGroundSceneUnits',
		);
		const radiusSceneUnits = this._configuration.bottomRadiusMeters / metersPerSceneUnit;
		const centerSceneUnits = this._configuration.sceneFrame.kind === 'model-space'
			? Object.freeze([0, 0, 0])
			: Object.freeze([0, -radiusSceneUnits, 0]);
		const upSceneUnits = this._configuration.sceneFrame.kind === 'model-space'
			? this._configuration.observerUpDirection
			: Object.freeze([0, 1, 0]);
		const rightSceneUnits = projectOntoTangentPlane([1, 0, 0], upSceneUnits);
		const forwardSceneUnits = projectOntoTangentPlane([0, 0, 1], upSceneUnits);
		const horizontalOffset = VectorMath.add(
			VectorMath.scale(rightSceneUnits, vector[0]),
			VectorMath.scale(forwardSceneUnits, vector[1]),
		);
		const horizontalDistanceSquared = VectorMath.dot(horizontalOffset, horizontalOffset);
		const radialDistanceSceneUnits = Math.sqrt(Math.max(
			0,
			radiusSceneUnits ** 2 - horizontalDistanceSquared,
		));
		const surfacePoint = VectorMath.add(
			VectorMath.add(centerSceneUnits, horizontalOffset),
			VectorMath.scale(upSceneUnits, radialDistanceSceneUnits),
		);
		const surfaceNormal = VectorMath.normalize(VectorMath.subtract(surfacePoint, centerSceneUnits));

		return Object.freeze(VectorMath.add(
			surfacePoint,
			VectorMath.scale(surfaceNormal, heightAboveGroundSceneUnits),
		));
	}

	/**
	 * Project a scene point to the local spherical ground along a scene direction.
	 *
	 * @param {unknown} point - Supplies the scene point to project.
	 * @param {unknown} direction - Supplies the scene projection direction.
	 * @param {object} [request] - Supplies scene scale and locality guards.
	 * @returns {SceneVector3} Projected local ground point in scene units.
	 */
	projectScenePointToGroundAlongDirection(point, direction, request = {}) {
		const vector = toVector3(point, 'Ground projection scene point');
		const directionVector = normalizeDirection(direction, 'Ground projection scene direction');
		const metersPerSceneUnit = metersPerSceneUnitFromRequest(
			request,
			'Spherical geometry ground projection',
		);
		const radiusSceneUnits = this._configuration.bottomRadiusMeters / metersPerSceneUnit;
		const centerSceneUnits = this._configuration.sceneFrame.kind === 'model-space'
			? Object.freeze([0, 0, 0])
			: Object.freeze([0, -radiusSceneUnits, 0]);
		const fallbackUpSceneUnits = this._configuration.sceneFrame.kind === 'model-space'
			? this._configuration.observerUpDirection
			: Object.freeze([0, 1, 0]);
		const localSurface = projectScenePointToSphereSurface(
			vector,
			centerSceneUnits,
			radiusSceneUnits,
			fallbackUpSceneUnits,
		);
		const offsetFromCenter = VectorMath.subtract(vector, centerSceneUnits);
		const heightAboveSurface = VectorMath.length(offsetFromCenter) - radiusSceneUnits;
		const surfaceToleranceSceneUnits = nonNegativeFiniteOrDefault(
			request.surfaceToleranceSceneUnits,
			1e-6,
			'surfaceToleranceSceneUnits',
		);

		if (heightAboveSurface <= surfaceToleranceSceneUnits) {
			return localSurface;
		}

		const maxLocalDistanceSceneUnits = nonNegativeFiniteOrDefault(
			request.maxLocalDistanceSceneUnits,
			Infinity,
			'maxLocalDistanceSceneUnits',
		);
		const localNormalDotMin = clamp(
			finiteNumberOrDefault(request.localNormalDotMin, 0, 'localNormalDotMin'),
			-1,
			1,
		);
		const hit = intersectSceneRayWithSphere(
			vector,
			directionVector,
			centerSceneUnits,
			radiusSceneUnits,
		);

		if (
			hit
			&& isLocalSphereProjectionHit({
				hit,
				localSurface,
				centerSceneUnits,
				maxLocalDistanceSceneUnits,
				localNormalDotMin,
			})
		) {
			return hit.point;
		}

		return localSurface;
	}

	/**
	 * Create geometry-owned Three ground endpoint objects.
	 *
	 * @param {GeometryThreeEndpointObjectsRequest} request - Supplies scene
	 * scale, material, segmentation, and metadata overrides.
	 * @returns {GeometryThreeEndpointObjects} The geometry-owned endpoint objects.
	 */
	createThreeEndpointObjects(request = {}) {
		const metersPerSceneUnit = metersPerSceneUnitFromRequest(
			request,
			'Spherical geometry Three endpoint conversion',
		);
		const radiusSceneUnits = this._configuration.bottomRadiusMeters / metersPerSceneUnit;
		const observerAltitudeSceneUnits = this._configuration.observerHeightMeters / metersPerSceneUnit;
		const centerSceneUnits = this._configuration.sceneFrame.kind === 'model-space'
			? Object.freeze([0, 0, 0])
			: Object.freeze([0, -radiusSceneUnits, 0]);
		const spectralReferenceId = request.spectralReferenceId ?? 'algorithm32-spherical-ground-object-matte';
		const widthSegments = positiveIntegerOrDefault(request.widthSegments, 128, 'widthSegments');
		const heightSegments = positiveIntegerOrDefault(request.heightSegments, 64, 'heightSegments');
		const shadow = geometryEndpointShadowRequestOrNull(request.shadow);
		const groundVisualMesh = normalizeGroundVisualMeshRequest(request.groundVisualMesh);
		const visualGeometry = groundVisualMesh.kind === 'local-spherical-patch'
			? createLocalSphericalGroundPatchGeometry({
				radiusSceneUnits,
				widthSegments,
				heightSegments,
				observerAltitudeSceneUnits,
				centerSceneUnits,
				groundVisualMesh,
			})
			: new THREE.SphereGeometry(
				radiusSceneUnits,
				widthSegments,
				heightSegments,
			);
		const visualObject = new THREE.Mesh(
			visualGeometry,
			createVisualMaterial(request),
		);
		const visualPosition = groundVisualMesh.kind === 'local-spherical-patch'
			? [0, 0, 0]
			: centerSceneUnits;
		const visualShape = groundVisualMesh.kind === 'local-spherical-patch'
			? 'local-spherical-patch'
			: 'sphere';
		const raycastObject = new ExactSphereGroundObject({
			radiusSceneUnits,
			centerSceneUnits,
			metersPerSceneUnit,
			spectralReferenceId,
			name: request.name ?? 'spherical-earth-ground-endpoint',
		});

		visualObject.name = `${request.name ?? 'spherical-earth-ground'}-visual`;
		visualObject.position.set(visualPosition[0], visualPosition[1], visualPosition[2]);
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
		visualObject.userData.algorithm32GroundVisualMesh = Object.freeze({
			kind: groundVisualMesh.kind,
			shape: visualShape,
			hitPolicy: 'visual-mesh-not-semantic-hit-authority',
			...(shadow ? { shadowReceiverPolicy: visualObject.userData.shadowReceiverPolicy } : {}),
			...(visualGeometry.userData.algorithm32GroundPatch
				? { groundPatch: visualGeometry.userData.algorithm32GroundPatch }
				: {}),
		});

		return Object.freeze({
			visualObjects: Object.freeze([visualObject]),
			raycastObjects: Object.freeze([raycastObject]),
			metadata: Object.freeze({
				owner: 'SphericalEarthGeometry',
				endpointKind: 'geometry-ground-boundary',
				shape: visualShape,
				raycastPolicy: 'geometry-owned-exact-sphere-raycast',
				sceneCapturePolicy: 'visual-mesh-raster-depth',
				visualMeshKind: groundVisualMesh.kind,
				sceneFrameKind: this._configuration.sceneFrame.kind,
				bottomRadiusMeters: this._configuration.bottomRadiusMeters,
				radiusSceneUnits,
				centerSceneUnits,
				visualPositionSceneUnits: Object.freeze([...visualPosition]),
				observerHeightMeters: this._configuration.observerHeightMeters,
				observerAltitudeSceneUnits,
				metersPerSceneUnit,
				spectralReferenceId,
				widthSegments,
				heightSegments,
				shadow: shadow ? Object.freeze({ ...shadow }) : null,
				...(visualGeometry.userData.algorithm32GroundPatch
					? { groundPatch: visualGeometry.userData.algorithm32GroundPatch }
					: {}),
			}),
		});
	}

	/**
	 * Resolve the scene-depth capture cap for geometry-owned spherical endpoints.
	 *
	 * @param {GeometrySceneDepthMaxMetersRequest} request - Supplies optional
	 * camera position and minimum cap policy.
	 * @returns {number} Scene-depth cap in Algorithm32 meters.
	 */
	resolveSceneDepthMaxMeters(request = {}) {
		const scenePointToModelPosition = (position, metersPerSceneUnit) =>
			this._scenePointToModelPosition(position, metersPerSceneUnit);
		const cameraPositionMeters = cameraPositionMetersOrNull(request, scenePointToModelPosition);
		const observerHeightMeters = cameraPositionMeters
			? Math.max(0, VectorMath.length(cameraPositionMeters) - this._configuration.bottomRadiusMeters)
			: this._configuration.observerHeightMeters;
		const observerRadiusMeters = this._configuration.bottomRadiusMeters + observerHeightMeters;
		const horizonDistanceMeters = Math.sqrt(Math.max(
			0,
			observerRadiusMeters ** 2 - this._configuration.bottomRadiusMeters ** 2,
		));
		const endpointExtentMeters = endpointExtentMetersOrNull(
			request,
			cameraPositionMeters,
			scenePointToModelPosition,
		);

		return Math.max(
			positiveFiniteOrDefault(request.minimumMeters, 1),
			observerHeightMeters,
			horizonDistanceMeters,
			endpointExtentMeters ?? 0,
		);
	}

	/**
	 * Resolve an altitude into a cache bin index.
	 *
	 * @param {number} altitudeMeters - Supplies altitude in meters.
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
	 * Return distance to the top atmosphere sphere.
	 *
	 * @param {Position | readonly [number, number, number]} origin - Supplies
	 * ray origin.
	 * @param {UnitVector3} direction - Supplies ray direction.
	 * @returns {number} Distance to boundary.
	 */
	distanceToTopAtmosphereBoundary(origin, direction) {
		const originVector = toVector3(origin, 'Top boundary origin');
		const directionVector = normalizeDirection(direction, 'Top boundary direction');
		const radius = VectorMath.length(originVector);
		const mu = VectorMath.dot(originVector, directionVector) / radius;
		const discriminant =
			radius * radius * (mu * mu - 1)
			+ this._configuration.topRadiusMeters * this._configuration.topRadiusMeters;

		return Math.max(0, -radius * mu + Math.sqrt(Math.max(0, discriminant)));
	}

	/**
	 * Return distance to the ground sphere, if the ray hits it.
	 *
	 * @param {Position | readonly [number, number, number]} origin - Supplies
	 * ray origin.
	 * @param {UnitVector3} direction - Supplies ray direction.
	 * @returns {number | null} Distance to boundary, or null.
	 */
	distanceToGroundBoundary(origin, direction) {
		const originVector = toVector3(origin, 'Ground boundary origin');
		const directionVector = normalizeDirection(direction, 'Ground boundary direction');
		const radius = VectorMath.length(originVector);
		const mu = VectorMath.dot(originVector, directionVector) / radius;
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
		return Object.freeze(VectorMath.scale(
			this._configuration.observerUpDirection,
			this._configuration.bottomRadiusMeters + altitudeMeters,
		));
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

	_scenePointToModelPosition(vector, metersPerSceneUnit) {
		if (this._configuration.sceneFrame.kind === 'model-space') {
			return Object.freeze([
				vector[0] * metersPerSceneUnit,
				vector[1] * metersPerSceneUnit,
				vector[2] * metersPerSceneUnit,
			]);
		}

		const frame = this._configuration.sceneFrame;

		return Object.freeze(VectorMath.add(
			VectorMath.add(
				VectorMath.scale(frame.up, this._configuration.bottomRadiusMeters + vector[1] * metersPerSceneUnit),
				VectorMath.scale(frame.right, vector[0] * metersPerSceneUnit),
			),
			VectorMath.scale(frame.forward, vector[2] * metersPerSceneUnit),
		));
	}

	_sceneDirectionToModelDirection(vector) {
		if (this._configuration.sceneFrame.kind === 'model-space') {
			return normalizeDirection(vector, 'Observer-local scene direction');
		}

		const frame = this._configuration.sceneFrame;

		return normalizeDirection(VectorMath.add(
			VectorMath.add(
				VectorMath.scale(frame.up, vector[1]),
				VectorMath.scale(frame.right, vector[0]),
			),
			VectorMath.scale(frame.forward, vector[2]),
		), 'Observer-local scene direction');
	}

	/**
	 * Create the geometry-owned spherical shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the geometry contribution.
	 */
	_createShaderContribution(descriptor) {
		assertSphericalGeometryDescriptor(descriptor);
		const facts = descriptor.geometry.facts ?? {};
		const frame = facts.sceneFrame ?? facts.observerLocalSceneFrame ?? Object.freeze({
			up: Object.freeze([1, 0, 0]),
			right: Object.freeze([0, 1, 0]),
			forward: Object.freeze([0, 0, -1]),
		});

		return shaderContribution({
			id: 'geometry-spherical-earth',
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
				shaderUniform('uCameraWorldPositionMeters', 'vec3', 'geometry.cameraWorldPositionMeters', [
					facts.bottomRadiusMeters + (facts.observerHeightMeters ?? 0),
					0,
					0,
				]),
				shaderUniform('uSceneTerminationMeters', 'float', 'geometry.sceneTerminationMeters', 0),
				shaderUniform('uSceneDepthMaxMeters', 'float', 'geometry.sceneDepthMaxMeters', facts.topRadiusMeters),
			]),
			functions: Object.freeze([
				shaderBlock('geometry-constants', 'declareConstants', 0, `const float GEOMETRY_BOTTOM_RADIUS_METERS = ${formatFloat(facts.bottomRadiusMeters)};
const float GEOMETRY_TOP_RADIUS_METERS = ${formatFloat(facts.topRadiusMeters)};
const float GEOMETRY_CACHE_BOUNDARY_ALTITUDE_METERS = ${formatFloat(facts.cacheBoundaryAltitudeMeters ?? 2)};
const vec3 GEOMETRY_OBSERVER_UP_DIRECTION = ${formatVec3(frame.up)};
const vec3 GEOMETRY_OBSERVER_RIGHT_DIRECTION = ${formatVec3(frame.right)};
const vec3 GEOMETRY_OBSERVER_FORWARD_DIRECTION = ${formatVec3(frame.forward)};`),
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
}`),
				shaderBlock('geometry-path-helper', 'resolvePathBounds', 0, `PathBounds resolveAtmospherePath(ViewRay ray, float sceneTerminationMeters, bool hasSceneEndpoint) {
	float radius = length(ray.originMeters);
	float mu = dot(ray.originMeters, ray.direction) / max(radius, 1.0);
	float topDiscriminant =
		radius * radius * (mu * mu - 1.0)
		+ GEOMETRY_TOP_RADIUS_METERS * GEOMETRY_TOP_RADIUS_METERS;
	if (topDiscriminant < 0.0) {
		return PathBounds(0.0, 0.0, 0.0, false, false, false);
	}
	float atmosphereExitMeters = max(0.0, -radius * mu + sqrt(topDiscriminant));
	float boundaryDistanceMeters = atmosphereExitMeters;
	bool hasGroundEndpoint = false;
	float endDistanceMeters = hasSceneEndpoint ? min(max(sceneTerminationMeters, 0.0), boundaryDistanceMeters) : boundaryDistanceMeters;
	return PathBounds(0.0, max(0.0, endDistanceMeters), sceneTerminationMeters, hasSceneEndpoint, hasGroundEndpoint, true);
}`),
				shaderBlock('geometry-cache-coordinate', 'lookupIncidentRadiance', 0, `float resolveCacheAltitudeNormalized(vec3 positionMeters) {
	float altitudeMeters = max(
		length(positionMeters) - GEOMETRY_BOTTOM_RADIUS_METERS,
		GEOMETRY_CACHE_BOUNDARY_ALTITUDE_METERS
	);
	return clamp(
		altitudeMeters / max(GEOMETRY_TOP_RADIUS_METERS - GEOMETRY_BOTTOM_RADIUS_METERS, 1.0),
		0.0,
		0.999999999
	);
}

int resolveCacheAltitudeBinIndex(vec3 positionMeters) {
	float altitude = resolveCacheAltitudeNormalized(positionMeters);
	return int(floor(altitude * float(CACHE_INCIDENT_ALTITUDE_BIN_COUNT)));
}

float resolveCacheAltitudeBinCoordinate(vec3 positionMeters) {
	float altitude = resolveCacheAltitudeNormalized(positionMeters);
	return altitude * float(CACHE_INCIDENT_ALTITUDE_BIN_COUNT) - 0.5;
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
 * Assert that a shader descriptor carries spherical geometry facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the candidate descriptor.
 * @returns {void}
 */
function assertSphericalGeometryDescriptor(descriptor) {
	const facts = descriptor?.geometry?.facts ?? {};

	if (!descriptor?.geometry) {
		throw new TypeError('SphericalEarthGeometry shader contribution requires a geometry descriptor.');
	}

	if (facts.kind && facts.kind !== 'spherical-earth-geometry') {
		throw new TypeError('SphericalEarthGeometry shader contribution requires spherical Earth geometry.');
	}

	if (!Number.isFinite(facts.bottomRadiusMeters) || !Number.isFinite(facts.topRadiusMeters)) {
		throw new TypeError('SphericalEarthGeometry shader contribution requires bottomRadiusMeters and topRadiusMeters.');
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
 * Create an observer-local frame from the observer up direction.
 *
 * @param {UnitVector3} observerUpDirection - Supplies observer up.
 * @returns {object} The frame descriptor.
 */
function makeObserverLocalSceneFrame(observerUpDirection) {
	const reference = Math.abs(VectorMath.dot(observerUpDirection, [0, 0, 1])) < 0.95 ? [0, 0, 1] : [0, 1, 0];
	const tangent = VectorMath.normalize(
		VectorMath.add(reference, VectorMath.scale(observerUpDirection, -VectorMath.dot(reference, observerUpDirection))),
	);

	return Object.freeze({
		kind: 'observer-local',
		up: observerUpDirection,
		right: Object.freeze(VectorMath.normalize(VectorMath.cross(tangent, observerUpDirection))),
		forward: Object.freeze(VectorMath.scale(tangent, -1)),
	});
}

/**
 * Normalize the scene-to-model frame used by shader view-ray reconstruction.
 *
 * @param {unknown} sceneFrame - Supplies the configured frame mode.
 * @param {object} observerLocalSceneFrame - Supplies the derived observer-local frame.
 * @returns {object} Return normalized frame facts.
 */
function normalizeSceneFrame(sceneFrame, observerLocalSceneFrame) {
	if (!sceneFrame || sceneFrame.kind === 'observer-local') {
		return observerLocalSceneFrame;
	}

	if (sceneFrame.kind === 'model-space') {
		return MODEL_SPACE_SCENE_FRAME;
	}

	throw new RangeError('SphericalEarthGeometry sceneFrame.kind must be "observer-local" or "model-space".');
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
 * Resolve a non-negative finite value, or Infinity when explicitly supplied
 * as the fallback.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {number} fallback - Supplies fallback value.
 * @param {string} label - Supplies error label.
 * @returns {number} Non-negative value.
 */
function nonNegativeFiniteOrDefault(value, fallback, label) {
	if (value == null) {
		return fallback;
	}

	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError(`${label} must be a non-negative finite number.`);
	}

	return value;
}

/**
 * Project a scene point radially to a sphere surface.
 *
 * @param {readonly [number, number, number]} point - Supplies scene point.
 * @param {readonly [number, number, number]} center - Supplies sphere center.
 * @param {number} radius - Supplies sphere radius.
 * @param {readonly [number, number, number]} fallbackDirection - Supplies
 * fallback surface normal when point equals center.
 * @returns {SceneVector3} Surface point.
 */
function projectScenePointToSphereSurface(point, center, radius, fallbackDirection) {
	const offset = VectorMath.subtract(point, center);
	const normal = VectorMath.length(offset) > Number.EPSILON
		? VectorMath.normalize(offset)
		: normalizeDirection(fallbackDirection, 'Ground projection fallback direction');

	return Object.freeze(VectorMath.add(center, VectorMath.scale(normal, radius)));
}

/**
 * Intersect a scene ray with a scene-unit sphere.
 *
 * @param {readonly [number, number, number]} origin - Supplies ray origin.
 * @param {UnitVector3} direction - Supplies normalized ray direction.
 * @param {readonly [number, number, number]} center - Supplies sphere center.
 * @param {number} radius - Supplies sphere radius.
 * @returns {{ readonly distance: number, readonly point: SceneVector3 } | null} The
 * nearest non-negative hit.
 */
function intersectSceneRayWithSphere(origin, direction, center, radius) {
	const offset = VectorMath.subtract(origin, center);
	const b = VectorMath.dot(offset, direction);
	const c = VectorMath.dot(offset, offset) - radius ** 2;
	const discriminant = b ** 2 - c;

	if (discriminant < 0) {
		return null;
	}

	const root = Math.sqrt(Math.max(0, discriminant));
	const distances = [-b - root, -b + root]
		.filter((distance) => Number.isFinite(distance) && distance >= -Number.EPSILON)
		.map((distance) => Math.max(0, distance))
		.sort((left, right) => left - right);

	if (distances.length === 0) {
		return null;
	}

	const distance = distances[0];
	const point = Object.freeze(VectorMath.addScaled(origin, direction, distance));

	return Object.freeze({ distance, point });
}

/**
 * Decide whether a sphere hit belongs to the point's local ground patch.
 *
 * @param {object} request - Supplies hit and locality facts.
 * @returns {boolean} True when the hit is local.
 */
function isLocalSphereProjectionHit(request) {
	const {
		hit,
		localSurface,
		centerSceneUnits,
		maxLocalDistanceSceneUnits,
		localNormalDotMin,
	} = request;

	if (
		Number.isFinite(maxLocalDistanceSceneUnits)
		&& hit.distance > maxLocalDistanceSceneUnits
	) {
		return false;
	}

	const localNormal = VectorMath.normalize(VectorMath.subtract(localSurface, centerSceneUnits));
	const hitNormal = VectorMath.normalize(VectorMath.subtract(hit.point, centerSceneUnits));

	return VectorMath.dot(localNormal, hitNormal) >= localNormalDotMin;
}

/**
 * Project a scene direction onto the local tangent plane.
 *
 * @param {readonly [number, number, number]} direction - Supplies scene direction.
 * @param {readonly [number, number, number]} up - Supplies normalized up.
 * @returns {UnitVector3} Tangent direction.
 */
function projectOntoTangentPlane(direction, up) {
	const projected = VectorMath.add(direction, VectorMath.scale(up, -VectorMath.dot(direction, up)));

	if (VectorMath.length(projected) <= Number.EPSILON) {
		throw new RangeError('Ground scene offset axes must not be parallel to observer up.');
	}

	return Object.freeze(VectorMath.normalize(projected));
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
 * @param {string} ownerLabel - Supplies error owner label.
 * @returns {number} Meters per scene unit.
 */
function metersPerSceneUnitFromRequest(request, ownerLabel) {
	const metersPerSceneUnit = request.metersPerSceneUnit
		?? request.distanceMultiplier
		?? request.scaleDenominator
		?? 1;

	if (!Number.isFinite(metersPerSceneUnit) || metersPerSceneUnit <= 0) {
		throw new TypeError(`${ownerLabel} requires a positive metersPerSceneUnit.`);
	}

	return metersPerSceneUnit;
}

/**
 * Resolve optional camera position in Algorithm32 meters.
 *
 * @param {GeometrySceneDepthMaxMetersRequest} request - Supplies camera position facts.
 * @returns {readonly [number, number, number] | null} Camera position in meters.
 */
function cameraPositionMetersOrNull(request, scenePointToModelPosition = null) {
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

	if (typeof scenePointToModelPosition === 'function') {
		return scenePointToModelPosition(vector, metersPerSceneUnit);
	}

	return Object.freeze([
		vector[0] * metersPerSceneUnit,
		vector[1] * metersPerSceneUnit,
		vector[2] * metersPerSceneUnit,
	]);
}

/**
 * Resolve optional endpoint extent in Algorithm32 meters.
 *
 * @param {GeometrySceneDepthMaxMetersRequest} request - Supplies endpoint range facts.
 * @param {readonly [number, number, number] | null} cameraPositionMeters - Supplies camera position.
 * @returns {number | null} Endpoint extent in meters, or null.
 */
function endpointExtentMetersOrNull(request, cameraPositionMeters, scenePointToModelPosition = null) {
	const endpointPositionMeters = endpointPositionMetersListOrNull(request, scenePointToModelPosition);

	if (endpointPositionMeters && cameraPositionMeters) {
		return endpointPositionMeters.reduce((maximum, position) => Math.max(
			maximum,
			VectorMath.distance(cameraPositionMeters, position),
		), 0);
	}

	const endpointExtentMeters = request.endpointExtentMeters
		?? request.endpointMaxDistanceMeters
		?? request.endpointRangeMeters;

	if (Number.isFinite(endpointExtentMeters) && endpointExtentMeters > 0) {
		return endpointExtentMeters;
	}

	const endpointExtentSceneUnits = request.endpointExtentSceneUnits
		?? request.endpointMaxDistanceSceneUnits
		?? request.endpointRangeSceneUnits;

	if (!Number.isFinite(endpointExtentSceneUnits) || endpointExtentSceneUnits <= 0) {
		return null;
	}

	const metersPerSceneUnit = request.metersPerSceneUnit
		?? request.distanceMultiplier
		?? request.scaleDenominator;

	if (!Number.isFinite(metersPerSceneUnit) || metersPerSceneUnit <= 0) {
		return null;
	}

	return endpointExtentSceneUnits * metersPerSceneUnit;
}

/**
 * Resolve optional endpoint positions in Algorithm32 meters.
 *
 * @param {GeometrySceneDepthMaxMetersRequest} request - Supplies endpoint positions.
 * @returns {readonly (readonly [number, number, number])[] | null} Endpoint positions.
 */
function endpointPositionMetersListOrNull(request, scenePointToModelPosition = null) {
	const endpointPositionsMeters = request.endpointPositionsMeters
		?? request.endpointWorldPositionsMeters;

	if (Array.isArray(endpointPositionsMeters)) {
		return Object.freeze(endpointPositionsMeters.map((position) =>
			toVector3(position, 'Endpoint position in meters')));
	}

	const endpointPositionMeters = request.endpointPositionMeters
		?? request.endpointWorldPositionMeters;

	if (endpointPositionMeters) {
		return Object.freeze([toVector3(endpointPositionMeters, 'Endpoint position in meters')]);
	}

	const endpointPositionsSceneUnits = request.endpointPositionsSceneUnits
		?? request.endpointWorldPositionsSceneUnits;
	const endpointSceneUnitPositions = Array.isArray(endpointPositionsSceneUnits)
		? endpointPositionsSceneUnits
		: null;
	const endpointPositionSceneUnits = request.endpointPositionSceneUnits
		?? request.endpointWorldPositionSceneUnits;
	const positions = endpointSceneUnitPositions
		?? (endpointPositionSceneUnits ? [endpointPositionSceneUnits] : null);

	if (!positions) {
		return null;
	}

	const metersPerSceneUnit = request.metersPerSceneUnit
		?? request.distanceMultiplier
		?? request.scaleDenominator;

	if (!Number.isFinite(metersPerSceneUnit) || metersPerSceneUnit <= 0) {
		return null;
	}

	return Object.freeze(positions.map((position) => {
		const vector = toVector3(position, 'Endpoint position in scene units');

		if (typeof scenePointToModelPosition === 'function') {
			return scenePointToModelPosition(vector, metersPerSceneUnit);
		}

		return Object.freeze([
			vector[0] * metersPerSceneUnit,
			vector[1] * metersPerSceneUnit,
			vector[2] * metersPerSceneUnit,
		]);
	}));
}

/**
 * Resolve a positive finite value with fallback.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {number} fallback - Supplies fallback value.
 * @returns {number} Positive finite value.
 */
function positiveFiniteOrDefault(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Normalize optional spherical ground visual mesh policy.
 *
 * @param {unknown} value - Supplies visual mesh request.
 * @returns {object} Normalized visual mesh request.
 */
function normalizeGroundVisualMeshRequest(value) {
	if (value == null) {
		return Object.freeze({ kind: 'sphere' });
	}

	const candidate = typeof value === 'string' ? { kind: value } : value;
	const kind = candidate?.kind ?? 'sphere';

	if (!['sphere', 'local-spherical-patch'].includes(kind)) {
		throw new RangeError('groundVisualMesh.kind must be "sphere" or "local-spherical-patch".');
	}

	return Object.freeze({
		kind,
		xExtentSceneUnits: candidate.xExtentSceneUnits,
		zMinSceneUnits: candidate.zMinSceneUnits,
		zMaxSceneUnits: candidate.zMaxSceneUnits,
		surfaceLiftSceneUnits: candidate.surfaceLiftSceneUnits,
	});
}

/**
 * Create a local visual patch sampled from the analytic scaled sphere.
 *
 * @param {object} request - Supplies sphere, observer, and segmentation facts.
 * @returns {THREE.BufferGeometry} Local spherical patch geometry.
 */
function createLocalSphericalGroundPatchGeometry(request) {
	const {
		radiusSceneUnits,
		widthSegments,
		heightSegments,
		observerAltitudeSceneUnits,
		centerSceneUnits,
		groundVisualMesh,
	} = request;
	const horizonDistanceSceneUnits = Math.sqrt(Math.max(
		0,
		(radiusSceneUnits + observerAltitudeSceneUnits) ** 2 - radiusSceneUnits ** 2,
	));
	const surfaceLiftSceneUnits = nonNegativeFiniteOrDefault(
		groundVisualMesh.surfaceLiftSceneUnits,
		0,
		'groundVisualMesh.surfaceLiftSceneUnits',
	);
	const surfaceRadiusSceneUnits = radiusSceneUnits + surfaceLiftSceneUnits;
	const xExtent = positiveFiniteOrDefault(
		groundVisualMesh.xExtentSceneUnits,
		Math.max(horizonDistanceSceneUnits * 1.2, 40),
	);
	const zMin = Number.isFinite(groundVisualMesh.zMinSceneUnits)
		? groundVisualMesh.zMinSceneUnits
		: Math.min(-horizonDistanceSceneUnits * 1.8, -80);
	const zMax = Number.isFinite(groundVisualMesh.zMaxSceneUnits)
		? groundVisualMesh.zMaxSceneUnits
		: Math.max(horizonDistanceSceneUnits * 0.25, 12);
	const positions = [];
	const indices = [];

	for (let zIndex = 0; zIndex <= heightSegments; zIndex += 1) {
		const zRatio = zIndex / heightSegments;
		const z = zMin + (zMax - zMin) * zRatio;

		for (let xIndex = 0; xIndex <= widthSegments; xIndex += 1) {
			const xRatio = xIndex / widthSegments;
			const x = -xExtent + xExtent * 2 * xRatio;

			positions.push(x, sphereSurfaceYAt({
				x,
				z,
				radiusSceneUnits: surfaceRadiusSceneUnits,
				centerSceneUnits,
			}), z);
		}
	}

	for (let zIndex = 0; zIndex < heightSegments; zIndex += 1) {
		for (let xIndex = 0; xIndex < widthSegments; xIndex += 1) {
			const a = zIndex * (widthSegments + 1) + xIndex;
			const b = a + 1;
			const c = (zIndex + 1) * (widthSegments + 1) + xIndex;
			const d = c + 1;

			indices.push(a, c, b, b, c, d);
		}
	}

	const geometry = new THREE.BufferGeometry();

	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	geometry.userData.algorithm32GroundPatch = Object.freeze({
		kind: 'local-spherical-ground-patch',
		surfacePolicy: 'vertices-sampled-from-analytic-scaled-sphere',
		xRangeSceneUnits: Object.freeze([-xExtent, xExtent]),
		zRangeSceneUnits: Object.freeze([zMin, zMax]),
		xSegments: widthSegments,
		zSegments: heightSegments,
		surfaceLiftSceneUnits,
	});

	return geometry;
}

/**
 * Resolve the visible top half of a Y-up sphere at a local x/z point.
 *
 * @param {object} request - Supplies local x/z and sphere radius.
 * @returns {number} Surface y in scene units.
 */
function sphereSurfaceYAt({ x, z, radiusSceneUnits, centerSceneUnits }) {
	const horizontalDistanceSquared = x ** 2 + z ** 2;
	const offset = Math.sqrt(Math.max(0, radiusSceneUnits ** 2 - horizontalDistanceSquared));

	return centerSceneUnits[1] + offset;
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
 * Clamp a value into a range.
 *
 * @param {number} value - Supplies the value.
 * @param {number} min - Supplies the minimum.
 * @param {number} max - Supplies the maximum.
 * @returns {number} The clamped value.
 */
function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

export default SphericalEarthGeometry;
