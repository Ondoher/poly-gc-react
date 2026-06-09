import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { parse as parseSvgAst } from 'svg-parser';
import { ROOT_DIR } from '../shared/asset-paths.js';
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

if (typeof globalThis.DOMParser === 'undefined') {
	globalThis.DOMParser = class {
		parseFromString(source) {
			const ast = parseSvgAst(source);
			const svgRoot = ast.children.find((node) => node.type === 'element');
			const idMap = new Map();
			const document = {
				documentElement: null,
				getElementById(id) {
					return idMap.get(id) ?? null;
				},
			};
			const documentElement = wrapSvgAstNode(svgRoot, document, idMap);
			document.documentElement = documentElement;
			assignViewportElement(documentElement, document);
			return document;
		}
	};
}

const gltfLoader = new GLTFLoader();
const svgLoader = new SVGLoader();
const exporter = new GLTFExporter();
const INLAY = Object.freeze({
	meshNamePrefix: 'tileFaceInlay',
	thickness: 0.0014,
	floorLift: 0.0015,
	surfaceInset: 0.008,
	layerStep: 0.00008,
	curveSegments: 10,
});

await main();

async function main() {
	const options = readOptions();
	const model = new PipelineModel({
		referenceName: options.referenceName,
		tileSetName: options.tilesetId,
	});
	await model.start();

	const variant = buildInlayVariant({ model, options });
	const faceHash = model.hashAssetPipelineFaceInput(options.faceKey);
	const stageHash = model.hashAssetGenerationStageInput(options.faceKey, 'colored-inlay');
	fs.mkdirSync(path.dirname(variant.outputGlb), { recursive: true });
	fs.mkdirSync(path.dirname(variant.outputMetadata), { recursive: true });

	const inlayAsset = await buildInlayAsset(variant);
	await exportSceneAsGlb(inlayAsset.group, variant.name, variant.outputGlb);
	writeJsonMetadata(variant.outputMetadata, inlayAsset.metadata);
	disposeGroup(inlayAsset.group);

	model.updateAssetGenerationFace(options.faceKey, {
		status: null,
		inputHash: faceHash,
		stageHashes: {
			'colored-inlay': stageHash,
		},
		artifacts: {
			inlayModel: relativePath(variant.outputGlb),
			inlayMetadata: relativePath(variant.outputMetadata),
		},
		queue: null,
		build: null,
		failure: null,
	});
	await model.save();
}

function buildInlayVariant({ model, options }) {
	const assetPipeline = model.getAssetPipeline();
	const faceState = assetPipeline.faces?.[options.faceKey];
	const renderedSvg = resolveRepoPath(model.getFinalRenderingColorSvgPath(options.faceKey) || '');
	const stampedModel = resolveRepoPath(faceState?.artifacts?.stampedModel || '');
	const stampedMetadata = resolveRepoPath(faceState?.artifacts?.stampedMetadata || '');
	const cutterMetadata = resolveRepoPath(faceState?.artifacts?.cutterMetadata || '');
	const modelFaceKey = `${options.tilesetId}-${options.faceKey}`;
	const outputGlb = resolveRepoPath(options.outputGlb || path.join(model.pipelineDir, 'models', 'colored-inlay', `${options.faceKey}.glb`));
	const outputMetadata = resolveRepoPath(options.outputMetadata || path.join(model.pipelineDir, 'json', 'colored-inlay', `${options.faceKey}.json`));

	if (!renderedSvg) {
		throw new Error(`Missing rendered SVG artifact for ${options.tilesetId}/${options.faceKey}.`);
	}
	if (!stampedModel) {
		throw new Error(`Missing stamped body model artifact for ${options.tilesetId}/${options.faceKey}.`);
	}
	if (!stampedMetadata) {
		throw new Error(`Missing stamped body metadata artifact for ${options.tilesetId}/${options.faceKey}.`);
	}
	if (!cutterMetadata) {
		throw new Error(`Missing cutter metadata artifact for ${options.tilesetId}/${options.faceKey}.`);
	}

	return Object.freeze({
		faceKey: options.faceKey,
		tilesetId: options.tilesetId,
		modelFaceKey,
		name: `MahjongTileColoredInlay${pascal(modelFaceKey)}`,
		renderedSvg,
		stampedModel,
		stampedMetadata,
		cutterMetadata,
		outputGlb,
		outputMetadata,
	});
}

