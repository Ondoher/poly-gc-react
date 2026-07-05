// References:
// - agents/topics/apps/flat/algorithm32/conclusions.md, active 15-channel table and CIE/display constants.
// - tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity.
// - agents/topics/apps/flat/reconciliation/shader-design.md, display and composition policy.

import {
    CANONICAL_SPECTRAL_CHANNELS,
    FIGURE1_DISPLAY_CONSTANTS,
} from '../constants/consts.js';
import { clamp } from '../math/vector.js';

export default class BrunetonColorDisplayModel {
    /**
     * @param {{ readonly displayConstants?: Figure1DisplayConstants }} [configuration] - Display model configuration.
     */
    constructor(configuration = {}) {
        this._displayConstants = configuration.displayConstants ?? FIGURE1_DISPLAY_CONSTANTS;
        this._spectralReflectanceCache = new Map();
        this._linearSrgbBasisMatrix = null;
    }

    /**
     * @returns {DisplayConversionDescriptor} Display conversion descriptor.
     */
    describeDisplayConversion() {
        return Object.freeze({
            conversionKind: this._displayConstants.conversionKind,
            outputColorSpace: this._displayConstants.outputColorSpace,
            toneMapping: 'paper-figure1-exponential',
            metadata: Object.freeze({
                maxLuminousEfficacyLumensPerWatt: this._displayConstants.maxLuminousEfficacyLumensPerWatt,
                paperFigure1ToneMapK: this._displayConstants.paperFigure1ToneMapK,
                demoGammaPowerOmitted: this._displayConstants.demoGammaPowerOmitted,
                demoWhitePointOmitted: this._displayConstants.demoWhitePointOmitted,
            }),
        });
    }

    /**
     * @param {SpectralValue} radiance - Spectral radiance on the active Algorithm32 basis.
     * @returns {readonly [number, number, number]} Display RGB through the accepted Step 032 adapter.
     */
    radianceToDisplayRgb(radiance) {
        const linearRgb = this.radianceToLinearSrgb(radiance);

        return this.linearSrgbToDisplayRgb(linearRgb);
    }

    /**
     * @param {readonly [number, number, number]} linearSrgb - Linear sRGB before tone mapping.
     * @returns {readonly [number, number, number]} Display RGB after the accepted Figure 1 tone map.
     */
    linearSrgbToDisplayRgb(linearSrgb) {
        assertRgbTriplet(linearSrgb, 'linearSrgbToDisplayRgb');

        return Object.freeze(linearSrgb.map((value) =>
            clamp(
                1 - Math.exp(-Math.max(0, value) * this._displayConstants.paperFigure1ToneMapK),
                0,
                1,
            )));
    }

    /**
     * @param {readonly [number, number, number]} displayRgb - Display RGB in the Figure 1 tone-mapped domain.
     * @returns {readonly [number, number, number]} Linear sRGB proxy before tone mapping.
     */
    displayRgbToLinearSrgb(displayRgb) {
        assertRgbTriplet(displayRgb, 'displayRgbToLinearSrgb');

        return Object.freeze(displayRgb.map((value) => {
            const clamped = clamp(value, 0, 0.999999);

            return -Math.log(1 - clamped) / this._displayConstants.paperFigure1ToneMapK;
        }));
    }

    /**
     * @param {SpectralValue} radiance - Spectral radiance on the active Algorithm32 basis.
     * @returns {readonly [number, number, number]} Linear sRGB before tone mapping.
     */
    radianceToLinearSrgb(radiance) {
        let x = 0;
        let y = 0;
        let z = 0;

        for (let channelIndex = 0; channelIndex < CANONICAL_SPECTRAL_CHANNELS.length; channelIndex += 1) {
            const channel = CANONICAL_SPECTRAL_CHANNELS[channelIndex];
            const channelRadiance = radiance[channelIndex];
            const delta = channel.wavelengthBinWidthNanometers;

            x += cieColorMatchingValue(channel.wavelengthNanometers, 1) * channelRadiance * delta;
            y += cieColorMatchingValue(channel.wavelengthNanometers, 2) * channelRadiance * delta;
            z += cieColorMatchingValue(channel.wavelengthNanometers, 3) * channelRadiance * delta;
        }

        const matrix = this._displayConstants.xyzToLinearSrgbMatrix;
        const efficacy = this._displayConstants.maxLuminousEfficacyLumensPerWatt;

        return Object.freeze([
            efficacy * (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z),
            efficacy * (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z),
            efficacy * (matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z),
        ]);
    }

