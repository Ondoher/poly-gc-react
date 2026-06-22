import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../..");
const ARTIFACT_ROOT = path.join(
  ROOT,
  "tmp",
  "atmosphere",
  "bruneton_start_fresh"
);

const IMAGE_SIZE = 320;
const SKY_RADIUS = IMAGE_SIZE * 0.47;
const CENTER = (IMAGE_SIZE - 1) / 2;

const DEFAULT_STEP_ID = "figure1-four-view-derived-k-no-ground-baseline";

const STEPS = {
  "scaffold-diagnostic": {
    id: "scaffold-diagnostic",
    label: "scaffold-diagnostic",
    title: "Scaffold diagnostic fisheye domes",
    status: "accepted",
    model: "diagnostic-projection-only",
    outputSuffix: "diagnostic",
  },
  "geometry-transmittance-baseline": {
    id: "geometry-transmittance-baseline",
    label: "geometry-transmittance-baseline",
    title: "Spherical geometry and Beer-Lambert transmittance baseline",
    status: "accepted",
    model: "geometry-transmittance-diagnostic",
    outputSuffix: "transmittance",
  },
  "single-scattering-baseline": {
    id: "single-scattering-baseline",
    label: "single-scattering-baseline",
    title: "Rayleigh and Mie single-scattering baseline",
    status: "accepted",
    model: "single-scattering-radiance",
    outputSuffix: "single-scattering",
  },
  "luminance-conversion-baseline": {
    id: "luminance-conversion-baseline",
    label: "luminance-conversion-baseline",
    title: "Single scattering with Bruneton luminance conversion",
    status: "accepted",
    model: "single-scattering-luminance",
    outputSuffix: "luminance",
  },
  "bruneton-2016-parameters": {
    id: "bruneton-2016-parameters",
    label: "bruneton-2016-parameters",
    title: "Single scattering with Bruneton 2016 aerosol parameters",
    status: "accepted",
    model: "single-scattering-luminance-bruneton-2016-parameters",
    outputSuffix: "bruneton-2016-params",
  },
  "ozone-absorption-baseline": {
    id: "ozone-absorption-baseline",
    label: "ozone-absorption-baseline",
    title: "Single scattering with Bruneton ozone absorption",
    status: "accepted",
    model: "single-scattering-luminance-ozone",
    outputSuffix: "ozone",
  },
  "spectral-cie-baseline": {
    id: "spectral-cie-baseline",
    label: "spectral-cie-baseline",
    title: "Single scattering with 15-sample CIE spectral conversion",
    status: "accepted",
    model: "single-scattering-spectral-cie",
    outputSuffix: "spectral-cie",
  },
  "spectral-demo-aerosol-baseline": {
    id: "spectral-demo-aerosol-baseline",
    label: "spectral-demo-aerosol-baseline",
    title: "Spectral CIE sky with Bruneton demo aerosols",
    status: "accepted",
    model: "single-scattering-spectral-cie-demo-aerosols",
    outputSuffix: "spectral-demo-aerosol",
  },
  "multiple-scattering-proxy-baseline": {
    id: "multiple-scattering-proxy-baseline",
    label: "multiple-scattering-proxy-baseline",
    title: "Spectral CIE sky with multiple-scattering irradiance proxy",
    status: "accepted",
    model: "spectral-cie-multiple-scattering-proxy",
    outputSuffix: "multiple-scattering-proxy",
  },
  "second-order-scattering-baseline": {
    id: "second-order-scattering-baseline",
    label: "second-order-scattering-baseline",
    title: "Spectral CIE sky with directional second-order scattering",
    status: "accepted",
    model: "spectral-cie-directional-second-order-scattering",
    outputSuffix: "second-order",
  },
  "ground-bounce-coupling-baseline": {
    id: "ground-bounce-coupling-baseline",
    label: "ground-bounce-coupling-baseline",
    title: "Spectral CIE sky with second-order scattering and ground bounce",
    status: "accepted",
    model: "spectral-cie-second-order-ground-bounce",
    outputSuffix: "ground-bounce",
  },
  "ground-sky-irradiance-coupling-baseline": {
    id: "ground-sky-irradiance-coupling-baseline",
    label: "ground-sky-irradiance-coupling-baseline",
    title:
      "Spectral CIE sky with second-order scattering and sun-plus-sky ground bounce",
    status: "accepted",
    model: "spectral-cie-second-order-sun-sky-ground-bounce",
    outputSuffix: "ground-sky-irradiance",
  },
  "paper-comparison-no-ozone-baseline": {
    id: "paper-comparison-no-ozone-baseline",
    label: "paper-comparison-no-ozone-baseline",
    title:
      "Spectral CIE sky with paper-comparison no-ozone absorption policy",
    status: "accepted",
    model: "spectral-cie-second-order-sun-sky-ground-bounce-no-ozone",
    outputSuffix: "paper-no-ozone",
  },
  "demo-white-balance-display-baseline": {
    id: "demo-white-balance-display-baseline",
    label: "demo-white-balance-display-baseline",
    title:
      "Spectral CIE sky with paper no-ozone policy and demo white balance",
    status: "accepted",
    model:
      "spectral-cie-second-order-sun-sky-ground-bounce-no-ozone-white-balance",
    outputSuffix: "white-balance",
  },
  "paper-aerosol-transport-baseline": {
    id: "paper-aerosol-transport-baseline",
    label: "paper-aerosol-transport-baseline",
    title:
      "Spectral CIE sky with paper aerosol parameters and current transport",
    status: "accepted",
    model:
      "spectral-cie-second-order-sun-sky-ground-bounce-no-ozone-white-balance-paper-aerosol",
    outputSuffix: "paper-aerosol",
  },
  "nishita96-plane-second-order-baseline": {
    id: "nishita96-plane-second-order-baseline",
    label: "nishita96-plane-second-order-baseline",
    title:
      "Spectral CIE sky with Nishita96-style second-order directions",
    status: "accepted",
    model:
      "spectral-cie-nishita96-plane-second-order-sun-sky-ground-bounce-paper-aerosol",
    outputSuffix: "nishita96-plane-second-order",
  },
  "pixel-filtered-solar-disc-baseline": {
    id: "pixel-filtered-solar-disc-baseline",
    label: "pixel-filtered-solar-disc-baseline",
    title:
      "Spectral CIE sky with pixel-filtered direct solar disc",
    status: "rejected after review",
    model:
      "spectral-cie-paper-aerosol-pixel-filtered-solar-disc",
    outputSuffix: "pixel-filtered-sun",
  },
  "paper-sky-radiance-no-direct-sun-baseline": {
    id: "paper-sky-radiance-no-direct-sun-baseline",
    label: "paper-sky-radiance-no-direct-sun-baseline",
    title:
      "Spectral CIE paper-aerosol sky radiance without direct solar disc",
    status: "accepted as target-contract diagnostic, not final",
    model:
      "spectral-cie-paper-aerosol-sky-radiance-no-direct-sun",
    outputSuffix: "paper-sky-no-direct-sun",
  },
  "fibonacci-sphere-second-order-baseline": {
    id: "fibonacci-sphere-second-order-baseline",
    label: "fibonacci-sphere-second-order-baseline",
    title:
      "Spectral CIE sky radiance with full-sphere Fibonacci second-order quadrature",
    status: "accepted as quadrature evidence, not final",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-no-direct-sun",
    outputSuffix: "fibonacci-sphere-second-order",
  },
  "paper-figure1-tone-map-baseline": {
    id: "paper-figure1-tone-map-baseline",
    label: "paper-figure1-tone-map-baseline",
    title:
      "Spectral CIE sky radiance with Figure 1 paper tone map",
    status: "accepted as display evidence, not final",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-paper-tone-map",
    outputSuffix: "paper-figure1-tone-map",
  },
  "paper-figure1-fitted-tone-map-baseline": {
    id: "paper-figure1-fitted-tone-map-baseline",
    label: "paper-figure1-fitted-tone-map-baseline",
    title:
      "Spectral CIE sky radiance with fitted Figure 1 paper tone map",
    status: "accepted as closest visual match so far, not final",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-fitted-paper-tone-map",
    outputSuffix: "paper-figure1-fitted-tone-map",
  },
  "paper-figure1-derived-k-no-ground-baseline": {
    id: "paper-figure1-derived-k-no-ground-baseline",
    label: "paper-figure1-derived-k-no-ground-baseline",
    title:
      "Spectral CIE sky radiance with derived Figure 1 k and no ground coupling",
    status: "accepted as simplified step-21-equivalent anchor, not final",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-derived-paper-tone-map-no-ground",
    outputSuffix: "paper-figure1-derived-k-no-ground",
  },
  "figure1-four-view-derived-k-no-ground-baseline": {
    id: "figure1-four-view-derived-k-no-ground-baseline",
    label: "figure1-four-view-derived-k-no-ground-baseline",
    title:
      "Four Figure 1 skydome views with the step 029 derived-k no-ground model",
    status: "generated as four-view Figure 1 orientation set",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-derived-paper-tone-map-no-ground-four-figure1-views",
    outputSuffix: "figure1-four-view-derived-k-no-ground",
  },
  "figure1-four-view-source-k-no-ground-baseline": {
    id: "figure1-four-view-source-k-no-ground-baseline",
    label: "figure1-four-view-source-k-no-ground-baseline",
    title:
      "Four Figure 1 skydome views with Bruneton source-derived k and no ground coupling",
    status: "source-k comparison experiment",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-source-paper-tone-map-no-ground-four-figure1-views",
    outputSuffix: "figure1-four-view-source-k-no-ground",
  },
  "paper-figure1-derived-k-direct-ground-baseline": {
    id: "paper-figure1-derived-k-direct-ground-baseline",
    label: "paper-figure1-derived-k-direct-ground-baseline",
    title:
      "Spectral CIE sky radiance with derived Figure 1 k and direct-Sun ground bounce only",
    status: "accepted as ground-term equivalence evidence, not the simpler anchor",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-derived-paper-tone-map-direct-ground-only",
    outputSuffix: "paper-figure1-derived-k-direct-ground",
  },
  "figure1-sun-zenith-baseline": {
    id: "figure1-sun-zenith-baseline",
    label: "figure1-sun-zenith-baseline",
    title:
      "Spectral CIE sky radiance with Figure 1 sun zenith angles",
    status: "accepted as scene-angle evidence, not final",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-fitted-paper-tone-map-figure1-sun-zenith",
    outputSuffix: "figure1-sun-zenith",
  },
  "paper-40-wavelength-baseline": {
    id: "paper-40-wavelength-baseline",
    label: "paper-40-wavelength-baseline",
    title:
      "Spectral CIE sky radiance with paper 40-wavelength sampling",
    status: "accepted as spectral-sampling evidence, not final",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-fitted-paper-tone-map-figure1-sun-zenith-40-wavelength",
    outputSuffix: "paper-40-wavelength",
  },
  "paper-40-wavelength-refit-tone-map-baseline": {
    id: "paper-40-wavelength-refit-tone-map-baseline",
    label: "paper-40-wavelength-refit-tone-map-baseline",
    title:
      "Spectral CIE sky radiance with paper 40-wavelength refit tone map",
    status: "accepted as 40-wavelength display evidence, not closest visual match",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-40-wavelength-refit-paper-tone-map",
    outputSuffix: "paper-40-wavelength-refit-tone-map",
  },
  "shadowed-ground-sky-irradiance-baseline": {
    id: "shadowed-ground-sky-irradiance-baseline",
    label: "shadowed-ground-sky-irradiance-baseline",
    title:
      "Spectral CIE sky radiance with shadowed-ground sky irradiance",
    status: "accepted as physics-correctness audit, visually neutral, not final",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-40-wavelength-refit-paper-tone-map-shadowed-ground-sky-irradiance",
    outputSuffix: "shadowed-ground-sky-irradiance",
  },
  "second-order-sun-angle-cache-baseline": {
    id: "second-order-sun-angle-cache-baseline",
    label: "second-order-sun-angle-cache-baseline",
    title:
      "Spectral CIE sky radiance with local Sun-angle second-order cache",
    status: "accepted as transport-coordinate evidence, not final",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-sun-angle-cache-40-wavelength-refit-paper-tone-map",
    outputSuffix: "second-order-sun-angle-cache",
  },
  "second-order-sun-view-angle-cache-baseline": {
    id: "second-order-sun-view-angle-cache-baseline",
    label: "second-order-sun-view-angle-cache-baseline",
    title:
      "Spectral CIE sky radiance with local Sun/view-angle second-order cache",
    status: "accepted as transport-coordinate evidence, not closest visual match",
    model:
      "spectral-cie-paper-aerosol-fibonacci-sphere-second-order-sun-view-angle-cache-40-wavelength-refit-paper-tone-map",
    outputSuffix: "second-order-sun-view-angle-cache",
  },
};

const STEP = STEPS[getRequestedStepId()];

const SCENES = [
  {
    id: "sunset",
    sunAltitudeDegrees: 5,
    sunAzimuthDegrees: 0,
  },
  {
    id: "midday",
    sunAltitudeDegrees: 65,
    sunAzimuthDegrees: 0,
  },
];

const FIGURE1_FOUR_VIEW_SCENES = [
  {
    id: "figure1-06h00-z87",
    sourceTimeOfDay: "06h00",
    sourceSunZenithDegrees: 87,
    sunAltitudeDegrees: 3,
    sunAzimuthDegrees: -25.83454348280912,
    sourceTile: "35-Im6.png",
    sourceRedCrossCenterPixels: [238, 181],
  },
  {
    id: "figure1-10h15-z41",
    sourceTimeOfDay: "10h15",
    sourceSunZenithDegrees: 41,
    sunAltitudeDegrees: 49,
    sunAzimuthDegrees: 9.544525565558136,
    sourceTile: "06-Im15.png",
    sourceRedCrossCenterPixels: [184, 118],
  },
  {
    id: "figure1-11h15-z31",
    sourceTimeOfDay: "11h15",
    sourceSunZenithDegrees: 31,
    sunAltitudeDegrees: 59,
    sunAzimuthDegrees: 22.166345822082455,
    sourceTile: "17-Im25.png",
    sourceRedCrossCenterPixels: [168, 111],
  },
  {
    id: "figure1-13h15-z21",
    sourceTimeOfDay: "13h15",
    sourceSunZenithDegrees: 21,
    sunAltitudeDegrees: 69,
    sunAzimuthDegrees: 85.31410016049729,
    sourceTile: "28-Im35.png",
    sourceRedCrossCenterPixels: [130, 97],
  },
];

const ATMOSPHERE = {
  bottomRadiusMeters: 6360000,
  topRadiusMeters: 6420000,
  observerHeightMeters: 2,
  rayleighScaleHeightMeters: 8000,
  mieScaleHeightMeters: 1200,
  rayleighCoefficientScale: 1.24062e-6,
  mieAngstromAlpha: 0,
  mieAngstromBeta: 5.328e-3,
  mieSingleScatteringAlbedo: 0.9,
  miePhaseFunctionG: 0.8,
  sunAngularRadiusRadians: 0.00935 / 2,
  diagnosticWavelengthMicrometers: 0.55,
  opticalLengthSampleCount: 96,
  singleScatteringSampleCount: 20,
  sunTransmittanceSampleCount: 10,
  displayExposure: 10,
  luminanceExposureScale: 1e-5,
  paperFigure1ToneMapFittedK: 0.0002454,
  paperFigure1ToneMapFittedScale: 2.454,
  paperFortyWavelengthToneMapFittedScale: 2.672406,
  useOzone: true,
  dobsonUnitMoleculesPerSquareMeter: 2.687e20,
  ozoneDobsonUnits: 300,
  ozoneDensityIntegralMeters: 15000,
  multipleScatteringProxyScale: 1.5,
  secondOrderDirectionCount: 8,
  fibonacciSphereSecondOrderDirectionCount: 17,
  secondOrderAltitudeBins: 24,
  secondOrderIncidentMuBins: 5,
  secondOrderIncidentSunMuBins: 5,
  groundAlbedo: 0.1,
  groundBounceDirectionCount: 8,
  groundBounceAltitudeBins: 24,
  groundBounceTransmittanceSampleCount: 8,
  groundSkyIrradianceDirectionCount: 8,
  solarDiscPixelFilterSamplesPerAxis: 7,
};

const BRUNETON_2016_AEROSOL = {
  mieAngstromAlpha: 0.8,
  mieAngstromBeta: 0.04,
  mieSingleScatteringAlbedo: 0.8,
  miePhaseFunctionG: 0.7,
};

const SPECTRAL_CHANNELS = [
  {
    name: "red",
    wavelengthNanometers: 680,
    solarIrradiance: 1.474,
  },
  {
    name: "green",
    wavelengthNanometers: 550,
    solarIrradiance: 1.8504,
  },
  {
    name: "blue",
    wavelengthNanometers: 440,
    solarIrradiance: 1.91198,
  },
];

const SOLAR_IRRADIANCE_SAMPLES = [
  1.11776, 1.14259, 1.01249, 1.14716, 1.72765, 1.73054, 1.6887, 1.61253,
  1.91198, 2.03474, 2.02042, 2.02212, 1.93377, 1.95809, 1.91686, 1.8298,
  1.8685, 1.8931, 1.85149, 1.8504, 1.8341, 1.8345, 1.8147, 1.78158, 1.7533,
  1.6965, 1.68194, 1.64654, 1.6048, 1.52143, 1.55622, 1.5113, 1.474, 1.4482,
  1.41018, 1.36775, 1.34188, 1.31429, 1.28303, 1.26758, 1.2367, 1.2082,
  1.18737, 1.14683, 1.12362, 1.1058, 1.07124, 1.04992,
];

const OZONE_CROSS_SECTION_SAMPLES = [
  1.18e-27, 2.182e-28, 2.818e-28, 6.636e-28, 1.527e-27, 2.763e-27, 5.52e-27,
  8.451e-27, 1.582e-26, 2.316e-26, 3.669e-26, 4.924e-26, 7.752e-26,
  9.016e-26, 1.48e-25, 1.602e-25, 2.139e-25, 2.755e-25, 3.091e-25, 3.5e-25,
  4.266e-25, 4.672e-25, 4.398e-25, 4.701e-25, 5.019e-25, 4.305e-25,
  3.74e-25, 3.215e-25, 2.662e-25, 2.238e-25, 1.852e-25, 1.473e-25,
  1.209e-25, 9.423e-26, 7.455e-26, 6.566e-26, 5.105e-26, 4.15e-26,
  4.228e-26, 3.237e-26, 2.451e-26, 2.801e-26, 2.534e-26, 1.624e-26,
  1.465e-26, 2.078e-26, 1.383e-26, 7.105e-27,
];

