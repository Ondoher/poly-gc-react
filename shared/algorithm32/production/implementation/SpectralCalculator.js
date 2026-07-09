import VectorMath from '../utils/VectorMath.js';

/**
 * Own reusable spectral radiance calculations shared by Reference evaluation
 * and incident-radiance cache building.
 */
export class SpectralCalculator {
	/**
	 * Create a spectral calculator from stable calculation collaborators.
	 *
	 * @param {SpectralCalculatorDependencies} [dependencies] - Supplies
	 * geometry, atmosphere, light-source, spectral, and execution facts.
	 */
	constructor(dependencies = {}) {
		this._dependencies = Object.freeze({ ...dependencies });
	}

	/**
	 * Return the stable calculation dependencies.
	 *
	 * @returns {SpectralCalculatorDependencies} The calculator dependencies.
	 */
	get dependencies() {
		return this._dependencies;
	}

	/**
	 * Build endpoint/trapezoid integration points for a geometry-resolved
	 * finite ray segment.
	 *
	 * @param {RaySegment} viewRaySegment - Supplies the geometry-resolved ray
	 * segment.
	 * @param {number} pathIntervalCount - Supplies the number of uniform path
	 * intervals.
	 * @returns {readonly PathIntegrationPoint[]} The path integration points.
	 */
	buildEndpointTrapezoidPathIntegrationPoints(viewRaySegment, pathIntervalCount) {
		this._assertRaySegment(viewRaySegment);

		if (!Number.isInteger(pathIntervalCount) || pathIntervalCount < 1) {
			throw new RangeError('pathIntervalCount must be a positive integer.');
		}

		const { startDistanceMeters, endDistanceMeters } = viewRaySegment;

		if (endDistanceMeters < startDistanceMeters) {
			throw new RangeError('RaySegment endDistanceMeters must be greater than or equal to startDistanceMeters.');
		}

		const intervalLengthMeters = (endDistanceMeters - startDistanceMeters) / pathIntervalCount;
		const points = [];

		for (let pointIndex = 0; pointIndex <= pathIntervalCount; pointIndex += 1) {
			const isEndpoint = pointIndex === 0 || pointIndex === pathIntervalCount;
			const trapezoidWeight = isEndpoint ? 0.5 : 1;

			points.push(Object.freeze({
				pointIndex,
				distanceAlongRayMeters: startDistanceMeters + intervalLengthMeters * pointIndex,
				intervalLengthFromPreviousMeters: pointIndex === 0 ? 0 : intervalLengthMeters,
				trapezoidWeight,
				measureMeters: intervalLengthMeters * trapezoidWeight,
			}));
		}

		return Object.freeze(points);
	}

