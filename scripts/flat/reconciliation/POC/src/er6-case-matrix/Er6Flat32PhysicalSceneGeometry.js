// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   geometry/depth ownership remains independent of source radiometry.
// - er6Flat32PhysicalSceneGeometryConsts.js, reset-owned bounded scene facts.
// - ExactDirectionalVisibilityResolver.js, accepted ER4C exact-ray blocker contract.

import ExactDirectionalVisibilityResolver from '../directional-visibility/ExactDirectionalVisibilityResolver.js';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import {
    ER6_FLAT32_SCENE_GEOMETRY_FACTS,
    ER6_FLAT32_SCENE_GEOMETRY_PROVENANCE,
} from './er6Flat32PhysicalSceneGeometryConsts.js';

const CAMERA_DIRECTION_FRAME = 'camera-space-unit-vector-forward-minus-z';
const CAMERA_MATRIX_CONVENTION =
    'row-major-direction-camera-equals-matrix-times-source-direction-j2000';
const SOURCE_FRAME = 'earth-centered-ecliptic-j2000';
const ROTATION_TOLERANCE = 1e-12;
const RAY_EPSILON_SCENE_UNITS = 1e-12;
const CONFIGURATION_FIELDS = Object.freeze([
    'observerBasis',
    'presentationDirectionScene',
    'depthTieToleranceMeters',
]);
const BASIS_FIELDS = Object.freeze([
    'up',
    'east',
    'north',
    'pole',
    'equatorialRadial',
]);
const BASE_RAY_FIELDS = Object.freeze([
    'directionCamera',
]);
const CAMERA_TRANSFORM_FIELDS = Object.freeze([
    'physicalStateFingerprint',
    'sourceFrame',
    'sourceDirectionJ2000',
]);
const MOON_BLOCKER_FIELDS = Object.freeze([
    'sourceId',
    'centerDirectionCamera',
    'finiteBodyCenterDepthMeters',
    'angularRadiusRadians',
]);
const VISIBILITY_FIELDS = Object.freeze([
    ...MOON_BLOCKER_FIELDS,
]);

export default class Er6Flat32PhysicalSceneGeometry {
    /**
     * Create the reset-owned ER6 camera transform and finite scene geometry.
     *
     * The observer basis rows map ecliptic J2000 directions to Algorithm32's
     * `[up, east, north]` atmosphere frame. The frozen Flat32 presentation
     * direction supplies camera orientation but never changes physical source
     * directions.
     *
     * @param {Readonly<Record<string, unknown>>} configuration - Observer basis, optional frozen presentation direction, and depth tie tolerance.
     */
    constructor(configuration) {
        requirePlainObject(configuration, 'ER6_SCENE_GEOMETRY_CONFIGURATION_REQUIRED',
            'ER6 physical scene geometry configuration is required.');
        rejectUnknownFields(configuration, CONFIGURATION_FIELDS, 'scene geometry configuration');

        this.depthTieToleranceMeters = requireNonnegativeFinite(
            configuration.depthTieToleranceMeters ?? 1e-6,
            'depthTieToleranceMeters',
        );
        this._observerBasis = validateObserverBasis(configuration.observerBasis);
        this._presentationDirectionScene = validateFrozenPresentationDirection(
            configuration.presentationDirectionScene
                ?? ER6_FLAT32_SCENE_GEOMETRY_FACTS.presentationFrame.directionScene,
        );
        this._cameraPositionSceneUnits =
            ER6_FLAT32_SCENE_GEOMETRY_FACTS.camera.positionSceneUnits;
        this._transforms = createTransforms(
            this._observerBasis,
            this._presentationDirectionScene,
        );
        this._reviewBoxes = createReviewBoxes(this._presentationDirectionScene);
        this._baseGeometry = createBaseGeometryDescriptors(this._reviewBoxes);
        this._factsFingerprint = stableHash({
            provenance: ER6_FLAT32_SCENE_GEOMETRY_PROVENANCE,
            facts: ER6_FLAT32_SCENE_GEOMETRY_FACTS,
        });
        this._descriptor = freezeJsonValue({
            kind: 'er6-flat32-physical-scene-geometry-v1',
            provenance: ER6_FLAT32_SCENE_GEOMETRY_PROVENANCE,
            factsFingerprint: this._factsFingerprint,
            units: ER6_FLAT32_SCENE_GEOMETRY_FACTS.units,
            presentationFrame: Object.freeze({
                ...ER6_FLAT32_SCENE_GEOMETRY_FACTS.presentationFrame,
                normalizedDirectionScene: this._presentationDirectionScene,
            }),
            camera: ER6_FLAT32_SCENE_GEOMETRY_FACTS.camera,
            transforms: this._transforms,
            globeGround: this._baseGeometry[0],
            reviewBoxes: this._reviewBoxes,
            baseEndpointPolicy:
                'nearest-exact-ground-or-oriented-review-box-depth-with-geometry-only-object-id',
            baseEndpointRadiometry:
                'absent-zero-spectral-endpoint-authored-display-rgb-is-not-physical-reflectance',
            moonBlockerPolicy:
                'finite-sphere-from-same-source-id-center-depth-direction-and-angular-radius',
            directionalVisibilityOwner: 'ExactDirectionalVisibilityResolver',
            depthTieToleranceMeters: this.depthTieToleranceMeters,
        });
        this.fingerprint = stableHash(this._descriptor);
        Object.freeze(this);
    }

