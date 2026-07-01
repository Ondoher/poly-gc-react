import { SharedModel } from '../SharedModel.js';
import { SpectralModel } from '../SpectralModel.js';

/**
 * Create a wavelength test packet.
 *
 * @param {number} value - Supplies the wavelength value.
 * @returns {{ value: number, units: string }} The wavelength packet.
 */
function wavelength(value) {
	return {
		value,
		units: 'nanometer',
	};
}

/**
 * Create a simple descriptor-bearing model implementation for aggregate tests.
 *
 * @param {string} kind - Supplies the descriptor kind.
 * @returns {{ id: string, describe: function(): object }} The model double.
 */
function createDescribedModel(kind) {
	return {
		id: `${kind}-test`,
		describe() {
			return {
				kind,
				id: this.id,
			};
		},
	};
}

describe('SharedModel', () => {
	it('constructs the spectral model from consumer supplied models and spectral basis', () => {
		const lightSource = createDescribedModel('light-source');
		const atmosphere = createDescribedModel('atmosphere');
		const geometry = createDescribedModel('geometry');
		const spectralBasis = {
			wavelengths: [wavelength(380), wavelength(500), wavelength(620)],
		};
		const model = new SharedModel({
			version: 4,
			lightSource,
			atmosphere,
			geometry,
			spectralBasis,
		});

		spectralBasis.wavelengths[0] = wavelength(999);

		expect(model.version).toBe(4);
		expect(model.lightSource).toBe(lightSource);
		expect(model.atmosphere).toBe(atmosphere);
		expect(model.geometry).toBe(geometry);
		expect(model.spectral instanceof SpectralModel).toBe(true);
		expect(model.spectral.basis).toEqual({
			wavelengths: [wavelength(380), wavelength(500), wavelength(620)],
		});
		expect(model.spectral.fingerprint).toBe('spectral:3:380,500,620:380:nanometer,500:nanometer,620:nanometer');
		expect(model.snapshot()).toEqual({
			version: 4,
			lightSource: {
				kind: 'light-source',
				id: 'light-source-test',
			},
			atmosphere: {
				kind: 'atmosphere',
				id: 'atmosphere-test',
			},
			geometry: {
				kind: 'geometry',
				id: 'geometry-test',
			},
			spectral: {
				kind: 'algorithm32-spectral-model',
				wavelengths: [wavelength(380), wavelength(500), wavelength(620)],
				channelCount: 3,
				fingerprint: 'spectral:3:380,500,620:380:nanometer,500:nanometer,620:nanometer',
				version: 4,
			},
		});
	});
});
