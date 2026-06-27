import {
	NUMERICAL_CONTROLS,
	SPECTRAL_CHANNELS,
	computePathRadianceSegment,
	distanceToSkyBoundary,
} from '../cpu/algorithm32-transport.js';

const DEFAULT_CACHE_KIND = 'local-z-rho-direction-wavelength-grid';
const DEFAULT_PACKING_VERSION = 'rgba-3d-texture-v1';
const SPECTRAL_GROUPS = Object.freeze([
	Object.freeze([0, 1, 2, 3]),
	Object.freeze([4, 5, 6, 7]),
	Object.freeze([8, 9, 10, 11]),
	Object.freeze([12, 13, 14, null]),
]);

export function makeLocalIncomingDirections(count = 9) {
	const directions = [];
	const goldenRatio = (1 + Math.sqrt(5)) / 2;
	for (let index = 0; index < count; index += 1) {
		const z = -0.8 + (1.6 * index) / Math.max(1, count - 1);
		const theta = (2 * Math.PI * index) / goldenRatio;
		const radius = Math.sqrt(Math.max(0, 1 - z * z));
		directions.push(normalize([radius * Math.cos(theta), radius * Math.sin(theta), z]));
	}
	return directions;
}

export function makeDefaultLocalIncidentCacheConfig({
	zMeters = [2, 1000, 5000, 15000, 45000],
	rhoMeters = [0, 500000, 1250000, 2500000, 5000000, 9000000, 13000000],
	incomingDirections = makeLocalIncomingDirections(9),
	wavelengthNanometers = SPECTRAL_CHANNELS.map((channel) => channel.wavelengthNanometers),
	kind = DEFAULT_CACHE_KIND,
} = {}) {
	return {
		kind,
		zMeters: [...zMeters],
		rhoMeters: [...rhoMeters],
		incomingDirectionCount: incomingDirections.length,
		wavelengthNanometers: [...wavelengthNanometers],
		lookupPolicy: 'nearest-neighbor-poc-grid',
		invalidPolicy: 'throw-on-invalid-or-source-key-mismatch',
		incomingDirectionFrame: 'sun-subpoint-local-radial-tangential-up',
		packingVersion: DEFAULT_PACKING_VERSION,
	};
}

export function createLocalDirectIncidentField(model, {
	controls = NUMERICAL_CONTROLS,
} = {}) {
	return {
		kind: 'local-direct-first-order-incident-field',
		sourceKey: model.source.id,
		sample({ position, incomingDirection }) {
			validateIncomingDirection(incomingDirection);
			if (
				position[2] < -1e-6 ||
				position[2] > model.geometry.topAltitudeMeters + 1e-6
			) {
				throw new Error(`Local incident sample z ${position[2]} is outside the flat atmosphere.`);
			}
			const samplePosition = [
				position[0],
				position[1],
				clamp(position[2], 0, model.geometry.topAltitudeMeters),
			];
			if (hitsFlatGround(position, incomingDirection)) {
				return zeroSpectrum();
			}
			const distance = distanceToSkyBoundary(samplePosition, incomingDirection, model.geometry);
			const transfer = computePathRadianceSegment({
				origin: samplePosition,
				direction: incomingDirection,
				distance,
				sunCase: { id: model.source.id },
				algorithm32Model: model,
				controls,
				includeSecondOrder: false,
			});
			return transfer.pathRadianceByWavelength;
		},
	};
}

