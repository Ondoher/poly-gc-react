type Er6PhysicalSourceIdentityInput = Readonly<{
    /** Identifies one canonical point or extended source owner. */
    readonly id: string;
    /** Distinguishes point irradiance from extended radiance ownership. */
    readonly kind: 'point' | 'extended';
    /** Identifies the immutable canonical source contract. */
    readonly fingerprint: string;
}>;

type Er6PhysicalSourceIdentity = Readonly<{
    /** Identifies one canonical point or extended source owner. */
    readonly id: string;
    /** Distinguishes point and extended physical source paths. */
    readonly kind: 'point' | 'extended';
    /** Identifies the immutable canonical source contract. */
    readonly fingerprint: string;
}>;

type Er6GlobeCaseMatrixRequest = Readonly<{
    /** Supplies identity views of canonical sources without copying radiometry. */
    readonly sourceIdentities: readonly Er6PhysicalSourceIdentityInput[];
}>;

type Er6GlobeCaseObserver = Readonly<{
    /** Identifies the Flat32 location owner. */
    readonly id: string;
    /** Stores geodetic observer latitude in degrees. */
    readonly latitudeDegrees: number;
    /** Stores geodetic observer longitude in degrees. */
    readonly longitudeDegrees: number;
    /** Stores snapshot-derived observer elevation in kilometers. */
    readonly elevationKm: number;
}>;

type Er6HorizonsObserver = Er6GlobeCaseObserver;

type Er6HorizonsPhysicalGlobeStateProviderConfiguration = Readonly<{
    /** Supplies fetch for live acquisition or deterministic mock verification. */
    readonly fetchImplementation?: typeof globalThis.fetch;
}>;

type Er6HorizonsPhysicalGlobeStateRequest = Readonly<{
    /** Supplies one canonical millisecond ISO UTC case time. */
    readonly timeIso: string;
    /** Supplies the exact topocentric Earth observer. */
    readonly observer: Er6HorizonsObserver;
}>;

type Er6LunarPhysicalAspect = Readonly<{
    /** Names the physical-aspect schema. */
    readonly schemaVersion: 1;
    /** Stores the exact returned UTC. */
    readonly epochIso: string;
    /** Identifies the high-precision lunar mean-Earth rotation frame. */
    readonly frame: 'MOON_ME';
    /** States that increasing longitude is eastward. */
    readonly longitudeConvention: 'east-positive';
    /** Stores observer sub-longitude in degrees. */
    readonly subobserverLongitudeDegrees: number;
    /** Stores observer sub-latitude in degrees. */
    readonly subobserverLatitudeDegrees: number;
    /** Stores solar sub-longitude in degrees. */
    readonly subsolarLongitudeDegrees: number;
    /** Stores solar sub-latitude in degrees. */
    readonly subsolarLatitudeDegrees: number;
    /** Stores wrapped ObsSub-LON minus SunSub-LON in degrees. */
    readonly shortestEastPositiveLongitudeDeltaDegrees: number;
    /** Stores spherical angular separation of the two subpoints in degrees. */
    readonly absolutePhaseDegrees: number;
    /** Stores phase magnitude with the wrapped east-positive longitude sign. */
    readonly signedPhaseDegrees: number;
    /** Names the signed spherical-separation implementation. */
    readonly method: string;
    /** Retains verified Horizons frame, convention, and CSV labels. */
    readonly header: Readonly<Record<string, unknown>>;
    /** Retains the physical-aspect query provenance. */
    readonly provenance: Readonly<Record<string, unknown>>;
    /** Identifies the immutable lunar-aspect value. */
    readonly fingerprint: string;
}>;

