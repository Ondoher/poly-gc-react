import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_EARTH_FLOOR_TEXTURE } from '../models/consts.js';
import { resolveAnimatedSun } from '../models/sun-animation.js';
import FalseAtmosphereComposer from './FalseAtmosphereComposer.jsx';

const OBSERVER_EYE_HEIGHT_KM = 0.0017;
const LOOK_SENSITIVITY = 0.003;
const MAX_LOOK_PITCH = Math.PI / 2 - 0.08;
const INITIAL_LOOK_HEIGHT_RATIO = 0.08;
const SCALE_CUE_HEIGHT_KM = 0.01;
const STAR_WORLD_SIZE_KM = 120;
const DOME_LATITUDE_TUBE_RADIUS_KM = 18;
const LOCAL_FLOOR_SIZE_KM = 320;
const LOCAL_FLOOR_Y_KM = 0;
const EARTH_FLOOR_VERTEX_SHADER = `
	varying vec2 vUv;

	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;
const EARTH_FLOOR_FRAGMENT_SHADER = `
	uniform sampler2D floorTexture;
	uniform float textureRotationRad;
	varying vec2 vUv;

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

		gl_FragColor = vec4(textureColor.rgb, 1.0);
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

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
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

function EarthDisc({ radius, floorTexture }) {
	const textureConfig = floorTexture || DEFAULT_EARTH_FLOOR_TEXTURE;
	const texture = useLoader(THREE.TextureLoader, textureConfig.url);
	const uniforms = useMemo(() => {
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
		};
	}, [texture, textureConfig]);

	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]}>
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
			<mesh rotation={[-Math.PI / 2, 0, 0]}>
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
 * @param {{ observer: FalseSimulationScene["observer"] | null | undefined }} props - Carry the projected observer state.
 * @returns {React.ReactNode}
 */