export function buildLocalIncidentGridCache({
	model,
	sourceKey = model.source.id,
	cacheConfig = makeDefaultLocalIncidentCacheConfig(),
	incomingDirections = makeLocalIncomingDirections(cacheConfig.incomingDirectionCount || 9),
	controls = NUMERICAL_CONTROLS,
}) {
	const direct = createLocalDirectIncidentField(model, { controls });
	const normalizedConfig = {
		...cacheConfig,
		incomingDirectionCount: incomingDirections.length,
		wavelengthNanometers:
			cacheConfig.wavelengthNanometers ||
			SPECTRAL_CHANNELS.map((channel) => channel.wavelengthNanometers),
	};
	const values = new Map();
	const trace = [];
	for (const z of normalizedConfig.zMeters) {
		for (const rho of normalizedConfig.rhoMeters) {
			for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
				const incomingDirection = incomingDirections[directionIndex];
				const position = [
					model.source.positionMeters[0] + rho,
					model.source.positionMeters[1],
					z,
				];
				let value;
				try {
					value = direct.sample({ position, incomingDirection, directionIndex });
				} catch (error) {
					value = { invalid: true, message: error.message };
				}
				const key = localCacheKey({ z, rho, directionIndex });
				values.set(key, value);
				trace.push({ key, z, rho, directionIndex, valid: Array.isArray(value) });
			}
		}
	}
	const cacheKey = makeLocalIncidentCacheKey({
		sourceKey,
		cacheConfig: normalizedConfig,
		incomingDirections,
	});
	return {
		kind: 'local-grid-first-order-incident-field',
		cacheKey,
		sourceKey,
		cacheConfig: normalizedConfig,
		incomingDirections,
		values,
		trace,
		sample({ position, incomingDirection, sourceKey: requestedSourceKey = sourceKey }) {
			validateIncomingDirection(incomingDirection);
			if (requestedSourceKey !== sourceKey) {
				throw new Error(`Local incident cache source mismatch: ${requestedSourceKey} !== ${sourceKey}`);
			}
			if (
				position[2] < -1e-6 ||
				position[2] > model.geometry.topAltitudeMeters + 1e-6
			) {
				throw new Error(`Local incident cache z ${position[2]} is outside the flat atmosphere.`);
			}
			const samplePosition = [
				position[0],
				position[1],
				clamp(position[2], 0, model.geometry.topAltitudeMeters),
			];
			const z = nearest(normalizedConfig.zMeters, samplePosition[2]);
			const rhoValue = horizontalDistanceFromSourceSubpoint(model, samplePosition);
			const rho = nearest(normalizedConfig.rhoMeters, rhoValue);
			if (rhoValue > Math.max(...normalizedConfig.rhoMeters)) {
				throw new Error(`Local incident cache rho ${rhoValue} is outside the configured range.`);
			}
			const directionIndex = nearestDirectionIndex(
				incomingDirections,
				worldToLocalSourceFrame(model, samplePosition, incomingDirection)
			);
			const key = localCacheKey({
				z: z.value,
				rho: rho.value,
				directionIndex,
			});
			const value = values.get(key);
			if (!Array.isArray(value)) {
				throw new Error(`Local incident cache has no valid sample for ${key}.`);
			}
			return value;
		},
	};
}

export function packLocalIncidentCacheToRgba3D(cache) {
	const rhoBins = cache.cacheConfig.rhoMeters;
	const zBins = cache.cacheConfig.zMeters;
	const directionCount = cache.incomingDirections.length;
	const spectralGroupCount = SPECTRAL_GROUPS.length;
	const width = rhoBins.length;
	const height = zBins.length;
	const depth = directionCount * spectralGroupCount;
	const data = new Float32Array(width * height * depth * 4);

	for (let directionIndex = 0; directionIndex < directionCount; directionIndex += 1) {
		for (let zIndex = 0; zIndex < zBins.length; zIndex += 1) {
			for (let rhoIndex = 0; rhoIndex < rhoBins.length; rhoIndex += 1) {
				const key = localCacheKey({
					z: zBins[zIndex],
					rho: rhoBins[rhoIndex],
					directionIndex,
				});
				const spectrum = cache.values.get(key);
				if (!Array.isArray(spectrum)) {
					continue;
				}
				for (let groupIndex = 0; groupIndex < spectralGroupCount; groupIndex += 1) {
					const layerIndex = directionIndex * spectralGroupCount + groupIndex;
					const offset = ((layerIndex * height + zIndex) * width + rhoIndex) * 4;
					const group = SPECTRAL_GROUPS[groupIndex];
					for (let component = 0; component < 4; component += 1) {
						const channelIndex = group[component];
						data[offset + component] =
							channelIndex === null ? 0 : spectrum[channelIndex] || 0;
					}
				}
			}
		}
	}

	return {
		kind: 'local-incident-cache-rgba-3d-pack',
		packingVersion: DEFAULT_PACKING_VERSION,
		cacheKey: cache.cacheKey,
		sourceKey: cache.sourceKey,
		width,
		height,
		depth,
		data,
		layout: {
			x: 'rhoMeters',
			y: 'zMeters',
			z: 'incomingDirectionIndex * spectralGroupCount + spectralGroupIndex',
			texelPolicy: 'nearest-neighbor-texel-centers',
		},
		spectralGroups: SPECTRAL_GROUPS.map((group) => [...group]),
		zMeters: [...zBins],
		rhoMeters: [...rhoBins],
		incomingDirections: cache.incomingDirections.map((direction) => [...direction]),
		directionCount,
		spectralGroupCount,
		wavelengthNanometers: [...cache.cacheConfig.wavelengthNanometers],
	};
}

