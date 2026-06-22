export const ISOTROPIC_PHASE_KIND = 'isotropic';
export const RAYLEIGH_PHASE_KIND = 'rayleigh';
export const HENYEY_GREENSTEIN_PHASE_KIND = 'henyey-greenstein';
export const CORNETTE_SHANKS_PHASE_KIND = 'cornette-shanks';

export function evaluatePhaseByWavelength({
	phaseKind,
	parameters = {},
	wavelengthsNm,
	cosTheta,
	errorPrefix = 'phase',
}) {
	const value = evaluatePhaseValue({
		phaseKind,
		parameters,
		cosTheta,
		errorPrefix,
	});

	return wavelengthsNm.map(() => value);
}

export function evaluatePhaseValue({
	phaseKind,
	parameters = {},
	cosTheta,
	errorPrefix = 'phase',
}) {
	if (phaseKind === ISOTROPIC_PHASE_KIND) {
		return 1 / (4 * Math.PI);
	}

	if (phaseKind === RAYLEIGH_PHASE_KIND) {
		return 3 * (1 + cosTheta * cosTheta) / (16 * Math.PI);
	}

	if (phaseKind === HENYEY_GREENSTEIN_PHASE_KIND) {
		return henyeyGreensteinPhase(cosTheta, parameters.g, errorPrefix);
	}

	if (phaseKind === CORNETTE_SHANKS_PHASE_KIND) {
		return cornetteShanksPhase(cosTheta, parameters.g, errorPrefix);
	}

	throw new RangeError(`${errorPrefix} unsupported phase kind: ${phaseKind}`);
}

export function henyeyGreensteinPhase(cosTheta, gParameter, errorPrefix = 'phase') {
	const g = validateAerosolPhaseG(
		gParameter,
		HENYEY_GREENSTEIN_PHASE_KIND,
		errorPrefix,
	);
	const incomingOutgoingCosTheta = -cosTheta;
	const denominator = 1 + g * g - 2 * g * incomingOutgoingCosTheta;

	return (1 - g * g) / (4 * Math.PI * denominator ** 1.5);
}

export function cornetteShanksPhase(cosTheta, gParameter, errorPrefix = 'phase') {
	const g = validateAerosolPhaseG(
		gParameter,
		CORNETTE_SHANKS_PHASE_KIND,
		errorPrefix,
	);
	const incomingOutgoingCosTheta = -cosTheta;
	const denominator = 1 + g * g - 2 * g * incomingOutgoingCosTheta;
	const normalization = 3 / (8 * Math.PI) * (1 - g * g) / (2 + g * g);

	return normalization
		* (1 + incomingOutgoingCosTheta * incomingOutgoingCosTheta)
		/ denominator ** 1.5;
}

function validateAerosolPhaseG(gParameter, phaseKind, errorPrefix) {
	if (!Number.isFinite(gParameter) || gParameter <= -1 || gParameter >= 1) {
		throw new RangeError(`${errorPrefix} ${phaseKind} g must be inside (-1, 1)`);
	}

	return gParameter;
}
