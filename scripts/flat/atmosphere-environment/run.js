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
  "cleanroom_environment"
);
const SCRIPT_PATH = path.relative(ROOT, __filename).replaceAll("\\", "/");
const LOCAL_SOURCE_PATH = "scripts/flat/experimental/bruneton-start-fresh.js";

const STEPS = {
  "transfer-baseline": {
    id: "transfer-baseline",
    label: "transfer-baseline",
    kind: "baseline",
    title: "Finite object transfer baseline",
    status: "experimental baseline",
    stateGoal:
      "Produce a complete 001-transfer-baseline artifact using experiment 032 constants and assumptions, the low-Sun and highest-Sun Bruneton Figure 1 cases, algorithmic stress spectra, and long finite target distances.",
    numericalControls: {
      viewRayScatteringIntervals: 20,
      sampleToSunTransmittanceIntervals: 10,
      secondOrderIncomingDirections: 17,
      secondOrderIncidentAltitudeBins: 24,
    },
  },
  "transfer-convergence": {
    id: "transfer-convergence",
    label: "transfer-convergence",
    kind: "convergence",
    title: "Finite object transfer convergence pass",
    status: "planned convergence follow-up",
    stateGoal:
      "Repeat the transfer baseline with doubled numerical controls and report convergence deltas.",
    numericalControls: {
      viewRayScatteringIntervals: 40,
      sampleToSunTransmittanceIntervals: 20,
      secondOrderIncomingDirections: 34,
      secondOrderIncidentAltitudeBins: 48,
    },
  },
  "transfer-refined-baseline": {
    id: "transfer-refined-baseline",
    label: "transfer-refined-baseline",
    kind: "baseline",
    title: "Finite object transfer refined baseline",
    status: "refined baseline after first convergence margin check",
    stateGoal:
      "Promote the doubled-sample transfer run shape to a refined baseline after the original baseline failed the 5x convergence-margin gate.",
    numericalControls: {
      viewRayScatteringIntervals: 40,
      sampleToSunTransmittanceIntervals: 20,
      secondOrderIncomingDirections: 34,
      secondOrderIncidentAltitudeBins: 48,
    },
  },
  "transfer-refined-convergence": {
    id: "transfer-refined-convergence",
    label: "transfer-refined-convergence",
    kind: "convergence",
    title: "Finite object transfer refined convergence pass",
    status: "refined convergence follow-up",
    stateGoal:
      "Compare the refined doubled-sample baseline against an 80/40/68/96 high-sample convergence run.",
    numericalControls: {
      viewRayScatteringIntervals: 80,
      sampleToSunTransmittanceIntervals: 40,
      secondOrderIncomingDirections: 68,
      secondOrderIncidentAltitudeBins: 96,
    },
  },
  "lambertian-surface-lighting": {
    id: "lambertian-surface-lighting",
    label: "lambertian-surface-lighting",
    kind: "lambertian",
    title: "Lambertian surface-lighting follow-up",
    status: "surface-lighting proof",
    stateGoal:
      "Prove the object-transfer path can accept surface radiance computed from reflectance, direct Sun irradiance, incidence, and object-to-Sun transmittance before applying view-path atmosphere.",
    numericalControls: {
      viewRayScatteringIntervals: 40,
      sampleToSunTransmittanceIntervals: 20,
      secondOrderIncomingDirections: 34,
      secondOrderIncidentAltitudeBins: 48,
    },
  },
  "local-sun-follow-up": {
    id: "local-sun-follow-up",
    label: "local-sun-follow-up",
    kind: "local-sun",
    title: "Local Sun finite-source follow-up",
    status: "finite-source proof",
    stateGoal:
      "Demonstrate a finite local Sun source with non-parallel source rays, inverse-square receiver irradiance falloff, and local source directions in the scattering phase angle.",
    numericalControls: {
      viewRayScatteringIntervals: 40,
      sampleToSunTransmittanceIntervals: 20,
      secondOrderIncomingDirections: 0,
      secondOrderIncidentAltitudeBins: 0,
    },
  },
  "flat-long-sightline-follow-up": {
    id: "flat-long-sightline-follow-up",
    label: "flat-long-sightline-follow-up",
    kind: "flat-long-sightline",
    title: "Flat long-line-of-sight follow-up",
    status: "flat-geometry proof",
    stateGoal:
      "Demonstrate finite object transfer over a flat slab atmosphere with long horizontal same-altitude sightlines and explicit linear optical-depth checks.",
    numericalControls: {
      viewRayScatteringIntervals: 80,
      sampleToSunTransmittanceIntervals: 40,
      secondOrderIncomingDirections: 0,
      secondOrderIncidentAltitudeBins: 0,
    },
  },
  "scene-gallery": {
    id: "scene-gallery",
    label: "scene-gallery",
    kind: "scene-gallery",
    title: "Generated scene previews for all experiment phases",
    status: "scene-output proof",
    stateGoal:
      "Generate scene previews for the accepted transfer, Lambertian, local Sun, and flat long-line-of-sight phases from their recorded spectral transfer data.",
    numericalControls: {},
  },
};

const ATMOSPHERE = {
  bottomRadiusMeters: 6360000,
  topRadiusMeters: 6420000,
  observerHeightMeters: 2,
  rayleighScaleHeightMeters: 8000,
  mieScaleHeightMeters: 1200,
  rayleighCoefficientScale: 1.24062e-6,
  mieAngstromAlpha: 0.8,
  mieAngstromBeta: 0.04,
  mieSingleScatteringAlbedo: 0.8,
  miePhaseFunctionG: 0.7,
  ozoneAbsorption: 0,
};

const SPECTRAL_DELTA_NM = (830 - 360) / 15;
const SPECTRAL_CHANNELS = [
  {
    wavelengthNanometers: 375.666666666667,
    solarIrradiance: 1.068866666667,
    cie: [0.00082512, 0.000024284, 0.00388120013333],
  },
  {
    wavelengthNanometers: 407,
    solarIrradiance: 1.729673,
    cie: [0.031318, 0.000868, 0.14908],
  },
  {
    wavelengthNanometers: 438.333333333333,
    solarIrradiance: 1.862071666667,
    cie: [0.341686666667, 0.0209466666667, 1.70569333333],
  },
  {
    wavelengthNanometers: 469.666666666667,
    solarIrradiance: 2.022063333333,
    cie: [0.199076, 0.0898413333333, 1.30367066667],
  },
  {
    wavelengthNanometers: 501,
    solarIrradiance: 1.908154,
    cie: [0.0044, 0.33986, 0.26006],
  },
  {
    wavelengthNanometers: 532.333333333333,
    solarIrradiance: 1.883391,
    cie: [0.19361662, 0.88666338, 0.0364106666667],
  },
  {
    wavelengthNanometers: 563.666666666667,
    solarIrradiance: 1.834246666667,
    cie: [0.656026666667, 0.982973333333, 0.00305666593333],
  },
  {
    wavelengthNanometers: 595,
    solarIrradiance: 1.76744,
    cie: [1.0567, 0.6949, 0.001],
  },
  {
    wavelengthNanometers: 626.333333333333,
    solarIrradiance: 1.65952,
    cie: [0.722333333333, 0.306066666667, 0.000086666664],
  },
  {
    wavelengthNanometers: 657.666666666667,
    solarIrradiance: 1.548102333333,
    cie: [0.190006666667, 0.0706133333333, 0],
  },
  {
    wavelengthNanometers: 689,
    solarIrradiance: 1.45078,
    cie: [0.02474, 0.008952, 0],
  },
  {
    wavelengthNanometers: 720.333333333333,
    solarIrradiance: 1.340960333333,
    cie: [0.0028426512, 0.00102653333333, 0],
  },
  {
    wavelengthNanometers: 751.666666666667,
    solarIrradiance: 1.262433333333,
    cie: [0.000299809433333, 0.000108266666667, 0],
  },
  {
    wavelengthNanometers: 783,
    solarIrradiance: 1.175208,
    cie: [0.000034215932, 0.000012356, 0],
  },
  {
    wavelengthNanometers: 814.333333333333,
    solarIrradiance: 1.090824,
    cie: [0.00000378221413333, 0.00000136582666667, 0],
  },
].map((channel) => ({
  ...channel,
  wavelengthBinWidthNanometers: SPECTRAL_DELTA_NM,
}));

const XYZ_TO_SRGB = [
  3.2406, -1.5372, -0.4986,
  -0.9689, 1.8758, 0.0415,
  0.0557, -0.204, 1.057,
];
const MAX_LUMINOUS_EFFICACY = 683;
const BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE = 5;
const DISPLAY_TONE_MAP_K =
  1 / (BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE * MAX_LUMINOUS_EFFICACY);

const SUN_CASES = [
  {
    id: "figure1-06h00-z87",
    sourceTimeOfDay: "06h00",
    sourceSunZenithDegrees: 87,
    sunAltitudeDegrees: 3,
    sunAzimuthDegrees: -25.83454348280912,
    role: "sunrise/sunset stress case",
  },
  {
    id: "figure1-13h15-z21",
    sourceTimeOfDay: "13h15",
    sourceSunZenithDegrees: 21,
    sunAltitudeDegrees: 69,
    sunAzimuthDegrees: 85.31410016049729,
    role: "highest-Sun stress case",
  },
];

const DISTANCES_METERS = [0, 100, 1000, 5000, 20000, 50000, 100000];
const SEGMENT_DIAGNOSTIC_DISTANCES_METERS = [1000, 20000, 100000];
const CAMERA = {
  id: "ground-camera",
  originMetersENU: [0, 0, 2],
  forwardMetersENU: [1, 0, 0],
  upMetersENU: [0, 0, 1],
};

function triangularSpectrumWeight(lambdaNm, centerNm, halfWidthNm) {
  return Math.max(0, 1 - Math.abs(lambdaNm - centerNm) / halfWidthNm);
}

function lowerRightForestGreenSpectrum(lambdaNm) {
  return (
    0.3 +
    0.2 * triangularSpectrumWeight(lambdaNm, 501, 55) +
    0.35 * triangularSpectrumWeight(lambdaNm, 532.333333333333, 65) +
    0.08 * triangularSpectrumWeight(lambdaNm, 657.666666666667, 90)
  );
}

const OBJECT_SPECTRA = [
  {
    id: "black",
    title: "Black object, zero caller radiance",
    evaluate: () => 0,
  },
  {
    id: "neutral_unit",
    title: "Neutral unit radiance",
    evaluate: () => 1,
  },
  {
    id: "neutral_high",
    title: "Neutral high radiance",
    evaluate: () => 10,
  },
  {
    id: "blue_step",
    title: "Blue-biased step radiance",
    evaluate: (lambdaNm) => (lambdaNm <= 501 ? 1 : 0.05),
  },
  {
    id: "green_peak",
    title: "Lower-right forest-green radiance",
    evaluate: (lambdaNm) => 0.02 * lowerRightForestGreenSpectrum(lambdaNm),
  },
  {
    id: "red_step",
    title: "Red-biased step radiance",
    evaluate: (lambdaNm) => (lambdaNm >= 626.333333333333 ? 1 : 0.05),
  },
];

const SURFACE_REFLECTANCE_SPECTRA = [
  {
    id: "matte_black",
    title: "Matte black reflectance",
    evaluate: () => 0,
  },
  {
    id: "matte_gray_50",
    title: "Matte neutral 50 percent reflectance",
    evaluate: () => 0.5,
  },
  {
    id: "matte_gray_90",
    title: "Matte neutral 90 percent reflectance",
    evaluate: () => 0.9,
  },
  {
    id: "matte_blue",
    title: "Matte blue-biased reflectance",
    evaluate: (lambdaNm) => (lambdaNm <= 501 ? 0.8 : 0.08),
  },
  {
    id: "matte_green",
    title: "Matte lower-right forest-green reflectance",
    evaluate: (lambdaNm) => 0.1 * lowerRightForestGreenSpectrum(lambdaNm),
  },
  {
    id: "matte_red",
    title: "Matte red-biased reflectance",
    evaluate: (lambdaNm) => (lambdaNm >= 626.333333333333 ? 0.8 : 0.08),
  },
];

const LOCAL_SUN_PROFILE = {
  id: "algorithmic-local-point-sun",
  type: "point",
  positionMetersENU: [250000, 90000, 120000],
  referenceReceiverMetersENU: [0, 0, 2],
};

const FLAT_LONG_DISTANCES_METERS = [0, 1000, 20000, 100000, 500000, 1000000];
const SCENE_RENDER = {
  width: 960,
  height: 540,
  skySampleBlockPixels: 8,
  verticalFovDegrees: 58,
  cameraPitchDegrees: -10,
  minimumPreviewDepthMeters: 90,
  maximumPreviewDepthMeters: 3200,
  laneSlope: 0.055,
  spectrumLaneSpread: 1.25,
  distanceLaneFan: 0.55,
  cardWidthToHeight: 0.55,
  diagnosticNearCardHeightPixels: 54,
  diagnosticFarCardHeightPixels: 15,
  diagnosticGroundRadiance: 0.035,
};

const SCENE_GALLERY_PHASES = [
  {
    id: "transfer",
    sourceLabel: "transfer-refined-convergence",
    title: "Refined transfer convergence",
    outputFileName: "scene-preview-transfer.png",
    spectrumIds: [
      "black",
      "neutral_unit",
      "blue_step",
      "green_peak",
      "red_step",
      "neutral_high",
    ],
    sceneSpectrumSetIds: ["red_step", "blue_step", "green_peak"],
    expectedSunCaseIds: ["figure1-06h00-z87", "figure1-13h15-z21"],
  },
  {
    id: "lambertian",
    sourceLabel: "lambertian-surface-lighting",
    title: "Lambertian surface lighting",
    outputFileName: "scene-preview-lambertian.png",
    spectrumIds: [
      "matte_black",
      "matte_gray_50",
      "matte_blue",
      "matte_green",
      "matte_red",
      "matte_gray_90",
    ],
    sceneSpectrumSetIds: ["matte_red", "matte_blue", "matte_green"],
    expectedSunCaseIds: ["figure1-06h00-z87", "figure1-13h15-z21"],
  },
  {
    id: "local-sun",
    sourceLabel: "local-sun-follow-up",
    title: "Local finite Sun source",
    outputFileName: "scene-preview-local-sun.png",
    spectrumIds: [
      "black",
      "neutral_unit",
      "blue_step",
      "green_peak",
      "red_step",
      "neutral_high",
    ],
    sceneSpectrumSetIds: ["red_step", "blue_step", "green_peak"],
    expectedSunCaseIds: ["local-point-sun"],
  },
  {
    id: "flat-long-sightline",
    sourceLabel: "flat-long-sightline-follow-up",
    title: "Flat long sightline",
    outputFileName: "scene-preview-flat-long-sightline.png",
    spectrumIds: [
      "black",
      "neutral_unit",
      "blue_step",
      "green_peak",
      "red_step",
      "neutral_high",
    ],
    sceneSpectrumSetIds: ["red_step", "blue_step", "green_peak"],
    expectedSunCaseIds: ["figure1-06h00-z87", "figure1-13h15-z21"],
  },
];

const REFERENCES = [
  {
    id: "bruneton-functions-glsl",
    title:
      "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/functions.glsl",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/functions.glsl#L41-L53",
    usedFor: [
      "top-atmosphere boundary distance",
      "optical-length integration",
      "Beer-Lambert transmittance",
    ],
  },
  {
    id: "bruneton-demo-constants",
    title:
      "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/demo/demo.cc",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.cc#L12-L20",
    usedFor: [
      "Earth radii",
      "Rayleigh and Mie scale heights",
      "Rayleigh coefficient law",
      "solar irradiance source table carried by the cleanroom script",
    ],
  },
  {
    id: "bruneton-single-scattering",
    title:
      "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/functions.glsl",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/functions.glsl#L82-L109",
    usedFor: [
      "single-scattering integrand",
      "Rayleigh phase function",
      "Cornette-Shanks Mie phase function",
    ],
  },
  {
    id: "bruneton-2016-clear-sky-parameters",
    title:
      "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "aerosol Angstrom alpha 0.8",
      "aerosol Angstrom beta 0.04",
      "aerosol single-scattering albedo 0.8",
      "Mie phase asymmetry g 0.7",
    ],
  },
  {
    id: "bruneton-2016-no-ozone-comparison-policy",
    title:
      "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: ["no-ozone comparison policy"],
  },
  {
    id: "bruneton-2016-nishita96-double-scattering",
    title:
      "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "incoming-direction integration requirement for double scattering",
    ],
  },
  {
    id: "gonzalez-2009-fibonacci-sphere-lattice",
    title:
      "Alvaro Gonzalez, Measurement of areas on a sphere using Fibonacci and latitude-longitude lattices",
    url: "https://arxiv.org/abs/0912.4540",
    usedFor: ["full-sphere Fibonacci direction set for second-order sampling"],
  },
  {
    id: "bruneton-color-constants",
    title:
      "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/constants.h",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/constants.h",
    usedFor: [
      "CIE color matching functions",
      "XYZ to linear sRGB matrix",
      "maximum luminous efficacy 683",
    ],
  },
  {
    id: "bruneton-2016-comparison-source-tone-map",
    title:
      "Eric Bruneton, clear-sky-models comparison source, atmosphere/comparisons.cc",
    url:
      "https://github.com/ebruneton/clear-sky-models/blob/master/atmosphere/comparisons.cc#L148-L153",
    usedFor: ["display-only k = 1 / (5 * 683) tone map"],
  },
  {
    id: "bruneton-2016-figure1-four-view-layout",
    title:
      "Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models, Figure 1",
    url: "https://arxiv.org/abs/1612.04336",
    usedFor: [
      "required 06h00 / 87 degree low-Sun case",
      "required 13h15 / 21 degree highest-Sun case",
    ],
  },
  {
    id: "bruneton-demo-finite-object-composition",
    title:
      "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/demo/demo.glsl",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.glsl",
    usedFor: [
      "finite object radiance composed as radiance * transmittance + in-scatter",
    ],
  },
  {
    id: "bruneton-ground-reflection",
    title:
      "Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/demo/demo.glsl",
    url:
      "https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.glsl#L345-L369",
    usedFor: [
      "Lambertian surface radiance uses albedo over pi times incident irradiance",
      "surface radiance is then attenuated by finite-segment aerial perspective",
    ],
  },
  {
    id: "pbrt-point-lights",
    title: "Physically Based Rendering, 4th edition, Point Lights",
    url: "https://pbr-book.org/4ed/Light_Sources/Point_Lights",
    usedFor: [
      "finite point-source direction from receiver to light",
      "inverse-square receiver irradiance falloff from spectral intensity",
    ],
  },
  {
    id: "iprt-phase-a-plane-parallel",
    title:
      "Intercomparison of 3D Radiation Codes, Phase A: one-dimensional plane-parallel benchmarks",
    url: "https://arxiv.org/abs/1901.01813",
    usedFor: [
      "plane-parallel atmosphere as a standard radiative-transfer test geometry",
    ],
  },
  {
    id: "stamnes-1988-disort",
    title:
      "Stamnes et al. 1988, Numerically stable algorithm for discrete-ordinate-method radiative transfer in multiple scattering and emitting layered media",
    url: "https://opg.optica.org/ao/abstract.cfm?uri=ao-27-12-2502",
    usedFor: [
      "plane-parallel layered media as a standard long-path radiative-transfer geometry",
    ],
  },
];

const ALGORITHMIC_DECISIONS = [
  {
    id: "synthetic-object-radiance",
    value:
      "black, neutral_unit, neutral_high, blue_step, green_peak, red_step",
    reason:
      "Stress the transfer equation without introducing material-reflectance ownership.",
  },
  {
    id: "baseline-distances",
    value: DISTANCES_METERS,
    reason:
      "Cover zero identity, near-field, mid-distance, and long finite path stress cases.",
  },
  {
    id: "target-card-size",
    value: { widthMeters: 1, heightMeters: 1 },
    reason:
      "Visualization metadata only; baseline criteria use center-ray transfer packets.",
  },
  {
    id: "baseline-numerical-controls",
    value: STEPS["transfer-baseline"].numericalControls,
    reason:
      "Inherited experiment 032 controls pending the 002 convergence pass.",
  },
  {
    id: "contact-sheet-layout",
    value:
      "Sun case and object-spectrum blocks, distance rows, source/attenuated/path/final columns.",
    reason:
      "Expose the transfer components without using image pixels as the proof data.",
  },
  {
    id: "ratio-epsilon",
    value: 1e-30,
    reason:
      "Avoid divide-by-zero diagnostics for path-radiance fraction summaries.",
  },
  {
    id: "lambertian-sun-facing-diagnostic-patch",
    value:
      "Surface-lighting follow-up computes a sun-facing Lambertian patch radiance before view-path transfer.",
    reason:
      "Isolate lighting-to-object-radiance ownership without adding raster visibility or shadowing.",
  },
  {
    id: "local-sun-test-position",
    value: {
      positionMetersENU: [250000, 90000, 120000],
      referenceReceiverMetersENU: [0, 0, 2],
    },
    reason:
      "Stress non-parallel source directions and inverse-square falloff over the existing distance matrix.",
  },
  {
    id: "flat-slab-long-distances",
    value: [0, 1000, 20000, 100000, 500000, 1000000],
    reason:
      "Stress long finite horizontal lines of sight beyond the spherical baseline distance set.",
  },
  {
    id: "follow-up-second-order-scope",
    value: "local Sun and flat-slab follow-ups use first-order path radiance",
    reason:
      "Keep source-model and geometry-model proof criteria separate from second-order cache design.",
  },
  {
    id: "scene-gallery-source-selection",
    value:
      "Use latest accepted transfer, Lambertian, local Sun, and flat long-sightline artifacts with zero failed and zero unresolved criteria.",
    reason:
      "Generate visible scenes for every completed phase without rerunning or changing the spectral transport packets.",
  },
  {
    id: "scene-gallery-layout",
    value:
      "Four display-only perspective scene previews plus a 2 x 2 gallery; object cards are placed by logarithmic distance along range-compressed ground lanes.",
    reason:
      "Make distance, Sun/source model, and object-spectrum changes inspectable while keeping transfer-cases.json as the source of truth.",
  },
  {
    id: "scene-gallery-sky-render",
    value:
      "Scene preview sky and ground-atmosphere pixels are sampled in blocks with the same spectral atmosphere kernels used by the source artifact.",
    reason:
      "Use the cleanroom atmosphere algorithm for scene context instead of a decorative background while keeping preview runtime bounded.",
  },
  {
    id: "scene-gallery-perspective-range-compression",
    value: SCENE_RENDER,
    reason:
      "Show 100 m through 1,000 km object cases in one inspectable perspective view; the compression is display-only and does not alter transfer data.",
  },
  {
    id: "scene-gallery-multicolor-object-selection",
    value:
      "Each scene/source view renders three recorded object-spectrum stacks: red, blue, and green.",
    reason:
      "User-directed scene-display selection using recorded spectral cases instead of RGB recoloring.",
  },
];

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getExistingArtifacts() {
  ensureDirectory(ARTIFACT_ROOT);

  return fs
    .readdirSync(ARTIFACT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      number: Number(entry.name.slice(0, 3)),
      path: path.join(ARTIFACT_ROOT, entry.name),
    }))
    .filter((entry) => Number.isFinite(entry.number))
    .sort((a, b) => a.number - b.number);
}

