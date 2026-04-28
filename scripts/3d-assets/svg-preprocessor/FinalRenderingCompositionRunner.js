import { promises as fs } from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import paper from 'paper';
import sharp from 'sharp';
import { ASSET_FONTS_DIR, OUTPUT_3D_DIR, ROOT_DIR } from '../shared/asset-paths.js';
import { ColorPicker } from './ColorPicker.js';
import { Colors } from './ColorPalette.js';
import { PaletteBuilder } from './PaletteBuilder.js';
import { isRelatedKnockout, makePaintPathWithKnockouts } from './normalized-face-components.js';
import { BASE_REFERENCE } from './PipelineModel.js';
import { tilesetImageDir, tilesetOutputRoot } from './pipeline-output-paths.js';

export const DEFAULT_FINAL_RENDERING_TILESET_ID = 'wiki';
export const DEFAULT_HOUSE_LABEL_FONT_PATH = path.resolve(ASSET_FONTS_DIR, 'gluten-800.ttf');
const CJK_FONT_CANDIDATES = Object.freeze([
	path.resolve(ASSET_FONTS_DIR, 'cjk-label.ttf'),
	'C:/Windows/Fonts/STKAITI.TTF',
	'C:/Windows/Fonts/STFANGSO.TTF',
	'C:/Windows/Fonts/STSONG.TTF',
	'C:/Windows/Fonts/simhei.ttf',
	'C:/Windows/Fonts/NotoSansJP-VF.ttf',
]);

paper.setup([512, 512]);

/**
 * Builds final-rendering composition artifacts one explicit step at a time.
 */
export class FinalRenderingCompositionRunner {
	/**
	 * Creates a runner with replaceable filesystem and pipeline dependencies.
	 *
	 * @param {FinalRenderingCompositionRunnerDependencies} dependencies - Dependencies used by the final rendering workflow.
	 */
	constructor({
		fileSystem = fs,
		pathModule = path,
		rootDir = ROOT_DIR,
		output3dDir = OUTPUT_3D_DIR,
		clock = () => new Date().toISOString(),
	} = {}) {
		this.fs = fileSystem;
		this.path = pathModule;
		this.rootDir = rootDir;
		this.output3dDir = output3dDir;
		this.clock = clock;
	}

	/**
	 * Runs final rendering composition for all selected faces.
	 *
	 * @param {FinalRenderingCompositionRunOptions} options - Composition options resolved by CLI or tests.
	 * @returns {Promise<FinalRenderingCompositionSummary>} Summary of written artifacts and report counts.
	 */
	async run(options = {}) {
		const tilesetId = options.tilesetId || DEFAULT_FINAL_RENDERING_TILESET_ID;
		const requestedFaceKey = options.faceKey || null;
		const sourceRoot = tilesetOutputRoot(tilesetId);
		const pipelineStatePath = this.path.resolve(
			this.rootDir,
			options.pipelineStatePath || this.path.join(sourceRoot, 'pipeline.json'),
		);
		const finalRenderingImageDirs = {
			addOptionalSvg: tilesetImageDir(tilesetId, 'final-rendering-add-optional-svg'),
			layoutSvg: tilesetImageDir(tilesetId, 'final-rendering-layout-svg'),
			colorSvg: tilesetImageDir(tilesetId, 'final-rendering-color-svg'),
			colorReviewPng: tilesetImageDir(tilesetId, 'final-rendering-color-review-png'),
		};
		const generatedOn = this.clock();
		const tilesetState = await this.readJson(pipelineStatePath);
		const faceKeys = await this.faceKeys({
			requestedFaceKey,
			tilesetState,
		});
		const report = this.createReport({
			tilesetId,
			generatedOn,
			requestedFaceKey,
			faceKeys,
			tilesetStatePath: pipelineStatePath,
		});

		for (const imageDir of Object.values(finalRenderingImageDirs)) {
			await this.fs.mkdir(imageDir, { recursive: true });
		}

		for (const faceKey of faceKeys) {
			await this.processFace({
				tilesetId,
				faceKey,
				generatedOn,
				tilesetState,
				pipelineStatePath,
				finalRenderingImageDirs,
				report,
			});
		}
		tilesetState.currencyDate = generatedOn;
		await this.writeJson(pipelineStatePath, tilesetState);

		return {
			tilesetId,
			faceKey: requestedFaceKey,
			faceCount: report.faceCount,
			optionalPartCount: report.optionalPartCount,
			sourceRenderCount: report.sourceRenderCount,
			generatedRenderCount: report.generatedRenderCount,
			omittedRenderCount: report.omittedRenderCount,
			unresolvedRenderCount: report.unresolvedRenderCount,
			diagnosticCount: report.diagnosticCount,
			warningCount: report.warnings.length,
		};
	}

	createReport({ tilesetId, generatedOn, requestedFaceKey, faceKeys, tilesetStatePath }) {
		return {
			schemaVersion: 1,
			tilesetId,
			generatedOn,
			faceKey: requestedFaceKey,
			faceCount: 0,
			plannedFaceCount: faceKeys.length,
			optionalPartCount: 0,
			sourceRenderCount: 0,
			generatedRenderCount: 0,
			omittedRenderCount: 0,
			unresolvedRenderCount: 0,
			diagnosticCount: 0,
			inputs: {
				tilesetState: {
					path: this.normalizePath(tilesetStatePath),
				},
			},
			faces: {},
			warnings: [],
		};
	}

	async faceKeys({ requestedFaceKey, tilesetState }) {
		if (requestedFaceKey) {
			return [requestedFaceKey];
		}

		return Object.keys(tilesetState.svgPipeline?.faces || {}).sort((left, right) => left.localeCompare(right));
	}

	async processFace({
		tilesetId,
		faceKey,
		generatedOn,
		tilesetState,
		pipelineStatePath,
		finalRenderingImageDirs,
		report,
	}) {
		const faceState = tilesetState.svgPipeline?.faces?.[faceKey];
		const normalizedComponentsPath = this.resolveArtifactPath(faceState?.artifacts?.normalizedComponents);
		const addOptionalSvgPath = this.path.resolve(finalRenderingImageDirs.addOptionalSvg, `${faceKey}.svg`);
		const layoutSvgPath = this.path.resolve(finalRenderingImageDirs.layoutSvg, `${faceKey}.svg`);
		const colorSvgPath = this.path.resolve(finalRenderingImageDirs.colorSvg, `${faceKey}.svg`);
		const colorReviewPngPath = this.path.resolve(finalRenderingImageDirs.colorReviewPng, `${faceKey}-reference-layout-color.png`);

		if (!faceState?.state || typeof faceState.state !== 'object' || Array.isArray(faceState.state)) {
			throw new Error(`Final Rendering requires canonical inline face state for ${faceKey}. Regenerate ${this.normalizePath(pipelineStatePath)} through the JSON-refactor intake path.`);
		}

		if (!normalizedComponentsPath || !(await this.exists(normalizedComponentsPath))) {
			report.warnings.push(this.missingInputWarning(faceKey, 'missing-normalized-components', normalizedComponentsPath));
			return;
		}

		const optionalAssignment = optionalAssignmentFromCanonicalState({
			tilesetId,
			faceKey,
			faceState,
			generatedOn,
		});
		const semanticMap = semanticMapFromCanonicalState({
			tilesetId,
			faceKey,
			faceState,
			generatedOn,
		});
		const normalizedComponents = await this.readJson(normalizedComponentsPath);
		normalizedComponents.sourceDefs = await this.readSourceDefs(normalizedComponents.sourceFile);
		const alignmentMap = alignmentMapFromCanonicalPartState({
			tilesetId,
			faceKey,
			faceState,
			generatedOn,
		});
		const referenceStructure = await this.readReferenceStructure({
			tilesetState,
		});
		const artifact = buildFinalRenderingCompositionArtifact({
			tilesetId,
			faceKey,
			generatedOn,
			tilesetState,
			optionalAssignmentPath: this.normalizePath(pipelineStatePath),
			optionalAssignment,
			semanticMapPath: this.normalizePath(pipelineStatePath),
			semanticMap,
			normalizedComponentsPath: this.normalizePath(normalizedComponentsPath),
			alignmentMapPath: null,
			referenceStructurePath: referenceStructure.path,
			addOptionalSvgPath: this.normalizePath(addOptionalSvgPath),
			layoutSvgPath: this.normalizePath(layoutSvgPath),
			colorSvgPath: this.normalizePath(colorSvgPath),
		});
		const addOptionalSvg = buildAddOptionalSvg({
			artifact,
			normalizedComponents,
		});
		const layoutResult = buildLayoutStep({
			artifact,
			normalizedComponents,
			alignmentMap,
			semanticMap,
			referenceStructure: referenceStructure.data,
		});
		artifact.steps.layout = layoutResult.step;
		const colorResult = buildColorStep({
			artifact,
			normalizedComponents,
			alignmentMap,
			semanticMap,
			referenceStructure: referenceStructure.data,
		});

		artifact.steps.color = colorResult.step;
		artifact.status = statusForSteps(artifact.steps);
		artifact.diagnostics.push(...layoutResult.diagnostics);
		artifact.diagnostics.push(...colorResult.diagnostics);
		artifact.summary.diagnosticCount = artifact.diagnostics.length;
		await this.writeText(addOptionalSvgPath, addOptionalSvg);
		await this.writeText(layoutSvgPath, layoutResult.svg);
		await this.writeText(colorSvgPath, colorResult.svg);
		const colorReviewPng = await this.writeColorReviewPng({
			outputPath: colorReviewPngPath,
			referenceStructure: referenceStructure.data,
			faceKey,
			normalizedComponents,
			layoutSvg: layoutResult.svg,
			colorSvg: colorResult.svg,
		});
		if (colorReviewPng) {
			artifact.steps.color.png = this.normalizePath(colorReviewPngPath);
		}
		faceState.artifacts = {
			...(faceState.artifacts || {}),
			finalRenderingColorSvg: this.normalizePath(colorSvgPath),
			...(colorReviewPng ? {
				finalRenderingColorReviewPng: this.normalizePath(colorReviewPngPath),
			} : {}),
		};
		if (!colorReviewPng) {
			delete faceState.artifacts.finalRenderingColorReviewPng;
		}

		report.faceCount += 1;
		report.optionalPartCount += artifact.summary.optionalPartCount;
		report.sourceRenderCount += artifact.summary.sourceRenderCount;
		report.generatedRenderCount += artifact.summary.generatedRenderCount;
		report.omittedRenderCount += artifact.summary.omittedRenderCount;
		report.unresolvedRenderCount += artifact.summary.unresolvedRenderCount;
		report.diagnosticCount += artifact.diagnostics.length;
		report.faces[faceKey] = {
			status: artifact.status,
			optionalPartCount: artifact.summary.optionalPartCount,
			sourceRenderCount: artifact.summary.sourceRenderCount,
			generatedRenderCount: artifact.summary.generatedRenderCount,
			omittedRenderCount: artifact.summary.omittedRenderCount,
			unresolvedRenderCount: artifact.summary.unresolvedRenderCount,
			diagnosticCount: artifact.diagnostics.length,
			svgs: {
				addOptional: this.normalizePath(addOptionalSvgPath),
				layout: this.normalizePath(layoutSvgPath),
				color: this.normalizePath(colorSvgPath),
			},
			pngs: {
				referenceLayoutColor: colorReviewPng ? this.normalizePath(colorReviewPngPath) : null,
			},
		};

	}

	async readReferenceStructure({ tilesetState }) {
		const inputPath = referenceStructurePathForSet(tilesetState.referenceSetId, this.output3dDir);
		const absolutePath = this.path.isAbsolute(inputPath)
			? inputPath
			: this.path.resolve(this.rootDir, inputPath);

		return {
			path: this.normalizePath(absolutePath),
			data: await this.readJson(absolutePath),
		};
	}

	missingInputWarning(faceKey, code, filePath) {
		return {
			faceKey,
			code,
			message: `No final rendering input exists at ${filePath ? this.normalizePath(filePath) : '(missing canonical artifact pointer)'}.`,
		};
	}

	async readJson(filePath) {
		return JSON.parse(await this.fs.readFile(filePath, 'utf8'));
	}

	async readSourceDefs(sourceFile) {
		if (!sourceFile) {
			return '';
		}

		const sourcePath = this.path.isAbsolute(sourceFile)
			? sourceFile
			: this.path.resolve(this.rootDir, sourceFile);

		if (!(await this.exists(sourcePath))) {
			return '';
		}

		return extractSvgDefs(await this.fs.readFile(sourcePath, 'utf8'));
	}

	async writeText(outputPath, content) {
		await this.fs.mkdir(this.path.dirname(outputPath), { recursive: true });
		await this.fs.writeFile(outputPath, content, 'utf8');
	}

