type DisplayConversionDescriptor = {
    readonly conversionKind: string;
    readonly outputColorSpace: string;
    readonly toneMapping?: string;
    readonly metadata?: unknown;
};

interface ColorDisplayModel {
    describeDisplayConversion(): DisplayConversionDescriptor;
    radianceToLinearSrgb(radiance: SpectralValue): readonly [number, number, number];
    radianceToDisplayRgb(radiance: SpectralValue): readonly [number, number, number];
    linearSrgbToDisplayRgb?(linearSrgb: readonly [number, number, number]): readonly [number, number, number];
}