	/**
	 * Compute path radiance over one geometry-resolved ray segment.
	 *
	 * @param {RaySegment} viewRaySegment - Supplies the geometry-resolved ray
	 * segment.
	 * @param {readonly PathIntegrationPoint[]} pathIntegrationPoints - Supplies
	 * the prebuilt integration schedule.
	 * @param {ComputeRadianceOptions} [options] - Supplies operation-specific
	 * optional inputs.
	 * @returns {PathRadiance} The path radiance result.
	 */
	computeRadiance(viewRaySegment, pathIntegrationPoints, options = {}) {
		this._assertRaySegment(viewRaySegment);
		this._assertPathIntegrationPoints(pathIntegrationPoints);

		const { geometry, atmosphere, lightSource, spectralBasis, executionControls } = this.dependencies;
		this._assertCollaborators({ geometry, atmosphere, lightSource, spectralBasis });

		const channelCount = this._getSpectralChannelCount(spectralBasis);
		const inScattered = zeroSpectral(channelCount);
		let viewTransmittance = oneSpectral(channelCount);
		let previousMedium = null;

		for (const point of pathIntegrationPoints) {
			const position = this._addScaled(viewRaySegment.ray.origin, viewRaySegment.ray.direction, point.distanceAlongRayMeters);
			const atmosphereCoordinate = geometry.resolveAtmosphereCoordinate(position);
			const medium = atmosphere.sampleMedium(atmosphereCoordinate);

			if (previousMedium) {
				const segmentTransmittance = this.computeTrapezoidSegmentTransmittance(
					previousMedium.extinction,
					medium.extinction,
					point.intervalLengthFromPreviousMeters,
				);
				viewTransmittance = multiplySpectral(viewTransmittance, segmentTransmittance);
			}

			const sourceRelativePosition = geometry.resolveSourceRelativePosition({
				position,
				atmosphereCoordinate,
				viewDirection: viewRaySegment.ray.direction,
			});
			const directLighting = lightSource.sampleDirectLighting({
				sourceRelativePosition,
				atmosphereCoordinate,
				spectralBasis,
			});
			const sourcePathLimit = lightSource.resolveSourcePathLimit({
				sourceRelativePosition,
				directLighting,
			});
			const sourceAtmospherePath = geometry.resolveAtmospherePath({
				startPosition: position,
				direction: directLighting.directionToLight,
				sourcePathLimit,
				sampleCount: executionControls?.sourceTransmittanceIntervalCount,
			});
			const sourceOpticalDepth = atmosphere.integrateOpticalDepth(sourceAtmospherePath);
			const sourceTransmittance = directLighting.sourceTransmittance
				?? sourceOpticalDepth.transmittance
				?? this.computeSourceTransmittance(sourceOpticalDepth.opticalDepth);
			const directPhase = atmosphere.samplePhase({
				viewDirection: viewRaySegment.ray.direction,
				incomingDirection: directLighting.directionToLight,
			});
			const directScatteringCoefficient = this.computeDirectScattering(
				medium.rayleighScattering,
				medium.mieScattering,
				directPhase.rayleighPhase,
				directPhase.miePhase,
			);
			const directInScattering = this.computeDirectInScattering(
				viewTransmittance,
				sourceTransmittance,
				directLighting.incidentRadiance,
				directScatteringCoefficient,
				point.measureMeters,
			);
			const incidentInScattering = this._computeIncidentInScattering({
				incidentRadianceSampling: options.incidentRadianceSampling,
				geometry,
				atmosphere,
				position,
				atmosphereCoordinate,
				sourceRelativePosition,
				viewDirection: viewRaySegment.ray.direction,
				medium,
				viewTransmittance,
				measureMeters: point.measureMeters,
			});

			addInto(inScattered, directInScattering);
			addInto(inScattered, incidentInScattering);
			previousMedium = medium;
		}

		return Object.freeze({
			inScattered: Object.freeze(inScattered),
			transmittance: Object.freeze(viewTransmittance),
		});
	}

	/**
	 * Compute source-path transmittance from source optical depth.
	 *
	 * @param {SpectralValue} sourceOpticalDepth - Supplies source optical depth.
	 * @returns {SpectralValue} The source transmittance.
	 */
	computeSourceTransmittance(sourceOpticalDepth) {
		// Beer-Lambert attenuation converts optical depth to transmittance. [1]
		return Object.freeze(sourceOpticalDepth.map((value) => Math.exp(-value)));
	}

	/**
	 * Compute endpoint/trapezoid transmittance for one view-path segment.
	 *
	 * @param {SpectralValue} previousTotalExtinctionCoefficient - Supplies the
	 * previous point extinction.
	 * @param {SpectralValue} currentTotalExtinctionCoefficient - Supplies the
	 * current point extinction.
	 * @param {number} intervalLengthMeters - Supplies the interval length.
	 * @returns {SpectralValue} The segment transmittance.
	 */
	computeTrapezoidSegmentTransmittance(
		previousTotalExtinctionCoefficient,
		currentTotalExtinctionCoefficient,
		intervalLengthMeters,
	) {
		this._assertSameLength(previousTotalExtinctionCoefficient, currentTotalExtinctionCoefficient);

		// Optical depth over the segment uses the endpoint/trapezoid average
		// extinction coefficient before Beer-Lambert attenuation. [1]
		return Object.freeze(previousTotalExtinctionCoefficient.map((previous, index) =>
			Math.exp(-0.5 * (previous + currentTotalExtinctionCoefficient[index]) * intervalLengthMeters)));
	}

