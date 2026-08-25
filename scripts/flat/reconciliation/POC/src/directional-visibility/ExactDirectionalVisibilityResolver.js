// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   direction/depth visibility independent of source radiometry and raster coverage.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';

const DIRECTION_FRAME = 'camera-space-unit-vector-forward-minus-z';
const UNIT_VECTOR_TOLERANCE = 1e-12;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const BLOCKER_KINDS = Object.freeze([
    'scene',
    'globe',
    'opaque-finite-body',
]);
const POINT_BLOCKER_KINDS = Object.freeze([
    'point',
    'point-emitter',
    'point-source',
]);
const CONFIGURATION_FIELDS = Object.freeze([
    'blockers',
    'depthTieToleranceMeters',
]);
const BLOCKER_FIELDS = Object.freeze([
    'id',
    'kind',
    'fingerprint',
    'intersectExactRay',
]);
const INTERSECTION_FIELDS = Object.freeze([
    'distanceMeters',
    'featureId',
]);
const POINT_RAY_FIELDS = Object.freeze([
    'sourceId',
    'sourceGeometry',
    'directionCamera',
    'directionFrame',
    'depth',
]);
const EXTENDED_RAY_FIELDS = Object.freeze([
    'source',
    'directionCamera',
    'directionFrame',
    'depth',
]);
const EXTENDED_SOURCE_FIELDS = Object.freeze([
    'id',
    'kind',
    'geometry',
    'fingerprint',
]);
const NON_GEOMETRIC_FIELDS = Object.freeze([
    'alpha',
    'brightness',
    'celestialRadiance',
    'coverage',
    'geometryCoverage',
    'opacity',
    'radiance',
    'remainingCoverage',
    'responseWeight',
    'spectralIrradiance',
    'spectralRadiance',
    'weight',
]);

export default class ExactDirectionalVisibilityResolver {
    /**
     * Create a deterministic exact-ray visibility resolver from opaque geometry owners.
     *
     * @param {ExactDirectionalVisibilityResolverConfiguration} configuration - Geometry-only blocker configuration.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
            throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_CONFIGURATION_REQUIRED',
                'Exact directional visibility resolver configuration is required.');
        }
        rejectNonGeometricFields(configuration, 'resolver configuration');
        rejectUnknownFields(configuration, CONFIGURATION_FIELDS, 'resolver configuration');
        if (!Array.isArray(configuration.blockers)) {
            throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_BLOCKERS_REQUIRED',
                'Exact directional visibility resolver requires a blockers array.');
        }

        this.depthTieToleranceMeters = requireNonnegativeFinite(
            configuration.depthTieToleranceMeters ?? 0,
            'depthTieToleranceMeters',
        );
        this._blockers = normalizeBlockers(configuration.blockers);
        this._descriptor = freezeJsonValue({
            kind: 'exact-directional-visibility-resolver-v1',
            directionFrame: DIRECTION_FRAME,
            unitVectorTolerance: UNIT_VECTOR_TOLERANCE,
            depthTieToleranceMeters: this.depthTieToleranceMeters,
            blockerIntersectionUnits: 'm',
            blockerKinds: BLOCKER_KINDS,
            blockers: this._blockers.map((blocker) => Object.freeze({
                id: blocker.id,
                kind: blocker.kind,
                fingerprint: blocker.fingerprint,
            })),
            depthOrder: 'nearest-finite-intersection-before-source-depth',
            tieRule: 'utf16-code-unit-id-order-within-depth-tolerance',
            pointEmitterRule: 'point-emitters-are-prohibited-as-blockers',
            excludedInputs: Object.freeze([
                'brightness',
                'coverage',
                'opacity-fields',
                'radiance',
                'response-weight',
            ]),
        });
        this.fingerprint = stableHash(this._descriptor);
        Object.freeze(this);
    }

    /**
     * Describe the deterministic geometry-only visibility contract.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable resolver descriptor.
     */
    describe() {
        return Object.freeze({
            ...this._descriptor,
            fingerprint: this.fingerprint,
        });
    }

