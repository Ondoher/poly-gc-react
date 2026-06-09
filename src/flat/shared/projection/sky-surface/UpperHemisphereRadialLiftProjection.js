function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback = 0) {
	const number = Number(value);

	return Number.isFinite(number) ? number : fallback;
}

export default class UpperHemisphereRadialLiftProjection {
	constructor() {
		this.id = 'upper-hemisphere-radial-lift';
		this.role = 'sky-surface';
	}

	projectSurface(projectedPoint = {}, context = {}) {
		const domeRadius = finiteNumber(context.options?.domeRadiusKm, 1);
		const theta = finiteNumber(projectedPoint.theta);
		const maxAngularDistance = finiteNumber(projectedPoint.maxAngularDistanceRad, Math.PI);
		const angularDistance = finiteNumber(projectedPoint.angularDistanceRad);
		const unclampedRatio = maxAngularDistance === 0 ? 0 : angularDistance / maxAngularDistance;
		const ratio = clamp(unclampedRatio, 0, 1);
		const domePolarAngle = ratio * Math.PI / 2;
		const surfaceRadius = domeRadius * Math.sin(domePolarAngle);
		const x = surfaceRadius * Math.sin(theta);
		const z = -surfaceRadius * Math.cos(theta);
		const y = domeRadius * Math.cos(domePolarAngle);

		return {
			position: { x, y, z },
			normal: {
				x: -x / domeRadius,
				y: -y / domeRadius,
				z: -z / domeRadius,
			},
			visible: unclampedRatio >= 0 && unclampedRatio <= 1,
			metadata: {
				ratio,
				unclampedRatio,
				domePolarAngleRad: domePolarAngle,
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
