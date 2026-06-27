import {
	createAlgorithm32Model,
	createDistantDirectionalSunSource,
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
	createSphericalAtmosphereGeometry,
	GEOMETRY_KINDS,
	SOURCE_KINDS,
} from '../source-contract/algorithm32-source-contract.js';

export const ATMOSPHERE = Object.freeze({
	bottomRadiusMeters: 6360000,
	topRadiusMeters: 6420000,
	observerHeightMeters: 2,
	rayleighScaleHeightMeters: 8000,
	mieScaleHeightMeters: 1200,
	rayleighCoefficientScale: 1.24062e-6,
	mieAngstromAlpha: 0.8,
	mieAngstromBeta: 0.04,
	mieSingleScatteringAlbedo: 0.8,
	miePhaseFunctionG: 0.7,
	ozoneAbsorption: 0,
});

export const NUMERICAL_CONTROLS = Object.freeze({
	viewRayScatteringIntervals: 20,
	sampleToSunTransmittanceIntervals: 10,
	secondOrderIncomingDirections: 17,
	secondOrderIncidentAltitudeBins: 24,
});

export const FLAT_SCENE_SKY_RAY_LIMIT_METERS = 1926774;
export const FLAT_SCENE_SKY_RAY_LIMIT_POLICY =
	'accepted-062-flat-visibility-100-percent-lost-poc-default';

export const SCATTERING_ORDERS = Object.freeze({
	algorithm32: 'algorithm32',
	firstOrder: 'first-order',
});

export const SCENE_MODES = Object.freeze({
	threeCardReference: 'three-card-reference',
	sunsetFloor: 'sunset-floor',
	mountainRidges: 'mountain-ridges',
});

const SPECTRAL_DELTA_NM = (830 - 360) / 15;

export const SPECTRAL_CHANNELS = [
	[375.666666666667, 1.068866666667, [0.00082512, 0.000024284, 0.00388120013333]],
	[407, 1.729673, [0.031318, 0.000868, 0.14908]],
	[438.333333333333, 1.862071666667, [0.341686666667, 0.0209466666667, 1.70569333333]],
	[469.666666666667, 2.022063333333, [0.199076, 0.0898413333333, 1.30367066667]],
	[501, 1.908154, [0.0044, 0.33986, 0.26006]],
	[532.333333333333, 1.883391, [0.19361662, 0.88666338, 0.0364106666667]],
	[563.666666666667, 1.834246666667, [0.656026666667, 0.982973333333, 0.00305666593333]],
	[595, 1.76744, [1.0567, 0.6949, 0.001]],
	[626.333333333333, 1.65952, [0.722333333333, 0.306066666667, 0.000086666664]],
	[657.666666666667, 1.548102333333, [0.190006666667, 0.0706133333333, 0]],
	[689, 1.45078, [0.02474, 0.008952, 0]],
	[720.333333333333, 1.340960333333, [0.0028426512, 0.00102653333333, 0]],
	[751.666666666667, 1.262433333333, [0.000299809433333, 0.000108266666667, 0]],
	[783, 1.175208, [0.000034215932, 0.000012356, 0]],
	[814.333333333333, 1.090824, [0.00000378221413333, 0.00000136582666667, 0]],
].map(([wavelengthNanometers, solarIrradiance, cie]) => ({
	wavelengthNanometers,
	solarIrradiance,
	cie,
	wavelengthBinWidthNanometers: SPECTRAL_DELTA_NM,
}));

export const SUN_CASES = [
	{
		id: 'figure1-06h00-z87',
		sourceTimeOfDay: '06h00',
		sourceSunZenithDegrees: 87,
		sunAltitudeDegrees: 3,
		sunAzimuthDegrees: -25.83454348280912,
		role: 'sunrise/sunset stress case',
	},
	{
		id: 'figure1-13h15-z21',
		sourceTimeOfDay: '13h15',
		sourceSunZenithDegrees: 21,
		sunAltitudeDegrees: 69,
		sunAzimuthDegrees: 85.31410016049729,
		role: 'highest-Sun render and stress case',
	},
];

export const SPECTRA = Object.freeze({
	black: spectrumFromRgb(0, 0, 0),
	neutral: spectrumFromRgb(1, 1, 1),
	red: spectrumFromRgb(1, 0.03, 0.02),
	green: spectrumFromRgb(0.05, 0.9, 0.12),
	blue: spectrumFromRgb(0.04, 0.18, 1),
});