    /**
     * Return immutable camera, transform, geometry, provenance, and qualification facts.
     *
     * @returns {Readonly<Record<string, unknown>>} Geometry descriptor.
     */
    describe() {
        return Object.freeze({
            ...this._descriptor,
            fingerprint: this.fingerprint,
        });
    }

    /**
     * Convert one camera-space direction to the Algorithm32 atmosphere frame.
     *
     * @param {readonly number[]} directionCamera - Unit camera direction with forward along negative z.
     * @returns {readonly number[]} Unit `[up, east, north]` atmosphere direction.
     */
    cameraDirectionToAtmosphere(directionCamera) {
        return transformUnitDirection(
            this._transforms.cameraToAtmosphereRotationMatrix,
            directionCamera,
            'camera direction',
        );
    }

    /**
     * Convert one camera-space direction to the frozen Flat32 scene frame.
     *
     * @param {readonly number[]} directionCamera - Unit camera direction with forward along negative z.
     * @returns {readonly number[]} Unit Flat32 scene direction.
     */
    cameraDirectionToScene(directionCamera) {
        return transformUnitDirection(
            this._transforms.cameraToSceneRotationMatrix,
            directionCamera,
            'camera direction',
        );
    }

    /**
     * Convert one ecliptic-J2000 direction directly to camera space.
     *
     * @param {readonly number[]} directionJ2000 - Unit ecliptic-J2000 direction.
     * @returns {readonly number[]} Unit camera-space direction.
     */
    j2000DirectionToCamera(directionJ2000) {
        return transformUnitDirection(
            this._transforms.j2000ToCameraRotationMatrix,
            directionJ2000,
            'ecliptic-J2000 direction',
        );
    }

    /**
     * Build the exact transform packet consumed by reset-owned physical sources.
     *
     * @param {Readonly<Record<string, unknown>>} request - Physical-state identity, source frame, and exact source direction.
     * @returns {Readonly<Record<string, unknown>>} Immutable physical-state camera transform.
     */
    createPhysicalStateCameraTransform(request) {
        requirePlainObject(request, 'ER6_SCENE_CAMERA_TRANSFORM_REQUEST_REQUIRED',
            'ER6 physical-state camera transform request is required.');
        rejectUnknownFields(request, CAMERA_TRANSFORM_FIELDS, 'camera transform request');
        const physicalStateFingerprint = requireFingerprint(
            request.physicalStateFingerprint,
            'physicalStateFingerprint',
        );
        if (request.sourceFrame !== SOURCE_FRAME) {
            throw configurationError('ER6_SCENE_CAMERA_SOURCE_FRAME_INVALID',
                `ER6 physical-state camera transforms require ${SOURCE_FRAME}.`, {
                    sourceFrame: request.sourceFrame,
                });
        }
        const sourceDirectionJ2000 = validateUnitDirection(
            request.sourceDirectionJ2000,
            'sourceDirectionJ2000',
        );
        const transformCore = freezeJsonValue({
            kind: 'physical-state-to-camera-transform-v1',
            physicalStateFingerprint,
            sourceFrame: SOURCE_FRAME,
            sourceDirectionJ2000,
            j2000ToCameraRotationMatrix:
                this._transforms.j2000ToCameraRotationMatrix,
            matrixConvention: CAMERA_MATRIX_CONVENTION,
            cameraDirectionFrame: CAMERA_DIRECTION_FRAME,
        });

        return transformCore;
    }

