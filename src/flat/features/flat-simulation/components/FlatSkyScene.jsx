import React, { useContext, useEffect, useMemo, useRef } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import FlatContext from '../../../common/FlatContext.js';
import { ProjectionModel } from '../../../shared/projection/index.js';
import { DEFAULT_EARTH_FLOOR_TEXTURE } from '../models/consts.js';
import { resolveAnimatedSun } from '../models/sun-animation.js';
import FlatAtmosphereComposer from './FlatAtmosphereComposer.jsx';

const OBSERVER_EYE_HEIGHT_KM = 0.0017;
const LOOK_SENSITIVITY = 0.003;
const MAX_LOOK_PITCH = Math.PI / 2 - 0.08;
const INITIAL_LOOK_HEIGHT_RATIO = 0.08;
const SCALE_CUE_HEIGHT_KM = 0.01;
const STAR_WORLD_SIZE_KM = 120;
const DOME_LATITUDE_STEP_DEG = 10;
const DOME_LATITUDE_SEGMENT_COUNT = 192;
const DOME_LATITUDE_RADIUS_OFFSET = 0.9995;
const LOCAL_FLOOR_SIZE_KM = 320;
const LOCAL_FLOOR_Y_KM = 0;
const DEFAULT_FALSE_SUN_RADIANCE_REFERENCE_DISTANCE_KM = 4800;
const DEFAULT_THREE_LIGHT_UNIT_SCALE = 0.04;
const DEFAULT_SKY_DIFFUSE_IRRADIANCE_SCALE = 0.35;
const DEFAULT_STAR_EXPOSURE = 0.02;
const DEFAULT_CONSTELLATION_OVERLAY_EXPOSURE = 0.04;
const EARTH_FLOOR_VERTEX_SHADER = `
	varying vec2 vUv;
	varying vec3 vWorldNormal;
	varying vec3 vWorldPosition;

	void main() {
		vUv = uv;
		vec4 worldPosition = modelMatrix * vec4(position, 1.0);

		vWorldNormal = normalize(mat3(modelMatrix) * normal);
		vWorldPosition = worldPosition.xyz;
		gl_Position = projectionMatrix * viewMatrix * worldPosition;
	}
`;
const EARTH_FLOOR_FRAGMENT_SHADER = `
	uniform sampler2D floorTexture;
	uniform float textureRotationRad;
	uniform vec3 sunPosition;
	uniform vec3 sunColor;
	uniform float sunIntensity;
	uniform float falseSunRadianceReferenceDistanceKm;
	uniform float falseSunRadianceDistanceFalloff;
	uniform float threeLightUnitScale;
	varying vec2 vUv;
	varying vec3 vWorldNormal;
	varying vec3 vWorldPosition;

	void main() {
		vec2 centeredUv = vUv - vec2(0.5);

		if (length(centeredUv) > 0.5) {
			discard;
		}

		float rotationCos = cos(textureRotationRad);
		float rotationSin = sin(textureRotationRad);
		vec2 rotatedUv = vec2(
			centeredUv.x * rotationCos - centeredUv.y * rotationSin,
			centeredUv.x * rotationSin + centeredUv.y * rotationCos
		);
		// Plane local-y maps to world -z; projection-y maps to world +z.
		vec2 projectedRatio = vec2(rotatedUv.x * 2.0, -rotatedUv.y * 2.0);
		float angularRatio = clamp(length(projectedRatio), 0.0, 1.0);
		float longitudeRad = atan(projectedRatio.x, projectedRatio.y);
		vec2 sampleUv = vec2(
			fract((longitudeRad / (3.141592653589793 * 2.0)) + 0.5),
			1.0 - angularRatio
		);
		vec4 textureColor = texture2D(floorTexture, sampleUv);
		vec3 lightVector = sunPosition - vWorldPosition;
		float lightDistance = max(length(lightVector), 0.000001);
		vec3 lightDirection = lightVector / lightDistance;
		float lambert = max(dot(normalize(vWorldNormal), lightDirection), 0.0);
		float referenceDistance = max(falseSunRadianceReferenceDistanceKm, 0.000001);
		float distanceFalloff = falseSunRadianceDistanceFalloff > 0.5
			? (referenceDistance * referenceDistance) / (lightDistance * lightDistance)
			: 1.0;
		vec3 directLight = sunColor
			* sunIntensity
			* threeLightUnitScale
			* distanceFalloff
			* lambert;

		gl_FragColor = vec4(textureColor.rgb * directLight, 1.0);
	}
`;
const LOCAL_FLOOR_VERTEX_SHADER = `
	varying vec3 vWorldNormal;
	varying vec3 vWorldPosition;

	void main() {
		vec4 worldPosition = modelMatrix * vec4(position, 1.0);

		vWorldNormal = normalize(mat3(modelMatrix) * normal);
		vWorldPosition = worldPosition.xyz;
		gl_Position = projectionMatrix * viewMatrix * worldPosition;
	}
`;
const LOCAL_FLOOR_FRAGMENT_SHADER = `
	uniform vec3 albedoColor;
	uniform vec3 sunPosition;
	uniform vec3 sunColor;
	uniform float sunIntensity;
	uniform float falseSunRadianceReferenceDistanceKm;
	uniform float falseSunRadianceDistanceFalloff;
	uniform float threeLightUnitScale;
	varying vec3 vWorldNormal;
	varying vec3 vWorldPosition;

	void main() {
		vec3 lightVector = sunPosition - vWorldPosition;
		float lightDistance = max(length(lightVector), 0.000001);
		vec3 lightDirection = lightVector / lightDistance;
		float lambert = max(dot(normalize(vWorldNormal), lightDirection), 0.0);
		float referenceDistance = max(falseSunRadianceReferenceDistanceKm, 0.000001);
		float distanceFalloff = falseSunRadianceDistanceFalloff > 0.5
			? (referenceDistance * referenceDistance) / (lightDistance * lightDistance)
			: 1.0;
		vec3 directLight = sunColor
			* sunIntensity
			* threeLightUnitScale
			* distanceFalloff
			* lambert;

		gl_FragColor = vec4(albedoColor * directLight, 1.0);
	}
`;

