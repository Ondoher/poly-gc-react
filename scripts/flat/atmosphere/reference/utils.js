const DEFAULT_NORMALIZE_VECTOR3_MIN_LENGTH = 1e-12;
const DEFAULT_NORMALIZE_RAY_PATH_SEGMENT_LENGTH_TOLERANCE_KM = 1e-12;

/**
 * Normalize a finite nonzero 3-vector.
 *
 * The minimum length acts as the tolerance boundary for rejecting zero or
 * near-zero inputs before dividing by length.
 *
 * @param {unknown} value - Provide the vector-like value to normalize.
 * @param {AtmosphereReferenceNormalizeVector3Options} options - Configure labeling and tolerance.
 * @returns {AtmosphereReferenceVector3Tuple}
 */
export function normalizeVector3(value, {
	label = 'vector',
	minLength = DEFAULT_NORMALIZE_VECTOR3_MIN_LENGTH,
} = {}) {
	if (!Array.isArray(value) || value.length !== 3) {
		// Reason: reference geometry uses finite 3D tuples even for flat-world configurations.
		// Source: Reference Code Design, Inputs and Model Interface.
		throw new Error(`${label} must be a finite 3-vector`);
	}

	if (!Number.isFinite(minLength) || minLength <= 0) {
		// Reason: minLength is a local numerical guard and must define a positive acceptance boundary.
		// Source: Reference Test Design, validateRequest hardening.
		throw new Error(`${label} minLength must be a positive finite number`);
	}

	const vector = value.map((component) => {
		if (!Number.isFinite(component)) {
			// Reason: non-finite components make ray/path arithmetic undefined.
			// Source: Reference Code Design, Inputs; vectors are finite model-space numbers.
			throw new Error(`${label} must be a finite 3-vector`);
		}

		return component;
	});

	const length = Math.hypot(vector[0], vector[1], vector[2]);

	if (length < minLength) {
		// Reason: a zero or near-zero vector cannot provide a stable orientation before normalization.
		// Source: PBRT v4 Rays Section 3.6 for ray direction semantics; threshold is local numerical policy.
		throw new Error(`${label} length must be at least ${minLength}`);
	}

	return Object.freeze([
		vector[0] / length,
		vector[1] / length,
		vector[2] / length,
	]);
}

/**
 * Normalize a finite ray-path segment and canonicalize its length field.
 *
 * The stored length must agree with `endKm - startKm` within the configured
 * local numerical tolerance. The returned segment uses the endpoint-derived
 * length so downstream sampling has one canonical interval measure.
 *
 * @param {unknown} value - Provide the segment-like value to normalize.
 * @param {AtmosphereReferenceNormalizeRayPathSegmentOptions} options - Configure labeling and tolerance.
 * @returns {AtmosphereReferenceRayPathSegment}
 */
export function normalizeRayPathSegment(value, {
	label = 'rayPath.viewSegment',
	lengthToleranceKm = DEFAULT_NORMALIZE_RAY_PATH_SEGMENT_LENGTH_TOLERANCE_KM,
} = {}) {
	if (!value || typeof value !== 'object') {
		// Reason: sampling is defined over a named finite segment, not over loose distance fields.
		// Source: Reference Code Design, sampleViewPath Output Shape.
		throw new Error(`${label} must be a finite ray-path segment`);
	}

	if (!Number.isFinite(lengthToleranceKm) || lengthToleranceKm < 0) {
		// Reason: tolerance is a local numerical acceptance boundary and cannot be negative or non-finite.
		// Source: Reference Test Design, tolerance checklist item.
		throw new Error(`${label} lengthToleranceKm must be a nonnegative finite number`);
	}

	const startKm = normalizeFiniteSegmentDistance(value.startKm, label, 'startKm');
	const endKm = normalizeFiniteSegmentDistance(value.endKm, label, 'endKm');
	const lengthKm = normalizeFiniteSegmentDistance(value.lengthKm, label, 'lengthKm');

	if (lengthKm < 0) {
		// Reason: path length is an integration measure and cannot be negative.
		// Source: PBRT Transmittance finite path integral; Reference Test Plan sampleViewPath invalid length row.
		throw new RangeError(`${label} lengthKm must be nonnegative`);
	}

	const endpointLengthKm = endKm - startKm;
	if (Math.abs(lengthKm - endpointLengthKm) > lengthToleranceKm) {
		// Reason: downstream samples must partition the same interval defined by the segment endpoints.
		// Source: PBRT Rays ordered ray parameter semantics; Reference Test Plan inconsistent-length row.
		throw new RangeError(`${label} lengthKm must equal endKm - startKm`);
	}

	return Object.freeze({
		startKm,
		endKm,
		lengthKm: endpointLengthKm,
	});
}

/**
 * Normalize one finite segment distance value.
 *
 * @param {unknown} distanceKm - Provide the distance candidate.
 * @param {string} label - Identify the containing segment.
 * @param {string} fieldName - Identify the segment field.
 * @returns {number}
 */
function normalizeFiniteSegmentDistance(distanceKm, label, fieldName) {
	if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) {
		// Reason: midpoint sample positions and weights must be finite path distances.
		// Source: PBRT Transmittance finite path distance; Reference Test Plan non-finite segment row.
		throw new RangeError(`${label} ${fieldName} must be finite`);
	}

	return distanceKm;
}
