import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import puppeteer from 'puppeteer';
import { ROOT_DIR } from '../shared/asset-paths.js';
import { PipelineModel } from '../svg-preprocessor/PipelineModel.js';

const PREVIEW_WIDTH = 512;
const PREVIEW_HEIGHT = 384;

let browserPromise = null;

/**
 * Render and record a generated asset review PNG for one face.
 *
 * The browser instance is kept alive across calls in this process so server
 * queue runs can render many face previews without launching Chromium for
 * every tile.
 *
 * @param {object} options - Render options.
 * @param {string} options.tilesetId - Source tileset id.
 * @param {string} options.faceKey - Face key to render.
 * @param {string} [options.referenceName="default-large-faces"] - Reference set id.
 * @returns {Promise<{outputPng: string}>} Rendered preview path.
 */
export async function renderGeneratedAssetPreview({ tilesetId, faceKey, referenceName = 'default-large-faces' }) {
	const model = new PipelineModel({
		referenceName,
		tileSetName: tilesetId,
	});
	await model.start();

	const variant = buildPreviewVariant({ model, tilesetId, faceKey });
	const faceHash = model.hashAssetPipelineFaceInput(faceKey);
	const stageHash = model.hashAssetGenerationStageInput(faceKey, 'preview-png');
	fs.mkdirSync(path.dirname(variant.outputPng), { recursive: true });

	await renderGlbPreviewPng(variant);

	model.updateAssetGenerationFace(faceKey, {
		status: null,
		inputHash: faceHash,
		stageHashes: {
			'preview-png': stageHash,
		},
		artifacts: {
			previewPng: relativePath(variant.outputPng),
		},
		queue: null,
		build: null,
		failure: null,
	});
	await model.save();

	return {
		outputPng: relativePath(variant.outputPng),
	};
}

/**
 * Close the shared preview browser, if one has been started.
 *
 * @returns {Promise<void>}
 */
export async function closeGeneratedAssetPreviewRenderer() {
	if (!browserPromise) {
		return;
	}

	const browser = await browserPromise;
	browserPromise = null;
	await browser.close();
}

function buildPreviewVariant({ model, tilesetId, faceKey }) {
	const assetPipeline = model.getAssetPipeline();
	const faceState = assetPipeline.faces?.[faceKey];
	const finalGlb = resolveRepoPath(faceState?.artifacts?.inlayModel || '');
	const outputPng = path.join(model.pipelineDir, 'images', 'generated-asset-preview-png', `${faceKey}.png`);

	if (!finalGlb) {
		throw new Error(`Missing final generated GLB artifact for ${tilesetId}/${faceKey}.`);
	}
	if (!fs.existsSync(finalGlb)) {
		throw new Error(`Final generated GLB does not exist: ${relativePath(finalGlb)}.`);
	}

	return Object.freeze({
		faceKey,
		tilesetId,
		finalGlb,
		outputPng,
	});
}