function observerCameraPosition(observer) {
	const position = observer?.position || {};
	const viewAltitudeKm = Number(observer?.view?.altitudeKm);

	return new THREE.Vector3(
		position.x || 0,
		(position.y || 0) + (Number.isFinite(viewAltitudeKm) ? viewAltitudeKm : OBSERVER_EYE_HEIGHT_KM),
		position.z || 0,
	);
}

function sceneCameraPosition(sceneCamera) {
	const position = sceneCamera?.position || {};

	return new THREE.Vector3(
		position.x || 0,
		position.y || 0,
		position.z || 0,
	);
}

function sceneCameraTarget(sceneCamera, domeRadius) {
	const target = sceneCamera?.target;

	if (target) {
		return new THREE.Vector3(
			target.x || 0,
			target.y || 0,
			target.z || 0,
		);
	}

	return new THREE.Vector3(0, domeRadius * INITIAL_LOOK_HEIGHT_RATIO, 0);
}

function shouldUseFalseSunRadianceDistanceFalloff(rendering) {
	return rendering?.falseSunRadiance?.model === 'point-inverse-square-reference'
		&& rendering.falseSunRadiance.distanceFalloff !== false;
}

function sunSceneLightIntensity(light, rendering) {
	const baseIntensity = Number(light?.intensity) || 0;
	const scale = Number.isFinite(Number(rendering?.threeLightUnitScale))
		? Number(rendering.threeLightUnitScale)
		: DEFAULT_THREE_LIGHT_UNIT_SCALE;

	if (!shouldUseFalseSunRadianceDistanceFalloff(rendering)) {
		return baseIntensity * scale;
	}

	const referenceDistance = Math.max(
		Number(rendering?.falseSunRadiance?.referenceDistanceKm) || DEFAULT_FALSE_SUN_RADIANCE_REFERENCE_DISTANCE_KM,
		0.000001,
	);
	const distance = Math.max(Number(light?.distanceKm) || referenceDistance, 0.000001);

	return baseIntensity * scale * (referenceDistance * referenceDistance) / (distance * distance);
}

function skyDiffuseIrradianceScale(rendering) {
	const scale = Number(rendering?.skyDiffuseIrradianceScale);

	return Number.isFinite(scale) ? Math.max(scale, 0) : DEFAULT_SKY_DIFFUSE_IRRADIANCE_SCALE;
}

function sunLightUniformValues(scene, solarRotationAngleRad = 0) {
	const rendering = scene?.atmosphere?.rendering;
	const resolvedSun = resolveAnimatedSun(scene?.sun, solarRotationAngleRad, {
		observerPosition: scene?.observer?.position,
	});
	const light = resolvedSun?.light || scene?.lighting?.sun;
	const color = light?.color || { r: 1, g: 1, b: 1 };

	return {
		sunPosition: [
			light?.position?.x || 0,
			light?.position?.y || 0,
			light?.position?.z || 0,
		],
		sunColor: [color.r || 0, color.g || 0, color.b || 0],
		sunIntensity: Number(light?.intensity) || 0,
		falseSunRadianceReferenceDistanceKm: Math.max(
			Number(rendering?.falseSunRadiance?.referenceDistanceKm) || DEFAULT_FALSE_SUN_RADIANCE_REFERENCE_DISTANCE_KM,
			0.000001,
		),
		falseSunRadianceDistanceFalloff: shouldUseFalseSunRadianceDistanceFalloff(rendering) ? 1 : 0,
		threeLightUnitScale: Number.isFinite(Number(rendering?.threeLightUnitScale))
			? Number(rendering.threeLightUnitScale)
			: DEFAULT_THREE_LIGHT_UNIT_SCALE,
	};
}

