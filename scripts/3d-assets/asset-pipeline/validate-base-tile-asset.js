import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { installNodeGltfExportShim } from './node-gltf-export-shim.js';

class NodeFileReader {
	constructor() {
		this.result = null;
		this.onloadend = null;
	}

	readAsArrayBuffer(blob) {
		blob.arrayBuffer().then((buffer) => {
			this.result = buffer;
			this.onloadend?.();
		});
	}

	readAsDataURL(blob) {
		blob.arrayBuffer().then((buffer) => {
			const base64 = Buffer.from(buffer).toString('base64');
			const mimeType = blob.type || 'application/octet-stream';
			this.result = `data:${mimeType};base64,${base64}`;
			this.onloadend?.();
		});
	}
}

if (typeof globalThis.FileReader === 'undefined') {
	globalThis.FileReader = NodeFileReader;
}

installNodeGltfExportShim();

const DEFAULT_TOLERANCE = 0.025;

await main();

async function main() {
	const options = readOptions();
	resolveBaseTileInputs(options);
	const report = await validateBaseTile(options);
	printReport(report);
	process.exitCode = report.errors.length > 0 ? 1 : 0;
}

async function validateBaseTile(options) {
	const errors = [];
	const warnings = [];
	const info = [];
	const metadata = readJson(options.metadataPath, errors);
	const glbPath = path.resolve(options.glbPath || metadata?.glb || '');
	const meshName = options.meshName || metadata?.meshName || 'baseTileBody';
	const body = metadata?.body || {};
	const supportMeshNames = supportMeshNamesForMetadata(metadata);

	if (!metadata) {
		return { ok: false, errors, warnings, info };
	}

	validateMetadataShape(metadata, { glbPath, meshName, body, errors, warnings, info });

	if (!glbPath || !fs.existsSync(glbPath)) {
		errors.push(`Missing GLB file: ${glbPath || '(not specified)'}`);
		return { ok: false, errors, warnings, info };
	}

	const scene = await loadGlbScene(glbPath);
	const meshes = collectMeshes(scene);
	const targetMesh = meshes.find((mesh) => mesh.name === meshName);

	info.push(`Loaded GLB: ${relativePath(glbPath)}`);
	info.push(`Mesh count: ${meshes.length}`);

	if (!targetMesh) {
		errors.push(`Could not find mesh "${meshName}". Available mesh names: ${meshes.map((mesh) => mesh.name || '(unnamed)').join(', ')}`);
		return { ok: false, errors, warnings, info };
	}

	scene.updateMatrixWorld(true);
	targetMesh.updateMatrixWorld(true);
	const boundsTarget = supportMeshNames.length > 0 ? scene : targetMesh;
	const box = new THREE.Box3().setFromObject(boundsTarget);
	const size = box.getSize(new THREE.Vector3());
	const center = box.getCenter(new THREE.Vector3());

	info.push(`Validated mesh: ${meshName}`);
	if (boundsTarget === scene) {
		info.push(`Measured assembly bounds using support meshes: ${supportMeshNames.join(', ')}`);
	}
	info.push(`Measured bounds: width X=${format(size.x)}, height Y=${format(size.y)}, depth Z=${format(size.z)}`);
	info.push(`Measured center: X=${format(center.x)}, Y=${format(center.y)}, Z=${format(center.z)}`);

	validateBounds({ size, center, body, tolerance: options.tolerance, errors, warnings, info });
	validateMaterial(targetMesh, { warnings, info });
	validateTransforms(targetMesh, { warnings });

	if (options.outputReviewGlb) {
		await exportReviewGlb({
			sourceScene: scene,
			targetMesh,
			body,
			outputPath: options.outputReviewGlb,
		});
		info.push(`Wrote review GLB: ${relativePath(path.resolve(options.outputReviewGlb))}`);
	}

	return {
		ok: errors.length === 0,
		errors,
		warnings,
		info,
	};
}

