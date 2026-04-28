import { promises as fs } from 'fs';
import path from 'path';
import { OUTPUT_3D_DIR, ROOT_DIR } from '../shared/asset-paths.js';
import { groupAnalogComponents } from './analog-component-matcher.js';
import { getComponentUnionBounds } from './normalized-face-components.js';

export const DEFAULT_OPTIONAL_PART_TILESET_ID = 'wiki';

/**
 * Derives Stage 3 optional-part assignments from normalized components.
 */
export class OptionalPartAssignmentRunner {
	/**
	 * Creates a runner with replaceable filesystem and pipeline dependencies.
	 *
	 * @param {OptionalPartAssignmentRunnerDependencies} dependencies - Dependencies used by the optional-part workflow.
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
	 * Runs optional-part assignment for all selected canonical faces.
	 *
	 * @param {OptionalPartAssignmentRunOptions} options - Optional-part assignment options resolved by the CLI or tests.
	 * @returns {Promise<OptionalPartAssignmentSummary>} Summary of model updates and in-memory diagnostics.
	 */
	async run(options = {}) {
		const tilesetId = options.tilesetId || DEFAULT_OPTIONAL_PART_TILESET_ID;
		const pipelineModel = options.pipelineModel;

		if (!pipelineModel) {
			throw new Error('OptionalPartAssignmentRunner requires a PipelineModel.');
		}

		const pipelineState = pipelineModel.pipelineState;
		const activeTilesetId = pipelineModel.getTilesetId();
		const requestedFaceKey = options.faceKey || null;
		const optionalPartConfig = pipelineModel.getOptionalPartAssignmentConfig();
		const bulkOptions = optionalPartConfig.bulkOptions || null;
		const manualAssignments = optionalPartConfig.manualAssignments || null;
		const generatedOn = this.clock();
		const faceEntries = pipelineModel.getFaceEntries()
			.filter(([faceKey]) => !requestedFaceKey || faceKey === requestedFaceKey)
			.sort(([left], [right]) => left.localeCompare(right));
		const report = this.createReport({ tilesetId: activeTilesetId, generatedOn });

		for (const [faceKey, faceState] of faceEntries) {
			await this.processFace({
				tilesetId: activeTilesetId,
				faceKey,
				faceState,
				pipelineState,
				pipelineModel,
				generatedOn,
				report,
				bulkOptions,
				manualAssignments,
			});
		}

		await pipelineModel.save();

		return {
			tilesetId: activeTilesetId,
			faceCount: report.faceCount,
			optionalPartCount: report.optionalPartCount,
			candidateCount: report.candidateCount,
			diagnosticCount: report.diagnosticCount,
			warningCount: report.warningCount + report.warnings.length,
		};
	}

	/**
	 * Creates the report shell accumulated during a run.
	 *
	 * @param {OptionalPartCreateReportOptions} options - Report identity fields.
	 * @returns {OptionalPartAssignmentReport} Empty report for the run.
	 */
	createReport({ tilesetId, generatedOn }) {
		return {
			schemaVersion: 1,
			tilesetId,
			generatedOn,
			faceCount: 0,
			optionalPartCount: 0,
			candidateCount: 0,
			diagnosticCount: 0,
			warningCount: 0,
			warnings: [],
			faces: {},
		};
	}

	/**
	 * Processes one canonical face and updates the model plus in-memory report totals.
	 *
	 * @param {OptionalPartProcessFaceOptions} options - Per-face processing context.
	 * @returns {Promise<void>}
	 */
	async processFace({
		tilesetId,
		faceKey,
		faceState,
		pipelineState,
		pipelineModel,
		generatedOn,
		report,
		bulkOptions,
		manualAssignments,
	}) {
		const normalizedPath = this.resolveModelArtifact(pipelineModel, faceKey, 'normalizedComponents');

		if (!(await this.exists(normalizedPath))) {
			report.warnings.push({
				faceKey,
				code: 'missing-normalized-components',
				message: `No normalized component artifact exists at ${normalizedPath ? this.normalizePath(normalizedPath) : 'faces.' + faceKey + '.artifacts.normalizedComponents'}.`,
			});
			return;
		}

		const normalized = await this.readJson(normalizedPath);
		const artifact = this.buildOptionalPartArtifact({
			tilesetId,
			faceKey,
			generatedOn,
			normalizedPath,
			sourceFile: faceState?.artifacts?.sourceSvg || normalized.sourceFile || null,
			normalized,
			faceState,
			pipelineState,
			bulkOptions,
			manualAssignments,
		});

		pipelineModel.applyOptionalPartAssignment(faceKey, this.modelAssignmentFromArtifact(artifact));

		report.faceCount += 1;
		report.optionalPartCount += Object.keys(artifact.optionalParts).length;
		report.candidateCount += artifact.summary.candidateCount;
		report.diagnosticCount += artifact.diagnostics.length;
		report.warningCount += artifact.diagnostics.filter((diagnostic) => diagnostic.level === 'warning').length;
		report.faces[faceKey] = {
			status: artifact.status,
			optionalPartCount: Object.keys(artifact.optionalParts).length,
			candidateCount: artifact.summary.candidateCount,
			bindingCount: (artifact.bindingSuggestions || []).length,
			diagnostics: artifact.diagnostics,
		};
	}