function updateSunLightUniforms(uniforms, scene, solarRotationAngleRad) {
	const values = sunLightUniformValues(scene, solarRotationAngleRad);

	uniforms.sunPosition.value[0] = values.sunPosition[0];
	uniforms.sunPosition.value[1] = values.sunPosition[1];
	uniforms.sunPosition.value[2] = values.sunPosition[2];
	uniforms.sunColor.value[0] = values.sunColor[0];
	uniforms.sunColor.value[1] = values.sunColor[1];
	uniforms.sunColor.value[2] = values.sunColor[2];
	uniforms.sunIntensity.value = values.sunIntensity;
	uniforms.falseSunRadianceReferenceDistanceKm.value = values.falseSunRadianceReferenceDistanceKm;
	uniforms.falseSunRadianceDistanceFalloff.value = values.falseSunRadianceDistanceFalloff;
	uniforms.threeLightUnitScale.value = values.threeLightUnitScale;
}

function useFlatAnimationLoop() {
	return useContext(FlatContext).animationLoop;
}

function animationFrame(animationLoop) {
	return animationLoop?.getFrame?.() || {
		rotationAngles: {
			solarDayRad: 0,
			siderealDayRad: 0,
		},
	};
}

function useAnimationLoopFrame(animationLoop, callback) {
	const callbackRef = useRef(callback);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	useEffect(() => {
		if (!animationLoop?.listenFrame) {
			return undefined;
		}

		const listenerId = animationLoop.listenFrame((frame) => {
			callbackRef.current(frame);
		});

		return () => {
			animationLoop.unlistenFrame(listenerId);
		};
	}, [animationLoop]);
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function exposureValue(value, fallback) {
	const exposure = Number(value);

	return Number.isFinite(exposure) ? Math.max(0, exposure) : fallback;
}

function initialLookAngles(position, target) {
	const direction = target.clone().sub(position).normalize();

	return {
		yaw: Math.atan2(-direction.x, -direction.z),
		pitch: Math.asin(direction.y),
	};
}

function applyLookRotation(camera, lookState) {
	camera.rotation.set(lookState.pitch, lookState.yaw, 0, 'YXZ');
}

function ObserverLookCamera({ observer, domeRadius, sceneCamera }) {
	const { camera, gl } = useThree();
	const lookRef = useRef({
		pointerId: null,
		lastX: 0,
		lastY: 0,
		yaw: 0,
		pitch: 0,
	});

	useEffect(() => {
		const position = sceneCamera ? sceneCameraPosition(sceneCamera) : observerCameraPosition(observer);
		const target = sceneCameraTarget(sceneCamera, domeRadius);
		const lookState = lookRef.current;
		const angles = initialLookAngles(position, target);

		camera.position.copy(position);
		camera.up.set(0, 1, 0);
		lookState.yaw = angles.yaw;
		lookState.pitch = angles.pitch;
		applyLookRotation(camera, lookState);
		camera.updateProjectionMatrix();
	}, [camera, domeRadius, observer, sceneCamera]);

	useEffect(() => {
		const canvas = gl.domElement;

		function onPointerDown(event) {
			const lookState = lookRef.current;

			lookState.pointerId = event.pointerId;
			lookState.lastX = event.clientX;
			lookState.lastY = event.clientY;
			canvas.setPointerCapture(event.pointerId);
			event.preventDefault();
		}

		function onPointerMove(event) {
			const lookState = lookRef.current;

			if (lookState.pointerId !== event.pointerId) {
				return;
			}

			const deltaX = event.clientX - lookState.lastX;
			const deltaY = event.clientY - lookState.lastY;

			lookState.lastX = event.clientX;
			lookState.lastY = event.clientY;
			lookState.yaw -= deltaX * LOOK_SENSITIVITY;
			lookState.pitch = clamp(
				lookState.pitch - deltaY * LOOK_SENSITIVITY,
				-MAX_LOOK_PITCH,
				MAX_LOOK_PITCH,
			);
			applyLookRotation(camera, lookState);
			event.preventDefault();
		}

		function onPointerUp(event) {
			const lookState = lookRef.current;

			if (lookState.pointerId !== event.pointerId) {
				return;
			}

			lookState.pointerId = null;
			canvas.releasePointerCapture(event.pointerId);
			event.preventDefault();
		}

		canvas.addEventListener('pointerdown', onPointerDown);
		canvas.addEventListener('pointermove', onPointerMove);
		canvas.addEventListener('pointerup', onPointerUp);
		canvas.addEventListener('pointercancel', onPointerUp);

		return () => {
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', onPointerUp);
			canvas.removeEventListener('pointercancel', onPointerUp);
		};
	}, [camera, gl]);

	return null;
}

function DebugOrthographicCamera({ sceneCamera }) {
	if (sceneCamera?.projection !== 'orthographic') {
		return null;
	}

	const { camera, size } = useThree();

	useEffect(() => {
		if (!camera.isOrthographicCamera) {
			return;
		}

		const viewWidth = sceneCamera.zoomKm || 42000;
		const aspect = size.width / Math.max(size.height, 1);
		const viewHeight = viewWidth / aspect;
		const position = sceneCameraPosition(sceneCamera);
		const target = sceneCameraTarget(sceneCamera, 0);

		camera.left = -viewWidth / 2;
		camera.right = viewWidth / 2;
		camera.top = viewHeight / 2;
		camera.bottom = -viewHeight / 2;
		camera.near = 0.0001;
		camera.far = 50000;
		camera.position.copy(position);
		camera.up.set(0, 0, -1);
		camera.lookAt(target);
		camera.updateProjectionMatrix();
	}, [camera, sceneCamera, size]);

	return null;
}

function EarthDisc({ radius, floorTexture, scene }) {
	const animationLoop = useFlatAnimationLoop();
	const textureConfig = floorTexture || DEFAULT_EARTH_FLOOR_TEXTURE;
	const texture = useLoader(THREE.TextureLoader, textureConfig.url);
	const frame = animationFrame(animationLoop);
	const solarRotationAngleRad = frame.rotationAngles.solarDayRad;
	const uniforms = useMemo(() => {
		const sunValues = sunLightUniformValues(scene, solarRotationAngleRad);

		texture.colorSpace = THREE.SRGBColorSpace;
		texture.generateMipmaps = false;
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;
		texture.anisotropy = 8;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;
		texture.needsUpdate = true;

		return {
			floorTexture: { value: texture },
			textureRotationRad: { value: textureConfig.textureRotationRad || 0 },
			sunPosition: { value: sunValues.sunPosition },
			sunColor: { value: sunValues.sunColor },
			sunIntensity: { value: sunValues.sunIntensity },
			falseSunRadianceReferenceDistanceKm: { value: sunValues.falseSunRadianceReferenceDistanceKm },
			falseSunRadianceDistanceFalloff: { value: sunValues.falseSunRadianceDistanceFalloff },
			threeLightUnitScale: { value: sunValues.threeLightUnitScale },
		};
	}, [scene, solarRotationAngleRad, texture, textureConfig]);

	useAnimationLoopFrame(animationLoop, (frame) => {
		updateSunLightUniforms(uniforms, scene, frame.rotationAngles.solarDayRad);
	});

	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={-200}>
				<planeGeometry args={[radius * 2, radius * 2, 128, 128]} />
				<shaderMaterial
					vertexShader={EARTH_FLOOR_VERTEX_SHADER}
					fragmentShader={EARTH_FLOOR_FRAGMENT_SHADER}
					uniforms={uniforms}
					depthWrite={false}
					depthTest={false}
					fog={false}
					toneMapped={false}
					side={THREE.DoubleSide}
				/>
			</mesh>
			<mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={-199}>
				<ringGeometry args={[radius * 0.995, radius, 96]} />
				<meshBasicMaterial color="#69a8ff" transparent opacity={0.65} side={THREE.DoubleSide} />
			</mesh>
		</group>
	);
}

