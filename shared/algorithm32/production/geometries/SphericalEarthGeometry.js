import VectorMath from '../utils/VectorMath.js';

const IDENTITY_MATRIX4 = Object.freeze([
	1, 0, 0, 0,
	0, 1, 0, 0,
	0, 0, 1, 0,
	0, 0, 0, 1,
]);

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

		this._configuration = Object.freeze({
			bottomRadiusMeters,
			topRadiusMeters,
			observerHeightMeters,
			observerUpDirection: normalizedObserverUpDirection,
			observerLocalSceneFrame: makeObserverLocalSceneFrame(normalizedObserverUpDirection),
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
			kind: 'observer-local-spherical-frame',
			observerUpDirection: this._configuration.observerUpDirection,
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

	/**
	 * Create the geometry-owned spherical shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the geometry contribution.
	 */
	_createShaderContribution(descriptor) {
		assertSphericalGeometryDescriptor(descriptor);
		const facts = descriptor.geometry.facts ?? {};
		const frame = facts.observerLocalSceneFrame ?? Object.freeze({
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
		up: observerUpDirection,
		right: Object.freeze(VectorMath.normalize(VectorMath.cross(tangent, observerUpDirection))),
		forward: Object.freeze(VectorMath.scale(tangent, -1)),
	});
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

	throw new TypeError(`${label} must be a finite three-component vector.`);
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