const XYZ_TO_SRGB = [
	3.2406, -1.5372, -0.4986,
	-0.9689, 1.8758, 0.0415,
	0.0557, -0.204, 1.057,
];
const MAX_LUMINOUS_EFFICACY = 683;
const BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE = 5;
const DISPLAY_TONE_MAP_K =
	1 / (BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE * MAX_LUMINOUS_EFFICACY);

export function createDistantSunAlgorithm32Model(sunCase = SUN_CASES[1]) {
	return createAlgorithm32Model({
		geometry: createSphericalAtmosphereGeometry({ atmosphere: ATMOSPHERE }),
		source: createDistantDirectionalSunSource({
			sunCase,
			direction: sunDirection(sunCase),
			spectralChannels: SPECTRAL_CHANNELS,
		}),
		spectralProfile: createSpectralProfile(),
		numericalConfig: NUMERICAL_CONTROLS,
	});
}

export function createFlatLocalSunAlgorithm32Model({
	source,
	geometry,
	numericalConfig = {},
}) {
	return createAlgorithm32Model({
		geometry,
		source,
		spectralProfile: createSpectralProfile(),
		numericalConfig: {
			...NUMERICAL_CONTROLS,
			...numericalConfig,
		},
	});
}

export function createSpectralProfile() {
	return {
		kind: 'algorithm32-15-channel-profile',
		channels: SPECTRAL_CHANNELS.map((channel) => ({
			wavelengthNanometers: channel.wavelengthNanometers,
			solarIrradiance: channel.solarIrradiance,
		})),
	};
}

export function traceSegmentForThreeHit({
	camera,
	ray,
	distance,
	sunCase,
	sunRay,
	algorithm32Model,
	incidentField,
	incidentSkyCache,
	includeSecondOrder = true,
}) {
	const activeModel =
		algorithm32Model || createDistantSunAlgorithm32Model(sunCase);
	const geometry = activeModel.geometry;

	return computePathRadianceSegment({
		origin: threeToAlgorithmWorld(camera.position, geometry),
		direction: threeDirectionToAlgorithm(ray.direction, geometry),
		distance,
		sunCase,
		sunRay,
		algorithm32Model: activeModel,
		controls: activeModel.numericalConfig || NUMERICAL_CONTROLS,
		includeSecondOrder,
		incidentField,
		incidentSkyCache,
	});
}

export function traceSkyForThreeRay({
	camera,
	ray,
	sunCase,
	sunRay,
	algorithm32Model,
	incidentField,
	incidentSkyCache,
	includeSecondOrder = true,
}) {
	const activeModel =
		algorithm32Model || createDistantSunAlgorithm32Model(sunCase);
	const geometry = activeModel.geometry;
	const origin = threeToAlgorithmWorld(camera.position, geometry);
	const direction = threeDirectionToAlgorithm(ray.direction, geometry);
	const distance = distanceToSkyBoundary(origin, direction, geometry);

	return computePathRadianceSegment({
		origin,
		direction,
		distance,
		sunCase,
		sunRay,
		algorithm32Model: activeModel,
		controls: activeModel.numericalConfig || NUMERICAL_CONTROLS,
		includeSecondOrder,
		incidentField,
		incidentSkyCache,
	});
}

