import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, ADDITION } from 'three-bvh-csg/src/index.js';
import { parse as parseSvgAst } from 'svg-parser';
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

const exporter = new GLTFExporter();
const svgLoader = new SVGLoader();

await main();

async function main() {
	const options = readOptions();
	const model = new PipelineModel({
		referenceName: options.referenceName,
		tileSetName: options.tilesetId,
	});
	await model.start();

	const variant = buildCutterVariant({ model, options });
	const faceHash = model.hashAssetPipelineFaceInput(options.faceKey);
	const stageHash = model.hashAssetGenerationStageInput(options.faceKey, 'svg-cutter');
	fs.mkdirSync(path.dirname(variant.outputGlb), { recursive: true });
	fs.mkdirSync(path.dirname(variant.outputMetadata), { recursive: true });

	const cutterAsset = await buildSvgCutterAsset(variant);
	if (cutterAsset.group) {
		await exportSceneAsGlb(cutterAsset.group, variant.name, variant.outputGlb);
	}
	writeJsonMetadata(variant.outputMetadata, cutterAsset.metadata);
	if (cutterAsset.group) {
		disposeTileAsset(cutterAsset.group);
	}

	model.updateAssetGenerationFace(options.faceKey, {
		status: null,
		inputHash: faceHash,
		stageHashes: {
			'svg-cutter': stageHash,
		},
		artifacts: {
			...(cutterAsset.group ? { cutterModel: relativePath(variant.outputGlb) } : {}),
			cutterMetadata: relativePath(variant.outputMetadata),
		},
		queue: null,
		build: null,
		failure: null,
	});
	await model.save();
}

function buildCutterVariant({ model, options }) {
	const renderedSvg = resolveRepoPath(model.getFinalRenderingColorSvgPath(options.faceKey) || '');
	const baseTileVariantId = model.getSelectedBaseTileVariantId();
	const selectedBaseTileVariantId = baseTileVariantId || options.baseTileVariantId;
	const baseTileVariant = readBaseTileVariant(selectedBaseTileVariantId);
	const body = baseTileVariant.body || {};
	const modelFaceKey = `${options.tilesetId}-${options.faceKey}`;
	const outputGlb = path.join(model.pipelineDir, 'models', 'svg-cutter', `${options.faceKey}.glb`);
	const outputMetadata = path.join(model.pipelineDir, 'json', 'svg-cutter', `${options.faceKey}.json`);

	if (!renderedSvg) {
		throw new Error(`Missing rendered SVG artifact for ${options.tilesetId}/${options.faceKey}.`);
	}

	return Object.freeze({
		faceKey: options.faceKey,
		tilesetId: options.tilesetId,
		modelFaceKey,
		name: `MahjongTileCutter${pascal(modelFaceKey)}`,
		meshName: 'tileFaceCutter',
		svgPath: renderedSvg,
		sourcePlacementMode: 'viewBox',
		targetWidth: Number.isFinite(body.width) ? body.width : 0.79,
		targetDepth: Number.isFinite(body.depth) ? body.depth : 1.08,
		cutterDepth: Number.isFinite(options.cutterDepth) ? options.cutterDepth : 0.026,
		curveSegments: Number.isFinite(options.curveSegments) ? options.curveSegments : 10,
		baseTileVariantId: selectedBaseTileVariantId,
		baseTileVariant,
		outputGlb,
		outputMetadata,
	});
}