function LocalObserverFloor({ observer }) {
	const position = observer?.position || { x: 0, y: 0, z: 0 };

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
			<meshBasicMaterial
				color="#7f985b"
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

function DomeCelestialLatitudeRings({ radius }) {
	const rings = useMemo(() => {
		const latitudeStepDeg = 10;
		const lineRadius = radius * 0.9995;
		const nextRings = [];

		for (let angularDistanceDeg = latitudeStepDeg; angularDistanceDeg <= 180; angularDistanceDeg += latitudeStepDeg) {
			// Full north-to-south celestial pole projection: 0 degrees is the
			// center/top above the simulation origin/north pole, and 180 degrees
			// is the south-pole horizon/rim.
			const domePolarAngle = (angularDistanceDeg / 180) * Math.PI / 2;
			const surfaceRadius = lineRadius * Math.sin(domePolarAngle);
			const y = lineRadius * Math.cos(domePolarAngle);

			nextRings.push({
				id: angularDistanceDeg,
				surfaceRadius,
				y,
			});
		}

		return nextRings;
	}, [radius]);

	return (
		<group>
			{rings.map((ring) => (
				<mesh
					key={ring.id}
					position={[0, ring.y, 0]}
					rotation={[Math.PI / 2, 0, 0]}
				>
					<torusGeometry args={[ring.surfaceRadius, DOME_LATITUDE_TUBE_RADIUS_KM, 6, 192]} />
					<meshBasicMaterial color="#9fc2ff" transparent opacity={0.18} depthWrite={false} />
				</mesh>
			))}
		</group>
	);
}

function StarField({ stars, animation }) {
	const rotationRef = useRef(null);
	const geometry = useMemo(() => {
		const visibleStars = stars.filter((star) => star.visible && star.position);
		const positions = new Float32Array(visibleStars.length * 3);
		const colors = new Float32Array(visibleStars.length * 3);

		visibleStars.forEach((star, index) => {
			const positionIndex = index * 3;
			const color = new THREE.Color(star.style?.color || '#ffffff');
			const brightness = star.style?.brightness || 1;

			positions[positionIndex] = star.position.x;
			positions[positionIndex + 1] = star.position.y;
			positions[positionIndex + 2] = star.position.z;
			colors[positionIndex] = color.r * brightness;
			colors[positionIndex + 1] = color.g * brightness;
			colors[positionIndex + 2] = color.b * brightness;
		});

		const nextGeometry = new THREE.BufferGeometry();
		nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		nextGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		return nextGeometry;
	}, [stars]);

	useEffect(() => {
		return () => {
			geometry.dispose();
		};
	}, [geometry]);

	useFrame(({ clock }) => {
		if (!rotationRef.current || !animation?.displayDurationSeconds) {
			return;
		}

		const cycleRatio = (clock.getElapsedTime() % animation.displayDurationSeconds) / animation.displayDurationSeconds;

		rotationRef.current.rotation.y = cycleRatio * Math.PI * 2;
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

function ConstellationLines({ constellations, animation }) {
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

	useFrame(({ clock }) => {
		if (!rotationRef.current || !animation?.displayDurationSeconds) {
			return;
		}

		const cycleRatio = (clock.getElapsedTime() % animation.displayDurationSeconds) / animation.displayDurationSeconds;

		rotationRef.current.rotation.y = cycleRatio * Math.PI * 2;
	});

	return (
		<group ref={rotationRef}>
			<lineSegments geometry={geometry}>
				<lineBasicMaterial vertexColors transparent opacity={0.82} depthWrite={false} />
			</lineSegments>
		</group>
	);
}

function AnimatedFixedLatitudeObject({ object }) {
	const rotationRef = useRef(null);
	const displayDurationSeconds = object.animation?.displayDurationSeconds || 10;

	useFrame(({ clock }) => {
		if (!rotationRef.current) {
			return;
		}

		const cycleRatio = (clock.getElapsedTime() % displayDurationSeconds) / displayDurationSeconds;

		rotationRef.current.rotation.y = cycleRatio * Math.PI * 2;
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
			<meshBasicMaterial color={object.style?.color || '#ff8a1f'} />
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
			<meshBasicMaterial color={object.style?.color || '#00ff00'} />
		</mesh>
	);
}

/**
 * Render generic scene objects that are not owned by first-class scene fields.
 *
 * @param {{ objects: FalseSimulationProjectedObject[] }} props - Carry projected scene objects.
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
 * Render the first-class false-simulation sun body.
 *
 * The visible sun remains separate from the generic object loop because its
 * position and apparent size are simulation evidence.
 *
 * @param {{ sun: FalseSimulationSunScene | null | undefined, observerPosition: FlatVector3 | undefined }} props - Carry the projected scene sun and observer position.
 * @returns {React.ReactNode}
 */
function SunBody({ sun, observerPosition }) {
	const meshRef = useRef(null);
	const resolvedSun = resolveAnimatedSun(sun, 0, { observerPosition });
	const object = resolvedSun?.object;

	useFrame(({ clock }) => {
		if (!meshRef.current || !sun) {
			return;
		}

		const currentSun = resolveAnimatedSun(sun, clock.getElapsedTime(), {
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
 * Render solid false-simulation contents that should be atmosphere-composited.
 *
 * @param {{ scene: FalseSimulationScene | null | undefined, earthRadius: number, domeRadius: number }} props - Carry scene state and scene dimensions.
 * @returns {React.ReactNode}
 */
function FalseSkySolidScene({ scene, earthRadius, domeRadius }) {
	const earth = scene?.earth || {};
	const stars = scene?.stars || [];
	const objects = scene?.objects || [];
	const constellations = scene?.constellations || [];
	const siderealAnimation = scene?.animation?.siderealDay;

	return (
		<React.Fragment>
			<ambientLight intensity={0.85} />
			<EarthDisc radius={earthRadius} floorTexture={earth.floorTexture} />
			<LocalObserverFloor observer={scene?.observer} />
			<SurfaceScaleCues observer={scene?.observer} radius={earthRadius} />
			<DomeCelestialLatitudeRings radius={domeRadius} />
			<StarField stars={stars} animation={siderealAnimation} />
			<ConstellationLines constellations={constellations} animation={siderealAnimation} />
			<SunBody sun={scene?.sun} observerPosition={scene?.observer?.position} />
			<SceneObjects objects={objects} />
		</React.Fragment>
	);
}

/**
 * Render the false-simulation scene contents inside the Three.js canvas.
 *
 * @param {{ scene: FalseSimulationScene | null | undefined }} props - Carry the scene view model.
 * @returns {React.ReactNode}
 */
function FalseSkySceneContent({ scene }) {
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
				<EarthDisc radius={earthRadius} floorTexture={earth.floorTexture} />
			</React.Fragment>
		);
	}

	return (
		<React.Fragment>
			<color attach="background" args={['#060912']} />
			<ambientLight intensity={0.85} />
			<DebugOrthographicCamera sceneCamera={sceneCamera} />
			{sceneCamera?.projection !== 'orthographic' && (
				<ObserverLookCamera observer={scene?.observer} domeRadius={domeRadius} sceneCamera={sceneCamera} />
			)}
			<FalseAtmosphereComposer scene={scene}>
				<FalseSkySolidScene scene={scene} earthRadius={earthRadius} domeRadius={domeRadius} />
			</FalseAtmosphereComposer>
		</React.Fragment>
	);
}

/**
 * Render the false-simulation Three.js canvas.
 *
 * @param {{ scene: FalseSimulationScene | null | undefined }} props - Carry the scene view model.
 * @returns {React.ReactNode}
 */
export default function FalseSkyScene({ scene }) {
	const sceneCamera = scene?.camera || null;
	const isOrthographic = sceneCamera?.projection === 'orthographic';
	const cameraPosition = sceneCamera?.position || {};

	return (
		<div className="false-sky-scene">
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
				<FalseSkySceneContent scene={scene} />
			</Canvas>
		</div>
	);
}
