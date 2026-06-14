import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const DEFAULT_URL = 'https://localhost/flat/false-simulation';
const DEFAULT_VIEWPORT = Object.freeze({ width: 1192, height: 643 });
const DEFAULT_LABEL = 'phase-1';
const DEFAULT_OUTPUT_ROOT = 'agents/topics/apps/flat/baselines/daytime-atmosphere';
const DEFAULT_WAIT_MS = 1500;
const SAMPLE_POINTS = Object.freeze({
	upperSky: Object.freeze({ x: 0.5, y: 0.18 }),
	centerSky: Object.freeze({ x: 0.5, y: 0.42 }),
	horizon: Object.freeze({ x: 0.5, y: 0.62 }),
	mountainBand: Object.freeze({ x: 0.5, y: 0.69 }),
	localFloor: Object.freeze({ x: 0.5, y: 0.84 }),
	leftStarProbe: Object.freeze({ x: 0.28, y: 0.32 }),
	rightStarProbe: Object.freeze({ x: 0.72, y: 0.32 }),
});

function parseArgs(argv) {
	const options = {
		url: DEFAULT_URL,
		viewport: { ...DEFAULT_VIEWPORT },
		label: DEFAULT_LABEL,
		outputRoot: DEFAULT_OUTPUT_ROOT,
		waitMs: DEFAULT_WAIT_MS,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = argv[index + 1];

		if (arg === '--url' && next) {
			options.url = next;
			index += 1;
		} else if (arg === '--label' && next) {
			options.label = next;
			index += 1;
		} else if (arg === '--out' && next) {
			options.outputRoot = next;
			index += 1;
		} else if (arg === '--wait-ms' && next) {
			options.waitMs = Number(next);
			index += 1;
		} else if (arg === '--viewport' && next) {
			options.viewport = parseViewport(next);
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		} else {
			throw new Error(`Unknown or incomplete option: ${arg}`);
		}
	}

	return options;
}

function parseViewport(value) {
	const match = /^(\d+)x(\d+)$/i.exec(value);

	if (!match) {
		throw new Error(`Viewport must look like 1192x643, received: ${value}`);
	}

	return {
		width: Number(match[1]),
		height: Number(match[2]),
	};
}

function printHelp() {
	console.log(`Capture flat daytime atmosphere baseline samples.

Usage:
  node scripts/flat/capture-atmosphere-baseline.js [options]

Options:
  --url <url>             App URL. Default: ${DEFAULT_URL}
  --viewport <WxH>        Browser viewport. Default: ${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height}
  --label <name>          Output folder label. Default: ${DEFAULT_LABEL}
  --out <path>            Output root. Default: ${DEFAULT_OUTPUT_ROOT}
  --wait-ms <number>      Delay after canvas render before capture. Default: ${DEFAULT_WAIT_MS}
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const outputDir = path.resolve(options.outputRoot, options.label);
	const screenshotPath = path.join(outputDir, 'screenshot.png');
	const samplesPath = path.join(outputDir, 'samples.json');
	const readmePath = path.join(outputDir, 'README.md');
	const browser = await puppeteer.launch({
		headless: true,
		ignoreHTTPSErrors: true,
		args: ['--ignore-certificate-errors'],
	});
	const page = await browser.newPage();
	const consoleErrors = [];
	const pageErrors = [];

	await page.setViewport({
		width: options.viewport.width,
		height: options.viewport.height,
		deviceScaleFactor: 1,
	});

	page.on('console', (message) => {
		if (message.type() === 'error') {
			consoleErrors.push(message.text());
		}
	});
	page.on('pageerror', (error) => {
		pageErrors.push(error.message);
	});

	try {
		await page.goto(options.url, {
			waitUntil: 'domcontentloaded',
			timeout: 30000,
		});
		const canvas = await page.waitForSelector('canvas', {
			visible: true,
			timeout: 30000,
		});

		await page.waitForFunction(() => {
			const canvasElement = document.querySelector('canvas');

			return Boolean(canvasElement?.width && canvasElement?.height);
		}, { timeout: 30000 });
		await page.waitForTimeout(options.waitMs);
		await fs.mkdir(outputDir, { recursive: true });
		await canvas.screenshot({ path: screenshotPath });

		const screenshot = await sharp(screenshotPath)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const samples = sampleImage(screenshot);
		const nonblank = hasNonblankSamples(samples);
		const result = {
			kind: 'flat-daytime-atmosphere-baseline',
			capturedAt: new Date().toISOString(),
			url: options.url,
			viewport: options.viewport,
			canvas: {
				width: screenshot.info.width,
				height: screenshot.info.height,
			},
			samplePoints: SAMPLE_POINTS,
			samples,
			screenshotPath: relativePath(screenshotPath),
			consoleErrors,
			pageErrors,
			nonblank,
		};

		await fs.writeFile(samplesPath, `${JSON.stringify(result, null, 2)}\n`);
		await fs.writeFile(readmePath, baselineReadme(result));

		if (!nonblank) {
			throw new Error('Captured canvas appears blank from baseline sample points.');
		}
		if (pageErrors.length > 0) {
			throw new Error(`Page errors were reported: ${pageErrors.join(' | ')}`);
		}

		console.log(`Captured ${relativePath(samplesPath)}`);
		console.log(JSON.stringify(samples, null, 2));
	} finally {
		await browser.close();
	}
}

function sampleImage(screenshot) {
	return Object.entries(SAMPLE_POINTS).reduce((samples, [name, point]) => {
		const x = clamp(Math.round(point.x * (screenshot.info.width - 1)), 0, screenshot.info.width - 1);
		const y = clamp(Math.round(point.y * (screenshot.info.height - 1)), 0, screenshot.info.height - 1);
		const offset = ((y * screenshot.info.width) + x) * screenshot.info.channels;

		samples[name] = {
			point,
			pixel: { x, y },
			rgb: [
				screenshot.data[offset],
				screenshot.data[offset + 1],
				screenshot.data[offset + 2],
			],
		};

		return samples;
	}, {});
}

function hasNonblankSamples(samples) {
	return Object.values(samples).some((sample) => (
		sample.rgb[0] > 0 || sample.rgb[1] > 0 || sample.rgb[2] > 0
	));
}

function baselineReadme(result) {
	const rows = Object.entries(result.samples).map(([name, sample]) => (
		`| ${name} | ${sample.pixel.x}, ${sample.pixel.y} | ${sample.rgb.join(', ')} |`
	));

	return `# ${result.kind}: ${result.capturedAt}

- URL: ${result.url}
- Viewport: ${result.viewport.width}x${result.viewport.height}
- Canvas: ${result.canvas.width}x${result.canvas.height}
- Screenshot: [screenshot.png](screenshot.png)
- Console errors: ${result.consoleErrors.length}
- Page errors: ${result.pageErrors.length}

| Sample | Pixel | RGB |
| --- | ---: | ---: |
${rows.join('\n')}
`;
}

function relativePath(targetPath) {
	return path.relative(process.cwd(), targetPath).replace(/\\/g, '/');
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
