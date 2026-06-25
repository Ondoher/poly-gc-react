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
const DEFAULT_OUT_ROOT = path.join(REPO_ROOT, 'tmp/atmosphere/algorithm32_shader_lab');
const DEFAULT_VIEWPORT = Object.freeze({
	width: 640,
	height: 360,
	deviceScaleFactor: 1,
});
const DEFAULT_PAGE_TIMEOUT_MS = 300000;

function parseArgs(argv) {
	const options = {
		mode: 'once',
		headed: false,
		outRoot: DEFAULT_OUT_ROOT,
		commandPath: null,
		pollMs: 750,
		port: 0,
		pageTimeoutMs: DEFAULT_PAGE_TIMEOUT_MS,
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
		options.commandPath = path.join(options.outRoot, 'command.json');
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
	console.log(`Algorithm32 shader lab harness

Usage:
  node scripts/flat/algorithm32-shader-lab/harness.js --once
  node scripts/flat/algorithm32-shader-lab/harness.js --watch

Options:
  --once              Run one smoke capture and exit.
  --watch             Keep Chromium open and rerun when command.json changes.
  --headed            Show the Chromium window instead of headless mode.
  --out-root <path>   Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --command <path>    Command JSON path. Default: <out-root>/command.json
  --poll-ms <ms>      Watch polling interval. Default: 750
  --page-timeout-ms <ms>
                      Browser navigation/evaluation timeout. Default: 300000
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
	const browser = await launchBrowser(options);
	const page = await browser.newPage();
	let closing = false;

	const close = async () => {
		if (closing) {
			return;
		}
		closing = true;
		await browser.close().catch(() => {});
		await stopServer(server).catch(() => {});
	};

	process.once('SIGINT', () => {
		close().finally(() => process.exit(130));
	});
	process.once('SIGTERM', () => {
		close().finally(() => process.exit(143));
	});

	try {
		await page.setViewport(DEFAULT_VIEWPORT);
		page.setDefaultTimeout(options.pageTimeoutMs);
		page.setDefaultNavigationTimeout(options.pageTimeoutMs);
		const labUrl = `http://127.0.0.1:${server.address().port}/index.html`;
		await page.goto(labUrl, {
			waitUntil: 'load',
			timeout: options.pageTimeoutMs,
		});

		if (options.mode === 'once') {
			const command = await readOrCreateCommand(options.commandPath);
			const run = await runCommand({
				page,
				command,
				outRoot: options.outRoot,
				pageTimeoutMs: options.pageTimeoutMs,
			});
			console.log(`Shader lab smoke run written to ${run.runDir}`);
		} else {
			await runWatchLoop({ page, options });
		}
	} finally {
		await close();
	}
}

async function launchBrowser(options) {
	return puppeteer.launch({
		headless: options.headed ? false : 'new',
		args: [
			'--allow-file-access-from-files',
			'--disable-gpu-sandbox',
			'--no-sandbox',
			'--use-gl=swiftshader',
		],
		defaultViewport: DEFAULT_VIEWPORT,
	});
}

async function runWatchLoop({ page, options }) {
	console.log(`Shader lab watch mode is active.`);
	console.log(`Command file: ${options.commandPath}`);
	console.log(`Output root:  ${options.outRoot}`);
	let lastFingerprint = '';

	for (;;) {
		await writeHeartbeat(options.outRoot, options.commandPath, options);
		const command = await readOrCreateCommand(options.commandPath);
		const fingerprint = await commandFingerprint(options.commandPath, command);

		if (fingerprint !== lastFingerprint) {
			lastFingerprint = fingerprint;
			const run = await runCommand({
				page,
				command,
				outRoot: options.outRoot,
				pageTimeoutMs: options.pageTimeoutMs,
			});
			console.log(`Completed ${path.basename(run.runDir)}`);
		}

		await delay(options.pollMs);
	}
}

async function runCommand({ page, command, outRoot, pageTimeoutMs }) {
	const normalizedCommand = normalizeCommand(command);
	const runDir = await createRunDirectory(outRoot, normalizedCommand.label);
	const resultPath = path.join(runDir, 'result.json');
	const screenshotPath = path.join(runDir, 'screenshot.png');
	const canvasImagePath = path.join(runDir, 'canvas-image.png');
	const commandPath = path.join(runDir, 'command.json');
	const consolePath = path.join(runDir, 'console.json');
	const diagnosticsPath = path.join(runDir, 'diagnostics.json');
	const selectedPixelsPath = path.join(runDir, 'selected-pixels.json');
	const timingsPath = path.join(runDir, 'timings.json');
	const reportPath = path.join(runDir, 'report.md');
	const consoleMessages = [];
	const pageErrors = [];
	const startedAt = new Date();

	const onConsole = (message) => {
		consoleMessages.push({
			type: message.type(),
			text: message.text(),
		});
	};
	const onPageError = (error) => {
		pageErrors.push({
			name: error.name,
			message: error.message,
			stack: error.stack,
		});
	};

	page.on('console', onConsole);
	page.on('pageerror', onPageError);

	try {
		await fs.writeFile(commandPath, JSON.stringify(normalizedCommand, null, 2));
		await page.reload({ waitUntil: 'load', timeout: pageTimeoutMs });
		const result = await withTimeout(
			page.evaluate(async (browserCommand) => {
				return window.runShaderLabSmoke(browserCommand);
			}, normalizedCommand),
			pageTimeoutMs,
			'Browser command evaluation timed out.'
		);
		await page.screenshot({ path: screenshotPath });
		const wroteCanvasImage = await writeCanvasImageDataUrl({
			result,
			canvasImagePath,
		});
		const completedAt = new Date();
		const timings = {
			kind: 'algorithm32-shader-lab-timings',
			startedAt: startedAt.toISOString(),
			completedAt: completedAt.toISOString(),
			durationMs: completedAt.getTime() - startedAt.getTime(),
			pageTiming: result && result.timings ? result.timings : null,
		};

		const packet = {
			kind: 'algorithm32-shader-lab-harness-result',
			status: pageErrors.length === 0 && result && result.status !== 'rejected'
				? 'accepted'
				: 'rejected',
			command: normalizedCommand,
			result,
			browser: {
				consoleMessages,
				pageErrors,
			},
			timings,
			artifacts: {
				runDir,
				commandPath,
				resultPath,
				screenshotPath,
				canvasImagePath: wroteCanvasImage ? canvasImagePath : null,
				consolePath,
				diagnosticsPath,
				selectedPixelsPath,
				timingsPath,
				reportPath,
			},
		};

		await fs.writeFile(resultPath, JSON.stringify(packet, null, 2));
		await fs.writeFile(consolePath, JSON.stringify({
			kind: 'algorithm32-shader-lab-console',
			consoleMessages,
			pageErrors,
		}, null, 2));
		await fs.writeFile(diagnosticsPath, JSON.stringify({
			kind: 'algorithm32-shader-lab-diagnostics',
			diagnostics: result && result.diagnostics ? result.diagnostics : null,
		}, null, 2));
		await fs.writeFile(selectedPixelsPath, JSON.stringify({
			kind: 'algorithm32-shader-lab-selected-pixels',
			selectedPixels: result && result.selectedPixels ? result.selectedPixels : [],
		}, null, 2));
		await fs.writeFile(timingsPath, JSON.stringify(timings, null, 2));
		await fs.writeFile(reportPath, makeReport(packet));
		await fs.writeFile(path.join(outRoot, 'latest.json'), JSON.stringify(packet, null, 2));
		return { runDir, packet };
	} finally {
		page.off('console', onConsole);
		page.off('pageerror', onPageError);
	}
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
		: `smoke-${Date.now()}`;
	const label = slug(input.label || input.id || 'smoke-reload');

	return {
		id,
		label,
		createdAt: input.createdAt || new Date().toISOString(),
		payload: input.payload && typeof input.payload === 'object'
			? input.payload
			: {
				message: 'Edit command.json while --watch is running to trigger another reload.',
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
			id: 'initial-smoke',
			label: 'smoke-reload',
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

async function writeHeartbeat(outRoot, commandPath, options = {}) {
	await fs.writeFile(path.join(outRoot, 'harness-heartbeat.json'), JSON.stringify({
		kind: 'algorithm32-shader-lab-heartbeat',
		updatedAt: new Date().toISOString(),
		commandPath,
		pageTimeoutMs: options.pageTimeoutMs || DEFAULT_PAGE_TIMEOUT_MS,
		pid: process.pid,
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
	const [root, relativePath] = pathname.startsWith('/node_modules/')
		? [NODE_MODULES_ROOT, pathname.slice('/node_modules/'.length)]
		: [
				pageRoot,
				pathname === '/' ? 'index.html' : pathname.slice(1),
			];
	const filePath = path.resolve(root, relativePath);

	if (!filePath.startsWith(root)) {
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
	return 'application/octet-stream';
}

function makeReport(packet) {
	const result = packet.result || {};
	const diagnostics = result.diagnostics || {};
	const selectedPixels = result.selectedPixels || [];

	return [
		'# Algorithm32 Shader Lab Run',
		'',
		`Status: ${packet.status}`,
		'',
		`Command: \`${packet.command.id}\``,
		`Label: \`${packet.command.label}\``,
		`Result kind: \`${result.kind || 'unknown'}\``,
		'',
		'## Outputs',
		'',
		'- `screenshot.png`: browser capture.',
		'- `result.json`: full harness result packet.',
		'- `diagnostics.json`: browser-side diagnostics.',
		'- `selected-pixels.json`: selected pixel colors, rays, and hit data when available.',
		'- `console.json`: browser console and page errors.',
		'- `timings.json`: harness and page timing data.',
		'',
		'## Summary',
		'',
		`- Page errors: ${packet.browser.pageErrors.length}`,
		`- Console messages: ${packet.browser.consoleMessages.length}`,
		`- Selected pixels: ${selectedPixels.length}`,
		`- Diagnostics status: ${diagnostics.status || 'not supplied'}`,
		'',
	].join('\n');
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
