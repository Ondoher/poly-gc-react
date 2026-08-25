type BilinearPointResponseRequest = {
    readonly rasterX: number;
    readonly rasterY: number;
    readonly widthPixels: number;
    readonly heightPixels: number;
};

type PointResponseDestination = {
    readonly pixelX: number | null;
    readonly pixelY: number | null;
    readonly weight: number;
    readonly onFrame: boolean;
    readonly reason?: 'outside-forward-camera-hemisphere';
};

type PointSourceRasterRequest = {
    readonly source: import('../external-celestial-sources/ExternalCelestialSource.js').default;
    readonly sourceDirectionCamera: UnitVector3;
};

type TransportedPointSourceFiniteDepth = Readonly<{
    /** Names finite source-depth semantics. */
    readonly kind: 'finite';
    /** Stores physical source depth from the camera origin in meters. */
    readonly distanceMeters: number;
}>;

type TransportedPointSourceInfiniteDepth = Readonly<{
    /** Names infinite directional source-depth semantics. */
    readonly kind: 'infinite';
}>;

type TransportedPointSourceDepth =
    | TransportedPointSourceFiniteDepth
    | TransportedPointSourceInfiniteDepth;

type ExactPointSourceRay = Readonly<{
    /** Identifies the canonical celestial source. */
    readonly sourceId: string;
    /** Retains geometry ownership without exposing source radiometry. */
    readonly sourceGeometry: CelestialGeometryOwnershipDescriptor;
    /** Stores the exact camera-space unit source direction. */
    readonly directionCamera: UnitVector3;
    /** Names the direction coordinate frame. */
    readonly directionFrame: 'camera-space-unit-vector-forward-minus-z';
    /** Stores the exact finite or infinite source depth. */
    readonly depth: TransportedPointSourceDepth;
}>;

type ExactPointSourceVisibilityResult = Readonly<{
    /** States whether the exact source ray reaches the source. */
    readonly visible: boolean;
    /** Retains the blocking geometry descriptor, or null when visible. */
    readonly occluder: Readonly<Record<string, unknown>> | null;
}>;

type ExactPointSourceTransmittanceResult = Readonly<{
    /** Names dimensionless transmittance units. */
    readonly units: '1';
    /** Identifies the spectral basis aligned with the returned values. */
    readonly basisFingerprint: string;
    /** Stores 15 exact-source spectral transmittance values in [0, 1]. */
    readonly values: readonly number[];
}>;

type ExactPointSourceVisibilityResolver = Readonly<{
    /** Identifies the immutable visibility-resolver contract. */
    readonly fingerprint: string;
    /** Resolves visibility once at the supplied exact direction and depth. */
    readonly resolveExactSourceVisibility:
        (ray: ExactPointSourceRay) => ExactPointSourceVisibilityResult;
}>;

type ExactPointSourceTransmittanceSampler = Readonly<{
    /** Identifies the immutable transmittance-sampler contract. */
    readonly fingerprint: string;
    /** Samples 15 aligned transmittance values once at the supplied exact ray. */
    readonly sampleExactSourceTransmittance:
        (ray: ExactPointSourceRay) => ExactPointSourceTransmittanceResult;
}>;

type TransportedPointSourceAccumulatorConfiguration = Readonly<{
    /** Supplies exact raster projection and pixel solid angles. */
    readonly camera: import('../camera/PerspectiveCameraRaster.js').default;
    /** Supplies the normalized achromatic point response. */
    readonly response: import('./BilinearPointResponse.js').default;
    /** Supplies exact-source geometric visibility. */
    readonly visibilityResolver: ExactPointSourceVisibilityResolver;
    /** Supplies exact-source atmosphere transmittance. */
    readonly transmittanceSampler: ExactPointSourceTransmittanceSampler;
}>;

type TransportedPointSourceRequest = Readonly<{
    /** Supplies a typed point spectral-irradiance celestial source. */
    readonly source: import('../external-celestial-sources/ExternalCelestialSource.js').default;
    /** Supplies the physical camera-space source direction. */
    readonly sourceDirectionCamera: UnitVector3;
    /** Supplies the physical finite or infinite source depth. */
    readonly sourceDepth: TransportedPointSourceDepth;
}>;

