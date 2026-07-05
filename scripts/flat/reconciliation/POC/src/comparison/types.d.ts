type ImageComparisonRequest = {
    readonly actualPath: string;
    readonly expectedPath: string;
    readonly metadata?: unknown;
};

type ImageFirstMismatch = {
    readonly pixelIndex: number;
    readonly x: number;
    readonly y: number;
    readonly actualRgba: readonly [number, number, number, number];
    readonly expectedRgba: readonly [number, number, number, number];
};

type ImageComparisonResult = {
    readonly actualPath: string;
    readonly expectedPath: string;
    readonly width: number | null;
    readonly height: number | null;
    readonly expectedWidth: number;
    readonly expectedHeight: number;
    readonly actualWidth: number;
    readonly actualHeight: number;
    readonly sameDimensions: boolean;
    readonly maxAbsRgbaDelta: number;
    readonly mismatchedByteCount: number;
    readonly mismatchedPixelCount: number;
    readonly meanAbsRgbaDelta: number;
    readonly rmseRgbaDelta: number;
    readonly perceptualProxy: ImageComparisonPerceptualProxy;
    readonly firstMismatch?: ImageFirstMismatch;
    readonly exactMatch: boolean;
    readonly metadata?: unknown;
};

type ImageComparisonPerceptualProxy = {
    readonly kind: 'rec709-display-luma-byte-proxy';
    readonly channelWeights: readonly [number, number, number];
    readonly comparedPixelCount: number;
    readonly maxAbsDisplayLumaDelta: number;
    readonly meanAbsDisplayLumaDelta: number;
    readonly rmseDisplayLumaDelta: number;
    readonly maxWeightedRgbDelta: number;
    readonly meanWeightedRgbDelta: number;
    readonly rmseWeightedRgbDelta: number;
};

type ImageComparisonSummary = {
    readonly status: 'accepted' | 'rejected';
    readonly comparisons: readonly ImageComparisonResult[];
    readonly exactMatchCount: number;
    readonly maxAbsRgbaDelta: number;
    readonly mismatchedByteCount: number;
    readonly mismatchedPixelCount: number;
};
