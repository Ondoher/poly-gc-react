type CacheBuildRequest = {
    readonly cache: IncidentRadianceCache;
    readonly geometry: GeometryModel;
    readonly atmosphere: AtmosphereModel;
    readonly lightSource: LightSourceModel;
    readonly calculator: SpectralCalculatorLike;
    readonly pathIntervalCount?: number;
    readonly sourceTransmittanceIntervalCount?: number;
};

type CacheBuildResult = {
    readonly cache: IncidentRadianceCache;
    readonly coordinateCount: number;
    readonly incidentRadianceSampling: IncidentRadianceSampling;
};

type BrowserJobRequest = {
    readonly jobId: string;
    readonly scenario: string;
    readonly configDigest?: string;
    readonly outputPath: string;
    readonly timeoutMs: number;
};

type BrowserJobResult = {
    readonly jobId: string;
    readonly status: 'accepted' | 'rejected' | 'blocked';
    readonly outputPath?: string;
    readonly diagnostics?: readonly ReconciliationDiagnostic[];
};

type BrowserCapabilityPacket = {
    readonly vendor?: string;
    readonly renderer?: string;
    readonly version?: string;
    readonly precision?: string;
    readonly extensions?: readonly string[];
    readonly textureLimits?: Record<string, number>;
};

