// References:
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md, fail-loud validation policy.
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.0 contract validation.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';

/**
 * @param {Record<string, unknown>} models - Named model instances to validate.
 * @param {Record<string, readonly string[]>} requiredMethodsByModel - Required method names per model.
 * @returns {ReadonlyArray<ReconciliationDiagnostic>} Validation diagnostics.
 */
export default function validateModelSet(models, requiredMethodsByModel) {
    const diagnostics = [];

    for (const [modelName, requiredMethods] of Object.entries(requiredMethodsByModel)) {
        const model = models[modelName];

        if (!model || typeof model !== 'object') {
            diagnostics.push({
                id: `missing-${modelName}`,
                severity: 'error',
                message: `Missing ${modelName} model.`,
                details: { modelName },
            });
            continue;
        }

        for (const methodName of requiredMethods) {
            if (typeof model[methodName] !== 'function') {
                diagnostics.push({
                    id: `missing-${modelName}-${methodName}`,
                    severity: 'error',
                    message: `${modelName} is missing required method ${methodName}.`,
                    details: { modelName, methodName },
                });
            }
        }
    }

    if (diagnostics.length > 0) {
        throw new ReconciliationConfigurationError('Model set validation failed.', {
            code: 'MODEL_SET_VALIDATION_FAILED',
            details: diagnostics,
        });
    }

    return Object.freeze(diagnostics);
}
