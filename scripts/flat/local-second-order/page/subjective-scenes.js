import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import Terrain, { TerrainNS } from 'three.terrain.js';
import {
	Algorithm32AtmospherePass,
	threeNativePassModeCode,
} from '/shared/algorithm32/POC/three/shader-lab-page.js';
import {
	createAlgorithm32PocAtmospherePass,
} from '/shared/algorithm32/POC/three/local-second-order-renderer.js';
import {
	createLocalSunTemporalContextFromPayload,
	flatLocalSunSourceDefinition as pocFlatLocalSunSourceDefinition,
	localSolarTimeForOffsetDegrees as pocLocalSolarTimeForOffsetDegrees,
	makeFlatLocalSunSourcePacket as makePocFlatLocalSunSourcePacket,
} from '/shared/algorithm32/POC/local-second-order/local-sun-source.js';

const WIDTH = 480;
const HEIGHT = 270;
const TERRAIN_SEED = 'algorithm32-mountain-detail-v1';
const TERRAIN_BACKENDS = Object.freeze({
	manualHeightfield: 'manual-heightfield',
	threeTerrainJs: 'three-terrain-js',
	rockyLandHeightmap: 'rocky-land-heightmap',
	southernFranceObjGeometry: 'southern-france-obj-geometry',
	southernFranceObjDiffuse: 'southern-france-obj-diffuse',
});
const ROCKY_LAND_HEIGHTMAP_URL =
	'./assets/rocky-land-and-rivers/Height Map PNG.png';
const SOUTHERN_FRANCE_OBJ_URL =
	'./assets/southern-france-blender-obj/Mountain Range in Southern France.obj';
const SOUTHERN_FRANCE_MTL_URL =
	'./assets/southern-france-blender-obj/Mountain Range in Southern France.mtl';
const SOUTHERN_FRANCE_DIFFUSE_TEXTURE_BASE_URL =
	'./assets/southern-france-blender-obj/diffuse-tga-source/';
const SOUTHERN_FRANCE_MATERIAL_IDS = Object.freeze([
	'ID4',
	'ID409',
	'ID422',
	'ID435',
	'ID640',
	'ID661',
	'ID706',
	'ID727',
	'ID740',
	'ID785',
	'ID1014',
	'ID1091',
	'ID1104',
	'ID1133',
	'ID1146',
	'ID1159',
	'ID1188',
	'ID1233',
	'ID1270',
	'ID1283',
	'ID1296',
	'ID1549',
	'ID1618',
	'ID1631',
	'ID1644',
	'ID1729',
	'ID1742',
	'ID1771',
]);
const MOUNTAIN_VIEW_MODES = Object.freeze({
	frontHighSun: 'front-high-sun',
	sunsetBehindCamera: 'sunset-behind-camera',
	localToward180Sun: 'local-toward-180deg-sun',
	distantSunsetCentered: 'distant-sunset-centered',
});
const HIGH_SUN_CASE = Object.freeze({
	id: 'figure1-13h15-z21',
	sourceTimeOfDay: '13h15',
	sourceSunZenithDegrees: 21,
	sunAltitudeDegrees: 69,
	sunAzimuthDegrees: 85.31410016049729,
	role: 'highest-Sun render and stress case',
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
});
const FLAT_SCENE_SKY_RAY_LIMIT_METERS = 1926774;
const SUBJECTIVE_SOURCE_MATRIX_CASE_IDS = Object.freeze([
	'distant-midday',
	'distant-sunset-behind-camera',
	'local-closest',
	'local-090deg',
	'local-135deg',
	'local-180deg',
]);
const LOCAL_SUN_ORBIT_OFFSETS_DEGREES = Object.freeze([0, 45, 90, 135, 180]);
const LOCAL_DISTANT_TIME_ALIGNED_GALLERY_MODE =
	'with-shader-local-distant-side-by-side';
const DISTANT_LOCAL_DAYLIGHT_GALLERY_MODE =
	'with-shader-distant-local-sunrise-sunset-side-by-side';
const DEFAULT_FLAT_SIMULATION_ROOT = Object.freeze({
	lat: 37.3382,
	lon: -121.8863,
	elevationMeters: 30.48,
});
const FALSE_SUN_LATITUDE_MODEL = Object.freeze({
	type: 'annual-tropic-migration',
	northLimitDeg: 23.5,
	southLimitDeg: -23.5,
	northernSolsticeDayOfYear: 172,
	periodDays: 365.2422,
});
const MS_PER_DAY = 24 * 60 * 60 * 1000;

let randomState = 1;
let rockyLandHeightmapPromise = null;
let southernFranceObjPromise = null;
let southernFranceDiffuseTexturesPromise = null;

export async function runLocalSubjectiveSceneCapture(command, startedAt) {
	const payload = command.payload || {};
	const caseConfig = applySourceColorOverrideToCaseConfig(
		subjectiveCaseConfig(payload.caseId || payload.case || 'distant-midday'),
		payload.sourceColorOverride
	);
	const width = payload.width || WIDTH;
	const height = payload.height || HEIGHT;
	const terrainBackend = payload.terrainBackend || TERRAIN_BACKENDS.manualHeightfield;
	const terrainSpec =
		payload.sceneDetailSpec ||
		(await createSubjectiveTerrainSpec({
			seedValue: payload.terrainSeed || TERRAIN_SEED,
			terrainBackend,
		}));
	const displayCanvas = document.getElementById('lab-canvas');
	const renderCanvas = document.createElement('canvas');
	const sceneSetup = createMountainLitScene(renderCanvas, {
		width,
		height,
		mountainView: caseConfig.mountainView,
		sourcePacket: caseConfig.sourcePacket,
		geometryPacket: caseConfig.geometryPacket,
		sceneDetailSpec: terrainSpec,
	});
	let imageDataUrl = null;
	let capture = null;

	try {
		sceneSetup.renderer.render(sceneSetup.scene, sceneSetup.camera);
		imageDataUrl = renderCanvas.toDataURL('image/png');
		drawRenderCanvasToDisplayCanvas({ renderCanvas, displayCanvas, width, height });
		capture = captureSceneInputPacket({
			captureId: caseConfig.id,
			sceneMode: 'local-lane-subjective-mountain-lit',
			sceneColorPolicy:
				'Local-lane Three MeshStandardMaterial mountain scene with source-driven white Three light; CPU Algorithm32 soft shader owns atmosphere color.',
			canvas: renderCanvas,
			renderer: sceneSetup.renderer,
			camera: sceneSetup.camera,
			meshes: sceneSetup.meshes,
			sceneObjects: sceneSetup.sceneObjects,
			ground: sceneSetup.ground,
			sourcePacket: caseConfig.sourcePacket,
			sceneLightPacket: sceneSetup.sceneLightPacket,
			geometryPacket: caseConfig.geometryPacket,
			sceneDetailPacket: sceneSetup.sceneDetailPacket,
		});
	} finally {
		disposeSceneSetup(sceneSetup);
	}

	const criteriaResults = subjectiveCaptureCriteria({ capture });
	const failed = criteriaResults.some((criterion) => criterion.status === 'fail');
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-local-second-order-subjective-scene-capture-result',
		status: failed ? 'rejected' : 'accepted',
		command,
		diagnostics: {
			status: failed ? 'rejected' : 'accepted',
			commandType: command.type,
			case: {
				id: caseConfig.id,
				label: caseConfig.label,
				sourceFamily: caseConfig.sourceFamily,
			},
			capture,
			sceneLightPacket: sceneSetup.sceneLightPacket,
			sceneGeneration: {
				origin: 'local copy of accepted shader-lab detailed mountain subjective scene',
				terrainSeed: terrainSpec.seed,
				terrainKind: terrainSpec.kind,
				meshTopology: terrainSpec.summary.meshTopology,
				width,
				height,
			},
		},
		selectedPixels: capture?.selectedPixels || [],
		criteriaResults,
		imageDataUrl,
		timings: {
			startedAtMs: startedAt,
			completedAtMs: completedAt,
			durationMs: completedAt - startedAt,
		},
	};
}

