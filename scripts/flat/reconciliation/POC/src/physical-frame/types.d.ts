type PhysicalFrameRadiancePacket = Readonly<{
    /** Names spectral radiance density. */
    readonly quantity: 'spectral-radiance-density';
    /** Names SI spectral radiance-density units. */
    readonly units: 'W m^-2 sr^-1 nm^-1';
    /** Identifies the aligned 15-channel basis. */
    readonly basisFingerprint: string;
    /** Stores 15 spectral radiance-density values. */
    readonly values: readonly number[];
}>;

type PhysicalFrameTransmittancePacket = Readonly<{
    /** Names spectral transmittance. */
    readonly quantity: 'spectral-transmittance';
    /** Names dimensionless units. */
    readonly units: '1';
    /** Identifies the aligned 15-channel basis. */
    readonly basisFingerprint: string;
    /** Stores 15 spectral transmittance values in [0, 1]. */
    readonly values: readonly number[];
}>;

type PhysicalBaseSpectralPixel = Readonly<{
    /** Stores the integer frame x coordinate. */
    readonly pixelX: number;
    /** Stores the integer frame y coordinate. */
    readonly pixelY: number;
    /** Supplies frozen-atmosphere in-scattered path radiance. */
    readonly pathSpectralRadianceDensity: PhysicalFrameRadiancePacket;
    /** Supplies view-path transmittance for an optional endpoint only. */
    readonly viewSpectralTransmittance: PhysicalFrameTransmittancePacket;
    /** Supplies an optional non-celestial endpoint radiance. */
    readonly endpointSpectralRadianceDensity: PhysicalFrameRadiancePacket | null;
}>;

type PhysicalSpectralFrameComposerConfiguration = Readonly<{
    /** Supplies frame geometry and exact pixel solid angles. */
    readonly camera: import('../camera/PerspectiveCameraRaster.js').default;
    /** Supplies the sole post-composition display conversion. */
    readonly displayModel: ColorDisplayModel;
}>;

type PhysicalSpectralFrameCompositionRequest = Readonly<{
    /** Identifies the one active 15-channel basis. */
    readonly basisFingerprint: string;
    /** Supplies every camera pixel exactly once. */
    readonly basePixels: readonly PhysicalBaseSpectralPixel[];
    /** Supplies zero or more already transported extended-source integrations. */
    readonly extendedIntegrations?: readonly Readonly<Record<string, unknown>>[];
    /** Supplies zero or more already transported point-source accumulations. */
    readonly pointAccumulations?: readonly Readonly<Record<string, unknown>>[];
}>;

type PhysicalSpectralFramePixel = Readonly<{
    /** Stores the integer frame x coordinate. */
    readonly pixelX: number;
    /** Stores the integer frame y coordinate. */
    readonly pixelY: number;
    /** Stores exact perspective-pixel solid angle. */
    readonly pixelSolidAngleSteradians: number;
    /** Identifies the aligned spectral basis. */
    readonly basisFingerprint: string;
    /** Names the composed physical quantity. */
    readonly quantity: 'spectral-radiance-density';
    /** Names SI spectral radiance-density units. */
    readonly units: 'W m^-2 sr^-1 nm^-1';
    /** Retains path, endpoint, extended, and point components separately. */
    readonly components: Readonly<Record<string, readonly number[]>>;
    /** Stores final pre-display 15-channel spectral radiance density. */
    readonly finalSpectralRadianceDensity: readonly number[];
    /** Stores direct-minus-reconstructed composition residuals. */
    readonly compositionResidual: readonly number[];
    /** Retains the sole display fingerprint, one call, and RGB result. */
    readonly display: Readonly<Record<string, unknown>>;
}>;