export function computePathRadianceSegment({
	origin,
	direction,
	distance,
	sunCase,
	sunRay,
	algorithm32Model,
	controls = NUMERICAL_CONTROLS,
	includeSecondOrder = true,
	incidentField = null,
	incidentSkyCache = null,
}) {
	const activeModel =
		algorithm32Model || createDistantSunAlgorithm32Model(sunCase);
	const geometry = activeModel.geometry;
	const normalizedDirection = normalize(direction);
	const sourceDirection =
		activeModel.source.direction ||
		sunRay ||
		activeModel.sampleSource(origin).direction;
	const isFiniteSource =
		activeModel.source.distanceKind === 'finite' ||
		activeModel.source.kind === SOURCE_KINDS.flatLocalPointSun;
	const activeIncidentField =
		includeSecondOrder
			? incidentField ||
				(isFiniteSource
					? null
					: createDistantAltitudeIncidentField({
							model: activeModel,
							sunCase,
							sourceDirection,
							controls,
							cache: incidentSkyCache || new Map(),
						}))
			: null;
	const fullOpticalLengths = computeOpticalLengthsAlongDistance(
		origin,
		normalizedDirection,
		distance,
		controls.viewRayScatteringIntervals,
		geometry
	);
	const fullTransmittance = computeTransmittanceSpectrum(fullOpticalLengths);

	if (distance === 0) {
		const altitudeMeters = altitudeAtPosition(origin, geometry);

		return {
			opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
			transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
			pathRadianceByWavelength: zeroSpectrum(),
			firstOrderPathRadianceByWavelength: zeroSpectrum(),
			secondOrderPathRadianceByWavelength: zeroSpectrum(),
			diagnostics: {
				sampleCount: controls.viewRayScatteringIntervals,
				minAltitudeMeters: altitudeMeters,
				maxAltitudeMeters: altitudeMeters,
				rayleighOpticalLength: 0,
				mieOpticalLength: 0,
				absorptionOpticalLength: 0,
			},
		};
	}

	const sampleCount = controls.viewRayScatteringIntervals;
	const step = distance / sampleCount;
	const samples = [];
	const cumulativeRayleigh = [0];
	const cumulativeMie = [0];
	const cumulativeAbsorption = [0];
	const rayleighSum = zeroSpectrum();
	const mieSum = zeroSpectrum();
	const secondOrderSum = zeroSpectrum();
	let minAltitudeMeters = Number.POSITIVE_INFINITY;
	let maxAltitudeMeters = Number.NEGATIVE_INFINITY;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const position = addScaled(origin, normalizedDirection, sampleDistance);
		const density = densityAtPosition(position, geometry);

		minAltitudeMeters = Math.min(minAltitudeMeters, density.altitudeMeters);
		maxAltitudeMeters = Math.max(maxAltitudeMeters, density.altitudeMeters);
		samples.push({ position, density });

		if (sampleIndex > 0) {
			const previousDensity = samples[sampleIndex - 1].density;
			cumulativeRayleigh[sampleIndex] =
				cumulativeRayleigh[sampleIndex - 1] +
				0.5 * (previousDensity.rayleigh + density.rayleigh) * step;
			cumulativeMie[sampleIndex] =
				cumulativeMie[sampleIndex - 1] +
				0.5 * (previousDensity.mie + density.mie) * step;
			cumulativeAbsorption[sampleIndex] =
				cumulativeAbsorption[sampleIndex - 1] +
				0.5 * (previousDensity.absorption + density.absorption) * step;
		}
	}

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sample = samples[sampleIndex];
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;
		const sourceSample = activeModel.sampleSource(sample.position);
		const viewTransmittance = computeTransmittanceSpectrum({
			rayleighOpticalLength: cumulativeRayleigh[sampleIndex],
			mieOpticalLength: cumulativeMie[sampleIndex],
			absorptionOpticalLength: cumulativeAbsorption[sampleIndex],
		}).transmittanceByWavelength;
		const sourceTransmittance = computeTransmittanceToSourceSpectrum(
			sample.position,
			sourceSample,
			controls,
			geometry
		);

		for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
			const transmittance =
				viewTransmittance[channelIndex] * sourceTransmittance[channelIndex];

			if (isFiniteSource) {
				const channel = SPECTRAL_CHANNELS[channelIndex];
				const wavelengthMicrometers = wavelengthNanometersToMicrometers(
					channel.wavelengthNanometers
				);
				const sampleNu = clamp(dot(normalizedDirection, sourceSample.direction), -1, 1);
				const rayleighPhase = rayleighPhaseFunction(sampleNu);
				const miePhase = miePhaseFunction(
					ATMOSPHERE.miePhaseFunctionG,
					sampleNu
				);
				const sourceIncidentScale =
					sourceSample.spectralIncidentScaleByWavelength?.[channelIndex] ??
					sourceSample.incidentScale ??
					1;
				const sourceIrradiance =
					channel.solarIrradiance * sourceIncidentScale;

				rayleighSum[channelIndex] +=
					transmittance *
					sample.density.rayleigh *
					sourceIrradiance *
					rayleighScatteringCoefficientAt(wavelengthMicrometers) *
					rayleighPhase *
					weight;
				mieSum[channelIndex] +=
					transmittance *
					sample.density.mie *
					sourceIrradiance *
					mieScatteringCoefficientAt(wavelengthMicrometers) *
					miePhase *
					weight;
			} else {
				rayleighSum[channelIndex] +=
					transmittance * sample.density.rayleigh * weight;
				mieSum[channelIndex] += transmittance * sample.density.mie * weight;
			}
		}

		if (activeIncidentField) {
			const secondOrder = computeSecondOrderAtSample({
				position: sample.position,
				viewRay: normalizedDirection,
				density: sample.density,
				viewTransmittance,
				controls,
				sourceDirection,
				incidentField: activeIncidentField,
			});

			for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
				secondOrderSum[channelIndex] += secondOrder[channelIndex] * weight;
			}
		}
	}

	const firstOrderPathRadianceByWavelength = isFiniteSource
		? rayleighSum.map((value, channelIndex) => {
				return (value + mieSum[channelIndex]) * step;
			})
		: distantFirstOrderPathRadiance({
				direction: normalizedDirection,
				sourceDirection,
				rayleighSum,
				mieSum,
				step,
			});
	const secondOrderPathRadianceByWavelength = secondOrderSum.map(
		(value) => value * step
	);
	const pathRadianceByWavelength = addArrays(
		firstOrderPathRadianceByWavelength,
		secondOrderPathRadianceByWavelength
	);

	return {
		opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
		transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
		pathRadianceByWavelength,
		firstOrderPathRadianceByWavelength,
		secondOrderPathRadianceByWavelength,
		diagnostics: {
			sampleCount,
			minAltitudeMeters,
			maxAltitudeMeters,
			rayleighOpticalLength: fullOpticalLengths.rayleighOpticalLength,
			mieOpticalLength: fullOpticalLengths.mieOpticalLength,
			absorptionOpticalLength: fullOpticalLengths.absorptionOpticalLength,
			secondOrderIncidentField:
				activeIncidentField?.kind || (includeSecondOrder ? 'none' : 'disabled'),
		},
	};
}

