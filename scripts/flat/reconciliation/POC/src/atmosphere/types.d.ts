type MediumSample = {
    readonly extinction: SpectralValue;
    readonly scattering: SpectralValue;
    readonly rayleighScattering: SpectralValue;
    readonly mieScattering: SpectralValue;
    readonly mieExtinction: SpectralValue;
    readonly absorption: SpectralValue;
    readonly density: {
        readonly rayleigh: number;
        readonly mie: number;
        readonly absorption: number;
    };
};

type OpticalDepthSample = {
    readonly opticalDepth: SpectralValue;
    readonly transmittance: SpectralValue;
};

type PhaseSample = {
    readonly phase: SpectralValue;
    readonly rayleighPhase: number;
    readonly miePhase: number;
};

interface AtmosphereModel {
    sampleMedium(coordinate: AtmosphereCoordinate): MediumSample;
    integrateOpticalDepth(path: AtmospherePath): OpticalDepthSample;
    samplePhase(...args: readonly unknown[]): PhaseSample;
}

type CanonicalAtmosphereConfig = {
    readonly constants: CanonicalAtmosphereConstants;
    readonly spectralChannels: readonly SpectralChannelConstant[];
};