	/**
	 * Builds the optional-part artifact for one normalized face.
	 *
	 * @param {OptionalPartArtifactOptions} options - Inputs needed to derive optional parts and reservations.
	 * @returns {OptionalPartAssignmentArtifact} Stage 3 optional-part artifact.
	 */
	buildOptionalPartArtifact({
		tilesetId,
		faceKey,
		generatedOn,
		normalizedPath,
		sourceFile,
		normalized,
		faceState,
		pipelineState,
		bulkOptions,
		manualAssignments,
	}) {
		const face = this.describeFace(faceKey);
		const sourceMetadata = this.sourceMetadataForFace({
			faceKey,
			faceState,
			pipelineState,
			normalized,
		});
		const sourceSpecs = this.sourcePartSpecsForFace(faceKey, bulkOptions, sourceMetadata)
			.sort((left, right) => this.optionalPartSpecPriority(left) - this.optionalPartSpecPriority(right));
		const components = normalized.components || [];
		const alignmentComponentIds = new Set(normalized.alignmentComponentIds || []);
		const sourceComponents = components.filter((component) => (
			alignmentComponentIds.has(component.componentId)
			&& !component.classification?.tileLayerCandidate
			&& !component.classification?.negativeSpaceCandidate
		));
		const sourceBounds = normalized.alignmentBounds || getComponentUnionBounds(sourceComponents);
		const candidateUnits = this.makeCandidateUnits(sourceComponents, sourceBounds);
		const optionalParts = {};
		const bindingSuggestions = [];
		const diagnostics = [];
		const metadataSeed = {
			glyphLayout: {},
		};
		const manualFaceAssignments = this.manualAssignmentsForFace(faceKey, manualAssignments);
		const reservedComponentIds = this.optionalAssignmentReservedComponentIds(faceState);
		const acceptedCandidatesByPartId = new Map();

		for (const spec of sourceSpecs) {
			const effectiveSpec = this.specWithAcceptedOptionalContext(spec, acceptedCandidatesByPartId);
			const hasManualAssignment = Object.prototype.hasOwnProperty.call(manualFaceAssignments, spec.partId);
			const manualComponentIds = manualFaceAssignments[spec.partId] || [];
			const candidates = effectiveSpec.searchSource
				? this.scoreCandidatesForSpec(candidateUnits, effectiveSpec)
					.filter((candidate) => !this.candidateUsesReservedComponent(candidate, reservedComponentIds))
					.filter((candidate) => this.candidateMatchesContextualSpec(candidate, effectiveSpec))
					.filter((candidate) => candidate.score >= 0.35)
					.slice(0, 6)
				: [];
			const rawManualCandidate = this.manualCandidateForSpec(
				manualComponentIds,
				sourceComponents,
				sourceBounds,
			);
			const manualCandidate = rawManualCandidate
				&& !this.candidateUsesReservedComponent(rawManualCandidate, reservedComponentIds)
				? rawManualCandidate
				: null;
			const suggested = hasManualAssignment ? manualCandidate : this.suggestedCandidateForSpec(effectiveSpec, candidates);
			const autoAcceptScore = this.autoAcceptScoreForSpec(effectiveSpec);
			const state = !effectiveSpec.searchSource
				? 'source-absent'
				: suggested && suggested.score >= autoAcceptScore
					? 'candidate-found'
					: 'needs-review';
			const strength = manualCandidate ? 'strong' : state === 'candidate-found' ? 'tentative' : 'none';
			const reviewStatus = manualCandidate ? 'reviewed' : state === 'candidate-found' ? 'inferred' : 'needs-review';
			const bindingSuggestion = strength === 'none' ? null : suggested;
			const candidateList = manualCandidate
				? [manualCandidate, ...candidates.filter((candidate) => !sameComponentIdSet(candidate.componentIds, manualCandidate.componentIds))]
				: candidates;

			optionalParts[spec.partId] = {
				partId: spec.partId,
				contentKind: spec.contentKind,
				role: spec.role,
				sourceState: state,
				hint: {
					region: effectiveSpec.region,
					targetPoint: effectiveSpec.targetPoint,
					initialCandidateScoring: effectiveSpec.initialCandidateScoring || null,
				},
				suggestedComponentIds: [],
				suggestedBounds: null,
				reviewStatus,
				candidates: candidateList,
			};

			if (bindingSuggestion) {
				bindingSuggestions.push({
					partId: spec.partId,
					componentIds: bindingSuggestion.componentIds,
					bounds: bindingSuggestion.bounds,
					score: bindingSuggestion.score,
					strength,
					reviewStatus,
				});
				for (const componentId of bindingSuggestion.componentIds || []) {
					reservedComponentIds.add(componentId);
				}
				acceptedCandidatesByPartId.set(spec.partId, bindingSuggestion);
			} else if (effectiveSpec.searchSource) {
				diagnostics.push({
					level: 'info',
					code: 'no-optional-part-candidate',
					partId: spec.partId,
					message: `No candidate was found for optional ${spec.partId}.`,
				});
			}

			if (spec.metadataKey) {
				metadataSeed.glyphLayout[spec.metadataKey] = {
					sourceCorner: this.regionToSourceCorner(spec.region),
				};
			}
		}

		if (sourceSpecs.length === 0) {
			diagnostics.push({
				level: 'info',
				code: 'no-optional-part-specs',
				message: `No optional part specs are defined for ${faceKey}.`,
			});
		}

		const artifact = {
			schemaVersion: 1,
			tilesetId,
			faceKey,
			generatedOn,
			sourceFile: sourceFile ? this.normalizePath(this.path.resolve(this.rootDir, sourceFile)) : normalized.sourceFile,
			normalizedComponents: this.normalizePath(normalizedPath),
			status: diagnostics.some((diagnostic) => diagnostic.level === 'warning') ? 'needs-review' : 'ready',
			face,
			sourceBounds,
			summary: {
				sourceComponentCount: sourceComponents.length,
				candidateUnitCount: candidateUnits.length,
				candidateCount: Object.values(optionalParts)
					.reduce((total, part) => total + part.candidates.length, 0),
			},
			optionalParts,
			metadataSeed,
			diagnostics,
		};
		Object.defineProperty(artifact, 'bindingSuggestions', {
			value: bindingSuggestions,
			enumerable: false,
		});
		return artifact;
	}

	specWithAcceptedOptionalContext(spec, acceptedCandidatesByPartId) {
		if (spec.partId !== 'glyph' || spec.region !== 'either-corner') {
			return spec;
		}

		const labelCandidate = acceptedCandidatesByPartId.get('label');
		const oppositeRegion = this.oppositeTopCornerRegion(labelCandidate?.region);

		if (!oppositeRegion) {
			return spec;
		}

		return {
			...spec,
			region: oppositeRegion,
			targetPoint: this.regionTarget(oppositeRegion),
			contextSource: 'accepted-label-opposite-side',
		};
	}

	oppositeTopCornerRegion(region) {
		if (region === 'top-left') {
			return 'top-right';
		}

		if (region === 'top-right') {
			return 'top-left';
		}

		return null;
	}

	candidateMatchesContextualSpec(candidate, spec) {
		if (spec.contextSource !== 'accepted-label-opposite-side') {
			return true;
		}

		const x = candidate.normalizedCenter?.x;
		if (typeof x !== 'number') {
			return true;
		}

		if (spec.region === 'top-right') {
			return x >= 0.45;
		}

		if (spec.region === 'top-left') {
			return x <= 0.55;
		}

		return true;
	}

