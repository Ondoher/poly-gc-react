/**
 * Optional pass-local performance timer for Algorithm32 shader diagnostics.
 */
export class ShaderPassPerformanceTimer {
	/**
	 * Track globally unique sample ids for callback correlation.
	 *
	 * @type {number}
	 */
	static _nextSampleId = 1;

	/**
	 * Store the pass name reported to callbacks.
	 *
	 * @type {string}
	 */
	_passName;

	/**
	 * Store the caller-provided performance callback.
	 *
	 * @type {Function}
	 */
	_callback;

	/**
	 * Store pending GPU timer queries.
	 *
	 * @type {Array<object>}
	 */
	_pendingQueries = [];

	/**
	 * Store cached timer-query support.
	 *
	 * @type {object | null | undefined}
	 */
	_querySupport;

	/**
	 * Store how often pass invocations should create a measured sample.
	 *
	 * @type {number}
	 */
	_sampleIntervalFrames;

	/**
	 * Store the maximum unresolved GPU timer queries this timer may hold.
	 *
	 * @type {number}
	 */
	_maxPendingQueries;

	/**
	 * Count pass invocations for sampling cadence.
	 *
	 * @type {number}
	 */
	_frameIndex = 0;

	/**
	 * Create an optional shader pass performance timer.
	 *
	 * @param {object} configuration - Supplies pass name and callback.
	 */
	constructor(configuration) {
		this._passName = configuration.passName;
		this._callback = configuration.performanceCallback;
		this._sampleIntervalFrames = positiveIntegerOrDefault(configuration.sampleIntervalFrames, 1);
		this._maxPendingQueries = positiveIntegerOrDefault(configuration.maxPendingQueries, 1);
	}

	/**
	 * Return true when a callback should receive samples.
	 *
	 * @returns {boolean} True when enabled.
	 */
	get enabled() {
		return typeof this._callback === 'function';
	}

	/**
	 * Begin timing one pass invocation.
	 *
	 * @param {unknown} renderer - Supplies the active renderer.
	 * @param {object} [metadata] - Supplies sample metadata.
	 * @returns {object | null} Return active timing state.
	 */
	begin(renderer, metadata = {}) {
		if (!this.enabled) {
			return null;
		}

		this.poll(renderer);
		this._frameIndex += 1;

		if ((this._frameIndex - 1) % this._sampleIntervalFrames !== 0) {
			return null;
		}

		if (this._pendingQueries.length >= this._maxPendingQueries) {
			return null;
		}

		const support = this._resolveQuerySupport(renderer);
		const sample = {
			id: ShaderPassPerformanceTimer._nextSampleId,
			cpuStartMs: nowMs(),
			metadata,
			query: null,
			support,
		};

		ShaderPassPerformanceTimer._nextSampleId += 1;

		if (support) {
			try {
				sample.query = support.gl.createQuery();
				support.gl.beginQuery(support.timeElapsed, sample.query);
			} catch (error) {
				sample.query = null;
				this._emit({
					event: 'gpu-query-error',
					sampleId: sample.id,
					gpuAvailable: false,
					errorMessage: error instanceof Error ? error.message : String(error),
					...metadata,
				});
			}
		}

		return sample;
	}

	/**
	 * End timing one pass invocation and emit the immediate CPU sample.
	 *
	 * @param {unknown} renderer - Supplies the active renderer.
	 * @param {object | null} sample - Supplies active timing state.
	 * @param {object} [metadata] - Supplies completion metadata.
	 * @returns {void}
	 */
	end(renderer, sample, metadata = {}) {
		if (!sample || !this.enabled) {
			return;
		}

		const cpuSubmitMs = nowMs() - sample.cpuStartMs;
		const mergedMetadata = {
			...sample.metadata,
			...metadata,
		};

		if (sample.query && sample.support) {
			try {
				sample.support.gl.endQuery(sample.support.timeElapsed);
				this._pendingQueries.push({
					query: sample.query,
					support: sample.support,
					sampleId: sample.id,
					metadata: mergedMetadata,
				});
			} catch (error) {
				sample.support.gl.deleteQuery(sample.query);
				this._emit({
					event: 'gpu-query-error',
					sampleId: sample.id,
					gpuAvailable: false,
					errorMessage: error instanceof Error ? error.message : String(error),
					...mergedMetadata,
				});
			}
		}

		this._emit({
			event: 'cpu-submit',
			sampleId: sample.id,
			cpuSubmitMs,
			gpuAvailable: Boolean(sample.support),
			...mergedMetadata,
		});
		this.poll(renderer);
	}

