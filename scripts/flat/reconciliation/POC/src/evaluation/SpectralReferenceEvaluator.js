// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.0.
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, Algorithm/data-flow ownership.
// - tmp/atmosphere/reconciliation/001-abstraction-closure-contract.

import SpectralCalculator from '../calculator/SpectralCalculator.js';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import validateModelSet from '../validation/validateModelSet.js';

const DEFAULT_PATH_INTERVAL_COUNT = 1;

const REQUIRED_METHODS_BY_MODEL = Object.freeze({
    geometry: Object.freeze([
        'resolveViewRaySegment',
        'resolveAtmosphereCoordinate',
        'resolveAtmospherePath',
        'resolveSourceRelativePosition',
        'resolveCacheAccess',
    ]),
    atmosphere: Object.freeze([
        'sampleMedium',
        'integrateOpticalDepth',
        'samplePhase',
    ]),
    lightSource: Object.freeze([
        'describeIncidentRadianceCache',
        'createIncidentRadianceCache',
        'sampleDirectLighting',
        'resolveSourcePathLimit',
    ]),
    calculator: Object.freeze([
        'buildEndpointTrapezoidPathIntegrationPoints',
        'computeRadiance',
    ]),
});

export default class SpectralReferenceEvaluator {
    /**
     * @param {SpectralReferenceEvaluatorConfig} configuration - Abstract model and calculator collaborators.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new ReconciliationConfigurationError('SpectralReferenceEvaluator configuration is required.', {
                code: 'MISSING_EVALUATOR_CONFIGURATION',
            });
        }

        const {
            geometry,
            atmosphere,
            lightSource,
            spectralBasis,
            executionControls,
            incidentRadianceSampling = null,
        } = configuration;
        const calculator = configuration.calculator ?? new SpectralCalculator({
            geometry,
            atmosphere,
            lightSource,
            spectralBasis,
            executionControls,
        });

        validateModelSet(
            { geometry, atmosphere, lightSource, calculator },
            REQUIRED_METHODS_BY_MODEL,
        );

        this._configuration = Object.freeze({
            geometry,
            atmosphere,
            lightSource,
            calculator,
            spectralBasis,
            executionControls,
            incidentRadianceSampling,
        });
    }

    static get requiredMethodsByModel() {
        return REQUIRED_METHODS_BY_MODEL;
    }

    get configuration() {
        return this._configuration;
    }

    /**
     * @param {SpectralEvaluationRequest} [request] - Per-ray spectral evaluation inputs.
     * @returns {SpectralEvaluationOutput} Spectral-only evaluation output.
     */
    evaluate(request = {}) {
        if (!request || typeof request !== 'object') {
            throw new ReconciliationConfigurationError('Spectral evaluation request must be an object.', {
                code: 'INVALID_SPECTRAL_EVALUATION_REQUEST',
            });
        }

        const { geometry, calculator } = this._configuration;
        const viewRaySegment = geometry.resolveViewRaySegment(request.viewRayRequest ?? request);
        const pathIntervalCount = this._resolvePathIntervalCount(request.pathIntervalCount);
        const pathIntegrationPoints = calculator.buildEndpointTrapezoidPathIntegrationPoints(
            viewRaySegment,
            pathIntervalCount,
        );
        const incidentRadianceSampling = this._resolveIncidentRadianceSampling(request);
        const pathRadiance = calculator.computeRadiance(
            viewRaySegment,
            pathIntegrationPoints,
            { incidentRadianceSampling },
        );

        return Object.freeze({
            outputKind: 'spectral',
            viewRaySegment,
            pathIntegrationPoints,
            pathRadiance,
            diagnostics: Object.freeze([]),
        });
    }

    /**
     * @param {number | undefined} requestedPathIntervalCount - Request-level path interval count.
     * @returns {number} Resolved path interval count.
     */
    _resolvePathIntervalCount(requestedPathIntervalCount) {
        const pathIntervalCount = requestedPathIntervalCount
            ?? this._configuration.executionControls?.pathIntervalCount
            ?? DEFAULT_PATH_INTERVAL_COUNT;

        if (!Number.isInteger(pathIntervalCount) || pathIntervalCount < 1) {
            throw new RangeError('pathIntervalCount must be a positive integer.');
        }

        return pathIntervalCount;
    }

    /**
     * @param {SpectralEvaluationRequest} request - Per-ray spectral evaluation inputs.
     * @returns {IncidentRadianceSampling | null} Operation-specific incident sampling support.
     */
    _resolveIncidentRadianceSampling(request) {
        const incidentRadianceSampling = Object.hasOwn(request, 'incidentRadianceSampling')
            ? request.incidentRadianceSampling
            : this._configuration.incidentRadianceSampling;

        if (incidentRadianceSampling == null) {
            return null;
        }

        if (
            typeof incidentRadianceSampling !== 'object'
            || !incidentRadianceSampling.cacheDescriptor
            || typeof incidentRadianceSampling.incidentRadianceSampler !== 'function'
        ) {
            throw new ReconciliationConfigurationError('Incident radiance sampling must be null or operation-ready.', {
                code: 'INVALID_INCIDENT_RADIANCE_SAMPLING',
            });
        }

        return incidentRadianceSampling;
    }
}