	autoAcceptScoreForSpec(spec) {
		if (spec.contentKind === 'glyph' && spec.contextSource === 'accepted-label-opposite-side') {
			return 0.42;
		}

		return spec.contentKind === 'glyph' ? 0.48 : 0.55;
	}

	suggestedCandidateForSpec(spec, candidates) {
		const firstCandidate = candidates[0] || null;

		if (!firstCandidate || spec.contentKind !== 'glyph') {
			return firstCandidate;
		}

		const completeSourceElementCandidate = candidates.find((candidate) => (
			candidate.unitKind === 'source-element-group'
			&& candidate.score >= firstCandidate.score - 0.16
			&& isProperComponentSuperset(candidate.componentIds, firstCandidate.componentIds)
		));

		return completeSourceElementCandidate || firstCandidate;
	}

	optionalPartSpecPriority(spec) {
		if (spec.partId === 'label') {
			return 10;
		}

		if (spec.partId === 'glyph') {
			return 20;
		}

		return 100;
	}

	candidateUsesReservedComponent(candidate, reservedComponentIds) {
		return (candidate?.componentIds || []).some((componentId) => reservedComponentIds.has(componentId));
	}

	optionalAssignmentReservedComponentIds(faceState) {
		return new Set(Object.entries(faceState?.state?.bindings || {})
			.filter(([, binding]) => binding?.strength === 'strong' && !binding.partId)
			.map(([componentId]) => componentId));
	}

	modelAssignmentFromArtifact(artifact) {
		const parts = {};
		const bindings = {};
		for (const [partId, optionalPart] of Object.entries(artifact.optionalParts || {})) {
			parts[partId] = {
				partId,
				contentKind: optionalPart.contentKind,
				role: optionalPart.role,
				optional: true,
			};
		}
		for (const suggestion of artifact.bindingSuggestions || []) {
			for (const componentId of suggestion.componentIds || []) {
				bindings[componentId] = {
					componentId,
					partId: suggestion.partId,
					strength: suggestion.strength,
				};
			}
		}
		return { parts, bindings };
	}

	/**
	 * Describes which optional label/glyph specs apply to a face.
	 *
	 * @param {string} faceKey - Face key being assigned.
	 * @param {OptionalPartBulkOptions | null} bulkOptions - Optional bulk source-search settings.
	 * @param {SourceIntakeMetadata | null} sourceMetadata - Intake metadata copied from the normalized artifact.
	 * @returns {OptionalPartSourceSpec[]} Optional-part source-search specs for the face.
	 */
	sourcePartSpecsForFace(faceKey, bulkOptions = null, sourceMetadata = null) {
		const face = this.describeFace(faceKey);
		const spec = (partId, contentKind, role, region, metadataKey) => this.applyBulkOption(
			this.makeSourcePartSpec(partId, contentKind, role, region, metadataKey, this.expectedLabelForSpec(face, partId, role)),
			face,
			metadataKey,
			bulkOptions,
		);
		const metadataSpecs = this.metadataSourcePartSpecs(face, bulkOptions, sourceMetadata);

		if (metadataSpecs.length > 0) {
			return metadataSpecs;
		}

		if (face.family === 'flower') {
			const layout = this.optionalPairLayoutForFace(face, bulkOptions);

			return [
				spec('label', 'label', 'suit-label', layout.labelRegion, 'label'),
				spec('glyph', 'glyph', 'flower-character', layout.characterRegion, 'character'),
			];
		}

		if (face.family === 'season') {
			const layout = this.optionalPairLayoutForFace(face, bulkOptions);

			return [
				spec('label', 'label', 'suit-label', layout.labelRegion, 'label'),
				spec('glyph', 'glyph', 'season-character', layout.characterRegion, 'character'),
			];
		}

		if (face.family === 'character') {
			return [
				spec('label', 'label', 'suit-label', 'top-left', 'label'),
			];
		}

		if (face.family === 'wind') {
			return [
				spec('label', 'label', 'wind-label', 'top-left', 'label'),
			];
		}

		if (face.family === 'bamboo' || face.family === 'dot') {
			return [
				spec('label', 'label', 'suit-label', 'top-left', 'label'),
			];
		}

		if (face.family === 'dragon') {
			return [
				spec('label', 'label', 'dragon-label', 'top-right', 'label'),
			];
		}

		return [];
	}

	sourceMetadataForFace({ faceKey, faceState, pipelineState, normalized }) {
		const face = this.describeFace(faceKey);
		const suitKeys = this.pipelineSuitKeys(face.family);
		const configurationParts = this.mergedPartOptions({
			root: pipelineState?.configuration,
			suitKeys,
			faceKey,
		});
		const sourceParsingParts = {};

		for (const [partId, part] of Object.entries(configurationParts)) {
			if (!part.sourceSearch) {
				continue;
			}

			const statePart = faceState?.state?.parts?.[partId] || {};
			sourceParsingParts[partId] = {
				partId,
				contentKind: statePart.contentKind || part.contentKind || partId,
				role: statePart.role || part.role || partId,
				region: part.sourceSearch.region || 'top-left',
				expectedLabel: this.expectedLabelForSpec(face, partId, statePart.role || part.role || partId),
				initialCandidateScoring: this.initialCandidateScoringForPart({
					root: pipelineState?.configuration,
					part,
				}),
				metadataKey: part.metadataKey ?? this.optionalPartMetadataKey(partId),
				searchSource: part.sourceSearch?.enabled !== false,
			};
		}

		return {
			...(normalized?.sourceMetadata || normalized?.metadata || {}),
			sourceParsing: {
				optionalParts: sourceParsingParts,
			},
		};
	}

	mergedPartOptions({ root, suitKeys, faceKey }) {
		const parts = {};
		const defaults = root?.defaults || {};
		const overrides = root?.overrides || {};

		for (const suitKey of suitKeys) {
			Object.assign(parts, defaults?.suits?.[suitKey]?.parts || {});
		}

		Object.assign(parts, defaults?.faces?.[faceKey]?.parts || {});

		for (const suitKey of suitKeys) {
			Object.assign(parts, overrides?.suits?.[suitKey]?.parts || {});
		}

		Object.assign(parts, overrides?.faces?.[faceKey]?.parts || {});

		return parts;
	}

	pipelineSuitKeys(family) {
		const pluralByFamily = {
			bamboo: 'bamboo',
			character: 'characters',
			dot: 'dots',
			dragon: 'dragons',
			flower: 'flowers',
			season: 'seasons',
			wind: 'winds',
		};

		return [
			pluralByFamily[family] || family,
			family,
		].filter(Boolean);
	}

