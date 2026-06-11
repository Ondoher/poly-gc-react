import fs from 'fs';
import path from 'path';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
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
const CUTTER_ACTIVITY_PING_MS = 5000;
const CUTTER_UNION_TIMEOUT_MS = 30000;
let cutterActivity = null;

if (isMainThread) {
	await main();
} else {
	runCutterWorker();
}

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

	if (!options.noPipelineState) {
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
}

function buildCutterVariant({ model, options }) {
	const renderedSvg = resolveRepoPath(options.svgPath || model.getFinalRenderingColorSvgPath(options.faceKey) || '');
	const baseTileVariantId = model.getSelectedBaseTileVariantId();
	const selectedBaseTileVariantId = baseTileVariantId || options.baseTileVariantId;
	const baseTileVariant = readBaseTileVariant(selectedBaseTileVariantId);
	const body = baseTileVariant.body || {};
	const modelFaceKey = `${options.tilesetId}-${options.faceKey}`;
	const outputGlb = resolveRepoPath(options.outputGlb || path.join(model.pipelineDir, 'models', 'svg-cutter', `${options.faceKey}.glb`));
	const outputMetadata = resolveRepoPath(options.outputMetadata || path.join(model.pipelineDir, 'json', 'svg-cutter', `${options.faceKey}.json`));

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
		skipUnion: Boolean(options.skipUnion),
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
	emitCutterProgress({
		phase: 'parse',
		current: 0,
		total: 1,
		message: `Parsing SVG for ${variant.faceKey}`,
	});
	const svgData = svgLoader.parse(sanitizedSvg);
	const viewBox = parseViewBox(sanitizedSvg);
	const geometries = [];
	emitCutterProgress({
		phase: 'parse',
		current: 1,
		total: 1,
		message: `Parsed ${svgData.paths.length} SVG paths for ${variant.faceKey}`,
	});

	for (let pathIndex = 0; pathIndex < svgData.paths.length; pathIndex += 1) {
		const svgPath = svgData.paths[pathIndex];
		if (isTileBodyColorPath(svgPath)) {
			emitCutterProgress({
				phase: 'extrude',
				current: pathIndex + 1,
				total: svgData.paths.length,
				message: `Skipped tile-body path ${pathIndex + 1} of ${svgData.paths.length}`,
			});
			continue;
		}

		const shapes = SVGLoader.createShapes(svgPath);
		withCutterActivityPing({
			phase: 'extrude',
			current: pathIndex + 1,
			total: svgData.paths.length,
			message: `Extruding SVG path ${pathIndex + 1} of ${svgData.paths.length}`,
			activity: 'processing-solid',
		}, () => {
			for (const shape of shapes) {
				const geometry = new THREE.ExtrudeGeometry(shape, {
					depth: 1,
					bevelEnabled: false,
					curveSegments: variant.curveSegments,
					steps: 1,
				});
				geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
			}
		});
		emitCutterProgress({
			phase: 'extrude',
			current: pathIndex + 1,
			total: svgData.paths.length,
			message: `Extruded SVG path ${pathIndex + 1} of ${svgData.paths.length}`,
		});
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

	const normalizedGeometries = geometries.map((geometry, geometryIndex) => {
		const normalizedGeometry = withCutterActivityPing({
			phase: 'normalize',
			current: geometryIndex + 1,
			total: geometries.length,
			message: `Normalizing cutter solid ${geometryIndex + 1} of ${geometries.length}`,
			activity: 'processing-solid',
		}, () => {
			const nextGeometry = geometry.clone();
			nextGeometry.rotateX(Math.PI / 2);
			nextGeometry.translate(-glyphBounds.centerX, 0, -glyphBounds.centerZ);
			nextGeometry.scale(scaleX, variant.cutterDepth, scaleZ);
			nextGeometry.translate(targetRect.centerX, 0, targetRect.centerZ);
			nextGeometry.computeVertexNormals();
			return nextGeometry;
		});
		emitCutterProgress({
			phase: 'normalize',
			current: geometryIndex + 1,
			total: geometries.length,
			message: `Normalized cutter solid ${geometryIndex + 1} of ${geometries.length}`,
		});
		return normalizedGeometry;
	});
	geometries.forEach((geometry) => geometry.dispose());

	const cutterGeometry = variant.skipUnion
		? buildMergedCutterGeometry(normalizedGeometries)
		: await buildUnionedCutterGeometry(normalizedGeometries);
	normalizedGeometries.forEach((geometry) => geometry.dispose());
	assignProjectedTopUv(cutterGeometry, variant.targetWidth, variant.targetDepth);
	cutterGeometry.computeVertexNormals();

	const group = new THREE.Group();
	group.name = variant.name;

	const cutterMesh = new THREE.Mesh(cutterGeometry, createSlotMaterial('tile-face-cutter'));
	cutterMesh.name = variant.meshName;
	group.add(cutterMesh);
	group.updateMatrixWorld(true);
	emitCutterProgress({
		phase: 'export',
		current: 0,
		total: 1,
		message: `Exporting cutter GLB for ${variant.faceKey}`,
	});

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
			skipUnion: variant.skipUnion,
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
				variant.skipUnion
					? 'Normalized path solids are merged without 3D boolean union because upstream SVG geometry is expected to be pre-unioned into non-overlapping cutter islands.'
					: 'Normalized path solids are unioned before export so downstream subtraction sees one cleaned cutter volume.',
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
		skipUnion: variant.skipUnion,
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

function buildMergedCutterGeometry(geometries) {
	emitCutterProgress({
		phase: 'union',
		current: 1,
		total: 1,
		message: `Skipped 3D union; merging ${geometries.length} pre-unioned cutter solids`,
	});

	const mergedGeometry = BufferGeometryUtils.mergeGeometries(
		geometries.map((geometry) => geometry.index ? geometry.toNonIndexed() : geometry.clone()),
		false
	);
	mergedGeometry.computeBoundingBox();
	mergedGeometry.computeBoundingSphere();

	return mergedGeometry.index ? mergedGeometry.toNonIndexed() : mergedGeometry;
}

async function buildUnionedCutterGeometry(geometries) {
	if (geometries.length === 1) {
		emitCutterProgress({
			phase: 'union',
			current: 1,
			total: 1,
			message: 'Single cutter solid needs no union',
		});
		return geometries[0].clone();
	}

	const progress = {
		phase: 'union',
		current: 1,
		total: geometries.length - 1,
		message: `Unioning cutter solid 2 of ${geometries.length}`,
		activity: 'processing-solid',
	};
	startCutterActivityPing(progress);
	try {
		return await runUnionWorker(geometries, progress);
	} catch (error) {
		if (error?.code !== 'CUTTER_UNION_TIMEOUT') {
			throw error;
		}
		emitCutterProgress({
			phase: 'union',
			current: geometries.length,
			total: geometries.length,
			message: `3D union timed out after ${Math.round(CUTTER_UNION_TIMEOUT_MS / 1000)}s; merging ${geometries.length} cutter solids`,
		});
		return buildMergedCutterGeometry(geometries);
	} finally {
		stopCutterActivityPing();
	}
}

function runUnionedCutterGeometryInWorker(geometries) {
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
		parentPort?.postMessage({
			type: 'progress',
			current: index,
			total: geometries.length - 1,
			message: `Unioned cutter solid ${index + 1} of ${geometries.length}`,
		});
	}

	const unionGeometry = unionBrush.geometry.clone();
	unionGeometry.computeBoundingBox();
	unionGeometry.computeBoundingSphere();
	disposeMesh(unionBrush);

	return unionGeometry.index ? unionGeometry.toNonIndexed() : unionGeometry;
}

function runUnionWorker(geometries, progress) {
	return new Promise((resolve, reject) => {
		let settled = false;
		let timeoutId = null;
		const worker = new Worker(new URL(import.meta.url), {
			workerData: {
				job: 'union-geometries',
				geometries: geometries.map((geometry) => serializeGeometry(geometry)),
			},
		});
		const settle = (callback) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeoutId);
			callback();
		};
		timeoutId = setTimeout(() => {
			settle(() => {
				const error = new Error(`Cutter union timed out after ${CUTTER_UNION_TIMEOUT_MS}ms.`);
				error.code = 'CUTTER_UNION_TIMEOUT';
				worker.terminate().catch(() => {});
				reject(error);
			});
		}, CUTTER_UNION_TIMEOUT_MS);
		timeoutId.unref?.();

		worker.on('message', (message) => {
			if (message?.type === 'progress') {
				progress.current = message.current;
				progress.total = message.total;
				progress.message = message.message;
				emitCutterProgress({
					phase: 'union',
					current: message.current,
					total: message.total,
					message: message.message,
					activity: 'processing-solid',
					active: true,
				});
				return;
			}

			if (message?.type === 'result') {
				settle(() => resolve(deserializeGeometry(message.geometry)));
				return;
			}

			if (message?.type === 'error') {
				settle(() => reject(new Error(message.message || 'Cutter union worker failed.')));
			}
		});

		worker.on('error', (error) => {
			settle(() => reject(error));
		});

		worker.on('exit', (code) => {
			if (settled) {
				return;
			}
			if (code === 0) {
				settle(() => reject(new Error('Cutter union worker exited without returning geometry.')));
			} else {
				settle(() => reject(new Error(`Cutter union worker exited with code ${code}.`)));
			}
		});
	});
}

