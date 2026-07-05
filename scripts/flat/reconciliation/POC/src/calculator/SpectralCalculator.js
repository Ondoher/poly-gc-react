// References:
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, Ray/path and calculator contract.
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.1.
// - agents/topics/apps/flat/algorithm32/conclusions.md, accepted transport equations and invariants.

import { addScaled } from '../math/vector.js';

export default class SpectralCalculator {
    /**
     * @param {SpectralCalculatorConfig} [configuration] - Stable collaborators for calculation helpers.
     */
    constructor(configuration = {}) {
        this._configuration = Object.freeze({ ...configuration });
    }

    get configuration() {
        return this._configuration;
    }

    /**
     * @param {RaySegment} viewRaySegment - Geometry-resolved finite ray segment.
     * @param {number} pathIntervalCount - Number of uniform intervals to split the segment into.
     * @returns {readonly PathIntegrationPoint[]} Endpoint/trapezoid integration-point schedule.
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
     * @param {RaySegment} viewRaySegment - Geometry-resolved finite ray segment.
     * @param {readonly PathIntegrationPoint[]} pathIntegrationPoints - Prebuilt integration schedule.
     * @param {ComputeRadianceOptions} [options] - Operation-specific optional inputs.
     * @returns {PathRadiance} Path radiance output.
     */
    computeRadiance(viewRaySegment, pathIntegrationPoints, options = {}) {
        this._assertRaySegment(viewRaySegment);
        this._assertPathIntegrationPoints(pathIntegrationPoints);

        const { geometry, atmosphere, lightSource, spectralBasis, executionControls } = this._configuration;

        this._assertCollaborators({ geometry, atmosphere, lightSource, spectralBasis });

        const channelCount = spectralBasis.wavelengthsNanometers.length;
        const inScattered = zeroSpectral(channelCount);
        let viewTransmittance = oneSpectral(channelCount);
        let previousMedium = null;
        const sampleDiagnostics = [];

        for (const point of pathIntegrationPoints) {
            const position = addScaled(
                viewRaySegment.ray.origin,
                viewRaySegment.ray.direction,
                point.distanceAlongRayMeters,
            );
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

            sampleDiagnostics.push(Object.freeze({
                pointIndex: point.pointIndex,
                altitudeMeters: atmosphereCoordinate.altitudeMeters,
                measureMeters: point.measureMeters,
                meanViewTransmittance: mean(viewTransmittance),
                meanDirectInScattering: mean(directInScattering),
                meanIncidentInScattering: mean(incidentInScattering),
            }));

            previousMedium = medium;
        }

        return Object.freeze({
            inScattered: Object.freeze(inScattered),
            transmittance: Object.freeze(viewTransmittance),
            diagnostics: Object.freeze({
                sampleCount: pathIntegrationPoints.length,
                samples: Object.freeze(sampleDiagnostics),
            }),
        });
    }

    /**
     * @param {SpectralValue} sourceOpticalDepth - Source optical depth.
     * @returns {SpectralValue} Source transmittance.
     */
    computeSourceTransmittance(sourceOpticalDepth) {
        return Object.freeze(sourceOpticalDepth.map((value) => Math.exp(-value)));
    }

    /**
     * @param {SpectralValue} previousTotalExtinctionCoefficient - Previous extinction.
     * @param {SpectralValue} currentTotalExtinctionCoefficient - Current extinction.
     * @param {number} intervalLengthMeters - Interval length.
     * @returns {SpectralValue} Segment transmittance.
     */
    computeTrapezoidSegmentTransmittance(
        previousTotalExtinctionCoefficient,
        currentTotalExtinctionCoefficient,
        intervalLengthMeters,
    ) {
        this._assertSameLength(previousTotalExtinctionCoefficient, currentTotalExtinctionCoefficient);

        return Object.freeze(previousTotalExtinctionCoefficient.map((previous, index) =>
            Math.exp(-0.5 * (previous + currentTotalExtinctionCoefficient[index]) * intervalLengthMeters)));
    }