export function createDistantAltitudeIncidentField({
	model,
	sunCase,
	sourceDirection,
	controls = NUMERICAL_CONTROLS,
	cache = new Map(),
}) {
	return {
		kind: 'distant-altitude-incident-field',
		cache,
		sample({ position, incomingDirection, directionIndex = 0 }) {
			const geometry = model.geometry;
			const altitude = clamp(
				altitudeAtPosition(position, geometry),
				0,
				ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters
			);
			const binSize =
				(ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters) /
				controls.secondOrderIncidentAltitudeBins;
			const binIndex = clamp(
				Math.floor(altitude / binSize),
				0,
				controls.secondOrderIncidentAltitudeBins - 1
			);
			const key = `${model.source.id}|${directionIndex}|${binIndex}`;

			if (!cache.has(key)) {
				const binAltitude = (binIndex + 0.5) * binSize;
				const binOrigin = [
					0,
					0,
					ATMOSPHERE.bottomRadiusMeters + binAltitude,
				];
				const radius = length(binOrigin);
				const mu = dot(binOrigin, incomingDirection) / radius;

				if (rayIntersectsGround(radius, mu)) {
					cache.set(key, zeroSpectrum());
				} else {
					const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
					const incident = computePathRadianceSegment({
						origin: binOrigin,
						direction: incomingDirection,
						distance: distanceToTop,
						sunCase,
						sunRay: sourceDirection,
						algorithm32Model: model,
						controls,
						includeSecondOrder: false,
					});

					cache.set(key, incident.pathRadianceByWavelength);
				}
			}

			return cache.get(key);
		},
	};
}

function computeSecondOrderAtSample({
	position,
	viewRay,
	sourceDirection,
	density,
	viewTransmittance,
	controls,
	incidentField,
}) {
	const secondOrder = zeroSpectrum();
	const incomingDirections = fibonacciSphereIncomingDirections(
		sourceDirection,
		controls.secondOrderIncomingDirections
	);
	const angularWeight = (4 * Math.PI) / incomingDirections.length;

	for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
		const incomingDirection = incomingDirections[directionIndex];
		const incidentRadiance =
			incidentField.sample({
				position,
				incomingDirection,
				directionIndex,
			}) || zeroSpectrum();
		const nu = dot(viewRay, incomingDirection);
		const rayleighPhase = rayleighPhaseFunction(nu);
		const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);

		for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
			const wavelengthMicrometers = wavelengthNanometersToMicrometers(
				SPECTRAL_CHANNELS[channelIndex].wavelengthNanometers
			);
			const scatteringCoefficient =
				density.rayleigh *
					rayleighScatteringCoefficientAt(wavelengthMicrometers) *
					rayleighPhase +
				density.mie *
					mieScatteringCoefficientAt(wavelengthMicrometers) *
					miePhase;

			secondOrder[channelIndex] +=
				viewTransmittance[channelIndex] *
				incidentRadiance[channelIndex] *
				scatteringCoefficient *
				angularWeight;
		}
	}

	return secondOrder;
}

