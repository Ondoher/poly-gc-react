import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
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

if (typeof globalThis.document === 'undefined') {
	globalThis.document = {
		createElement(tagName) {
			if (tagName !== 'canvas') {
				throw new Error(`Unsupported document.createElement("${tagName}") in Node export shim.`);
			}

			return createCanvas(1, 1);
		},
	};
}

if (typeof globalThis.HTMLCanvasElement === 'undefined') {
	globalThis.HTMLCanvasElement = createCanvas(1, 1).constructor;
}

if (typeof globalThis.OffscreenCanvas === 'undefined') {
	globalThis.OffscreenCanvas = globalThis.HTMLCanvasElement;
}

if (typeof globalThis.HTMLCanvasElement?.prototype?.convertToBlob !== 'function') {
	globalThis.HTMLCanvasElement.prototype.convertToBlob = function convertToBlob(options = {}) {
		const mimeType = options.type || 'image/png';
		const buffer = this.toBuffer(mimeType);
		return Promise.resolve(new Blob([buffer], { type: mimeType }));
	};
}

const OUTPUT_DIR = OUTPUT_MODELS_DIR;
const TOP_MAP_DIR = path.resolve(GENERATED_TOP_MAPS_DIR, 'flower-1');
const exporter = new GLTFExporter();

const TILE = Object.freeze({
	width: 0.79,
	height: 0.5,
	depth: 1.08,
	radius: 0.08,
	segments: 8,
	bodyColor: '#f2ece2',
	topColorPath: path.resolve(TOP_MAP_DIR, 'top-color.png'),
	maskPath: path.resolve(TOP_MAP_DIR, 'top-mask.png'),
	reliefPath: path.resolve(TOP_MAP_DIR, 'top-relief.png'),
	filename: 'mj-tile-presentation-flower-1.glb',
	metadataFilename: 'mj-tile-presentation-flower-1.json',
	name: 'MahjongTilePresentationFlower1',
	meshNames: {
		body: 'tilePresentationBody',
		top: 'tilePresentationTop',
	},
	floorDepth: 0.02,
	wallDepth: 0.012,
	shoulderDepth: 0.005,
	minMask: 0.02,
	wallWidthPx: 1.8,
	shoulderWidthPx: 4.5,
	floorInsetPx: 4.2,
	maxSearchRadiusPx: 10,
});

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const asset = await buildPresentationAsset();
await exportSceneAsGlb(asset.group, TILE.name, TILE.filename);
fs.writeFileSync(
	path.resolve(OUTPUT_DIR, TILE.metadataFilename),
	JSON.stringify(asset.metadata, null, 2)
);
disposeGroup(asset.group);