	async writeJson(outputPath, content) {
		await this.fs.mkdir(this.path.dirname(outputPath), { recursive: true });
		await this.fs.writeFile(outputPath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
	}

	async writeColorReviewPng({
		outputPath,
		referenceStructure,
		faceKey,
		normalizedComponents,
		layoutSvg,
		colorSvg,
	}) {
		const referenceFace = referenceStructure?.faces?.[faceKey] || null;
		const referencePath = referenceFace?.sourceFile
			? this.path.resolve(this.rootDir, referenceFace.sourceFile)
			: null;
		const sourcePath = normalizedComponents?.sourceFile
			? this.path.resolve(this.rootDir, normalizedComponents.sourceFile)
			: null;

		if (!sourcePath || !(await this.exists(sourcePath)) || !referencePath || !(await this.exists(referencePath))) {
			return false;
		}

		const width = referenceFace.image?.width || 164;
		const height = referenceFace.image?.height || 238;
		const sourcePanel = await renderSourceSvgPanel(sourcePath, normalizedComponents.viewBox, height);
		const referencePanel = await sharp(referencePath)
			.resize(width, height, { fit: 'fill' })
			.ensureAlpha()
			.png()
			.toBuffer();
		const layoutPanel = await renderSvgPanel(layoutSvg, width, height);
		const colorPanel = await renderSvgPanel(colorSvg, width, height);
		const tileBoundsOverlay = Buffer.from(tileBoundsOverlaySvg({
			sourcePanelWidth: sourcePanel.width,
			panelWidth: width,
			panelHeight: height,
		}));

		await this.fs.mkdir(this.path.dirname(outputPath), { recursive: true });
		await sharp({
			create: {
				width: sourcePanel.width + (width * 3),
				height,
				channels: 4,
				background: { r: 255, g: 255, b: 255, alpha: 0 },
			},
		})
			.composite([
				{ input: sourcePanel.buffer, left: 0, top: 0 },
				{ input: referencePanel, left: sourcePanel.width, top: 0 },
				{ input: layoutPanel, left: sourcePanel.width + width, top: 0 },
				{ input: colorPanel, left: sourcePanel.width + (width * 2), top: 0 },
				{ input: tileBoundsOverlay, left: 0, top: 0 },
			])
			.png()
			.toFile(outputPath);

		return true;
	}

	async exists(filePath) {
		try {
			await this.fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	normalizePath(filePath) {
		return this.path.relative(this.rootDir, filePath).replaceAll('\\', '/');
	}

	resolveArtifactPath(artifactPath) {
		if (!artifactPath) {
			return null;
		}

		return this.path.isAbsolute(artifactPath)
			? artifactPath
			: this.path.resolve(this.rootDir, artifactPath);
	}
}

function semanticMapFromCanonicalState({
	tilesetId,
	faceKey,
	faceState,
	generatedOn,
}) {
	const canonicalBindings = canonicalSourceBindings(faceState);
	const assignments = Object.entries(faceState.state?.parts || {})
		.map(([partId, part]) => {
			const sourceComponentIds = canonicalSourceComponentIdsForPart(canonicalBindings, partId);
			const partAccepted = isReviewedPart(part);
			if (sourceComponentIds.length === 0 && !partAccepted) {
				return null;
			}

			return canonicalSourceAssignment({
				faceKey,
				partId,
				part,
				sourceComponentIds,
				strength: strongestSourceBindingStrengthForPart(canonicalBindings, partId),
				generatedOn,
			});
		})
		.filter(Boolean);

	return {
		tilesetId,
		faceKey,
		referenceSetId: null,
		status: null,
		reviewStatus: null,
		generatedOn: null,
		updatedOn: generatedOn,
		bindings: canonicalBindings,
		parts: canonicalSourcePartStates(faceState),
		assignments,
		diagnostics: [],
	};
}

function canonicalSourceAssignment({
	faceKey,
	partId,
	part,
	sourceComponentIds,
	strength,
	generatedOn,
}) {
	return {
		assignmentId: `assign.${faceKey}.${partId}`,
		sourcePartId: partId,
		referencePartId: partId,
		globalPartId: part.globalPartId || `${faceKey}:${partId}`,
		role: part.role || null,
		contentKind: part.contentKind || null,
		colorStrategy: part.colorStrategy || null,
		sourceComponentIds,
		referenceComponentIds: [],
		alignmentGroupId: null,
		alignmentIds: [],
		alignmentCandidateId: null,
		assignmentType: 'source',
		strength: sourceComponentIds.length ? canonicalSourceStrength(strength) : 'none',
		strategy: part.alignmentStrategy || 'source-assignment-acceptance',
		score: part.alignmentScore ?? null,
		scoreKind: part.alignmentScoreKind || null,
		alignmentTransform: part.alignmentTransform || null,
		alignmentSourceBounds: part.alignmentSourceBounds || null,
		alignmentTargetBounds: part.alignmentTargetBounds || null,
		alignmentAlignedBounds: part.alignmentAlignedBounds || null,
		reviewStatus: part.accepted ? 'accepted' : null,
		updatedOn: part.updatedOn || generatedOn,
	};
}

function canonicalSourceBindings(faceState) {
	return Object.fromEntries(Object.entries(faceState.state?.bindings || {})
		.map(([componentId, binding]) => [componentId, {
			...(binding.partId ? { partId: binding.partId } : {}),
			source: binding.source || '',
			strength: canonicalSourceStrength(binding.strength),
			reviewStatus: binding.reviewStatus || (binding.strength === 'accepted' || binding.strength === 'strong' ? 'reviewed' : binding.strength === 'none' ? 'needs-review' : 'inferred'),
			...(binding.updatedOn ? { updatedOn: binding.updatedOn } : {}),
			...(binding.acceptedOn ? { acceptedOn: binding.acceptedOn } : {}),
		}])
		.sort((left, right) => left[0].localeCompare(right[0])));
}

function canonicalSourcePartStates(faceState) {
	return Object.fromEntries(Object.entries(faceState.state?.parts || {})
		.filter(([, part]) => isReviewedPart(part))
		.map(([partId, part]) => [partId, {
			state: 'unbound',
			strength: 'none',
			source: 'part-review',
			reviewStatus: 'accepted',
			...(part.updatedOn ? { updatedOn: part.updatedOn } : {}),
		}])
		.sort((left, right) => left[0].localeCompare(right[0])));
}

function isReviewedPart(part) {
	return Boolean(part?.accepted);
}

function canonicalSourceComponentIdsForPart(bindings, partId) {
	return Object.entries(bindings || {})
		.filter(([, binding]) => binding?.partId === partId && binding.strength !== 'none')
		.map(([componentId]) => componentId)
		.sort((left, right) => left.localeCompare(right));
}

function strongestSourceBindingStrengthForPart(bindings, partId) {
	const strengths = Object.values(bindings || {})
		.filter((binding) => binding?.partId === partId && binding.strength !== 'none')
		.map((binding) => binding.strength);

	if (strengths.includes('accepted')) {
		return 'accepted';
	}
	if (strengths.includes('strong')) {
		return 'strong';
	}
	return strengths.includes('tentative') ? 'tentative' : 'none';
}

function optionalAssignmentFromCanonicalState({ tilesetId, faceKey, faceState, generatedOn }) {
	const optionalParts = Object.fromEntries(Object.entries(faceState.state?.parts || {})
		.filter(([, part]) => part?.optional === true)
		.map(([partId, part]) => [partId, {
			partId,
			contentKind: part.contentKind || null,
			role: part.role || null,
			text: part.text || null,
			sourceState: canonicalSourceComponentIdsForPart(faceState.state?.bindings || {}, partId).length > 0
				? 'candidate-found'
				: isReviewedPart(part)
					? 'source-absent'
					: 'needs-review',
			hint: part.hint || null,
			suggestedComponentIds: [],
			suggestedBounds: null,
			strength: strongestSourceBindingStrengthForPart(canonicalSourceBindings(faceState), partId),
			reviewStatus: part.accepted ? 'accepted' : 'inferred',
			candidates: [],
		}]));

	return {
		schemaVersion: 1,
		tilesetId,
		faceKey,
		generatedOn,
		status: 'canonical',
		face: describeFace(faceKey),
		optionalParts,
		diagnostics: [],
	};
}

function alignmentMapFromCanonicalPartState({ tilesetId, faceKey, faceState, generatedOn }) {
	const candidates = Object.entries(faceState.state?.parts || {})
		.filter(([, part]) => part?.alignmentTransform?.matrix)
		.map(([partId, part]) => ({
			alignmentId: `align.${faceKey}.${partId}.canonical-part`,
			alignmentGroupId: `align-group.${faceKey}.${partId}`,
			sourceComponentIds: [],
			referenceComponentIds: [],
			referencePartCandidates: [partId],
			sourceBounds: part.alignmentSourceBounds || null,
			targetBounds: part.alignmentTargetBounds || null,
			alignedBounds: part.alignmentAlignedBounds || null,
			transform: part.alignmentTransform || null,
			matchStatus: 'matched',
			strategy: part.alignmentStrategy || 'canonical-part-alignment',
			score: part.alignmentScore ?? null,
			scoreKind: part.alignmentScoreKind || null,
			reviewStatus: part.accepted ? 'accepted' : 'inferred',
		}));

	return {
		schemaVersion: 1,
		tilesetId,
		faceKey,
		generatedOn,
		status: 'canonical',
		referenceSetId: null,
		candidates,
		diagnostics: [],
	};
}

function canonicalSourceStrength(strength) {
	if (strength === 'accepted' || strength === 'strong' || strength === 'none') {
		return strength;
	}
	if (strength === 'tentative') {
		return 'tentative';
	}

	throw new Error(`Invalid canonical source binding strength: ${strength || '(missing)'}`);
}

/**
 * Builds the first final-rendering composition artifact: add optional parts.
 *
 * @param {FinalRenderingCompositionArtifactOptions} options - Inputs needed to compose optional render decisions.
 * @returns {FinalRenderingCompositionArtifact} Final rendering composition artifact.
 */
export function buildFinalRenderingCompositionArtifact({
	tilesetId,
	faceKey,
	generatedOn,
	tilesetState,
	optionalAssignmentPath,
	optionalAssignment,
	semanticMapPath,
	semanticMap,
	normalizedComponentsPath = null,
	alignmentMapPath = null,
	referenceStructurePath = null,
	addOptionalSvgPath = null,
	layoutSvgPath = null,
	colorSvgPath = null,
}) {
	const face = optionalAssignment.face || describeFace(faceKey);
	const outputOptions = outputOptionsForFace({
		tilesetOutputOptions: effectiveTilesetOutputOptions(tilesetState),
		faceOutputOptions: optionalAssignment.outputOptions,
		faceKey,
		suitId: face.family,
	});
	const optionalParts = Object.fromEntries(Object.entries(optionalAssignment.optionalParts || {})
		.map(([partId, optionalPart]) => [
			partId,
			composeOptionalPart({
				partId,
				optionalPart,
				outputOptions,
				semanticMap,
				face,
			}),
		]));
	const diagnostics = Object.values(optionalParts)
		.filter((part) => part.renderKind === 'unresolved')
		.map((part) => ({
			level: 'warning',
			code: 'unresolved-optional-render-part',
			partId: part.partId,
			message: `Optional part ${part.partId} is enabled for output but has no source binding or generated-part decision.`,
		}));
	const status = diagnostics.some((diagnostic) => diagnostic.level === 'warning')
		? 'needs-review'
		: 'ready';

	return {
		schemaVersion: 1,
		tilesetId,
		faceKey,
		generatedOn,
		status,
		face,
		inputs: {
			optionalPartAssignment: {
				path: optionalAssignmentPath,
				status: optionalAssignment.status || null,
				generatedOn: optionalAssignment.generatedOn || null,
			},
			semanticMap: {
				path: semanticMapPath,
				status: semanticMap.status || null,
				generatedOn: semanticMap.generatedOn || null,
				acceptedOn: semanticMap.acceptedOn || null,
			},
			normalizedComponents: {
				path: normalizedComponentsPath,
			},
			alignmentMap: {
				path: alignmentMapPath,
			},
			referenceStructure: {
				path: referenceStructurePath,
			},
			outputOptions: {
				suitId: face.family,
				source: outputOptions.source,
				layout: outputOptions.layout,
				color: outputOptions.color,
				transform: outputOptions.transform,
				artwork: outputOptions.artwork,
			},
		},
		steps: {
			addOptional: {
				status,
				svg: addOptionalSvgPath,
				parts: optionalParts,
			},
			layout: {
				status: 'not-run',
				svg: layoutSvgPath,
			},
			color: {
				status: 'not-run',
				svg: colorSvgPath,
			},
		},
		summary: summarizeOptionalParts(optionalParts, diagnostics),
		diagnostics,
	};
}

/**
 * Renders the prepared-viewBox layout step from accepted semantic assignments and alignment transforms.
 *
 * @param {FinalRenderingLayoutStepOptions} options - Inputs needed to render source and generated parts in prepared space.
 * @returns {FinalRenderingLayoutStepResult} Layout step data, SVG, and diagnostics.
 */
export function buildLayoutStep({
	artifact,
	normalizedComponents,
	alignmentMap,
	semanticMap,
	referenceStructure,
}) {
	const faceReference = referenceStructure?.faces?.[artifact.faceKey] || null;
	const componentsById = new Map((normalizedComponents.components || [])
		.map((component) => [component.componentId, component]));
	const negativeSpaceComponents = (normalizedComponents.components || [])
		.map(normalizeNegativeSpaceComponent)
		.filter((component) => component.negativeSpaceCandidate && component.pathData);
	const candidatesById = new Map((alignmentMap.candidates || [])
		.map((candidate) => [candidate.alignmentId || candidate.candidateId, candidate]));
	const layoutOptions = artifact.inputs?.outputOptions?.layout || {};
	const parts = {};
	const diagnostics = [];
	const sourcePaths = [];
	const generatedPaths = [];
	const alternateSourcePaths = [];
	const alternateGeneratedPaths = [];

	for (const assignment of semanticMap.assignments || []) {
		if (!shouldLayoutSourceAssignment(assignment) || !shouldRenderSourceAssignment(artifact, assignment)) {
			continue;
		}

		const idMatchedCandidates = uniqueValues([
			assignment.alignmentCandidateId,
			...(assignment.alignmentIds || []),
		])
			.map((alignmentId) => candidatesById.get(alignmentId))
			.filter(Boolean);
		const assignmentCandidates = idMatchedCandidates.length > 0
			? idMatchedCandidates
			: candidatesForSourceAssignment(assignment, alignmentMap.candidates || []);
		const candidate = candidatesById.get(assignment.alignmentCandidateId)
			|| candidatesById.get((assignment.alignmentIds || [])[0])
			|| assignmentCandidates[0];
		const partId = assignment.referencePartId || assignment.sourcePartId;

		const layoutTransform = layoutTransformForSourceAssignment({
			assignment,
			artifact,
			normalizedComponents,
			componentsById,
			referenceStructure,
			layoutOptions,
			candidate,
		});

		if (!layoutTransform?.matrix) {
			diagnostics.push({
				level: 'warning',
				code: 'missing-layout-alignment-transform',
				partId,
				assignmentId: assignment.assignmentId || null,
				message: `Source part ${partId} cannot be laid out because its alignment transform is missing.`,
			});
			parts[partId] = layoutPartRecord({
				partId,
				assignment,
				status: 'blocked',
				renderKind: 'source',
				source: 'alignment-map',
			});
			continue;
		}

		const artworkMirror = artworkMirrorForAssignment({
			artifact,
			assignment,
			componentsById,
			layoutTransform,
		});
		const renderedComponentIds = [];
		for (const componentId of renderOrderedComponentIds(assignment.sourceComponentIds, componentsById)) {
			const component = componentsById.get(componentId);
			if (!component?.pathData) {
				diagnostics.push({
					level: 'warning',
					code: 'missing-layout-source-component',
					partId,
					componentId,
					message: `Source component ${componentId} cannot be laid out because its path data is missing.`,
				});
				continue;
			}

			const renderedTransform = applyArtworkMirrorToTransform(layoutTransform.matrix, artworkMirror);
			renderedComponentIds.push(componentId);
			sourcePaths.push(layoutSourceComponentPath({
				component,
				partId,
				transform: renderedTransform,
				layoutSource: layoutTransform.source,
				negativeSpaceComponents,
				extraAttributes: artworkMirror ? { 'data-artwork-mirror': 'x' } : {},
			}));
		}

		parts[partId] = layoutPartRecord({
			partId,
			assignment,
			status: renderedComponentIds.length > 0 ? 'ready' : 'blocked',
			renderKind: 'source',
			source: layoutTransform.source,
			sourceComponentIds: renderedComponentIds,
			alignmentCandidateId: candidate?.alignmentId || candidate?.candidateId || null,
			transform: {
				...(candidate?.transform || {}),
				matrix: applyArtworkMirrorToTransform(layoutTransform.matrix, artworkMirror),
				source: layoutTransform.source,
				scaleMode: layoutTransform.scaleMode || null,
				...(artworkMirror ? { reflectX: true } : {}),
			},
			targetBounds: layoutTransform.targetBounds || candidate.targetBounds || null,
			alignedBounds: mirrorBoundsIfNeeded(layoutTransform.alignedBounds || candidate.alignedBounds || null, artworkMirror),
		});
	}

	for (const optionalSourceAssignment of optionalSourceAssignmentsForLayout(artifact, semanticMap)) {
		const partId = optionalSourceAssignment.sourcePartId;
		const layoutTransform = fallbackLayoutTransformForOptionalSource(parts);
		const renderedComponentIds = [];

		if (!layoutTransform?.matrix) {
			diagnostics.push({
				level: 'warning',
				code: 'missing-layout-optional-source-transform',
				partId,
				message: `Source optional part ${partId} cannot be laid out because no source layout transform is available.`,
			});
			parts[partId] = layoutPartRecord({
				partId,
				assignment: optionalSourceAssignment,
				status: 'blocked',
				renderKind: 'source',
				source: 'optional-source-reservation',
				sourceComponentIds: optionalSourceAssignment.sourceComponentIds,
			});
			continue;
		}

		for (const componentId of renderOrderedComponentIds(optionalSourceAssignment.sourceComponentIds, componentsById)) {
			const component = componentsById.get(componentId);

			if (!component?.pathData) {
				diagnostics.push({
					level: 'warning',
					code: 'missing-layout-source-component',
					partId,
					componentId,
					message: `Source component ${componentId} cannot be laid out because its path data is missing.`,
				});
				continue;
			}

			renderedComponentIds.push(componentId);
			sourcePaths.push(layoutSourceComponentPath({
				component,
				partId,
				transform: layoutTransform.matrix,
				layoutSource: layoutTransform.source,
				negativeSpaceComponents,
			}));
		}

		parts[partId] = layoutPartRecord({
			partId,
			assignment: optionalSourceAssignment,
			status: renderedComponentIds.length > 0 ? 'ready' : 'blocked',
			renderKind: 'source',
			source: layoutTransform.source,
			sourceComponentIds: renderedComponentIds,
			transform: {
				matrix: layoutTransform.matrix,
				source: layoutTransform.source,
				scaleMode: layoutTransform.scaleMode || null,
			},
			targetBounds: layoutTransform.targetBounds || null,
			alignedBounds: transformBoundsForComponentIds(renderedComponentIds, componentsById, layoutTransform.matrix),
		});
	}

	for (const optionalSourceAssignment of alternateOptionalSourceAssignmentsForLayout(artifact, semanticMap)) {
		const partId = optionalSourceAssignment.sourcePartId;
		const idMatchedCandidates = uniqueValues([
			optionalSourceAssignment.alignmentCandidateId,
			...(optionalSourceAssignment.alignmentIds || []),
		])
			.map((alignmentId) => candidatesById.get(alignmentId))
			.filter(Boolean);
		const assignmentCandidates = idMatchedCandidates.length > 0
			? idMatchedCandidates
			: candidatesForSourceAssignment(optionalSourceAssignment, alignmentMap.candidates || []);
		const candidate = candidatesById.get(optionalSourceAssignment.alignmentCandidateId)
			|| candidatesById.get((optionalSourceAssignment.alignmentIds || [])[0])
			|| assignmentCandidates[0];
		const layoutTransform = layoutTransformForSourceAssignment({
			assignment: optionalSourceAssignment,
			artifact,
			normalizedComponents,
			componentsById,
			referenceStructure,
			layoutOptions,
			candidate,
		});
		const renderedComponentIds = [];

		if (!layoutTransform?.matrix) {
			parts[partId] = {
				...(parts[partId] || {}),
				alternates: {
					...(parts[partId]?.alternates || {}),
					source: {
						status: 'blocked',
						renderKind: 'source',
						source: 'source-assignment',
						sourceComponentIds: optionalSourceAssignment.sourceComponentIds,
					},
				},
			};
			continue;
		}

		for (const componentId of renderOrderedComponentIds(optionalSourceAssignment.sourceComponentIds, componentsById)) {
			const component = componentsById.get(componentId);
			if (!component?.pathData) {
				continue;
			}

			renderedComponentIds.push(componentId);
			alternateSourcePaths.push(layoutSourceComponentPath({
				component,
				partId,
				transform: layoutTransform.matrix,
				layoutSource: layoutTransform.source,
				negativeSpaceComponents,
				extraAttributes: { 'data-render-alternate': 'source' },
			}));
		}

		parts[partId] = {
			...(parts[partId] || {}),
			alternates: {
				...(parts[partId]?.alternates || {}),
				source: {
					status: renderedComponentIds.length > 0 ? 'ready' : 'blocked',
					renderKind: 'source',
					source: layoutTransform.source,
					sourceComponentIds: renderedComponentIds,
					transform: {
						matrix: layoutTransform.matrix,
						source: layoutTransform.source,
						scaleMode: layoutTransform.scaleMode || null,
					},
					targetBounds: layoutTransform.targetBounds || null,
					alignedBounds: transformBoundsForComponentIds(renderedComponentIds, componentsById, layoutTransform.matrix),
				},
			},
		};
	}

	for (const part of Object.values(artifact.steps.addOptional.parts || {})) {
		if (part.renderKind !== 'generated') {
			continue;
		}

		const referencePart = faceReference?.parts?.[part.partId] || null;
		const targetBounds = referencePart?.targetBounds || null;
		if (!targetBounds) {
			diagnostics.push({
				level: 'warning',
				code: 'missing-layout-reference-target-bounds',
				partId: part.partId,
				message: `Generated part ${part.partId} cannot be laid out because reference target bounds are missing.`,
			});
			parts[part.partId] = {
				partId: part.partId,
				status: 'blocked',
			reviewStatus: part.accepted ? 'accepted' : 'inferred',
			renderKind: 'generated',
			source: 'reference-structure',
			targetBounds: null,
			...(parts[part.partId]?.alternates ? { alternates: parts[part.partId].alternates } : {}),
		};
			continue;
		}

		const generatedPart = generatedPartFromReferencePart(part, referencePart);
		const generatedPath = generatedPartToSvgPath({
			part: generatedPart,
			face: artifact.face,
			targetBounds,
		});
		if (generatedPath) {
			generatedPaths.push(generatedPath);
		}
		parts[part.partId] = {
			partId: part.partId,
			status: generatedPath ? 'ready' : 'blocked',
			reviewStatus: part.accepted ? 'accepted' : 'inferred',
			renderKind: 'generated',
			source: 'reference-structure',
			targetBounds,
			...(parts[part.partId]?.alternates ? { alternates: parts[part.partId].alternates } : {}),
		};
	}

	for (const part of Object.values(artifact.steps.addOptional.parts || {})) {
		if (!part.alternates?.generated) {
			continue;
		}

		const referencePart = faceReference?.parts?.[part.partId] || null;
		const targetBounds = referencePart?.targetBounds || null;
		const generatedPart = generatedPartFromReferencePart({
			...part,
			renderKind: 'alternate-generated',
		}, referencePart);
		const generatedPath = targetBounds
			? generatedPartToSvgPath({
				part: generatedPart,
				face: artifact.face,
				targetBounds,
			})
			: null;

		if (generatedPath) {
			alternateGeneratedPaths.push(generatedPath);
		}

		parts[part.partId] = {
			...(parts[part.partId] || {}),
			alternates: {
				...(parts[part.partId]?.alternates || {}),
				generated: {
					status: generatedPath ? 'ready' : 'blocked',
					renderKind: 'generated',
					source: 'reference-structure',
					targetBounds: targetBounds || null,
				},
			},
		};
	}

	const status = diagnostics.some((diagnostic) => diagnostic.level === 'warning')
		? 'needs-review'
		: 'ready';
	const step = {
		status,
		svg: artifact.steps.layout.svg,
		viewBox: '0 0 94 136',
		parts,
	};
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 94 136">
	<title>${escapeText(artifact.faceKey)} layout render step</title>
	<desc>Intermediate prepared-space SVG emitted by final rendering composition after layout.</desc>
	<g id="layout-source-parts">
${indent(sourcePaths.join('\n'), 2)}
	</g>
	<g id="layout-generated-parts">
${indent(generatedPaths.join('\n'), 2)}
	</g>
</svg>
`;

	return {
		step,
		svg,
		diagnostics,
	};
}

/**
 * Renders the colored prepared-viewBox step from layout decisions and source/reference paint policy.
 *
 * @param {FinalRenderingColorStepOptions} options - Inputs needed to color laid-out source and generated parts.
 * @returns {FinalRenderingColorStepResult} Color step data, SVG, and diagnostics.
 */
export function buildColorStep({
	artifact,
	normalizedComponents,
	alignmentMap,
	semanticMap,
	referenceStructure,
}) {
	const colorContext = makeColorContext({
		artifact,
		normalizedComponents,
		semanticMap,
		referenceStructure,
	});
	const faceReference = referenceStructure?.faces?.[artifact.faceKey] || null;
	const componentsById = new Map((normalizedComponents.components || [])
		.map((component) => [component.componentId, component]));
	const negativeSpaceComponents = (normalizedComponents.components || [])
		.map(normalizeNegativeSpaceComponent)
		.filter((component) => component.negativeSpaceCandidate && component.pathData);
	const candidatesById = new Map((alignmentMap.candidates || [])
		.map((candidate) => [candidate.alignmentId || candidate.candidateId, candidate]));
	const layoutOptions = artifact.inputs?.outputOptions?.layout || {};
	const parts = {};
	const diagnostics = [];
	const sourcePaths = [];
	const generatedPaths = [];
	const alternateSourcePaths = [];
	const alternateGeneratedPaths = [];

	for (const assignment of semanticMap.assignments || []) {
		if (!shouldLayoutSourceAssignment(assignment) || !shouldRenderSourceAssignment(artifact, assignment)) {
			continue;
		}

		const idMatchedCandidates = uniqueValues([
			assignment.alignmentCandidateId,
			...(assignment.alignmentIds || []),
		])
			.map((alignmentId) => candidatesById.get(alignmentId))
			.filter(Boolean);
		const assignmentCandidates = idMatchedCandidates.length > 0
			? idMatchedCandidates
			: candidatesForSourceAssignment(assignment, alignmentMap.candidates || []);
		const candidate = candidatesById.get(assignment.alignmentCandidateId)
			|| candidatesById.get((assignment.alignmentIds || [])[0])
			|| assignmentCandidates[0];
		const partId = assignment.referencePartId || assignment.sourcePartId;
		const layoutTransform = layoutTransformForSourceAssignment({
			assignment,
			artifact,
			normalizedComponents,
			componentsById,
			referenceStructure,
			layoutOptions,
			candidate,
		});
		const componentRecords = {};
		const renderedComponentIds = [];

		if (!layoutTransform?.matrix) {
			diagnostics.push({
				level: 'warning',
				code: 'missing-color-layout-transform',
				partId,
				assignmentId: assignment.assignmentId || null,
				message: `Source part ${partId} cannot be colored because its layout transform is missing.`,
			});
			parts[partId] = colorPartRecord({
				partId,
				assignment,
				status: 'blocked',
				renderKind: 'source',
				colorPolicy: colorContext.policy,
				components: componentRecords,
			});
			continue;
		}

		const artworkMirror = artworkMirrorForAssignment({
			artifact,
			assignment,
			componentsById,
			layoutTransform,
		});
		for (const componentId of renderOrderedComponentIds(assignment.sourceComponentIds, componentsById)) {
			const component = componentsById.get(componentId);
			if (!component?.pathData) {
				diagnostics.push({
					level: 'warning',
					code: 'missing-color-source-component',
					partId,
					componentId,
					message: `Source component ${componentId} cannot be colored because its path data is missing.`,
				});
				continue;
			}

			const renderedTransform = applyArtworkMirrorToTransform(layoutTransform.matrix, artworkMirror);
			const colorDecision = colorDecisionForSourceComponent({
				component,
				assignment,
				candidate,
				colorContext,
			});
			renderedComponentIds.push(componentId);
			componentRecords[componentId] = colorDecision;
			sourcePaths.push(layoutSourceComponentPath({
				component,
				partId,
				transform: renderedTransform,
				layoutSource: layoutTransform.source,
				negativeSpaceComponents,
				color: colorDecision.outputPaint,
				extraAttributes: {
					'data-color-policy': colorDecision.colorPolicy,
					'data-color-mode': colorDecision.colorMode,
					'data-hue-grouping': colorDecision.hueGrouping,
					'data-source-paint': colorDecision.sourcePaint,
					...(colorDecision.paletteSourcePaint !== colorDecision.sourcePaint ? { 'data-palette-source-paint': colorDecision.paletteSourcePaint } : {}),
					'data-target-paint': colorDecision.targetPaint,
					...(artworkMirror ? { 'data-artwork-mirror': 'x' } : {}),
				},
			}));
		}

		parts[partId] = colorPartRecord({
			partId,
			assignment,
			status: renderedComponentIds.length > 0 ? 'ready' : 'blocked',
			renderKind: 'source',
			colorPolicy: colorContext.policy,
			sourceComponentIds: renderedComponentIds,
			components: componentRecords,
		});
	}

	for (const layoutPart of optionalSourceLayoutPartsForColor(artifact, semanticMap)) {
		const partId = layoutPart.partId;
		const optionalPart = artifact.steps.addOptional.parts?.[partId] || {};
		const assignment = {
			assignmentId: null,
			sourcePartId: partId,
			referencePartId: partId,
			contentKind: optionalPart.contentKind || null,
			role: optionalPart.role || null,
			assignmentType: 'source',
			strategy: 'optional-source-reservation',
			sourceComponentIds: layoutPart.sourceComponentIds || [],
			referenceComponentIds: [],
			reviewStatus: optionalPart.reviewStatus || 'inferred',
		};
		const componentRecords = {};
		const renderedComponentIds = [];

		if (!layoutPart.transform?.matrix) {
			diagnostics.push({
				level: 'warning',
				code: 'missing-color-optional-source-transform',
				partId,
				message: `Source optional part ${partId} cannot be colored because its layout transform is missing.`,
			});
			parts[partId] = colorPartRecord({
				partId,
				assignment,
				status: 'blocked',
				renderKind: 'source',
				colorPolicy: colorContext.policy,
				components: componentRecords,
			});
			continue;
		}

		for (const componentId of renderOrderedComponentIds(layoutPart.sourceComponentIds, componentsById)) {
			const component = componentsById.get(componentId);

			if (!component?.pathData) {
				diagnostics.push({
					level: 'warning',
					code: 'missing-color-source-component',
					partId,
					componentId,
					message: `Source component ${componentId} cannot be colored because its path data is missing.`,
				});
				continue;
			}

			const colorDecision = colorDecisionForSourceComponent({
				component,
				assignment,
				candidate: null,
				colorContext,
			});
			renderedComponentIds.push(componentId);
			componentRecords[componentId] = colorDecision;
			sourcePaths.push(layoutSourceComponentPath({
				component,
				partId,
				transform: layoutPart.transform.matrix,
				layoutSource: layoutPart.source,
				negativeSpaceComponents,
				color: colorDecision.outputPaint,
				extraAttributes: {
					'data-color-policy': colorDecision.colorPolicy,
					'data-color-mode': colorDecision.colorMode,
					'data-hue-grouping': colorDecision.hueGrouping,
					'data-source-paint': colorDecision.sourcePaint,
					...(colorDecision.paletteSourcePaint !== colorDecision.sourcePaint ? { 'data-palette-source-paint': colorDecision.paletteSourcePaint } : {}),
					'data-target-paint': colorDecision.targetPaint,
				},
			}));
		}

		parts[partId] = colorPartRecord({
			partId,
			assignment,
			status: renderedComponentIds.length > 0 ? 'ready' : 'blocked',
			renderKind: 'source',
			colorPolicy: colorContext.policy,
			sourceComponentIds: renderedComponentIds,
			components: componentRecords,
		});
	}

	for (const layoutPart of alternateSourceLayoutPartsForColor(artifact)) {
		const partId = layoutPart.partId;
		const alternate = layoutPart.alternates.source;
		const assignment = assignmentForPart(semanticMap, partId) || {
			sourcePartId: partId,
			referencePartId: partId,
			sourceComponentIds: alternate.sourceComponentIds || [],
			contentKind: layoutPart.contentKind || null,
			role: layoutPart.role || null,
		};
		const componentRecords = {};
		const renderedComponentIds = [];

		for (const componentId of renderOrderedComponentIds(alternate.sourceComponentIds || [], componentsById)) {
			const component = componentsById.get(componentId);
			if (!component?.pathData || !alternate.transform?.matrix) {
				continue;
			}

			const colorDecision = colorDecisionForSourceComponent({
				component,
				assignment,
				candidate: null,
				colorContext,
			});

			renderedComponentIds.push(componentId);
			componentRecords[componentId] = colorDecision;
			alternateSourcePaths.push(layoutSourceComponentPath({
				component,
				partId,
				transform: alternate.transform.matrix,
				layoutSource: alternate.source,
				negativeSpaceComponents,
				color: colorDecision.outputPaint,
				extraAttributes: {
					'data-color-policy': colorDecision.colorPolicy,
					'data-render-alternate': 'source',
				},
			}));
		}

		parts[partId] = {
			...(parts[partId] || {}),
			alternates: {
				...(parts[partId]?.alternates || {}),
				source: {
					...alternate,
					status: renderedComponentIds.length > 0 ? 'ready' : 'blocked',
					colorPolicy: colorContext.policy,
					components: componentRecords,
					sourceComponentIds: renderedComponentIds,
				},
			},
		};
	}

	for (const layoutPart of Object.values(artifact.steps.layout?.parts || {})) {
		if (layoutPart.renderKind !== 'generated') {
			continue;
		}

		const addOptionalPart = artifact.steps.addOptional.parts?.[layoutPart.partId] || {};
		const referencePart = faceReference?.parts?.[layoutPart.partId] || null;
		const generatedPart = generatedPartFromReferencePart({
			...addOptionalPart,
			partId: layoutPart.partId,
		}, referencePart);
		const generatedColor = generatedColorForPart(generatedPart, referencePart);
		const generatedPath = generatedPartToSvgPath({
			part: {
				...generatedPart,
				fill: generatedColor,
			},
			face: artifact.face,
			targetBounds: layoutPart.targetBounds,
		});
		if (generatedPath) {
			generatedPaths.push(generatedPath);
		}
		parts[layoutPart.partId] = {
			partId: layoutPart.partId,
			status: generatedPath ? 'ready' : 'blocked',
			reviewStatus: addOptionalPart.reviewStatus || 'inferred',
			renderKind: 'generated',
			colorPolicy: 'generated',
			outputPaint: generatedColor,
			targetBounds: layoutPart.targetBounds || null,
			...(parts[layoutPart.partId]?.alternates ? { alternates: parts[layoutPart.partId].alternates } : {}),
			provenance: {
				stage: 'final-rendering-composition',
				step: 'color',
			},
		};
	}

	for (const layoutPart of Object.values(artifact.steps.layout?.parts || {})) {
		if (!layoutPart.alternates?.generated) {
			continue;
		}

		const addOptionalPart = artifact.steps.addOptional.parts?.[layoutPart.partId] || {};
		const referencePart = faceReference?.parts?.[layoutPart.partId] || null;
		const targetBounds = layoutPart.alternates.generated.targetBounds || referencePart?.targetBounds || null;
		const generatedPart = generatedPartFromReferencePart({
			...addOptionalPart,
			renderKind: 'alternate-generated',
		}, referencePart);
		const generatedColor = generatedColorForPart(generatedPart, referencePart);
		const generatedPath = targetBounds
			? generatedPartToSvgPath({
				part: {
					...generatedPart,
					fill: generatedColor,
				},
				face: artifact.face,
				targetBounds,
			})
			: null;

		if (generatedPath) {
			alternateGeneratedPaths.push(generatedPath);
		}

		parts[layoutPart.partId] = {
			...(parts[layoutPart.partId] || {}),
			alternates: {
				...(parts[layoutPart.partId]?.alternates || {}),
				generated: {
					status: generatedPath ? 'ready' : 'blocked',
					renderKind: 'generated',
					colorPolicy: 'generated',
					outputPaint: generatedColor,
					targetBounds,
				},
			},
		};
	}

	const status = diagnostics.some((diagnostic) => diagnostic.level === 'warning')
		? 'needs-review'
		: 'ready';
	const step = {
		status,
		svg: artifact.steps.color.svg,
		viewBox: '0 0 94 136',
		policy: colorContext.policy,
		parts,
	};
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 94 136">
	<title>${escapeText(artifact.faceKey)} color render step</title>
	<desc>Intermediate prepared-space SVG emitted by final rendering composition after coloring.</desc>
	<g id="color-source-parts">
${indent(sourcePaths.join('\n'), 2)}
	</g>
	<g id="color-generated-parts">
${indent(generatedPaths.join('\n'), 2)}
	</g>
</svg>
`;

	return {
		step,
		svg,
		diagnostics,
	};
}

async function renderSvgPanel(svg, width, height) {
	return sharp(Buffer.from(svg))
		.resize(width, height, {
			fit: 'fill',
			background: { r: 255, g: 255, b: 255, alpha: 0 },
		})
		.ensureAlpha()
		.png()
		.toBuffer();
}

async function renderSourceSvgPanel(sourcePath, viewBox, targetHeight) {
	const metadata = await sharp(sourcePath).metadata();
	const sourceWidth = metadata.width || viewBox?.width || 1;
	const sourceHeight = metadata.height || viewBox?.height || 1;
	const width = Math.max(1, Math.round(targetHeight * (sourceWidth / sourceHeight)));
	const buffer = await sharp(sourcePath)
		.resize(width, targetHeight, { fit: 'fill' })
		.ensureAlpha()
		.png()
		.toBuffer();

	return { buffer, width };
}

function tileBoundsOverlaySvg({ sourcePanelWidth, panelWidth, panelHeight }) {
	const totalWidth = sourcePanelWidth + (panelWidth * 3);
	const boxes = [0, 1, 2].map((index) => {
		const left = sourcePanelWidth + (panelWidth * index) + 0.5;

		return `<rect x="${left}" y="0.5" width="${panelWidth - 1}" height="${panelHeight - 1}" fill="none" stroke="#111111" stroke-width="1"/>`;
	}).join('\n');

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${panelHeight}" viewBox="0 0 ${totalWidth} ${panelHeight}">
${boxes}
</svg>`;
}

/**
 * Renders the source-space SVG output of the addOptional composition step.
 *
 * @param {FinalRenderingAddOptionalSvgOptions} options - Inputs needed to render the step SVG.
 * @returns {string} SVG source for the addOptional step.
 */
export function buildAddOptionalSvg({ artifact, normalizedComponents }) {
	const viewBox = normalizedComponents.viewBox || normalizedComponents.alignmentBounds || { minX: 0, minY: 0, width: 1, height: 1 };
	const minX = viewBox.minX ?? viewBox.left ?? 0;
	const minY = viewBox.minY ?? viewBox.top ?? 0;
	const width = viewBox.width || 1;
	const height = viewBox.height || 1;
	const componentsById = new Map((normalizedComponents.components || [])
		.map((component) => [component.componentId, component]));
	const parts = Object.values(artifact.steps.addOptional.parts || {});
	const sourcePaths = parts
		.filter((part) => part.renderKind === 'source')
		.flatMap((part) => part.sourceComponentIds.map((componentId) => ({
			part,
			component: componentsById.get(componentId),
		})))
		.filter((item) => item.component?.pathData)
		.map(({ part, component }) => componentToSvgPath(component, {
			'data-render-part-id': part.partId,
			'data-render-kind': part.renderKind,
		}));
	const generatedText = parts
		.filter((part) => part.renderKind === 'generated')
		.map((part) => generatedPartToSvgPath({
			part,
			face: artifact.face,
			viewBox: { minX, minY, width, height },
		}))
		.filter(Boolean);
	const decisionGroups = parts
		.filter((part) => part.renderKind !== 'source')
		.map((part) => `\t<g data-render-part-id="${escapeAttribute(part.partId)}" data-render-kind="${escapeAttribute(part.renderKind)}" data-output-present="${part.outputPresent ? 'true' : 'false'}"/>`);

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${formatNumber(minX)} ${formatNumber(minY)} ${formatNumber(width)} ${formatNumber(height)}">
	<title>${escapeText(artifact.faceKey)} add optional render step</title>
	<desc>Intermediate source-space SVG emitted by final rendering composition after addOptional.</desc>
	<g id="add-optional-source-parts">
${indent(sourcePaths.join('\n'), 2)}
	</g>
	<g id="add-optional-generated-parts">
${indent(generatedText.join('\n'), 2)}
	</g>
	<g id="add-optional-decisions">
${decisionGroups.join('\n')}
	</g>
</svg>
`;
}

function generatedPartToSvgPath({ part, face, viewBox = null, targetBounds = null }) {
	const text = generatedTextForPart(part, face);
	if (!text) {
		return null;
	}

	const target = targetBounds || targetBoundsForGeneratedPart({ part, viewBox });
	const fontSelection = fontSelectionForGeneratedPart(part, text);
	if (!fontSelection) {
		return null;
	}

	const font = opentype.loadSync(fontSelection.path);
	const glyphPath = font.getPath(text, 0, 0, 20);
	const glyphBounds = glyphPath.getBoundingBox();
	const pathData = glyphPath.toPathData(3);
	const scaleX = target.width / Math.max(1, glyphBounds.x2 - glyphBounds.x1);
	const scaleY = target.height / Math.max(1, glyphBounds.y2 - glyphBounds.y1);
	const translateX = target.left - (glyphBounds.x1 * scaleX);
	const translateY = target.top - (glyphBounds.y1 * scaleY);
	const transform = `matrix(${formatNumber(scaleX)} 0 0 ${formatNumber(scaleY)} ${formatNumber(translateX)} ${formatNumber(translateY)})`;
	const attrs = [
		`data-render-part-id="${escapeAttribute(part.partId)}"`,
		`data-render-kind="${escapeAttribute(part.renderKind)}"`,
		`data-generated-text="${escapeAttribute(text)}"`,
		`data-generated-font="${escapeAttribute(fontSelection.name)}"`,
		`transform="${escapeAttribute(transform)}"`,
		`d="${escapeAttribute(pathData)}"`,
		`fill="${escapeAttribute(part.fill || generatedFillForPart(part))}"`,
	].join(' ');

	return `<path ${attrs}/>`;
}

function fontSelectionForGeneratedPart(part, text) {
	const preferredPaths = part.contentKind === 'glyph'
		? [DEFAULT_HOUSE_LABEL_FONT_PATH, ...CJK_FONT_CANDIDATES]
		: [DEFAULT_HOUSE_LABEL_FONT_PATH];
	const fontPath = preferredPaths.find((candidate) => fontContainsText(candidate, text));

	if (!fontPath) {
		return null;
	}

	return {
		path: fontPath,
		name: fontPath === DEFAULT_HOUSE_LABEL_FONT_PATH
			? 'Gluten 800'
			: path.basename(fontPath),
	};
}

function fontContainsText(fontPath, text) {
	try {
		const font = opentype.loadSync(fontPath);
		return [...text].every((character) => font.charToGlyph(character).unicode === character.codePointAt(0));
	} catch {
		return false;
	}
}

function targetBoundsForGeneratedPart({ part, viewBox }) {
	if (part.targetBounds) {
		return part.targetBounds;
	}

	const box = viewBox || { minX: 0, minY: 0, width: 94, height: 136 };
	const region = part.hint?.region || 'top-left';
	const rightAligned = region.includes('right');

	return {
		left: rightAligned
			? box.minX + box.width * 0.78
			: box.minX + box.width * 0.08,
		top: box.minY + box.height * 0.08,
		width: box.width * 0.14,
		height: box.height * 0.2,
	};
}

function generatedPartFromReferencePart(part, referencePart) {
	return {
		...part,
		contentKind: part.contentKind || referencePart?.contentKind || null,
		role: part.role || referencePart?.role || null,
		colorStrategy: part.colorStrategy || referencePart?.colorStrategy || null,
		text: part.text || referencePart?.text || null,
	};
}

function generatedTextForPart(part, face) {
	if (part.text) {
		return part.text;
	}

	if (part.partId === 'label') {
		if (face.family === 'wind') {
			return windLabelForFace(face.faceKey);
		}

		if (canGenerateLabelFromFaceValue(face) && face.value != null) {
			return String(face.value);
		}
	}

	return null;
}

function windLabelForFace(faceKey) {
	const suffix = String(faceKey).split('-')[1];
	const labels = {
		e: 'E',
		n: 'N',
		s: 'S',
		w: 'W',
	};

	return labels[suffix] || null;
}

function generatedFillForPart(part) {
	if (part.role === 'suit-label' || part.role === 'wind-label') {
		return '#FC1D05';
	}

	return '#111111';
}

function componentToSvgPath(component, extraAttributes = {}) {
	const transformAttribute = extraAttributes.transform
		? `transform="${escapeAttribute(extraAttributes.transform)}"`
		: componentTransformAttribute(component);
	const attributes = { ...extraAttributes };
	delete attributes.transform;
	const attrs = [
		`data-component-id="${escapeAttribute(component.componentId)}"`,
		...Object.entries(attributes).map(([key, value]) => `${key}="${escapeAttribute(value)}"`),
		component.className ? `class="${escapeAttribute(component.className)}"` : null,
		`d="${escapeAttribute(component.pathData)}"`,
		transformAttribute,
		`fill="${escapeAttribute(component.fill && component.fill !== 'none' ? component.fill : 'none')}"`,
		component.stroke && component.stroke !== 'none' ? `stroke="${escapeAttribute(component.stroke)}"` : null,
		component.strokeWidth ? `stroke-width="${escapeAttribute(component.strokeWidth)}"` : null,
		component.opacity != null ? `opacity="${escapeAttribute(component.opacity)}"` : null,
	].filter(Boolean).join(' ');

	return `<path ${attrs}/>`;
}

function layoutSourceComponentPath({
	component,
	partId,
	transform,
	layoutSource = 'alignment-map',
	negativeSpaceComponents,
	color = null,
	extraAttributes = {},
}) {
	const normalizedComponent = normalizeNegativeSpaceComponent(component);
	const knockouts = negativeSpaceComponents
		.filter((knockout) => isRelatedKnockout(normalizedComponent, knockout));

	return makePaintPathWithKnockouts({
		component: normalizedComponent,
		color: color || componentPaint(normalizedComponent),
		knockouts,
		transform: matrixObject(transform),
		attributes: {
			'data-component-id': normalizedComponent.componentId,
			'data-render-part-id': partId,
			'data-render-kind': 'source',
			'data-layout-source': layoutSource,
			...extraAttributes,
		},
	});
}

function candidatesForSourceAssignment(assignment, candidates) {
	const assignmentComponentIds = new Set(assignment.sourceComponentIds || []);
	const partId = assignment.referencePartId || assignment.sourcePartId;

	return (candidates || []).filter((candidate) => {
		const candidateComponentIds = candidate.sourceComponentIds || [];
		const partCandidates = candidate.referencePartCandidates || candidate.referencePartIds || [];
		const sharesComponent = candidateComponentIds.some((componentId) => assignmentComponentIds.has(componentId));
		const matchesPart = partCandidates.length === 0 || partCandidates.includes(partId);

		return sharesComponent && matchesPart;
	});
}

function renderOrderedComponentIds(componentIds, componentsById) {
	return [...(componentIds || [])].sort((leftId, rightId) => {
		const leftIndex = sourceIndexForComponentId(leftId, componentsById);
		const rightIndex = sourceIndexForComponentId(rightId, componentsById);

		if (leftIndex != null && rightIndex != null) {
			return leftIndex - rightIndex;
		}

		if (leftIndex != null) {
			return -1;
		}

		if (rightIndex != null) {
			return 1;
		}

		return 0;
	});
}

function sourceIndexForComponentId(componentId, componentsById) {
	const sourceIndex = componentsById.get(componentId)?.sourceIndex;

	return Number.isFinite(sourceIndex) ? sourceIndex : null;
}

function makeColorContext({ artifact, normalizedComponents, semanticMap, referenceStructure }) {
	const paintResolver = makeSourcePaintResolver(normalizedComponents);
	const sourcePaintComponents = (normalizedComponents.components || [])
		.filter((component) => !normalizeNegativeSpaceComponent(component).negativeSpaceCandidate)
		.filter((component) => isPaint(componentPalettePaint(component, paintResolver)));
	const sourceComponentsById = new Map(sourcePaintComponents.map((component) => [component.componentId, component]));
	const faceReference = referenceStructure?.faces?.[artifact.faceKey] || {};
	const referenceComponentsById = new Map((faceReference.components || [])
		.map((component) => [component.componentId, component]));
	const colorPolicy = artifact.inputs?.outputOptions?.color?.policy || 'reference-color';
	const paletteEvidenceComponents = sourcePaintComponents
		.filter((component) => {
			const assignment = assignmentForSourceComponent(artifact, component.componentId, semanticMap);

			return !isFreeformPreserveColorAssignment(artifact, assignment);
		});
	const assignedPaletteEvidenceComponents = paletteEvidenceComponents
		.filter((component) => assignmentForSourceComponent(artifact, component.componentId, semanticMap));
	const sourcePaints = paletteEvidenceComponents.map((component) => componentPalettePaint(component, paintResolver)).filter(isPaint);
	const sourceHueAverages = Colors.perceivedHueAverages(
		assignedPaletteEvidenceComponents.map((component) => componentPalettePaint(component, paintResolver)).filter(isPaint),
	);
	const colorMappings = paletteEvidenceComponents
		.map((component) => {
			const assignment = assignmentForSourceComponent(artifact, component.componentId, semanticMap);
			const colorMode = assignment ? effectiveColorModeForAssignment(assignment, artifact) : null;
			const hueGrouping = hueGroupingForColorMode(colorMode);
			const partId = assignment ? assignmentPartId(assignment) : null;
			const target = assignment
				? targetPaintForSourceComponent({
					component,
					assignment,
					colorMode,
					hueGrouping,
					referenceComponentsById,
					faceReference,
					sourceHueAverages,
					paintResolver,
				})
				: null;
			const paletteSourcePaint = componentPalettePaint(component, paintResolver);

			return partId && target && paletteSourcePaint ? {
				partId,
				key: partComponentColorKey(partId, component),
				source: paletteSourcePaint,
				target,
				weight: component.area || 1,
				sourceIndex: component.sourceIndex,
			} : null;
		})
		.filter(Boolean);
	const palette = new PaletteBuilder({
		mappings: colorMappings,
		colors: [
			...sourcePaints,
			...referencePaintsForFace(faceReference),
		],
		overlaps: colorMappingOverlapsByPart(colorMappings),
	}).build();
	const colorPicker = new ColorPicker(palette);

	return {
		policy: colorPolicy,
		referenceComponentsById,
		faceReference,
		sourceHueAverages,
		sourceComponentsById,
		paintResolver,
		artifact,
		colorPicker,
	};
}

function colorMappingOverlapsByPart(colorMappings) {
	const mappingsByPart = new Map();

	for (const mapping of colorMappings || []) {
		const partMappings = mappingsByPart.get(mapping.partId) || [];

		partMappings.push(mapping);
		mappingsByPart.set(mapping.partId, partMappings);
	}

	return [...mappingsByPart.values()].map((items) => ({ items }));
}

function sourceComponentsForAssignment(assignment, sourceComponentsById) {
	return (assignment.sourceComponentIds || [])
		.map((componentId) => sourceComponentsById.get(componentId))
		.filter(Boolean);
}

function assignmentForSourceComponent(artifact, componentId, semanticMap = null) {
	return (semanticMap?.assignments || [])
		.find((assignment) => (assignment.sourceComponentIds || []).includes(componentId))
		|| Object.values(artifact.steps.layout?.parts || {})
		.find((part) => (part.sourceComponentIds || []).includes(componentId)) || null;
}

function colorDecisionForSourceComponent({
	component,
	assignment,
	candidate,
	colorContext,
}) {
	const sourcePaint = componentPaint(component);
	const colorPolicy = colorPolicyForPart(assignment, colorContext.policy);
	const colorMode = effectiveColorModeForAssignment(assignment, colorContext.artifact);
	const hueGrouping = hueGroupingForColorMode(colorMode);
	const partId = assignmentPartId(assignment);
	const targetPaint = targetPaintForSourceComponent({
		component,
		assignment: {
			...assignment,
			referenceComponentIds: candidate?.referenceComponentIds || assignment.referenceComponentIds,
		},
		colorMode,
		hueGrouping,
		referenceComponentsById: colorContext.referenceComponentsById,
		faceReference: colorContext.faceReference,
		sourceHueAverages: colorContext.sourceHueAverages,
		paintResolver: colorContext.paintResolver,
	});
	const paletteSourcePaint = componentPalettePaint(component, colorContext.paintResolver) || sourcePaint;
	const outputPaint = colorMode === 'freeform-preserve'
		? paletteSourcePaint
		: colorPolicy === 'source-color'
		? sourcePaint
		: outputPaintColor({
			component,
			partId,
			sourcePaint: paletteSourcePaint,
			targetPaint,
			colorMode,
			colorContext,
		});

	return {
		componentId: component.componentId,
		partId,
		colorPolicy,
		colorMode,
		hueGrouping,
		sourcePaint,
		paletteSourcePaint,
		targetPaint,
		outputPaint,
	};
}

function outputPaintColor({ component, partId, sourcePaint, targetPaint, colorMode, colorContext }) {
	if (colorMode === 'freeform-preserve') {
		return sourcePaint;
	}

	if (!isPaint(targetPaint)) {
		return sourcePaint;
	}

	if (colorMode === 'monochrome-reference') {
		return targetPaint;
	}

	if (colorMode === 'freeform-palette') {
		return colorContext.colorPicker.pick({
			paletteKey: partComponentColorKey(partId, component),
			sourcePaint,
			targetPaint,
		});
	}

	return colorContext.colorPicker.pick({
		paletteKey: partComponentColorKey(partId, component),
		sourcePaint,
		targetPaint,
	});
}

function targetPaintForSourceComponent({
	component,
	assignment,
	colorMode = null,
	hueGrouping = hueGroupingForColorMode(colorMode),
	referenceComponentsById,
	faceReference,
	sourceHueAverages,
	paintResolver,
}) {
	const referencePart = faceReference.parts?.[assignment.partId] || faceReference.parts?.[assignment.referencePartId] || null;
	const referenceComponents = referenceComponentsForAssignment({
		assignment,
		referencePart,
		referenceComponentsById,
	});
	const sourcePaint = componentPalettePaint(component, paintResolver) || componentPaint(component);
	const sourceHue = Colors.perceivedHue(sourcePaint);
	const paletteColors = referencePaletteColors(referencePart, referenceComponents);
	const referenceComponent = analogousReferenceComponent(component, referenceComponents);
	const dominantColor = referenceComponent?.dominantColor || referencePart?.dominantColor;

	if (colorMode === 'freeform-preserve') {
		return sourcePaint;
	}

	if (hueGrouping === 'source-hues') {
		return nearestSameHuePaletteColor(sourcePaint, paletteColors, sourceHue)
			|| renderOverrideHueReferencePaint(sourceHue)
			|| sourceHueAverages.get(sourceHue)
			|| Colors.perceivedHue(sourcePaint)
			|| sourcePaint;
	}

	if (colorMode === 'monochrome-reference') {
		return dominantColor
			|| referencePart?.dominantColor
		|| nearestSourceMatchedPaletteColor(sourcePaint, paletteColors)
		|| sourceHueAverages.get(sourceHue)
		|| sourcePaint;
	}

	return dominantColor
		|| nearestSourceMatchedPaletteColor(sourcePaint, paletteColors, {
			dominantColor,
		})
		|| sourceHueAverages.get(sourceHue)
		|| sourcePaint;
}

function colorModeForAssignment(assignment) {
	if (assignment.colorStrategy) {
		return assignment.colorStrategy;
	}

	if (assignment.contentKind === 'label'
		|| assignment.contentKind === 'glyph'
		|| /(?:label|character)$/i.test(assignment.role || '')) {
		return 'monochrome-reference';
	}

	return 'reference-shaded';
}

function hueGroupingForColorMode(colorMode) {
	if (colorMode === 'freeform-preserve') {
		return 'exact-source';
	}

	if (colorMode === 'freeform-palette') {
		return 'source-hues';
	}

	return 'target-hue';
}

function effectiveColorModeForAssignment(assignment, artifact) {
	return isFreeformPreserveColorAssignment(artifact, assignment)
		? 'freeform-preserve'
		: colorModeForAssignment(assignment);
}

function nearestSourceMatchedPaletteColor(sourcePaint, paletteColors, options = {}) {
	const nearest = (paletteColors || [])
		.map((paint) => ({
			paint,
			distance: Colors.perceivedDistance(sourcePaint, paint),
		}))
		.filter((entry) => entry.distance != null)
		.sort((left, right) => left.distance - right.distance)[0] || null;
	const dominantDistance = Colors.perceivedDistance(sourcePaint, options.dominantColor);
	const meaningfulImprovement = options.meaningfulImprovement ?? 0.08;

	if (!nearest) {
		return null;
	}

	if (dominantDistance != null && dominantDistance - nearest.distance < meaningfulImprovement) {
		return null;
	}

	return nearest.paint;
}

function nearestSameHuePaletteColor(sourcePaint, paletteColors, sourceHue) {
	if (!sourceHue) {
		return null;
	}

	return (paletteColors || [])
		.filter((paint) => Colors.perceivedHue(paint) === sourceHue)
		.map((paint) => ({
			paint,
			distance: Colors.perceivedDistance(sourcePaint, paint),
		}))
		.filter((entry) => entry.distance != null)
		.sort((left, right) => left.distance - right.distance)[0]?.paint || null;
}

function renderOverrideHueReferencePaint(sourceHue) {
	return sourceHue === '#8A3A12' ? sourceHue : null;
}

function referenceComponentsForAssignment({ assignment, referencePart, referenceComponentsById }) {
	const ids = uniqueValues([
		...(assignment.referenceComponentIds || []),
		...(referencePart?.componentIds || []),
	]);

	return ids.map((componentId) => referenceComponentsById.get(componentId)).filter(Boolean);
}

function referencePaletteColors(referencePart, referenceComponents) {
	return uniqueValues([
		...(referencePart?.paletteColors || []),
		referencePart?.dominantColor,
		...referenceComponents.flatMap((component) => [
			...(component.paletteColors || []),
			...(component.colors || []),
			component.dominantColor,
		]),
	]).filter(isPaint);
}

function referencePaintsForFace(faceReference) {
	return [
		...Object.values(faceReference.parts || {}).flatMap((part) => [
			...(part.paletteColors || []),
			part.dominantColor,
		]),
		...(faceReference.components || []).flatMap((component) => [
			...(component.paletteColors || []),
			...(component.colors || []),
			component.dominantColor,
		]),
	].filter(isPaint);
}

function analogousReferenceComponent(component, referenceComponents) {
	if (referenceComponents.length === 0) {
		return null;
	}

	if (referenceComponents.length === 1) {
		return referenceComponents[0];
	}

	const sourceBounds = normalizeBounds(component.bounds);
	const referenceBounds = unionBounds(referenceComponents.map((referenceComponent) => referenceComponent.bounds));

	if (!sourceBounds || !referenceBounds) {
		return referenceComponents[0];
	}

	return referenceComponents
		.map((referenceComponent) => ({
			component: referenceComponent,
			score: analogousReferenceScore(component, referenceComponent, sourceBounds, referenceBounds),
		}))
		.sort((left, right) => left.score - right.score)[0]?.component || referenceComponents[0];
}

function analogousReferenceScore(component, referenceComponent, sourceBounds, referenceBounds) {
	const sourcePoint = normalizedCenter(component, sourceBounds);
	const referencePoint = normalizedCenter(referenceComponent, referenceBounds);
	const centerScore = Math.hypot(sourcePoint.x - referencePoint.x, sourcePoint.y - referencePoint.y);
	const sourceAreaRatio = normalizedArea(component, sourceBounds);
	const referenceAreaRatio = normalizedArea(referenceComponent, referenceBounds);
	const areaScore = Math.abs(Math.log((sourceAreaRatio + 0.0001) / (referenceAreaRatio + 0.0001)));

	return centerScore + (areaScore * 0.04);
}

function normalizedCenter(item, outerBounds) {
	const bounds = normalizeBounds(item.bounds || item);
	const center = item.center || {
		x: bounds.left + (bounds.width / 2),
		y: bounds.top + (bounds.height / 2),
	};

	return {
		x: (center.x - outerBounds.left) / Math.max(1, outerBounds.width),
		y: (center.y - outerBounds.top) / Math.max(1, outerBounds.height),
	};
}

function normalizedArea(item, outerBounds) {
	const bounds = normalizeBounds(item.bounds || item);
	const area = item.area || bounds.width * bounds.height;

	return area / Math.max(1, outerBounds.width * outerBounds.height);
}

function colorPolicyForPart(part, defaultPolicy) {
	return part.colorPolicy || defaultPolicy || 'reference-color';
}

function colorPartRecord({
	partId,
	assignment,
	status,
	renderKind,
	colorPolicy,
	sourceComponentIds = [],
	components = {},
}) {
	return {
		partId,
		status,
		reviewStatus: assignment.reviewStatus || 'inferred',
		renderKind,
		colorPolicy,
		sourceComponentIds,
		components,
		provenance: {
			stage: 'final-rendering-composition',
			step: 'color',
			assignmentId: assignment.assignmentId || null,
		},
	};
}

function generatedColorForPart(part, referencePart) {
	return part.fill || referencePart?.dominantColor || generatedFillForPart(part);
}

function assignmentPartId(assignment) {
	return assignment?.partId || assignment?.referencePartId || assignment?.sourcePartId || '';
}

function partComponentColorKey(partId, component) {
	return [
		partId || '',
		componentPaletteKey(component),
	].join('|');
}

function componentPaletteKey(component) {
	const bounds = component.bounds || {};

	return [
		component.sourceIndex ?? '',
		component.componentId ?? component.id ?? '',
		componentPaint(component) ?? '',
		formatKeyNumber(bounds.left),
		formatKeyNumber(bounds.top),
		formatKeyNumber(bounds.right),
		formatKeyNumber(bounds.bottom),
		String(component.pathData || '').slice(0, 96),
	].join('|');
}

function formatKeyNumber(value) {
	return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '';
}

function layoutTransformForSourceAssignment({
	assignment,
	artifact,
	normalizedComponents,
	componentsById,
	referenceStructure,
	layoutOptions,
	candidate,
}) {
	if (layoutOptions.scaleMode !== 'largest-containing-box') {
		if (assignment.alignmentTransform?.matrix) {
			return {
				matrix: assignment.alignmentTransform.matrix,
				source: 'canonical-part-alignment',
				targetBounds: assignment.alignmentTargetBounds || null,
				alignedBounds: assignment.alignmentAlignedBounds || null,
			};
		}

		return {
			matrix: candidate?.transform?.matrix || null,
			source: 'alignment-map',
			targetBounds: candidate?.targetBounds || null,
			alignedBounds: candidate?.alignedBounds || null,
		};
	}

	const sourceBounds = unionBounds((assignment.sourceComponentIds || [])
		.map((componentId) => componentsById.get(componentId)?.bounds)
		.filter(Boolean));
	const sourceContainer = viewBoxBounds(normalizedComponents.viewBox || normalizedComponents.alignmentBounds);
	const targetBounds = largestContainingReferenceBox({
		referenceStructure,
		family: artifact.face.family,
		role: assignment.role,
		partId: assignment.referencePartId || assignment.sourcePartId,
	});

	if (!sourceBounds || !sourceContainer || !targetBounds) {
		if (assignment.alignmentTransform?.matrix) {
			return {
				matrix: assignment.alignmentTransform.matrix,
				source: 'canonical-part-alignment',
				targetBounds: assignment.alignmentTargetBounds || null,
				alignedBounds: assignment.alignmentAlignedBounds || null,
			};
		}

		return {
			matrix: candidate?.transform?.matrix || null,
			source: 'alignment-map',
			targetBounds: candidate?.targetBounds || null,
			alignedBounds: candidate?.alignedBounds || null,
		};
	}

	const sourceCalibrationBox = boxFromPaddingRatios(
		sourceContainer,
		paddingRatios(targetBounds, PREPARED_VIEWBOX_BOUNDS),
	);
	const fittedSourceBox = centeredFitBox(sourceBounds, sourceCalibrationBox);
	const calibrationMatrix = uniformFitMatrix(sourceCalibrationBox, targetBounds);
	const fittedTargetBox = transformBounds(fittedSourceBox, calibrationMatrix);
	const matrix = matrixFromBounds(sourceBounds, fittedTargetBox);

	return {
		matrix,
		source: 'largest-containing-box',
		scaleMode: 'largest-containing-box',
		targetBounds,
		alignedBounds: transformBounds(sourceBounds, matrixObject(matrix)),
	};
}

function artworkMirrorForAssignment({
	artifact,
	assignment,
	componentsById,
	layoutTransform,
}) {
	if (!artifact.inputs?.outputOptions?.transform?.reflectX || !isFreeformArtworkAssignment(assignment)) {
		return null;
	}

	const sourceBounds = sourceBoundsForAssignment(assignment, componentsById);
	const alignedBounds = layoutTransform.alignedBounds
		|| (sourceBounds && layoutTransform.matrix
			? transformBounds(sourceBounds, matrixObject(layoutTransform.matrix))
			: null)
		|| layoutTransform.targetBounds
		|| PREPARED_VIEWBOX_BOUNDS;

	return {
		axis: 'x',
		bounds: normalizeBounds(alignedBounds),
	};
}

function isFreeformArtworkAssignment(assignment) {
	if (!assignment) {
		return false;
	}

	const partId = assignment.referencePartId || assignment.sourcePartId;

	return partId === 'mainArtwork'
		&& assignment.contentKind === 'artwork'
		&& assignment.colorStrategy === 'freeform-palette';
}

function isFreeformPreserveColorAssignment(artifact, assignment) {
	return Boolean(artifact?.inputs?.outputOptions?.artwork?.preserveColors)
		&& isFreeformArtworkAssignment(assignment);
}

function sourceBoundsForAssignment(assignment, componentsById) {
	return unionBounds((assignment.sourceComponentIds || [])
		.map((componentId) => componentsById.get(componentId)?.bounds)
		.filter(Boolean));
}

function applyArtworkMirrorToTransform(transform, artworkMirror) {
	if (!artworkMirror?.bounds) {
		return transform;
	}

	return multiplyMatrices(mirrorXMatrix(artworkMirror.bounds), transform);
}

function mirrorBoundsIfNeeded(bounds, artworkMirror) {
	if (!bounds || !artworkMirror?.bounds) {
		return bounds;
	}

	return transformBounds(bounds, matrixObject(mirrorXMatrix(artworkMirror.bounds)));
}

function mirrorXMatrix(bounds) {
	const normalized = normalizeBounds(bounds);
	const centerXTimesTwo = normalized.left + normalized.right;

	return [-1, 0, 0, 1, centerXTimesTwo, 0];
}

const PREPARED_VIEWBOX_BOUNDS = Object.freeze({
	left: 0,
	top: 0,
	right: 94,
	bottom: 136,
	width: 94,
	height: 136,
});

function largestContainingReferenceBox({ referenceStructure, family, role, partId }) {
	const boxes = Object.values(referenceStructure?.faces || {})
		.filter((face) => sameReferenceFamily(face.family, family) || sameReferenceFamily(face.faceKey?.split('-')[0], family))
		.flatMap((face) => Object.values(face.parts || {}))
		.filter((part) => (role && part.role === role) || (partId && part.partId === partId))
		.map((part) => part.targetBounds)
		.filter(Boolean);

	return boxes.reduce((largest, bounds) => {
		if (!largest) {
			return normalizeBounds(bounds);
		}

		const normalized = normalizeBounds(bounds);
		return (normalized.width * normalized.height) > (largest.width * largest.height)
			? normalized
			: largest;
	}, null);
}

function sameReferenceFamily(left, right) {
	return normalizeFamily(left) === normalizeFamily(right);
}

function normalizeFamily(value) {
	return value === 'dragons' ? 'dragon' : value;
}

function viewBoxBounds(viewBox) {
	if (!viewBox) {
		return null;
	}

	const left = viewBox.left ?? viewBox.minX ?? 0;
	const top = viewBox.top ?? viewBox.minY ?? 0;
	const width = viewBox.width ?? ((viewBox.right ?? 0) - left);
	const height = viewBox.height ?? ((viewBox.bottom ?? 0) - top);

	return normalizeBounds({
		left,
		top,
		right: left + width,
		bottom: top + height,
		width,
		height,
	});
}

function normalizeBounds(bounds) {
	if (!bounds) {
		return null;
	}

	const left = bounds.left ?? bounds.minX ?? 0;
	const top = bounds.top ?? bounds.minY ?? 0;
	const right = bounds.right ?? (left + (bounds.width ?? 0));
	const bottom = bounds.bottom ?? (top + (bounds.height ?? 0));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function unionBounds(boundsList) {
	const validBounds = boundsList.map(normalizeBounds).filter(Boolean);
	if (validBounds.length === 0) {
		return null;
	}

	const left = Math.min(...validBounds.map((bounds) => bounds.left));
	const top = Math.min(...validBounds.map((bounds) => bounds.top));
	const right = Math.max(...validBounds.map((bounds) => bounds.right));
	const bottom = Math.max(...validBounds.map((bounds) => bounds.bottom));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function paddingRatios(innerBox, outerBox) {
	return {
		left: (innerBox.left - outerBox.left) / outerBox.width,
		right: (outerBox.right - innerBox.right) / outerBox.width,
		top: (innerBox.top - outerBox.top) / outerBox.height,
		bottom: (outerBox.bottom - innerBox.bottom) / outerBox.height,
	};
}

function boxFromPaddingRatios(outerBox, ratios) {
	const left = outerBox.left + (outerBox.width * ratios.left);
	const top = outerBox.top + (outerBox.height * ratios.top);
	const right = outerBox.right - (outerBox.width * ratios.right);
	const bottom = outerBox.bottom - (outerBox.height * ratios.bottom);

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function centeredFitBox(sourceBounds, targetBox) {
	if ([sourceBounds.width, sourceBounds.height, targetBox.width, targetBox.height]
		.some((value) => !Number.isFinite(value) || value <= 0)) {
		return sourceBounds;
	}

	const scale = Math.min(targetBox.width / sourceBounds.width, targetBox.height / sourceBounds.height);
	const width = sourceBounds.width * scale;
	const height = sourceBounds.height * scale;
	const centerX = targetBox.left + (targetBox.width / 2);
	const centerY = targetBox.top + (targetBox.height / 2);

	return {
		left: centerX - (width / 2),
		top: centerY - (height / 2),
		right: centerX + (width / 2),
		bottom: centerY + (height / 2),
		width,
		height,
	};
}

function uniformFitMatrix(sourceBounds, targetBounds) {
	const scale = Math.min(targetBounds.width / sourceBounds.width, targetBounds.height / sourceBounds.height);
	const sourceCenterX = sourceBounds.left + (sourceBounds.width / 2);
	const sourceCenterY = sourceBounds.top + (sourceBounds.height / 2);
	const targetCenterX = targetBounds.left + (targetBounds.width / 2);
	const targetCenterY = targetBounds.top + (targetBounds.height / 2);

	return {
		a: scale,
		b: 0,
		c: 0,
		d: scale,
		e: targetCenterX - (sourceCenterX * scale),
		f: targetCenterY - (sourceCenterY * scale),
	};
}

function transformBounds(bounds, matrix) {
	const points = [
		{ x: bounds.left, y: bounds.top },
		{ x: bounds.right, y: bounds.top },
		{ x: bounds.right, y: bounds.bottom },
		{ x: bounds.left, y: bounds.bottom },
	].map((point) => ({
		x: (matrix.a * point.x) + (matrix.c * point.y) + matrix.e,
		y: (matrix.b * point.x) + (matrix.d * point.y) + matrix.f,
	}));
	const left = Math.min(...points.map((point) => point.x));
	const top = Math.min(...points.map((point) => point.y));
	const right = Math.max(...points.map((point) => point.x));
	const bottom = Math.max(...points.map((point) => point.y));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function matrixFromBounds(sourceBounds, targetBounds) {
	const scaleX = targetBounds.width / sourceBounds.width;
	const scaleY = targetBounds.height / sourceBounds.height;

	return [
		scaleX,
		0,
		0,
		scaleY,
		targetBounds.left - (sourceBounds.left * scaleX),
		targetBounds.top - (sourceBounds.top * scaleY),
	];
}

function normalizeNegativeSpaceComponent(component) {
	return {
		...component,
		id: component.id || component.componentId,
		parentGroupIds: component.parentGroupIds || [],
		negativeSpaceCandidate: Boolean(component.negativeSpaceCandidate || component.classification?.negativeSpaceCandidate),
	};
}

function componentPaint(component) {
	if (component.fill && component.fill !== 'none') {
		return component.fill;
	}

	if (component.stroke && component.stroke !== 'none') {
		return component.stroke;
	}

	return '#111111';
}

function componentPalettePaint(component, paintResolver = null) {
	const fill = palettePaintValue(component?.fill, paintResolver);

	if (fill) {
		return fill;
	}

	const stroke = palettePaintValue(component?.stroke, paintResolver);

	if (stroke) {
		return stroke;
	}

	return '#111111';
}

function palettePaintValue(paint, paintResolver = null) {
	if (!paint || paint === 'none' || paint === 'transparent') {
		return null;
	}

	if (isPaint(paint)) {
		return paint;
	}

	return paintResolver?.representativePaint(paint) || null;
}

function makeSourcePaintResolver(normalizedComponents = {}) {
	const gradientsById = gradientDefinitionsById(normalizedComponents.sourceDefs || '');

	return {
		representativePaint(paint) {
			const id = urlPaintId(paint);

			if (!id) {
				return null;
			}

			return representativeGradientPaint(id, gradientsById, new Set());
		},
	};
}

function representativeGradientPaint(id, gradientsById, seenIds) {
	if (!id || seenIds.has(id)) {
		return null;
	}

	seenIds.add(id);
	const gradient = gradientsById.get(id);

	if (!gradient) {
		return null;
	}

	const stopPaints = gradient.stops
		.map((stop) => stop.color)
		.filter(isPaint);

	if (stopPaints.length > 0) {
		return averagePaints(stopPaints);
	}

	return representativeGradientPaint(gradient.href, gradientsById, seenIds);
}

function averagePaints(paints) {
	const colors = paints
		.map((paint) => Colors.parseColor(paint))
		.filter(Boolean);

	if (colors.length === 0) {
		return null;
	}

	const total = colors.reduce((sum, color) => [
		sum[0] + color[0],
		sum[1] + color[1],
		sum[2] + color[2],
	], [0, 0, 0]);

	return Colors.formatColor(total.map((channel) => Math.round(channel / colors.length)));
}

function gradientDefinitionsById(sourceDefs) {
	const gradients = new Map();

	for (const match of String(sourceDefs || '').matchAll(/<(linearGradient|radialGradient)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
		const attributes = parseSvgAttributes(match[2]);
		const id = attributes.id;

		if (!id) {
			continue;
		}

		gradients.set(id, {
			href: urlReferenceId(attributes.href || attributes['xlink:href']),
			stops: gradientStops(match[3]),
		});
	}

	for (const match of String(sourceDefs || '').matchAll(/<(linearGradient|radialGradient)\b([^>]*?)\/>/gi)) {
		const attributes = parseSvgAttributes(match[2]);
		const id = attributes.id;

		if (!id || gradients.has(id)) {
			continue;
		}

		gradients.set(id, {
			href: urlReferenceId(attributes.href || attributes['xlink:href']),
			stops: [],
		});
	}

	return gradients;
}

function gradientStops(content) {
	return [...String(content || '').matchAll(/<stop\b([^>]*)\/?>/gi)]
		.map((match) => {
			const attributes = parseSvgAttributes(match[1]);
			const style = parseStyleAttributes(attributes.style);

			return {
				color: attributes['stop-color'] || style['stop-color'] || null,
			};
		});
}

function parseSvgAttributes(source) {
	const attributes = {};

	for (const match of String(source || '').matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
		attributes[match[1]] = match[2] ?? match[3] ?? '';
	}

	return attributes;
}

function parseStyleAttributes(style) {
	return Object.fromEntries(String(style || '')
		.split(';')
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const separator = entry.indexOf(':');

			return separator >= 0
				? [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]
				: [entry, ''];
		}));
}

function urlPaintId(paint) {
	const match = /^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)$/i.exec(String(paint || '').trim());

	return match?.[1] || null;
}

function urlReferenceId(value) {
	const match = /^#(.+)$/.exec(String(value || '').trim());

	return match?.[1] || null;
}

function isPaint(value) {
	return Boolean(value)
		&& value !== 'none'
		&& value !== 'transparent'
		&& !String(value).startsWith('url(');
}

function extractSvgDefs(svgSource) {
	return /<defs\b[^>]*>[\s\S]*?<\/defs>/i.exec(svgSource)?.[0] || '';
}

function shouldLayoutSourceAssignment(assignment) {
	return assignment.assignmentType === 'source'
		&& assignment.reviewStatus !== 'rejected'
		&& (assignment.sourceComponentIds || []).length > 0;
}

function shouldRenderSourceAssignment(artifact, assignment) {
	const partId = assignment.referencePartId || assignment.sourcePartId;
	const optionalPart = artifact.steps.addOptional.parts?.[partId] || null;

	return !optionalPart || optionalPart.renderKind === 'source';
}

function optionalSourceAssignmentsForLayout(artifact, semanticMap) {
	return Object.values(artifact.steps.addOptional.parts || {})
		.filter((part) => part.renderKind === 'source')
		.filter((part) => (part.sourceComponentIds || []).length > 0)
		.filter((part) => !assignmentForPart(semanticMap, part.partId))
		.map((part) => ({
			assignmentId: null,
			sourcePartId: part.partId,
			referencePartId: part.partId,
			contentKind: part.contentKind || null,
			role: part.role || null,
			assignmentType: 'source',
			strategy: 'optional-source-reservation',
			sourceComponentIds: part.sourceComponentIds,
			referenceComponentIds: [],
			reviewStatus: part.accepted ? 'accepted' : 'inferred',
		}));
}

function alternateOptionalSourceAssignmentsForLayout(artifact, semanticMap) {
	return Object.values(artifact.steps.addOptional.parts || {})
		.filter((part) => part.alternates?.source)
		.map((part) => assignmentForPart(semanticMap, part.partId) || {
			assignmentId: null,
			sourcePartId: part.partId,
			referencePartId: part.partId,
			contentKind: part.contentKind || null,
			role: part.role || null,
			assignmentType: 'source',
			strategy: 'alternate-source-render',
			sourceComponentIds: part.alternates.source.sourceComponentIds || part.sourceComponentIds || [],
			referenceComponentIds: [],
			reviewStatus: part.reviewStatus || 'inferred',
		})
		.filter((assignment) => (assignment.sourceComponentIds || []).length > 0);
}

function fallbackLayoutTransformForOptionalSource(parts) {
	const mainArtwork = parts.mainArtwork;
	const sourcePart = mainArtwork?.renderKind === 'source'
		? mainArtwork
		: Object.values(parts).find((part) => part.renderKind === 'source' && part.transform?.matrix);

	if (!sourcePart?.transform?.matrix) {
		return null;
	}

	return {
		matrix: sourcePart.transform.matrix,
		source: sourcePart.source || sourcePart.transform.source || 'optional-source-reservation',
		scaleMode: sourcePart.transform.scaleMode || null,
		targetBounds: sourcePart.targetBounds || null,
	};
}

function transformBoundsForComponentIds(componentIds, componentsById, matrix) {
	const sourceBounds = unionBounds((componentIds || [])
		.map((componentId) => componentsById.get(componentId)?.bounds)
		.filter(Boolean));

	return sourceBounds ? transformBounds(sourceBounds, matrixObject(matrix)) : null;
}

function optionalSourceLayoutPartsForColor(artifact, semanticMap) {
	return Object.values(artifact.steps.layout?.parts || {})
		.filter((part) => part.renderKind === 'source')
		.filter((part) => (part.sourceComponentIds || []).length > 0)
		.filter((part) => artifact.steps.addOptional.parts?.[part.partId]?.renderKind === 'source')
		.filter((part) => !assignmentForPart(semanticMap, part.partId));
}

function alternateSourceLayoutPartsForColor(artifact) {
	return Object.values(artifact.steps.layout?.parts || {})
		.filter((part) => part.alternates?.source?.renderKind === 'source')
		.filter((part) => (part.alternates.source.sourceComponentIds || []).length > 0);
}

function layoutPartRecord({
	partId,
	assignment,
	status,
	renderKind,
	source,
	sourceComponentIds = [],
	alignmentCandidateId = null,
	transform = null,
	targetBounds = null,
	alignedBounds = null,
}) {
	return {
		partId,
		status,
		reviewStatus: assignment.reviewStatus || 'inferred',
		renderKind,
		source,
		sourceComponentIds,
		alignmentCandidateId,
		transform,
		targetBounds,
		alignedBounds,
		provenance: {
			stage: 'final-rendering-composition',
			step: 'layout',
			assignmentId: assignment.assignmentId || null,
		},
	};
}

function componentMatrix(component) {
	const transform = component.transform || {};

	return [
		transform.a ?? 1,
		transform.b ?? 0,
		transform.c ?? 0,
		transform.d ?? 1,
		transform.e ?? 0,
		transform.f ?? 0,
	];
}

function matrixObject(matrix) {
	const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = matrix || [];

	return { a, b, c, d, e, f };
}

function multiplyMatrices(left, right) {
	const [a1, b1, c1, d1, e1, f1] = left;
	const [a2, b2, c2, d2, e2, f2] = right;

	return [
		(a1 * a2) + (c1 * b2),
		(b1 * a2) + (d1 * b2),
		(a1 * c2) + (c1 * d2),
		(b1 * c2) + (d1 * d2),
		(a1 * e2) + (c1 * f2) + e1,
		(b1 * e2) + (d1 * f2) + f1,
	];
}

function matrixString(matrix) {
	return `matrix(${matrix.map(formatNumber).join(' ')})`;
}

function componentTransformAttribute(component) {
	const transform = component.transform;
	if (!transform || isIdentityTransform(transform)) {
		return null;
	}

	return `transform="${escapeAttribute(`matrix(${[
		transform.a ?? 1,
		transform.b ?? 0,
		transform.c ?? 0,
		transform.d ?? 1,
		transform.e ?? 0,
		transform.f ?? 0,
	].join(' ')})`)}"`;
}

function isIdentityTransform(transform) {
	return nearlyEqual(transform.a ?? 1, 1)
		&& nearlyEqual(transform.b ?? 0, 0)
		&& nearlyEqual(transform.c ?? 0, 0)
		&& nearlyEqual(transform.d ?? 1, 1)
		&& nearlyEqual(transform.e ?? 0, 0)
		&& nearlyEqual(transform.f ?? 0, 0);
}

function composeOptionalPart({
	partId,
	optionalPart,
	outputOptions,
	semanticMap,
	face,
}) {
	const partOutputOptions = outputOptions.parts[partId] || {};
	const outputPresent = partOutputOptions.outputPresent
		?? outputOptions.defaultOutputPresent;
	const assignment = assignmentForPart(semanticMap, partId);
	const sourceComponentIds = sourceComponentIdsForPart(semanticMap, partId, assignment);
	const semanticPartState = semanticMap.parts?.[partId] || null;
	const sourceAbsent = optionalPart.sourceState === 'source-absent'
		|| (semanticPartState?.state === 'unbound'
			&& semanticPartState.reviewStatus === 'accepted');
	const forceGeneratedOutput = partOutputOptions.renderMode === 'generated'
		|| partOutputOptions.source === 'generated';
	const generatedAvailable = canGeneratePreferredOutput({
		partId,
		optionalPart,
		assignment,
		partOutputOptions,
		face,
	});
	const sourcePreferredGenerated = partOutputOptions.source === 'source-preferred'
		&& generatedAvailable;
	const generatedRequested = forceGeneratedOutput
		|| sourcePreferredGenerated
		|| assignment?.assignmentType === 'generated'
		|| semanticPartState?.state === 'generated'
		|| ['generated', 'output-generated'].includes(optionalPart.sourceState);
	const renderKind = !outputPresent
		? 'omit'
		: forceGeneratedOutput
			? 'generated'
			: sourceComponentIds.length > 0
			? 'source'
			: sourceAbsent && !generatedRequested
				? 'omit'
			: generatedRequested
				? 'generated'
				: 'unresolved';

	return {
		partId,
		contentKind: optionalPart.contentKind || assignment?.contentKind || partOutputOptions.contentKind || null,
		role: optionalPart.role || assignment?.role || partOutputOptions.role || null,
		text: optionalPart.text || assignment?.text || partOutputOptions.text || null,
		hint: optionalPart.hint || null,
		outputPresent,
		renderKind,
		sourceComponentIds,
		sourceState: optionalPart.sourceState || null,
		assignmentType: assignment?.assignmentType || null,
		...(outputPresent && ((renderKind === 'source' && generatedAvailable) || (renderKind !== 'source' && sourceComponentIds.length > 0)) ? {
			alternates: {
				...(renderKind === 'source' && generatedAvailable ? { generated: {
					renderKind: 'generated',
					source: 'generated',
				} } : {}),
				...(renderKind !== 'source' && sourceComponentIds.length > 0 ? { source: {
					renderKind: 'source',
					source: 'source-assignment',
					sourceComponentIds,
				} } : {}),
			},
		} : {}),
		reviewStatus: renderKind === 'unresolved'
			? 'needs-review'
			: assignment?.reviewStatus || semanticPartState?.reviewStatus || partOutputOptions.reviewStatus || 'inferred',
		provenance: {
			stage: 'final-rendering-composition',
			step: 'addOptional',
			outputOptionSource: partOutputOptions.source || outputOptions.source,
			semanticAssignmentId: assignment?.assignmentId || null,
		},
	};
}

function canGeneratePreferredOutput({
	partId,
	optionalPart,
	assignment,
	partOutputOptions,
	face,
}) {
	return Boolean(optionalPart.text || assignment?.text || partOutputOptions.text)
		|| (partId === 'label' && canGenerateLabelFromFaceValue(face))
		|| optionalPart.contentKind === 'glyph'
		|| assignment?.contentKind === 'glyph'
		|| partOutputOptions.contentKind === 'glyph';
}

function canGenerateLabelFromFaceValue(face) {
	return ['bamboo', 'character', 'dot', 'flower', 'season', 'wind'].includes(face?.family);
}

function effectiveTilesetOutputOptions(tilesetState) {
	return mergeOutputOptionGroups(
		tilesetState?.rendering?.defaults || {},
		tilesetState?.rendering?.overrides || {},
	);
}

function outputOptionsForFace({ tilesetOutputOptions, faceOutputOptions, faceKey, suitId }) {
	const suitOptions = outputSuitOptions(tilesetOutputOptions, suitId);
	const tilesetFaceOptions = tilesetOutputOptions?.faces?.[faceKey] || {};
	const faceOptions = faceOutputOptions?.suitId === suitId ? faceOutputOptions : {};
	const hasTilesetFaceOptions = Boolean(tilesetFaceOptions.faceKey || tilesetFaceOptions.suitId);
	const hasFaceOptions = hasTilesetFaceOptions || Boolean(faceOptions.suitId);

	return {
		source: hasFaceOptions ? 'face' : suitOptions.suitId ? 'suit' : 'defaults',
		defaultOutputPresent: tilesetOutputOptions?.defaults?.optionalParts?.outputPresent ?? true,
		parts: {
			...(faceOptions.parts || {}),
			...(suitOptions.parts || {}),
			...(tilesetFaceOptions.parts || {}),
		},
		layout: {
			...(faceOptions.layout || {}),
			...(suitOptions.layout || {}),
			...(tilesetFaceOptions.layout || {}),
		},
		color: {
			...(tilesetOutputOptions?.defaults?.color || {}),
			...(faceOptions.color || {}),
			...(suitOptions.color || {}),
			...(tilesetFaceOptions.color || {}),
		},
		transform: {
			...(faceOptions.transform || {}),
			...(suitOptions.transform || {}),
			...(tilesetFaceOptions.transform || {}),
		},
		artwork: {
			...(faceOptions.artwork || {}),
			...(tilesetFaceOptions.artwork || {}),
		},
	};
}

function outputSuitOptions(options, suitId) {
	return canonicalSuitOptionKeys(suitId)
		.map((key) => options?.suits?.[key])
		.filter(Boolean)
		.reduce((merged, suitOptions) => mergeOutputOptionGroups(merged, suitOptions), {});
}

function canonicalSuitOptionKeys(suitId) {
	const aliases = {
		character: ['characters', 'character'],
		characters: ['characters', 'character'],
		dot: ['dots', 'dot'],
		dots: ['dots', 'dot'],
		dragon: ['dragons', 'dragon'],
		dragons: ['dragons', 'dragon'],
		flower: ['flowers', 'flower'],
		flowers: ['flowers', 'flower'],
		season: ['seasons', 'season'],
		seasons: ['seasons', 'season'],
		wind: ['winds', 'wind'],
		winds: ['winds', 'wind'],
	};

	return aliases[suitId] || [suitId];
}

function mergeOutputOptionGroups(base, override) {
	return {
		...(base || {}),
		...(override || {}),
		defaults: {
			...(base?.defaults || {}),
			...(override?.defaults || {}),
			optionalParts: {
				...(base?.defaults?.optionalParts || {}),
				...(override?.defaults?.optionalParts || {}),
			},
			color: {
				...(base?.defaults?.color || {}),
				...(override?.defaults?.color || {}),
			},
		},
		parts: {
			...(base?.parts || {}),
			...(override?.parts || {}),
		},
		layout: {
			...(base?.layout || {}),
			...(override?.layout || {}),
		},
		color: {
			...(base?.color || {}),
			...(override?.color || {}),
		},
		transform: {
			...(base?.transform || {}),
			...(override?.transform || {}),
		},
		suits: mergeOutputOptionScopes(base?.suits, override?.suits),
		faces: mergeOutputOptionScopes(base?.faces, override?.faces),
	};
}

function mergeOutputOptionScopes(baseScopes, overrideScopes) {
	const keys = uniqueValues([
		...Object.keys(baseScopes || {}),
		...Object.keys(overrideScopes || {}),
	]);

	return Object.fromEntries(keys.map((key) => [
		key,
		mergeOutputOptionGroups(baseScopes?.[key] || {}, overrideScopes?.[key] || {}),
	]));
}

function statusForSteps(steps) {
	return Object.values(steps || {}).some((step) => step.status === 'needs-review')
		? 'needs-review'
		: 'ready';
}

function referenceStructurePathForSet(referenceSetId) {
	return path.resolve(
		BASE_REFERENCE,
		referenceSetId || 'default-large-faces',
		'reference.json',
	);
}

function assignmentForPart(semanticMap, partId) {
	return (semanticMap.assignments || [])
		.find((assignment) => assignment.referencePartId === partId || assignment.sourcePartId === partId) || null;
}

function sourceComponentIdsForPart(semanticMap, partId, assignment) {
	const fromBindings = Object.entries(semanticMap.bindings || {})
		.filter(([, binding]) => binding?.partId === partId && binding.strength !== 'none')
		.map(([componentId]) => componentId);

	if (fromBindings.length > 0) {
		return uniqueValues(fromBindings);
	}

	const fromAssignment = uniqueValues(assignment?.sourceComponentIds || []);

	if (fromAssignment.length > 0) {
		return fromAssignment;
	}

	return [];
}

function summarizeOptionalParts(optionalParts, diagnostics) {
	const parts = Object.values(optionalParts);

	return {
		optionalPartCount: parts.length,
		sourceRenderCount: parts.filter((part) => part.renderKind === 'source').length,
		generatedRenderCount: parts.filter((part) => part.renderKind === 'generated').length,
		omittedRenderCount: parts.filter((part) => part.renderKind === 'omit').length,
		unresolvedRenderCount: parts.filter((part) => part.renderKind === 'unresolved').length,
		diagnosticCount: diagnostics.length,
	};
}

function describeFace(faceKey) {
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

function uniqueValues(values) {
	return [...new Set((values || []).filter(Boolean))];
}

function nearlyEqual(left, right) {
	return Math.abs(left - right) < 0.000001;
}

function formatNumber(value) {
	return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : '0';
}

function indent(value, depth) {
	const prefix = '\t'.repeat(depth);
	return value
		.split('\n')
		.map((line) => line.trim() ? `${prefix}${line}` : line)
		.join('\n');
}

function escapeAttribute(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function escapeText(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}
