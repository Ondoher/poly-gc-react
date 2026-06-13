const DEG_TO_RAD = Math.PI / 180;

function finiteNumber(value, fallback = 0) {
	const number = Number(value);

	return Number.isFinite(number) ? number : fallback;
}

const DEFAULT_MEAN_EARTH_RADIUS_KM = 6371.0088;

export default class NorthPoleAzimuthalEquidistantEarthProjection {
	constructor() {
		this.id = 'north-pole-azimuthal-equidistant';
		this.role = 'earth';
	}

	projectGeo(point, context = {}) {
		const latRad = finiteNumber(point.lat) * DEG_TO_RAD;
		const lonRad = finiteNumber(point.lon) * DEG_TO_RAD;
		const meanEarthRadiusKm = finiteNumber(context.options?.meanEarthRadiusKm, DEFAULT_MEAN_EARTH_RADIUS_KM);
		const maxAngularDistance = Math.PI;
		const angularDistance = Math.PI / 2 - latRad;
		const radius = meanEarthRadiusKm * angularDistance;
		const x = radius * Math.sin(lonRad);
		const y = radius * Math.cos(lonRad);

		return {
			position: {
				x,
				y: finiteNumber(point.elevationMeters) / 1000,
				z: y,
			},
			projected: {
				x,
				y,
				radius,
				theta: lonRad,
				angularDistanceRad: angularDistance,
				maxAngularDistanceRad: maxAngularDistance,
			},
			visible: angularDistance >= 0 && angularDistance <= maxAngularDistance,
			metadata: {
				projectionCenter: 'north-pole',
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