	metadataSourcePartSpecs(face, bulkOptions, sourceMetadata = null) {
		return this.metadataSourcePartEntries(sourceMetadata)
			.map(([partId, part]) => {
				const spec = {
					...this.makeSourcePartSpec(
						part.partId || partId,
						part.contentKind || 'artwork',
						part.role || partId,
						part.region || 'top-left',
						part.metadataKey ?? this.optionalPartMetadataKey(part.partId || partId),
						part.expectedLabel ?? this.expectedLabelForSpec(face, part.partId || partId, part.role || partId),
					),
					searchSource: part.searchSource !== false,
					initialCandidateScoring: part.initialCandidateScoring || null,
				};

				return this.applyBulkOption(
					spec,
					face,
					part.metadataKey ?? this.optionalPartMetadataKey(part.partId || partId),
					bulkOptions,
				);
			});
	}

	optionalPartMetadataKey(partId) {
		return partId === 'glyph' ? 'character' : partId;
	}

	metadataSourcePartEntries(sourceMetadata = null) {
		return this.metadataPartEntries(sourceMetadata?.sourceParsing?.optionalParts || {});
	}

	metadataPartEntries(parts = {}) {
		if (Array.isArray(parts)) {
			return parts.map((part) => [part.partId, part]).filter(([partId]) => partId);
		}

		return Object.entries(parts);
	}

	/**
	 * Creates a default optional-part search spec before bulk settings are applied.
	 *
	 * @param {string} partId - Stage-local optional part id.
	 * @param {string} contentKind - Semantic content kind.
	 * @param {string} role - Semantic role.
	 * @param {string} region - Expected source region.
	 * @param {string} metadataKey - Glyph metadata key to seed.
	 * @param {string | null} expectedLabel - Expected label text for this source part.
	 * @returns {OptionalPartSourceSpec} Default optional-part source-search spec.
	 */
	makeSourcePartSpec(partId, contentKind, role, region, metadataKey, expectedLabel = null) {
		return {
			partId,
			contentKind,
			role,
			region,
			targetPoint: this.regionTarget(region),
			metadataKey,
			expectedLabel,
			searchSource: true,
		};
	}

	expectedLabelForSpec(face, partId, role) {
		if (partId !== 'label') {
			return null;
		}

		if (face.family === 'wind') {
			return String(face.value || '').toUpperCase();
		}

		if (face.family === 'dragon') {
			return {
				r: 'C',
				g: 'F',
				w: 'P',
			}[face.value] || null;
		}

		if (role === 'suit-label' || ['bamboo', 'character', 'dot', 'flower', 'season'].includes(face.family)) {
			return Number.isFinite(face.value) ? String(face.value) : null;
		}

		return null;
	}

	initialCandidateScoringForPart({ root, part }) {
		const defaults = root?.defaults?.optionalPartAssignment?.initialCandidateScoring || {};
		const override = part.sourceSearch?.initialCandidateScoring || {};

		return {
			...defaults,
			...override,
			locationPreference: {
				...(defaults.locationPreference || {}),
				...(override.locationPreference || {}),
			},
			sizePreference: {
				...(defaults.sizePreference || {}),
				...(override.sizePreference || {}),
			},
		};
	}

	/**
	 * Applies bulk source-search settings to an optional-part spec.
	 *
	 * @param {OptionalPartSourceSpec} spec - Default optional-part source-search spec.
	 * @param {OptionalPartFaceDescription} face - Face description used for family lookup.
	 * @param {string} metadataKey - Bulk option key for the spec.
	 * @param {OptionalPartBulkOptions | null} bulkOptions - Optional bulk source-search settings.
	 * @returns {OptionalPartSourceSpec} Spec with bulk settings applied.
	 */
	applyBulkOption(spec, face, metadataKey, bulkOptions) {
		const option = this.bulkOptionForFace(face, metadataKey, bulkOptions);

		if (!option) {
			return spec;
		}
		const region = this.validRegion(option.region) || spec.region;

		return {
			...spec,
			searchSource: option.searchSource !== false,
			region,
			targetPoint: this.regionTarget(region),
		};
	}

	/**
	 * Looks up bulk source-search settings for a face family and metadata key.
	 *
	 * @param {OptionalPartFaceDescription} face - Face description used for family lookup.
	 * @param {string} metadataKey - Bulk option key for the spec.
	 * @param {OptionalPartBulkOptions | null} bulkOptions - Optional bulk source-search settings.
	 * @returns {OptionalPartBulkChoice | null} Matching bulk option, if present.
	 */
	bulkOptionForFace(face, metadataKey, bulkOptions) {
		const families = bulkOptions?.families || bulkOptions || {};
		const faceOption = bulkOptions?.faces?.[face.faceKey]?.[metadataKey];
		if (faceOption) {
			return faceOption;
		}

		const familyKeys = this.familyOptionKeys(face.family);
		for (const familyKey of familyKeys) {
			const option = families[familyKey]?.[metadataKey];

			if (option) {
				return option;
			}
		}

		return null;
	}

	/**
	 * Resolves the label/character side-by-side layout for flower and season faces.
	 *
	 * @param {OptionalPartFaceDescription} face - Face description used for family lookup.
	 * @param {OptionalPartBulkOptions | null} bulkOptions - Optional bulk layout settings.
	 * @returns {OptionalPartPairLayoutRegions} Source regions for label and character candidates.
	 */
	optionalPairLayoutForFace(face, bulkOptions) {
		const layout = this.bulkLayoutForFace(face, bulkOptions);

		if (layout === 'label-left-character-right') {
			return {
				labelRegion: 'top-left',
				characterRegion: 'top-right',
			};
		}

		return {
			labelRegion: 'top-right',
			characterRegion: 'top-left',
		};
	}

	/**
	 * Reads the bulk pair layout for a face family.
	 *
	 * @param {OptionalPartFaceDescription} face - Face description used for family lookup.
	 * @param {OptionalPartBulkOptions | null} bulkOptions - Optional bulk layout settings.
	 * @returns {string} Pair layout id.
	 */
	bulkLayoutForFace(face, bulkOptions) {
		const families = bulkOptions?.families || bulkOptions || {};
		const familyKeys = this.familyOptionKeys(face.family);

		for (const familyKey of familyKeys) {
			const layout = families[familyKey]?.layout;

			if (layout) {
				return layout;
			}
		}

		return face.family === 'season'
			? 'label-left-character-right'
			: 'label-right-character-left';
	}