async function buildInlayAsset(variant) {
	const stampedMetadata = readJson(variant.stampedMetadata);
	const cutterMetadata = readJson(variant.cutterMetadata);
	const stampedScene = await loadGlbScene(variant.stampedModel);
	const tileMesh = findFirstMeshByName(stampedScene, stampedMetadata.meshName);

	if (!tileMesh) {
		throw new Error(`Could not find stamped tile mesh "${stampedMetadata.meshName}" in ${variant.stampedModel}.`);
	}

	stampedScene.updateMatrixWorld(true);
	const tileClone = cloneMeshForExport(tileMesh, stampedMetadata.meshName || 'stampedTileBody');
	const outputGroup = new THREE.Group();
	outputGroup.name = variant.name;
	outputGroup.add(tileClone);

	const svgSource = fs.readFileSync(variant.renderedSvg, 'utf8');
	const inlayBuild = buildSvgInlayMeshes({
		svgSource,
		cutterMetadata,
		stampedMetadata,
	});

	for (const mesh of inlayBuild.meshes) {
		outputGroup.add(mesh);
	}

	outputGroup.updateMatrixWorld(true);
	disposeGroup(stampedScene);

	return {
		group: outputGroup,
		metadata: {
			faceKey: variant.faceKey,
			tilesetId: variant.tilesetId,
			modelFaceKey: variant.modelFaceKey,
			mode: inlayBuild.meshes.length > 0 ? 'colored-inlay' : 'no-inlay',
			outputGlb: relativePath(variant.outputGlb),
			sceneName: outputGroup.name,
			sourceStampedGlb: relativePath(variant.stampedModel),
			sourceStampedMetadata: relativePath(variant.stampedMetadata),
			sourceCutterMetadata: relativePath(variant.cutterMetadata),
			sourceSvg: relativePath(variant.renderedSvg),
			tileMeshName: stampedMetadata.meshName,
			inlayMeshNamePrefix: INLAY.meshNamePrefix,
			inlayThickness: INLAY.thickness,
			inlayFloorLift: INLAY.floorLift,
			inlaySurfaceInset: INLAY.surfaceInset,
			inlayLayerStep: INLAY.layerStep,
			recessFloorY: inlayBuild.recessFloorY,
			inlayBaseY: inlayBuild.inlayBaseY,
			targetRect: inlayBuild.targetRect,
			sourceGlyphBounds: inlayBuild.sourceGlyphBounds,
			meshCount: inlayBuild.meshes.length,
			colors: inlayBuild.colors,
			notes: [
				inlayBuild.meshes.length > 0
					? 'Colored inlay model includes the stamped tile body plus SVG-derived colored inlay meshes.'
					: 'Rendered SVG contains no colored inlay geometry; output model is the stamped tile body only.',
				cutterMetadata.sourcePlacementMode === 'viewBox'
					? 'Inlay placement uses the same rendered-SVG viewBox-to-full-face rectangle normalization as cutter generation.'
					: 'Inlay placement uses the same glyph-bounds-to-target-rectangle normalization as cutter generation.',
			],
		},
	};
}

function buildSvgInlayMeshes({ svgSource, cutterMetadata, stampedMetadata }) {
	const svgData = svgLoader.parse(svgSource);
	const rawPathGeometries = [];
	const colorCounts = {};
	const targetRect = stampedMetadata.appliedPlacement?.targetRect
		?? cutterMetadata.targetRect
		?? createFullTileTargetRect(stampedMetadata);
	const recessFloorY = getRecessFloorY(stampedMetadata, cutterMetadata);
	const inlayBaseY = getInlayBaseY(stampedMetadata, recessFloorY);

	for (const [sourceIndex, svgPath] of svgData.paths.entries()) {
		const color = getInlayColorForSvgPath(svgPath);

		if (!color) {
			continue;
		}

		const pathGeometry = buildPathGeometry(svgPath);

		if (!pathGeometry) {
			continue;
		}

		const colorIndex = colorCounts[color] ?? 0;
		colorCounts[color] = colorIndex + 1;
		rawPathGeometries.push({
			color,
			colorIndex,
			sourceIndex,
			geometry: pathGeometry,
		});
	}

	if (rawPathGeometries.length === 0) {
		return {
			meshes: [],
			recessFloorY,
			targetRect,
			sourceGlyphBounds: null,
			colors: [],
		};
	}

	const boundsGeometry = BufferGeometryUtils.mergeGeometries(
		rawPathGeometries.map(({ geometry }) => geometry.clone()),
		false
	);
	const sourceGlyphBounds = cutterMetadata.sourcePlacementMode === 'viewBox'
		? createGlyphBoundsFromViewBox(parseViewBox(svgSource))
		: measureGlyphBounds(boundsGeometry);
	boundsGeometry.dispose();

	const scaleX = targetRect.width / Math.max(sourceGlyphBounds.width, 0.000001);
	const scaleZ = targetRect.depth / Math.max(sourceGlyphBounds.depth, 0.000001);
	const meshes = [];

	for (const { color, sourceIndex, colorIndex, geometry } of rawPathGeometries) {
		geometry.translate(-sourceGlyphBounds.centerX, 0, -sourceGlyphBounds.centerZ);
		geometry.scale(scaleX, 1, scaleZ);
		geometry.translate(
			targetRect.centerX,
			inlayBaseY + (sourceIndex * INLAY.layerStep),
			targetRect.centerZ
		);
		assignFlatTopNormals(geometry);
		geometry.computeBoundingBox();
		geometry.computeBoundingSphere();

		const material = new THREE.MeshStandardMaterial({
			color,
			roughness: 0.82,
			metalness: 0,
			side: THREE.DoubleSide,
		});
		material.name = `${INLAY.meshNamePrefix}-${color.slice(1)}`;

		const mesh = new THREE.Mesh(geometry, material);
		mesh.name = `${INLAY.meshNamePrefix}-${String(sourceIndex).padStart(3, '0')}-${color.slice(1)}-${colorIndex}`;
		mesh.castShadow = false;
		mesh.receiveShadow = true;
		meshes.push(mesh);
	}

	return {
		meshes,
		recessFloorY,
		inlayBaseY,
		targetRect,
		sourceGlyphBounds,
		colors: Object.keys(colorCounts).sort((left, right) => left.localeCompare(right)),
	};
}