/**
 * Render a stable near-observer floor patch for the eye-height view.
 *
 * The projection-sized Earth disc is useful global context, but it is too
 * large and too close to grazing incidence to act as the viewer's local floor
 * in the first depth composer. This patch is intentionally local and
 * depth-bearing until real local terrain replaces it.
 *
 * @param {{ observer: FlatSimulationScene["observer"] | null | undefined }} props - Carry the projected observer state.
 * @returns {React.ReactNode}
 */
function LocalObserverFloor({ scene }) {
	const animationLoop = useFlatAnimationLoop();
	const observer = scene?.observer;
	const position = observer?.position || { x: 0, y: 0, z: 0 };
	const frame = animationFrame(animationLoop);
	const solarRotationAngleRad = frame.rotationAngles.solarDayRad;
	const uniforms = useMemo(() => {
		const sunValues = sunLightUniformValues(scene, solarRotationAngleRad);

		return {
			albedoColor: { value: [0.15, 0.18, 0.11] },
			sunPosition: { value: sunValues.sunPosition },
			sunColor: { value: sunValues.sunColor },
			sunIntensity: { value: sunValues.sunIntensity },
			falseSunRadianceReferenceDistanceKm: { value: sunValues.falseSunRadianceReferenceDistanceKm },
			falseSunRadianceDistanceFalloff: { value: sunValues.falseSunRadianceDistanceFalloff },
			threeLightUnitScale: { value: sunValues.threeLightUnitScale },
		};
	}, [scene, solarRotationAngleRad]);

	useAnimationLoopFrame(animationLoop, (frame) => {
		updateSunLightUniforms(uniforms, scene, frame.rotationAngles.solarDayRad);
	});

	return (
		<mesh
			position={[
				position.x || 0,
				LOCAL_FLOOR_Y_KM,
				position.z || 0,
			]}
			rotation={[-Math.PI / 2, 0, 0]}
			renderOrder={-100}
		>
			<planeGeometry args={[LOCAL_FLOOR_SIZE_KM, LOCAL_FLOOR_SIZE_KM, 1, 1]} />
			<shaderMaterial
				vertexShader={LOCAL_FLOOR_VERTEX_SHADER}
				fragmentShader={LOCAL_FLOOR_FRAGMENT_SHADER}
				uniforms={uniforms}
				depthWrite
				depthTest
				side={THREE.DoubleSide}
				toneMapped={false}
			/>
		</mesh>
	);
}