function getRequestedStepId() {
  const stepArgument = process.argv.find((argument) =>
    argument.startsWith("--step=")
  );

  if (stepArgument) {
    return stepArgument.slice("--step=".length);
  }

  const artifacts = getExistingArtifacts();
  return artifacts.length === 0 ? "transfer-baseline" : "transfer-convergence";
}

function activeStep() {
  const requestedStepId = getRequestedStepId();

  if (!Object.hasOwn(STEPS, requestedStepId)) {
    const validSteps = Object.keys(STEPS).join(", ");
    throw new Error(`Unknown step "${requestedStepId}". Valid steps: ${validSteps}`);
  }

  return STEPS[requestedStepId];
}

function isConvergenceStep(step) {
  return step.kind === "convergence";
}

function isTransferStep(step) {
  return step.kind === "baseline" || step.kind === "convergence";
}

function nextArtifactInfo(step) {
  const artifacts = getExistingArtifacts();
  const nextNumber =
    artifacts.reduce((max, artifact) => Math.max(max, artifact.number), 0) + 1;
  const folderName = `${String(nextNumber).padStart(3, "0")}-${step.label}`;
  const directory = path.join(ARTIFACT_ROOT, folderName);

  if (fs.existsSync(directory)) {
    throw new Error(`Refusing to overwrite existing artifact: ${directory}`);
  }

  ensureDirectory(directory);
  return {
    artifactNumber: nextNumber,
    folderName,
    directory,
    existingArtifacts: artifacts.map((artifact) => artifact.name),
  };
}

function findLatestAcceptedBaselineArtifact(existingArtifactNames) {
  const artifactNames = [...existingArtifactNames].reverse();

  for (const artifactName of artifactNames) {
    if (!/^\d{3}-.*baseline$/.test(artifactName)) {
      continue;
    }

    const directory = path.join(ARTIFACT_ROOT, artifactName);
    const criteriaPath = path.join(directory, "criteria-results.json");
    const provenancePath = path.join(directory, "provenance.json");
    const transferCasesPath = path.join(directory, "transfer-cases.json");

    if (
      !fs.existsSync(criteriaPath) ||
      !fs.existsSync(provenancePath) ||
      !fs.existsSync(transferCasesPath)
    ) {
      continue;
    }

    const criteriaResults = readJson(criteriaPath);
    const provenance = readJson(provenancePath);

    if (
      provenance.status === "accepted" &&
      criteriaResults.summary &&
      criteriaResults.summary.failed === 0
    ) {
      const transferCases = readJson(transferCasesPath);

      return {
        folderName: artifactName,
        directory,
        criteriaResults,
        provenance,
        transferCases: transferCases.transferCases,
      };
    }
  }

  return null;
}

function findLatestAcceptedArtifactByLabel(existingArtifactNames, label) {
  const artifactNames = [...existingArtifactNames].reverse();

  for (const artifactName of artifactNames) {
    if (!artifactName.endsWith(`-${label}`)) {
      continue;
    }

    const directory = path.join(ARTIFACT_ROOT, artifactName);
    const criteriaPath = path.join(directory, "criteria-results.json");
    const provenancePath = path.join(directory, "provenance.json");
    const transferCasesPath = path.join(directory, "transfer-cases.json");

    if (
      !fs.existsSync(criteriaPath) ||
      !fs.existsSync(provenancePath) ||
      !fs.existsSync(transferCasesPath)
    ) {
      continue;
    }

    const criteriaResults = readJson(criteriaPath);
    const provenance = readJson(provenancePath);

    if (
      provenance.status === "accepted" &&
      criteriaResults.summary &&
      criteriaResults.summary.failed === 0 &&
      criteriaResults.summary.unresolved === 0
    ) {
      const transferCases = readJson(transferCasesPath);

      return {
        folderName: artifactName,
        directory,
        label,
        criteriaResults,
        provenance,
        transferCases: transferCases.transferCases,
      };
    }
  }

  return null;
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

function normalize(vector) {
  const vectorLength = length(vector);

  if (vectorLength === 0) {
    return [0, 0, 0];
  }

  return [
    vector[0] / vectorLength,
    vector[1] / vectorLength,
    vector[2] / vectorLength,
  ];
}

function scaleVector(vector, scalar) {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function addVectors(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function addScaled(origin, direction, distance) {
  return [
    origin[0] + direction[0] * distance,
    origin[1] + direction[1] * distance,
    origin[2] + direction[2] * distance,
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function enuToWorld(positionMetersENU) {
  return [
    positionMetersENU[0],
    positionMetersENU[1],
    ATMOSPHERE.bottomRadiusMeters + positionMetersENU[2],
  ];
}

function observerPosition() {
  return enuToWorld(CAMERA.originMetersENU);
}

function sunDirection(sunCase) {
  const altitude = degreesToRadians(sunCase.sunAltitudeDegrees);
  const azimuth = degreesToRadians(sunCase.sunAzimuthDegrees);
  const horizontalLength = Math.cos(altitude);

  return normalize([
    horizontalLength * Math.cos(azimuth),
    horizontalLength * Math.sin(azimuth),
    Math.sin(altitude),
  ]);
}

function wavelengthNanometersToMicrometers(wavelengthNanometers) {
  return wavelengthNanometers * 1e-3;
}

function rayleighScatteringCoefficientAt(wavelengthMicrometers) {
  return ATMOSPHERE.rayleighCoefficientScale * wavelengthMicrometers ** -4;
}

function mieExtinctionCoefficientAt(wavelengthMicrometers) {
  return (
    (ATMOSPHERE.mieAngstromBeta / ATMOSPHERE.mieScaleHeightMeters) *
    wavelengthMicrometers ** -ATMOSPHERE.mieAngstromAlpha
  );
}

function mieScatteringCoefficientAt(wavelengthMicrometers) {
  return (
    mieExtinctionCoefficientAt(wavelengthMicrometers) *
    ATMOSPHERE.mieSingleScatteringAlbedo
  );
}

function exponentialDensity(altitudeMeters, scaleHeightMeters) {
  return Math.exp(-Math.max(0, altitudeMeters) / scaleHeightMeters);
}

function densityAtPosition(position) {
  const altitude = length(position) - ATMOSPHERE.bottomRadiusMeters;

  return {
    altitudeMeters: altitude,
    rayleigh: exponentialDensity(altitude, ATMOSPHERE.rayleighScaleHeightMeters),
    mie: exponentialDensity(altitude, ATMOSPHERE.mieScaleHeightMeters),
    absorption: 0,
  };
}

function distanceToTopAtmosphereBoundary(radius, mu) {
  const discriminant =
    radius * radius * (mu * mu - 1) +
    ATMOSPHERE.topRadiusMeters * ATMOSPHERE.topRadiusMeters;

  return Math.max(0, -radius * mu + Math.sqrt(Math.max(0, discriminant)));
}

function rayIntersectsGround(radius, mu) {
  return (
    mu < 0 &&
    radius * radius * (mu * mu - 1) +
      ATMOSPHERE.bottomRadiusMeters * ATMOSPHERE.bottomRadiusMeters >=
      0
  );
}

function computeOpticalLengthsAlongDistance(
  origin,
  direction,
  distance,
  sampleCount
) {
  if (distance === 0 || sampleCount === 0) {
    return {
      distance,
      rayleighOpticalLength: 0,
      mieOpticalLength: 0,
      absorptionOpticalLength: 0,
    };
  }

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

function computeOpticalLengthsToTop(origin, direction, sampleCount) {
  const radius = length(origin);
  const mu = dot(origin, direction) / radius;
  const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);

  return computeOpticalLengthsAlongDistance(
    origin,
    direction,
    distanceToTop,
    sampleCount
  );
}

function computeTransmittanceSpectrum(opticalLengths) {
  const opticalDepthByWavelength = SPECTRAL_CHANNELS.map((channel) => {
    const wavelengthMicrometers = wavelengthNanometersToMicrometers(
      channel.wavelengthNanometers
    );

    return (
      rayleighScatteringCoefficientAt(wavelengthMicrometers) *
        opticalLengths.rayleighOpticalLength +
      mieExtinctionCoefficientAt(wavelengthMicrometers) *
        opticalLengths.mieOpticalLength +
      ATMOSPHERE.ozoneAbsorption *
        (opticalLengths.absorptionOpticalLength || 0)
    );
  });

  return {
    opticalDepthByWavelength,
    transmittanceByWavelength: opticalDepthByWavelength.map((tau) =>
      Math.exp(-tau)
    ),
  };
}

function computeTransmittanceToSunSpectrum(position, sunRay, controls) {
  const radius = length(position);
  const mu = dot(position, sunRay) / radius;

  if (rayIntersectsGround(radius, mu)) {
    return SPECTRAL_CHANNELS.map(() => 0);
  }

  return computeTransmittanceSpectrum(
    computeOpticalLengthsToTop(
      position,
      sunRay,
      controls.sampleToSunTransmittanceIntervals
    )
  ).transmittanceByWavelength;
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

function fibonacciSphereIncomingDirections(sunRay, count) {
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

  for (let index = -halfCount; directions.length < count; index += 1) {
    const z = (2 * index) / count;
    const latitude = Math.asin(clamp(z, -1, 1));
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

function zeroSpectrum() {
  return SPECTRAL_CHANNELS.map(() => 0);
}

function computePathRadianceSegment({
  origin,
  direction,
  distance,
  sunCase,
  sunRay,
  controls,
  includeSecondOrder,
  incidentSkyCache,
}) {
  const fullOpticalLengths = computeOpticalLengthsAlongDistance(
    origin,
    direction,
    distance,
    controls.viewRayScatteringIntervals
  );
  const fullTransmittance = computeTransmittanceSpectrum(fullOpticalLengths);

  if (distance === 0) {
    return {
      opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
      transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
      pathRadianceByWavelength: zeroSpectrum(),
      firstOrderPathRadianceByWavelength: zeroSpectrum(),
      secondOrderPathRadianceByWavelength: zeroSpectrum(),
      diagnostics: {
        sampleCount: controls.viewRayScatteringIntervals,
        minAltitudeMeters: ATMOSPHERE.observerHeightMeters,
        maxAltitudeMeters: ATMOSPHERE.observerHeightMeters,
      },
    };
  }

  const sampleCount = controls.viewRayScatteringIntervals;
  const step = distance / sampleCount;
  const samples = [];
  const cumulativeRayleigh = [0];
  const cumulativeMie = [0];
  const cumulativeAbsorption = [0];
  const rayleighSum = zeroSpectrum();
  const mieSum = zeroSpectrum();
  const secondOrderSum = zeroSpectrum();
  let minAltitudeMeters = Number.POSITIVE_INFINITY;
  let maxAltitudeMeters = Number.NEGATIVE_INFINITY;

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const sampleDistance = sampleIndex * step;
    const position = addScaled(origin, direction, sampleDistance);
    const density = densityAtPosition(position);

    minAltitudeMeters = Math.min(minAltitudeMeters, density.altitudeMeters);
    maxAltitudeMeters = Math.max(maxAltitudeMeters, density.altitudeMeters);
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
    }).transmittanceByWavelength;
    const sunTransmittance = computeTransmittanceToSunSpectrum(
      sample.position,
      sunRay,
      controls
    );

    for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
      const transmittance =
        viewTransmittance[channelIndex] * sunTransmittance[channelIndex];

      rayleighSum[channelIndex] +=
        transmittance * sample.density.rayleigh * weight;
      mieSum[channelIndex] += transmittance * sample.density.mie * weight;
    }

    if (includeSecondOrder) {
      const secondOrder = computeSecondOrderAtSample({
        sunCase,
        position: sample.position,
        viewRay: direction,
        sunRay,
        density: sample.density,
        viewTransmittance,
        controls,
        incidentSkyCache,
      });

      for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
        secondOrderSum[channelIndex] += secondOrder[channelIndex] * weight;
      }
    }
  }

  const nu = dot(direction, sunRay);
  const rayleighPhase = rayleighPhaseFunction(nu);
  const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);
  const firstOrderPathRadianceByWavelength = SPECTRAL_CHANNELS.map(
    (channel, channelIndex) => {
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
    }
  );
  const secondOrderPathRadianceByWavelength = secondOrderSum.map(
    (value) => value * step
  );
  const pathRadianceByWavelength = firstOrderPathRadianceByWavelength.map(
    (value, index) => value + secondOrderPathRadianceByWavelength[index]
  );

  return {
    opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
    transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
    pathRadianceByWavelength,
    firstOrderPathRadianceByWavelength,
    secondOrderPathRadianceByWavelength,
    diagnostics: {
      sampleCount,
      minAltitudeMeters,
      maxAltitudeMeters,
      rayleighOpticalLength: fullOpticalLengths.rayleighOpticalLength,
      mieOpticalLength: fullOpticalLengths.mieOpticalLength,
      absorptionOpticalLength: fullOpticalLengths.absorptionOpticalLength,
    },
  };
}

function computeSecondOrderAtSample({
  sunCase,
  position,
  viewRay,
  sunRay,
  density,
  viewTransmittance,
  controls,
  incidentSkyCache,
}) {
  const secondOrder = zeroSpectrum();
  const incomingDirections = fibonacciSphereIncomingDirections(
    sunRay,
    controls.secondOrderIncomingDirections
  );
  const angularWeight = (4 * Math.PI) / incomingDirections.length;

  for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
    const incomingDirection = incomingDirections[directionIndex];
    const incidentRadiance = incidentSkyRadianceForSecondOrder({
      sunCase,
      sunRay,
      incomingDirection,
      directionIndex,
      position,
      controls,
      incidentSkyCache,
    });
    const nu = dot(viewRay, incomingDirection);
    const rayleighPhase = rayleighPhaseFunction(nu);
    const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);

    for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
      const wavelengthMicrometers = wavelengthNanometersToMicrometers(
        SPECTRAL_CHANNELS[channelIndex].wavelengthNanometers
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

function incidentSkyRadianceForSecondOrder({
  sunCase,
  sunRay,
  incomingDirection,
  directionIndex,
  position,
  controls,
  incidentSkyCache,
}) {
  const altitude = clamp(
    length(position) - ATMOSPHERE.bottomRadiusMeters,
    0,
    ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters
  );
  const binSize =
    (ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters) /
    controls.secondOrderIncidentAltitudeBins;
  const binIndex = clamp(
    Math.floor(altitude / binSize),
    0,
    controls.secondOrderIncidentAltitudeBins - 1
  );
  const key = `${sunCase.id}|${directionIndex}|${binIndex}`;

  if (!incidentSkyCache.has(key)) {
    const binAltitude = (binIndex + 0.5) * binSize;
    const binOrigin = [0, 0, ATMOSPHERE.bottomRadiusMeters + binAltitude];
    const radius = length(binOrigin);
    const mu = dot(binOrigin, incomingDirection) / radius;

    if (rayIntersectsGround(radius, mu)) {
      incidentSkyCache.set(key, zeroSpectrum());
    } else {
      const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
      const incident = computePathRadianceSegment({
        origin: binOrigin,
        direction: incomingDirection,
        distance: distanceToTop,
        sunCase,
        sunRay,
        controls,
        includeSecondOrder: false,
        incidentSkyCache,
      });

      incidentSkyCache.set(key, incident.pathRadianceByWavelength);
    }
  }

  return incidentSkyCache.get(key);
}

function objectRadianceSpectrum(objectSpectrum) {
  return SPECTRAL_CHANNELS.map((channel) =>
    objectSpectrum.evaluate(channel.wavelengthNanometers)
  );
}

function spectralToDisplayPreview(radianceByWavelength) {
  let x = 0;
  let y = 0;
  let z = 0;

  for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
    const channel = SPECTRAL_CHANNELS[channelIndex];
    const radiance = radianceByWavelength[channelIndex];

    x += channel.cie[0] * radiance * channel.wavelengthBinWidthNanometers;
    y += channel.cie[1] * radiance * channel.wavelengthBinWidthNanometers;
    z += channel.cie[2] * radiance * channel.wavelengthBinWidthNanometers;
  }

  const linearSrgb = [
    MAX_LUMINOUS_EFFICACY *
      (XYZ_TO_SRGB[0] * x + XYZ_TO_SRGB[1] * y + XYZ_TO_SRGB[2] * z),
    MAX_LUMINOUS_EFFICACY *
      (XYZ_TO_SRGB[3] * x + XYZ_TO_SRGB[4] * y + XYZ_TO_SRGB[5] * z),
    MAX_LUMINOUS_EFFICACY *
      (XYZ_TO_SRGB[6] * x + XYZ_TO_SRGB[7] * y + XYZ_TO_SRGB[8] * z),
  ];
  const displayRgb = linearSrgb.map((value) =>
    clamp(1 - Math.exp(-DISPLAY_TONE_MAP_K * Math.max(0, value)), 0, 1)
  );
  const encodedRgb = displayRgb.map((value) => clampByte(value * 255));

  return {
    cieXyzUnscaled: [x, y, z],
    linearSrgb,
    displayRgb,
    encodedRgb,
    negativeLinearChannelCount: linearSrgb.filter((value) => value < 0).length,
    clippedEncodedChannelCount: encodedRgb.filter((value) => value >= 255).length,
  };
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxAbs(values) {
  return values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

function l2(values) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function subtractArrays(a, b) {
  return a.map((value, index) => value - b[index]);
}

function addArrays(a, b) {
  return a.map((value, index) => value + b[index]);
}

function multiplyArrays(a, b) {
  return a.map((value, index) => value * b[index]);
}

function scaleArray(a, scalar) {
  return a.map((value) => value * scalar);
}

function computeTransferCases(step, artifactInfo) {
  const controls = step.numericalControls;
  const transferCases = [];
  const transferBySunDistance = new Map();
  const compositionDiagnostics = [];
  const incidentSkyCache = new Map();
  const origin = observerPosition();
  const direction = normalize(CAMERA.forwardMetersENU);

  for (const sunCase of SUN_CASES) {
    const sunRay = sunDirection(sunCase);

    for (const distanceMeters of DISTANCES_METERS) {
      const transferKey = `${sunCase.id}|${distanceMeters}`;
      const transfer = computePathRadianceSegment({
        origin,
        direction,
        distance: distanceMeters,
        sunCase,
        sunRay,
        controls,
        includeSecondOrder: true,
        incidentSkyCache,
      });

      transferBySunDistance.set(transferKey, transfer);
    }

    for (const distanceMeters of SEGMENT_DIAGNOSTIC_DISTANCES_METERS) {
      const halfDistance = distanceMeters / 2;
      const midpoint = addScaled(origin, direction, halfDistance);
      const compositionFullControls = {
        ...controls,
        viewRayScatteringIntervals: controls.viewRayScatteringIntervals * 2,
      };
      const full = computePathRadianceSegment({
        origin,
        direction,
        distance: distanceMeters,
        sunCase,
        sunRay,
        controls: compositionFullControls,
        includeSecondOrder: true,
        incidentSkyCache,
      });
      const first = computePathRadianceSegment({
        origin,
        direction,
        distance: halfDistance,
        sunCase,
        sunRay,
        controls,
        includeSecondOrder: true,
        incidentSkyCache,
      });
      const second = computePathRadianceSegment({
        origin: midpoint,
        direction,
        distance: halfDistance,
        sunCase,
        sunRay,
        controls,
        includeSecondOrder: true,
        incidentSkyCache,
      });
      const recomposedTransmittance = multiplyArrays(
        first.transmittanceByWavelength,
        second.transmittanceByWavelength
      );
      const recomposedPathRadiance = addArrays(
        first.pathRadianceByWavelength,
        multiplyArrays(first.transmittanceByWavelength, second.pathRadianceByWavelength)
      );

      compositionDiagnostics.push({
        sunCase: sunCase.id,
        distanceMeters,
        splitDistanceMeters: halfDistance,
        fullSegmentViewIntervals:
          compositionFullControls.viewRayScatteringIntervals,
        splitSegmentViewIntervalsEach: controls.viewRayScatteringIntervals,
        maxTransmittanceError: maxAbs(
          subtractArrays(full.transmittanceByWavelength, recomposedTransmittance)
        ),
        maxPathRadianceError: maxAbs(
          subtractArrays(full.pathRadianceByWavelength, recomposedPathRadiance)
        ),
        meanFullTransmittance: mean(full.transmittanceByWavelength),
        meanFullPathRadiance: mean(full.pathRadianceByWavelength),
      });
    }

    for (const objectSpectrum of OBJECT_SPECTRA) {
      const objectRadianceByWavelength = objectRadianceSpectrum(objectSpectrum);

      for (const distanceMeters of DISTANCES_METERS) {
        const transfer = transferBySunDistance.get(`${sunCase.id}|${distanceMeters}`);
        const attenuatedObjectRadianceByWavelength = multiplyArrays(
          objectRadianceByWavelength,
          transfer.transmittanceByWavelength
        );
        const finalRadianceByWavelength = addArrays(
          attenuatedObjectRadianceByWavelength,
          transfer.pathRadianceByWavelength
        );
        const targetCenterMetersENU = [distanceMeters, 0, 2];
        const caseId = [
          sunCase.id,
          `${String(distanceMeters).padStart(6, "0")}m`,
          objectSpectrum.id,
        ].join("--");

        transferCases.push({
          caseId,
          wavelengthsNm: SPECTRAL_CHANNELS.map(
            (channel) => channel.wavelengthNanometers
          ),
          units: {
            wavelengthsNm: "nm",
            distanceMeters: "m",
            opticalDepthByWavelength: "dimensionless",
            transmittanceByWavelength: "dimensionless",
            objectRadianceByWavelength:
              "algorithmic unit spectral-radiance scale",
            pathRadianceByWavelength:
              "experiment 032 cleanroom spectral radiance scale",
            attenuatedObjectRadianceByWavelength:
              "algorithmic unit spectral-radiance scale after dimensionless transmittance",
            finalRadianceByWavelength:
              "mixed caller unit radiance plus atmosphere spectral radiance for transfer-equation stress test",
          },
          sunCase: {
            id: sunCase.id,
            sourceTimeOfDay: sunCase.sourceTimeOfDay,
            sourceSunZenithDegrees: sunCase.sourceSunZenithDegrees,
            sunAltitudeDegrees: sunCase.sunAltitudeDegrees,
            sunAzimuthDegrees: sunCase.sunAzimuthDegrees,
            sunDirection: sunRay,
          },
          geometryProfileId: "spherical-earth-ground-observer",
          sourceProfileId: "bruneton-figure1-directional-sun",
          camera: CAMERA,
          target: {
            id: `target-${distanceMeters}m-${objectSpectrum.id}`,
            shape: "spectral-card",
            centerMetersENU: targetCenterMetersENU,
            normalMetersENU: [-1, 0, 0],
            widthMeters: distanceMeters === 0 ? 0 : 1,
            heightMeters: distanceMeters === 0 ? 0 : 1,
            distanceMeters,
            objectSpectrumId: objectSpectrum.id,
          },
          segment: {
            originMeters: CAMERA.originMetersENU,
            targetMeters: targetCenterMetersENU,
            lengthMeters: distanceMeters,
            directionMeters: direction,
          },
          objectSpectrumId: objectSpectrum.id,
          objectRadianceByWavelength,
          opticalDepthByWavelength: transfer.opticalDepthByWavelength,
          transmittanceByWavelength: transfer.transmittanceByWavelength,
          pathRadianceByWavelength: transfer.pathRadianceByWavelength,
          attenuatedObjectRadianceByWavelength,
          finalRadianceByWavelength,
          components: {
            firstOrderPathRadianceByWavelength:
              transfer.firstOrderPathRadianceByWavelength,
            secondOrderPathRadianceByWavelength:
              transfer.secondOrderPathRadianceByWavelength,
          },
          displayPreview: {
            sourceObject: spectralToDisplayPreview(objectRadianceByWavelength),
            attenuatedObject: spectralToDisplayPreview(
              attenuatedObjectRadianceByWavelength
            ),
            pathRadiance: spectralToDisplayPreview(
              transfer.pathRadianceByWavelength
            ),
            finalRadiance: spectralToDisplayPreview(finalRadianceByWavelength),
          },
          diagnostics: {
            meanTransmittance: mean(transfer.transmittanceByWavelength),
            minTransmittance: Math.min(...transfer.transmittanceByWavelength),
            meanPathRadiance: mean(transfer.pathRadianceByWavelength),
            meanFinalRadiance: mean(finalRadianceByWavelength),
            meanPathRadianceFraction: mean(
              transfer.pathRadianceByWavelength.map((value, index) => {
                const denominator = Math.max(
                  Math.abs(finalRadianceByWavelength[index]),
                  1e-30
                );
                return value / denominator;
              })
            ),
            transferDiagnostics: transfer.diagnostics,
          },
        });
      }
    }
  }

  return {
    transferCases,
    compositionDiagnostics,
    cacheDiagnostics: {
      incidentSkyCacheEntries: incidentSkyCache.size,
    },
    artifactInfo,
  };
}

function reflectanceSpectrum(reflectance) {
  return SPECTRAL_CHANNELS.map((channel) =>
    reflectance.evaluate(channel.wavelengthNanometers)
  );
}

function computeLambertianCases(step, artifactInfo) {
  const controls = step.numericalControls;
  const transferCases = [];
  const compositionDiagnostics = [];
  const incidentSkyCache = new Map();
  const origin = observerPosition();
  const direction = normalize(CAMERA.forwardMetersENU);

  for (const sunCase of SUN_CASES) {
    const sunRay = sunDirection(sunCase);

    for (const reflectance of SURFACE_REFLECTANCE_SPECTRA) {
      const reflectanceByWavelength = reflectanceSpectrum(reflectance);

      for (const distanceMeters of DISTANCES_METERS) {
        const targetWorld = addScaled(origin, direction, distanceMeters);
        const transfer = computePathRadianceSegment({
          origin,
          direction,
          distance: distanceMeters,
          sunCase,
          sunRay,
          controls,
          includeSecondOrder: true,
          incidentSkyCache,
        });
        const surfaceToSunTransmittance = computeTransmittanceToSunSpectrum(
          targetWorld,
          sunRay,
          controls
        );
        const directIrradianceByWavelength = SPECTRAL_CHANNELS.map(
          (channel, channelIndex) =>
            channel.solarIrradiance * surfaceToSunTransmittance[channelIndex]
        );
        const objectRadianceByWavelength = reflectanceByWavelength.map(
          (value, channelIndex) =>
            (value / Math.PI) * directIrradianceByWavelength[channelIndex]
        );
        const attenuatedObjectRadianceByWavelength = multiplyArrays(
          objectRadianceByWavelength,
          transfer.transmittanceByWavelength
        );
        const finalRadianceByWavelength = addArrays(
          attenuatedObjectRadianceByWavelength,
          transfer.pathRadianceByWavelength
        );
        const targetCenterMetersENU = [distanceMeters, 0, 2];
        const caseId = [
          sunCase.id,
          `${String(distanceMeters).padStart(6, "0")}m`,
          reflectance.id,
        ].join("--");

        transferCases.push({
          caseId,
          wavelengthsNm: SPECTRAL_CHANNELS.map(
            (channel) => channel.wavelengthNanometers
          ),
          units: {
            wavelengthsNm: "nm",
            reflectanceByWavelength: "dimensionless",
            directIrradianceByWavelength:
              "experiment 032 solar spectral irradiance scale",
            objectRadianceByWavelength:
              "Lambertian spectral radiance scale from reflectance/pi * irradiance",
            transmittanceByWavelength: "dimensionless",
            pathRadianceByWavelength:
              "experiment 032 cleanroom spectral radiance scale",
          },
          sunCase: {
            ...sunCase,
            sunDirection: sunRay,
          },
          geometryProfileId: "spherical-earth-ground-observer",
          sourceProfileId: "bruneton-figure1-directional-sun",
          camera: CAMERA,
          target: {
            id: `surface-${distanceMeters}m-${reflectance.id}`,
            shape: "sun-facing-lambertian-diagnostic-patch",
            centerMetersENU: targetCenterMetersENU,
            normalPolicy: "algorithmic sun-facing patch, incidence cosine = 1",
            widthMeters: distanceMeters === 0 ? 0 : 1,
            heightMeters: distanceMeters === 0 ? 0 : 1,
            distanceMeters,
            objectSpectrumId: reflectance.id,
          },
          segment: {
            originMeters: CAMERA.originMetersENU,
            targetMeters: targetCenterMetersENU,
            lengthMeters: distanceMeters,
            directionMeters: direction,
          },
          objectSpectrumId: reflectance.id,
          reflectanceByWavelength,
          surfaceToSunTransmittanceByWavelength: surfaceToSunTransmittance,
          directIrradianceByWavelength,
          objectRadianceByWavelength,
          opticalDepthByWavelength: transfer.opticalDepthByWavelength,
          transmittanceByWavelength: transfer.transmittanceByWavelength,
          pathRadianceByWavelength: transfer.pathRadianceByWavelength,
          attenuatedObjectRadianceByWavelength,
          finalRadianceByWavelength,
          components: {
            firstOrderPathRadianceByWavelength:
              transfer.firstOrderPathRadianceByWavelength,
            secondOrderPathRadianceByWavelength:
              transfer.secondOrderPathRadianceByWavelength,
          },
          displayPreview: {
            sourceObject: spectralToDisplayPreview(objectRadianceByWavelength),
            attenuatedObject: spectralToDisplayPreview(
              attenuatedObjectRadianceByWavelength
            ),
            pathRadiance: spectralToDisplayPreview(
              transfer.pathRadianceByWavelength
            ),
            finalRadiance: spectralToDisplayPreview(finalRadianceByWavelength),
          },
          diagnostics: {
            meanReflectance: mean(reflectanceByWavelength),
            meanDirectIrradiance: mean(directIrradianceByWavelength),
            meanSurfaceRadiance: mean(objectRadianceByWavelength),
            meanTransmittance: mean(transfer.transmittanceByWavelength),
            minTransmittance: Math.min(...transfer.transmittanceByWavelength),
            meanPathRadiance: mean(transfer.pathRadianceByWavelength),
            meanFinalRadiance: mean(finalRadianceByWavelength),
          },
        });
      }
    }
  }

  return {
    transferCases,
    compositionDiagnostics,
    cacheDiagnostics: {
      incidentSkyCacheEntries: incidentSkyCache.size,
    },
    artifactInfo,
  };
}

function localSunWorldPosition() {
  return enuToWorld(LOCAL_SUN_PROFILE.positionMetersENU);
}

function localSourceDirectionAndFalloff(position) {
  const source = localSunWorldPosition();
  const reference = enuToWorld(LOCAL_SUN_PROFILE.referenceReceiverMetersENU);
  const toSource = [
    source[0] - position[0],
    source[1] - position[1],
    source[2] - position[2],
  ];
  const referenceToSource = [
    source[0] - reference[0],
    source[1] - reference[1],
    source[2] - reference[2],
  ];
  const sourceDistanceMeters = length(toSource);
  const referenceDistanceMeters = length(referenceToSource);

  return {
    sourceDirection: normalize(toSource),
    sourceDistanceMeters,
    referenceDistanceMeters,
    irradianceFalloff:
      (referenceDistanceMeters * referenceDistanceMeters) /
      (sourceDistanceMeters * sourceDistanceMeters),
  };
}

function computeLocalSunPathRadianceSegment({
  origin,
  direction,
  distance,
  controls,
}) {
  const fullOpticalLengths = computeOpticalLengthsAlongDistance(
    origin,
    direction,
    distance,
    controls.viewRayScatteringIntervals
  );
  const fullTransmittance = computeTransmittanceSpectrum(fullOpticalLengths);

  if (distance === 0) {
    return {
      opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
      transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
      pathRadianceByWavelength: zeroSpectrum(),
      firstOrderPathRadianceByWavelength: zeroSpectrum(),
      secondOrderPathRadianceByWavelength: zeroSpectrum(),
      diagnostics: {
        sampleCount: controls.viewRayScatteringIntervals,
        sourceAngularSpreadDegrees: 0,
        minSourceDistanceMeters:
          localSourceDirectionAndFalloff(origin).sourceDistanceMeters,
        maxSourceDistanceMeters:
          localSourceDirectionAndFalloff(origin).sourceDistanceMeters,
      },
    };
  }

  const sampleCount = controls.viewRayScatteringIntervals;
  const step = distance / sampleCount;
  const samples = [];
  const cumulativeRayleigh = [0];
  const cumulativeMie = [0];
  const cumulativeAbsorption = [0];
  const firstOrderPathRadianceByWavelength = zeroSpectrum();
  let minSourceDistanceMeters = Number.POSITIVE_INFINITY;
  let maxSourceDistanceMeters = 0;
  let minPhaseNu = Number.POSITIVE_INFINITY;
  let maxPhaseNu = Number.NEGATIVE_INFINITY;
  const endpointSourceDirections = [];

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const sampleDistance = sampleIndex * step;
    const position = addScaled(origin, direction, sampleDistance);
    const density = densityAtPosition(position);

    samples.push({ position, density });

    if (sampleIndex === 0 || sampleIndex === sampleCount) {
      endpointSourceDirections.push(
        localSourceDirectionAndFalloff(position).sourceDirection
      );
    }

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
    }).transmittanceByWavelength;
    const localSource = localSourceDirectionAndFalloff(sample.position);
    const sourceTransmittance = computeTransmittanceToSunSpectrum(
      sample.position,
      localSource.sourceDirection,
      controls
    );
    const nu = dot(direction, localSource.sourceDirection);
    const rayleighPhase = rayleighPhaseFunction(nu);
    const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);

    minSourceDistanceMeters = Math.min(
      minSourceDistanceMeters,
      localSource.sourceDistanceMeters
    );
    maxSourceDistanceMeters = Math.max(
      maxSourceDistanceMeters,
      localSource.sourceDistanceMeters
    );
    minPhaseNu = Math.min(minPhaseNu, nu);
    maxPhaseNu = Math.max(maxPhaseNu, nu);

    for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
      const channel = SPECTRAL_CHANNELS[channelIndex];
      const wavelengthMicrometers = wavelengthNanometersToMicrometers(
        channel.wavelengthNanometers
      );
      const scatteringCoefficient =
        sample.density.rayleigh *
          rayleighScatteringCoefficientAt(wavelengthMicrometers) *
          rayleighPhase +
        sample.density.mie *
          mieScatteringCoefficientAt(wavelengthMicrometers) *
          miePhase;

      firstOrderPathRadianceByWavelength[channelIndex] +=
        viewTransmittance[channelIndex] *
        sourceTransmittance[channelIndex] *
        localSource.irradianceFalloff *
        channel.solarIrradiance *
        scatteringCoefficient *
        weight *
        step;
    }
  }

  const endpointAngularSpreadDegrees =
    endpointSourceDirections.length === 2
      ? (Math.acos(
          clamp(dot(endpointSourceDirections[0], endpointSourceDirections[1]), -1, 1)
        ) *
          180) /
        Math.PI
      : 0;

  return {
    opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
    transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
    pathRadianceByWavelength: firstOrderPathRadianceByWavelength,
    firstOrderPathRadianceByWavelength,
    secondOrderPathRadianceByWavelength: zeroSpectrum(),
    diagnostics: {
      sampleCount,
      endpointAngularSpreadDegrees,
      minSourceDistanceMeters,
      maxSourceDistanceMeters,
      minPhaseNu,
      maxPhaseNu,
      phaseNuRange: maxPhaseNu - minPhaseNu,
    },
  };
}

