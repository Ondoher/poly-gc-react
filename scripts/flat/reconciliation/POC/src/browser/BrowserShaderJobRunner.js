// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 3.4.
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md, browser harness rules.
// - scripts/flat/local-second-order/harness.js, JSON watched command/progress model.

import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../../..');
const DEFAULT_OUT_ROOT = path.join(REPO_ROOT, 'tmp/atmosphere/reconciliation');
const DEFAULT_COMMAND_PATH = path.join(REPO_ROOT, 'scripts/flat/reconciliation/POC/browser-jobs/browser-command.json');
const DEFAULT_PAGE_ROOT = path.join(REPO_ROOT, 'scripts/flat/reconciliation/POC/browser-page');
const DEFAULT_VIEWPORT = Object.freeze({
    width: 640,
    height: 360,
    deviceScaleFactor: 1,
});
const DEFAULT_PAGE_TIMEOUT_MS = 300000;
const BROWSER_EVALUATION_TIMEOUT_MESSAGE = 'Reconciliation browser shader job evaluation timed out.';
const RECOVERY_CLOSE_TIMEOUT_MS = 10000;

export default class BrowserShaderJobRunner {
    /**
     * @param {Partial<BrowserShaderRunnerOptions>} [configuration] - Runner configuration.
     */
    constructor(configuration = {}) {
        this.options = Object.freeze({
            mode: configuration.mode ?? 'once',
            headed: configuration.headed === true,
            outRoot: path.resolve(configuration.outRoot ?? DEFAULT_OUT_ROOT),
            commandPath: path.resolve(configuration.commandPath ?? DEFAULT_COMMAND_PATH),
            pageRoot: path.resolve(configuration.pageRoot ?? DEFAULT_PAGE_ROOT),
            pollMs: configuration.pollMs ?? 750,
            port: configuration.port ?? 0,
            pageTimeoutMs: configuration.pageTimeoutMs ?? DEFAULT_PAGE_TIMEOUT_MS,
            useSwiftShader: configuration.useSwiftShader === true,
        });
        this._activeHostSession = null;
        validateOptions(this.options);
    }

    /**
     * @returns {BrowserShaderRunnerOptions} Normalized options.
     */
    describeOptions() {
        return this.options;
    }