async function exportReviewGlb({ sourceScene, targetMesh, body, outputPath }) {
	const scene = new THREE.Scene();
	scene.name = 'BaseTileValidationReview';
	const tileClone = sourceScene.clone(true);
	tileClone.name = 'submitted-base-tile';
	scene.add(tileClone);

	const expected = expectedOuterBounds(body);
	const topSurfaceY = Number.isFinite(body.height) && Number.isFinite(body.bevelThickness)
		? (body.height / 2) + body.bevelThickness
		: expected.height / 2;
	const faceY = topSurfaceY + 0.002;

	scene.add(createBoxFrame({
		name: 'validator-expected-outer-bounds',
		width: expected.width,
		height: expected.height,
		depth: expected.depth,
		color: '#f6c445',
		thickness: 0.004,
	}));
	scene.add(createPlaneMarker({
		name: 'validator-top-carve-plane',
		width: expected.width,
		depth: expected.depth,
		y: topSurfaceY,
		color: '#39d98a',
		opacity: 0.2,
	}));
	scene.add(createPlaneMarker({
		name: 'validator-face-rectangle',
		width: body.width ?? expected.width,
		depth: body.depth ?? expected.depth,
		y: faceY,
		color: '#58a6ff',
		opacity: 0.28,
	}));
	scene.add(createAxesMarker(expected));
	scene.add(createCenterLine(expected.height));

	const output = path.resolve(outputPath);
	fs.mkdirSync(path.dirname(output), { recursive: true });
	const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
	fs.writeFileSync(output, Buffer.from(glb));

	disposeReviewScene(scene);
	targetMesh.updateMatrixWorld(true);
}

function createPlaneMarker({ name, width, depth, y, color, opacity }) {
	const geometry = new THREE.PlaneGeometry(width, depth);
	geometry.rotateX(-Math.PI / 2);
	const material = new THREE.MeshBasicMaterial({
		color,
		transparent: true,
		opacity,
		side: THREE.DoubleSide,
		depthWrite: false,
	});
	material.name = `${name}-material`;
	const mesh = new THREE.Mesh(geometry, material);
	mesh.name = name;
	mesh.position.y = y;
	return mesh;
}

function createAxesMarker(expected) {
	const group = new THREE.Group();
	group.name = 'validator-axes';
	const y = (expected.height / 2) + 0.08;

	group.add(createBar({
		name: 'validator-axis-x-width-red',
		size: [expected.width, 0.01, 0.01],
		position: [0, y, 0],
		color: '#ff4d4f',
	}));
	group.add(createBar({
		name: 'validator-axis-y-thickness-green',
		size: [0.01, expected.height, 0.01],
		position: [-(expected.width / 2) - 0.08, 0, 0],
		color: '#52c41a',
	}));
	group.add(createBar({
		name: 'validator-axis-z-depth-blue',
		size: [0.01, 0.01, expected.depth],
		position: [0, y + 0.04, 0],
		color: '#1677ff',
	}));

	return group;
}

function createCenterLine(height) {
	return createBar({
		name: 'validator-origin-centerline',
		size: [0.008, height + 0.16, 0.008],
		position: [0, 0, 0],
		color: '#ffffff',
		opacity: 0.6,
	});
}

function createBoxFrame({ name, width, height, depth, color, thickness }) {
	const group = new THREE.Group();
	group.name = name;
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	const halfDepth = depth / 2;
	const edgeSpecs = [];

	for (const y of [-halfHeight, halfHeight]) {
		for (const z of [-halfDepth, halfDepth]) {
			edgeSpecs.push({
				size: [width, thickness, thickness],
				position: [0, y, z],
			});
		}
		for (const x of [-halfWidth, halfWidth]) {
			edgeSpecs.push({
				size: [thickness, thickness, depth],
				position: [x, y, 0],
			});
		}
	}
	for (const x of [-halfWidth, halfWidth]) {
		for (const z of [-halfDepth, halfDepth]) {
			edgeSpecs.push({
				size: [thickness, height, thickness],
				position: [x, 0, z],
			});
		}
	}

	for (const [index, edge] of edgeSpecs.entries()) {
		group.add(createBar({
			name: `${name}-edge-${String(index).padStart(2, '0')}`,
			size: edge.size,
			position: edge.position,
			color,
		}));
	}

	return group;
}

function createBar({ name, size, position, color, opacity = 1 }) {
	const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
	const material = new THREE.MeshBasicMaterial({
		color,
		transparent: opacity < 1,
		opacity,
	});
	material.name = `${name}-material`;
	const mesh = new THREE.Mesh(geometry, material);
	mesh.name = name;
	mesh.position.set(position[0], position[1], position[2]);
	return mesh;
}

function disposeReviewScene(scene) {
	scene.traverse((object) => {
		if (!object.isMesh) {
			return;
		}
		object.geometry?.dispose?.();
		const materials = Array.isArray(object.material) ? object.material : [object.material];
		for (const material of materials) {
			material?.dispose?.();
		}
	});
}