function SurfaceScaleCues({ observer, radius }) {
	const geometry = useMemo(() => {
		const center = observer?.position || { x: 0, z: 0 };
		const positions = [];
		const ringRadii = [
			100,
			250,
			500,
			1000,
			2500,
			5000,
			10000,
			15000,
			20000,
		].filter((ringRadius) => ringRadius <= radius);
		const segmentCount = 160;
		const y = SCALE_CUE_HEIGHT_KM;

		ringRadii.forEach((ringRadius) => {
			for (let index = 0; index < segmentCount; index += 1) {
				const startAngle = (index / segmentCount) * Math.PI * 2;
				const endAngle = ((index + 1) / segmentCount) * Math.PI * 2;

				positions.push(
					center.x + Math.cos(startAngle) * ringRadius,
					y,
					center.z + Math.sin(startAngle) * ringRadius,
					center.x + Math.cos(endAngle) * ringRadius,
					y,
					center.z + Math.sin(endAngle) * ringRadius,
				);
			}
		});

		for (let index = 0; index < 16; index += 1) {
			const angle = (index / 16) * Math.PI * 2;
			const innerRadius = 4;

			positions.push(
				center.x + Math.cos(angle) * innerRadius,
				y,
				center.z + Math.sin(angle) * innerRadius,
				center.x + Math.cos(angle) * radius,
				y,
				center.z + Math.sin(angle) * radius,
			);
		}

		const nextGeometry = new THREE.BufferGeometry();

		nextGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

		return nextGeometry;
	}, [observer, radius]);

	useEffect(() => {
		return () => {
			geometry.dispose();
		};
	}, [geometry]);

	return (
		<lineSegments geometry={geometry}>
			<lineBasicMaterial color="#82a7d8" transparent opacity={0.22} depthWrite={false} />
		</lineSegments>
	);
}

function createDomeGuideProjectionModel(model = {}) {
	const options = {
		...(model.options || {}),
		domeRadiusKm: (Number(model.options?.domeRadiusKm) || 1) * DOME_LATITUDE_RADIUS_OFFSET,
	};

	return new ProjectionModel({
		id: `${model.id || 'false-sky'}-dome-latitude-guides`,
		root: model.root || {},
		time: model.time || null,
		earthProjection: model.earthProjection,
		celestialProjection: model.celestialProjection,
		skySurfaceProjection: model.skySurfaceProjection,
		options,
	});
}

function pushProjectedLatitudeSegment(positions, projectionModel, decDeg, startRaDeg, endRaDeg) {
	const startCelestial = projectionModel.projectCelestialPoint({ raDeg: startRaDeg, decDeg });
	const endCelestial = projectionModel.projectCelestialPoint({ raDeg: endRaDeg, decDeg });
	const startSurface = projectionModel.projectSkyToSurface(startCelestial.projected || {});
	const endSurface = projectionModel.projectSkyToSurface(endCelestial.projected || {});
	const start = startSurface.position;
	const end = endSurface.position;

	if (!start || !end || !startSurface.visible || !endSurface.visible) {
		return;
	}

	positions.push(
		start.x,
		start.y,
		start.z,
		end.x,
		end.y,
		end.z,
	);
}