    /**
     * Resolve the nearest physical base endpoint for one camera ray.
     *
     * Ground and all six review boxes participate. The result owns geometry
     * and depth only; no authored RGB value is interpreted as spectral
     * reflectance or endpoint radiance.
     *
     * @param {Readonly<Record<string, unknown>>} request - Exact camera direction.
     * @returns {Readonly<Record<string, unknown>>} Atmosphere ray and nearest base endpoint.
     */
    resolveBaseRay(request) {
        requirePlainObject(request, 'ER6_SCENE_BASE_RAY_REQUEST_REQUIRED',
            'ER6 base-ray request is required.');
        rejectUnknownFields(request, BASE_RAY_FIELDS, 'base-ray request');
        const directionCamera = validateUnitDirection(
            request.directionCamera,
            'directionCamera',
        );
        const directionScene = this.cameraDirectionToScene(directionCamera);
        const directionAtmosphere = this.cameraDirectionToAtmosphere(directionCamera);
        const intersections = this._baseGeometry
            .map((geometry) => intersectGeometry(
                geometry,
                this._cameraPositionSceneUnits,
                directionScene,
            ))
            .filter((entry) => entry !== null);
        const selection = selectNearestIntersection(
            intersections,
            this.depthTieToleranceMeters,
        );
        const atmosphereRay = freezeJsonValue({
            origin: Object.freeze([
                ER6_FLAT32_SCENE_GEOMETRY_FACTS.globeGround.radiusSceneUnits
                    * ER6_FLAT32_SCENE_GEOMETRY_FACTS.units.metersPerSceneUnit
                    + this._cameraPositionSceneUnits[1]
                        * ER6_FLAT32_SCENE_GEOMETRY_FACTS.units.metersPerSceneUnit,
                0,
                0,
            ]),
            direction: directionAtmosphere,
        });

        return freezeJsonValue({
            kind: 'er6-flat32-physical-base-ray-v1',
            geometryFingerprint: this.fingerprint,
            directionCamera,
            directionFrame: CAMERA_DIRECTION_FRAME,
            directionScene,
            atmosphereRay,
            sceneIntersection: selection === null
                ? Object.freeze({ kind: 'no-hit' })
                : Object.freeze({
                    kind: 'hit',
                    objectId: selection.objectId,
                    featureId: selection.featureId,
                    distanceMeters: selection.distanceMeters,
                    pointSceneUnits: selection.pointSceneUnits,
                    pointAtmosphereMeters: mapScenePointToAtmosphere(
                        selection.pointSceneUnits,
                    ),
                    tieRule: selection.tieRule,
                    contenderIds: selection.contenderIds,
                }),
            endpointContribution: null,
            endpointQualification:
                'geometry-only-base-depth-authored-rgb-has-zero-physical-spectral-endpoint',
        });
    }

    /**
     * Create geometry-only exact-ray blockers for ground, six boxes, and Moon.
     *
     * The Moon blocker id must be the caller's extended-source id so the
     * accepted resolver self-excludes it while integrating Moon directions.
     *
     * @param {Readonly<Record<string, unknown>>} request - Moon source identity and finite disk geometry.
     * @returns {readonly Readonly<Record<string, unknown>>[]} Exact-ray blocker callbacks.
     */
    createDirectionalBlockers(request) {
        const moon = validateMoonBlockerRequest(request);
        const moonGeometry = createMoonGeometry(moon, this);
        const allGeometry = Object.freeze([
            ...this._baseGeometry,
            moonGeometry,
        ]);

        return Object.freeze(allGeometry.map((geometry) => Object.freeze({
            id: geometry.objectId,
            kind: geometry.kind === 'moon-sphere'
                ? 'opaque-finite-body'
                : geometry.kind === 'ground-sphere' ? 'globe' : 'scene',
            fingerprint: geometry.fingerprint,
            intersectExactRay: (ray) => {
                const directionCamera = validateUnitDirection(
                    ray?.directionCamera,
                    'directional blocker camera direction',
                );
                const intersection = intersectGeometry(
                    geometry,
                    this._cameraPositionSceneUnits,
                    this.cameraDirectionToScene(directionCamera),
                );
                return intersection === null
                    ? null
                    : Object.freeze({
                        distanceMeters: intersection.distanceMeters,
                        featureId: intersection.featureId,
                    });
            },
        })));
    }

    /**
     * Create the accepted exact-direction resolver over the complete ER6 blocker set.
     *
     * @param {Readonly<Record<string, unknown>>} request - Moon source identity and finite disk geometry.
     * @returns {ExactDirectionalVisibilityResolver} Geometry-only visibility resolver.
     */
    createDirectionalVisibilityResolver(request) {
        requirePlainObject(request, 'ER6_SCENE_VISIBILITY_REQUEST_REQUIRED',
            'ER6 directional visibility request is required.');
        rejectUnknownFields(request, VISIBILITY_FIELDS, 'directional visibility request');
        return new ExactDirectionalVisibilityResolver({
            blockers: this.createDirectionalBlockers(request),
            depthTieToleranceMeters: this.depthTieToleranceMeters,
        });
    }
}