export function computeOpticalLengthsAlongDistance(
	origin,
	direction,
	distance,
	sampleCount,
	geometry = null
) {
	if (distance === 0 || sampleCount === 0) {
		return {
			distance,
			rayleighOpticalLength: 0,
			mieOpticalLength: 0,
			absorptionOpticalLength: 0,
		};
	}

	const step = distance / sampleCount;
	let rayleighOpticalLength = 0;
	let mieOpticalLength = 0;
	let absorptionOpticalLength = 0;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const samplePosition = addScaled(origin, direction, sampleDistance);
		const density = densityAtPosition(samplePosition, geometry);
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;

		rayleighOpticalLength += density.rayleigh * weight * step;
		mieOpticalLength += density.mie * weight * step;
		absorptionOpticalLength += density.absorption * weight * step;
	}

	return {
		distance,
		rayleighOpticalLength,
		mieOpticalLength,
		absorptionOpticalLength,
	};
}

export function computeTransmittanceSpectrum(opticalLengths) {
	const opticalDepthByWavelength = SPECTRAL_CHANNELS.map((channel) => {
		const wavelengthMicrometers = wavelengthNanometersToMicrometers(
			channel.wavelengthNanometers
		);

		return (
			rayleighScatteringCoefficientAt(wavelengthMicrometers) *
				opticalLengths.rayleighOpticalLength +
			mieExtinctionCoefficientAt(wavelengthMicrometers) *
				opticalLengths.mieOpticalLength +
			ATMOSPHERE.ozoneAbsorption *
				(opticalLengths.absorptionOpticalLength || 0)
		);
	});

	return {
		opticalDepthByWavelength,
		transmittanceByWavelength: opticalDepthByWavelength.map((tau) =>
			Math.exp(-tau)
		),
	};
}

export function computeTransmittanceToSourceSpectrum(
	position,
	sourceSample,
	controls = NUMERICAL_CONTROLS,
	geometry = null
) {
	if (sourceSample.distanceKind === 'finite') {
		if (isFlatGeometry(geometry)) {
			const groundDistance = distanceToFlatGroundBoundary(
				position,
				sourceSample.direction
			);

			if (
				groundDistance !== null &&
				groundDistance < sourceSample.distanceMeters - 1e-9
			) {
				return zeroSpectrum();
			}

			const topDistance = distanceToFlatTopBoundary(
				position,
				sourceSample.direction,
				geometry
			);
			const atmosphereDistance =
				topDistance === null
					? sourceSample.distanceMeters
					: Math.min(sourceSample.distanceMeters, topDistance);

			if (atmosphereDistance <= 0) {
				return SPECTRAL_CHANNELS.map(() => 1);
			}

			return computeTransmittanceSpectrum(
				computeOpticalLengthsAlongDistance(
					position,
					sourceSample.direction,
					atmosphereDistance,
					controls.sampleToSunTransmittanceIntervals,
					geometry
				)
			).transmittanceByWavelength;
		}

		return computeTransmittanceSpectrum(
			computeOpticalLengthsAlongDistance(
				position,
				sourceSample.direction,
				sourceSample.distanceMeters,
				controls.sampleToSunTransmittanceIntervals,
				geometry
			)
		).transmittanceByWavelength;
	}

	if (isFlatGeometry(geometry)) {
		const groundDistance = distanceToFlatGroundBoundary(
			position,
			sourceSample.direction
		);

		if (groundDistance !== null) {
			return zeroSpectrum();
		}

		return computeTransmittanceSpectrum(
			computeOpticalLengthsToTop(
				position,
				sourceSample.direction,
				controls.sampleToSunTransmittanceIntervals,
				geometry
			)
		).transmittanceByWavelength;
	}

	const radius = length(position);
	const mu = dot(position, sourceSample.direction) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return zeroSpectrum();
	}

	return computeTransmittanceSpectrum(
		computeOpticalLengthsToTop(
			position,
			sourceSample.direction,
			controls.sampleToSunTransmittanceIntervals,
			geometry
		)
	).transmittanceByWavelength;
}

