import { promises as fs } from 'fs';
import path from 'path';
import paper from 'paper';
import sharp from 'sharp';
import { OUTPUT_3D_DIR, ROOT_DIR } from '../shared/asset-paths.js';
import { getComponentUnionBounds } from './normalized-face-components.js';
import { tilesetImageDir, tilesetJsonDir, tilesetOutputRoot } from './pipeline-output-paths.js';
import { extractSourceSvgComponents } from './source-svg-components.js';

export const DEFAULT_TILESET_ID = 'wiki';
const LABEL_OCR_TEMPLATE_SIZE = 50;
const LABEL_OCR_PIXEL_MAE_THRESHOLD = 0.3;
const LABEL_OCR_MASS_CROP_TAIL_RATIO = 0.02;
const LABEL_OCR_MASS_CROP_DARKNESS_FLOOR = 0.04;
const STRUCTURAL_SOURCE_USE_IDS = new Set(['facesize', 'rect2236']);
const PAINT_LAYER_FLATTENING_MIN_VISIBLE_AREA = 0.001;
const IDENTIFIED_SVG_NAMESPACE_ATTRIBUTES = [
	'xmlns="http://www.w3.org/2000/svg"',
	'xmlns:xlink="http://www.w3.org/1999/xlink"',
	'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"',
	'xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"',
].join(' ');
const LABEL_OCR_TEMPLATE_GROUPS = {
	'1': [
		{ templateId: 'digit-1-serif', file: 'digit-1-serif.50.png' },
		{ templateId: 'digit-1-sans-baseless', file: 'digit-1-sans-baseless.50.png' },
	],
	'2': [{ templateId: 'digit-2', file: 'digit-2.50.png' }],
	'3': [{ templateId: 'digit-3', file: 'digit-3.50.png' }],
	'4': [{ templateId: 'digit-4', file: 'digit-4.50.png' }],
	'5': [{ templateId: 'digit-5', file: 'digit-5.50.png' }],
	'6': [{ templateId: 'digit-6', file: 'digit-6.50.png' }],
	'7': [{ templateId: 'digit-7', file: 'digit-7.50.png' }],
	'8': [{ templateId: 'digit-8', file: 'digit-8.50.png' }],
	'9': [{ templateId: 'digit-9', file: 'digit-9.50.png' }],
	C: [{ templateId: 'dragon-c', file: 'dragon-c.50.png' }],
	F: [{ templateId: 'dragon-f', file: 'dragon-f.50.png' }],
	P: [{ templateId: 'dragon-p', file: 'dragon-p.50.png' }],
	E: [{ templateId: 'wind-e', file: 'wind-e.50.png' }],
	N: [{ templateId: 'wind-n', file: 'wind-n.50.png' }],
	S: [{ templateId: 'wind-s', file: 'wind-s.50.png' }],
	W: [{ templateId: 'wind-w', file: 'wind-w.50.png' }],
};
const DEBUG_SHAPE_COLORS = [
	'#e6194b',
	'#3cb44b',
	'#4363d8',
	'#f58231',
	'#911eb4',
	'#46f0f0',
	'#f032e6',
	'#bcf60c',
	'#fabebe',
	'#008080',
	'#e6beff',
	'#9a6324',
];

/**
 * Runs source SVG normalization and writes the stage-owned artifacts.
 */
export class SourceNormalizationRunner {
	/**
	 * Creates a runner with replaceable filesystem and pipeline dependencies.
	 *
	 * @param {SourceNormalizationRunnerDependencies} dependencies - Dependencies used by the normalization workflow.
	 */
	constructor({
		fileSystem = fs,
		pathModule = path,
		rootDir = ROOT_DIR,
		output3dDir = OUTPUT_3D_DIR,
		extractComponents = extractSourceSvgComponents,
		clock = () => new Date().toISOString(),
	} = {}) {
		this.fs = fileSystem;
		this.path = pathModule;
		this.rootDir = rootDir;
		this.output3dDir = output3dDir;
		this.extractComponents = extractComponents;
		this.clock = clock;
		this.labelOcrTemplateCache = null;
	}

	/**
	 * Normalizes the requested source faces and returns a CLI-printable summary.
	 *
	 * @param {SourceNormalizationRunOptions} options - Normalization options resolved by the CLI or test.
	 * @returns {Promise<SourceNormalizationSummary>} Summary of written artifacts and warning counts.
	 */
	async run(options = {}) {
		const tilesetId = options.tilesetId || DEFAULT_TILESET_ID;
		const pipelineModel = options.pipelineModel;

		if (!pipelineModel) {
			throw new Error('SourceNormalizationRunner requires a PipelineModel.');
		}

		const pipelineStatePath = pipelineModel.pipelineFilename;
		const activeTilesetId = pipelineModel.getTilesetId();
		const requestedFaceKey = options.faceKey || null;
		const componentsDir = tilesetJsonDir(activeTilesetId, 'normalized-components');
		const identifiedSvgsDir = tilesetImageDir(activeTilesetId, 'identified-components-svg');
		const identifiedShapesSvgsDir = tilesetImageDir(activeTilesetId, 'identified-shapes-svg');
		const generatedOn = this.clock();
		const faceEntries = pipelineModel.getFaceEntries()
			.filter(([faceKey]) => !requestedFaceKey || faceKey === requestedFaceKey)
			.sort(([left], [right]) => left.localeCompare(right));
		const report = this.createReport({
			tilesetId: activeTilesetId,
			generatedOn,
			pipelineStatePath,
			requestedFaceKey,
			faceEntries,
		});

		await this.fs.mkdir(componentsDir, { recursive: true });
		await this.fs.mkdir(identifiedSvgsDir, { recursive: true });
		await this.fs.mkdir(identifiedShapesSvgsDir, { recursive: true });

		for (const [faceKey, faceState] of faceEntries) {
			await this.processFace({
				tilesetId: activeTilesetId,
				faceKey,
				faceState,
				generatedOn,
				componentsDir,
				identifiedSvgsDir,
				identifiedShapesSvgsDir,
				pipelineModel,
				report,
			});
		}

		const reportPath = this.path.resolve(
			tilesetOutputRoot(activeTilesetId),
			'reports',
			`source-normalization-report${requestedFaceKey ? `.${requestedFaceKey}` : ''}.json`,
		);
		await this.writeJson(reportPath, report);
		await pipelineModel.save();

		return {
			tilesetId: activeTilesetId,
			faceCount: report.faceCount,
			faceKey: requestedFaceKey,
			componentCount: report.componentCount,
			alignmentComponentCount: report.alignmentComponentCount,
			shapeCount: report.shapeCount,
			alignmentShapeCount: report.alignmentShapeCount,
			componentsDir: this.normalizePath(componentsDir),
			reportPath: this.normalizePath(reportPath),
			warningCount: report.warnings.length,
		};
	}

