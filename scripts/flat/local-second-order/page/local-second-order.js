import * as THREE from 'three';
import {
	SPECTRAL_CHANNELS,
	createFlatLocalSunAlgorithm32Model,
} from '/shared/algorithm32/POC/cpu/algorithm32-transport.js';
import {
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
} from '/shared/algorithm32/POC/source-contract/algorithm32-source-contract.js';
import {
	Algorithm32AtmospherePass,
	threeNativePassModeCode,
} from '/shared/algorithm32/POC/three/shader-lab-page.js';
import {
	createLocalIncidentData3DTexture,
} from '/shared/algorithm32/POC/three/local-second-order-renderer.js';
import {
	buildLocalIncidentGridCache,
	makeDefaultLocalIncidentCacheConfig,
	makeLocalIncomingDirections,
	packLocalIncidentCacheToRgba3D,
} from '/shared/algorithm32/POC/local-second-order/local-cache.js';
import {
	runLocalSubjectiveSceneCapture,
	runThreeTerrainIntegratedDistantMidday,
	runThreeTerrainIntegratedSourceMatrix,
} from './subjective-scenes.js';

const canvas = document.getElementById('lab-canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });

window.runLocalSecondOrderCommand = async function runLocalSecondOrderCommand(command) {
	const startedAt = performance.now();
	const normalizedCommand = normalizeCommand(command);

	if (normalizedCommand.type === 'three-integrated-local-l2') {
		return runThreeIntegratedLocalL2(normalizedCommand, startedAt);
	}

	if (normalizedCommand.type === 'subjective-scene-capture') {
		return runLocalSubjectiveSceneCapture(normalizedCommand, startedAt);
	}

	if (normalizedCommand.type === 'three-terrain-integrated-distant-midday') {
		return runThreeTerrainIntegratedDistantMidday(normalizedCommand, startedAt);
	}

	if (normalizedCommand.type === 'three-terrain-integrated-source-matrix') {
		return runThreeTerrainIntegratedSourceMatrix(normalizedCommand, startedAt);
	}

	if (normalizedCommand.type !== 'browser-smoke') {
		if (normalizedCommand.type === 'throw-reference-error') {
			return runReferenceErrorProbe();
		}
		return rejectedUnsupportedCommand(normalizedCommand, startedAt);
	}

	const capabilities = collectCapabilities();
	drawSmokeFrame(normalizedCommand, capabilities);
	const selectedPixels = sampleSelectedPixels();
	const imageDataUrl = canvas.toDataURL('image/png');
	const criteriaResults = [
		{
			criterionId: 'browser-entrypoint-available',
			status: 'pass',
			tolerance: 'window.runLocalSecondOrderCommand exists',
			measuredError: 0,
			sourceOrStatus: 'browser-smoke',
			notes: 'The harness successfully called the lane browser entrypoint.',
		},
		{
			criterionId: 'webgl2-context-available',
			status: capabilities.webgl2 ? 'pass' : 'fail',
			tolerance: 'WebGL2 context exists',
			measuredError: capabilities.webgl2 ? 0 : 1,
			sourceOrStatus: 'browser-smoke',
			notes: 'Future integrated shader milestones need WebGL2-capable browser execution.',
		},
		{
			criterionId: 'canvas-selected-pixels-finite',
			status: selectedPixels.every((pixel) => pixel.rgba.every(Number.isFinite))
				? 'pass'
				: 'fail',
			tolerance: 'finite RGBA byte samples',
			measuredError: selectedPixels.length,
			sourceOrStatus: 'browser-smoke',
			notes: 'The page can draw and read deterministic canvas diagnostics.',
		},
		{
			criterionId: 'image-data-url-returned',
			status: imageDataUrl.startsWith('data:image/png;base64,') ? 'pass' : 'fail',
			tolerance: 'PNG data URL',
			measuredError: imageDataUrl.startsWith('data:image/png;base64,') ? 0 : 1,
			sourceOrStatus: 'browser-smoke',
			notes: 'The harness can write a browser-produced image artifact.',
		},
	];
	const failed = criteriaResults.some((criterion) => criterion.status === 'fail');
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-local-second-order-browser-result',
		status: failed ? 'rejected' : 'accepted',
		command: normalizedCommand,
		diagnostics: {
			status: failed ? 'rejected' : 'accepted',
			commandType: normalizedCommand.type,
			capabilities,
			canvas: {
				width: canvas.width,
				height: canvas.height,
			},
		},
		selectedPixels,
		criteriaResults,
		imageDataUrl,
		timings: {
			startedAtMs: startedAt,
			completedAtMs: completedAt,
			durationMs: completedAt - startedAt,
		},
	};
};

