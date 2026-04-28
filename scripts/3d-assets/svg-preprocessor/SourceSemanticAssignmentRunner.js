import { promises as fs } from 'fs';
import path from 'path';
import { OUTPUT_3D_DIR, ROOT_DIR } from '../shared/asset-paths.js';
import { DEFAULT_REFERENCE_STRUCTURE_PATH } from './reference-structure-components.js';

export const DEFAULT_SOURCE_SEMANTIC_ASSIGNMENT_TILESET_ID = 'wiki';

/**
 * Runs source semantic assignment from compact model-owned alignment matches.
 */
export class SourceSemanticAssignmentRunner {
	/**
	 * Creates a runner with replaceable filesystem and pipeline dependencies.
	 *
	 * @param {SourceSemanticAssignmentRunnerDependencies} dependencies - Dependencies used by the semantic assignment workflow.
	 */
	constructor({
		fileSystem = fs,
		pathModule = path,
		rootDir = ROOT_DIR,
		output3dDir = OUTPUT_3D_DIR,
		updateState = null,
		clock = () => new Date().toISOString(),
	} = {}) {
		this.fs = fileSystem;
		this.path = pathModule;
		this.rootDir = rootDir;
		this.output3dDir = output3dDir;
		this.updateState = updateState;
		this.clock = clock;
	}

