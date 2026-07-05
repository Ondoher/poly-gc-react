// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.2.1.
// - agents/topics/apps/flat/reconciliation/shader-test-design.md, objective test inventory.
// - agents/topics/apps/flat/reconciliation/shader-design.md, GPU validation scene set.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';

const VALID_INVENTORY_KIND = 'shader-validation-scene-inventory';
const VALID_SCENE_KINDS = Object.freeze(['objective', 'subjective']);
const VALID_STATUSES = Object.freeze(['planned', 'implemented', 'accepted', 'deferred']);
const VALID_IMPLEMENTATION_KINDS = Object.freeze(['node-three', 'json-fixture', 'browser-three', 'runner-policy']);

export default class ShaderSceneRegistry {
    /**
     * @param {ShaderValidationSceneInventory} inventory - Scene inventory data.
     */
    constructor(inventory) {
        this._inventory = this._normalizeInventory(inventory);
        this._scenesById = new Map(this._inventory.scenes.map((scene) => [scene.sceneId, scene]));
    }

    /**
     * @returns {readonly ShaderValidationSceneDescriptor[]} All scene descriptors.
     */
    listScenes() {
        return this._inventory.scenes;
    }

    /**
     * @returns {readonly ShaderValidationSceneDescriptor[]} Objective scenes.
     */
    listObjectiveScenes() {
        return Object.freeze(this._inventory.scenes.filter((scene) => scene.sceneKind === 'objective'));
    }

    /**
     * @param {string} milestoneId - Milestone id such as M3.
     * @returns {readonly ShaderValidationSceneDescriptor[]} Scenes active for the milestone.
     */
    listScenesForMilestone(milestoneId) {
        return Object.freeze(this._inventory.scenes.filter((scene) =>
            scene.activeMilestones.includes(milestoneId)));
    }

    /**
     * @returns {readonly ShaderSubjectiveSceneLineageDescriptor[]} Subjective review lineage descriptors.
     */
    listSubjectiveLineage() {
        return this._inventory.subjectiveLineage;
    }

    /**
     * @param {string} sceneId - Scene id.
     * @returns {ShaderValidationSceneDescriptor} Scene descriptor.
     */
    getScene(sceneId) {
        const scene = this._scenesById.get(sceneId);
        if (!scene) {
            throw new ReconciliationConfigurationError('Unknown shader validation scene id.', {
                code: 'UNKNOWN_SHADER_VALIDATION_SCENE',
                details: { sceneId },
            });
        }

        return scene;
    }

    /**
     * @returns {ShaderSceneRegistryValidationReport} Inventory validation summary.
     */
    validate() {
        const objectiveScenes = this.listObjectiveScenes();
        const objectiveTestIds = new Set();
        const pendingExternalNumericRgbaSceneIds = new Set();

        for (const scene of this._inventory.scenes) {
            if (scene.requiresLiveBrowserForDescriptor === true) {
                throw new ReconciliationConfigurationError('Scene descriptors must not require live browser state.', {
                    code: 'SCENE_DESCRIPTOR_REQUIRES_LIVE_BROWSER',
                    details: { sceneId: scene.sceneId },
                });
            }

            if (scene.sceneKind === 'objective') {
                this._validateObjectiveScene(scene);
            }

            for (const testId of scene.objectiveTestIds) {
                objectiveTestIds.add(testId);
            }

            if (scene.expectedDisplayPixelClaims.some((claim) =>
                claim.expectedValueSource.finalNumericRgbaStatus === 'pending-external-source')) {
                pendingExternalNumericRgbaSceneIds.add(scene.sceneId);
            }
        }

        return Object.freeze({
            sceneCount: this._inventory.scenes.length,
            objectiveSceneCount: objectiveScenes.length,
            subjectiveSceneCount: this._inventory.scenes.filter((scene) => scene.sceneKind === 'subjective').length,
            acceptedSceneCount: this._inventory.scenes.filter((scene) => scene.status === 'accepted').length,
            plannedSceneCount: this._inventory.scenes.filter((scene) => scene.status === 'planned').length,
            objectiveTestIds: Object.freeze([...objectiveTestIds].sort()),
            objectiveScenesRequiredBeforeGpuCount: objectiveScenes.filter((scene) =>
                scene.objectiveCriteria.some((criterion) => criterion.requiredBeforeGpuObjectiveRuns)).length,
            pendingExternalNumericRgbaSceneIds: Object.freeze([...pendingExternalNumericRgbaSceneIds].sort()),
        });
    }

