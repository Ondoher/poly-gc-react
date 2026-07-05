type ThreeToAlgorithmCoordinateMappingId =
    | 'three-x-y-z-to-algorithm-east-north-up';

type ThreeSceneBridgePixelSelection = {
    readonly pixelId: string;
    readonly x: number;
    readonly y: number;
};

type ThreeSceneSoftShaderBridgeConfig = {
    readonly sceneId: string;
    readonly camera: unknown;
    readonly meshes: readonly unknown[];
    readonly viewportPixels: readonly [number, number];
    readonly coordinateMappingId?: ThreeToAlgorithmCoordinateMappingId;
    readonly defaultPathIntervalCount?: number;
};

type ThreeSceneSoftShaderBridgeCaptureRequest = {
    readonly selectedPixels: readonly ThreeSceneBridgePixelSelection[];
    readonly sourceDescriptorId?: string;
    readonly geometryDescriptorId?: string;
    readonly atmosphereDescriptorId?: string;
    readonly lightSourceDescriptorId?: string;
    readonly cacheDescriptorId?: string | null;
    readonly displayDescriptorId?: string;
    readonly metadata?: unknown;
};

type ThreeSceneSoftShaderBridgeCapture = {
    readonly sceneInput: SoftShaderSceneInputDescriptor;
    readonly pixels: readonly SoftShaderScenePixelInput[];
    readonly diagnostics: readonly ReconciliationDiagnostic[];
    readonly summary: ThreeSceneSoftShaderBridgeCaptureSummary;
};

type ThreeSceneSoftShaderBridgeCaptureSummary = {
    readonly sceneId: string;
    readonly selectedPixelCount: number;
    readonly hitPixelCount: number;
    readonly noHitPixelCount: number;
    readonly invalidPixelCount: number;
    readonly minHitDistanceMeters: number | null;
    readonly maxHitDistanceMeters: number | null;
    readonly coordinateMappingId: ThreeToAlgorithmCoordinateMappingId;
};

type ExactSphereGroundObjectConfig = {
    readonly radiusSceneUnits: number;
    readonly centerSceneUnits: Position;
    readonly metersPerSceneUnit: number;
    readonly spectralReferenceId?: string | null;
    readonly name?: string;
};