	/**
	 * Poll pending GPU queries and emit resolved elapsed-time samples.
	 *
	 * @param {unknown} renderer - Supplies the active renderer.
	 * @returns {void}
	 */
	poll(renderer) {
		if (!this.enabled || this._pendingQueries.length === 0) {
			return;
		}

		const remaining = [];

		for (const entry of this._pendingQueries) {
			const { gl, resultAvailable, result, disjoint } = entry.support;

			if (!gl.getQueryParameter(entry.query, resultAvailable)) {
				remaining.push(entry);
				continue;
			}

			const isDisjoint = Boolean(gl.getParameter(disjoint));
			const elapsedNanoseconds = gl.getQueryParameter(entry.query, result);

			gl.deleteQuery(entry.query);
			this._emit({
				event: 'gpu-elapsed',
				sampleId: entry.sampleId,
				gpuAvailable: true,
				disjoint: isDisjoint,
				gpuMs: isDisjoint ? null : elapsedNanoseconds / 1000000,
				...entry.metadata,
			});
		}

		this._pendingQueries = remaining;
		this._resolveQuerySupport(renderer);
	}

	/**
	 * Dispose pending GPU timer queries.
	 *
	 * @returns {void}
	 */
	dispose() {
		for (const entry of this._pendingQueries) {
			try {
				entry.support?.gl?.deleteQuery?.(entry.query);
			} catch {
				// Timer cleanup is best-effort during teardown.
			}
		}

		this._pendingQueries = [];
		this._callback = null;
	}

	/**
	 * Emit one sample without letting callback failures affect rendering.
	 *
	 * @param {object} sample - Supplies sample fields.
	 * @returns {void}
	 */
	_emit(sample) {
		try {
			this._callback(Object.freeze({
				passName: this._passName,
				timestampMs: nowMs(),
				...sample,
			}));
		} catch {
			// Performance callbacks must never affect rendering.
		}
	}

	/**
	 * Resolve WebGL2 timer-query support for the renderer.
	 *
	 * @param {unknown} renderer - Supplies the active renderer.
	 * @returns {object | null} Return support packet or null.
	 */
	_resolveQuerySupport(renderer) {
		if (this._querySupport !== undefined) {
			return this._querySupport;
		}

		const gl = typeof renderer?.getContext === 'function'
			? renderer.getContext()
			: null;
		const extension = gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');

		if (
			!gl
			|| !extension
			|| typeof gl.createQuery !== 'function'
			|| typeof gl.beginQuery !== 'function'
			|| typeof gl.endQuery !== 'function'
			|| typeof gl.getQueryParameter !== 'function'
			|| typeof gl.deleteQuery !== 'function'
		) {
			this._querySupport = null;
			return null;
		}

		this._querySupport = Object.freeze({
			gl,
			timeElapsed: extension.TIME_ELAPSED_EXT,
			disjoint: extension.GPU_DISJOINT_EXT,
			resultAvailable: gl.QUERY_RESULT_AVAILABLE,
			result: gl.QUERY_RESULT,
		});

		return this._querySupport;
	}
}

/**
 * Return high-resolution wall-clock time when available.
 *
 * @returns {number} Time in milliseconds.
 */
function nowMs() {
	return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * Normalize a positive integer option.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {number} fallback - Supplies fallback.
 * @returns {number} Return a positive integer.
 */
function positiveIntegerOrDefault(value, fallback) {
	if (Number.isInteger(value) && value > 0) {
		return value;
	}

	return fallback;
}

export default ShaderPassPerformanceTimer;