function validateObserverBasis(value) {
    requirePlainObject(value, 'ER6_SCENE_OBSERVER_BASIS_REQUIRED',
        'ER6 scene geometry requires an observer-local basis.');
    rejectUnknownFields(value, BASIS_FIELDS, 'observer basis');
    const basis = freezeJsonValue({
        up: validateUnitDirection(value.up, 'observerBasis.up'),
        east: validateUnitDirection(value.east, 'observerBasis.east'),
        north: validateUnitDirection(value.north, 'observerBasis.north'),
    });
    validateRotationMatrix(
        [basis.up, basis.east, basis.north],
        'J2000-to-atmosphere observer-basis matrix',
    );
    return basis;
}

function validateFrozenPresentationDirection(value) {
    const direction = validateUnitDirection(value, 'presentationDirectionScene', 1e-9);
    const expected = normalize(
        ER6_FLAT32_SCENE_GEOMETRY_FACTS.presentationFrame.directionScene,
        'frozen presentation direction',
    );
    const maximumDifference = Math.max(...direction.map(
        (entry, index) => Math.abs(entry - expected[index]),
    ));
    if (maximumDifference
        > ER6_FLAT32_SCENE_GEOMETRY_FACTS.presentationFrame.directionTolerance) {
        throw configurationError('ER6_SCENE_PRESENTATION_FRAME_MOVED',
            'ER6 camera orientation must retain the frozen Flat32 presentation direction.', {
                maximumDifference,
                tolerance:
                    ER6_FLAT32_SCENE_GEOMETRY_FACTS.presentationFrame.directionTolerance,
            });
    }
    return expected;
}

function createTransforms(observerBasis, presentationDirectionScene) {
    const j2000ToAtmosphere = freezeMatrix([
        observerBasis.up,
        observerBasis.east,
        observerBasis.north,
    ]);
    const atmosphereToScene = freezeMatrix([
        [0, 1, 0],
        [1, 0, 0],
        [0, 0, -1],
    ]);
    const cameraRightScene = normalize(
        cross(presentationDirectionScene, [0, 1, 0]),
        'camera right direction',
    );
    const cameraUpScene = normalize(
        cross(cameraRightScene, presentationDirectionScene),
        'camera up direction',
    );
    const sceneToCamera = freezeMatrix([
        cameraRightScene,
        cameraUpScene,
        scale(presentationDirectionScene, -1),
    ]);
    const atmosphereToCamera = multiplyMatrices(
        sceneToCamera,
        atmosphereToScene,
    );
    const j2000ToCamera = multiplyMatrices(
        atmosphereToCamera,
        j2000ToAtmosphere,
    );
    const cameraToAtmosphere = transpose(atmosphereToCamera);
    const cameraToScene = transpose(sceneToCamera);
    const cameraToJ2000 = transpose(j2000ToCamera);

    const matrices = Object.freeze({
        j2000ToAtmosphereRotationMatrix: j2000ToAtmosphere,
        atmosphereToSceneRotationMatrix: atmosphereToScene,
        sceneToCameraRotationMatrix: sceneToCamera,
        atmosphereToCameraRotationMatrix: atmosphereToCamera,
        j2000ToCameraRotationMatrix: j2000ToCamera,
        cameraToAtmosphereRotationMatrix: cameraToAtmosphere,
        cameraToSceneRotationMatrix: cameraToScene,
        cameraToJ2000RotationMatrix: cameraToJ2000,
    });
    const rotationDiagnostics = Object.freeze(Object.fromEntries(
        Object.entries(matrices).map(([name, matrix]) => [
            name,
            validateRotationMatrix(matrix, name),
        ]),
    ));
    const inverseDiagnostics = freezeJsonValue({
        atmosphereCameraMaximumIdentityResidual: maximumIdentityResidual(
            multiplyMatrices(atmosphereToCamera, cameraToAtmosphere),
        ),
        sceneCameraMaximumIdentityResidual: maximumIdentityResidual(
            multiplyMatrices(sceneToCamera, cameraToScene),
        ),
        j2000CameraMaximumIdentityResidual: maximumIdentityResidual(
            multiplyMatrices(j2000ToCamera, cameraToJ2000),
        ),
    });
    const recoveredPresentationDirection = transformUnitDirection(
        cameraToScene,
        [0, 0, -1],
        'camera forward direction',
    );
    const presentationForwardMaximumResidual = Math.max(
        ...recoveredPresentationDirection.map((entry, index) =>
            Math.abs(entry - presentationDirectionScene[index])),
    );
    const maximumInverseResidual = Math.max(...Object.values(inverseDiagnostics));
    if (
        maximumInverseResidual > ROTATION_TOLERANCE
        || presentationForwardMaximumResidual > ROTATION_TOLERANCE
    ) {
        throw configurationError('ER6_SCENE_CAMERA_TRANSFORM_INVERSE_FAILED',
            'ER6 camera transforms must remain exact proper-rotation inverses and preserve the frozen presentation direction.', {
                maximumInverseResidual,
                presentationForwardMaximumResidual,
                tolerance: ROTATION_TOLERANCE,
            });
    }

    return freezeJsonValue({
        convention: Object.freeze({
            observerBasisRows: '[up,east,north]',
            atmosphereToScene:
                'scene=[east,up,-north]',
            sceneToCameraRows: '[right,up,-forward]',
            j2000ToCamera: 'C*S*B',
            cameraToAtmosphere: 'transpose(C*S)',
            cameraToScene: 'transpose(C)',
            cameraDirectionFrame: CAMERA_DIRECTION_FRAME,
        }),
        ...matrices,
        rotationDiagnostics,
        inverseDiagnostics,
        presentationDirectionScene,
        cameraRightScene,
        cameraUpScene,
        recoveredPresentationDirection,
        presentationForwardMaximumResidual,
        tolerance: ROTATION_TOLERANCE,
    });
}

