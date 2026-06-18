import {
	CANONICAL_STAGES,
	assertStagePrerequisites,
	getStage,
	listStageIds,
} from './pipeline-stages.js';

const REQUIRED_DEFAULT_MODEL_METHODS = Object.freeze({
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

const NUMERICAL_SAMPLE_COUNT_FIELDS = new Set([
	'viewSteps',
	'sunTransmittanceSteps',
	'diffuseSkyHemisphereSamples',
	'finiteSunSamples',
]);

function hasOwn(object, key) {
	return Object.prototype.hasOwnProperty.call(object, key);
}

function cloneArray(value) {
	return Array.isArray(value) ? [...value] : value;
}

function cloneObserver(observer) {
	if (!observer || typeof observer !== 'object') {
		return observer;
	}

	return {
		...observer,
		positionKm: cloneArray(observer.positionKm),
	};
}

function cloneRay(ray) {
	if (!ray || typeof ray !== 'object') {
		return ray;
	}

	return {
		...ray,
		direction: cloneArray(ray.direction),
	};
}

function cloneNumerical(numerical) {
	if (!numerical || typeof numerical !== 'object' || Array.isArray(numerical)) {
		return numerical;
	}

	return { ...numerical };
}

function cloneTraceRequest(request = {}) {
	const clone = { ...request };

	if (hasOwn(request, 'model')) {
		clone.model = request.model;
	}

	if (hasOwn(request, 'observer')) {
		clone.observer = cloneObserver(request.observer);
	}

	if (hasOwn(request, 'ray')) {
		clone.ray = cloneRay(request.ray);
	}

	if (hasOwn(request, 'wavelengthsNm')) {
		clone.wavelengthsNm = cloneArray(request.wavelengthsNm);
	}

	if (hasOwn(request, 'numerical')) {
		clone.numerical = cloneNumerical(request.numerical);
	}

	return clone;
}

function freezeIntegratorContext(context) {
	if (Array.isArray(context.wavelengthsNm)) {
		Object.freeze(context.wavelengthsNm);
	}

	if (context.numerical && typeof context.numerical === 'object') {
		Object.freeze(context.numerical);
	}

	return Object.freeze(context);
}

function clonePacketData(value, key) {
	if (key === 'model' || typeof value === 'function') {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => clonePacketData(entry));
	}

	if (!value || typeof value !== 'object') {
		return value;
	}

	const clone = {};

	for (const [entryKey, entryValue] of Object.entries(value)) {
		clone[entryKey] = clonePacketData(entryValue, entryKey);
	}

	return clone;
}

function validateDefaultModel(model) {
	if (model === undefined) {
		return;
	}

	if (!model || typeof model !== 'object') {
		// Reason: a constructor-supplied default model must satisfy the same behavior bundle boundary
		// as a per-request model before any physical stage can run.
		// Source: Reference Code Design, Integrator Facade Contract.
		throw new Error('CpuSpectralReferenceIntegrator default model must be an object');
	}

	for (const [owner, methodNames] of Object.entries(REQUIRED_DEFAULT_MODEL_METHODS)) {
		const module = model[owner];

		for (const methodName of methodNames) {
			if (!module || typeof module[methodName] !== 'function') {
				// Reason: validating constructor defaults catches broken reusable context before trace calls.
				// Source: Reference Code Design, Integrator Facade Contract; validateRequest model-interface policy.
				throw new Error(`CpuSpectralReferenceIntegrator default model requires ${owner}.${methodName}`);
			}
		}
	}
}

function validateDefaultWavelengths(wavelengthsNm) {
	if (wavelengthsNm === undefined) {
		return;
	}

	if (!Array.isArray(wavelengthsNm) || wavelengthsNm.length === 0) {
		// Reason: default wavelength grids are reusable spectral data and must be valid before merging.
		// Source: Reference Code Design, Integrator Facade Contract; Stage Contracts validateRequest ownership.
		throw new Error('CpuSpectralReferenceIntegrator default wavelengthsNm must be a nonempty sorted array of positive finite numbers');
	}

	let previous = -Infinity;

	for (const wavelengthNm of wavelengthsNm) {
		if (!Number.isFinite(wavelengthNm) || wavelengthNm <= 0 || wavelengthNm <= previous) {
			// Reason: spectral arrays use wavelength index order, so constructor defaults must not seed invalid grids.
			// Source: Reference Code Design, Integrator Facade Contract; Stage Contracts validateRequest ownership.
			throw new Error('CpuSpectralReferenceIntegrator default wavelengthsNm must contain positive finite values in strictly increasing order');
		}

		previous = wavelengthNm;
	}
}

function validateDefaultNumerical(numerical) {
	if (numerical === undefined) {
		return;
	}

	if (!numerical || typeof numerical !== 'object' || Array.isArray(numerical)) {
		// Reason: numerical defaults are shallow-merged by name, so the default value must be an object.
		// Source: Reference Code Design, Integrator Facade Contract.
		throw new Error('CpuSpectralReferenceIntegrator default numerical must be an object');
	}

	for (const [key, value] of Object.entries(numerical)) {
		if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) {
			// Reason: default numerical controls drive loops and distances just like per-request controls.
			// Source: Reference Code Design, Integrator Facade Contract; validateRequest numerical policy.
			throw new Error(`CpuSpectralReferenceIntegrator default numerical.${key} must be finite and nonnegative`);
		}

		if (NUMERICAL_SAMPLE_COUNT_FIELDS.has(key) && (!Number.isInteger(value) || value <= 0)) {
			// Reason: reusable sample-count defaults must define a positive integer loop count.
			// Source: Reference Code Design, Integrator Facade Contract; validateRequest numerical policy.
			throw new Error(`CpuSpectralReferenceIntegrator default numerical.${key} must be a positive integer`);
		}
	}
}