    /**
     * Prepare one point-source callback ray without retaining source radiometry.
     *
     * @param {ExactPointSourceRay} ray - Exact point-source ray from the accumulator.
     * @returns {ExactDirectionalVisibilityRay} Validated geometry-only ray.
     */
    _preparePointRay(ray) {
        requirePlainObject(ray, 'ER4C_DIRECTIONAL_VISIBILITY_POINT_RAY_REQUIRED',
            'Exact point-source visibility requires a ray object.');
        rejectNonGeometricFields(ray, 'point-source ray');
        rejectUnknownFields(ray, POINT_RAY_FIELDS, 'point-source ray');

        return createVisibilityRay({
            sourceId: requireIdentifier(ray.sourceId, 'point source id'),
            sourceKind: 'point',
            sourceFingerprint: null,
            sourceGeometry: freezeGeometry(ray.sourceGeometry, 'point source geometry'),
            directionCamera: validateDirection(ray.directionCamera),
            directionFrame: validateDirectionFrame(ray.directionFrame),
            depth: validateDepth(ray.depth),
        });
    }

    /**
     * Prepare one extended-source quadrature ray without retaining source radiometry.
     *
     * @param {ExactExtendedSampleRay} ray - Exact quadrature ray from the integrator.
     * @returns {ExactDirectionalVisibilityRay} Validated geometry-only ray.
     */
    _prepareExtendedRay(ray) {
        requirePlainObject(ray, 'ER4C_DIRECTIONAL_VISIBILITY_EXTENDED_RAY_REQUIRED',
            'Exact extended-sample visibility requires a ray object.');
        rejectNonGeometricFields(ray, 'extended-sample ray');
        rejectUnknownFields(ray, EXTENDED_RAY_FIELDS, 'extended-sample ray');
        requirePlainObject(ray.source, 'ER4C_DIRECTIONAL_VISIBILITY_EXTENDED_SOURCE_REQUIRED',
            'Exact extended-sample visibility requires a source descriptor.');
        rejectNonGeometricFields(ray.source, 'extended source descriptor');
        rejectUnknownFields(ray.source, EXTENDED_SOURCE_FIELDS, 'extended source descriptor');
        if (ray.source.kind !== 'extended') {
            throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_EXTENDED_KIND_INVALID',
                'Extended-sample visibility requires an extended source descriptor.');
        }
        if (!FINGERPRINT_PATTERN.test(ray.source.fingerprint ?? '')) {
            throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_SOURCE_FINGERPRINT_INVALID',
                'Extended-sample visibility requires a SHA-256 source fingerprint.');
        }

        return createVisibilityRay({
            sourceId: requireIdentifier(ray.source.id, 'extended source id'),
            sourceKind: 'extended',
            sourceFingerprint: ray.source.fingerprint,
            sourceGeometry: freezeGeometry(ray.source.geometry, 'extended source geometry'),
            directionCamera: validateDirection(ray.directionCamera),
            directionFrame: validateDirectionFrame(ray.directionFrame),
            depth: validateDepth(ray.depth),
        });
    }

    /**
     * Resolve one validated source ray against every registered opaque geometry owner.
     *
     * @param {ExactDirectionalVisibilityRay} ray - Validated geometry-only ray.
     * @returns {ExactDirectionalVisibilityResult} Visibility and deterministic diagnostics.
     */
    _resolve(ray) {
        const evaluations = [];
        const blockingIntersections = [];

        for (const blocker of this._blockers) {
            if (blocker.id === ray.source.id) {
                evaluations.push(Object.freeze({
                    blockerId: blocker.id,
                    blockerKind: blocker.kind,
                    blockerFingerprint: blocker.fingerprint,
                    callbackCallCount: 0,
                    intersection: null,
                    disposition: 'self-excluded',
                    depthDeltaMeters: null,
                    tieBreak: null,
                }));
                continue;
            }

            const intersection = sampleIntersection(blocker, ray);
            if (intersection === null) {
                evaluations.push(Object.freeze({
                    blockerId: blocker.id,
                    blockerKind: blocker.kind,
                    blockerFingerprint: blocker.fingerprint,
                    callbackCallCount: 1,
                    intersection: null,
                    disposition: 'clear',
                    depthDeltaMeters: null,
                    tieBreak: null,
                }));
                continue;
            }

            const comparison = compareWithSourceDepth(
                intersection.distanceMeters,
                blocker.id,
                ray.source.id,
                ray.depth,
                this.depthTieToleranceMeters,
            );
            const evaluation = Object.freeze({
                blockerId: blocker.id,
                blockerKind: blocker.kind,
                blockerFingerprint: blocker.fingerprint,
                callbackCallCount: 1,
                intersection,
                disposition: comparison.disposition,
                depthDeltaMeters: comparison.depthDeltaMeters,
                tieBreak: comparison.tieBreak,
            });
            evaluations.push(evaluation);
            if (comparison.blocks) {
                blockingIntersections.push(Object.freeze({
                    blocker,
                    evaluation,
                }));
            }
        }

        const selection = selectOccluder(
            blockingIntersections,
            this.depthTieToleranceMeters,
        );
        const diagnostics = freezeJsonValue({
            kind: 'exact-directional-visibility-resolution-v1',
            resolverFingerprint: this.fingerprint,
            source: ray.source,
            directionCamera: ray.directionCamera,
            directionFrame: ray.directionFrame,
            sourceDepth: ray.depth,
            depthTieToleranceMeters: this.depthTieToleranceMeters,
            blockerEvaluationOrder: this._blockers.map((blocker) => blocker.id),
            evaluations,
            selection: selection === null
                ? Object.freeze({
                    occluderId: null,
                    rule: 'no-blocking-intersection',
                    depthContenderIds: Object.freeze([]),
                })
                : selection.diagnostics,
            pointEmitterRule: 'point-emitters-never-enter-the-blocker-registry',
        });

        if (selection === null) {
            return Object.freeze({
                visible: true,
                occluder: null,
                diagnostics,
            });
        }

        return Object.freeze({
            visible: false,
            occluder: freezeJsonValue({
                id: selection.blocker.id,
                kind: selection.blocker.kind,
                fingerprint: selection.blocker.fingerprint,
                featureId: selection.evaluation.intersection.featureId,
                distanceMeters: selection.evaluation.intersection.distanceMeters,
                relationToSource: selection.evaluation.disposition,
                sourceDepth: ray.depth,
                tieBreak: selection.evaluation.tieBreak,
                selection: selection.diagnostics,
            }),
            diagnostics,
        });
    }

    /**
     * Resolve one exact point-source center ray for TransportedPointSourceAccumulator.
     *
     * @param {ExactPointSourceRay} ray - Exact point-source ray.
     * @returns {ExactDirectionalVisibilityResult} Geometry-only visibility result.
     */
    resolveExactSourceVisibility(ray) {
        return this._resolve(this._preparePointRay(ray));
    }

    /**
     * Resolve one exact extended-source quadrature ray for TransportedExtendedSourceIntegrator.
     *
     * @param {ExactExtendedSampleRay} ray - Exact extended quadrature ray.
     * @returns {ExactDirectionalVisibilityResult} Geometry-only visibility result.
     */
    resolveExtendedSampleVisibility(ray) {
        return this._resolve(this._prepareExtendedRay(ray));
    }
}

