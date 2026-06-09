import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const OBSERVER_EYE_HEIGHT_KM = 0.0017;
const LOOK_SENSITIVITY = 0.003;
const MAX_LOOK_PITCH = Math.PI / 2 - 0.08;
const INITIAL_LOOK_HEIGHT_RATIO = 0.08;
const SCALE_CUE_HEIGHT_KM = 0.01;
const STAR_WORLD_SIZE_KM = 120;
const DOME_LATITUDE_TUBE_RADIUS_KM = 18;
const EARTH_TEXTURE_SIZE = 2048;
const HAZE_VERTEX_SHADER = `
	varying vec3 vWorldPosition;

	void main() {
		vec4 worldPosition = modelMatrix * vec4(position, 1.0);
		vWorldPosition = worldPosition.xyz;
		gl_Position = projectionMatrix * viewMatrix * worldPosition;
	}
`;
const HAZE_FRAGMENT_SHADER = `
	uniform vec3 hazeColor;
	uniform float opacity;
	uniform float fullOpacityDistanceKm;
	uniform float seaLevelDensity;
	uniform float atmosphereHeightKm;
	varying vec3 vWorldPosition;

	void main() {
		vec3 ray = vWorldPosition - cameraPosition;
		float viewDistanceKm = length(ray);
		vec3 viewDirection = normalize(ray);
		float vertical = viewDirection.y;
		float atmosphereHeight = max(atmosphereHeightKm, 0.0001);
		float startAltitude = clamp(cameraPosition.y, 0.0, atmosphereHeight);
		float opticalPathKm = viewDistanceKm;

		if (vertical > 0.0001) {
			opticalPathKm = min(viewDistanceKm, max((atmosphereHeight - startAltitude) / vertical, 0.0));
		}

		float endAltitude = clamp(startAltitude + vertical * opticalPathKm, 0.0, atmosphereHeight);
		float startDensity = seaLevelDensity * (1.0 - (startAltitude / atmosphereHeight));
		float endDensity = seaLevelDensity * (1.0 - (endAltitude / atmosphereHeight));
		float averageDensity = (startDensity + endDensity) * 0.5;
		float opticalDepthKm = max(opticalPathKm * averageDensity, 0.0);
		float alpha = clamp(opacity * (1.0 - exp(-opticalDepthKm / max(fullOpacityDistanceKm, 0.0001))), 0.0, 1.0);

		gl_FragColor = vec4(hazeColor, alpha);
	}
`;