	/**
	 * Creates the top-level normalization report shell.
	 *
	 * @param {SourceNormalizationCreateReportOptions} options - Values that identify the normalization run.
	 * @returns {SourceNormalizationReport} Report object that accumulates per-face results.
	 */
	createReport({ tilesetId, generatedOn, pipelineStatePath, requestedFaceKey, faceEntries }) {
		return {
			schemaVersion: 1,
			tilesetId,
			generatedOn,
			pipelineState: this.normalizePath(pipelineStatePath),
			faceKey: requestedFaceKey,
			faceCount: faceEntries.length,
			componentCount: 0,
			alignmentComponentCount: 0,
			shapeCount: 0,
			alignmentShapeCount: 0,
			faces: {},
			warnings: [],
		};
	}

	/**
	 * Processes one canonical face and records its artifact or missing-source status.
	 *
	 * @param {SourceNormalizationProcessFaceOptions} options - Per-face normalization context.
	 * @returns {Promise<void>}
	 */
	async processFace({
		tilesetId,
		faceKey,
		faceState,
		generatedOn,
		componentsDir,
		identifiedSvgsDir,
		identifiedShapesSvgsDir,
		pipelineModel,
		report,
	}) {
		const sourceFile = this.resolveFaceSource(faceState);

		if (!sourceFile || !(await this.exists(sourceFile))) {
			this.recordMissingSource({
				faceKey,
				sourceFile,
				report,
			});
			return;
		}

		const svgSource = await this.fs.readFile(sourceFile, 'utf8');
		const extracted = this.extractComponents(svgSource, {
			splitCompoundPaths: true,
		});
		const sourceDefs = extractSvgDefs(svgSource);
		const artifact = this.buildNormalizedFaceArtifact({
			tilesetId,
			faceKey,
			sourceFile,
			generatedOn,
			extracted,
			faceState,
		});
		await this.annotateLabelOcrEvidence(artifact);
		const artifactPath = this.path.resolve(componentsDir, `${faceKey}.json`);
		const identifiedSvgPath = this.path.resolve(identifiedSvgsDir, `${faceKey}.svg`);
		const identifiedShapesSvgPath = this.path.resolve(identifiedShapesSvgsDir, `${faceKey}.svg`);

		artifact.identifiedComponentsSvg = this.normalizePath(identifiedSvgPath);
		artifact.identifiedShapesSvg = this.normalizePath(identifiedShapesSvgPath);
		await this.writeJson(artifactPath, artifact);
		await this.fs.writeFile(identifiedSvgPath, this.buildIdentifiedComponentsSvg(artifact, { sourceDefs }), 'utf8');
		await this.fs.writeFile(identifiedShapesSvgPath, this.buildIdentifiedShapesSvg(artifact, { sourceDefs }), 'utf8');
		pipelineModel.recordNormalizationResult(faceKey, {
			normalizedComponentsPath: artifactPath,
		});

		report.componentCount += artifact.components.length;
		report.alignmentComponentCount += artifact.alignmentComponentIds.length;
		report.shapeCount += artifact.sourceShapes.length;
		report.alignmentShapeCount += artifact.alignmentShapeIds.length;
		report.faces[faceKey] = {
			status: artifact.status,
			sourceFile: this.normalizePath(sourceFile),
			artifact: this.normalizePath(artifactPath),
			identifiedComponentsSvg: this.normalizePath(identifiedSvgPath),
			identifiedShapesSvg: this.normalizePath(identifiedShapesSvgPath),
			viewBox: artifact.viewBox,
			componentCount: artifact.components.length,
			alignmentComponentCount: artifact.alignmentComponentIds.length,
			shapeCount: artifact.sourceShapes.length,
			alignmentShapeCount: artifact.alignmentShapeIds.length,
			paintSummary: artifact.paintSummary,
			diagnostics: artifact.diagnostics,
		};
	}

	/**
	 * Records a missing source SVG in pipeline state and the run report.
	 *
	 * @param {SourceNormalizationMissingSourceOptions} options - Missing source context.
	 * @returns {void}
	 */
	recordMissingSource({ faceKey, sourceFile, report }) {
		report.warnings.push({
			code: 'missing-source-svg',
			faceKey,
			sourceFile: sourceFile ? this.normalizePath(sourceFile) : null,
		});
		report.faces[faceKey] = {
			status: 'missing-source-svg',
			sourceFile: sourceFile ? this.normalizePath(sourceFile) : null,
			componentCount: 0,
			alignmentComponentCount: 0,
			shapeCount: 0,
			alignmentShapeCount: 0,
		};
	}

	sourceMetadataForFaceState(faceState = null) {
		return faceState?.configuration?.sourceMetadata || {};
	}

	describeFace(faceKey) {
		const [prefix, rawValue] = faceKey.split('-');
		const familyByPrefix = {
			b: 'bamboo',
			c: 'character',
			d: 'dot',
			dragon: 'dragon',
			flower: 'flower',
			season: 'season',
			wind: 'wind',
		};

		return {
			faceKey,
			family: familyByPrefix[prefix] || prefix,
			value: Number.isFinite(Number.parseInt(rawValue, 10)) ? Number.parseInt(rawValue, 10) : rawValue || null,
		};
	}

	/**
	 * Builds the normalized component artifact for one extracted face.
	 *
	 * @param {SourceNormalizationArtifactOptions} options - Extracted source face data.
	 * @returns {SourceNormalizedFaceArtifact} Normalized face artifact.
	 */
	buildNormalizedFaceArtifact({ tilesetId, faceKey, sourceFile, generatedOn, extracted, faceState = null }) {
		const formattedComponents = extracted.components.map((component, index) => this.formatSourceComponent(faceKey, component, index));
		const initialSourceShapes = this.deriveSourceShapes(faceKey, formattedComponents.filter((component) => component.pathData && component.bounds));
		const components = flattenVisiblePaintLayers(annotateSourceShapeIds(formattedComponents, initialSourceShapes));
		const alignmentComponents = components
			.filter((component) => component.pathData && component.bounds)
			.filter((component) => !component.classification.tileLayerCandidate)
			.filter((component) => !component.classification.negativeSpaceCandidate)
			.filter((component) => hasVisiblePaint(component));
		const sourceShapes = this.deriveSourceShapes(faceKey, components.filter((component) => component.pathData && component.bounds));
		const alignmentComponentIds = new Set(alignmentComponents.map((component) => component.componentId));
		const alignmentShapeIds = sourceShapes
			.filter((shape) => shape.componentIds.some((componentId) => alignmentComponentIds.has(componentId)))
			.map((shape) => shape.shapeId);
		const alignmentBounds = getComponentUnionBounds(alignmentComponents);
		const diagnostics = [];

		if (alignmentComponents.length === 0) {
			diagnostics.push({
				level: 'warning',
				code: 'no-alignment-components',
				message: 'No source components remain after tile-layer and negative-space filtering.',
			});
		}

		return {
			schemaVersion: 1,
			tilesetId,
			faceKey,
			generatedOn,
			sourceFile: this.normalizePath(sourceFile),
			sourceMetadata: this.sourceMetadataForFaceState(faceState),
			viewBox: extracted.viewBox,
			status: diagnostics.some((diagnostic) => diagnostic.level === 'warning')
				? 'needs-review'
				: 'ready',
			componentCount: components.length,
			shapeCount: sourceShapes.length,
			alignmentComponentIds: [...alignmentComponentIds],
			alignmentShapeIds,
			alignmentBounds,
			identifiedComponentsSvg: null,
			identifiedShapesSvg: null,
			paintSummary: this.summarizePaint(components),
			groups: extracted.groups || [],
			diagnostics,
			sourceShapes,
			components,
		};
	}