export function densityAtPosition(position, geometry = null) {
	if (isFlatGeometry(geometry)) {
		const altitude = position[2];

		if (altitude < 0 || altitude > geometry.topAltitudeMeters) {
			return {
				altitudeMeters: altitude,
				rayleigh: 0,
				mie: 0,
				absorption: 0,
			};
		}

		return {
			altitudeMeters: altitude,
			rayleigh: exponentialDensity(altitude, ATMOSPHERE.rayleighScaleHeightMeters),
			mie: exponentialDensity(altitude, ATMOSPHERE.mieScaleHeightMeters),
			absorption: 0,
		};
	}

	const altitude = length(position) - ATMOSPHERE.bottomRadiusMeters;

	return {
		altitudeMeters: altitude,
		rayleigh: exponentialDensity(altitude, ATMOSPHERE.rayleighScaleHeightMeters),
		mie: exponentialDensity(altitude, ATMOSPHERE.mieScaleHeightMeters),
		absorption: 0,
	};
}

export function distanceToSkyBoundary(origin, direction, geometry = null) {
	if (isFlatGeometry(geometry)) {
		const topDistance = distanceToFlatTopBoundary(origin, direction, geometry);
		const groundDistance = distanceToFlatGroundBoundary(origin, direction);
		const skyLimit =
			geometry.sceneSkyRayLimitMeters ?? FLAT_SCENE_SKY_RAY_LIMIT_METERS;

		if (groundDistance !== null) {
			return Math.min(groundDistance, skyLimit);
		}
		if (topDistance !== null) {
			return Math.min(topDistance, skyLimit);
		}

		return skyLimit;
	}

	const radius = length(origin);
	const mu = dot(origin, direction) / radius;

	return distanceToTopAtmosphereBoundary(radius, mu);
}

export function spectralToDisplayPreview(radianceByWavelength) {
	let x = 0;
	let y = 0;
	let z = 0;

	for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
		const channel = SPECTRAL_CHANNELS[channelIndex];
		const radiance = radianceByWavelength[channelIndex];

		x += channel.cie[0] * radiance * channel.wavelengthBinWidthNanometers;
		y += channel.cie[1] * radiance * channel.wavelengthBinWidthNanometers;
		z += channel.cie[2] * radiance * channel.wavelengthBinWidthNanometers;
	}

	const linearSrgb = [
		MAX_LUMINOUS_EFFICACY *
			(XYZ_TO_SRGB[0] * x + XYZ_TO_SRGB[1] * y + XYZ_TO_SRGB[2] * z),
		MAX_LUMINOUS_EFFICACY *
			(XYZ_TO_SRGB[3] * x + XYZ_TO_SRGB[4] * y + XYZ_TO_SRGB[5] * z),
		MAX_LUMINOUS_EFFICACY *
			(XYZ_TO_SRGB[6] * x + XYZ_TO_SRGB[7] * y + XYZ_TO_SRGB[8] * z),
	];
	const displayRgb = linearSrgb.map((value) =>
		clamp(1 - Math.exp(-DISPLAY_TONE_MAP_K * Math.max(0, value)), 0, 1)
	);
	const encodedRgb = displayRgb.map((value) => clampByte(value * 255));

	return {
		cieXyzUnscaled: [x, y, z],
		linearSrgb,
		displayRgb,
		encodedRgb,
	};
}

export function objectRadianceSpectrum(spectrum) {
	return SPECTRAL_CHANNELS.map((channel) =>
		spectrum.evaluate(channel.wavelengthNanometers)
	);
}

export function composeObjectRadiance(objectRadiance, transfer) {
	return addArrays(
		multiplyArrays(objectRadiance, transfer.transmittanceByWavelength),
		transfer.pathRadianceByWavelength
	);
}

export function sunDirection(sunCase) {
	if (sunCase.sunDirection) {
		return normalize(sunCase.sunDirection);
	}

	const altitude = degreesToRadians(sunCase.sunAltitudeDegrees);
	const azimuth = degreesToRadians(sunCase.sunAzimuthDegrees);
	const horizontalLength = Math.cos(altitude);

	return normalize([
		horizontalLength * Math.cos(azimuth),
		horizontalLength * Math.sin(azimuth),
		Math.sin(altitude),
	]);
}

export function firstHit(raycaster, meshes) {
	const hits = raycaster.intersectObjects(meshes, false);
	return hits.length > 0 ? hits[0] : null;
}

export function pixelToNdc(x, y, width, height) {
	return {
		x: ((x + 0.5) / width) * 2 - 1,
		y: -(((y + 0.5) / height) * 2 - 1),
	};
}

