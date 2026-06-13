import Random from '../../../../gc/utils/random.js';

const KM_PER_FOOT = 0.0003048;
const KM_PER_MILE = 1.609344;
const DEFAULT_SEED = 0x4d4f554e;
const MOUNTAIN_SIMULATION_COLOR = '#ff0000';

/**
 * Interpolate between two numeric values.
 *
 * @param {number} min - Store the lower bound.
 * @param {number} max - Store the upper bound.
 * @param {number} ratio - Store the interpolation ratio.
 * @returns {number}
 */
function lerp(min, max, ratio) {
	return min + ((max - min) * ratio);
}

/**
 * Create deterministic observer-relative mountain rectangle source objects.
 *
 * The source is intentionally fake local terrain for the false-simulation
 * POC. It does not claim real DEM data; it creates colorful, testable
 * red rectangular prisms around the observer while the terrain data contract
 * is still open.
 *
 * @param {object} [options] - Configure the generated rectangle set.
 * @param {number} [options.count] - Store how many rectangles to create.
 * @param {number} [options.seed] - Seed deterministic random placement.
 * @param {number} [options.maxDistanceMiles] - Store maximum distance from observer.
 * @param {number} [options.minHeightFeet] - Store minimum rectangle height.
 * @param {number} [options.maxHeightFeet] - Store maximum rectangle height.
 * @returns {FalseSimulationMountainRectangleSource[]}
 */
export function createMountainSimulationRectangles(options = {}) {
	const count = options.count || 200;
	const previousSeed = Random.randSeed;
	const maxDistanceMiles = options.maxDistanceMiles || 100;
	const minHeightFeet = options.minHeightFeet || 500;
	const maxHeightFeet = options.maxHeightFeet || 3000;
	const minDistanceMiles = options.minDistanceMiles || 1;
	const minDistanceKm = minDistanceMiles * KM_PER_MILE;
	const maxDistanceKm = maxDistanceMiles * KM_PER_MILE;

	Random.randomize(options.seed || DEFAULT_SEED);

	try {
		return Array.from({ length: count }, (_, index) => {
			const bearingRad = Random.random() * Math.PI * 2;
			const distanceKm = lerp(minDistanceKm, maxDistanceKm, Math.sqrt(Random.random()));
			const heightFeet = lerp(minHeightFeet, maxHeightFeet, Random.random());
			const heightKm = heightFeet * KM_PER_FOOT;
			const widthKm = heightKm * 5;
			const depthKm = heightKm * 10;
			return Object.freeze({
				kind: 'mountain-simulation-rectangle',
				id: `mountain-rectangle-${index + 1}`,
				name: `Mountain rectangle ${index + 1}`,
				bearingRad,
				distanceKm,
				widthKm,
				depthKm,
				heightKm,
				rotationYRad: bearingRad,
				style: Object.freeze({
					color: MOUNTAIN_SIMULATION_COLOR,
				}),
				source: Object.freeze({
					heightFeet,
					distanceMiles: distanceKm / KM_PER_MILE,
					bearingDeg: (bearingRad * 180) / Math.PI,
				}),
			});
		});
	} finally {
		Random.randomize(previousSeed);
	}
}

/**
 * Project an observer-relative mountain rectangle into scene-space box data.
 *
 * @param {FalseSimulationMountainRectangleSource} rectangle - Provide the source rectangle.
 * @param {FlatVector3} observerPosition - Provide the projected observer position.
 * @returns {FalseSimulationRenderableBox}
 */
export function projectMountainSimulationRectangle(rectangle, observerPosition) {
	return {
		kind: 'box',
		role: 'mountain-simulation',
		id: rectangle.id,
		name: rectangle.name,
		position: {
			x: observerPosition.x + (Math.sin(rectangle.bearingRad) * rectangle.distanceKm),
			y: rectangle.heightKm / 2,
			z: observerPosition.z + (Math.cos(rectangle.bearingRad) * rectangle.distanceKm),
		},
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
