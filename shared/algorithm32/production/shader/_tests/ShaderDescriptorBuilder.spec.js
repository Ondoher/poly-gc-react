import { readFileSync } from 'node:fs';

import { SharedModel } from '../../models/SharedModel.js';
import { ShaderDescriptorBuilder } from '../ShaderDescriptorBuilder.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../ShaderDescriptorBuilder.js', import.meta.url), 'utf8');
}

/**
 * Create a wavelength test packet.
 *
 * @param {number} value - Supplies the wavelength value.
 * @returns {{ value: number, units: string }} Return wavelength packet.
 */
function wavelength(value) {
	return {
		value,
		units: 'nanometers',
	};
}

/**
 * Create a descriptor-bearing model double.
 *
 * @param {string} owner - Supplies owner name.
 * @returns {object} Return model double.
 */
function createModel(owner) {
	return {
		describe() {
			return {
				kind: `algorithm32-${owner}-model`,
				id: `${owner}-test`,
				fingerprint: `${owner}:fingerprint`,
			};
		},
	};
}

/**
 * Create a shared model for descriptor specs.
 *
 * @returns {SharedModel} Return shared model.
 */
function createSharedModel() {
	return new SharedModel({
		version: 5,
		lightSource: createModel('light-source'),
		atmosphere: createModel('atmosphere'),
		geometry: createModel('geometry'),
		spectralBasis: {
			wavelengths: [wavelength(450), wavelength(550), wavelength(650)],
		},
	});
}

describe('ShaderDescriptorBuilder', () => {
	it('keeps the shader descriptor builder documented', () => {
		const source = readSource();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class ShaderDescriptorBuilder');
		expect(source).toContain('build(request)');
		expect(source).toContain('@returns {Algorithm32ShaderDescriptor}');
	});

	it('builds deterministic descriptor sections from the shared model snapshot', () => {
		const builder = new ShaderDescriptorBuilder();
		const model = createSharedModel();
		const config = {
			version: 5,
			config: {
				execution: {
					pathIntervalCount: 8,
				},
				shader: {
					mode: 'test-mode',
				},
			},
			model: model.snapshot(),
		};
		const color = {
			describe() {
				return {
					kind: 'algorithm32-color',
					id: 'test-color',
					colorSpace: 'linear-display',
					fingerprint: 'color:fingerprint',
				};
			},
		};

		const first = builder.build({ model, config, color });
		const second = builder.build({ snapshot: model.snapshot(), config, color });

		expect(first.fingerprint).toBe(second.fingerprint);
		expect(first.variantId).toBe('model-v5');
		expect(first.spectralBasis.facts.channelCount).toBe(3);
		expect(first.geometry.facts.id).toBe('geometry-test');
		expect(first.lightSource.facts.id).toBe('light-source-test');
		expect(first.transport.facts.execution.pathIntervalCount).toBe(8);
		expect(first.color.facts.id).toBe('test-color');
		expect(first.runtime.facts.mode).toBe('test-mode');
	});

	it('fails loudly when config does not supply Color', () => {
		const builder = new ShaderDescriptorBuilder();

		expect(() => builder.build({
			model: createSharedModel(),
		})).toThrowError(/Color abstraction/);
	});

	it('uses configured Color from the accepted facade config snapshot', () => {
		const builder = new ShaderDescriptorBuilder();
		const descriptor = builder.build({
			model: createSharedModel(),
			config: {
				config: {
					color: {
						describe() {
							return {
								kind: 'algorithm32-color',
								id: 'config-color',
								colorSpace: 'linear-display',
								fingerprint: 'color:config',
							};
						},
					},
				},
			},
		});

		expect(descriptor.color.facts).toEqual(jasmine.objectContaining({
			id: 'config-color',
			colorSpace: 'linear-display',
		}));
	});
});