    /**
     * @returns {Promise<BrowserShaderDryRunSummary>} Dry-run setup result.
     */
    async dryRun() {
        await fs.mkdir(this.options.outRoot, { recursive: true });
        const command = await this.readOrCreateCommand();
        await this.writeProgress({
            status: 'dry-run',
            command,
            runDir: null,
            message: 'Dry run validated command/progress paths without launching a browser.',
        });
        const packet = {
            kind: 'algorithm32-reconciliation-browser-dry-run',
            status: 'accepted',
            command,
            options: this.options,
            progressPath: this.progressPath(),
            latestPath: this.latestPath(),
        };
        await fs.writeFile(this.latestPath(), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');

        return Object.freeze({
            status: 'accepted',
            command,
            outRoot: this.options.outRoot,
            commandPath: this.options.commandPath,
            progressPath: this.progressPath(),
            latestPath: this.latestPath(),
        });
    }

    /**
     * @returns {Promise<{ readonly runDir: string, readonly packet: BrowserShaderRunPacket }>} One browser run.
     */
    async runOnce() {
        const state = await this._openBrowserState();

        try {
            const command = await this.readOrCreateCommand();
            if (command.status === 'done') {
                await this.writeProgress({
                    status: 'command-done',
                    command,
                    runDir: command.completion?.runDir ?? null,
                    message: `Command ${command.id} is marked done; no browser job was run.`,
                });
                return {
                    runDir: command.completion?.runDir ?? null,
                    packet: {
                        status: 'accepted',
                        command,
                        browser: { requiresPageRecovery: false },
                        artifact: { runDir: command.completion?.runDir ?? null },
                    },
                };
            }
            const run = await this._runCommand({
                page: state.page,
                command,
                pageUrl: await state.pageUrlForCommand(command),
            });
            await this.markCommandDone({
                command,
                packet: run.packet,
            });
            return run;
        } finally {
            await state.close();
        }
    }

    /**
     * @returns {Promise<void>} Long-running watcher.
     */
    async watch() {
        const state = await this._openBrowserState();
        let lastFingerprint = '';
        let heartbeatCount = 0;

        try {
            this._log(`watch mode active`);
            this._log(`command file: ${this.options.commandPath}`);
            this._log(`output root: ${this.options.outRoot}`);
            this._log(`progress file: ${this.progressPath()}`);
            await this.writeProgress({
                status: 'watching',
                command: null,
                runDir: null,
                message: 'Browser shader watcher is waiting for JSON jobs.',
            });

            for (;;) {
                let command;
                let fingerprint;

                try {
                    command = await this.readOrCreateCommand();
                    fingerprint = await this.commandFingerprint(command);
                } catch (error) {
                    await this.writeProgress({
                        status: 'command-read-error',
                        command: null,
                        runDir: null,
                        message: `Unable to read command file: ${error.message}`,
                    });
                    await delay(this.options.pollMs);
                    continue;
                }

                if (command.status === 'done') {
                    if (fingerprint !== lastFingerprint) {
                        lastFingerprint = fingerprint;
                        await this.writeProgress({
                            status: 'command-done',
                            command,
                            runDir: command.completion?.runDir ?? null,
                            message: `Command ${command.id} is marked done; waiting for a new pending command.`,
                        });
                    }
                    await delay(this.options.pollMs);
                    continue;
                }

                if (fingerprint !== lastFingerprint) {
                    lastFingerprint = fingerprint;
                    await this.writeProgress({
                        status: 'job-started',
                        command,
                        runDir: null,
                        message: `Started browser shader job ${command.id}.`,
                    });

                    try {
                        const run = await this._runCommand({
                            page: state.page,
                            command,
                            pageUrl: await state.pageUrlForCommand(command),
                        });
                        await this.markCommandDone({
                            command,
                            packet: run.packet,
                        });
                        lastFingerprint = await this.commandFingerprint(await this.readOrCreateCommand());
                        if (run.packet.browser.requiresPageRecovery) {
                            this._log(`page recovery requested after ${command.id}`);
                            await state.recover();
                        }
                    } catch (error) {
                        this._log(`job ${command.id} failed at harness level: ${error.message}`);
                        await this._writeHarnessFailure({
                            command,
                            error,
                            pageUrl: await state.pageUrlForCommand(command),
                        });
                        await this.markCommandDone({
                            command,
                            packet: {
                                status: 'rejected',
                                artifact: { runDir: null },
                                browser: { requiresPageRecovery: true },
                            },
                        });
                        lastFingerprint = await this.commandFingerprint(await this.readOrCreateCommand());
                        await state.recover();
                    }
                }

                heartbeatCount += 1;
                if (heartbeatCount === 1 || heartbeatCount % 40 === 0) {
                    await this.writeProgress({
                        status: 'watching',
                        command,
                        runDir: null,
                        message: 'Browser shader watcher heartbeat.',
                    });
                } else {
                    await this.writeProgress({
                        status: 'watching',
                        command,
                        runDir: null,
                        message: 'Browser shader watcher heartbeat.',
                    }, { quiet: true });
                }
                await delay(this.options.pollMs);
            }
        } finally {
            await state.close();
        }
    }

    /**
     * @returns {Promise<BrowserShaderJobCommand>} Command file.
     */
    async readOrCreateCommand() {
        try {
            const text = await fs.readFile(this.options.commandPath, 'utf8');
            return normalizeCommand(JSON.parse(text));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }

            const command = normalizeCommand({});
            await fs.mkdir(path.dirname(this.options.commandPath), { recursive: true });
            await fs.writeFile(this.options.commandPath, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
            return command;
        }
    }

    /**
     * @param {{
     *   readonly status: string,
     *   readonly command: BrowserShaderJobCommand | null,
     *   readonly runDir: string | null,
     *   readonly message: string,
     *   readonly detail?: unknown
     * }} progress - Progress state.
     * @returns {Promise<void>} Completion promise.
     */
    async writeProgress(progress, options = {}) {
        await fs.mkdir(this.options.outRoot, { recursive: true });
        const packet = {
            kind: 'algorithm32-reconciliation-browser-progress',
            updatedAt: new Date().toISOString(),
            status: progress.status,
            commandPath: this.options.commandPath,
            outRoot: this.options.outRoot,
            mode: this.options.mode,
            pid: process.pid,
            currentJobId: progress.command?.id ?? null,
            currentRunDir: progress.runDir,
            message: progress.message,
            ...(progress.detail ? { detail: progress.detail } : {}),
        };

        await fs.writeFile(this.progressPath(), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
        if (options.quiet !== true) {
            this._log(`${packet.status}: ${packet.message}`);
            if (packet.currentJobId) {
                this._log(`job=${packet.currentJobId}`);
            }
            if (packet.currentRunDir) {
                this._log(`run=${packet.currentRunDir}`);
            }
        }
    }

    /**
     * @param {BrowserShaderJobCommand} command - Normalized command.
     * @returns {Promise<string>} Command fingerprint.
     */
    async commandFingerprint(command) {
        const stats = await fs.stat(this.options.commandPath);
        return JSON.stringify({
            mtimeMs: stats.mtimeMs,
            size: stats.size,
            command,
        });
    }

    /**
     * @param {{
     *   readonly command: BrowserShaderJobCommand,
     *   readonly packet: { readonly status: string, readonly artifact?: { readonly runDir?: string | null } }
     * }} completion - Completed command facts.
     * @returns {Promise<void>} Completion promise.
     */
    async markCommandDone(completion) {
        const doneCommand = {
            ...completion.command,
            status: 'done',
            completedAt: new Date().toISOString(),
            completion: {
                status: completion.packet.status,
                runDir: completion.packet.artifact?.runDir ?? null,
                latestPath: this.latestPath(),
            },
        };

        await fs.mkdir(path.dirname(this.options.commandPath), { recursive: true });
        await fs.writeFile(this.options.commandPath, `${JSON.stringify(doneCommand, null, 2)}\n`, 'utf8');
        this._log(`marked command ${doneCommand.id} done (${doneCommand.completion.status})`);
    }

    /**
     * @returns {string} Progress JSON path.
     */
    progressPath() {
        return path.join(this.options.outRoot, 'progress.json');
    }

    /**
     * @returns {string} Latest result JSON path.
     */
    latestPath() {
        return path.join(this.options.outRoot, 'latest.json');
    }

    async _openBrowserState() {
        await fs.mkdir(this.options.outRoot, { recursive: true });
        const server = await startStaticServer({
            root: this.options.pageRoot,
            repoRoot: REPO_ROOT,
            port: this.options.port,
        });
        const puppeteer = await import('puppeteer');
        let browser = await launchBrowser(puppeteer.default, this.options);
        const hostBridge = {
            progress: (progress) => this._handleHostProgress(progress),
            saveArtifact: (artifact) => this._handleHostArtifact(artifact),
        };
        let page = await openPage({
            browser,
            pageUrl: await this._pageUrl(server),
            options: this.options,
            hostBridge,
        });

        return {
            get page() {
                return page;
            },
            pageUrlForCommand: (command) => this._pageUrl(server, command),
            recover: async () => {
                if (page && !isPageClosed(page)) {
                    await page.close().catch(() => {});
                }
                if (!browser.isConnected()) {
                    browser = await launchBrowser(puppeteer.default, this.options);
                }
                page = await openPage({
                    browser,
                    pageUrl: await this._pageUrl(server),
                    options: this.options,
                    hostBridge,
                });
            },
            close: async () => {
                await browser.close().catch(() => {});
                await stopServer(server).catch(() => {});
            },
        };
    }

    async _pageUrl(server, command = null) {
        const pagePath = normalizePagePath(command?.page ?? 'index.html');
        const fullPagePath = resolveInsideRoot(this.options.pageRoot, pagePath);
        const pageStats = await fs.stat(fullPagePath);
        return `http://127.0.0.1:${server.address().port}/${pagePath}?v=${Math.round(pageStats.mtimeMs)}`;
    }

    async _handleHostProgress(progress) {
        const session = this._activeHostSession;
        if (!session) {
            return Object.freeze({ status: 'ignored', reason: 'no-active-browser-job' });
        }

        const progressPacket = progress && typeof progress === 'object' ? progress : {};
        const message = stringOrDefault(progressPacket.message, 'Browser job progress.');
        const detail = Object.hasOwn(progressPacket, 'detail') ? progressPacket.detail : progressPacket;
        this._log(`job-running: ${message}`);
        session.lastProgressAt = Date.now();
        session.progressWriteQueue = session.progressWriteQueue
            .then(() => this.writeProgress({
                status: 'job-running',
                command: session.command,
                runDir: session.runDir,
                message,
                detail,
            }, { quiet: true }))
            .catch((error) => {
                session.fatalErrors.push({
                    event: 'progress-write-error',
                    ...serializeError(error),
                });
            });

        await session.progressWriteQueue;
        return Object.freeze({ status: 'accepted' });
    }

    async _handleHostArtifact(artifact) {
        const session = this._activeHostSession;
        if (!session) {
            return Object.freeze({ status: 'ignored', reason: 'no-active-browser-job' });
        }

        const write = session.artifactWriteQueue
            .then(() => writeHostArtifact({
                runDir: session.runDir,
                artifact,
            }));
        session.artifactWriteQueue = write.then((savedArtifact) => {
            session.hostArtifacts.push(savedArtifact);
        }).catch((error) => {
            session.fatalErrors.push({
                event: 'artifact-write-error',
                ...serializeError(error),
            });
            throw error;
        });

        const savedArtifact = await write;
        return Object.freeze({
            status: 'accepted',
            artifact: savedArtifact,
        });
    }

    async _runCommand({ page, command, pageUrl }) {
        const normalizedCommand = normalizeCommand(command);
        const runDir = await createRunDirectoryForCommand({
            outRoot: this.options.outRoot,
            command: normalizedCommand,
        });
        const paths = artifactPaths(runDir, {
            callerOwned: Boolean(normalizedCommand.artifactRunDirectory),
        });
        const consoleMessages = [];
        const pageErrors = [];
        const fatalErrors = [];
        const hostArtifacts = [];
        const startedAt = new Date();
        let result = null;
        let evaluationError = null;
        let screenshotError = null;
        let timeoutRecovery = null;
        let skipPageCapture = false;

        const hostSession = {
            command: normalizedCommand,
            runDir,
            hostArtifacts,
            fatalErrors,
            lastProgressAt: Date.now(),
            progressWriteQueue: Promise.resolve(),
            artifactWriteQueue: Promise.resolve(),
        };
        this._activeHostSession = hostSession;

        await this.writeProgress({
            status: 'job-running',
            command: normalizedCommand,
            runDir,
            message: 'Browser page is executing the shader job.',
        });

        const onConsole = (message) => {
            consoleMessages.push({
                type: message.type(),
                text: message.text(),
            });
        };
        const onPageError = (error) => {
            pageErrors.push(serializeError(error));
        };
        const onFatalError = (error) => {
            fatalErrors.push({
                event: 'error',
                ...serializeError(error),
            });
        };
        const onClose = () => {
            fatalErrors.push({
                event: 'close',
                name: 'PageClosed',
                message: 'Puppeteer page closed during command execution.',
                stack: null,
            });
        };

        page.on('console', onConsole);
        page.on('pageerror', onPageError);
        page.on('error', onFatalError);
        page.on('close', onClose);

        try {
            await fs.writeFile(paths.commandPath, `${JSON.stringify(normalizedCommand, null, 2)}\n`, 'utf8');
            try {
                await page.goto(pageUrl, { waitUntil: 'load', timeout: this.options.pageTimeoutMs });
                result = await withProgressInactivityTimeout(
                    page.evaluate(async ({ entrypoint, payload }) => {
                        const runner = window[entrypoint];
                        if (typeof runner !== 'function') {
                            throw new Error(`Browser entrypoint ${entrypoint} is not defined.`);
                        }
                        return runner(payload);
                    }, {
                        entrypoint: normalizedCommand.entrypoint,
                        payload: normalizedCommand.payload,
                    }),
                    () => hostSession.lastProgressAt,
                    this.options.pageTimeoutMs,
                    BROWSER_EVALUATION_TIMEOUT_MESSAGE,
                );
            } catch (error) {
                evaluationError = serializeError(error);
                if (isBrowserEvaluationTimeoutError(error)) {
                    skipPageCapture = true;
                    timeoutRecovery = await forceBrowserRecoveryAfterTimeout(page);
                }
                result = rejectedResult(normalizedCommand, evaluationError);
            }

            if (!normalizedCommand.captures.screenshot) {
                screenshotError = null;
            } else if (skipPageCapture) {
                screenshotError = {
                    name: 'SkippedAfterBrowserEvaluationTimeout',
                    message: 'Screenshot skipped because the browser page was closed for timeout recovery.',
                    stack: null,
                };
            } else {
                try {
                    const screenshotPath = resolveArtifactPath(runDir, normalizedCommand.captures.screenshot);
                    await page.screenshot({ path: screenshotPath });
                    hostArtifacts.push(Object.freeze({
                        name: normalizedCommand.captures.screenshot,
                        kind: 'screenshot',
                        path: screenshotPath,
                    }));
                } catch (error) {
                    screenshotError = serializeError(error);
                }
            }

            await hostSession.artifactWriteQueue.catch(() => {});
            await hostSession.progressWriteQueue.catch(() => {});

            const completedAt = new Date();
            const timings = {
                kind: 'algorithm32-reconciliation-browser-timings',
                startedAt: startedAt.toISOString(),
                completedAt: completedAt.toISOString(),
                durationMs: completedAt.getTime() - startedAt.getTime(),
                pageTiming: result?.timings ?? null,
            };
            const status = browserRunStatus({
                result,
                evaluationError,
                pageErrors,
                fatalErrors,
            });
            const packet = {
                kind: 'algorithm32-reconciliation-browser-run',
                status,
                command: normalizedCommand,
                browser: {
                    pageUrl,
                    pageErrors,
                    fatalErrors,
                    consoleMessages,
                    evaluationError,
                    screenshotError,
                    timeoutRecovery,
                    savedArtifacts: hostArtifacts,
                    requiresPageRecovery: shouldRecoverPage({
                        page,
                        evaluationError,
                        screenshotError,
                        fatalErrors,
                    }),
                },
                result,
                artifact: {
                    runDir,
                    paths,
                    savedArtifacts: hostArtifacts,
                },
                runner: {
                    options: this.options,
                    viewport: DEFAULT_VIEWPORT,
                },
                timings,
            };

            await writeRunArtifactFiles({
                packet,
                paths,
            });
            await fs.writeFile(this.latestPath(), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
            await this.writeProgress({
                status: `job-${status}`,
                command: normalizedCommand,
                runDir,
                message: `Browser shader job completed with status ${status}.`,
            });

            return { runDir, packet };
        } finally {
            this._activeHostSession = null;
            page.off('console', onConsole);
            page.off('pageerror', onPageError);
            page.off('error', onFatalError);
            page.off('close', onClose);
        }
    }

    async _writeHarnessFailure({ command, error, pageUrl }) {
        const normalizedCommand = normalizeCommand({
            ...command,
            label: `${command?.label ?? 'browser-job'}-harness-failure`,
        });
        const runDir = await createRunDirectoryForCommand({
            outRoot: this.options.outRoot,
            command: normalizedCommand,
        });
        const paths = artifactPaths(runDir, {
            callerOwned: Boolean(normalizedCommand.artifactRunDirectory),
        });
        const now = new Date().toISOString();
        const serializedError = serializeError(error);
        const packet = {
            kind: 'algorithm32-reconciliation-browser-run',
            status: 'rejected',
            command: normalizedCommand,
            browser: {
                pageUrl,
                pageErrors: [],
                fatalErrors: [serializedError],
                consoleMessages: [],
                evaluationError: serializedError,
                screenshotError: null,
                timeoutRecovery: null,
                savedArtifacts: [],
                requiresPageRecovery: true,
            },
            result: rejectedResult(normalizedCommand, serializedError),
            artifact: {
                runDir,
                paths,
                savedArtifacts: [],
            },
            runner: {
                options: this.options,
                viewport: DEFAULT_VIEWPORT,
            },
            timings: {
                kind: 'algorithm32-reconciliation-browser-timings',
                startedAt: now,
                completedAt: now,
                durationMs: 0,
                pageTiming: null,
            },
        };

        await writeRunArtifactFiles({
            packet,
            paths,
        });
        await fs.writeFile(this.latestPath(), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
        await this.writeProgress({
            status: 'job-rejected',
            command: normalizedCommand,
            runDir,
            message: `Harness-side failure was captured: ${serializedError.message}`,
        });

        return { runDir, packet };
    }

    _log(message) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }
}

function validateOptions(options) {
    if (!Number.isFinite(options.pollMs) || options.pollMs < 100) {
        throw new Error('pollMs must be a finite number >= 100.');
    }
    if (!Number.isInteger(options.port) || options.port < 0) {
        throw new Error('port must be a nonnegative integer.');
    }
    if (!Number.isFinite(options.pageTimeoutMs) || options.pageTimeoutMs < 1000) {
        throw new Error('pageTimeoutMs must be a finite number >= 1000.');
    }
}

function normalizeCommand(command) {
    const input = command && typeof command === 'object' ? command : {};
    const id = stringOrDefault(input.id, `reconciliation-browser-smoke-${Date.now()}`);
    const label = slug(input.label || input.id || 'reconciliation-browser-smoke');
    const artifactRunDirectory = typeof input.artifactRunDirectory === 'string' && input.artifactRunDirectory.trim()
        ? path.resolve(input.artifactRunDirectory)
        : undefined;
    const payload = input.payload && typeof input.payload === 'object'
        ? Object.freeze(input.payload)
        : Object.freeze({ jobType: 'capability-smoke' });

    return Object.freeze({
        id,
        label,
        page: normalizePagePath(input.page ?? 'index.html'),
        entrypoint: normalizeEntrypoint(input.entrypoint ?? 'runReconciliationShaderJob'),
        captures: normalizeCaptures(input.captures),
        artifactRunDirectory,
        status: input.status === 'done' ? 'done' : 'pending',
        createdAt: stringOrDefault(input.createdAt, new Date().toISOString()),
        completedAt: typeof input.completedAt === 'string' ? input.completedAt : undefined,
        completion: input.completion && typeof input.completion === 'object'
            ? Object.freeze(input.completion)
            : undefined,
        stateGoal: stringOrDefault(
            input.stateGoal,
            'Prove the reconciliation browser watcher can execute a shader job and write diagnostics.',
        ),
        payload,
    });
}

function normalizePagePath(value) {
    const pagePath = stringOrDefault(value, 'index.html').replace(/\\/g, '/').replace(/^\/+/, '');
    const relative = path.posix.normalize(pagePath);
    if (!relative || relative === '.' || relative.startsWith('../') || path.posix.isAbsolute(relative)) {
        throw new Error(`Invalid browser page path: ${value}`);
    }
    return relative;
}

function normalizeEntrypoint(value) {
    const entrypoint = stringOrDefault(value, 'runReconciliationShaderJob');
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(entrypoint)) {
        throw new Error(`Invalid browser entrypoint: ${entrypoint}`);
    }
    return entrypoint;
}

function normalizeCaptures(value) {
    const captures = value && typeof value === 'object' ? value : {};
    return Object.freeze({
        screenshot: typeof captures.screenshot === 'string' && captures.screenshot.trim()
            ? normalizeArtifactName(captures.screenshot)
            : null,
    });
}

async function startStaticServer({ root, repoRoot, port }) {
    const server = http.createServer(async (request, response) => {
        try {
            const requestPath = pathFromRequestUrl(request.url);
            const filePath = resolveStaticFile({
                root,
                repoRoot,
                requestPath,
            });
            const body = await fs.readFile(filePath);
            response.writeHead(200, {
                'content-type': contentType(filePath),
                'cache-control': 'no-store',
            });
            response.end(body);
        } catch (error) {
            response.writeHead(error.code === 'ENOENT' ? 404 : 500);
            response.end(error.code === 'ENOENT' ? 'Not found' : String(error.stack || error));
        }
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
            server.off('error', reject);
            resolve(server);
        });
    });
}