function getInlayBaseY(stampedMetadata, recessFloorY) {
	const topSurfaceY = stampedMetadata.topSurfaceY ?? (stampedMetadata.height / 2);
	const nearSurfaceBaseY = topSurfaceY - INLAY.thickness - INLAY.surfaceInset;
	const floorBaseY = recessFloorY + INLAY.floorLift;
	return Math.max(floorBaseY, nearSurfaceBaseY);
}

function getInlayColorForSvgPath(svgPath) {
	if (!svgPath.color) {
		return null;
	}

	const color = `#${svgPath.color.getHexString()}`.toLowerCase();
	if (isBodyLikeColor(color)) {
		return null;
	}
	return color;
}

function isBodyLikeColor(color) {
	return color === '#ffffff'
		|| color === '#fff'
		|| color === '#f2ece2'
		|| color === '#f6f6f6';
}

function getRecessFloorY(stampedMetadata, cutterMetadata) {
	if (cutterMetadata.empty || stampedMetadata.mode === 'blank-body') {
		return stampedMetadata.topSurfaceY ?? (stampedMetadata.height / 2);
	}

	const topY = stampedMetadata.topSurfaceY ?? (stampedMetadata.height / 2);
	const depthScale = stampedMetadata.appliedPlacement?.depthScale ?? 1;
	const cutterDepth = cutterMetadata.cutterDepth ?? stampedMetadata.cutter?.cutterDepth ?? 0;
	return topY - (cutterDepth * depthScale);
}

function createFullTileTargetRect(stampedMetadata) {
	return {
		width: stampedMetadata.width ?? 0.79,
		depth: stampedMetadata.depth ?? 1.08,
		centerX: 0,
		centerZ: 0,
	};
}

function assignFlatTopNormals(geometry) {
	const positions = geometry.attributes.position;
	const normalValues = new Float32Array(positions.count * 3);

	for (let index = 0; index < positions.count; index += 1) {
		normalValues[(index * 3)] = 0;
		normalValues[(index * 3) + 1] = 1;
		normalValues[(index * 3) + 2] = 0;
	}

	geometry.setAttribute('normal', new THREE.BufferAttribute(normalValues, 3));
}

function buildPathGeometry(svgPath) {
	const geometries = [];

	const shapes = SVGLoader.createShapes(svgPath);
	for (const shape of shapes) {
		const geometry = new THREE.ExtrudeGeometry(shape, {
			depth: INLAY.thickness,
			bevelEnabled: false,
			curveSegments: INLAY.curveSegments,
			steps: 1,
		});
		geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
	}

	if (geometries.length === 0) {
		return null;
	}

	const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);
	geometries.forEach((geometry) => geometry.dispose());

	mergedGeometry.rotateX(Math.PI / 2);
	return mergedGeometry;
}