function validateMetadataShape(metadata, { glbPath, meshName, body, errors, warnings, info }) {
	if (metadata.kind && metadata.kind !== 'base-tile-glb') {
		warnings.push(`Expected metadata.kind "base-tile-glb"; found "${metadata.kind}".`);
	}
	if (!meshName) {
		errors.push('Missing metadata.meshName. Use "baseTileBody" unless another mesh name is agreed.');
	}
	if (!glbPath) {
		errors.push('Missing GLB path. Pass --glb or set metadata.glb.');
	}
	for (const key of ['width', 'height', 'depth']) {
		if (!Number.isFinite(body[key])) {
			errors.push(`Missing numeric metadata.body.${key}.`);
		}
	}
	if (!Number.isFinite(body.bevelThickness)) {
		warnings.push('metadata.body.bevelThickness is missing. The current generator uses it to estimate topSurfaceY.');
	} else {
		const topSurfaceY = (body.height / 2) + body.bevelThickness;
		info.push(`Metadata topSurfaceY estimate: ${format(topSurfaceY)} = height / 2 + bevelThickness`);
	}
}

function supportMeshNamesForMetadata(metadata) {
	return [...new Set([
		...(Array.isArray(metadata?.supportMeshNames) ? metadata.supportMeshNames : []),
		...(Array.isArray(metadata?.carving?.preserveMeshNames) ? metadata.carving.preserveMeshNames : []),
	].filter(Boolean))];
}

function validateBounds({ size, center, body, tolerance, errors, warnings }) {
	const expected = expectedOuterBounds(body);
	compareDimension('width/X', size.x, expected.width, tolerance, errors);
	compareDimension('height/Y', size.y, expected.height, tolerance, errors);
	compareDimension('depth/Z', size.z, expected.depth, tolerance, errors);

	const centerTolerance = Math.max(tolerance, 0.01);
	if (Math.abs(center.x) > centerTolerance || Math.abs(center.z) > centerTolerance) {
		warnings.push(`Mesh is not centered on X/Z within ${centerTolerance}: center X=${format(center.x)}, Z=${format(center.z)}.`);
	}
	if (Math.abs(center.y) > Math.max(body.height || 0, size.y) * 0.35) {
		warnings.push(`Mesh Y center is far from origin: center Y=${format(center.y)}. The current examples are centered around Y=0.`);
	}
	if (size.x >= size.z) {
		warnings.push(`Width X (${format(size.x)}) is not smaller than depth Z (${format(size.z)}). Mahjong faces are expected to be portrait-oriented in X/Z.`);
	}
}

function expectedOuterBounds(body) {
	const bevelSize = Number.isFinite(body.bevelSize) ? body.bevelSize : 0;
	const bevelThickness = Number.isFinite(body.bevelThickness) ? body.bevelThickness : 0;

	return {
		width: Number.isFinite(body.width) ? body.width + (bevelSize * 2) : body.width,
		height: Number.isFinite(body.height) ? body.height + (bevelThickness * 2) : body.height,
		depth: Number.isFinite(body.depth) ? body.depth + (bevelSize * 2) : body.depth,
	};
}

function compareDimension(label, measured, expected, tolerance, errors) {
	if (!Number.isFinite(expected)) {
		return;
	}
	const delta = Math.abs(measured - expected);
	if (delta > tolerance) {
		errors.push(`${label} mismatch: measured ${format(measured)}, metadata ${format(expected)}, delta ${format(delta)} exceeds tolerance ${format(tolerance)}.`);
	}
}

function validateMaterial(mesh, { warnings, info }) {
	const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material].filter(Boolean);
	if (materials.length === 0) {
		warnings.push('Target mesh has no material.');
		return;
	}
	info.push(`Material count on target mesh: ${materials.length}`);
	for (const material of materials) {
		if (!material.name) {
			warnings.push('Target mesh has an unnamed material.');
		}
		if (material.transparent && material.opacity >= 1) {
			warnings.push(`Material "${material.name || '(unnamed)'}" is transparent but opacity is ${material.opacity}.`);
		}
	}
}

function validateTransforms(mesh, { warnings }) {
	const scale = mesh.scale;
	if (
		Math.abs(scale.x - 1) > 0.0001
		|| Math.abs(scale.y - 1) > 0.0001
		|| Math.abs(scale.z - 1) > 0.0001
	) {
		warnings.push(`Target mesh has non-identity local scale (${format(scale.x)}, ${format(scale.y)}, ${format(scale.z)}). Apply transforms before export when possible.`);
	}
}