	/**
	 * Returns full and short bulk option keys for a family.
	 *
	 * @param {string} family - Face family id.
	 * @returns {string[]} Accepted bulk option keys.
	 */
	familyOptionKeys(family) {
		const shortByFamily = {
			bamboo: 'b',
			character: 'c',
			dot: 'd',
		};

		return [
			family,
			shortByFamily[family],
		].filter(Boolean);
	}

	/**
	 * Parses a face key into family and value fields.
	 *
	 * @param {string} faceKey - Face key such as `b-1` or `flower-1`.
	 * @returns {OptionalPartFaceDescription} Parsed face description.
	 */
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
	 * Builds individual and grouped candidate units from normalized components.
	 *
	 * @param {SourceNormalizedComponent[]} components - Normalized source components.
	 * @param {SourceBounds | null} sourceBounds - Overall source bounds used for normalized positions.
	 * @returns {OptionalPartCandidateUnit[]} Candidate units for scoring.
	 */
	makeCandidateUnits(components, sourceBounds) {
		const byParent = new Map();
		const units = components.map((component) => this.makeCandidateUnit({
			componentIds: [component.componentId],
			components: [component],
			sourceBounds,
			unitKind: 'component',
		}));

		for (const component of components) {
			if (!component.parentComponentId) {
				continue;
			}

			const parentComponents = byParent.get(component.parentComponentId) || [];
			parentComponents.push(component);
			byParent.set(component.parentComponentId, parentComponents);
		}

		for (const parentComponents of byParent.values()) {
			if (parentComponents.length < 2) {
				continue;
			}

			units.push(this.makeCandidateUnit({
				componentIds: parentComponents.map((component) => component.componentId),
				components: parentComponents,
				sourceBounds,
				unitKind: 'source-element-group',
			}));
		}

		for (const neighborGroup of this.neighborSameColorGroups(components)) {
			units.push(this.makeCandidateUnit({
				componentIds: neighborGroup.map((component) => component.componentId),
				components: neighborGroup,
				sourceBounds,
				unitKind: 'same-color-neighbor-group',
			}));
		}

		for (const colorGroup of groupAnalogComponents(components, { expandedGap: 8, groupByColor: true })) {
			if (colorGroup.components.length < 2 || !colorGroup.dominantColor) {
				continue;
			}

			units.push(this.makeCandidateUnit({
				componentIds: colorGroup.components.map((component) => component.componentId),
				components: colorGroup.components,
				sourceBounds,
				unitKind: 'same-color-source-group',
			}));
		}

		return this.dedupeCandidateUnits(units);
	}

	/**
	 * Finds small adjacent same-color groups that can represent split label/glyph strokes.
	 *
	 * @param {SourceNormalizedComponent[]} components - Normalized source components.
	 * @returns {SourceNormalizedComponent[][]} Tight two-component groups.
	 */
	neighborSameColorGroups(components) {
		const groups = [];

		for (let leftIndex = 0; leftIndex < components.length; leftIndex += 1) {
			for (let rightIndex = leftIndex + 1; rightIndex < components.length; rightIndex += 1) {
				const left = components[leftIndex];
				const right = components[rightIndex];

				if (!this.sameVisibleFill(left, right) || !this.boundsLookLikeGlyphNeighbors(left.bounds, right.bounds)) {
					continue;
				}

				groups.push([left, right].sort((a, b) => (a.sourceIndex ?? 0) - (b.sourceIndex ?? 0)));
			}
		}

		return groups;
	}

	sameVisibleFill(left, right) {
		return Boolean(left?.fill && right?.fill && left.fill === right.fill && left.fill !== 'none');
	}

	boundsLookLikeGlyphNeighbors(leftBounds, rightBounds) {
		if (!leftBounds || !rightBounds) {
			return false;
		}

		const horizontalGap = Math.max(0, Math.max(leftBounds.left, rightBounds.left) - Math.min(leftBounds.right, rightBounds.right));
		const verticalGap = Math.max(0, Math.max(leftBounds.top, rightBounds.top) - Math.min(leftBounds.bottom, rightBounds.bottom));
		const verticalOverlap = Math.min(leftBounds.bottom, rightBounds.bottom) - Math.max(leftBounds.top, rightBounds.top);
		const minHeight = Math.max(1, Math.min(leftBounds.height, rightBounds.height));
		const heightRatio = Math.min(leftBounds.height, rightBounds.height) / Math.max(leftBounds.height, rightBounds.height, 1);
		const yCenterDistance = Math.abs(
			(leftBounds.top + (leftBounds.height / 2)) - (rightBounds.top + (rightBounds.height / 2)),
		);

		return horizontalGap <= 4
			&& verticalGap <= 2
			&& verticalOverlap / minHeight >= 0.45
			&& heightRatio >= 0.55
			&& yCenterDistance <= Math.max(leftBounds.height, rightBounds.height) * 0.45;
	}

	/**
	 * Creates one candidate unit from one or more normalized components.
	 *
	 * @param {OptionalPartMakeCandidateUnitOptions} options - Candidate unit construction context.
	 * @returns {OptionalPartCandidateUnit} Candidate unit with bounds and normalized position.
	 */
	makeCandidateUnit({ componentIds, components, sourceBounds, unitKind }) {
		const bounds = getComponentUnionBounds(components);
		const center = {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		};
		const normalizedCenter = this.normalizePoint(center, sourceBounds);
		const sourceIndexes = components.map((component) => component.sourceIndex ?? component.sourceElementIndex ?? 0);
		const labelOcr = this.bestUnitLabelOcr(components, componentIds);

		return {
			unitKind,
			componentIds,
			bounds,
			center,
			normalizedCenter,
			sourceOrder: Math.min(...sourceIndexes),
			componentCount: components.length,
			componentLevel: components.length > 1 ? 'group' : components[0].componentLevel,
			textComponent: components.some((component) => Boolean(component.fontFamily || component.fontPath || component.fontSize)),
			textValues: [...new Set(components.map((component) => component.textValue).filter(Boolean))],
			labelOcr,
			classNames: [...new Set(components.map((component) => component.className).filter(Boolean))],
			fills: [...new Set(components.map((component) => component.fill).filter(Boolean))],
			areaRatio: bounds.area / Math.max(1, sourceBounds?.area || 1),
			widthRatioToSourceWidth: bounds.width / Math.max(1, sourceBounds?.width || 1),
			heightRatioToSourceWidth: bounds.height / Math.max(1, sourceBounds?.width || 1),
			maxDimensionRatioToSourceWidth: Math.max(bounds.width, bounds.height) / Math.max(1, sourceBounds?.width || 1),
		};
	}

