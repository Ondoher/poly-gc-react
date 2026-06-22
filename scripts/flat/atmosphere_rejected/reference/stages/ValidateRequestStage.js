import { normalizeVector3 } from '../utils.js';

// Branch source: these are the model-owner methods physical stages call after
// validateRequest. Keeping the list here validates the behavior interface
// without branching on globe/flat model type.
// See Reference Decision Log, validateRequest Implementation Branch Source Map.
const REQUIRED_MODEL_METHODS = Object.freeze({
	world: Object.freeze([
		'altitudeAt',
		'upAt',
		'intersectSurface',
		'surfaceNormalAt',
	]),
	atmosphere: Object.freeze([
		'intersect',
		'contains',
		'mediumAt',
		'densityAt',
		'extinctionAt',
		'scatteringAt',
	]),
	solarSource: Object.freeze(['samplesAt', 'transmittanceSegment']),
	surface: Object.freeze(['radianceAt']),
});

// Branch source: known numeric controls are calculation settings, not physical
// constants. Unknown numerical keys are intentionally filtered below.
// See Stage Contracts, validateRequest numerical controls.
const KNOWN_NUMERICAL_NUMBER_FIELDS = new Set([
	'viewSteps',
	'sunTransmittanceSteps',
	'diffuseSkyHemisphereSamples',
	'finiteSunSamples',
	'minStepKm',
	'maxStepKm',
]);

// Branch source: integrationMethod is a known dispatch/config field, but its
// accepted names are owned by a later method registry instead of this stage.
// See Code Design, Numerical Controls.
const KNOWN_NUMERICAL_FIELDS = new Set([
	...KNOWN_NUMERICAL_NUMBER_FIELDS,
	'integrationMethod',
]);

// Branch source: sample-count controls select discrete loop counts and must be
// positive integers when supplied.
// See Stage Contracts, validateRequest numerical controls.
const NUMERICAL_SAMPLE_COUNT_FIELDS = new Set([
	'viewSteps',
	'sunTransmittanceSteps',
	'diffuseSkyHemisphereSamples',
	'finiteSunSamples',
]);

/**
 * Validate and canonicalize a trace request before physical transport stages.
 */
export default class ValidateRequestStage {
	/**
	 * Create the validateRequest stage helper.
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
	 * Validate and canonicalize the merged request before physical stages run.
	 *
	 * @param {AtmosphereReferencePacket} packet - Provide the packet containing a merged request.
	 * @returns {AtmosphereReferencePacket}
	 */
	run(packet) {
		const { request } = packet;

		if (!request || typeof request !== 'object') {
			// Reason: validateRequest is the boundary for physical/numerical input, so a missing envelope is invalid.
			// Source: Reference Test Design, validateRequest invalid input.
			throw new Error('validateRequest requires request');
		}

		const model = this.validateModelBundle(request.model);
		const observer = {
			// PBRT Rays Section 3.6 evaluates rays from origin o; keep that point finite in model km.
			positionKm: this.validateFiniteVector3(request.observer?.positionKm, 'observer.positionKm'),
		};
		const ray = {
			// Direction supplies d in o + t*d; normalize so t remains a kilometer path distance.
			direction: normalizeVector3(request.ray?.direction, { label: 'ray.direction' }),
		};
		const wavelengthsNm = this.validateWavelengthGrid(request.wavelengthsNm);
		const numerical = this.validateNumericalControls(request.numerical ?? {});

		return {
			// Branch source: validateRequest preserves unrelated packet fields,
			// emits a single canonical validatedRequest envelope, and appends
			// only its own stage id for direct-stage execution.
			// See Stage Contracts, validateRequest output contract.
			...packet,
			validatedRequest: {
				model,
				observer,
				ray,
				wavelengthsNm,
				numerical,
			},
			stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
		};
	}

	/**
	 * Validate the behavior modules that physical stages call through.
	 *
	 * @param {AtmosphereReferenceModel} model - Provide the model bundle.
	 * @returns {AtmosphereReferenceModel}
	 */
	validateModelBundle(model) {
		if (!model || typeof model !== 'object') {
			// Reason: physical constants and behavior modules are model-owned.
			// Source: Reference Code Design, Model Interface.
			throw new Error('validateRequest requires model');
		}

		for (const [owner, methodNames] of Object.entries(REQUIRED_MODEL_METHODS)) {
			const module = model[owner];

			for (const methodName of methodNames) {
				if (!module || typeof module[methodName] !== 'function') {
					// Branch source: later stages call behavior through the model
					// interface instead of branching on world type or preserving
					// legacy aliases.
					// See Code Design, Model Interface.
					throw new Error(`validateRequest requires ${owner}.${methodName}`);
				}
			}
		}

		// Branch source: the model object owns physical constants and behavior;
		// preserve the caller/default-owned bundle instead of cloning or
		// rewriting model facts in validatedRequest.
		// See Reference Decision Log, validateRequest Implementation Branch Source Map.
		return model;
	}

