import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createCanvas, loadImage } from '../psd-maps/node_modules/canvas/index.js';
import { GENERATED_TOP_MAPS_DIR, OUTPUT_MODELS_DIR } from '../shared/asset-paths.js';

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

const OUTPUT_DIR = OUTPUT_MODELS_DIR;
const TOP_MAPS_DIR = GENERATED_TOP_MAPS_DIR;
const exporter = new GLTFExporter();
const TOP_SURFACE_SCALE = 0.9;
const TOP_SURFACE_LIFT = 0.00015;
const SHELL_WALL_THICKNESS = 0.055;
const TOP_SURFACE_INSET_DEPTH = 0.028;
const FACE_FLOOR_SCALE = 0.76;
const FACE_SHOULDER_DEPTH = 0.045;
const STEEP_INSET_DEPTH = 0.075;
const RELIEF_SUBDIVISION_MULTIPLIER = 4;

const TILE_VARIANTS = [
	{
		key: 'balanced',
		filename: 'mj-tile-body-balanced.glb',
		name: 'MahjongTileBodyBalanced',
		width: 0.79,
		height: 0.5,
		depth: 1.08,
		segments: 5,
		radius: 0.075,
	},
	{
		key: 'crisp',
		filename: 'mj-tile-body-crisp.glb',
		name: 'MahjongTileBodyCrisp',
		width: 0.79,
		height: 0.5,
		depth: 1.08,
		segments: 4,
		radius: 0.05,
	},
	{
		key: 'soft',
		filename: 'mj-tile-body-soft.glb',
		name: 'MahjongTileBodySoft',
		width: 0.79,
		height: 0.5,
		depth: 1.08,
		segments: 6,
		radius: 0.095,
	},
	{
		key: 'inset',
		filename: 'mj-tile-body-inset.glb',
		name: 'MahjongTileBodyInset',
		width: 0.79,
		height: 0.5,
		depth: 1.08,
		segments: 5,
		radius: 0.075,
		topSurfaceScale: 0.84,
		topSurfaceInsetDepth: TOP_SURFACE_INSET_DEPTH,
	},
	{
		key: 'shouldered',
		filename: 'mj-tile-body-shouldered.glb',
		name: 'MahjongTileBodyShouldered',
		width: 0.79,
		height: 0.5,
		depth: 1.08,
		segments: 5,
		radius: 0.075,
		topOpeningScale: 0.88,
		faceFloorScale: FACE_FLOOR_SCALE,
		topSurfaceInsetDepth: 0.065,
		shoulderDepth: FACE_SHOULDER_DEPTH,
	},
	{
		key: 'steep-inset',
		filename: 'mj-tile-body-steep-inset.glb',
		name: 'MahjongTileBodySteepInset',
		width: 0.79,
		height: 0.5,
		depth: 1.08,
		segments: 4,
		radius: 0.045,
		topSurfaceScale: 0.74,
		topSurfaceInsetDepth: STEEP_INSET_DEPTH,
	},
];

const RELIEF_POC_VARIANTS = [
	{
		faceKey: 'flower-1',
		bodyVariantKey: 'balanced',
		filename: 'mj-tile-relief-poc-flower-1.glb',
		metadataFilename: 'mj-tile-relief-poc-flower-1.json',
		name: 'MahjongTileReliefPocFlower1',
		useSolidBody: true,
		topOpeningScaleOverride: 1,
		topSurfaceScaleOverride: 1,
		topInsetDepthOverride: 0,
		floorDepth: 0.02,
		wallDepth: 0.012,
		shoulderDepth: 0.005,
		minMask: 0.02,
		wallWidthPx: 1.8,
		shoulderWidthPx: 4.5,
		floorInsetPx: 4.2,
		maxSearchRadiusPx: 10,
	},
];

const BOOLEAN_EXPERIMENT_VARIANTS = [
	{
		key: 'basic-flat-top',
		filename: 'mj-tile-boolean-experiment-basic.glb',
		metadataFilename: 'mj-tile-boolean-experiment-basic.json',
		name: 'MahjongTileBooleanExperimentBasic',
		meshName: 'tileBooleanTarget',
		width: 0.79,
		height: 0.5,
		depth: 1.08,
		segments: 8,
		radius: 0.08,
	},
];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const variant of TILE_VARIANTS) {
	const tileGroup = buildTileAsset(variant);
	await exportSceneAsGlb(tileGroup, variant.name, variant.filename);
	disposeTileAsset(tileGroup);
}