const CIE_2_DEG_COLOR_MATCHING_FUNCTIONS = [
  [360, 0.0001299, 0.000003917, 0.0006061],
  [365, 0.0002321, 0.000006965, 0.001086],
  [370, 0.0004149, 0.00001239, 0.001946],
  [375, 0.0007416, 0.00002202, 0.003486],
  [380, 0.001368, 0.000039, 0.006450001],
  [385, 0.002236, 0.000064, 0.01054999],
  [390, 0.004243, 0.00012, 0.02005001],
  [395, 0.00765, 0.000217, 0.03621],
  [400, 0.01431, 0.000396, 0.06785001],
  [405, 0.02319, 0.00064, 0.1102],
  [410, 0.04351, 0.00121, 0.2074],
  [415, 0.07763, 0.00218, 0.3713],
  [420, 0.13438, 0.004, 0.6456],
  [425, 0.21477, 0.0073, 1.0390501],
  [430, 0.2839, 0.0116, 1.3856],
  [435, 0.3285, 0.01684, 1.62296],
  [440, 0.34828, 0.023, 1.74706],
  [445, 0.34806, 0.0298, 1.7826],
  [450, 0.3362, 0.038, 1.77211],
  [455, 0.3187, 0.048, 1.7441],
  [460, 0.2908, 0.06, 1.6692],
  [465, 0.2511, 0.0739, 1.5281],
  [470, 0.19536, 0.09098, 1.28764],
  [475, 0.1421, 0.1126, 1.0419],
  [480, 0.09564, 0.13902, 0.8129501],
  [485, 0.05795001, 0.1693, 0.6162],
  [490, 0.03201, 0.20802, 0.46518],
  [495, 0.0147, 0.2586, 0.3533],
  [500, 0.0049, 0.323, 0.272],
  [505, 0.0024, 0.4073, 0.2123],
  [510, 0.0093, 0.503, 0.1582],
  [515, 0.0291, 0.6082, 0.1117],
  [520, 0.06327, 0.71, 0.07824999],
  [525, 0.1096, 0.7932, 0.05725001],
  [530, 0.1655, 0.862, 0.04216],
  [535, 0.2257499, 0.9148501, 0.02984],
  [540, 0.2904, 0.954, 0.0203],
  [545, 0.3597, 0.9803, 0.0134],
  [550, 0.4334499, 0.9949501, 0.008749999],
  [555, 0.5120501, 1, 0.005749999],
  [560, 0.5945, 0.995, 0.0039],
  [565, 0.6784, 0.9786, 0.002749999],
  [570, 0.7621, 0.952, 0.0021],
  [575, 0.8425, 0.9154, 0.0018],
  [580, 0.9163, 0.87, 0.001650001],
  [585, 0.9786, 0.8163, 0.0014],
  [590, 1.0263, 0.757, 0.0011],
  [595, 1.0567, 0.6949, 0.001],
  [600, 1.0622, 0.631, 0.0008],
  [605, 1.0456, 0.5668, 0.0006],
  [610, 1.0026, 0.503, 0.00034],
  [615, 0.9384, 0.4412, 0.00024],
  [620, 0.8544499, 0.381, 0.00019],
  [625, 0.7514, 0.321, 0.0001],
  [630, 0.6424, 0.265, 0.00004999999],
  [635, 0.5419, 0.217, 0.00003],
  [640, 0.4479, 0.175, 0.00002],
  [645, 0.3608, 0.1382, 0.00001],
  [650, 0.2835, 0.107, 0],
  [655, 0.2187, 0.0816, 0],
  [660, 0.1649, 0.061, 0],
  [665, 0.1212, 0.04458, 0],
  [670, 0.0874, 0.032, 0],
  [675, 0.0636, 0.0232, 0],
  [680, 0.04677, 0.017, 0],
  [685, 0.0329, 0.01192, 0],
  [690, 0.0227, 0.00821, 0],
  [695, 0.01584, 0.005723, 0],
  [700, 0.01135916, 0.004102, 0],
  [705, 0.008110916, 0.002929, 0],
  [710, 0.005790346, 0.002091, 0],
  [715, 0.004109457, 0.001484, 0],
  [720, 0.002899327, 0.001047, 0],
  [725, 0.00204919, 0.00074, 0],
  [730, 0.001439971, 0.00052, 0],
  [735, 0.0009999493, 0.0003611, 0],
  [740, 0.0006900786, 0.0002492, 0],
  [745, 0.0004760213, 0.0001719, 0],
  [750, 0.0003323011, 0.00012, 0],
  [755, 0.0002348261, 0.0000848, 0],
  [760, 0.0001661505, 0.00006, 0],
  [765, 0.000117413, 0.0000424, 0],
  [770, 0.00008307527, 0.00003, 0],
  [775, 0.00005870652, 0.0000212, 0],
  [780, 0.00004150994, 0.00001499, 0],
  [785, 0.00002935326, 0.0000106, 0],
  [790, 0.00002067383, 0.0000074657, 0],
  [795, 0.00001455977, 0.0000052578, 0],
  [800, 0.00001025398, 0.0000037029, 0],
  [805, 0.000007221456, 0.0000026078, 0],
  [810, 0.000005085868, 0.0000018366, 0],
  [815, 0.000003581652, 0.0000012934, 0],
  [820, 0.000002522525, 0.00000091093, 0],
  [825, 0.000001776509, 0.00000064153, 0],
  [830, 0.000001251141, 0.00000045181, 0],
];

const XYZ_TO_SRGB = [
  3.2406, -1.5372, -0.4986,
  -0.9689, 1.8758, 0.0415,
  0.0557, -0.204, 1.057,
];

const MAX_LUMINOUS_EFFICACY = 683;
const BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE = 5;

const EXTERNAL_SOURCES = [
  {
    id: "bruneton-functions-glsl",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/functions.glsl",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/functions.glsl#L41-L53",
    usedFor: [
      "distance to top atmosphere boundary",
      "exponential density optical length integrated with the trapezoidal rule",
      "Beer-Lambert transmittance expression",
    ],
  },
  {
    id: "bruneton-demo-constants",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/demo/demo.cc",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.cc#L12-L20",
    usedFor: [
      "Earth bottom and top radii",
      "Rayleigh and Mie scale heights",
      "Rayleigh wavelength power law coefficient",
      "Mie Angstrom coefficient and alpha",
      "Mie single-scattering albedo and phase-function asymmetry",
      "solar irradiance values for 680, 550, and 440 nm",
      "Sun angular radius and exposure value",
    ],
  },
  {
    id: "bruneton-single-scattering",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/functions.glsl",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/functions.glsl#L82-L109",
    usedFor: [
      "single-scattering integrand",
      "Rayleigh and Mie radiance integration",
      "Rayleigh and Cornette-Shanks Mie phase functions",
    ],
  },
  {
    id: "bruneton-rendering-sky",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/functions.glsl",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/functions.glsl#L234-L241",
    usedFor: [
      "render-time multiplication of scattering terms by Rayleigh and Mie phase functions",
      "adding direct solar radiance when the view ray intersects the Sun",
    ],
  },
  {
    id: "bruneton-model-wavelengths",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/model.h",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/model.h#L53-L60",
    usedFor: [
      "RGB radiance-channel wavelengths at 680, 550, and 440 nm",
      "scope note that 3-wavelength radiance is not full luminance conversion",
    ],
  },
  {
    id: "bruneton-radiance-to-luminance",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/model.cc",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/model.cc#L29-L41",
    usedFor: [
      "3-wavelength spectral radiance to luminance conversion factors",
      "lambda power -3 for sky radiance and 0 for Sun radiance",
    ],
  },
  {
    id: "bruneton-scattering-texture-coordinates",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/model.cc",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/model.cc#L699-L710",
    usedFor: [
      "precomputed scattering texture dimensions include radius r, view zenith cosine mu, solar zenith cosine mu_s, and scattering angle cosine nu",
      "local solar-zenith coordinate for the second-order incident-radiance cache",
    ],
  },
  {
    id: "bruneton-2016-clear-sky-parameters",
    title: "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "aerosol single-scattering albedo 0.8",
      "Angstrom alpha 0.8",
      "Angstrom beta 0.04",
      "Cornette-Shanks asymmetry parameter g = 0.7",
    ],
  },
  {
    id: "bruneton-2016-multiple-scattering-gap",
    title: "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "the paper notes that ignored multiple scattering leaves computed irradiance about one third below measured values",
      "first proxy scale: measured ~= single_scattering / (2/3), so scale single-scattered sky radiance by 1.5",
    ],
  },
  {
    id: "bruneton-2016-nishita96-double-scattering",
    title: "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "double scattering requires integration over all incoming directions at each sample along the view ray",
      "Nishita96-style reduction to a finite set of sampling directions as a documented approximation path",
      "paper diagnosis that using only 8 directions in a single plane instead of many directions over the whole unit sphere contributes to underestimated measured values",
    ],
  },
  {
    id: "bruneton-2016-no-ozone-comparison-policy",
    title: "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "paper comparison implementation policy that neglects ozone absorption",
      "no-ozone step for matching the paper's rendered model-comparison setup",
    ],
  },
  {
    id: "bruneton-2016-figure1-sky-radiance-target",
    title:
      "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models, Figure 1",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "directly extracted Figure 1 skydome tiles show the Sun direction with a red cross overlay",
      "target-contract test that compares atmospheric sky radiance and aureole without adding direct solar-disc radiance to the camera pass",
    ],
  },
  {
    id: "bruneton-2016-figure1-display-transform",
    title:
      "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models, Figure 1 caption",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "Figure 1 renders spectral radiance convolved with CIE color matching functions",
      "Figure 1 converts XYZ to linear sRGB before display",
      "Figure 1 tone maps with 1 - exp(-kL)",
    ],
  },
  {
    id: "bruneton-2016-comparison-source-tone-map",
    title:
      "Eric Bruneton, clear-sky-models comparison source, atmosphere/comparisons.cc",
    url:
      "https://github.com/ebruneton/clear-sky-models/blob/master/atmosphere/comparisons.cc#L148-L153",
    usedFor: [
      "Figure-style comparison tone-map implementation c = 5 * MaxLuminousEfficacy",
      "source-derived k = 1 / (5 * 683)",
    ],
  },
  {
    id: "bruneton-2016-figure1-extracted-target-tiles",
    title:
      "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models, extracted Figure 1 skydome tiles",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "direct external low-Sun and high-Sun skydome targets",
      "single global k multiplier fit for the paper Figure 1 tone-map equation, excluding non-sky pixels and red Sun-direction cross pixels",
    ],
  },
  {
    id: "bruneton-2016-figure1-sun-zenith-angles",
    title:
      "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models, Figure 1 row labels",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "low-Sun target row sun zenith angle 87 degrees",
      "high-Sun target row sun zenith angle 21 degrees",
    ],
  },
  {
    id: "bruneton-2016-figure1-four-view-layout",
    title:
      "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models, Figure 1 layout",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "Figure 1 four skydome row labels: 06h00 / 87 degrees, 10h15 / 41 degrees, 11h15 / 31 degrees, and 13h15 / 21 degrees",
      "Sun azimuth/orientation measured from red-cross centers in the directly extracted Bruneton-column Figure 1 tiles Im6, Im15, Im25, and Im35",
    ],
  },
  {
    id: "bruneton-2016-40-wavelength-evaluation",
    title:
      "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models, spectral comparison setup",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "paper comparison models are run spectrally with the same 40 wavelengths between 360 nm and 830 nm",
      "40-wavelength direct per-pixel spectral evaluation step",
    ],
  },
  {
    id: "gonzalez-2009-fibonacci-sphere-lattice",
    title:
      "Alvaro Gonzalez, Measurement of areas on a sphere using Fibonacci and latitude-longitude lattices",
    url: "https://arxiv.org/abs/0912.4540",
    usedFor: [
      "Fibonacci lattice points are evenly distributed on the sphere with each point representing almost the same area",
      "full-sphere second-order scattering quadrature directions",
    ],
  },
  {
    id: "bruneton-demo-sun-angular-size",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/demo/demo.glsl",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.glsl",
    usedFor: [
      "Sun visibility based on the view ray / sun direction angular test",
      "finite angular Sun size for rendering the direct solar disc",
    ],
  },
  {
    id: "pbrt-camera-measurement-equation",
    title: "Physically Based Rendering, 4th edition, Film and Imaging",
    url: "https://pbr-book.org/4ed/Cameras_and_Film/Film_and_Imaging",
    usedFor: [
      "camera pixels measure incident radiance integrated over finite pixel area and angular footprint",
      "motivation for averaging direct solar-disc radiance over the fisheye pixel footprint instead of evaluating only the center ray",
    ],
  },
  {
    id: "bruneton-ground-reflection",
    title:
      "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/demo/demo.cc, atmosphere/model.cc, and atmosphere/demo/demo.glsl",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.glsl#L345-L369",
    usedFor: [
      "ground_albedo = 0.1 from the demo atmosphere setup",
      "ground_albedo is part of the generated AtmosphereParameters",
      "ground radiance is Lambertian: albedo * (1 / PI) * incident irradiance, then attenuated along the camera-to-ground segment",
      "ground reflection uses sun irradiance plus sky irradiance",
      "ground reflection applies direct Sun visibility separately from sky visibility",
    ],
  },
  {
    id: "bruneton-ozone-absorption",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/demo/demo.cc",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.cc#L14-L20",
    usedFor: [
      "ozone absorption cross sections",
      "300 Dobson unit ozone amount",
      "piecewise linear ozone density profile from 10 km to 40 km",
    ],
  },
  {
    id: "bruneton-color-constants",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/constants.h",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/constants.h",
    usedFor: [
      "CIE 1931 2-degree color matching functions",
      "XYZ to linear sRGB matrix",
      "maximum luminous efficacy",
    ],
  },
  {
    id: "bruneton-demo-display",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/demo/demo.glsl",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.glsl",
    usedFor: [
      "demo-style exposure display transform: pow(1 - exp(-radiance / white_point * exposure), 1 / 2.2)",
    ],
  },
  {
    id: "bruneton-demo-white-balance",
    title: "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/demo/demo.cc",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.cc#L328-L340",
    usedFor: [
      "optional white balance from extraterrestrial solar spectrum converted to linear sRGB",
      "normalizing the white point by the average of its RGB components before setting the shader uniform",
    ],
  },
  {
    id: "bruneton-2016-white-balance-note",
    title: "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "paper note that perceptual effects such as tone mapping and white balance can improve realism",
    ],
  },
  {
    id: "fisheye-equidistant-projection",
    title: "Fisheye lens mapping functions",
    url: "https://en.wikipedia.org/wiki/Fisheye_lens#Mapping_function",
    usedFor: [
      "equidistant fisheye diagnostic mapping from angular distance to image radius",
    ],
  },
];

function getRequestedStepId() {
  const stepArgument = process.argv.find((argument) =>
    argument.startsWith("--step=")
  );
  const requestedStepId = stepArgument
    ? stepArgument.slice("--step=".length)
    : DEFAULT_STEP_ID;

  if (!Object.hasOwn(STEPS, requestedStepId)) {
    const validSteps = Object.keys(STEPS).join(", ");
    throw new Error(`Unknown step "${requestedStepId}". Valid steps: ${validSteps}`);
  }

  return requestedStepId;
}