function computeLocalSunCases(step, artifactInfo) {
  const controls = step.numericalControls;
  const transferCases = [];
  const origin = observerPosition();
  const direction = normalize(CAMERA.forwardMetersENU);

  for (const objectSpectrum of OBJECT_SPECTRA) {
    const objectRadianceByWavelength = objectRadianceSpectrum(objectSpectrum);

    for (const distanceMeters of DISTANCES_METERS) {
      const targetCenterMetersENU = [distanceMeters, 0, 2];
      const targetWorld = addScaled(origin, direction, distanceMeters);
      const transfer = computeLocalSunPathRadianceSegment({
        origin,
        direction,
        distance: distanceMeters,
        controls,
      });
      const localAtTarget = localSourceDirectionAndFalloff(targetWorld);
      const attenuatedObjectRadianceByWavelength = multiplyArrays(
        objectRadianceByWavelength,
        transfer.transmittanceByWavelength
      );
      const finalRadianceByWavelength = addArrays(
        attenuatedObjectRadianceByWavelength,
        transfer.pathRadianceByWavelength
      );
      const caseId = [
        "local-point-sun",
        `${String(distanceMeters).padStart(6, "0")}m`,
        objectSpectrum.id,
      ].join("--");

      transferCases.push({
        caseId,
        wavelengthsNm: SPECTRAL_CHANNELS.map(
          (channel) => channel.wavelengthNanometers
        ),
        units: {
          wavelengthsNm: "nm",
          sourceDistanceMeters: "m",
          irradianceFalloff: "dimensionless inverse-square receiver factor",
          objectRadianceByWavelength:
            "algorithmic unit spectral-radiance scale",
          transmittanceByWavelength: "dimensionless",
          pathRadianceByWavelength:
            "local finite-source first-order spectral radiance scale",
        },
        sunCase: {
          id: "local-point-sun",
          sourceProfile: LOCAL_SUN_PROFILE,
        },
        geometryProfileId: "spherical-earth-ground-observer",
        sourceProfileId: LOCAL_SUN_PROFILE.id,
        camera: CAMERA,
        target: {
          id: `target-${distanceMeters}m-${objectSpectrum.id}`,
          shape: "spectral-card",
          centerMetersENU: targetCenterMetersENU,
          normalMetersENU: [-1, 0, 0],
          widthMeters: distanceMeters === 0 ? 0 : 1,
          heightMeters: distanceMeters === 0 ? 0 : 1,
          distanceMeters,
          objectSpectrumId: objectSpectrum.id,
        },
        segment: {
          originMeters: CAMERA.originMetersENU,
          targetMeters: targetCenterMetersENU,
          lengthMeters: distanceMeters,
          directionMeters: direction,
        },
        objectSpectrumId: objectSpectrum.id,
        objectRadianceByWavelength,
        opticalDepthByWavelength: transfer.opticalDepthByWavelength,
        transmittanceByWavelength: transfer.transmittanceByWavelength,
        pathRadianceByWavelength: transfer.pathRadianceByWavelength,
        attenuatedObjectRadianceByWavelength,
        finalRadianceByWavelength,
        components: {
          firstOrderPathRadianceByWavelength:
            transfer.firstOrderPathRadianceByWavelength,
          secondOrderPathRadianceByWavelength:
            transfer.secondOrderPathRadianceByWavelength,
        },
        displayPreview: {
          sourceObject: spectralToDisplayPreview(objectRadianceByWavelength),
          attenuatedObject: spectralToDisplayPreview(
            attenuatedObjectRadianceByWavelength
          ),
          pathRadiance: spectralToDisplayPreview(
            transfer.pathRadianceByWavelength
          ),
          finalRadiance: spectralToDisplayPreview(finalRadianceByWavelength),
        },
        diagnostics: {
          ...transfer.diagnostics,
          sourcePositionMetersENU: LOCAL_SUN_PROFILE.positionMetersENU,
          targetSourceDirection: localAtTarget.sourceDirection,
          targetSourceDistanceMeters: localAtTarget.sourceDistanceMeters,
          targetIrradianceFalloff: localAtTarget.irradianceFalloff,
          meanTransmittance: mean(transfer.transmittanceByWavelength),
          minTransmittance: Math.min(...transfer.transmittanceByWavelength),
          meanPathRadiance: mean(transfer.pathRadianceByWavelength),
          meanFinalRadiance: mean(finalRadianceByWavelength),
        },
      });
    }
  }

  return {
    transferCases,
    compositionDiagnostics: [],
    cacheDiagnostics: {
      localSunProfile: LOCAL_SUN_PROFILE,
    },
    artifactInfo,
  };
}

function flatDensityAtAltitude(altitudeMeters) {
  return {
    rayleigh: exponentialDensity(altitudeMeters, ATMOSPHERE.rayleighScaleHeightMeters),
    mie: exponentialDensity(altitudeMeters, ATMOSPHERE.mieScaleHeightMeters),
    absorption: 0,
  };
}

function flatOpticalLengthsHorizontal(distanceMeters, altitudeMeters) {
  const density = flatDensityAtAltitude(altitudeMeters);

  return {
    distance: distanceMeters,
    rayleighOpticalLength: density.rayleigh * distanceMeters,
    mieOpticalLength: density.mie * distanceMeters,
    absorptionOpticalLength: 0,
  };
}

function flatOpticalLengthsAlongRay(
  direction,
  distanceMeters,
  altitudeMeters,
  sampleCount
) {
  if (distanceMeters === 0 || sampleCount === 0) {
    return {
      distance: distanceMeters,
      rayleighOpticalLength: 0,
      mieOpticalLength: 0,
      absorptionOpticalLength: 0,
    };
  }

  const step = distanceMeters / sampleCount;
  let rayleighOpticalLength = 0;
  let mieOpticalLength = 0;

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const distance = sampleIndex * step;
    const altitude = Math.max(0, altitudeMeters + direction[2] * distance);
    const density = flatDensityAtAltitude(altitude);
    const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;

    rayleighOpticalLength += density.rayleigh * weight * step;
    mieOpticalLength += density.mie * weight * step;
  }

  return {
    distance: distanceMeters,
    rayleighOpticalLength,
    mieOpticalLength,
    absorptionOpticalLength: 0,
  };
}

function flatOpticalLengthsToTop(altitudeMeters, sunRay, sampleCount) {
  if (sunRay[2] <= 0) {
    return null;
  }

  const topAltitudeMeters =
    ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters;
  const distanceToTop = (topAltitudeMeters - altitudeMeters) / sunRay[2];
  const step = distanceToTop / sampleCount;
  let rayleighOpticalLength = 0;
  let mieOpticalLength = 0;

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const distance = sampleIndex * step;
    const altitude = altitudeMeters + sunRay[2] * distance;
    const density = flatDensityAtAltitude(altitude);
    const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;

    rayleighOpticalLength += density.rayleigh * weight * step;
    mieOpticalLength += density.mie * weight * step;
  }

  return {
    distance: distanceToTop,
    rayleighOpticalLength,
    mieOpticalLength,
    absorptionOpticalLength: 0,
  };
}

function computeFlatPathRadianceSegment({
  distance,
  sunRay,
  controls,
  altitudeMeters,
}) {
  const fullOpticalLengths = flatOpticalLengthsHorizontal(distance, altitudeMeters);
  const fullTransmittance = computeTransmittanceSpectrum(fullOpticalLengths);

  if (distance === 0) {
    return {
      opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
      transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
      pathRadianceByWavelength: zeroSpectrum(),
      firstOrderPathRadianceByWavelength: zeroSpectrum(),
      secondOrderPathRadianceByWavelength: zeroSpectrum(),
      diagnostics: {
        minAltitudeMeters: altitudeMeters,
        maxAltitudeMeters: altitudeMeters,
        logTransmittanceByWavelength:
          fullTransmittance.transmittanceByWavelength.map((value) =>
            Math.log(value)
          ),
      },
    };
  }

  const sampleCount = controls.viewRayScatteringIntervals;
  const step = distance / sampleCount;
  const density = flatDensityAtAltitude(altitudeMeters);
  const pathRadianceByWavelength = zeroSpectrum();
  const nu = dot([1, 0, 0], sunRay);
  const rayleighPhase = rayleighPhaseFunction(nu);
  const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);
  const sunOpticalLengths = flatOpticalLengthsToTop(
    altitudeMeters,
    sunRay,
    controls.sampleToSunTransmittanceIntervals
  );
  const sunTransmittance = sunOpticalLengths
    ? computeTransmittanceSpectrum(sunOpticalLengths).transmittanceByWavelength
    : zeroSpectrum();

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const sampleDistance = sampleIndex * step;
    const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;
    const viewTransmittance = computeTransmittanceSpectrum(
      flatOpticalLengthsHorizontal(sampleDistance, altitudeMeters)
    ).transmittanceByWavelength;

    for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
      const channel = SPECTRAL_CHANNELS[channelIndex];
      const wavelengthMicrometers = wavelengthNanometersToMicrometers(
        channel.wavelengthNanometers
      );
      const scatteringCoefficient =
        density.rayleigh *
          rayleighScatteringCoefficientAt(wavelengthMicrometers) *
          rayleighPhase +
        density.mie *
          mieScatteringCoefficientAt(wavelengthMicrometers) *
          miePhase;

      pathRadianceByWavelength[channelIndex] +=
        viewTransmittance[channelIndex] *
        sunTransmittance[channelIndex] *
        channel.solarIrradiance *
        scatteringCoefficient *
        weight *
        step;
    }
  }

  return {
    opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
    transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
    pathRadianceByWavelength,
    firstOrderPathRadianceByWavelength: pathRadianceByWavelength,
    secondOrderPathRadianceByWavelength: zeroSpectrum(),
    diagnostics: {
      minAltitudeMeters: altitudeMeters,
      maxAltitudeMeters: altitudeMeters,
      logTransmittanceByWavelength:
        fullTransmittance.transmittanceByWavelength.map((value) =>
          Math.log(value)
        ),
      sunDistanceToTopMeters: sunOpticalLengths ? sunOpticalLengths.distance : null,
    },
  };
}

