import {
	composeObjectRadiance,
	createDistantSunAlgorithm32Model,
	createFlatLocalPointSunSource,
	createFlatLocalSunAlgorithm32Model,
	createFlatZUpAtmosphereGeometry,
	NUMERICAL_CONTROLS,
	objectRadianceSpectrum,
	SPECTRA,
	SPECTRAL_CHANNELS,
	spectralToDisplayPreview,
	summarizeTransfer,
	SUN_CASES,
	sunDirection,
	traceSegmentForThreeHit,
	traceSkyForThreeRay,
} from './algorithm32-transport.js';
import { SOURCE_KINDS } from '../source-contract/algorithm32-source-contract.js';

export function postprocessSceneInput(
	sceneInput,
	{
		surfacePolicy = 'captured-rgba8-display-domain',
		includeSecondOrder = true,
		incidentField = null,
	} = {}
) {
	assertSceneInputPacket(sceneInput);

	const width = sceneInput.width;
	const height = sceneInput.height;
	const pixels = Buffer.alloc(width * height * 4);
	const selectedPixelIds = new Map(
		(sceneInput.selectedPixels || []).map((sample) => [
			`${sample.x},${sample.y}`,
			sample.id,
		])
	);
	const selectedPixels = [];
	const { algorithm32Model, sunCase, sunRay, sourceResolution } =
		resolveSceneInputAlgorithm32Model(sceneInput);
	const camera = {
		position: sceneInput.camera.positionMeters,
	};
	const incidentSkyCache = new Map();
	const finiteChecks = {
		pixels: 0,
		nonfinitePixels: 0,
		minByte: 255,
		maxByte: 0,
	};

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelIndex = y * width + x;
			const outputOffset = pixelIndex * 4;
			const directionOffset = pixelIndex * 3;
			const ray = {
				direction: [
					sceneInput.rayDirections[directionOffset],
					sceneInput.rayDirections[directionOffset + 1],
					sceneInput.rayDirections[directionOffset + 2],
				],
			};
			const hit = sceneInput.hitMask[pixelIndex] === 1;
			const transfer = hit
				? traceSegmentForThreeHit({
						camera,
						ray,
						distance: sceneInput.hitDistanceMeters[pixelIndex],
						sunCase,
						sunRay,
						algorithm32Model,
						incidentField,
						incidentSkyCache,
						includeSecondOrder,
					})
				: traceSkyForThreeRay({
						camera,
						ray,
						sunCase,
						sunRay,
						algorithm32Model,
						incidentField,
						incidentSkyCache,
						includeSecondOrder,
					});
			const encodedRgb = hit
				? composeHitPixel({
						sceneInput,
						pixelIndex,
						transfer,
						surfacePolicy,
					})
				: spectralToDisplayPreview(transfer.pathRadianceByWavelength).encodedRgb;

			pixels[outputOffset] = encodedRgb[0];
			pixels[outputOffset + 1] = encodedRgb[1];
			pixels[outputOffset + 2] = encodedRgb[2];
			pixels[outputOffset + 3] = 255;
			updateFiniteChecks(finiteChecks, encodedRgb);

			const selectedId = selectedPixelIds.get(`${x},${y}`);
			if (selectedId) {
				selectedPixels.push({
					id: selectedId,
					x,
					y,
					hit,
					hitDistanceMeters: hit
						? sceneInput.hitDistanceMeters[pixelIndex]
						: null,
					spectrumId: hit
						? spectrumIdForNumeric(
								sceneInput,
								sceneInput.spectrumNumericIds?.[pixelIndex]
							)
						: null,
					sceneColorRgba8: Array.from(
						sceneInput.sceneColorRgba8.slice(outputOffset, outputOffset + 4)
					),
					postprocessRgba8: [
						pixels[outputOffset],
						pixels[outputOffset + 1],
						pixels[outputOffset + 2],
						pixels[outputOffset + 3],
					],
					meanTransmittance: average(transfer.transmittanceByWavelength),
					transfer: summarizeTransfer(transfer),
				});
			}
		}
	}

	return {
		width,
		height,
		pixels,
		selectedPixels,
		finiteChecks,
		sunCase: {
			...sunCase,
			sunDirection: sunRay,
		},
		sourceContract: {
			kind: algorithm32Model.kind,
			geometry: algorithm32Model.geometry,
			sourceResolution,
			source: {
				kind: algorithm32Model.source.kind,
				id: algorithm32Model.source.id,
				direction: algorithm32Model.source.direction,
				distanceKind: algorithm32Model.source.distanceKind,
				positionMeters: algorithm32Model.source.positionMeters || null,
			},
		},
		cacheDiagnostics: {
			incidentSkyCacheEntries: incidentSkyCache.size,
			incidentFieldKind: incidentField?.kind || null,
			incidentFieldSourceKey: incidentField?.sourceKey || null,
			incidentFieldCacheKey: incidentField?.cacheKey || null,
		},
		surfacePolicy,
		includeSecondOrder,
	};
}