    /**
     * @param {ShaderValidationSceneInventory} inventory - Raw inventory.
     * @returns {ShaderValidationSceneInventory} Normalized inventory.
     */
    _normalizeInventory(inventory) {
        if (!inventory || typeof inventory !== 'object') {
            throw new ReconciliationConfigurationError('Shader scene inventory is required.', {
                code: 'MISSING_SHADER_SCENE_INVENTORY',
            });
        }

        if (inventory.kind !== VALID_INVENTORY_KIND) {
            throw new ReconciliationConfigurationError('Invalid shader scene inventory kind.', {
                code: 'INVALID_SHADER_SCENE_INVENTORY_KIND',
                details: { kind: inventory.kind },
            });
        }

        if (!Number.isInteger(inventory.version) || inventory.version <= 0) {
            throw new ReconciliationConfigurationError('Shader scene inventory version must be positive.', {
                code: 'INVALID_SHADER_SCENE_INVENTORY_VERSION',
                details: { version: inventory.version },
            });
        }

        if (!Array.isArray(inventory.scenes) || inventory.scenes.length === 0) {
            throw new ReconciliationConfigurationError('Shader scene inventory requires scenes.', {
                code: 'MISSING_SHADER_SCENE_INVENTORY_SCENES',
            });
        }

        const seenSceneIds = new Set();
        const scenes = inventory.scenes.map((scene) => {
            const normalized = this._normalizeScene(scene);
            if (seenSceneIds.has(normalized.sceneId)) {
                throw new ReconciliationConfigurationError('Duplicate shader validation scene id.', {
                    code: 'DUPLICATE_SHADER_VALIDATION_SCENE_ID',
                    details: { sceneId: normalized.sceneId },
                });
            }
            seenSceneIds.add(normalized.sceneId);
            return normalized;
        });

        return Object.freeze({
            kind: inventory.kind,
            version: inventory.version,
            sourceDocument: this._requireString(inventory.sourceDocument, 'sourceDocument'),
            scenes: Object.freeze(scenes),
            subjectiveLineage: this._normalizeSubjectiveLineage(inventory.subjectiveLineage ?? []),
        });
    }

    /**
     * @param {unknown} scene - Raw scene descriptor.
     * @returns {ShaderValidationSceneDescriptor} Normalized scene descriptor.
     */
    _normalizeScene(scene) {
        if (!scene || typeof scene !== 'object') {
            throw new ReconciliationConfigurationError('Shader validation scene descriptor must be an object.', {
                code: 'INVALID_SHADER_VALIDATION_SCENE',
            });
        }

        const sceneId = this._requireString(scene.sceneId, 'sceneId');
        const sceneKind = this._requireOneOf(scene.sceneKind, VALID_SCENE_KINDS, 'sceneKind', sceneId);
        const status = this._requireOneOf(scene.status, VALID_STATUSES, 'status', sceneId);
        const implementationKind = this._requireOneOf(
            scene.implementationKind,
            VALID_IMPLEMENTATION_KINDS,
            'implementationKind',
            sceneId,
        );
        const selectedPixels = Array.isArray(scene.selectedPixels)
            ? Object.freeze(scene.selectedPixels.map((pixel) => this._normalizeSelectedPixel(pixel, sceneId)))
            : Object.freeze([]);
        const controlledRegionIds = this._normalizeStringArray(scene.controlledRegionIds ?? [], 'controlledRegionIds', sceneId);
        const objectiveCriteria = this._normalizeObjectiveCriteria(scene.objectiveCriteria ?? [], sceneId);
        const expectedDisplayPixelClaims = this._normalizeClaims(scene.expectedDisplayPixelClaims, sceneId);

        if (status === 'accepted' && !scene.acceptedRecord) {
            throw new ReconciliationConfigurationError('Accepted scene descriptor requires acceptedRecord.', {
                code: 'ACCEPTED_SCENE_MISSING_RECORD',
                details: { sceneId },
            });
        }

        return Object.freeze({
            sceneId,
            sceneKind,
            status,
            implementationKind,
            moduleId: scene.moduleId ?? null,
            activeMilestones: this._normalizeStringArray(scene.activeMilestones, 'activeMilestones', sceneId),
            sourceDescriptorId: this._requireString(scene.sourceDescriptorId, 'sourceDescriptorId', sceneId),
            geometryDescriptorId: this._requireString(scene.geometryDescriptorId, 'geometryDescriptorId', sceneId),
            atmosphereDescriptorId: this._requireString(scene.atmosphereDescriptorId, 'atmosphereDescriptorId', sceneId),
            lightSourceDescriptorId: this._requireString(scene.lightSourceDescriptorId, 'lightSourceDescriptorId', sceneId),
            cacheDescriptorId: scene.cacheDescriptorId ?? null,
            displayDescriptorId: this._requireString(scene.displayDescriptorId, 'displayDescriptorId', sceneId),
            viewportPixels: this._normalizeViewport(scene.viewportPixels, sceneId),
            selectedPixels,
            controlledRegionIds,
            objectiveTestIds: this._normalizeStringArray(scene.objectiveTestIds, 'objectiveTestIds', sceneId),
            objectiveCriteria,
            provenanceIds: this._normalizeStringArray(scene.provenanceIds, 'provenanceIds', sceneId),
            extentTags: this._normalizeStringArray(scene.extentTags, 'extentTags', sceneId),
            expectedDisplayPixelClaims,
            acceptedRecord: scene.acceptedRecord ?? null,
            notes: scene.notes ?? null,
            requiresLiveBrowserForDescriptor: scene.requiresLiveBrowserForDescriptor ?? false,
        });
    }

