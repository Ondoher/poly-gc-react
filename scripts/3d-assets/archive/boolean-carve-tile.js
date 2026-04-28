import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg/src/index.js';

class NodeFileReader {
	constructor() {
		this.result = null;
		this.onloadend = null;
	}

	readAsArrayBuffer(blob) {
		blob.arrayBuffer().then((buffer) => {
			this.result = buffer;
			if (typeof this.onloadend === 'function') {
				this.onloadend();
			}
		});
	}

	readAsDataURL(blob) {
		blob.arrayBuffer().then((buffer) => {
			const base64 = Buffer.from(buffer).toString('base64');
			const mimeType = blob.type || 'application/octet-stream';
			this.result = `data:${mimeType};base64,${base64}`;
			if (typeof this.onloadend === 'function') {
				this.onloadend();
			}
		});
	}
}

if (typeof globalThis.FileReader === 'undefined') {
	globalThis.FileReader = NodeFileReader;
}

const ROOT_DIR = path.resolve(process.cwd());
const MODELS_DIR = path.resolve(ROOT_DIR, 'scripts', 'output', '3d-assets', 'models');
const loader = new GLTFLoader();
const exporter = new GLTFExporter();

const EXPERIMENT = Object.freeze({
	targetGlb: path.resolve(MODELS_DIR, 'mj-tile-boolean-experiment-basic.glb'),
	targetMetadata: path.resolve(MODELS_DIR, 'mj-tile-boolean-experiment-basic.json'),
	cutterGlb: path.resolve(MODELS_DIR, 'mj-tile-cutter-flower-1.glb'),
	cutterMetadata: path.resolve(MODELS_DIR, 'mj-tile-cutter-flower-1.json'),
	outputGlb: path.resolve(MODELS_DIR, 'mj-tile-boolean-carved-flower-1.glb'),
	outputMetadata: path.resolve(MODELS_DIR, 'mj-tile-boolean-carved-flower-1.json'),
	sceneName: 'MahjongTileBooleanCarvedFlower1',
	resultMeshName: 'tileBooleanCarved',
	cutterInset: 0.0005,
	cutterLift: 0.0002,
});

const targetMetadata = JSON.parse(fs.readFileSync(EXPERIMENT.targetMetadata, 'utf8'));
const cutterMetadata = JSON.parse(fs.readFileSync(EXPERIMENT.cutterMetadata, 'utf8'));

const targetScene = await loadGlbScene(EXPERIMENT.targetGlb);
const cutterScene = await loadGlbScene(EXPERIMENT.cutterGlb);

const targetMesh = findFirstMeshByName(targetScene, targetMetadata.meshName);
const cutterMesh = findFirstMeshByName(cutterScene, cutterMetadata.meshName);

if (!targetMesh) {
	throw new Error(`Could not find target mesh "${targetMetadata.meshName}" in ${EXPERIMENT.targetGlb}`);
}

if (!cutterMesh) {
	throw new Error(`Could not find cutter mesh "${cutterMetadata.meshName}" in ${EXPERIMENT.cutterGlb}`);
}

const targetBrush = new Brush(targetMesh.geometry.clone(), targetMesh.material.clone());
	targetBrush.name = targetMetadata.meshName;
targetBrush.position.copy(targetMesh.position);
targetBrush.quaternion.copy(targetMesh.quaternion);
targetBrush.scale.copy(targetMesh.scale);
targetBrush.updateMatrixWorld(true);

const cutterBrush = new Brush(cutterMesh.geometry.clone(), cutterMesh.material.clone());
cutterBrush.name = cutterMetadata.meshName;
cutterBrush.position.set(0, targetMetadata.height - EXPERIMENT.cutterLift, 0);
cutterBrush.quaternion.copy(cutterMesh.quaternion);
cutterBrush.scale.copy(cutterMesh.scale);
cutterBrush.updateMatrixWorld(true);

const evaluator = new Evaluator();
evaluator.useGroups = false;
evaluator.consolidateGroups = true;
evaluator.removeUnusedMaterials = true;