export function resolveSceneInputAlgorithm32Model(sceneInput) {
	if (sceneInput.source?.kind === SOURCE_KINDS.flatLocalPointSun) {
		return resolveSceneInputFlatLocalModel(sceneInput);
	}

	const { sunCase, sourceResolution } = resolveSceneInputSunCase(sceneInput);
	const algorithm32Model = createDistantSunAlgorithm32Model(sunCase);

	return {
		algorithm32Model,
		sunCase,
		sunRay: sunDirection(sunCase),
		sourceResolution,
	};
}

function resolveSceneInputFlatLocalModel(sceneInput) {
	const sourcePacket = sceneInput.source || {};
	const geometryPacket = sceneInput.geometry || {};
	const observerPositionMeters =
		geometryPacket.observerPositionMeters ||
		sourcePacket.observerPositionMeters ||
		[0, 0, 2];
	const geometry = createFlatZUpAtmosphereGeometry({
		topAltitudeMeters: finiteOrDefault(
			geometryPacket.topAltitudeMeters,
			geometryPacket.atmosphereTopAltitudeMeters,
			60000
		),
		observerPositionMeters,
		sceneSkyRayLimitMeters: finiteOrNull(geometryPacket.sceneSkyRayLimitMeters),
		sceneSkyRayLimitPolicy: geometryPacket.sceneSkyRayLimitPolicy || null,
	});
	const localSource = createFlatLocalPointSunSource({
		id: sourcePacket.id || sourcePacket.sunCase || 'packet-flat-local-point-sun',
		positionMeters: finiteVectorOrThrow(
			sourcePacket.positionMeters,
			'flat local source positionMeters'
		),
		radiusKm: finiteOrDefault(sourcePacket.radiusKm, 25),
		referenceDistanceKm: finiteOrDefault(sourcePacket.referenceDistanceKm, 1),
		referenceSpectralIncidentScale: finiteOrDefault(
			sourcePacket.referenceSpectralIncidentScale,
			sourcePacket.incidentScale,
			1
		),
		distanceFalloff: sourcePacket.distanceFalloff !== false,
		spectralChannels: SPECTRAL_CHANNELS,
		color: sourcePacket.color || { r: 1, g: 0.98, b: 0.95 },
		provenance: sourcePacket.provenance || null,
	});
	const algorithm32Model = createFlatLocalSunAlgorithm32Model({
		geometry,
		source: localSource,
		numericalConfig: {
			localSourceMode: 'soft-shader-postprocessor',
			localSecondOrder: 'external-incident-field-required',
		},
	});
	const observerSample = algorithm32Model.sampleSource(observerPositionMeters);
	const direction = observerSample.direction;
	const sunCase = {
		id: localSource.id,
		role: sourcePacket.role || 'packet flat/local point Sun source',
		sourceKind: SOURCE_KINDS.flatLocalPointSun,
		offsetDegrees: sourcePacket.offsetDegrees ?? null,
		sunAltitudeDegrees: radiansToDegrees(Math.asin(direction[2])),
		sunAzimuthDegrees: radiansToDegrees(Math.atan2(direction[1], direction[0])),
		sunDirection: direction,
		sourceDistanceMeters: observerSample.distanceMeters,
		incidentScale: observerSample.incidentScale,
	};

	return {
		algorithm32Model,
		sunCase,
		sunRay: direction,
		sourceResolution: {
			status: 'packet-supplied-flat-local-point-sun',
			requestedSource: localSource.id,
			observerSourceDistanceMeters: observerSample.distanceMeters,
			observerIncidentScale: observerSample.incidentScale,
		},
	};
}

