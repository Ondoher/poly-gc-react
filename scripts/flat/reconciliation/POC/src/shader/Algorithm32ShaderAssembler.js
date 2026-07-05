// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, generic contribution assembly.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import ShaderCompatibilityValidator from './ShaderCompatibilityValidator.js';
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

export default class Algorithm32ShaderAssembler {
    /**
     * @param {{ readonly validator?: ShaderCompatibilityValidator }} [configuration] - Assembler configuration.
     */
    constructor(configuration = {}) {
        this._validator = configuration.validator ?? new ShaderCompatibilityValidator();
    }

    /**
     * @param {ShaderAssemblyRequest} request - Shader assembly request.
     * @returns {ShaderAssemblyResult} Shader assembly.
     */
    assemble(request) {
        const validationReport = this._validator.validate(request);
        if (validationReport.status !== 'accepted') {
            throw new ReconciliationConfigurationError(
                'Shader contributions do not satisfy the required symbol inventory.',
                {
                    code: 'SHADER_SYMBOL_VALIDATION_FAILED',
                    details: validationReport,
                },
            );
        }

        const contributions = [...request.contributions].sort(compareContributions);
        const fragmentShaderSource = assembleFragmentShader(contributions);
        const bindingRequirements = Object.freeze(contributions
            .flatMap((contribution) => contribution.bindingRequirements)
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

function assembleFragmentShader(contributions) {
    const defineSource = contributions
        .flatMap((contribution) => contribution.defines.map((line) => ({ contribution, line })))
        .sort(compareByContributionThenLine)
        .map((entry) => entry.line)
        .join('\n');
    const uniformSource = contributions
        .flatMap((contribution) => [
            ...contribution.uniforms.map((uniform) => `uniform ${uniform.type} ${uniform.name};`),
            ...contribution.textures.map((texture) => `uniform ${texture.type} ${texture.name};`),
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
        .join('\n    ');

    return `#version 300 es
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

function blocksForSlot(contributions, slot, property) {
    return contributions
        .flatMap((contribution) => contribution[property]
            .filter((block) => block.slot === slot)
            .map((block) => ({ contribution, block })))
        .sort((a, b) =>
            a.block.order - b.block.order
            || compareContributions(a.contribution, b.contribution)
            || a.block.id.localeCompare(b.block.id))
        .map((entry) => entry.block.code)
        .join('\n\n');
}

function compareContributions(a, b) {
    return ownerIndex(a.owner) - ownerIndex(b.owner)
        || a.id.localeCompare(b.id);
}

function compareByContributionThenLine(a, b) {
    return compareContributions(a.contribution, b.contribution)
        || a.line.localeCompare(b.line);
}

function ownerIndex(owner) {
    const index = OWNER_ORDER.indexOf(owner);
    return index === -1 ? OWNER_ORDER.length : index;
}