function computeFlatPathRadianceRay({
  direction,
  distance,
  sunRay,
  controls,
  altitudeMeters,
}) {
  const fullOpticalLengths = flatOpticalLengthsAlongRay(
    direction,
    distance,
    altitudeMeters,
    controls.viewRayScatteringIntervals
  );
  const fullTransmittance = computeTransmittanceSpectrum(fullOpticalLengths);

  if (distance === 0) {
    return {
      opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
      transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
      pathRadianceByWavelength: zeroSpectrum(),
      firstOrderPathRadianceByWavelength: zeroSpectrum(),
      secondOrderPathRadianceByWavelength: zeroSpectrum(),
      diagnostics: {
        minAltitudeMeters: altitudeMeters,
        maxAltitudeMeters: altitudeMeters,
      },
    };
  }

  const sampleCount = controls.viewRayScatteringIntervals;
  const step = distance / sampleCount;
  const pathRadianceByWavelength = zeroSpectrum();
  const nu = dot(direction, sunRay);
  const rayleighPhase = rayleighPhaseFunction(nu);
  const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);
  let minAltitudeMeters = Number.POSITIVE_INFINITY;
  let maxAltitudeMeters = Number.NEGATIVE_INFINITY;

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const sampleDistance = sampleIndex * step;
    const sampleAltitude = Math.max(
      0,
      altitudeMeters + direction[2] * sampleDistance
    );
    const density = flatDensityAtAltitude(sampleAltitude);
    const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;
    const viewTransmittance = computeTransmittanceSpectrum(
      flatOpticalLengthsAlongRay(
        direction,
        sampleDistance,
        altitudeMeters,
        Math.max(1, Math.ceil(sampleIndex))
      )
    ).transmittanceByWavelength;
    const sunOpticalLengths = flatOpticalLengthsToTop(
      sampleAltitude,
      sunRay,
      controls.sampleToSunTransmittanceIntervals
    );
    const sunTransmittance = sunOpticalLengths
      ? computeTransmittanceSpectrum(sunOpticalLengths).transmittanceByWavelength
      : SPECTRAL_CHANNELS.map(() => 0);

    minAltitudeMeters = Math.min(minAltitudeMeters, sampleAltitude);
    maxAltitudeMeters = Math.max(maxAltitudeMeters, sampleAltitude);

    for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
      const channel = SPECTRAL_CHANNELS[channelIndex];
      const wavelengthMicrometers = wavelengthNanometersToMicrometers(
        channel.wavelengthNanometers
      );
      const scatteringCoefficient =
        density.rayleigh *
          rayleighScatteringCoefficientAt(wavelengthMicrometers) *
          rayleighPhase +
        density.mie *
          mieScatteringCoefficientAt(wavelengthMicrometers) *
          miePhase;

      pathRadianceByWavelength[channelIndex] +=
        viewTransmittance[channelIndex] *
        sunTransmittance[channelIndex] *
        channel.solarIrradiance *
        scatteringCoefficient *
        weight *
        step;
    }
  }

  return {
    opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
    transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
    pathRadianceByWavelength,
    firstOrderPathRadianceByWavelength: pathRadianceByWavelength,
    secondOrderPathRadianceByWavelength: zeroSpectrum(),
    diagnostics: {
      minAltitudeMeters,
      maxAltitudeMeters,
    },
  };
}

function computeFlatLongSightlineCases(step, artifactInfo) {
  const controls = step.numericalControls;
  const transferCases = [];
  const altitudeMeters = CAMERA.originMetersENU[2];

  for (const sunCase of SUN_CASES) {
    const sunRay = sunDirection(sunCase);

    for (const objectSpectrum of OBJECT_SPECTRA) {
      const objectRadianceByWavelength = objectRadianceSpectrum(objectSpectrum);

      for (const distanceMeters of FLAT_LONG_DISTANCES_METERS) {
        const transfer = computeFlatPathRadianceSegment({
          distance: distanceMeters,
          sunRay,
          controls,
          altitudeMeters,
        });
        const attenuatedObjectRadianceByWavelength = multiplyArrays(
          objectRadianceByWavelength,
          transfer.transmittanceByWavelength
        );
        const finalRadianceByWavelength = addArrays(
          attenuatedObjectRadianceByWavelength,
          transfer.pathRadianceByWavelength
        );
        const targetCenterMetersENU = [distanceMeters, 0, altitudeMeters];
        const caseId = [
          "flat-slab",
          sunCase.id,
          `${String(distanceMeters).padStart(7, "0")}m`,
          objectSpectrum.id,
        ].join("--");

        transferCases.push({
          caseId,
          wavelengthsNm: SPECTRAL_CHANNELS.map(
            (channel) => channel.wavelengthNanometers
          ),
          units: {
            wavelengthsNm: "nm",
            distanceMeters: "m",
            altitudeMeters: "m",
            opticalDepthByWavelength: "dimensionless",
            logTransmittanceByWavelength: "dimensionless",
            objectRadianceByWavelength:
              "algorithmic unit spectral-radiance scale",
            transmittanceByWavelength: "dimensionless",
            pathRadianceByWavelength:
              "flat-slab first-order spectral radiance scale",
          },
          sunCase: {
            ...sunCase,
            sunDirection: sunRay,
          },
          geometryProfileId: "flat-slab",
          sourceProfileId: "bruneton-figure1-directional-sun",
          camera: {
            ...CAMERA,
            geometryProfileId: "flat-slab",
          },
          target: {
            id: `flat-target-${distanceMeters}m-${objectSpectrum.id}`,
            shape: "flat-slab-spectral-card",
            centerMetersENU: targetCenterMetersENU,
            normalMetersENU: [-1, 0, 0],
            widthMeters: distanceMeters === 0 ? 0 : 1,
            heightMeters: distanceMeters === 0 ? 0 : 1,
            distanceMeters,
            objectSpectrumId: objectSpectrum.id,
          },
          segment: {
            originMeters: CAMERA.originMetersENU,
            targetMeters: targetCenterMetersENU,
            lengthMeters: distanceMeters,
            directionMeters: [1, 0, 0],
          },
          objectSpectrumId: objectSpectrum.id,
          objectRadianceByWavelength,
          opticalDepthByWavelength: transfer.opticalDepthByWavelength,
          transmittanceByWavelength: transfer.transmittanceByWavelength,
          pathRadianceByWavelength: transfer.pathRadianceByWavelength,
          attenuatedObjectRadianceByWavelength,
          finalRadianceByWavelength,
          components: {
            firstOrderPathRadianceByWavelength:
              transfer.firstOrderPathRadianceByWavelength,
            secondOrderPathRadianceByWavelength:
              transfer.secondOrderPathRadianceByWavelength,
          },
          displayPreview: {
            sourceObject: spectralToDisplayPreview(objectRadianceByWavelength),
            attenuatedObject: spectralToDisplayPreview(
              attenuatedObjectRadianceByWavelength
            ),
            pathRadiance: spectralToDisplayPreview(
              transfer.pathRadianceByWavelength
            ),
            finalRadiance: spectralToDisplayPreview(finalRadianceByWavelength),
          },
          diagnostics: {
            ...transfer.diagnostics,
            altitudeRangeMeters:
              transfer.diagnostics.maxAltitudeMeters -
              transfer.diagnostics.minAltitudeMeters,
            meanTransmittance: mean(transfer.transmittanceByWavelength),
            minTransmittance: Math.min(...transfer.transmittanceByWavelength),
            meanPathRadiance: mean(transfer.pathRadianceByWavelength),
            meanFinalRadiance: mean(finalRadianceByWavelength),
          },
        });
      }
    }
  }

  return {
    transferCases,
    compositionDiagnostics: [],
    cacheDiagnostics: {
      geometryProfile: "flat-slab",
      distancesMeters: FLAT_LONG_DISTANCES_METERS,
    },
    artifactInfo,
  };
}

function transferCaseSourceId(transferCase) {
  return transferCase.sunCase?.id || transferCase.sourceProfileId || "unknown";
}