type Er6HorizonsRawQuery = Readonly<{
    /** Distinguishes vector and lunar physical-aspect queries. */
    readonly queryKind: 'vector' | 'lunar-aspect-observer';
    /** Stores Horizons target 301 or 10. */
    readonly target: '301' | '10';
    /** Identifies the topocentric observer, or null for geocentric vectors. */
    readonly observerId: string | null;
    /** Stores the exact requested UTC. */
    readonly requestedEpochIso: string;
    /** Stores the exact returned UTC. */
    readonly returnedEpochIso: string;
    /** Stores vector Julian date, or null for the observer table. */
    readonly returnedEpochJulianDateUt: number | null;
    /** Retains the Horizons calendar-form returned epoch. */
    readonly returnedEpochCalendarDateUt: string;
    /** Optionally identifies the lunar aspect derived from the fifth query. */
    readonly lunarAspectFingerprint?: string;
    /** Retains the exact acquisition URL. */
    readonly url: string;
    /** Identifies the exact URL with SHA-256. */
    readonly queryHash: string;
    /** Retains the Horizons API version. */
    readonly apiVersion: string;
    /** Retains the Horizons API source. */
    readonly apiSource: string;
    /** Retains the complete raw JSON response. */
    readonly payload: Readonly<Record<string, unknown>>;
}>;

type Er6HorizonsPhysicalGlobeState = Readonly<{
    /** Names the reset-only five-query state schema. */
    readonly kind: 'er6-horizons-physical-globe-state-v1';
    /** Names the state schema version. */
    readonly schemaVersion: 1;
    /** Retains geometric Sun/Moon vectors and exact returned epoch. */
    readonly worldState: CelestialWorldState;
    /** Retains the exact topocentric observer reconstructed independently. */
    readonly observerState: GlobeObserverState;
    /** Retains the fifth-query physical lunar aspect by identity. */
    readonly lunarAspect: Er6LunarPhysicalAspect;
    /** Retains exactly five ordered query hashes and API identity. */
    readonly provenance: Readonly<Record<string, unknown>>;
    /** Identifies the normalized state and ordered query identities. */
    readonly fingerprint: string;
}>;

type Er6SignedPhaseOracleDiagnostic = Readonly<{
    /** Identifies the retained AIR-LUSI source. */
    readonly source: string;
    /** Retains the authoritative AIR-LUSI DOI. */
    readonly sourceDoi: string;
    /** Retains the authoritative AIR-LUSI fixture hash. */
    readonly sourceHashSha256: string;
    /** Names the signed spherical-separation implementation. */
    readonly method: string;
    /** Stores the predeclared oracle tolerance in degrees. */
    readonly toleranceDegrees: number;
    /** Stores the maximum absolute residual across four flights. */
    readonly maximumAbsoluteResidualDegrees: number;
    /** States whether every oracle row passes. */
    readonly accepted: boolean;
    /** Retains all four flight diagnostics. */
    readonly cases: readonly Readonly<Record<string, unknown>>[];
}>;

type Er6GlobeEphemerisRequest = Readonly<{
    /** Stores the exact case UTC requested from Horizons. */
    readonly timeIso: string;
    /** Supplies the exact topocentric observer. */
    readonly observer: Er6GlobeCaseObserver;
}>;

type Er6GlobeCaseDefinition = Readonly<{
    /** Names the reset-only case schema. */
    readonly kind: 'er6-globe-case-v1';
    /** Identifies the resolver that created this case. */
    readonly resolverFingerprint: string;
    /** Identifies the location/event pair. */
    readonly id: string;
    /** Stores deterministic matrix order. */
    readonly ordinal: number;
    /** Identifies sunrise, solar noon, sunset, or sunset plus one hour. */
    readonly eventId: string;
    /** Retains the bounded scene identity without legacy scene radiometry. */
    readonly sceneIdentity: Readonly<Record<string, unknown>>;
    /** Retains only canonical physical source identities. */
    readonly sourceIdentities: readonly Er6PhysicalSourceIdentity[];
    /** Retains the existing time-owner location packet. */
    readonly location: SubjectiveSceneLocationPreset;
    /** Stores the exact UTC used for acquisition and rendering. */
    readonly exactTimeIso: string;
    /** Retains the existing resolver-owned time packet. */
    readonly timeResolution: SubjectiveSceneTimeResolution;
    /** Retains signed-offset and native-event availability diagnostics. */
    readonly schedule: Readonly<Record<string, unknown>>;
    /** Supplies the exact topocentric observer. */
    readonly observer: Er6GlobeCaseObserver;
    /** Supplies the existing Horizons provider request directly. */
    readonly ephemerisRequest: Er6GlobeEphemerisRequest;
    /** States the legacy radiometry and display exclusions. */
    readonly exclusions: Readonly<Record<string, unknown>>;
    /** Identifies the immutable derived case view. */
    readonly fingerprint: string;
}>;