function observerCameraPosition(observer) {
	const position = observer?.position || {};

	return new THREE.Vector3(
		position.x || 0,
		(position.y || 0) + OBSERVER_EYE_HEIGHT_KM,
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

function projectGeoToTexture(lat, lon, size) {
	const radius = size / 2;
	const angularDistanceRatio = (90 - lat) / 180;
	const projectedRadius = angularDistanceRatio * radius;
	const theta = lon * Math.PI / 180;

	return {
		x: radius + Math.sin(theta) * projectedRadius,
		y: radius - Math.cos(theta) * projectedRadius,
	};
}

function drawProjectedPolygon(context, points, size) {
	context.beginPath();

	points.forEach(([lat, lon], index) => {
		const projected = projectGeoToTexture(lat, lon, size);

		if (index === 0) {
			context.moveTo(projected.x, projected.y);
			return;
		}

		context.lineTo(projected.x, projected.y);
	});

	context.closePath();
	context.fill();
	context.stroke();
}

function createEarthProjectionTexture() {
	const size = EARTH_TEXTURE_SIZE;
	const radius = size / 2;
	const center = radius;
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');

	canvas.width = size;
	canvas.height = size;

	context.clearRect(0, 0, size, size);
	context.save();
	context.beginPath();
	context.arc(center, center, radius - 2, 0, Math.PI * 2);
	context.clip();

	const oceanGradient = context.createRadialGradient(center, center, 0, center, center, radius);
	oceanGradient.addColorStop(0, '#142332');
	oceanGradient.addColorStop(0.55, '#0b1724');
	oceanGradient.addColorStop(1, '#030914');
	context.fillStyle = oceanGradient;
	context.fillRect(0, 0, size, size);

	context.fillStyle = '#d8d05a';
	context.strokeStyle = 'rgba(255, 252, 185, 0.9)';
	context.lineWidth = 7;

	[
		// Coarse hand-drawn land silhouettes for surface orientation only. A
		// Natural Earth-style dataset should replace these once map data becomes
		// part of the POC contract.
		[[72, -168], [69, -132], [55, -122], [49, -95], [58, -62], [49, -52], [27, -80], [15, -96], [8, -80], [18, -105], [32, -118], [49, -125]],
		[[13, -82], [8, -70], [-4, -78], [-18, -70], [-35, -60], [-55, -70], [-50, -45], [-24, -40], [-4, -35], [10, -60]],
		[[71, -10], [65, 40], [72, 95], [62, 150], [43, 142], [24, 122], [8, 106], [22, 78], [7, 45], [30, 32], [37, 12], [52, -6]],
		[[35, -17], [32, 33], [12, 44], [-10, 41], [-35, 22], [-35, 6], [-5, -16], [20, -17]],
		[[23, 68], [8, 78], [7, 101], [-8, 118], [-35, 146], [-44, 120], [-20, 82]],
		[[-11, 112], [-10, 154], [-39, 153], [-44, 116]],
		[[84, -73], [79, -18], [67, -24], [61, -48], [70, -73]],
	].forEach((polygon) => drawProjectedPolygon(context, polygon, size));

	context.strokeStyle = 'rgba(226, 240, 255, 0.55)';
	context.lineWidth = 3;

	for (let lat = 80; lat >= -80; lat -= 10) {
		const ringRadius = ((90 - lat) / 180) * radius;
		context.beginPath();
		context.arc(center, center, ringRadius, 0, Math.PI * 2);
		context.stroke();
	}

	for (let lon = 0; lon < 360; lon += 15) {
		const theta = lon * Math.PI / 180;
		context.beginPath();
		context.moveTo(center, center);
		context.lineTo(center + Math.sin(theta) * radius, center - Math.cos(theta) * radius);
		context.stroke();
	}

	context.strokeStyle = 'rgba(230, 246, 255, 0.96)';
	context.lineWidth = 12;
	context.beginPath();
	context.arc(center, center, radius - 4, 0, Math.PI * 2);
	context.stroke();

	// Temporary calibration marks: if these are not visible, the rendered
	// floor is not showing this generated texture clearly.
	context.strokeStyle = '#ff00ff';
	context.lineWidth = 18;
	context.beginPath();
	context.moveTo(center - radius * 0.92, center);
	context.lineTo(center + radius * 0.92, center);
	context.stroke();

	context.strokeStyle = '#00ffff';
	context.beginPath();
	context.moveTo(center, center - radius * 0.92);
	context.lineTo(center, center + radius * 0.92);
	context.stroke();

	context.restore();

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	texture.anisotropy = 8;
	texture.needsUpdate = true;

	return texture;
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

function EarthDisc({ radius }) {
	const texture = useMemo(() => createEarthProjectionTexture(), []);

	useEffect(() => {
		return () => {
			texture.dispose();
		};
	}, [texture]);

	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]}>
				<planeGeometry args={[radius * 2, radius * 2, 128, 128]} />
				<meshBasicMaterial
					map={texture}
					transparent
					alphaTest={0.01}
					depthWrite={false}
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

function AltitudeHaze({ radius, atmosphere }) {
	const uniforms = useMemo(() => ({
		hazeColor: { value: new THREE.Color(atmosphere?.color || '#7fb2ff') },
		opacity: { value: atmosphere?.opacity ?? 1 },
		fullOpacityDistanceKm: { value: atmosphere?.fullOpacityDistanceKm || 482.8032 },
		seaLevelDensity: { value: atmosphere?.seaLevelDensity ?? 1 },
		atmosphereHeightKm: { value: atmosphere?.atmosphereHeightKm || 100 },
	}), [atmosphere]);

	if (atmosphere?.enabled === false) {
		return null;
	}

	return (
		<mesh>
			<sphereGeometry args={[radius * 0.998, 96, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
			<shaderMaterial
				vertexShader={HAZE_VERTEX_SHADER}
				fragmentShader={HAZE_FRAGMENT_SHADER}
				uniforms={uniforms}
				transparent
				depthWrite={false}
				side={THREE.BackSide}
				blending={THREE.AdditiveBlending}
			/>
		</mesh>
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

function SceneObjects({ objects }) {
	const visibleObjects = objects.filter((object) => object.visible && object.position && object.kind === 'sphere');

	return (
		<group>
			{visibleObjects.map((object) => {
				if (object.animation?.type === 'solar-day-fixed-latitude-rotation') {
					return <AnimatedFixedLatitudeObject key={object.id} object={object} />;
				}

				return <StaticSphereObject key={object.id} object={object} />;
			})}
		</group>
	);
}

function FalseSkySceneContent({ scene }) {
	const earthRadius = scene?.earth?.radiusKm || 20015.114442035923;
	const domeRadius = scene?.dome?.radiusKm || 20015.114442035923;
	const stars = scene?.stars || [];
	const objects = scene?.objects || [];
	const constellations = scene?.constellations || [];
	const atmosphere = scene?.atmosphere;
	const sceneCamera = scene?.camera;
	const siderealAnimation = scene?.animation?.siderealDay;
	const isFloorInspection = sceneCamera?.projection === 'orthographic';

	if (isFloorInspection) {
		return (
			<React.Fragment>
				<color attach="background" args={['#060912']} />
				<ambientLight intensity={0.85} />
				<DebugOrthographicCamera sceneCamera={sceneCamera} />
				<EarthDisc radius={earthRadius} />
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
			<EarthDisc radius={earthRadius} />
			<SurfaceScaleCues observer={scene?.observer} radius={earthRadius} />
			<AltitudeHaze radius={domeRadius} atmosphere={atmosphere} />
			<DomeCelestialLatitudeRings radius={domeRadius} />
			<StarField stars={stars} animation={siderealAnimation} />
			<ConstellationLines constellations={constellations} animation={siderealAnimation} />
			<SceneObjects objects={objects} />
		</React.Fragment>
	);
}

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
