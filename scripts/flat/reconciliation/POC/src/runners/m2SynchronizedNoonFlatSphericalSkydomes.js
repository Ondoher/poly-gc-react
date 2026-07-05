// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.5 subjective skydome assets.
// - scripts/flat/reconciliation/POC/src/constants/consts.js, synchronized solar-noon scene set.
// - tmp/atmosphere/reconciliation/043-m2-summer-solstice-latitude-skydomes.

import { mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import sharp from 'sharp';

import {
    Figure1SkyDomeRenderer,
    M2_LOCAL_FLAT_SEED_CONSTANTS,
    Step018SkydomeImageWriter,
} from '../index.js';
import { createM1DistantSphericalModels } from './createM1Models.js';
import { createM2LocalFlatModels, makeM2SeedSummary } from './createM2Models.js';
import {
    appendRunLog,
    assert,
    finiteSpectral,
    nonnegativeSpectral,
    nowIso,
    parseRecordDirectory,
    spectralMean,
    writeJson,
    writeText,
} from './recordWriter.js';

const DEFAULT_SCENE_SET_ID = 'san-jose-longitude-summer-solstice-45east-noon-latitude-sweep';

const recordDirectory = parseRecordDirectory(process.argv);
const sizePixels = parsePositiveIntegerOption(process.argv, '--size', 320);
const sceneSetId = parseStringOption(process.argv, '--scene-set', DEFAULT_SCENE_SET_ID);
const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
const sceneSet = resolveSceneSet(seed, sceneSetId);
const scenes = sceneSet.scenes;
const artifactDirectory = resolve(recordDirectory, 'artifacts');
const flatWriter = new Step018SkydomeImageWriter();
const sphericalRenderer = new Figure1SkyDomeRenderer();
const rows = [];

await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes started sizePixels=${sizePixels} sceneSet=${sceneSet.id} scenes=${scenes.length}.`);
await mkdir(artifactDirectory, { recursive: true });

validateSceneSet(sceneSet);

for (const scene of scenes) {
    await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes scene=${scene.id} flat-model-build-started.`);

    const flatModels = createM2LocalFlatModels(scene);
    const flatPath = resolve(artifactDirectory, scene.guideImageFilename);

    await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes scene=${scene.id} flat-render-started output=${flatPath}.`);

    const flatRenderResult = await flatWriter.write({
        scene,
        evaluator: flatModels.evaluator,
        outputPath: flatPath,
        width: sizePixels,
        height: sizePixels,
        progress: makeRenderProgressLogger('flat', scene.id, flatPath),
        progressRowInterval: 8,
    });
    const flatStats = await stat(flatPath);

    await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes scene=${scene.id} flat-render-complete bytes=${flatStats.size}.`);

    assertRenderedSkydome(flatRenderResult, flatStats.size, 'flat');

    const sphericalScene = createSphericalScene(scene);
    const sphericalModels = createM1DistantSphericalModels(sphericalScene);
    const sphericalPath = resolve(artifactDirectory, scene.sphericalSkydomeFilename);

    await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes scene=${scene.id} spherical-render-started output=${sphericalPath}.`);

    const sphericalRenderResult = await sphericalRenderer.render({
        scene: sphericalScene,
        evaluator: sphericalModels.evaluator,
        outputPath: sphericalPath,
        width: sizePixels,
        height: sizePixels,
        progress: makeRenderProgressLogger('spherical', scene.id, sphericalPath),
        progressRowInterval: 8,
    });
    const sphericalStats = await stat(sphericalPath);

    await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes scene=${scene.id} spherical-render-complete bytes=${sphericalStats.size}.`);

    assertRenderedSkydome(sphericalRenderResult, sphericalStats.size, 'spherical');

    rows.push(Object.freeze({
        sceneId: scene.id,
        rowLabel: scene.rowLabel ?? null,
        renderDateUtc: scene.renderDateUtc ?? null,
        renderTimeUtc: scene.renderTimeUtc ?? null,
        renderHourUtc: scene.renderHourUtc ?? null,
        observerLatitudeDegrees: scene.observerLatitudeDegrees,
        observerLongitudeDegrees: scene.observerLongitudeDegrees,
        sourceSubpointLatitudeDegrees: scene.sourceSubpointLatitudeDegrees,
        sourceSubpointLongitudeDegrees: scene.sourceSubpointLongitudeDegrees,
        skyOrientation: scene.skyOrientation,
        horizontalFrame: scene.horizontalFrame,
        flat: Object.freeze({
            path: flatPath,
            filename: scene.guideImageFilename,
            fileSizeBytes: flatStats.size,
            sourcePositionMeters: scene.sourcePositionMeters,
            sourceAltitudeDegrees: scene.sourceAltitudeDegrees,
            sourceAzimuthDegrees: normalizeDegrees(scene.sourceAzimuthDegrees),
            meanMaxRadiance: spectralMean(flatRenderResult.diagnostics.maxRadiance),
            diagnostics: flatRenderResult.diagnostics,
            geometryRuntimeDiagnostics: flatModels.geometry.runtimeDiagnostics,
        }),
        spherical: Object.freeze({
            path: sphericalPath,
            filename: scene.sphericalSkydomeFilename,
            fileSizeBytes: sphericalStats.size,
            sunAltitudeDegrees: sphericalScene.sunAltitudeDegrees,
            sunAzimuthDegrees: azimuthFromNorthDegrees(scene.sphericalDirectionToLight),
            directionToLight: scene.sphericalDirectionToLight,
            meanMaxRadiance: spectralMean(sphericalRenderResult.diagnostics.maxRadiance),
            diagnostics: sphericalRenderResult.diagnostics,
        }),
    }));
}