    /**
     * @param {ShaderValidationSceneDescriptor} scene - Objective scene.
     * @returns {void}
     */
    _validateObjectiveScene(scene) {
        if (scene.objectiveTestIds.length === 0) {
            throw new ReconciliationConfigurationError('Objective scene requires objectiveTestIds.', {
                code: 'OBJECTIVE_SCENE_MISSING_TEST_IDS',
                details: { sceneId: scene.sceneId },
            });
        }

        if (scene.objectiveCriteria.length === 0) {
            throw new ReconciliationConfigurationError('Objective scene requires objectiveCriteria.', {
                code: 'OBJECTIVE_SCENE_MISSING_CRITERIA',
                details: { sceneId: scene.sceneId },
            });
        }

        if (scene.provenanceIds.length === 0) {
            throw new ReconciliationConfigurationError('Objective scene requires provenanceIds.', {
                code: 'OBJECTIVE_SCENE_MISSING_PROVENANCE_IDS',
                details: { sceneId: scene.sceneId },
            });
        }

        if (scene.extentTags.length === 0) {
            throw new ReconciliationConfigurationError('Objective scene requires extentTags.', {
                code: 'OBJECTIVE_SCENE_MISSING_EXTENT_TAGS',
                details: { sceneId: scene.sceneId },
            });
        }

        if (scene.selectedPixels.length === 0 && scene.controlledRegionIds.length === 0) {
            throw new ReconciliationConfigurationError('Objective scene requires selected pixels or controlled regions.', {
                code: 'OBJECTIVE_SCENE_MISSING_PIXEL_TARGETS',
                details: { sceneId: scene.sceneId },
            });
        }

        if (scene.expectedDisplayPixelClaims.length === 0) {
            throw new ReconciliationConfigurationError('Objective scene requires expected display pixel claims.', {
                code: 'OBJECTIVE_SCENE_MISSING_PIXEL_CLAIMS',
                details: { sceneId: scene.sceneId },
            });
        }
    }

    /**
     * @param {unknown} criteria - Raw objective criteria.
     * @param {string} sceneId - Scene id.
     * @returns {readonly ShaderValidationObjectiveCriterion[]} Normalized objective criteria.
     */
    _normalizeObjectiveCriteria(criteria, sceneId) {
        if (!Array.isArray(criteria)) {
            throw new ReconciliationConfigurationError('Objective criteria must be an array.', {
                code: 'INVALID_OBJECTIVE_CRITERIA',
                details: { sceneId },
            });
        }

        return Object.freeze(criteria.map((criterion) => {
            if (!criterion || typeof criterion !== 'object') {
                throw new ReconciliationConfigurationError('Objective criterion must be an object.', {
                    code: 'INVALID_OBJECTIVE_CRITERION',
                    details: { sceneId },
                });
            }

            if (typeof criterion.requiredBeforeGpuObjectiveRuns !== 'boolean') {
                throw new ReconciliationConfigurationError('Objective criterion requires requiredBeforeGpuObjectiveRuns.', {
                    code: 'INVALID_OBJECTIVE_CRITERION_REQUIRED_FLAG',
                    details: { sceneId, criterionId: criterion.criterionId ?? null },
                });
            }

            return Object.freeze({
                criterionId: this._requireString(criterion.criterionId, 'objectiveCriteria.criterionId', sceneId),
                claim: this._requireString(criterion.claim, 'objectiveCriteria.claim', sceneId),
                measurement: this._requireString(criterion.measurement, 'objectiveCriteria.measurement', sceneId),
                owner: this._requireString(criterion.owner, 'objectiveCriteria.owner', sceneId),
                failureClassification: this._requireString(
                    criterion.failureClassification,
                    'objectiveCriteria.failureClassification',
                    sceneId,
                ),
                requiredBeforeGpuObjectiveRuns: criterion.requiredBeforeGpuObjectiveRuns,
            });
        }));
    }

