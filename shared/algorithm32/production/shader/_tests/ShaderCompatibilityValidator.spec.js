import { readFileSync } from 'node:fs';

import { ShaderCompatibilityValidator } from '../ShaderCompatibilityValidator.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../ShaderCompatibilityValidator.js', import.meta.url), 'utf8');
}

/**
 * Create a complete descriptor for validation specs.
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
		defines: [],
		uniforms: [],
		textures: [],
		functions: [],
		mainHooks: [],
		bindingRequirements: [],
		...overrides,
	};
}

describe('ShaderCompatibilityValidator', () => {
	it('keeps the compatibility validator documented', () => {
		const source = readSource();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class ShaderCompatibilityValidator');
		expect(source).toContain('validate(request)');
		expect(source).toContain('@returns {ShaderSymbolValidationReport}');
	});

	it('accepts contributions that satisfy descriptor and symbol requirements', () => {
		const validator = new ShaderCompatibilityValidator();
		const report = validator.validate({
			descriptor: createDescriptor(),
			contributions: [
				createContribution(),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
		});

		expect(report.status).toBe('accepted');
		expect(report.providedSymbols).toEqual(['createInitialShaderState']);
		expect(report.requiredSymbols).toEqual(['createInitialShaderState']);
		expect(report.errors).toEqual([]);
	});

	it('rejects missing required symbols', () => {
		const validator = new ShaderCompatibilityValidator();
		const report = validator.validate({
			descriptor: createDescriptor(),
			contributions: [],
			mainRequiredSymbols: ['createInitialShaderState'],
		});

		expect(report.status).toBe('rejected');
		expect(report.missingRequiredSymbols).toEqual(['createInitialShaderState']);
		expect(report.errors[0]).toContain('Required shader symbol is missing');
	});

	it('rejects duplicate provided symbols', () => {
		const validator = new ShaderCompatibilityValidator();
		const report = validator.validate({
			descriptor: createDescriptor(),
			contributions: [
				createContribution({ id: 'runtime-a' }),
				createContribution({ id: 'runtime-b' }),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
		});

		expect(report.status).toBe('rejected');
		expect(report.duplicateProvidedSymbols).toEqual(['createInitialShaderState']);
		expect(report.errors[0]).toContain('provided by multiple contributions');
	});

	it('rejects descriptor fingerprint mismatches', () => {
		const validator = new ShaderCompatibilityValidator();
		const report = validator.validate({
			descriptor: createDescriptor(),
			contributions: [
				createContribution({
					descriptorFingerprint: 'outside-descriptor',
				}),
			],
			mainRequiredSymbols: ['createInitialShaderState'],
		});

		expect(report.status).toBe('rejected');
		expect(report.errors[0]).toContain('not compatible with descriptor fingerprint outside-descriptor');
	});
});