async function renderGlbPreviewPng(variant) {
	const browser = await getBrowser();
	const page = await browser.newPage();
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-preview-'));
	const tempHtml = path.join(tempDir, 'preview.html');

	try {
		page.on('console', (message) => {
			if (message.type() === 'error') {
				console.warn(message.text());
			}
		});
		fs.writeFileSync(tempHtml, previewHtml(readBase64(variant.finalGlb)));
		await page.goto(pathToFileURL(tempHtml).href, { waitUntil: 'load' });
		await page.waitForFunction(() => window.previewReady || window.previewError, { timeout: 30000 });
		const error = await page.evaluate(() => window.previewError || '');
		if (error) {
			throw new Error(error);
		}

		const dataUrl = await page.evaluate(() => window.previewDataUrl);
		const png = dataUrl.replace(/^data:image\/png;base64,/, '');
		fs.writeFileSync(variant.outputPng, Buffer.from(png, 'base64'));
	} finally {
		await page.close().catch(() => {});
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

async function getBrowser() {
	if (!browserPromise) {
		browserPromise = launchBrowser();
	}

	try {
		const browser = await browserPromise;
		if (browser.connected) {
			return browser;
		}
	} catch {
		// Relaunch below.
	}

	browserPromise = launchBrowser();
	return browserPromise;
}

async function launchBrowser() {
	return puppeteer.launch({
		headless: 'new',
		args: [
			'--allow-file-access-from-files',
			'--disable-gpu-sandbox',
			'--no-sandbox',
			'--use-gl=swiftshader',
		],
		defaultViewport: {
			width: PREVIEW_WIDTH,
			height: PREVIEW_HEIGHT,
			deviceScaleFactor: 1,
		},
	});
}

function previewHtml(glbBase64) {
	const threeUrl = pathToFileURL(path.join(ROOT_DIR, 'node_modules', 'three', 'build', 'three.module.js')).href;
	const addonsUrl = `${pathToFileURL(path.join(ROOT_DIR, 'node_modules', 'three', 'examples', 'jsm')).href}/`;

	return `<!doctype html>
<html>
<head>
	<meta charset="utf-8">
	<style>
		html, body {
			margin: 0;
			width: ${PREVIEW_WIDTH}px;
			height: ${PREVIEW_HEIGHT}px;
			overflow: hidden;
			background: #050706;
		}
		canvas {
			display: block;
			width: ${PREVIEW_WIDTH}px;
			height: ${PREVIEW_HEIGHT}px;
		}
	</style>
	<script type="importmap">
		{
			"imports": {
				"three": "${threeUrl}",
				"three/addons/": "${addonsUrl}"
			}
		}
	</script>
</head>
<body>
<script type="module">
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

	const width = ${PREVIEW_WIDTH};
	const height = ${PREVIEW_HEIGHT};
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x050706);

	const camera = new THREE.PerspectiveCamera(32, width / height, 0.01, 100);
	const renderer = new THREE.WebGLRenderer({
		antialias: true,
		alpha: false,
		preserveDrawingBuffer: true
	});
	renderer.setSize(width, height, false);
	renderer.setPixelRatio(1);
	if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
		renderer.outputColorSpace = THREE.SRGBColorSpace;
	}
	document.body.appendChild(renderer.domElement);

	const grid = new THREE.GridHelper(2.2, 22, 0x2d7d6b, 0x1c332d);
	grid.position.y = -0.38;
	scene.add(grid);

	const ambient = new THREE.HemisphereLight(0xffffff, 0x24302b, 2.8);
	const key = new THREE.DirectionalLight(0xffffff, 2.2);
	key.position.set(2, 3, 2);
	const fill = new THREE.DirectionalLight(0xffffff, 0.8);
	fill.position.set(-2, 1.5, -1.5);
	scene.add(ambient, key, fill);

	try {
		const bytes = Uint8Array.from(atob('${glbBase64}'), (char) => char.charCodeAt(0));
		const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
		scene.add(gltf.scene);
		fitCameraToObject(camera, gltf.scene);
		renderer.render(scene, camera);
		window.previewDataUrl = renderer.domElement.toDataURL('image/png');
		window.previewReady = true;
	} catch (error) {
		window.previewError = error.message || String(error);
	}

	function fitCameraToObject(camera, object) {
		const box = new THREE.Box3().setFromObject(object);
		const size = box.getSize(new THREE.Vector3());
		const center = box.getCenter(new THREE.Vector3());
		const radius = Math.max(size.length() * 0.5, 0.4);
		const distance = radius / Math.sin((camera.fov * Math.PI / 180) * 0.5);

		object.position.sub(center);
		camera.position.set(distance * 0.62, distance * 0.42, distance * 0.78);
		camera.lookAt(0, 0, 0);
		camera.near = Math.max(0.01, distance / 100);
		camera.far = distance * 10;
		camera.updateProjectionMatrix();
	}
</script>
</body>
</html>`;
}

function readBase64(filename) {
	return fs.readFileSync(filename).toString('base64');
}

function resolveRepoPath(filename) {
	return filename ? path.resolve(ROOT_DIR, filename) : '';
}

function relativePath(filename) {
	return path.relative(ROOT_DIR, filename).replaceAll('\\', '/');
}