function DomeCelestialLatitudeRings({ model }) {
	const geometry = useMemo(() => {
		const positions = [];

		if (!model?.earthProjection || !model?.celestialProjection || !model?.skySurfaceProjection) {
			const emptyGeometry = new THREE.BufferGeometry();

			emptyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

			return emptyGeometry;
		}

		const projectionModel = createDomeGuideProjectionModel(model);

		for (let decDeg = 90 - DOME_LATITUDE_STEP_DEG; decDeg > -90; decDeg -= DOME_LATITUDE_STEP_DEG) {
			for (let index = 0; index < DOME_LATITUDE_SEGMENT_COUNT; index += 1) {
				const startRaDeg = (index / DOME_LATITUDE_SEGMENT_COUNT) * 360;
				const endRaDeg = ((index + 1) / DOME_LATITUDE_SEGMENT_COUNT) * 360;

				pushProjectedLatitudeSegment(positions, projectionModel, decDeg, startRaDeg, endRaDeg);
			}
		}

		const nextGeometry = new THREE.BufferGeometry();

		nextGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

		return nextGeometry;
	}, [model]);

	useEffect(() => {
		return () => {
			geometry.dispose();
		};
	}, [geometry]);

	return (
		<lineSegments geometry={geometry}>
			<lineBasicMaterial color="#9fc2ff" transparent opacity={0.18} depthWrite={false} />
		</lineSegments>
	);
}

function StarField({ exposure, stars }) {
	const animationLoop = useFlatAnimationLoop();
	const rotationRef = useRef(null);
	const geometry = useMemo(() => {
		const visibleStars = stars.filter((star) => star.visible && star.position);
		const positions = new Float32Array(visibleStars.length * 3);
		const colors = new Float32Array(visibleStars.length * 3);

		visibleStars.forEach((star, index) => {
			const positionIndex = index * 3;
			const color = new THREE.Color(star.style?.color || '#ffffff');
			const brightness = star.style?.brightness || 1;
			const adjustedBrightness = brightness * exposure;

			positions[positionIndex] = star.position.x;
			positions[positionIndex + 1] = star.position.y;
			positions[positionIndex + 2] = star.position.z;
			colors[positionIndex] = color.r * adjustedBrightness;
			colors[positionIndex + 1] = color.g * adjustedBrightness;
			colors[positionIndex + 2] = color.b * adjustedBrightness;
		});

		const nextGeometry = new THREE.BufferGeometry();
		nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		return nextGeometry;
	}, [exposure, stars]);

	useEffect(() => {
		return () => {
			geometry.dispose();
		};
	}, [geometry]);

	useAnimationLoopFrame(animationLoop, (frame) => {
		if (!rotationRef.current) {
			return;
		}

		rotationRef.current.rotation.y = frame.rotationAngles.siderealDayRad;
	});

	return (
		<group ref={rotationRef}>
			<points geometry={geometry}>
				<pointsMaterial
					size={STAR_WORLD_SIZE_KM}
					sizeAttenuation
					vertexColors
					depthWrite={false}
				/>
			</points>
		</group>
	);
}

function ConstellationLines({ constellations, exposure }) {
	const animationLoop = useFlatAnimationLoop();
	const rotationRef = useRef(null);
	const geometry = useMemo(() => {
		const positions = [];
		const colors = [];

		constellations.forEach((constellation) => {
			const color = new THREE.Color(constellation.color || '#ff3030');

			constellation.segments
				.filter((segment) => segment.visible && segment.points?.[0] && segment.points?.[1])
				.forEach((segment) => {
					segment.points.forEach((point) => {
						positions.push(point.x, point.y, point.z);
						colors.push(color.r, color.g, color.b);
					});
				});
		});

		const nextGeometry = new THREE.BufferGeometry();
		nextGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		nextGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

		return nextGeometry;
	}, [constellations]);

	useEffect(() => {
		return () => {
			geometry.dispose();
		};
	}, [geometry]);

	useAnimationLoopFrame(animationLoop, (frame) => {
		if (!rotationRef.current) {
			return;
		}

		rotationRef.current.rotation.y = frame.rotationAngles.siderealDayRad;
	});

	return (
		<group ref={rotationRef}>
			<lineSegments geometry={geometry}>
				<lineBasicMaterial vertexColors transparent opacity={clamp(exposure, 0, 1)} depthWrite={false} />
			</lineSegments>
		</group>
	);
}

function AnimatedFixedLatitudeObject({ object }) {
	const animationLoop = useFlatAnimationLoop();
	const rotationRef = useRef(null);

	useAnimationLoopFrame(animationLoop, (frame) => {
		if (!rotationRef.current) {
			return;
		}

		rotationRef.current.rotation.y = frame.rotationAngles.solarDayRad;
	});

	return (
		<group ref={rotationRef}>
			<mesh
				position={[
					object.position.x,
					object.position.y,
					object.position.z,
				]}
			>
				<sphereGeometry args={[object.radiusKm, 32, 16]} />
				<meshBasicMaterial color={object.style?.color || '#ff8a1f'} />
			</mesh>
		</group>
	);
}

function StaticSphereObject({ object }) {
	return (
		<mesh
			position={[
				object.position.x,
				object.position.y,
				object.position.z,
			]}
		>
			<sphereGeometry args={[object.radiusKm, 32, 16]} />
			<meshLambertMaterial color={object.style?.color || '#ff8a1f'} />
		</mesh>
	);
}