const stack = await writeStack(rows, artifactDirectory);

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Define and render a reusable north-up synchronized-clock scene set. Each row
supplies an observer location, resolved source latitude, and synchronized
source meridian. The left image is the finite local-source flat rendering; the
right image is the matching distant-source spherical rendering for the same
observer location and time.
`);
await writeJson(recordDirectory, 'inputs.json', {
    trigger: 'User-requested north-up synchronized-clock flat/spherical skydome set',
    seed: makeM2SeedSummary(),
    selectedSceneSet: summarizeSceneSet(sceneSet),
    requestedSizePixels: sizePixels,
    scenes: rows.map((row) => Object.freeze({
        sceneId: row.sceneId,
        observerLatitudeDegrees: row.observerLatitudeDegrees,
        observerLongitudeDegrees: row.observerLongitudeDegrees,
        sourceSubpointLatitudeDegrees: row.sourceSubpointLatitudeDegrees,
        sourceSubpointLongitudeDegrees: row.sourceSubpointLongitudeDegrees,
        skyOrientation: row.skyOrientation,
        horizontalFrame: row.horizontalFrame,
    })),
    runtimeCodeChanged: true,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'agents/topics/apps/flat/reconciliation/action-plan.md',
        'agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md',
        'agents/topics/apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md',
        'tmp/atmosphere/reconciliation/043-m2-summer-solstice-latitude-skydomes',
    ],
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    status: 'north-up-synchronized-clock-flat-spherical-set-generated',
    selectedSceneSet: summarizeSceneSet(sceneSet),
    brightnessCalibration: sceneSet.sourceBrightnessCalibration,
    orientation: {
        imageUp: 'model +y',
        imageRight: 'model +x',
        modelFrameForThisSet: 'x east, y north, z up',
        northUp: true,
    },
    solarTimeSynchronization: {
        rule: 'source subpoint longitude equals configured solar-noon meridian; observer/render longitude comes from the selected scene set',
        observerLongitudeDegrees: rows[0]?.observerLongitudeDegrees ?? null,
        solarNoonLongitudeDegrees: rows[0]?.sourceSubpointLongitudeDegrees ?? null,
        sourceLatitudeResolvedAt: scenes[0]?.sourceLatitudeResolvedAt ?? null,
        sourceSubpointLatitudeDegrees: rows[0]?.sourceSubpointLatitudeDegrees ?? null,
    },
    sphericalDistantSun: {
        frame: 'x east, y north, z up',
        noonDirection: 'east=0, north=sin(sourceLatitude-observerLatitude), up=cos(sourceLatitude-observerLatitude)',
        incidentRadianceMode: 'direct first-order diagnostic render, no incident-radiance cache',
    },
    flatLocalSun: {
        frame: 'x east, y north, z up',
        sourcePosition: 'north-polar AEQD source/observer positions projected into observer-local east/north axes',
        incidentRadianceMode: 'direct first-order diagnostic render, no incident-radiance cache',
    },
});
await writeJson(recordDirectory, 'criteria-results.json', {
    criteria: [
        {
            name: 'reusable synchronized-clock scene set selected',
            status: sceneSet.scenes.length > 0 && sceneSet.scenes.every((scene) =>
                Number.isFinite(scene.synchronizedSolarNoonLongitudeDegrees))
                ? 'accepted'
                : 'rejected',
            result: sceneSet.id,
        },
        {
            name: 'all rows are north-up',
            status: rows.every((row) =>
                row.skyOrientation === 'north-up'
                && row.horizontalFrame === 'observer-local-east-north-up')
                ? 'accepted'
                : 'rejected',
            result: 'Image up is model +y; this scene set maps model +y to local north.',
        },
        {
            name: 'all flat and spherical PNGs written',
            status: rows.length === scenes.length
                && rows.every((row) => row.flat.fileSizeBytes > 0 && row.spherical.fileSizeBytes > 0)
                ? 'accepted'
                : 'rejected',
            result: `${rows.length}/${scenes.length} rows rendered.`,
        },
        {
            name: 'two-column stack written',
            status: stack.fileSizeBytes > 0 ? 'accepted' : 'rejected',
            result: stack.outputPath,
        },
        {
            name: 'per-image Sun captions available',
            status: rows.every((row) =>
                Number.isFinite(row.flat.sourceAltitudeDegrees)
                && Number.isFinite(row.flat.sourceAzimuthDegrees)
                && Number.isFinite(row.spherical.sunAltitudeDegrees)
                && Number.isFinite(row.spherical.sunAzimuthDegrees))
                ? 'accepted'
                : 'rejected',
            result: 'Each stacked image is labeled with compass azimuth and altitude.',
        },
        {
            name: 'single shared brightness calibration reused',
            status: scenes.every((scene) =>
                scene.sourceBrightnessCalibration === sceneSet.sourceBrightnessCalibration
                && scene.referenceSpectralIncidentScale
                    === sceneSet.sourceBrightnessCalibration.referenceSpectralIncidentScale)
                ? 'accepted'
                : 'rejected',
            result: sceneSet.sourceBrightnessCalibration,
        },
    ],
});
await writeJson(recordDirectory, 'diagnostics.json', {
    output: stack,
    rows,
});
await writeJson(recordDirectory, 'command.json', {
    commands: [
        {
            command: `node scripts/flat/reconciliation/POC/src/runners/m2SynchronizedNoonFlatSphericalSkydomes.js --record ${recordDirectory} --size ${sizePixels} --scene-set ${sceneSet.id}`,
            purpose: 'Render north-up synchronized-clock flat and spherical skydomes, then build a two-column stack.',
        },
    ],
});
await writeJson(recordDirectory, 'result.json', {
    status: 'accepted',
    claim: 'Rendered the reusable north-up synchronized-clock scene set with flat skydomes on the left and matching spherical skydomes on the right.',
    runtimeCodeChanged: true,
    artifactCount: rows.length * 2 + 1,
    rowCount: rows.length,
    outputPath: stack.outputPath,
    columnOrder: [
        'flat local-source rendering',
        'spherical distant-source rendering',
    ],
    nextStep: 'Use as subjective model-inspection evidence; it is not a Step 018 or Step 032 parity target.',
});
await writeText(recordDirectory, 'report.md', `# Report