    /**
     * @param {readonly [number, number, number]} linearSrgbAlbedo - Linear sRGB matte albedo.
     * @returns {SpectralValue} Spectral reflectance fitted through the accepted Bruneton display adapter.
     */
    linearSrgbAlbedoToSpectralReflectance(linearSrgbAlbedo) {
        if (
            !Array.isArray(linearSrgbAlbedo)
            || linearSrgbAlbedo.length !== 3
            || !linearSrgbAlbedo.every(Number.isFinite)
        ) {
            throw new TypeError('linearSrgbAlbedoToSpectralReflectance requires a finite linear sRGB triplet.');
        }

        const target = Object.freeze(linearSrgbAlbedo.map((value) => clamp(value, 0, 1)));
        const cacheKey = target.map((value) => value.toFixed(6)).join(',');
        const cached = this._spectralReflectanceCache.get(cacheKey);

        if (cached) {
            return cached;
        }

        const matrix = this._linearSrgbBasisMatrix ?? this._buildNormalizedLinearSrgbBasisMatrix();
        this._linearSrgbBasisMatrix = matrix;

        const reflectance = Array.from({ length: CANONICAL_SPECTRAL_CHANNELS.length }, () =>
            (target[0] + target[1] + target[2]) / 3);
        const smoothnessWeight = 0.015;
        const energyWeight = 0.0005;
        const stepSize = 0.08;

        for (let iteration = 0; iteration < 800; iteration += 1) {
            const predicted = multiplyMatrixVector(matrix, reflectance);
            const error = [
                predicted[0] - target[0],
                predicted[1] - target[1],
                predicted[2] - target[2],
            ];
            const gradient = Array.from({ length: reflectance.length }, (_, index) =>
                2 * (
                    matrix[0][index] * error[0]
                    + matrix[1][index] * error[1]
                    + matrix[2][index] * error[2]
                ) + 2 * energyWeight * reflectance[index]);

            for (let index = 1; index < reflectance.length - 1; index += 1) {
                gradient[index] += 2 * smoothnessWeight
                    * (2 * reflectance[index] - reflectance[index - 1] - reflectance[index + 1]);
            }

            for (let index = 0; index < reflectance.length; index += 1) {
                reflectance[index] = clamp(reflectance[index] - stepSize * gradient[index], 0, 1);
            }
        }

        const spectralReflectance = Object.freeze(reflectance);
        this._spectralReflectanceCache.set(cacheKey, spectralReflectance);

        return spectralReflectance;
    }

    _buildNormalizedLinearSrgbBasisMatrix() {
        const rows = [[], [], []];
        const whiteResponse = this.radianceToLinearSrgb(
            CANONICAL_SPECTRAL_CHANNELS.map(() => 1),
        ).map((value) => Math.max(Math.abs(value), Number.EPSILON));

        for (let channelIndex = 0; channelIndex < CANONICAL_SPECTRAL_CHANNELS.length; channelIndex += 1) {
            const basis = CANONICAL_SPECTRAL_CHANNELS.map((_, index) => index === channelIndex ? 1 : 0);
            const linear = this.radianceToLinearSrgb(basis);

            rows[0].push(linear[0] / whiteResponse[0]);
            rows[1].push(linear[1] / whiteResponse[1]);
            rows[2].push(linear[2] / whiteResponse[2]);
        }

        return Object.freeze(rows.map((row) => Object.freeze(row)));
    }
}

function multiplyMatrixVector(matrix, vector) {
    return Object.freeze(matrix.map((row) =>
        row.reduce((sum, value, index) => sum + value * vector[index], 0)));
}