	/**
	 * Derives source shapes: cohesive source-side visual units that downstream
	 * stages should select before expanding back to components.
	 *
	 * @param {string} faceKey - Face key that owns the shapes.
	 * @param {SourceNormalizedComponent[]} components - Normalized components.
	 * @returns {SourceShape[]} Shape records.
	 */
	deriveSourceShapes(faceKey, components) {
		const componentsById = new Map(components.map((component) => [component.componentId, component]));
		const consumedComponentIds = new Set();
		const shapeComponentGroups = [];
		const sourceUseGroups = new Map();

		for (const component of components) {
			const sourceUseInstance = sourceUseShapeInstance(component);

			if (!sourceUseInstance) {
				continue;
			}

			const group = sourceUseGroups.get(sourceUseInstance.sourceUseInstanceId) || {
				components: [],
				sourceUseId: sourceUseInstance.sourceUseId,
				sourceUseInstanceId: sourceUseInstance.sourceUseInstanceId,
			};
			group.components.push(component);
			sourceUseGroups.set(sourceUseInstance.sourceUseInstanceId, group);
		}

		for (const group of [...sourceUseGroups.values()]
			.sort((left, right) => Math.min(...left.components.map((component) => component.sourceIndex))
				- Math.min(...right.components.map((component) => component.sourceIndex)))) {
			if (group.components.length === 0 || !group.components.some(hasVisiblePaint)) {
				continue;
			}

			for (const component of group.components) {
				consumedComponentIds.add(component.componentId);
			}

			shapeComponentGroups.push({
				components: group.components.sort((left, right) => left.sourceIndex - right.sourceIndex),
				cohesionReason: 'source-use-instance',
				sourceUseId: group.sourceUseId,
				sourceUseInstanceId: group.sourceUseInstanceId,
			});
		}

		for (const component of components) {
			if (consumedComponentIds.has(component.componentId)) {
				continue;
			}

			const containedComponents = components
				.filter((candidate) => !consumedComponentIds.has(candidate.componentId))
				.filter((candidate) => candidate.componentId !== component.componentId)
				.filter((candidate) => this.isContainedLayerShapePair(component, candidate));

			if (containedComponents.length) {
				const group = [component, ...containedComponents]
					.sort((left, right) => left.sourceIndex - right.sourceIndex);

				for (const groupComponent of group) {
					consumedComponentIds.add(groupComponent.componentId);
				}

				shapeComponentGroups.push({
					components: group,
					cohesionReason: 'contained-layer',
				});
			} else {
				consumedComponentIds.add(component.componentId);
				shapeComponentGroups.push({
					components: [component],
					cohesionReason: 'single-component',
				});
			}
		}

		return shapeComponentGroups
			.sort((left, right) => Math.min(...left.components.map((component) => component.sourceIndex))
				- Math.min(...right.components.map((component) => component.sourceIndex)))
			.map((shapeGroup, index) => this.makeSourceShape({
				faceKey,
				index,
				components: shapeGroup.components.map((component) => componentsById.get(component.componentId)),
				cohesionReason: shapeGroup.cohesionReason,
				sourceUseId: shapeGroup.sourceUseId || null,
				sourceUseInstanceId: shapeGroup.sourceUseInstanceId || null,
			}));
	}

	/**
	 * Returns true when two source components are layered parts of one shape.
	 *
	 * @param {SourceNormalizedComponent} left - First candidate layer.
	 * @param {SourceNormalizedComponent} right - Second candidate layer.
	 * @returns {boolean} Whether the components should be one source shape.
	 */
	isContainedLayerShapePair(left, right) {
		if (!left.bounds || !right.bounds) {
			return false;
		}

		if (left.classification?.tileLayerCandidate || right.classification?.tileLayerCandidate) {
			return false;
		}

		if (left.classification?.negativeSpaceCandidate || right.classification?.negativeSpaceCandidate) {
			return false;
		}

		if (!sameValues(left.parentGroupIds || [], right.parentGroupIds || [])) {
			return false;
		}

		const outer = boundsContain(left.bounds, right.bounds, 0.75) ? left
			: boundsContain(right.bounds, left.bounds, 0.75) ? right : null;
		const inner = outer === left ? right : left;

		if (!outer) {
			return false;
		}

		const outerArea = outer.area || (outer.bounds.width * outer.bounds.height);
		const innerArea = inner.area || (inner.bounds.width * inner.bounds.height);
		const areaRatio = outerArea ? innerArea / outerArea : 0;

		if (areaRatio < 0.35 || areaRatio > 0.95) {
			return false;
		}

		return normalizedCenterDistance(outer.bounds, inner.bounds) <= 0.08;
	}

	/**
	 * Builds one source shape record from cohesive normalized components.
	 *
	 * @param {{ faceKey: string, index: number, components: SourceNormalizedComponent[] }} options - Shape construction inputs.
	 * @returns {SourceShape} Normalized source shape.
	 */
	makeSourceShape({ faceKey, index, components, cohesionReason = null, sourceUseId = null, sourceUseInstanceId = null }) {
		const bounds = getComponentUnionBounds(components);
		const sourceIndexes = components.map((component) => component.sourceIndex);
		const sourceOrder = Math.min(...sourceIndexes);
		const splitStrategies = [...new Set(components.map((component) => component.splitStrategy).filter(Boolean))];
		const parentGroupIds = uniqueValues(components.flatMap((component) => component.parentGroupIds || []));
		const sourceLayerRoles = uniqueValues(components.flatMap((component) => component.sourceLayerRoles || []));
		const sourceElementIds = uniqueValues(components.map((component) => component.sourceElementId).filter(Boolean));
		const sourceElementComponentIds = uniqueValues(components.map((component) => component.sourceElementComponentId).filter(Boolean));
		const sourceElementComponentId = sourceElementComponentIds[0] || components[0]?.componentId || null;
		const dominantPaint = this.dominantShapePaint(components);
		const shapeId = `shape.${faceKey}.${String(index + 1).padStart(4, '0')}`;
		const resolvedCohesionReason = cohesionReason || (components.length > 1
			? 'contained-layer'
			: 'single-component');

		return {
			shapeId,
			sourceOrder,
			componentIds: components.map((component) => component.componentId),
			componentCount: components.length,
			sourceElementComponentId,
			sourceElementComponentIds,
			sourceElementIds,
			parentGroupIds,
			sourceLayerRoles,
			...(sourceUseId ? { sourceUseId } : {}),
			...(sourceUseInstanceId ? { sourceUseInstanceId } : {}),
			splitStrategies,
			cohesionReason: resolvedCohesionReason,
			splittable: false,
			classNames: uniqueValues(components.map((component) => component.className).filter(Boolean)),
			fills: uniqueValues(components.map((component) => component.fill).filter(Boolean)),
			strokes: uniqueValues(components.map((component) => component.stroke).filter(Boolean)),
			dominantColor: dominantPaint,
			bounds,
			center: bounds
				? {
					x: this.round(bounds.left + (bounds.width / 2)),
					y: this.round(bounds.top + (bounds.height / 2)),
				}
				: null,
			area: this.round(components.reduce((total, component) => total + (component.area || 0), 0)),
			classification: {
				tileLayerCandidate: components.every((component) => component.classification?.tileLayerCandidate),
				negativeSpaceCandidate: components.every((component) => component.classification?.negativeSpaceCandidate),
			},
		};
	}