export function makeLocalIncidentCacheKey({
	sourceKey,
	cacheConfig,
	incomingDirections,
}) {
	const directionSignature = incomingDirections
		.map((direction) => direction.map((value) => value.toPrecision(15)).join(','))
		.join('|');
	return [
		cacheConfig.kind,
		sourceKey,
		`z=${cacheConfig.zMeters.join('|')}`,
		`rho=${cacheConfig.rhoMeters.join('|')}`,
		`dirs=${incomingDirections.length}:${directionSignature}`,
		`w=${cacheConfig.wavelengthNanometers.join('|')}`,
		`packing=${cacheConfig.packingVersion || DEFAULT_PACKING_VERSION}`,
	].join(';');
}

export function localToWorldSourceFrame(model, position, localDirection) {
	const { radial, tangential } = sourceFrameAxes(model, position);
	return normalize([
		radial[0] * localDirection[0] +
			tangential[0] * localDirection[1],
		radial[1] * localDirection[0] +
			tangential[1] * localDirection[1],
		localDirection[2],
	]);
}

export function worldToLocalSourceFrame(model, position, worldDirection) {
	const { radial, tangential } = sourceFrameAxes(model, position);
	return normalize([
		dot(worldDirection, radial),
		dot(worldDirection, tangential),
		worldDirection[2],
	]);
}

export function sourceFrameAxes(model, position) {
	const dx = position[0] - model.source.positionMeters[0];
	const dy = position[1] - model.source.positionMeters[1];
	const rho = Math.hypot(dx, dy);
	const radial = rho === 0 ? [1, 0, 0] : [dx / rho, dy / rho, 0];
	const tangential = [-radial[1], radial[0], 0];
	return { radial, tangential };
}

export function nearestDirectionIndex(directions, target) {
	let bestIndex = 0;
	let bestDot = -Infinity;
	for (let index = 0; index < directions.length; index += 1) {
		const score = dot(directions[index], target);
		if (score > bestDot) {
			bestDot = score;
			bestIndex = index;
		}
	}
	return bestIndex;
}

function localCacheKey({ z, rho, directionIndex }) {
	return `z=${z};rho=${rho};dir=${directionIndex}`;
}

function horizontalDistanceFromSourceSubpoint(model, position) {
	const dx = position[0] - model.source.positionMeters[0];
	const dy = position[1] - model.source.positionMeters[1];
	return Math.hypot(dx, dy);
}

function hitsFlatGround(position, direction) {
	return direction[2] < 0 && position[2] > 0;
}

function nearest(values, target) {
	let bestValue = values[0];
	let bestIndex = 0;
	let bestDelta = Math.abs(target - bestValue);
	for (let index = 1; index < values.length; index += 1) {
		const delta = Math.abs(target - values[index]);
		if (delta < bestDelta) {
			bestValue = values[index];
			bestIndex = index;
			bestDelta = delta;
		}
	}
	return { value: bestValue, index: bestIndex, delta: bestDelta };
}

function validateIncomingDirection(direction) {
	if (!Array.isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite)) {
		throw new Error('Local incident cache incomingDirection must be a finite 3-vector.');
	}
	const magnitude = length(direction);
	if (Math.abs(magnitude - 1) > 1e-6) {
		throw new Error(`Local incident cache incomingDirection must be normalized, got ${magnitude}.`);
	}
}

function zeroSpectrum() {
	return SPECTRAL_CHANNELS.map(() => 0);
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function normalize(vector) {
	const magnitude = length(vector);
	if (magnitude === 0) {
		return [0, 0, 0];
	}
	return vector.map((value) => value / magnitude);
}

function length(vector) {
	return Math.sqrt(dot(vector, vector));
}

function dot(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
