export const SOURCE_KINDS = Object.freeze({
	distantDirectionalSun: 'distant-directional-sun',
	flatLocalPointSun: 'flat-local-point-sun',
});

export const GEOMETRY_KINDS = Object.freeze({
	sphericalAtmosphere: 'spherical-atmosphere-geometry',
	flatZUpAtmosphere: 'flat-z-up-atmosphere',
});

export function createSphericalAtmosphereGeometry({ atmosphere }) {
	return Object.freeze({
		kind: GEOMETRY_KINDS.sphericalAtmosphere,
		bottomRadiusMeters: atmosphere.bottomRadiusMeters,
		topRadiusMeters: atmosphere.topRadiusMeters,
		observerHeightMeters: atmosphere.observerHeightMeters,
		sourcePathPolicy: 'spherical-top-atmosphere-boundary',
		altitudePolicy: 'length(position) - bottomRadiusMeters',
	});
}

export function createFlatZUpAtmosphereGeometry({
	topAltitudeMeters,
	observerPositionMeters = [0, 0, 2],
	sceneSkyRayLimitMeters = null,
	sceneSkyRayLimitPolicy = null,
}) {
	return Object.freeze({
		kind: GEOMETRY_KINDS.flatZUpAtmosphere,
		observerPositionMeters: [...observerPositionMeters],
		flatGroundPlane: 'z=0',
		flatAltitudeAxis: 'z',
		atmosphereTopBoundary: 'z=topAltitudeMeters',
		topAltitudeMeters,
		sourcePathPolicy: 'finite-source-distance-through-flat-atmosphere',
		sceneSkyRayLimitMeters,
		sceneSkyRayLimitPolicy,
	});
}

export function createDistantDirectionalSunSource({
	sunCase,
	direction,
	spectralChannels,
}) {
	const sunDirection = normalize(direction);

	return Object.freeze({
		kind: SOURCE_KINDS.distantDirectionalSun,
		id: sunCase.id,
		label: sunCase.id,
		direction: sunDirection,
		distanceKind: 'infinite',
		incidentScalePolicy: 'unit-scale-per-wavelength-solar-irradiance-table',
		sourcePathPolicy: 'spherical-top-atmosphere-boundary',
		spectralIncidentScaleByWavelength: spectralChannels.map(() => 1),
		solarIrradianceByWavelength: spectralChannels.map(
			(channel) => channel.solarIrradiance
		),
		sample(position) {
			return {
				kind: SOURCE_KINDS.distantDirectionalSun,
				sourceId: sunCase.id,
				samplePositionMeters: [...position],
				direction: [...sunDirection],
				distanceKind: 'infinite',
				distanceMeters: null,
				incidentScale: 1,
				spectralIncidentScaleByWavelength: spectralChannels.map(() => 1),
				sourcePathPolicy: 'spherical-top-atmosphere-boundary',
				transmittancePath: {
					kind: 'sample-to-spherical-top-atmosphere',
					direction: [...sunDirection],
					distanceKind: 'to-top-atmosphere',
				},
			};
		},
	});
}

export function createFlatLocalPointSunSource({
	id,
	positionMeters,
	radiusKm,
	referenceDistanceKm,
	referenceSpectralIncidentScale,
	distanceFalloff = true,
	spectralChannels,
	color = { r: 1, g: 0.98, b: 0.95 },
	provenance = null,
}) {
	const sourcePosition = [...positionMeters];

	return Object.freeze({
		kind: SOURCE_KINDS.flatLocalPointSun,
		id,
		label: id,
		positionMeters: sourcePosition,
		radiusKm,
		referenceDistanceKm,
		referenceSpectralIncidentScale,
		distanceFalloff,
		color,
		distanceKind: 'finite',
		incidentScalePolicy: 'point-inverse-square-reference',
		sourcePathPolicy: 'finite-source-distance-through-atmosphere',
		provenance,
		sample(position) {
			const vectorToSource = subtract(sourcePosition, position);
			const distanceMeters = length(vectorToSource);
			const direction = distanceMeters === 0
				? [0, 0, 1]
				: vectorToSource.map((value) => value / distanceMeters);
			const distanceKm = distanceMeters / 1000;
			const distanceFalloffScale = distanceFalloff
				? (referenceDistanceKm / distanceKm) ** 2
				: 1;
			const incidentScale =
				referenceSpectralIncidentScale * distanceFalloffScale;

			return {
				kind: SOURCE_KINDS.flatLocalPointSun,
				sourceId: id,
				samplePositionMeters: [...position],
				positionMeters: [...sourcePosition],
				direction,
				distanceKind: 'finite',
				distanceMeters,
				distanceKm,
				radiusKm,
				apparentAngularRadiusRad: Math.atan2(radiusKm, distanceKm),
				referenceDistanceKm,
				distanceFalloff,
				distanceFalloffScale,
				referenceSpectralIncidentScale,
				incidentScale,
				spectralIncidentScaleByWavelength: spectralIncidentScaleByWavelength({
					spectralChannels,
					incidentScale,
					color,
				}),
				sourcePathPolicy: 'finite-source-distance-through-atmosphere',
				transmittancePath: {
					kind: 'finite-source-distance',
					direction,
					distanceMeters,
				},
			};
		},
	});
}

