type ReconciliationControlledThreeScene = {
    readonly sceneId: string;
    readonly scene: unknown;
    readonly camera: unknown;
    readonly meshes: readonly unknown[];
    readonly viewportPixels: readonly [number, number];
    readonly selectedPixels: readonly ThreeSceneBridgePixelSelection[];
    readonly metadata: unknown;
};

type ShaderValidationSceneKind = 'objective' | 'subjective';

type ShaderValidationSceneStatus =
    | 'planned'
    | 'implemented'
    | 'accepted'
    | 'deferred';

type ShaderValidationSceneImplementationKind =
    | 'node-three'
    | 'json-fixture'
    | 'browser-three'
    | 'runner-policy';

type ShaderValidationExpectedValueMaterialization =
    | 'accepted-record'
    | 'external-fixture-required'
    | 'external-source-backed-run-required'
    | 'runner-policy';

type ShaderValidationExpectedValueSource = {
    readonly materialization: ShaderValidationExpectedValueMaterialization;
    readonly sourceIds: readonly string[];
    readonly policy: string;
    readonly finalNumericRgbaStatus: 'materialized' | 'pending-external-source';
    readonly acceptedRecord?: string | null;
};

type ShaderValidationExpectedDisplayPixelClaim = {
    readonly claimId: string;
    readonly description: string;
    readonly selectedPixelIds?: readonly string[];
    readonly controlledRegionIds?: readonly string[];
    readonly expectedValueSource: ShaderValidationExpectedValueSource;
    readonly tolerancePolicy: string;
};

type ShaderValidationObjectiveCriterion = {
    readonly criterionId: string;
    readonly claim: string;
    readonly measurement: string;
    readonly owner: string;
    readonly failureClassification: string;
    readonly requiredBeforeGpuObjectiveRuns: boolean;
};

type ShaderValidationSceneDescriptor = {
    readonly sceneId: string;
    readonly sceneKind: ShaderValidationSceneKind;
    readonly status: ShaderValidationSceneStatus;
    readonly implementationKind: ShaderValidationSceneImplementationKind;
    readonly moduleId?: string | null;
    readonly activeMilestones: readonly string[];
    readonly sourceDescriptorId: string;
    readonly geometryDescriptorId: string;
    readonly atmosphereDescriptorId: string;
    readonly lightSourceDescriptorId: string;
    readonly cacheDescriptorId?: string | null;
    readonly displayDescriptorId: string;
    readonly viewportPixels: readonly [number, number];
    readonly selectedPixels?: readonly ThreeSceneBridgePixelSelection[];
    readonly controlledRegionIds?: readonly string[];
    readonly objectiveTestIds: readonly string[];
    readonly objectiveCriteria?: readonly ShaderValidationObjectiveCriterion[];
    readonly provenanceIds: readonly string[];
    readonly extentTags: readonly string[];
    readonly expectedDisplayPixelClaims: readonly ShaderValidationExpectedDisplayPixelClaim[];
    readonly acceptedRecord?: string | null;
    readonly notes?: string | null;
    readonly requiresLiveBrowserForDescriptor?: boolean;
};

type ShaderSubjectiveSceneLineageDescriptor = {
    readonly lineageId: string;
    readonly recordPath: string;
    readonly sourceSceneId: string;
    readonly reviewStatus: 'active-first-gpu-review' | 'deferred-local-flat-follow-on' | 'excluded';
    readonly reviewIntent: string;
    readonly shadowPolicy: 'no-shadows' | 'excluded-shadowed' | 'not-applicable';
    readonly notes: string;
};

type ShaderValidationSceneInventory = {
    readonly kind: 'shader-validation-scene-inventory';
    readonly version: number;
    readonly sourceDocument: string;
    readonly scenes: readonly ShaderValidationSceneDescriptor[];
    readonly subjectiveLineage?: readonly ShaderSubjectiveSceneLineageDescriptor[];
};

type ShaderSceneRegistryValidationReport = {
    readonly sceneCount: number;
    readonly objectiveSceneCount: number;
    readonly subjectiveSceneCount: number;
    readonly acceptedSceneCount: number;
    readonly plannedSceneCount: number;
    readonly objectiveTestIds: readonly string[];
    readonly objectiveScenesRequiredBeforeGpuCount: number;
    readonly pendingExternalNumericRgbaSceneIds: readonly string[];
};