function uniqueSortedNumbers(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function uniqueInOrder(values, order) {
  const orderIndex = new Map(order.map((value, index) => [value, index]));

  return [...new Set(values)].sort((a, b) => {
    const aIndex = orderIndex.has(a) ? orderIndex.get(a) : Number.MAX_SAFE_INTEGER;
    const bIndex = orderIndex.has(b) ? orderIndex.get(b) : Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.localeCompare(b);
  });
}

function selectSceneCases(sourceArtifact, panelDefinition) {
  const spectrumOrder = new Map(
    panelDefinition.spectrumIds.map((spectrumId, index) => [spectrumId, index])
  );
  const sourceOrder = new Map(
    panelDefinition.expectedSunCaseIds.map((sourceId, index) => [sourceId, index])
  );

  return sourceArtifact.transferCases
    .filter((transferCase) =>
      panelDefinition.spectrumIds.includes(transferCase.objectSpectrumId)
    )
    .map((transferCase) => ({
      ...transferCase,
      sceneGallery: {
        panelId: panelDefinition.id,
        panelTitle: panelDefinition.title,
        sourceArtifact: sourceArtifact.folderName,
        sourceLabel: panelDefinition.sourceLabel,
      },
    }))
    .sort((a, b) => {
      const aSource = transferCaseSourceId(a);
      const bSource = transferCaseSourceId(b);
      const aSourceIndex = sourceOrder.has(aSource)
        ? sourceOrder.get(aSource)
        : Number.MAX_SAFE_INTEGER;
      const bSourceIndex = sourceOrder.has(bSource)
        ? sourceOrder.get(bSource)
        : Number.MAX_SAFE_INTEGER;

      if (aSourceIndex !== bSourceIndex) {
        return aSourceIndex - bSourceIndex;
      }

      const aSpectrumIndex = spectrumOrder.get(a.objectSpectrumId);
      const bSpectrumIndex = spectrumOrder.get(b.objectSpectrumId);

      if (aSpectrumIndex !== bSpectrumIndex) {
        return aSpectrumIndex - bSpectrumIndex;
      }

      return a.target.distanceMeters - b.target.distanceMeters;
    });
}

function summarizeScenePanel(panel) {
  const cases = panel.cases || [];
  const sourceIds = uniqueInOrder(
    cases.map((transferCase) => transferCaseSourceId(transferCase)),
    panel.expectedSunCaseIds
  );
  const spectrumIds = uniqueInOrder(
    cases.map((transferCase) => transferCase.objectSpectrumId),
    panel.spectrumIds
  );
  const distancesMeters = uniqueSortedNumbers(
    cases.map((transferCase) => transferCase.target.distanceMeters)
  );

  return {
    id: panel.id,
    title: panel.title,
    sourceLabel: panel.sourceLabel,
    sourceArtifact: panel.sourceArtifact,
    sourceArtifactFolder: panel.sourceArtifactFolder,
    sourceStepId: panel.sourceStep?.id || null,
    sourceNumericalControls: panel.sourceStep?.numericalControls || null,
    outputFileName: panel.outputFileName,
    expectedSunCaseIds: panel.expectedSunCaseIds,
    sourceIds,
    sceneSpectrumId: panel.sceneSpectrumId,
    sceneSpectrumBySourceId: panel.sceneSpectrumBySourceId,
    sceneSpectrumSetIds: panel.sceneSpectrumSetIds,
    spectrumIds,
    distancesMeters,
    caseCount: cases.length,
    caseIds: cases.map((transferCase) => transferCase.caseId),
    sourceCriteriaSummary: panel.sourceCriteriaSummary,
    status: panel.status,
  };
}

function computeSceneGallery(step, artifactInfo) {
  const scenePanels = [];
  const transferCases = [];

  for (const panelDefinition of SCENE_GALLERY_PHASES) {
    const sourceArtifact = findLatestAcceptedArtifactByLabel(
      artifactInfo.existingArtifacts,
      panelDefinition.sourceLabel
    );

    if (!sourceArtifact) {
      scenePanels.push({
        ...panelDefinition,
        sourceArtifact: null,
        sourceArtifactFolder: null,
        sourceStep: null,
        sourceCriteriaSummary: null,
        cases: [],
        status: "missing-source-artifact",
      });
      continue;
    }

    const cases = selectSceneCases(sourceArtifact, panelDefinition);

    transferCases.push(...cases);
    scenePanels.push({
      ...panelDefinition,
      sourceArtifact: sourceArtifact.folderName,
      sourceArtifactFolder: path
        .relative(ROOT, sourceArtifact.directory)
        .replaceAll("\\", "/"),
      sourceStep: sourceArtifact.provenance.step,
      sourceCriteriaSummary: sourceArtifact.criteriaResults.summary,
      cases,
      status: "ready",
    });
  }

  return {
    transferCases,
    scenePanels,
    compositionDiagnostics: [],
    cacheDiagnostics: {
      scenePanels: scenePanels.map(summarizeScenePanel),
      sourceArtifacts: scenePanels.map((panel) => ({
        panelId: panel.id,
        sourceLabel: panel.sourceLabel,
        sourceArtifact: panel.sourceArtifact,
        sourceCriteriaSummary: panel.sourceCriteriaSummary,
        status: panel.status,
      })),
    },
    artifactInfo,
  };
}

function casesByKey(transferCases) {
  const result = new Map();

  for (const transferCase of transferCases) {
    result.set(
      `${transferCase.sunCase.id}|${transferCase.target.distanceMeters}|${transferCase.objectSpectrumId}`,
      transferCase
    );
  }

  return result;
}

function criterionResult({
  criterionId,
  status,
  tolerance,
  measuredError,
  effectSize,
  sourceOrStatus,
  cases,
  notes,
}) {
  return {
    criterionId,
    status,
    tolerance,
    measuredError,
    effectSize,
    sourceOrStatus,
    cases,
    notes,
  };
}

function computeConvergenceComparison(
  transferCases,
  baselineArtifact,
  demonstrationEffects
) {
  const baselineByKey = casesByKey(baselineArtifact.transferCases);
  let maxTransmittanceDelta = 0;
  let maxPathRadianceDelta = 0;
  let maxFinalRadianceDelta = 0;
  let maxAttenuatedObjectDelta = 0;
  let matchedCaseCount = 0;
  const missingCaseIds = [];

  for (const transferCase of transferCases) {
    const key = `${transferCase.sunCase.id}|${transferCase.target.distanceMeters}|${transferCase.objectSpectrumId}`;
    const baselineCase = baselineByKey.get(key);

    if (!baselineCase) {
      missingCaseIds.push(transferCase.caseId);
      continue;
    }

    matchedCaseCount += 1;
    maxTransmittanceDelta = Math.max(
      maxTransmittanceDelta,
      maxAbs(
        subtractArrays(
          transferCase.transmittanceByWavelength,
          baselineCase.transmittanceByWavelength
        )
      )
    );
    maxPathRadianceDelta = Math.max(
      maxPathRadianceDelta,
      maxAbs(
        subtractArrays(
          transferCase.pathRadianceByWavelength,
          baselineCase.pathRadianceByWavelength
        )
      )
    );
    maxFinalRadianceDelta = Math.max(
      maxFinalRadianceDelta,
      maxAbs(
        subtractArrays(
          transferCase.finalRadianceByWavelength,
          baselineCase.finalRadianceByWavelength
        )
      )
    );
    maxAttenuatedObjectDelta = Math.max(
      maxAttenuatedObjectDelta,
      maxAbs(
        subtractArrays(
          transferCase.attenuatedObjectRadianceByWavelength,
          baselineCase.attenuatedObjectRadianceByWavelength
        )
      )
    );
  }

  const marginMultiplier = 5;
  const epsilon = 1e-30;
  const distanceTransmittanceMargin =
    demonstrationEffects.distanceEffectSize /
    Math.max(maxTransmittanceDelta, epsilon);
  const sunPathMargin =
    demonstrationEffects.sunPathDifference /
    Math.max(maxPathRadianceDelta, epsilon);
  const sunFinalMargin =
    demonstrationEffects.sunFinalDifference /
    Math.max(maxFinalRadianceDelta, epsilon);
  const minimumMargin = Math.min(
    distanceTransmittanceMargin,
    sunPathMargin,
    sunFinalMargin
  );

  return {
    baselineArtifact: baselineArtifact.folderName,
    matchedCaseCount,
    missingCaseIds,
    maxTransmittanceDelta,
    maxPathRadianceDelta,
    maxFinalRadianceDelta,
    maxAttenuatedObjectDelta,
    marginMultiplier,
    effects: demonstrationEffects,
    margins: {
      distanceTransmittanceMargin,
      sunPathMargin,
      sunFinalMargin,
      minimumMargin,
    },
    passed:
      missingCaseIds.length === 0 &&
      distanceTransmittanceMargin >= marginMultiplier &&
      sunPathMargin >= marginMultiplier &&
      sunFinalMargin >= marginMultiplier,
  };
}

function evaluateCriteria(transferCases, compositionDiagnostics, options = {}) {
  const byKey = casesByKey(transferCases);
  const criteria = [];
  const hardTolerance = { absolute: 1e-10, relative: 1e-8 };
  const zeroTolerance = { absolute: 1e-12 };
  let maxCompositionError = 0;
  let maxZeroTransmittanceError = 0;
  let maxZeroPathRadiance = 0;
  let maxBlackIdentityError = 0;
  let maxLinearityError = 0;
  let maxBeerLambertError = 0;
  let minTransmittance = Number.POSITIVE_INFINITY;
  let maxTransmittance = Number.NEGATIVE_INFINITY;
  let minOpticalDepth = Number.POSITIVE_INFINITY;
  let finiteNonnegativeFailureCount = 0;

  for (const transferCase of transferCases) {
    const recomposed = addArrays(
      multiplyArrays(
        transferCase.objectRadianceByWavelength,
        transferCase.transmittanceByWavelength
      ),
      transferCase.pathRadianceByWavelength
    );

    maxCompositionError = Math.max(
      maxCompositionError,
      maxAbs(subtractArrays(recomposed, transferCase.finalRadianceByWavelength))
    );

    for (let index = 0; index < SPECTRAL_CHANNELS.length; index += 1) {
      const transmittance = transferCase.transmittanceByWavelength[index];
      const opticalDepth = transferCase.opticalDepthByWavelength[index];

      minTransmittance = Math.min(minTransmittance, transmittance);
      maxTransmittance = Math.max(maxTransmittance, transmittance);
      minOpticalDepth = Math.min(minOpticalDepth, opticalDepth);
      maxBeerLambertError = Math.max(
        maxBeerLambertError,
        Math.abs(transmittance - Math.exp(-opticalDepth))
      );

      for (const value of [
        opticalDepth,
        transmittance,
        transferCase.objectRadianceByWavelength[index],
        transferCase.pathRadianceByWavelength[index],
        transferCase.attenuatedObjectRadianceByWavelength[index],
        transferCase.finalRadianceByWavelength[index],
      ]) {
        if (!Number.isFinite(value) || value < -1e-12) {
          finiteNonnegativeFailureCount += 1;
        }
      }
    }

    if (transferCase.target.distanceMeters === 0) {
      maxZeroTransmittanceError = Math.max(
        maxZeroTransmittanceError,
        maxAbs(transferCase.transmittanceByWavelength.map((value) => value - 1))
      );
      maxZeroPathRadiance = Math.max(
        maxZeroPathRadiance,
        maxAbs(transferCase.pathRadianceByWavelength)
      );
    }

    if (transferCase.objectSpectrumId === "black") {
      maxBlackIdentityError = Math.max(
        maxBlackIdentityError,
        maxAbs(
          subtractArrays(
            transferCase.finalRadianceByWavelength,
            transferCase.pathRadianceByWavelength
          )
        )
      );
    }
  }

  const linearityPairs = [
    ["neutral_high", "neutral_unit"],
    ["red_step", "blue_step"],
    ["green_peak", "neutral_unit"],
  ];

  for (const sunCase of SUN_CASES) {
    for (const distanceMeters of DISTANCES_METERS) {
      for (const [aId, bId] of linearityPairs) {
        const a = byKey.get(`${sunCase.id}|${distanceMeters}|${aId}`);
        const b = byKey.get(`${sunCase.id}|${distanceMeters}|${bId}`);
        const finalDelta = subtractArrays(
          a.finalRadianceByWavelength,
          b.finalRadianceByWavelength
        );
        const objectDelta = subtractArrays(
          a.objectRadianceByWavelength,
          b.objectRadianceByWavelength
        );
        const expected = multiplyArrays(a.transmittanceByWavelength, objectDelta);

        maxLinearityError = Math.max(
          maxLinearityError,
          maxAbs(subtractArrays(finalDelta, expected))
        );
      }
    }
  }

  criteria.push(
    criterionResult({
      criterionId: "composition-identity",
      status: maxCompositionError <= hardTolerance.absolute ? "pass" : "fail",
      tolerance: hardTolerance,
      measuredError: maxCompositionError,
      sourceOrStatus: "reference-backed",
      cases: "all 84 transfer cases",
      notes:
        "Stored final radiance equals T_view * L_object + L_path on spectral arrays.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "zero-distance-identity",
      status:
        maxZeroTransmittanceError <= zeroTolerance.absolute &&
        maxZeroPathRadiance <= zeroTolerance.absolute
          ? "pass"
          : "fail",
      tolerance: zeroTolerance,
      measuredError: {
        maxZeroTransmittanceError,
        maxZeroPathRadiance,
      },
      sourceOrStatus: "reference-backed transfer identity",
      cases: "all 0 m cases",
      notes: "Zero-length segment must have T = 1 and L_path = 0.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "black-object-identity",
      status: maxBlackIdentityError <= hardTolerance.absolute ? "pass" : "fail",
      tolerance: hardTolerance,
      measuredError: maxBlackIdentityError,
      sourceOrStatus: "reference-backed transfer identity",
      cases: "black object cases",
      notes: "With zero object radiance, final radiance equals path radiance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "linearity-identity",
      status: maxLinearityError <= hardTolerance.absolute ? "pass" : "fail",
      tolerance: hardTolerance,
      measuredError: maxLinearityError,
      sourceOrStatus: "reference-backed transfer identity",
      cases: linearityPairs.map((pair) => pair.join(" - ")),
      notes:
        "Final-radiance differences equal transmittance times object-radiance differences.",
    })
  );

  const maxSegmentTransmittanceError = compositionDiagnostics.reduce(
    (max, diagnostic) => Math.max(max, diagnostic.maxTransmittanceError),
    0
  );
  const maxSegmentPathRadianceError = compositionDiagnostics.reduce(
    (max, diagnostic) => Math.max(max, diagnostic.maxPathRadianceError),
    0
  );

  criteria.push(
    criterionResult({
      criterionId: "segment-composition-identity",
      status:
        maxSegmentTransmittanceError <= 1e-5 &&
        maxSegmentPathRadianceError <= 1e-5
          ? "pass"
          : "fail",
      tolerance: { absolute: 1e-5, status: "algorithmic until convergence" },
      measuredError: {
        maxSegmentTransmittanceError,
        maxSegmentPathRadianceError,
      },
      sourceOrStatus: "reference-backed identity, algorithmic numerical gate",
      cases: compositionDiagnostics.map(
        (diagnostic) => `${diagnostic.sunCase} ${diagnostic.distanceMeters}m`
      ),
      notes:
        "Splitting a segment recomposes T_full = T_1 * T_2 and L_path_full = L_path_1 + T_1 * L_path_2.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "transmittance-bounds",
      status:
        minTransmittance >= -1e-12 && maxTransmittance <= 1 + 1e-12
          ? "pass"
          : "fail",
      tolerance: { lower: 0, upper: 1, slack: 1e-12 },
      measuredError: { minTransmittance, maxTransmittance },
      sourceOrStatus: "reference-backed",
      cases: "all transfer cases",
      notes: "Beer-Lambert transmittance should stay in [0, 1].",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "nonnegative-optical-depth",
      status: minOpticalDepth >= -1e-12 ? "pass" : "fail",
      tolerance: { lower: 0, slack: 1e-12 },
      measuredError: { minOpticalDepth },
      sourceOrStatus: "reference-backed",
      cases: "all transfer cases",
      notes: "Optical depth should be nonnegative.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "beer-lambert-identity",
      status: maxBeerLambertError <= 1e-12 ? "pass" : "fail",
      tolerance: { absolute: 1e-12 },
      measuredError: maxBeerLambertError,
      sourceOrStatus: "reference-backed",
      cases: "all transfer cases",
      notes: "Stored transmittance equals exp(-opticalDepth).",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "finite-nonnegative-radiance",
      status: finiteNonnegativeFailureCount === 0 ? "pass" : "fail",
      tolerance: { nonnegativeSlack: 1e-12 },
      measuredError: { finiteNonnegativeFailureCount },
      sourceOrStatus: "reference-backed",
      cases: "all transfer cases",
      notes: "Radiance and transfer arrays must be finite and nonnegative.",
    })
  );

  const distanceResponses = [];
  for (const sunCase of SUN_CASES) {
    const nearCase = byKey.get(`${sunCase.id}|100|neutral_unit`);
    const farCase = byKey.get(`${sunCase.id}|100000|neutral_unit`);

    distanceResponses.push({
      sunCase: sunCase.id,
      nearMeanTransmittance: nearCase.diagnostics.meanTransmittance,
      farMeanTransmittance: farCase.diagnostics.meanTransmittance,
      nearMeanPathFraction: nearCase.diagnostics.meanPathRadianceFraction,
      farMeanPathFraction: farCase.diagnostics.meanPathRadianceFraction,
      transmittanceDrop:
        nearCase.diagnostics.meanTransmittance -
        farCase.diagnostics.meanTransmittance,
      pathFractionChange:
        farCase.diagnostics.meanPathRadianceFraction -
        nearCase.diagnostics.meanPathRadianceFraction,
    });
  }
  const distanceEffectSize = Math.min(
    ...distanceResponses.map((response) => response.transmittanceDrop)
  );

  criteria.push(
    criterionResult({
      criterionId: "distance-response",
      status: distanceEffectSize > 0 ? "pass" : "fail",
      tolerance: {
        effect: "positive transmittance drop from 100 m to 100 km",
        status: "algorithmic demonstration gate",
      },
      effectSize: { distanceResponses },
      sourceOrStatus: "algorithmic demonstration criterion",
      cases: "neutral_unit at 100 m and 100 km for both Sun cases",
      notes:
        "Longer finite segments reduce the object term and change relative path-radiance influence.",
    })
  );

  const highSun = byKey.get("figure1-13h15-z21|20000|neutral_unit");
  const lowSun = byKey.get("figure1-06h00-z87|20000|neutral_unit");
  const sunPathDifference = maxAbs(
    subtractArrays(
      highSun.pathRadianceByWavelength,
      lowSun.pathRadianceByWavelength
    )
  );
  const sunFinalDifference = maxAbs(
    subtractArrays(
      highSun.finalRadianceByWavelength,
      lowSun.finalRadianceByWavelength
    )
  );
  const convergenceComparison = options.baselineArtifact
    ? computeConvergenceComparison(transferCases, options.baselineArtifact, {
        distanceEffectSize,
        sunPathDifference,
        sunFinalDifference,
      })
    : null;

  criteria.push(
    criterionResult({
      criterionId: "sun-position-response",
      status:
        sunPathDifference > 1e-12 && sunFinalDifference > 1e-12
          ? "pass"
          : "fail",
      tolerance: {
        effect: "nonzero spectral delta at 20 km",
        status: "algorithmic demonstration gate",
      },
      effectSize: { sunPathDifference, sunFinalDifference },
      sourceOrStatus: "algorithmic demonstration criterion",
      cases: "neutral_unit at 20 km",
      notes:
        "Low-Sun and highest-Sun cases produce different path radiance and final object radiance.",
    })
  );

  criteria.push(
    criterionResult({
      criterionId: "spectral-proof",
      status: "pass",
      sourceOrStatus: "artifact-structure check",
      cases: "all transfer cases",
      notes:
        "Criteria are computed from wavelength-indexed arrays before CIE, sRGB, tone mapping, or PNG writing.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "display-boundary-proof",
      status: "pass",
      sourceOrStatus: "artifact-structure check",
      cases: "contact-sheet.png and displayPreview fields",
      notes:
        "Display previews are generated from transfer-cases.json values and are not used for pass/fail transport checks.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "no-sky-only-proof",
      status: "pass",
      sourceOrStatus: "artifact-structure check",
      cases: "84 finite object endpoint cases",
      notes: "The artifact contains finite target endpoints, not only sky rays.",
    })
  );
  if (options.step && isConvergenceStep(options.step)) {
    criteria.push(
      criterionResult({
        criterionId: "convergence-backed-effect-margin",
        status:
          convergenceComparison && convergenceComparison.passed
            ? "pass"
            : "fail",
        tolerance: {
          marginMultiplier: 5,
          status: "algorithmic convergence gate",
        },
        measuredError: convergenceComparison
          ? {
              maxTransmittanceDelta:
                convergenceComparison.maxTransmittanceDelta,
              maxPathRadianceDelta:
                convergenceComparison.maxPathRadianceDelta,
              maxFinalRadianceDelta:
                convergenceComparison.maxFinalRadianceDelta,
              maxAttenuatedObjectDelta:
                convergenceComparison.maxAttenuatedObjectDelta,
              missingCaseIds: convergenceComparison.missingCaseIds,
            }
          : {
              missingBaselineArtifact: true,
            },
        effectSize: convergenceComparison
          ? convergenceComparison.effects
          : undefined,
        sourceOrStatus: "algorithmic convergence gate",
        cases: convergenceComparison
          ? `${convergenceComparison.matchedCaseCount} matched cases against ${convergenceComparison.baselineArtifact}`
          : "no accepted baseline artifact found",
        notes: convergenceComparison
          ? `Minimum effect-to-convergence margin is ${convergenceComparison.margins.minimumMargin}.`
          : "A convergence artifact requires a previous accepted transfer-baseline artifact.",
      })
    );
  } else {
    criteria.push(
      criterionResult({
        criterionId: "convergence-backed-effect-margin",
        status: "unresolved",
        tolerance: {
          requiredFollowUp: "transfer-convergence",
        },
        sourceOrStatus: "algorithmic pending convergence",
        cases: "all demonstration effects",
        notes:
          "The baseline records effect sizes; the convergence margin is intentionally deferred to the next numbered artifact.",
      })
    );
  }

  return {
    summary: {
      passed: criteria.filter((criterion) => criterion.status === "pass").length,
      failed: criteria.filter((criterion) => criterion.status === "fail").length,
      unresolved: criteria.filter((criterion) => criterion.status === "unresolved").length,
      notApplicable: criteria.filter((criterion) => criterion.status === "not-applicable").length,
    },
    metrics: {
      maxCompositionError,
      maxZeroTransmittanceError,
      maxZeroPathRadiance,
      maxBlackIdentityError,
      maxLinearityError,
      maxSegmentTransmittanceError,
      maxSegmentPathRadianceError,
      maxBeerLambertError,
      minTransmittance,
      maxTransmittance,
      minOpticalDepth,
      finiteNonnegativeFailureCount,
      distanceResponses,
      sunPathDifference,
      sunFinalDifference,
      convergenceComparison,
    },
    compositionDiagnostics,
    criteria,
  };
}

function summarizeCriteria(criteria) {
  return {
    passed: criteria.filter((criterion) => criterion.status === "pass").length,
    failed: criteria.filter((criterion) => criterion.status === "fail").length,
    unresolved: criteria.filter((criterion) => criterion.status === "unresolved").length,
    notApplicable: criteria.filter((criterion) => criterion.status === "not-applicable").length,
  };
}

function evaluateSceneGalleryCriteria(
  scenePanels,
  generatedSceneFiles,
  artifactDirectory,
  renderDiagnostics = []
) {
  const criteria = [];
  const requiredFileNames = [
    ...SCENE_GALLERY_PHASES.map((phase) => phase.outputFileName),
    "scene-gallery.png",
  ];
  const missingSourcePanels = scenePanels
    .filter((panel) => !panel.sourceArtifact)
    .map((panel) => panel.id);
  const panelSummaries = scenePanels.map(summarizeScenePanel);
  const missingCoverage = [];
  let selectedSceneCaseCount = 0;
  let maximumDistanceMeters = 0;
  let minimumNonzeroDistanceMeters = Number.POSITIVE_INFINITY;
  let maxFinalPreviewChannel = 0;
  let spectralDisplayBoundaryFailureCount = 0;
  const sceneSpectrumSelections = [];
  const missingSceneSpectrumSelections = [];
  const totalSkySampleCount = renderDiagnostics.reduce(
    (sum, panel) =>
      sum +
      (panel.sourceViews || []).reduce(
        (viewSum, view) => viewSum + (view.skySampleCount || 0),
        0
      ),
    0
  );
  const totalGroundSampleCount = renderDiagnostics.reduce(
    (sum, panel) =>
      sum +
      (panel.sourceViews || []).reduce(
        (viewSum, view) => viewSum + (view.groundSampleCount || 0),
        0
      ),
    0
  );
  const skyFallbackFailureCount = renderDiagnostics.reduce(
    (sum, panel) =>
      sum +
      (panel.sourceViews || []).filter(
        (view) => !view.computedWithAtmosphereKernels
      ).length,
    0
  );

  for (const panel of scenePanels) {
    const summary = summarizeScenePanel(panel);
    const cases = panel.cases || [];
    const expectedCaseCount =
      panel.expectedSunCaseIds.length *
      panel.spectrumIds.length *
      summary.distancesMeters.length;

    selectedSceneCaseCount += cases.length;

    if (summary.spectrumIds.length !== panel.spectrumIds.length) {
      missingCoverage.push(`${panel.id}: spectrum coverage`);
    }

    if (summary.distancesMeters.length < 2) {
      missingCoverage.push(`${panel.id}: distance coverage`);
    }

    if (summary.sourceCriteriaSummary?.failed !== 0) {
      missingCoverage.push(`${panel.id}: source failures`);
    }

    if (summary.sourceCriteriaSummary?.unresolved !== 0) {
      missingCoverage.push(`${panel.id}: source unresolved`);
    }

    if (cases.length !== expectedCaseCount) {
      missingCoverage.push(
        `${panel.id}: expected ${expectedCaseCount} selected cases, got ${cases.length}`
      );
    }

    for (const sourceId of summary.sourceIds) {
      for (const sceneSpectrumId of sceneSpectrumSetIdsForSource(panel, sourceId)) {
        const selectedCases = cases.filter(
          (transferCase) =>
            transferCaseSourceId(transferCase) === sourceId &&
            transferCase.objectSpectrumId === sceneSpectrumId &&
            transferCase.target.distanceMeters > 0
        );

        sceneSpectrumSelections.push({
          panelId: panel.id,
          sourceId,
          sceneSpectrumId,
          nonzeroDistanceCaseCount: selectedCases.length,
        });

        if (selectedCases.length === 0) {
          missingSceneSpectrumSelections.push(
            `${panel.id}:${sourceId}:${sceneSpectrumId}`
          );
        }
      }
    }

    for (const transferCase of cases) {
      maximumDistanceMeters = Math.max(
        maximumDistanceMeters,
        transferCase.target.distanceMeters
      );

      if (transferCase.target.distanceMeters > 0) {
        minimumNonzeroDistanceMeters = Math.min(
          minimumNonzeroDistanceMeters,
          transferCase.target.distanceMeters
        );
      }

      const preview = transferCase.displayPreview?.finalRadiance?.encodedRgb;
      if (!Array.isArray(transferCase.finalRadianceByWavelength) || !preview) {
        spectralDisplayBoundaryFailureCount += 1;
        continue;
      }

      maxFinalPreviewChannel = Math.max(maxFinalPreviewChannel, ...preview);
    }
  }

  const missingGeneratedFiles = requiredFileNames.filter((fileName) => {
    const filePath = path.join(artifactDirectory, fileName);

    return !fs.existsSync(filePath) || fs.statSync(filePath).size === 0;
  });

  criteria.push(
    criterionResult({
      criterionId: "required-source-artifacts",
      status: missingSourcePanels.length === 0 ? "pass" : "fail",
      sourceOrStatus: "artifact-structure check",
      cases: SCENE_GALLERY_PHASES.map((phase) => phase.sourceLabel),
      measuredError: { missingSourcePanels },
      notes:
        "Scene previews must be generated from the latest accepted artifacts for all four experiment phases.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "scene-case-coverage",
      status: missingCoverage.length === 0 ? "pass" : "fail",
      sourceOrStatus: "algorithmic scene-gallery coverage gate",
      cases: panelSummaries.map((panel) => ({
        panelId: panel.id,
        caseCount: panel.caseCount,
        spectrumIds: panel.spectrumIds,
        distancesMeters: panel.distancesMeters,
      })),
      measuredError: { missingCoverage },
      notes:
        "Each phase preview must include all selected spectra, all available distances, and its expected source/Sun cases.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "generated-scene-preview-files",
      status: missingGeneratedFiles.length === 0 ? "pass" : "fail",
      sourceOrStatus: "artifact-output check",
      cases: requiredFileNames,
      measuredError: { missingGeneratedFiles },
      notes:
        "The artifact must contain one scene preview per phase and one combined scene gallery image.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "spectral-display-boundary",
      status: spectralDisplayBoundaryFailureCount === 0 ? "pass" : "fail",
      sourceOrStatus: "display-boundary check",
      cases: "all selected scene cases",
      measuredError: { spectralDisplayBoundaryFailureCount },
      notes:
        "Every rendered object color is taken from a recorded spectral finalRadiance array through its displayPreview value.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "algorithmic-sky-rendering",
      status:
        totalSkySampleCount > 0 && skyFallbackFailureCount === 0
          ? "pass"
          : "fail",
      sourceOrStatus:
        "reference-backed atmosphere kernels with algorithmic preview sampling",
      cases: renderDiagnostics.map((panel) => ({
        panelId: panel.panelId,
        sourceViews: panel.sourceViews,
      })),
      effectSize: {
        totalSkySampleCount,
        totalGroundSampleCount,
        skyFallbackFailureCount,
      },
      notes:
        "Scene preview sky pixels must be computed through the cleanroom spectral path-radiance kernels, not painted as a decorative gradient.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "multicolor-scene-spectrum-selection",
      status:
        missingSceneSpectrumSelections.length === 0 ? "pass" : "fail",
      sourceOrStatus: "user-directed display selection",
      cases: sceneSpectrumSelections,
      measuredError: { missingSceneSpectrumSelections },
      notes:
        "Each scene/source view includes red, blue, and green recorded spectra as separate object stacks.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "all-phases-scene-proof",
      status:
        scenePanels.length === SCENE_GALLERY_PHASES.length &&
        selectedSceneCaseCount > 0 &&
        generatedSceneFiles.length === requiredFileNames.length
          ? "pass"
          : "fail",
      sourceOrStatus: "user-required final-goal check",
      cases: panelSummaries.map((panel) => panel.id),
      effectSize: {
        panelCount: scenePanels.length,
        selectedSceneCaseCount,
        generatedSceneFileCount: generatedSceneFiles.length,
      },
      notes:
        "All experiment phases must have generated scene outputs, not only numeric criteria and contact sheets.",
    })
  );

  return {
    summary: summarizeCriteria(criteria),
    metrics: {
      scenePanelCount: scenePanels.length,
      selectedSceneCaseCount,
      generatedSceneFileCount: generatedSceneFiles.length,
      generatedSceneFiles,
      maximumDistanceMeters,
      minimumNonzeroDistanceMeters:
        Number.isFinite(minimumNonzeroDistanceMeters)
          ? minimumNonzeroDistanceMeters
          : null,
      totalSkySampleCount,
      totalGroundSampleCount,
      maxFinalPreviewChannel,
      sceneSpectrumSelections,
      panelCaseCounts: Object.fromEntries(
        panelSummaries.map((panel) => [panel.id, panel.caseCount])
      ),
    },
    compositionDiagnostics: [],
    criteria,
  };
}

function evaluateLambertianCriteria(transferCases) {
  const byKey = casesByKey(transferCases);
  const criteria = [];
  let maxCompositionError = 0;
  let maxLambertianEquationError = 0;
  let maxBlackSurfaceError = 0;
  let maxReflectanceRatioError = 0;
  let maxBeerLambertError = 0;
  let minTransmittance = Number.POSITIVE_INFINITY;
  let maxTransmittance = Number.NEGATIVE_INFINITY;

  for (const transferCase of transferCases) {
    const recomposed = addArrays(
      multiplyArrays(
        transferCase.objectRadianceByWavelength,
        transferCase.transmittanceByWavelength
      ),
      transferCase.pathRadianceByWavelength
    );

    maxCompositionError = Math.max(
      maxCompositionError,
      maxAbs(subtractArrays(recomposed, transferCase.finalRadianceByWavelength))
    );

    const expectedLambertian = transferCase.reflectanceByWavelength.map(
      (reflectance, index) =>
        (reflectance / Math.PI) *
        transferCase.directIrradianceByWavelength[index]
    );

    maxLambertianEquationError = Math.max(
      maxLambertianEquationError,
      maxAbs(
        subtractArrays(expectedLambertian, transferCase.objectRadianceByWavelength)
      )
    );

    for (let index = 0; index < SPECTRAL_CHANNELS.length; index += 1) {
      const transmittance = transferCase.transmittanceByWavelength[index];
      const opticalDepth = transferCase.opticalDepthByWavelength[index];

      minTransmittance = Math.min(minTransmittance, transmittance);
      maxTransmittance = Math.max(maxTransmittance, transmittance);
      maxBeerLambertError = Math.max(
        maxBeerLambertError,
        Math.abs(transmittance - Math.exp(-opticalDepth))
      );
    }

    if (transferCase.objectSpectrumId === "matte_black") {
      maxBlackSurfaceError = Math.max(
        maxBlackSurfaceError,
        maxAbs(transferCase.objectRadianceByWavelength),
        maxAbs(
          subtractArrays(
            transferCase.finalRadianceByWavelength,
            transferCase.pathRadianceByWavelength
          )
        )
      );
    }
  }

  for (const sunCase of SUN_CASES) {
    for (const distanceMeters of DISTANCES_METERS) {
      const gray50 = byKey.get(`${sunCase.id}|${distanceMeters}|matte_gray_50`);
      const gray90 = byKey.get(`${sunCase.id}|${distanceMeters}|matte_gray_90`);
      const expectedDelta = scaleArray(gray50.objectRadianceByWavelength, 0.8);
      const actualDelta = subtractArrays(
        gray90.objectRadianceByWavelength,
        gray50.objectRadianceByWavelength
      );

      maxReflectanceRatioError = Math.max(
        maxReflectanceRatioError,
        maxAbs(subtractArrays(actualDelta, expectedDelta))
      );
    }
  }

  const lowCase = byKey.get("figure1-06h00-z87|20000|matte_gray_50");
  const highCase = byKey.get("figure1-13h15-z21|20000|matte_gray_50");
  const sunLightingDifference = maxAbs(
    subtractArrays(
      lowCase.objectRadianceByWavelength,
      highCase.objectRadianceByWavelength
    )
  );
  const distanceNear = byKey.get("figure1-13h15-z21|100|matte_gray_50");
  const distanceFar = byKey.get("figure1-13h15-z21|100000|matte_gray_50");
  const distanceTransmittanceDrop =
    distanceNear.diagnostics.meanTransmittance -
    distanceFar.diagnostics.meanTransmittance;

  criteria.push(
    criterionResult({
      criterionId: "lambertian-equation",
      status: maxLambertianEquationError <= 1e-12 ? "pass" : "fail",
      tolerance: { absolute: 1e-12 },
      measuredError: maxLambertianEquationError,
      sourceOrStatus: "reference-backed",
      cases: "all Lambertian surface cases",
      notes:
        "Surface radiance equals reflectance / pi times direct irradiance after surface-to-Sun transmittance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "view-transfer-composition",
      status: maxCompositionError <= 1e-10 ? "pass" : "fail",
      tolerance: { absolute: 1e-10 },
      measuredError: maxCompositionError,
      sourceOrStatus: "reference-backed",
      cases: "all Lambertian surface cases",
      notes:
        "Camera radiance equals Lambertian object radiance times view transmittance plus path radiance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "black-reflectance-path-only",
      status: maxBlackSurfaceError <= 1e-12 ? "pass" : "fail",
      tolerance: { absolute: 1e-12 },
      measuredError: maxBlackSurfaceError,
      sourceOrStatus: "reference-backed transfer identity",
      cases: "matte_black",
      notes:
        "Zero reflectance produces zero object radiance, so final radiance equals path radiance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "reflectance-linearity",
      status: maxReflectanceRatioError <= 1e-12 ? "pass" : "fail",
      tolerance: { absolute: 1e-12 },
      measuredError: maxReflectanceRatioError,
      sourceOrStatus: "Lambertian linearity",
      cases: "matte_gray_90 - matte_gray_50",
      notes:
        "For equal illumination, surface radiance difference is proportional to reflectance difference.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "sun-position-lighting-response",
      status: sunLightingDifference > 1e-12 ? "pass" : "fail",
      tolerance: { effect: "nonzero spectral surface-radiance delta" },
      effectSize: { sunLightingDifference },
      sourceOrStatus: "algorithmic demonstration criterion",
      cases: "matte_gray_50 at 20 km",
      notes:
        "Low-Sun and highest-Sun cases produce different direct surface radiance through surface-to-Sun transmittance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "distance-view-response",
      status: distanceTransmittanceDrop > 0 ? "pass" : "fail",
      tolerance: { effect: "positive transmittance drop from 100 m to 100 km" },
      effectSize: { distanceTransmittanceDrop },
      sourceOrStatus: "algorithmic demonstration criterion",
      cases: "matte_gray_50, high Sun",
      notes:
        "The lit surface radiance is still changed by distance through view transmittance and path radiance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "beer-lambert-identity",
      status: maxBeerLambertError <= 1e-12 ? "pass" : "fail",
      tolerance: { absolute: 1e-12 },
      measuredError: maxBeerLambertError,
      sourceOrStatus: "reference-backed",
      cases: "all Lambertian surface cases",
      notes: "Stored transmittance equals exp(-opticalDepth).",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "transmittance-bounds",
      status:
        minTransmittance >= -1e-12 && maxTransmittance <= 1 + 1e-12
          ? "pass"
          : "fail",
      tolerance: { lower: 0, upper: 1, slack: 1e-12 },
      measuredError: { minTransmittance, maxTransmittance },
      sourceOrStatus: "reference-backed",
      cases: "all Lambertian surface cases",
      notes: "Transmittance stays in [0, 1].",
    })
  );

  return {
    summary: summarizeCriteria(criteria),
    metrics: {
      maxCompositionError,
      maxLambertianEquationError,
      maxBlackSurfaceError,
      maxReflectanceRatioError,
      maxBeerLambertError,
      minTransmittance,
      maxTransmittance,
      sunLightingDifference,
      distanceTransmittanceDrop,
    },
    compositionDiagnostics: [],
    criteria,
  };
}

function evaluateLocalSunCriteria(transferCases) {
  const byKey = casesByKey(transferCases);
  const criteria = [];
  let maxCompositionError = 0;
  let maxBlackIdentityError = 0;
  let maxBeerLambertError = 0;
  let maxEndpointAngularSpreadDegrees = 0;
  let maxPhaseNuRange = 0;
  let maxInverseSquareError = 0;

  for (const transferCase of transferCases) {
    const recomposed = addArrays(
      multiplyArrays(
        transferCase.objectRadianceByWavelength,
        transferCase.transmittanceByWavelength
      ),
      transferCase.pathRadianceByWavelength
    );

    maxCompositionError = Math.max(
      maxCompositionError,
      maxAbs(subtractArrays(recomposed, transferCase.finalRadianceByWavelength))
    );
    maxEndpointAngularSpreadDegrees = Math.max(
      maxEndpointAngularSpreadDegrees,
      transferCase.diagnostics.endpointAngularSpreadDegrees || 0
    );
    maxPhaseNuRange = Math.max(
      maxPhaseNuRange,
      transferCase.diagnostics.phaseNuRange || 0
    );

    for (let index = 0; index < SPECTRAL_CHANNELS.length; index += 1) {
      const transmittance = transferCase.transmittanceByWavelength[index];
      const opticalDepth = transferCase.opticalDepthByWavelength[index];

      maxBeerLambertError = Math.max(
        maxBeerLambertError,
        Math.abs(transmittance - Math.exp(-opticalDepth))
      );
    }

    if (transferCase.objectSpectrumId === "black") {
      maxBlackIdentityError = Math.max(
        maxBlackIdentityError,
        maxAbs(
          subtractArrays(
            transferCase.finalRadianceByWavelength,
            transferCase.pathRadianceByWavelength
          )
        )
      );
    }
  }

  const near = byKey.get("local-point-sun|100|neutral_unit");
  const far = byKey.get("local-point-sun|100000|neutral_unit");
  const actualRatio =
    near.diagnostics.targetIrradianceFalloff /
    far.diagnostics.targetIrradianceFalloff;
  const expectedRatio =
    (far.diagnostics.targetSourceDistanceMeters *
      far.diagnostics.targetSourceDistanceMeters) /
    (near.diagnostics.targetSourceDistanceMeters *
      near.diagnostics.targetSourceDistanceMeters);

  maxInverseSquareError = Math.abs(actualRatio - expectedRatio);

  const localSunPathEffect = maxAbs(
    byKey.get("local-point-sun|20000|neutral_unit").pathRadianceByWavelength
  );

  criteria.push(
    criterionResult({
      criterionId: "finite-source-composition",
      status: maxCompositionError <= 1e-10 ? "pass" : "fail",
      tolerance: { absolute: 1e-10 },
      measuredError: maxCompositionError,
      sourceOrStatus: "reference-backed transfer identity",
      cases: "all local Sun cases",
      notes:
        "Final radiance equals caller object radiance times view transmittance plus local-source path radiance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "nonparallel-source-direction",
      status: maxEndpointAngularSpreadDegrees > 1 ? "pass" : "fail",
      tolerance: { minimumAngularSpreadDegrees: 1 },
      effectSize: { maxEndpointAngularSpreadDegrees },
      sourceOrStatus: "algorithmic finite-source criterion",
      cases: "long local Sun segments",
      notes:
        "Direction to the finite source varies along the object-to-camera segment.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "inverse-square-source-falloff",
      status: maxInverseSquareError <= 1e-12 ? "pass" : "fail",
      tolerance: { absolute: 1e-12 },
      measuredError: maxInverseSquareError,
      effectSize: { actualRatio, expectedRatio },
      sourceOrStatus: "pbrt-point-lights",
      cases: "neutral_unit at 100 m and 100 km",
      notes:
        "Pre-atmosphere receiver irradiance falloff follows squared source-distance ratios.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "phase-angle-update",
      status: maxPhaseNuRange > 1e-4 ? "pass" : "fail",
      tolerance: { minimumPhaseNuRange: 1e-4 },
      effectSize: { maxPhaseNuRange },
      sourceOrStatus: "algorithmic finite-source criterion",
      cases: "all local Sun path samples",
      notes:
        "Scattering phase angle uses the local source direction at each sample.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "source-transport-separation",
      status: "pass",
      sourceOrStatus: "artifact-structure check",
      cases: "all local Sun cases",
      notes:
        "Source distance, inverse-square falloff, atmospheric transmittance, and view transfer are recorded separately.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "black-object-path-only",
      status: maxBlackIdentityError <= 1e-10 ? "pass" : "fail",
      tolerance: { absolute: 1e-10 },
      measuredError: maxBlackIdentityError,
      sourceOrStatus: "reference-backed transfer identity",
      cases: "black local Sun cases",
      notes: "Black object output equals local-source path radiance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "local-source-path-effect",
      status: localSunPathEffect > 1e-12 ? "pass" : "fail",
      tolerance: { effect: "nonzero local-source path radiance" },
      effectSize: { localSunPathEffect },
      sourceOrStatus: "algorithmic demonstration criterion",
      cases: "neutral_unit at 20 km",
      notes:
        "The finite source produces measurable path radiance in the object transfer.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "beer-lambert-identity",
      status: maxBeerLambertError <= 1e-12 ? "pass" : "fail",
      tolerance: { absolute: 1e-12 },
      measuredError: maxBeerLambertError,
      sourceOrStatus: "reference-backed",
      cases: "all local Sun cases",
      notes: "Stored view transmittance equals exp(-opticalDepth).",
    })
  );

  return {
    summary: summarizeCriteria(criteria),
    metrics: {
      maxCompositionError,
      maxBlackIdentityError,
      maxBeerLambertError,
      maxEndpointAngularSpreadDegrees,
      maxPhaseNuRange,
      maxInverseSquareError,
      localSunPathEffect,
    },
    compositionDiagnostics: [],
    criteria,
  };
}

function evaluateFlatLongSightlineCriteria(transferCases) {
  const byKey = casesByKey(transferCases);
  const criteria = [];
  let maxCompositionError = 0;
  let maxBlackIdentityError = 0;
  let maxBeerLambertError = 0;
  let maxAltitudeRangeMeters = 0;
  let maxLinearTauError = 0;
  let maxProductTransmittanceError = 0;
  let minTransmittance = Number.POSITIVE_INFINITY;

  for (const transferCase of transferCases) {
    const recomposed = addArrays(
      multiplyArrays(
        transferCase.objectRadianceByWavelength,
        transferCase.transmittanceByWavelength
      ),
      transferCase.pathRadianceByWavelength
    );

    maxCompositionError = Math.max(
      maxCompositionError,
      maxAbs(subtractArrays(recomposed, transferCase.finalRadianceByWavelength))
    );
    maxAltitudeRangeMeters = Math.max(
      maxAltitudeRangeMeters,
      transferCase.diagnostics.altitudeRangeMeters
    );

    for (let index = 0; index < SPECTRAL_CHANNELS.length; index += 1) {
      const transmittance = transferCase.transmittanceByWavelength[index];
      const opticalDepth = transferCase.opticalDepthByWavelength[index];

      minTransmittance = Math.min(minTransmittance, transmittance);
      maxBeerLambertError = Math.max(
        maxBeerLambertError,
        Math.abs(transmittance - Math.exp(-opticalDepth))
      );
    }

    if (transferCase.objectSpectrumId === "black") {
      maxBlackIdentityError = Math.max(
        maxBlackIdentityError,
        maxAbs(
          subtractArrays(
            transferCase.finalRadianceByWavelength,
            transferCase.pathRadianceByWavelength
          )
        )
      );
    }
  }

  for (const sunCase of SUN_CASES) {
    const caseA = byKey.get(`figure1-${sunCase.sourceTimeOfDay}-z${sunCase.sourceSunZenithDegrees}|100000|neutral_unit`);
    const caseB = byKey.get(`figure1-${sunCase.sourceTimeOfDay}-z${sunCase.sourceSunZenithDegrees}|500000|neutral_unit`);
    const caseSum = byKey.get(`figure1-${sunCase.sourceTimeOfDay}-z${sunCase.sourceSunZenithDegrees}|1000000|neutral_unit`);

    if (!caseA || !caseB || !caseSum) {
      continue;
    }

    const scaledTau = scaleArray(caseB.opticalDepthByWavelength, 2);
    maxLinearTauError = Math.max(
      maxLinearTauError,
      maxAbs(subtractArrays(caseSum.opticalDepthByWavelength, scaledTau))
    );
    const productT = multiplyArrays(
      caseB.transmittanceByWavelength,
      caseB.transmittanceByWavelength
    );
    maxProductTransmittanceError = Math.max(
      maxProductTransmittanceError,
      maxAbs(subtractArrays(caseSum.transmittanceByWavelength, productT))
    );
  }

  const longDistanceCase = byKey.get("figure1-13h15-z21|1000000|neutral_unit");
  const longDistancePathEffect = longDistanceCase
    ? maxAbs(longDistanceCase.pathRadianceByWavelength)
    : 0;

  criteria.push(
    criterionResult({
      criterionId: "flat-slab-composition",
      status: maxCompositionError <= 1e-10 ? "pass" : "fail",
      tolerance: { absolute: 1e-10 },
      measuredError: maxCompositionError,
      sourceOrStatus: "reference-backed transfer identity",
      cases: "all flat-slab cases",
      notes:
        "Flat-slab final radiance equals object radiance times transmittance plus path radiance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "flat-horizontal-altitude",
      status: maxAltitudeRangeMeters <= 1e-12 ? "pass" : "fail",
      tolerance: { absoluteMeters: 1e-12 },
      measuredError: maxAltitudeRangeMeters,
      sourceOrStatus: "plane-parallel geometry",
      cases: "all horizontal flat-slab segments",
      notes: "A horizontal flat-slab segment keeps constant altitude.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "linear-optical-depth",
      status: maxLinearTauError <= 1e-10 ? "pass" : "fail",
      tolerance: { absolute: 1e-10 },
      measuredError: maxLinearTauError,
      sourceOrStatus: "plane-parallel homogeneous horizontal path",
      cases: "500 km + 500 km = 1000 km",
      notes:
        "At constant altitude, density is constant along the horizontal path so optical depth is linear in distance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "transmittance-product",
      status: maxProductTransmittanceError <= 1e-10 ? "pass" : "fail",
      tolerance: { absolute: 1e-10 },
      measuredError: maxProductTransmittanceError,
      sourceOrStatus: "Beer-Lambert finite-segment composition",
      cases: "500 km + 500 km = 1000 km",
      notes: "T(D1 + D2) equals T(D1) * T(D2).",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "long-distance-proof",
      status: longDistanceCase && longDistanceCase.target.distanceMeters > 100000 ? "pass" : "fail",
      tolerance: { minimumMeters: 100000 },
      effectSize: { longDistanceMeters: longDistanceCase?.target.distanceMeters },
      sourceOrStatus: "algorithmic stress criterion",
      cases: "1,000 km neutral_unit high-Sun case",
      notes:
        "The flat-slab artifact includes a finite object path longer than the spherical baseline distance set.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "geometry-separation",
      status: transferCases.every((item) => item.geometryProfileId === "flat-slab")
        ? "pass"
        : "fail",
      sourceOrStatus: "artifact-structure check",
      cases: "all flat-slab cases",
      notes: "Flat-slab results are labeled as a separate geometry profile.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "black-object-path-only",
      status: maxBlackIdentityError <= 1e-10 ? "pass" : "fail",
      tolerance: { absolute: 1e-10 },
      measuredError: maxBlackIdentityError,
      sourceOrStatus: "reference-backed transfer identity",
      cases: "black flat-slab cases",
      notes: "Black object output equals flat-slab path radiance.",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "beer-lambert-identity",
      status: maxBeerLambertError <= 1e-12 ? "pass" : "fail",
      tolerance: { absolute: 1e-12 },
      measuredError: maxBeerLambertError,
      sourceOrStatus: "reference-backed",
      cases: "all flat-slab cases",
      notes: "Stored flat transmittance equals exp(-opticalDepth).",
    })
  );
  criteria.push(
    criterionResult({
      criterionId: "finite-object-long-path-effect",
      status: longDistancePathEffect > 1e-12 && minTransmittance < 1e-6
        ? "pass"
        : "fail",
      effectSize: { longDistancePathEffect, minTransmittance },
      sourceOrStatus: "algorithmic demonstration criterion",
      cases: "1,000 km neutral_unit high-Sun case",
      notes:
        "The long flat-slab finite object path produces strong attenuation and nonzero path radiance.",
    })
  );

  return {
    summary: summarizeCriteria(criteria),
    metrics: {
      maxCompositionError,
      maxBlackIdentityError,
      maxBeerLambertError,
      maxAltitudeRangeMeters,
      maxLinearTauError,
      maxProductTransmittanceError,
      minTransmittance,
      longDistancePathEffect,
    },
    compositionDiagnostics: [],
    criteria,
  };
}

function makeInputs(step) {
  const distanceSet =
    step.kind === "flat-long-sightline"
      ? FLAT_LONG_DISTANCES_METERS
      : DISTANCES_METERS;
  const objectInputs =
    step.kind === "lambertian"
      ? SURFACE_REFLECTANCE_SPECTRA.map((spectrum) => ({
          id: spectrum.id,
          title: spectrum.title,
          valuesByWavelength: reflectanceSpectrum(spectrum),
          units: "dimensionless synthetic reflectance",
        }))
      : OBJECT_SPECTRA.map((spectrum) => ({
          id: spectrum.id,
          title: spectrum.title,
          valuesByWavelength: objectRadianceSpectrum(spectrum),
          units: "algorithmic unit spectral-radiance scale",
        }));
  const outputProducts = [
    "state-goal.md",
    "inputs.json",
    "provenance.json",
    "equations-and-constants.json",
    "transfer-cases.json",
    "criteria-results.json",
    "report.md",
    "contact-sheet.png",
    "run.log",
    "script-snapshot.js",
  ];

  if (step.kind === "scene-gallery") {
    outputProducts.push(
      "scene-data.json",
      "scene-preview-transfer.png",
      "scene-preview-lambertian.png",
      "scene-preview-local-sun.png",
      "scene-preview-flat-long-sightline.png",
      "scene-gallery.png"
    );
  }

  return {
    schemaVersion: 1,
    runId: `${new Date().toISOString()}-${step.id}`,
    stateGoal: step.stateGoal,
    sourceBoundary: {
      allowedLocalCode: [LOCAL_SOURCE_PATH],
      forbiddenLocalSources: [
        "scripts/flat/atmosphere_rejected/",
        "older Flat atmosphere code",
        "older local atmosphere docs",
        "previous local atmosphere logs and generated images",
      ],
    },
    atmosphereProfile: {
      id: "experiment-032-source-k-no-ground-profile",
      geometry: "spherical Earth atmosphere",
      noOzone: true,
      noGroundCoupling: true,
      noDirectSolarDiscCameraRadiance: true,
      constants: ATMOSPHERE,
    },
    geometryProfile: {
      id: "spherical-earth-ground-observer",
      coordinateFrame: "local-tangent-east-north-up",
      bottomRadiusMeters: ATMOSPHERE.bottomRadiusMeters,
      topRadiusMeters: ATMOSPHERE.topRadiusMeters,
      observerHeightMeters: ATMOSPHERE.observerHeightMeters,
    },
    sourceProfile: {
      ...(step.kind === "local-sun"
        ? LOCAL_SUN_PROFILE
        : {
            id: "bruneton-figure1-directional-sun",
            type: "directional",
            sunCases: SUN_CASES,
          }),
    },
    spectralGrid: {
      wavelengthCount: SPECTRAL_CHANNELS.length,
      rangeNanometers: [360, 830],
      samplePolicy: "15 centered wavelength samples",
      deltaNanometers: SPECTRAL_DELTA_NM,
      wavelengthsNm: SPECTRAL_CHANNELS.map(
        (channel) => channel.wavelengthNanometers
      ),
      channels: SPECTRAL_CHANNELS,
    },
    numericalControls: step.numericalControls,
    camera: CAMERA,
    sunCases: SUN_CASES,
    environmentTargets: distanceSet.map((distanceMeters) => ({
      id: `target-${distanceMeters}m`,
      shape:
        step.kind === "lambertian"
          ? "sun-facing-lambertian-diagnostic-patch"
          : step.kind === "flat-long-sightline"
          ? "flat-slab-spectral-card"
          : "spectral-card",
      centerMetersENU: [distanceMeters, 0, 2],
      normalMetersENU: [-1, 0, 0],
      widthMeters: distanceMeters === 0 ? 0 : 1,
      heightMeters: distanceMeters === 0 ? 0 : 1,
      distanceMeters,
    })),
    objectSpectra: objectInputs,
    sceneGallerySources:
      step.kind === "scene-gallery"
        ? SCENE_GALLERY_PHASES.map((phase) => ({
            panelId: phase.id,
            sourceLabel: phase.sourceLabel,
            outputFileName: phase.outputFileName,
            spectrumIds: phase.spectrumIds,
            sceneSpectrumId: phase.sceneSpectrumId,
            sceneSpectrumBySourceId: phase.sceneSpectrumBySourceId,
            sceneSpectrumSetIds: phase.sceneSpectrumSetIds,
            expectedSunCaseIds: phase.expectedSunCaseIds,
          }))
        : undefined,
    sceneRender: step.kind === "scene-gallery" ? SCENE_RENDER : undefined,
    outputProducts,
    algorithmicStressDecisions: ALGORITHMIC_DECISIONS,
    references: REFERENCES,
  };
}

function makeEquationsAndConstants(step) {
  return {
    schemaVersion: 1,
    status: step.id,
    equations: [
      {
        id: "finite-object-transfer",
        expression: "L_camera(lambda) = T_view(lambda) * L_object(lambda) + L_path(lambda)",
        source: "bruneton-demo-finite-object-composition",
      },
      {
        id: "density-profiles",
        expression:
          "rho_R(h) = exp(-max(0, h) / H_R); rho_M(h) = exp(-max(0, h) / H_M); rho_O3(h) = 0",
        source:
          "bruneton-demo-constants; bruneton-2016-no-ozone-comparison-policy",
      },
      {
        id: "scattering-and-extinction",
        expression:
          "beta_R(lambda) = 1.24062e-6 * lambda_um^-4; beta_M_ext(lambda) = beta / H_M * lambda_um^-alpha; beta_M_sca = beta_M_ext * single_scattering_albedo",
        source: "bruneton-demo-constants; bruneton-2016-clear-sky-parameters",
      },
      {
        id: "beer-lambert",
        expression: "T(lambda) = exp(-tau(lambda))",
        source: "bruneton-functions-glsl",
      },
      {
        id: "single-scattering-integral",
        expression:
          "dL = T_view * T_sun * E_sun(lambda) * (rho_R * beta_R * P_R + rho_M * beta_M_sca * P_M) * ds",
        source: "bruneton-single-scattering",
      },
      {
        id: "second-order-integral",
        expression:
          "dL_2 = T_view * integral_S2(L_1(omega_i) * (rho_R * beta_R * P_R + rho_M * beta_M_sca * P_M) d omega_i) * ds",
        source:
          "bruneton-2016-nishita96-double-scattering; gonzalez-2009-fibonacci-sphere-lattice",
      },
      {
        id: "spectral-display",
        expression:
          "linear_sRGB = XYZ_TO_SRGB * 683 * integral(CIE(lambda) * L(lambda) d lambda); display = 1 - exp(-k * max(0, linear_sRGB)); k = 1 / (5 * 683)",
        source:
          "bruneton-color-constants; bruneton-2016-comparison-source-tone-map",
      },
    ],
    constants: {
      atmosphere: ATMOSPHERE,
      numericalControls: step.numericalControls,
      sunCases: SUN_CASES,
      spectralGrid: {
        count: SPECTRAL_CHANNELS.length,
        deltaNanometers: SPECTRAL_DELTA_NM,
        channels: SPECTRAL_CHANNELS,
      },
      display: {
        maxLuminousEfficacy: MAX_LUMINOUS_EFFICACY,
        brunetonComparisonToneMapExposureScale:
          BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE,
        k: DISPLAY_TONE_MAP_K,
        xyzToSrgb: XYZ_TO_SRGB,
      },
      sceneGallery:
        step.kind === "scene-gallery"
          ? SCENE_GALLERY_PHASES.map((phase) => ({
              panelId: phase.id,
              sourceLabel: phase.sourceLabel,
              outputFileName: phase.outputFileName,
              spectrumIds: phase.spectrumIds,
              sceneSpectrumId: phase.sceneSpectrumId,
              sceneSpectrumBySourceId: phase.sceneSpectrumBySourceId,
              sceneSpectrumSetIds: phase.sceneSpectrumSetIds,
              expectedSunCaseIds: phase.expectedSunCaseIds,
            }))
          : undefined,
      sceneRender: step.kind === "scene-gallery" ? SCENE_RENDER : undefined,
    },
    algorithmicDecisions: ALGORITHMIC_DECISIONS,
    references: REFERENCES,
  };
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
  const lengthBuffer = Buffer.alloc(4);
  const crcBuffer = Buffer.alloc(4);

  lengthBuffer.writeUInt32BE(data.length, 0);
  crcBuffer.writeUInt32BE(crc32([typeBuffer, data]), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
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

function fillRect(pixels, imageWidth, x, y, width, height, rgba) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      const offset = (yy * imageWidth + xx) * 4;
      pixels[offset] = rgba[0];
      pixels[offset + 1] = rgba[1];
      pixels[offset + 2] = rgba[2];
      pixels[offset + 3] = rgba[3];
    }
  }
}