async function runThreeIntegratedLocalL2(command, startedAt) {
	const payload = command.payload || {};
	const width = payload.width || 96;
	const height = payload.height || 54;
	const sourceConfig = normalizeLocalSourcePayload(payload.source);
	const geometryConfig = normalizeGeometryPayload(payload.geometry);
	const incomingDirections = makeLocalIncomingDirections(
		payload.cache?.incomingDirectionCount || 9
	);
	const cacheConfig = makeDefaultLocalIncidentCacheConfig({
		incomingDirections,
		zMeters: payload.cache?.zMeters,
		rhoMeters: payload.cache?.rhoMeters,
	});
	const source = createFlatLocalPointSunSource({
		...sourceConfig,
		spectralChannels: SPECTRAL_CHANNELS,
	});
	const geometry = createFlatZUpAtmosphereGeometry(geometryConfig);
	const model = createFlatLocalSunAlgorithm32Model({ source, geometry });
	const cache = buildLocalIncidentGridCache({
		model,
		sourceKey: source.id,
		cacheConfig,
		incomingDirections,
	});
	const packed = packLocalIncidentCacheToRgba3D(cache);
	const cacheTexture = createLocalIncidentData3DTexture(packed);
	const render = createThreeLocalSecondOrderRender({
		width,
		height,
		sourceConfig,
		geometryConfig,
		packed,
		cacheTexture,
	});
	const identity = render.renderMode('identity');
	const flatRayDebug = render.renderMode(
		'flat-local-first-order-atmosphere',
		'flat-ray-direction'
	);
	const flatSourceDebug = render.renderMode(
		'flat-local-first-order-atmosphere',
		'flat-source-direction'
	);
	const firstOrder = render.renderMode('flat-local-first-order-atmosphere');
	const secondOrder = render.renderMode('flat-local-second-order-atmosphere');
	const diff = imageDiff(firstOrder.pixels, secondOrder.pixels);
	drawImageDataToMainCanvas(secondOrder.imageData);
	const selectedPixels = sampleSelectedPixelsFromImageData(
		secondOrder.imageData,
		[
			{ id: 'sky-upper', x: Math.floor(width * 0.5), y: Math.floor(height * 0.18) },
			{ id: 'horizon-mid', x: Math.floor(width * 0.5), y: Math.floor(height * 0.5) },
			{ id: 'ground-lower', x: Math.floor(width * 0.5), y: Math.floor(height * 0.82) },
		]
	);
	const imageDataUrl = canvas.toDataURL('image/png');
	const criteriaResults = [
		{
			criterionId: 'three-pass-local-l2-mode-present',
			status:
				threeNativePassModeCode('flat-local-second-order-atmosphere') === 4
					? 'pass'
					: 'fail',
			tolerance: 'pass mode 4',
			measuredError: threeNativePassModeCode('flat-local-second-order-atmosphere'),
			sourceOrStatus: 'three-integrated-local-l2',
			notes: 'The centralized Three pass exposes a local second-order mode.',
		},
		{
			criterionId: 'local-cache-packed-as-data3dtexture',
			status:
				cacheTexture.isData3DTexture &&
				packed.width > 0 &&
				packed.height > 0 &&
				packed.depth > 0
					? 'pass'
					: 'fail',
			tolerance: 'Three Data3DTexture exists with positive dimensions',
			measuredError: {
				isData3DTexture: cacheTexture.isData3DTexture === true,
				width: packed.width,
				height: packed.height,
				depth: packed.depth,
			},
			sourceOrStatus: 'three-integrated-local-l2',
			notes: 'The browser command uploads the reusable cache pack as a 3D texture.',
		},
		{
			criterionId: 'live-three-scene-color-depth-inputs',
			status: render.sceneTargetSample.some((value) => value !== 0) ? 'pass' : 'fail',
			tolerance: 'scene render target contains nonzero bytes',
			measuredError: render.sceneTargetSample,
			sourceOrStatus: 'three-integrated-local-l2',
			notes: 'The pass renders over a live Three scene render target, not JSON replay.',
		},
		{
			criterionId: 'local-l2-changes-render',
			status: diff.maxAbsRgbDelta > 0 ? 'pass' : 'fail',
			tolerance: 'first-order and first-plus-second-order images differ',
			measuredError: diff,
			sourceOrStatus: 'three-integrated-local-l2',
			notes: 'The local L2 cache path contributes to the integrated shader output.',
		},
		{
			criterionId: 'selected-pixels-finite',
			status: selectedPixels.every((pixel) => pixel.rgba.every(Number.isFinite))
				? 'pass'
				: 'fail',
			tolerance: 'finite RGBA byte samples',
			measuredError: selectedPixels.length,
			sourceOrStatus: 'three-integrated-local-l2',
			notes: 'Selected integrated shader samples are finite and bounded.',
		},
	];
	render.dispose();
	const failed = criteriaResults.some((criterion) => criterion.status === 'fail');
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-local-second-order-browser-result',
		status: failed ? 'rejected' : 'accepted',
		command,
		diagnostics: {
			status: failed ? 'rejected' : 'accepted',
			commandType: command.type,
			sourceId: source.id,
			cacheKey: cache.cacheKey,
			cacheEntries: cache.values.size,
			packing: {
				kind: packed.kind,
				packingVersion: packed.packingVersion,
				width: packed.width,
				height: packed.height,
				depth: packed.depth,
				spectralGroups: packed.spectralGroups,
			},
			diff,
			identityCenter: identity.centerFramebufferSample,
			flatRayCenter: flatRayDebug.centerFramebufferSample,
			flatSourceCenter: flatSourceDebug.centerFramebufferSample,
			firstOrderCenter: firstOrder.centerFramebufferSample,
			secondOrderCenter: secondOrder.centerFramebufferSample,
			sceneTargetTopLeft: render.sceneTargetSample,
			modes: {
				firstOrder: threeNativePassModeCode('flat-local-first-order-atmosphere'),
				secondOrder: threeNativePassModeCode('flat-local-second-order-atmosphere'),
			},
		},
		selectedPixels,
		criteriaResults,
		imageDataUrl,
		timings: {
			startedAtMs: startedAt,
			completedAtMs: completedAt,
			durationMs: completedAt - startedAt,
		},
	};
}