function runCutterWorker() {
	if (workerData?.job !== 'union-geometries') {
		parentPort?.postMessage({
			type: 'error',
			message: `Unknown cutter worker job: ${workerData?.job || '(missing)'}`,
		});
		return;
	}

	const geometries = (workerData.geometries || []).map((geometry) => deserializeGeometry(geometry));
	try {
		const unionGeometry = runUnionedCutterGeometryInWorker(geometries);
		parentPort?.postMessage({
			type: 'result',
			geometry: serializeGeometry(unionGeometry),
		});
		unionGeometry.dispose();
	} catch (error) {
		parentPort?.postMessage({
			type: 'error',
			message: error?.stack || error?.message || String(error),
		});
	} finally {
		geometries.forEach((geometry) => geometry.dispose());
	}
}

function serializeGeometry(geometry) {
	const attributes = {};
	for (const [name, attribute] of Object.entries(geometry.attributes || {})) {
		if (!attribute?.array) {
			continue;
		}

		attributes[name] = {
			array: attribute.array,
			itemSize: attribute.itemSize,
			normalized: Boolean(attribute.normalized),
		};
	}

	return {
		index: geometry.index ? {
			array: geometry.index.array,
			itemSize: geometry.index.itemSize,
			normalized: Boolean(geometry.index.normalized),
		} : null,
		attributes,
	};
}