function isSingleScatteringStep() {
  return [
    "single-scattering-baseline",
    "luminance-conversion-baseline",
    "bruneton-2016-parameters",
    "ozone-absorption-baseline",
    "spectral-cie-baseline",
    "spectral-demo-aerosol-baseline",
    "multiple-scattering-proxy-baseline",
    "second-order-scattering-baseline",
    "ground-bounce-coupling-baseline",
    "ground-sky-irradiance-coupling-baseline",
    "paper-comparison-no-ozone-baseline",
    "demo-white-balance-display-baseline",
    "paper-aerosol-transport-baseline",
    "nishita96-plane-second-order-baseline",
    "pixel-filtered-solar-disc-baseline",
    "paper-sky-radiance-no-direct-sun-baseline",
    "fibonacci-sphere-second-order-baseline",
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "figure1-four-view-source-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesLuminanceConversion() {
  return [
    "luminance-conversion-baseline",
    "bruneton-2016-parameters",
    "ozone-absorption-baseline",
    "spectral-cie-baseline",
    "spectral-demo-aerosol-baseline",
    "multiple-scattering-proxy-baseline",
    "second-order-scattering-baseline",
    "ground-bounce-coupling-baseline",
    "ground-sky-irradiance-coupling-baseline",
    "paper-comparison-no-ozone-baseline",
    "demo-white-balance-display-baseline",
    "paper-aerosol-transport-baseline",
    "nishita96-plane-second-order-baseline",
    "pixel-filtered-solar-disc-baseline",
    "paper-sky-radiance-no-direct-sun-baseline",
    "fibonacci-sphere-second-order-baseline",
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "figure1-four-view-source-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesFullSpectralConversion() {
  return [
    "spectral-cie-baseline",
    "spectral-demo-aerosol-baseline",
    "multiple-scattering-proxy-baseline",
    "second-order-scattering-baseline",
    "ground-bounce-coupling-baseline",
    "ground-sky-irradiance-coupling-baseline",
    "paper-comparison-no-ozone-baseline",
    "demo-white-balance-display-baseline",
    "paper-aerosol-transport-baseline",
    "nishita96-plane-second-order-baseline",
    "pixel-filtered-solar-disc-baseline",
    "paper-sky-radiance-no-direct-sun-baseline",
    "fibonacci-sphere-second-order-baseline",
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "figure1-four-view-source-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function includesOzoneAbsorption() {
  return [
    "ozone-absorption-baseline",
    "spectral-cie-baseline",
    "spectral-demo-aerosol-baseline",
    "multiple-scattering-proxy-baseline",
    "second-order-scattering-baseline",
    "ground-bounce-coupling-baseline",
    "ground-sky-irradiance-coupling-baseline",
  ].includes(STEP.id);
}

function usesMultipleScatteringProxy() {
  return STEP.id === "multiple-scattering-proxy-baseline";
}

function usesSecondOrderScattering() {
  return [
    "second-order-scattering-baseline",
    "ground-bounce-coupling-baseline",
    "ground-sky-irradiance-coupling-baseline",
    "paper-comparison-no-ozone-baseline",
    "demo-white-balance-display-baseline",
    "paper-aerosol-transport-baseline",
    "nishita96-plane-second-order-baseline",
    "pixel-filtered-solar-disc-baseline",
    "paper-sky-radiance-no-direct-sun-baseline",
    "fibonacci-sphere-second-order-baseline",
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "figure1-four-view-source-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesGroundBounceCoupling() {
  return [
    "ground-bounce-coupling-baseline",
    "ground-sky-irradiance-coupling-baseline",
    "paper-comparison-no-ozone-baseline",
    "demo-white-balance-display-baseline",
    "paper-aerosol-transport-baseline",
    "nishita96-plane-second-order-baseline",
    "pixel-filtered-solar-disc-baseline",
    "paper-sky-radiance-no-direct-sun-baseline",
    "fibonacci-sphere-second-order-baseline",
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesGroundSkyIrradianceCoupling() {
  return [
    "ground-sky-irradiance-coupling-baseline",
    "paper-comparison-no-ozone-baseline",
    "demo-white-balance-display-baseline",
    "paper-aerosol-transport-baseline",
    "nishita96-plane-second-order-baseline",
    "pixel-filtered-solar-disc-baseline",
    "paper-sky-radiance-no-direct-sun-baseline",
    "fibonacci-sphere-second-order-baseline",
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesPaperComparisonNoOzonePolicy() {
  return [
    "paper-comparison-no-ozone-baseline",
    "demo-white-balance-display-baseline",
    "paper-aerosol-transport-baseline",
    "nishita96-plane-second-order-baseline",
    "pixel-filtered-solar-disc-baseline",
    "paper-sky-radiance-no-direct-sun-baseline",
    "fibonacci-sphere-second-order-baseline",
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "figure1-four-view-source-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesDemoWhiteBalance() {
  return [
    "demo-white-balance-display-baseline",
    "paper-aerosol-transport-baseline",
    "nishita96-plane-second-order-baseline",
    "pixel-filtered-solar-disc-baseline",
    "paper-sky-radiance-no-direct-sun-baseline",
    "fibonacci-sphere-second-order-baseline",
  ].includes(STEP.id);
}

function usesBruneton2016Aerosols() {
  return [
    "bruneton-2016-parameters",
    "ozone-absorption-baseline",
    "spectral-cie-baseline",
    "paper-aerosol-transport-baseline",
    "nishita96-plane-second-order-baseline",
    "pixel-filtered-solar-disc-baseline",
    "paper-sky-radiance-no-direct-sun-baseline",
    "fibonacci-sphere-second-order-baseline",
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "figure1-four-view-source-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesNishita96SecondOrderDirections() {
  return STEP.id === "nishita96-plane-second-order-baseline";
}

function usesFibonacciSphereSecondOrderDirections() {
  return [
    "fibonacci-sphere-second-order-baseline",
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "figure1-four-view-source-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesPaperFigure1ToneMap() {
  return [
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "figure1-four-view-source-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesFittedPaperFigure1ToneMap() {
  return [
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesDerivedPaperFigure1ToneMapK() {
  return [
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
  ].includes(STEP.id);
}

function usesSourcePaperFigure1ToneMapK() {
  return STEP.id === "figure1-four-view-source-k-no-ground-baseline";
}

function usesDerivedPaperFigure1NoGround() {
  return STEP.id === "paper-figure1-derived-k-no-ground-baseline";
}

function usesDerivedPaperFigure1DirectGroundOnly() {
  return STEP.id === "paper-figure1-derived-k-direct-ground-baseline";
}

function usesFigure1FourSkydomeViews() {
  return [
    "figure1-four-view-derived-k-no-ground-baseline",
    "figure1-four-view-source-k-no-ground-baseline",
  ].includes(STEP.id);
}

function usesFigure1SunZenithAngles() {
  return [
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesPixelFilteredSolarDisc() {
  return STEP.id === "pixel-filtered-solar-disc-baseline";
}

function omitsDirectSolarDiscForPaperSkyRadiance() {
  return [
    "paper-sky-radiance-no-direct-sun-baseline",
    "fibonacci-sphere-second-order-baseline",
    "paper-figure1-tone-map-baseline",
    "paper-figure1-fitted-tone-map-baseline",
    "paper-figure1-derived-k-no-ground-baseline",
    "figure1-four-view-derived-k-no-ground-baseline",
    "figure1-four-view-source-k-no-ground-baseline",
    "paper-figure1-derived-k-direct-ground-baseline",
    "figure1-sun-zenith-baseline",
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesPaperFortyWavelengthSampling() {
  return [
    "paper-40-wavelength-baseline",
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesPaperFortyWavelengthRefitToneMap() {
  return [
    "paper-40-wavelength-refit-tone-map-baseline",
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesShadowedGroundSkyIrradiance() {
  return [
    "shadowed-ground-sky-irradiance-baseline",
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesSecondOrderSunAngleIncidentCache() {
  return [
    "second-order-sun-angle-cache-baseline",
    "second-order-sun-view-angle-cache-baseline",
  ].includes(STEP.id);
}

function usesSecondOrderSunViewAngleIncidentCache() {
  return STEP.id === "second-order-sun-view-angle-cache-baseline";
}

function activeScenes() {
  if (usesFigure1FourSkydomeViews()) {
    return FIGURE1_FOUR_VIEW_SCENES;
  }

  if (!usesFigure1SunZenithAngles()) {
    return SCENES;
  }

  return SCENES.map((scene) => {
    if (scene.id === "sunset") {
      return {
        ...scene,
        sunAltitudeDegrees: 3,
        sourceSunZenithDegrees: 87,
      };
    }
    if (scene.id === "midday") {
      return {
        ...scene,
        sunAltitudeDegrees: 69,
        sourceSunZenithDegrees: 21,
      };
    }

    return scene;
  });
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function nextArtifactDirectory() {
  ensureDirectory(ARTIFACT_ROOT);

  const nextNumber =
    fs
      .readdirSync(ARTIFACT_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
      .map((entry) => Number(entry.name.slice(0, 3)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  const directory = path.join(
    ARTIFACT_ROOT,
    `${String(nextNumber).padStart(3, "0")}-${STEP.label}`
  );

  ensureDirectory(directory);
  return directory;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function putPixel(pixels, offset, rgba) {
  pixels[offset] = clampByte(rgba[0]);
  pixels[offset + 1] = clampByte(rgba[1]);
  pixels[offset + 2] = clampByte(rgba[2]);
  pixels[offset + 3] = clampByte(rgba[3]);
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length(vector) {
  return Math.sqrt(dot(vector, vector));
}

function addScaled(origin, direction, distance) {
  return [
    origin[0] + direction[0] * distance,
    origin[1] + direction[1] * distance,
    origin[2] + direction[2] * distance,
  ];
}

function normalize(vector) {
  const vectorLength = length(vector);

  return [
    vector[0] / vectorLength,
    vector[1] / vectorLength,
    vector[2] / vectorLength,
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return t * t * (3 - 2 * t);
}

function addVectors(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVector(vector, scalar) {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function sceneOutputName(scene) {
  return `${scene.id}-${STEP.outputSuffix}.png`;
}

function sunDirection(scene) {
  const altitude = degreesToRadians(scene.sunAltitudeDegrees);
  const azimuth = degreesToRadians(scene.sunAzimuthDegrees);
  const horizontalLength = Math.cos(altitude);

  return normalize([
    horizontalLength * Math.cos(azimuth),
    horizontalLength * Math.sin(azimuth),
    Math.sin(altitude),
  ]);
}

function fisheyeSample(x, y) {
  const dx = x - CENTER;
  const dy = y - CENTER;
  const radius = Math.sqrt(dx * dx + dy * dy);
  const normalizedRadius = radius / SKY_RADIUS;

  if (normalizedRadius > 1) {
    return null;
  }

  const azimuth = Math.atan2(-dy, dx);
  const zenithAngle = normalizedRadius * (Math.PI / 2);
  const altitude = Math.PI / 2 - zenithAngle;
  const horizontalLength = Math.sin(zenithAngle);

  return {
    normalizedRadius,
    azimuth,
    zenithAngle,
    altitude,
    direction: normalize([
      horizontalLength * Math.cos(azimuth),
      horizontalLength * Math.sin(azimuth),
      Math.cos(zenithAngle),
    ]),
  };
}

function observerPosition() {
  return [
    0,
    0,
    ATMOSPHERE.bottomRadiusMeters + ATMOSPHERE.observerHeightMeters,
  ];
}

function rayleighScatteringCoefficient() {
  return rayleighScatteringCoefficientAt(
    ATMOSPHERE.diagnosticWavelengthMicrometers
  );
}

function mieExtinctionCoefficient() {
  return mieExtinctionCoefficientAt(ATMOSPHERE.diagnosticWavelengthMicrometers);
}

function wavelengthNanometersToMicrometers(wavelengthNanometers) {
  return wavelengthNanometers * 1e-3;
}

function interpolateSamples(sampleWavelengths, sampleValues, wavelength) {
  if (wavelength <= sampleWavelengths[0]) {
    return sampleValues[0];
  }

  const lastIndex = sampleWavelengths.length - 1;

  if (wavelength >= sampleWavelengths[lastIndex]) {
    return sampleValues[lastIndex];
  }

  let rightIndex = 1;

  while (sampleWavelengths[rightIndex] < wavelength) {
    rightIndex += 1;
  }

  const leftIndex = rightIndex - 1;
  const leftWavelength = sampleWavelengths[leftIndex];
  const rightWavelength = sampleWavelengths[rightIndex];
  const mix =
    (wavelength - leftWavelength) / (rightWavelength - leftWavelength);

  return (
    sampleValues[leftIndex] * (1 - mix) + sampleValues[rightIndex] * mix
  );
}

function solarIrradianceAt(wavelength) {
  const wavelengths = SOLAR_IRRADIANCE_SAMPLES.map(
    (_value, index) => 360 + index * 10
  );

  return interpolateSamples(wavelengths, SOLAR_IRRADIANCE_SAMPLES, wavelength);
}

let fullSpectralChannelsCache = null;

function fullSpectralChannels() {
  if (!fullSpectralChannelsCache) {
    const sampleCount = usesPaperFortyWavelengthSampling() ? 40 : 15;
    const delta = (830 - 360) / sampleCount;

    fullSpectralChannelsCache = Array.from({ length: sampleCount }, (_item, index) => {
      const wavelengthNanometers = 360 + (index + 0.5) * delta;

      return {
        name: `lambda-${Math.round(wavelengthNanometers)}`,
        wavelengthNanometers,
        solarIrradiance: solarIrradianceAt(wavelengthNanometers),
        wavelengthBinWidthNanometers: delta,
      };
    });
  }

  return fullSpectralChannelsCache;
}

function activeSpectralChannels() {
  return usesFullSpectralConversion()
    ? fullSpectralChannels()
    : SPECTRAL_CHANNELS;
}

function activeAerosolParameters() {
  return usesBruneton2016Aerosols()
    ? BRUNETON_2016_AEROSOL
    : {
        mieAngstromAlpha: ATMOSPHERE.mieAngstromAlpha,
        mieAngstromBeta: ATMOSPHERE.mieAngstromBeta,
        mieSingleScatteringAlbedo: ATMOSPHERE.mieSingleScatteringAlbedo,
        miePhaseFunctionG: ATMOSPHERE.miePhaseFunctionG,
      };
}

function ozoneCrossSectionAt(wavelength) {
  const wavelengths = OZONE_CROSS_SECTION_SAMPLES.map(
    (_value, index) => 360 + index * 10
  );

  return interpolateSamples(wavelengths, OZONE_CROSS_SECTION_SAMPLES, wavelength);
}

function maxOzoneNumberDensity() {
  return (
    (ATMOSPHERE.ozoneDobsonUnits *
      ATMOSPHERE.dobsonUnitMoleculesPerSquareMeter) /
    ATMOSPHERE.ozoneDensityIntegralMeters
  );
}

function ozoneAbsorptionCoefficientAt(wavelengthNanometers) {
  if (!ATMOSPHERE.useOzone || !includesOzoneAbsorption()) {
    return 0;
  }

  return maxOzoneNumberDensity() * ozoneCrossSectionAt(wavelengthNanometers);
}

function cieColorMatchingValue(wavelength, component) {
  if (wavelength <= 360 || wavelength >= 830) {
    return 0;
  }

  const wavelengths = CIE_2_DEG_COLOR_MATCHING_FUNCTIONS.map(
    (sample) => sample[0]
  );
  const values = CIE_2_DEG_COLOR_MATCHING_FUNCTIONS.map(
    (sample) => sample[component]
  );

  return interpolateSamples(wavelengths, values, wavelength);
}

function computeSpectralRadianceToLuminanceFactors(lambdaPower) {
  const solarR = solarIrradianceAt(680);
  const solarG = solarIrradianceAt(550);
  const solarB = solarIrradianceAt(440);
  const factors = [0, 0, 0];

  for (let lambda = 360; lambda < 830; lambda += 1) {
    const x = cieColorMatchingValue(lambda, 1);
    const y = cieColorMatchingValue(lambda, 2);
    const z = cieColorMatchingValue(lambda, 3);
    const solarIrradiance = solarIrradianceAt(lambda);
    const rgbBar = [
      XYZ_TO_SRGB[0] * x + XYZ_TO_SRGB[1] * y + XYZ_TO_SRGB[2] * z,
      XYZ_TO_SRGB[3] * x + XYZ_TO_SRGB[4] * y + XYZ_TO_SRGB[5] * z,
      XYZ_TO_SRGB[6] * x + XYZ_TO_SRGB[7] * y + XYZ_TO_SRGB[8] * z,
    ];

    factors[0] +=
      rgbBar[0] *
      solarIrradiance /
      solarR *
      (lambda / 680) ** lambdaPower;
    factors[1] +=
      rgbBar[1] *
      solarIrradiance /
      solarG *
      (lambda / 550) ** lambdaPower;
    factors[2] +=
      rgbBar[2] *
      solarIrradiance /
      solarB *
      (lambda / 440) ** lambdaPower;
  }

  return factors.map((factor) => factor * MAX_LUMINOUS_EFFICACY);
}

let radianceToLuminanceFactorsCache = null;

function radianceToLuminanceFactors() {
  if (!radianceToLuminanceFactorsCache) {
    radianceToLuminanceFactorsCache = {
      sky: computeSpectralRadianceToLuminanceFactors(-3),
      sun: computeSpectralRadianceToLuminanceFactors(0),
    };
  }

  return radianceToLuminanceFactorsCache;
}

let displayWhitePointCache = null;

function displayWhitePoint() {
  if (!usesDemoWhiteBalance()) {
    return [1, 1, 1];
  }

  if (!displayWhitePointCache) {
    let x = 0;
    let y = 0;
    let z = 0;

    for (let lambda = 360; lambda <= 830; lambda += 1) {
      const solarIrradiance = solarIrradianceAt(lambda);

      x += cieColorMatchingValue(lambda, 1) * solarIrradiance;
      y += cieColorMatchingValue(lambda, 2) * solarIrradiance;
      z += cieColorMatchingValue(lambda, 3) * solarIrradiance;
    }

    const linearSrgb = [
      XYZ_TO_SRGB[0] * x + XYZ_TO_SRGB[1] * y + XYZ_TO_SRGB[2] * z,
      XYZ_TO_SRGB[3] * x + XYZ_TO_SRGB[4] * y + XYZ_TO_SRGB[5] * z,
      XYZ_TO_SRGB[6] * x + XYZ_TO_SRGB[7] * y + XYZ_TO_SRGB[8] * z,
    ];
    const average =
      (linearSrgb[0] + linearSrgb[1] + linearSrgb[2]) / linearSrgb.length;

    displayWhitePointCache = linearSrgb.map((value) => value / average);
  }

  return displayWhitePointCache;
}

function displayExposureScalar() {
  return usesLuminanceConversion()
    ? ATMOSPHERE.displayExposure * ATMOSPHERE.luminanceExposureScale
    : ATMOSPHERE.displayExposure;
}

function brunetonComparisonToneMapK() {
  return 1 /
    (BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE * MAX_LUMINOUS_EFFICACY);
}

function paperFigure1ToneMapK() {
  if (usesSourcePaperFigure1ToneMapK()) {
    return brunetonComparisonToneMapK();
  }

  if (usesDerivedPaperFigure1ToneMapK()) {
    return ATMOSPHERE.paperFigure1ToneMapFittedK;
  }

  return (
    displayExposureScalar() *
    (usesPaperFortyWavelengthRefitToneMap()
      ? ATMOSPHERE.paperFortyWavelengthToneMapFittedScale
      : usesFittedPaperFigure1ToneMap()
      ? ATMOSPHERE.paperFigure1ToneMapFittedScale
      : 1)
  );
}

function rayleighScatteringCoefficientAt(wavelengthMicrometers) {
  return ATMOSPHERE.rayleighCoefficientScale * wavelengthMicrometers ** -4;
}

function mieExtinctionCoefficientAt(wavelengthMicrometers) {
  const aerosol = activeAerosolParameters();

  return (
    (aerosol.mieAngstromBeta / ATMOSPHERE.mieScaleHeightMeters) *
    wavelengthMicrometers ** -aerosol.mieAngstromAlpha
  );
}

function mieScatteringCoefficientAt(wavelengthMicrometers) {
  const aerosol = activeAerosolParameters();

  return (
    mieExtinctionCoefficientAt(wavelengthMicrometers) *
    aerosol.mieSingleScatteringAlbedo
  );
}

function distanceToTopAtmosphereBoundary(radius, mu) {
  const discriminant =
    radius * radius * (mu * mu - 1) +
    ATMOSPHERE.topRadiusMeters * ATMOSPHERE.topRadiusMeters;

  return Math.max(0, -radius * mu + Math.sqrt(Math.max(0, discriminant)));
}

function exponentialDensity(altitudeMeters, scaleHeightMeters) {
  return Math.exp(-Math.max(0, altitudeMeters) / scaleHeightMeters);
}

function ozoneDensity(altitudeMeters) {
  const altitude = Math.max(0, altitudeMeters);

  if (altitude < 25000) {
    return Math.max(0, Math.min(1, altitude / 15000 - 2 / 3));
  }

  return Math.max(0, Math.min(1, -altitude / 15000 + 8 / 3));
}

function densityAtPosition(position) {
  const altitude = length(position) - ATMOSPHERE.bottomRadiusMeters;

  return {
    rayleigh: exponentialDensity(altitude, ATMOSPHERE.rayleighScaleHeightMeters),
    mie: exponentialDensity(altitude, ATMOSPHERE.mieScaleHeightMeters),
    absorption: ozoneDensity(altitude),
  };
}

function computeOpticalLengthsAlongDistance(
  origin,
  direction,
  distance,
  sampleCount
) {
  const step = distance / sampleCount;
  let rayleighOpticalLength = 0;
  let mieOpticalLength = 0;
  let absorptionOpticalLength = 0;

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const sampleDistance = sampleIndex * step;
    const samplePosition = addScaled(origin, direction, sampleDistance);
    const density = densityAtPosition(samplePosition);
    const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;

    rayleighOpticalLength += density.rayleigh * weight * step;
    mieOpticalLength += density.mie * weight * step;
    absorptionOpticalLength += density.absorption * weight * step;
  }

  return {
    distance,
    rayleighOpticalLength,
    mieOpticalLength,
    absorptionOpticalLength,
  };
}

function computeOpticalLengths(origin, direction, sampleCount) {
  const radius = length(origin);
  const mu = dot(origin, direction) / radius;
  const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
  const opticalLengths = computeOpticalLengthsAlongDistance(
    origin,
    direction,
    distanceToTop,
    sampleCount || ATMOSPHERE.opticalLengthSampleCount
  );

  return {
    distanceToTop,
    ...opticalLengths,
  };
}

function computeTransmittance(opticalLengths) {
  const opticalDepth =
    rayleighScatteringCoefficient() * opticalLengths.rayleighOpticalLength +
    mieExtinctionCoefficient() * opticalLengths.mieOpticalLength +
    ozoneAbsorptionCoefficientAt(550) *
      (opticalLengths.absorptionOpticalLength || 0);

  return {
    opticalDepth,
    transmittance: Math.exp(-opticalDepth),
  };
}

function computeTransmittanceSpectrum(opticalLengths) {
  return activeSpectralChannels().map((channel) => {
    const wavelengthMicrometers = wavelengthNanometersToMicrometers(
      channel.wavelengthNanometers
    );
    const opticalDepth =
      rayleighScatteringCoefficientAt(wavelengthMicrometers) *
        opticalLengths.rayleighOpticalLength +
      mieExtinctionCoefficientAt(wavelengthMicrometers) *
        opticalLengths.mieOpticalLength +
      ozoneAbsorptionCoefficientAt(channel.wavelengthNanometers) *
        (opticalLengths.absorptionOpticalLength || 0);

    return Math.exp(-opticalDepth);
  });
}

function rayIntersectsGround(radius, mu) {
  return (
    mu < 0 &&
    radius * radius * (mu * mu - 1) +
      ATMOSPHERE.bottomRadiusMeters * ATMOSPHERE.bottomRadiusMeters >=
      0
  );
}

function distanceToGroundBoundary(origin, direction) {
  const radius = length(origin);
  const mu = dot(origin, direction) / radius;
  const discriminant =
    radius * radius * (mu * mu - 1) +
    ATMOSPHERE.bottomRadiusMeters * ATMOSPHERE.bottomRadiusMeters;

  if (mu >= 0 || discriminant < 0) {
    return null;
  }

  const distance = -radius * mu - Math.sqrt(discriminant);

  return distance > 0 ? distance : null;
}

function computeTransmittanceToSunSpectrum(position, sunRay) {
  const radius = length(position);
  const mu = dot(position, sunRay) / radius;

  if (rayIntersectsGround(radius, mu)) {
    return activeSpectralChannels().map(() => 0);
  }

  return computeTransmittanceSpectrum(
    computeOpticalLengths(
      position,
      sunRay,
      ATMOSPHERE.sunTransmittanceSampleCount
    )
  );
}

function directSunDiagnostics(scene) {
  const diagnostics = computeTransmittance(
    computeOpticalLengths(observerPosition(), sunDirection(scene))
  );

  return {
    opticalDepth550nm: diagnostics.opticalDepth,
    transmittance550nm: diagnostics.transmittance,
  };
}

function angularDistanceOnImage(x, y, scene) {
  const altitude = degreesToRadians(scene.sunAltitudeDegrees);
  const azimuth = degreesToRadians(scene.sunAzimuthDegrees);
  const zenithAngle = Math.PI / 2 - altitude;
  const radius = (zenithAngle / (Math.PI / 2)) * SKY_RADIUS;
  const sunX = CENTER + Math.cos(azimuth) * radius;
  const sunY = CENTER - Math.sin(azimuth) * radius;
  const dx = x - sunX;
  const dy = y - sunY;

  return Math.sqrt(dx * dx + dy * dy);
}

function isNearGridLine(normalizedRadius, azimuth) {
  const ringHit = [0.25, 0.5, 0.75, 1].some(
    (ring) => Math.abs(normalizedRadius - ring) < 0.004
  );
  const axisHit =
    Math.abs(Math.sin(azimuth * 2)) < 0.008 && normalizedRadius > 0.06;

  return ringHit || axisHit;
}

function renderDiagnosticSky(scene) {
  const pixels = Buffer.alloc(IMAGE_SIZE * IMAGE_SIZE * 4);

  for (let y = 0; y < IMAGE_SIZE; y += 1) {
    for (let x = 0; x < IMAGE_SIZE; x += 1) {
      const offset = (y * IMAGE_SIZE + x) * 4;
      const dx = x - CENTER;
      const dy = y - CENTER;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const normalizedRadius = radius / SKY_RADIUS;

      if (normalizedRadius > 1) {
        putPixel(pixels, offset, [0, 0, 0, 0]);
        continue;
      }

      const azimuth = Math.atan2(-dy, dx);
      const zenithAngle = normalizedRadius * (Math.PI / 2);
      const altitude = Math.PI / 2 - zenithAngle;
      const altitudeMix = altitude / (Math.PI / 2);
      const base = 34 + 98 * altitudeMix;
      const horizonTint = 26 * (1 - altitudeMix);
      const gridLine = isNearGridLine(normalizedRadius, azimuth);
      const sunDistance = angularDistanceOnImage(x, y, scene);
      const sunMarker = sunDistance < 7;
      const sunHalo = sunDistance < 18;

      if (sunMarker) {
        putPixel(pixels, offset, [255, 240, 80, 255]);
      } else if (sunHalo) {
        const halo = 1 - sunDistance / 18;
        putPixel(pixels, offset, [
          base + 100 * halo,
          base + 80 * halo,
          base + 20 * halo,
          255,
        ]);
      } else if (gridLine) {
        putPixel(pixels, offset, [220, 232, 245, 255]);
      } else {
        putPixel(pixels, offset, [
          base + horizonTint,
          base + horizonTint * 0.7,
          base + 22,
          255,
        ]);
      }
    }
  }

  return pixels;
}

function makeEmptyStats() {
  return {
    minTransmittance550nm: Number.POSITIVE_INFINITY,
    maxTransmittance550nm: Number.NEGATIVE_INFINITY,
    minOpticalDepth550nm: Number.POSITIVE_INFINITY,
    maxOpticalDepth550nm: Number.NEGATIVE_INFINITY,
    maxDistanceToTopMeters: 0,
  };
}

function updateStats(stats, opticalLengths, transmittance) {
  stats.minTransmittance550nm = Math.min(
    stats.minTransmittance550nm,
    transmittance.transmittance
  );
  stats.maxTransmittance550nm = Math.max(
    stats.maxTransmittance550nm,
    transmittance.transmittance
  );
  stats.minOpticalDepth550nm = Math.min(
    stats.minOpticalDepth550nm,
    transmittance.opticalDepth
  );
  stats.maxOpticalDepth550nm = Math.max(
    stats.maxOpticalDepth550nm,
    transmittance.opticalDepth
  );
  stats.maxDistanceToTopMeters = Math.max(
    stats.maxDistanceToTopMeters,
    opticalLengths.distanceToTop
  );
}

function renderTransmittanceDiagnosticSky(scene) {
  const pixels = Buffer.alloc(IMAGE_SIZE * IMAGE_SIZE * 4);
  const origin = observerPosition();
  const stats = makeEmptyStats();
  const sunDiagnostics = directSunDiagnostics(scene);

  for (let y = 0; y < IMAGE_SIZE; y += 1) {
    for (let x = 0; x < IMAGE_SIZE; x += 1) {
      const offset = (y * IMAGE_SIZE + x) * 4;
      const sample = fisheyeSample(x, y);

      if (!sample) {
        putPixel(pixels, offset, [0, 0, 0, 0]);
        continue;
      }

      const opticalLengths = computeOpticalLengths(origin, sample.direction);
      const transmittance = computeTransmittance(opticalLengths);
      const sunDistance = angularDistanceOnImage(x, y, scene);
      const sunMarker = sunDistance < 7;
      const sunHalo = sunDistance < 18;
      const gridLine = isNearGridLine(sample.normalizedRadius, sample.azimuth);
      const opticalDepthDisplay =
        1 - Math.exp(-0.55 * transmittance.opticalDepth);

      updateStats(stats, opticalLengths, transmittance);

      if (sunMarker) {
        const directSun = sunDiagnostics.transmittance550nm;
        putPixel(pixels, offset, [
          80 + 175 * directSun,
          70 + 160 * directSun,
          30 + 70 * directSun,
          255,
        ]);
      } else if (sunHalo) {
        const halo = 1 - sunDistance / 18;
        putPixel(pixels, offset, [
          130 + 90 * halo,
          120 + 60 * halo,
          60 + 30 * halo,
          255,
        ]);
      } else if (gridLine) {
        putPixel(pixels, offset, [235, 235, 235, 255]);
      } else {
        putPixel(pixels, offset, [
          255 * opticalDepthDisplay,
          255 * transmittance.transmittance,
          255 * Math.max(0, Math.sin(sample.altitude)),
          255,
        ]);
      }
    }
  }

  return {
    pixels,
    diagnostics: {
      directSun: sunDiagnostics,
      imageStats: stats,
      zenith: computeTransmittance(
        computeOpticalLengths(origin, [0, 0, 1])
      ),
      horizonAzimuth0: computeTransmittance(
        computeOpticalLengths(origin, [1, 0, 0])
      ),
    },
  };
}

function rayleighPhaseFunction(nu) {
  return (3 / (16 * Math.PI)) * (1 + nu * nu);
}

function miePhaseFunction(g, nu) {
  const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));

  return (
    (k * (1 + nu * nu)) /
    (1 + g * g - 2 * g * nu) ** 1.5
  );
}

function solarRadianceSpectrum() {
  const sunSolidAngle =
    Math.PI *
    ATMOSPHERE.sunAngularRadiusRadians *
    ATMOSPHERE.sunAngularRadiusRadians;

  return activeSpectralChannels().map(
    (channel) => channel.solarIrradiance / sunSolidAngle
  );
}

function finiteSunVisibility(viewRay, sunRay) {
  const angle = Math.acos(clamp(dot(viewRay, sunRay), -1, 1));
  const pixelAngularRadius = (Math.PI / 2) / SKY_RADIUS;
  const innerRadius = Math.max(
    0,
    ATMOSPHERE.sunAngularRadiusRadians - 0.5 * pixelAngularRadius
  );
  const outerRadius =
    ATMOSPHERE.sunAngularRadiusRadians + 2 * pixelAngularRadius;

  return 1 - smoothstep(innerRadius, outerRadius, angle);
}

function pixelFilteredSunVisibility(pixel, sunRay) {
  const samplesPerAxis = ATMOSPHERE.solarDiscPixelFilterSamplesPerAxis;
  let coveredSampleCount = 0;
  let validSampleCount = 0;

  for (let yIndex = 0; yIndex < samplesPerAxis; yIndex += 1) {
    const yOffset = (yIndex + 0.5) / samplesPerAxis - 0.5;

    for (let xIndex = 0; xIndex < samplesPerAxis; xIndex += 1) {
      const xOffset = (xIndex + 0.5) / samplesPerAxis - 0.5;
      const subpixelSample = fisheyeSample(
        pixel.x + xOffset,
        pixel.y + yOffset
      );

      if (!subpixelSample) {
        continue;
      }

      validSampleCount += 1;

      if (
        Math.acos(clamp(dot(subpixelSample.direction, sunRay), -1, 1)) <=
        ATMOSPHERE.sunAngularRadiusRadians
      ) {
        coveredSampleCount += 1;
      }
    }
  }

  return validSampleCount > 0 ? coveredSampleCount / validSampleCount : 0;
}

function directSunVisibility(viewRay, sunRay, options) {
  if (usesPixelFilteredSolarDisc() && options.pixel) {
    return pixelFilteredSunVisibility(options.pixel, sunRay);
  }

  return finiteSunVisibility(viewRay, sunRay);
}

function secondOrderIncomingDirections(sunRay) {
  if (usesNishita96SecondOrderDirections()) {
    return nishita96PlaneIncomingDirections(sunRay);
  }
  if (usesFibonacciSphereSecondOrderDirections()) {
    return fibonacciSphereIncomingDirections(sunRay);
  }

  const up = [0, 0, 1];
  const sunHorizontal = normalize([sunRay[0], sunRay[1], 0]);
  const side = normalize(cross(up, sunHorizontal));
  const azimuthDirections = [
    sunHorizontal,
    side,
    scaleVector(sunHorizontal, -1),
    scaleVector(side, -1),
  ];
  const altitudeAngles = [degreesToRadians(18), degreesToRadians(58)];
  const directions = [];

  for (const altitude of altitudeAngles) {
    const horizontalScale = Math.cos(altitude);
    const verticalScale = Math.sin(altitude);

    for (const azimuthDirection of azimuthDirections) {
      directions.push(
        normalize(
          addVectors(
            scaleVector(azimuthDirection, horizontalScale),
            scaleVector(up, verticalScale)
          )
        )
      );
    }
  }

  return directions.slice(0, ATMOSPHERE.secondOrderDirectionCount);
}

function nishita96PlaneIncomingDirections(sunRay) {
  const up = [0, 0, 1];
  const sunHorizontalCandidate = [sunRay[0], sunRay[1], 0];
  const sunHorizontal =
    length(sunHorizontalCandidate) > 1e-6
      ? normalize(sunHorizontalCandidate)
      : [1, 0, 0];
  const sunAltitude = Math.asin(clamp(dot(sunRay, up), -1, 1));
  const angles = [
    Math.PI / 2,
    -Math.PI / 2,
    sunAltitude,
    sunAltitude + Math.PI,
    sunAltitude + Math.PI / 2,
    sunAltitude - Math.PI / 2,
    0,
    Math.PI,
  ];

  return angles.map((angle) =>
    normalize(
      addVectors(
        scaleVector(sunHorizontal, Math.cos(angle)),
        scaleVector(up, Math.sin(angle))
      )
    )
  );
}

function fibonacciSphereIncomingDirections(sunRay) {
  const count = ATMOSPHERE.fibonacciSphereSecondOrderDirectionCount;
  const halfCount = Math.floor(count / 2);
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const sunAxis = normalize(sunRay);
  const reference =
    Math.abs(dot(sunAxis, [0, 0, 1])) < 0.95 ? [0, 0, 1] : [0, 1, 0];
  const zAxis = normalize(
    addVectors(reference, scaleVector(sunAxis, -dot(reference, sunAxis)))
  );
  const yAxis = normalize(cross(zAxis, sunAxis));
  const directions = [];

  for (let index = -halfCount; index <= halfCount; index += 1) {
    const z = (2 * index) / count;
    const latitude = Math.asin(z);
    const longitude = (2 * Math.PI * index) / goldenRatio;
    const horizontalScale = Math.cos(latitude);
    const localX = horizontalScale * Math.cos(longitude);
    const localY = horizontalScale * Math.sin(longitude);
    const localZ = z;

    directions.push(
      normalize(
        addVectors(
          addVectors(scaleVector(sunAxis, localX), scaleVector(yAxis, localY)),
          scaleVector(zAxis, localZ)
        )
      )
    );
  }

  return directions;
}

function secondOrderAngularWeight(directionCount) {
  return (
    (usesNishita96SecondOrderDirections() ||
    usesFibonacciSphereSecondOrderDirections()
      ? 4 * Math.PI
      : 2 * Math.PI) / directionCount
  );
}

const incidentSkyCache = new Map();

function secondOrderIncidentSunMuBinIndex(position, sunRay) {
  const sunMu = clamp(dot(normalize(position), sunRay), -1, 1);
  const binCount = ATMOSPHERE.secondOrderIncidentSunMuBins;

  return clamp(
    Math.floor(((sunMu + 1) * 0.5) * binCount),
    0,
    binCount - 1
  );
}

function secondOrderIncidentSunMuForBin(binIndex) {
  const binCount = ATMOSPHERE.secondOrderIncidentSunMuBins;

  return -1 + ((binIndex + 0.5) * 2) / binCount;
}

function secondOrderIncidentMuBinIndex(position, direction) {
  const mu = clamp(dot(normalize(position), direction), -1, 1);
  const binCount = ATMOSPHERE.secondOrderIncidentMuBins;

  return clamp(
    Math.floor(((mu + 1) * 0.5) * binCount),
    0,
    binCount - 1
  );
}

function secondOrderIncidentMuForBin(binIndex) {
  const binCount = ATMOSPHERE.secondOrderIncidentMuBins;

  return -1 + ((binIndex + 0.5) * 2) / binCount;
}

function representativeNormalForSunMu(sunRay, sunMu) {
  const sunAxis = normalize(sunRay);
  const reference =
    Math.abs(sunAxis[2]) < 0.95 ? [0, 0, 1] : [0, 1, 0];
  const perpendicular = normalize(
    addVectors(reference, scaleVector(sunAxis, -dot(reference, sunAxis)))
  );
  const perpendicularScale = Math.sqrt(Math.max(0, 1 - sunMu * sunMu));

  return normalize(
    addVectors(
      scaleVector(sunAxis, sunMu),
      scaleVector(perpendicular, perpendicularScale)
    )
  );
}

function representativeDirectionForMuAndNu(normal, sunRay, originalDirection, mu) {
  const normalSunMu = clamp(dot(normal, sunRay), -1, 1);
  const nu = clamp(dot(originalDirection, sunRay), -1, 1);
  const sunProjection = addVectors(
    sunRay,
    scaleVector(normal, -normalSunMu)
  );
  const sunProjectionLength = length(sunProjection);
  const tangent =
    sunProjectionLength > 1e-6
      ? scaleVector(sunProjection, 1 / sunProjectionLength)
      : tangentBasis(normal, sunRay).tangent;
  const bitangent = normalize(cross(normal, tangent));
  const horizontalScale = Math.sqrt(Math.max(0, 1 - mu * mu));
  const tangentComponent =
    sunProjectionLength > 1e-6
      ? clamp(
          (nu - mu * normalSunMu) / sunProjectionLength,
          -horizontalScale,
          horizontalScale
        )
      : horizontalScale;
  const bitangentScale = Math.sqrt(
    Math.max(0, horizontalScale * horizontalScale - tangentComponent * tangentComponent)
  );
  const bitangentSign = dot(originalDirection, bitangent) < 0 ? -1 : 1;

  return normalize(
    addVectors(
      addVectors(scaleVector(normal, mu), scaleVector(tangent, tangentComponent)),
      scaleVector(bitangent, bitangentScale * bitangentSign)
    )
  );
}

function secondOrderIncidentCacheOrigin(binAltitude, sunRay, sunMuBinIndex) {
  const radius = ATMOSPHERE.bottomRadiusMeters + binAltitude;

  if (!usesSecondOrderSunAngleIncidentCache()) {
    return [0, 0, radius];
  }

  return scaleVector(
    representativeNormalForSunMu(
      sunRay,
      secondOrderIncidentSunMuForBin(sunMuBinIndex)
    ),
    radius
  );
}

function secondOrderIncidentCacheDirection(
  binOrigin,
  originalDirection,
  sunRay,
  muBinIndex
) {
  if (!usesSecondOrderSunViewAngleIncidentCache()) {
    return originalDirection;
  }

  return representativeDirectionForMuAndNu(
    normalize(binOrigin),
    sunRay,
    originalDirection,
    secondOrderIncidentMuForBin(muBinIndex)
  );
}

function incidentSkyRadianceForSecondOrder(scene, sunRay, direction, index, position) {
  const altitude = clamp(
    length(position) - ATMOSPHERE.bottomRadiusMeters,
    0,
    ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters
  );
  const binSize =
    (ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters) /
    ATMOSPHERE.secondOrderAltitudeBins;
  const binIndex = clamp(
    Math.floor(altitude / binSize),
    0,
    ATMOSPHERE.secondOrderAltitudeBins - 1
  );
  const sunMuBinIndex = usesSecondOrderSunAngleIncidentCache()
    ? secondOrderIncidentSunMuBinIndex(position, sunRay)
    : null;
  const muBinIndex = usesSecondOrderSunViewAngleIncidentCache()
    ? secondOrderIncidentMuBinIndex(position, direction)
    : null;
  const key =
    sunMuBinIndex === null
      ? `${scene.id}|${index}|${binIndex}`
      : muBinIndex === null
      ? `${scene.id}|${index}|${binIndex}|sunMu${sunMuBinIndex}`
      : `${scene.id}|${index}|${binIndex}|sunMu${sunMuBinIndex}|mu${muBinIndex}`;

  if (!incidentSkyCache.has(key)) {
    const binAltitude = (binIndex + 0.5) * binSize;
    const binOrigin = secondOrderIncidentCacheOrigin(
      binAltitude,
      sunRay,
      sunMuBinIndex
    );
    const incidentDirection = secondOrderIncidentCacheDirection(
      binOrigin,
      direction,
      sunRay,
      muBinIndex
    );

    if (
      rayIntersectsGround(
        length(binOrigin),
        dot(binOrigin, incidentDirection) / length(binOrigin)
      )
    ) {
      const blocked = activeSpectralChannels().map(() => 0);
      incidentSkyCache.set(key, blocked);
      return blocked;
    }

    const incident = computeSingleScatteringRadiance(
      binOrigin,
      incidentDirection,
      sunRay,
      {
        includeDirectSun: false,
        includeSecondOrder: false,
        includeGroundBounce: false,
        scene,
      }
    );

    incidentSkyCache.set(key, incident.skyRadiance);
  }

  return incidentSkyCache.get(key);
}

function computeSecondOrderScatteringAtSample({
  scene,
  position,
  viewRay,
  sunRay,
  density,
  viewTransmittance,
}) {
  const channels = activeSpectralChannels();
  const secondOrder = channels.map(() => 0);
  const incomingDirections = secondOrderIncomingDirections(sunRay);
  const angularWeight = secondOrderAngularWeight(incomingDirections.length);

  for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
    const incomingDirection = incomingDirections[directionIndex];
    const incidentRadiance = incidentSkyRadianceForSecondOrder(
      scene,
      sunRay,
      incomingDirection,
      directionIndex,
      position
    );
    const nu = dot(viewRay, incomingDirection);
    const rayleighPhase = rayleighPhaseFunction(nu);
    const miePhase = miePhaseFunction(
      activeAerosolParameters().miePhaseFunctionG,
      nu
    );

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
      const wavelengthMicrometers = wavelengthNanometersToMicrometers(
        channels[channelIndex].wavelengthNanometers
      );
      const scatteringCoefficient =
        density.rayleigh *
          rayleighScatteringCoefficientAt(wavelengthMicrometers) *
          rayleighPhase +
        density.mie *
          mieScatteringCoefficientAt(wavelengthMicrometers) *
          miePhase;

      secondOrder[channelIndex] +=
        viewTransmittance[channelIndex] *
        incidentRadiance[channelIndex] *
        scatteringCoefficient *
        angularWeight;
    }
  }

  return secondOrder;
}

function groundBounceDirections(sunRay) {
  const up = [0, 0, 1];
  const sunHorizontalCandidate = [sunRay[0], sunRay[1], 0];
  const sunHorizontal =
    length(sunHorizontalCandidate) > 1e-6
      ? normalize(sunHorizontalCandidate)
      : [1, 0, 0];
  const side = normalize(cross(up, sunHorizontal));
  const azimuthDirections = [
    sunHorizontal,
    side,
    scaleVector(sunHorizontal, -1),
    scaleVector(side, -1),
  ];
  const verticalComponents = [-0.25, -0.75];
  const directions = [];

  for (const verticalComponent of verticalComponents) {
    const horizontalScale = Math.sqrt(1 - verticalComponent * verticalComponent);

    for (const azimuthDirection of azimuthDirections) {
      directions.push(
        normalize(
          addVectors(
            scaleVector(azimuthDirection, horizontalScale),
            scaleVector(up, verticalComponent)
          )
        )
      );
    }
  }

  return directions.slice(0, ATMOSPHERE.groundBounceDirectionCount);
}

function tangentBasis(normal, referenceDirection) {
  const projected = addVectors(
    referenceDirection,
    scaleVector(normal, -dot(referenceDirection, normal))
  );
  const tangent =
    length(projected) > 1e-6
      ? normalize(projected)
      : normalize(cross(normal, Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const bitangent = normalize(cross(normal, tangent));

  return { tangent, bitangent };
}

function skyIrradianceDirections(normal, sunRay) {
  const { tangent, bitangent } = tangentBasis(normal, sunRay);
  const azimuthDirections = [
    tangent,
    bitangent,
    scaleVector(tangent, -1),
    scaleVector(bitangent, -1),
  ];
  const verticalComponents = [0.25, 0.75];
  const directions = [];

  for (const verticalComponent of verticalComponents) {
    const horizontalScale = Math.sqrt(1 - verticalComponent * verticalComponent);

    for (const azimuthDirection of azimuthDirections) {
      directions.push(
        normalize(
          addVectors(
            scaleVector(azimuthDirection, horizontalScale),
            scaleVector(normal, verticalComponent)
          )
        )
      );
    }
  }

  return directions.slice(0, ATMOSPHERE.groundSkyIrradianceDirectionCount);
}

const groundBounceCache = new Map();

function skyIrradianceAtGround(scene, sunRay, groundPoint, groundNormal) {
  const channels = activeSpectralChannels();
  const irradiance = channels.map(() => 0);
  const directions = skyIrradianceDirections(groundNormal, sunRay);
  const angularWeight = (2 * Math.PI) / directions.length;

  for (const direction of directions) {
    const skyRadiance = computeSingleScatteringRadiance(
      groundPoint,
      direction,
      sunRay,
      {
        includeDirectSun: false,
        includeSecondOrder: false,
        includeGroundBounce: false,
        scene,
      }
    ).skyRadiance;
    const cosine = Math.max(0, dot(groundNormal, direction));

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
      irradiance[channelIndex] +=
        skyRadiance[channelIndex] * cosine * angularWeight;
    }
  }

  return irradiance;
}

function groundBounceRadianceForSample(
  scene,
  sunRay,
  groundDirection,
  index,
  position
) {
  const channels = activeSpectralChannels();
  const altitude = clamp(
    length(position) - ATMOSPHERE.bottomRadiusMeters,
    0,
    ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters
  );
  const binSize =
    (ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters) /
    ATMOSPHERE.groundBounceAltitudeBins;
  const binIndex = clamp(
    Math.floor(altitude / binSize),
    0,
    ATMOSPHERE.groundBounceAltitudeBins - 1
  );
  const key = `${scene.id}|${index}|${binIndex}`;

  if (!groundBounceCache.has(key)) {
    const empty = channels.map(() => 0);
    const binAltitude = (binIndex + 0.5) * binSize;
    const binOrigin = [
      0,
      0,
      ATMOSPHERE.bottomRadiusMeters + binAltitude,
    ];
    const distanceToGround = distanceToGroundBoundary(
      binOrigin,
      groundDirection
    );

    if (distanceToGround === null) {
      groundBounceCache.set(key, empty);
      return empty;
    }

    const groundPoint = addScaled(
      binOrigin,
      groundDirection,
      distanceToGround
    );
    const groundNormal = normalize(groundPoint);
    const sunCosine = Math.max(0, dot(groundNormal, sunRay));

    if (sunCosine <= 0 && !usesShadowedGroundSkyIrradiance()) {
      groundBounceCache.set(key, empty);
      return empty;
    }

    const groundToSunTransmittance =
      sunCosine > 0
        ? computeTransmittanceToSunSpectrum(groundPoint, sunRay)
        : channels.map(() => 0);
    const groundToSampleTransmittance = computeTransmittanceSpectrum(
      computeOpticalLengthsAlongDistance(
        groundPoint,
        scaleVector(groundDirection, -1),
        distanceToGround,
        ATMOSPHERE.groundBounceTransmittanceSampleCount
      )
    );
    const skyIrradiance = usesGroundSkyIrradianceCoupling()
      ? skyIrradianceAtGround(scene, sunRay, groundPoint, groundNormal)
      : channels.map(() => 0);
    const radiance = channels.map(
      (channel, channelIndex) =>
        ((ATMOSPHERE.groundAlbedo / Math.PI) *
          (channel.solarIrradiance *
            sunCosine *
            groundToSunTransmittance[channelIndex] +
            skyIrradiance[channelIndex]) *
          groundToSampleTransmittance[channelIndex])
    );

    groundBounceCache.set(key, radiance);
  }

  return groundBounceCache.get(key);
}

function computeGroundBounceScatteringAtSample({
  scene,
  position,
  viewRay,
  sunRay,
  density,
  viewTransmittance,
}) {
  const channels = activeSpectralChannels();
  const groundBounce = channels.map(() => 0);
  const incomingDirections = groundBounceDirections(sunRay);
  const angularWeight = (2 * Math.PI) / incomingDirections.length;

  for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
    const incomingDirection = incomingDirections[directionIndex];
    const incidentRadiance = groundBounceRadianceForSample(
      scene,
      sunRay,
      incomingDirection,
      directionIndex,
      position
    );
    const nu = dot(viewRay, incomingDirection);
    const rayleighPhase = rayleighPhaseFunction(nu);
    const miePhase = miePhaseFunction(
      activeAerosolParameters().miePhaseFunctionG,
      nu
    );

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
      const wavelengthMicrometers = wavelengthNanometersToMicrometers(
        channels[channelIndex].wavelengthNanometers
      );
      const scatteringCoefficient =
        density.rayleigh *
          rayleighScatteringCoefficientAt(wavelengthMicrometers) *
          rayleighPhase +
        density.mie *
          mieScatteringCoefficientAt(wavelengthMicrometers) *
          miePhase;

      groundBounce[channelIndex] +=
        viewTransmittance[channelIndex] *
        incidentRadiance[channelIndex] *
        scatteringCoefficient *
        angularWeight;
    }
  }

  return groundBounce;
}

function computeSingleScatteringRadiance(origin, viewRay, sunRay, options = {}) {
  const includeDirectSun =
    options.includeDirectSun !== false &&
    !omitsDirectSolarDiscForPaperSkyRadiance();
  const includeSecondOrder =
    options.includeSecondOrder !== false && usesSecondOrderScattering();
  const includeGroundBounce =
    options.includeGroundBounce !== false && usesGroundBounceCoupling();
  const scene = options.scene || null;
  const radius = length(origin);
  const mu = dot(origin, viewRay) / radius;
  const nu = dot(viewRay, sunRay);
  const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
  const sampleCount = ATMOSPHERE.singleScatteringSampleCount;
  const step = distanceToTop / sampleCount;
  const channels = activeSpectralChannels();
  const samples = [];
  const cumulativeRayleigh = [0];
  const cumulativeMie = [0];
  const cumulativeAbsorption = [0];
  const rayleighSum = channels.map(() => 0);
  const mieSum = channels.map(() => 0);
  const secondOrderSum = channels.map(() => 0);
  const groundBounceSum = channels.map(() => 0);

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const sampleDistance = sampleIndex * step;
    const position = addScaled(origin, viewRay, sampleDistance);
    const density = densityAtPosition(position);

    samples.push({ position, density });

    if (sampleIndex > 0) {
      const previousDensity = samples[sampleIndex - 1].density;
      cumulativeRayleigh[sampleIndex] =
        cumulativeRayleigh[sampleIndex - 1] +
        0.5 * (previousDensity.rayleigh + density.rayleigh) * step;
      cumulativeMie[sampleIndex] =
        cumulativeMie[sampleIndex - 1] +
        0.5 * (previousDensity.mie + density.mie) * step;
      cumulativeAbsorption[sampleIndex] =
        cumulativeAbsorption[sampleIndex - 1] +
        0.5 * (previousDensity.absorption + density.absorption) * step;
    }
  }

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const sample = samples[sampleIndex];
    const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;
    const viewTransmittance = computeTransmittanceSpectrum({
      rayleighOpticalLength: cumulativeRayleigh[sampleIndex],
      mieOpticalLength: cumulativeMie[sampleIndex],
      absorptionOpticalLength: cumulativeAbsorption[sampleIndex],
    });
    const sunTransmittance = computeTransmittanceToSunSpectrum(
      sample.position,
      sunRay
    );

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
      const transmittance =
        viewTransmittance[channelIndex] * sunTransmittance[channelIndex];

      rayleighSum[channelIndex] +=
        transmittance * sample.density.rayleigh * weight;
      mieSum[channelIndex] += transmittance * sample.density.mie * weight;
    }

    if (includeSecondOrder && scene) {
      const secondOrder = computeSecondOrderScatteringAtSample({
        scene,
        position: sample.position,
        viewRay,
        sunRay,
        density: sample.density,
        viewTransmittance,
      });

      for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
        secondOrderSum[channelIndex] += secondOrder[channelIndex] * weight;
      }
    }

    if (includeGroundBounce && scene) {
      const groundBounce = computeGroundBounceScatteringAtSample({
        scene,
        position: sample.position,
        viewRay,
        sunRay,
        density: sample.density,
        viewTransmittance,
      });

      for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
        groundBounceSum[channelIndex] += groundBounce[channelIndex] * weight;
      }
    }
  }

  const rayleighPhase = rayleighPhaseFunction(nu);
  const miePhase = miePhaseFunction(
    activeAerosolParameters().miePhaseFunctionG,
    nu
  );
  const skyRadiance = channels.map((channel, channelIndex) => {
    const wavelengthMicrometers = wavelengthNanometersToMicrometers(
      channel.wavelengthNanometers
    );
    const rayleigh =
      rayleighSum[channelIndex] *
      step *
      channel.solarIrradiance *
      rayleighScatteringCoefficientAt(wavelengthMicrometers) *
      rayleighPhase;
    const mie =
      mieSum[channelIndex] *
      step *
      channel.solarIrradiance *
      mieScatteringCoefficientAt(wavelengthMicrometers) *
      miePhase;

    return rayleigh + mie;
  });
  if (usesMultipleScatteringProxy()) {
    for (let channelIndex = 0; channelIndex < skyRadiance.length; channelIndex += 1) {
      skyRadiance[channelIndex] *= ATMOSPHERE.multipleScatteringProxyScale;
    }
  }
  if (includeSecondOrder) {
    for (let channelIndex = 0; channelIndex < skyRadiance.length; channelIndex += 1) {
      skyRadiance[channelIndex] += secondOrderSum[channelIndex] * step;
    }
  }
  if (includeGroundBounce) {
    for (let channelIndex = 0; channelIndex < skyRadiance.length; channelIndex += 1) {
      skyRadiance[channelIndex] += groundBounceSum[channelIndex] * step;
    }
  }
  const sunRadiance = channels.map(() => 0);
  const sunVisibility = directSunVisibility(viewRay, sunRay, options);

  if (includeDirectSun && sunVisibility > 0) {
    const directSunTransmittance = computeTransmittanceToSunSpectrum(
      origin,
      sunRay
    );
    const directSunRadiance = solarRadianceSpectrum();

    for (let channelIndex = 0; channelIndex < skyRadiance.length; channelIndex += 1) {
      sunRadiance[channelIndex] =
        directSunRadiance[channelIndex] *
        directSunTransmittance[channelIndex] *
        sunVisibility;
    }
  }
  const radiance = skyRadiance.map(
    (value, channelIndex) => value + sunRadiance[channelIndex]
  );

  return {
    radiance,
    skyRadiance,
    sunRadiance,
    secondOrderRadiance: secondOrderSum.map((value) => value * step),
    groundBounceRadiance: groundBounceSum.map((value) => value * step),
    distanceToTop,
  };
}

function demoDisplayEncode(linearValue, channelIndex) {
  const exposure = displayExposureScalar();

  if (usesPaperFigure1ToneMap()) {
    return clamp(
      1 - Math.exp(-Math.max(0, linearValue) * paperFigure1ToneMapK()),
      0,
      1
    );
  }

  const whitePoint = displayWhitePoint()[channelIndex] || 1;
  const exposed =
    1 -
    Math.exp(
      -(Math.max(0, linearValue) / whitePoint) * exposure
    );

  return Math.max(0, Math.min(1, exposed)) ** (1 / 2.2);
}

function scatteringToDisplayLinear(scattering) {
  if (usesFullSpectralConversion()) {
    let x = 0;
    let y = 0;
    let z = 0;
    const channels = activeSpectralChannels();

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
      const channel = channels[channelIndex];
      const radiance = scattering.radiance[channelIndex];
      const delta = channel.wavelengthBinWidthNanometers || 1;

      x += cieColorMatchingValue(channel.wavelengthNanometers, 1) * radiance * delta;
      y += cieColorMatchingValue(channel.wavelengthNanometers, 2) * radiance * delta;
      z += cieColorMatchingValue(channel.wavelengthNanometers, 3) * radiance * delta;
    }

    return [
      MAX_LUMINOUS_EFFICACY *
        (XYZ_TO_SRGB[0] * x + XYZ_TO_SRGB[1] * y + XYZ_TO_SRGB[2] * z),
      MAX_LUMINOUS_EFFICACY *
        (XYZ_TO_SRGB[3] * x + XYZ_TO_SRGB[4] * y + XYZ_TO_SRGB[5] * z),
      MAX_LUMINOUS_EFFICACY *
        (XYZ_TO_SRGB[6] * x + XYZ_TO_SRGB[7] * y + XYZ_TO_SRGB[8] * z),
    ];
  }

  if (!usesLuminanceConversion()) {
    return scattering.radiance;
  }

  const factors = radianceToLuminanceFactors();

  return scattering.skyRadiance.map(
    (value, channelIndex) =>
      value * factors.sky[channelIndex] +
      scattering.sunRadiance[channelIndex] * factors.sun[channelIndex]
  );
}

function radianceToDisplayRgb(scattering) {
  return scatteringToDisplayLinear(scattering).map((channel, channelIndex) =>
    demoDisplayEncode(channel, channelIndex)
  );
}

function makeEmptyRadianceStats() {
  const channels = activeSpectralChannels();

  return {
    maxDistanceToTopMeters: 0,
    maxRadiance: channels.map(() => 0),
    maxDisplayRgb: [0, 0, 0],
    zenithRadiance: null,
    horizonAzimuth0Radiance: null,
    directSunTransmittance: null,
  };
}

function updateRadianceStats(stats, distanceToTop, radiance, displayRgb) {
  stats.maxDistanceToTopMeters = Math.max(
    stats.maxDistanceToTopMeters,
    distanceToTop
  );

  for (let channelIndex = 0; channelIndex < radiance.length; channelIndex += 1) {
    stats.maxRadiance[channelIndex] = Math.max(
      stats.maxRadiance[channelIndex],
      radiance[channelIndex]
    );
  }

  for (let channelIndex = 0; channelIndex < 3; channelIndex += 1) {
    stats.maxDisplayRgb[channelIndex] = Math.max(
      stats.maxDisplayRgb[channelIndex],
      displayRgb[channelIndex]
    );
  }
}

function renderSingleScatteringSky(scene) {
  const pixels = Buffer.alloc(IMAGE_SIZE * IMAGE_SIZE * 4);
  const origin = observerPosition();
  const sunRay = sunDirection(scene);
  const stats = makeEmptyRadianceStats();

  for (let y = 0; y < IMAGE_SIZE; y += 1) {
    for (let x = 0; x < IMAGE_SIZE; x += 1) {
      const offset = (y * IMAGE_SIZE + x) * 4;
      const sample = fisheyeSample(x, y);

      if (!sample) {
        putPixel(pixels, offset, [0, 0, 0, 0]);
        continue;
      }

      const scattering = computeSingleScatteringRadiance(
        origin,
        sample.direction,
        sunRay,
        {
          scene,
          pixel: { x, y },
        }
      );
      const displayRgb = radianceToDisplayRgb(scattering);

      updateRadianceStats(
        stats,
        scattering.distanceToTop,
        scattering.radiance,
        displayRgb
      );
      putPixel(pixels, offset, [
        displayRgb[0] * 255,
        displayRgb[1] * 255,
        displayRgb[2] * 255,
        255,
      ]);
    }
  }

  stats.zenithRadiance = computeSingleScatteringRadiance(
    origin,
    [0, 0, 1],
    sunRay,
    { scene }
  ).radiance;
  stats.horizonAzimuth0Radiance = computeSingleScatteringRadiance(
    origin,
    [1, 0, 0],
    sunRay,
    { scene }
  ).radiance;
  stats.directSunTransmittance = computeTransmittanceToSunSpectrum(
    origin,
    sunRay
  );

  return {
    pixels,
    diagnostics: stats,
  };
}

function renderScene(scene) {
  if (STEP.id === "scaffold-diagnostic") {
    return {
      pixels: renderDiagnosticSky(scene),
      diagnostics: {
        note: "Projection scaffold only; no atmosphere diagnostics.",
      },
    };
  }

  if (isSingleScatteringStep()) {
    return renderSingleScatteringSky(scene);
  }

  return renderTransmittanceDiagnosticSky(scene);
}

function makeCrcTable() {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffers) {
  let crc = 0xffffffff;

  for (const buffer of buffers) {
    for (const byte of buffer) {
      crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32([typeBuffer, data]), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(filePath, width, height, pixels) {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const header = Buffer.alloc(13);
  const rows = [];

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = Buffer.from([0]);
    const rowStart = y * width * 4;
    const rowEnd = rowStart + width * 4;
    rows.push(filter, pixels.subarray(rowStart, rowEnd));
  }

  const imageData = zlib.deflateSync(Buffer.concat(rows), { level: 9 });
  const png = Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", imageData),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, png);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, value);
}

function makeEquationsRecord() {
  if (isSingleScatteringStep()) {
    return {
      status:
        usesSecondOrderSunViewAngleIncidentCache()
          ? "second-order-sun-view-angle-cache-baseline"
          : usesSecondOrderSunAngleIncidentCache()
          ? "second-order-sun-angle-cache-baseline"
          : usesShadowedGroundSkyIrradiance()
          ? "shadowed-ground-sky-irradiance-baseline"
          : usesPaperFortyWavelengthRefitToneMap()
          ? "paper-40-wavelength-refit-tone-map-baseline"
          : usesPaperFortyWavelengthSampling()
          ? "paper-40-wavelength-baseline"
          : usesFigure1SunZenithAngles()
          ? "figure1-sun-zenith-baseline"
          : usesSourcePaperFigure1ToneMapK()
          ? "figure1-four-view-source-k-no-ground-baseline"
          : usesFigure1FourSkydomeViews()
          ? "figure1-four-view-derived-k-no-ground-baseline"
          : usesDerivedPaperFigure1DirectGroundOnly()
          ? "paper-figure1-derived-k-direct-ground-baseline"
          : usesDerivedPaperFigure1NoGround()
          ? "paper-figure1-derived-k-no-ground-baseline"
          : usesFittedPaperFigure1ToneMap()
          ? "paper-figure1-fitted-tone-map-baseline"
          : usesPaperFigure1ToneMap()
          ? "paper-figure1-tone-map-baseline"
          : usesFibonacciSphereSecondOrderDirections()
          ? "fibonacci-sphere-second-order-baseline"
          : omitsDirectSolarDiscForPaperSkyRadiance()
          ? "paper-sky-radiance-no-direct-sun-baseline"
          : usesPixelFilteredSolarDisc()
          ? "pixel-filtered-solar-disc-baseline"
          : usesNishita96SecondOrderDirections()
          ? "nishita96-plane-second-order-baseline"
          : STEP.id === "paper-aerosol-transport-baseline"
          ? "paper-aerosol-transport-baseline"
          : usesDemoWhiteBalance()
          ? "demo-white-balance-display-baseline"
          : usesPaperComparisonNoOzonePolicy()
          ? "paper-comparison-no-ozone-baseline"
          : usesGroundSkyIrradianceCoupling()
          ? "ground-sky-irradiance-coupling-baseline"
          : usesGroundBounceCoupling()
          ? "ground-bounce-coupling-baseline"
          : usesSecondOrderScattering()
          ? "directional-second-order-scattering-baseline"
          : usesLuminanceConversion()
          ? "single-scattering-luminance-baseline"
          : "single-scattering-radiance-baseline",
      externalSources: EXTERNAL_SOURCES,
      equations: [
        {
          name: "equidistant fisheye ray angle",
          expression: "theta = rho * pi / 2",
          purpose:
            "Maps the circular 180 degree fisheye from zenith at center to horizon at the edge.",
          source: "fisheye-equidistant-projection",
        },
        ...(usesFigure1SunZenithAngles()
          ? [
              {
                name: "Figure 1 sun zenith scene angles",
                expression:
                  "sun_altitude = 90 degrees - sun_zenith; low Sun: 90 - 87 = 3 degrees; high Sun: 90 - 21 = 69 degrees",
                purpose:
                  "Aligns the rendered comparison scenes to the external Bruneton 2016 Figure 1 row labels instead of the earlier approximate 5 and 65 degree altitudes.",
                source: "bruneton-2016-figure1-sun-zenith-angles",
              },
            ]
          : []),
        ...(usesFigure1FourSkydomeViews()
          ? [
              {
                name: "Figure 1 four skydome scene set",
                expression:
                  "rows = {06h00 / theta_s=87 deg, 10h15 / theta_s=41 deg, 11h15 / theta_s=31 deg, 13h15 / theta_s=21 deg}; sun_altitude = 90 deg - theta_s; sun_azimuth = {-25.8345 deg, 9.5445 deg, 22.1663 deg, 85.3141 deg}",
                purpose:
                  "Renders the same four Figure 1 time-of-day / Sun-position skydome views with the step 029 model. Azimuths are measured from the red-cross centers in the directly extracted Bruneton-column Figure 1 tiles.",
                source: "bruneton-2016-figure1-four-view-layout",
              },
            ]
          : []),
        {
          name: "distance to top atmosphere boundary",
          expression:
            "d_top = -r * mu + sqrt(r^2 * (mu^2 - 1) + r_top^2)",
          purpose:
            "Finds the integration length from the observer to the top atmosphere boundary.",
          source: "bruneton-functions-glsl",
        },
        {
          name: "Beer-Lambert transmittance",
          expression: "T = exp(-(beta_R * L_R + beta_M * L_M + beta_O3 * L_O3))",
          purpose:
            "Computes transmittance from observer to sample and sample to Sun.",
          source: "bruneton-functions-glsl",
        },
        ...(includesOzoneAbsorption()
          ? [
              {
                name: "ozone absorption density",
                expression:
                  "density_O3(h) = clamp(h / 15000 - 2/3, 0, 1) below 25 km; clamp(-h / 15000 + 8/3, 0, 1) above 25 km",
                purpose:
                  "Adds the piecewise linear ozone layer used by Bruneton's default demo atmosphere.",
                source: "bruneton-ozone-absorption",
              },
            ]
          : []),
        ...(usesPaperComparisonNoOzonePolicy()
          ? [
              {
                name: "paper comparison no-ozone policy",
                expression: "beta_O3(lambda) = 0",
                purpose:
                  "Matches the Bruneton 2016 comparison implementation policy that neglects ozone absorption.",
                source: "bruneton-2016-no-ozone-comparison-policy",
              },
            ]
          : []),
        {
          name: "single-scattering integrand",
          expression:
            "dL = T_view * T_sun * density(h) * beta(lambda) * solarIrradiance(lambda) * phase(nu) * ds",
          purpose:
            "Accumulates Rayleigh and Mie single-scattered radiance along the view ray.",
          source: "bruneton-single-scattering",
        },
        ...(usesMultipleScatteringProxy()
          ? [
              {
                name: "first multiple-scattering irradiance proxy",
                expression: "L_sky_proxy = 1.5 * L_single_scattered_sky",
                purpose:
                  "Approximates the missing irradiance that Bruneton 2016 attributes to ignored multiple scattering; direct Sun radiance is not scaled.",
                source: "bruneton-2016-multiple-scattering-gap",
              },
            ]
          : []),
        ...(usesSecondOrderScattering()
          ? [
              {
                name: "directional second-order scattering",
                expression:
                  "dL_2 = T_view * density(h) * integral(L_1(omega_i) * beta(lambda) * phase(dot(view, omega_i)) d omega_i) * ds",
                purpose:
                  "Replaces the scalar proxy with an explicit second-scattering integral over a finite set of incoming sky directions.",
                source: "bruneton-2016-nishita96-double-scattering",
              },
              ...(usesNishita96SecondOrderDirections()
                ? [
                    {
                      name: "Nishita96 second-order sampling directions",
                      expression:
                        "omega_i in {zenith, nadir, sun, anti-sun, directions orthogonal to sun in the vertical-sun plane, horizon sunward, horizon anti-sunward}",
                      purpose:
                        "Replaces the earlier arbitrary two-ring upper-hemisphere directions with the paper-described Nishita96 plane sampling set.",
                      source: "bruneton-2016-nishita96-double-scattering",
                    },
                  ]
                : []),
              ...(usesFibonacciSphereSecondOrderDirections()
                ? [
                    {
                      name: "Fibonacci full-sphere second-order quadrature",
                      expression:
                        "omega_i from a spherical Fibonacci lattice; integral_S2 f(omega) d omega ~= (4*pi/N) * sum_i f(omega_i)",
                      purpose:
                        "Replaces the earlier upper-hemisphere/two-ring second-order directions with a deterministic full-sphere quadrature, addressing the paper's diagnosis that an 8-direction single-plane approximation misses many incoming directions.",
                      source:
                        "bruneton-2016-nishita96-double-scattering; gonzalez-2009-fibonacci-sphere-lattice",
                    },
                  ]
                : []),
              ...(usesSecondOrderSunAngleIncidentCache()
                ? [
                    {
                      name: usesSecondOrderSunViewAngleIncidentCache()
                        ? "local Sun/view-angle second-order incident cache"
                        : "local Sun-angle second-order incident cache",
                      expression: usesSecondOrderSunViewAngleIncidentCache()
                        ? "L_incident cache key ~= (scene, omega_i, altitude_bin, mu_s_bin, mu_bin), where mu_s = dot(normal(position), sun) and mu = dot(normal(position), omega_i)"
                        : "L_incident cache key ~= (scene, omega_i, altitude_bin, mu_s_bin), where mu_s = dot(normal(position), sun)",
                      purpose:
                        usesSecondOrderSunViewAngleIncidentCache()
                          ? "Adds local incoming-view zenith dependence to the second-order incident-radiance cache, moving closer to Bruneton's r, mu, mu_s, nu scattering texture coordinates."
                          : "Stops collapsing all same-altitude second-order incident radiance samples to one local solar zenith, moving the cache toward Bruneton's r, mu, mu_s, nu scattering texture coordinates.",
                      source: "bruneton-scattering-texture-coordinates",
                    },
                  ]
                : []),
              ...(omitsDirectSolarDiscForPaperSkyRadiance()
                ? [
                    {
                      name: "paper sky-radiance direct-Sun omission",
                      expression:
                        "L_display(lambda) = L_sky_scattered(lambda); L_sun_direct(lambda) is not added to the camera pass",
                      purpose:
                        "Tests the Figure 1 target contract where the visible comparison target is sky radiance/aureole and the Sun direction is indicated by an overlay marker.",
                      source: "bruneton-2016-figure1-sky-radiance-target",
                    },
                  ]
                : [
                    {
                      name: usesPixelFilteredSolarDisc()
                        ? "pixel-filtered finite Sun disc"
                        : "finite Sun disc rasterization",
                      expression: usesPixelFilteredSolarDisc()
                        ? "sun_visibility = covered_subpixel_count / valid_subpixel_count, where covered samples satisfy acos(dot(view_subpixel, sun)) <= alpha_s"
                        : "sun_visibility = 1 - smoothstep(alpha_s - 0.5 alpha_px, alpha_s + 2 alpha_px, acos(dot(view, sun)))",
                      purpose: usesPixelFilteredSolarDisc()
                        ? "Averages direct solar radiance over the finite fisheye pixel footprint to avoid treating a sub-pixel Sun as a full-pixel center-ray hit."
                        : "Renders the direct solar disc with the documented solar angular radius and the fisheye pixel angular footprint instead of a hard sub-pixel threshold.",
                      source: "bruneton-demo-sun-angular-size",
                    },
                    ...(usesPixelFilteredSolarDisc()
                      ? [
                          {
                            name: "camera pixel radiance averaging",
                            expression:
                              "L_pixel ~= (1 / N) * sum_i L(view_subpixel_i)",
                            purpose:
                              "Approximates the camera measurement over a finite pixel area for the high-radiance direct solar disc.",
                            source: "pbrt-camera-measurement-equation",
                          },
                        ]
                      : []),
                  ]),
            ]
          : []),
        ...(usesGroundBounceCoupling()
          ? [
              {
                name: usesGroundSkyIrradianceCoupling()
                  ? "Lambertian sun-plus-sky ground bounce"
                  : "Lambertian direct-Sun ground bounce",
                expression: usesGroundSkyIrradianceCoupling()
                  ? "L_ground(lambda) = rho_ground / pi * (E_sun(lambda) * max(0, dot(n_ground, sun)) * T_ground_to_sun(lambda) + E_sky(lambda)) * T_ground_to_sample(lambda); dL_ground = T_view * density(h) * beta(lambda) * phase(dot(view, omega_ground)) * L_ground(lambda) * d_omega * ds"
                  : "L_ground(lambda) = rho_ground / pi * E_sun(lambda) * max(0, dot(n_ground, sun)) * T_ground_to_sun(lambda) * T_ground_to_sample(lambda); dL_ground = T_view * density(h) * beta(lambda) * phase(dot(view, omega_ground)) * L_ground(lambda) * d_omega * ds",
                purpose:
                  usesGroundSkyIrradianceCoupling()
                    ? "Adds lower-boundary light transport from directly sunlit and sky-lit ground to atmospheric samples, then scatters that reflected radiance toward the camera."
                    : "Adds lower-boundary light transport from directly sunlit ground to atmospheric samples, then scatters that reflected radiance toward the camera.",
                source: "bruneton-ground-reflection",
              },
              ...(usesShadowedGroundSkyIrradiance()
                ? [
                    {
                      name: "shadowed-ground sky irradiance",
                      expression:
                        "L_ground(lambda) includes E_sky(lambda) even when direct Sun visibility is zero; the direct Sun term remains max(0, dot(n_ground, sun)) * T_ground_to_sun(lambda)",
                      purpose:
                        "Matches Bruneton's shader structure where direct Sun visibility and sky visibility are separate factors in the reflected ground radiance term.",
                      source: "bruneton-ground-reflection",
                    },
                  ]
                : []),
              {
                name: "lower-hemisphere ground-bounce quadrature",
                expression:
                  "integral_lower_hemisphere f(omega) d_omega ~= sum_i f(omega_i) * (2*pi / N)",
                purpose:
                  "Approximates the incoming lower-hemisphere integral with eight sampled ground directions.",
                source: "bruneton-ground-reflection",
              },
            ]
          : []),
        ...(usesGroundSkyIrradianceCoupling()
          ? [
              {
                name: "ground sky irradiance quadrature",
                expression:
                  "E_sky(lambda) ~= sum_i L_sky(lambda, omega_i) * max(0, dot(n_ground, omega_i)) * (2*pi / N)",
                purpose:
                  "Approximates Bruneton's sky irradiance term at the ground using first-scattered sky radiance over eight upper-hemisphere directions.",
                source: "bruneton-ground-reflection",
              },
            ]
          : []),
        {
          name: "Rayleigh phase function",
          expression: "P_R(nu) = 3 / (16*pi) * (1 + nu^2)",
          purpose: "Angular distribution for molecular scattering.",
          source: "bruneton-single-scattering",
        },
        {
          name: "Cornette-Shanks Mie phase function",
          expression:
            "P_M(g,nu) = 3/(8*pi) * (1-g^2)/(2+g^2) * (1+nu^2)/(1+g^2-2g*nu)^1.5",
          purpose: "Angular distribution for aerosol scattering.",
          source: "bruneton-single-scattering",
        },
        {
          name: "Bruneton RGB radiance wavelengths",
          expression: "lambda_R = 680 nm, lambda_G = 550 nm, lambda_B = 440 nm",
          purpose:
            "Stores radiance in Bruneton's 3-wavelength RGB radiance API order.",
          source: "bruneton-model-wavelengths",
        },
        {
          name: "Bruneton luminance spectral samples",
          expression: usesPaperFortyWavelengthSampling()
            ? "lambda_i = 360 + (i + 0.5) * ((830 - 360) / 40), i in [0, 39]"
            : "lambda_i = 360 + (i + 0.5) * ((830 - 360) / 15), i in [0, 14]",
          purpose: usesPaperFortyWavelengthSampling()
            ? "Matches the Bruneton 2016 comparison setup's 40 spectral wavelengths between 360 nm and 830 nm, evaluated directly for each skydome pixel."
            : "Uses the same centered wavelength-bin strategy Bruneton applies in precomputed illuminance mode, here evaluated directly for each skydome pixel.",
          source: usesPaperFortyWavelengthSampling()
            ? "bruneton-2016-40-wavelength-evaluation"
            : "bruneton-radiance-to-luminance",
        },
        {
          name: omitsDirectSolarDiscForPaperSkyRadiance()
            ? "direct solar radiance separated from sky pass"
            : "solar radiance",
          expression: "L_sun(lambda) = E_sun(lambda) / (pi * alpha_s^2)",
          purpose:
            omitsDirectSolarDiscForPaperSkyRadiance()
              ? "Defines the direct solar beam term that this sky-radiance target-contract step keeps separate from displayed atmospheric sky radiance."
              : "Adds the direct Sun contribution when the view ray intersects the solar disc.",
          source: "bruneton-rendering-sky",
        },
        {
          name: usesPaperFigure1ToneMap()
            ? "Bruneton 2016 Figure 1 display transform"
            : "Bruneton demo display transform",
          expression: usesPaperFigure1ToneMap()
            ? "display = 1 - exp(-k * max(0, linear_sRGB))"
            : "display = (1 - exp(-radiance / white_point * exposure))^(1/2.2)",
          purpose:
            usesPaperFigure1ToneMap()
              ? usesSourcePaperFigure1ToneMapK()
                ? "Audits the Figure 1 paper display contract after CIE integration and XYZ-to-linear-sRGB conversion, using the comparison source implementation k = 1 / (5 * 683)."
                : usesDerivedPaperFigure1ToneMapK()
                ? "Audits the Figure 1 paper display contract after CIE integration and XYZ-to-linear-sRGB conversion, using the fitted step 021 global k product directly instead of preserving exposure and fitted-scale as separate knobs."
                : usesFittedPaperFigure1ToneMap()
                ? "Audits the Figure 1 paper display contract after CIE integration and XYZ-to-linear-sRGB conversion, using a single global k multiplier fit against direct external Figure 1 target tiles because the caption gives the form but not a numeric k."
                : "Audits the Figure 1 paper display contract after CIE integration and XYZ-to-linear-sRGB conversion, holding k equal to the previous external demo exposure scalar because the caption gives the form but not a numeric k."
              : "Maps radiance-channel values into PNG bytes for visual inspection.",
          source: usesPaperFigure1ToneMap()
            ? usesSourcePaperFigure1ToneMapK()
              ? "bruneton-2016-figure1-display-transform; bruneton-2016-comparison-source-tone-map"
              : usesFittedPaperFigure1ToneMap()
              ? "bruneton-2016-figure1-display-transform; bruneton-2016-figure1-extracted-target-tiles; bruneton-demo-display"
              : "bruneton-2016-figure1-display-transform; bruneton-demo-display"
            : "bruneton-demo-display",
        },
        ...(usesSourcePaperFigure1ToneMapK()
          ? [
              {
                name: "Bruneton comparison source Figure 1 tone-map k",
                expression:
                  "k = 1 / (5 * MaxLuminousEfficacy) = 1 / (5 * 683) = 0.00029282576866764275",
                purpose:
                  "Uses the same reciprocal display scale as Bruneton's clear-sky comparison source ToneMapping function.",
                source: "bruneton-2016-comparison-source-tone-map",
              },
            ]
          : []),
        ...(usesDerivedPaperFigure1ToneMapK()
          ? [
              {
                name: "derived Figure 1 tone-map k",
                expression: "k = 0.0002454 = 0.0001 * 2.454",
                purpose:
                  "Uses the fitted step 021 tone-map product directly, turning off the separate exposure-times-fit decomposition as a visually inactive bookkeeping knob.",
                source:
                  "bruneton-2016-figure1-display-transform; bruneton-2016-figure1-extracted-target-tiles; bruneton-demo-display",
              },
            ]
          : []),
        ...(usesDemoWhiteBalance()
          ? [
              {
                name: "Bruneton demo white balance",
                expression:
                  "white_point = linear_sRGB(solar_spectrum) / average(linear_sRGB(solar_spectrum))",
                purpose:
                  "Applies Bruneton's optional solar-spectrum white balance as an explicit display hypothesis.",
                source: "bruneton-demo-white-balance",
              },
            ]
          : []),
        {
          name: "Bruneton radiance-to-luminance factors",
          expression:
            "k_c = 683 * integral((XYZ_TO_SRGB_c dot CIE(lambda)) * E_sun(lambda) / E_sun(lambda_c) * (lambda / lambda_c)^p d lambda)",
          purpose:
            "Approximates CIE/XYZ/sRGB luminance conversion from three spectral radiance samples.",
          source: "bruneton-radiance-to-luminance",
        },
      ],
      constants: {
        imageSizePixels: IMAGE_SIZE,
        skyRadiusPixels: SKY_RADIUS,
        atmosphere: ATMOSPHERE,
        bruneton2016Aerosol: BRUNETON_2016_AEROSOL,
        activeAerosol: activeAerosolParameters(),
        spectralChannels: activeSpectralChannels(),
        derived: {
          coefficients: activeSpectralChannels().map((channel) => {
            const wavelengthMicrometers = wavelengthNanometersToMicrometers(
              channel.wavelengthNanometers
            );

            return {
              channel: channel.name,
              wavelengthNanometers: channel.wavelengthNanometers,
              rayleighScatteringCoefficient:
                rayleighScatteringCoefficientAt(wavelengthMicrometers),
              mieExtinctionCoefficient:
                mieExtinctionCoefficientAt(wavelengthMicrometers),
              mieScatteringCoefficient:
                mieScatteringCoefficientAt(wavelengthMicrometers),
              ozoneAbsorptionCoefficient:
                ozoneAbsorptionCoefficientAt(channel.wavelengthNanometers),
              solarRadiance:
                channel.solarIrradiance /
                (Math.PI *
                  ATMOSPHERE.sunAngularRadiusRadians *
                  ATMOSPHERE.sunAngularRadiusRadians),
            };
          }),
          radianceToLuminanceFactors:
            usesLuminanceConversion() && !usesFullSpectralConversion()
              ? radianceToLuminanceFactors()
              : null,
          fullSpectralCieConversion: usesFullSpectralConversion(),
          spectralSampleCount: activeSpectralChannels().length,
          ozoneAbsorptionEnabled: includesOzoneAbsorption(),
          displayWhitePoint: displayWhitePoint(),
          paperFigure1ToneMap: usesPaperFigure1ToneMap()
            ? {
                expression: "1 - exp(-kL)",
                k: paperFigure1ToneMapK(),
                baseK:
                  usesSourcePaperFigure1ToneMapK() ||
                  usesDerivedPaperFigure1ToneMapK()
                  ? null
                  : displayExposureScalar(),
                sourceDerivedK: usesSourcePaperFigure1ToneMapK()
                  ? brunetonComparisonToneMapK()
                  : null,
                sourceDerivedFrom: usesSourcePaperFigure1ToneMapK()
                  ? "1 / (5 * MAX_LUMINOUS_EFFICACY)"
                  : null,
                brunetonComparisonToneMapExposureScale:
                  usesSourcePaperFigure1ToneMapK()
                    ? BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE
                    : null,
                maxLuminousEfficacy:
                  usesSourcePaperFigure1ToneMapK()
                    ? MAX_LUMINOUS_EFFICACY
                    : null,
                directDerivedK: usesDerivedPaperFigure1ToneMapK()
                  ? ATMOSPHERE.paperFigure1ToneMapFittedK
                  : null,
                derivedFrom: usesDerivedPaperFigure1ToneMapK()
                  ? "displayExposureScalar() * paperFigure1ToneMapFittedScale from step 021"
                  : null,
                fittedScale: usesFittedPaperFigure1ToneMap()
                  ? usesDerivedPaperFigure1ToneMapK()
                    ? null
                    : usesPaperFortyWavelengthRefitToneMap()
                    ? ATMOSPHERE.paperFortyWavelengthToneMapFittedScale
                    : ATMOSPHERE.paperFigure1ToneMapFittedScale
                  : null,
                fittedAgainstExternalTargets: usesFittedPaperFigure1ToneMap()
                  ? {
                      targets: [
                        "external_sources/bruneton-2016-page4-images/35-Im6.png",
                        "external_sources/bruneton-2016-page4-images/28-Im35.png",
                      ],
                      excludedPixels:
                        "outside sky disk, transparent pixels, and red Sun-direction cross pixels",
                      rmse: 0.14241668763076523,
                      sunsetRmse: 0.10266833752574976,
                      middayRmse: 0.17328473699884708,
                      ...(usesDerivedPaperFigure1ToneMapK()
                        ? {
                            usesDerivedProductK: true,
                            derivedK: ATMOSPHERE.paperFigure1ToneMapFittedK,
                            derivedFrom:
                              "displayExposureScalar() * paperFigure1ToneMapFittedScale from step 021",
                            exposureAndScaleDecompositionOmitted: true,
                          }
                        : {}),
                      ...(usesPaperFortyWavelengthRefitToneMap()
                        ? {
                            refitAfterFortyWavelengthSampling: true,
                            rmse: 0.1401976612070572,
                            sunsetRmse: 0.11115123773917923,
                            middayRmse: 0.16419101740364553,
                          }
                        : {}),
                    }
                  : null,
                demoGammaPowerOmitted: true,
                demoWhitePointOmitted: true,
              }
            : null,
          demoWhiteBalanceEnabled: usesDemoWhiteBalance(),
          figure1SunZenithAngles: usesFigure1SunZenithAngles()
            ? {
                sunsetSunZenithDegrees: 87,
                sunsetSunAltitudeDegrees: 3,
                middaySunZenithDegrees: 21,
                middaySunAltitudeDegrees: 69,
              }
            : null,
          figure1FourSkydomeViews: usesFigure1FourSkydomeViews()
            ? FIGURE1_FOUR_VIEW_SCENES.map((scene) => ({
                id: scene.id,
                sourceTimeOfDay: scene.sourceTimeOfDay,
                sourceSunZenithDegrees: scene.sourceSunZenithDegrees,
                sunAltitudeDegrees: scene.sunAltitudeDegrees,
                sunAzimuthDegrees: scene.sunAzimuthDegrees,
                sourceTile: scene.sourceTile,
                sourceRedCrossCenterPixels: scene.sourceRedCrossCenterPixels,
              }))
            : null,
          directSolarDiscRendered:
            !omitsDirectSolarDiscForPaperSkyRadiance(),
          pixelFilteredSolarDisc: usesPixelFilteredSolarDisc()
            ? {
                samplesPerAxis:
                  ATMOSPHERE.solarDiscPixelFilterSamplesPerAxis,
                sampleCount:
                  ATMOSPHERE.solarDiscPixelFilterSamplesPerAxis *
                  ATMOSPHERE.solarDiscPixelFilterSamplesPerAxis,
              }
            : null,
          secondOrderScattering: usesSecondOrderScattering()
            ? {
                directionCount: secondOrderIncomingDirections([1, 0, 0]).length,
                fullSphereDirections:
                  usesNishita96SecondOrderDirections() ||
                  usesFibonacciSphereSecondOrderDirections(),
                fibonacciSphereDirections:
                  usesFibonacciSphereSecondOrderDirections(),
                altitudeBins: ATMOSPHERE.secondOrderAltitudeBins,
                angularWeightSteradians:
                  secondOrderAngularWeight(
                    secondOrderIncomingDirections([1, 0, 0]).length
                  ),
                nishita96PlaneDirections:
                  usesNishita96SecondOrderDirections(),
                incidentRadianceCacheSunMuBins:
                  usesSecondOrderSunAngleIncidentCache()
                    ? ATMOSPHERE.secondOrderIncidentSunMuBins
                    : null,
                incidentRadianceCacheMuBins:
                  usesSecondOrderSunViewAngleIncidentCache()
                    ? ATMOSPHERE.secondOrderIncidentMuBins
                    : null,
                incidentRadianceCacheCoordinates:
                  usesSecondOrderSunAngleIncidentCache()
                    ? usesSecondOrderSunViewAngleIncidentCache()
                      ? "altitude bin plus local solar zenith cosine bin and incoming-view zenith cosine bin for each incoming direction"
                      : "altitude bin plus local solar zenith cosine bin for each incoming direction"
                    : "altitude bin for each incoming direction",
              }
            : null,
          groundBounceCoupling: usesGroundBounceCoupling()
            ? {
                groundAlbedo: ATMOSPHERE.groundAlbedo,
                directionCount: ATMOSPHERE.groundBounceDirectionCount,
                altitudeBins: ATMOSPHERE.groundBounceAltitudeBins,
                transmittanceSampleCount:
                  ATMOSPHERE.groundBounceTransmittanceSampleCount,
                angularWeightSteradians:
                  (2 * Math.PI) / ATMOSPHERE.groundBounceDirectionCount,
                includesSkyIrradianceAtGround:
                  usesGroundSkyIrradianceCoupling(),
                skyIrradianceContributesWhenSunVisibilityIsZero:
                  usesShadowedGroundSkyIrradiance(),
                skyIrradianceDirectionCount:
                  usesGroundSkyIrradianceCoupling()
                    ? ATMOSPHERE.groundSkyIrradianceDirectionCount
                    : null,
              }
            : null,
        },
        scenes: activeScenes(),
      },
      display: {
        colorRole:
          usesFullSpectralConversion()
            ? usesPaperFortyWavelengthSampling()
              ? "Forty spectral radiance samples from 360 nm to 830 nm integrated with CIE 1931 color matching functions and XYZ to linear sRGB before the paper Figure 1 tone map."
              : usesPaperFigure1ToneMap()
              ? "Fifteen spectral radiance samples integrated with CIE 1931 color matching functions and XYZ to linear sRGB before the paper Figure 1 tone map."
              : "Fifteen spectral radiance samples integrated with CIE 1931 color matching functions and XYZ to linear sRGB before demo exposure display."
            : usesLuminanceConversion()
            ? "Bruneton approximate luminance conversion from three radiance wavelengths, then demo exposure display."
            : "Bruneton-style three-wavelength radiance channels displayed directly; this is not full CIE color matching.",
        exposure:
          displayExposureScalar(),
        whitePoint: displayWhitePoint(),
        transform: usesPaperFigure1ToneMap()
          ? usesSourcePaperFigure1ToneMapK()
            ? "1 - exp(-k * max(0, linear_sRGB)); k is Bruneton comparison source k = 1 / (5 * 683)"
            : usesDerivedPaperFigure1ToneMapK()
            ? "1 - exp(-k * max(0, linear_sRGB)); k is the direct derived step 021 product 0.0002454"
            : usesFittedPaperFigure1ToneMap()
            ? "1 - exp(-k * max(0, linear_sRGB)); k is a single global scalar fit against external Figure 1 target tiles"
            : "1 - exp(-k * max(0, linear_sRGB)); k held to the previous display exposure scalar for this audit"
          : "pow(1 - exp(-radiance / whitePoint * exposure), 1 / 2.2)",
        outsideCircle: "Transparent alpha marks pixels outside the sky dome.",
      },
      omittedByDesign: [
        includesOzoneAbsorption()
          ? "none for ozone absorption; Bruneton's ozone profile is included"
          : "ozone absorption",
        ...(omitsDirectSolarDiscForPaperSkyRadiance()
          ? [
              "direct solar-disc radiance in the camera pass; this step isolates atmospheric sky radiance and aureole for the Figure 1 target-contract test",
            ]
          : []),
        usesGroundBounceCoupling()
          ? usesGroundSkyIrradianceCoupling()
            ? "higher-order sky irradiance ground reflection; first-order sky irradiance and direct-Sun Lambertian ground bounce are included"
            : "sky-irradiance ground reflection; direct-Sun Lambertian ground bounce is included"
          : "ground coupling",
        usesSecondOrderScattering()
          ? "third and higher scattering orders; a directional second-order term is included"
          : usesMultipleScatteringProxy()
          ? "full directional multiple scattering; only a sourced scalar irradiance proxy is included"
          : "multiple scattering",
        "precomputed texture interpolation",
        usesFullSpectralConversion()
          ? usesPaperFortyWavelengthSampling()
            ? "full Bruneton precomputed illuminance textures; this evaluates 40 spectral samples directly per pixel"
            : "full Bruneton precomputed illuminance textures; this evaluates 15 spectral samples directly per pixel"
          : usesLuminanceConversion()
          ? "full multi-wavelength precomputed illuminance; this uses Bruneton's three-wavelength approximation"
          : "CIE XYZ or linear sRGB luminance conversion",
      ],
    };
  }

  if (STEP.id === "geometry-transmittance-baseline") {
    return {
      status: "geometry-and-beer-lambert-transmittance-only",
      externalSources: EXTERNAL_SOURCES,
      equations: [
        {
          name: "equidistant fisheye ray angle",
          expression: "theta = rho * pi / 2",
          purpose:
            "Maps the circular 180 degree fisheye from zenith at center to horizon at the edge.",
          source: "fisheye-equidistant-projection",
        },
        {
          name: "view ray in local tangent frame",
          expression:
            "w = [sin(theta) cos(phi), sin(theta) sin(phi), cos(theta)]",
          purpose:
            "Constructs the spherical-atmosphere ray for each skydome pixel.",
          source: "fisheye-equidistant-projection",
        },
        {
          name: "distance to top atmosphere boundary",
          expression:
            "d_top = -r * mu + sqrt(r^2 * (mu^2 - 1) + r_top^2)",
          purpose:
            "Finds where the view ray exits the spherical atmosphere.",
          source: "bruneton-functions-glsl",
        },
        {
          name: "sample radius along ray",
          expression: "r_i = sqrt(d_i^2 + 2 * r * mu * d_i + r^2)",
          purpose:
            "Computes altitude for density samples during optical-length integration.",
          source: "bruneton-functions-glsl",
        },
        {
          name: "exponential density profile",
          expression: "density(h) = exp(-h / H)",
          purpose:
            "Rayleigh and Mie density falloff for optical-length diagnostics.",
          source: "bruneton-demo-constants",
        },
        {
          name: "trapezoidal optical length",
          expression: "L = sum_i weight_i * density(h_i) * step",
          purpose:
            "Numerically integrates normalized density along the ray.",
          source: "bruneton-functions-glsl",
        },
        {
          name: "Beer-Lambert transmittance",
          expression: "T = exp(-(beta_R * L_R + beta_M * L_M))",
          purpose:
            "Computes diagnostic direct transmittance at the selected wavelength.",
          source: "bruneton-functions-glsl",
        },
        {
          name: "Bruneton Rayleigh coefficient at lambda",
          expression: "beta_R(lambda) = 1.24062e-6 * lambda^-4",
          purpose:
            "Computes the Rayleigh coefficient for the 550 nm diagnostic wavelength.",
          source: "bruneton-demo-constants",
        },
        {
          name: "Bruneton Mie extinction at lambda",
          expression: `beta_M(lambda) = ${ATMOSPHERE.mieAngstromBeta} / ${ATMOSPHERE.mieScaleHeightMeters} * lambda^-${ATMOSPHERE.mieAngstromAlpha}`,
          purpose:
            "Computes the Mie extinction coefficient for the 550 nm diagnostic wavelength.",
          source: "bruneton-demo-constants",
        },
      ],
      constants: {
        imageSizePixels: IMAGE_SIZE,
        skyRadiusPixels: SKY_RADIUS,
        atmosphere: ATMOSPHERE,
        derived: {
          rayleighScatteringCoefficient550nm: rayleighScatteringCoefficient(),
          mieExtinctionCoefficient550nm: mieExtinctionCoefficient(),
        },
        scenes: activeScenes(),
      },
      display: {
        colorRole:
          "False diagnostic channels only: red is optical-depth display, green is 550 nm transmittance, blue is altitude/upness.",
        opticalDepthDisplay:
          "red = 1 - exp(-0.55 * opticalDepth), a monotonic compression for visualization only.",
        outsideCircle: "Transparent alpha marks pixels outside the sky dome.",
      },
    };
  }

  return {
    status: "diagnostic-only",
    equations: [
      {
        name: "normalized image radius",
        expression: "rho = sqrt((x - cx)^2 + (y - cy)^2) / R",
        purpose:
          "Classifies pixels inside the circular fisheye skydome footprint.",
      },
      {
        name: "diagnostic zenith angle",
        expression: "theta = rho * pi / 2",
        purpose:
          "Maps the center to zenith and the circular edge to horizon for this scaffold image.",
      },
      {
        name: "diagnostic altitude",
        expression: "altitude = pi / 2 - theta",
        purpose:
          "Provides a non-physical brightness ramp to make projection errors visible.",
      },
    ],
    constants: {
      imageSizePixels: IMAGE_SIZE,
      skyRadiusPixels: SKY_RADIUS,
      sunsetSunAltitudeDegrees: 5,
      middaySunAltitudeDegrees: 65,
    },
    display: {
      colorRole:
        "False diagnostic colors only; they are not sky radiance, not colorimetry, and not a hidden grade.",
      outsideCircle: "Transparent alpha marks pixels outside the sky dome.",
    },
  };
}

function makeNotes(sceneOutputs) {
  if (isSingleScatteringStep()) {
    return `# ${STEP.title}

Status: ${STEP.status}

This step renders a first physical sky-radiance baseline. It integrates
single-scattered Rayleigh and Mie radiance along each fisheye view ray. At each
scattering sample it applies Beer-Lambert transmittance from the observer to
the sample and from the sample toward the Sun, then multiplies by the
externally sourced Rayleigh or Mie phase function.

The physical integration uses ${
      usesFullSpectralConversion()
        ? usesPaperFortyWavelengthSampling()
          ? "40 centered wavelength samples from 360 nm to 830 nm"
          : "15 centered wavelength samples from 360 nm to 830 nm"
        : "Bruneton's three radiance wavelengths: 680 nm, 550 nm, and 440 nm"
    }. ${
      usesFullSpectralConversion()
        ? usesPaperFortyWavelengthSampling()
          ? "This step matches the Bruneton 2016 paper comparison wavelength count, integrates those samples through the CIE 1931 color matching functions and XYZ-to-linear-sRGB matrix, then applies the fitted Figure 1 paper tone map."
          : usesPaperFigure1ToneMap()
          ? "This step integrates those samples through the CIE 1931 color matching functions and XYZ-to-linear-sRGB matrix before applying the Bruneton 2016 Figure 1 paper tone map."
          : "This step integrates those samples through the CIE 1931 color matching functions and XYZ-to-linear-sRGB matrix before applying the demo exposure transform."
        : usesLuminanceConversion()
        ? "This step converts those three radiance samples with Bruneton's documented approximate spectral radiance-to-luminance factors before applying the demo exposure transform."
        : "These channels are displayed directly with the Bruneton demo exposure transform, so this step is not full CIE color matching or linear sRGB luminance."
    } This step still omits ${
      includesOzoneAbsorption() ? "" : "ozone absorption, "
    }${
      usesGroundBounceCoupling()
        ? usesGroundSkyIrradianceCoupling()
          ? "higher-order sky-irradiance ground reflection, "
          : "sky-irradiance ground reflection, "
        : "ground coupling, "
    }${
      usesSecondOrderScattering()
        ? "third and higher scattering orders"
        : usesMultipleScatteringProxy()
        ? "full directional multiple scattering"
        : "multiple scattering"
    }, and precomputed texture interpolation.${
      usesBruneton2016Aerosols()
        ? " This run uses Bruneton 2016 clear-sky evaluation aerosol parameters: alpha 0.8, beta 0.04, single-scattering albedo 0.8, and g 0.7."
        : ""
    }${
      includesOzoneAbsorption()
        ? " This run additionally includes Bruneton's default ozone absorption profile and 300 Dobson unit ozone amount."
        : ""
    }${
      usesPaperComparisonNoOzonePolicy()
        ? " This run disables ozone absorption to match the Bruneton 2016 paper comparison implementation policy."
        : ""
    }${
      usesFigure1SunZenithAngles()
        ? " This run also uses the Bruneton 2016 Figure 1 row-label Sun zenith angles: 87 degrees for the low-Sun scene and 21 degrees for the high-Sun scene, corresponding to Sun altitudes of 3 and 69 degrees."
        : ""
    }${
      usesFigure1FourSkydomeViews()
        ? " This run uses the four Bruneton 2016 Figure 1 skydome rows: 06h00 / 87 degrees, 10h15 / 41 degrees, 11h15 / 31 degrees, and 13h15 / 21 degrees. Sun altitude is 90 degrees minus the row zenith angle, and Sun azimuth is measured from the red-cross centers in the directly extracted Bruneton-column Figure 1 tiles."
        : ""
    }${
      usesPaperFortyWavelengthSampling()
        ? " This run also replaces the previous 15-sample spectral approximation with the paper comparison setup's 40 wavelengths between 360 nm and 830 nm."
        : ""
    }${
      usesPaperFortyWavelengthRefitToneMap()
        ? usesShadowedGroundSkyIrradiance()
          ? " This run uses the single global paper tone-map k scalar refit from the 40-wavelength spectral output."
          : " This run refits the single global paper tone-map k scalar after switching to 40 wavelengths, because the previous fitted k was based on the 15-sample spectral output."
        : ""
    }${
      usesDemoWhiteBalance()
        ? " This run also applies Bruneton's optional solar-spectrum white balance as an explicit display hypothesis."
        : ""
    }${
      usesPaperFigure1ToneMap()
        ? usesSourcePaperFigure1ToneMapK()
          ? " This run replaces the demo shader display path with the Bruneton 2016 Figure 1 comparison-source display form: CIE-integrated linear sRGB is tone mapped as 1 - exp(-kL), using k = 1 / (5 * 683) = 0.00029282576866764275."
          : usesDerivedPaperFigure1ToneMapK()
          ? " This run replaces the demo shader display path with the Bruneton 2016 Figure 1 caption display form: CIE-integrated linear sRGB is tone mapped as 1 - exp(-kL), using the step 021 fitted product k = 0.0002454 directly instead of keeping exposure and fitted scale as separate knobs."
          : usesFittedPaperFigure1ToneMap()
          ? " This run replaces the demo shader display path with the Bruneton 2016 Figure 1 caption display form: CIE-integrated linear sRGB is tone mapped as 1 - exp(-kL), with k fitted as a single global scalar against the direct external low-Sun and high-Sun Figure 1 target tiles because the caption does not specify its numeric value."
          : " This run replaces the demo shader display path with the Bruneton 2016 Figure 1 caption display form: CIE-integrated linear sRGB is tone mapped as 1 - exp(-kL), with k held to the previous externally sourced exposure scalar because the caption does not specify its numeric value."
        : ""
    }${
      usesPixelFilteredSolarDisc()
        ? " This run also pixel-filters the direct solar disc by averaging Sun coverage over subpixel fisheye samples, while leaving sky-scattering samples unchanged."
        : ""
    }${
      omitsDirectSolarDiscForPaperSkyRadiance()
        ? " This run deliberately omits the added direct solar-disc radiance from the camera pass and renders the scattered sky/aureole component only; direct sunlight remains the incident source in the atmospheric scattering integral. This is a Figure 1 target-contract test against the external paper extraction, where the Sun direction is shown by a red cross overlay, not a pixel-level brightness clamp."
        : ""
    }${
      usesMultipleScatteringProxy()
        ? " This run also applies a documented scalar proxy for missing multiple-scattering irradiance by multiplying sky-scattered radiance by 1.5 before display."
        : ""
    }${
      usesSecondOrderScattering()
        ? usesNishita96SecondOrderDirections()
          ? " This run replaces the scalar proxy with an explicit second-scattering integral over the paper-described Nishita96 plane directions at each primary ray sample."
          : usesFibonacciSphereSecondOrderDirections()
          ? " This run replaces the earlier upper-hemisphere/two-ring second-order directions with a full-sphere Fibonacci lattice quadrature at each primary ray sample, using a 4*pi/N solid-angle weight."
          : " This run replaces the scalar proxy with an explicit second-scattering integral over eight incoming sky directions at each primary ray sample."
        : ""
    }${
      usesSecondOrderSunAngleIncidentCache()
        ? usesSecondOrderSunViewAngleIncidentCache()
          ? " This run also adds local solar-zenith and incoming-view zenith bins to the second-order incident-radiance cache, approximating Bruneton's scattering texture dependence on mu_s and mu instead of reusing one same-altitude incident sky value everywhere."
          : " This run also adds local solar-zenith bins to the second-order incident-radiance cache, approximating Bruneton's scattering texture dependence on mu_s instead of reusing one same-altitude incident sky value everywhere."
        : ""
    }${
      usesDerivedPaperFigure1NoGround()
        ? " This run deliberately omits both step 021 ground-bounce terms while keeping the same visual-anchor scattering, aerosol, no-direct-disc, and paper tone-map path, so the artifact isolates whether ground coupling materially contributed."
        : usesSourcePaperFigure1ToneMapK()
        ? " This run uses the experiment 31 four-view no-ground model path but replaces the fitted k with Bruneton's comparison-source k, so both ground-coupling terms remain off."
        : usesFigure1FourSkydomeViews()
        ? " This run uses the step 029 no-ground derived-k model path for all four Figure 1 skydome views, so both ground-coupling terms remain off."
        : usesDerivedPaperFigure1DirectGroundOnly()
        ? " This run deliberately keeps step 021's direct-Sun Lambertian ground bounce but omits the weaker sky-irradiance ground term, so the artifact isolates whether that sky-ground knob materially contributed."
        : ""
    }${
      usesGroundBounceCoupling()
        ? usesGroundSkyIrradianceCoupling()
          ? ` This run also adds Bruneton's sun-plus-sky Lambertian lower-boundary coupling term: directly illuminated and sky-lit ground reflects albedo/pi radiance, that radiance is attenuated to each atmospheric sample, and the sample scatters it toward the camera.${
              usesShadowedGroundSkyIrradiance()
                ? " This run keeps the sky-irradiance ground term active even where direct Sun visibility is zero, matching the external shader's separate Sun and sky visibility factors."
                : ""
            }`
          : " This run also adds a direct-Sun Lambertian lower-boundary coupling term: directly illuminated ground reflects albedo/pi radiance, that radiance is attenuated to each atmospheric sample, and the sample scatters it toward the camera."
        : ""
    }

External sources used:

${EXTERNAL_SOURCES.map((source) => `- ${source.id}: ${source.url}`).join("\n")}

Generated outputs:

${sceneOutputs.map((output) => `- ${output}`).join("\n")}

Evaluation focus:

Compare the result against the recorded visual deltas: proxy replacement,
Sun/aureole size, midday saturation, sunset minimum darkness, and horizon fade
width.
`;
  }

  if (STEP.id === "geometry-transmittance-baseline") {
    return `# ${STEP.title}

Status: ${STEP.status}

This step adds spherical atmosphere ray geometry and Beer-Lambert
transmittance diagnostics. It still does not render sky radiance, scattering
phase functions, spectral-to-RGB color conversion, tone mapping, multiple
scattering, ground coupling, or a Bruneton visual target.

The two PNGs are false diagnostic images, not sky colors. Red shows compressed
550 nm optical depth, green shows 550 nm transmittance, and blue shows the
pixel direction's altitude/upness. The Sun marker location differs between the
sunset and midday cases and is scaled by direct transmittance along the Sun
ray from the observer.

External sources used:

${EXTERNAL_SOURCES.map((source) => `- ${source.id}: ${source.url}`).join("\n")}

Generated outputs:

${sceneOutputs.map((output) => `- ${output}`).join("\n")}

Next step:

Evaluate against direct Bruneton external skydome targets and decide whether
the next correction should be ozone/ground coupling, a multiple-scattering
approximation, or a stronger target-aligned parameter set.
`;
  }

  return `# ${STEP.title}

Status: ${STEP.status}

This first fresh-lane artifact verifies that the script can create a numbered
artifact folder and render two circular fisheye diagnostic images. It does not
implement atmospheric physics, scattering, transmittance, spectral sampling,
color matching, tone mapping, or a Bruneton visual target.

The images are intentionally diagnostic. The center is the zenith, the circular
edge is the horizon, pixels outside the circle are transparent, and the small
yellow marker indicates the requested scene's Sun direction. The colors are
false projection aids only and must not be reused as expected sky colors.

Generated outputs:

${sceneOutputs.map((output) => `- ${output}`).join("\n")}

Next step:

Add externally justified spherical atmosphere geometry and Beer-Lambert
transmittance diagnostics before adding any sky radiance model.
`;
}

function main() {
  const artifactDirectory = nextArtifactDirectory();
  const logLines = [];
  const sceneOutputs = [];
  const sceneDiagnostics = [];
  const scenes = activeScenes();

  logLines.push(`artifactDirectory=${artifactDirectory}`);
  logLines.push(`node=${process.version}`);
  logLines.push(`step=${STEP.label}`);

  for (const scene of scenes) {
    const output = sceneOutputName(scene);
    const outputPath = path.join(artifactDirectory, output);
    const rendered = renderScene(scene);
    writePng(outputPath, IMAGE_SIZE, IMAGE_SIZE, rendered.pixels);
    sceneOutputs.push(output);
    sceneDiagnostics.push({
      scene: scene.id,
      output,
      sunAltitudeDegrees: scene.sunAltitudeDegrees,
      sunAzimuthDegrees: scene.sunAzimuthDegrees,
      diagnostics: rendered.diagnostics,
    });
    logLines.push(`wrote ${output}`);
  }

  const equations = makeEquationsRecord();

  writeJson(path.join(artifactDirectory, "provenance.json"), {
    step: STEP,
    createdAt: new Date().toISOString(),
    command: process.argv.join(" "),
    script: path.relative(ROOT, __filename).replace(/\\/g, "/"),
    artifactDirectory: path.relative(ROOT, artifactDirectory).replace(/\\/g, "/"),
    runtime: {
      node: process.version,
      platform: process.platform,
    },
    sourceBoundary: {
      localProjectAtmosphereSourcesUsed: false,
      externalPhysicsSourcesUsed: STEP.id !== "scaffold-diagnostic",
      note:
        STEP.id !== "scaffold-diagnostic"
          ? "This run uses only direct external source citations listed in equations-and-constants.json for atmosphere, projection, and display decisions. It does not use older local project atmosphere code, docs, logs, or artifacts."
          : "This scaffold records projection diagnostics only. It makes no atmospheric physics or Bruneton appearance claim.",
    },
    scenes,
    equations,
    sceneDiagnostics,
    outputs: sceneOutputs,
  });

  writeJson(path.join(artifactDirectory, "equations-and-constants.json"), equations);
  writeText(path.join(artifactDirectory, "notes.md"), makeNotes(sceneOutputs));
  writeText(path.join(artifactDirectory, "run.log"), `${logLines.join("\n")}\n`);
  fs.copyFileSync(__filename, path.join(artifactDirectory, "script-snapshot.js"));

  for (const line of logLines) {
    console.log(line);
  }
}

main();
