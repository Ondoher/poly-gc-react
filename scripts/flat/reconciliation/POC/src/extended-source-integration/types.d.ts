type SphericalCapQuadratureConfiguration = {
    readonly angularRadiusRadians: number;
    readonly radialCount: number;
    readonly azimuthCount: number;
};

type ExtendedAngularSample = {
    readonly directionCamera: UnitVector3;
    readonly cosTheta: number;
    readonly rhoSquared: number;
    readonly solidAngleWeightSteradians: number;
    readonly radialIndex: number;
    readonly azimuthIndex: number;
};

type CanonicalUniformSunDiskSourceConfiguration = Readonly<{
    /** Supplies the normalized canonical extended-source id. */
    readonly id: string;
    /** Supplies the existing canonical solar spectral-irradiance owner. */
    readonly irradiancePacket:
        import('../external-celestial-sources/SpectralDensityPacket.js').default;
    /** Supplies the exact positive apparent angular radius in radians. */
    readonly angularRadiusRadians: number;
    /** Supplies the exact camera-space unit direction at disk center. */
    readonly centerDirectionCamera: UnitVector3;
}>;

type CanonicalUniformSunDiskReconstruction = Readonly<{
    /** Retains the deterministic projected-disk reconstruction formula. */
    readonly formula: 'E_reconstructed_lambda = L_uniform_lambda * pi * sin(alpha)^2';
    /** Identifies the sole canonical solar irradiance owner. */
    readonly canonicalIrradiancePacketFingerprint: string;
    /** Identifies the derived radiance adapter packet. */
    readonly derivedRadiancePacketFingerprint: string;
    /** Stores pi times sine-squared angular radius in steradians. */
    readonly projectedSolidAngleSteradians: number;
    /** Stores channel-wise absolute relative reconstruction residuals. */
    readonly relativeResiduals: readonly number[];
    /** Stores the maximum channel-wise relative residual. */
    readonly maxRelativeResidual: number;
    /** Stores the sealed maximum accepted relative residual. */
    readonly tolerance: 1e-10;
    /** States that constructor-time reconstruction passed. */
    readonly accepted: true;
}>;

type CanonicalUniformSunDiskOwnership = Readonly<{
    /** Names the canonical input quantity. */
    readonly canonicalQuantity: 'spectral-irradiance-density';
    /** Names canonical input units. */
    readonly canonicalUnits: 'W m^-2 nm^-1';
    /** Identifies the retained canonical packet. */
    readonly canonicalPacketFingerprint: string;
    /** Identifies the exact shared spectral basis. */
    readonly canonicalBasisFingerprint: string;
    /** Confirms the constructor retained the supplied packet object. */
    readonly irradiancePacketRetainedByIdentity: true;
    /** Confirms the constructor retained the supplied provenance object. */
    readonly canonicalProvenanceRetainedByIdentity: true;
    /** Names the derived adapter quantity. */
    readonly derivedQuantity: 'spectral-radiance-density';
    /** Names derived adapter units. */
    readonly derivedUnits: 'W m^-2 sr^-1 nm^-1';
    /** Identifies the derived radiance packet. */
    readonly derivedPacketFingerprint: string;
    /** Explicitly excludes a source-only multiplicative gain. */
    readonly sourceSpecificGain: 'none';
    /** Explicitly excludes a physical limb-darkening claim. */
    readonly limbDarkeningClaim: 'none';
}>;

type CanonicalUniformSunDiskSourceModel = Readonly<{
    /** Identifies the extended source. */
    readonly id: string;
    /** Retains the sole canonical solar irradiance packet by identity. */
    readonly irradiancePacket:
        import('../external-celestial-sources/SpectralDensityPacket.js').default;
    /** Identifies the retained canonical irradiance packet. */
    readonly canonicalIrradiancePacketFingerprint: string;
    /** Retains the canonical packet's exact provenance object by identity. */
    readonly canonicalIrradianceProvenance: Readonly<Record<string, unknown>>;
    /** Stores the exact source angular radius. */
    readonly angularRadiusRadians: number;
    /** Stores the exact frozen camera-space center direction. */
    readonly centerDirectionCamera: UnitVector3;
    /** Stores the projected disk solid angle pi*sin(alpha)^2. */
    readonly projectedSolidAngleSteradians: number;
    /** Stores the deterministic E-to-L multiplicative scale. */
    readonly radianceScalePerSteradian: number;
    /** Supplies the derived radiance packet expected by the transport integrator. */
    readonly packet: import('../external-celestial-sources/SpectralDensityPacket.js').default;
    /** Supplies the typed extended-source owner expected by the transport integrator. */
    readonly source: import('../external-celestial-sources/ExternalCelestialSource.js').default;
    /** Retains constructor-time channel reconstruction diagnostics. */
    readonly reconstruction: CanonicalUniformSunDiskReconstruction;
    /** Retains canonical and derived quantity ownership boundaries. */
    readonly ownership: CanonicalUniformSunDiskOwnership;
    /** Returns the same immutable uniform-radiance channel array for every disk sample. */
    readonly radianceForSample: (sample: ExtendedAngularSample) => readonly number[];
}>;