function validateIntegratorDefaults(context) {
	validateDefaultModel(context.model);
	validateDefaultWavelengths(context.wavelengthsNm);
	validateDefaultNumerical(context.numerical);
}

function validateStageDescriptors(stages) {
	if (!Array.isArray(stages)) {
		// Reason: helper construction depends on an ordered descriptor array, not a loose object map.
		// Source: Reference Code Design, Integrator Facade Contract; stage helper class policy.
		throw new Error('CpuSpectralReferenceIntegrator stages must be an array');
	}

	const stageIds = new Set();

	for (const [index, descriptor] of stages.entries()) {
		const label = `CpuSpectralReferenceIntegrator stage descriptor ${index}`;

		if (!descriptor || typeof descriptor !== 'object') {
			// Reason: descriptors are the registry contract that binds id, prerequisites, outputs, and helper class.
			// Source: Reference Code Design, Canonical Pipeline Stages.
			throw new Error(`${label} must be an object`);
		}

		if (typeof descriptor.id !== 'string' || descriptor.id.trim() === '') {
			// Reason: stage ids are the public lookup and diagnostic boundary.
			// Source: Reference Code Design, Canonical Pipeline Stages.
			throw new Error(`${label} requires a non-empty id`);
		}

		if (stageIds.has(descriptor.id)) {
			// Reason: duplicate ids make helper dispatch ambiguous and hide one stage behind another.
			// Source: Reference Code Design, one canonical stage registry.
			throw new Error(`Duplicate atmosphere reference stage id: ${descriptor.id}`);
		}

		stageIds.add(descriptor.id);

		if (!Array.isArray(descriptor.requires)) {
			// Reason: prerequisite checks consume descriptor.requires before helper logic runs.
			// Source: Reference Code Design, requires/provides stage contract.
			throw new Error(`${label} requires a requires array`);
		}

		if (!Array.isArray(descriptor.provides)) {
			// Reason: descriptor output metadata is the stage contract used by tests and reports.
			// Source: Reference Code Design, requires/provides stage contract.
			throw new Error(`${label} requires a provides array`);
		}

		if (typeof descriptor.StageClass !== 'function') {
			// Reason: every implemented stage now has a focused helper; placeholder fallback is no longer a valid registry state.
			// Source: Reference Code Design, helper-class stage policy.
			throw new Error(`${label} requires a StageClass constructor`);
		}
	}
}

function hasTraceRequestKey(value) {
	return [
		'model',
		'observer',
		'ray',
		'wavelengthsNm',
		'numerical',
	].some((key) => hasOwn(value, key));
}

/**
 * Run the CPU spectral reference pipeline as a testable stage composition.
 */