function resolveStaticFile({ root, repoRoot, requestPath }) {
    if (requestPath === 'vendor/three.module.js') {
        return resolveInsideRoot(repoRoot, 'node_modules/three/build/three.module.js');
    }
    if (requestPath === 'vendor/three.core.js') {
        return resolveInsideRoot(repoRoot, 'node_modules/three/build/three.core.js');
    }
    if (requestPath.startsWith('vendor/addons/')) {
        return resolveInsideRoot(
            path.join(repoRoot, 'node_modules/three/examples/jsm'),
            requestPath.slice('vendor/addons/'.length),
        );
    }
    if (requestPath.startsWith('scripts/flat/reconciliation/POC/src/')) {
        return resolveInsideRoot(repoRoot, requestPath);
    }

    return resolveInsideRoot(root, requestPath);
}

function pathFromRequestUrl(requestUrl) {
    const url = new URL(requestUrl, 'http://127.0.0.1');
    return decodeURIComponent(url.pathname) === '/'
        ? 'index.html'
        : decodeURIComponent(url.pathname).slice(1);
}

function resolveInsideRoot(root, relativePath) {
    const filePath = path.resolve(root, relativePath);
    const relative = path.relative(root, filePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        const error = new Error('Forbidden');
        error.code = 'EACCES';
        throw error;
    }

    return filePath;
}

