import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import {
	BASE_TILE_MODELS_DIR,
	LARGE_FACES_DIR,
	OUTPUT_3D_DIR,
	OUTPUT_VALIDATION_DIR,
	sanitizeOutputScope,
} from "../../scripts/3d-assets/shared/asset-paths.js";
import { loadFacePreprocessingMetadata } from "../../scripts/3d-assets/svg-preprocessor/face-preprocessing-metadata.js";
import { BASE_OUTPUT, PipelineModel } from "../../scripts/3d-assets/svg-preprocessor/PipelineModel.js";
import { getFacePaths } from "../../scripts/3d-assets/svg-preprocessor/preprocessed-face-validation-utils.js";
import { tilesetImageDir, tilesetOutputRoot } from "../../scripts/3d-assets/svg-preprocessor/pipeline-output-paths.js";
import { extractSourceSvgComponents } from "../../scripts/3d-assets/svg-preprocessor/source-svg-components.js";
import { readTilesetManifest, setActiveTileset, TILESET_MANIFEST_PATH } from "../../scripts/3d-assets/svg-preprocessor/tileset-manifest.js";
import { renderGeneratedAssetPreview } from "../../scripts/3d-assets/asset-pipeline/generated-asset-preview-renderer.js";
import { getAssetPipelineStream } from "./asset-pipeline-stream.js";
import { initializePipelineStream } from "./stream.js";

const INFERENCE_DIR = path.resolve(OUTPUT_3D_DIR, "metadata-inference");
const DEFAULT_REFERENCE_STRUCTURE_ID = "default-large-faces";
const DEFAULT_REFERENCE_STRUCTURE_DIR = path.resolve(OUTPUT_3D_DIR, "reference-structure", DEFAULT_REFERENCE_STRUCTURE_ID);
const REFERENCE_STRUCTURE_FILENAME = "reference-structure.json";
const SVG_CUTTER_SCRIPT = path.resolve("scripts", "3d-assets", "asset-pipeline", "export-svg-cutter.js");
const STAMPED_BODY_SCRIPT = path.resolve("scripts", "3d-assets", "asset-pipeline", "export-stamped-tile-pair.js");
const COLORED_INLAY_SCRIPT = path.resolve("scripts", "3d-assets", "asset-pipeline", "export-stamped-tile-inlay.js");
const activeAssetGenerationRuns = new Map();
const METADATA_KINDS = Object.freeze({
	reference: {
		metadataPath: process.env.PIPELINE_REFERENCE_METADATA_PATH ||
			path.resolve(INFERENCE_DIR, "reference-glyphs.json"),
		inferScript: path.resolve("scripts", "3d-assets", "svg-preprocessor", "infer-reference-face-metadata.js"),
		inferArgs: [],
	},
	tileset: {
		inferScript: path.resolve("scripts", "3d-assets", "svg-preprocessor", "infer-tileset-face-metadata.js"),
		inferArgs: [],
	},
});

export default function pipelineRouter(express, router, app) {
	initializePipelineStream(app).catch((error) => {
		console.warn("Pipeline Socket.IO stream failed to initialize.", error);
	});
	getAssetPipelineStream();
	resumePendingAssetGenerationQueues().catch((error) => {
		console.warn("Pending asset generation queue resume failed.", error);
	});

	router.get("/api/pipeline/state", getState);
	router.get("/api/pipeline/tilesets", getTilesets);
	router.post("/api/pipeline/tilesets/active", setActiveTilesetRoute);
	router.post("/api/pipeline/recreate", recreateMetadata);
	router.post("/api/pipeline/save", saveReviewed);
	router.post("/api/pipeline/preprocess", preprocessReviewed);
	router.get("/api/pipeline/reference-structure", getReferenceStructure);
	router.post("/api/pipeline/reference-structure/save", saveReferenceStructure);
	router.get("/api/pipeline/source-assignment", getSourceAssignment);
	router.post("/api/pipeline/source-assignment/regenerate", regenerateSourceAssignment);
	router.post("/api/pipeline/source-assignment/accept", acceptSourceAssignment);
	router.get("/api/pipeline/optional-parts", getOptionalPartAssignment);
	router.post("/api/pipeline/optional-parts/rebuild", rebuildOptionalPartAssignment);
	router.post("/api/pipeline/optional-parts/bindings", saveOptionalPartBindingActions);
	router.post("/api/pipeline/optional-parts/reset", resetOptionalPartAssignment);
	router.post("/api/pipeline/optional-parts/accept", acceptOptionalPartAssignment);
	router.post("/api/pipeline/source-assignment/bindings", saveSourceAssignmentBindingActions);
	router.get("/api/pipeline/final-rendering-options", getFinalRenderingOptions);
	router.post("/api/pipeline/final-rendering-options/rerender", rerenderFinalRenderingOptions);
	router.post("/api/pipeline/final-rendering-options/accept", acceptFinalRenderingOptions);
	router.get("/api/pipeline/base-tile-selection", getBaseTileSelection);
	router.post("/api/pipeline/base-tile-selection", saveBaseTileSelection);
	router.post("/api/pipeline/asset-generation/start", startAssetGeneration);
	router.post("/api/pipeline/asset-generation/cancel", cancelAssetGeneration);
	router.post("/api/pipeline/asset-generation/reset", resetAssetGeneration);
	router.get("/api/pipeline/asset-review", getAssetReview);
	router.get("/api/pipeline/reference/:fileName", sendReferenceImage);
	router.get("/api/pipeline/asset", sendAsset);
	router.get("*", function(_request, response) {
		if (app && typeof app.sendIndex === "function") {
			app.sendIndex(response);
			return;
		}

		response.sendFile(path.resolve("dist", "pipeline", "index.html"));
	});
}