for (const variant of RELIEF_POC_VARIANTS) {
	const reliefAsset = await buildReliefPocAsset(variant);
	await exportSceneAsGlb(reliefAsset.group, variant.name, variant.filename);
	writeReliefMetadata(variant, reliefAsset.metadata);
	disposeTileAsset(reliefAsset.group);
}

for (const variant of BOOLEAN_EXPERIMENT_VARIANTS) {
	const booleanAsset = buildBooleanExperimentAsset(variant);
	await exportSceneAsGlb(booleanAsset.group, variant.name, variant.filename);
	writeJsonMetadata(variant.metadataFilename, booleanAsset.metadata);
	disposeTileAsset(booleanAsset.group);
}

function buildTileAsset(variant) {
	const bodyGeometry = createCaplessShellGeometry(variant);
	const topSurfaceScale = variant.faceFloorScale ?? variant.topSurfaceScale ?? TOP_SURFACE_SCALE;
	const topSurfaceInsetDepth = variant.topSurfaceInsetDepth ?? 0;
	const topGeometry = new THREE.PlaneGeometry(
		variant.width * topSurfaceScale,
		variant.depth * topSurfaceScale
	);

	const group = new THREE.Group();
	group.name = variant.name;

	const bodyMesh = new THREE.Mesh(bodyGeometry, createSlotMaterial('tile-body-shell'));
	bodyMesh.name = 'tileBodyShell';
	bodyMesh.position.set(0, variant.height / 2, 0);

	const shoulderGeometry = createShoulderGeometry(variant);
	const shoulderMesh = shoulderGeometry
		? new THREE.Mesh(shoulderGeometry, createSlotMaterial('tile-top-shoulder'))
		: null;

	if (shoulderMesh) {
		shoulderMesh.name = 'tileTopShoulder';
		shoulderMesh.position.set(0, variant.height - ((variant.shoulderDepth ?? 0) / 2), 0);
	}

	const topMesh = new THREE.Mesh(topGeometry, createSlotMaterial('tile-top-surface'));
	topMesh.name = 'tileTopSurface';
	topMesh.rotation.x = -Math.PI / 2;
	topMesh.position.set(0, variant.height - topSurfaceInsetDepth + TOP_SURFACE_LIFT, 0);

	group.add(bodyMesh);
	if (shoulderMesh) {
		group.add(shoulderMesh);
	}
	group.add(topMesh);
	group.updateMatrixWorld(true);

	return group;
}