	/**
	 * Removes duplicate candidate units with the same component id set.
	 *
	 * @param {OptionalPartCandidateUnit[]} units - Candidate units to dedupe.
	 * @returns {OptionalPartCandidateUnit[]} Unique candidate units.
	 */
	dedupeCandidateUnits(units) {
		const seen = new Set();
		const unique = [];

		for (const unit of units) {
			const key = [...unit.componentIds].sort().join('|');

			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			unique.push(unit);
		}

		return unique;
	}

	manualAssignmentsForFace(faceKey, manualAssignments) {
		const faces = manualAssignments?.faces || {};
		const faceAssignments = faces?.[faceKey] || {};

		if (!faceAssignments || typeof faceAssignments !== 'object' || Array.isArray(faceAssignments)) {
			return {};
		}

		return Object.fromEntries(Object.entries(faceAssignments)
			.map(([partId, componentIds]) => [
				partId,
				[...new Set(Array.isArray(componentIds) ? componentIds : [])].filter(Boolean),
			])
			.filter(([, componentIds]) => componentIds.length > 0));
	}

	manualCandidateForSpec(componentIds, sourceComponents, sourceBounds) {
		if (!componentIds.length) {
			return null;
		}

		const componentById = new Map(sourceComponents.map((component) => [component.componentId, component]));
		const components = componentIds.map((componentId) => componentById.get(componentId)).filter(Boolean);

		if (components.length === 0) {
			return null;
		}

		const unit = this.makeCandidateUnit({
			componentIds: components.map((component) => component.componentId),
			components,
			sourceBounds,
			unitKind: 'manual-source-selection',
		});

		return {
			...unit,
			score: 1,
			strength: 'strong',
			reviewStatus: 'reviewed',
			scores: {
				manual: 1,
			},
			reasons: ['manual-ui-selection'],
		};
	}

	/**
	 * Scores and ranks candidate units for one optional-part spec.
	 *
	 * @param {OptionalPartCandidateUnit[]} units - Candidate units to score.
	 * @param {OptionalPartSourceSpec} spec - Optional-part source-search spec to match.
	 * @returns {OptionalPartScoredCandidate[]} Ranked scored candidates.
	 */
	scoreCandidatesForSpec(units, spec) {
		const maxSourceOrder = Math.max(1, ...units.map((unit) => unit.sourceOrder));

		return units
			.map((unit) => this.scoreCandidate(unit, spec, maxSourceOrder))
			.sort((left, right) => right.score - left.score
				|| left.sourceOrder - right.sourceOrder
				|| left.bounds.area - right.bounds.area);
	}

	/**
	 * Scores one candidate against an optional-part spec.
	 *
	 * @param {OptionalPartCandidateUnit} unit - Candidate unit to score.
	 * @param {OptionalPartSourceSpec} spec - Optional-part source-search spec to match.
	 * @param {number} maxSourceOrder - Largest source order in the candidate set.
	 * @returns {OptionalPartScoredCandidate} Scored candidate with reasons.
	 */
	scoreCandidate(unit, spec, maxSourceOrder) {
		const reasons = [];
		const locationNeutral = spec.region === 'no-preference';
		const distance = this.distanceToRegion(unit.normalizedCenter, spec.region, spec.targetPoint);
		const regionScore = locationNeutral ? 1 : this.clamp01(1 - (distance / 0.72));
		const topScore = locationNeutral ? 1 : this.clamp01(1 - (unit.normalizedCenter.y / 0.48));
		const areaScore = this.scoreSize(unit, spec);
		const sourceOrderScore = this.clamp01(1 - (unit.sourceOrder / (maxSourceOrder + 1)));
		const groupScore = unit.unitKind === 'source-element-group'
			|| unit.unitKind === 'same-color-source-group'
			|| unit.unitKind === 'same-color-neighbor-group'
			? spec.contentKind === 'glyph' ? 0.18 : 0.08
			: 0;
		const textLabelMatch = this.unitTextMatchesExpectedLabel(unit, spec);
		const textComponentScore = textLabelMatch ? 0.35 : 0;
		const labelOcrMatch = this.unitLabelOcrMatchesExpectedLabel(unit, spec);
		const labelOcrScore = labelOcrMatch ? this.scoreLabelOcrEvidence(unit.labelOcr) : 0;
		const missingExpectedLabelEvidence = this.isMissingExpectedLabelEvidence({
			unit,
			spec,
			textLabelMatch,
			labelOcrMatch,
		});
		const candidateRegion = this.nearestRegion(unit.normalizedCenter);
		const compatibleCornerPosition = this.isCompatibleCornerRegion(spec.region, candidateRegion);
		const positionPriority = candidateRegion === spec.region ? 2 : compatibleCornerPosition ? 1 : 0;
		const positionScore = positionPriority === 2 ? 0.28 : positionPriority === 1 ? 0.24 : 0;
		const rawScore = (
			(regionScore * 0.42)
			+ (topScore * 0.18)
			+ (areaScore * 0.24)
			+ (sourceOrderScore * 0.12)
			+ groupScore
			+ positionScore
			+ textComponentScore
			+ labelOcrScore
		);
		const score = missingExpectedLabelEvidence
			? Math.min(rawScore, this.expectedLabelEvidenceMissingScoreCap())
			: rawScore;

		if (regionScore >= 0.72) {
			reasons.push(`near-${spec.region}`);
		}

		if (compatibleCornerPosition) {
			reasons.push('corner-position');
		}

		if (positionPriority === 2) {
			reasons.push(`in-${spec.region}`);
		}

		if (topScore >= 0.75) {
			reasons.push('top-band');
		}

		if (areaScore >= 0.7) {
			reasons.push('optional-part-size');
		}

		if (sourceOrderScore >= 0.65) {
			reasons.push('early-source-order');
		}

		if (textLabelMatch) {
			reasons.push('svg-text-label-match');
		}

		if (labelOcrMatch) {
			reasons.push('label-ocr-match');
		}

		if (missingExpectedLabelEvidence) {
			reasons.push('missing-expected-label-evidence');
		}

		if (unit.unitKind === 'source-element-group') {
			reasons.push('split-source-element-group');
		}

		if (unit.unitKind === 'same-color-source-group') {
			reasons.push('same-color-source-group');
		}

		if (unit.unitKind === 'same-color-neighbor-group') {
			reasons.push('same-color-neighbor-group');
		}

		return {
			componentIds: unit.componentIds,
			bounds: unit.bounds,
			normalizedCenter: unit.normalizedCenter,
			region: this.nearestRegion(unit.normalizedCenter),
			sourceOrder: unit.sourceOrder,
			componentCount: unit.componentCount,
			unitKind: unit.unitKind,
			textComponent: unit.textComponent,
			textValues: unit.textValues,
			textLabelMatch,
			labelOcr: unit.labelOcr || null,
			labelOcrMatch,
			positionPriority,
			classNames: unit.classNames,
			fills: unit.fills,
			areaRatio: Number(unit.areaRatio.toFixed(4)),
			maxDimensionRatioToSourceWidth: Number(this.candidateMaxDimensionRatio(unit).toFixed(4)),
			score: Number(score.toFixed(3)),
			scores: {
				region: Number(regionScore.toFixed(3)),
				positionPriority,
				position: Number(positionScore.toFixed(3)),
				topBand: Number(topScore.toFixed(3)),
				area: Number(areaScore.toFixed(3)),
				sourceOrder: Number(sourceOrderScore.toFixed(3)),
				group: Number(groupScore.toFixed(3)),
				textComponent: Number(textComponentScore.toFixed(3)),
				labelOcr: Number(labelOcrScore.toFixed(3)),
				missingExpectedLabelEvidence: missingExpectedLabelEvidence ? Number((rawScore - score).toFixed(3)) : 0,
			},
			reasons,
		};
	}

