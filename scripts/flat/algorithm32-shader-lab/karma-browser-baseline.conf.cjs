'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ArtifactReporter = require('./karma-browser-baseline-reporter.cjs');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(REPO_ROOT, 'tmp/atmosphere/algorithm32_shader_lab');
const outRoot = path.resolve(process.env.ALGORITHM32_SHADER_LAB_OUT_ROOT || DEFAULT_OUT_ROOT);
const label = process.env.ALGORITHM32_SHADER_LAB_LABEL || 'browser-three-baseline-karma';
const runDir = createRunDirectory(outRoot, label);
const command = {
	id: 'browser-three-baseline-iteration-1-karma',
	label,
	createdAt: new Date().toISOString(),
	payload: {
		mode: 'browser-three-baseline',
		iteration: '1-browser-three-scene-baseline',
		runner: 'karma-chrome-headless-local',
		goal: 'Render a browser Three scene without atmosphere and return scene color plus equivalent raycaster hit diagnostics.',
	},
};

fs.writeFileSync(path.join(runDir, 'command.json'), JSON.stringify(command, null, 2));

module.exports = function(config) {
	process.env.CHROME_BIN = process.env.CHROME_BIN ||
		'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

	config.set({
		basePath: REPO_ROOT,
		frameworks: ['jasmine'],
		files: [
			{ pattern: 'node_modules/three/build/three.module.js', included: false, type: 'module' },
			{ pattern: 'scripts/flat/algorithm32-shader-lab/page/shader-lab.js', included: false, type: 'module' },
			{ pattern: 'scripts/flat/algorithm32-shader-lab/browser-three-baseline.karma.js', type: 'module' },
		],
		proxies: {
			'/node_modules/': '/base/node_modules/',
		},
		plugins: [
			require('karma-jasmine'),
			require('karma-chrome-launcher'),
			require('karma-spec-reporter'),
			{ 'reporter:algorithm32-artifact': ['type', ArtifactReporter] },
		],
		reporters: ['spec', 'algorithm32-artifact'],
		port: 9877,
		colors: true,
		autoWatch: false,
		client: {
			captureConsole: true,
			algorithm32ShaderLabCommand: command,
		},
		customLaunchers: {
			ChromeHeadlessLocal: {
				base: 'ChromeHeadless',
				flags: [
					'--disable-gpu',
					'--disable-gpu-sandbox',
					'--no-sandbox',
					'--no-first-run',
					'--no-default-browser-check',
					'--use-gl=swiftshader',
				],
			},
		},
		browsers: ['ChromeHeadlessLocal'],
		singleRun: true,
		concurrency: 1,
		captureTimeout: 20000,
		browserNoActivityTimeout: 20000,
		browserDisconnectTimeout: 5000,
		browserDisconnectTolerance: 0,
		browserConsoleLogOptions: {
			terminal: true,
			level: 'error',
		},
		algorithm32ShaderLab: {
			runDir,
			command,
			latestPath: path.join(outRoot, 'latest-karma-browser-baseline.json'),
		},
	});
};

function createRunDirectory(root, rawLabel) {
	fs.mkdirSync(root, { recursive: true });
	const maxPrefix = fs.readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => /^(\d+)-/.exec(entry.name))
		.filter(Boolean)
		.reduce((max, match) => Math.max(max, Number(match[1])), 0);
	const prefix = String(maxPrefix + 1).padStart(3, '0');
	const dir = path.join(root, `${prefix}-${slug(rawLabel)}`);
	fs.mkdirSync(dir);
	return dir;
}

function slug(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 64) || 'run';
}