	/**
	 * Validate a finite model-space 3-vector without assigning physical meaning.
	 *
	 * @param {unknown} value - Provide the vector candidate.
	 * @param {string} label - Name the field in errors.
	 * @returns {readonly number[]}
	 */
	validateFiniteVector3(value, label) {
		if (!Array.isArray(value) || value.length !== 3) {
			// Reason: model-space points and vectors use finite 3D tuples.
			// Source: Reference Code Design, Inputs and Units.
			throw new Error(`${label} must be a finite 3-vector`);
		}

		const vector = value.map((component) => {
			if (!Number.isFinite(component)) {
				// Reason: non-finite coordinates make geometry, altitude, and path integration undefined.
				// Source: Reference Code Design, Inputs and Units.
				throw new Error(`${label} must be a finite 3-vector`);
			}

			return component;
		});

		return Object.freeze(vector);
	}

	/**
	 * Validate the spectral sample grid used by later spectral integration.
	 *
	 * @param {unknown} wavelengthsNm - Provide wavelength samples in nanometers.
	 * @returns {readonly number[]}
	 */
	validateWavelengthGrid(wavelengthsNm) {
		if (!Array.isArray(wavelengthsNm) || wavelengthsNm.length === 0) {
			// Reason: spectral transport needs at least one wavelength sample.
			// Source: CIE 1931 CMF and ASTM G-173 tables are wavelength-indexed spectral data.
			throw new Error('wavelengthsNm must be a nonempty sorted array of positive finite numbers');
		}

		let previous = -Infinity;

		const grid = wavelengthsNm.map((wavelengthNm) => {
			if (!Number.isFinite(wavelengthNm) || wavelengthNm <= 0 || wavelengthNm <= previous) {
				// Branch source: spectral arrays downstream are indexed by this
				// grid, so the grid must be finite, positive, and strictly
				// increasing; no interpolation or sorting policy belongs here.
				// See Stage Contracts, validateRequest wavelength ownership.
				throw new Error('wavelengthsNm must contain positive finite values in strictly increasing order');
			}

			previous = wavelengthNm;
			return wavelengthNm;
		});

		return Object.freeze(grid);
	}

	/**
	 * Validate numerical approximation controls without treating them as physics.
	 *
	 * @param {unknown} numerical - Provide numerical controls.
	 * @returns {Readonly<Record<string, unknown>>}
	 */
	validateNumericalControls(numerical) {
		if (!numerical || typeof numerical !== 'object') {
			// Reason: numerical controls are a named configuration object separate from physical constants.
			// Source: Reference Code Design, Numerical Controls.
			throw new Error('numerical must be an object of finite nonnegative controls');
		}

		const result = {};

		for (const [key, value] of Object.entries(numerical)) {
			if (!KNOWN_NUMERICAL_FIELDS.has(key)) {
				// Branch source: unknown numerical keys are tolerated at the
				// request boundary but dropped so later stages see only the current
				// numerical-control contract.
				// See Stage Contracts, validateRequest ownership.
				continue;
			}

			if (KNOWN_NUMERICAL_NUMBER_FIELDS.has(key) && typeof value !== 'number') {
				// Reason: accepting strings would turn schema mistakes into implicit conversions.
				// Source: Reference Test Design, validateRequest hardening.
				throw new Error(`numerical.${key} must be a number`);
			}

			if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) {
				// Branch source: numerical controls drive loops, distances, and
				// quadrature; negative or non-finite values do not define a
				// stable approximation policy.
				// See Code Design, Numerical Controls.
				throw new Error(`numerical.${key} must be finite and nonnegative`);
			}

			if (
				NUMERICAL_SAMPLE_COUNT_FIELDS.has(key)
				&& (!Number.isInteger(value) || value <= 0)
			) {
				// Branch source: sample-count controls choose discrete iteration
				// counts, so zero and fractional values cannot produce a
				// meaningful sample set.
				// See Stage Contracts, validateRequest numerical controls.
				throw new Error(`numerical.${key} must be a positive integer`);
			}

			// Branch source: keep only known numerical fields in the canonical
			// output. Display, report, future-schema, and typo fields remain
			// outside validatedRequest.numerical.
			// See Reference Decision Log, validateRequest Implementation Branch Source Map.
			result[key] = value;
		}

		if (
			typeof result.minStepKm === 'number'
			&& typeof result.maxStepKm === 'number'
			&& result.maxStepKm - result.minStepKm < 0
		) {
			// Branch source: distance-control bounds must form an ordered,
			// nonnegative span; this is a numerical policy, not a physical
			// atmosphere constraint.
			// See Code Design, Numerical Controls.
			throw new Error('numerical.maxStepKm must be greater than or equal to numerical.minStepKm');
		}

		return Object.freeze(result);
	}
}