function createReviewBoxes(presentationDirectionScene) {
    const horizontalForwardScene = normalize(
        [presentationDirectionScene[0], presentationDirectionScene[2]],
        'presentation horizontal direction',
    );
    const horizontalRightScene = Object.freeze([
        -horizontalForwardScene[1],
        horizontalForwardScene[0],
    ]);
    const yawRadians = Math.atan2(
        -horizontalForwardScene[0],
        -horizontalForwardScene[1],
    );
    const radiusSceneUnits =
        ER6_FLAT32_SCENE_GEOMETRY_FACTS.globeGround.radiusSceneUnits;

    return Object.freeze(ER6_FLAT32_SCENE_GEOMETRY_FACTS.reviewBoxes.map((box) => {
        const localRight = box.centerXZ[0];
        const localForward = -box.centerXZ[1];
        const offset = Object.freeze([
            horizontalRightScene[0] * localRight
                + horizontalForwardScene[0] * localForward,
            horizontalRightScene[1] * localRight
                + horizontalForwardScene[1] * localForward,
        ]);
        const heightAboveGround = box.sizeSceneUnits[1] * 0.5;
        const horizontalDistanceSquared = offset[0] ** 2 + offset[1] ** 2;
        const radialY = Math.sqrt(Math.max(
            0,
            radiusSceneUnits ** 2 - horizontalDistanceSquared,
        ));
        const heightScale = heightAboveGround / radiusSceneUnits;
        const positionSceneUnits = Object.freeze([
            offset[0] * (1 + heightScale),
            -radiusSceneUnits + radialY * (1 + heightScale),
            offset[1] * (1 + heightScale),
        ]);

        return freezeJsonValue({
            kind: 'oriented-review-box',
            objectId: box.objectId,
            copiedCenterXZ: box.centerXZ,
            sizeSceneUnits: box.sizeSceneUnits,
            positionSceneUnits,
            rotationYRadians: yawRadians,
            placementPolicy:
                'frozen-presentation-yaw-plus-spherical-ground-radial-height-offset',
        });
    }));
}

function createBaseGeometryDescriptors(reviewBoxes) {
    const ground = ER6_FLAT32_SCENE_GEOMETRY_FACTS.globeGround;
    const groundCore = freezeJsonValue({
        kind: 'ground-sphere',
        objectId: ground.objectId,
        centerSceneUnits: ground.centerSceneUnits,
        radiusSceneUnits: ground.radiusSceneUnits,
        featureId: `${ground.objectId}-surface`,
    });
    const groundDescriptor = Object.freeze({
        ...groundCore,
        fingerprint: stableHash(groundCore),
    });
    const boxDescriptors = reviewBoxes.map((box) => {
        const core = freezeJsonValue({
            kind: box.kind,
            objectId: box.objectId,
            centerSceneUnits: box.positionSceneUnits,
            sizeSceneUnits: box.sizeSceneUnits,
            rotationYRadians: box.rotationYRadians,
            featureId: `${box.objectId}-surface`,
        });
        return Object.freeze({
            ...core,
            fingerprint: stableHash(core),
        });
    });
    return Object.freeze([groundDescriptor, ...boxDescriptors]);
}