	/**
	 * Adds expected-label OCR evidence to normalized components and source shapes.
	 *
	 * @param {SourceNormalizedFaceArtifact} artifact - Normalized artifact to annotate.
	 * @returns {Promise<void>}
	 */
	async annotateLabelOcrEvidence(artifact) {
		const expectedLabel = this.expectedLabelForFace(artifact.faceKey);

		if (!expectedLabel) {
			return;
		}

		const templates = await this.labelOcrTemplatesForExpectedLabel(expectedLabel);

		if (!templates.length) {
			return;
		}

		const componentsById = new Map((artifact.components || []).map((component) => [component.componentId, component]));

		for (const component of artifact.components || []) {
			const evidence = await this.labelOcrEvidenceForComponents({
				artifact,
				expectedLabel,
				templates,
				components: [component],
				sourceId: component.componentId,
			});

			if (evidence) {
				component.labelOcr = evidence;
			}
		}

		for (const shape of artifact.sourceShapes || []) {
			const components = (shape.componentIds || [])
				.map((componentId) => componentsById.get(componentId))
				.filter(Boolean);
			const evidence = await this.labelOcrEvidenceForComponents({
				artifact,
				expectedLabel,
				templates,
				components,
				sourceId: shape.shapeId,
			});

			if (evidence) {
				shape.labelOcr = evidence;
			}
		}
	}

	/**
	 * Scores one source component set against the expected label templates.
	 *
	 * @param {SourceLabelOcrEvidenceOptions} options - Components and expected label data.
	 * @returns {Promise<SourceLabelOcrEvidence | null>} OCR evidence, if the component can be rendered.
	 */
	async labelOcrEvidenceForComponents({ artifact, expectedLabel, templates, components, sourceId }) {
		const renderableComponents = components
			.filter((component) => component?.pathData && component.bounds)
			.filter((component) => hasVisiblePaint(component))
			.filter((component) => !component.classification?.tileLayerCandidate)
			.filter((component) => !component.classification?.negativeSpaceCandidate);

		if (!renderableComponents.length) {
			return null;
		}

		const bounds = getComponentUnionBounds(renderableComponents);

		if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
			return null;
		}

		const mask = await this.renderLabelOcrMask({ bounds, components: renderableComponents });
		const candidateDarkness = await this.darknessFromBuffer(mask);
		const score = this.bestLabelOcrTemplateScore(candidateDarkness, templates);
		const sourceWidth = artifact.viewBox?.width || artifact.alignmentBounds?.width || 1;
		const maxDimensionRatioToSourceWidth = Math.max(bounds.width, bounds.height) / Math.max(1, sourceWidth);

