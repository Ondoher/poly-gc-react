'use strict';

const fs = require('node:fs');
const path = require('node:path');

function Algorithm32ArtifactReporter(baseReporterDecorator, config) {
	baseReporterDecorator(this);

	const labConfig = config.algorithm32ShaderLab || {};
	const runDir = labConfig.runDir;
	const command = labConfig.command || {};
	const startedAt = new Date();
	const browserLogs = [];
	const browserInfos = [];

	this.onBrowserLog = (browser, log, type) => {
		browserLogs.push({
			browser: browser.name,
			type,
			log,
		});
	};

	this.onBrowserInfo = (browser, info) => {
		browserInfos.push({
			browser: browser.name,
			info,
		});
	};

	this.onRunComplete = (browsers, results) => {
		const completedAt = new Date();
		const payload = browserInfos
			.map((entry) => entry.info && entry.info.algorithm32ShaderLab)
			.find((entry) => entry && entry.type === 'browser-three-baseline-result');
		const browserResult = payload ? payload.result : null;
		const strippedResult = stripImageData(browserResult);
		const status = results.error || results.failed > 0 || !browserResult || browserResult.status !== 'accepted'
			? 'rejected'
			: 'accepted';
		const artifacts = artifactPaths(runDir);
		const criteria = buildCriteria({ status, results, browserResult });
		const timings = {
			kind: 'algorithm32-shader-lab-karma-timings',
			startedAt: startedAt.toISOString(),
			completedAt: completedAt.toISOString(),
			durationMs: completedAt.getTime() - startedAt.getTime(),
			pageTiming: browserResult && browserResult.timings ? browserResult.timings : null,
		};
		const packet = {
			kind: 'algorithm32-shader-lab-karma-result',
			status,
			command,
			result: strippedResult,
			karma: {
				error: results.error,
				disconnected: results.disconnected,
				failed: results.failed,
				success: results.success,
				exitCode: results.exitCode,
				browsers: browsers.map((browser) => browser.name),
			},
			browser: {
				logs: browserLogs,
				infos: browserInfos.map((entry) => ({
					browser: entry.browser,
					keys: entry.info ? Object.keys(entry.info) : [],
				})),
			},
			criteria,
			timings,
			artifacts,
		};

		fs.mkdirSync(runDir, { recursive: true });
		writeScreenshot(browserResult, artifacts.screenshotPath);
		fs.writeFileSync(artifacts.resultPath, JSON.stringify(packet, null, 2));
		fs.writeFileSync(artifacts.consolePath, JSON.stringify({
			kind: 'algorithm32-shader-lab-karma-console',
			logs: browserLogs,
		}, null, 2));
		fs.writeFileSync(artifacts.diagnosticsPath, JSON.stringify({
			kind: 'algorithm32-shader-lab-karma-diagnostics',
			diagnostics: strippedResult && strippedResult.diagnostics ? strippedResult.diagnostics : null,
		}, null, 2));
		fs.writeFileSync(artifacts.selectedPixelsPath, JSON.stringify({
			kind: 'algorithm32-shader-lab-karma-selected-pixels',
			selectedPixels: strippedResult && strippedResult.selectedPixels ? strippedResult.selectedPixels : [],
		}, null, 2));
		fs.writeFileSync(artifacts.criteriaPath, JSON.stringify(criteria, null, 2));
		fs.writeFileSync(artifacts.timingsPath, JSON.stringify(timings, null, 2));
		fs.writeFileSync(artifacts.reportPath, makeReport(packet));
		fs.writeFileSync(artifacts.runLogPath, makeRunLog(packet));

		if (labConfig.latestPath) {
			fs.writeFileSync(labConfig.latestPath, JSON.stringify(packet, null, 2));
		}
	};
}

Algorithm32ArtifactReporter.$inject = ['baseReporterDecorator', 'config'];

function artifactPaths(runDir) {
	return {
		runDir,
		commandPath: path.join(runDir, 'command.json'),
		resultPath: path.join(runDir, 'result.json'),
		screenshotPath: path.join(runDir, 'screenshot.png'),
		consolePath: path.join(runDir, 'console.json'),
		diagnosticsPath: path.join(runDir, 'diagnostics.json'),
		selectedPixelsPath: path.join(runDir, 'selected-pixels.json'),
		criteriaPath: path.join(runDir, 'criteria-results.json'),
		timingsPath: path.join(runDir, 'timings.json'),
		reportPath: path.join(runDir, 'report.md'),
		runLogPath: path.join(runDir, 'run.log'),
	};
}