type TransportedExtendedSourceModel = Readonly<{
    /** Supplies the canonical typed extended-source owner. */
    readonly source: import('../external-celestial-sources/ExternalCelestialSource.js').default;
    /** Supplies the same source-owned spectral-radiance packet. */
    readonly packet: import('../external-celestial-sources/SpectralDensityPacket.js').default;
    /** Stores the camera-space unit direction at the source center. */
    readonly centerDirectionCamera: UnitVector3;
    /** Stores the source's positive angular radius in radians. */
    readonly angularRadiusRadians: number;
    /** Samples top-of-atmosphere spectral radiance once at one quadrature sample. */
    readonly radianceForSample: (sample: ExtendedAngularSample) => readonly number[];
}>;

type TransportedExtendedSourceFiniteDepth = Readonly<{
    /** Names finite source-depth semantics. */
    readonly kind: 'finite';
    /** Stores physical source depth from the camera origin in meters. */
    readonly distanceMeters: number;
}>;

type TransportedExtendedSourceInfiniteDepth = Readonly<{
    /** Names infinite directional source-depth semantics. */
    readonly kind: 'infinite';
}>;

type TransportedExtendedSourceDepth =
    | TransportedExtendedSourceFiniteDepth
    | TransportedExtendedSourceInfiniteDepth;

type TransportedExtendedSourceIdentity = Readonly<{
    /** Identifies the canonical celestial source. */
    readonly id: string;
    /** Retains the required extended-source discriminator. */
    readonly kind: 'extended';
    /** Retains geometry ownership without duplicating source radiometry. */
    readonly geometry: CelestialGeometryOwnershipDescriptor;
    /** Identifies the immutable source contract. */
    readonly fingerprint: string;
}>;

type ExactExtendedSampleRay = Readonly<{
    /** Retains canonical source identity and geometry ownership. */
    readonly source: TransportedExtendedSourceIdentity;
    /** Stores the exact camera-space unit quadrature direction. */
    readonly directionCamera: UnitVector3;
    /** Names the direction coordinate frame. */
    readonly directionFrame: 'camera-space-unit-vector-forward-minus-z';
    /** Stores the exact finite or infinite source depth. */
    readonly depth: TransportedExtendedSourceDepth;
}>;

type ExactExtendedSampleVisibilityResult = Readonly<{
    /** States whether the exact quadrature ray reaches the source. */
    readonly visible: boolean;
    /** Retains the blocking geometry descriptor, or null when visible. */
    readonly occluder: Readonly<Record<string, unknown>> | null;
    /** Optionally retains resolver-owned blocker order, intersections, and self-exclusion. */
    readonly diagnostics?: Readonly<Record<string, unknown>>;
}>;

type ExactExtendedSampleTransmittanceResult = Readonly<{
    /** Names dimensionless transmittance units. */
    readonly units: '1';
    /** Identifies the spectral basis aligned with the returned values. */
    readonly basisFingerprint: string;
    /** Stores 15 exact-direction spectral transmittance values in [0, 1]. */
    readonly values: readonly number[];
}>;

type ExactExtendedSampleVisibilityFunction =
    ((ray: ExactExtendedSampleRay) => ExactExtendedSampleVisibilityResult)
    & Readonly<{
        /** Optionally identifies the callback with a supplied SHA-256 fingerprint. */
        readonly fingerprint?: string;
    }>;

type ExactExtendedSampleVisibilityProvider = Readonly<{
    /** Optionally identifies the provider with a supplied SHA-256 fingerprint. */
    readonly fingerprint?: string;
    /** Resolves visibility once at the supplied sample direction and depth. */
    readonly resolveExtendedSampleVisibility:
        (ray: ExactExtendedSampleRay) => ExactExtendedSampleVisibilityResult;
}>;

type ExactExtendedSampleTransmittanceFunction =
    ((ray: ExactExtendedSampleRay) => ExactExtendedSampleTransmittanceResult)
    & Readonly<{
        /** Optionally identifies the callback with a supplied SHA-256 fingerprint. */
        readonly fingerprint?: string;
    }>;

type ExactExtendedSampleTransmittanceProvider = Readonly<{
    /** Optionally identifies the provider with a supplied SHA-256 fingerprint. */
    readonly fingerprint?: string;
    /** Samples aligned transmittance once at the supplied exact sample ray. */
    readonly sampleExtendedSampleTransmittance:
        (ray: ExactExtendedSampleRay) => ExactExtendedSampleTransmittanceResult;
}>;