function validateMoonBlockerRequest(request) {
    requirePlainObject(request, 'ER6_SCENE_MOON_BLOCKER_REQUEST_REQUIRED',
        'ER6 Moon blocker request is required.');
    rejectUnknownFields(request, MOON_BLOCKER_FIELDS, 'Moon blocker request');
    const sourceId = requireIdentifier(request.sourceId, 'Moon source id');
    const centerDirectionCamera = validateUnitDirection(
        request.centerDirectionCamera,
        'Moon centerDirectionCamera',
    );
    const finiteBodyCenterDepthMeters = requirePositiveFinite(
        request.finiteBodyCenterDepthMeters,
        'Moon finiteBodyCenterDepthMeters',
    );
    const angularRadiusRadians = requirePositiveFinite(
        request.angularRadiusRadians,
        'Moon angularRadiusRadians',
    );
    if (angularRadiusRadians >= Math.PI / 2) {
        throw configurationError('ER6_SCENE_MOON_ANGULAR_RADIUS_INVALID',
            'ER6 Moon angular radius must be smaller than pi/2 radians.', {
                angularRadiusRadians,
            });
    }
    return Object.freeze({
        sourceId,
        centerDirectionCamera,
        finiteBodyCenterDepthMeters,
        angularRadiusRadians,
    });
}

function createMoonGeometry(moon, owner) {
    const metersPerSceneUnit =
        ER6_FLAT32_SCENE_GEOMETRY_FACTS.units.metersPerSceneUnit;
    const distanceSceneUnits = moon.finiteBodyCenterDepthMeters / metersPerSceneUnit;
    const radiusSceneUnits = distanceSceneUnits * Math.sin(moon.angularRadiusRadians);
    const directionScene = owner.cameraDirectionToScene(moon.centerDirectionCamera);
    const centerSceneUnits = Object.freeze(owner._cameraPositionSceneUnits.map(
        (entry, index) => entry + directionScene[index] * distanceSceneUnits,
    ));
    const core = freezeJsonValue({
        kind: 'moon-sphere',
        objectId: moon.sourceId,
        centerSceneUnits,
        radiusSceneUnits,
        directionCamera: moon.centerDirectionCamera,
        directionScene,
        finiteBodyCenterDepthMeters: moon.finiteBodyCenterDepthMeters,
        angularRadiusRadians: moon.angularRadiusRadians,
        radiusDerivation: 'R=distance*sin(angularRadius)',
        featureId: `${moon.sourceId}-surface`,
        selfExclusionPolicy:
            'blocker-id-equals-extended-source-id',
    });
    return Object.freeze({
        ...core,
        fingerprint: stableHash(core),
    });
}

function intersectGeometry(geometry, originScene, directionScene) {
    const distanceSceneUnits = geometry.kind === 'oriented-review-box'
        ? intersectOrientedBox(originScene, directionScene, geometry)
        : intersectSphere(
            originScene,
            directionScene,
            geometry.centerSceneUnits,
            geometry.radiusSceneUnits,
        );
    if (distanceSceneUnits === null) {
        return null;
    }
    const metersPerSceneUnit =
        ER6_FLAT32_SCENE_GEOMETRY_FACTS.units.metersPerSceneUnit;
    return freezeJsonValue({
        objectId: geometry.objectId,
        featureId: geometry.featureId,
        distanceMeters: distanceSceneUnits * metersPerSceneUnit,
        pointSceneUnits: Object.freeze(originScene.map(
            (entry, index) => entry + directionScene[index] * distanceSceneUnits,
        )),
    });
}

function intersectSphere(origin, direction, center, radius) {
    const offset = subtract(origin, center);
    const projectedDistance = dot(offset, direction);
    const discriminant = projectedDistance ** 2
        - (dot(offset, offset) - radius ** 2);
    if (discriminant < 0) {
        return null;
    }
    const root = Math.sqrt(Math.max(0, discriminant));
    const nearDistance = -projectedDistance - root;
    if (nearDistance > RAY_EPSILON_SCENE_UNITS) {
        return nearDistance;
    }
    const farDistance = -projectedDistance + root;
    return farDistance > RAY_EPSILON_SCENE_UNITS ? farDistance : null;
}