async function buildSvgCutterAsset(variant) {
	if (!fs.existsSync(variant.svgPath)) {
		throw new Error(`Missing SVG source: ${variant.svgPath}`);
	}

	const sanitizedSvg = sanitizeSvgForCutter(fs.readFileSync(variant.svgPath, 'utf8'));
	const svgData = svgLoader.parse(sanitizedSvg);
	const viewBox = parseViewBox(sanitizedSvg);
	const geometries = [];

	for (const svgPath of svgData.paths) {
		if (isTileBodyColorPath(svgPath)) {
			continue;
		}

		const shapes = SVGLoader.createShapes(svgPath);
		for (const shape of shapes) {
			const geometry = new THREE.ExtrudeGeometry(shape, {
				depth: 1,
				bevelEnabled: false,
				curveSegments: variant.curveSegments,
				steps: 1,
			});
			geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
		}
	}

	if (geometries.length === 0) {
		return {
			group: null,
			metadata: emptyCutterMetadata({
				variant,
				viewBox,
				reason: 'Rendered SVG contains no cutter geometry.',
			}),
		};
	}

	// Map SVG x/y into tile x/z and make the extrusion go downward into -y.
	const boundsGeometry = BufferGeometryUtils.mergeGeometries(
		geometries.map((geometry) => {
			const clone = geometry.clone();
			clone.rotateX(Math.PI / 2);
			return clone;
		}),
		false
	);
	const glyphBounds = variant.sourcePlacementMode === 'viewBox'
		? createGlyphBoundsFromViewBox(viewBox)
		: measureGlyphBounds(boundsGeometry);
	boundsGeometry.dispose();
	const targetRect = variant.sourcePlacementMode === 'viewBox'
		? createFullFaceTargetRect(variant.targetWidth, variant.targetDepth)
		: createFullFaceTargetRect(variant.targetWidth, variant.targetDepth);
	const scaleX = targetRect.width / Math.max(glyphBounds.width, 0.000001);
	const scaleZ = targetRect.depth / Math.max(glyphBounds.depth, 0.000001);

	const normalizedGeometries = geometries.map((geometry) => {
		const normalizedGeometry = geometry.clone();
		normalizedGeometry.rotateX(Math.PI / 2);
		normalizedGeometry.translate(-glyphBounds.centerX, 0, -glyphBounds.centerZ);
		normalizedGeometry.scale(scaleX, variant.cutterDepth, scaleZ);
		normalizedGeometry.translate(targetRect.centerX, 0, targetRect.centerZ);
		normalizedGeometry.computeVertexNormals();
		return normalizedGeometry;
	});
	geometries.forEach((geometry) => geometry.dispose());

	const cutterGeometry = buildUnionedCutterGeometry(normalizedGeometries);
	normalizedGeometries.forEach((geometry) => geometry.dispose());
	assignProjectedTopUv(cutterGeometry, variant.targetWidth, variant.targetDepth);
	cutterGeometry.computeVertexNormals();

	const group = new THREE.Group();
	group.name = variant.name;

	const cutterMesh = new THREE.Mesh(cutterGeometry, createSlotMaterial('tile-face-cutter'));
	cutterMesh.name = variant.meshName;
	group.add(cutterMesh);
	group.updateMatrixWorld(true);

	return {
		group,
		metadata: {
			faceKey: variant.faceKey,
			tilesetId: variant.tilesetId,
			modelFaceKey: variant.modelFaceKey,
			meshName: variant.meshName,
			svgPath: relativePath(variant.svgPath),
			sourcePlacementMode: variant.sourcePlacementMode,
			baseTileVariantId: variant.baseTileVariantId,
			baseTileVariant: {
				id: variant.baseTileVariant.id,
				label: variant.baseTileVariant.label,
				glb: variant.baseTileVariant.glb,
				metadata: variant.baseTileVariant.metadata,
				body: variant.baseTileVariant.body,
			},
			targetWidth: variant.targetWidth,
			targetDepth: variant.targetDepth,
			cutterDepth: variant.cutterDepth,
			sourceViewBox: viewBox,
			sourceGlyphBounds: glyphBounds,
			targetRect,
			outputGlb: relativePath(variant.outputGlb),
			placementContract: {
				topSurfacePlaneY: 0,
				extrusionDirection: '-Y',
				centeredOnTile: false,
			},
			notes: [
				'SVG glyph paths only; tile-body/background layers removed.',
				variant.sourcePlacementMode === 'viewBox'
					? 'Geometry is normalized from the preprocessed SVG viewBox into the full tile face rectangle so preprocessed internal alignment is preserved.'
					: 'Geometry is normalized from glyph bounds into the authored face-content rectangle from face metadata.',
				'Normalized path solids are unioned before export so downstream subtraction sees one cleaned cutter volume.',
				'Designed as an offline boolean/CSG cutter input, not as a runtime visible asset.',
			],
		},
	};
}

