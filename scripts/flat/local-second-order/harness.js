import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const PAGE_ROOT = path.join(__dirname, 'page');
const NODE_MODULES_ROOT = path.join(REPO_ROOT, 'node_modules');
const SHARED_ROOT = path.join(REPO_ROOT, 'shared');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'scripts');
const DEFAULT_OUT_ROOT = path.join(REPO_ROOT, 'tmp/atmosphere/local-second-order');
const DEFAULT_VIEWPORT = Object.freeze({
	width: 640,
	height: 360,
	deviceScaleFactor: 1,
});
const DEFAULT_PAGE_TIMEOUT_MS = 300000;
const BROWSER_EVALUATION_TIMEOUT_MESSAGE =
	'Browser command evaluation timed out.';
const RECOVERY_CLOSE_TIMEOUT_MS = 10000;

function parseArgs(argv) {
	const options = {
		mode: 'once',
		headed: false,
		outRoot: DEFAULT_OUT_ROOT,
		commandPath: null,
		pollMs: 750,
		port: 0,
		pageTimeoutMs: DEFAULT_PAGE_TIMEOUT_MS,
		useSwiftShader: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--once') {
			options.mode = 'once';
		} else if (arg === '--watch') {
			options.mode = 'watch';
		} else if (arg === '--headed') {
			options.headed = true;
		} else if (arg === '--out-root') {
			options.outRoot = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--command') {
			options.commandPath = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--poll-ms') {
			options.pollMs = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--page-timeout-ms') {
			options.pageTimeoutMs = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--use-swiftshader') {
			options.useSwiftShader = true;
		} else if (arg === '--port') {
			options.port = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	if (!options.commandPath) {
		options.commandPath = path.join(options.outRoot, 'browser-command.json');
	}

	if (!Number.isFinite(options.pollMs) || options.pollMs < 100) {
		throw new Error('--poll-ms must be a finite number >= 100');
	}

	if (!Number.isInteger(options.port) || options.port < 0) {
		throw new Error('--port must be a nonnegative integer');
	}

	if (
		!Number.isFinite(options.pageTimeoutMs) ||
		options.pageTimeoutMs < 1000
	) {
		throw new Error('--page-timeout-ms must be a finite number >= 1000');
	}

	return options;
}

function printHelp() {
	console.log(`Algorithm32 local second-order browser harness

Usage:
  node scripts/flat/local-second-order/harness.js --once
  node scripts/flat/local-second-order/harness.js --watch

Options:
  --once              Run one browser command and exit.
  --watch             Keep Chromium open and rerun when browser-command.json changes.
  --headed            Show the Chromium window instead of headless mode.
  --out-root <path>   Output root. Default: tmp/atmosphere/local-second-order
  --command <path>    Command JSON path. Default: <out-root>/browser-command.json
  --poll-ms <ms>      Watch polling interval. Default: 750
  --page-timeout-ms <ms>
                      Browser navigation/evaluation timeout. Default: 300000
  --use-swiftshader   Force Chromium WebGL through SwiftShader software GL.
                      Default is hardware WebGL when Chromium can use it.
  --port <port>       Static server port, or 0 for an ephemeral port.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.help) {
		printHelp();
		return;
	}

	await fs.mkdir(options.outRoot, { recursive: true });
	const server = await startStaticServer({ root: PAGE_ROOT, port: options.port });
	const state = {
		browser: await launchBrowser(options),
		page: null,
		recoverBeforeNextRun: false,
		lastRecoveryAt: null,
		recoveryCount: 0,
	};
	let closing = false;

	const close = async () => {
		if (closing) {
			return;
		}
		closing = true;
		await state.browser.close().catch(() => {});
		await stopServer(server).catch(() => {});
	};

	process.once('SIGINT', () => {
		close().finally(() => process.exit(130));
	});
	process.once('SIGTERM', () => {
		close().finally(() => process.exit(143));
	});

	try {
		const labUrl = `http://127.0.0.1:${server.address().port}/index.html`;
		await ensureHealthyPage({ state, labUrl, options });

		if (options.mode === 'once') {
			const command = await readOrCreateCommand(options.commandPath);
			const run = await runCommand({
				page: state.page,
				command,
				outRoot: options.outRoot,
				pageTimeoutMs: options.pageTimeoutMs,
				labUrl,
				options,
			});
			console.log(`Local second-order browser run written to ${run.runDir}`);
		} else {
			await runWatchLoop({ state, labUrl, options });
		}
	} finally {
		await close();
	}
}

async function launchBrowser(options) {
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

async function openHarnessPage({ browser, labUrl, options }) {
	const page = await browser.newPage();
	await page.setViewport(DEFAULT_VIEWPORT);
	page.setDefaultTimeout(options.pageTimeoutMs);
	page.setDefaultNavigationTimeout(options.pageTimeoutMs);
	await page.goto(labUrl, {
		waitUntil: 'load',
		timeout: options.pageTimeoutMs,
	});
	return page;
}

async function ensureHealthyPage({ state, labUrl, options }) {
	if (!state.browser || !state.browser.isConnected()) {
		if (state.browser) {
			await state.browser.close().catch(() => {});
		}
		state.browser = await launchBrowser(options);
		state.page = null;
		state.recoveryCount += 1;
		state.lastRecoveryAt = new Date().toISOString();
	}

	if (!state.page || isPageClosed(state.page) || state.recoverBeforeNextRun) {
		if (state.page && !isPageClosed(state.page)) {
			await state.page.close().catch(() => {});
		}
		state.page = await openHarnessPage({
			browser: state.browser,
			labUrl,
			options,
		});
		state.recoverBeforeNextRun = false;
		state.recoveryCount += 1;
		state.lastRecoveryAt = new Date().toISOString();
	}
}

async function runWatchLoop({ state, labUrl, options }) {
	console.log('Local second-order watch mode is active.');
	console.log(`Command file: ${options.commandPath}`);
	console.log(`Output root:  ${options.outRoot}`);
	let lastFingerprint = '';

	for (;;) {
		await writeHeartbeat(options.outRoot, options.commandPath, options, state);
		let command;
		let fingerprint;

		try {
			command = await readOrCreateCommand(options.commandPath);
			fingerprint = await commandFingerprint(options.commandPath, command);
		} catch (error) {
			console.error(`Unable to read browser command: ${error.message}`);
			await delay(options.pollMs);
			continue;
		}

		if (fingerprint !== lastFingerprint) {
			lastFingerprint = fingerprint;
			await ensureHealthyPage({ state, labUrl, options });

			try {
				const run = await runCommand({
					page: state.page,
					command,
					outRoot: options.outRoot,
					pageTimeoutMs: options.pageTimeoutMs,
					labUrl,
					options,
				});
				if (run.packet.browser.requiresPageRecovery) {
					state.recoverBeforeNextRun = true;
				}
				console.log(`Completed ${path.basename(run.runDir)} (${run.packet.status})`);
			} catch (error) {
				const run = await writeHarnessFailureArtifact({
					command,
					outRoot: options.outRoot,
					labUrl,
					options,
					error,
				});
				state.recoverBeforeNextRun = true;
				console.error(`Recovered after harness failure: ${error.message}`);
				console.log(`Completed ${path.basename(run.runDir)} (${run.packet.status})`);
			}
		}

		await delay(options.pollMs);
	}
}

async function runCommand({
	page,
	command,
	outRoot,
	pageTimeoutMs,
	labUrl,
	options,
}) {
	const normalizedCommand = normalizeCommand(command);
	const runDir = await createRunDirectory(outRoot, normalizedCommand.label);
	const paths = artifactPaths(runDir);
	const consoleMessages = [];
	const pageErrors = [];
	const fatalErrors = [];
	const startedAt = new Date();
	let result = null;
	let evaluationError = null;
	let screenshotError = null;
	let timeoutRecovery = null;
	let skipPageCapture = false;
	let wroteCanvasImage = false;

	const onConsole = (message) => {
		consoleMessages.push({
			type: message.type(),
			text: message.text(),
		});
	};
	const onPageError = (error) => {
		pageErrors.push(serializeError(error));
	};
	const onFatalPageError = (error) => {
		fatalErrors.push({
			event: 'error',
			...serializeError(error),
		});
	};
	const onPageClose = () => {
		fatalErrors.push({
			event: 'close',
			name: 'PageClosed',
			message: 'Puppeteer page closed during command execution.',
			stack: null,
		});
	};

	page.on('console', onConsole);
	page.on('pageerror', onPageError);
	page.on('error', onFatalPageError);
	page.on('close', onPageClose);

	try {
		await fs.writeFile(paths.commandPath, JSON.stringify(normalizedCommand, null, 2));
		try {
			await page.reload({ waitUntil: 'load', timeout: pageTimeoutMs });
			result = await withTimeout(
				page.evaluate(async (browserCommand) => {
					if (typeof window.runLocalSecondOrderCommand !== 'function') {
						throw new Error('window.runLocalSecondOrderCommand is not defined.');
					}
					return window.runLocalSecondOrderCommand(browserCommand);
				}, normalizedCommand),
				pageTimeoutMs,
				BROWSER_EVALUATION_TIMEOUT_MESSAGE
			);
		} catch (error) {
			evaluationError = serializeError(error);
			if (isBrowserEvaluationTimeoutError(error)) {
				skipPageCapture = true;
				timeoutRecovery = await forceBrowserRecoveryAfterTimeout(page);
			}
			result = rejectedResult(normalizedCommand, evaluationError);
		}

		if (skipPageCapture) {
			screenshotError = {
				name: 'SkippedAfterBrowserEvaluationTimeout',
				message:
					'Screenshot skipped because the browser page was closed for timeout recovery.',
				stack: null,
			};
		} else {
			try {
				await page.screenshot({ path: paths.screenshotPath });
			} catch (error) {
				screenshotError = serializeError(error);
			}
		}

		wroteCanvasImage = await writeCanvasImageDataUrl({
			result,
			canvasImagePath: paths.canvasImagePath,
		});
		const completedAt = new Date();
		const timings = {
			kind: 'algorithm32-local-second-order-timings',
			startedAt: startedAt.toISOString(),
			completedAt: completedAt.toISOString(),
			durationMs: completedAt.getTime() - startedAt.getTime(),
			pageTiming: result && result.timings ? result.timings : null,
		};
		const criteriaResults = normalizeCriteriaResults({
			result,
			evaluationError,
			pageErrors,
			fatalErrors,
			wroteCanvasImage,
		});
		const requiresPageRecovery = shouldRecoverPage({
			page,
			evaluationError,
			screenshotError,
			fatalErrors,
		});
		const status = resultStatus({
			result,
			criteriaResults,
			evaluationError,
			pageErrors,
			fatalErrors,
		});
		const packet = {
			kind: 'algorithm32-local-second-order-harness-result',
			status,
			command: normalizedCommand,
			result,
			browser: {
				pageErrors,
				fatalErrors,
				consoleMessages,
				evaluationError,
				screenshotError,
				timeoutRecovery,
				wroteCanvasImage,
				requiresPageRecovery,
			},
			artifact: {
				runDir,
				paths,
			},
			harness: {
				pageUrl: labUrl,
				commandPath: options.commandPath,
				outRoot,
				pageTimeoutMs,
				useSwiftShader: options.useSwiftShader,
				pid: process.pid,
			},
			timings,
		};

		await writeArtifactFiles({
			packet,
			criteriaResults,
			timings,
			consoleMessages,
			pageErrors,
			runDir,
			paths,
		});
		await appendRunningLog(outRoot, packet, criteriaResults);
		await fs.writeFile(path.join(outRoot, 'latest.json'), JSON.stringify(packet, null, 2));
		return { runDir, packet };
	} finally {
		page.off('console', onConsole);
		page.off('pageerror', onPageError);
		page.off('error', onFatalPageError);
		page.off('close', onPageClose);
	}
}

async function writeHarnessFailureArtifact({
	command,
	outRoot,
	labUrl,
	options,
	error,
}) {
	const normalizedCommand = normalizeCommand({
		...command,
		label: `${command && command.label ? command.label : 'browser-command'}-harness-failure`,
	});
	const runDir = await createRunDirectory(outRoot, normalizedCommand.label);
	const paths = artifactPaths(runDir);
	const startedAt = new Date();
	const completedAt = new Date();
	const serializedError = serializeError(error);
	const result = rejectedResult(normalizedCommand, serializedError);
	const criteriaResults = {
		kind: 'algorithm32-local-second-order-criteria-results',
		status: 'rejected',
		summary: {
			total: 1,
			pass: 0,
			fail: 1,
			unresolved: 0,
			'not-applicable': 0,
		},
		criteria: [{
			criterionId: 'harness-command-run-completed',
			status: 'fail',
			tolerance: 'normal artifact writer completes',
			measuredError: serializedError.message,
			sourceOrStatus: 'harness',
			notes: 'The watch loop caught an unexpected harness-side error and stayed alive.',
		}],
	};
	const timings = {
		kind: 'algorithm32-local-second-order-timings',
		startedAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		pageTiming: null,
	};
	const packet = {
		kind: 'algorithm32-local-second-order-harness-result',
		status: 'rejected',
		command: normalizedCommand,
		result,
		browser: {
			pageErrors: [],
			fatalErrors: [serializedError],
			consoleMessages: [],
			evaluationError: serializedError,
			screenshotError: null,
			wroteCanvasImage: false,
			requiresPageRecovery: true,
		},
		artifact: {
			runDir,
			paths,
		},
			harness: {
				pageUrl: labUrl,
				commandPath: options.commandPath,
				outRoot,
				pageTimeoutMs: options.pageTimeoutMs,
				useSwiftShader: options.useSwiftShader,
				pid: process.pid,
			},
		timings,
	};

	await writeArtifactFiles({
		packet,
		criteriaResults,
		timings,
		consoleMessages: [],
		pageErrors: [],
		runDir,
		paths,
	});
	await appendRunningLog(outRoot, packet, criteriaResults);
	await fs.writeFile(path.join(outRoot, 'latest.json'), JSON.stringify(packet, null, 2));
	return { runDir, packet };
}

function artifactPaths(runDir) {
	const diagnosticsDir = path.join(runDir, 'diagnostics');
	return {
		diagnosticsDir,
		stateGoalPath: path.join(runDir, 'state-goal.md'),
		inputsPath: path.join(runDir, 'inputs.json'),
		provenancePath: path.join(runDir, 'provenance.json'),
		equationsPath: path.join(runDir, 'equations-and-constants.json'),
		resultPath: path.join(runDir, 'result.json'),
		criteriaPath: path.join(runDir, 'criteria-results.json'),
		diagnosticsPath: path.join(runDir, 'diagnostics.json'),
		selectedPixelsPath: path.join(runDir, 'selected-pixels.json'),
		timingsPath: path.join(runDir, 'timings.json'),
		reportPath: path.join(runDir, 'report.md'),
		consolePath: path.join(runDir, 'console.json'),
		commandPath: path.join(runDir, 'command.json'),
		runLogPath: path.join(runDir, 'run.log'),
		screenshotPath: path.join(runDir, 'screenshot.png'),
		canvasImagePath: path.join(runDir, 'canvas-image.png'),
		diagnosticsBrowserPath: path.join(diagnosticsDir, 'browser-diagnostics.json'),
		diagnosticsSelectedPixelsPath: path.join(diagnosticsDir, 'selected-pixels.json'),
	};
}

async function writeArtifactFiles({
	packet,
	criteriaResults,
	timings,
	consoleMessages,
	pageErrors,
	runDir,
	paths,
}) {
	await fs.mkdir(paths.diagnosticsDir, { recursive: true });
	await fs.writeFile(paths.commandPath, JSON.stringify(packet.command, null, 2));
	await fs.writeFile(paths.stateGoalPath, makeStateGoal(packet, criteriaResults));
	await fs.writeFile(paths.inputsPath, JSON.stringify(makeInputs(packet), null, 2));
	await fs.writeFile(paths.provenancePath, JSON.stringify(makeProvenance(packet), null, 2));
	await fs.writeFile(paths.equationsPath, JSON.stringify(makeEquationsAndConstants(packet), null, 2));
	await fs.writeFile(paths.resultPath, JSON.stringify(packet, null, 2));
	await fs.writeFile(paths.criteriaPath, JSON.stringify(criteriaResults, null, 2));
	await fs.writeFile(paths.diagnosticsPath, JSON.stringify({
		kind: 'algorithm32-local-second-order-diagnostics',
		diagnostics: packet.result && packet.result.diagnostics ? packet.result.diagnostics : null,
	}, null, 2));
	const selectedPixelsPacket = {
		kind: 'algorithm32-local-second-order-selected-pixels',
		selectedPixels: packet.result && Array.isArray(packet.result.selectedPixels)
			? packet.result.selectedPixels
			: [],
	};
	await fs.writeFile(paths.selectedPixelsPath, JSON.stringify(selectedPixelsPacket, null, 2));
	await fs.writeFile(paths.diagnosticsBrowserPath, JSON.stringify({
		kind: 'algorithm32-local-second-order-browser-diagnostics',
		diagnostics: packet.result && packet.result.diagnostics ? packet.result.diagnostics : null,
		browser: packet.browser,
	}, null, 2));
	await fs.writeFile(paths.diagnosticsSelectedPixelsPath, JSON.stringify(selectedPixelsPacket, null, 2));
	await fs.writeFile(paths.timingsPath, JSON.stringify(timings, null, 2));
	await fs.writeFile(paths.consolePath, JSON.stringify({
		kind: 'algorithm32-local-second-order-console',
		consoleMessages,
		pageErrors,
	}, null, 2));
	await fs.writeFile(paths.reportPath, makeReport(packet, criteriaResults));
	await fs.writeFile(paths.runLogPath, makeRunLog(packet, criteriaResults));
}

function makeInputs(packet) {
	return {
		kind: 'algorithm32-local-second-order-inputs',
		schemaVersion: 1,
		runId: path.basename(packet.artifact.runDir),
		stateGoal: packet.command.stateGoal,
		command: packet.command,
		browser: {
			pageUrl: packet.harness.pageUrl,
			viewport: DEFAULT_VIEWPORT,
			pageTimeoutMs: packet.harness.pageTimeoutMs,
			useSwiftShader: packet.harness.useSwiftShader,
		},
		sourceBoundary: {
			status: 'browser-harness-preflight',
			notes: [
				'This harness smoke run proves browser command execution and artifact capture only.',
				'Future local second-order milestones should import shared POC modules explicitly.',
			],
		},
	};
}

function makeProvenance(packet) {
	return {
		kind: 'algorithm32-local-second-order-provenance',
		schemaVersion: 1,
		status: packet.status,
		createdAt: packet.timings.startedAt,
		completedAt: packet.timings.completedAt,
		artifactFolder: packet.artifact.runDir,
		commandPath: packet.harness.commandPath,
		pageUrl: packet.harness.pageUrl,
		harnessScript: path.relative(REPO_ROOT, __filename),
		pageRoot: path.relative(REPO_ROOT, PAGE_ROOT),
		nodeVersion: process.version,
		pid: process.pid,
		sourceBoundary: 'shared-poc-modules-and-lane-page-only',
	};
}

function makeEquationsAndConstants(packet) {
	return {
		kind: 'algorithm32-local-second-order-equations-and-constants',
		schemaVersion: 1,
		status: 'browser-runner-preflight',
		physicalTransportExecuted: false,
		notes: [
			'No Algorithm32 transport equation is evaluated by the default browser-smoke command.',
			'The viewport, timeout, command, and browser capabilities are harness controls, not physics constants.',
		],
		harnessControls: {
			viewport: DEFAULT_VIEWPORT,
			pageTimeoutMs: packet.harness.pageTimeoutMs,
			useSwiftShader: packet.harness.useSwiftShader,
		},
	};
}

function normalizeCriteriaResults({
	result,
	evaluationError,
	pageErrors,
	fatalErrors,
	wroteCanvasImage,
}) {
	const criteria = Array.isArray(result && result.criteriaResults)
		? result.criteriaResults.map(normalizeCriterion)
		: [];

	criteria.unshift({
		criterionId: 'browser-command-evaluation',
		status: evaluationError ? 'fail' : 'pass',
		tolerance: 'no exception',
		measuredError: evaluationError ? evaluationError.message : 0,
		sourceOrStatus: 'harness',
		notes: evaluationError
			? 'The browser command threw before returning a result.'
			: 'The browser command returned a result packet.',
	});
	criteria.push({
		criterionId: 'page-errors-empty',
		status: pageErrors.length === 0 ? 'pass' : 'fail',
		tolerance: '0 page errors',
		measuredError: pageErrors.length,
		sourceOrStatus: 'harness',
		notes: 'Page errors are captured from Puppeteer pageerror events.',
	});
	criteria.push({
		criterionId: 'page-fatal-errors-empty',
		status: fatalErrors.length === 0 ? 'pass' : 'fail',
		tolerance: '0 page crash/close events',
		measuredError: fatalErrors.length,
		sourceOrStatus: 'harness',
		notes: 'Fatal page errors are captured from Puppeteer error and close events.',
	});
	criteria.push({
		criterionId: 'canvas-image-captured',
		status: wroteCanvasImage ? 'pass' : 'fail',
		tolerance: 'one PNG data URL',
		measuredError: wroteCanvasImage ? 0 : 1,
		sourceOrStatus: 'harness',
		notes: 'The browser command should return imageDataUrl for visual smoke artifacts.',
	});

	const summary = summarizeCriteria(criteria);

	return {
		kind: 'algorithm32-local-second-order-criteria-results',
		status: summary.fail === 0 ? 'accepted' : 'rejected',
		summary,
		criteria,
	};
}

function normalizeCriterion(criterion) {
	const input = criterion && typeof criterion === 'object' ? criterion : {};
	return {
		criterionId: String(input.criterionId || input.id || 'unnamed-criterion'),
		status: ['pass', 'fail', 'unresolved', 'not-applicable'].includes(input.status)
			? input.status
			: 'unresolved',
		tolerance: input.tolerance ?? null,
		measuredError: input.measuredError ?? null,
		sourceOrStatus: input.sourceOrStatus || input.source || 'browser-command',
		notes: input.notes || '',
	};
}

function summarizeCriteria(criteria) {
	return criteria.reduce((summary, criterion) => {
		summary.total += 1;
		summary[criterion.status] = (summary[criterion.status] || 0) + 1;
		return summary;
	}, {
		total: 0,
		pass: 0,
		fail: 0,
		unresolved: 0,
		'not-applicable': 0,
	});
}

function resultStatus({
	result,
	criteriaResults,
	evaluationError,
	pageErrors,
	fatalErrors,
}) {
	if (
		evaluationError ||
		pageErrors.length > 0 ||
		fatalErrors.length > 0 ||
		criteriaResults.summary.fail > 0
	) {
		return 'rejected';
	}
	return result && result.status === 'rejected' ? 'rejected' : 'accepted';
}

function shouldRecoverPage({
	page,
	evaluationError,
	screenshotError,
	fatalErrors,
}) {
	if (isPageClosed(page) || fatalErrors.length > 0) {
		return true;
	}

	if (isBrowserEvaluationTimeoutError(evaluationError)) {
		return true;
	}

	const message = [
		evaluationError && evaluationError.message,
		screenshotError && screenshotError.message,
	].filter(Boolean).join('\n');

	return /Target closed|Session closed|Protocol error|detached|browser has disconnected/i.test(message);
}

async function forceBrowserRecoveryAfterTimeout(page) {
	const startedAt = new Date();
	const browser = page && typeof page.browser === 'function'
		? page.browser()
		: null;
	const browserProcess = browser && typeof browser.process === 'function'
		? browser.process()
		: null;
	const recovery = {
		kind: 'algorithm32-local-second-order-timeout-recovery',
		reason: 'browser-evaluation-timeout',
		startedAt: startedAt.toISOString(),
		pageCloseError: null,
		browserCloseError: null,
		browserProcessKilled: false,
	};

	if (page && !isPageClosed(page)) {
		recovery.pageCloseError = await closeWithTimeout({
			label: 'Puppeteer page close during timeout recovery',
			action: () => page.close({ runBeforeUnload: false }),
			timeoutMs: RECOVERY_CLOSE_TIMEOUT_MS,
		});
	}

	if (browser && browser.isConnected()) {
		recovery.browserCloseError = await closeWithTimeout({
			label: 'Puppeteer browser close during timeout recovery',
			action: () => browser.close(),
			timeoutMs: RECOVERY_CLOSE_TIMEOUT_MS,
		});
	}

	if (
		browserProcess &&
		!browserProcess.killed &&
		(
			recovery.pageCloseError ||
			recovery.browserCloseError ||
			(browser && browser.isConnected())
		)
	) {
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

async function closeWithTimeout({ label, action, timeoutMs }) {
	try {
		await withTimeout(
			Promise.resolve().then(action),
			timeoutMs,
			`${label} timed out after ${timeoutMs} ms.`
		);
		return null;
	} catch (error) {
		return serializeError(error);
	}
}

function isBrowserEvaluationTimeoutError(error) {
	return Boolean(
		error &&
		typeof error.message === 'string' &&
		error.message.includes(BROWSER_EVALUATION_TIMEOUT_MESSAGE)
	);
}

function isPageClosed(page) {
	return !page || (typeof page.isClosed === 'function' && page.isClosed());
}

async function writeCanvasImageDataUrl({ result, canvasImagePath }) {
	const imageDataUrl = result && typeof result.imageDataUrl === 'string'
		? result.imageDataUrl
		: null;

	if (!imageDataUrl) {
		return false;
	}

	const match = /^data:image\/png;base64,(.+)$/.exec(imageDataUrl);

	if (!match) {
		return false;
	}

	await fs.writeFile(canvasImagePath, Buffer.from(match[1], 'base64'));
	return true;
}

function normalizeCommand(command) {
	const input = command && typeof command === 'object' ? command : {};
	const id = typeof input.id === 'string' && input.id.trim()
		? input.id.trim()
		: `browser-smoke-${Date.now()}`;
	const label = slug(input.label || input.id || 'browser-runner-smoke');

	return {
		id,
		label,
		type: input.type || 'browser-smoke',
		createdAt: input.createdAt || new Date().toISOString(),
		stateGoal: input.stateGoal ||
			'Prove the local second-order browser harness can execute a command and write a complete artifact.',
		payload: input.payload && typeof input.payload === 'object'
			? input.payload
			: {
				message: 'Edit browser-command.json while --watch is running to trigger another reload.',
			},
	};
}

async function readOrCreateCommand(commandPath) {
	try {
		const text = await fs.readFile(commandPath, 'utf8');
		return JSON.parse(text);
	} catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
		const command = normalizeCommand({
			id: 'initial-browser-smoke',
			label: 'browser-runner-smoke',
			type: 'browser-smoke',
		});
		await fs.mkdir(path.dirname(commandPath), { recursive: true });
		await fs.writeFile(commandPath, JSON.stringify(command, null, 2));
		return command;
	}
}

async function commandFingerprint(commandPath, command) {
	const stats = await fs.stat(commandPath);
	return JSON.stringify({
		mtimeMs: stats.mtimeMs,
		size: stats.size,
		command,
	});
}

async function writeHeartbeat(outRoot, commandPath, options = {}, state = null) {
	await fs.writeFile(path.join(outRoot, 'harness-heartbeat.json'), JSON.stringify({
		kind: 'algorithm32-local-second-order-heartbeat',
		updatedAt: new Date().toISOString(),
		commandPath,
		outRoot,
		pageTimeoutMs: options.pageTimeoutMs || DEFAULT_PAGE_TIMEOUT_MS,
		useSwiftShader: options.useSwiftShader === true,
		pid: process.pid,
		browserConnected: state && state.browser
			? state.browser.isConnected()
			: null,
		pageClosed: state && state.page
			? isPageClosed(state.page)
			: null,
		recoverBeforeNextRun: state ? state.recoverBeforeNextRun : null,
		recoveryCount: state ? state.recoveryCount : null,
		lastRecoveryAt: state ? state.lastRecoveryAt : null,
	}, null, 2));
}

async function createRunDirectory(outRoot, label) {
	await fs.mkdir(outRoot, { recursive: true });
	const entries = await fs.readdir(outRoot, { withFileTypes: true });
	let maxPrefix = 0;

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const match = /^(\d+)-/.exec(entry.name);
		if (match) {
			maxPrefix = Math.max(maxPrefix, Number(match[1]));
		}
	}

	const prefix = String(maxPrefix + 1).padStart(3, '0');
	const runDir = path.join(outRoot, `${prefix}-${slug(label)}`);
	await fs.mkdir(runDir, { recursive: false });
	return runDir;
}

function startStaticServer({ root, port }) {
	const server = http.createServer(async (request, response) => {
		try {
			const filePath = resolveStaticFilePath(request.url, root);

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

function resolveStaticFilePath(requestUrl, pageRoot) {
	const url = new URL(requestUrl, 'http://127.0.0.1');
	const pathname = decodeURIComponent(url.pathname);
	const routes = [
		['/node_modules/', NODE_MODULES_ROOT],
		['/shared/', SHARED_ROOT],
		['/scripts/', SCRIPTS_ROOT],
	];

	for (const [prefix, root] of routes) {
		if (pathname.startsWith(prefix)) {
			return resolveInsideRoot(root, pathname.slice(prefix.length));
		}
	}

	return resolveInsideRoot(
		pageRoot,
		pathname === '/' ? 'index.html' : pathname.slice(1)
	);
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
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

function contentType(filePath) {
	if (filePath.endsWith('.html')) {
		return 'text/html; charset=utf-8';
	}
	if (filePath.endsWith('.js')) {
		return 'text/javascript; charset=utf-8';
	}
	if (filePath.endsWith('.css')) {
		return 'text/css; charset=utf-8';
	}
	if (filePath.endsWith('.json')) {
		return 'application/json; charset=utf-8';
	}
	if (filePath.endsWith('.wasm')) {
		return 'application/wasm';
	}
	return 'application/octet-stream';
}

function makeStateGoal(packet, criteriaResults) {
	return [
		'# State Goal',
		'',
		packet.command.stateGoal,
		'',
		`Status: ${packet.status}`,
		'',
		'## Attempted',
		'',
		`- Command id: \`${packet.command.id}\``,
		`- Command type: \`${packet.command.type}\``,
		`- Criteria: ${criteriaResults.summary.pass}/${criteriaResults.summary.total} pass, ${criteriaResults.summary.fail} fail`,
		'',
		'## Next',
		'',
		packet.status === 'accepted'
			? '- Browser harness preflight is ready for later local second-order browser commands.'
			: '- Inspect `result.json`, `console.json`, and `criteria-results.json`, then rerun with a fresh artifact.',
		'',
	].join('\n');
}

function makeReport(packet, criteriaResults) {
	const result = packet.result || {};
	const diagnostics = result.diagnostics || {};
	const selectedPixels = Array.isArray(result.selectedPixels)
		? result.selectedPixels
		: [];

	return [
		'# Local Second-Order Browser Harness Run',
		'',
		`Status: ${packet.status}`,
		'',
		`Command: \`${packet.command.id}\``,
		`Label: \`${packet.command.label}\``,
		`Type: \`${packet.command.type}\``,
		`Result kind: \`${result.kind || 'unknown'}\``,
		'',
		'## Outputs',
		'',
		'- `screenshot.png`: browser capture.',
		'- `canvas-image.png`: command-returned canvas PNG when available.',
		'- `result.json`: full harness result packet.',
		'- `criteria-results.json`: machine-readable acceptance criteria.',
		'- `diagnostics.json`: browser-side diagnostics.',
		'- `selected-pixels.json`: selected canvas pixels when available.',
		'- `console.json`: browser console and page errors.',
		'- `state-goal.md`: compact continuation note for this artifact.',
		'',
		'## Summary',
		'',
		`- Criteria: ${criteriaResults.summary.pass}/${criteriaResults.summary.total} pass, ${criteriaResults.summary.fail} fail`,
		`- Page errors: ${packet.browser.pageErrors.length}`,
		`- Fatal page events: ${packet.browser.fatalErrors.length}`,
		`- Page recovery requested: ${packet.browser.requiresPageRecovery ? 'yes' : 'no'}`,
		`- Console messages: ${packet.browser.consoleMessages.length}`,
		`- Selected pixels: ${selectedPixels.length}`,
		`- Diagnostics status: ${diagnostics.status || 'not supplied'}`,
		'',
	].join('\n');
}

function makeRunLog(packet, criteriaResults) {
	return [
		`startedAt=${packet.timings.startedAt}`,
		`completedAt=${packet.timings.completedAt}`,
		`status=${packet.status}`,
		`command=${packet.command.id}`,
		`type=${packet.command.type}`,
		`criteriaPass=${criteriaResults.summary.pass}`,
		`criteriaFail=${criteriaResults.summary.fail}`,
		`pageErrors=${packet.browser.pageErrors.length}`,
		`fatalPageEvents=${packet.browser.fatalErrors.length}`,
		`requiresPageRecovery=${packet.browser.requiresPageRecovery}`,
		'',
	].join('\n');
}

async function appendRunningLog(outRoot, packet, criteriaResults) {
	const relativeRunDir = path.relative(outRoot, packet.artifact.runDir);
	const entry = [
		`## ${path.basename(packet.artifact.runDir)}`,
		'',
		`- Status: ${packet.status}`,
		`- Command: \`${packet.command.id}\``,
		`- Type: \`${packet.command.type}\``,
		`- Criteria: ${criteriaResults.summary.pass}/${criteriaResults.summary.total} pass, ${criteriaResults.summary.fail} fail`,
		`- Page recovery requested: ${packet.browser.requiresPageRecovery ? 'yes' : 'no'}`,
		`- Artifact: \`${relativeRunDir}\``,
		'',
	].join('\n');
	await fs.appendFile(path.join(outRoot, 'running-log.md'), entry);
}

function rejectedResult(command, error) {
	return {
		kind: 'algorithm32-local-second-order-browser-result',
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
			sourceOrStatus: 'harness',
			notes: 'The command did not return a normal browser result packet.',
		}],
	};
}

function serializeError(error) {
	return {
		name: error && error.name ? error.name : 'Error',
		message: error && error.message ? error.message : String(error),
		stack: error && error.stack ? error.stack : null,
	};
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
		timeoutId = setTimeout(() => {
			reject(new Error(message));
		}, timeoutMs);
	});

	return Promise.race([promise, timeout]).finally(() => {
		clearTimeout(timeoutId);
	});
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