		return {
			source: 'label-ocr-template',
			sourceId,
			componentIds: renderableComponents.map((component) => component.componentId),
			expectedLabel,
			templateId: score.templateId,
			pixelMeanAbsoluteError: score.pixelMeanAbsoluteError,
			candidateDarkness: score.candidateDarkness,
			templateDarkness: score.templateDarkness,
			threshold: LABEL_OCR_PIXEL_MAE_THRESHOLD,
			match: score.pixelMeanAbsoluteError <= LABEL_OCR_PIXEL_MAE_THRESHOLD,
			maxDimensionRatioToSourceWidth: this.round(maxDimensionRatioToSourceWidth),
		};
	}

	/**
	 * Loads OCR templates for one expected label.
	 *
	 * @param {string} expectedLabel - Expected face label.
	 * @returns {Promise<SourceLabelOcrTemplate[]>} Matching template darkness data.
	 */
	async labelOcrTemplatesForExpectedLabel(expectedLabel) {
		const templates = await this.loadLabelOcrTemplates();
		return templates[this.normalizeLabelText(expectedLabel)] || [];
	}

	/**
	 * Loads all OCR template darkness arrays once per runner instance.
	 *
	 * @returns {Promise<Record<string, SourceLabelOcrTemplate[]>>} Templates keyed by expected label.
	 */
	async loadLabelOcrTemplates() {
		if (this.labelOcrTemplateCache) {
			return this.labelOcrTemplateCache;
		}

		const templateDir = this.path.resolve(this.rootDir, 'scripts/data/3d-assets/label-ocr/templates');
		const templates = {};

		for (const [label, entries] of Object.entries(LABEL_OCR_TEMPLATE_GROUPS)) {
			const loadedEntries = [];

			for (const entry of entries) {
				const templatePath = this.path.resolve(templateDir, entry.file);

				if (!(await this.exists(templatePath))) {
					continue;
				}

				loadedEntries.push({
					...entry,
					darkness: await this.darknessFromFile(templatePath),
				});
			}

			if (loadedEntries.length) {
				templates[this.normalizeLabelText(label)] = loadedEntries;
			}
		}

		this.labelOcrTemplateCache = templates;
		return templates;
	}

	/**
	 * Renders components into the square-normalized OCR mask space.
	 *
	 * @param {{ bounds: SourceBounds, components: SourceNormalizedComponent[] }} options - Renderable source components.
	 * @returns {Promise<Buffer>} PNG mask buffer.
	 */
	async renderLabelOcrMask({ bounds, components }) {
		const pathElements = components
			.map((component) => {
				const fill = component.fill && component.fill !== 'none' ? 'black' : 'none';
				const stroke = component.stroke && component.stroke !== 'none'
					? 'black'
					: fill === 'none' ? 'black' : 'none';
				const strokeWidth = component.strokeWidth || 1;
				const transform = this.componentTransformAttribute(component);

				return `<path d="${this.escapeAttribute(component.pathData)}" fill="${fill}" stroke="${stroke}" stroke-width="${this.escapeAttribute(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${transform ? ` ${transform}` : ''}/>`;
			})
			.join('\n');
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LABEL_OCR_TEMPLATE_SIZE}" height="${LABEL_OCR_TEMPLATE_SIZE}" viewBox="0 0 ${LABEL_OCR_TEMPLATE_SIZE} ${LABEL_OCR_TEMPLATE_SIZE}">
<rect width="${LABEL_OCR_TEMPLATE_SIZE}" height="${LABEL_OCR_TEMPLATE_SIZE}" fill="white"/>
<svg x="1" y="1" width="${LABEL_OCR_TEMPLATE_SIZE - 2}" height="${LABEL_OCR_TEMPLATE_SIZE - 2}" viewBox="${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}" preserveAspectRatio="none">
${pathElements}
</svg>
</svg>`;

		return this.normalizeLabelOcrMask(await sharp(Buffer.from(svg)).png().toBuffer());
	}

	/**
	 * Removes low-density edge mass from an OCR mask before final square normalization.
	 *
	 * @param {Buffer} mask - Initial PNG mask buffer.
	 * @returns {Promise<Buffer>} Mass-normalized square PNG mask buffer.
	 */
	async normalizeLabelOcrMask(mask) {
		const bounds = await this.labelOcrMassCropBounds(mask);

		return sharp(mask)
			.extract(bounds)
			.resize(LABEL_OCR_TEMPLATE_SIZE - 2, LABEL_OCR_TEMPLATE_SIZE - 2, { fit: 'fill' })
			.extend({
				top: 1,
				right: 1,
				bottom: 1,
				left: 1,
				background: 'white',
			})
			.png()
			.toBuffer();
	}

	/**
	 * Calculates a glyph-mass crop rectangle that ignores faint edge haze.
	 *
	 * @param {Buffer} mask - PNG mask buffer.
	 * @returns {Promise<{ left: number, top: number, width: number, height: number }>} Crop rectangle.
	 */
	async labelOcrMassCropBounds(mask) {
		const { data, info } = await sharp(mask)
			.removeAlpha()
			.greyscale()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const columns = Array(info.width).fill(0);
		const rows = Array(info.height).fill(0);

		for (let y = 0; y < info.height; y += 1) {
			for (let x = 0; x < info.width; x += 1) {
				const darkness = 1 - (data[(y * info.width) + x] / 255);

				if (darkness >= LABEL_OCR_MASS_CROP_DARKNESS_FLOOR) {
					columns[x] += darkness;
					rows[y] += darkness;
				}
			}
		}

		const horizontalBounds = this.massCropAxisBounds(columns);
		const verticalBounds = this.massCropAxisBounds(rows);

		return {
			left: horizontalBounds.start,
			top: verticalBounds.start,
			width: Math.max(1, horizontalBounds.end - horizontalBounds.start + 1),
			height: Math.max(1, verticalBounds.end - verticalBounds.start + 1),
		};
	}

	/**
	 * Finds the axis bounds after trimming a small amount of edge mass.
	 *
	 * @param {number[]} values - Per-axis darkness mass.
	 * @returns {{ start: number, end: number }} Axis crop bounds.
	 */
	massCropAxisBounds(values) {
		const total = values.reduce((sum, value) => sum + value, 0);

		if (total <= 0) {
			return { start: 0, end: values.length - 1 };
		}

		const target = total * LABEL_OCR_MASS_CROP_TAIL_RATIO;
		let start = 0;
		let startMass = 0;

		while (start < values.length - 1 && startMass + values[start] < target) {
			startMass += values[start];
			start += 1;
		}

		let end = values.length - 1;
		let endMass = 0;

		while (end > 0 && endMass + values[end] < target) {
			endMass += values[end];
			end -= 1;
		}

		return start <= end ? { start, end } : { start: 0, end: values.length - 1 };
	}

	/**
	 * Reads a template file as per-pixel darkness values.
	 *
	 * @param {string} filePath - Template PNG path.
	 * @returns {Promise<number[]>} Darkness values in 0..1.
	 */
	async darknessFromFile(filePath) {
		return this.darknessFromBuffer(await this.normalizeLabelOcrMask(await this.fs.readFile(filePath)));
	}

	/**
	 * Converts a rendered PNG buffer to per-pixel darkness values.
	 *
	 * @param {Buffer} buffer - PNG buffer.
	 * @returns {Promise<number[]>} Darkness values in 0..1.
	 */
	async darknessFromBuffer(buffer) {
		const { data } = await sharp(buffer)
			.removeAlpha()
			.greyscale()
			.raw()
			.toBuffer({ resolveWithObject: true });

		return [...data].map((value) => 1 - (value / 255));
	}

	/**
	 * Scores a candidate darkness map against all templates for the expected label.
	 *
	 * @param {number[]} candidate - Candidate darkness array.
	 * @param {SourceLabelOcrTemplate[]} templates - Template darkness arrays.
	 * @returns {SourceLabelOcrScore} Best score.
	 */
	bestLabelOcrTemplateScore(candidate, templates) {
		return templates
			.map((template) => ({
				templateId: template.templateId,
				...this.scoreLabelOcrDarkness(candidate, template.darkness),
			}))
			.sort((left, right) => left.pixelMeanAbsoluteError - right.pixelMeanAbsoluteError)[0];
	}

	/**
	 * Computes Pixel MAE between two 50x50 darkness arrays.
	 *
	 * @param {number[]} candidate - Candidate darkness array.
	 * @param {number[]} template - Template darkness array.
	 * @returns {Omit<SourceLabelOcrScore, 'templateId'>} Pixel score details.
	 */
	scoreLabelOcrDarkness(candidate, template) {
		let sumCandidate = 0;
		let sumTemplate = 0;
		let sumAbsoluteDifference = 0;
		const length = Math.min(candidate.length, template.length);

		for (let index = 0; index < length; index += 1) {
			const candidateValue = candidate[index];
			const templateValue = template[index];
			sumCandidate += candidateValue;
			sumTemplate += templateValue;
			sumAbsoluteDifference += Math.abs(candidateValue - templateValue);
		}

		return {
			pixelMeanAbsoluteError: this.roundScore(sumAbsoluteDifference / Math.max(1, length)),
			candidateDarkness: this.roundScore(sumCandidate / Math.max(1, length)),
			templateDarkness: this.roundScore(sumTemplate / Math.max(1, length)),
		};
	}

	/**
	 * Returns the western label expected for this face, if any.
	 *
	 * @param {string} faceKey - Mahjong face key.
	 * @returns {string | null} Expected western label.
	 */
	expectedLabelForFace(faceKey) {
		const [familyKey, value] = faceKey.split('-');

		if (['b', 'c', 'd', 'flower', 'season'].includes(familyKey)) {
			return value || null;
		}

		if (familyKey === 'wind') {
			return String(value || '').toUpperCase();
		}

		if (familyKey === 'dragon') {
			return {
				r: 'C',
				g: 'F',
				w: 'P',
			}[value] || null;
		}

		return null;
	}

	/**
	 * Normalizes label text for expected-label template lookup.
	 *
	 * @param {string} value - Label text.
	 * @returns {string} Normalized label text.
	 */
	normalizeLabelText(value) {
		return String(value || '')
			.trim()
			.toUpperCase()
			.replace(/[\s.,;:_-]+/g, '');
	}

	/**
	 * Selects the dominant paint used by a source shape.
	 *
	 * @param {SourceNormalizedComponent[]} components - Components in the shape.
	 * @returns {string | null} Dominant fill/stroke paint.
	 */
	dominantShapePaint(components) {
		const areasByPaint = new Map();

		for (const component of components) {
			const paint = component.fill && component.fill !== 'none'
				? component.fill
				: component.stroke && component.stroke !== 'none' ? component.stroke : null;

			if (!paint) {
				continue;
			}

			areasByPaint.set(paint, (areasByPaint.get(paint) || 0) + (component.area || 0));
		}

		return [...areasByPaint.entries()]
			.sort((left, right) => right[1] - left[1])[0]?.[0] || null;
	}

	/**
	 * Renders an SVG showing components retained for downstream inspection.
	 *
	 * @param {SourceNormalizedFaceArtifact} artifact - Normalized face artifact to render.
	 * @returns {string} Debug SVG source.
	 */
	buildIdentifiedComponentsSvg(artifact, options = {}) {
		const viewBox = artifact.viewBox || artifact.alignmentBounds || { minX: 0, minY: 0, width: 1, height: 1 };
		const minX = viewBox.minX ?? viewBox.left ?? 0;
		const minY = viewBox.minY ?? viewBox.top ?? 0;
		const width = viewBox.width || 1;
		const height = viewBox.height || 1;
		const alignmentComponentIds = new Set(artifact.alignmentComponentIds || []);
		const paths = (artifact.components || [])
			.filter((component) => (
				alignmentComponentIds.has(component.componentId)
				|| this.isIdentifiedArtworkCutout(component, artifact.alignmentBounds)
			))
			.filter((component) => component.pathData)
			.map((component) => this.componentToSvgPath(component))
			.join('\n');

		return `<svg ${IDENTIFIED_SVG_NAMESPACE_ATTRIBUTES} viewBox="${minX} ${minY} ${width} ${height}">