function emptyCutterMetadata({ variant, viewBox, reason }) {
	return {
		faceKey: variant.faceKey,
		tilesetId: variant.tilesetId,
		modelFaceKey: variant.modelFaceKey,
		meshName: null,
		empty: true,
		reason,
		svgPath: relativePath(variant.svgPath),
		sourcePlacementMode: variant.sourcePlacementMode,
		baseTileVariantId: variant.baseTileVariantId,
		baseTileVariant: {
			id: variant.baseTileVariant.id,
			label: variant.baseTileVariant.label,
			glb: variant.baseTileVariant.glb,
			metadata: variant.baseTileVariant.metadata,
			body: variant.baseTileVariant.body,
		},
		targetWidth: variant.targetWidth,
		targetDepth: variant.targetDepth,
		cutterDepth: variant.cutterDepth,
		sourceViewBox: viewBox,
		sourceGlyphBounds: null,
		targetRect: createFullFaceTargetRect(variant.targetWidth, variant.targetDepth),
		outputGlb: null,
		placementContract: {
			topSurfacePlaneY: 0,
			extrusionDirection: '-Y',
			centeredOnTile: false,
		},
		notes: [
			'Rendered SVG contains no visible cutter geometry; this face intentionally produces no cutter GLB.',
			'Downstream stamped-body generation should treat this as an uncarved/blank face for the selected tile body.',
		],
	};
}

function buildUnionedCutterGeometry(geometries) {
	if (geometries.length === 1) {
		return geometries[0].clone();
	}

	const evaluator = new Evaluator();
	evaluator.useGroups = false;
	evaluator.consolidateGroups = true;
	evaluator.removeUnusedMaterials = true;

	let unionBrush = new Brush(geometries[0].clone(), createSlotMaterial('tile-face-cutter-union'));
	unionBrush.updateMatrixWorld(true);

	for (let index = 1; index < geometries.length; index += 1) {
		const nextBrush = new Brush(geometries[index].clone(), createSlotMaterial('tile-face-cutter-union'));
		nextBrush.updateMatrixWorld(true);

		const resultBrush = evaluator.evaluate(unionBrush, nextBrush, ADDITION);
		resultBrush.updateMatrixWorld(true);
		disposeMesh(unionBrush);
		disposeMesh(nextBrush);
		unionBrush = resultBrush;
	}

	const unionGeometry = unionBrush.geometry.clone();
	unionGeometry.computeBoundingBox();
	unionGeometry.computeBoundingSphere();
	disposeMesh(unionBrush);

	return unionGeometry.index ? unionGeometry.toNonIndexed() : unionGeometry;
}

