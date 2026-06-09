import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	normalizePath,
	resolvePath,
} from "../../shared/paths.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const BASE_DATA = path.join(here, "..", "..", "data", "asset-pipeline");
export const BASE_OUTPUT = path.join(here, "..", "..", "output", "asset-pipeline");
export const BASE_REFERENCE = path.join(BASE_DATA, "references");
export const PIPELINE_BOOTSTRAP = path.join(BASE_DATA, "bootstrap");
export const PIPELINE_MANIFESTS = path.join(BASE_DATA, "manifests");
export const PIPELINE_SOURCE_SVGS = path.join(BASE_OUTPUT, "source-svgs");
export const PIPELINE_PREPARED_SVGS = path.join(BASE_OUTPUT, "prepared-svgs");

const SCHEMA_VERSION = 3;
const VALID_BINDING_STRENGTHS = new Set(["none", "tentative", "strong", "accepted"]);
const DATE_FIELD_NAMES = new Set(["generatedOn", "updatedOn", "acceptedOn"]);
const GENERATED_ASSET_STAGE_IDS = Object.freeze(["preview-svg", "svg-cutter", "stamped-body", "colored-inlay", "preview-png"]);
const GENERATED_ASSET_STAGE_VERSIONS = Object.freeze({
	"svg-cutter": 2,
	"stamped-body": 2,
	"colored-inlay": 3,
	"preview-png": 3,
});
const REQUIRED_GENERATED_ASSET_ARTIFACTS = Object.freeze(["cutterMetadata", "stampedModel", "stampedMetadata", "inlayModel", "inlayMetadata", "previewPng"]);

/**
 * Constructor options for a tileset pipeline model.
 *
 * @typedef {object} PipelineModelOptions
 * @property {string} referenceName - Standard reference set name, such as `default-large-faces`.
 * @property {string} [tileSetName] - Source tileset name.
 * @property {string} [tilesetName] - Source tileset name.
 */

/**
 * Save behavior options.
 *
 * @typedef {object} PipelineModelSaveOptions
 * @property {boolean} [preserveCurrencyDate=false] - Keep the existing currency date instead of assigning a new one.
 */

/**
 * Durable component-to-part binding strength.
 *
 * @typedef {"none" | "tentative" | "strong" | "accepted"} PipelineBindingStrength
 */

/**
 * Compact durable component-to-part binding record.
 *
 * @typedef {object} PipelineBinding
 * @property {string} componentId - Source component id and binding map key.
 * @property {string} [partId] - Semantic part id. Required unless strength is
 * `none`, or the record is a temporary optional-assignment reservation.
 * @property {PipelineBindingStrength} strength - Durable binding status.
 */

/**
 * Source Assignment command for a source component binding.
 *
 * @typedef {object} SourceBindingAction
 * @property {string} componentId - Source component id to update.
 * @property {string} [partId] - Target part id for `bind` actions.
 * @property {"bind" | "unbind" | "none"} action - Binding action requested by the app/server.
 */

/**
 * Options for applying binding action records.
 *
 * @typedef {object} ApplyBindingActionOptions
 * @property {"exclude" | "reserve"} [unbindMode="exclude"] - Whether
 * `unbind` writes a durable `none` exclusion or reserves the component away
 * from optional assignment without assigning it to a part.
 */

/**
 * Compact Alignment-to-Assignment/Rendering handoff match.
 *
 * @typedef {object} AlignmentMatch
 * @property {string} id - Stable match id within the current alignment pass.
 * @property {string[]} source - Source component ids selected by the match.
 * @property {string[]} reference - Reference component ids selected by the match.
 * @property {object} [transform] - Renderer-understood placement transform.
 * @property {object} [sourceBounds] - Source-space bounds used for placement.
 * @property {object} [targetBounds] - Target/reference-space bounds used for placement.
 * @property {object} [alignedBounds] - Prepared-space bounds after applying the transform.
 */

/**
 * Functional placement fields Alignment may write onto a part record.
 *
 * @typedef {object} AlignmentPlacement
 * @property {object} [sourceBounds] - Source-space bounds used for placement.
 * @property {object} [targetBounds] - Target/reference-space bounds used for placement.
 * @property {object} [alignedBounds] - Prepared-space bounds after applying the transform.
 * @property {object} [transform] - Renderer-understood placement transform.
 */

/**
 * Result from entering or refreshing the generated 3D asset pipeline.
 *
 * @typedef {object} AssetPipelineInitializationResult
 * @property {string[]} skippedFaceKeys - Faces whose current render input hash already matched recorded asset state.
 * @property {string[]} updatedFaceKeys - Faces whose asset-pipeline intake state was initialized or refreshed.
 */

/**
 * Normalization result data recorded in canonical state.
 *
 * @typedef {object} NormalizationResult
 * @property {string} normalizedComponentsPath - Repo-relative or absolute durable normalized component artifact path.
 */

/**
 * Owns canonical pipeline JSON access for one source tileset.
 */
export class PipelineModel {
	/**
	 * Creates a model for one reference/tileset pair.
	 *
	 * @param {PipelineModelOptions} options - Model options.
	 */
	constructor(options) {
		this.referenceName = options.referenceName;
		this.tileSetName = options.tileSetName || options.tilesetName;
		this.pipelineState = null;
	}

	/**
	 * Initializes paths, loads reference/bootstrap inputs, and loads or creates canonical state.
	 *
	 * @returns {Promise<void>}
	 */
	async start() {
		this.pipelineDir = path.join(BASE_OUTPUT, this.tileSetName);
		this.pipelineFilename = path.join(this.pipelineDir, "pipeline.json");
		this.referenceDir = path.join(BASE_REFERENCE, this.referenceName);
		this.faceDir = path.join(this.referenceDir, "faces");
		this.referenceFile = path.join(this.referenceDir, "reference.json");
		this.tileSetBootstrapFile = path.join(PIPELINE_BOOTSTRAP, "pipeline.json");

		await this.ensureDirectories();

		this.reference = await this.safeLoadJson(this.referenceFile);
		this.bootstrap = await this.safeLoadJson(this.tileSetBootstrapFile);
		this.checkFile(this.reference, this.referenceFile);
		this.checkFile(this.bootstrap, this.tileSetBootstrapFile);

		this.pipelineState = await this.fileExists(this.pipelineFilename)
			? await this.safeLoadJson(this.pipelineFilename)
			: false;

		if (this.pipelineState === false) {
			this.pipelineState = await this.buildPipelineStateFromBootstrap();
			await this.save({ preserveCurrencyDate: true });
			return;
		}

		this.normalizeForPhaseOne();
		if (!this.getCurrencyDate()) {
			this.setCurrencyDate();
		}
	}

	/**
	 * Ensures model-owned data and output directories exist.
	 *
	 * @returns {Promise<void>}
	 */
	async ensureDirectories() {
		await fs.mkdir(BASE_DATA, { recursive: true });
		await fs.mkdir(BASE_OUTPUT, { recursive: true });
		await fs.mkdir(this.pipelineDir, { recursive: true });
		await fs.mkdir(this.referenceDir, { recursive: true });
		await fs.mkdir(this.faceDir, { recursive: true });
		await fs.mkdir(PIPELINE_MANIFESTS, { recursive: true });
		await fs.mkdir(PIPELINE_SOURCE_SVGS, { recursive: true });
		await fs.mkdir(PIPELINE_PREPARED_SVGS, { recursive: true });
	}

	/**
	 * Rebuilds canonical state from bootstrap and manifest, equivalent to just after intake.
	 *
	 * @param {object} [options] - Reset options.
	 * @param {object | null} [options.manifest] - Manifest override for callers that just loaded one.
	 * @returns {Promise<object>} Rebuilt phase-one pipeline state.
	 */
	async resetToIntake({ manifest = null } = {}) {
		this.pipelineState = await this.buildPipelineStateFromBootstrap({ manifest });
		await this.save({ preserveCurrencyDate: true });
		return this.pipelineState;
	}

	/**
	 * Normalizes and writes the current canonical state.
	 *
	 * @param {PipelineModelSaveOptions} [options] - Save behavior options.
	 * @returns {Promise<object>} Saved pipeline state.
	 */
	async save({ preserveCurrencyDate = false } = {}) {
		this.normalizeForPhaseOne();
		if (!preserveCurrencyDate || !this.getCurrencyDate()) {
			this.setCurrencyDate();
		}

		const saved = await this.safeWriteJson(this.pipelineState, this.pipelineFilename);
		this.checkFile(saved, this.pipelineFilename);
		return saved;
	}

