import { readFileSync } from 'node:fs';

import BrunetonColorDisplayModel from '../BrunetonColorDisplayModel.js';
import {
	CANONICAL_SPECTRAL_BASIS,
	CANONICAL_SPECTRAL_CHANNELS,
	FIGURE1_DISPLAY_CONSTANTS,
} from '../../constants/Algorithm32CanonicalData.js';

/**
 * Read the implementation source.
 *
 * @returns {string} Return source text.
 */
function readSource() {
	return readFileSync(new URL('../BrunetonColorDisplayModel.js', import.meta.url), 'utf8');
}

describe('BrunetonColorDisplayModel', () => {
	it('keeps the concrete Color implementation documented', () => {
		const source = readSource();

		expect(source).toContain('export class BrunetonColorDisplayModel');
		expect(source).toContain('convert(request)');
		expect(source).toContain('composeSceneDisplayRgb(request)');
		expect(source).toContain('createShaderContribution(request)');
		expect(source).toContain('(script a32-poc-color-032)');
	});

	it('describes the accepted Figure 1 display conversion', () => {
		const model = new BrunetonColorDisplayModel();
		const descriptor = model.describe();

		expect(model.id).toBe('bruneton-figure1-display');
		expect(descriptor).toEqual(jasmine.objectContaining({
			kind: 'algorithm32-color',
			id: 'bruneton-figure1-display',
			colorSpace: 'linear-srgb',
			conversionKind: 'cie-xyz-to-linear-srgb-paper-figure1-tone-map',
			fingerprint: 'fnv1a32:637a964b',
		}));
		expect(descriptor.displayConversion).toEqual({
			conversionKind: 'cie-xyz-to-linear-srgb-paper-figure1-tone-map',
			outputColorSpace: 'linear-srgb',
			toneMapping: 'paper-figure1-exponential',
			metadata: {
				maxLuminousEfficacyLumensPerWatt: 683,
				paperFigure1ToneMapK: FIGURE1_DISPLAY_CONSTANTS.paperFigure1ToneMapK,
				demoGammaPowerOmitted: true,
				demoWhitePointOmitted: true,
			},
		});
	});

	it('converts canonical spectral radiance through the accepted CIE adapter', () => {
		const model = new BrunetonColorDisplayModel();
		const ones = CANONICAL_SPECTRAL_CHANNELS.map(() => 1);

		expectTripletClose(model.radianceToLinearSrgb(ones), [
			88556.54004771677,
			68682.57552023987,
			67558.81357134461,
		]);
		expectTripletClose(model.radianceToDisplayRgb(ones), [
			0.9999999999945294,
			0.999999998157289,
			0.9999999974392394,
		]);
		expect(model.convert({
			spectralRadiance: ones,
			spectral: CANONICAL_SPECTRAL_BASIS,
		})).toEqual({
			channels: model.radianceToDisplayRgb(ones),
			colorSpace: 'linear-srgb',
		});
	});

	it('round-trips the Figure 1 tone-map domain and caches albedo fitting', () => {
		const model = new BrunetonColorDisplayModel();
		const linear = [10, 20, 30];
		const display = model.linearSrgbToDisplayRgb(linear);

		expectTripletClose(model.displayRgbToLinearSrgb(display), linear);

		const first = model.linearSrgbAlbedoToSpectralReflectance([0.2, 0.4, 0.6]);
		const second = model.linearSrgbAlbedoToSpectralReflectance([0.2, 0.4, 0.6]);

		expect(first).toBe(second);
		expect(first.length).toBe(15);
		expect(first.slice(0, 5)).toEqual([
			0.3760715273091948,
			0.47310899449270605,
			0.5729901093800024,
			0.582056702127065,
			0.5180279841285339,
		]);
	});

	it('composes captured scene color through the JS display abstraction', () => {
		const model = new BrunetonColorDisplayModel();
		const zero = CANONICAL_SPECTRAL_CHANNELS.map(() => 0);
		const one = CANONICAL_SPECTRAL_CHANNELS.map(() => 1);
		const sceneDisplayRgb = [0.12, 0.34, 0.56];

		expectTripletClose(model.composeSceneDisplayRgb({
			pathRadiance: zero,
			transmittance: one,
			sceneDisplayRgb,
		}), sceneDisplayRgb);

		const pathRadiance = CANONICAL_SPECTRAL_CHANNELS.map((_, index) => (index + 1) * 0.000001);
		const transmittance = CANONICAL_SPECTRAL_CHANNELS.map((_, index) => index / (CANONICAL_SPECTRAL_CHANNELS.length - 1));
		const pathLinearSrgb = model.radianceToLinearSrgb(pathRadiance);
		const sceneLinearSrgb = model.displayRgbToLinearSrgb(sceneDisplayRgb);
		const transmittanceRgb = model.spectralTransmittanceToRgbBands(transmittance);

		expectTripletClose(transmittanceRgb, [
			0.7857142857142857,
			0.42857142857142855,
			0.14285714285714285,
		]);
		expectTripletClose(model.composeSceneLinearSrgb({
			pathRadiance,
			transmittance,
			sceneDisplayRgb,
		}), pathLinearSrgb.map((value, index) =>
			value + sceneLinearSrgb[index] * transmittanceRgb[index]));
		expectTripletClose(model.composeSceneDisplayRgb({
			pathRadiance: zero,
			transmittance,
			sceneDisplayRgb,
			applySceneTransmittance: false,
		}), sceneDisplayRgb);

		const rendererLinearSceneRgb = [0.003, 0.01, 0.08];
		const rendererDisplaySceneRgb = model.rendererLinearSrgbToDisplayRgb(rendererLinearSceneRgb);

		expectTripletClose(rendererDisplaySceneRgb, [
			0.03876,
			0.09985282273412832,
			0.31330415714736193,
		]);
		expectTripletClose(model.composeSceneDisplayRgb({
			pathRadiance: zero,
			transmittance,
			sceneDisplayRgb: rendererLinearSceneRgb,
			sceneColorSpace: 'linear-srgb',
			applySceneTransmittance: false,
		}), rendererDisplaySceneRgb);
	});

	it('creates the Color-owned display shader contribution', () => {
		const model = new BrunetonColorDisplayModel();
		const contribution = model.createShaderContribution({
			descriptor: createDescriptor(model.describe()),
		});

		expect(contribution).toEqual(jasmine.objectContaining({
			id: 'color-bruneton-figure1-display',
			owner: 'color',
			descriptorFingerprint: 'color',
		}));
		expect(contribution.provides).toEqual([
			'color.composeSceneColor',
			'color.encodeOutput',
		]);
		expect(contribution.requires).toEqual([
			'runtime.initialState',
			'transport.evaluatePathRadiance',
		]);
		expect(contribution.functions.map((block) => block.id)).toEqual([
			'color-display-constants',
			'color-compose-helper',
			'color-encode-helper',
		]);
		expect(contribution.functions[0].code).toContain('DISPLAY_TONE_MAP_K');
		expect(contribution.functions[0].code).toContain('float[15]');
		expect(contribution.functions[1].code).toContain('spectralRadianceToLinearSrgb');
		expect(contribution.functions[1].code).toContain('spectralTransmittanceToRgbBands');
		expect(contribution.functions[1].code).toContain('rendererLinearSrgbToDisplayRgb');
		expect(contribution.functions[1].code).toContain('shouldApplySceneTransmittance');
		expect(contribution.functions[1].code).toContain('state.bounds.endpointDistanceMeters <= state.bounds.endDistanceMeters');
		expect(contribution.functions[1].code).toContain('vec3 sceneDisplayRgb = rendererLinearSrgbToDisplayRgb(state.sceneDisplayRgb);');
		expect(contribution.functions[1].code).toContain('return pathLinearSrgb + sceneLinearSrgb * sceneTransmittanceRgb;');
		expect(contribution.functions[2].code).toContain('encodeDisplayOutput');
		expect(contribution.mainHooks.map((block) => block.code)).toEqual([
			'state.outputRgba = encodeDisplayOutput(composeSceneLinearSrgb(state));',
			'outColor = state.outputRgba;',
		]);
	});

	it('fails loudly for non-canonical basis and shader channel shape', () => {
		const model = new BrunetonColorDisplayModel();
		const ones = CANONICAL_SPECTRAL_CHANNELS.map(() => 1);

		expect(() => model.convert({ spectralRadiance: ones, spectral: { wavelengths: [] } }))
			.toThrowError(/channel count/);
		expect(() => model.convert({
			spectralRadiance: ones,
			spectral: {
				wavelengths: [
					{ value: 1, units: 'nanometers' },
					...CANONICAL_SPECTRAL_BASIS.wavelengths.slice(1),
				],
			},
		})).toThrowError(/wavelengths/);
		expect(() => model.radianceToLinearSrgb([1, 2, 3])).toThrowError(/canonical basis/);
		expect(() => model.createShaderContribution({
			descriptor: createDescriptor(model.describe(), 14),
		})).toThrowError(/canonical spectral channel count/);
	});
});

