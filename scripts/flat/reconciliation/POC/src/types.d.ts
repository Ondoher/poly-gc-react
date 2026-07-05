type Position = readonly [number, number, number];

type UnitVector3 = readonly [number, number, number];

type SpectralValue = readonly number[];

type SpectralBasis = {
    readonly wavelengthsNanometers: readonly number[];
};

type Ray = {
    readonly origin: Position;
    readonly direction: UnitVector3;
};

type RaySegment = {
    readonly ray: Ray;
    readonly startDistanceMeters: number;
    readonly endDistanceMeters: number;
};

type PathIntegrationPoint = {
    readonly pointIndex: number;
    readonly distanceAlongRayMeters: number;
    readonly intervalLengthFromPreviousMeters: number;
    readonly trapezoidWeight: number;
    readonly measureMeters: number;
};

type PathRadiance = {
    readonly inScattered: SpectralValue;
    readonly transmittance: SpectralValue;
    readonly diagnostics?: unknown;
};

type ExecutionControls = {
    readonly pathIntervalCount?: number;
    readonly maxPathIntervalCount?: number;
    readonly sourceTransmittanceIntervalCount?: number;
    readonly incidentDirectionCount?: number;
    readonly incidentAltitudeBinCount?: number;
    readonly incidentZBinCount?: number;
    readonly incidentRhoBinCount?: number;
};

type TransportState = {
    readonly inScattered: SpectralValue;
    readonly transmittance: SpectralValue;
    readonly previousExtinction?: SpectralValue | null;
};

type ReconciliationDiagnostic = {
    readonly id: string;
    readonly severity: 'info' | 'warning' | 'error';
    readonly message: string;
    readonly details?: unknown;
};

