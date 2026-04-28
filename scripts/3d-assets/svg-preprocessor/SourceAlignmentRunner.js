import { promises as fs } from 'fs';
import path from 'path';
import { OUTPUT_3D_DIR, ROOT_DIR } from '../shared/asset-paths.js';
import { selectAnalogComponentGrouping } from './analog-component-matcher.js';
import { loadFacePreprocessingMetadata } from './face-preprocessing-metadata.js';
import { normalizePath } from './preprocessed-face-validation-utils.js';
import { DEFAULT_REFERENCE_STRUCTURE_PATH } from './reference-structure-components.js';
import {
	boundsToTransformMatrix,
	matrixToString,
	targetPixelsToViewBoxBounds,
	unionBounds,
} from './visual-component-alignment.js';

export const DEFAULT_SOURCE_ALIGNMENT_TILESET_ID = 'wiki';
const BOUNDED_PIXEL_FIT_MAX_ASPECT_CHANGE = 1.6;

/**
 * Runs Stage 4 source alignment and writes the compact model-owned handoff.
 */
export class SourceAlignmentRunner {
	/**
	 * Creates a runner with replaceable filesystem and pipeline dependencies.
	 *
	 * @param {SourceAlignmentRunnerDependencies} dependencies - Dependencies used by the alignment workflow.
	 */
	constructor({
		fileSystem = fs,
		pathModule = path,
		rootDir = ROOT_DIR,
		output3dDir = OUTPUT_3D_DIR,
		loadMetadata = loadFacePreprocessingMetadata,
		updateState = null,
		clock = () => new Date().toISOString(),
	} = {}) {
		this.fs = fileSystem;
		this.path = pathModule;
		this.rootDir = rootDir;
		this.output3dDir = output3dDir;
		this.loadMetadata = loadMetadata;
		this.updateState = updateState;
		this.clock = clock;
	}

	/**
	 * Runs source alignment for all selected reference faces.
	 *
	 * @param {SourceAlignmentRunOptions} options - Alignment options resolved by the CLI or tests.
	 * @returns {Promise<SourceAlignmentSummary>} Summary of model updates and in-memory diagnostics.
	 */
	async run(options = {}) {
		const tilesetId = options.tilesetId || DEFAULT_SOURCE_ALIGNMENT_TILESET_ID;
		const requestedFaceKey = options.faceKey || null;
		const pipelineModel = options.pipelineModel;

		if (!pipelineModel) {
			throw new Error('SourceAlignmentRunner requires a PipelineModel.');
		}

		const referenceStructurePath = pipelineModel.referenceFile || this.path.resolve(
			this.rootDir,
			options.referenceStructurePath || DEFAULT_REFERENCE_STRUCTURE_PATH,
		);
		const metadataPath = options.metadataPath || null;
		const faceMetadata = this.loadMetadata(metadataPath);
		const referenceStructure = pipelineModel.reference || await this.readJson(referenceStructurePath);
		const generatedOn = this.clock();
		const faceKeys = Object.keys(referenceStructure.faces || {})
			.filter((faceKey) => pipelineModel.hasFace(faceKey))
			.filter((faceKey) => !requestedFaceKey || faceKey === requestedFaceKey)
			.sort((left, right) => left.localeCompare(right));
		const report = this.createReport({
			tilesetId,
			referenceStructure,
			referenceStructurePath,
			generatedOn,
			requestedFaceKey,
			faceKeys,
		});

		for (const faceKey of faceKeys) {
			await this.processFace({
				tilesetId,
				faceKey,
				generatedOn,
				referenceStructure,
				referenceStructurePath,
				pipelineModel,
				report,
				faceMetadata: faceMetadata[faceKey] || null,
			});
		}

		await pipelineModel.save();

		return {
			tilesetId,
			faceCount: report.faceCount,
			faceKey: requestedFaceKey,
			alignmentGroupCount: report.alignmentGroupCount,
			candidateCount: report.candidateCount,
			warningCount: report.warnings.length,
		};
	}

	/**
	 * Creates the report shell accumulated during a run.
	 *
	 * @param {SourceAlignmentCreateReportOptions} options - Report identity and selected face fields.
	 * @returns {SourceAlignmentReport} Empty report for the run.
	 */
	createReport({
		tilesetId,
		referenceStructure,
		referenceStructurePath,
		generatedOn,
		requestedFaceKey,
		faceKeys,
	}) {
		return {
			schemaVersion: 1,
			tilesetId,
			referenceSetId: referenceStructure.referenceSet?.referenceSetId || null,
			generatedOn,
			referenceStructurePath: this.normalizePath(referenceStructurePath),
			faceKey: requestedFaceKey,
			faceCount: faceKeys.length,
			alignmentGroupCount: 0,
			candidateCount: 0,
			faces: {},
			warnings: [],
		};
	}

