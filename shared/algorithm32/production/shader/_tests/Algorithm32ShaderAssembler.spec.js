import { readFileSync } from 'node:fs';

import { Algorithm32ShaderAssembler } from '../Algorithm32ShaderAssembler.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../Algorithm32ShaderAssembler.js', import.meta.url), 'utf8');
}

/**
 * Create a complete descriptor for assembly specs.
 *
 * @returns {Algorithm32ShaderDescriptor} Return descriptor.
 */
function createDescriptor() {
	return {
		descriptorId: 'descriptor',
		variantId: 'variant',
		fingerprint: 'descriptor',
		compatibilityTags: [],
		spectralBasis: createSection('basis'),
		geometry: createSection('geometry'),
		atmosphere: createSection('atmosphere'),
		lightSource: createSection('light-source'),
		cache: createSection('cache'),
		transport: createSection('transport'),
		color: createSection('color'),
		runtime: createSection('runtime'),
	};
}

/**
 * Create one descriptor section.
 *
 * @param {string} fingerprint - Store the section fingerprint.
 * @returns {ShaderDescriptorSection} Return section.
 */
function createSection(fingerprint) {
	return {
		descriptorId: fingerprint,
		fingerprint,
		compatibilityTags: [],
		facts: {},
	};
}

/**
 * Create one shader contribution.
 *
 * @param {Partial<ShaderContribution>} [overrides] - Supplies overrides.
 * @returns {ShaderContribution} Return contribution.
 */
function createContribution(overrides = {}) {
	return {
		id: 'runtime-state',
		owner: 'runtime',
		descriptorFingerprint: 'runtime',
		compatibilityTags: [],
		provides: ['createInitialShaderState'],
		requires: [],
		defines: ['#define A32_TEST_MODE 1'],
		uniforms: [
			{
				name: 'uExposure',
				type: 'float',
				valueKey: 'exposure',
			},
		],
		textures: [],
		functions: [
			{
				id: 'state-type',
				slot: 'declareTypes',
				order: 0,
				code: 'struct ShaderState { vec2 uv; vec3 color; };',
			},
			{
				id: 'create-state',
				slot: 'declareHelpers',
				order: 0,
				code: 'ShaderState createInitialShaderState(vec2 uv) { return ShaderState(uv, vec3(0.0)); }',
			},
		],
		mainHooks: [],
		bindingRequirements: [
			{
				id: 'uniform.exposure',
				owner: 'runtime',
				kind: 'uniform',
				updateFrequency: 'config',
				valueKey: 'exposure',
				required: true,
			},
		],
		...overrides,
	};
}

describe('Algorithm32ShaderAssembler', () => {
	it('keeps the shader assembler documented', () => {
		const source = readSource();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class Algorithm32ShaderAssembler');
		expect(source).toContain('assemble(request)');
		expect(source).toContain('@returns {ShaderAssemblyResult}');
	});

	it('assembles deterministic fragment source from compatible contributions', () => {
		const assembler = new Algorithm32ShaderAssembler();
		const colorContribution = createContribution({
			id: 'color-output',
			owner: 'color',
			descriptorFingerprint: 'color',
			provides: ['encodeOutput'],
			defines: [],
			uniforms: [],
			functions: [],
			mainHooks: [
				{
					id: 'encode-output',
					slot: 'encodeOutput',
					order: 0,
					code: 'state.color = vec3(uExposure);\noutColor = vec4(state.color, 1.0);',
				},
			],
			bindingRequirements: [],
		});
		const descriptor = createDescriptor();

		const first = assembler.assemble({
			descriptor,
			contributions: [
				colorContribution,
				createContribution(),
			],
			mainRequiredSymbols: ['createInitialShaderState', 'encodeOutput'],
		});
		const second = assembler.assemble({
			descriptor,
			contributions: [
				createContribution(),
				colorContribution,
			],
			mainRequiredSymbols: ['createInitialShaderState', 'encodeOutput'],
		});

		expect(first.status).toBe('accepted');
		expect(first.fragmentShaderSource).toBe(second.fragmentShaderSource);
		expect(first.sourceHash).toBe(second.sourceHash);
		expect(first.fragmentShaderSource).toContain('#version 300 es');
		expect(first.fragmentShaderSource).toContain('uniform float uExposure;');
		expect(first.fragmentShaderSource).toContain('ShaderState state = createInitialShaderState(vUv);');
		expect(first.fragmentShaderSource).toContain('outColor = vec4(state.color, 1.0);');
		expect(first.bindingRequirements.map((binding) => binding.id)).toEqual(['uniform.exposure']);
	});

	it('sorts binding requirements by stable id', () => {
		const assembler = new Algorithm32ShaderAssembler();
		const assembly = assembler.assemble({
			descriptor: createDescriptor(),
			contributions: [
				createContribution({
					bindingRequirements: [
						{
							id: 'z-binding',
							owner: 'runtime',
							kind: 'uniform',
							updateFrequency: 'frame',
							valueKey: 'z',
							required: true,
						},
						{
							id: 'a-binding',
							owner: 'runtime',
							kind: 'uniform',
							updateFrequency: 'frame',
							valueKey: 'a',
							required: true,
						},
					],
				}),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
		});

		expect(assembly.bindingRequirements.map((binding) => binding.id)).toEqual(['a-binding', 'z-binding']);
	});

	it('throws a structured setup-time error when validation rejects the request', () => {
		const assembler = new Algorithm32ShaderAssembler();
		let caughtError;

		try {
			assembler.assemble({
				descriptor: createDescriptor(),
				contributions: [],
				mainRequiredSymbols: ['createInitialShaderState'],
			});
		} catch (error) {
			caughtError = error;
		}

		expect(caughtError).toEqual(jasmine.any(Error));
		expect(caughtError.name).toBe('ShaderConfigurationError');
		expect(caughtError.code).toBe('SHADER_SYMBOL_VALIDATION_FAILED');
		expect(caughtError.details.missingRequiredSymbols).toEqual(['createInitialShaderState']);
	});
});
