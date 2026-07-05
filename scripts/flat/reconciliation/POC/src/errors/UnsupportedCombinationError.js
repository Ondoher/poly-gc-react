export default class UnsupportedCombinationError extends Error {
    /**
     * @param {string} message - Unsupported combination description.
     * @param {{ code?: string, details?: unknown }} [options] - Structured error metadata.
     */
    constructor(message, options = {}) {
        super(message);
        this.name = 'UnsupportedCombinationError';
        this.code = options.code ?? 'UNSUPPORTED_RECONCILIATION_COMBINATION';
        this.details = options.details ?? null;
    }
}

