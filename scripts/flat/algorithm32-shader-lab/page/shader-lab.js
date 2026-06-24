import * as THREE from '/node_modules/three/build/three.module.js';

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
	if (mode === 'browser-mountain-shader-image') {
		return runBrowserMountainShaderImage(command, startedAt);
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

function computeDirectRadianceDiagnostic(sample) {
	const channel = SPECTRAL_CHANNELS.find(
		(item) =>
			item.wavelengthNanometers === ATMOSPHERE.diagnosticWavelengthNanometers
	);
	const packet = computeDirectRadianceChannelPacket(sample, channel);

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

function computeSecondOrderRadianceDiagnostic(sample, incidentSkyCache) {
	const channel = SPECTRAL_CHANNELS.find(
		(item) =>
			item.wavelengthNanometers === ATMOSPHERE.diagnosticWavelengthNanometers
	);
	const packet = computeSecondOrderRadianceChannelPacket(
		sample,
		channel,
		incidentSkyCache
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
	incidentSkyCache
) {
	const firstOrderPacket = computeDirectRadianceChannelPacket(sample, channel);
	const secondOrderPathRadiance = computeSecondOrderPathRadianceAtWavelength({
		origin: firstOrderPacket.algorithm32Ray.origin,
		direction: firstOrderPacket.algorithm32Ray.direction,
		distance: firstOrderPacket.pathDistanceMeters,
		wavelengthNanometers: channel.wavelengthNanometers,
		wavelengthMicrometers: channel.wavelengthNanometers * 1e-3,
		solarIrradiance: channel.solarIrradiance,
		sunRay: firstOrderPacket.sunCase.sunDirection,
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

function computeDirectRadianceSpectralDiagnostic(sample) {
	const channels = SPECTRAL_CHANNELS.map((channel) =>
		computeDirectRadianceChannelPacket(sample, channel)
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

function computeSecondOrderRadianceSpectralDiagnostic(sample, incidentSkyCache) {
	const channels = SPECTRAL_CHANNELS.map((channel) =>
		computeSecondOrderRadianceChannelPacket(
			sample,
			channel,
			incidentSkyCache
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

function computeDirectRadianceChannelPacket(sample, channel) {
	const origin = threeToAlgorithmWorld(sample.threeRay.origin);
	const direction = normalize(threeDirectionToAlgorithm(sample.threeRay.direction));
	const pathDistanceMeters = sample.classification === 'sky'
		? distanceToTopAtmosphereBoundary(origin, direction)
		: sample.hitDistanceMeters;
	const wavelengthNanometers = channel.wavelengthNanometers;
	const wavelengthMicrometers = wavelengthNanometers * 1e-3;
	const sunRay = sunDirection(DIRECT_RADIANCE_SUN_CASE);
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
			...DIRECT_RADIANCE_SUN_CASE,
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
		DIRECT_RADIANCE_SUN_CASE.id,
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
uniform sampler2D incidentSkyRadiance;
uniform sampler2D sceneInputTexture;

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
	vec2 ndc = vec2(
		(gl_FragCoord.x / resolution.x) * 2.0 - 1.0,
		(gl_FragCoord.y / resolution.y) * 2.0 - 1.0
	);
	vec4 viewPosition = projectionMatrixInverse * vec4(ndc, 0.5, 1.0);
	viewPosition /= viewPosition.w;
	vec3 rayOrigin = cameraMatrixWorld[3].xyz;
	vec3 rayDirection = normalize((cameraMatrixWorld * vec4(viewPosition.xyz, 0.0)).xyz);
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
			ivec2(int(gl_FragCoord.x), int(gl_FragCoord.y)),
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
		float objectRadiance =
			objectRadianceAt(spectrumId, wavelengthNm) * pathAndT.y;
		float finalRadiance = objectRadiance + pathAndT.x + secondOrderPath;
		xyz += CIE[channelIndex] * finalRadiance * SPECTRAL_DELTA_NM;
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
