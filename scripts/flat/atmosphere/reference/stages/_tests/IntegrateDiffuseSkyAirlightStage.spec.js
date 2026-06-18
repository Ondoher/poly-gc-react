import {
	createReferenceIntegrator,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
} from '../../_tests/test-pipeline-stages.js';
import {
	expectExpectationValue,
	getDiffuseSkyAirlightContractExpectation,
	getExpectedDatum,
} from '../../_tests/test-expectations.js';

describe('atmosphere reference IntegrateDiffuseSkyAirlightStage', function() {
	const STAGE_ID = 'integrateDiffuseSkyAirlight';

	function runIntegrateDiffuseSkyAirlight(packet = createPacketFromExpectation(
		getDiffuseSkyAirlightContractExpectation('diffuse-sky-airlight.high-tau.lost-transmittance'),
	)) {
		return createReferenceIntegrator().runStage(STAGE_ID, packet);
	}

	function createPacketFromExpectation(expectation) {
		return {
			validatedRequest: {
				wavelengthsNm: expectation.inputs.wavelengthsNm,
				numerical: expectation.inputs.numerical,
			},
			viewOpticalDepth: expectation.inputs.viewOpticalDepth,
			solarTransmittance: expectation.inputs.solarTransmittance,
			singleScattering: expectation.inputs.singleScattering,
			stageHistory: [],
		};
	}

	it('declares the diffuse sky airlight stage contract', function() {
		// Reason: the growing higher-order airlight contract should use the broader stage id.
		// Source: Sun Visual Plan, Horizon-Row Diagnostic Result; Multiple-Scattering Reference Design.
		expectStageDescriptor(STAGE_ID);
	});

	it('fails loudly when diffuse sky airlight prerequisites are missing', function() {
		// Reason: direct stage execution should fail at the stage boundary when required packet data is absent.
		// Source: Reference Code Design, Public API Shape; stages declare prerequisites and reject missing ones.
		expectStagePrerequisiteFailure(STAGE_ID);
	});

	it('preserves low-tau suppression under the aerosol-aware output packet', function() {
		const expectation = getDiffuseSkyAirlightContractExpectation(
			'diffuse-sky-airlight.low-tau.no-lift',
		);
		const result = runIntegrateDiffuseSkyAirlight(
			createPacketFromExpectation(expectation),
		);

		// Reason: the aerosol-aware approximation must not make ordinary low-tau views gain fake diffuse sky airlight.
		// Source: diffuse-sky-airlight fixture row diffuse-sky-airlight.low-tau.no-lift.
		expect(result.diffuseSkyAirlight.mode).toBe(getExpectedDatum(expectation, 'mode').value);
		expectExpectationValue(
			result.diffuseSkyAirlight.diagnostics.activation,
			expectation,
			'activation',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.radianceByWavelength,
			expectation,
			'skyAirlightRadianceByWavelength',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.renderedSinglePlusSkyAirlightByWavelength,
			expectation,
			'renderedSinglePlusSkyAirlightByWavelength',
		);
	});

	it('reduces to the first high-tau lost-transmittance proxy when no aerosol depth is present', function() {
		const expectation = getDiffuseSkyAirlightContractExpectation(
			'diffuse-sky-airlight.high-tau.lost-transmittance',
		);
		const result = runIntegrateDiffuseSkyAirlight(
			createPacketFromExpectation(expectation),
		);

		// Reason: missing aerosol diagnostics must behave as zero aerosol participation, preserving the older proxy.
		// Source: diffuse-sky-airlight fixture row diffuse-sky-airlight.high-tau.lost-transmittance.
		expect(result.diffuseSkyAirlight.mode).toBe(getExpectedDatum(expectation, 'mode').value);
		expectExpectationValue(
			result.diffuseSkyAirlight.diagnostics.activation,
			expectation,
			'activation',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.radianceByWavelength,
			expectation,
			'skyAirlightRadianceByWavelength',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.renderedSinglePlusSkyAirlightByWavelength,
			expectation,
			'renderedSinglePlusSkyAirlightByWavelength',
		);
		expect(result.diffuseSkyAirlight.diagnostics.contract)
			.toEqual(getExpectedDatum(expectation, 'diagnosticContract').value);
	});

	it('applies the aerosol-aware bounded radiance formula when Mie optical depth is present', function() {
		const expectation = getDiffuseSkyAirlightContractExpectation(
			'diffuse-sky-airlight.high-tau.aerosol-aware',
		);
		const fallbackExpectation = getDiffuseSkyAirlightContractExpectation(
			'diffuse-sky-airlight.high-tau.lost-transmittance',
		);

		const result = runIntegrateDiffuseSkyAirlight(createPacketFromExpectation(expectation));

		// Reason: the model improvement must be fixture-backed, not just a packet rename or report change.
		// Source: diffuse-sky-airlight fixture row diffuse-sky-airlight.high-tau.aerosol-aware.
		expect(result.diffuseSkyAirlight.mode).toBe(getExpectedDatum(expectation, 'mode').value);
		expectExpectationValue(
			result.diffuseSkyAirlight.diagnostics.aerosolSaturationByWavelength,
			expectation,
			'aerosolSaturationByWavelength',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.diagnostics.aerosolParticipationByWavelength,
			expectation,
			'aerosolParticipationByWavelength',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.diagnostics.neutralSourceSpectrum,
			expectation,
			'neutralSourceSpectrum',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.diagnostics.neutralMixByWavelength,
			expectation,
			'neutralMixByWavelength',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.diagnostics.aerosolGainByWavelength,
			expectation,
			'aerosolGainByWavelength',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.radianceByWavelength,
			expectation,
			'skyAirlightRadianceByWavelength',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.renderedSinglePlusSkyAirlightByWavelength,
			expectation,
			'renderedSinglePlusSkyAirlightByWavelength',
		);
		expect(result.diffuseSkyAirlight.radianceByWavelength[0])
			.toBeGreaterThan(getExpectedDatum(fallbackExpectation, 'skyAirlightRadianceByWavelength').value[0]);
		expect(result.diffuseSkyAirlight.radianceByWavelength[1])
			.toBeGreaterThan(getExpectedDatum(fallbackExpectation, 'skyAirlightRadianceByWavelength').value[1]);
	});

	it('reports aerosol and flat-geometry diagnostics for the bounded model', function() {
		const expectation = getDiffuseSkyAirlightContractExpectation(
			'diffuse-sky-airlight.aerosol-diagnostics',
		);
		const result = runIntegrateDiffuseSkyAirlight(
			createPacketFromExpectation(expectation),
		);

		// Reason: the active formula is aerosol-aware and bounded for flat high-tau paths.
		// Source: diffuse-sky-airlight fixture row diffuse-sky-airlight.aerosol-diagnostics.
		expectExpectationValue(
			result.diffuseSkyAirlight.diagnostics.aerosolOpticalDepthByWavelength,
			expectation,
			'aerosolOpticalDepthByWavelength',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.diagnostics.aerosolOpticalDepthFractionByWavelength,
			expectation,
			'aerosolOpticalDepthFractionByWavelength',
		);
		expectExpectationValue(
			result.diffuseSkyAirlight.diagnostics.maxAerosolOpticalDepth,
			expectation,
			'maxAerosolOpticalDepth',
		);
		expect(result.diffuseSkyAirlight.diagnostics.tauRegime)
			.toBe(getExpectedDatum(expectation, 'tauRegime').value);
		expect(result.diffuseSkyAirlight.diagnostics.flatGeometryLimitPolicy)
			.toBe(getExpectedDatum(expectation, 'flatGeometryLimitPolicy').value);
	});
});