function sanitizeSvgForCutter(svgSource) {
	const viewBoxMatch = svgSource.match(/viewBox=(["'])(.*?)\1/);
	const viewBox = viewBoxMatch?.[2] ?? '-192 293.9 210 255';

	return svgSource.replace(/<svg\b(?![^>]*\bviewBox=)/i, `<svg viewBox="${viewBox}"`);
}

function isTileBodyColorPath(svgPath) {
	const color = svgPath.color ? `#${svgPath.color.getHexString()}`.toLowerCase() : null;
	return color === '#ffffff' || color === '#fff';
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

function parseViewBox(svgSource) {
	const viewBoxMatch = svgSource.match(/viewBox=(["'])(.*?)\1/);
	const rawViewBox = viewBoxMatch?.[2] ?? '-192 293.9 210 255';
	const [minX, minY, width, height] = rawViewBox.split(/\s+/).map((value) => Number.parseFloat(value));

	return {
		minX,
		minY,
		width,
		height,
	};
}

function measureGlyphBounds(geometry) {
	geometry.computeBoundingBox();
	const bounds = geometry.boundingBox?.clone();

	if (!bounds) {
		throw new Error('Merged cutter geometry is missing a bounding box.');
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

function createGlyphBoundsFromViewBox(viewBox) {
	return {
		width: viewBox.width,
		depth: viewBox.height,
		centerX: viewBox.minX + (viewBox.width / 2),
		centerZ: viewBox.minY + (viewBox.height / 2),
	};
}

function createFullFaceTargetRect(targetWidth, targetDepth) {
	return {
		width: targetWidth,
		depth: targetDepth,
		centerX: 0,
		centerZ: 0,
	};
}

async function exportSceneAsGlb(group, sceneName, outputPath) {
	const scene = new THREE.Scene();
	scene.name = sceneName;
	scene.add(group);

	const glb = await exporter.parseAsync(scene, { binary: true });
	fs.writeFileSync(outputPath, Buffer.from(glb));
	console.log(`Exported ${relativePath(outputPath)}`);
}

function writeJsonMetadata(outputPath, metadata) {
	fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
	console.log(`Wrote ${relativePath(outputPath)}`);
}

function pascal(value) {
	return value
		.split(/[^a-zA-Z0-9]+/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join('');
}

function createSlotMaterial(name) {
	const material = new THREE.MeshStandardMaterial({
		color: '#111111',
		roughness: 0.5,
		metalness: 0,
	});
	material.name = name;
	return material;
}

function assignProjectedTopUv(geometry, width, depth) {
	const positions = geometry.attributes.position;
	const uvValues = new Float32Array(positions.count * 2);

	for (let index = 0; index < positions.count; index += 1) {
		const x = positions.getX(index);
		const z = positions.getZ(index);
		uvValues[(index * 2)] = (x / width) + 0.5;
		uvValues[(index * 2) + 1] = (z / depth) + 0.5;
	}

	geometry.setAttribute('uv', new THREE.BufferAttribute(uvValues, 2));
}

function disposeTileAsset(group) {
	group.traverse((object) => {
		if (!object.isMesh) {
			return;
		}

		disposeMesh(object);
	});
}

function disposeMesh(mesh) {
	mesh.geometry?.dispose?.();
	const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
	materials.forEach((material) => material?.dispose?.());
}

function readOptions() {
	const tilesetId = readArgument('--tileset-id') || process.env.PIPELINE_TILESET_ID;
	const faceKey = readArgument('--face-key') || readPositionalArguments()[0];
	const referenceName = readArgument('--reference-name') || 'default-large-faces';
	const cutterDepth = numberArgument('--cutter-depth');
	const curveSegments = numberArgument('--curve-segments');
	const baseTileVariantId = readArgument('--base-tile-variant-id') || '';

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
		cutterDepth,
		curveSegments,
		baseTileVariantId,
	};
}

function readBaseTileVariant(variantId) {
	if (!variantId) {
		throw new Error('Missing selected base tile variant in assetPipeline.baseTileSelection.');
	}

	const manifestPath = path.join(BASE_TILE_MODELS_DIR, 'base-tile-manifest.json');
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	const manifestVariant = (manifest.variants || []).find((variant) => variant.id === variantId);

	if (!manifestVariant) {
		throw new Error(`Unknown base tile variant: ${variantId}.`);
	}

	const metadataPath = resolveRepoPath(manifestVariant.metadata || '');
	const metadata = metadataPath && fs.existsSync(metadataPath)
		? JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
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
		'--cutter-depth',
		'--curve-segments',
		'--base-tile-variant-id',
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

function resolveRepoPath(filename) {
	return filename ? path.resolve(ROOT_DIR, filename) : '';
}

function relativePath(filename) {
	return path.relative(ROOT_DIR, filename).replaceAll('\\', '/');
}