const resultBrush = evaluator.evaluate(targetBrush, cutterBrush, SUBTRACTION);
resultBrush.name = EXPERIMENT.resultMeshName;
resultBrush.material = new THREE.MeshStandardMaterial({
	color: '#f2f4f7',
	roughness: 0.5,
	metalness: 0,
});
resultBrush.position.set(0, 0, 0);
resultBrush.quaternion.identity();
resultBrush.scale.set(1, 1, 1);
resultBrush.updateMatrixWorld(true);
resultBrush.geometry.computeBoundingBox();
resultBrush.geometry.computeBoundingSphere();
resultBrush.geometry.computeVertexNormals();

const outputGroup = new THREE.Group();
outputGroup.name = EXPERIMENT.sceneName;
outputGroup.add(resultBrush);
outputGroup.updateMatrixWorld(true);

await exportSceneAsGlb(outputGroup, EXPERIMENT.sceneName, EXPERIMENT.outputGlb);

const metadata = {
	sourceTargetGlb: EXPERIMENT.targetGlb,
	sourceTargetMetadata: EXPERIMENT.targetMetadata,
	sourceCutterGlb: EXPERIMENT.cutterGlb,
	sourceCutterMetadata: EXPERIMENT.cutterMetadata,
	outputGlb: EXPERIMENT.outputGlb,
	resultMeshName: EXPERIMENT.resultMeshName,
	operation: 'SUBTRACTION',
	targetMeshName: targetMetadata.meshName,
	cutterMeshName: cutterMetadata.meshName,
	targetBody: {
		width: targetMetadata.width,
		height: targetMetadata.height,
		depth: targetMetadata.depth,
		radius: targetMetadata.radius,
	},
	cutter: {
		targetWidth: cutterMetadata.targetWidth,
		targetDepth: cutterMetadata.targetDepth,
		cutterDepth: cutterMetadata.cutterDepth,
		placementContract: cutterMetadata.placementContract,
		worldPosition: {
			x: cutterBrush.position.x,
			y: cutterBrush.position.y,
			z: cutterBrush.position.z,
		},
	},
	notes: [
		'Offline boolean subtraction result.',
		'Cutter is placed on the top plane of the experimental target body and extrudes downward.',
		'This output is meant to be loaded directly in the POC for visual inspection before any runtime integration work.',
	],
};

fs.writeFileSync(EXPERIMENT.outputMetadata, JSON.stringify(metadata, null, 2));
console.log(`Wrote ${path.basename(EXPERIMENT.outputMetadata)}`);

disposeGroup(outputGroup);
disposeGroup(targetScene);
disposeGroup(cutterScene);

async function loadGlbScene(glbPath) {
	const glbBuffer = fs.readFileSync(glbPath);
	const arrayBuffer = glbBuffer.buffer.slice(
		glbBuffer.byteOffset,
		glbBuffer.byteOffset + glbBuffer.byteLength,
	);
	const gltf = await loader.parseAsync(arrayBuffer, path.dirname(glbPath));
	return gltf.scene;
}

function findFirstMeshByName(root, meshName) {
	let found = null;
	root.traverse((object) => {
		if (found || !object.isMesh) {
			return;
		}

		if (!meshName || object.name === meshName) {
			found = object;
		}
	});
	return found;
}

async function exportSceneAsGlb(group, sceneName, outputPath) {
	const scene = new THREE.Scene();
	scene.name = sceneName;
	scene.add(group);

	const glb = await exporter.parseAsync(scene, { binary: true });
	fs.writeFileSync(outputPath, Buffer.from(glb));
	console.log(`Exported ${path.basename(outputPath)}`);
}

function disposeGroup(group) {
	group.traverse((object) => {
		if (!object.isMesh) {
			return;
		}

		object.geometry?.dispose();
		const materials = Array.isArray(object.material) ? object.material : [object.material];
		materials.forEach((material) => material?.dispose?.());
	});
}

