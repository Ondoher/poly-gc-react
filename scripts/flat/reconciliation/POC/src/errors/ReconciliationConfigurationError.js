export default class ReconciliationConfigurationError extends Error {
    /**
     * @param {string} message - Configuration failure description.
     * @param {{ code?: string, details?: unknown }} [options] - Structured error metadata.
     */
    constructor(message, options = {}) {
        super(message);
        this.name = 'ReconciliationConfigurationError';
        this.code = options.code ?? 'RECONCILIATION_CONFIGURATION_ERROR';
        this.details = options.details ?? null;
    }
}