function normalizeLocalSourcePayload(source = {}) {
	return {
		id: source.id || 'san-jose-000deg-closest-browser-default',
		positionMeters: source.positionMeters || [
			-1259333.1191633441,
			-783448.107576714,
			4828003.52,
		],
		radiusKm: source.radiusKm ?? 25.749504,
		referenceDistanceKm: source.referenceDistanceKm ?? 4800,
		referenceSpectralIncidentScale:
			source.referenceSpectralIncidentScale ?? 1.1071748923354825,
		distanceFalloff: source.distanceFalloff !== false,
		color: source.color || { r: 1, g: 0.98, b: 0.95 },
		provenance: source.provenance || 'browser-command-default',
	};
}

function normalizeGeometryPayload(geometry = {}) {
	return {
		topAltitudeMeters: geometry.topAltitudeMeters ?? 100000,
		observerPositionMeters: geometry.observerPositionMeters || [0, 0, 2],
		sceneSkyRayLimitMeters: geometry.sceneSkyRayLimitMeters ?? 1926774,
		sceneSkyRayLimitPolicy:
			geometry.sceneSkyRayLimitPolicy ||
			'artificial-flat-sky-radius-matches-round-earth-skydome',
	};
}

function createThreeLocalSecondOrderRender({
	width,
	height,
	sourceConfig,
	geometryConfig,
	packed,
	cacheTexture,
}) {
	const webglCanvas = document.createElement('canvas');
	webglCanvas.width = width;
	webglCanvas.height = height;
	const renderer = new THREE.WebGLRenderer({
		canvas: webglCanvas,
		antialias: false,
		preserveDrawingBuffer: true,
	});
	renderer.setSize(width, height, false);
	renderer.setPixelRatio(1);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.autoClear = true;
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x05070a);
	const cameraFarMeters = Math.max(
		200000,
		Math.min(geometryConfig.sceneSkyRayLimitMeters || 1926774, 2500000)
	);
	const camera = new THREE.PerspectiveCamera(
		58,
		width / height,
		0.1,
		cameraFarMeters
	);
	const observer = geometryConfig.observerPositionMeters || [0, 0, 2];
	camera.position.copy(algorithmFlatToThree(observer));
	const sourceDirection = normalizeVector([
		sourceConfig.positionMeters[0] - observer[0],
		sourceConfig.positionMeters[1] - observer[1],
		sourceConfig.positionMeters[2] - observer[2],
	]);
	const lookDirection = algorithmFlatDirectionToThree(sourceDirection);
	camera.lookAt(camera.position.clone().addScaledVector(lookDirection, 100000));
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	const ground = new THREE.Mesh(
		new THREE.PlaneGeometry(8000000, 8000000, 1, 1),
		new THREE.MeshStandardMaterial({
			color: new THREE.Color(0x2c603e),
			roughness: 0.85,
			metalness: 0,
		})
	);
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = 0;
	scene.add(ground);

	const ridge = new THREE.Mesh(
		new THREE.BoxGeometry(1800, 420, 90),
		new THREE.MeshStandardMaterial({
			color: new THREE.Color(0x244f31),
			roughness: 0.9,
			metalness: 0,
		})
	);
	ridge.position.set(0, 210, -3200);
	scene.add(ridge);

	const pointLight = new THREE.PointLight(0xffffff, 2.4, 0, 0);
	pointLight.decay = 0;
	pointLight.position.copy(algorithmFlatToThree(sourceConfig.positionMeters));
	scene.add(pointLight);
	scene.add(new THREE.HemisphereLight(0xffffff, 0x304020, 0.05));

	const passConfig = {
		source: {
			kind: 'flat-local-point-sun',
			id: sourceConfig.id,
			positionMeters: sourceConfig.positionMeters,
			referenceDistanceKm: sourceConfig.referenceDistanceKm,
			referenceSpectralIncidentScale:
				sourceConfig.referenceSpectralIncidentScale,
			distanceFalloff: sourceConfig.distanceFalloff,
			color: sourceConfig.color,
		},
		geometry: {
			topAltitudeMeters: geometryConfig.topAltitudeMeters,
			sceneSkyRayLimitMeters: geometryConfig.sceneSkyRayLimitMeters,
			sceneSkyRayLimitPolicy: geometryConfig.sceneSkyRayLimitPolicy,
		},
		localIncidentCache: {
			texture: cacheTexture,
			width: packed.width,
			height: packed.height,
			depth: packed.depth,
			zMeters: packed.zMeters,
			rhoMeters: packed.rhoMeters,
			incomingDirections: packed.incomingDirections,
			spectralGroupCount: packed.spectralGroupCount,
			cacheKey: packed.cacheKey,
			sourceKey: packed.sourceKey,
			packingVersion: packed.packingVersion,
		},
		display: {},
	};
	const pass = new Algorithm32AtmospherePass({
		renderer,
		width,
		height,
		camera,
		config: passConfig,
		mode: 'flat-local-second-order-atmosphere',
		maxDistanceMeters: 20000000,
	});
	pass.renderScene(scene, camera);
	const sceneTargetSample = Array.from(pass.readSceneColorTargetTopLeft().slice(0, 16));
	return {
		sceneTargetSample,
		renderMode(mode, debugView = null) {
			pass.mode = mode;
			pass.config = {
				...pass.config,
				display: {
					...(pass.config.display || {}),
					debugView,
				},
			};
			pass.render({ camera });
			return captureWebglCanvas(webglCanvas, width, height, renderer);
		},
		dispose() {
			pass.dispose();
			ground.geometry.dispose();
			ground.material.dispose();
			ridge.geometry.dispose();
			ridge.material.dispose();
			cacheTexture.dispose();
			renderer.dispose();
		},
	};
}

