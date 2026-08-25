type PerspectiveCameraRasterConfiguration = {
    readonly widthPixels: number;
    readonly heightPixels: number;
    readonly verticalFovDegrees: number;
};

type RasterCenterCoordinate = {
    readonly x: number;
    readonly y: number;
};

type PerspectivePixelProjectionBounds = {
    readonly left: number;
    readonly right: number;
    readonly bottom: number;
    readonly top: number;
};

