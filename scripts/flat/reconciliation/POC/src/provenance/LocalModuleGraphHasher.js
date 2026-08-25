// References:
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md,
//   reconstructable source and code provenance.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   fail-loud POC and production boundaries.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { freezeJsonValue, stableHash } from './stableHash.js';

const IMPORT_PATTERNS = Object.freeze([
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gu,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
]);

export default class LocalModuleGraphHasher {
    /**
     * @param {{ readonly workspaceRoot: string, readonly allowedRoot: string }} configuration - Workspace and permitted local-module boundary.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
            throw new TypeError('Local module graph configuration is required.');
        }
        const unknown = Object.keys(configuration).filter((field) =>
            !['workspaceRoot', 'allowedRoot'].includes(field));
        if (unknown.length > 0) {
            throw new TypeError(`Unsupported local module graph fields: ${unknown.join(', ')}.`);
        }
        if (typeof configuration.workspaceRoot !== 'string'
            || configuration.workspaceRoot.length === 0) {
            throw new TypeError('workspaceRoot must be a nonempty string.');
        }
        if (typeof configuration.allowedRoot !== 'string'
            || configuration.allowedRoot.length === 0) {
            throw new TypeError('allowedRoot must be a nonempty string.');
        }

        this.workspaceRoot = resolve(configuration.workspaceRoot);
        this.allowedRoot = resolve(this.workspaceRoot, configuration.allowedRoot);
        assertWithin(this.allowedRoot, this.workspaceRoot, 'allowedRoot');
        this.fingerprint = stableHash(this.describe());
        Object.freeze(this);
    }

    /**
     * Describe the deterministic local-import traversal contract.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable traversal descriptor.
     */
    describe() {
        return Object.freeze({
            kind: 'local-static-module-graph-hasher-v1',
            workspaceRoot: normalizePath(this.workspaceRoot),
            allowedRoot: normalizePath(relative(this.workspaceRoot, this.allowedRoot)),
            importKinds: Object.freeze([
                'static-import',
                'static-export-from',
                'literal-dynamic-import',
            ]),
            externalPackagesIncluded: false,
            outsideAllowedRootPolicy: 'reject',
        });
    }

    /**
     * Traverse relative imports from the supplied entries and hash every local module.
     *
     * @param {readonly string[]} entryPaths - Workspace-relative or absolute entry modules.
     * @returns {Promise<Readonly<Record<string, unknown>>>} Frozen graph and source hashes.
     */
    async collect(entryPaths) {
        if (!Array.isArray(entryPaths) || entryPaths.length === 0
            || entryPaths.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
            throw new TypeError('entryPaths must be a nonempty array of module paths.');
        }

        const entries = entryPaths.map((entry) => this._resolveEntry(entry));
        const queue = [...entries];
        const visited = new Map();
        while (queue.length > 0) {
            const filePath = queue.shift();
            if (visited.has(filePath)) {
                continue;
            }
            assertWithin(filePath, this.allowedRoot, 'local module');
            const bytes = await readFile(filePath);
            const source = bytes.toString('utf8');
            const imports = extname(filePath).toLowerCase() === '.js'
                ? extractRelativeSpecifiers(source).map((specifier) => {
                    const importedPath = resolve(dirname(filePath), specifier);
                    assertWithin(importedPath, this.allowedRoot, `import ${specifier}`);
                    return importedPath;
                })
                : [];
            visited.set(filePath, Object.freeze({
                bytes,
                imports: Object.freeze([...new Set(imports)]),
            }));
            queue.push(...imports);
        }

        const orderedPaths = [...visited.keys()].sort((left, right) =>
            workspacePath(this.workspaceRoot, left).localeCompare(
                workspacePath(this.workspaceRoot, right),
            ));
        const files = Object.fromEntries(orderedPaths.map((filePath) => {
            const entry = visited.get(filePath);
            return [workspacePath(this.workspaceRoot, filePath), Object.freeze({
                sha256: createHash('sha256').update(entry.bytes).digest('hex'),
                byteLength: entry.bytes.byteLength,
                imports: Object.freeze(entry.imports
                    .map((importedPath) => workspacePath(this.workspaceRoot, importedPath))
                    .sort()),
            })];
        }));
        const descriptor = {
            ...this.describe(),
            hasherFingerprint: this.fingerprint,
            entries: Object.freeze(entries.map((entry) =>
                workspacePath(this.workspaceRoot, entry)).sort()),
            fileCount: orderedPaths.length,
            files: Object.freeze(files),
        };
        return freezeJsonValue({
            ...descriptor,
            graphFingerprint: stableHash(descriptor),
        });
    }

    /**
     * Resolve and validate one graph entry.
     *
     * @param {string} entry - Workspace-relative or absolute module path.
     * @returns {string} Absolute validated path.
     */
    _resolveEntry(entry) {
        const filePath = isAbsolute(entry) ? resolve(entry) : resolve(this.workspaceRoot, entry);
        assertWithin(filePath, this.allowedRoot, 'entry module');
        return filePath;
    }
}

function extractRelativeSpecifiers(source) {
    const specifiers = [];
    for (const pattern of IMPORT_PATTERNS) {
        pattern.lastIndex = 0;
        for (const match of source.matchAll(pattern)) {
            if (match[1].startsWith('.')) {
                specifiers.push(match[1]);
            }
        }
    }
    return Object.freeze([...new Set(specifiers)]);
}

function assertWithin(target, parent, label) {
    const pathFromParent = relative(parent, target);
    if (pathFromParent === '' || (!pathFromParent.startsWith(`..${sep}`)
        && pathFromParent !== '..' && !isAbsolute(pathFromParent))) {
        return;
    }
    throw new RangeError(`${label} escapes the allowed local-module root: ${target}.`);
}

function workspacePath(workspaceRoot, filePath) {
    return normalizePath(relative(workspaceRoot, filePath));
}

function normalizePath(value) {
    return value.split(sep).join('/');
}