function algorithmFlatToThree(positionMeters) {
	return new THREE.Vector3(positionMeters[0], positionMeters[2], -positionMeters[1]);
}

function algorithmFlatDirectionToThree(direction) {
	return new THREE.Vector3(direction[0], direction[2], -direction[1]).normalize();
}

function normalizeVector(vector) {
	const magnitude = Math.hypot(...vector);
	if (!Number.isFinite(magnitude) || magnitude === 0) {
		return [0, 0, 1];
	}
	return vector.map((value) => value / magnitude);
}

function captureWebglCanvas(webglCanvas, width, height, renderer) {
	const gl = renderer.getContext();
	const centerFramebufferSample = new Uint8Array(4);
	gl.readPixels(
		Math.floor(width / 2),
		Math.floor(height / 2),
		1,
		1,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		centerFramebufferSample
	);
	const captureCanvas = document.createElement('canvas');
	captureCanvas.width = width;
	captureCanvas.height = height;
	const captureContext = captureCanvas.getContext('2d', { willReadFrequently: true });
	captureContext.drawImage(webglCanvas, 0, 0, width, height);
	const imageData = captureContext.getImageData(0, 0, width, height);
	return {
		imageData,
		pixels: new Uint8ClampedArray(imageData.data),
		centerFramebufferSample: Array.from(centerFramebufferSample),
	};
}