type Er6GlobeCaseMatrix = Readonly<{
    /** Names the exact eight-case matrix schema. */
    readonly kind: 'er6-globe-case-matrix-v1';
    /** Identifies the matrix resolver. */
    readonly resolverFingerprint: string;
    /** Identifies the exact derived matrix and source identities. */
    readonly fingerprint: string;
    /** Retains the bounded scene identity. */
    readonly sceneIdentity: Readonly<Record<string, unknown>>;
    /** Retains only canonical physical source identities. */
    readonly sourceIdentities: readonly Er6PhysicalSourceIdentity[];
    /** Stores deterministic location order. */
    readonly locationOrder: readonly string[];
    /** Stores deterministic time-slot order. */
    readonly timeSlotOrder: readonly string[];
    /** Stores the required value eight. */
    readonly caseCount: 8;
    /** Stores four San Jose and four Union Glacier cases. */
    readonly cases: readonly Er6GlobeCaseDefinition[];
    /** States the legacy radiometry and display exclusions. */
    readonly exclusions: Readonly<Record<string, unknown>>;
}>;

type Er6ReturnedEphemerisAttachmentRequest = Readonly<{
    /** Supplies one untampered case from resolveCaseMatrix. */
    readonly matrixCase: Er6GlobeCaseDefinition;
    /** Supplies the same frozen state returned by Er6HorizonsPhysicalGlobeStateProvider. */
    readonly ephemerisState: Er6HorizonsPhysicalGlobeState;
    /** Supplies the five exact raw-query diagnostics retained by the provider. */
    readonly rawQueries: readonly Er6HorizonsRawQuery[];
}>;

type Er6GlobeCaseWithEphemeris = Readonly<{
    /** Names the returned-epoch attachment schema. */
    readonly kind: 'er6-globe-case-with-ephemeris-v1';
    /** Identifies the exact case, query identities, and adapted geometry. */
    readonly fingerprint: string;
    /** Retains the original matrix case. */
    readonly matrixCase: Er6GlobeCaseDefinition;
    /** Retains the provider-owned state by object identity. */
    readonly ephemerisState: Er6ReturnedEphemerisAttachmentRequest['ephemerisState'];
    /** Retains the provider-owned physical lunar aspect by object identity. */
    readonly lunarAspect: Er6LunarPhysicalAspect;
    /** Retains observer-local Sun and Moon geometry from the existing adapter. */
    readonly sceneGeometry: Readonly<Record<string, unknown>>;
    /** Retains requested and returned epoch equality diagnostics. */
    readonly returnedEpoch: Readonly<Record<string, unknown>>;
    /** Retains compact identities for all five exact queries. */
    readonly queryIdentities: readonly Readonly<Record<string, unknown>>[];
    /** States which existing module owns each retained artifact. */
    readonly ownership: Readonly<Record<string, unknown>>;
    /** States the legacy radiometry and display exclusions. */
    readonly exclusions: Readonly<Record<string, unknown>>;
}>;

/** Creates one fresh single-use physical-state provider for a matrix case. */
type Er6PhysicalGlobeStateProviderFactory = (
    matrixCase: Er6GlobeCaseDefinition,
) => import('./Er6HorizonsPhysicalGlobeStateProvider.js').default;

/** Configures the sole case owner and the per-case provider factory. */
type Er6PhysicalGlobeStateMatrixAcquirerConfiguration = Readonly<{
    /** Supplies the sole owner of the exact eight-case schedule and attachments. */
    readonly caseMatrixResolver:
        import('./Er6GlobeCaseMatrixResolver.js').default;
    /** Creates one fresh single-use Horizons provider for each matrix case. */
    readonly providerFactory?: Er6PhysicalGlobeStateProviderFactory;
}>;

