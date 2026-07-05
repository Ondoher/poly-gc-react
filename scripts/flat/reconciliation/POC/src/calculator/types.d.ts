interface SpectralCalculatorLike {
    buildEndpointTrapezoidPathIntegrationPoints(
        viewRaySegment: RaySegment,
        pathIntervalCount: number,
    ): readonly PathIntegrationPoint[];
    computeRadiance(
        viewRaySegment: RaySegment,
        pathIntegrationPoints: readonly PathIntegrationPoint[],
        options?: ComputeRadianceOptions,
    ): PathRadiance;
}

type SpectralCalculatorConfig = {
    readonly geometry?: GeometryModel;
    readonly atmosphere?: AtmosphereModel;
    readonly lightSource?: LightSourceModel;
    readonly spectralBasis?: SpectralBasis;
    readonly executionControls?: ExecutionControls;
};

type ComputeRadianceOptions = {
    readonly incidentRadianceSampling?: IncidentRadianceSampling | null;
};

