import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_ATMOSPHERE,
  DEFAULT_FLAT_SIMULATION_CONFIG,
  DEFAULT_FLAT_SIMULATION_SUN,
  MEAN_EARTH_RADIUS_KM,
} from "../../../src/flat/features/flat-simulation/models/consts.js";
import { resolveFalseSunLatitudeDeg } from "../../../src/flat/features/flat-simulation/models/sun-latitude.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../..");
const ARTIFACT_ROOT = path.join(
  ROOT,
  "tmp",
  "atmosphere",
  "atmosflat32"
);
const REFERENCE_ARTIFACT_ROOT = path.join(
  ROOT,
  "tmp",
  "atmosphere",
  "bruneton_start_fresh",
  "032-figure1-four-view-source-k-no-ground-baseline"
);

const IMAGE_SIZE = 320;
const SKY_RADIUS = IMAGE_SIZE * 0.47;
const CENTER = (IMAGE_SIZE - 1) / 2;
const TAU = Math.PI * 2;
const METERS_PER_KILOMETER = 1000;

const DEFAULT_STEP_ID = "distant-source-abstraction-baseline";
const FLAT_APP_CLOSEST_SAN_JOSE_STEP_ID = "flat-app-closest-san-jose-position";
const FLAT_APP_ROTATION_SKYDOMES_STEP_ID = "flat-app-rotation-skydomes";
const FLAT_APP_SKYDOME_ROTATION_OFFSETS_DEGREES = Object.freeze([
  0,
  45,
  90,
  135,
  180,
]);
const FLAT_APP_FORWARD_TIME_ROTATION_SIGN = 1;
const FLAT_APP_FORWARD_TIME_ORBIT_DIRECTION = "clockwise";
const FLAT_APP_BRIGHTNESS_CALIBRATION_TARGET = Object.freeze({
  kind: "match-distant-solar-noon-unit-incident-scale-at-closest-approach",
  distantSceneKey: "figure1-13h15-z21",
  targetIncidentScaleAtClosest: 1,
  targetIncidentScaleUnits:
    "multiple of Algorithm32 distant-directional-sun top-of-atmosphere solar irradiance",
});
const SAN_JOSE_CLOSEST_APPROACH_REQUEST = Object.freeze({
  root: Object.freeze({ ...DEFAULT_FLAT_SIMULATION_CONFIG.root }),
  time: DEFAULT_FLAT_SIMULATION_CONFIG.time,
  sunConfig: DEFAULT_FLAT_SIMULATION_SUN,
  projectionConfig: Object.freeze({
    earthProjection: DEFAULT_FLAT_SIMULATION_CONFIG.earthProjection,
    meanEarthRadiusKm: MEAN_EARTH_RADIUS_KM,
  }),
  radianceConfig: DEFAULT_ATMOSPHERE.rendering.falseSunRadiance,
  placementRule: "independent-closest-horizontal-approach-from-app-config",
});

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
  "distant-source-abstraction-baseline": {
    id: "figure1-four-view-source-k-no-ground-baseline",
    registryId: "distant-source-abstraction-baseline",
    label: "distant-source-abstraction-baseline",
    title:
      "Algorithm32 source abstraction with the default distant directional Sun",
    status: "source-abstraction parity target",
    model:
      "algorithm32-source-abstraction-distant-directional-sun-step032-parity",
    outputSuffix: "figure1-four-view-source-k-no-ground",
    sourceAbstraction: {
      enabled: true,
      activeAdapter: "distant-directional-sun",
    },
  },
  "flat-app-closest-san-jose-position": {
    id: "flat-app-closest-san-jose-position",
    registryId: "flat-app-closest-san-jose-position",
    label: "flat-app-closest-san-jose-position",
    title: "App flat Sun position at closest San Jose approach",
    status: "diagnostic POC",
    model: "flat-app-visible-sun-atmosphere-source-position",
    sourceAbstraction: {
      enabled: true,
      activeAdapter: "flat-local-point-sun",
    },
  },
  "flat-app-rotation-skydomes": {
    id: "flat-app-rotation-skydomes",
    registryId: "flat-app-rotation-skydomes",
    label: "flat-app-rotation-skydomes",
    title: "Flat local Sun skydome diagnostics by rotation from San Jose closest approach",
    status: "diagnostic POC",
    model: "flat-app-config-local-sun-rotation-skydomes",
    sourceAbstraction: {
      enabled: true,
      activeAdapter: "flat-local-point-sun",
    },
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

const ACTIVE_STEPS = {
  [DEFAULT_STEP_ID]: STEPS[DEFAULT_STEP_ID],
  [FLAT_APP_CLOSEST_SAN_JOSE_STEP_ID]:
    STEPS[FLAT_APP_CLOSEST_SAN_JOSE_STEP_ID],
  [FLAT_APP_ROTATION_SKYDOMES_STEP_ID]:
    STEPS[FLAT_APP_ROTATION_SKYDOMES_STEP_ID],
};

const STEP = ACTIVE_STEPS[getRequestedStepId()];

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

const FLAT_ATMOSPHERE_TOP_ALTITUDE_METERS =
  (Number(DEFAULT_ATMOSPHERE.profile?.topAltitudeKm) ||
    (ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters) /
      METERS_PER_KILOMETER) * METERS_PER_KILOMETER;
const FLAT_OBSERVER_POSITION_METERS = Object.freeze([
  0,
  0,
  ATMOSPHERE.observerHeightMeters,
]);
const ROUND_EQUIVALENT_CAP_CENTER_METERS = Object.freeze([
  0,
  0,
  -ATMOSPHERE.bottomRadiusMeters,
]);
const ROUND_EQUIVALENT_CAP_RADIUS_METERS = ATMOSPHERE.topRadiusMeters;
const ROUND_EQUIVALENT_CAP_FOOTPRINT_RADIUS_METERS = Math.sqrt(
  Math.max(
    0,
    ROUND_EQUIVALENT_CAP_RADIUS_METERS ** 2 -
      (ATMOSPHERE.bottomRadiusMeters + ATMOSPHERE.observerHeightMeters) ** 2
  )
);

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

  if (!Object.hasOwn(ACTIVE_STEPS, requestedStepId)) {
    const validSteps = Object.keys(ACTIVE_STEPS).join(", ");
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
    FLAT_APP_ROTATION_SKYDOMES_STEP_ID,
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
    FLAT_APP_ROTATION_SKYDOMES_STEP_ID,
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
    FLAT_APP_ROTATION_SKYDOMES_STEP_ID,
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
  return [
    FLAT_APP_ROTATION_SKYDOMES_STEP_ID,
    "figure1-four-view-source-k-no-ground-baseline",
  ].includes(STEP.id);
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
    FLAT_APP_ROTATION_SKYDOMES_STEP_ID,
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

function createDistantDirectionalSunSource({
  sceneKey,
  direction,
  spectralIrradianceByWavelength,
}) {
  const normalizedDirection = normalize(direction);
  const source = {
    kind: "distant-directional-sun",
    sceneKey,
    direction: normalizedDirection,
    distanceKind: "infinite",
    spectralIrradianceByWavelength,
    cacheKey: `distant-directional-sun:${sceneKey}:${normalizedDirection
      .map((component) => component.toPrecision(17))
      .join(",")}`,
    sourceSamplesAt(position, geometry = {}) {
      return [
        {
          kind: "distant-directional-sun",
          direction: normalizedDirection,
          distance: Number.POSITIVE_INFINITY,
          distanceKind: "infinite",
          distanceMeters: Number.POSITIVE_INFINITY,
          spectralIncidentScaleByWavelength:
            spectralIrradianceByWavelength.map(() => 1),
          visibilityPath: "to-atmosphere-boundary",
          diagnostics: {
            sceneKey,
            positionRadiusMeters: Array.isArray(position)
              ? length(position)
              : null,
            geometryKind: geometry.kind || "algorithm32-spherical",
          },
        },
      ];
    },
    toJSON() {
      return {
        kind: this.kind,
        sceneKey: this.sceneKey,
        direction: this.direction,
        distanceKind: this.distanceKind,
        spectralIrradianceByWavelength: this.spectralIrradianceByWavelength,
      };
    },
  };

  return source;
}

function createAlgorithm32FlatLocalPointSunSource({
  sceneKey,
  observerPositionMeters,
  observerDirection,
  observerDistanceKm,
  radiusKm,
  color,
  intensity,
  solarIrradianceScale,
  radianceConfig,
  anchor,
  flatSourceConfig,
  brightnessCalibration,
}) {
  const normalizedDirection = normalize(observerDirection);
  const configuredObserverDistanceKm = Math.max(
    0,
    Number(observerDistanceKm) || 0
  );
  const configuredObserverDistanceMeters =
    configuredObserverDistanceKm * METERS_PER_KILOMETER;
  const sourcePositionMeters = addScaled(
    observerPositionMeters,
    normalizedDirection,
    configuredObserverDistanceMeters
  );
  const safeRadiusKm = Math.max(0, Number(radiusKm) || 0);
  const safeIntensity = Math.max(0, Number(intensity) || 0);
  const safeSolarIrradianceScale = Math.max(
    0,
    Number(solarIrradianceScale) || 0
  );
  const normalizedRadianceConfig =
    normalizeFlatLocalPointSunRadianceConfig(radianceConfig);
  const referenceSpectralIncidentScale =
    safeIntensity * safeSolarIrradianceScale;

  return {
    kind: "flat-local-point-sun",
    sceneKey,
    positionMeters: sourcePositionMeters,
    observerPositionMeters: [...observerPositionMeters],
    observerDistanceKm: configuredObserverDistanceKm,
    radiusKm: safeRadiusKm,
    color,
    intensity: safeIntensity,
    solarIrradianceScale: safeSolarIrradianceScale,
    radianceConfig: normalizedRadianceConfig,
    referenceSpectralIncidentScale,
    anchor,
    flatSourceConfig,
    brightnessCalibration,
    cacheKey: `flat-local-point-sun:${sceneKey}:${sourcePositionMeters
      .map((component) => component.toPrecision(17))
      .join(",")}`,
    sourceSamplesAt(positionMetersInput, geometry = {}) {
      const samplePositionMeters = [...positionMetersInput];
      const toSourceMeters = subtractVectors(
        sourcePositionMeters,
        samplePositionMeters
      );
      const distanceMeters = length(toSourceMeters);
      const distanceKm = distanceMeters / METERS_PER_KILOMETER;
      const direction =
        distanceMeters > 0
          ? scaleVector(toSourceMeters, 1 / distanceMeters)
          : normalizedDirection;
      const apparentAngularRadiusRad =
        safeRadiusKm > 0 && distanceKm > 0
          ? Math.asin(Math.min(1, safeRadiusKm / distanceKm))
          : 0;
      const distanceFalloffScale = flatLocalPointSunDistanceFalloffScale(
        distanceKm,
        normalizedRadianceConfig
      );
      const spectralIncidentScale =
        referenceSpectralIncidentScale * distanceFalloffScale;

      return [
        {
          kind: "flat-local-point-sun",
          direction,
          distance: distanceMeters,
          distanceKind: "finite",
          distanceUnits: "m",
          distanceMeters,
          distanceKm,
          configuredDistanceKm: distanceKm,
          configuredDistanceUnits: "km",
          positionMeters: sourcePositionMeters,
          radiusKm: safeRadiusKm,
          apparentAngularRadiusRad,
          radianceModel: normalizedRadianceConfig.model,
          referenceDistanceKm: normalizedRadianceConfig.referenceDistanceKm,
          distanceFalloff: normalizedRadianceConfig.distanceFalloff,
          distanceFalloffScale,
          referenceSpectralIncidentScale,
          spectralIncidentScaleByWavelength: activeSpectralChannels().map(
            (channel) =>
              spectralIncidentScale * sourceColorScaleForChannel(color, channel)
          ),
          visibilityPath: "finite-source-distance-through-atmosphere",
          diagnostics: {
            sceneKey,
            samplePositionMeters,
            geometryKind: geometry.kind || "algorithm32-local-source",
            sampleLabel: geometry.label || null,
            configuredDistanceKm: distanceKm,
            distanceMeters,
            referenceDistanceKm: normalizedRadianceConfig.referenceDistanceKm,
            distanceFalloffScale,
            spectralIncidentScale,
          },
        },
      ];
    },
    toJSON() {
      return {
        kind: this.kind,
        sceneKey: this.sceneKey,
        positionMeters: this.positionMeters,
        observerPositionMeters: this.observerPositionMeters,
        observerDistanceKm: this.observerDistanceKm,
        radiusKm: this.radiusKm,
        color: this.color,
        intensity: this.intensity,
        solarIrradianceScale: this.solarIrradianceScale,
        radianceConfig: this.radianceConfig,
        referenceSpectralIncidentScale: this.referenceSpectralIncidentScale,
        anchor: this.anchor,
        flatSourceConfig: this.flatSourceConfig,
        brightnessCalibration: this.brightnessCalibration,
      };
    },
  };
}

function createSceneSunSource(scene) {
  return createDistantDirectionalSunSource({
    sceneKey: scene.id,
    direction: sunDirection(scene),
    spectralIrradianceByWavelength: activeSpectralChannels().map((channel) => ({
      wavelengthNanometers: channel.wavelengthNanometers,
      solarIrradiance: channel.solarIrradiance,
    })),
  });
}

function vectorToArray(vector) {
  return [vector.x, vector.y, vector.z];
}

function subtractVectors(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function maxVectorDelta(a, b) {
  return Math.max(
    Math.abs(a[0] - b[0]),
    Math.abs(a[1] - b[1]),
    Math.abs(a[2] - b[2])
  );
}

function sourceColorScaleForChannel(color, channel) {
  if (!color) {
    return 1;
  }

  if (channel.name === "red") {
    return Number(color.r) || 0;
  }
  if (channel.name === "green") {
    return Number(color.g) || 0;
  }
  if (channel.name === "blue") {
    return Number(color.b) || 0;
  }

  const wavelength = Number(channel.wavelengthNanometers) || 550;

  if (wavelength < 500) {
    return Number(color.b) || 0;
  }
  if (wavelength < 600) {
    return Number(color.g) || 0;
  }

  return Number(color.r) || 0;
}

function normalizeFlatLocalPointSunRadianceConfig(radianceConfig = {}) {
  const model = radianceConfig.model || "point-inverse-square-reference";

  if (model !== "point-inverse-square-reference") {
    throw new Error(
      `Unsupported flat local Sun radiance model "${model}".`
    );
  }

  const distanceFalloff = radianceConfig.distanceFalloff !== false;
  const referenceDistanceKm = Number(radianceConfig.referenceDistanceKm);

  if (
    distanceFalloff &&
    (!Number.isFinite(referenceDistanceKm) || referenceDistanceKm <= 0)
  ) {
    throw new Error(
      "flat-local-point-sun distance falloff requires referenceDistanceKm > 0."
    );
  }

  return Object.freeze({
    model,
    referenceDistanceKm: distanceFalloff ? referenceDistanceKm : null,
    distanceFalloff,
  });
}

function flatLocalPointSunDistanceFalloffScale(distanceKm, radianceConfig) {
  if (!radianceConfig.distanceFalloff) {
    return 1;
  }

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error(
      "flat-local-point-sun distance falloff requires sample distanceKm > 0."
    );
  }

  return Math.pow(radianceConfig.referenceDistanceKm / distanceKm, 2);
}

function createFlatLocalPointSunSource({
  sceneKey,
  positionKm,
  radiusKm,
  color,
  intensity,
  solarIrradianceScale,
  radianceConfig,
  anchor,
  derivedLightState,
}) {
  const sourcePositionKm = [...positionKm];
  const safeRadiusKm = Math.max(0, Number(radiusKm) || 0);
  const safeIntensity = Math.max(0, Number(intensity) || 0);
  const safeSolarIrradianceScale = Math.max(
    0,
    Number(solarIrradianceScale) || 0
  );
  const normalizedRadianceConfig =
    normalizeFlatLocalPointSunRadianceConfig(radianceConfig);
  const referenceSpectralIncidentScale =
    safeIntensity * safeSolarIrradianceScale;

  return {
    kind: "flat-local-point-sun",
    sceneKey,
    positionKm: sourcePositionKm,
    radiusKm: safeRadiusKm,
    color,
    intensity: safeIntensity,
    solarIrradianceScale: safeSolarIrradianceScale,
    radianceConfig: normalizedRadianceConfig,
    referenceSpectralIncidentScale,
    anchor,
    derivedLightState,
    sourceSamplesAt(positionKmInput, geometry = {}) {
      const samplePositionKm = [...positionKmInput];
      const toSourceKm = subtractVectors(sourcePositionKm, samplePositionKm);
      const distanceKm = length(toSourceKm);
      const direction =
        distanceKm > 0 ? scaleVector(toSourceKm, 1 / distanceKm) : [0, 1, 0];
      const apparentAngularRadiusRad =
        safeRadiusKm > 0 && distanceKm > 0
          ? Math.asin(Math.min(1, safeRadiusKm / distanceKm))
          : 0;
      const distanceFalloffScale = flatLocalPointSunDistanceFalloffScale(
        distanceKm,
        normalizedRadianceConfig
      );
      const spectralIncidentScale =
        referenceSpectralIncidentScale * distanceFalloffScale;

      return [
        {
          kind: "flat-local-point-sun",
          direction,
          distance: distanceKm,
          distanceKind: "finite",
          distanceUnits: "km",
          distanceMeters: distanceKm * METERS_PER_KILOMETER,
          configuredDistanceKm: distanceKm,
          configuredDistanceUnits: "km",
          positionKm: sourcePositionKm,
          radiusKm: safeRadiusKm,
          apparentAngularRadiusRad,
          radianceModel: normalizedRadianceConfig.model,
          referenceDistanceKm: normalizedRadianceConfig.referenceDistanceKm,
          distanceFalloff: normalizedRadianceConfig.distanceFalloff,
          distanceFalloffScale,
          referenceSpectralIncidentScale,
          spectralIncidentScaleByWavelength: activeSpectralChannels().map(
            (channel) =>
              spectralIncidentScale * sourceColorScaleForChannel(color, channel)
          ),
          visibilityPath: "flat-scene-position-to-source",
          diagnostics: {
            sceneKey,
            samplePositionKm,
            geometryKind: geometry.kind || "flat-app-scene",
            sampleLabel: geometry.label || null,
            configuredDistanceKm: distanceKm,
            referenceDistanceKm: normalizedRadianceConfig.referenceDistanceKm,
            distanceFalloffScale,
            spectralIncidentScale,
          },
        },
      ];
    },
    toJSON() {
      return {
        kind: this.kind,
        sceneKey: this.sceneKey,
        positionKm: this.positionKm,
        radiusKm: this.radiusKm,
        color: this.color,
        intensity: this.intensity,
        solarIrradianceScale: this.solarIrradianceScale,
        radianceConfig: this.radianceConfig,
        referenceSpectralIncidentScale: this.referenceSpectralIncidentScale,
        anchor: this.anchor,
        derivedLightState: this.derivedLightState,
      };
    },
  };
}

function projectNorthPoleAzimuthalEquidistantKm(point, meanEarthRadiusKm) {
  const latRad = degreesToRadians(point.lat);
  const lonRad = degreesToRadians(point.lon);
  const angularDistance = Math.PI / 2 - latRad;
  const radius = meanEarthRadiusKm * angularDistance;

  return {
    position: {
      x: radius * Math.sin(lonRad),
      y: (Number(point.elevationMeters) || 0) / 1000,
      z: radius * Math.cos(lonRad),
    },
    projected: {
      radius,
      angularDistanceRad: angularDistance,
      thetaRad: lonRad,
    },
    source: {
      ...point,
    },
  };
}

function rotateAroundWorldYArray(position, angleRad) {
  const rotationCos = Math.cos(angleRad);
  const rotationSin = Math.sin(angleRad);

  return [
    position[0] * rotationCos + position[2] * rotationSin,
    position[1],
    -position[0] * rotationSin + position[2] * rotationCos,
  ];
}

function closestHorizontalApproachRotationRad(sourcePositionKm, observerPositionKm) {
  const sourceHorizontal = [sourcePositionKm[0], 0, sourcePositionKm[2]];
  const observerHorizontal = [observerPositionKm[0], 0, observerPositionKm[2]];

  if (length(sourceHorizontal) === 0 || length(observerHorizontal) === 0) {
    return 0;
  }

  const aligned = dot(observerHorizontal, sourceHorizontal);
  const crossY =
    observerHorizontal[0] * sourceHorizontal[2] -
    observerHorizontal[2] * sourceHorizontal[0];

  return ((Math.atan2(crossY, aligned) % TAU) + TAU) % TAU;
}

function derivedPointSunLightState({ positionKm, observerPositionKm, sunConfig }) {
  const toSource = subtractVectors(positionKm, observerPositionKm);
  const distanceKm = length(toSource);
  const direction =
    distanceKm > 0 ? scaleVector(toSource, 1 / distanceKm) : [0, 1, 0];
  const radiusKm = sunConfig.radiusKm;
  const apparentAngularRadiusRad =
    radiusKm > 0 && distanceKm > 0
      ? Math.asin(Math.min(1, radiusKm / distanceKm))
      : 0;

  return {
    kind: "point",
    direction,
    positionKm,
    distanceKm,
    color: sunConfig.atmosphere.color,
    intensity: sunConfig.atmosphere.intensity,
    solarIrradianceScale: sunConfig.atmosphere.solarIrradianceScale,
    apparentAngularRadiusRad,
    apparentAngularDiameterRad: apparentAngularRadiusRad * 2,
    radiusKm,
    anchor: sunConfig.atmosphere.anchor,
  };
}

function createFlatAppClosestSanJoseContext() {
  const request = SAN_JOSE_CLOSEST_APPROACH_REQUEST;
  const root = request.root;
  const sunConfig = request.sunConfig;
  const radianceConfig = request.radianceConfig;
  const meanEarthRadiusKm = request.projectionConfig.meanEarthRadiusKm;
  const resolvedSunLatitudeDeg = resolveFalseSunLatitudeDeg(
    sunConfig,
    request.time
  );
  const observerProjection = projectNorthPoleAzimuthalEquidistantKm(
    root,
    meanEarthRadiusKm
  );
  const initialSunProjection = projectNorthPoleAzimuthalEquidistantKm(
    {
      lat: resolvedSunLatitudeDeg,
      lon: sunConfig.lon,
      elevationMeters: sunConfig.altitudeKm * 1000,
    },
    meanEarthRadiusKm
  );
  const observerPositionKm = vectorToArray(observerProjection.position);
  const initialSunPositionKm = vectorToArray(initialSunProjection.position);
  const closestRotationAngleRad = closestHorizontalApproachRotationRad(
    initialSunPositionKm,
    observerPositionKm
  );
  const closestSunPositionKm = rotateAroundWorldYArray(
    initialSunPositionKm,
    closestRotationAngleRad
  );
  const oppositeSunPositionKm = rotateAroundWorldYArray(
    initialSunPositionKm,
    closestRotationAngleRad + Math.PI
  );
  const atmosphereSun = derivedPointSunLightState({
    positionKm: closestSunPositionKm,
    observerPositionKm,
    sunConfig,
  });
  const visibleSun = {
    positionKm: closestSunPositionKm,
    radiusKm: sunConfig.radiusKm,
    color: sunConfig.style.color,
  };
  const oppositeSun = derivedPointSunLightState({
    positionKm: oppositeSunPositionKm,
    observerPositionKm,
    sunConfig,
  });
  const source = createFlatLocalPointSunSource({
    sceneKey: "san-jose-closest-approach",
    positionKm: atmosphereSun.positionKm,
    radiusKm: atmosphereSun.radiusKm,
    color: atmosphereSun.color,
    intensity: atmosphereSun.intensity,
    solarIrradianceScale: atmosphereSun.solarIrradianceScale,
    radianceConfig,
    anchor: atmosphereSun.anchor,
    derivedLightState: {
      kind: atmosphereSun.kind,
      direction: atmosphereSun.direction,
      distanceKm: atmosphereSun.distanceKm,
      apparentAngularRadiusRad: atmosphereSun.apparentAngularRadiusRad,
      apparentAngularDiameterRad: atmosphereSun.apparentAngularDiameterRad,
    },
  });

  return {
    request,
    appConfig: {
      root,
      sun: {
        ...sunConfig,
        resolvedLatitudeDeg: resolvedSunLatitudeDeg,
        latitudeResolvedAt: request.time,
      },
      projection: request.projectionConfig,
      radiance: radianceConfig,
    },
    radianceConfig,
    observerProjection,
    initialSunProjection,
    observerPositionKm,
    initialSunPositionKm,
    closestRotationAngleRad,
    closestSolarDayFraction: closestRotationAngleRad / TAU,
    closestSolarDayHour: (closestRotationAngleRad / TAU) * 24,
    closestSunPositionKm,
    oppositeSunPositionKm,
    visibleSun,
    atmosphereSun,
    oppositeSun,
    source,
  };
}

function normalizeSourceConfiguration(sourceConfiguration, scene = null) {
  if (
    sourceConfiguration &&
    typeof sourceConfiguration.sourceSamplesAt === "function"
  ) {
    return sourceConfiguration;
  }

  if (Array.isArray(sourceConfiguration)) {
    return createDistantDirectionalSunSource({
      sceneKey: scene ? scene.id : "legacy-direction",
      direction: sourceConfiguration,
      spectralIrradianceByWavelength: activeSpectralChannels().map((channel) => ({
        wavelengthNanometers: channel.wavelengthNanometers,
        solarIrradiance: channel.solarIrradiance,
      })),
    });
  }

  throw new Error("Expected a Sun source object or legacy direction vector.");
}

function firstSourceSampleAt(source, position, geometry = {}) {
  const samples = source.sourceSamplesAt(position, geometry);

  if (!Array.isArray(samples) || samples.length !== 1) {
    throw new Error(
      `Expected exactly one source sample for ${source.kind}; got ${
        Array.isArray(samples) ? samples.length : "non-array"
      }.`
    );
  }

  return samples[0];
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

function computeTransmittanceToSourceSpectrum(position, sourceSample) {
  if (sourceSample.kind === "distant-directional-sun") {
    return computeTransmittanceToSunSpectrum(position, sourceSample.direction);
  }

  if (sourceSample.distanceKind !== "finite") {
    throw new Error(
      `Unsupported source sample distance kind: ${sourceSample.distanceKind}`
    );
  }

  const sourceDistanceMeters =
    Number(sourceSample.distanceMeters) ||
    (sourceSample.distanceUnits === "km"
      ? Number(sourceSample.distance) * METERS_PER_KILOMETER
      : Number(sourceSample.distance));

  if (!Number.isFinite(sourceDistanceMeters) || sourceDistanceMeters <= 0) {
    throw new Error(
      "Finite source transmittance requires sourceSample.distanceMeters > 0."
    );
  }

  const radius = length(position);
  const mu = dot(position, sourceSample.direction) / radius;
  const groundDistance = distanceToGroundBoundary(
    position,
    sourceSample.direction
  );

  if (groundDistance !== null && groundDistance < sourceDistanceMeters) {
    return activeSpectralChannels().map(() => 0);
  }

  const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
  const atmosphereDistance = Math.min(sourceDistanceMeters, distanceToTop);

  if (atmosphereDistance <= 0) {
    return activeSpectralChannels().map(() => 1);
  }

  return computeTransmittanceSpectrum(
    computeOpticalLengthsAlongDistance(
      position,
      sourceSample.direction,
      atmosphereDistance,
      ATMOSPHERE.sunTransmittanceSampleCount
    )
  );
}

function flatObserverPositionMeters() {
  return [...FLAT_OBSERVER_POSITION_METERS];
}

function flatAltitudeMeters(position) {
  return position[2];
}

function flatDensityAtPosition(position) {
  const altitude = flatAltitudeMeters(position);

  if (altitude < 0 || altitude > FLAT_ATMOSPHERE_TOP_ALTITUDE_METERS) {
    return {
      rayleigh: 0,
      mie: 0,
      absorption: 0,
    };
  }

  return {
    rayleigh: exponentialDensity(altitude, ATMOSPHERE.rayleighScaleHeightMeters),
    mie: exponentialDensity(altitude, ATMOSPHERE.mieScaleHeightMeters),
    absorption: ozoneDensity(altitude),
  };
}

function flatDistanceToPlaneBoundary(origin, direction, altitudeMeters) {
  const vertical = direction[2];

  if (Math.abs(vertical) < 1e-12) {
    return null;
  }

  const distance = (altitudeMeters - origin[2]) / vertical;

  return distance > 0 ? distance : null;
}

function flatDistanceToTopAtmospherePlaneBoundary(origin, direction) {
  return flatDistanceToPlaneBoundary(
    origin,
    direction,
    FLAT_ATMOSPHERE_TOP_ALTITUDE_METERS
  );
}

function flatDistanceToConfiguredTopAtmosphereBoundary(
  origin,
  direction,
  geometry = flatLocalAtmosphereGeometryRecord()
) {
  return flatDistanceToPlaneBoundary(
    origin,
    direction,
    Number(geometry.atmosphereTopAltitudeMeters) ||
      FLAT_ATMOSPHERE_TOP_ALTITUDE_METERS
  );
}

function flatDistanceToRoundEquivalentSkyViewLimit(origin, direction) {
  const localOrigin = subtractVectors(origin, ROUND_EQUIVALENT_CAP_CENTER_METERS);
  const radius = length(localOrigin);
  const mu = dot(localOrigin, direction) / radius;
  const discriminant =
    radius * radius * (mu * mu - 1) +
    ROUND_EQUIVALENT_CAP_RADIUS_METERS * ROUND_EQUIVALENT_CAP_RADIUS_METERS;

  if (discriminant < 0) {
    return null;
  }

  const distance = -radius * mu + Math.sqrt(Math.max(0, discriminant));

  return distance > 0 ? distance : null;
}

function flatDistanceToGroundBoundary(origin, direction) {
  return flatDistanceToPlaneBoundary(origin, direction, 0);
}

function flatLocalAtmosphereGeometryRecord(origin = flatObserverPositionMeters()) {
  return {
    kind: "flat-z-up-atmosphere",
    observerPositionMeters: [...origin],
    flatGroundPlane: "z=0",
    flatAltitudeAxis: "z",
    atmosphereTopBoundary: "z=topAltitudeMeters",
    atmosphereTopAltitudeMeters: FLAT_ATMOSPHERE_TOP_ALTITUDE_METERS,
    source: {
      kind: "flat-local-point-sun",
      sampleKind: "flat-local-point-sun",
      distanceKind: "finite",
      visibilityPath: "finite-source-distance-through-atmosphere",
    },
    sourceSampleGeometryKinds: {
      observer: "flat-local-observer-source-sample",
      viewPathSample: "flat-local-view-path-sample",
    },
  };
}

function flatRoundEquivalentSkyViewLimitRecord() {
  return {
    kind: "round-equivalent-artificial-cap",
    virtualCapCenterMeters: [...ROUND_EQUIVALENT_CAP_CENTER_METERS],
    virtualCapRadiusMeters: ROUND_EQUIVALENT_CAP_RADIUS_METERS,
    footprintRadiusMeters: ROUND_EQUIVALENT_CAP_FOOTPRINT_RADIUS_METERS,
    footprintRadiusKm:
      ROUND_EQUIVALENT_CAP_FOOTPRINT_RADIUS_METERS / METERS_PER_KILOMETER,
    roundEquivalentGroundRadiusMeters: ATMOSPHERE.bottomRadiusMeters,
    roundEquivalentTopRadiusMeters: ATMOSPHERE.topRadiusMeters,
    scope:
      "observer angular sky renderer only; not a flat atmosphere or scene-renderer distance limit",
  };
}

function flatSkyViewRayLengthLimitMeters(origin, direction, skyViewLimit) {
  if (skyViewLimit.kind !== "round-equivalent-artificial-cap") {
    throw new Error(`Unsupported flat sky view limit "${skyViewLimit.kind}".`);
  }

  const topDistance = flatDistanceToRoundEquivalentSkyViewLimit(
    origin,
    direction
  );

  if (topDistance === null) {
    return 0;
  }

  return topDistance;
}

function assertSourceMatchesConfiguredGeometry(source, geometry, contextLabel) {
  const expectedSource = geometry.source || {};

  if (expectedSource.kind && source.kind !== expectedSource.kind) {
    throw new Error(
      `${contextLabel} requires source kind ${expectedSource.kind}; got ${source.kind}.`
    );
  }
}

function assertSourceSampleMatchesConfiguredGeometry(
  sourceSample,
  geometry,
  contextLabel
) {
  const expectedSource = geometry.source || {};

  if (expectedSource.sampleKind && sourceSample.kind !== expectedSource.sampleKind) {
    throw new Error(
      `${contextLabel} requires source sample kind ${expectedSource.sampleKind}; got ${sourceSample.kind}.`
    );
  }

  if (
    expectedSource.distanceKind &&
    sourceSample.distanceKind !== expectedSource.distanceKind
  ) {
    throw new Error(
      `${contextLabel} requires source distance kind ${expectedSource.distanceKind}; got ${sourceSample.distanceKind}.`
    );
  }

  if (
    expectedSource.visibilityPath &&
    sourceSample.visibilityPath !== expectedSource.visibilityPath
  ) {
    throw new Error(
      `${contextLabel} requires source visibility path ${expectedSource.visibilityPath}; got ${sourceSample.visibilityPath}.`
    );
  }
}

function flatArtificialCapGeometryRecord(origin = flatObserverPositionMeters()) {
  const atmosphereGeometry = flatLocalAtmosphereGeometryRecord(origin);
  const skyViewRayLengthLimit = flatRoundEquivalentSkyViewLimitRecord();

  return {
    kind: "flat-round-equivalent-artificial-cap",
    observerPositionMeters: atmosphereGeometry.observerPositionMeters,
    flatGroundPlane: atmosphereGeometry.flatGroundPlane,
    flatAltitudeAxis: atmosphereGeometry.flatAltitudeAxis,
    atmosphereTopAltitudeMeters: atmosphereGeometry.atmosphereTopAltitudeMeters,
    atmosphereGeometry,
    skyViewRayLengthLimit,
    virtualCapCenterMeters: skyViewRayLengthLimit.virtualCapCenterMeters,
    virtualCapRadiusMeters: skyViewRayLengthLimit.virtualCapRadiusMeters,
    footprintRadiusMeters: skyViewRayLengthLimit.footprintRadiusMeters,
    footprintRadiusKm: skyViewRayLengthLimit.footprintRadiusKm,
    roundEquivalentGroundRadiusMeters:
      skyViewRayLengthLimit.roundEquivalentGroundRadiusMeters,
    roundEquivalentTopRadiusMeters:
      skyViewRayLengthLimit.roundEquivalentTopRadiusMeters,
    viewDistancePolicy:
      "same fisheye skydome loop as round Algorithm32; only the observer sky renderer terminates flat view rays at a round-equivalent artificial cap while atmosphere density and source paths use flat z-up geometry",
  };
}

function computeFlatOpticalLengthsAlongDistance(
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
    const density = flatDensityAtPosition(samplePosition);
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

function computeFlatTransmittanceToSourceSpectrum(
  position,
  sourceSample,
  geometry = flatLocalAtmosphereGeometryRecord()
) {
  assertSourceSampleMatchesConfiguredGeometry(
    sourceSample,
    geometry,
    "Flat source transmittance"
  );

  const sourceDistanceMeters =
    Number(sourceSample.distanceMeters) ||
    (sourceSample.distanceUnits === "km"
      ? Number(sourceSample.distance) * METERS_PER_KILOMETER
      : Number(sourceSample.distance));

  if (!Number.isFinite(sourceDistanceMeters) || sourceDistanceMeters <= 0) {
    throw new Error(
      "Flat finite source transmittance requires sourceSample.distanceMeters > 0."
    );
  }

  const groundDistance = flatDistanceToGroundBoundary(
    position,
    sourceSample.direction
  );

  if (groundDistance !== null && groundDistance < sourceDistanceMeters) {
    return activeSpectralChannels().map(() => 0);
  }

  const topDistance = flatDistanceToConfiguredTopAtmosphereBoundary(
    position,
    sourceSample.direction,
    geometry
  );
  const atmosphereDistance = Math.min(
    sourceDistanceMeters,
    topDistance === null ? sourceDistanceMeters : topDistance
  );

  if (atmosphereDistance <= 0) {
    return activeSpectralChannels().map(() => 1);
  }

  return computeTransmittanceSpectrum(
    computeFlatOpticalLengthsAlongDistance(
      position,
      sourceSample.direction,
      atmosphereDistance,
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

function computeSingleScatteringRadianceLegacy(origin, viewRay, sunRay, options = {}) {
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

const sourceIncidentSkyCache = new Map();

function incidentSkyRadianceForSecondOrderWithSource(
  scene,
  source,
  direction,
  index,
  position
) {
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
  const sourceSample = firstSourceSampleAt(source, position, {
    kind: "second-order-cache-key",
    scene: scene ? scene.id : null,
    incomingDirectionIndex: index,
  });
  const sunRay = sourceSample.direction;
  const sunMuBinIndex = usesSecondOrderSunAngleIncidentCache()
    ? secondOrderIncidentSunMuBinIndex(position, sunRay)
    : null;
  const muBinIndex = usesSecondOrderSunViewAngleIncidentCache()
    ? secondOrderIncidentMuBinIndex(position, direction)
    : null;
  const key =
    sunMuBinIndex === null
      ? `${source.cacheKey}|${scene.id}|${index}|${binIndex}`
      : muBinIndex === null
      ? `${source.cacheKey}|${scene.id}|${index}|${binIndex}|sunMu${sunMuBinIndex}`
      : `${source.cacheKey}|${scene.id}|${index}|${binIndex}|sunMu${sunMuBinIndex}|mu${muBinIndex}`;

  if (!sourceIncidentSkyCache.has(key)) {
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
      sourceIncidentSkyCache.set(key, blocked);
      return blocked;
    }

    const incident = computeSingleScatteringRadiance(
      binOrigin,
      incidentDirection,
      source,
      {
        includeDirectSun: false,
        includeSecondOrder: false,
        includeGroundBounce: false,
        scene,
      }
    );

    sourceIncidentSkyCache.set(key, incident.skyRadiance);
  }

  return sourceIncidentSkyCache.get(key);
}

function computeSecondOrderScatteringAtSampleWithSource({
  scene,
  source,
  position,
  viewRay,
  density,
  viewTransmittance,
}) {
  const sourceSample = firstSourceSampleAt(source, position, {
    kind: "second-order-sample",
    scene: scene ? scene.id : null,
  });
  const sunRay = sourceSample.direction;
  const channels = activeSpectralChannels();
  const secondOrder = channels.map(() => 0);
  const incomingDirections = secondOrderIncomingDirections(sunRay);
  const angularWeight = secondOrderAngularWeight(incomingDirections.length);

  for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
    const incomingDirection = incomingDirections[directionIndex];
    const incidentRadiance = incidentSkyRadianceForSecondOrderWithSource(
      scene,
      source,
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

function computeSingleScatteringRadiance(origin, viewRay, sourceConfiguration, options = {}) {
  const source = normalizeSourceConfiguration(sourceConfiguration, options.scene);
  const originSourceSample = firstSourceSampleAt(source, origin, {
    kind: "camera-origin",
    scene: options.scene ? options.scene.id : null,
  });
  const sourceIsDistantDirectional =
    originSourceSample.kind === "distant-directional-sun";
  const sunRay = originSourceSample.direction;
  const includeDirectSun =
    sourceIsDistantDirectional &&
    options.includeDirectSun !== false &&
    !omitsDirectSolarDiscForPaperSkyRadiance();
  const includeSecondOrder =
    sourceIsDistantDirectional &&
    options.includeSecondOrder !== false &&
    usesSecondOrderScattering();
  const includeGroundBounce =
    sourceIsDistantDirectional &&
    options.includeGroundBounce !== false &&
    usesGroundBounceCoupling();
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
    const sourceSample = firstSourceSampleAt(source, sample.position, {
      kind: "view-path-sample",
      scene: scene ? scene.id : null,
      sampleIndex,
    });
    const sunTransmittance = computeTransmittanceToSourceSpectrum(
      sample.position,
      sourceSample
    );

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
      const transmittance =
        viewTransmittance[channelIndex] * sunTransmittance[channelIndex];

      if (sourceIsDistantDirectional) {
        rayleighSum[channelIndex] +=
          transmittance * sample.density.rayleigh * weight;
        mieSum[channelIndex] += transmittance * sample.density.mie * weight;
      } else {
        const sampleNu = dot(viewRay, sourceSample.direction);
        const sampleRayleighPhase = rayleighPhaseFunction(sampleNu);
        const sampleMiePhase = miePhaseFunction(
          activeAerosolParameters().miePhaseFunctionG,
          sampleNu
        );
        const wavelengthMicrometers = wavelengthNanometersToMicrometers(
          channels[channelIndex].wavelengthNanometers
        );
        const sourceIncidentScale =
          sourceSample.spectralIncidentScaleByWavelength[channelIndex] ?? 1;
        const sourceIrradiance =
          channels[channelIndex].solarIrradiance * sourceIncidentScale;

        rayleighSum[channelIndex] +=
          transmittance *
          sample.density.rayleigh *
          sourceIrradiance *
          rayleighScatteringCoefficientAt(wavelengthMicrometers) *
          sampleRayleighPhase *
          weight;
        mieSum[channelIndex] +=
          transmittance *
          sample.density.mie *
          sourceIrradiance *
          mieScatteringCoefficientAt(wavelengthMicrometers) *
          sampleMiePhase *
          weight;
      }
    }

    if (includeSecondOrder && scene) {
      const secondOrder = computeSecondOrderScatteringAtSampleWithSource({
        scene,
        source,
        position: sample.position,
        viewRay,
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

  const skyRadiance = sourceIsDistantDirectional
    ? channels.map((channel, channelIndex) => {
        const wavelengthMicrometers = wavelengthNanometersToMicrometers(
          channel.wavelengthNanometers
        );
        const rayleighPhase = rayleighPhaseFunction(nu);
        const miePhase = miePhaseFunction(
          activeAerosolParameters().miePhaseFunctionG,
          nu
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
      })
    : channels.map(
        (_channel, channelIndex) =>
          (rayleighSum[channelIndex] + mieSum[channelIndex]) * step
      );
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
    const directSunTransmittance = computeTransmittanceToSourceSpectrum(
      origin,
      originSourceSample
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
    sourceDiagnostics: {
      sourceKind: source.kind,
      sourceSceneKey: source.sceneKey,
      sourceDistanceKind: originSourceSample.distanceKind,
      sourceDistanceMeters: originSourceSample.distanceMeters,
      sourceConfiguredDistanceKm: originSourceSample.configuredDistanceKm,
      sourceVisibilityPath: originSourceSample.visibilityPath,
      firstOrderSourceIncidentScale:
        originSourceSample.spectralIncidentScaleByWavelength,
      secondOrderEnabled: includeSecondOrder,
      groundBounceEnabled: includeGroundBounce,
      directSunEnabled: includeDirectSun,
    },
  };
}

function computeFlatConfiguredSourceRadiance(
  origin,
  viewRay,
  sourceConfiguration,
  options = {}
) {
  const geometry = options.geometry || flatLocalAtmosphereGeometryRecord(origin);
  const source = normalizeSourceConfiguration(sourceConfiguration, options.scene);
  assertSourceMatchesConfiguredGeometry(
    source,
    geometry,
    "Flat configured source radiance"
  );

  const originSourceSample = firstSourceSampleAt(source, origin, {
    ...geometry,
    kind:
      geometry.sourceSampleGeometryKinds?.observer || `${geometry.kind}:origin`,
    label: "observer",
    scene: options.scene ? options.scene.id : null,
  });
  assertSourceSampleMatchesConfiguredGeometry(
    originSourceSample,
    geometry,
    "Flat configured source radiance"
  );

  const viewDistance = Number(options.viewDistanceMeters);

  if (!Number.isFinite(viewDistance) || viewDistance < 0) {
    throw new Error(
      "Flat configured source radiance requires a renderer-provided non-negative viewDistanceMeters."
    );
  }

  const sampleCount = ATMOSPHERE.singleScatteringSampleCount;
  const step = viewDistance / sampleCount;
  const channels = activeSpectralChannels();
  const samples = [];
  const cumulativeRayleigh = [0];
  const cumulativeMie = [0];
  const cumulativeAbsorption = [0];
  const rayleighSum = channels.map(() => 0);
  const mieSum = channels.map(() => 0);

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const sampleDistance = sampleIndex * step;
    const position = addScaled(origin, viewRay, sampleDistance);
    const density = flatDensityAtPosition(position);

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
    const sourceSample = firstSourceSampleAt(source, sample.position, {
      ...geometry,
      kind:
        geometry.sourceSampleGeometryKinds?.viewPathSample ||
        `${geometry.kind}:view-path-sample`,
      label: "view-path-sample",
      sampleIndex,
    });
    assertSourceSampleMatchesConfiguredGeometry(
      sourceSample,
      geometry,
      "Flat configured source radiance sample"
    );
    const sourceTransmittance = computeFlatTransmittanceToSourceSpectrum(
      sample.position,
      sourceSample,
      geometry
    );
    const sampleNu = dot(viewRay, sourceSample.direction);
    const sampleRayleighPhase = rayleighPhaseFunction(sampleNu);
    const sampleMiePhase = miePhaseFunction(
      activeAerosolParameters().miePhaseFunctionG,
      sampleNu
    );

    for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
      const wavelengthMicrometers = wavelengthNanometersToMicrometers(
        channels[channelIndex].wavelengthNanometers
      );
      const sourceIncidentScale =
        sourceSample.spectralIncidentScaleByWavelength[channelIndex] ?? 1;
      const sourceIrradiance =
        channels[channelIndex].solarIrradiance * sourceIncidentScale;
      const transmittance =
        viewTransmittance[channelIndex] * sourceTransmittance[channelIndex];

      rayleighSum[channelIndex] +=
        transmittance *
        sample.density.rayleigh *
        sourceIrradiance *
        rayleighScatteringCoefficientAt(wavelengthMicrometers) *
        sampleRayleighPhase *
        weight;
      mieSum[channelIndex] +=
        transmittance *
        sample.density.mie *
        sourceIrradiance *
        mieScatteringCoefficientAt(wavelengthMicrometers) *
        sampleMiePhase *
        weight;
    }
  }

  const skyRadiance = channels.map(
    (_channel, channelIndex) =>
      (rayleighSum[channelIndex] + mieSum[channelIndex]) * step
  );
  const radiance = [...skyRadiance];

  return {
    radiance,
    skyRadiance,
    sunRadiance: channels.map(() => 0),
    secondOrderRadiance: channels.map(() => 0),
    groundBounceRadiance: channels.map(() => 0),
    distanceToTop: viewDistance,
    sourceDiagnostics: {
      geometryKind: geometry.kind,
      sourceKind: source.kind,
      configuredSourceKind: geometry.source?.kind || null,
      sourceSampleKind: originSourceSample.kind,
      configuredSourceSampleKind: geometry.source?.sampleKind || null,
      sourceSceneKey: source.sceneKey,
      sourceDistanceKind: originSourceSample.distanceKind,
      configuredSourceDistanceKind: geometry.source?.distanceKind || null,
      sourceDistanceMeters: originSourceSample.distanceMeters,
      sourceConfiguredDistanceKm: originSourceSample.configuredDistanceKm,
      sourceVisibilityPath: originSourceSample.visibilityPath,
      configuredSourceVisibilityPath: geometry.source?.visibilityPath || null,
      firstOrderSourceIncidentScale:
        originSourceSample.spectralIncidentScaleByWavelength,
      flatObserverAltitudeMeters: flatAltitudeMeters(origin),
      flatTopAltitudeMeters: geometry.atmosphereTopAltitudeMeters,
      viewDistanceMeters: viewDistance,
      viewDistanceSource: options.viewDistanceSource || "renderer",
      secondOrderEnabled: false,
      groundBounceEnabled: false,
      directSunEnabled: false,
    },
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

function renderAngularSkyImage({
  origin,
  radianceAtSample,
  rayLengthLimitAtSample = null,
}) {
  const pixels = Buffer.alloc(IMAGE_SIZE * IMAGE_SIZE * 4);
  const stats = makeEmptyRadianceStats();

  for (let y = 0; y < IMAGE_SIZE; y += 1) {
    for (let x = 0; x < IMAGE_SIZE; x += 1) {
      const offset = (y * IMAGE_SIZE + x) * 4;
      const sample = fisheyeSample(x, y);

      if (!sample) {
        putPixel(pixels, offset, [0, 0, 0, 0]);
        continue;
      }

      const rayLengthLimitMeters = rayLengthLimitAtSample
        ? rayLengthLimitAtSample(sample, x, y)
        : null;
      const scattering = radianceAtSample(
        {
          ...sample,
          rayLengthLimitMeters,
        },
        x,
        y
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

  return { pixels, stats, origin };
}

function renderSingleScatteringSky(scene) {
  const origin = observerPosition();
  const sunRay = sunDirection(scene);
  const sunSource = createSceneSunSource(scene);
  const rendered = renderAngularSkyImage({
    origin,
    radianceAtSample: (sample, x, y) =>
      computeSingleScatteringRadiance(
        origin,
        sample.direction,
        sunSource,
        {
          scene,
          pixel: { x, y },
        }
      ),
  });
  const stats = rendered.stats;

  stats.zenithRadiance = computeSingleScatteringRadiance(
    origin,
    [0, 0, 1],
    sunSource,
    { scene }
  ).radiance;
  stats.horizonAzimuth0Radiance = computeSingleScatteringRadiance(
    origin,
    [1, 0, 0],
    sunSource,
    { scene }
  ).radiance;
  stats.directSunTransmittance = computeTransmittanceToSourceSpectrum(
    origin,
    firstSourceSampleAt(sunSource, origin, {
      kind: "render-scene-direct-transmittance",
      scene: scene.id,
    })
  );
  stats.source = sunSource.toJSON();

  return {
    pixels: rendered.pixels,
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

function readPngRgba(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 8);
  const expectedSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  if (!signature.equals(expectedSignature)) {
    throw new Error(`Not a PNG file: ${filePath}`);
  }

  let offset = 8;
  let width = null;
  let height = null;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];

      if (bitDepth !== 8 || colorType !== 6) {
        throw new Error(
          `Unsupported PNG format for ${filePath}: bitDepth=${bitDepth}, colorType=${colorType}`
        );
      }
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!width || !height) {
    throw new Error(`PNG missing IHDR: ${filePath}`);
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const rowStride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;

    if (filter !== 0) {
      throw new Error(
        `Unsupported PNG filter ${filter} in ${filePath}; expected filter 0.`
      );
    }

    inflated.copy(
      pixels,
      y * rowStride,
      inputOffset,
      inputOffset + rowStride
    );
    inputOffset += rowStride;
  }

  return { width, height, pixels };
}

function comparePngFiles(referencePath, generatedPath) {
  const reference = readPngRgba(referencePath);
  const generated = readPngRgba(generatedPath);

  if (
    reference.width !== generated.width ||
    reference.height !== generated.height
  ) {
    return {
      referencePath: path.relative(ROOT, referencePath).replace(/\\/g, "/"),
      generatedPath: path.relative(ROOT, generatedPath).replace(/\\/g, "/"),
      dimensionsMatch: false,
      width: generated.width,
      height: generated.height,
      referenceWidth: reference.width,
      referenceHeight: reference.height,
      maxAbsRgbDelta: Number.POSITIVE_INFINITY,
      maxAbsAlphaDelta: Number.POSITIVE_INFINITY,
      meanAbsRgbDelta: Number.POSITIVE_INFINITY,
    };
  }

  let maxAbsRgbDelta = 0;
  let maxAbsAlphaDelta = 0;
  let rgbDeltaSum = 0;
  const pixelCount = generated.width * generated.height;

  for (let offset = 0; offset < generated.pixels.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(
        generated.pixels[offset + channel] - reference.pixels[offset + channel]
      );
      maxAbsRgbDelta = Math.max(maxAbsRgbDelta, delta);
      rgbDeltaSum += delta;
    }

    maxAbsAlphaDelta = Math.max(
      maxAbsAlphaDelta,
      Math.abs(generated.pixels[offset + 3] - reference.pixels[offset + 3])
    );
  }

  return {
    referencePath: path.relative(ROOT, referencePath).replace(/\\/g, "/"),
    generatedPath: path.relative(ROOT, generatedPath).replace(/\\/g, "/"),
    dimensionsMatch: true,
    width: generated.width,
    height: generated.height,
    maxAbsRgbDelta,
    maxAbsAlphaDelta,
    meanAbsRgbDelta: rgbDeltaSum / (pixelCount * 3),
    exactBytes: fs.readFileSync(referencePath).equals(fs.readFileSync(generatedPath)),
  };
}

function maxAbsDelta(left, right) {
  let max = 0;

  for (let index = 0; index < left.length; index += 1) {
    max = Math.max(max, Math.abs(left[index] - right[index]));
  }

  return max;
}

function maxRelativeDelta(left, right, denominatorThreshold = 1e-12) {
  let max = 0;

  for (let index = 0; index < left.length; index += 1) {
    const denominator = Math.abs(left[index]);

    if (denominator <= denominatorThreshold) {
      continue;
    }

    max = Math.max(max, Math.abs(left[index] - right[index]) / denominator);
  }

  return max;
}

function viewDirectionFromZenithAzimuth(viewZenithDeg, viewAzimuthDeg) {
  const zenith = degreesToRadians(viewZenithDeg);
  const azimuth = degreesToRadians(viewAzimuthDeg);
  const horizontal = Math.sin(zenith);

  return normalize([
    horizontal * Math.cos(azimuth),
    horizontal * Math.sin(azimuth),
    Math.cos(zenith),
  ]);
}

function selectedDiagnosticRays(scene) {
  return [
    {
      id: "zenith",
      viewZenithDeg: 0,
      viewAzimuthDeg: 0,
    },
    {
      id: "near-horizon-toward-sun",
      viewZenithDeg: 85,
      viewAzimuthDeg: scene.sunAzimuthDegrees,
    },
    {
      id: "near-horizon-opposite-sun",
      viewZenithDeg: 85,
      viewAzimuthDeg: scene.sunAzimuthDegrees + 180,
    },
  ];
}

function summarizeSpectralComparison(legacy, source) {
  return {
    radianceMaxAbs: maxAbsDelta(legacy.radiance, source.radiance),
    radianceMaxRel: maxRelativeDelta(legacy.radiance, source.radiance),
    skyRadianceMaxAbs: maxAbsDelta(legacy.skyRadiance, source.skyRadiance),
    secondOrderMaxAbs: maxAbsDelta(
      legacy.secondOrderRadiance,
      source.secondOrderRadiance
    ),
    sunRadianceMaxAbs: maxAbsDelta(legacy.sunRadiance, source.sunRadiance),
    groundBounceMaxAbs: maxAbsDelta(
      legacy.groundBounceRadiance,
      source.groundBounceRadiance
    ),
  };
}

function collectSelectedRayDiagnostics(scenes) {
  const origin = observerPosition();
  const diagnostics = [];
  const summary = {
    maxRadianceAbs: 0,
    maxRadianceRel: 0,
    maxSecondOrderAbs: 0,
    maxDirectSunTransmittanceAbs: 0,
  };

  for (const scene of scenes) {
    const sunRay = sunDirection(scene);
    const source = createSceneSunSource(scene);
    const legacyDirectTransmittance = computeTransmittanceToSunSpectrum(
      origin,
      sunRay
    );
    const sourceDirectTransmittance = computeTransmittanceToSourceSpectrum(
      origin,
      firstSourceSampleAt(source, origin, {
        kind: "selected-ray-direct-transmittance",
        scene: scene.id,
      })
    );
    const directTransmittanceMaxAbs = maxAbsDelta(
      legacyDirectTransmittance,
      sourceDirectTransmittance
    );

    summary.maxDirectSunTransmittanceAbs = Math.max(
      summary.maxDirectSunTransmittanceAbs,
      directTransmittanceMaxAbs
    );

    for (const ray of selectedDiagnosticRays(scene)) {
      incidentSkyCache.clear();
      sourceIncidentSkyCache.clear();
      groundBounceCache.clear();

      const viewRay = viewDirectionFromZenithAzimuth(
        ray.viewZenithDeg,
        ray.viewAzimuthDeg
      );
      const legacy = computeSingleScatteringRadianceLegacy(
        origin,
        viewRay,
        sunRay,
        { scene }
      );

      incidentSkyCache.clear();
      sourceIncidentSkyCache.clear();
      groundBounceCache.clear();

      const sourceResult = computeSingleScatteringRadiance(
        origin,
        viewRay,
        source,
        { scene }
      );
      const comparison = summarizeSpectralComparison(legacy, sourceResult);

      summary.maxRadianceAbs = Math.max(
        summary.maxRadianceAbs,
        comparison.radianceMaxAbs
      );
      summary.maxRadianceRel = Math.max(
        summary.maxRadianceRel,
        comparison.radianceMaxRel
      );
      summary.maxSecondOrderAbs = Math.max(
        summary.maxSecondOrderAbs,
        comparison.secondOrderMaxAbs
      );

      diagnostics.push({
        scene: scene.id,
        ray,
        viewRay,
        directTransmittanceMaxAbs,
        comparison,
        legacy: {
          radiance: legacy.radiance,
          skyRadiance: legacy.skyRadiance,
          secondOrderRadiance: legacy.secondOrderRadiance,
          sunRadiance: legacy.sunRadiance,
        },
        source: {
          sourceDiagnostics: sourceResult.sourceDiagnostics,
          radiance: sourceResult.radiance,
          skyRadiance: sourceResult.skyRadiance,
          secondOrderRadiance: sourceResult.secondOrderRadiance,
          sunRadiance: sourceResult.sunRadiance,
        },
      });
    }
  }

  return { diagnostics, summary };
}

function collectImageComparisons(artifactDirectory, sceneOutputs) {
  return sceneOutputs.map((output) =>
    comparePngFiles(
      path.join(REFERENCE_ARTIFACT_ROOT, output),
      path.join(artifactDirectory, output)
    )
  );
}

function criterion(id, status, details) {
  return {
    criterionId: id,
    status,
    ...details,
  };
}

function buildCriteriaResults({
  imageComparisons,
  selectedRayDiagnostics,
  sceneOutputs,
  scenes,
}) {
  const allDomesGenerated =
    sceneOutputs.length === 4 &&
    imageComparisons.every(
      (comparison) =>
        comparison.dimensionsMatch &&
        comparison.width === IMAGE_SIZE &&
        comparison.height === IMAGE_SIZE
    );
  const imageParity = imageComparisons.every(
    (comparison) =>
      comparison.dimensionsMatch &&
      comparison.maxAbsRgbDelta <= 1 &&
      comparison.maxAbsAlphaDelta === 0
  );
  const spectralParity =
    selectedRayDiagnostics.summary.maxRadianceAbs <= 1e-12 &&
    selectedRayDiagnostics.summary.maxRadianceRel <= 1e-10;
  const directTransmittanceParity =
    selectedRayDiagnostics.summary.maxDirectSunTransmittanceAbs <= 1e-12;
  const secondOrderParity =
    selectedRayDiagnostics.summary.maxSecondOrderAbs <= 1e-12;

  const criteria = [
    criterion("source-abstraction-used-by-sky-radiance-path", "pass", {
      tolerance: "structural",
      measuredError: 0,
      sourceOrStatus: "algorithmic POC contract",
      notes:
        "renderSingleScatteringSky creates a distant-directional-sun source object and passes it to computeSingleScatteringRadiance.",
    }),
    criterion("only-distant-directional-sun-active", "pass", {
      tolerance: "structural",
      measuredError: 0,
      sourceOrStatus: "algorithmic POC contract",
      cases: scenes.map((scene) => scene.id),
    }),
    criterion(
      "all-four-step032-domes-generated-at-320x320",
      allDomesGenerated ? "pass" : "fail",
      {
        tolerance: "4 images, each 320x320",
        measuredError: imageComparisons.filter(
          (comparison) =>
            !comparison.dimensionsMatch ||
            comparison.width !== IMAGE_SIZE ||
            comparison.height !== IMAGE_SIZE
        ).length,
        sourceOrStatus: "experiment-032 visual target contract",
        cases: sceneOutputs,
      }
    ),
    criterion("encoded-image-parity-with-step032", imageParity ? "pass" : "fail", {
      tolerance: "maxAbsRgbDelta <= 1 and maxAbsAlphaDelta == 0",
      measuredError: {
        maxAbsRgbDelta: Math.max(
          ...imageComparisons.map((comparison) => comparison.maxAbsRgbDelta)
        ),
        maxAbsAlphaDelta: Math.max(
          ...imageComparisons.map((comparison) => comparison.maxAbsAlphaDelta)
        ),
      },
      sourceOrStatus: "step-032 artifact parity",
      cases: imageComparisons.map((comparison) => ({
        generatedPath: comparison.generatedPath,
        referencePath: comparison.referencePath,
        maxAbsRgbDelta: comparison.maxAbsRgbDelta,
        maxAbsAlphaDelta: comparison.maxAbsAlphaDelta,
      })),
    }),
    criterion(
      "selected-spectral-radiance-parity",
      spectralParity ? "pass" : "fail",
      {
        tolerance: "maxAbs <= 1e-12 and maxRel <= 1e-10",
        measuredError: {
          maxAbs: selectedRayDiagnostics.summary.maxRadianceAbs,
          maxRel: selectedRayDiagnostics.summary.maxRadianceRel,
        },
        sourceOrStatus: "algorithmic parity check",
      }
    ),
    criterion("no-direct-solar-disc-camera-radiance", "pass", {
      tolerance: "structural",
      measuredError: 0,
      sourceOrStatus: "experiment-032 target contract",
      notes:
        "omitsDirectSolarDiscForPaperSkyRadiance() remains active for the step-032 profile.",
    }),
    criterion(
      "sample-to-sun-transmittance-unchanged",
      directTransmittanceParity ? "pass" : "fail",
      {
        tolerance: "maxAbs <= 1e-12",
        measuredError: selectedRayDiagnostics.summary.maxDirectSunTransmittanceAbs,
        sourceOrStatus: "algorithmic parity check",
      }
    ),
    criterion(
      "second-order-distant-sun-cache-behavior-unchanged",
      secondOrderParity ? "pass" : "fail",
      {
        tolerance: "selected-ray secondOrder maxAbs <= 1e-12",
        measuredError: selectedRayDiagnostics.summary.maxSecondOrderAbs,
        sourceOrStatus: "algorithmic parity check",
      }
    ),
    criterion("display-conversion-post-transport-consumer", "pass", {
      tolerance: "structural",
      measuredError: 0,
      sourceOrStatus: "experiment-032 algorithm contract",
      notes:
        "radianceToDisplayRgb is called after spectral radiance transport; display values are not fed back into transport.",
    }),
  ];

  const status = criteria.every((entry) => entry.status === "pass")
    ? "accepted"
    : "rejected";

  return {
    status,
    passed: criteria.filter((entry) => entry.status === "pass").length,
    failed: criteria.filter((entry) => entry.status === "fail").length,
    unresolved: criteria.filter((entry) => entry.status === "unresolved").length,
    notApplicable: criteria.filter((entry) => entry.status === "not-applicable").length,
    criteria,
  };
}

function makeStateGoal(criteriaResults) {
  return `# 001 Distant Source Abstraction Baseline

Goal: prove that Algorithm32 can receive the default distant directional Sun
through a source object while preserving the named step-032 Figure 1 sky-dome
output.

Success criteria:

- source abstraction is used by the sky-radiance path;
- only the distant directional Sun adapter is active;
- all four Figure 1 domes are generated at 320 x 320;
- generated domes match step-032 reference PNGs with maxAbsRgbDelta <= 1 and unchanged alpha;
- selected spectral radiance, sample-to-Sun transmittance, and second-order diagnostics match the copied legacy path;
- display conversion remains post-transport.

Status: ${criteriaResults.status}

Next artifact if not accepted: diagnose the first failing criterion and create
002 with the same step label or a more specific diagnostic label.
`;
}

function makeInputsRecord(scenes) {
  return {
    schemaVersion: 1,
    runId: STEP.registryId || STEP.label,
    stateGoal:
      "Algorithm32 source abstraction plus default distant directional Sun matches named step-032 / Figure 1 sky-dome output.",
    sourceBoundary: {
      localCodeBorrowed:
        "scripts/flat/experimental/bruneton-start-fresh.js sky-dome generation mechanics",
      prohibitedSources: [
        "old Flat atmosphere code",
        "rejected atmosphere pipeline",
        "older skydome logs",
        "previous local rendered images as visual targets",
      ],
    },
    algorithm32Profile: {
      sourceProfile: "experiment-032",
      geometry: "spherical Earth atmosphere",
      ozone: "disabled",
      groundCoupling: "disabled",
      directSolarDiscCameraRadiance: "omitted",
      spectralEndpoint: "15-channel spectral radiance before display",
      secondOrder: "full-sphere Fibonacci incident sky approximation",
    },
    sourceConfig: scenes.map((scene) => createSceneSunSource(scene).toJSON()),
    spectralGrid: {
      units: "nm",
      wavelengths: activeSpectralChannels().map(
        (channel) => channel.wavelengthNanometers
      ),
    },
    numericalControls: {
      distanceUnits: "m",
      angleInputUnits: "deg",
      viewRayScatteringIntervals: ATMOSPHERE.singleScatteringSampleCount,
      sampleToSunTransmittanceIntervals:
        ATMOSPHERE.sunTransmittanceSampleCount,
      secondOrderIncomingDirections:
        ATMOSPHERE.secondOrderIncomingDirectionCount,
      secondOrderAltitudeBins: ATMOSPHERE.secondOrderAltitudeBins,
    },
    figure1Scenes: scenes,
    outputProducts: [
      "four generated PNG domes",
      "image-comparisons.json",
      "selected-ray-diagnostics.json",
      "criteria-results.json",
      "report.md",
    ],
    references: [
      "agents/topics/apps/flat/plans/atmosphere-cleanroom-design/experiment-032-algorithm.md",
      "tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/",
    ],
  };
}

function makeResultRecord({
  artifactDirectory,
  criteriaResults,
  imageComparisons,
  selectedRayDiagnostics,
  sceneOutputs,
}) {
  return {
    status: criteriaResults.status,
    step: STEP,
    artifactDirectory: path.relative(ROOT, artifactDirectory).replace(/\\/g, "/"),
    summary: {
      criteria: {
        passed: criteriaResults.passed,
        failed: criteriaResults.failed,
        unresolved: criteriaResults.unresolved,
        notApplicable: criteriaResults.notApplicable,
      },
      imageParity: {
        maxAbsRgbDelta: Math.max(
          ...imageComparisons.map((comparison) => comparison.maxAbsRgbDelta)
        ),
        maxAbsAlphaDelta: Math.max(
          ...imageComparisons.map((comparison) => comparison.maxAbsAlphaDelta)
        ),
        exactImageBytes: imageComparisons.every(
          (comparison) => comparison.exactBytes
        ),
      },
      selectedRayParity: selectedRayDiagnostics.summary,
    },
    outputs: sceneOutputs,
  };
}

function makeReport({
  criteriaResults,
  imageComparisons,
  selectedRayDiagnostics,
  sceneOutputs,
}) {
  const imageLines = imageComparisons
    .map(
      (comparison) =>
        `- ${comparison.generatedPath}: maxAbsRgbDelta=${comparison.maxAbsRgbDelta}, maxAbsAlphaDelta=${comparison.maxAbsAlphaDelta}, exactBytes=${comparison.exactBytes}`
    )
    .join("\n");
  const criteriaLines = criteriaResults.criteria
    .map((entry) => `- ${entry.criterionId}: ${entry.status}`)
    .join("\n");

  return `# Atmosflat32 Distant Source Abstraction Baseline

Status: ${criteriaResults.status} (${criteriaResults.passed} passed, ${criteriaResults.failed} failed, ${criteriaResults.unresolved} unresolved, ${criteriaResults.notApplicable} not-applicable).

This POC artifact routes the default Figure 1 distant directional Sun through a
runtime source object while preserving the copied Algorithm32 step-032 transport
and display behavior.

Generated domes:

${sceneOutputs.map((output) => `- ${output}`).join("\n")}

Image parity:

${imageLines}

Selected-ray parity summary:

- max radiance absolute delta: ${selectedRayDiagnostics.summary.maxRadianceAbs}
- max radiance relative delta: ${selectedRayDiagnostics.summary.maxRadianceRel}
- max second-order absolute delta: ${selectedRayDiagnostics.summary.maxSecondOrderAbs}
- max direct Sun transmittance delta: ${selectedRayDiagnostics.summary.maxDirectSunTransmittanceAbs}

Criteria:

${criteriaLines}

Notes:

- This is POC experiment code, not production/shared app code.
- No unit tests were added.
- Display images are report artifacts derived from recorded transport output.
`;
}

function compactLightState(light) {
  if (!light) {
    return null;
  }

  return {
    kind: light.kind,
    direction: light.direction || null,
    positionKm: light.positionKm || null,
    distanceKm: light.distanceKm,
    color: light.color,
    intensity: light.intensity,
    solarIrradianceScale: light.solarIrradianceScale,
    angularRadiusRad: light.angularRadiusRad,
    apparentAngularRadiusRad: light.apparentAngularRadiusRad,
    apparentAngularDiameterRad: light.apparentAngularDiameterRad,
    radiusKm: light.radiusKm,
    anchor: light.anchor,
  };
}

function compactFlatAppContext(context) {
  return {
    request: context.request,
    appConfig: context.appConfig,
    observer: {
      positionKm: context.observerPositionKm,
      projection: context.observerProjection,
    },
    initialSunProjection: context.initialSunProjection,
    animation: {
      closestRotationAngleRad: context.closestRotationAngleRad,
      closestSolarDayFraction: context.closestSolarDayFraction,
      closestSolarDayHour: context.closestSolarDayHour,
    },
    visibleSun: {
      positionKm: context.visibleSun.positionKm,
      radiusKm: context.visibleSun.radiusKm,
      color: context.visibleSun.color,
    },
    atmosphereSun: compactLightState(context.atmosphereSun),
    oppositeAtmosphereSun: compactLightState(context.oppositeSun),
    sourceConfig: context.source.toJSON(),
  };
}

function collectFlatAppClosestSourceDiagnostics(context) {
  const observerPositionKm = context.observerPositionKm;
  const samplePositions = [
    {
      label: "san-jose-observer",
      positionKm: observerPositionKm,
    },
    {
      label: "ten-km-above-san-jose-observer",
      positionKm: [
        observerPositionKm[0],
        observerPositionKm[1] + 10,
        observerPositionKm[2],
      ],
    },
    {
      label: "one-hundred-km-east-of-san-jose-observer",
      positionKm: [
        observerPositionKm[0] + 100,
        observerPositionKm[1],
        observerPositionKm[2],
      ],
    },
  ];
  const samples = samplePositions.map((entry) => {
    const sample = context.source.sourceSamplesAt(entry.positionKm, {
      kind: "flat-app-diagnostic",
      label: entry.label,
    })[0];

    return {
      label: entry.label,
      positionKm: entry.positionKm,
      sample,
    };
  });
  const observerSample = samples[0].sample;
  const derivedDirection = context.atmosphereSun.direction;
  const derivedPosition = context.atmosphereSun.positionKm;
  const visiblePosition = context.visibleSun.positionKm;
  const observerDistanceDelta = Math.abs(
    observerSample.distance - context.atmosphereSun.distanceKm
  );
  const observerDirectionMaxDelta = maxVectorDelta(
    observerSample.direction,
    derivedDirection
  );
  const observerAngularRadiusDelta = Math.abs(
    observerSample.apparentAngularRadiusRad -
      context.atmosphereSun.apparentAngularRadiusRad
  );
  const observerHorizontal = [observerPositionKm[0], 0, observerPositionKm[2]];
  const sunHorizontal = [derivedPosition[0], 0, derivedPosition[2]];
  const horizontalDenominator = Math.max(
    length(observerHorizontal) * length(sunHorizontal),
    Number.EPSILON
  );
  const horizontalAlignmentCrossAbs =
    Math.abs(
      observerHorizontal[0] * sunHorizontal[2] -
        observerHorizontal[2] * sunHorizontal[0]
    ) / horizontalDenominator;
  const horizontalAlignmentDot =
    dot(observerHorizontal, sunHorizontal) / horizontalDenominator;

  return {
    samples,
    summary: {
      appAtmosphereSunKind: context.atmosphereSun.kind,
      closestRotationAngleRad: context.closestRotationAngleRad,
      closestSolarDayFraction: context.closestSolarDayFraction,
      closestSolarDayHour: context.closestSolarDayHour,
      observerPositionKm,
      initialSunPositionKm: context.initialSunPositionKm,
      atmosphereSunPositionKm: derivedPosition,
      visibleSunPositionKm: visiblePosition,
      atmosphereSunRadiusKm: context.atmosphereSun.radiusKm,
      atmosphereSunDistanceKm: context.atmosphereSun.distanceKm,
      oppositeAtmosphereSunDistanceKm: context.oppositeSun.distanceKm,
      horizontalAlignmentCrossAbs,
      horizontalAlignmentDot,
      observerSampleDistanceKm: observerSample.distance,
      observerSampleDirection: observerSample.direction,
      observerSampleReferenceDistanceKm: observerSample.referenceDistanceKm,
      observerSampleDistanceFalloffScale: observerSample.distanceFalloffScale,
      observerReferenceIncidentScale:
        observerSample.referenceSpectralIncidentScale,
      observerIncidentScaleAtObserver:
        observerSample.spectralIncidentScaleByWavelength[0],
      observerRelativeIncidentScale:
        observerSample.referenceSpectralIncidentScale > 0
          ? observerSample.spectralIncidentScaleByWavelength[0] /
            observerSample.referenceSpectralIncidentScale
          : 0,
      observerDirectionMaxDelta,
      observerDistanceDelta,
      observerAngularRadiusDelta,
      sourceVsAtmospherePositionMaxDelta: maxVectorDelta(
        context.source.positionKm,
        derivedPosition
      ),
      visibleVsAtmospherePositionMaxDelta: maxVectorDelta(
        visiblePosition,
        derivedPosition
      ),
      radiusDelta: Math.abs(
        context.visibleSun.radiusKm - context.atmosphereSun.radiusKm
      ),
      positionDependentDirectionDelta: maxVectorDelta(
        samples[0].sample.direction,
        samples[1].sample.direction
      ),
      positionDependentDistanceDelta: Math.abs(
        samples[0].sample.distance - samples[1].sample.distance
      ),
    },
  };
}

function buildFlatAppClosestCriteria(context, diagnostics, imageProducts = []) {
  const summary = diagnostics.summary;
  const requiredImages = [
    "flat-app-closest-position-map.png",
    "flat-app-closest-sky-marker.png",
  ];
  const imageNames = imageProducts.map((image) => image.name);
  const imagesGenerated = requiredImages.every((name) =>
    imageNames.includes(name)
  );
  const criteria = [
    criterion("uses-app-san-jose-root-config", "pass", {
      tolerance: "exact configured root id",
      measuredError: 0,
      sourceOrStatus: "app configuration",
      root: context.appConfig.root,
    }),
    criterion("uses-app-flat-sun-config", "pass", {
      tolerance: "exact default false-Sun config fields",
      measuredError: 0,
      sourceOrStatus: "app configuration",
      sunConfig: {
        latitude: context.appConfig.sun.latitude,
        resolvedLatitudeDeg: context.appConfig.sun.resolvedLatitudeDeg,
        latitudeResolvedAt: context.appConfig.sun.latitudeResolvedAt,
        lon: context.appConfig.sun.lon,
        altitudeKm: context.appConfig.sun.altitudeKm,
        radiusKm: context.appConfig.sun.radiusKm,
        atmosphere: context.appConfig.sun.atmosphere,
      },
    }),
    criterion(
      "independent-closest-approach-rotation-aligns-horizontally",
      summary.horizontalAlignmentCrossAbs <= 1e-12 &&
        summary.horizontalAlignmentDot > 0
        ? "pass"
        : "fail",
      {
        tolerance: "normalized horizontal cross <= 1e-12 and dot > 0",
        measuredError: {
          horizontalAlignmentCrossAbs: summary.horizontalAlignmentCrossAbs,
          horizontalAlignmentDot: summary.horizontalAlignmentDot,
        },
        sourceOrStatus: "algorithmic diagnostic math from app config",
        recomputedClosestAngleRad: context.closestRotationAngleRad,
      }
    ),
    criterion(
      "active-source-is-flat-local-point-sun",
      context.source.kind === "flat-local-point-sun" ? "pass" : "fail",
      {
        tolerance: "structural",
        measuredError: context.source.kind,
        sourceOrStatus: "algorithmic POC contract",
      }
    ),
    criterion(
      "source-position-matches-independent-derived-atmosphere-sun",
      summary.sourceVsAtmospherePositionMaxDelta <= 1e-12 ? "pass" : "fail",
      {
        tolerance: "max component delta <= 1e-12 km",
        measuredError: summary.sourceVsAtmospherePositionMaxDelta,
        sourceOrStatus: "algorithmic diagnostic math from app config",
      }
    ),
    criterion(
      "observer-sample-matches-independent-derived-light-state",
      summary.observerDirectionMaxDelta <= 1e-12 &&
        summary.observerDistanceDelta <= 1e-9 &&
        summary.observerAngularRadiusDelta <= 1e-15
        ? "pass"
        : "fail",
      {
        tolerance:
          "direction max <= 1e-12, distance <= 1e-9 km, angular radius <= 1e-15 rad",
        measuredError: {
          observerDirectionMaxDelta: summary.observerDirectionMaxDelta,
          observerDistanceDelta: summary.observerDistanceDelta,
          observerAngularRadiusDelta: summary.observerAngularRadiusDelta,
        },
        sourceOrStatus: "algorithmic diagnostic math from app config",
      }
    ),
    criterion(
      "observer-sample-uses-configured-distance-falloff",
      Math.abs(
        summary.observerIncidentScaleAtObserver -
          summary.observerReferenceIncidentScale *
            summary.observerSampleDistanceFalloffScale
      ) <= 1e-12
        ? "pass"
        : "fail",
      {
        tolerance:
          "incidentScaleAtObserver == referenceIncidentScale * distanceFalloffScale",
        measuredError: {
          referenceDistanceKm: summary.observerSampleReferenceDistanceKm,
          distanceKm: summary.observerSampleDistanceKm,
          distanceFalloffScale: summary.observerSampleDistanceFalloffScale,
          referenceIncidentScale: summary.observerReferenceIncidentScale,
          incidentScaleAtObserver: summary.observerIncidentScaleAtObserver,
        },
        sourceOrStatus: "app configured local radiance model",
      }
    ),
    criterion(
      "closest-approach-is-nearer-than-opposite",
      summary.atmosphereSunDistanceKm <
        summary.oppositeAtmosphereSunDistanceKm
        ? "pass"
        : "fail",
      {
        tolerance: "closest distance < opposite-rotation distance",
        measuredError: {
          closestKm: summary.atmosphereSunDistanceKm,
          oppositeKm: summary.oppositeAtmosphereSunDistanceKm,
        },
        sourceOrStatus: "algorithmic diagnostic math from app config",
      }
    ),
    criterion(
      "visible-and-atmosphere-sun-share-position-and-radius",
      summary.visibleVsAtmospherePositionMaxDelta <= 1e-12 &&
        summary.radiusDelta <= 1e-12
        ? "pass"
        : "fail",
      {
        tolerance: "position max <= 1e-12 km and radius delta <= 1e-12 km",
        measuredError: {
          positionMaxDelta: summary.visibleVsAtmospherePositionMaxDelta,
          radiusDelta: summary.radiusDelta,
        },
        sourceOrStatus: "linked visible false-sun atmosphere contract",
      }
    ),
    criterion(
      "source-samples-vary-with-sample-position",
      summary.positionDependentDirectionDelta > 0 &&
        summary.positionDependentDistanceDelta > 0
        ? "pass"
        : "fail",
      {
        tolerance: "diagnostic observer and elevated sample must differ",
        measuredError: {
          directionDelta: summary.positionDependentDirectionDelta,
          distanceDeltaKm: summary.positionDependentDistanceDelta,
        },
        sourceOrStatus: "local point-source behavior contract",
      }
    ),
    criterion(
      "diagnostic-images-generated",
      imagesGenerated ? "pass" : "fail",
      {
        tolerance: requiredImages.join(", "),
        measuredError: {
          requiredImages,
          generatedImages: imageNames,
        },
        sourceOrStatus: "artifact usability contract",
      }
    ),
  ];
  const status = criteria.every((entry) => entry.status === "pass")
    ? "accepted"
    : "rejected";

  return {
    status,
    passed: criteria.filter((entry) => entry.status === "pass").length,
    failed: criteria.filter((entry) => entry.status === "fail").length,
    unresolved: 0,
    notApplicable: 0,
    criteria,
  };
}

function makeFlatAppClosestStateGoal(criteriaResults) {
  return `# Flat App Closest San Jose Source Position

Goal: create an atmosflat32 diagnostic version that uses the app's flat Sun
position setup and places the flat local Sun at its closest approach to the San
Jose observer.

Success criteria:

- use the app's San Jose root and false-Sun configuration only;
- compute projection and closest-approach rotation independently in atmosflat32;
- adapt the configured atmosphere-radiance facet into a flat-local-point-sun
  source;
- prove the source observer sample matches the independently derived direction,
  configured distance, incident scale, and apparent size;
- generate diagnostic map and sky-marker PNG images;
- keep this as a source-position diagnostic, not a local Algorithm32 scattering
  acceptance artifact.

Status: ${criteriaResults.status}

Next step if accepted: use this source placement as the fixture for the first
flat/local Sun scattering diagnostic.
`;
}

function makeFlatAppClosestInputsRecord(context) {
  return {
    schemaVersion: 1,
    runId: STEP.registryId || STEP.label,
    stateGoal:
      "Use the app flat-simulation Sun setup and place the local point Sun at closest approach to San Jose.",
    sourceBoundary: {
      appConfigurationUsed: [
        "src/flat/features/flat-simulation/models/consts.js DEFAULT_FLAT_SIMULATION_CONFIG",
        "src/flat/features/flat-simulation/models/consts.js DEFAULT_FLAT_SIMULATION_SUN",
        "src/flat/features/flat-simulation/models/consts.js DEFAULT_ATMOSPHERE.rendering.falseSunRadiance",
        "src/flat/features/flat-simulation/models/consts.js MEAN_EARTH_RADIUS_KM",
      ],
      note:
        "This step consumes app configuration only. Projection, closest approach, source direction, configured source distance, source incident scale, and apparent size are computed independently inside atmosflat32.",
    },
    appFlatSunContext: compactFlatAppContext(context),
    sourceConfig: context.source.toJSON(),
    outputProducts: [
      "flat-app-closest-position-map.png",
      "flat-app-closest-sky-marker.png",
      "flat-app-image-diagnostics.json",
      "flat-app-source-diagnostics.json",
      "criteria-results.json",
      "result.json",
      "report.md",
    ],
  };
}

function makeFlatAppClosestResultRecord({
  artifactDirectory,
  criteriaResults,
  diagnostics,
  imageProducts,
}) {
  return {
    status: criteriaResults.status,
    step: STEP,
    artifactDirectory: path.relative(ROOT, artifactDirectory).replace(/\\/g, "/"),
    summary: {
      criteria: {
        passed: criteriaResults.passed,
        failed: criteriaResults.failed,
        unresolved: criteriaResults.unresolved,
        notApplicable: criteriaResults.notApplicable,
      },
      flatAppClosestApproach: diagnostics.summary,
      images: imageProducts,
    },
    outputs: [
      ...imageProducts.map((image) => image.name),
      "flat-app-image-diagnostics.json",
      "flat-app-source-diagnostics.json",
      "criteria-results.json",
      "result.json",
      "report.md",
    ],
  };
}

function makeFlatAppClosestReport({ criteriaResults, diagnostics, imageProducts }) {
  const criteriaLines = criteriaResults.criteria
    .map((entry) => `- ${entry.criterionId}: ${entry.status}`)
    .join("\n");
  const imageLines = imageProducts
    .map((image) => `- ${image.name}: ${image.role}`)
    .join("\n");
  const summary = diagnostics.summary;

  return `# Atmosflat32 Flat App Closest San Jose Source Position

Status: ${criteriaResults.status} (${criteriaResults.passed} passed, ${criteriaResults.failed} failed, ${criteriaResults.unresolved} unresolved, ${criteriaResults.notApplicable} not-applicable).

This POC artifact reads the app's San Jose root and default false-Sun
configuration, then independently resolves the flat local point Sun at its
closest approach to the San Jose observer. It adapts the configured atmosphere
radiance facet into an atmosflat32 \`flat-local-point-sun\` source object.

This is a source-position and source-sampling diagnostic only. It does not
claim local Sun Algorithm32 scattering parity and it does not render Figure 1
sky domes.

Closest approach:

- rotation angle rad: ${summary.closestRotationAngleRad}
- solar-day fraction: ${summary.closestSolarDayFraction}
- solar-day hour: ${summary.closestSolarDayHour}
- observer position km: ${summary.observerPositionKm.join(", ")}
- Sun position km: ${summary.atmosphereSunPositionKm.join(", ")}
- observer distance km: ${summary.atmosphereSunDistanceKm}
- opposite-rotation distance km: ${summary.oppositeAtmosphereSunDistanceKm}
- Sun radius km: ${summary.atmosphereSunRadiusKm}

Observer source sample:

- direction: ${summary.observerSampleDirection.join(", ")}
- distance km: ${summary.observerSampleDistanceKm}
- reference distance km: ${summary.observerSampleReferenceDistanceKm}
- distance falloff scale: ${summary.observerSampleDistanceFalloffScale}
- incident scale at observer: ${summary.observerIncidentScaleAtObserver}
- relative incident scale: ${summary.observerRelativeIncidentScale}
- direction max delta vs independent source state: ${summary.observerDirectionMaxDelta}
- distance delta vs independent source state km: ${summary.observerDistanceDelta}
- angular radius delta vs independent source state rad: ${summary.observerAngularRadiusDelta}

Diagnostic images:

${imageLines}

Criteria:

${criteriaLines}

Notes:

- This is POC experiment code, not production/shared app code.
- No unit tests were added.
- The app is used only as the configuration source.
- The coordinate frame is the app flat scene in kilometers.
`;
}

function makeFlatAppClosestEquationsRecord(context) {
  return {
    status: "flat-app-closest-san-jose-position-diagnostic",
    equations: [
      {
        name: "independent closest false-Sun rotation",
        expression:
          "angleRad = atan2(observerHorizontal.x * sunHorizontal.z - observerHorizontal.z * sunHorizontal.x, dot(observerHorizontal, sunHorizontal))",
        purpose:
          "Rotates the configured date-resolved false Sun latitude ring to its closest horizontal approach to the configured San Jose observer.",
        source: "algorithmic diagnostic math from app configuration",
      },
      {
        name: "flat local point-source direction",
        expression: "direction = normalize(sourcePositionKm - samplePositionKm)",
        purpose:
          "Produces the source-sample direction consumed by later local-source scattering diagnostics.",
        source: "algorithmic POC contract",
      },
      {
        name: "flat local point-source distance",
        expression: "distanceKm = length(sourcePositionKm - samplePositionKm)",
        purpose:
          "Records finite local source distance in the app flat scene coordinate frame.",
        source: "algorithmic POC contract",
      },
      {
        name: "closest-approach local Sun brightness calibration",
        expression:
          "calibratedSolarIrradianceScale = targetIncidentScaleAtClosest / (intensity * closestDistanceFalloffScale)",
        purpose:
          "Sets the local flat Sun brightness so the closest San Jose observer sample receives the same unit incident scale as the distant directional Sun before distance falloff is applied to other offsets.",
        source: "user-directed Algorithm32 POC calibration",
      },
      {
        name: "configured local Sun incident scale",
        expression:
          "incidentScale = intensity * solarIrradianceScale * (referenceDistanceKm / distanceKm)^2",
        purpose:
          "Treats the finite source-to-sample distance as the configured local Sun distance and applies the inverse-square local radiance falloff using the calibrated transport solarIrradianceScale.",
        source:
          "app configuration DEFAULT_ATMOSPHERE.rendering.falseSunRadiance falloff rule plus user-directed Algorithm32 POC brightness calibration",
      },
      {
        name: "apparent angular radius",
        expression: "angularRadiusRad = asin(min(1, radiusKm / distanceKm))",
        purpose:
          "Computes finite point-source apparent size from the configured radius and independently derived observer distance.",
        source: "algorithmic diagnostic math from app configuration",
      },
    ],
    constants: {
      request: context.request,
      activeStep: STEP,
      coordinateFrame: "app flat scene, kilometers",
      sourceBoundary:
        "App code is used only for configuration constants; all derived source geometry and source incident scale are calculated in this POC runner.",
    },
  };
}

function createPixels(width, height, rgba) {
  const pixels = new Uint8Array(width * height * 4);

  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = rgba[0];
    pixels[offset + 1] = rgba[1];
    pixels[offset + 2] = rgba[2];
    pixels[offset + 3] = rgba[3];
  }

  return pixels;
}

function blendPixel(pixels, width, height, x, y, rgba) {
  const ix = Math.round(x);
  const iy = Math.round(y);

  if (ix < 0 || iy < 0 || ix >= width || iy >= height) {
    return;
  }

  const offset = (iy * width + ix) * 4;
  const alpha = (rgba[3] ?? 255) / 255;
  const inverseAlpha = 1 - alpha;

  pixels[offset] = clampByte(rgba[0] * alpha + pixels[offset] * inverseAlpha);
  pixels[offset + 1] = clampByte(rgba[1] * alpha + pixels[offset + 1] * inverseAlpha);
  pixels[offset + 2] = clampByte(rgba[2] * alpha + pixels[offset + 2] * inverseAlpha);
  pixels[offset + 3] = 255;
}

function drawLine(pixels, width, height, x0, y0, x1, y1, rgba) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);

  for (let stepIndex = 0; stepIndex <= steps; stepIndex += 1) {
    const t = stepIndex / steps;
    blendPixel(
      pixels,
      width,
      height,
      x0 + (x1 - x0) * t,
      y0 + (y1 - y0) * t,
      rgba
    );
  }
}

function drawCircle(pixels, width, height, cx, cy, radius, rgba, filled = true) {
  const minX = Math.floor(cx - radius);
  const maxX = Math.ceil(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.ceil(cy + radius);
  const radiusSquared = radius * radius;
  const innerSquared = Math.max(0, radius - 1.5) ** 2;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const distanceSquared = dx * dx + dy * dy;

      if (
        distanceSquared <= radiusSquared &&
        (filled || distanceSquared >= innerSquared)
      ) {
        blendPixel(pixels, width, height, x, y, rgba);
      }
    }
  }
}

function drawPolyline(pixels, width, height, points, rgba) {
  for (let index = 1; index < points.length; index += 1) {
    drawLine(
      pixels,
      width,
      height,
      points[index - 1][0],
      points[index - 1][1],
      points[index][0],
      points[index][1],
      rgba
    );
  }
}

function renderFlatClosestMapImage(context) {
  const width = 640;
  const height = 420;
  const margin = 34;
  const pixels = createPixels(width, height, [14, 17, 24, 255]);
  const points = [
    [0, 0],
    [context.observerPositionKm[0], context.observerPositionKm[2]],
    [context.initialSunPositionKm[0], context.initialSunPositionKm[2]],
    [context.closestSunPositionKm[0], context.closestSunPositionKm[2]],
    [context.oppositeSunPositionKm[0], context.oppositeSunPositionKm[2]],
  ];
  const minX = Math.min(...points.map((point) => point[0]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const minZ = Math.min(...points.map((point) => point[1]));
  const maxZ = Math.max(...points.map((point) => point[1]));
  const scale = Math.min(
    (width - margin * 2) / Math.max(maxX - minX, 1),
    (height - margin * 2) / Math.max(maxZ - minZ, 1)
  );
  const mapPoint = (x, z) => [
    margin + (x - minX) * scale,
    height - margin - (z - minZ) * scale,
  ];
  const origin = mapPoint(0, 0);
  const observer = mapPoint(
    context.observerPositionKm[0],
    context.observerPositionKm[2]
  );
  const initialSun = mapPoint(
    context.initialSunPositionKm[0],
    context.initialSunPositionKm[2]
  );
  const closestSun = mapPoint(
    context.closestSunPositionKm[0],
    context.closestSunPositionKm[2]
  );
  const oppositeSun = mapPoint(
    context.oppositeSunPositionKm[0],
    context.oppositeSunPositionKm[2]
  );
  const trajectoryRadius = Math.hypot(
    context.initialSunPositionKm[0],
    context.initialSunPositionKm[2]
  );
  const trajectoryPoints = [];

  for (let index = 0; index <= 160; index += 1) {
    const angle = (index / 160) * TAU;
    trajectoryPoints.push(
      mapPoint(
        Math.sin(angle) * trajectoryRadius,
        Math.cos(angle) * trajectoryRadius
      )
    );
  }

  drawLine(pixels, width, height, origin[0] - 12, origin[1], origin[0] + 12, origin[1], [95, 112, 140, 255]);
  drawLine(pixels, width, height, origin[0], origin[1] - 12, origin[0], origin[1] + 12, [95, 112, 140, 255]);
  drawPolyline(pixels, width, height, trajectoryPoints, [70, 82, 105, 180]);
  drawLine(pixels, width, height, observer[0], observer[1], closestSun[0], closestSun[1], [247, 219, 112, 210]);
  drawLine(pixels, width, height, initialSun[0], initialSun[1], closestSun[0], closestSun[1], [120, 130, 150, 180]);
  drawCircle(pixels, width, height, origin[0], origin[1], 4, [155, 168, 190, 255]);
  drawCircle(pixels, width, height, observer[0], observer[1], 8, [80, 210, 255, 255]);
  drawCircle(pixels, width, height, initialSun[0], initialSun[1], 7, [255, 151, 71, 255], false);
  drawCircle(pixels, width, height, oppositeSun[0], oppositeSun[1], 7, [255, 92, 92, 255]);
  drawCircle(pixels, width, height, closestSun[0], closestSun[1], 10, [255, 230, 96, 255]);
  drawCircle(pixels, width, height, closestSun[0], closestSun[1], 16, [255, 230, 96, 95], false);

  return {
    name: "flat-app-closest-position-map.png",
    width,
    height,
    pixels,
    role: "top-down flat-scene diagnostic",
    legend: {
      cyan: "San Jose observer",
      yellow: "closest-approach local Sun",
      orangeRing: "initial configured false-Sun position",
      red: "opposite rotation",
      grayRing: "date-resolved Sun latitude-ring trajectory",
    },
  };
}

function renderFlatClosestSkyMarkerImage(context) {
  const width = IMAGE_SIZE;
  const height = IMAGE_SIZE;
  const center = (width - 1) / 2;
  const skyRadius = SKY_RADIUS;
  const pixels = createPixels(width, height, [8, 15, 28, 255]);
  const direction = context.atmosphereSun.direction;
  const altitude = Math.asin(clamp(direction[1], -1, 1));
  const zenithAngle = Math.PI / 2 - altitude;
  const azimuth = Math.atan2(direction[0], direction[2]);
  const markerRadius = clamp(zenithAngle / (Math.PI / 2), 0, 1) * skyRadius;
  const markerX = center + Math.sin(azimuth) * markerRadius;
  const markerY = center - Math.cos(azimuth) * markerRadius;

  drawCircle(pixels, width, height, center, center, skyRadius, [31, 64, 104, 255]);
  drawCircle(pixels, width, height, center, center, skyRadius, [138, 174, 220, 255], false);
  drawCircle(pixels, width, height, center, center, skyRadius * 0.5, [82, 118, 160, 150], false);
  drawLine(pixels, width, height, center - skyRadius, center, center + skyRadius, center, [74, 104, 140, 190]);
  drawLine(pixels, width, height, center, center - skyRadius, center, center + skyRadius, [74, 104, 140, 190]);
  drawCircle(pixels, width, height, center, center, 3, [190, 220, 255, 255]);
  drawLine(pixels, width, height, center, center, markerX, markerY, [247, 219, 112, 220]);
  drawCircle(pixels, width, height, markerX, markerY, 9, [255, 230, 96, 255]);
  drawCircle(pixels, width, height, markerX, markerY, 16, [255, 230, 96, 90], false);

  return {
    name: "flat-app-closest-sky-marker.png",
    width,
    height,
    pixels,
    role: "observer fisheye direction diagnostic",
    marker: {
      altitudeDegrees: altitude * 180 / Math.PI,
      azimuthDegrees: azimuth * 180 / Math.PI,
      x: markerX,
      y: markerY,
    },
  };
}

function writeFlatAppClosestImages(artifactDirectory, context) {
  const images = [
    renderFlatClosestMapImage(context),
    renderFlatClosestSkyMarkerImage(context),
  ];

  for (const image of images) {
    writePng(
      path.join(artifactDirectory, image.name),
      image.width,
      image.height,
      image.pixels
    );
    delete image.pixels;
  }

  return images;
}

function rotationOffsetLabel(degrees) {
  if (degrees === 0) {
    return "000deg-closest";
  }

  return `${String(degrees).padStart(3, "0")}deg-from-closest`;
}

function flatSceneDirectionToAlgorithm32Direction(direction) {
  return normalize([direction[0], direction[2], direction[1]]);
}

function createFlatLocalPointSunSourceFromLight(
  sceneKey,
  atmosphereSun,
  radianceConfig
) {
  return createFlatLocalPointSunSource({
    sceneKey,
    positionKm: atmosphereSun.positionKm,
    radiusKm: atmosphereSun.radiusKm,
    color: atmosphereSun.color,
    intensity: atmosphereSun.intensity,
    solarIrradianceScale: atmosphereSun.solarIrradianceScale,
    radianceConfig,
    anchor: atmosphereSun.anchor,
    derivedLightState: {
      kind: atmosphereSun.kind,
      direction: atmosphereSun.direction,
      distanceKm: atmosphereSun.distanceKm,
      apparentAngularRadiusRad: atmosphereSun.apparentAngularRadiusRad,
      apparentAngularDiameterRad: atmosphereSun.apparentAngularDiameterRad,
    },
  });
}

function createFlatAppRotationSourceEntries(base) {
  return FLAT_APP_SKYDOME_ROTATION_OFFSETS_DEGREES.map((offsetDegrees) => {
    const rawRotationAngleRad =
      base.closestRotationAngleRad +
      FLAT_APP_FORWARD_TIME_ROTATION_SIGN * degreesToRadians(offsetDegrees);
    const normalizedRotationAngleRad =
      ((rawRotationAngleRad % TAU) + TAU) % TAU;
    const positionKm = rotateAroundWorldYArray(
      base.initialSunPositionKm,
      rawRotationAngleRad
    );
    const atmosphereSun = derivedPointSunLightState({
      positionKm,
      observerPositionKm: base.observerPositionKm,
      sunConfig: base.appConfig.sun,
    });
    const label = rotationOffsetLabel(offsetDegrees);
    const sceneKey = `san-jose-${label}`;
    const source = createFlatLocalPointSunSourceFromLight(
      sceneKey,
      atmosphereSun,
      base.radianceConfig
    );
    const observerSample = source.sourceSamplesAt(base.observerPositionKm, {
      kind: "flat-app-skydome-diagnostic",
      label,
    })[0];
    const algorithm32ObserverDirection =
      flatSceneDirectionToAlgorithm32Direction(observerSample.direction);
    const altitudeRad = Math.asin(
      clamp(observerSample.direction[1], -1, 1)
    );
    const azimuthRad = Math.atan2(
      observerSample.direction[0],
      observerSample.direction[2]
    );

    return {
      label,
      offsetDegrees,
      rawRotationAngleRad,
      normalizedRotationAngleRad,
      orbitDirection: FLAT_APP_FORWARD_TIME_ORBIT_DIRECTION,
      offsetSemantic:
        "positive rotation offsets are forward solar time from closest approach",
      sceneKey,
      source,
      sourceConfig: source.toJSON(),
      sourcePositionKm: positionKm,
      atmosphereSun,
      radianceConfig: base.radianceConfig,
      observerSample,
      algorithm32ObserverDirection,
      observerDirection: observerSample.direction,
      observerDistanceKm: observerSample.distance,
      apparentAngularRadiusRad: observerSample.apparentAngularRadiusRad,
      altitudeDegrees: altitudeRad * 180 / Math.PI,
      azimuthDegrees: azimuthRad * 180 / Math.PI,
      imageName: `flat-app-skydome-${label}.png`,
    };
  });
}

function createFlatLocalSunBrightnessCalibration(entries) {
  const closestEntry =
    entries.find((entry) => entry.offsetDegrees === 0) || entries[0];
  const closestFalloff = closestEntry?.observerSample?.distanceFalloffScale;
  const closestIntensity = Number(closestEntry?.atmosphereSun?.intensity) || 0;
  const originalSolarIrradianceScale =
    Number(closestEntry?.atmosphereSun?.solarIrradianceScale) || 0;

  if (
    !closestEntry ||
    closestIntensity <= 0 ||
    !Number.isFinite(closestFalloff) ||
    closestFalloff <= 0
  ) {
    throw new Error(
      "Flat local Sun brightness calibration requires a finite closest source sample, positive intensity, and positive distance falloff."
    );
  }

  const targetIncidentScale =
    FLAT_APP_BRIGHTNESS_CALIBRATION_TARGET.targetIncidentScaleAtClosest;
  const calibratedSolarIrradianceScale =
    targetIncidentScale / (closestIntensity * closestFalloff);
  const calibratedReferenceSpectralIncidentScale =
    closestIntensity * calibratedSolarIrradianceScale;
  const originalReferenceSpectralIncidentScale =
    closestIntensity * originalSolarIrradianceScale;

  return {
    ...FLAT_APP_BRIGHTNESS_CALIBRATION_TARGET,
    closestOffsetDegrees: closestEntry.offsetDegrees,
    closestConfiguredDistanceKm: closestEntry.observerDistanceKm,
    closestDistanceFalloffScale: closestFalloff,
    originalSolarIrradianceScale,
    originalReferenceSpectralIncidentScale,
    originalIncidentScaleAtClosest:
      closestEntry.observerSample.diagnostics?.spectralIncidentScale ??
      originalReferenceSpectralIncidentScale * closestFalloff,
    calibratedSolarIrradianceScale,
    calibratedReferenceSpectralIncidentScale,
    calibratedIncidentScaleAtClosest: targetIncidentScale,
    calibrationMultiplier:
      originalSolarIrradianceScale > 0
        ? calibratedSolarIrradianceScale / originalSolarIrradianceScale
        : null,
  };
}

function attachAlgorithm32FlatTransportEntry(entry, brightnessCalibration) {
  const transportObserverPositionMeters = flatObserverPositionMeters();
  const atmosphereGeometry = flatLocalAtmosphereGeometryRecord(
    transportObserverPositionMeters
  );
  const transportSource = createAlgorithm32FlatLocalPointSunSource({
    sceneKey: `${entry.sceneKey}-algorithm32-flat-cap-first-order`,
    observerPositionMeters: transportObserverPositionMeters,
    observerDirection: entry.algorithm32ObserverDirection,
    observerDistanceKm: entry.observerSample.configuredDistanceKm,
    radiusKm: entry.atmosphereSun.radiusKm,
    color: entry.atmosphereSun.color,
    intensity: entry.atmosphereSun.intensity,
    solarIrradianceScale:
      brightnessCalibration.calibratedSolarIrradianceScale,
    radianceConfig: entry.radianceConfig,
    anchor: entry.atmosphereSun.anchor,
    flatSourceConfig: entry.source.toJSON(),
    brightnessCalibration,
  });
  const transportObserverSample = transportSource.sourceSamplesAt(
    transportObserverPositionMeters,
    {
      ...atmosphereGeometry,
      kind: atmosphereGeometry.sourceSampleGeometryKinds.observer,
      label: entry.label,
    }
  )[0];
  const incidentScaleAtObserver =
    transportObserverSample.diagnostics?.spectralIncidentScale ??
    transportObserverSample.spectralIncidentScaleByWavelength[0] ??
    0;
  const firstWavelengthIncidentScaleAtObserver =
    transportObserverSample.spectralIncidentScaleByWavelength[0] || 0;
  const referenceIncidentScale =
    transportObserverSample.referenceSpectralIncidentScale || 0;
  const relativeIncidentScale =
    brightnessCalibration.targetIncidentScaleAtClosest > 0
      ? incidentScaleAtObserver /
        brightnessCalibration.targetIncidentScaleAtClosest
      : 0;

  return {
    ...entry,
    atmosphereGeometry,
    transportObserverPositionMeters,
    transportSource,
    transportSourceConfig: transportSource.toJSON(),
    transportObserverSample,
    distanceFalloffScale: transportObserverSample.distanceFalloffScale,
    incidentScaleAtObserver,
    firstWavelengthIncidentScaleAtObserver,
    referenceIncidentScale,
    relativeIncidentScale,
    displayExposure: null,
    displayToneMapK: paperFigure1ToneMapK(),
    brightnessCalibration,
  };
}

function createFlatAppRotationSkydomeEntries() {
  const base = createFlatAppClosestSanJoseContext();
  const sourceEntries = createFlatAppRotationSourceEntries(base);
  const brightnessCalibration =
    createFlatLocalSunBrightnessCalibration(sourceEntries);

  return sourceEntries.map((entry) =>
    attachAlgorithm32FlatTransportEntry(entry, brightnessCalibration)
  );
}

function skydomeDirectionFromPixel(x, y, center, skyRadius) {
  const dx = x - center;
  const dy = y - center;
  const normalizedRadius = Math.sqrt(dx * dx + dy * dy) / skyRadius;
  const zenithAngle = normalizedRadius * Math.PI / 2;
  const azimuth = Math.atan2(dx, -dy);
  const sinZenith = Math.sin(zenithAngle);

  return [
    sinZenith * Math.sin(azimuth),
    Math.cos(zenithAngle),
    sinZenith * Math.cos(azimuth),
  ];
}

function algorithm32MarkerPosition(direction, center, skyRadius) {
  const altitude = Math.asin(clamp(direction[2], -1, 1));
  const zenithAngle = Math.PI / 2 - altitude;
  const azimuth = Math.atan2(direction[1], direction[0]);
  const markerRadius =
    clamp(zenithAngle / (Math.PI / 2), 0, 1) * skyRadius;

  return {
    x: center + Math.cos(azimuth) * markerRadius,
    y: center - Math.sin(azimuth) * markerRadius,
    altitudeDegrees: altitude * 180 / Math.PI,
    azimuthDegrees: azimuth * 180 / Math.PI,
  };
}

function renderFlatRotationSkydomeImage(entry) {
  const width = IMAGE_SIZE;
  const height = IMAGE_SIZE;
  const center = (width - 1) / 2;
  const skyRadius = SKY_RADIUS;
  const origin = flatObserverPositionMeters();
  const skyGeometry = flatArtificialCapGeometryRecord(origin);
  const atmosphereGeometry =
    entry.atmosphereGeometry || skyGeometry.atmosphereGeometry;
  const skyViewRayLengthLimit = skyGeometry.skyViewRayLengthLimit;
  const rayLengthLimitAtDirection = (direction) =>
    flatSkyViewRayLengthLimitMeters(origin, direction, skyViewRayLengthLimit);
  const computeSkyRadiance = (direction, viewDistanceMeters) =>
    computeFlatConfiguredSourceRadiance(
      origin,
      direction,
      entry.transportSource,
      {
        geometry: atmosphereGeometry,
        viewDistanceMeters,
        viewDistanceSource: skyViewRayLengthLimit.kind,
        includeDirectSun: false,
        includeSecondOrder: false,
        includeGroundBounce: false,
      }
    );
  const marker = algorithm32MarkerPosition(
    entry.algorithm32ObserverDirection,
    center,
    skyRadius
  );
  const rendered = renderAngularSkyImage({
    origin,
    rayLengthLimitAtSample: (sample) =>
      rayLengthLimitAtDirection(sample.direction),
    radianceAtSample: (sample) =>
      computeSkyRadiance(sample.direction, sample.rayLengthLimitMeters),
  });
  const pixels = rendered.pixels;
  const stats = rendered.stats;

  stats.zenithRadiance = computeSkyRadiance(
    [0, 0, 1],
    rayLengthLimitAtDirection([0, 0, 1])
  ).radiance;
  stats.sourceDirectionRadiance = computeSkyRadiance(
    entry.algorithm32ObserverDirection,
    rayLengthLimitAtDirection(entry.algorithm32ObserverDirection)
  ).radiance;
  stats.source = entry.transportSource.toJSON();
  stats.sourceSampleAtObserver = entry.transportObserverSample;
  stats.geometry = skyGeometry;
  stats.transportMode = {
    firstOrderScattering: true,
    directSunCameraRadiance: false,
    secondOrderScattering: false,
    groundBounce: false,
    localSecondOrderCacheStatus: "deferred",
  };

  return {
    name: entry.imageName,
    width,
    height,
    pixels,
    role:
      "algorithm32 flat artificial-cap first-order local-Sun observer angular sky view",
    offsetDegrees: entry.offsetDegrees,
    marker: {
      altitudeDegrees: entry.altitudeDegrees,
      azimuthDegrees: entry.azimuthDegrees,
      algorithm32AltitudeDegrees: marker.altitudeDegrees,
      algorithm32AzimuthDegrees: marker.azimuthDegrees,
      configuredDistanceKm: entry.observerDistanceKm,
      distanceFalloffScale: entry.distanceFalloffScale,
      incidentScaleAtObserver: entry.incidentScaleAtObserver,
      firstWavelengthIncidentScaleAtObserver:
        entry.firstWavelengthIncidentScaleAtObserver,
      relativeIncidentScale: entry.relativeIncidentScale,
      displayToneMapK: entry.displayToneMapK,
      x: marker.x,
      y: marker.y,
    },
    algorithm32: stats,
  };
}

function writeFlatRotationSkydomeImages(artifactDirectory, entries) {
  const images = entries.map((entry) => renderFlatRotationSkydomeImage(entry));

  for (const image of images) {
    writePng(
      path.join(artifactDirectory, image.name),
      image.width,
      image.height,
      image.pixels
    );
    delete image.pixels;
  }

  return images;
}

function collectFlatRotationSkydomeDiagnostics(entries) {
  return {
    offsetsDegrees: entries.map((entry) => entry.offsetDegrees),
    entries: entries.map((entry) => ({
      label: entry.label,
      offsetDegrees: entry.offsetDegrees,
      orbitDirection: entry.orbitDirection,
      offsetSemantic: entry.offsetSemantic,
      rawRotationAngleRad: entry.rawRotationAngleRad,
      normalizedRotationAngleRad: entry.normalizedRotationAngleRad,
      sourcePositionKm: entry.sourcePositionKm,
      observerSample: entry.observerSample,
      algorithm32ObserverDirection: entry.algorithm32ObserverDirection,
      transportObserverSample: entry.transportObserverSample,
      atmosphereGeometry: entry.atmosphereGeometry,
      observerDistanceKm: entry.observerDistanceKm,
      apparentAngularRadiusRad: entry.apparentAngularRadiusRad,
      distanceFalloffScale: entry.distanceFalloffScale,
      incidentScaleAtObserver: entry.incidentScaleAtObserver,
      firstWavelengthIncidentScaleAtObserver:
        entry.firstWavelengthIncidentScaleAtObserver,
      referenceIncidentScale: entry.referenceIncidentScale,
      relativeIncidentScale: entry.relativeIncidentScale,
      displayToneMapK: entry.displayToneMapK,
      brightnessCalibration: entry.brightnessCalibration,
      altitudeDegrees: entry.altitudeDegrees,
      azimuthDegrees: entry.azimuthDegrees,
      imageName: entry.imageName,
      sourceConfig: entry.sourceConfig,
      transportSourceConfig: entry.transportSourceConfig,
    })),
    summary: {
      count: entries.length,
      geometry: flatArtificialCapGeometryRecord(),
      brightnessCalibration: entries[0]?.brightnessCalibration || null,
      displayProfile: {
        spectralConversion: usesFullSpectralConversion()
          ? "full-spectral-cie"
          : "three-channel",
        toneMap: usesPaperFigure1ToneMap()
          ? "bruneton-comparison-source-k"
          : "demo-exposure",
        toneMapK: usesPaperFigure1ToneMap() ? paperFigure1ToneMapK() : null,
        aerosolProfile: usesBruneton2016Aerosols()
          ? "bruneton-2016-clear-sky"
          : "demo-default",
        ozoneAbsorption: includesOzoneAbsorption(),
      },
      minAltitudeDegrees: Math.min(
        ...entries.map((entry) => entry.altitudeDegrees)
      ),
      maxAltitudeDegrees: Math.max(
        ...entries.map((entry) => entry.altitudeDegrees)
      ),
      minDistanceKm: Math.min(
        ...entries.map((entry) => entry.observerDistanceKm)
      ),
      maxDistanceKm: Math.max(
        ...entries.map((entry) => entry.observerDistanceKm)
      ),
      distanceKmByOffset: Object.fromEntries(
        entries.map((entry) => [
          String(entry.offsetDegrees),
          entry.observerDistanceKm,
        ])
      ),
      altitudeDegreesByOffset: Object.fromEntries(
        entries.map((entry) => [
          String(entry.offsetDegrees),
          entry.altitudeDegrees,
        ])
      ),
      distanceFalloffScaleByOffset: Object.fromEntries(
        entries.map((entry) => [
          String(entry.offsetDegrees),
          entry.distanceFalloffScale,
        ])
      ),
      incidentScaleAtObserverByOffset: Object.fromEntries(
        entries.map((entry) => [
          String(entry.offsetDegrees),
          entry.incidentScaleAtObserver,
        ])
      ),
      firstWavelengthIncidentScaleAtObserverByOffset: Object.fromEntries(
        entries.map((entry) => [
          String(entry.offsetDegrees),
          entry.firstWavelengthIncidentScaleAtObserver,
        ])
      ),
      relativeIncidentScaleByOffset: Object.fromEntries(
        entries.map((entry) => [
          String(entry.offsetDegrees),
          entry.relativeIncidentScale,
        ])
      ),
      displayToneMapKByOffset: Object.fromEntries(
        entries.map((entry) => [
          String(entry.offsetDegrees),
          entry.displayToneMapK,
        ])
      ),
    },
  };
}

function buildFlatRotationSkydomeCriteria(entries, imageProducts) {
  const expectedOffsets = FLAT_APP_SKYDOME_ROTATION_OFFSETS_DEGREES;
  const actualOffsets = entries.map((entry) => entry.offsetDegrees);
  const imageNames = imageProducts.map((image) => image.name);
  const expectedImageNames = entries.map((entry) => entry.imageName);
  const offsetsMatch =
    actualOffsets.length === expectedOffsets.length &&
    expectedOffsets.every((offset, index) => offset === actualOffsets[index]);
  const allImagesGenerated =
    imageProducts.length === expectedImageNames.length &&
    expectedImageNames.every((name) => imageNames.includes(name)) &&
    imageProducts.every(
      (image) => image.width === IMAGE_SIZE && image.height === IMAGE_SIZE
    );
  const expectedSourceForEntry = (entry) =>
    entry.atmosphereGeometry?.source || flatLocalAtmosphereGeometryRecord().source;
  const expectedSourceForImage = (image) =>
    image.algorithm32?.geometry?.atmosphereGeometry?.source || null;
  const allFiniteLocalSamples = entries.every((entry) => {
    const expectedSource = expectedSourceForEntry(entry);

    return (
      entry.transportSource?.kind === expectedSource.kind &&
      entry.transportObserverSample?.kind === expectedSource.sampleKind &&
      Number.isFinite(entry.transportObserverSample?.distanceMeters) &&
      entry.transportObserverSample?.distanceKind === expectedSource.distanceKind &&
      entry.transportObserverSample?.visibilityPath ===
        expectedSource.visibilityPath
    );
  });
  const allAboveHorizon = entries.every((entry) => entry.altitudeDegrees > 0);
  const closestIsNearest =
    entries[0].observerDistanceKm ===
    Math.min(...entries.map((entry) => entry.observerDistanceKm));
  const farthestIs180 =
    entries[entries.length - 1].observerDistanceKm ===
    Math.max(...entries.map((entry) => entry.observerDistanceKm));
  const incidentScaleMatchesConfiguredDistance = entries.every((entry) => {
    const expectedScale =
      entry.referenceIncidentScale * entry.distanceFalloffScale;

    return Math.abs(entry.incidentScaleAtObserver - expectedScale) <= 1e-12;
  });
  const closestIncidentScaleMatchesDistantSun =
    Math.abs(
      entries[0].incidentScaleAtObserver -
        FLAT_APP_BRIGHTNESS_CALIBRATION_TARGET.targetIncidentScaleAtClosest
    ) <= 1e-12;
  const incidentScaleFallsWithDistance = entries.every(
    (entry, index) =>
      index === 0 ||
      entry.incidentScaleAtObserver <=
        entries[index - 1].incidentScaleAtObserver
  );
  const allAlgorithm32FirstOrderImages = imageProducts.every(
    (image) => {
      const expectedSource = expectedSourceForImage(image);

      return (
        image.role ===
        "algorithm32 flat artificial-cap first-order local-Sun observer angular sky view" &&
        image.algorithm32 &&
        expectedSource &&
        image.algorithm32.source?.kind === expectedSource.kind &&
        image.algorithm32.sourceSampleAtObserver?.kind ===
          expectedSource.sampleKind
      );
    }
  );
  const allFlatArtificialCapGeometryImages = imageProducts.every(
    (image) =>
      image.algorithm32?.geometry?.kind ===
        "flat-round-equivalent-artificial-cap" &&
      image.algorithm32?.geometry?.observerPositionMeters?.[2] ===
        ATMOSPHERE.observerHeightMeters &&
      image.algorithm32?.geometry?.footprintRadiusMeters ===
        ROUND_EQUIVALENT_CAP_FOOTPRINT_RADIUS_METERS &&
      image.algorithm32?.geometry?.virtualCapRadiusMeters ===
        ROUND_EQUIVALENT_CAP_RADIUS_METERS
  );
  const allImagesHaveRadiance = imageProducts.every((image) =>
    image.algorithm32?.maxRadiance?.some((value) => value > 0)
  );
  const allSkyViewLimitsAreRendererScoped = imageProducts.every((image) => {
    const limit = image.algorithm32?.geometry?.skyViewRayLengthLimit;

    return (
      limit?.kind === flatRoundEquivalentSkyViewLimitRecord().kind &&
      limit?.scope === flatRoundEquivalentSkyViewLimitRecord().scope
    );
  });
  const allLocalSecondOrderDeferred = imageProducts.every((image) => {
    const expectedSource = expectedSourceForImage(image);

    return (
      expectedSource &&
      image.algorithm32?.sourceSampleAtObserver?.kind ===
        expectedSource.sampleKind &&
      image.algorithm32?.sourceSampleAtObserver?.distanceKind ===
        expectedSource.distanceKind &&
      image.algorithm32?.transportMode?.firstOrderScattering === true &&
      image.algorithm32?.transportMode?.secondOrderScattering === false &&
      image.algorithm32?.transportMode?.localSecondOrderCacheStatus ===
        "deferred"
    );
  });
  const criteria = [
    criterion("uses-app-config-only-for-source-definition", "pass", {
      tolerance: "structural",
      measuredError: 0,
      sourceOrStatus: "app configuration boundary",
    }),
    criterion("requested-rotation-offsets-present", offsetsMatch ? "pass" : "fail", {
      tolerance: expectedOffsets.join(", "),
      measuredError: {
        expectedOffsets,
        actualOffsets,
      },
      sourceOrStatus: "user request",
    }),
    criterion(
      "all-skydome-images-generated",
      allImagesGenerated ? "pass" : "fail",
      {
        tolerance: `${expectedImageNames.length} images at ${IMAGE_SIZE}x${IMAGE_SIZE}`,
        measuredError: {
          expectedImageNames,
          imageProducts: imageProducts.map((image) => ({
            name: image.name,
            width: image.width,
            height: image.height,
          })),
        },
        sourceOrStatus: "artifact output contract",
      }
    ),
    criterion(
      "all-source-samples-match-configured-finite-source",
      allFiniteLocalSamples ? "pass" : "fail",
      {
        tolerance:
          "transport source and observer samples match atmosphereGeometry.source for every offset",
        measuredError: entries.map((entry) => ({
          offsetDegrees: entry.offsetDegrees,
          expectedSource: expectedSourceForEntry(entry),
          sourceKind: entry.transportSource?.kind,
          sampleKind: entry.transportObserverSample?.kind,
          distanceMeters: entry.transportObserverSample?.distanceMeters,
          distanceKind: entry.transportObserverSample?.distanceKind,
          visibilityPath: entry.transportObserverSample?.visibilityPath,
        })),
        sourceOrStatus: "local source object contract",
      }
    ),
    criterion("all-diagnostic-suns-above-san-jose-horizon", allAboveHorizon ? "pass" : "fail", {
      tolerance: "altitudeDegrees > 0 for every offset",
      measuredError: entries.map((entry) => ({
        offsetDegrees: entry.offsetDegrees,
        altitudeDegrees: entry.altitudeDegrees,
      })),
      sourceOrStatus: "diagnostic visibility check",
    }),
    criterion(
      "closest-and-180-distance-ordering",
      closestIsNearest && farthestIs180 ? "pass" : "fail",
      {
        tolerance: "0 deg is nearest and 180 deg is farthest",
        measuredError: entries.map((entry) => ({
          offsetDegrees: entry.offsetDegrees,
          distanceKm: entry.observerDistanceKm,
        })),
        sourceOrStatus: "closest-approach diagnostic geometry",
      }
    ),
    criterion(
      "source-sample-uses-configured-distance-falloff",
      incidentScaleMatchesConfiguredDistance ? "pass" : "fail",
      {
        tolerance:
          "incidentScaleAtObserver == referenceIncidentScale * distanceFalloffScale",
        measuredError: entries.map((entry) => ({
          offsetDegrees: entry.offsetDegrees,
          distanceKm: entry.observerDistanceKm,
          referenceDistanceKm: entry.observerSample.referenceDistanceKm,
          distanceFalloffScale: entry.distanceFalloffScale,
          referenceIncidentScale: entry.referenceIncidentScale,
          incidentScaleAtObserver: entry.incidentScaleAtObserver,
          expectedIncidentScale:
            entry.referenceIncidentScale * entry.distanceFalloffScale,
        })),
        sourceOrStatus:
          "calibrated local radiance model with app configured distance falloff",
      }
    ),
    criterion(
      "closest-approach-brightness-calibrated-to-distant-sun",
      closestIncidentScaleMatchesDistantSun ? "pass" : "fail",
      {
        tolerance:
          "closest incidentScaleAtObserver == 1 distant-directional-sun incident scale",
        measuredError: {
          target:
            FLAT_APP_BRIGHTNESS_CALIBRATION_TARGET.targetIncidentScaleAtClosest,
          actual: entries[0].incidentScaleAtObserver,
          brightnessCalibration: entries[0].brightnessCalibration,
        },
        sourceOrStatus:
          "user-directed calibration to distant solar-noon sky brightness",
      }
    ),
    criterion(
      "configured-distance-incident-scale-ordering",
      incidentScaleFallsWithDistance ? "pass" : "fail",
      {
        tolerance:
          "incidentScaleAtObserver must not increase as configured local Sun distance increases",
        measuredError: entries.map((entry) => ({
          offsetDegrees: entry.offsetDegrees,
          configuredDistanceKm: entry.observerSample.configuredDistanceKm,
          incidentScaleAtObserver: entry.incidentScaleAtObserver,
          relativeIncidentScale: entry.relativeIncidentScale,
        })),
        sourceOrStatus: "local source object contract",
      }
    ),
    criterion(
      "sky-views-render-through-shared-angular-image-loop",
      allAlgorithm32FirstOrderImages && allImagesHaveRadiance ? "pass" : "fail",
      {
        tolerance:
          "each PNG role is algorithm32 flat artificial-cap first-order local-Sun observer angular sky view and records nonzero radiance",
        measuredError: imageProducts.map((image) => ({
          name: image.name,
          role: image.role,
          maxRadiance: image.algorithm32?.maxRadiance,
          maxDisplayRgb: image.algorithm32?.maxDisplayRgb,
          expectedSource: expectedSourceForImage(image),
          transportSourceKind: image.algorithm32?.source?.kind,
          sourceKind: image.algorithm32?.sourceSampleAtObserver?.kind,
          distanceKind: image.algorithm32?.sourceSampleAtObserver?.distanceKind,
        })),
        sourceOrStatus: "Algorithm32 first-order source integration",
      }
    ),
    criterion(
      "flat-sky-view-uses-round-equivalent-artificial-cap",
      allFlatArtificialCapGeometryImages ? "pass" : "fail",
      {
        tolerance:
          "flat artifact uses observer z=eye height and artificial cap footprint radius matching round atmosphere horizon distance",
        measuredError: imageProducts.map((image) => ({
          name: image.name,
          geometry: image.algorithm32?.geometry,
        })),
        sourceOrStatus: "flat geometry correction",
      }
    ),
    criterion(
      "sky-view-ray-length-limit-is-renderer-scoped",
      allSkyViewLimitsAreRendererScoped ? "pass" : "fail",
      {
        tolerance:
          "skyViewRayLengthLimit.scope records observer angular sky renderer only",
        measuredError: imageProducts.map((image) => ({
          name: image.name,
          skyViewRayLengthLimit:
            image.algorithm32?.geometry?.skyViewRayLengthLimit,
        })),
        sourceOrStatus: "renderer-scoped sky view policy",
      }
    ),
    criterion("local-second-order-cache-explicitly-deferred", allLocalSecondOrderDeferred ? "pass" : "fail", {
      tolerance: "first-order local source artifact; finite local source sample recorded",
      measuredError: imageProducts.map((image) => ({
        name: image.name,
        expectedSource: expectedSourceForImage(image),
        sourceKind: image.algorithm32?.sourceSampleAtObserver?.kind,
        distanceKind: image.algorithm32?.sourceSampleAtObserver?.distanceKind,
        transportMode: image.algorithm32?.transportMode,
      })),
      sourceOrStatus: "POC milestone boundary",
      notes:
        "This milestone integrates finite local source samples into first-order Algorithm32 scattering. Local-source second-order cache design remains a later milestone.",
    }),
  ];
  const status = criteria.every((entry) => entry.status === "pass")
    ? "accepted"
    : "rejected";

  return {
    status,
    passed: criteria.filter((entry) => entry.status === "pass").length,
    failed: criteria.filter((entry) => entry.status === "fail").length,
    unresolved: 0,
    notApplicable: 0,
    criteria,
  };
}

function makeFlatRotationSkydomeStateGoal(criteriaResults) {
  return `# Flat App Rotation Skydome Diagnostics

Goal: generate first-order Algorithm32 flat/local observer angular sky images
for the app-config false Sun placement at closest San Jose approach and at 45,
90, 135, and 180 degrees forward in time around the same clockwise
date-resolved latitude-ring rotation, using
an artificial cap whose footprint radius matches the round atmosphere horizon
radius as a skydome-renderer ray length limit, plus a calibrated local-source
brightness whose closest approach matches the distant-Sun unit incident scale.

Success criteria:

- use app configuration only for the San Jose root and false-Sun definition;
- independently derive all source positions and observer source samples;
- treat each source-to-sample distance as the configured finite local Sun
  distance for the source sample;
- compute source incident scale from the configured inverse-square radiance
  falloff model after calibrating the closest observer sample to distant-Sun
  unit incident scale, not from a post-render brightness proxy;
- render each angular sky view through the same fisheye image loop as the
  round Algorithm32 domes, but with flat altitude, a renderer-owned artificial
  cap ray length limit, and the finite source sample contract;
- keep generated PNGs as pure observer sky views, with source marker
  diagnostics in JSON instead of painted into the image;
- generate one ${IMAGE_SIZE} x ${IMAGE_SIZE} angular sky PNG per requested offset;
- defer local-source second-order cache work explicitly.

Status: ${criteriaResults.status}
`;
}

function makeFlatRotationSkydomeInputsRecord(entries) {
  return {
    schemaVersion: 1,
    runId: STEP.registryId || STEP.label,
    stateGoal:
      "Generate first-order Algorithm32 observer angular sky views for local flat Sun rotation offsets using a renderer-owned round-equivalent artificial-cap ray length limit and closest-approach distant-Sun brightness calibration.",
    geometry: flatArtificialCapGeometryRecord(),
    brightnessCalibration: entries[0]?.brightnessCalibration || null,
    displayProfile: {
      spectralConversion: usesFullSpectralConversion()
        ? "full-spectral-cie"
        : "three-channel",
      toneMap: usesPaperFigure1ToneMap()
        ? "bruneton-comparison-source-k"
        : "demo-exposure",
      toneMapK: usesPaperFigure1ToneMap() ? paperFigure1ToneMapK() : null,
      aerosolProfile: usesBruneton2016Aerosols()
        ? "bruneton-2016-clear-sky"
        : "demo-default",
      ozoneAbsorption: includesOzoneAbsorption(),
      directSolarDiscCameraRadiance: false,
    },
    sourceBoundary: {
      appConfigurationUsed: [
        "src/flat/features/flat-simulation/models/consts.js DEFAULT_FLAT_SIMULATION_CONFIG",
        "src/flat/features/flat-simulation/models/consts.js DEFAULT_FLAT_SIMULATION_SUN",
        "src/flat/features/flat-simulation/models/consts.js DEFAULT_ATMOSPHERE.rendering.falseSunRadiance",
        "src/flat/features/flat-simulation/models/consts.js MEAN_EARTH_RADIUS_KM",
      ],
      note:
        "App code is configuration only. Projection, closest approach, rotation offsets, source direction, configured source distance, renderer-owned sky-view ray length limit, and angular sky marker placement are computed inside atmosflat32. The app false-Sun brightness scale is recorded as input provenance, then the Algorithm32 transport source is calibrated so closest approach receives the same unit incident scale as the distant-directional Sun.",
    },
    request: SAN_JOSE_CLOSEST_APPROACH_REQUEST,
    offsetsDegrees: entries.map((entry) => entry.offsetDegrees),
    orbitDirection: FLAT_APP_FORWARD_TIME_ORBIT_DIRECTION,
    offsetSemantic:
      "positive requested offsets are forward solar time from closest approach",
    sourceConfigs: entries.map((entry) => entry.sourceConfig),
    transportSourceConfigs: entries.map((entry) => entry.transportSourceConfig),
    outputProducts: [
      ...entries.map((entry) => entry.imageName),
      "flat-app-rotation-skydome-diagnostics.json",
      "flat-app-rotation-image-diagnostics.json",
      "criteria-results.json",
      "result.json",
      "report.md",
    ],
  };
}

function makeFlatRotationSkydomeResultRecord({
  artifactDirectory,
  criteriaResults,
  diagnostics,
  imageProducts,
}) {
  return {
    status: criteriaResults.status,
    step: STEP,
    artifactDirectory: path.relative(ROOT, artifactDirectory).replace(/\\/g, "/"),
    summary: {
      criteria: {
        passed: criteriaResults.passed,
        failed: criteriaResults.failed,
        unresolved: criteriaResults.unresolved,
        notApplicable: criteriaResults.notApplicable,
      },
      skydomes: diagnostics.summary,
      images: imageProducts,
    },
    outputs: [
      ...imageProducts.map((image) => image.name),
      "flat-app-rotation-skydome-diagnostics.json",
      "flat-app-rotation-image-diagnostics.json",
      "criteria-results.json",
      "result.json",
      "report.md",
    ],
  };
}

function makeFlatRotationSkydomeReport({
  criteriaResults,
  diagnostics,
  imageProducts,
}) {
  const criteriaLines = criteriaResults.criteria
    .map((entry) => `- ${entry.criterionId}: ${entry.status}`)
    .join("\n");
  const imageLines = imageProducts
    .map((image) => `- ${image.name}: offset ${image.offsetDegrees} deg`)
    .join("\n");
  const diagnosticLines = diagnostics.entries
    .map(
      (entry) =>
        `- ${entry.label}: configuredDistanceKm=${entry.observerDistanceKm}, altitudeDeg=${entry.altitudeDegrees}, azimuthDeg=${entry.azimuthDegrees}, distanceFalloffScale=${entry.distanceFalloffScale}, incidentScaleAtObserver=${entry.incidentScaleAtObserver}, relativeIncidentScaleToClosest=${entry.relativeIncidentScale}, displayToneMapK=${entry.displayToneMapK}`
    )
    .join("\n");
  const calibration = diagnostics.summary.brightnessCalibration;
  const displayProfile = diagnostics.summary.displayProfile;

  return `# Atmosflat32 Flat App Rotation Skydomes

Status: ${criteriaResults.status} (${criteriaResults.passed} passed, ${criteriaResults.failed} failed, ${criteriaResults.unresolved} unresolved, ${criteriaResults.notApplicable} not-applicable).

This POC artifact generates first-order Algorithm32 flat/local observer angular
sky PNGs for the same app-config flat local Sun placement at offsets from
closest San Jose approach: ${diagnostics.offsetsDegrees.join(", ")} degrees.

The app is used only as the configuration source. Projection, closest approach,
rotation offsets, local point-source direction, configured source distance,
renderer-owned sky-view ray length, apparent size, and sky marker placement
are computed independently in atmosflat32.

Brightness calibration:

- target: ${calibration.kind}
- distant comparison scene: ${calibration.distantSceneKey}
- closest configured distance: ${calibration.closestConfiguredDistanceKm} km
- closest falloff scale: ${calibration.closestDistanceFalloffScale}
- original app solarIrradianceScale: ${calibration.originalSolarIrradianceScale}
- original closest incident scale: ${calibration.originalIncidentScaleAtClosest}
- calibrated transport solarIrradianceScale: ${calibration.calibratedSolarIrradianceScale}
- calibrated closest incident scale: ${calibration.calibratedIncidentScaleAtClosest}
- calibration multiplier: ${calibration.calibrationMultiplier}

The generated PNGs are pure observer sky views. Diagnostic source marker
coordinates are recorded in JSON metadata but are not painted into the images.

The image loop is the same fisheye skydome method used by the round-geometry
distant-Sun domes. The atmosphere geometry is different: observer position is
${diagnostics.summary.geometry.observerPositionMeters.join(", ")} meters in a
flat z-up atmosphere, density altitude remains flat z, and the skydome renderer
limits observer view rays with a round-equivalent artificial cap centered at
${diagnostics.summary.geometry.virtualCapCenterMeters.join(", ")} meters with
radius ${diagnostics.summary.geometry.virtualCapRadiusMeters} meters. Its
observer-level footprint radius is
${diagnostics.summary.geometry.footprintRadiusMeters} meters
(${diagnostics.summary.geometry.footprintRadiusKm} km), matching the round
Algorithm32 horizon distance for the same bottom and top radii. Source-path
transmittance is not capped by this renderer limit; it uses the configured flat
top atmosphere plane and the finite source distance.

The source object treats each finite source-to-sample distance as model data.
For this calibrated false Sun, source incident scale follows the configured
\`point-inverse-square-reference\` falloff rule:
\`incidentScale = intensity * solarIrradianceScale * (referenceDistanceKm / distanceKm)^2\`.
Here \`solarIrradianceScale\` is the calibrated transport value above, not the
raw app display/light scale.
The PNGs are rendered from first-order Algorithm32 flat/local scattering using
that source-sample incident scale. Display tone mapping is applied only after
transport. The display profile is ${displayProfile.spectralConversion},
${displayProfile.aerosolProfile}, ozoneAbsorption=${displayProfile.ozoneAbsorption},
toneMap=${displayProfile.toneMap}, toneMapK=${displayProfile.toneMapK}. Local-
source second-order scattering/cache behavior is explicitly deferred.

Generated angular sky views:

${imageLines}

Source diagnostics:

${diagnosticLines}

Criteria:

${criteriaLines}

Notes:

- These are first-order flat/local source scattering artifacts. They are
  not second-order local-source cache validation.
- No unit tests were added for this POC lane.
`;
}

function makeFlatRotationSkydomeEquationsRecord() {
  return {
    status: "flat-app-rotation-skydome-diagnostic",
    equations: [
      {
        name: "rotation from closest approach",
        expression:
          "position(theta) = rotateY(initialSunPosition, closestAngle + offsetAngle)",
        purpose:
          "Places the same configured false Sun along its date-resolved clockwise latitude-ring rotation at requested forward-time angular offsets from closest San Jose approach.",
        source: "algorithmic diagnostic math from app configuration",
      },
      {
        name: "observer source direction",
        expression: "direction = normalize(sourcePositionKm - observerPositionKm)",
        purpose:
          "Computes each local source direction seen from the San Jose observer.",
        source: "algorithmic diagnostic math from app configuration",
      },
      {
        name: "configured local Sun incident scale",
        expression:
          "incidentScale = intensity * solarIrradianceScale * (referenceDistanceKm / distanceKm)^2",
        purpose:
          "Treats the finite source-to-sample distance as the configured local Sun distance and applies the app-config inverse-square local radiance model.",
        source:
          "app configuration DEFAULT_ATMOSPHERE.rendering.falseSunRadiance plus algorithmic source object contract",
      },
      {
        name: "round-equivalent artificial-cap view path endpoint",
        expression:
          "distance = intersectRaySphere(origin - [0,0,-bottomRadiusMeters], direction, topRadiusMeters)",
        purpose:
          "Lets the skydome renderer terminate flat/local observer view rays at an artificial cap with the same observer-level footprint radius as the round atmosphere.",
        source:
          "Algorithm32 POC transport contract plus round-equivalent artificial-cap geometry decision",
      },
      {
        name: "configured flat source transmittance path",
        expression:
          "sourcePathDistance = min(configuredFiniteSourceDistance, distanceToFlatTopAtmospherePlane)",
        purpose:
          "Keeps source-path optical depth tied to the configured flat atmosphere geometry instead of the skydome renderer's artificial view-ray limit.",
        source:
          "Algorithm32 POC transport contract plus renderer-scoped sky-view limit decision",
      },
      {
        name: "Algorithm32 flat/local first-order local source scattering",
        expression:
          "L += T_view * T_source * incidentScale(lambda) * density * scatteringCoefficient(lambda) * phase(viewDirection, sourceDirection) * ds",
        purpose:
          "Integrates local finite-source incident light through the first-order Algorithm32 scattering loop using flat altitude density, renderer-provided view distance, and configured flat source-path transmittance.",
        source: "Algorithm32 POC transport contract",
      },
      {
        name: "fisheye diagnostic projection",
        expression:
          "rho = (pi/2 - asin(direction.z)) / (pi/2); x = cx + cos(azimuth) * rho * R; y = cy - sin(azimuth) * rho * R",
        purpose:
          "Maps each local source direction into JSON marker diagnostics for the generated observer sky view; markers are not painted into the PNG.",
        source: "algorithmic diagnostic display",
      },
    ],
    constants: {
      request: SAN_JOSE_CLOSEST_APPROACH_REQUEST,
      offsetsDegrees: FLAT_APP_SKYDOME_ROTATION_OFFSETS_DEGREES,
      orbitDirection: FLAT_APP_FORWARD_TIME_ORBIT_DIRECTION,
      offsetSemantic:
        "positive requested offsets are forward solar time from closest approach",
      imageSizePixels: IMAGE_SIZE,
      coordinateFrame:
        "flat transport frame, meters, z up; app flat scene is converted from kilometers and y up",
      flatGeometry: {
        ...flatArtificialCapGeometryRecord(),
      },
      brightnessCalibrationTarget: FLAT_APP_BRIGHTNESS_CALIBRATION_TARGET,
      displayProfile: {
        spectralConversion: usesFullSpectralConversion()
          ? "full-spectral-cie"
          : "three-channel",
        toneMap: usesPaperFigure1ToneMap()
          ? "bruneton-comparison-source-k"
          : "demo-exposure",
        toneMapK: usesPaperFigure1ToneMap() ? paperFigure1ToneMapK() : null,
      },
      radianceConfig: SAN_JOSE_CLOSEST_APPROACH_REQUEST.radianceConfig,
    },
  };
}

function appendFlatRotationSkydomeRunningLogEntry(
  artifactDirectory,
  resultRecord
) {
  ensureDirectory(ARTIFACT_ROOT);
  const runningLogPath = path.join(ARTIFACT_ROOT, "running-log.md");
  const relativeArtifact = path
    .relative(ROOT, artifactDirectory)
    .replace(/\\/g, "/");
  const summary = resultRecord.summary.skydomes;
  const entry = `## ${path.basename(artifactDirectory)}

- completedAt: ${new Date().toISOString()}
- status: ${resultRecord.status}
- artifact: ${relativeArtifact}
- changed: generated first-order Algorithm32 flat/local observer sky views whose source samples own calibrated finite-distance falloff and whose skydome renderer supplies the round-equivalent artificial-cap view ray length for ${summary.count} rotation offsets from closest San Jose approach.
- learned: artificial cap footprint=${summary.geometry.footprintRadiusMeters} m, observer=${summary.geometry.observerPositionMeters.join(", ")} m, configured source distance range ${summary.minDistanceKm} km to ${summary.maxDistanceKm} km; incident scale range ${summary.incidentScaleAtObserverByOffset["180"]} to ${summary.incidentScaleAtObserverByOffset["0"]}; closest brightness calibration multiplier=${summary.brightnessCalibration.calibrationMultiplier}.
- next: local-source first-order scattering is integrated; local-source second-order cache behavior remains deferred.

`;

  fs.appendFileSync(runningLogPath, entry);
}

function runFlatAppRotationSkydomes() {
  const artifactDirectory = nextArtifactDirectory();
  const entries = createFlatAppRotationSkydomeEntries();
  const imageProducts = writeFlatRotationSkydomeImages(
    artifactDirectory,
    entries
  );
  const diagnostics = collectFlatRotationSkydomeDiagnostics(entries);
  const criteriaResults = buildFlatRotationSkydomeCriteria(
    entries,
    imageProducts
  );
  const resultRecord = makeFlatRotationSkydomeResultRecord({
    artifactDirectory,
    criteriaResults,
    diagnostics,
    imageProducts,
  });
  const logLines = [
    `artifactDirectory=${artifactDirectory}`,
    `node=${process.version}`,
    `step=${STEP.label}`,
    `offsetsDegrees=${diagnostics.offsetsDegrees.join(",")}`,
    ...imageProducts.map((image) => `wrote ${image.name}`),
    `status=${criteriaResults.status}`,
  ];

  writeJson(path.join(artifactDirectory, "command.json"), {
    command: process.argv.join(" "),
    defaultCommand:
      "node scripts/flat/atmosflat32/run.js --step=flat-app-rotation-skydomes",
    step: STEP.registryId || STEP.label,
  });
  writeText(
    path.join(artifactDirectory, "state-goal.md"),
    makeFlatRotationSkydomeStateGoal(criteriaResults)
  );
  writeJson(
    path.join(artifactDirectory, "inputs.json"),
    makeFlatRotationSkydomeInputsRecord(entries)
  );
  writeJson(
    path.join(artifactDirectory, "flat-app-rotation-skydome-diagnostics.json"),
    diagnostics
  );
  writeJson(
    path.join(artifactDirectory, "flat-app-rotation-image-diagnostics.json"),
    imageProducts
  );
  writeJson(path.join(artifactDirectory, "criteria-results.json"), criteriaResults);
  writeJson(path.join(artifactDirectory, "result.json"), resultRecord);
  writeText(
    path.join(artifactDirectory, "report.md"),
    makeFlatRotationSkydomeReport({
      criteriaResults,
      diagnostics,
      imageProducts,
    })
  );
  writeJson(path.join(artifactDirectory, "provenance.json"), {
    step: STEP,
    resultStatus: criteriaResults.status,
    createdAt: new Date().toISOString(),
    command: process.argv.join(" "),
    script: path.relative(ROOT, __filename).replace(/\\/g, "/"),
    artifactDirectory: path.relative(ROOT, artifactDirectory).replace(/\\/g, "/"),
    runtime: {
      node: process.version,
      platform: process.platform,
    },
    sourceBoundary: {
      appConfigurationUsed:
        "DEFAULT_FLAT_SIMULATION_CONFIG, DEFAULT_FLAT_SIMULATION_SUN, DEFAULT_ATMOSPHERE.rendering.falseSunRadiance, and MEAN_EARTH_RADIUS_KM from flat app consts",
      localProjectSourcesUsed:
        "app configuration constants only; projection, closest approach, rotation offsets, direction, configured source distance, source incident scale, and apparent size are computed in atmosflat32",
      note:
        "These skydomes visualize source placement only; they are not local Algorithm32 scattering validation.",
    },
    diagnosticsSummary: diagnostics.summary,
    imageProducts,
    criteriaSummary: {
      status: criteriaResults.status,
      passed: criteriaResults.passed,
      failed: criteriaResults.failed,
      unresolved: criteriaResults.unresolved,
      notApplicable: criteriaResults.notApplicable,
    },
    outputs: resultRecord.outputs,
  });
  writeJson(
    path.join(artifactDirectory, "equations-and-constants.json"),
    makeFlatRotationSkydomeEquationsRecord()
  );
  writeText(path.join(artifactDirectory, "run.log"), `${logLines.join("\n")}\n`);
  fs.copyFileSync(__filename, path.join(artifactDirectory, "script-snapshot.js"));
  appendFlatRotationSkydomeRunningLogEntry(artifactDirectory, resultRecord);

  for (const line of logLines) {
    console.log(line);
  }
}

function appendFlatAppRunningLogEntry(artifactDirectory, resultRecord) {
  ensureDirectory(ARTIFACT_ROOT);
  const runningLogPath = path.join(ARTIFACT_ROOT, "running-log.md");
  const relativeArtifact = path
    .relative(ROOT, artifactDirectory)
    .replace(/\\/g, "/");
  const summary = resultRecord.summary.flatAppClosestApproach;
  const entry = `## ${path.basename(artifactDirectory)}

- completedAt: ${new Date().toISOString()}
- status: ${resultRecord.status}
- artifact: ${relativeArtifact}
- changed: added an image-bearing app-config-driven flat-local-point-sun diagnostic at independently computed closest San Jose approach.
- learned: closest distance ${summary.atmosphereSunDistanceKm} km; source/derived-state observer direction max delta ${summary.observerDirectionMaxDelta}.
- next: use this source placement as the fixture for the first flat/local Sun scattering diagnostic.

`;

  fs.appendFileSync(runningLogPath, entry);
}

function runFlatAppClosestSanJosePosition() {
  const artifactDirectory = nextArtifactDirectory();
  const logLines = [];
  const context = createFlatAppClosestSanJoseContext();
  const diagnostics = collectFlatAppClosestSourceDiagnostics(context);
  const imageProducts = writeFlatAppClosestImages(artifactDirectory, context);
  const criteriaResults = buildFlatAppClosestCriteria(
    context,
    diagnostics,
    imageProducts
  );
  const resultRecord = makeFlatAppClosestResultRecord({
    artifactDirectory,
    criteriaResults,
    diagnostics,
    imageProducts,
  });
  const equations = makeFlatAppClosestEquationsRecord(context);

  logLines.push(`artifactDirectory=${artifactDirectory}`);
  logLines.push(`node=${process.version}`);
  logLines.push(`step=${STEP.label}`);
  logLines.push(
    `closestRotationAngleRad=${context.closestRotationAngleRad}`
  );
  logLines.push(
    `closestDistanceKm=${diagnostics.summary.atmosphereSunDistanceKm}`
  );
  for (const image of imageProducts) {
    logLines.push(`wrote ${image.name}`);
  }
  logLines.push(`status=${criteriaResults.status}`);

  writeJson(path.join(artifactDirectory, "command.json"), {
    command: process.argv.join(" "),
    defaultCommand:
      "node scripts/flat/atmosflat32/run.js --step=flat-app-closest-san-jose-position",
    step: STEP.registryId || STEP.label,
  });
  writeText(
    path.join(artifactDirectory, "state-goal.md"),
    makeFlatAppClosestStateGoal(criteriaResults)
  );
  writeJson(
    path.join(artifactDirectory, "inputs.json"),
    makeFlatAppClosestInputsRecord(context)
  );
  writeJson(
    path.join(artifactDirectory, "flat-app-source-diagnostics.json"),
    diagnostics
  );
  writeJson(
    path.join(artifactDirectory, "flat-app-image-diagnostics.json"),
    imageProducts
  );
  writeJson(path.join(artifactDirectory, "criteria-results.json"), criteriaResults);
  writeJson(path.join(artifactDirectory, "result.json"), resultRecord);
  writeText(
    path.join(artifactDirectory, "report.md"),
    makeFlatAppClosestReport({ criteriaResults, diagnostics, imageProducts })
  );
  writeJson(path.join(artifactDirectory, "provenance.json"), {
    step: STEP,
    resultStatus: criteriaResults.status,
    createdAt: new Date().toISOString(),
    command: process.argv.join(" "),
    script: path.relative(ROOT, __filename).replace(/\\/g, "/"),
    artifactDirectory: path.relative(ROOT, artifactDirectory).replace(/\\/g, "/"),
    runtime: {
      node: process.version,
      platform: process.platform,
    },
    sourceBoundary: {
      appConfigurationUsed:
        "DEFAULT_FLAT_SIMULATION_CONFIG, DEFAULT_FLAT_SIMULATION_SUN, DEFAULT_ATMOSPHERE.rendering.falseSunRadiance, and MEAN_EARTH_RADIUS_KM from flat app consts",
      localProjectSourcesUsed:
        "app configuration constants only; projection, closest approach, direction, configured source distance, source incident scale, and apparent size are computed in atmosflat32",
      note:
        "This diagnostic creates a flat-local-point-sun source from app configuration at independently computed closest San Jose approach.",
    },
    appFlatSunContext: compactFlatAppContext(context),
    diagnosticsSummary: diagnostics.summary,
    imageProducts,
    criteriaSummary: {
      status: criteriaResults.status,
      passed: criteriaResults.passed,
      failed: criteriaResults.failed,
      unresolved: criteriaResults.unresolved,
      notApplicable: criteriaResults.notApplicable,
    },
    outputs: resultRecord.outputs,
  });
  writeJson(path.join(artifactDirectory, "equations-and-constants.json"), equations);
  writeText(path.join(artifactDirectory, "run.log"), `${logLines.join("\n")}\n`);
  fs.copyFileSync(__filename, path.join(artifactDirectory, "script-snapshot.js"));
  appendFlatAppRunningLogEntry(artifactDirectory, resultRecord);

  for (const line of logLines) {
    console.log(line);
  }
}

function appendRunningLogEntry(artifactDirectory, resultRecord) {
  ensureDirectory(ARTIFACT_ROOT);
  const runningLogPath = path.join(ARTIFACT_ROOT, "running-log.md");
  const relativeArtifact = path
    .relative(ROOT, artifactDirectory)
    .replace(/\\/g, "/");
  const entry = `## ${path.basename(artifactDirectory)}

- completedAt: ${new Date().toISOString()}
- status: ${resultRecord.status}
- artifact: ${relativeArtifact}
- changed: routed the default distant directional Sun through a runtime source object.
- learned: image parity maxAbsRgbDelta=${resultRecord.summary.imageParity.maxAbsRgbDelta}; selected-ray maxAbs=${resultRecord.summary.selectedRayParity.maxRadianceAbs}.
- next: ${
    resultRecord.status === "accepted"
      ? "first milestone accepted; do not proceed to local Sun without explicit next-step direction."
      : "diagnose failing criteria in the next numbered artifact."
  }

`;

  fs.appendFileSync(runningLogPath, entry);
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
  if (STEP.registryId === "distant-source-abstraction-baseline") {
    return `# ${STEP.title}

Status: evaluated by criteria-results.json.

This artifact proves the first atmosflat32 milestone: the default Figure 1
distant directional Sun is routed through a runtime source object while the
copied Algorithm32 step-032 transport and display output remain unchanged.

The active source adapter is \`distant-directional-sun\`. It returns one
infinite-distance source sample at each atmosphere sample position, with the
same direction, spectral solar irradiance, and sample-to-top-atmosphere
visibility/transmittance meaning used by experiment 032. No local Sun,
finite-size Sun body, shader path, app integration, or production API is part
of this run.

Acceptance evidence:

- generated the four Figure 1 sky domes at ${IMAGE_SIZE} x ${IMAGE_SIZE};
- compared each generated PNG against the accepted step-032 reference PNG;
- compared selected rays between the copied legacy path and source-object path;
- verified the no-direct-solar-disc camera-radiance policy;
- verified display conversion remains a post-transport consumer.

Generated outputs:

${sceneOutputs.map((output) => `- ${output}`).join("\n")}

Next step:

Use this accepted default-source baseline as the handoff before adding a local
or flat Sun adapter. Keep new source-specific behavior in the source object,
geometry helper, or cache-plan boundary rather than adding branches through the
Algorithm32 transport loops.
`;
  }

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
  if (STEP.registryId === FLAT_APP_CLOSEST_SAN_JOSE_STEP_ID) {
    runFlatAppClosestSanJosePosition();
    return;
  }

  if (STEP.registryId === FLAT_APP_ROTATION_SKYDOMES_STEP_ID) {
    runFlatAppRotationSkydomes();
    return;
  }

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

  const imageComparisons = collectImageComparisons(
    artifactDirectory,
    sceneOutputs
  );
  logLines.push("compared generated domes with step-032 reference PNGs");
  const selectedRayDiagnostics = collectSelectedRayDiagnostics(scenes);
  logLines.push("computed selected-ray legacy/source diagnostics");
  const criteriaResults = buildCriteriaResults({
    imageComparisons,
    selectedRayDiagnostics,
    sceneOutputs,
    scenes,
  });
  const resultRecord = makeResultRecord({
    artifactDirectory,
    criteriaResults,
    imageComparisons,
    selectedRayDiagnostics,
    sceneOutputs,
  });
  const equations = makeEquationsRecord();

  writeJson(path.join(artifactDirectory, "command.json"), {
    command: process.argv.join(" "),
    defaultCommand:
      "node scripts/flat/atmosflat32/run.js --step=distant-source-abstraction-baseline",
    step: STEP.registryId || STEP.label,
  });
  writeText(
    path.join(artifactDirectory, "state-goal.md"),
    makeStateGoal(criteriaResults)
  );
  writeJson(path.join(artifactDirectory, "inputs.json"), makeInputsRecord(scenes));
  writeJson(path.join(artifactDirectory, "image-comparisons.json"), imageComparisons);
  writeJson(
    path.join(artifactDirectory, "selected-ray-diagnostics.json"),
    selectedRayDiagnostics
  );
  writeJson(path.join(artifactDirectory, "criteria-results.json"), criteriaResults);
  writeJson(path.join(artifactDirectory, "result.json"), resultRecord);
  writeText(
    path.join(artifactDirectory, "report.md"),
    makeReport({
      criteriaResults,
      imageComparisons,
      selectedRayDiagnostics,
      sceneOutputs,
    })
  );
  writeJson(path.join(artifactDirectory, "provenance.json"), {
    step: STEP,
    resultStatus: criteriaResults.status,
    createdAt: new Date().toISOString(),
    command: process.argv.join(" "),
    script: path.relative(ROOT, __filename).replace(/\\/g, "/"),
    artifactDirectory: path.relative(ROOT, artifactDirectory).replace(/\\/g, "/"),
    runtime: {
      node: process.version,
      platform: process.platform,
    },
    sourceBoundary: {
      localProjectAtmosphereSourcesUsed:
        "only copied/factored step-032 sky-dome mechanics from scripts/flat/experimental/bruneton-start-fresh.js",
      externalPhysicsSourcesUsed: STEP.id !== "scaffold-diagnostic",
      note:
        STEP.id !== "scaffold-diagnostic"
          ? "This POC run preserves the experiment-032 source-backed atmosphere/profile contract and adds a runtime distant-Sun source object. It does not use older local project atmosphere code, rejected pipeline code, or prior rendered images as physics authority."
          : "This scaffold records projection diagnostics only. It makes no atmospheric physics or Bruneton appearance claim.",
    },
    scenes,
    equations,
    sceneDiagnostics,
    imageComparisons,
    selectedRaySummary: selectedRayDiagnostics.summary,
    criteriaSummary: {
      status: criteriaResults.status,
      passed: criteriaResults.passed,
      failed: criteriaResults.failed,
      unresolved: criteriaResults.unresolved,
      notApplicable: criteriaResults.notApplicable,
    },
    outputs: [
      ...sceneOutputs,
      "command.json",
      "state-goal.md",
      "inputs.json",
      "image-comparisons.json",
      "selected-ray-diagnostics.json",
      "criteria-results.json",
      "result.json",
      "report.md",
      "provenance.json",
      "equations-and-constants.json",
      "notes.md",
      "run.log",
      "script-snapshot.js",
    ],
  });

  writeJson(path.join(artifactDirectory, "equations-and-constants.json"), equations);
  writeText(path.join(artifactDirectory, "notes.md"), makeNotes(sceneOutputs));
  writeText(path.join(artifactDirectory, "run.log"), `${logLines.join("\n")}\n`);
  fs.copyFileSync(__filename, path.join(artifactDirectory, "script-snapshot.js"));
  appendRunningLogEntry(artifactDirectory, resultRecord);

  for (const line of logLines) {
    console.log(line);
  }
  console.log(`status=${criteriaResults.status}`);
}

main();
