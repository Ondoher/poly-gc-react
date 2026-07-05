type SpectralReferenceEvaluatorConfig = {
    readonly geometry: GeometryModel;
    readonly atmosphere: AtmosphereModel;
    readonly lightSource: LightSourceModel;
    readonly calculator?: SpectralCalculatorLike;
    readonly spectralBasis?: SpectralBasis;
    readonly executionControls?: ExecutionControls;
    readonly incidentRadianceSampling?: IncidentRadianceSampling | null;
};

type SpectralEvaluationRequest = {
    readonly viewRayRequest?: unknown;
    readonly pathIntervalCount?: number;
    readonly incidentRadianceSampling?: IncidentRadianceSampling | null;
    readonly metadata?: unknown;
};

type SpectralEvaluationOutput = {
    readonly outputKind: 'spectral';
    readonly viewRaySegment: RaySegment;
    readonly pathIntegrationPoints: readonly PathIntegrationPoint[];
    readonly pathRadiance: PathRadiance;
    readonly diagnostics: readonly ReconciliationDiagnostic[];
};