export default class CpuSpectralReferenceIntegrator {
	/**
	 * Create a reference integrator with default model, wavelength, and numerical settings.
	 *
	 * @param {AtmosphereReferenceIntegratorOptions} options - Configure integrator defaults and optional stage overrides.
	 */
	constructor({
		model,
		wavelengthsNm,
		numerical = {},
		stages = CANONICAL_STAGES,
	} = {}) {
		const context = {
			model,
			wavelengthsNm: cloneArray(wavelengthsNm),
			numerical: cloneNumerical(numerical),
		};
		validateIntegratorDefaults(context);

		/**
		 * Store defaults merged into each request packet.
		 *
		 * @type {Readonly<AtmosphereReferenceIntegratorOptions>}
		 */
		this.context = freezeIntegratorContext(context);

		/**
		 * Store the canonical or test-supplied stage descriptors.
		 *
		 * @type {readonly AtmosphereReferenceStageDescriptor[]}
		 */
		validateStageDescriptors(stages);
		this.stages = Object.freeze([...stages]);

		/**
		 * Store constructed helper objects by stage id.
		 *
		 * @type {ReadonlyMap<string, { run(packet: AtmosphereReferencePacket): AtmosphereReferencePacket }>}
		 */
		this.stageHelpers = this.createStageHelpers(this.stages);
	}

	/**
	 * Return the stage descriptor for a stage id.
	 *
	 * @param {string} stageId - Identify the stage to find.
	 * @returns {AtmosphereReferenceStageDescriptor}
	 */
	getStage(stageId) {
		return getStage(stageId, this.stages);
	}

	/**
	 * Return stable stage ids in execution order.
	 *
	 * @returns {string[]}
	 */
	listStages() {
		return listStageIds(this.stages);
	}

	/**
	 * Merge a request with integrator defaults.
	 *
	 * @param {AtmosphereReferenceTraceRequest} request - Provide explicit request overrides.
	 * @returns {AtmosphereReferenceTraceRequest}
	 */
	mergeRequest(request = {}) {
		const requestClone = cloneTraceRequest(request);
		const defaultClone = cloneTraceRequest(this.context);
		const hasRequestNumerical = hasOwn(requestClone, 'numerical');
		const requestNumerical = requestClone.numerical;
		const numerical = hasRequestNumerical
			&& requestNumerical
			&& typeof requestNumerical === 'object'
			&& !Array.isArray(requestNumerical)
			? {
				...(defaultClone.numerical ?? {}),
				...requestNumerical,
			}
			: hasRequestNumerical
				? requestNumerical
				: defaultClone.numerical;

		// Reason: request data overrides constructor defaults after both sides are cloned,
		// while numerical controls merge shallowly by control name.
		// Source: Reference Code Design, Integrator Facade Contract.
		return {
			...defaultClone,
			...requestClone,
			numerical,
		};
	}

	/**
	 * Resolve a probe into a trace request.
	 *
	 * Named probe lookup is intentionally deferred until probe fixtures exist.
	 * For now, pass through inline probe requests and nested `request` objects.
	 *
	 * @param {AtmosphereReferenceProbe} probe - Provide a named or inline probe.
	 * @returns {AtmosphereReferenceTraceRequest}
	 */
	resolveProbeRequest(probe = {}) {
		const probeInput = probe ?? {};

		if (typeof probeInput !== 'object') {
			// Reason: probe resolution consumes named or inline probe objects, not scalar ids.
			// Source: Reference Code Design, Integrator Facade Contract.
			throw new Error('Atmosphere reference probe must be an object');
		}

		if (hasOwn(probeInput, 'request')) {
			// Reason: nested probe.request is the explicit trace request payload.
			// Source: Reference Code Design, Integrator Facade Contract.
			return cloneTraceRequest(probeInput.request);
		}

		if (hasOwn(probeInput, 'id') && !hasTraceRequestKey(probeInput)) {
			// Reason: name-only probe ids need a real fixture registry; silently treating them as trace requests hides configuration mistakes.
			// Source: Reference Code Design, resolveProbeRequest named lookup deferral.
			throw new Error(`Named atmosphere reference probe lookup is not available yet: ${probeInput.id}`);
		}

		// Reason: probes are caller-owned input data; resolving them must not hand back mutable aliases.
		// Source: Reference Code Design, Integrator Facade Contract.
		return cloneTraceRequest(probeInput);
	}