export function createAlgorithm32Model({
	geometry,
	source,
	spectralProfile,
	numericalConfig,
}) {
	return Object.freeze({
		kind: 'algorithm32-source-contract-model',
		geometry,
		source,
		spectralProfile,
		numericalConfig,
		sampleSource(position) {
			return source.sample(position);
		},
	});
}

export function makeSourceContractSummary(model) {
	return {
		kind: 'algorithm32-source-contract-summary',
		modelKind: model.kind,
		geometry: model.geometry,
		source: summarizeSource(model.source),
		numericalConfig: model.numericalConfig,
	};
}

export function makeShaderSourcePacket(model) {
	const source = summarizeSource(model.source);

	return {
		kind: 'algorithm32-shader-source-contract-packet',
		version: 1,
		sourceKind: model.source.kind,
		geometryKind: model.geometry.kind,
		source,
		geometry: model.geometry,
		spectralProfile: model.spectralProfile,
		numericalConfig: model.numericalConfig,
		unsupportedFeatures:
			model.source.kind === SOURCE_KINDS.flatLocalPointSun
				? [
						{
							id: 'local-source-second-order-cache',
							status: 'unsupported',
							reason:
								'The current incident-sky cache is keyed for distant directional Sun behavior.',
						},
						{
							id: 'local-source-direct-solar-disc-camera-radiance',
							status: 'deferred',
							reason:
								'Visible local Sun disc radiance is a rendering feature, not part of the current first-order source contract dry run.',
						},
						{
							id: 'local-source-ground-bounce',
							status: 'deferred',
							reason:
								'Ground bounce is outside the current selected-ray first-order local-source diagnostic scope.',
						},
					]
				: [],
	};
}

function summarizeSource(source) {
	if (source.kind === SOURCE_KINDS.distantDirectionalSun) {
		return {
			kind: source.kind,
			id: source.id,
			direction: source.direction,
			distanceKind: source.distanceKind,
			incidentScalePolicy: source.incidentScalePolicy,
			sourcePathPolicy: source.sourcePathPolicy,
			spectralIncidentScaleByWavelength:
				source.spectralIncidentScaleByWavelength,
			solarIrradianceByWavelength: source.solarIrradianceByWavelength,
		};
	}

	return {
		kind: source.kind,
		id: source.id,
		positionMeters: source.positionMeters,
		radiusKm: source.radiusKm,
		referenceDistanceKm: source.referenceDistanceKm,
		referenceSpectralIncidentScale: source.referenceSpectralIncidentScale,
		distanceFalloff: source.distanceFalloff,
		distanceKind: source.distanceKind,
		incidentScalePolicy: source.incidentScalePolicy,
		sourcePathPolicy: source.sourcePathPolicy,
		color: source.color,
		provenance: source.provenance,
	};
}

function spectralIncidentScaleByWavelength({ spectralChannels, incidentScale, color }) {
	return spectralChannels.map((channel, index) => {
		if (index < 4) {
			return incidentScale * color.b;
		}
		if (index < 8) {
			return incidentScale * color.g;
		}

		return incidentScale * color.r;
	});
}

function normalize(vector) {
	const magnitude = length(vector);

	return magnitude === 0 ? [0, 0, 0] : vector.map((value) => value / magnitude);
}

function subtract(a, b) {
	return a.map((value, index) => value - b[index]);
}

function length(vector) {
	return Math.hypot(...vector);
}