	/**
	 * Combine Rayleigh and Mie scattering coefficients with phase values.
	 *
	 * @param {SpectralValue} rayleighScatteringCoefficient - Supplies Rayleigh
	 * scattering coefficients.
	 * @param {SpectralValue} mieScatteringCoefficient - Supplies Mie scattering
	 * coefficients.
	 * @param {number} rayleighPhase - Supplies the Rayleigh phase scalar.
	 * @param {number} miePhase - Supplies the Mie phase scalar.
	 * @returns {SpectralValue} The phase-weighted scattering coefficient.
	 */
	computeDirectScattering(
		rayleighScatteringCoefficient,
		mieScatteringCoefficient,
		rayleighPhase,
		miePhase,
	) {
		this._assertSameLength(rayleighScatteringCoefficient, mieScatteringCoefficient);

		// Volume in-scattering applies phase-weighted scattering coefficients. [2][3]
		return Object.freeze(rayleighScatteringCoefficient.map((rayleigh, index) =>
			rayleigh * rayleighPhase + mieScatteringCoefficient[index] * miePhase));
	}

	/**
	 * Compute direct light-source in-scattering for one path point.
	 *
	 * @param {SpectralValue} viewTransmittance - Supplies observer-to-sample
	 * transmittance.
	 * @param {SpectralValue} sourceTransmittance - Supplies sample-to-source
	 * transmittance.
	 * @param {SpectralValue} sourceRadiance - Supplies source spectral radiance.
	 * @param {SpectralValue} directScatteringCoefficient - Supplies
	 * phase-weighted scattering coefficient.
	 * @param {number} measureMeters - Supplies effective sample path length.
	 * @returns {SpectralValue} The direct in-scattering contribution.
	 */
	computeDirectInScattering(
		viewTransmittance,
		sourceTransmittance,
		sourceRadiance,
		directScatteringCoefficient,
		measureMeters,
	) {
		this._assertSameLength(viewTransmittance, sourceTransmittance);
		this._assertSameLength(sourceRadiance, directScatteringCoefficient);

		// Single-scattering in-scattering multiplies view survival, source-path
		// survival, source radiance, phase-weighted scattering, and path
		// measure. [2][3]
		return Object.freeze(viewTransmittance.map((viewT, index) =>
			viewT
			* sourceTransmittance[index]
			* sourceRadiance[index]
			* directScatteringCoefficient[index]
			* measureMeters));
	}

	/**
	 * Compute collapsed higher-order incident in-scattering for one path point.
	 *
	 * @param {SpectralValue} viewTransmittance - Supplies observer-to-sample
	 * transmittance.
	 * @param {SpectralValue} collapsedIncidentRadiance - Supplies collapsed
	 * incident radiance.
	 * @param {SpectralValue} totalScatteringCoefficient - Supplies scattering
	 * coefficient.
	 * @param {number} measureMeters - Supplies effective sample path length.
	 * @returns {SpectralValue} The incident in-scattering contribution.
	 */
	computeCollapsedIncidentInScattering(
		viewTransmittance,
		collapsedIncidentRadiance,
		totalScatteringCoefficient,
		measureMeters,
	) {
		this._assertSameLength(viewTransmittance, collapsedIncidentRadiance);
		this._assertSameLength(collapsedIncidentRadiance, totalScatteringCoefficient);

		// Higher-order incident radiance contributes through the same
		// volume-scattering in-scattering structure. [2]
		return Object.freeze(viewTransmittance.map((viewT, index) =>
			viewT * collapsedIncidentRadiance[index] * totalScatteringCoefficient[index] * measureMeters));
	}