function resolveSceneInputSunCase(sceneInput) {
	const source = sceneInput.source || {};
	const canonical = SUN_CASES.find(
		(candidate) => candidate.id === source.sunCase
	);
	if (canonical) {
		return {
			sunCase: canonical,
			sourceResolution: {
				status: 'canonical-sun-case',
				requestedSunCase: source.sunCase,
			},
		};
	}

	if (
		source.kind === SOURCE_KINDS.distantDirectionalSun &&
		Number.isFinite(source.sunAltitudeDegrees) &&
		Number.isFinite(source.sunAzimuthDegrees)
	) {
		return {
			sunCase: {
				id: source.sunCase || 'packet-distant-directional-sun',
				sourceTimeOfDay: source.sourceTimeOfDay || null,
				sourceSunZenithDegrees:
					source.sourceSunZenithDegrees ??
					90 - source.sunAltitudeDegrees,
				sunAltitudeDegrees: source.sunAltitudeDegrees,
				sunAzimuthDegrees: source.sunAzimuthDegrees,
				role: source.role || 'packet-supplied distant Sun source',
			},
			sourceResolution: {
				status: 'packet-supplied-sun-case',
				requestedSunCase: source.sunCase || null,
			},
		};
	}

	throw new Error(
		'Scene input source must be a canonical distant Sun, packet distant Sun, or flat/local point Sun.'
	);
}

function composeHitPixel({ sceneInput, pixelIndex, transfer, surfacePolicy }) {
	if (surfacePolicy === 'spectrum-id-reference-radiance') {
		const spectrumId = spectrumIdForNumeric(
			sceneInput,
			sceneInput.spectrumNumericIds?.[pixelIndex]
		);
		const spectrum = SPECTRA[spectrumId] || SPECTRA.black;
		const objectRadiance = objectRadianceSpectrum(spectrum);
		const finalRadiance = composeObjectRadiance(objectRadiance, transfer);

		return spectralToDisplayPreview(finalRadiance).encodedRgb;
	}

	const rgbaOffset = pixelIndex * 4;
	const sceneRgb = [
		sceneInput.sceneColorRgba8[rgbaOffset] / 255,
		sceneInput.sceneColorRgba8[rgbaOffset + 1] / 255,
		sceneInput.sceneColorRgba8[rgbaOffset + 2] / 255,
	];
	const transmittanceRgb = rgbTransmittanceBands(
		transfer.transmittanceByWavelength
	);
	const pathRgb = spectralToDisplayPreview(
		transfer.pathRadianceByWavelength
	).encodedRgb.map((value) => value / 255);

	return sceneRgb.map((value, index) =>
		clampByte((value * transmittanceRgb[index] + pathRgb[index]) * 255)
	);
}

function rgbTransmittanceBands(transmittanceByWavelength) {
	const blue = average(transmittanceByWavelength.slice(0, 5));
	const green = average(transmittanceByWavelength.slice(4, 9));
	const red = average(transmittanceByWavelength.slice(8));

	return [red, green, blue];
}

function spectrumIdForNumeric(sceneInput, numericId) {
	const spectrumTable = sceneInput.spectrumNumericIdTable || {};
	const key = String(numericId);

	if (spectrumTable[key]) {
		return spectrumTable[key];
	}

	if (numericId === 1) {
		return 'red';
	}
	if (numericId === 2) {
		return 'green';
	}
	if (numericId === 3) {
		return 'blue';
	}
	if (numericId === 4) {
		return 'neutral';
	}

	return 'black';
}

function assertSceneInputPacket(sceneInput) {
	for (const key of [
		'width',
		'height',
		'camera',
		'rayDirections',
		'hitMask',
		'hitDistanceMeters',
		'sceneColorRgba8',
		'source',
	]) {
		if (sceneInput[key] === undefined || sceneInput[key] === null) {
			throw new Error(`Scene input packet is missing ${key}.`);
		}
	}
	if (!Array.isArray(sceneInput.camera.positionMeters)) {
		throw new Error('Scene input camera.positionMeters must be an array.');
	}
}

function updateFiniteChecks(finiteChecks, encodedRgb) {
	finiteChecks.pixels += 1;

	for (const value of encodedRgb) {
		if (!Number.isFinite(value)) {
			finiteChecks.nonfinitePixels += 1;
			continue;
		}
		finiteChecks.minByte = Math.min(finiteChecks.minByte, value);
		finiteChecks.maxByte = Math.max(finiteChecks.maxByte, value);
	}
}

function finiteVectorOrThrow(value, label) {
	if (
		!Array.isArray(value) ||
		value.length < 3 ||
		!value.slice(0, 3).every(Number.isFinite)
	) {
		throw new Error(`Missing finite ${label}.`);
	}
	return value.slice(0, 3);
}

function finiteOrDefault(...values) {
	for (const value of values) {
		if (Number.isFinite(value)) {
			return value;
		}
	}
	return null;
}

function finiteOrNull(value) {
	return Number.isFinite(value) ? value : null;
}

function radiansToDegrees(value) {
	return (value * 180) / Math.PI;
}

function average(values) {
	return values.length === 0
		? 0
		: values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampByte(value) {
	return Math.max(0, Math.min(255, Math.round(value)));
}
