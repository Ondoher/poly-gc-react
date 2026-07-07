type BrowserShaderRunnerMode = 'once' | 'watch' | 'dry-run';

type BrowserShaderRunnerOptions = {
    readonly mode: BrowserShaderRunnerMode;
    readonly headed: boolean;
    readonly outRoot: string;
    readonly commandPath: string;
    readonly pageRoot: string;
    readonly pollMs: number;
    readonly port: number;
    readonly pageTimeoutMs: number;
    readonly useSwiftShader: boolean;
};

type BrowserShaderJobCommand = {
    readonly id: string;
    readonly label: string;
    readonly page: string;
    readonly entrypoint: string;
    readonly captures: {
        readonly screenshot: string | null;
    };
    readonly artifactRunDirectory?: string;
    readonly status: 'pending' | 'done';
    readonly createdAt: string;
    readonly completedAt?: string;
    readonly completion?: unknown;
    readonly stateGoal: string;
    readonly payload: unknown;
};

type BrowserShaderProgressPacket = {
    readonly kind: string;
    readonly updatedAt: string;
    readonly status: string;
    readonly commandPath: string;
    readonly outRoot: string;
    readonly mode: BrowserShaderRunnerMode;
    readonly pid: number;
    readonly currentJobId: string | null;
    readonly currentRunDir: string | null;
    readonly message: string;
};

type BrowserShaderRunPacket = {
    readonly kind: string;
    readonly status: 'accepted' | 'rejected';
    readonly command: BrowserShaderJobCommand;
    readonly browser: unknown;
    readonly result: unknown;
    readonly artifact: unknown;
    readonly runner: unknown;
    readonly timings: unknown;
};

type BrowserShaderDryRunSummary = {
    readonly status: 'accepted' | 'rejected';
    readonly command: BrowserShaderJobCommand;
    readonly outRoot: string;
    readonly commandPath: string;
    readonly progressPath: string;
    readonly latestPath: string;
};

type BrowserShaderHostProgress = {
    readonly message: string;
    readonly detail?: unknown;
};

type BrowserShaderHostArtifact = {
    readonly name: string;
    readonly kind: 'data-url' | 'json' | 'text';
    readonly data: unknown;
};

type BrowserShaderHost = {
    readonly progress: (progress: BrowserShaderHostProgress) => Promise<unknown>;
    readonly saveArtifact: (artifact: BrowserShaderHostArtifact) => Promise<unknown>;
};

type BrowserAlgorithm32ShaderBackend = 'gpu' | 'cpu';

type BrowserAlgorithm32ProgressEvent = {
    readonly kind: 'algorithm32-cpu-composer-progress';
    readonly phase: 'started' | 'row-complete' | 'completed';
    readonly completedRows: number;
    readonly totalRows: number;
    readonly percent: number;
    readonly viewportPixels: readonly [number, number];
    readonly hitPixelCount?: number;
    readonly noHitPixelCount?: number;
    readonly elapsedMs: number;
    readonly message?: string;
};

type BrowserAlgorithm32ProgressCallback = (progress: BrowserAlgorithm32ProgressEvent) => void;

type BrowserAlgorithm32RuntimeInput = {
    readonly sceneId: string;
    readonly width: number;
    readonly height: number;
    readonly geometryKind?: 'spherical-earth' | 'flat-earth';
    readonly lightSourceKind?: 'distant-sun' | 'local-sun';
    readonly sceneDepthBytes: Uint8Array | readonly number[];
    readonly sceneHitBytes: Uint8Array | readonly number[];
    readonly sceneDepthTextureEncoding?: string;
    readonly sceneDepthMaxMeters: number;
    readonly sceneTerminationMeters?: number;
    readonly endpointRadianceScale?: number;
    readonly cameraWorldPositionMeters: Position;
    readonly distantSunDirection: UnitVector3;
    readonly inverseProjectionMatrix: readonly number[];
    readonly inverseViewMatrix: readonly number[];
    readonly incidentRadianceTexture: CacheShaderTexturePayload;
    readonly incidentRadianceCache?: unknown;
    readonly geometryFrame?: {
        readonly up: UnitVector3;
        readonly right: UnitVector3;
        readonly forward: UnitVector3;
    };
    readonly selectedPixels?: readonly {
        readonly pixelId?: string;
        readonly x: number;
        readonly y: number;
    }[];
    readonly pathIntervalCount?: number;
    readonly sourceTransmittanceIntervalCount?: number;
    readonly localFlat?: unknown;
};

type BrowserAlgorithm32ComposerResult = {
    readonly kind: 'algorithm32-browser-composer-result';
    readonly status: 'accepted' | 'rejected';
    readonly backend: BrowserAlgorithm32ShaderBackend;
    readonly sceneColorBytes: Uint8Array | null;
    readonly diagnostics: unknown;
};

type BrowserAlgorithm32CpuPassDiagnostics = {
    readonly aggregateDiagnostics: SoftShaderAggregateDiagnostics;
    readonly selectedPixels: readonly unknown[];
    readonly incidentRadianceCache: unknown;
};