function stripImageData(result) {
	if (!result || typeof result !== 'object') {
		return result;
	}

	const clone = { ...result };
	delete clone.imageDataUrl;
	return clone;
}

function writeScreenshot(result, screenshotPath) {
	if (!result || typeof result.imageDataUrl !== 'string') {
		return;
	}

	const prefix = 'data:image/png;base64,';
	if (!result.imageDataUrl.startsWith(prefix)) {
		return;
	}

	fs.writeFileSync(screenshotPath, Buffer.from(result.imageDataUrl.slice(prefix.length), 'base64'));
}

function buildCriteria({ status, results, browserResult }) {
	const selectedPixels = browserResult && Array.isArray(browserResult.selectedPixels)
		? browserResult.selectedPixels
		: [];
	const rgbaSet = new Set(selectedPixels.map((sample) => JSON.stringify(sample.rgba)));

	return {
		kind: 'algorithm32-shader-lab-karma-criteria',
		status,
		items: [
			{
				id: 'karma-completed',
				status: results.error || results.failed > 0 || results.disconnected ? 'failed' : 'passed',
				summary: 'Karma completed without browser errors, failed specs, or disconnects.',
			},
			{
				id: 'browser-result-returned',
				status: browserResult ? 'passed' : 'failed',
				summary: 'The browser sent a structured Algorithm32 shader-lab result through Karma info.',
			},
			{
				id: 'scene-nonblank',
				status: rgbaSet.size > 1 ? 'passed' : 'failed',
				summary: 'Selected scene pixels are not all the same color.',
			},
			{
				id: 'sky-and-object-classification',
				status: selectedPixels.some((sample) => sample.classification === 'sky') &&
					selectedPixels.some((sample) => sample.classification !== 'sky')
					? 'passed'
					: 'failed',
				summary: 'Selected pixels include both sky and finite scene-object hits.',
			},
			{
				id: 'ray-hit-diagnostics',
				status: selectedPixels.every((sample) => sample.threeRay && sample.rgba) ? 'passed' : 'failed',
				summary: 'Every selected pixel contains color and Three ray diagnostics.',
			},
		],
	};
}

function makeReport(packet) {
	const selectedPixels = packet.result && packet.result.selectedPixels
		? packet.result.selectedPixels
		: [];

	return [
		'# Browser Three Scene Baseline',
		'',
		`Status: ${packet.status}`,
		'',
		'This artifact was produced by the bounded Karma fallback runner after the long-running Puppeteer harness hung before producing an artifact.',
		'',
		'## Outputs',
		'',
		'- `screenshot.png`: PNG exported from the browser WebGL canvas.',
		'- `result.json`: full Karma/browser packet, without the inline PNG data URL.',
		'- `diagnostics.json`: browser Three/WebGL/camera diagnostics.',
		'- `selected-pixels.json`: sampled colors, classifications, rays, and hit distances.',
		'- `criteria-results.json`: objective Iteration 1 checks.',
		'- `console.json`: browser logs captured by Karma.',
		'- `timings.json`: Karma and browser timing data.',
		'',
		'## Summary',
		'',
		`- Selected pixels: ${selectedPixels.length}`,
		`- Karma failed specs: ${packet.karma.failed}`,
		`- Karma disconnected: ${Boolean(packet.karma.disconnected)}`,
		`- Browser result kind: ${packet.result ? packet.result.kind : 'missing'}`,
		'',
		'## Intentionally Absent',
		'',
		'- No atmosphere shader is included in Iteration 1.',
		'- No CPU reference image or shader diff image is included in this baseline artifact.',
		'- Depth texture readback remains deferred; raycaster hit distance is the current equivalent object-hit diagnostic.',
		'',
	].join('\n');
}

function makeRunLog(packet) {
	return [
		`${packet.timings.startedAt} Started bounded Karma browser baseline.`,
		`${packet.timings.completedAt} Completed with status ${packet.status}.`,
		`Karma success=${packet.karma.success} failed=${packet.karma.failed} disconnected=${Boolean(packet.karma.disconnected)}.`,
		'Learned: the browser scene baseline can be captured without the long-running Puppeteer watch loop when Karma owns the Chrome lifecycle.',
		'',
	].join('\n');
}

module.exports = Algorithm32ArtifactReporter;
