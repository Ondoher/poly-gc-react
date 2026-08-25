// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, descriptor fingerprints.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md, quantity-bearing source fingerprints.

import { createHash } from 'node:crypto';

/**
 * Hash one JSON-compatible value with stable object-key ordering.
 *
 * @param {unknown} value - JSON-compatible value.
 * @returns {string} Stable SHA-256 hash.
 */
export function stableHash(value) {
    return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/**
 * Serialize one JSON-compatible value with stable object-key ordering.
 *
 * @param {unknown} value - JSON-compatible value.
 * @returns {string} Stable string representation.
 */
export function stableStringify(value) {
    return stringifyValue(value, new Set(), '$');
}

/**
 * Copy and deeply freeze one JSON-compatible value.
 *
 * @param {unknown} value - JSON-compatible value.
 * @returns {unknown} Detached deeply frozen value.
 */
export function freezeJsonValue(value) {
    return freezeNormalized(JSON.parse(stableStringify(value)));
}

function stringifyValue(value, ancestors, path) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return JSON.stringify(value);
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError(`Stable JSON value at ${path} must be finite.`);
        }
        return JSON.stringify(value);
    }

    if (!value || typeof value !== 'object') {
        throw new TypeError(`Stable JSON value at ${path} contains unsupported ${typeof value}.`);
    }

    if (ancestors.has(value)) {
        throw new TypeError(`Stable JSON value at ${path} contains a cycle.`);
    }

    ancestors.add(value);
    let result;
    if (Array.isArray(value)) {
        result = `[${value.map((entry, index) =>
            stringifyValue(entry, ancestors, `${path}[${index}]`)).join(',')}]`;
    } else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            ancestors.delete(value);
            throw new TypeError(`Stable JSON value at ${path} must be a plain object.`);
        }
        result = `{${Object.keys(value).sort().map((key) =>
            `${JSON.stringify(key)}:${stringifyValue(value[key], ancestors, `${path}.${key}`)}`).join(',')}}`;
    }
    ancestors.delete(value);
    return result;
}

function freezeNormalized(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freezeNormalized);
        Object.freeze(value);
    }
    return value;
}
