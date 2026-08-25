// References:
// - agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md.
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md.
// - tmp/atmosphere/reconciliation/020-m5-day-night-star-calibration.
// - tmp/atmosphere/reconciliation/027-m5-flat32-controlled-celestial-visibility-cpu-soft-shader.
// - tmp/atmosphere/reconciliation/028-m5-flat32-calibrated-star-visibility-cpu-soft-shader.

import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import { FIGURE1_DISPLAY_CONSTANTS } from '../constants/consts.js';
import { EXTERNAL_BOUNDARY_RADIANCE_SPACE } from '../external-boundary-radiance/consts.js';
import {
    RECORD_020_PROTOTYPE_STAR_CALIBRATION,
} from '../subjective-scenes/consts.js';
import Flat32SceneStateResolver from '../subjective-scenes/Flat32SceneStateResolver.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const runnerName = 'm5Flat32CelestialPhysicalValidityAudit';
const recordDirectory = parseRecordDirectory(process.argv);
const commandText = `node scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory}`;
const targetBodyIds = Object.freeze([
    'flat32-synthetic-star-analog-137',
    'flat32-synthetic-star-analog-150',
]);
const view = Object.freeze({
    width: 256,
    height: 256,
    verticalFovDegrees: 10,
});
const record020AssembledStarAngularRadiusRadians = 0.009;

await createFreshRecordDirectory(recordDirectory);
await appendRunLog(recordDirectory, `${runnerName} started.`);

const scene = new Flat32SceneStateResolver().resolve({
    id: 'san-jose-globe-solar-noon-physical-validity-audit',
    locationKey: 'san-jose',
    timeLocationKey: 'san-jose',
    earthMode: 'globe',
    timePresetKey: 'globe-solar-noon',
    hourOffset: 0,
});
const starTargets = Object.freeze(targetBodyIds.map((bodyId) => {
    const target = scene.syntheticStars.find((entry) => entry.objectId === bodyId);
    if (!target) {
        throw new Error(`Missing Flat32 audit target ${bodyId}.`);
    }
    const diskSolidAngleSteradians = angularDiskSolidAngle(target.angularRadiusRadians);
    return Object.freeze({
        bodyId,
        magnitude: target.magnitude,
        angularRadiusRadians: target.angularRadiusRadians,
        angularDiameterDegrees: target.angularRadiusRadians * 2 * 180 / Math.PI,
        diskSolidAngleSteradians,
        prototypeIntegratedFluxScale: prototypeIntegratedFluxScale(
            diskSolidAngleSteradians,
        ),
    });
}));

const horizontalFovDegrees = horizontalFovFromVertical(view);
const centerPixel = Object.freeze({
    x: Math.floor(view.width / 2),
    y: Math.floor(view.height / 2),
});
const centerPixelSolidAngleSteradians = perspectivePixelSolidAngle({
    ...view,
    horizontalFovDegrees,
    ...centerPixel,
});
let summedViewportSolidAngleSteradians = 0;
for (let y = 0; y < view.height; y += 1) {
    for (let x = 0; x < view.width; x += 1) {
        summedViewportSolidAngleSteradians += perspectivePixelSolidAngle({
            ...view,
            horizontalFovDegrees,
            x,
            y,
        });
    }
}
const analyticViewportSolidAngleSteradians = rectangularFrustumSolidAngle({
    horizontalFovDegrees,
    verticalFovDegrees: view.verticalFovDegrees,
});
const viewportSolidAngleError = Math.abs(
    summedViewportSolidAngleSteradians - analyticViewportSolidAngleSteradians,
);
const fixedToActualPixelSolidAngleRatio =
    RECORD_020_PROTOTYPE_STAR_CALIBRATION.pixelSolidAngleSteradians
    / centerPixelSolidAngleSteradians;
const record020AssembledDiskSolidAngleSteradians = angularDiskSolidAngle(
    record020AssembledStarAngularRadiusRadians,
);
const record020AssembledIntegratedFluxScale = prototypeIntegratedFluxScale(
    record020AssembledDiskSolidAngleSteradians,
);