function intersectOrientedBox(origin, direction, box) {
    const offset = subtract(origin, box.centerSceneUnits);
    const cosine = Math.cos(box.rotationYRadians);
    const sine = Math.sin(box.rotationYRadians);
    const localOrigin = Object.freeze([
        cosine * offset[0] - sine * offset[2],
        offset[1],
        sine * offset[0] + cosine * offset[2],
    ]);
    const localDirection = Object.freeze([
        cosine * direction[0] - sine * direction[2],
        direction[1],
        sine * direction[0] + cosine * direction[2],
    ]);
    let minimumDistance = -Infinity;
    let maximumDistance = Infinity;

    for (let axis = 0; axis < 3; axis += 1) {
        const halfExtent = box.sizeSceneUnits[axis] * 0.5;
        if (Math.abs(localDirection[axis]) <= RAY_EPSILON_SCENE_UNITS) {
            if (localOrigin[axis] < -halfExtent || localOrigin[axis] > halfExtent) {
                return null;
            }
            continue;
        }
        const inverseDirection = 1 / localDirection[axis];
        let first = (-halfExtent - localOrigin[axis]) * inverseDirection;
        let second = (halfExtent - localOrigin[axis]) * inverseDirection;
        if (first > second) {
            [first, second] = [second, first];
        }
        minimumDistance = Math.max(minimumDistance, first);
        maximumDistance = Math.min(maximumDistance, second);
        if (maximumDistance < minimumDistance) {
            return null;
        }
    }

    if (minimumDistance > RAY_EPSILON_SCENE_UNITS) {
        return minimumDistance;
    }
    return maximumDistance > RAY_EPSILON_SCENE_UNITS ? maximumDistance : null;
}

function selectNearestIntersection(intersections, toleranceMeters) {
    if (intersections.length === 0) {
        return null;
    }
    const nearestDistanceMeters = Math.min(...intersections.map(
        (entry) => entry.distanceMeters,
    ));
    const contenders = intersections
        .filter((entry) => entry.distanceMeters <= nearestDistanceMeters + toleranceMeters)
        .sort((left, right) => compareIds(left.objectId, right.objectId));
    return freezeJsonValue({
        ...contenders[0],
        tieRule: contenders.length === 1
            ? 'nearest-depth'
            : 'nearest-depth-tolerance-then-utf16-id',
        contenderIds: contenders.map((entry) => entry.objectId),
    });
}

function mapScenePointToAtmosphere(pointSceneUnits) {
    const metersPerSceneUnit =
        ER6_FLAT32_SCENE_GEOMETRY_FACTS.units.metersPerSceneUnit;
    const radiusMeters =
        ER6_FLAT32_SCENE_GEOMETRY_FACTS.globeGround.radiusSceneUnits
        * metersPerSceneUnit;
    return Object.freeze([
        radiusMeters + pointSceneUnits[1] * metersPerSceneUnit,
        pointSceneUnits[0] * metersPerSceneUnit,
        -pointSceneUnits[2] * metersPerSceneUnit,
    ]);
}

function transformUnitDirection(matrix, value, label) {
    const direction = validateUnitDirection(value, label);
    return validateUnitDirection(
        matrix.map((row) => dot(row, direction)),
        `transformed ${label}`,
    );
}

function validateUnitDirection(value, label, tolerance = ROTATION_TOLERANCE) {
    if (
        !Array.isArray(value)
        || value.length !== 3
        || !value.every(Number.isFinite)
    ) {
        throw configurationError('ER6_SCENE_DIRECTION_INVALID',
            'ER6 scene directions must be finite three-vectors.', { label });
    }
    const length = Math.hypot(...value);
    if (Math.abs(length - 1) > tolerance) {
        throw configurationError('ER6_SCENE_DIRECTION_NOT_UNIT',
            'ER6 scene directions must be unit length.', {
                label,
                length,
                tolerance,
            });
    }
    return Object.freeze([...value]);
}

