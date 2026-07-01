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
 * Create a valid spectral model for tests.
 *
 * @returns {SpectralModel} The initialized spectral model.
 */
function createSpectralModel() {
	return new SpectralModel({
		basis: {
			wavelengths: [wavelength(360), wavelength(400), wavelength(440)],
		},
		fingerprint: 'initial-spectral-fingerprint',
		version: 7,
	});
}

describe('SpectralModel', () => {
	it('owns copied spectral basis data and exposes descriptor state', () => {
	const inputBasis = {
		wavelengths: [wavelength(360), wavelength(400), wavelength(440)],
	};
		const model = new SpectralModel({
			basis: inputBasis,
			fingerprint: 'basis-a',
			version: 2,
		});

		inputBasis.wavelengths[0] = wavelength(999);

	expect(model.basis).toEqual({
		wavelengths: [wavelength(360), wavelength(400), wavelength(440)],
	});
		expect(model.wavelengths).toEqual([wavelength(360), wavelength(400), wavelength(440)]);
		expect(model.channelCount).toBe(3);
		expect(model.fingerprint).toBe('basis-a');
		expect(model.version).toBe(2);
		expect(model.describe()).toEqual({
			kind: 'algorithm32-spectral-model',
			wavelengths: [wavelength(360), wavelength(400), wavelength(440)],
			channelCount: 3,
			fingerprint: 'basis-a',
			version: 2,
		});
	});

	it('replaces spectral basis data and increments the model version', () => {
		const model = createSpectralModel();
	const descriptor = model.replaceBasis({
		wavelengths: [wavelength(500), wavelength(600)],
	});

	expect(model.basis).toEqual({
		wavelengths: [wavelength(500), wavelength(600)],
	});
		expect(model.version).toBe(8);
		expect(model.fingerprint).toBe('spectral:2:500,600:500:nanometer,600:nanometer');
		expect(descriptor).toEqual({
			kind: 'algorithm32-spectral-model',
			wavelengths: [wavelength(500), wavelength(600)],
			channelCount: 2,
			fingerprint: 'spectral:2:500,600:500:nanometer,600:nanometer',
			version: 8,
		});
	});

	it('returns wavelengths by channel index and fails on invalid indexes', () => {
		const model = createSpectralModel();

		expect(model.getWavelength(1)).toEqual(wavelength(400));
		expect(() => model.getWavelength(-1)).toThrowError(RangeError);
		expect(() => model.getWavelength(3)).toThrowError(RangeError);
	});

	it('checks spectral numeric vector alignment by channel count', () => {
		const model = createSpectralModel();

		expect(model.isAligned([1, 2, 3])).toBe(true);
		expect(model.isAligned([1, 2])).toBe(false);
		expect(model.isAligned([1, 2, 3, 4])).toBe(false);
	});

	it('checks spectral basis alignment with call-local tolerance options', () => {
		const model = createSpectralModel();

	expect(model.isBasisAligned({
		wavelengths: [wavelength(360), wavelength(400), wavelength(440)],
	})).toBe(true);
	expect(model.isBasisAligned({
		wavelengths: [wavelength(360), wavelength(400.001), wavelength(440)],
	})).toBe(false);
	expect(model.isBasisAligned({
		wavelengths: [wavelength(360), wavelength(400.001), wavelength(440)],
	}, {
		epsilon: 0.01,
	})).toBe(true);
	expect(model.isBasisAligned({
		wavelengths: [wavelength(360), wavelength(400)],
	})).toBe(false);
	});
});
