export const ALGORITHM32_BASE_PROFILE = Object.freeze({
	id: 'figure1-four-view-source-k-no-ground-baseline',
	source: 'scripts/flat/experimental/bruneton-start-fresh.js',
	geometry: 'spherical-earth-atmosphere',
	sourceKind: 'distant-directional-sun',
	ozone: false,
	directSolarDiscCameraRadiance: false,
	secondOrderScattering: true,
	secondOrderIncidentCache: 'altitude-direction',
	groundBounce: false,
	displayToneMap: 'bruneton-source-k',
});

export const ATMOSPHERE = Object.freeze({
	bottomRadiusMeters: 6360000,
	topRadiusMeters: 6420000,
	observerHeightMeters: 2,
	rayleighScaleHeightMeters: 8000,
	mieScaleHeightMeters: 1200,
	rayleighCoefficientScale: 1.24062e-6,
	mieAngstromAlpha: 0,
	mieAngstromBeta: 5.328e-3,
	mieSingleScatteringAlbedo: 0.9,
	miePhaseFunctionG: 0.8,
	sunAngularRadiusRadians: 0.00935 / 2,
	singleScatteringSampleCount: 20,
	sunTransmittanceSampleCount: 10,
	fibonacciSphereSecondOrderDirectionCount: 17,
	secondOrderAltitudeBins: 24,
});

export const BRUNETON_2016_AEROSOL = Object.freeze({
	mieAngstromAlpha: 0.8,
	mieAngstromBeta: 0.04,
	mieSingleScatteringAlbedo: 0.8,
	miePhaseFunctionG: 0.7,
});

export const FIGURE1_FOUR_VIEW_SCENES = Object.freeze([
	{
		id: 'figure1-06h00-z87',
		sourceTimeOfDay: '06h00',
		sourceSunZenithDegrees: 87,
		sunAltitudeDegrees: 3,
		sunAzimuthDegrees: -25.83454348280912,
	},
	{
		id: 'figure1-10h15-z41',
		sourceTimeOfDay: '10h15',
		sourceSunZenithDegrees: 41,
		sunAltitudeDegrees: 49,
		sunAzimuthDegrees: 9.544525565558136,
	},
	{
		id: 'figure1-11h15-z31',
		sourceTimeOfDay: '11h15',
		sourceSunZenithDegrees: 31,
		sunAltitudeDegrees: 59,
		sunAzimuthDegrees: 22.166345822082455,
	},
	{
		id: 'figure1-13h15-z21',
		sourceTimeOfDay: '13h15',
		sourceSunZenithDegrees: 21,
		sunAltitudeDegrees: 69,
		sunAzimuthDegrees: 85.31410016049729,
	},
]);

const SPECTRAL_DELTA_NM = (830 - 360) / 15;

export const SPECTRAL_CHANNELS = Object.freeze([
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
].map(([wavelengthNanometers, solarIrradiance, cie]) =>
	Object.freeze({
		wavelengthNanometers,
		solarIrradiance,
		cie,
		wavelengthBinWidthNanometers: SPECTRAL_DELTA_NM,
	})
));

const XYZ_TO_SRGB = [
	3.2406, -1.5372, -0.4986,
	-0.9689, 1.8758, 0.0415,
	0.0557, -0.204, 1.057,
];
const MAX_LUMINOUS_EFFICACY = 683;
const BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE = 5;
const DISPLAY_TONE_MAP_K =
	1 / (BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE * MAX_LUMINOUS_EFFICACY);

export function activeSpectralChannels() {
	return SPECTRAL_CHANNELS;
}

export function activeAerosolParameters() {
	return BRUNETON_2016_AEROSOL;
}

export function observerPosition() {
	return [
		0,
		0,
		ATMOSPHERE.bottomRadiusMeters + ATMOSPHERE.observerHeightMeters,
	];
}

export function sunDirection(scene) {
	if (scene.sunDirection) {
		return normalize(scene.sunDirection);
	}

	const altitude = degreesToRadians(scene.sunAltitudeDegrees);
	const azimuth = degreesToRadians(scene.sunAzimuthDegrees);
	const horizontalLength = Math.cos(altitude);

	return normalize([
		horizontalLength * Math.cos(azimuth),
		horizontalLength * Math.sin(azimuth),
		Math.sin(altitude),
	]);
}

export function densityAtPosition(position) {
	const altitude = length(position) - ATMOSPHERE.bottomRadiusMeters;

	return {
		altitudeMeters: altitude,
		rayleigh: exponentialDensity(altitude, ATMOSPHERE.rayleighScaleHeightMeters),
		mie: exponentialDensity(altitude, ATMOSPHERE.mieScaleHeightMeters),
		absorption: 0,
	};
}

