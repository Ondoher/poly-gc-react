type SpectralImageWriteRequest = {
    readonly spectralOutput: SpectralEvaluationOutput;
    readonly displayConversion: DisplayConversionDescriptor;
    readonly outputPath: string;
    readonly width: number;
    readonly height: number;
    readonly metadata?: unknown;
};

type SpectralImageArtifact = {
    readonly outputPath: string;
    readonly width: number;
    readonly height: number;
    readonly metadata?: unknown;
};

type Figure1SkyDomeRenderRequest = {
    readonly scene: Figure1SceneConstants;
    readonly evaluator: SpectralReferenceEvaluator;
    readonly outputPath: string;
    readonly width?: number;
    readonly height?: number;
    readonly progress?: RenderProgressCallback;
    readonly progressRowInterval?: number;
};

interface RenderProgressCallback {
    (progress: RenderProgressEvent): void | Promise<void>;
}

type RenderProgressEvent = {
    readonly stage: 'started' | 'row-complete' | 'png-write-started' | 'completed';
    readonly sceneId: string;
    readonly outputPath: string;
    readonly width: number;
    readonly height: number;
    readonly completedRows: number;
    readonly totalRows: number;
    readonly completedPixels: number;
    readonly totalPixels: number;
    readonly skyPixelCount: number;
    readonly transparentPixelCount: number;
};

type Figure1SkyDomeRenderResult = {
    readonly artifact: SpectralImageArtifact;
    readonly diagnostics: {
        readonly sceneId: string;
        readonly skyPixelCount: number;
        readonly transparentPixelCount: number;
        readonly maxRadiance: SpectralValue;
        readonly maxDisplayRgb: readonly [number, number, number];
        readonly zenithRadiance: SpectralValue;
        readonly horizonAzimuth0Radiance: SpectralValue;
    };
};

type Step018SkydomeWriteRequest = {
    readonly scene: LocalFlatSceneConstants;
    readonly evaluator: SpectralReferenceEvaluator;
    readonly outputPath: string;
    readonly width?: number;
    readonly height?: number;
    readonly progress?: RenderProgressCallback;
    readonly progressRowInterval?: number;
};

type Step018SkydomeWriteResult = {
    readonly artifact: SpectralImageArtifact;
    readonly diagnostics: unknown;
};