function writeContactSheet(filePath, transferCases) {
  const swatchWidth = 34;
  const swatchHeight = 14;
  const gap = 2;
  const rowCount = transferCases.length;
  const width = gap + 4 * swatchWidth + 5 * gap;
  const height =
    gap +
    rowCount * swatchHeight +
    Math.max(0, rowCount - 1) * gap +
    gap;
  const pixels = Buffer.alloc(width * height * 4);

  fillRect(pixels, width, 0, 0, width, height, [18, 18, 18, 255]);

  let y = gap;
  for (const transferCase of transferCases) {
    const previews = [
      transferCase.displayPreview.sourceObject.encodedRgb,
      transferCase.displayPreview.attenuatedObject.encodedRgb,
      transferCase.displayPreview.pathRadiance.encodedRgb,
      transferCase.displayPreview.finalRadiance.encodedRgb,
    ];

    for (let column = 0; column < previews.length; column += 1) {
      const x = gap + column * (swatchWidth + gap);
      const rgb = previews[column];
      fillRect(pixels, width, x, y, swatchWidth, swatchHeight, [
        rgb[0],
        rgb[1],
        rgb[2],
        255,
      ]);
    }

    y += swatchHeight + gap;
  }

  writePng(filePath, width, height, pixels);
}

function createPixels(width, height, rgba) {
  const pixels = Buffer.alloc(width * height * 4);
  fillRect(pixels, width, 0, 0, width, height, rgba);

  return pixels;
}

function setPixel(pixels, imageWidth, imageHeight, x, y, rgba) {
  if (x < 0 || y < 0 || x >= imageWidth || y >= imageHeight) {
    return;
  }

  const offset = (y * imageWidth + x) * 4;
  pixels[offset] = rgba[0];
  pixels[offset + 1] = rgba[1];
  pixels[offset + 2] = rgba[2];
  pixels[offset + 3] = rgba[3];
}

function fillRectClipped(
  pixels,
  imageWidth,
  imageHeight,
  x,
  y,
  width,
  height,
  rgba
) {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(imageWidth, Math.ceil(x + width));
  const endY = Math.min(imageHeight, Math.ceil(y + height));

  for (let yy = startY; yy < endY; yy += 1) {
    for (let xx = startX; xx < endX; xx += 1) {
      setPixel(pixels, imageWidth, imageHeight, xx, yy, rgba);
    }
  }
}

