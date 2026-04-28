import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg/src/index.js';
import {
	BASE_TILE_MODELS_DIR,
	ROOT_DIR,
} from '../shared/asset-paths.js';
import { PipelineModel } from '../svg-preprocessor/PipelineModel.js';

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

const exporter = new GLTFExporter();
const loader = new GLTFLoader();

await main();

async function main() {
	const options = readOptions();
	const model = new PipelineModel({
		referenceName: options.referenceName,
		tileSetName: options.tilesetId,
	});
	await model.start();

	const variant = buildStampedBodyVariant({ model, options });
	const faceHash = model.hashAssetPipelineFaceInput(options.faceKey);
	const stageHash = model.hashAssetGenerationStageInput(options.faceKey, 'stamped-body');
	fs.mkdirSync(path.dirname(variant.outputGlb), { recursive: true });
	fs.mkdirSync(path.dirname(variant.outputMetadata), { recursive: true });

	const stampedAsset = await buildStampedBodyAsset(variant);
	await exportSceneAsGlb(stampedAsset.group, variant.name, variant.outputGlb);
	writeJsonMetadata(variant.outputMetadata, stampedAsset.metadata);
	disposeGroup(stampedAsset.group);

	model.updateAssetGenerationFace(options.faceKey, {
		status: null,
		inputHash: faceHash,
		stageHashes: {
			'stamped-body': stageHash,
		},
		artifacts: {
			stampedModel: relativePath(variant.outputGlb),
			stampedMetadata: relativePath(variant.outputMetadata),
		},
		queue: null,
		build: null,
		failure: null,
	});
	await model.save();
}

function buildStampedBodyVariant({ model, options }) {
	const assetPipeline = model.getAssetPipeline();
	const faceState = assetPipeline.faces?.[options.faceKey];
	const cutterMetadataPath = resolveRepoPath(faceState?.artifacts?.cutterMetadata || '');
	const cutterModelPath = resolveRepoPath(faceState?.artifacts?.cutterModel || '');
	const baseTileVariantId = model.getSelectedBaseTileVariantId();
	const selectedBaseTileVariantId = baseTileVariantId || options.baseTileVariantId;
	const baseTileVariant = readBaseTileVariant(selectedBaseTileVariantId);
	const body = baseTileVariant.body || {};
	const modelFaceKey = `${options.tilesetId}-${options.faceKey}`;
	const outputGlb = path.join(model.pipelineDir, 'models', 'stamped-body', `${options.faceKey}.glb`);
	const outputMetadata = path.join(model.pipelineDir, 'json', 'stamped-body', `${options.faceKey}.json`);

	if (!cutterMetadataPath) {
		throw new Error(`Missing cutter metadata artifact for ${options.tilesetId}/${options.faceKey}.`);
	}

	return Object.freeze({
		faceKey: options.faceKey,
		tilesetId: options.tilesetId,
		modelFaceKey,
		name: `MahjongTileStampedBody${pascal(modelFaceKey)}`,
		meshName: 'stampedTileBody',
		cutterMetadataPath,
		cutterModelPath,
		baseTileVariantId: selectedBaseTileVariantId,
		baseTileVariant,
		baseTileGlb: resolveRepoPath(baseTileVariant.glb || ''),
		baseTileMeshName: baseTileVariant.meshName || 'baseTileBody',
		tileBody: body,
		cutterLift: Number.isFinite(options.cutterLift) ? options.cutterLift : -0.01,
		cutterDepthScale: Number.isFinite(options.cutterDepthScale) ? options.cutterDepthScale : 1,
		cutterFootprintScale: Number.isFinite(options.cutterFootprintScale) ? options.cutterFootprintScale : 1,
		outputGlb,
		outputMetadata,
	});
}