	/**
	 * Create the initial packet consumed by direct stage tests and pipeline runs.
	 *
	 * @param {AtmosphereReferenceTraceRequest} request - Provide the trace request.
	 * @returns {AtmosphereReferencePacket}
	 */
	createInitialPacket(request = {}) {
		const mergedRequest = this.mergeRequest(request);
		const packetRequest = cloneTraceRequest(mergedRequest);

		// Reason: the initial packet exposes a full diagnostic packet boundary while keeping
		// caller/default-owned request data cloned before stages append derived fields.
		// Source: Reference Code Design, Integrator Facade Contract; Stage Contracts, Common Packet Fields.
		return {
			request: packetRequest,
			model: mergedRequest.model,
			observer: cloneObserver(mergedRequest.observer),
			ray: cloneRay(mergedRequest.ray),
			wavelengthsNm: cloneArray(mergedRequest.wavelengthsNm),
			numerical: cloneNumerical(mergedRequest.numerical),
			stageHistory: [],
		};
	}

	/**
	 * Run one prepared stage against an existing packet.
	 *
	 * @param {string} stageId - Identify the stage to run.
	 * @param {AtmosphereReferencePacket} packet - Provide the prepared stage packet.
	 * @returns {AtmosphereReferencePacket}
	 */
	runStage(stageId, packet) {
		const stageDescriptor = this.getStage(stageId);
		assertStagePrerequisites(stageDescriptor, packet);
		// Reason: prepared packets are caller-owned diagnostics; clone before helper dispatch
		// so even stage harnesses cannot mutate the input packet by alias.
		// Source: Reference Code Design, Integrator Facade Contract.
		return this.runStageBehavior(stageDescriptor, clonePacketData(packet));
	}

	/**
	 * Construct helper instances from stage descriptors.
	 *
	 * @param {readonly AtmosphereReferenceStageDescriptor[]} stages - Provide stage descriptors.
	 * @returns {ReadonlyMap<string, { run(packet: AtmosphereReferencePacket): AtmosphereReferencePacket }>}
	 */
	createStageHelpers(stages) {
		const helpers = new Map();

		for (const descriptor of stages) {
			helpers.set(descriptor.id, new descriptor.StageClass({
				descriptor,
				context: this.context,
			}));
		}

		return helpers;
	}

	/**
	 * Dispatch a validated stage packet to the class-owned implementation.
	 *
	 * @param {AtmosphereReferenceStageDescriptor} stageDescriptor - Provide the stage descriptor.
	 * @param {AtmosphereReferencePacket} packet - Provide the prepared stage packet.
	 * @returns {AtmosphereReferencePacket}
	 */
	runStageBehavior(stageDescriptor, packet) {
		const stageHelper = this.stageHelpers.get(stageDescriptor.id);

		if (!stageHelper) {
			// Reason: every descriptor in the registry should construct a helper at integrator startup.
			// Source: Reference Code Design, stage helper class policy.
			throw new Error(`No helper registered for atmosphere reference stage: ${stageDescriptor.id}`);
		}

		return stageHelper.run(packet);
	}

	/**
	 * Run stages until and including the requested stage id.
	 *
	 * @param {string} stageId - Identify the final stage to run.
	 * @param {AtmosphereReferenceTraceRequest} request - Provide the trace request.
	 * @returns {AtmosphereReferencePacket}
	 */
	runUntil(stageId, request) {
		let packet = this.createInitialPacket(request);

		for (const stageDescriptor of this.stages) {
			packet = this.runStage(stageDescriptor.id, packet);

			if (stageDescriptor.id === stageId) {
				return packet;
			}
		}

		// Reason: falling off the loop means no descriptor matched the requested public stage id.
		// Source: Reference Code Design, Error Handling.
		throw new Error(`Unknown atmosphere reference stage: ${stageId}`);
	}

	/**
	 * Run the full pipeline for one explicit ray.
	 *
	 * @param {AtmosphereReferenceTraceRequest} request - Provide the trace request.
	 * @returns {AtmosphereReferenceResult}
	 */
	traceRay(request) {
		let packet = this.createInitialPacket(request);

		for (const stageDescriptor of this.stages) {
			// Reason: traceRay is the full-pipeline facade and always composes every configured stage.
			// Source: Reference Code Design, Integrator Facade Contract.
			packet = this.runStage(stageDescriptor.id, packet);
		}

		return packet;
	}

	/**
	 * Resolve and run a named or inline probe.
	 *
	 * @param {AtmosphereReferenceProbe} probe - Provide a probe or nested probe request.
	 * @returns {AtmosphereReferenceResult}
	 */
	traceProbe(probe) {
		return this.traceRay(this.resolveProbeRequest(probe));
	}
}
