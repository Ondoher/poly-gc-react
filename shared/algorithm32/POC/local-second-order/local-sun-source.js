const LOCAL_SUN_FORWARD_TIME_ROTATION_SIGN = 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const KM_PER_MILE = 1.609344;
export const MEAN_EARTH_RADIUS_KM = 6371.0088;
export const DEFAULT_FLAT_SIMULATION_TIME = '2026-05-22T00:00:00-07:00';
export const SUMMER_SOLSTICE_FLAT_SIMULATION_TIME = '2026-06-21T12:00:00-07:00';
export const DEFAULT_FLAT_SIMULATION_ROOT = Object.freeze({
	lat: 37.3382,
	lon: -121.8863,
	elevationMeters: 30.48,
});
export const FALSE_SUN_LATITUDE_MODEL = Object.freeze({
	type: 'annual-tropic-migration',
	northLimitDeg: 23.5,
	southLimitDeg: -23.5,
	northernSolsticeDayOfYear: 172,
	periodDays: 365.2422,
});
export const FALSE_SUN_LONGITUDE_DEGREES = 58.1137;
export const FALSE_SUN_ALTITUDE_KM = 3000 * KM_PER_MILE;
export const FALSE_SUN_RADIUS_KM = (32 * KM_PER_MILE) / 2;
export const FALSE_SUN_REFERENCE_DISTANCE_KM = 4800;
export const FALSE_SUN_TARGET_INCIDENT_SCALE_AT_CLOSEST = 1;
export const LOCAL_SUN_FORWARD_TIME_ORBIT_DIRECTION = 'clockwise';

/**
 * Resolve the accepted local Sun temporal context from a browser-lane payload.
 *
 * @param {object} payload - Browser command payload or equivalent options.
 * @param {object} options - Helper options for caller-specific defaults.
 * @returns {object} Serializable local/distant solar-time alignment context.
 */
export function createLocalSunTemporalContextFromPayload(
	payload = {},
	options = {}
) {
	const solsticeGalleryModes = Array.isArray(options.solsticeGalleryModes)
		? options.solsticeGalleryModes
		: [];
	const defaultSimulationTime =
		options.defaultSimulationTime ||
		(solsticeGalleryModes.includes(payload.galleryMode)
			? SUMMER_SOLSTICE_FLAT_SIMULATION_TIME
			: DEFAULT_FLAT_SIMULATION_TIME);
	const flatSimulationTime =
		payload.flatSimulationTime ||
		payload.simulationTime ||
		payload.workingTime ||
		defaultSimulationTime;
	const solarClock = solarClockForFlatSimulationTime(flatSimulationTime);
	const localSolarNoonMinutes = clockMinutesFromValue(
		payload.localSolarNoonTime,
		solarClock.solarNoonLocalMinutes
	);

	return {
		kind: 'local-distant-solar-time-alignment',
		flatSimulationTime,
		workingDateLabel: workingDateLabelFromTime(flatSimulationTime),
		localSolarNoonMinutes,
		localSolarNoonLabel: formatClockMinutes(localSolarNoonMinutes),
		solarClock,
		rotationDegreesPerHour: 15,
		policy:
			'Local closest approach is aligned with spherical distant solar noon, defined here as the date/location transit when the spherical Sun reaches maximum altitude; positive local source orbit degrees advance local solar time at 15 degrees per hour.',
	};
}

/**
 * Preserve the source-matrix name used by the accepted browser POC lane.
 *
 * @param {object} payload - Browser command payload or equivalent options.
 * @param {object} options - Helper options for caller-specific defaults.
 * @returns {object} Serializable local/distant solar-time alignment context.
 */
export function sourceMatrixTemporalContextFromPayload(payload = {}, options = {}) {
	return createLocalSunTemporalContextFromPayload(payload, options);
}

export function solarClockForFlatSimulationTime(time) {
	const dayOfYear = calendarDayOfYear(time);
	const equationOfTimeMinutes = equationOfTimeMinutesForDay(dayOfYear);
	const timezoneOffsetMinutes = timezoneOffsetMinutesFromIsoTime(time);
	const solarNoonLocalMinutes =
		720 -
		4 * DEFAULT_FLAT_SIMULATION_ROOT.lon +
		timezoneOffsetMinutes -
		equationOfTimeMinutes;

	return {
		kind: 'approximate-local-solar-clock',
		dayOfYear,
		timezoneOffsetMinutes,
		equationOfTimeMinutes,
		solarNoonLocalMinutes: normalizeClockMinutes(solarNoonLocalMinutes),
		solarNoonPolicy:
			'NOAA-style equation-of-time approximation; solar noon is local transit, not civil 12:00.',
	};
}

