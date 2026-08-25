type SubjectiveSceneTimeBasis = 'flat' | 'globe';

type SubjectiveSceneLocationPreset = Readonly<{
    /** Stable location key copied from the flat32 subjective scene. */
    key: string;
    /** Short UI label. */
    label: string;
    /** Full location name. */
    name: string;
    /** Geodetic latitude in degrees. */
    latitude: number;
    /** Geodetic longitude in degrees. */
    longitude: number;
    /** ISO date used to synchronize the subjective scene. */
    dateBasis: string;
}>;

type SubjectiveSceneFlatTimePreset = Readonly<{
    /** Stable flat-time preset key. */
    key: string;
    /** Review label. */
    label: string;
    /** Clockwise flat-orbit adjustment in degrees. */
    offsetDegrees: number;
}>;

type SubjectiveSceneGlobeTimePreset = Readonly<{
    /** Stable globe-time preset key. */
    key: string;
    /** Review label. */
    label: string;
    /** Solar event resolved from synchronized solar noon. */
    kind: 'sunrise' | 'sunset' | 'solar-noon-offset';
    /** Optional hour adjustment owned by the preset. */
    offsetHours?: number;
}>;

type SubjectiveSceneTimeResolutionRequest = Readonly<{
    /** Selects a copied flat32 location preset. */
    locationKey: string;
    /** Selects flat or globe time adjustment after synchronization. */
    timeBasis: SubjectiveSceneTimeBasis;
    /** Selects a preset within the chosen time basis. */
    timePresetKey: string;
    /** Applies an explicit hour adjustment after the basis. */
    hourOffset?: number;
    /** Applies an explicit minute adjustment after the basis. */
    minuteOffset?: number;
}>;

type SubjectiveSceneBasisResolution = Readonly<{
    basisResolvedTimeIso: string;
    basisAdjustment: Readonly<Record<string, unknown>>;
    eventAvailability: Readonly<Record<string, unknown>>;
    diagnostics: Readonly<Record<string, unknown>>;
}>;

type SubjectiveSceneTimeResolution = Readonly<{
    kind: 'subjective-scene-time-resolution';
    snapshot: Readonly<Record<string, unknown>>;
    location: SubjectiveSceneLocationPreset;
    synchronizedTimeIso: string;
    timeBasis: SubjectiveSceneTimeBasis;
    timePreset: SubjectiveSceneFlatTimePreset | SubjectiveSceneGlobeTimePreset;
    basisResolvedTimeIso: string;
    basisAdjustment: Readonly<Record<string, unknown>>;
    explicitAdjustment: Readonly<{
        hourOffset: number;
        minuteOffset: number;
        totalMinutes: number;
    }>;
    finalTimeIso: string;
    eventAvailability: Readonly<Record<string, unknown>>;
    diagnostics: Readonly<Record<string, unknown>>;
}>;