${options.sourceDefs || ''}
${paths}
</svg>
`;
	}

	/**
	 * Renders an SVG showing retained source shapes with colored bounds.
	 *
	 * @param {SourceNormalizedFaceArtifact} artifact - Normalized face artifact to render.
	 * @returns {string} Debug SVG source.
	 */
	buildIdentifiedShapesSvg(artifact, options = {}) {
		const viewBox = artifact.viewBox || artifact.alignmentBounds || { minX: 0, minY: 0, width: 1, height: 1 };
		const minX = viewBox.minX ?? viewBox.left ?? 0;
		const minY = viewBox.minY ?? viewBox.top ?? 0;
		const width = viewBox.width || 1;
		const height = viewBox.height || 1;
		const alignmentShapeIds = new Set(artifact.alignmentShapeIds || []);
		const componentsById = new Map((artifact.components || []).map((component) => [component.componentId, component]));
		const shapeGroups = (artifact.sourceShapes || [])
			.filter((shape) => alignmentShapeIds.has(shape.shapeId))
			.map((shape, index) => this.shapeToDebugSvgGroup({ shape, index, componentsById }))
			.join('\n');

		return `<svg ${IDENTIFIED_SVG_NAMESPACE_ATTRIBUTES} viewBox="${minX} ${minY} ${width} ${height}">
${options.sourceDefs || ''}
${shapeGroups}
</svg>
`;
	}

	/**
	 * Renders one shape as a debug SVG group.
	 *
	 * @param {SourceShapeDebugGroupOptions} options - Shape rendering inputs.
	 * @returns {string} SVG group element source.
	 */
	shapeToDebugSvgGroup({ shape, index, componentsById }) {
		const color = DEBUG_SHAPE_COLORS[index % DEBUG_SHAPE_COLORS.length];
		const bounds = shape.bounds;
		const outline = bounds
			? `<rect data-shape-box="${this.escapeAttribute(shape.shapeId)}" x="${bounds.left}" y="${bounds.top}" width="${bounds.width}" height="${bounds.height}" fill="none" stroke="${color}" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`
			: '';
		const paths = shape.componentIds
			.map((componentId) => componentsById.get(componentId))
			.filter((component) => component?.pathData)
			.map((component) => this.componentToSvgPath(component))
			.join('\n');

		return `<g data-shape-id="${this.escapeAttribute(shape.shapeId)}" data-shape-components="${this.escapeAttribute(shape.componentIds.join(' '))}" data-shape-cohesion="${this.escapeAttribute(shape.cohesionReason)}">
