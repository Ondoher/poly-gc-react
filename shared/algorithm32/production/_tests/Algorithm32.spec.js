import { readFileSync } from 'node:fs';

/**
 * Read the Algorithm32 facade source.
 *
 * @returns {string} The Algorithm32 facade source text.
 */
function readAlgorithm32Source() {
	return readFileSync(new URL('../Algorithm32.js', import.meta.url), 'utf8');
}

describe('Algorithm32', () => {
	it('keeps the primary facade skeleton documented', () => {
		const source = readAlgorithm32Source();
		const expectedSnippets = [
			'export class Algorithm32',
			'constructor(config)',
			'get config()',
			'setConfig(config)',
			'async setupShader(request)',
			'evaluate(request)',
			'dispose()',
			'@param {Config} config -',
			'@returns {Promise<ShaderHandle>} The installed runtime shader handle.',
			'@returns {EvaluationResult} The spectral evaluation result.',
		];

		for (const expectedSnippet of expectedSnippets) {
			// Reason: each production class keeps its own local class-named spec file.
			// Source: Algorithm32 production test placement convention, 2026-06-28.
			expect(source).toContain(expectedSnippet);
		}
	});
});