Rendered ${rows.length} north-up synchronized-clock scene rows.

Final stack:

\`${stack.outputPath}\`

The left column is the flat finite local-source rendering. The right column is
the spherical distant-source rendering at the same observer location, source
latitude, synchronized render time, and date. The scene frame is x east, y
north, z up, so north is up in every source image. Each image is labeled with
Sun azimuth clockwise from north and altitude above the horizon.
`);
await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes accepted rows=${rows.length} output=${stack.outputPath}.`);

console.log(JSON.stringify({
    status: 'accepted',
    outputPath: stack.outputPath,
    rowCount: rows.length,
    artifactCount: rows.length * 2 + 1,
}));

function parsePositiveIntegerOption(argv, optionName, defaultValue) {
    const optionIndex = argv.indexOf(optionName);

    if (optionIndex === -1) {
        return defaultValue;
    }

    const value = Number(argv[optionIndex + 1]);

    if (!Number.isInteger(value) || value < 8) {
        throw new RangeError(`${optionName} must be an integer >= 8.`);
    }

    return value;
}

function parseStringOption(argv, optionName, defaultValue) {
    const optionIndex = argv.indexOf(optionName);

    if (optionIndex === -1) {
        return defaultValue;
    }

    const value = argv[optionIndex + 1];

    if (!value || value.startsWith('--')) {
        throw new RangeError(`${optionName} requires a value.`);
    }

    return value;
}

function resolveSceneSet(seedConstants, requestedSceneSetId) {
    const sceneSet = seedConstants.sceneSets[requestedSceneSetId]
        ?? Object.values(seedConstants.sceneSets).find((candidate) => candidate.id === requestedSceneSetId);

    if (!sceneSet) {
        const available = Object.keys(seedConstants.sceneSets).join(', ');

        throw new RangeError(`Unknown --scene-set "${requestedSceneSetId}". Available scene sets: ${available}.`);
    }

    return sceneSet;
}

function validateSceneSet(activeSceneSet) {
    assert(activeSceneSet.scenes.length > 0,
        'Synchronized-clock scene set must contain at least one row.');
    assert(activeSceneSet.scenes.every((scene) => scene.skyOrientation === 'north-up'),
        'Every synchronized-clock scene must declare north-up sky orientation.');
    assert(activeSceneSet.scenes.every((scene) => scene.horizontalFrame === 'observer-local-east-north-up'),
        'Every synchronized-clock scene must use the observer-local east/north/up frame.');
    assert(activeSceneSet.scenes.every((scene) => Number.isFinite(scene.sphericalSunAltitudeDegrees)),
        'Every synchronized-clock scene must carry a spherical Sun altitude.');
    assert(activeSceneSet.scenes.every((scene) => Number.isFinite(scene.sphericalSunAzimuthDegrees)),
        'Every synchronized-clock scene must carry a spherical Sun azimuth.');
    assert(activeSceneSet.scenes.every((scene) => Array.isArray(scene.sphericalDirectionToLight)),
        'Every synchronized-clock scene must carry a spherical direction.');
    assert(activeSceneSet.scenes.every((scene) => typeof scene.sphericalSkydomeFilename === 'string'),
        'Every synchronized-clock scene must carry a spherical skydome filename.');
    assert(activeSceneSet.scenes.every((scene) => Number.isFinite(scene.synchronizedSolarNoonLongitudeDegrees)),
        'Every synchronized-clock scene must carry a synchronized solar-noon longitude.');
}

function assertRenderedSkydome(renderResult, fileSizeBytes, label) {
    assert(fileSizeBytes > 0, `${label} PNG file must be nonempty.`);
    assert(renderResult.diagnostics.skyPixelCount > 0,
        `${label} skydome must contain sky pixels.`);
    assert(renderResult.diagnostics.transparentPixelCount > 0,
        `${label} skydome must contain transparent outside-sky pixels.`);
    assert(finiteSpectral(renderResult.diagnostics.maxRadiance),
        `${label} max radiance must be finite.`);
    assert(nonnegativeSpectral(renderResult.diagnostics.maxRadiance),
        `${label} max radiance must be nonnegative.`);
}

function createSphericalScene(scene) {
    return Object.freeze({
        id: `${scene.id}-spherical-distant`,
        sourceTimeOfDay: scene.rowLabel ?? 'synchronized solar noon',
        sourceSunZenithDegrees: 90 - scene.sphericalSunAltitudeDegrees,
        sunAltitudeDegrees: scene.sphericalSunAltitudeDegrees,
        sunAzimuthDegrees: scene.sphericalSunAzimuthDegrees,
        sourceTile: 'm2-synchronized-clock-spherical',
        sourceRedCrossCenterPixels: Object.freeze([0, 0]),
        observerLatitudeDegrees: scene.observerLatitudeDegrees,
        observerLongitudeDegrees: scene.observerLongitudeDegrees,
        skyOrientation: scene.skyOrientation,
        horizontalFrame: scene.horizontalFrame,
    });
}

async function writeStack(stackRows, outputDirectory) {
    const metadataRows = [];

    for (const row of stackRows) {
        await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes stack-metadata-started scene=${row.sceneId}.`);

        const flatMetadata = await sharp(row.flat.path).metadata();
        const sphericalMetadata = await sharp(row.spherical.path).metadata();

        assertSameDimensions(flatMetadata, sphericalMetadata, 'flat and spherical skydome images');

        metadataRows.push(Object.freeze({
            ...row,
            width: flatMetadata.width,
            height: flatMetadata.height,
        }));

        await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes stack-metadata-complete scene=${row.sceneId} width=${flatMetadata.width} height=${flatMetadata.height}.`);
    }

    const layout = buildLayout(metadataRows[0].width, metadataRows[0].height, metadataRows.length);
    const outputPath = resolve(outputDirectory, 'flat-spherical-synchronized-noon-north-up-stack.png');
    const composites = [];

    for (let rowIndex = 0; rowIndex < metadataRows.length; rowIndex += 1) {
        const row = metadataRows[rowIndex];
        const top = layout.firstRowTop + rowIndex * (layout.imageHeight + layout.rowGap);

        composites.push(
            Object.freeze({ input: row.flat.path, left: layout.leftColumnX, top }),
            Object.freeze({ input: row.spherical.path, left: layout.rightColumnX, top }),
        );
    }

    composites.push(Object.freeze({
        input: Buffer.from(buildLabelSvg(metadataRows, layout)),
        left: 0,
        top: 0,
    }));

    await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes stack-composite-started output=${outputPath}.`);

    await sharp({
        create: {
            width: layout.outputWidth,
            height: layout.outputHeight,
            channels: 4,
            background: '#101114ff',
        },
    })
        .composite(composites)
        .png()
        .toFile(outputPath);

    const fileStats = await stat(outputPath);

    await appendRunLog(recordDirectory, `m2SynchronizedNoonFlatSphericalSkydomes stack-composite-complete bytes=${fileStats.size}.`);

    assert(fileStats.size > 0, 'Flat/spherical two-column stack PNG must be nonempty.');

    return Object.freeze({
        outputPath,
        fileSizeBytes: fileStats.size,
        width: layout.outputWidth,
        height: layout.outputHeight,
        rowCount: metadataRows.length,
        columnOrder: Object.freeze(['flat', 'spherical']),
        layout,
    });
}