function stopServer(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

async function launchBrowser(puppeteer, options) {
    const args = [
        '--allow-file-access-from-files',
        '--disable-gpu-sandbox',
        '--ignore-gpu-blocklist',
        '--no-sandbox',
    ];
    if (options.useSwiftShader) {
        args.push('--use-gl=swiftshader');
    }

    return puppeteer.launch({
        headless: options.headed ? false : 'new',
        args,
        defaultViewport: DEFAULT_VIEWPORT,
    });
}

async function openPage({ browser, pageUrl, options, hostBridge }) {
    const page = await browser.newPage();
    await page.setViewport(DEFAULT_VIEWPORT);
    page.setDefaultTimeout(options.pageTimeoutMs);
    page.setDefaultNavigationTimeout(options.pageTimeoutMs);
    await installBrowserHostBridge(page, hostBridge);
    await page.goto(pageUrl, {
        waitUntil: 'load',
        timeout: options.pageTimeoutMs,
    });
    return page;
}

async function installBrowserHostBridge(page, hostBridge) {
    await page.exposeFunction('__algorithm32HostProgress', hostBridge.progress);
    await page.exposeFunction('__algorithm32HostSaveArtifact', hostBridge.saveArtifact);
}

async function createRunDirectoryForCommand({ outRoot, command }) {
    if (command.artifactRunDirectory) {
        return useRequestedRunDirectory({
            outRoot,
            runDir: command.artifactRunDirectory,
        });
    }

    return createRunDirectory(outRoot, command.label);
}

async function createRunDirectory(outRoot, label) {
    await fs.mkdir(outRoot, { recursive: true });
    const entries = await fs.readdir(outRoot, { withFileTypes: true });
    let maxPrefix = 0;

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const match = /^(\d+)-/.exec(entry.name);
        if (match) {
            maxPrefix = Math.max(maxPrefix, Number(match[1]));
        }
    }

    const runDir = path.join(outRoot, `${String(maxPrefix + 1).padStart(3, '0')}-${slug(label)}`);
    await fs.mkdir(runDir, { recursive: false });
    return runDir;
}