function drawImageDataToMainCanvas(imageData) {
	context.clearRect(0, 0, canvas.width, canvas.height);
	const captureCanvas = document.createElement('canvas');
	captureCanvas.width = imageData.width;
	captureCanvas.height = imageData.height;
	const captureContext = captureCanvas.getContext('2d');
	captureContext.putImageData(imageData, 0, 0);
	context.imageSmoothingEnabled = false;
	context.drawImage(captureCanvas, 0, 0, canvas.width, canvas.height);
}

function sampleSelectedPixelsFromImageData(imageData, samples) {
	return samples.map((sample) => {
		const x = Math.max(0, Math.min(imageData.width - 1, sample.x));
		const y = Math.max(0, Math.min(imageData.height - 1, sample.y));
		const offset = (y * imageData.width + x) * 4;
		return {
			id: sample.id,
			x,
			y,
			rgba: Array.from(imageData.data.slice(offset, offset + 4)),
		};
	});
}

function imageDiff(a, b) {
	let maxAbsRgbDelta = 0;
	let sumAbsRgbDelta = 0;
	let rgbCount = 0;
	for (let index = 0; index < Math.min(a.length, b.length); index += 4) {
		for (let channel = 0; channel < 3; channel += 1) {
			const delta = Math.abs(a[index + channel] - b[index + channel]);
			maxAbsRgbDelta = Math.max(maxAbsRgbDelta, delta);
			sumAbsRgbDelta += delta;
			rgbCount += 1;
		}
	}
	return {
		maxAbsRgbDelta,
		meanAbsRgbDelta: rgbCount === 0 ? 0 : sumAbsRgbDelta / rgbCount,
	};
}

function runReferenceErrorProbe() {
	// This intentionally mirrors a browser-side typo such as "lerp is not defined".
	// The harness should catch the page.evaluate rejection and keep watch mode alive.
	return missingLocalSecondOrderProbeSymbol();
}

function normalizeCommand(command) {
	const input = command && typeof command === 'object' ? command : {};
	return {
		id: input.id || 'browser-smoke',
		label: input.label || input.id || 'browser-runner-smoke',
		type: input.type || 'browser-smoke',
		createdAt: input.createdAt || new Date().toISOString(),
		stateGoal: input.stateGoal || '',
		payload: input.payload && typeof input.payload === 'object'
			? input.payload
			: {},
	};
}