type TransportedPointSourceBatchRequest = Readonly<{
    /** Supplies point requests whose source ids must be unique. */
    readonly points: readonly TransportedPointSourceRequest[];
}>;

type PreparedTransportedPointSourceRequest = Readonly<{
    /** Retains the validated typed point source. */
    readonly source: import('../external-celestial-sources/ExternalCelestialSource.js').default;
    /** Stores the projected coordinate, or null outside the forward hemisphere. */
    readonly rasterCenter: RasterCenterCoordinate | null;
    /** States whether the exact physical direction is projectable by this camera. */
    readonly forwardCameraHemisphere: boolean;
    /** Stores the detached exact ray shared by both transport callbacks. */
    readonly exactSourceRay: ExactPointSourceRay;
}>;

type TransportedSpectralIrradianceDiagnostic = Readonly<{
    /** Names the spectral irradiance or residual quantity. */
    readonly quantity: string;
    /** Names spectral irradiance density units. */
    readonly units: 'W m^-2 nm^-1';
    /** Identifies the aligned spectral basis. */
    readonly basisFingerprint: string;
    /** Stores 15 channel values. */
    readonly values: readonly number[];
}>;

type TransportedPointPixelContribution = Readonly<{
    /** Stores the destination pixel x coordinate. */
    readonly pixelX: number;
    /** Stores the destination pixel y coordinate. */
    readonly pixelY: number;
    /** Identifies individual sources added into this destination. */
    readonly contributingSourceIds: readonly string[];
    /** Stores one-source response weight, or null after batch addition. */
    readonly responseWeight: number | null;
    /** Stores the exact destination-pixel solid angle in steradians. */
    readonly pixelSolidAngleSteradians: number;
    /** Identifies the aligned spectral basis. */
    readonly basisFingerprint: string;
    /** Names the point-radiance contribution quantity. */
    readonly quantity: 'point-spectral-radiance-density';
    /** Names spectral radiance density units. */
    readonly units: 'W m^-2 sr^-1 nm^-1';
    /** Stores 15 point spectral-radiance-density values. */
    readonly pointSpectralRadianceDensity: readonly number[];
}>;

type TransportedPointSourceIdentityDiagnostic = Readonly<{
    /** Identifies the canonical source. */
    readonly id: string;
    /** Retains the required point-source kind. */
    readonly kind: 'point';
    /** Retains geometry ownership without duplicating radiometry. */
    readonly geometry: CelestialGeometryOwnershipDescriptor;
    /** Identifies the complete source contract. */
    readonly fingerprint: string;
}>;

type TransportedPointVisibilityDiagnostic = Readonly<{
    /** States whether the exact ray reaches the source. */
    readonly visible: boolean;
    /** Retains the blocking geometry descriptor, or null when visible. */
    readonly occluder: Readonly<Record<string, unknown>> | null;
    /** Identifies the exact-source visibility resolver. */
    readonly resolverFingerprint: string;
}>;

type TransportedPointTransmittanceDiagnostic = Readonly<{
    /** Names the sampled physical quantity. */
    readonly quantity: 'spectral-transmittance';
    /** Names dimensionless units. */
    readonly units: '1';
    /** Identifies the basis aligned with the returned values. */
    readonly basisFingerprint: string;
    /** Stores 15 exact-source transmittance values. */
    readonly values: readonly number[];
    /** Identifies the exact-source transmittance sampler. */
    readonly samplerFingerprint: string;
}>;

type TransportedPointCallbackCallDiagnostic = Readonly<{
    /** Names the invoked callback. */
    readonly callback: string;
    /** Stores the exact number of callback invocations. */
    readonly callCount: number;
    /** Retains the exact shared ray, or null when the callback was skipped. */
    readonly exactSourceRay: ExactPointSourceRay | null;
}>;

