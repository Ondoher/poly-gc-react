/**
 * Resolve the camera ray segment that participates in atmosphere transport.
 */
export default class ResolveRayPathStage {
	/**
	 * Create the resolveRayPath stage helper.
	 *
	 * @param {{ descriptor: AtmosphereReferenceStageDescriptor, context?: Readonly<AtmosphereReferenceIntegratorOptions> }} options - Configure the stage helper.
	 */
	constructor({ descriptor, context } = {}) {
		/**
		 * Store this stage's descriptor for history and error context.
		 *
		 * @type {AtmosphereReferenceStageDescriptor}
		 */
		this.descriptor = descriptor;

		/**
		 * Store integrator defaults for helpers that need them.
		 *
		 * @type {Readonly<AtmosphereReferenceIntegratorOptions> | undefined}
		 */
		this.context = context;
	}

	/**
	 * Resolve a model-returned atmosphere interval into the camera transport segment.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide the prepared stage packet.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		const validatedRequest = this.resolveValidatedRequest(packet.validatedRequest);
		const transportRay = this.createTransportRay(validatedRequest);

		// Algorithm reference: PBRT Rays defines the parametric ray used by model
		// intersections; local Code Design makes atmosphere/surface intersections
		// model-owned inputs to this stage rather than geometry computed here.
		// See Reference Decision Log, resolveRayPath Implementation Branch Source Map.
		const atmosphereIntersection = validatedRequest.model.atmosphere.intersect(transportRay);
		const surfaceHit = validatedRequest.model.world.intersectSurface(transportRay);

		return {
			// Branch source: this stage preserves the prepared packet, emits only
			// the selected rayPath handoff, and records its own stage id.
			// See Stage Contracts, resolveRayPath output contract.
			...packet,
			rayPath: this.resolveRayPath(atmosphereIntersection, surfaceHit),
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
		};
	}

	/**
	 * Narrow the packet field to the validated request shape required by this stage.
	 *
	 * @param {AtmosphereReferenceValidatedTraceRequest | undefined} validatedRequest - Provide the packet field to narrow.
	 * @returns {AtmosphereReferenceValidatedTraceRequest}
	 */
	resolveValidatedRequest(validatedRequest) {
		if (!validatedRequest || typeof validatedRequest !== 'object') {
			// Reason: resolveRayPath runs after validateRequest and consumes its canonical packet field.
			// Source: Reference Code Design, canonical stage descriptors.
			throw new Error('resolveRayPath requires validatedRequest');
		}

		return /** @type {AtmosphereReferenceValidatedTraceRequest} */ (validatedRequest);
	}

	/**
	 * Build the ray object passed to model-owned intersection methods.
	 *
	 * @param {AtmosphereReferenceValidatedTraceRequest} validatedRequest - Provide canonical request data.
	 * @returns {AtmosphereReferenceTransportRay}
	 */
	createTransportRay(validatedRequest) {
		if (!validatedRequest?.model?.atmosphere?.intersect) {
			// Reason: resolveRayPath consumes model-owned atmosphere intersections, not hard-coded geometry.
			// Source: Reference Code Design, Model Interface.
			throw new Error('resolveRayPath requires model.atmosphere.intersect');
		}

		if (!validatedRequest?.model?.world?.intersectSurface) {
			// Reason: visible surface boundaries are model-owned and can clip the atmosphere path.
			// Source: Reference Code Design, Model Interface.
			throw new Error('resolveRayPath requires model.world.intersectSurface');
		}

		return {
			// Branch source: downstream model interfaces consume the validated
			// observer origin and normalized direction; this stage does not
			// reconstruct or re-normalize request data.
			// See Reference Decision Log, resolveRayPath Implementation Branch Source Map.
			originKm: validatedRequest.observer.positionKm,
			direction: validatedRequest.ray.direction,
		};
	}

