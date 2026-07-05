// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 1.0.3.
// - tmp/atmosphere/reconciliation/001-abstraction-closure-contract.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    SpectralReferenceEvaluator,
    noIncidentRadiance,
} from '../index.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(currentDirectory, '..');

/** @type {RaySegment} */
const segment = Object.freeze({
    ray: Object.freeze({
        origin: Object.freeze([10, 20, 30]),
        direction: Object.freeze([0, 1, 0]),
    }),
    startDistanceMeters: 5,
    endDistanceMeters: 25,
});

const callLog = [];
const geometry = createMockGeometry(callLog);
const atmosphere = createMockAtmosphere(callLog);
const lightSource = createMockLightSource(callLog);
const calculator = createMockCalculator(callLog);

const evaluator = new SpectralReferenceEvaluator({
    geometry,
    atmosphere,
    lightSource,
    calculator,
    executionControls: Object.freeze({ pathIntervalCount: 2 }),
});

const spectralOutput = evaluator.evaluate({
    viewRayRequest: Object.freeze({ modelKind: 'contract-probe-not-spherical' }),
});

assert(spectralOutput.outputKind === 'spectral', 'Evaluator must return spectral output.');
assert(spectralOutput.viewRaySegment === segment, 'Evaluator must use geometry-resolved view segment.');
assert(spectralOutput.pathIntegrationPoints.length === 3, 'Evaluator must use calculator integration points.');
assert(spectralOutput.pathRadiance.inScattered[0] === 0.125, 'Evaluator must return calculator radiance output.');
assert(!Object.hasOwn(spectralOutput, 'color'), 'Spectral output must not contain color output.');
assert(!Object.hasOwn(spectralOutput, 'image'), 'Spectral output must not contain image output.');
assert(callLog.includes('geometry.resolveViewRaySegment'), 'Evaluator must ask geometry for the view segment.');
assert(callLog.includes('calculator.computeRadiance'), 'Evaluator must delegate radiance math to calculator.');

let rejectedMissingContract = false;

try {
    new SpectralReferenceEvaluator({
        geometry: Object.freeze({ resolveViewRaySegment: () => segment }),
        atmosphere,
        lightSource,
        calculator,
    });
} catch (error) {
    rejectedMissingContract = error?.code === 'MODEL_SET_VALIDATION_FAILED';
}

assert(rejectedMissingContract, 'Evaluator must reject incomplete model contracts.');

await assertCoreFilesDoNotImportOutputConcerns();

console.log(JSON.stringify({
    status: 'pass',
    outputKind: spectralOutput.outputKind,
    pathIntegrationPointCount: spectralOutput.pathIntegrationPoints.length,
    rejectedMissingContract,
}));

/**
 * @param {string[]} callLogTarget - Mutable call log.
 * @returns {GeometryModel} Mock geometry model.
 */
function createMockGeometry(callLogTarget) {
    return Object.freeze({
        resolveViewRaySegment() {
            callLogTarget.push('geometry.resolveViewRaySegment');
            return segment;
        },
        resolveAtmosphereCoordinate(position) {
            callLogTarget.push('geometry.resolveAtmosphereCoordinate');
            return Object.freeze({ altitudeMeters: position[2] });
        },
        resolveAtmospherePath() {
            callLogTarget.push('geometry.resolveAtmospherePath');
            return Object.freeze({
                start: Object.freeze({ altitudeMeters: 10 }),
                end: Object.freeze({ altitudeMeters: 20 }),
                lengthMeters: 10,
            });
        },
        resolveSourceRelativePosition() {
            callLogTarget.push('geometry.resolveSourceRelativePosition');
            return Object.freeze({
                directionFromSource: Object.freeze([0, -1, 0]),
                distanceFromSourceMeters: null,
            });
        },
        resolveCacheAccess() {
            callLogTarget.push('geometry.resolveCacheAccess');
            return Object.freeze({
                cacheKey: 'contract-probe',
                coordinates: Object.freeze([0, 1]),
            });
        },
    });
}

/**
 * @param {string[]} callLogTarget - Mutable call log.
 * @returns {AtmosphereModel} Mock atmosphere model.
 */
