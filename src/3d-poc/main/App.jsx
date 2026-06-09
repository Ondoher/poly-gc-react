import React from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import Engine from '../../gc/features/mj/src/engine/Engine.js';
import layouts from '../../gc/features/mj/src/data/layouts.js';

const BOARD_NUMBER = 314159;
const BOARD_LAYOUT = 'turtle';
const TILE_WIDTH = 0.84;
const TILE_DEPTH = 1.16;
const TILE_HEIGHT = 0.576;
const GRID_X_STEP = TILE_WIDTH / 2;
const GRID_Z_STEP = TILE_DEPTH / 2;
const LAYER_STEP = TILE_HEIGHT;
const BODY_URL = 'models/mj-tile-boolean-experiment-basic.glb';
const GENERATED_TRADITIONAL_FACE_KEYS = new Set([
	'b-1', 'b-2', 'b-3', 'b-4', 'b-5', 'b-6', 'b-7', 'b-8', 'b-9',
	'c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6', 'c-7', 'c-8', 'c-9',
	'd-1', 'd-2', 'd-3', 'd-4', 'd-5', 'd-6', 'd-7', 'd-8', 'd-9',
	'dragon-g', 'dragon-r', 'dragon-w',
	'wind-n', 'wind-s', 'wind-e', 'wind-w',
	'flower-1', 'flower-2', 'flower-3', 'flower-4',
	'season-1', 'season-2', 'season-3', 'season-4',
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

function cloneModel(scene) {
	const clone = scene.clone(true);

	clone.traverse((object) => {
		if (!object.isMesh) {
			return;
		}

		const materials = Array.isArray(object.material) ? object.material : [object.material];
		const clonedMaterials = materials.map((material) => material.clone());
		object.material = Array.isArray(object.material) ? clonedMaterials : clonedMaterials[0];
		object.castShadow = true;
		object.receiveShadow = true;
	});

	return clone;
}

function TileModel({ url, position = [0, 0, 0], rotation = [0, 0, 0], missingFace = false }) {
	const gltf = useLoader(GLTFLoader, url);

	const { model, bottomOffset } = React.useMemo(() => {
		const clone = cloneModel(gltf.scene);

		if (missingFace) {
			clone.traverse((object) => {
				if (!object.isMesh) {
					return;
				}

				const materials = Array.isArray(object.material) ? object.material : [object.material];
				materials.forEach((material) => {
					material.color = new THREE.Color('#d8d1c2');
					material.roughness = 0.74;
					material.metalness = 0;
				});
			});
		}

		const bounds = new THREE.Box3().setFromObject(clone);
		return {
			model: clone,
			bottomOffset: -bounds.min.y,
		};
	}, [gltf.scene, missingFace]);

	React.useEffect(() => {
		return () => {
			model.traverse((object) => {
				if (!object.isMesh) {
					return;
				}

				const materials = Array.isArray(object.material) ? object.material : [object.material];
				materials.forEach((material) => material.dispose?.());
			});
		};
	}, [model]);

	const adjustedPosition = React.useMemo(
		() => [position[0], position[1] + bottomOffset, position[2]],
		[position, bottomOffset]
	);

	return <primitive object={model} position={adjustedPosition} rotation={rotation} />;
}

function TestFloor({ size }) {
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
		texture.repeat.set(Math.max(4, size[0] / 2), Math.max(3, size[1] / 2));
		texture.colorSpace = THREE.SRGBColorSpace;
		return texture;
	}, [size]);

	React.useEffect(() => {
		return () => {
			canvasTexture.dispose();
		};
	}, [canvasTexture]);

	return (
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
			<planeGeometry args={size} />
			<meshStandardMaterial map={canvasTexture} roughness={0.86} metalness={0.02} />
		</mesh>
	);
}

function getFaceKey(face) {
	const faceGroup = Math.floor(face / 4);

	if (faceGroup >= 0 && faceGroup <= 8) {
		return `b-${faceGroup + 1}`;
	}

	if (faceGroup >= 9 && faceGroup <= 17) {
		return `c-${faceGroup - 8}`;
	}

	if (faceGroup >= 18 && faceGroup <= 26) {
		return `d-${faceGroup - 17}`;
	}

	if (faceGroup >= 27 && faceGroup <= 29) {
		return ['dragon-g', 'dragon-r', 'dragon-w'][faceGroup - 27];
	}

	if (face >= 120 && face <= 135) {
		return ['wind-n', 'wind-s', 'wind-e', 'wind-w'][Math.floor((face - 120) / 4)];
	}

	if (face >= 136 && face <= 139) {
		return `flower-${face - 135}`;
	}

	if (face >= 140 && face <= 143) {
		return `season-${face - 139}`;
	}

	return 'unknown';
}