	/**
	 * Compute directional incident in-scattering for sampled incoming
	 * directions.
	 *
	 * @param {UnitVector3} viewDirection - Supplies the evaluated ray direction.
	 * @param {readonly IncidentRadianceSample[]} directionalIncidentSamples -
	 * Supplies incident radiance samples.
	 * @param {AtmosphereModel} atmosphere - Supplies the phase sampler.
	 * @param {SpectralValue} rayleighScatteringCoefficient - Supplies Rayleigh
	 * scattering coefficients.
	 * @param {SpectralValue} mieScatteringCoefficient - Supplies Mie scattering
	 * coefficients.
	 * @param {SpectralValue} viewTransmittance - Supplies observer-to-sample
	 * transmittance.
	 * @param {number} measureMeters - Supplies effective sample path length.
	 * @returns {SpectralValue} The directional incident in-scattering
	 * contribution.
	 */
	computeDirectionalIncidentInScatteringFromSamples(
		viewDirection,
		directionalIncidentSamples,
		atmosphere,
		rayleighScatteringCoefficient,
		mieScatteringCoefficient,
		viewTransmittance,
		measureMeters,
	) {
		const result = zeroSpectral(viewTransmittance.length);

		for (const sample of directionalIncidentSamples) {
			const phase = atmosphere.samplePhase({
				viewDirection,
				incomingDirection: sample.incomingDirection,
			});
			const scattering = this.computeDirectScattering(
				rayleighScatteringCoefficient,
				mieScatteringCoefficient,
				phase.rayleighPhase,
				phase.miePhase,
			);

			for (let channelIndex = 0; channelIndex < result.length; channelIndex += 1) {
				result[channelIndex] += viewTransmittance[channelIndex]
					* sample.radiance[channelIndex]
					* scattering[channelIndex]
					* sample.weight
					* measureMeters;
			}
		}

		return Object.freeze(result);
	}

	/**
	 * Resolve the scalar channel count from a production spectral basis packet.
	 *
	 * @param {SpectralBasis} spectralBasis - Supplies the spectral basis.
	 * @returns {number} The channel count.
	 */
	_getSpectralChannelCount(spectralBasis) {
		if (Array.isArray(spectralBasis?.wavelengths)) {
			return spectralBasis.wavelengths.length;
		}

		throw new TypeError('Spectral basis must provide wavelength samples.');
	}

	/**
	 * Convert a production position packet or tuple into a numeric tuple and add
	 * a scaled direction.
	 *
	 * @param {Position | readonly [number, number, number]} origin - Supplies
	 * the ray origin.
	 * @param {UnitVector3} direction - Supplies the ray direction.
	 * @param {number} scale - Supplies the scale in meters.
	 * @returns {readonly [number, number, number]} The calculated tuple.
	 */
	_addScaled(origin, direction, scale) {
		const originTuple = Array.isArray(origin) ? origin : origin.coordinates;

		return VectorMath.addScaled(originTuple, direction, scale);
	}

	/**
	 * Assert that a ray segment has the shape needed for transport.
	 *
	 * @param {RaySegment} raySegment - Supplies the candidate ray segment.
	 * @returns {void}
	 */
	_assertRaySegment(raySegment) {
		if (!raySegment || typeof raySegment !== 'object') {
			throw new TypeError('RaySegment must be an object.');
		}

		const { ray, startDistanceMeters, endDistanceMeters } = raySegment;
		const origin = ray?.origin;
		const originTuple = Array.isArray(origin) ? origin : origin?.coordinates;

		if (!ray || !Array.isArray(originTuple) || !Array.isArray(ray.direction)) {
			throw new TypeError('RaySegment.ray must include origin and direction tuples.');
		}

		if (originTuple.length !== 3 || ray.direction.length !== 3) {
			throw new TypeError('Ray origin and direction must be three-component tuples.');
		}

		if (![...originTuple, ...ray.direction, startDistanceMeters, endDistanceMeters].every(Number.isFinite)) {
			throw new TypeError('RaySegment values must be finite numbers.');
		}
	}