    /**
     * @param {SpectralValue} rayleighScatteringCoefficient - Rayleigh scattering coefficient.
     * @param {SpectralValue} mieScatteringCoefficient - Mie scattering coefficient.
     * @param {number} rayleighPhase - Rayleigh phase scalar.
     * @param {number} miePhase - Mie phase scalar.
     * @returns {SpectralValue} Direct scattering coefficient.
     */
    computeDirectScattering(
        rayleighScatteringCoefficient,
        mieScatteringCoefficient,
        rayleighPhase,
        miePhase,
    ) {
        this._assertSameLength(rayleighScatteringCoefficient, mieScatteringCoefficient);

        return Object.freeze(rayleighScatteringCoefficient.map((rayleigh, index) =>
            rayleigh * rayleighPhase + mieScatteringCoefficient[index] * miePhase));
    }

    /**
     * @param {SpectralValue} viewTransmittance - Observer-to-sample transmittance.
     * @param {SpectralValue} sourceTransmittance - Sample-to-source transmittance.
     * @param {SpectralValue} sourceRadiance - Source spectral radiance/irradiance packet.
     * @param {SpectralValue} directScatteringCoefficient - Phase-weighted scattering coefficient.
     * @param {number} measureMeters - Effective path length represented by the sample.
     * @returns {SpectralValue} Direct in-scattering contribution.
     */
    computeDirectInScattering(
        viewTransmittance,
        sourceTransmittance,
        sourceRadiance,
        directScatteringCoefficient,
        measureMeters,
    ) {
        return Object.freeze(viewTransmittance.map((viewT, index) =>
            viewT
            * sourceTransmittance[index]
            * sourceRadiance[index]
            * directScatteringCoefficient[index]
            * measureMeters));
    }

    /**
     * @param {SpectralValue} viewTransmittance - Observer-to-sample transmittance.
     * @param {SpectralValue} collapsedIncidentRadiance - Collapsed incident radiance.
     * @param {SpectralValue} totalScatteringCoefficient - Scattering coefficient.
     * @param {number} measureMeters - Effective sample path length.
     * @returns {SpectralValue} Collapsed incident in-scattering contribution.
     */
    computeCollapsedIncidentInScattering(
        viewTransmittance,
        collapsedIncidentRadiance,
        totalScatteringCoefficient,
        measureMeters,
    ) {
        return Object.freeze(viewTransmittance.map((viewT, index) =>
            viewT * collapsedIncidentRadiance[index] * totalScatteringCoefficient[index] * measureMeters));
    }

    /**
     * @param {SpectralValue} viewTransmittance - Observer-to-sample transmittance.
     * @param {readonly SpectralValue[]} incidentRadianceByDirection - Incident radiance by direction.
     * @param {readonly SpectralValue[]} incidentScatteringCoefficientByDirection - Scattering coefficients.
     * @param {readonly number[]} directionWeights - Direction weights.
     * @param {number} measureMeters - Effective sample path length.
     * @returns {SpectralValue} Directional incident in-scattering contribution.
     */
    computeDirectionalIncidentInScattering(
        viewTransmittance,
        incidentRadianceByDirection,
        incidentScatteringCoefficientByDirection,
        directionWeights,
        measureMeters,
    ) {
        const result = zeroSpectral(viewTransmittance.length);

        for (let directionIndex = 0; directionIndex < incidentRadianceByDirection.length; directionIndex += 1) {
            const radiance = incidentRadianceByDirection[directionIndex];
            const scattering = incidentScatteringCoefficientByDirection[directionIndex];
            const weight = directionWeights[directionIndex];

            for (let channelIndex = 0; channelIndex < result.length; channelIndex += 1) {
                result[channelIndex] += viewTransmittance[channelIndex]
                    * radiance[channelIndex]
                    * scattering[channelIndex]
                    * weight
                    * measureMeters;
            }
        }

        return Object.freeze(result);
    }