/** Requests acquisition of one exact resolver-owned case matrix. */
type Er6PhysicalGlobeStateMatrixAcquisitionRequest = Readonly<{
    /** Supplies the untampered exact eight-case resolver output. */
    readonly caseMatrix: Er6GlobeCaseMatrix;
}>;

/** Retains one provider-owned raw query with its derived payload identity. */
type Er6PhysicalGlobeStateQueryArtifact = Readonly<{
    /** Names the retained raw-query artifact schema. */
    readonly kind: 'er6-physical-globe-state-query-artifact-v1';
    /** Stores the provider-owned order from zero through four. */
    readonly ordinal: number;
    /** Identifies the case, query order, URL hash, and payload hash together. */
    readonly identity: string;
    /** Identifies the complete raw Horizons JSON payload. */
    readonly payloadHash: string;
    /** Retains the provider-owned payload, URL hash, API version, and epoch. */
    readonly rawQuery: Er6HorizonsRawQuery;
}>;

/** Compares independently reconstructed observer vectors for one case. */
type Er6ObserverReconstructionDiagnostic = Readonly<{
    /** Names the independent observer-reconstruction diagnostic schema. */
    readonly kind: 'er6-observer-reconstruction-diagnostic-v1';
    /** Identifies the matrix case. */
    readonly caseId: string;
    /** Stores the exact case and returned UTC. */
    readonly epochIso: string;
    /** States the geocentric-minus-topocentric reconstruction equation. */
    readonly equation: string;
    /** Reconstructs the observer position from Moon vectors in kilometers. */
    readonly observerFromMoonKm: readonly number[];
    /** Reconstructs the observer position from Sun vectors in kilometers. */
    readonly observerFromSunKm: readonly number[];
    /** Retains the provider-owned observer position in kilometers. */
    readonly retainedObserverPositionKm: readonly number[];
    /** Stores the independent Moon-versus-Sun reconstruction residual. */
    readonly moonSunAgreementKm: number;
    /** Stores the Moon reconstruction residual against the retained position. */
    readonly moonRetainedResidualKm: number;
    /** Stores the Sun reconstruction residual against the retained position. */
    readonly sunRetainedResidualKm: number;
    /** Retains the provider's independently stored agreement diagnostic. */
    readonly providerReportedAgreementKm: number;
    /** Stores the residual between recomputed and provider agreement values. */
    readonly providerAgreementResidualKm: number;
}>;

/** Summarizes independent observer reconstruction over all eight cases. */
type Er6ObserverReconstructionMatrixDiagnostic = Readonly<{
    /** Names the eight-case observer diagnostic schema. */
    readonly kind: 'er6-observer-reconstruction-matrix-diagnostic-v1';
    /** Retains one observer diagnostic per exact matrix case. */
    readonly cases: readonly Er6ObserverReconstructionDiagnostic[];
    /** Stores the maximum Moon-versus-Sun reconstruction residual. */
    readonly maximumMoonSunAgreementKm: number;
    /** Stores the maximum Moon-versus-retained-position residual. */
    readonly maximumMoonRetainedResidualKm: number;
    /** Stores the maximum Sun-versus-retained-position residual. */
    readonly maximumSunRetainedResidualKm: number;
    /** Stores the maximum residual against the provider's diagnostic. */
    readonly maximumProviderAgreementResidualKm: number;
}>;

