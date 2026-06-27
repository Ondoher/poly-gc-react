import * as THREE from 'three';
import { SPECTRAL_CHANNELS, createFlatLocalSunAlgorithm32Model } from '../cpu/algorithm32-transport.js';
import {
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
} from '../source-contract/algorithm32-source-contract.js';
import {
	buildLocalIncidentGridCache,
	makeDefaultLocalIncidentCacheConfig,
	makeLocalIncomingDirections,
	packLocalIncidentCacheToRgba3D,
} from '../local-second-order/local-cache.js';
import { Algorithm32AtmospherePass } from './shader-lab-page.js';

/**
 * Create the accepted local second-order cache texture for the Three shader.
 *
 * @param {object} packed - Packed local incident cache payload.
 * @returns {THREE.Data3DTexture} Uploadable Three 3D texture.
 */
export function createLocalIncidentData3DTexture(packed) {
	const texture = new THREE.Data3DTexture(
		packed.data,
		packed.width,
		packed.height,
		packed.depth
	);
	texture.format = THREE.RGBAFormat;
	texture.type = THREE.FloatType;
	texture.minFilter = THREE.NearestFilter;
	texture.magFilter = THREE.NearestFilter;
	texture.wrapS = THREE.ClampToEdgeWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.wrapR = THREE.ClampToEdgeWrapping;
	texture.unpackAlignment = 1;
	texture.needsUpdate = true;
	texture.name = 'Algorithm32LocalIncidentCache';
	return texture;
}

/**
 * Build the shader config that actually feeds the Algorithm32 display pass.
 *
 * @param {object} options - Source, geometry, display, and cache options.
 * @returns {object} Pass config plus cache diagnostics and disposal hook.
 */
export function createAlgorithm32PocPassConfig({
	sourcePacket,
	geometryPacket,
	cachePayload = null,
	displayPayload = null,
}) {
	const display = createAlgorithm32PocDisplayConfig(displayPayload);

	if (sourcePacket?.kind !== 'flat-local-point-sun') {
		return {
			config: {
				source: {
					...sourcePacket,
					color: sourcePacket?.color || { r: 1, g: 0.98, b: 0.95 },
				},
				geometry: {
					kind: geometryPacket?.kind,
				},
				display,
			},
			localIncidentCache: null,
			dispose() {},
		};
	}

	const incomingDirections = makeLocalIncomingDirections(
		cachePayload?.incomingDirectionCount || 9
	);
	const cacheConfig = makeDefaultLocalIncidentCacheConfig({
		incomingDirections,
		zMeters: cachePayload?.zMeters,
		rhoMeters: cachePayload?.rhoMeters,
	});
	const source = createFlatLocalPointSunSource({
		...sourcePacket,
		spectralChannels: SPECTRAL_CHANNELS,
	});
	const geometry = createFlatZUpAtmosphereGeometry({
		topAltitudeMeters: geometryPacket.topAltitudeMeters,
		observerPositionMeters: geometryPacket.observerPositionMeters,
		sceneSkyRayLimitMeters: geometryPacket.sceneSkyRayLimitMeters,
		sceneSkyRayLimitPolicy: geometryPacket.sceneSkyRayLimitPolicy,
	});
	const model = createFlatLocalSunAlgorithm32Model({ source, geometry });
	const cache = buildLocalIncidentGridCache({
		model,
		sourceKey: source.id,
		cacheConfig,
		incomingDirections,
	});
	const packed = packLocalIncidentCacheToRgba3D(cache);
	const cacheTexture = createLocalIncidentData3DTexture(packed);

	return {
		config: {
			source: {
				kind: 'flat-local-point-sun',
				id: sourcePacket.id,
				positionMeters: sourcePacket.positionMeters,
				referenceDistanceKm: sourcePacket.referenceDistanceKm,
				referenceSpectralIncidentScale:
					sourcePacket.referenceSpectralIncidentScale,
				distanceFalloff: sourcePacket.distanceFalloff,
				color: sourcePacket.color,
			},
			geometry: {
				topAltitudeMeters: geometryPacket.topAltitudeMeters,
				sceneSkyRayLimitMeters: geometryPacket.sceneSkyRayLimitMeters,
				sceneSkyRayLimitPolicy: geometryPacket.sceneSkyRayLimitPolicy,
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
			display,
		},
		localIncidentCache: {
			kind: cache.kind,
			cacheKey: cache.cacheKey,
			sourceKey: cache.sourceKey,
			entries: cache.values.size,
			width: packed.width,
			height: packed.height,
			depth: packed.depth,
			zMeters: packed.zMeters,
			rhoMeters: packed.rhoMeters,
			incomingDirectionCount: packed.incomingDirections.length,
			spectralGroupCount: packed.spectralGroupCount,
		},
		dispose() {
			cacheTexture.dispose();
		},
	};
}

/**
 * Create the live Three scene-color/depth to Algorithm32 display pass path.
 *
 * @param {object} options - Three renderer, camera, and Algorithm32 packets.
 * @returns {object} Atmosphere pass wrapper with render and dispose methods.
 */
export function createAlgorithm32PocAtmospherePass({
	renderer,
	width,
	height,
	camera,
	sourcePacket,
	geometryPacket,
	cachePayload = null,
	displayPayload = null,
	maxDistanceMeters = null,
	distantMaxDistanceMeters = null,
}) {
	const passConfig = createAlgorithm32PocPassConfig({
		sourcePacket,
		geometryPacket,
		cachePayload,
		displayPayload,
	});
	const isLocal = sourcePacket?.kind === 'flat-local-point-sun';
	const mode = isLocal
		? 'flat-local-second-order-atmosphere'
		: 'distant-first-order-atmosphere';
	const pass = new Algorithm32AtmospherePass({
		renderer,
		width,
		height,
		camera,
		config: passConfig.config,
		mode,
		maxDistanceMeters:
			maxDistanceMeters ||
			(isLocal
				? geometryPacket?.sceneSkyRayLimitMeters || 20000000
				: distantMaxDistanceMeters || 20000000),
	});

	return {
		pass,
		mode,
		localIncidentCache: passConfig.localIncidentCache,
		display: passConfig.config.display,
		renderScene(scene, sceneCamera = camera) {
			pass.renderScene(scene, sceneCamera);
		},
		render(sceneCamera = camera) {
			pass.render({ camera: sceneCamera });
		},
		dispose() {
			pass.dispose();
			passConfig.dispose();
		},
	};
}

export function createAlgorithm32PocDisplayConfig(displayPayload) {
	const starField = displayPayload?.starField;
	if (starField?.enabled !== true) {
		return {};
	}
	return {
		starField: {
			enabled: true,
			kind: 'procedural-angular-point-stars',
			intensity: finiteNumberOrDefault(starField.intensity, 1),
			density: finiteNumberOrDefault(starField.density, 1),
			pointSize: finiteNumberOrDefault(starField.pointSize, 1),
			atmospherePolicy:
				'Procedural apparent-magnitude point sources are added only on sky rays as top-of-atmosphere radiance, divided by pixel solid angle, attenuated by view transmittance, and composed before the shared tone map.',
		},
	};
}

function finiteNumberOrDefault(value, fallback) {
	const number = Number(value);
	return Number.isFinite(number) ? number : fallback;
}