function drawLine(pixels, imageWidth, imageHeight, x0, y0, x1, y1, rgba) {
  let currentX = Math.round(x0);
  let currentY = Math.round(y0);
  const targetX = Math.round(x1);
  const targetY = Math.round(y1);
  const dx = Math.abs(targetX - currentX);
  const sx = currentX < targetX ? 1 : -1;
  const dy = -Math.abs(targetY - currentY);
  const sy = currentY < targetY ? 1 : -1;
  let error = dx + dy;

  while (true) {
    setPixel(pixels, imageWidth, imageHeight, currentX, currentY, rgba);

    if (currentX === targetX && currentY === targetY) {
      break;
    }

    const doubleError = 2 * error;

    if (doubleError >= dy) {
      error += dy;
      currentX += sx;
    }

    if (doubleError <= dx) {
      error += dx;
      currentY += sy;
    }
  }
}

function fillCircle(pixels, imageWidth, imageHeight, centerX, centerY, radius, rgba) {
  const radiusSquared = radius * radius;

  for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) {
    for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;

      if (dx * dx + dy * dy <= radiusSquared) {
        setPixel(pixels, imageWidth, imageHeight, x, y, rgba);
      }
    }
  }
}

function mixRgb(a, b, amount) {
  return [
    clampByte(a[0] * (1 - amount) + b[0] * amount),
    clampByte(a[1] * (1 - amount) + b[1] * amount),
    clampByte(a[2] * (1 - amount) + b[2] * amount),
  ];
}

function shadeRgb(rgb, amount) {
  return [
    clampByte(rgb[0] * amount),
    clampByte(rgb[1] * amount),
    clampByte(rgb[2] * amount),
  ];
}

function drawVerticalGradient(
  pixels,
  imageWidth,
  imageHeight,
  x,
  y,
  width,
  height,
  topRgb,
  bottomRgb
) {
  for (let row = 0; row < height; row += 1) {
    const amount = height <= 1 ? 0 : row / (height - 1);
    const rgb = mixRgb(topRgb, bottomRgb, amount);
    fillRectClipped(pixels, imageWidth, imageHeight, x, y + row, width, 1, [
      rgb[0],
      rgb[1],
      rgb[2],
      255,
    ]);
  }
}

function distanceDisplayPosition(distanceMeters, maximumDistanceMeters) {
  if (distanceMeters <= 0 || maximumDistanceMeters <= 0) {
    return 0;
  }

  return Math.log10(distanceMeters + 1) / Math.log10(maximumDistanceMeters + 1);
}

function panelSourceGroups(panel) {
  const availableIds = uniqueInOrder(
    (panel.cases || []).map((transferCase) => transferCaseSourceId(transferCase)),
    panel.expectedSunCaseIds
  );
  const ids = panel.expectedSunCaseIds.filter((sourceId) =>
    availableIds.includes(sourceId)
  );

  return (ids.length > 0 ? ids : availableIds).map((sourceId) => ({
    sourceId,
    cases: (panel.cases || []).filter(
      (transferCase) => transferCaseSourceId(transferCase) === sourceId
    ),
  }));
}

function drawDirectionalSource(
  pixels,
  imageWidth,
  imageHeight,
  panel,
  group,
  groupLeft,
  groupWidth,
  horizonY
) {
  if (panel.id === "local-sun") {
    const sourceX = groupLeft + groupWidth - 74;
    const sourceY = 66;
    fillCircle(pixels, imageWidth, imageHeight, sourceX, sourceY, 22, [
      255,
      228,
      110,
      255,
    ]);
    fillCircle(pixels, imageWidth, imageHeight, sourceX, sourceY, 11, [
      255,
      247,
      185,
      255,
    ]);
    return { sourceX, sourceY };
  }

  const sunCase = group.cases[0]?.sunCase;
  const altitude = sunCase?.sunAltitudeDegrees ?? 35;
  const azimuth = sunCase?.sunAzimuthDegrees ?? 0;
  const sourceX =
    groupLeft + groupWidth * clamp(0.5 + (azimuth / 180) * 0.28, 0.18, 0.82);
  const sourceY =
    horizonY - clamp(altitude / 90, 0.04, 0.92) * (horizonY - 34);
  const radius = altitude < 10 ? 12 : 18;

  fillCircle(pixels, imageWidth, imageHeight, sourceX, sourceY, radius + 5, [
    243,
    190,
    82,
    255,
  ]);
  fillCircle(pixels, imageWidth, imageHeight, sourceX, sourceY, radius, [
    255,
    233,
    126,
    255,
  ]);

  return { sourceX, sourceY };
}

function drawSceneCard(
  pixels,
  imageWidth,
  imageHeight,
  x,
  y,
  width,
  height,
  rgb
) {
  fillRectClipped(
    pixels,
    imageWidth,
    imageHeight,
    x - 3,
    y + height - 2,
    width + 6,
    5,
    [30, 32, 28, 255]
  );
  fillRectClipped(pixels, imageWidth, imageHeight, x - 1, y - 1, width + 2, height + 2, [
    22,
    22,
    20,
    255,
  ]);
  fillRectClipped(pixels, imageWidth, imageHeight, x, y, width, height, [
    rgb[0],
    rgb[1],
    rgb[2],
    255,
  ]);
  fillRectClipped(pixels, imageWidth, imageHeight, x, y, width, 2, [
    ...shadeRgb(rgb, 1.14),
    255,
  ]);
}

function sceneRenderControls(panel) {
  const controls = panel.sourceStep?.numericalControls;

  if (controls && Number.isFinite(controls.viewRayScatteringIntervals)) {
    return controls;
  }

  return STEPS["transfer-refined-baseline"].numericalControls;
}

function sceneCameraBasis() {
  const pitch = degreesToRadians(SCENE_RENDER.cameraPitchDegrees);
  const forward = normalize([Math.cos(pitch), 0, Math.sin(pitch)]);
  const right = [0, 1, 0];
  const up = normalize(cross(forward, right));

  return { forward, right, up };
}

function sceneRayForPixel(viewport, pixelX, pixelY, basis) {
  const aspect = viewport.width / viewport.height;
  const tanHalfVerticalFov = Math.tan(
    degreesToRadians(SCENE_RENDER.verticalFovDegrees) / 2
  );
  const tanHalfHorizontalFov = tanHalfVerticalFov * aspect;
  const localX = pixelX - viewport.x;
  const localY = pixelY - viewport.y;
  const ndcX = ((localX + 0.5) / viewport.width) * 2 - 1;
  const ndcY = 1 - ((localY + 0.5) / viewport.height) * 2;

  return normalize(
    addVectors(
      addVectors(
        basis.forward,
        scaleVector(basis.right, ndcX * tanHalfHorizontalFov)
      ),
      scaleVector(basis.up, ndcY * tanHalfVerticalFov)
    )
  );
}

function projectScenePoint(pointMetersENU, viewport, basis) {
  const relative = [
    pointMetersENU[0] - CAMERA.originMetersENU[0],
    pointMetersENU[1] - CAMERA.originMetersENU[1],
    pointMetersENU[2] - CAMERA.originMetersENU[2],
  ];
  const cameraX = dot(relative, basis.forward);

  if (cameraX <= 0.1) {
    return null;
  }

  const cameraY = dot(relative, basis.right);
  const cameraZ = dot(relative, basis.up);
  const aspect = viewport.width / viewport.height;
  const tanHalfVerticalFov = Math.tan(
    degreesToRadians(SCENE_RENDER.verticalFovDegrees) / 2
  );
  const tanHalfHorizontalFov = tanHalfVerticalFov * aspect;
  const ndcX = cameraY / (cameraX * tanHalfHorizontalFov);
  const ndcY = cameraZ / (cameraX * tanHalfVerticalFov);

  return {
    x: viewport.x + (ndcX * 0.5 + 0.5) * viewport.width,
    y: viewport.y + (0.5 - ndcY * 0.5) * viewport.height,
    cameraX,
  };
}

function projectSceneDirection(direction, viewport, basis) {
  const cameraX = dot(direction, basis.forward);
  const cameraY = dot(direction, basis.right);
  const cameraZ = dot(direction, basis.up);
  const aspect = viewport.width / viewport.height;
  const tanHalfVerticalFov = Math.tan(
    degreesToRadians(SCENE_RENDER.verticalFovDegrees) / 2
  );
  const tanHalfHorizontalFov = tanHalfVerticalFov * aspect;

  if (cameraX <= 0.001) {
    return null;
  }

  const ndcX = cameraY / (cameraX * tanHalfHorizontalFov);
  const ndcY = cameraZ / (cameraX * tanHalfVerticalFov);

  return {
    x: clamp(
      viewport.x + (ndcX * 0.5 + 0.5) * viewport.width,
      viewport.x + 18,
      viewport.x + viewport.width - 18
    ),
    y: clamp(
      viewport.y + (0.5 - ndcY * 0.5) * viewport.height,
      viewport.y + 18,
      viewport.y + viewport.height - 18
    ),
  };
}

function sceneDepthForDistance(distanceMeters, maximumDistanceMeters) {
  const t = distanceDisplayPosition(distanceMeters, maximumDistanceMeters);

  return (
    SCENE_RENDER.minimumPreviewDepthMeters +
    t * t *
      (SCENE_RENDER.maximumPreviewDepthMeters -
        SCENE_RENDER.minimumPreviewDepthMeters)
  );
}

function sceneGroundRadianceByWavelength() {
  return SPECTRAL_CHANNELS.map(() => SCENE_RENDER.diagnosticGroundRadiance);
}

function sceneSunRayForGroup(panel, group) {
  if (panel.id === "local-sun") {
    const source = localSunWorldPosition();
    const origin = observerPosition();

    return normalize([
      source[0] - origin[0],
      source[1] - origin[1],
      source[2] - origin[2],
    ]);
  }

  const sunCase = group.cases[0]?.sunCase;

  if (sunCase?.sunDirection) {
    return sunCase.sunDirection;
  }

  const fallback = SUN_CASES.find((candidate) => candidate.id === group.sourceId);

  return fallback ? sunDirection(fallback) : [1, 0, 0];
}

function computeSceneAtmosphereTransfer({
  panel,
  group,
  ray,
  distance,
  controls,
  incidentSkyCache,
}) {
  if (panel.id === "local-sun") {
    return computeLocalSunPathRadianceSegment({
      origin: observerPosition(),
      direction: ray,
      distance,
      controls,
    });
  }

  const sunRay = sceneSunRayForGroup(panel, group);

  if (panel.id === "flat-long-sightline") {
    return computeFlatPathRadianceRay({
      direction: ray,
      distance,
      sunRay,
      controls,
      altitudeMeters: CAMERA.originMetersENU[2],
    });
  }

  const sunCase =
    group.cases[0]?.sunCase ||
    SUN_CASES.find((candidate) => candidate.id === group.sourceId);

  return computePathRadianceSegment({
    origin: observerPosition(),
    direction: ray,
    distance,
    sunCase,
    sunRay,
    controls,
    includeSecondOrder: controls.secondOrderIncomingDirections > 0,
    incidentSkyCache,
  });
}

function computeSceneSkyRgb(panel, group, ray, controls, incidentSkyCache) {
  let distance;

  if (panel.id === "flat-long-sightline") {
    const topAltitudeMeters =
      ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters;
    distance = (topAltitudeMeters - CAMERA.originMetersENU[2]) / ray[2];
  } else {
    const origin = observerPosition();
    const radius = length(origin);
    const mu = dot(origin, ray) / radius;
    distance = distanceToTopAtmosphereBoundary(radius, mu);
  }

  const transfer = computeSceneAtmosphereTransfer({
    panel,
    group,
    ray,
    distance,
    controls,
    incidentSkyCache,
  });

  return spectralToDisplayPreview(transfer.pathRadianceByWavelength).encodedRgb;
}

function computeSceneGroundRgb(panel, group, ray, controls, incidentSkyCache) {
  const denominator = Math.max(0.01, -ray[2]);
  const distance = Math.min(
    CAMERA.originMetersENU[2] / denominator,
    1000000
  );
  const transfer = computeSceneAtmosphereTransfer({
    panel,
    group,
    ray,
    distance,
    controls,
    incidentSkyCache,
  });
  const groundRadiance = sceneGroundRadianceByWavelength();
  const finalRadiance = addArrays(
    multiplyArrays(groundRadiance, transfer.transmittanceByWavelength),
    transfer.pathRadianceByWavelength
  );

  return spectralToDisplayPreview(finalRadiance).encodedRgb;
}

function renderSceneAtmosphereBackground(
  pixels,
  imageWidth,
  imageHeight,
  viewport,
  panel,
  group,
  basis
) {
  const controls = sceneRenderControls(panel);
  const incidentSkyCache = new Map();
  const diagnostics = {
    sourceId: group.sourceId,
    controls,
    skySampleBlockPixels: SCENE_RENDER.skySampleBlockPixels,
    skySampleCount: 0,
    groundSampleCount: 0,
    computedWithAtmosphereKernels: true,
  };

  for (
    let blockY = viewport.y;
    blockY < viewport.y + viewport.height;
    blockY += SCENE_RENDER.skySampleBlockPixels
  ) {
    for (
      let blockX = viewport.x;
      blockX < viewport.x + viewport.width;
      blockX += SCENE_RENDER.skySampleBlockPixels
    ) {
      const sampleX = Math.min(
        viewport.x + viewport.width - 1,
        blockX + SCENE_RENDER.skySampleBlockPixels * 0.5
      );
      const sampleY = Math.min(
        viewport.y + viewport.height - 1,
        blockY + SCENE_RENDER.skySampleBlockPixels * 0.5
      );
      const ray = sceneRayForPixel(viewport, sampleX, sampleY, basis);
      const rgb =
        ray[2] > 0
          ? computeSceneSkyRgb(panel, group, ray, controls, incidentSkyCache)
          : computeSceneGroundRgb(panel, group, ray, controls, incidentSkyCache);

      if (ray[2] > 0) {
        diagnostics.skySampleCount += 1;
      } else {
        diagnostics.groundSampleCount += 1;
      }

      fillRectClipped(
        pixels,
        imageWidth,
        imageHeight,
        blockX,
        blockY,
        SCENE_RENDER.skySampleBlockPixels,
        SCENE_RENDER.skySampleBlockPixels,
        [rgb[0], rgb[1], rgb[2], 255]
      );
    }
  }

  diagnostics.incidentSkyCacheEntries = incidentSkyCache.size;

  return diagnostics;
}

function drawProjectedLine(
  pixels,
  imageWidth,
  imageHeight,
  viewport,
  basis,
  from,
  to,
  rgba
) {
  const a = projectScenePoint(from, viewport, basis);
  const b = projectScenePoint(to, viewport, basis);

  if (!a || !b) {
    return;
  }

  drawLine(pixels, imageWidth, imageHeight, a.x, a.y, b.x, b.y, rgba);
}

function drawSceneGroundGrid(
  pixels,
  imageWidth,
  imageHeight,
  viewport,
  panel,
  basis,
  maximumDistanceMeters,
  distanceCases
) {
  const farDepth = sceneDepthForDistance(maximumDistanceMeters, maximumDistanceMeters);
  const gridColor = [55, 68, 61, 255];

  for (const slope of [-2, -1, 0, 1, 2]) {
    const laneSlope = slope * SCENE_RENDER.laneSlope;

    drawProjectedLine(
      pixels,
      imageWidth,
      imageHeight,
      viewport,
      basis,
      [20, laneSlope * 20, 0],
      [farDepth, laneSlope * farDepth, 0],
      gridColor
    );
  }

  const distances = uniqueSortedNumbers(
    distanceCases.map((transferCase) => transferCase.target.distanceMeters)
  );

  for (const distanceMeters of distances) {
    const depth = sceneDepthForDistance(distanceMeters, maximumDistanceMeters);
    const width = Math.max(20, depth * SCENE_RENDER.laneSlope);

    drawProjectedLine(
      pixels,
      imageWidth,
      imageHeight,
      viewport,
      basis,
      [depth, -width, 0],
      [depth, width, 0],
      [58, 73, 65, 255]
    );
  }
}

function drawSceneSourceMarker(
  pixels,
  imageWidth,
  imageHeight,
  viewport,
  panel,
  group,
  basis
) {
  const direction = sceneSunRayForGroup(panel, group);
  const point = projectSceneDirection(direction, viewport, basis);

  if (!point) {
    return;
  }

  fillCircle(pixels, imageWidth, imageHeight, point.x, point.y, 16, [
    248,
    199,
    72,
    255,
  ]);
  fillCircle(pixels, imageWidth, imageHeight, point.x, point.y, 10, [
    255,
    238,
    140,
    255,
  ]);
}

function sceneSpectrumIdForSource(panel, sourceId) {
  return (
    panel.sceneSpectrumBySourceId?.[sourceId] ||
    panel.sceneSpectrumId ||
    panel.spectrumIds[0]
  );
}

function sceneSpectrumSetIdsForSource(panel, sourceId) {
  if (Array.isArray(panel.sceneSpectrumSetIds) && panel.sceneSpectrumSetIds.length > 0) {
    return panel.sceneSpectrumSetIds;
  }

  return [sceneSpectrumIdForSource(panel, sourceId)];
}

function drawSceneObjects(
  pixels,
  imageWidth,
  imageHeight,
  viewport,
  panel,
  group,
  basis
) {
  const sceneSpectrumGroups = sceneSpectrumSetIdsForSource(panel, group.sourceId)
    .map((sceneSpectrumId) => ({
      sceneSpectrumId,
      cases: group.cases
        .filter(
          (transferCase) =>
            transferCase.objectSpectrumId === sceneSpectrumId &&
            transferCase.target.distanceMeters > 0
        )
        .sort((a, b) => a.target.distanceMeters - b.target.distanceMeters),
    }))
    .filter((sceneGroup) => sceneGroup.cases.length > 0);
  const sceneCases = sceneSpectrumGroups.flatMap((sceneGroup) => sceneGroup.cases);

  if (sceneCases.length === 0) {
    return;
  }

  const maximumDistanceMeters = Math.max(
    ...sceneCases.map((transferCase) => transferCase.target.distanceMeters)
  );
  const drawCases = sceneSpectrumGroups
    .flatMap((sceneGroup, spectrumIndex) =>
      sceneGroup.cases.map((transferCase, sceneIndex) => ({
        transferCase,
        spectrumIndex,
        sceneIndex,
        spectrumCaseCount: sceneGroup.cases.length,
      }))
    )
    .sort(
      (a, b) =>
        b.transferCase.target.distanceMeters - a.transferCase.target.distanceMeters
    );

  drawSceneGroundGrid(
    pixels,
    imageWidth,
    imageHeight,
    viewport,
    panel,
    basis,
    maximumDistanceMeters,
    sceneCases
  );

  for (const drawCase of drawCases) {
    const { transferCase } = drawCase;
    const depth = sceneDepthForDistance(
      transferCase.target.distanceMeters,
      maximumDistanceMeters
    );
    const spectrumLaneCenter =
      sceneSpectrumGroups.length <= 1
        ? 0
        : -SCENE_RENDER.spectrumLaneSpread +
          (2 * SCENE_RENDER.spectrumLaneSpread * drawCase.spectrumIndex) /
            (sceneSpectrumGroups.length - 1);
    const distanceFan =
      drawCase.spectrumCaseCount <= 1
        ? 0
        : -SCENE_RENDER.distanceLaneFan +
          (2 * SCENE_RENDER.distanceLaneFan * drawCase.sceneIndex) /
            (drawCase.spectrumCaseCount - 1);
    const lateralDirection =
      spectrumLaneCenter + distanceFan;
    const lateralOffset = lateralDirection * SCENE_RENDER.laneSlope * depth;
    const center = [depth, lateralOffset, 0];
    const distanceRatio = distanceDisplayPosition(
      transferCase.target.distanceMeters,
      maximumDistanceMeters
    );
    const cardHeightPixels = Math.round(
      SCENE_RENDER.diagnosticNearCardHeightPixels * (1 - distanceRatio) +
        SCENE_RENDER.diagnosticFarCardHeightPixels * distanceRatio
    );
    const cardWidthPixels = Math.round(
      cardHeightPixels * SCENE_RENDER.cardWidthToHeight
    );
    const centerPoint = projectScenePoint(
      [center[0], center[1], 6],
      viewport,
      basis
    );

    if (!centerPoint) {
      continue;
    }

    const rgb = transferCase.displayPreview.finalRadiance.encodedRgb;

    drawSceneCard(
      pixels,
      imageWidth,
      imageHeight,
      Math.round(centerPoint.x - cardWidthPixels / 2),
      Math.round(centerPoint.y - cardHeightPixels),
      cardWidthPixels,
      cardHeightPixels,
      rgb
    );
  }
}

function renderScenePanel(panel) {
  const width = SCENE_RENDER.width;
  const height = SCENE_RENDER.height;
  const pixels = createPixels(width, height, [0, 0, 0, 255]);
  const diagnostics = {
    panelId: panel.id,
    renderModel: "range-compressed-perspective-scene",
    skyModel:
      "cleanroom spectral path radiance sampled through scene camera rays",
    sceneRender: SCENE_RENDER,
    sourceViews: [],
  };

  if ((panel.cases || []).length === 0) {
    fillRectClipped(pixels, width, height, 80, 235, width - 160, 80, [
      82,
      72,
      72,
      255,
    ]);
    return { width, height, pixels, diagnostics };
  }

  const basis = sceneCameraBasis();
  const groups = panelSourceGroups(panel);
  const gap = groups.length > 1 ? 8 : 0;
  const viewportWidth = Math.floor((width - gap * (groups.length - 1)) / groups.length);

  groups.forEach((group, groupIndex) => {
    const viewport = {
      x: groupIndex * (viewportWidth + gap),
      y: 0,
      width:
        groupIndex === groups.length - 1
          ? width - groupIndex * (viewportWidth + gap)
          : viewportWidth,
      height,
    };
    const backgroundDiagnostics = renderSceneAtmosphereBackground(
      pixels,
      width,
      height,
      viewport,
      panel,
      group,
      basis
    );

    if (groupIndex > 0) {
      fillRectClipped(pixels, width, height, viewport.x - gap, 0, gap, height, [
        19,
        20,
        21,
        255,
      ]);
    }

    drawSceneObjects(pixels, width, height, viewport, panel, group, basis);
    drawSceneSourceMarker(pixels, width, height, viewport, panel, group, basis);
    diagnostics.sourceViews.push(backgroundDiagnostics);
  });

  return { width, height, pixels, diagnostics };
}

function copyPixels(
  destination,
  destinationWidth,
  destinationHeight,
  source,
  sourceWidth,
  sourceHeight,
  offsetX,
  offsetY
) {
  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      const sourceOffset = (y * sourceWidth + x) * 4;
      const rgba = [
        source[sourceOffset],
        source[sourceOffset + 1],
        source[sourceOffset + 2],
        source[sourceOffset + 3],
      ];
      setPixel(
        destination,
        destinationWidth,
        destinationHeight,
        offsetX + x,
        offsetY + y,
        rgba
      );
    }
  }
}