	/**
	 * Processes one reference face and updates compact model alignment state.
	 *
	 * @param {SourceAlignmentProcessFaceOptions} options - Per-face processing context.
	 * @returns {Promise<void>}
	 */
	async processFace({
		tilesetId,
		faceKey,
		generatedOn,
		referenceStructure,
		referenceStructurePath,
		pipelineModel,
		report,
		faceMetadata,
	}) {
		const faceState = pipelineModel.getFace(faceKey);
		const normalizedPath = this.resolveArtifactPath(pipelineModel.getNormalizedComponentsPath(faceKey));
		const referenceFace = referenceStructure.faces[faceKey];

		if (!faceState?.state || typeof faceState.state !== 'object' || Array.isArray(faceState.state)) {
			throw new Error(`Source Alignment requires canonical inline face state for ${faceKey}. Regenerate the model-owned pipeline state through intake.`);
		}

		if (!normalizedPath || !(await this.exists(normalizedPath))) {
			report.warnings.push({
				code: 'missing-normalized-components',
				faceKey,
				path: normalizedPath ? this.normalizePath(normalizedPath) : null,
			});
			pipelineModel.clearAlignmentMatches(faceKey);
			return;
		}

		const normalizedFace = await this.readJson(normalizedPath);
		const optionalAssignment = optionalAssignmentFromCanonicalState({
			tilesetId,
			faceKey,
			faceState,
			generatedOn,
		});
		const alignmentMap = alignFace({
			tilesetId,
			faceKey,
			generatedOn,
			referenceStructure,
			referenceFace,
			referenceStructurePath,
			normalizedFace,
			normalizedPath,
			optionalAssignment,
			optionalAssignmentPath: pipelineModel.pipelineFilename
				? this.normalizePath(pipelineModel.pipelineFilename)
				: null,
			semanticMap: semanticContextFromCanonicalState(faceState.state),
			semanticMapPath: pipelineModel.pipelineFilename
				? this.normalizePath(pipelineModel.pipelineFilename)
				: null,
			canonicalParts: faceState.state.parts || {},
			faceMetadata,
		});

		pipelineModel.setAlignmentMatches(faceKey, compactAlignmentMatchesFromAlignmentMap(alignmentMap));
		pipelineModel.applyAlignmentPlacement(faceKey, alignmentPlacementsFromAlignmentMap(alignmentMap));

		report.alignmentGroupCount += alignmentMap.alignmentGroups.length;
		report.candidateCount += alignmentMap.candidates.length;
		report.faces[faceKey] = {
			status: alignmentMap.status,
			alignmentGroupCount: alignmentMap.alignmentGroups.length,
			candidateCount: alignmentMap.candidates.length,
			diagnostics: alignmentMap.diagnostics,
		};
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

	resolveArtifactPath(artifactPath) {
		if (!artifactPath) {
			return null;
		}

		return this.path.isAbsolute(artifactPath)
			? artifactPath
			: this.path.resolve(this.rootDir, artifactPath);
	}

	recordStateUpdate(update) {
		if (typeof this.updateState === 'function') {
			this.updateState(update);
		}
	}
}

/**
 * Aligns one normalized source face against its reference structure face.
 *
 * @param {SourceAlignmentFaceOptions} options - Face-level alignment inputs.
 * @returns {SourceAlignmentMapArtifact} Alignment state for the face.
 */
export function alignFace({
	tilesetId,
	faceKey,
	generatedOn,
	referenceStructure,
	referenceFace,
	referenceStructurePath,
	normalizedFace,
	normalizedPath,
	optionalAssignment = null,
	optionalAssignmentPath = null,
	semanticMap = null,
	semanticMapPath = null,
	canonicalParts = {},
	faceMetadata,
}) {
	const referenceGroups = deriveReferenceAlignmentGroups(referenceFace, canonicalParts);
	const sourceComponents = makeSourceAlignmentUnits(normalizedFace);
	const candidates = [];
	const diagnostics = [];
	const alignmentGroups = [];
	const semanticBindingContext = makeSourceSemanticBindingContext(semanticMap, sourceComponents);
	const optionalContext = makeOptionalAssignmentContext(optionalAssignment, semanticBindingContext);
	const usedSourceComponentIds = new Set();
	const usedReferenceComponentIds = new Set();

	if (!optionalAssignment) {
		diagnostics.push({
			level: 'warning',
			code: 'missing-optional-part-assignment',
			message: 'Alignment expected an optional part assignment artifact before source/reference matching.',
		});
	} else if (optionalAssignment.status && optionalAssignment.status !== 'ready') {
		diagnostics.push({
			level: 'warning',
			code: 'optional-part-assignment-not-ready',
			message: `Optional part assignment status is ${optionalAssignment.status}.`,
			status: optionalAssignment.status,
		});
	}

	for (const [groupIndex, group] of referenceGroups.entries()) {
		const alignmentGroupId = `align-group.${faceKey}.${group.groupId}`;
		const optionalPart = optionalPartForGroup(group, optionalContext);
		const referenceComponents = group.referenceComponentIds
			.map((componentId) => referenceFace.components.find((component) => component.componentId === componentId))
			.filter(Boolean)
			.map(referenceComponentForMatcher);
		const groupSourceComponents = selectSourceComponentsForReferenceGroup({
			group,
			sourceComponents: sourceComponents.filter((component) => (
				!sourceUnitComponentIds(component).some((componentId) => usedSourceComponentIds.has(componentId))
			)),
			referenceComponents,
			sourceBounds: normalizedFace.alignmentBounds,
			faceMetadata,
			optionalContext,
			semanticBindingContext,
		});
		const groupDiagnostics = [];

		if (shouldUseTemporaryGeneratedAlignment(group, groupSourceComponents, semanticBindingContext)) {
			const temporaryCandidate = makeTemporaryGeneratedAlignmentCandidate({
				faceKey,
				group,
				groupIndex,
				alignmentGroupId,
				referenceComponents,
				reason: temporaryGeneratedAlignmentReason(group, semanticBindingContext),
			});

			candidates.push(temporaryCandidate);
			alignmentGroups.push(makeTemporaryGeneratedAlignmentGroup({
				alignmentGroupId,
				group,
				referenceComponents,
				sourceComponents: [],
				alignmentIds: [temporaryCandidate.alignmentId],
				reason: temporaryGeneratedAlignmentReason(group, semanticBindingContext),
			}));
			continue;
		}

		if (referenceComponents.length === 0) {
			groupDiagnostics.push({
				level: 'warning',
				code: 'empty-reference-group',
				message: `Reference alignment group ${group.groupId} has no bound reference components.`,
			});
		}

		if (groupSourceComponents.length === 0) {
			groupDiagnostics.push({
				level: 'warning',
				code: 'empty-source-group',
				message: `No source alignment components were selected for ${group.groupId}.`,
			});
		}

		let grouping = null;
		let groupCandidateIds = [];

		if (referenceComponents.length > 0 && groupSourceComponents.length > 0) {
			grouping = shouldUseFreeformArtworkGrouping(group)
				? makeFreeformArtworkGrouping(groupSourceComponents, referenceComponents)
				: selectAnalogComponentGrouping(groupSourceComponents, referenceComponents, {
					groupByColor: shouldUseColorGrouping(group),
					colorHuePartCompletion: shouldUseColorHuePartCompletion(group),
					allowReferenceRegroup: shouldAllowReferenceRegroup(group),
					allowSameColorMerge: shouldAllowSameColorMerge(group),
					canJoinSourceComponents: (leftComponent, rightComponent) => (
						canJoinSourceComponentsByStrongBinding(leftComponent, rightComponent, semanticBindingContext)
					),
					gapCandidates: [0, 1, 2, 3, 4, 5, 8, 12],
				});

			const alignmentFits = selectAlignmentFitsForGroup({
				group,
				matches: grouping.matchResult.matches,
				referenceFace,
				referenceStructure,
			});

			groupCandidateIds = grouping.matchResult.matches.map((match, matchIndex) => {
				const candidate = makeAlignmentCandidate({
					faceKey,
					group,
					groupIndex,
					match,
					matchIndex,
					matches: grouping.matchResult.matches,
					grouping,
					referenceFace,
					referenceStructure,
					optionalPart,
					fit: alignmentFits[matchIndex],
				});

				candidates.push(candidate);
				candidate.sourceComponentIds.forEach((componentId) => usedSourceComponentIds.add(componentId));
				candidate.referenceComponentIds.forEach((componentId) => usedReferenceComponentIds.add(componentId));
				return candidate.alignmentId;
			});

			if (grouping.matchResult.message) {
				groupDiagnostics.push({
					level: isMatchedStatus(grouping.matchResult.status) ? 'info' : 'warning',
					code: grouping.matchResult.status,
					message: grouping.matchResult.message,
				});
			}
		}

		alignmentGroups.push({
			alignmentGroupId,
			groupId: group.groupId,
			role: group.role,
			contentKind: group.contentKind,
			referencePartIds: group.referencePartIds,
			referenceComponentIds: group.referenceComponentIds,
			sourceComponentIds: uniqueValues(groupCandidateIds
				.map((alignmentId) => candidates.find((candidate) => candidate.alignmentId === alignmentId))
				.filter(Boolean)
				.flatMap((candidate) => candidate.sourceComponentIds || [])),
			sourceComponentCount: uniqueValues(groupCandidateIds
				.map((alignmentId) => candidates.find((candidate) => candidate.alignmentId === alignmentId))
				.filter(Boolean)
				.flatMap((candidate) => candidate.sourceComponentIds || [])).length,
			referenceComponentCount: referenceComponents.length,
			alignmentIds: groupCandidateIds,
			strategy: grouping?.strategy || 'not-run',
			matchStatus: grouping?.matchResult?.status || 'not-run',
			score: grouping ? round(grouping.score) : null,
			scoreKind: grouping ? 'penalty-lower-is-better' : null,
			identityResolver: identityResolverForGroup(group),
			reviewStatus: groupDiagnostics.some((diagnostic) => diagnostic.level === 'warning')
				? 'needs-review'
				: optionalPart?.reviewStatus || 'inferred',
			strength: optionalPart?.strength || null,
			diagnostics: groupDiagnostics,
		});
		diagnostics.push(...groupDiagnostics.map((diagnostic) => ({
			...diagnostic,
			alignmentGroupId,
		})));
	}

	addUnmatchedDiagnostics({
		diagnostics,
		alignmentGroups,
		candidates,
		sourceComponents,
		usedSourceComponentIds,
		usedReferenceComponentIds,
	});

	return {
		schemaVersion: 1,
		tilesetId,
		faceKey,
		referenceSetId: referenceStructure.referenceSet?.referenceSetId || null,
		generatedOn,
		status: diagnostics.some((diagnostic) => diagnostic.level === 'warning')
			? 'needs-review'
			: 'inferred',
		inputs: {
			referenceStructure: {
				path: normalizePath(referenceStructurePath),
				status: referenceStructure.lifecycle?.status || referenceStructure.status || null,
				generatedOn: referenceStructure.lifecycle?.generatedOn || referenceStructure.generatedOn || null,
				updatedOn: referenceStructure.lifecycle?.updatedOn || null,
			},
			normalizedComponents: {
				path: normalizePath(normalizedPath),
				status: normalizedFace.status || null,
				generatedOn: normalizedFace.generatedOn || null,
				sourceSvg: normalizedFace.sourceFile || null,
			},
			optionalPartAssignment: optionalAssignment
				? {
					path: optionalAssignmentPath ? normalizePath(optionalAssignmentPath) : null,
					status: optionalAssignment.status || null,
					generatedOn: optionalAssignment.generatedOn || null,
				}
				: null,
			sourceSemanticAssignment: semanticMap
				? {
					path: semanticMapPath ? normalizePath(semanticMapPath) : null,
					status: semanticMap.status || semanticMap.reviewStatus || null,
					acceptedOn: semanticMap.acceptedOn || null,
					updatedOn: semanticMap.updatedOn || null,
				}
				: null,
		},
		coordinateSpace: {
			sourceViewBox: normalizedFace.viewBox || null,
			preparedViewBox: referenceStructure.referenceSet?.coordinateSpace?.preparedViewBox || [0, 0, 94, 136],
		},
		sourcePartMappings: makeSourcePartMappings(alignmentGroups, candidates),
		alignmentGroups,
		candidates,
		diagnostics,
	};
}

function makeSourcePartMappings(alignmentGroups, candidates) {
	const candidatesById = new Map(candidates.map((candidate) => [candidate.alignmentId, candidate]));

	return alignmentGroups.flatMap((group) => {
		const groupCandidates = (group.alignmentIds || [])
			.map((alignmentId) => candidatesById.get(alignmentId))
			.filter(Boolean);

		if (groupCandidates.length > 0) {
			return groupCandidates.map((candidate, index) => sourcePartMappingFromCandidate(group, candidate, index));
		}

		return [sourcePartMappingFromGroup(group)];
	});
}

function semanticContextFromCanonicalState(faceState) {
	const parts = Object.fromEntries(Object.entries(faceState?.parts || {})
		.map(([partId, part]) => [partId, semanticPartStateFromCanonicalPart(part)]));

	return {
		status: 'accepted',
		reviewStatus: 'accepted',
		bindings: faceState?.bindings || {},
		parts,
	};
}

function optionalAssignmentFromCanonicalState({ tilesetId, faceKey, faceState, generatedOn }) {
	const parts = Object.fromEntries(Object.entries(faceState?.state?.parts || {})
		.filter(([, part]) => part?.optional === true)
		.map(([partId, part]) => {
			const sourceState = optionalSourceStateFromCanonicalState(faceState, partId, part);

			return [partId, {
				partId,
				contentKind: part.contentKind || null,
				role: part.role || null,
				sourceState,
				hint: part.hint || null,
				suggestedComponentIds: [],
				suggestedBounds: null,
				strength: strongestCanonicalStrengthForPart(faceState, partId) || 'none',
				reviewStatus: optionalReviewStatusFromCanonicalPart(part, sourceState),
				candidates: [],
			}];
		}));

	return {
		schemaVersion: 1,
		tilesetId,
		faceKey,
		generatedOn,
		status: 'canonical',
		face: describeFace(faceKey),
		optionalParts: parts,
		diagnostics: [],
	};
}

function isOptionalPartForFace(faceKey, partId) {
	if (partId === 'label') {
		return true;
	}

	return partId === 'glyph' && ['flower', 'season'].includes(describeFace(faceKey).family);
}

function optionalSourceStateFromCanonicalState(faceState, partId, part) {
	if (hasCanonicalBindingForPart(faceState, partId)) {
		return 'candidate-found';
	}

	return part?.accepted
		? 'source-absent'
		: 'needs-review';
}

function hasCanonicalBindingForPart(faceState, partId) {
	return Object.values(faceState?.state?.bindings || {})
		.some((binding) => binding?.partId === partId && isMeaningfulCanonicalStrength(binding.strength))
}

function optionalReviewStatusFromCanonicalPart(part, sourceState) {
	if (part?.accepted) {
		return 'accepted';
	}

	return sourceState === 'candidate-found'
		? 'inferred'
		: 'needs-review';
}

function strongestCanonicalStrengthForPart(faceState, partId) {
	const strengths = Object.values(faceState?.state?.bindings || {})
		.filter((binding) => binding?.partId === partId && isMeaningfulCanonicalStrength(binding.strength))
		.map((binding) => binding.strength);

	if (strengths.includes('accepted')) {
		return 'accepted';
	}
	if (strengths.includes('strong')) {
		return 'strong';
	}
	return strengths.includes('tentative') ? 'tentative' : null;
}

function isMeaningfulCanonicalStrength(strength) {
	return strength === 'tentative' || strength === 'strong' || strength === 'accepted';
}

function describeFace(faceKey) {
	const match = /^([a-z-]+?)(?:-(\d+|[a-z]))?$/.exec(faceKey);
	return {
		faceKey,
		family: match?.[1] || faceKey,
		index: match?.[2] || null,
	};
}

function semanticPartStateFromCanonicalPart(part) {
	if (['accepted', 'reviewed'].includes(part?.reviewStatus)) {
		return {
			state: 'unbound',
			strength: 'none',
			reviewStatus: part.reviewStatus,
		};
	}

	return { state: 'unknown' };
}

function compactAlignmentMatchesFromAlignmentMap(alignmentMap) {
	const candidatesById = new Map((alignmentMap.candidates || [])
		.map((candidate) => [candidate.alignmentId, candidate]));
	const matchesById = new Map();

	for (const mapping of alignmentMap.sourcePartMappings || []) {
		if (mapping.temporary || mapping.matchStatus === 'not-run') {
			continue;
		}
		const referencePartIds = uniqueValues(mapping.referencePartIds || []);
		if (referencePartIds.length !== 1 || !mapping.alignmentCandidateId) {
			continue;
		}

		const candidate = candidatesById.get(mapping.alignmentCandidateId);
		const source = uniqueValues(mapping.sourceComponentIds || candidate?.sourceComponentIds || []);
		const reference = uniqueValues(mapping.referenceComponentIds || candidate?.referenceComponentIds || []);

		if (source.length === 0 || reference.length === 0) {
			continue;
		}

		matchesById.set(mapping.alignmentCandidateId, {
			id: mapping.alignmentCandidateId,
			source,
			reference,
			...(cleanRendererTransform(candidate?.transform) ? { transform: cleanRendererTransform(candidate.transform) } : {}),
			...(candidate?.sourceBounds ? { sourceBounds: candidate.sourceBounds } : {}),
			...(candidate?.targetBounds || mapping.targetBounds ? { targetBounds: candidate?.targetBounds || mapping.targetBounds } : {}),
			...(candidate?.alignedBounds || mapping.alignedBounds ? { alignedBounds: candidate?.alignedBounds || mapping.alignedBounds } : {}),
		});
	}

	return [...matchesById.values()];
}

function alignmentPlacementsFromAlignmentMap(alignmentMap) {
	const candidatesById = new Map((alignmentMap.candidates || [])
		.map((candidate) => [candidate.alignmentId, candidate]));
	const alignmentsByPartId = new Map();

	for (const mapping of alignmentMap.sourcePartMappings || []) {
		if (mapping.temporary || mapping.matchStatus === 'not-run') {
			continue;
		}
		const referencePartIds = uniqueValues(mapping.referencePartIds || []);
		if (referencePartIds.length !== 1) {
			continue;
		}
		const candidate = candidatesById.get(mapping.alignmentCandidateId);
		const current = alignmentsByPartId.get(referencePartIds[0]) || [];
		current.push({
			sourceBounds: candidate?.sourceBounds || null,
			targetBounds: candidate?.targetBounds || mapping.targetBounds || null,
			alignedBounds: candidate?.alignedBounds || mapping.alignedBounds || null,
			transform: candidate?.transform || null,
		});
		alignmentsByPartId.set(referencePartIds[0], current);
	}

	return Object.fromEntries([...alignmentsByPartId.entries()]
		.map(([partId, alignments]) => [partId, finalPartAlignmentFields(alignments)]));
}

function finalPartAlignmentFields(alignments) {
	const sourceBounds = unionBoundsOrNull(alignments.map((alignment) => alignment.sourceBounds));
	const targetBounds = unionBoundsOrNull(alignments.map((alignment) => alignment.targetBounds));
	const alignedBounds = unionBoundsOrNull(alignments.map((alignment) => alignment.alignedBounds));
	const transform = finalPartAlignmentTransform(alignments, sourceBounds, targetBounds);

	return {
		sourceBounds,
		targetBounds,
		alignedBounds,
		transform,
	};
}

function finalPartAlignmentTransform(alignments, sourceBounds, targetBounds) {
	const transforms = alignments
		.map((alignment) => alignment.transform)
		.filter((transform) => transform?.matrix);

	if (transforms.length === 1) {
		return cleanRendererTransform(transforms[0]);
	}

	if (!sourceBounds || !targetBounds) {
		return null;
	}

	const scale = Math.min(
		targetBounds.width / Math.max(1, sourceBounds.width),
		targetBounds.height / Math.max(1, sourceBounds.height),
	);
	const transform = centeredScaleTransform(sourceBounds, targetBounds, scale);

	return {
		matrix: [transform.a, transform.b, transform.c, transform.d, transform.e, transform.f].map(round),
	};
}

function cleanRendererTransform(transform) {
	return transform?.matrix ? { matrix: transform.matrix.map(round) } : null;
}

function unionBoundsOrNull(boundsList) {
	const bounds = boundsList.filter(Boolean);

	return bounds.length > 0 ? unionBounds(bounds) : null;
}

function sourcePartMappingFromCandidate(group, candidate, index) {
	const referencePartIds = uniqueValues(candidate.referencePartCandidates || group.referencePartIds || []);
	const sourcePartId = sourcePartIdForMapping(group, referencePartIds, index);

	return {
		mappingId: `source-part-map.${candidate.alignmentId}`,
		sourcePartId,
		role: group.role,
		contentKind: group.contentKind,
		colorStrategy: group.colorStrategy || null,
		sourceComponentIds: candidate.sourceComponentIds || [],
		referencePartIds,
		referenceComponentIds: candidate.referenceComponentIds || [],
		alignmentGroupId: group.alignmentGroupId,
		alignmentIds: [candidate.alignmentId],
		alignmentCandidateId: candidate.alignmentId,
		matchStatus: candidate.matchStatus,
		strategy: candidate.strategy,
		score: candidate.score,
		scoreKind: candidate.scoreKind,
		identityResolver: candidate.identityResolver,
		reviewStatus: candidate.reviewStatus,
		strength: candidate.strength || null,
		provenance: candidate.provenance || 'alignment-candidate',
		targetBounds: candidate.targetBounds || null,
		alignedBounds: candidate.alignedBounds || null,
		...(candidate.temporary
			? {
				temporary: true,
				temporaryComponentPolicy: candidate.temporaryComponentPolicy || null,
				skipReason: candidate.skipReason || null,
			}
			: {}),
	};
}

function sourcePartMappingFromGroup(group) {
	return {
		mappingId: `source-part-map.${group.alignmentGroupId}`,
		sourcePartId: group.groupId,
		role: group.role,
		contentKind: group.contentKind,
		colorStrategy: group.colorStrategy || null,
		sourceComponentIds: group.sourceComponentIds || [],
		referencePartIds: group.referencePartIds || [],
		referenceComponentIds: group.referenceComponentIds || [],
		alignmentGroupId: group.alignmentGroupId,
		alignmentIds: group.alignmentIds || [],
		alignmentCandidateId: null,
		matchStatus: group.matchStatus,
		strategy: group.strategy,
		score: group.score,
		scoreKind: group.scoreKind,
		identityResolver: group.identityResolver,
		reviewStatus: group.reviewStatus,
		strength: group.strength || null,
		provenance: 'alignment-group',
	};
}

function sourcePartIdForMapping(group, referencePartIds, index) {
	if (referencePartIds.length === 1) {
		return referencePartIds[0];
	}

	if (referencePartIds.length > 1) {
		return `${group.groupId}.${index + 1}`;
	}

	return group.groupId;
}

function deriveReferenceAlignmentGroups(referenceFace, canonicalParts = {}) {
	const parts = referenceFace.parts || {};
	const grouped = new Map();

	for (const [partId, part] of Object.entries(parts)) {
		const canonicalPart = canonicalParts[partId] || {};
		const groupId = alignmentGroupIdForPart(partId, part);
		const current = grouped.get(groupId) || {
			groupId,
			role: part.role,
			contentKind: part.contentKind,
			colorStrategy: canonicalPart.colorStrategy || part.colorStrategy || null,
			referencePartIds: [],
			referenceComponentIds: [],
			targetBounds: null,
		};

		current.referencePartIds.push(partId);
		current.referenceComponentIds.push(...(part.componentIds || []));
		current.targetBounds = unionBounds([current.targetBounds, part.targetBounds].filter(Boolean));
		grouped.set(groupId, current);
	}

	return [...grouped.values()]
		.map((group) => ({
			...group,
			referencePartIds: uniqueValues(group.referencePartIds),
			referenceComponentIds: uniqueValues(group.referenceComponentIds),
		}))
		.sort((left, right) => alignmentGroupPriority(left) - alignmentGroupPriority(right));
}

function alignmentGroupPriority(group) {
	if (group.contentKind === 'label') {
		return 10;
	}

	if (group.contentKind === 'glyph' && group.role !== 'character-body') {
		return 20;
	}

	if (group.role === 'character-body') {
		return 30;
	}

	if (group.contentKind === 'artwork') {
		return 40;
	}

	return 50;
}

function alignmentGroupIdForPart(partId, part) {
	if (partId.includes('.')) {
		return partId.split('.')[0];
	}

	if (part.role === 'dot') {
		return 'dot';
	}

	if (part.role === 'bamboo-stick' || part.role === 'bamboo-group') {
		return 'bamboo';
	}

	return partId;
}

function shouldSkipSourceAlignment(group, sourceComponents) {
	return group.contentKind === 'label' && sourceComponents.length === 0;
}

function isOptionalGeneratedGroup(group) {
	return group.role === 'flower-character' || group.role === 'season-character';
}

function shouldUseTemporaryGeneratedAlignment(group, sourceComponents, semanticBindingContext) {
	if (sourceComponents.length > 0) {
		return false;
	}

	return isGeneratedReferencePartGroup(group, semanticBindingContext)
		|| shouldSkipSourceAlignment(group, sourceComponents)
		|| isOptionalGeneratedGroup(group);
}

function temporaryGeneratedAlignmentReason(group, semanticBindingContext) {
	if (isGeneratedReferencePartGroup(group, semanticBindingContext)) {
		return 'semantic-generated-reference-placement';
	}

	if (isOptionalGeneratedGroup(group)) {
		return 'missing-source-optional-part';
	}

	if (group.contentKind === 'label') {
		return 'missing-source-optional-part';
	}

	return 'generated-output';
}

function shouldUseColorGrouping(group) {
	return true;
}

function shouldUseColorHuePartCompletion(group) {
	return group.contentKind === 'glyph';
}

function shouldAllowReferenceRegroup(group) {
	return !isRepeatedArtworkGroup(group);
}

function shouldAllowSameColorMerge(group) {
	return !isRepeatedArtworkGroup(group);
}

function isRepeatedArtworkGroup(group) {
	return group.contentKind === 'artwork'
		&& ['bamboo-stick', 'dot', 'bamboo-group'].includes(group.role);
}

function shouldUseFreeformArtworkGrouping(group) {
	return group.role === 'main-artwork' && group.referencePartIds.length === 1;
}

function makeFreeformArtworkGrouping(sourceComponents, referenceComponents) {
	const match = {
		sourceGroup: makeFreeformGroup(sourceComponents),
		referenceGroup: makeFreeformGroup(referenceComponents),
	};

	return {
		expandedGap: null,
		sourceGroups: [match.sourceGroup],
		referenceGroups: [match.referenceGroup],
		matchResult: {
			matches: [match],
			status: 'matched-freeform-artwork',
			message: null,
		},
		score: 0,
		strategy: 'freeform-artwork',
	};
}

function makeFreeformGroup(components) {
	return {
		components,
		bounds: unionBounds(components.map((component) => component.bounds || component)),
		partIds: uniqueValues(components.flatMap((component) => component.partIds || [])),
		globalPartIds: uniqueValues(components.flatMap((component) => component.globalPartIds || [])),
		semanticRoles: uniqueValues(components.flatMap((component) => component.semanticRoles || [])),
	};
}

function makeTemporaryGeneratedAlignmentCandidate({
	faceKey,
	group,
	groupIndex,
	alignmentGroupId,
	referenceComponents,
	reason,
}) {
	const targetBounds = group.targetBounds || unionBounds(referenceComponents.map((component) => component.bounds || component));
	const matrix = [1, 0, 0, 1, 0, 0];

	return {
		alignmentId: `align.${faceKey}.${String(groupIndex + 1).padStart(2, '0')}.temporary`,
		alignmentGroupId,
		sourceComponentIds: [],
		referenceComponentIds: group.referenceComponentIds,
		referencePartCandidates: group.referencePartIds,
		candidateType: 'temporary-generated',
		sourceBounds: targetBounds,
		referenceBounds: targetBounds,
		targetBounds,
		alignedBounds: targetBounds,
		transform: {
			translate: { x: 0, y: 0 },
			scale: { x: 1, y: 1 },
			matrix,
			matrixString: 'matrix(1 0 0 1 0 0)',
		},
		matchStatus: 'skipped',
		strategy: 'temporary-generated',
		score: null,
		scoreKind: null,
		identityResolver: identityResolverForGroup(group),
		reviewStatus: 'inferred',
		skipReason: reason,
		temporary: true,
		temporaryComponentPolicy: 'discard-before-final-rendering',
		provenance: 'temporary-generated-alignment-candidate',
		alternatives: [],
		diagnostics: [],
	};
}

function makeTemporaryGeneratedAlignmentGroup({
	alignmentGroupId,
	group,
	referenceComponents,
	sourceComponents = [],
	alignmentIds = [],
	reason,
}) {
	return {
		alignmentGroupId,
		groupId: group.groupId,
		role: group.role,
		contentKind: group.contentKind,
		referencePartIds: group.referencePartIds,
		referenceComponentIds: group.referenceComponentIds,
		targetBounds: group.targetBounds || null,
		sourceComponentIds: sourceComponents.map((component) => component.componentId),
		sourceComponentCount: sourceComponents.length,
		referenceComponentCount: referenceComponents.length,
		alignmentIds,
		strategy: 'temporary-generated',
		matchStatus: 'skipped',
		score: null,
		scoreKind: null,
		identityResolver: identityResolverForGroup(group),
		reviewStatus: 'inferred',
		skipReason: reason,
		temporary: true,
		temporaryComponentPolicy: 'discard-before-final-rendering',
		diagnostics: [],
	};
}

function selectSourceComponentsForReferenceGroup({ group, sourceComponents, referenceComponents = [], sourceBounds, faceMetadata, optionalContext, semanticBindingContext }) {
	if (isGeneratedReferencePartGroup(group, semanticBindingContext)) {
		return [];
	}

	const optionalComponents = selectOptionalSourceComponentsForGroup(group, sourceComponents, optionalContext);

	if (optionalComponents) {
		return optionalComponents;
	}

	const boundComponents = selectBoundSourceComponentsForGroup(group, sourceComponents, semanticBindingContext);

	if (boundComponents) {
		return boundComponents;
	}

	const availableSourceComponents = sourceComponents
		.filter((component) => !isReservedByActiveOptionalPart(component, optionalContext, semanticBindingContext))
		.filter((component) => !sourceUnitComponentIds(component)
			.some((componentId) => semanticBindingContext.boundComponentIds.has(componentId)));
	const colorHueComponents = selectComponentsInReferenceColorHue(availableSourceComponents, referenceComponents);

	if (group.role === 'wind-character') {
		return colorHueComponents || availableSourceComponents;
	}

	if (group.contentKind === 'label') {
		return selectComponentsFromSourceGlyphMetadata(availableSourceComponents, sourceBounds, glyphMetadataForGroup(group, faceMetadata));
	}

	if (group.role === 'character-number-glyph') {
		if (colorHueComponents) {
			return colorHueComponents;
		}

		return selectCharacterNumberGlyphComponents({
			sourceComponents: availableSourceComponents,
			sourceBounds,
			faceMetadata,
			group,
		});
	}

	if (group.role === 'character-body') {
		return colorHueComponents || availableSourceComponents;
	}

	if (group.contentKind === 'glyph') {
		return selectComponentsFromSourceGlyphMetadata(colorHueComponents || availableSourceComponents, sourceBounds, glyphMetadataForGroup(group, faceMetadata));
	}

	if (group.contentKind === 'artwork') {
		return availableSourceComponents;
	}

	return availableSourceComponents;
}

function makeSourceSemanticBindingContext(semanticMap, sourceComponents) {
	const sourceSemanticBindings = semanticMap?.bindings || {};
	const sourceSemanticPartStates = semanticMap?.parts || {};
	const generatedPartIds = new Set();

	if (isAcceptedSemanticMap(semanticMap)) {
		for (const [partId, partState] of Object.entries(sourceSemanticPartStates)) {
			if (partState?.state === 'generated') {
				generatedPartIds.add(partId);
			}
		}
		for (const assignment of semanticMap?.assignments || []) {
			if (assignment?.assignmentType !== 'generated') {
				continue;
			}
			if (assignment.referencePartId) {
				generatedPartIds.add(assignment.referencePartId);
			}
			if (assignment.sourcePartId) {
				generatedPartIds.add(assignment.sourcePartId);
			}
		}
	}
	const strongBindingEntries = Object.entries(sourceSemanticBindings)
		.filter(([, binding]) => binding?.partId && (binding.strength === 'strong' || binding.strength === 'accepted'));
	const boundComponentIds = new Set(strongBindingEntries.map(([componentId]) => componentId));
	const strongBoundPartIds = new Set(strongBindingEntries.map(([, binding]) => binding.partId));
	const availableComponentIds = new Set(sourceComponents.flatMap(sourceUnitComponentIds));

	return {
		sourceSemanticBindings,
		sourceSemanticPartStates,
		generatedPartIds,
		boundComponentIds,
		strongBoundPartIds,
		availableComponentIds,
	};
}

function isAcceptedSemanticMap(semanticMap) {
	return Boolean(semanticMap?.acceptedOn)
		|| semanticMap?.sourceApproval === 'accepted'
		|| semanticMap?.reviewStatus === 'accepted'
		|| semanticMap?.status === 'accepted';
}

function isGeneratedReferencePartGroup(group, semanticBindingContext) {
	return (group.referencePartIds || [])
		.some((partId) => semanticBindingContext.generatedPartIds.has(partId)
			&& !semanticBindingContext.strongBoundPartIds.has(partId));
}

function selectBoundSourceComponentsForGroup(group, sourceComponents, semanticBindingContext) {
	const selectedComponentIds = new Set();

	for (const partId of group.referencePartIds || []) {
		for (const [componentId, binding] of Object.entries(semanticBindingContext.sourceSemanticBindings || {})) {
			if (!binding?.partId || binding.partId !== partId || !['strong', 'accepted'].includes(binding.strength)) {
				continue;
			}
			if (semanticBindingContext.availableComponentIds.has(componentId)) {
				selectedComponentIds.add(componentId);
			}
		}
	}

	if (selectedComponentIds.size === 0) {
		return null;
	}

	const groupPartIds = new Set(group.referencePartIds || []);

	return sourceComponents.filter((component) => sourceUnitComponentIds(component)
		.some((componentId) => selectedComponentIds.has(componentId))
		&& strongBoundPartIdsForSourceUnit(component, semanticBindingContext)
			.every((partId) => groupPartIds.has(partId)));
}

function canJoinSourceComponentsByStrongBinding(leftComponent, rightComponent, semanticBindingContext) {
	const leftPartIds = strongBoundPartIdsForSourceUnit(leftComponent, semanticBindingContext);
	const rightPartIds = strongBoundPartIdsForSourceUnit(rightComponent, semanticBindingContext);

	if (leftPartIds.length === 0 || rightPartIds.length === 0) {
		return true;
	}

	return new Set([...leftPartIds, ...rightPartIds]).size === 1;
}

function strongBoundPartIdsForSourceUnit(component, semanticBindingContext) {
	return uniqueValues(sourceUnitComponentIds(component)
		.map((componentId) => {
			const binding = semanticBindingContext.sourceSemanticBindings?.[componentId];

			return binding?.partId && ['strong', 'accepted'].includes(binding.strength)
				? binding.partId
				: null;
		}));
}

function makeOptionalAssignmentContext(optionalAssignment, semanticBindingContext) {
	const optionalParts = Object.fromEntries(Object.entries(optionalAssignment?.optionalParts || {})
		.map(([partId, part]) => [partId, {
			...part,
			suggestedComponentIds: optionalBindingComponentIdsForPart(semanticBindingContext, partId, part),
		}]));
	const reservations = Object.entries(optionalParts)
		.filter(([, part]) => (part.suggestedComponentIds || []).length > 0)
		.map(([partId, part]) => ({
			partId,
			componentIds: part.suggestedComponentIds,
		}));
	const reservedComponentIds = new Set(reservations.flatMap((reservation) => reservation.componentIds || []));

	return {
		optionalParts,
		reservations,
		reservedComponentIds,
	};
}

function optionalBindingComponentIdsForPart(semanticBindingContext, partId, part) {
	if (isOptionalSourceAbsence(part)) {
		return [];
	}

	return Object.entries(semanticBindingContext.sourceSemanticBindings || {})
		.filter(([, binding]) => (
			binding?.partId === partId
			&& ['tentative', 'strong', 'accepted'].includes(binding.strength)
			&& binding.strength !== 'none'
			&& isCurrentOptionalBinding(binding, part)
		))
		.map(([componentId]) => componentId)
		.filter((componentId) => semanticBindingContext.availableComponentIds.has(componentId))
		.sort((left, right) => left.localeCompare(right));
}

function isCurrentOptionalBinding(binding, part) {
	return !isOptionalSourceAbsence(part);
}

function selectOptionalSourceComponentsForGroup(group, sourceComponents, optionalContext) {
	const matchingPart = optionalPartForGroup(group, optionalContext);

	if (!matchingPart) {
		return null;
	}

	const selectedComponentIds = new Set(matchingPart.suggestedComponentIds || []);

	if (selectedComponentIds.size === 0) {
		return isOptionalSourceAbsence(matchingPart)
			? []
			: null;
	}

	return sourceComponents.filter((component) => sourceUnitComponentIds(component)
		.some((componentId) => selectedComponentIds.has(componentId)));
}

function isReviewedOptionalAbsence(reviewStatus) {
	return ['accepted', 'reviewed'].includes(reviewStatus);
}

function isOptionalSourceAbsence(part) {
	return part?.sourceState === 'source-absent';
}

function optionalPartForGroup(group, optionalContext) {
	const partIds = group.referencePartIds || [];

	for (const partId of partIds) {
		const optionalPart = optionalContext.optionalParts[partId];

		if (optionalPart) {
			return optionalPart;
		}
	}

	if (group.contentKind === 'label') {
		return optionalContext.optionalParts.label || null;
	}

	if (group.contentKind === 'glyph' && group.role !== 'character-body') {
		return optionalContext.optionalParts.glyph || null;
	}

	return null;
}

function isReservedByActiveOptionalPart(component, optionalContext, semanticBindingContext) {
	const componentIds = sourceUnitComponentIds(component);

	return (optionalContext.reservations || [])
		.some((reservation) => (reservation.componentIds || [])
			.some((componentId) => componentIds.includes(componentId))
			&& !semanticBindingContext.generatedPartIds.has(reservation.partId));
}

function glyphMetadataForGroup(group, faceMetadata) {
	const layout = faceMetadata?.glyphLayout || {};

	if (group.contentKind === 'label') {
		return layout.number || null;
	}

	if (group.contentKind === 'glyph' || group.role === 'character-number-glyph') {
		return layout.character || layout.glyph || null;
	}

	return null;
}

function selectComponentsFromSourceGlyphMetadata(sourceComponents, sourceBounds, glyphMetadata) {
	if (!sourceBounds || !glyphMetadata?.sourcePresent) {
		return [];
	}

	if (glyphMetadata.sourceBounds) {
		return selectComponentsOverlappingSourceBounds(sourceComponents, glyphMetadata.sourceBounds);
	}

	if (glyphMetadata.sourceCorner) {
		return selectComponentsInSourceCorner(sourceComponents, sourceBounds, glyphMetadata.sourceCorner);
	}

	return [];
}

function selectCharacterNumberGlyphComponents({ sourceComponents, sourceBounds, faceMetadata, group }) {
	const metadataComponents = selectComponentsFromSourceGlyphMetadata(
		sourceComponents,
		sourceBounds,
		glyphMetadataForGroup(group, faceMetadata),
	);

	if (metadataComponents.length > 0) {
		return metadataComponents;
	}

	if (!sourceBounds) {
		return [];
	}

	if (sourceComponents.length === 1) {
		return sourceComponents;
	}

	const fallbackBounds = unionBounds(sourceComponents.map((component) => component.bounds).filter(Boolean)) || sourceBounds;

	return sourceComponents
		.filter((component) => normalizedCenter(component, fallbackBounds).y < 0.36)
		.sort((left, right) => left.center.y - right.center.y || left.center.x - right.center.x);
}

function selectComponentsInReferenceColorHue(sourceComponents, referenceComponents) {
	const referenceHues = uniqueValues(referenceComponents.map((component) => colorHueKey(componentColor(component))));
	const sourceHues = uniqueValues(sourceComponents.map((component) => colorHueKey(componentColor(component))));

	if (
		referenceHues.length !== 1
		|| referenceHues[0] === 'unknown'
		|| sourceHues.length <= 1
	) {
		return null;
	}

	const selected = sourceComponents.filter((component) => (
		colorHueKey(componentColor(component)) === referenceHues[0]
	));

	return selected.length > 0 ? selected : null;
}

function selectComponentsOverlappingSourceBounds(sourceComponents, sourceGlyphBounds) {
	return sourceComponents.filter((component) => boundsOverlap(component.bounds, sourceGlyphBounds));
}

function boundsOverlap(left, right) {
	return Boolean(left && right)
		&& left.right >= right.left
		&& left.left <= right.right
		&& left.bottom >= right.top
		&& left.top <= right.bottom;
}

function selectComponentsInSourceCorner(sourceComponents, sourceBounds, sourceCorner) {
	const cornerCenter = sourceCornerCenter(sourceCorner);

	if (!cornerCenter) {
		return [];
	}

	const maxDistance = 0.34;
	const maxAreaRatio = 0.18;
	const ranked = sourceComponents
		.map((component) => {
			const center = normalizedCenter(component, sourceBounds);
			const distance = Math.hypot(center.x - cornerCenter.x, center.y - cornerCenter.y);
			const areaRatio = boundsArea(component.bounds) / Math.max(1, boundsArea(sourceBounds));

			return {
				component,
				distance,
				areaRatio,
			};
		})
		.filter((entry) => entry.distance <= maxDistance && entry.areaRatio <= maxAreaRatio)
		.sort((left, right) => left.distance - right.distance);

	if (ranked.length === 0) {
		return [];
	}

	return ranked
		.filter((entry) => entry.distance <= Math.max(maxDistance * 0.75, ranked[0].distance + 0.08))
		.map((entry) => entry.component);
}

function sourceCornerCenter(sourceCorner) {
	const centers = {
		topLeft: { x: 0, y: 0 },
		topRight: { x: 1, y: 0 },
		bottomLeft: { x: 0, y: 1 },
		bottomRight: { x: 1, y: 1 },
	};

	return centers[sourceCorner] || null;
}

function makeAlignmentCandidate({ faceKey, group, groupIndex, match, matchIndex, matches = [], grouping, referenceFace, referenceStructure, optionalPart = null, fit = null }) {
	const sourceBounds = match.sourceGroup.bounds;
	const referenceBounds = match.referenceGroup.bounds;
	const targetBounds = targetBoundsForMatch(match, group, referenceFace, referenceStructure);
	const selectedFit = fit || selectAlignmentFit({
		sourceBounds,
		targetBounds,
		group,
		matchIndex,
		matches,
		referenceFace,
		referenceStructure,
	});
	const transform = selectedFit.transform;

	return {
		alignmentId: `align.${faceKey}.${String(groupIndex + 1).padStart(2, '0')}.${String(matchIndex + 1).padStart(4, '0')}`,
		alignmentGroupId: `align-group.${faceKey}.${group.groupId}`,
		sourceComponentIds: uniqueValues(match.sourceGroup.components.flatMap(sourceUnitComponentIds)),
		sourceShapeIds: uniqueValues(match.sourceGroup.components.map((component) => component.sourceShapeId).filter(Boolean)),
		referenceComponentIds: match.referenceGroup.components.map((component) => component.componentId),
		referencePartCandidates: uniqueValues(match.referenceGroup.partIds || group.referencePartIds),
		candidateType: candidateTypeForMatch(match),
		strategy: grouping.strategy,
		matchStatus: grouping.matchResult.status,
		score: round(scoreCandidateTransform(sourceBounds, referenceBounds)),
		scoreKind: 'penalty-lower-is-better',
		identityResolver: identityResolverForGroup(group),
		reviewStatus: isMatchedStatus(grouping.matchResult.status)
			? optionalPart?.reviewStatus || 'inferred'
			: 'needs-review',
		strength: optionalPart?.strength || null,
		sourceBounds,
		referenceBounds,
		targetBounds,
		alignedBounds: selectedFit.alignedBounds,
		transform: {
			translate: {
				x: round(transform.e),
				y: round(transform.f),
			},
			scale: {
				x: round(transform.a),
				y: round(transform.d),
			},
			rotate: 0,
			matrix: [transform.a, transform.b, transform.c, transform.d, transform.e, transform.f].map(round),
			matrixString: matrixToString(transform),
			fitPolicy: selectedFit.policy,
			fitScore: round(selectedFit.score),
			scaleCeiling: round(selectedFit.scaleCeiling),
			...(selectedFit.sharedScale != null ? { sharedScale: round(selectedFit.sharedScale) } : {}),
		},
		alternatives: [],
		diagnostics: [],
		semanticContext: {
			partIds: uniqueValues(match.referenceGroup.partIds || []),
			globalPartIds: uniqueValues(match.referenceGroup.globalPartIds || []),
			semanticRoles: uniqueValues(match.referenceGroup.semanticRoles || []),
		},
	};
}

function targetBoundsForMatch(match, group, referenceFace, referenceStructure) {
	const partIds = uniqueValues(match.referenceGroup.partIds || group.referencePartIds);
	const referenceComponentIds = match.referenceGroup.components.map((component) => component.componentId);
	const coversWholePart = partIds.length > 0
		&& partIds.every((partId) => {
			const partComponentIds = referenceFace.parts?.[partId]?.componentIds || [];
			return partComponentIds.length > 0
				&& partComponentIds.every((componentId) => referenceComponentIds.includes(componentId));
		});
	const targetBoundsList = partIds
		.map((partId) => referenceFace.parts?.[partId]?.targetBounds)
		.filter(Boolean);

	if (coversWholePart && targetBoundsList.length > 0) {
		return unionBounds(targetBoundsList);
	}

	return targetPixelsToViewBoxBounds(
		match.referenceGroup.bounds,
		referenceFace.image,
		preparedViewBox(referenceStructure),
	);
}

function selectAlignmentFitsForGroup({ group, matches, referenceFace, referenceStructure }) {
	const fits = matches.map((match, matchIndex) => selectAlignmentFit({
		sourceBounds: match.sourceGroup.bounds,
		targetBounds: targetBoundsForMatch(match, group, referenceFace, referenceStructure),
		group,
		matchIndex,
		matches,
		referenceFace,
		referenceStructure,
	}));
	const shouldShareScale = matches.length > 1
		&& group.contentKind === 'artwork'
		&& ['bamboo-stick', 'dot', 'bamboo-group'].includes(group.role);

	if (!shouldShareScale) {
		return fits;
	}

	const boundedFits = fits.filter((fit) => fit.policy === 'bounded-pixel-fit');

	if (boundedFits.length !== fits.length) {
		const containFits = matches.map((match) => {
			const sourceBounds = match.sourceGroup.bounds;
			const targetBounds = targetBoundsForMatch(match, group, referenceFace, referenceStructure);
			const transform = boundsToTransformMatrix(sourceBounds, targetBounds);

			return {
				sourceBounds,
				targetBounds,
				scale: transform.a,
				score: boundsFitScore(transformBounds(sourceBounds, transform), targetBounds),
			};
		});
		const sharedScale = Math.min(...containFits.map((fit) => fit.scale));

		return matches.map((match, matchIndex) => {
			const sourceBounds = match.sourceGroup.bounds;
			const targetBounds = targetBoundsForMatch(match, group, referenceFace, referenceStructure);
			const sharedFit = makeScaleFitCandidate(sourceBounds, targetBounds, sharedScale);

			return {
				policy: 'contain-fit-shared-scale',
				transform: sharedFit.transform,
				alignedBounds: sharedFit.alignedBounds,
				score: sharedFit.score,
				scaleCeiling: containFits[matchIndex].scale,
				sharedScale,
				sourceFitScore: containFits[matchIndex].score,
			};
		});
	}

	if (boundedFits.length <= 1) {
		return fits;
	}

	const sharedScale = Math.min(...boundedFits.map((fit) => fit.transform.a));

	return matches.map((match, matchIndex) => {
		const sourceBounds = match.sourceGroup.bounds;
		const targetBounds = targetBoundsForMatch(match, group, referenceFace, referenceStructure);
		const sharedFit = makeScaleFitCandidate(sourceBounds, targetBounds, sharedScale);

		return {
			policy: 'bounded-pixel-fit-shared-scale',
			transform: sharedFit.transform,
			alignedBounds: sharedFit.alignedBounds,
			score: sharedFit.score,
			scaleCeiling: sharedFit.scaleCeiling,
			sharedScale,
			sourceFitScore: fits[matchIndex].score,
		};
	});
}

function selectAlignmentFit({ sourceBounds, targetBounds, group, matchIndex, matches, referenceFace, referenceStructure }) {
	if (!shouldUseBoundedPixelFit(group, matches, sourceBounds, targetBounds)) {
		const transform = boundsToTransformMatrix(sourceBounds, targetBounds);

		return {
			policy: 'contain-fit',
			transform,
			alignedBounds: transformBounds(sourceBounds, transform),
			score: boundsFitScore(transformBounds(sourceBounds, transform), targetBounds),
			scaleCeiling: transform.a,
		};
	}

	const candidates = alignmentScaleCandidates(sourceBounds, targetBounds)
		.map((scale) => makeScaleFitCandidate(sourceBounds, targetBounds, scale));
	const viableCandidates = candidates.filter((candidate) => (
		!exceedsBothAxes(candidate.alignedBounds, targetBounds)
		&& preservesSiblingBreathingRoom({
			candidate,
			matchIndex,
			matches,
			group,
			referenceFace,
			referenceStructure,
		})
	));
	const selected = (viableCandidates.length ? viableCandidates : candidates)
		.sort((left, right) => (
			right.score - left.score
			|| left.overflowAxisCount - right.overflowAxisCount
			|| left.scale - right.scale
		))[0];

	return {
		policy: 'bounded-pixel-fit',
		transform: selected.transform,
		alignedBounds: selected.alignedBounds,
		score: selected.score,
		scaleCeiling: selected.scaleCeiling,
	};
}

function shouldUseBoundedPixelFit(group, matches, sourceBounds, targetBounds) {
	const sourceAspect = sourceBounds.width / Math.max(0.001, sourceBounds.height);
	const targetAspect = targetBounds.width / Math.max(0.001, targetBounds.height);
	const aspectChange = Math.max(sourceAspect, targetAspect) / Math.max(0.001, Math.min(sourceAspect, targetAspect));

	return matches.length > 1
		&& group.contentKind === 'artwork'
		&& ['bamboo-stick', 'dot', 'bamboo-group'].includes(group.role)
		&& aspectChange <= BOUNDED_PIXEL_FIT_MAX_ASPECT_CHANGE;
}

function alignmentScaleCandidates(sourceBounds, targetBounds) {
	const widthScale = targetBounds.width / sourceBounds.width;
	const heightScale = targetBounds.height / sourceBounds.height;
	const minScale = Math.min(widthScale, heightScale);
	const maxScale = Math.max(widthScale, heightScale);
	const centerScale = Math.sqrt(widthScale * heightScale);
	const candidates = new Set([
		roundScale(minScale),
		roundScale(centerScale),
		roundScale(maxScale),
	]);
	const steps = 8;

	for (let index = 1; index < steps; index += 1) {
		const ratio = index / steps;
		candidates.add(roundScale(minScale + ((maxScale - minScale) * ratio)));
	}

	return [...candidates]
		.filter((scale) => Number.isFinite(scale) && scale > 0)
		.sort((left, right) => left - right);
}

function makeScaleFitCandidate(sourceBounds, targetBounds, scale) {
	const transform = centeredScaleTransform(sourceBounds, targetBounds, scale);
	const alignedBounds = transformBounds(sourceBounds, transform);
	const scaleCeiling = Math.max(targetBounds.width / sourceBounds.width, targetBounds.height / sourceBounds.height);

	return {
		scale,
		scaleCeiling,
		transform,
		targetBounds,
		alignedBounds,
		score: boundsFitScore(alignedBounds, targetBounds),
		overflowAxisCount: overflowAxisCount(alignedBounds, targetBounds),
	};
}

function centeredScaleTransform(sourceBounds, targetBounds, scale) {
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

function boundsFitScore(alignedBounds, targetBounds) {
	const intersection = intersectionArea(alignedBounds, targetBounds);
	const union = boundsArea(alignedBounds) + boundsArea(targetBounds) - intersection;
	const centerDistance = Math.hypot(
		boundsCenter(alignedBounds).x - boundsCenter(targetBounds).x,
		boundsCenter(alignedBounds).y - boundsCenter(targetBounds).y,
	);
	const normalizedDistance = centerDistance / Math.max(1, Math.hypot(targetBounds.width, targetBounds.height));

	return union <= 0 ? 0 : (intersection / union) - (normalizedDistance * 0.08);
}

function preservesSiblingBreathingRoom({ candidate, matchIndex, matches, group, referenceFace, referenceStructure }) {
	const siblingTargetBounds = matches
		.map((match, index) => index === matchIndex
			? null
			: targetBoundsForMatch(match, group, referenceFace, referenceStructure))
		.filter(Boolean);

	return siblingTargetBounds.every((siblingBounds) => {
		if (intersectionArea(candidate.alignedBounds, siblingBounds) > 0.001) {
			return false;
		}

		const expectedGap = gapBetweenBounds(candidate.targetBounds, siblingBounds);
		const requiredGap = Math.min(expectedGap, Math.max(1, (expectedGap / 2) + 0.5));

		return gapBetweenBounds(candidate.alignedBounds, siblingBounds) + 0.000001 >= requiredGap;
	});
}

function exceedsBothAxes(alignedBounds, targetBounds) {
	return alignedBounds.width > targetBounds.width + 0.000001
		&& alignedBounds.height > targetBounds.height + 0.000001;
}

function overflowAxisCount(alignedBounds, targetBounds) {
	return Number(alignedBounds.width > targetBounds.width + 0.000001)
		+ Number(alignedBounds.height > targetBounds.height + 0.000001);
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

function intersectionArea(left, right) {
	const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
	const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));

	return width * height;
}

function gapBetweenBounds(left, right) {
	const horizontalGap = Math.max(0, Math.max(left.left, right.left) - Math.min(left.right, right.right));
	const verticalGap = Math.max(0, Math.max(left.top, right.top) - Math.min(left.bottom, right.bottom));

	if (horizontalGap > 0 && verticalGap > 0) {
		return Math.hypot(horizontalGap, verticalGap);
	}

	return Math.max(horizontalGap, verticalGap);
}

function boundsCenter(bounds) {
	return {
		x: bounds.left + (bounds.width / 2),
		y: bounds.top + (bounds.height / 2),
	};
}

function roundScale(value) {
	return Number(value.toFixed(6));
}

function identityResolverForGroup(group) {
	if ((group.referencePartIds || []).length <= 1) {
		return { type: 'direct' };
	}

	if (group.role === 'dot' || group.role === 'bamboo-stick' || group.role === 'bamboo-group') {
		return {
			type: 'nearest-normalized-position',
			reviewNote: 'Repeated artwork identity is provisional until semantic assignment records exact member pairing.',
		};
	}

	return { type: 'role' };
}

function candidateTypeForMatch(match) {
	const sourceCount = match.sourceGroup.components.length;
	const referenceCount = match.referenceGroup.components.length;

	if (sourceCount === 1 && referenceCount === 1) {
		return 'direct';
	}

	if (sourceCount > 1 && referenceCount === 1) {
		return 'merge-source';
	}

	if (sourceCount === 1 && referenceCount > 1) {
		return 'regroup-reference';
	}

	return 'grouped';
}

function scoreCandidateTransform(sourceBounds, referenceBounds) {
	const sourceAspect = sourceBounds.width / Math.max(0.001, sourceBounds.height);
	const referenceAspect = referenceBounds.width / Math.max(0.001, referenceBounds.height);
	const aspectChange = Math.max(sourceAspect, referenceAspect) / Math.max(0.001, Math.min(sourceAspect, referenceAspect));
	const scaleX = referenceBounds.width / Math.max(0.001, sourceBounds.width);
	const scaleY = referenceBounds.height / Math.max(0.001, sourceBounds.height);
	const scaleSkew = Math.max(scaleX, scaleY) / Math.max(0.001, Math.min(scaleX, scaleY));

	return ((aspectChange - 1) * 35) + ((scaleSkew - 1) * 35);
}

function addUnmatchedDiagnostics({
	diagnostics,
	alignmentGroups,
	candidates,
	sourceComponents,
	usedSourceComponentIds,
	usedReferenceComponentIds,
}) {
	const expectedSourceComponentIds = new Set(
		alignmentGroups
			.filter((group) => group.matchStatus !== 'skipped')
			.flatMap((group) => group.sourceComponentIds || []),
	);
	const expectedReferenceComponentIds = new Set(
		alignmentGroups
			.filter((group) => group.matchStatus !== 'skipped')
			.flatMap((group) => group.referenceComponentIds || []),
	);
	const unmatchedSourceComponentIds = [...expectedSourceComponentIds]
		.filter((componentId) => !usedSourceComponentIds.has(componentId));
	const unmatchedReferenceComponentIds = [...expectedReferenceComponentIds]
		.filter((componentId) => !usedReferenceComponentIds.has(componentId));
	const duplicateSourceComponentIds = duplicateIds(candidates.flatMap((candidate) => candidate.sourceComponentIds || []));
	const duplicateReferenceComponentIds = duplicateIds(candidates.flatMap((candidate) => candidate.referenceComponentIds || []));

	if (duplicateSourceComponentIds.length > 0) {
		diagnostics.push({
			level: 'warning',
			code: 'duplicate-source-component-alignment',
			message: 'Some source components were used by more than one alignment candidate.',
			sourceComponentIds: duplicateSourceComponentIds,
		});
	}

	if (duplicateReferenceComponentIds.length > 0) {
		diagnostics.push({
			level: 'warning',
			code: 'duplicate-reference-component-alignment',
			message: 'Some reference components were used by more than one alignment candidate.',
			referenceComponentIds: duplicateReferenceComponentIds,
		});
	}

	if (unmatchedSourceComponentIds.length > 0) {
		diagnostics.push({
			level: 'warning',
			code: 'unmatched-source-components',
			message: 'Some selected source components were not used by any alignment candidate.',
			sourceComponentIds: unmatchedSourceComponentIds,
		});
	}

	if (unmatchedReferenceComponentIds.length > 0) {
		diagnostics.push({
			level: 'warning',
			code: 'unmatched-reference-components',
			message: 'Some alignable reference components were not used by any alignment candidate.',
			referenceComponentIds: unmatchedReferenceComponentIds,
		});
	}

	const selectedSourceComponentIds = new Set(sourceComponents.flatMap(sourceUnitComponentIds));
	const unexpectedUsedSourceIds = [...usedSourceComponentIds]
		.filter((componentId) => !selectedSourceComponentIds.has(componentId));

	if (unexpectedUsedSourceIds.length > 0) {
		diagnostics.push({
			level: 'warning',
			code: 'unexpected-source-components',
			message: 'Alignment used source components outside the normalized alignment component set.',
			sourceComponentIds: unexpectedUsedSourceIds,
		});
	}
}

function duplicateIds(ids) {
	const seen = new Set();
	const duplicates = new Set();

	for (const id of ids) {
		if (!id) {
			continue;
		}

		if (seen.has(id)) {
			duplicates.add(id);
		} else {
			seen.add(id);
		}
	}

	return [...duplicates];
}

function isMatchedStatus(status) {
	return typeof status === 'string' && status.startsWith('matched');
}

function makeSourceAlignmentUnits(normalizedFace) {
	const alignmentComponentIds = new Set(normalizedFace.alignmentComponentIds || []);
	const componentsById = new Map((normalizedFace.components || []).map((component) => [component.componentId, component]));
	const shapes = normalizedFace.sourceShapes || [];

	if (shapes.length === 0) {
		return (normalizedFace.components || [])
			.filter((component) => alignmentComponentIds.has(component.componentId))
			.map((component) => sourceComponentForMatcher({
				...component,
				sourceShapeId: null,
				sourceComponentIds: [component.componentId],
			}));
	}

	return shapes
		.filter((shape) => (shape.componentIds || []).some((componentId) => alignmentComponentIds.has(componentId)))
		.map((shape) => {
			const shapeComponents = (shape.componentIds || [])
				.map((componentId) => componentsById.get(componentId))
				.filter(Boolean);
			const bounds = shape.bounds || unionBounds(shapeComponents.map((component) => component.bounds || component));
			const center = shape.center || {
				x: bounds.left + (bounds.width / 2),
				y: bounds.top + (bounds.height / 2),
			};

			return sourceComponentForMatcher({
				componentId: shape.shapeId,
				sourceShapeId: shape.shapeId,
				sourceComponentIds: shapeComponents.map((component) => component.componentId),
				bounds,
				center,
				area: shape.area,
				fill: shape.dominantColor,
				stroke: null,
				parentGroupIds: shape.parentGroupIds || [],
				sourceElementIds: shape.sourceElementIds || [],
				sourceElementComponentIds: shape.sourceElementComponentIds || [],
				cohesionReason: shape.cohesionReason || null,
			});
		});
}

function sourceComponentForMatcher(component) {
	return {
		...component.bounds,
		...component,
		dominantColor: component.fill || component.stroke || null,
	};
}

function sourceUnitComponentIds(component) {
	return component.sourceComponentIds || [component.componentId];
}

function referenceComponentForMatcher(component) {
	return {
		...component.bounds,
		...component,
	};
}

function normalizedCenter(component, bounds) {
	return {
		x: (component.center.x - bounds.left) / Math.max(1, bounds.width),
		y: (component.center.y - bounds.top) / Math.max(1, bounds.height),
	};
}

function boundsArea(bounds) {
	return Math.max(0, bounds?.width || 0) * Math.max(0, bounds?.height || 0);
}

function preparedViewBox(referenceStructure) {
	const [, , width, height] = referenceStructure.referenceSet?.coordinateSpace?.preparedViewBox || [0, 0, 94, 136];

	return { width, height };
}

function uniqueValues(values) {
	return [...new Set((values || []).filter(Boolean))];
}

function componentColor(component) {
	return component?.dominantColor || component?.fill || component?.stroke || null;
}

function colorHueKey(color) {
	const rgb = parseColor(color);

	if (!rgb) {
		return 'unknown';
	}

	const max = Math.max(rgb.r, rgb.g, rgb.b);
	const min = Math.min(rgb.r, rgb.g, rgb.b);
	const chroma = max - min;
	const luminance = ((0.2126 * rgb.r) + (0.7152 * rgb.g) + (0.0722 * rgb.b)) / 255;
	const saturation = max === 0 ? 0 : chroma / max;

	if (luminance <= 0.28 && saturation <= 0.75) {
		return 'dark-neutral';
	}

	return `hue-${Math.round(rgbToHue(rgb) / 45)}`;
}

function parseColor(color) {
	const value = String(color || '').trim().toLowerCase();

	if (value === 'black') {
		return { r: 0, g: 0, b: 0 };
	}

	const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);

	if (!hex) {
		return null;
	}

	const digits = hex[1].length === 3
		? hex[1].split('').map((digit) => `${digit}${digit}`).join('')
		: hex[1];

	return {
		r: Number.parseInt(digits.slice(0, 2), 16),
		g: Number.parseInt(digits.slice(2, 4), 16),
		b: Number.parseInt(digits.slice(4, 6), 16),
	};
}

function rgbToHue({ r, g, b }) {
	const red = r / 255;
	const green = g / 255;
	const blue = b / 255;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const delta = max - min;

	if (delta === 0) {
		return 0;
	}

	if (max === red) {
		return 60 * (((green - blue) / delta) % 6);
	}

	if (max === green) {
		return 60 * (((blue - red) / delta) + 2);
	}

	return 60 * (((red - green) / delta) + 4);
}

function round(value) {
	return Number(Number(value || 0).toFixed(6));
}