function assertSameDimensions(left, right, label) {
    assert(left.width === right.width, `${label} widths must match.`);
    assert(left.height === right.height, `${label} heights must match.`);
}

function buildLayout(imageWidth, imageHeight, rowCount) {
    const padding = 18;
    const labelWidth = 132;
    const columnGap = 20;
    const headerHeight = 48;
    const rowGap = 12;
    const leftColumnX = padding + labelWidth;
    const rightColumnX = leftColumnX + imageWidth + columnGap;
    const firstRowTop = padding + headerHeight;

    return Object.freeze({
        padding,
        labelWidth,
        columnGap,
        headerHeight,
        rowGap,
        imageWidth,
        imageHeight,
        leftColumnX,
        rightColumnX,
        firstRowTop,
        outputWidth: padding + labelWidth + 2 * imageWidth + columnGap + padding,
        outputHeight: firstRowTop + rowCount * imageHeight + (rowCount - 1) * rowGap + padding,
    });
}

function buildLabelSvg(labelRows, layout) {
    const rowHeader = labelRows.some((row) => typeof row.rowLabel === 'string') ? 'time' : 'latitude';
    const textRows = labelRows.map((row, rowIndex) => {
        const y = layout.firstRowTop + rowIndex * (layout.imageHeight + layout.rowGap) + layout.imageHeight / 2;
        const label = row.rowLabel ?? latitudeLabel(row.observerLatitudeDegrees);

        return `<text x="${layout.padding}" y="${y}" class="row">${escapeXml(label)}</text>`;
    }).join('\n');
    const metricLabels = labelRows.map((row, rowIndex) => {
        const top = layout.firstRowTop + rowIndex * (layout.imageHeight + layout.rowGap);

        return [
            buildSunMetricLabel(
                layout.leftColumnX,
                top,
                row.flat.sourceAzimuthDegrees,
                row.flat.sourceAltitudeDegrees,
            ),
            buildSunMetricLabel(
                layout.rightColumnX,
                top,
                row.spherical.sunAzimuthDegrees,
                row.spherical.sunAltitudeDegrees,
            ),
        ].join('\n');
    }).join('\n');
    const headerY = layout.padding + 26;
    const noteY = layout.padding + 43;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.outputWidth}" height="${layout.outputHeight}" viewBox="0 0 ${layout.outputWidth} ${layout.outputHeight}">
    <style>
        .header { fill: #f4f6fb; font: 700 18px Arial, sans-serif; }
        .row { fill: #c7ccd8; font: 700 17px Arial, sans-serif; dominant-baseline: middle; }
        .note { fill: #8991a3; font: 12px Arial, sans-serif; }
        .metric-bg { fill: #101114; fill-opacity: 0.72; }
        .metric { fill: #f4f6fb; font: 700 12px Arial, sans-serif; }
    </style>
    <text x="${layout.leftColumnX}" y="${headerY}" class="header">flat local source</text>
    <text x="${layout.rightColumnX}" y="${headerY}" class="header">spherical distant source</text>
    <text x="${layout.leftColumnX}" y="${noteY}" class="note">north up</text>
    <text x="${layout.rightColumnX}" y="${noteY}" class="note">north up</text>
    <text x="${layout.padding}" y="${headerY}" class="note">${escapeXml(rowHeader)}</text>
    ${textRows}
    ${metricLabels}
</svg>`;
}

function buildSunMetricLabel(left, top, azimuthDegrees, altitudeDegrees) {
    const label = `az ${formatDegrees(azimuthDegrees)} alt ${formatDegrees(altitudeDegrees)}`;
    const x = left + 10;
    const y = top + 19;
    const width = 142;
    const height = 22;

    return `<rect x="${x - 6}" y="${y - 15}" width="${width}" height="${height}" rx="3" class="metric-bg"></rect>
    <text x="${x}" y="${y}" class="metric">${escapeXml(label)}</text>`;
}

function latitudeLabel(latitudeDegrees) {
    if (Math.abs(latitudeDegrees) < 1e-9) {
        return 'equator';
    }

    return `${Math.abs(latitudeDegrees)}${latitudeDegrees < 0 ? 'S' : 'N'}`;
}

function summarizeSceneSet(activeSceneSet) {
    return Object.freeze({
        id: activeSceneSet.id,
        label: activeSceneSet.label,
        description: activeSceneSet.description,
        guideComparisonAvailable: activeSceneSet.guideComparisonAvailable,
        guideArtifactRoot: activeSceneSet.guideArtifactRoot,
        exactParityTarget: activeSceneSet.exactParityTarget,
        sourceBrightnessCalibration: activeSceneSet.sourceBrightnessCalibration ?? null,
        sceneCount: activeSceneSet.scenes.length,
        skyOrientation: activeSceneSet.scenes[0]?.skyOrientation ?? null,
        horizontalFrame: activeSceneSet.scenes[0]?.horizontalFrame ?? null,
    });
}

function azimuthFromNorthDegrees(direction) {
    return normalizeDegrees((Math.atan2(direction[0], direction[1]) * 180) / Math.PI);
}

function normalizeDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
}

function formatDegrees(degrees) {
    return `${degrees.toFixed(1)} deg`;
}

function makeRenderProgressLogger(modelKind, sceneId, outputPath) {
    return (progress) => appendRunLog(
        recordDirectory,
        `m2SynchronizedNoonFlatSphericalSkydomes render-progress model=${modelKind} scene=${sceneId} stage=${progress.stage} rows=${progress.completedRows}/${progress.totalRows} pixels=${progress.completedPixels}/${progress.totalPixels} sky=${progress.skyPixelCount} transparent=${progress.transparentPixelCount} output=${outputPath}.`,
    );
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