function normalizeBlockers(blockers) {
    const ids = new Set();
    const normalized = blockers.map((blocker, index) => {
        requirePlainObject(blocker, 'ER4C_DIRECTIONAL_VISIBILITY_BLOCKER_INVALID',
            'Every directional blocker must be an object.', { index });
        rejectNonGeometricFields(blocker, `blocker at index ${index}`);
        rejectUnknownFields(blocker, BLOCKER_FIELDS, `blocker at index ${index}`);
        const id = requireIdentifier(blocker.id, `blocker id at index ${index}`);
        if (ids.has(id)) {
            throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_DUPLICATE_BLOCKER_ID',
                'Directional blocker ids must be unique.', { id });
        }
        ids.add(id);
        if (POINT_BLOCKER_KINDS.includes(blocker.kind)) {
            throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_POINT_BLOCKER_PROHIBITED',
                'Point emitters cannot be directional blockers or consume coverage.', {
                    id,
                    kind: blocker.kind,
                });
        }
        if (!BLOCKER_KINDS.includes(blocker.kind)) {
            throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_BLOCKER_KIND_INVALID',
                'Directional blockers must be scene, globe, or opaque finite-body geometry.', {
                    id,
                    kind: blocker.kind,
                });
        }
        if (!FINGERPRINT_PATTERN.test(blocker.fingerprint ?? '')) {
            throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_BLOCKER_FINGERPRINT_INVALID',
                'Every directional blocker requires a SHA-256 fingerprint.', { id });
        }
        if (typeof blocker.intersectExactRay !== 'function') {
            throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_INTERSECTOR_REQUIRED',
                'Every directional blocker requires an intersectExactRay callback.', { id });
        }
        return Object.freeze({
            id,
            kind: blocker.kind,
            fingerprint: blocker.fingerprint.toLowerCase(),
            intersectExactRay: blocker.intersectExactRay.bind(blocker),
        });
    });

    normalized.sort((left, right) => compareIds(left.id, right.id));
    return Object.freeze(normalized);
}