    /**
     * @param {UnitVector3} viewDirection - Evaluated ray direction.
     * @param {readonly IncidentRadianceSample[]} directionalIncidentSamples - Incident samples.
     * @param {AtmosphereModel} atmosphere - Atmosphere phase sampler.
     * @param {SpectralValue} rayleighScatteringCoefficient - Rayleigh scattering coefficient.
     * @param {SpectralValue} mieScatteringCoefficient - Mie scattering coefficient.
     * @param {SpectralValue} viewTransmittance - Observer-to-sample transmittance.
     * @param {number} measureMeters - Effective sample path length.
     * @returns {SpectralValue} Directional incident in-scattering contribution.
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
        const radianceByDirection = [];
        const scatteringByDirection = [];
        const directionWeights = [];

        for (const sample of directionalIncidentSamples) {
            const phase = atmosphere.samplePhase({
                viewDirection,
                incomingDirection: sample.incomingDirection,
            });

            radianceByDirection.push(sample.radiance);
            scatteringByDirection.push(this.computeDirectScattering(
                rayleighScatteringCoefficient,
                mieScatteringCoefficient,
                phase.rayleighPhase,
                phase.miePhase,
            ));
            directionWeights.push(sample.weight);
        }

        return this.computeDirectionalIncidentInScattering(
            viewTransmittance,
            radianceByDirection,
            scatteringByDirection,
            directionWeights,
            measureMeters,
        );
    }

    /**
     * @param {TransportState} previousState - Previous transport state.
     * @param {SpectralValue} directInScattering - Direct contribution.
     * @param {SpectralValue} incidentInScattering - Incident contribution.
     * @param {SpectralValue} _viewOpticalDepth - View optical depth.
     * @param {SpectralValue} viewTransmittance - View transmittance.
     * @returns {TransportState} Updated transport state.
     */
    updateTransportState(
        previousState,
        directInScattering,
        incidentInScattering,
        _viewOpticalDepth,
        viewTransmittance,
    ) {
        const inScattered = [...previousState.inScattered];

        addInto(inScattered, directInScattering);
        addInto(inScattered, incidentInScattering);

        return Object.freeze({
            inScattered: Object.freeze(inScattered),
            transmittance: Object.freeze([...viewTransmittance]),
            previousExtinction: previousState.previousExtinction ?? null,
        });
    }

    /**
     * @param {IncidentRadianceCacheDescriptor} incidentCacheDescriptor - Cache descriptor.
     * @returns {{ readonly operationKind: string, readonly incidentCacheDescriptor: IncidentRadianceCacheDescriptor }}
     *   Shader operation descriptor.
     */
    describeShaderOperations(incidentCacheDescriptor) {
        return Object.freeze({
            operationKind: 'algorithm32-spectral-transport',
            incidentCacheDescriptor,
        });
    }

    /**
     * @param {RaySegment} raySegment - Candidate ray segment.
     */
    _assertRaySegment(raySegment) {
        if (!raySegment || typeof raySegment !== 'object') {
            throw new TypeError('RaySegment must be an object.');
        }

        const { ray, startDistanceMeters, endDistanceMeters } = raySegment;

        if (!ray || !Array.isArray(ray.origin) || !Array.isArray(ray.direction)) {
            throw new TypeError('RaySegment.ray must include origin and direction tuples.');
        }

        if (ray.origin.length !== 3 || ray.direction.length !== 3) {
            throw new TypeError('Ray origin and direction must be three-component tuples.');
        }

        if (![...ray.origin, ...ray.direction, startDistanceMeters, endDistanceMeters].every(Number.isFinite)) {
            throw new TypeError('RaySegment values must be finite numbers.');
        }
    }

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

    _assertCollaborators(collaborators) {
        for (const [name, collaborator] of Object.entries(collaborators)) {
            if (!collaborator) {
                throw new TypeError(`SpectralCalculator requires ${name} to compute radiance.`);
            }
        }
    }

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

    _assertSameLength(first, second) {
        if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) {
            throw new TypeError('Spectral values must be arrays with matching lengths.');
        }
    }
}

function zeroSpectral(channelCount) {
    return Array.from({ length: channelCount }, () => 0);
}

function oneSpectral(channelCount) {
    return Object.freeze(Array.from({ length: channelCount }, () => 1));
}

function multiplySpectral(first, second) {
    return Object.freeze(first.map((value, index) => value * second[index]));
}

function addInto(target, source) {
    for (let index = 0; index < target.length; index += 1) {
        target[index] += source[index];
    }
}

function mean(values) {
    if (values.length === 0) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