function validateRotationMatrix(matrix, label) {
    const value = freezeMatrix(matrix);
    const maximumRowNormResidual = Math.max(...value.map((row) =>
        Math.abs(Math.hypot(...row) - 1)));
    const maximumOrthogonalityResidual = Math.max(
        Math.abs(dot(value[0], value[1])),
        Math.abs(dot(value[0], value[2])),
        Math.abs(dot(value[1], value[2])),
    );
    const determinantResidual = Math.abs(determinant3(value) - 1);
    if (
        maximumRowNormResidual > ROTATION_TOLERANCE
        || maximumOrthogonalityResidual > ROTATION_TOLERANCE
        || determinantResidual > ROTATION_TOLERANCE
    ) {
        throw configurationError('ER6_SCENE_ROTATION_MATRIX_INVALID',
            'ER6 camera transforms must be proper orthonormal rotations.', {
                label,
                maximumRowNormResidual,
                maximumOrthogonalityResidual,
                determinantResidual,
                tolerance: ROTATION_TOLERANCE,
            });
    }
    return Object.freeze({
        maximumRowNormResidual,
        maximumOrthogonalityResidual,
        determinantResidual,
        status: 'accepted',
    });
}

function freezeMatrix(value) {
    if (
        !Array.isArray(value)
        || value.length !== 3
        || !value.every((row) =>
            Array.isArray(row)
            && row.length === 3
            && row.every(Number.isFinite))
    ) {
        throw configurationError('ER6_SCENE_MATRIX_INVALID',
            'ER6 scene matrices must be finite row-major 3-by-3 arrays.');
    }
    return Object.freeze(value.map((row) => Object.freeze([...row])));
}

function multiplyMatrices(left, right) {
    const result = left.map((row) => right[0].map((_, columnIndex) =>
        row.reduce((sum, entry, rowIndex) =>
            sum + entry * right[rowIndex][columnIndex], 0)));
    return freezeMatrix(result);
}

function transpose(matrix) {
    return freezeMatrix(matrix[0].map((_, columnIndex) =>
        matrix.map((row) => row[columnIndex])));
}

function maximumIdentityResidual(matrix) {
    return Math.max(...matrix.flatMap((row, rowIndex) => row.map(
        (entry, columnIndex) => Math.abs(entry - (rowIndex === columnIndex ? 1 : 0)),
    )));
}

function determinant3(matrix) {
    return matrix[0][0] * (
        matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]
    ) - matrix[0][1] * (
        matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]
    ) + matrix[0][2] * (
        matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]
    );
}

function normalize(value, label) {
    if (!Array.isArray(value) || ![2, 3].includes(value.length) || !value.every(Number.isFinite)) {
        throw configurationError('ER6_SCENE_VECTOR_INVALID',
            'ER6 scene vector normalization requires two or three finite components.', {
                label,
            });
    }
    const length = Math.hypot(...value);
    if (!(length > 0)) {
        throw configurationError('ER6_SCENE_ZERO_VECTOR',
            'ER6 scene vector normalization prohibits zero-length vectors.', {
                label,
            });
    }
    return Object.freeze(value.map((entry) => entry / length));
}

function dot(left, right) {
    return left.reduce((sum, entry, index) => sum + entry * right[index], 0);
}

function cross(left, right) {
    return Object.freeze([
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ]);
}

function scale(value, scalar) {
    return Object.freeze(value.map((entry) => entry * scalar));
}

function subtract(left, right) {
    return Object.freeze(left.map((entry, index) => entry - right[index]));
}

function requirePlainObject(value, code, message) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw configurationError(code, message);
    }
}

function rejectUnknownFields(value, allowedFields, context) {
    const fields = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (fields.length > 0) {
        throw configurationError('ER6_SCENE_FIELD_UNSUPPORTED',
            'ER6 physical scene geometry received unsupported fields.', {
                context,
                fields,
            });
    }
}

function requireFingerprint(value, label) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
        throw configurationError('ER6_SCENE_FINGERPRINT_INVALID',
            'ER6 physical scene geometry requires SHA-256 fingerprints.', {
                label,
                value,
            });
    }
    return value.toLowerCase();
}

function requireIdentifier(value, label) {
    if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) {
        throw configurationError('ER6_SCENE_IDENTIFIER_INVALID',
            'ER6 physical scene geometry identifiers must be non-empty without outer whitespace.', {
                label,
                value,
            });
    }
    return value;
}

function requirePositiveFinite(value, label) {
    if (!Number.isFinite(value) || value <= 0) {
        throw configurationError('ER6_SCENE_POSITIVE_VALUE_REQUIRED',
            'ER6 physical scene geometry requires positive finite values.', {
                label,
                value,
            });
    }
    return value;
}

function requireNonnegativeFinite(value, label) {
    if (!Number.isFinite(value) || value < 0) {
        throw configurationError('ER6_SCENE_NONNEGATIVE_VALUE_REQUIRED',
            'ER6 physical scene geometry requires nonnegative finite values.', {
                label,
                value,
            });
    }
    return Object.is(value, -0) ? 0 : value;
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