async function buildStampedBodyAsset(variant) {
	const cutterMetadata = readJson(variant.cutterMetadataPath);
	const baseScene = await loadGlbScene(variant.baseTileGlb);
	const baseMesh = findFirstMeshByName(baseScene, variant.baseTileMeshName);

	if (!baseMesh) {
		throw new Error(`Could not find base tile mesh "${variant.baseTileMeshName}" in ${variant.baseTileGlb}.`);
	}

	baseScene.updateMatrixWorld(true);
	const bodyMesh = cloneMeshForExport(baseMesh, variant.meshName);
	const topSurfaceY = getTileTopSurfaceY({
		...variant.tileBody,
		...cutterMetadata.baseTileVariant?.body,
	});

	if (cutterMetadata.empty) {
		const group = createGroup(variant.name, bodyMesh);
		disposeGroup(baseScene);
		return {
			group,
			metadata: stampedMetadata({
				variant,
				cutterMetadata,
				mode: 'blank-body',
				topSurfaceY,
				appliedPlacement: null,
				notes: [
					'Cutter metadata is empty; stamped output is the selected base tile body without carving.',
				],
			}),
		};
	}

	if (!variant.cutterModelPath) {
		throw new Error(`Cutter metadata is non-empty but cutter model is missing for ${variant.tilesetId}/${variant.faceKey}.`);
	}

	const cutterScene = await loadGlbScene(variant.cutterModelPath);
	const cutterMesh = findFirstMeshByName(cutterScene, cutterMetadata.meshName);

	if (!cutterMesh) {
		throw new Error(`Could not find cutter mesh "${cutterMetadata.meshName}" in ${variant.cutterModelPath}.`);
	}

	cutterScene.updateMatrixWorld(true);
	const baseBrush = new Brush(bodyMesh.geometry.clone(), cloneMaterial(bodyMesh.material));
	baseBrush.name = variant.meshName;
	baseBrush.updateMatrixWorld(true);

	const appliedPlacement = cutterPlacement({ variant, cutterMetadata, topSurfaceY });
	const cutterBrush = createPlacedCutterBrush({
		cutterMesh,
		cutterMetadata,
		placement: appliedPlacement,
	});

	const evaluator = new Evaluator();
	evaluator.useGroups = false;
	evaluator.consolidateGroups = true;
	evaluator.removeUnusedMaterials = true;

	const stampedBrush = evaluator.evaluate(baseBrush, cutterBrush, SUBTRACTION);
	stampedBrush.name = variant.meshName;
	stampedBrush.material = cloneMaterial(bodyMesh.material);
	stampedBrush.position.set(0, 0, 0);
	stampedBrush.quaternion.identity();
	stampedBrush.scale.set(1, 1, 1);
	stampedBrush.geometry.computeVertexNormals();
	stampedBrush.geometry.computeBoundingBox();
	stampedBrush.geometry.computeBoundingSphere();
	stampedBrush.updateMatrixWorld(true);

	const group = createGroup(variant.name, stampedBrush);
	const metadata = stampedMetadata({
		variant,
		cutterMetadata,
		mode: 'boolean-subtraction',
		topSurfaceY,
		appliedPlacement,
		notes: [
			'Stamped body is derived by subtracting the SVG cutter model from the selected reusable base tile body.',
			'The cutter is already normalized to prepared tile-face space by SVG cutter generation.',
		],
	});

	disposeGroup(baseScene);
	disposeGroup(cutterScene);
	disposeMesh(baseBrush);
	disposeMesh(cutterBrush);
	disposeMesh(bodyMesh);

	return { group, metadata };
}

function stampedMetadata({ variant, cutterMetadata, mode, topSurfaceY, appliedPlacement, notes }) {
	return {
		faceKey: variant.faceKey,
		tilesetId: variant.tilesetId,
		modelFaceKey: variant.modelFaceKey,
		mode,
		meshName: variant.meshName,
		outputGlb: relativePath(variant.outputGlb),
		sourceBaseTileGlb: relativePath(variant.baseTileGlb),
		sourceCutterGlb: variant.cutterModelPath ? relativePath(variant.cutterModelPath) : null,
		sourceCutterMetadata: relativePath(variant.cutterMetadataPath),
		baseTileVariantId: variant.baseTileVariantId,
		baseTileVariant: {
			id: variant.baseTileVariant.id,
			label: variant.baseTileVariant.label,
			glb: variant.baseTileVariant.glb,
			metadata: variant.baseTileVariant.metadata,
			body: variant.baseTileVariant.body,
		},
		width: variant.tileBody.width ?? cutterMetadata.targetWidth ?? null,
		height: variant.tileBody.height ?? null,
		depth: variant.tileBody.depth ?? cutterMetadata.targetDepth ?? null,
		topSurfaceY,
		cutter: {
			empty: Boolean(cutterMetadata.empty),
			cutterDepth: cutterMetadata.cutterDepth ?? null,
			targetRect: cutterMetadata.targetRect ?? null,
			sourceGlyphBounds: cutterMetadata.sourceGlyphBounds ?? null,
		},
		appliedPlacement,
		notes,
	};
}

function cutterPlacement({ variant, cutterMetadata, topSurfaceY }) {
	return {
		footprintScale: variant.cutterFootprintScale,
		depthScale: variant.cutterDepthScale,
		centerX: 0,
		centerZ: 0,
		y: topSurfaceY - variant.cutterLift,
		targetRect: cutterMetadata.targetRect ?? null,
	};
}

function createPlacedCutterBrush({ cutterMesh, cutterMetadata, placement }) {
	const cutterGeometry = cutterMesh.geometry.clone();
	cutterGeometry.scale(
		placement.footprintScale,
		placement.depthScale,
		placement.footprintScale,
	);
	cutterGeometry.computeVertexNormals();

	const cutterBrush = new Brush(cutterGeometry, cloneMaterial(cutterMesh.material));
	cutterBrush.name = cutterMetadata.meshName;
	cutterBrush.position.set(placement.centerX, placement.y, placement.centerZ);
	cutterBrush.updateMatrixWorld(true);
	return cutterBrush;
}