function StaticBoxObject({ object }) {
	return (
		<mesh
			position={[
				object.position.x,
				object.position.y,
				object.position.z,
			]}
			rotation={[0, object.rotationYRad || 0, 0]}
		>
			<boxGeometry args={[object.size.x, object.size.y, object.size.z]} />
			<meshLambertMaterial color={object.style?.color || '#00ff00'} />
		</mesh>
	);
}

/**
 * Render generic scene objects that are not owned by first-class scene fields.
 *
 * @param {{ objects: FlatSimulationProjectedObject[] }} props - Carry projected scene objects.
 * @returns {React.ReactNode}
 */
function SceneObjects({ objects }) {
	const visibleObjects = objects.filter((object) => (
		object.role !== 'sun'
		&& object.visible
		&& object.position
		&& (object.kind === 'sphere' || object.kind === 'box')
	));

	return (
		<group>
			{visibleObjects.map((object) => {
				if (object.animation?.type === 'solar-day-fixed-latitude-rotation') {
					return <AnimatedFixedLatitudeObject key={object.id} object={object} />;
				}

				if (object.kind === 'box') {
					return <StaticBoxObject key={object.id} object={object} />;
				}

				return <StaticSphereObject key={object.id} object={object} />;
			})}
		</group>
	);
}

/**
 * Render the first-class flat-simulation sun body.
 *
 * The visible sun remains separate from the generic object loop because its
 * position and apparent size are simulation evidence.
 *
 * @param {{ sun: FlatSimulationSunScene | null | undefined, observerPosition: FlatVector3 | undefined }} props - Carry the projected scene sun and observer position.
 * @returns {React.ReactNode}
 */
function SunBody({ observerPosition, sun }) {
	const animationLoop = useFlatAnimationLoop();
	const meshRef = useRef(null);
	const frame = animationFrame(animationLoop);
	const resolvedSun = resolveAnimatedSun(sun, frame.rotationAngles.solarDayRad, { observerPosition });
	const object = resolvedSun?.object;

	useAnimationLoopFrame(animationLoop, (frame) => {
		if (!meshRef.current || !sun) {
			return;
		}

		const currentSun = resolveAnimatedSun(sun, frame.rotationAngles.solarDayRad, {
			observerPosition,
		});
		const currentPosition = currentSun?.object?.position;

		if (!currentPosition) {
			return;
		}

		meshRef.current.position.set(
			currentPosition.x,
			currentPosition.y,
			currentPosition.z,
		);
	});

	if (!sun?.rendering?.renderBody || !object?.visible || !object?.position || object.kind !== 'sphere') {
		return null;
	}

	return (
		<mesh
			ref={meshRef}
			position={[
				object.position.x,
				object.position.y,
				object.position.z,
			]}
		>
			<sphereGeometry args={[object.radiusKm, 32, 16]} />
			<meshBasicMaterial color={object.style?.color || '#ff8a1f'} />
		</mesh>
	);
}

/**
 * Render the false sun as the light source for solid scene materials.
 *
 * @param {{ scene: FlatSimulationScene | null | undefined }} props - Carry scene state for the resolved sun and atmosphere rendering assumptions.
 * @returns {React.ReactNode}
 */
function SunSceneLight({ scene }) {
	const animationLoop = useFlatAnimationLoop();
	const lightRef = useRef(null);
	const observerPosition = scene?.observer?.position;
	const rendering = scene?.atmosphere?.rendering;
	const frame = animationFrame(animationLoop);
	const resolvedSun = resolveAnimatedSun(scene?.sun, frame.rotationAngles.solarDayRad, { observerPosition });
	const light = resolvedSun?.light;
	const position = light?.position;
	const color = light?.color || { r: 1, g: 1, b: 1 };

	useAnimationLoopFrame(animationLoop, (frame) => {
		if (!lightRef.current || !scene?.sun) {
			return;
		}

		const currentSun = resolveAnimatedSun(scene.sun, frame.rotationAngles.solarDayRad, {
			observerPosition,
		});
		const currentLight = currentSun?.light;
		const currentPosition = currentLight?.position;

		if (!currentPosition) {
			return;
		}

		lightRef.current.position.set(
			currentPosition.x,
			currentPosition.y,
			currentPosition.z,
		);
		lightRef.current.intensity = sunSceneLightIntensity(currentLight, rendering);
	});

	if (!position) {
		return null;
	}

	return (
		<pointLight
			ref={lightRef}
			position={[position.x, position.y, position.z]}
			color={[color.r, color.g, color.b]}
			intensity={sunSceneLightIntensity(light, rendering)}
			decay={2}
		/>
	);
}

