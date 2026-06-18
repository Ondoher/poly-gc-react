import ComposeSpectralRadianceStage from './stages/ComposeSpectralRadianceStage.js';
import EvaluateMediumStage from './stages/EvaluateMediumStage.js';
import EvaluateScatteringPhaseStage from './stages/EvaluateScatteringPhaseStage.js';
import IntegrateDiffuseSkyAirlightStage from './stages/IntegrateDiffuseSkyAirlightStage.js';
import IntegrateSingleScatteringStage from './stages/IntegrateSingleScatteringStage.js';
import IntegrateSolarTransmittanceStage from './stages/IntegrateSolarTransmittanceStage.js';
import IntegrateViewOpticalDepthStage from './stages/IntegrateViewOpticalDepthStage.js';
import ResolveRayPathStage from './stages/ResolveRayPathStage.js';
import ResolveSurfaceRadianceStage from './stages/ResolveSurfaceRadianceStage.js';
import SampleViewPathStage from './stages/SampleViewPathStage.js';
import ValidateRequestStage from './stages/ValidateRequestStage.js';

/**
 * Create one canonical stage descriptor.
 *
 * @param {AtmosphereReferenceStageId | string} id - Identify the stage.
 * @param {readonly string[]} requires - List packet prerequisites.
 * @param {readonly string[]} provides - List packet fields added by the stage.
 * @param {AtmosphereReferenceStageClass} StageClass - Construct the helper that runs the stage.
 * @returns {Readonly<AtmosphereReferenceStageDescriptor>}
 */
function stage(id, requires, provides, StageClass) {
	return Object.freeze({
		id,
		requires: Object.freeze([...requires]),
		provides: Object.freeze([...provides]),
		StageClass,
	});
}

/** @type {readonly AtmosphereReferenceStageDescriptor[]} */
export const CANONICAL_STAGES = Object.freeze([
	stage('validateRequest', ['request'], ['validatedRequest'], ValidateRequestStage),
	stage('resolveRayPath', ['validatedRequest'], ['rayPath'], ResolveRayPathStage),
	stage('sampleViewPath', ['validatedRequest', 'rayPath'], ['viewSamples', 'viewSampleMetadata'], SampleViewPathStage),
	stage('evaluateMedium', ['validatedRequest', 'viewSamples'], ['mediumSamples'], EvaluateMediumStage),
	stage('integrateViewOpticalDepth', ['validatedRequest', 'mediumSamples'], ['viewOpticalDepth'], IntegrateViewOpticalDepthStage),
	stage('integrateSolarTransmittance', ['validatedRequest', 'mediumSamples', 'rayPath'], ['solarTransmittance'], IntegrateSolarTransmittanceStage),
	stage('evaluateScatteringPhase', ['validatedRequest', 'mediumSamples', 'solarTransmittance'], ['scatteringPhase'], EvaluateScatteringPhaseStage),
	stage(
		'integrateSingleScattering',
		['validatedRequest', 'mediumSamples', 'viewOpticalDepth', 'solarTransmittance', 'scatteringPhase'],
		['singleScattering'],
		IntegrateSingleScatteringStage,
	),
	stage(
		'integrateDiffuseSkyAirlight',
		['validatedRequest', 'viewOpticalDepth', 'solarTransmittance', 'singleScattering'],
		['diffuseSkyAirlight'],
		IntegrateDiffuseSkyAirlightStage,
	),
	stage(
		'resolveSurfaceRadiance',
		['validatedRequest', 'rayPath', 'viewOpticalDepth', 'solarTransmittance'],
		['surfaceRadiance'],
		ResolveSurfaceRadianceStage,
	),
	stage(
		'composeSpectralRadiance',
		['validatedRequest', 'singleScattering', 'surfaceRadiance'],
		['spectralRadiance'],
		ComposeSpectralRadianceStage,
	),
]);

/** @type {readonly string[]} */
export const CANONICAL_STAGE_IDS = Object.freeze(CANONICAL_STAGES.map((entry) => entry.id));

/**
 * Return stage ids in execution order.
 *
 * @param {readonly AtmosphereReferenceStageDescriptor[]} stages - Provide stage descriptors.
 * @returns {string[]}
 */
export function listStageIds(stages = CANONICAL_STAGES) {
	return stages.map((entry) => entry.id);
}

/**
 * Return a stage descriptor by id.
 *
 * @param {string} stageId - Identify the stage to find.
 * @param {readonly AtmosphereReferenceStageDescriptor[]} stages - Provide stage descriptors.
 * @returns {AtmosphereReferenceStageDescriptor}
 */
export function getStage(stageId, stages = CANONICAL_STAGES) {
	const match = stages.find((entry) => entry.id === stageId);

	if (!match) {
		// Reason: unknown stage ids are caller/configuration errors, not recoverable physics cases.
		// Source: Reference Code Design, Error Handling; stage ids are the public pipeline contract.
		throw new Error(`Unknown atmosphere reference stage: ${stageId}`);
	}

	return match;
}

/**
 * Fail when a packet is missing fields required by a stage.
 *
 * @param {AtmosphereReferenceStageDescriptor} stageDescriptor - Provide the stage descriptor.
 * @param {AtmosphereReferencePacket} packet - Provide the packet to inspect.
 * @returns {void}
 */
export function assertStagePrerequisites(stageDescriptor, packet) {
	if (!packet || typeof packet !== 'object') {
		// Reason: every stage operates on the packet contract, so non-packets fail at the boundary.
		// Source: Reference Code Design, packet transform API.
		throw new Error(`${stageDescriptor.id} requires a packet object`);
	}

	const missing = stageDescriptor.requires.filter((field) => {
		return !Object.prototype.hasOwnProperty.call(packet, field);
	});

	if (missing.length > 0) {
		// Reason: stage prerequisites are declared by descriptor and must be present before stage logic runs.
		// Source: Reference Code Design, Canonical Pipeline Stages; requires/provides define dependencies.
		throw new Error(`${stageDescriptor.id} requires ${missing.join(', ')}`);
	}
}