const physicalCalibrationGaps = Object.freeze([
    Object.freeze({
        id: 'absolute-radiance-unit-contract',
        evidence: `${EXTERNAL_BOUNDARY_RADIANCE_SPACE.units}; ${EXTERNAL_BOUNDARY_RADIANCE_SPACE.unitsStatus}`,
        requiredGate: 'Declare and validate spectral irradiance and spectral radiance in SI units through source, transport, and display.',
    }),
    Object.freeze({
        id: 'passband-and-stellar-spectrum',
        evidence: 'Visual magnitude is applied as one scalar to every solar-spectrum channel.',
        requiredGate: 'Bin-integrate a flux-calibrated stellar spectrum or normalize a declared stellar SED through the catalog passband.',
    }),
    Object.freeze({
        id: 'exact-runtime-pixel-solid-angle',
        evidence: `Prototype divisor ${RECORD_020_PROTOTYPE_STAR_CALIBRATION.pixelSolidAngleSteradians} sr; current-view center pixel ${centerPixelSolidAngleSteradians} sr.`,
        requiredGate: 'Derive each perspective pixel solid angle from its four corner rays.',
    }),
    Object.freeze({
        id: 'normalized-point-source-response',
        evidence: 'Authored angular disks repeat one magnitude-derived radiance over a non-normalized footprint.',
        requiredGate: 'Use pixel weights p_i with sum(p_i)=1 and L_lambda_i=F_lambda*p_i/Omega_i.',
    }),
    Object.freeze({
        id: 'star-only-exposure',
        evidence: `Record-020 prototype multiplies stars by ${RECORD_020_PROTOTYPE_STAR_CALIBRATION.exposure}.`,
        requiredGate: 'Remove source-only exposure; any exposure/adaptation belongs to one global Color/display observer model.',
    }),
    Object.freeze({
        id: 'night-and-twilight-background',
        evidence: 'The focused post-sunset render quantizes adjacent sky to black and omits airglow, zodiacal light, diffuse stellar light, local light pollution, and Moon illumination of the atmosphere.',
        requiredGate: 'Validate modeled sky radiance against an independent measured or trusted radiative-transfer baseline before visibility claims.',
    }),
    Object.freeze({
        id: 'observer-visibility-model',
        evidence: 'Figure-1 tone mapping is a comparison display transform, not a camera sensor or adapted human-eye model.',
        requiredGate: 'Declare a camera response or a sourced human point-source contrast model; keep it separate from transport.',
    }),
]);

const criteria = Object.freeze([
    criterion('prototype-calibration-self-identifies-as-nonphysical',
        RECORD_020_PROTOTYPE_STAR_CALIBRATION.status
            === 'review-only-nonphysical-prototype'),
    criterion('boundary-radiance-contract-keeps-physical-calibration-open',
        EXTERNAL_BOUNDARY_RADIANCE_SPACE.unitsStatus === 'physical-calibration-open'),
    criterion('exact-perspective-pixel-solid-angle-sums-to-frustum',
        viewportSolidAngleError < 1e-12),
    criterion('fixed-prototype-solid-angle-does-not-match-current-camera',
        fixedToActualPixelSolidAngleRatio > 30),
    criterion('flat32-authored-star-disks-imply-nonconserving-continuous-top-hat-flux',
        starTargets.every((entry) => entry.prototypeIntegratedFluxScale > 300)),
    criterion('record-020-assembled-star-footprint-was-not-flux-conserving',
        record020AssembledIntegratedFluxScale > 39000),
    criterion('star-only-prototype-exposure-is-not-unity',
        RECORD_020_PROTOTYPE_STAR_CALIBRATION.exposure !== 1),
    criterion('physical-promotion-remains-blocked', physicalCalibrationGaps.length > 0),
]);
const auditStatus = criteria.every((entry) => entry.status === 'accepted')
    ? 'accepted'
    : 'rejected';
const physicalCalibrationStatus = 'rejected';