async function useRequestedRunDirectory({ outRoot, runDir }) {
    const resolvedOutRoot = path.resolve(outRoot);
    const resolvedRunDir = path.resolve(runDir);
    const relative = path.relative(resolvedOutRoot, resolvedRunDir);

    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`artifactRunDirectory must be a child of the watcher output root: ${resolvedRunDir}`);
    }

    await fs.mkdir(resolvedRunDir, { recursive: true });
    return resolvedRunDir;
}

function artifactPaths(runDir, { callerOwned = false } = {}) {
    const recordName = (name) => callerOwned ? `browser-${name}` : name;
    const browserResultDiagnosticsName = callerOwned ? 'browser-result-diagnostics.json' : 'diagnostics.json';

    return Object.freeze({
        commandPath: path.join(runDir, recordName('command.json')),
        stateGoalPath: path.join(runDir, recordName('state-goal.md')),
        inputsPath: path.join(runDir, recordName('inputs.json')),
        provenancePath: path.join(runDir, recordName('provenance.json')),
        resultPath: path.join(runDir, recordName('result.json')),
        criteriaPath: path.join(runDir, recordName('criteria-results.json')),
        diagnosticsPath: path.join(runDir, browserResultDiagnosticsName),
        browserDiagnosticsPath: path.join(runDir, 'browser-diagnostics.json'),
        selectedPixelsPath: path.join(runDir, 'selected-pixels.json'),
        consolePath: path.join(runDir, recordName('console.json')),
        timingsPath: path.join(runDir, recordName('timings.json')),
        screenshotPath: path.join(runDir, 'images', 'screenshot.png'),
        canvasImagePath: path.join(runDir, 'images', 'canvas-image.png'),
        preShaderSceneColorImagePath: path.join(runDir, 'images', 'pre-shader-scene-color.png'),
        reportPath: path.join(runDir, recordName('report.md')),
        runLogPath: path.join(runDir, recordName('run.log')),
    });
}