function makeBoardTiles() {
	const engine = new Engine();
	engine.setLayout(layouts[BOARD_LAYOUT]);
	engine.generateGame(BOARD_NUMBER);

	const pieces = engine.board.pieces.map((piece, index) => {
		const faceKey = getFaceKey(piece.face);
		const hasGeneratedTraditionalFace = GENERATED_TRADITIONAL_FACE_KEYS.has(faceKey);

		return {
			id: index,
			face: piece.face,
			faceKey,
			hasGeneratedTraditionalFace,
			pos: piece.pos,
		};
	});
	const bounds = pieces.reduce((result, piece) => {
		result.minX = Math.min(result.minX, piece.pos.x);
		result.maxX = Math.max(result.maxX, piece.pos.x);
		result.minY = Math.min(result.minY, piece.pos.y);
		result.maxY = Math.max(result.maxY, piece.pos.y);
		result.maxZ = Math.max(result.maxZ, piece.pos.z);
		return result;
	}, {
		minX: Infinity,
		maxX: -Infinity,
		minY: Infinity,
		maxY: -Infinity,
		maxZ: -Infinity,
	});
	const centerX = (bounds.minX + bounds.maxX) / 2;
	const centerY = (bounds.minY + bounds.maxY) / 2;

	return {
		layoutTitle: layouts[BOARD_LAYOUT].title,
		tiles: pieces.map((piece) => {
			const position = [
				(piece.pos.x - centerX) * GRID_X_STEP,
				piece.pos.z * LAYER_STEP,
				(piece.pos.y - centerY) * GRID_Z_STEP,
			];

			return {
				...piece,
				position,
				url: piece.hasGeneratedTraditionalFace
					? `models/colored-inlay/${piece.faceKey}.glb`
					: BODY_URL,
			};
		}),
		stats: {
			generatedTraditionalCount: pieces.filter((piece) => piece.hasGeneratedTraditionalFace).length,
			placeholderCount: pieces.filter((piece) => !piece.hasGeneratedTraditionalFace).length,
		},
		floorSize: [
			(bounds.maxX - bounds.minX + 5) * GRID_X_STEP,
			(bounds.maxY - bounds.minY + 5) * GRID_Z_STEP,
		],
	};
}

function Scene({ board }) {
	return (
		<>
			<color attach="background" args={['#2a241c']} />
			<ambientLight intensity={0.22} color={'#fff1df'} />
			<hemisphereLight intensity={0.22} color={'#fff0dc'} groundColor={'#9d7546'} />
			<directionalLight
				position={[-6.8, 9.4, -6.2]}
				intensity={1.72}
				color={'#fff6ea'}
				castShadow
				shadow-mapSize-width={2048}
				shadow-mapSize-height={2048}
				shadow-bias={-0.00006}
				shadow-normalBias={0.003}
				shadow-camera-near={0.5}
				shadow-camera-far={26}
				shadow-camera-left={-8}
				shadow-camera-right={8}
				shadow-camera-top={8}
				shadow-camera-bottom={-8}
			/>
			<directionalLight
				position={[3.2, 2.2, 3.8]}
				intensity={0.1}
				color={'#d9e6ff'}
			/>
			<group rotation={[-0.03, 0, 0]}>
				{board.tiles.map((tile) => (
					<TileModel
						key={tile.id}
						url={tile.url}
						position={tile.position}
						rotation={[0, 0, 0]}
						missingFace={!tile.hasGeneratedTraditionalFace}
					/>
				))}
			</group>
			<TestFloor size={board.floorSize} />
			<OrbitControls
				enablePan
				enableDamping
				target={new THREE.Vector3(0, 1.1, 0)}
				minDistance={3.8}
				maxDistance={18}
				minPolarAngle={0.2}
				maxPolarAngle={Math.PI / 2.04}
			/>
		</>
	);
}

export default function App() {
	const board = React.useMemo(() => makeBoardTiles(), []);

	return (
		<div style={{ width: '100vw', height: '100vh', margin: 0, background: '#1f2937', position: 'relative' }}>
			<div
				style={{
					position: 'absolute',
					left: 18,
					top: 18,
					padding: '10px 12px',
					borderRadius: 6,
					background: 'rgba(255, 248, 238, 0.88)',
					border: '1px solid rgba(140, 116, 88, 0.25)',
					color: '#3f2f22',
					fontSize: 12,
					lineHeight: 1.45,
					zIndex: 1,
					maxWidth: 500,
				}}
			>
				3D board POC: {board.layoutTitle}, game {BOARD_NUMBER}. Generated traditional GLBs:
				{' '}{board.stats.generatedTraditionalCount}; neutral placeholders: {board.stats.placeholderCount}.
			</div>
			<Canvas shadows camera={{ position: [0, 6.2, 9.8], fov: 34, far: 90 }}>
				<React.Suspense fallback={null}>
					<Scene board={board} />
				</React.Suspense>
			</Canvas>
		</div>
	);
}
