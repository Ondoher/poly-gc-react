import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
	LARGE_FACES_DIR,
	OUTPUT_3D_DIR,
	OUTPUT_VALIDATION_DIR,
} from '../shared/asset-paths.js';
import { loadFacePreprocessingMetadata } from './face-preprocessing-metadata.js';

const DEFAULT_PORT = 4328;
const PORT = Number(process.env.PORT || process.argv[2] || DEFAULT_PORT);
const INFERENCE_DIR = path.resolve(OUTPUT_3D_DIR, 'metadata-inference');
const DRAFT_PATH = path.resolve(process.cwd(), readArgument('--draft') || path.resolve(INFERENCE_DIR, 'reference-glyphs.draft.json'));
const REVIEWED_PATH = path.resolve(process.cwd(), readArgument('--reviewed') || path.resolve(INFERENCE_DIR, 'reference-glyphs.reviewed.json'));
const PAGE_TITLE = readArgument('--title') || 'Reference Glyph Metadata Review';
const SCRIPT_PATH = fileURLToPath(import.meta.url);

const server = http.createServer(async (request, response) => {
	try {
		const url = new URL(request.url, `http://${request.headers.host}`);

		if (request.method === 'GET' && url.pathname === '/') {
			return sendHtml(response, pageHtml());
		}

		if (request.method === 'GET' && url.pathname === '/api/draft') {
			return sendJson(response, readDraft());
		}

		if (request.method === 'POST' && url.pathname === '/api/recreate') {
			return sendJson(response, recreateDraftMetadata());
		}

		if (request.method === 'POST' && url.pathname === '/api/save') {
			const body = await readRequestBody(request);
			const payload = JSON.parse(body);
			saveReviewed(payload);
			return sendJson(response, {
				ok: true,
				path: path.relative(process.cwd(), REVIEWED_PATH).replaceAll('\\', '/'),
			});
		}

		if (request.method === 'POST' && url.pathname === '/api/preprocess') {
			const body = await readRequestBody(request);
			const payload = JSON.parse(body);
			saveReviewed(payload);
			return sendJson(response, preprocessReviewed(payload));
		}

		if (request.method === 'GET' && url.pathname.startsWith('/reference/')) {
			return sendReferenceImage(response, decodeURIComponent(url.pathname.slice('/reference/'.length)));
		}

		if (request.method === 'GET' && url.pathname === '/asset') {
			return sendAsset(response, url.searchParams.get('path') || '');
		}

		sendText(response, 404, 'Not found');
	} catch (error) {
		console.error(error);
		sendText(response, 500, error.stack || String(error));
	}
});

server.listen(PORT, () => {
	console.log(`Reference glyph metadata review server`);
	console.log(`URL: http://localhost:${PORT}/`);
	console.log(`Draft: ${path.relative(process.cwd(), DRAFT_PATH)}`);
	console.log(`Reviewed output: ${path.relative(process.cwd(), REVIEWED_PATH)}`);
	console.log(`Script: ${path.relative(process.cwd(), SCRIPT_PATH)}`);
});

function readArgument(name) {
	const index = process.argv.indexOf(name);
	if (index < 0) {
		return null;
	}

	const values = [];
	for (let argumentIndex = index + 1; argumentIndex < process.argv.length; argumentIndex += 1) {
		const value = process.argv[argumentIndex];
		if (value.startsWith('--')) {
			break;
		}
		values.push(value);
	}

	return values.length > 0 ? values.join(' ') : null;
}

function readDraft() {
	const readablePath = fs.existsSync(REVIEWED_PATH) ? REVIEWED_PATH : DRAFT_PATH;

	if (!fs.existsSync(readablePath)) {
		throw new Error(`Missing draft metadata: ${path.relative(process.cwd(), DRAFT_PATH)}`);
	}

	return JSON.parse(fs.readFileSync(readablePath, 'utf8'));
}

