import {
	createAlgorithm32Model,
	createDistantDirectionalSunSource as createContractDistantDirectionalSunSource,
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
	createSphericalAtmosphereGeometry,
	SOURCE_KINDS,
} from '../source-contract/algorithm32-source-contract.js';
import {
	ATMOSPHERE,
	computePathRadianceSegment,
	createSpectralProfile,
	distanceToSkyBoundary,
	NUMERICAL_CONTROLS,
	SPECTRAL_CHANNELS,
} from '../cpu/algorithm32-transport.js';

const METERS_PER_KILOMETER = 1000;

export function createDistantDirectionalSunSource({
	sceneKey,
	direction,
	spectralIrradianceByWavelength = SPECTRAL_CHANNELS,
}) {
	const sunCase = {
		id: sceneKey,
	};
	const source = createContractDistantDirectionalSunSource({
		sunCase,
		direction,
		spectralChannels: spectralIrradianceByWavelength.map((channel, index) => ({
			wavelengthNanometers:
				channel.wavelengthNanometers ??
				SPECTRAL_CHANNELS[index]?.wavelengthNanometers,
			solarIrradiance:
				channel.solarIrradiance ?? SPECTRAL_CHANNELS[index]?.solarIrradiance,
		})),
	});

	return withSourceSamplesAt(source, {
		sceneKey,
		cacheKey: `distant-directional-sun:${sceneKey}:${source.direction.join(',')}`,
	});
}

export function createAlgorithm32FlatLocalPointSunSource({
	sceneKey,
	observerPositionMeters,
	observerDirection,
	observerDistanceKm,
	radiusKm,
	color = { r: 1, g: 1, b: 1 },
	intensity = 1,
	solarIrradianceScale = 1,
	radianceConfig = {},
	anchor = null,
	flatSourceConfig = null,
	brightnessCalibration = null,
}) {
	const normalizedDirection = normalize(observerDirection);
	const configuredObserverDistanceKm = Math.max(
		0,
		Number(observerDistanceKm) || 0
	);
	const sourcePositionMeters = addScaled(
		observerPositionMeters,
		normalizedDirection,
		configuredObserverDistanceKm * METERS_PER_KILOMETER
	);
	const normalizedRadianceConfig =
		normalizeFlatLocalPointSunRadianceConfig(radianceConfig);
	const referenceSpectralIncidentScale =
		Math.max(0, Number(intensity) || 0) *
		Math.max(0, Number(solarIrradianceScale) || 0);
	const source = createFlatLocalPointSunSource({
		id: sceneKey,
		positionMeters: sourcePositionMeters,
		radiusKm: Math.max(0, Number(radiusKm) || 0),
		referenceDistanceKm: normalizedRadianceConfig.referenceDistanceKm,
		referenceSpectralIncidentScale,
		distanceFalloff: normalizedRadianceConfig.distanceFalloff,
		spectralChannels: SPECTRAL_CHANNELS,
		color,
		provenance: {
			anchor,
			flatSourceConfig,
			brightnessCalibration,
			observerPositionMeters: [...observerPositionMeters],
			observerDistanceKm: configuredObserverDistanceKm,
			intensity,
			solarIrradianceScale,
			radianceConfig: normalizedRadianceConfig,
		},
	});

	return withSourceSamplesAt(source, {
		sceneKey,
		observerPositionMeters: [...observerPositionMeters],
		observerDistanceKm: configuredObserverDistanceKm,
		intensity,
		solarIrradianceScale,
		radianceConfig: normalizedRadianceConfig,
		anchor,
		flatSourceConfig,
		brightnessCalibration,
		cacheKey: `flat-local-point-sun:${sceneKey}:${sourcePositionMeters.join(',')}`,
	});
}