	isMissingExpectedLabelEvidence({ unit, spec, textLabelMatch, labelOcrMatch }) {
		return spec.contentKind === 'label'
			&& Boolean(spec.expectedLabel)
			&& !textLabelMatch
			&& !labelOcrMatch
			&& (Boolean(unit.labelOcr) || unit.unitKind === 'same-color-source-group');
	}

	expectedLabelEvidenceMissingScoreCap() {
		return 0.45;
	}

	unitTextMatchesExpectedLabel(unit, spec) {
		if (!unit.textComponent || spec.contentKind !== 'label' || !spec.expectedLabel) {
			return false;
		}

		const expected = this.normalizeLabelText(spec.expectedLabel);

		return (unit.textValues || [])
			.some((value) => this.normalizeLabelText(value) === expected);
	}

	bestUnitLabelOcr(components, unitComponentIds) {
		const unitKey = componentIdSetKey(unitComponentIds);

		return components
			.map((component) => component.labelOcr)
			.filter(Boolean)
			.filter((evidence) => componentIdSetKey(evidence.componentIds || [evidence.sourceId]) === unitKey)
			.sort((left, right) => left.pixelMeanAbsoluteError - right.pixelMeanAbsoluteError)[0] || null;
	}

	unitLabelOcrMatchesExpectedLabel(unit, spec) {
		if (spec.contentKind !== 'label' || !spec.expectedLabel || !unit.labelOcr?.match) {
			return false;
		}

		return this.normalizeLabelText(unit.labelOcr.expectedLabel) === this.normalizeLabelText(spec.expectedLabel);
	}

	scoreLabelOcrEvidence(labelOcr) {
		const mae = Number(labelOcr?.pixelMeanAbsoluteError);

		if (!Number.isFinite(mae) || mae > 0.3) {
			return 0;
		}

		return 1 + (this.clamp01((0.3 - mae) / 0.1) * 0.45);
	}

	normalizeLabelText(value) {
		return String(value || '')
			.trim()
			.toUpperCase()
			.replace(/[\s.,;:_-]+/g, '');
	}

	/**
	 * Scores whether a candidate's size fits a label or glyph.
	 *
	 * @param {OptionalPartCandidateUnit} unit - Candidate unit to score.
	 * @param {OptionalPartSourceSpec} spec - Optional-part source-search spec to match.
	 * @returns {number} Score from 0 to 1.
	 */
	scoreSize(unit, spec) {
		const preference = spec.initialCandidateScoring?.sizePreference;

		if (preference?.metric === 'max-dimension-to-source-width') {
			return this.scoreRatioBand(
				this.candidateMaxDimensionRatio(unit),
				preference.idealRatio ?? 0.25,
				preference.nearZeroBelowRatio ?? 0.1,
				preference.nearZeroAboveRatio ?? 0.4,
			);
		}

		const ideal = spec.contentKind === 'glyph' ? 0.09 : 0.04;
		const tolerance = spec.contentKind === 'glyph' ? 0.12 : 0.08;
		const distance = Math.abs(unit.areaRatio - ideal);

		return this.clamp01(1 - (distance / tolerance));
	}

	scoreRatioBand(value, ideal, nearZeroBelow, nearZeroAbove) {
		const distance = Math.abs(value - ideal);
		const tolerance = value <= ideal
			? Math.max(0.0001, ideal - nearZeroBelow)
			: Math.max(0.0001, nearZeroAbove - ideal);

		return Math.exp(-4 * ((distance / tolerance) ** 2));
	}

	candidateMaxDimensionRatio(unit) {
		if (Number.isFinite(unit.maxDimensionRatioToSourceWidth)) {
			return unit.maxDimensionRatioToSourceWidth;
		}

		if (!unit.bounds) {
			return 0;
		}

		return Math.max(unit.bounds.width || 0, unit.bounds.height || 0) / 100;
	}

	distanceToRegion(point, region, fallbackTarget) {
		return Math.min(...this.regionTargets(region, fallbackTarget)
			.map((target) => Math.hypot(point.x - target.x, point.y - target.y)));
	}

	/**
	 * Normalizes a source-space point within the supplied bounds.
	 *
	 * @param {{ x: number, y: number }} point - Source-space point.
	 * @param {SourceBounds} bounds - Source bounds used as the normalization frame.
	 * @returns {{ x: number, y: number }} Normalized point.
	 */
	normalizePoint(point, bounds) {
		return {
			x: (point.x - bounds.left) / Math.max(1, bounds.width),
			y: (point.y - bounds.top) / Math.max(1, bounds.height),
		};
	}

