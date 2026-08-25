type SoftShaderPixelCoordinate = {
    readonly x: number;
    readonly y: number;
};

type SoftShaderSceneInputSourceKind =
    | 'authored-descriptor'
    | 'serialized-json-fixture'
    | 'three-capture';

type SoftShaderSceneInputDescriptor = {
    readonly sceneId: string;
    readonly sourceKind: SoftShaderSceneInputSourceKind;
    readonly sourceDescriptorId: string;
    readonly geometryDescriptorId: string;
    readonly atmosphereDescriptorId: string;
    readonly lightSourceDescriptorId: string;
    readonly cacheDescriptorId?: string | null;
    readonly displayDescriptorId: string;
    readonly viewportPixels: readonly [number, number];
    readonly metadata?: unknown;
};

type SoftShaderSceneIntersectionKind =
    | 'hit'
    | 'no-hit'
    | 'invalid';

type SoftShaderSceneIntersection = {
    readonly kind: SoftShaderSceneIntersectionKind;
    readonly distanceMeters?: number | null;
    readonly hitPosition?: Position | null;
    readonly invalidReason?: string | null;
    readonly metadata?: unknown;
};

type SoftShaderEndpointOpacity = 'opaque';

type SoftShaderEndpointContributionPolicy =
    | 'none'
    | 'spectrum-id-reference-radiance'
    | 'precomputed-spectral-radiance'
    | 'matte-lambertian-linear-srgb'
    | 'captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy';

type SoftShaderEndpointContribution = {
    readonly policy: SoftShaderEndpointContributionPolicy;
    readonly opacity?: SoftShaderEndpointOpacity;
    readonly spectralReferenceId?: string | null;
    readonly endpointRadiance?: SpectralValue | null;
    readonly capturedSceneColorDisplayRgb?: readonly [number, number, number] | null;
    readonly linearSrgbAlbedo?: readonly [number, number, number] | null;
    readonly surfaceNormal?: UnitVector3 | null;
    readonly hitPosition?: Position | null;
    readonly metadata?: unknown;
};

type SoftShaderScenePixelInput = {
    readonly pixelId: string;
    readonly coordinate: SoftShaderPixelCoordinate;
    readonly ray: Ray;
    readonly sceneIntersection?: SoftShaderSceneIntersection | null;
    readonly endpointContribution?: SoftShaderEndpointContribution | null;
    readonly pathIntervalCount?: number;
    readonly groundBoundaryMode?: 'clip' | 'scene-hit-owned';
    readonly metadata?: unknown;
};

type SoftShaderViewRayRequest = {
    readonly ray: Ray;
    readonly origin: Position;
    readonly direction: UnitVector3;
    readonly endDistanceMeters?: number;
    readonly groundBoundaryMode?: 'clip' | 'scene-hit-owned';
    readonly sceneIntersection?: {
        readonly kind: SoftShaderSceneIntersectionKind;
        readonly distanceMeters?: number | null;
        readonly hitPosition?: Position | null;
        readonly invalidReason?: string | null;
    };
    readonly metadata?: unknown;
};

type SoftShaderPreparedPixel = {
    readonly pixelId: string;
    readonly coordinate: SoftShaderPixelCoordinate;
    readonly evaluationRequest: SpectralEvaluationRequest;
    readonly endpointContribution: SoftShaderEndpointContribution | null;
    readonly sceneIntersectionKind: SoftShaderSceneIntersectionKind;
    readonly diagnostics: readonly ReconciliationDiagnostic[];
};

interface SoftShaderEndpointRadianceResolver {
    (endpointContribution: SoftShaderEndpointContribution): SpectralValue;
}

type SoftShaderPixelOutput = {
    readonly pixelId: string;
    readonly coordinate: SoftShaderPixelCoordinate;
    readonly sceneIntersectionKind: SoftShaderSceneIntersectionKind;
    readonly endpointPolicy: SoftShaderEndpointContributionPolicy;
    readonly evaluationOutput: SpectralEvaluationOutput;
    readonly endpointRadiance: SpectralValue | null;
    readonly finalSpectralRadiance: SpectralValue | null;
    readonly displayComposition: SoftShaderDisplayComposition | null;
    readonly displayRgb: readonly [number, number, number];
    readonly displayRgba: readonly [number, number, number, number];
    readonly diagnostics: readonly ReconciliationDiagnostic[];
};

type SoftShaderDisplayComposition = {
    readonly kind: 'spectral-radiance' | 'captured-scene-endpoint-proxy';
    readonly skyLinearSrgb?: readonly [number, number, number] | null;
    readonly transmittanceRgb?: readonly [number, number, number] | null;
    readonly endpointLinearSrgb?: readonly [number, number, number] | null;
    readonly finalLinearSrgb?: readonly [number, number, number] | null;
};

type SoftShaderSelectedPixelDiagnostic = {
    readonly pixelId: string;
    readonly coordinate: SoftShaderPixelCoordinate;
    readonly sceneIntersectionKind: SoftShaderSceneIntersectionKind;
    readonly endpointPolicy: SoftShaderEndpointContributionPolicy;
    readonly evaluationOutput?: SpectralEvaluationOutput;
    readonly endpointRadiance?: SpectralValue | null;
    readonly finalSpectralRadiance?: SpectralValue | null;
    readonly expectedDisplayRgba?: readonly [number, number, number, number] | null;
    readonly observedDisplayRgba?: readonly [number, number, number, number] | null;
    readonly diagnostics: readonly ReconciliationDiagnostic[];
};

type SoftShaderAggregateDiagnostics = {
    readonly selectedPixelCount: number;
    readonly validPixelCount: number;
    readonly invalidPixelCount: number;
    readonly hitPixelCount: number;
    readonly noHitPixelCount: number;
    readonly warningCount: number;
    readonly errorCount: number;
};

type SoftShaderControlledRegionSummary = {
    readonly regionId: string;
    readonly pixelCount: number;
    readonly metricKind: string;
    readonly value: number;
    readonly metadata?: unknown;
};

type SoftShaderDiagnosticMode = {
    readonly modeId: string;
    readonly purpose: string;
    readonly selectedPixelIds?: readonly string[];
    readonly controlledRegionIds?: readonly string[];
    readonly maxExtraSamples?: number;
};

type SoftShaderSceneInputAdapterConfig = {
    readonly rejectRgbFields?: boolean;
};

interface SoftShaderSceneInputAdapterLike {
    preparePixel(pixelInput: SoftShaderScenePixelInput): SoftShaderPreparedPixel;
}