export function equationOfTimeMinutesForDay(dayOfYear) {
	const gamma = (2 * Math.PI * (dayOfYear - 1)) / 365;
	return (
		229.18 *
		(0.000075 +
			0.001868 * Math.cos(gamma) -
			0.032077 * Math.sin(gamma) -
			0.014615 * Math.cos(2 * gamma) -
			0.040849 * Math.sin(2 * gamma))
	);
}

export function timezoneOffsetMinutesFromIsoTime(time) {
	const match = /([+-])(\d{2}):?(\d{2})$/.exec(String(time || ''));
	if (!match) {
		return 0;
	}
	const sign = match[1] === '-' ? -1 : 1;
	return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export function clockMinutesFromValue(value, fallbackMinutes) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return normalizeClockMinutes(value);
	}
	const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
	if (!match) {
		return normalizeClockMinutes(fallbackMinutes);
	}
	return normalizeClockMinutes(Number(match[1]) * 60 + Number(match[2]));
}

export function normalizeClockMinutes(minutes) {
	return ((Math.round(minutes) % 1440) + 1440) % 1440;
}

export function localSolarTimeForOffsetDegrees(offsetDegrees, context) {
	const elapsedMinutes = (Number(offsetDegrees) || 0) * 4;
	const absoluteMinutes = context.localSolarNoonMinutes + elapsedMinutes;
	const dayOffset = Math.floor(absoluteMinutes / 1440);
	const normalizedMinutes = normalizeClockMinutes(absoluteMinutes);

	return {
		kind: 'local-solar-time',
		minutesAfterNoon: elapsedMinutes,
		dayOffset,
		label: `${formatClockMinutes(normalizedMinutes)}${dayOffset > 0 ? ' +1d' : ''}`,
		noonLabel: context.localSolarNoonLabel,
		policy:
			'The false Sun completes 360 degrees in 24 hours, so each positive 15-degree local orbit offset is one hour forward from closest approach.',
	};
}

export function formatClockMinutes(minutes) {
	const normalized = normalizeClockMinutes(minutes);
	const hours = Math.floor(normalized / 60);
	const mins = normalized % 60;
	return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function workingDateLabelFromTime(time) {
	const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(time || ''));
	return match ? match[1] : String(time || '');
}

export function makeFlatLocalSunSourcePacket(
	offsetDegrees,
	sourceMatrixContext = createLocalSunTemporalContextFromPayload()
) {
	const selected = flatLocalSunSourceDefinition(offsetDegrees, sourceMatrixContext);

	return {
		kind: 'flat-local-point-sun',
		id: selected.id,
		sunCase: selected.id,
		sceneKey: selected.id,
		flatSceneKey: selected.flatSceneKey,
		offsetDegrees,
		role: selected.role,
		positionMeters: selected.positionMeters,
		observerPositionMeters: [0, 0, 2],
		radiusKm: FALSE_SUN_RADIUS_KM,
		referenceDistanceKm: FALSE_SUN_REFERENCE_DISTANCE_KM,
		referenceSpectralIncidentScale: selected.referenceSpectralIncidentScale,
		observerIncidentScale: selected.observerIncidentScale,
		distanceFalloff: true,
		color: { r: 1, g: 0.98, b: 0.95 },
		skyPosition: selected.skyPosition,
		provenance: {
			sourceArtifact:
				'flat app false Sun annual tropic-migration source configuration',
			sourceLatitudeDegrees: selected.sourceLatitudeDegrees,
			sourceLongitudeDegrees: selected.sourceLongitudeDegrees,
			latitudeModel: selected.latitudeModel,
			latitudeResolvedAt: selected.latitudeResolvedAt,
			orbitDirection: selected.orbitDirection,
			offsetSemantic: selected.offsetSemantic,
			localSolarTime: selected.localSolarTime,
			workingDateLabel: selected.workingDateLabel,
			skyPosition: selected.skyPosition,
			brightnessCalibration:
				'match-distant-solar-noon-unit-incident-scale-at-closest-approach',
		},
	};
}