function createMockAtmosphere(callLogTarget) {
    return Object.freeze({
        sampleMedium() {
            callLogTarget.push('atmosphere.sampleMedium');
            return Object.freeze({
                extinction: Object.freeze([0, 0]),
                scattering: Object.freeze([0, 0]),
            });
        },
        integrateOpticalDepth() {
            callLogTarget.push('atmosphere.integrateOpticalDepth');
            return Object.freeze({
                opticalDepth: Object.freeze([0, 0]),
                transmittance: Object.freeze([1, 1]),
            });
        },
        samplePhase() {
            callLogTarget.push('atmosphere.samplePhase');
            return Object.freeze({ phase: Object.freeze([1, 1]) });
        },
    });
}

/**
 * @param {string[]} callLogTarget - Mutable call log.
 * @returns {LightSourceModel} Mock light-source model.
 */
function createMockLightSource(callLogTarget) {
    return Object.freeze({
        describeIncidentRadianceCache() {
            callLogTarget.push('lightSource.describeIncidentRadianceCache');
            return noIncidentRadiance.cacheDescriptor;
        },
        createIncidentRadianceCache() {
            callLogTarget.push('lightSource.createIncidentRadianceCache');
            return createNoIncidentCache();
        },
        sampleDirectLighting() {
            callLogTarget.push('lightSource.sampleDirectLighting');
            return Object.freeze({
                incidentRadiance: Object.freeze([1, 1]),
                directionToLight: Object.freeze([0, 1, 0]),
                sourceTransmittance: Object.freeze([1, 1]),
            });
        },
        resolveSourcePathLimit() {
            callLogTarget.push('lightSource.resolveSourcePathLimit');
            return Object.freeze({
                maxDistanceMeters: null,
                reason: 'contract-probe',
            });
        },
    });
}

/**
 * @param {string[]} callLogTarget - Mutable call log.
 * @returns {SpectralCalculatorLike} Mock calculator.
 */
function createMockCalculator(callLogTarget) {
    return Object.freeze({
        buildEndpointTrapezoidPathIntegrationPoints() {
            callLogTarget.push('calculator.buildEndpointTrapezoidPathIntegrationPoints');
            return Object.freeze([
                Object.freeze({
                    pointIndex: 0,
                    distanceAlongRayMeters: 5,
                    intervalLengthFromPreviousMeters: 0,
                    trapezoidWeight: 0.5,
                    measureMeters: 5,
                }),
                Object.freeze({
                    pointIndex: 1,
                    distanceAlongRayMeters: 15,
                    intervalLengthFromPreviousMeters: 10,
                    trapezoidWeight: 1,
                    measureMeters: 10,
                }),
                Object.freeze({
                    pointIndex: 2,
                    distanceAlongRayMeters: 25,
                    intervalLengthFromPreviousMeters: 10,
                    trapezoidWeight: 0.5,
                    measureMeters: 5,
                }),
            ]);
        },
        computeRadiance(_viewRaySegment, _pathIntegrationPoints, options = {}) {
            callLogTarget.push('calculator.computeRadiance');
            assert(options.incidentRadianceSampling === null, 'Default incident sampling should be null.');

            return Object.freeze({
                inScattered: Object.freeze([0.125, 0.25]),
                transmittance: Object.freeze([0.875, 0.75]),
            });
        },
    });
}

/**
 * @returns {IncidentRadianceCache} No-incident cache stub.
 */
function createNoIncidentCache() {
    return Object.freeze({
        descriptor: noIncidentRadiance.cacheDescriptor,
        coordinates() {
            return Object.freeze([]);
        },
        addCoordinateToCache() {},
        createIncidentRadianceSampler() {
            return noIncidentRadiance.incidentRadianceSampler;
        },
    });
}

async function assertCoreFilesDoNotImportOutputConcerns() {
    const coreRelativePaths = Object.freeze([
        'evaluation/SpectralReferenceEvaluator.js',
        'calculator/SpectralCalculator.js',
    ]);
    const forbiddenImportFragments = Object.freeze([
        '../color',
        '../outputs',
        '../comparison',
        '../rendering',
    ]);

    for (const relativePath of coreRelativePaths) {
        const content = await readFile(resolve(sourceRoot, relativePath), 'utf8');

        for (const forbiddenImportFragment of forbiddenImportFragments) {
            assert(
                !content.includes(forbiddenImportFragment),
                `${relativePath} must not import ${forbiddenImportFragment}.`,
            );
        }
    }
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