type TransportedExtendedSourceIntegratorConfiguration = Readonly<{
    /** Supplies exact raster projection and pixel solid angles. */
    readonly camera: import('../camera/PerspectiveCameraRaster.js').default;
    /** Supplies per-direction geometric visibility as a function or method provider. */
    readonly visibilityResolver:
        | ExactExtendedSampleVisibilityFunction
        | ExactExtendedSampleVisibilityProvider;
    /** Supplies per-direction spectral transmittance as a function or method provider. */
    readonly transmittanceSampler:
        | ExactExtendedSampleTransmittanceFunction
        | ExactExtendedSampleTransmittanceProvider;
}>;

type TransportedExtendedSourceIntegrationRequest = Readonly<{
    /** Supplies a typed extended spectral-radiance source model. */
    readonly source: TransportedExtendedSourceModel;
    /** Supplies the physical finite or infinite source depth. */
    readonly sourceDepth: TransportedExtendedSourceDepth;
    /** Supplies the positive spherical-cap radial quadrature count. */
    readonly radialCount: number;
    /** Supplies the positive spherical-cap azimuthal quadrature count. */
    readonly azimuthCount: number;
}>;

type TransportedExtendedSpectralDiagnostic = Readonly<{
    /** Names the radiance, integral, irradiance, or residual quantity. */
    readonly quantity: string;
    /** Names the exact SI units for the quantity. */
    readonly units: 'W m^-2 sr^-1 nm^-1' | 'W m^-2 nm^-1';
    /** Identifies the aligned spectral basis. */
    readonly basisFingerprint: string;
    /** Stores 15 aligned channel values. */
    readonly values: readonly number[];
}>;

type TransportedExtendedIntegralDiagnostic = Readonly<{
    /** Stores the spectral-radiance solid-angle integral. */
    readonly spectralRadianceSolidAngleIntegral: TransportedExtendedSpectralDiagnostic;
    /** Stores the cosine-weighted projected spectral irradiance. */
    readonly projectedSpectralIrradiance: TransportedExtendedSpectralDiagnostic;
}>;

type TransportedExtendedComponentSet = Readonly<{
    /** Stores all top-of-atmosphere source samples in this partition. */
    readonly input: TransportedExtendedIntegralDiagnostic;
    /** Stores visible top-of-atmosphere samples before transmittance. */
    readonly visible: TransportedExtendedIntegralDiagnostic;
    /** Stores geometrically blocked top-of-atmosphere samples. */
    readonly blocked: TransportedExtendedIntegralDiagnostic;
    /** Stores visible radiance removed by atmosphere transmittance. */
    readonly atmosphericAttenuation: TransportedExtendedIntegralDiagnostic;
    /** Stores visible top-of-atmosphere radiance multiplied by transmittance once. */
    readonly transmitted: TransportedExtendedIntegralDiagnostic;
}>;

type TransportedExtendedRasterDiagnostic = Readonly<{
    /** Retains the continuous projected coordinate, or null behind the camera. */
    readonly rasterCenter: RasterCenterCoordinate | null;
    /** Stores the nearest destination x coordinate, or null behind the camera. */
    readonly pixelX: number | null;
    /** Stores the nearest destination y coordinate, or null behind the camera. */
    readonly pixelY: number | null;
    /** States whether the nearest destination is on the frame. */
    readonly onFrame: boolean;
    /** Explains off-raster assignment, or remains null on-frame. */
    readonly offRasterReason: string | null;
}>;

type TransportedExtendedSampleEvidence = Readonly<{
    /** Stores the radial quadrature index. */
    readonly radialIndex: number;
    /** Stores the azimuthal quadrature index. */
    readonly azimuthIndex: number;
    /** Stores the sample cosine relative to the source center. */
    readonly cosTheta: number;
    /** Stores normalized radial position squared. */
    readonly rhoSquared: number;
    /** Stores exact quadrature solid-angle weight in steradians. */
    readonly solidAngleWeightSteradians: number;
    /** Retains the exact immutable ray supplied to transport callbacks. */
    readonly exactSampleRay: ExactExtendedSampleRay;
    /** Retains nearest-pixel or off-raster assignment. */
    readonly raster: TransportedExtendedRasterDiagnostic;
    /** Retains sampled top-of-atmosphere spectral radiance. */
    readonly topOfAtmosphereSpectralRadiance: TransportedExtendedSpectralDiagnostic;
    /** Retains binary visibility, occluder, and resolver fingerprint. */
    readonly visibility: Readonly<Record<string, unknown>>;
    /** Retains exact-direction transmittance, or null when blocked. */
    readonly transmittance: Readonly<Record<string, unknown>> | null;
    /** Retains top-of-atmosphere radiance multiplied by transmittance once. */
    readonly transmittedSpectralRadiance: TransportedExtendedSpectralDiagnostic;
    /** Retains exact callback counts, order, direction, depth, and object identity. */
    readonly transportCalls: Readonly<Record<string, unknown>>;
}>;

