/**
 * Run CPU/reference Algorithm32 evaluations against a configured shared model.
 */
import SpectralCalculator from './SpectralCalculator.js';

const DEFAULT_PATH_INTERVAL_COUNT = 1;

/**
 * Run CPU/reference Algorithm32 evaluations against a configured shared model.
 */
export class Reference {
	/**
	 * Store the facade-owned shared model consumed by reference evaluations.
	 *
	 * @type {SharedModel}
	 */
	_model;

	/**
	 * Store the shared spectral calculator.
	 *
	 * @type {SpectralCalculator}
	 */
	_calculator;

	/**
	 * Store the configured default incident-radiance sampling packet.
	 *
	 * @type {IncidentRadianceSampling | null}
	 */
	_incidentRadianceSampling;

	/**
	 * Store numerical execution controls.
	 *
	 * @type {ExecutionConfig}
	 */
	_executionControls;

	/**
	 * Create a CPU/reference algorithm execution collaborator.
	 *
	 * @param {ReferenceDependencies} dependencies - Supplies the shared model
	 * and implementation services used by reference evaluations.
	 */
	constructor(dependencies) {
		if (!dependencies || typeof dependencies !== 'object') {
			throw new TypeError('Reference dependencies are required.');
		}

		if (!dependencies.model) {
			throw new TypeError('Reference requires a shared model.');
		}

		this._model = dependencies.model;
		this._incidentRadianceSampling = dependencies.incidentRadianceSampling ?? null;
		this._executionControls = Object.freeze({ ...(dependencies.executionControls ?? {}) });
		this._calculator = dependencies.calculator ?? new SpectralCalculator({
			geometry: this._model.geometry,
			atmosphere: this._model.atmosphere,
			lightSource: this._model.lightSource,
			spectralBasis: this._model.spectral?.basis,
			executionControls: this._executionControls,
		});
	}

	/**
	 * Get the facade-owned shared model consumed by reference evaluations.
	 *
	 * @returns {SharedModel} The shared model.
	 */
	get model() {
		return this._model;
	}

	/**
	 * Get the shared spectral calculator.
	 *
	 * @returns {SpectralCalculator} The spectral calculator.
	 */
	get calculator() {
		return this._calculator;
	}

	/**
	 * Dispose resources owned by the reference execution collaborator.
	 *
	 * @returns {void}
	 */
	dispose() {
	}

	/**
	 * Resolve the path interval count for one evaluation.
	 *
	 * @param {number | undefined} requestedPathIntervalCount - Supplies the
	 * request-level interval count.
	 * @returns {number} The resolved interval count.
	 */
	_resolvePathIntervalCount(requestedPathIntervalCount) {
		const pathIntervalCount = requestedPathIntervalCount
			?? this._executionControls.pathIntervalCount
			?? DEFAULT_PATH_INTERVAL_COUNT;

		if (!Number.isInteger(pathIntervalCount) || pathIntervalCount < 1) {
			throw new RangeError('pathIntervalCount must be a positive integer.');
		}

		return pathIntervalCount;
	}

	/**
	 * Resolve operation-ready incident-radiance sampling for one evaluation.
	 *
	 * @param {EvaluationRequest} request - Supplies one accepted evaluation
	 * request.
	 * @returns {IncidentRadianceSampling | null} The resolved incident sampling.
	 */
	_resolveIncidentRadianceSampling(request) {
		const incidentRadianceSampling = Object.hasOwn(request, 'incidentRadianceSampling')
			? request.incidentRadianceSampling
			: this._incidentRadianceSampling;

		if (incidentRadianceSampling == null) {
			return null;
		}

		if (
			typeof incidentRadianceSampling !== 'object'
			|| !incidentRadianceSampling.cacheDescriptor
			|| typeof incidentRadianceSampling.incidentRadianceSampler !== 'function'
		) {
			throw new TypeError('Incident radiance sampling must be null or operation-ready.');
		}

		return incidentRadianceSampling;
	}

	/**
	 * Create the public spectral evaluation result from resolved path facts and
	 * calculated path radiance.
	 *
	 * @param {RaySegment} viewRaySegment - Supplies the resolved ray segment.
	 * @param {readonly PathIntegrationPoint[]} pathIntegrationPoints - Supplies
	 * path integration points.
	 * @param {PathRadiance} pathRadiance - Supplies computed path radiance.
	 * @returns {EvaluationResult} The spectral evaluation result.
	 */
	_createEvaluationResult(viewRaySegment, pathIntegrationPoints, pathRadiance) {
		return Object.freeze({
			pathRadiance: Object.freeze([...pathRadiance.inScattered]),
			transmittance: Object.freeze([...pathRadiance.transmittance]),
			viewRaySegment,
			pathIntegrationPoints,
		});
	}

	/**
	 * Evaluate Algorithm32 spectral radiance and transmittance for one ray
	 * request.
	 *
	 * The evaluation follows the reconciled owner-query flow: geometry resolves
	 * the finite view ray segment, the calculator builds endpoint/trapezoid path
	 * points, and reusable spectral transport computes path radiance plus view
	 * transmittance. Setup-bound incident radiance uses request/default/null
	 * precedence. Optical-depth, Beer-Lambert transmittance, and volume
	 * in-scattering supply the transport equation family. [1][2]
	 *
	 * @param {EvaluationRequest} request - Supplies one accepted evaluation
	 * request.
	 * @returns {EvaluationResult} The spectral evaluation result.
	 */
	evaluate(request = {}) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Evaluation request must be an object.');
		}

		const viewRaySegment = this.model.geometry.resolveViewRaySegment(request.viewRayRequest ?? request);
		const pathIntervalCount = this._resolvePathIntervalCount(request.pathIntervalCount);
		const pathIntegrationPoints = this.calculator.buildEndpointTrapezoidPathIntegrationPoints(
			viewRaySegment,
			pathIntervalCount,
		);
		const incidentRadianceSampling = this._resolveIncidentRadianceSampling(request);
		const pathRadiance = this.calculator.computeRadiance(
			viewRaySegment,
			pathIntegrationPoints,
			{ incidentRadianceSampling },
		);

		return this._createEvaluationResult(viewRaySegment, pathIntegrationPoints, pathRadiance);
	}
}

export default Reference;