function parseViewBox(svgSource) {
	const viewBoxMatch = svgSource.match(/viewBox=(["'])(.*?)\1/);
	const rawViewBox = viewBoxMatch?.[2] ?? '0 0 94 136';
	const [minX, minY, width, height] = rawViewBox.split(/\s+/).map((value) => Number.parseFloat(value));

	return {
		minX,
		minY,
		width,
		height,
	};
}

function createGlyphBoundsFromViewBox(viewBox) {
	return {
		width: viewBox.width,
		depth: viewBox.height,
		centerX: viewBox.minX + (viewBox.width / 2),
		centerZ: viewBox.minY + (viewBox.height / 2),
	};
}

function measureGlyphBounds(geometry) {
	geometry.computeBoundingBox();
	const bounds = geometry.boundingBox?.clone();

	if (!bounds) {
		throw new Error('Inlay geometry is missing a bounding box.');
	}

	const size = new THREE.Vector3();
	const center = new THREE.Vector3();
	bounds.getSize(size);
	bounds.getCenter(center);

	return {
		width: size.x,
		depth: size.z,
		centerX: center.x,
		centerZ: center.z,
	};
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
	const gltf = await gltfLoader.parseAsync(arrayBuffer, `${path.dirname(glbPath)}${path.sep}`);
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

function readOptions() {
	const tilesetId = readArgument('--tileset-id') || process.env.PIPELINE_TILESET_ID;
	const faceKey = readArgument('--face-key') || readPositionalArguments()[0];
	const referenceName = readArgument('--reference-name') || 'default-large-faces';
	const outputGlb = readArgument('--output-glb') || '';
	const outputMetadata = readArgument('--output-metadata') || '';

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
		outputGlb,
		outputMetadata,
	};
}

function readArgument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : null;
}

function readPositionalArguments() {
	const positional = [];
	const optionsWithValues = new Set([
		'--tileset-id',
		'--face-key',
		'--reference-name',
		'--output-glb',
		'--output-metadata',
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

function wrapSvgAstNode(node, document, idMap) {
	const properties = node?.properties ?? {};
	const domNode = {
		nodeType: 1,
		nodeName: node.tagName,
		childNodes: [],
		style: parseInlineStyle(properties.style),
		viewportElement: null,
		getAttribute(name) {
			const value = readSvgProperty(properties, name);
			return value == null ? null : String(value);
		},
		getAttributeNS(namespace, name) {
			if (namespace === 'http://www.w3.org/1999/xlink') {
				const xlinkValue = readSvgProperty(properties, `xlink:${name}`) ?? readSvgProperty(properties, `xlink${capitalize(name)}`);
				return xlinkValue == null ? null : String(xlinkValue);
			}

			const value = readSvgProperty(properties, name);
			return value == null ? null : String(value);
		},
		hasAttribute(name) {
			return readSvgProperty(properties, name) != null;
		},
	};

	if (properties.id) {
		idMap.set(String(properties.id), domNode);
	}

	const children = Array.isArray(node.children) ? node.children : [];
	domNode.childNodes = children
		.filter((child) => child?.type === 'element')
		.filter((child) => !shouldSkipSvgLoaderNode(child))
		.map((child) => wrapSvgAstNode(child, document, idMap));

	return domNode;
}

function shouldSkipSvgLoaderNode(node) {
	const properties = node?.properties ?? {};
	const display = readSvgProperty(properties, 'display');
	const renderLayer = readSvgProperty(properties, 'data-render-layer');
	const renderAlternate = readSvgProperty(properties, 'data-render-alternate');
	const style = parseInlineStyle(readSvgProperty(properties, 'style'));

	return String(display ?? '').toLowerCase() === 'none'
		|| String(style.display ?? '').toLowerCase() === 'none'
		|| String(renderLayer ?? '').startsWith('alternate')
		|| renderAlternate != null;
}

function assignViewportElement(node, document) {
	node.viewportElement = document;
	for (const child of node.childNodes) {
		assignViewportElement(child, document);
	}
}

function parseInlineStyle(styleText) {
	const styleValues = !styleText
		? {}
		: String(styleText)
			.split(';')
			.map((entry) => entry.trim())
			.filter(Boolean)
			.reduce((result, entry) => {
				const [rawKey, rawValue] = entry.split(':');
				if (!rawKey || !rawValue) {
					return result;
				}

				result[rawKey.trim()] = rawValue.trim();
				return result;
			}, {});

	return new Proxy(styleValues, {
		get(target, property) {
			if (typeof property !== 'string') {
				return target[property];
			}

			return property in target ? target[property] : '';
		},
	});
}

function readSvgProperty(properties, name) {
	if (Object.hasOwn(properties, name)) {
		return properties[name];
	}

	const camelCaseName = name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
	if (Object.hasOwn(properties, camelCaseName)) {
		return properties[camelCaseName];
	}

	return null;
}

function capitalize(value) {
	return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function disposeGroup(group) {
	group.traverse((object) => {
		if (!object.isMesh) {
			return;
		}

		object.geometry?.dispose?.();
		const materials = Array.isArray(object.material) ? object.material : [object.material];
		materials.forEach((material) => material?.dispose?.());
	});
}
