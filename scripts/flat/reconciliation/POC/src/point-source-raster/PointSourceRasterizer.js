// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md, point-source accumulator equation.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import ExternalCelestialSource from '../external-celestial-sources/ExternalCelestialSource.js';
import { POINT_CELESTIAL_SOURCE, SPECTRAL_IRRADIANCE_DENSITY } from '../external-celestial-sources/consts.js';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import BilinearPointResponse from './BilinearPointResponse.js';

export default class PointSourceRasterizer {
    /**
     * @param {{ camera: PerspectiveCameraRaster, response: BilinearPointResponse }} configuration - Rasterizer dependencies.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw configurationError('ER2_RASTERIZER_CONFIGURATION_REQUIRED',
                'Point source rasterizer configuration is required.');
        }
        if (!(configuration.camera instanceof PerspectiveCameraRaster)) {
            throw configurationError('ER2_RASTERIZER_CAMERA_REQUIRED',
                'Point source rasterizer requires a PerspectiveCameraRaster.');
        }
        if (!(configuration.response instanceof BilinearPointResponse)) {
            throw configurationError('ER2_RASTERIZER_RESPONSE_REQUIRED',
                'Point source rasterizer requires a BilinearPointResponse.');
        }
        this.camera = configuration.camera;
        this.response = configuration.response;
        Object.freeze(this);
    }

    /**
     * Rasterize one typed point source without atmosphere or display.
     *
     * @param {PointSourceRasterRequest} request - Point source request.
     * @returns {Readonly<Record<string, unknown>>} Pixel radiance and conservation diagnostics.
     */
    rasterize(request) {
        validateRequest(request);
        rejectCoverageFields(request);
        const rasterCenter = this.camera.directionToRasterCenter(request.sourceDirectionCamera);
        const spectralIrradiance = request.source.spectralMeasure;
        const response = this.response.resolve({
            rasterX: rasterCenter.x,
            rasterY: rasterCenter.y,
            widthPixels: this.camera.widthPixels,
            heightPixels: this.camera.heightPixels,
        });
        const pixels = response.onFrameDestinations.map((destination) => {
            const solidAngleSteradians = this.camera.pixelSolidAngleSteradians(
                destination.pixelX,
                destination.pixelY,
            );
            const spectralRadianceDensity = Object.freeze(
                spectralIrradiance.values.map((value) =>
                    value * destination.weight / solidAngleSteradians),
            );
            return Object.freeze({
                pixelX: destination.pixelX,
                pixelY: destination.pixelY,
                responseWeight: destination.weight,
                solidAngleSteradians,
                spectralRadianceDensity,
            });
        });
        const reconstructedOnFrameIrradiance = reconstructOnFrame(
            pixels,
            spectralIrradiance.values.length,
        );
        const offRasterIrradiance = Object.freeze(spectralIrradiance.values.map((value) =>
            value * response.offRasterWeight));
        const accountedIrradiance = Object.freeze(reconstructedOnFrameIrradiance.map((value, index) =>
            value + offRasterIrradiance[index]));
        const residual = Object.freeze(accountedIrradiance.map((value, index) =>
            value - spectralIrradiance.values[index]));

        return Object.freeze({
            sourceId: request.source.id,
            source: request.source.describe(),
            outputQuantity: 'spectral-radiance-density',
            outputUnits: 'W m^-2 sr^-1 nm^-1',
            cameraFingerprint: this.camera.fingerprint,
            responseFingerprint: this.response.fingerprint,
            sourceDirectionCamera: Object.freeze([...request.sourceDirectionCamera]),
            sourceSpectralIrradiance: spectralIrradiance.describe(),
            rasterCenter,
            response,
            pixels: Object.freeze(pixels),
            reconstructedOnFrameIrradiance,
            offRasterIrradiance,
            accountedIrradiance,
            residual,
        });
    }