${paths}
${outline}
</g>`;
	}

	/**
	 * Checks whether a negative-space component should remain visible in debug SVG output.
	 *
	 * @param {SourceNormalizedComponent} component - Normalized component to inspect.
	 * @param {SourceBounds | null} alignmentBounds - Bounds of alignment artwork.
	 * @returns {boolean} True when the cutout overlaps retained artwork.
	 */
	isIdentifiedArtworkCutout(component, alignmentBounds) {
		if (!component.classification?.negativeSpaceCandidate || !alignmentBounds) {
			return false;
		}

		if (!this.boundsOverlap(component.bounds, alignmentBounds)) {
			return false;
		}

		const alignmentArea = alignmentBounds.area || ((alignmentBounds.width || 0) * (alignmentBounds.height || 0));

		return component.area / Math.max(1, alignmentArea) <= 0.9;
	}

	/**
	 * Checks whether two bounds overlap or touch.
	 *
	 * @param {SourceBounds | null} left - First bounds.
	 * @param {SourceBounds | null} right - Second bounds.
	 * @returns {boolean} True when the bounds overlap or touch.
	 */
	boundsOverlap(left, right) {
		return Boolean(left && right)
			&& left.right >= right.left
			&& left.left <= right.right
			&& left.bottom >= right.top
			&& left.top <= right.bottom;
	}

	/**
	 * Renders one normalized component as a debug SVG path.
	 *
	 * @param {SourceNormalizedComponent} component - Component to render.
	 * @returns {string} SVG path element source.
	 */
	componentToSvgPath(component) {
		const attrs = [
			`data-component-id="${this.escapeAttribute(component.componentId)}"`,
			component.className ? `class="${this.escapeAttribute(component.className)}"` : null,
			`d="${this.escapeAttribute(component.pathData)}"`,
			this.componentTransformAttribute(component),
			`fill="${this.escapeAttribute(component.fill && component.fill !== 'none' ? component.fill : 'none')}"`,
			component.stroke && component.stroke !== 'none' ? `stroke="${this.escapeAttribute(component.stroke)}"` : null,
			component.strokeWidth ? `stroke-width="${this.escapeAttribute(component.strokeWidth)}"` : null,
			component.fillRule ? `fill-rule="${this.escapeAttribute(component.fillRule)}"` : null,
			component.clipRule ? `clip-rule="${this.escapeAttribute(component.clipRule)}"` : null,
			component.opacity != null ? `opacity="${this.escapeAttribute(component.opacity)}"` : null,
		].filter(Boolean).join(' ');

		return `<path ${attrs}/>`;
	}

	/**
	 * Creates a transform attribute for non-identity component transforms.
	 *
	 * @param {SourceNormalizedComponent} component - Component with optional transform data.
	 * @returns {string | null} SVG transform attribute or null.
	 */
	componentTransformAttribute(component) {
		const transform = component.transform;

		if (!transform || this.isIdentityTransform(transform)) {
			return null;
		}

		return `transform="${this.escapeAttribute(`matrix(${[
			transform.a ?? 1,
			transform.b ?? 0,
			transform.c ?? 0,
			transform.d ?? 1,
			transform.e ?? 0,
			transform.f ?? 0,
		].join(' ')})`)}"`;
	}

	/**
	 * Checks whether a matrix is effectively the identity matrix.
	 *
	 * @param {SourceMatrix} transform - Matrix to inspect.
	 * @returns {boolean} True when the matrix is identity.
	 */
	isIdentityTransform(transform) {
		return this.nearlyEqual(transform.a ?? 1, 1)
			&& this.nearlyEqual(transform.b ?? 0, 0)
			&& this.nearlyEqual(transform.c ?? 0, 0)
			&& this.nearlyEqual(transform.d ?? 1, 1)
			&& this.nearlyEqual(transform.e ?? 0, 0)
			&& this.nearlyEqual(transform.f ?? 0, 0);
	}

	/**
	 * Formats extracted source component data into the normalized artifact shape.
	 *
	 * @param {string} faceKey - Face key that owns the component.
	 * @param {SourceExtractedComponent} component - Extracted source component.
	 * @param {number} index - Fallback component index.
	 * @returns {SourceNormalizedComponent} Normalized source component record.
	 */
	formatSourceComponent(faceKey, component, index) {
		const sourceIndex = component.sourceIndex ?? index;
		const sourceElementComponentId = `src.${faceKey}.${String(sourceIndex + 1).padStart(4, '0')}`;
		const subcomponentIndex = Number.isFinite(component.subcomponentIndex)
			? component.subcomponentIndex
			: null;
		const componentId = subcomponentIndex == null
			? sourceElementComponentId
			: `${sourceElementComponentId}.${String(subcomponentIndex + 1).padStart(4, '0')}`;

		return {
			componentId,
			sourceIndex,
			sourceElementIndex: component.sourceElementIndex ?? sourceIndex,
			sourceElementComponentId,
			parentComponentId: subcomponentIndex == null ? null : sourceElementComponentId,
			subcomponentIndex,
			componentLevel: component.componentLevel || 'element',
			splitStrategy: component.splitStrategy || 'geometry-element',
			sourceElementId: component.id || null,
			tagName: component.tagName,
			className: component.className,
			fill: component.fill,
			stroke: component.stroke,
			strokeWidth: component.strokeWidth,
			fillRule: component.fillRule,
			opacity: component.opacity,
			textValue: component.textValue,
			fontSize: component.fontSize,
			fontFamily: component.fontFamily,
			fontPath: component.fontPath,
			bounds: component.bounds,
			center: component.center,
			area: component.area,
			parentGroupIds: component.parentGroupIds || [],
			sourceLayerRoles: component.sourceLayerRoles || [],
			sourceUseId: component.sourceUseId || null,
			sourceUseInstanceId: component.sourceUseInstanceId || null,
			sourceUseInstances: component.sourceUseInstances || [],
			transform: component.transform,
			classification: {
				tileLayerCandidate: Boolean(component.tileLayerCandidate),
				negativeSpaceCandidate: Boolean(component.negativeSpaceCandidate),
			},
			sourceElement: component.sourceElement,
			pathData: component.pathData,
		};
	}

	/**
	 * Summarizes component paint groups for report inspection.
	 *
	 * @param {SourceNormalizedComponent[]} components - Components to summarize.
	 * @returns {SourcePaintSummaryEntry[]} Paint summary sorted by descending area.
	 */
	summarizePaint(components) {
		const summary = new Map();

		for (const component of components) {
			const key = [
				component.className || '(no-class)',
				component.fill || '(no-fill)',
				component.stroke || '(no-stroke)',
			].join('|');
			const current = summary.get(key) || {
				className: component.className,
				fill: component.fill,
				stroke: component.stroke,
				count: 0,
				totalArea: 0,
			};

			current.count += 1;
			current.totalArea += component.area || 0;
			summary.set(key, current);
		}

		return [...summary.values()]
			.map((entry) => ({
				...entry,
				totalArea: this.round(entry.totalArea),
			}))
			.sort((left, right) => right.totalArea - left.totalArea);
	}

	/**
	 * Resolves a canonical face source path relative to the repository root.
	 *
	 * @param {Object} faceState - Canonical face state record.
	 * @returns {string | null} Absolute source path or null.
	 */
	resolveFaceSource(faceState) {
		const rawPath = faceState?.artifacts?.sourceSvg;

		if (!rawPath) {
			return null;
		}

		return this.path.isAbsolute(rawPath)
			? rawPath
			: this.path.resolve(this.rootDir, rawPath);
	}

	/**
	 * Writes pretty JSON through the configured filesystem.
	 *
	 * @param {string} outputPath - Destination path.
	 * @param {*} data - JSON-serializable value to write.
	 * @returns {Promise<void>}
	 */
	async writeJson(outputPath, data) {
		await this.fs.mkdir(this.path.dirname(outputPath), { recursive: true });
		await this.fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
	}

	/**
	 * Checks whether a file exists through the configured filesystem.
	 *
	 * @param {string} filePath - Path to check.
	 * @returns {Promise<boolean>} True when the file can be accessed.
	 */
	async exists(filePath) {
		try {
			await this.fs.access(filePath);
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Formats a path relative to the configured repository root.
	 *
	 * @param {string} filePath - Path to format.
	 * @returns {string} Repository-relative POSIX path.
	 */
	normalizePath(filePath) {
		return this.path.relative(this.rootDir, filePath).replaceAll('\\', '/');
	}

	/**
	 * Escapes a value for use in an SVG attribute.
	 *
	 * @param {*} value - Attribute value.
	 * @returns {string} Escaped attribute value.
	 */
	escapeAttribute(value) {
		return String(value)
			.replaceAll('&', '&amp;')
			.replaceAll('"', '&quot;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;');
	}

	/**
	 * Compares two numbers using SVG transform tolerance.
	 *
	 * @param {number} left - First value.
	 * @param {number} right - Second value.
	 * @returns {boolean} True when the values are nearly equal.
	 */
	nearlyEqual(left, right) {
		return Math.abs(left - right) < 0.000001;
	}

	/**
	 * Rounds a numeric value to the artifact precision.
	 *
	 * @param {number} value - Value to round.
	 * @returns {number} Rounded value.
	 */
	round(value) {
		return Number(Number(value || 0).toFixed(3));
	}

	/**
	 * Rounds OCR score fields without losing useful threshold precision.
	 *
	 * @param {number} value - Value to round.
	 * @returns {number} Rounded score value.
	 */
	roundScore(value) {
		return Number(Number(value || 0).toFixed(4));
	}
}

function uniqueValues(values) {
	return [...new Set(values.filter((value) => value != null && value !== ''))];
}

function hasVisiblePaint(component) {
	return isVisiblePaint(component.fill) || isVisiblePaint(component.stroke);
}

function flattenVisiblePaintLayers(components) {
	const flattenedComponents = components.map((component) => ({ ...component }));

	for (let index = 0; index < flattenedComponents.length; index += 1) {
		const component = flattenedComponents[index];
		if (!shouldFlattenPaintLayer(component)) {
			continue;
		}

		const occludingComponents = flattenedComponents
			.slice(index + 1)
			.filter(shouldFlattenPaintLayer)
			.filter((candidate) => boundsOverlap(component.bounds, candidate.bounds))
			.filter((candidate) => boundsContainCenter(component.bounds, candidate.center || candidate.bounds?.center))
			.filter((candidate) => !sameSourcePaintElement(component, candidate))
			.filter((candidate) => sameSourceShape(component, candidate))
			.filter((candidate) => !boundsContain(candidate.bounds, component.bounds));

		if (occludingComponents.length === 0) {
			continue;
		}

		const flattened = subtractPaintLayerOcclusions(component, occludingComponents);
		if (!flattened.changed) {
			continue;
		}

		flattenedComponents[index] = {
			...component,
			...flattened.component,
			paintLayerFlattening: {
				source: 'source-normalization',
				occludingComponentIds: occludingComponents.map((candidate) => candidate.componentId),
			},
		};
	}

	return flattenedComponents;
}

function shouldFlattenPaintLayer(component) {
	return Boolean(component?.pathData)
		&& isVisiblePaint(component.fill)
		&& !isVisiblePaint(component.stroke)
		&& !component.classification?.tileLayerCandidate
		&& !component.classification?.negativeSpaceCandidate
		&& (component.opacity == null || Number(component.opacity) >= 1)
		&& (component.fillOpacity == null || Number(component.fillOpacity) >= 1);
}

function annotateSourceShapeIds(components, sourceShapes) {
	const shapeIdByComponentId = new Map();
	for (const shape of sourceShapes || []) {
		for (const componentId of shape.componentIds || []) {
			shapeIdByComponentId.set(componentId, shape.shapeId);
		}
	}

	return components.map((component) => ({
		...component,
		...(shapeIdByComponentId.has(component.componentId)
			? { sourceShapeId: shapeIdByComponentId.get(component.componentId) }
			: {}),
	}));
}

function sameSourceShape(left, right) {
	return Boolean(left?.sourceShapeId && right?.sourceShapeId)
		&& left.sourceShapeId === right.sourceShapeId;
}

function sameSourcePaintElement(left, right) {
	const leftKey = sourcePaintElementKey(left);
	return Boolean(leftKey) && leftKey === sourcePaintElementKey(right);
}

function sourcePaintElementKey(component) {
	return component?.sourceUseInstanceId
		|| component?.sourceElementComponentId
		|| null;
}

function subtractPaintLayerOcclusions(component, occludingComponents) {
	let result = null;

	try {
		result = makeTransformedCompoundPath(component);
		let changed = false;

		for (const occludingComponent of occludingComponents) {
			const occluder = makeTransformedCompoundPath(occludingComponent);
			const next = result.subtract(occluder, { insert: false });

			result.remove();
			occluder.remove();
			result = next;
			changed = true;

			if (!result || result.isEmpty()) {
				break;
			}
		}

		if (!changed || !result || result.isEmpty()) {
			result?.remove?.();
			return {
				changed,
				component: {
					pathData: null,
					bounds: null,
					center: null,
					area: 0,
					transform: null,
					hiddenByPaintLayerFlattening: true,
				},
			};
		}

		const bounds = sourceBoundsFromPaperBounds(result.bounds);
		if (bounds.area <= PAINT_LAYER_FLATTENING_MIN_VISIBLE_AREA) {
			result.remove();
			return {
				changed: true,
				component: {
					pathData: null,
					bounds: null,
					center: null,
					area: 0,
					transform: null,
					hiddenByPaintLayerFlattening: true,
				},
			};
		}

		const pathData = result.pathData;
		result.remove();

		return {
			changed: true,
			component: {
				pathData,
				bounds,
				center: bounds.center,
				area: bounds.area,
				transform: null,
				flattenedPaintLayer: true,
			},
		};
	} catch {
		result?.remove?.();
		return { changed: false, component };
	}
}

function makeTransformedCompoundPath(component) {
	const item = new paper.CompoundPath(component.pathData);
	const transform = component.transform || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
	item.transform(new paper.Matrix(
		transform.a ?? 1,
		transform.b ?? 0,
		transform.c ?? 0,
		transform.d ?? 1,
		transform.e ?? 0,
		transform.f ?? 0,
	));
	return item;
}

function sourceBoundsFromPaperBounds(bounds) {
	const left = round(bounds.left);
	const top = round(bounds.top);
	const right = round(bounds.right);
	const bottom = round(bounds.bottom);
	const width = round(bounds.width);
	const height = round(bounds.height);

	return {
		left,
		top,
		right,
		bottom,
		width,
		height,
		area: round(width * height),
		center: {
			x: round(bounds.center.x),
			y: round(bounds.center.y),
		},
	};
}

function round(value) {
	return Number(Number(value || 0).toFixed(3));
}

function boundsOverlap(left, right) {
	return Boolean(left && right)
		&& left.right >= right.left
		&& left.left <= right.right
		&& left.bottom >= right.top
		&& left.top <= right.bottom;
}

function boundsContainCenter(bounds, center) {
	return Boolean(bounds && center)
		&& center.x >= bounds.left
		&& center.x <= bounds.right
		&& center.y >= bounds.top
		&& center.y <= bounds.bottom;
}

function sourceUseShapeInstance(component) {
	if (isSeparableSplitSubcomponent(component)) {
		return null;
	}

	const instances = component.sourceUseInstances || [];

	return [...instances].reverse().find((instance) => (
		instance?.sourceUseId
		&& instance?.sourceUseInstanceId
		&& !STRUCTURAL_SOURCE_USE_IDS.has(instance.sourceUseId)
	)) || null;
}

function isSeparableSplitSubcomponent(component) {
	return component?.componentLevel === 'subcomponent'
		&& component?.splitStrategy === 'compound-path-band';
}

function extractSvgDefs(svgSource) {
	return /<defs\b[^>]*>[\s\S]*?<\/defs>/i.exec(svgSource)?.[0] || '';
}

function isVisiblePaint(value) {
	const normalized = String(value || '').trim().toLowerCase();

	return Boolean(normalized)
		&& normalized !== 'none'
		&& normalized !== 'transparent';
}

function sameValues(leftValues, rightValues) {
	if (leftValues.length !== rightValues.length) {
		return false;
	}

	return leftValues.every((value, index) => value === rightValues[index]);
}

function boundsContain(outer, inner, tolerance = 0) {
	return inner.left >= outer.left - tolerance
		&& inner.top >= outer.top - tolerance
		&& inner.right <= outer.right + tolerance
		&& inner.bottom <= outer.bottom + tolerance;
}

function normalizedCenterDistance(leftBounds, rightBounds) {
	const leftCenter = leftBounds.center || {
		x: leftBounds.left + (leftBounds.width / 2),
		y: leftBounds.top + (leftBounds.height / 2),
	};
	const rightCenter = rightBounds.center || {
		x: rightBounds.left + (rightBounds.width / 2),
		y: rightBounds.top + (rightBounds.height / 2),
	};
	const width = Math.max(leftBounds.width, rightBounds.width, 1);
	const height = Math.max(leftBounds.height, rightBounds.height, 1);
	const x = (leftCenter.x - rightCenter.x) / width;
	const y = (leftCenter.y - rightCenter.y) / height;

	return Math.sqrt((x * x) + (y * y));
}