async function buildReliefPocAsset(variant) {
	const bodyVariant = TILE_VARIANTS.find((entry) => entry.key === variant.bodyVariantKey);

	if (!bodyVariant) {
		throw new Error(`Unknown body variant key "${variant.bodyVariantKey}" for relief asset.`);
	}

	const topMapDir = path.resolve(TOP_MAPS_DIR, variant.faceKey);
	const [maskImageData, reliefImageData] = await Promise.all([
		loadImageData(path.resolve(topMapDir, 'top-mask.png')),
		loadImageData(path.resolve(topMapDir, 'top-relief.png')),
	]);

	if (
		maskImageData.width !== reliefImageData.width
		|| maskImageData.height !== reliefImageData.height
	) {
		throw new Error(`Top-map dimensions do not match for ${variant.faceKey}.`);
	}

	const reliefBodyVariant = {
		...bodyVariant,
		topOpeningScale: variant.topOpeningScaleOverride
			?? bodyVariant.topOpeningScale
			?? bodyVariant.topSurfaceScale
			?? TOP_SURFACE_SCALE,
		topSurfaceScale: variant.topSurfaceScaleOverride
			?? bodyVariant.topSurfaceScale
			?? TOP_SURFACE_SCALE,
		topSurfaceInsetDepth: variant.topInsetDepthOverride
			?? bodyVariant.topSurfaceInsetDepth
			?? 0,
	};

	const topScale = reliefBodyVariant.topSurfaceScale ?? TOP_SURFACE_SCALE;
	const topInsetDepth = reliefBodyVariant.topSurfaceInsetDepth ?? 0;
	const reliefGeometry = createReliefTopGeometry({
		width: reliefBodyVariant.width * topScale,
		depth: reliefBodyVariant.depth * topScale,
		cornerRadius: reliefBodyVariant.radius,
		baseY: reliefBodyVariant.height / 2,
		maskImageData,
		reliefImageData,
		floorDepth: variant.floorDepth,
		wallDepth: variant.wallDepth,
		shoulderDepth: variant.shoulderDepth,
		minMask: variant.minMask,
		wallWidthPx: variant.wallWidthPx,
		shoulderWidthPx: variant.shoulderWidthPx,
		floorInsetPx: variant.floorInsetPx,
		maxSearchRadiusPx: variant.maxSearchRadiusPx,
	});

	const sideGeometry = createPerimeterWallGeometryFromTop(reliefGeometry, -reliefBodyVariant.height / 2);
	const bottomGeometry = createBottomFaceGeometry(reliefBodyVariant);
	const group = new THREE.Group();
	group.name = variant.name;

	const sideMesh = new THREE.Mesh(sideGeometry, createSlotMaterial('tile-relief-side-walls'));
	sideMesh.name = 'tileReliefSideWalls';

	const bottomMesh = new THREE.Mesh(bottomGeometry, createSlotMaterial('tile-relief-bottom'));
	bottomMesh.name = 'tileReliefBottom';

	const topMesh = new THREE.Mesh(reliefGeometry, createSlotMaterial('tile-top-relief-surface'));
	topMesh.name = 'tileTopReliefSurface';

	group.add(sideMesh);
	group.add(bottomMesh);
	group.add(topMesh);
	group.updateMatrixWorld(true);

	return {
		group,
		metadata: {
			faceKey: variant.faceKey,
			bodyVariantKey: variant.bodyVariantKey,
			topMapDir,
			maskPath: path.resolve(topMapDir, 'top-mask.png'),
			reliefPath: path.resolve(topMapDir, 'top-relief.png'),
			outputGlb: path.resolve(OUTPUT_DIR, variant.filename),
			width: reliefBodyVariant.width * topScale,
			depth: reliefBodyVariant.depth * topScale,
			topOpeningScale: reliefBodyVariant.topOpeningScale,
			topSurfaceScale: reliefBodyVariant.topSurfaceScale,
			topInsetDepth,
			useSolidBody: Boolean(variant.useSolidBody),
			maskWidth: maskImageData.width,
			maskHeight: maskImageData.height,
			floorDepth: variant.floorDepth,
			wallDepth: variant.wallDepth,
			shoulderDepth: variant.shoulderDepth,
			minMask: variant.minMask,
			wallWidthPx: variant.wallWidthPx,
			shoulderWidthPx: variant.shoulderWidthPx,
			floorInsetPx: variant.floorInsetPx,
			maxSearchRadiusPx: variant.maxSearchRadiusPx,
			meshName: 'tileReliefSideWalls/tileReliefBottom/tileTopReliefSurface',
		},
	};
}

function buildBooleanExperimentAsset(variant) {
	const group = new THREE.Group();
	group.name = variant.name;

	const bodyGeometry = createSolidBodyGeometry(variant);
	const bodyMesh = new THREE.Mesh(bodyGeometry, createSlotMaterial('tile-boolean-target'));
	bodyMesh.name = variant.meshName;
	bodyMesh.position.set(0, variant.height / 2, 0);

	group.add(bodyMesh);
	group.updateMatrixWorld(true);

	return {
		group,
		metadata: {
			key: variant.key,
			meshName: variant.meshName,
			width: variant.width,
			height: variant.height,
			depth: variant.depth,
			radius: variant.radius,
			segments: variant.segments,
			outputGlb: path.resolve(OUTPUT_DIR, variant.filename),
			purpose: 'Simple watertight boolean-carve target with a flat top and rounded outer corners.',
		},
	};
}

async function loadImageData(imagePath) {
	const image = await loadImage(imagePath);
	const canvas = createCanvas(image.width, image.height);
	const context = canvas.getContext('2d');
	context.drawImage(image, 0, 0);

	return context.getImageData(0, 0, image.width, image.height);
}