	/**
	 * Reads a JSON file and returns `false` on load/parse failure.
	 *
	 * @param {string} filename - Repo-relative or absolute JSON path.
	 * @returns {Promise<object | false>} Parsed JSON object or `false`.
	 */
	async safeLoadJson(filename) {
		const resolved = resolvePath(filename);
		try {
			const json = await fs.readFile(resolved, "utf-8");
			return JSON.parse(json);
		} catch (error) {
			console.warn(error.message);
			console.warn(error.stack);
			return false;
		}
	}

	/**
	 * Writes a JSON file and returns `false` on write failure.
	 *
	 * @param {object} content - JSON-serializable payload.
	 * @param {string} filename - Repo-relative or absolute output path.
	 * @returns {Promise<object | false>} Written payload or `false`.
	 */
	async safeWriteJson(content, filename) {
		const resolved = resolvePath(filename);
		try {
			await fs.mkdir(path.dirname(resolved), { recursive: true });
			await fs.writeFile(resolved, `${JSON.stringify(content, null, 2)}\n`, "utf-8");
			return content;
		} catch (error) {
			console.warn(error.message);
			console.warn(error.stack);
			return false;
		}
	}

	/**
	 * Checks whether a file exists.
	 *
	 * @param {string} filename - Repo-relative or absolute path.
	 * @returns {Promise<boolean>} True when the file is accessible.
	 */
	async fileExists(filename) {
		try {
			await fs.access(resolvePath(filename));
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Throws when a safe load/write result failed.
	 *
	 * @param {object | false} result - Result returned by a safe file operation.
	 * @param {string} filename - File involved in the operation.
	 * @returns {void}
	 */
	checkFile(result, filename) {
		if (result === false) {
			throw new Error(`Error loading file ${normalizePath(filename)}`);
		}
	}

	/**
	 * Returns the standard source SVG path for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {string} Absolute source SVG path.
	 */
	sourceSvgPath(faceKey) {
		return path.join(PIPELINE_SOURCE_SVGS, this.tileSetName, `${faceKey}.svg`);
	}

	/**
	 * Returns the standard prepared SVG path for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {string} Absolute prepared SVG path.
	 */
	preparedSvgPath(faceKey) {
		return path.join(PIPELINE_PREPARED_SVGS, this.tileSetName, `${faceKey}.svg`);
	}

	/**
 * Returns the standard normalized component artifact path for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {string} Absolute normalized component JSON path.
	 */
	normalizedComponentsPath(faceKey) {
		return path.join(this.pipelineDir, "json", "normalized-components", `${faceKey}.json`);
	}

	/**
	 * Returns the whole-file freshness token used by synthesized UI views.
	 *
	 * @returns {string | null} Current currency date.
	 */
	getCurrencyDate() {
		return this.pipelineState?.currencyDate || null;
	}

	/**
	 * Sets the whole-file freshness token.
	 *
	 * @param {string} [currencyDate=new Date().toISOString()] - New currency date.
	 * @returns {string} Stored currency date.
	 */
	setCurrencyDate(currencyDate = new Date().toISOString()) {
		this.requireState();
		this.pipelineState.currencyDate = currencyDate;
		return this.pipelineState.currencyDate;
	}

	/**
	 * Throws if a caller tries to mutate stale state.
	 *
	 * @param {string} expectedCurrencyDate - Currency date supplied by the UI/client.
	 * @returns {void}
	 */
	assertCurrencyDate(expectedCurrencyDate) {
		if (!expectedCurrencyDate || expectedCurrencyDate !== this.getCurrencyDate()) {
			throw new Error(`Pipeline state currency mismatch. Expected ${expectedCurrencyDate || "(missing)"}; current ${this.getCurrencyDate() || "(missing)"}.`);
		}
	}

	/**
	 * Returns the active source tileset id.
	 *
	 * @returns {string} Tileset id.
	 */
	getTilesetId() {
		return this.requireState().tilesetId;
	}

	/**
	 * Returns the active reference set id.
	 *
	 * @returns {string | null} Reference set id.
	 */
	getReferenceSetId() {
		return this.requireState().referenceSetId || null;
	}

	/**
	 * Returns sorted canonical face keys.
	 *
	 * @returns {string[]} Face keys.
	 */
	getFaceKeys() {
		return Object.keys(this.faces()).sort((left, right) => left.localeCompare(right));
	}

	/**
	 * Returns sorted face entries.
	 *
	 * @returns {Array<[string, object]>} Face entries.
	 */
	getFaceEntries() {
		return this.getFaceKeys().map((faceKey) => [faceKey, this.getFace(faceKey)]);
	}

	/**
	 * Checks whether canonical state has a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {boolean} True when the face exists.
	 */
	hasFace(faceKey) {
		return Boolean(this.faces()[faceKey]);
	}

	/**
	 * Returns one canonical face record.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {object} Face state record.
	 */
	getFace(faceKey) {
		const face = this.faces()[faceKey];
		if (!face) {
			throw new Error(`Unknown pipeline face: ${faceKey}`);
		}
		return face;
	}

	/**
	 * Returns top-level pipeline configuration.
	 *
	 * @returns {object} Configuration object.
	 */
	getConfiguration() {
		return this.requireState().configuration || {};
	}

	/**
	 * Replaces top-level pipeline configuration after stripping non-currency dates.
	 *
	 * @param {object} configuration - New configuration.
	 * @returns {void}
	 */
	setConfiguration(configuration) {
		this.requireObject(configuration, "configuration");
		this.requireState().configuration = stripDateFields(configuration);
	}

	/**
	 * Returns mutable Optional Part Assignment rerun configuration.
	 *
	 * @returns {object} Optional-part assignment configuration.
	 */
	getOptionalPartAssignmentConfig() {
		return this.getConfiguration().optionalPartAssignment || {};
	}

	/**
	 * Stores mutable Optional Part Assignment rerun configuration.
	 *
	 * @param {object} config - Bulk options and manual assignments.
	 * @returns {void}
	 */
	setOptionalPartAssignmentConfig(config) {
		this.requireObject(config, "optional part assignment config");
		const configuration = this.getConfiguration();
		configuration.optionalPartAssignment = stripDateFields(config);
		delete configuration.stages;
		this.setConfiguration(configuration);
	}

	/**
	 * Returns rendering policy/configuration.
	 *
	 * @returns {object} Rendering object.
	 */
	getRendering() {
		return this.requireState().rendering || {};
	}

	/**
	 * Replaces rendering policy/configuration.
	 *
	 * @param {object} rendering - New rendering object.
	 * @returns {void}
	 */
	setRendering(rendering) {
		this.requireObject(rendering, "rendering");
		this.requireState().rendering = stripDateFields(rendering);
	}

	/**
	 * Merges rendering options into the rendering object.
	 *
	 * @param {object} options - Rendering option patch.
	 * @returns {void}
	 */
	setRenderingOptions(options) {
		this.requireObject(options, "rendering options");
		this.setRendering({
			...this.getRendering(),
			...stripDateFields(options),
		});
	}

	/**
	 * Returns effective rendering options for a face.
	 *
	 * The returned object includes only global rendering options plus the suit
	 * and face options that apply to the requested face. It intentionally does
	 * not include sibling suit/face override buckets, because this value feeds
	 * generated-asset hashing.
	 *
	 * @param {string} [faceKey] - Optional face key.
	 * @returns {object} Effective rendering options.
	 */
	getEffectiveRenderingOptions(faceKey) {
		const rendering = this.getRendering();
		const face = faceKey ? this.describeFace(faceKey) : null;
		const family = face?.family || null;
		const defaults = rendering.defaults || {};
		const overrides = rendering.overrides || {};

		return mergeObjects(
			renderingGlobalOptions(defaults),
			family ? renderingSuitOptionsForFamily(defaults.suits, family) : {},
			faceKey ? defaults.faces?.[faceKey] || {} : {},
			renderingGlobalOptions(overrides),
			family ? renderingSuitOptionsForFamily(overrides.suits, family) : {},
			faceKey ? overrides.faces?.[faceKey] || {} : {},
		);
	}

	/**
	 * Computes the generated-asset input hash for one face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {string} SHA-256 hash of the source face state and effective rendering options.
	 */
	hashAssetPipelineFaceInput(faceKey) {
		const payload = {
			face: stripDateFields(this.getFace(faceKey)),
			rendering: stripDateFields(this.getEffectiveRenderingOptions(faceKey)),
		};

		return sha256(stableJson(payload));
	}

	/**
	 * Computes the final generated-asset input hash for one face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {object} [options] - Hash options.
	 * @param {string} [options.baseTileVariantId] - Selected base tile variant.
	 * @returns {string} SHA-256 hash of face input plus generated-asset inputs.
	 */
	hashAssetPipelineFinalInput(faceKey, { baseTileVariantId = this.getSelectedBaseTileVariantId() } = {}) {
		return sha256(stableJson({
			faceHash: this.hashAssetPipelineFaceInput(faceKey),
			baseTileVariantId,
		}));
	}

	/**
	 * Computes the expected input hash for one generated-asset stage.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} stageId - Generated asset stage id.
	 * @param {object} [options] - Hash options.
	 * @param {string} [options.baseTileVariantId] - Selected base tile variant.
	 * @returns {string} SHA-256 hash expected for the stage output.
	 */
	hashAssetGenerationStageInput(faceKey, stageId, { baseTileVariantId = this.getSelectedBaseTileVariantId() } = {}) {
		const inputHash = this.hashAssetPipelineFaceInput(faceKey);
		const finalHash = this.hashAssetPipelineFinalInput(faceKey, { baseTileVariantId });
		return expectedGeneratedAssetStageHash(stageId, { inputHash, finalHash });
	}

	/**
	 * Enters or refreshes the generated 3D asset pipeline from accepted rendering output.
	 *
	 * @param {object} options - Initialization options.
	 * @param {string[]} [options.faceKeys] - Face keys to initialize. Defaults to all source faces.
	 * @returns {AssetPipelineInitializationResult} Initialization summary.
	 */
	initializeAssetPipelineFromRenderingAcceptance({ faceKeys = null } = {}) {
		const state = this.requireState();
		const selectedFaceKeys = (faceKeys || Object.keys(this.faces())).sort((left, right) => left.localeCompare(right));
		const assetPipeline = cleanAssetPipeline(state.assetPipeline || {});
		assetPipeline.schemaVersion = 1;
		assetPipeline.faces = assetPipeline.faces || {};
		const skippedFaceKeys = [];
		const updatedFaceKeys = [];

		for (const faceKey of selectedFaceKeys) {
			const inputHash = this.hashAssetPipelineFaceInput(faceKey);
			const existing = assetPipeline.faces[faceKey] || {};
			const renderedSvg = this.getFinalRenderingColorSvgPath(faceKey);
			if (!renderedSvg) {
				throw new Error(`No final rendered SVG artifact is recorded for ${faceKey}.`);
			}
			const nextFace = {
				...existing,
				inputHash,
				stageHashes: {
					...(existing.stageHashes || {}),
					"preview-svg": inputHash,
				},
			};

			if (existing.inputHash === inputHash
				&& existing.stageHashes?.["preview-svg"] === inputHash) {
				assetPipeline.faces[faceKey] = nextFace;
				skippedFaceKeys.push(faceKey);
				continue;
			}

			nextFace.status = existing.inputHash ? "stale" : "missing";
			assetPipeline.faces[faceKey] = nextFace;
			updatedFaceKeys.push(faceKey);
		}

		state.assetPipeline = assetPipeline;
		return { skippedFaceKeys, updatedFaceKeys };
	}

	/**
	 * Returns generated 3D asset pipeline state.
	 *
	 * @returns {object} Generated asset pipeline state.
	 */
	getAssetPipeline() {
		return cleanAssetPipeline(this.requireState().assetPipeline || {});
	}

	/**
	 * Returns the selected reusable base tile GLB variant id.
	 *
	 * @returns {string} Selected variant id, or an empty string when unselected.
	 */
	getSelectedBaseTileVariantId() {
		return this.getAssetPipeline().baseTileSelection?.variantId || "";
	}

	/**
	 * Stores the selected reusable base tile GLB variant id.
	 *
	 * @param {string} variantId - Base tile manifest variant id.
	 * @returns {boolean} True when the selected variant changed.
	 */
	setSelectedBaseTileVariantId(variantId) {
		const cleanVariantId = String(variantId || "").trim();
		if (!cleanVariantId) {
			throw new Error("Base tile variant id is required.");
		}

		const state = this.requireState();
		const previousVariantId = this.getSelectedBaseTileVariantId();
		state.assetPipeline = cleanAssetPipeline({
			...(state.assetPipeline || {}),
			baseTileSelection: {
				variantId: cleanVariantId,
			},
		});

		if (previousVariantId && previousVariantId !== cleanVariantId) {
			this.clearAssetGenerationRuntimeState();
		}

		return previousVariantId !== cleanVariantId;
	}

	/**
	 * Clears transient generated-asset queue/build state after queue ownership changes.
	 *
	 * Generated artifacts and hashes remain in place so Asset Review can derive
	 * stale/current state against the newly selected base tile.
	 *
	 * @returns {void}
	 */
	clearAssetGenerationRuntimeState() {
		const state = this.requireState();
		const assetPipeline = cleanAssetPipeline(state.assetPipeline || {});
		assetPipeline.faces = Object.fromEntries(Object.entries(assetPipeline.faces || {})
			.map(([faceKey, face]) => [faceKey, cleanAssetPipelineFace({
				...face,
				status: null,
				queue: null,
				build: null,
			})]));
		state.assetPipeline = assetPipeline;
	}

	/**
	 * Clears generated asset face state while preserving the selected base tile.
	 *
	 * @returns {void}
	 */
	resetAssetGenerationState() {
		const state = this.requireState();
		const baseTileSelection = cleanBaseTileSelection(state.assetPipeline?.baseTileSelection);
		state.assetPipeline = cleanAssetPipeline({
			...(baseTileSelection ? { baseTileSelection } : {}),
			faces: {},
		});
	}

	/**
	 * Clears generated 3D asset artifacts for this tileset only.
	 *
	 * Source SVG, review, rendering, and non-generated pipeline artifacts remain untouched.
	 *
	 * @returns {Promise<string[]>} Cleared generated asset directories.
	 */
	async clearGeneratedAssetArtifacts() {
		const directories = [
			path.join(this.pipelineDir, "models", "svg-cutter"),
			path.join(this.pipelineDir, "models", "stamped-body"),
			path.join(this.pipelineDir, "models", "colored-inlay"),
			path.join(this.pipelineDir, "json", "svg-cutter"),
			path.join(this.pipelineDir, "json", "stamped-body"),
			path.join(this.pipelineDir, "json", "colored-inlay"),
			path.join(this.pipelineDir, "images", "generated-asset-preview-png"),
		];

		for (const directory of directories) {
			if (!isInsideDirectory(directory, this.pipelineDir)) {
				throw new Error(`Refusing to clear generated assets outside the tileset output directory: ${directory}`);
			}

			await fs.rm(directory, { recursive: true, force: true });
			await fs.mkdir(directory, { recursive: true });
		}

		return directories;
	}

	/**
	 * Plans generated asset work for the selected reusable base tile.
	 *
	 * @param {object} options - Planning options.
	 * @param {string[]} [options.faceKeys] - Face keys to plan. Defaults to all faces.
	 * @returns {{plannedFaces: object[], skippedFaces: object[], totalFaceCount: number, baseTileVariantId: string}} Plan summary.
	 */
	planAssetGeneration({ faceKeys = null } = {}) {
		const baseTileVariantId = this.getSelectedBaseTileVariantId();
		if (!baseTileVariantId) {
			throw new Error("Select a base tile variant before starting asset generation.");
		}

		const state = this.requireState();
		const assetPipeline = cleanAssetPipeline(state.assetPipeline || {});
		assetPipeline.schemaVersion = 1;
		assetPipeline.faces = assetPipeline.faces || {};
		const selectedFaceKeys = (faceKeys || Object.keys(this.faces())).sort((left, right) => left.localeCompare(right));
		const plannedFaces = [];
		const skippedFaces = [];

		for (const faceKey of selectedFaceKeys) {
			const existing = assetPipeline.faces[faceKey] || {};
			const inputHash = this.hashAssetPipelineFaceInput(faceKey);
			const finalHash = this.hashAssetPipelineFinalInput(faceKey, { baseTileVariantId });
			const renderedSvg = this.getFinalRenderingColorSvgPath(faceKey);
			const baseFace = {
				...existing,
				inputHash,
				stageHashes: {
					...(existing.stageHashes || {}),
					"preview-svg": inputHash,
				},
			};

			if (this.isAssetGenerationFaceReady(existing, { inputHash, finalHash, renderedSvg })) {
				assetPipeline.faces[faceKey] = cleanAssetPipelineFace({
					...baseFace,
					status: null,
					queue: null,
					build: null,
					failure: null,
				});
				skippedFaces.push({ faceKey, status: "skipped" });
				continue;
			}

			assetPipeline.faces[faceKey] = {
				...baseFace,
				status: "queued",
				queue: {
					status: "queued",
					baseTileVariantId,
				},
			};
			plannedFaces.push({ faceKey, status: "queued" });
		}

		state.assetPipeline = assetPipeline;
		return {
			plannedFaces,
			skippedFaces,
			totalFaceCount: selectedFaceKeys.length,
			baseTileVariantId,
		};
	}

	/**
	 * Returns true when a generated asset face is current and complete.
	 *
	 * @param {object} face - Generated asset face state.
	 * @param {object} expected - Expected readiness values.
	 * @param {string} expected.inputHash - Current face input hash.
	 * @param {string} expected.finalHash - Current final generated asset input hash.
	 * @param {string} expected.renderedSvg - Current rendered SVG artifact.
	 * @returns {boolean} Whether the face can be skipped.
	 */
	isAssetGenerationFaceReady(face, { inputHash, finalHash, renderedSvg }) {
		return Boolean(face)
			&& face.inputHash === inputHash
			&& face.finalHash === finalHash
			&& Boolean(renderedSvg)
			&& REQUIRED_GENERATED_ASSET_ARTIFACTS.every((artifactName) => face.artifacts?.[artifactName])
			&& GENERATED_ASSET_STAGE_IDS.every((stageId) => this.isAssetGenerationStageReady(face, {
				stageId,
				inputHash,
				finalHash,
			}));
	}

	/**
	 * Returns true when one generated asset stage is current for a face.
	 *
	 * @param {object} face - Generated asset face state.
	 * @param {object} expected - Expected stage values.
	 * @param {string} expected.stageId - Generated asset stage id.
	 * @param {string} expected.inputHash - Current face input hash.
	 * @param {string} [expected.finalHash] - Current final generated asset input hash.
	 * @param {string} [expected.stageHash] - Explicit expected stage input hash.
	 * @returns {boolean} Whether the stage output matches the current face hash.
	 */
	isAssetGenerationStageReady(face, { stageId, inputHash, finalHash = "", stageHash = "" }) {
		const expectedHash = stageHash || expectedGeneratedAssetStageHash(stageId, { inputHash, finalHash });
		return Boolean(face)
			&& expectedHash
			&& face.stageHashes?.[stageId] === expectedHash
			&& requiredArtifactsForGeneratedAssetStage(stageId)
				.every((artifactName) => face.artifacts?.[artifactName]);
	}

	/**
	 * Updates live generated asset build state for one face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {object} updates - Face-level asset state patch.
	 * @returns {void}
	 */
	updateAssetGenerationFace(faceKey, updates = {}) {
		const state = this.requireState();
		const assetPipeline = cleanAssetPipeline(state.assetPipeline || {});
		assetPipeline.faces = assetPipeline.faces || {};
		const existing = assetPipeline.faces[faceKey] || {};
		const nextFace = {
			...existing,
			...updates,
			artifacts: {
				...(existing.artifacts || {}),
				...(updates.artifacts || {}),
			},
			queue: {
				...(existing.queue || {}),
				...(updates.queue || {}),
			},
			build: {
				...(existing.build || {}),
				...(updates.build || {}),
			},
			stageHashes: {
				...(existing.stageHashes || {}),
				...(updates.stageHashes || {}),
			},
		};

		if (updates.status === null) {
			delete nextFace.status;
		}
		if (updates.finalHash === null) {
			delete nextFace.finalHash;
		}
		if (updates.failure === null) {
			delete nextFace.failure;
		}
		if (updates.queue === null) {
			delete nextFace.queue;
		}
		if (updates.build === null) {
			delete nextFace.build;
		}
		if (!Object.keys(nextFace.queue || {}).length) {
			delete nextFace.queue;
		}
		if (!Object.keys(nextFace.build || {}).length) {
			delete nextFace.build;
		}
		if (!Object.keys(nextFace.stageHashes || {}).length) {
			delete nextFace.stageHashes;
		}

		assetPipeline.faces[faceKey] = cleanAssetPipelineFace(nextFace);
		state.assetPipeline = assetPipeline;
	}

	/**
	 * Returns the canonical final rendered color SVG artifact path for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {string | null} Repo-relative final rendered SVG path.
	 */
	getFinalRenderingColorSvgPath(faceKey) {
		return this.getFace(faceKey).artifacts?.finalRenderingColorSvg || null;
	}

	/**
	 * Stores the canonical final rendered color SVG artifact path for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} finalRenderingColorSvgPath - Repo-relative or absolute SVG path.
	 * @returns {void}
	 */
	setFinalRenderingColorSvgPath(faceKey, finalRenderingColorSvgPath) {
		const face = this.getFace(faceKey);
		face.artifacts = cleanArtifacts({
			...(face.artifacts || {}),
			finalRenderingColorSvg: normalizePath(finalRenderingColorSvgPath),
		});
	}

	/**
	 * Returns the operational source SVG artifact path for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {string | null} Source SVG path.
	 */
	getFaceSourceSvgPath(faceKey) {
		return this.getFace(faceKey).artifacts?.sourceSvg || null;
	}

	/**
	 * Stores the operational source SVG artifact path for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} sourceSvgPath - Repo-relative or absolute SVG path.
	 * @returns {void}
	 */
	setFaceSourceSvgPath(faceKey, sourceSvgPath) {
		const face = this.getFace(faceKey);
		face.artifacts = cleanArtifacts({
			...(face.artifacts || {}),
			sourceSvg: normalizePath(sourceSvgPath),
		});
	}

	/**
	 * Returns intake/source metadata used by normalization and optional search.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {object} Source metadata.
	 */
	getFaceSourceMetadata(faceKey) {
		return this.getFace(faceKey).configuration?.sourceMetadata || {};
	}

	/**
	 * Returns the durable normalized component artifact path for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {string | null} Normalized component artifact path.
	 */
	getNormalizedComponentsPath(faceKey) {
		return this.getFace(faceKey).artifacts?.normalizedComponents || null;
	}

	/**
	 * Stores the durable normalized component artifact path for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} normalizedComponentsPath - Repo-relative or absolute artifact path.
	 * @returns {void}
	 */
	setNormalizedComponentsPath(faceKey, normalizedComponentsPath) {
		const face = this.getFace(faceKey);
		face.artifacts = cleanArtifacts({
			...(face.artifacts || {}),
			normalizedComponents: normalizePath(normalizedComponentsPath),
		});
	}

	/**
	 * Loads the durable normalized component artifact for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {Promise<object>} Parsed normalized component artifact.
	 */
	async loadNormalizedComponents(faceKey) {
		const normalizedComponentsPath = this.getNormalizedComponentsPath(faceKey);
		if (!normalizedComponentsPath) {
			throw new Error(`No normalized component artifact is recorded for ${faceKey}.`);
		}

		const normalized = await this.safeLoadJson(normalizedComponentsPath);
		this.checkFile(normalized, normalizedComponentsPath);
		return normalized;
	}

	/**
	 * Returns part records for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {Object<string, object>} Part records keyed by part id.
	 */
	getParts(faceKey) {
		return this.getFace(faceKey).state?.parts || {};
	}

	/**
	 * Replaces part records for a face after phase-one cleanup.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {Object<string, object>} parts - Part records keyed by part id.
	 * @returns {void}
	 */
	setParts(faceKey, parts) {
		this.requireObject(parts, "parts");
		this.getFaceState(faceKey).parts = cleanParts(parts);
	}

	/**
	 * Returns one part record.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} partId - Semantic part id.
	 * @returns {object | null} Part record when present.
	 */
	getPart(faceKey, partId) {
		return this.getParts(faceKey)[partId] || null;
	}

	/**
	 * Stores one part record.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} partId - Semantic part id.
	 * @param {object} part - Part record.
	 * @returns {void}
	 */
	setPart(faceKey, partId, part) {
		this.requireObject(part, "part");
		const parts = {
			...this.getParts(faceKey),
			[partId]: cleanPart({
				partId,
				...part,
			}),
		};
		this.setParts(faceKey, parts);
	}

	/**
	 * Applies a patch to one part record.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} partId - Semantic part id.
	 * @param {object} patch - Part field patch.
	 * @returns {void}
	 */
	updatePart(faceKey, partId, patch) {
		this.setPart(faceKey, partId, {
			...(this.getPart(faceKey, partId) || { partId }),
			...patch,
		});
	}

	/**
	 * Returns compact binding records for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {Object<string, PipelineBinding>} Bindings keyed by component id.
	 */
	getBindings(faceKey) {
		return this.getFace(faceKey).state?.bindings || {};
	}

	/**
	 * Replaces compact binding records for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {Object<string, PipelineBinding>} bindings - Bindings keyed by component id.
	 * @returns {void}
	 */
	setBindings(faceKey, bindings) {
		this.requireObject(bindings, "bindings");
		this.getFaceState(faceKey).bindings = cleanBindings(bindings);
	}

	/**
	 * Returns one compact binding record.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} componentId - Source component id.
	 * @returns {PipelineBinding | null} Binding record when present.
	 */
	getBinding(faceKey, componentId) {
		return this.getBindings(faceKey)[componentId] || null;
	}

	/**
	 * Stores one compact binding record.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} componentId - Source component id.
	 * @param {object} binding - Binding payload.
	 * @param {string} [binding.partId] - Target part id.
	 * @param {PipelineBindingStrength} binding.strength - Binding strength.
	 * @returns {void}
	 */
	setBinding(faceKey, componentId, { partId = null, strength }) {
		const bindings = {
			...this.getBindings(faceKey),
			[componentId]: cleanBinding(componentId, {
				componentId,
				...(partId ? { partId } : {}),
				strength,
			}),
		};
		this.setBindings(faceKey, bindings);
	}

	/**
	 * Removes one binding record.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} componentId - Source component id.
	 * @returns {void}
	 */
	removeBinding(faceKey, componentId) {
		const bindings = { ...this.getBindings(faceKey) };
		delete bindings[componentId];
		this.setBindings(faceKey, bindings);
	}

	/**
	 * Applies bind/unbind command records from review gates.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {SourceBindingAction[] | Object<string, SourceBindingAction>} actions - Source binding actions.
	 * @param {ApplyBindingActionOptions} [options] - Binding action behavior.
	 * @returns {void}
	 */
	applySourceBindingActions(faceKey, actions, { unbindMode = "exclude" } = {}) {
		const actionList = Array.isArray(actions)
			? actions
			: Object.values(actions || {});

		for (const action of actionList) {
			if (!action || action.action === "none") {
				continue;
			}
			if (action.action === "unbind") {
				if (unbindMode === "reserve") {
					this.setBinding(faceKey, action.componentId, {
						strength: "strong",
					});
				} else if (unbindMode === "exclude") {
					this.setBinding(faceKey, action.componentId, {
						strength: "none",
					});
				} else {
					throw new Error(`Unknown binding unbind mode: ${unbindMode}`);
				}
				continue;
			}
			if (action.action === "bind") {
				this.setBinding(faceKey, action.componentId, {
					partId: action.partId,
					strength: "strong",
				});
				continue;
			}
			throw new Error(`Unknown source binding action: ${action.action}`);
		}
	}

	/**
	 * Returns compact alignment handoff matches for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {AlignmentMatch[]} Alignment matches.
	 */
	getAlignmentMatches(faceKey) {
		return this.getFace(faceKey).state?.alignment?.matches || [];
	}

	/**
	 * Stores compact alignment handoff matches for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {AlignmentMatch[]} matches - Compact alignment matches.
	 * @returns {void}
	 */
	setAlignmentMatches(faceKey, matches) {
		if (!Array.isArray(matches)) {
			throw new Error("Alignment matches must be an array.");
		}

		const state = this.getFaceState(faceKey);
		state.alignment = {
			matches: matches.map(cleanAlignmentMatch),
		};
	}

	/**
	 * Removes compact alignment handoff matches for a face.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {void}
	 */
	clearAlignmentMatches(faceKey) {
		const state = this.getFaceState(faceKey);
		delete state.alignment;
	}

	/**
	 * Applies rendering-needed placement fields to part records.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {Object<string, AlignmentPlacement>} placementsByPartId - Placement patches keyed by part id.
	 * @returns {void}
	 */
	applyAlignmentPlacement(faceKey, placementsByPartId) {
		this.requireObject(placementsByPartId, "alignment placements");
		this.setParts(faceKey, Object.fromEntries(Object.entries(this.getParts(faceKey))
			.map(([partId, part]) => [partId, stripAlignmentPlacementFields(part)])));
		for (const [partId, placement] of Object.entries(placementsByPartId)) {
			this.updatePart(faceKey, partId, cleanPlacement(placement));
		}
	}

	/**
	 * Records the durable normalized component artifact and invalidates stale source state.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {NormalizationResult} result - Normalization result.
	 * @returns {void}
	 */
	recordNormalizationResult(faceKey, { normalizedComponentsPath }) {
		this.setNormalizedComponentsPath(faceKey, normalizedComponentsPath);
		this.pruneAfterNormalization(faceKey);
	}

	/**
	 * Applies Optional Part Assignment output to canonical part and binding state.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {object} assignment - Optional assignment state.
	 * @param {Object<string, object>} [assignment.parts] - Part patches keyed by part id.
	 * @param {Object<string, PipelineBinding>} [assignment.bindings] - Binding records keyed by component id.
	 * @returns {void}
	 */
	applyOptionalPartAssignment(faceKey, { parts = {}, bindings = {} }) {
		const reservedBindings = Object.fromEntries(Object.entries(this.getBindings(faceKey))
			.filter(([, binding]) => binding.strength === "strong" && !binding.partId));
		this.setParts(faceKey, {
			...this.getParts(faceKey),
			...parts,
		});
		this.setBindings(faceKey, {
			...bindings,
			...reservedBindings,
		});
		this.clearDownstreamSourceState(faceKey, "optionalPartAssignment");
	}

	/**
	 * Accepts optional parts, promoting surviving optional bindings to accepted
	 * and pruning no-part optional reservations before regular assignment.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {void}
	 */
	acceptOptionalPartAssignment(faceKey) {
		const parts = this.getParts(faceKey);
		const optionalPartIds = new Set(Object.entries(parts)
			.filter(([, part]) => part?.optional === true)
			.map(([partId]) => partId));
		const nextBindings = {};
		const nextParts = {};

		for (const [componentId, binding] of Object.entries(this.getBindings(faceKey))) {
			if (!binding.partId || !optionalPartIds.has(binding.partId) || binding.strength === "none") {
				continue;
			}
			nextBindings[componentId] = {
				componentId,
				partId: binding.partId,
				strength: "accepted",
			};
		}

		for (const [partId, part] of Object.entries(parts)) {
			const { accepted, ...partWithoutAccepted } = part;
			nextParts[partId] = optionalPartIds.has(partId)
				? { ...partWithoutAccepted, accepted: true }
				: partWithoutAccepted;
		}

		this.setParts(faceKey, nextParts);
		this.setBindings(faceKey, nextBindings);
		this.clearDownstreamSourceState(faceKey, "optionalPartAssignment");
	}

	/**
	 * Applies Source Semantic Assignment output to canonical part and binding state.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {object} assignment - Semantic assignment state.
	 * @param {Object<string, object>} [assignment.parts] - Part records keyed by part id.
	 * @param {Object<string, PipelineBinding>} [assignment.bindings] - Binding records keyed by component id.
	 * @returns {void}
	 */
	applySemanticAssignment(faceKey, { parts = {}, bindings = {} }) {
		this.setParts(faceKey, {
			...this.getParts(faceKey),
			...parts,
		});
		this.setBindings(faceKey, bindings);
	}

	/**
	 * Accepts current source assignment state by promoting bound components and
	 * marking every part, including unbound parts, accepted for this gate.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {void}
	 */
	acceptSourceAssignment(faceKey) {
		const nextBindings = {};
		for (const [componentId, binding] of Object.entries(this.getBindings(faceKey))) {
			nextBindings[componentId] = binding.partId && binding.strength !== "none"
				? { ...binding, strength: "accepted" }
				: binding;
		}
		this.setBindings(faceKey, nextBindings);
		this.setParts(faceKey, Object.fromEntries(Object.entries(this.getParts(faceKey))
			.map(([partId, part]) => [partId, {
				...part,
				accepted: true,
			}])));
	}

	/**
	 * Records final rendering review acceptance in rendering-owned data.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {void}
	 */
	acceptFinalRenderingReview(faceKey) {
		const rendering = this.getRendering();
		rendering.faces = {
			...(rendering.faces || {}),
			[faceKey]: {
				...(rendering.faces?.[faceKey] || {}),
				reviewStatus: "accepted",
			},
		};
		this.setRendering(rendering);
	}

	/**
	 * Invalidates source bindings and alignment handoff after normalization.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {void}
	 */
	pruneAfterNormalization(faceKey) {
		this.setBindings(faceKey, {});
		const state = this.getFaceState(faceKey);
		state.parts = cleanParts(state.parts || {});
		delete state.alignment;
	}

	/**
	 * Applies the Optional Part Assignment prune boundary.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {void}
	 */
	pruneAfterOptionalAcceptance(faceKey) {
		this.acceptOptionalPartAssignment(faceKey);
	}

	/**
	 * Invalidates alignment handoff after source assignment changes.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {void}
	 */
	pruneAfterSourceAssignmentChange(faceKey) {
		this.clearAlignmentMatches(faceKey);
	}

	/**
	 * Clears functional downstream source state for a stage transition.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @param {"normalization" | "optionalPartAssignment"} fromStage - Owning transition.
	 * @returns {void}
	 */
	clearDownstreamSourceState(faceKey, fromStage) {
		const state = this.getFaceState(faceKey);
		if (fromStage === "normalization" || fromStage === "optionalPartAssignment") {
			delete state.alignment;
		}
		if (fromStage === "normalization") {
			state.bindings = {};
		}
	}

	/**
	 * Builds the phase-one canonical state from bootstrap and manifest inputs.
	 *
	 * @param {object} [options] - Build options.
	 * @param {object | null} [options.manifest] - Manifest override for callers that just loaded one.
	 * @returns {Promise<object>} Canonical pipeline state.
	 */
	async buildPipelineStateFromBootstrap({ manifest = null } = {}) {
		const manifestFile = path.join(PIPELINE_MANIFESTS, `${this.tileSetName}.json`);
		const activeManifest = manifest || await this.safeLoadJson(manifestFile);
		this.checkFile(activeManifest, manifestFile);

		const currencyDate = new Date().toISOString();
		const pipelineState = cloneJson(this.bootstrap);
		pipelineState.schemaVersion = SCHEMA_VERSION;
		pipelineState.tilesetId = this.tileSetName;
		pipelineState.currencyDate = currencyDate;
		pipelineState.svgPipeline = {
			...(pipelineState.svgPipeline || {}),
			faces: pipelineState.svgPipeline?.faces || {},
		};

		for (const [faceKey] of Object.entries(activeManifest.faces || {})) {
			if (!pipelineState.svgPipeline.faces[faceKey]) {
				continue;
			}

			const face = pipelineState.svgPipeline.faces[faceKey];
			face.artifacts = {
				sourceSvg: normalizePath(this.sourceSvgPath(faceKey)),
			};
		}

		return this.normalizeForPhaseOne(pipelineState);
	}

	/**
	 * Converts legacy/generated state into the phase-one canonical shape.
	 *
	 * @param {object} [state=this.pipelineState] - State to normalize.
	 * @returns {object} Normalized phase-one state.
	 */
	normalizeForPhaseOne(state = this.pipelineState) {
		if (!state || typeof state !== "object") {
			return state;
		}

		const configuration = migrateConfiguration(state.configuration || {}, state.review);
		const rendering = stripDateFields(state.rendering || {});
		const assetPipeline = cleanAssetPipeline(state.assetPipeline || {});

		const normalized = {
			schemaVersion: SCHEMA_VERSION,
			tilesetId: state.tilesetId || this.tileSetName,
			referenceSetId: state.referenceSetId || this.referenceName || null,
			currencyDate: state.currencyDate || new Date().toISOString(),
			configuration: cleanConfiguration(configuration),
			...(Object.keys(rendering).length > 0 ? { rendering } : {}),
			svgPipeline: {
				faces: {},
			},
			...(isEmptyAssetPipeline(assetPipeline) ? {} : { assetPipeline }),
		};

		for (const [faceKey, face] of Object.entries(state.svgPipeline?.faces || state.faces || {})) {
			normalized.svgPipeline.faces[faceKey] = cleanFace(face);
		}

		this.pipelineState = normalized;
		return this.pipelineState;
	}

	/**
	 * Returns loaded state or throws if the model is not started.
	 *
	 * @returns {object} Loaded pipeline state.
	 */
	requireState() {
		if (!this.pipelineState) {
			throw new Error("PipelineModel has not been started.");
		}
		return this.pipelineState;
	}

	/**
	 * Returns the canonical face map.
	 *
	 * @returns {Object<string, object>} Faces keyed by face key.
	 */
	faces() {
		return this.requireState().svgPipeline?.faces || {};
	}

	/**
	 * Returns a mutable face `state` object, creating a clean one when needed.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {object} Face state object.
	 */
	getFaceState(faceKey) {
		const face = this.getFace(faceKey);
		face.state = cleanFaceState(face.state || {});
		return face.state;
	}

	/**
	 * Throws unless a value is a plain object.
	 *
	 * @param {*} value - Value to check.
	 * @param {string} label - Error label.
	 * @returns {void}
	 */
	requireObject(value, label) {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			throw new Error(`Expected ${label} to be an object.`);
		}
	}

	/**
	 * Describes a face key with family/index pieces.
	 *
	 * @param {string} faceKey - Canonical face key.
	 * @returns {{faceKey: string, family: string, index: string | null}} Face description.
	 */
	describeFace(faceKey) {
		const match = /^([a-z-]+?)(?:-(\d+|[a-z]))?$/.exec(faceKey);
		const family = canonicalRenderingFamily(match?.[1] || faceKey);
		return {
			faceKey,
			family,
			index: match?.[2] || null,
		};
	}
}

/**
 * Migrates old configuration buckets into the phase-one configuration shape.
 *
 * @param {object} configuration - Existing configuration.
 * @param {object} [review] - Legacy review object.
 * @returns {object} Migrated configuration.
 */
function migrateConfiguration(configuration, review = null) {
	const migrated = {
		...(configuration || {}),
	};
	const optionalPartAssignment = migrated.optionalPartAssignment
		|| migrated.stages?.optionalPartAssignment
		|| review?.optionalPartAssignment;

	if (optionalPartAssignment) {
		migrated.optionalPartAssignment = optionalPartAssignment;
	}
	delete migrated.stages;

	return migrated;
}

/**
 * Keeps only phase-one configuration fields.
 *
 * @param {object} configuration - Existing configuration.
 * @returns {object} Clean configuration.
 */
function cleanConfiguration(configuration) {
	const clean = stripExpectedFields(stripDateFields(configuration || {}));
	delete clean.stages;
	return clean;
}

/**
 * Cleans one face record down to the phase-one contract.
 *
 * @param {object} face - Legacy or phase-one face record.
 * @returns {object} Clean face record.
 */
function cleanFace(face) {
	const configuration = cleanFaceConfiguration(face?.configuration || {});

	return {
		...(Object.keys(configuration).length > 0 ? { configuration } : {}),
		artifacts: cleanArtifacts(face?.artifacts || {}),
		state: cleanFaceState(face?.state || {}),
	};
}

/**
 * Keeps only operational face configuration.
 *
 * @param {object} configuration - Face configuration.
 * @returns {object} Clean face configuration.
 */
function cleanFaceConfiguration(configuration) {
	const sourceMetadata = stripDateFields(configuration.sourceMetadata || {});
	return Object.keys(sourceMetadata).length > 0 ? { sourceMetadata } : {};
}

/**
 * Keeps only durable artifact pointers that later work dereferences.
 *
 * @param {object} artifacts - Artifact pointer map.
 * @returns {{sourceSvg?: string, normalizedComponents?: string, finalRenderingColorSvg?: string, finalRenderingColorReviewPng?: string}} Clean artifact pointers.
 */
function cleanArtifacts(artifacts) {
	const clean = {};
	if (artifacts?.sourceSvg) {
		clean.sourceSvg = normalizePath(artifacts.sourceSvg);
	}
	if (artifacts?.normalizedComponents) {
		clean.normalizedComponents = normalizePath(artifacts.normalizedComponents);
	}
	if (artifacts?.finalRenderingColorSvg) {
		clean.finalRenderingColorSvg = normalizePath(artifacts.finalRenderingColorSvg);
	}
	if (artifacts?.finalRenderingColorReviewPng) {
		clean.finalRenderingColorReviewPng = normalizePath(artifacts.finalRenderingColorReviewPng);
	}
	return clean;
}

/**
 * Cleans generated 3D asset pipeline state.
 *
 * @param {object} assetPipeline - Existing asset pipeline state.
 * @returns {object} Clean asset pipeline state.
 */
function cleanAssetPipeline(assetPipeline) {
	const faces = Object.fromEntries(Object.entries(assetPipeline?.faces || {})
		.map(([faceKey, face]) => [faceKey, cleanAssetPipelineFace(face)])
		.filter(([, face]) => face));
	const baseTileSelection = cleanBaseTileSelection(assetPipeline?.baseTileSelection);

	return {
		schemaVersion: assetPipeline?.schemaVersion || 1,
		...(baseTileSelection ? { baseTileSelection } : {}),
		faces,
	};
}

/**
 * Returns whether generated 3D asset state has no selected base tile or face data.
 *
 * @param {object} assetPipeline - Clean asset pipeline state.
 * @returns {boolean} True when the state can be omitted from canonical JSON.
 */
function isEmptyAssetPipeline(assetPipeline) {
	return !assetPipeline?.baseTileSelection
		&& Object.keys(assetPipeline?.faces || {}).length === 0;
}

function isInsideDirectory(filename, directory) {
	const relative = path.relative(directory, filename);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Cleans selected reusable base tile state.
 *
 * @param {object} selection - Existing base tile selection.
 * @returns {{variantId: string} | null} Clean base tile selection.
 */
function cleanBaseTileSelection(selection) {
	const variantId = String(selection?.variantId || "").trim();
	return variantId ? { variantId } : null;
}

/**
 * Cleans one generated 3D asset face record.
 *
 * @param {object} face - Existing generated asset face state.
 * @returns {object | null} Clean face state.
 */
function cleanAssetPipelineFace(face) {
	if (!face || typeof face !== "object" || Array.isArray(face)) {
		return null;
	}

	const cleanFace = stripDateFields(face);
	const artifacts = {};
	if (cleanFace.artifacts?.cutterModel) {
		artifacts.cutterModel = normalizePath(cleanFace.artifacts.cutterModel);
	}
	if (cleanFace.artifacts?.cutterMetadata) {
		artifacts.cutterMetadata = normalizePath(cleanFace.artifacts.cutterMetadata);
	}
	if (cleanFace.artifacts?.stampedModel) {
		artifacts.stampedModel = normalizePath(cleanFace.artifacts.stampedModel);
	}
	if (cleanFace.artifacts?.stampedMetadata) {
		artifacts.stampedMetadata = normalizePath(cleanFace.artifacts.stampedMetadata);
	}
	if (cleanFace.artifacts?.inlayModel) {
		artifacts.inlayModel = normalizePath(cleanFace.artifacts.inlayModel);
	}
	if (cleanFace.artifacts?.inlayMetadata) {
		artifacts.inlayMetadata = normalizePath(cleanFace.artifacts.inlayMetadata);
	}
	if (cleanFace.artifacts?.previewPng) {
		artifacts.previewPng = normalizePath(cleanFace.artifacts.previewPng);
	}
	const stageHashes = cleanStageHashes(cleanFace.stageHashes || {});
	const status = cleanGeneratedAssetStatus(cleanFace.status);

	return {
		...(status ? { status } : {}),
		...(cleanFace.inputHash ? { inputHash: cleanFace.inputHash } : {}),
		...(cleanFace.finalHash ? { finalHash: cleanFace.finalHash } : {}),
		...(Object.keys(stageHashes).length > 0 ? { stageHashes } : {}),
		...(Object.keys(artifacts).length > 0 ? { artifacts } : {}),
		...(cleanFace.queue ? { queue: cleanFace.queue } : {}),
		...(cleanFace.build ? { build: cleanFace.build } : {}),
		...(cleanFace.failure ? { failure: cleanFace.failure } : {}),
		...(cleanFace.review ? { review: cleanFace.review } : {}),
		...(cleanFace.publication ? { publication: cleanFace.publication } : {}),
	};
}

/**
 * Cleans per-stage generated asset input hashes.
 *
 * @param {object} stageHashes - Stage hash map.
 * @returns {Object<string, string>} Clean stage hash map.
 */
function cleanStageHashes(stageHashes) {
	return Object.fromEntries(Object.entries(stageHashes || {})
		.filter(([stageId, hash]) => stageId && typeof hash === "string" && hash.trim())
		.map(([stageId, hash]) => [stageId, hash.trim()])
		.sort((left, right) => left[0].localeCompare(right[0])));
}

/**
 * Keeps only non-completion generated asset status values.
 *
 * @param {string} status - Candidate status.
 * @returns {string} Clean status.
 */
function cleanGeneratedAssetStatus(status) {
	if (!status || status === "ready" || String(status).endsWith("-ready")) {
		return "";
	}
	return String(status);
}

/**
 * Returns canonical artifact pointers required for one generated asset stage.
 *
 * @param {string} stageId - Generated asset stage id.
 * @returns {string[]} Required artifact names.
 */
function requiredArtifactsForGeneratedAssetStage(stageId) {
	if (stageId === "preview-svg") {
		return [];
	}
	if (stageId === "svg-cutter") {
		return ["cutterMetadata"];
	}
	if (stageId === "stamped-body") {
		return ["stampedModel", "stampedMetadata"];
	}
	if (stageId === "colored-inlay") {
		return ["inlayModel", "inlayMetadata"];
	}
	if (stageId === "preview-png") {
		return ["previewPng"];
	}
	return [];
}

/**
 * Returns the stage hash expected for a generated-asset stage.
 *
 * @param {string} stageId - Generated asset stage id.
 * @param {object} hashes - Available hashes.
 * @param {string} hashes.inputHash - Current face/rendering hash.
 * @param {string} [hashes.finalHash] - Current final generated asset hash.
 * @returns {string} Expected stage hash.
 */
function expectedGeneratedAssetStageHash(stageId, { inputHash, finalHash = "" }) {
	const baseHash = generatedAssetStageUsesFinalInput(stageId)
		? finalHash
		: inputHash;
	const version = GENERATED_ASSET_STAGE_VERSIONS[stageId] || 1;

	return version > 1
		? sha256(stableJson({ stageId, version, inputHash: baseHash }))
		: baseHash;
}

/**
 * Returns whether a generated-asset stage depends on the selected base tile.
 *
 * @param {string} stageId - Generated asset stage id.
 * @returns {boolean} Whether the stage uses final generated input.
 */
function generatedAssetStageUsesFinalInput(stageId) {
	return stageId === "stamped-body"
		|| stageId === "colored-inlay"
		|| stageId === "preview-png";
}

/**
 * Cleans one face state record.
 *
 * @param {object} state - Face state record.
 * @returns {object} Clean face state.
 */
function cleanFaceState(state) {
	return {
		parts: cleanParts(state.parts || {}),
		bindings: cleanBindings(state.bindings || {}),
		...(state.alignment?.matches ? {
			alignment: {
				matches: state.alignment.matches.map(cleanAlignmentMatch),
			},
		} : {}),
	};
}

/**
 * Cleans part records keyed by part id.
 *
 * @param {Object<string, object>} parts - Part records keyed by part id.
 * @returns {Object<string, object>} Clean part records.
 */
function cleanParts(parts) {
	return Object.fromEntries(Object.entries(parts || {})
		.map(([partId, part]) => [partId, cleanPart({ partId, ...part })]));
}

/**
 * Removes fields that do not belong in a functional part record.
 *
 * @param {object} part - Part record.
 * @returns {object} Clean part record.
 */
function cleanPart(part) {
	const cleaned = stripDateFields(part || {});
	if (cleaned.reviewStatus === "accepted") {
		cleaned.accepted = true;
	}
	delete cleaned.reviewStatus;
	delete cleaned.sourceState;
	delete cleaned.expected;
	delete cleaned.sourceComponentIds;
	delete cleaned.componentIds;
	delete cleaned.alignmentCandidateId;
	delete cleaned.alignmentIds;
	delete cleaned.alignmentStrategy;
	delete cleaned.alignmentScore;
	delete cleaned.alignmentScoreKind;
	delete cleaned.semanticAssignmentId;
	delete cleaned.strength;
	return cleaned;
}

/**
 * Cleans binding records keyed by component id.
 *
 * @param {Object<string, object>} bindings - Binding records keyed by component id.
 * @returns {Object<string, PipelineBinding>} Clean binding records.
 */
function cleanBindings(bindings) {
	return Object.fromEntries(Object.entries(bindings || {})
		.map(([componentId, binding]) => [componentId, cleanBinding(componentId, binding)])
		.filter(([, binding]) => binding));
}

/**
 * Cleans one binding record down to component id, part id, and strength.
 *
 * @param {string} componentId - Source component id.
 * @param {object} binding - Binding record.
 * @returns {PipelineBinding | null} Clean binding record.
 */
function cleanBinding(componentId, binding) {
	if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
		return null;
	}

	const strength = binding.strength || "tentative";
	if (!VALID_BINDING_STRENGTHS.has(strength)) {
		throw new Error(`Invalid binding strength for ${componentId}: ${strength}`);
	}
	if (strength !== "none" && strength !== "strong" && !binding.partId) {
		throw new Error(`Binding ${componentId} requires partId for strength ${strength}.`);
	}

	return {
		componentId,
		...(binding.partId ? { partId: binding.partId } : {}),
		strength,
	};
}

/**
 * Cleans one compact alignment handoff match.
 *
 * @param {object} match - Alignment match-like record.
 * @returns {AlignmentMatch} Clean alignment match.
 */
function cleanAlignmentMatch(match) {
	if (!match || typeof match !== "object" || Array.isArray(match)) {
		throw new Error("Alignment match must be an object.");
	}
	if (!match.id) {
		throw new Error("Alignment match requires id.");
	}

	return {
		id: match.id,
		source: uniqueStrings(match.source || match.sourceComponentIds || []),
		reference: uniqueStrings(match.reference || match.referenceComponentIds || []),
		...(match.transform ? { transform: cloneJson(match.transform) } : {}),
		...(match.sourceBounds ? { sourceBounds: cloneJson(match.sourceBounds) } : {}),
		...(match.targetBounds ? { targetBounds: cloneJson(match.targetBounds) } : {}),
		...(match.alignedBounds ? { alignedBounds: cloneJson(match.alignedBounds) } : {}),
	};
}

/**
 * Converts placement data into rendering-consumed part fields.
 *
 * @param {AlignmentPlacement} placement - Placement patch.
 * @returns {object} Part placement fields.
 */
function cleanPlacement(placement) {
	const clean = {};
	if (placement.sourceBounds) {
		clean.alignmentSourceBounds = cloneJson(placement.sourceBounds);
	}
	if (placement.targetBounds) {
		clean.alignmentTargetBounds = cloneJson(placement.targetBounds);
	}
	if (placement.alignedBounds) {
		clean.alignmentAlignedBounds = cloneJson(placement.alignedBounds);
	}
	if (placement.transform) {
		const transform = cleanPlacementTransform(placement.transform);
		if (transform) {
			clean.alignmentTransform = transform;
		}
	}
	return clean;
}

/**
 * Removes renderer placement fields from a part.
 *
 * @param {object} part - Part record.
 * @returns {object} Part without alignment placement fields.
 */
function stripAlignmentPlacementFields(part) {
	const {
		alignmentSourceBounds,
		alignmentTargetBounds,
		alignmentAlignedBounds,
		alignmentTransform,
		...rest
	} = part || {};
	return rest;
}

/**
 * Keeps only the renderer-consumed transform shape.
 *
 * @param {object} transform - Transform-like object.
 * @returns {object | null} Clean transform object.
 */
function cleanPlacementTransform(transform) {
	return Array.isArray(transform?.matrix)
		? { matrix: cloneJson(transform.matrix) }
		: null;
}

/**
 * Removes non-currency date fields recursively.
 *
 * @param {*} value - Value to clean.
 * @returns {*} Value without `generatedOn`, `updatedOn`, or `acceptedOn` fields.
 */
function stripDateFields(value) {
	if (Array.isArray(value)) {
		return value.map(stripDateFields);
	}
	if (!value || typeof value !== "object") {
		return value;
	}

	return Object.fromEntries(Object.entries(value)
		.filter(([key]) => !DATE_FIELD_NAMES.has(key))
		.map(([key, child]) => [key, stripDateFields(child)]));
}

/**
 * Removes retired optional source-presence fields recursively.
 *
 * @param {*} value - Value to clean.
 * @returns {*} Value without canonical `expected` fields.
 */
function stripExpectedFields(value) {
	if (Array.isArray(value)) {
		return value.map(stripExpectedFields);
	}
	if (!value || typeof value !== "object") {
		return value;
	}

	return Object.fromEntries(Object.entries(value)
		.filter(([key]) => key !== "expected")
		.map(([key, child]) => [key, stripExpectedFields(child)]));
}

/**
 * Returns the rendering options that apply globally, without nested buckets.
 *
 * @param {object} options - Rendering options object.
 * @returns {object} Global-only rendering options.
 */
function renderingGlobalOptions(options) {
	const {
		schemaVersion,
		tilesetId,
		suits,
		faces,
		...globalOptions
	} = options || {};
	return globalOptions;
}

/**
 * Returns the merged suit rendering options for a canonical family.
 *
 * @param {object} suits - Rendering suit options keyed by family name.
 * @param {string} family - Canonical face family.
 * @returns {object} Effective suit options.
 */
function renderingSuitOptionsForFamily(suits, family) {
	return renderingFamilyOptionKeys(family)
		.reduce((merged, key) => mergeObjects(merged, suits?.[key] || {}), {});
}

/**
 * Returns all suit option keys that may apply to a face family.
 *
 * @param {string} family - Face family.
 * @returns {string[]} Suit option keys, broad aliases first.
 */
function renderingFamilyOptionKeys(family) {
	const canonical = canonicalRenderingFamily(family);
	const aliases = {
		character: ["characters", "character"],
		dot: ["dots", "dot"],
		wind: ["winds", "wind"],
		dragon: ["dragons", "dragon"],
		flower: ["flowers", "flower"],
		season: ["seasons", "season"],
	};
	return aliases[canonical] || [canonical];
}

/**
 * Canonicalizes source face prefixes into rendering families.
 *
 * @param {string} family - Raw family or face prefix.
 * @returns {string} Canonical rendering family.
 */
function canonicalRenderingFamily(family) {
	return {
		b: "bamboo",
		c: "character",
		d: "dot",
		characters: "character",
		dots: "dot",
		winds: "wind",
		dragons: "dragon",
		flowers: "flower",
		seasons: "season",
	}[family] || family;
}

/**
 * Deep-merges object values from left to right.
 *
 * @param {...object} objects - Objects to merge.
 * @returns {object} Merged object.
 */
function mergeObjects(...objects) {
	return objects.reduce((merged, object) => deepMerge(merged, object || {}), {});
}

/**
 * Recursively merges two objects.
 *
 * @param {object} left - Base object.
 * @param {object} right - Override object.
 * @returns {object} Merged object.
 */
function deepMerge(left, right) {
	const merged = { ...(left || {}) };
	for (const [key, value] of Object.entries(right || {})) {
		merged[key] = value && typeof value === "object" && !Array.isArray(value)
			? deepMerge(merged[key] || {}, value)
			: value;
	}
	return merged;
}

/**
 * Returns sorted unique non-empty strings.
 *
 * @param {Array<*>} values - Candidate values.
 * @returns {string[]} Unique strings.
 */
function uniqueStrings(values) {
	return [...new Set((values || [])
		.filter((value) => typeof value === "string" && value.trim())
		.map((value) => value.trim()))];
}

/**
 * Clones a JSON-serializable value.
 *
 * @param {*} value - Value to clone.
 * @returns {*} Cloned value.
 */
function cloneJson(value) {
	return JSON.parse(JSON.stringify(value ?? null));
}

/**
 * Returns a stable JSON string with object keys sorted recursively.
 *
 * @param {*} value - JSON-like value.
 * @returns {string} Stable JSON string.
 */
function stableJson(value) {
	return JSON.stringify(sortJsonValue(value));
}

/**
 * Sorts JSON object keys recursively.
 *
 * @param {*} value - JSON-like value.
 * @returns {*} Sorted JSON-like value.
 */
function sortJsonValue(value) {
	if (Array.isArray(value)) {
		return value.map(sortJsonValue);
	}
	if (!value || typeof value !== "object") {
		return value;
	}

	return Object.fromEntries(Object.keys(value)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => [key, sortJsonValue(value[key])]));
}

/**
 * Computes a SHA-256 hex digest.
 *
 * @param {string} value - Value to hash.
 * @returns {string} SHA-256 hex digest.
 */
function sha256(value) {
	return crypto.createHash("sha256").update(value).digest("hex");
}
