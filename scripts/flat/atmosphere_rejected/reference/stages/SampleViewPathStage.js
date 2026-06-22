import { normalizeRayPathSegment } from '../utils.js';

/**
 * Sample the selected view path for numerical integration.
 */
export default class SampleViewPathStage {
	/**
	 * Create the sampleViewPath stage helper.
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
	 * Sample the selected ray segment with fixed midpoint integration.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide the prepared stage packet.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		const rayPath = this.validateRayPath(packet.rayPath);
		// Branch source: normalizeRayPathSegment centralizes finite,
		// nonnegative, internally consistent segment validation for all stages
		// that consume rayPath.viewSegment.
		// See Reference Decision Log, sampleViewPath Implementation Branch Source Map.
		const viewSegment = normalizeRayPathSegment(rayPath.viewSegment, {
			label: 'sampleViewPath rayPath.viewSegment',
		});
		const viewSteps = this.resolveViewSteps(packet);

		if (rayPath.isEmpty || viewSegment.lengthKm === 0) {
			// Algorithm reference: PBRT Transmittance treats zero-distance
			// transport as an integral with no path measure. The local output
			// contract records metadata but does not invent epsilon samples.
			// See Stage Contracts, sampleViewPath empty and zero-length policy.
			return {
				...packet,
				viewSamples: [],
				viewSampleMetadata: this.createViewSampleMetadata(0, viewSegment.lengthKm),
				stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
			};
		}

		// Algorithm reference: the composite midpoint rule partitions the
		// interval into equal subintervals, evaluates at each center, and uses
		// each subinterval width as the integration weight.
		// Source: Reference Test Plan sampleViewPath rows; numerical integration
		// midpoint-rule reference.
		const stepLengthKm = viewSegment.lengthKm / viewSteps;
		const viewSamples = Array.from({ length: viewSteps }, (_, sampleIndex) => {
			const intervalStartKm = viewSegment.startKm + stepLengthKm * sampleIndex;
			const intervalEndKm = intervalStartKm + stepLengthKm;

			return {
				// Branch source: each midpoint sample carries both the center
				// distance used for integrand evaluation and interval endpoints
				// used later for path-end diagnostics.
				// See Reference Decision Log, sampleViewPath Implementation Branch Source Map.
				sampleIndex,
				distanceFromObserverKm: (intervalStartKm + intervalEndKm) / 2,
				weightKm: stepLengthKm,
				intervalStartKm,
				intervalEndKm,
				integrationMethod: 'midpoint',
			};
		});

		return {
			// Branch source: sampleViewPath is a packet transform that preserves
			// rayPath diagnostics and emits viewSamples plus run-level metadata.
			// See Stage Contracts, sampleViewPath output contract.
			...packet,
			viewSamples,
			viewSampleMetadata: this.createViewSampleMetadata(
				viewSamples.length,
				viewSegment.lengthKm,
			),
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
		};
	}

	/**
	 * Validate that this direct stage packet carries a resolved ray path.
	 *
	 * @param {AtmosphereReferenceRayPath | undefined} rayPath - Provide the packet field to narrow.
	 * @returns {AtmosphereReferenceRayPath}
	 */
	validateRayPath(rayPath) {
		if (!rayPath) {
			// Reason: sampleViewPath runs after resolveRayPath and consumes its selected segment.
			// Source: Reference Code Design, canonical stage descriptors.
			throw new Error('sampleViewPath requires rayPath');
		}

		if (!Object.prototype.hasOwnProperty.call(rayPath, 'viewSegment')) {
			// Reason: geometry is already resolved before this stage; sampling needs only the selected segment.
			// Source: Reference Code Design, sampleViewPath Output Shape.
			throw new Error('sampleViewPath requires rayPath.viewSegment');
		}

		// Branch source: the full rayPath object remains available to
		// downstream diagnostics; this validation only narrows the prerequisite.
		// See Stage Contracts, rayPath diagnostic preservation.
		return /** @type {AtmosphereReferenceRayPath} */ (rayPath);
	}

	/**
	 * Resolve the view sample count from direct packet numerical controls.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide the prepared stage packet.
	 * @returns {number}
	 */
	resolveViewSteps(packet) {
		const numerical = this.resolveNumericalControls(packet);
		const viewSteps = numerical.viewSteps ?? 1;

		if (
			typeof viewSteps !== 'number'
			|| !Number.isFinite(viewSteps)
			|| !Number.isInteger(viewSteps)
			|| viewSteps <= 0
		) {
			// Reason: the midpoint rule needs a positive integer partition count.
			// Source: Reference Code Design, Numerical Controls; view-samples invalid viewSteps fixture row.
			throw new RangeError('sampleViewPath requires viewSteps to be a positive integer');
		}

		// Branch source: missing viewSteps defaults to one nonempty midpoint
		// partition; supplied values are validated as discrete partition counts.
		// See Reference Decision Log, sampleViewPath Implementation Branch Source Map.
		return viewSteps;
	}

	/**
	 * Resolve numerical controls from the packet shape this stage may see.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide the prepared stage packet.
	 * @returns {AtmosphereReferenceNumericalControls}
	 */
	resolveNumericalControls(packet) {
		const validatedRequest = packet.validatedRequest;

		if (!validatedRequest || typeof validatedRequest !== 'object') {
			// Reason: after validateRequest, numerical controls have one canonical packet owner.
			// Source: Reference Stage Contracts, sampleViewPath consumes validatedRequest.numerical.
			throw new Error('sampleViewPath requires validatedRequest');
		}

		const numerical = validatedRequest.numerical;

		if (!numerical || typeof numerical !== 'object') {
			// Reason: numerical controls are configuration, not physical constants, and must stay a named object.
			// Source: Reference Code Design, Numerical Controls.
			throw new Error('sampleViewPath requires numerical controls to be an object');
		}

		// Branch source: consume the canonical validatedRequest.numerical object
		// rather than any stale top-level numerical controls.
		// See Stage Contracts, sampleViewPath input ownership.
		return /** @type {AtmosphereReferenceNumericalControls} */ (numerical);
	}

	/**
	 * Create run-level sampling metadata.
	 *
	 * @param {number} sampleCount - Count emitted view samples.
	 * @param {number} pathLengthKm - Store selected path length.
	 * @returns {AtmosphereReferenceViewSampleMetadata}
	 */
	createViewSampleMetadata(sampleCount, pathLengthKm) {
		// Branch source: metadata records the selected local sampling policy and
		// emitted count for diagnostics; it is not a physical input.
		// See Stage Contracts, viewSampleMetadata output shape.
		return {
			integrationMethod: 'midpoint',
			sampleCount,
			pathLengthKm,
		};
	}
}