export function computeSingleScatteringRadiance(
	origin,
	viewRay,
	sourceConfiguration,
	options = {}
) {
	const source = normalizeSourceForAlgorithm32(sourceConfiguration);
	const geometry =
		options.geometry ||
		(source.kind === SOURCE_KINDS.flatLocalPointSun
			? createFlatZUpAtmosphereGeometry({
					topAltitudeMeters: options.topAltitudeMeters ?? 60000,
					observerPositionMeters: options.observerPositionMeters || origin,
					sceneSkyRayLimitMeters: options.sceneSkyRayLimitMeters ?? null,
					sceneSkyRayLimitPolicy: options.sceneSkyRayLimitPolicy || null,
				})
			: createSphericalAtmosphereGeometry({ atmosphere: ATMOSPHERE }));
	const model = createAlgorithm32Model({
		geometry,
		source,
		spectralProfile: createSpectralProfile(),
		numericalConfig: {
			...NUMERICAL_CONTROLS,
			...(options.numericalConfig || {}),
		},
	});
	const direction = normalize(viewRay);
	const distance =
		options.viewDistanceMeters ??
		distanceToSkyBoundary(origin, direction, geometry);
	const transfer = computePathRadianceSegment({
		origin,
		direction,
		distance,
		sunCase: { id: source.id },
		sunRay: source.direction,
		algorithm32Model: model,
		controls: model.numericalConfig,
		includeSecondOrder: options.includeSecondOrder === true,
		incidentField: options.incidentField || null,
	});
	const observerSample = model.sampleSource(origin);

	return {
		radiance: transfer.pathRadianceByWavelength,
		skyRadiance: transfer.pathRadianceByWavelength,
		firstOrderRadiance: transfer.firstOrderPathRadianceByWavelength,
		secondOrderRadiance: transfer.secondOrderPathRadianceByWavelength,
		distanceToTop: distance,
		transfer,
		sourceDiagnostics: {
			sourceKind: source.kind,
			sourceSceneKey: source.id,
			sourceDistanceKind: observerSample.distanceKind,
			sourceDistanceMeters: observerSample.distanceMeters,
			sourceConfiguredDistanceKm: observerSample.distanceKm,
			sourceVisibilityPath: observerSample.sourcePathPolicy,
			firstOrderSourceIncidentScale:
				observerSample.spectralIncidentScaleByWavelength,
			secondOrderEnabled: options.includeSecondOrder === true,
		},
	};
}

function withSourceSamplesAt(source, extra) {
	return Object.freeze({
		...source,
		...extra,
		sourceSamplesAt(positionMeters, geometry = {}) {
			const sample = source.sample(positionMeters);

			return [
				{
					...sample,
					distance: sample.distanceMeters,
					distanceUnits:
						sample.distanceKind === 'finite' ? 'm' : null,
					configuredDistanceKm: sample.distanceKm,
					visibilityPath: sample.sourcePathPolicy,
					diagnostics: {
						sceneKey: extra.sceneKey,
						samplePositionMeters: [...positionMeters],
						geometryKind: geometry.kind || null,
						sampleLabel: geometry.label || null,
						configuredDistanceKm: sample.distanceKm,
						distanceMeters: sample.distanceMeters,
						referenceDistanceKm: sample.referenceDistanceKm,
						distanceFalloffScale: sample.distanceFalloffScale,
						spectralIncidentScale: sample.incidentScale,
					},
				},
			];
		},
		toJSON() {
			return {
				kind: this.kind,
				sceneKey: extra.sceneKey,
				positionMeters: this.positionMeters || null,
				direction: this.direction || null,
				distanceKind: this.distanceKind,
				radiusKm: this.radiusKm || null,
				referenceDistanceKm: this.referenceDistanceKm || null,
				referenceSpectralIncidentScale:
					this.referenceSpectralIncidentScale || null,
				distanceFalloff: this.distanceFalloff ?? null,
				color: this.color || null,
				provenance: this.provenance || null,
			};
		},
	});
}

function normalizeSourceForAlgorithm32(sourceConfiguration) {
	if (sourceConfiguration?.sample) {
		return sourceConfiguration;
	}

	if (sourceConfiguration?.sourceSamplesAt) {
		return {
			...sourceConfiguration,
			sample(positionMeters) {
				const sample = sourceConfiguration.sourceSamplesAt(positionMeters)[0];

				return {
					...sample,
					sourceId: sourceConfiguration.id || sourceConfiguration.sceneKey,
					sourcePathPolicy:
						sample.sourcePathPolicy || sample.visibilityPath,
				};
			},
		};
	}

	throw new Error('Source configuration must expose sample() or sourceSamplesAt().');
}

function normalizeFlatLocalPointSunRadianceConfig(radianceConfig = {}) {
	const model = radianceConfig.model || 'point-inverse-square-reference';
	if (model !== 'point-inverse-square-reference') {
		throw new Error(`Unsupported flat local Sun radiance model "${model}".`);
	}

	const distanceFalloff = radianceConfig.distanceFalloff !== false;
	const referenceDistanceKm = Number(radianceConfig.referenceDistanceKm);
	if (
		distanceFalloff &&
		(!Number.isFinite(referenceDistanceKm) || referenceDistanceKm <= 0)
	) {
		throw new Error(
			'Flat local Sun inverse-square radiance requires a positive referenceDistanceKm.'
		);
	}

	return {
		model,
		distanceFalloff,
		referenceDistanceKm: distanceFalloff ? referenceDistanceKm : 1,
	};
}

function addScaled(origin, direction, distance) {
	return [
		origin[0] + direction[0] * distance,
		origin[1] + direction[1] * distance,
		origin[2] + direction[2] * distance,
	];
}

function normalize(vector) {
	const magnitude = Math.hypot(...vector);

	return magnitude === 0 ? [0, 0, 0] : vector.map((value) => value / magnitude);
}