async function writeHostArtifact({ runDir, artifact }) {
    const request = artifact && typeof artifact === 'object' ? artifact : {};
    const name = normalizeArtifactName(request.name);
    const outputPath = resolveArtifactPath(runDir, name);
    const kind = stringOrDefault(request.kind, 'json');

    if (kind === 'data-url') {
        const dataUrl = typeof request.data === 'string' ? request.data : '';
        const match = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/.exec(dataUrl);
        if (!match) {
            throw new Error(`Artifact ${name} is not a base64 data URL.`);
        }
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, Buffer.from(match[2], 'base64'));
        return Object.freeze({
            name,
            kind,
            mediaType: match[1] ?? null,
            path: outputPath,
        });
    }

    if (kind === 'json') {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, `${JSON.stringify(request.data ?? null, null, 2)}\n`, 'utf8');
        return Object.freeze({ name, kind, path: outputPath });
    }

    if (kind === 'text') {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, String(request.data ?? ''), 'utf8');
        return Object.freeze({ name, kind, path: outputPath });
    }

    throw new Error(`Unsupported browser artifact kind: ${kind}`);
}

function normalizeArtifactName(value) {
    const name = stringOrDefault(value, '').replace(/\\/g, '/').replace(/^\/+/, '');
    const normalized = path.posix.normalize(name);
    if (!normalized || normalized === '.' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
        throw new Error(`Invalid browser artifact name: ${value}`);
    }
    return normalized;
}

