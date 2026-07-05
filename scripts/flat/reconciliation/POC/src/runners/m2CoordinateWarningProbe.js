// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.6 closeout diagnostics.
// - tmp/atmosphere/reconciliation/029-m2-local-flat-assets, coordinate warning source.
// - tmp/atmosphere/reconciliation/033-m2-local-flat-stack-comparison, horizon/rim diff motivation.

import {
    FIGURE1_RENDER_CONSTANTS,
    M2_LOCAL_FLAT_SEED_CONSTANTS,
} from '../index.js';
import { addScaled, normalize } from '../math/vector.js';
import { createM2LocalFlatModels } from './createM2Models.js';
import {
    appendRunLog,
    assert,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const expectNoWarnings = process.argv.includes('--expect-no-warnings');
const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
const selectedPixel = Object.freeze({ x: 144, y: 10, label: 'first-mismatch-rim-pixel' });
const record035WarningTriggerPixel = Object.freeze({ x: 141, y: 16, label: 'record-035-first-warning-pixel' });
const selectedDirections = Object.freeze([
    Object.freeze({
        label: selectedPixel.label,
        direction: fisheyeDirectionForPixel(selectedPixel.x, selectedPixel.y, 320, 320),
        pixel: selectedPixel,
    }),
    Object.freeze({
        label: 'exact-horizon-azimuth-0',
        direction: Object.freeze([1, 0, 0]),
        pixel: null,
    }),
    Object.freeze({
        label: 'upper-rim-cardinal',
        direction: fisheyeDirectionForNormalizedRadius(0.995, Math.PI / 2),
        pixel: null,
    }),
]);
const sceneDiagnostics = [];

await appendRunLog(recordDirectory, `m2CoordinateWarningProbe started expectNoWarnings=${expectNoWarnings}.`);

for (const scene of seed.scenes) {
    await appendRunLog(recordDirectory, `m2CoordinateWarningProbe scene=${scene.id} model-build-started.`);

    const models = createM2LocalFlatModels(scene);
    const instrumentation = instrumentGeometry(models.geometry);
    const evaluations = [];

    for (const selected of selectedDirections) {
        await appendRunLog(recordDirectory, `m2CoordinateWarningProbe scene=${scene.id} selected-evaluation-started label=${selected.label}.`);

        const beforeCount = instrumentation.outOfDomainEvents.length;
        const output = models.evaluator.evaluate({
            viewRayRequest: Object.freeze({ direction: selected.direction }),
        });
        const afterEvents = instrumentation.outOfDomainEvents.slice(beforeCount);
        const viewSegment = output.viewRaySegment;
        const viewEnd = addScaled(
            viewSegment.ray.origin,
            viewSegment.ray.direction,
            viewSegment.endDistanceMeters,
        );

        evaluations.push(Object.freeze({
            label: selected.label,
            pixel: selected.pixel,
            direction: selected.direction,
            viewRayEndDistanceMeters: viewSegment.endDistanceMeters,
            viewRayEndAltitudeMeters: viewEnd[2],
            pathSampleCount: output.pathIntegrationPoints.length,
            outOfDomainEventCount: afterEvents.length,
            firstOutOfDomainEvent: afterEvents[0] ?? null,
            maxOutOfDomainAltitudeMeters: afterEvents.reduce(
                (max, event) => Math.max(max, event.altitudeMeters),
                Number.NEGATIVE_INFINITY,
            ),
            meanDirectInScatteringBySample: output.pathRadiance.diagnostics.samples.map((sample) =>
                sample.meanDirectInScattering),
        }));

        await appendRunLog(recordDirectory, `m2CoordinateWarningProbe scene=${scene.id} selected-evaluation-complete label=${selected.label} newWarnings=${afterEvents.length}.`);
    }

    const scanTrigger = expectNoWarnings
        ? evaluatePixel(models, instrumentation, record035WarningTriggerPixel)
        : await findFirstOutOfDomainPixel(scene.id, models, instrumentation);

    if (expectNoWarnings) {
        await appendRunLog(recordDirectory, `m2CoordinateWarningProbe scene=${scene.id} targeted-trigger-check-complete warnings=${scanTrigger?.outOfDomainEventCount ?? 0}.`);
    }

    sceneDiagnostics.push(Object.freeze({
        sceneId: scene.id,
        sourcePositionMeters: scene.sourcePositionMeters,
        sourceAltitudeDegrees: scene.sourceAltitudeDegrees,
        totalOutOfDomainEventCount: instrumentation.outOfDomainEvents.length,
        contextCounts: countBy(instrumentation.outOfDomainEvents, (event) => event.contextKind),
        scanTrigger,
        evaluations,
    }));
}

const totalOutOfDomainEventCount = sceneDiagnostics.reduce(
    (sum, scene) => sum + scene.totalOutOfDomainEventCount,
    0,
);
const firstEvent = sceneDiagnostics
    .flatMap((scene) => [
        scene.scanTrigger?.firstOutOfDomainEvent ?? null,
        ...scene.evaluations.map((evaluation) => evaluation.firstOutOfDomainEvent),
    ])
    .find(Boolean);
const allSourcePathEvents = sceneDiagnostics.every((scene) =>
    scene.totalOutOfDomainEventCount === 0
    || scene.contextCounts.resolveAtmospherePath === scene.totalOutOfDomainEventCount);

if (expectNoWarnings) {
    assert(totalOutOfDomainEventCount === 0, 'Probe should reproduce no coordinate warnings after the boundary fix.');
} else {
    assert(totalOutOfDomainEventCount > 0, 'Probe should reproduce at least one coordinate warning.');
}

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Diagnose the local/flat \`flat-atmosphere-coordinate-out-of-domain\` warnings
seen in record 029 and determine whether they come from view-ray samples,
source-path samples, cache access, or another coordinate handoff.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'Investigate coordinate warnings behind M2 local/flat rim-band differences',
    sourceRecords: [
        'tmp/atmosphere/reconciliation/029-m2-local-flat-assets',
        'tmp/atmosphere/reconciliation/033-m2-local-flat-stack-comparison',
    ],
    selectedDirections,
    scenes: seed.scenes.map((scene) => scene.id),
    expectation: expectNoWarnings ? 'no coordinate warnings after fix' : 'reproduce coordinate warnings',
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'scripts/flat/reconciliation/POC/src/geometry/FlatEarthGeometry.js',
        'scripts/flat/reconciliation/POC/src/calculator/SpectralCalculator.js',
        'tmp/atmosphere/reconciliation/029-m2-local-flat-assets/diagnostics.json',
        'tmp/atmosphere/reconciliation/033-m2-local-flat-stack-comparison/diagnostics.json',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'diagnostic-probe',
    topAltitudeMeters: seed.topAltitudeMeters,
    sceneSkyRayLimitMeters: seed.sceneSkyRayLimitMeters,
    renderConstants: {
        centerPixels: FIGURE1_RENDER_CONSTANTS.centerPixels,
        skyRadiusPixels: FIGURE1_RENDER_CONSTANTS.skyRadiusPixels,
        maxViewZenithRadians: FIGURE1_RENDER_CONSTANTS.maxViewZenithRadians,
    },
});
await writeJson(recordDirectory, 'diagnostics.json', {
    totalOutOfDomainEventCount,
    allSourcePathEvents,
    firstEvent,
    scenes: sceneDiagnostics,
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        {
            name: expectNoWarnings ? 'coordinate warnings removed' : 'coordinate warnings reproduced',
            status: (expectNoWarnings ? totalOutOfDomainEventCount === 0 : totalOutOfDomainEventCount > 0)
                ? 'accepted'
                : 'rejected',
            result: `${totalOutOfDomainEventCount} out-of-domain coordinate events captured.`,
        },
        {
            name: 'warnings isolated to source-path sampling',
            status: totalOutOfDomainEventCount === 0 || allSourcePathEvents ? 'accepted' : 'rejected',
            result: JSON.stringify(
                sceneDiagnostics.map((scene) => Object.freeze({
                    sceneId: scene.sceneId,
                    contextCounts: scene.contextCounts,
                })),
            ),
        },
        {
            name: 'first warning context captured',
            status: expectNoWarnings ? 'not-applicable' : (firstEvent ? 'accepted' : 'rejected'),
            result: firstEvent?.pathSummary ?? null,
        },
    ],
});
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m2CoordinateWarningProbe.js --record ${recordDirectory}${expectNoWarnings ? ' --expect-no-warnings' : ''}`,
            purpose: 'Instrument flat geometry coordinate resolution and isolate the source of M2 coordinate warnings.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: expectNoWarnings
        ? 'The boundary-tolerance fix removed the reproduced local source-path out-of-domain coordinate warnings.'
        : 'The reproduced out-of-domain coordinate warnings come from local source-path sampling rather than view-ray samples or cache access.',
    runtimeCodeChanged: true,
    totalOutOfDomainEventCount,
    firstEventSummary: firstEvent,
    nextStep: expectNoWarnings
        ? 'Regenerate local/flat assets only if the visual impact of the warning fix needs to be measured.'
        : 'Patch FlatEarthGeometry.resolveAtmospherePath so a path starting on the top boundary and heading out of the atmosphere returns a zero-length in-atmosphere path.',
});
await writeText(recordDirectory, 'report.md', expectNoWarnings ? `# Report

The post-fix probe captured ${totalOutOfDomainEventCount}
\`flat-atmosphere-coordinate-out-of-domain\` events across the selected
rim/horizon rays and first-triggering pixel scan.

The previous reproduced warning came from a source path that started at
\`${seed.topAltitudeMeters}.00000000001\` meters because a view ray endpoint
landed infinitesimally above the flat atmosphere top boundary. The geometry
boundary-distance check now treats that tiny negative top-boundary distance as
zero, so the path clips at the boundary instead of continuing toward the
finite local source.
` : `# Report

The probe reproduced ${totalOutOfDomainEventCount} out-of-domain coordinate
events from selected rim and horizon rays.

All reproduced events came from \`resolveAtmospherePath(...)\` source-path
sampling, not from view-ray samples or cache access. The first triggering
pixel/direction and source-path metadata are recorded in \`diagnostics.json\`.
`);
await appendRunLog(recordDirectory, `m2CoordinateWarningProbe accepted totalOutOfDomainEventCount=${totalOutOfDomainEventCount} allSourcePathEvents=${allSourcePathEvents}.`);