	/**
	 * Resolve the path output from model-returned atmosphere and surface data.
	 *
	 * @param {AtmosphereReferenceAtmosphereIntersection | null} atmosphereIntersection - Provide model-returned atmosphere interval data.
	 * @param {AtmosphereReferenceSurfaceHit | null} surfaceHit - Provide model-returned surface-hit data.
	 * @returns {AtmosphereReferenceRayPath}
	 */
	resolveRayPath(atmosphereIntersection, surfaceHit) {
		if (atmosphereIntersection === null || atmosphereIntersection === undefined) {
			// Algorithm reference: a null model intersection is a real empty segment.
			// Source: Reference Test Design, resolveRayPath miss-empty-path row; Bruneton testing
			// discipline supports explicit outcomes instead of hidden fallback distances.
			return this.createEmptyRayPath('atmosphere-miss', null, null);
		}

		if (atmosphereIntersection.unbounded === true) {
			// Reason: flat horizontal slab paths need a finite named lateral boundary before integration.
			// Source: Reference Code Design, flat/local-Sun model contract.
			throw new RangeError('resolveRayPath requires a finite lateral boundary for unbounded paths');
		}

		const tMinKm = this.validateFiniteDistance(
			atmosphereIntersection.tMinKm,
			'tMinKm',
		);
		const tMaxKm = this.validateFiniteDistance(
			atmosphereIntersection.tMaxKm,
			'tMaxKm',
		);

		if (tMaxKm < tMinKm) {
			// Reason: model-owned intervals must be ordered before they can define transport.
			// Source: Reference Test Design, resolveRayPath invalid intersection rows.
			throw new RangeError('resolveRayPath requires tMinKm <= tMaxKm');
		}

		if (tMaxKm < 0) {
			// Algorithm reference: PBRT Rays uses the forward ray domain t >= 0;
			// an interval entirely below that domain contributes no camera transport.
			return this.createEmptyRayPath('no-forward-atmosphere-segment', null, null);
		}

		// Algorithm reference: PBRT Rays supplies the forward-domain lower bound,
		// while the local resolveRayPath contract clips model intervals crossing
		// the observer to t = 0 instead of treating negative entry as invalid.
		const startKm = Math.max(0, tMinKm);
		const surfaceDistanceKm = this.surfaceDistanceKm(surfaceHit);

		if (
			Number.isFinite(surfaceDistanceKm)
			&& surfaceDistanceKm >= 0
			&& surfaceDistanceKm < startKm
		) {
			// Algorithm reference: ordered ray parameters decide event order along
			// one camera ray; a nearer opaque surface prevents reaching the
			// atmosphere entry interval behind it.
			return this.createEmptyRayPath(
				'surface-before-atmosphere-entry',
				surfaceHit.boundaryId ?? null,
				surfaceHit,
			);
		}

		if (
			Number.isFinite(surfaceDistanceKm)
			&& surfaceDistanceKm === startKm
			&& startKm > 0
		) {
			// Algorithm reference: zero-distance transport is meaningful but has
			// no positive measure; the local boundary-precedence contract treats an
			// opaque surface exactly at atmosphere entry as blocking the interval.
			return this.createEmptyRayPath(
				'surface-at-atmosphere-entry',
				surfaceHit.boundaryId ?? null,
				surfaceHit,
			);
		}

		if (
			Number.isFinite(surfaceDistanceKm)
			&& surfaceDistanceKm >= startKm
			&& surfaceDistanceKm < tMaxKm
		) {
			// Algorithm reference: PBRT Transmittance treats transport between two
			// finite points; the local surface-clipping contract chooses the
			// nearer visible boundary as the segment end.
			return this.createRayPath({
				startKm,
				endKm: surfaceDistanceKm,
				boundaryReason: surfaceHit.boundaryReason ?? 'surface-hit',
				boundaryId: surfaceHit.boundaryId ?? null,
				surfaceHit,
			});
		}

		if (
			Number.isFinite(surfaceDistanceKm)
			&& surfaceDistanceKm === tMaxKm
		) {
			// Algorithm reference: coincident ray parameters need local diagnostic
			// precedence. The visible endpoint is a surface, while atmosphere exit
			// diagnostics are preserved as metadata.
			return this.createRayPath({
				startKm,
				endKm: surfaceDistanceKm,
				boundaryReason: surfaceHit.boundaryReason ?? 'surface-hit',
				boundaryId: surfaceHit.boundaryId ?? null,
				surfaceHit,
				metadata: {
					coincidentAtmosphereBoundary: {
						boundaryReason: atmosphereIntersection.boundaryReason ?? 'atmosphere-exit',
						boundaryId: atmosphereIntersection.boundaryId ?? null,
					},
				},
			});
		}

		// Algorithm reference: when no nearer surface clips the interval, the
		// model-owned atmosphere exit or lateral boundary remains the transport
		// endpoint and its diagnostics are preserved for later reports.
		return this.createRayPath({
			startKm,
			endKm: tMaxKm,
			boundaryReason: atmosphereIntersection.boundaryReason ?? 'atmosphere-exit',
			boundaryId: atmosphereIntersection.boundaryId ?? null,
			surfaceHit: null,
			metadata: atmosphereIntersection.metadata,
		});
	}

