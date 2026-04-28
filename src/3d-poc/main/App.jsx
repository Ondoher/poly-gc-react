import React from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';

const DEFAULT_POC_TILES = Object.freeze([
	{ type: 'inlay', key: 'd-7-baseline', position: [-1.68, 0.72, 0] },
	{ type: 'inlay', key: 'baseline', position: [-0.84, 0.72, 0] },
	{ type: 'inlay', key: 'wiki-season-2-baseline', position: [0, 0.72, 0] },
	{ type: 'inlay', key: 'd-1-baseline', position: [0.84, 0.72, 0] },
	{ type: 'inlay', key: 'wiki-b-8-baseline', position: [1.68, 0.72, 0] },
]);

function OrbitControls(props) {
	const { camera, gl } = useThree();
	const controlsRef = React.useRef(null);

	React.useEffect(() => {
		const controls = new OrbitControlsImpl(camera, gl.domElement);
		controlsRef.current = controls;
		Object.assign(controls, props);

		return () => {
			controls.dispose();
			controlsRef.current = null;
		};
	}, [camera, gl]);

	React.useEffect(() => {
		if (controlsRef.current) {
			Object.assign(controlsRef.current, props);
		}
	}, [props]);

	useFrame(() => {
		controlsRef.current?.update();
	});

	return null;
}

function TileModel({ url, position = [0, 0, 0], rotation = [0, 0, 0], glassBody = false }) {
	const gltf = useLoader(GLTFLoader, url);

	const { model, bottomOffset } = React.useMemo(() => {
		const clone = gltf.scene.clone(true);
		clone.traverse((object) => {
			if (!object.isMesh) {
				return;
			}

			const materials = Array.isArray(object.material) ? object.material : [object.material];
			const clonedMaterials = materials.map((material) => {
				const isTileBody = object.name === 'tileStampPairMesh' || material.name?.startsWith('tileStampPairBody');

				if (glassBody && isTileBody) {
					const glassMaterial = new THREE.MeshPhysicalMaterial({
						color: material.color ?? '#f2ece2',
						roughness: 0.24,
						metalness: 0,
						transparent: true,
						opacity: 0.42,
						transmission: 0.48,
						thickness: 0.42,
						ior: 1.45,
						clearcoat: 0.45,
						clearcoatRoughness: 0.28,
						side: THREE.DoubleSide,
						depthWrite: false,
					});
					glassMaterial.name = `${material.name}-glass`;
					return glassMaterial;
				}

				return material.clone();
			});
			object.material = Array.isArray(object.material) ? clonedMaterials : clonedMaterials[0];
			object.castShadow = true;
			object.receiveShadow = true;
		});

		const bounds = new THREE.Box3().setFromObject(clone);
		return {
			model: clone,
			bottomOffset: -bounds.min.y,
		};
	}, [gltf.scene, glassBody]);

	React.useEffect(() => {
		return () => {
			model.traverse((object) => {
				if (!object.isMesh) {
					return;
				}

				object.material?.dispose?.();
			});
		};
	}, [model]);

	const adjustedPosition = React.useMemo(
		() => [position[0], position[1] + bottomOffset, position[2]],
		[position, bottomOffset]
	);

	return <primitive object={model} position={adjustedPosition} rotation={rotation} />;
}

function TestFloor() {
	const canvasTexture = React.useMemo(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 512;
		canvas.height = 512;
		const context = canvas.getContext('2d');
		context.fillStyle = '#171512';
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.strokeStyle = '#b58a52';
		context.lineWidth = 5;

		for (let offset = -canvas.height; offset < canvas.width; offset += 42) {
			context.beginPath();
			context.moveTo(offset, canvas.height);
			context.lineTo(offset + canvas.height, 0);
			context.stroke();
		}

		const texture = new THREE.CanvasTexture(canvas);
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set(7, 3);
		texture.colorSpace = THREE.SRGBColorSpace;
		return texture;
	}, []);

	React.useEffect(() => {
		return () => {
			canvasTexture.dispose();
		};
	}, [canvasTexture]);

	return (
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
			<planeGeometry args={[32, 12]} />
			<meshStandardMaterial map={canvasTexture} roughness={0.86} metalness={0.02} />
		</mesh>
	);
}

function Scene({ tiles }) {
	return (
		<>
			<color attach="background" args={['#2a241c']} />
			<ambientLight intensity={0.18} color={'#fff1df'} />
			<hemisphereLight intensity={0.16} color={'#fff0dc'} groundColor={'#9d7546'} />
			<directionalLight
				position={[-5.8, 7.2, -5.4]}
				intensity={1.72}
				color={'#fff6ea'}
				castShadow
				shadow-mapSize-width={2048}
				shadow-mapSize-height={2048}
				shadow-bias={-0.00006}
				shadow-normalBias={0.003}
				shadow-camera-near={0.5}
				shadow-camera-far={20}
				shadow-camera-left={-7}
				shadow-camera-right={7}
				shadow-camera-top={7}
				shadow-camera-bottom={-7}
			/>
			<directionalLight
				position={[3.2, 1.2, 2.8]}
				intensity={0.08}
				color={'#d9e6ff'}
			/>
			{tiles.map(({ type, key, position = [0, 0, 0], rotation = [0, 0, 0] }, index) => (
				<TileModel
					key={`${type}-${key}-${index}`}
					url={`models/mj-tile-stamp-pair-${key}-${type}.glb`}
					position={position}
					rotation={rotation}
				/>
			))}
			<TestFloor />
			<OrbitControls
				enablePan
				enableDamping
				target={new THREE.Vector3(0, 0.74, 0)}
				minDistance={3.2}
				maxDistance={14}
				minPolarAngle={0.2}
				maxPolarAngle={Math.PI / 2.05}
			/>
		</>
	);
}

function usePocModelManifest() {
	const [tiles, setTiles] = React.useState(DEFAULT_POC_TILES);

	React.useEffect(() => {
		let cancelled = false;

		fetch('models/poc-models.json')
			.then((response) => {
				if (!response.ok) {
					throw new Error(`Failed to load POC model manifest: ${response.status}`);
				}
				return response.json();
			})
			.then((manifest) => {
				if (!cancelled && Array.isArray(manifest.tiles) && manifest.tiles.length > 0) {
					setTiles(manifest.tiles);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setTiles(DEFAULT_POC_TILES);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return tiles;
}

export default function App() {
	const tiles = usePocModelManifest();

	return (
		<div style={{ width: '100vw', height: '100vh', margin: 0, background: '#1f2937', position: 'relative' }}>
			<div
				style={{
					position: 'absolute',
					left: 18,
					top: 18,
					padding: '10px 12px',
					borderRadius: 10,
					background: 'rgba(255, 248, 238, 0.88)',
					border: '1px solid rgba(140, 116, 88, 0.25)',
					color: '#3f2f22',
					fontSize: 12,
					lineHeight: 1.45,
					zIndex: 1,
					maxWidth: 500,
				}}
			>
				Generated inlay diagnostic. The current tiles are laid out side by side on the bottom layer.
			</div>
			<Canvas shadows camera={{ position: [0, 4.4, 7.2], fov: 31, far: 90 }}>
				<React.Suspense fallback={null}>
					<Scene tiles={tiles} />
				</React.Suspense>
			</Canvas>
		</div>
	);
}