const sourceContentHashes = Object.freeze({
    runner: await sha256File(`scripts/flat/reconciliation/POC/src/runners/${runnerName}.js`),
    celestialProvider: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32SceneCelestialProvider.js'),
    displayConstants: await sha256File('scripts/flat/reconciliation/POC/src/constants/consts.js'),
    subjectiveSceneConstants: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/consts.js'),
    flat32SceneSnapshot: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/flat32SceneSnapshot.js'),
    sceneResolver: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32SceneStateResolver.js'),
    boundaryRadianceConstants: await sha256File('scripts/flat/reconciliation/POC/src/external-boundary-radiance/consts.js'),
    record020Runner: await sha256File('scripts/flat/reconciliation/POC/src/runners/m5AssembledCelestialAtmosphere.js'),
});

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Audit whether the current Flat32 synthetic-star visibility path can support a
real-world physical claim. Do not tune exposure and do not render another
subjective image. Quantify the current pixel-solid-angle, footprint-energy, unit,
source-spectrum, night-background, and observer-model gaps. Define the
flux-conservation equation that must pass before the next soft-shader star run.
`);
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([Object.freeze({ command: commandText, timestamp: nowIso() })]),
});
await writeJson(recordDirectory, 'inputs.json', {
    stage: '5.9-flat32-celestial-physical-validity-audit',
    runner: runnerName,
    view,
    targetBodyIds,
    prototypeCalibration: RECORD_020_PROTOTYPE_STAR_CALIBRATION,
    record020AssembledStarAngularRadiusRadians,
});
await writeJson(recordDirectory, 'provenance.json', {
    sourceContentHashes,
    localDesign: 'agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md',
    currentBoundaryContract: 'scripts/flat/reconciliation/POC/src/external-boundary-radiance/consts.js',
    previousRecords: Object.freeze({
        record020: 'tmp/atmosphere/reconciliation/020-m5-day-night-star-calibration',
        record027: 'tmp/atmosphere/reconciliation/027-m5-flat32-controlled-celestial-visibility-cpu-soft-shader',
        record028: 'tmp/atmosphere/reconciliation/028-m5-flat32-calibrated-star-visibility-cpu-soft-shader',
    }),
    primarySourceAnchorsForNextImplementation: Object.freeze([
        'https://etc.stsci.edu/etcstatic/users_guide/1_ref_2_spectral_distribution.html',
        'https://ssb.stsci.edu/cdbs/calspec/',
        'https://lasp.colorado.edu/lisird/latis/dap/tsis1_hsrs_1nm',
        'https://www.eso.org/~fpatat/science/skybright/twilight.pdf',
        'https://academic.oup.com/mnras/article/442/3/2600/1052389',
    ]),
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    currentPrototype: Object.freeze({
        equation: 'L_lambda = E_sun_lambda * 10^(-0.4 * (m - m_sun)) / Omega_fixed * exposure',
        ...RECORD_020_PROTOTYPE_STAR_CALIBRATION,
        footprintPolicy: 'constant radiance over authored angular disk with edge coverage',
        continuousIntegratedFluxScale: 'exposure * Omega_disk / Omega_fixed',
    }),
    requiredPointSource: Object.freeze({
        sourceQuantity: 'F_lambda: top-of-atmosphere spectral irradiance [W m^-2 nm^-1]',
        pixelWeight: 'p_i = integral over pixel i of normalized point-spread/reconstruction response; sum_i p_i = 1',
        pixelEquivalentRadiance: 'L_lambda_i = F_lambda * p_i / Omega_i',
        conservation: 'sum_i (L_lambda_i * Omega_i) = F_lambda for every wavelength',
        atmosphereComposition: 'L_camera_lambda_i = L_path_lambda_i + T_view_lambda * L_lambda_i',
        displayPolicy: 'one global Color/display transform for sky, Moon, and stars; no star-only exposure',
    }),
    displayComparison: FIGURE1_DISPLAY_CONSTANTS,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    cameraSolidAngle: Object.freeze({
        ...view,
        horizontalFovDegrees,
        centerPixel,
        centerPixelSolidAngleSteradians,
        summedViewportSolidAngleSteradians,
        analyticViewportSolidAngleSteradians,
        viewportSolidAngleError,
        prototypeFixedPixelSolidAngleSteradians:
            RECORD_020_PROTOTYPE_STAR_CALIBRATION.pixelSolidAngleSteradians,
        fixedToActualPixelSolidAngleRatio,
    }),
    starTargets,
    record020AssembledFootprint: Object.freeze({
        angularRadiusRadians: record020AssembledStarAngularRadiusRadians,
        diskSolidAngleSteradians: record020AssembledDiskSolidAngleSteradians,
        prototypeIntegratedFluxScale: record020AssembledIntegratedFluxScale,
    }),
    physicalCalibrationGaps,
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status: auditStatus,
    physicalCalibrationStatus,
    humanReviewStatus: 'not-applicable',
    criteria,
});
await writeJson(recordDirectory, 'result.json', {
    status: auditStatus,
    physicalCalibrationStatus,
    humanReviewStatus: 'not-applicable',
    criterionCount: criteria.length,
    acceptedCriterionCount: criteria.filter((entry) => entry.status === 'accepted').length,
    physicalCalibrationGapCount: physicalCalibrationGaps.length,
    imageCount: 0,
});
await writeText(recordDirectory, 'report.md', reportMarkdown({
    auditStatus,
    physicalCalibrationStatus,
    starTargets,
    centerPixelSolidAngleSteradians,
    fixedToActualPixelSolidAngleRatio,
    record020AssembledIntegratedFluxScale,
    criteria,
}));
await appendRunLog(recordDirectory,
    `${runnerName} ${auditStatus}; physical calibration ${physicalCalibrationStatus}.`);

console.log(JSON.stringify({
    status: auditStatus,
    physicalCalibrationStatus,
    recordDirectory,
    criterionCount: criteria.length,
    physicalCalibrationGapCount: physicalCalibrationGaps.length,
}));

function prototypeIntegratedFluxScale(diskSolidAngleSteradians) {
    return RECORD_020_PROTOTYPE_STAR_CALIBRATION.exposure
        * diskSolidAngleSteradians
        / RECORD_020_PROTOTYPE_STAR_CALIBRATION.pixelSolidAngleSteradians;
}

async function createFreshRecordDirectory(path) {
    const root = resolve('tmp/atmosphere/reconciliation');
    const target = resolve(path);
    const name = basename(target);
    if (dirname(target) !== root || !/^\d{3}-[a-z0-9][a-z0-9-]*$/.test(name)) {
        throw new Error('Record directory must be a direct numbered child of tmp/atmosphere/reconciliation/.');
    }
    await mkdir(target, { recursive: false });
}

function angularDiskSolidAngle(angularRadiusRadians) {
    return 2 * Math.PI * (1 - Math.cos(angularRadiusRadians));
}

function horizontalFovFromVertical({ width, height, verticalFovDegrees }) {
    const verticalFovRadians = verticalFovDegrees * Math.PI / 180;
    return 2 * Math.atan(Math.tan(verticalFovRadians / 2) * width / height) * 180 / Math.PI;
}

function perspectivePixelSolidAngle({
    width,
    height,
    horizontalFovDegrees,
    verticalFovDegrees,
    x,
    y,
}) {
    const corners = Object.freeze([
        perspectiveCornerRay({ width, height, horizontalFovDegrees, verticalFovDegrees, x, y }),
        perspectiveCornerRay({ width, height, horizontalFovDegrees, verticalFovDegrees, x: x + 1, y }),
        perspectiveCornerRay({ width, height, horizontalFovDegrees, verticalFovDegrees, x: x + 1, y: y + 1 }),
        perspectiveCornerRay({ width, height, horizontalFovDegrees, verticalFovDegrees, x, y: y + 1 }),
    ]);
    return sphericalTriangleSolidAngle(corners[0], corners[1], corners[2])
        + sphericalTriangleSolidAngle(corners[0], corners[2], corners[3]);
}

function perspectiveCornerRay({
    width,
    height,
    horizontalFovDegrees,
    verticalFovDegrees,
    x,
    y,
}) {
    const halfWidth = Math.tan(horizontalFovDegrees * Math.PI / 360);
    const halfHeight = Math.tan(verticalFovDegrees * Math.PI / 360);
    const cameraX = (2 * x / width - 1) * halfWidth;
    const cameraY = (1 - 2 * y / height) * halfHeight;
    const length = Math.hypot(cameraX, cameraY, 1);
    return Object.freeze([cameraX / length, cameraY / length, -1 / length]);
}

function sphericalTriangleSolidAngle(a, b, c) {
    const numerator = Math.abs(dot(a, cross(b, c)));
    const denominator = 1 + dot(a, b) + dot(b, c) + dot(c, a);
    return 2 * Math.atan2(numerator, denominator);
}

function rectangularFrustumSolidAngle({ horizontalFovDegrees, verticalFovDegrees }) {
    const x = Math.tan(horizontalFovDegrees * Math.PI / 360);
    const y = Math.tan(verticalFovDegrees * Math.PI / 360);
    return 4 * Math.atan2(x * y, Math.sqrt(1 + x * x + y * y));
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
    return Object.freeze([
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]);
}

function criterion(name, accepted) {
    return Object.freeze({ name, status: accepted ? 'accepted' : 'rejected' });
}

async function sha256File(path) {
    return createHash('sha256').update(await readFile(path)).digest('hex');
}

function reportMarkdown({
    auditStatus,
    physicalCalibrationStatus,
    starTargets: targets,
    centerPixelSolidAngleSteradians: centerSolidAngle,
    fixedToActualPixelSolidAngleRatio: solidAngleRatio,
    record020AssembledIntegratedFluxScale: record020FluxScale,
    criteria: resultCriteria,
}) {
    const rows = targets.map((entry) =>
        `| ${entry.bodyId} | ${entry.magnitude.toFixed(6)} | ${entry.angularDiameterDegrees.toFixed(6)} | ${entry.prototypeIntegratedFluxScale.toFixed(3)}x |`).join('\n');
    return `# Report