function rejectedUnsupportedCommand(command, startedAt) {
	const completedAt = performance.now();
	drawUnsupportedCommandFrame(command);
	return {
		kind: 'algorithm32-local-second-order-browser-result',
		status: 'rejected',
		command,
		diagnostics: {
			status: 'rejected',
			commandType: command.type,
			reason: 'unsupported-command-type',
		},
		selectedPixels: sampleSelectedPixels(),
		criteriaResults: [{
			criterionId: 'command-type-supported',
			status: 'fail',
			tolerance: 'known command type',
			measuredError: command.type,
			sourceOrStatus: 'browser-entrypoint',
			notes: 'The initial lane browser page only supports browser-smoke.',
		}],
		imageDataUrl: canvas.toDataURL('image/png'),
		timings: {
			startedAtMs: startedAt,
			completedAtMs: completedAt,
			durationMs: completedAt - startedAt,
		},
	};
}

function collectCapabilities() {
	const probeCanvas = document.createElement('canvas');
	const webgl2Context = probeCanvas.getContext('webgl2');
	const webglContext = webgl2Context || probeCanvas.getContext('webgl');
	const rendererInfo = webglContext ? webglRendererInfo(webglContext) : null;
	return {
		userAgent: navigator.userAgent,
		webgl: Boolean(webglContext),
		webgl2: Boolean(webgl2Context),
		webglRenderer: rendererInfo,
		devicePixelRatio: window.devicePixelRatio,
	};
}

function webglRendererInfo(gl) {
	const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
	return {
		vendor: debugInfo
			? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
			: gl.getParameter(gl.VENDOR),
		renderer: debugInfo
			? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
			: gl.getParameter(gl.RENDERER),
	};
}

function drawSmokeFrame(command, capabilities) {
	const width = canvas.width;
	const height = canvas.height;
	const gradient = context.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, '#17202b');
	gradient.addColorStop(1, '#28404d');
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);

	context.fillStyle = '#84d6ff';
	context.fillRect(28, 44, 10, height - 88);
	context.fillStyle = '#c9f2a7';
	context.fillRect(46, 116, width - 92, 6);
	context.fillStyle = '#ffffff';
	context.font = '700 24px Arial, sans-serif';
	context.fillText('Local Second-Order Browser Runner', 64, 70);
	context.font = '16px Arial, sans-serif';
	context.fillText(`command: ${command.id}`, 64, 104);
	context.fillText(`type: ${command.type}`, 64, 140);
	context.fillText(`WebGL2: ${capabilities.webgl2 ? 'available' : 'missing'}`, 64, 174);
	context.fillText('ready for shared POC module validation commands', 64, 208);

	context.fillStyle = '#ffd166';
	context.beginPath();
	context.arc(width - 82, 72, 26, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = '#4da3ff';
	context.fillRect(width - 160, height - 82, 96, 24);
	context.fillStyle = '#1a1f28';
	context.fillRect(width - 112, height - 112, 124, 30);
}

function drawUnsupportedCommandFrame(command) {
	context.fillStyle = '#2b1720';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = '#ffb3b3';
	context.font = '700 24px Arial, sans-serif';
	context.fillText('Unsupported Browser Command', 48, 76);
	context.font = '16px Arial, sans-serif';
	context.fillText(`type: ${command.type}`, 48, 114);
}

function sampleSelectedPixels() {
	return [
		readPixel('upper-left-diagnostic', 32, 48),
		readPixel('center', Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
		readPixel('lower-right-diagnostic', canvas.width - 80, canvas.height - 82),
	];
}

function readPixel(id, x, y) {
	const rgba = Array.from(context.getImageData(x, y, 1, 1).data);
	return {
		id,
		x,
		y,
		rgba,
	};
}

drawSmokeFrame({
	id: 'page-loaded',
	type: 'browser-smoke',
}, collectCapabilities());