function assertRgbTriplet(value, fieldName) {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
        throw new TypeError(`${fieldName} requires a finite RGB triplet.`);
    }
}

function cieColorMatchingValue(wavelength, component) {
    if (wavelength <= 360 || wavelength >= 830) {
        return 0;
    }

    for (let index = 0; index < CIE_2_DEG_COLOR_MATCHING_FUNCTIONS.length - 1; index += 1) {
        const current = CIE_2_DEG_COLOR_MATCHING_FUNCTIONS[index];
        const next = CIE_2_DEG_COLOR_MATCHING_FUNCTIONS[index + 1];

        if (wavelength >= current[0] && wavelength <= next[0]) {
            const t = (wavelength - current[0]) / (next[0] - current[0]);

            return current[component] * (1 - t) + next[component] * t;
        }
    }

    return 0;
}

const CIE_2_DEG_COLOR_MATCHING_FUNCTIONS = Object.freeze([
    Object.freeze([360, 0.0001299, 0.000003917, 0.0006061]),
    Object.freeze([365, 0.0002321, 0.000006965, 0.001086]),
    Object.freeze([370, 0.0004149, 0.00001239, 0.001946]),
    Object.freeze([375, 0.0007416, 0.00002202, 0.003486]),
    Object.freeze([380, 0.001368, 0.000039, 0.006450001]),
    Object.freeze([385, 0.002236, 0.000064, 0.01054999]),
    Object.freeze([390, 0.004243, 0.00012, 0.02005001]),
    Object.freeze([395, 0.00765, 0.000217, 0.03621]),
    Object.freeze([400, 0.01431, 0.000396, 0.06785001]),
    Object.freeze([405, 0.02319, 0.00064, 0.1102]),
    Object.freeze([410, 0.04351, 0.00121, 0.2074]),
    Object.freeze([415, 0.07763, 0.00218, 0.3713]),
    Object.freeze([420, 0.13438, 0.004, 0.6456]),
    Object.freeze([425, 0.21477, 0.0073, 1.0390501]),
    Object.freeze([430, 0.2839, 0.0116, 1.3856]),
    Object.freeze([435, 0.3285, 0.01684, 1.62296]),
    Object.freeze([440, 0.34828, 0.023, 1.74706]),
    Object.freeze([445, 0.34806, 0.0298, 1.7826]),
    Object.freeze([450, 0.3362, 0.038, 1.77211]),
    Object.freeze([455, 0.3187, 0.048, 1.7441]),
    Object.freeze([460, 0.2908, 0.06, 1.6692]),
    Object.freeze([465, 0.2511, 0.0739, 1.5281]),
    Object.freeze([470, 0.19536, 0.09098, 1.28764]),
    Object.freeze([475, 0.1421, 0.1126, 1.0419]),
    Object.freeze([480, 0.09564, 0.13902, 0.8129501]),
    Object.freeze([485, 0.05795001, 0.1693, 0.6162]),
    Object.freeze([490, 0.03201, 0.20802, 0.46518]),
    Object.freeze([495, 0.0147, 0.2586, 0.3533]),
    Object.freeze([500, 0.0049, 0.323, 0.272]),
    Object.freeze([505, 0.0024, 0.4073, 0.2123]),
    Object.freeze([510, 0.0093, 0.503, 0.1582]),
    Object.freeze([515, 0.0291, 0.6082, 0.1117]),
    Object.freeze([520, 0.06327, 0.71, 0.07824999]),
    Object.freeze([525, 0.1096, 0.7932, 0.05725001]),
    Object.freeze([530, 0.1655, 0.862, 0.04216]),
    Object.freeze([535, 0.2257499, 0.9148501, 0.02984]),
    Object.freeze([540, 0.2904, 0.954, 0.0203]),
    Object.freeze([545, 0.3597, 0.9803, 0.0134]),
    Object.freeze([550, 0.4334499, 0.9949501, 0.008749999]),
    Object.freeze([555, 0.5120501, 1, 0.005749999]),
    Object.freeze([560, 0.5945, 0.995, 0.0039]),
    Object.freeze([565, 0.6784, 0.9786, 0.002749999]),
    Object.freeze([570, 0.7621, 0.952, 0.0021]),
    Object.freeze([575, 0.8425, 0.9154, 0.0018]),
    Object.freeze([580, 0.9163, 0.87, 0.001650001]),
    Object.freeze([585, 0.9786, 0.8163, 0.0014]),
    Object.freeze([590, 1.0263, 0.757, 0.0011]),
    Object.freeze([595, 1.0567, 0.6949, 0.001]),
    Object.freeze([600, 1.0622, 0.631, 0.0008]),
    Object.freeze([605, 1.0456, 0.5668, 0.0006]),
    Object.freeze([610, 1.0026, 0.503, 0.00034]),
    Object.freeze([615, 0.9384, 0.4412, 0.00024]),
    Object.freeze([620, 0.8544499, 0.381, 0.00019]),
    Object.freeze([625, 0.7514, 0.321, 0.0001]),
    Object.freeze([630, 0.6424, 0.265, 0.00004999999]),
    Object.freeze([635, 0.5419, 0.217, 0.00003]),
    Object.freeze([640, 0.4479, 0.175, 0.00002]),
    Object.freeze([645, 0.3608, 0.1382, 0.00001]),
    Object.freeze([650, 0.2835, 0.107, 0]),
    Object.freeze([655, 0.2187, 0.0816, 0]),
    Object.freeze([660, 0.1649, 0.061, 0]),
    Object.freeze([665, 0.1212, 0.04458, 0]),
    Object.freeze([670, 0.0874, 0.032, 0]),
    Object.freeze([675, 0.0636, 0.0232, 0]),
    Object.freeze([680, 0.04677, 0.017, 0]),
    Object.freeze([685, 0.0329, 0.01192, 0]),
    Object.freeze([690, 0.0227, 0.00821, 0]),
    Object.freeze([695, 0.01584, 0.005723, 0]),
    Object.freeze([700, 0.01135916, 0.004102, 0]),
    Object.freeze([705, 0.008110916, 0.002929, 0]),
    Object.freeze([710, 0.005790346, 0.002091, 0]),
    Object.freeze([715, 0.004109457, 0.001484, 0]),
    Object.freeze([720, 0.002899327, 0.001047, 0]),
    Object.freeze([725, 0.00204919, 0.00074, 0]),
    Object.freeze([730, 0.001439971, 0.00052, 0]),
    Object.freeze([735, 0.0009999493, 0.0003611, 0]),
    Object.freeze([740, 0.0006900786, 0.0002492, 0]),
    Object.freeze([745, 0.0004760213, 0.0001719, 0]),
    Object.freeze([750, 0.0003323011, 0.00012, 0]),
    Object.freeze([755, 0.0002348261, 0.0000848, 0]),
    Object.freeze([760, 0.0001661505, 0.00006, 0]),
    Object.freeze([765, 0.000117413, 0.0000424, 0]),
    Object.freeze([770, 0.00008307527, 0.00003, 0]),
    Object.freeze([775, 0.00005870652, 0.0000212, 0]),
    Object.freeze([780, 0.00004150994, 0.00001499, 0]),
    Object.freeze([785, 0.00002935326, 0.0000106, 0]),
    Object.freeze([790, 0.00002067383, 0.0000074657, 0]),
    Object.freeze([795, 0.00001455977, 0.0000052578, 0]),
    Object.freeze([800, 0.00001025398, 0.0000037029, 0]),
    Object.freeze([805, 0.000007221456, 0.0000026078, 0]),
    Object.freeze([810, 0.000005085868, 0.0000018366, 0]),
    Object.freeze([815, 0.000003581652, 0.0000012934, 0]),
    Object.freeze([820, 0.000002522525, 0.00000091093, 0]),
    Object.freeze([825, 0.000001776509, 0.00000064153, 0]),
    Object.freeze([830, 0.000001251141, 0.00000045181, 0]),
]);