function cloneMeshForExport(mesh, name) {
	const clone = new THREE.Mesh(mesh.geometry.clone(), cloneMaterial(mesh.material));
	mesh.updateMatrixWorld(true);
	mesh.geometry.computeVertexNormals();
	clone.name = name;
	clone.applyMatrix4(mesh.matrixWorld);
	clone.position.set(0, 0, 0);
	clone.quaternion.identity();
	clone.scale.set(1, 1, 1);
	clone.updateMatrixWorld(true);
	return clone;
}

function createGroup(name, mesh) {
	const group = new THREE.Group();
	group.name = name;
	group.add(mesh);
	group.updateMatrixWorld(true);
	return group;
}

async function loadGlbScene(glbPath) {
	if (!glbPath || !fs.existsSync(glbPath)) {
		throw new Error(`Missing GLB file: ${glbPath || '(missing)'}.`);
	}

	const glbBuffer = fs.readFileSync(glbPath);
	const arrayBuffer = glbBuffer.buffer.slice(
		glbBuffer.byteOffset,
		glbBuffer.byteOffset + glbBuffer.byteLength,
	);
	const gltf = await loader.parseAsync(arrayBuffer, `${path.dirname(glbPath)}${path.sep}`);
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
	console.log(`Exported ${relativePath(outputPath)}`);
}

function writeJsonMetadata(outputPath, data) {
	fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
	console.log(`Wrote ${relativePath(outputPath)}`);
}

function readBaseTileVariant(variantId) {
	if (!variantId) {
		throw new Error('Missing selected base tile variant in assetPipeline.baseTileSelection.');
	}

	const manifestPath = path.join(BASE_TILE_MODELS_DIR, 'base-tile-manifest.json');
	const manifest = readJson(manifestPath);
	const manifestVariant = (manifest.variants || []).find((variant) => variant.id === variantId);

	if (!manifestVariant) {
		throw new Error(`Unknown base tile variant: ${variantId}.`);
	}

	const metadataPath = resolveRepoPath(manifestVariant.metadata || '');
	const metadata = metadataPath && fs.existsSync(metadataPath)
		? readJson(metadataPath)
		: {};

	return {
		...manifestVariant,
		...metadata,
		body: {
			...(manifestVariant.body || {}),
			...(metadata.body || {}),
		},
	};
}

function getTileTopSurfaceY(body) {
	const height = Number.isFinite(body.height) ? body.height : 0.5;
	const bevelThickness = Number.isFinite(body.bevelThickness) ? body.bevelThickness : 0;
	return (height / 2) + bevelThickness;
}

function cloneMaterial(material) {
	if (Array.isArray(material)) {
		return material.map((entry) => entry.clone());
	}
	return material?.clone?.() || new THREE.MeshStandardMaterial({
		color: '#f2ece2',
		roughness: 0.7,
		metalness: 0.02,
	});
}

function disposeMesh(mesh) {
	mesh.geometry?.dispose?.();
	const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
	materials.forEach((material) => material?.dispose?.());
}

function disposeGroup(group) {
	group.traverse((object) => {
		if (!object.isMesh) {
			return;
		}

		disposeMesh(object);
	});
}

function readOptions() {
	const tilesetId = readArgument('--tileset-id') || process.env.PIPELINE_TILESET_ID;
	const faceKey = readArgument('--face-key') || readPositionalArguments()[0];
	const referenceName = readArgument('--reference-name') || 'default-large-faces';
	const baseTileVariantId = readArgument('--base-tile-variant-id') || '';
	const cutterLift = numberArgument('--cutter-lift');
	const cutterDepthScale = numberArgument('--cutter-depth-scale');
	const cutterFootprintScale = numberArgument('--cutter-footprint-scale');

	if (!tilesetId) {
		throw new Error('Missing --tileset-id.');
	}

	if (!faceKey) {
		throw new Error('Missing --face-key.');
	}

	return {
		tilesetId,
		faceKey,
		referenceName,
		baseTileVariantId,
		cutterLift,
		cutterDepthScale,
		cutterFootprintScale,
	};
}

function readArgument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : null;
}

function numberArgument(name) {
	const value = readArgument(name);
	return value == null ? null : Number(value);
}

function readPositionalArguments() {
	const positional = [];
	const optionsWithValues = new Set([
		'--tileset-id',
		'--face-key',
		'--reference-name',
		'--base-tile-variant-id',
		'--cutter-lift',
		'--cutter-depth-scale',
		'--cutter-footprint-scale',
	]);

	for (let index = 2; index < process.argv.length; index += 1) {
		const argument = process.argv[index];
		if (optionsWithValues.has(argument)) {
			index += 1;
			continue;
		}
		if (argument.startsWith('--')) {
			continue;
		}
		positional.push(argument);
	}

	return positional;
}

function readJson(filename) {
	return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function resolveRepoPath(filename) {
	return filename ? path.resolve(ROOT_DIR, filename) : '';
}

function relativePath(filename) {
	return path.relative(ROOT_DIR, filename).replaceAll('\\', '/');
}

function pascal(value) {
	return value
		.split(/[^a-zA-Z0-9]+/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join('');
}
