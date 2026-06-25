import * as THREE from '/node_modules/three/build/three.module.js';
import { OrbitControls } from '/node_modules/three/examples/jsm/controls/OrbitControls.js';

const loadCountKey = 'algorithm32ShaderLabLoadCount';
const loadCount = Number(sessionStorage.getItem(loadCountKey) || '0') + 1;
sessionStorage.setItem(loadCountKey, String(loadCount));

window.runShaderLabSmoke = async function runShaderLabSmoke(command) {
	const mode = command?.payload?.mode || 'smoke';
	const startedAt = performance.now();

	if (
		mode === 'browser-three-baseline' ||
		mode === 'browser-ray-depth-diagnostics' ||
		mode === 'browser-atmosphere-components' ||
		mode === 'browser-direct-radiance-diagnostics' ||
		mode === 'browser-direct-radiance-spectral-diagnostics' ||
		mode === 'browser-second-order-diagnostics' ||
		mode === 'browser-second-order-spectral-diagnostics'
	) {
		return runBrowserThreeBaseline(command, startedAt);
	}
	if (mode === 'browser-first-order-image') {
		return runBrowserFirstOrderImage(command, startedAt);
	}
	if (mode === 'browser-second-order-image') {
		return runBrowserSecondOrderImage(command, startedAt);
	}
	if (mode === 'browser-scene-input-second-order-image') {
		return runBrowserSceneInputSecondOrderImage(command, startedAt);
	}
	if (mode === 'browser-gpu-scene-input-second-order-image') {
		return runBrowserGpuSceneInputSecondOrderImage(command, startedAt);
	}
	if (mode === 'browser-gpu-direct-scene-input-second-order-image') {
		return runBrowserGpuDirectSceneInputSecondOrderImage(command, startedAt);
	}
	if (mode === 'browser-lit-scene-input-capture') {
		return runBrowserLitSceneInputCapture(command, startedAt);
	}
	if (mode === 'browser-soft-shader-packet-passthrough') {
		return runBrowserSoftShaderPacketPassthrough(command, startedAt);
	}
	if (mode === 'browser-packet-driven-distant-sun-shader') {
		return runBrowserPacketDrivenDistantSunShader(command, startedAt);
	}
	if (mode === 'browser-lit-scene-soft-shader-composition') {
		return runBrowserLitSceneSoftShaderComposition(command, startedAt);
	}
	if (mode === 'browser-local-sun-first-order-diagnostics') {
		return runBrowserLocalSunFirstOrderDiagnostics(command, startedAt);
	}
	if (mode === 'browser-local-sun-full-image-shader') {
		return runBrowserLocalSunFullImageShader(command, startedAt);
	}
	if (mode === 'browser-scene-packet-soft-shader-image') {
		return runBrowserScenePacketSoftShaderImage(command, startedAt);
	}
	if (mode === 'browser-mountain-shader-image') {
		return runBrowserMountainShaderImage(command, startedAt);
	}
	if (mode === 'browser-mountain-lit-scene-input-capture') {
		return runBrowserMountainLitSceneInputCapture(command, startedAt);
	}
	if (mode === 'browser-three-native-atmosphere-pass') {
		return runBrowserThreeNativeAtmospherePass(command, startedAt);
	}
	if (mode === 'browser-three-native-live-atmosphere-pass') {
		return runBrowserThreeNativeLiveAtmospherePass(command, startedAt);
	}
	if (mode === 'browser-three-native-unified-adapter-switch') {
		return runBrowserThreeNativeUnifiedAdapterSwitch(command, startedAt);
	}
	if (mode === 'browser-three-native-live-pass-soft-shader-matrix') {
		return runBrowserThreeNativeLivePassSoftShaderMatrix(command, startedAt);
	}
	if (mode === 'browser-three-native-scenario-controls-poc') {
		return runBrowserThreeNativeScenarioControlsPoc(command, startedAt);
	}
	if (mode === 'browser-flat-earth-visibility-search') {
		return runBrowserFlatEarthVisibilitySearch(command, startedAt);
	}
	if (mode === 'browser-shader-benchmark') {
		return runBrowserShaderBenchmark(command, startedAt);
	}

	return runSmoke(command, startedAt);
};

console.log(`Algorithm32 shader lab page loaded ${loadCount} time(s).`);

const THREE_NATIVE_DEPTH_ACCEPTANCE_SAMPLE_IDS = Object.freeze([
	'upper-sky',
	'center',
	'lower-center',
]);
let algorithm32AtmospherePassInstanceCounter = 0;

function runBrowserThreeBaseline(command, startedAt) {
	const mode = command?.payload?.mode || 'browser-three-baseline';
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createBaselineScene(canvas);
	const { renderer, scene, camera, meshes, cards, ground } = sceneSetup;
	renderer.render(scene, camera);

	const selectedPixels = sampleBaselinePixels({
		canvas,
		renderer,
		camera,
		meshes,
		cardMeshes: meshes.filter((mesh) => mesh.userData.kind === 'card'),
	});
	const usesAtmosphereComponents =
		mode === 'browser-atmosphere-components' ||
		mode === 'browser-direct-radiance-diagnostics';
	const atmosphereComponents = usesAtmosphereComponents
		? selectedPixels.map((sample) => computeAtmosphereComponents(sample))
		: null;
	const atmosphereShaderDiagnostics = atmosphereComponents
		? runAtmosphereComponentShader(atmosphereComponents)
		: null;
	const directRadianceDiagnostics = mode === 'browser-direct-radiance-diagnostics'
		? selectedPixels.map((sample) => computeDirectRadianceDiagnostic(sample))
		: null;
	const directRadianceShaderDiagnostics = directRadianceDiagnostics
		? runDirectRadianceShader(directRadianceDiagnostics)
		: null;
	const directRadianceSpectralDiagnostics =
		mode === 'browser-direct-radiance-spectral-diagnostics'
			? selectedPixels.map((sample) => computeDirectRadianceSpectralDiagnostic(sample))
			: null;
	const directRadianceSpectralShaderDiagnostics =
		directRadianceSpectralDiagnostics
			? runDirectRadianceSpectralShader(directRadianceSpectralDiagnostics)
			: null;
	const secondOrderIncidentSkyCache = new Map();
	const secondOrderRadianceDiagnostics =
		mode === 'browser-second-order-diagnostics'
			? selectedPixels.map((sample) =>
					computeSecondOrderRadianceDiagnostic(
						sample,
						secondOrderIncidentSkyCache
					)
				)
			: null;
	const secondOrderRadianceShaderDiagnostics =
		secondOrderRadianceDiagnostics
			? runSecondOrderRadianceShader(secondOrderRadianceDiagnostics)
			: null;
	const secondOrderSpectralIncidentSkyCache = new Map();
	const secondOrderRadianceSpectralDiagnostics =
		mode === 'browser-second-order-spectral-diagnostics'
			? selectedPixels.map((sample) =>
					computeSecondOrderRadianceSpectralDiagnostic(
						sample,
						secondOrderSpectralIncidentSkyCache
					)
				)
			: null;
	const secondOrderRadianceSpectralShaderDiagnostics =
		secondOrderRadianceSpectralDiagnostics
			? runSecondOrderRadianceSpectralShader(
					secondOrderRadianceSpectralDiagnostics
				)
			: null;
	const diagnostics = baselineDiagnostics({
		command,
		canvas,
		renderer,
		camera,
		cards,
		ground,
		selectedPixels,
		atmosphereComponents,
		atmosphereShaderDiagnostics,
		directRadianceDiagnostics,
		directRadianceShaderDiagnostics,
		directRadianceSpectralDiagnostics,
		directRadianceSpectralShaderDiagnostics,
		secondOrderRadianceDiagnostics,
		secondOrderRadianceShaderDiagnostics,
		secondOrderRadianceSpectralDiagnostics,
		secondOrderRadianceSpectralShaderDiagnostics,
	});
	const completedAt = performance.now();

	renderer.dispose();
	for (const mesh of meshes) {
		mesh.geometry.dispose();
		mesh.material.dispose();
	}

	return {
		kind: mode === 'browser-ray-depth-diagnostics'
			? 'algorithm32-browser-ray-depth-diagnostics-result'
			: mode === 'browser-atmosphere-components'
				? 'algorithm32-browser-atmosphere-components-result'
			: mode === 'browser-direct-radiance-diagnostics'
				? 'algorithm32-browser-direct-radiance-diagnostics-result'
			: mode === 'browser-direct-radiance-spectral-diagnostics'
				? 'algorithm32-browser-direct-radiance-spectral-diagnostics-result'
			: mode === 'browser-second-order-diagnostics'
				? 'algorithm32-browser-second-order-diagnostics-result'
			: mode === 'browser-second-order-spectral-diagnostics'
				? 'algorithm32-browser-second-order-spectral-diagnostics-result'
			: 'algorithm32-browser-three-baseline-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels,
		atmosphereComponents,
		atmosphereShaderDiagnostics,
		directRadianceDiagnostics,
		directRadianceShaderDiagnostics,
		directRadianceSpectralDiagnostics,
		directRadianceSpectralShaderDiagnostics,
		secondOrderRadianceDiagnostics,
		secondOrderRadianceShaderDiagnostics,
		secondOrderRadianceSpectralDiagnostics,
		secondOrderRadianceSpectralShaderDiagnostics,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserFirstOrderImage(command, startedAt) {
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createBaselineScene(canvas, {
		width: command?.payload?.width || 240,
		height: command?.payload?.height || 120,
	});
	const { renderer, camera, meshes, cards, ground } = sceneSetup;
	const imageShaderDiagnostics = renderFirstOrderImageShader({ renderer, camera });
	const selectedPixels = sampleBaselinePixels({
		canvas,
		renderer,
		camera,
		meshes,
		cardMeshes: meshes.filter((mesh) => mesh.userData.kind === 'card'),
	});
	const directRadianceSpectralDiagnostics = selectedPixels.map((sample) =>
		computeDirectRadianceSpectralDiagnostic(sample)
	);
	const selectedDisplayChecks = compareSelectedImagePixelsToSpectralPreview({
		selectedPixels,
		directRadianceSpectralDiagnostics,
	});
	const diagnostics = firstOrderImageDiagnostics({
		command,
		canvas,
		renderer,
		camera,
		cards,
		ground,
		selectedPixels,
		imageShaderDiagnostics,
		directRadianceSpectralDiagnostics,
		selectedDisplayChecks,
	});
	const completedAt = performance.now();

	renderer.dispose();
	for (const mesh of meshes) {
		mesh.geometry.dispose();
		mesh.material.dispose();
	}

	return {
		kind: 'algorithm32-browser-first-order-image-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels,
		directRadianceSpectralDiagnostics,
		selectedDisplayChecks,
		imageShaderDiagnostics,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserSecondOrderImage(command, startedAt) {
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createBaselineScene(canvas, {
		width: command?.payload?.width || 160,
		height: command?.payload?.height || 80,
	});
	const { renderer, camera, meshes, cards, ground } = sceneSetup;
	const imageShaderDiagnostics = renderFirstOrderImageShader({
		renderer,
		camera,
		includeSecondOrder: true,
	});
	const selectedPixels = sampleBaselinePixels({
		canvas,
		renderer,
		camera,
		meshes,
		cardMeshes: meshes.filter((mesh) => mesh.userData.kind === 'card'),
	});
	const secondOrderSpectralIncidentSkyCache = new Map();
	const secondOrderRadianceSpectralDiagnostics = selectedPixels.map((sample) =>
		computeSecondOrderRadianceSpectralDiagnostic(
			sample,
			secondOrderSpectralIncidentSkyCache
		)
	);
	const selectedDisplayChecks = compareSelectedImagePixelsToSpectralPreview({
		selectedPixels,
		spectralDiagnostics: secondOrderRadianceSpectralDiagnostics,
	});
	const diagnostics = secondOrderImageDiagnostics({
		command,
		canvas,
		renderer,
		camera,
		cards,
		ground,
		selectedPixels,
		imageShaderDiagnostics,
		secondOrderRadianceSpectralDiagnostics,
		selectedDisplayChecks,
	});
	const completedAt = performance.now();

	renderer.dispose();
	for (const mesh of meshes) {
		mesh.geometry.dispose();
		mesh.material.dispose();
	}

	return {
		kind: 'algorithm32-browser-second-order-image-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels,
		secondOrderRadianceSpectralDiagnostics,
		selectedDisplayChecks,
		imageShaderDiagnostics,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserSceneInputSecondOrderImage(command, startedAt) {
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createBaselineScene(canvas, {
		width: command?.payload?.width || 160,
		height: command?.payload?.height || 80,
	});
	const { renderer, camera, meshes, cards, ground } = sceneSetup;
	const sceneInputTextureData = buildSceneInputTextureData({
		canvas,
		camera,
		meshes,
	});
	const imageShaderDiagnostics = renderFirstOrderImageShader({
		renderer,
		camera,
		includeSecondOrder: true,
		sceneInputTextureData,
	});
	const selectedPixels = sampleBaselinePixels({
		canvas,
		renderer,
		camera,
		meshes,
		cardMeshes: meshes.filter((mesh) => mesh.userData.kind === 'card'),
	});
	const secondOrderSpectralIncidentSkyCache = new Map();
	const secondOrderRadianceSpectralDiagnostics = selectedPixels.map((sample) =>
		computeSecondOrderRadianceSpectralDiagnostic(
			sample,
			secondOrderSpectralIncidentSkyCache
		)
	);
	const selectedDisplayChecks = compareSelectedImagePixelsToSpectralPreview({
		selectedPixels,
		spectralDiagnostics: secondOrderRadianceSpectralDiagnostics,
	});
	const diagnostics = secondOrderImageDiagnostics({
		command,
		canvas,
		renderer,
		camera,
		cards,
		ground,
		selectedPixels,
		imageShaderDiagnostics,
		secondOrderRadianceSpectralDiagnostics,
		selectedDisplayChecks,
		sceneInputTextureData,
	});
	const completedAt = performance.now();

	renderer.dispose();
	for (const mesh of meshes) {
		mesh.geometry.dispose();
		mesh.material.dispose();
	}

	return {
		kind: 'algorithm32-browser-scene-input-second-order-image-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels,
		secondOrderRadianceSpectralDiagnostics,
		selectedDisplayChecks,
		imageShaderDiagnostics,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserGpuSceneInputSecondOrderImage(command, startedAt) {
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createBaselineScene(canvas, {
		width: command?.payload?.width || 160,
		height: command?.payload?.height || 80,
	});
	const { renderer, scene, camera, meshes, cards, ground } = sceneSetup;
	const sceneInputTextureData = buildGpuSceneInputTextureData({
		renderer,
		scene,
		camera,
		meshes,
	});
	const imageShaderDiagnostics = renderFirstOrderImageShader({
		renderer,
		camera,
		includeSecondOrder: true,
		sceneInputTextureData,
	});
	const selectedPixels = sampleBaselinePixels({
		canvas,
		renderer,
		camera,
		meshes,
		cardMeshes: meshes.filter((mesh) => mesh.userData.kind === 'card'),
	});
	const secondOrderSpectralIncidentSkyCache = new Map();
	const secondOrderRadianceSpectralDiagnostics = selectedPixels.map((sample) =>
		computeSecondOrderRadianceSpectralDiagnostic(
			sample,
			secondOrderSpectralIncidentSkyCache
		)
	);
	const selectedDisplayChecks = compareSelectedImagePixelsToSpectralPreview({
		selectedPixels,
		spectralDiagnostics: secondOrderRadianceSpectralDiagnostics,
	});
	const diagnostics = secondOrderImageDiagnostics({
		command,
		canvas,
		renderer,
		camera,
		cards,
		ground,
		selectedPixels,
		imageShaderDiagnostics,
		secondOrderRadianceSpectralDiagnostics,
		selectedDisplayChecks,
		sceneInputTextureData,
	});
	const completedAt = performance.now();

	renderer.dispose();
	for (const mesh of meshes) {
		mesh.geometry.dispose();
		mesh.material.dispose();
	}

	return {
		kind: 'algorithm32-browser-gpu-scene-input-second-order-image-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels,
		secondOrderRadianceSpectralDiagnostics,
		selectedDisplayChecks,
		imageShaderDiagnostics,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserGpuDirectSceneInputSecondOrderImage(command, startedAt) {
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createBaselineScene(canvas, {
		width: command?.payload?.width || 160,
		height: command?.payload?.height || 80,
	});
	const { renderer, scene, camera, meshes, cards, ground } = sceneSetup;
	const sceneInputRenderTarget = buildGpuSceneInputRenderTarget({
		renderer,
		scene,
		camera,
		meshes,
	});
	const imageShaderDiagnostics = renderFirstOrderImageShader({
		renderer,
		camera,
		includeSecondOrder: true,
		sceneInputTextureHandle: sceneInputRenderTarget.textureHandle,
		sceneInputTextureMetadata: sceneInputRenderTarget.metadata,
	});
	const selectedPixels = sampleBaselinePixels({
		canvas,
		renderer,
		camera,
		meshes,
		cardMeshes: meshes.filter((mesh) => mesh.userData.kind === 'card'),
	});
	const secondOrderSpectralIncidentSkyCache = new Map();
	const secondOrderRadianceSpectralDiagnostics = selectedPixels.map((sample) =>
		computeSecondOrderRadianceSpectralDiagnostic(
			sample,
			secondOrderSpectralIncidentSkyCache
		)
	);
	const selectedDisplayChecks = compareSelectedImagePixelsToSpectralPreview({
		selectedPixels,
		spectralDiagnostics: secondOrderRadianceSpectralDiagnostics,
	});
	const diagnostics = secondOrderImageDiagnostics({
		command,
		canvas,
		renderer,
		camera,
		cards,
		ground,
		selectedPixels,
		imageShaderDiagnostics,
		secondOrderRadianceSpectralDiagnostics,
		selectedDisplayChecks,
		sceneInputTextureData: sceneInputRenderTarget.metadata,
	});
	const completedAt = performance.now();

	sceneInputRenderTarget.dispose();
	renderer.dispose();
	for (const mesh of meshes) {
		mesh.geometry.dispose();
		mesh.material.dispose();
	}

	return {
		kind: 'algorithm32-browser-gpu-direct-scene-input-second-order-image-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels,
		secondOrderRadianceSpectralDiagnostics,
		selectedDisplayChecks,
		imageShaderDiagnostics,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserLitSceneInputCapture(command, startedAt) {
	const payload = command?.payload || {};
	const width = positiveInteger(payload.width, 160);
	const height = positiveInteger(payload.height, 90);
	const sunCase = resolveDistantSunCase(payload.sunCase);
	const sourcePacket = makeDistantSunSourcePacket(sunCase);
	const sourceLightMode = payload.sourceLightMode || 'hardcoded-browser-light';
	const sceneLightConfig =
		sourceLightMode === 'distant-directional-sun'
			? makeDistantSunSceneLightConfig({ sunCase })
			: null;
	const canvas = document.getElementById('lab-canvas');
	const captures = {};
	const allSelectedPixels = [];

	const unlitSetup = createBaselineScene(canvas, { width, height });
	try {
		unlitSetup.renderer.render(unlitSetup.scene, unlitSetup.camera);
		captures.unlitMaterialControl = captureSceneInputPacket({
			captureId: 'unlit-material-control',
			sceneMode: 'three-card-reference',
			sceneColorPolicy:
				'unlit MeshBasicMaterial scene matching the original CPU renderer geometry; no Three lights or shadows',
			canvas,
			renderer: unlitSetup.renderer,
			camera: unlitSetup.camera,
			meshes: unlitSetup.meshes,
			sceneObjects: unlitSetup.cards,
			ground: unlitSetup.ground,
			sourcePacket,
			sceneLightPacket: null,
		});
		allSelectedPixels.push(
			...captures.unlitMaterialControl.selectedPixels.map((sample) => ({
				...sample,
				captureId: 'unlit-material-control',
			}))
		);
	} finally {
		disposeSceneSetup(unlitSetup);
	}

	const litSetup = createShadowCardFloorScene(canvas, {
		width,
		height,
		sceneLightConfig,
	});
	let imageDataUrl = null;
	try {
		litSetup.renderer.render(litSetup.scene, litSetup.camera);
		captures.litShadowScene = captureSceneInputPacket({
			captureId: 'lit-shadow-scene',
			sceneMode: 'shadow-card-floor',
			sceneColorPolicy:
				sourceLightMode === 'distant-directional-sun'
					? 'Three MeshStandardMaterial scene with source-driven DirectionalLight shadows and ambient fill'
					: 'Three MeshStandardMaterial scene with DirectionalLight shadows and ambient fill',
			canvas,
			renderer: litSetup.renderer,
			camera: litSetup.camera,
			meshes: litSetup.meshes,
			sceneObjects: litSetup.sceneObjects,
			ground: litSetup.ground,
			sourcePacket,
			sceneLightPacket: litSetup.sceneLightPacket,
		});
		allSelectedPixels.push(
			...captures.litShadowScene.selectedPixels.map((sample) => ({
				...sample,
				captureId: 'lit-shadow-scene',
			}))
		);
		imageDataUrl = canvas.toDataURL('image/png');
	} finally {
		disposeSceneSetup(litSetup);
	}

	const diagnostics = litSceneInputCaptureDiagnostics({
		command,
		width,
		height,
		captures,
	});
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-lit-scene-input-capture-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: { width, height },
		imageDataUrl,
		selectedPixels: allSelectedPixels,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserSoftShaderPacketPassthrough(command, startedAt) {
	const payload = command?.payload || {};
	const width = positiveInteger(payload.width, 160);
	const height = positiveInteger(payload.height, 90);
	const sunCase = resolveDistantSunCase(payload.sunCase);
	const sourcePacket = makeDistantSunSourcePacket(sunCase);
	const sourceLightMode = payload.sourceLightMode || 'distant-directional-sun';
	const sceneLightConfig =
		sourceLightMode === 'distant-directional-sun'
			? makeDistantSunSceneLightConfig({ sunCase })
			: null;
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createShadowCardFloorScene(canvas, {
		width,
		height,
		sceneLightConfig,
	});
	let packet;
	let shaderResult;

	try {
		sceneSetup.renderer.render(sceneSetup.scene, sceneSetup.camera);
		packet = captureSceneInputPacket({
			captureId: 'soft-shader-packet-passthrough-lit-shadow-scene',
			sceneMode: 'shadow-card-floor',
			sceneColorPolicy:
				'Three MeshStandardMaterial lit scene-color packet uploaded to a GPU passthrough shader with atmosphere disabled',
			canvas,
			renderer: sceneSetup.renderer,
			camera: sceneSetup.camera,
			meshes: sceneSetup.meshes,
			sceneObjects: sceneSetup.sceneObjects,
			ground: sceneSetup.ground,
			sourcePacket,
			sceneLightPacket: sceneSetup.sceneLightPacket,
		});
		shaderResult = renderSceneColorPassthroughShader({
			renderer: sceneSetup.renderer,
			packet,
		});
	} finally {
		disposeSceneSetup(sceneSetup);
	}

	const selectedChecks = packet.selectedPixels.map((sample) => {
		const offset = (sample.y * width + sample.x) * 4;
		const expectedRgba = packet.sceneColorRgba8.slice(offset, offset + 4);
		const shaderRgba = Array.from(
			shaderResult.readbackRgba8.slice(offset, offset + 4)
		);
		const deltas = shaderRgba.map((value, index) => value - expectedRgba[index]);
		return {
			id: sample.id,
			x: sample.x,
			y: sample.y,
			classification: sample.classification,
			hitDistanceMeters: sample.hitDistanceMeters,
			expectedRgba,
			shaderRgba,
			deltas,
			maxAbsRgbDelta: Math.max(
				...deltas.slice(0, 3).map((value) => Math.abs(value))
			),
		};
	});
	const maxAbsDelta = maxAbsByteDelta(
		new Uint8Array(packet.sceneColorRgba8),
		shaderResult.readbackRgba8
	);
	const diagnostics = softShaderPacketPassthroughDiagnostics({
		command,
		packet,
		shaderResult,
		selectedChecks,
		maxAbsDelta,
	});
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-soft-shader-packet-passthrough-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: { width, height },
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels: packet.selectedPixels,
		sceneInputPacket: packet,
		shaderReadbackRgba8: Array.from(shaderResult.readbackRgba8),
		selectedDisplayChecks: selectedChecks,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserPacketDrivenDistantSunShader(command, startedAt) {
	const payload = command?.payload || {};
	const width = positiveInteger(payload.width, 160);
	const height = positiveInteger(payload.height, 80);
	const sunCase = resolveDistantSunCase(payload.sunCase);
	const sourcePacket = makeDistantSunSourcePacket(sunCase);
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createBaselineScene(canvas, { width, height });
	const { renderer, camera, meshes, cards, ground } = sceneSetup;
	let sceneInputTextureData;
	let imageShaderDiagnostics;
	let selectedPixels;
	let secondOrderRadianceSpectralDiagnostics;
	let selectedDisplayChecks;
	let outputRgba8;

	try {
		sceneInputTextureData = buildSceneInputTextureData({
			canvas,
			camera,
			meshes,
		});
		imageShaderDiagnostics = renderFirstOrderImageShader({
			renderer,
			camera,
			includeSecondOrder: true,
			sceneInputTextureData,
			sunRay: sourcePacket.sunDirection,
		});
		selectedPixels = sampleBaselinePixels({
			canvas,
			renderer,
			camera,
			meshes,
			cardMeshes: meshes.filter((mesh) => mesh.userData.kind === 'card'),
		});
		const secondOrderSpectralIncidentSkyCache = new Map();
		secondOrderRadianceSpectralDiagnostics = selectedPixels.map((sample) =>
			computeSecondOrderRadianceSpectralDiagnostic(
				sample,
				secondOrderSpectralIncidentSkyCache,
				sunCase
			)
		);
		selectedDisplayChecks = compareSelectedImagePixelsToSpectralPreview({
			selectedPixels,
			spectralDiagnostics: secondOrderRadianceSpectralDiagnostics,
		});
		outputRgba8 = readCanvasRgbaTopLeft(renderer, width, height);
	} finally {
		disposeSceneSetup(sceneSetup);
	}

	const diagnostics = packetDrivenDistantSunShaderDiagnostics({
		command,
		canvas,
		renderer,
		camera,
		cards,
		ground,
		sourcePacket,
		sunCase,
		selectedPixels,
		imageShaderDiagnostics,
		secondOrderRadianceSpectralDiagnostics,
		selectedDisplayChecks,
		sceneInputTextureData,
		outputRgba8,
	});
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-packet-driven-distant-sun-shader-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: { width, height },
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels,
		sourcePacket,
		imageShaderDiagnostics,
		secondOrderRadianceSpectralDiagnostics,
		selectedDisplayChecks,
		outputSummary: summarizeRgba8(outputRgba8),
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserLitSceneSoftShaderComposition(command, startedAt) {
	const payload = command?.payload || {};
	const width = positiveInteger(payload.width, 160);
	const height = positiveInteger(payload.height, 90);
	const sunCase = resolveDistantSunCase(payload.sunCase);
	const sourcePacket = makeDistantSunSourcePacket(sunCase);
	const sceneLightConfig = makeDistantSunSceneLightConfig({ sunCase });
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createShadowCardFloorScene(canvas, {
		width,
		height,
		sceneLightConfig,
	});
	let packet;
	let passthroughResult;
	let atmosphereResult;

	try {
		sceneSetup.renderer.render(sceneSetup.scene, sceneSetup.camera);
		packet = captureSceneInputPacket({
			captureId: 'lit-scene-soft-shader-composition',
			sceneMode: 'shadow-card-floor',
			sceneColorPolicy:
				'Three MeshStandardMaterial lit scene-color packet composed by GPU soft-shader atmosphere pass',
			canvas,
			renderer: sceneSetup.renderer,
			camera: sceneSetup.camera,
			meshes: sceneSetup.meshes,
			sceneObjects: sceneSetup.sceneObjects,
			ground: sceneSetup.ground,
			sourcePacket,
			sceneLightPacket: sceneSetup.sceneLightPacket,
		});
		passthroughResult = renderSceneColorPassthroughShader({
			renderer: sceneSetup.renderer,
			packet,
		});
		atmosphereResult = renderSoftShaderAtmospherePostprocess({
			renderer: sceneSetup.renderer,
			camera: sceneSetup.camera,
			packet,
			includeSecondOrder: true,
		});
	} finally {
		disposeSceneSetup(sceneSetup);
	}

	const passthroughMaxAbsDelta = maxAbsByteDelta(
		new Uint8Array(packet.sceneColorRgba8),
		passthroughResult.readbackRgba8
	);
	const selectedChecks = packet.selectedPixels.map((sample) =>
		softShaderCompositionSelectedCheck({
			packet,
			sample,
			sunCase,
			shaderRgba: rgbaAt(
				atmosphereResult.readbackRgba8,
				packet.width,
				sample.x,
				sample.y
			),
		})
	);
	const shadowCheck = softShaderShadowCheck({
		packet,
		outputRgba8: atmosphereResult.readbackRgba8,
	});
	const skyReplacementCheck = softShaderSkyReplacementCheck({
		packet,
		outputRgba8: atmosphereResult.readbackRgba8,
	});
	const diagnostics = litSceneSoftShaderCompositionDiagnostics({
		command,
		packet,
		passthroughResult,
		atmosphereResult,
		passthroughMaxAbsDelta,
		selectedChecks,
		shadowCheck,
		skyReplacementCheck,
	});
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-lit-scene-soft-shader-composition-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: { width, height },
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels: packet.selectedPixels,
		sceneInputPacket: packet,
		shaderReadbackRgba8: Array.from(atmosphereResult.readbackRgba8),
		selectedDisplayChecks: selectedChecks,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserLocalSunFirstOrderDiagnostics(command, startedAt) {
	const payload = command?.payload || {};
	const cases = payload.localSourceCases || [];
	const topAltitudeMeters = finitePositiveNumber(
		payload.topAltitudeMeters,
		100000
	);
	const observerPositionMeters = payload.observerPositionMeters || [0, 0, 2];
	const caseResults = cases.map((sourceCase) => {
		const samples = localSunDiagnosticSamples({
			sourceCase,
			observerPositionMeters,
			topAltitudeMeters,
		});
		const cpuDiagnostics = samples.map((sample) =>
			computeFlatLocalFirstOrderDisplayDiagnostic({
				sample,
				sourceCase,
				topAltitudeMeters,
			})
		);
		const shaderDiagnostics = runFlatLocalFirstOrderDiagnosticShader({
			samples,
			sourceCase,
			topAltitudeMeters,
		});
		const selectedChecks = cpuDiagnostics.map((cpu, index) => {
			const shader = shaderDiagnostics.samples[index];
			const deltas = shader.rgba.map((value, channelIndex) =>
				value - cpu.encodedRgba[channelIndex]
			);
			return {
				id: cpu.id,
				rgba: shader.rgba,
				expectedRgba: cpu.encodedRgba,
				deltas,
				maxAbsRgbDelta: Math.max(
					...deltas.slice(0, 3).map((value) => Math.abs(value))
				),
				cpu,
				shader,
			};
		});
		const maxSelectedRgbDelta = Math.max(
			0,
			...selectedChecks.map((item) => item.maxAbsRgbDelta)
		);
		const sourceSampleAtObserver = flatLocalSourceSample({
			sourceCase,
			position: observerPositionMeters,
		});
		const criteria = [
			{
				id: 'shader-run-accepted',
				status: shaderDiagnostics.status === 'accepted' ? 'passed' : 'failed',
				measured: shaderDiagnostics.summary,
			},
			{
				id: 'selected-display-parity',
				status: maxSelectedRgbDelta <= 2 ? 'passed' : 'failed',
				measured: { maxSelectedRgbDelta },
			},
			{
				id: 'finite-source-diagnostics-recorded',
				status:
					Number.isFinite(sourceSampleAtObserver.distanceMeters) &&
					Number.isFinite(sourceSampleAtObserver.incidentScale) &&
					sourceSampleAtObserver.distanceMeters > 0
						? 'passed'
						: 'failed',
				measured: sourceSampleAtObserver,
			},
			{
				id: 'local-second-order-deferred',
				status: 'passed',
				measured: {
					includeSecondOrder: false,
					reason:
						'Milestone 25 validates first-order finite local-source shader math only.',
				},
			},
		];
		const summary = {
			passed: criteria.filter((criterion) => criterion.status === 'passed').length,
			failed: criteria.filter((criterion) => criterion.status === 'failed').length,
		};

		return {
			id: sourceCase.id,
			offsetDegrees: sourceCase.offsetDegrees,
			status: summary.failed === 0 ? 'accepted' : 'rejected',
			sourceCase,
			sourceSampleAtObserver,
			selectedChecks,
			maxSelectedRgbDelta,
			summary,
			criteria,
		};
	});
	const closest = caseResults.find((item) => item.offsetDegrees === 0);
	const ninety = caseResults.find((item) => item.offsetDegrees === 90);
	const aggregateCriteria = [
		{
			id: 'required-local-cases-present',
			status: closest && ninety ? 'passed' : 'failed',
			measured: caseResults.map((item) => ({
				id: item.id,
				offsetDegrees: item.offsetDegrees,
			})),
		},
		{
			id: 'all-local-cases-accepted',
			status: caseResults.every((item) => item.status === 'accepted')
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.id,
				status: item.status,
				summary: item.summary,
			})),
		},
		{
			id: 'closest-brighter-than-90deg',
			status:
				closest &&
				ninety &&
				meanCaseLuminance(closest) > meanCaseLuminance(ninety)
					? 'passed'
					: 'failed',
			measured: {
				closestMeanLuminance: closest ? meanCaseLuminance(closest) : null,
				ninetyMeanLuminance: ninety ? meanCaseLuminance(ninety) : null,
			},
		},
	];
	const aggregateSummary = {
		passed:
			aggregateCriteria.filter((criterion) => criterion.status === 'passed')
				.length +
			caseResults.reduce((sum, item) => sum + item.summary.passed, 0),
		failed:
			aggregateCriteria.filter((criterion) => criterion.status === 'failed')
				.length +
			caseResults.reduce((sum, item) => sum + item.summary.failed, 0),
	};
	const diagnostics = {
		kind: 'browser-local-sun-first-order-diagnostics',
		status: aggregateSummary.failed === 0 ? 'accepted' : 'rejected',
		iteration: payload.iteration || '25-local-sun-first-order-shader',
		goal:
			'Validate flat/local point-Sun first-order source sampling in a focused WebGL diagnostic shader.',
		commandPayload: payload,
		caseResults,
		aggregateCriteria,
		summary: aggregateSummary,
	};
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-local-sun-first-order-diagnostics-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: { width: cases.length || 1, height: 1 },
		selectedPixels: caseResults.flatMap((item) =>
			item.selectedChecks.map((check) => ({
				caseId: item.id,
				id: check.id,
				rgba: check.rgba,
				expectedRgba: check.expectedRgba,
				maxAbsRgbDelta: check.maxAbsRgbDelta,
			}))
		),
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserLocalSunFullImageShader(command, startedAt) {
	const payload = command?.payload || {};
	const packet = payload.sceneInputPacket;
	if (!packet || packet.source?.kind !== 'flat-local-point-sun') {
		return {
			kind: 'algorithm32-browser-local-sun-full-image-shader-result',
			status: 'rejected',
			commandId: command?.id,
			commandLabel: command?.label,
			reason:
				'browser-local-sun-full-image-shader requires a sceneInputPacket with source.kind = flat-local-point-sun.',
			diagnostics: {
				status: 'rejected',
				summary: { passed: 0, failed: 1 },
				criteria: [
					{
						id: 'flat-local-source-packet-present',
						status: 'failed',
						measured: { source: packet?.source || null },
					},
				],
			},
		};
	}

	const canvas = document.getElementById('lab-canvas');
	canvas.width = packet.width;
	canvas.height = packet.height;
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		preserveDrawingBuffer: true,
	});
	renderer.setSize(packet.width, packet.height, false);
	renderer.setPixelRatio(1);
	if ('toneMapping' in renderer) {
		renderer.toneMapping = THREE.NoToneMapping;
	}

	const surfacePolicy =
		payload.surfacePolicy ||
		packet.sceneColorPolicy ||
		'spectrum-id-reference-radiance';
	const composeSceneColor = surfacePolicy !== 'spectrum-id-reference-radiance';
	const expectedSelectedPixels = Array.isArray(payload.expectedSelectedPixels)
		? payload.expectedSelectedPixels
		: [];
	const shaderResult = renderFlatLocalSoftShaderPostprocess({
		renderer,
		packet,
		composeSceneColor,
		surfacePolicy,
	});
	const selectedChecks = localFullImageSelectedChecks({
		packet,
		outputRgba8: shaderResult.readbackRgba8,
		expectedSelectedPixels,
	});
	const maxSelectedRgbDelta = Math.max(
		0,
		...selectedChecks.map((item) => item.maxAbsRgbDelta ?? 0)
	);
	const criteria = [
		{
			id: 'flat-local-source-packet-present',
			status: packet.source?.kind === 'flat-local-point-sun' ? 'passed' : 'failed',
			measured: {
				source: {
					kind: packet.source?.kind,
					id: packet.source?.id,
					offsetDegrees: packet.source?.offsetDegrees ?? null,
				},
				geometry: packet.geometry,
			},
		},
		{
			id: 'packet-has-sky-and-hit',
			status:
				packet.counts?.skyPixels > 0 && packet.counts?.hitPixels > 0
					? 'passed'
					: 'failed',
			measured: packet.counts || null,
		},
		{
			id: 'full-image-shader-run-accepted',
			status: shaderResult.imageShaderDiagnostics?.status === 'accepted'
				? 'passed'
				: 'failed',
			measured: shaderResult.imageShaderDiagnostics,
		},
		{
			id: 'selected-pixels-match-cpu-soft-shader',
			status:
				expectedSelectedPixels.length > 0 && maxSelectedRgbDelta <= 2
					? 'passed'
					: 'failed',
			measured: {
				expectedSelectedPixels: expectedSelectedPixels.length,
				maxSelectedRgbDelta,
				selectedChecks,
			},
		},
		{
			id: 'surface-policy-recorded',
			status:
				shaderResult.imageShaderDiagnostics?.composeSceneColor ===
				composeSceneColor
					? 'passed'
					: 'failed',
			measured: {
				surfacePolicy,
				composeSceneColor,
			},
		},
	];
	const summary = {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-local-sun-full-image-shader-result',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: { width: packet.width, height: packet.height },
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels: selectedChecks.map((check) => ({
			id: check.id,
			x: check.x,
			y: check.y,
			shaderRgba: check.shaderRgba,
			expectedRgba: check.expectedRgba,
			maxAbsRgbDelta: check.maxAbsRgbDelta,
		})),
		diagnostics: {
			kind: 'browser-local-sun-full-image-shader-diagnostics',
			status: summary.failed === 0 ? 'accepted' : 'rejected',
			iteration:
				payload.iteration || '27-local-sun-full-image-shader-parity',
			goal:
				'Render a full scene-input packet through the flat/local point-Sun GPU soft-shader path.',
			commandPayload: {
				...payload,
				sceneInputPacket: {
					width: packet.width,
					height: packet.height,
					captureId: packet.captureId,
					sceneMode: packet.sceneMode,
					counts: packet.counts,
					source: packet.source,
					geometry: packet.geometry,
					sceneColorPolicy: packet.sceneColorPolicy,
				},
				expectedSelectedPixels: expectedSelectedPixels.map((sample) => ({
					id: sample.id,
					x: sample.x,
					y: sample.y,
					postprocessRgba8: sample.postprocessRgba8,
				})),
			},
			threeRevision: THREE.REVISION,
			webgl: shaderResult.webgl,
			packetSummary: {
				width: packet.width,
				height: packet.height,
				captureId: packet.captureId,
				sceneMode: packet.sceneMode,
				rowOrder: packet.rowOrder,
				counts: packet.counts,
				source: packet.source,
				geometry: packet.geometry,
			},
			surfacePolicy,
			composeSceneColor,
			textureInputs: shaderResult.textureInputs,
			outputSummary: summarizeRgba8(shaderResult.readbackRgba8),
			selectedChecks,
			maxSelectedRgbDelta,
			criteria,
			summary,
		},
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserScenePacketSoftShaderImage(command, startedAt) {
	const payload = command?.payload || {};
	const packet = payload.sceneInputPacket;
	if (!packet?.source?.kind) {
		return {
			kind: 'algorithm32-browser-scene-packet-soft-shader-image-result',
			status: 'rejected',
			commandId: command?.id,
			commandLabel: command?.label,
			reason:
				'browser-scene-packet-soft-shader-image requires a sceneInputPacket with source.kind.',
			diagnostics: {
				status: 'rejected',
				summary: { passed: 0, failed: 1 },
				criteria: [
					{
						id: 'source-packet-present',
						status: 'failed',
						measured: { source: packet?.source || null },
					},
				],
			},
		};
	}

	const { canvas, renderer, camera } = createPacketPostprocessRenderer(packet);
	const surfacePolicy =
		payload.surfacePolicy ||
		packet.sceneColorPolicy ||
		'captured-rgba8-display-domain';
	const composeSceneColor = surfacePolicy !== 'spectrum-id-reference-radiance';
	const includeSecondOrder =
		packet.source.kind === 'distant-directional-sun'
			? payload.includeSecondOrder !== false
			: false;
	const expectedSelectedPixels = Array.isArray(payload.expectedSelectedPixels)
		? payload.expectedSelectedPixels
		: [];
	let shaderResult;

	try {
		if (packet.source.kind === 'distant-directional-sun') {
			shaderResult = renderSoftShaderAtmospherePostprocess({
				renderer,
				camera,
				packet,
				includeSecondOrder,
			});
		} else if (packet.source.kind === 'flat-local-point-sun') {
			shaderResult = renderFlatLocalSoftShaderPostprocess({
				renderer,
				packet,
				composeSceneColor,
				surfacePolicy,
			});
		} else {
			throw new Error(`Unsupported source kind: ${packet.source.kind}`);
		}
	} finally {
		renderer.dispose();
	}

const selectedChecks = scenePacketSoftShaderSelectedChecks({
		packet,
		expectedSelectedPixels,
		shaderRgba8: shaderResult.readbackRgba8,
	});
	const maxSelectedRgbDelta = Math.max(
		0,
		...selectedChecks.map((item) => item.maxAbsRgbDelta ?? 0)
	);
	const diagnostics = scenePacketSoftShaderImageDiagnostics({
		command,
		packet,
		shaderResult,
		selectedChecks,
		maxSelectedRgbDelta,
		surfacePolicy,
		composeSceneColor,
		includeSecondOrder,
	});
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-scene-packet-soft-shader-image-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: { width: packet.width, height: packet.height },
		imageDataUrl: canvas.toDataURL('image/png'),
		shaderReadbackRgba8: Array.from(shaderResult.readbackRgba8),
		selectedPixels: selectedChecks.map((check) => ({
			id: check.id,
			x: check.x,
			y: check.y,
			shaderRgba: check.shaderRgba,
			expectedRgba: check.expectedRgba,
			maxAbsRgbDelta: check.maxAbsRgbDelta,
		})),
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

async function runBrowserShaderBenchmark(command, startedAt) {
	const config = shaderBenchmarkConfig(command?.payload || {});
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createBaselineScene(canvas, {
		width: config.width,
		height: config.height,
	});
	const { renderer, scene, camera, meshes, cards, ground } = sceneSetup;
	const sceneInputRenderTarget = config.useDirectGpuSceneInput
		? buildGpuSceneInputRenderTarget({
				renderer,
				scene,
				camera,
				meshes,
			})
		: null;
	const pass = setupFirstOrderImageShaderPass({
		renderer,
		camera,
		sceneMode: config.sceneMode,
		sunRay: sunDirection(config.sunCase),
		includeSecondOrder: config.includeSecondOrder,
		sceneInputTextureHandle: sceneInputRenderTarget?.textureHandle || null,
		sceneInputTextureMetadata: sceneInputRenderTarget?.metadata || null,
	});

	try {
		const benchmark = await benchmarkShaderPass({
			gl: pass.gl,
			draw: pass.draw,
			warmupFrames: config.warmupFrames,
			measuredFrames: config.measuredFrames,
			drawsPerSample: config.drawsPerSample,
			sampleDelayMs: config.sampleDelayMs,
			queryPollTimeoutMs: config.queryPollTimeoutMs,
			includeFinishFallback: config.includeFinishFallback,
		});
		pass.draw();

		const diagnostics = shaderBenchmarkDiagnostics({
			command,
			canvas,
			renderer,
			camera,
			cards,
			ground,
			config,
			imageShaderDiagnostics: pass.diagnostics,
			benchmark,
		});
		const completedAt = performance.now();

		return {
			kind: 'algorithm32-browser-shader-benchmark-result',
			status: diagnostics.status,
			commandId: command?.id,
			commandLabel: command?.label,
			pageLoadCount: loadCount,
			timestamp: new Date().toISOString(),
			location: window.location.href,
			userAgent: navigator.userAgent,
			devicePixelRatio: window.devicePixelRatio,
			viewport: {
				width: window.innerWidth,
				height: window.innerHeight,
			},
			canvas: {
				width: canvas.width,
				height: canvas.height,
			},
			imageDataUrl: config.captureImage ? canvas.toDataURL('image/png') : null,
			imageShaderDiagnostics: pass.diagnostics,
			benchmark,
			diagnostics,
			timings: {
				pageDurationMs: completedAt - startedAt,
			},
		};
	} finally {
		pass.dispose();
		if (sceneInputRenderTarget) {
			sceneInputRenderTarget.dispose();
		}
		renderer.dispose();
		for (const mesh of meshes) {
			mesh.geometry.dispose();
			mesh.material.dispose();
		}
	}
}

function shaderBenchmarkConfig(payload) {
	const width = positiveInteger(payload.width, 240);
	const height = positiveInteger(payload.height, 120);
	const warmupFrames = positiveInteger(payload.warmupFrames, 3);
	const measuredFrames = positiveInteger(payload.measuredFrames, 10);

	return {
		width,
		height,
		warmupFrames,
		measuredFrames,
		drawsPerSample: positiveInteger(payload.drawsPerSample, 3),
		sampleDelayMs: nonnegativeNumber(payload.sampleDelayMs, 16),
		queryPollTimeoutMs: positiveInteger(payload.queryPollTimeoutMs, 5000),
		includeSecondOrder: payload.includeSecondOrder !== false,
		includeFinishFallback: payload.includeFinishFallback === true,
		useDirectGpuSceneInput: payload.useDirectGpuSceneInput !== false,
		sceneMode: payload.sceneMode || 'simple-cards',
		sunCase: payload.sunCase || DIRECT_RADIANCE_SUN_CASE,
		captureImage: payload.captureImage === true,
	};
}

function positiveInteger(value, fallback) {
	const number = Number(value);

	return Number.isInteger(number) && number > 0 ? number : fallback;
}

function nonnegativeNumber(value, fallback) {
	const number = Number(value);

	return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function shaderBenchmarkDiagnostics({
	command,
	canvas,
	renderer,
	camera,
	cards,
	ground,
	config,
	imageShaderDiagnostics,
	benchmark,
}) {
	return {
		kind: 'browser-shader-benchmark-diagnostics',
		status: 'accepted',
		iteration: command?.payload?.iteration || 'shader-performance-benchmark',
		goal: command?.payload?.goal ||
			'Measure the experimental Algorithm32 atmosphere image shader pass without CPU reference image generation.',
		commandPayload: command?.payload || null,
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		camera: cameraToDiagnostics(camera),
		ground,
		cards,
		config,
		threeRevision: THREE.REVISION,
		webgl: {
			version: imageShaderDiagnostics.webglVersion,
			shadingLanguageVersion:
				imageShaderDiagnostics.shadingLanguageVersion,
			renderer: renderer.getContext().getParameter(
				renderer.getContext().RENDERER
			),
			vendor: renderer.getContext().getParameter(
				renderer.getContext().VENDOR
			),
		},
		imageShaderDiagnostics,
		benchmark,
		notes: [
			'Benchmark draws reuse one already-created full-screen atmosphere pass.',
			'CPU reference comparisons, screenshots, toDataURL, and readPixels are outside the measured draw loop.',
			'GPU timer-query samples are used only when EXT_disjoint_timer_query_webgl2 is available and not disjoint.',
			'The finish fallback is a comparative approximation because gl.finish() synchronizes the full command queue.',
		],
	};
}

async function benchmarkShaderPass({
	gl,
	draw,
	warmupFrames,
	measuredFrames,
	drawsPerSample,
	sampleDelayMs,
	queryPollTimeoutMs,
	includeFinishFallback,
}) {
	const timerQueryExtension =
		gl.getExtension('EXT_disjoint_timer_query_webgl2');
	const cpuIssueBatchSamplesMs = [];
	const queries = [];

	for (let index = 0; index < warmupFrames; index += 1) {
		for (let drawIndex = 0; drawIndex < drawsPerSample; drawIndex += 1) {
			draw();
		}
		if (sampleDelayMs > 0) {
			await pageDelay(sampleDelayMs);
		}
	}
	gl.finish();

	for (let index = 0; index < measuredFrames; index += 1) {
		const query = timerQueryExtension ? gl.createQuery() : null;
		const cpuStartedAt = performance.now();

		if (query) {
			gl.beginQuery(timerQueryExtension.TIME_ELAPSED_EXT, query);
		}
		for (let drawIndex = 0; drawIndex < drawsPerSample; drawIndex += 1) {
			draw();
		}
		if (query) {
			gl.endQuery(timerQueryExtension.TIME_ELAPSED_EXT);
			queries.push(query);
		}

		cpuIssueBatchSamplesMs.push(performance.now() - cpuStartedAt);
		if (sampleDelayMs > 0) {
			await pageDelay(sampleDelayMs);
		}
	}
	gl.flush();

	const gpuTimerQuery = timerQueryExtension
		? await collectGpuTimerQueryResults({
				gl,
				extension: timerQueryExtension,
				queries,
				drawsPerSample,
				timeoutMs: queryPollTimeoutMs,
			})
		: {
				available: false,
				extension: 'EXT_disjoint_timer_query_webgl2',
				reason: 'Extension unavailable in this browser/WebGL backend.',
				validSamples: 0,
				disjointSamples: 0,
				timeout: false,
				batchSamplesMs: [],
				batchSummaryMs: null,
				perDrawSummaryMs: null,
			};
	const finishFallback = includeFinishFallback
		? await measureFinishFallback({
				gl,
				draw,
				measuredFrames,
				drawsPerSample,
				sampleDelayMs,
			})
		: null;
	const cpuIssueBatchMs = summarizeNumericSamples(cpuIssueBatchSamplesMs);
	const cpuIssuePerDrawMs = summarizeNumericSamples(
		cpuIssueBatchSamplesMs.map((sample) => sample / drawsPerSample)
	);

	return {
		kind: 'webgl-fullscreen-pass-benchmark',
		warmupFrames,
		measuredFrames,
		drawsPerSample,
		sampleDelayMs,
		totalMeasuredDraws: measuredFrames * drawsPerSample,
		timerQueryAvailable: Boolean(timerQueryExtension),
		cpuIssueBatchMs,
		cpuIssuePerDrawMs,
		gpuTimerQuery,
		finishFallback,
		measurementPolicy: {
			timedPass:
				'batches of repeated full-screen Algorithm32 atmosphere shader draws with existing program, uniforms, buffers, and textures',
			excluded:
				'scene setup, shader compile/link, second-order cache build, scene-input render target creation, CPU reference generation, screenshots, readPixels, and JSON serialization',
		},
	};
}

async function collectGpuTimerQueryResults({
	gl,
	extension,
	queries,
	drawsPerSample,
	timeoutMs,
}) {
	const startedAt = performance.now();
	const pending = new Set(queries);
	const samplesMs = [];
	let disjointSamples = 0;
	let timedOut = false;

	while (pending.size > 0) {
		const disjoint = gl.getParameter(extension.GPU_DISJOINT_EXT);

		for (const query of [...pending]) {
			const available = gl.getQueryParameter(
				query,
				gl.QUERY_RESULT_AVAILABLE
			);

			if (!available) {
				continue;
			}

			if (disjoint) {
				disjointSamples += 1;
			} else {
				const elapsedNanoseconds = gl.getQueryParameter(
					query,
					gl.QUERY_RESULT
				);
				samplesMs.push(elapsedNanoseconds / 1000000);
			}

			gl.deleteQuery(query);
			pending.delete(query);
		}

		if (pending.size === 0) {
			break;
		}
		if (performance.now() - startedAt > timeoutMs) {
			timedOut = true;
			break;
		}

		await pageDelay(10);
	}

	for (const query of pending) {
		gl.deleteQuery(query);
	}

	return {
		available: true,
		extension: 'EXT_disjoint_timer_query_webgl2',
		validSamples: samplesMs.length,
		disjointSamples,
		timeout: timedOut,
		pendingSamplesAfterTimeout: pending.size,
		batchSamplesMs: samplesMs,
		batchSummaryMs: summarizeNumericSamples(samplesMs),
		perDrawSummaryMs: summarizeNumericSamples(
			samplesMs.map((sample) => sample / drawsPerSample)
		),
	};
}

async function measureFinishFallback({
	gl,
	draw,
	measuredFrames,
	drawsPerSample,
	sampleDelayMs,
}) {
	const batchSamplesMs = [];
	const totalDraws = measuredFrames * drawsPerSample;

	for (let index = 0; index < measuredFrames; index += 1) {
		const startedAt = performance.now();
		for (let drawIndex = 0; drawIndex < drawsPerSample; drawIndex += 1) {
			draw();
		}
		gl.finish();
		batchSamplesMs.push(performance.now() - startedAt);
		if (sampleDelayMs > 0) {
			await pageDelay(sampleDelayMs);
		}
	}

	const totalMs = batchSamplesMs.reduce((sum, sample) => sum + sample, 0);

	return {
		kind: 'gl-finish-batch-approximation',
		totalMs,
		perDrawMs: totalMs / totalDraws,
		batchSummaryMs: summarizeNumericSamples(batchSamplesMs),
		perDrawSummaryMs: summarizeNumericSamples(
			batchSamplesMs.map((sample) => sample / drawsPerSample)
		),
		measuredSamples: measuredFrames,
		drawsPerSample,
		totalDraws,
		note:
			'Comparative fallback only; gl.finish() synchronizes the full queue and is not an isolated GPU timer.',
	};
}

function summarizeNumericSamples(samples) {
	if (!samples.length) {
		return null;
	}

	const sorted = [...samples].sort((a, b) => a - b);
	const sum = sorted.reduce((total, value) => total + value, 0);

	return {
		count: sorted.length,
		min: sorted[0],
		median: percentileSorted(sorted, 0.5),
		mean: sum / sorted.length,
		p90: percentileSorted(sorted, 0.9),
		p95: percentileSorted(sorted, 0.95),
		max: sorted[sorted.length - 1],
	};
}

function percentileSorted(sorted, percentile) {
	if (sorted.length === 1) {
		return sorted[0];
	}

	const index = (sorted.length - 1) * percentile;
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	const ratio = index - lower;

	return sorted[lower] * (1 - ratio) + sorted[upper] * ratio;
}

function pageDelay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function runBrowserMountainShaderImage(command, startedAt) {
	const canvas = document.getElementById('lab-canvas');
	const sceneSetup = createMountainShaderScene(canvas, {
		width: command?.payload?.width || 240,
		height: command?.payload?.height || 135,
		mountainView: command?.payload?.mountainView || MOUNTAIN_VIEW_MODES.frontHighSun,
	});
	const { renderer, camera, mountainView, sunCase, sceneObjects, ground } = sceneSetup;
	const includeSecondOrder = command?.payload?.includeSecondOrder === true;
	const imageShaderDiagnostics = renderFirstOrderImageShader({
		renderer,
		camera,
		sceneMode: 'mountain-ridges',
		sunRay: sunDirection(sunCase),
		includeSecondOrder,
	});
	const selectedPixels = sampleMountainShaderPixels({
		canvas,
		renderer,
		camera,
	});
	const diagnostics = mountainShaderImageDiagnostics({
		command,
		canvas,
		renderer,
		camera,
		mountainView,
		sunCase,
		sceneObjects,
		ground,
		selectedPixels,
		imageShaderDiagnostics,
	});
	const completedAt = performance.now();

	renderer.dispose();

	return {
		kind: 'algorithm32-browser-mountain-shader-image-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels,
		imageShaderDiagnostics,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserMountainLitSceneInputCapture(command, startedAt) {
	const payload = command?.payload || {};
	const canvas = document.getElementById('lab-canvas');
	const sourcePacket = resolveMountainLitSourcePacket(payload);
	const geometryPacket = payload.geometryPacket || null;
	const sceneSetup = createMountainLitScene(canvas, {
		width: payload.width || 320,
		height: payload.height || 180,
		mountainView: payload.mountainView || MOUNTAIN_VIEW_MODES.frontHighSun,
		cameraViewMode: payload.cameraViewMode || null,
		sourcePacket,
		sceneDetailSpec: payload.sceneDetailSpec || null,
	});
	const { renderer, scene, camera } = sceneSetup;
	let imageDataUrl = null;
	let capture = null;

	try {
		renderer.render(scene, camera);
		imageDataUrl = canvas.toDataURL('image/png');
		capture = captureSceneInputPacket({
			captureId: payload.captureId || 'mountain-lit-scene',
			sceneMode: 'mountain-ridges-lit',
			sceneColorPolicy:
				'Three MeshStandardMaterial mountain scene with a white source-position light; CPU Algorithm32 postprocess owns atmospheric color.',
			canvas,
			renderer,
			camera,
			meshes: sceneSetup.meshes,
			sceneObjects: sceneSetup.sceneObjects,
			ground: sceneSetup.ground,
			sourcePacket,
			sceneLightPacket: sceneSetup.sceneLightPacket,
			geometryPacket,
			sceneDetailPacket: sceneSetup.sceneDetailPacket,
		});
	} finally {
		disposeSceneSetup(sceneSetup);
	}

	const diagnostics = mountainLitSceneInputDiagnostics({
		command,
		capture,
		sceneLightPacket: sceneSetup.sceneLightPacket,
	});
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-mountain-lit-scene-input-capture-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl,
		selectedPixels: capture.selectedPixels,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserThreeNativeAtmospherePass(command, startedAt) {
	const payload = command?.payload || {};
	const milestone = positiveInteger(payload.milestone, 30);
	const passMode =
		payload.passMode || (milestone >= 31 ? 'depth-distance' : 'identity');
	const defaultSourcePacket = resolveMountainLitSourcePacket(payload);
	const geometryPacket =
		payload.geometryPacket ||
		(passMode === 'flat-local-first-order-atmosphere'
			? makeFlatAtmosphereGeometryPacket()
			: makeSphericalAtmosphereGeometryPacket());
	const cases =
		Array.isArray(payload.cases) && payload.cases.length > 0
			? payload.cases
			: defaultThreeNativePassCases({ passMode });
	const results = cases.map((caseConfig) =>
		runThreeNativeAtmospherePassCase({
			command,
			payload,
			caseConfig,
			passMode,
			sourcePacket: resolveThreeNativeCaseSourcePacket({
				payload,
				caseConfig,
				defaultSourcePacket,
			}),
			geometryPacket,
		})
	);
	const criteria = threeNativeAtmospherePassCriteria({
		passMode,
		results,
	});
	const summary = summarizeCriteria(criteria);
	const completedAt = performance.now();
	const lastResult = results[results.length - 1] || null;

	return {
		kind: 'algorithm32-browser-three-native-atmosphere-pass-result',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: lastResult?.canvas || null,
		imageDataUrl: lastResult?.imageDataUrl || null,
		selectedPixels: lastResult?.selectedPixels || [],
		passMode,
		milestone,
		results,
		diagnostics: {
			kind: 'browser-three-native-atmosphere-pass-diagnostics',
			status: summary.failed === 0 ? 'accepted' : 'rejected',
			iteration:
				command?.payload?.iteration ||
				(passMode === 'identity'
					? '30-three-native-atmosphere-pass-shell'
					: '31-depth-to-ray-distance-contract'),
			goal:
				passMode === 'identity'
					? 'Render a live Three scene into a Three-owned color/depth target and pass scene color through Algorithm32AtmospherePass without atmosphere physics.'
					: 'Use the Three-owned depth texture in Algorithm32AtmospherePass to reconstruct selected pixel hit distance and sky/hit classification.',
			threeRevision: THREE.REVISION,
			passContract: {
				kind: 'Algorithm32AtmospherePass',
				normalInputPath:
					'live Three scene render -> WebGLRenderTarget color texture + DepthTexture -> Three ShaderMaterial fullscreen pass',
				jsonPackets:
					'Raycaster scene packets are validation oracles only and are not sampled by the live pass.',
				passMode,
			},
			defaultSourcePacket,
			caseSourcePackets: results.map((result) => ({
				id: result.id,
				sourcePacket: result.sourcePacket,
			})),
			geometryPacket,
			criteria,
			summary,
		},
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

async function runBrowserThreeNativeLiveAtmospherePass(command, startedAt) {
	const payload = command?.payload || {};
	const canvas = document.getElementById('lab-canvas');
	const sourcePacket = resolveMountainLitSourcePacket(payload);
	const geometryPacket =
		payload.geometryPacket || makeSphericalAtmosphereGeometryPacket();
	const sceneSetup = createMountainLitScene(canvas, {
		width: positiveInteger(payload.width, 320),
		height: positiveInteger(payload.height, 180),
		mountainView: payload.mountainView || MOUNTAIN_VIEW_MODES.frontHighSun,
		cameraViewMode: payload.cameraViewMode || null,
		sourcePacket,
		sceneDetailSpec: payload.sceneDetailSpec || null,
	});
	const { renderer, scene, camera } = sceneSetup;
	const controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = false;
	controls.target.set(0, 620, -30000);
	controls.update();
	applyThreeNativeDepthCameraPolicy({
		camera,
		passMode: 'distant-first-order-atmosphere',
		payload,
	});
	const pass = new Algorithm32AtmospherePass({
		renderer,
		width: canvas.width,
		height: canvas.height,
		camera,
		config: {
			source: sourcePacket,
			geometry: geometryPacket,
			atmosphere: { kind: 'algorithm32-earth-poc' },
			display: { mode: 'first-order-distant-atmosphere' },
		},
		mode: 'distant-first-order-atmosphere',
		maxDistanceMeters: finitePositiveNumber(
			payload.depthDebugMaxDistanceMeters,
			camera.far
		),
	});
	const frames = [];
	const gl = renderer.getContext();

	try {
		frames.push(
			await renderThreeNativeLiveAtmosphereFrame({
				id: 'initial',
				renderer,
				scene,
				camera,
				controls,
				pass,
				canvas,
			})
		);
		camera.position.x += 4200;
		camera.position.y += 650;
		controls.target.set(2500, 900, -30000);
		controls.update();
		frames.push(
			await renderThreeNativeLiveAtmosphereFrame({
				id: 'orbit-controls-moved',
				renderer,
				scene,
				camera,
				controls,
				pass,
				canvas,
			})
		);
		camera.fov = Math.min(camera.fov + 12, 74);
		camera.updateProjectionMatrix();
		controls.update();
		frames.push(
			await renderThreeNativeLiveAtmosphereFrame({
				id: 'wide-fov',
				renderer,
				scene,
				camera,
				controls,
				pass,
				canvas,
			})
		);
	} finally {
		pass.dispose();
		controls.dispose();
		disposeSceneSetup(sceneSetup);
	}

	const frameDeltas = [];
	for (let index = 1; index < frames.length; index += 1) {
		frameDeltas.push({
			from: frames[index - 1].id,
			to: frames[index].id,
			maxAbsDelta: maxAbsByteDelta(
				new Uint8Array(frames[index - 1].rgba8),
				new Uint8Array(frames[index].rgba8)
			),
		});
	}
	const webglError = gl.getError();
	const criteria = [
		{
			id: 'orbit-controls-created',
			status: controls.object === camera ? 'passed' : 'failed',
			measured: {
				controlsType: 'OrbitControls',
				enableDamping: controls.enableDamping,
			},
		},
		{
			id: 'continuous-frames-rendered',
			status: frames.length >= 3 ? 'passed' : 'failed',
			measured: frames.map((frame) => ({
				id: frame.id,
				camera: frame.camera,
				outputSummary: frame.outputSummary,
			})),
		},
		{
			id: 'camera-and-fov-changed',
			status:
				maxAbsArrayDelta(
					frames[0].camera.positionMeters,
					frames[1].camera.positionMeters
				) > 0 &&
				frames[2].camera.verticalFovDegrees !==
					frames[0].camera.verticalFovDegrees
					? 'passed'
					: 'failed',
			measured: frames.map((frame) => ({
				id: frame.id,
				camera: frame.camera,
			})),
		},
		{
			id: 'output-responded-to-camera-movement',
			status: frameDeltas.every((delta) => delta.maxAbsDelta > 0)
				? 'passed'
				: 'failed',
			measured: frameDeltas,
		},
		{
			id: 'webgl-error-free-after-live-loop',
			status: webglError === gl.NO_ERROR ? 'passed' : 'failed',
			measured: {
				error: webglError,
				noErrorConstant: gl.NO_ERROR,
			},
		},
	];
	const summary = summarizeCriteria(criteria);
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-three-native-live-atmosphere-pass-result',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: frames[frames.length - 1]?.imageDataUrl || null,
		selectedPixels: [],
		frames,
		frameDeltas,
		diagnostics: {
			kind: 'browser-three-native-live-atmosphere-pass-diagnostics',
			status: summary.failed === 0 ? 'accepted' : 'rejected',
			iteration:
				command?.payload?.iteration ||
				'33-live-scene-and-camera-controls',
			goal:
				'Run Algorithm32AtmospherePass in a live Three render loop with OrbitControls and changing camera/FOV uniforms.',
			threeRevision: THREE.REVISION,
			passContract: {
				normalInputPath:
					'live Three scene render -> color/depth render target -> Algorithm32AtmospherePass',
				controls: 'OrbitControls',
				sourcePacket,
				geometryPacket,
			},
			criteria,
			summary,
		},
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserThreeNativeUnifiedAdapterSwitch(command, startedAt) {
	const payload = command?.payload || {};
	const canvas = document.getElementById('lab-canvas');
	const distantSource = makeDistantSunSourcePacket(DIRECT_RADIANCE_SUN_CASE);
	const distantGeometry = makeSphericalAtmosphereGeometryPacket();
	const localSource = makeFlatLocalSunSourcePacket(0);
	const localGeometry = makeFlatAtmosphereGeometryPacket();
	const sceneSetup = createMountainLitScene(canvas, {
		width: positiveInteger(payload.width, 320),
		height: positiveInteger(payload.height, 180),
		mountainView: MOUNTAIN_VIEW_MODES.frontHighSun,
		sourcePacket: distantSource,
	});
	const { renderer, scene, camera } = sceneSetup;
	const pass = new Algorithm32AtmospherePass({
		renderer,
		width: canvas.width,
		height: canvas.height,
		camera,
		config: {
			source: distantSource,
			geometry: distantGeometry,
			atmosphere: { kind: 'algorithm32-earth-poc' },
			display: { mode: 'first-order-distant-atmosphere' },
		},
		mode: 'distant-first-order-atmosphere',
		maxDistanceMeters: finitePositiveNumber(
			payload.depthDebugMaxDistanceMeters,
			camera.far
		),
	});
	const gl = renderer.getContext();
	let distantFrame;
	let localFrame;
	let localSceneLightPacket;

	try {
		applyThreeNativeDepthCameraPolicy({
			camera,
			passMode: 'distant-first-order-atmosphere',
			payload,
		});
		distantFrame = renderThreeNativeAdapterSwitchFrame({
			id: 'distant-spherical',
			renderer,
			scene,
			camera,
			pass,
			canvas,
			source: distantSource,
			geometry: distantGeometry,
			mode: 'distant-first-order-atmosphere',
			sceneLightPacket: sceneSetup.sceneLightPacket,
		});

		localSceneLightPacket = replaceMountainSourceLight({
			scene,
			sourcePacket: localSource,
			targetMeters: sceneSetup.mountainView.lookAtMeters,
		});
		pass.mode = 'flat-local-first-order-atmosphere';
		pass.setConfig({
			source: localSource,
			geometry: localGeometry,
			atmosphere: { kind: 'algorithm32-earth-poc' },
			display: { mode: 'first-order-flat-local-atmosphere' },
		});
		localFrame = renderThreeNativeAdapterSwitchFrame({
			id: 'local-flat',
			renderer,
			scene,
			camera,
			pass,
			canvas,
			source: localSource,
			geometry: localGeometry,
			mode: 'flat-local-first-order-atmosphere',
			sceneLightPacket: localSceneLightPacket,
		});
	} finally {
		pass.dispose();
		disposeSceneSetup(sceneSetup);
	}

	const webglError = gl.getError();
	const frames = [distantFrame, localFrame];
	const criteria = [
		{
			id: 'same-renderer-and-pass-instance',
			status:
				distantFrame.passInstanceId === localFrame.passInstanceId &&
				distantFrame.rendererContext === localFrame.rendererContext
					? 'passed'
					: 'failed',
			measured: frames.map((frame) => ({
				id: frame.id,
				passInstanceId: frame.passInstanceId,
				rendererContext: frame.rendererContext,
			})),
		},
		{
			id: 'source-family-switched',
			status:
				distantFrame.source.kind === 'distant-directional-sun' &&
				localFrame.source.kind === 'flat-local-point-sun'
					? 'passed'
					: 'failed',
			measured: frames.map((frame) => ({
				id: frame.id,
				source: frame.source,
			})),
		},
		{
			id: 'geometry-family-switched',
			status:
				distantFrame.geometry.kind === 'spherical-atmosphere-geometry' &&
				localFrame.geometry.kind === 'flat-z-up-atmosphere'
					? 'passed'
					: 'failed',
			measured: frames.map((frame) => ({
				id: frame.id,
				geometry: frame.geometry,
			})),
		},
		{
			id: 'three-light-adapter-switched',
			status:
				distantFrame.sceneLight.mode === 'distant-directional-sun' &&
				localFrame.sceneLight.mode === 'flat-local-point-sun'
					? 'passed'
					: 'failed',
			measured: frames.map((frame) => ({
				id: frame.id,
				sceneLight: frame.sceneLight,
			})),
		},
		{
			id: 'output-changed-after-source-geometry-switch',
			status:
				maxAbsByteDelta(
					new Uint8Array(distantFrame.rgba8),
					new Uint8Array(localFrame.rgba8)
				) > 0
					? 'passed'
					: 'failed',
			measured: {
				maxAbsDelta: maxAbsByteDelta(
					new Uint8Array(distantFrame.rgba8),
					new Uint8Array(localFrame.rgba8)
				),
			},
		},
		{
			id: 'webgl-error-free-after-adapter-switch',
			status: webglError === gl.NO_ERROR ? 'passed' : 'failed',
			measured: {
				error: webglError,
				noErrorConstant: gl.NO_ERROR,
			},
		},
	];
	const summary = summarizeCriteria(criteria);
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-three-native-unified-adapter-switch-result',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: localFrame.imageDataUrl,
		selectedPixels: [],
		frames,
		diagnostics: {
			kind: 'browser-three-native-unified-adapter-switch-diagnostics',
			status: summary.failed === 0 ? 'accepted' : 'rejected',
			iteration:
				command?.payload?.iteration ||
				'35-unified-source-and-geometry-adapter',
			goal:
				'Switch one Algorithm32AtmospherePass instance between distant/spherical and flat/local source+geometry adapters.',
			criteria,
			summary,
		},
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

async function runBrowserThreeNativeLivePassSoftShaderMatrix(command, startedAt) {
	const payload = command?.payload || {};
	const cases = [
		{
			id: 'distant-midday',
			passMode: 'distant-first-order-atmosphere',
			sourcePacket: makeDistantSunSourcePacket(DIRECT_RADIANCE_SUN_CASE),
			geometryPacket: makeSphericalAtmosphereGeometryPacket(),
			caseConfig: {
				id: 'distant-midday',
				width: 320,
				height: 180,
				cameraAdjustment: 'none',
			},
		},
		{
			id: 'distant-sunset-behind-camera',
			passMode: 'distant-first-order-atmosphere',
			sourcePacket: makeDistantSunSourcePacket(LOW_SUN_CASE),
			geometryPacket: makeSphericalAtmosphereGeometryPacket(),
			caseConfig: {
				id: 'distant-sunset-behind-camera',
				width: 320,
				height: 180,
				cameraViewMode: 'source-behind-camera',
				cameraAdjustment: 'none',
			},
		},
		{
			id: 'local-closest',
			passMode: 'flat-local-first-order-atmosphere',
			sourcePacket: makeFlatLocalSunSourcePacket(0),
			geometryPacket: makeFlatAtmosphereGeometryPacket(),
			caseConfig: {
				id: 'local-closest',
				width: 320,
				height: 180,
				cameraAdjustment: 'none',
			},
		},
		{
			id: 'local-090deg',
			passMode: 'flat-local-first-order-atmosphere',
			sourcePacket: makeFlatLocalSunSourcePacket(90),
			geometryPacket: makeFlatAtmosphereGeometryPacket(),
			caseConfig: {
				id: 'local-090deg',
				width: 320,
				height: 180,
				cameraAdjustment: 'none',
			},
		},
	];
	const results = cases.map((matrixCase) =>
		runThreeNativeAtmospherePassCase({
			command,
			payload,
			caseConfig: matrixCase.caseConfig,
			passMode: matrixCase.passMode,
			sourcePacket: matrixCase.sourcePacket,
			geometryPacket: matrixCase.geometryPacket,
		})
	);
	const canvas = document.getElementById('lab-canvas');
	const contactSheet = await drawLivePassSoftShaderContactSheet({
		results,
	});
	const maxGatingDelta = Math.max(
		0,
		...results.flatMap((result) =>
			(result.atmosphereParity?.selectedChecks || [])
				.filter((check) => check.acceptanceRole === 'gating')
				.map((check) => check.maxAbsRgbDelta)
		)
	);
	const criteria = [
		{
			id: 'four-required-cases-rendered',
			status:
				results.map((result) => result.id).join(',') ===
				'distant-midday,distant-sunset-behind-camera,local-closest,local-090deg'
					? 'passed'
					: 'failed',
			measured: results.map((result) => ({
				id: result.id,
				sourceKind: result.sourcePacket?.kind,
				geometryKind:
					result.sourcePacket?.kind === 'flat-local-point-sun'
						? 'flat-z-up-atmosphere'
						: 'spherical-atmosphere-geometry',
			})),
		},
		{
			id: 'live-and-oracle-images-recorded',
			status:
				results.every(
					(result) =>
						result.imageDataUrl &&
						result.atmosphereParity?.oracleImageDataUrl
				)
					? 'passed'
					: 'failed',
			measured: results.map((result) => ({
				id: result.id,
				hasLiveImage: Boolean(result.imageDataUrl),
				hasOracleImage: Boolean(
					result.atmosphereParity?.oracleImageDataUrl
				),
				imageDeltaSummary:
					result.atmosphereParity?.imageDeltaSummary || null,
			})),
		},
		{
			id: 'selected-gating-parity',
			status: maxGatingDelta <= 3 ? 'passed' : 'failed',
			measured: {
				maxGatingDelta,
				selectedChecks: results.map((result) => ({
					id: result.id,
					selectedChecks:
						result.atmosphereParity?.selectedChecks || [],
				})),
			},
		},
		{
			id: 'side-by-side-contact-sheet-created',
			status: contactSheet.dataUrl ? 'passed' : 'failed',
			measured: {
				canvas: {
					width: contactSheet.width,
					height: contactSheet.height,
				},
				columns: ['live-pass', 'soft-shader-oracle'],
			},
		},
	];
	const summary = summarizeCriteria(criteria);
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-three-native-live-pass-soft-shader-matrix-result',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: contactSheet.width,
			height: contactSheet.height,
		},
		imageDataUrl: contactSheet.dataUrl,
		selectedPixels: [],
		results,
		diagnostics: {
			kind: 'browser-three-native-live-pass-soft-shader-matrix-diagnostics',
			status: summary.failed === 0 ? 'accepted' : 'rejected',
			iteration:
				command?.payload?.iteration ||
				'36-live-pass-vs-soft-shader-matrix',
			goal:
				'Compare the live Three-native atmosphere pass against the CPU/GPU soft-shader oracle for distant and local source families.',
			criteria,
			summary,
		},
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function runBrowserThreeNativeScenarioControlsPoc(command, startedAt) {
	const payload = command?.payload || {};
	const scenarios = threeNativeScenarioControlDefinitions();
	const debugViews = [
		'scene-color',
		'depth',
		'transmittance',
		'path-radiance',
		'final',
	];
	const controls = createThreeNativeScenarioControls({
		scenarios,
		debugViews,
	});
	const canvas = document.getElementById('lab-canvas');
	const initial = scenarios[0];
	const sceneSetup = createMountainLitScene(canvas, {
		width: positiveInteger(payload.width, 320),
		height: positiveInteger(payload.height, 180),
		sourcePacket: initial.source,
		cameraViewMode: initial.cameraViewMode || null,
	});
	const { renderer, scene, camera } = sceneSetup;
	const pass = new Algorithm32AtmospherePass({
		renderer,
		width: canvas.width,
		height: canvas.height,
		camera,
		config: {
			source: initial.source,
			geometry: initial.geometry,
			atmosphere: { kind: 'algorithm32-earth-poc' },
			display: { debugView: 'final' },
		},
		mode: initial.passMode,
		maxDistanceMeters: finitePositiveNumber(
			payload.depthDebugMaxDistanceMeters,
			camera.far
		),
	});
	const renders = [];
	let sceneLightPacket = sceneSetup.sceneLightPacket;

	try {
		for (const scenario of scenarios) {
			controls.scenario.value = scenario.id;
			sceneLightPacket = replaceMountainSourceLight({
				scene,
				sourcePacket: scenario.source,
				targetMeters: sceneSetup.mountainView.lookAtMeters,
			});
			pass.mode = scenario.passMode;
			pass.setConfig({
				source: scenario.source,
				geometry: scenario.geometry,
				atmosphere: { kind: 'algorithm32-earth-poc' },
				display: { debugView: 'final' },
			});
			for (const debugView of debugViews) {
				controls.debugView.value = debugView;
				const modeForDebug =
					debugView === 'scene-color'
						? 'identity'
						: debugView === 'depth'
							? 'depth-distance'
							: scenario.passMode;
				pass.mode = modeForDebug;
				pass.setConfig({
					source: scenario.source,
					geometry: scenario.geometry,
					atmosphere: { kind: 'algorithm32-earth-poc' },
					display: {
						debugView:
							debugView === 'transmittance' ||
							debugView === 'path-radiance'
								? debugView
								: 'final',
					},
				});
				pass.renderScene(scene, camera);
				pass.render({ camera });
				const rgba8 = readCanvasRgbaTopLeft(
					renderer,
					canvas.width,
					canvas.height
				);
				renders.push({
					scenarioId: scenario.id,
					debugView,
					passMode: modeForDebug,
					sourceKind: scenario.source.kind,
					geometryKind: scenario.geometry.kind,
					sceneLightMode: sceneLightPacket.mode,
					outputSummary: summarizeRgba8(rgba8),
				});
			}
		}
	} finally {
		pass.dispose();
		disposeSceneSetup(sceneSetup);
	}

	const scenarioIds = scenarios.map((scenario) => scenario.id);
	const criteria = [
		{
			id: 'scenario-and-debug-controls-created',
			status:
				controls.scenario.options.length === scenarios.length &&
				controls.debugView.options.length === debugViews.length
					? 'passed'
					: 'failed',
			measured: {
				scenarios: Array.from(controls.scenario.options).map(
					(option) => option.value
				),
				debugViews: Array.from(controls.debugView.options).map(
					(option) => option.value
				),
			},
		},
		{
			id: 'all-required-scenarios-rendered',
			status: scenarioIds.every((id) =>
				renders.some((render) => render.scenarioId === id)
			)
				? 'passed'
				: 'failed',
			measured: scenarioIds,
		},
		{
			id: 'all-debug-views-rendered',
			status: debugViews.every((debugView) =>
				scenarioIds.every((scenarioId) =>
					renders.some(
						(render) =>
							render.scenarioId === scenarioId &&
							render.debugView === debugView
					)
				)
			)
				? 'passed'
				: 'failed',
			measured: debugViews,
		},
		{
			id: 'source-updates-light-and-pass-together',
			status:
				renders
					.filter((render) => render.debugView === 'final')
					.every((render) =>
						render.sourceKind === 'flat-local-point-sun'
							? render.sceneLightMode === 'flat-local-point-sun'
							: render.sceneLightMode === 'distant-directional-sun'
					)
					? 'passed'
					: 'failed',
			measured: renders
				.filter((render) => render.debugView === 'final')
				.map((render) => ({
					scenarioId: render.scenarioId,
					sourceKind: render.sourceKind,
					sceneLightMode: render.sceneLightMode,
				})),
		},
		{
			id: 'screenshot-capture-remains-available',
			status: canvas.toDataURL('image/png') ? 'passed' : 'failed',
			measured: {
				canvas: {
					width: canvas.width,
					height: canvas.height,
				},
			},
		},
	];
	const summary = summarizeCriteria(criteria);
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-three-native-scenario-controls-poc-result',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels: [],
		renders,
		diagnostics: {
			kind: 'browser-three-native-scenario-controls-poc-diagnostics',
			status: summary.failed === 0 ? 'accepted' : 'rejected',
			iteration:
				command?.payload?.iteration ||
				'37-scenario-controls-poc',
			goal:
				'Expose lab scenario and debug-view controls that update the same source/geometry config consumed by Three lights and Algorithm32AtmospherePass.',
			criteria,
			summary,
		},
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function threeNativeScenarioControlDefinitions() {
	return [
		{
			id: 'distant-midday',
			passMode: 'distant-first-order-atmosphere',
			source: makeDistantSunSourcePacket(DIRECT_RADIANCE_SUN_CASE),
			geometry: makeSphericalAtmosphereGeometryPacket(),
		},
		{
			id: 'distant-sunset-behind-camera',
			passMode: 'distant-first-order-atmosphere',
			source: makeDistantSunSourcePacket(LOW_SUN_CASE),
			geometry: makeSphericalAtmosphereGeometryPacket(),
			cameraViewMode: 'source-behind-camera',
		},
		{
			id: 'local-closest',
			passMode: 'flat-local-first-order-atmosphere',
			source: makeFlatLocalSunSourcePacket(0),
			geometry: makeFlatAtmosphereGeometryPacket(),
		},
		{
			id: 'local-090deg',
			passMode: 'flat-local-first-order-atmosphere',
			source: makeFlatLocalSunSourcePacket(90),
			geometry: makeFlatAtmosphereGeometryPacket(),
		},
	];
}

function createThreeNativeScenarioControls({ scenarios, debugViews }) {
	let container = document.getElementById('three-native-scenario-controls');
	if (container) {
		container.remove();
	}
	container = document.createElement('section');
	container.id = 'three-native-scenario-controls';
	container.style.display = 'grid';
	container.style.gridTemplateColumns = 'auto auto';
	container.style.gap = '8px';
	container.style.alignItems = 'center';
	const scenario = document.createElement('select');
	scenario.id = 'scenario-select';
	for (const item of scenarios) {
		const option = document.createElement('option');
		option.value = item.id;
		option.textContent = item.id;
		scenario.appendChild(option);
	}
	const debugView = document.createElement('select');
	debugView.id = 'debug-view-select';
	for (const item of debugViews) {
		const option = document.createElement('option');
		option.value = item;
		option.textContent = item;
		debugView.appendChild(option);
	}
	container.appendChild(scenario);
	container.appendChild(debugView);
	document.querySelector('main')?.prepend(container);
	return { container, scenario, debugView };
}

async function drawLivePassSoftShaderContactSheet({ results }) {
	const panelWidth = 320;
	const panelHeight = 180;
	const labelHeight = 24;
	const canvas = document.createElement('canvas');
	canvas.width = panelWidth * 2;
	canvas.height = (panelHeight + labelHeight) * results.length;
	const context = canvas.getContext('2d');
	context.fillStyle = '#101318';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.font = '14px Arial';
	context.textBaseline = 'middle';

	for (let row = 0; row < results.length; row += 1) {
		const result = results[row];
		const y = row * (panelHeight + labelHeight);
		context.fillStyle = '#e8edf5';
		context.fillText(`${result.id} live`, 8, y + labelHeight * 0.5);
		context.fillText(`${result.id} soft`, panelWidth + 8, y + labelHeight * 0.5);
		const liveImage = await loadImageDataUrl(result.imageDataUrl);
		const oracleImage = await loadImageDataUrl(
			result.atmosphereParity?.oracleImageDataUrl
		);
		context.drawImage(liveImage, 0, y + labelHeight, panelWidth, panelHeight);
		context.drawImage(
			oracleImage,
			panelWidth,
			y + labelHeight,
			panelWidth,
			panelHeight
		);
	}

	return {
		dataUrl: canvas.toDataURL('image/png'),
		width: canvas.width,
		height: canvas.height,
	};
}

function loadImageDataUrl(dataUrl) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = dataUrl;
	});
}

function renderThreeNativeAdapterSwitchFrame({
	id,
	renderer,
	scene,
	camera,
	pass,
	canvas,
	source,
	geometry,
	mode,
	sceneLightPacket,
}) {
	pass.renderScene(scene, camera);
	pass.render({ camera });
	const rgba8 = readCanvasRgbaTopLeft(renderer, canvas.width, canvas.height);
	return {
		id,
		mode,
		passInstanceId: pass.instanceId,
		rendererContext: renderer.getContext().getParameter(renderer.getContext().VERSION),
		source,
		geometry,
		sceneLight: sceneLightPacket,
		outputSummary: summarizeRgba8(rgba8),
		rgba8: Array.from(rgba8),
		imageDataUrl: canvas.toDataURL('image/png'),
	};
}

function replaceMountainSourceLight({ scene, sourcePacket, targetMeters }) {
	for (const child of [...scene.children]) {
		if (child.userData?.algorithm32SourceLight) {
			scene.remove(child);
			child.dispose?.();
		}
	}
	return addMountainSourceLight({ scene, sourcePacket, targetMeters });
}

async function renderThreeNativeLiveAtmosphereFrame({
	id,
	renderer,
	scene,
	camera,
	controls,
	pass,
	canvas,
}) {
	controls.update();
	pass.renderScene(scene, camera);
	pass.render({ camera });
	const rgba8 = readCanvasRgbaTopLeft(renderer, canvas.width, canvas.height);
	await pageDelay(16);
	return {
		id,
		camera: {
			positionMeters: vectorToArray(camera.position),
			verticalFovDegrees: camera.fov,
			aspect: camera.aspect,
			near: camera.near,
			far: camera.far,
			matrixWorld: camera.matrixWorld.toArray(),
		},
		outputSummary: summarizeRgba8(rgba8),
		rgba8: Array.from(rgba8),
		imageDataUrl: canvas.toDataURL('image/png'),
	};
}

function defaultThreeNativePassCases({ passMode }) {
	if (passMode === 'distant-first-order-atmosphere') {
		return [
			{
				id: 'distant-midday',
				width: 320,
				height: 180,
				sunCase: DIRECT_RADIANCE_SUN_CASE.id,
				cameraAdjustment: 'none',
				description: 'Distant high Sun with the default mountain view.',
			},
			{
				id: 'distant-sunset-behind-camera',
				width: 320,
				height: 180,
				sunCase: LOW_SUN_CASE.id,
				cameraViewMode: 'source-behind-camera',
				cameraAdjustment: 'none',
				description:
					'Distant low Sun source behind the camera, using the same Three light/source packet.',
			},
			{
				id: 'distant-midday-resized-wide-fov',
				width: 256,
				height: 144,
				sunCase: DIRECT_RADIANCE_SUN_CASE.id,
				cameraAdjustment: 'wide-fov',
				description:
					'Distant high Sun resized/FOV variant to keep render-target refresh covered.',
			},
		];
	}
	if (passMode === 'flat-local-first-order-atmosphere') {
		return [
			{
				id: 'local-closest',
				width: 320,
				height: 180,
				localOffsetDegrees: 0,
				cameraAdjustment: 'none',
				description:
					'Flat/local finite Sun at closest approach with source-driven PointLight.',
			},
			{
				id: 'local-090deg',
				width: 320,
				height: 180,
				localOffsetDegrees: 90,
				cameraAdjustment: 'none',
				description:
					'Flat/local finite Sun 90 degrees around the configured orbit.',
			},
			{
				id: 'local-closest-resized-wide-fov',
				width: 256,
				height: 144,
				localOffsetDegrees: 0,
				cameraAdjustment: 'wide-fov',
				description:
					'Flat/local closest source resized/FOV variant to keep render-target refresh covered.',
			},
		];
	}
	const cases = [
		{
			id: 'base-view',
			width: 320,
			height: 180,
			cameraAdjustment: 'none',
			description: 'Baseline mountain scene camera.',
		},
		{
			id: 'moved-camera',
			width: 320,
			height: 180,
			cameraAdjustment: 'raised-forward',
			description: 'Camera moved and re-aimed to prove uniforms refresh.',
		},
		{
			id: 'resized-wide-fov',
			width: 256,
			height: 144,
			cameraAdjustment: 'wide-fov',
			description: 'Smaller render target and wider FOV.',
		},
	];

	return passMode === 'identity' ? cases : cases;
}

function resolveThreeNativeCaseSourcePacket({
	payload,
	caseConfig,
	defaultSourcePacket,
}) {
	if (caseConfig.sourcePacket) {
		return caseConfig.sourcePacket;
	}
	if (Number.isFinite(caseConfig.localOffsetDegrees)) {
		return makeFlatLocalSunSourcePacket(caseConfig.localOffsetDegrees);
	}
	if (caseConfig.sunCase) {
		return makeDistantSunSourcePacket(resolveDistantSunCase(caseConfig.sunCase));
	}
	return defaultSourcePacket || resolveMountainLitSourcePacket(payload);
}

function runThreeNativeAtmospherePassCase({
	command,
	payload,
	caseConfig,
	passMode,
	sourcePacket,
	geometryPacket,
}) {
	const canvas = document.getElementById('lab-canvas');
	const width = positiveInteger(caseConfig.width, positiveInteger(payload.width, 320));
	const height = positiveInteger(
		caseConfig.height,
		positiveInteger(payload.height, 180)
	);
	const sceneSetup = createMountainLitScene(canvas, {
		width,
		height,
		mountainView: caseConfig.mountainView ||
			payload.mountainView ||
			MOUNTAIN_VIEW_MODES.frontHighSun,
		cameraViewMode: caseConfig.cameraViewMode || payload.cameraViewMode || null,
		sourcePacket,
		sceneDetailSpec: payload.sceneDetailSpec || null,
	});
	const { renderer, scene, camera } = sceneSetup;
	let directSceneRgba8;
	let validationPacket = null;
	let pass;
	let outputRgba8;
	let sceneTargetRgba8;
	let debugChecks = [];
	let outputImageDataUrl = null;
	let atmosphereOracleResult = null;
	let atmosphereSelectedChecks = [];
	let atmosphereImageDeltaSummary = null;
	let oracleImageDataUrl = null;

	try {
		applyThreeNativePassCameraAdjustment({
			camera,
			adjustment: caseConfig.cameraAdjustment,
		});
		applyThreeNativeDepthCameraPolicy({
			camera,
			passMode,
			payload,
		});
		renderer.render(scene, camera);
		directSceneRgba8 = readCanvasRgbaTopLeft(renderer, width, height);
		validationPacket = captureSceneInputPacket({
			captureId: `three-native-atmosphere-pass-${caseConfig.id}`,
			sceneMode: 'mountain-ridges-lit',
			sceneColorPolicy:
				'Validation-only Raycaster oracle. The live pass reads Three render targets and depth texture, not this packet.',
			canvas,
			renderer,
			camera,
			meshes: sceneSetup.meshes,
			sceneObjects: sceneSetup.sceneObjects,
			ground: sceneSetup.ground,
			sourcePacket,
			sceneLightPacket: sceneSetup.sceneLightPacket,
			geometryPacket,
			sceneDetailPacket: sceneSetup.sceneDetailPacket,
		});
		pass = new Algorithm32AtmospherePass({
			renderer,
			width,
			height,
			camera,
			config: {
				source: sourcePacket,
				geometry: geometryPacket,
				atmosphere: { kind: 'algorithm32-earth-poc' },
				display: { mode: 'identity-or-depth-debug' },
			},
			mode: passMode,
			maxDistanceMeters: finitePositiveNumber(
				payload.depthDebugMaxDistanceMeters,
				camera.far
			),
		});
		pass.renderScene(scene, camera);
		sceneTargetRgba8 = pass.readSceneColorTargetTopLeft();
		pass.render({ camera });
		outputRgba8 = readCanvasRgbaTopLeft(renderer, width, height);
		outputImageDataUrl = canvas.toDataURL('image/png');

		if (passMode === 'depth-distance') {
			debugChecks = threeNativeDepthSelectedChecks({
				packet: validationPacket,
				debugRgba8: outputRgba8,
				maxDistanceMeters: pass.maxDistanceMeters,
			});
		}
		if (
			passMode === 'distant-first-order-atmosphere' ||
			passMode === 'flat-local-first-order-atmosphere'
		) {
			atmosphereOracleResult =
				passMode === 'flat-local-first-order-atmosphere'
					? renderFlatLocalSoftShaderPostprocess({
							renderer,
							packet: validationPacket,
							composeSceneColor: true,
							surfacePolicy: 'captured-rgba8-display-domain',
						})
					: renderSoftShaderAtmospherePostprocess({
							renderer,
							camera,
							packet: validationPacket,
							includeSecondOrder: false,
						});
			atmosphereSelectedChecks = atmosphereParitySelectedChecks({
				packet: validationPacket,
				liveRgba8: outputRgba8,
				oracleRgba8: atmosphereOracleResult.readbackRgba8,
			});
			atmosphereImageDeltaSummary = summarizeRgbaDelta(
				outputRgba8,
				atmosphereOracleResult.readbackRgba8
			);
			oracleImageDataUrl = canvas.toDataURL('image/png');
		}
	} finally {
		pass?.dispose();
		disposeSceneSetup(sceneSetup);
	}

	const directVsTargetMaxAbsDelta = maxAbsByteDelta(
		directSceneRgba8,
		sceneTargetRgba8
	);
	const directVsPassMaxAbsDelta =
		passMode === 'identity'
			? maxAbsByteDelta(directSceneRgba8, outputRgba8)
			: null;
	const targetVsPassMaxAbsDelta =
		passMode === 'identity'
			? maxAbsByteDelta(sceneTargetRgba8, outputRgba8)
			: null;
	const selectedPassthroughChecks =
		passMode === 'identity'
			? validationPacket.selectedPixels.map((sample) => {
					const directRgba = rgbaAt(directSceneRgba8, width, sample.x, sample.y);
					const passRgba = rgbaAt(outputRgba8, width, sample.x, sample.y);
					const deltas = passRgba.map(
						(value, index) => value - directRgba[index]
					);
					return {
						id: sample.id,
						x: sample.x,
						y: sample.y,
						classification: sample.classification,
						hitDistanceMeters: sample.hitDistanceMeters,
						directRgba,
						passRgba,
						deltas,
						maxAbsRgbDelta: Math.max(
							...deltas.slice(0, 3).map((value) => Math.abs(value))
						),
					};
				})
			: [];

	return {
		id: caseConfig.id,
		description: caseConfig.description || null,
		passMode,
		canvas: { width, height },
		camera: {
			positionMeters: vectorToArray(camera.position),
			verticalFovDegrees: camera.fov,
			aspect: camera.aspect,
			near: camera.near,
			far: camera.far,
			cameraAdjustment: caseConfig.cameraAdjustment || 'none',
		},
		selectedPixels: validationPacket.selectedPixels,
		counts: validationPacket.counts,
		sourcePacket,
		sceneLight: sceneSetup.sceneLightPacket,
		imageDataUrl: outputImageDataUrl,
		renderTarget: {
			colorTexture: {
				width,
				height,
				format: 'RGBA/UNSIGNED_BYTE',
			},
			depthTexture: {
				width,
				height,
				format: 'DepthFormat',
				type: 'UnsignedIntType',
			},
		},
		passthrough: {
			directVsTargetMaxAbsDelta,
			directVsPassMaxAbsDelta,
			targetVsPassMaxAbsDelta,
			selectedPassthroughChecks,
			directSceneSummary: summarizeRgba8(directSceneRgba8),
			outputSummary: summarizeRgba8(outputRgba8),
		},
		depthDiagnostics:
			passMode === 'depth-distance'
				? {
						maxDistanceMeters: pass?.maxDistanceMeters ||
							finitePositiveNumber(
								payload.depthDebugMaxDistanceMeters,
								camera.far
							),
						encoding:
							'RGB24 normalized distance; magenta [255,0,255] marks clear-depth sky/no-hit.',
						depthConvention:
							'Three/WebGL depth texture samples are non-linear depth in [0,1], with 1.0 representing the cleared far/sky value. The shader maps uv/depth to clip space, multiplies by projectionMatrixInverse and cameraMatrixWorld, then measures world-space distance from cameraPosition.',
						cameraDepthPolicy:
							'Depth contract cases use an explicit lab near plane so 24-bit perspective depth has enough precision for kilometer-scale terrain.',
						selectedChecks: debugChecks,
						acceptanceSampleIds: THREE_NATIVE_DEPTH_ACCEPTANCE_SAMPLE_IDS,
						distanceToleranceMeters: finitePositiveNumber(
							payload.depthDistanceToleranceMeters,
							50
						),
						maxAcceptanceHitDistanceDeltaMeters: maxFinite(
							debugChecks
								.filter(
									(check) =>
										check.acceptanceRole === 'gating' &&
										check.expectedHit
								)
								.map((check) => check.distanceDeltaMeters)
						),
						maxHitDistanceDeltaMeters: maxFinite(
							debugChecks
								.filter((check) => check.expectedHit)
								.map((check) => check.distanceDeltaMeters)
						),
						classificationMismatches: debugChecks.filter(
							(check) =>
								check.expectedHit !== check.shaderClassifiedHit &&
								!check.edgeTolerance
						).length,
					}
				: null,
		atmosphereParity:
			passMode === 'distant-first-order-atmosphere' ||
			passMode === 'flat-local-first-order-atmosphere'
				? {
						oracleKind:
							atmosphereOracleResult?.imageShaderDiagnostics?.kind || null,
						oracleStatus:
							atmosphereOracleResult?.imageShaderDiagnostics?.status || null,
						scatteringPolicy:
							passMode === 'flat-local-first-order-atmosphere'
								? 'live Three-native pass uses first-order flat/local finite Sun only; oracle is existing flat/local packet soft shader with scene-color composition.'
								: 'live Three-native pass uses first-order distant directional Sun only; oracle is existing packet soft shader with includeSecondOrder=false.',
						imageDeltaSummary: atmosphereImageDeltaSummary,
						oracleImageDataUrl,
						selectedChecks: atmosphereSelectedChecks,
						maxSelectedRgbDelta: Math.max(
							0,
							...atmosphereSelectedChecks.map(
								(check) => check.maxAbsRgbDelta
							)
						),
					}
				: null,
	};
}

function applyThreeNativePassCameraAdjustment({ camera, adjustment }) {
	if (adjustment === 'raised-forward') {
		camera.position.y += 850;
		camera.position.z -= 900;
		camera.lookAt(new THREE.Vector3(3000, 820, -30000));
	} else if (adjustment === 'wide-fov') {
		camera.fov = Math.min(camera.fov + 16, 78);
		camera.lookAt(new THREE.Vector3(-2500, 560, -28000));
	}
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();
}

function applyThreeNativeDepthCameraPolicy({ camera, passMode, payload }) {
	if (
		passMode !== 'depth-distance' &&
		passMode !== 'distant-first-order-atmosphere'
	) {
		return;
	}
	const nearMeters = finitePositiveNumber(payload.depthContractNearMeters, 100);
	const farMeters = finitePositiveNumber(payload.depthContractFarMeters, camera.far);
	if (nearMeters >= farMeters) {
		throw new Error(
			`Invalid depth camera policy: near ${nearMeters} must be less than far ${farMeters}.`
		);
	}
	camera.near = nearMeters;
	camera.far = farMeters;
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld(true);
}

class Algorithm32AtmospherePass {
	constructor({
		renderer,
		width,
		height,
		camera,
		config,
		mode = 'identity',
		maxDistanceMeters,
	}) {
		this.renderer = renderer;
		this.instanceId = `algorithm32-atmosphere-pass-${++algorithm32AtmospherePassInstanceCounter}`;
		this.width = width;
		this.height = height;
		this.mode = mode;
		this.maxDistanceMeters = maxDistanceMeters;
		this.config = config || {};
		this.sceneRenderTarget = this.createSceneRenderTarget(width, height);
		this.passScene = new THREE.Scene();
		this.passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		this.material = this.createMaterial({ camera });
		this.fullscreenQuad = new THREE.Mesh(
			new THREE.PlaneGeometry(2, 2),
			this.material
		);
		this.passScene.add(this.fullscreenQuad);
	}

	createSceneRenderTarget(width, height) {
		const renderTarget = new THREE.WebGLRenderTarget(width, height, {
			format: THREE.RGBAFormat,
			type: THREE.UnsignedByteType,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			depthBuffer: true,
			stencilBuffer: false,
		});
		renderTarget.texture.name = 'Algorithm32AtmospherePass.sceneColor';
		if ('colorSpace' in renderTarget.texture) {
			renderTarget.texture.colorSpace =
				this.renderer.outputColorSpace || THREE.SRGBColorSpace;
		}
		renderTarget.depthTexture = new THREE.DepthTexture(
			width,
			height,
			THREE.UnsignedIntType
		);
		renderTarget.depthTexture.name = 'Algorithm32AtmospherePass.sceneDepth';
		renderTarget.depthTexture.format = THREE.DepthFormat;
		renderTarget.depthTexture.minFilter = THREE.NearestFilter;
		renderTarget.depthTexture.magFilter = THREE.NearestFilter;
		return renderTarget;
	}

	createMaterial({ camera }) {
		return new THREE.ShaderMaterial({
			glslVersion: THREE.GLSL3,
			depthTest: false,
			depthWrite: false,
			toneMapped: false,
			uniforms: {
				sceneColorTexture: { value: this.sceneRenderTarget.texture },
				sceneDepthTexture: { value: this.sceneRenderTarget.depthTexture },
				sourceProjectionMatrixInverse: {
					value: camera.projectionMatrixInverse.clone(),
				},
				sourceCameraMatrixWorld: { value: camera.matrixWorld.clone() },
				sourceCameraPosition: { value: camera.position.clone() },
				maxDistanceMeters: { value: this.maxDistanceMeters },
				resolution: { value: new THREE.Vector2(this.width, this.height) },
				sunRayAlgorithm: {
					value: new THREE.Vector3(
						...sourceSunDirectionForPassConfig(this.config)
					),
				},
				localSourcePosition: {
					value: new THREE.Vector3(
						...localSourcePositionForPassConfig(this.config)
					),
				},
				topAltitudeMeters: {
					value: this.config?.geometry?.topAltitudeMeters ?? 100000,
				},
				sceneSkyRayLimitMeters: {
					value: this.config?.geometry?.sceneSkyRayLimitMeters ?? 1926774,
				},
				referenceDistanceKm: {
					value: this.config?.source?.referenceDistanceKm ?? 4800,
				},
				referenceSpectralIncidentScale: {
					value:
						this.config?.source?.referenceSpectralIncidentScale ?? 1,
				},
				distanceFalloff: {
					value: this.config?.source?.distanceFalloff === false ? 0 : 1,
				},
				sourceColor: {
					value: new THREE.Vector3(
						this.config?.source?.color?.r ?? 1,
						this.config?.source?.color?.g ?? 0.98,
						this.config?.source?.color?.b ?? 0.95
					),
				},
				debugViewMode: {
					value: debugViewModeCode(this.config?.display?.debugView),
				},
				passMode: { value: threeNativePassModeCode(this.mode) },
			},
			vertexShader: `
out vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,
			fragmentShader: `
precision highp float;
precision highp sampler2D;

uniform sampler2D sceneColorTexture;
uniform sampler2D sceneDepthTexture;
uniform mat4 sourceProjectionMatrixInverse;
uniform mat4 sourceCameraMatrixWorld;
uniform vec3 sourceCameraPosition;
uniform float maxDistanceMeters;
uniform vec2 resolution;
uniform vec3 sunRayAlgorithm;
uniform vec3 localSourcePosition;
uniform float topAltitudeMeters;
uniform float sceneSkyRayLimitMeters;
uniform float referenceDistanceKm;
uniform float referenceSpectralIncidentScale;
uniform int distanceFalloff;
uniform vec3 sourceColor;
uniform int debugViewMode;
uniform int passMode;

in vec2 vUv;
out vec4 outColor;

const int CHANNEL_COUNT = 15;
const int VIEW_SAMPLES = 20;
const int SUN_TRANSMITTANCE_SAMPLES = 10;
const float BOTTOM_RADIUS_METERS = 6360000.0;
const float TOP_RADIUS_METERS = 6420000.0;
const float RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0;
const float MIE_SCALE_HEIGHT_METERS = 1200.0;
const float RAYLEIGH_COEFFICIENT_SCALE = 1.24062e-6;
const float MIE_ANGSTROM_ALPHA = 0.8;
const float MIE_ANGSTROM_BETA = 0.04;
const float MIE_SINGLE_SCATTERING_ALBEDO = 0.8;
const float MIE_PHASE_G = 0.7;
const float PI = 3.141592653589793;
const float SPECTRAL_DELTA_NM = 31.333333333333332;
const float MAX_LUMINOUS_EFFICACY = 683.0;
const float DISPLAY_TONE_MAP_K = 0.00029282576866764276;
const float WAVELENGTHS_NM[CHANNEL_COUNT] = float[CHANNEL_COUNT](
	375.666666666667,
	407.0,
	438.333333333333,
	469.666666666667,
	501.0,
	532.333333333333,
	563.666666666667,
	595.0,
	626.333333333333,
	657.666666666667,
	689.0,
	720.333333333333,
	751.666666666667,
	783.0,
	814.333333333333
);
const float SOLAR_IRRADIANCE[CHANNEL_COUNT] = float[CHANNEL_COUNT](
	1.068866666667,
	1.729673,
	1.862071666667,
	2.022063333333,
	1.908154,
	1.883391,
	1.834246666667,
	1.76744,
	1.65952,
	1.548102333333,
	1.45078,
	1.340960333333,
	1.262433333333,
	1.175208,
	1.090824
);
const vec3 CIE[CHANNEL_COUNT] = vec3[CHANNEL_COUNT](
	vec3(0.00082512, 0.000024284, 0.00388120013333),
	vec3(0.031318, 0.000868, 0.14908),
	vec3(0.341686666667, 0.0209466666667, 1.70569333333),
	vec3(0.199076, 0.0898413333333, 1.30367066667),
	vec3(0.0044, 0.33986, 0.26006),
	vec3(0.19361662, 0.88666338, 0.0364106666667),
	vec3(0.656026666667, 0.982973333333, 0.00305666593333),
	vec3(1.0567, 0.6949, 0.001),
	vec3(0.722333333333, 0.306066666667, 0.000086666664),
	vec3(0.190006666667, 0.0706133333333, 0.0),
	vec3(0.02474, 0.008952, 0.0),
	vec3(0.0028426512, 0.00102653333333, 0.0),
	vec3(0.000299809433333, 0.000108266666667, 0.0),
	vec3(0.000034215932, 0.000012356, 0.0),
	vec3(0.00000378221413333, 0.00000136582666667, 0.0)
);

vec3 linearToSrgb(vec3 value) {
	vec3 low = value * 12.92;
	vec3 high = 1.055 * pow(max(value, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
	return mix(low, high, step(vec3(0.0031308), value));
}

float rayleighScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return RAYLEIGH_COEFFICIENT_SCALE * pow(wavelengthMicrometersValue, -4.0);
}

float mieExtinctionCoefficientAt(float wavelengthMicrometersValue) {
	return (MIE_ANGSTROM_BETA / MIE_SCALE_HEIGHT_METERS) *
		pow(wavelengthMicrometersValue, -MIE_ANGSTROM_ALPHA);
}

float mieScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
		MIE_SINGLE_SCATTERING_ALBEDO;
}

float transmittanceAt(
	float rayleighOpticalLength,
	float mieOpticalLength,
	float wavelengthMicrometersValue
) {
	float opticalDepth =
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
			rayleighOpticalLength +
		mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
			mieOpticalLength;
	return exp(-opticalDepth);
}

float rayleighPhaseFunction(float nu) {
	return (3.0 / (16.0 * PI)) * (1.0 + nu * nu);
}

float miePhaseFunction(float g, float nu) {
	float k = (3.0 / (8.0 * PI)) *
		((1.0 - g * g) / (2.0 + g * g));

	return (k * (1.0 + nu * nu)) /
		pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

float distanceToTopAtmosphereBoundary(float radius, float mu) {
	float discriminant =
		radius * radius * (mu * mu - 1.0) +
		TOP_RADIUS_METERS * TOP_RADIUS_METERS;

	return max(0.0, -radius * mu + sqrt(max(0.0, discriminant)));
}

bool rayIntersectsGround(float radius, float mu) {
	return
		mu < 0.0 &&
		radius * radius * (mu * mu - 1.0) +
			BOTTOM_RADIUS_METERS * BOTTOM_RADIUS_METERS >=
			0.0;
}

vec2 densityAtPosition(vec3 position) {
	float altitudeMeters = length(position) - BOTTOM_RADIUS_METERS;
	float rayleighDensity =
		exp(-max(0.0, altitudeMeters) / RAYLEIGH_SCALE_HEIGHT_METERS);
	float mieDensity =
		exp(-max(0.0, altitudeMeters) / MIE_SCALE_HEIGHT_METERS);

	return vec2(rayleighDensity, mieDensity);
}

float computeSunTransmittance(vec3 position, float wavelengthMicrometersValue) {
	float radius = length(position);
	float mu = dot(position, sunRayAlgorithm) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return 0.0;
	}

	float distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
	float stepSize = distanceToTop / float(SUN_TRANSMITTANCE_SAMPLES);
	float rayleighOpticalLength = 0.0;
	float mieOpticalLength = 0.0;

	for (int sampleIndex = 0; sampleIndex <= SUN_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = position + sunRayAlgorithm * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);
		float weight =
			sampleIndex == 0 || sampleIndex == SUN_TRANSMITTANCE_SAMPLES
				? 0.5
				: 1.0;
		rayleighOpticalLength += density.x * weight * stepSize;
		mieOpticalLength += density.y * weight * stepSize;
	}

	return transmittanceAt(
		rayleighOpticalLength,
		mieOpticalLength,
		wavelengthMicrometersValue
	);
}

vec2 firstOrderPathAndViewT(
	vec3 origin,
	vec3 direction,
	float distanceMeters,
	float wavelengthMicrometersValue,
	float solarIrradiance
) {
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float previousRayleigh = 0.0;
	float previousMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);

		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousRayleigh + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousMie + density.y) * stepSize;
		}

		float viewTransmittance = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie,
			wavelengthMicrometersValue
		);
		float sunTransmittance =
			computeSunTransmittance(samplePosition, wavelengthMicrometersValue);
		float transmittance = viewTransmittance * sunTransmittance;
		float weight =
			sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		rayleighSum += transmittance * density.x * weight;
		mieSum += transmittance * density.y * weight;
		previousRayleigh = density.x;
		previousMie = density.y;
	}

	float nu = dot(direction, sunRayAlgorithm);
	float rayleigh =
		rayleighSum *
		stepSize *
		solarIrradiance *
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
		rayleighPhaseFunction(nu);
	float mie =
		mieSum *
		stepSize *
		solarIrradiance *
		mieScatteringCoefficientAt(wavelengthMicrometersValue) *
		miePhaseFunction(MIE_PHASE_G, nu);
	float viewTransmittance = transmittanceAt(
		cumulativeRayleigh,
		cumulativeMie,
		wavelengthMicrometersValue
	);

	return vec2(rayleigh + mie, viewTransmittance);
}

vec3 displayPreview(vec3 xyz) {
	vec3 linearSrgb = MAX_LUMINOUS_EFFICACY * vec3(
		3.2406 * xyz.x + -1.5372 * xyz.y + -0.4986 * xyz.z,
		-0.9689 * xyz.x + 1.8758 * xyz.y + 0.0415 * xyz.z,
		0.0557 * xyz.x + -0.204 * xyz.y + 1.057 * xyz.z
	);
	return clamp(
		vec3(1.0) - exp(-DISPLAY_TONE_MAP_K * max(vec3(0.0), linearSrgb)),
		vec3(0.0),
		vec3(1.0)
	);
}

vec2 flatDensityAt(vec3 position) {
	float altitudeMeters = position.z;
	if (altitudeMeters < 0.0 || altitudeMeters > topAltitudeMeters) {
		return vec2(0.0);
	}
	return vec2(
		exp(-altitudeMeters / RAYLEIGH_SCALE_HEIGHT_METERS),
		exp(-altitudeMeters / MIE_SCALE_HEIGHT_METERS)
	);
}

float localSpectralScale(float incidentScale, int channelIndex) {
	if (channelIndex < 4) {
		return incidentScale * sourceColor.b;
	}
	if (channelIndex < 8) {
		return incidentScale * sourceColor.g;
	}
	return incidentScale * sourceColor.r;
}

float localSourceTransmittance(
	vec3 position,
	vec3 sourceDirection,
	float sourceDistance,
	float wavelengthMicrometersValue
) {
	if (sourceDirection.z < 0.0) {
		float groundDistance = max(0.0, -position.z / sourceDirection.z);
		if (groundDistance < sourceDistance - 1e-9) {
			return 0.0;
		}
	}
	float topDistance = sourceDirection.z > 0.0
		? max(0.0, (topAltitudeMeters - position.z) / sourceDirection.z)
		: sourceDistance;
	float atmosphereDistance = min(sourceDistance, topDistance);
	if (atmosphereDistance <= 0.0) {
		return 1.0;
	}
	float stepSize = atmosphereDistance / float(SUN_TRANSMITTANCE_SAMPLES);
	float rayleighLength = 0.0;
	float mieLength = 0.0;
	for (int sampleIndex = 0; sampleIndex <= SUN_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		vec3 samplePosition =
			position + sourceDirection * (float(sampleIndex) * stepSize);
		vec2 density = flatDensityAt(samplePosition);
		float weight =
			sampleIndex == 0 || sampleIndex == SUN_TRANSMITTANCE_SAMPLES
				? 0.5
				: 1.0;
		rayleighLength += density.x * weight * stepSize;
		mieLength += density.y * weight * stepSize;
	}
	return transmittanceAt(
		rayleighLength,
		mieLength,
		wavelengthMicrometersValue
	);
}

vec2 localFirstOrderPathAndViewT(
	vec3 origin,
	vec3 direction,
	float distanceMeters,
	int channelIndex
) {
	if (distanceMeters <= 0.0) {
		return vec2(0.0, 1.0);
	}
	float wavelengthNm = WAVELENGTHS_NM[channelIndex];
	float wavelengthMicrometersValue = wavelengthNm * 0.001;
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	vec2 previousDensity = flatDensityAt(origin);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = flatDensityAt(samplePosition);
		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousDensity.x + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousDensity.y + density.y) * stepSize;
		}
		float viewT = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie,
			wavelengthMicrometersValue
		);
		vec3 vectorToSource = localSourcePosition - samplePosition;
		float sourceDistance = length(vectorToSource);
		vec3 sourceDirection = sourceDistance == 0.0
			? vec3(0.0, 0.0, 1.0)
			: vectorToSource / sourceDistance;
		float distanceKm = sourceDistance / 1000.0;
		float falloff = distanceFalloff == 1
			? pow(referenceDistanceKm / distanceKm, 2.0)
			: 1.0;
		float incidentScale = referenceSpectralIncidentScale * falloff;
		float sourceScale = localSpectralScale(incidentScale, channelIndex);
		float sourceT = localSourceTransmittance(
			samplePosition,
			sourceDirection,
			sourceDistance,
			wavelengthMicrometersValue
		);
		float transmittance = viewT * sourceT;
		float nu = clamp(dot(direction, sourceDirection), -1.0, 1.0);
		float weight = sampleIndex == 0 || sampleIndex == VIEW_SAMPLES
			? 0.5
			: 1.0;
		float sourceIrradiance = SOLAR_IRRADIANCE[channelIndex] * sourceScale;
		rayleighSum +=
			transmittance *
			density.x *
			sourceIrradiance *
			rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
			rayleighPhaseFunction(nu) *
			weight;
		mieSum +=
			transmittance *
			density.y *
			sourceIrradiance *
			mieScatteringCoefficientAt(wavelengthMicrometersValue) *
			miePhaseFunction(MIE_PHASE_G, nu) *
			weight;
		previousDensity = density;
	}
	float viewTransmittance = transmittanceAt(
		cumulativeRayleigh,
		cumulativeMie,
		wavelengthMicrometersValue
	);
	return vec2((rayleighSum + mieSum) * stepSize, viewTransmittance);
}

vec3 encodeDistanceRgb24(float distanceMeters) {
	float normalized = clamp(distanceMeters / maxDistanceMeters, 0.0, 1.0);
	float encoded = floor(normalized * 16777215.0 + 0.5);
	float r = floor(encoded / 65536.0);
	float g = floor((encoded - r * 65536.0) / 256.0);
	float b = encoded - r * 65536.0 - g * 256.0;
	return vec3(r, g, b) / 255.0;
}

float reconstructedWorldDistance(float depth) {
	vec2 ndc = (gl_FragCoord.xy / resolution) * 2.0 - 1.0;
	vec4 clip = vec4(ndc, depth * 2.0 - 1.0, 1.0);
	vec4 view = sourceProjectionMatrixInverse * clip;
	view /= view.w;
	vec4 world = sourceCameraMatrixWorld * view;
	return length(world.xyz - sourceCameraPosition);
}

vec3 reconstructedWorldRayDirection() {
	vec2 ndc = (gl_FragCoord.xy / resolution) * 2.0 - 1.0;
	vec4 clip = vec4(ndc, 1.0, 1.0);
	vec4 view = sourceProjectionMatrixInverse * clip;
	view /= view.w;
	vec4 world = sourceCameraMatrixWorld * view;
	return normalize(world.xyz - sourceCameraPosition);
}

vec3 threeToAlgorithmPosition(vec3 position) {
	return vec3(position.x, -position.z, BOTTOM_RADIUS_METERS + position.y);
}

vec3 threeToAlgorithmDirection(vec3 direction) {
	return normalize(vec3(direction.x, -direction.z, direction.y));
}

vec3 threeToFlatAlgorithmPosition(vec3 position) {
	return vec3(position.x, -position.z, position.y);
}

vec3 threeToFlatAlgorithmDirection(vec3 direction) {
	return normalize(vec3(direction.x, -direction.z, direction.y));
}

float distanceToFlatSkyBoundary(vec3 origin, vec3 direction) {
	float distance = sceneSkyRayLimitMeters;
	if (direction.z < 0.0) {
		float groundDistance = max(0.0, -origin.z / direction.z);
		distance = min(distance, groundDistance);
	}
	if (direction.z > 0.0) {
		float topDistance =
			max(0.0, (topAltitudeMeters - origin.z) / direction.z);
		distance = min(distance, topDistance);
	}
	return distance;
}

vec3 distantFirstOrderAtmosphere(vec2 pixelUv, bool hit, float hitDistanceMeters) {
	vec3 rayDirectionThree = reconstructedWorldRayDirection();
	vec3 algorithmOrigin = threeToAlgorithmPosition(sourceCameraPosition);
	vec3 algorithmDirection = threeToAlgorithmDirection(rayDirectionThree);
	float distanceMeters = hitDistanceMeters;

	if (!hit) {
		float radius = length(algorithmOrigin);
		float mu = dot(algorithmOrigin, algorithmDirection) / radius;
		distanceMeters = distanceToTopAtmosphereBoundary(radius, mu);
	}

	vec3 xyz = vec3(0.0);
	float blueTransmittanceSum = 0.0;
	float greenTransmittanceSum = 0.0;
	float redTransmittanceSum = 0.0;

	for (int channelIndex = 0; channelIndex < CHANNEL_COUNT; channelIndex++) {
		float wavelengthNm = WAVELENGTHS_NM[channelIndex];
		float wavelengthMicrometers = wavelengthNm * 0.001;
		vec2 pathAndT = firstOrderPathAndViewT(
			algorithmOrigin,
			algorithmDirection,
			distanceMeters,
			wavelengthMicrometers,
			SOLAR_IRRADIANCE[channelIndex]
		);
		xyz += CIE[channelIndex] * pathAndT.x * SPECTRAL_DELTA_NM;
		if (channelIndex < 5) {
			blueTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 4 && channelIndex < 9) {
			greenTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 8) {
			redTransmittanceSum += pathAndT.y;
		}
	}

	vec3 displayRgb = displayPreview(xyz);
	vec3 transmittanceRgb = vec3(
		redTransmittanceSum / 7.0,
		greenTransmittanceSum / 5.0,
		blueTransmittanceSum / 5.0
	);
	if (debugViewMode == 1) {
		return transmittanceRgb;
	}
	if (debugViewMode == 2) {
		return displayRgb;
	}
	if (hit) {
		vec3 sceneRgb = linearToSrgb(texture(sceneColorTexture, pixelUv).rgb);
		displayRgb = clamp(
			sceneRgb * transmittanceRgb + displayRgb,
			vec3(0.0),
			vec3(1.0)
		);
	}
	return displayRgb;
}

vec3 localFirstOrderAtmosphere(vec2 pixelUv, bool hit, float hitDistanceMeters) {
	vec3 rayDirectionThree = reconstructedWorldRayDirection();
	vec3 algorithmOrigin = threeToFlatAlgorithmPosition(sourceCameraPosition);
	vec3 algorithmDirection = threeToFlatAlgorithmDirection(rayDirectionThree);
	float distanceMeters = hit
		? hitDistanceMeters
		: distanceToFlatSkyBoundary(algorithmOrigin, algorithmDirection);

	vec3 xyz = vec3(0.0);
	float blueTransmittanceSum = 0.0;
	float greenTransmittanceSum = 0.0;
	float redTransmittanceSum = 0.0;

	for (int channelIndex = 0; channelIndex < CHANNEL_COUNT; channelIndex++) {
		vec2 pathAndT = localFirstOrderPathAndViewT(
			algorithmOrigin,
			algorithmDirection,
			distanceMeters,
			channelIndex
		);
		xyz += CIE[channelIndex] * pathAndT.x * SPECTRAL_DELTA_NM;
		if (channelIndex < 5) {
			blueTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 4 && channelIndex < 9) {
			greenTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 8) {
			redTransmittanceSum += pathAndT.y;
		}
	}

	vec3 displayRgb = displayPreview(xyz);
	vec3 transmittanceRgb = vec3(
		redTransmittanceSum / 7.0,
		greenTransmittanceSum / 5.0,
		blueTransmittanceSum / 5.0
	);
	if (debugViewMode == 1) {
		return transmittanceRgb;
	}
	if (debugViewMode == 2) {
		return displayRgb;
	}
	if (hit) {
		vec3 sceneRgb = linearToSrgb(texture(sceneColorTexture, pixelUv).rgb);
		displayRgb = clamp(
			sceneRgb * transmittanceRgb + displayRgb,
			vec3(0.0),
			vec3(1.0)
		);
	}
	return displayRgb;
}

void main() {
	vec2 pixelUv = gl_FragCoord.xy / resolution;
	if (passMode == 0) {
		vec4 sceneColor = texture(sceneColorTexture, pixelUv);
		outColor = vec4(linearToSrgb(sceneColor.rgb), sceneColor.a);
		return;
	}

	float depth = texture(sceneDepthTexture, pixelUv).x;
	if (passMode == 2) {
		bool hit = depth < 0.999999;
		float distanceMeters = hit ? reconstructedWorldDistance(depth) : 0.0;
		outColor = vec4(
			distantFirstOrderAtmosphere(pixelUv, hit, distanceMeters),
			1.0
		);
		return;
	}
	if (passMode == 3) {
		bool hit = depth < 0.999999;
		float distanceMeters = hit ? reconstructedWorldDistance(depth) : 0.0;
		outColor = vec4(
			localFirstOrderAtmosphere(pixelUv, hit, distanceMeters),
			1.0
		);
		return;
	}

	if (depth >= 0.999999) {
		outColor = vec4(1.0, 0.0, 1.0, 1.0);
		return;
	}

	outColor = vec4(encodeDistanceRgb24(reconstructedWorldDistance(depth)), 1.0);
}
`,
		});
	}

	setConfig(config) {
		this.config = config || {};
	}

	setSize(width, height) {
		if (this.width === width && this.height === height) {
			return;
		}
		this.width = width;
		this.height = height;
		this.sceneRenderTarget.setSize(width, height);
		this.material.uniforms.resolution.value.set(width, height);
	}

	updateCameraUniforms(camera) {
		camera.updateMatrixWorld(true);
		camera.updateProjectionMatrix();
		this.material.uniforms.sourceProjectionMatrixInverse.value.copy(
			camera.projectionMatrixInverse
		);
		this.material.uniforms.sourceCameraMatrixWorld.value.copy(
			camera.matrixWorld
		);
		this.material.uniforms.sourceCameraPosition.value.copy(camera.position);
	}

	renderScene(scene, camera) {
		const originalTarget = this.renderer.getRenderTarget();
		this.renderer.setRenderTarget(this.sceneRenderTarget);
		this.renderer.clear(true, true, true);
		this.renderer.render(scene, camera);
		this.renderer.setRenderTarget(originalTarget);
	}

	render({ camera }) {
		this.updateCameraUniforms(camera);
		this.material.uniforms.passMode.value = threeNativePassModeCode(this.mode);
		this.material.uniforms.maxDistanceMeters.value = this.maxDistanceMeters;
		this.material.uniforms.resolution.value.set(this.width, this.height);
		this.material.uniforms.sunRayAlgorithm.value.fromArray(
			sourceSunDirectionForPassConfig(this.config)
		);
		this.material.uniforms.localSourcePosition.value.fromArray(
			localSourcePositionForPassConfig(this.config)
		);
		this.material.uniforms.topAltitudeMeters.value =
			this.config?.geometry?.topAltitudeMeters ?? 100000;
		this.material.uniforms.sceneSkyRayLimitMeters.value =
			this.config?.geometry?.sceneSkyRayLimitMeters ?? 1926774;
		this.material.uniforms.referenceDistanceKm.value =
			this.config?.source?.referenceDistanceKm ?? 4800;
		this.material.uniforms.referenceSpectralIncidentScale.value =
			this.config?.source?.referenceSpectralIncidentScale ?? 1;
		this.material.uniforms.distanceFalloff.value =
			this.config?.source?.distanceFalloff === false ? 0 : 1;
		this.material.uniforms.sourceColor.value.set(
			this.config?.source?.color?.r ?? 1,
			this.config?.source?.color?.g ?? 0.98,
			this.config?.source?.color?.b ?? 0.95
		);
		this.material.uniforms.debugViewMode.value = debugViewModeCode(
			this.config?.display?.debugView
		);
		const originalTarget = this.renderer.getRenderTarget();
		this.renderer.setRenderTarget(null);
		this.renderer.clear(true, true, true);
		this.renderer.render(this.passScene, this.passCamera);
		this.renderer.setRenderTarget(originalTarget);
	}

	readSceneColorTargetTopLeft() {
		return readRenderTargetRgbaTopLeft(
			this.renderer,
			this.sceneRenderTarget,
			this.width,
			this.height
		);
	}

	dispose() {
		this.fullscreenQuad.geometry.dispose();
		this.material.dispose();
		this.sceneRenderTarget.dispose();
	}
}

function readRenderTargetRgbaTopLeft(renderer, renderTarget, width, height) {
	const bottomLeft = new Uint8Array(width * height * 4);
	const topLeft = new Uint8Array(width * height * 4);
	renderer.readRenderTargetPixels(
		renderTarget,
		0,
		0,
		width,
		height,
		bottomLeft
	);

	for (let y = 0; y < height; y += 1) {
		const sourceY = height - y - 1;
		for (let x = 0; x < width; x += 1) {
			const sourceOffset = (sourceY * width + x) * 4;
			const targetOffset = (y * width + x) * 4;
			topLeft[targetOffset] = bottomLeft[sourceOffset];
			topLeft[targetOffset + 1] = bottomLeft[sourceOffset + 1];
			topLeft[targetOffset + 2] = bottomLeft[sourceOffset + 2];
			topLeft[targetOffset + 3] = bottomLeft[sourceOffset + 3];
		}
	}

	return topLeft;
}

function threeNativeDepthSelectedChecks({
	packet,
	debugRgba8,
	maxDistanceMeters,
}) {
	return packet.selectedPixels.map((sample) => {
		const encodedRgba = rgbaAt(debugRgba8, packet.width, sample.x, sample.y);
		const decoded = decodeDepthDistanceDebugRgba({
			rgba: encodedRgba,
			maxDistanceMeters,
		});
		const expectedHit = sample.classification !== 'sky';
		const distanceDeltaMeters =
			expectedHit && decoded.hit
				? Math.abs(decoded.distanceMeters - sample.hitDistanceMeters)
				: null;
		const edgeTolerance =
			expectedHit !== decoded.hit &&
			sample.x > 0 &&
			sample.x < packet.width - 1 &&
			sample.y > 0 &&
			sample.y < packet.height - 1
				? 'possible raster/depth silhouette edge'
				: null;

		return {
			id: sample.id,
			x: sample.x,
			y: sample.y,
			acceptanceRole: THREE_NATIVE_DEPTH_ACCEPTANCE_SAMPLE_IDS.includes(
				sample.id
			)
				? 'gating'
				: 'diagnostic-only',
			classification: sample.classification,
			expectedHit,
			shaderClassifiedHit: decoded.hit,
			expectedDistanceMeters: expectedHit ? sample.hitDistanceMeters : null,
			shaderDistanceMeters: decoded.hit ? decoded.distanceMeters : null,
			distanceDeltaMeters,
			encodedRgba,
			edgeTolerance,
		};
	});
}

function decodeDepthDistanceDebugRgba({ rgba, maxDistanceMeters }) {
	if (rgba[0] === 255 && rgba[1] === 0 && rgba[2] === 255) {
		return {
			hit: false,
			distanceMeters: null,
		};
	}

	const encoded = rgba[0] * 65536 + rgba[1] * 256 + rgba[2];
	return {
		hit: true,
		distanceMeters: (encoded / 16777215) * maxDistanceMeters,
	};
}

function atmosphereParitySelectedChecks({ packet, liveRgba8, oracleRgba8 }) {
	return packet.selectedPixels.map((sample) => {
		const liveRgba = rgbaAt(liveRgba8, packet.width, sample.x, sample.y);
		const oracleRgba = rgbaAt(oracleRgba8, packet.width, sample.x, sample.y);
		const deltas = liveRgba.map((value, index) => value - oracleRgba[index]);
		return {
			id: sample.id,
			x: sample.x,
			y: sample.y,
			acceptanceRole: THREE_NATIVE_DEPTH_ACCEPTANCE_SAMPLE_IDS.includes(
				sample.id
			)
				? 'gating'
				: 'diagnostic-only',
			classification: sample.classification,
			hitDistanceMeters: sample.hitDistanceMeters,
			liveRgba,
			oracleRgba,
			deltas,
			maxAbsRgbDelta: Math.max(
				...deltas.slice(0, 3).map((value) => Math.abs(value))
			),
		};
	});
}

function summarizeRgbaDelta(left, right) {
	const pixelCount = Math.min(left.length, right.length) / 4;
	const rgbDeltas = [];
	let maxAbsRgbDelta = 0;
	let sumAbsRgbDelta = 0;

	for (let index = 0; index < pixelCount; index += 1) {
		const offset = index * 4;
		let pixelMax = 0;
		for (let channel = 0; channel < 3; channel += 1) {
			const delta = Math.abs(left[offset + channel] - right[offset + channel]);
			pixelMax = Math.max(pixelMax, delta);
			sumAbsRgbDelta += delta;
		}
		maxAbsRgbDelta = Math.max(maxAbsRgbDelta, pixelMax);
		rgbDeltas.push(pixelMax);
	}

	const sorted = rgbDeltas.sort((a, b) => a - b);
	return {
		pixelCount,
		maxAbsRgbDelta,
		meanAbsRgbDelta:
			pixelCount > 0 ? sumAbsRgbDelta / (pixelCount * 3) : 0,
		p95AbsRgbDelta:
			sorted.length > 0 ? percentileSorted(sorted, 0.95) : 0,
		p99AbsRgbDelta:
			sorted.length > 0 ? percentileSorted(sorted, 0.99) : 0,
		lengthMismatch: left.length !== right.length,
	};
}

function threeNativeAtmospherePassCriteria({ passMode, results }) {
	const criteria = [
		{
			id: 'live-three-render-target-path',
			status:
				results.length > 0 &&
				results.every(
					(result) =>
						result.renderTarget?.colorTexture &&
						result.renderTarget?.depthTexture
				)
					? 'passed'
					: 'failed',
			measured: results.map((result) => ({
				id: result.id,
				renderTarget: result.renderTarget,
			})),
		},
		{
			id: 'validation-packet-not-normal-input',
			status:
				results.every((result) => result.counts.skyPixels > 0 && result.counts.hitPixels > 0)
					? 'passed'
					: 'failed',
			measured: results.map((result) => ({
				id: result.id,
				counts: result.counts,
			})),
		},
		{
			id: 'camera-resize-coverage',
			status:
				new Set(results.map((result) => `${result.canvas.width}x${result.canvas.height}`)).size >= 2 &&
				results.some(
					(result) => result.camera.cameraAdjustment !== 'none'
				)
					? 'passed'
					: 'failed',
			measured: results.map((result) => ({
				id: result.id,
				canvas: result.canvas,
				camera: result.camera,
			})),
		},
	];

	if (passMode === 'identity') {
		criteria.push(
			{
				id: 'identity-pass-matches-render-target',
				status:
					results.every(
						(result) =>
							result.passthrough.targetVsPassMaxAbsDelta !== null &&
							result.passthrough.targetVsPassMaxAbsDelta <= 1
					)
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					targetVsPassMaxAbsDelta:
						result.passthrough.targetVsPassMaxAbsDelta,
				})),
			},
			{
				id: 'identity-pass-matches-direct-three-render',
				status:
					results.every(
						(result) =>
							result.passthrough.directVsPassMaxAbsDelta !== null &&
							result.passthrough.directVsPassMaxAbsDelta <= 1
					)
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					directVsTargetMaxAbsDelta:
						result.passthrough.directVsTargetMaxAbsDelta,
					directVsPassMaxAbsDelta:
						result.passthrough.directVsPassMaxAbsDelta,
				})),
			}
		);
	} else if (passMode === 'depth-distance') {
		criteria.push(
			{
				id: 'depth-selected-hit-distances-match-raycaster',
				status:
					results.every(
						(result) =>
							(result.depthDiagnostics
								?.maxAcceptanceHitDistanceDeltaMeters ?? 0) <=
							(result.depthDiagnostics?.distanceToleranceMeters ?? 50)
					)
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					distanceToleranceMeters:
						result.depthDiagnostics?.distanceToleranceMeters ?? null,
					acceptanceSampleIds:
						result.depthDiagnostics?.acceptanceSampleIds ?? [],
					maxAcceptanceHitDistanceDeltaMeters:
						result.depthDiagnostics
							?.maxAcceptanceHitDistanceDeltaMeters ?? null,
					maxHitDistanceDeltaMeters:
						result.depthDiagnostics?.maxHitDistanceDeltaMeters ?? null,
					selectedChecks: result.depthDiagnostics?.selectedChecks || [],
				})),
			},
			{
				id: 'depth-selected-classification-matches-raycaster',
				status:
					results.every(
						(result) =>
							(result.depthDiagnostics?.classificationMismatches ?? 0) === 0
					)
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					classificationMismatches:
						result.depthDiagnostics?.classificationMismatches ?? null,
					selectedChecks: result.depthDiagnostics?.selectedChecks || [],
				})),
			}
		);
	} else if (passMode === 'distant-first-order-atmosphere') {
		criteria.push(
			{
				id: 'distant-first-order-oracle-ran',
				status:
					results.every(
						(result) =>
							result.atmosphereParity?.oracleStatus === 'accepted'
					)
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					oracleKind: result.atmosphereParity?.oracleKind || null,
					oracleStatus: result.atmosphereParity?.oracleStatus || null,
					scatteringPolicy:
						result.atmosphereParity?.scatteringPolicy || null,
				})),
			},
			{
				id: 'selected-live-pass-matches-first-order-soft-shader',
				status:
					results.every((result) => {
						const gatingChecks =
							result.atmosphereParity?.selectedChecks?.filter(
								(check) => check.acceptanceRole === 'gating'
							) || [];
						return (
							gatingChecks.length >= 3 &&
							Math.max(
								0,
								...gatingChecks.map((check) => check.maxAbsRgbDelta)
							) <= 3
						);
					})
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					maxSelectedRgbDelta:
						result.atmosphereParity?.maxSelectedRgbDelta ?? null,
					selectedChecks:
						result.atmosphereParity?.selectedChecks || [],
				})),
			},
			{
				id: 'full-image-delta-recorded',
				status:
					results.every(
						(result) =>
							result.atmosphereParity?.imageDeltaSummary &&
							!result.atmosphereParity.imageDeltaSummary.lengthMismatch
					)
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					imageDeltaSummary:
						result.atmosphereParity?.imageDeltaSummary || null,
				})),
			},
			{
				id: 'source-light-and-shader-config-agree',
				status:
					results.every(
						(result) =>
							result.sceneLight?.sourceLightAgreement
								?.lightTravelDirectionDelta <= 1e-6
					)
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					sceneLight: result.sceneLight,
				})),
			}
		);
	} else if (passMode === 'flat-local-first-order-atmosphere') {
		const closest = results.find((result) => result.sourcePacket?.offsetDegrees === 0);
		const ninety = results.find((result) => result.sourcePacket?.offsetDegrees === 90);
		criteria.push(
			{
				id: 'local-first-order-oracle-ran',
				status:
					results.every(
						(result) =>
							result.atmosphereParity?.oracleStatus === 'accepted'
					)
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					oracleKind: result.atmosphereParity?.oracleKind || null,
					oracleStatus: result.atmosphereParity?.oracleStatus || null,
					scatteringPolicy:
						result.atmosphereParity?.scatteringPolicy || null,
				})),
			},
			{
				id: 'selected-live-pass-matches-local-soft-shader',
				status:
					results.every((result) => {
						const gatingChecks =
							result.atmosphereParity?.selectedChecks?.filter(
								(check) => check.acceptanceRole === 'gating'
							) || [];
						return (
							gatingChecks.length >= 3 &&
							Math.max(
								0,
								...gatingChecks.map((check) => check.maxAbsRgbDelta)
							) <= 3
						);
					})
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					maxSelectedRgbDelta:
						result.atmosphereParity?.maxSelectedRgbDelta ?? null,
					selectedChecks:
						result.atmosphereParity?.selectedChecks || [],
				})),
			},
			{
				id: 'source-driven-point-light-used',
				status:
					results.every(
						(result) =>
							result.sourcePacket?.kind === 'flat-local-point-sun' &&
							result.sceneLight?.mode === 'flat-local-point-sun'
					)
						? 'passed'
						: 'failed',
				measured: results.map((result) => ({
					id: result.id,
					sourcePacket: result.sourcePacket,
					sceneLight: result.sceneLight,
				})),
			},
			{
				id: 'closest-brighter-than-090deg',
				status:
					closest &&
					ninety &&
					closest.passthrough.outputSummary.meanLuminance >
						ninety.passthrough.outputSummary.meanLuminance
						? 'passed'
						: 'failed',
				measured: {
					closest: closest
						? {
								id: closest.id,
								meanLuminance:
									closest.passthrough.outputSummary.meanLuminance,
								source: closest.sourcePacket,
							}
						: null,
					ninety: ninety
						? {
								id: ninety.id,
								meanLuminance:
									ninety.passthrough.outputSummary.meanLuminance,
								source: ninety.sourcePacket,
							}
						: null,
				},
			},
			{
				id: 'local-first-order-scope-recorded',
				status: 'passed',
				measured: {
					localSecondOrder: 'unsupported in this POC milestone',
					localSolarDiscCameraRadiance: 'unsupported',
					localGroundBounce: 'unsupported',
				},
			}
		);
	}

	return criteria;
}

function summarizeCriteria(criteria) {
	return {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};
}

function maxFinite(values) {
	const finite = values.filter((value) => Number.isFinite(value));
	return finite.length > 0 ? Math.max(...finite) : 0;
}

function threeNativePassModeCode(mode) {
	if (mode === 'depth-distance') {
		return 1;
	}
	if (mode === 'distant-first-order-atmosphere') {
		return 2;
	}
	if (mode === 'flat-local-first-order-atmosphere') {
		return 3;
	}
	return 0;
}

function debugViewModeCode(debugView) {
	if (debugView === 'transmittance') {
		return 1;
	}
	if (debugView === 'path-radiance') {
		return 2;
	}
	return 0;
}

function sourceSunDirectionForPassConfig(config) {
	const source = config?.source;
	if (source?.kind === 'distant-directional-sun' && source.sunDirection) {
		return source.sunDirection;
	}
	return sunDirection(DIRECT_RADIANCE_SUN_CASE);
}

function localSourcePositionForPassConfig(config) {
	const source = config?.source;
	if (source?.kind === 'flat-local-point-sun' && source.positionMeters) {
		return source.positionMeters;
	}
	return [0, 0, 1];
}

function makeSphericalAtmosphereGeometryPacket() {
	return {
		kind: 'spherical-atmosphere-geometry',
		bottomRadiusMeters: ATMOSPHERE.bottomRadiusMeters,
		topRadiusMeters: ATMOSPHERE.topRadiusMeters,
		threeToAlgorithmDirection: '[x, y, z] -> [x, -z, y]',
		threeToAlgorithmPosition: '[x, y, z] -> [x, -z, bottomRadiusMeters + y]',
		noHitDistancePolicy:
			'sky/no-hit rays use the spherical top-atmosphere boundary in the atmosphere shader; this milestone only validates depth clear classification.',
	};
}

function makeFlatAtmosphereGeometryPacket() {
	return {
		kind: 'flat-z-up-atmosphere',
		observerPositionMeters: [0, 0, 2],
		topAltitudeMeters: 100000,
		sceneSkyRayLimitMeters: 1926774,
		sceneSkyRayLimitPolicy:
			'accepted-062-flat-visibility-100-percent-lost-poc-default',
		threeToAlgorithmDirection: '[x, y, z] -> [x, -z, y]',
		threeToAlgorithmPosition: '[x, y, z] -> [x, -z, y]',
	};
}

function makeFlatLocalSunSourcePacket(offsetDegrees) {
	const cases = {
		0: {
			id: 'san-jose-000deg-closest-algorithm32-flat-cap-first-order',
			flatSceneKey: 'san-jose-000deg-closest',
			role: 'closest-approach',
			positionMeters: [-1259333.1191633441, -783448.107576714, 4828003.52],
			observerIncidentScale: 1,
		},
		90: {
			id: 'san-jose-090deg-from-closest-algorithm32-flat-cap-first-order',
			flatSceneKey: 'san-jose-090deg-from-closest',
			role: '90-degree-orbit-offset',
			positionMeters: [
				1095438.1966602097,
				9324629.516453793,
				4828003.5200000005,
			],
			observerIncidentScale: 0.22886864160388085,
		},
	};
	const selected = cases[offsetDegrees] || cases[0];
	return {
		kind: 'flat-local-point-sun',
		id: selected.id,
		sunCase: selected.id,
		sceneKey: selected.id,
		flatSceneKey: selected.flatSceneKey,
		offsetDegrees,
		role: selected.role,
		positionMeters: selected.positionMeters,
		observerPositionMeters: [0, 0, 2],
		radiusKm: 25.749504,
		referenceDistanceKm: 4800,
		referenceSpectralIncidentScale: 1.1071748923354825,
		observerIncidentScale: selected.observerIncidentScale,
		distanceFalloff: true,
		color: {
			r: 1,
			g: 0.98,
			b: 0.95,
		},
		provenance: {
			sourceArtifact:
				'tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes',
			calibratedSolarIrradianceScale: 1.1071748923354825,
			brightnessCalibration:
				'match-distant-solar-noon-unit-incident-scale-at-closest-approach',
		},
	};
}

function createBaselineScene(canvas, options = {}) {
	canvas.width = options.width || 640;
	canvas.height = options.height || 320;

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		preserveDrawingBuffer: true,
	});
	renderer.setSize(canvas.width, canvas.height, false);
	renderer.setPixelRatio(1);
	renderer.setClearColor(0x87a9d8, 1);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87a9d8);
	const camera = new THREE.PerspectiveCamera(
		52,
		canvas.width / canvas.height,
		0.1,
		150000
	);
	camera.position.set(0, 2, 0);
	camera.lookAt(new THREE.Vector3(0, 420, -5000));
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	const meshes = [];
	const cards = [];
	for (const definition of baselineCardDefinitions()) {
		const geometry = new THREE.PlaneGeometry(definition.width, definition.height);
		const material = new THREE.MeshBasicMaterial({
			color: definition.materialColor,
			side: THREE.FrontSide,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.name = definition.id;
		mesh.position.copy(definition.center);
		mesh.userData = {
			kind: 'card',
			spectrumId: definition.spectrumId,
		};
		mesh.updateMatrixWorld(true);
		scene.add(mesh);
		meshes.push(mesh);
		cards.push({
			id: definition.id,
			spectrumId: definition.spectrumId,
			centerMeters: vectorToArray(definition.center),
			widthMeters: definition.width,
			heightMeters: definition.height,
			materialColor: definition.materialColor,
		});
	}

	const groundGeometry = new THREE.PlaneGeometry(120000, 120000);
	const groundMaterial = new THREE.MeshBasicMaterial({
		color: 0x344038,
		side: THREE.DoubleSide,
	});
	const ground = new THREE.Mesh(groundGeometry, groundMaterial);
	ground.name = 'ground-plane';
	ground.rotation.x = -Math.PI / 2;
	ground.position.set(0, 0, -30000);
	ground.userData = {
		kind: 'ground',
		spectrumId: 'ground',
	};
	ground.updateMatrixWorld(true);
	scene.add(ground);
	meshes.push(ground);

	return {
		renderer,
		scene,
		camera,
		meshes,
		cards,
		ground: {
			id: ground.name,
			kind: ground.userData.kind,
			spectrumId: ground.userData.spectrumId,
			positionMeters: vectorToArray(ground.position),
		},
	};
}

function baselineCardDefinitions() {
	return [
		{
			id: 'near-red-card',
			spectrumId: 'red',
			center: new THREE.Vector3(-260, 130, -1000),
			width: 260,
			height: 260,
			materialColor: 0xcc2936,
		},
		{
			id: 'middle-green-card',
			spectrumId: 'green',
			center: new THREE.Vector3(0, 440, -5000),
			width: 900,
			height: 900,
			materialColor: 0x3a8f43,
		},
		{
			id: 'far-blue-card',
			spectrumId: 'blue',
			center: new THREE.Vector3(5200, 1800, -22000),
			width: 3600,
			height: 3600,
			materialColor: 0x2b68c0,
		},
	];
}

function createShadowCardFloorScene(canvas, options = {}) {
	canvas.width = options.width || 160;
	canvas.height = options.height || 90;

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		preserveDrawingBuffer: true,
	});
	renderer.setSize(canvas.width, canvas.height, false);
	renderer.setPixelRatio(1);
	renderer.setClearColor(0x87a9d8, 1);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	if ('toneMapping' in renderer) {
		renderer.toneMapping = THREE.NoToneMapping;
	}

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87a9d8);
	const camera = new THREE.PerspectiveCamera(
		48,
		canvas.width / canvas.height,
		0.1,
		50000
	);
	camera.position.set(0, 160, 650);
	camera.lookAt(new THREE.Vector3(0, 90, -1200));
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	const ambient = new THREE.AmbientLight(0xffffff, 0.18);
	scene.add(ambient);
	const sceneLightConfig =
		options.sceneLightConfig || makeHardcodedSceneLightConfig();
	const sunLight = new THREE.DirectionalLight(
		sceneLightConfig.color ?? 0xffffff,
		sceneLightConfig.intensity
	);
	sunLight.position.fromArray(sceneLightConfig.positionMeters);
	sunLight.target.position.fromArray(sceneLightConfig.targetMeters);
	sunLight.castShadow = true;
	sunLight.shadow.mapSize.width = 1024;
	sunLight.shadow.mapSize.height = 1024;
	sunLight.shadow.camera.near = 10;
	sunLight.shadow.camera.far = 5000;
	sunLight.shadow.camera.left = -1600;
	sunLight.shadow.camera.right = 1600;
	sunLight.shadow.camera.top = 1600;
	sunLight.shadow.camera.bottom = -1600;
	scene.add(sunLight);
	scene.add(sunLight.target);

	const meshes = [];
	const sceneObjects = [];
	const floorGeometry = new THREE.PlaneGeometry(3600, 4200);
	const floorMaterial = new THREE.MeshStandardMaterial({
		color: 0x3a513c,
		roughness: 0.9,
		metalness: 0,
		side: THREE.DoubleSide,
	});
	const ground = new THREE.Mesh(floorGeometry, floorMaterial);
	ground.name = 'shadow-floor';
	ground.rotation.x = -Math.PI / 2;
	ground.position.set(0, 0, -1450);
	ground.receiveShadow = true;
	ground.userData = {
		kind: 'ground',
		spectrumId: 'ground',
	};
	ground.updateMatrixWorld(true);
	scene.add(ground);
	meshes.push(ground);

	const blockGeometry = new THREE.BoxGeometry(360, 360, 360);
	const blockMaterial = new THREE.MeshStandardMaterial({
		color: 0x9f3b35,
		roughness: 0.72,
		metalness: 0,
	});
	const block = new THREE.Mesh(blockGeometry, blockMaterial);
	block.name = 'shadow-red-block';
	block.position.set(-180, 180, -1120);
	block.castShadow = true;
	block.receiveShadow = true;
	block.userData = {
		kind: 'card',
		spectrumId: 'red',
	};
	block.updateMatrixWorld(true);
	scene.add(block);
	meshes.push(block);

	const blueGeometry = new THREE.PlaneGeometry(620, 420);
	const blueMaterial = new THREE.MeshStandardMaterial({
		color: 0x2b68c0,
		roughness: 0.8,
		metalness: 0,
		side: THREE.FrontSide,
	});
	const blueCard = new THREE.Mesh(blueGeometry, blueMaterial);
	blueCard.name = 'lit-blue-card';
	blueCard.position.set(560, 240, -1800);
	blueCard.castShadow = true;
	blueCard.receiveShadow = true;
	blueCard.userData = {
		kind: 'card',
		spectrumId: 'blue',
	};
	blueCard.updateMatrixWorld(true);
	scene.add(blueCard);
	meshes.push(blueCard);

	for (const mesh of meshes) {
		sceneObjects.push({
			id: mesh.name,
			kind: mesh.userData.kind,
			spectrumId: mesh.userData.spectrumId,
			positionMeters: vectorToArray(mesh.position),
			castShadow: mesh.castShadow === true,
			receiveShadow: mesh.receiveShadow === true,
		});
	}

	return {
		renderer,
		scene,
		camera,
		meshes,
		sceneObjects,
		ground: {
			id: ground.name,
			kind: ground.userData.kind,
			spectrumId: ground.userData.spectrumId,
			positionMeters: vectorToArray(ground.position),
			receiveShadow: true,
		},
		lights: {
			ambientIntensity: ambient.intensity,
			directionalIntensity: sunLight.intensity,
			directionalPositionMeters: vectorToArray(sunLight.position),
			directionalTargetMeters: vectorToArray(sunLight.target.position),
		},
		sceneLightPacket: {
			...sceneLightConfig,
			ambientIntensity: ambient.intensity,
			actualDirectionalPositionMeters: vectorToArray(sunLight.position),
			actualDirectionalTargetMeters: vectorToArray(sunLight.target.position),
		},
	};
}

function makeHardcodedSceneLightConfig() {
	const positionMeters = [-900, 1600, 800];
	const targetMeters = [0, 0, -1200];
	const lightTravelDirectionThree = normalize(
		subtractArrays(targetMeters, positionMeters)
	);
	return {
		kind: 'hardcoded-browser-directional-light',
		mode: 'hardcoded-browser-light',
		color: 0xffffff,
		colorRgb: [1, 1, 1],
		intensity: 2.4,
		calibrationScalar: 2.4,
		positionMeters,
		targetMeters,
		lightTravelDirectionThree,
		directionConvention:
			'DirectionalLight travels from position toward target; this legacy light is not derived from the Algorithm32 source packet.',
	};
}

function makeDistantSunSceneLightConfig({ sunCase }) {
	const sourceDirectionAlgorithm = sunDirection(sunCase);
	const directionToSourceThree = algorithmDirectionToThreeArray(
		sourceDirectionAlgorithm
	);
	const targetMeters = [0, 0, -1200];
	const distanceMeters = 3200;
	const positionMeters = addArrays(
		targetMeters,
		directionToSourceThree.map((value) => value * distanceMeters)
	);
	const lightTravelDirectionThree = normalize(
		subtractArrays(targetMeters, positionMeters)
	);
	const sourceLightAgreement = {
		expectedLightTravelDirectionThree: directionToSourceThree.map(
			(value) => -value
		),
		lightTravelDirectionDelta: maxAbsArrayDelta(
			lightTravelDirectionThree,
			directionToSourceThree.map((value) => -value)
		),
		directionToSourceThree,
	};

	return {
		kind: 'source-driven-distant-directional-light',
		mode: 'distant-directional-sun',
		sunCase: sunCase.id,
		color: 0xffffff,
		colorRgb: [1, 1, 1],
		intensity: 2.4,
		calibrationScalar: 2.4,
		calibrationPolicy:
			'Milestone 16 keeps the accepted Milestone 13 high-Sun intensity scalar while deriving direction from the source packet.',
		positionMeters,
		targetMeters,
		sourceDirectionAlgorithm,
		directionToSourceThree,
		lightTravelDirectionThree,
		sourceLightAgreement,
		directionConvention:
			'Algorithm32 sunDirection points from sample toward Sun. Three DirectionalLight travels from position toward target, so lightTravelDirectionThree must equal -directionToSourceThree.',
	};
}

function resolveDistantSunCase(sunCaseInput) {
	if (sunCaseInput && typeof sunCaseInput === 'object') {
		return sunCaseInput;
	}
	if (sunCaseInput === LOW_SUN_CASE.id) {
		return LOW_SUN_CASE;
	}
	return DIRECT_RADIANCE_SUN_CASE;
}

function makeDistantSunSourcePacket(sunCase) {
	return {
		kind: 'distant-directional-sun',
		sunCase: sunCase.id,
		sunDirection: sunDirection(sunCase),
		sourceTimeOfDay: sunCase.sourceTimeOfDay || null,
		sourceSunZenithDegrees: sunCase.sourceSunZenithDegrees || null,
		sunAltitudeDegrees: sunCase.sunAltitudeDegrees,
		sunAzimuthDegrees: sunCase.sunAzimuthDegrees,
	};
}

function captureSceneInputPacket({
	captureId,
	sceneMode,
	sceneColorPolicy,
	canvas,
	renderer,
	camera,
	meshes,
	sceneObjects,
	ground,
	sourcePacket,
	sceneLightPacket,
	geometryPacket,
	sceneDetailPacket,
}) {
	const width = canvas.width;
	const height = canvas.height;
	const sceneColorRgba8 = readCanvasRgbaTopLeft(renderer, width, height);
	const raycaster = new THREE.Raycaster();
	const hitDistanceMeters = new Array(width * height);
	const hitMask = new Array(width * height);
	const spectrumNumericIds = new Array(width * height);
	const rayDirections = new Array(width * height * 3);
	const classificationIds = new Array(width * height);
	const selectedCandidates = [];
	const countsBySpectrumId = new Map();
	const countsByClassification = new Map();
	let skyPixels = 0;
	let hitPixels = 0;
	let minHitDistanceMeters = Number.POSITIVE_INFINITY;
	let maxHitDistanceMeters = 0;
	let darkestGround = null;
	let brightestGround = null;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelIndex = y * width + x;
			const ndc = pixelToNdc(x, y, width, height);
			raycaster.setFromCamera(ndc, camera);
			const ray = raycaster.ray.clone();
			const hit = firstSceneInputHit(raycaster, meshes);
			const rgba = Array.from(
				sceneColorRgba8.slice(pixelIndex * 4, pixelIndex * 4 + 4)
			);
			const luminance = rgba[0] * 0.2126 + rgba[1] * 0.7152 + rgba[2] * 0.0722;

			rayDirections[pixelIndex * 3] = ray.direction.x;
			rayDirections[pixelIndex * 3 + 1] = ray.direction.y;
			rayDirections[pixelIndex * 3 + 2] = ray.direction.z;

			if (hit) {
				const spectrumId = hit.object.userData?.spectrumId || 'unknown';
				const numericSpectrumId = spectrumNumericId(spectrumId);
				const classification = hit.object.userData?.kind || 'object';
				hitDistanceMeters[pixelIndex] = hit.distance;
				hitMask[pixelIndex] = 1;
				spectrumNumericIds[pixelIndex] = numericSpectrumId;
				classificationIds[pixelIndex] = classification;
				hitPixels += 1;
				minHitDistanceMeters = Math.min(minHitDistanceMeters, hit.distance);
				maxHitDistanceMeters = Math.max(maxHitDistanceMeters, hit.distance);
				countsBySpectrumId.set(
					numericSpectrumId,
					(countsBySpectrumId.get(numericSpectrumId) || 0) + 1
				);
				countsByClassification.set(
					classification,
					(countsByClassification.get(classification) || 0) + 1
				);

				if (classification === 'ground') {
					const sample = makeSceneInputSample({
						id: luminance < 80 ? 'shadow-candidate' : 'lit-candidate',
						x,
						y,
						ndc,
						ray,
						hit,
						rgba,
						luminance,
					});
					if (!darkestGround || luminance < darkestGround.luminance) {
						darkestGround = sample;
					}
					if (!brightestGround || luminance > brightestGround.luminance) {
						brightestGround = sample;
					}
				}
			} else {
				hitDistanceMeters[pixelIndex] = -1;
				hitMask[pixelIndex] = 0;
				spectrumNumericIds[pixelIndex] = 0;
				classificationIds[pixelIndex] = 'sky';
				skyPixels += 1;
			}
		}
	}

	selectedCandidates.push(
		sceneInputSampleAt({
			id: 'upper-sky',
			x: Math.floor(width * 0.5),
			y: Math.floor(height * 0.16),
			width,
			height,
			camera,
			meshes,
			sceneColorRgba8,
		}),
		sceneInputSampleAt({
			id: 'center',
			x: Math.floor(width * 0.5),
			y: Math.floor(height * 0.5),
			width,
			height,
			camera,
			meshes,
			sceneColorRgba8,
		}),
		sceneInputSampleAt({
			id: 'lower-center',
			x: Math.floor(width * 0.5),
			y: Math.floor(height * 0.78),
			width,
			height,
			camera,
			meshes,
			sceneColorRgba8,
		})
	);
	if (darkestGround) {
		selectedCandidates.push({ ...darkestGround, id: 'darkest-ground' });
	}
	if (brightestGround) {
		selectedCandidates.push({ ...brightestGround, id: 'brightest-ground' });
	}

	const selectedPixels = dedupeSceneInputSamples(selectedCandidates);
	const shadowCheck =
		darkestGround && brightestGround
			? {
					status:
						brightestGround.luminance - darkestGround.luminance >= 8
							? 'accepted'
							: 'rejected',
					darkestGround,
					brightestGround,
					luminanceDelta:
						brightestGround.luminance - darkestGround.luminance,
				}
			: {
					status: 'rejected',
					reason: 'Did not find both darkest and brightest ground samples.',
				};

	return {
		kind: 'algorithm32-browser-scene-input-packet',
		version: 1,
		captureId,
		sceneMode,
		sceneColorPolicy,
		width,
		height,
		rowOrder: 'top-left-row-major',
		colorEncoding: 'rgba8-no-tonemapping-recorded',
		distanceUnits: 'meters',
		hitMaskMeaning: '1 = raycaster hit, 0 = sky/no-hit',
		camera: {
			type: 'THREE.PerspectiveCamera',
			positionMeters: vectorToArray(camera.position),
			verticalFovDegrees: camera.fov,
			aspect: camera.aspect,
			near: camera.near,
			far: camera.far,
			projectionMatrix: camera.projectionMatrix.toArray(),
			matrixWorld: camera.matrixWorld.toArray(),
		},
		source: sourcePacket || makeDistantSunSourcePacket(DIRECT_RADIANCE_SUN_CASE),
		sceneLight: sceneLightPacket || null,
		geometry: geometryPacket || {
			kind: 'spherical-atmosphere-geometry',
			threeToAlgorithmDirection: '[x, y, z] -> [x, -z, y]',
			threeToAlgorithmPosition:
				'[x, y, z] -> [x, -z, bottomRadiusMeters + y]',
		},
		sceneObjects,
		ground,
		sceneDetail: sceneDetailPacket || null,
		spectrumNumericIdMap: {
			0: null,
			1: 'red',
			2: 'green',
			3: 'blue',
			4: 'ground',
			5: 'mountainRidgeGreen',
		},
		sceneColorRgba8: Array.from(sceneColorRgba8),
		hitDistanceMeters,
		hitMask,
		spectrumNumericIds,
		rayDirections,
		counts: {
			skyPixels,
			hitPixels,
			bySpectrumNumericId: Object.fromEntries(
				[...countsBySpectrumId.entries()].sort((a, b) => a[0] - b[0])
			),
			byClassification: Object.fromEntries(
				[...countsByClassification.entries()].sort((a, b) =>
					String(a[0]).localeCompare(String(b[0]))
				)
			),
		},
		hitDistanceMetersSummary: {
			min: hitPixels > 0 ? minHitDistanceMeters : null,
			max: hitPixels > 0 ? maxHitDistanceMeters : null,
		},
		selectedPixels,
		shadowCheck,
		knownLimitations: [
			'First POC uses JSON-carried RGBA8 scene color rather than HDR or float attachments.',
			'The CPU postprocessor owns spectral Algorithm32 transport; lit RGB scene composition is a display-domain approximation until shader/HDR packet work.',
		],
	};
}

function readCanvasRgbaTopLeft(renderer, width, height) {
	const gl = renderer.getContext();
	const bottomLeft = new Uint8Array(width * height * 4);
	const topLeft = new Uint8Array(width * height * 4);
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bottomLeft);

	for (let y = 0; y < height; y += 1) {
		const sourceY = height - y - 1;
		for (let x = 0; x < width; x += 1) {
			const sourceOffset = (sourceY * width + x) * 4;
			const targetOffset = (y * width + x) * 4;
			topLeft[targetOffset] = bottomLeft[sourceOffset];
			topLeft[targetOffset + 1] = bottomLeft[sourceOffset + 1];
			topLeft[targetOffset + 2] = bottomLeft[sourceOffset + 2];
			topLeft[targetOffset + 3] = bottomLeft[sourceOffset + 3];
		}
	}

	return topLeft;
}

function sceneInputSampleAt({
	id,
	x,
	y,
	width,
	height,
	camera,
	meshes,
	sceneColorRgba8,
}) {
	const raycaster = new THREE.Raycaster();
	const ndc = pixelToNdc(x, y, width, height);
	raycaster.setFromCamera(ndc, camera);
	const ray = raycaster.ray.clone();
	const hit = firstSceneInputHit(raycaster, meshes);
	const offset = (y * width + x) * 4;
	const rgba = Array.from(sceneColorRgba8.slice(offset, offset + 4));
	const luminance = rgba[0] * 0.2126 + rgba[1] * 0.7152 + rgba[2] * 0.0722;

	return makeSceneInputSample({
		id,
		x,
		y,
		ndc,
		ray,
		hit,
		rgba,
		luminance,
	});
}

function makeSceneInputSample({ id, x, y, ndc, ray, hit, rgba, luminance }) {
	return {
		id,
		x,
		y,
		ndc,
		rgba,
		luminance,
		classification: hit ? hit.object.userData.kind : 'sky',
		hitObject: hit?.object?.name || null,
		spectrumId: hit?.object?.userData?.spectrumId || null,
		spectrumNumericId: hit
			? spectrumNumericId(hit.object.userData?.spectrumId)
			: 0,
		hitDistanceMeters: hit?.distance || null,
		threeRay: {
			origin: vectorToArray(ray.origin),
			direction: vectorToArray(ray.direction),
		},
	};
}

function dedupeSceneInputSamples(samples) {
	const seen = new Set();
	const result = [];

	for (const sample of samples.filter(Boolean)) {
		const key = `${sample.x},${sample.y},${sample.id}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		result.push(sample);
	}

	return result;
}

function firstSceneInputHit(raycaster, meshes) {
	const hits = raycaster.intersectObjects(meshes, false);
	return hits.length > 0 ? hits[0] : null;
}

function litSceneInputCaptureDiagnostics({ command, width, height, captures }) {
	const unlit = captures.unlitMaterialControl;
	const lit = captures.litShadowScene;
	const criteria = [
		{
			id: 'unlit-packet-has-sky-and-hit',
			status:
				unlit.counts.skyPixels > 0 && unlit.counts.hitPixels > 0
					? 'passed'
					: 'failed',
			measured: unlit.counts,
		},
		{
			id: 'lit-packet-has-sky-and-hit',
			status:
				lit.counts.skyPixels > 0 && lit.counts.hitPixels > 0
					? 'passed'
					: 'failed',
			measured: lit.counts,
		},
		{
			id: 'lit-shadow-luminance-separation',
			status: lit.shadowCheck.status === 'accepted' ? 'passed' : 'failed',
			measured: lit.shadowCheck,
		},
		{
			id: 'packet-dimensions',
			status:
				unlit.width === width &&
				unlit.height === height &&
				lit.width === width &&
				lit.height === height
					? 'passed'
					: 'failed',
			measured: {
				expected: { width, height },
				unlit: { width: unlit.width, height: unlit.height },
				lit: { width: lit.width, height: lit.height },
			},
		},
	];
	const summary = {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};

	return {
		kind: 'browser-lit-scene-input-capture-diagnostics',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		iteration: command?.payload?.iteration ||
			'13-browser-lit-scene-input-cpu-postprocessor',
		goal:
			'Capture browser scene-color plus hit/ray packets for CPU Algorithm32 postprocessing, including an unlit control and a lit shadow scene.',
		commandPayload: command?.payload || null,
		threeRevision: THREE.REVISION,
		width,
		height,
		captures,
		criteria,
		summary,
	};
}

function softShaderPacketPassthroughDiagnostics({
	command,
	packet,
	shaderResult,
	selectedChecks,
	maxAbsDelta,
}) {
	const criteria = [
		{
			id: 'scene-color-passthrough-exact',
			status: maxAbsDelta === 0 ? 'passed' : 'failed',
			measured: { maxAbsDelta },
		},
		{
			id: 'packet-has-sky-and-hit',
			status:
				packet.counts.skyPixels > 0 && packet.counts.hitPixels > 0
					? 'passed'
					: 'failed',
			measured: packet.counts,
		},
		{
			id: 'selected-samples-match',
			status: selectedChecks.every((sample) => sample.maxAbsRgbDelta === 0)
				? 'passed'
				: 'failed',
			measured: selectedChecks.map((sample) => ({
				id: sample.id,
				classification: sample.classification,
				maxAbsRgbDelta: sample.maxAbsRgbDelta,
				expectedRgba: sample.expectedRgba,
				shaderRgba: sample.shaderRgba,
			})),
		},
		{
			id: 'packet-contract-recorded',
			status:
				packet.rowOrder === 'top-left-row-major' &&
				packet.distanceUnits === 'meters' &&
				packet.hitMaskMeaning === '1 = raycaster hit, 0 = sky/no-hit'
					? 'passed'
					: 'failed',
			measured: {
				rowOrder: packet.rowOrder,
				distanceUnits: packet.distanceUnits,
				hitMaskMeaning: packet.hitMaskMeaning,
				textureInputs: shaderResult.textureInputs,
			},
		},
	];
	const summary = {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};

	return {
		kind: 'browser-soft-shader-packet-passthrough-diagnostics',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		iteration: command?.payload?.iteration ||
			'21-gpu-packet-input-parity-no-atmosphere-passthrough',
		goal:
			'Upload the browser scene-color packet to a GPU fullscreen pass and verify no-atmosphere passthrough before shader-side Algorithm32 transport.',
		commandPayload: command?.payload || null,
		threeRevision: THREE.REVISION,
		webgl: shaderResult.webgl,
		packetSummary: {
			width: packet.width,
			height: packet.height,
			captureId: packet.captureId,
			sceneMode: packet.sceneMode,
			sceneColorPolicy: packet.sceneColorPolicy,
			counts: packet.counts,
			source: packet.source,
			sceneLight: packet.sceneLight,
			geometry: packet.geometry,
		},
		maxAbsDelta,
		selectedChecks,
		criteria,
		summary,
	};
}

function packetDrivenDistantSunShaderDiagnostics({
	command,
	canvas,
	camera,
	cards,
	ground,
	sourcePacket,
	sunCase,
	selectedPixels,
	imageShaderDiagnostics,
	secondOrderRadianceSpectralDiagnostics,
	selectedDisplayChecks,
	sceneInputTextureData,
	outputRgba8,
}) {
	const maxSelectedRgbDelta = Math.max(
		0,
		...selectedDisplayChecks.map((item) => item.maxAbsRgbDelta)
	);
	const shaderSunRay = imageShaderDiagnostics?.sunRay || null;
	const hasShaderSunRay =
		Array.isArray(shaderSunRay) && shaderSunRay.length === sourcePacket.sunDirection.length;
	const sunUniformDelta = hasShaderSunRay
		? maxAbsArrayDelta(shaderSunRay, sourcePacket.sunDirection)
		: Number.POSITIVE_INFINITY;
	const selectedSunCases = secondOrderRadianceSpectralDiagnostics.map(
		(item) => item.sunCase.id
	);
	const criteria = [
		{
			id: 'shader-render-accepted',
			status: imageShaderDiagnostics?.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				status: imageShaderDiagnostics?.status || null,
				scatteringPolicy: imageShaderDiagnostics?.scatteringPolicy || null,
			},
		},
		{
			id: 'source-packet-drives-sun-uniform',
			status: hasShaderSunRay && sunUniformDelta <= 1e-6 ? 'passed' : 'failed',
			measured: {
				sourceSunCase: sourcePacket.sunCase,
				sourceSunDirection: sourcePacket.sunDirection,
				shaderSunRay,
				maxAbsDelta: sunUniformDelta,
			},
		},
		{
			id: 'selected-cpu-preview-uses-same-sun-case',
			status: selectedSunCases.every((id) => id === sunCase.id)
				? 'passed'
				: 'failed',
			measured: {
				expectedSunCase: sunCase.id,
				selectedSunCases,
			},
		},
		{
			id: 'selected-display-parity',
			status: maxSelectedRgbDelta <= 2 ? 'passed' : 'failed',
			measured: {
				maxSelectedRgbDelta,
				selectedDisplayChecks,
			},
		},
		{
			id: 'scene-input-texture-has-sky-and-hit',
			status:
				sceneInputTextureData?.counts?.skyPixels > 0 &&
				sceneInputTextureData?.counts?.hitPixels > 0
					? 'passed'
					: 'failed',
			measured: sceneInputTextureData?.counts || null,
		},
	];
	const summary = {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};

	return {
		kind: 'browser-packet-driven-distant-sun-shader-diagnostics',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		iteration: command?.payload?.iteration ||
			'22-packet-driven-distant-sun-shader',
		goal:
			'Render the existing second-order scene-input atmosphere shader from an explicit distant-Sun source packet instead of an implicit default Sun.',
		commandPayload: command?.payload || null,
		threeRevision: THREE.REVISION,
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		camera: {
			type: 'THREE.PerspectiveCamera',
			positionMeters: vectorToArray(camera.position),
			lookAtMeters: [0, 420, -5000],
			verticalFovDegrees: camera.fov,
			aspect: camera.aspect,
			near: camera.near,
			far: camera.far,
		},
		sceneObjects: cards,
		ground,
		sourcePacket,
		imageShaderDiagnostics,
		sceneInputTexture: {
			width: sceneInputTextureData.width,
			height: sceneInputTextureData.height,
			policy: sceneInputTextureData.policy,
			channels: sceneInputTextureData.channels,
			counts: sceneInputTextureData.counts,
			hitDistanceMeters: sceneInputTextureData.hitDistanceMeters,
			textureRowOrder:
				'bottom-left rows for WebGL texelFetch compatibility; packet/display summaries remain top-left row-major',
		},
		secondOrderRadianceSpectralSummary:
			summarizeSecondOrderRadianceSpectralDiagnostics(
				secondOrderRadianceSpectralDiagnostics
			),
		selectedDisplayChecks,
		maxSelectedRgbDelta,
		outputSummary: summarizeRgba8(outputRgba8),
		criteria,
		summary,
	};
}

function litSceneSoftShaderCompositionDiagnostics({
	command,
	packet,
	passthroughResult,
	atmosphereResult,
	passthroughMaxAbsDelta,
	selectedChecks,
	shadowCheck,
	skyReplacementCheck,
}) {
	const maxSelectedRgbDelta = Math.max(
		0,
		...selectedChecks.map((item) => item.maxAbsRgbDelta)
	);
	const criteria = [
		{
			id: 'no-atmosphere-passthrough-exact',
			status: passthroughMaxAbsDelta === 0 ? 'passed' : 'failed',
			measured: { maxAbsDelta: passthroughMaxAbsDelta },
		},
		{
			id: 'atmosphere-shader-run-accepted',
			status:
				atmosphereResult.imageShaderDiagnostics?.status === 'accepted'
					? 'passed'
					: 'failed',
			measured: {
				status: atmosphereResult.imageShaderDiagnostics?.status || null,
				composeSceneColor:
					atmosphereResult.imageShaderDiagnostics?.composeSceneColor || false,
				textureInputs: atmosphereResult.textureInputs,
			},
		},
		{
			id: 'shadow-separation-preserved',
			status: shadowCheck.status === 'accepted' ? 'passed' : 'failed',
			measured: shadowCheck,
		},
		{
			id: 'sky-replaced-by-atmosphere',
			status: skyReplacementCheck.status === 'accepted' ? 'passed' : 'failed',
			measured: skyReplacementCheck,
		},
		{
			id: 'selected-diagnostics-match-preview',
			status: maxSelectedRgbDelta <= 2 ? 'passed' : 'failed',
			measured: {
				maxSelectedRgbDelta,
				selectedChecks,
			},
		},
		{
			id: 'packet-has-sky-hit-and-source-light',
			status:
				packet.counts.skyPixels > 0 &&
				packet.counts.hitPixels > 0 &&
				packet.sceneLight?.mode === 'distant-directional-sun'
					? 'passed'
					: 'failed',
			measured: {
				counts: packet.counts,
				source: packet.source,
				sceneLight: packet.sceneLight,
			},
		},
	];
	const summary = {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};

	return {
		kind: 'browser-lit-scene-soft-shader-composition-diagnostics',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		iteration: command?.payload?.iteration ||
			'24-lit-scene-shader-composition',
		goal:
			'Compose browser-rendered Three scene color with Algorithm32 atmosphere in the GPU soft-shader path.',
		commandPayload: command?.payload || null,
		threeRevision: THREE.REVISION,
		webgl: atmosphereResult.webgl || passthroughResult.webgl,
		packetSummary: {
			width: packet.width,
			height: packet.height,
			captureId: packet.captureId,
			sceneMode: packet.sceneMode,
			counts: packet.counts,
			source: packet.source,
			sceneLight: packet.sceneLight,
			geometry: packet.geometry,
		},
		passthroughMaxAbsDelta,
		outputSummary: summarizeRgba8(atmosphereResult.readbackRgba8),
		selectedChecks,
		shadowCheck,
		skyReplacementCheck,
		criteria,
		summary,
	};
}

function softShaderCompositionSelectedCheck({ packet, sample, sunCase, shaderRgba }) {
	const spectral = computeSecondOrderRadianceSpectralDiagnostic(
		sample,
		new Map(),
		sunCase
	);
	const pathRgb = spectralToDisplayPreview(
		spectral.pathRadianceByWavelength
	).encodedRgb;
	const transmittanceRgb = rgbTransmittanceBands(
		spectral.transmittanceByWavelength
	);
	const expectedRgb = sample.classification === 'sky'
		? pathRgb
		: sample.rgba.slice(0, 3).map((value, index) =>
				clampByte(value * transmittanceRgb[index] + pathRgb[index])
			);
	const expectedRgba = [...expectedRgb, 255];
	const deltas = shaderRgba.map((value, index) => value - expectedRgba[index]);

	return {
		id: sample.id,
		x: sample.x,
		y: sample.y,
		classification: sample.classification,
		sceneColorRgba8: sample.rgba,
		transmittanceRgb,
		meanTransmittance: mean(spectral.transmittanceByWavelength),
		pathRadiancePreviewRgba8: [...pathRgb, 255],
		expectedRgba,
		shaderRgba,
		deltas,
		maxAbsRgbDelta: Math.max(
			...deltas.slice(0, 3).map((value) => Math.abs(value))
		),
	};
}

function softShaderShadowCheck({ packet, outputRgba8 }) {
	const before = packet.shadowCheck;
	if (!before || before.status !== 'accepted') {
		return {
			status: 'rejected',
			reason: 'No accepted pre-atmosphere shadow check in packet.',
		};
	}
	const darkAfter = rgbaAt(
		outputRgba8,
		packet.width,
		before.darkestGround.x,
		before.darkestGround.y
	);
	const brightAfter = rgbaAt(
		outputRgba8,
		packet.width,
		before.brightestGround.x,
		before.brightestGround.y
	);
	const darkAfterLuminance = luminanceRgb(darkAfter);
	const brightAfterLuminance = luminanceRgb(brightAfter);
	const afterDelta = brightAfterLuminance - darkAfterLuminance;

	return {
		status: afterDelta > 0 ? 'accepted' : 'rejected',
		beforeDelta: before.luminanceDelta,
		afterDelta,
		darkestGround: {
			id: before.darkestGround.id,
			x: before.darkestGround.x,
			y: before.darkestGround.y,
			beforeRgba: before.darkestGround.rgba,
			afterRgba: darkAfter,
			beforeLuminance: before.darkestGround.luminance,
			afterLuminance: darkAfterLuminance,
		},
		brightestGround: {
			id: before.brightestGround.id,
			x: before.brightestGround.x,
			y: before.brightestGround.y,
			beforeRgba: before.brightestGround.rgba,
			afterRgba: brightAfter,
			beforeLuminance: before.brightestGround.luminance,
			afterLuminance: brightAfterLuminance,
		},
	};
}

function softShaderSkyReplacementCheck({ packet, outputRgba8 }) {
	const skySample =
		packet.selectedPixels.find((sample) => sample.classification === 'sky') ||
		null;
	if (!skySample) {
		return {
			status: 'rejected',
			reason: 'No selected sky sample in packet.',
		};
	}
	const outputRgba = rgbaAt(outputRgba8, packet.width, skySample.x, skySample.y);
	const maxAbsRgbDelta = Math.max(
		...outputRgba
			.slice(0, 3)
			.map((value, index) => Math.abs(value - skySample.rgba[index]))
	);

	return {
		status: maxAbsRgbDelta > 2 ? 'accepted' : 'rejected',
		id: skySample.id,
		x: skySample.x,
		y: skySample.y,
		sceneColorRgba8: skySample.rgba,
		shaderRgba: outputRgba,
		maxAbsRgbDelta,
	};
}

function rgbTransmittanceBands(transmittanceByWavelength) {
	const blue = mean(transmittanceByWavelength.slice(0, 5));
	const green = mean(transmittanceByWavelength.slice(4, 9));
	const red = mean(transmittanceByWavelength.slice(8));

	return [red, green, blue];
}

function rgbaAt(rgba8, width, x, y) {
	const offset = (y * width + x) * 4;
	return Array.from(rgba8.slice(offset, offset + 4));
}

function localFullImageSelectedChecks({
	packet,
	outputRgba8,
	expectedSelectedPixels,
}) {
	const expectedById = new Map(
		expectedSelectedPixels.map((sample) => [sample.id, sample])
	);
	return (packet.selectedPixels || []).map((sample) => {
		const expected = expectedById.get(sample.id) || null;
		const shaderRgba = rgbaAt(outputRgba8, packet.width, sample.x, sample.y);
		const expectedRgba = expected?.postprocessRgba8 || null;
		const deltas = expectedRgba
			? shaderRgba.map((value, index) => value - expectedRgba[index])
			: null;
		return {
			id: sample.id,
			x: sample.x,
			y: sample.y,
			hit: sample.hit,
			spectrumId: sample.spectrumId,
			sceneColorRgba8: sample.sceneColorRgba8,
			expectedRgba,
			shaderRgba,
			deltas,
			maxAbsRgbDelta: deltas
				? Math.max(...deltas.slice(0, 3).map((value) => Math.abs(value)))
				: null,
		};
	});
}

function scenePacketSoftShaderSelectedChecks({
	packet,
	expectedSelectedPixels,
	shaderRgba8,
}) {
	return expectedSelectedPixels.map((sample) => {
		const shaderRgba = rgbaAt(shaderRgba8, packet.width, sample.x, sample.y);
		const expectedRgba = sample.postprocessRgba8 || sample.expectedRgba || null;
		const deltas = expectedRgba
			? shaderRgba.map((value, index) => value - expectedRgba[index])
			: null;
		return {
			id: sample.id,
			x: sample.x,
			y: sample.y,
			hit: sample.hit,
			classification: sample.classification,
			spectrumId: sample.spectrumId,
			sceneColorRgba8: sample.sceneColorRgba8,
			shaderRgba,
			expectedRgba,
			deltas,
			maxAbsRgbDelta: deltas
				? Math.max(...deltas.slice(0, 3).map((value) => Math.abs(value)))
				: null,
		};
	});
}

function luminanceRgb(rgba) {
	return rgba[0] * 0.2126 + rgba[1] * 0.7152 + rgba[2] * 0.0722;
}

function localSunDiagnosticSamples({
	sourceCase,
	observerPositionMeters,
	topAltitudeMeters,
}) {
	const observer = observerPositionMeters;
	const sourceDirection = normalize(
		subtractArrays(sourceCase.positionMeters, observer)
	);
	const zenith = [0, 0, 1];
	const oblique = normalize([1, 0, 0.35]);
	const samples = [
		{ id: 'toward-source', direction: sourceDirection },
		{ id: 'zenith', direction: zenith },
		{ id: 'oblique-up', direction: oblique },
	];

	return samples.map((sample) => ({
		...sample,
		origin: observer,
		distanceMeters: distanceToFlatTopForLocalDiagnostic({
			origin: observer,
			direction: sample.direction,
			topAltitudeMeters,
		}),
	}));
}

function computeFlatLocalFirstOrderDisplayDiagnostic({
	sample,
	sourceCase,
	topAltitudeMeters,
}) {
	const pathRadianceByWavelength = SPECTRAL_CHANNELS.map((channel, channelIndex) =>
		computeFlatLocalFirstOrderChannel({
			origin: sample.origin,
			direction: sample.direction,
			distance: sample.distanceMeters,
			sourceCase,
			topAltitudeMeters,
			channel,
			channelIndex,
		})
	);
	const display = spectralToDisplayPreview(pathRadianceByWavelength);
	const sourceSampleAtOrigin = flatLocalSourceSample({
		sourceCase,
		position: sample.origin,
	});
	const sourceSampleAtMidpoint = flatLocalSourceSample({
		sourceCase,
		position: addScaled(
			sample.origin,
			sample.direction,
			sample.distanceMeters * 0.5
		),
	});

	return {
		id: sample.id,
		origin: sample.origin,
		direction: sample.direction,
		distanceMeters: sample.distanceMeters,
		pathRadianceByWavelength,
		encodedRgba: [...display.encodedRgb, 255],
		sourceDistanceMetersAtOrigin: sourceSampleAtOrigin.distanceMeters,
		incidentScaleAtOrigin: sourceSampleAtOrigin.incidentScale,
		sourceDistanceMetersAtMidpoint: sourceSampleAtMidpoint.distanceMeters,
		incidentScaleAtMidpoint: sourceSampleAtMidpoint.incidentScale,
		sourceTransmittanceAtMidpoint532:
			computeFlatLocalSourceTransmittanceAtWavelength({
				position: sourceSampleAtMidpoint.samplePositionMeters,
				sourceSample: sourceSampleAtMidpoint,
				topAltitudeMeters,
				wavelengthNanometers: ATMOSPHERE.diagnosticWavelengthNanometers,
			}),
		phaseNuAtMidpoint: dot(sample.direction, sourceSampleAtMidpoint.direction),
	};
}

function computeFlatLocalFirstOrderChannel({
	origin,
	direction,
	distance,
	sourceCase,
	topAltitudeMeters,
	channel,
	channelIndex,
}) {
	if (distance <= 0) {
		return 0;
	}
	const sampleCount = ATMOSPHERE.directRadianceViewSamples;
	const step = distance / sampleCount;
	let previousDensity = flatDensityAtPosition(origin);
	let cumulativeRayleigh = 0;
	let cumulativeMie = 0;
	let rayleighSum = 0;
	let mieSum = 0;
	const wavelengthMicrometers = channel.wavelengthNanometers * 0.001;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const position = addScaled(origin, direction, sampleDistance);
		const density = flatDensityAtPosition(position);
		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousDensity.rayleigh + density.rayleigh) * step;
			cumulativeMie += 0.5 * (previousDensity.mie + density.mie) * step;
		}
		const viewTransmittance = computeTransmittanceAtWavelength(
			{
				rayleighOpticalLength: cumulativeRayleigh,
				mieOpticalLength: cumulativeMie,
				absorptionOpticalLength: 0,
			},
			channel.wavelengthNanometers
		);
		const sourceSample = flatLocalSourceSample({ sourceCase, position });
		const sourceTransmittance = computeFlatLocalSourceTransmittanceAtWavelength({
			position,
			sourceSample,
			topAltitudeMeters,
			wavelengthNanometers: channel.wavelengthNanometers,
		});
		const transmittance = viewTransmittance * sourceTransmittance;
		const sourceIncidentScale = flatLocalSpectralIncidentScale({
			sourceSample,
			sourceCase,
			channelIndex,
		});
		const sourceIrradiance = channel.solarIrradiance * sourceIncidentScale;
		const nu = clamp(dot(direction, sourceSample.direction), -1, 1);
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;
		rayleighSum +=
			transmittance *
			density.rayleigh *
			sourceIrradiance *
			rayleighScatteringCoefficientAt(wavelengthMicrometers) *
			rayleighPhaseFunction(nu) *
			weight;
		mieSum +=
			transmittance *
			density.mie *
			sourceIrradiance *
			mieScatteringCoefficientAt(wavelengthMicrometers) *
			miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu) *
			weight;
		previousDensity = density;
	}

	return (rayleighSum + mieSum) * step;
}

function flatLocalSourceSample({ sourceCase, position }) {
	const vectorToSource = subtractArrays(sourceCase.positionMeters, position);
	const distanceMeters = length(vectorToSource);
	const distanceKm = distanceMeters / 1000;
	const direction = distanceMeters === 0
		? [0, 0, 1]
		: vectorToSource.map((value) => value / distanceMeters);
	const distanceFalloffScale = sourceCase.distanceFalloff
		? (sourceCase.referenceDistanceKm / distanceKm) ** 2
		: 1;
	const incidentScale =
		sourceCase.referenceSpectralIncidentScale * distanceFalloffScale;

	return {
		kind: 'flat-local-point-sun',
		samplePositionMeters: position,
		positionMeters: sourceCase.positionMeters,
		direction,
		distanceKind: 'finite',
		distanceMeters,
		distanceKm,
		distanceFalloffScale,
		incidentScale,
	};
}

function flatLocalSpectralIncidentScale({ sourceSample, sourceCase, channelIndex }) {
	const color = sourceCase.color || { r: 1, g: 0.98, b: 0.95 };
	if (channelIndex < 4) {
		return sourceSample.incidentScale * color.b;
	}
	if (channelIndex < 8) {
		return sourceSample.incidentScale * color.g;
	}
	return sourceSample.incidentScale * color.r;
}

function computeFlatLocalSourceTransmittanceAtWavelength({
	position,
	sourceSample,
	topAltitudeMeters,
	wavelengthNanometers,
}) {
	const groundDistance = sourceSample.direction[2] < 0
		? Math.max(0, -position[2] / sourceSample.direction[2])
		: null;
	if (
		groundDistance !== null &&
		groundDistance < sourceSample.distanceMeters - 1e-9
	) {
		return 0;
	}
	const topDistance = sourceSample.direction[2] > 0
		? Math.max(0, (topAltitudeMeters - position[2]) / sourceSample.direction[2])
		: null;
	const atmosphereDistance = topDistance === null
		? sourceSample.distanceMeters
		: Math.min(sourceSample.distanceMeters, topDistance);
	if (atmosphereDistance <= 0) {
		return 1;
	}
	const opticalLengths = computeFlatOpticalLengthsAlongDistance({
		origin: position,
		direction: sourceSample.direction,
		distance: atmosphereDistance,
		sampleCount: ATMOSPHERE.directRadianceSunTransmittanceSamples,
	});
	return computeTransmittanceAtWavelength(opticalLengths, wavelengthNanometers);
}

function computeFlatOpticalLengthsAlongDistance({
	origin,
	direction,
	distance,
	sampleCount,
}) {
	const step = distance / sampleCount;
	let rayleighOpticalLength = 0;
	let mieOpticalLength = 0;
	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const position = addScaled(origin, direction, sampleIndex * step);
		const density = flatDensityAtPosition(position);
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;
		rayleighOpticalLength += density.rayleigh * weight * step;
		mieOpticalLength += density.mie * weight * step;
	}
	return {
		rayleighOpticalLength,
		mieOpticalLength,
		absorptionOpticalLength: 0,
	};
}

function flatDensityAtPosition(position) {
	const altitudeMeters = Math.max(0, position[2]);
	return {
		altitudeMeters,
		rayleigh: Math.exp(-altitudeMeters / ATMOSPHERE.rayleighScaleHeightMeters),
		mie: Math.exp(-altitudeMeters / ATMOSPHERE.mieScaleHeightMeters),
		absorption: 0,
	};
}

function distanceToFlatTopForLocalDiagnostic({
	origin,
	direction,
	topAltitudeMeters,
}) {
	if (direction[2] <= 0) {
		return 0;
	}
	return Math.max(0, (topAltitudeMeters - origin[2]) / direction[2]);
}

function runFlatLocalFirstOrderDiagnosticShader({
	samples,
	sourceCase,
	topAltitudeMeters,
}) {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, samples.length);
	canvas.height = 1;
	const gl = canvas.getContext('webgl2');
	if (!gl) {
		return {
			status: 'rejected',
			reason: 'WebGL2 unavailable for local first-order diagnostic shader.',
			samples: [],
		};
	}
	const program = createFlatLocalFirstOrderDiagnosticProgram(gl);
	const buffer = gl.createBuffer();
	const origins = [];
	const directions = [];
	const distances = [];
	for (let index = 0; index < 8; index += 1) {
		const sample = samples[index] || samples[0];
		origins.push(...sample.origin);
		directions.push(...sample.direction);
		distances.push(sample.distanceMeters);
	}

	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.disable(gl.DEPTH_TEST);
	gl.useProgram(program);
	gl.uniform1i(gl.getUniformLocation(program, 'sampleCount'), samples.length);
	gl.uniform3fv(gl.getUniformLocation(program, 'origins'), new Float32Array(origins));
	gl.uniform3fv(
		gl.getUniformLocation(program, 'directions'),
		new Float32Array(directions)
	);
	gl.uniform1fv(gl.getUniformLocation(program, 'distances'), new Float32Array(distances));
	gl.uniform3fv(
		gl.getUniformLocation(program, 'sourcePosition'),
		new Float32Array(sourceCase.positionMeters)
	);
	gl.uniform1f(
		gl.getUniformLocation(program, 'topAltitudeMeters'),
		topAltitudeMeters
	);
	gl.uniform1f(
		gl.getUniformLocation(program, 'referenceDistanceKm'),
		sourceCase.referenceDistanceKm
	);
	gl.uniform1f(
		gl.getUniformLocation(program, 'referenceSpectralIncidentScale'),
		sourceCase.referenceSpectralIncidentScale
	);
	gl.uniform1i(
		gl.getUniformLocation(program, 'distanceFalloff'),
		sourceCase.distanceFalloff ? 1 : 0
	);
	gl.uniform3f(
		gl.getUniformLocation(program, 'sourceColor'),
		sourceCase.color?.r ?? 1,
		sourceCase.color?.g ?? 0.98,
		sourceCase.color?.b ?? 0.95
	);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);
	const positionLocation = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	const pixels = new Uint8Array(canvas.width * 4);
	gl.readPixels(0, 0, canvas.width, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
	const shaderSamples = samples.map((sample, index) => ({
		id: sample.id,
		rgba: Array.from(pixels.slice(index * 4, index * 4 + 4)),
	}));
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);

	return {
		status: 'accepted',
		webglVersion: gl.getParameter(gl.VERSION),
		samples: shaderSamples,
		summary: {
			sampleCount: samples.length,
			sourceKind: 'flat-local-point-sun',
			includeSecondOrder: false,
		},
	};
}

function createFlatLocalFirstOrderDiagnosticProgram(gl) {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 position;

void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;

const int CHANNEL_COUNT = 15;
const int MAX_SAMPLES = 8;
const int VIEW_SAMPLES = 20;
const int SOURCE_TRANSMITTANCE_SAMPLES = 10;
const float RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0;
const float MIE_SCALE_HEIGHT_METERS = 1200.0;
const float RAYLEIGH_COEFFICIENT_SCALE = 1.24062e-6;
const float MIE_ANGSTROM_ALPHA = 0.8;
const float MIE_ANGSTROM_BETA = 0.04;
const float MIE_SINGLE_SCATTERING_ALBEDO = 0.8;
const float MIE_PHASE_G = 0.7;
const float PI = 3.141592653589793;
const float SPECTRAL_DELTA_NM = 31.333333333333332;
const float MAX_LUMINOUS_EFFICACY = 683.0;
const float DISPLAY_TONE_MAP_K = 0.00029282576866764276;
const float WAVELENGTHS_NM[CHANNEL_COUNT] = float[CHANNEL_COUNT](
	375.666666666667, 407.0, 438.333333333333, 469.666666666667, 501.0,
	532.333333333333, 563.666666666667, 595.0, 626.333333333333,
	657.666666666667, 689.0, 720.333333333333, 751.666666666667,
	783.0, 814.333333333333
);
const float SOLAR_IRRADIANCE[CHANNEL_COUNT] = float[CHANNEL_COUNT](
	1.068866666667, 1.729673, 1.862071666667, 2.022063333333, 1.908154,
	1.883391, 1.834246666667, 1.76744, 1.65952, 1.548102333333,
	1.45078, 1.340960333333, 1.262433333333, 1.175208, 1.090824
);
const vec3 CIE[CHANNEL_COUNT] = vec3[CHANNEL_COUNT](
	vec3(0.00082512, 0.000024284, 0.00388120013333),
	vec3(0.031318, 0.000868, 0.14908),
	vec3(0.341686666667, 0.0209466666667, 1.70569333333),
	vec3(0.199076, 0.0898413333333, 1.30367066667),
	vec3(0.0044, 0.33986, 0.26006),
	vec3(0.19361662, 0.88666338, 0.0364106666667),
	vec3(0.656026666667, 0.982973333333, 0.00305666593333),
	vec3(1.0567, 0.6949, 0.001),
	vec3(0.722333333333, 0.306066666667, 0.000086666664),
	vec3(0.190006666667, 0.0706133333333, 0.0),
	vec3(0.02474, 0.008952, 0.0),
	vec3(0.0028426512, 0.00102653333333, 0.0),
	vec3(0.000299809433333, 0.000108266666667, 0.0),
	vec3(0.000034215932, 0.000012356, 0.0),
	vec3(0.00000378221413333, 0.00000136582666667, 0.0)
);

uniform int sampleCount;
uniform vec3 origins[MAX_SAMPLES];
uniform vec3 directions[MAX_SAMPLES];
uniform float distances[MAX_SAMPLES];
uniform vec3 sourcePosition;
uniform float topAltitudeMeters;
uniform float referenceDistanceKm;
uniform float referenceSpectralIncidentScale;
uniform bool distanceFalloff;
uniform vec3 sourceColor;

out vec4 outColor;

float rayleighScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return RAYLEIGH_COEFFICIENT_SCALE * pow(wavelengthMicrometersValue, -4.0);
}

float mieExtinctionCoefficientAt(float wavelengthMicrometersValue) {
	return (MIE_ANGSTROM_BETA / MIE_SCALE_HEIGHT_METERS) *
		pow(wavelengthMicrometersValue, -MIE_ANGSTROM_ALPHA);
}

float mieScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
		MIE_SINGLE_SCATTERING_ALBEDO;
}

float transmittanceAt(float rayleighOpticalLength, float mieOpticalLength, float wavelengthMicrometersValue) {
	float opticalDepth =
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) * rayleighOpticalLength +
		mieExtinctionCoefficientAt(wavelengthMicrometersValue) * mieOpticalLength;
	return exp(-opticalDepth);
}

vec2 flatDensityAt(vec3 position) {
	float altitudeMeters = max(0.0, position.z);
	return vec2(
		exp(-altitudeMeters / RAYLEIGH_SCALE_HEIGHT_METERS),
		exp(-altitudeMeters / MIE_SCALE_HEIGHT_METERS)
	);
}

float rayleighPhaseFunction(float nu) {
	return (3.0 / (16.0 * PI)) * (1.0 + nu * nu);
}

float miePhaseFunction(float g, float nu) {
	float k = (3.0 / (8.0 * PI)) * ((1.0 - g * g) / (2.0 + g * g));
	return (k * (1.0 + nu * nu)) /
		pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

float localSpectralScale(float incidentScale, int channelIndex) {
	if (channelIndex < 4) {
		return incidentScale * sourceColor.b;
	}
	if (channelIndex < 8) {
		return incidentScale * sourceColor.g;
	}
	return incidentScale * sourceColor.r;
}

float sourceTransmittance(vec3 position, vec3 sourceDirection, float sourceDistance, float wavelengthMicrometersValue) {
	if (sourceDirection.z < 0.0) {
		float groundDistance = max(0.0, -position.z / sourceDirection.z);
		if (groundDistance < sourceDistance - 1e-9) {
			return 0.0;
		}
	}
	float topDistance = sourceDirection.z > 0.0
		? max(0.0, (topAltitudeMeters - position.z) / sourceDirection.z)
		: sourceDistance;
	float atmosphereDistance = min(sourceDistance, topDistance);
	if (atmosphereDistance <= 0.0) {
		return 1.0;
	}
	float stepSize = atmosphereDistance / float(SOURCE_TRANSMITTANCE_SAMPLES);
	float rayleighLength = 0.0;
	float mieLength = 0.0;
	for (int sampleIndex = 0; sampleIndex <= SOURCE_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		vec3 samplePosition = position + sourceDirection * (float(sampleIndex) * stepSize);
		vec2 density = flatDensityAt(samplePosition);
		float weight = sampleIndex == 0 || sampleIndex == SOURCE_TRANSMITTANCE_SAMPLES ? 0.5 : 1.0;
		rayleighLength += density.x * weight * stepSize;
		mieLength += density.y * weight * stepSize;
	}
	return transmittanceAt(rayleighLength, mieLength, wavelengthMicrometersValue);
}

float localFirstOrderChannel(vec3 origin, vec3 direction, float distanceMeters, int channelIndex) {
	if (distanceMeters <= 0.0) {
		return 0.0;
	}
	float wavelengthNm = WAVELENGTHS_NM[channelIndex];
	float wavelengthMicrometersValue = wavelengthNm * 0.001;
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	vec2 previousDensity = flatDensityAt(origin);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = flatDensityAt(samplePosition);
		if (sampleIndex > 0) {
			cumulativeRayleigh += 0.5 * (previousDensity.x + density.x) * stepSize;
			cumulativeMie += 0.5 * (previousDensity.y + density.y) * stepSize;
		}
		float viewT = transmittanceAt(cumulativeRayleigh, cumulativeMie, wavelengthMicrometersValue);
		vec3 vectorToSource = sourcePosition - samplePosition;
		float sourceDistance = length(vectorToSource);
		vec3 sourceDirection = sourceDistance == 0.0 ? vec3(0.0, 0.0, 1.0) : vectorToSource / sourceDistance;
		float distanceKm = sourceDistance / 1000.0;
		float falloff = distanceFalloff ? pow(referenceDistanceKm / distanceKm, 2.0) : 1.0;
		float incidentScale = referenceSpectralIncidentScale * falloff;
		float sourceScale = localSpectralScale(incidentScale, channelIndex);
		float sourceT = sourceTransmittance(samplePosition, sourceDirection, sourceDistance, wavelengthMicrometersValue);
		float transmittance = viewT * sourceT;
		float nu = clamp(dot(direction, sourceDirection), -1.0, 1.0);
		float weight = sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		float sourceIrradiance = SOLAR_IRRADIANCE[channelIndex] * sourceScale;
		rayleighSum += transmittance * density.x * sourceIrradiance *
			rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
			rayleighPhaseFunction(nu) * weight;
		mieSum += transmittance * density.y * sourceIrradiance *
			mieScatteringCoefficientAt(wavelengthMicrometersValue) *
			miePhaseFunction(MIE_PHASE_G, nu) * weight;
		previousDensity = density;
	}
	return (rayleighSum + mieSum) * stepSize;
}

void main() {
	int index = int(floor(gl_FragCoord.x));
	if (index < 0 || index >= sampleCount) {
		outColor = vec4(0.0, 0.0, 0.0, 1.0);
		return;
	}
	vec3 origin = origins[index];
	vec3 direction = normalize(directions[index]);
	float distanceMeters = distances[index];
	vec3 xyz = vec3(0.0);
	for (int channelIndex = 0; channelIndex < CHANNEL_COUNT; channelIndex++) {
		float radiance = localFirstOrderChannel(origin, direction, distanceMeters, channelIndex);
		xyz += CIE[channelIndex] * radiance * SPECTRAL_DELTA_NM;
	}
	vec3 linearSrgb = MAX_LUMINOUS_EFFICACY * vec3(
		3.2406 * xyz.x + -1.5372 * xyz.y + -0.4986 * xyz.z,
		-0.9689 * xyz.x + 1.8758 * xyz.y + 0.0415 * xyz.z,
		0.0557 * xyz.x + -0.204 * xyz.y + 1.057 * xyz.z
	);
	vec3 displayRgb = clamp(
		vec3(1.0) - exp(-DISPLAY_TONE_MAP_K * max(vec3(0.0), linearSrgb)),
		vec3(0.0),
		vec3(1.0)
	);
	outColor = vec4(displayRgb, 1.0);
}
`);
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) || 'Flat local first-order diagnostic shader link failed.');
	}

	return program;
}

function createFlatLocalFullImageShaderProgram(gl) {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 position;

void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
precision highp sampler2D;

const int CHANNEL_COUNT = 15;
const int VIEW_SAMPLES = 20;
const int SOURCE_TRANSMITTANCE_SAMPLES = 10;
const float RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0;
const float MIE_SCALE_HEIGHT_METERS = 1200.0;
const float RAYLEIGH_COEFFICIENT_SCALE = 1.24062e-6;
const float MIE_ANGSTROM_ALPHA = 0.8;
const float MIE_ANGSTROM_BETA = 0.04;
const float MIE_SINGLE_SCATTERING_ALBEDO = 0.8;
const float MIE_PHASE_G = 0.7;
const float PI = 3.141592653589793;
const float SPECTRAL_DELTA_NM = 31.333333333333332;
const float MAX_LUMINOUS_EFFICACY = 683.0;
const float DISPLAY_TONE_MAP_K = 0.00029282576866764276;
const float WAVELENGTHS_NM[CHANNEL_COUNT] = float[CHANNEL_COUNT](
	375.666666666667, 407.0, 438.333333333333, 469.666666666667, 501.0,
	532.333333333333, 563.666666666667, 595.0, 626.333333333333,
	657.666666666667, 689.0, 720.333333333333, 751.666666666667,
	783.0, 814.333333333333
);
const float SOLAR_IRRADIANCE[CHANNEL_COUNT] = float[CHANNEL_COUNT](
	1.068866666667, 1.729673, 1.862071666667, 2.022063333333, 1.908154,
	1.883391, 1.834246666667, 1.76744, 1.65952, 1.548102333333,
	1.45078, 1.340960333333, 1.262433333333, 1.175208, 1.090824
);
const vec3 CIE[CHANNEL_COUNT] = vec3[CHANNEL_COUNT](
	vec3(0.00082512, 0.000024284, 0.00388120013333),
	vec3(0.031318, 0.000868, 0.14908),
	vec3(0.341686666667, 0.0209466666667, 1.70569333333),
	vec3(0.199076, 0.0898413333333, 1.30367066667),
	vec3(0.0044, 0.33986, 0.26006),
	vec3(0.19361662, 0.88666338, 0.0364106666667),
	vec3(0.656026666667, 0.982973333333, 0.00305666593333),
	vec3(1.0567, 0.6949, 0.001),
	vec3(0.722333333333, 0.306066666667, 0.000086666664),
	vec3(0.190006666667, 0.0706133333333, 0.0),
	vec3(0.02474, 0.008952, 0.0),
	vec3(0.0028426512, 0.00102653333333, 0.0),
	vec3(0.000299809433333, 0.000108266666667, 0.0),
	vec3(0.000034215932, 0.000012356, 0.0),
	vec3(0.00000378221413333, 0.00000136582666667, 0.0)
);

uniform vec2 resolution;
uniform sampler2D sceneInputTexture;
uniform sampler2D sceneColorTexture;
uniform sampler2D rayDirectionTexture;
uniform vec3 cameraPositionAlgorithm;
uniform vec3 sourcePosition;
uniform float topAltitudeMeters;
uniform float sceneSkyRayLimitMeters;
uniform float referenceDistanceKm;
uniform float referenceSpectralIncidentScale;
uniform bool distanceFalloff;
uniform vec3 sourceColor;
uniform bool composeSceneColor;

out vec4 outColor;

float rayleighScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return RAYLEIGH_COEFFICIENT_SCALE * pow(wavelengthMicrometersValue, -4.0);
}

float mieExtinctionCoefficientAt(float wavelengthMicrometersValue) {
	return (MIE_ANGSTROM_BETA / MIE_SCALE_HEIGHT_METERS) *
		pow(wavelengthMicrometersValue, -MIE_ANGSTROM_ALPHA);
}

float mieScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
		MIE_SINGLE_SCATTERING_ALBEDO;
}

float transmittanceAt(float rayleighOpticalLength, float mieOpticalLength, float wavelengthMicrometersValue) {
	float opticalDepth =
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) * rayleighOpticalLength +
		mieExtinctionCoefficientAt(wavelengthMicrometersValue) * mieOpticalLength;
	return exp(-opticalDepth);
}

vec2 flatDensityAt(vec3 position) {
	float altitudeMeters = position.z;
	if (altitudeMeters < 0.0 || altitudeMeters > topAltitudeMeters) {
		return vec2(0.0);
	}
	return vec2(
		exp(-altitudeMeters / RAYLEIGH_SCALE_HEIGHT_METERS),
		exp(-altitudeMeters / MIE_SCALE_HEIGHT_METERS)
	);
}

float rayleighPhaseFunction(float nu) {
	return (3.0 / (16.0 * PI)) * (1.0 + nu * nu);
}

float miePhaseFunction(float g, float nu) {
	float k = (3.0 / (8.0 * PI)) * ((1.0 - g * g) / (2.0 + g * g));
	return (k * (1.0 + nu * nu)) /
		pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

float localSpectralScale(float incidentScale, int channelIndex) {
	if (channelIndex < 4) {
		return incidentScale * sourceColor.b;
	}
	if (channelIndex < 8) {
		return incidentScale * sourceColor.g;
	}
	return incidentScale * sourceColor.r;
}

float sourceTransmittance(vec3 position, vec3 sourceDirection, float sourceDistance, float wavelengthMicrometersValue) {
	if (sourceDirection.z < 0.0) {
		float groundDistance = max(0.0, -position.z / sourceDirection.z);
		if (groundDistance < sourceDistance - 1e-9) {
			return 0.0;
		}
	}
	float topDistance = sourceDirection.z > 0.0
		? max(0.0, (topAltitudeMeters - position.z) / sourceDirection.z)
		: sourceDistance;
	float atmosphereDistance = min(sourceDistance, topDistance);
	if (atmosphereDistance <= 0.0) {
		return 1.0;
	}
	float stepSize = atmosphereDistance / float(SOURCE_TRANSMITTANCE_SAMPLES);
	float rayleighLength = 0.0;
	float mieLength = 0.0;
	for (int sampleIndex = 0; sampleIndex <= SOURCE_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		vec3 samplePosition = position + sourceDirection * (float(sampleIndex) * stepSize);
		vec2 density = flatDensityAt(samplePosition);
		float weight = sampleIndex == 0 || sampleIndex == SOURCE_TRANSMITTANCE_SAMPLES ? 0.5 : 1.0;
		rayleighLength += density.x * weight * stepSize;
		mieLength += density.y * weight * stepSize;
	}
	return transmittanceAt(rayleighLength, mieLength, wavelengthMicrometersValue);
}

vec2 localFirstOrderPathAndViewT(vec3 origin, vec3 direction, float distanceMeters, int channelIndex) {
	if (distanceMeters <= 0.0) {
		return vec2(0.0, 1.0);
	}
	float wavelengthNm = WAVELENGTHS_NM[channelIndex];
	float wavelengthMicrometersValue = wavelengthNm * 0.001;
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	vec2 previousDensity = flatDensityAt(origin);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = flatDensityAt(samplePosition);
		if (sampleIndex > 0) {
			cumulativeRayleigh += 0.5 * (previousDensity.x + density.x) * stepSize;
			cumulativeMie += 0.5 * (previousDensity.y + density.y) * stepSize;
		}
		float viewT = transmittanceAt(cumulativeRayleigh, cumulativeMie, wavelengthMicrometersValue);
		vec3 vectorToSource = sourcePosition - samplePosition;
		float sourceDistance = length(vectorToSource);
		vec3 sourceDirection = sourceDistance == 0.0 ? vec3(0.0, 0.0, 1.0) : vectorToSource / sourceDistance;
		float distanceKm = sourceDistance / 1000.0;
		float falloff = distanceFalloff ? pow(referenceDistanceKm / distanceKm, 2.0) : 1.0;
		float incidentScale = referenceSpectralIncidentScale * falloff;
		float sourceScale = localSpectralScale(incidentScale, channelIndex);
		float sourceT = sourceTransmittance(samplePosition, sourceDirection, sourceDistance, wavelengthMicrometersValue);
		float transmittance = viewT * sourceT;
		float nu = clamp(dot(direction, sourceDirection), -1.0, 1.0);
		float weight = sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		float sourceIrradiance = SOLAR_IRRADIANCE[channelIndex] * sourceScale;
		rayleighSum += transmittance * density.x * sourceIrradiance *
			rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
			rayleighPhaseFunction(nu) * weight;
		mieSum += transmittance * density.y * sourceIrradiance *
			mieScatteringCoefficientAt(wavelengthMicrometersValue) *
			miePhaseFunction(MIE_PHASE_G, nu) * weight;
		previousDensity = density;
	}
	float viewTransmittance = transmittanceAt(cumulativeRayleigh, cumulativeMie, wavelengthMicrometersValue);
	return vec2((rayleighSum + mieSum) * stepSize, viewTransmittance);
}

float triangularSpectrumWeight(float lambdaNm, float centerNm, float halfWidthNm) {
	return max(0.0, 1.0 - abs(lambdaNm - centerNm) / halfWidthNm);
}

float objectRadianceAt(int spectrumId, float wavelengthNm) {
	if (spectrumId == 1) {
		return wavelengthNm >= 626.333333333333 ? 0.045 : 0.003;
	}
	if (spectrumId == 2) {
		return
			0.002 +
			0.05 * triangularSpectrumWeight(wavelengthNm, 532.333333333333, 65.0) +
			0.012 * triangularSpectrumWeight(wavelengthNm, 563.666666666667, 60.0);
	}
	if (spectrumId == 3) {
		return wavelengthNm <= 501.0 ? 0.045 : 0.003;
	}
	if (spectrumId == 4) {
		return 0.012;
	}
	return 0.0;
}

float distanceToFlatSkyBoundary(vec3 origin, vec3 direction) {
	float distance = sceneSkyRayLimitMeters;
	if (direction.z < 0.0) {
		float groundDistance = max(0.0, -origin.z / direction.z);
		distance = min(distance, groundDistance);
	}
	if (direction.z > 0.0) {
		float topDistance = max(0.0, (topAltitudeMeters - origin.z) / direction.z);
		distance = min(distance, topDistance);
	}
	return distance;
}

vec3 displayPreview(vec3 xyz) {
	vec3 linearSrgb = MAX_LUMINOUS_EFFICACY * vec3(
		3.2406 * xyz.x + -1.5372 * xyz.y + -0.4986 * xyz.z,
		-0.9689 * xyz.x + 1.8758 * xyz.y + 0.0415 * xyz.z,
		0.0557 * xyz.x + -0.204 * xyz.y + 1.057 * xyz.z
	);
	return clamp(
		vec3(1.0) - exp(-DISPLAY_TONE_MAP_K * max(vec3(0.0), linearSrgb)),
		vec3(0.0),
		vec3(1.0)
	);
}

void main() {
	ivec2 pixelCoord = ivec2(int(gl_FragCoord.x), int(gl_FragCoord.y));
	vec4 sceneInput = texelFetch(sceneInputTexture, pixelCoord, 0);
	bool hit = sceneInput.z > 0.5;
	float distanceMeters = sceneInput.x;
	int spectrumId = hit ? int(floor(sceneInput.y + 0.5)) : 0;
	vec3 threeDirection = normalize(texelFetch(rayDirectionTexture, pixelCoord, 0).xyz);
	vec3 algorithmDirection = normalize(vec3(threeDirection.x, -threeDirection.z, threeDirection.y));
	if (!hit) {
		distanceMeters = distanceToFlatSkyBoundary(cameraPositionAlgorithm, algorithmDirection);
	}

	vec3 xyz = vec3(0.0);
	float blueTransmittanceSum = 0.0;
	float greenTransmittanceSum = 0.0;
	float redTransmittanceSum = 0.0;

	for (int channelIndex = 0; channelIndex < CHANNEL_COUNT; channelIndex++) {
		float wavelengthNm = WAVELENGTHS_NM[channelIndex];
		vec2 pathAndT = localFirstOrderPathAndViewT(
			cameraPositionAlgorithm,
			algorithmDirection,
			distanceMeters,
			channelIndex
		);
		float objectRadiance = composeSceneColor
			? 0.0
			: objectRadianceAt(spectrumId, wavelengthNm) * pathAndT.y;
		float finalRadiance = objectRadiance + pathAndT.x;
		xyz += CIE[channelIndex] * finalRadiance * SPECTRAL_DELTA_NM;
		if (channelIndex < 5) {
			blueTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 4 && channelIndex < 9) {
			greenTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 8) {
			redTransmittanceSum += pathAndT.y;
		}
	}

	vec3 displayRgb = displayPreview(xyz);
	if (composeSceneColor && hit) {
		vec3 sceneRgb = texelFetch(sceneColorTexture, pixelCoord, 0).rgb;
		vec3 transmittanceRgb = vec3(
			redTransmittanceSum / 7.0,
			greenTransmittanceSum / 5.0,
			blueTransmittanceSum / 5.0
		);
		displayRgb = clamp(sceneRgb * transmittanceRgb + displayRgb, vec3(0.0), vec3(1.0));
	}
	outColor = vec4(displayRgb, 1.0);
}
`);
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) || 'Flat local full-image shader link failed.');
	}

	return program;
}

function meanCaseLuminance(caseResult) {
	return mean(
		caseResult.selectedChecks.map((check) => luminanceRgb(check.rgba))
	);
}

function mountainLitSceneInputDiagnostics({
	command,
	capture,
	sceneLightPacket,
}) {
	const criteria = [
		{
			id: 'mountain-lit-packet-present',
			status: capture ? 'passed' : 'failed',
			measured: {
				hasCapture: Boolean(capture),
			},
		},
		{
			id: 'mountain-lit-packet-has-sky-and-hit',
			status:
				capture?.counts?.skyPixels > 0 && capture?.counts?.hitPixels > 0
					? 'passed'
					: 'failed',
			measured: capture?.counts || null,
		},
		{
			id: 'source-driven-three-light-recorded',
			status:
				sceneLightPacket?.kind &&
				(sceneLightPacket.mode === 'distant-directional-sun' ||
					sceneLightPacket.mode === 'flat-local-point-sun')
					? 'passed'
					: 'failed',
			measured: sceneLightPacket || null,
		},
		{
			id: 'source-packet-recorded',
			status: capture?.source?.kind ? 'passed' : 'failed',
			measured: capture?.source || null,
		},
	];
	const summary = {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};

	return {
		kind: 'browser-mountain-lit-scene-input-diagnostics',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		iteration: command?.payload?.iteration ||
			'subjective-three-lit-source-scenes',
		goal:
			'Capture a subjective mountain scene rendered with real white Three.js source lights for CPU Algorithm32 atmosphere postprocessing.',
		commandPayload: command?.payload || null,
		threeRevision: THREE.REVISION,
		capture,
		sceneLightPacket,
		criteria,
		summary,
	};
}

function renderSceneColorPassthroughShader({ renderer, packet }) {
	const gl = renderer.getContext();
	const program = createSceneColorPassthroughProgram(gl);
	const texture = gl.createTexture();
	const readbackRgba8 = new Uint8Array(packet.width * packet.height * 4);

	renderer.resetState();
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, packet.width, packet.height);
	gl.disable(gl.DEPTH_TEST);
	gl.disable(gl.CULL_FACE);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		packet.width,
		packet.height,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		new Uint8Array(packet.sceneColorRgba8)
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.useProgram(program);
	gl.uniform1i(gl.getUniformLocation(program, 'sceneColorTexture'), 0);
	gl.uniform2f(
		gl.getUniformLocation(program, 'resolution'),
		packet.width,
		packet.height
	);

	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);
	const positionLocation = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	const bottomLeft = new Uint8Array(packet.width * packet.height * 4);
	gl.readPixels(0, 0, packet.width, packet.height, gl.RGBA, gl.UNSIGNED_BYTE, bottomLeft);
	for (let y = 0; y < packet.height; y += 1) {
		const sourceY = packet.height - y - 1;
		for (let x = 0; x < packet.width; x += 1) {
			const sourceOffset = (sourceY * packet.width + x) * 4;
			const targetOffset = (y * packet.width + x) * 4;
			readbackRgba8[targetOffset] = bottomLeft[sourceOffset];
			readbackRgba8[targetOffset + 1] = bottomLeft[sourceOffset + 1];
			readbackRgba8[targetOffset + 2] = bottomLeft[sourceOffset + 2];
			readbackRgba8[targetOffset + 3] = bottomLeft[sourceOffset + 3];
		}
	}

	const result = {
		readbackRgba8,
		textureInputs: {
			sceneColorTexture: {
				format: 'RGBA',
				type: 'UNSIGNED_BYTE',
				width: packet.width,
				height: packet.height,
				rowOrder: packet.rowOrder,
				filter: 'NEAREST',
			},
		},
		webgl: {
			version: gl.getParameter(gl.VERSION),
			shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
			vendor: gl.getParameter(gl.VENDOR),
			renderer: gl.getParameter(gl.RENDERER),
		},
	};

	gl.deleteBuffer(buffer);
	gl.deleteTexture(texture);
	gl.deleteProgram(program);
	return result;
}

function renderSoftShaderAtmospherePostprocess({
	renderer,
	camera,
	packet,
	includeSecondOrder = true,
}) {
	const textureData = buildSoftShaderPacketTextureData(packet);
	const pass = setupFirstOrderImageShaderPass({
		renderer,
		camera,
		sunRay: packet.source.sunDirection,
		includeSecondOrder,
		sceneInputTextureData: textureData.sceneInputTextureData,
		sceneColorTextureData: textureData.sceneColorTextureData,
		rayDirectionTextureData: textureData.rayDirectionTextureData,
		composeSceneColor: true,
	});

	try {
		pass.draw();
		return {
			readbackRgba8: readCurrentFramebufferTopLeft(
				pass.gl,
				packet.width,
				packet.height
			),
			imageShaderDiagnostics: pass.diagnostics,
			textureInputs: textureData.summary,
			webgl: {
				version: pass.gl.getParameter(pass.gl.VERSION),
				shadingLanguageVersion: pass.gl.getParameter(
					pass.gl.SHADING_LANGUAGE_VERSION
				),
				vendor: pass.gl.getParameter(pass.gl.VENDOR),
				renderer: pass.gl.getParameter(pass.gl.RENDERER),
			},
		};
	} finally {
		pass.dispose();
	}
}

function renderFlatLocalSoftShaderPostprocess({
	renderer,
	packet,
	composeSceneColor = false,
	surfacePolicy = 'spectrum-id-reference-radiance',
}) {
	const textureData = buildSoftShaderPacketTextureData(packet);
	const gl = renderer.getContext();
	const program = createFlatLocalFullImageShaderProgram(gl);
	const sceneInputTexture = gl.createTexture();
	const sceneColorTexture = gl.createTexture();
	const rayDirectionTexture = gl.createTexture();
	const sourceColor = packet.source?.color || { r: 1, g: 0.98, b: 0.95 };
	const cameraPosition = packet.camera?.positionMeters || [0, 2, 0];
	const cameraPositionAlgorithm = [
		cameraPosition[0] || 0,
		-(cameraPosition[2] || 0),
		cameraPosition[1] || 0,
	];

	renderer.resetState();
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, packet.width, packet.height);
	gl.disable(gl.DEPTH_TEST);
	gl.disable(gl.CULL_FACE);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, sceneInputTexture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA32F,
		textureData.sceneInputTextureData.width,
		textureData.sceneInputTextureData.height,
		0,
		gl.RGBA,
		gl.FLOAT,
		textureData.sceneInputTextureData.data
	);
	setNearestClampTexture(gl);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, sceneColorTexture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		textureData.sceneColorTextureData.width,
		textureData.sceneColorTextureData.height,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		textureData.sceneColorTextureData.data
	);
	setNearestClampTexture(gl);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, rayDirectionTexture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA32F,
		textureData.rayDirectionTextureData.width,
		textureData.rayDirectionTextureData.height,
		0,
		gl.RGBA,
		gl.FLOAT,
		textureData.rayDirectionTextureData.data
	);
	setNearestClampTexture(gl);

	gl.useProgram(program);
	gl.uniform2f(
		gl.getUniformLocation(program, 'resolution'),
		packet.width,
		packet.height
	);
	gl.uniform1i(gl.getUniformLocation(program, 'sceneInputTexture'), 0);
	gl.uniform1i(gl.getUniformLocation(program, 'sceneColorTexture'), 1);
	gl.uniform1i(gl.getUniformLocation(program, 'rayDirectionTexture'), 2);
	gl.uniform3fv(
		gl.getUniformLocation(program, 'cameraPositionAlgorithm'),
		new Float32Array(cameraPositionAlgorithm)
	);
	gl.uniform3fv(
		gl.getUniformLocation(program, 'sourcePosition'),
		new Float32Array(packet.source.positionMeters)
	);
	gl.uniform1f(
		gl.getUniformLocation(program, 'topAltitudeMeters'),
		packet.geometry?.topAltitudeMeters ?? 100000
	);
	gl.uniform1f(
		gl.getUniformLocation(program, 'sceneSkyRayLimitMeters'),
		packet.geometry?.sceneSkyRayLimitMeters ?? 1926774
	);
	gl.uniform1f(
		gl.getUniformLocation(program, 'referenceDistanceKm'),
		packet.source.referenceDistanceKm ?? 4800
	);
	gl.uniform1f(
		gl.getUniformLocation(program, 'referenceSpectralIncidentScale'),
		packet.source.referenceSpectralIncidentScale ?? 1
	);
	gl.uniform1i(
		gl.getUniformLocation(program, 'distanceFalloff'),
		packet.source.distanceFalloff === false ? 0 : 1
	);
	gl.uniform3f(
		gl.getUniformLocation(program, 'sourceColor'),
		sourceColor.r ?? 1,
		sourceColor.g ?? 0.98,
		sourceColor.b ?? 0.95
	);
	gl.uniform1i(
		gl.getUniformLocation(program, 'composeSceneColor'),
		composeSceneColor ? 1 : 0
	);

	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);
	const positionLocation = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	const readbackRgba8 = readCurrentFramebufferTopLeft(
		gl,
		packet.width,
		packet.height
	);
	const result = {
		readbackRgba8,
		imageShaderDiagnostics: {
			status: 'accepted',
			kind: 'browser-flat-local-full-image-shader-diagnostics',
			width: packet.width,
			height: packet.height,
			sourceKind: packet.source.kind,
			sourceId: packet.source.id,
			offsetDegrees: packet.source.offsetDegrees ?? null,
			geometryKind: packet.geometry?.kind || null,
			surfacePolicy,
			composeSceneColor,
			scatteringPolicy:
				'15-channel flat/local point-Sun first-order radiance; local second-order cache unsupported.',
			cameraPositionAlgorithm,
		},
		textureInputs: textureData.summary,
		webgl: {
			version: gl.getParameter(gl.VERSION),
			shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
			vendor: gl.getParameter(gl.VENDOR),
			renderer: gl.getParameter(gl.RENDERER),
		},
	};

	gl.deleteBuffer(buffer);
	gl.deleteTexture(sceneInputTexture);
	gl.deleteTexture(sceneColorTexture);
	gl.deleteTexture(rayDirectionTexture);
	gl.deleteProgram(program);
	return result;
}

function buildSoftShaderPacketTextureData(packet) {
	const sceneInputData = new Float32Array(packet.width * packet.height * 4);
	const rayDirectionData = new Float32Array(packet.width * packet.height * 4);
	const sceneColorData = new Uint8Array(packet.width * packet.height * 4);

	for (let y = 0; y < packet.height; y += 1) {
		const textureY = packet.height - y - 1;
		for (let x = 0; x < packet.width; x += 1) {
			const pixelIndex = y * packet.width + x;
			const textureIndex = textureY * packet.width + x;
			const packetOffset = pixelIndex * 4;
			const textureOffset = textureIndex * 4;
			const directionOffset = pixelIndex * 3;

			sceneInputData[textureOffset] = packet.hitDistanceMeters[pixelIndex];
			sceneInputData[textureOffset + 1] = packet.spectrumNumericIds[pixelIndex];
			sceneInputData[textureOffset + 2] = packet.hitMask[pixelIndex];
			sceneInputData[textureOffset + 3] = 0;

			rayDirectionData[textureOffset] = packet.rayDirections[directionOffset];
			rayDirectionData[textureOffset + 1] =
				packet.rayDirections[directionOffset + 1];
			rayDirectionData[textureOffset + 2] =
				packet.rayDirections[directionOffset + 2];
			rayDirectionData[textureOffset + 3] = 0;

			sceneColorData[textureOffset] = packet.sceneColorRgba8[packetOffset];
			sceneColorData[textureOffset + 1] =
				packet.sceneColorRgba8[packetOffset + 1];
			sceneColorData[textureOffset + 2] =
				packet.sceneColorRgba8[packetOffset + 2];
			sceneColorData[textureOffset + 3] =
				packet.sceneColorRgba8[packetOffset + 3];
		}
	}

	return {
		sceneInputTextureData: {
			width: packet.width,
			height: packet.height,
			data: sceneInputData,
			policy:
				'packet hit distance, numeric material id, and hit mask for soft-shader atmosphere composition',
			channels: {
				r: 'hit distance in meters, or -1 for sky',
				g: 'numeric spectrum/material id',
				b: 'hit mask, 1 for hit and 0 for sky',
				a: 'reserved',
			},
			counts: packet.counts,
			hitDistanceMeters: packet.hitDistanceMetersSummary || null,
			rowOrder: 'bottom-left-for-webgl-texture',
			source: packet.captureId,
		},
		sceneColorTextureData: {
			width: packet.width,
			height: packet.height,
			data: sceneColorData,
			rowOrder: 'bottom-left-for-webgl-texture',
		},
		rayDirectionTextureData: {
			width: packet.width,
			height: packet.height,
			data: rayDirectionData,
			rowOrder: 'bottom-left-for-webgl-texture',
		},
		summary: {
			sceneInputTexture: {
				format: 'RGBA32F',
				rowOrder: 'bottom-left-for-webgl-texture',
			},
			sceneColorTexture: {
				format: 'RGBA/UNSIGNED_BYTE',
				rowOrder: 'bottom-left-for-webgl-texture',
			},
			rayDirectionTexture: {
				format: 'RGBA32F',
				rowOrder: 'bottom-left-for-webgl-texture',
			},
		},
	};
}

function setNearestClampTexture(gl) {
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function readCurrentFramebufferTopLeft(gl, width, height) {
	const bottomLeft = new Uint8Array(width * height * 4);
	const topLeft = new Uint8Array(width * height * 4);
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bottomLeft);
	for (let y = 0; y < height; y += 1) {
		const sourceY = height - y - 1;
		for (let x = 0; x < width; x += 1) {
			const sourceOffset = (sourceY * width + x) * 4;
			const targetOffset = (y * width + x) * 4;
			topLeft[targetOffset] = bottomLeft[sourceOffset];
			topLeft[targetOffset + 1] = bottomLeft[sourceOffset + 1];
			topLeft[targetOffset + 2] = bottomLeft[sourceOffset + 2];
			topLeft[targetOffset + 3] = bottomLeft[sourceOffset + 3];
		}
	}
	return topLeft;
}

function createSceneColorPassthroughProgram(gl) {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 position;

void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D sceneColorTexture;
uniform vec2 resolution;

out vec4 outColor;

void main() {
	ivec2 coord = ivec2(int(gl_FragCoord.x), int(resolution.y - gl_FragCoord.y));
	outColor = texelFetch(sceneColorTexture, coord, 0);
}
`);
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) || 'Scene color passthrough shader link failed.');
	}

	return program;
}

function maxAbsByteDelta(left, right) {
	let maxDelta = 0;
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		maxDelta = Math.max(maxDelta, Math.abs(left[index] - right[index]));
	}
	return Math.max(maxDelta, Math.abs(left.length - right.length) > 0 ? 255 : 0);
}

function createPacketPostprocessRenderer(packet) {
	const canvas = document.getElementById('lab-canvas');
	canvas.width = packet.width;
	canvas.height = packet.height;
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		preserveDrawingBuffer: true,
	});
	renderer.setPixelRatio(1);
	renderer.setSize(packet.width, packet.height, false);
	if ('toneMapping' in renderer) {
		renderer.toneMapping = THREE.NoToneMapping;
	}

	const cameraInfo = packet.camera || {};
	const camera = new THREE.PerspectiveCamera(
		cameraInfo.verticalFovDegrees || 60,
		cameraInfo.aspect || packet.width / packet.height,
		cameraInfo.near || 0.1,
		cameraInfo.far || 100000
	);
	if (Array.isArray(cameraInfo.positionMeters)) {
		camera.position.fromArray(cameraInfo.positionMeters);
	}
	if (Array.isArray(cameraInfo.matrixWorld)) {
		camera.matrixWorld.fromArray(cameraInfo.matrixWorld);
		camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
	} else {
		camera.updateMatrixWorld(true);
	}
	if (Array.isArray(cameraInfo.projectionMatrix)) {
		camera.projectionMatrix.fromArray(cameraInfo.projectionMatrix);
		camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
	} else {
		camera.updateProjectionMatrix();
	}

	return { canvas, renderer, camera };
}

function scenePacketSoftShaderImageDiagnostics({
	command,
	packet,
	shaderResult,
	selectedChecks,
	maxSelectedRgbDelta,
	surfacePolicy,
	composeSceneColor,
	includeSecondOrder,
}) {
	const criteria = [
		{
			id: 'source-packet-supported',
			status:
				packet.source?.kind === 'distant-directional-sun' ||
				packet.source?.kind === 'flat-local-point-sun'
					? 'passed'
					: 'failed',
			measured: packet.source || null,
		},
		{
			id: 'packet-has-sky-and-hit',
			status:
				packet.counts?.skyPixels > 0 && packet.counts?.hitPixels > 0
					? 'passed'
					: 'failed',
			measured: packet.counts || null,
		},
		{
			id: 'shader-run-accepted',
			status: shaderResult.imageShaderDiagnostics?.status === 'accepted'
				? 'passed'
				: 'failed',
			measured: shaderResult.imageShaderDiagnostics,
		},
		{
			id: 'selected-pixels-match-cpu-soft-shader',
			status:
				selectedChecks.length > 0 && maxSelectedRgbDelta <= 2
					? 'passed'
					: 'failed',
			measured: {
				maxSelectedRgbDelta,
				selectedChecks,
			},
		},
		{
			id: 'composition-policy-recorded',
			status: composeSceneColor ? 'passed' : 'failed',
			measured: {
				surfacePolicy,
				composeSceneColor,
				includeSecondOrder,
			},
		},
	];
	const summary = {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};

	return {
		kind: 'browser-scene-packet-soft-shader-image-diagnostics',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		iteration:
			command?.payload?.iteration || 'subjective-scene-packet-soft-shader-image',
		goal:
			'Render an externally captured scene-input packet through the browser GPU soft-shader path for CPU soft-shader comparison.',
		commandPayload: {
			...(command?.payload || {}),
			sceneInputPacket: {
				width: packet.width,
				height: packet.height,
				captureId: packet.captureId,
				sceneMode: packet.sceneMode,
				counts: packet.counts,
				source: packet.source,
				geometry: packet.geometry,
				sceneColorPolicy: packet.sceneColorPolicy,
			},
		},
		threeRevision: THREE.REVISION,
		webgl: shaderResult.webgl,
		packetSummary: {
			width: packet.width,
			height: packet.height,
			captureId: packet.captureId,
			sceneMode: packet.sceneMode,
			rowOrder: packet.rowOrder,
			counts: packet.counts,
			source: packet.source,
			geometry: packet.geometry,
		},
		surfacePolicy,
		composeSceneColor,
		includeSecondOrder,
		textureInputs: shaderResult.textureInputs,
		outputSummary: summarizeRgba8(shaderResult.readbackRgba8),
		selectedChecks,
		maxSelectedRgbDelta,
		criteria,
		summary,
	};
}

function summarizeRgba8(rgba8) {
	let minByte = 255;
	let maxByte = 0;
	let luminanceSum = 0;
	let alphaMin = 255;
	let alphaMax = 0;
	const pixelCount = Math.floor(rgba8.length / 4);

	for (let index = 0; index < pixelCount; index += 1) {
		const offset = index * 4;
		const r = rgba8[offset];
		const g = rgba8[offset + 1];
		const b = rgba8[offset + 2];
		const a = rgba8[offset + 3];
		minByte = Math.min(minByte, r, g, b);
		maxByte = Math.max(maxByte, r, g, b);
		alphaMin = Math.min(alphaMin, a);
		alphaMax = Math.max(alphaMax, a);
		luminanceSum += r * 0.2126 + g * 0.7152 + b * 0.0722;
	}

	return {
		pixelCount,
		minByte,
		maxByte,
		alphaMin,
		alphaMax,
		meanLuminance: pixelCount > 0 ? luminanceSum / pixelCount : 0,
	};
}

function disposeSceneSetup(sceneSetup) {
	if (!sceneSetup) {
		return;
	}
	for (const mesh of sceneSetup.meshes || []) {
		mesh.geometry?.dispose?.();
		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const material of materials) {
			material?.dispose?.();
		}
	}
	sceneSetup.renderer?.dispose?.();
}

const MOUNTAIN_VIEW_MODES = Object.freeze({
	frontHighSun: 'front-high-sun',
	sunsetBehindCamera: 'sunset-behind-camera',
});

const LOW_SUN_CASE = Object.freeze({
	id: 'figure1-06h00-z87',
	sourceTimeOfDay: '06h00',
	sourceSunZenithDegrees: 87,
	sunAltitudeDegrees: 3,
	sunAzimuthDegrees: -25.83454348280912,
	role: 'sunrise/sunset stress case',
});

const MOUNTAIN_RIDGE_SCENE = Object.freeze({
	cameraPositionMeters: [0, 350, 1400],
	lookAtMeters: [0, 260, -36000],
	verticalFovDegrees: 42,
	nearMeters: 0.1,
	farMeters: 150000,
	valleyFloor: {
		id: 'mountain-valley-floor',
		widthMeters: 140000,
		depthMeters: 160000,
		centerMeters: [0, 0, -36000],
		spectrumId: 'mountainRidgeGreen',
	},
});

const MOUNTAIN_RIDGE_DEFINITIONS = [
	{
		id: 'foreground-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -5600,
		bottomMeters: -6000,
		baseHeightMeters: 70,
		amplitudeMeters: 150,
		secondaryAmplitudeMeters: 70,
		frequency: 1.85,
		phase: 0.35,
		peakT: 0.44,
		peakHeightMeters: 120,
		peakWidth: 0.18,
	},
	{
		id: 'near-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -9800,
		bottomMeters: -6000,
		baseHeightMeters: 280,
		amplitudeMeters: 260,
		secondaryAmplitudeMeters: 110,
		frequency: 2.15,
		phase: 1.6,
		peakT: 0.58,
		peakHeightMeters: 190,
		peakWidth: 0.2,
	},
	{
		id: 'near-valley-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -15500,
		bottomMeters: -7000,
		baseHeightMeters: 620,
		amplitudeMeters: 370,
		secondaryAmplitudeMeters: 160,
		frequency: 2.9,
		phase: 2.25,
		peakT: 0.34,
		peakHeightMeters: 260,
		peakWidth: 0.18,
	},
	{
		id: 'middle-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -26000,
		bottomMeters: -7600,
		baseHeightMeters: 1060,
		amplitudeMeters: 480,
		secondaryAmplitudeMeters: 180,
		frequency: 2.35,
		phase: 0.85,
		peakT: 0.54,
		peakHeightMeters: 340,
		peakWidth: 0.24,
	},
	{
		id: 'far-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -43000,
		bottomMeters: -8000,
		baseHeightMeters: 1850,
		amplitudeMeters: 610,
		secondaryAmplitudeMeters: 210,
		frequency: 2.75,
		phase: 2.85,
		peakT: 0.68,
		peakHeightMeters: 440,
		peakWidth: 0.2,
	},
	{
		id: 'horizon-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -72000,
		bottomMeters: -8500,
		baseHeightMeters: 3200,
		amplitudeMeters: 620,
		secondaryAmplitudeMeters: 210,
		frequency: 3.15,
		phase: 1.2,
		peakT: 0.48,
		peakHeightMeters: 520,
		peakWidth: 0.28,
	},
];

function createMountainShaderScene(canvas, options = {}) {
	canvas.width = options.width || 240;
	canvas.height = options.height || 135;

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		preserveDrawingBuffer: true,
	});
	renderer.setSize(canvas.width, canvas.height, false);
	renderer.setPixelRatio(1);
	renderer.setClearColor(0x87a9d8, 1);

	const mountainView = mountainShaderCameraConfig(options.mountainView);
	const camera = new THREE.PerspectiveCamera(
		mountainView.verticalFovDegrees,
		canvas.width / canvas.height,
		MOUNTAIN_RIDGE_SCENE.nearMeters,
		MOUNTAIN_RIDGE_SCENE.farMeters
	);
	camera.position.fromArray(mountainView.cameraPositionMeters);
	camera.lookAt(new THREE.Vector3(...mountainView.lookAtMeters));
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	return {
		renderer,
		camera,
		mountainView,
		sunCase: mountainView.renderSunCase,
		sceneObjects: MOUNTAIN_RIDGE_DEFINITIONS.map((definition) => ({
			id: definition.id,
			kind: 'mountain-ridge',
			spectrumId: 'mountainRidgeGreen',
			zMeters: definition.zMeters,
			xMinMeters: definition.xMinMeters,
			xMaxMeters: definition.xMaxMeters,
		})),
		ground: {
			id: MOUNTAIN_RIDGE_SCENE.valleyFloor.id,
			kind: 'mountain-valley-floor',
			spectrumId: MOUNTAIN_RIDGE_SCENE.valleyFloor.spectrumId,
			centerMeters: MOUNTAIN_RIDGE_SCENE.valleyFloor.centerMeters,
			widthMeters: MOUNTAIN_RIDGE_SCENE.valleyFloor.widthMeters,
			depthMeters: MOUNTAIN_RIDGE_SCENE.valleyFloor.depthMeters,
		},
	};
}

function createMountainLitScene(canvas, options = {}) {
	canvas.width = options.width || 320;
	canvas.height = options.height || 180;

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		preserveDrawingBuffer: true,
	});
	renderer.setSize(canvas.width, canvas.height, false);
	renderer.setPixelRatio(1);
	renderer.setClearColor(0x87a9d8, 1);
	if ('toneMapping' in renderer) {
		renderer.toneMapping = THREE.NoToneMapping;
	}

	const mountainView = mountainLitCameraConfig({
		mountainViewId: options.mountainView,
		cameraViewMode: options.cameraViewMode,
		sourcePacket: options.sourcePacket,
		sceneDetailSpec: options.sceneDetailSpec,
	});
	const camera = new THREE.PerspectiveCamera(
		mountainView.verticalFovDegrees,
		canvas.width / canvas.height,
		MOUNTAIN_RIDGE_SCENE.nearMeters,
		MOUNTAIN_RIDGE_SCENE.farMeters
	);
	camera.position.fromArray(mountainView.cameraPositionMeters);
	camera.lookAt(new THREE.Vector3(...mountainView.lookAtMeters));
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x87a9d8);
	const meshes = [];
	const sceneObjects = [];
	const detailSetup =
		options.sceneDetailSpec?.kind === 'mountain-detail-v1'
			? addDetailedMountainTerrain({
					scene,
					meshes,
					sceneObjects,
					detailSpec: options.sceneDetailSpec,
				})
			: addDefaultMountainLitRidges({
					scene,
					meshes,
					sceneObjects,
				});

	const ambient = new THREE.AmbientLight(
		0xffffff,
		options.sceneDetailSpec?.ambientIntensity ?? 0.04
	);
	scene.add(ambient);
	const sceneLightPacket = addMountainSourceLight({
		scene,
		sourcePacket: options.sourcePacket,
		targetMeters: mountainView.lookAtMeters,
	});

	return {
		renderer,
		scene,
		camera,
		meshes,
		mountainView,
		sceneObjects,
		ground: detailSetup.ground,
		sceneDetailPacket: detailSetup.sceneDetailPacket,
		sceneLightPacket: {
			...sceneLightPacket,
			ambientIntensity: ambient.intensity,
		},
	};
}

function addDefaultMountainLitRidges({ scene, meshes, sceneObjects }) {
	const floorDefinition = MOUNTAIN_RIDGE_SCENE.valleyFloor;
	const floorGeometry = new THREE.PlaneGeometry(
		floorDefinition.widthMeters,
		floorDefinition.depthMeters
	);
	const floorMaterial = new THREE.MeshStandardMaterial({
		color: 0x596a50,
		roughness: 0.96,
		metalness: 0,
		side: THREE.DoubleSide,
	});
	const groundMesh = new THREE.Mesh(floorGeometry, floorMaterial);
	groundMesh.name = floorDefinition.id;
	groundMesh.rotation.x = -Math.PI / 2;
	groundMesh.position.fromArray(floorDefinition.centerMeters);
	groundMesh.userData = {
		kind: 'ground',
		spectrumId: floorDefinition.spectrumId,
		normal: [0, 1, 0],
	};
	groundMesh.updateMatrixWorld(true);
	scene.add(groundMesh);
	meshes.push(groundMesh);

	for (let index = 0; index < MOUNTAIN_RIDGE_DEFINITIONS.length; index += 1) {
		const definition = MOUNTAIN_RIDGE_DEFINITIONS[index];
		const geometry = createMountainLitRidgeGeometry(definition);
		const material = new THREE.MeshStandardMaterial({
			color: mountainLitRidgeColor(index),
			roughness: 0.92,
			metalness: 0,
			side: THREE.DoubleSide,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.name = definition.id;
		mesh.position.set(0, 0, definition.zMeters);
		mesh.userData = {
			kind: 'mountain-ridge',
			spectrumId: 'mountainRidgeGreen',
			zMeters: definition.zMeters,
		};
		mesh.updateMatrixWorld(true);
		scene.add(mesh);
		meshes.push(mesh);
		sceneObjects.push({
			id: definition.id,
			kind: 'mountain-ridge',
			spectrumId: 'mountainRidgeGreen',
			zMeters: definition.zMeters,
			xMinMeters: definition.xMinMeters,
			xMaxMeters: definition.xMaxMeters,
		});
	}

	return {
		ground: {
			id: groundMesh.name,
			kind: groundMesh.userData.kind,
			spectrumId: groundMesh.userData.spectrumId,
			centerMeters: floorDefinition.centerMeters,
			widthMeters: floorDefinition.widthMeters,
			depthMeters: floorDefinition.depthMeters,
		},
		sceneDetailPacket: null,
	};
}

function addDetailedMountainTerrain({ scene, meshes, sceneObjects, detailSpec }) {
	let bottomGround = null;
	if (detailSpec.bottomGround) {
		bottomGround = detailedBottomGroundMesh(detailSpec.bottomGround);
		scene.add(bottomGround);
		meshes.push(bottomGround);
		sceneObjects.push({
			id: detailSpec.bottomGround.id,
			kind: detailSpec.bottomGround.kind,
			spectrumId: detailSpec.bottomGround.spectrumId,
			centerMeters: detailSpec.bottomGround.centerMeters,
			widthMeters: detailSpec.bottomGround.widthMeters,
			depthMeters: detailSpec.bottomGround.depthMeters,
			bounds: detailSpec.bottomGround.bounds,
		});
	}

	const groundMesh = detailedTerrainMesh({
		meshSpec: detailSpec.floor,
		kind: 'ground',
	});
	scene.add(groundMesh);
	meshes.push(groundMesh);
	sceneObjects.push({
		id: detailSpec.floor.id,
		kind: detailSpec.floor.kind,
		spectrumId: detailSpec.floor.spectrumId,
		bounds: detailSpec.floor.bounds,
		vertexCount: detailSpec.floor.vertexCount,
		triangleCount: detailSpec.floor.triangleCount,
		topology: detailSpec.summary?.meshTopology || 'terrain-heightfield',
	});

	for (const band of detailSpec.terrainBands) {
		const mesh = detailedTerrainMesh({
			meshSpec: band,
			kind: 'mountain-detail-terrain',
		});
		scene.add(mesh);
		meshes.push(mesh);
		sceneObjects.push({
			id: band.id,
			kind: band.kind,
			spectrumId: band.spectrumId,
			bounds: band.bounds,
			vertexCount: band.vertexCount,
			triangleCount: band.triangleCount,
		});
	}

	return {
		ground: {
			id: groundMesh.name,
			kind: groundMesh.userData.kind,
			spectrumId: groundMesh.userData.spectrumId,
			bounds: detailSpec.floor.bounds,
			vertexCount: detailSpec.floor.vertexCount,
			triangleCount: detailSpec.floor.triangleCount,
			bottomGround: bottomGround
				? {
						id: bottomGround.name,
						kind: bottomGround.userData.kind,
						spectrumId: bottomGround.userData.spectrumId,
						bounds: detailSpec.bottomGround.bounds,
					}
				: null,
		},
		sceneDetailPacket: {
			kind: detailSpec.kind,
			seed: detailSpec.seed,
			numericSeed: detailSpec.numericSeed,
			generatedBy: detailSpec.generatedBy,
			coordinateSystem: detailSpec.coordinateSystem,
			summary: detailSpec.summary,
		},
	};
}

function detailedBottomGroundMesh(groundSpec) {
	const geometry = new THREE.PlaneGeometry(
		groundSpec.widthMeters,
		groundSpec.depthMeters
	);
	const material = new THREE.MeshStandardMaterial({
		color: new THREE.Color(
			groundSpec.color?.[0] ?? 0.055,
			groundSpec.color?.[1] ?? 0.115,
			groundSpec.color?.[2] ?? 0.055
		),
		roughness: groundSpec.material?.roughness ?? 0.98,
		metalness: groundSpec.material?.metalness ?? 0,
		side: THREE.DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.name = groundSpec.id;
	mesh.rotation.x = -Math.PI / 2;
	mesh.position.fromArray(groundSpec.centerMeters);
	mesh.userData = {
		kind: 'ground',
		spectrumId: groundSpec.spectrumId,
		detailKind: groundSpec.kind,
		bounds: groundSpec.bounds,
		normal: [0, 1, 0],
	};
	mesh.updateMatrixWorld(true);
	return mesh;
}

function detailedTerrainMesh({ meshSpec, kind }) {
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute(
		'position',
		new THREE.Float32BufferAttribute(meshSpec.positions, 3)
	);
	geometry.setAttribute(
		'color',
		new THREE.Float32BufferAttribute(meshSpec.colors, 3)
	);
	geometry.setIndex(meshSpec.indices);
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();

	const material = new THREE.MeshStandardMaterial({
		vertexColors: true,
		roughness: meshSpec.material?.roughness ?? 0.94,
		metalness: meshSpec.material?.metalness ?? 0,
		side: THREE.DoubleSide,
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.name = meshSpec.id;
	mesh.userData = {
		kind,
		spectrumId: meshSpec.spectrumId,
		detailKind: meshSpec.kind,
		bounds: meshSpec.bounds,
	};
	mesh.updateMatrixWorld(true);
	return mesh;
}

function mountainLitCameraConfig({
	mountainViewId,
	cameraViewMode,
	sourcePacket,
	sceneDetailSpec,
}) {
	if (cameraViewMode === 'source-behind-camera' && sourcePacket) {
		const directionToSourceThree = directionToSourceThreeFromSourcePacket(
			sourcePacket
		);
		const horizontal = new THREE.Vector3(
			directionToSourceThree[0],
			0,
			directionToSourceThree[2]
		).normalize();
		const cameraPosition = new THREE.Vector3(
			...MOUNTAIN_RIDGE_SCENE.cameraPositionMeters
		);
		const lookAt = cameraPosition
			.clone()
			.add(horizontal.clone().multiplyScalar(-36000));
		lookAt.y = MOUNTAIN_RIDGE_SCENE.lookAtMeters[1];
		return {
			id: 'source-behind-camera',
			cameraPositionMeters: vectorToArray(cameraPosition),
			lookAtMeters: vectorToArray(lookAt),
			verticalFovDegrees: MOUNTAIN_RIDGE_SCENE.verticalFovDegrees,
			description:
				'Mountain view rotated so the configured source is behind the camera.',
			sourceDirectionThree: directionToSourceThree,
		};
	}

	const baseView = mountainShaderCameraConfig(mountainViewId);
	if (sceneDetailSpec?.kind === 'mountain-detail-v1') {
		return {
			...baseView,
			id: `${baseView.id || mountainViewId}-detail-elevated`,
			cameraPositionMeters: [
				baseView.cameraPositionMeters[0],
				6200,
				baseView.cameraPositionMeters[2],
			],
			lookAtMeters: [baseView.lookAtMeters[0], 6200, -15000],
			description:
				'Detail terrain view with elevated camera and near-level sightline.',
		};
	}

	return baseView;
}

function createMountainLitRidgeGeometry(definition) {
	const shape = new THREE.Shape();
	const segmentCount = 72;
	shape.moveTo(definition.xMinMeters, definition.bottomMeters);
	for (let index = 0; index <= segmentCount; index += 1) {
		const t = index / segmentCount;
		shape.lineTo(
			interpolateLinear(definition.xMinMeters, definition.xMaxMeters, t),
			ridgeHeightAt(definition, t)
		);
	}
	shape.lineTo(definition.xMaxMeters, definition.bottomMeters);
	shape.lineTo(definition.xMinMeters, definition.bottomMeters);
	return new THREE.ShapeGeometry(shape);
}

function interpolateLinear(a, b, t) {
	return a + (b - a) * t;
}

function mountainLitRidgeColor(index) {
	const colors = [0x4f5d49, 0x58684f, 0x617258, 0x687a5d, 0x708164, 0x78886c];
	return colors[Math.min(index, colors.length - 1)];
}

function addMountainSourceLight({ scene, sourcePacket, targetMeters }) {
	if (sourcePacket?.kind === 'flat-local-point-sun') {
		const positionMeters = algorithmPositionToThreeArray(
			sourcePacket.positionMeters
		);
		const intensity = 2.4 * (sourcePacket.observerIncidentScale ?? 1);
		const light = new THREE.PointLight(0xffffff, intensity, 0, 0);
		light.position.fromArray(positionMeters);
		light.userData.algorithm32SourceLight = true;
		scene.add(light);
		return {
			kind: 'source-driven-flat-local-point-light',
			mode: 'flat-local-point-sun',
			color: 0xffffff,
			colorRgb: [1, 1, 1],
			intensity,
			calibrationScalar: 2.4,
			observerIncidentScale: sourcePacket.observerIncidentScale ?? 1,
			positionMeters,
			configuredAlgorithmPositionMeters: sourcePacket.positionMeters,
			distanceAttenuationPolicy:
				'PointLight uses decay=0 for this subjective scene; configured local source distance/falloff is already folded into observerIncidentScale for scene brightness, while Algorithm32 still samples the true finite source.',
		};
	}

	const sourceDirectionAlgorithm =
		sourcePacket?.sunDirection || sunDirection(DIRECT_RADIANCE_SUN_CASE);
	const directionToSourceThree = algorithmDirectionToThreeArray(
		sourceDirectionAlgorithm
	);
	const target = targetMeters || [0, 0, -36000];
	const positionMeters = addArrays(
		target,
		directionToSourceThree.map((value) => value * 120000)
	);
	const lightTravelDirectionThree = normalize(
		subtractArrays(target, positionMeters)
	);
	const light = new THREE.DirectionalLight(0xffffff, 2.4);
	light.position.fromArray(positionMeters);
	light.target.position.fromArray(target);
	light.userData.algorithm32SourceLight = true;
	light.target.userData.algorithm32SourceLight = true;
	scene.add(light);
	scene.add(light.target);
	return {
		kind: 'source-driven-distant-directional-light',
		mode: 'distant-directional-sun',
		sunCase: sourcePacket?.sunCase || DIRECT_RADIANCE_SUN_CASE.id,
		color: 0xffffff,
		colorRgb: [1, 1, 1],
		intensity: light.intensity,
		calibrationScalar: 2.4,
		positionMeters,
		targetMeters: target,
		sourceDirectionAlgorithm,
		directionToSourceThree,
		lightTravelDirectionThree,
		sourceLightAgreement: {
			expectedLightTravelDirectionThree: directionToSourceThree.map(
				(value) => -value
			),
			lightTravelDirectionDelta: maxAbsArrayDelta(
				lightTravelDirectionThree,
				directionToSourceThree.map((value) => -value)
			),
			directionToSourceThree,
		},
	};
}

function resolveMountainLitSourcePacket(payload) {
	if (payload.sourcePacket) {
		return payload.sourcePacket;
	}
	const sunCase = resolveDistantSunCase(payload.sunCase);
	return makeDistantSunSourcePacket(sunCase);
}

function directionToSourceThreeFromSourcePacket(sourcePacket) {
	if (sourcePacket.kind === 'flat-local-point-sun') {
		const position = sourcePacket.positionMeters || [0, 0, 1];
		const observer = sourcePacket.observerPositionMeters || [0, 0, 2];
		return algorithmDirectionToThreeArray(
			normalize(subtractArrays(position, observer))
		);
	}
	return algorithmDirectionToThreeArray(
		sourcePacket.sunDirection || sunDirection(DIRECT_RADIANCE_SUN_CASE)
	);
}

function algorithmPositionToThreeArray(position) {
	return [position[0], position[2], -position[1]];
}

function mountainShaderCameraConfig(mountainViewId) {
	const baseConfig = {
		id: MOUNTAIN_VIEW_MODES.frontHighSun,
		cameraPositionMeters: MOUNTAIN_RIDGE_SCENE.cameraPositionMeters,
		lookAtMeters: MOUNTAIN_RIDGE_SCENE.lookAtMeters,
		verticalFovDegrees: MOUNTAIN_RIDGE_SCENE.verticalFovDegrees,
		renderSunCase: DIRECT_RADIANCE_SUN_CASE,
		description: 'Front-facing mountain range under the high-Sun Figure 1 case.',
	};

	if (mountainViewId !== MOUNTAIN_VIEW_MODES.sunsetBehindCamera) {
		return baseConfig;
	}

	const sunThree = new THREE.Vector3(...algorithmDirectionToThreeArray(sunDirection(LOW_SUN_CASE)));
	const sunHorizontal = new THREE.Vector3(sunThree.x, 0, sunThree.z).normalize();
	const cameraPosition = new THREE.Vector3(...MOUNTAIN_RIDGE_SCENE.cameraPositionMeters);
	const lookAt = cameraPosition
		.clone()
		.add(sunHorizontal.clone().multiplyScalar(-36000));
	lookAt.y = MOUNTAIN_RIDGE_SCENE.lookAtMeters[1];

	return {
		id: MOUNTAIN_VIEW_MODES.sunsetBehindCamera,
		cameraPositionMeters: vectorToArray(cameraPosition),
		lookAtMeters: vectorToArray(lookAt),
		verticalFovDegrees: MOUNTAIN_RIDGE_SCENE.verticalFovDegrees,
		renderSunCase: LOW_SUN_CASE,
		description:
			'Oblique mountain range view using the low-Sun Figure 1 case with the Sun behind the camera.',
		sunDirectionThree: vectorToArray(sunThree),
	};
}

function sampleBaselinePixels({ canvas, renderer, camera, meshes, cardMeshes }) {
	const raycaster = new THREE.Raycaster();
	const gl = renderer.getContext();
	const sampleDefinitions = [
		{ id: 'upper-sky', x: Math.floor(canvas.width * 0.5), y: Math.floor(canvas.height * 0.16) },
		...cardMeshes.map((mesh) => ({
			id: mesh.name,
			...worldToPixel(mesh.position, camera, canvas),
		})),
		{ id: 'ground', x: Math.floor(canvas.width * 0.5), y: Math.floor(canvas.height * 0.78) },
	];

	return sampleDefinitions.map((sample) => {
		const ndc = pixelToNdc(sample.x, sample.y, canvas.width, canvas.height);
		raycaster.setFromCamera(ndc, camera);
		const hits = raycaster.intersectObjects(meshes, false);
		const hit = hits.length > 0 ? hits[0] : null;
		const rgba = readRendererPixel(gl, sample.x, sample.y, canvas.height);

		return {
			id: sample.id,
			x: sample.x,
			y: sample.y,
			ndc,
			rgba,
			classification: hit ? hit.object.userData.kind : 'sky',
			hitObject: hit?.object?.name || null,
			spectrumId: hit?.object?.userData?.spectrumId || null,
			hitDistanceMeters: hit?.distance || null,
			threeRay: {
				origin: vectorToArray(raycaster.ray.origin),
				direction: vectorToArray(raycaster.ray.direction),
			},
		};
	});
}

function buildSceneInputTextureData({ canvas, camera, meshes }) {
	const raycaster = new THREE.Raycaster();
	const width = canvas.width;
	const height = canvas.height;
	const data = new Float32Array(width * height * 4);
	const countsBySpectrum = new Map();
	let skyPixels = 0;
	let hitPixels = 0;
	let minHitDistanceMeters = Number.POSITIVE_INFINITY;
	let maxHitDistanceMeters = 0;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const ndc = pixelToNdc(x, y, width, height);
			raycaster.setFromCamera(ndc, camera);
			const hits = raycaster.intersectObjects(meshes, false);
			const hit = hits.length > 0 ? hits[0] : null;
			const textureY = height - y - 1;
			const offset = (textureY * width + x) * 4;

			if (hit) {
				const spectrumId = spectrumNumericId(hit.object.userData?.spectrumId);
				data[offset] = hit.distance;
				data[offset + 1] = spectrumId;
				data[offset + 2] = 1;
				data[offset + 3] = 0;
				hitPixels += 1;
				minHitDistanceMeters = Math.min(minHitDistanceMeters, hit.distance);
				maxHitDistanceMeters = Math.max(maxHitDistanceMeters, hit.distance);
				countsBySpectrum.set(
					spectrumId,
					(countsBySpectrum.get(spectrumId) || 0) + 1
				);
			} else {
				data[offset] = -1;
				data[offset + 1] = 0;
				data[offset + 2] = 0;
				data[offset + 3] = 0;
				skyPixels += 1;
			}
		}
	}

	return {
		width,
		height,
		data,
		policy:
			'per-pixel Three Raycaster object distance and numeric spectrum id texture',
		channels: {
			r: 'hit distance in meters, or -1 for sky',
			g: 'numeric spectrum id matching the shader objectRadianceAt table',
			b: 'hit flag, 1 for object/ground and 0 for sky',
			a: 'reserved',
		},
		counts: {
			skyPixels,
			hitPixels,
			bySpectrumId: Object.fromEntries(
				[...countsBySpectrum.entries()].sort((a, b) => a[0] - b[0])
			),
		},
		hitDistanceMeters: {
			min: hitPixels > 0 ? minHitDistanceMeters : null,
			max: hitPixels > 0 ? maxHitDistanceMeters : null,
		},
	};
}

function buildGpuSceneInputTextureData({ renderer, scene, camera, meshes }) {
	const gl = renderer.getContext();
	const floatRenderTargetExtension = gl.getExtension('EXT_color_buffer_float');

	if (!floatRenderTargetExtension) {
		throw new Error('EXT_color_buffer_float unavailable for GPU scene input texture.');
	}

	const width = renderer.domElement.width;
	const height = renderer.domElement.height;
	const renderTarget = new THREE.WebGLRenderTarget(width, height, {
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		depthBuffer: true,
		stencilBuffer: false,
	});
	const originalClearColor = new THREE.Color();
	renderer.getClearColor(originalClearColor);
	const originalClearAlpha = renderer.getClearAlpha();
	const originalRenderTarget = renderer.getRenderTarget();
	const originalBackground = scene.background;
	const originalMaterials = meshes.map((mesh) => ({
		mesh,
		material: mesh.material,
	}));

	try {
		for (const mesh of meshes) {
			mesh.material = createSceneInputMaterial({
				spectrumId: spectrumNumericId(mesh.userData?.spectrumId),
				cameraPosition: camera.position,
				side: mesh.material.side,
			});
		}

		renderer.setRenderTarget(renderTarget);
		renderer.setClearColor(0x000000, 0);
		scene.background = null;
		renderer.clear(true, true, true);
		renderer.render(scene, camera);
		const data = new Float32Array(width * height * 4);
		renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, data);

		return summarizeSceneInputTextureData({
			width,
			height,
			data,
			policy:
				'per-pixel GPU render-target scene input: fragment distance from camera and numeric spectrum id',
			channels: {
				r: 'fragment distance from camera in meters, or 0 for sky clear pixels',
				g: 'numeric spectrum id matching the shader objectRadianceAt table',
				b: 'hit flag, 1 for rendered object/ground and 0 for sky clear pixels',
				a: 'reserved',
			},
			source: {
				kind: 'three-gpu-render-target-readback',
				floatRenderTargetExtension: 'EXT_color_buffer_float',
			},
		});
	} finally {
		for (const { mesh, material } of originalMaterials) {
			mesh.material.dispose();
			mesh.material = material;
		}
		renderer.setRenderTarget(originalRenderTarget);
		scene.background = originalBackground;
		renderer.setClearColor(originalClearColor, originalClearAlpha);
		renderTarget.dispose();
	}
}

function buildGpuSceneInputRenderTarget({ renderer, scene, camera, meshes }) {
	const gl = renderer.getContext();
	const floatRenderTargetExtension = gl.getExtension('EXT_color_buffer_float');

	if (!floatRenderTargetExtension) {
		throw new Error('EXT_color_buffer_float unavailable for direct GPU scene input texture.');
	}

	const width = renderer.domElement.width;
	const height = renderer.domElement.height;
	const renderTarget = new THREE.WebGLRenderTarget(width, height, {
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		depthBuffer: true,
		stencilBuffer: false,
	});
	const originalClearColor = new THREE.Color();
	renderer.getClearColor(originalClearColor);
	const originalClearAlpha = renderer.getClearAlpha();
	const originalRenderTarget = renderer.getRenderTarget();
	const originalBackground = scene.background;
	const originalMaterials = meshes.map((mesh) => ({
		mesh,
		material: mesh.material,
	}));

	try {
		for (const mesh of meshes) {
			mesh.material = createSceneInputMaterial({
				spectrumId: spectrumNumericId(mesh.userData?.spectrumId),
				cameraPosition: camera.position,
				side: mesh.material.side,
			});
		}

		renderer.setRenderTarget(renderTarget);
		renderer.setClearColor(0x000000, 0);
		scene.background = null;
		renderer.clear(true, true, true);
		renderer.render(scene, camera);
		renderer.setRenderTarget(originalRenderTarget);
		const textureProperties = renderer.properties.get(renderTarget.texture);
		const textureHandle = textureProperties.__webglTexture;

		if (!textureHandle) {
			throw new Error('Three render target WebGL texture handle was unavailable.');
		}

		return {
			textureHandle,
			metadata: {
				width,
				height,
				policy:
					'per-pixel GPU render-target scene input bound directly as a WebGL texture: fragment distance from camera and numeric spectrum id',
				channels: {
					r: 'fragment distance from camera in meters, or 0 for sky clear pixels',
					g: 'numeric spectrum id matching the shader objectRadianceAt table',
					b: 'hit flag, 1 for rendered object/ground and 0 for sky clear pixels',
					a: 'reserved',
				},
				source: {
					kind: 'three-gpu-render-target-direct-texture',
					floatRenderTargetExtension: 'EXT_color_buffer_float',
					readbackUsedForShaderInput: false,
				},
			},
			dispose() {
				renderTarget.dispose();
			},
		};
	} finally {
		for (const { mesh, material } of originalMaterials) {
			mesh.material.dispose();
			mesh.material = material;
		}
		renderer.setRenderTarget(originalRenderTarget);
		scene.background = originalBackground;
		renderer.setClearColor(originalClearColor, originalClearAlpha);
	}
}

function createSceneInputMaterial({ spectrumId, cameraPosition, side }) {
	return new THREE.ShaderMaterial({
		side,
		uniforms: {
			spectrumId: { value: spectrumId },
			cameraWorldPosition: { value: cameraPosition.clone() },
		},
		vertexShader: `
varying vec3 vWorldPosition;

void main() {
	vec4 worldPosition = modelMatrix * vec4(position, 1.0);
	vWorldPosition = worldPosition.xyz;
	gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`,
		fragmentShader: `
precision highp float;

uniform float spectrumId;
uniform vec3 cameraWorldPosition;
varying vec3 vWorldPosition;

void main() {
	float distanceMeters = length(vWorldPosition - cameraWorldPosition);
	gl_FragColor = vec4(distanceMeters, spectrumId, 1.0, 0.0);
}
`,
	});
}

function summarizeSceneInputTextureData({
	width,
	height,
	data,
	policy,
	channels,
	source,
}) {
	const countsBySpectrum = new Map();
	let skyPixels = 0;
	let hitPixels = 0;
	let minHitDistanceMeters = Number.POSITIVE_INFINITY;
	let maxHitDistanceMeters = 0;

	for (let index = 0; index < width * height; index += 1) {
		const offset = index * 4;
		const hitFlag = data[offset + 2] > 0.5;

		if (!hitFlag) {
			skyPixels += 1;
			continue;
		}

		const distanceMeters = data[offset];
		const spectrumId = Math.round(data[offset + 1]);
		hitPixels += 1;
		minHitDistanceMeters = Math.min(minHitDistanceMeters, distanceMeters);
		maxHitDistanceMeters = Math.max(maxHitDistanceMeters, distanceMeters);
		countsBySpectrum.set(
			spectrumId,
			(countsBySpectrum.get(spectrumId) || 0) + 1
		);
	}

	return {
		width,
		height,
		data,
		policy,
		channels,
		source,
		counts: {
			skyPixels,
			hitPixels,
			bySpectrumId: Object.fromEntries(
				[...countsBySpectrum.entries()].sort((a, b) => a[0] - b[0])
			),
		},
		hitDistanceMeters: {
			min: hitPixels > 0 ? minHitDistanceMeters : null,
			max: hitPixels > 0 ? maxHitDistanceMeters : null,
		},
	};
}

function sampleMountainShaderPixels({ canvas, renderer, camera }) {
	const raycaster = new THREE.Raycaster();
	const gl = renderer.getContext();
	const sampleDefinitions = [
		{ id: 'upper-sky', x: Math.floor(canvas.width * 0.5), y: Math.floor(canvas.height * 0.16) },
		{ id: 'distant-sky', x: Math.floor(canvas.width * 0.72), y: Math.floor(canvas.height * 0.33) },
		{ id: 'horizon-ridge-band', x: Math.floor(canvas.width * 0.5), y: Math.floor(canvas.height * 0.48) },
		{ id: 'left-valley', x: Math.floor(canvas.width * 0.27), y: Math.floor(canvas.height * 0.68) },
		{ id: 'foreground-valley', x: Math.floor(canvas.width * 0.5), y: Math.floor(canvas.height * 0.8) },
	];

	return sampleDefinitions.map((sample) => {
		const ndc = pixelToNdc(sample.x, sample.y, canvas.width, canvas.height);
		raycaster.setFromCamera(ndc, camera);
		const hit = intersectMountainSceneJs(
			vectorToArray(raycaster.ray.origin),
			vectorToArray(raycaster.ray.direction)
		);
		const rgba = readRendererPixel(gl, sample.x, sample.y, canvas.height);

		return {
			id: sample.id,
			x: sample.x,
			y: sample.y,
			ndc,
			rgba,
			classification: hit.kind,
			hitObject: hit.id,
			spectrumId: hit.spectrumId,
			hitDistanceMeters: hit.distanceMeters,
			threeRay: {
				origin: vectorToArray(raycaster.ray.origin),
				direction: vectorToArray(raycaster.ray.direction),
			},
		};
	});
}

function intersectMountainSceneJs(origin, direction) {
	let bestHit = {
		kind: 'sky',
		id: null,
		spectrumId: null,
		distanceMeters: null,
	};

	for (const definition of MOUNTAIN_RIDGE_DEFINITIONS) {
		if (Math.abs(direction[2]) < 1e-9) {
			continue;
		}
		const distance = (definition.zMeters - origin[2]) / direction[2];
		if (distance <= 0 || (bestHit.distanceMeters !== null && distance >= bestHit.distanceMeters)) {
			continue;
		}
		const hit = [
			origin[0] + direction[0] * distance,
			origin[1] + direction[1] * distance,
			origin[2] + direction[2] * distance,
		];
		const t = (hit[0] - definition.xMinMeters) /
			(definition.xMaxMeters - definition.xMinMeters);
		const height = ridgeHeightAt(definition, t);

		if (
			t >= 0 &&
			t <= 1 &&
			hit[1] >= definition.bottomMeters &&
			hit[1] <= height
		) {
			bestHit = {
				kind: 'mountain-ridge',
				id: definition.id,
				spectrumId: 'mountainRidgeGreen',
				distanceMeters: distance,
			};
		}
	}

	if (direction[1] < -1e-9) {
		const distance = -origin[1] / direction[1];
		const center = MOUNTAIN_RIDGE_SCENE.valleyFloor.centerMeters;
		const hit = [
			origin[0] + direction[0] * distance,
			origin[1] + direction[1] * distance,
			origin[2] + direction[2] * distance,
		];
		const inside =
			distance > 0 &&
			Math.abs(hit[0] - center[0]) <= MOUNTAIN_RIDGE_SCENE.valleyFloor.widthMeters * 0.5 &&
			Math.abs(hit[2] - center[2]) <= MOUNTAIN_RIDGE_SCENE.valleyFloor.depthMeters * 0.5;

		if (inside && (bestHit.distanceMeters === null || distance < bestHit.distanceMeters)) {
			bestHit = {
				kind: 'mountain-valley-floor',
				id: MOUNTAIN_RIDGE_SCENE.valleyFloor.id,
				spectrumId: 'mountainRidgeGreen',
				distanceMeters: distance,
			};
		}
	}

	return bestHit;
}

function ridgeHeightAt(definition, t) {
	const broadPeak =
		definition.peakHeightMeters *
		Math.exp(-(((t - definition.peakT) / definition.peakWidth) ** 2));
	const primary =
		definition.amplitudeMeters *
		(0.5 + 0.5 * Math.sin(2 * Math.PI * definition.frequency * t + definition.phase));
	const secondary =
		definition.secondaryAmplitudeMeters *
		(0.5 +
			0.5 *
				Math.sin(
					2 * Math.PI * (definition.frequency * 1.73) * t +
						definition.phase * 0.61
				));

	return definition.baseHeightMeters + primary + secondary + broadPeak;
}

function baselineDiagnostics({
	command,
	canvas,
	renderer,
	camera,
	cards,
	ground,
	selectedPixels,
	atmosphereComponents,
	atmosphereShaderDiagnostics,
	directRadianceDiagnostics,
	directRadianceShaderDiagnostics,
	directRadianceSpectralDiagnostics,
	directRadianceSpectralShaderDiagnostics,
	secondOrderRadianceDiagnostics,
	secondOrderRadianceShaderDiagnostics,
	secondOrderRadianceSpectralDiagnostics,
	secondOrderRadianceSpectralShaderDiagnostics,
}) {
	const gl = renderer.getContext();
	const status =
		selectedPixels.some((sample) => sample.classification === 'sky') &&
		selectedPixels.some((sample) => sample.classification !== 'sky')
			? 'accepted'
			: 'rejected';

	return {
		kind: 'browser-three-baseline-diagnostics',
		status,
		iteration: command?.payload?.iteration || '1-browser-three-scene-baseline',
		goal: command?.payload?.goal ||
			'Render a simple browser Three scene without atmosphere and return camera, color, and raycaster hit diagnostics.',
		commandPayload: command?.payload || null,
		threeRevision: THREE.REVISION,
		webgl: {
			version: gl.getParameter(gl.VERSION),
			shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
			vendor: gl.getParameter(gl.VENDOR),
			renderer: gl.getParameter(gl.RENDERER),
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		camera: {
			type: 'THREE.PerspectiveCamera',
			positionMeters: vectorToArray(camera.position),
			lookAtMeters: [0, 420, -5000],
			verticalFovDegrees: camera.fov,
			aspect: camera.aspect,
			near: camera.near,
			far: camera.far,
			projectionMatrix: camera.projectionMatrix.toArray(),
			matrixWorld: camera.matrixWorld.toArray(),
		},
		sceneObjects: cards,
		ground,
		selectedPixelSummary: selectedPixels.map((sample) => ({
			id: sample.id,
			classification: sample.classification,
			hitObject: sample.hitObject,
			hitDistanceMeters: sample.hitDistanceMeters,
			rgba: sample.rgba,
		})),
		atmosphereComponentSummary: atmosphereComponents
			? summarizeAtmosphereComponents(atmosphereComponents)
			: null,
		atmosphereShaderSummary: atmosphereShaderDiagnostics
			? summarizeAtmosphereShaderDiagnostics(atmosphereShaderDiagnostics)
			: null,
		directRadianceSummary: directRadianceDiagnostics
			? summarizeDirectRadianceDiagnostics(directRadianceDiagnostics)
			: null,
		directRadianceShaderSummary: directRadianceShaderDiagnostics
			? summarizeDirectRadianceShaderDiagnostics(directRadianceShaderDiagnostics)
			: null,
		directRadianceSpectralSummary: directRadianceSpectralDiagnostics
			? summarizeDirectRadianceSpectralDiagnostics(directRadianceSpectralDiagnostics)
			: null,
		directRadianceSpectralShaderSummary:
			directRadianceSpectralShaderDiagnostics
				? summarizeDirectRadianceSpectralShaderDiagnostics(
						directRadianceSpectralShaderDiagnostics
					)
				: null,
		secondOrderRadianceSummary: secondOrderRadianceDiagnostics
			? summarizeSecondOrderRadianceDiagnostics(secondOrderRadianceDiagnostics)
			: null,
		secondOrderRadianceShaderSummary: secondOrderRadianceShaderDiagnostics
			? summarizeSecondOrderRadianceShaderDiagnostics(
					secondOrderRadianceShaderDiagnostics
				)
			: null,
		secondOrderRadianceSpectralSummary: secondOrderRadianceSpectralDiagnostics
			? summarizeSecondOrderRadianceSpectralDiagnostics(
					secondOrderRadianceSpectralDiagnostics
				)
			: null,
		secondOrderRadianceSpectralShaderSummary:
			secondOrderRadianceSpectralShaderDiagnostics
				? summarizeSecondOrderRadianceSpectralShaderDiagnostics(
						secondOrderRadianceSpectralShaderDiagnostics
					)
				: null,
		absentByDesign: [
			command?.payload?.mode === 'browser-direct-radiance-spectral-diagnostics'
				? 'Direct radiance spectral diagnostics intentionally include first-order scattering only; second-order Algorithm32 approximation and image parity are deferred.'
			: command?.payload?.mode === 'browser-second-order-spectral-diagnostics'
				? 'Second-order spectral diagnostics intentionally use selected pixels before full image-level second-order parity.'
			: command?.payload?.mode === 'browser-second-order-diagnostics'
				? 'Second-order diagnostics intentionally use one wavelength at 532.333333333333 nm before full spectral or image-level second-order parity.'
			: command?.payload?.mode === 'browser-direct-radiance-diagnostics'
				? 'Direct radiance diagnostics intentionally include only first-order scattering at one wavelength; full spectral and second-order parity are deferred.'
			: command?.payload?.mode === 'browser-atmosphere-components'
				? 'Atmosphere component diagnostics stop at transmittance; no path radiance or final color yet.'
				: 'No atmosphere shader in Iteration 1.',
			'No CPU reference image or shader diff image in this baseline browser-scene artifact.',
			'Depth texture readback is deferred; raycaster hit distance is the equivalent object-hit diagnostic for this iteration.',
		],
	};
}

function mountainShaderImageDiagnostics({
	command,
	canvas,
	renderer,
	camera,
	mountainView,
	sunCase,
	sceneObjects,
	ground,
	selectedPixels,
	imageShaderDiagnostics,
}) {
	const gl = renderer.getContext();
	const includeSecondOrder = command?.payload?.includeSecondOrder === true;
	const hitSamples = selectedPixels.filter((sample) => sample.classification !== 'sky');
	const colorKeys = new Set(selectedPixels.map((sample) => sample.rgba.slice(0, 3).join(',')));
	const status =
		imageShaderDiagnostics.status === 'accepted' &&
		selectedPixels.some((sample) => sample.classification === 'sky') &&
		hitSamples.length > 0 &&
		colorKeys.size > 1
			? 'accepted'
			: 'rejected';

	return {
		kind: 'browser-mountain-shader-image-diagnostics',
		status,
		iteration: command?.payload?.iteration || 'subjective-mountain-shader-image',
		goal: command?.payload?.goal ||
			(includeSecondOrder
				? 'Render the subjective mountain scene through the second-order Algorithm32 browser shader path.'
				: 'Render the subjective mountain scene through the first-order spectral browser shader path.'),
		commandPayload: command?.payload || null,
		threeRevision: THREE.REVISION,
		webgl: {
			version: gl.getParameter(gl.VERSION),
			shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
			vendor: gl.getParameter(gl.VENDOR),
			renderer: gl.getParameter(gl.RENDERER),
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		camera: {
			type: 'THREE.PerspectiveCamera',
			positionMeters: vectorToArray(camera.position),
			lookAtMeters: mountainView.lookAtMeters,
			verticalFovDegrees: camera.fov,
			aspect: camera.aspect,
			near: camera.near,
			far: camera.far,
		},
		mountainView,
		sunCase: {
			...sunCase,
			sunDirection: sunDirection(sunCase),
		},
		sceneObjects,
		ground,
		imageShaderDiagnostics,
		selectedPixelSummary: selectedPixels.map((sample) => ({
			id: sample.id,
			classification: sample.classification,
			hitObject: sample.hitObject,
			hitDistanceMeters: sample.hitDistanceMeters,
			rgba: sample.rgba,
		})),
		absentByDesign: [
			includeSecondOrder
				? 'The shader image uses the current second-order Algorithm32 spectral browser shader path.'
				: 'The shader image uses the current first-order spectral browser shader path.',
			'The CPU Algorithm32 side-by-side reference is generated by the Node/Three reference runner and copied into the shader artifact by the post-processing helper.',
			includeSecondOrder
				? 'The shader still uses analytic procedural mountain intersections rather than a depth-buffer scene integration path.'
				: 'Algorithm32 second-order approximation is not implemented in this browser shader image.',
			'This subjective scene has no formal visual pass/fail criteria.',
		],
	};
}

function runBrowserFlatEarthVisibilitySearch(command, startedAt) {
	const canvas = document.getElementById('lab-canvas');
	const config = flatVisibilityConfig(command?.payload || {});
	const searchGrid = buildFlatVisibilityPixelGrid({
		width: config.search.width,
		height: config.search.height,
		config,
	});
	const searchResult = findFlatVisibilityDistance({ config, searchGrid });
	const panelGrid = buildFlatVisibilityPixelGrid({
		width: config.panels.width,
		height: config.panels.height,
		config,
	});
	const panelImages =
		config.visualizationMode === 'visibility-loss-gallery'
			? drawFlatVisibilityMilestoneGallery({
					canvas,
					config,
					panelGrid,
					searchResult,
				})
			: drawFlatVisibilityContactSheet({
					canvas,
					config,
					panelGrid,
					searchResult,
				});
	const selectedPixels = flatVisibilitySelectedPixels(searchResult);
	const diagnostics = flatVisibilityDiagnostics({
		command,
		config,
		searchResult,
		panelImages,
		searchGrid,
		panelGrid,
	});
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-browser-flat-earth-visibility-search-result',
		status: diagnostics.status,
		commandId: command?.id,
		commandLabel: command?.label,
		pageLoadCount: loadCount,
		timestamp: new Date().toISOString(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		imageDataUrl: canvas.toDataURL('image/png'),
		selectedPixels,
		diagnostics,
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
	};
}

function flatVisibilityConfig(payload) {
	const width = finitePositiveNumber(payload.width, 960);
	const height = finitePositiveNumber(payload.height, 360);
	const targetHeightMeters = finitePositiveNumber(
		payload.targetHeightMeters,
		10000
	);
	const targetWidthMeters = finitePositiveNumber(
		payload.targetWidthMeters,
		10000
	);

	return {
		iteration: payload.iteration ||
			'flat-earth-standard-atmosphere-visibility-search',
		goal: payload.goal ||
			'Find the closest flat-earth distance where a rendered object no longer changes the encoded image.',
		outputCanvas: {
			width,
			height,
		},
		visualizationMode: payload.visualizationMode || 'summary-contact-sheet',
		search: {
			width: finitePositiveInteger(payload.searchWidth, 180),
			height: finitePositiveInteger(payload.searchHeight, 90),
			minDistanceMeters: finitePositiveNumber(
				payload.minDistanceMeters,
				1000
			),
			initialHighDistanceMeters: finitePositiveNumber(
				payload.initialHighDistanceMeters,
				50000
			),
			maxDistanceMeters: finitePositiveNumber(
				payload.maxDistanceMeters,
				3000000
			),
			binaryIterations: finitePositiveInteger(
				payload.binaryIterations,
				24
			),
			visibilityBinaryIterations: finitePositiveInteger(
				payload.visibilityBinaryIterations,
				8
			),
			encodedRgbDeltaThreshold: finitePositiveNumber(
				payload.encodedRgbDeltaThreshold,
				1
			),
			visibilityLossFractions: Array.isArray(
				payload.visibilityLossPercents
			)
				? payload.visibilityLossPercents
						.map((percent) => Number(percent) / 100)
						.filter((fraction) => Number.isFinite(fraction) && fraction > 0 && fraction < 1)
				: [0.5, 0.75, 0.8, 0.9, 0.95],
		},
		panels: {
			width: finitePositiveInteger(payload.panelRenderWidth, 220),
			height: finitePositiveInteger(payload.panelRenderHeight, 150),
		},
		camera: {
			positionMeters: [0, 0, finitePositiveNumber(payload.cameraHeightMeters, 2)],
			forwardAxis: '+Y',
			upAxis: '+Z',
			verticalFovDegrees: finitePositiveNumber(
				payload.verticalFovDegrees,
				24
			),
			nearMeters: 0.1,
			farMeters: finitePositiveNumber(payload.maxDistanceMeters, 3000000),
		},
		target: {
			id: 'matte-black-vertical-card',
			shape: 'ground-anchored vertical rectangle on a plane perpendicular to the view forward axis',
			spectrumId: 'flatBlackCard',
			sourceRadiancePolicy: 'zero spectral radiance at every Algorithm32 wavelength',
			widthMeters: targetWidthMeters,
			heightMeters: targetHeightMeters,
			bottomAltitudeMeters: 0,
			topAltitudeMeters: targetHeightMeters,
		},
		background: {
			groundSpectrumId: 'ground',
			skyMaxDistanceMeters: finitePositiveNumber(
				payload.skyMaxDistanceMeters,
				2000000
			),
			flatAtmosphereTopHeightMeters:
				ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters,
		},
		sunCase: {
			...DIRECT_RADIANCE_SUN_CASE,
			sunDirection: sunDirection(DIRECT_RADIANCE_SUN_CASE),
		},
		atmospherePolicy: {
			earthGeometry: 'flat slab with altitude measured on the +Z axis',
			profile: 'standard Algorithm32 Rayleigh/Mie exponential atmosphere constants',
			scattering: 'first-order Rayleigh/Mie path radiance plus finite object transmittance',
			omittedTerms: [
				'spherical-shell curvature',
				'Algorithm32 second-order incident-sky approximation',
				'ground coupling',
				'direct solar-disc camera radiance',
				'ozone absorption',
			],
		},
		sourcePolicy: {
			sourceBacked: [
				'Algorithm32 Rayleigh and Mie density profiles and coefficients',
				'Beer-Lambert transmittance',
				'Rayleigh and Mie phase functions',
				'Algorithm32 15-channel spectral grid, CIE conversion, and Bruneton comparison display scalar',
			],
			flatExperimentChoices: [
				'Flat-slab geometry replaces the spherical top-atmosphere intersection for this experiment.',
				'Exponential optical length is integrated analytically along flat straight rays because altitude is linear in distance.',
				'The matte black card, camera FOV, image resolution, sky-path cap, and encoded RGB threshold are experimental controls, not atmosphere constants.',
			],
		},
	};
}

function finitePositiveNumber(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finitePositiveInteger(value, fallback) {
	return Number.isInteger(value) && value > 0 ? value : fallback;
}

function buildFlatVisibilityPixelGrid({ width, height, config }) {
	const pixels = new Array(width * height);
	let skyPixels = 0;
	let groundPixels = 0;
	let maxBackgroundDistanceMeters = 0;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const ray = flatCameraRayForPixel({
				x,
				y,
				width,
				height,
				camera: config.camera,
			});
			const background = flatBackgroundForRay({ ray, config });
			const offset = y * width + x;

			pixels[offset] = {
				x,
				y,
				ray,
				background,
			};
			if (background.kind === 'ground') {
				groundPixels += 1;
			} else {
				skyPixels += 1;
			}
			maxBackgroundDistanceMeters = Math.max(
				maxBackgroundDistanceMeters,
				background.distanceMeters
			);
		}
	}

	return {
		width,
		height,
		pixels,
		counts: {
			skyPixels,
			groundPixels,
			totalPixels: pixels.length,
		},
		maxBackgroundDistanceMeters,
	};
}

function flatCameraRayForPixel({ x, y, width, height, camera }) {
	const ndcX = ((x + 0.5) / width) * 2 - 1;
	const ndcY = 1 - ((y + 0.5) / height) * 2;
	const tanVertical = Math.tan(degreesToRadians(camera.verticalFovDegrees) / 2);
	const tanHorizontal = tanVertical * (width / height);
	const direction = normalize([
		ndcX * tanHorizontal,
		1,
		ndcY * tanVertical,
	]);

	return {
		origin: camera.positionMeters,
		direction,
		ndc: [ndcX, ndcY],
	};
}

function flatBackgroundForRay({ ray, config }) {
	const groundDistance = flatGroundIntersectionDistance(ray);

	if (groundDistance !== null) {
		return {
			kind: 'ground',
			distanceMeters: groundDistance,
			encodedRgb: flatTraceEncodedRgb({
				origin: ray.origin,
				direction: ray.direction,
				distanceMeters: groundDistance,
				objectSpectrumId: config.background.groundSpectrumId,
				sunRay: config.sunCase.sunDirection,
			}),
		};
	}

	const skyDistance = flatSkyPathDistance({ ray, config });

	return {
		kind: 'sky',
		distanceMeters: skyDistance.distanceMeters,
		distancePolicy: skyDistance.policy,
		encodedRgb: flatTraceEncodedRgb({
			origin: ray.origin,
			direction: ray.direction,
			distanceMeters: skyDistance.distanceMeters,
			objectSpectrumId: null,
			sunRay: config.sunCase.sunDirection,
		}),
	};
}

function flatSkyPathDistance({ ray, config }) {
	const topHeight = config.background.flatAtmosphereTopHeightMeters;
	const altitudeDirection = ray.direction[2];

	if (altitudeDirection > 1e-8) {
		const distanceToTop = Math.max(0, (topHeight - ray.origin[2]) / altitudeDirection);

		if (distanceToTop <= config.background.skyMaxDistanceMeters) {
			return {
				distanceMeters: distanceToTop,
				policy: 'flat top-atmosphere plane intersection',
			};
		}
	}

	return {
		distanceMeters: config.background.skyMaxDistanceMeters,
		policy: 'near-horizon flat-slab sky path capped after optical saturation',
	};
}

function flatGroundIntersectionDistance(ray) {
	const altitudeDirection = ray.direction[2];

	if (altitudeDirection >= -1e-9) {
		return null;
	}

	const distance = -ray.origin[2] / altitudeDirection;

	return distance > 0 ? distance : null;
}

function flatTargetIntersection({ ray, targetDistanceMeters, config }) {
	const forwardDirection = ray.direction[1];

	if (forwardDirection <= 1e-9) {
		return null;
	}

	const distanceMeters = targetDistanceMeters / forwardDirection;
	const groundDistance = flatGroundIntersectionDistance(ray);

	if (
		groundDistance !== null &&
		groundDistance < distanceMeters - 1e-6
	) {
		return null;
	}

	const hitPoint = addScaled(ray.origin, ray.direction, distanceMeters);

	if (
		Math.abs(hitPoint[0]) > config.target.widthMeters / 2 ||
		hitPoint[2] < config.target.bottomAltitudeMeters ||
		hitPoint[2] > config.target.topAltitudeMeters
	) {
		return null;
	}

	return {
		distanceMeters,
		hitPoint,
	};
}

function findFlatVisibilityDistance({ config, searchGrid }) {
	const evaluations = [];
	const evaluationByDistanceKey = new Map();
	const threshold = config.search.encodedRgbDeltaThreshold;
	const isInvisible = (evaluation) =>
		evaluation.objectPixelCount === 0 ||
		evaluation.maxAbsRgbDelta <= threshold;
	const evaluate = (distanceMeters) => {
		const key = distanceMeters.toFixed(6);
		const existing = evaluationByDistanceKey.get(key);

		if (existing) {
			return existing;
		}

		const evaluation = evaluateFlatVisibilityAtDistance({
			grid: searchGrid,
			config,
			distanceMeters,
		});
		evaluation.isInvisibleByCriterion = isInvisible(evaluation);
		evaluations.push(evaluation);
		evaluationByDistanceKey.set(key, evaluation);
		return evaluation;
	};
	let lowDistance = config.search.minDistanceMeters;
	let lowEvaluation = evaluate(lowDistance);
	let highDistance = Math.max(
		config.search.initialHighDistanceMeters,
		lowDistance * 2
	);
	let highEvaluation = lowEvaluation;
	let bracketStatus = 'unresolved';

	if (isInvisible(lowEvaluation)) {
		bracketStatus = 'minimum-distance-already-invisible';
		highDistance = lowDistance;
		highEvaluation = lowEvaluation;
	} else {
		while (highDistance <= config.search.maxDistanceMeters) {
			highEvaluation = evaluate(highDistance);
			if (isInvisible(highEvaluation)) {
				bracketStatus = 'bracketed';
				break;
			}
			lowDistance = highDistance;
			lowEvaluation = highEvaluation;
			highDistance = highDistance * 2 > config.search.maxDistanceMeters &&
				highDistance < config.search.maxDistanceMeters
				? config.search.maxDistanceMeters
				: highDistance * 2;
		}
	}

	if (
		bracketStatus === 'unresolved' &&
		!isInvisible(highEvaluation)
	) {
		const visibilityThresholds = computeFlatVisibilityRetainedThresholds({
			config,
			evaluate,
			baselineEvaluation: evaluations[0],
		});

		return {
			status: 'rejected',
			reason: 'No invisible distance was bracketed before maxDistanceMeters.',
			criterion: flatVisibilityCriterion(config),
			bracketStatus,
			lowEvaluation,
			highEvaluation,
			evaluations,
			validationSweep: [],
			visibilityThresholds,
		};
	}

	if (bracketStatus === 'bracketed') {
		for (let iteration = 0; iteration < config.search.binaryIterations; iteration += 1) {
			const midDistance = (lowDistance + highDistance) / 2;
			const midEvaluation = evaluate(midDistance);

			if (isInvisible(midEvaluation)) {
				highDistance = midDistance;
				highEvaluation = midEvaluation;
			} else {
				lowDistance = midDistance;
				lowEvaluation = midEvaluation;
			}
		}
	}

	const validationSweep = flatVisibilityValidationDistances({
		thresholdDistanceMeters: highDistance,
		config,
	}).map((distanceMeters) => evaluate(distanceMeters));
	const visibilityThresholds = computeFlatVisibilityRetainedThresholds({
		config,
		evaluate,
		baselineEvaluation: evaluations[0],
	});

	return {
		status: 'accepted',
		criterion: flatVisibilityCriterion(config),
		bracketStatus,
		lastVisible: lowEvaluation,
		firstInvisible: highEvaluation,
		thresholdDistanceMeters: highDistance,
		thresholdDistanceKilometers: highDistance / 1000,
		visibilityGapMeters: Math.max(0, highDistance - lowDistance),
		disappearanceDriver:
			highEvaluation.objectPixelCount === 0
				? 'target projects to zero covered pixels at the search resolution'
				: 'object-present and object-absent encoded images differ by no more than the display threshold',
		visibilityThresholds,
		evaluations,
		validationSweep,
	};
}

function computeFlatVisibilityRetainedThresholds({
	config,
	evaluate,
	baselineEvaluation,
}) {
	const baselineMetric = baselineEvaluation?.maxAbsRgbDelta || 0;

	if (baselineMetric <= 0) {
		return {
			status: 'rejected',
			reason: 'Baseline object-vs-background contrast was zero.',
			metric: 'maxAbsRgbDelta',
			baseline: baselineEvaluation || null,
			thresholds: [],
		};
	}

	const thresholds = config.search.visibilityLossFractions.map((lossFraction) =>
		findFlatVisibilityRetainedThreshold({
			config,
			evaluate,
			baselineEvaluation,
			baselineMetric,
			retainedFraction: 1 - lossFraction,
			visibilityLostFraction: lossFraction,
		})
	);

	return {
		status: thresholds.every((threshold) => threshold.status === 'accepted')
			? 'accepted'
			: 'partial',
		definition:
			'Requested visibility percentages are treated as percent lost. Remaining visible contrast is maxAbsRgbDelta(distance) divided by maxAbsRgbDelta at minDistanceMeters for the same no-object comparison.',
		metric: 'maxAbsRgbDelta',
		baseline: {
			distanceMeters: baselineEvaluation.distanceMeters,
			distanceKilometers: baselineEvaluation.distanceKilometers,
			maxAbsRgbDelta: baselineMetric,
			objectPixelCount: baselineEvaluation.objectPixelCount,
			changedPixelCount: baselineEvaluation.changedPixelCount,
		},
		thresholds,
	};
}

function findFlatVisibilityRetainedThreshold({
	config,
	evaluate,
	baselineEvaluation,
	baselineMetric,
	retainedFraction,
	visibilityLostFraction = 1 - retainedFraction,
}) {
	const targetMetric = baselineMetric * retainedFraction;
	const isAtOrBelow = (evaluation) => evaluation.maxAbsRgbDelta <= targetMetric;
	let lowDistance = baselineEvaluation.distanceMeters;
	let lowEvaluation = baselineEvaluation;
	let highDistance = Math.max(
		config.search.initialHighDistanceMeters,
		lowDistance * 2
	);
	let highEvaluation = null;

	while (highDistance <= config.search.maxDistanceMeters) {
		highEvaluation = evaluate(highDistance);
		if (isAtOrBelow(highEvaluation)) {
			break;
		}
		lowDistance = highDistance;
		lowEvaluation = highEvaluation;
		highDistance = highDistance * 2 > config.search.maxDistanceMeters &&
			highDistance < config.search.maxDistanceMeters
			? config.search.maxDistanceMeters
			: highDistance * 2;
	}

	if (!highEvaluation || !isAtOrBelow(highEvaluation)) {
		return {
			status: 'rejected',
			visibilityLostPercent: visibilityLostFraction * 100,
			retainedPercent: retainedFraction * 100,
			retainedFraction,
			targetMaxAbsRgbDelta: targetMetric,
			reason: 'Retained-contrast threshold was not bracketed before maxDistanceMeters.',
			lastAbove: lowEvaluation,
			firstAtOrBelow: highEvaluation,
		};
	}

	for (
		let iteration = 0;
		iteration < config.search.visibilityBinaryIterations;
		iteration += 1
	) {
		const midDistance = (lowDistance + highDistance) / 2;
		const midEvaluation = evaluate(midDistance);

		if (isAtOrBelow(midEvaluation)) {
			highDistance = midDistance;
			highEvaluation = midEvaluation;
		} else {
			lowDistance = midDistance;
			lowEvaluation = midEvaluation;
		}
	}

	return {
		status: 'accepted',
		visibilityLostPercent: visibilityLostFraction * 100,
		retainedPercent: retainedFraction * 100,
		retainedFraction,
		visibilityLostFraction,
		targetMaxAbsRgbDelta: targetMetric,
		distanceMeters: highDistance,
		distanceKilometers: highDistance / 1000,
		lastAbove: {
			distanceMeters: lowEvaluation.distanceMeters,
			distanceKilometers: lowEvaluation.distanceKilometers,
			maxAbsRgbDelta: lowEvaluation.maxAbsRgbDelta,
			retainedFraction: lowEvaluation.maxAbsRgbDelta / baselineMetric,
			objectPixelCount: lowEvaluation.objectPixelCount,
		},
		firstAtOrBelow: {
			distanceMeters: highEvaluation.distanceMeters,
			distanceKilometers: highEvaluation.distanceKilometers,
			maxAbsRgbDelta: highEvaluation.maxAbsRgbDelta,
			retainedFraction: highEvaluation.maxAbsRgbDelta / baselineMetric,
			objectPixelCount: highEvaluation.objectPixelCount,
		},
	};
}

function flatVisibilityCriterion(config) {
	return {
		definition:
			'The object no longer appears when every encoded RGB channel in the object-present render differs from the same no-object render by at most the threshold.',
		encodedRgbDeltaThreshold: config.search.encodedRgbDeltaThreshold,
		comparisonSpace: 'post-CIE, post-linear-sRGB, post-Bruneton-k tone mapped, 8-bit encoded display RGB',
		searchResolution: {
			width: config.search.width,
			height: config.search.height,
		},
	};
}

function flatVisibilityValidationDistances({ thresholdDistanceMeters, config }) {
	const multipliers = [0.8, 0.9, 0.98, 1, 1.02, 1.1, 1.2];
	const distances = new Set();

	for (const multiplier of multipliers) {
		const distance = clamp(
			thresholdDistanceMeters * multiplier,
			config.search.minDistanceMeters,
			config.search.maxDistanceMeters
		);
		distances.add(Number(distance.toFixed(3)));
	}

	return Array.from(distances).sort((a, b) => a - b);
}

function evaluateFlatVisibilityAtDistance({ grid, config, distanceMeters }) {
	let objectPixelCount = 0;
	let changedPixelCount = 0;
	let maxAbsRgbDelta = 0;
	let sumAbsRgbDelta = 0;
	let maxPixel = null;

	for (const pixel of grid.pixels) {
		const hit = flatTargetIntersection({
			ray: pixel.ray,
			targetDistanceMeters: distanceMeters,
			config,
		});

		if (!hit) {
			continue;
		}

		objectPixelCount += 1;
		const objectRgb = flatTraceEncodedRgb({
			origin: pixel.ray.origin,
			direction: pixel.ray.direction,
			distanceMeters: hit.distanceMeters,
			objectSpectrumId: config.target.spectrumId,
			sunRay: config.sunCase.sunDirection,
		});
		const backgroundRgb = pixel.background.encodedRgb;
		const channelDeltas = [
			Math.abs(objectRgb[0] - backgroundRgb[0]),
			Math.abs(objectRgb[1] - backgroundRgb[1]),
			Math.abs(objectRgb[2] - backgroundRgb[2]),
		];
		const pixelMaxDelta = Math.max(...channelDeltas);

		if (pixelMaxDelta > config.search.encodedRgbDeltaThreshold) {
			changedPixelCount += 1;
		}
		sumAbsRgbDelta += channelDeltas[0] + channelDeltas[1] + channelDeltas[2];

		if (pixelMaxDelta > maxAbsRgbDelta || maxPixel === null) {
			maxAbsRgbDelta = pixelMaxDelta;
			maxPixel = {
				x: pixel.x,
				y: pixel.y,
				hitDistanceMeters: hit.distanceMeters,
				hitPointMeters: hit.hitPoint,
				objectEncodedRgb: objectRgb,
				backgroundEncodedRgb: backgroundRgb,
				backgroundKind: pixel.background.kind,
				channelDeltas,
				maxAbsRgbDelta: pixelMaxDelta,
			};
		}
	}

	return {
		distanceMeters,
		distanceKilometers: distanceMeters / 1000,
		objectPixelCount,
		changedPixelCount,
		maxAbsRgbDelta,
		meanAbsRgbDelta:
			objectPixelCount > 0 ? sumAbsRgbDelta / (objectPixelCount * 3) : 0,
		maxPixel,
	};
}

function renderFlatVisibilityImage({
	grid,
	config,
	distanceMeters,
	includeObject,
	visualizationMode = 'normal',
	diffAmplification = 24,
}) {
	const data = new Uint8ClampedArray(grid.width * grid.height * 4);
	let objectPixelCount = 0;
	const objectBounds = {
		minX: Number.POSITIVE_INFINITY,
		minY: Number.POSITIVE_INFINITY,
		maxX: Number.NEGATIVE_INFINITY,
		maxY: Number.NEGATIVE_INFINITY,
	};

	for (const pixel of grid.pixels) {
		let encodedRgb = visualizationMode === 'normal'
			? pixel.background.encodedRgb
			: [0, 0, 0];

		if (includeObject) {
			const hit = flatTargetIntersection({
				ray: pixel.ray,
				targetDistanceMeters: distanceMeters,
				config,
			});

			if (hit) {
				objectPixelCount += 1;
				objectBounds.minX = Math.min(objectBounds.minX, pixel.x);
				objectBounds.minY = Math.min(objectBounds.minY, pixel.y);
				objectBounds.maxX = Math.max(objectBounds.maxX, pixel.x);
				objectBounds.maxY = Math.max(objectBounds.maxY, pixel.y);
				const objectRgb = flatTraceEncodedRgb({
					origin: pixel.ray.origin,
					direction: pixel.ray.direction,
					distanceMeters: hit.distanceMeters,
					objectSpectrumId: config.target.spectrumId,
					sunRay: config.sunCase.sunDirection,
				});

				if (visualizationMode === 'mask') {
					encodedRgb = [255, 255, 255];
				} else if (visualizationMode === 'diff') {
					encodedRgb = [
						clampByte(
							Math.abs(objectRgb[0] - pixel.background.encodedRgb[0]) *
								diffAmplification
						),
						clampByte(
							Math.abs(objectRgb[1] - pixel.background.encodedRgb[1]) *
								diffAmplification
						),
						clampByte(
							Math.abs(objectRgb[2] - pixel.background.encodedRgb[2]) *
								diffAmplification
						),
					];
				} else {
					encodedRgb = objectRgb;
				}
			}
		}

		const offset = (pixel.y * grid.width + pixel.x) * 4;
		data[offset] = encodedRgb[0];
		data[offset + 1] = encodedRgb[1];
		data[offset + 2] = encodedRgb[2];
		data[offset + 3] = 255;
	}

	return {
		imageData: new ImageData(data, grid.width, grid.height),
		objectPixelCount,
		objectBounds: objectPixelCount > 0 ? objectBounds : null,
	};
}

function drawFlatVisibilityContactSheet({
	canvas,
	config,
	panelGrid,
	searchResult,
}) {
	canvas.width = config.outputCanvas.width;
	canvas.height = config.outputCanvas.height;

	const context = canvas.getContext('2d', { willReadFrequently: true });
	const margin = 14;
	const gap = 10;
	const panelCount = 4;
	const panelWidth = Math.floor(
		(canvas.width - margin * 2 - gap * (panelCount - 1)) / panelCount
	);
	const panelHeight = Math.min(
		config.panels.height,
		Math.max(80, canvas.height - 150)
	);
	const panelY = 78;
	const thresholdDistance =
		searchResult.thresholdDistanceMeters ||
		searchResult.highEvaluation?.distanceMeters ||
		config.search.initialHighDistanceMeters;
	const lastVisibleDistance =
		searchResult.lastVisible?.distanceMeters ||
		Math.max(config.search.minDistanceMeters, thresholdDistance * 0.9);
	const firstInvisibleDistance =
		searchResult.firstInvisible?.distanceMeters ||
		thresholdDistance;
	const beyondDistance = clamp(
		firstInvisibleDistance * 1.2,
		config.search.minDistanceMeters,
		config.search.maxDistanceMeters
	);
	const diagnosticDistance =
		searchResult.highEvaluation?.distanceMeters ||
		searchResult.evaluations?.[searchResult.evaluations.length - 1]
			?.distanceMeters ||
		thresholdDistance;
	const diagnosticEvaluation =
		searchResult.highEvaluation ||
		searchResult.evaluations?.[searchResult.evaluations.length - 1] ||
		null;
	const panelSpecs = searchResult.status === 'accepted'
		? [
				{
					id: 'no-object',
					title: 'No object',
					distanceMeters: firstInvisibleDistance,
					includeObject: false,
					visualizationMode: 'normal',
					metric: 'background',
				},
				{
					id: 'last-visible',
					title: 'Last visible',
					distanceMeters: lastVisibleDistance,
					includeObject: true,
					visualizationMode: 'normal',
					metric: flatVisibilityPanelMetric(searchResult.lastVisible),
				},
				{
					id: 'first-invisible',
					title: 'First invisible',
					distanceMeters: firstInvisibleDistance,
					includeObject: true,
					visualizationMode: 'normal',
					metric: flatVisibilityPanelMetric(searchResult.firstInvisible),
				},
				{
					id: 'beyond',
					title: 'Beyond',
					distanceMeters: beyondDistance,
					includeObject: true,
					visualizationMode: 'normal',
					metric: flatVisibilityPanelMetric(
						searchResult.validationSweep?.find((entry) =>
							Math.abs(entry.distanceMeters - beyondDistance) < 0.01
						)
					),
				},
			]
		: [
				{
					id: 'no-object',
					title: 'No object',
					distanceMeters: diagnosticDistance,
					includeObject: false,
					visualizationMode: 'normal',
					metric: 'background',
				},
				{
					id: 'object-normal',
					title: 'Object normal',
					distanceMeters: diagnosticDistance,
					includeObject: true,
					visualizationMode: 'normal',
					metric: flatVisibilityPanelMetric(diagnosticEvaluation),
				},
				{
					id: 'object-diff',
					title: 'Diff x24',
					distanceMeters: diagnosticDistance,
					includeObject: true,
					visualizationMode: 'diff',
					metric: flatVisibilityPanelMetric(diagnosticEvaluation),
				},
				{
					id: 'object-mask',
					title: 'Object mask',
					distanceMeters: diagnosticDistance,
					includeObject: true,
					visualizationMode: 'mask',
					metric: flatVisibilityPanelMetric(diagnosticEvaluation),
				},
			];
	const renderedPanels = [];

	context.fillStyle = '#11161c';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = '#f2f6fb';
	context.font = 'bold 18px Arial, sans-serif';
	context.fillText('Flat-earth visibility search: standard Algorithm32 atmosphere', margin, 26);
	context.font = '12px Arial, sans-serif';
	context.fillStyle = '#b8c4d2';
	context.fillText(
		searchResult.status === 'accepted'
			? `First non-appearing distance: ${formatDistanceKm(firstInvisibleDistance)}; criterion max encoded RGB delta <= ${config.search.encodedRgbDeltaThreshold}.`
			: `Search rejected: ${searchResult.reason || 'no accepted threshold'}`,
		margin,
		49
	);
	context.fillText(
		`Target: ${formatDistanceKm(config.target.widthMeters)} wide x ${formatDistanceKm(config.target.heightMeters)} tall matte black card; camera ${config.camera.positionMeters[2]} m above flat ground.`,
		margin,
		66
	);

	for (let index = 0; index < panelSpecs.length; index += 1) {
		const spec = panelSpecs[index];
		const x = margin + index * (panelWidth + gap);
		const rendered = renderFlatVisibilityImage({
			grid: panelGrid,
			config,
			distanceMeters: spec.distanceMeters,
			includeObject: spec.includeObject,
			visualizationMode: spec.visualizationMode,
		});
		const offscreen = document.createElement('canvas');
		offscreen.width = panelGrid.width;
		offscreen.height = panelGrid.height;
		const offscreenContext = offscreen.getContext('2d');
		offscreenContext.putImageData(rendered.imageData, 0, 0);

		context.imageSmoothingEnabled = false;
		context.drawImage(offscreen, x, panelY, panelWidth, panelHeight);
		context.strokeStyle = '#364250';
		context.strokeRect(x + 0.5, panelY + 0.5, panelWidth - 1, panelHeight - 1);
		context.fillStyle = '#f2f6fb';
		context.font = 'bold 12px Arial, sans-serif';
		context.fillText(spec.title, x, panelY + panelHeight + 18);
		context.fillStyle = '#b8c4d2';
		context.font = '12px Arial, sans-serif';
		context.fillText(formatDistanceKm(spec.distanceMeters), x, panelY + panelHeight + 34);
		context.fillText(spec.metric, x, panelY + panelHeight + 50);
		renderedPanels.push({
			id: spec.id,
			title: spec.title,
			distanceMeters: spec.distanceMeters,
			includeObject: spec.includeObject,
			visualizationMode: spec.visualizationMode,
			objectPixelCount: rendered.objectPixelCount,
			metric: spec.metric,
		});
	}

	const tableY = panelY + panelHeight + 72;
	context.fillStyle = '#d8e2ee';
	context.font = '12px Arial, sans-serif';
	context.fillText(
		`Validation sweep: ${flatVisibilitySweepSummary(searchResult.validationSweep)}`,
		margin,
		Math.min(canvas.height - 18, tableY)
	);
	const visibilitySummaryParts = flatVisibilityThresholdSummaryParts(
		searchResult.visibilityThresholds
	);
	context.fillText(
		`Visibility lost: ${visibilitySummaryParts.slice(0, 3).join(', ')}`,
		margin,
		Math.min(canvas.height - 4, tableY + 18)
	);
	if (visibilitySummaryParts.length > 3) {
		context.fillText(
			visibilitySummaryParts.slice(3).join(', '),
			margin,
			Math.min(canvas.height - 4, tableY + 34)
		);
	}

	return renderedPanels;
}

function drawFlatVisibilityMilestoneGallery({
	canvas,
	config,
	panelGrid,
	searchResult,
}) {
	const milestones = flatVisibilityMilestoneGalleryRows(searchResult);
	canvas.width = config.outputCanvas.width;
	canvas.height = config.outputCanvas.height;
	const margin = 24;
	const headerHeight = 94;
	const rowGap = 18;
	const columnGap = 18;
	const rowHeight = Math.floor(
		(canvas.height - headerHeight - margin - rowGap * (milestones.length - 1)) /
			milestones.length
	);
	const labelWidth = 250;
	const availableColumnWidth =
		canvas.width - margin * 2 - labelWidth - columnGap * 4;
	const fullWidth = Math.floor(availableColumnWidth * 0.28);
	const cropWidth = Math.floor((availableColumnWidth - fullWidth) / 3);
	const panelHeight = Math.max(90, rowHeight - 52);
	const renderedPanels = [];

	const context = canvas.getContext('2d', { willReadFrequently: true });
	context.fillStyle = '#10151b';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = '#f2f6fb';
	context.font = 'bold 24px Arial, sans-serif';
	context.fillText('Flat-earth visibility loss gallery', margin, 34);
	context.fillStyle = '#b8c4d2';
	context.font = '15px Arial, sans-serif';
	context.fillText(
		'Normal full scene plus zoomed normal/diff/mask crops at each found distance.',
		margin,
		58
	);
	context.fillText(
		`Target ${formatDistanceKm(config.target.widthMeters)} x ${formatDistanceKm(config.target.heightMeters)}, baseline ${formatDistanceKm(config.search.minDistanceMeters)}, criterion 100% lost = max encoded RGB delta <= ${config.search.encodedRgbDeltaThreshold}.`,
		margin,
		80
	);

	for (let index = 0; index < milestones.length; index += 1) {
		const milestone = milestones[index];
		const rowY = headerHeight + index * (rowHeight + rowGap);
		const normal = renderFlatVisibilityImage({
			grid: panelGrid,
			config,
			distanceMeters: milestone.distanceMeters,
			includeObject: true,
			visualizationMode: 'normal',
		});
		const diff = renderFlatVisibilityImage({
			grid: panelGrid,
			config,
			distanceMeters: milestone.distanceMeters,
			includeObject: true,
			visualizationMode: 'diff',
			diffAmplification: 24,
		});
		const mask = renderFlatVisibilityImage({
			grid: panelGrid,
			config,
			distanceMeters: milestone.distanceMeters,
			includeObject: true,
			visualizationMode: 'mask',
		});
		const cropBounds = paddedImageBounds({
			bounds: normal.objectBounds,
			width: panelGrid.width,
			height: panelGrid.height,
		});
		const labelX = margin;
		let x = margin + labelWidth + columnGap;

		context.fillStyle = '#f2f6fb';
		context.font = 'bold 17px Arial, sans-serif';
		context.fillText(milestone.title, labelX, rowY + 22);
		context.fillStyle = '#b8c4d2';
		context.font = '14px Arial, sans-serif';
		context.fillText(formatDistanceKm(milestone.distanceMeters), labelX, rowY + 46);
		context.fillText(milestone.metric, labelX, rowY + 68);
		context.fillText(`pixels ${normal.objectPixelCount}`, labelX, rowY + 90);

		drawImageDataPanel({
			context,
			imageData: normal.imageData,
			x,
			y: rowY,
			width: fullWidth,
			height: panelHeight,
			label: 'full normal',
			cropBounds: null,
		});
		x += fullWidth + columnGap;
		drawImageDataPanel({
			context,
			imageData: normal.imageData,
			x,
			y: rowY,
			width: cropWidth,
			height: panelHeight,
			label: 'normal crop',
			cropBounds,
		});
		x += cropWidth + columnGap;
		drawImageDataPanel({
			context,
			imageData: diff.imageData,
			x,
			y: rowY,
			width: cropWidth,
			height: panelHeight,
			label: 'diff x24 crop',
			cropBounds,
		});
		x += cropWidth + columnGap;
		drawImageDataPanel({
			context,
			imageData: mask.imageData,
			x,
			y: rowY,
			width: cropWidth,
			height: panelHeight,
			label: 'mask crop',
			cropBounds,
		});

		renderedPanels.push({
			id: milestone.id,
			title: milestone.title,
			distanceMeters: milestone.distanceMeters,
			distanceKilometers: milestone.distanceMeters / 1000,
			metric: milestone.metric,
			objectPixelCount: normal.objectPixelCount,
			cropBounds,
		});
	}

	return renderedPanels;
}

function flatVisibilityMilestoneGalleryRows(searchResult) {
	const thresholdRows =
		searchResult.visibilityThresholds?.thresholds
			?.filter((threshold) => threshold.status === 'accepted')
			.map((threshold) => ({
				id: `lost-${threshold.visibilityLostPercent.toFixed(0)}`,
				title:
					`${threshold.visibilityLostPercent.toFixed(0)}% lost ` +
					`(${threshold.retainedPercent.toFixed(0)}% visible)`,
				distanceMeters: threshold.distanceMeters,
				metric: `maxD ${threshold.firstAtOrBelow.maxAbsRgbDelta}`,
			})) || [];
	const cannotSee = searchResult.firstInvisible
		? [{
				id: 'lost-100',
				title: '100% lost (cannot see)',
				distanceMeters: searchResult.firstInvisible.distanceMeters,
				metric: `maxD ${searchResult.firstInvisible.maxAbsRgbDelta}`,
			}]
		: [];

	return [...thresholdRows, ...cannotSee];
}

function drawImageDataPanel({
	context,
	imageData,
	x,
	y,
	width,
	height,
	label,
	cropBounds,
}) {
	const sourceCanvas = document.createElement('canvas');
	sourceCanvas.width = imageData.width;
	sourceCanvas.height = imageData.height;
	sourceCanvas.getContext('2d').putImageData(imageData, 0, 0);

	context.imageSmoothingEnabled = false;
	context.fillStyle = '#05080b';
	context.fillRect(x, y, width, height);
	if (cropBounds) {
		context.drawImage(
			sourceCanvas,
			cropBounds.x,
			cropBounds.y,
			cropBounds.width,
			cropBounds.height,
			x,
			y,
			width,
			height
		);
	} else {
		context.drawImage(sourceCanvas, x, y, width, height);
	}
	context.strokeStyle = '#354250';
	context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
	context.fillStyle = '#d8e2ee';
	context.font = '13px Arial, sans-serif';
	context.fillText(label, x + 8, y + height - 10);
}

function paddedImageBounds({ bounds, width, height }) {
	if (!bounds) {
		return {
			x: 0,
			y: 0,
			width,
			height,
		};
	}

	const boundsWidth = bounds.maxX - bounds.minX + 1;
	const boundsHeight = bounds.maxY - bounds.minY + 1;
	const centerX = (bounds.minX + bounds.maxX) / 2;
	const centerY = (bounds.minY + bounds.maxY) / 2;
	const cropWidth = Math.min(width, Math.max(80, boundsWidth * 8));
	const cropHeight = Math.min(height, Math.max(80, boundsHeight * 10));
	const x = Math.round(clamp(centerX - cropWidth / 2, 0, width - cropWidth));
	const y = Math.round(clamp(centerY - cropHeight / 2, 0, height - cropHeight));

	return {
		x,
		y,
		width: Math.round(cropWidth),
		height: Math.round(cropHeight),
	};
}

function flatVisibilityPanelMetric(evaluation) {
	if (!evaluation) {
		return 'not sampled';
	}

	return `maxD ${evaluation.maxAbsRgbDelta}; pixels ${evaluation.objectPixelCount}`;
}

function flatVisibilitySweepSummary(validationSweep = []) {
	if (!validationSweep.length) {
		return 'none';
	}

	return validationSweep
		.map((entry) => `${formatDistanceKm(entry.distanceMeters)}:${entry.maxAbsRgbDelta}`)
		.join(', ');
}

function flatVisibilityThresholdSummaryParts(visibilityThresholds) {
	if (!visibilityThresholds?.thresholds?.length) {
		return ['none'];
	}

	return visibilityThresholds.thresholds
		.map((threshold) =>
			threshold.status === 'accepted'
				? `${threshold.visibilityLostPercent.toFixed(0)}% lost (${threshold.retainedPercent.toFixed(0)}% visible) ${formatDistanceKm(threshold.distanceMeters)}`
				: `${threshold.visibilityLostPercent.toFixed(0)}% lost unresolved`
		);
}

function formatDistanceKm(distanceMeters) {
	return `${(distanceMeters / 1000).toFixed(distanceMeters >= 100000 ? 1 : 2)} km`;
}

function flatTraceEncodedRgb({
	origin,
	direction,
	distanceMeters,
	objectSpectrumId,
	sunRay,
}) {
	const samples = buildFlatViewIntegrationSamples({
		origin,
		direction,
		distanceMeters,
		sampleCount: ATMOSPHERE.directRadianceViewSamples,
	});
	const radianceByWavelength = SPECTRAL_CHANNELS.map((channel) => {
		const wavelengthMicrometers = channel.wavelengthNanometers * 1e-3;
		const viewTransmittance = computeTransmittanceAtWavelength(
			samples.totalOpticalLengths,
			channel.wavelengthNanometers
		);
		const pathRadiance = computeFlatFirstOrderPathRadianceAtWavelength({
			samples,
			direction,
			wavelengthNanometers: channel.wavelengthNanometers,
			wavelengthMicrometers,
			solarIrradiance: channel.solarIrradiance,
			sunRay,
		});
		const objectRadiance = objectSpectrumId
			? objectRadianceAtWavelength(objectSpectrumId, channel.wavelengthNanometers)
			: 0;

		return viewTransmittance * objectRadiance + pathRadiance;
	});

	return spectralToDisplayPreview(radianceByWavelength).encodedRgb;
}

function buildFlatViewIntegrationSamples({
	origin,
	direction,
	distanceMeters,
	sampleCount,
}) {
	const step = distanceMeters / sampleCount;
	const samples = [];

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const altitudeMeters = origin[2] + direction[2] * sampleDistance;
		const density = flatDensityAtAltitude(altitudeMeters);

		samples.push({
			sampleIndex,
			distanceMeters: sampleDistance,
			altitudeMeters,
			density,
			weight: sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1,
			viewOpticalLengths: flatOpticalLengthsAlongDistance({
				startAltitudeMeters: origin[2],
				altitudeDirection: direction[2],
				distanceMeters: sampleDistance,
			}),
		});
	}

	return {
		step,
		samples,
		totalOpticalLengths: flatOpticalLengthsAlongDistance({
			startAltitudeMeters: origin[2],
			altitudeDirection: direction[2],
			distanceMeters,
		}),
	};
}

function flatDensityAtAltitude(altitudeMeters) {
	const clampedAltitudeMeters = Math.max(0, altitudeMeters);

	return {
		altitudeMeters,
		rayleigh: Math.exp(
			-clampedAltitudeMeters / ATMOSPHERE.rayleighScaleHeightMeters
		),
		mie: Math.exp(-clampedAltitudeMeters / ATMOSPHERE.mieScaleHeightMeters),
		absorption: 0,
	};
}

function flatOpticalLengthsAlongDistance({
	startAltitudeMeters,
	altitudeDirection,
	distanceMeters,
}) {
	return {
		distanceMeters,
		rayleighOpticalLength: flatExponentialOpticalLength({
			startAltitudeMeters,
			altitudeDirection,
			distanceMeters,
			scaleHeightMeters: ATMOSPHERE.rayleighScaleHeightMeters,
		}),
		mieOpticalLength: flatExponentialOpticalLength({
			startAltitudeMeters,
			altitudeDirection,
			distanceMeters,
			scaleHeightMeters: ATMOSPHERE.mieScaleHeightMeters,
		}),
		absorptionOpticalLength: 0,
	};
}

function flatExponentialOpticalLength({
	startAltitudeMeters,
	altitudeDirection,
	distanceMeters,
	scaleHeightMeters,
}) {
	if (distanceMeters <= 0) {
		return 0;
	}

	const startDensity = Math.exp(
		-Math.max(0, startAltitudeMeters) / scaleHeightMeters
	);

	if (Math.abs(altitudeDirection) < 1e-10) {
		return distanceMeters * startDensity;
	}

	const exponent = -altitudeDirection * distanceMeters / scaleHeightMeters;

	return (
		startDensity *
		(scaleHeightMeters / altitudeDirection) *
		(1 - Math.exp(exponent))
	);
}

function computeFlatFirstOrderPathRadianceAtWavelength({
	samples,
	direction,
	wavelengthNanometers,
	wavelengthMicrometers,
	solarIrradiance,
	sunRay,
}) {
	let rayleighSum = 0;
	let mieSum = 0;

	for (const sample of samples.samples) {
		const viewTransmittance = computeTransmittanceAtWavelength(
			sample.viewOpticalLengths,
			wavelengthNanometers
		);
		const sunTransmittance = flatSunTransmittanceAtWavelength({
			altitudeMeters: sample.altitudeMeters,
			sunRay,
			wavelengthNanometers,
		});
		const transmittance = viewTransmittance * sunTransmittance;

		rayleighSum +=
			transmittance *
			sample.density.rayleigh *
			sample.weight;
		mieSum +=
			transmittance *
			sample.density.mie *
			sample.weight;
	}

	const nu = dot(direction, sunRay);
	const rayleighPhase = rayleighPhaseFunction(nu);
	const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);
	const rayleigh =
		rayleighSum *
		samples.step *
		solarIrradiance *
		rayleighScatteringCoefficientAt(wavelengthMicrometers) *
		rayleighPhase;
	const mie =
		mieSum *
		samples.step *
		solarIrradiance *
		mieScatteringCoefficientAt(wavelengthMicrometers) *
		miePhase;

	return rayleigh + mie;
}

function flatSunTransmittanceAtWavelength({
	altitudeMeters,
	sunRay,
	wavelengthNanometers,
}) {
	const topHeight = ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters;

	if (sunRay[2] <= 1e-9 || altitudeMeters >= topHeight) {
		return sunRay[2] <= 1e-9 ? 0 : 1;
	}

	const distanceMeters = Math.max(0, (topHeight - altitudeMeters) / sunRay[2]);

	return computeTransmittanceAtWavelength(
		flatOpticalLengthsAlongDistance({
			startAltitudeMeters: altitudeMeters,
			altitudeDirection: sunRay[2],
			distanceMeters,
		}),
		wavelengthNanometers
	);
}

function flatVisibilitySelectedPixels(searchResult) {
	return [
		{
			id: 'last-visible-max-delta',
			...(searchResult.lastVisible?.maxPixel || {}),
			distanceMeters: searchResult.lastVisible?.distanceMeters || null,
			distanceKilometers: searchResult.lastVisible?.distanceKilometers || null,
			objectPixelCount: searchResult.lastVisible?.objectPixelCount || 0,
		},
		{
			id: 'first-invisible-max-delta',
			...(searchResult.firstInvisible?.maxPixel || {}),
			distanceMeters: searchResult.firstInvisible?.distanceMeters || null,
			distanceKilometers:
				searchResult.firstInvisible?.distanceKilometers || null,
			objectPixelCount: searchResult.firstInvisible?.objectPixelCount || 0,
		},
	].filter((sample) => sample.distanceMeters !== null);
}

function flatVisibilityDiagnostics({
	command,
	config,
	searchResult,
	panelImages,
	searchGrid,
	panelGrid,
}) {
	return {
		kind: 'browser-flat-earth-visibility-search-diagnostics',
		status: searchResult.status,
		iteration: config.iteration,
		goal: config.goal,
		commandPayload: command?.payload || null,
		canvas: config.outputCanvas,
		searchGrid: {
			width: searchGrid.width,
			height: searchGrid.height,
			counts: searchGrid.counts,
			maxBackgroundDistanceMeters: searchGrid.maxBackgroundDistanceMeters,
		},
		panelGrid: {
			width: panelGrid.width,
			height: panelGrid.height,
			counts: panelGrid.counts,
		},
		camera: config.camera,
		target: config.target,
		background: config.background,
		sunCase: config.sunCase,
		atmospherePolicy: config.atmospherePolicy,
		sourcePolicy: config.sourcePolicy,
		search: {
			status: searchResult.status,
			reason: searchResult.reason || null,
			criterion: searchResult.criterion,
			bracketStatus: searchResult.bracketStatus,
			thresholdDistanceMeters: searchResult.thresholdDistanceMeters || null,
			thresholdDistanceKilometers:
				searchResult.thresholdDistanceKilometers || null,
			visibilityGapMeters: searchResult.visibilityGapMeters || null,
			disappearanceDriver: searchResult.disappearanceDriver || null,
			visibilityThresholds: searchResult.visibilityThresholds || null,
			lastVisible: searchResult.lastVisible || null,
			firstInvisible: searchResult.firstInvisible || null,
			validationSweep: searchResult.validationSweep || [],
			evaluationCount: searchResult.evaluations.length,
			evaluations: searchResult.evaluations,
		},
		panelImages,
		absentByDesign: [
			'This flat-earth branch is a visibility experiment, not the accepted fixed spherical Algorithm32 shader endpoint.',
			'The run uses standard Algorithm32 atmosphere constants but replaces spherical-shell geometry with a flat atmospheric slab.',
			'The first run uses first-order scattering only; second-order Algorithm32 incident-sky approximation is intentionally omitted and labeled.',
			'The target, camera framing, sky cap, resolution, and encoded RGB threshold are experimental controls and directly affect the found distance.',
		],
	};
}

const ATMOSPHERE = Object.freeze({
	bottomRadiusMeters: 6360000,
	topRadiusMeters: 6420000,
	rayleighScaleHeightMeters: 8000,
	mieScaleHeightMeters: 1200,
	rayleighCoefficientScale: 1.24062e-6,
	mieAngstromAlpha: 0.8,
	mieAngstromBeta: 0.04,
	mieSingleScatteringAlbedo: 0.8,
	miePhaseFunctionG: 0.7,
	mieScaleHeightMetersForCoefficient: 1200,
	ozoneAbsorption: 0,
	componentViewSamples: 32,
	directRadianceViewSamples: 20,
	directRadianceSunTransmittanceSamples: 10,
	secondOrderIncomingDirections: 17,
	secondOrderIncidentAltitudeBins: 24,
	diagnosticWavelengthNanometers: 532.333333333333,
	diagnosticSolarIrradiance: 1.883391,
});

const DIRECT_RADIANCE_SUN_CASE = Object.freeze({
	id: 'figure1-13h15-z21',
	sourceTimeOfDay: '13h15',
	sourceSunZenithDegrees: 21,
	sunAltitudeDegrees: 69,
	sunAzimuthDegrees: 85.31410016049729,
	role: 'highest-Sun render and stress case',
});

const SPECTRAL_WAVELENGTHS_NM = [
	375.666666666667,
	407,
	438.333333333333,
	469.666666666667,
	501,
	532.333333333333,
	563.666666666667,
	595,
	626.333333333333,
	657.666666666667,
	689,
	720.333333333333,
	751.666666666667,
	783,
	814.333333333333,
];
const SPECTRAL_SOLAR_IRRADIANCE = [
	1.068866666667,
	1.729673,
	1.862071666667,
	2.022063333333,
	1.908154,
	1.883391,
	1.834246666667,
	1.76744,
	1.65952,
	1.548102333333,
	1.45078,
	1.340960333333,
	1.262433333333,
	1.175208,
	1.090824,
];
const SPECTRAL_CHANNELS = SPECTRAL_WAVELENGTHS_NM.map(
	(wavelengthNanometers, index) => ({
		wavelengthNanometers,
		solarIrradiance: SPECTRAL_SOLAR_IRRADIANCE[index],
	})
);
const SPECTRAL_CIE = [
	[0.00082512, 0.000024284, 0.00388120013333],
	[0.031318, 0.000868, 0.14908],
	[0.341686666667, 0.0209466666667, 1.70569333333],
	[0.199076, 0.0898413333333, 1.30367066667],
	[0.0044, 0.33986, 0.26006],
	[0.19361662, 0.88666338, 0.0364106666667],
	[0.656026666667, 0.982973333333, 0.00305666593333],
	[1.0567, 0.6949, 0.001],
	[0.722333333333, 0.306066666667, 0.000086666664],
	[0.190006666667, 0.0706133333333, 0],
	[0.02474, 0.008952, 0],
	[0.0028426512, 0.00102653333333, 0],
	[0.000299809433333, 0.000108266666667, 0],
	[0.000034215932, 0.000012356, 0],
	[0.00000378221413333, 0.00000136582666667, 0],
];
const SPECTRAL_DELTA_NM = (830 - 360) / 15;
const XYZ_TO_SRGB = [
	3.2406, -1.5372, -0.4986,
	-0.9689, 1.8758, 0.0415,
	0.0557, -0.204, 1.057,
];
const MAX_LUMINOUS_EFFICACY = 683;
const DISPLAY_TONE_MAP_K = 1 / (5 * MAX_LUMINOUS_EFFICACY);

function computeAtmosphereComponents(sample) {
	const origin = threeToAlgorithmWorld(sample.threeRay.origin);
	const direction = normalize(threeDirectionToAlgorithm(sample.threeRay.direction));
	const pathDistanceMeters = sample.classification === 'sky'
		? distanceToTopAtmosphereBoundary(origin, direction)
		: sample.hitDistanceMeters;
	const opticalLengths = computeOpticalLengthsAlongDistance({
		origin,
		direction,
		distance: pathDistanceMeters,
		sampleCount: ATMOSPHERE.componentViewSamples,
	});
	const opticalDepthByWavelength = SPECTRAL_WAVELENGTHS_NM.map((wavelengthNm) => {
		const wavelengthMicrometers = wavelengthNm * 1e-3;

		return (
			rayleighScatteringCoefficientAt(wavelengthMicrometers) *
				opticalLengths.rayleighOpticalLength +
			mieExtinctionCoefficientAt(wavelengthMicrometers) *
				opticalLengths.mieOpticalLength +
			ATMOSPHERE.ozoneAbsorption * opticalLengths.absorptionOpticalLength
		);
	});
	const transmittanceByWavelength = opticalDepthByWavelength.map((tau) =>
		Math.exp(-tau)
	);

	return {
		id: sample.id,
		classification: sample.classification,
		hitObject: sample.hitObject,
		pathKind: sample.classification === 'sky' ? 'sky-to-top-atmosphere' : 'finite-scene-segment',
		pathDistanceMeters,
		sampleCount: ATMOSPHERE.componentViewSamples,
		algorithm32Ray: {
			origin,
			direction,
		},
		opticalLengths,
		wavelengthsNanometers: SPECTRAL_WAVELENGTHS_NM,
		opticalDepthByWavelength,
		transmittanceByWavelength,
		minTransmittance: Math.min(...transmittanceByWavelength),
		maxTransmittance: Math.max(...transmittanceByWavelength),
		meanTransmittance: mean(transmittanceByWavelength),
	};
}

function computeDirectRadianceDiagnostic(sample, sunCase = DIRECT_RADIANCE_SUN_CASE) {
	const channel = SPECTRAL_CHANNELS.find(
		(item) =>
			item.wavelengthNanometers === ATMOSPHERE.diagnosticWavelengthNanometers
	);
	const packet = computeDirectRadianceChannelPacket(sample, channel, sunCase);

	return {
		kind: 'browser-direct-radiance-diagnostic',
		...packet,
		sampleCount: ATMOSPHERE.directRadianceViewSamples,
		sunTransmittanceSampleCount:
			ATMOSPHERE.directRadianceSunTransmittanceSamples,
		limitations: [
			'one-wavelength diagnostic at 532.333333333333 nm',
			'first-order single scattering only',
			'no second-order Algorithm32 approximation',
			'no full spectral CIE/display conversion',
		],
	};
}

function computeSecondOrderRadianceDiagnostic(
	sample,
	incidentSkyCache,
	sunCase = DIRECT_RADIANCE_SUN_CASE
) {
	const channel = SPECTRAL_CHANNELS.find(
		(item) =>
			item.wavelengthNanometers === ATMOSPHERE.diagnosticWavelengthNanometers
	);
	const packet = computeSecondOrderRadianceChannelPacket(
		sample,
		channel,
		incidentSkyCache,
		sunCase
	);

	return {
		kind: 'browser-second-order-radiance-diagnostic',
		...packet,
		secondOrderControls: {
			incomingDirections: ATMOSPHERE.secondOrderIncomingDirections,
			incidentAltitudeBins: ATMOSPHERE.secondOrderIncidentAltitudeBins,
			incidentSkyCacheEntries: incidentSkyCache.size,
		},
		limitations: [
			'one-wavelength diagnostic at 532.333333333333 nm',
			'Algorithm32 second-order approximation included for selected pixels only',
			'no full spectral second-order parity',
			'no image-level second-order shader composition',
		],
	};
}

function computeSecondOrderRadianceChannelPacket(
	sample,
	channel,
	incidentSkyCache,
	sunCase = DIRECT_RADIANCE_SUN_CASE
) {
	const firstOrderPacket = computeDirectRadianceChannelPacket(
		sample,
		channel,
		sunCase
	);
	const secondOrderPathRadiance = computeSecondOrderPathRadianceAtWavelength({
		origin: firstOrderPacket.algorithm32Ray.origin,
		direction: firstOrderPacket.algorithm32Ray.direction,
		distance: firstOrderPacket.pathDistanceMeters,
		wavelengthNanometers: channel.wavelengthNanometers,
		wavelengthMicrometers: channel.wavelengthNanometers * 1e-3,
		solarIrradiance: channel.solarIrradiance,
		sunRay: firstOrderPacket.sunCase.sunDirection,
		sunCaseId: firstOrderPacket.sunCase.id,
		incidentSkyCache,
	});
	const pathRadiance =
		firstOrderPacket.firstOrderPathRadiance + secondOrderPathRadiance;
	const finalRadiance = firstOrderPacket.transmittedObjectRadiance + pathRadiance;

	return {
		...firstOrderPacket,
		secondOrderPathRadiance,
		pathRadiance,
		finalRadiance,
	};
}

function computeDirectRadianceSpectralDiagnostic(
	sample,
	sunCase = DIRECT_RADIANCE_SUN_CASE
) {
	const channels = SPECTRAL_CHANNELS.map((channel) =>
		computeDirectRadianceChannelPacket(sample, channel, sunCase)
	);
	const first = channels[0];

	return {
		kind: 'browser-direct-radiance-spectral-diagnostic',
		id: sample.id,
		classification: sample.classification,
		hitObject: sample.hitObject,
		spectrumId: sample.spectrumId,
		pathKind: first.pathKind,
		pathDistanceMeters: first.pathDistanceMeters,
		sampleCount: ATMOSPHERE.directRadianceViewSamples,
		sunTransmittanceSampleCount:
			ATMOSPHERE.directRadianceSunTransmittanceSamples,
		sunCase: first.sunCase,
		algorithm32Ray: first.algorithm32Ray,
		wavelengthsNanometers: channels.map((channel) => channel.wavelengthNanometers),
		transmittanceByWavelength: channels.map((channel) => channel.transmittance),
		objectRadianceByWavelength: channels.map((channel) => channel.objectRadiance),
		transmittedObjectRadianceByWavelength: channels.map((channel) =>
			channel.transmittedObjectRadiance
		),
		firstOrderRayleighPathRadianceByWavelength: channels.map((channel) =>
			channel.firstOrderRayleighPathRadiance
		),
		firstOrderMiePathRadianceByWavelength: channels.map((channel) =>
			channel.firstOrderMiePathRadiance
		),
		firstOrderPathRadianceByWavelength: channels.map((channel) =>
			channel.firstOrderPathRadiance
		),
		finalRadianceByWavelength: channels.map((channel) => channel.finalRadiance),
		channels,
		limitations: [
			'15-wavelength first-order spectral diagnostic',
			'first-order single scattering only',
			'no second-order Algorithm32 approximation',
			'no full image parity',
		],
	};
}

function computeSecondOrderRadianceSpectralDiagnostic(
	sample,
	incidentSkyCache,
	sunCase = DIRECT_RADIANCE_SUN_CASE
) {
	const channels = SPECTRAL_CHANNELS.map((channel) =>
		computeSecondOrderRadianceChannelPacket(
			sample,
			channel,
			incidentSkyCache,
			sunCase
		)
	);
	const first = channels[0];

	return {
		kind: 'browser-second-order-radiance-spectral-diagnostic',
		id: sample.id,
		classification: sample.classification,
		hitObject: sample.hitObject,
		spectrumId: sample.spectrumId,
		pathKind: first.pathKind,
		pathDistanceMeters: first.pathDistanceMeters,
		sampleCount: ATMOSPHERE.directRadianceViewSamples,
		sunTransmittanceSampleCount:
			ATMOSPHERE.directRadianceSunTransmittanceSamples,
		secondOrderControls: {
			incomingDirections: ATMOSPHERE.secondOrderIncomingDirections,
			incidentAltitudeBins: ATMOSPHERE.secondOrderIncidentAltitudeBins,
			incidentSkyCacheEntries: incidentSkyCache.size,
		},
		sunCase: first.sunCase,
		algorithm32Ray: first.algorithm32Ray,
		wavelengthsNanometers: channels.map((channel) => channel.wavelengthNanometers),
		transmittanceByWavelength: channels.map((channel) => channel.transmittance),
		objectRadianceByWavelength: channels.map((channel) => channel.objectRadiance),
		transmittedObjectRadianceByWavelength: channels.map((channel) =>
			channel.transmittedObjectRadiance
		),
		firstOrderPathRadianceByWavelength: channels.map((channel) =>
			channel.firstOrderPathRadiance
		),
		secondOrderPathRadianceByWavelength: channels.map((channel) =>
			channel.secondOrderPathRadiance
		),
		pathRadianceByWavelength: channels.map((channel) =>
			channel.pathRadiance
		),
		finalRadianceByWavelength: channels.map((channel) => channel.finalRadiance),
		channels,
		limitations: [
			'15-wavelength selected-pixel spectral diagnostic',
			'Algorithm32 second-order approximation included for selected pixels only',
			'no image-level second-order shader composition',
		],
	};
}

function computeDirectRadianceChannelPacket(
	sample,
	channel,
	sunCase = DIRECT_RADIANCE_SUN_CASE
) {
	const origin = threeToAlgorithmWorld(sample.threeRay.origin);
	const direction = normalize(threeDirectionToAlgorithm(sample.threeRay.direction));
	const pathDistanceMeters = sample.classification === 'sky'
		? distanceToTopAtmosphereBoundary(origin, direction)
		: sample.hitDistanceMeters;
	const wavelengthNanometers = channel.wavelengthNanometers;
	const wavelengthMicrometers = wavelengthNanometers * 1e-3;
	const sunRay = sunDirection(sunCase);
	const fullOpticalLengths = computeOpticalLengthsAlongDistance({
		origin,
		direction,
		distance: pathDistanceMeters,
		sampleCount: ATMOSPHERE.directRadianceViewSamples,
	});
	const opticalDepth = opticalDepthAtWavelength(
		fullOpticalLengths,
		wavelengthNanometers
	);
	const transmittance = Math.exp(-opticalDepth);
	const radiance = computeFirstOrderRadianceAtWavelength({
		origin,
		direction,
		distance: pathDistanceMeters,
		wavelengthNanometers,
		wavelengthMicrometers,
		solarIrradiance: channel.solarIrradiance,
		sunRay,
	});
	const objectRadiance = sample.classification === 'sky'
		? 0
		: objectRadianceAtWavelength(sample.spectrumId, wavelengthNanometers);
	const transmittedObjectRadiance = objectRadiance * transmittance;
	const finalRadiance = transmittedObjectRadiance + radiance.firstOrderPathRadiance;

	return {
		id: sample.id,
		classification: sample.classification,
		hitObject: sample.hitObject,
		spectrumId: sample.spectrumId,
		pathKind: sample.classification === 'sky' ? 'sky-to-top-atmosphere' : 'finite-scene-segment',
		pathDistanceMeters,
		wavelengthNanometers,
		solarIrradiance: channel.solarIrradiance,
		sunCase: {
			...sunCase,
			sunDirection: sunRay,
		},
		algorithm32Ray: {
			origin,
			direction,
		},
		opticalLengths: fullOpticalLengths,
		opticalDepth,
		transmittance,
		objectRadiance,
		transmittedObjectRadiance,
		firstOrderRayleighPathRadiance:
			radiance.firstOrderRayleighPathRadiance,
		firstOrderMiePathRadiance: radiance.firstOrderMiePathRadiance,
		firstOrderPathRadiance: radiance.firstOrderPathRadiance,
		finalRadiance,
	};
}

function computeFirstOrderRadianceAtWavelength({
	origin,
	direction,
	distance,
	wavelengthNanometers,
	wavelengthMicrometers,
	solarIrradiance,
	sunRay,
}) {
	if (distance === 0) {
		return {
			firstOrderRayleighPathRadiance: 0,
			firstOrderMiePathRadiance: 0,
			firstOrderPathRadiance: 0,
		};
	}

	const sampleCount = ATMOSPHERE.directRadianceViewSamples;
	const step = distance / sampleCount;
	const samples = [];
	const cumulativeRayleigh = [0];
	const cumulativeMie = [0];
	let rayleighSum = 0;
	let mieSum = 0;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const position = addScaled(origin, direction, sampleDistance);
		const density = densityAtPosition(position);
		samples.push({ position, density });

		if (sampleIndex > 0) {
			const previousDensity = samples[sampleIndex - 1].density;
			cumulativeRayleigh[sampleIndex] =
				cumulativeRayleigh[sampleIndex - 1] +
				0.5 * (previousDensity.rayleigh + density.rayleigh) * step;
			cumulativeMie[sampleIndex] =
				cumulativeMie[sampleIndex - 1] +
				0.5 * (previousDensity.mie + density.mie) * step;
		}
	}

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sample = samples[sampleIndex];
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;
		const viewTransmittance = computeTransmittanceAtWavelength({
			rayleighOpticalLength: cumulativeRayleigh[sampleIndex],
			mieOpticalLength: cumulativeMie[sampleIndex],
			absorptionOpticalLength: 0,
		}, wavelengthNanometers);
		const sunTransmittance = computeTransmittanceToSunAtWavelength({
			position: sample.position,
			sunRay,
			wavelengthNanometers,
		});
		const transmittance = viewTransmittance * sunTransmittance;

		rayleighSum += transmittance * sample.density.rayleigh * weight;
		mieSum += transmittance * sample.density.mie * weight;
	}

	const nu = dot(direction, sunRay);
	const rayleighPhase = rayleighPhaseFunction(nu);
	const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);
	const rayleigh =
		rayleighSum *
		step *
		solarIrradiance *
		rayleighScatteringCoefficientAt(wavelengthMicrometers) *
		rayleighPhase;
	const mie =
		mieSum *
		step *
		solarIrradiance *
		mieScatteringCoefficientAt(wavelengthMicrometers) *
		miePhase;

	return {
		firstOrderRayleighPathRadiance: rayleigh,
		firstOrderMiePathRadiance: mie,
		firstOrderPathRadiance: rayleigh + mie,
	};
}

function computeSecondOrderPathRadianceAtWavelength({
	origin,
	direction,
	distance,
	wavelengthNanometers,
	wavelengthMicrometers,
	solarIrradiance,
	sunRay,
	sunCaseId = DIRECT_RADIANCE_SUN_CASE.id,
	incidentSkyCache,
}) {
	if (distance === 0) {
		return 0;
	}

	const sampleCount = ATMOSPHERE.directRadianceViewSamples;
	const step = distance / sampleCount;
	const samples = [];
	const cumulativeRayleigh = [0];
	const cumulativeMie = [0];
	let secondOrderSum = 0;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const position = addScaled(origin, direction, sampleDistance);
		const density = densityAtPosition(position);
		samples.push({ position, density });

		if (sampleIndex > 0) {
			const previousDensity = samples[sampleIndex - 1].density;
			cumulativeRayleigh[sampleIndex] =
				cumulativeRayleigh[sampleIndex - 1] +
				0.5 * (previousDensity.rayleigh + density.rayleigh) * step;
			cumulativeMie[sampleIndex] =
				cumulativeMie[sampleIndex - 1] +
				0.5 * (previousDensity.mie + density.mie) * step;
		}
	}

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sample = samples[sampleIndex];
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;
		const viewTransmittance = computeTransmittanceAtWavelength({
			rayleighOpticalLength: cumulativeRayleigh[sampleIndex],
			mieOpticalLength: cumulativeMie[sampleIndex],
			absorptionOpticalLength: 0,
		}, wavelengthNanometers);

		secondOrderSum +=
			computeSecondOrderAtSampleAtWavelength({
				position: sample.position,
				viewRay: direction,
				sunRay,
				sunCaseId,
				density: sample.density,
				viewTransmittance,
				wavelengthNanometers,
				wavelengthMicrometers,
				solarIrradiance,
				incidentSkyCache,
			}) * weight;
	}

	return secondOrderSum * step;
}

function computeSecondOrderAtSampleAtWavelength({
	position,
	viewRay,
	sunRay,
	sunCaseId = DIRECT_RADIANCE_SUN_CASE.id,
	density,
	viewTransmittance,
	wavelengthNanometers,
	wavelengthMicrometers,
	solarIrradiance,
	incidentSkyCache,
}) {
	const incomingDirections = fibonacciSphereIncomingDirections(
		sunRay,
		ATMOSPHERE.secondOrderIncomingDirections
	);
	const angularWeight = (4 * Math.PI) / incomingDirections.length;
	let secondOrder = 0;

	for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
		const incomingDirection = incomingDirections[directionIndex];
		const incidentRadiance = incidentSkyRadianceForSecondOrderAtWavelength({
			sunRay,
			sunCaseId,
			incomingDirection,
			directionIndex,
			position,
			wavelengthNanometers,
			wavelengthMicrometers,
			solarIrradiance,
			incidentSkyCache,
		});
		const nu = dot(viewRay, incomingDirection);
		const scatteringCoefficient =
			density.rayleigh *
				rayleighScatteringCoefficientAt(wavelengthMicrometers) *
				rayleighPhaseFunction(nu) +
			density.mie *
				mieScatteringCoefficientAt(wavelengthMicrometers) *
				miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);

		secondOrder +=
			viewTransmittance *
			incidentRadiance *
			scatteringCoefficient *
			angularWeight;
	}

	return secondOrder;
}

function incidentSkyRadianceForSecondOrderAtWavelength({
	sunRay,
	sunCaseId = DIRECT_RADIANCE_SUN_CASE.id,
	incomingDirection,
	directionIndex,
	position,
	wavelengthNanometers,
	wavelengthMicrometers,
	solarIrradiance,
	incidentSkyCache,
}) {
	const atmosphereHeight =
		ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters;
	const altitude = clamp(
		length(position) - ATMOSPHERE.bottomRadiusMeters,
		0,
		atmosphereHeight
	);
	const binSize = atmosphereHeight / ATMOSPHERE.secondOrderIncidentAltitudeBins;
	const binIndex = clamp(
		Math.floor(altitude / binSize),
		0,
		ATMOSPHERE.secondOrderIncidentAltitudeBins - 1
	);
	const key = [
		sunCaseId,
		wavelengthNanometers,
		directionIndex,
		binIndex,
	].join('|');

	if (!incidentSkyCache.has(key)) {
		const binAltitude = (binIndex + 0.5) * binSize;
		const binOrigin = [
			0,
			0,
			ATMOSPHERE.bottomRadiusMeters + binAltitude,
		];
		const radius = length(binOrigin);
		const mu = dot(binOrigin, incomingDirection) / radius;

		if (rayIntersectsGround(radius, mu)) {
			incidentSkyCache.set(key, 0);
		} else {
			const distanceToTop = distanceToTopAtmosphereBoundaryForRadiusMu(radius, mu);
			const incident = computeFirstOrderRadianceAtWavelength({
				origin: binOrigin,
				direction: incomingDirection,
				distance: distanceToTop,
				wavelengthNanometers,
				wavelengthMicrometers,
				solarIrradiance,
				sunRay,
			});

			incidentSkyCache.set(key, incident.firstOrderPathRadiance);
		}
	}

	return incidentSkyCache.get(key);
}

function runAtmosphereComponentShader(components) {
	const canvas = document.createElement('canvas');
	canvas.width = components.length;
	canvas.height = 1;
	const gl = canvas.getContext('webgl2');

	if (!gl) {
		return {
			status: 'rejected',
			reason: 'WebGL2 unavailable for atmosphere component shader diagnostics.',
		};
	}

	const extension = gl.getExtension('EXT_color_buffer_float');
	if (!extension) {
		return {
			status: 'rejected',
			reason: 'EXT_color_buffer_float unavailable for float readback.',
			webglVersion: gl.getParameter(gl.VERSION),
		};
	}

	const program = createAtmosphereShaderProgram(gl);
	const framebuffer = gl.createFramebuffer();
	const texture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA32F,
		components.length,
		1,
		0,
		gl.RGBA,
		gl.FLOAT,
		null
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER,
		gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D,
		texture,
		0
	);

	if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		return {
			status: 'rejected',
			reason: 'Atmosphere component shader framebuffer is incomplete.',
		};
	}

	gl.viewport(0, 0, components.length, 1);
	gl.useProgram(program);
	uploadAtmosphereShaderUniforms(gl, program, components);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);
	const positionLocation = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	const pixels = new Float32Array(components.length * 4);
	gl.readPixels(0, 0, components.length, 1, gl.RGBA, gl.FLOAT, pixels);

	const samples = components.map((component, index) => {
		const offset = index * 4;
		const shaderRayleighOpticalLength = pixels[offset] * 25000;
		const shaderMieOpticalLength = pixels[offset + 1] * 12000;
		const shaderTransmittance532 = pixels[offset + 2];
		const shaderPathDistanceMeters = pixels[offset + 3] * 150000;
		const wavelengthIndex = SPECTRAL_WAVELENGTHS_NM.indexOf(532.333333333333);
		const jsTransmittance532 = component.transmittanceByWavelength[wavelengthIndex];

		return {
			id: component.id,
			wavelengthNanometers: 532.333333333333,
			shader: {
				rayleighOpticalLength: shaderRayleighOpticalLength,
				mieOpticalLength: shaderMieOpticalLength,
				transmittance: shaderTransmittance532,
				pathDistanceMeters: shaderPathDistanceMeters,
			},
			js: {
				rayleighOpticalLength: component.opticalLengths.rayleighOpticalLength,
				mieOpticalLength: component.opticalLengths.mieOpticalLength,
				transmittance: jsTransmittance532,
				pathDistanceMeters: component.pathDistanceMeters,
			},
			deltas: {
				rayleighOpticalLength:
					shaderRayleighOpticalLength -
					component.opticalLengths.rayleighOpticalLength,
				mieOpticalLength:
					shaderMieOpticalLength -
					component.opticalLengths.mieOpticalLength,
				transmittance: shaderTransmittance532 - jsTransmittance532,
				pathDistanceMeters: shaderPathDistanceMeters - component.pathDistanceMeters,
			},
		};
	});

	return {
		status: 'accepted',
		kind: 'browser-atmosphere-component-shader-diagnostics',
		webglVersion: gl.getParameter(gl.VERSION),
		shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
		componentCount: components.length,
		samples,
	};
}

function runDirectRadianceShader(diagnostics) {
	const canvas = document.createElement('canvas');
	canvas.width = diagnostics.length;
	canvas.height = 1;
	const gl = canvas.getContext('webgl2');

	if (!gl) {
		return {
			status: 'rejected',
			reason: 'WebGL2 unavailable for direct radiance shader diagnostics.',
		};
	}

	const extension = gl.getExtension('EXT_color_buffer_float');
	if (!extension) {
		return {
			status: 'rejected',
			reason: 'EXT_color_buffer_float unavailable for direct radiance float readback.',
			webglVersion: gl.getParameter(gl.VERSION),
		};
	}

	const program = createDirectRadianceShaderProgram(gl);
	const framebuffer = gl.createFramebuffer();
	const texture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA32F,
		diagnostics.length,
		1,
		0,
		gl.RGBA,
		gl.FLOAT,
		null
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER,
		gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D,
		texture,
		0
	);

	if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		return {
			status: 'rejected',
			reason: 'Direct radiance shader framebuffer is incomplete.',
		};
	}

	gl.viewport(0, 0, diagnostics.length, 1);
	gl.useProgram(program);
	uploadDirectRadianceShaderUniforms(gl, program, diagnostics);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);
	const positionLocation = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	const pixels = new Float32Array(diagnostics.length * 4);
	gl.readPixels(0, 0, diagnostics.length, 1, gl.RGBA, gl.FLOAT, pixels);

	const samples = diagnostics.map((diagnostic, index) => {
		const offset = index * 4;
		const shaderRayleigh = pixels[offset];
		const shaderMie = pixels[offset + 1];
		const shaderPathRadiance = pixels[offset + 2];
		const shaderFinalRadiance = pixels[offset + 3];

		return {
			id: diagnostic.id,
			wavelengthNanometers: diagnostic.wavelengthNanometers,
			shader: {
				firstOrderRayleighPathRadiance: shaderRayleigh,
				firstOrderMiePathRadiance: shaderMie,
				firstOrderPathRadiance: shaderPathRadiance,
				finalRadiance: shaderFinalRadiance,
			},
			js: {
				firstOrderRayleighPathRadiance:
					diagnostic.firstOrderRayleighPathRadiance,
				firstOrderMiePathRadiance: diagnostic.firstOrderMiePathRadiance,
				firstOrderPathRadiance: diagnostic.firstOrderPathRadiance,
				finalRadiance: diagnostic.finalRadiance,
			},
			deltas: {
				firstOrderRayleighPathRadiance:
					shaderRayleigh - diagnostic.firstOrderRayleighPathRadiance,
				firstOrderMiePathRadiance:
					shaderMie - diagnostic.firstOrderMiePathRadiance,
				firstOrderPathRadiance:
					shaderPathRadiance - diagnostic.firstOrderPathRadiance,
				finalRadiance: shaderFinalRadiance - diagnostic.finalRadiance,
			},
		};
	});

	return {
		status: 'accepted',
		kind: 'browser-direct-radiance-shader-diagnostics',
		webglVersion: gl.getParameter(gl.VERSION),
		shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
		componentCount: diagnostics.length,
		samples,
	};
}

function runSecondOrderRadianceShader(diagnostics) {
	const canvas = document.createElement('canvas');
	canvas.width = diagnostics.length;
	canvas.height = 1;
	const gl = canvas.getContext('webgl2');

	if (!gl) {
		return {
			status: 'rejected',
			reason: 'WebGL2 unavailable for second-order radiance shader diagnostics.',
		};
	}

	const extension = gl.getExtension('EXT_color_buffer_float');
	if (!extension) {
		return {
			status: 'rejected',
			reason: 'EXT_color_buffer_float unavailable for second-order radiance float readback.',
			webglVersion: gl.getParameter(gl.VERSION),
		};
	}

	const program = createSecondOrderRadianceShaderProgram(gl);
	const framebuffer = gl.createFramebuffer();
	const texture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA32F,
		diagnostics.length,
		1,
		0,
		gl.RGBA,
		gl.FLOAT,
		null
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER,
		gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D,
		texture,
		0
	);

	if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		return {
			status: 'rejected',
			reason: 'Second-order radiance shader framebuffer is incomplete.',
		};
	}

	gl.viewport(0, 0, diagnostics.length, 1);
	gl.useProgram(program);
	uploadDirectRadianceShaderUniforms(gl, program, diagnostics);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);
	const positionLocation = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	const pixels = new Float32Array(diagnostics.length * 4);
	gl.readPixels(0, 0, diagnostics.length, 1, gl.RGBA, gl.FLOAT, pixels);

	const samples = diagnostics.map((diagnostic, index) => {
		const offset = index * 4;
		const shaderFirstOrderPathRadiance = pixels[offset];
		const shaderSecondOrderPathRadiance = pixels[offset + 1];
		const shaderPathRadiance = pixels[offset + 2];
		const shaderFinalRadiance = pixels[offset + 3];

		return {
			id: diagnostic.id,
			shader: {
				firstOrderPathRadiance: shaderFirstOrderPathRadiance,
				secondOrderPathRadiance: shaderSecondOrderPathRadiance,
				pathRadiance: shaderPathRadiance,
				finalRadiance: shaderFinalRadiance,
			},
			js: {
				firstOrderPathRadiance: diagnostic.firstOrderPathRadiance,
				secondOrderPathRadiance: diagnostic.secondOrderPathRadiance,
				pathRadiance: diagnostic.pathRadiance,
				finalRadiance: diagnostic.finalRadiance,
			},
			deltas: {
				firstOrderPathRadiance:
					shaderFirstOrderPathRadiance -
					diagnostic.firstOrderPathRadiance,
				secondOrderPathRadiance:
					shaderSecondOrderPathRadiance -
					diagnostic.secondOrderPathRadiance,
				pathRadiance: shaderPathRadiance - diagnostic.pathRadiance,
				finalRadiance: shaderFinalRadiance - diagnostic.finalRadiance,
			},
		};
	});

	return {
		status: 'accepted',
		kind: 'browser-second-order-radiance-shader-diagnostics',
		webglVersion: gl.getParameter(gl.VERSION),
		shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
		componentCount: diagnostics.length,
		scatteringPolicy:
			'one-wavelength 532 nm selected-pixel Algorithm32 second-order approximation',
		samples,
	};
}

function runSecondOrderRadianceSpectralShader(diagnostics) {
	const flattened = diagnostics.flatMap((diagnostic, sampleIndex) =>
		diagnostic.channels.map((channel, channelIndex) => ({
			sampleIndex,
			channelIndex,
			id: diagnostic.id,
			algorithm32Ray: diagnostic.algorithm32Ray,
			pathDistanceMeters: diagnostic.pathDistanceMeters,
			objectRadiance: channel.objectRadiance,
			wavelengthNanometers: channel.wavelengthNanometers,
			solarIrradiance: channel.solarIrradiance,
			js: channel,
		}))
	);
	const canvas = document.createElement('canvas');
	canvas.width = flattened.length;
	canvas.height = 1;
	const gl = canvas.getContext('webgl2');

	if (!gl) {
		return {
			status: 'rejected',
			reason: 'WebGL2 unavailable for spectral second-order radiance shader diagnostics.',
		};
	}

	const extension = gl.getExtension('EXT_color_buffer_float');
	if (!extension) {
		return {
			status: 'rejected',
			reason: 'EXT_color_buffer_float unavailable for spectral second-order radiance float readback.',
			webglVersion: gl.getParameter(gl.VERSION),
		};
	}

	const incidentSkyCache = buildSecondOrderIncidentSkyRadianceTextureData(
		sunDirection(DIRECT_RADIANCE_SUN_CASE)
	);
	const program = createSecondOrderRadianceSpectralShaderProgram(gl);
	const framebuffer = gl.createFramebuffer();
	const texture = gl.createTexture();
	const incidentTexture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA32F,
		flattened.length,
		1,
		0,
		gl.RGBA,
		gl.FLOAT,
		null
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER,
		gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D,
		texture,
		0
	);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, incidentTexture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.R32F,
		incidentSkyCache.width,
		incidentSkyCache.height,
		0,
		gl.RED,
		gl.FLOAT,
		incidentSkyCache.data
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		return {
			status: 'rejected',
			reason: 'Spectral second-order radiance shader framebuffer is incomplete.',
		};
	}

	gl.viewport(0, 0, flattened.length, 1);
	gl.useProgram(program);
	gl.uniform1i(gl.getUniformLocation(program, 'incidentSkyRadiance'), 0);
	uploadSecondOrderRadianceSpectralShaderUniforms(gl, program, flattened);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);
	const positionLocation = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	const pixels = new Float32Array(flattened.length * 4);
	gl.readPixels(0, 0, flattened.length, 1, gl.RGBA, gl.FLOAT, pixels);

	const flatSamples = flattened.map((item, index) => {
		const offset = index * 4;
		const shaderFirstOrderPathRadiance = pixels[offset];
		const shaderSecondOrderPathRadiance = pixels[offset + 1];
		const shaderPathRadiance = pixels[offset + 2];
		const shaderFinalRadiance = pixels[offset + 3];

		return {
			id: item.id,
			sampleIndex: item.sampleIndex,
			channelIndex: item.channelIndex,
			wavelengthNanometers: item.wavelengthNanometers,
			shader: {
				firstOrderPathRadiance: shaderFirstOrderPathRadiance,
				secondOrderPathRadiance: shaderSecondOrderPathRadiance,
				pathRadiance: shaderPathRadiance,
				finalRadiance: shaderFinalRadiance,
			},
			js: {
				firstOrderPathRadiance: item.js.firstOrderPathRadiance,
				secondOrderPathRadiance: item.js.secondOrderPathRadiance,
				pathRadiance: item.js.pathRadiance,
				finalRadiance: item.js.finalRadiance,
			},
			deltas: {
				firstOrderPathRadiance:
					shaderFirstOrderPathRadiance -
					item.js.firstOrderPathRadiance,
				secondOrderPathRadiance:
					shaderSecondOrderPathRadiance -
					item.js.secondOrderPathRadiance,
				pathRadiance: shaderPathRadiance - item.js.pathRadiance,
				finalRadiance: shaderFinalRadiance - item.js.finalRadiance,
			},
		};
	});

	return {
		status: 'accepted',
		kind: 'browser-second-order-radiance-spectral-shader-diagnostics',
		webglVersion: gl.getParameter(gl.VERSION),
		shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
		sampleCount: diagnostics.length,
		channelCount: SPECTRAL_CHANNELS.length,
		flatSampleCount: flatSamples.length,
		incidentSkyCache: {
			width: incidentSkyCache.width,
			height: incidentSkyCache.height,
			incomingDirections: ATMOSPHERE.secondOrderIncomingDirections,
			incidentAltitudeBins: ATMOSPHERE.secondOrderIncidentAltitudeBins,
			minRadiance: incidentSkyCache.minRadiance,
			maxRadiance: incidentSkyCache.maxRadiance,
		},
		scatteringPolicy:
			'15-wavelength selected-pixel Algorithm32 second-order approximation with precomputed incident-sky texture',
		flatSamples,
	};
}

function runDirectRadianceSpectralShader(diagnostics) {
	const flattened = diagnostics.flatMap((diagnostic, sampleIndex) =>
		diagnostic.channels.map((channel, channelIndex) => ({
			sampleIndex,
			channelIndex,
			id: diagnostic.id,
			algorithm32Ray: diagnostic.algorithm32Ray,
			pathDistanceMeters: diagnostic.pathDistanceMeters,
			objectRadiance: channel.objectRadiance,
			wavelengthNanometers: channel.wavelengthNanometers,
			solarIrradiance: channel.solarIrradiance,
			js: channel,
		}))
	);
	const canvas = document.createElement('canvas');
	canvas.width = flattened.length;
	canvas.height = 1;
	const gl = canvas.getContext('webgl2');

	if (!gl) {
		return {
			status: 'rejected',
			reason: 'WebGL2 unavailable for spectral direct radiance shader diagnostics.',
		};
	}

	const extension = gl.getExtension('EXT_color_buffer_float');
	if (!extension) {
		return {
			status: 'rejected',
			reason: 'EXT_color_buffer_float unavailable for spectral direct radiance float readback.',
			webglVersion: gl.getParameter(gl.VERSION),
		};
	}

	const program = createDirectRadianceSpectralShaderProgram(gl);
	const framebuffer = gl.createFramebuffer();
	const texture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA32F,
		flattened.length,
		1,
		0,
		gl.RGBA,
		gl.FLOAT,
		null
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER,
		gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D,
		texture,
		0
	);

	if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
		return {
			status: 'rejected',
			reason: 'Spectral direct radiance shader framebuffer is incomplete.',
		};
	}

	gl.viewport(0, 0, flattened.length, 1);
	gl.useProgram(program);
	uploadDirectRadianceSpectralShaderUniforms(gl, program, flattened);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);
	const positionLocation = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	const pixels = new Float32Array(flattened.length * 4);
	gl.readPixels(0, 0, flattened.length, 1, gl.RGBA, gl.FLOAT, pixels);

	const flatSamples = flattened.map((item, index) => {
		const offset = index * 4;
		const shaderRayleigh = pixels[offset];
		const shaderMie = pixels[offset + 1];
		const shaderPathRadiance = pixels[offset + 2];
		const shaderFinalRadiance = pixels[offset + 3];

		return {
			id: item.id,
			sampleIndex: item.sampleIndex,
			channelIndex: item.channelIndex,
			wavelengthNanometers: item.wavelengthNanometers,
			shader: {
				firstOrderRayleighPathRadiance: shaderRayleigh,
				firstOrderMiePathRadiance: shaderMie,
				firstOrderPathRadiance: shaderPathRadiance,
				finalRadiance: shaderFinalRadiance,
			},
			js: {
				firstOrderRayleighPathRadiance:
					item.js.firstOrderRayleighPathRadiance,
				firstOrderMiePathRadiance: item.js.firstOrderMiePathRadiance,
				firstOrderPathRadiance: item.js.firstOrderPathRadiance,
				finalRadiance: item.js.finalRadiance,
			},
			deltas: {
				firstOrderRayleighPathRadiance:
					shaderRayleigh - item.js.firstOrderRayleighPathRadiance,
				firstOrderMiePathRadiance:
					shaderMie - item.js.firstOrderMiePathRadiance,
				firstOrderPathRadiance:
					shaderPathRadiance - item.js.firstOrderPathRadiance,
				finalRadiance: shaderFinalRadiance - item.js.finalRadiance,
			},
		};
	});

	return {
		status: 'accepted',
		kind: 'browser-direct-radiance-spectral-shader-diagnostics',
		webglVersion: gl.getParameter(gl.VERSION),
		shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
		sampleCount: diagnostics.length,
		channelCount: SPECTRAL_CHANNELS.length,
		flatSampleCount: flatSamples.length,
		flatSamples,
	};
}

function summarizeAtmosphereShaderDiagnostics(diagnostics) {
	if (diagnostics.status !== 'accepted') {
		return diagnostics;
	}

	return {
		status: diagnostics.status,
		componentCount: diagnostics.componentCount,
		maxRayleighOpticalLengthDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) => Math.abs(sample.deltas.rayleighOpticalLength))
		),
		maxMieOpticalLengthDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) => Math.abs(sample.deltas.mieOpticalLength))
		),
		maxTransmittanceDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) => Math.abs(sample.deltas.transmittance))
		),
		maxPathDistanceDeltaMeters: Math.max(
			0,
			...diagnostics.samples.map((sample) => Math.abs(sample.deltas.pathDistanceMeters))
		),
	};
}

function summarizeDirectRadianceDiagnostics(diagnostics) {
	return {
		count: diagnostics.length,
		wavelengthNanometers: ATMOSPHERE.diagnosticWavelengthNanometers,
		minFirstOrderPathRadiance: Math.min(
			...diagnostics.map((item) => item.firstOrderPathRadiance)
		),
		maxFirstOrderPathRadiance: Math.max(
			...diagnostics.map((item) => item.firstOrderPathRadiance)
		),
		minFinalRadiance: Math.min(
			...diagnostics.map((item) => item.finalRadiance)
		),
		maxFinalRadiance: Math.max(
			...diagnostics.map((item) => item.finalRadiance)
		),
		bySample: diagnostics.map((item) => ({
			id: item.id,
			pathKind: item.pathKind,
			objectRadiance: item.objectRadiance,
			transmittance: item.transmittance,
			firstOrderPathRadiance: item.firstOrderPathRadiance,
			finalRadiance: item.finalRadiance,
		})),
	};
}

function summarizeDirectRadianceShaderDiagnostics(diagnostics) {
	if (diagnostics.status !== 'accepted') {
		return diagnostics;
	}

	return {
		status: diagnostics.status,
		componentCount: diagnostics.componentCount,
		maxRayleighRadianceDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) =>
				Math.abs(sample.deltas.firstOrderRayleighPathRadiance)
			)
		),
		maxMieRadianceDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) =>
				Math.abs(sample.deltas.firstOrderMiePathRadiance)
			)
		),
		maxPathRadianceDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) =>
				Math.abs(sample.deltas.firstOrderPathRadiance)
			)
		),
		maxFinalRadianceDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) =>
				Math.abs(sample.deltas.finalRadiance)
			)
		),
	};
}

function summarizeSecondOrderRadianceDiagnostics(diagnostics) {
	return {
		count: diagnostics.length,
		wavelengthNanometers: ATMOSPHERE.diagnosticWavelengthNanometers,
		incomingDirections: ATMOSPHERE.secondOrderIncomingDirections,
		incidentAltitudeBins: ATMOSPHERE.secondOrderIncidentAltitudeBins,
		minSecondOrderPathRadiance: Math.min(
			...diagnostics.map((item) => item.secondOrderPathRadiance)
		),
		maxSecondOrderPathRadiance: Math.max(
			...diagnostics.map((item) => item.secondOrderPathRadiance)
		),
		minFinalRadiance: Math.min(
			...diagnostics.map((item) => item.finalRadiance)
		),
		maxFinalRadiance: Math.max(
			...diagnostics.map((item) => item.finalRadiance)
		),
		bySample: diagnostics.map((item) => ({
			id: item.id,
			pathKind: item.pathKind,
			objectRadiance: item.objectRadiance,
			transmittance: item.transmittance,
			firstOrderPathRadiance: item.firstOrderPathRadiance,
			secondOrderPathRadiance: item.secondOrderPathRadiance,
			pathRadiance: item.pathRadiance,
			finalRadiance: item.finalRadiance,
		})),
	};
}

function summarizeSecondOrderRadianceShaderDiagnostics(diagnostics) {
	if (diagnostics.status !== 'accepted') {
		return diagnostics;
	}

	return {
		status: diagnostics.status,
		componentCount: diagnostics.componentCount,
		maxFirstOrderPathRadianceDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) =>
				Math.abs(sample.deltas.firstOrderPathRadiance)
			)
		),
		maxSecondOrderPathRadianceDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) =>
				Math.abs(sample.deltas.secondOrderPathRadiance)
			)
		),
		maxPathRadianceDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) =>
				Math.abs(sample.deltas.pathRadiance)
			)
		),
		maxFinalRadianceDelta: Math.max(
			0,
			...diagnostics.samples.map((sample) =>
				Math.abs(sample.deltas.finalRadiance)
			)
		),
	};
}

function summarizeSecondOrderRadianceSpectralDiagnostics(diagnostics) {
	const allSecondOrder = diagnostics.flatMap((item) =>
		item.secondOrderPathRadianceByWavelength
	);
	const allFinalRadiance = diagnostics.flatMap((item) =>
		item.finalRadianceByWavelength
	);

	return {
		count: diagnostics.length,
		channelCount: SPECTRAL_CHANNELS.length,
		wavelengthsNanometers: SPECTRAL_WAVELENGTHS_NM,
		incomingDirections: ATMOSPHERE.secondOrderIncomingDirections,
		incidentAltitudeBins: ATMOSPHERE.secondOrderIncidentAltitudeBins,
		minSecondOrderPathRadiance: Math.min(...allSecondOrder),
		maxSecondOrderPathRadiance: Math.max(...allSecondOrder),
		minFinalRadiance: Math.min(...allFinalRadiance),
		maxFinalRadiance: Math.max(...allFinalRadiance),
		bySample: diagnostics.map((item) => ({
			id: item.id,
			pathKind: item.pathKind,
			meanFirstOrderPathRadiance: mean(item.firstOrderPathRadianceByWavelength),
			meanSecondOrderPathRadiance: mean(item.secondOrderPathRadianceByWavelength),
			meanPathRadiance: mean(item.pathRadianceByWavelength),
			meanFinalRadiance: mean(item.finalRadianceByWavelength),
		})),
	};
}

function summarizeSecondOrderRadianceSpectralShaderDiagnostics(diagnostics) {
	if (diagnostics.status !== 'accepted') {
		return diagnostics;
	}

	return {
		status: diagnostics.status,
		sampleCount: diagnostics.sampleCount,
		channelCount: diagnostics.channelCount,
		flatSampleCount: diagnostics.flatSampleCount,
		incidentSkyCache: diagnostics.incidentSkyCache,
		maxFirstOrderPathRadianceDelta: Math.max(
			0,
			...diagnostics.flatSamples.map((sample) =>
				Math.abs(sample.deltas.firstOrderPathRadiance)
			)
		),
		maxSecondOrderPathRadianceDelta: Math.max(
			0,
			...diagnostics.flatSamples.map((sample) =>
				Math.abs(sample.deltas.secondOrderPathRadiance)
			)
		),
		maxPathRadianceDelta: Math.max(
			0,
			...diagnostics.flatSamples.map((sample) =>
				Math.abs(sample.deltas.pathRadiance)
			)
		),
		maxFinalRadianceDelta: Math.max(
			0,
			...diagnostics.flatSamples.map((sample) =>
				Math.abs(sample.deltas.finalRadiance)
			)
		),
	};
}

function summarizeDirectRadianceSpectralDiagnostics(diagnostics) {
	const allPathRadiance = diagnostics.flatMap((item) =>
		item.firstOrderPathRadianceByWavelength
	);
	const allFinalRadiance = diagnostics.flatMap((item) =>
		item.finalRadianceByWavelength
	);

	return {
		count: diagnostics.length,
		channelCount: SPECTRAL_CHANNELS.length,
		wavelengthsNanometers: SPECTRAL_WAVELENGTHS_NM,
		minFirstOrderPathRadiance: Math.min(...allPathRadiance),
		maxFirstOrderPathRadiance: Math.max(...allPathRadiance),
		minFinalRadiance: Math.min(...allFinalRadiance),
		maxFinalRadiance: Math.max(...allFinalRadiance),
		bySample: diagnostics.map((item) => ({
			id: item.id,
			pathKind: item.pathKind,
			meanTransmittance: mean(item.transmittanceByWavelength),
			meanFirstOrderPathRadiance: mean(item.firstOrderPathRadianceByWavelength),
			meanFinalRadiance: mean(item.finalRadianceByWavelength),
		})),
	};
}

function summarizeDirectRadianceSpectralShaderDiagnostics(diagnostics) {
	if (diagnostics.status !== 'accepted') {
		return diagnostics;
	}

	return {
		status: diagnostics.status,
		sampleCount: diagnostics.sampleCount,
		channelCount: diagnostics.channelCount,
		flatSampleCount: diagnostics.flatSampleCount,
		maxRayleighRadianceDelta: Math.max(
			0,
			...diagnostics.flatSamples.map((sample) =>
				Math.abs(sample.deltas.firstOrderRayleighPathRadiance)
			)
		),
		maxMieRadianceDelta: Math.max(
			0,
			...diagnostics.flatSamples.map((sample) =>
				Math.abs(sample.deltas.firstOrderMiePathRadiance)
			)
		),
		maxPathRadianceDelta: Math.max(
			0,
			...diagnostics.flatSamples.map((sample) =>
				Math.abs(sample.deltas.firstOrderPathRadiance)
			)
		),
		maxFinalRadianceDelta: Math.max(
			0,
			...diagnostics.flatSamples.map((sample) =>
				Math.abs(sample.deltas.finalRadiance)
			)
		),
	};
}

function compareSelectedImagePixelsToSpectralPreview({
	selectedPixels,
	directRadianceSpectralDiagnostics,
	spectralDiagnostics,
}) {
	const diagnostics = spectralDiagnostics || directRadianceSpectralDiagnostics;
	const diagnosticsById = new Map(
		diagnostics.map((diagnostic) => [
			diagnostic.id,
			diagnostic,
		])
	);

	return selectedPixels.map((sample) => {
		const spectral = diagnosticsById.get(sample.id);
		const expected = spectralToDisplayPreview(spectral.finalRadianceByWavelength);
		const expectedRgba = [...expected.encodedRgb, 255];
		const deltas = sample.rgba.map((value, index) => value - expectedRgba[index]);

		return {
			id: sample.id,
			rgba: sample.rgba,
			expectedRgba,
			deltas,
			maxAbsRgbDelta: Math.max(
				...deltas.slice(0, 3).map((value) => Math.abs(value))
			),
		};
	});
}

function firstOrderImageDiagnostics({
	command,
	canvas,
	renderer,
	camera,
	cards,
	ground,
	selectedPixels,
	imageShaderDiagnostics,
	directRadianceSpectralDiagnostics,
	selectedDisplayChecks,
}) {
	const gl = renderer.getContext();
	const maxSelectedRgbDelta = Math.max(
		0,
		...selectedDisplayChecks.map((item) => item.maxAbsRgbDelta)
	);
	const status =
		imageShaderDiagnostics.status === 'accepted' &&
		selectedPixels.some((sample) => sample.classification === 'sky') &&
		selectedPixels.some((sample) => sample.classification !== 'sky') &&
		maxSelectedRgbDelta <= 2
			? 'accepted'
			: 'rejected';

	return {
		kind: 'browser-first-order-image-diagnostics',
		status,
		iteration: command?.payload?.iteration || 'first-order-image-composition',
		goal: command?.payload?.goal ||
			'Render the simple browser scene through a full-image first-order spectral shader composition pass.',
		commandPayload: command?.payload || null,
		threeRevision: THREE.REVISION,
		webgl: {
			version: gl.getParameter(gl.VERSION),
			shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
			vendor: gl.getParameter(gl.VENDOR),
			renderer: gl.getParameter(gl.RENDERER),
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		camera: {
			type: 'THREE.PerspectiveCamera',
			positionMeters: vectorToArray(camera.position),
			lookAtMeters: [0, 420, -5000],
			verticalFovDegrees: camera.fov,
			aspect: camera.aspect,
			near: camera.near,
			far: camera.far,
		},
		sceneObjects: cards,
		ground,
		imageShaderDiagnostics,
		directRadianceSpectralSummary:
			summarizeDirectRadianceSpectralDiagnostics(
				directRadianceSpectralDiagnostics
			),
		selectedDisplayChecks,
		maxSelectedRgbDelta,
		absentByDesign: [
			'Full-image shader composition uses first-order spectral scattering only.',
			'Algorithm32 second-order approximation is deferred.',
			'This image pass uses analytic intersections for the simple browser scene before depth-buffer composition and mountain geometry are added.',
		],
	};
}

function secondOrderImageDiagnostics({
	command,
	canvas,
	renderer,
	camera,
	cards,
	ground,
	selectedPixels,
	imageShaderDiagnostics,
	secondOrderRadianceSpectralDiagnostics,
	selectedDisplayChecks,
	sceneInputTextureData = null,
}) {
	const gl = renderer.getContext();
	const maxSelectedRgbDelta = Math.max(
		0,
		...selectedDisplayChecks.map((item) => item.maxAbsRgbDelta)
	);
	const status =
		imageShaderDiagnostics.status === 'accepted' &&
		selectedPixels.some((sample) => sample.classification === 'sky') &&
		selectedPixels.some((sample) => sample.classification !== 'sky') &&
		maxSelectedRgbDelta <= 2
			? 'accepted'
			: 'rejected';

	return {
		kind: 'browser-second-order-image-diagnostics',
		status,
		iteration: command?.payload?.iteration ||
			'second-order-image-composition',
		goal: command?.payload?.goal ||
			'Render the simple browser scene through a full-image Algorithm32 spectral shader composition pass with the second-order approximation enabled.',
		commandPayload: command?.payload || null,
		threeRevision: THREE.REVISION,
		webgl: {
			version: gl.getParameter(gl.VERSION),
			shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
			vendor: gl.getParameter(gl.VENDOR),
			renderer: gl.getParameter(gl.RENDERER),
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
		},
		camera: {
			type: 'THREE.PerspectiveCamera',
			positionMeters: vectorToArray(camera.position),
			lookAtMeters: [0, 420, -5000],
			verticalFovDegrees: camera.fov,
			aspect: camera.aspect,
			near: camera.near,
			far: camera.far,
		},
		sceneObjects: cards,
		ground,
		imageShaderDiagnostics,
		sceneInputTexture: sceneInputTextureData
			? {
					width: sceneInputTextureData.width,
					height: sceneInputTextureData.height,
					policy: sceneInputTextureData.policy,
					channels: sceneInputTextureData.channels,
					counts: sceneInputTextureData.counts,
					hitDistanceMeters: sceneInputTextureData.hitDistanceMeters,
				}
			: null,
		secondOrderRadianceSpectralSummary:
			summarizeSecondOrderRadianceSpectralDiagnostics(
				secondOrderRadianceSpectralDiagnostics
			),
		selectedDisplayChecks,
		maxSelectedRgbDelta,
		absentByDesign: [
			sceneInputTextureData
				? 'Full-image shader composition consumes a per-pixel Three Raycaster scene-input texture before depth-buffer composition is added.'
				: 'Full-image shader composition still uses analytic intersections for the simple browser scene before depth-buffer composition and mountain geometry are added.',
			'Second-order incident sky radiance is sampled from the same altitude-binned, incoming-direction texture proven by the selected-pixel diagnostics.',
			'This is a parity-oriented experimental shader, not a performance-optimized production shader.',
		],
	};
}

function spectralToDisplayPreview(radianceByWavelength) {
	let x = 0;
	let y = 0;
	let z = 0;

	for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
		const radiance = radianceByWavelength[channelIndex];
		const cie = SPECTRAL_CIE[channelIndex];
		x += cie[0] * radiance * SPECTRAL_DELTA_NM;
		y += cie[1] * radiance * SPECTRAL_DELTA_NM;
		z += cie[2] * radiance * SPECTRAL_DELTA_NM;
	}

	const linearSrgb = [
		MAX_LUMINOUS_EFFICACY *
			(XYZ_TO_SRGB[0] * x + XYZ_TO_SRGB[1] * y + XYZ_TO_SRGB[2] * z),
		MAX_LUMINOUS_EFFICACY *
			(XYZ_TO_SRGB[3] * x + XYZ_TO_SRGB[4] * y + XYZ_TO_SRGB[5] * z),
		MAX_LUMINOUS_EFFICACY *
			(XYZ_TO_SRGB[6] * x + XYZ_TO_SRGB[7] * y + XYZ_TO_SRGB[8] * z),
	];
	const displayRgb = linearSrgb.map((value) =>
		clamp(1 - Math.exp(-DISPLAY_TONE_MAP_K * Math.max(0, value)), 0, 1)
	);
	const encodedRgb = displayRgb.map((value) => clampByte(value * 255));

	return {
		cieXyzUnscaled: [x, y, z],
		linearSrgb,
		displayRgb,
		encodedRgb,
	};
}

function createAtmosphereShaderProgram(gl) {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 position;

void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;

const int MAX_COMPONENTS = 8;
const int VIEW_SAMPLES = 32;
const float BOTTOM_RADIUS_METERS = 6360000.0;
const float TOP_RADIUS_METERS = 6420000.0;
const float RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0;
const float MIE_SCALE_HEIGHT_METERS = 1200.0;
const float RAYLEIGH_COEFFICIENT_SCALE = 1.24062e-6;
const float MIE_ANGSTROM_ALPHA = 0.8;
const float MIE_ANGSTROM_BETA = 0.04;
const float MIE_SCALE_HEIGHT_METERS_FOR_COEFFICIENT = 1200.0;
const float WAVELENGTH_MICROMETERS = 0.5323333333333333;

uniform int componentCount;
uniform vec3 origins[MAX_COMPONENTS];
uniform vec3 directions[MAX_COMPONENTS];
uniform float distances[MAX_COMPONENTS];

out vec4 outColor;

float rayleighScatteringCoefficientAt(float wavelengthMicrometers) {
	return RAYLEIGH_COEFFICIENT_SCALE * pow(wavelengthMicrometers, -4.0);
}

float mieExtinctionCoefficientAt(float wavelengthMicrometers) {
	return (MIE_ANGSTROM_BETA / MIE_SCALE_HEIGHT_METERS_FOR_COEFFICIENT) *
		pow(wavelengthMicrometers, -MIE_ANGSTROM_ALPHA);
}

void main() {
	int index = int(floor(gl_FragCoord.x));
	if (index < 0 || index >= componentCount) {
		outColor = vec4(0.0);
		return;
	}

	vec3 origin = origins[index];
	vec3 direction = normalize(directions[index]);
	float distanceMeters = distances[index];
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	float rayleighOpticalLength = 0.0;
	float mieOpticalLength = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		float altitudeMeters = length(samplePosition) - BOTTOM_RADIUS_METERS;
		float rayleighDensity = exp(-max(0.0, altitudeMeters) / RAYLEIGH_SCALE_HEIGHT_METERS);
		float mieDensity = exp(-max(0.0, altitudeMeters) / MIE_SCALE_HEIGHT_METERS);
		float weight = sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		rayleighOpticalLength += rayleighDensity * weight * stepSize;
		mieOpticalLength += mieDensity * weight * stepSize;
	}

	float opticalDepth =
		rayleighScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
			rayleighOpticalLength +
		mieExtinctionCoefficientAt(WAVELENGTH_MICROMETERS) *
			mieOpticalLength;
	float transmittance = exp(-opticalDepth);
	outColor = vec4(
		rayleighOpticalLength / 25000.0,
		mieOpticalLength / 12000.0,
		transmittance,
		distanceMeters / 150000.0
	);
}
`);
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) || 'Atmosphere shader link failed.');
	}

	return program;
}

function createDirectRadianceShaderProgram(gl) {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 position;

void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;

const int MAX_COMPONENTS = 8;
const int VIEW_SAMPLES = 20;
const int SUN_TRANSMITTANCE_SAMPLES = 10;
const float BOTTOM_RADIUS_METERS = 6360000.0;
const float TOP_RADIUS_METERS = 6420000.0;
const float RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0;
const float MIE_SCALE_HEIGHT_METERS = 1200.0;
const float RAYLEIGH_COEFFICIENT_SCALE = 1.24062e-6;
const float MIE_ANGSTROM_ALPHA = 0.8;
const float MIE_ANGSTROM_BETA = 0.04;
const float MIE_SINGLE_SCATTERING_ALBEDO = 0.8;
const float MIE_PHASE_G = 0.7;
const float WAVELENGTH_MICROMETERS = 0.5323333333333333;
const float SOLAR_IRRADIANCE = 1.883391;
const vec3 SUN_RAY = vec3(0.02927623871171526, 0.3571701122829255, 0.9335804264972017);

uniform int componentCount;
uniform vec3 origins[MAX_COMPONENTS];
uniform vec3 directions[MAX_COMPONENTS];
uniform float distances[MAX_COMPONENTS];
uniform float objectRadiances[MAX_COMPONENTS];

out vec4 outColor;

float rayleighScatteringCoefficientAt(float wavelengthMicrometers) {
	return RAYLEIGH_COEFFICIENT_SCALE * pow(wavelengthMicrometers, -4.0);
}

float mieExtinctionCoefficientAt(float wavelengthMicrometers) {
	return (MIE_ANGSTROM_BETA / MIE_SCALE_HEIGHT_METERS) *
		pow(wavelengthMicrometers, -MIE_ANGSTROM_ALPHA);
}

float mieScatteringCoefficientAt(float wavelengthMicrometers) {
	return mieExtinctionCoefficientAt(wavelengthMicrometers) *
		MIE_SINGLE_SCATTERING_ALBEDO;
}

float opticalDepthAt(float rayleighOpticalLength, float mieOpticalLength) {
	return
		rayleighScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
			rayleighOpticalLength +
		mieExtinctionCoefficientAt(WAVELENGTH_MICROMETERS) *
			mieOpticalLength;
}

float transmittanceAt(float rayleighOpticalLength, float mieOpticalLength) {
	return exp(-opticalDepthAt(rayleighOpticalLength, mieOpticalLength));
}

float rayleighPhaseFunction(float nu) {
	return (3.0 / (16.0 * 3.141592653589793)) * (1.0 + nu * nu);
}

float miePhaseFunction(float g, float nu) {
	float k = (3.0 / (8.0 * 3.141592653589793)) *
		((1.0 - g * g) / (2.0 + g * g));

	return (k * (1.0 + nu * nu)) /
		pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

float distanceToTopAtmosphereBoundary(float radius, float mu) {
	float discriminant =
		radius * radius * (mu * mu - 1.0) +
		TOP_RADIUS_METERS * TOP_RADIUS_METERS;

	return max(0.0, -radius * mu + sqrt(max(0.0, discriminant)));
}

bool rayIntersectsGround(float radius, float mu) {
	return
		mu < 0.0 &&
		radius * radius * (mu * mu - 1.0) +
			BOTTOM_RADIUS_METERS * BOTTOM_RADIUS_METERS >=
			0.0;
}

vec2 densityAtPosition(vec3 position) {
	float altitudeMeters = length(position) - BOTTOM_RADIUS_METERS;
	float rayleighDensity =
		exp(-max(0.0, altitudeMeters) / RAYLEIGH_SCALE_HEIGHT_METERS);
	float mieDensity =
		exp(-max(0.0, altitudeMeters) / MIE_SCALE_HEIGHT_METERS);

	return vec2(rayleighDensity, mieDensity);
}

float computeSunTransmittance(vec3 position) {
	float radius = length(position);
	float mu = dot(position, SUN_RAY) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return 0.0;
	}

	float distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
	float stepSize = distanceToTop / float(SUN_TRANSMITTANCE_SAMPLES);
	float rayleighOpticalLength = 0.0;
	float mieOpticalLength = 0.0;

	for (int sampleIndex = 0; sampleIndex <= SUN_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = position + SUN_RAY * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);
		float weight =
			sampleIndex == 0 || sampleIndex == SUN_TRANSMITTANCE_SAMPLES
				? 0.5
				: 1.0;
		rayleighOpticalLength += density.x * weight * stepSize;
		mieOpticalLength += density.y * weight * stepSize;
	}

	return transmittanceAt(rayleighOpticalLength, mieOpticalLength);
}

void main() {
	int index = int(floor(gl_FragCoord.x));
	if (index < 0 || index >= componentCount) {
		outColor = vec4(0.0);
		return;
	}

	vec3 origin = origins[index];
	vec3 direction = normalize(directions[index]);
	float distanceMeters = distances[index];
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float previousRayleigh = 0.0;
	float previousMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);

		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousRayleigh + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousMie + density.y) * stepSize;
		}

		float viewTransmittance =
			transmittanceAt(cumulativeRayleigh, cumulativeMie);
		float sunTransmittance = computeSunTransmittance(samplePosition);
		float transmittance = viewTransmittance * sunTransmittance;
		float weight =
			sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		rayleighSum += transmittance * density.x * weight;
		mieSum += transmittance * density.y * weight;
		previousRayleigh = density.x;
		previousMie = density.y;
	}

	float nu = dot(direction, SUN_RAY);
	float rayleigh =
		rayleighSum *
		stepSize *
		SOLAR_IRRADIANCE *
		rayleighScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
		rayleighPhaseFunction(nu);
	float mie =
		mieSum *
		stepSize *
		SOLAR_IRRADIANCE *
		mieScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
		miePhaseFunction(MIE_PHASE_G, nu);
	float pathRadiance = rayleigh + mie;
	float viewTransmittance =
		transmittanceAt(cumulativeRayleigh, cumulativeMie);
	float finalRadiance =
		objectRadiances[index] * viewTransmittance + pathRadiance;

	outColor = vec4(rayleigh, mie, pathRadiance, finalRadiance);
}
`);
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) || 'Direct radiance shader link failed.');
	}

	return program;
}

function createSecondOrderRadianceShaderProgram(gl) {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 position;

void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;

const int MAX_COMPONENTS = 8;
const int VIEW_SAMPLES = 20;
const int SUN_TRANSMITTANCE_SAMPLES = 10;
const int SECOND_ORDER_INCOMING_DIRECTIONS = 17;
const int SECOND_ORDER_HALF_COUNT = 8;
const int SECOND_ORDER_INCIDENT_ALTITUDE_BINS = 24;
const float PI = 3.141592653589793;
const float BOTTOM_RADIUS_METERS = 6360000.0;
const float TOP_RADIUS_METERS = 6420000.0;
const float RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0;
const float MIE_SCALE_HEIGHT_METERS = 1200.0;
const float RAYLEIGH_COEFFICIENT_SCALE = 1.24062e-6;
const float MIE_ANGSTROM_ALPHA = 0.8;
const float MIE_ANGSTROM_BETA = 0.04;
const float MIE_SINGLE_SCATTERING_ALBEDO = 0.8;
const float MIE_PHASE_G = 0.7;
const float WAVELENGTH_MICROMETERS = 0.5323333333333333;
const float SOLAR_IRRADIANCE = 1.883391;
const float GOLDEN_RATIO = 1.618033988749895;
const vec3 SUN_RAY = vec3(0.02927623871171526, 0.3571701122829255, 0.9335804264972017);

uniform int componentCount;
uniform vec3 origins[MAX_COMPONENTS];
uniform vec3 directions[MAX_COMPONENTS];
uniform float distances[MAX_COMPONENTS];
uniform float objectRadiances[MAX_COMPONENTS];

out vec4 outColor;

float rayleighScatteringCoefficientAt(float wavelengthMicrometers) {
	return RAYLEIGH_COEFFICIENT_SCALE * pow(wavelengthMicrometers, -4.0);
}

float mieExtinctionCoefficientAt(float wavelengthMicrometers) {
	return (MIE_ANGSTROM_BETA / MIE_SCALE_HEIGHT_METERS) *
		pow(wavelengthMicrometers, -MIE_ANGSTROM_ALPHA);
}

float mieScatteringCoefficientAt(float wavelengthMicrometers) {
	return mieExtinctionCoefficientAt(wavelengthMicrometers) *
		MIE_SINGLE_SCATTERING_ALBEDO;
}

float opticalDepthAt(float rayleighOpticalLength, float mieOpticalLength) {
	return
		rayleighScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
			rayleighOpticalLength +
		mieExtinctionCoefficientAt(WAVELENGTH_MICROMETERS) *
			mieOpticalLength;
}

float transmittanceAt(float rayleighOpticalLength, float mieOpticalLength) {
	return exp(-opticalDepthAt(rayleighOpticalLength, mieOpticalLength));
}

float rayleighPhaseFunction(float nu) {
	return (3.0 / (16.0 * PI)) * (1.0 + nu * nu);
}

float miePhaseFunction(float g, float nu) {
	float k = (3.0 / (8.0 * PI)) *
		((1.0 - g * g) / (2.0 + g * g));

	return (k * (1.0 + nu * nu)) /
		pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

float distanceToTopAtmosphereBoundary(float radius, float mu) {
	float discriminant =
		radius * radius * (mu * mu - 1.0) +
		TOP_RADIUS_METERS * TOP_RADIUS_METERS;

	return max(0.0, -radius * mu + sqrt(max(0.0, discriminant)));
}

bool rayIntersectsGround(float radius, float mu) {
	return
		mu < 0.0 &&
		radius * radius * (mu * mu - 1.0) +
			BOTTOM_RADIUS_METERS * BOTTOM_RADIUS_METERS >=
			0.0;
}

vec2 densityAtPosition(vec3 position) {
	float altitudeMeters = length(position) - BOTTOM_RADIUS_METERS;
	float rayleighDensity =
		exp(-max(0.0, altitudeMeters) / RAYLEIGH_SCALE_HEIGHT_METERS);
	float mieDensity =
		exp(-max(0.0, altitudeMeters) / MIE_SCALE_HEIGHT_METERS);

	return vec2(rayleighDensity, mieDensity);
}

float computeSunTransmittance(vec3 position) {
	float radius = length(position);
	float mu = dot(position, SUN_RAY) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return 0.0;
	}

	float distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
	float stepSize = distanceToTop / float(SUN_TRANSMITTANCE_SAMPLES);
	float rayleighOpticalLength = 0.0;
	float mieOpticalLength = 0.0;

	for (int sampleIndex = 0; sampleIndex <= SUN_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = position + SUN_RAY * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);
		float weight =
			sampleIndex == 0 || sampleIndex == SUN_TRANSMITTANCE_SAMPLES
				? 0.5
				: 1.0;
		rayleighOpticalLength += density.x * weight * stepSize;
		mieOpticalLength += density.y * weight * stepSize;
	}

	return transmittanceAt(rayleighOpticalLength, mieOpticalLength);
}

float computeFirstOrderPathRadiance(vec3 origin, vec3 direction, float distanceMeters) {
	if (distanceMeters == 0.0) {
		return 0.0;
	}

	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float previousRayleigh = 0.0;
	float previousMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);

		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousRayleigh + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousMie + density.y) * stepSize;
		}

		float viewTransmittance = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie
		);
		float sunTransmittance = computeSunTransmittance(samplePosition);
		float transmittance = viewTransmittance * sunTransmittance;
		float weight =
			sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		rayleighSum += transmittance * density.x * weight;
		mieSum += transmittance * density.y * weight;
		previousRayleigh = density.x;
		previousMie = density.y;
	}

	float nu = dot(direction, SUN_RAY);
	float rayleigh =
		rayleighSum *
		stepSize *
		SOLAR_IRRADIANCE *
		rayleighScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
		rayleighPhaseFunction(nu);
	float mie =
		mieSum *
		stepSize *
		SOLAR_IRRADIANCE *
		mieScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
		miePhaseFunction(MIE_PHASE_G, nu);

	return rayleigh + mie;
}

vec3 incomingDirectionAt(int directionIndex) {
	int fibonacciIndex = directionIndex - SECOND_ORDER_HALF_COUNT;
	float z = (2.0 * float(fibonacciIndex)) /
		float(SECOND_ORDER_INCOMING_DIRECTIONS);
	float latitude = asin(clamp(z, -1.0, 1.0));
	float longitude = (2.0 * PI * float(fibonacciIndex)) / GOLDEN_RATIO;
	float horizontalScale = cos(latitude);
	float localX = horizontalScale * cos(longitude);
	float localY = horizontalScale * sin(longitude);
	float localZ = z;
	vec3 sunAxis = normalize(SUN_RAY);
	vec3 reference =
		abs(dot(sunAxis, vec3(0.0, 0.0, 1.0))) < 0.95
			? vec3(0.0, 0.0, 1.0)
			: vec3(0.0, 1.0, 0.0);
	vec3 zAxis = normalize(reference - sunAxis * dot(reference, sunAxis));
	vec3 yAxis = normalize(cross(zAxis, sunAxis));

	return normalize(sunAxis * localX + yAxis * localY + zAxis * localZ);
}

float incidentSkyRadianceForSecondOrder(
	vec3 position,
	vec3 incomingDirection,
	int directionIndex
) {
	float atmosphereHeight = TOP_RADIUS_METERS - BOTTOM_RADIUS_METERS;
	float altitude = clamp(
		length(position) - BOTTOM_RADIUS_METERS,
		0.0,
		atmosphereHeight
	);
	float binSize =
		atmosphereHeight / float(SECOND_ORDER_INCIDENT_ALTITUDE_BINS);
	int binIndex = int(clamp(
		floor(altitude / binSize),
		0.0,
		float(SECOND_ORDER_INCIDENT_ALTITUDE_BINS - 1)
	));
	float binAltitude = (float(binIndex) + 0.5) * binSize;
	vec3 binOrigin = vec3(
		0.0,
		0.0,
		BOTTOM_RADIUS_METERS + binAltitude
	);
	float radius = length(binOrigin);
	float mu = dot(binOrigin, incomingDirection) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return 0.0;
	}

	return computeFirstOrderPathRadiance(
		binOrigin,
		incomingDirection,
		distanceToTopAtmosphereBoundary(radius, mu)
	);
}

float computeSecondOrderAtSample(
	vec3 position,
	vec3 viewRay,
	vec2 density,
	float viewTransmittance
) {
	float secondOrder = 0.0;
	float angularWeight =
		(4.0 * PI) / float(SECOND_ORDER_INCOMING_DIRECTIONS);

	for (int directionIndex = 0; directionIndex < SECOND_ORDER_INCOMING_DIRECTIONS; directionIndex++) {
		vec3 incomingDirection = incomingDirectionAt(directionIndex);
		float incidentRadiance = incidentSkyRadianceForSecondOrder(
			position,
			incomingDirection,
			directionIndex
		);
		float nu = dot(viewRay, incomingDirection);
		float scatteringCoefficient =
			density.x *
				rayleighScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
				rayleighPhaseFunction(nu) +
			density.y *
				mieScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
				miePhaseFunction(MIE_PHASE_G, nu);

		secondOrder +=
			viewTransmittance *
			incidentRadiance *
			scatteringCoefficient *
			angularWeight;
	}

	return secondOrder;
}

void main() {
	int index = int(floor(gl_FragCoord.x));
	if (index < 0 || index >= componentCount) {
		outColor = vec4(0.0);
		return;
	}

	vec3 origin = origins[index];
	vec3 direction = normalize(directions[index]);
	float distanceMeters = distances[index];
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float previousRayleigh = 0.0;
	float previousMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;
	float secondOrderSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);

		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousRayleigh + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousMie + density.y) * stepSize;
		}

		float viewTransmittance = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie
		);
		float sunTransmittance = computeSunTransmittance(samplePosition);
		float transmittance = viewTransmittance * sunTransmittance;
		float weight =
			sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		rayleighSum += transmittance * density.x * weight;
		mieSum += transmittance * density.y * weight;
		secondOrderSum +=
			computeSecondOrderAtSample(
				samplePosition,
				direction,
				density,
				viewTransmittance
			) * weight;
		previousRayleigh = density.x;
		previousMie = density.y;
	}

	float nu = dot(direction, SUN_RAY);
	float rayleigh =
		rayleighSum *
		stepSize *
		SOLAR_IRRADIANCE *
		rayleighScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
		rayleighPhaseFunction(nu);
	float mie =
		mieSum *
		stepSize *
		SOLAR_IRRADIANCE *
		mieScatteringCoefficientAt(WAVELENGTH_MICROMETERS) *
		miePhaseFunction(MIE_PHASE_G, nu);
	float firstOrderPathRadiance = rayleigh + mie;
	float secondOrderPathRadiance = secondOrderSum * stepSize;
	float pathRadiance = firstOrderPathRadiance + secondOrderPathRadiance;
	float viewTransmittance = transmittanceAt(
		cumulativeRayleigh,
		cumulativeMie
	);
	float finalRadiance =
		objectRadiances[index] * viewTransmittance + pathRadiance;

	outColor = vec4(
		firstOrderPathRadiance,
		secondOrderPathRadiance,
		pathRadiance,
		finalRadiance
	);
}
`);
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) || 'Second-order radiance shader link failed.');
	}

	return program;
}

function createSecondOrderRadianceSpectralShaderProgram(gl) {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 position;

void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
precision highp sampler2D;

const int MAX_VALUES = 128;
const int CHANNEL_COUNT = 15;
const int VIEW_SAMPLES = 20;
const int SUN_TRANSMITTANCE_SAMPLES = 10;
const int SECOND_ORDER_INCOMING_DIRECTIONS = 17;
const int SECOND_ORDER_HALF_COUNT = 8;
const int SECOND_ORDER_INCIDENT_ALTITUDE_BINS = 24;
const float PI = 3.141592653589793;
const float BOTTOM_RADIUS_METERS = 6360000.0;
const float TOP_RADIUS_METERS = 6420000.0;
const float RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0;
const float MIE_SCALE_HEIGHT_METERS = 1200.0;
const float RAYLEIGH_COEFFICIENT_SCALE = 1.24062e-6;
const float MIE_ANGSTROM_ALPHA = 0.8;
const float MIE_ANGSTROM_BETA = 0.04;
const float MIE_SINGLE_SCATTERING_ALBEDO = 0.8;
const float MIE_PHASE_G = 0.7;
const float GOLDEN_RATIO = 1.618033988749895;
const vec3 SUN_RAY = vec3(0.02927623871171526, 0.3571701122829255, 0.9335804264972017);

uniform int valueCount;
uniform vec3 origins[MAX_VALUES];
uniform vec3 directions[MAX_VALUES];
uniform float distances[MAX_VALUES];
uniform float objectRadiances[MAX_VALUES];
uniform float wavelengthMicrometers[MAX_VALUES];
uniform float solarIrradiances[MAX_VALUES];
uniform int channelIndices[MAX_VALUES];
uniform sampler2D incidentSkyRadiance;

out vec4 outColor;

float rayleighScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return RAYLEIGH_COEFFICIENT_SCALE * pow(wavelengthMicrometersValue, -4.0);
}

float mieExtinctionCoefficientAt(float wavelengthMicrometersValue) {
	return (MIE_ANGSTROM_BETA / MIE_SCALE_HEIGHT_METERS) *
		pow(wavelengthMicrometersValue, -MIE_ANGSTROM_ALPHA);
}

float mieScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
		MIE_SINGLE_SCATTERING_ALBEDO;
}

float opticalDepthAt(
	float rayleighOpticalLength,
	float mieOpticalLength,
	float wavelengthMicrometersValue
) {
	return
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
			rayleighOpticalLength +
		mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
			mieOpticalLength;
}

float transmittanceAt(
	float rayleighOpticalLength,
	float mieOpticalLength,
	float wavelengthMicrometersValue
) {
	return exp(
		-opticalDepthAt(
			rayleighOpticalLength,
			mieOpticalLength,
			wavelengthMicrometersValue
		)
	);
}

float rayleighPhaseFunction(float nu) {
	return (3.0 / (16.0 * PI)) * (1.0 + nu * nu);
}

float miePhaseFunction(float g, float nu) {
	float k = (3.0 / (8.0 * PI)) *
		((1.0 - g * g) / (2.0 + g * g));

	return (k * (1.0 + nu * nu)) /
		pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

float distanceToTopAtmosphereBoundary(float radius, float mu) {
	float discriminant =
		radius * radius * (mu * mu - 1.0) +
		TOP_RADIUS_METERS * TOP_RADIUS_METERS;

	return max(0.0, -radius * mu + sqrt(max(0.0, discriminant)));
}

bool rayIntersectsGround(float radius, float mu) {
	return
		mu < 0.0 &&
		radius * radius * (mu * mu - 1.0) +
			BOTTOM_RADIUS_METERS * BOTTOM_RADIUS_METERS >=
			0.0;
}

vec2 densityAtPosition(vec3 position) {
	float altitudeMeters = length(position) - BOTTOM_RADIUS_METERS;
	float rayleighDensity =
		exp(-max(0.0, altitudeMeters) / RAYLEIGH_SCALE_HEIGHT_METERS);
	float mieDensity =
		exp(-max(0.0, altitudeMeters) / MIE_SCALE_HEIGHT_METERS);

	return vec2(rayleighDensity, mieDensity);
}

float computeSunTransmittance(
	vec3 position,
	float wavelengthMicrometersValue
) {
	float radius = length(position);
	float mu = dot(position, SUN_RAY) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return 0.0;
	}

	float distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
	float stepSize = distanceToTop / float(SUN_TRANSMITTANCE_SAMPLES);
	float rayleighOpticalLength = 0.0;
	float mieOpticalLength = 0.0;

	for (int sampleIndex = 0; sampleIndex <= SUN_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = position + SUN_RAY * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);
		float weight =
			sampleIndex == 0 || sampleIndex == SUN_TRANSMITTANCE_SAMPLES
				? 0.5
				: 1.0;
		rayleighOpticalLength += density.x * weight * stepSize;
		mieOpticalLength += density.y * weight * stepSize;
	}

	return transmittanceAt(
		rayleighOpticalLength,
		mieOpticalLength,
		wavelengthMicrometersValue
	);
}

vec3 incomingDirectionAt(int directionIndex) {
	int fibonacciIndex = directionIndex - SECOND_ORDER_HALF_COUNT;
	float z = (2.0 * float(fibonacciIndex)) /
		float(SECOND_ORDER_INCOMING_DIRECTIONS);
	float latitude = asin(clamp(z, -1.0, 1.0));
	float longitude = (2.0 * PI * float(fibonacciIndex)) / GOLDEN_RATIO;
	float horizontalScale = cos(latitude);
	float localX = horizontalScale * cos(longitude);
	float localY = horizontalScale * sin(longitude);
	float localZ = z;
	vec3 sunAxis = normalize(SUN_RAY);
	vec3 reference =
		abs(dot(sunAxis, vec3(0.0, 0.0, 1.0))) < 0.95
			? vec3(0.0, 0.0, 1.0)
			: vec3(0.0, 1.0, 0.0);
	vec3 zAxis = normalize(reference - sunAxis * dot(reference, sunAxis));
	vec3 yAxis = normalize(cross(zAxis, sunAxis));

	return normalize(sunAxis * localX + yAxis * localY + zAxis * localZ);
}

float incidentSkyRadianceForSecondOrder(
	vec3 position,
	int directionIndex,
	int channelIndex
) {
	float atmosphereHeight = TOP_RADIUS_METERS - BOTTOM_RADIUS_METERS;
	float altitude = clamp(
		length(position) - BOTTOM_RADIUS_METERS,
		0.0,
		atmosphereHeight
	);
	float binSize =
		atmosphereHeight / float(SECOND_ORDER_INCIDENT_ALTITUDE_BINS);
	int binIndex = int(clamp(
		floor(altitude / binSize),
		0.0,
		float(SECOND_ORDER_INCIDENT_ALTITUDE_BINS - 1)
	));
	int row = binIndex * SECOND_ORDER_INCOMING_DIRECTIONS + directionIndex;

	return texelFetch(incidentSkyRadiance, ivec2(channelIndex, row), 0).r;
}

float computeSecondOrderAtSample(
	vec3 position,
	vec3 viewRay,
	vec2 density,
	float viewTransmittance,
	float wavelengthMicrometersValue,
	int channelIndex
) {
	float secondOrder = 0.0;
	float angularWeight =
		(4.0 * PI) / float(SECOND_ORDER_INCOMING_DIRECTIONS);

	for (int directionIndex = 0; directionIndex < SECOND_ORDER_INCOMING_DIRECTIONS; directionIndex++) {
		vec3 incomingDirection = incomingDirectionAt(directionIndex);
		float incidentRadiance = incidentSkyRadianceForSecondOrder(
			position,
			directionIndex,
			channelIndex
		);
		float nu = dot(viewRay, incomingDirection);
		float scatteringCoefficient =
			density.x *
				rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
				rayleighPhaseFunction(nu) +
			density.y *
				mieScatteringCoefficientAt(wavelengthMicrometersValue) *
				miePhaseFunction(MIE_PHASE_G, nu);

		secondOrder +=
			viewTransmittance *
			incidentRadiance *
			scatteringCoefficient *
			angularWeight;
	}

	return secondOrder;
}

void main() {
	int index = int(floor(gl_FragCoord.x));
	if (index < 0 || index >= valueCount) {
		outColor = vec4(0.0);
		return;
	}

	vec3 origin = origins[index];
	vec3 direction = normalize(directions[index]);
	float distanceMeters = distances[index];
	float wavelengthMicrometersValue = wavelengthMicrometers[index];
	float solarIrradiance = solarIrradiances[index];
	int channelIndex = channelIndices[index];
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float previousRayleigh = 0.0;
	float previousMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;
	float secondOrderSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);

		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousRayleigh + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousMie + density.y) * stepSize;
		}

		float viewTransmittance = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie,
			wavelengthMicrometersValue
		);
		float sunTransmittance =
			computeSunTransmittance(samplePosition, wavelengthMicrometersValue);
		float transmittance = viewTransmittance * sunTransmittance;
		float weight =
			sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		rayleighSum += transmittance * density.x * weight;
		mieSum += transmittance * density.y * weight;
		secondOrderSum +=
			computeSecondOrderAtSample(
				samplePosition,
				direction,
				density,
				viewTransmittance,
				wavelengthMicrometersValue,
				channelIndex
			) * weight;
		previousRayleigh = density.x;
		previousMie = density.y;
	}

	float nu = dot(direction, SUN_RAY);
	float rayleigh =
		rayleighSum *
		stepSize *
		solarIrradiance *
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
		rayleighPhaseFunction(nu);
	float mie =
		mieSum *
		stepSize *
		solarIrradiance *
		mieScatteringCoefficientAt(wavelengthMicrometersValue) *
		miePhaseFunction(MIE_PHASE_G, nu);
	float firstOrderPathRadiance = rayleigh + mie;
	float secondOrderPathRadiance = secondOrderSum * stepSize;
	float pathRadiance = firstOrderPathRadiance + secondOrderPathRadiance;
	float viewTransmittance = transmittanceAt(
		cumulativeRayleigh,
		cumulativeMie,
		wavelengthMicrometersValue
	);
	float finalRadiance =
		objectRadiances[index] * viewTransmittance + pathRadiance;

	outColor = vec4(
		firstOrderPathRadiance,
		secondOrderPathRadiance,
		pathRadiance,
		finalRadiance
	);
}
`);
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) || 'Spectral second-order radiance shader link failed.');
	}

	return program;
}

function createDirectRadianceSpectralShaderProgram(gl) {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 position;

void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;

const int MAX_VALUES = 128;
const int VIEW_SAMPLES = 20;
const int SUN_TRANSMITTANCE_SAMPLES = 10;
const float BOTTOM_RADIUS_METERS = 6360000.0;
const float TOP_RADIUS_METERS = 6420000.0;
const float RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0;
const float MIE_SCALE_HEIGHT_METERS = 1200.0;
const float RAYLEIGH_COEFFICIENT_SCALE = 1.24062e-6;
const float MIE_ANGSTROM_ALPHA = 0.8;
const float MIE_ANGSTROM_BETA = 0.04;
const float MIE_SINGLE_SCATTERING_ALBEDO = 0.8;
const float MIE_PHASE_G = 0.7;
const vec3 SUN_RAY = vec3(0.02927623871171526, 0.3571701122829255, 0.9335804264972017);

uniform int valueCount;
uniform vec3 origins[MAX_VALUES];
uniform vec3 directions[MAX_VALUES];
uniform float distances[MAX_VALUES];
uniform float objectRadiances[MAX_VALUES];
uniform float wavelengthMicrometers[MAX_VALUES];
uniform float solarIrradiances[MAX_VALUES];

out vec4 outColor;

float rayleighScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return RAYLEIGH_COEFFICIENT_SCALE * pow(wavelengthMicrometersValue, -4.0);
}

float mieExtinctionCoefficientAt(float wavelengthMicrometersValue) {
	return (MIE_ANGSTROM_BETA / MIE_SCALE_HEIGHT_METERS) *
		pow(wavelengthMicrometersValue, -MIE_ANGSTROM_ALPHA);
}

float mieScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
		MIE_SINGLE_SCATTERING_ALBEDO;
}

float opticalDepthAt(
	float rayleighOpticalLength,
	float mieOpticalLength,
	float wavelengthMicrometersValue
) {
	return
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
			rayleighOpticalLength +
		mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
			mieOpticalLength;
}

float transmittanceAt(
	float rayleighOpticalLength,
	float mieOpticalLength,
	float wavelengthMicrometersValue
) {
	return exp(-opticalDepthAt(
		rayleighOpticalLength,
		mieOpticalLength,
		wavelengthMicrometersValue
	));
}

float rayleighPhaseFunction(float nu) {
	return (3.0 / (16.0 * 3.141592653589793)) * (1.0 + nu * nu);
}

float miePhaseFunction(float g, float nu) {
	float k = (3.0 / (8.0 * 3.141592653589793)) *
		((1.0 - g * g) / (2.0 + g * g));

	return (k * (1.0 + nu * nu)) /
		pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

float distanceToTopAtmosphereBoundary(float radius, float mu) {
	float discriminant =
		radius * radius * (mu * mu - 1.0) +
		TOP_RADIUS_METERS * TOP_RADIUS_METERS;

	return max(0.0, -radius * mu + sqrt(max(0.0, discriminant)));
}

bool rayIntersectsGround(float radius, float mu) {
	return
		mu < 0.0 &&
		radius * radius * (mu * mu - 1.0) +
			BOTTOM_RADIUS_METERS * BOTTOM_RADIUS_METERS >=
			0.0;
}

vec2 densityAtPosition(vec3 position) {
	float altitudeMeters = length(position) - BOTTOM_RADIUS_METERS;
	float rayleighDensity =
		exp(-max(0.0, altitudeMeters) / RAYLEIGH_SCALE_HEIGHT_METERS);
	float mieDensity =
		exp(-max(0.0, altitudeMeters) / MIE_SCALE_HEIGHT_METERS);

	return vec2(rayleighDensity, mieDensity);
}

float computeSunTransmittance(vec3 position, float wavelengthMicrometersValue) {
	float radius = length(position);
	float mu = dot(position, SUN_RAY) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return 0.0;
	}

	float distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
	float stepSize = distanceToTop / float(SUN_TRANSMITTANCE_SAMPLES);
	float rayleighOpticalLength = 0.0;
	float mieOpticalLength = 0.0;

	for (int sampleIndex = 0; sampleIndex <= SUN_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = position + SUN_RAY * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);
		float weight =
			sampleIndex == 0 || sampleIndex == SUN_TRANSMITTANCE_SAMPLES
				? 0.5
				: 1.0;
		rayleighOpticalLength += density.x * weight * stepSize;
		mieOpticalLength += density.y * weight * stepSize;
	}

	return transmittanceAt(
		rayleighOpticalLength,
		mieOpticalLength,
		wavelengthMicrometersValue
	);
}

void main() {
	int index = int(floor(gl_FragCoord.x));
	if (index < 0 || index >= valueCount) {
		outColor = vec4(0.0);
		return;
	}

	vec3 origin = origins[index];
	vec3 direction = normalize(directions[index]);
	float distanceMeters = distances[index];
	float wavelengthMicrometersValue = wavelengthMicrometers[index];
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float previousRayleigh = 0.0;
	float previousMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);

		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousRayleigh + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousMie + density.y) * stepSize;
		}

		float viewTransmittance = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie,
			wavelengthMicrometersValue
		);
		float sunTransmittance =
			computeSunTransmittance(samplePosition, wavelengthMicrometersValue);
		float transmittance = viewTransmittance * sunTransmittance;
		float weight =
			sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		rayleighSum += transmittance * density.x * weight;
		mieSum += transmittance * density.y * weight;
		previousRayleigh = density.x;
		previousMie = density.y;
	}

	float nu = dot(direction, SUN_RAY);
	float rayleigh =
		rayleighSum *
		stepSize *
		solarIrradiances[index] *
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
		rayleighPhaseFunction(nu);
	float mie =
		mieSum *
		stepSize *
		solarIrradiances[index] *
		mieScatteringCoefficientAt(wavelengthMicrometersValue) *
		miePhaseFunction(MIE_PHASE_G, nu);
	float pathRadiance = rayleigh + mie;
	float viewTransmittance = transmittanceAt(
		cumulativeRayleigh,
		cumulativeMie,
		wavelengthMicrometersValue
	);
	float finalRadiance =
		objectRadiances[index] * viewTransmittance + pathRadiance;

	outColor = vec4(rayleigh, mie, pathRadiance, finalRadiance);
}
`);
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) || 'Spectral direct radiance shader link failed.');
	}

	return program;
}

function renderFirstOrderImageShader({
	renderer,
	camera,
	sceneMode = 'simple-cards',
	sunRay = sunDirection(DIRECT_RADIANCE_SUN_CASE),
	includeSecondOrder = false,
	sceneInputTextureData = null,
	sceneInputTextureHandle = null,
	sceneInputTextureMetadata = null,
	sceneColorTextureData = null,
	rayDirectionTextureData = null,
	composeSceneColor = false,
}) {
	const pass = setupFirstOrderImageShaderPass({
		renderer,
		camera,
		sceneMode,
		sunRay,
		includeSecondOrder,
		sceneInputTextureData,
		sceneInputTextureHandle,
		sceneInputTextureMetadata,
		sceneColorTextureData,
		rayDirectionTextureData,
		composeSceneColor,
	});
	pass.draw();

	return pass.diagnostics;
}

function setupFirstOrderImageShaderPass({
	renderer,
	camera,
	sceneMode = 'simple-cards',
	sunRay = sunDirection(DIRECT_RADIANCE_SUN_CASE),
	includeSecondOrder = false,
	sceneInputTextureData = null,
	sceneInputTextureHandle = null,
	sceneInputTextureMetadata = null,
	sceneColorTextureData = null,
	rayDirectionTextureData = null,
	composeSceneColor = false,
}) {
	const gl = renderer.getContext();
	const program = createFirstOrderImageShaderProgram(gl);
	const usesSceneInputTexture =
		Boolean(sceneInputTextureData) || Boolean(sceneInputTextureHandle);
	const sceneInputMetadata = sceneInputTextureData || sceneInputTextureMetadata;
	const incidentSkyCache = includeSecondOrder
		? buildSecondOrderIncidentSkyRadianceTextureData(sunRay)
		: null;
	const incidentTexture = includeSecondOrder ? gl.createTexture() : null;
	const sceneInputTexture = sceneInputTextureData ? gl.createTexture() : null;
	const sceneColorTexture = sceneColorTextureData ? gl.createTexture() : null;
	const rayDirectionTexture = rayDirectionTextureData ? gl.createTexture() : null;

	if (includeSecondOrder) {
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, incidentTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.R32F,
			incidentSkyCache.width,
			incidentSkyCache.height,
			0,
			gl.RED,
			gl.FLOAT,
			incidentSkyCache.data
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}
	if (sceneInputTextureData) {
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, sceneInputTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA32F,
			sceneInputTextureData.width,
			sceneInputTextureData.height,
			0,
			gl.RGBA,
			gl.FLOAT,
			sceneInputTextureData.data
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}
	if (sceneColorTextureData) {
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, sceneColorTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			sceneColorTextureData.width,
			sceneColorTextureData.height,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			sceneColorTextureData.data
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}
	if (rayDirectionTextureData) {
		gl.activeTexture(gl.TEXTURE3);
		gl.bindTexture(gl.TEXTURE_2D, rayDirectionTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA32F,
			rayDirectionTextureData.width,
			rayDirectionTextureData.height,
			0,
			gl.RGBA,
			gl.FLOAT,
			rayDirectionTextureData.data
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}

	renderer.resetState();
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.disable(gl.DEPTH_TEST);
	gl.disable(gl.CULL_FACE);
	gl.useProgram(program);
	if (includeSecondOrder) {
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, incidentTexture);
	}
	if (sceneInputTextureData) {
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, sceneInputTexture);
	} else if (sceneInputTextureHandle) {
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, sceneInputTextureHandle);
	}
	if (sceneColorTextureData) {
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, sceneColorTexture);
	}
	if (rayDirectionTextureData) {
		gl.activeTexture(gl.TEXTURE3);
		gl.bindTexture(gl.TEXTURE_2D, rayDirectionTexture);
	}
	gl.uniform2f(
		gl.getUniformLocation(program, 'resolution'),
		gl.canvas.width,
		gl.canvas.height
	);
	gl.uniformMatrix4fv(
		gl.getUniformLocation(program, 'projectionMatrixInverse'),
		false,
		camera.projectionMatrixInverse.elements
	);
	gl.uniformMatrix4fv(
		gl.getUniformLocation(program, 'cameraMatrixWorld'),
		false,
		camera.matrixWorld.elements
	);
	gl.uniform3fv(
		gl.getUniformLocation(program, 'sunRay'),
		new Float32Array(sunRay)
	);
	gl.uniform1i(
		gl.getUniformLocation(program, 'sceneMode'),
		sceneMode === 'mountain-ridges' ? 1 : 0
	);
	gl.uniform1i(
		gl.getUniformLocation(program, 'includeSecondOrder'),
		includeSecondOrder ? 1 : 0
	);
	gl.uniform1i(gl.getUniformLocation(program, 'incidentSkyRadiance'), 0);
	gl.uniform1i(
		gl.getUniformLocation(program, 'useSceneInputTexture'),
		usesSceneInputTexture ? 1 : 0
	);
	gl.uniform1i(gl.getUniformLocation(program, 'sceneInputTexture'), 1);
	gl.uniform1i(
		gl.getUniformLocation(program, 'useSceneColorTexture'),
		sceneColorTextureData ? 1 : 0
	);
	gl.uniform1i(
		gl.getUniformLocation(program, 'useRayDirectionTexture'),
		rayDirectionTextureData ? 1 : 0
	);
	gl.uniform1i(
		gl.getUniformLocation(program, 'composeSceneColor'),
		composeSceneColor ? 1 : 0
	);
	gl.uniform1i(gl.getUniformLocation(program, 'sceneColorTexture'), 2);
	gl.uniform1i(gl.getUniformLocation(program, 'rayDirectionTexture'), 3);
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW
	);
	const positionLocation = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

	return {
		gl,
		draw() {
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		},
		dispose() {
			gl.deleteBuffer(buffer);
			gl.deleteProgram(program);
			if (incidentTexture) {
				gl.deleteTexture(incidentTexture);
			}
			if (sceneInputTexture) {
				gl.deleteTexture(sceneInputTexture);
			}
			if (sceneColorTexture) {
				gl.deleteTexture(sceneColorTexture);
			}
			if (rayDirectionTexture) {
				gl.deleteTexture(rayDirectionTexture);
			}
		},
		diagnostics: {
			status: 'accepted',
			kind: includeSecondOrder
				? 'browser-second-order-image-shader-diagnostics'
				: 'browser-first-order-image-shader-diagnostics',
			webglVersion: gl.getParameter(gl.VERSION),
			shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
			width: gl.canvas.width,
			height: gl.canvas.height,
			sceneIntersectionPolicy: usesSceneInputTexture
				? sceneInputMetadata?.policy ||
					'per-pixel scene input texture from Three scene object distances and spectrum ids'
				: sceneMode === 'mountain-ridges'
					? 'analytic procedural mountain ridge silhouettes and valley floor'
					: 'analytic cards and ground for the simple browser scene',
			sunRay,
			scatteringPolicy: includeSecondOrder
				? '15-channel Algorithm32 spectral radiance with second-order approximation sampled from a precomputed incident-sky texture'
				: '15-channel first-order spectral radiance; no second-order approximation',
			sceneInputTexture: sceneInputMetadata
				? {
						width: sceneInputMetadata.width,
						height: sceneInputMetadata.height,
						policy: sceneInputMetadata.policy,
						channels: sceneInputMetadata.channels,
						counts: sceneInputMetadata.counts || null,
						hitDistanceMeters: sceneInputMetadata.hitDistanceMeters || null,
						source: sceneInputMetadata.source || null,
					}
				: null,
			sceneColorTexture: sceneColorTextureData
				? {
						width: sceneColorTextureData.width,
						height: sceneColorTextureData.height,
						format: 'RGBA/UNSIGNED_BYTE',
						rowOrder: sceneColorTextureData.rowOrder,
					}
				: null,
			rayDirectionTexture: rayDirectionTextureData
				? {
						width: rayDirectionTextureData.width,
						height: rayDirectionTextureData.height,
						format: 'RGBA32F',
						rowOrder: rayDirectionTextureData.rowOrder,
					}
				: null,
			composeSceneColor,
			secondOrderIncidentSkyCache: incidentSkyCache
				? {
						width: incidentSkyCache.width,
						height: incidentSkyCache.height,
						incomingDirections: ATMOSPHERE.secondOrderIncomingDirections,
						incidentAltitudeBins:
							ATMOSPHERE.secondOrderIncidentAltitudeBins,
						minRadiance: incidentSkyCache.minRadiance,
						maxRadiance: incidentSkyCache.maxRadiance,
					}
				: null,
		},
	};
}

function createFirstOrderImageShaderProgram(gl) {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
in vec2 position;

void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
precision highp sampler2D;

const int CHANNEL_COUNT = 15;
const float BOTTOM_RADIUS_METERS = 6360000.0;
const float TOP_RADIUS_METERS = 6420000.0;
const float RAYLEIGH_SCALE_HEIGHT_METERS = 8000.0;
const float MIE_SCALE_HEIGHT_METERS = 1200.0;
const float RAYLEIGH_COEFFICIENT_SCALE = 1.24062e-6;
const float MIE_ANGSTROM_ALPHA = 0.8;
const float MIE_ANGSTROM_BETA = 0.04;
const float MIE_SINGLE_SCATTERING_ALBEDO = 0.8;
const float MIE_PHASE_G = 0.7;
const int VIEW_SAMPLES = 20;
const int SUN_TRANSMITTANCE_SAMPLES = 10;
const int SECOND_ORDER_INCOMING_DIRECTIONS = 17;
const int SECOND_ORDER_HALF_COUNT = 8;
const int SECOND_ORDER_INCIDENT_ALTITUDE_BINS = 24;
const float PI = 3.141592653589793;
const float GOLDEN_RATIO = 1.618033988749895;
const float SPECTRAL_DELTA_NM = 31.333333333333332;
const float MAX_LUMINOUS_EFFICACY = 683.0;
const float DISPLAY_TONE_MAP_K = 0.00029282576866764276;
const float WAVELENGTHS_NM[CHANNEL_COUNT] = float[CHANNEL_COUNT](
	375.666666666667,
	407.0,
	438.333333333333,
	469.666666666667,
	501.0,
	532.333333333333,
	563.666666666667,
	595.0,
	626.333333333333,
	657.666666666667,
	689.0,
	720.333333333333,
	751.666666666667,
	783.0,
	814.333333333333
);
const float SOLAR_IRRADIANCE[CHANNEL_COUNT] = float[CHANNEL_COUNT](
	1.068866666667,
	1.729673,
	1.862071666667,
	2.022063333333,
	1.908154,
	1.883391,
	1.834246666667,
	1.76744,
	1.65952,
	1.548102333333,
	1.45078,
	1.340960333333,
	1.262433333333,
	1.175208,
	1.090824
);
const vec3 CIE[CHANNEL_COUNT] = vec3[CHANNEL_COUNT](
	vec3(0.00082512, 0.000024284, 0.00388120013333),
	vec3(0.031318, 0.000868, 0.14908),
	vec3(0.341686666667, 0.0209466666667, 1.70569333333),
	vec3(0.199076, 0.0898413333333, 1.30367066667),
	vec3(0.0044, 0.33986, 0.26006),
	vec3(0.19361662, 0.88666338, 0.0364106666667),
	vec3(0.656026666667, 0.982973333333, 0.00305666593333),
	vec3(1.0567, 0.6949, 0.001),
	vec3(0.722333333333, 0.306066666667, 0.000086666664),
	vec3(0.190006666667, 0.0706133333333, 0.0),
	vec3(0.02474, 0.008952, 0.0),
	vec3(0.0028426512, 0.00102653333333, 0.0),
	vec3(0.000299809433333, 0.000108266666667, 0.0),
	vec3(0.000034215932, 0.000012356, 0.0),
	vec3(0.00000378221413333, 0.00000136582666667, 0.0)
);

uniform vec2 resolution;
uniform mat4 projectionMatrixInverse;
uniform mat4 cameraMatrixWorld;
uniform vec3 sunRay;
uniform int sceneMode;
uniform bool includeSecondOrder;
uniform bool useSceneInputTexture;
uniform bool useSceneColorTexture;
uniform bool useRayDirectionTexture;
uniform bool composeSceneColor;
uniform sampler2D incidentSkyRadiance;
uniform sampler2D sceneInputTexture;
uniform sampler2D sceneColorTexture;
uniform sampler2D rayDirectionTexture;

out vec4 outColor;

float rayleighScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return RAYLEIGH_COEFFICIENT_SCALE * pow(wavelengthMicrometersValue, -4.0);
}

float mieExtinctionCoefficientAt(float wavelengthMicrometersValue) {
	return (MIE_ANGSTROM_BETA / MIE_SCALE_HEIGHT_METERS) *
		pow(wavelengthMicrometersValue, -MIE_ANGSTROM_ALPHA);
}

float mieScatteringCoefficientAt(float wavelengthMicrometersValue) {
	return mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
		MIE_SINGLE_SCATTERING_ALBEDO;
}

float opticalDepthAt(
	float rayleighOpticalLength,
	float mieOpticalLength,
	float wavelengthMicrometersValue
) {
	return
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
			rayleighOpticalLength +
		mieExtinctionCoefficientAt(wavelengthMicrometersValue) *
			mieOpticalLength;
}

float transmittanceAt(
	float rayleighOpticalLength,
	float mieOpticalLength,
	float wavelengthMicrometersValue
) {
	return exp(-opticalDepthAt(
		rayleighOpticalLength,
		mieOpticalLength,
		wavelengthMicrometersValue
	));
}

float rayleighPhaseFunction(float nu) {
	return (3.0 / (16.0 * 3.141592653589793)) * (1.0 + nu * nu);
}

float miePhaseFunction(float g, float nu) {
	float k = (3.0 / (8.0 * 3.141592653589793)) *
		((1.0 - g * g) / (2.0 + g * g));

	return (k * (1.0 + nu * nu)) /
		pow(1.0 + g * g - 2.0 * g * nu, 1.5);
}

float distanceToTopAtmosphereBoundary(float radius, float mu) {
	float discriminant =
		radius * radius * (mu * mu - 1.0) +
		TOP_RADIUS_METERS * TOP_RADIUS_METERS;

	return max(0.0, -radius * mu + sqrt(max(0.0, discriminant)));
}

bool rayIntersectsGround(float radius, float mu) {
	return
		mu < 0.0 &&
		radius * radius * (mu * mu - 1.0) +
			BOTTOM_RADIUS_METERS * BOTTOM_RADIUS_METERS >=
			0.0;
}

vec2 densityAtPosition(vec3 position) {
	float altitudeMeters = length(position) - BOTTOM_RADIUS_METERS;
	float rayleighDensity =
		exp(-max(0.0, altitudeMeters) / RAYLEIGH_SCALE_HEIGHT_METERS);
	float mieDensity =
		exp(-max(0.0, altitudeMeters) / MIE_SCALE_HEIGHT_METERS);

	return vec2(rayleighDensity, mieDensity);
}

float computeSunTransmittance(vec3 position, float wavelengthMicrometersValue) {
	float radius = length(position);
	float mu = dot(position, sunRay) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return 0.0;
	}

	float distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
	float stepSize = distanceToTop / float(SUN_TRANSMITTANCE_SAMPLES);
	float rayleighOpticalLength = 0.0;
	float mieOpticalLength = 0.0;

	for (int sampleIndex = 0; sampleIndex <= SUN_TRANSMITTANCE_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = position + sunRay * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);
		float weight =
			sampleIndex == 0 || sampleIndex == SUN_TRANSMITTANCE_SAMPLES
				? 0.5
				: 1.0;
		rayleighOpticalLength += density.x * weight * stepSize;
		mieOpticalLength += density.y * weight * stepSize;
	}

	return transmittanceAt(
		rayleighOpticalLength,
		mieOpticalLength,
		wavelengthMicrometersValue
	);
}

vec3 incomingDirectionAt(int directionIndex) {
	int fibonacciIndex = directionIndex - SECOND_ORDER_HALF_COUNT;
	float z = (2.0 * float(fibonacciIndex)) /
		float(SECOND_ORDER_INCOMING_DIRECTIONS);
	float latitude = asin(clamp(z, -1.0, 1.0));
	float longitude = (2.0 * PI * float(fibonacciIndex)) / GOLDEN_RATIO;
	float horizontalScale = cos(latitude);
	float localX = horizontalScale * cos(longitude);
	float localY = horizontalScale * sin(longitude);
	float localZ = z;
	vec3 sunAxis = normalize(sunRay);
	vec3 reference =
		abs(dot(sunAxis, vec3(0.0, 0.0, 1.0))) < 0.95
			? vec3(0.0, 0.0, 1.0)
			: vec3(0.0, 1.0, 0.0);
	vec3 zAxis = normalize(reference - sunAxis * dot(reference, sunAxis));
	vec3 yAxis = normalize(cross(zAxis, sunAxis));

	return normalize(sunAxis * localX + yAxis * localY + zAxis * localZ);
}

float incidentSkyRadianceForSecondOrder(
	vec3 position,
	int directionIndex,
	int channelIndex
) {
	float atmosphereHeight = TOP_RADIUS_METERS - BOTTOM_RADIUS_METERS;
	float altitude = clamp(
		length(position) - BOTTOM_RADIUS_METERS,
		0.0,
		atmosphereHeight
	);
	float binSize =
		atmosphereHeight / float(SECOND_ORDER_INCIDENT_ALTITUDE_BINS);
	int binIndex = int(clamp(
		floor(altitude / binSize),
		0.0,
		float(SECOND_ORDER_INCIDENT_ALTITUDE_BINS - 1)
	));
	int row = binIndex * SECOND_ORDER_INCOMING_DIRECTIONS + directionIndex;

	return texelFetch(incidentSkyRadiance, ivec2(channelIndex, row), 0).r;
}

float computeSecondOrderAtSample(
	vec3 position,
	vec3 viewRay,
	vec2 density,
	float viewTransmittance,
	float wavelengthMicrometersValue,
	int channelIndex
) {
	float secondOrder = 0.0;
	float angularWeight =
		(4.0 * PI) / float(SECOND_ORDER_INCOMING_DIRECTIONS);

	for (int directionIndex = 0; directionIndex < SECOND_ORDER_INCOMING_DIRECTIONS; directionIndex++) {
		vec3 incomingDirection = incomingDirectionAt(directionIndex);
		float incidentRadiance = incidentSkyRadianceForSecondOrder(
			position,
			directionIndex,
			channelIndex
		);
		float nu = dot(viewRay, incomingDirection);
		float scatteringCoefficient =
			density.x *
				rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
				rayleighPhaseFunction(nu) +
			density.y *
				mieScatteringCoefficientAt(wavelengthMicrometersValue) *
				miePhaseFunction(MIE_PHASE_G, nu);

		secondOrder +=
			viewTransmittance *
			incidentRadiance *
			scatteringCoefficient *
			angularWeight;
	}

	return secondOrder;
}

vec2 firstOrderPathAndViewT(
	vec3 origin,
	vec3 direction,
	float distanceMeters,
	float wavelengthMicrometersValue,
	float solarIrradiance
) {
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float previousRayleigh = 0.0;
	float previousMie = 0.0;
	float rayleighSum = 0.0;
	float mieSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);

		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousRayleigh + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousMie + density.y) * stepSize;
		}

		float viewTransmittance = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie,
			wavelengthMicrometersValue
		);
		float sunTransmittance =
			computeSunTransmittance(samplePosition, wavelengthMicrometersValue);
		float transmittance = viewTransmittance * sunTransmittance;
		float weight =
			sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		rayleighSum += transmittance * density.x * weight;
		mieSum += transmittance * density.y * weight;
		previousRayleigh = density.x;
		previousMie = density.y;
	}

	float nu = dot(direction, sunRay);
	float rayleigh =
		rayleighSum *
		stepSize *
		solarIrradiance *
		rayleighScatteringCoefficientAt(wavelengthMicrometersValue) *
		rayleighPhaseFunction(nu);
	float mie =
		mieSum *
		stepSize *
		solarIrradiance *
		mieScatteringCoefficientAt(wavelengthMicrometersValue) *
		miePhaseFunction(MIE_PHASE_G, nu);
	float viewTransmittance = transmittanceAt(
		cumulativeRayleigh,
		cumulativeMie,
		wavelengthMicrometersValue
	);

	return vec2(rayleigh + mie, viewTransmittance);
}

float secondOrderPathRadiance(
	vec3 origin,
	vec3 direction,
	float distanceMeters,
	float wavelengthMicrometersValue,
	int channelIndex
) {
	float stepSize = distanceMeters / float(VIEW_SAMPLES);
	float cumulativeRayleigh = 0.0;
	float cumulativeMie = 0.0;
	float previousRayleigh = 0.0;
	float previousMie = 0.0;
	float secondOrderSum = 0.0;

	for (int sampleIndex = 0; sampleIndex <= VIEW_SAMPLES; sampleIndex++) {
		float sampleDistance = float(sampleIndex) * stepSize;
		vec3 samplePosition = origin + direction * sampleDistance;
		vec2 density = densityAtPosition(samplePosition);

		if (sampleIndex > 0) {
			cumulativeRayleigh +=
				0.5 * (previousRayleigh + density.x) * stepSize;
			cumulativeMie +=
				0.5 * (previousMie + density.y) * stepSize;
		}

		float viewTransmittance = transmittanceAt(
			cumulativeRayleigh,
			cumulativeMie,
			wavelengthMicrometersValue
		);
		float weight =
			sampleIndex == 0 || sampleIndex == VIEW_SAMPLES ? 0.5 : 1.0;
		secondOrderSum +=
			computeSecondOrderAtSample(
				samplePosition,
				direction,
				density,
				viewTransmittance,
				wavelengthMicrometersValue,
				channelIndex
			) * weight;
		previousRayleigh = density.x;
		previousMie = density.y;
	}

	return secondOrderSum * stepSize;
}

float triangularSpectrumWeight(float lambdaNm, float centerNm, float halfWidthNm) {
	return max(0.0, 1.0 - abs(lambdaNm - centerNm) / halfWidthNm);
}

float objectRadianceAt(int spectrumId, float wavelengthNm) {
	if (spectrumId == 1) {
		return wavelengthNm >= 626.333333333333 ? 0.045 : 0.003;
	}
	if (spectrumId == 2) {
		return
			0.002 +
			0.05 * triangularSpectrumWeight(wavelengthNm, 532.333333333333, 65.0) +
			0.012 * triangularSpectrumWeight(wavelengthNm, 563.666666666667, 60.0);
	}
	if (spectrumId == 3) {
		return wavelengthNm <= 501.0 ? 0.045 : 0.003;
	}
	if (spectrumId == 4) {
		return 0.012;
	}
	if (spectrumId == 5) {
		return
			0.0012 +
			0.012 * triangularSpectrumWeight(wavelengthNm, 469.666666666667, 130.0) +
			0.018 * triangularSpectrumWeight(wavelengthNm, 532.333333333333, 85.0) +
			0.016 * triangularSpectrumWeight(wavelengthNm, 563.666666666667, 95.0) +
			0.003 * triangularSpectrumWeight(wavelengthNm, 626.333333333333, 130.0);
	}

	return 0.0;
}

bool intersectCard(
	vec3 origin,
	vec3 direction,
	vec3 center,
	float width,
	float height,
	inout float hitDistance,
	inout int spectrumId
) {
	float t = (center.z - origin.z) / direction.z;
	vec3 hit = origin + direction * t;
	bool inside =
		t > 0.0 &&
		abs(hit.x - center.x) <= width * 0.5 &&
		abs(hit.y - center.y) <= height * 0.5;

	if (inside && t < hitDistance) {
		hitDistance = t;
		return true;
	}

	return false;
}

float ridgeHeightAt(
	float t,
	float baseHeightMeters,
	float amplitudeMeters,
	float secondaryAmplitudeMeters,
	float frequency,
	float phase,
	float peakT,
	float peakHeightMeters,
	float peakWidth
) {
	float broadPeak =
		peakHeightMeters * exp(-pow((t - peakT) / peakWidth, 2.0));
	float primary =
		amplitudeMeters *
		(0.5 + 0.5 * sin(6.283185307179586 * frequency * t + phase));
	float secondary =
		secondaryAmplitudeMeters *
		(0.5 +
			0.5 *
				sin(
					6.283185307179586 * (frequency * 1.73) * t +
						phase * 0.61
				));

	return baseHeightMeters + primary + secondary + broadPeak;
}

bool intersectRidge(
	vec3 origin,
	vec3 direction,
	float zMeters,
	float bottomMeters,
	float baseHeightMeters,
	float amplitudeMeters,
	float secondaryAmplitudeMeters,
	float frequency,
	float phase,
	float peakT,
	float peakHeightMeters,
	float peakWidth,
	inout float hitDistance
) {
	float xMinMeters = -100000.0;
	float xMaxMeters = 100000.0;
	float t = (zMeters - origin.z) / direction.z;
	vec3 hit = origin + direction * t;
	float ridgeT = (hit.x - xMinMeters) / (xMaxMeters - xMinMeters);
	float heightMeters = ridgeHeightAt(
		ridgeT,
		baseHeightMeters,
		amplitudeMeters,
		secondaryAmplitudeMeters,
		frequency,
		phase,
		peakT,
		peakHeightMeters,
		peakWidth
	);
	bool inside =
		t > 0.0 &&
		ridgeT >= 0.0 &&
		ridgeT <= 1.0 &&
		hit.y >= bottomMeters &&
		hit.y <= heightMeters;

	if (inside && t < hitDistance) {
		hitDistance = t;
		return true;
	}

	return false;
}

void intersectMountainScene(
	vec3 origin,
	vec3 direction,
	out float distanceMeters,
	out int spectrumId
) {
	float hitDistance = 1.0e20;
	int hitSpectrum = 0;

	if (abs(direction.z) > 0.000001) {
		if (intersectRidge(origin, direction, -5600.0, -6000.0, 70.0, 150.0, 70.0, 1.85, 0.35, 0.44, 120.0, 0.18, hitDistance)) {
			hitSpectrum = 5;
		}
		if (intersectRidge(origin, direction, -9800.0, -6000.0, 280.0, 260.0, 110.0, 2.15, 1.6, 0.58, 190.0, 0.2, hitDistance)) {
			hitSpectrum = 5;
		}
		if (intersectRidge(origin, direction, -15500.0, -7000.0, 620.0, 370.0, 160.0, 2.9, 2.25, 0.34, 260.0, 0.18, hitDistance)) {
			hitSpectrum = 5;
		}
		if (intersectRidge(origin, direction, -26000.0, -7600.0, 1060.0, 480.0, 180.0, 2.35, 0.85, 0.54, 340.0, 0.24, hitDistance)) {
			hitSpectrum = 5;
		}
		if (intersectRidge(origin, direction, -43000.0, -8000.0, 1850.0, 610.0, 210.0, 2.75, 2.85, 0.68, 440.0, 0.2, hitDistance)) {
			hitSpectrum = 5;
		}
		if (intersectRidge(origin, direction, -72000.0, -8500.0, 3200.0, 620.0, 210.0, 3.15, 1.2, 0.48, 520.0, 0.28, hitDistance)) {
			hitSpectrum = 5;
		}
	}

	if (direction.y < -0.000001) {
		float t = -origin.y / direction.y;
		vec3 hit = origin + direction * t;
		bool inside =
			t > 0.0 &&
			abs(hit.x) <= 70000.0 &&
			hit.z >= -116000.0 &&
			hit.z <= 44000.0;

		if (inside && t < hitDistance) {
			hitDistance = t;
			hitSpectrum = 5;
		}
	}

	if (hitSpectrum == 0) {
		vec3 algorithmOrigin = vec3(origin.x, -origin.z, BOTTOM_RADIUS_METERS + origin.y);
		vec3 algorithmDirection = normalize(vec3(direction.x, -direction.z, direction.y));
		float radius = length(algorithmOrigin);
		float mu = dot(algorithmOrigin, algorithmDirection) / radius;
		distanceMeters = distanceToTopAtmosphereBoundary(radius, mu);
		spectrumId = 0;
	} else {
		distanceMeters = hitDistance;
		spectrumId = hitSpectrum;
	}
}

void intersectScene(vec3 origin, vec3 direction, out float distanceMeters, out int spectrumId) {
	if (sceneMode == 1) {
		intersectMountainScene(origin, direction, distanceMeters, spectrumId);
		return;
	}

	float hitDistance = 1.0e20;
	int hitSpectrum = 0;
	int candidateSpectrum = 1;

	if (intersectCard(origin, direction, vec3(-260.0, 130.0, -1000.0), 260.0, 260.0, hitDistance, candidateSpectrum)) {
		hitSpectrum = 1;
	}
	candidateSpectrum = 2;
	if (intersectCard(origin, direction, vec3(0.0, 440.0, -5000.0), 900.0, 900.0, hitDistance, candidateSpectrum)) {
		hitSpectrum = 2;
	}
	candidateSpectrum = 3;
	if (intersectCard(origin, direction, vec3(5200.0, 1800.0, -22000.0), 3600.0, 3600.0, hitDistance, candidateSpectrum)) {
		hitSpectrum = 3;
	}

	if (direction.y < -0.000001) {
		float t = -origin.y / direction.y;
		vec3 hit = origin + direction * t;
		bool inside =
			t > 0.0 &&
			abs(hit.x) <= 60000.0 &&
			hit.z >= -90000.0 &&
			hit.z <= 30000.0;

		if (inside && t < hitDistance) {
			hitDistance = t;
			hitSpectrum = 4;
		}
	}

	if (hitSpectrum == 0) {
		vec3 algorithmOrigin = vec3(origin.x, -origin.z, BOTTOM_RADIUS_METERS + origin.y);
		vec3 algorithmDirection = normalize(vec3(direction.x, -direction.z, direction.y));
		float radius = length(algorithmOrigin);
		float mu = dot(algorithmOrigin, algorithmDirection) / radius;
		distanceMeters = distanceToTopAtmosphereBoundary(radius, mu);
		spectrumId = 0;
	} else {
		distanceMeters = hitDistance;
		spectrumId = hitSpectrum;
	}
}

void main() {
	ivec2 pixelCoord = ivec2(int(gl_FragCoord.x), int(gl_FragCoord.y));
	vec2 ndc = vec2(
		(gl_FragCoord.x / resolution.x) * 2.0 - 1.0,
		(gl_FragCoord.y / resolution.y) * 2.0 - 1.0
	);
	vec4 viewPosition = projectionMatrixInverse * vec4(ndc, 0.5, 1.0);
	viewPosition /= viewPosition.w;
	vec3 rayOrigin = cameraMatrixWorld[3].xyz;
	vec3 rayDirection = normalize((cameraMatrixWorld * vec4(viewPosition.xyz, 0.0)).xyz);
	if (useRayDirectionTexture) {
		vec4 rayInput = texelFetch(rayDirectionTexture, pixelCoord, 0);
		rayDirection = normalize(rayInput.xyz);
	}
	vec3 algorithmOrigin = vec3(
		rayOrigin.x,
		-rayOrigin.z,
		BOTTOM_RADIUS_METERS + rayOrigin.y
	);
	vec3 algorithmDirection = normalize(vec3(
		rayDirection.x,
		-rayDirection.z,
		rayDirection.y
	));
	float distanceMeters;
	int spectrumId;

	if (useSceneInputTexture) {
		vec4 sceneInput = texelFetch(
			sceneInputTexture,
			pixelCoord,
			0
		);

		if (sceneInput.z > 0.5) {
			distanceMeters = sceneInput.x;
			spectrumId = int(floor(sceneInput.y + 0.5));
		} else {
			float radius = length(algorithmOrigin);
			float mu = dot(algorithmOrigin, algorithmDirection) / radius;
			distanceMeters = distanceToTopAtmosphereBoundary(radius, mu);
			spectrumId = 0;
		}
	} else {
		intersectScene(rayOrigin, rayDirection, distanceMeters, spectrumId);
	}

	vec3 xyz = vec3(0.0);
	float blueTransmittanceSum = 0.0;
	float greenTransmittanceSum = 0.0;
	float redTransmittanceSum = 0.0;

	for (int channelIndex = 0; channelIndex < CHANNEL_COUNT; channelIndex++) {
		float wavelengthNm = WAVELENGTHS_NM[channelIndex];
		float wavelengthMicrometers = wavelengthNm * 0.001;
		vec2 pathAndT = firstOrderPathAndViewT(
			algorithmOrigin,
			algorithmDirection,
			distanceMeters,
			wavelengthMicrometers,
			SOLAR_IRRADIANCE[channelIndex]
		);
		float secondOrderPath = includeSecondOrder
			? secondOrderPathRadiance(
					algorithmOrigin,
					algorithmDirection,
					distanceMeters,
					wavelengthMicrometers,
					channelIndex
				)
			: 0.0;
		float pathRadiance = pathAndT.x + secondOrderPath;
		float objectRadiance = composeSceneColor
			? 0.0
			: objectRadianceAt(spectrumId, wavelengthNm) * pathAndT.y;
		float finalRadiance = objectRadiance + pathRadiance;
		xyz += CIE[channelIndex] * finalRadiance * SPECTRAL_DELTA_NM;
		if (channelIndex < 5) {
			blueTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 4 && channelIndex < 9) {
			greenTransmittanceSum += pathAndT.y;
		}
		if (channelIndex >= 8) {
			redTransmittanceSum += pathAndT.y;
		}
	}

	vec3 linearSrgb = MAX_LUMINOUS_EFFICACY * vec3(
		3.2406 * xyz.x + -1.5372 * xyz.y + -0.4986 * xyz.z,
		-0.9689 * xyz.x + 1.8758 * xyz.y + 0.0415 * xyz.z,
		0.0557 * xyz.x + -0.204 * xyz.y + 1.057 * xyz.z
	);
	vec3 displayRgb = clamp(
		vec3(1.0) - exp(-DISPLAY_TONE_MAP_K * max(vec3(0.0), linearSrgb)),
		vec3(0.0),
		vec3(1.0)
	);
	if (composeSceneColor && spectrumId != 0 && useSceneColorTexture) {
		vec3 sceneRgb = texelFetch(sceneColorTexture, pixelCoord, 0).rgb;
		vec3 transmittanceRgb = vec3(
			redTransmittanceSum / 7.0,
			greenTransmittanceSum / 5.0,
			blueTransmittanceSum / 5.0
		);
		displayRgb = clamp(sceneRgb * transmittanceRgb + displayRgb, vec3(0.0), vec3(1.0));
	}
	outColor = vec4(displayRgb, 1.0);
}
`);
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) || 'First-order image shader link failed.');
	}

	return program;
}

function compileShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(gl.getShaderInfoLog(shader) || 'Atmosphere shader compile failed.');
	}

	return shader;
}

function uploadAtmosphereShaderUniforms(gl, program, components) {
	const origins = [];
	const directions = [];
	const distances = [];

	for (let index = 0; index < 8; index += 1) {
		const component = components[index] || components[0];
		origins.push(...component.algorithm32Ray.origin);
		directions.push(...component.algorithm32Ray.direction);
		distances.push(component.pathDistanceMeters);
	}

	gl.uniform1i(gl.getUniformLocation(program, 'componentCount'), components.length);
	gl.uniform3fv(gl.getUniformLocation(program, 'origins'), new Float32Array(origins));
	gl.uniform3fv(gl.getUniformLocation(program, 'directions'), new Float32Array(directions));
	gl.uniform1fv(gl.getUniformLocation(program, 'distances'), new Float32Array(distances));
}

function uploadDirectRadianceShaderUniforms(gl, program, diagnostics) {
	const origins = [];
	const directions = [];
	const distances = [];
	const objectRadiances = [];

	for (let index = 0; index < 8; index += 1) {
		const diagnostic = diagnostics[index] || diagnostics[0];
		origins.push(...diagnostic.algorithm32Ray.origin);
		directions.push(...diagnostic.algorithm32Ray.direction);
		distances.push(diagnostic.pathDistanceMeters);
		objectRadiances.push(diagnostic.objectRadiance);
	}

	gl.uniform1i(gl.getUniformLocation(program, 'componentCount'), diagnostics.length);
	gl.uniform3fv(gl.getUniformLocation(program, 'origins'), new Float32Array(origins));
	gl.uniform3fv(gl.getUniformLocation(program, 'directions'), new Float32Array(directions));
	gl.uniform1fv(gl.getUniformLocation(program, 'distances'), new Float32Array(distances));
	gl.uniform1fv(
		gl.getUniformLocation(program, 'objectRadiances'),
		new Float32Array(objectRadiances)
	);
}

function uploadDirectRadianceSpectralShaderUniforms(gl, program, flattened) {
	const origins = [];
	const directions = [];
	const distances = [];
	const objectRadiances = [];
	const wavelengthMicrometers = [];
	const solarIrradiances = [];

	for (let index = 0; index < 128; index += 1) {
		const item = flattened[index] || flattened[0];
		origins.push(...item.algorithm32Ray.origin);
		directions.push(...item.algorithm32Ray.direction);
		distances.push(item.pathDistanceMeters);
		objectRadiances.push(item.objectRadiance);
		wavelengthMicrometers.push(item.wavelengthNanometers * 1e-3);
		solarIrradiances.push(item.solarIrradiance);
	}

	gl.uniform1i(gl.getUniformLocation(program, 'valueCount'), flattened.length);
	gl.uniform3fv(gl.getUniformLocation(program, 'origins'), new Float32Array(origins));
	gl.uniform3fv(gl.getUniformLocation(program, 'directions'), new Float32Array(directions));
	gl.uniform1fv(gl.getUniformLocation(program, 'distances'), new Float32Array(distances));
	gl.uniform1fv(
		gl.getUniformLocation(program, 'objectRadiances'),
		new Float32Array(objectRadiances)
	);
	gl.uniform1fv(
		gl.getUniformLocation(program, 'wavelengthMicrometers'),
		new Float32Array(wavelengthMicrometers)
	);
	gl.uniform1fv(
		gl.getUniformLocation(program, 'solarIrradiances'),
		new Float32Array(solarIrradiances)
	);
}

function uploadSecondOrderRadianceSpectralShaderUniforms(gl, program, flattened) {
	const origins = [];
	const directions = [];
	const distances = [];
	const objectRadiances = [];
	const wavelengthMicrometers = [];
	const solarIrradiances = [];
	const channelIndices = [];

	for (let index = 0; index < 128; index += 1) {
		const item = flattened[index] || flattened[0];
		origins.push(...item.algorithm32Ray.origin);
		directions.push(...item.algorithm32Ray.direction);
		distances.push(item.pathDistanceMeters);
		objectRadiances.push(item.objectRadiance);
		wavelengthMicrometers.push(item.wavelengthNanometers * 1e-3);
		solarIrradiances.push(item.solarIrradiance);
		channelIndices.push(item.channelIndex);
	}

	gl.uniform1i(gl.getUniformLocation(program, 'valueCount'), flattened.length);
	gl.uniform3fv(gl.getUniformLocation(program, 'origins'), new Float32Array(origins));
	gl.uniform3fv(gl.getUniformLocation(program, 'directions'), new Float32Array(directions));
	gl.uniform1fv(gl.getUniformLocation(program, 'distances'), new Float32Array(distances));
	gl.uniform1fv(
		gl.getUniformLocation(program, 'objectRadiances'),
		new Float32Array(objectRadiances)
	);
	gl.uniform1fv(
		gl.getUniformLocation(program, 'wavelengthMicrometers'),
		new Float32Array(wavelengthMicrometers)
	);
	gl.uniform1fv(
		gl.getUniformLocation(program, 'solarIrradiances'),
		new Float32Array(solarIrradiances)
	);
	gl.uniform1iv(
		gl.getUniformLocation(program, 'channelIndices'),
		new Int32Array(channelIndices)
	);
}

function buildSecondOrderIncidentSkyRadianceTextureData(sunRay) {
	const width = SPECTRAL_CHANNELS.length;
	const height =
		ATMOSPHERE.secondOrderIncomingDirections *
		ATMOSPHERE.secondOrderIncidentAltitudeBins;
	const data = new Float32Array(width * height);
	const incomingDirections = fibonacciSphereIncomingDirections(
		sunRay,
		ATMOSPHERE.secondOrderIncomingDirections
	);
	const atmosphereHeight =
		ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters;
	const binSize = atmosphereHeight / ATMOSPHERE.secondOrderIncidentAltitudeBins;
	let minRadiance = Number.POSITIVE_INFINITY;
	let maxRadiance = Number.NEGATIVE_INFINITY;

	for (let binIndex = 0; binIndex < ATMOSPHERE.secondOrderIncidentAltitudeBins; binIndex += 1) {
		const binAltitude = (binIndex + 0.5) * binSize;
		const binOrigin = [
			0,
			0,
			ATMOSPHERE.bottomRadiusMeters + binAltitude,
		];
		const radius = length(binOrigin);

		for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
			const incomingDirection = incomingDirections[directionIndex];
			const mu = dot(binOrigin, incomingDirection) / radius;
			const row =
				binIndex * ATMOSPHERE.secondOrderIncomingDirections +
				directionIndex;

			for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
				const channel = SPECTRAL_CHANNELS[channelIndex];
				let radiance = 0;

				if (!rayIntersectsGround(radius, mu)) {
					const incident = computeFirstOrderRadianceAtWavelength({
						origin: binOrigin,
						direction: incomingDirection,
						distance: distanceToTopAtmosphereBoundaryForRadiusMu(radius, mu),
						wavelengthNanometers: channel.wavelengthNanometers,
						wavelengthMicrometers: channel.wavelengthNanometers * 1e-3,
						solarIrradiance: channel.solarIrradiance,
						sunRay,
					});

					radiance = incident.firstOrderPathRadiance;
				}

				data[row * width + channelIndex] = radiance;
				minRadiance = Math.min(minRadiance, radiance);
				maxRadiance = Math.max(maxRadiance, radiance);
			}
		}
	}

	return {
		width,
		height,
		data,
		minRadiance,
		maxRadiance,
	};
}

function summarizeAtmosphereComponents(components) {
	return {
		count: components.length,
		minPathDistanceMeters: Math.min(...components.map((component) => component.pathDistanceMeters)),
		maxPathDistanceMeters: Math.max(...components.map((component) => component.pathDistanceMeters)),
		minTransmittance: Math.min(...components.map((component) => component.minTransmittance)),
		maxTransmittance: Math.max(...components.map((component) => component.maxTransmittance)),
		bySample: components.map((component) => ({
			id: component.id,
			pathKind: component.pathKind,
			pathDistanceMeters: component.pathDistanceMeters,
			altitudeRangeMeters: component.opticalLengths.altitudeRangeMeters,
			meanTransmittance: component.meanTransmittance,
		})),
	};
}

function computeOpticalLengthsAlongDistance({ origin, direction, distance, sampleCount }) {
	const step = distance / sampleCount;
	let rayleighOpticalLength = 0;
	let mieOpticalLength = 0;
	let absorptionOpticalLength = 0;
	let minAltitudeMeters = Number.POSITIVE_INFINITY;
	let maxAltitudeMeters = Number.NEGATIVE_INFINITY;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const samplePosition = addScaled(origin, direction, sampleDistance);
		const density = densityAtPosition(samplePosition);
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;

		rayleighOpticalLength += density.rayleigh * weight * step;
		mieOpticalLength += density.mie * weight * step;
		absorptionOpticalLength += density.absorption * weight * step;
		minAltitudeMeters = Math.min(minAltitudeMeters, density.altitudeMeters);
		maxAltitudeMeters = Math.max(maxAltitudeMeters, density.altitudeMeters);
	}

	return {
		distanceMeters: distance,
		rayleighOpticalLength,
		mieOpticalLength,
		absorptionOpticalLength,
		altitudeRangeMeters: {
			min: minAltitudeMeters,
			max: maxAltitudeMeters,
		},
	};
}

function densityAtPosition(position) {
	const altitudeMeters = length(position) - ATMOSPHERE.bottomRadiusMeters;

	return {
		altitudeMeters,
		rayleigh: Math.exp(-Math.max(0, altitudeMeters) / ATMOSPHERE.rayleighScaleHeightMeters),
		mie: Math.exp(-Math.max(0, altitudeMeters) / ATMOSPHERE.mieScaleHeightMeters),
		absorption: 0,
	};
}

function distanceToTopAtmosphereBoundary(origin, direction) {
	const radius = length(origin);
	const mu = dot(origin, direction) / radius;

	return distanceToTopAtmosphereBoundaryForRadiusMu(radius, mu);
}

function distanceToTopAtmosphereBoundaryForRadiusMu(radius, mu) {
	const discriminant =
		radius * radius * (mu * mu - 1) +
		ATMOSPHERE.topRadiusMeters * ATMOSPHERE.topRadiusMeters;

	return Math.max(0, -radius * mu + Math.sqrt(Math.max(0, discriminant)));
}

function rayIntersectsGround(radius, mu) {
	return (
		mu < 0 &&
		radius * radius * (mu * mu - 1) +
			ATMOSPHERE.bottomRadiusMeters * ATMOSPHERE.bottomRadiusMeters >=
			0
	);
}

function rayleighScatteringCoefficientAt(wavelengthMicrometers) {
	return ATMOSPHERE.rayleighCoefficientScale * wavelengthMicrometers ** -4;
}

function mieExtinctionCoefficientAt(wavelengthMicrometers) {
	return (
		(ATMOSPHERE.mieAngstromBeta / ATMOSPHERE.mieScaleHeightMetersForCoefficient) *
		wavelengthMicrometers ** -ATMOSPHERE.mieAngstromAlpha
	);
}

function mieScatteringCoefficientAt(wavelengthMicrometers) {
	return (
		mieExtinctionCoefficientAt(wavelengthMicrometers) *
		ATMOSPHERE.mieSingleScatteringAlbedo
	);
}

function opticalDepthAtWavelength(opticalLengths, wavelengthNanometers) {
	const wavelengthMicrometers = wavelengthNanometers * 1e-3;

	return (
		rayleighScatteringCoefficientAt(wavelengthMicrometers) *
			opticalLengths.rayleighOpticalLength +
		mieExtinctionCoefficientAt(wavelengthMicrometers) *
			opticalLengths.mieOpticalLength +
		ATMOSPHERE.ozoneAbsorption *
			(opticalLengths.absorptionOpticalLength || 0)
	);
}

function computeTransmittanceAtWavelength(opticalLengths, wavelengthNanometers) {
	return Math.exp(-opticalDepthAtWavelength(opticalLengths, wavelengthNanometers));
}

function computeTransmittanceToSunAtWavelength({
	position,
	sunRay,
	wavelengthNanometers,
}) {
	const radius = length(position);
	const mu = dot(position, sunRay) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return 0;
	}

	return computeTransmittanceAtWavelength(
		computeOpticalLengthsAlongDistance({
			origin: position,
			direction: sunRay,
			distance: distanceToTopAtmosphereBoundaryForRadiusMu(radius, mu),
			sampleCount: ATMOSPHERE.directRadianceSunTransmittanceSamples,
		}),
		wavelengthNanometers
	);
}

function rayleighPhaseFunction(nu) {
	return (3 / (16 * Math.PI)) * (1 + nu * nu);
}

function miePhaseFunction(g, nu) {
	const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));

	return (k * (1 + nu * nu)) / (1 + g * g - 2 * g * nu) ** 1.5;
}

function objectRadianceAtWavelength(spectrumId, wavelengthNanometers) {
	if (spectrumId === 'red') {
		return wavelengthNanometers >= 626.333333333333 ? 0.045 : 0.003;
	}
	if (spectrumId === 'green') {
		return (
			0.002 +
			0.05 * triangularSpectrumWeight(wavelengthNanometers, 532.333333333333, 65) +
			0.012 * triangularSpectrumWeight(wavelengthNanometers, 563.666666666667, 60)
		);
	}
	if (spectrumId === 'blue') {
		return wavelengthNanometers <= 501 ? 0.045 : 0.003;
	}
	if (spectrumId === 'ground') {
		return 0.012;
	}

	return 0;
}

function spectrumNumericId(spectrumId) {
	if (spectrumId === 'red') {
		return 1;
	}
	if (spectrumId === 'green') {
		return 2;
	}
	if (spectrumId === 'blue') {
		return 3;
	}
	if (spectrumId === 'ground') {
		return 4;
	}
	if (spectrumId === 'mountainRidgeGreen') {
		return 5;
	}

	return 0;
}

function triangularSpectrumWeight(lambdaNm, centerNm, halfWidthNm) {
	return Math.max(0, 1 - Math.abs(lambdaNm - centerNm) / halfWidthNm);
}

function sunDirection(sunCase) {
	const altitude = degreesToRadians(sunCase.sunAltitudeDegrees);
	const azimuth = degreesToRadians(sunCase.sunAzimuthDegrees);
	const horizontalLength = Math.cos(altitude);

	return normalize([
		horizontalLength * Math.cos(azimuth),
		horizontalLength * Math.sin(azimuth),
		Math.sin(altitude),
	]);
}

function degreesToRadians(degrees) {
	return degrees * (Math.PI / 180);
}

function runSmoke(command, startedAt) {
	const canvas = document.getElementById('lab-canvas');
	const context = canvas.getContext('2d', { willReadFrequently: true });
	const webgl = probeWebgl();
	const now = new Date().toISOString();
	const payloadMessage = command && command.payload && command.payload.message
		? String(command.payload.message)
		: 'No payload message supplied.';

	drawSmokeCanvas(context, canvas, {
		command,
		loadCount,
		now,
		webgl,
		payloadMessage,
	});

	const samples = sampleCanvas(context, canvas);
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-shader-lab-page-result',
		status: 'accepted',
		commandId: command && command.id,
		commandLabel: command && command.label,
		pageLoadCount: loadCount,
		timestamp: now,
		location: window.location.href,
		userAgent: navigator.userAgent,
		devicePixelRatio: window.devicePixelRatio,
		viewport: {
			width: window.innerWidth,
			height: window.innerHeight,
		},
		canvas: {
			width: canvas.width,
			height: canvas.height,
			samples,
		},
		selectedPixels: samples,
		diagnostics: {
			kind: 'smoke-diagnostics',
			status: 'accepted',
			webgl,
		},
		timings: {
			pageDurationMs: completedAt - startedAt,
		},
		echo: command && command.payload,
	};
}

function drawSmokeCanvas(context, canvas, details) {
	const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
	gradient.addColorStop(0, '#27364b');
	gradient.addColorStop(0.45, '#466b8a');
	gradient.addColorStop(1, '#d8e7f2');
	context.fillStyle = gradient;
	context.fillRect(0, 0, canvas.width, canvas.height);

	const stripeWidth = Math.max(1, Math.floor(canvas.width / 12));
	for (let index = 0; index < 12; index += 1) {
		context.fillStyle = index % 2 === 0
			? 'rgba(255, 255, 255, 0.10)'
			: 'rgba(0, 0, 0, 0.10)';
		context.fillRect(index * stripeWidth, 0, stripeWidth, canvas.height);
	}

	context.fillStyle = 'rgba(18, 20, 23, 0.72)';
	context.fillRect(24, 24, canvas.width - 48, 144);

	context.fillStyle = '#f8fbff';
	context.font = '20px Arial, sans-serif';
	context.fillText(`Run: ${details.command.id}`, 42, 62);
	context.fillText(`Reload count: ${details.loadCount}`, 42, 94);
	context.fillText(`WebGL: ${details.webgl.available ? 'available' : 'missing'}`, 42, 126);

	context.font = '14px Arial, sans-serif';
	context.fillStyle = '#d7e0ea';
	context.fillText(`Time: ${details.now}`, 42, 150);
	context.fillText(`Payload: ${details.payloadMessage}`, 42, 190);
}

function probeWebgl() {
	const canvas = document.createElement('canvas');
	const gl = canvas.getContext('webgl2')
		|| canvas.getContext('webgl')
		|| canvas.getContext('experimental-webgl');

	if (!gl) {
		return {
			available: false,
		};
	}

	const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
	return {
		available: true,
		version: gl.getParameter(gl.VERSION),
		shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
		vendor: debugInfo
			? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
			: gl.getParameter(gl.VENDOR),
		renderer: debugInfo
			? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
			: gl.getParameter(gl.RENDERER),
	};
}

function sampleCanvas(context, canvas) {
	const points = [
		{ id: 'upper-left', x: 8, y: 8 },
		{ id: 'center', x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) },
		{ id: 'lower-right', x: canvas.width - 9, y: canvas.height - 9 },
	];

	return points.map((point) => {
		const data = context.getImageData(point.x, point.y, 1, 1).data;
		return {
			id: point.id,
			x: point.x,
			y: point.y,
			rgba: [data[0], data[1], data[2], data[3]],
		};
	});
}

function readRendererPixel(gl, x, y, canvasHeight) {
	const pixels = new Uint8Array(4);
	gl.readPixels(x, canvasHeight - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
	return [pixels[0], pixels[1], pixels[2], pixels[3]];
}

function pixelToNdc(x, y, width, height) {
	return {
		x: ((x + 0.5) / width) * 2 - 1,
		y: -(((y + 0.5) / height) * 2 - 1),
	};
}

function worldToPixel(position, camera, canvas) {
	const projected = position.clone().project(camera);

	return {
		x: Math.max(0, Math.min(canvas.width - 1, Math.floor(((projected.x + 1) / 2) * canvas.width))),
		y: Math.max(0, Math.min(canvas.height - 1, Math.floor(((-projected.y + 1) / 2) * canvas.height))),
	};
}

function threeToAlgorithmWorld(vector) {
	return [
		vector[0],
		-vector[2],
		ATMOSPHERE.bottomRadiusMeters + vector[1],
	];
}

function threeDirectionToAlgorithm(vector) {
	return normalize([vector[0], -vector[2], vector[1]]);
}

function algorithmDirectionToThreeArray(vector) {
	return [vector[0], vector[2], -vector[1]];
}

function dot(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(vector) {
	return Math.sqrt(dot(vector, vector));
}

function normalize(vector) {
	const vectorLength = length(vector);

	if (vectorLength === 0) {
		return [0, 0, 0];
	}

	return vector.map((value) => value / vectorLength);
}

function addVectors(a, b) {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function addArrays(left, right) {
	return addVectors(left, right);
}

function subtractArrays(left, right) {
	return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function maxAbsArrayDelta(left, right) {
	let maxDelta = 0;
	for (let index = 0; index < left.length; index += 1) {
		maxDelta = Math.max(maxDelta, Math.abs(left[index] - right[index]));
	}
	return maxDelta;
}

function scaleVector(vector, scalar) {
	return [
		vector[0] * scalar,
		vector[1] * scalar,
		vector[2] * scalar,
	];
}

function cross(a, b) {
	return [
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0],
	];
}

function addScaled(origin, direction, distance) {
	return [
		origin[0] + direction[0] * distance,
		origin[1] + direction[1] * distance,
		origin[2] + direction[2] * distance,
	];
}

function fibonacciSphereIncomingDirections(sunRay, count) {
	const halfCount = Math.floor(count / 2);
	const goldenRatio = (1 + Math.sqrt(5)) / 2;
	const sunAxis = normalize(sunRay);
	const reference =
		Math.abs(dot(sunAxis, [0, 0, 1])) < 0.95 ? [0, 0, 1] : [0, 1, 0];
	const zAxis = normalize(
		addVectors(reference, scaleVector(sunAxis, -dot(reference, sunAxis)))
	);
	const yAxis = normalize(cross(zAxis, sunAxis));
	const directions = [];

	for (let index = -halfCount; directions.length < count; index += 1) {
		const z = (2 * index) / count;
		const latitude = Math.asin(clamp(z, -1, 1));
		const longitude = (2 * Math.PI * index) / goldenRatio;
		const horizontalScale = Math.cos(latitude);
		const localX = horizontalScale * Math.cos(longitude);
		const localY = horizontalScale * Math.sin(longitude);
		const localZ = z;

		directions.push(
			normalize(
				addVectors(
					addVectors(scaleVector(sunAxis, localX), scaleVector(yAxis, localY)),
					scaleVector(zAxis, localZ)
				)
			)
		);
	}

	return directions;
}

function mean(values) {
	if (values.length === 0) {
		return 0;
	}

	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function clampByte(value) {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function vectorToArray(vector) {
	return [vector.x, vector.y, vector.z];
}

function cameraToDiagnostics(camera) {
	return {
		type: 'THREE.PerspectiveCamera',
		positionMeters: vectorToArray(camera.position),
		verticalFovDegrees: camera.fov,
		aspect: camera.aspect,
		near: camera.near,
		far: camera.far,
		projectionMatrix: camera.projectionMatrix.toArray(),
		matrixWorld: camera.matrixWorld.toArray(),
	};
}
