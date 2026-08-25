type ExactDirectionalVisibilityBlockerKind =
    | 'scene'
    | 'globe'
    | 'opaque-finite-body';

type ExactDirectionalVisibilityFiniteDepth = Readonly<{
    /** Names finite source-depth semantics. */
    readonly kind: 'finite';
    /** Stores physical source depth from the camera origin in meters. */
    readonly distanceMeters: number;
}>;

type ExactDirectionalVisibilityInfiniteDepth = Readonly<{
    /** Names infinite directional source-depth semantics. */
    readonly kind: 'infinite';
}>;

type ExactDirectionalVisibilityDepth =
    | ExactDirectionalVisibilityFiniteDepth
    | ExactDirectionalVisibilityInfiniteDepth;

type ExactDirectionalVisibilitySourceIdentity = Readonly<{
    /** Identifies the canonical target source. */
    readonly id: string;
    /** Distinguishes point-center and extended-quadrature target rays. */
    readonly kind: 'point' | 'extended';
    /** Identifies an extended source contract, or remains null for the point callback seam. */
    readonly fingerprint: string | null;
    /** Retains geometry ownership metadata without source radiometry. */
    readonly geometry: CelestialGeometryOwnershipDescriptor;
}>;

type ExactDirectionalVisibilityRay = Readonly<{
    /** Retains the source identity without brightness or spectral values. */
    readonly source: ExactDirectionalVisibilitySourceIdentity;
    /** Stores the exact camera-space unit direction. */
    readonly directionCamera: UnitVector3;
    /** Names the camera-space direction convention. */
    readonly directionFrame: 'camera-space-unit-vector-forward-minus-z';
    /** Stores finite or infinite target-source depth. */
    readonly depth: ExactDirectionalVisibilityDepth;
}>;

type ExactDirectionalBlockerIntersection = Readonly<{
    /** Stores the nearest nonnegative exact-ray intersection distance in meters. */
    readonly distanceMeters: number;
    /** Optionally identifies the intersected primitive or surface. */
    readonly featureId?: string;
}>;

type ExactDirectionalVisibilityBlocker = Readonly<{
    /** Identifies the geometry owner and participates in deterministic ties. */
    readonly id: string;
    /** Classifies scene, globe, or other opaque finite-body geometry. */
    readonly kind: ExactDirectionalVisibilityBlockerKind;
    /** Identifies the immutable geometry/intersection contract. */
    readonly fingerprint: string;
    /** Returns the nearest exact-ray finite intersection or explicit null. */
    readonly intersectExactRay:
        (ray: ExactDirectionalVisibilityRay) => ExactDirectionalBlockerIntersection | null;
}>;

type ExactDirectionalVisibilityResolverConfiguration = Readonly<{
    /** Supplies unique opaque geometry owners; point emitters are prohibited. */
    readonly blockers: readonly ExactDirectionalVisibilityBlocker[];
    /** Treats finite depths within this nonnegative meter tolerance as a deterministic tie. */
    readonly depthTieToleranceMeters?: number;
}>;

type ExactDirectionalVisibilityOccluder = Readonly<{
    /** Identifies the selected blocking geometry owner. */
    readonly id: string;
    /** Classifies the selected geometry owner. */
    readonly kind: ExactDirectionalVisibilityBlockerKind;
    /** Identifies the selected geometry/intersection contract. */
    readonly fingerprint: string;
    /** Identifies the intersected primitive or remains null. */
    readonly featureId: string | null;
    /** Stores the finite exact-ray blocker distance in meters. */
    readonly distanceMeters: number;
    /** Explains the blocker/source depth relation. */
    readonly relationToSource: string;
    /** Retains the finite or infinite source depth used in the comparison. */
    readonly sourceDepth: ExactDirectionalVisibilityDepth;
    /** Retains ID tie diagnostics when source and blocker depths are indistinguishable. */
    readonly tieBreak: Readonly<Record<string, unknown>> | null;
    /** Retains deterministic nearest-blocker selection diagnostics. */
    readonly selection: Readonly<Record<string, unknown>>;
}>;

type ExactDirectionalVisibilityResult = Readonly<{
    /** States whether the exact ray reaches the target source. */
    readonly visible: boolean;
    /** Retains selected blocking geometry, or null when the source is visible. */
    readonly occluder: ExactDirectionalVisibilityOccluder | null;
    /** Retains ordered intersection, depth, tie, and selection evidence. */
    readonly diagnostics: Readonly<Record<string, unknown>>;
}>;