function deserializeGeometry(data) {
	const geometry = new THREE.BufferGeometry();
	if (data?.index?.array) {
		geometry.setIndex(new THREE.BufferAttribute(
			data.index.array,
			data.index.itemSize || 1,
			Boolean(data.index.normalized),
		));
	}

	for (const [name, attribute] of Object.entries(data?.attributes || {})) {
		if (!attribute?.array) {
			continue;
		}

		geometry.setAttribute(name, new THREE.BufferAttribute(
			attribute.array,
			attribute.itemSize,
			Boolean(attribute.normalized),
		));
	}

	return geometry;
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
	emitCutterProgress({
		phase: 'export',
		current: 1,
		total: 1,
		message: `Exported cutter GLB for ${sceneName}`,
	});
	console.log(`Exported ${relativePath(outputPath)}`);
}

function writeJsonMetadata(outputPath, metadata) {
	fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
	console.log(`Wrote ${relativePath(outputPath)}`);
}

function withCutterActivityPing(progress, callback) {
	startCutterActivityPing(progress);
	try {
		return callback();
	} finally {
		stopCutterActivityPing();
	}
}

function startCutterActivityPing(progress) {
	stopCutterActivityPing();
	emitCutterProgress({
		...progress,
		active: true,
		ping: true,
	});
	cutterActivity = setInterval(() => {
		emitCutterProgress({
			...progress,
			active: true,
			ping: true,
		});
	}, CUTTER_ACTIVITY_PING_MS);
	cutterActivity.unref?.();
}

function stopCutterActivityPing() {
	if (!cutterActivity) {
		return;
	}

	clearInterval(cutterActivity);
	cutterActivity = null;
}

function emitCutterProgress({ phase, current, total, message, activity = '', active = false, ping = false }) {
	const safeCurrent = Math.max(0, Number(current) || 0);
	const safeTotal = Math.max(0, Number(total) || 0);
	console.log(JSON.stringify({
		event: 'assetStageProgress',
		stage: 'svg-cutter',
		phase,
		current: safeCurrent,
		total: safeTotal,
		percent: safeTotal > 0 ? Math.round((Math.min(safeCurrent, safeTotal) / safeTotal) * 100) : 0,
		message,
		activity,
		active,
		ping,
		timestamp: new Date().toISOString(),
	}));
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
	const svgPath = readArgument('--svg-path') || '';
	const outputGlb = readArgument('--output-glb') || '';
	const outputMetadata = readArgument('--output-metadata') || '';
	const noPipelineState = process.argv.includes('--no-pipeline-state');
	const skipUnion = process.argv.includes('--skip-union');

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
		svgPath,
		outputGlb,
		outputMetadata,
		noPipelineState,
		skipUnion,
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
		'--svg-path',
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

function resolveRepoPath(filename) {
	return filename ? path.resolve(ROOT_DIR, filename) : '';
}

function relativePath(filename) {
	return path.relative(ROOT_DIR, filename).replaceAll('\\', '/');
}