console.log(JSON.stringify({
    status: 'accepted',
    totalOutOfDomainEventCount,
    allSourcePathEvents,
    expectNoWarnings,
    firstEventTopDistanceMeters: firstEvent?.pathSummary?.topDistanceMeters,
}));

function instrumentGeometry(geometry) {
    const originalResolveAtmosphereCoordinate = geometry.resolveAtmosphereCoordinate.bind(geometry);
    const originalResolveAtmospherePath = geometry.resolveAtmospherePath.bind(geometry);
    const outOfDomainEvents = [];
    let activeContext = Object.freeze({ kind: 'direct-coordinate' });

    geometry.resolveAtmosphereCoordinate = (position) => {
        const coordinate = originalResolveAtmosphereCoordinate(position);
        const topAltitudeMeters = geometry.configuration.topAltitudeMeters;

        if (
            Number.isFinite(coordinate.altitudeMeters)
            && coordinate.altitudeMeters > topAltitudeMeters + 1e-9
        ) {
            outOfDomainEvents.push(Object.freeze({
                contextKind: activeContext.kind,
                altitudeMeters: coordinate.altitudeMeters,
                topAltitudeMeters,
                position: Object.freeze([...position]),
                pathSummary: activeContext.pathSummary ?? null,
            }));
        }

        return coordinate;
    };

    geometry.resolveAtmospherePath = (request = {}) => {
        const ray = request.ray ?? Object.freeze({
            origin: request.startPosition,
            direction: normalize(request.direction),
        });
        const pathSummary = Object.freeze({
            startAltitudeMeters: ray.origin?.[2] ?? null,
            directionZ: ray.direction?.[2] ?? null,
            sourceLimitMeters: request.sourcePathLimit?.maxDistanceMeters ?? null,
            topDistanceMeters: ray.origin && ray.direction
                ? geometry.distanceToTopAtmosphereBoundary(ray.origin, ray.direction)
                : null,
            groundDistanceMeters: ray.origin && ray.direction
                ? geometry.distanceToGroundBoundary(ray.origin, ray.direction)
                : null,
            requestedSampleCount: request.sampleCount ?? null,
        });
        const previousContext = activeContext;

        activeContext = Object.freeze({
            kind: 'resolveAtmospherePath',
            pathSummary,
        });

        try {
            return originalResolveAtmospherePath(request);
        } finally {
            activeContext = previousContext;
        }
    };

    return Object.freeze({ outOfDomainEvents });
}

