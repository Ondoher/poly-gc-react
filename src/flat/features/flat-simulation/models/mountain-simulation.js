import { createMountainSimulationRectangles } from '../../../shared/mountain-simulation.js';
import { placeObjectForGeometry } from '../../../shared/object-placement.js';
import { createBearingDirection } from '../../../shared/observer-relative-placement.js';

export { createMountainSimulationRectangles };

/**
 * Project an observer-relative mountain rectangle into scene-space box data.
 *
 * @param {FlatSimulationMountainRectangleSource} rectangle - Provide the source rectangle.
 * @param {FlatVector3} observerPosition - Provide the projected observer position.
 * @returns {FlatSimulationRenderableBox}
 */
export function projectMountainSimulationRectangle(rectangle, observerPosition) {
	const surfaceOrigin = { x: observerPosition.x, y: 0, z: observerPosition.z };
	const bearingDirection = createBearingDirection({
		kind: 'flat-plane',
		origin: surfaceOrigin,
		east: { x: 1, y: 0, z: 0 },
		north: { x: 0, y: 0, z: 1 },
		up: { x: 0, y: 1, z: 0 },
	}, rectangle.bearingRad);
	const surfacePoint = {
		x: surfaceOrigin.x + bearingDirection.x * rectangle.distanceKm,
		y: surfaceOrigin.y + bearingDirection.y * rectangle.distanceKm,
		z: surfaceOrigin.z + bearingDirection.z * rectangle.distanceKm,
	};
	const placement = placeObjectForGeometry({
		geometry: {
			kind: 'flat-plane',
			origin: surfaceOrigin,
			up: { x: 0, y: 1, z: 0 },
		},
		position: surfacePoint,
		referenceDirection: bearingDirection,
		bearingRad: 0,
		bounds: {
			min: {
				x: -rectangle.widthKm / 2,
				y: -rectangle.heightKm / 2,
				z: -rectangle.depthKm / 2,
			},
			max: {
				x: rectangle.widthKm / 2,
				y: rectangle.heightKm / 2,
				z: rectangle.depthKm / 2,
			},
		},
	});

	return {
		kind: 'box',
		role: 'mountain-simulation',
		id: rectangle.id,
		name: rectangle.name,
		position: placement.position,
		size: {
			x: rectangle.widthKm,
			y: rectangle.heightKm,
			z: rectangle.depthKm,
		},
		rotationYRad: rectangle.rotationYRad,
		visible: true,
		style: rectangle.style,
		source: rectangle.source,
	};
}
