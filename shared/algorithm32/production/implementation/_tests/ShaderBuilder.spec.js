import { readFileSync } from 'node:fs';

/**
 * Read the ShaderBuilder implementation source.
 *
 * @returns {string} The ShaderBuilder source text.
 */
function readShaderBuilderSource() {
	return readFileSync(new URL('../ShaderBuilder.js', import.meta.url), 'utf8');
}

/**
 * Read the implementation-local ambient type source.
 *
 * @returns {string} The implementation type source text.
 */
function readImplementationTypes() {
	return readFileSync(new URL('../types.d.ts', import.meta.url), 'utf8');
}

describe('ShaderBuilder', () => {
	it('keeps the runtime shader artifact builder skeleton documented', () => {
		const source = readShaderBuilderSource();
		const localTypes = readImplementationTypes();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class ShaderBuilder');
		expect(source).toContain('constructor(dependencies)');
		expect(source).toContain('async build(request)');
		expect(source).toContain('refreshConfig(config)');
		expect(source).toContain('@param {ShaderBuildRequest} request -');
		expect(source).toContain('@returns {Promise<ShaderBuildResult>} The built runtime shader artifact');
		expect(localTypes).toContain('type ShaderBuilderDependencies');
		expect(localTypes).toContain('type ShaderBuildRequest');
		expect(localTypes).toContain('type ShaderBuildResult');
	});
});