export function flatLocalSunSourceDefinition(
	offsetDegrees,
	sourceMatrixContext = createLocalSunTemporalContextFromPayload()
) {
	const normalizedOffset = Number.isFinite(Number(offsetDegrees))
		? Number(offsetDegrees)
		: 0;
	const sourceState = flatLocalSunOrbitState(
		normalizedOffset,
		sourceMatrixContext
	);
	const closestState = flatLocalSunOrbitState(0, sourceMatrixContext);
	const closestFalloff =
		(FALSE_SUN_REFERENCE_DISTANCE_KM / closestState.distanceKm) ** 2;
	const referenceSpectralIncidentScale =
		FALSE_SUN_TARGET_INCIDENT_SCALE_AT_CLOSEST / closestFalloff;
	const observerIncidentScale =
		referenceSpectralIncidentScale *
		(FALSE_SUN_REFERENCE_DISTANCE_KM / sourceState.distanceKm) ** 2;
	const label = rotationOffsetLabel(normalizedOffset);
	const sourceDateKey = sourceDateKeyFromTime(
		sourceMatrixContext.flatSimulationTime
	);

	return {
		id: `san-jose-${label}-${sourceDateKey}-annual-tropic-migration-algorithm32-flat-cap-first-order`,
		flatSceneKey: `san-jose-${label}-${sourceDateKey}`,
		role:
			normalizedOffset === 0
				? 'closest-approach'
				: `${normalizedOffset}-degree-orbit-offset`,
		positionMeters: sourceState.algorithmPositionMeters,
		observerIncidentScale,
		referenceSpectralIncidentScale,
		sourceLatitudeDegrees: sourceState.sourceLatitudeDegrees,
		sourceLongitudeDegrees: sourceState.sourceLongitudeDegrees,
		orbitDirection: sourceState.orbitDirection,
		offsetSemantic: sourceState.offsetSemantic,
		latitudeModel: sourceState.latitudeModel,
		latitudeResolvedAt: sourceState.latitudeResolvedAt,
		sourceRingRadiusKm: sourceState.sourceRingRadiusKm,
		distanceKm: sourceState.distanceKm,
		localSolarTime: sourceState.localSolarTime,
		workingDateLabel: sourceState.workingDateLabel,
		skyPosition: sourceState.skyPosition,
	};
}

export function flatLocalSunOrbitState(
	offsetDegrees,
	sourceMatrixContext = createLocalSunTemporalContextFromPayload()
) {
	const sourceLatitudeDegrees = falseSunLatitudeDegreesForTime(
		sourceMatrixContext.flatSimulationTime
	);
	const observerScenePositionMeters = projectNorthPoleAeScenePositionMeters({
		lat: DEFAULT_FLAT_SIMULATION_ROOT.lat,
		lon: DEFAULT_FLAT_SIMULATION_ROOT.lon,
		elevationMeters: DEFAULT_FLAT_SIMULATION_ROOT.elevationMeters,
	});
	const initialSunScenePositionMeters = projectNorthPoleAeScenePositionMeters({
		lat: sourceLatitudeDegrees,
		lon: FALSE_SUN_LONGITUDE_DEGREES,
		elevationMeters: FALSE_SUN_ALTITUDE_KM * 1000,
	});
	const closestRotationAngleRad = closestHorizontalApproachRotationRad(
		initialSunScenePositionMeters,
		observerScenePositionMeters
	);
	const sourceScenePositionMeters = rotateAroundFlatSceneUp(
		initialSunScenePositionMeters,
		closestRotationAngleRad +
			LOCAL_SUN_FORWARD_TIME_ROTATION_SIGN * degreesToRadians(offsetDegrees)
	);
	const localScenePositionMeters = [
		sourceScenePositionMeters[0] - observerScenePositionMeters[0],
		sourceScenePositionMeters[1],
		sourceScenePositionMeters[2] - observerScenePositionMeters[2],
	];
	const algorithmPositionMeters = [
		localScenePositionMeters[0],
		localScenePositionMeters[2],
		localScenePositionMeters[1],
	];
	const skyPosition = flatLocalSkyPosition({
		algorithmPositionMeters,
		localScenePositionMeters,
		observerScenePositionMeters,
	});
	const distanceKm =
		Math.hypot(
			algorithmPositionMeters[0],
			algorithmPositionMeters[1],
			algorithmPositionMeters[2] - 2
		) / 1000;

	return {
		algorithmPositionMeters,
		distanceKm,
		sourceLatitudeDegrees,
		sourceLongitudeDegrees: longitudeDegreesFromScenePosition(
			sourceScenePositionMeters
		),
		orbitDirection: LOCAL_SUN_FORWARD_TIME_ORBIT_DIRECTION,
		offsetSemantic:
			'positive subjective local-source degrees are forward solar time from closest approach',
		sourceRingRadiusKm:
			Math.hypot(sourceScenePositionMeters[0], sourceScenePositionMeters[2]) /
			1000,
		latitudeModel: FALSE_SUN_LATITUDE_MODEL,
		latitudeResolvedAt: sourceMatrixContext.flatSimulationTime,
		localSolarTime: localSolarTimeForOffsetDegrees(
			offsetDegrees,
			sourceMatrixContext
		),
		workingDateLabel: sourceMatrixContext.workingDateLabel,
		skyPosition,
	};
}