/** Retains one exact case, five raw queries, state, and attachment. */
type Er6PhysicalGlobeStateCaseAcquisition = Readonly<{
    /** Names one exact returned-epoch case acquisition schema. */
    readonly kind: 'er6-physical-globe-state-case-acquisition-v1';
    /** Identifies the location/event pair. */
    readonly caseId: string;
    /** Stores exact sequential acquisition order. */
    readonly caseOrdinal: number;
    /** Retains the resolver-owned case by identity. */
    readonly matrixCase: Er6GlobeCaseDefinition;
    /** Retains the provider-owned five-query physical state by identity. */
    readonly physicalState: Er6HorizonsPhysicalGlobeState;
    /** Retains all five provider-owned raw query payloads and provenance. */
    readonly rawQueries: readonly Er6HorizonsRawQuery[];
    /** Adds stable identities and payload hashes without replacing raw ownership. */
    readonly queryArtifacts: readonly Er6PhysicalGlobeStateQueryArtifact[];
    /** Retains the resolver-owned returned-epoch attachment. */
    readonly ephemerisAttachment: Er6GlobeCaseWithEphemeris;
    /** Retains independently recomputed observer-position diagnostics. */
    readonly observerReconstruction: Er6ObserverReconstructionDiagnostic;
    /** States canonical ownership and the radiometry exclusion. */
    readonly ownership: Readonly<Record<string, string>>;
    /** Identifies the case, state, attachment, raw queries, and diagnostics. */
    readonly fingerprint: string;
}>;

/** Retains the immutable sequential eight-case, forty-query acquisition. */
type Er6PhysicalGlobeStateMatrixAcquisition = Readonly<{
    /** Names the immutable forty-query acquisition matrix schema. */
    readonly kind: 'er6-physical-globe-state-matrix-acquisition-v1';
    /** Names the matrix schema version. */
    readonly schemaVersion: 1;
    /** Identifies the sequential acquisition policy. */
    readonly acquirerFingerprint: string;
    /** Identifies the exact case-matrix resolver. */
    readonly resolverFingerprint: string;
    /** Retains the resolver-owned eight-case matrix by identity. */
    readonly caseMatrix: Er6GlobeCaseMatrix;
    /** Stores the required value eight. */
    readonly caseCount: 8;
    /** Stores the required value five. */
    readonly queryCountPerCase: 5;
    /** Stores the required value forty. */
    readonly totalQueryCount: 40;
    /** Retains eight sequential physical-state acquisitions. */
    readonly cases: readonly Er6PhysicalGlobeStateCaseAcquisition[];
    /** Summarizes observer reconstruction without adding an acceptance gate. */
    readonly observerReconstructionDiagnostics:
        Er6ObserverReconstructionMatrixDiagnostic;
    /** States canonical ownership and excluded radiometry/display layers. */
    readonly ownership: Readonly<Record<string, string>>;
    /** Identifies every acquired state, raw payload, attachment, and diagnostic. */
    readonly fingerprint: string;
}>;

type Er6LimeGlobeMoonIrradianceProviderConfiguration = Readonly<{
    /** Supplies the already accepted release-authoritative LIME model owner. */
    readonly model: import('../external-celestial-sources/LimeCoefficientModel.js').default;
    /** Identifies the one globe-Moon source shared by irradiance and disk transport. */
    readonly sourceId: string;
}>;

type Er6LimeGlobeMoonIrradianceRequest = Readonly<{
    /** Supplies one exact returned-epoch physical Horizons state. */
    readonly physicalState: Er6HorizonsPhysicalGlobeState;
}>;

type Er6LimeDiskIntegratedSpectralIrradiance = Readonly<{
    /** Names disk-integrated spectral irradiance density. */
    readonly quantity: 'spectral-irradiance-density';
    /** Names the exact SI density units. */
    readonly units: 'W m^-2 nm^-1';
    /** Identifies the accepted canonical 15-channel basis. */
    readonly basisFingerprint: string;
    /** Stores the release-authoritative canonical-Sun-transferred central values. */
    readonly values: readonly number[];
    /** States the accepted calibration and transfer branch. */
    readonly calibration: string;
    /** Keeps record 049 as the joint-uncertainty owner. */
    readonly uncertaintyStatus: string;
}>;