/**
 * Create a shader descriptor with a color section.
 *
 * @param {ColorDescriptor} colorDescriptor - Supplies color facts.
 * @param {number} [channelCount] - Supplies spectral channel count.
 * @returns {Algorithm32ShaderDescriptor} Return descriptor.
 */
function createDescriptor(colorDescriptor, channelCount = 15) {
	return {
		descriptorId: 'descriptor',
		variantId: 'variant',
		fingerprint: 'descriptor',
		compatibilityTags: [],
		spectralBasis: createSection('basis', {
			channelCount,
		}),
		geometry: createSection('geometry', {}),
		atmosphere: createSection('atmosphere', {}),
		lightSource: createSection('light-source', {}),
		cache: createSection('cache', {}),
		transport: createSection('transport', {}),
		color: createSection('color', colorDescriptor),
		runtime: createSection('runtime', {}),
	};
}

/**
 * Create one descriptor section.
 *
 * @param {string} fingerprint - Supplies section fingerprint.
 * @param {unknown} facts - Supplies section facts.
 * @returns {ShaderDescriptorSection} Return section.
 */
function createSection(fingerprint, facts) {
	return {
		descriptorId: fingerprint,
		fingerprint,
		compatibilityTags: [fingerprint],
		facts,
	};
}

/**
 * Expect matching finite RGB triplets.
 *
 * @param {readonly number[]} actual - Supplies actual values.
 * @param {readonly number[]} expected - Supplies expected values.
 * @returns {void}
 */
function expectTripletClose(actual, expected) {
	expect(actual.length).toBe(3);

	for (let index = 0; index < 3; index += 1) {
		expect(actual[index]).withContext(`channel ${index}`).toBeCloseTo(expected[index], 10);
	}
}