function sampleIntersection(blocker, ray) {
    let rawIntersection;
    try {
        rawIntersection = blocker.intersectExactRay(ray);
    } catch (error) {
        throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_INTERSECTION_FAILED',
            'Directional blocker intersection callback failed.', {
                blockerId: blocker.id,
                cause: error instanceof Error ? error.message : String(error),
            });
    }
    if (rawIntersection === null) {
        return null;
    }
    requirePlainObject(rawIntersection,
        'ER4C_DIRECTIONAL_VISIBILITY_INTERSECTION_RESULT_INVALID',
        'Directional blocker intersection must return null or an object.', {
            blockerId: blocker.id,
        });
    rejectNonGeometricFields(rawIntersection, `intersection from ${blocker.id}`);
    rejectUnknownFields(rawIntersection, INTERSECTION_FIELDS,
        `intersection from ${blocker.id}`);
    const distanceMeters = requireNonnegativeFinite(
        rawIntersection.distanceMeters,
        `intersection distance from ${blocker.id}`,
    );
    const featureId = rawIntersection.featureId === undefined
        ? null
        : requireIdentifier(rawIntersection.featureId,
            `intersection feature id from ${blocker.id}`);
    return Object.freeze({
        distanceMeters,
        featureId,
    });
}

function compareWithSourceDepth(
    blockerDistanceMeters,
    blockerId,
    sourceId,
    sourceDepth,
    toleranceMeters,
) {
    if (sourceDepth.kind === 'infinite') {
        return Object.freeze({
            blocks: true,
            disposition: 'nearer-than-infinite-source',
            depthDeltaMeters: null,
            tieBreak: null,
        });
    }

    const depthDeltaMeters = blockerDistanceMeters - sourceDepth.distanceMeters;
    if (depthDeltaMeters < -toleranceMeters) {
        return Object.freeze({
            blocks: true,
            disposition: 'nearer-than-source',
            depthDeltaMeters,
            tieBreak: null,
        });
    }
    if (depthDeltaMeters > toleranceMeters) {
        return Object.freeze({
            blocks: false,
            disposition: 'farther-than-source',
            depthDeltaMeters,
            tieBreak: null,
        });
    }

    const blockerWins = compareIds(blockerId, sourceId) < 0;
    return Object.freeze({
        blocks: blockerWins,
        disposition: blockerWins ? 'tie-blocker-id-wins' : 'tie-source-id-wins',
        depthDeltaMeters,
        tieBreak: Object.freeze({
            applied: true,
            rule: 'utf16-code-unit-id-order',
            contenderIds: Object.freeze([blockerId, sourceId].sort(compareIds)),
            winnerId: blockerWins ? blockerId : sourceId,
        }),
    });
}

function selectOccluder(blockingIntersections, toleranceMeters) {
    if (blockingIntersections.length === 0) {
        return null;
    }
    const nearestDistanceMeters = Math.min(...blockingIntersections.map((entry) =>
        entry.evaluation.intersection.distanceMeters));
    const contenders = blockingIntersections
        .filter((entry) =>
            entry.evaluation.intersection.distanceMeters
                <= nearestDistanceMeters + toleranceMeters)
        .sort((left, right) => compareIds(left.blocker.id, right.blocker.id));
    const selected = contenders[0];
    return Object.freeze({
        blocker: selected.blocker,
        evaluation: selected.evaluation,
        diagnostics: Object.freeze({
            occluderId: selected.blocker.id,
            rule: contenders.length === 1
                ? 'nearest-blocking-depth'
                : 'nearest-depth-tolerance-then-utf16-id',
            nearestDistanceMeters,
            depthContenderIds: Object.freeze(contenders.map((entry) => entry.blocker.id)),
        }),
    });
}

