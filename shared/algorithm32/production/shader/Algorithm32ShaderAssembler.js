import { ShaderCompatibilityValidator } from './ShaderCompatibilityValidator.js';
import { stableHash } from './stableHash.js';

const OWNER_ORDER = Object.freeze([
	'runtime',
	'geometry',
	'lightSource',
	'atmosphere',
	'cache',
	'transport',
	'color',
]);

const SOURCE_SLOTS = Object.freeze([
	'declareTypes',
	'declareConstants',
	'declareHelpers',
	'reconstructRay',
	'resolvePathBounds',
	'sampleAtmosphere',
	'sampleLightSource',
	'lookupIncidentRadiance',
	'evaluateTransport',
	'composeSceneColor',
	'encodeOutput',
	'diagnosticOutput',
]);

const MAIN_HOOK_SLOTS = Object.freeze([
	'reconstructRay',
	'resolvePathBounds',
	'sampleAtmosphere',
	'sampleLightSource',
	'lookupIncidentRadiance',
	'evaluateTransport',
	'composeSceneColor',
	'encodeOutput',
	'diagnosticOutput',
]);

const GLSL_DIRECTIVE_PREFIX = String.fromCharCode(35);

/**
 * Assemble validated owner contributions into deterministic GLSL source.
 */
export class Algorithm32ShaderAssembler {
	/**
	 * Store the compatibility validator used before source assembly.
	 *
	 * @type {ShaderCompatibilityValidator}
	 */
	_validator;

	/**
	 * Create a shader assembler.
	 *
	 * @param {ShaderAssemblerConfiguration} [configuration] - Supplies optional collaborators.
	 */
	constructor(configuration = {}) {
		this._validator = configuration.validator ?? new ShaderCompatibilityValidator();
	}

	/**
	 * Assemble one shader request after validating contribution compatibility.
	 *
	 * @param {ShaderAssemblyRequest} request - Supplies the shader assembly request.
	 * @returns {ShaderAssemblyResult} Return the accepted shader assembly.
	 */
	assemble(request) {
		const validationReport = this._validator.validate(request);

		if (validationReport.status !== 'accepted') {
			throw createShaderValidationError(validationReport);
		}

		const contributions = [...(request.contributions ?? [])].sort(compareContributions);
		const fragmentShaderSource = assembleFragmentShader(contributions);
		const bindingRequirements = Object.freeze(contributions
			.flatMap((contribution) => contribution.bindingRequirements ?? [])
			.sort((a, b) => a.id.localeCompare(b.id)));

		return Object.freeze({
			status: 'accepted',
			descriptor: request.descriptor,
			fragmentShaderSource,
			sourceHash: stableHash(fragmentShaderSource),
			contributions: Object.freeze(contributions),
			validationReport,
			bindingRequirements,
			diagnostics: Object.freeze({
				ownerOrder: OWNER_ORDER,
				sourceSlots: SOURCE_SLOTS,
				mainHookSlots: MAIN_HOOK_SLOTS,
			}),
		});
	}
}

/**
 * Build the fragment shader source for sorted contributions.
 *
 * @param {readonly ShaderContribution[]} contributions - Supplies sorted contributions.
 * @returns {string} Return GLSL source.
 */
function assembleFragmentShader(contributions) {
	const defineSource = contributions
		.flatMap((contribution) => listEntries(contribution, 'defines')
			.map((line) => ({ contribution, line })))
		.sort(compareByContributionThenLine)
		.map((entry) => entry.line)
		.join('\n');
	const uniformSource = contributions
		.flatMap((contribution) => [
			...listEntries(contribution, 'uniforms')
				.map((uniform) => `uniform ${uniform.type} ${uniform.name};`),
			...listEntries(contribution, 'textures')
				.map((texture) => `uniform ${texture.type} ${texture.name};`),
		].map((line) => ({ contribution, line })))
		.sort(compareByContributionThenLine)
		.map((entry) => entry.line)
		.join('\n');
	const functionSource = SOURCE_SLOTS
		.map((slot) => blocksForSlot(contributions, slot, 'functions'))
		.filter(Boolean)
		.join('\n\n');
	const hookSource = MAIN_HOOK_SLOTS
		.map((slot) => blocksForSlot(contributions, slot, 'mainHooks'))
		.filter(Boolean)
		.join('\n\t');

	return `${GLSL_DIRECTIVE_PREFIX}version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler3D;

in vec2 vUv;
out vec4 outColor;

${defineSource}

${uniformSource}

${functionSource}

void main() {
	ShaderState state = createInitialShaderState(vUv);
	${hookSource}
}
`;
}

/**
 * Return source blocks for one shader slot.
 *
 * @param {readonly ShaderContribution[]} contributions - Supplies the contributions.
 * @param {ShaderSourceSlot} slot - Supplies the slot name.
 * @param {'functions' | 'mainHooks'} property - Supplies the block property.
 * @returns {string} Return combined source blocks.
 */
function blocksForSlot(contributions, slot, property) {
	return contributions
		.flatMap((contribution) => listEntries(contribution, property)
			.filter((block) => block.slot === slot)
			.map((block) => ({ contribution, block })))
		.sort((a, b) =>
			a.block.order - b.block.order
			|| compareContributions(a.contribution, b.contribution)
			|| a.block.id.localeCompare(b.block.id))
		.map((entry) => entry.block.code)
		.join('\n\n');
}

/**
 * Return a contribution list property or an empty array.
 *
 * @param {ShaderContribution} contribution - Supplies the contribution.
 * @param {string} property - Supplies the property name.
 * @returns {readonly unknown[]} Return the list.
 */
function listEntries(contribution, property) {
	return contribution[property] ?? [];
}

/**
 * Compare contributions by accepted owner order then id.
 *
 * @param {ShaderContribution} a - Supplies the left contribution.
 * @param {ShaderContribution} b - Supplies the right contribution.
 * @returns {number} Return sort order.
 */
function compareContributions(a, b) {
	return ownerIndex(a.owner) - ownerIndex(b.owner)
		|| a.id.localeCompare(b.id);
}

/**
 * Compare sorted line entries inside a contribution group.
 *
 * @param {{ contribution: ShaderContribution, line: string }} a - Supplies the left entry.
 * @param {{ contribution: ShaderContribution, line: string }} b - Supplies the right entry.
 * @returns {number} Return sort order.
 */
function compareByContributionThenLine(a, b) {
	return compareContributions(a.contribution, b.contribution)
		|| a.line.localeCompare(b.line);
}

/**
 * Return the owner sort position.
 *
 * @param {ShaderOwnerId} owner - Supplies the owner id.
 * @returns {number} Return the sort position.
 */
function ownerIndex(owner) {
	const index = OWNER_ORDER.indexOf(owner);

	return index === -1 ? OWNER_ORDER.length : index;
}

/**
 * Create a setup-time validation error with structured details.
 *
 * @param {ShaderSymbolValidationReport} validationReport - Supplies the report.
 * @returns {Error} Return the validation error.
 */
function createShaderValidationError(validationReport) {
	const error = new Error('Shader contributions do not satisfy the required symbol inventory.');

	error.name = 'ShaderConfigurationError';
	error.code = 'SHADER_SYMBOL_VALIDATION_FAILED';
	error.details = validationReport;

	return error;
}

export default Algorithm32ShaderAssembler;