type TransportedExtendedPixelContribution = Readonly<{
    /** Stores the destination pixel x coordinate. */
    readonly pixelX: number;
    /** Stores the destination pixel y coordinate. */
    readonly pixelY: number;
    /** Stores the exact destination pixel solid angle in steradians. */
    readonly pixelSolidAngleSteradians: number;
    /** Retains input, visible, and blocked assigned solid angles. */
    readonly solidAngles: Readonly<Record<string, number>>;
    /** Retains input, visible, and blocked coverage as diagnostics only. */
    readonly derivedCoverage: Readonly<Record<string, string | number>>;
    /** Retains all integrated component diagnostics assigned to this pixel. */
    readonly integrals: TransportedExtendedComponentSet;
    /** Identifies the aligned spectral basis. */
    readonly basisFingerprint: string;
    /** Names the transported extended-radiance quantity. */
    readonly quantity: 'transported-extended-spectral-radiance-density';
    /** Names spectral radiance density units. */
    readonly units: 'W m^-2 sr^-1 nm^-1';
    /** Stores the transmitted integral divided by exact pixel solid angle. */
    readonly transportedExtendedSpectralRadianceDensity: readonly number[];
}>;

type TransportedExtendedQuadratureDiagnostic = Readonly<{
    /** Names the quadrature method. */
    readonly method: 'spherical-cap-midpoint-equal-solid-angle-v1';
    /** Stores the source angular radius in radians. */
    readonly angularRadiusRadians: number;
    /** Stores the radial quadrature count. */
    readonly radialCount: number;
    /** Stores the azimuthal quadrature count. */
    readonly azimuthCount: number;
    /** Stores the total sample count. */
    readonly sampleCount: number;
    /** Stores analytic spherical-cap solid angle in steradians. */
    readonly expectedSolidAngleSteradians: number;
    /** Stores the sum of quadrature weights in steradians. */
    readonly sampledSolidAngleSteradians: number;
    /** Stores sampled minus expected solid angle in steradians. */
    readonly solidAngleResidualSteradians: number;
    /** Stores the quadrature solid-angle residual divided by expected solid angle. */
    readonly relativeSolidAngleResidual: number;
    /** Identifies the immutable quadrature descriptor. */
    readonly fingerprint: string;
}>;

type TransportedExtendedSourceIntegration = Readonly<{
    /** Retains the canonical typed source descriptor. */
    readonly source: Readonly<Record<string, unknown>>;
    /** Retains the finite or infinite depth supplied to every sample callback. */
    readonly sourceDepth: TransportedExtendedSourceDepth;
    /** Retains the source-center camera direction. */
    readonly centerDirectionCamera: UnitVector3;
    /** Retains the source angular radius in radians. */
    readonly angularRadiusRadians: number;
    /** Retains quadrature settings, fingerprint, and solid-angle residual. */
    readonly quadrature: TransportedExtendedQuadratureDiagnostic;
    /** Stores per-pixel transported radiance and derived coverage diagnostics. */
    readonly pixels: readonly TransportedExtendedPixelContribution[];
    /** Stores exact per-sample call, direction, occluder, and transmittance evidence. */
    readonly samples: readonly TransportedExtendedSampleEvidence[];
    /** Partitions total, on-frame, and off-raster component integrals. */
    readonly integrals: Readonly<{
        readonly total: TransportedExtendedComponentSet;
        readonly onFrame: TransportedExtendedComponentSet;
        readonly offRaster: TransportedExtendedComponentSet;
    }>;
    /** Reconstructs the on-frame integral from destination radiance and exact pixel area. */
    readonly reconstructedOnFrameSpectralIntegral: TransportedExtendedSpectralDiagnostic;
    /** Retains angular coverage only as a derived diagnostic. */
    readonly derivedCoverage: Readonly<Record<string, unknown>>;
    /** Retains component equations and spectral/solid-angle residuals. */
    readonly componentConservation: Readonly<Record<string, unknown>>;
    /** Retains aggregate callback counts and exact-direction ordering evidence. */
    readonly transportCalls: Readonly<Record<string, unknown>>;
    /** Retains quantity ownership and exclusions. */
    readonly quantity: Readonly<Record<string, string>>;
    /** Retains exact SI unit declarations. */
    readonly units: Readonly<Record<string, string>>;
    /** Retains integrator, dependency, source, basis, and quadrature fingerprints. */
    readonly fingerprints: Readonly<Record<string, unknown>>;
}>;
