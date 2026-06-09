const DEG_TO_RAD = Math.PI / 180;

function finiteNumber(value, fallback = 0) {
	const number = Number(value);

	return Number.isFinite(number) ? number : fallback;
}

function normalizeAngle(angle) {
	let normalized = angle % (Math.PI * 2);

	if (normalized <= -Math.PI) {
		normalized += Math.PI * 2;
	}

	if (normalized > Math.PI) {
		normalized -= Math.PI * 2;
	}

	return normalized;
}

export default class NorthCelestialPoleAzimuthalEquidistantProjection {
	constructor() {
		this.id = 'north-celestial-pole-azimuthal-equidistant';
		this.role = 'celestial';
	}

	projectCelestial(point, context = {}) {
		const raRad = finiteNumber(point.raDeg) * DEG_TO_RAD;
		const decRad = finiteNumber(point.decDeg) * DEG_TO_RAD;
		const referenceRightAscension = finiteNumber(context.options?.referenceRightAscensionDeg) * DEG_TO_RAD;
		const maxAngularDistance = finiteNumber(context.options?.maxCelestialAngularDistanceRad, Math.PI);
		const skyProjectionRadius = finiteNumber(context.options?.skyProjectionRadiusKm, context.options?.domeRadiusKm || 1);
		const theta = normalizeAngle(raRad - referenceRightAscension);
		const angularDistance = Math.PI / 2 - decRad;
		const radius = skyProjectionRadius * angularDistance / maxAngularDistance;
		const x = radius * Math.sin(theta);
		const y = radius * Math.cos(theta);

		return {
			projected: {
				x,
				y,
				radius,
				theta,
				angularDistanceRad: angularDistance,
				maxAngularDistanceRad: maxAngularDistance,
			},
			horizontal: null,
			visible: angularDistance >= 0 && angularDistance <= maxAngularDistance,
			metadata: {
				projectionCenter: 'north-celestial-pole',
			},
		};
	}

	describe() {
		return {
			id: this.id,
			role: this.role,
		};
	}
}