	/**
	 * Validate a model-returned distance endpoint.
	 *
	 * @param {number | undefined} distanceKm - Provide the distance candidate.
	 * @param {string} fieldName - Identify the field in errors.
	 * @returns {number}
	 */
	validateFiniteDistance(distanceKm, fieldName) {
		if (!Number.isFinite(distanceKm)) {
			// Reason: downstream sampling and transmittance integrate over finite path distances.
			// Source: PBRT Transmittance; Reference Test Design, resolveRayPath finite-distance rows.
			throw new RangeError(`resolveRayPath requires finite ${fieldName}`);
		}

		return distanceKm;
	}

	/**
	 * Return the surface-hit distance when present.
	 *
	 * @param {AtmosphereReferenceSurfaceHit | null} surfaceHit - Provide model-returned surface-hit data.
	 * @returns {number | undefined}
	 */
	surfaceDistanceKm(surfaceHit) {
		if (!surfaceHit) {
			// Branch source: absence of a surface hit leaves atmosphere interval
			// selection unchanged and does not create surface diagnostics.
			// See Stage Contracts, surfaceHit carry rules.
			return undefined;
		}

		if (!Object.prototype.hasOwnProperty.call(surfaceHit, 'tKm')) {
			// Branch source: a hit-like object without tKm is not orderable
			// against atmosphere endpoints, so it cannot clip this stage's
			// atmosphere segment.
			// See Reference Decision Log, resolveRayPath Implementation Branch Source Map.
			return undefined;
		}

		if (!Number.isFinite(surfaceHit.tKm)) {
			// Reason: a present surface hit must be orderable against atmosphere interval endpoints.
			// Source: Reference Code Design, resolveRayPath boundary precedence; PBRT Rays.
			throw new RangeError('resolveRayPath requires finite surfaceHit.tKm');
		}

		// Branch source: negative finite hits are behind the observer in the
		// PBRT forward-ray domain. Returning the negative value lets the
		// ordering branches ignore it without carrying a selected surfaceHit.
		// See ray-path.surface-hit.negative-distance-ignored fixture row.
		return surfaceHit.tKm;
	}

	/**
	 * Create an explicit empty ray path.
	 *
	 * @param {string} boundaryReason - Describe why no transport segment exists.
	 * @param {string | null} boundaryId - Preserve model-owned boundary id when present.
	 * @param {AtmosphereReferenceSurfaceHit | null} surfaceHit - Preserve surface hit when it caused the empty path.
	 * @returns {AtmosphereReferenceRayPath}
	 */
	createEmptyRayPath(boundaryReason, boundaryId, surfaceHit) {
		// Branch source: empty paths are explicit packet outputs with zero
		// finite segment length; no hidden max distance or epsilon segment is
		// invented.
		// See Stage Contracts, resolveRayPath output; PBRT Transmittance zero-distance semantics.
		return {
			isEmpty: true,
			viewSegment: {
				startKm: 0,
				endKm: 0,
				lengthKm: 0,
			},
			boundaryReason,
			boundaryId,
			surfaceHit,
		};
	}

	/**
	 * Create a selected ray path with optional model metadata.
	 *
	 * @param {{ startKm: number, endKm: number, boundaryReason: string, boundaryId: string | null, surfaceHit: AtmosphereReferenceSurfaceHit | null, metadata?: Record<string, unknown> }} options - Provide selected segment data.
	 * @returns {AtmosphereReferenceRayPath}
	 */
	createRayPath({
		startKm,
		endKm,
		boundaryReason,
		boundaryId,
		surfaceHit,
		metadata,
	}) {
		/** @type {AtmosphereReferenceRayPath} */
		const rayPath = {
			// Branch source: zero-length finite paths remain valid explicit
			// outputs, while positive intervals carry their finite path length for
			// sampleViewPath and optical-depth integration.
			// See Reference Decision Log, resolveRayPath Implementation Branch Source Map.
			isEmpty: endKm - startKm === 0,
			viewSegment: {
				startKm,
				endKm,
				lengthKm: endKm - startKm,
			},
			boundaryReason,
			boundaryId,
			surfaceHit,
		};

		if (metadata !== undefined) {
			// Branch source: model-owned metadata is preserved only when it
			// belongs to the selected atmosphere endpoint or coincident boundary
			// diagnostics.
			// See Stage Contracts, diagnostics consume rayPath.metadata.
			rayPath.metadata = metadata;
		}

		return rayPath;
	}
}
