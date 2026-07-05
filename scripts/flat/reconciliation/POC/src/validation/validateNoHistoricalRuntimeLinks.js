import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';

const DISALLOWED_PATH_FRAGMENTS = Object.freeze([
    ['shared', 'algorithm32', 'POC'].join('/'),
    ['scripts', 'flat', 'algorithm32-shader-lab'].join('/'),
    ['scripts', 'flat', 'atmosflat32'].join('/'),
    ['scripts', 'flat', 'local-second-order'].join('/'),
]);

const TEXT_FILE_EXTENSIONS = Object.freeze(['.js', '.md', '.json']);

/**
 * @param {string} rootPath - Path to scan.
 * @returns {Promise<ReadonlyArray<ReconciliationDiagnostic>>} Scan diagnostics.
 */
export default async function validateNoHistoricalRuntimeLinks(rootPath) {
    const diagnostics = [];

    for await (const filePath of walkFiles(rootPath)) {
        if (!TEXT_FILE_EXTENSIONS.some((extension) => filePath.endsWith(extension))) {
            continue;
        }

        const normalizedFilePath = filePath.replaceAll('\\', '/');

        if (normalizedFilePath.endsWith('/validation/validateNoHistoricalRuntimeLinks.js')) {
            continue;
        }

        const content = await readFile(filePath, 'utf8');
        const normalizedContent = content.replaceAll('\\', '/');

        for (const fragment of DISALLOWED_PATH_FRAGMENTS) {
            if (normalizedContent.includes(fragment)) {
                diagnostics.push({
                    id: 'historical-runtime-link',
                    severity: 'error',
                    message: `Disallowed historical runtime path found in ${filePath}.`,
                    details: { filePath, fragment },
                });
            }
        }
    }

    if (diagnostics.length > 0) {
        throw new ReconciliationConfigurationError('Historical runtime link validation failed.', {
            code: 'HISTORICAL_RUNTIME_LINK_VALIDATION_FAILED',
            details: diagnostics,
        });
    }

    return Object.freeze(diagnostics);
}

/**
 * @param {string} directoryPath - Directory to walk.
 */
async function* walkFiles(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
        const entryPath = join(directoryPath, entry.name);

        if (entry.isDirectory()) {
            yield* walkFiles(entryPath);
            continue;
        }

        if (entry.isFile()) {
            yield entryPath;
        }
    }
}