/**
 * Approximate diffuse skylight for lit solid materials.
 *
 * The atmosphere composer handles camera-path airlight after the solid scene
 * render. This light is the surface-illumination side: terrain and objects
 * receive broad daylight from the sky even when a face is not directly aimed
 * at the finite false sun.
 *
 * @param {{ scene: FlatSimulationScene | null | undefined }} props - Carry scene atmosphere rendering assumptions.
 * @returns {React.ReactNode}
 */
function SkyDiffuseLight({ scene }) {
	const intensity = skyDiffuseIrradianceScale(scene?.atmosphere?.rendering);

	if (intensity <= 0) {
		return null;
	}

	return (
		<hemisphereLight
			args={['#c7ddff', '#2a261c', intensity]}
		/>
	);
}

/**
 * Render solid flat-simulation contents that should be atmosphere-composited.
 *
 * @param {{ scene: FlatSimulationScene | null | undefined, earthRadius: number, domeRadius: number }} props - Carry scene state and scene dimensions.
 * @returns {React.ReactNode}
 */
function FlatSkySolidScene({ scene, earthRadius, domeRadius }) {
	const earth = scene?.earth || {};
	const rendering = scene?.atmosphere?.rendering || {};
	const stars = scene?.stars || [];
	const objects = scene?.objects || [];
	const constellations = scene?.constellations || [];
	const starExposure = exposureValue(rendering.starExposure, DEFAULT_STAR_EXPOSURE);
	const constellationOverlayExposure = exposureValue(
		rendering.constellationOverlayExposure,
		DEFAULT_CONSTELLATION_OVERLAY_EXPOSURE,
	);

	return (
		<React.Fragment>
			<SunSceneLight scene={scene} />
			<SkyDiffuseLight scene={scene} />
			<EarthDisc radius={earthRadius} floorTexture={earth.floorTexture} scene={scene} />
			<LocalObserverFloor scene={scene} />
			<SurfaceScaleCues observer={scene?.observer} radius={earthRadius} />
			<DomeCelestialLatitudeRings model={scene?.model} />
			<StarField stars={stars} exposure={starExposure} />
			<ConstellationLines constellations={constellations} exposure={constellationOverlayExposure} />
			<SunBody sun={scene?.sun} observerPosition={scene?.observer?.position} />
			<SceneObjects objects={objects} />
		</React.Fragment>
	);
}

/**
 * Render the flat-simulation scene contents inside the Three.js canvas.
 *
 * @param {{ scene: FlatSimulationScene | null | undefined }} props - Carry the scene view model.
 * @returns {React.ReactNode}
 */
function FlatSkySceneContent({ scene }) {
	const earth = scene?.earth || {};
	const earthRadius = earth.radiusKm || 20015.114442035923;
	const domeRadius = scene?.dome?.radiusKm || 20015.114442035923;
	const sceneCamera = scene?.camera;
	const isFloorInspection = sceneCamera?.projection === 'orthographic';

	if (isFloorInspection) {
		return (
			<React.Fragment>
				<color attach="background" args={['#060912']} />
				<ambientLight intensity={0.85} />
				<DebugOrthographicCamera sceneCamera={sceneCamera} />
				<EarthDisc radius={earthRadius} floorTexture={earth.floorTexture} scene={scene} />
			</React.Fragment>
		);
	}

	return (
		<React.Fragment>
			<color attach="background" args={['#060912']} />
			<DebugOrthographicCamera sceneCamera={sceneCamera} />
			{sceneCamera?.projection !== 'orthographic' && (
				<ObserverLookCamera observer={scene?.observer} domeRadius={domeRadius} sceneCamera={sceneCamera} />
			)}
				<FlatAtmosphereComposer scene={scene}>
				<FlatSkySolidScene scene={scene} earthRadius={earthRadius} domeRadius={domeRadius} />
				</FlatAtmosphereComposer>
		</React.Fragment>
	);
}

/**
 * Render the flat-simulation Three.js canvas.
 *
 * @param {{ scene: FlatSimulationScene | null | undefined }} props - Carry the scene view model.
 * @returns {React.ReactNode}
 */
export default function FlatSkyScene({ scene }) {
	const sceneCamera = scene?.camera || null;
	const isOrthographic = sceneCamera?.projection === 'orthographic';
	const cameraPosition = sceneCamera?.position || {};

	return (
		<div className="flat-sky-scene">
			<Canvas
				orthographic={isOrthographic}
				camera={{
					position: sceneCamera
						? [cameraPosition.x || 0, cameraPosition.y || 0, cameraPosition.z || 0]
						: [0, OBSERVER_EYE_HEIGHT_KM, 0],
					fov: sceneCamera?.fov || 72,
					near: 0.0001,
					far: 50000,
				}}
			>
				<FlatSkySceneContent scene={scene} />
			</Canvas>
		</div>
	);
}
