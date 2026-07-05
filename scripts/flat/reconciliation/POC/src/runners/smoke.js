// References:
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, M0 scaffold inventory.
// - scripts/flat/reconciliation/POC/CURRENT_STATE.md, current smoke expectations.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    FIGURE1_DISPLAY_CONSTANTS,
    FIGURE1_RENDER_CONSTANTS,
    FIGURE1_SCENES,
    RUNTIME_NUMERICAL_CONTROLS,
    SpectralCalculator,
    buildIncidentRadianceCache,
    noIncidentRadiance,
    validateModelSet,
    validateNoHistoricalRuntimeLinks,
} from '../index.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(currentDirectory, '..');

const calculator = new SpectralCalculator({
    spectralBasis: CANONICAL_SPECTRAL_BASIS,
    executionControls: RUNTIME_NUMERICAL_CONTROLS,
});

assert(CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters === 6360000,
    'Canonical atmosphere constants should expose the Step 032 bottom radius.');
assert(CANONICAL_ATMOSPHERE_CONSTANTS.ozoneAbsorptionEnabled === false,
    'Canonical Figure 1 profile should keep ozone disabled.');
assert(CANONICAL_SPECTRAL_BASIS.wavelengthsNanometers.length === 15,
    'Canonical spectral basis should expose the active 15 channels.');
assert(CANONICAL_SPECTRAL_BASIS.wavelengthsNanometers[0] === 375.6666666666667,
    'Canonical spectral basis should use centered wavelength samples.');
assert(FIGURE1_DISPLAY_CONSTANTS.paperFigure1ToneMapK === 1 / (5 * 683),
    'Figure 1 display constants should expose the source-derived k.');
assert(FIGURE1_SCENES.length === 4, 'Figure 1 constants should expose the four comparison scenes.');
assert(FIGURE1_RENDER_CONSTANTS.imageSizePixels === 320,
    'Figure 1 render constants should expose the accepted tile size.');
assert(RUNTIME_NUMERICAL_CONTROLS.pathIntervalCount === 40,
    'Runtime numerical controls should expose the accepted default path interval count.');

/** @type {RaySegment} */
const segment = Object.freeze({
    ray: Object.freeze({
        origin: Object.freeze([0, 0, 0]),
        direction: Object.freeze([0, 0, 1]),
    }),
    startDistanceMeters: 0,
    endDistanceMeters: 10,
});

const points = calculator.buildEndpointTrapezoidPathIntegrationPoints(segment, 4);

assert(points.length === 5, 'Expected interval count + 1 integration points.');
assert(points[0].distanceAlongRayMeters === 0, 'First point should start at segment start.');
assert(points[4].distanceAlongRayMeters === 10, 'Last point should end at segment end.');
assert(points[0].measureMeters === 1.25, 'Endpoint measure should be half an interval.');
assert(points[2].measureMeters === 2.5, 'Interior measure should be one interval.');

validateModelSet(
    {
        geometry: { resolveViewRaySegment: () => segment },
    },
    {
        geometry: Object.freeze(['resolveViewRaySegment']),
    },
);

assert(noIncidentRadiance.incidentRadianceSampler({ cacheKey: 'none', coordinates: Object.freeze([]) }).length === 0,
    'No-incident sampler should return no samples.');

const cache = createSmokeCache();
const cacheBuildResult = buildIncidentRadianceCache({
    cache,
    geometry: { resolveViewRaySegment: () => segment },
    atmosphere: {},
    lightSource: {},
    calculator,
    pathIntervalCount: 4,
});

assert(cacheBuildResult.coordinateCount === 1, 'Smoke cache should build one coordinate.');

await validateNoHistoricalRuntimeLinks(sourceRoot);

console.log(JSON.stringify({
    status: 'pass',
    pointCount: points.length,
    cacheBuildCoordinateCount: cacheBuildResult.coordinateCount,
}));

function createSmokeCache() {
    const builtCoordinates = [];

    return {
        descriptor: Object.freeze({
            cacheKind: 'none',
            sourceKey: 'smoke',
            version: 1,
        }),
        coordinates() {
            return Object.freeze([
                Object.freeze({
                    coordinateKey: 'smoke-coordinate',
                    coordinates: Object.freeze([0]),
                }),
            ]);
        },
        addCoordinateToCache(request) {
            builtCoordinates.push(request.coordinate.coordinateKey);
        },
        createIncidentRadianceSampler() {
            return noIncidentRadiance.incidentRadianceSampler;
        },
        get builtCoordinates() {
            return Object.freeze([...builtCoordinates]);
        },
    };
}

/**
 * @param {boolean} condition - Assertion condition.
 * @param {string} message - Assertion failure message.
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