type Er6LimeGlobeMoonGeometry = Readonly<{
    /** Stores the exact Horizons returned UTC. */
    readonly epochIso: string;
    /** Names the observer-independent vector frame. */
    readonly frame: CelestialWorldState['frame'];
    /** Stores the returned-epoch observer-to-Moon J2000 unit direction. */
    readonly directionJ2000: readonly number[];
    /** Stores exact finite observer-to-Moon body-center depth in meters. */
    readonly finiteBodyCenterDepthMeters: number;
    /** Stores the Moon's physical angular radius in radians. */
    readonly angularRadiusRadians: number;
    /** Stores east-positive signed lunar phase in degrees. */
    readonly signedPhaseDegrees: number;
    /** Stores absolute lunar phase in degrees. */
    readonly absolutePhaseDegrees: number;
    /** Stores observer sub-longitude in MOON_ME degrees. */
    readonly subobserverLongitudeDegrees: number;
    /** Stores observer sub-latitude in MOON_ME degrees. */
    readonly subobserverLatitudeDegrees: number;
    /** Stores solar sub-longitude in MOON_ME degrees. */
    readonly subsolarLongitudeDegrees: number;
    /** Retains solar sub-latitude in MOON_ME degrees. */
    readonly subsolarLatitudeDegrees: number;
    /** Stores observer sub-longitude wrapped to LIME's signed-degree domain. */
    readonly limeSubobserverLongitudeDegrees: number;
    /** Stores solar sub-longitude wrapped to LIME's signed-degree domain. */
    readonly limeSubsolarLongitudeDegrees: number;
    /** Names the explicit Horizons-to-LIME longitude normalization. */
    readonly limeLongitudeNormalization:
        'signed-longitude-in-minus-180-to-180-degrees';
    /** States that LIME retains but does not consume subsolar latitude. */
    readonly subsolarLatitudeDisposition:
        'retained-but-not-consumed-by-lime-v1.4.1-equation';
    /** Stores observer-to-Moon distance in kilometers. */
    readonly observerMoonDistanceKilometers: number;
    /** Stores Sun-to-Moon distance in kilometers. */
    readonly sunMoonDistanceKilometers: number;
    /** Stores Sun-to-Moon distance in astronomical units. */
    readonly sunMoonDistanceAstronomicalUnits: number;
}>;

type Er6LimeGlobeMoonIrradianceEvaluation = Readonly<{
    /** Names the reset-only LIME physical-state evaluation schema. */
    readonly kind: 'er6-lime-globe-moon-irradiance-evaluation-v1';
    /** Identifies physical state, geometry, calibration owner, and central values. */
    readonly fingerprint: string;
    /** Identifies the provider policy. */
    readonly providerFingerprint: string;
    /** Retains the canonical globe-Moon source identity. */
    readonly sourceId: string;
    /** Retains the exact provider-owned physical state by identity. */
    readonly physicalState: Er6HorizonsPhysicalGlobeState;
    /** Retains the state's physical lunar aspect by identity. */
    readonly lunarAspect: Er6LunarPhysicalAspect;
    /** Retains the same canonical basis object held by the LIME model. */
    readonly basis: import('../external-celestial-sources/SpectralDensityBasis.js').default;
    /** Retains the same canonical Sun packet held by the LIME model. */
    readonly canonicalSolar:
        import('../external-celestial-sources/SpectralDensityPacket.js').default;
    /** Retains physical geometry derived only from the returned-epoch state. */
    readonly geometry: Er6LimeGlobeMoonGeometry;
    /** Retains the exact request supplied to the accepted LIME model. */
    readonly modelRequest: LimeCalibrationRequest;
    /** Retains the complete accepted LIME evaluation without copied outputs. */
    readonly modelEvaluation: ReturnType<
        import('../external-celestial-sources/LimeCoefficientModel.js').default['evaluate']
    >;
    /** Supplies the typed disk-integrated central spectral irradiance. */
    readonly diskIntegratedSpectralIrradiance:
        Er6LimeDiskIntegratedSpectralIrradiance;
    /** Retains release, coefficient, ASD, canonical-Sun, and basis identities. */
    readonly provenance: Readonly<Record<string, unknown>>;
    /** States which existing object owns each canonical fact. */
    readonly ownership: Readonly<Record<string, string>>;
    /** States the disk-integrated and unsupported-spatial claim boundary. */
    readonly qualifications: Readonly<Record<string, string>>;
}>;