function createReliefTopGeometry({
	width,
	depth,
	cornerRadius,
	baseY = 0,
	maskImageData,
	reliefImageData,
	floorDepth,
	wallDepth,
	shoulderDepth,
	minMask,
	wallWidthPx,
	shoulderWidthPx,
	floorInsetPx,
	maxSearchRadiusPx,
}) {
	const segmentsX = Math.max(2, (maskImageData.width - 1) * RELIEF_SUBDIVISION_MULTIPLIER);
	const segmentsY = Math.max(2, (maskImageData.height - 1) * RELIEF_SUBDIVISION_MULTIPLIER);
	const geometry = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsY);
	geometry.rotateX(-Math.PI / 2);
	const alphaGrid = buildAlphaGrid(maskImageData);

	const positions = geometry.attributes.position;
	const uvs = geometry.attributes.uv;
	let maxDisplacement = 0;

	for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex += 1) {
		const uvX = uvs.getX(vertexIndex);
		const uvY = uvs.getY(vertexIndex);
		const mask = sampleImageChannelBilinear(maskImageData, uvX, uvY);
		const relief = sampleImageChannelBilinear(reliefImageData, uvX, uvY);
		const sampleX = clamp(uvX, 0, 1) * (maskImageData.width - 1);
		const sampleY = clamp(1 - uvY, 0, 1) * (maskImageData.height - 1);
		const smoothProfile = buildSmoothInsetProfile({
			alphaGrid,
			x: sampleX,
			y: sampleY,
			mask,
			relief,
			minMask,
			wallWidthPx,
			shoulderWidthPx,
			floorInsetPx,
			maxSearchRadiusPx,
		});
		const displacement = (smoothProfile.floor * floorDepth)
			+ (smoothProfile.wall * wallDepth)
			+ (smoothProfile.shoulder * shoulderDepth);
		const safeDisplacement = Number.isFinite(displacement) ? displacement : 0;
		const projectedPosition = projectPointToRoundedRect(
			positions.getX(vertexIndex),
			positions.getZ(vertexIndex),
			width,
			depth,
			cornerRadius
		);

		positions.setX(vertexIndex, projectedPosition.x);
		positions.setY(vertexIndex, baseY - safeDisplacement);
		positions.setZ(vertexIndex, projectedPosition.z);
		maxDisplacement = Math.max(maxDisplacement, safeDisplacement);
	}

	positions.needsUpdate = true;
	geometry.computeVertexNormals();
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	geometry.userData.maxDisplacement = maxDisplacement;
	geometry.userData.gridSegmentsX = segmentsX;
	geometry.userData.gridSegmentsY = segmentsY;

	return geometry;
}

