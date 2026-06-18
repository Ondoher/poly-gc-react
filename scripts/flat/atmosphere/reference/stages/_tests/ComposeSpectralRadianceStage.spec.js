import {
	createReferenceIntegrator,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
} from '../../_tests/test-pipeline-stages.js';

describe('atmosphere reference ComposeSpectralRadianceStage', function() {
	function runComposeSpectralRadiance(packet = createComposePacket()) {
		return createReferenceIntegrator().runStage('composeSpectralRadiance', packet);
	}

	function createComposePacket({
		inScattered = [0.1, 0.2],
		diffuseSkyAirlight = [0.05, 0.06],
		surface = [0.3, 0.4],
	} = {}) {
		return {
			validatedRequest: { wavelengthsNm: [450, 650] },
			singleScattering: {
				inScatteredRadianceByWavelength: inScattered,
			},
			diffuseSkyAirlight: {
				radianceByWavelength: diffuseSkyAirlight,
			},
			surfaceRadiance: {
				viewAttenuatedRadianceByWavelength: surface,
			},
			stageHistory: [],
		};
	}

	it('declares its stage contract', function() {
		// Reason: stage descriptor metadata is the public registry contract for this stage.
		// Source: Reference Code Design, Public API Shape; descriptors declare ids, prerequisites, and provides.
		expectStageDescriptor('composeSpectralRadiance');
	});

	it('runs exactly one stage against a prepared packet', function() {
		const packet = createComposePacket();
		const result = runComposeSpectralRadiance(packet);

		// Reason: direct stage runs must append only their own stage id and avoid mutating input.
		// Source: Reference Code Design, Public API Shape; stages are independently runnable packet transforms.
		expect(result).not.toBe(packet);
		expect(result.stageHistory).toEqual(['composeSpectralRadiance']);
		expect(packet.spectralRadiance).toBeUndefined();
		expect(result.spectralRadiance).toEqual(jasmine.any(Object));
	});

	it('fails loudly when prerequisites are missing', function() {
		// Reason: direct stage execution should fail at the stage boundary when required packet data is absent.
		// Source: Reference Code Design, Public API Shape; stages declare prerequisites and reject missing ones.
		expectStagePrerequisiteFailure('composeSpectralRadiance');
	});

	it('sums in-scattered, diffuse-sky-airlight, and surface radiance wavelength by wavelength', function() {
		const result = runComposeSpectralRadiance();

		// Reason: final transport radiance is the component sum at each wavelength before display conversion.
		// Source: Stage Contracts, composeSpectralRadiance ownership.
		expect(result.spectralRadiance.wavelengthsNm).toEqual([450, 650]);
		expect(result.spectralRadiance.finalByWavelength).toEqual([0.45, 0.66]);
		expect(result.spectralRadiance.components).toEqual({
			inScatteredRadianceByWavelength: [0.1, 0.2],
			diffuseSkyAirlightRadianceByWavelength: [0.05, 0.06],
			surfaceViewAttenuatedRadianceByWavelength: [0.3, 0.4],
		});
	});

	it('treats absent diffuse-sky-airlight packets as zero for custom direct composition packets', function() {
		const packet = createComposePacket();
		delete packet.diffuseSkyAirlight;
		const result = runComposeSpectralRadiance(packet);

		// Reason: diffuse sky airlight is optional until callers opt into the approximation stage.
		// Source: Stage Contracts, composeSpectralRadiance optional diffuseSkyAirlight note.
		expect(result.spectralRadiance.finalByWavelength).toEqual([0.4, 0.6000000000000001]);
		expect(result.spectralRadiance.components.diffuseSkyAirlightRadianceByWavelength).toEqual([0, 0]);
	});

	it('allows very bright radiance without display clamping', function() {
		const result = runComposeSpectralRadiance(createComposePacket({
			inScattered: [1000, 0],
			diffuseSkyAirlight: [0, 0],
			surface: [2, 0],
		}));

		// Reason: tone mapping and display range conversion are post-pipeline consumers, not transport composition.
		// Source: Stage Contracts, composeSpectralRadiance ownership.
		expect(result.spectralRadiance.finalByWavelength).toEqual([1002, 0]);
	});

	it('rejects negative diffuse-sky-airlight component radiance', function() {
		// Reason: approximation components are physical radiance additions and should not be repaired by clamping.
		// Source: Stage Contracts, composeSpectralRadiance ownership.
		expect(() => runComposeSpectralRadiance(createComposePacket({
			diffuseSkyAirlight: [-0.1, 0],
		}))).toThrowError(/composeSpectralRadiance.*negative/);
	});

	it('rejects negative component radiance', function() {
		// Reason: physical radiance components are nonnegative and must not be repaired by clamping.
		// Source: Stage Contracts, composeSpectralRadiance ownership.
		expect(() => runComposeSpectralRadiance(createComposePacket({
			inScattered: [-0.1, 0],
			surface: [0, 0],
		}))).toThrowError(/composeSpectralRadiance.*negative/);
	});
});