type Er6PhysicalStateCameraTransform = Readonly<{
    /** Names the verifiable physical-state-to-camera rotation seam. */
    readonly kind: 'physical-state-to-camera-transform-v1';
    /** Identifies the unchanged returned-epoch physical state. */
    readonly physicalStateFingerprint: string;
    /** Names the source direction's J2000 frame. */
    readonly sourceFrame: CelestialWorldState['frame'];
    /** Stores the unchanged provider-derived J2000 unit direction. */
    readonly sourceDirectionJ2000: readonly number[];
    /** Stores the proper orthonormal row-major J2000-to-camera rotation. */
    readonly j2000ToCameraRotationMatrix: readonly (readonly number[])[];
    /** Names the exact matrix multiplication convention. */
    readonly matrixConvention:
        'row-major-direction-camera-equals-matrix-times-source-direction-j2000';
    /** Names the TransportedExtendedSourceIntegrator camera-axis convention. */
    readonly cameraDirectionFrame: 'camera-space-unit-vector-forward-minus-z';
}>;

type Er6UniformGlobeMoonDiskSourceConfiguration = Readonly<{
    /** Supplies one accepted disk-integrated LIME evaluation. */
    readonly evaluation: Er6LimeGlobeMoonIrradianceEvaluation;
    /** Supplies a verifiable camera rotation for that same physical state. */
    readonly cameraTransform: Er6PhysicalStateCameraTransform;
}>;

type Er6UniformGlobeMoonDiskReconstruction = Readonly<{
    /** Names the exact projected-uniform-disk normalization. */
    readonly equation: 'E_lambda = L_lambda * pi * sin(alpha)^2';
    /** Stores pi times sin squared angular radius in steradians. */
    readonly projectedDiskSolidAngleSteradians: number;
    /** Retains the input disk-integrated LIME values. */
    readonly inputSpectralIrradianceValues: readonly number[];
    /** Stores the uniform transport-surrogate radiance values. */
    readonly radianceValues: readonly number[];
    /** Reconstructs disk-integrated irradiance from the surrogate. */
    readonly reconstructedSpectralIrradianceValues: readonly number[];
    /** Stores one relative reconstruction residual per channel. */
    readonly relativeResiduals: readonly number[];
    /** Stores the maximum channel reconstruction residual. */
    readonly maximumRelativeResidual: number;
    /** Stores the predeclared reconstruction tolerance. */
    readonly tolerance: number;
    /** States whether reconstruction satisfies the tolerance. */
    readonly status: 'accepted' | 'rejected';
}>;

type Er6Flat32PhysicalSceneGeometryConfiguration = Readonly<{
    /** Supplies the returned-epoch ecliptic-J2000 observer basis. */
    readonly observerBasis: Readonly<{
        readonly up: readonly number[];
        readonly east: readonly number[];
        readonly north: readonly number[];
        readonly pole?: readonly number[];
        readonly equatorialRadial?: readonly number[];
    }>;
    /** Optionally repeats the frozen Flat32 presentation direction. */
    readonly presentationDirectionScene?: readonly number[];
    /** Supplies deterministic finite-depth tie tolerance in meters. */
    readonly depthTieToleranceMeters?: number;
}>;

type Er6Flat32BaseRayResolution = Readonly<{
    /** Names the geometry-only base-ray schema. */
    readonly kind: 'er6-flat32-physical-base-ray-v1';
    /** Identifies the reset-owned scene geometry. */
    readonly geometryFingerprint: string;
    /** Stores exact camera, scene, and atmosphere directions. */
    readonly directionCamera: readonly number[];
    readonly directionScene: readonly number[];
    /** Retains finite scene identity/depth or an explicit no-hit result. */
    readonly sceneIntersection: Readonly<Record<string, unknown>>;
    /** Is always null because authored RGB is not physical endpoint radiance. */
    readonly endpointContribution: null;
}>;