async function findFirstOutOfDomainPixel(sceneId, models, instrumentation) {
    await appendRunLog(recordDirectory, `m2CoordinateWarningProbe scene=${sceneId} full-pixel-scan-started rows=${FIGURE1_RENDER_CONSTANTS.imageSizePixels}.`);

    for (let y = 0; y < FIGURE1_RENDER_CONSTANTS.imageSizePixels; y += 1) {
        for (let x = 0; x < FIGURE1_RENDER_CONSTANTS.imageSizePixels; x += 1) {
            const evaluation = evaluatePixel(models, instrumentation, Object.freeze({ x, y }));

            if (evaluation?.outOfDomainEventCount > 0) {
                await appendRunLog(recordDirectory, `m2CoordinateWarningProbe scene=${sceneId} full-pixel-scan-trigger row=${y} pixel=${x},${y} warnings=${evaluation.outOfDomainEventCount}.`);
                return evaluation;
            }
        }

        if ((y + 1) % 16 === 0 || y + 1 === FIGURE1_RENDER_CONSTANTS.imageSizePixels) {
            await appendRunLog(recordDirectory, `m2CoordinateWarningProbe scene=${sceneId} full-pixel-scan-progress rows=${y + 1}/${FIGURE1_RENDER_CONSTANTS.imageSizePixels}.`);
        }
    }

    await appendRunLog(recordDirectory, `m2CoordinateWarningProbe scene=${sceneId} full-pixel-scan-complete trigger=none.`);

    return null;
}

