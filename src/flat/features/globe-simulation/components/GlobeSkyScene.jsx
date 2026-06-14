import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import GlobeAtmosphereComposer from './GlobeAtmosphereComposer.jsx';

const DEFAULT_GLOBE_COLOR = '#3f7f45';
const LOOK_DRAG_SENSITIVITY = 0.004;
const MAX_LOOK_PITCH = Math.PI / 2 - 0.03;
const DIAGNOSTIC_GLOBE_WIDTH_SEGMENTS = 1536;
const DIAGNOSTIC_GLOBE_HEIGHT_SEGMENTS = 768;
const STAR_POINT_SIZE_PX = 2.2;
const STAR_DISPLAY_EXPOSURE = 0.8;
const MOUNTAIN_FACE_SURFACE_INSET_KM = 0.02;

const RADIOMETRIC_SURFACE_VERTEX_SHADER = `
	varying vec3 vWorldPosition;
	varying vec3 vWorldNormal;

	void main() {
		vec4 worldPosition = modelMatrix * vec4(position, 1.0);

		vWorldPosition = worldPosition.xyz;
		vWorldNormal = normalize(mat3(modelMatrix) * normal);
		gl_Position = projectionMatrix * viewMatrix * worldPosition;
	}
`;

const RADIOMETRIC_SURFACE_FRAGMENT_SHADER = `
	const float PI = 3.141592653589793;

	uniform vec3 albedoRgb;
	uniform vec3 sunPosition;
	uniform vec3 sunColor;
	uniform float directNormalIrradianceWm2;
	uniform float diffuseSkyIrradianceWm2;

	varying vec3 vWorldPosition;
	varying vec3 vWorldNormal;

	void main() {
		vec3 normal = normalize(vWorldNormal);

		if (!gl_FrontFacing) {
			normal = -normal;
		}

		vec3 lightDirection = normalize(sunPosition - vWorldPosition);
		float directIncidence = max(dot(normal, lightDirection), 0.0);
		vec3 directIrradiance = sunColor
			* directNormalIrradianceWm2
			* directIncidence;
		vec3 diffuseIrradiance = vec3(diffuseSkyIrradianceWm2);
		vec3 surfaceRadiance = albedoRgb
			* (directIrradiance + diffuseIrradiance)
			/ PI;

		gl_FragColor = vec4(surfaceRadiance, 1.0);
	}
`;

function vectorFromState(vector) {
	return new THREE.Vector3(
		Number(vector?.x) || 0,
		Number(vector?.y) || 0,
		Number(vector?.z) || 0,
	);
}

