type MoonPhaseKind = 'new' | 'first-quarter' | 'full' | 'last-quarter';

type MoonPhaseProvenance = Readonly<{
    source: 'NASA/JPL Horizons API' | 'reconciliation-poc-fixture';
    sourceVersion: string;
    queryHashes: readonly string[];
    fetchedAtIso: string;
    normalizationVersion: string;
}>;

type MoonPhaseAtTimeResult = Readonly<{
    schemaVersion: 1;
    timeIso: string;
    cycleAngleDegrees: number;
    illuminatedFraction: number;
    phaseName: string;
    waxing: boolean;
    provenance: MoonPhaseProvenance;
}>;

type NextMoonPhaseResult = Readonly<{
    schemaVersion: 1;
    eventKind: 'moon-phase';
    phase: MoonPhaseKind;
    phaseDegrees: number;
    eventTimeIso: string;
    illuminatedFraction: number;
    search: Readonly<{
        afterTimeIso: string;
        horizonDays: number;
        coarseStepMinutes: number;
        refinementStepMinutes: number;
        toleranceSeconds: number;
    }>;
    provenance: MoonPhaseProvenance;
}>;