    /**
     * @param {unknown} lineageRows - Raw subjective lineage rows.
     * @returns {readonly ShaderSubjectiveSceneLineageDescriptor[]} Normalized subjective lineage rows.
     */
    _normalizeSubjectiveLineage(lineageRows) {
        if (!Array.isArray(lineageRows)) {
            throw new ReconciliationConfigurationError('Subjective lineage must be an array.', {
                code: 'INVALID_SUBJECTIVE_LINEAGE',
            });
        }

        const seenLineageIds = new Set();

        return Object.freeze(lineageRows.map((row) => {
            if (!row || typeof row !== 'object') {
                throw new ReconciliationConfigurationError('Subjective lineage row must be an object.', {
                    code: 'INVALID_SUBJECTIVE_LINEAGE_ROW',
                });
            }

            const lineageId = this._requireString(row.lineageId, 'subjectiveLineage.lineageId');
            if (seenLineageIds.has(lineageId)) {
                throw new ReconciliationConfigurationError('Duplicate subjective lineage id.', {
                    code: 'DUPLICATE_SUBJECTIVE_LINEAGE_ID',
                    details: { lineageId },
                });
            }
            seenLineageIds.add(lineageId);

            return Object.freeze({
                lineageId,
                recordPath: this._requireString(row.recordPath, 'subjectiveLineage.recordPath', lineageId),
                sourceSceneId: this._requireString(row.sourceSceneId, 'subjectiveLineage.sourceSceneId', lineageId),
                reviewStatus: this._requireOneOf(
                    row.reviewStatus,
                    ['active-first-gpu-review', 'deferred-local-flat-follow-on', 'excluded'],
                    'subjectiveLineage.reviewStatus',
                    lineageId,
                ),
                reviewIntent: this._requireString(row.reviewIntent, 'subjectiveLineage.reviewIntent', lineageId),
                shadowPolicy: this._requireOneOf(
                    row.shadowPolicy,
                    ['no-shadows', 'excluded-shadowed', 'not-applicable'],
                    'subjectiveLineage.shadowPolicy',
                    lineageId,
                ),
                notes: this._requireString(row.notes, 'subjectiveLineage.notes', lineageId),
            });
        }));
    }

    /**
     * @param {unknown} claims - Raw claims.
     * @param {string} sceneId - Scene id.
     * @returns {readonly ShaderValidationExpectedDisplayPixelClaim[]} Normalized claims.
     */
    _normalizeClaims(claims, sceneId) {
        if (!Array.isArray(claims)) {
            return Object.freeze([]);
        }

        return Object.freeze(claims.map((claim) => {
            if (!claim || typeof claim !== 'object') {
                throw new ReconciliationConfigurationError('Expected display pixel claim must be an object.', {
                    code: 'INVALID_EXPECTED_DISPLAY_PIXEL_CLAIM',
                    details: { sceneId },
                });
            }

            const expectedValueSource = this._normalizeExpectedValueSource(claim.expectedValueSource, sceneId);
            const selectedPixelIds = this._normalizeStringArray(claim.selectedPixelIds ?? [], 'claim.selectedPixelIds', sceneId);
            const controlledRegionIds = this._normalizeStringArray(
                claim.controlledRegionIds ?? [],
                'claim.controlledRegionIds',
                sceneId,
            );

            if (selectedPixelIds.length === 0 && controlledRegionIds.length === 0) {
                throw new ReconciliationConfigurationError('Expected display claim requires selected pixels or controlled regions.', {
                    code: 'EXPECTED_DISPLAY_CLAIM_MISSING_TARGETS',
                    details: { sceneId, claimId: claim.claimId ?? null },
                });
            }

            return Object.freeze({
                claimId: this._requireString(claim.claimId, 'claimId', sceneId),
                description: this._requireString(claim.description, 'claim.description', sceneId),
                selectedPixelIds,
                controlledRegionIds,
                expectedValueSource,
                tolerancePolicy: this._requireString(claim.tolerancePolicy, 'claim.tolerancePolicy', sceneId),
            });
        }));
    }