function saveReviewed(payload) {
	fs.mkdirSync(path.dirname(REVIEWED_PATH), { recursive: true });
	fs.writeFileSync(REVIEWED_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

function recreateDraftMetadata() {
	const command = [
		path.resolve('scripts', '3d-assets', 'infer-reference-face-metadata.js'),
	];
	const result = spawnSync(process.execPath, command, {
		cwd: process.cwd(),
		encoding: 'utf8',
		shell: false,
	});
	const defaultDraftPath = path.resolve(INFERENCE_DIR, 'reference-glyphs.draft.json');
	const draftWasWritten = fs.existsSync(defaultDraftPath);
	if (draftWasWritten && path.resolve(DRAFT_PATH) !== defaultDraftPath) {
		fs.copyFileSync(defaultDraftPath, DRAFT_PATH);
	}
	const draft = draftWasWritten ? JSON.parse(fs.readFileSync(DRAFT_PATH, 'utf8')) : null;

	return {
		ok: result.status === 0 && draftWasWritten,
		status: result.status,
		command: ['node', ...command.map((part) => path.relative(process.cwd(), part) || part)].join(' '),
		draftPath: path.relative(process.cwd(), DRAFT_PATH).replaceAll('\\', '/'),
		stdout: result.stdout,
		stderr: result.stderr,
		draft,
	};
}

function preprocessReviewed(payload) {
	const faceKeys = Object.keys(loadFacePreprocessingMetadata(REVIEWED_PATH));

	if (faceKeys.length === 0) {
		return {
			ok: false,
			message: 'No face keys found in preprocessing metadata.',
			results: {},
		};
	}

	const command = [
		path.resolve('scripts', '3d-assets', 'run-preprocessed-face-pipeline.js'),
		'--metadata',
		REVIEWED_PATH,
	];
	const result = spawnSync(process.execPath, command, {
		cwd: process.cwd(),
		encoding: 'utf8',
		shell: false,
	});

	return {
		ok: result.status === 0,
		status: result.status,
		command: ['node', ...command.map((part) => path.relative(process.cwd(), part) || part)].join(' '),
		stdout: result.stdout,
		stderr: result.stderr,
		results: Object.fromEntries(faceKeys.map((faceKey) => [faceKey, combinedImageResult(faceKey)])),
	};
}

function combinedImageResult(faceKey) {
	const imagePath = path.resolve(OUTPUT_VALIDATION_DIR, 'source-reference-result', `${faceKey}-source-reference-result.png`);
	const reportPath = path.resolve(OUTPUT_VALIDATION_DIR, 'reports', `${faceKey}-validation-report.json`);

	return {
		sourceReferenceResult: fs.existsSync(imagePath)
			? path.relative(process.cwd(), imagePath).replaceAll('\\', '/')
			: null,
		report: fs.existsSync(reportPath)
			? path.relative(process.cwd(), reportPath).replaceAll('\\', '/')
			: null,
	};
}

function sendReferenceImage(response, fileName) {
	const safeName = path.basename(fileName);
	const imagePath = path.resolve(LARGE_FACES_DIR, safeName);

	if (!imagePath.startsWith(LARGE_FACES_DIR) || !fs.existsSync(imagePath)) {
		return sendText(response, 404, 'Image not found');
	}

	response.writeHead(200, {
		'Content-Type': 'image/png',
		'Cache-Control': 'no-cache',
	});
	fs.createReadStream(imagePath).pipe(response);
}

function sendAsset(response, relativePath) {
	const assetPath = path.resolve(process.cwd(), relativePath);

	if (!assetPath.startsWith(process.cwd()) || !fs.existsSync(assetPath)) {
		return sendText(response, 404, 'Asset not found');
	}

	const extension = path.extname(assetPath).toLowerCase();
	const contentType = extension === '.svg'
		? 'image/svg+xml'
		: extension === '.png'
			? 'image/png'
			: 'application/octet-stream';
	response.writeHead(200, {
		'Content-Type': contentType,
		'Cache-Control': 'no-cache',
	});
	fs.createReadStream(assetPath).pipe(response);
}

function sendHtml(response, html) {
	response.writeHead(200, {
		'Content-Type': 'text/html; charset=utf-8',
		'Cache-Control': 'no-cache',
	});
	response.end(html);
}

function sendJson(response, value) {
	response.writeHead(200, {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-cache',
	});
	response.end(JSON.stringify(value, null, 2));
}

function sendText(response, status, value) {
	response.writeHead(status, {
		'Content-Type': 'text/plain; charset=utf-8',
		'Cache-Control': 'no-cache',
	});
	response.end(value);
}

function readRequestBody(request) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		request.on('data', (chunk) => chunks.push(chunk));
		request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		request.on('error', reject);
	});
}