function resolveArtifactPath(runDir, name) {
    const normalizedName = normalizeArtifactName(name);
    const outputPath = path.resolve(runDir, normalizedName);
    const relative = path.relative(runDir, outputPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Browser artifact path escapes run directory: ${name}`);
    }
    return outputPath;
}

async function writeRunArtifactFiles({ packet, paths }) {
    const pageCriteriaResults = criteriaResultsFromPage(packet);
    await fs.writeFile(paths.commandPath, `${JSON.stringify(packet.command, null, 2)}\n`, 'utf8');
    await fs.writeFile(paths.stateGoalPath, makeStateGoal(packet), 'utf8');
    await fs.writeFile(paths.inputsPath, `${JSON.stringify(makeInputs(packet), null, 2)}\n`, 'utf8');
    await fs.writeFile(paths.provenancePath, `${JSON.stringify(makeProvenance(packet), null, 2)}\n`, 'utf8');
    await fs.writeFile(paths.resultPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
    await fs.writeFile(paths.criteriaPath, `${JSON.stringify(pageCriteriaResults, null, 2)}\n`, 'utf8');
    await fs.writeFile(paths.diagnosticsPath, `${JSON.stringify(packet.result?.diagnostics ?? null, null, 2)}\n`, 'utf8');
    await fs.writeFile(paths.consolePath, `${JSON.stringify({
        kind: 'algorithm32-reconciliation-browser-console',
        consoleMessages: packet.browser.consoleMessages,
        pageErrors: packet.browser.pageErrors,
        fatalErrors: packet.browser.fatalErrors,
    }, null, 2)}\n`, 'utf8');
    await fs.writeFile(paths.timingsPath, `${JSON.stringify(packet.timings, null, 2)}\n`, 'utf8');
    await fs.writeFile(paths.reportPath, makeReport(packet, pageCriteriaResults), 'utf8');
    await fs.writeFile(paths.runLogPath, makeRunLog(packet, pageCriteriaResults), 'utf8');
}

function criteriaResultsFromPage(packet) {
    const criteria = Array.isArray(packet.result?.criteriaResults)
        ? packet.result.criteriaResults.map(normalizeCriterion)
        : [];
    return Object.freeze({
        kind: 'algorithm32-reconciliation-browser-page-criteria-results',
        status: packet.result?.status ?? packet.status,
        criteria: Object.freeze(criteria),
        summary: summarizeCriteria(criteria),
    });
}

function normalizeCriterion(criterion) {
    return {
        criterionId: stringOrDefault(criterion?.criterionId ?? criterion?.id, 'unnamed-criterion'),
        status: ['pass', 'fail', 'unresolved', 'not-applicable'].includes(criterion?.status)
            ? criterion.status
            : 'unresolved',
        tolerance: criterion?.tolerance ?? null,
        measuredError: criterion?.measuredError ?? null,
        sourceOrStatus: criterion?.sourceOrStatus ?? criterion?.source ?? 'browser-job',
        notes: criterion?.notes ?? '',
    };
}

function summarizeCriteria(criteria) {
    return Object.freeze(criteria.reduce((summary, criterion) => {
        summary.total += 1;
        summary[criterion.status] = (summary[criterion.status] ?? 0) + 1;
        return summary;
    }, {
        total: 0,
        pass: 0,
        fail: 0,
        unresolved: 0,
        'not-applicable': 0,
    }));
}

function browserRunStatus({ result, evaluationError, pageErrors, fatalErrors }) {
    if (
        evaluationError ||
        pageErrors.length > 0 ||
        fatalErrors.length > 0
    ) {
        return 'rejected';
    }

    return result?.status === 'rejected' ? 'rejected' : 'accepted';
}

function shouldRecoverPage({ page, evaluationError, screenshotError, fatalErrors }) {
    if (isPageClosed(page) || fatalErrors.length > 0 || isBrowserEvaluationTimeoutError(evaluationError)) {
        return true;
    }

    const message = [
        evaluationError?.message,
        screenshotError?.message,
    ].filter(Boolean).join('\n');

    return /Target closed|Session closed|Protocol error|detached|browser has disconnected/i.test(message);
}

async function forceBrowserRecoveryAfterTimeout(page) {
    const startedAt = new Date();
    const browser = page && typeof page.browser === 'function' ? page.browser() : null;
    const browserProcess = browser && typeof browser.process === 'function' ? browser.process() : null;
    const recovery = {
        kind: 'algorithm32-reconciliation-browser-timeout-recovery',
        reason: 'browser-evaluation-timeout',
        startedAt: startedAt.toISOString(),
        pageCloseError: null,
        browserCloseError: null,
        browserProcessKilled: false,
    };

    if (page && !isPageClosed(page)) {
        recovery.pageCloseError = await closeWithTimeout({
            action: () => page.close({ runBeforeUnload: false }),
            timeoutMs: RECOVERY_CLOSE_TIMEOUT_MS,
            label: 'page close after timeout',
        });
    }
    if (browser && browser.isConnected()) {
        recovery.browserCloseError = await closeWithTimeout({
            action: () => browser.close(),
            timeoutMs: RECOVERY_CLOSE_TIMEOUT_MS,
            label: 'browser close after timeout',
        });
    }
    if (browserProcess && !browserProcess.killed && (recovery.pageCloseError || recovery.browserCloseError)) {
        try {
            browserProcess.kill('SIGKILL');
            recovery.browserProcessKilled = true;
        } catch (error) {
            recovery.browserProcessKillError = serializeError(error);
        }
    }

    recovery.completedAt = new Date().toISOString();
    return recovery;
}

async function closeWithTimeout({ action, timeoutMs, label }) {
    try {
        await withTimeout(Promise.resolve().then(action), timeoutMs, `${label} timed out.`);
        return null;
    } catch (error) {
        return serializeError(error);
    }
}

function rejectedResult(command, error) {
    return {
        kind: 'algorithm32-reconciliation-browser-result',
        status: 'rejected',
        command,
        diagnostics: {
            status: 'rejected',
            error,
        },
        selectedPixels: [],
        criteriaResults: [{
            criterionId: 'browser-command-returned-result',
            status: 'fail',
            tolerance: 'command returns result packet',
            measuredError: error.message,
            sourceOrStatus: 'runner',
            notes: 'The command did not return a normal browser result packet.',
        }],
    };
}

function makeInputs(packet) {
    return {
        kind: 'algorithm32-reconciliation-browser-inputs',
        command: packet.command,
        runner: packet.runner,
    };
}

function makeProvenance(packet) {
    return {
        kind: 'algorithm32-reconciliation-browser-provenance',
        createdAt: packet.timings.startedAt,
        completedAt: packet.timings.completedAt,
        runnerScript: 'scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js',
        pageRoot: packet.runner.options.pageRoot,
        nodeVersion: process.version,
    };
}

function makeStateGoal(packet) {
    return [
        '# State Goal',
        '',
        packet.command.stateGoal,
        '',
        `Status: ${packet.status}`,
        `Page: ${packet.command.page}`,
        `Entrypoint: ${packet.command.entrypoint}`,
        '',
    ].join('\n');
}

function makeReport(packet, criteriaResults) {
    const artifactNames = (packet.artifact?.savedArtifacts ?? [])
        .map((artifact) => `- \`${artifact.name}\``)
        .join('\n') || '- none requested or saved';

    return [
        '# Browser Shader Job',
        '',
        `Status: ${packet.status}`,
        '',
        `Command: \`${packet.command.id}\``,
        `Page: \`${packet.command.page}\``,
        `Entrypoint: \`${packet.command.entrypoint}\``,
        `Page criteria: ${criteriaResults.summary.pass}/${criteriaResults.summary.total} pass, ${criteriaResults.summary.fail} fail`,
        '',
        '## Outputs',
        '',
        artifactNames,
        '',
        '- browser metadata files are written with `browser-*` names when the submitter owns the record folder.',
        '- `progress.json` in the output root tracks live watcher progress.',
        '',
    ].join('\n');
}

