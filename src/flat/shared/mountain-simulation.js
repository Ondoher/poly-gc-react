const KM_PER_FOOT = 0.0003048;
const KM_PER_MILE = 1.609344;
const MOUNTAIN_SIMULATION_COLOR = '#ff0000';
const DEFAULT_MIN_DISTANCE_MILES = 1;
const DEFAULT_MAX_DISTANCE_MILES = 101;
const DEFAULT_DISTANCE_STEP_MILES = 5;
const DEFAULT_BEARING_COUNT = 8;
const DEFAULT_RING_OFFSET_DEG = 10;
const DEFAULT_HEIGHT_FEET = 2000;
const DEFAULT_STRAY_DISTANCE_MILES = 0.5;
const DEFAULT_STRAY_BEARING_DEG = 22.5;

/**
 * Create deterministic observer-relative mountain rectangle source objects.
 *
 * The source is intentionally fake local terrain for atmosphere calibration.
 * It does not claim real DEM data; it creates colorful, testable red
 * rectangular prisms around the observer while the terrain data contract is
 * still open.
 *
 * @param {object} [options] - Configure the generated rectangle set.
 * @param {number} [options.minDistanceMiles] - Store first ring distance from observer.
 * @param {number} [options.maxDistanceMiles] - Store final ring distance from observer.
 * @param {number} [options.distanceStepMiles] - Store distance between rings.
 * @param {number} [options.bearingCount] - Store how many bearings complete one spiral turn.
 * @param {number} [options.ringOffsetDeg] - Rotate each successive spiral turn by this many degrees.
 * @param {number} [options.heightFeet] - Store the fixed rectangle height.
 * @param {boolean} [options.includeStrayMountain] - Indicate whether to add the near-field stray marker.
 * @param {number} [options.strayDistanceMiles] - Store the near-field stray marker distance.
 * @param {number} [options.strayBearingDeg] - Store the near-field stray marker bearing.
 * @returns {FlatMountainSimulationRectangleSource[]}
 */
export function createMountainSimulationRectangles(options = {}) {
	const minDistanceMiles = options.minDistanceMiles || DEFAULT_MIN_DISTANCE_MILES;
	const maxDistanceMiles = options.maxDistanceMiles || DEFAULT_MAX_DISTANCE_MILES;
	const distanceStepMiles = options.distanceStepMiles || DEFAULT_DISTANCE_STEP_MILES;
	const bearingCount = options.bearingCount || DEFAULT_BEARING_COUNT;
	const ringOffsetDeg = options.ringOffsetDeg || DEFAULT_RING_OFFSET_DEG;
	const heightFeet = options.heightFeet || DEFAULT_HEIGHT_FEET;
	const mountainRectangles = [];
	let index = 0;
	let strayCount = 0;

	if (options.includeStrayMountain !== false) {
		const distanceMiles = options.strayDistanceMiles || DEFAULT_STRAY_DISTANCE_MILES;
		const bearingDeg = options.strayBearingDeg || DEFAULT_STRAY_BEARING_DEG;
		const bearingRad = (bearingDeg * Math.PI) / 180;
		const distanceKm = distanceMiles * KM_PER_MILE;
		const heightKm = heightFeet * KM_PER_FOOT;

		index += 1;
		strayCount += 1;
		mountainRectangles.push(Object.freeze({
			kind: 'mountain-simulation-rectangle',
			id: `mountain-rectangle-${index}`,
			name: `Mountain rectangle ${index}`,
			bearingRad,
			distanceKm,
			widthKm: heightKm * 5,
			depthKm: heightKm * 10,
			heightKm,
			rotationYRad: bearingRad,
			style: Object.freeze({
				color: MOUNTAIN_SIMULATION_COLOR,
			}),
			source: Object.freeze({
				heightFeet,
				distanceMiles,
				bearingDeg,
				role: 'stray-near-field-calibration',
			}),
		}));
	}

	for (
		let distanceMiles = minDistanceMiles;
		distanceMiles <= maxDistanceMiles + 0.000001;
		distanceMiles += distanceStepMiles
	) {
		const spiralIndex = index - strayCount;
		const bearingIndex = spiralIndex % bearingCount;
		const ringIndex = Math.floor(spiralIndex / bearingCount);
		const rawBearingDeg = (bearingIndex * (360 / bearingCount)) + (ringIndex * ringOffsetDeg);
		const bearingDeg = ((rawBearingDeg % 360) + 360) % 360;
		const bearingRad = (bearingDeg * Math.PI) / 180;
		const distanceKm = distanceMiles * KM_PER_MILE;
		const heightKm = heightFeet * KM_PER_FOOT;
		const widthKm = heightKm * 5;
		const depthKm = heightKm * 10;
		index += 1;
		mountainRectangles.push(Object.freeze({
			kind: 'mountain-simulation-rectangle',
			id: `mountain-rectangle-${index}`,
			name: `Mountain rectangle ${index}`,
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
				distanceMiles,
				bearingDeg,
			}),
		}));
	}

	return Object.freeze(mountainRectangles);
}
