// References:
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md, numbered record file set.
// - tmp/atmosphere/reconciliation/010-cli-experiment-run-record-rule.

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

export function parseRecordDirectory(argv) {
    const recordIndex = argv.indexOf('--record');

    if (recordIndex === -1 || !argv[recordIndex + 1]) {
        throw new Error('Runner requires --record <tmp/atmosphere/reconciliation/NNN-name>.');
    }

    return argv[recordIndex + 1];
}

/**
 * Create one new immutable reconciliation record directory.
 *
 * @param {string} recordDirectory - Direct numbered child of the record root.
 * @returns {Promise<void>} Completion promise.
 */
export async function createFreshRecordDirectory(recordDirectory) {
    const root = resolve('tmp/atmosphere/reconciliation');
    const target = resolve(recordDirectory);
    const name = basename(target);

    if (dirname(target) !== root || !/^\d{3}-[a-z0-9][a-z0-9-]*$/.test(name)) {
        throw new Error(
            'Record directory must be a direct numbered child of tmp/atmosphere/reconciliation/.',
        );
    }

    await mkdir(target, { recursive: false });
}

export async function writeJson(recordDirectory, filename, value) {
    await mkdir(recordDirectory, { recursive: true });
    await writeFile(
        resolve(recordDirectory, filename),
        `${JSON.stringify(value, null, 2)}\n`,
        'utf8',
    );
}

export async function writeText(recordDirectory, filename, value) {
    await mkdir(recordDirectory, { recursive: true });
    await writeFile(resolve(recordDirectory, filename), value, 'utf8');
}

export async function appendRunLog(recordDirectory, message) {
    await mkdir(recordDirectory, { recursive: true });
    await appendFile(resolve(recordDirectory, 'run.log'), `${nowIso()} ${message}\n`, 'utf8');
}

export function nowIso() {
    return new Date().toISOString();
}

export function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

export function finiteSpectral(value) {
    return Array.isArray(value) && value.length > 0 && value.every(Number.isFinite);
}

export function nonnegativeSpectral(value) {
    return finiteSpectral(value) && value.every((entry) => entry >= 0);
}

export function spectralMean(value) {
    return value.reduce((sum, entry) => sum + entry, 0) / value.length;
}