export function flatLocalSkyPosition({
	algorithmPositionMeters,
	localScenePositionMeters,
	observerScenePositionMeters,
}) {
	const sourceAltitudeMeters = algorithmPositionMeters[2] - 2;
	const horizontalDistanceMeters = Math.hypot(
		algorithmPositionMeters[0],
		algorithmPositionMeters[1]
	);
	const observerLonRad = Math.atan2(
		observerScenePositionMeters[0],
		observerScenePositionMeters[2]
	);
	const east = [Math.cos(observerLonRad), -Math.sin(observerLonRad)];
	const north = [-Math.sin(observerLonRad), -Math.cos(observerLonRad)];
	const flatVector = [localScenePositionMeters[0], localScenePositionMeters[2]];
	const eastComponent = flatVector[0] * east[0] + flatVector[1] * east[1];
	const northComponent =
		flatVector[0] * north[0] + flatVector[1] * north[1];

	return {
		kind: 'local-sky-position',
		azimuthDegrees: normalizeDegrees(
			radiansToDegrees(Math.atan2(eastComponent, northComponent))
		),
		altitudeDegrees: radiansToDegrees(
			Math.atan2(sourceAltitudeMeters, horizontalDistanceMeters)
		),
		azimuthConvention:
			'degrees clockwise from local north in the flat observer tangent frame',
	};
}

export function sourceDateKeyFromTime(time) {
	return workingDateLabelFromTime(time).replace(/[^0-9]/g, '') || 'undated';
}

export function falseSunLatitudeDegreesForTime(time) {
	const northLimitDeg = FALSE_SUN_LATITUDE_MODEL.northLimitDeg;
	const southLimitDeg = FALSE_SUN_LATITUDE_MODEL.southLimitDeg;
	const amplitudeDeg = (northLimitDeg - southLimitDeg) / 2;
	const centerDeg = (northLimitDeg + southLimitDeg) / 2;
	const phase =
		(2 *
			Math.PI *
			(calendarDayOfYear(time) -
				FALSE_SUN_LATITUDE_MODEL.northernSolsticeDayOfYear)) /
		Math.max(FALSE_SUN_LATITUDE_MODEL.periodDays, 1);

	return centerDeg + amplitudeDeg * Math.cos(phase);
}

export function calendarDayOfYear(time) {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(time));
	if (!match) {
		return FALSE_SUN_LATITUDE_MODEL.northernSolsticeDayOfYear;
	}
	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	const day = Number(match[3]);
	const start = Date.UTC(year, 0, 1);
	const current = Date.UTC(year, monthIndex, day);
	return Math.floor((current - start) / MS_PER_DAY) + 1;
}

export function projectNorthPoleAeScenePositionMeters({
	lat,
	lon,
	elevationMeters,
}) {
	const latRad = degreesToRadians(lat);
	const lonRad = degreesToRadians(lon);
	const radiusMeters = MEAN_EARTH_RADIUS_KM * 1000 * (Math.PI / 2 - latRad);

	return [
		radiusMeters * Math.sin(lonRad),
		elevationMeters,
		radiusMeters * Math.cos(lonRad),
	];
}

export function closestHorizontalApproachRotationRad(
	sourcePosition,
	observerPosition
) {
	const sourceHorizontalLength = Math.hypot(sourcePosition[0], sourcePosition[2]);
	const observerHorizontalLength = Math.hypot(
		observerPosition[0],
		observerPosition[2]
	);
	if (sourceHorizontalLength === 0 || observerHorizontalLength === 0) {
		return 0;
	}
	const aligned =
		observerPosition[0] * sourcePosition[0] +
		observerPosition[2] * sourcePosition[2];
	const crossY =
		observerPosition[0] * sourcePosition[2] -
		observerPosition[2] * sourcePosition[0];

	return ((Math.atan2(crossY, aligned) % (Math.PI * 2)) + Math.PI * 2) %
		(Math.PI * 2);
}

export function rotateAroundFlatSceneUp(position, angleRad) {
	const rotationCos = Math.cos(angleRad);
	const rotationSin = Math.sin(angleRad);

	return [
		position[0] * rotationCos + position[2] * rotationSin,
		position[1],
		-position[0] * rotationSin + position[2] * rotationCos,
	];
}

export function longitudeDegreesFromScenePosition(position) {
	return Math.atan2(position[0], position[2]) * (180 / Math.PI);
}

export function rotationOffsetLabel(degrees) {
	if (Math.abs(degrees) < 1e-9) {
		return '000deg-closest';
	}
	const sign = degrees < 0 ? 'minus' : 'plus';
	const magnitude = Math.abs(degrees).toFixed(3).replace('.', 'p');
	return `${sign}-${magnitude}deg-from-closest`;
}

function degreesToRadians(degrees) {
	return (Number(degrees) || 0) * (Math.PI / 180);
}

function radiansToDegrees(radians) {
	return (Number(radians) || 0) * (180 / Math.PI);
}

function normalizeDegrees(degrees) {
	return ((degrees % 360) + 360) % 360;
}