    /**
     * Rasterize and add multiple point sources while preserving individual diagnostics.
     *
     * @param {{ points: readonly PointSourceRasterRequest[] }} request - Source batch.
     * @returns {Readonly<Record<string, unknown>>} Additive spectral frame diagnostics.
     */
    rasterizeMany(request) {
        if (!request || !Array.isArray(request.points) || request.points.length === 0) {
            throw configurationError('ER2_RASTERIZER_SOURCE_BATCH_REQUIRED',
                'Point source batch requires at least one source.');
        }
        const ids = new Set();
        for (const point of request.points) {
            validateRequest(point);
            const sourceId = point.source.id;
            if (ids.has(sourceId)) {
                throw configurationError('ER2_RASTERIZER_SOURCE_ID_DUPLICATE',
                    `Point source id ${sourceId} is duplicated.`);
            }
            ids.add(sourceId);
        }
        const sources = Object.freeze(request.points.map((point) => this.rasterize(point)));
        const channelCount = sources[0].sourceSpectralIrradiance.values.length;
        const basisFingerprint = sources[0].sourceSpectralIrradiance.basis.fingerprint;
        if (sources.some((source) =>
            source.sourceSpectralIrradiance.values.length !== channelCount
            || source.sourceSpectralIrradiance.basis.fingerprint !== basisFingerprint)) {
            throw configurationError('ER2_RASTERIZER_SOURCE_BASIS_MISMATCH',
                'Point source batch packets must have the same basis fingerprint.');
        }
        const pixelMap = new Map();
        for (const source of sources) {
            for (const pixel of source.pixels) {
                const key = `${pixel.pixelX},${pixel.pixelY}`;
                const current = pixelMap.get(key) ?? Object.freeze({
                    pixelX: pixel.pixelX,
                    pixelY: pixel.pixelY,
                    solidAngleSteradians: pixel.solidAngleSteradians,
                    spectralRadianceDensity: Object.freeze(Array(channelCount).fill(0)),
                });
                pixelMap.set(key, Object.freeze({
                    pixelX: current.pixelX,
                    pixelY: current.pixelY,
                    solidAngleSteradians: current.solidAngleSteradians,
                    spectralRadianceDensity: Object.freeze(
                        current.spectralRadianceDensity.map((value, index) =>
                            value + pixel.spectralRadianceDensity[index]),
                    ),
                }));
            }
        }
        const pixels = Object.freeze([...pixelMap.values()].sort((a, b) =>
            a.pixelY - b.pixelY || a.pixelX - b.pixelX));
        const inputIrradiance = sumSpectra(
            sources.map((source) => source.sourceSpectralIrradiance.values),
            channelCount,
        );
        const reconstructedOnFrameIrradiance = reconstructOnFrame(pixels, channelCount);
        const offRasterIrradiance = sumSpectra(
            sources.map((source) => source.offRasterIrradiance),
            channelCount,
        );
        const accountedIrradiance = Object.freeze(reconstructedOnFrameIrradiance.map((value, index) =>
            value + offRasterIrradiance[index]));
        return Object.freeze({
            outputQuantity: 'spectral-radiance-density',
            outputUnits: 'W m^-2 sr^-1 nm^-1',
            basisFingerprint,
            cameraFingerprint: this.camera.fingerprint,
            responseFingerprint: this.response.fingerprint,
            sources,
            pixels,
            inputIrradiance,
            reconstructedOnFrameIrradiance,
            offRasterIrradiance,
            accountedIrradiance,
            residual: Object.freeze(accountedIrradiance.map((value, index) =>
                value - inputIrradiance[index])),
        });
    }
}

function validateRequest(request) {
    if (!request || typeof request !== 'object') {
        throw configurationError('ER2_RASTERIZER_REQUEST_REQUIRED',
            'Point source raster request is required.');
    }
    if (!(request.source instanceof ExternalCelestialSource)) {
        throw configurationError('ER2_RASTERIZER_TYPED_SOURCE_REQUIRED',
            'Point source raster request requires an ExternalCelestialSource.');
    }
    if (
        request.source.kind !== POINT_CELESTIAL_SOURCE
        || request.source.spectralMeasure.quantity !== SPECTRAL_IRRADIANCE_DENSITY
    ) {
        throw configurationError('ER2_RASTERIZER_IRRADIANCE_REQUIRED',
            'Point source rasterizer accepts typed point spectral irradiance sources only.');
    }
}

function reconstructOnFrame(pixels, channelCount) {
    const result = Array(channelCount).fill(0);
    for (const pixel of pixels) {
        for (let channel = 0; channel < channelCount; channel += 1) {
            result[channel] += pixel.spectralRadianceDensity[channel]
                * pixel.solidAngleSteradians;
        }
    }
    return Object.freeze(result);
}

function sumSpectra(spectra, channelCount) {
    const result = Array(channelCount).fill(0);
    for (const spectrum of spectra) {
        for (let channel = 0; channel < channelCount; channel += 1) {
            result[channel] += spectrum[channel];
        }
    }
    return Object.freeze(result);
}

function rejectCoverageFields(request) {
    const prohibited = ['coverage', 'opacity', 'alpha', 'remainingCoverage', 'geometryCoverage'];
    const found = prohibited.filter((field) => Object.hasOwn(request, field));
    if (found.length > 0) {
        throw configurationError('ER2_RASTERIZER_COVERAGE_FIELD_PROHIBITED',
            'Point rasterization does not accept coverage or opacity.', { fields: found });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