function pageHtml() {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${escapeHtmlAttribute(PAGE_TITLE)}</title>
	<style>
		:root {
			color-scheme: light;
			font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			background: #f3f1ec;
			color: #24211c;
		}

		body {
			margin: 0;
		}

		header {
			position: sticky;
			top: 0;
			z-index: 2;
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto auto;
			gap: 12px;
			align-items: center;
			padding: 12px 16px;
			border-bottom: 1px solid #d6d0c4;
			background: rgba(250, 248, 243, 0.96);
			backdrop-filter: blur(8px);
		}

		h1 {
			margin: 0;
			font-size: 18px;
			font-weight: 700;
		}

		button {
			border: 1px solid #7f765f;
			background: #2f5d50;
			color: white;
			border-radius: 6px;
			padding: 8px 12px;
			font: inherit;
			cursor: pointer;
		}

		button.secondary {
			background: #fffdf8;
			color: #24211c;
		}

		button.processing {
			opacity: 0.65;
			cursor: progress;
		}

		main {
			padding: 16px;
		}

		.bulk {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
			gap: 10px;
			margin-bottom: 16px;
		}

		.bulk-card {
			display: grid;
			gap: 8px;
			padding: 10px;
			border: 1px solid #d8d1c5;
			border-radius: 8px;
			background: #fbf7ed;
		}

		.bulk-title {
			display: flex;
			justify-content: space-between;
			gap: 8px;
			font-weight: 700;
			font-size: 13px;
		}

		.bulk-fields {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
		}

		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
			gap: 14px;
		}

		.card {
			display: grid;
			grid-template-columns: 128px minmax(0, 1fr);
			gap: 12px;
			padding: 12px;
			border: 1px solid #d8d1c5;
			border-radius: 8px;
			background: #fffdf8;
			box-shadow: 0 1px 2px rgba(43, 36, 24, 0.08);
		}

		.preview {
			position: relative;
			width: 128px;
			aspect-ratio: 164 / 238;
			background-color: #eee;
			background-image:
				linear-gradient(45deg, #dcdcdc 25%, transparent 25%),
				linear-gradient(-45deg, #dcdcdc 25%, transparent 25%),
				linear-gradient(45deg, transparent 75%, #dcdcdc 75%),
				linear-gradient(-45deg, transparent 75%, #dcdcdc 75%);
			background-position: 0 0, 0 8px, 8px -8px, -8px 0;
			background-size: 16px 16px;
			overflow: hidden;
		}

		.preview img {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			object-fit: contain;
		}

		.combined {
			grid-column: 1 / -1;
			display: grid;
			gap: 4px;
			margin-top: 8px;
		}

		.combined img {
			width: 100%;
			max-height: 220px;
			object-fit: contain;
			border: 1px solid #d8d1c5;
			background: #fff;
		}

		.box {
			position: absolute;
			border: 2px solid;
			pointer-events: none;
			box-sizing: border-box;
		}

		.box.number {
			border-color: #fc1d05;
		}

		.box.character {
			border-color: #0505d1;
		}

		.box.candidate {
			border-color: rgba(20, 20, 20, 0.35);
			border-width: 1px;
		}

		.info {
			display: grid;
			gap: 8px;
			align-content: start;
		}

		.face-key {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 8px;
			font-weight: 700;
		}

		label {
			display: grid;
			gap: 3px;
			font-size: 12px;
			color: #665f52;
		}

		input, select {
			width: 100%;
			box-sizing: border-box;
			border: 1px solid #cfc7b9;
			border-radius: 5px;
			padding: 6px;
			background: white;
			font: inherit;
			font-size: 13px;
			color: #24211c;
		}

		.color-control {
			display: grid;
			grid-template-columns: 28px minmax(0, 1fr);
			gap: 6px;
			align-items: center;
		}

		.color-swatch {
			width: 28px;
			height: 28px;
			border: 1px solid #9b9386;
			border-radius: 5px;
			background:
				linear-gradient(45deg, #ddd 25%, transparent 25%),
				linear-gradient(-45deg, #ddd 25%, transparent 25%),
				linear-gradient(45deg, transparent 75%, #ddd 75%),
				linear-gradient(-45deg, transparent 75%, #ddd 75%);
			background-position: 0 0, 0 6px, 6px -6px, -6px 0;
			background-size: 12px 12px;
		}

		.fields {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
		}

		.status {
			font-size: 13px;
			color: #4d473d;
			min-height: 20px;
		}
	</style>
</head>
<body>
	<header>
		<h1>${escapeHtmlAttribute(PAGE_TITLE)}</h1>
		<div class="status" id="status">Loading...</div>
		<button class="secondary" id="recreate" type="button">Recreate Metadata</button>
		<button class="secondary" id="reload" type="button">Reload Draft</button>
		<button class="secondary" id="preprocess" type="button">Save + Preprocess</button>
		<button id="save" type="button">Save Reviewed JSON</button>
	</header>
	<main>
		<div class="bulk" id="bulk"></div>
		<div class="grid" id="cards"></div>
	</main>
	<script>
		const locations = ['', 'top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
		const groups = [
			{ key: 'b', label: 'Bamboos', test: (faceKey) => /^b-[1-9]$/.test(faceKey) },
			{ key: 'c', label: 'Characters', test: (faceKey) => /^c-[1-9]$/.test(faceKey) },
			{ key: 'd', label: 'Dots', test: (faceKey) => /^d-[1-9]$/.test(faceKey) },
			{ key: 'wind', label: 'Winds', test: (faceKey) => /^wind-[ensw]$/.test(faceKey) },
			{ key: 'flower', label: 'Flowers', test: (faceKey) => /^flower-[1-4]$/.test(faceKey) },
			{ key: 'season', label: 'Seasons', test: (faceKey) => /^season-[1-4]$/.test(faceKey) },
			{ key: 'dragon', label: 'Dragons', test: (faceKey) => /^dragon-[grw]$/.test(faceKey) },
		];
		const bulkNode = document.getElementById('bulk');
		const cards = document.getElementById('cards');
		const statusNode = document.getElementById('status');
		let draft = null;

		document.getElementById('reload').addEventListener('click', loadDraft);
		document.getElementById('recreate').addEventListener('click', recreateMetadata);
		document.getElementById('save').addEventListener('click', saveReviewed);
		document.getElementById('preprocess').addEventListener('click', preprocessReviewed);
		loadDraft();

		async function loadDraft() {
			statusNode.textContent = 'Loading draft...';
			const response = await fetch('/api/draft');
			draft = await response.json();
			render();
			statusNode.textContent = Object.keys(metadataEntries()).length + ' faces loaded';
		}

		async function recreateMetadata() {
			const button = document.getElementById('recreate');
			button.disabled = true;
			button.classList.add('processing');
			statusNode.textContent = 'Recreating draft metadata...';
			try {
				const response = await fetch('/api/recreate', {
					method: 'POST',
				});
				const result = await response.json();
				if (!result.ok) {
					statusNode.textContent = 'Recreate failed; inspect server console';
					return;
				}
				draft = result.draft;
				render();
				statusNode.textContent = 'Recreated ' + Object.keys(metadataEntries()).length + ' faces from reference images';
			} catch (error) {
				statusNode.textContent = 'Recreate failed: ' + error.message;
			} finally {
				button.disabled = false;
				button.classList.remove('processing');
			}
		}

		function render() {
			renderBulkControls();
			cards.innerHTML = '';
			for (const [faceKey, entry] of Object.entries(metadataEntries())) {
				cards.appendChild(makeCard(faceKey, entry));
			}
		}

		function metadataEntries() {
			return draft.referenceGlyphs || draft.tilesetGlyphs || {};
		}

		function renderBulkControls() {
			bulkNode.innerHTML = '';
			const entries = metadataEntries();
			for (const group of groups) {
				const faceKeys = Object.keys(entries).filter(group.test);
				if (faceKeys.length === 0) {
					continue;
				}
				bulkNode.appendChild(makeBulkCard(group, faceKeys, entries));
			}
		}

		function makeBulkCard(group, faceKeys, entries) {
			const card = document.createElement('section');
			card.className = 'bulk-card';
			const title = document.createElement('div');
			title.className = 'bulk-title';
			title.innerHTML = '<span>' + escapeHtml(group.label) + '</span><span>' + faceKeys.length + ' faces</span>';
			const fields = document.createElement('div');
			fields.className = 'bulk-fields';
			fields.append(
				field('Number color', colorInput(majorityValue(faceKeys, entries, 'number', 'color'), (value) => applyBulk(faceKeys, 'number', 'color', value))),
				field('Number location', locationSelect(majorityValue(faceKeys, entries, 'number', 'location'), (value) => applyBulk(faceKeys, 'number', 'location', value))),
				field('Number present', triStateSelect(commonBoolean(faceKeys, entries, 'number', 'present'), (value) => applyBulkBoolean(faceKeys, 'number', 'present', value))),
				field('Character color', colorInput(majorityValue(faceKeys, entries, 'character', 'color'), (value) => applyBulk(faceKeys, 'character', 'color', value))),
				field('Character location', locationSelect(majorityValue(faceKeys, entries, 'character', 'location'), (value) => applyBulk(faceKeys, 'character', 'location', value))),
				field('Character present', triStateSelect(commonBoolean(faceKeys, entries, 'character', 'present'), (value) => applyBulkBoolean(faceKeys, 'character', 'present', value))),
			);
			card.append(title, fields);
			return card;
		}

		function commonValue(faceKeys, entries, section, fieldName) {
			const values = [...new Set(faceKeys.map((faceKey) => entries[faceKey]?.[section]?.[fieldName] || ''))];
			return values.length === 1 ? values[0] : '';
		}

		function majorityValue(faceKeys, entries, section, fieldName) {
			const counts = new Map();
			for (const faceKey of faceKeys) {
				const value = entries[faceKey]?.[section]?.[fieldName] || '';
				if (!value) {
					continue;
				}
				counts.set(value, (counts.get(value) || 0) + 1);
			}
			const majority = [...counts.entries()]
				.sort((left, right) => right[1] - left[1])
				.find(([, count]) => count > faceKeys.length / 2);
			return majority?.[0] || commonValue(faceKeys, entries, section, fieldName);
		}

		function commonBoolean(faceKeys, entries, section, fieldName) {
			const values = [...new Set(faceKeys.map((faceKey) => Boolean(entries[faceKey]?.[section]?.[fieldName])))];
			return values.length === 1 ? String(values[0]) : '';
		}

		function applyBulk(faceKeys, section, fieldName, value) {
			for (const faceKey of faceKeys) {
				const entry = metadataEntries()[faceKey];
				const target = section === 'number' ? ensureNumber(entry) : ensureCharacter(entry);
				target[fieldName] = value;
			}
			render();
		}

		function applyBulkBoolean(faceKeys, section, fieldName, value) {
			if (value === '') {
				return;
			}
			for (const faceKey of faceKeys) {
				const entry = metadataEntries()[faceKey];
				const target = section === 'number' ? ensureNumber(entry) : ensureCharacter(entry);
				target[fieldName] = value === 'true';
			}
			render();
		}

		function makeCard(faceKey, entry) {
			const card = document.createElement('section');
			card.className = 'card';
			const preview = document.createElement('div');
			preview.className = 'preview';
			if (entry.canvas?.width && entry.canvas?.height) {
				preview.style.aspectRatio = entry.canvas.width + ' / ' + entry.canvas.height;
			}
			const img = document.createElement('img');
			img.src = entry.sourceFile
				? '/asset?path=' + encodeURIComponent(entry.sourceFile)
				: '';
			img.alt = faceKey;
			preview.appendChild(img);

			for (const candidate of entry.glyphCandidates || []) {
				preview.appendChild(makeBox(candidate.bounds, 'candidate'));
			}
			if (entry.number?.bounds) {
				preview.appendChild(makeBox(entry.number.bounds, 'number'));
			}
			if (entry.character?.bounds) {
				preview.appendChild(makeBox(entry.character.bounds, 'character'));
			}

			const info = document.createElement('div');
			info.className = 'info';
			info.innerHTML = '<div class="face-key"><span>' + escapeHtml(faceKey) + '</span><span>' + ((entry.glyphCandidates || []).length) + ' candidates</span></div>';
			info.appendChild(fieldsFor(faceKey, entry));
			card.append(preview, info);
			if (entry.outputs?.sourceReferenceResult) {
				card.appendChild(makeCombinedPreview(entry.outputs.sourceReferenceResult));
			}
			return card;
		}

		function makeCombinedPreview(imagePath) {
			const wrap = document.createElement('div');
			wrap.className = 'combined';
			const label = document.createElement('strong');
			label.textContent = 'Source / reference / output';
			const img = document.createElement('img');
			img.src = '/asset?path=' + encodeURIComponent(imagePath) + '&t=' + Date.now();
			img.alt = 'Source reference result';
			wrap.append(label, img);
			return wrap;
		}

		function fieldsFor(faceKey, entry) {
			const wrap = document.createElement('div');
			wrap.className = 'fields';
			wrap.append(
				field('Number', textInput(entry.number?.text || '', (value) => ensureNumber(entry).text = value)),
				field('Number color', colorInput(entry.number?.color || '', (value) => ensureNumber(entry).color = value)),
				field('Number location', locationSelect(entry.number?.location || '', (value) => ensureNumber(entry).location = value)),
				field('Number present', checkbox(Boolean(entry.number?.present), (value) => ensureNumber(entry).present = value)),
				field('Character color', colorInput(entry.character?.color || '', (value) => ensureCharacter(entry).color = value)),
				field('Character location', locationSelect(entry.character?.location || '', (value) => ensureCharacter(entry).location = value)),
				field('Character present', checkbox(Boolean(entry.character?.present), (value) => ensureCharacter(entry).present = value)),
			);
			return wrap;
		}

		function ensureNumber(entry) {
			entry.number ||= { present: true };
			return entry.number;
		}

		function ensureCharacter(entry) {
			entry.character ||= { present: true };
			return entry.character;
		}

		function field(labelText, control) {
			const label = document.createElement('label');
			label.textContent = labelText;
			label.appendChild(control);
			return label;
		}

		function textInput(value, onChange) {
			const input = document.createElement('input');
			input.value = value;
			input.addEventListener('input', () => onChange(input.value));
			return input;
		}

		function colorInput(value, onChange) {
			const wrap = document.createElement('div');
			wrap.className = 'color-control';
			const swatch = document.createElement('span');
			swatch.className = 'color-swatch';
			const input = textInput(value, (nextValue) => {
				onChange(nextValue);
				updateSwatch(swatch, nextValue);
			});
			updateSwatch(swatch, value);
			wrap.append(swatch, input);
			return wrap;
		}

		function updateSwatch(swatch, value) {
			const isHexColor = /^#[0-9a-f]{6}$/i.test(value);
			swatch.style.backgroundColor = isHexColor ? value : 'transparent';
			swatch.style.backgroundImage = isHexColor ? 'none' : '';
		}

		function checkbox(value, onChange) {
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.checked = value;
			input.addEventListener('change', () => onChange(input.checked));
			return input;
		}

		function locationSelect(value, onChange) {
			const select = document.createElement('select');
			for (const location of locations) {
				const option = document.createElement('option');
				option.value = location;
				option.textContent = location || '(none)';
				option.selected = location === value;
				select.appendChild(option);
			}
			select.addEventListener('change', () => onChange(select.value));
			return select;
		}

		function triStateSelect(value, onChange) {
			const select = document.createElement('select');
			for (const optionValue of ['', 'true', 'false']) {
				const option = document.createElement('option');
				option.value = optionValue;
				option.textContent = optionValue === '' ? '(mixed/no change)' : optionValue;
				option.selected = optionValue === value;
				select.appendChild(option);
			}
			select.addEventListener('change', () => onChange(select.value));
			return select;
		}

		function makeBox(bounds, className) {
			const box = document.createElement('div');
			const entry = findEntryForBounds(bounds);
			const canvas = entry?.canvas || { left: 0, top: 0, width: 164, height: 238 };
			box.className = 'box ' + className;
			box.style.left = ((bounds.left - canvas.left) / canvas.width * 100) + '%';
			box.style.top = ((bounds.top - canvas.top) / canvas.height * 100) + '%';
			box.style.width = (bounds.width / canvas.width * 100) + '%';
			box.style.height = (bounds.height / canvas.height * 100) + '%';
			return box;
		}

		function findEntryForBounds(bounds) {
			for (const entry of Object.values(metadataEntries())) {
				const allBounds = [
					entry.number?.bounds,
					entry.character?.bounds,
					...(entry.glyphCandidates || []).map((candidate) => candidate.bounds),
				].filter(Boolean);
				if (allBounds.includes(bounds)) {
					return entry;
				}
			}
			return null;
		}

		async function saveReviewed() {
			statusNode.textContent = 'Saving...';
			const response = await fetch('/api/save', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(draft),
			});
			const result = await response.json();
			statusNode.textContent = result.ok ? 'Saved ' + result.path : 'Save failed';
		}

		async function preprocessReviewed() {
			const button = document.getElementById('preprocess');
			button.disabled = true;
			button.classList.add('processing');
			statusNode.textContent = 'Saving and preprocessing...';
			try {
				const response = await fetch('/api/preprocess', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(draft),
				});
				const result = await response.json();
				for (const [faceKey, output] of Object.entries(result.results || {})) {
					const entry = metadataEntries()[faceKey];
					if (!entry) {
						continue;
					}
					entry.outputs ||= {};
					entry.outputs.sourceReferenceResult = output.sourceReferenceResult;
					entry.outputs.report = output.report;
				}
				render();
				statusNode.textContent = result.ok
					? 'Preprocessed ' + Object.keys(result.results || {}).length + ' faces'
					: 'Preprocess finished with failures; inspect reports';
			} catch (error) {
				statusNode.textContent = 'Preprocess failed: ' + error.message;
			} finally {
				button.disabled = false;
				button.classList.remove('processing');
			}
		}

		function escapeHtml(value) {
			return String(value)
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;');
		}
	</script>
</body>
</html>`;
}

function escapeHtmlAttribute(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