	/**
	 * Assert that required collaborators are present.
	 *
	 * @param {Record<string, unknown>} collaborators - Supplies collaborators
	 * by name.
	 * @returns {void}
	 */
	_assertCollaborators(collaborators) {
		for (const [name, collaborator] of Object.entries(collaborators)) {
			if (!collaborator) {
				throw new TypeError(`SpectralCalculator requires ${name} to compute radiance.`);
			}
		}
	}

	/**
	 * Assert that path integration points are usable.
	 *
	 * @param {readonly PathIntegrationPoint[]} points - Supplies candidate
	 * points.
	 * @returns {void}
	 */
	_assertPathIntegrationPoints(points) {
		if (!Array.isArray(points) || points.length < 1) {
			throw new TypeError('Path integration points must be a non-empty array.');
		}

		for (const point of points) {
			if (
				!Number.isInteger(point.pointIndex)
				|| !Number.isFinite(point.distanceAlongRayMeters)
				|| !Number.isFinite(point.intervalLengthFromPreviousMeters)
				|| !Number.isFinite(point.measureMeters)
			) {
				throw new TypeError('Path integration points must contain finite point fields.');
			}
		}
	}

	/**
	 * Assert that two spectral arrays have matching lengths.
	 *
	 * @param {SpectralValue} first - Supplies the first spectral array.
	 * @param {SpectralValue} second - Supplies the second spectral array.
	 * @returns {void}
	 */
	_assertSameLength(first, second) {
		if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) {
			throw new TypeError('Spectral values must be arrays with matching lengths.');
		}
	}

	/**
	 * Compute incident in-scattering for one path point.
	 *
	 * @param {object} request - Supplies incident sampling context.
	 * @returns {SpectralValue} The incident in-scattering contribution.
	 */
	_computeIncidentInScattering(request) {
		const { incidentRadianceSampling } = request;

		if (incidentRadianceSampling == null) {
			return zeroSpectral(request.viewTransmittance.length);
		}

		const cacheAccess = request.geometry.resolveCacheAccess({
			position: request.position,
			atmosphereCoordinate: request.atmosphereCoordinate,
			sourceRelativePosition: request.sourceRelativePosition,
			viewDirection: request.viewDirection,
		});
		const samples = incidentRadianceSampling.incidentRadianceSampler(cacheAccess);

		if (!samples || samples.length === 0) {
			return zeroSpectral(request.viewTransmittance.length);
		}

		return this.computeDirectionalIncidentInScatteringFromSamples(
			request.viewDirection,
			samples,
			request.atmosphere,
			request.medium.rayleighScattering,
			request.medium.mieScattering,
			request.viewTransmittance,
			request.measureMeters,
		);
	}
}

/**
 * Create a zero-filled spectral array.
 *
 * @param {number} channelCount - Supplies the channel count.
 * @returns {number[]} The zero spectral array.
 */
function zeroSpectral(channelCount) {
	return Array.from({ length: channelCount }, () => 0);
}

/**
 * Create a one-filled spectral array.
 *
 * @param {number} channelCount - Supplies the channel count.
 * @returns {readonly number[]} The one spectral array.
 */
function oneSpectral(channelCount) {
	return Object.freeze(Array.from({ length: channelCount }, () => 1));
}

/**
 * Multiply spectral arrays channel by channel.
 *
 * @param {SpectralValue} first - Supplies the first spectral array.
 * @param {SpectralValue} second - Supplies the second spectral array.
 * @returns {SpectralValue} The multiplied spectral array.
 */
function multiplySpectral(first, second) {
	return Object.freeze(first.map((value, index) => value * second[index]));
}

/**
 * Add source values into target values.
 *
 * @param {number[]} target - Supplies the target array.
 * @param {SpectralValue} source - Supplies the source array.
 * @returns {void}
 */
function addInto(target, source) {
	for (let index = 0; index < target.length; index += 1) {
		target[index] += source[index];
	}
}

export default SpectralCalculator;