function createPerimeterWallGeometryFromTop(topGeometry, bottomY) {
	const outlinePoints = extractTopBoundaryLoop(topGeometry);
	const positions = [];
	const normals = [];
	const uvs = [];

	for (let index = 0; index < outlinePoints.length; index += 1) {
		const current = outlinePoints[index];
		const next = outlinePoints[(index + 1) % outlinePoints.length];
		const edgeX = next.x - current.x;
		const edgeZ = next.z - current.z;
		const edgeLength = Math.hypot(edgeX, edgeZ) || 1;
		const normalX = -edgeZ / edgeLength;
		const normalZ = edgeX / edgeLength;

		pushWallTriangle(
			positions,
			normals,
			uvs,
			current.x,
			current.y,
			current.z,
			next.x,
			next.y,
			next.z,
			current.x,
			bottomY,
			current.z,
			normalX,
			normalZ
		);
		pushWallTriangle(
			positions,
			normals,
			uvs,
			current.x,
			bottomY,
			current.z,
			next.x,
			next.y,
			next.z,
			next.x,
			bottomY,
			next.z,
			normalX,
			normalZ
		);
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	return geometry;
}

function extractTopBoundaryLoop(topGeometry) {
	const segmentsX = topGeometry.userData.gridSegmentsX;
	const segmentsY = topGeometry.userData.gridSegmentsY;
	const positions = topGeometry.attributes.position;
	const rowWidth = segmentsX + 1;
	const boundaryIndices = [];

	for (let ix = 0; ix <= segmentsX; ix += 1) {
		boundaryIndices.push(ix);
	}
	for (let iy = 1; iy <= segmentsY; iy += 1) {
		boundaryIndices.push((iy * rowWidth) + segmentsX);
	}
	for (let ix = segmentsX - 1; ix >= 0; ix -= 1) {
		boundaryIndices.push((segmentsY * rowWidth) + ix);
	}
	for (let iy = segmentsY - 1; iy >= 1; iy -= 1) {
		boundaryIndices.push(iy * rowWidth);
	}

	return boundaryIndices.map((vertexIndex) => ({
		x: positions.getX(vertexIndex),
		y: positions.getY(vertexIndex),
		z: positions.getZ(vertexIndex),
	}));
}

function pushWallTriangle(
	positions,
	normals,
	uvs,
	ax,
	ay,
	az,
	bx,
	by,
	bz,
	cx,
	cy,
	cz,
	normalX,
	normalZ
) {
	positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
	normals.push(
		normalX, 0, normalZ,
		normalX, 0, normalZ,
		normalX, 0, normalZ
	);
	uvs.push(0, 0, 0, 0, 0, 0);
}

function createBottomFaceGeometry(variant) {
	const outerShape = createRoundedRectShape(variant.width, variant.depth, variant.radius);
	const geometry = new THREE.ShapeGeometry(outerShape, Math.max(8, variant.segments * 2));
	geometry.rotateX(-Math.PI / 2);
	geometry.translate(0, -variant.height / 2, 0);
	assignConstantUv(geometry);
	geometry.computeVertexNormals();
	return geometry.index ? geometry.toNonIndexed() : geometry;
}

function assignConstantUv(geometry, u = 0, v = 0) {
	const positions = geometry.attributes.position;
	const uvValues = new Float32Array(positions.count * 2);
	for (let index = 0; index < positions.count; index += 1) {
		uvValues[(index * 2)] = u;
		uvValues[(index * 2) + 1] = v;
	}
	geometry.setAttribute('uv', new THREE.BufferAttribute(uvValues, 2));
}

function projectPointToRoundedRect(x, z, width, depth, radius) {
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	const safeRadius = clamp(radius, 0.001, Math.min(halfWidth, halfDepth));
	const straightHalfWidth = Math.max(0, halfWidth - safeRadius);
	const straightHalfDepth = Math.max(0, halfDepth - safeRadius);
	const absX = Math.abs(x);
	const absZ = Math.abs(z);

	if (absX <= straightHalfWidth || absZ <= straightHalfDepth) {
		return {
			x: clamp(x, -halfWidth, halfWidth),
			z: clamp(z, -halfDepth, halfDepth),
		};
	}

	const centerX = Math.sign(x || 1) * straightHalfWidth;
	const centerZ = Math.sign(z || 1) * straightHalfDepth;
	const offsetX = x - centerX;
	const offsetZ = z - centerZ;
	const offsetLength = Math.hypot(offsetX, offsetZ);

	if (offsetLength <= safeRadius || offsetLength === 0) {
		return { x, z };
	}

	const scale = safeRadius / offsetLength;
	return {
		x: centerX + (offsetX * scale),
		z: centerZ + (offsetZ * scale),
	};
}

function buildAlphaGrid(imageData) {
	const alphaGrid = [];

	for (let y = 0; y < imageData.height; y += 1) {
		const row = [];
		for (let x = 0; x < imageData.width; x += 1) {
			const index = ((y * imageData.width) + x) * 4;
			row.push(imageData.data[index] / 255);
		}
		alphaGrid.push(row);
	}

	return alphaGrid;
}

function buildSmoothInsetProfile({
	alphaGrid,
	x,
	y,
	mask,
	relief,
	minMask,
	wallWidthPx,
	shoulderWidthPx,
	floorInsetPx,
	maxSearchRadiusPx,
}) {
	if (mask <= minMask) {
		return { floor: 0, wall: 0, shoulder: 0 };
	}

	const distanceToEdge = distanceToTransparentAlpha(alphaGrid, x, y, maxSearchRadiusPx);
	const edgeBlend = smoothstep(minMask, Math.min(1, minMask + 0.2), mask);
	const wall = (1 - smoothstep(wallWidthPx - 0.55, wallWidthPx + 1.1, distanceToEdge)) * edgeBlend;
	const shoulder = smoothstep(wallWidthPx - 0.35, wallWidthPx + 0.9, distanceToEdge)
		* (1 - smoothstep(shoulderWidthPx - 0.9, shoulderWidthPx + 1.1, distanceToEdge))
		* edgeBlend;
	const floor = smoothstep(floorInsetPx - 1.2, floorInsetPx + 1.2, distanceToEdge) * edgeBlend;
	const reliefBias = THREE.MathUtils.lerp(0.82, 1.0, relief);

	return {
		floor: sanitizeUnitInterval(floor * reliefBias),
		wall: sanitizeUnitInterval(wall),
		shoulder: sanitizeUnitInterval(shoulder),
	};
}

function sampleImageChannelBilinear(imageData, uvX, uvY) {
	const sampleX = clamp(uvX, 0, 1) * (imageData.width - 1);
	const sampleY = clamp(1 - uvY, 0, 1) * (imageData.height - 1);
	const x0 = Math.floor(sampleX);
	const y0 = Math.floor(sampleY);
	const x1 = Math.min(x0 + 1, imageData.width - 1);
	const y1 = Math.min(y0 + 1, imageData.height - 1);
	const tx = sampleX - x0;
	const ty = sampleY - y0;

	const topLeft = readImageChannel(imageData, x0, y0);
	const topRight = readImageChannel(imageData, x1, y0);
	const bottomLeft = readImageChannel(imageData, x0, y1);
	const bottomRight = readImageChannel(imageData, x1, y1);
	const top = THREE.MathUtils.lerp(topLeft, topRight, tx);
	const bottom = THREE.MathUtils.lerp(bottomLeft, bottomRight, tx);

	return THREE.MathUtils.lerp(top, bottom, ty);
}

function readImageChannel(imageData, x, y) {
	const index = ((y * imageData.width) + x) * 4;
	return imageData.data[index] / 255;
}

function distanceToTransparentAlpha(alphaGrid, x, y, radius) {
	const integerRadius = Math.max(1, Math.ceil(radius));
	let closestDistance = integerRadius + 1;

	for (let offsetY = -integerRadius; offsetY <= integerRadius; offsetY += 1) {
		for (let offsetX = -integerRadius; offsetX <= integerRadius; offsetX += 1) {
			const sampleX = x + offsetX;
			const sampleY = y + offsetY;
			if (sampleAlphaGridBilinear(alphaGrid, sampleX, sampleY) > 0.01) {
				continue;
			}

			const distance = Math.hypot(offsetX, offsetY);
			if (distance < closestDistance) {
				closestDistance = distance;
			}
		}
	}

	return closestDistance;
}

function getAlpha(alphaGrid, x, y) {
	if (y < 0 || y >= alphaGrid.length) {
		return 0;
	}

	const row = alphaGrid[y];
	if (x < 0 || x >= row.length) {
		return 0;
	}

	return row[x];
}

function sampleAlphaGridBilinear(alphaGrid, x, y) {
	const width = alphaGrid[0]?.length ?? 0;
	const height = alphaGrid.length;
	if (width === 0 || height === 0) {
		return 0;
	}

	const sampleX = clamp(x, 0, width - 1);
	const sampleY = clamp(y, 0, height - 1);
	const x0 = Math.floor(sampleX);
	const y0 = Math.floor(sampleY);
	const x1 = Math.min(x0 + 1, width - 1);
	const y1 = Math.min(y0 + 1, height - 1);
	const tx = sampleX - x0;
	const ty = sampleY - y0;
	const top = THREE.MathUtils.lerp(getAlpha(alphaGrid, x0, y0), getAlpha(alphaGrid, x1, y0), tx);
	const bottom = THREE.MathUtils.lerp(getAlpha(alphaGrid, x0, y1), getAlpha(alphaGrid, x1, y1), tx);

	return THREE.MathUtils.lerp(top, bottom, ty);
}

function smoothstep(edge0, edge1, value) {
	if (edge0 === edge1) {
		return value < edge0 ? 0 : 1;
	}

	const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - (2 * t));
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function sanitizeUnitInterval(value) {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return clamp(value, 0, 1);
}

async function exportSceneAsGlb(group, sceneName, filename) {
	const scene = new THREE.Scene();
	scene.name = sceneName;
	scene.add(group);

	const glb = await exporter.parseAsync(scene, { binary: true });
	const outputPath = path.resolve(OUTPUT_DIR, filename);
	fs.writeFileSync(outputPath, Buffer.from(glb));
	console.log(`Exported ${filename}`);
}

function writeReliefMetadata(variant, metadata) {
	writeJsonMetadata(variant.metadataFilename, metadata);
}

function writeJsonMetadata(filename, metadata) {
	const outputPath = path.resolve(OUTPUT_DIR, filename);
	fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
	console.log(`Wrote ${filename}`);
}

function createSlotMaterial(name) {
	const material = new THREE.MeshStandardMaterial({
		color: '#f2f4f7',
		roughness: 0.5,
		metalness: 0,
	});
	material.name = name;
	return material;
}

function createCaplessShellGeometry(variant) {
	const outerShape = createRoundedRectShape(variant.width, variant.depth, variant.radius);
	const topOpeningScale = variant.topOpeningScale ?? variant.topSurfaceScale ?? TOP_SURFACE_SCALE;
	const innerWidth = variant.width * topOpeningScale;
	const innerDepth = variant.depth * topOpeningScale;
	const innerRadius = Math.max(0.001, variant.radius - SHELL_WALL_THICKNESS);
	const innerShape = createRoundedRectShape(innerWidth, innerDepth, innerRadius);
	outerShape.holes.push(innerShape);

	const ringGeometry = new THREE.ExtrudeGeometry(outerShape, {
		depth: variant.height,
		bevelEnabled: false,
		curveSegments: Math.max(8, variant.segments * 2),
		steps: 1,
	});
	ringGeometry.rotateX(-Math.PI / 2);
	ringGeometry.translate(0, -variant.height / 2, 0);

	const bottomGeometry = new THREE.ShapeGeometry(outerShape, Math.max(8, variant.segments * 2));
	bottomGeometry.rotateX(-Math.PI / 2);
	bottomGeometry.translate(0, -variant.height / 2, 0);

	const normalizedRingGeometry = ringGeometry.index ? ringGeometry.toNonIndexed() : ringGeometry;
	const normalizedBottomGeometry = bottomGeometry.index ? bottomGeometry.toNonIndexed() : bottomGeometry;

	const mergedGeometry = BufferGeometryUtils.mergeGeometries(
		[normalizedRingGeometry, normalizedBottomGeometry],
		true
	);
	mergedGeometry.computeVertexNormals();

	ringGeometry.dispose();
	bottomGeometry.dispose();
	if (normalizedRingGeometry !== ringGeometry) {
		normalizedRingGeometry.dispose();
	}
	if (normalizedBottomGeometry !== bottomGeometry) {
		normalizedBottomGeometry.dispose();
	}

	return mergedGeometry;
}

function createSolidBodyGeometry(variant) {
	const outerShape = createRoundedRectShape(variant.width, variant.depth, variant.radius);
	const geometry = new THREE.ExtrudeGeometry(outerShape, {
		depth: variant.height,
		bevelEnabled: false,
		curveSegments: Math.max(8, variant.segments * 2),
		steps: 1,
	});
	geometry.rotateX(-Math.PI / 2);
	geometry.translate(0, -variant.height / 2, 0);
	geometry.computeVertexNormals();
	return geometry;
}

function createShoulderGeometry(variant) {
	const topOpeningScale = variant.topOpeningScale;
	const faceFloorScale = variant.faceFloorScale;
	const shoulderDepth = variant.shoulderDepth ?? 0;

	if (!topOpeningScale || !faceFloorScale || shoulderDepth <= 0) {
		return null;
	}

	const outerShape = createRoundedRectShape(
		variant.width * topOpeningScale,
		variant.depth * topOpeningScale,
		Math.max(0.001, variant.radius - SHELL_WALL_THICKNESS)
	);
	const innerShape = createRoundedRectShape(
		variant.width * faceFloorScale,
		variant.depth * faceFloorScale,
		Math.max(0.001, variant.radius - (SHELL_WALL_THICKNESS * 1.35))
	);
	outerShape.holes.push(innerShape);

	const geometry = new THREE.ExtrudeGeometry(outerShape, {
		depth: shoulderDepth,
		bevelEnabled: false,
		curveSegments: Math.max(8, variant.segments * 2),
		steps: 1,
	});
	geometry.rotateX(-Math.PI / 2);
	geometry.translate(0, -shoulderDepth / 2, 0);
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

function disposeTileAsset(group) {
	group.traverse((object) => {
		if (!object.isMesh) {
			return;
		}

		object.geometry?.dispose();
		const materials = Array.isArray(object.material) ? object.material : [object.material];
		materials.forEach((material) => material.dispose());
	});
}