    /**
     * @param {unknown} source - Raw expected-value source.
     * @param {string} sceneId - Scene id.
     * @returns {ShaderValidationExpectedValueSource} Normalized source.
     */
    _normalizeExpectedValueSource(source, sceneId) {
        if (!source || typeof source !== 'object') {
            throw new ReconciliationConfigurationError('Expected value source is required.', {
                code: 'MISSING_EXPECTED_VALUE_SOURCE',
                details: { sceneId },
            });
        }

        return Object.freeze({
            materialization: this._requireOneOf(
                source.materialization,
                ['accepted-record', 'external-fixture-required', 'external-source-backed-run-required', 'runner-policy'],
                'expectedValueSource.materialization',
                sceneId,
            ),
            sourceIds: this._normalizeStringArray(source.sourceIds, 'expectedValueSource.sourceIds', sceneId),
            policy: this._requireString(source.policy, 'expectedValueSource.policy', sceneId),
            finalNumericRgbaStatus: this._requireOneOf(
                source.finalNumericRgbaStatus,
                ['materialized', 'pending-external-source'],
                'expectedValueSource.finalNumericRgbaStatus',
                sceneId,
            ),
            acceptedRecord: source.acceptedRecord ?? null,
        });
    }

    /**
     * @param {unknown} pixel - Raw selected pixel.
     * @param {string} sceneId - Scene id.
     * @returns {ThreeSceneBridgePixelSelection} Normalized pixel.
     */
    _normalizeSelectedPixel(pixel, sceneId) {
        if (!pixel || typeof pixel !== 'object') {
            throw new ReconciliationConfigurationError('Selected pixel must be an object.', {
                code: 'INVALID_SELECTED_PIXEL',
                details: { sceneId },
            });
        }

        if (!Number.isInteger(pixel.x) || !Number.isInteger(pixel.y)) {
            throw new ReconciliationConfigurationError('Selected pixel coordinates must be integers.', {
                code: 'INVALID_SELECTED_PIXEL_COORDINATES',
                details: { sceneId, pixel },
            });
        }

        return Object.freeze({
            pixelId: this._requireString(pixel.pixelId, 'pixelId', sceneId),
            x: pixel.x,
            y: pixel.y,
        });
    }

    /**
     * @param {unknown} viewportPixels - Raw viewport.
     * @param {string} sceneId - Scene id.
     * @returns {readonly [number, number]} Normalized viewport.
     */
    _normalizeViewport(viewportPixels, sceneId) {
        if (
            !Array.isArray(viewportPixels)
            || viewportPixels.length !== 2
            || !viewportPixels.every(Number.isInteger)
            || viewportPixels.some((value) => value <= 0)
        ) {
            throw new ReconciliationConfigurationError('Scene viewport must be a positive integer tuple.', {
                code: 'INVALID_SCENE_VIEWPORT',
                details: { sceneId, viewportPixels },
            });
        }

        return Object.freeze([viewportPixels[0], viewportPixels[1]]);
    }

    /**
     * @param {unknown} values - Raw array.
     * @param {string} fieldName - Field name.
     * @param {string} sceneId - Scene id.
     * @returns {readonly string[]} Normalized string array.
     */
    _normalizeStringArray(values, fieldName, sceneId) {
        if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.length === 0)) {
            throw new ReconciliationConfigurationError(`${fieldName} must be a non-empty string array.`, {
                code: 'INVALID_STRING_ARRAY_FIELD',
                details: { sceneId, fieldName, values },
            });
        }

        return Object.freeze([...values]);
    }

    /**
     * @param {unknown} value - Candidate string.
     * @param {readonly string[]} allowed - Allowed values.
     * @param {string} fieldName - Field name.
     * @param {string} [sceneId] - Scene id.
     * @returns {string} Accepted value.
     */
    _requireOneOf(value, allowed, fieldName, sceneId = null) {
        if (!allowed.includes(value)) {
            throw new ReconciliationConfigurationError(`${fieldName} has an unsupported value.`, {
                code: 'UNSUPPORTED_SCENE_FIELD_VALUE',
                details: { sceneId, fieldName, value, allowed },
            });
        }

        return value;
    }

    /**
     * @param {unknown} value - Candidate string.
     * @param {string} fieldName - Field name.
     * @param {string} [sceneId] - Scene id.
     * @returns {string} String value.
     */
    _requireString(value, fieldName, sceneId = null) {
        if (typeof value !== 'string' || value.length === 0) {
            throw new ReconciliationConfigurationError(`${fieldName} must be a non-empty string.`, {
                code: 'INVALID_STRING_FIELD',
                details: { sceneId, fieldName, value },
            });
        }

        return value;
    }
}