export function threeToAlgorithmWorld(vector, geometry = null) {
	const [x, y, z] = vectorToArray(vector);

	if (isFlatGeometry(geometry)) {
		return [x, -z, y];
	}

	return [x, -z, ATMOSPHERE.bottomRadiusMeters + y];
}

export function threeDirectionToAlgorithm(vector) {
	const [x, y, z] = vectorToArray(vector);

	return normalize([x, -z, y]);
}

export function summarizeTransfer(transfer) {
	return {
		opticalDepthByWavelength: transfer.opticalDepthByWavelength,
		transmittanceByWavelength: transfer.transmittanceByWavelength,
		pathRadianceByWavelength: transfer.pathRadianceByWavelength,
		firstOrderPathRadianceByWavelength:
			transfer.firstOrderPathRadianceByWavelength,
		secondOrderPathRadianceByWavelength:
			transfer.secondOrderPathRadianceByWavelength,
		meanTransmittance: mean(transfer.transmittanceByWavelength),
		meanPathRadiance: mean(transfer.pathRadianceByWavelength),
		diagnostics: transfer.diagnostics,
	};
}

export function summarizeSourceSample(sourceSample) {
	return {
		kind: sourceSample.kind,
		sourceId: sourceSample.sourceId,
		direction: sourceSample.direction,
		distanceKind: sourceSample.distanceKind,
		distanceMeters: sourceSample.distanceMeters,
		distanceKm: sourceSample.distanceKm || null,
		incidentScale: sourceSample.incidentScale,
		distanceFalloffScale: sourceSample.distanceFalloffScale || null,
		sourcePathPolicy: sourceSample.sourcePathPolicy,
		transmittancePath: sourceSample.transmittancePath,
		spectralIncidentScaleByWavelength:
			sourceSample.spectralIncidentScaleByWavelength,
	};
}

function computeOpticalLengthsToTop(
	origin,
	direction,
	sampleCount,
	geometry = null
) {
	if (isFlatGeometry(geometry)) {
		const distanceToTop = distanceToFlatTopBoundary(origin, direction, geometry);

		return computeOpticalLengthsAlongDistance(
			origin,
			direction,
			distanceToTop ?? 0,
			sampleCount,
			geometry
		);
	}

	const radius = length(origin);
	const mu = dot(origin, direction) / radius;
	const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);

	return computeOpticalLengthsAlongDistance(
		origin,
		direction,
		distanceToTop,
		sampleCount,
		geometry
	);
}

function distantFirstOrderPathRadiance({
	direction,
	sourceDirection,
	rayleighSum,
	mieSum,
	step,
}) {
	const nu = dot(direction, sourceDirection);
	const rayleighPhase = rayleighPhaseFunction(nu);
	const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);

	return SPECTRAL_CHANNELS.map((channel, channelIndex) => {
		const wavelengthMicrometers = wavelengthNanometersToMicrometers(
			channel.wavelengthNanometers
		);
		const rayleigh =
			rayleighSum[channelIndex] *
			step *
			channel.solarIrradiance *
			rayleighScatteringCoefficientAt(wavelengthMicrometers) *
			rayleighPhase;
		const mie =
			mieSum[channelIndex] *
			step *
			channel.solarIrradiance *
			mieScatteringCoefficientAt(wavelengthMicrometers) *
			miePhase;

		return rayleigh + mie;
	});
}

function isFlatGeometry(geometry) {
	return geometry?.kind === GEOMETRY_KINDS.flatZUpAtmosphere;
}

function altitudeAtPosition(position, geometry = null) {
	if (isFlatGeometry(geometry)) {
		return position[2];
	}

	return length(position) - ATMOSPHERE.bottomRadiusMeters;
}

function distanceToFlatTopBoundary(origin, direction, geometry) {
	if (direction[2] <= 0) {
		return null;
	}

	return Math.max(0, (geometry.topAltitudeMeters - origin[2]) / direction[2]);
}

function distanceToFlatGroundBoundary(origin, direction) {
	if (direction[2] >= 0) {
		return null;
	}

	return Math.max(0, -origin[2] / direction[2]);
}

function distanceToTopAtmosphereBoundary(radius, mu) {
	const discriminant =
		radius * radius * (mu * mu - 1) +
		ATMOSPHERE.topRadiusMeters * ATMOSPHERE.topRadiusMeters;

	return Math.max(0, -radius * mu + Math.sqrt(Math.max(0, discriminant)));
}

