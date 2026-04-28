import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { BASE_TILE_MODELS_DIR, ROOT_DIR } from '../shared/asset-paths.js';

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

const BASE_TILE_DIR = BASE_TILE_MODELS_DIR;
const MANIFEST_PATH = path.resolve(BASE_TILE_DIR, 'base-tile-manifest.json');
const exporter = new GLTFExporter();

const BASE_TILE_VARIANTS = Object.freeze([
	Object.freeze({
		id: 'classic-soft',
		label: 'Classic Soft',
		description: 'Rounded placeholder body with a warm ivory material.',
		width: 0.79,
		height: 0.5,
		depth: 1.08,
		radius: 0.105,
		curveSegments: 16,
		bevelSize: 0.028,
		bevelThickness: 0.038,
		bevelSegments: 4,
		color: '#f2ece2',
	}),
	Object.freeze({
		id: 'flat-test',
		label: 'Flat Test',
		description: 'Simpler flatter placeholder body for cutter diagnostics.',
		width: 0.79,
		height: 0.46,
		depth: 1.08,
		radius: 0.07,
		curveSegments: 10,
		bevelSize: 0.012,
		bevelThickness: 0.016,
		bevelSegments: 2,
		color: '#eef1f4',
	}),
	Object.freeze({
		id: 'deep-resin',
		label: 'Deep Resin',
		description: 'Taller translucent placeholder body for future material review.',
		width: 0.8,
		height: 0.56,
		depth: 1.1,
		radius: 0.12,
		curveSegments: 18,
		bevelSize: 0.034,
		bevelThickness: 0.044,
		bevelSegments: 5,
		color: '#e7f2f5',
		opacity: 0.72,
	}),
]);

await main();

async function main() {
	fs.mkdirSync(BASE_TILE_DIR, { recursive: true });

	const entries = [];
	for (const variant of BASE_TILE_VARIANTS) {
		const glbPath = path.resolve(BASE_TILE_DIR, `${variant.id}.glb`);
		const metadataPath = path.resolve(BASE_TILE_DIR, `${variant.id}.json`);
		const group = buildBaseTileGroup(variant);
		await exportGlb(group, glbPath);
		writeJson(metadataPath, buildMetadata(variant, glbPath, metadataPath));
		disposeGroup(group);
		entries.push(buildManifestEntry(variant, glbPath, metadataPath));
	}

	writeJson(MANIFEST_PATH, {
		schemaVersion: 1,
		description: 'Temporary fake base tile GLBs for exercising 3D asset-pipeline intake and selection.',
		variants: entries,
	});
}

function buildBaseTileGroup(variant) {
	const group = new THREE.Group();
	group.name = `BaseTile${pascal(variant.id)}`;

	const geometry = createRoundedBodyGeometry(variant);
	const mesh = new THREE.Mesh(geometry, createMaterial(variant));
	mesh.name = 'baseTileBody';
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	group.add(mesh);
	group.updateMatrixWorld(true);

	return group;
}

function createRoundedBodyGeometry(variant) {
	const shape = createRoundedRectShape(variant.width, variant.depth, variant.radius);
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: variant.height,
		bevelEnabled: true,
		bevelSize: variant.bevelSize,
		bevelThickness: variant.bevelThickness,
		bevelSegments: variant.bevelSegments,
		curveSegments: variant.curveSegments,
		steps: 1,
	});
	geometry.rotateX(-Math.PI / 2);
	geometry.translate(0, -variant.height / 2, 0);
	geometry.computeVertexNormals();
	return geometry;
}

function createRoundedRectShape(width, depth, radius) {
	const shape = new THREE.Shape();
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	const safeRadius = Math.min(radius, halfWidth, halfDepth);

	shape.moveTo(-halfWidth + safeRadius, -halfDepth);
	shape.lineTo(halfWidth - safeRadius, -halfDepth);
	shape.absarc(halfWidth - safeRadius, -halfDepth + safeRadius, safeRadius, -Math.PI / 2, 0, false);
	shape.lineTo(halfWidth, halfDepth - safeRadius);
	shape.absarc(halfWidth - safeRadius, halfDepth - safeRadius, safeRadius, 0, Math.PI / 2, false);
	shape.lineTo(-halfWidth + safeRadius, halfDepth);
	shape.absarc(-halfWidth + safeRadius, halfDepth - safeRadius, safeRadius, Math.PI / 2, Math.PI, false);
	shape.lineTo(-halfWidth, -halfDepth + safeRadius);
	shape.absarc(-halfWidth + safeRadius, -halfDepth + safeRadius, safeRadius, Math.PI, Math.PI * 1.5, false);
	shape.closePath();

	return shape;
}

function createMaterial(variant) {
	const material = new THREE.MeshStandardMaterial({
		color: variant.color,
		roughness: 0.58,
		metalness: 0,
		transparent: variant.opacity !== undefined && variant.opacity < 1,
		opacity: variant.opacity ?? 1,
	});
	material.name = `${variant.id}-body-material`;
	return material;
}

async function exportGlb(group, outputPath) {
	const scene = new THREE.Scene();
	scene.name = group.name;
	scene.add(group);
	const glb = await exporter.parseAsync(scene, { binary: true });
	fs.writeFileSync(outputPath, Buffer.from(glb));
	console.log(`Exported ${relativePath(outputPath)}`);
}

function buildMetadata(variant, glbPath, metadataPath) {
	return {
		schemaVersion: 1,
		id: variant.id,
		label: variant.label,
		description: variant.description,
		kind: 'base-tile-glb',
		temporary: true,
		meshName: 'baseTileBody',
		glb: relativePath(glbPath),
		metadata: relativePath(metadataPath),
		body: {
			width: variant.width,
			height: variant.height,
			depth: variant.depth,
			radius: variant.radius,
			bevelSize: variant.bevelSize,
			bevelThickness: variant.bevelThickness,
			bevelSegments: variant.bevelSegments,
			curveSegments: variant.curveSegments,
		},
		material: {
			color: variant.color,
			opacity: variant.opacity ?? 1,
		},
		notes: [
			'Temporary generated placeholder for exercising base tile selection.',
			'Replace with contracted production base tile GLBs when available.',
		],
	};
}

function buildManifestEntry(variant, glbPath, metadataPath) {
	return {
		id: variant.id,
		label: variant.label,
		description: variant.description,
		kind: 'base-tile-glb',
		temporary: true,
		glb: relativePath(glbPath),
		metadata: relativePath(metadataPath),
		body: {
			width: variant.width,
			height: variant.height,
			depth: variant.depth,
		},
	};
}

function writeJson(outputPath, payload) {
	fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
	console.log(`Wrote ${relativePath(outputPath)}`);
}

function disposeGroup(group) {
	group.traverse((object) => {
		if (!object.isMesh) {
			return;
		}

		object.geometry?.dispose();
		const materials = Array.isArray(object.material) ? object.material : [object.material];
		materials.forEach((material) => material?.dispose());
	});
}

function pascal(value) {
	return String(value || '')
		.split(/[^a-z0-9]+/i)
		.filter(Boolean)
		.map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
		.join('');
}

function relativePath(filename) {
	return path.relative(ROOT_DIR, filename).replaceAll('\\', '/');
}