type PhysicalSpectralFrameComposition = Readonly<{
    /** Names the reset physical-frame output. */
    readonly kind: 'physical-spectral-frame-composition-v1';
    /** Stores frame width. */
    readonly widthPixels: number;
    /** Stores frame height. */
    readonly heightPixels: number;
    /** Retains every completed frame pixel in row-major order. */
    readonly pixels: readonly PhysicalSpectralFramePixel[];
    /** Retains distinct extended and point source identities. */
    readonly sources: Readonly<Record<string, readonly string[]>>;
    /** Retains contribution counts by source measure. */
    readonly contributionCounts: Readonly<Record<string, number>>;
    /** Retains frame solid-angle integrals for every component. */
    readonly componentSpectralRadianceSolidAngleIntegrals:
        Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    /** Stores the worst direct composition residual. */
    readonly maximumAbsoluteCompositionResidual: number;
    /** Proves one common display invocation per completed pixel. */
    readonly displayPass: Readonly<Record<string, unknown>>;
    /** Names the final physical quantity. */
    readonly quantity: 'spectral-radiance-density';
    /** Names final SI units. */
    readonly units: 'W m^-2 sr^-1 nm^-1';
    /** Retains composer, camera, display, and basis fingerprints. */
    readonly fingerprints: Readonly<Record<string, string>>;
}>;

type FrozenAtmosphereSpectralFrameEvaluatorConfiguration = Readonly<{
    /** Supplies complete frame geometry and exact center directions. */
    readonly camera: import('../camera/PerspectiveCameraRaster.js').default;
    /** Supplies the frozen Algorithm32 spectral evaluator. */
    readonly evaluator: SpectralReferenceEvaluator | {
        evaluate(request: SpectralEvaluationRequest): SpectralEvaluationOutput;
    };
    /** Identifies the aligned 15-channel source basis. */
    readonly basisFingerprint: string;
    /** Maps camera-space directions into the atmosphere model by a proper rotation. */
    readonly cameraToAtmosphereMatrix: readonly (readonly number[])[];
    /** Retains model, constants, and numerical-control identity as finite JSON. */
    readonly evaluatorDescriptor: Readonly<Record<string, unknown>>;
}>;

type FrozenAtmosphereDirectionalEvaluation = Readonly<{
    /** Retains the exact source or pixel direction in camera space. */
    readonly directionCamera: readonly [number, number, number];
    /** Retains the mapped direction evaluated by Algorithm32. */
    readonly directionAtmosphere: readonly [number, number, number];
    /** Retains finite or infinite source-depth semantics. */
    readonly depth: TransportedPointSourceDepth;
    /** Retains the exact frozen-evaluator view-ray request. */
    readonly viewRayRequest: Readonly<Record<string, unknown>>;
    /** Stores the evaluated atmosphere path length. */
    readonly pathLengthMeters: number;
    /** Stores in-scattered path spectral radiance. */
    readonly pathSpectralRadianceDensity: PhysicalFrameRadiancePacket;
    /** Stores exact-direction spectral transmittance. */
    readonly viewSpectralTransmittance: PhysicalFrameTransmittancePacket;
}>;

type FrozenAtmosphereBaseFrameEvaluation = Readonly<{
    /** Names the frozen base-frame result. */
    readonly kind: 'frozen-atmosphere-base-spectral-frame-v1';
    /** Stores frame width. */
    readonly widthPixels: number;
    /** Stores frame height. */
    readonly heightPixels: number;
    /** Supplies every composer base pixel exactly once. */
    readonly basePixels: readonly PhysicalBaseSpectralPixel[];
    /** Retains exact camera/atmosphere directions, solid angles, and path lengths. */
    readonly directions: readonly Readonly<Record<string, unknown>>[];
    /** Retains quantity declarations. */
    readonly quantity: Readonly<Record<string, string>>;
    /** Retains unit declarations. */
    readonly units: Readonly<Record<string, string>>;
    /** Retains frame evaluator, camera, and basis fingerprints. */
    readonly fingerprints: Readonly<Record<string, string>>;
}>;