function evaluatePixel(models, instrumentation, pixel) {
    const sample = fisheyeSampleForPixel(
        pixel.x,
        pixel.y,
        FIGURE1_RENDER_CONSTANTS.imageSizePixels,
        FIGURE1_RENDER_CONSTANTS.imageSizePixels,
    );

    if (!sample) {
        return null;
    }

    const beforeCount = instrumentation.outOfDomainEvents.length;
    const output = models.evaluator.evaluate({
        viewRayRequest: Object.freeze({ direction: sample.direction }),
    });
    const afterEvents = instrumentation.outOfDomainEvents.slice(beforeCount);
    const viewSegment = output.viewRaySegment;
    const viewEnd = addScaled(
        viewSegment.ray.origin,
        viewSegment.ray.direction,
        viewSegment.endDistanceMeters,
    );

    return Object.freeze({
        pixel: Object.freeze({ x: pixel.x, y: pixel.y, label: pixel.label ?? null }),
        normalizedRadius: sample.normalizedRadius,
        zenithAngleDegrees: (sample.zenithAngle * 180) / Math.PI,
        elevationDegrees: 90 - (sample.zenithAngle * 180) / Math.PI,
        direction: sample.direction,
        viewRayEndDistanceMeters: viewSegment.endDistanceMeters,
        viewRayEndAltitudeMeters: viewEnd[2],
        outOfDomainEventCount: afterEvents.length,
        firstOutOfDomainEvent: afterEvents[0] ?? null,
    });
}

function fisheyeDirectionForPixel(x, y, width, height) {
    const sample = fisheyeSampleForPixel(x, y, width, height);

    if (!sample) {
        throw new RangeError('Pixel is outside the fisheye sky disc.');
    }

    return sample.direction;
}

function fisheyeSampleForPixel(x, y, width, height) {
    const scaleX = width / FIGURE1_RENDER_CONSTANTS.imageSizePixels;
    const scaleY = height / FIGURE1_RENDER_CONSTANTS.imageSizePixels;
    const centerX = FIGURE1_RENDER_CONSTANTS.centerPixels[0] * scaleX;
    const centerY = FIGURE1_RENDER_CONSTANTS.centerPixels[1] * scaleY;
    const skyRadiusPixels = FIGURE1_RENDER_CONSTANTS.skyRadiusPixels * Math.min(scaleX, scaleY);
    const dx = x - centerX;
    const dy = y - centerY;
    const radius = Math.sqrt(dx * dx + dy * dy);
    const normalizedRadius = radius / skyRadiusPixels;
    const azimuth = Math.atan2(-dy, dx);
    const zenithAngle = normalizedRadius * FIGURE1_RENDER_CONSTANTS.maxViewZenithRadians;

    if (normalizedRadius > 1) {
        return null;
    }

    return Object.freeze({
        normalizedRadius,
        azimuth,
        zenithAngle,
        direction: fisheyeDirectionForNormalizedRadius(normalizedRadius, azimuth),
    });
}

function fisheyeDirectionForNormalizedRadius(normalizedRadius, azimuth) {
    const zenithAngle = normalizedRadius * FIGURE1_RENDER_CONSTANTS.maxViewZenithRadians;
    const horizontalLength = Math.sin(zenithAngle);

    return normalize([
        horizontalLength * Math.cos(azimuth),
        horizontalLength * Math.sin(azimuth),
        Math.cos(zenithAngle),
    ]);
}

function countBy(values, keyFunction) {
    return Object.freeze(values.reduce((counts, value) => {
        const key = keyFunction(value);

        counts[key] = (counts[key] ?? 0) + 1;

        return counts;
    }, {}));
}