	/**
	 * Runs semantic assignment for all selected reference faces.
	 *
	 * @param {SourceSemanticAssignmentRunOptions} options - Assignment options resolved by the CLI or tests.
	 * @returns {Promise<SourceSemanticAssignmentSummary>} Summary of model updates and in-memory diagnostics.
	 */
	async run(options = {}) {
		const tilesetId = options.tilesetId || DEFAULT_SOURCE_SEMANTIC_ASSIGNMENT_TILESET_ID;
		const requestedFaceKey = options.faceKey || null;
		const pipelineModel = options.pipelineModel;

		if (!pipelineModel) {
			throw new Error('SourceSemanticAssignmentRunner requires a PipelineModel.');
		}

		const referenceStructurePath = pipelineModel.referenceFile || this.path.resolve(
			this.rootDir,
			options.referenceStructurePath || DEFAULT_REFERENCE_STRUCTURE_PATH,
		);
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
			});
		}

		await pipelineModel.save();

		return {
			tilesetId,
			faceKey: requestedFaceKey,
			faceCount: report.faceCount,
			assignmentCount: report.assignmentCount,
			diagnosticCount: report.diagnosticCount,
			warningCount: report.warnings.length,
		};
	}

	/**
	 * Creates the report shell accumulated during a run.
	 *
	 * @param {SourceSemanticAssignmentCreateReportOptions} options - Report identity and selected face fields.
	 * @returns {SourceSemanticAssignmentReport} Empty report for the run.
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
			assignmentCount: 0,
			diagnosticCount: 0,
			faces: {},
			warnings: [],
		};
	}

	/**
	 * Processes one face alignment handoff and updates compact model assignment state.
	 *
	 * @param {SourceSemanticAssignmentProcessFaceOptions} options - Per-face processing context.
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
	}) {
		const faceState = pipelineModel.getFace(faceKey);

		if (!faceState?.state || typeof faceState.state !== 'object' || Array.isArray(faceState.state)) {
			throw new Error(`Source Semantic Assignment requires canonical inline face state for ${faceKey}. Regenerate the model-owned pipeline state through intake.`);
		}

		if ((faceState.state.alignment?.matches || []).length === 0) {
			const warning = {
				faceKey,
				code: 'missing-alignment-matches',
				message: `No compact alignment matches exist for ${faceKey}.`,
			};
			report.warnings.push(warning);
			return;
		}

		const alignmentMap = alignmentMapFromAlignmentMatches({
			tilesetId,
			faceKey,
			faceState,
			referenceSetId: referenceStructure.referenceSet?.referenceSetId || null,
			referenceFace: referenceStructure.faces?.[faceKey] || null,
			generatedOn,
		});
		const previousSemanticMap = semanticContextFromCanonicalState(faceState.state, faceKey);
		const semanticMap = assignSourceSemantics({
			tilesetId,
			faceKey,
			referenceSetId: referenceStructure.referenceSet?.referenceSetId || alignmentMap.referenceSetId || null,
			generatedOn,
			referenceFace: referenceStructure.faces?.[faceKey] || null,
			referenceStructurePath: this.normalizePath(referenceStructurePath),
			alignmentMapPath: pipelineModel.pipelineFilename
				? this.normalizePath(pipelineModel.pipelineFilename)
				: null,
			alignmentMap,
			previousSemanticMap,
		});

		pipelineModel.applySemanticAssignment(faceKey, modelAssignmentFromSemanticMap(faceKey, faceState.state, semanticMap));

		report.assignmentCount += semanticMap.assignments.length;
		report.diagnosticCount += semanticMap.diagnostics.length;
		report.faces[faceKey] = {
			status: semanticMap.status,
			assignmentCount: semanticMap.assignments.length,
			bindingCount: countBoundSourceSemanticBindings(semanticMap.bindings),
			diagnosticCount: semanticMap.diagnostics.length,
		};
	}

	/**
	 * Reads JSON from disk.
	 *
	 * @param {string} filePath - JSON path.
	 * @returns {Promise<unknown>} Parsed JSON payload.
	 */
	async readJson(filePath) {
		return JSON.parse(await this.fs.readFile(filePath, 'utf8'));
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

function alignmentMapFromAlignmentMatches({
	tilesetId,
	faceKey,
	faceState,
	referenceSetId,
	referenceFace,
	generatedOn,
}) {
	const diagnostics = [];
	const sourcePartMappings = [];
	const candidates = [];

	for (const [index, match] of (faceState.state?.alignment?.matches || []).entries()) {
		const referencePartIds = referencePartIdsForComponents(referenceFace, match.reference || []);
		const mappingId = `source-part-map.${match.id || `${faceKey}.${index + 1}`}`;

		if (referencePartIds.length !== 1) {
			diagnostics.push({
				level: 'warning',
				code: referencePartIds.length === 0
					? 'match-without-reference-part'
					: 'match-with-multiple-reference-parts',
				mappingId,
				alignmentId: match.id || null,
				referenceComponentIds: match.reference || [],
				referencePartIds,
				message: `Alignment match ${match.id || '(unknown)'} must resolve to exactly one reference part.`,
			});
		}

		const partId = referencePartIds[0] || null;
		const part = partId ? faceState.state?.parts?.[partId] || {} : {};
		const referencePart = partId ? referenceFace?.parts?.[partId] || null : null;
		const sourceComponentIds = uniqueValues(match.source || []);
		const referenceComponentIds = uniqueValues(match.reference || referencePart?.componentIds || []);

		candidates.push({
			alignmentId: match.id || mappingId,
			sourceComponentIds,
			referenceComponentIds,
			referencePartCandidates: referencePartIds,
			transform: match.transform || null,
			sourceBounds: match.sourceBounds || null,
			targetBounds: match.targetBounds || null,
			alignedBounds: match.alignedBounds || null,
		});

		sourcePartMappings.push({
			mappingId,
			sourcePartId: partId || `unresolved-${index + 1}`,
			role: part.role || referencePart?.role || null,
			contentKind: part.contentKind || referencePart?.contentKind || null,
			colorStrategy: part.colorStrategy || referencePart?.colorStrategy || null,
			sourceComponentIds,
			referencePartIds,
			referenceComponentIds,
			alignmentGroupId: null,
			alignmentIds: [match.id || mappingId],
			alignmentCandidateId: match.id || mappingId,
			matchStatus: 'matched',
			strategy: 'alignment-match',
			score: null,
			scoreKind: null,
			reviewStatus: reviewStatusForPart(faceState.state, partId),
			strength: strengthForPart(faceState.state, partId),
			provenance: 'alignment-match',
		});
	}

	return {
		schemaVersion: 1,
		tilesetId,
		faceKey,
		referenceSetId,
		generatedOn,
		status: diagnostics.some((diagnostic) => diagnostic.level === 'warning') ? 'needs-review' : 'inferred',
		sourcePartMappings,
		candidates,
		diagnostics,
	};
}

function referencePartIdsForComponents(referenceFace, referenceComponentIds) {
	const componentIdSet = new Set(referenceComponentIds || []);

	return Object.entries(referenceFace?.parts || {})
		.filter(([, part]) => (part.componentIds || []).some((componentId) => componentIdSet.has(componentId)))
		.map(([partId]) => partId)
		.sort((left, right) => left.localeCompare(right));
}

function reviewStatusForPart(faceState, partId) {
	if (!partId) {
		return 'needs-review';
	}

	const part = faceState?.parts?.[partId];
	if (part?.accepted) {
		return 'accepted';
	}

	return Object.values(faceState?.bindings || {})
		.filter((binding) => binding?.partId === partId)
		.reduce((status, binding) => strongestReviewedStatus(status, binding.strength === 'accepted' ? 'accepted' : null), null)
		|| 'inferred';
}

function strengthForPart(faceState, partId) {
	return Object.values(faceState?.bindings || {})
		.filter((binding) => binding?.partId === partId)
		.reduce((strength, binding) => strongestBindingStrength(strength, binding.strength || null), null)
		|| 'tentative';
}

function semanticContextFromCanonicalState(faceState, faceKey) {
	const bindings = {};
	const parts = {};

	for (const [componentId, binding] of Object.entries(faceState?.bindings || {})) {
		bindings[componentId] = {
			...(binding.partId ? { partId: binding.partId } : {}),
			source: binding.source || '',
			strength: canonicalSourceBindingStrength(binding.strength),
			reviewStatus: binding.reviewStatus || (binding.strength === 'accepted' || binding.strength === 'strong' ? 'reviewed' : binding.strength === 'none' ? 'needs-review' : 'inferred'),
			...(binding.updatedOn ? { updatedOn: binding.updatedOn } : {}),
		};
	}

	for (const [partId, part] of Object.entries(faceState?.parts || {})) {
		if (part?.accepted) {
			parts[partId] = {
				state: 'unbound',
				strength: 'none',
				source: 'part-review',
				reviewStatus: 'accepted',
				...(part.updatedOn ? { updatedOn: part.updatedOn } : {}),
			};
		}
	}

	return {
		bindings,
		parts,
		assignments: [],
	};
}

function modelAssignmentFromSemanticMap(faceKey, existingState, semanticMap) {
	const canonicalState = applyCanonicalSemanticAssignmentState(faceKey, existingState, semanticMap);
	const bindings = Object.fromEntries(Object.entries(canonicalState.bindings || {})
		.filter(([, binding]) => binding?.partId && binding.strength !== 'none')
		.map(([componentId, binding]) => [componentId, {
			componentId,
			partId: binding.partId,
			strength: binding.strength,
		}]));
	const parts = {};

	for (const [partId, part] of Object.entries(canonicalState.parts || {})) {
		parts[partId] = {
			...part,
		};
		delete parts[partId].sourceComponentIds;
		delete parts[partId].componentIds;
		delete parts[partId].semanticAssignmentId;
		delete parts[partId].source;
		delete parts[partId].strength;
		delete parts[partId].state;
		delete parts[partId].reason;
		delete parts[partId].updatedOn;
		delete parts[partId].acceptedOn;
	}

	return { parts, bindings };
}

function applyCanonicalSemanticAssignmentState(faceKey, faceState, semanticMap, generatedOn) {
	return {
		...(faceState || {}),
		bindings: canonicalBindingsFromSemanticAssignment(faceKey, faceState?.bindings || {}, faceState?.parts || {}, semanticMap, generatedOn),
		parts: canonicalPartsFromSemanticAssignment(faceState?.parts || {}, semanticMap, generatedOn),
	};
}

function canonicalBindingsFromSemanticAssignment(faceKey, existingBindings, existingParts, semanticMap, generatedOn) {
	const semanticComponentIds = new Set(Object.keys(semanticMap.bindings || {}));
	const nextBindings = Object.fromEntries(Object.entries(existingBindings || {})
		.filter(([componentId, binding]) => semanticComponentIds.has(componentId)
			|| acceptedPartBindingShouldBePreserved(existingParts, binding)
			|| (binding?.source && !isSemanticAssignmentBindingSource(binding.source))));

	for (const [componentId, binding] of Object.entries(semanticMap.bindings || {})) {
		const partId = typeof binding.partId === 'string' && binding.partId
			? binding.partId
			: null;
		if (!partId
			&& binding.strength === 'none'
			&& acceptedPartBindingShouldBePreserved(existingParts, nextBindings[componentId])) {
			continue;
		}
		if (acceptedPartBindingShouldBePreserved(existingParts, { ...binding, partId })) {
			continue;
		}

		const acceptedOptionalPart = existingParts?.[partId]?.accepted
			&& existingParts?.[partId]?.optional === true;
		nextBindings[componentId] = {
			...(nextBindings[componentId] || {}),
			componentId,
			partId,
			strength: acceptedOptionalPart
				? 'accepted'
				: strongestBindingStrength(nextBindings[componentId]?.strength, canonicalSourceBindingStrength(binding.strength)),
			source: binding.source || 'source-semantic-assignment',
			reviewStatus: acceptedOptionalPart
				? 'accepted'
				: strongestReviewedStatus(nextBindings[componentId]?.reviewStatus, binding.reviewStatus || null),
			semanticAssignmentId: semanticAssignmentIdForComponent(semanticMap.assignments || [], componentId),
			updatedOn: generatedOn,
		};
	}

	return nextBindings;
}

function acceptedPartBindingShouldBePreserved(existingParts, binding) {
	const part = binding?.partId ? existingParts?.[binding.partId] : null;

	return Boolean(part?.accepted);
}

function canonicalPartsFromSemanticAssignment(existingParts, semanticMap, generatedOn) {
	const nextParts = { ...(existingParts || {}) };
	const assignedPartIds = new Set((semanticMap.assignments || [])
		.map((assignment) => assignment.referencePartId)
		.filter(Boolean));

	for (const [partId, part] of Object.entries(nextParts)) {
		if (!assignedPartIds.has(partId)) {
			nextParts[partId] = { ...part };
		}
	}

	for (const assignment of semanticMap.assignments || []) {
		const partId = assignment.referencePartId;
		if (!partId) {
			continue;
		}

		const previousPart = nextParts[partId] || {
			partId,
			globalPartId: assignment.globalPartId || null,
			role: assignment.role || null,
			contentKind: assignment.contentKind || null,
			colorStrategy: assignment.colorStrategy || null,
		};
		if (!previousPart.colorStrategy && assignment.colorStrategy) {
			previousPart.colorStrategy = assignment.colorStrategy;
		}
		const partState = semanticMap.parts?.[partId] || sourcePartStateFromAssignment(assignment);
		const sourceComponentIds = uniqueValues(assignment.sourceComponentIds || []);
		const reviewStatus = assignment.reviewStatus || partState.reviewStatus || null;
		const {
			reviewStatus: previousReviewStatus,
			acceptedOn,
			accepted,
			alignmentSourceBounds,
			alignmentAlignedBounds,
			alignmentTransform,
			...previousPartWithoutReview
		} = previousPart;
		const nextReviewStatus = strongestReviewedStatus(previousReviewStatus, reviewStatus);

		nextParts[partId] = {
			...previousPartWithoutReview,
			...(sourceComponentIds.length > 0 ? {
				...(alignmentSourceBounds ? { alignmentSourceBounds } : {}),
				...(alignmentAlignedBounds ? { alignmentAlignedBounds } : {}),
				...(alignmentTransform ? { alignmentTransform } : {}),
			} : {}),
			...(accepted || nextReviewStatus === 'accepted'
				? { accepted: true }
				: {}),
			updatedOn: generatedOn,
		};
	}

	return nextParts;
}

function isSemanticAssignmentBindingSource(source) {
	return [
		'source-semantic-assignment',
		'alignment-source-part-mapping',
		'layered-overlap',
		'freeform-artwork',
		'gap',
		'part-completion-split',
		'source-part-state',
		'unmatched-reference-part',
	].includes(source);
}

function semanticAssignmentIdForComponent(assignments, componentId) {
	return assignments.find((assignment) => (assignment.sourceComponentIds || []).includes(componentId))?.assignmentId || null;
}

function sourcePartStateFromAssignment(assignment) {
	return {
		state: assignment.sourceComponentIds?.length > 0 ? 'bound' : 'unbound',
		strength: assignment.sourceComponentIds?.length > 0 ? assignment.strength || 'tentative' : 'none',
		source: assignment.strategy || 'source-semantic-assignment',
		reviewStatus: assignment.reviewStatus || (assignment.sourceComponentIds?.length > 0 ? 'inferred' : 'needs-review'),
		...(assignment.unboundReason ? { reason: assignment.unboundReason } : {}),
	};
}

function isOptionalPartForFace(faceKey, partId) {
	if (partId === 'label') {
		return true;
	}

	return partId === 'glyph' && ['flower', 'season'].includes(describeFace(faceKey).family);
}

function describeFace(faceKey) {
	const match = /^([a-z-]+?)(?:-(\d+|[a-z]))?$/.exec(faceKey);
	return {
		faceKey,
		family: match?.[1] || faceKey,
		index: match?.[2] || null,
	};
}

function canonicalSourceBindingStrength(strength) {
	if (strength === 'strong' || strength === 'accepted') {
		return strength;
	}
	if (strength === 'none') {
		return 'none';
	}
	if (strength === 'tentative') {
		return 'tentative';
	}

	throw new Error(`Invalid canonical source binding strength: ${strength || '(missing)'}`);
}

function strongestBindingStrength(leftStrength, rightStrength) {
	const rank = {
		none: 0,
		tentative: 1,
		strong: 2,
		accepted: 3,
	};
	const leftRank = rank[leftStrength] ?? -1;
	const rightRank = rank[rightStrength] ?? -1;

	return leftRank >= rightRank ? leftStrength : rightStrength;
}

function strongestReviewedStatus(leftStatus, rightStatus) {
	const rank = {
		'needs-review': 0,
		inferred: 1,
		reviewed: 2,
		accepted: 3,
	};
	const leftRank = rank[leftStatus] ?? -1;
	const rightRank = rank[rightStatus] ?? -1;

	return leftRank >= rightRank ? leftStatus : rightStatus;
}

/**
 * Converts alignment source-part mappings into source semantic assignments.
 *
 * @param {SourceSemanticAssignmentFaceOptions} options - Face-level assignment inputs.
 * @returns {SourceSemanticMapArtifact} Semantic-map artifact for the face.
 */
export function assignSourceSemantics({
	tilesetId,
	faceKey,
	referenceSetId = null,
	generatedOn,
	referenceFace = null,
	referenceStructurePath = null,
	alignmentMapPath = null,
	alignmentMap,
	previousSemanticMap = null,
}) {
	const diagnostics = [];
	const assignmentsByReferencePartId = new Map();
	const sourceSemanticBindings = {};
	const sourceSemanticPartStates = {};
	const previousBindingRecords = previousSemanticMap?.bindings || {};
	const previousPartStates = previousSemanticMap?.parts || {};

	for (const mapping of alignmentMap.sourcePartMappings || []) {
		const referencePartIds = uniqueValues(mapping.referencePartIds || []);

		if (referencePartIds.length === 0) {
			diagnostics.push({
				level: 'warning',
				code: 'mapping-without-reference-part',
				mappingId: mapping.mappingId || null,
				message: `Source part mapping ${mapping.mappingId || '(unknown)'} does not name a reference part.`,
			});
			continue;
		}

		for (const referencePartId of referencePartIds) {
			const referencePart = referenceFace?.parts?.[referencePartId] || null;
			if (referencePart?.allowEmpty && uniqueValues(mapping.sourceComponentIds || []).length === 0) {
				continue;
			}
			const previousPartState = previousPartStates[referencePartId];
			const previousStrongComponentIds = strongComponentIdsForPart(previousBindingRecords, referencePartId);
			const rebindingComponentIds = availableMappingComponentIds(mapping, previousBindingRecords, referencePartId);

			if (previousPartState?.reviewStatus === 'accepted') {
				sourceSemanticPartStates[referencePartId] = normalizeSourceSemanticPartState(previousPartState);
				continue;
			}

			if (previousPartState?.state === 'unbound'
				&& rebindingComponentIds.length === 0
				&& !referenceFace?.parts?.[referencePartId]?.allowEmpty) {
				const assignment = assignmentFromBindingRecord({
					faceKey,
					referencePartId,
					referencePart: referenceFace?.parts?.[referencePartId] || null,
					partState: previousPartState,
					previousAssignment: previousAssignmentForPart(previousSemanticMap, referencePartId),
					blockedMappingId: mapping.mappingId || null,
				});

				assignmentsByReferencePartId.set(referencePartId, assignment);
				sourceSemanticPartStates[referencePartId] = normalizeSourceSemanticPartState(previousPartState);
				continue;
			}

			const assignmentMapping = previousPartState?.state === 'unbound'
				? {
					...mapping,
					sourceComponentIds: rebindingComponentIds,
				}
				: mapping;
			let assignment = assignmentFromMapping({
				faceKey,
				referencePartId,
				referencePart,
				mapping: assignmentMapping,
				diagnostics,
			});
			if (previousStrongComponentIds.length > 0) {
				assignment = {
					...assignment,
					sourceComponentIds: previousStrongComponentIds,
					strength: 'strong',
					reviewStatus: 'reviewed',
					strategy: 'manual',
					provenance: {
						...assignment.provenance,
						source: 'manual-binding',
					},
				};
			}

			const existingAssignment = assignmentsByReferencePartId.get(referencePartId);
			assignmentsByReferencePartId.set(
				referencePartId,
				existingAssignment ? mergeAssignments(existingAssignment, assignment) : assignment,
			);

		}
	}

	for (const [referencePartId, componentIds] of strongComponentIdsByPart(previousBindingRecords)) {
		if (assignmentsByReferencePartId.has(referencePartId)) {
			continue;
		}
		if (previousPartStates[referencePartId]?.reviewStatus === 'accepted') {
			sourceSemanticPartStates[referencePartId] = normalizeSourceSemanticPartState(previousPartStates[referencePartId]);
			continue;
		}

		assignmentsByReferencePartId.set(referencePartId, assignmentFromStrongBindingRecords({
			faceKey,
			referencePartId,
			referencePart: referenceFace?.parts?.[referencePartId] || null,
			componentIds,
			previousSemanticMap,
			previousBindingRecords,
		}));
	}

	const unmatchedReferenceComponentIds = new Set((alignmentMap.diagnostics || [])
		.filter((diagnostic) => diagnostic.code === 'unmatched-reference-components')
		.flatMap((diagnostic) => diagnostic.referenceComponentIds || []));

	for (const [referencePartId, referencePart] of Object.entries(referenceFace?.parts || {})) {
		if (assignmentsByReferencePartId.has(referencePartId) || referencePart?.allowEmpty) {
			continue;
		}
		if (previousPartStates[referencePartId]?.reviewStatus === 'accepted') {
			sourceSemanticPartStates[referencePartId] = normalizeSourceSemanticPartState(previousPartStates[referencePartId]);
			continue;
		}
		const referenceComponentIds = uniqueValues(referencePart.componentIds || []);
		if (!referenceComponentIds.some((componentId) => unmatchedReferenceComponentIds.has(componentId))) {
			continue;
		}

		const assignment = assignmentFromUnmatchedReferencePart({
			faceKey,
			referencePartId,
			referencePart,
		});
		assignmentsByReferencePartId.set(referencePartId, assignment);
		sourceSemanticPartStates[referencePartId] = {
			state: 'unbound',
			strength: 'none',
			source: assignment.strategy,
			reviewStatus: 'needs-review',
			reason: assignment.unboundReason,
		};
		diagnostics.push({
			level: 'warning',
			code: 'unmatched-reference-part',
			referencePartId,
			referenceComponentIds,
			message: `Reference part ${referencePartId} has no source assignment mapping.`,
		});
	}

	for (const [referencePartId, partState] of Object.entries(previousPartStates)) {
		if (assignmentsByReferencePartId.has(referencePartId) || !partState) {
			continue;
		}
		if (referenceFace?.parts?.[referencePartId]?.allowEmpty) {
			continue;
		}
		if (partState.reviewStatus === 'accepted') {
			sourceSemanticPartStates[referencePartId] = normalizeSourceSemanticPartState(partState);
			continue;
		}
		if (partState.state === 'bound') {
			continue;
		}

		assignmentsByReferencePartId.set(referencePartId, assignmentFromBindingRecord({
			faceKey,
			referencePartId,
			referencePart: referenceFace?.parts?.[referencePartId] || null,
			partState,
			previousAssignment: previousAssignmentForPart(previousSemanticMap, referencePartId),
		}));
		sourceSemanticPartStates[referencePartId] = normalizeSourceSemanticPartState(partState);
	}

	const assignments = [...assignmentsByReferencePartId.values()];
	for (const assignment of assignments) {
		const { bindings, partState } = bindingRecordsFromAssignment(assignment);
		Object.assign(sourceSemanticBindings, bindings);
		if (partState) {
			sourceSemanticPartStates[assignment.referencePartId] = partState;
		}
	}
	for (const componentId of allAlignmentSourceComponentIds(alignmentMap)) {
		if (!sourceSemanticBindings[componentId]) {
			sourceSemanticBindings[componentId] = {
				source: '',
				strength: 'none',
				reviewStatus: 'needs-review',
			};
		}
	}
	const sourceSemanticComponents = Object.fromEntries(Object.keys(sourceSemanticBindings)
		.sort((left, right) => left.localeCompare(right))
		.map((componentId) => [componentId, { componentId }]));
	const status = diagnostics.some((diagnostic) => diagnostic.level === 'warning')
		|| assignments.some((assignment) => assignment.reviewStatus === 'needs-review')
		? 'needs-review'
		: 'inferred';

	return {
		schemaVersion: 1,
		tilesetId,
		faceKey,
		referenceSetId,
		generatedOn,
		status,
		inputs: {
			alignmentMap: {
				path: alignmentMapPath,
				status: alignmentMap.status || null,
				generatedOn: alignmentMap.generatedOn || null,
			},
			referenceStructure: {
				path: referenceStructurePath,
			},
		},
		bindings: sourceSemanticBindings,
		parts: sourceSemanticPartStates,
		components: sourceSemanticComponents,
		summary: {
			assignmentCount: assignments.length,
			bindingCount: countBoundSourceSemanticBindings(sourceSemanticBindings),
			diagnosticCount: diagnostics.length,
		},
		assignments,
		diagnostics,
	};
}

function mergeAssignments(existingAssignment, nextAssignment) {
	const sourceComponentIds = uniqueValues([
		...existingAssignment.sourceComponentIds,
		...nextAssignment.sourceComponentIds,
	]);
	const referenceComponentIds = uniqueValues([
		...existingAssignment.referenceComponentIds,
		...nextAssignment.referenceComponentIds,
	]);
	const alignmentIds = uniqueValues([
		...existingAssignment.alignmentIds,
		...nextAssignment.alignmentIds,
	]);
	const assignmentType = 'source';

	return {
		...existingAssignment,
		sourceComponentIds,
		referenceComponentIds,
		alignmentIds,
		alignmentCandidateId: existingAssignment.alignmentCandidateId || nextAssignment.alignmentCandidateId,
		assignmentType,
		strength: strongestAssignmentStrength(existingAssignment.strength, nextAssignment.strength, sourceComponentIds.length),
		strategy: uniqueValues([existingAssignment.strategy, nextAssignment.strategy]).join('+') || existingAssignment.strategy,
		score: existingAssignment.score ?? nextAssignment.score,
		scoreKind: existingAssignment.scoreKind ?? nextAssignment.scoreKind,
		reviewStatus: existingAssignment.reviewStatus === 'needs-review' || nextAssignment.reviewStatus === 'needs-review'
			? 'needs-review'
			: existingAssignment.reviewStatus,
		provenance: {
			...existingAssignment.provenance,
			mappingIds: uniqueValues([
				...(existingAssignment.provenance?.mappingIds || []),
				existingAssignment.provenance?.mappingId,
				...(nextAssignment.provenance?.mappingIds || []),
				nextAssignment.provenance?.mappingId,
			]),
		},
	};
}

function assignmentFromMapping({
	faceKey,
	referencePartId,
	referencePart,
	mapping,
	diagnostics,
}) {
	const sourceComponentIds = uniqueValues(mapping.sourceComponentIds || []);
	const assignmentType = 'source';
	const needsReview = sourceComponentIds.length === 0;

	if (needsReview) {
		diagnostics.push({
			level: 'warning',
			code: 'unbound-source-assignment',
			mappingId: mapping.mappingId || null,
			referencePartId,
			message: `Reference part ${referencePartId} has no source components from ${mapping.mappingId || 'its alignment mapping'}.`,
		});
	}

	return {
		assignmentId: `assign.${faceKey}.${referencePartId}`,
		sourcePartId: mapping.sourcePartId || referencePartId,
		referencePartId,
		globalPartId: referencePart?.globalPartId || null,
		role: mapping.role || referencePart?.role || null,
		contentKind: mapping.contentKind || referencePart?.contentKind || null,
		colorStrategy: mapping.colorStrategy || referencePart?.colorStrategy || null,
		sourceComponentIds,
		referenceComponentIds: uniqueValues(mapping.referenceComponentIds || referencePart?.componentIds || []),
		alignmentGroupId: mapping.alignmentGroupId || null,
		alignmentIds: uniqueValues(mapping.alignmentIds || []),
		alignmentCandidateId: mapping.alignmentCandidateId || null,
		assignmentType,
		strength: assignmentType === 'source' && sourceComponentIds.length > 0
			? normalizeAssignmentStrength(mapping.strength || 'tentative')
			: 'none',
		strategy: mapping.strategy || 'alignment-source-part-mapping',
		score: mapping.score ?? null,
		scoreKind: mapping.scoreKind ?? null,
		identityResolver: mapping.identityResolver || null,
		reviewStatus: needsReview ? 'needs-review' : (mapping.reviewStatus || 'inferred'),
		provenance: {
			stage: 'source-semantic-assignment',
			source: 'alignment-source-part-mapping',
			mappingId: mapping.mappingId || null,
			mappingProvenance: mapping.provenance || null,
			matchStatus: mapping.matchStatus || null,
		},
	};
}

function previousAssignmentForPart(previousSemanticMap, referencePartId) {
	return (previousSemanticMap?.assignments || [])
		.find((assignment) => assignment.referencePartId === referencePartId) || null;
}

function assignmentFromBindingRecord({
	faceKey,
	referencePartId,
	referencePart,
	partState,
	previousAssignment = null,
	blockedMappingId = null,
}) {
	const normalizedPartState = normalizeSourceSemanticPartState(partState);
	const assignmentType = 'source';
	const { bindingStrength, ...previousAssignmentFields } = previousAssignment || {};

	return {
		...previousAssignmentFields,
		assignmentId: previousAssignment?.assignmentId || `assign.${faceKey}.${referencePartId}`,
		sourcePartId: normalizedPartState.state === 'unbound'
			? referencePartId
			: previousAssignment?.sourcePartId || referencePartId,
		referencePartId,
		globalPartId: previousAssignment?.globalPartId || referencePart?.globalPartId || null,
		role: previousAssignment?.role || referencePart?.role || null,
		contentKind: previousAssignment?.contentKind || referencePart?.contentKind || null,
		colorStrategy: previousAssignment?.colorStrategy || referencePart?.colorStrategy || null,
		sourceComponentIds: [],
		referenceComponentIds: uniqueValues(previousAssignment?.referenceComponentIds || referencePart?.componentIds || []),
		assignmentType,
		strength: 'none',
		strategy: 'source-part-state',
		reviewStatus: normalizedPartState.reviewStatus,
		...(normalizedPartState.state === 'unbound' ? {
			unboundReason: normalizedPartState.reason || previousAssignment?.unboundReason || 'manual',
		} : {}),
		provenance: {
			...(previousAssignment?.provenance || {}),
			stage: 'source-semantic-assignment',
			source: 'part-state',
			...(blockedMappingId ? { blockedMappingId } : {}),
		},
	};
}

function assignmentFromUnmatchedReferencePart({
	faceKey,
	referencePartId,
	referencePart,
}) {
	return {
		assignmentId: `assign.${faceKey}.${referencePartId}`,
		sourcePartId: referencePartId,
		referencePartId,
		globalPartId: referencePart?.globalPartId || null,
		role: referencePart?.role || null,
		contentKind: referencePart?.contentKind || null,
		colorStrategy: referencePart?.colorStrategy || null,
		sourceComponentIds: [],
		referenceComponentIds: uniqueValues(referencePart?.componentIds || []),
		assignmentType: 'source',
		strength: 'none',
		strategy: 'unmatched-reference-part',
		reviewStatus: 'needs-review',
		unboundReason: 'unmatched-reference-part',
		provenance: {
			stage: 'source-semantic-assignment',
			source: 'unmatched-reference-part',
		},
	};
}

function assignmentFromStrongBindingRecords({
	faceKey,
	referencePartId,
	referencePart,
	componentIds,
	previousSemanticMap,
	previousBindingRecords,
}) {
	const previousAssignment = previousAssignmentForPart(previousSemanticMap, referencePartId);
	const bindingStrength = strongestBindingStrengthForComponents(previousBindingRecords, componentIds);

	return {
		...(previousAssignment || {}),
		assignmentId: previousAssignment?.assignmentId || `assign.${faceKey}.${referencePartId}`,
		sourcePartId: previousAssignment?.sourcePartId || referencePartId,
		referencePartId,
		globalPartId: previousAssignment?.globalPartId || referencePart?.globalPartId || null,
		role: previousAssignment?.role || referencePart?.role || null,
		contentKind: previousAssignment?.contentKind || referencePart?.contentKind || null,
		sourceComponentIds: uniqueValues(componentIds),
		referenceComponentIds: uniqueValues(previousAssignment?.referenceComponentIds || referencePart?.componentIds || []),
		assignmentType: 'source',
		strength: bindingStrength,
		strategy: 'manual',
		reviewStatus: 'reviewed',
		provenance: {
			...(previousAssignment?.provenance || {}),
			stage: 'source-semantic-assignment',
			source: 'manual-binding-preserved',
		},
	};
}

function bindingRecordsFromAssignment(assignment) {
	if ((assignment.sourceComponentIds || []).length > 0) {
		return {
			bindings: Object.fromEntries(uniqueValues(assignment.sourceComponentIds || []).map((componentId) => [componentId, {
				partId: assignment.referencePartId,
				strength: normalizeAssignmentStrength(assignment.strength),
				reviewStatus: assignment.reviewStatus || 'inferred',
				source: assignment.strategy || 'alignment-source-part-mapping',
			}])),
			partState: {
				state: 'bound',
				strength: normalizeAssignmentStrength(assignment.strength),
				source: assignment.strategy || 'alignment-source-part-mapping',
				reviewStatus: assignment.reviewStatus || 'inferred',
			},
		};
	}

	return {
		bindings: {},
		partState: {
			state: 'unbound',
			strength: 'none',
			source: assignment.strategy || '',
			reviewStatus: assignment.reviewStatus || 'needs-review',
			reason: assignment.unboundReason || 'source-assignment-draft',
		},
	};
}

function normalizeSourceSemanticPartState(partState) {
	if (!partState || typeof partState !== 'object' || Array.isArray(partState)) {
		return {
			state: 'unbound',
			strength: 'none',
			reviewStatus: 'needs-review',
		};
	}

	return {
		state: 'unbound',
		strength: 'none',
		reviewStatus: partState.reviewStatus || 'needs-review',
		...(partState.reason ? { reason: partState.reason } : {}),
	};
}

function countBoundSourceSemanticBindings(bindings) {
	return Object.values(bindings || {})
		.filter((binding) => binding?.partId && binding.strength !== 'none')
		.length;
}

function strongComponentIdsForPart(bindings, partId) {
	return Object.entries(bindings || {})
		.filter(([, binding]) => binding?.partId === partId && (binding.strength === 'strong' || binding.strength === 'accepted'))
		.map(([componentId]) => componentId);
}

function strongComponentIdsByPart(bindings) {
	const byPart = new Map();

	for (const [componentId, binding] of Object.entries(bindings || {})) {
		if (!binding?.partId || !['strong', 'accepted'].includes(binding.strength)) {
			continue;
		}

		const componentIds = byPart.get(binding.partId) || [];
		componentIds.push(componentId);
		byPart.set(binding.partId, componentIds);
	}

	return byPart;
}

function strongestBindingStrengthForComponents(bindings, componentIds) {
	return componentIds.some((componentId) => bindings?.[componentId]?.strength === 'accepted')
		? 'accepted'
		: 'strong';
}

function availableMappingComponentIds(mapping, bindings, partId) {
	return uniqueValues(mapping?.sourceComponentIds || [])
		.filter((componentId) => {
			const binding = bindings?.[componentId];

			return !binding?.partId || binding.partId === partId || !['strong', 'accepted'].includes(binding.strength);
		});
}

function allAlignmentSourceComponentIds(alignmentMap) {
	return uniqueValues([
		...(alignmentMap.sourcePartMappings || []).flatMap((mapping) => mapping.sourceComponentIds || []),
		...(alignmentMap.alignmentGroups || []).flatMap((group) => group.sourceComponentIds || []),
		...(alignmentMap.candidates || []).flatMap((candidate) => candidate.sourceComponentIds || []),
	]).sort((left, right) => left.localeCompare(right));
}

function normalizeAssignmentStrength(strength) {
	if (['none', 'tentative', 'strong', 'accepted'].includes(strength)) {
		return strength;
	}

	throw new Error(`Invalid source semantic assignment strength: ${strength || '(missing)'}`);
}

function strongestAssignmentStrength(leftStrength, rightStrength, sourceComponentCount) {
	if (leftStrength === 'accepted' || rightStrength === 'accepted') {
		return 'accepted';
	}
	if (leftStrength === 'strong' || rightStrength === 'strong') {
		return 'strong';
	}

	return sourceComponentCount > 0 ? 'tentative' : 'none';
}

function uniqueValues(values) {
	return [...new Set((values || []).filter((value) => value !== null && value !== undefined && value !== ''))];
}