async function getState(req, res) {
	try {
		const metadataKind = getMetadataKind(req);
		const manifest = await readTilesetManifest();
		const source = getTilesetSource(req, metadataKind, manifest);
		const config = metadataKind !== "tileset" || source?.metadataPath
			? metadataConfigFor(metadataKind, source)
			: null;
		const metadataResult = config
			? await readMetadataOrNull(metadataKind, config, source)
			: { metadata: null, error: source ? `Tileset metadata path is not recorded for ${source.id}.` : "No active tileset is recorded in the tileset manifest." };
		const metadata = metadataResult.metadata;
		const outputScope = outputScopeForMetadata(metadata);
		res.json({
			ok: true,
			metadataKind,
			tilesetSource: source?.id || null,
			sourceTilesetId: manifest.activeTilesetId || source?.id || null,
			sources: sourceOptions(manifest),
			tilesetManifest: manifest,
			tilesetManifestPath: relativePath(TILESET_MANIFEST_PATH),
			metadata,
			metadataError: metadataResult.error,
			paths: config ? outputPaths(config, outputScope, source) : null,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function getTilesets(req, res) {
	try {
		const manifest = await readTilesetManifest();

		res.json({
			ok: true,
			activeTilesetId: manifest.activeTilesetId,
			sources: sourceOptions(manifest),
			manifest,
			path: relativePath(TILESET_MANIFEST_PATH),
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function setActiveTilesetRoute(req, res) {
	try {
		const tilesetId = sanitizeOutputScope(req.body?.tilesetId || req.query.tilesetId);

		if (!tilesetId) {
			return res.status(400).json({
				ok: false,
				message: "Missing tilesetId.",
			});
		}

		const manifest = await setActiveTileset(tilesetId);

		res.json({
			ok: true,
			activeTilesetId: manifest.activeTilesetId,
			sources: sourceOptions(manifest),
			manifest,
			path: relativePath(TILESET_MANIFEST_PATH),
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function recreateMetadata(req, res) {
	try {
		const metadataKind = getMetadataKind(req);
		const manifest = await readTilesetManifest();
		const source = getTilesetSource(req, metadataKind, manifest);
		const config = metadataConfigFor(metadataKind, source);
		const metadataPath = resolveMetadataPath(config.metadataPath);
		const command = [
			config.inferScript,
			...config.inferArgs,
		];

		if (metadataKind === "tileset") {
			command.push(
				"--source-dir",
				resolveMetadataPath(source.sourceDir),
				"--tileset-id",
				source.id,
				"--output",
				metadataPath,
			);
		}

		const result = await runNodeCommand(command);
		const metadataWasWritten = await fileExists(metadataPath);
		const metadata = metadataWasWritten
			? await enrichMetadata(metadataKind, normalizePayload(metadataKind, await readJsonAsync(metadataPath), source))
			: null;
		const outputScope = outputScopeForMetadata(metadata);

		res.json({
			ok: result.status === 0 && metadataWasWritten,
			status: result.status,
			command: commandLabel(command),
			metadataKind,
			tilesetSource: source?.id || null,
			sourceTilesetId: manifest.activeTilesetId || source?.id || null,
			sources: sourceOptions(manifest),
			tilesetManifest: manifest,
			metadataPath: relativePath(metadataPath),
			stdout: result.stdout,
			stderr: result.stderr,
			metadata,
			paths: outputPaths(config, outputScope, source),
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function saveReviewed(req, res) {
	try {
		const metadataKind = getMetadataKind(req);
		const manifest = await readTilesetManifest();
		const source = getTilesetSource(req, metadataKind, manifest);
		const config = metadataConfigFor(metadataKind, source);
		const payload = normalizePayload(metadataKind, req.body, source);
		const outputScope = outputScopeForMetadata(payload);
		await writeMetadata(config, payload);
		res.json({
			ok: true,
			metadataKind,
			tilesetSource: source?.id || null,
			sourceTilesetId: manifest.activeTilesetId || source?.id || null,
			sources: sourceOptions(manifest),
			tilesetManifest: manifest,
			path: relativePath(resolveMetadataPath(config.metadataPath)),
			metadata: await enrichMetadata(metadataKind, payload),
			paths: outputPaths(config, outputScope, source),
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function preprocessReviewed(req, res) {
	try {
		const metadataKind = getMetadataKind(req);
		const manifest = await readTilesetManifest();
		const source = getTilesetSource(req, metadataKind, manifest);
		const config = metadataConfigFor(metadataKind, source);
		const payload = normalizePayload(metadataKind, req.body, source);
		const outputScope = outputScopeForMetadata(payload);
		const metadataPath = resolveMetadataPath(config.metadataPath);
		await writeMetadata(config, payload);

		const faceKeys = Object.keys(loadFacePreprocessingMetadata(metadataPath));

		if (faceKeys.length === 0) {
			return res.status(400).json({
				ok: false,
				metadataKind,
				tilesetSource: source?.id || null,
				sourceTilesetId: manifest.activeTilesetId || source?.id || null,
				message: "No face keys found in preprocessing metadata.",
				results: {},
				paths: outputPaths(config, outputScope, source),
			});
		}

		const command = [
			path.resolve("scripts", "3d-assets", "svg-preprocessor", "run-preprocessed-face-pipeline.js"),
			"--metadata",
			metadataPath,
		];
		const result = await runNodeCommand(command, {
			env: {
				...process.env,
				...(outputScope ? { FACE_OUTPUT_SCOPE: outputScope } : {}),
				...(payload?.sourceDir && !process.env.FACE_SOURCE_SVGS_DIR ? { FACE_SOURCE_SVGS_DIR: payload.sourceDir } : {}),
			},
		});

		res.json({
			ok: result.status === 0,
			status: result.status,
			metadataKind,
			tilesetSource: source?.id || null,
			sourceTilesetId: manifest.activeTilesetId || source?.id || null,
			sources: sourceOptions(manifest),
			tilesetManifest: manifest,
			command: commandLabel(command),
			stdout: result.stdout,
			stderr: result.stderr,
			metadata: await enrichMetadata(metadataKind, payload),
			results: Object.fromEntries(await Promise.all(
				faceKeys.map(async (faceKey) => [faceKey, await combinedImageResult(faceKey, outputScope)])
			)),
			paths: outputPaths(config, outputScope, source),
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function getReferenceStructure(req, res) {
	try {
		const referenceSetId = req.query.referenceSetId || DEFAULT_REFERENCE_STRUCTURE_ID;
		const structureDir = referenceStructureDir(referenceSetId);
		const structurePath = path.resolve(structureDir, REFERENCE_STRUCTURE_FILENAME);

		if (!isInsideDirectory(structurePath, path.resolve(OUTPUT_3D_DIR, "reference-structure")) || !(await fileExists(structurePath))) {
			return res.status(404).json({
				ok: false,
				message: `Missing reference structure: ${relativePath(structurePath)}`,
			});
		}

		res.json({
			ok: true,
			path: relativePath(structurePath),
			structure: await readJsonAsync(structurePath),
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function saveReferenceStructure(req, res) {
	try {
		const payload = req.body?.structure || req.body;

		if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
			return res.status(400).json({
				ok: false,
				message: "Reference structure payload must be an object.",
			});
		}

		const referenceSetId = payload.referenceSet?.referenceSetId || DEFAULT_REFERENCE_STRUCTURE_ID;
		const structureDir = referenceStructureDir(referenceSetId);
		const structurePath = path.resolve(structureDir, REFERENCE_STRUCTURE_FILENAME);
		const active = stampReferenceStructureLifecycle(payload);

		if (!isInsideDirectory(structurePath, path.resolve(OUTPUT_3D_DIR, "reference-structure"))) {
			return res.status(400).json({
				ok: false,
				message: "Invalid reference structure output path.",
			});
		}

		await mkdir(path.dirname(structurePath), { recursive: true });
		await writeJson(structurePath, active);
		res.json({
			ok: true,
			path: relativePath(structurePath),
			structure: active,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function getSourceAssignment(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const faces = {};
		const sourceSemanticBindings = {};
		const sourceSemanticPartStates = {};

		for (const [faceKey, faceState] of model.getFaceEntries()) {
			const normalizedPath = model.getNormalizedComponentsPath(faceKey);
			if (!normalizedPath || !(await fileExists(resolveRepoPath(normalizedPath)))) {
				continue;
			}

			const artifact = await model.loadNormalizedComponents(faceKey);
			const components = artifact.components || [];
			const alignmentComponentIds = new Set(artifact.alignmentComponentIds || []);

			sourceSemanticBindings[faceKey] = sourceAssignmentBindingsForView(model.getBindings(faceKey));
			sourceSemanticPartStates[faceKey] = sourceAssignmentPartStatesForView(model.getParts(faceKey));

			faces[faceKey] = {
				faceKey,
				status: "canonical",
				pipelineStatus: null,
				sourceParts: canonicalSourcePreviewParts(faceState),
				sourceFile: artifact.sourceFile || model.getFaceSourceSvgPath(faceKey),
				identifiedComponentsSvg: artifact.identifiedComponentsSvg || null,
				identifiedShapesSvg: artifact.identifiedShapesSvg || null,
				viewBox: artifact.viewBox,
				componentCount: components.length,
				alignmentComponentIds: [...alignmentComponentIds],
				alignmentBounds: artifact.alignmentBounds,
				diagnostics: [],
				components: components.map((component) => ({
					componentId: component.componentId,
					sourceElementId: component.sourceElementId,
					sourceIndex: component.sourceIndex,
					tagName: component.tagName,
					className: component.className,
					fill: component.fill,
					stroke: component.stroke,
					strokeWidth: component.strokeWidth,
					fillRule: component.fillRule || null,
					clipRule: component.clipRule || null,
					bounds: component.bounds,
					center: component.center,
					area: component.area,
					transform: component.transform,
					parentGroupIds: component.parentGroupIds || [],
					classification: component.classification || {},
					alignmentCandidate: alignmentComponentIds.has(component.componentId),
					pathData: component.pathData,
				})),
				alignmentMatches: model.getAlignmentMatches(faceKey),
				sourceSemanticBindings: sourceSemanticBindings[faceKey],
				sourceSemanticPartStates: sourceSemanticPartStates[faceKey],
			};
		}

		res.json({
			ok: true,
			tilesetId,
			path: relativePath(model.pipelineFilename),
			currencyDate: model.getCurrencyDate(),
			sourceStateUpdatedOn: model.getCurrencyDate(),
			sourceSemanticBindings,
			sourceSemanticPartStates,
			faces,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function acceptSourceAssignment(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const currencyDate = req.body?.currencyDate || req.body?.sourceStateUpdatedOn || "";
		const actionsByFace = normalizeBindingActionRequest(req.body, { allowEmpty: true });

		assertPipelineCurrencyDate(model, currencyDate);
		const updatedFaceKeys = applyBindingActionsByFace(model, actionsByFace);
		let semanticRefresh = null;

		if (updatedFaceKeys.length > 0) {
			await model.save();
			semanticRefresh = await runAlignmentAndSemanticAssignment(tilesetId);

			if (!semanticRefresh.ok) {
				return res.json({
					ok: false,
					tilesetId,
					currencyDate: model.getCurrencyDate(),
					sourceStateUpdatedOn: model.getCurrencyDate(),
					updatedFaceKeys,
					stage: semanticRefresh.stage,
					alignment: semanticRefresh.alignment,
					semanticAssignment: semanticRefresh.semanticAssignment,
				});
			}
		}

		const acceptedModel = updatedFaceKeys.length > 0
			? await loadPipelineModel(tilesetId)
			: model;
		const faces = [];

		for (const [faceKey] of acceptedModel.getFaceEntries()) {
			acceptedModel.acceptSourceAssignment(faceKey);
			faces.push({
				faceKey,
				path: relativePath(acceptedModel.pipelineFilename),
			});
		}

		await acceptedModel.save();
		const finalRendering = await runFinalRenderingComposition(tilesetId);

		if (!finalRendering.ok) {
			return res.json({
				ok: false,
				tilesetId,
				currencyDate: acceptedModel.getCurrencyDate(),
				sourceStateUpdatedOn: acceptedModel.getCurrencyDate(),
				acceptedFaceCount: faces.length,
				faces,
				stage: "final-rendering",
				semanticRefresh,
				finalRendering,
			});
		}

		res.json({
			ok: true,
			tilesetId,
			currencyDate: acceptedModel.getCurrencyDate(),
			sourceStateUpdatedOn: acceptedModel.getCurrencyDate(),
			acceptedFaceCount: faces.length,
			faces,
			updatedFaceKeys,
			nextPage: "final-rendering-options",
			semanticRefresh,
			finalRendering,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function regenerateSourceAssignment(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const currencyDate = req.body?.currencyDate || req.body?.sourceStateUpdatedOn || "";
		const actionsByFace = normalizeBindingActionRequest(req.body, { allowEmpty: true });

		assertPipelineCurrencyDate(model, currencyDate);
		const updatedFaceKeys = applyBindingActionsByFace(model, actionsByFace);
		if (updatedFaceKeys.length > 0) {
			await model.save();
		}

		const stages = await runAlignmentAndSemanticAssignment(tilesetId);

		if (!stages.ok && stages.stage === "alignment") {
			return res.json({
				ok: false,
				tilesetId,
				currencyDate: model.getCurrencyDate(),
				sourceStateUpdatedOn: model.getCurrencyDate(),
				updatedFaceKeys,
				stage: "alignment",
				alignment: stages.alignment,
			});
		}

		res.json({
			ok: stages.ok,
			tilesetId,
			currencyDate: model.getCurrencyDate(),
			sourceStateUpdatedOn: model.getCurrencyDate(),
			updatedFaceKeys,
			stage: stages.stage,
			alignment: stages.alignment,
			semanticAssignment: stages.semanticAssignment,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function getOptionalPartAssignment(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const optionalPartConfig = model.getOptionalPartAssignmentConfig();
		const bulkOptions = optionalPartConfig.bulkOptions
			? sanitizeOptionalPartBulkOptions(optionalPartConfig.bulkOptions)
			: null;
		const manualAssignments = optionalPartConfig.manualAssignments
			? sanitizeOptionalPartManualAssignments(optionalPartConfig.manualAssignments)
			: null;
		const faceKeys = model.getFaceEntries()
			.filter(([faceKey, faceState]) => canonicalOptionalPartEntries(faceState, faceKey).length > 0)
			.map(([faceKey]) => faceKey)
			.sort((left, right) => left.localeCompare(right));
		const faces = {};

		for (const faceKey of faceKeys) {
			const faceState = model.getFace(faceKey);
			const normalizedPath = model.getNormalizedComponentsPath(faceKey);

			const assignment = optionalAssignmentFromCanonicalState(tilesetId, faceKey, faceState);
			const normalized = normalizedPath && await fileExists(resolveRepoPath(normalizedPath))
				? await readJsonAsync(normalizedPath)
				: null;
			const optionalParts = canonicalOptionalPreviewParts(faceState, assignment);
			const componentReservations = canonicalOptionalPreviewReservations(faceState, assignment);
			const components = optionalPreviewComponents(normalized, assignment, faceState);
			const bindingActions = optionalBindingActionMap(faceState, assignment);

			faces[faceKey] = {
				faceKey,
				status: assignment.status,
				pipelineStatus: null,
				sourceFile: assignment.sourceFile || normalized?.sourceFile || null,
				identifiedComponentsSvg: normalized?.identifiedComponentsSvg || null,
				viewBox: normalized?.viewBox || null,
				sourceBounds: assignment.sourceBounds || normalized?.alignmentBounds || null,
				alignmentBounds: normalized?.alignmentBounds || null,
				componentCount: normalized ? components.length : assignment.summary?.sourceComponentCount || 0,
				optionalParts,
				componentReservations,
				metadataSeed: assignment.metadataSeed || null,
				diagnostics: assignment.diagnostics || [],
				summary: assignment.summary || {},
				bindingActions,
				components,
			};
		}

		res.json({
			ok: true,
			tilesetId,
			path: relativePath(model.pipelineFilename),
			currencyDate: model.getCurrencyDate(),
			sourceStateUpdatedOn: model.getCurrencyDate(),
			summary: optionalAssignmentSummary(faces),
			bulkPresets: optionalBulkPresets(faces),
			bulkOptions,
			manualAssignments,
			faces,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function rebuildOptionalPartAssignment(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const bulkOptions = sanitizeOptionalPartBulkOptions(req.body?.bulkOptions || {});
		const manualAssignments = sanitizeOptionalPartManualAssignments(req.body?.manualAssignments || {});
		const model = await loadPipelineModel(tilesetId);
		const scriptPath = path.resolve("scripts", "3d-assets", "svg-preprocessor", "run-optional-part-assignment.js");

		model.setOptionalPartAssignmentConfig({
			bulkOptions,
			manualAssignments,
		});
		await model.save();

		const command = [
			scriptPath,
			"--tileset-id",
			tilesetId,
		];
		const result = await runNodeCommand(command);

		res.json({
			ok: result.status === 0,
			status: result.status,
			error: result.error || null,
			tilesetId,
			settingsPath: relativePath(model.pipelineFilename),
			command: commandLabel(command),
			stdout: result.stdout,
			stderr: result.stderr,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function saveOptionalPartBindingActions(req, res) {
	return saveBindingActions(req, res, {
		routeName: "Optional Parts",
		unbindMode: "reserve",
	});
}

async function saveSourceAssignmentBindingActions(req, res) {
	return saveBindingActions(req, res, {
		routeName: "Source Assignment",
		unbindMode: "exclude",
	});
}

async function saveBindingActions(req, res, { routeName, unbindMode }) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const currencyDate = req.body?.currencyDate || req.body?.sourceStateUpdatedOn || "";
		const actionsByFace = normalizeBindingActionRequest(req.body);
		const updatedFaceKeys = [];

		assertPipelineCurrencyDate(model, currencyDate);

		for (const [faceKey, actions] of Object.entries(actionsByFace)) {
			model.applySourceBindingActions(faceKey, actions, { unbindMode });
			updatedFaceKeys.push(faceKey);
		}

		await model.save();

		res.json({
			ok: true,
			tilesetId,
			routeName,
			path: relativePath(model.pipelineFilename),
			currencyDate: model.getCurrencyDate(),
			sourceStateUpdatedOn: model.getCurrencyDate(),
			updatedFaceKeys,
			updatedFaceCount: updatedFaceKeys.length,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function resetOptionalPartAssignment(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const sourceManifest = path.join("scripts", "data", "asset-pipeline", "manifests", `${tilesetId}.json`);
		const sourceManifestPath = path.resolve(process.cwd(), sourceManifest);
		const pipelineState = path.join("scripts", "output", "asset-pipeline", tilesetId, "pipeline.json");

		if (!(await fileExists(sourceManifestPath))) {
			return res.status(404).json({
				ok: false,
				message: `Missing source manifest for ${tilesetId}: ${relativePath(sourceManifestPath)}`,
			});
		}

		const intakeCommand = [
			path.resolve("scripts", "3d-assets", "svg-preprocessor", "intake-source-svg-manifest.js"),
			"--tileset-id",
			tilesetId,
			"--manifest",
			relativePath(sourceManifestPath),
		];
		const normalizationCommand = [
			path.resolve("scripts", "3d-assets", "svg-preprocessor", "run-source-normalization.js"),
			"--tileset-id",
			tilesetId,
		];
		const optionalCommand = [
			path.resolve("scripts", "3d-assets", "svg-preprocessor", "run-optional-part-assignment.js"),
			"--tileset-id",
			tilesetId,
		];
		const intake = await runNodeCommand(intakeCommand);

		if (intake.status !== 0) {
			return res.json({
				ok: false,
				tilesetId,
				stage: "intake",
				command: commandLabel(intakeCommand),
				intake,
			});
		}

		const normalization = await runNodeCommand(normalizationCommand);

		if (normalization.status !== 0) {
			return res.json({
				ok: false,
				tilesetId,
				stage: "normalization",
				command: commandLabel(normalizationCommand),
				intake,
				normalization,
			});
		}

		const optionalPartAssignment = await runNodeCommand(optionalCommand);

		return res.json({
			ok: optionalPartAssignment.status === 0,
			tilesetId,
			stage: optionalPartAssignment.status === 0 ? "optional-part-assignment" : "optional-part-assignment-failed",
			sourceManifest: relativePath(sourceManifestPath),
			pipelineState,
			commands: {
				intake: commandLabel(intakeCommand),
				normalization: commandLabel(normalizationCommand),
				optionalPartAssignment: commandLabel(optionalCommand),
			},
			intake,
			normalization,
			optionalPartAssignment,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function acceptOptionalPartAssignment(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const previousCurrencyDate = model.getCurrencyDate();
		const currencyDate = req.body?.currencyDate || req.body?.sourceStateUpdatedOn || previousCurrencyDate;
		assertPipelineCurrencyDate(model, currencyDate);

		const faces = [];
		for (const [faceKey, faceState] of model.getFaceEntries()) {
			const optionalPartCount = canonicalOptionalPartEntries(faceState, faceKey).length;
			if (optionalPartCount === 0) {
				continue;
			}

			model.acceptOptionalPartAssignment(faceKey);
			faces.push({
				faceKey,
				path: relativePath(model.pipelineFilename),
				promotedPartCount: optionalPartCount,
				promotedReservationCount: Object.keys(model.getBindings(faceKey)).length,
			});
		}
		await model.save();

		const stages = await runAlignmentAndSemanticAssignment(tilesetId);
		const baseResponse = {
			tilesetId,
			currencyDate: model.getCurrencyDate(),
			sourceStateUpdatedOn: model.getCurrencyDate(),
			acceptedFaceCount: faces.length,
			promotedPartCount: faces.reduce((total, face) => total + face.promotedPartCount, 0),
			promotedReservationCount: faces.reduce((total, face) => total + face.promotedReservationCount, 0),
			faces,
			alignment: stages.alignment,
			semanticAssignment: stages.semanticAssignment,
		};

		if (!stages.ok) {
			return res.json({
				...baseResponse,
				ok: false,
				stage: stages.stage,
			});
		}

		return res.json({
			...baseResponse,
			ok: true,
			stage: stages.stage,
			nextPage: "source-assignment",
			message: "Optional parts accepted; alignment and source assignment regenerated.",
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function getFinalRenderingOptions(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const sourceDir = tilesetOutputRoot(tilesetId);

		if (!isInsideDirectory(sourceDir, path.resolve("scripts", "output", "asset-pipeline"))) {
			return res.status(404).json({
				ok: false,
				message: `Invalid final rendering directory: ${relativePath(sourceDir)}`,
			});
		}

		const model = await loadPipelineModel(tilesetId);
		const tilesetStatePath = model.pipelineFilename;
		const tilesetState = model.requireState();
		if (!sourceAssignmentReadyForFinalRendering(tilesetState)) {
			return res.json({
				ok: true,
				tilesetId,
				path: relativePath(tilesetStatePath),
				readyForRenderReview: false,
				message: "Source Assignment has not been accepted for the current pipeline state.",
				rendering: tilesetState.rendering || null,
				suitOptions: {},
				faceOptions: {},
				summary: finalRenderingOptionsSummary({}),
				faces: null,
			});
		}
		const outputOptions = effectiveFinalRenderingOutputOptions(tilesetState);
		const faceKeys = sourcePreviewFaceKeys(tilesetState);
		const svgFaces = tilesetSvgFaces(tilesetState);
		const faces = {};

		for (const faceKey of faceKeys) {
			const faceState = svgFaces[faceKey] || null;
			const family = finalRenderingFaceFamily(faceKey);
			const colorSvg = faceState?.artifacts?.finalRenderingColorSvg || null;
			const colorPng = faceState?.artifacts?.finalRenderingColorReviewPng || null;
			const hasColorSvg = colorSvg ? await fileExists(resolveRepoPath(colorSvg)) : false;
			const hasColorPng = colorPng ? await fileExists(resolveRepoPath(colorPng)) : false;

			faces[faceKey] = {
				faceKey,
				family,
				status: hasColorSvg ? "ready" : "not-run",
				sourceFile: faceState?.artifacts?.sourceSvg || null,
				colorSvg: hasColorSvg ? colorSvg : null,
				colorPng: hasColorPng ? colorPng : null,
				parts: finalRenderingFaceParts(outputOptions, faceKey, family),
				canMirrorArtwork: finalRenderingFaceCanMirrorArtwork(faceState),
				canPreserveArtworkColors: finalRenderingFaceCanPreserveArtworkColors(faceState),
				suitOptions: outputOptions.suits?.[family] || null,
				faceOptions: outputOptions.faces?.[faceKey] || null,
			};
		}

		res.json({
			ok: true,
			tilesetId,
			path: relativePath(tilesetStatePath),
			rendering: tilesetState.rendering || null,
			suitOptions: outputOptions.suits || {},
			faceOptions: outputOptions.faces || {},
			summary: finalRenderingOptionsSummary(faces),
			faces,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function rerenderFinalRenderingOptions(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const sourceDir = tilesetOutputRoot(tilesetId);
		const tilesetStatePath = path.resolve(sourceDir, "pipeline.json");

		if (!isInsideDirectory(sourceDir, path.resolve("scripts", "output", "asset-pipeline"))) {
			return res.status(400).json({
				ok: false,
				message: `Invalid final rendering directory: ${relativePath(sourceDir)}`,
			});
		}

		if (!(await fileExists(tilesetStatePath))) {
			return res.status(404).json({
				ok: false,
				message: `Missing final rendering state: ${relativePath(tilesetStatePath)}`,
			});
		}
		if (!sourceAssignmentReadyForFinalRendering(model.requireState())) {
			return res.status(409).json({
				ok: false,
				tilesetId,
				message: "Source Assignment must be accepted before final rendering can be regenerated.",
			});
		}

		const saved = await writeFinalRenderingOptions({
			model,
			tilesetId,
			options: req.body?.options || {},
		});
		const result = await runFinalRenderingComposition(tilesetId);

		res.json({
			ok: result.ok,
			status: result.status,
			error: result.error?.message || null,
			tilesetId,
			path: relativePath(tilesetStatePath),
			rendering: saved.rendering,
			command: result.command,
			stdout: result.stdout,
			stderr: result.stderr,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function acceptFinalRenderingOptions(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const sourceDir = tilesetOutputRoot(tilesetId);
		const tilesetStatePath = path.resolve(sourceDir, "pipeline.json");

		if (!isInsideDirectory(sourceDir, path.resolve("scripts", "output", "asset-pipeline"))) {
			return res.status(400).json({
				ok: false,
				message: `Invalid final rendering directory: ${relativePath(sourceDir)}`,
			});
		}

		if (!(await fileExists(tilesetStatePath))) {
			return res.status(404).json({
				ok: false,
				message: `Missing final rendering state: ${relativePath(tilesetStatePath)}`,
			});
		}
		if (!sourceAssignmentReadyForFinalRendering(model.requireState())) {
			return res.status(409).json({
				ok: false,
				tilesetId,
				message: "Source Assignment must be accepted before final rendering can be accepted.",
			});
		}

		const saved = await writeFinalRenderingOptions({
			model,
			tilesetId,
			options: req.body?.options || {},
		});
		const svgFaces = tilesetSvgFaces(saved.tilesetState);
		const faceKeys = Object.keys(svgFaces).sort((left, right) => left.localeCompare(right));
		const assetPipelineInitialization = model.initializeAssetPipelineFromRenderingAcceptance({ faceKeys });
		const acceptedState = await model.save();

		res.json({
			ok: true,
			tilesetId,
			acceptedFaceCount: faceKeys.length,
			assetPipelineInitialization,
			nextPage: "asset-base-tile-selection",
			rendering: acceptedState.rendering || {},
			assetPipeline: acceptedState.assetPipeline || {},
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function getBaseTileSelection(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const manifest = await loadBaseTileManifest();
		const selectedVariantId = model.getSelectedBaseTileVariantId();
		const variants = manifest.variants.map((variant) => ({
			...variant,
			selected: variant.id === selectedVariantId,
		}));

		res.json({
			ok: true,
			tilesetId,
			path: relativePath(model.pipelineFilename),
			currencyDate: model.getCurrencyDate(),
			manifestPath: relativePath(baseTileManifestPath()),
			selectedVariantId,
			variants,
			summary: {
				variantCount: variants.length,
				faceCount: model.getFaceKeys().length,
				selectedCount: selectedVariantId ? 1 : 0,
			},
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function saveBaseTileSelection(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const currencyDate = req.body?.currencyDate || "";
		const variantId = String(req.body?.variantId || "").trim();
		const manifest = await loadBaseTileManifest();
		const variant = manifest.variants.find((candidate) => candidate.id === variantId);

		assertPipelineCurrencyDate(model, currencyDate);

		if (!variant) {
			return res.status(400).json({
				ok: false,
				message: `Unknown base tile variant: ${variantId || "(missing)"}.`,
			});
		}

		const baseTileChanged = model.setSelectedBaseTileVariantId(variantId);
		const activeRun = activeAssetGenerationRuns.get(tilesetId);
		let plan = null;
		if (baseTileChanged) {
			await clearAssetGenerationQueue(model);
			if (activeRun) {
				activeRun.cancelled = true;
			} else {
				plan = model.planAssetGeneration();
				await writeAssetGenerationQueue(model, {
					baseTileVariantId: plan.baseTileVariantId,
					faceKeys: plan.plannedFaces.map((face) => face.faceKey),
				});
			}
		}
		await model.save();

		res.json({
			ok: true,
			tilesetId,
			path: relativePath(model.pipelineFilename),
			currencyDate: model.getCurrencyDate(),
			selectedVariantId: variantId,
			selectedVariant: variant,
			nextPage: "asset-review",
			...(plan ? { plan } : {}),
			assetPipeline: model.getAssetPipeline(),
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function startAssetGeneration(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const requestedFaceKeys = req.body?.faceKeys || req.body?.faceKey;
		const faceKeys = cleanQueueFaceKeys(requestedFaceKeys ? [].concat(requestedFaceKeys) : []);
		res.json(await runAssetGenerationForTileset(tilesetId, { faceKeys }));
	} catch (error) {
		sendError(res, error);
	}
}

async function cancelAssetGeneration(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await cancelAssetGenerationQueue(tilesetId);
		const assetPipeline = model.getAssetPipeline();

		res.json({
			ok: true,
			tilesetId,
			currencyDate: model.getCurrencyDate(),
			summary: assetGenerationSummary(assetPipeline.faces || {}, model),
			assetPipeline,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function resetAssetGeneration(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await cancelAssetGenerationQueue(tilesetId);
		const deletedPaths = (await model.clearGeneratedAssetArtifacts()).map(relativePath);
		model.resetAssetGenerationState();
		await model.save();

		const assetPipeline = model.getAssetPipeline();
		getAssetPipelineStream().emitProgress(tilesetId, "assetGenerationComplete", {
			stage: "asset-generation",
			completed: 0,
			total: 0,
			percent: 100,
			message: "Generated asset state reset.",
		});

		res.json({
			ok: true,
			tilesetId,
			currencyDate: model.getCurrencyDate(),
			deletedPaths,
			summary: assetGenerationSummary(assetPipeline.faces || {}, model),
			assetPipeline,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function runAssetGenerationForTileset(tilesetId, { faceKeys = [] } = {}) {
	const safeTilesetId = sanitizeOutputScope(tilesetId);
	if (!safeTilesetId) {
		return Promise.reject(new Error("A valid tileset id is required."));
	}

	const model = await loadPipelineModel(safeTilesetId);
	const baseTileVariantId = model.getSelectedBaseTileVariantId();
	const activeRun = activeAssetGenerationRuns.get(safeTilesetId);
	if (activeRun) {
		if (activeRun.baseTileVariantId !== baseTileVariantId) {
			activeRun.cancelled = true;
			throw new Error(`Asset generation is stopping because the selected base tile changed from ${activeRun.baseTileVariantId} to ${baseTileVariantId}. Start generation again after the current face stops.`);
		}
		return activeRun.promise;
	}

	const run = runAssetGeneration(safeTilesetId, { faceKeys })
		.finally(() => {
			activeAssetGenerationRuns.delete(safeTilesetId);
		});
	activeAssetGenerationRuns.set(safeTilesetId, {
		baseTileVariantId,
		cancelled: false,
		childProcesses: new Set(),
		promise: run,
	});
	return run;
}

async function runAssetGeneration(tilesetId, { faceKeys = [] } = {}) {
	let activeTilesetId = "";
	let failedFaceKey = "";
	let failedStepId = "";
	try {
		activeTilesetId = tilesetId;
		let model = await loadPipelineModel(tilesetId);
		const stream = getAssetPipelineStream();
		const pendingQueue = await readAssetGenerationQueue(model);
		const selectedBaseTileVariantId = model.getSelectedBaseTileVariantId();
		if (pendingQueue && pendingQueue.baseTileVariantId !== selectedBaseTileVariantId) {
			await clearAssetGenerationQueue(model);
		}
		const requestedFaceKeys = cleanQueueFaceKeys(faceKeys);
		const plan = requestedFaceKeys.length > 0
			? model.planAssetGeneration({ faceKeys: requestedFaceKeys })
			: pendingQueue && pendingQueue.baseTileVariantId === selectedBaseTileVariantId
			? model.planAssetGeneration({
				faceKeys: mergeQueuedFaceKeysWithRetryableFaces(model, pendingQueue.faceKeys),
			})
			: model.planAssetGeneration();
		await writeAssetGenerationQueue(model, {
			baseTileVariantId: plan.baseTileVariantId,
			faceKeys: plan.plannedFaces.map((face) => face.faceKey),
		});
		const faceHashes = new Map(plan.plannedFaces.map((face) => [
			face.faceKey,
			model.hashAssetPipelineFaceInput(face.faceKey),
		]));
		const finalHashes = new Map(plan.plannedFaces.map((face) => [
			face.faceKey,
			model.hashAssetPipelineFinalInput(face.faceKey, { baseTileVariantId: plan.baseTileVariantId }),
		]));
		const stageHashes = new Map(plan.plannedFaces.map((face) => [
			face.faceKey,
			Object.fromEntries(assetGenerationBuildSteps().map((step) => [
				step.id,
				model.hashAssetGenerationStageInput(face.faceKey, step.id, { baseTileVariantId: plan.baseTileVariantId }),
			])),
		]));
		await model.save();
		const buildSteps = assetGenerationBuildSteps();
		const plannedStepsByFace = new Map(plan.plannedFaces.map((face) => [
			face.faceKey,
			assetGenerationPendingSteps(model, face.faceKey, buildSteps, {
				inputHash: faceHashes.get(face.faceKey),
				finalHash: finalHashes.get(face.faceKey),
				stageHashes: stageHashes.get(face.faceKey),
			}),
		]));
		const activeFaces = plan.plannedFaces;
		const total = [...plannedStepsByFace.values()].reduce((sum, steps) => sum + steps.length, plan.skippedFaces.length);
		let completed = 0;

		stream.emitProgress(tilesetId, "assetGenerationStarted", {
			stage: "asset-generation",
			total,
			baseTileVariantId: plan.baseTileVariantId,
			plannedFaceKeys: activeFaces.map((face) => face.faceKey),
			message: `Starting 3D asset pipeline for ${plan.baseTileVariantId}`,
		});

		for (const face of plan.skippedFaces) {
			completed += 1;
			stream.emitProgress(tilesetId, "assetGenerationProgress", {
				stage: "asset-generation",
				faceKey: face.faceKey,
				status: face.status,
				completed,
				total,
				percent: total ? Math.round((completed / total) * 100) : 100,
				message: `Skipped ${face.faceKey}; generated asset input is current`,
			});
			await delay(12);
		}

		for (let faceIndex = 0; faceIndex < activeFaces.length; faceIndex += 1) {
			const face = activeFaces[faceIndex];
			let faceFailed = false;
			model = await assertAssetGenerationBaseTileCurrent(tilesetId, plan.baseTileVariantId);
			await writeAssetGenerationQueue(model, {
				baseTileVariantId: plan.baseTileVariantId,
				faceKeys: activeFaces.slice(faceIndex).map((queuedFace) => queuedFace.faceKey),
			});
			const pendingStepIds = new Set(plannedStepsByFace.get(face.faceKey)?.map((step) => step.id) || []);
			for (let stepIndex = 0; stepIndex < buildSteps.length; stepIndex += 1) {
				const step = buildSteps[stepIndex];
				if (!pendingStepIds.has(step.id)) {
					continue;
				}

				failedFaceKey = face.faceKey;
				failedStepId = step.id;
				model.updateAssetGenerationFace(face.faceKey, {
					status: step.status,
					inputHash: faceHashes.get(face.faceKey),
					queue: {
						status: step.queueStatus,
						baseTileVariantId: plan.baseTileVariantId,
						currentStep: step.id,
					},
					build: {
						currentStep: step.id,
						completedSteps: completedStepIds(plannedStepsByFace.get(face.faceKey), step.id),
					},
				});

				if (step.id === "svg-cutter") {
					stream.emitProgress(tilesetId, "assetGenerationProgress", {
						stage: step.id,
						stageLabel: step.label,
						faceKey: face.faceKey,
						status: step.status,
						completed,
						total,
						percent: total ? Math.round((completed / total) * 100) : 100,
						message: `${step.label}: ${face.faceKey}`,
					});
					try {
						await runSvgCutterGeneration({ tilesetId, faceKey: face.faceKey });
						model = await assertAssetGenerationBaseTileCurrent(tilesetId, plan.baseTileVariantId);
					} catch (error) {
						if (isAssetGenerationBaseTileChangedError(error)) {
							throw error;
						}
						const message = assetGenerationFailureMessage(error);
						model = await loadPipelineModel(tilesetId);
						model.updateAssetGenerationFace(face.faceKey, {
							status: "failed",
							inputHash: faceHashes.get(face.faceKey),
							queue: {
								status: "failed",
								baseTileVariantId: plan.baseTileVariantId,
								currentStep: step.id,
							},
							build: {
								currentStep: step.id,
								completedSteps: completedStepIds(plannedStepsByFace.get(face.faceKey), step.id),
							},
							failure: {
								step: step.id,
								message,
							},
						});
						await model.save();
						await removeAssetGenerationQueueFace(model, face.faceKey);

						completed += assetGenerationRemainingPendingStepCount(plannedStepsByFace.get(face.faceKey), step.id);
						stream.emitProgress(tilesetId, "assetGenerationProgress", {
							stage: step.id,
							stageLabel: step.label,
							faceKey: face.faceKey,
							status: "failed",
							completed,
							total,
							percent: total ? Math.round((completed / total) * 100) : 100,
							message: `${step.label} failed for ${face.faceKey}: ${message}`,
						});
						faceFailed = true;
						break;
					}
				}

				if (step.id === "stamped-body") {
					stream.emitProgress(tilesetId, "assetGenerationProgress", {
						stage: step.id,
						stageLabel: step.label,
						faceKey: face.faceKey,
						status: step.status,
						completed,
						total,
						percent: total ? Math.round((completed / total) * 100) : 100,
						message: `${step.label}: ${face.faceKey}`,
					});
					try {
						await runStampedBodyGeneration({ tilesetId, faceKey: face.faceKey });
						model = await assertAssetGenerationBaseTileCurrent(tilesetId, plan.baseTileVariantId);
					} catch (error) {
						if (isAssetGenerationBaseTileChangedError(error)) {
							throw error;
						}
						const message = assetGenerationFailureMessage(error);
						model = await loadPipelineModel(tilesetId);
						model.updateAssetGenerationFace(face.faceKey, {
							status: "failed",
							inputHash: faceHashes.get(face.faceKey),
							queue: {
								status: "failed",
								baseTileVariantId: plan.baseTileVariantId,
								currentStep: step.id,
							},
							build: {
								currentStep: step.id,
								completedSteps: completedStepIds(plannedStepsByFace.get(face.faceKey), step.id),
							},
							failure: {
								step: step.id,
								message,
							},
						});
						await model.save();
						await removeAssetGenerationQueueFace(model, face.faceKey);

						completed += assetGenerationRemainingPendingStepCount(plannedStepsByFace.get(face.faceKey), step.id);
						stream.emitProgress(tilesetId, "assetGenerationProgress", {
							stage: step.id,
							stageLabel: step.label,
							faceKey: face.faceKey,
							status: "failed",
							completed,
							total,
							percent: total ? Math.round((completed / total) * 100) : 100,
							message: `${step.label} failed for ${face.faceKey}: ${message}`,
						});
						faceFailed = true;
						break;
					}
				}

				if (step.id === "colored-inlay") {
					stream.emitProgress(tilesetId, "assetGenerationProgress", {
						stage: step.id,
						stageLabel: step.label,
						faceKey: face.faceKey,
						status: step.status,
						completed,
						total,
						percent: total ? Math.round((completed / total) * 100) : 100,
						message: `${step.label}: ${face.faceKey}`,
					});
					try {
						await runColoredInlayGeneration({ tilesetId, faceKey: face.faceKey });
						model = await assertAssetGenerationBaseTileCurrent(tilesetId, plan.baseTileVariantId);
					} catch (error) {
						if (isAssetGenerationBaseTileChangedError(error)) {
							throw error;
						}
						const message = assetGenerationFailureMessage(error);
						model = await loadPipelineModel(tilesetId);
						model.updateAssetGenerationFace(face.faceKey, {
							status: "failed",
							inputHash: faceHashes.get(face.faceKey),
							queue: {
								status: "failed",
								baseTileVariantId: plan.baseTileVariantId,
								currentStep: step.id,
							},
							build: {
								currentStep: step.id,
								completedSteps: completedStepIds(plannedStepsByFace.get(face.faceKey), step.id),
							},
							failure: {
								step: step.id,
								message,
							},
						});
						await model.save();
						await removeAssetGenerationQueueFace(model, face.faceKey);

						completed += assetGenerationRemainingPendingStepCount(plannedStepsByFace.get(face.faceKey), step.id);
						stream.emitProgress(tilesetId, "assetGenerationProgress", {
							stage: step.id,
							stageLabel: step.label,
							faceKey: face.faceKey,
							status: "failed",
							completed,
							total,
							percent: total ? Math.round((completed / total) * 100) : 100,
							message: `${step.label} failed for ${face.faceKey}: ${message}`,
						});
						faceFailed = true;
						break;
					}
				}

				if (step.id === "preview-png") {
					stream.emitProgress(tilesetId, "assetGenerationProgress", {
						stage: step.id,
						stageLabel: step.label,
						faceKey: face.faceKey,
						status: step.status,
						completed,
						total,
						percent: total ? Math.round((completed / total) * 100) : 100,
						message: `${step.label}: ${face.faceKey}`,
					});
					try {
						await runGeneratedAssetPreview({ tilesetId, faceKey: face.faceKey });
						model = await assertAssetGenerationBaseTileCurrent(tilesetId, plan.baseTileVariantId);
					} catch (error) {
						if (isAssetGenerationBaseTileChangedError(error)) {
							throw error;
						}
						const message = assetGenerationFailureMessage(error);
						model = await loadPipelineModel(tilesetId);
						model.updateAssetGenerationFace(face.faceKey, {
							status: "failed",
							inputHash: faceHashes.get(face.faceKey),
							queue: {
								status: "failed",
								baseTileVariantId: plan.baseTileVariantId,
								currentStep: step.id,
							},
							build: {
								currentStep: step.id,
								completedSteps: completedStepIds(plannedStepsByFace.get(face.faceKey), step.id),
							},
							failure: {
								step: step.id,
								message,
							},
						});
						await model.save();
						await removeAssetGenerationQueueFace(model, face.faceKey);

						completed += assetGenerationRemainingPendingStepCount(plannedStepsByFace.get(face.faceKey), step.id);
						stream.emitProgress(tilesetId, "assetGenerationProgress", {
							stage: step.id,
							stageLabel: step.label,
							faceKey: face.faceKey,
							status: "failed",
							completed,
							total,
							percent: total ? Math.round((completed / total) * 100) : 100,
							message: `${step.label} failed for ${face.faceKey}: ${message}`,
						});
						faceFailed = true;
						break;
					}
				}

				completed += 1;
				stream.emitProgress(tilesetId, "assetGenerationProgress", {
					stage: step.id,
					stageLabel: step.label,
					faceKey: face.faceKey,
					status: step.status,
					completed,
					total,
					percent: total ? Math.round((completed / total) * 100) : 100,
					message: `${step.label}: ${face.faceKey}`,
				});
				await delay(step.delayMs);
			}
			failedStepId = "";
			if (faceFailed) {
				continue;
			}

			model.updateAssetGenerationFace(face.faceKey, {
				status: null,
				inputHash: faceHashes.get(face.faceKey),
				finalHash: finalHashes.get(face.faceKey),
				stageHashes: stageHashes.get(face.faceKey),
				queue: null,
				build: null,
			});
			await model.save();
			await removeAssetGenerationQueueFace(model, face.faceKey);
			stream.emitProgress(tilesetId, "assetGenerationFaceReady", {
				stage: "asset-generation",
				faceKey: face.faceKey,
				status: "ready",
				completed,
				total,
				percent: total ? Math.round((completed / total) * 100) : 100,
				message: `Generated asset ready: ${face.faceKey}`,
			});
		}

		await model.save();
		await clearAssetGenerationQueue(model);
		const assetPipeline = model.getAssetPipeline();

		stream.emitProgress(tilesetId, "assetGenerationComplete", {
			stage: "asset-generation",
			completed,
			total,
			percent: 100,
			plannedCount: plan.plannedFaces.length,
			skippedCount: plan.skippedFaces.length,
			message: `Asset generation queue ready: ${plan.plannedFaces.length} faces staged, ${plan.skippedFaces.length} skipped`,
		});

		return {
			ok: true,
			tilesetId,
			currencyDate: model.getCurrencyDate(),
			plan,
			summary: assetGenerationSummary(assetPipeline.faces || {}, model),
			assetPipeline,
		};
	} catch (error) {
		const tilesetId = activeTilesetId;
		if (isAssetGenerationBaseTileChangedError(error) || isAssetGenerationCancelledError(error)) {
			if (tilesetId) {
				try {
					const model = await loadPipelineModel(tilesetId);
					model.clearAssetGenerationRuntimeState();
					await model.save();
					await clearAssetGenerationQueue(model);
				} catch (saveError) {
					console.warn("Failed to clear generated asset queue after base tile change.", saveError);
				}
			}
			getAssetPipelineStream().clearQueueState(tilesetId);
			getAssetPipelineStream().emitProgress(tilesetId, "assetGenerationComplete", {
				stage: failedStepId || "asset-generation",
				faceKey: failedFaceKey || null,
				status: "cancelled",
				completed: 0,
				total: 0,
				percent: 100,
				message: error.message,
			});
			if (isAssetGenerationCancelledError(error)) {
				const model = await loadPipelineModel(tilesetId);
				const assetPipeline = model.getAssetPipeline();
				return {
					ok: true,
					tilesetId,
					cancelled: true,
					currencyDate: model.getCurrencyDate(),
					summary: assetGenerationSummary(assetPipeline.faces || {}, model),
					assetPipeline,
				};
			}
			throw error;
		}
		if (tilesetId && failedFaceKey) {
			try {
				const model = await loadPipelineModel(tilesetId);
				model.updateAssetGenerationFace(failedFaceKey, {
					status: "failed",
					queue: {
						status: "failed",
						currentStep: failedStepId || "asset-generation",
					},
					failure: {
						step: failedStepId || "asset-generation",
						message: assetGenerationFailureMessage(error),
					},
				});
				await model.save();
				await removeAssetGenerationQueueFace(model, failedFaceKey);
			} catch (saveError) {
				console.warn("Failed to record generated asset failure.", saveError);
			}
		}
		getAssetPipelineStream().emitProgress(tilesetId, "assetGenerationFailed", {
			stage: failedStepId || "asset-generation",
			faceKey: failedFaceKey || null,
			message: error.message,
		});
		throw error;
	}
}

async function getAssetReview(req, res) {
	try {
		const tilesetId = await requestedTilesetId(req);
		const model = await loadPipelineModel(tilesetId);
		const assetPipeline = model.getAssetPipeline();
		const queueState = await assetReviewQueueState(model, getAssetPipelineStream().getQueueState(tilesetId));
		const faces = await assetReviewFaces(model, assetPipeline.faces || {}, queueState);
		const summary = assetReviewSummary(faces);

		res.json({
			ok: true,
			tilesetId,
			path: relativePath(model.pipelineFilename),
			currencyDate: model.getCurrencyDate(),
			summary,
			faces,
		});
	} catch (error) {
		sendError(res, error);
	}
}

async function runSvgCutterGeneration({ tilesetId, faceKey }) {
	const activeRun = activeAssetGenerationRuns.get(tilesetId);
	const result = await runNodeCommand([
		SVG_CUTTER_SCRIPT,
		"--tileset-id",
		tilesetId,
		"--face-key",
		faceKey,
	], {
		activeRun,
		maxBuffer: 20 * 1024 * 1024,
	});
	throwIfAssetGenerationCancelled(activeRun);

	if (result.status !== 0) {
		const details = [result.stderr, result.stdout, result.error]
			.filter(Boolean)
			.join("\n")
			.trim();
		const error = new Error(details || `SVG cutter generation failed for ${tilesetId}/${faceKey}.`);
		error.statusCode = 500;
		throw error;
	}

	return result;
}

async function runStampedBodyGeneration({ tilesetId, faceKey }) {
	const activeRun = activeAssetGenerationRuns.get(tilesetId);
	const result = await runNodeCommand([
		STAMPED_BODY_SCRIPT,
		"--tileset-id",
		tilesetId,
		"--face-key",
		faceKey,
	], {
		activeRun,
		maxBuffer: 20 * 1024 * 1024,
	});
	throwIfAssetGenerationCancelled(activeRun);

	if (result.status !== 0) {
		const details = [result.stderr, result.stdout, result.error]
			.filter(Boolean)
			.join("\n")
			.trim();
		const error = new Error(details || `Stamped body generation failed for ${tilesetId}/${faceKey}.`);
		error.statusCode = 500;
		throw error;
	}

	return result;
}

async function runColoredInlayGeneration({ tilesetId, faceKey }) {
	const activeRun = activeAssetGenerationRuns.get(tilesetId);
	const result = await runNodeCommand([
		COLORED_INLAY_SCRIPT,
		"--tileset-id",
		tilesetId,
		"--face-key",
		faceKey,
	], {
		activeRun,
		maxBuffer: 20 * 1024 * 1024,
	});
	throwIfAssetGenerationCancelled(activeRun);

	if (result.status !== 0) {
		const details = [result.stderr, result.stdout, result.error]
			.filter(Boolean)
			.join("\n")
			.trim();
		const error = new Error(details || `Colored inlay generation failed for ${tilesetId}/${faceKey}.`);
		error.statusCode = 500;
		throw error;
	}

	return result;
}

async function runGeneratedAssetPreview({ tilesetId, faceKey }) {
	return renderGeneratedAssetPreview({ tilesetId, faceKey });
}

function assetGenerationFailureMessage(error) {
	const lines = String(error?.message || "Generated asset step failed.")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	return lines.find((line) => line.startsWith("Error:"))
		|| lines[0]
		|| "Generated asset step failed.";
}

async function writeFinalRenderingOptions({ model, tilesetId, options }) {
	const tilesetState = model.requireState();
	const currentRendering = tilesetState.rendering || {};
	const renderingOverrides = outputOverridesFromEffectiveOptions({
		defaultOptions: normalizeFinalRenderingOutputOptions(currentRendering.defaults || {}),
		options: mergeFinalRenderingOutputOptions(currentRendering.overrides || {}, options, tilesetId),
		tilesetId,
	});
	const rendering = {
		...(currentRendering || {}),
		defaults: currentRendering.defaults || {},
		overrides: renderingOverrides,
	};
	model.setRendering(rendering);
	const nextTilesetState = await model.save();

	return {
		tilesetState: nextTilesetState,
		rendering: nextTilesetState.rendering || {},
	};
}

async function runAlignmentAndSemanticAssignment(tilesetId) {
	const alignmentScriptPath = path.resolve("scripts", "3d-assets", "svg-preprocessor", "run-source-alignment.js");
	const semanticScriptPath = path.resolve("scripts", "3d-assets", "svg-preprocessor", "run-source-semantic-assignment.js");
	const pipelineStatePath = path.resolve(tilesetOutputRoot(tilesetId), "pipeline.json");
	const referenceStructurePath = path.resolve(DEFAULT_REFERENCE_STRUCTURE_DIR, REFERENCE_STRUCTURE_FILENAME);
	const alignmentCommand = [
		alignmentScriptPath,
		"--tileset-id",
		tilesetId,
	];
	const alignmentResult = await runNodeCommand(alignmentCommand);
	const alignment = {
		command: commandLabel(alignmentCommand),
		status: alignmentResult.status,
		error: alignmentResult.error || null,
		stdout: alignmentResult.stdout,
		stderr: alignmentResult.stderr,
	};

	if (alignmentResult.status !== 0) {
		return {
			ok: false,
			stage: "alignment",
			alignment,
			semanticAssignment: null,
		};
	}

	const semanticCommand = [
		semanticScriptPath,
		"--tileset-id",
		tilesetId,
	];
	const semanticResult = await runNodeCommand(semanticCommand);
	const semanticAssignment = {
		command: commandLabel(semanticCommand),
		status: semanticResult.status,
		error: semanticResult.error || null,
		stdout: semanticResult.stdout,
		stderr: semanticResult.stderr,
	};

	return {
		ok: semanticResult.status === 0,
		stage: semanticResult.status === 0 ? "source-assignment" : "semantic-assignment",
		alignment,
		semanticAssignment,
	};
}

async function runFinalRenderingComposition(tilesetId) {
	const scriptPath = path.resolve("scripts", "3d-assets", "svg-preprocessor", "run-final-rendering-composition.js");
	const command = [
		scriptPath,
		"--tileset-id",
		tilesetId,
	];
	const result = await runNodeCommand(command);

	return {
		ok: result.status === 0,
		command: commandLabel(command),
		status: result.status,
		error: result.error || null,
		stdout: result.stdout,
		stderr: result.stderr,
	};
}

function effectiveFinalRenderingOutputOptions(tilesetState) {
	return mergeFinalRenderingOutputOptions(
		normalizeFinalRenderingOutputOptions(tilesetState?.rendering?.defaults || {}),
		normalizeFinalRenderingOutputOptions(tilesetState?.rendering?.overrides || {}),
		tilesetState?.tilesetId || null,
	);
}

function outputOverridesFromEffectiveOptions({ defaultOptions, options, tilesetId }) {
	const normalizedDefaults = normalizeFinalRenderingOutputOptions(defaultOptions || {});
	const normalizedOptions = normalizeFinalRenderingOutputOptions(options || {});
	const suits = {};
	const faces = {};

	for (const [suitId, group] of Object.entries(normalizedOptions.suits || {})) {
		const diff = diffFinalRenderingOptionGroup(normalizedDefaults.suits?.[suitId], group);
		if (diff) {
			suits[suitId] = diff;
		}
	}

	for (const [faceKey, group] of Object.entries(normalizedOptions.faces || {})) {
		const diff = diffFinalRenderingOptionGroup(normalizedDefaults.faces?.[faceKey], group);
		if (diff) {
			faces[faceKey] = diff;
		}
	}

	return {
		schemaVersion: normalizedOptions.schemaVersion || 1,
		suits,
		faces,
		tilesetId,
	};
}

function diffFinalRenderingOptionGroup(defaultGroup = {}, group = {}) {
	const parts = {};

	for (const [partId, part] of Object.entries(group.parts || {})) {
		if (finalRenderingPartFingerprint(part) !== finalRenderingPartFingerprint(defaultGroup.parts?.[partId])) {
			parts[partId] = part;
		}
	}

	const layout = JSON.stringify(group.layout || {}) !== JSON.stringify(defaultGroup.layout || {})
		? group.layout
		: null;
	const color = JSON.stringify(group.color || {}) !== JSON.stringify(defaultGroup.color || {})
		? group.color
		: null;
	const transform = JSON.stringify(group.transform || {}) !== JSON.stringify(defaultGroup.transform || {})
		? group.transform
		: null;
	const artwork = JSON.stringify(group.artwork || {}) !== JSON.stringify(defaultGroup.artwork || {})
		? group.artwork
		: null;

	if (Object.keys(parts).length === 0 && !layout && !color && !transform && !artwork) {
		return null;
	}

	return {
		...(group.suitId ? { suitId: group.suitId } : {}),
		...(group.faceKey ? { faceKey: group.faceKey } : {}),
		parts,
		...(layout ? { layout } : {}),
		...(color ? { color } : {}),
		...(transform ? { transform } : {}),
		...(artwork ? { artwork } : {}),
	};
}

function finalRenderingPartFingerprint(part) {
	if (!part) {
		return "";
	}

	return JSON.stringify({
		renderMode: normalizeFinalRenderingRenderMode(part.renderMode || renderModeFromPartOption(part)),
		outputPresent: part.outputPresent !== false,
		source: part.source || null,
		role: part.role || null,
	});
}

function mergeFinalRenderingOutputOptions(previousOptions, options, tilesetId) {
	const sanitized = sanitizeFinalRenderingOptions(options);
	const previous = normalizeFinalRenderingOutputOptions(previousOptions || {});

	return {
		schemaVersion: previous.schemaVersion || 1,
		defaults: {
			optionalParts: {
				outputPresent: true,
			},
			...(previous.defaults || {}),
		},
		suits: mergeFinalRenderingOptionGroups(previous.suits, sanitized.suits),
		faces: mergeFinalRenderingOptionGroups(previous.faces, sanitized.faces),
		tilesetId,
	};
}

function mergeFinalRenderingOptionGroups(previousGroups = {}, nextGroups = {}) {
	const merged = { ...(previousGroups || {}) };

	for (const [groupId, nextGroup] of Object.entries(nextGroups || {})) {
		const previousGroup = previousGroups?.[groupId] || {};
		merged[groupId] = {
			...previousGroup,
			...nextGroup,
			parts: mergeFinalRenderingPartOptions(previousGroup.parts, nextGroup.parts),
			...(previousGroup.layout || nextGroup.layout ? {
				layout: {
					...(previousGroup.layout || {}),
					...(nextGroup.layout || {}),
				},
			} : {}),
			...(previousGroup.color || nextGroup.color ? {
				color: {
					...(previousGroup.color || {}),
					...(nextGroup.color || {}),
				},
			} : {}),
			...(previousGroup.transform || nextGroup.transform ? {
				transform: {
					...(previousGroup.transform || {}),
					...(nextGroup.transform || {}),
				},
			} : {}),
			...(previousGroup.artwork || nextGroup.artwork ? {
				artwork: {
					...(previousGroup.artwork || {}),
					...(nextGroup.artwork || {}),
				},
			} : {}),
		};
	}

	return Object.fromEntries(Object.entries(merged).sort((left, right) => left[0].localeCompare(right[0])));
}

function mergeFinalRenderingPartOptions(previousParts = {}, nextParts = {}) {
	const merged = { ...(previousParts || {}) };

	for (const [partId, nextPart] of Object.entries(nextParts || {})) {
		merged[partId] = {
			...(previousParts?.[partId] || {}),
			...nextPart,
		};
	}

	return Object.fromEntries(Object.entries(merged).sort((left, right) => left[0].localeCompare(right[0])));
}

function normalizeFinalRenderingOutputOptions(options) {
	const normalizedSuits = normalizeFinalRenderingSuitOptions(options?.suits || {});

	return {
		schemaVersion: options?.schemaVersion || 1,
		defaults: {
			optionalParts: {
				outputPresent: true,
			},
			...(options?.defaults || {}),
		},
		suits: normalizedSuits,
		faces: Object.fromEntries(Object.entries(options?.faces || {})
			.map(([faceKey, faceOptions]) => [faceKey, normalizeFinalRenderingOptionGroup({
				...faceOptions,
				faceKey: faceOptions?.faceKey || faceKey,
				suitId: faceOptions?.suitId || finalRenderingFaceFamily(faceKey),
			})])
			.sort((left, right) => left[0].localeCompare(right[0]))),
	};
}

function normalizeFinalRenderingSuitOptions(suits) {
	const grouped = {};

	for (const [rawSuitId, suitOptions] of Object.entries(suits || {})) {
		const suitId = canonicalFinalRenderingFamily(rawSuitId);
		grouped[suitId] = mergeFinalRenderingOptionGroups(grouped, {
			[suitId]: normalizeFinalRenderingOptionGroup({
				...suitOptions,
				suitId,
			}),
		})[suitId];
	}

	return Object.fromEntries(Object.entries(grouped).sort((left, right) => left[0].localeCompare(right[0])));
}

function sanitizeFinalRenderingOptions(options) {
	return {
		suits: Object.fromEntries(Object.entries(options?.suits || {})
			.map(([suitId, suitOptions]) => [
				sanitizeOutputScope(suitId),
				normalizeFinalRenderingOptionGroup({
					...suitOptions,
					suitId: sanitizeOutputScope(suitId),
				}),
			])
			.filter(([suitId, suitOptions]) => suitId && hasFinalRenderingGroupOptions(suitOptions))
			.sort((left, right) => left[0].localeCompare(right[0]))),
		faces: Object.fromEntries(Object.entries(options?.faces || {})
			.map(([faceKey, faceOptions]) => [
				sanitizeOutputScope(faceKey),
				normalizeFinalRenderingOptionGroup({
					...faceOptions,
					faceKey: sanitizeOutputScope(faceKey),
					suitId: sanitizeOutputScope(faceOptions?.suitId || finalRenderingFaceFamily(faceKey)),
				}),
			])
			.filter(([faceKey, faceOptions]) => faceKey && hasFinalRenderingGroupOptions(faceOptions))
			.sort((left, right) => left[0].localeCompare(right[0]))),
	};
}

function normalizeFinalRenderingOptionGroup(group) {
	const parts = {};

	for (const partId of ["label", "glyph"]) {
		const part = normalizeFinalRenderingPartOption(group?.parts?.[partId], partId);
		if (part) {
			parts[partId] = part;
		}
	}

	return {
		...(group?.suitId ? { suitId: group.suitId } : {}),
		...(group?.faceKey ? { faceKey: group.faceKey } : {}),
		parts,
		...(group?.layout ? { layout: group.layout } : {}),
		...(group?.color ? { color: group.color } : {}),
		...(group?.transform ? { transform: normalizeFinalRenderingTransformOptions(group.transform) } : {}),
		...(group?.artwork ? { artwork: normalizeFinalRenderingArtworkOptions(group.artwork) } : {}),
	};
}

function hasFinalRenderingGroupOptions(group) {
	return Object.keys(group?.parts || {}).length > 0
		|| Object.keys(group?.layout || {}).length > 0
		|| Object.keys(group?.color || {}).length > 0
		|| Object.keys(group?.transform || {}).length > 0
		|| Object.keys(group?.artwork || {}).length > 0;
}

function normalizeFinalRenderingTransformOptions(transform) {
	if (!transform || typeof transform !== "object" || Array.isArray(transform)) {
		return {};
	}

	return {
		...("reflectX" in transform ? { reflectX: Boolean(transform.reflectX) } : {}),
	};
}

function normalizeFinalRenderingArtworkOptions(artwork) {
	if (!artwork || typeof artwork !== "object" || Array.isArray(artwork)) {
		return {};
	}

	return {
		...("preserveColors" in artwork ? { preserveColors: Boolean(artwork.preserveColors) } : {}),
	};
}

function normalizeFinalRenderingPartOption(part, partId) {
	if (!part || typeof part !== "object" || Array.isArray(part)) {
		return null;
	}

	const renderMode = normalizeFinalRenderingRenderMode(part.renderMode || renderModeFromPartOption(part));
	const outputPresent = renderMode !== "omit";
	const source = renderMode === "generated"
		? "generated"
		: renderMode === "omit"
			? "omit"
		: renderMode === "source-preferred"
			? "source-preferred"
			: part.source || "default-on";

	return {
		partId,
		contentKind: partId === "glyph" ? "glyph" : "label",
		...(part.role ? { role: part.role } : {}),
		outputPresent,
		source,
		renderMode,
		reviewStatus: part.reviewStatus || "reviewed",
	};
}

function normalizeFinalRenderingRenderMode(value) {
	return ["source-preferred", "generated", "omit"].includes(value) ? value : "source-preferred";
}

function renderModeFromPartOption(part) {
	if (part.outputPresent === false) {
		return "omit";
	}

	if (part.source === "generated") {
		return "generated";
	}

	return "source-preferred";
}

function finalRenderingFaceParts(outputOptions, faceKey, family) {
	const suitParts = outputOptions.suits?.[family]?.parts || {};
	const faceParts = outputOptions.faces?.[faceKey]?.parts || {};

	return Object.fromEntries(["label", "glyph"].map((partId) => {
		const suitPart = suitParts[partId] || {};
		const facePart = faceParts[partId] || null;
		const activePart = facePart || suitPart || {};
		const renderMode = renderModeFromPartOption(activePart);

		return [partId, {
			partId,
			contentKind: partId === "glyph" ? "glyph" : "label",
			role: activePart.role || null,
			colorStrategy: activePart.colorStrategy || null,
			renderKind: renderKindFromRenderMode(renderMode),
			alternates: null,
			outputPresent: activePart.outputPresent !== false,
			source: activePart.source || null,
			renderMode,
			hasFaceOverride: Boolean(facePart),
			reviewStatus: activePart.reviewStatus || "reviewed",
		}];
	}));
}

function renderKindFromRenderMode(renderMode) {
	return renderMode === "omit"
		? "omit"
		: renderMode === "generated"
			? "generated"
			: "source";
}

function finalRenderingFaceCanMirrorArtwork(faceState) {
	const mainArtwork = faceState?.state?.parts?.mainArtwork || null;

	return mainArtwork?.contentKind === "artwork"
		&& mainArtwork.colorStrategy === "freeform-palette";
}

function finalRenderingFaceCanPreserveArtworkColors(faceState) {
	return finalRenderingFaceCanMirrorArtwork(faceState);
}

function finalRenderingOptionsSummary(faces) {
	const faceEntries = Object.values(faces || {});

	return {
		faceCount: faceEntries.length,
		readyCount: faceEntries.filter((face) => face.status === "ready").length,
		unresolvedRenderCount: faceEntries.filter((face) => face.status !== "ready").length,
	};
}

function finalRenderingFaceFamily(faceKey) {
	const prefix = String(faceKey || "").split("-")[0];
	return canonicalFinalRenderingFamily({
		b: "bamboo",
		c: "character",
		d: "dot",
		dragon: "dragon",
		flower: "flower",
		season: "season",
		wind: "wind",
	}[prefix] || prefix || "other");
}

function canonicalFinalRenderingFamily(family) {
	return {
		characters: "character",
		dots: "dot",
		dragons: "dragon",
		flowers: "flower",
		seasons: "season",
		winds: "wind",
	}[family] || family;
}

function sanitizeOptionalPartBulkOptions(bulkOptions) {
	const families = bulkOptions?.families || {};
	const faces = bulkOptions?.faces || {};

	return {
		...bulkOptions,
		families: Object.fromEntries(Object.entries(families).map(([family, familyOptions]) => [
			family,
			sanitizeOptionalPartOptionGroup(familyOptions),
		])),
		faces: Object.fromEntries(Object.entries(faces)
			.map(([faceKey, faceOptions]) => [
				sanitizeOutputScope(faceKey),
				sanitizeOptionalPartOptionGroup(faceOptions),
			])
			.filter(([faceKey, faceOptions]) => faceKey && Object.keys(faceOptions).length > 0)
			.sort((left, right) => left[0].localeCompare(right[0]))),
	};
}

function sanitizeOptionalPartOptionGroup(options) {
	return Object.fromEntries(Object.entries(options || {}).map(([key, option]) => {
		if (key === "layout" || !option || typeof option !== "object" || Array.isArray(option)) {
			return [key, option];
		}

		return [key, {
			searchSource: option.searchSource !== false,
			...(validOptionalPartHintRegion(option.region) ? { region: option.region } : {}),
		}];
	}));
}

function validOptionalPartHintRegion(region) {
	return new Set([
		"top-left",
		"top-center",
		"top-right",
		"middle-left",
		"center",
		"middle-right",
		"bottom-left",
		"bottom-right",
		"either-corner",
		"no-preference",
	]).has(region);
}

function sanitizeOptionalPartManualAssignments(manualAssignments) {
	const faces = manualAssignments?.faces || {};

	return {
		faces: Object.fromEntries(Object.entries(faces)
			.map(([faceKey, parts]) => [
				sanitizeOutputScope(faceKey),
				sanitizeOptionalPartManualFaceAssignments(parts),
			])
			.filter(([faceKey, parts]) => faceKey && Object.keys(parts).length > 0)
		.sort((left, right) => left[0].localeCompare(right[0]))),
	};
}

function sanitizeOptionalPartManualFaceAssignments(parts) {
	if (!parts || typeof parts !== "object" || Array.isArray(parts)) {
		return {};
	}

	return Object.fromEntries(Object.entries(parts)
		.map(([partId, componentIds]) => [
			sanitizeOutputScope(partId),
			[...new Set((Array.isArray(componentIds) ? componentIds : [])
				.filter((componentId) => typeof componentId === "string" && componentId.trim())
				.map((componentId) => componentId.trim()))].sort((left, right) => left.localeCompare(right)),
		])
		.filter(([partId]) => partId)
		.sort((left, right) => left[0].localeCompare(right[0])));
}

function sourcePreviewFaceKeys(tilesetState) {
	const fromTileset = Object.keys(tilesetSvgFaces(tilesetState));

	if (fromTileset.length > 0) {
		return fromTileset.sort((left, right) => left.localeCompare(right));
	}

	return [];
}

function tilesetSvgFaces(tilesetState) {
	return tilesetState?.svgPipeline?.faces || {};
}

function sourceAssignmentReadyForFinalRendering(tilesetState) {
	const faces = Object.values(tilesetSvgFaces(tilesetState));
	if (faces.length === 0) {
		return false;
	}

	return faces.every((face) => {
		const parts = Object.values(face?.state?.parts || {});
		return parts.length > 0 && parts.every((part) => part?.accepted === true);
	});
}

async function loadPipelineModel(tilesetId, referenceName = DEFAULT_REFERENCE_STRUCTURE_ID) {
	const model = new PipelineModel({
		referenceName,
		tileSetName: tilesetId,
	});
	await model.start();
	return model;
}

function resolveRepoPath(filePath) {
	return path.isAbsolute(filePath)
		? filePath
		: path.resolve(process.cwd(), filePath);
}

function assertPipelineCurrencyDate(model, currencyDate) {
	try {
		model.assertCurrencyDate(currencyDate);
	} catch (error) {
		error.statusCode = 409;
		error.expectedUpdatedOn = currencyDate || null;
		error.actualUpdatedOn = model.getCurrencyDate();
		throw error;
	}
}

function normalizeBindingActionRequest(body = {}, { allowEmpty = false } = {}) {
	const actionsByFace = body.actionsByFace && typeof body.actionsByFace === "object" && !Array.isArray(body.actionsByFace)
		? body.actionsByFace
		: body.faceKey
			? { [body.faceKey]: body.actions || {} }
			: body.actions && looksLikeActionsByFace(body.actions)
				? body.actions
				: {};

	if (Object.keys(actionsByFace).length === 0) {
		if (allowEmpty) {
			return {};
		}
		throw new Error("Binding update requires actionsByFace or faceKey plus actions.");
	}

	return Object.fromEntries(Object.entries(actionsByFace)
		.map(([faceKey, actions]) => [normalizeBindingActionFaceKey(faceKey), normalizeBindingActionMap(actions)]));
}

function applyBindingActionsByFace(model, actionsByFace) {
	const updatedFaceKeys = [];

	for (const [faceKey, actions] of Object.entries(actionsByFace || {})) {
		model.applySourceBindingActions(faceKey, actions);
		updatedFaceKeys.push(faceKey);
	}

	return updatedFaceKeys;
}

function looksLikeActionsByFace(actions) {
	return Object.values(actions || {}).some((value) => (
		value
		&& typeof value === "object"
		&& !Array.isArray(value)
		&& !("action" in value)
	));
}

function normalizeBindingActionFaceKey(faceKey) {
	const safeFaceKey = sanitizeOutputScope(faceKey);
	if (!safeFaceKey || safeFaceKey !== faceKey) {
		throw new Error(`Invalid binding action face key: ${faceKey}`);
	}
	return faceKey;
}

function normalizeBindingActionMap(actions) {
	const actionEntries = Array.isArray(actions)
		? actions.map((action) => [action?.componentId, action])
		: Object.entries(actions || {});

	return Object.fromEntries(actionEntries
		.map(([componentId, action]) => {
			const normalized = normalizeBindingAction(componentId, action);
			return [normalized.componentId, normalized];
		})
		.sort((left, right) => left[0].localeCompare(right[0])));
}

function normalizeBindingAction(componentId, action) {
	if (!action || typeof action !== "object" || Array.isArray(action)) {
		throw new Error(`Invalid binding action for ${componentId || "(missing component)"}.`);
	}

	const normalizedComponentId = typeof action.componentId === "string" && action.componentId
		? action.componentId
		: componentId;
	const actionType = action.action || "none";
	const partId = typeof action.partId === "string" ? action.partId : "";

	if (typeof normalizedComponentId !== "string" || normalizedComponentId.length === 0) {
		throw new Error("Binding action requires componentId.");
	}
	if (!["bind", "unbind", "none"].includes(actionType)) {
		throw new Error(`Invalid binding action for ${normalizedComponentId}: ${actionType}`);
	}
	if (actionType === "bind" && !partId) {
		throw new Error(`Binding action ${normalizedComponentId} requires partId.`);
	}

	return {
		componentId: normalizedComponentId,
		action: actionType,
		...(partId ? { partId } : {}),
	};
}

function optionalAssignmentFromCanonicalState(tilesetId, faceKey, faceState) {
	const optionalParts = Object.fromEntries(canonicalOptionalPartEntries(faceState, faceKey)
		.map(([partId, part]) => [partId, {
			partId,
			contentKind: part.contentKind || null,
			role: part.role || null,
			text: part.text || null,
			sourceState: canonicalOptionalPartSourceState(faceState, partId, part),
			hint: part.hint || null,
			suggestedComponentIds: [],
			suggestedBounds: null,
			strength: strongestCanonicalBindingStrength(faceState, partId) || "none",
			reviewStatus: reviewStatusFromCanonicalBindings(faceState, partId)
				|| reviewStatusFromCanonicalPart(faceState, part)
				|| "needs-review",
			candidates: [],
		}]));

	return {
		schemaVersion: 1,
		tilesetId,
		faceKey,
		status: "canonical",
		face: describeFace(faceKey),
		sourceFile: faceState?.artifacts?.sourceSvg || null,
		sourceBounds: null,
		summary: {
			sourceComponentCount: Object.keys(faceState?.state?.bindings || {}).length,
			candidateUnitCount: 0,
			candidateCount: 0,
		},
		optionalParts,
		metadataSeed: null,
		diagnostics: [],
	};
}

function canonicalOptionalPartEntries(faceState, faceKey) {
	return Object.entries(faceState?.state?.parts || {})
		.filter(([, part]) => part?.optional === true);
}

function isOptionalPartForFace(faceKey, partId) {
	if (partId === "label") {
		return true;
	}

	return partId === "glyph" && ["flower", "season"].includes(describeFace(faceKey).family);
}

function canonicalOptionalPartSourceState(faceState, partId, part) {
	const bound = Object.values(faceState?.state?.bindings || {})
		.some((binding) => binding?.partId === partId && isMeaningfulOptionalStrength(binding.strength));

	if (bound) {
		return "candidate-found";
	}
	if (part?.accepted) {
		return "source-absent";
	}
	return "needs-review";
}

function describeFace(faceKey) {
	const match = /^([a-z-]+?)(?:-(\d+|[a-z]))?$/.exec(faceKey);
	return {
		faceKey,
		family: match?.[1] || faceKey,
		index: match?.[2] || null,
	};
}

function optionalPreviewComponents(normalized, assignment, faceState = null) {
	if (!normalized?.components) {
		return [];
	}

	const keptComponentIds = new Set(normalized.alignmentComponentIds || []);
	const assignedPartByComponentId = canonicalOptionalAssignedPartByComponentId(faceState, assignment);

	return normalized.components.filter((component) => isNormalizerKeptComponent(component, keptComponentIds)).map((component) => ({
		componentId: component.componentId,
		sourceElementId: component.sourceElementId,
		sourceIndex: component.sourceIndex,
		tagName: component.tagName,
		className: component.className,
		fill: component.fill,
		stroke: component.stroke,
		strokeWidth: component.strokeWidth,
		fillRule: component.fillRule || null,
		clipRule: component.clipRule || null,
		pathData: component.pathData,
		transform: component.transform || null,
		bounds: component.bounds,
		center: component.center,
		area: component.area,
		assignedOptionalPartId: assignedPartByComponentId.get(component.componentId) || "",
	}));
}

function canonicalOptionalPreviewParts(faceState, assignment) {
	const optionalParts = structuredClone(assignment.optionalParts || {});
	const stateParts = faceState?.state?.parts || {};
	const bindingsByPartId = canonicalOptionalBindingComponentIdsByPartId(faceState, assignment);

	for (const part of Object.values(assignment.optionalParts || {})) {
		const partId = part.partId;
		const bindingComponentIds = bindingsByPartId.get(partId) || [];
		const statePart = stateParts[partId] || {};

		optionalParts[partId] = {
			...part,
			sourceState: sourceStateFromCanonicalPart(statePart, part, bindingComponentIds),
			suggestedComponentIds: bindingComponentIds,
			suggestedBounds: null,
			strength: strongestCanonicalBindingStrength(faceState, partId) || part.strength || "none",
			reviewStatus: reviewStatusFromCanonicalBindings(faceState, partId)
				|| reviewStatusFromCanonicalPart(faceState, statePart)
				|| "needs-review",
		};
	}

	return optionalParts;
}

function canonicalOptionalPreviewReservations(faceState, assignment) {
	const bindingsByPartId = canonicalOptionalBindingComponentIdsByPartId(faceState, assignment);

	return [...bindingsByPartId.entries()].map(([partId, componentIds]) => ({
		partId,
		componentIds,
		strength: strongestCanonicalBindingStrength(faceState, partId) || "tentative",
		reviewStatus: reviewStatusFromCanonicalBindings(faceState, partId) || "inferred",
	}));
}

function optionalBindingActionMap(faceState, assignment) {
	const optionalPartIds = new Set(Object.keys(assignment.optionalParts || {}));

	return Object.fromEntries(Object.entries(faceState?.state?.bindings || {})
		.filter(([, binding]) => binding?.partId && optionalPartIds.has(binding.partId))
		.map(([componentId, binding]) => [componentId, {
			componentId,
			partId: binding.partId,
			action: "none",
		}])
		.sort((left, right) => left[0].localeCompare(right[0])));
}

function canonicalOptionalBindingComponentIdsByPartId(faceState, assignment) {
	const optionalPartIds = new Set(Object.keys(assignment.optionalParts || {}));
	const byPartId = new Map();

	for (const [componentId, binding] of Object.entries(faceState?.state?.bindings || {})) {
		if (!binding?.partId || !optionalPartIds.has(binding.partId)) {
			continue;
		}

		if (!isMeaningfulOptionalStrength(binding.strength)) {
			continue;
		}

		const componentIds = byPartId.get(binding.partId) || [];
		componentIds.push(componentId);
		byPartId.set(binding.partId, componentIds.sort((left, right) => left.localeCompare(right)));
	}

	return byPartId;
}

function canonicalOptionalAssignedPartByComponentId(faceState, assignment) {
	const assignedPartByComponentId = new Map();

	for (const [partId, componentIds] of canonicalOptionalBindingComponentIdsByPartId(faceState, assignment)) {
		for (const componentId of componentIds) {
			assignedPartByComponentId.set(componentId, partId);
		}
	}

	return assignedPartByComponentId;
}

function sourceStateFromCanonicalPart(statePart, artifactPart, bindingComponentIds) {
	if (bindingComponentIds.length > 0) {
		return "candidate-found";
	}

	if (statePart?.accepted) {
		return "source-absent";
	}

	return "needs-review";
}

function strongestCanonicalBindingStrength(faceState, partId) {
	const strengths = Object.values(faceState?.state?.bindings || {})
		.filter((binding) => binding?.partId === partId)
		.map((binding) => binding.strength);

	if (strengths.includes("accepted")) {
		return "accepted";
	}

	if (strengths.includes("strong")) {
		return "strong";
	}

	if (strengths.includes("tentative")) {
		return "tentative";
	}

	return strengths.includes("none") ? "none" : null;
}

function isMeaningfulOptionalStrength(strength) {
	return ["tentative", "strong", "accepted"].includes(strength);
}

function reviewStatusFromCanonicalBindings(faceState, partId) {
	const strength = strongestCanonicalBindingStrength(faceState, partId);

	if (strength === "accepted") {
		return "reviewed";
	}

	if (strength === "strong") {
		return "reviewed";
	}

	if (strength === "tentative") {
		return "inferred";
	}

	return null;
}

function reviewStatusFromCanonicalPart(faceState, statePart) {
	if (statePart?.accepted) {
		return "reviewed";
	}

	return null;
}

function isNormalizerKeptComponent(component, keptComponentIds) {
	if (keptComponentIds.size > 0) {
		return keptComponentIds.has(component.componentId);
	}

	return !component.classification?.tileLayerCandidate
		&& !component.classification?.negativeSpaceCandidate;
}

function optionalAssignmentSummary(faces, report) {
	const faceEntries = Object.values(faces || {});
	const optionalParts = faceEntries.flatMap((face) => Object.values(face.optionalParts || {}));

	return {
		faceCount: faceEntries.length,
		optionalPartCount: optionalParts.length || report?.optionalPartCount || 0,
		candidateCount: optionalParts.filter((part) => part.sourceState === "candidate-found").length,
		needsReviewCount: faceEntries.filter((face) => face.status === "needs-review").length,
		warningCount: report?.warningCount || faceEntries.reduce((total, face) => total + (face.diagnostics || []).length, 0),
	};
}

function optionalBulkPresets(faces) {
	const groups = new Map();

	for (const face of Object.values(faces || {})) {
		const family = faceFamily(face.faceKey);
		if (!groups.has(family)) {
			groups.set(family, {
				family,
				faceCount: 0,
				parts: {},
			});
		}

		const group = groups.get(family);
		group.faceCount += 1;

		for (const part of Object.values(face.optionalParts || {})) {
			const partPreset = group.parts[part.partId] || {
				partId: part.partId,
				role: part.role || "",
				contentKind: part.contentKind || "",
				expectedCount: 0,
				foundCount: 0,
				regions: {},
			};
			const region = part.hint?.region || "unspecified";

			partPreset.expectedCount += 1;
			partPreset.foundCount += part.sourceState === "candidate-found" ? 1 : 0;
			partPreset.regions[region] = (partPreset.regions[region] || 0) + 1;
			group.parts[part.partId] = partPreset;
		}
	}

	return Array.from(groups.values()).map((group) => ({
		...group,
		parts: Object.fromEntries(Object.entries(group.parts).map(([partId, part]) => {
			const regions = Object.entries(part.regions).sort((left, right) => right[1] - left[1]);

			return [partId, {
				...part,
				presetRegion: regions.length === 1 ? regions[0][0] : "mixed",
			}];
		})),
	})).sort((left, right) => left.family.localeCompare(right.family));
}

function faceFamily(faceKey) {
	const match = /^([a-z]+)-/.exec(faceKey || "");
	return match ? match[1] : "other";
}

function stampReferenceStructureLifecycle(structure) {
	const now = new Date().toISOString();
	const lifecycle = {
		...(structure.lifecycle || {}),
		status: "active",
		generatedOn: structure.lifecycle?.generatedOn || structure.generatedOn || null,
		updatedOn: now,
	};

	return {
		...structure,
		status: "active",
		lifecycle,
		updatedOn: lifecycle.updatedOn,
	};
}

function referenceStructureDir(referenceSetId) {
	const safeReferenceSetId = path.basename(referenceSetId || DEFAULT_REFERENCE_STRUCTURE_ID);

	if (safeReferenceSetId === DEFAULT_REFERENCE_STRUCTURE_ID) {
		return DEFAULT_REFERENCE_STRUCTURE_DIR;
	}

	return path.resolve(OUTPUT_3D_DIR, "reference-structure", safeReferenceSetId);
}

function getMetadataKind(req) {
	const requested = req.query.kind || req.body?.metadataKind || "tileset";

	if (METADATA_KINDS[requested]) {
		return requested;
	}

	throw new Error(`Unknown metadata kind: ${requested}`);
}

async function requestedTilesetId(req) {
	const requested = sanitizeOutputScope(req.body?.tilesetId || req.query.tilesetId);

	if (requested) {
		return requested;
	}

	const manifest = await readTilesetManifest();
	if (manifest.activeTilesetId) {
		return manifest.activeTilesetId;
	}

	throw new Error("No active tileset is recorded in the tileset manifest.");
}

function getTilesetSource(req, metadataKind, manifest = null) {
	if (metadataKind !== "tileset") {
		return null;
	}

	const requested = req.query.source || req.body?.tilesetSource || manifest?.activeTilesetId;

	if (!requested) {
		return null;
	}

	const manifestEntry = manifest?.tilesets?.find((tileset) => tileset.tilesetId === requested);
	if (manifestEntry) {
		return tilesetSourceFromManifestEntry(manifestEntry);
	}

	throw new Error(`Unknown tileset source: ${requested}`);
}

function metadataConfigFor(metadataKind, source) {
	const config = METADATA_KINDS[metadataKind];

	if (metadataKind !== "tileset") {
		return config;
	}

	if (!source) {
		throw new Error("No active tileset is recorded in the tileset manifest.");
	}

	if (!source.metadataPath) {
		throw new Error(`Tileset metadata path is not recorded for ${source.id}.`);
	}

	return {
		...config,
		metadataPath: source.metadataPath,
	};
}

function sourceOptions(manifest = null) {
	return manifest?.tilesets?.length
		? manifest.tilesets.map((tileset) => ({
			id: tileset.tilesetId,
			label: tilesetLabel(tileset.tilesetId),
			active: tileset.tilesetId === manifest.activeTilesetId,
		}))
		: [];
}

function tilesetSourceFromManifestEntry(entry) {
	return {
		id: entry.tilesetId,
		label: tilesetLabel(entry.tilesetId),
	};
}

function tilesetLabel(tilesetId) {
	return String(tilesetId || "")
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ") || "Tileset";
}

async function readMetadata(metadataKind, config, source = null) {
	const metadataPath = resolveMetadataPath(config.metadataPath);

	if (!(await fileExists(metadataPath))) {
		throw new Error(`Missing ${metadataKind} metadata: ${relativePath(metadataPath)}`);
	}

	return enrichMetadata(metadataKind, normalizePayload(metadataKind, await readJsonAsync(metadataPath), source));
}

async function readMetadataOrNull(metadataKind, config, source = null) {
	try {
		return {
			metadata: await readMetadata(metadataKind, config, source),
			error: null,
		};
	} catch (error) {
		return {
			metadata: null,
			error: error.message,
		};
	}
}

function normalizePayload(metadataKind, payload, source = null) {
	if (metadataKind !== "tileset" || !payload || typeof payload !== "object" || Array.isArray(payload)) {
		return payload;
	}

	return {
		...payload,
		tilesetId: payload.tilesetId || source?.id,
		sourceDir: payload.sourceDir || (source ? relativePath(resolveMetadataPath(source.sourceDir)) : undefined),
	};
}

async function enrichMetadata(metadataKind, metadata) {
	if (metadataKind !== "tileset") {
		return metadata;
	}

	const entries = metadata.tilesetGlyphs || {};
	const outputScope = outputScopeForMetadata(metadata);

	for (const [faceKey, entry] of Object.entries(entries)) {
		if (!entry.sourceComponents?.length) {
			entry.sourceComponents = await sourceComponentsForEntry(entry);
		}

		const output = await combinedImageResult(faceKey, outputScope);

		if (!output.sourceReferenceResult && !output.report) {
			continue;
		}

		entry.outputs = {
			...(entry.outputs || {}),
			...output,
		};
	}

	return metadata;
}

async function sourceComponentsForEntry(entry) {
	if (!entry.sourceFile) {
		return [];
	}

	const sourcePath = resolveMetadataPath(entry.sourceFile);

	if (!(await fileExists(sourcePath))) {
		return [];
	}

	const source = await readFile(sourcePath, "utf8");
	const extracted = extractSourceSvgComponents(source);
	const allBounds = entry.canvas
		? {
			left: entry.canvas.left,
			top: entry.canvas.top,
			right: entry.canvas.left + entry.canvas.width,
			bottom: entry.canvas.top + entry.canvas.height,
			width: entry.canvas.width,
			height: entry.canvas.height,
		}
		: boundsUnion(extracted.components.map((component) => component.bounds));

	return extracted.components
		.filter((component) => isFacePaintComponent(component))
		.map((component) => formatSourceComponent(component, allBounds));
}

function formatSourceComponent(component, allBounds) {
	const item = {
		bounds: component.bounds,
		center: component.center,
	};

	return {
		id: component.id || null,
		color: component.fill || component.stroke || null,
		location: allBounds ? relativePosition(item, allBounds) : null,
		nearestCorner: allBounds ? nearestCorner(item, allBounds) : null,
		bounds: compactBounds(component.bounds),
		area: Number((component.area || 0).toFixed(3)),
	};
}

function isFacePaintComponent(component) {
	return !component.tileLayerCandidate
		&& !component.negativeSpaceCandidate
		&& (isPaint(component.fill) || isPaint(component.stroke));
}

function isPaint(value) {
	return value && value !== "none" && !String(value).startsWith("url(");
}

function boundsUnion(boundsList) {
	const usable = boundsList.filter(Boolean);

	if (usable.length === 0) {
		return null;
	}

	const left = Math.min(...usable.map((bounds) => bounds.left));
	const top = Math.min(...usable.map((bounds) => bounds.top));
	const right = Math.max(...usable.map((bounds) => bounds.right));
	const bottom = Math.max(...usable.map((bounds) => bounds.bottom));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function compactBounds(bounds) {
	return {
		left: bounds.left,
		top: bounds.top,
		right: bounds.right,
		bottom: bounds.bottom,
		width: bounds.width,
		height: bounds.height,
	};
}

function relativePosition(item, bounds) {
	const center = item.center;
	const x = (center.x - bounds.left) / Math.max(1, bounds.width);
	const y = (center.y - bounds.top) / Math.max(1, bounds.height);

	return [
		y < 0.36 ? "top" : y > 0.68 ? "bottom" : "middle",
		x < 0.36 ? "left" : x > 0.64 ? "right" : "center",
	].join("-");
}

function nearestCorner(item, bounds) {
	const center = item.center;
	const normalizedCenter = {
		x: (center.x - bounds.left) / Math.max(1, bounds.width),
		y: (center.y - bounds.top) / Math.max(1, bounds.height),
	};
	const distances = {
		topLeft: Math.hypot(normalizedCenter.x, normalizedCenter.y),
		topRight: Math.hypot(1 - normalizedCenter.x, normalizedCenter.y),
		bottomLeft: Math.hypot(normalizedCenter.x, 1 - normalizedCenter.y),
		bottomRight: Math.hypot(1 - normalizedCenter.x, 1 - normalizedCenter.y),
	};

	return Object.entries(distances).sort((left, right) => left[1] - right[1])[0][0];
}

async function readJsonAsync(filename) {
	return JSON.parse(await readFile(filename, "utf8"));
}

function baseTileManifestPath() {
	return path.resolve(BASE_TILE_MODELS_DIR, "base-tile-manifest.json");
}

async function loadBaseTileManifest() {
	const manifestPath = baseTileManifestPath();
	const manifest = await readJsonAsync(manifestPath);
	const variants = Array.isArray(manifest?.variants) ? manifest.variants : [];

	return {
		...manifest,
		variants: variants
			.filter((variant) => variant?.id)
			.map((variant) => ({
				id: variant.id,
				label: variant.label || variant.id,
				description: variant.description || "",
				kind: variant.kind || "base-tile-glb",
				temporary: Boolean(variant.temporary),
				glb: normalizeRepoAssetPath(variant.glb),
				metadata: normalizeRepoAssetPath(variant.metadata),
				body: variant.body || {},
			})),
	};
}

function normalizeRepoAssetPath(filename) {
	return filename ? relativePath(path.resolve(process.cwd(), filename)) : "";
}

async function writeJson(filename, payload) {
	await writeFile(filename, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function fileExists(filename) {
	try {
		await access(filename);
		return true;
	} catch {
		return false;
	}
}

async function runNodeCommand(command, options = {}) {
	const activeRun = options.activeRun || null;
	return new Promise((resolve) => {
		const child = execFile(process.execPath, command, {
			cwd: process.cwd(),
			env: options.env || process.env,
			maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
		}, (error, stdout, stderr) => {
			activeRun?.childProcesses?.delete(child);
			if (!error) {
				resolve({
					status: 0,
					error: null,
					stdout,
					stderr,
				});
				return;
			}

			resolve({
				status: typeof error.code === "number" ? error.code : 1,
				error: error.message,
				stdout: error.stdout || stdout || "",
				stderr: error.stderr || stderr || "",
			});
		});

		activeRun?.childProcesses?.add(child);
		if (activeRun?.cancelled) {
			child.kill();
		}
	});
}

function canonicalSourceSemanticStrength(strength) {
	if (strength === "accepted") {
		return "accepted";
	}
	if (strength === "strong") {
		return "strong";
	}
	if (strength === "none") {
		return "none";
	}
	if (strength === "tentative") {
		return "tentative";
	}

	throw new Error(`Invalid canonical source semantic binding strength: ${strength || "(missing)"}`);
}

function canonicalSourcePreviewParts(faceState) {
	return Object.fromEntries(Object.entries(faceState?.state?.parts || {})
		.map(([partId, part]) => [partId, {
			partId,
			...(part.globalPartId ? { globalPartId: part.globalPartId } : {}),
			...(part.role ? { role: part.role } : {}),
			...(part.contentKind ? { contentKind: part.contentKind } : {}),
			...(part.colorStrategy ? { colorStrategy: part.colorStrategy } : {}),
			...(part.text ? { text: part.text } : {}),
			...(part.color ? { color: part.color } : {}),
			...(part.allowEmpty ? { allowEmpty: true } : {}),
			...(part.accepted ? { accepted: true, reviewStatus: "accepted" } : {}),
		}])
		.sort((left, right) => left[0].localeCompare(right[0])));
}

function sourceAssignmentBindingsForView(bindings) {
	return Object.fromEntries(Object.entries(bindings || {})
		.map(([componentId, binding]) => [componentId, {
			...(binding.partId ? { partId: binding.partId } : {}),
			strength: canonicalSourceSemanticStrength(binding.strength),
			reviewStatus: binding.strength === "accepted" || binding.strength === "strong"
				? "reviewed"
				: binding.strength === "none" ? "needs-review" : "inferred",
		}])
		.sort((left, right) => left[0].localeCompare(right[0])));
}

function sourceAssignmentPartStatesForView(parts) {
	return Object.fromEntries(Object.entries(parts || {})
		.filter(([, part]) => part?.accepted)
		.map(([partId, part]) => [partId, {
			state: "unbound",
			strength: "none",
			reviewStatus: "accepted",
		}])
		.sort((left, right) => left[0].localeCompare(right[0])));
}

async function writeMetadata(config, payload) {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throw new Error("Metadata payload must be an object.");
	}

	const metadataPath = resolveMetadataPath(config.metadataPath);
	await mkdir(path.dirname(metadataPath), { recursive: true });
	await writeJson(metadataPath, payload);
}

async function combinedImageResult(faceKey, outputScope = null) {
	const paths = getFacePaths(faceKey, { outputScope });

	return {
		sourceReferenceResult: await fileExists(paths.sourceReferenceResult) ? relativePath(paths.sourceReferenceResult) : null,
		report: await fileExists(paths.report) ? relativePath(paths.report) : null,
	};
}

function outputPaths(config, outputScope = null, source = null) {
	const validationPath = outputScope
		? path.resolve(OUTPUT_VALIDATION_DIR, outputScope)
		: OUTPUT_VALIDATION_DIR;

	return {
		source: source?.id || null,
		sourceDir: source ? relativePath(resolveMetadataPath(source.sourceDir)) : null,
		metadata: relativePath(resolveMetadataPath(config.metadataPath)),
		validation: relativePath(validationPath),
	};
}

function outputScopeForMetadata(metadata) {
	if (!metadata?.tilesetGlyphs) {
		return null;
	}

	return sanitizeOutputScope(metadata.outputScope || metadata.tilesetId || metadata.tilesetName || metadata.sourceDir);
}

function resolveMetadataPath(filename) {
	return path.resolve(process.cwd(), filename);
}

async function sendReferenceImage(req, res) {
	const safeName = path.basename(req.params.fileName);
	const imagePath = path.resolve(LARGE_FACES_DIR, safeName);

	if (!isInsideDirectory(imagePath, LARGE_FACES_DIR) || !(await fileExists(imagePath))) {
		return res.status(404).send("Image not found");
	}

	sendFile(res, imagePath);
}

async function sendAsset(req, res) {
	const assetPath = path.resolve(process.cwd(), req.query.path || "");

	if (!isInsideDirectory(assetPath, process.cwd()) || !(await fileExists(assetPath))) {
		return res.status(404).send("Asset not found");
	}

	sendFile(res, assetPath);
}

function sendFile(res, filename) {
	res.setHeader("Content-Type", contentTypeFor(filename));
	res.setHeader("Cache-Control", "no-cache");
	fs.createReadStream(filename).pipe(res);
}

function contentTypeFor(filename) {
	const extension = path.extname(filename).toLowerCase();

	if (extension === ".svg") {
		return "image/svg+xml";
	}

	if (extension === ".png") {
		return "image/png";
	}

	if (extension === ".jpg" || extension === ".jpeg") {
		return "image/jpeg";
	}

	if (extension === ".json") {
		return "application/json; charset=utf-8";
	}

	return "application/octet-stream";
}

function isInsideDirectory(filename, directory) {
	const relative = path.relative(directory, filename);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function relativePath(filename) {
	return path.relative(process.cwd(), filename).replaceAll("\\", "/");
}

function commandLabel(command) {
	return ["node", ...command.map((part) => path.isAbsolute(part) ? relativePath(part) : part)].join(" ");
}

function assetGenerationQueuePath(model) {
	return path.join(model.pipelineDir, "json", "asset-generation-queue", "queue.json");
}

async function readAssetGenerationQueue(model) {
	try {
		const payload = JSON.parse(await readFile(assetGenerationQueuePath(model), "utf8"));
		const baseTileVariantId = String(payload.baseTileVariantId || "").trim();
		const faceKeys = cleanQueueFaceKeys(payload.faceKeys || []);
		if (!baseTileVariantId || faceKeys.length === 0) {
			return null;
		}
		return { baseTileVariantId, faceKeys };
	} catch {
		return null;
	}
}

async function writeAssetGenerationQueue(model, queue) {
	const baseTileVariantId = String(queue?.baseTileVariantId || "").trim();
	const faceKeys = cleanQueueFaceKeys(queue?.faceKeys || []);
	const filename = assetGenerationQueuePath(model);

	if (!baseTileVariantId || faceKeys.length === 0) {
		await clearAssetGenerationQueue(model);
		return;
	}

	await mkdir(path.dirname(filename), { recursive: true });
	await writeFile(filename, `${JSON.stringify({ baseTileVariantId, faceKeys }, null, 2)}\n`, "utf8");
}

async function removeAssetGenerationQueueFace(model, faceKey) {
	const queue = await readAssetGenerationQueue(model);
	if (!queue) {
		return;
	}

	await writeAssetGenerationQueue(model, {
		baseTileVariantId: queue.baseTileVariantId,
		faceKeys: queue.faceKeys.filter((queuedFaceKey) => queuedFaceKey !== faceKey),
	});
}

async function cancelAssetGenerationQueue(tilesetId) {
	const safeTilesetId = sanitizeOutputScope(tilesetId);
	if (!safeTilesetId) {
		throw new Error("A valid tileset id is required.");
	}

	const activeRun = activeAssetGenerationRuns.get(safeTilesetId);
	if (activeRun) {
		activeRun.cancelled = true;
		for (const child of activeRun.childProcesses || []) {
			child.kill();
		}
	}

	const model = await loadPipelineModel(safeTilesetId);
	model.clearAssetGenerationRuntimeState();
	await model.save();
	await clearAssetGenerationQueue(model);
	getAssetPipelineStream().clearQueueState(safeTilesetId);
	getAssetPipelineStream().emitProgress(safeTilesetId, "assetGenerationComplete", {
		stage: "asset-generation",
		completed: 0,
		total: 0,
		percent: 100,
		message: "Asset generation queue canceled.",
	});
	return model;
}

async function clearAssetGenerationQueue(model) {
	const filename = assetGenerationQueuePath(model);
	try {
		await fs.promises.rm(filename, { force: true });
	} catch {
		// The queue file is runtime state; absence means no pending work.
	}
}

async function assetReviewQueueState(model, liveQueueState = {}) {
	const hasLiveQueue = Boolean(liveQueueState.activeFaceKey || liveQueueState.queuedFaceKeys?.length);
	if (hasLiveQueue) {
		return liveQueueState;
	}

	const queue = await readAssetGenerationQueue(model);
	if (!queue || queue.baseTileVariantId !== model.getSelectedBaseTileVariantId()) {
		return liveQueueState;
	}

	return {
		activeFaceKey: "",
		queuedFaceKeys: queue.faceKeys,
		currentStep: "",
		stageLabel: "",
	};
}

async function assertAssetGenerationBaseTileCurrent(tilesetId, expectedBaseTileVariantId) {
	const model = await loadPipelineModel(tilesetId);
	const activeRun = activeAssetGenerationRuns.get(tilesetId);
	const selectedBaseTileVariantId = model.getSelectedBaseTileVariantId();
	if (activeRun?.cancelled) {
		const error = new Error("Asset generation was canceled.");
		error.code = "ASSET_GENERATION_CANCELLED";
		throw error;
	}
	if (selectedBaseTileVariantId !== expectedBaseTileVariantId) {
		const error = new Error(`Asset generation stopped because the selected base tile changed from ${expectedBaseTileVariantId} to ${selectedBaseTileVariantId || "(none)"}.`);
		error.code = "ASSET_GENERATION_BASE_TILE_CHANGED";
		throw error;
	}
	return model;
}

function throwIfAssetGenerationCancelled(activeRun) {
	if (!activeRun?.cancelled) {
		return;
	}

	const error = new Error("Asset generation was canceled.");
	error.code = "ASSET_GENERATION_CANCELLED";
	throw error;
}

function isAssetGenerationBaseTileChangedError(error) {
	return error?.code === "ASSET_GENERATION_BASE_TILE_CHANGED";
}

function isAssetGenerationCancelledError(error) {
	return error?.code === "ASSET_GENERATION_CANCELLED";
}

async function resumePendingAssetGenerationQueues() {
	const tilesetIds = await pendingAssetGenerationQueueTilesetIds();
	for (const tilesetId of tilesetIds) {
		runAssetGenerationForTileset(tilesetId).catch((error) => {
			console.warn(`Failed to resume pending asset generation queue for ${tilesetId}.`, error);
		});
	}
}

async function pendingAssetGenerationQueueTilesetIds() {
	try {
		const entries = await fs.promises.readdir(BASE_OUTPUT, { withFileTypes: true });
		const tilesetIds = [];

		for (const entry of entries) {
			if (!entry.isDirectory() || !sanitizeOutputScope(entry.name)) {
				continue;
			}

			const queuePath = path.join(BASE_OUTPUT, entry.name, "json", "asset-generation-queue", "queue.json");
			if (await fileExists(queuePath)) {
				tilesetIds.push(entry.name);
			}
		}

		return tilesetIds.sort((left, right) => left.localeCompare(right));
	} catch {
		return [];
	}
}

function cleanQueueFaceKeys(faceKeys) {
	return [...new Set((faceKeys || [])
		.filter((faceKey) => typeof faceKey === "string" && /^[a-zA-Z0-9_-]+$/.test(faceKey))
		.sort((left, right) => left.localeCompare(right)))];
}

function mergeQueuedFaceKeysWithRetryableFaces(model, queuedFaceKeys) {
	const queued = new Set(cleanQueueFaceKeys(queuedFaceKeys));
	const assetPipeline = model.getAssetPipeline();
	const baseTileVariantId = model.getSelectedBaseTileVariantId();

	for (const faceKey of model.getFaceKeys()) {
		const face = assetPipeline.faces?.[faceKey] || {};
		const inputHash = model.hashAssetPipelineFaceInput(faceKey);
		const finalHash = model.hashAssetPipelineFinalInput(faceKey, { baseTileVariantId });
		const renderedSvg = model.getFinalRenderingColorSvgPath(faceKey) || "";
		const ready = model.isAssetGenerationFaceReady(face, { inputHash, finalHash, renderedSvg });
		if (!ready) {
			queued.add(faceKey);
		}
	}

	return [...queued].sort((left, right) => left.localeCompare(right));
}

function assetGenerationSummary(faces, model = null) {
	const entries = Object.entries(faces || {});
	const baseTileVariantId = model?.getSelectedBaseTileVariantId?.() || "";
	const counts = entries.reduce((summary, [faceKey, face]) => {
		const inputHash = model?.hashAssetPipelineFaceInput?.(faceKey) || face?.inputHash || "";
		const finalHash = model?.hashAssetPipelineFinalInput?.(faceKey, { baseTileVariantId }) || face?.finalHash || "";
		const renderedSvg = model ? model.getFinalRenderingColorSvgPath(faceKey) || "" : "";
		const status = model?.isAssetGenerationFaceReady?.(face, { inputHash, finalHash, renderedSvg })
			? "ready"
			: face?.status || "unavailable";
		summary[status] = (summary[status] || 0) + 1;
		if (face?.queue?.status === "skipped") {
			summary.skipped = (summary.skipped || 0) + 1;
		}
		return summary;
	}, {});

	return {
		faceCount: entries.length,
		queuedCount: counts.queued || 0,
		readyCount: counts.ready || 0,
		failedCount: counts.failed || 0,
		skippedCount: counts.skipped || 0,
		unavailableCount: counts.unavailable || 0,
		staleCount: counts.stale || 0,
		counts,
	};
}

async function assetReviewFaces(model, faces, queueState = {}) {
	const baseTileVariantId = model.getSelectedBaseTileVariantId();
	const activeFaceKey = queueState.activeFaceKey || "";
	const queuedFaceKeys = new Set(queueState.queuedFaceKeys || []);
	return Promise.all(Object.keys(model.faces())
		.sort((left, right) => left.localeCompare(right))
		.map(async (faceKey) => {
			const face = faces[faceKey] || {};
			const inputHash = model.hashAssetPipelineFaceInput(faceKey);
			const finalHash = model.hashAssetPipelineFinalInput(faceKey, { baseTileVariantId });
			const renderedSvg = model.getFinalRenderingColorSvgPath(faceKey) || "";
			const finalAsset = face.artifacts?.inlayModel || "";
			const previewPng = face.artifacts?.previewPng || "";
			const finalAssetExists = finalAsset ? await fileExists(resolveRepoPath(finalAsset)) : false;
			const previewPngExists = previewPng ? await fileExists(resolveRepoPath(previewPng)) : false;
			const hasReviewableFinalAsset = finalAssetExists && Boolean(face.finalHash);
			const ready = hasReviewableFinalAsset && previewPngExists && model.isAssetGenerationFaceReady(face, { inputHash, finalHash, renderedSvg });
			const building = !ready && activeFaceKey === faceKey;
			const queued = !ready && !building && queuedFaceKeys.has(faceKey);
			const failed = !ready && face.status === "failed";
			const stale = hasReviewableFinalAsset && !ready && !building && !queued && !failed;
			const unavailable = !hasReviewableFinalAsset && !building && !queued && !failed;
			const liveQueue = building
				? {
					status: "building",
					currentStep: queueState.stageLabel || queueState.currentStep || "",
				}
				: queued
					? {
						status: "queued",
					}
					: null;
			const liveBuild = building
				? {
					currentStep: queueState.stageLabel || queueState.currentStep || "",
				}
				: null;

			const currentAsset = ready
				? {
					glb: finalAsset,
					metadata: face.artifacts?.inlayMetadata || "",
					previewPng: previewPngExists ? previewPng : "",
					cacheKey: face.finalHash,
				}
				: null;

			return {
				faceKey,
				state: ready ? "ready" : failed ? "failed" : building ? "building" : queued ? "queued" : stale ? "stale" : "unavailable",
				ready,
				building,
				queued,
				stale,
				failed,
				unavailable,
				asset: currentAsset,
				queue: liveQueue,
				build: liveBuild,
				inputHash,
				finalHash,
				recordedFinalHash: face.finalHash || "",
				stageHashes: face.stageHashes || {},
				failure: face.failure || null,
			};
		}));
}

function assetReviewSummary(faces) {
	const counts = faces.reduce((summary, face) => {
		summary[face.state] = (summary[face.state] || 0) + 1;
		return summary;
	}, {});

	return {
		faceCount: faces.length,
		readyCount: counts.ready || 0,
		buildingCount: counts.building || 0,
		queuedCount: counts.queued || 0,
		staleCount: counts.stale || 0,
		failedCount: counts.failed || 0,
		unavailableCount: counts.unavailable || 0,
	};
}

function assetGenerationBuildSteps() {
	return [
		{
			id: "preview-svg",
			label: "Checking preview SVG",
			status: "building",
			queueStatus: "building",
			delayMs: 16,
		},
		{
			id: "svg-cutter",
			label: "Preparing SVG cutter",
			status: "building",
			queueStatus: "building",
			delayMs: 20,
		},
		{
			id: "stamped-body",
			label: "Preparing stamped tile body",
			status: "building",
			queueStatus: "building",
			delayMs: 20,
		},
		{
			id: "colored-inlay",
			label: "Preparing colored inlay",
			status: "building",
			queueStatus: "building",
			delayMs: 20,
		},
		{
			id: "preview-png",
			label: "Rendering review preview",
			status: "building",
			queueStatus: "building",
			delayMs: 20,
		},
	];
}

function assetGenerationPendingSteps(model, faceKey, buildSteps, { inputHash, finalHash, stageHashes }) {
	const face = model.getAssetPipeline().faces?.[faceKey] || {};
	return buildSteps.filter((step) => !model.isAssetGenerationStageReady(face, {
		stageId: step.id,
		inputHash,
		finalHash,
		stageHash: stageHashes?.[step.id] || "",
	}));
}

function assetGenerationRemainingPendingStepCount(pendingSteps = [], currentStepId) {
	const index = pendingSteps.findIndex((step) => step.id === currentStepId);
	return index >= 0 ? pendingSteps.length - index : 1;
}

function completedStepIds(steps, currentStepId) {
	const index = steps.findIndex((step) => step.id === currentStepId);
	return index >= 0
		? steps.slice(0, index + 1).map((step) => step.id)
		: [];
}

function delay(milliseconds) {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}

function sendError(res, error) {
	console.error(error);
	res.status(error.statusCode || 500).json({
		ok: false,
		message: error.message,
		...(error.expectedUpdatedOn ? { expectedUpdatedOn: error.expectedUpdatedOn } : {}),
		...(error.actualUpdatedOn ? { actualUpdatedOn: error.actualUpdatedOn } : {}),
		stack: error.stack,
	});
}