type TransportedPointCallDiagnostics = Readonly<{
    /** Retains callback order for this point. */
    readonly order: readonly string[];
    /** Retains the one visibility callback invocation. */
    readonly visibility: TransportedPointCallbackCallDiagnostic;
    /** Retains the optional transmittance callback invocation. */
    readonly transmittance: TransportedPointCallbackCallDiagnostic;
    /** States whether both callbacks received the same ray object when applicable. */
    readonly sameExactSourceRayObject: true | null;
}>;

type TransportedPointSourceAccumulation = Readonly<{
    /** Retains canonical source identity and geometry ownership. */
    readonly source: TransportedPointSourceIdentityDiagnostic;
    /** Retains the one exact physical ray supplied to both callbacks. */
    readonly exactSourceRay: ExactPointSourceRay;
    /** Retains binary visibility, occluder, and resolver fingerprint. */
    readonly visibility: TransportedPointVisibilityDiagnostic;
    /** Retains exact-source transmittance, or null when blocked. */
    readonly transmittance: TransportedPointTransmittanceDiagnostic | null;
    /** Stores the projected coordinate, or null outside the forward hemisphere. */
    readonly rasterCenter: RasterCenterCoordinate | null;
    /** Retains the physical-direction projection disposition. */
    readonly rasterProjection: Readonly<{
        readonly forwardCameraHemisphere: boolean;
        readonly status: 'projected' | 'outside-forward-camera-hemisphere';
    }>;
    /** Retains normalized on-frame and off-raster response diagnostics. */
    readonly response: Readonly<Record<string, unknown>>;
    /** Stores destination point-radiance contributions. */
    readonly pixels: readonly TransportedPointPixelContribution[];
    /** Retains the source-owned typed spectral irradiance. */
    readonly sourceSpectralIrradiance: SpectralDensityPacketDescriptor;
    /** Stores visibility-resolved F times T. */
    readonly transmittedSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Stores the reconstructed on-frame point irradiance. */
    readonly reconstructedOnFrameSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Stores explicit off-raster point irradiance. */
    readonly offRasterSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Stores on-frame plus off-raster accounted point irradiance. */
    readonly accountedSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Stores accounted minus transmitted point irradiance. */
    readonly accountingResidualSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Retains the conservation equation and response-weight accounting. */
    readonly accounting: Readonly<Record<string, unknown>>;
    /** Retains exact callback counts, order, directions, and depths. */
    readonly transportCalls: TransportedPointCallDiagnostics;
    /** Retains quantity ownership declarations. */
    readonly quantity: Readonly<Record<string, string>>;
    /** Retains unit declarations. */
    readonly units: Readonly<Record<string, string>>;
    /** Retains accumulator, dependency, source, and basis fingerprints. */
    readonly fingerprints: Readonly<Record<string, unknown>>;
}>;

type TransportedPointSourceBatchAccumulation = Readonly<{
    /** Lists unique source ids in deterministic request order. */
    readonly sourceIds: readonly string[];
    /** Preserves every individual source transport diagnostic. */
    readonly sources: readonly TransportedPointSourceAccumulation[];
    /** Stores linearly added destination contributions. */
    readonly pixels: readonly TransportedPointPixelContribution[];
    /** Stores the sum of source-owned irradiance spectra. */
    readonly sourceSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Stores the sum of visibility-resolved F times T spectra. */
    readonly transmittedSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Stores aggregate reconstructed on-frame irradiance. */
    readonly reconstructedOnFrameSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Stores aggregate explicit off-raster irradiance. */
    readonly offRasterSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Stores aggregate accounted irradiance. */
    readonly accountedSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Stores aggregate accounted-minus-transmitted residual. */
    readonly accountingResidualSpectralIrradiance: TransportedSpectralIrradianceDiagnostic;
    /** Retains aggregate conservation diagnostics. */
    readonly accounting: Readonly<Record<string, unknown>>;
    /** Retains aggregate and per-source exact callback counts. */
    readonly transportCalls: Readonly<Record<string, unknown>>;
    /** Retains quantity ownership declarations. */
    readonly quantity: Readonly<Record<string, string>>;
    /** Retains unit declarations. */
    readonly units: Readonly<Record<string, string>>;
    /** Retains accumulator, dependency, source, and basis fingerprints. */
    readonly fingerprints: Readonly<Record<string, unknown>>;
}>;