	/**
	 * Converts a named source region to a normalized target point.
	 *
	 * @param {string} region - Source region id.
	 * @returns {{ x: number, y: number }} Normalized target point.
	 */
	regionTarget(region) {
		return this.regionTargets(region)[0] || { x: 0.5, y: 0.5 };
	}

	regionTargets(region, fallbackTarget = null) {
		const targets = {
			'top-left': { x: 0, y: 0 },
			'top-right': { x: 1, y: 0 },
			'bottom-left': { x: 0, y: 1 },
			'bottom-right': { x: 1, y: 1 },
			'top-center': { x: 0.5, y: 0 },
			center: { x: 0.5, y: 0.5 },
			'middle-left': { x: 0, y: 0.5 },
			'middle-right': { x: 1, y: 0.5 },
			'either-corner': [{ x: 0, y: 0 }, { x: 1, y: 0 }],
			'no-preference': [{ x: 0.5, y: 0.5 }],
		};
		const target = targets[region];

		if (Array.isArray(target)) {
			return target;
		}

		return target ? [target] : [fallbackTarget || { x: 0.5, y: 0.5 }];
	}

	/**
	 * Returns a supported source-region id, if the incoming value is valid.
	 *
	 * @param {string} region - Candidate source-region id.
	 * @returns {string | null} Valid source-region id, or null.
	 */
	validRegion(region) {
		return new Set([
			'top-left',
			'top-center',
			'top-right',
			'middle-left',
			'center',
			'middle-right',
			'bottom-left',
			'bottom-right',
			'either-corner',
			'no-preference',
		]).has(region) ? region : null;
	}

	/**
	 * Returns whether a named source region is one of the source corners.
	 *
	 * @param {string} region - Source region id.
	 * @returns {boolean} True when the region is a corner.
	 */
	isCornerRegion(region) {
		return new Set([
			'top-left',
			'top-right',
			'bottom-left',
			'bottom-right',
		]).has(region);
	}

	/**
	 * Returns whether a candidate region is a corner compatible with a hint.
	 *
	 * @param {string} expectedRegion - Expected source region id.
	 * @param {string} candidateRegion - Candidate source region id.
	 * @returns {boolean} True when the candidate is a compatible corner.
	 */
	isCompatibleCornerRegion(expectedRegion, candidateRegion) {
		if (!this.isCornerRegion(candidateRegion)) {
			return false;
		}

		if (expectedRegion === 'either-corner') {
			return candidateRegion === 'top-left' || candidateRegion === 'top-right';
		}

		if (expectedRegion === 'no-preference') {
			return false;
		}

		if (this.isCornerRegion(expectedRegion)) {
			return candidateRegion === expectedRegion;
		}

		if (expectedRegion.startsWith('top-')) {
			return candidateRegion.startsWith('top-');
		}

		if (expectedRegion.startsWith('bottom-')) {
			return candidateRegion.startsWith('bottom-');
		}

		return this.isCornerRegion(expectedRegion);
	}

	/**
	 * Converts an optional-part region to legacy source-corner metadata.
	 *
	 * @param {string} region - Source region id.
	 * @returns {string | null} Legacy source corner id, if applicable.
	 */
	regionToSourceCorner(region) {
		const corners = {
			'top-left': 'topLeft',
			'top-right': 'topRight',
			'bottom-left': 'bottomLeft',
			'bottom-right': 'bottomRight',
		};

		return corners[region] || null;
	}

	/**
	 * Finds the nearest named source region for a normalized point.
	 *
	 * @param {{ x: number, y: number }} point - Normalized point.
	 * @returns {string} Nearest region id.
	 */
	nearestRegion(point) {
		const entries = Object.entries({
			'top-left': { x: 0, y: 0 },
			'top-right': { x: 1, y: 0 },
			'bottom-left': { x: 0, y: 1 },
			'bottom-right': { x: 1, y: 1 },
			'top-center': { x: 0.5, y: 0 },
			'middle-left': { x: 0, y: 0.5 },
			'middle-right': { x: 1, y: 0.5 },
			'center': { x: 0.5, y: 0.5 },
		});

		return entries
			.map(([region, target]) => ({
				region,
				distance: Math.hypot(point.x - target.x, point.y - target.y),
			}))
			.sort((left, right) => left.distance - right.distance)[0].region;
	}

	/**
	 * Clamps a number into the inclusive 0..1 range.
	 *
	 * @param {number} value - Value to clamp.
	 * @returns {number} Clamped value.
	 */
	clamp01(value) {
		return Math.max(0, Math.min(1, value));
	}

	/**
	 * Resolves a model-owned face artifact pointer relative to the repository root.
	 *
	 * @param {object} pipelineModel - Active pipeline model.
	 * @param {string} faceKey - Canonical face key.
	 * @param {string} artifactKey - Artifact key to resolve.
	 * @returns {string | null} Absolute artifact path or null.
	 */
	resolveModelArtifact(pipelineModel, faceKey, artifactKey) {
		const rawPath = artifactKey === 'normalizedComponents'
			? pipelineModel.getNormalizedComponentsPath(faceKey)
			: null;

		if (!rawPath) {
			return null;
		}

		return this.path.isAbsolute(rawPath)
			? rawPath
			: this.path.resolve(this.rootDir, rawPath);
	}

	/**
	 * Reads and parses a UTF-8 JSON file.
	 *
	 * @param {string} filePath - JSON file path.
	 * @returns {Promise<unknown>} Parsed JSON value.
	 */
	async readJson(filePath) {
		return JSON.parse(await this.fs.readFile(filePath, 'utf8'));
	}

	/**
	 * Checks whether a path exists.
	 *
	 * @param {string} filePath - Path to check.
	 * @returns {Promise<boolean>} True when the path is accessible.
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
	 * Converts a path to a repository-relative slash-separated path.
	 *
	 * @param {string} filePath - Path to normalize.
	 * @returns {string} Repository-relative path.
	 */
	normalizePath(filePath) {
		return this.path.relative(this.rootDir, filePath).replaceAll('\\', '/');
	}
}

function sameComponentIdSet(left = [], right = []) {
	if (left.length !== right.length) {
		return false;
	}

	const rightIds = new Set(right);
	return left.every((componentId) => rightIds.has(componentId));
}

function isProperComponentSuperset(left = [], right = []) {
	if (left.length <= right.length) {
		return false;
	}

	const leftIds = new Set(left);
	return right.every((componentId) => leftIds.has(componentId));
}

function componentIdSetKey(componentIds = []) {
	return [...componentIds].sort().join('|');
}