function rayIntersectsGround(radius, mu) {
	return (
		mu < 0 &&
		radius * radius * (mu * mu - 1) +
			ATMOSPHERE.bottomRadiusMeters * ATMOSPHERE.bottomRadiusMeters >=
			0
	);
}

function rayleighScatteringCoefficientAt(wavelengthMicrometers) {
	return ATMOSPHERE.rayleighCoefficientScale * wavelengthMicrometers ** -4;
}

function mieExtinctionCoefficientAt(wavelengthMicrometers) {
	return (
		(ATMOSPHERE.mieAngstromBeta / ATMOSPHERE.mieScaleHeightMeters) *
		wavelengthMicrometers ** -ATMOSPHERE.mieAngstromAlpha
	);
}

function mieScatteringCoefficientAt(wavelengthMicrometers) {
	return (
		mieExtinctionCoefficientAt(wavelengthMicrometers) *
		ATMOSPHERE.mieSingleScatteringAlbedo
	);
}

function rayleighPhaseFunction(nu) {
	return (3 / (16 * Math.PI)) * (1 + nu * nu);
}

function miePhaseFunction(g, nu) {
	const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));

	return (k * (1 + nu * nu)) / (1 + g * g - 2 * g * nu) ** 1.5;
}

function fibonacciSphereIncomingDirections(sunRay, count) {
	const halfCount = Math.floor(count / 2);
	const goldenRatio = (1 + Math.sqrt(5)) / 2;
	const sunAxis = normalize(sunRay);
	const reference =
		Math.abs(dot(sunAxis, [0, 0, 1])) < 0.95 ? [0, 0, 1] : [0, 1, 0];
	const zAxis = normalize(
		addArrays(reference, scaleVector(sunAxis, -dot(reference, sunAxis)))
	);
	const yAxis = normalize(cross(zAxis, sunAxis));
	const directions = [];

	for (let index = -halfCount; directions.length < count; index += 1) {
		const z = (2 * index) / count;
		const latitude = Math.asin(clamp(z, -1, 1));
		const longitude = (2 * Math.PI * index) / goldenRatio;
		const horizontalScale = Math.cos(latitude);
		const localX = horizontalScale * Math.cos(longitude);
		const localY = horizontalScale * Math.sin(longitude);
		const localZ = z;

		directions.push(
			normalize(
				addArrays(
					addArrays(scaleVector(sunAxis, localX), scaleVector(yAxis, localY)),
					scaleVector(zAxis, localZ)
				)
			)
		);
	}

	return directions;
}

function spectrumFromRgb(red, green, blue) {
	return Object.freeze({
		kind: 'rgb-band-spectrum',
		rgb: [red, green, blue],
		evaluate(wavelengthNanometers) {
			if (wavelengthNanometers < 500) {
				return blue;
			}
			if (wavelengthNanometers < 600) {
				return green;
			}
			return red;
		},
	});
}

function exponentialDensity(altitudeMeters, scaleHeightMeters) {
	return Math.exp(-Math.max(0, altitudeMeters) / scaleHeightMeters);
}

function wavelengthNanometersToMicrometers(wavelengthNanometers) {
	return wavelengthNanometers * 1e-3;
}

function zeroSpectrum() {
	return SPECTRAL_CHANNELS.map(() => 0);
}

function dot(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
	return [
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0],
	];
}

function length(vector) {
	return Math.sqrt(dot(vector, vector));
}

function normalize(vector) {
	const vectorLength = length(vector);

	if (vectorLength === 0) {
		return [0, 0, 0];
	}

	return [
		vector[0] / vectorLength,
		vector[1] / vectorLength,
		vector[2] / vectorLength,
	];
}

function scaleVector(vector, scalar) {
	return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function addArrays(a, b) {
	return a.map((value, index) => value + b[index]);
}

function multiplyArrays(a, b) {
	return a.map((value, index) => value * b[index]);
}

function addScaled(origin, direction, distance) {
	return [
		origin[0] + direction[0] * distance,
		origin[1] + direction[1] * distance,
		origin[2] + direction[2] * distance,
	];
}

function mean(values) {
	if (values.length === 0) {
		return 0;
	}

	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function clampByte(value) {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function degreesToRadians(degrees) {
	return (degrees * Math.PI) / 180;
}

function vectorToArray(vector) {
	if (Array.isArray(vector)) {
		return vector;
	}

	return [vector.x, vector.y, vector.z];
}

export { createFlatLocalPointSunSource, createFlatZUpAtmosphereGeometry };