export function computeOpticalLengthsAlongDistance(
	origin,
	direction,
	distance,
	sampleCount = ATMOSPHERE.singleScatteringSampleCount
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
		const density = densityAtPosition(samplePosition);
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

export function computeOpticalLengthsToTop(
	origin,
	direction,
	sampleCount = ATMOSPHERE.singleScatteringSampleCount
) {
	const radius = length(origin);
	const mu = dot(origin, direction) / radius;
	const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
	const opticalLengths = computeOpticalLengthsAlongDistance(
		origin,
		direction,
		distanceToTop,
		sampleCount
	);

	return {
		distanceToTop,
		...opticalLengths,
	};
}

export function computeTransmittanceSpectrum(opticalLengths) {
	return SPECTRAL_CHANNELS.map((channel) => {
		const wavelengthMicrometers = wavelengthNanometersToMicrometers(
			channel.wavelengthNanometers
		);
		const opticalDepth =
			rayleighScatteringCoefficientAt(wavelengthMicrometers) *
				opticalLengths.rayleighOpticalLength +
			mieExtinctionCoefficientAt(wavelengthMicrometers) *
				opticalLengths.mieOpticalLength;

		return Math.exp(-opticalDepth);
	});
}

export function computeTransmittanceToSunSpectrum(position, sunRay) {
	const radius = length(position);
	const mu = dot(position, sunRay) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return SPECTRAL_CHANNELS.map(() => 0);
	}

	return computeTransmittanceSpectrum(
		computeOpticalLengthsToTop(
			position,
			sunRay,
			ATMOSPHERE.sunTransmittanceSampleCount
		)
	);
}

export function computeSingleScatteringRadiance(
	origin,
	viewRay,
	sunRay,
	options = {}
) {
	const normalizedViewRay = normalize(viewRay);
	const normalizedSunRay = normalize(sunRay);
	const includeSecondOrder = options.includeSecondOrder !== false;
	const scene = options.scene || null;
	const radius = length(origin);
	const mu = dot(origin, normalizedViewRay) / radius;
	const nu = dot(normalizedViewRay, normalizedSunRay);
	const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
	const sampleCount =
		options.sampleCount || ATMOSPHERE.singleScatteringSampleCount;
	const step = distanceToTop / sampleCount;
	const samples = [];
	const cumulativeRayleigh = [0];
	const cumulativeMie = [0];
	const cumulativeAbsorption = [0];
	const rayleighSum = zeroSpectrum();
	const mieSum = zeroSpectrum();
	const secondOrderSum = zeroSpectrum();
	const incidentField =
		includeSecondOrder && scene
			? options.incidentField ||
				createDistantAltitudeIncidentField({
					scene,
					sunRay: normalizedSunRay,
					cache: options.incidentSkyCache || new Map(),
				})
			: null;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const position = addScaled(origin, normalizedViewRay, sampleDistance);
		const density = densityAtPosition(position);

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
		const viewTransmittance = computeTransmittanceSpectrum({
			rayleighOpticalLength: cumulativeRayleigh[sampleIndex],
			mieOpticalLength: cumulativeMie[sampleIndex],
			absorptionOpticalLength: cumulativeAbsorption[sampleIndex],
		});
		const sunTransmittance = computeTransmittanceToSunSpectrum(
			sample.position,
			normalizedSunRay
		);

		for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
			const transmittance =
				viewTransmittance[channelIndex] * sunTransmittance[channelIndex];

			rayleighSum[channelIndex] +=
				transmittance * sample.density.rayleigh * weight;
			mieSum[channelIndex] += transmittance * sample.density.mie * weight;
		}

		if (incidentField) {
			const secondOrder = computeSecondOrderScatteringAtSample({
				position: sample.position,
				viewRay: normalizedViewRay,
				sunRay: normalizedSunRay,
				density: sample.density,
				viewTransmittance,
				incidentField,
			});

			for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
				secondOrderSum[channelIndex] += secondOrder[channelIndex] * weight;
			}
		}
	}

	const rayleighPhase = rayleighPhaseFunction(nu);
	const miePhase = miePhaseFunction(
		BRUNETON_2016_AEROSOL.miePhaseFunctionG,
		nu
	);
	const skyRadiance = SPECTRAL_CHANNELS.map((channel, channelIndex) => {
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
	const secondOrderRadiance = secondOrderSum.map((value) => value * step);
	const radiance = skyRadiance.map(
		(value, channelIndex) => value + secondOrderRadiance[channelIndex]
	);

	return {
		radiance,
		skyRadiance,
		sunRadiance: zeroSpectrum(),
		secondOrderRadiance,
		groundBounceRadiance: zeroSpectrum(),
		distanceToTop,
		diagnostics: {
			profile: ALGORITHM32_BASE_PROFILE.id,
			viewSampleCount: sampleCount,
			secondOrderEnabled: Boolean(incidentField),
			secondOrderCacheEntries: incidentField?.cache?.size ?? 0,
		},
	};
}

export function createDistantAltitudeIncidentField({
	scene,
	sunRay,
	cache = new Map(),
}) {
	const normalizedSunRay = normalize(sunRay);

	return {
		kind: 'bruneton-start-fresh-altitude-incident-field',
		cache,
		sample({ position, incomingDirection, directionIndex = 0 }) {
			const altitude = clamp(
				length(position) - ATMOSPHERE.bottomRadiusMeters,
				0,
				ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters
			);
			const binSize =
				(ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters) /
				ATMOSPHERE.secondOrderAltitudeBins;
			const binIndex = clamp(
				Math.floor(altitude / binSize),
				0,
				ATMOSPHERE.secondOrderAltitudeBins - 1
			);
			const key = `${scene.id}|${directionIndex}|${binIndex}`;

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
					const incident = computeSingleScatteringRadiance(
						binOrigin,
						incomingDirection,
						normalizedSunRay,
						{
							scene,
							includeSecondOrder: false,
						}
					);

					cache.set(key, incident.skyRadiance);
				}
			}

			return cache.get(key);
		},
	};
}

