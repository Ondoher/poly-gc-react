import {
	normalizeRayPathSegment,
	normalizeVector3,
} from '../index.js';

describe('atmosphere reference utilities', function() {
	describe('normalizeVector3', function() {
		it('normalizes axis-aligned vectors', function() {
			// Reason: ray directions carry orientation while downstream distances carry magnitude.
			// Source: PBRT v4 Rays Section 3.6; a ray is evaluated as o + t*d.
			// Derivation: [0, 2, 0] / 2 = [0, 1, 0], and [0, -10, 0] / 10 = [0, -1, 0].
			expect(normalizeVector3([0, 2, 0])).toEqual([0, 1, 0]);
			expect(normalizeVector3([0, -10, 0])).toEqual([0, -1, 0]);
		});

		it('normalizes non-axis-aligned vectors', function() {
			// Reason: canonicalized directions must preserve orientation for arbitrary finite vectors.
			// Source: PBRT v4 Rays Section 3.6 plus Euclidean vector normalization.
			// Derivation: length([3, 4, 0]) = 5, so normalized vector is [3 / 5, 4 / 5, 0].
			expect(normalizeVector3([3, 4, 0])).toEqual([0.6, 0.8, 0]);
		});

		it('returns an immutable normalized tuple', function() {
			const result = normalizeVector3([1, 0, 0]);

			// Reason: validated vectors should not be mutated after becoming canonical packet data.
			// Source: local API policy in Reference Code Design, packet stages are value transforms.
			expect(Object.isFrozen(result)).toBeTrue();
		});

		it('rejects zero vectors', function() {
			// Reason: a zero vector has no orientation and cannot define a ray direction.
			// Source: PBRT v4 Rays Section 3.6; d in o + t*d must define direction.
			expect(() => normalizeVector3([0, 0, 0], { label: 'ray.direction' })).toThrowError(
				/ray\.direction length must be at least/,
			);
		});

		it('rejects vectors below the configured minimum length', function() {
			// Reason: near-zero vectors are local numerical-policy failures before division by length.
			// Source: Reference Test Design, validateRequest hardening; minLength is a local stability threshold.
			expect(() => normalizeVector3([1e-20, 0, 0], {
				label: 'ray.direction',
				minLength: 1e-12,
			})).toThrowError(/ray\.direction length must be at least 1e-12/);
		});

		it('accepts vectors at the configured minimum length', function() {
			// Reason: the configured threshold is inclusive so callers can set an exact validation boundary.
			// Source: local utility contract; minLength owns the numerical acceptance limit.
			// Derivation: [1e-12, 0, 0] / 1e-12 = [1, 0, 0].
			expect(normalizeVector3([1e-12, 0, 0], {
				label: 'ray.direction',
				minLength: 1e-12,
			})).toEqual([1, 0, 0]);
		});

		it('rejects non-finite vector components', function() {
			// Reason: non-finite coordinates make ray/path arithmetic undefined.
			// Source: Reference Code Design, Inputs; observer and ray vectors are finite model-space tuples.
			expect(() => normalizeVector3([NaN, 0, 0], { label: 'ray.direction' })).toThrowError(
				/ray\.direction must be a finite 3-vector/,
			);
			expect(() => normalizeVector3([Infinity, 0, 0], { label: 'ray.direction' })).toThrowError(
				/ray\.direction must be a finite 3-vector/,
			);
		});

		it('rejects non-3-vector inputs', function() {
			// Reason: the reference geometry contract is 3D even when a flat-world model is configured.
			// Source: Reference Code Design, Model Interface; positions and directions are 3-component vectors.
			expect(() => normalizeVector3([1, 0], { label: 'ray.direction' })).toThrowError(
				/ray\.direction must be a finite 3-vector/,
			);
			expect(() => normalizeVector3(null, { label: 'ray.direction' })).toThrowError(
				/ray\.direction must be a finite 3-vector/,
			);
		});

		it('rejects invalid minimum lengths', function() {
			// Reason: the tolerance boundary itself must be finite and positive to distinguish usable from zero direction.
			// Source: local utility contract; minLength is a numerical guard, not a physical constant.
			expect(() => normalizeVector3([1, 0, 0], {
				label: 'ray.direction',
				minLength: 0,
			})).toThrowError(/ray\.direction minLength must be a positive finite number/);
		});
	});

	describe('normalizeRayPathSegment', function() {
		it('normalizes finite coherent segment distances', function() {
			// Reason: sampleViewPath consumes one canonical finite segment before placing samples.
			// Source: Reference Code Design, sampleViewPath Output Shape.
			expect(normalizeRayPathSegment({
				startKm: 2,
				endKm: 12,
				lengthKm: 10,
			})).toEqual({
				startKm: 2,
				endKm: 12,
				lengthKm: 10,
			});
		});

		it('canonicalizes tiny stored-length drift to the endpoint-derived length', function() {
			const result = normalizeRayPathSegment({
				startKm: 0.1,
				endKm: 0.3,
				lengthKm: 0.2,
			});

			// Reason: the normalizer owns numerical acceptance for representation drift between
			// equivalent endpoint and length fields; stages should consume the canonical result.
			// Source: local utility contract for ray-path segment normalization.
			expect(result.lengthKm).toBe(0.3 - 0.1);
		});

		it('returns an immutable normalized segment', function() {
			const result = normalizeRayPathSegment({
				startKm: 0,
				endKm: 1,
				lengthKm: 1,
			});

			// Reason: normalized packet data should not be mutated after canonicalization.
			// Source: local API policy in Reference Code Design, packet stages are value transforms.
			expect(Object.isFrozen(result)).toBeTrue();
		});

		it('rejects negative path length', function() {
			// Reason: path length is an integration measure and cannot be negative.
			// Source: PBRT Transmittance finite path integral; sampleViewPath invalid length row.
			expect(() => normalizeRayPathSegment({
				startKm: 10,
				endKm: 0,
				lengthKm: -10,
			}, { label: 'sampleViewPath rayPath.viewSegment' })).toThrowError(
				/sampleViewPath rayPath\.viewSegment lengthKm must be nonnegative/,
			);
		});

		it('rejects inconsistent length outside the configured tolerance', function() {
			// Reason: samples must partition the endpoint-defined interval, so contradictory
			// segment data is rejected instead of silently choosing one value.
			// Source: PBRT Rays ordered ray parameters; sampleViewPath inconsistent-length row.
			expect(() => normalizeRayPathSegment({
				startKm: 0,
				endKm: 10,
				lengthKm: 9,
			}, { label: 'sampleViewPath rayPath.viewSegment' })).toThrowError(
				/sampleViewPath rayPath\.viewSegment lengthKm must equal endKm - startKm/,
			);
		});

		it('rejects non-finite segment distances', function() {
			// Reason: midpoint sample positions and weights must be finite path distances.
			// Source: PBRT Transmittance finite path distance; sampleViewPath non-finite row.
			expect(() => normalizeRayPathSegment({
				startKm: Infinity,
				endKm: 10,
				lengthKm: 10,
			}, { label: 'sampleViewPath rayPath.viewSegment' })).toThrowError(
				/sampleViewPath rayPath\.viewSegment startKm must be finite/,
			);
		});

		it('rejects invalid length tolerance configuration', function() {
			// Reason: the tolerance boundary is local numerical policy and must itself be finite and nonnegative.
			// Source: Reference Test Design, tolerance checklist item.
			expect(() => normalizeRayPathSegment({
				startKm: 0,
				endKm: 1,
				lengthKm: 1,
			}, { lengthToleranceKm: -1 })).toThrowError(
				/rayPath\.viewSegment lengthToleranceKm must be a nonnegative finite number/,
			);
		});
	});
});