export async function runThreeTerrainIntegratedDistantMidday(command, startedAt) {
	const payload = command.payload || {};
	const caseConfig = subjectiveCaseConfig('distant-midday');
	const width = payload.width || WIDTH;
	const height = payload.height || HEIGHT;
	const renderScale = Math.max(1, Number(payload.renderScale || 1));
	const renderWidth = Math.round(width * renderScale);
	const renderHeight = Math.round(height * renderScale);
	const rendererAntialias = payload.rendererAntialias === true;
	const enableShadows = payload.enableShadows === true;
	const shadowMapSize = payload.shadowMapSize || null;
	const shadowPolicy = payload.shadowPolicy || null;
	const atmospherePassDisabled =
		payload.disableAtmospherePass === true ||
		payload.atmosphereMode === 'off' ||
		payload.shaderMode === 'off';
	const terrainBackend = payload.terrainBackend || TERRAIN_BACKENDS.threeTerrainJs;
	const terrainSpec = await createSubjectiveTerrainSpec({
		seedValue:
			payload.terrainSeed ||
			defaultTerrainSeedForBackend(terrainBackend),
		terrainBackend,
	});
	applyTerrainDiagnosticOverrides({ terrainSpec, payload });
	const displayCanvas = document.getElementById('lab-canvas');
	const renderCanvas = document.createElement('canvas');
	const sceneSetup = createMountainLitScene(renderCanvas, {
		width: renderWidth,
		height: renderHeight,
		antialias: rendererAntialias,
		mountainView: caseConfig.mountainView,
		sourcePacket: caseConfig.sourcePacket,
		geometryPacket: caseConfig.geometryPacket,
		sceneDetailSpec: terrainSpec,
		enableShadows,
		shadowMapSize,
		shadowPolicy,
		cameraOverride: payload.cameraOverride || null,
	});
	let sceneCapture = null;
	let atmospherePixels = null;
	let imageDataUrl = null;
	let sceneTargetSample = null;
	let webglRenderer = null;

	try {
		webglRenderer = webglRendererInfo(sceneSetup.renderer);
		sceneSetup.renderer.render(sceneSetup.scene, sceneSetup.camera);
		const sceneOnlyPixels = captureCanvasImageData(renderCanvas, width, height);
		sceneCapture = captureSceneCoverageSummary({
			captureId: caseConfig.id,
			sceneMode: 'local-lane-external-terrain-integrated-distant-midday-scene',
			width,
			height,
			camera: sceneSetup.camera,
			meshes: sceneSetup.meshes,
			sceneObjects: sceneSetup.sceneObjects,
			ground: sceneSetup.ground,
			sourcePacket: caseConfig.sourcePacket,
			sceneLightPacket: sceneSetup.sceneLightPacket,
			geometryPacket: caseConfig.geometryPacket,
			sceneDetailPacket: sceneSetup.sceneDetailPacket,
		});

		if (atmospherePassDisabled) {
			sceneTargetSample = Array.from(sceneOnlyPixels.data.slice(0, 16));
			atmospherePixels = sceneOnlyPixels;
			imageDataUrl = canvasDataUrlAtSize(renderCanvas, width, height);
			drawRenderCanvasToDisplayCanvas({
				renderCanvas,
				displayCanvas,
				width,
				height,
			});
		} else {
			const pass = new Algorithm32AtmospherePass({
				renderer: sceneSetup.renderer,
				width: renderWidth,
				height: renderHeight,
				camera: sceneSetup.camera,
				config: {
					source: {
						...caseConfig.sourcePacket,
						color: { r: 1, g: 0.98, b: 0.95 },
					},
					geometry: {
						kind: caseConfig.geometryPacket.kind,
					},
					display: {},
				},
				mode: 'distant-first-order-atmosphere',
				maxDistanceMeters: MOUNTAIN_RIDGE_SCENE.farMeters,
			});
			try {
				pass.renderScene(sceneSetup.scene, sceneSetup.camera);
				sceneTargetSample = Array.from(pass.readSceneColorTargetTopLeft().slice(0, 16));
				pass.render({ camera: sceneSetup.camera });
				atmospherePixels = captureCanvasImageData(renderCanvas, width, height);
				imageDataUrl = canvasDataUrlAtSize(renderCanvas, width, height);
				drawRenderCanvasToDisplayCanvas({
					renderCanvas,
					displayCanvas,
					width,
					height,
				});
			} finally {
				pass.dispose();
			}
		}
	} finally {
		disposeSceneSetup(sceneSetup);
	}

	const selectedPixels = atmospherePixels
		? samplePixelsFromImageData(atmospherePixels, [
				{ id: 'upper-sky', x: Math.floor(width * 0.5), y: Math.floor(height * 0.16) },
				{ id: 'center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.5) },
				{ id: 'lower-center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.78) },
			])
		: [];
	const imageStats = atmospherePixels ? rgbaImageStats(atmospherePixels.data) : null;
	const criteriaResults = threeTerrainIntegratedCriteria({
		sceneCapture,
		selectedPixels,
		imageStats,
		sceneTargetSample,
		atmospherePassDisabled,
		enableShadows,
	});
	const failed = criteriaResults.some((criterion) => criterion.status === 'fail');
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-local-second-order-three-terrain-integrated-spike-result',
		status: failed ? 'rejected' : 'accepted',
		command,
		diagnostics: {
			status: failed ? 'rejected' : 'accepted',
			commandType: command.type,
			case: {
				id: caseConfig.id,
				label: caseConfig.label,
				sourceFamily: caseConfig.sourceFamily,
			},
			pass: {
				mode: atmospherePassDisabled
					? 'scene-only-no-atmosphere'
					: 'distant-first-order-atmosphere',
				modeCode: atmospherePassDisabled
					? null
					: threeNativePassModeCode('distant-first-order-atmosphere'),
				path: atmospherePassDisabled
					? 'Three scene render target -> visible canvas; Algorithm32AtmospherePass disabled for diagnostic'
					: 'Three scene render target + depth texture -> Algorithm32AtmospherePass -> visible canvas',
				atmospherePassDisabled,
			},
			sceneCapture,
			sceneLightPacket: sceneSetup.sceneLightPacket,
			sceneGeneration: {
				origin:
					'Milestone 13 external terrain subjective terrain spike',
				terrainSeed: terrainSpec.seed,
				terrainKind: terrainSpec.kind,
				terrainBackend: terrainSpec.terrainBackend,
				meshTopology: terrainSpec.summary.meshTopology,
				width,
				height,
				internalRenderWidth: renderWidth,
				internalRenderHeight: renderHeight,
				renderScale,
				rendererAntialias,
				webglRenderer,
				enableShadows,
				shadowPolicy: sceneSetup.sceneLightPacket?.sceneShadowing || null,
				cameraOverride: sceneSetup.cameraOverridePacket,
				downsampledOutput: renderScale > 1,
			},
			sceneTargetSample,
			imageStats,
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

export async function runThreeTerrainIntegratedSourceMatrix(command, startedAt) {
	const payload = command.payload || {};
	const width = payload.width || WIDTH;
	const height = payload.height || HEIGHT;
	const renderScale = Math.max(1, Number(payload.renderScale || 1));
	const renderWidth = Math.round(width * renderScale);
	const renderHeight = Math.round(height * renderScale);
	const rendererAntialias = payload.rendererAntialias === true;
	const enableShadows = payload.enableShadows === true;
	const shadowMapSize = payload.shadowMapSize || null;
	const shadowPolicy = payload.shadowPolicy || null;
	const terrainBackend = payload.terrainBackend || TERRAIN_BACKENDS.southernFranceObjDiffuse;
	const galleryMode = payload.galleryMode || 'with-without-side-by-side';
	const sourceMatrixContext = sourceMatrixTemporalContextFromPayload(payload);
	const sourceMatrixCaseConfigs = sourceMatrixCaseConfigsFromPayload({
		payload,
		sourceMatrixContext,
	});
	const interCaseYieldMs = normalizeInterCaseYieldMs(payload.interCaseYieldMs);
	const terrainSpec = await createSubjectiveTerrainSpec({
		seedValue:
			payload.terrainSeed ||
			defaultTerrainSeedForBackend(terrainBackend),
		terrainBackend,
	});
	applyTerrainDiagnosticOverrides({ terrainSpec, payload });
	const casePairs = [];
	const requestedCaseIds = [];

	for (
		let caseIndex = 0;
		caseIndex < sourceMatrixCaseConfigs.length;
		caseIndex += 1
	) {
		const caseConfig = applySourceMatrixPayloadCasePolicy({
			caseConfig: sourceMatrixCaseConfigs[caseIndex],
			payload,
			sourceMatrixContext,
		});
		requestedCaseIds.push(caseConfig.id);
		console.info(
			`[local-second-order] Rendering source matrix case ${caseIndex + 1}/${sourceMatrixCaseConfigs.length}: ${caseConfig.id}`
		);
		const pair = await renderThreeTerrainIntegratedCasePair({
			command,
			caseConfig,
			terrainSpec,
			width,
			height,
			renderWidth,
			renderHeight,
			rendererAntialias,
			enableShadows,
			shadowMapSize,
			shadowPolicy,
			cameraOverride: payload.cameraOverride || null,
			cachePayload: payload.cache || null,
			sourceMatrixContext,
			displayPayload: {
				starField: payload.starField || null,
			},
		});
		if (galleryMode === LOCAL_DISTANT_TIME_ALIGNED_GALLERY_MODE) {
			const pairedCaseConfig =
				applySourceColorOverrideToCaseConfig(
					timeAlignedDistantCaseConfigForLocalCase({
						localCaseConfig: caseConfig,
						sourceMatrixContext,
					}),
					payload.sourceColorOverride
				);
			console.info(
				`[local-second-order] Rendering paired distant solar-time case for ${caseConfig.id}: ${pairedCaseConfig.id}`
			);
			pair.pairedDistant = await renderThreeTerrainIntegratedCasePair({
				command,
				caseConfig: pairedCaseConfig,
				terrainSpec,
				width,
				height,
				renderWidth,
				renderHeight,
				rendererAntialias,
				enableShadows,
				shadowMapSize,
				shadowPolicy,
				cameraOverride: payload.cameraOverride || null,
				cachePayload: payload.cache || null,
				sourceMatrixContext,
				displayPayload: {
					starField: payload.starField || null,
				},
			});
		}
		if (galleryMode === DISTANT_LOCAL_DAYLIGHT_GALLERY_MODE) {
			const pairedCaseConfig =
				applySourceColorOverrideToCaseConfig(
					timeAlignedLocalCaseConfigForDistantCase({
						distantCaseConfig: caseConfig,
						sourceMatrixContext,
					}),
					payload.sourceColorOverride
				);
			console.info(
				`[local-second-order] Rendering paired local solar-time case for ${caseConfig.id}: ${pairedCaseConfig.id}`
			);
			pair.pairedLocal = await renderThreeTerrainIntegratedCasePair({
				command,
				caseConfig: pairedCaseConfig,
				terrainSpec,
				width,
				height,
				renderWidth,
				renderHeight,
				rendererAntialias,
				enableShadows,
				shadowMapSize,
				shadowPolicy,
				cameraOverride: payload.cameraOverride || null,
				cachePayload: payload.cache || null,
				sourceMatrixContext,
				displayPayload: {
					starField: payload.starField || null,
				},
			});
		}
		casePairs.push(pair);
		if (
			interCaseYieldMs > 0 &&
			caseIndex < sourceMatrixCaseConfigs.length - 1
		) {
			await yieldToBrowser(interCaseYieldMs);
		}
	}

	const gallery = composeSourceMatrixGallery({
		casePairs,
		width,
		height,
		galleryMode,
	});
	const displayCanvas = document.getElementById('lab-canvas');
	displayCanvas.width = gallery.canvas.width;
	displayCanvas.height = gallery.canvas.height;
	displayCanvas
		.getContext('2d', { willReadFrequently: true })
		.drawImage(gallery.canvas, 0, 0);
	const criteriaResults = sourceMatrixCriteria({
		casePairs,
		expectedCaseIds: requestedCaseIds,
	});
	const failed = criteriaResults.some((criterion) => criterion.status === 'fail');
	const completedAt = performance.now();

	return {
		kind: 'algorithm32-local-second-order-three-terrain-source-matrix-result',
		status: failed ? 'rejected' : 'accepted',
		command,
		diagnostics: {
			status: failed ? 'rejected' : 'accepted',
			commandType: command.type,
			sceneGeneration: {
				origin:
					'Southern France diffuse terrain subjective source matrix',
				terrainSeed: terrainSpec.seed,
				terrainKind: terrainSpec.kind,
				terrainBackend: terrainSpec.terrainBackend,
				meshTopology: terrainSpec.summary.meshTopology,
				width,
				height,
				internalRenderWidth: renderWidth,
				internalRenderHeight: renderHeight,
				renderScale,
				rendererAntialias,
				enableShadows,
				shadowPolicy,
				sourceMatrixContext,
				interCaseYieldMs,
				downsampledOutput: renderScale > 1,
				caseIds: requestedCaseIds,
				gallery: {
					width: gallery.canvas.width,
					height: gallery.canvas.height,
					mode: galleryMode,
					layout: gallery.layout,
				},
			},
			cases: casePairs.map((pair) => serializeSourceMatrixCase(pair)),
		},
		selectedPixels: sourceMatrixSelectedPixels({ casePairs, galleryMode }),
		criteriaResults,
		imageDataUrl: gallery.canvas.toDataURL('image/png'),
		timings: {
			startedAtMs: startedAt,
			completedAtMs: completedAt,
			durationMs: completedAt - startedAt,
		},
	};
}

function applySourceMatrixPayloadCasePolicy({ caseConfig, payload }) {
	const colorAdjustedCaseConfig = applySourceColorOverrideToCaseConfig(
		caseConfig,
		payload.sourceColorOverride
	);
	if (
		payload.forceLocalToward180Sun !== true ||
		colorAdjustedCaseConfig.sourceFamily !== 'flat-local-point-sun' ||
		colorAdjustedCaseConfig.mountainView === MOUNTAIN_VIEW_MODES.localToward180Sun
	) {
		return colorAdjustedCaseConfig;
	}
	return {
		...colorAdjustedCaseConfig,
		mountainView: MOUNTAIN_VIEW_MODES.localToward180Sun,
		viewPolicyOverride: {
			kind: 'force-local-yaw-to-180deg-sun',
			reason:
				'Payload requested all local source rows, including local closest, to use the yaw-only view toward the local 180 degree Sun bearing.',
			targetLocalSunOffsetDegrees: 180,
		},
	};
}

function applySourceColorOverrideToCaseConfig(caseConfig, sourceColorOverride) {
	if (
		!sourceColorOverride ||
		caseConfig.sourceFamily !== 'flat-local-point-sun' ||
		caseConfig.sourcePacket?.kind !== 'flat-local-point-sun'
	) {
		return caseConfig;
	}
	const color = normalizeSourceColorOverride(sourceColorOverride);
	if (!color) {
		return caseConfig;
	}
	return {
		...caseConfig,
		sourcePacket: {
			...caseConfig.sourcePacket,
			color,
			sourceColorOverride: {
				kind: 'payload-source-color-override',
				color,
				reason:
					'Experiment isolates the Algorithm32 output effect of removing the inherited flat-app RGB source tint from local source spectral scale.',
			},
			provenance: {
				...(caseConfig.sourcePacket.provenance || {}),
				sourceColorOverride: {
					kind: 'payload-source-color-override',
					color,
					reason:
						'Experiment isolates the Algorithm32 output effect of removing the inherited flat-app RGB source tint from local source spectral scale.',
				},
			},
		},
	};
}

function normalizeSourceColorOverride(sourceColorOverride) {
	const color = {
		r: Number(sourceColorOverride.r),
		g: Number(sourceColorOverride.g),
		b: Number(sourceColorOverride.b),
	};
	if (
		!Number.isFinite(color.r) ||
		!Number.isFinite(color.g) ||
		!Number.isFinite(color.b)
	) {
		return null;
	}
	return color;
}

async function renderThreeTerrainIntegratedCasePair({
	caseConfig,
	terrainSpec,
	width,
	height,
	renderWidth,
	renderHeight,
	rendererAntialias,
	enableShadows,
	shadowMapSize,
	shadowPolicy,
	cameraOverride,
	cachePayload,
	sourceMatrixContext,
	displayPayload,
}) {
	const renderCanvas = document.createElement('canvas');
	const sceneSetup = createMountainLitScene(renderCanvas, {
		width: renderWidth,
		height: renderHeight,
		antialias: rendererAntialias,
		mountainView: caseConfig.mountainView,
		sourcePacket: caseConfig.sourcePacket,
		geometryPacket: caseConfig.geometryPacket,
		sceneDetailSpec: terrainSpec,
		sourceMatrixContext,
		enableShadows,
		shadowMapSize,
		shadowPolicy,
		cameraOverride,
	});
	let sceneCapture = null;
	let sceneOnlyPixels = null;
	let shaderPixels = null;
	let rawSceneTargetSample = null;
	let shaderSceneTargetSample = null;
	let shaderPassDiagnostics = null;
	let webglRenderer = null;

	try {
		webglRenderer = webglRendererInfo(sceneSetup.renderer);
		sceneSetup.renderer.render(sceneSetup.scene, sceneSetup.camera);
		sceneOnlyPixels = captureCanvasImageData(renderCanvas, width, height);
		rawSceneTargetSample = Array.from(sceneOnlyPixels.data.slice(0, 16));
		sceneCapture = captureSceneCoverageSummary({
			captureId: caseConfig.id,
			sceneMode: 'local-lane-external-terrain-integrated-source-matrix-scene',
			width,
			height,
			camera: sceneSetup.camera,
			meshes: sceneSetup.meshes,
			sceneObjects: sceneSetup.sceneObjects,
			ground: sceneSetup.ground,
			sourcePacket: caseConfig.sourcePacket,
			sceneLightPacket: sceneSetup.sceneLightPacket,
			geometryPacket: caseConfig.geometryPacket,
			sceneDetailPacket: sceneSetup.sceneDetailPacket,
		});

		const passSetup = await createSourceMatrixAtmospherePass({
			renderer: sceneSetup.renderer,
			width: renderWidth,
			height: renderHeight,
			camera: sceneSetup.camera,
			caseConfig,
			cachePayload,
			displayPayload,
		});
		try {
			passSetup.pass.renderScene(sceneSetup.scene, sceneSetup.camera);
			shaderSceneTargetSample = Array.from(
				passSetup.pass.readSceneColorTargetTopLeft().slice(0, 16)
			);
			passSetup.pass.render({ camera: sceneSetup.camera });
			shaderPixels = captureCanvasImageData(renderCanvas, width, height);
			shaderPassDiagnostics = {
				mode: passSetup.mode,
				modeCode: threeNativePassModeCode(passSetup.mode),
				atmospherePassDisabled: false,
				localIncidentCache: passSetup.localIncidentCache,
				display: passSetup.display,
			};
		} finally {
			passSetup.dispose();
		}
	} finally {
		disposeSceneSetup(sceneSetup);
	}

	return {
		caseConfig,
		webglRenderer,
		withoutShader: buildSourceMatrixRenderResult({
			caseConfig,
			finalPixels: sceneOnlyPixels,
			sceneCapture,
			sceneTargetSample: rawSceneTargetSample,
			passDiagnostics: {
				mode: 'scene-only-no-atmosphere',
				modeCode: null,
				atmospherePassDisabled: true,
				localIncidentCache: null,
			},
			sceneLightPacket: sceneSetup.sceneLightPacket,
		}),
		withShader: buildSourceMatrixRenderResult({
			caseConfig,
			finalPixels: shaderPixels,
			sceneCapture,
			sceneTargetSample: shaderSceneTargetSample,
			passDiagnostics: shaderPassDiagnostics,
			sceneLightPacket: sceneSetup.sceneLightPacket,
		}),
	};
}

async function renderThreeTerrainIntegratedCase({
	caseConfig,
	terrainSpec,
	width,
	height,
	renderWidth,
	renderHeight,
	rendererAntialias,
	enableShadows,
	shadowMapSize,
	shadowPolicy,
	cameraOverride,
	atmospherePassDisabled,
	cachePayload,
}) {
	const renderCanvas = document.createElement('canvas');
	const sceneSetup = createMountainLitScene(renderCanvas, {
		width: renderWidth,
		height: renderHeight,
		antialias: rendererAntialias,
		mountainView: caseConfig.mountainView,
		sourcePacket: caseConfig.sourcePacket,
		geometryPacket: caseConfig.geometryPacket,
		sceneDetailSpec: terrainSpec,
		enableShadows,
		shadowMapSize,
		shadowPolicy,
		cameraOverride,
	});
	let sceneCapture = null;
	let finalPixels = null;
	let sceneTargetSample = null;
	let passDiagnostics = null;

	try {
		sceneSetup.renderer.render(sceneSetup.scene, sceneSetup.camera);
		const sceneOnlyPixels = captureCanvasImageData(renderCanvas, width, height);
		sceneCapture = captureSceneCoverageSummary({
			captureId: caseConfig.id,
			sceneMode: 'local-lane-external-terrain-integrated-source-matrix-scene',
			width,
			height,
			camera: sceneSetup.camera,
			meshes: sceneSetup.meshes,
			sceneObjects: sceneSetup.sceneObjects,
			ground: sceneSetup.ground,
			sourcePacket: caseConfig.sourcePacket,
			sceneLightPacket: sceneSetup.sceneLightPacket,
			geometryPacket: caseConfig.geometryPacket,
			sceneDetailPacket: sceneSetup.sceneDetailPacket,
		});
		if (atmospherePassDisabled) {
			sceneTargetSample = Array.from(sceneOnlyPixels.data.slice(0, 16));
			finalPixels = sceneOnlyPixels;
			passDiagnostics = {
				mode: 'scene-only-no-atmosphere',
				modeCode: null,
				atmospherePassDisabled: true,
				localIncidentCache: null,
			};
		} else {
			const passSetup = await createSourceMatrixAtmospherePass({
				renderer: sceneSetup.renderer,
				width: renderWidth,
				height: renderHeight,
				camera: sceneSetup.camera,
				caseConfig,
				cachePayload,
			});
			try {
				passSetup.pass.renderScene(sceneSetup.scene, sceneSetup.camera);
				sceneTargetSample = Array.from(
					passSetup.pass.readSceneColorTargetTopLeft().slice(0, 16)
				);
				passSetup.pass.render({ camera: sceneSetup.camera });
				finalPixels = captureCanvasImageData(renderCanvas, width, height);
				passDiagnostics = {
					mode: passSetup.mode,
					modeCode: threeNativePassModeCode(passSetup.mode),
					atmospherePassDisabled: false,
					localIncidentCache: passSetup.localIncidentCache,
				};
			} finally {
				passSetup.dispose();
			}
		}
	} finally {
		disposeSceneSetup(sceneSetup);
	}

	const selectedPixels = finalPixels
		? samplePixelsFromImageData(finalPixels, [
				{ id: 'upper-sky', x: Math.floor(width * 0.5), y: Math.floor(height * 0.16) },
				{ id: 'center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.5) },
				{ id: 'lower-center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.78) },
			])
		: [];
	const imageStats = finalPixels ? rgbaImageStats(finalPixels.data) : null;
	return {
		caseId: caseConfig.id,
		label: caseConfig.label,
		sourceFamily: caseConfig.sourceFamily,
		imageData: finalPixels,
		imageStats,
		selectedPixels,
		sceneCapture,
		sceneTargetSample,
		pass: passDiagnostics,
		sceneLightPacket: sceneSetup.sceneLightPacket,
		camera: sceneCapture?.camera || null,
	};
}

function buildSourceMatrixRenderResult({
	caseConfig,
	finalPixels,
	sceneCapture,
	sceneTargetSample,
	passDiagnostics,
	sceneLightPacket,
}) {
	const width = finalPixels?.width || WIDTH;
	const height = finalPixels?.height || HEIGHT;
	const selectedPixels = finalPixels
		? samplePixelsFromImageData(finalPixels, [
				{ id: 'upper-sky', x: Math.floor(width * 0.5), y: Math.floor(height * 0.16) },
				{ id: 'center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.5) },
				{ id: 'lower-center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.78) },
			])
		: [];
	const imageStats = finalPixels ? rgbaImageStats(finalPixels.data) : null;
	return {
		caseId: caseConfig.id,
		label: caseConfig.label,
		sourceFamily: caseConfig.sourceFamily,
		imageData: finalPixels,
		imageStats,
		selectedPixels,
		sceneCapture,
		sceneTargetSample,
		pass: passDiagnostics,
		sceneLightPacket,
		camera: sceneCapture?.camera || null,
	};
}

async function createSourceMatrixAtmospherePass({
	renderer,
	width,
	height,
	camera,
	caseConfig,
	cachePayload,
	displayPayload,
}) {
	return createAlgorithm32PocAtmospherePass({
		renderer,
		width,
		height,
		camera,
		sourcePacket: caseConfig.sourcePacket,
		geometryPacket: caseConfig.geometryPacket,
		cachePayload,
		displayPayload,
		maxDistanceMeters:
			caseConfig.sourceFamily === 'flat-local-point-sun'
				? caseConfig.geometryPacket.sceneSkyRayLimitMeters || 20000000
				: MOUNTAIN_RIDGE_SCENE.farMeters,
		distantMaxDistanceMeters: MOUNTAIN_RIDGE_SCENE.farMeters,
	});
}

function composeSourceMatrixGallery({
	casePairs,
	width,
	height,
	galleryMode = 'with-without-side-by-side',
}) {
	if (galleryMode === 'with-shader-vertical') {
		return composeSourceMatrixWithShaderVerticalGallery({
			casePairs,
			width,
			height,
		});
	}
	if (galleryMode === LOCAL_DISTANT_TIME_ALIGNED_GALLERY_MODE) {
		return composeSourceMatrixLocalDistantTimeAlignedGallery({
			casePairs,
			width,
			height,
		});
	}
	if (galleryMode === DISTANT_LOCAL_DAYLIGHT_GALLERY_MODE) {
		return composeSourceMatrixDistantLocalDaylightGallery({
			casePairs,
			width,
			height,
		});
	}
	return composeSourceMatrixWithWithoutGallery({ casePairs, width, height });
}

function composeSourceMatrixWithWithoutGallery({ casePairs, width, height }) {
	const labelHeight = 62;
	const rowHeight = height + labelHeight;
	const canvas = document.createElement('canvas');
	canvas.width = width * 2;
	canvas.height = rowHeight * casePairs.length;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	context.fillStyle = '#111827';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.textBaseline = 'alphabetic';
	for (let rowIndex = 0; rowIndex < casePairs.length; rowIndex += 1) {
		const pair = casePairs[rowIndex];
		const rowY = rowIndex * rowHeight;
		context.fillStyle = '#111827';
		context.fillRect(0, rowY, canvas.width, rowHeight);
		context.fillStyle = '#f9fafb';
		context.font = '24px Arial, sans-serif';
		context.fillText(sourceMatrixCaseHeader(pair.caseConfig), 24, rowY + 28);
		context.font = '18px Arial, sans-serif';
		context.fillText('Without shader: raw Three scene color', 24, rowY + 52);
		context.fillText('With shader: Algorithm32 atmosphere', width + 24, rowY + 52);
		context.putImageData(pair.withoutShader.imageData, 0, rowY + labelHeight);
		context.putImageData(pair.withShader.imageData, width, rowY + labelHeight);
	}
	return {
		canvas,
		layout:
			'one row per requested case; without shader on the left, with Algorithm32 shader on the right',
	};
}

function composeSourceMatrixWithShaderVerticalGallery({
	casePairs,
	width,
	height,
}) {
	const labelHeight = 62;
	const rowHeight = height + labelHeight;
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = rowHeight * casePairs.length;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	context.fillStyle = '#111827';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.textBaseline = 'alphabetic';
	for (let rowIndex = 0; rowIndex < casePairs.length; rowIndex += 1) {
		const pair = casePairs[rowIndex];
		const rowY = rowIndex * rowHeight;
		context.fillStyle = '#111827';
		context.fillRect(0, rowY, canvas.width, rowHeight);
		context.fillStyle = '#f9fafb';
		context.font = '24px Arial, sans-serif';
		context.fillText(sourceMatrixCaseHeader(pair.caseConfig), 24, rowY + 28);
		context.font = '18px Arial, sans-serif';
		context.fillText('With shader: Algorithm32 atmosphere', 24, rowY + 52);
		context.putImageData(pair.withShader.imageData, 0, rowY + labelHeight);
	}
	return {
		canvas,
		layout:
			'one row per requested case; integrated Algorithm32 shader image only',
	};
}

function composeSourceMatrixLocalDistantTimeAlignedGallery({
	casePairs,
	width,
	height,
}) {
	const labelHeight = 86;
	const rowHeight = height + labelHeight;
	const canvas = document.createElement('canvas');
	canvas.width = width * 2;
	canvas.height = rowHeight * casePairs.length;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	context.fillStyle = '#111827';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.textBaseline = 'alphabetic';
	for (let rowIndex = 0; rowIndex < casePairs.length; rowIndex += 1) {
		const pair = casePairs[rowIndex];
		const distantPair = pair.pairedDistant;
		const rowY = rowIndex * rowHeight;
		context.fillStyle = '#111827';
		context.fillRect(0, rowY, canvas.width, rowHeight);
		context.fillStyle = '#f9fafb';
		context.font = '24px Arial, sans-serif';
		context.fillText(sourceMatrixCaseHeader(pair.caseConfig), 24, rowY + 28);
		context.font = '18px Arial, sans-serif';
		context.fillText(
			'Left: flat local Sun with integrated shader',
			24,
			rowY + 56
		);
		context.fillText(
			'Right: spherical distant Sun, same local time and camera',
			width + 24,
			rowY + 56
		);
		context.font = '15px Arial, sans-serif';
		context.fillStyle = '#cbd5e1';
		context.fillText(sourceMatrixCaseSubheader(pair.caseConfig), 24, rowY + 78);
		if (distantPair) {
			context.fillText(
				sourceMatrixCaseSubheader(distantPair.caseConfig),
				width + 24,
				rowY + 78
			);
		}
		context.putImageData(pair.withShader.imageData, 0, rowY + labelHeight);
		if (distantPair?.withShader?.imageData) {
			context.putImageData(
				distantPair.withShader.imageData,
				width,
				rowY + labelHeight
			);
		}
	}
	return {
		canvas,
		layout:
			'one row per requested local case; flat local integrated shader on the left, paired spherical distant integrated shader at the same local solar time on the right',
	};
}

function composeSourceMatrixDistantLocalDaylightGallery({
	casePairs,
	width,
	height,
}) {
	const labelHeight = 86;
	const rowHeight = height + labelHeight;
	const canvas = document.createElement('canvas');
	canvas.width = width * 2;
	canvas.height = rowHeight * casePairs.length;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	context.fillStyle = '#111827';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.textBaseline = 'alphabetic';
	for (let rowIndex = 0; rowIndex < casePairs.length; rowIndex += 1) {
		const pair = casePairs[rowIndex];
		const localPair = pair.pairedLocal;
		const rowY = rowIndex * rowHeight;
		context.fillStyle = '#111827';
		context.fillRect(0, rowY, canvas.width, rowHeight);
		context.fillStyle = '#f9fafb';
		context.font = '24px Arial, sans-serif';
		context.fillText(sourceMatrixCaseHeader(pair.caseConfig), 24, rowY + 28);
		context.font = '18px Arial, sans-serif';
		context.fillText(
			'Left: spherical distant Sun with integrated shader',
			24,
			rowY + 56
		);
		context.fillText(
			'Right: flat local Sun, same solar time and camera',
			width + 24,
			rowY + 56
		);
		context.font = '15px Arial, sans-serif';
		context.fillStyle = '#cbd5e1';
		context.fillText(sourceMatrixCaseSubheader(pair.caseConfig), 24, rowY + 78);
		if (localPair) {
			context.fillText(
				sourceMatrixCaseSubheader(localPair.caseConfig),
				width + 24,
				rowY + 78
			);
		}
		context.putImageData(pair.withShader.imageData, 0, rowY + labelHeight);
		if (localPair?.withShader?.imageData) {
			context.putImageData(
				localPair.withShader.imageData,
				width,
				rowY + labelHeight
			);
		}
	}
	return {
		canvas,
		layout:
			'one row per evenly spaced daylight sample; spherical distant integrated shader on the left, paired flat local integrated shader at the same solar time on the right',
	};
}

function sourceMatrixCaseHeader(caseConfig) {
	const localTimeLabel = caseConfig.localSolarTime?.label;
	if (!localTimeLabel) {
		return caseConfig.label;
	}
	return `${caseConfig.label} | local solar time ${localTimeLabel}`;
}

function sourceMatrixCaseSubheader(caseConfig) {
	const dateLabel = caseConfig.workingDateLabel;
	const sourceLabel = caseConfig.sourceFamily === 'flat-local-point-sun'
		? 'flat local'
		: 'spherical distant';
	const skyLabel = sourceSkyPositionLabel(caseConfig.sourcePacket);
	const timeLabel = caseConfig.localSolarTime?.label
		? `local solar time ${caseConfig.localSolarTime.label}`
		: null;
	return [sourceLabel, skyLabel, dateLabel, timeLabel].filter(Boolean).join(' | ');
}

function sourceSkyPositionLabel(sourcePacket) {
	const skyPosition = sourcePacket?.skyPosition;
	if (!skyPosition) {
		return null;
	}
	return `az ${formatOneDecimal(skyPosition.azimuthDegrees)} deg | alt ${formatOneDecimal(skyPosition.altitudeDegrees)} deg`;
}

function sourceMatrixSelectedPixels({ casePairs, galleryMode }) {
	if (galleryMode === 'with-shader-vertical') {
		return casePairs.flatMap((pair) =>
			withCasePrefix(
				pair.caseConfig.id,
				'with-shader',
				pair.withShader.selectedPixels
			)
		);
	}
	if (galleryMode === LOCAL_DISTANT_TIME_ALIGNED_GALLERY_MODE) {
		return casePairs.flatMap((pair) => [
			...withCasePrefix(
				pair.caseConfig.id,
				'local-with-shader',
				pair.withShader.selectedPixels
			),
			...(pair.pairedDistant
				? withCasePrefix(
						pair.pairedDistant.caseConfig.id,
						'distant-with-shader',
						pair.pairedDistant.withShader.selectedPixels
					)
				: []),
		]);
	}
	if (galleryMode === DISTANT_LOCAL_DAYLIGHT_GALLERY_MODE) {
		return casePairs.flatMap((pair) => [
			...withCasePrefix(
				pair.caseConfig.id,
				'distant-with-shader',
				pair.withShader.selectedPixels
			),
			...(pair.pairedLocal
				? withCasePrefix(
						pair.pairedLocal.caseConfig.id,
						'local-with-shader',
						pair.pairedLocal.withShader.selectedPixels
					)
				: []),
		]);
	}
	return casePairs.flatMap((pair) => [
		...withCasePrefix(
			pair.caseConfig.id,
			'without-shader',
			pair.withoutShader.selectedPixels
		),
		...withCasePrefix(
			pair.caseConfig.id,
			'with-shader',
			pair.withShader.selectedPixels
		),
	]);
}

function sourceMatrixCriteria({ casePairs, expectedCaseIds = SUBJECTIVE_SOURCE_MATRIX_CASE_IDS }) {
	const expectedCases = new Set(expectedCaseIds);
	const presentCases = new Set(casePairs.map((pair) => pair.caseConfig.id));
	const missingCases = [...expectedCases].filter((id) => !presentCases.has(id));
	const criteria = [
		{
			criterionId: 'source-matrix-requested-cases-present',
			status: missingCases.length === 0 ? 'pass' : 'fail',
			tolerance: [...expectedCases].join(', '),
			measuredError: { missingCases, presentCases: [...presentCases] },
			sourceOrStatus: 'three-terrain-integrated-source-matrix',
			notes:
				'The subjective source matrix should include every case requested by this command. Full-matrix commands request the configured rows; split commands request one row at a time.',
		},
	];
	for (const pair of casePairs) {
		criteria.push(...sourceMatrixCaseCriteria(pair));
		if (pair.pairedDistant) {
			criteria.push(...sourceMatrixCaseCriteria(pair.pairedDistant));
			criteria.push(sourceMatrixCameraDirectionCriteria(pair));
		}
		if (pair.pairedLocal) {
			criteria.push(...sourceMatrixCaseCriteria(pair.pairedLocal));
			criteria.push(sourceMatrixCameraDirectionCriteria(pair));
		}
	}
	return criteria;
}

function sourceMatrixCaseCriteria(pair) {
	const caseId = pair.caseConfig.id;
	const withShader = pair.withShader;
	const withoutShader = pair.withoutShader;
	const expectedMode =
		pair.caseConfig.sourceFamily === 'flat-local-point-sun'
			? 'flat-local-second-order-atmosphere'
			: 'distant-first-order-atmosphere';
	return [
		{
			criterionId: `${caseId}-without-shader-finite-nonblank`,
			status:
				withoutShader.imageStats?.nonfiniteValues === 0 &&
				withoutShader.imageStats?.maxByte > withoutShader.imageStats?.minByte
					? 'pass'
					: 'fail',
			tolerance: 'finite nonblank raw Three image',
			measuredError: withoutShader.imageStats,
			sourceOrStatus: 'three-terrain-integrated-source-matrix',
			notes: 'The no-shader side should render a usable raw Three scene image.',
		},
		{
			criterionId: `${caseId}-with-shader-finite-nonblank`,
			status:
				withShader.imageStats?.nonfiniteValues === 0 &&
				withShader.imageStats?.maxByte > withShader.imageStats?.minByte
					? 'pass'
					: 'fail',
			tolerance: 'finite nonblank Algorithm32 atmosphere image',
			measuredError: withShader.imageStats,
			sourceOrStatus: 'three-terrain-integrated-source-matrix',
			notes: 'The shader side should render a usable Algorithm32 atmosphere image.',
		},
		{
			criterionId: `${caseId}-shader-mode-expected`,
			status: withShader.pass?.mode === expectedMode ? 'pass' : 'fail',
			tolerance: expectedMode,
			measuredError: withShader.pass?.mode || null,
			sourceOrStatus: 'three-terrain-integrated-source-matrix',
			notes:
				'Each source family must use its matching integrated shader mode, with local cases using local L2 cache mode.',
		},
		{
			criterionId: `${caseId}-scene-has-sky-and-hit-pixels`,
			status:
				withShader.sceneCapture?.counts?.skyPixels > 0 &&
				withShader.sceneCapture?.counts?.hitPixels > 0
					? 'pass'
					: 'fail',
			tolerance: 'at least one sky pixel and one terrain hit pixel',
			measuredError: withShader.sceneCapture?.counts || null,
			sourceOrStatus: 'three-terrain-integrated-source-matrix',
			notes:
				'Each subjective view should include both atmosphere-only rays and terrain rays.',
		},
		{
			criterionId: `${caseId}-local-cache-present-when-needed`,
			status:
				pair.caseConfig.sourceFamily !== 'flat-local-point-sun' ||
				withShader.pass?.localIncidentCache?.entries > 0
					? 'pass'
					: 'fail',
			tolerance: 'local cases have packed local incident cache; distant cases not applicable',
			measuredError: withShader.pass?.localIncidentCache || null,
			sourceOrStatus: 'three-terrain-integrated-source-matrix',
			notes:
				'Local subjective shader rows must use the accepted local incident cache path.',
		},
	];
}

function sourceMatrixCameraDirectionCriteria(pair) {
	const paired = pair.pairedDistant || pair.pairedLocal;
	const localCamera = pair.withShader?.camera;
	const pairedCamera = paired?.withShader?.camera;
	const localRays = pair.withShader?.sceneCapture?.selectedPixels || [];
	const pairedRays = paired?.withShader?.sceneCapture?.selectedPixels || [];
	const maxAbsCameraDelta = maxAbsCameraScalarDelta(localCamera, pairedCamera);
	const maxAbsRayDirectionDelta = maxAbsSelectedRayDirectionDelta(
		localRays,
		pairedRays
	);
	return {
		criterionId: `${pair.caseConfig.id}-paired-camera-matches`,
		status:
			maxAbsCameraDelta !== null &&
			maxAbsCameraDelta <= 1e-9 &&
			maxAbsRayDirectionDelta !== null &&
			maxAbsRayDirectionDelta <= 1e-9
				? 'pass'
				: 'fail',
		tolerance: 'same camera scalar fields and selected ray directions within 1e-9',
		measuredError: {
			maxAbsCameraDelta,
			maxAbsRayDirectionDelta,
			primaryCaseId: pair.caseConfig.id,
			pairedCaseId: paired?.caseConfig?.id || null,
		},
		sourceOrStatus: 'three-terrain-integrated-source-matrix',
		notes:
			'The paired spherical distant image must use the same camera direction and pose as the local Sun image.',
	};
}

function maxAbsCameraScalarDelta(left, right) {
	if (!left || !right) {
		return null;
	}
	const leftValues = [
		...(left.positionMeters || []),
		left.verticalFovDegrees,
		left.aspect,
		left.near,
		left.far,
	];
	const rightValues = [
		...(right.positionMeters || []),
		right.verticalFovDegrees,
		right.aspect,
		right.near,
		right.far,
	];
	return maxAbsArrayDelta(leftValues, rightValues);
}

function maxAbsSelectedRayDirectionDelta(leftRays, rightRays) {
	if (leftRays.length !== rightRays.length || leftRays.length === 0) {
		return null;
	}
	let maxDelta = 0;
	for (let index = 0; index < leftRays.length; index += 1) {
		const left = leftRays[index]?.threeRay?.direction || [];
		const right = rightRays[index]?.threeRay?.direction || [];
		const delta = maxAbsArrayDelta(left, right);
		if (delta === null) {
			return null;
		}
		maxDelta = Math.max(maxDelta, delta);
	}
	return maxDelta;
}

function maxAbsArrayDelta(left, right) {
	if (left.length !== right.length || left.length === 0) {
		return null;
	}
	let maxDelta = 0;
	for (let index = 0; index < left.length; index += 1) {
		const leftValue = Number(left[index]);
		const rightValue = Number(right[index]);
		if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
			return null;
		}
		maxDelta = Math.max(maxDelta, Math.abs(leftValue - rightValue));
	}
	return maxDelta;
}

function serializeSourceMatrixCase(pair) {
	return {
		id: pair.caseConfig.id,
		label: pair.caseConfig.label,
		sourceFamily: pair.caseConfig.sourceFamily,
		localSolarTime: pair.caseConfig.localSolarTime || null,
		workingDateLabel: pair.caseConfig.workingDateLabel || null,
		solarTimeAlignment: pair.caseConfig.solarTimeAlignment || null,
		viewPolicyOverride: pair.caseConfig.viewPolicyOverride || null,
		webglRenderer: pair.webglRenderer,
		withoutShader: serializeSourceMatrixRender(pair.withoutShader),
		withShader: serializeSourceMatrixRender(pair.withShader),
		pairedDistant: pair.pairedDistant
			? serializeSourceMatrixCase(pair.pairedDistant)
			: null,
		pairedLocal: pair.pairedLocal
			? serializeSourceMatrixCase(pair.pairedLocal)
			: null,
	};
}

function serializeSourceMatrixRender(render) {
	return {
		caseId: render.caseId,
		label: render.label,
		sourceFamily: render.sourceFamily,
		pass: render.pass,
		imageStats: render.imageStats,
		selectedPixels: render.selectedPixels,
		sceneLightPacket: render.sceneLightPacket,
		camera: render.camera,
		sceneCapture: {
			counts: render.sceneCapture?.counts || null,
			hitDistanceMetersSummary:
				render.sceneCapture?.hitDistanceMetersSummary || null,
			selectedPixels: render.sceneCapture?.selectedPixels || [],
			sceneDetail: render.sceneCapture?.sceneDetail || null,
		},
		sceneTargetSample: render.sceneTargetSample,
	};
}

function withCasePrefix(caseId, side, selectedPixels) {
	return selectedPixels.map((pixel) => ({
		...pixel,
		id: `${caseId}-${side}-${pixel.id}`,
		caseId,
		side,
	}));
}

function webglRendererInfo(renderer) {
	try {
		const gl = renderer.getContext();
		const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
		return {
			vendor: debugInfo
				? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
				: gl.getParameter(gl.VENDOR),
			renderer: debugInfo
				? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
				: gl.getParameter(gl.RENDERER),
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function normalizeInterCaseYieldMs(value) {
	if (value === false) {
		return 0;
	}
	const number = value === undefined ? 50 : Number(value);
	if (!Number.isFinite(number) || number < 0) {
		return 50;
	}
	return Math.min(number, 5000);
}

function yieldToBrowser(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function drawRenderCanvasToDisplayCanvas({ renderCanvas, displayCanvas, width, height }) {
	displayCanvas.width = width;
	displayCanvas.height = height;
	const context = displayCanvas.getContext('2d', { willReadFrequently: true });
	context.clearRect(0, 0, width, height);
	context.drawImage(renderCanvas, 0, 0, width, height);
}

function sourceMatrixTemporalContextFromPayload(payload = {}) {
	return createLocalSunTemporalContextFromPayload(payload, {
		solsticeGalleryModes: [
			LOCAL_DISTANT_TIME_ALIGNED_GALLERY_MODE,
			DISTANT_LOCAL_DAYLIGHT_GALLERY_MODE,
		],
	});
}

function localSolarTimeForOffsetDegrees(offsetDegrees, context) {
	return pocLocalSolarTimeForOffsetDegrees(offsetDegrees, context);
}

function workingDateLabelFromTime(time) {
	const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(time || ''));
	return match ? match[1] : String(time || '');
}

function sourceMatrixCaseConfigsFromPayload({
	payload,
	sourceMatrixContext,
}) {
	if (payload.galleryMode === DISTANT_LOCAL_DAYLIGHT_GALLERY_MODE) {
		return daylightDistantCaseConfigs({
			sourceMatrixContext,
			sampleCount: finiteNumberOrNull(payload.daylightSampleCount) || 5,
		});
	}
	const caseIds = Array.isArray(payload.cases) && payload.cases.length > 0
		? payload.cases
		: SUBJECTIVE_SOURCE_MATRIX_CASE_IDS;
	return caseIds.map((caseId) =>
		subjectiveCaseConfig(caseId, sourceMatrixContext)
	);
}

function daylightDistantCaseConfigs({
	sourceMatrixContext,
	sampleCount = 5,
}) {
	return daylightSolarSamples({ sourceMatrixContext, sampleCount }).map(
		(sample) => {
			const sunCase = makeTimeAlignedDistantSunCase({
				offsetDegrees: sample.offsetDegrees,
				sourceMatrixContext,
				daylightSample: sample,
			});
			return {
				id: `distant-${sample.id}`,
				label: `${sample.label} distant Sun`,
				sourceFamily: 'distant-directional-sun',
				mountainView: MOUNTAIN_VIEW_MODES.distantSunsetCentered,
				sourcePacket: makeDistantSunSourcePacket(sunCase),
				geometryPacket: makeSphericalAtmosphereGeometryPacket(),
				localSolarTime: sample.localSolarTime,
				workingDateLabel: sourceMatrixContext.workingDateLabel,
				solarTimeAlignment: sourceMatrixContext,
				daylightSample: sample,
			};
		}
	);
}

function daylightSolarSamples({ sourceMatrixContext, sampleCount }) {
	const count = Math.max(2, Math.round(sampleCount));
	const sunriseSunset = sphericalSunriseSunsetHourAngle(sourceMatrixContext);
	const sunriseOffset = -sunriseSunset.hourAngleDegrees;
	const sunsetOffset = sunriseSunset.hourAngleDegrees;
	const samples = [];
	for (let index = 0; index < count; index += 1) {
		const t = count === 1 ? 0.5 : index / (count - 1);
		const offsetDegrees = interpolate(sunriseOffset, sunsetOffset, t);
		const event =
			index === 0
				? 'sunrise'
				: index === count - 1
					? 'sunset'
					: Math.abs(offsetDegrees) < 1e-9
						? 'solar-noon'
						: offsetDegrees < 0
							? 'morning'
							: 'afternoon';
		const localSolarTime = localSolarTimeForOffsetDegrees(
			offsetDegrees,
			sourceMatrixContext
		);
		samples.push({
			kind: 'spherical-daylight-sample',
			id: `${String(index + 1).padStart(2, '0')}-${event}`,
			label: daylightSampleLabel(event),
			index,
			count,
			daylightFraction: t,
			offsetDegrees,
			hourAngleDegrees: offsetDegrees,
			localSolarTime,
			sunriseSunset,
		});
	}
	return samples;
}

function daylightSampleLabel(event) {
	if (event === 'solar-noon') {
		return 'Solar noon';
	}
	return event
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function sphericalSunriseSunsetHourAngle(sourceMatrixContext) {
	const latitudeDeg = DEFAULT_FLAT_SIMULATION_ROOT.lat;
	const declinationDeg = falseSunLatitudeDegreesForTime(
		sourceMatrixContext.flatSimulationTime
	);
	const latRad = degreesToRadians(latitudeDeg);
	const decRad = degreesToRadians(declinationDeg);
	const apparentSunriseAltitudeRad = degreesToRadians(-0.833);
	const cosHourAngle =
		(Math.sin(apparentSunriseAltitudeRad) -
			Math.sin(latRad) * Math.sin(decRad)) /
		(Math.cos(latRad) * Math.cos(decRad));
	const hourAngleDegrees = radiansToDegrees(
		Math.acos(Math.max(-1, Math.min(1, cosHourAngle)))
	);
	return {
		kind: 'spherical-sunrise-sunset-hour-angle',
		latitudeDeg,
		declinationDeg,
		apparentSunriseAltitudeDeg: -0.833,
		hourAngleDegrees,
		daylightDurationHours: (2 * hourAngleDegrees) / 15,
	};
}

function subjectiveCaseConfig(caseId, sourceMatrixContext = sourceMatrixTemporalContextFromPayload()) {
	const normalizedCaseId = normalizeSubjectiveCaseId(caseId);
	if (normalizedCaseId === 'distant-sunset-behind-camera') {
		return {
			id: normalizedCaseId,
			label: 'Distant sunset behind camera',
			sourceFamily: 'distant-directional-sun',
			mountainView: MOUNTAIN_VIEW_MODES.sunsetBehindCamera,
			sourcePacket: makeDistantSunSourcePacket(LOW_SUN_CASE),
			geometryPacket: makeSphericalAtmosphereGeometryPacket(),
			workingDateLabel: sourceMatrixContext.workingDateLabel,
		};
	}
	if (normalizedCaseId === 'local-closest') {
		const localSolarTime = localSolarTimeForOffsetDegrees(
			0,
			sourceMatrixContext
		);
		return {
			id: normalizedCaseId,
			label: 'Local closest approach',
			sourceFamily: 'flat-local-point-sun',
			mountainView: MOUNTAIN_VIEW_MODES.frontHighSun,
			sourcePacket: makeFlatLocalSunSourcePacket(0, sourceMatrixContext),
			geometryPacket: makeFlatAtmosphereGeometryPacket(),
			localSolarTime,
			workingDateLabel: sourceMatrixContext.workingDateLabel,
			solarTimeAlignment: sourceMatrixContext,
		};
	}
	if (
		normalizedCaseId === 'local-045deg' ||
		normalizedCaseId === 'local-090deg' ||
		normalizedCaseId === 'local-135deg' ||
		normalizedCaseId === 'local-180deg'
	) {
		const offsetDegrees = Number(normalizedCaseId.match(/local-(\d+)deg/)?.[1]);
		return localOrbitSubjectiveCaseConfig({
			caseId: normalizedCaseId,
			offsetDegrees,
			sourceMatrixContext,
		});
	}
	return {
		id: 'distant-midday',
		label: 'Distant midday',
		sourceFamily: 'distant-directional-sun',
		mountainView: MOUNTAIN_VIEW_MODES.frontHighSun,
		sourcePacket: makeDistantSunSourcePacket(HIGH_SUN_CASE),
		geometryPacket: makeSphericalAtmosphereGeometryPacket(),
		workingDateLabel: sourceMatrixContext.workingDateLabel,
	};
}

function normalizeSubjectiveCaseId(caseId) {
	if (caseId === 'local-45deg' || caseId === 'local-45') {
		return 'local-045deg';
	}
	if (caseId === 'local-90deg' || caseId === 'local-90') {
		return 'local-090deg';
	}
	if (caseId === 'local-045') {
		return 'local-045deg';
	}
	if (caseId === 'local-135') {
		return 'local-135deg';
	}
	if (caseId === 'local-180') {
		return 'local-180deg';
	}
	return caseId;
}

function localOrbitSubjectiveCaseConfig({
	caseId,
	offsetDegrees,
	sourceMatrixContext = sourceMatrixTemporalContextFromPayload(),
}) {
	const localSolarTime = localSolarTimeForOffsetDegrees(
		offsetDegrees,
		sourceMatrixContext
	);
	return {
		id: caseId,
		label: `Local ${offsetDegrees} degree forward-time orbit`,
		sourceFamily: 'flat-local-point-sun',
		mountainView: MOUNTAIN_VIEW_MODES.localToward180Sun,
		sourcePacket: makeFlatLocalSunSourcePacket(
			offsetDegrees,
			sourceMatrixContext
		),
		geometryPacket: makeFlatAtmosphereGeometryPacket(),
		localSolarTime,
		workingDateLabel: sourceMatrixContext.workingDateLabel,
		solarTimeAlignment: sourceMatrixContext,
	};
}

function makeDistantSunSourcePacket(sunCase) {
	const skyPosition = distantSunSkyPosition(sunCase);
	return {
		kind: 'distant-directional-sun',
		sunCase: sunCase.id,
		sunDirection: sunCase.sunDirection || sunDirection(sunCase),
		sourceTimeOfDay: sunCase.sourceTimeOfDay,
		sourceSunZenithDegrees: sunCase.sourceSunZenithDegrees,
		sunAltitudeDegrees: sunCase.sunAltitudeDegrees,
		sunAzimuthDegrees: sunCase.sunAzimuthDegrees,
		skyPosition,
		localSolarTime: sunCase.localSolarTime || null,
		workingDateLabel: sunCase.workingDateLabel || null,
		provenance: sunCase.provenance || null,
	};
}

function distantSunSkyPosition(sunCase) {
	const geographicAzimuthDegrees =
		sunCase.provenance?.localGeographicAzimuthDegrees ??
		normalizeDegrees(90 - (Number(sunCase.sunAzimuthDegrees) || 0));
	return {
		kind: 'local-sky-position',
		azimuthDegrees: geographicAzimuthDegrees,
		altitudeDegrees: Number(sunCase.sunAltitudeDegrees) || 0,
		azimuthConvention:
			'degrees clockwise from local north in the spherical observer sky',
	};
}

function timeAlignedDistantCaseConfigForLocalCase({
	localCaseConfig,
	sourceMatrixContext,
}) {
	const offsetDegrees = localCaseConfig.sourcePacket?.offsetDegrees ?? 0;
	const sunCase = makeTimeAlignedDistantSunCase({
		offsetDegrees,
		sourceMatrixContext,
	});
	return {
		id: `${localCaseConfig.id}-spherical-distant-same-time`,
		label: `Spherical distant Sun at ${sunCase.localSolarTime.label}`,
		sourceFamily: 'distant-directional-sun',
		mountainView: localCaseConfig.mountainView,
		sourcePacket: makeDistantSunSourcePacket(sunCase),
		geometryPacket: makeSphericalAtmosphereGeometryPacket(),
		localSolarTime: sunCase.localSolarTime,
		workingDateLabel: sourceMatrixContext.workingDateLabel,
		solarTimeAlignment: sourceMatrixContext,
		pairedWithCaseId: localCaseConfig.id,
		viewPolicyOverride: {
			kind: 'match-local-case-camera',
			pairedWithCaseId: localCaseConfig.id,
			reason:
				'The spherical distant comparison column uses the same mountain view id and temporal context as its local Sun row.',
		},
	};
}

function timeAlignedLocalCaseConfigForDistantCase({
	distantCaseConfig,
	sourceMatrixContext,
}) {
	const offsetDegrees =
		distantCaseConfig.daylightSample?.offsetDegrees ??
		distantCaseConfig.sourcePacket?.provenance?.hourAngleDegrees ??
		0;
	const localSolarTime = localSolarTimeForOffsetDegrees(
		offsetDegrees,
		sourceMatrixContext
	);
	return {
		id: `${distantCaseConfig.id}-flat-local-same-time`,
		label: `Flat local Sun at ${localSolarTime.label}`,
		sourceFamily: 'flat-local-point-sun',
		mountainView: distantCaseConfig.mountainView,
		sourcePacket: makeFlatLocalSunSourcePacket(
			offsetDegrees,
			sourceMatrixContext
		),
		geometryPacket: makeFlatAtmosphereGeometryPacket(),
		localSolarTime,
		workingDateLabel: sourceMatrixContext.workingDateLabel,
		solarTimeAlignment: sourceMatrixContext,
		pairedWithCaseId: distantCaseConfig.id,
		daylightSample: distantCaseConfig.daylightSample || null,
		viewPolicyOverride: {
			kind: 'match-distant-case-camera',
			pairedWithCaseId: distantCaseConfig.id,
			reason:
				'The flat local comparison column uses the same mountain view id and temporal context as its spherical distant row.',
		},
	};
}

function makeTimeAlignedDistantSunCase({
	offsetDegrees,
	sourceMatrixContext,
	daylightSample = null,
}) {
	const localSolarTime = localSolarTimeForOffsetDegrees(
		offsetDegrees,
		sourceMatrixContext
	);
	const declinationDeg = falseSunLatitudeDegreesForTime(
		sourceMatrixContext.flatSimulationTime
	);
	const pose = sphericalSolarPoseForHourAngle({
		latitudeDeg: DEFAULT_FLAT_SIMULATION_ROOT.lat,
		declinationDeg,
		hourAngleDeg: offsetDegrees,
	});
	const sourceTimeOfDay = localSolarTime.label.replace(' +1d', '');
	return {
		id: `spherical-distant-${sourceDateKeyFromTime(sourceMatrixContext.flatSimulationTime)}-${rotationOffsetLabel(offsetDegrees)}-solar-time`,
		sourceTimeOfDay,
		sourceSunZenithDegrees: 90 - pose.altitudeDeg,
		sunAltitudeDegrees: pose.altitudeDeg,
		sunAzimuthDegrees: pose.algorithmAzimuthDeg,
		localSolarTime,
		workingDateLabel: sourceMatrixContext.workingDateLabel,
		provenance: {
			kind: 'spherical-distant-sun-solar-time-match',
			observerLatitudeDegrees: DEFAULT_FLAT_SIMULATION_ROOT.lat,
			observerLongitudeDegrees: DEFAULT_FLAT_SIMULATION_ROOT.lon,
			solarDeclinationDegrees: declinationDeg,
			hourAngleDegrees: offsetDegrees,
			localGeographicAzimuthDegrees: pose.geographicAzimuthDeg,
			algorithmAzimuthDegrees: pose.algorithmAzimuthDeg,
			daylightSample,
			timeAlignment:
				'Spherical solar noon is used only as the clock sync anchor: solar-noon transit maps to flat local closest approach, and each row uses the same signed offset from that anchor for both source models.',
		},
	};
}

function sphericalSolarPoseForHourAngle({
	latitudeDeg,
	declinationDeg,
	hourAngleDeg,
}) {
	const latRad = degreesToRadians(latitudeDeg);
	const decRad = degreesToRadians(declinationDeg);
	const hourRad = degreesToRadians(hourAngleDeg);
	const sinAltitude =
		Math.sin(latRad) * Math.sin(decRad) +
		Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourRad);
	const altitudeDeg = radiansToDegrees(
		Math.asin(Math.max(-1, Math.min(1, sinAltitude)))
	);
	const geographicAzimuthDeg = normalizeDegrees(
		radiansToDegrees(
			Math.atan2(
				Math.sin(hourRad),
				Math.cos(hourRad) * Math.sin(latRad) -
					Math.tan(decRad) * Math.cos(latRad)
			)
		) + 180
	);
	const algorithmAzimuthDeg = normalizeDegrees(90 - geographicAzimuthDeg);
	return {
		altitudeDeg,
		geographicAzimuthDeg,
		algorithmAzimuthDeg,
	};
}

function makeSphericalAtmosphereGeometryPacket() {
	return {
		kind: 'spherical-atmosphere-geometry',
		threeToAlgorithmDirection: '[x, y, z] -> [x, -z, y]',
		threeToAlgorithmPosition: '[x, y, z] -> [x, -z, bottomRadiusMeters + y]',
	};
}

function makeFlatAtmosphereGeometryPacket() {
	return {
		kind: 'flat-z-up-atmosphere',
		observerPositionMeters: [0, 0, 2],
		topAltitudeMeters: 100000,
		sceneSkyRayLimitMeters: FLAT_SCENE_SKY_RAY_LIMIT_METERS,
		sceneSkyRayLimitPolicy:
			'accepted-062-flat-visibility-100-percent-lost-poc-default',
		threeToAlgorithmDirection: '[x, y, z] -> [x, -z, y]',
		threeToAlgorithmPosition: '[x, y, z] -> [x, -z, y]',
	};
}

function makeFlatLocalSunSourcePacket(
	offsetDegrees,
	sourceMatrixContext = sourceMatrixTemporalContextFromPayload()
) {
	return makePocFlatLocalSunSourcePacket(offsetDegrees, sourceMatrixContext);
}

function flatLocalSunSourceDefinition(
	offsetDegrees,
	sourceMatrixContext = sourceMatrixTemporalContextFromPayload()
) {
	return pocFlatLocalSunSourceDefinition(offsetDegrees, sourceMatrixContext);
}

function sourceDateKeyFromTime(time) {
	return workingDateLabelFromTime(time).replace(/[^0-9]/g, '') || 'undated';
}

function falseSunLatitudeDegreesForTime(time) {
	const northLimitDeg = FALSE_SUN_LATITUDE_MODEL.northLimitDeg;
	const southLimitDeg = FALSE_SUN_LATITUDE_MODEL.southLimitDeg;
	const amplitudeDeg = (northLimitDeg - southLimitDeg) / 2;
	const centerDeg = (northLimitDeg + southLimitDeg) / 2;
	const phase =
		(2 *
			Math.PI *
			(calendarDayOfYear(time) -
				FALSE_SUN_LATITUDE_MODEL.northernSolsticeDayOfYear)) /
		Math.max(FALSE_SUN_LATITUDE_MODEL.periodDays, 1);

	return centerDeg + amplitudeDeg * Math.cos(phase);
}

function calendarDayOfYear(time) {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(time));
	if (!match) {
		return FALSE_SUN_LATITUDE_MODEL.northernSolsticeDayOfYear;
	}
	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	const day = Number(match[3]);
	const start = Date.UTC(year, 0, 1);
	const current = Date.UTC(year, monthIndex, day);
	return Math.floor((current - start) / MS_PER_DAY) + 1;
}

function rotationOffsetLabel(degrees) {
	if (Math.abs(degrees) < 1e-9) {
		return '000deg-closest';
	}
	const sign = degrees < 0 ? 'minus' : 'plus';
	const magnitude = Math.abs(degrees).toFixed(3).replace('.', 'p');
	return `${sign}-${magnitude}deg-from-closest`;
}

function createMountainLitScene(canvas, options = {}) {
	canvas.width = options.width || WIDTH;
	canvas.height = options.height || HEIGHT;
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: options.antialias === true,
		preserveDrawingBuffer: true,
	});
	renderer.setSize(canvas.width, canvas.height, false);
	renderer.setPixelRatio(1);
	renderer.setClearColor(0x87a9d8, 1);
	if ('toneMapping' in renderer) {
		renderer.toneMapping = THREE.NoToneMapping;
	}
	const enableShadows = options.enableShadows === true;
	if (enableShadows) {
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	}

	const mountainView = mountainLitCameraConfig({
		mountainViewId: options.mountainView,
		sourcePacket: options.sourcePacket,
		sceneDetailSpec: options.sceneDetailSpec,
		sourceMatrixContext: options.sourceMatrixContext,
	});
	const sceneDetailSpec = sceneDetailSpecForMountainView({
		detailSpec: options.sceneDetailSpec,
		mountainViewId: options.mountainView,
		mountainView,
		sourceMatrixContext: options.sourceMatrixContext,
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
	const detailSetup = addDetailedMountainTerrain({
		scene,
		meshes,
		sceneObjects,
		detailSpec: sceneDetailSpec,
	});
	const cameraOverridePacket = applyMountainCameraOverride({
		camera,
		mountainView,
		meshes,
		override: options.cameraOverride,
	});
	const ambient = new THREE.AmbientLight(
		0xffffff,
		sceneDetailSpec?.ambientIntensity ?? 0.055
	);
	scene.add(ambient);
	const sceneLightPacket = sceneDetailSpec?.disableSourceLight
		? {
				kind: 'source-light-disabled-diagnostic',
				mode: options.sourcePacket?.kind || 'unknown',
				reason:
					'Diagnostic render disables the source-driven Three light to isolate ambient-only MeshStandardMaterial behavior.',
			}
		: addMountainSourceLight({
				scene,
				sourcePacket: options.sourcePacket,
				targetMeters: mountainView.lookAtMeters,
		enableShadows,
		shadowMapSize: options.shadowMapSize,
		sceneDetailSpec,
	});
	const shadowScenePacket = applyMountainShadowFlags({
		meshes,
		enabled: enableShadows,
		policy: options.shadowPolicy,
	});

	return {
		renderer,
		scene,
		camera,
		meshes,
		mountainView,
		cameraOverridePacket,
		sceneObjects,
		ground: detailSetup.ground,
		sceneDetailPacket: detailSetup.sceneDetailPacket,
		sceneLightPacket: {
			...sceneLightPacket,
			ambientIntensity: ambient.intensity,
			sceneShadowing: shadowScenePacket,
		},
	};
}

function applyMountainShadowFlags({ meshes, enabled, policy = null }) {
	let castShadowMeshCount = 0;
	let receiveShadowMeshCount = 0;
	const resolvedPolicy = enabled
		? policy || 'cast-and-receive'
		: 'disabled';
	const cast = enabled && resolvedPolicy !== 'receive-only';
	const receive = enabled;
	for (const mesh of meshes) {
		if (!mesh?.isMesh) {
			continue;
		}
		mesh.castShadow = cast;
		mesh.receiveShadow = receive;
		if (mesh.castShadow) {
			castShadowMeshCount += 1;
		}
		if (mesh.receiveShadow) {
			receiveShadowMeshCount += 1;
		}
	}
	return {
		enabled,
		policy: resolvedPolicy,
		description:
			resolvedPolicy === 'receive-only'
				? 'Terrain/catch-surface meshes receive Three shadow-map shadows but do not cast shadows, isolating self-shadow artifacts.'
				: enabled
					? 'All terrain/catch-surface meshes in the scene input list cast and receive Three shadow-map shadows.'
					: 'Three shadow-map shadows disabled for this scene.',
		castShadowMeshCount,
		receiveShadowMeshCount,
	};
}

function applyMountainCameraOverride({ camera, mountainView, meshes, override }) {
	if (!override || typeof override !== 'object') {
		return {
			enabled: false,
			reason: 'No camera override payload supplied.',
		};
	}
	const applied = {
		enabled: true,
		input: {
			cameraPositionMeters: vector3OrNull(override.cameraPositionMeters),
			lookAtMeters: vector3OrNull(override.lookAtMeters),
			verticalFovDegrees: finiteNumberOrNull(override.verticalFovDegrees),
			cameraGroundClearanceMeters: finiteNumberOrNull(
				override.cameraGroundClearanceMeters
			),
			lookAtGroundClearanceMeters: finiteNumberOrNull(
				override.lookAtGroundClearanceMeters
			),
		},
	};
	const cameraPosition =
		applied.input.cameraPositionMeters || [...mountainView.cameraPositionMeters];
	const lookAt = applied.input.lookAtMeters || [...mountainView.lookAtMeters];
	if (applied.input.cameraGroundClearanceMeters !== null) {
		const terrainHeight = terrainHeightAtXZ({
			meshes,
			x: cameraPosition[0],
			z: cameraPosition[2],
		});
		applied.cameraTerrainHeightMeters = terrainHeight;
		if (terrainHeight !== null) {
			cameraPosition[1] =
				terrainHeight + applied.input.cameraGroundClearanceMeters;
		}
	}
	if (applied.input.lookAtGroundClearanceMeters !== null) {
		const terrainHeight = terrainHeightAtXZ({
			meshes,
			x: lookAt[0],
			z: lookAt[2],
		});
		applied.lookAtTerrainHeightMeters = terrainHeight;
		if (terrainHeight !== null) {
			lookAt[1] = terrainHeight + applied.input.lookAtGroundClearanceMeters;
		}
	}
	if (applied.input.verticalFovDegrees !== null) {
		mountainView.verticalFovDegrees = applied.input.verticalFovDegrees;
		camera.fov = applied.input.verticalFovDegrees;
	}
	mountainView.cameraPositionMeters = cameraPosition;
	mountainView.lookAtMeters = lookAt;
	mountainView.description = `${mountainView.description || 'Mountain terrain view'}; payload camera override applied.`;
	camera.position.fromArray(cameraPosition);
	camera.lookAt(new THREE.Vector3(...lookAt));
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();
	applied.output = {
		cameraPositionMeters: [...cameraPosition],
		lookAtMeters: [...lookAt],
		verticalFovDegrees: camera.fov,
	};
	return applied;
}

function terrainHeightAtXZ({ meshes, x, z }) {
	const raycaster = new THREE.Raycaster(
		new THREE.Vector3(x, 200000, z),
		new THREE.Vector3(0, -1, 0),
		0,
		400000
	);
	const hits = raycaster.intersectObjects(meshes, false);
	const terrainHit = hits.find(
		(hit) => hit.object?.name !== 'detail-bottom-ground-plane'
	);
	const selected = terrainHit || hits[0] || null;
	return selected ? selected.point.y : null;
}

function vector3OrNull(value) {
	if (!Array.isArray(value) || value.length !== 3) {
		return null;
	}
	const vector = value.map((component) => Number(component));
	return vector.every(Number.isFinite) ? vector : null;
}

function finiteNumberOrNull(value) {
	if (value === null || value === undefined) {
		return null;
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
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
			bounds: detailSpec.bottomGround.bounds,
		});
	}

	const terrainSetup = detailedTerrainObject({
		meshSpec: detailSpec.floor,
		kind: 'ground',
	});
	const groundMesh = terrainSetup.mesh;
	scene.add(terrainSetup.object);
	meshes.push(groundMesh);
	for (const detailMesh of terrainSetup.detailMeshes || []) {
		meshes.push(detailMesh);
	}
	sceneObjects.push({
		id: detailSpec.floor.id,
		kind: detailSpec.floor.kind,
		spectrumId: detailSpec.floor.spectrumId,
		bounds: detailSpec.floor.bounds,
		vertexCount: detailSpec.floor.vertexCount,
		triangleCount: detailSpec.floor.triangleCount,
		topology: detailSpec.summary.meshTopology,
		detailMeshCount: terrainSetup.detailMeshes?.length || 0,
	});

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
			terrainBackend: detailSpec.terrainBackend,
			seed: detailSpec.seed,
			numericSeed: detailSpec.numericSeed,
			generatedBy: detailSpec.generatedBy,
			coordinateSystem: detailSpec.coordinateSystem,
			cameraProfile: detailSpec.cameraProfile || null,
			summary: {
				...detailSpec.summary,
				runtimeTerrainStats: terrainSetup.stats,
			},
		},
	};
}

function detailedBottomGroundMesh(groundSpec) {
	const geometry = new THREE.PlaneGeometry(
		groundSpec.widthMeters,
		groundSpec.depthMeters
	);
	const material = new THREE.MeshStandardMaterial({
		color: new THREE.Color(...groundSpec.color),
		roughness: groundSpec.material.roughness,
		metalness: groundSpec.material.metalness,
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

function detailedTerrainObject({ meshSpec, kind }) {
	if (meshSpec.backend === TERRAIN_BACKENDS.threeTerrainJs) {
		return detailedThreeTerrainObject({ meshSpec, kind });
	}
	if (
		meshSpec.backend === TERRAIN_BACKENDS.southernFranceObjGeometry ||
		meshSpec.backend === TERRAIN_BACKENDS.southernFranceObjDiffuse
	) {
		return detailedSouthernFranceObjObject({ meshSpec, kind });
	}
	const mesh = detailedTerrainMesh({ meshSpec, kind });
	return {
		object: mesh,
		mesh,
		stats: {
			backend: meshSpec.backend || TERRAIN_BACKENDS.manualHeightfield,
			sourceAsset: meshSpec.sourceAsset || null,
			heightmapSampling: meshSpec.heightmapSampling || null,
			vertexCount: meshSpec.vertexCount,
			triangleCount: meshSpec.triangleCount,
			bounds: meshSpec.bounds,
		},
	};
}

function detailedSouthernFranceObjObject({ meshSpec, kind }) {
	const sourceRoot = meshSpec.loadedObject.clone(true);
	sourceRoot.name = `${meshSpec.id}-root`;
	const transform = meshSpec.transform;
	const sharedMaterial = southernFranceSharedMaterial(meshSpec);
	const diffuseMaterials = new Map();
	const usedMaterialIds = new Set();
	const fallbackMaterialIds = new Set();
	const terrainMeshes = [];
	sourceRoot.traverse((child) => {
		if (!child.isMesh) {
			return;
		}
		const sourceMaterialId = southernFranceMaterialIdFromMaterial(child.material);
		const sourceGeometry = child.geometry.clone();
		transformSouthernFranceGeometry({ geometry: sourceGeometry, transform });
		sourceGeometry.computeVertexNormals();
		sourceGeometry.computeBoundingSphere();
		child.geometry = sourceGeometry;
		child.material = southernFranceMaterialForMesh({
			meshSpec,
			sourceMaterialId,
			sharedMaterial,
			diffuseMaterials,
			usedMaterialIds,
			fallbackMaterialIds,
		});
		child.name = `${meshSpec.id}-${child.name || terrainMeshes.length}`;
		child.userData = {
			kind,
			spectrumId: meshSpec.spectrumId,
			detailKind: meshSpec.kind,
			bounds: meshSpec.bounds,
			sourceGroup: child.name,
			sourceMaterialId,
		};
		terrainMeshes.push(child);
	});
	if (terrainMeshes.length === 0) {
		throw new Error('Southern France OBJ did not contain any mesh children.');
	}
	sourceRoot.updateMatrixWorld(true);
	return {
		object: sourceRoot,
		mesh: terrainMeshes[0],
		detailMeshes: terrainMeshes.slice(1),
		stats: {
			backend: meshSpec.backend,
			sourceAsset: meshSpec.sourceAsset,
			sourceMesh: meshSpec.sourceMesh,
			materialPolicy: meshSpec.materialPolicy,
			diffuseTextures: meshSpec.diffuseManifest || null,
			usedMaterialIds: [...usedMaterialIds].sort(),
			fallbackMaterialIds: [...fallbackMaterialIds].sort(),
			transform,
			runtimeMeshCount: terrainMeshes.length,
			vertexCount: meshSpec.vertexCount,
			triangleCount: meshSpec.triangleCount,
			bounds: meshSpec.bounds,
		},
	};
}

function southernFranceSharedMaterial(meshSpec) {
	if (
		meshSpec.diagnosticMaterial === 'flat-dark-green-unlit' ||
		meshSpec.diagnosticMaterial === 'flat-white-unlit'
	) {
		return new THREE.MeshBasicMaterial({
			color: new THREE.Color(...meshSpec.color),
			side: THREE.DoubleSide,
		});
	}
	return new THREE.MeshStandardMaterial({
		color: new THREE.Color(...meshSpec.color),
		roughness: meshSpec.material.roughness,
		metalness: meshSpec.material.metalness,
		side: THREE.DoubleSide,
		flatShading: false,
	});
}

function southernFranceMaterialForMesh({
	meshSpec,
	sourceMaterialId,
	sharedMaterial,
	diffuseMaterials,
	usedMaterialIds,
	fallbackMaterialIds,
}) {
	if (meshSpec.backend !== TERRAIN_BACKENDS.southernFranceObjDiffuse) {
		return sharedMaterial;
	}
	const texture = meshSpec.diffuseTexturesByMaterialId?.[sourceMaterialId];
	if (!texture) {
		fallbackMaterialIds.add(sourceMaterialId || 'unknown');
		return sharedMaterial;
	}
	usedMaterialIds.add(sourceMaterialId);
	if (!diffuseMaterials.has(sourceMaterialId)) {
		const material = new THREE.MeshStandardMaterial({
			map: texture.clone(),
			color: new THREE.Color(1, 1, 1),
			roughness: meshSpec.material.roughness,
			metalness: meshSpec.material.metalness,
			side: THREE.DoubleSide,
			flatShading: false,
		});
		material.map.colorSpace = THREE.SRGBColorSpace;
		material.map.needsUpdate = true;
		diffuseMaterials.set(sourceMaterialId, material);
	}
	return diffuseMaterials.get(sourceMaterialId);
}

function southernFranceMaterialIdFromMaterial(material) {
	const selected = Array.isArray(material) ? material[0] : material;
	return selected?.name || null;
}

function transformSouthernFranceGeometry({ geometry, transform }) {
	const positions = geometry.attributes.position;
	const hasYaw = Number.isFinite(transform.yawRadians);
	const pivot = Array.isArray(transform.rotationPivotMeters)
		? transform.rotationPivotMeters
		: [0, 0];
	const pivotX = Number(pivot[0]) || 0;
	const pivotZ = Number(pivot[1]) || 0;
	const cosYaw = hasYaw ? Math.cos(transform.yawRadians) : 1;
	const sinYaw = hasYaw ? Math.sin(transform.yawRadians) : 0;
	for (let index = 0; index < positions.count; index += 1) {
		const sourceX = positions.getX(index);
		const sourceY = positions.getY(index);
		const sourceZ = positions.getZ(index);
		let x =
			(sourceX - transform.sourceCenterX) * transform.horizontalScale +
			transform.offsetX;
		let z =
			transform.zFar +
			((sourceY - transform.sourceMinY) / transform.sourceRangeY) *
				(transform.zNear - transform.zFar);
		if (hasYaw) {
			const dx = x - pivotX;
			const dz = z - pivotZ;
			x = pivotX + dx * cosYaw - dz * sinYaw;
			z = pivotZ + dx * sinYaw + dz * cosYaw;
		}
		const y =
			(sourceZ - transform.sourceMinZ) * transform.verticalScale +
			transform.baseHeight;
		positions.setXYZ(index, x, y, z);
	}
	positions.needsUpdate = true;
	geometry.computeBoundingBox();
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
		roughness: meshSpec.material.roughness,
		metalness: meshSpec.material.metalness,
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

function detailedThreeTerrainObject({ meshSpec, kind }) {
	const material = new THREE.MeshStandardMaterial({
		color: new THREE.Color(
			...(meshSpec.vertexColoring === true ? [1, 1, 1] : meshSpec.color)
		),
		vertexColors: meshSpec.vertexColoring === true,
		roughness: meshSpec.material.roughness,
		metalness: meshSpec.material.metalness,
		side: THREE.DoubleSide,
	});
	if (meshSpec.surfaceTexture === true) {
		const texture = createThreeTerrainSurfaceTexture(meshSpec.numericSeed);
		material.map = texture;
	}
	const heightmap = TerrainNS[meshSpec.heightmap] || TerrainNS.DiamondSquare;
	const after = meshSpec.afterKind ? makeThreeTerrainAfter(meshSpec) : null;
	const terrainRoot = withScopedSeededMathRandom(meshSpec.numericSeed, () =>
		Terrain({
			after,
			easing: TerrainNS[meshSpec.easing] || TerrainNS.EaseInOut,
			frequency: meshSpec.frequency,
			heightmap,
			material,
			maxHeight: meshSpec.maxHeight,
			minHeight: meshSpec.minHeight,
			steps: meshSpec.steps,
			stretch: meshSpec.stretch,
			xSegments: meshSpec.segmentsX,
			xSize: meshSpec.widthMeters,
			ySegments: meshSpec.segmentsZ,
			ySize: meshSpec.depthMeters,
		})
	);
	terrainRoot.name = `${meshSpec.id}-root`;
	terrainRoot.position.set(0, 0, meshSpec.centerZMeters);
	terrainRoot.updateMatrixWorld(true);
	const mesh = terrainRoot.children.find((child) => child.isMesh);
	if (!mesh) {
		throw new Error('three.terrain.js did not create a terrain mesh child.');
	}
	mesh.name = meshSpec.id;
	mesh.userData = {
		kind,
		spectrumId: meshSpec.spectrumId,
		detailKind: meshSpec.kind,
		bounds: meshSpec.bounds,
	};
	mesh.geometry.computeVertexNormals();
	if (meshSpec.vertexColoring === true) {
		applyThreeTerrainVertexColors(mesh.geometry, meshSpec);
	}
	mesh.geometry.computeBoundingSphere();
	mesh.updateMatrixWorld(true);
	const detailSetup =
		meshSpec.surfaceDetailGeometry === true
			? addThreeTerrainSurfaceDetailGeometry({
					terrainRoot,
					mesh,
					meshSpec,
					kind,
				})
			: { meshes: [], stats: null };
	return {
		object: terrainRoot,
		mesh,
		detailMeshes: detailSetup.meshes,
		stats: {
			backend: TERRAIN_BACKENDS.threeTerrainJs,
			package: 'three.terrain.js',
			heightmap: meshSpec.heightmap,
			easing: meshSpec.easing,
			afterKind: meshSpec.afterKind || null,
			vertexColoring: meshSpec.vertexColoring === true,
			surfaceTexture: meshSpec.surfaceTexture === true,
			surfaceDetailGeometry: detailSetup.stats,
			vertexCount: mesh.geometry.attributes.position.count,
			triangleCount: mesh.geometry.index
				? mesh.geometry.index.count / 3
				: mesh.geometry.attributes.position.count / 3,
			bounds: meshSpec.bounds,
			coordinateMapping:
				'package x -> Three x, package height/local z -> Three y after root rotation, package y/depth -> Three z after root rotation',
		},
	};
}

function createThreeTerrainSurfaceTexture(seed) {
	const size = 256;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext('2d');
	const imageData = context.createImageData(size, size);
	withScopedSeededMathRandom(seed ^ 0x51f15e, () => {
		for (let y = 0; y < size; y += 1) {
			for (let x = 0; x < size; x += 1) {
				const u = x / size;
				const v = y / size;
				const ridge =
					0.5 +
					0.5 *
						Math.sin(
							(u * 28.0 + Math.sin(v * 17.0) * 0.7 + v * 5.0) *
								Math.PI
						);
				const fine =
					0.5 +
					0.5 *
						Math.sin(
							(u * 81.0 + v * 47.0 + Math.sin(u * 19.0) * 0.6) *
								Math.PI
						);
				const speckle = seededRandom();
				const rock = smoothstep(0.72, 0.98, ridge) * 0.32;
				const shade = 0.78 + ridge * 0.18 + fine * 0.12 + speckle * 0.08;
				const offset = (y * size + x) * 4;
				imageData.data[offset] = Math.round(58 * shade + 70 * rock);
				imageData.data[offset + 1] = Math.round(110 * shade + 45 * rock);
				imageData.data[offset + 2] = Math.round(62 * shade + 34 * rock);
				imageData.data[offset + 3] = 255;
			}
		}
	});
	context.putImageData(imageData, 0, 0);
	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(28, 12);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.needsUpdate = true;
	return texture;
}

function makeThreeTerrainAfter(meshSpec) {
	if (meshSpec.afterKind !== 'ridge-valley-v2') {
		return null;
	}
	return (heights, options) => {
		const stride = options.xSegments + 1;
		const rows = options.ySegments + 1;
		const features = meshSpec.ridgeFeatures || [];
		const sourceMin = options.minHeight;
		const sourceMax = options.maxHeight;
		const sourceRange = Math.max(1, sourceMax - sourceMin);

		for (let iy = 0; iy < rows; iy += 1) {
			const v = iy / options.ySegments;
			for (let ix = 0; ix < stride; ix += 1) {
				const u = ix / options.xSegments;
				const index = iy * stride + ix;
				const packageHeight = clamp01((heights[index] - sourceMin) / sourceRange);
				const centerValley = Math.exp(-Math.pow((u - 0.5) / 0.17, 2));
				const sideEnvelope = Math.pow(Math.sin(Math.PI * clamp01(u)), 0.28);
				const mountainRamp = smoothstep(0.14, 0.88, v);
				const sideSlope =
					(1 - centerValley) * mountainRamp * 3600 +
					sideEnvelope * Math.pow(mountainRamp, 1.6) * 1400;
				const farWall =
					4800 *
					Math.exp(-Math.pow((v - 0.78) / 0.18, 2)) *
					sideEnvelope *
					(0.78 + 0.22 * Math.sin((u * 5.5 + 0.2) * Math.PI));
				const midRidge =
					2700 *
					Math.exp(-Math.pow((v - 0.48) / 0.095, 2)) *
					sideEnvelope *
					(0.7 + 0.3 * Math.sin((u * 7.0 + 1.1) * Math.PI));
				const valleyFloor =
					180 +
					packageHeight * 650 +
					160 * Math.sin((u * 9.0 + v * 2.5) * Math.PI);
				let height =
					valleyFloor +
					sideSlope +
					farWall +
					midRidge -
					centerValley * smoothstep(0.0, 0.55, v) * 1650;

				for (const feature of features) {
					const du = (u - feature.u) / feature.widthU;
					const dv = (v - feature.v) / feature.widthV;
					height +=
						feature.height *
						Math.exp(-(du * du + dv * dv)) *
						sideEnvelope *
						smoothstep(0.2, 0.95, v);
				}

				const gullyCenter = 0.5 + 0.08 * Math.sin(v * Math.PI * 3.0);
				const gully = Math.exp(-Math.pow((u - gullyCenter) / 0.035, 2));
				height -= gully * smoothstep(0.28, 0.88, v) * 950;
				heights[index] = Math.max(0, Math.min(meshSpec.maxHeight, height));
			}
		}
	};
}

function applyThreeTerrainVertexColors(geometry, meshSpec) {
	const positions = geometry.attributes.position;
	const normals = geometry.attributes.normal;
	const colors = [];
	for (let index = 0; index < positions.count; index += 1) {
		const height = positions.getZ(index);
		const heightT = clamp01(
			(height - meshSpec.minHeight) /
				Math.max(1, meshSpec.maxHeight - meshSpec.minHeight)
		);
		const upness = normals ? Math.max(0, normals.getZ(index)) : 1;
		const low = [0.055, 0.14, 0.05];
		const forest = [0.09, 0.22, 0.07];
		const alpine = [0.2, 0.26, 0.12];
		const rock = [0.36, 0.35, 0.27];
		const highMix = smoothstep(0.46, 0.82, heightT);
		const rockMix = smoothstep(0.64, 0.94, heightT) * (1 - upness * 0.65);
		let color = mixRgb(low, forest, smoothstep(0.0, 0.34, heightT));
		color = mixRgb(color, alpine, highMix * 0.7);
		color = mixRgb(color, rock, rockMix);
		colors.push(color[0], color[1], color[2]);
	}
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function addThreeTerrainSurfaceDetailGeometry({
	terrainRoot,
	mesh,
	meshSpec,
	kind,
}) {
	const sampler = createThreeTerrainHeightSampler(mesh.geometry, meshSpec);
	const positions = [];
	const colors = [];
	const indices = [];
	let vertexOffset = 0;
	let outcropCount = 0;
	const detailSeed = meshSpec.numericSeed ^ 0x7a1d3e7f;
	withScopedSeededMathRandom(detailSeed, () => {
		addRaisedRidgeLineStrips({
			sampler,
			meshSpec,
			positions,
			colors,
			indices,
			vertexOffsetRef: {
				get value() {
					return vertexOffset;
				},
				set value(next) {
					vertexOffset = next;
				},
			},
		});
		for (let index = 0; index < meshSpec.surfaceDetailCount; index += 1) {
			const depthBias = seededRandom();
			const localY = interpolate(
				-meshSpec.depthMeters * 0.34,
				meshSpec.depthMeters * 0.48,
				Math.pow(depthBias, 1.35)
			);
			const localX = randomRange(
				-meshSpec.widthMeters * 0.42,
				meshSpec.widthMeters * 0.42
			);
			const baseZ = sampler(localX, localY) + 10;
			const radius = randomRange(180, 780) * (0.8 + depthBias * 0.8);
			const height = randomRange(45, 260) * (0.75 + depthBias * 0.9);
			const sides = 5 + Math.floor(seededRandom() * 4);
			const leanX = randomRange(-0.35, 0.35) * radius;
			const leanY = randomRange(-0.35, 0.35) * radius;
			const baseColor = seededRandom() < 0.58
				? [0.18, 0.22, 0.14]
				: [0.075, 0.15, 0.055];
			const apexColor = mixRgb(baseColor, [0.42, 0.40, 0.31], seededRandom() * 0.7);
			const baseStart = vertexOffset;
			for (let side = 0; side < sides; side += 1) {
				const angle = (side / sides) * Math.PI * 2 + seededRandom() * 0.18;
				const pointRadius = radius * randomRange(0.58, 1.12);
				const x = localX + Math.cos(angle) * pointRadius;
				const y = localY + Math.sin(angle) * pointRadius;
				const z = sampler(x, y) + 12;
				positions.push(round3(x), round3(y), round3(z));
				colors.push(...baseColor);
				vertexOffset += 1;
			}
			const apexIndex = vertexOffset;
			positions.push(
				round3(localX + leanX),
				round3(localY + leanY),
				round3(baseZ + height)
			);
			colors.push(...apexColor);
			vertexOffset += 1;
			for (let side = 0; side < sides; side += 1) {
				const next = side === sides - 1 ? 0 : side + 1;
				indices.push(baseStart + side, baseStart + next, apexIndex);
			}
			outcropCount += 1;
		}
	});

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();
	const material = new THREE.MeshStandardMaterial({
		vertexColors: true,
		roughness: 0.96,
		metalness: 0,
		side: THREE.DoubleSide,
		flatShading: true,
	});
	const detailMesh = new THREE.Mesh(geometry, material);
	detailMesh.name = `${meshSpec.id}-surface-detail`;
	detailMesh.userData = {
		kind: `${kind}-detail`,
		spectrumId: meshSpec.spectrumId,
		detailKind: 'three-terrain-surface-outcrops',
	};
	terrainRoot.add(detailMesh);
	detailMesh.updateMatrixWorld(true);
	return {
		meshes: [detailMesh],
		stats: {
			kind: 'merged-ridge-lines-and-pyramid-outcrops',
			ridgeLineCount: meshSpec.surfaceRidgeLineCount || 0,
			outcropCount,
			vertexCount: positions.length / 3,
			triangleCount: indices.length / 3,
			seed: detailSeed >>> 0,
		},
	};
}

function addRaisedRidgeLineStrips({
	sampler,
	meshSpec,
	positions,
	colors,
	indices,
	vertexOffsetRef,
}) {
	const lineCount = meshSpec.surfaceRidgeLineCount || 0;
	const samplesPerLine = meshSpec.surfaceRidgeLineSamples || 52;
	for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
		const depthT = lineCount <= 1 ? 0.5 : lineIndex / (lineCount - 1);
		const localY = interpolate(
			-meshSpec.depthMeters * 0.34,
			meshSpec.depthMeters * 0.46,
			Math.pow(depthT, 1.08)
		);
		const stripWidth = randomRange(220, 520) * (1 + depthT * 1.8);
		const lift = randomRange(85, 210) * (1 + depthT);
		const amplitude = randomRange(250, 980) * (0.65 + depthT);
		const frequency = randomRange(1.2, 3.6);
		const phase = randomRange(0, Math.PI * 2);
		const baseColor = mixRgb(
			[0.16, 0.24, 0.095],
			[0.58, 0.54, 0.40],
			0.24 + depthT * 0.55
		);
		const ridgeStart = vertexOffsetRef.value;
		for (let sample = 0; sample < samplesPerLine; sample += 1) {
			const u = sample / (samplesPerLine - 1);
			const x = interpolate(
				-meshSpec.widthMeters * 0.48,
				meshSpec.widthMeters * 0.48,
				u
			);
			const wave =
				Math.sin(u * Math.PI * 2 * frequency + phase) * amplitude +
				Math.sin(u * Math.PI * 2 * (frequency * 2.1) + phase * 0.7) *
					amplitude *
					0.28;
			const y = localY + wave;
			const leftY = y - stripWidth * 0.5;
			const rightY = y + stripWidth * 0.5;
			const leftZ = sampler(x, leftY) + lift;
			const rightZ = sampler(x, rightY) + lift;
			positions.push(round3(x), round3(leftY), round3(leftZ));
			positions.push(round3(x), round3(rightY), round3(rightZ));
			const colorJitter = 0.88 + seededRandom() * 0.22;
			colors.push(
				baseColor[0] * colorJitter,
				baseColor[1] * colorJitter,
				baseColor[2] * colorJitter
			);
			colors.push(
				baseColor[0] * colorJitter * 0.92,
				baseColor[1] * colorJitter * 0.92,
				baseColor[2] * colorJitter * 0.92
			);
			vertexOffsetRef.value += 2;
		}
		for (let sample = 0; sample < samplesPerLine - 1; sample += 1) {
			const a = ridgeStart + sample * 2;
			const b = a + 1;
			const c = a + 2;
			const d = a + 3;
			indices.push(a, c, b, b, c, d);
		}
	}
}

function createThreeTerrainHeightSampler(geometry, meshSpec) {
	const positions = geometry.attributes.position;
	const stride = meshSpec.segmentsX + 1;
	const rows = meshSpec.segmentsZ + 1;
	return (x, y) => {
		const u = clamp01((x + meshSpec.widthMeters * 0.5) / meshSpec.widthMeters);
		const v = clamp01((y + meshSpec.depthMeters * 0.5) / meshSpec.depthMeters);
		const fx = u * meshSpec.segmentsX;
		const fy = v * meshSpec.segmentsZ;
		const ix = Math.max(0, Math.min(meshSpec.segmentsX - 1, Math.floor(fx)));
		const iy = Math.max(0, Math.min(meshSpec.segmentsZ - 1, Math.floor(fy)));
		const tx = fx - ix;
		const ty = fy - iy;
		const h00 = positions.getZ(iy * stride + ix);
		const h10 = positions.getZ(iy * stride + ix + 1);
		const h01 = positions.getZ((iy + 1) * stride + ix);
		const h11 = positions.getZ((iy + 1) * stride + ix + 1);
		const hx0 = interpolate(h00, h10, tx);
		const hx1 = interpolate(h01, h11, tx);
		return interpolate(hx0, hx1, ty);
	};
}

function mountainLitCameraConfig({
	mountainViewId,
	sceneDetailSpec,
	sourceMatrixContext,
}) {
	const baseView = mountainShaderCameraConfig(mountainViewId);
	if (sceneDetailSpec?.cameraProfile === 'southern-france-obj-ridge-view') {
		return applyMountainViewYawPolicy({
			mountainViewId,
			sourceMatrixContext,
			view: {
				...baseView,
				id: `${baseView.id || mountainViewId}-southern-france-obj`,
				cameraPositionMeters: [baseView.cameraPositionMeters[0], 6200, 15800],
				lookAtMeters: [baseView.lookAtMeters[0], 4200, -56000],
				verticalFovDegrees: 62,
				description:
					'Southern France OBJ geometry view aimed across the staged real mesh.',
			},
		});
	}
	if (sceneDetailSpec?.cameraProfile === 'rocky-land-heightmap-ridge-view') {
		return applyMountainViewYawPolicy({
			mountainViewId,
			sourceMatrixContext,
			view: {
				...baseView,
				id: `${baseView.id || mountainViewId}-rocky-land-heightmap`,
				cameraPositionMeters: [baseView.cameraPositionMeters[0], 6200, 11800],
				lookAtMeters: [baseView.lookAtMeters[0], 5200, -54000],
				verticalFovDegrees: 62,
				description:
					'Rocky Land and Rivers heightmap view raised enough to see past the first ridge.',
			},
		});
	}
	if (sceneDetailSpec?.cameraProfile === 'three-terrain-ridge-valley-wide') {
		return applyMountainViewYawPolicy({
			mountainViewId,
			sourceMatrixContext,
			view: {
				...baseView,
				id: `${baseView.id || mountainViewId}-three-terrain-wide`,
				cameraPositionMeters: [
					baseView.cameraPositionMeters[0],
					4200,
					9800,
				],
				lookAtMeters: [baseView.lookAtMeters[0], 3900, -52000],
				verticalFovDegrees: 62,
				description:
					'Wide package-terrain view raised above the first foreground ridge.',
			},
		});
	}
	if (isElevatedMountainDetailSpec(sceneDetailSpec)) {
		return applyMountainViewYawPolicy({
			mountainViewId,
			sourceMatrixContext,
			view: {
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
			},
		});
	}
	return applyMountainViewYawPolicy({
		mountainViewId,
		sourceMatrixContext,
		view: baseView,
	});
}

function applyMountainViewYawPolicy({
	mountainViewId,
	view,
	sourceMatrixContext = sourceMatrixTemporalContextFromPayload(),
}) {
	if (mountainViewId === MOUNTAIN_VIEW_MODES.distantSunsetCentered) {
		return applyDistantSunsetYawPolicy({ view, sourceMatrixContext });
	}
	if (mountainViewId !== MOUNTAIN_VIEW_MODES.localToward180Sun) {
		return view;
	}
	const cameraPosition = new THREE.Vector3(...view.cameraPositionMeters);
	const currentLookAt = new THREE.Vector3(...view.lookAtMeters);
	const currentHorizontalDistance = Math.hypot(
		currentLookAt.x - cameraPosition.x,
		currentLookAt.z - cameraPosition.z
	);
	const localSun180Three = new THREE.Vector3(
		...algorithmPositionToThreeArray(
			flatLocalSunSourceDefinition(180, sourceMatrixContext).positionMeters
		)
	);
	const yawDirection = new THREE.Vector3(
		localSun180Three.x - cameraPosition.x,
		0,
		localSun180Three.z - cameraPosition.z
	);
	if (yawDirection.lengthSq() === 0 || currentHorizontalDistance === 0) {
		return view;
	}
	yawDirection.normalize();
	const lookAt = new THREE.Vector3(
		cameraPosition.x + yawDirection.x * currentHorizontalDistance,
		currentLookAt.y,
		cameraPosition.z + yawDirection.z * currentHorizontalDistance
	);
	return {
		...view,
		id: `${view.id || mountainViewId}-toward-local-180deg-sun`,
		lookAtMeters: vectorToArray(lookAt),
		cameraYawPolicy: {
			kind: 'yaw-only-local-sun-bearing',
			targetLocalSunOffsetDegrees: 180,
			targetLocalSunPositionMeters:
				flatLocalSunSourceDefinition(180, sourceMatrixContext).positionMeters,
			targetLocalSunPositionThreeMeters: vectorToArray(localSun180Three),
			sourceTime: sourceMatrixContext.flatSimulationTime,
			localSolarTime: localSolarTimeForOffsetDegrees(
				180,
				sourceMatrixContext
			),
			preservedLookAtY: currentLookAt.y,
			preservedHorizontalDistance: currentHorizontalDistance,
		},
		description: `${view.description || 'Mountain terrain view'}; yaw rotated toward the local 180 degree Sun bearing while preserving the existing look-at elevation.`,
	};
}

function applyDistantSunsetYawPolicy({
	view,
	sourceMatrixContext = sourceMatrixTemporalContextFromPayload(),
}) {
	const cameraPosition = new THREE.Vector3(...view.cameraPositionMeters);
	const currentLookAt = new THREE.Vector3(...view.lookAtMeters);
	const currentHorizontalDistance = Math.hypot(
		currentLookAt.x - cameraPosition.x,
		currentLookAt.z - cameraPosition.z
	);
	const sunsetSample = daylightSolarSamples({
		sourceMatrixContext,
		sampleCount: 5,
	}).at(-1);
	const sunsetCase = makeTimeAlignedDistantSunCase({
		offsetDegrees: sunsetSample.offsetDegrees,
		sourceMatrixContext,
		daylightSample: sunsetSample,
	});
	const sunsetDirectionThree = new THREE.Vector3(
		...algorithmDirectionToThreeArray(sunsetCase.sunDirection || sunDirection(sunsetCase))
	);
	const yawDirection = new THREE.Vector3(
		sunsetDirectionThree.x,
		0,
		sunsetDirectionThree.z
	);
	if (yawDirection.lengthSq() === 0 || currentHorizontalDistance === 0) {
		return view;
	}
	yawDirection.normalize();
	const lookAt = new THREE.Vector3(
		cameraPosition.x + yawDirection.x * currentHorizontalDistance,
		currentLookAt.y,
		cameraPosition.z + yawDirection.z * currentHorizontalDistance
	);
	return {
		...view,
		id: `${view.id || MOUNTAIN_VIEW_MODES.distantSunsetCentered}-toward-distant-sunset`,
		lookAtMeters: vectorToArray(lookAt),
		cameraYawPolicy: {
			kind: 'yaw-only-distant-sunset-bearing',
			targetDistantSunEvent: 'sunset',
			targetDistantSunOffsetDegrees: sunsetSample.offsetDegrees,
			targetDistantSunDirectionAlgorithm: sunsetCase.sunDirection ||
				sunDirection(sunsetCase),
			targetDistantSunDirectionThree: vectorToArray(sunsetDirectionThree),
			sourceTime: sourceMatrixContext.flatSimulationTime,
			localSolarTime: sunsetSample.localSolarTime,
			preservedLookAtY: currentLookAt.y,
			preservedHorizontalDistance: currentHorizontalDistance,
		},
		description: `${view.description || 'Mountain terrain view'}; yaw rotated toward the spherical distant sunset bearing while preserving the existing look-at elevation.`,
	};
}

function sceneDetailSpecForMountainView({
	detailSpec,
	mountainViewId,
	mountainView,
	sourceMatrixContext,
}) {
	if (
		!(
			mountainViewId === MOUNTAIN_VIEW_MODES.localToward180Sun ||
			mountainViewId === MOUNTAIN_VIEW_MODES.distantSunsetCentered
		) ||
		!isSouthernFranceObjFloor(detailSpec?.floor)
	) {
		return detailSpec;
	}
	const floor = southernFranceLocal180ViewFitFloor({
		floor: detailSpec.floor,
		mountainView,
		sourceMatrixContext,
	});
	return {
		...detailSpec,
		floor,
		generatedBy: `${detailSpec.generatedBy}; local 180 degree subjective view applies a yaw-aligned Southern France OBJ footprint fit`,
		summary: {
			...detailSpec.summary,
			terrainMeshId: floor.id,
			transform: floor.transform,
			localViewTerrainFit: floor.transform.localViewTerrainFit,
		},
	};
}

function isSouthernFranceObjFloor(floor) {
	return (
		floor?.backend === TERRAIN_BACKENDS.southernFranceObjGeometry ||
		floor?.backend === TERRAIN_BACKENDS.southernFranceObjDiffuse
	);
}

function southernFranceLocal180ViewFitFloor({
	floor,
	mountainView,
	sourceMatrixContext = sourceMatrixTemporalContextFromPayload(),
}) {
	const cameraPosition = new THREE.Vector3(...mountainView.cameraPositionMeters);
	const yawDirection = yawDirectionForTerrainFit({
		mountainView,
		cameraPosition,
		sourceMatrixContext,
	});
	if (yawDirection.lengthSq() === 0) {
		return floor;
	}
	yawDirection.normalize();
	const yawRadians = Math.atan2(yawDirection.x, -yawDirection.z);
	const transform = {
		...floor.transform,
		kind: 'source-z-up-to-three-y-up-local-180-view-fit-v1',
		horizontalScale: 1.12,
		zFar: -168000,
		yawRadians,
		rotationPivotMeters: [
			mountainView.cameraPositionMeters[0],
			mountainView.cameraPositionMeters[2],
		],
		localViewTerrainFit: {
			kind: 'yaw-aligned-wider-footprint',
			viewMode: mountainView.id || MOUNTAIN_VIEW_MODES.localToward180Sun,
			targetLocalSunOffsetDegrees:
				mountainView.cameraYawPolicy?.targetLocalSunOffsetDegrees ?? null,
			targetDistantSunOffsetDegrees:
				mountainView.cameraYawPolicy?.targetDistantSunOffsetDegrees ?? null,
			sourceTime: sourceMatrixContext.flatSimulationTime,
			localSolarTime: mountainView.cameraYawPolicy?.localSolarTime || null,
			policy:
				'Rotate and widen the staged OBJ footprint for the yaw-only subjective view so the finite source mesh remains under the visible frame instead of exposing the catch plane on the right edge.',
			horizontalScaleBefore: floor.transform.horizontalScale,
			horizontalScaleAfter: 1.12,
			zFarBefore: floor.transform.zFar,
			zFarAfter: -168000,
		},
	};
	return {
		...floor,
		id: `${floor.id}-local-180-view-fit`,
		transform,
		bounds: southernFranceObjBoundsForTransform({
			sourceBounds: floor.sourceMesh.sourceBounds,
			transform,
		}),
	};
}

function yawDirectionForTerrainFit({
	mountainView,
	cameraPosition,
	sourceMatrixContext,
}) {
	if (mountainView.cameraYawPolicy?.targetDistantSunDirectionThree) {
		return new THREE.Vector3(
			mountainView.cameraYawPolicy.targetDistantSunDirectionThree[0],
			0,
			mountainView.cameraYawPolicy.targetDistantSunDirectionThree[2]
		);
	}
	const localSun180Three = new THREE.Vector3(
		...algorithmPositionToThreeArray(
			flatLocalSunSourceDefinition(180, sourceMatrixContext).positionMeters
		)
	);
	return new THREE.Vector3(
		localSun180Three.x - cameraPosition.x,
		0,
		localSun180Three.z - cameraPosition.z
	);
}

function southernFranceObjBoundsForTransform({ sourceBounds, transform }) {
	const corners = [
		southernFranceSourceToSceneXZ({
			sourceX: sourceBounds.minX,
			sourceY: sourceBounds.minY,
			transform,
		}),
		southernFranceSourceToSceneXZ({
			sourceX: sourceBounds.minX,
			sourceY: sourceBounds.maxY,
			transform,
		}),
		southernFranceSourceToSceneXZ({
			sourceX: sourceBounds.maxX,
			sourceY: sourceBounds.minY,
			transform,
		}),
		southernFranceSourceToSceneXZ({
			sourceX: sourceBounds.maxX,
			sourceY: sourceBounds.maxY,
			transform,
		}),
	];
	return {
		xMin: Math.min(...corners.map((corner) => corner.x)),
		xMax: Math.max(...corners.map((corner) => corner.x)),
		zNear: Math.max(...corners.map((corner) => corner.z)),
		zFar: Math.min(...corners.map((corner) => corner.z)),
		minHeight: transform.baseHeight,
		maxHeight:
			(sourceBounds.maxZ - sourceBounds.minZ) * transform.verticalScale +
			transform.baseHeight,
	};
}

function southernFranceSourceToSceneXZ({ sourceX, sourceY, transform }) {
	let x =
		(sourceX - transform.sourceCenterX) * transform.horizontalScale +
		transform.offsetX;
	let z =
		transform.zFar +
		((sourceY - transform.sourceMinY) / transform.sourceRangeY) *
			(transform.zNear - transform.zFar);
	if (!Number.isFinite(transform.yawRadians)) {
		return { x, z };
	}
	const pivot = Array.isArray(transform.rotationPivotMeters)
		? transform.rotationPivotMeters
		: [0, 0];
	const dx = x - (Number(pivot[0]) || 0);
	const dz = z - (Number(pivot[1]) || 0);
	const cosYaw = Math.cos(transform.yawRadians);
	const sinYaw = Math.sin(transform.yawRadians);
	x = (Number(pivot[0]) || 0) + dx * cosYaw - dz * sinYaw;
	z = (Number(pivot[1]) || 0) + dx * sinYaw + dz * cosYaw;
	return { x, z };
}

function isElevatedMountainDetailSpec(sceneDetailSpec) {
	return (
		sceneDetailSpec?.kind === 'mountain-detail-v1' ||
		sceneDetailSpec?.kind === 'three-terrain-js-mountain-detail-v1' ||
		sceneDetailSpec?.kind === 'rocky-land-heightmap-mountain-detail-v1' ||
		sceneDetailSpec?.kind === 'southern-france-obj-geometry-v1'
	);
}

function mountainShaderCameraConfig(mountainViewId) {
	const baseConfig = {
		id: MOUNTAIN_VIEW_MODES.frontHighSun,
		cameraPositionMeters: MOUNTAIN_RIDGE_SCENE.cameraPositionMeters,
		lookAtMeters: MOUNTAIN_RIDGE_SCENE.lookAtMeters,
		verticalFovDegrees: MOUNTAIN_RIDGE_SCENE.verticalFovDegrees,
		renderSunCase: HIGH_SUN_CASE,
	};
	if (mountainViewId !== MOUNTAIN_VIEW_MODES.sunsetBehindCamera) {
		return baseConfig;
	}
	const sunThree = new THREE.Vector3(
		...algorithmDirectionToThreeArray(sunDirection(LOW_SUN_CASE))
	);
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
	};
}

function addMountainSourceLight({
	scene,
	sourcePacket,
	targetMeters,
	enableShadows = false,
	shadowMapSize = null,
	sceneDetailSpec = null,
}) {
	if (sourcePacket?.kind === 'flat-local-point-sun') {
		const positionMeters = algorithmPositionToThreeArray(sourcePacket.positionMeters);
		const intensity = 2.4 * (sourcePacket.observerIncidentScale ?? 1);
		const light = new THREE.PointLight(0xffffff, intensity, 0, 0);
		light.position.fromArray(positionMeters);
		light.userData.algorithm32SourceLight = true;
		const shadow = configurePointSourceShadow({
			light,
			enabled: enableShadows,
			shadowMapSize,
		});
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
				'PointLight uses decay=0 for this subjective scene; configured local source distance/falloff is folded into observerIncidentScale for scene brightness, while Algorithm32 samples the finite source.',
			shadow,
		};
	}
	const sourceDirectionAlgorithm = sourcePacket.sunDirection || sunDirection(HIGH_SUN_CASE);
	const directionToSourceThree = algorithmDirectionToThreeArray(sourceDirectionAlgorithm);
	const target = targetMeters || [0, 0, -36000];
	const positionMeters = addArrays(
		target,
		directionToSourceThree.map((value) => value * 120000)
	);
	const lightTravelDirectionThree = normalize(subtractArrays(target, positionMeters));
	const light = new THREE.DirectionalLight(0xffffff, 2.4);
	light.position.fromArray(positionMeters);
	light.target.position.fromArray(target);
	light.userData.algorithm32SourceLight = true;
	light.target.userData.algorithm32SourceLight = true;
	const shadow = configureDirectionalSourceShadow({
		light,
		enabled: enableShadows,
		shadowMapSize,
		sceneDetailSpec,
	});
	scene.add(light);
	scene.add(light.target);
	return {
		kind: 'source-driven-distant-directional-light',
		mode: 'distant-directional-sun',
		sunCase: sourcePacket.sunCase,
		color: 0xffffff,
		colorRgb: [1, 1, 1],
		intensity: light.intensity,
		calibrationScalar: 2.4,
		positionMeters,
		targetMeters: target,
		sourceDirectionAlgorithm,
		directionToSourceThree,
		lightTravelDirectionThree,
		shadow,
	};
}

function configureDirectionalSourceShadow({
	light,
	enabled,
	shadowMapSize,
	sceneDetailSpec,
}) {
	if (!enabled) {
		return {
			enabled: false,
			reason: 'Shadow maps disabled for this render.',
		};
	}
	const floorBounds = sceneDetailSpec?.floor?.bounds || {};
	const xSpan =
		Math.abs((floorBounds.xMax || 0) - (floorBounds.xMin || 0)) || 120000;
	const zSpan =
		Math.abs((floorBounds.zNear || 0) - (floorBounds.zFar || 0)) || 120000;
	const span = Math.max(xSpan, zSpan, 120000);
	const size = Number(shadowMapSize || 2048);
	light.castShadow = true;
	light.shadow.mapSize.width = size;
	light.shadow.mapSize.height = size;
	light.shadow.camera.left = -span * 0.58;
	light.shadow.camera.right = span * 0.58;
	light.shadow.camera.top = span * 0.58;
	light.shadow.camera.bottom = -span * 0.58;
	light.shadow.camera.near = 100;
	light.shadow.camera.far = 280000;
	light.shadow.bias = -0.00005;
	light.shadow.normalBias = 35;
	light.shadow.camera.updateProjectionMatrix();
	return {
		enabled: true,
		kind: 'directional-light-shadow-map',
		mapSize: [size, size],
		camera: {
			left: light.shadow.camera.left,
			right: light.shadow.camera.right,
			top: light.shadow.camera.top,
			bottom: light.shadow.camera.bottom,
			near: light.shadow.camera.near,
			far: light.shadow.camera.far,
		},
		bias: light.shadow.bias,
		normalBias: light.shadow.normalBias,
		frustumSpanMeters: span,
		policy:
			'Large terrain-scale orthographic shadow camera centered on the source-light target for subjective review.',
	};
}

function configurePointSourceShadow({ light, enabled, shadowMapSize }) {
	if (!enabled) {
		return {
			enabled: false,
			reason: 'Shadow maps disabled for this render.',
		};
	}
	const size = Number(shadowMapSize || 1024);
	light.castShadow = true;
	light.shadow.mapSize.width = size;
	light.shadow.mapSize.height = size;
	light.shadow.camera.near = 100;
	light.shadow.camera.far = 280000;
	light.shadow.bias = -0.00005;
	light.shadow.normalBias = 35;
	light.shadow.camera.updateProjectionMatrix();
	return {
		enabled: true,
		kind: 'point-light-shadow-map',
		mapSize: [size, size],
		camera: {
			near: light.shadow.camera.near,
			far: light.shadow.camera.far,
		},
		bias: light.shadow.bias,
		normalBias: light.shadow.normalBias,
		policy:
			'Point-light shadow support is enabled for parity experiments, but distant terrain-scale local Sun shadows remain a POC diagnostic.',
	};
}

function captureSceneCoverageSummary({
	captureId,
	sceneMode,
	width,
	height,
	camera,
	meshes,
	sceneObjects,
	ground,
	sourcePacket,
	sceneLightPacket,
	geometryPacket,
	sceneDetailPacket,
}) {
	const raycaster = new THREE.Raycaster();
	const sampleColumns = 48;
	const sampleRows = 27;
	let skyPixels = 0;
	let hitPixels = 0;
	let minHitDistanceMeters = Number.POSITIVE_INFINITY;
	let maxHitDistanceMeters = 0;
	const countsByClassification = new Map();
	const selectedPixels = [];

	for (let row = 0; row < sampleRows; row += 1) {
		const y = Math.round(((row + 0.5) / sampleRows) * (height - 1));
		for (let column = 0; column < sampleColumns; column += 1) {
			const x = Math.round(((column + 0.5) / sampleColumns) * (width - 1));
			const ndc = pixelToNdc(x, y, width, height);
			raycaster.setFromCamera(ndc, camera);
			const ray = raycaster.ray.clone();
			const hit = firstSceneInputHit(raycaster, meshes);
			if (hit) {
				const classification = hit.object.userData?.kind || 'object';
				hitPixels += 1;
				minHitDistanceMeters = Math.min(minHitDistanceMeters, hit.distance);
				maxHitDistanceMeters = Math.max(maxHitDistanceMeters, hit.distance);
				countsByClassification.set(
					classification,
					(countsByClassification.get(classification) || 0) + 1
				);
			} else {
				skyPixels += 1;
			}
			if (
				(row === Math.floor(sampleRows * 0.16) && column === Math.floor(sampleColumns * 0.5)) ||
				(row === Math.floor(sampleRows * 0.5) && column === Math.floor(sampleColumns * 0.5)) ||
				(row === Math.floor(sampleRows * 0.78) && column === Math.floor(sampleColumns * 0.5))
			) {
				selectedPixels.push({
					id: `coverage-${selectedPixels.length}`,
					x,
					y,
					ndc,
					classification: hit ? hit.object.userData?.kind || 'object' : 'sky',
					hitObject: hit?.object?.name || null,
					hitDistanceMeters: hit?.distance || null,
					threeRay: {
						origin: vectorToArray(ray.origin),
						direction: vectorToArray(ray.direction),
					},
				});
			}
		}
	}

	return {
		kind: 'algorithm32-browser-scene-coverage-summary',
		version: 1,
		captureId,
		sceneMode,
		width,
		height,
		sampling: {
			kind: 'sparse-coverage-grid',
			sampleColumns,
			sampleRows,
			sampledPixels: sampleColumns * sampleRows,
		},
		camera: {
			type: 'THREE.PerspectiveCamera',
			positionMeters: vectorToArray(camera.position),
			verticalFovDegrees: camera.fov,
			aspect: camera.aspect,
			near: camera.near,
			far: camera.far,
		},
		source: sourcePacket,
		sceneLight: sceneLightPacket,
		geometry: geometryPacket,
		sceneObjects,
		ground,
		sceneDetail: sceneDetailPacket,
		counts: {
			skyPixels,
			hitPixels,
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
			const rgba = Array.from(sceneColorRgba8.slice(pixelIndex * 4, pixelIndex * 4 + 4));
			const luminance = luminanceRgb(rgba);

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
				countsBySpectrumId.set(numericSpectrumId, (countsBySpectrumId.get(numericSpectrumId) || 0) + 1);
				countsByClassification.set(classification, (countsByClassification.get(classification) || 0) + 1);

				if (classification === 'ground') {
					const sample = makeSceneInputSample({ id: 'ground-candidate', x, y, ndc, ray, hit, rgba, luminance });
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
		sceneInputSampleAt({ id: 'upper-sky', x: Math.floor(width * 0.5), y: Math.floor(height * 0.16), width, height, camera, meshes, sceneColorRgba8 }),
		sceneInputSampleAt({ id: 'center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.5), width, height, camera, meshes, sceneColorRgba8 }),
		sceneInputSampleAt({ id: 'lower-center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.78), width, height, camera, meshes, sceneColorRgba8 })
	);
	if (darkestGround) {
		selectedCandidates.push({ ...darkestGround, id: 'darkest-ground' });
	}
	if (brightestGround) {
		selectedCandidates.push({ ...brightestGround, id: 'brightest-ground' });
	}

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
		source: sourcePacket,
		sceneLight: sceneLightPacket,
		geometry: geometryPacket,
		sceneObjects,
		ground,
		sceneDetail: sceneDetailPacket,
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
		classificationIds,
		counts: {
			skyPixels,
			hitPixels,
			bySpectrumNumericId: Object.fromEntries([...countsBySpectrumId.entries()].sort((a, b) => a[0] - b[0])),
			byClassification: Object.fromEntries([...countsByClassification.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))),
		},
		hitDistanceMetersSummary: {
			min: hitPixels > 0 ? minHitDistanceMeters : null,
			max: hitPixels > 0 ? maxHitDistanceMeters : null,
		},
		selectedPixels: dedupeSceneInputSamples(selectedCandidates),
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

function sceneInputSampleAt({ id, x, y, width, height, camera, meshes, sceneColorRgba8 }) {
	const raycaster = new THREE.Raycaster();
	const ndc = pixelToNdc(x, y, width, height);
	raycaster.setFromCamera(ndc, camera);
	const ray = raycaster.ray.clone();
	const hit = firstSceneInputHit(raycaster, meshes);
	const offset = (y * width + x) * 4;
	const rgba = Array.from(sceneColorRgba8.slice(offset, offset + 4));
	return makeSceneInputSample({ id, x, y, ndc, ray, hit, rgba, luminance: luminanceRgb(rgba) });
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
		spectrumNumericId: hit ? spectrumNumericId(hit.object.userData?.spectrumId) : 0,
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

function subjectiveCaptureCriteria({ capture }) {
	return [
		{
			criterionId: 'subjective-capture-packet-present',
			status: capture ? 'pass' : 'fail',
			tolerance: 'capture packet exists',
			measuredError: capture ? 0 : 1,
			sourceOrStatus: 'local-subjective-scene-capture',
			notes: 'The local lane generated the scene packet without using shader-lab temp captures.',
		},
		{
			criterionId: 'subjective-capture-has-sky-and-hit',
			status:
				capture?.counts?.skyPixels > 0 && capture?.counts?.hitPixels > 0
					? 'pass'
					: 'fail',
			tolerance: 'at least one sky pixel and one hit pixel',
			measuredError: capture?.counts || null,
			sourceOrStatus: 'local-subjective-scene-capture',
			notes: 'The soft shader needs both sky rays and scene geometry rays.',
		},
		{
			criterionId: 'source-driven-three-light-recorded',
			status: capture?.sceneLight?.kind ? 'pass' : 'fail',
			tolerance: 'sceneLight packet exists',
			measuredError: capture?.sceneLight || null,
			sourceOrStatus: 'local-subjective-scene-capture',
			notes: 'The browser scene uses a white Three light derived from the same source config as Algorithm32.',
		},
	];
}

function threeTerrainIntegratedCriteria({
	sceneCapture,
	selectedPixels,
	imageStats,
	sceneTargetSample,
	atmospherePassDisabled = false,
	enableShadows = false,
}) {
	const terrainBackend = sceneCapture?.sceneDetail?.terrainBackend || null;
	const acceptedBackends = [
		TERRAIN_BACKENDS.threeTerrainJs,
		TERRAIN_BACKENDS.rockyLandHeightmap,
		TERRAIN_BACKENDS.southernFranceObjGeometry,
		TERRAIN_BACKENDS.southernFranceObjDiffuse,
	];
	const terrainMeshHit = sceneCapture?.selectedPixels?.some(
		(pixel) =>
			pixel.classification === 'ground' &&
			pixel.hitObject &&
			pixel.hitObject !== 'detail-bottom-ground-plane'
	);
	const criteria = [
		{
			criterionId: 'external-terrain-backend-used',
			status: acceptedBackends.includes(terrainBackend) ? 'pass' : 'fail',
			tolerance: 'scene detail terrainBackend is a known non-manual terrain backend',
			measuredError: terrainBackend,
			sourceOrStatus: 'three-terrain-integrated-distant-midday',
			notes:
				'The scene was generated through an explicit non-manual terrain backend instead of the local procedural control.',
		},
		{
			criterionId: atmospherePassDisabled
				? 'atmosphere-pass-disabled-for-diagnostic'
				: 'integrated-distant-pass-mode-present',
			status: atmospherePassDisabled
				? 'pass'
				: threeNativePassModeCode('distant-first-order-atmosphere') === 2
					? 'pass'
					: 'fail',
			tolerance: atmospherePassDisabled
				? 'Algorithm32AtmospherePass intentionally skipped'
				: 'pass mode 2',
			measuredError: atmospherePassDisabled
				? 'disabled'
				: threeNativePassModeCode('distant-first-order-atmosphere'),
			sourceOrStatus: 'three-terrain-integrated-distant-midday',
			notes: atmospherePassDisabled
				? 'This diagnostic renders live Three scene color directly, without the atmosphere shader.'
				: 'The render used the centralized Three-native atmosphere pass.',
		},
		{
			criterionId: 'scene-has-sky-and-hit-pixels',
			status:
				sceneCapture?.counts?.skyPixels > 0 && sceneCapture?.counts?.hitPixels > 0
					? 'pass'
					: 'fail',
			tolerance: 'at least one sky pixel and one geometry-hit pixel',
			measuredError: sceneCapture?.counts || null,
			sourceOrStatus: 'three-terrain-integrated-distant-midday',
			notes: atmospherePassDisabled
				? 'The scene contains both sky rays and geometry-hit rays before atmosphere composition.'
				: 'The integrated shader receives both sky rays and depth-backed scene rays.',
		},
		{
			criterionId: 'external-terrain-mesh-hit-sampled',
			status: terrainMeshHit ? 'pass' : 'fail',
			tolerance: 'at least one sparse selected hit is the external terrain mesh, not only the catch plane',
			measuredError: sceneCapture?.selectedPixels || null,
			sourceOrStatus: 'three-terrain-integrated-distant-midday',
			notes:
				'The terrain backend must contribute visible scene geometry; the far catch plane alone is not enough.',
		},
		{
			criterionId: 'scene-render-target-nonzero',
			status: sceneTargetSample?.some((value) => value !== 0) ? 'pass' : 'fail',
			tolerance: 'render target top-left sample has nonzero bytes',
			measuredError: sceneTargetSample || null,
			sourceOrStatus: 'three-terrain-integrated-distant-midday',
			notes: atmospherePassDisabled
				? 'The no-atmosphere diagnostic rendered a live Three scene target instead of a blank input.'
				: 'The pass rendered over a live Three scene target instead of a blank input.',
		},
		{
			criterionId: atmospherePassDisabled
				? 'scene-only-image-finite-and-nonblank'
				: 'integrated-image-finite-and-nonblank',
			status:
				imageStats &&
				imageStats.nonfiniteValues === 0 &&
				imageStats.maxByte > imageStats.minByte
					? 'pass'
					: 'fail',
			tolerance: 'finite RGBA bytes with nonzero range',
			measuredError: imageStats,
			sourceOrStatus: 'three-terrain-integrated-distant-midday',
			notes: atmospherePassDisabled
				? 'The final canvas contains a nonblank Three scene-color image with the atmosphere shader off.'
				: 'The final canvas contains a nonblank integrated atmosphere image.',
		},
		{
			criterionId: atmospherePassDisabled
				? 'selected-scene-only-pixels-finite'
				: 'selected-integrated-pixels-finite',
			status:
				selectedPixels.length > 0 &&
				selectedPixels.every((pixel) => pixel.rgba.every(Number.isFinite))
					? 'pass'
					: 'fail',
			tolerance: 'finite selected RGBA byte samples',
			measuredError: selectedPixels,
			sourceOrStatus: 'three-terrain-integrated-distant-midday',
			notes: atmospherePassDisabled
				? 'Representative no-atmosphere scene-color samples are readable and bounded.'
				: 'Representative final-image samples are readable and bounded.',
		},
	];
	if (enableShadows) {
		const sceneShadowing = sceneCapture?.sceneLight?.sceneShadowing || null;
		const expectsReceiveOnly = sceneShadowing?.policy === 'receive-only';
		const shadowCountsPass = expectsReceiveOnly
			? sceneShadowing?.castShadowMeshCount === 0 &&
				sceneShadowing?.receiveShadowMeshCount > 0
			: sceneShadowing?.castShadowMeshCount > 0 &&
				sceneShadowing?.receiveShadowMeshCount > 0;
		criteria.push({
			criterionId: 'three-shadow-maps-enabled',
			status:
				sceneCapture?.sceneLight?.shadow?.enabled === true &&
				shadowCountsPass
					? 'pass'
					: 'fail',
			tolerance:
				expectsReceiveOnly
					? 'source light has shadow map enabled and terrain meshes receive shadows without casting'
					: 'source light has shadow map enabled and at least one terrain mesh casts and receives shadows',
			measuredError: {
				sourceLightShadow: sceneCapture?.sceneLight?.shadow || null,
				sceneShadowing,
			},
			sourceOrStatus: 'three-terrain-integrated-distant-midday',
			notes:
				'This render intentionally enables real Three shadow maps so baked texture shadows can be compared against live terrain shadows.',
		});
	}
	return criteria;
}

async function createSubjectiveTerrainSpec({ seedValue, terrainBackend }) {
	if (terrainBackend === TERRAIN_BACKENDS.southernFranceObjDiffuse) {
		return createSouthernFranceObjDiffuseSpec(seedValue);
	}
	if (terrainBackend === TERRAIN_BACKENDS.southernFranceObjGeometry) {
		return createSouthernFranceObjGeometrySpec(seedValue);
	}
	if (terrainBackend === TERRAIN_BACKENDS.rockyLandHeightmap) {
		return createRockyLandHeightmapTerrainSpec(seedValue);
	}
	if (terrainBackend === TERRAIN_BACKENDS.threeTerrainJs) {
		return createThreeTerrainMountainSpec(seedValue);
	}
	return createDetailedMountainTerrainSpec(seedValue);
}

function applyTerrainDiagnosticOverrides({ terrainSpec, payload }) {
	const simplification = payload.sceneSimplification;
	if (
		simplification !== 'mesh-only-white' &&
		simplification !== 'mesh-only-white-standard' &&
		simplification !== 'mesh-only-white-standard-full-ambient' &&
		simplification !== 'mesh-only-white-standard-ambient-only'
	) {
		return terrainSpec;
	}
	const usesLitStandardMaterial =
		simplification === 'mesh-only-white-standard' ||
		simplification === 'mesh-only-white-standard-full-ambient' ||
		simplification === 'mesh-only-white-standard-ambient-only';
	const usesFullAmbient =
		simplification === 'mesh-only-white-standard-full-ambient' ||
		simplification === 'mesh-only-white-standard-ambient-only';
	const disablesSourceLight =
		simplification === 'mesh-only-white-standard-ambient-only';
	const materialOverride = usesLitStandardMaterial
		? 'flat-white-standard'
		: 'flat-white-unlit';
	terrainSpec.kind = `${terrainSpec.kind}-${simplification}-diagnostic`;
	terrainSpec.generatedBy = `${terrainSpec.generatedBy}; diagnostic mesh-only white material override`;
	terrainSpec.bottomGround = null;
	terrainSpec.disableSourceLight = disablesSourceLight;
	terrainSpec.ambientIntensity = usesLitStandardMaterial
		? usesFullAmbient
			? 1
			: 0.06
		: 1;
	terrainSpec.floor = {
		...terrainSpec.floor,
		color: [1, 1, 1],
		diagnosticMaterial: materialOverride,
		material: {
			roughness: usesLitStandardMaterial ? 0.96 : 1,
			metalness: 0,
		},
		materialPolicy: {
			kind: usesLitStandardMaterial
				? 'diagnostic-flat-white-standard-lit'
				: 'diagnostic-flat-white-unlit',
			texturesUsed: false,
			vertexColorsUsed: false,
			lightingUsedForMaterialColor: usesLitStandardMaterial,
			description:
				usesLitStandardMaterial
					? 'MeshStandardMaterial white override for black-pixel diagnostics; OBJ geometry remains unchanged.'
					: 'MeshBasicMaterial white override for black-pixel diagnostics; OBJ geometry remains unchanged.',
		},
		diffuseTexturesByMaterialId: null,
		diffuseManifest: null,
	};
	terrainSpec.summary = {
		...terrainSpec.summary,
		diagnosticSceneSimplification: {
			kind: simplification,
			bottomGroundDisabled: true,
			atmospherePassShouldBeDisabled: true,
			materialOverride,
			texturesUsed: false,
			vertexColorsUsed: false,
			lightingUsedForMaterialColor: usesLitStandardMaterial,
			ambientIntensity: terrainSpec.ambientIntensity,
			sourceLightDisabled: disablesSourceLight,
			sourceMeshUnchanged: true,
		},
		bottomGroundId: null,
		bottomGroundPolicy:
			'disabled for mesh-only white diagnostic so no catch plane can compete with OBJ depth',
		materialPolicy: terrainSpec.floor.materialPolicy,
		diffuseTextures: null,
	};
	return terrainSpec;
}

function defaultTerrainSeedForBackend(terrainBackend) {
	if (terrainBackend === TERRAIN_BACKENDS.rockyLandHeightmap) {
		return 'rocky-land-and-rivers-heightmap-v1';
	}
	if (terrainBackend === TERRAIN_BACKENDS.southernFranceObjGeometry) {
		return 'southern-france-blender-obj-v1';
	}
	if (terrainBackend === TERRAIN_BACKENDS.southernFranceObjDiffuse) {
		return 'southern-france-blender-obj-diffuse-v1';
	}
	return 'algorithm32-three-terrain-js-v1';
}

function createDetailedMountainTerrainSpec(seedValue) {
	const seed = String(seedValue || TERRAIN_SEED);
	const numericSeed = numericSeedFromString(seed);
	randomState = numericSeed >>> 0;
	const floor = buildContinuousDetailedTerrainMesh();
	const bottomGround = buildBottomGroundSurface();
	return {
		kind: 'mountain-detail-v1',
		terrainBackend: TERRAIN_BACKENDS.manualHeightfield,
		seed,
		numericSeed,
		generatedBy: 'scripts/flat/local-second-order/page/subjective-scenes.js deterministic LCG',
		coordinateSystem: 'THREE meters, y-up, x-horizontal, negative z into view',
		ambientIntensity: 0.055,
		bottomGround,
		floor,
		terrainBands: [],
		summary: {
			meshTopology: 'single-continuous-heightfield',
			terrainMeshId: floor.id,
			terrainVertices: floor.vertexCount,
			terrainTriangles: floor.triangleCount,
			bottomGroundId: bottomGround.id,
			bottomGroundPolicy:
				'large y=0 scene-bottom surface catches rays beyond the finite mountain mesh so distant ground is not rendered as sky',
			terrainBandCount: 0,
		},
	};
}

function createThreeTerrainMountainSpec(seedValue) {
	const seed = String(seedValue || 'algorithm32-three-terrain-js-v1');
	const numericSeed = numericSeedFromString(seed);
	const ridgeFeatures = withScopedSeededMathRandom(
		numericSeed ^ 0x9e3779b9,
		() =>
			Array.from({ length: 16 }, () => ({
				u: randomRange(0.08, 0.92),
				v: randomRange(0.28, 0.96),
				widthU: randomRange(0.025, 0.09),
				widthV: randomRange(0.04, 0.16),
				height: randomRange(650, 2200),
			}))
	);
	const floor = {
		kind: 'three-terrain-js-heightfield',
		backend: TERRAIN_BACKENDS.threeTerrainJs,
		id: 'three-terrain-js-ridge-valley-v2',
		spectrumId: 'mountainRidgeGreen',
		color: [0.055, 0.145, 0.055],
		widthMeters: 264000,
		depthMeters: 44400,
		centerZMeters: -19800,
		segmentsX: 127,
		segmentsZ: 127,
		minHeight: 0,
		maxHeight: 9000,
		frequency: 3.4,
		heightmap: 'PerlinLayers',
		easing: 'EaseInOut',
		steps: 1,
		stretch: true,
		afterKind: 'ridge-valley-v2',
		ridgeFeatures,
		vertexColoring: true,
		surfaceTexture: true,
		surfaceDetailGeometry: true,
		surfaceDetailCount: 180,
		surfaceRidgeLineCount: 14,
		surfaceRidgeLineSamples: 56,
		numericSeed,
		material: { roughness: 0.94, metalness: 0 },
		bounds: {
			xMin: -132000,
			xMax: 132000,
			zNear: 2400,
			zFar: -42000,
			minHeight: 0,
			maxHeight: 9000,
		},
		vertexCount: 128 * 128,
		triangleCount: 127 * 127 * 2,
	};
	const bottomGround = buildBottomGroundSurface();
	return {
		kind: 'three-terrain-js-mountain-detail-v1',
		terrainBackend: TERRAIN_BACKENDS.threeTerrainJs,
		seed,
		numericSeed,
		generatedBy:
			'three.terrain.js TerrainNS.PerlinLayers with scoped deterministic Math.random, ridge-valley after shaping, height/slope vertex colors, surface texture, raised ridge-line strips, and outcrop detail geometry',
		coordinateSystem: 'THREE meters, y-up, x-horizontal, negative z into view',
		cameraProfile: 'three-terrain-ridge-valley-wide',
		ambientIntensity: 0.055,
		bottomGround,
		floor,
		terrainBands: [],
		summary: {
			meshTopology: 'single-three.terrain.js-heightfield',
			terrainMeshId: floor.id,
			terrainVertices: floor.vertexCount,
			terrainTriangles: floor.triangleCount,
			bottomGroundId: bottomGround.id,
			bottomGroundPolicy:
				'large y=0 scene-bottom surface catches rays beyond the finite package terrain mesh so distant ground is not rendered as sky',
			terrainBandCount: 0,
			terrainBackend: TERRAIN_BACKENDS.threeTerrainJs,
			package: 'three.terrain.js',
			packageHeightmap: floor.heightmap,
			afterKind: floor.afterKind,
			vertexColoring: floor.vertexColoring,
			surfaceTexture: floor.surfaceTexture,
			surfaceDetailGeometry: floor.surfaceDetailGeometry,
			surfaceDetailCount: floor.surfaceDetailCount,
			surfaceRidgeLineCount: floor.surfaceRidgeLineCount,
			surfaceRidgeLineSamples: floor.surfaceRidgeLineSamples,
		},
	};
}

async function createRockyLandHeightmapTerrainSpec(seedValue) {
	const seed = String(seedValue || 'rocky-land-and-rivers-heightmap-v1');
	const numericSeed = numericSeedFromString(seed);
	const floor = await buildRockyLandHeightmapTerrainMesh({
		id: 'rocky-land-and-rivers-heightmap-terrain',
		numericSeed,
	});
	const bottomGround = buildBottomGroundSurface();
	return {
		kind: 'rocky-land-heightmap-mountain-detail-v1',
		terrainBackend: TERRAIN_BACKENDS.rockyLandHeightmap,
		seed,
		numericSeed,
		generatedBy:
			'Rocky Land and Rivers CC0 height map PNG sampled in-browser into a single Three BufferGeometry',
		coordinateSystem: 'THREE meters, y-up, x-horizontal, negative z into view',
		cameraProfile: 'rocky-land-heightmap-ridge-view',
		ambientIntensity: 0.05,
		bottomGround,
		floor,
		terrainBands: [],
		summary: {
			meshTopology: 'single-asset-heightmap-buffer-geometry',
			terrainMeshId: floor.id,
			terrainVertices: floor.vertexCount,
			terrainTriangles: floor.triangleCount,
			bottomGroundId: bottomGround.id,
			bottomGroundPolicy:
				'large y=0 scene-bottom surface catches rays beyond the finite asset terrain mesh so distant ground is not rendered as sky',
			terrainBandCount: 0,
			terrainBackend: TERRAIN_BACKENDS.rockyLandHeightmap,
			sourceAsset: floor.sourceAsset,
			heightmapSampling: floor.heightmapSampling,
		},
	};
}

async function createSouthernFranceObjGeometrySpec(seedValue) {
	const seed = String(seedValue || 'southern-france-blender-obj-v1');
	const numericSeed = numericSeedFromString(seed);
	const floor = await buildSouthernFranceObjGeometryMesh({
		numericSeed,
		backend: TERRAIN_BACKENDS.southernFranceObjGeometry,
	});
	const bottomGround = buildBottomGroundSurface();
	return {
		kind: 'southern-france-obj-geometry-v1',
		terrainBackend: TERRAIN_BACKENDS.southernFranceObjGeometry,
		seed,
		numericSeed,
		generatedBy:
			'Southern France Blender OBJ loaded with Three OBJLoader and rendered with a single matte material',
		coordinateSystem:
			'Source OBJ is Z-up; POC remaps source x -> Three x, source y -> Three z, source z -> Three y',
		cameraProfile: 'southern-france-obj-ridge-view',
		ambientIntensity: 0.06,
		bottomGround,
		floor,
		terrainBands: [],
		summary: {
			meshTopology: 'southern-france-blender-obj-geometry-only',
			terrainMeshId: floor.id,
			terrainVertices: floor.vertexCount,
			terrainTriangles: floor.triangleCount,
			bottomGroundId: bottomGround.id,
			bottomGroundPolicy:
				'large y=0 scene-bottom surface remains behind the real OBJ mesh so distant ground is not rendered as sky',
			terrainBandCount: 0,
			terrainBackend: TERRAIN_BACKENDS.southernFranceObjGeometry,
			sourceAsset: floor.sourceAsset,
			sourceMesh: floor.sourceMesh,
			transform: floor.transform,
		},
	};
}

async function createSouthernFranceObjDiffuseSpec(seedValue) {
	const seed = String(seedValue || 'southern-france-blender-obj-diffuse-v1');
	const numericSeed = numericSeedFromString(seed);
	const diffuseSetup = await loadSouthernFranceDiffuseTextures();
	const floor = await buildSouthernFranceObjGeometryMesh({
		numericSeed,
		backend: TERRAIN_BACKENDS.southernFranceObjDiffuse,
		diffuseSetup,
	});
	const bottomGround = buildBottomGroundSurface();
	return {
		kind: 'southern-france-obj-diffuse-v1',
		terrainBackend: TERRAIN_BACKENDS.southernFranceObjDiffuse,
		seed,
		numericSeed,
		generatedBy:
			'Southern France Blender OBJ loaded with Three OBJLoader and diffuse TGA maps loaded with TGALoader',
		coordinateSystem:
			'Source OBJ is Z-up; POC remaps source x -> Three x, source y -> Three z, source z -> Three y',
		cameraProfile: 'southern-france-obj-ridge-view',
		ambientIntensity: 0.06,
		bottomGround,
		floor,
		terrainBands: [],
		summary: {
			meshTopology: 'southern-france-blender-obj-diffuse-textured',
			terrainMeshId: floor.id,
			terrainVertices: floor.vertexCount,
			terrainTriangles: floor.triangleCount,
			bottomGroundId: bottomGround.id,
			bottomGroundPolicy:
				'large y=0 scene-bottom surface remains behind the real OBJ mesh so distant ground is not rendered as sky',
			terrainBandCount: 0,
			terrainBackend: TERRAIN_BACKENDS.southernFranceObjDiffuse,
			sourceAsset: floor.sourceAsset,
			sourceMesh: floor.sourceMesh,
			transform: floor.transform,
			materialPolicy: floor.materialPolicy,
			diffuseTextures: floor.diffuseManifest,
		},
	};
}

async function buildSouthernFranceObjGeometryMesh({
	numericSeed,
	backend,
	diffuseSetup = null,
}) {
	const loadedObject = await loadSouthernFranceObj();
	const sourceBounds = {
		minX: -164125.0625,
		maxX: 100434.75,
		minY: -112238.882813,
		maxY: 114357.015625,
		minZ: -10594.121094,
		maxZ: 43008.707031,
	};
	const transform = {
		kind: 'source-z-up-to-three-y-up-fit-v1',
		sourceToThreeMapping: 'source x -> Three x, source y -> Three z, source z -> Three y',
		sourceCenterX: (sourceBounds.minX + sourceBounds.maxX) * 0.5,
		sourceMinY: sourceBounds.minY,
		sourceRangeY: sourceBounds.maxY - sourceBounds.minY,
		sourceMinZ: sourceBounds.minZ,
		horizontalScale: 0.41,
		verticalScale: 0.105,
		baseHeight: 0,
		offsetX: 0,
		zNear: 18000,
		zFar: -76000,
	};
	return {
		kind:
			backend === TERRAIN_BACKENDS.southernFranceObjDiffuse
				? 'southern-france-obj-diffuse'
				: 'southern-france-obj-geometry',
		backend,
		id: 'southern-france-obj-terrain',
		spectrumId: 'mountainRidgeGreen',
		color: [
			0.14 + ((numericSeed >>> 0) % 7) * 0.001,
			0.235,
			0.105,
		],
		loadedObject,
		transform,
		diffuseTexturesByMaterialId: diffuseSetup?.texturesByMaterialId || null,
		diffuseManifest: diffuseSetup?.manifest || null,
		materialPolicy:
			backend === TERRAIN_BACKENDS.southernFranceObjDiffuse
				? {
						kind: 'diffuse-tga-only',
						loader: 'THREE.TGALoader',
						roughness: 0.96,
						normalMapsUsed: false,
						roughnessMapsUsed: false,
						emissiveMapsUsed: false,
						reflectionMapsUsed: false,
					}
				: {
						kind: 'single-matte-material',
						roughness: 0.96,
						texturesUsed: false,
					},
		sourceAsset: {
			name: 'Mountain Range in Southern France Blender OBJ',
			sourceZipPath:
				'Designs/landscapes/uploads_files_2061262_Mountain+Range+in+Southern+France_Blender_OBJ.zip',
			stagedObjUrl: SOUTHERN_FRANCE_OBJ_URL,
			stagedMtlUrl: SOUTHERN_FRANCE_MTL_URL,
			license: 'not found in zip during local inspection',
		},
		sourceMesh: {
			vertexCount: 268472,
			texCoordCount: 69960,
			normalCount: 65568,
			triangleFaceCount: 122937,
			groupCount: 207,
			materialCount: 28,
			missingReferencedTextures: 0,
			sourceBounds,
		},
		material: { roughness: 0.96, metalness: 0 },
		bounds: {
			xMin:
				(sourceBounds.minX - transform.sourceCenterX) *
					transform.horizontalScale +
				transform.offsetX,
			xMax:
				(sourceBounds.maxX - transform.sourceCenterX) *
					transform.horizontalScale +
				transform.offsetX,
			zNear: transform.zNear,
			zFar: transform.zFar,
			minHeight: transform.baseHeight,
			maxHeight:
				(sourceBounds.maxZ - sourceBounds.minZ) * transform.verticalScale +
				transform.baseHeight,
		},
		vertexCount: 268472,
		triangleCount: 122937,
	};
}

function loadSouthernFranceObj() {
	if (!southernFranceObjPromise) {
		const loader = new OBJLoader();
		southernFranceObjPromise = loader.loadAsync(SOUTHERN_FRANCE_OBJ_URL);
	}
	return southernFranceObjPromise;
}

async function loadSouthernFranceDiffuseTextures() {
	if (!southernFranceDiffuseTexturesPromise) {
		const loader = new TGALoader();
		southernFranceDiffuseTexturesPromise = Promise.all(
			SOUTHERN_FRANCE_MATERIAL_IDS.map(async (materialId) => {
				const fileName = `Mountain Range in Southern France_${materialId}_diffuse.tga`;
				const texture = await loader.loadAsync(
					`${SOUTHERN_FRANCE_DIFFUSE_TEXTURE_BASE_URL}${fileName}`
				);
				texture.name = `${materialId}_diffuse`;
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.wrapS = THREE.ClampToEdgeWrapping;
				texture.wrapT = THREE.ClampToEdgeWrapping;
				texture.needsUpdate = true;
				return {
					materialId,
					fileName,
					texture,
					width: texture.image?.width || null,
					height: texture.image?.height || null,
				};
			})
		).then((entries) => {
			const texturesByMaterialId = {};
			for (const entry of entries) {
				texturesByMaterialId[entry.materialId] = entry.texture;
			}
			return {
				texturesByMaterialId,
				manifest: {
					kind: 'southern-france-diffuse-texture-manifest',
					sourceZipPath:
						'Designs/landscapes/uploads_files_2061262_Mountain+Range+in+Southern+France_Blender_OBJ.zip',
					stagedDirectory:
						'scripts/flat/local-second-order/page/assets/southern-france-blender-obj/diffuse-tga-source/',
					loader: 'THREE.TGALoader',
					materialCount: entries.length,
					textureFormat: 'tga',
					textureRole: 'diffuse-only',
					normalMapsUsed: false,
					roughnessMapsUsed: false,
					textures: entries.map((entry) => ({
						materialId: entry.materialId,
						fileName: entry.fileName,
						width: entry.width,
						height: entry.height,
					})),
				},
			};
		});
	}
	return southernFranceDiffuseTexturesPromise;
}

async function buildRockyLandHeightmapTerrainMesh({ id, numericSeed }) {
	const heightmap = await loadRockyLandHeightmapImageData();
	const definition = {
		id,
		xMin: -100000,
		xMax: 100000,
		zNear: 16000,
		zFar: -62000,
		segmentsX: 191,
		segmentsZ: 191,
		minHeight: 60,
		heightRange: 5600,
	};
	const rawValues = [];
	let rawMin = Number.POSITIVE_INFINITY;
	let rawMax = Number.NEGATIVE_INFINITY;
	for (let iz = 0; iz <= definition.segmentsZ; iz += 1) {
		const v = iz / definition.segmentsZ;
		for (let ix = 0; ix <= definition.segmentsX; ix += 1) {
			const u = ix / definition.segmentsX;
			const raw = sampleHeightmapLuminance(heightmap, u, v);
			rawValues.push(raw);
			rawMin = Math.min(rawMin, raw);
			rawMax = Math.max(rawMax, raw);
		}
	}
	const rawRange = Math.max(1, rawMax - rawMin);
	const heights = rawValues.map((raw) => {
		const normalized = clamp01((raw - rawMin) / rawRange);
		const shaped = Math.pow(normalized, 1.08);
		return definition.minHeight + shaped * definition.heightRange;
	});
	const positions = [];
	const colors = [];
	const indices = [];
	let minHeight = Number.POSITIVE_INFINITY;
	let maxHeight = Number.NEGATIVE_INFINITY;
	for (let iz = 0; iz <= definition.segmentsZ; iz += 1) {
		const v = iz / definition.segmentsZ;
		for (let ix = 0; ix <= definition.segmentsX; ix += 1) {
			const u = ix / definition.segmentsX;
			const index = iz * (definition.segmentsX + 1) + ix;
			const height = heights[index];
			minHeight = Math.min(minHeight, height);
			maxHeight = Math.max(maxHeight, height);
			const x = interpolate(definition.xMin, definition.xMax, u);
			const z = interpolate(definition.zNear, definition.zFar, v);
			const heightT = clamp01(
				(height - definition.minHeight) / definition.heightRange
			);
			const slopeT = rockyLandHeightSlope({
				heights,
				ix,
				iz,
				segmentsX: definition.segmentsX,
				segmentsZ: definition.segmentsZ,
				cellWidth:
					(definition.xMax - definition.xMin) / definition.segmentsX,
				cellDepth:
					(definition.zNear - definition.zFar) / definition.segmentsZ,
			});
			const color = rockyLandTerrainColor({ heightT, slopeT, u, v, numericSeed });
			positions.push(round3(x), round3(height), round3(z));
			colors.push(color[0], color[1], color[2]);
		}
	}
	pushGridIndices(indices, definition.segmentsX, definition.segmentsZ);
	return {
		kind: 'rocky-land-heightmap-buffer-geometry',
		backend: TERRAIN_BACKENDS.rockyLandHeightmap,
		id: definition.id,
		spectrumId: 'mountainRidgeGreen',
		sourceAsset: {
			name: 'Rocky Land and Rivers',
			browserUrl: ROCKY_LAND_HEIGHTMAP_URL,
			repoAssetPath:
				'scripts/flat/local-second-order/page/assets/rocky-land-and-rivers/Height Map PNG.png',
			sourceZipPath: 'Designs/landscapes/Rocky Land and Rivers.zip',
			license: 'CC0/no attribution required per bundled Readme_HeightMaps.pdf',
		},
		heightmapSampling: {
			sourceImagePixels: [heightmap.width, heightmap.height],
			canvasReadback:
				'browser getImageData RGBA8 readback from original 16-bit PNG; normalized over sampled grid for POC geometry',
			rawLuminanceMin: round3(rawMin),
			rawLuminanceMax: round3(rawMax),
			segmentsX: definition.segmentsX,
			segmentsZ: definition.segmentsZ,
			minHeightMeters: definition.minHeight,
			heightRangeMeters: definition.heightRange,
		},
		positions,
		colors,
		indices,
		material: { roughness: 0.95, metalness: 0 },
		bounds: {
			xMin: definition.xMin,
			xMax: definition.xMax,
			zNear: definition.zNear,
			zFar: definition.zFar,
			minHeight: round3(minHeight),
			maxHeight: round3(maxHeight),
		},
		vertexCount: positions.length / 3,
		triangleCount: indices.length / 3,
	};
}

function loadRockyLandHeightmapImageData() {
	if (!rockyLandHeightmapPromise) {
		rockyLandHeightmapPromise = new Promise((resolve, reject) => {
			const image = new Image();
			image.onload = () => {
				const canvas = document.createElement('canvas');
				canvas.width = image.naturalWidth;
				canvas.height = image.naturalHeight;
				const context = canvas.getContext('2d', { willReadFrequently: true });
				context.drawImage(image, 0, 0);
				resolve({
					width: canvas.width,
					height: canvas.height,
					imageData: context.getImageData(0, 0, canvas.width, canvas.height),
				});
			};
			image.onerror = () =>
				reject(
					new Error(
						`Unable to load Rocky Land and Rivers heightmap asset: ${ROCKY_LAND_HEIGHTMAP_URL}`
					)
				);
			image.src = ROCKY_LAND_HEIGHTMAP_URL;
		});
	}
	return rockyLandHeightmapPromise;
}

function sampleHeightmapLuminance(heightmap, u, v) {
	const x = Math.max(
		0,
		Math.min(heightmap.width - 1, Math.round(clamp01(u) * (heightmap.width - 1)))
	);
	const y = Math.max(
		0,
		Math.min(heightmap.height - 1, Math.round(clamp01(v) * (heightmap.height - 1)))
	);
	const offset = (y * heightmap.width + x) * 4;
	const data = heightmap.imageData.data;
	return data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
}

function rockyLandHeightSlope({
	heights,
	ix,
	iz,
	segmentsX,
	segmentsZ,
	cellWidth,
	cellDepth,
}) {
	const stride = segmentsX + 1;
	const clampedX0 = Math.max(0, ix - 1);
	const clampedX1 = Math.min(segmentsX, ix + 1);
	const clampedZ0 = Math.max(0, iz - 1);
	const clampedZ1 = Math.min(segmentsZ, iz + 1);
	const hLeft = heights[iz * stride + clampedX0];
	const hRight = heights[iz * stride + clampedX1];
	const hNear = heights[clampedZ0 * stride + ix];
	const hFar = heights[clampedZ1 * stride + ix];
	const dx = Math.max(cellWidth, (clampedX1 - clampedX0) * cellWidth);
	const dz = Math.max(cellDepth, (clampedZ1 - clampedZ0) * cellDepth);
	const slopeX = Math.abs(hRight - hLeft) / dx;
	const slopeZ = Math.abs(hFar - hNear) / dz;
	return clamp01(Math.sqrt(slopeX * slopeX + slopeZ * slopeZ) / 0.42);
}

function rockyLandTerrainColor({ heightT, slopeT, u, v, numericSeed }) {
	const lowForest = [0.045, 0.14, 0.045];
	const forest = [0.07, 0.21, 0.065];
	const alpine = [0.16, 0.24, 0.105];
	const rock = [0.36, 0.34, 0.25];
	const shadow = [0.03, 0.08, 0.035];
	const highMix = smoothstep(0.34, 0.82, heightT);
	const rockMix = clamp01(smoothstep(0.56, 0.95, heightT) * 0.58 + slopeT * 0.52);
	const shade =
		0.88 +
		0.07 * Math.sin((u * 37.0 + v * 19.0 + numericSeed * 0.000001) * Math.PI) +
		0.05 * Math.sin((u * 91.0 - v * 47.0) * Math.PI);
	let color = mixRgb(lowForest, forest, smoothstep(0.0, 0.36, heightT));
	color = mixRgb(color, alpine, highMix * 0.65);
	color = mixRgb(color, rock, rockMix);
	color = mixRgb(color, shadow, slopeT * 0.12);
	return color.map((channel) => round4(Math.max(0, channel * shade)));
}

function buildBottomGroundSurface() {
	return {
		kind: 'mountain-detail-bottom-ground-plane',
		id: 'detail-bottom-ground-plane',
		spectrumId: 'ground',
		color: [0.055, 0.115, 0.055],
		centerMeters: [0, 0, -140000],
		widthMeters: 620000,
		depthMeters: 620000,
		material: { roughness: 0.98, metalness: 0 },
		bounds: {
			xMin: -310000,
			xMax: 310000,
			zNear: 170000,
			zFar: -450000,
			y: 0,
		},
	};
}

function buildContinuousDetailedTerrainMesh() {
	const definition = {
		id: 'detail-continuous-valley-and-mountains',
		xMin: -132000,
		xMax: 132000,
		zNear: 2400,
		zFar: -42000,
		segmentsX: 72,
		segmentsZ: 40,
	};
	const features = continuousTerrainFeatures();
	const positions = [];
	const colors = [];
	const indices = [];
	let minHeight = Number.POSITIVE_INFINITY;
	let maxHeight = Number.NEGATIVE_INFINITY;
	for (let iz = 0; iz <= definition.segmentsZ; iz += 1) {
		const v = iz / definition.segmentsZ;
		for (let ix = 0; ix <= definition.segmentsX; ix += 1) {
			const u = ix / definition.segmentsX;
			const x = interpolate(definition.xMin, definition.xMax, u);
			const z = interpolate(definition.zNear, definition.zFar, v);
			const height = continuousTerrainHeight({ features, u, v });
			minHeight = Math.min(minHeight, height);
			maxHeight = Math.max(maxHeight, height);
			positions.push(round3(x), round3(height), round3(z));
			colors.push(...continuousTerrainColor().map((channel) => round4(channel)));
		}
	}
	pushGridIndices(indices, definition.segmentsX, definition.segmentsZ);
	return {
		kind: 'mountain-detail-continuous-heightfield',
		id: definition.id,
		spectrumId: 'mountainRidgeGreen',
		positions,
		colors,
		indices,
		material: { roughness: 0.94, metalness: 0 },
		bounds: {
			xMin: definition.xMin,
			xMax: definition.xMax,
			zNear: definition.zNear,
			zFar: definition.zFar,
			minHeight: round3(minHeight),
			maxHeight: round3(maxHeight),
		},
		vertexCount: positions.length / 3,
		triangleCount: indices.length / 3,
	};
}

function continuousTerrainFeatures() {
	return {
		peaks: Array.from({ length: 18 }, () => ({
			u: randomRange(0.08, 0.92),
			v: randomRange(0.1, 0.98),
			widthU: randomRange(0.035, 0.14),
			widthV: randomRange(0.045, 0.2),
			height: randomRange(1200, 5200),
			sharpness: randomRange(0.85, 1.6),
		})),
		waves: Array.from({ length: 7 }, () => ({
			amplitude: randomRange(40, 280),
			frequencyU: randomRange(1.4, 7.8),
			frequencyV: randomRange(0.6, 5.4),
			phase: randomRange(0, Math.PI * 2),
			vPower: randomRange(0.7, 1.5),
		})),
		gullies: Array.from({ length: 9 }, () => ({
			u: randomRange(0.14, 0.86),
			width: randomRange(0.012, 0.04),
			depth: randomRange(45, 260),
			phase: randomRange(0, Math.PI * 2),
		})),
	};
}

function continuousTerrainHeight({ features, u, v }) {
	const edgeEnvelope = Math.pow(Math.sin(Math.PI * clamp01(u)), 0.38);
	const mountainRamp = smoothstep(0.045, 0.74, v);
	const nearValleyFade = smoothstep(0.0, 0.15, v);
	const farRamp = Math.pow(mountainRamp, 1.04);
	const valleyChannel = Math.exp(-Math.pow((u - 0.5) / 0.22, 2));
	const sideSlope = (1 - valleyChannel) * smoothstep(0.035, 0.42, v) * 2600;
	const nearRidge =
		3600 *
		Math.exp(-Math.pow((v - 0.12) / 0.055, 2)) *
		edgeEnvelope *
		(0.6 + 0.4 * Math.sin((u * 3.5 + 0.2) * Math.PI));
	const midRidge =
		6200 *
		Math.exp(-Math.pow((v - 0.28) / 0.09, 2)) *
		edgeEnvelope *
		(0.55 + 0.45 * Math.sin((u * 5.4 + 1.1) * Math.PI));
	const farRidge =
		8600 *
		Math.exp(-Math.pow((v - 0.58) / 0.16, 2)) *
		edgeEnvelope *
		(0.58 + 0.42 * Math.sin((u * 6.8 + 2.2) * Math.PI));
	let height =
		18 * Math.sin((u * 4.0 + v * 1.5) * Math.PI) * (1 - v * 0.35) +
		sideSlope +
		nearRidge +
		midRidge +
		farRidge +
		farRamp * 4800 +
		edgeEnvelope * farRamp * 2600 -
		valleyChannel * nearValleyFade * 180;
	for (const peak of features.peaks) {
		const du = (u - peak.u) / peak.widthU;
		const dv = (v - peak.v) / peak.widthV;
		const distance = Math.pow(du * du + dv * dv, peak.sharpness);
		height +=
			peak.height *
			Math.exp(-distance) *
			smoothstep(0.08, 1.0, peak.v) *
			edgeEnvelope;
	}
	for (const wave of features.waves) {
		height +=
			wave.amplitude *
			Math.sin((u * wave.frequencyU + v * wave.frequencyV) * Math.PI + wave.phase) *
			Math.pow(v, wave.vPower) *
			edgeEnvelope;
	}
	for (const gully of features.gullies) {
		const center = gully.u + 0.035 * Math.sin(v * Math.PI * 3.0 + gully.phase);
		const du = (u - center) / gully.width;
		height -= gully.depth * Math.exp(-(du * du)) * smoothstep(0.18, 0.95, v);
	}
	const foregroundRoll =
		34 *
		Math.sin((u * 7.0 + 0.4) * Math.PI) *
		Math.sin((v * 3.1 + 0.2) * Math.PI) *
		(1 - smoothstep(0.12, 0.34, v));
	return Math.max(0, height + foregroundRoll);
}

function continuousTerrainColor() {
	return [0.045, 0.14, 0.06];
}

function disposeSceneSetup(sceneSetup) {
	for (const mesh of sceneSetup.meshes) {
		mesh.geometry?.dispose?.();
		if (Array.isArray(mesh.material)) {
			for (const material of mesh.material) {
				material.map?.dispose?.();
				material.dispose?.();
			}
		} else {
			mesh.material?.map?.dispose?.();
			mesh.material?.dispose?.();
		}
	}
	sceneSetup.renderer.dispose();
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

function algorithmDirectionToThreeArray(vector) {
	return [vector[0], vector[2], -vector[1]];
}

function algorithmPositionToThreeArray(position) {
	return [position[0], position[2], -position[1]];
}

function pixelToNdc(x, y, width, height) {
	return {
		x: ((x + 0.5) / width) * 2 - 1,
		y: -(((y + 0.5) / height) * 2 - 1),
	};
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

function pushGridIndices(indices, segmentsX, segmentsZ) {
	const stride = segmentsX + 1;
	for (let iz = 0; iz < segmentsZ; iz += 1) {
		for (let ix = 0; ix < segmentsX; ix += 1) {
			const a = iz * stride + ix;
			const b = a + 1;
			const c = a + stride;
			const d = c + 1;
			indices.push(a, c, b, b, c, d);
		}
	}
}

function numericSeedFromString(value) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function seededRandom() {
	randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
	return randomState / 4294967296;
}

function withScopedSeededMathRandom(seed, callback) {
	const previousRandom = Math.random;
	const previousState = randomState;
	randomState = seed >>> 0;
	Math.random = seededRandom;
	try {
		return callback();
	} finally {
		Math.random = previousRandom;
		randomState = previousState;
	}
}

function randomRange(min, max) {
	return min + (max - min) * seededRandom();
}

function smoothstep(edge0, edge1, value) {
	const t = clamp01((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

function interpolate(a, b, t) {
	return a + (b - a) * t;
}

function clamp01(value) {
	return Math.max(0, Math.min(1, value));
}

function mixRgb(left, right, amount) {
	const t = clamp01(amount);
	return [
		interpolate(left[0], right[0], t),
		interpolate(left[1], right[1], t),
		interpolate(left[2], right[2], t),
	];
}

function round3(value) {
	return Math.round(value * 1000) / 1000;
}

function round4(value) {
	return Math.round(value * 10000) / 10000;
}

function formatOneDecimal(value) {
	const number = Number(value);
	if (!Number.isFinite(number)) {
		return 'n/a';
	}
	return number.toFixed(1);
}

function degreesToRadians(degrees) {
	return degrees * (Math.PI / 180);
}

function radiansToDegrees(radians) {
	return radians * (180 / Math.PI);
}

function normalizeDegrees(degrees) {
	return ((degrees % 360) + 360) % 360;
}

function vectorToArray(vector) {
	return Array.isArray(vector) ? vector : [vector.x, vector.y, vector.z];
}

function luminanceRgb(rgba) {
	return rgba[0] * 0.2126 + rgba[1] * 0.7152 + rgba[2] * 0.0722;
}

function captureCanvasImageData(canvas, width, height) {
	const captureCanvas = document.createElement('canvas');
	captureCanvas.width = width;
	captureCanvas.height = height;
	const captureContext = captureCanvas.getContext('2d', { willReadFrequently: true });
	captureContext.drawImage(canvas, 0, 0, width, height);
	return captureContext.getImageData(0, 0, width, height);
}

function canvasDataUrlAtSize(canvas, width, height) {
	if (canvas.width === width && canvas.height === height) {
		return canvas.toDataURL('image/png');
	}
	const outputCanvas = document.createElement('canvas');
	outputCanvas.width = width;
	outputCanvas.height = height;
	const outputContext = outputCanvas.getContext('2d');
	outputContext.imageSmoothingEnabled = true;
	outputContext.imageSmoothingQuality = 'high';
	outputContext.drawImage(canvas, 0, 0, width, height);
	return outputCanvas.toDataURL('image/png');
}

function samplePixelsFromImageData(imageData, samples) {
	return samples.map((sample) => {
		const x = Math.max(0, Math.min(imageData.width - 1, sample.x));
		const y = Math.max(0, Math.min(imageData.height - 1, sample.y));
		const offset = (y * imageData.width + x) * 4;
		const rgba = Array.from(imageData.data.slice(offset, offset + 4));
		return {
			id: sample.id,
			x,
			y,
			rgba,
			luminance: luminanceRgb(rgba),
		};
	});
}

function rgbaImageStats(rgba) {
	let minByte = 255;
	let maxByte = 0;
	let nonfiniteValues = 0;
	let sumLuminance = 0;
	const pixelCount = rgba.length / 4;
	for (let index = 0; index < rgba.length; index += 4) {
		const r = rgba[index];
		const g = rgba[index + 1];
		const b = rgba[index + 2];
		const a = rgba[index + 3];
		if (
			!Number.isFinite(r) ||
			!Number.isFinite(g) ||
			!Number.isFinite(b) ||
			!Number.isFinite(a)
		) {
			nonfiniteValues += 1;
			continue;
		}
		minByte = Math.min(minByte, r, g, b, a);
		maxByte = Math.max(maxByte, r, g, b, a);
		sumLuminance += luminanceRgb([r, g, b, a]);
	}
	return {
		pixelCount,
		minByte,
		maxByte,
		meanLuminance: pixelCount > 0 ? sumLuminance / pixelCount : 0,
		nonfiniteValues,
	};
}

function normalize(vector) {
	const magnitude = Math.hypot(...vector);
	return magnitude === 0 ? [0, 0, 0] : vector.map((value) => value / magnitude);
}

function addArrays(left, right) {
	return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subtractArrays(left, right) {
	return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}