function colorVectorFromValue(value, fallback = '#ffffff') {
	const color = new THREE.Color(value || fallback);

	return new THREE.Vector3(color.r, color.g, color.b);
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function RadiometricLambertianMaterial({
	scene,
	color,
	side = THREE.FrontSide,
}) {
	const uniforms = useMemo(() => ({
		albedoRgb: {
			value: colorVectorFromValue(color, DEFAULT_GLOBE_COLOR),
		},
		sunPosition: {
			value: vectorFromState(scene?.sun?.position),
		},
		sunColor: {
			value: new THREE.Vector3(
				scene?.sun?.color?.r ?? 1,
				scene?.sun?.color?.g ?? 0.98,
				scene?.sun?.color?.b ?? 0.95,
			),
		},
		directNormalIrradianceWm2: {
			value: Number(scene?.sun?.irradiance?.directNormalIrradianceAtObserverWm2) || 0,
		},
		diffuseSkyIrradianceWm2: {
			value: Number(scene?.sun?.irradiance?.estimatedDiffuseSkyIrradianceWm2) || 0,
		},
	}), [color, scene?.sun?.color, scene?.sun?.irradiance, scene?.sun?.position]);

	return (
		<shaderMaterial
			vertexShader={RADIOMETRIC_SURFACE_VERTEX_SHADER}
			fragmentShader={RADIOMETRIC_SURFACE_FRAGMENT_SHADER}
			uniforms={uniforms}
			side={side}
			toneMapped={false}
		/>
	);
}

function SurfaceLookCamera({ cameraState, observerFrame, lookOffset }) {
	const { camera } = useThree();
	const position = useMemo(() => vectorFromState(cameraState?.positionKm), [cameraState?.positionKm]);
	const up = useMemo(
		() => vectorFromState(observerFrame?.up),
		[observerFrame?.up],
	);
	const east = useMemo(
		() => vectorFromState(observerFrame?.east),
		[observerFrame?.east],
	);
	const north = useMemo(
		() => vectorFromState(observerFrame?.north),
		[observerFrame?.north],
	);
	const initialLookAngles = useMemo(
		() => {
			const target = vectorFromState(cameraState?.targetKm);
			const direction = target.sub(position).normalize();
			const eastComponent = direction.dot(east);
			const northComponent = direction.dot(north);
			const upComponent = clamp(direction.dot(up), -1, 1);

			return {
				yaw: Math.atan2(eastComponent, northComponent),
				pitch: Math.asin(upComponent),
			};
		},
		[cameraState?.targetKm, east, north, position, up],
	);

	useEffect(() => {
		const yaw = initialLookAngles.yaw + lookOffset.yaw;
		const pitch = clamp(initialLookAngles.pitch + lookOffset.pitch, -MAX_LOOK_PITCH, MAX_LOOK_PITCH);
		const horizontalScale = Math.cos(pitch);
		const direction = new THREE.Vector3()
			.addScaledVector(east, Math.sin(yaw) * horizontalScale)
			.addScaledVector(north, Math.cos(yaw) * horizontalScale)
			.addScaledVector(up, Math.sin(pitch))
			.normalize();

		camera.position.copy(position);
		camera.up.copy(up);
		camera.lookAt(position.clone().add(direction));
		camera.updateProjectionMatrix();
	}, [camera, east, initialLookAngles, lookOffset, north, position, up]);

	return null;
}

function GlobeSurface({ scene }) {
	const radius = Number(scene?.geometry?.earthRadiusKm) || 1;
	const material = scene?.surface?.material || {};

	return (
		<mesh>
			<sphereGeometry
				args={[
					radius,
					DIAGNOSTIC_GLOBE_WIDTH_SEGMENTS,
					DIAGNOSTIC_GLOBE_HEIGHT_SEGMENTS,
				]}
			/>
			<RadiometricLambertianMaterial
				scene={scene}
				color={material.color || DEFAULT_GLOBE_COLOR}
			/>
		</mesh>
	);
}

function createCurvedMountainFaceGeometry(object) {
	const widthKm = Number(object?.size?.x) || 1;
	const heightKm = Number(object?.size?.y) || 1;
	const nearEdgeCenter = vectorFromState(object?.surface?.nearEdgeCenterKm);
	const radiusKm = nearEdgeCenter.length() || 1;
	const centerNormal = nearEdgeCenter.clone().normalize();
	const xAxis = vectorFromState(object?.orientation?.xAxis).normalize();
	const segmentCount = Math.max(4, Math.ceil(widthKm / 0.25));
	const bottomRadiusKm = Math.max(radiusKm - MOUNTAIN_FACE_SURFACE_INSET_KM, 0);
	const topRadiusKm = radiusKm + heightKm;
	const positions = [];
	const indices = [];

	for (let index = 0; index <= segmentCount; index += 1) {
		const offsetKm = ((index / segmentCount) - 0.5) * widthKm;
		const angularOffsetRad = offsetKm / radiusKm;
		const surfaceNormal = centerNormal.clone()
			.multiplyScalar(Math.cos(angularOffsetRad))
			.addScaledVector(xAxis, Math.sin(angularOffsetRad))
			.normalize();
		const bottom = surfaceNormal.clone().multiplyScalar(bottomRadiusKm);
		const top = surfaceNormal.clone().multiplyScalar(topRadiusKm);

		positions.push(bottom.x, bottom.y, bottom.z);
		positions.push(top.x, top.y, top.z);
	}

	for (let index = 0; index < segmentCount; index += 1) {
		const leftBottom = index * 2;
		const leftTop = leftBottom + 1;
		const rightBottom = leftBottom + 2;
		const rightTop = leftBottom + 3;

		indices.push(leftBottom, rightBottom, leftTop);
		indices.push(leftTop, rightBottom, rightTop);
	}

	const geometry = new THREE.BufferGeometry();

	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();

	return geometry;
}

function GlobeMountainObject({ object, scene }) {
	const geometry = useMemo(
		() => createCurvedMountainFaceGeometry(object),
		[object],
	);

	return (
		<mesh geometry={geometry}>
			<RadiometricLambertianMaterial
				scene={scene}
				color={object?.style?.color || '#ff0000'}
				side={THREE.DoubleSide}
			/>
		</mesh>
	);
}

function GlobeMountainObjects({ scene }) {
	const mountains = (scene?.objects || []).filter((object) => (
		object?.visible
		&& object.role === 'mountain-simulation'
		&& object.kind === 'box'
	));

	return (
		<group>
			{mountains.map((object) => (
				<GlobeMountainObject object={object} key={object.id} scene={scene} />
			))}
		</group>
	);
}

function GlobeStarField({ scene }) {
	const geometry = useMemo(() => {
		const stars = (scene?.stars || []).filter((star) => (
			star?.visible
			&& star.position
			&& star.kind === 'star'
		));
		const positions = new Float32Array(stars.length * 3);
		const colors = new Float32Array(stars.length * 3);

		stars.forEach((star, index) => {
			const positionIndex = index * 3;
			const color = new THREE.Color(star.style?.color || '#ffffff');
			const brightness = Math.max(Number(star.relativeFlux) || 0, 0) * STAR_DISPLAY_EXPOSURE;

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
	}, [scene?.stars]);

	useEffect(() => () => {
		geometry.dispose();
	}, [geometry]);

	return (
		<points geometry={geometry}>
			<pointsMaterial
				size={STAR_POINT_SIZE_PX}
				sizeAttenuation={false}
				vertexColors
				depthWrite={false}
				depthTest
				toneMapped={false}
			/>
		</points>
	);
}

function SunBody({ scene }) {
	const sun = scene?.sun || {};
	const sunPosition = vectorFromState(sun.position);
	const sunRadius = Number(sun.radiusKm) || 1;
	const topOfAtmosphereIrradiance = Number(sun?.irradiance?.topOfAtmosphereIrradianceWm2) || 1;

	return (
		<mesh position={sunPosition}>
			<sphereGeometry args={[sunRadius, 64, 32]} />
			<meshBasicMaterial
				color={new THREE.Color(
					(sun.color?.r ?? 1) * topOfAtmosphereIrradiance,
					(sun.color?.g ?? 0.98) * topOfAtmosphereIrradiance,
					(sun.color?.b ?? 0.95) * topOfAtmosphereIrradiance,
				)}
				toneMapped={false}
			/>
		</mesh>
	);
}

export default function GlobeSkyScene({ scene }) {
	const cameraState = scene?.camera || {};
	const cameraPosition = vectorFromState(cameraState.positionKm);
	const dragRef = useRef(null);
	const [dragging, setDragging] = useState(false);
	const [lookOffset, setLookOffset] = useState({ yaw: 0, pitch: 0 });

	if (!scene) {
		return null;
	}

	return (
		<div
			className={`globe-simulation-canvas${dragging ? ' globe-simulation-canvas-dragging' : ''}`}
			onPointerDown={(event) => {
				event.currentTarget.setPointerCapture(event.pointerId);
				dragRef.current = {
					pointerId: event.pointerId,
					x: event.clientX,
					y: event.clientY,
				};
				setDragging(true);
			}}
			onPointerMove={(event) => {
				if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
					return;
				}

				const deltaX = event.clientX - dragRef.current.x;
				const deltaY = event.clientY - dragRef.current.y;

				dragRef.current = {
					pointerId: event.pointerId,
					x: event.clientX,
					y: event.clientY,
				};
				setLookOffset((current) => ({
					yaw: current.yaw - deltaX * LOOK_DRAG_SENSITIVITY,
					pitch: clamp(
						current.pitch - deltaY * LOOK_DRAG_SENSITIVITY,
						-MAX_LOOK_PITCH,
						MAX_LOOK_PITCH,
					),
				}));
			}}
			onPointerUp={(event) => {
				if (dragRef.current?.pointerId === event.pointerId) {
					dragRef.current = null;
					setDragging(false);
				}
			}}
			onPointerCancel={() => {
				dragRef.current = null;
				setDragging(false);
			}}
		>
			<Canvas
				camera={{
					position: cameraPosition.toArray(),
					near: Number(cameraState.nearKm) || 1,
					far: Number(cameraState.farKm) || 32000,
					fov: Number(cameraState.fov) || 42,
				}}
				gl={{
					antialias: true,
					alpha: true,
					logarithmicDepthBuffer: true,
					preserveDrawingBuffer: true,
				}}
			>
				<color attach="background" args={['#070910']} />
				<SurfaceLookCamera
					cameraState={cameraState}
					observerFrame={scene?.observer?.frame}
					lookOffset={lookOffset}
				/>
				<GlobeAtmosphereComposer scene={scene}>
					<GlobeSurface scene={scene} />
					<GlobeMountainObjects scene={scene} />
					<GlobeStarField scene={scene} />
					<SunBody scene={scene} />
				</GlobeAtmosphereComposer>
			</Canvas>
		</div>
	);
}