type Er6CalspecSiriusCatalogPointSourceConfiguration = Readonly<{
    /** Supplies the accepted CALSPEC Sirius spectral-irradiance packet. */
    readonly calspecPacket:
        import('../external-celestial-sources/SpectralDensityPacket.js').default;
    /** Maps ecliptic J2000 directions into camera space. */
    readonly j2000ToCameraRotationMatrix: readonly (readonly number[])[];
}>;

type Er6PhysicalGlobeSceneRendererNumericalControls = Readonly<{
    readonly pathIntervalCount: number;
    readonly sourceTransmittanceIntervalCount: number;
    readonly incidentDirectionCount: number;
    readonly incidentAltitudeBinCount: number;
}>;

type Er6PhysicalGlobeSceneRendererQuadrature = Readonly<{
    readonly sun: Readonly<{ readonly radialCount: number; readonly azimuthCount: number }>;
    readonly moon: Readonly<{ readonly radialCount: number; readonly azimuthCount: number }>;
}>;

type Er6PhysicalGlobeSceneRendererConfiguration = Readonly<{
    /** Supplies exact pixel rays and solid angles. */
    readonly camera: import('../camera/PerspectiveCameraRaster.js').default;
    /** Supplies the one canonical solar packet shared by all consumers. */
    readonly canonicalSolarIrradiance:
        import('../external-celestial-sources/SpectralDensityPacket.js').default;
    /** Supplies accepted CALSPEC Sirius irradiance on the same basis object. */
    readonly calspecSiriusIrradiance:
        import('../external-celestial-sources/SpectralDensityPacket.js').default;
    /** Supplies the accepted release-authoritative LIME bridge. */
    readonly lunarIrradianceProvider: Er6LimeGlobeMoonIrradianceProvider;
    /** Supplies the sole global post-composition display owner. */
    readonly displayModel: Readonly<Record<string, unknown>>;
    /** Supplies all frozen atmosphere numerical controls explicitly. */
    readonly atmosphereControls: Er6PhysicalGlobeSceneRendererNumericalControls;
    /** Supplies Sun and Moon directional quadrature explicitly. */
    readonly extendedQuadrature: Er6PhysicalGlobeSceneRendererQuadrature;
    /** Supplies deterministic depth-tie tolerance in meters. */
    readonly depthTieToleranceMeters: number;
}>;

type Er6PhysicalGlobeSceneRenderRequest = Readonly<{
    /** Supplies one resolver-owned exact returned-epoch case attachment. */
    readonly caseAttachment: Er6GlobeCaseWithEphemeris;
    /** Selects full acceptance evidence or compact display pixels for large review frames. */
    readonly outputMode?: 'full-evidence' | 'compact-review';
    /** Supplies explicitly nonastronomical on-frame Moon/Sirius presentation directions. */
    readonly presentationOverrides?: Readonly<{
        readonly id: string;
        readonly astronomicalPosition: false;
        readonly moonDirectionCamera: UnitVector3;
        readonly siriusDirectionCamera: UnitVector3;
    }>;
}>;

type Er6PhysicalGlobeSceneCaseResult = Readonly<{
    /** Names the complete physical case-result schema. */
    readonly kind: 'er6-physical-globe-scene-case-v1';
    /** Identifies the exact location/event case and epoch. */
    readonly caseId: string;
    readonly caseOrdinal: number;
    readonly epochIso: string;
    /** Retains detached source, geometry, atmosphere, frame, and status evidence. */
    readonly geometry: Readonly<Record<string, unknown>>;
    readonly sources: Readonly<Record<string, unknown>>;
    readonly atmosphere: Readonly<Record<string, unknown>>;
    readonly baseFrame: Readonly<Record<string, unknown>>;
    readonly transport: Readonly<Record<string, unknown>>;
    readonly composition: Readonly<Record<string, unknown>>;
    readonly status: Readonly<Record<string, unknown>>;
    /** Identifies every accepted dependency and completed output. */
    readonly fingerprints: Readonly<Record<string, string>>;
}>;
