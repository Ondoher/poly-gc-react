// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 transport helper invariants.
// - agents/topics/apps/flat/algorithm32/conclusions.md, transport identities.
// - tmp/atmosphere/reconciliation/010-cli-experiment-run-record-rule.

import {
    CANONICAL_SPECTRAL_BASIS,
    SpectralCalculator,
} from '../index.js';
import {
    assert,
    finiteSpectral,
    nonnegativeSpectral,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const calculator = new SpectralCalculator({
    spectralBasis: CANONICAL_SPECTRAL_BASIS,
    geometry: createZeroGeometry(),
    atmosphere: createZeroAtmosphere(),
    lightSource: createUnitLightSource(CANONICAL_SPECTRAL_BASIS.wavelengthsNanometers.length),
    executionControls: Object.freeze({ sourceTransmittanceIntervalCount: 2 }),
});
const channelCount = CANONICAL_SPECTRAL_BASIS.wavelengthsNanometers.length;
const sourceOpticalDepth = Object.freeze(Array.from({ length: channelCount }, (_, index) => 0.1 + index * 0.01));
const sourceTransmittance = calculator.computeSourceTransmittance(sourceOpticalDepth);
const segmentTransmittance = calculator.computeTrapezoidSegmentTransmittance(
    Object.freeze(Array.from({ length: channelCount }, () => 0.2)),
    Object.freeze(Array.from({ length: channelCount }, () => 0.4)),
    3,
);
const directScattering = calculator.computeDirectScattering(
    Object.freeze(Array.from({ length: channelCount }, () => 2)),
    Object.freeze(Array.from({ length: channelCount }, () => 3)),
    0.25,
    0.5,
);
const directInScattering = calculator.computeDirectInScattering(
    Object.freeze(Array.from({ length: channelCount }, () => 0.8)),
    Object.freeze(Array.from({ length: channelCount }, () => 0.6)),
    Object.freeze(Array.from({ length: channelCount }, () => 1.5)),
    directScattering,
    2,
);
const zeroSegment = Object.freeze({
    ray: Object.freeze({
        origin: Object.freeze([0, 0, 0]),
        direction: Object.freeze([0, 0, 1]),
    }),
    startDistanceMeters: 0,
    endDistanceMeters: 10,
});
const points = calculator.buildEndpointTrapezoidPathIntegrationPoints(zeroSegment, 4);
const zeroRadiance = calculator.computeRadiance(zeroSegment, points);

assert(sourceTransmittance.every((value, index) => approximatelyEqual(value, Math.exp(-sourceOpticalDepth[index]))),
    'Source transmittance must be exp(-opticalDepth).');
assert(segmentTransmittance.every((value) => approximatelyEqual(value, Math.exp(-0.9))),
    'Trapezoid segment transmittance must use average extinction over distance.');
assert(directScattering.every((value) => approximatelyEqual(value, 2)),
    'Direct scattering helper should combine Rayleigh and Mie phase terms.');
assert(directInScattering.every((value) => approximatelyEqual(value, 2.88)),
    'Direct in-scattering helper should multiply T_view, T_source, source, scattering, and measure.');
assert(zeroRadiance.inScattered.every((value) => value === 0), 'Zero medium should add no in-scattered radiance.');
assert(zeroRadiance.transmittance.every((value) => value === 1), 'Zero medium should leave transmittance at 1.');
assert(finiteSpectral(zeroRadiance.inScattered), 'Zero radiance must be finite.');
assert(nonnegativeSpectral(zeroRadiance.transmittance), 'Zero transmittance must be nonnegative.');

await writeExperimentRecord({
    recordDirectory,
    sourceTransmittance,
    segmentTransmittance,
    directScattering,
    directInScattering,
    zeroRadiance,
});

console.log(JSON.stringify({
    status: 'accepted',
    invariantCount: 6,
    pointCount: points.length,
}));

async function writeExperimentRecord(result) {
    await writeText(result.recordDirectory, 'state-goal.md', `# State Goal

Verify low-level transport helper invariants before using the calculator in
concrete distant/spherical runs.
`);
    await writeJson(result.recordDirectory, 'inputs.json', {
        trigger: 'M1 Subgoal 1.1 transport helper invariant run',
        spectralChannelCount: channelCount,
        runtimeCodeChanged: true,
    });
    await writeJson(result.recordDirectory, 'provenance.json', {
        generatedAt: nowIso(),
        sourceTrails: [
            'agents/topics/apps/flat/algorithm32/conclusions.md',
            'agents/topics/apps/flat/algorithm32/external-reference-log.md',
        ],
    });
    await writeJson(result.recordDirectory, 'equations-and-constants.json', {
        status: 'accepted',
        checkedEquations: [
            'T = exp(-tau)',
            'T_segment = exp(-0.5 * (sigma_prev + sigma_current) * ds)',
            'directScattering = beta_R * phase_R + beta_M * phase_M',
            'dL = T_view * T_source * L_source * scattering * ds',
        ],
    });
    await writeJson(result.recordDirectory, 'criteria-results.json', {
        criteria: [
            { name: 'source transmittance identity', status: 'accepted' },
            { name: 'trapezoid segment transmittance identity', status: 'accepted' },
            { name: 'direct scattering helper identity', status: 'accepted' },
            { name: 'direct in-scattering product identity', status: 'accepted' },
            { name: 'zero-medium in-scattering', status: 'accepted' },
            { name: 'zero-medium transmittance', status: 'accepted' },
        ],
    });
    await writeJson(result.recordDirectory, 'diagnostics.json', {
        sourceTransmittance: result.sourceTransmittance,
        segmentTransmittance: result.segmentTransmittance,
        directScattering: result.directScattering,
        directInScattering: result.directInScattering,
        zeroRadiance: result.zeroRadiance,
    });
    await writeJson(result.recordDirectory, 'command.json', {
        commands: [
            {
                command: `node scripts/flat/reconciliation/POC/src/runners/m1TransportHelperInvariants.js --record ${result.recordDirectory}`,
                purpose: 'Run transport helper invariant experiment.',
            },
        ],
    });
    await writeJson(result.recordDirectory, 'result.json', {
        status: 'accepted',
        claim: 'Transport helper invariants pass for transmittance, direct scattering, direct in-scattering, and zero-medium transport.',
        runtimeCodeChanged: true,
        invariantCount: 6,
        nextStep: 'Run concrete distant/spherical execution without image artifacts.',
    });
    await writeText(result.recordDirectory, 'report.md', `# Report

Transport helper invariants passed for Beer-Lambert transmittance, trapezoid
segment transmittance, direct scattering, direct in-scattering, and zero-medium
transport.
`);
    await writeText(result.recordDirectory, 'run.log', `${nowIso()} m1TransportHelperInvariants accepted 6 invariants.\n`);
}

function approximatelyEqual(a, b, tolerance = 1e-12) {
    return Math.abs(a - b) <= tolerance;
}

function createZeroGeometry() {
    return Object.freeze({
        resolveViewRaySegment(request) {
            return request.raySegment;
        },
        resolveAtmosphereCoordinate() {
            return Object.freeze({ altitudeMeters: 0 });
        },
        resolveAtmospherePath() {
            return Object.freeze({
                start: Object.freeze({ altitudeMeters: 0 }),
                end: Object.freeze({ altitudeMeters: 0 }),
                lengthMeters: 0,
                samples: Object.freeze([]),
            });
        },
        resolveSourceRelativePosition() {
            return Object.freeze({
                directionFromSource: Object.freeze([0, 0, -1]),
                directionToSource: Object.freeze([0, 0, 1]),
                distanceFromSourceMeters: null,
            });
        },
        resolveCacheAccess() {
            return Object.freeze({ cacheKey: 'zero', coordinates: Object.freeze([0]) });
        },
    });
}

function createZeroAtmosphere() {
    return Object.freeze({
        sampleMedium() {
            const zero = Object.freeze(Array.from({ length: channelCount }, () => 0));

            return Object.freeze({
                extinction: zero,
                scattering: zero,
                rayleighScattering: zero,
                mieScattering: zero,
                mieExtinction: zero,
                absorption: zero,
                density: Object.freeze({ rayleigh: 0, mie: 0, absorption: 0 }),
            });
        },
        integrateOpticalDepth() {
            const zero = Object.freeze(Array.from({ length: channelCount }, () => 0));
            const one = Object.freeze(Array.from({ length: channelCount }, () => 1));

            return Object.freeze({ opticalDepth: zero, transmittance: one });
        },
        samplePhase() {
            return Object.freeze({
                phase: Object.freeze(Array.from({ length: channelCount }, () => 1)),
                rayleighPhase: 1,
                miePhase: 1,
            });
        },
    });
}

function createUnitLightSource(count) {
    return Object.freeze({
        describeIncidentRadianceCache() {
            return Object.freeze({ cacheKind: 'none', sourceKey: 'helper', version: 1 });
        },
        createIncidentRadianceCache() {
            throw new Error('Not used by transport helper invariant runner.');
        },
        sampleDirectLighting() {
            return Object.freeze({
                incidentRadiance: Object.freeze(Array.from({ length: count }, () => 1)),
                directionToLight: Object.freeze([0, 0, 1]),
            });
        },
        resolveSourcePathLimit() {
            return Object.freeze({ maxDistanceMeters: null, reason: 'helper' });
        },
    });
}