Audit status: **${auditStatus}**

Physical calibration status: **${physicalCalibrationStatus}**

The current star path cannot support a real-world visibility claim. Record 020
was a mechanics/reviewability proof: its fixed solid angle, star-only exposure,
and non-normalized angular footprint do not conserve a magnitude-derived point
source's integrated flux. This audit intentionally writes no image and does not
tune a replacement exposure.

For the 256 by 256, 10-degree audit view, the exact center-pixel solid angle is
${centerSolidAngle.toExponential(12)} sr. The prototype divisor is
${solidAngleRatio.toFixed(3)} times larger.

| Flat32 target | Magnitude | Authored diameter (deg) | Implied integrated flux scale |
| --- | ---: | ---: | ---: |
${rows}

The older record-020 0.009-radian top-hat footprint implies approximately
${record020FluxScale.toFixed(1)}x the magnitude-derived integrated flux under the
same prototype equation.

The replacement must own stellar spectral irradiance, exact perspective-pixel
solid angle, and normalized pixel weights:

\`L_lambda_i = F_lambda * p_i / Omega_i\`, with \`sum_i p_i = 1\`.

It must prove \`sum_i L_lambda_i * Omega_i = F_lambda\` at every wavelength,
then use the unchanged atmosphere equation and one global display transform.
Human-eye or camera visibility is a separate observer contract. The current
night model also lacks several real sky-background sources, so black-background
star contrast is not observational validation.

The controlled record-027 Moon remains useful only as a clearly labeled
counterfactual presentation test. Its artificial direction cannot validate the
actual San Jose sky.

Accepted audit criteria: ${resultCriteria.filter((entry) => entry.status === 'accepted').length}/${resultCriteria.length}.
`;
}