export function computeSecondOrderScatteringAtSample({
	position,
	viewRay,
	sunRay,
	density,
	viewTransmittance,
	incidentField,
}) {
	const secondOrder = zeroSpectrum();
	const incomingDirections = fibonacciSphereIncomingDirections(sunRay);
	const angularWeight = (4 * Math.PI) / incomingDirections.length;

	for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
		const incomingDirection = incomingDirections[directionIndex];
		const incidentRadiance = incidentField.sample({
			position,
			incomingDirection,
			directionIndex,
		});
		const nu = dot(viewRay, incomingDirection);
		const rayleighPhase = rayleighPhaseFunction(nu);
		const miePhase = miePhaseFunction(
			BRUNETON_2016_AEROSOL.miePhaseFunctionG,
			nu
		);

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

export function spectralRadianceToDisplayRgb(radianceByWavelength) {
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

export function sampleFisheyeDirection({
	x,
	y,
	size = 320,
	skyRadius = size * 0.47,
}) {
	const center = (size - 1) / 2;
	const dx = x - center;
	const dy = y - center;
	const normalizedRadius = Math.sqrt(dx * dx + dy * dy) / skyRadius;

	if (normalizedRadius > 1) {
		return null;
	}

	const zenithAngle = normalizedRadius * (Math.PI / 2);
	const azimuth = Math.atan2(-dy, dx);

	return normalize([
		Math.sin(zenithAngle) * Math.cos(azimuth),
		Math.sin(zenithAngle) * Math.sin(azimuth),
		Math.cos(zenithAngle),
	]);
}

export function sampleFigure1SkyRadiance({
	scene,
	x,
	y,
	size = 320,
	includeSecondOrder = true,
}) {
	const direction = sampleFisheyeDirection({ x, y, size });

	if (!direction) {
		return null;
	}

	return computeSingleScatteringRadiance(
		observerPosition(),
		direction,
		sunDirection(scene),
		{
			scene,
			includeSecondOrder,
		}
	);
}

function fibonacciSphereIncomingDirections(sunRay) {
	const count = ATMOSPHERE.fibonacciSphereSecondOrderDirectionCount;
	const halfCount = Math.floor(count / 2);
	const goldenRatio = (1 + Math.sqrt(5)) / 2;
	const sunAxis = normalize(sunRay);
	const reference =
		Math.abs(dot(sunAxis, [0, 0, 1])) < 0.95 ? [0, 0, 1] : [0, 1, 0];
	const zAxis = normalize(
		addVectors(reference, scaleVector(sunAxis, -dot(reference, sunAxis)))
	);
	const yAxis = normalize(cross(zAxis, sunAxis));
	const directions = [];

	for (let index = -halfCount; index <= halfCount; index += 1) {
		const z = (2 * index) / count;
		const latitude = Math.asin(clamp(z, -1, 1));
		const longitude = (2 * Math.PI * index) / goldenRatio;
		const horizontalScale = Math.cos(latitude);
		const localX = horizontalScale * Math.cos(longitude);
		const localY = horizontalScale * Math.sin(longitude);
		const localZ = z;

		directions.push(
			normalize(
				addVectors(
					addVectors(scaleVector(sunAxis, localX), scaleVector(yAxis, localY)),
					scaleVector(zAxis, localZ)
				)
			)
		);
	}

	return directions;
}

function rayleighScatteringCoefficientAt(wavelengthMicrometers) {
	return ATMOSPHERE.rayleighCoefficientScale * wavelengthMicrometers ** -4;
}

function mieExtinctionCoefficientAt(wavelengthMicrometers) {
	return (
		(BRUNETON_2016_AEROSOL.mieAngstromBeta / ATMOSPHERE.mieScaleHeightMeters) *
		wavelengthMicrometers ** -BRUNETON_2016_AEROSOL.mieAngstromAlpha
	);
}

function mieScatteringCoefficientAt(wavelengthMicrometers) {
	return (
		mieExtinctionCoefficientAt(wavelengthMicrometers) *
		BRUNETON_2016_AEROSOL.mieSingleScatteringAlbedo
	);
}

function rayleighPhaseFunction(nu) {
	return (3 / (16 * Math.PI)) * (1 + nu * nu);
}

function miePhaseFunction(g, nu) {
	const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));

	return (k * (1 + nu * nu)) / (1 + g * g - 2 * g * nu) ** 1.5;
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

function addVectors(a, b) {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVector(vector, scalar) {
	return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function addScaled(origin, direction, distance) {
	return [
		origin[0] + direction[0] * distance,
		origin[1] + direction[1] * distance,
		origin[2] + direction[2] * distance,
	];
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