async function buildPresentationAsset() {
	const [maskImageData, reliefImageData, topTexture] = await Promise.all([
		loadImageData(TILE.maskPath),
		loadImageData(TILE.reliefPath),
		loadCanvasTexture(TILE.topColorPath),
	]);

	const topGeometry = createReliefTopGeometry({
		width: TILE.width,
		depth: TILE.depth,
		cornerRadius: TILE.radius,
		baseY: TILE.height / 2,
		maskImageData,
		reliefImageData,
		floorDepth: TILE.floorDepth,
		wallDepth: TILE.wallDepth,
		shoulderDepth: TILE.shoulderDepth,
		minMask: TILE.minMask,
		wallWidthPx: TILE.wallWidthPx,
		shoulderWidthPx: TILE.shoulderWidthPx,
		floorInsetPx: TILE.floorInsetPx,
		maxSearchRadiusPx: TILE.maxSearchRadiusPx,
	});
	const bodyMaterial = new THREE.MeshStandardMaterial({
		color: TILE.bodyColor,
		roughness: 0.7,
		metalness: 0.02,
	});
	bodyMaterial.name = 'tilePresentationBody';
	const topMaterial = new THREE.MeshStandardMaterial({
		color: '#ffffff',
		map: topTexture,
		roughness: 0.62,
		metalness: 0.01,
	});
	topMaterial.name = 'tilePresentationTop';

	const bodyGeometry = createSolidBodyGeometry(TILE);
	const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
	bodyMesh.name = TILE.meshNames.body;
	const topMesh = new THREE.Mesh(topGeometry, topMaterial);
	topMesh.name = TILE.meshNames.top;

	const group = new THREE.Group();
	group.name = TILE.name;
	group.add(bodyMesh, topMesh);
	group.updateMatrixWorld(true);

	return {
		group,
		metadata: {
			outputGlb: path.resolve(OUTPUT_DIR, TILE.filename),
			width: TILE.width,
			height: TILE.height,
			depth: TILE.depth,
			radius: TILE.radius,
			topColorPath: TILE.topColorPath,
			maskPath: TILE.maskPath,
			reliefPath: TILE.reliefPath,
			meshNames: TILE.meshNames,
			notes: [
				'Presentation asset: same solid body baseline as the boolean experiment body, plus a carved top mesh.',
				'The body geometry matches the boolean experiment target so silhouette and body shadow can be compared directly.',
				'The top relief geometry is baked from top-mask/top-relief at export time.',
				'The top color map is embedded into the GLB so the POC can render this asset directly without material overrides.',
			],
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

async function loadCanvasTexture(imagePath) {
	const image = await loadImage(imagePath);
	const canvas = createCanvas(image.width, image.height);
	const context = canvas.getContext('2d');
	context.drawImage(image, 0, 0);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.flipY = false;
	texture.wrapS = THREE.RepeatWrapping;
	texture.repeat.x = -1;
	texture.offset.x = 1;
	texture.needsUpdate = true;
	return texture;
}

function createReliefTopGeometry({
	width,
	depth,
	cornerRadius,
	baseY,
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
	const segmentsX = Math.max(2, (maskImageData.width - 1) * 2);
	const segmentsY = Math.max(2, (maskImageData.height - 1) * 2);
	const geometry = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsY);
	geometry.rotateX(-Math.PI / 2);
	const alphaGrid = buildAlphaGrid(maskImageData);
	const positions = geometry.attributes.position;
	const uvs = geometry.attributes.uv;

	for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex += 1) {
		const uvX = 1 - uvs.getX(vertexIndex);
		const uvY = 1 - uvs.getY(vertexIndex);
		const mask = sampleImageChannelBilinear(maskImageData, uvX, uvY);
		const relief = sampleImageChannelBilinear(reliefImageData, uvX, uvY);
		const sampleX = clamp(uvX, 0, 1) * (maskImageData.width - 1);
		const sampleY = clamp(1 - uvY, 0, 1) * (maskImageData.height - 1);
		const profile = buildSmoothInsetProfile({
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
		const displacement = (profile.floor * floorDepth)
			+ (profile.wall * wallDepth)
			+ (profile.shoulder * shoulderDepth);
		const projectedPosition = projectPointToRoundedRect(
			positions.getX(vertexIndex),
			positions.getZ(vertexIndex),
			width,
			depth,
			cornerRadius
		);

		positions.setX(vertexIndex, projectedPosition.x);
		positions.setY(vertexIndex, baseY - displacement);
		positions.setZ(vertexIndex, projectedPosition.z);
	}

	positions.needsUpdate = true;
	geometry.computeVertexNormals();
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	geometry.userData.gridSegmentsX = segmentsX;
	geometry.userData.gridSegmentsY = segmentsY;
	return geometry;
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

function projectPointToRoundedRect(x, z, width, depth, radius) {
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	const safeRadius = clamp(radius, 0.001, Math.min(halfWidth, halfDepth));
	const straightHalfWidth = Math.max(0, halfWidth - safeRadius);
	const straightHalfDepth = Math.max(0, halfDepth - safeRadius);
	const absX = Math.abs(x);
	const absZ = Math.abs(z);

	if (absX <= straightHalfWidth || absZ <= straightHalfDepth) {
		return { x: clamp(x, -halfWidth, halfWidth), z: clamp(z, -halfDepth, halfDepth) };
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
	const top = THREE.MathUtils.lerp(readImageChannel(imageData, x0, y0), readImageChannel(imageData, x1, y0), tx);
	const bottom = THREE.MathUtils.lerp(readImageChannel(imageData, x0, y1), readImageChannel(imageData, x1, y1), tx);
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
	fs.writeFileSync(path.resolve(OUTPUT_DIR, filename), Buffer.from(glb));
	console.log(`Exported ${filename}`);
}

function disposeGroup(group) {
	group.traverse((object) => {
		if (!object.isMesh) {
			return;
		}
		object.geometry?.dispose();
		const materials = Array.isArray(object.material) ? object.material : [object.material];
		materials.forEach((material) => {
			material.map?.dispose?.();
			material.dispose?.();
		});
	});
}

