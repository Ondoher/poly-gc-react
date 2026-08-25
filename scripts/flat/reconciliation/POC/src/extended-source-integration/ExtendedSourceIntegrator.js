import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import SphericalCapQuadrature from './SphericalCapQuadrature.js';

export default class ExtendedSourceIntegrator {
    constructor({ camera }) {
        if (!(camera instanceof PerspectiveCameraRaster)) {
            throw new ReconciliationConfigurationError('Extended integrator requires a perspective camera.', { code: 'ER3_INTEGRATOR_CAMERA_REQUIRED' });
        }
        this.camera = camera;
    }

    integrate({ source, radialCount = 64, azimuthCount = 128 }) {
        if (!source || !source.source || source.source.kind !== 'extended') {
            throw new ReconciliationConfigurationError('Extended integrator requires an extended source model.', { code: 'ER3_INTEGRATOR_EXTENDED_SOURCE_REQUIRED' });
        }
        const quadrature = new SphericalCapQuadrature({
            angularRadiusRadians: source.angularRadiusRadians,
            radialCount,
            azimuthCount,
        });
        const samples = quadrature.sample(source.centerDirectionCamera);
        const channelCount = source.packet.values.length;
        const pixelMap = new Map();
        const offRasterIntegral = Array(channelCount).fill(0);
        const offRasterProjectedIrradiance = Array(channelCount).fill(0);
        let totalIntegral = Array(channelCount).fill(0);
        let totalProjected = Array(channelCount).fill(0);
        let onFrameSolidAngle = 0;
        for (const sample of samples) {
            const radiance = source.radianceForSample(sample);
            const weight = sample.solidAngleWeightSteradians;
            const projectedWeight = weight * sample.cosTheta;
            for (let channel = 0; channel < channelCount; channel += 1) {
                totalIntegral[channel] += radiance[channel] * weight;
                totalProjected[channel] += radiance[channel] * projectedWeight;
            }
            const raster = this.camera.directionToRasterCenter(sample.directionCamera);
            const pixelX = Math.floor(raster.x + 0.5);
            const pixelY = Math.floor(raster.y + 0.5);
            if (pixelX < 0 || pixelX >= this.camera.widthPixels || pixelY < 0 || pixelY >= this.camera.heightPixels) {
                for (let channel = 0; channel < channelCount; channel += 1) {
                    offRasterIntegral[channel] += radiance[channel] * weight;
                    offRasterProjectedIrradiance[channel] += radiance[channel] * projectedWeight;
                }
                continue;
            }
            const key = `${pixelX},${pixelY}`;
            const current = pixelMap.get(key) ?? { pixelX, pixelY, solidAngleSteradians: this.camera.pixelSolidAngleSteradians(pixelX, pixelY), integral: Array(channelCount).fill(0), solidAngleCovered: 0 };
            for (let channel = 0; channel < channelCount; channel += 1) {
                current.integral[channel] += radiance[channel] * weight;
            }
            current.solidAngleCovered += weight;
            pixelMap.set(key, current);
            onFrameSolidAngle += weight;
        }
        const pixels = [...pixelMap.values()].map((pixel) => Object.freeze({
            pixelX: pixel.pixelX,
            pixelY: pixel.pixelY,
            solidAngleSteradians: pixel.solidAngleSteradians,
            solidAngleCoveredSteradians: pixel.solidAngleCovered,
            derivedCoverage: pixel.solidAngleCovered / pixel.solidAngleSteradians,
            spectralRadianceDensity: Object.freeze(pixel.integral.map((value) => value / pixel.solidAngleSteradians)),
        }));
        const reconstructedOnFrame = Array(channelCount).fill(0);
        for (const pixel of pixels) {
            for (let channel = 0; channel < channelCount; channel += 1) {
                reconstructedOnFrame[channel] += pixel.spectralRadianceDensity[channel] * pixel.solidAngleSteradians;
            }
        }
        return Object.freeze({
            source: source.source.describe(),
            quadrature: {
                angularRadiusRadians: source.angularRadiusRadians,
                radialCount,
                azimuthCount,
                sampleCount: samples.length,
                expectedSolidAngleSteradians: quadrature.expectedSolidAngleSteradians(),
                sampledSolidAngleSteradians: samples.reduce((sum, sample) => sum + sample.solidAngleWeightSteradians, 0),
            },
            pixels: Object.freeze(pixels),
            totalIntegral: Object.freeze(totalIntegral),
            totalProjectedIrradiance: Object.freeze(totalProjected),
            reconstructedOnFrameIntegral: Object.freeze(reconstructedOnFrame),
            offRasterIntegral: Object.freeze(offRasterIntegral),
            offRasterProjectedIrradiance: Object.freeze(offRasterProjectedIrradiance),
            onFrameSolidAngle,
            offRasterSolidAngle: quadrature.expectedSolidAngleSteradians() - onFrameSolidAngle,
        });
    }
}