async function loadGlbScene(glbPath) {
	const glbBuffer = fs.readFileSync(glbPath);
	const arrayBuffer = glbBuffer.buffer.slice(
		glbBuffer.byteOffset,
		glbBuffer.byteOffset + glbBuffer.byteLength,
	);
	return new GLTFLoader().parseAsync(arrayBuffer, `${path.dirname(glbPath)}${path.sep}`)
		.then((gltf) => gltf.scene);
}

function collectMeshes(root) {
	const meshes = [];
	root.traverse((object) => {
		if (object.isMesh) {
			meshes.push(object);
		}
	});
	return meshes;
}

function readJson(filename, errors) {
	if (!filename) {
		errors.push('Missing --metadata path.');
		return null;
	}
	const resolved = path.resolve(filename);
	if (!fs.existsSync(resolved)) {
		errors.push(`Missing metadata file: ${resolved}`);
		return null;
	}
	try {
		return JSON.parse(fs.readFileSync(resolved, 'utf8'));
	} catch (error) {
		errors.push(`Could not parse metadata JSON: ${error.message}`);
		return null;
	}
}

function readOptions() {
	const positional = readPositionalArguments();
	const baseName = readArgument('--base-name') || positional[0] || '';
	const metadataPath = readArgument('--metadata') || readArgument('-m');
	const glbPath = readArgument('--glb') || readArgument('-g');
	const meshName = readArgument('--mesh-name') || '';
	const tolerance = Number(readArgument('--tolerance') || DEFAULT_TOLERANCE);
	const outputReviewGlb = readArgument('--output-review-glb') || '';

	if (!baseName && !metadataPath && !glbPath) {
		printUsage();
		process.exit(1);
	}

	return {
		baseName,
		metadataPath,
		glbPath,
		meshName,
		tolerance: Number.isFinite(tolerance) ? tolerance : DEFAULT_TOLERANCE,
		outputReviewGlb,
	};
}

function resolveBaseTileInputs(options) {
	if (!options.baseName) {
		return;
	}

	const resolved = resolveBaseTileByName(options.baseName);
	options.metadataPath ||= resolved.metadataPath;
	options.glbPath ||= resolved.glbPath;
	options.outputReviewGlb ||= resolved.outputReviewGlb;
}

function resolveBaseTileByName(baseName) {
	const normalized = String(baseName || '').replace(/\\/g, '/').replace(/\.(json|glb)$/i, '');
	const stem = normalized.split('/').pop();
	const explicitDir = normalized.includes('/') ? path.dirname(normalized) : '';
	const searchDirs = [
		explicitDir,
		'base-tile',
		'production',
		'.',
		'scripts/data/3d-assets/models/base-tiles',
	].filter(Boolean);

	for (const dir of searchDirs) {
		const metadataPath = path.resolve(dir, `${stem}.json`);
		const glbPath = path.resolve(dir, `${stem}.glb`);
		if (fs.existsSync(metadataPath) || fs.existsSync(glbPath)) {
			return {
				metadataPath,
				glbPath,
				outputReviewGlb: path.resolve(dir, `${stem}-validation-review.glb`),
			};
		}
	}

	return {
		metadataPath: path.resolve(`${stem}.json`),
		glbPath: path.resolve(`${stem}.glb`),
		outputReviewGlb: path.resolve(`${stem}-validation-review.glb`),
	};
}

function readPositionalArguments() {
	const positional = [];
	const optionsWithValues = new Set([
		'--base-name',
		'--metadata',
		'-m',
		'--glb',
		'-g',
		'--mesh-name',
		'--tolerance',
		'--output-review-glb',
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

function readArgument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : '';
}

function printReport(report) {
	console.log(report.ok ? 'PASS base tile asset validation' : 'FAIL base tile asset validation');
	for (const message of report.info) {
		console.log(`info: ${message}`);
	}
	for (const message of report.warnings) {
		console.warn(`warn: ${message}`);
	}
	for (const message of report.errors) {
		console.error(`error: ${message}`);
	}
}

function printUsage() {
	console.log([
		'Usage:',
		'  node validate-base-tile-asset.js <base-name>',
		'',
		'Example:',
		'  node validate-base-tile-asset.js classic-soft',
		'',
		'Advanced:',
		'  node validate-base-tile-asset.js --metadata <base-tile.json> --glb <base-tile.glb> --output-review-glb validation-review.glb',
	].join('\n'));
}

function relativePath(filename) {
	return path.relative(process.cwd(), filename).replaceAll('\\', '/');
}

function format(value) {
	return Number.isFinite(value) ? value.toFixed(4) : String(value);
}