function createVisibilityRay({
    sourceId,
    sourceKind,
    sourceFingerprint,
    sourceGeometry,
    directionCamera,
    directionFrame,
    depth,
}) {
    return Object.freeze({
        source: Object.freeze({
            id: sourceId,
            kind: sourceKind,
            fingerprint: sourceFingerprint,
            geometry: sourceGeometry,
        }),
        directionCamera,
        directionFrame,
        depth,
    });
}

function validateDirection(direction) {
    if (
        !Array.isArray(direction)
        || direction.length !== 3
        || !direction.every(Number.isFinite)
    ) {
        throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_DIRECTION_INVALID',
            'Directional visibility requires a finite camera-space 3-tuple.');
    }
    const length = Math.hypot(...direction);
    if (Math.abs(length - 1) > UNIT_VECTOR_TOLERANCE) {
        throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_DIRECTION_NOT_UNIT',
            'Directional visibility requires a unit camera-space direction.', { length });
    }
    return Object.freeze([...direction]);
}

function validateDirectionFrame(directionFrame) {
    if (directionFrame !== DIRECTION_FRAME) {
        throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_DIRECTION_FRAME_INVALID',
            `Directional visibility requires ${DIRECTION_FRAME}.`, {
                directionFrame,
            });
    }
    return directionFrame;
}

function validateDepth(depth) {
    requirePlainObject(depth, 'ER4C_DIRECTIONAL_VISIBILITY_DEPTH_REQUIRED',
        'Directional visibility requires finite or infinite source depth.');
    if (depth.kind === 'finite') {
        rejectUnknownFields(depth, ['kind', 'distanceMeters'], 'finite source depth');
        if (!Number.isFinite(depth.distanceMeters) || !(depth.distanceMeters > 0)) {
            throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_FINITE_DEPTH_INVALID',
                'Finite source depth must be positive and finite in meters.');
        }
        return Object.freeze({
            kind: 'finite',
            distanceMeters: depth.distanceMeters,
        });
    }
    if (depth.kind === 'infinite') {
        rejectUnknownFields(depth, ['kind'], 'infinite source depth');
        return Object.freeze({ kind: 'infinite' });
    }
    throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_DEPTH_KIND_INVALID',
        'Directional visibility source depth kind must be finite or infinite.');
}

function freezeGeometry(geometry, context) {
    requirePlainObject(geometry, 'ER4C_DIRECTIONAL_VISIBILITY_GEOMETRY_REQUIRED',
        'Directional visibility requires source geometry ownership metadata.', {
            context,
        });
    try {
        return freezeJsonValue(geometry);
    } catch (error) {
        throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_GEOMETRY_INVALID',
            'Directional visibility source geometry must be finite JSON metadata.', {
                context,
                cause: error instanceof Error ? error.message : String(error),
            });
    }
}

function requireIdentifier(value, context) {
    if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) {
        throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_ID_INVALID',
            'Directional visibility ids must be non-empty strings without outer whitespace.', {
                context,
                value,
            });
    }
    return value;
}

function requireNonnegativeFinite(value, context) {
    if (!Number.isFinite(value) || value < 0) {
        throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_DISTANCE_INVALID',
            'Directional visibility distances and tolerances must be finite and nonnegative.', {
                context,
                value,
            });
    }
    return Object.is(value, -0) ? 0 : value;
}

function requirePlainObject(value, code, message, details = null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw configurationError(code, message, details);
    }
}

function rejectNonGeometricFields(value, context) {
    const found = NON_GEOMETRIC_FIELDS.filter((field) => Object.hasOwn(value, field));
    if (found.length > 0) {
        throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_NON_GEOMETRIC_FIELD_PROHIBITED',
            'Directional visibility does not accept brightness, coverage, opacity, or response fields.', {
                context,
                fields: found,
            });
    }
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER4C_DIRECTIONAL_VISIBILITY_FIELD_UNSUPPORTED',
            'Directional visibility received unsupported fields.', {
                context,
                fields: unknown,
            });
    }
}

function compareIds(left, right) {
    if (left < right) {
        return -1;
    }
    if (left > right) {
        return 1;
    }
    return 0;
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
