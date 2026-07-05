// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, descriptor fingerprints.

import { createHash } from 'node:crypto';

/**
 * @param {unknown} value - JSON-compatible value.
 * @returns {string} Stable SHA-256 hash.
 */
export function stableHash(value) {
    return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/**
 * @param {unknown} value - JSON-compatible value.
 * @returns {string} Stable string representation.
 */
export function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) =>
            `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }

    return JSON.stringify(value);
}