function makeRunLog(packet, criteriaResults) {
    return [
        `${packet.timings.startedAt} started command=${packet.command.id}`,
        `${packet.timings.completedAt} completed status=${packet.status}`,
        `pageCriteriaPass=${criteriaResults.summary.pass}`,
        `pageCriteriaFail=${criteriaResults.summary.fail}`,
        `savedArtifactCount=${packet.artifact?.savedArtifacts?.length ?? 0}`,
        `requiresPageRecovery=${packet.browser.requiresPageRecovery}`,
        '',
    ].join('\n');
}

function contentType(filePath) {
    if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
    if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
    if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
    return 'application/octet-stream';
}

function serializeError(error) {
    return {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error),
        stack: error?.stack ?? null,
    };
}

function isBrowserEvaluationTimeoutError(error) {
    return Boolean(error?.message?.includes(BROWSER_EVALUATION_TIMEOUT_MESSAGE));
}

function isPageClosed(page) {
    return !page || (typeof page.isClosed === 'function' && page.isClosed());
}

function stringOrDefault(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function slug(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 64) || 'run';
}

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function withTimeout(promise, timeoutMs, message) {
    let timeoutId;
    const timeout = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function withProgressInactivityTimeout(promise, lastProgressAt, timeoutMs, message) {
    let intervalId;
    const timeout = new Promise((resolve, reject) => {
        const pollMs = Math.max(250, Math.min(1000, Math.floor(timeoutMs / 20)));
        intervalId = setInterval(() => {
            if (Date.now() - lastProgressAt() >= timeoutMs) {
                reject(new Error(message));
            }
        }, pollMs);
    });

    return Promise.race([promise, timeout]).finally(() => clearInterval(intervalId));
}