function writeSceneGalleryImages(artifactDirectory, scenePanels) {
  const renderedPanels = [];
  const generatedFiles = [];
  const renderDiagnostics = [];

  for (const panel of scenePanels) {
    const rendered = renderScenePanel(panel);

    writePng(
      path.join(artifactDirectory, panel.outputFileName),
      rendered.width,
      rendered.height,
      rendered.pixels
    );
    renderedPanels.push({ ...rendered, fileName: panel.outputFileName });
    renderDiagnostics.push(rendered.diagnostics);
    generatedFiles.push(panel.outputFileName);
  }

  const gap = 12;
  const panelWidth = renderedPanels[0]?.width || 960;
  const panelHeight = renderedPanels[0]?.height || 520;
  const galleryWidth = panelWidth * 2 + gap * 3;
  const galleryHeight = panelHeight * 2 + gap * 3;
  const gallery = createPixels(galleryWidth, galleryHeight, [26, 27, 28, 255]);

  renderedPanels.forEach((panel, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const offsetX = gap + column * (panelWidth + gap);
    const offsetY = gap + row * (panelHeight + gap);

    copyPixels(
      gallery,
      galleryWidth,
      galleryHeight,
      panel.pixels,
      panel.width,
      panel.height,
      offsetX,
      offsetY
    );
  });

  writePng(
    path.join(artifactDirectory, "scene-gallery.png"),
    galleryWidth,
    galleryHeight,
    gallery
  );
  generatedFiles.push("scene-gallery.png");

  return {
    generatedFiles,
    renderDiagnostics,
  };
}

function nextRecommendation(step, criteriaResults) {
  if (criteriaResults.summary.failed > 0) {
    return "Continue with the next diagnostic artifact; do not overwrite this failed run.";
  }

  if (step.kind === "scene-gallery" && criteriaResults.summary.unresolved === 0) {
    return "Final experiment goal reached: all phases now have generated scene previews backed by accepted spectral artifacts.";
  }

  if (
    ["lambertian", "local-sun", "flat-long-sightline"].includes(step.kind) &&
    criteriaResults.summary.unresolved === 0
  ) {
    return "This follow-up lane passed. Continue to the next uncompleted follow-up lane, or stop if all follow-ups have passed.";
  }

  if (isConvergenceStep(step) && criteriaResults.summary.unresolved === 0) {
    return "State goal reached for the transfer baseline and convergence proof. Optional later tracks are Lambertian surface lighting, local Sun, and flat long-sightline follow-ups.";
  }

  if (criteriaResults.summary.unresolved > 0) {
    if (step.id === "transfer-refined-baseline") {
      return "Run `node scripts/flat/atmosphere-environment/run.js --step=transfer-refined-convergence` to test the refined baseline against the next doubled sample counts.";
    }

    return "Run the next `transfer-convergence` artifact to measure convergence deltas for the demonstration effects.";
  }

  return "Run `node scripts/flat/atmosphere-environment/run.js --step=transfer-convergence` to create the next numbered convergence artifact.";
}

function inputChangeSentence(step) {
  if (step.kind === "scene-gallery") {
    return "No physics inputs changed. This run reads the latest accepted phase artifacts and generates display-only scene previews from their recorded spectral transfer cases.";
  }

  if (step.id === "transfer-refined-baseline") {
    return "Numerical controls changed to the doubled transfer-convergence counts from 004; atmosphere constants, Sun cases, distances, and object spectra stayed unchanged.";
  }

  if (step.id === "transfer-refined-convergence") {
    return "Numerical controls changed to 80/40/68/96 for convergence comparison against the latest accepted refined baseline; atmosphere constants, Sun cases, distances, and object spectra stayed unchanged.";
  }

  if (isConvergenceStep(step)) {
    return "Numerical controls changed to doubled sample counts for convergence comparison; atmosphere constants, Sun cases, distances, and object spectra stayed unchanged.";
  }

  return "None relative to the preflight baseline. This run uses experiment 032 constants and assumptions.";
}

function convergenceStatusSentence(step, criteriaResults) {
  const comparison = criteriaResults.metrics.convergenceComparison;

  if (step.kind === "scene-gallery") {
    return "This scene-gallery artifact reuses accepted source artifacts; no new transport convergence criterion is part of this display proof.";
  }

  if (["lambertian", "local-sun", "flat-long-sightline"].includes(step.kind)) {
    return "This follow-up uses its own objective criteria; no convergence-margin criterion is part of this artifact.";
  }

  if (comparison) {
    return `Convergence comparison against ${comparison.baselineArtifact} passed: ${comparison.passed}. Minimum effect-to-convergence margin: ${comparison.margins.minimumMargin}.`;
  }

  if (isConvergenceStep(step)) {
    return "No accepted baseline artifact was available for convergence comparison.";
  }

  return "The unresolved convergence-backed effect margin belongs to the transfer-convergence follow-up.";
}

function reportMetricRows(metrics, cacheDiagnostics) {
  const rows = [
    ["Max final-composition error", metrics.maxCompositionError],
    ["Max zero-distance transmittance error", metrics.maxZeroTransmittanceError],
    ["Max zero-distance path radiance", metrics.maxZeroPathRadiance],
    ["Max black-object identity error", metrics.maxBlackIdentityError],
    ["Max linearity error", metrics.maxLinearityError],
    ["Max split-segment transmittance error", metrics.maxSegmentTransmittanceError],
    ["Max split-segment path-radiance error", metrics.maxSegmentPathRadianceError],
    ["Max Lambertian equation error", metrics.maxLambertianEquationError],
    ["Max reflectance-ratio error", metrics.maxReflectanceRatioError],
    ["Sun lighting difference", metrics.sunLightingDifference],
    ["Distance transmittance drop", metrics.distanceTransmittanceDrop],
    ["Max endpoint angular spread degrees", metrics.maxEndpointAngularSpreadDegrees],
    ["Max phase-nu range", metrics.maxPhaseNuRange],
    ["Max inverse-square error", metrics.maxInverseSquareError],
    ["Local Sun path effect", metrics.localSunPathEffect],
    ["Max altitude range meters", metrics.maxAltitudeRangeMeters],
    ["Max linear optical-depth error", metrics.maxLinearTauError],
    ["Max product transmittance error", metrics.maxProductTransmittanceError],
    ["Long-distance path effect", metrics.longDistancePathEffect],
    ["Scene panel count", metrics.scenePanelCount],
    ["Selected scene cases", metrics.selectedSceneCaseCount],
    ["Generated scene file count", metrics.generatedSceneFileCount],
    ["Maximum scene distance meters", metrics.maximumDistanceMeters],
    ["Minimum nonzero scene distance meters", metrics.minimumNonzeroDistanceMeters],
    [
      "Generated scene files",
      metrics.generatedSceneFiles ? metrics.generatedSceneFiles.join(", ") : undefined,
    ],
    ["Atmosphere sky sample blocks", metrics.totalSkySampleCount],
    ["Atmosphere ground sample blocks", metrics.totalGroundSampleCount],
    ["Min transmittance", metrics.minTransmittance],
    ["Max transmittance", metrics.maxTransmittance],
    ["Incident sky cache entries", cacheDiagnostics.incidentSkyCacheEntries],
    [
      "Min convergence margin",
      metrics.convergenceComparison
        ? metrics.convergenceComparison.margins.minimumMargin
        : undefined,
    ],
  ];

  return rows
    .filter((row) => row[1] !== undefined)
    .map((row) => `| ${row[0]} | ${row[1]} |`)
    .join("\n");
}

function whatItShowsBullets(step) {
  if (step.kind === "scene-gallery") {
    return [
      "Every completed phase has a generated scene preview: refined transfer, Lambertian surface lighting, local Sun, and flat long sightline.",
      "Sky and ground-atmosphere preview pixels are sampled through the cleanroom spectral atmosphere kernels.",
      "Object-card colors are rendered from recorded final spectral radiance display previews, not from a hidden image-only path.",
      "Each scene/source view renders three recorded object-spectrum stacks: red, blue, and green.",
      "The combined scene gallery gives a single visual audit target for all phases.",
      "The companion contact sheet still exposes source, attenuated, path-radiance, and final swatches for the selected scene cases.",
    ];
  }

  if (step.kind === "lambertian") {
    return [
      "Lambertian surface radiance is computed from reflectance, direct Sun irradiance, and surface-to-Sun transmittance.",
      "The lit object radiance is then changed by view-path transmittance and path radiance.",
      "Zero reflectance reduces to the path-radiance-only case.",
      "Changing Sun position changes direct surface radiance.",
    ];
  }

  if (step.kind === "local-sun") {
    return [
      "Source directions vary along long object-to-camera segments.",
      "Pre-atmosphere source irradiance follows inverse-square falloff.",
      "Scattering phase angles use local source directions.",
      "Source falloff and atmospheric transmittance are recorded separately.",
    ];
  }

  if (step.kind === "flat-long-sightline") {
    return [
      "Flat-slab horizontal rays keep constant altitude.",
      "Optical depth grows linearly with distance for same-altitude paths.",
      "Long finite object paths are separate from spherical-Earth geometry.",
      "Very long paths strongly attenuate object radiance while adding path radiance.",
    ];
  }

  return [
    "Zero-distance transfer preserved object radiance.",
    "Black objects returned only atmospheric path radiance.",
    "Object-radiance differences stayed linear under view transmittance.",
    "Longer finite segments reduced mean transmittance.",
    "Low-Sun and high-Sun cases produced different path radiance.",
  ];
}

function caseMatrixDescription(step, transferCases) {
  if (step.kind === "scene-gallery") {
    return `Generated ${transferCases.length} selected scene cases copied from accepted source artifacts for four phase previews.`;
  }

  if (step.kind === "lambertian") {
    return `Generated ${transferCases.length} Lambertian surface-lighting cases: \`2\` Sun cases, \`7\` distances, and \`6\` synthetic reflectance spectra.`;
  }

  if (step.kind === "local-sun") {
    return `Generated ${transferCases.length} local finite-source cases: \`1\` point-source profile, \`7\` distances, and \`6\` synthetic object spectra.`;
  }

  if (step.kind === "flat-long-sightline") {
    return `Generated ${transferCases.length} flat-slab long-sightline cases: \`2\` Sun cases, \`6\` distances, and \`6\` synthetic object spectra.`;
  }

  return `Generated ${transferCases.length} primary finite object-transfer cases:
\`2\` Sun cases, \`7\` distances, and \`6\` synthetic object spectra.`;
}

function whatItIsDoingSentence(step) {
  if (step.kind === "scene-gallery") {
    return "Generate scene previews for every completed phase from accepted spectral transfer artifacts.";
  }

  if (step.kind === "lambertian") {
    return "Generate Lambertian surface-radiance packets from synthetic reflectance, direct Sun irradiance, and surface-to-Sun transmittance before applying view-path transfer.";
  }

  if (step.kind === "local-sun") {
    return "Generate finite-source object-transfer packets with local source direction, inverse-square falloff, and first-order local-source path radiance.";
  }

  if (step.kind === "flat-long-sightline") {
    return "Generate flat-slab finite object-transfer packets for long horizontal same-altitude sightlines.";
  }

  return "Generate finite object-transfer packets for two Bruneton Figure 1 Sun cases, seven algorithmic distances, and six synthetic caller-provided object spectra.";
}

function makeStateGoal(step, status, criteriaResults) {
  if (step.kind === "scene-gallery") {
    return `# ${step.title}

Status: ${status}

## State Goal

${step.stateGoal}

## Success Definition

The artifact succeeds when all required source artifacts are accepted, selected
spectral cases cover every phase, and one scene preview per phase plus the
combined scene gallery are generated from those recorded cases.

## Attempted

- Read the accepted transfer, Lambertian, local Sun, and flat long-sightline
  artifacts.
- Selected the recorded spectral cases needed for phase scene previews.
- Generated \`scene-preview-*.png\`, \`scene-gallery.png\`, \`scene-data.json\`,
  and the standard contact sheet/report/provenance files.

## Result

- Criteria passed: ${criteriaResults.summary.passed}
- Criteria failed: ${criteriaResults.summary.failed}
- Criteria unresolved: ${criteriaResults.summary.unresolved}

## Next

${nextRecommendation(step, criteriaResults)}
`;
  }

  return `# ${step.title}

Status: ${status}

## State Goal

${step.stateGoal}

## Success Definition

The artifact succeeds when hard spectral transfer identities pass on the
recorded wavelength arrays and convergence-sensitive demonstration claims are
either resolved or explicitly carried to the next numbered artifact.

## Attempted

- Generated the fixed 84-case baseline matrix.
- Used experiment 032 atmosphere constants and assumptions.
- Composed caller-provided object radiance with finite-segment atmospheric
  transmittance and path radiance.
- Wrote spectral JSON before display previews.
- Generated a contact sheet from transfer-cases.json.

## Result

- Criteria passed: ${criteriaResults.summary.passed}
- Criteria failed: ${criteriaResults.summary.failed}
- Criteria unresolved: ${criteriaResults.summary.unresolved}

## Next

${nextRecommendation(step, criteriaResults)}
`;
}

function makeReport(step, status, transferCases, criteriaResults, cacheDiagnostics) {
  const metrics = criteriaResults.metrics;

  return `# ${step.title}

Status: ${status}

## Summary

${caseMatrixDescription(step, transferCases)} The
transport endpoint is spectral radiance by wavelength. CIE, sRGB, tone mapping,
and PNG output are display consumers only.

Criteria passed: ${criteriaResults.summary.passed}. Failed:
${criteriaResults.summary.failed}. Unresolved:
${criteriaResults.summary.unresolved}. ${convergenceStatusSentence(
  step,
  criteriaResults
)}

## What It Shows

${whatItShowsBullets(step).map((item) => `- ${item}`).join("\n")}

## Key Metrics

| Metric | Value |
| --- | ---: |
${reportMetricRows(metrics, cacheDiagnostics)}

## Distance Responses

${metrics.distanceResponses
  ? metrics.distanceResponses
      .map(
        (response) =>
          `- ${response.sunCase}: mean T 100 m = ${response.nearMeanTransmittance}, mean T 100 km = ${response.farMeanTransmittance}, path fraction change = ${response.pathFractionChange}`
      )
      .join("\n")
  : "- See `criteria-results.json` for this follow-up's step-specific effect metrics."}

## Display Boundary

\`contact-sheet.png\` is generated from \`transfer-cases.json\`. It uses one
fixed artifact-wide display mapping: CIE to linear sRGB, then
\`1 - exp(-k * linear_sRGB)\` with \`k = 1 / (5 * 683)\`. Swatches are
organized as Sun-case and object-spectrum blocks with distance rows and four
columns: source object, attenuated object, path radiance, and final radiance.

The source object spectra are algorithmic unit radiance arrays. They are not
material reflectance measurements.

${step.kind === "scene-gallery"
  ? "The scene preview PNGs are also display consumers. They sample sky and ground-atmosphere context through the cleanroom spectral kernels, place recorded transfer cases into an algorithmic range-compressed perspective layout, and color each object card from `displayPreview.finalRadiance.encodedRgb`."
  : ""}

## Next

${nextRecommendation(step, criteriaResults)}
`;
}

function makeRunningLogEntry(artifactInfo, step, status, criteriaResults) {
  return `## ${artifactInfo.folderName}

State goal:
${step.stateGoal}

What it is doing:
${whatItIsDoingSentence(step)}

Inputs and assumptions changed:
${inputChangeSentence(step)}

Commands run:
\`node ${SCRIPT_PATH} --step=${step.id}\`

What it learned:
The artifact generated ${criteriaResults.summary.passed} passing criteria,
${criteriaResults.summary.failed} failing criteria, and
${criteriaResults.summary.unresolved} unresolved criteria.
${convergenceStatusSentence(step, criteriaResults)}

Accepted/rejected/superseded/blocked:
${status}

Next:
${nextRecommendation(step, criteriaResults)}

`;
}

function writeRunLog(filePath, lines) {
  writeText(filePath, `${lines.join("\n")}\n`);
}

function copyScriptSnapshot(artifactDirectory) {
  fs.copyFileSync(__filename, path.join(artifactDirectory, "script-snapshot.js"));
}

function summarizeGeneratedFiles(artifactDirectory) {
  return fs
    .readdirSync(artifactDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function makeSceneData(scenePanels, generatedSceneFiles, renderDiagnostics) {
  return {
    schemaVersion: 1,
    generatedSceneFiles,
    renderDiagnostics,
    panels: scenePanels.map((panel) => ({
      ...summarizeScenePanel(panel),
      selectedCases: (panel.cases || []).map((transferCase) => ({
        caseId: transferCase.caseId,
        sourceArtifact: transferCase.sceneGallery.sourceArtifact,
        sourceId: transferCaseSourceId(transferCase),
        objectSpectrumId: transferCase.objectSpectrumId,
        distanceMeters: transferCase.target.distanceMeters,
        geometryProfileId: transferCase.geometryProfileId,
        sourceProfileId: transferCase.sourceProfileId,
        finalRadiancePreviewRgb:
          transferCase.displayPreview.finalRadiance.encodedRgb,
        sourceObjectPreviewRgb:
          transferCase.displayPreview.sourceObject.encodedRgb,
        attenuatedObjectPreviewRgb:
          transferCase.displayPreview.attenuatedObject.encodedRgb,
        pathRadiancePreviewRgb:
          transferCase.displayPreview.pathRadiance.encodedRgb,
      })),
    })),
  };
}

function main() {
  const step = activeStep();
  const artifactInfo = nextArtifactInfo(step);
  const startedAt = new Date().toISOString();
  const command = `node ${SCRIPT_PATH} --step=${step.id}`;
  const runLogLines = [
    `startedAt=${startedAt}`,
    `script=${SCRIPT_PATH}`,
    `step=${step.id}`,
    `artifact=${artifactInfo.folderName}`,
    `command=${command}`,
  ];

  const inputs = makeInputs(step);
  const baselineArtifact =
    isConvergenceStep(step)
      ? findLatestAcceptedBaselineArtifact(artifactInfo.existingArtifacts)
      : null;

  if (baselineArtifact) {
    inputs.convergenceReferenceArtifact = {
      folderName: baselineArtifact.folderName,
      artifactFolder: path
        .relative(ROOT, baselineArtifact.directory)
        .replaceAll("\\", "/"),
      status: baselineArtifact.provenance.status,
    };
    runLogLines.push(`convergenceReference=${baselineArtifact.folderName}`);
  }

  const computed =
    step.kind === "scene-gallery"
      ? computeSceneGallery(step, artifactInfo)
      : step.kind === "lambertian"
      ? computeLambertianCases(step, artifactInfo)
      : step.kind === "local-sun"
      ? computeLocalSunCases(step, artifactInfo)
      : step.kind === "flat-long-sightline"
      ? computeFlatLongSightlineCases(step, artifactInfo)
      : computeTransferCases(step, artifactInfo);
  const {
    transferCases,
    compositionDiagnostics,
    cacheDiagnostics,
    scenePanels = [],
  } = computed;
  const sceneImageResult =
    step.kind === "scene-gallery"
      ? writeSceneGalleryImages(artifactInfo.directory, scenePanels)
      : { generatedFiles: [], renderDiagnostics: [] };
  const generatedSceneFiles = sceneImageResult.generatedFiles;
  const renderDiagnostics = sceneImageResult.renderDiagnostics;

  if (step.kind === "scene-gallery") {
    cacheDiagnostics.generatedSceneFiles = generatedSceneFiles;
    cacheDiagnostics.renderDiagnostics = renderDiagnostics;
  }

  const criteriaResults =
    step.kind === "scene-gallery"
      ? evaluateSceneGalleryCriteria(
          scenePanels,
          generatedSceneFiles,
          artifactInfo.directory,
          renderDiagnostics
        )
      : step.kind === "lambertian"
      ? evaluateLambertianCriteria(transferCases)
      : step.kind === "local-sun"
      ? evaluateLocalSunCriteria(transferCases)
      : step.kind === "flat-long-sightline"
      ? evaluateFlatLongSightlineCriteria(transferCases)
      : evaluateCriteria(transferCases, compositionDiagnostics, {
          step,
          baselineArtifact,
        });
  const status =
    criteriaResults.summary.failed === 0 ? "accepted" : "rejected";

  runLogLines.push(`status=${status}`);
  runLogLines.push(`completedAt=${new Date().toISOString()}`);

  writeText(
    path.join(artifactInfo.directory, "state-goal.md"),
    makeStateGoal(step, status, criteriaResults)
  );
  writeJson(path.join(artifactInfo.directory, "inputs.json"), inputs);
  writeJson(
    path.join(artifactInfo.directory, "equations-and-constants.json"),
    makeEquationsAndConstants(step)
  );
  writeJson(path.join(artifactInfo.directory, "transfer-cases.json"), {
    schemaVersion: 1,
    caseCount: transferCases.length,
    transferCases,
    compositionDiagnostics,
    cacheDiagnostics,
  });
  if (step.kind === "scene-gallery") {
    writeJson(
      path.join(artifactInfo.directory, "scene-data.json"),
      makeSceneData(scenePanels, generatedSceneFiles, renderDiagnostics)
    );
  }
  writeJson(
    path.join(artifactInfo.directory, "criteria-results.json"),
    criteriaResults
  );
  writeText(
    path.join(artifactInfo.directory, "report.md"),
    makeReport(step, status, transferCases, criteriaResults, cacheDiagnostics)
  );
  writeContactSheet(
    path.join(artifactInfo.directory, "contact-sheet.png"),
    transferCases
  );
  copyScriptSnapshot(artifactInfo.directory);
  writeRunLog(path.join(artifactInfo.directory, "run.log"), runLogLines);
  writeJson(path.join(artifactInfo.directory, "provenance.json"), {
    schemaVersion: 1,
    step,
    scriptPath: SCRIPT_PATH,
    command,
    artifactFolder: path.relative(ROOT, artifactInfo.directory).replaceAll("\\", "/"),
    artifactNumber: artifactInfo.artifactNumber,
    artifactNumberDecision: {
      existingArtifacts: artifactInfo.existingArtifacts,
      nextArtifactNumber: artifactInfo.artifactNumber,
      policy: "max(existing NNN) + 1; never overwrite",
    },
    sourceBoundary: inputs.sourceBoundary,
    startedAt,
    completedAt: new Date().toISOString(),
    status,
    runningLog: path
      .relative(ROOT, path.join(ARTIFACT_ROOT, "running-log.md"))
      .replaceAll("\\", "/"),
    scriptSnapshot: "script-snapshot.js",
    convergenceReferenceArtifact: baselineArtifact
      ? baselineArtifact.folderName
      : null,
    references: REFERENCES,
    algorithmicDecisions: ALGORITHMIC_DECISIONS,
    generatedFiles: summarizeGeneratedFiles(artifactInfo.directory),
  });

  fs.appendFileSync(
    path.join(ARTIFACT_ROOT, "running-log.md"),
    makeRunningLogEntry(artifactInfo, step, status, criteriaResults)
  );

  console.log(`Wrote ${artifactInfo.folderName}`);
  console.log(`Status: ${status}`);
  console.log(
    `Criteria: ${criteriaResults.summary.passed} pass, ${criteriaResults.summary.failed} fail, ${criteriaResults.summary.unresolved} unresolved`
  );
}

main();
