// Bounded reset-owned copies from:
// - src/flat32/index.js @ 514d5f6080d2dd485efdb07b5da9a203357a40c0.
// - scripts/flat/reconciliation/POC/src/subjective-scenes/flat32SceneSnapshot.js.
// - scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32SceneStateResolver.js.
// - scripts/flat/reconciliation/POC/src/scenes/planetSphereSceneDefinition.js.
//
// This module owns only the immutable geometry facts required by ER6. It has
// no runtime link to Flat32, the pre-reset renderer, or production code.

export const ER6_FLAT32_SCENE_GEOMETRY_PROVENANCE = Object.freeze({
    kind: 'er6-flat32-physical-scene-geometry-provenance-v1',
    flat32SourceRevision: '514d5f6080d2dd485efdb07b5da9a203357a40c0',
    copiedSourcePaths: Object.freeze([
        'src/flat32/index.js',
        'scripts/flat/reconciliation/POC/src/subjective-scenes/flat32SceneSnapshot.js',
        'scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32SceneStateResolver.js',
        'scripts/flat/reconciliation/POC/src/scenes/planetSphereSceneDefinition.js',
    ]),
    ownership: 'er6-reset-owned-bounded-geometry-copy',
    runtimeLinkPolicy: 'no-flat32-pre-reset-renderer-or-production-runtime-links',
});

export const ER6_FLAT32_SCENE_IDENTITY = Object.freeze({
    id: 'flat32-real-scene-soft-shader-snapshot-v1',
    sourceRevision: '514d5f6080d2dd485efdb07b5da9a203357a40c0',
    ownership: 'reconciliation-poc-bounded-experimental-snapshot',
    runtimeLinkPolicy: 'poc-local-no-flat32-or-production-runtime-links',
});

export const ER6_FLAT32_SCENE_GEOMETRY_FACTS = Object.freeze({
    kind: 'er6-flat32-physical-scene-geometry-facts-v1',
    units: Object.freeze({
        metersPerSceneUnit: 1000,
    }),
    presentationFrame: Object.freeze({
        id: 'union-glacier-flat-0-startup-frame-v1',
        directionScene: Object.freeze([
            0.9417752141,
            0.3172979876,
            0.1112718890,
        ]),
        directionTolerance: 1e-9,
    }),
    camera: Object.freeze({
        positionSceneUnits: Object.freeze([0, 0.005, 0]),
        nearSceneUnits: 0.002,
        farSceneUnits: 500,
        verticalFovDegrees: 70,
        canonicalBenchmarkViewportPixels: Object.freeze([1024, 768]),
    }),
    globeGround: Object.freeze({
        objectId: 'flat32-globe-ground',
        kind: 'geometry-owned-spherical-ground',
        radiusSceneUnits: 6360,
        centerSceneUnits: Object.freeze([0, -6360, 0]),
    }),
    reviewBoxes: Object.freeze([
        Object.freeze({
            objectId: 'union-review-near-yellow-box',
            centerXZ: Object.freeze([-0.26, -1.6]),
            sizeSceneUnits: Object.freeze([0.18, 0.22, 0.18]),
        }),
        Object.freeze({
            objectId: 'union-review-close-single-story-building-box',
            centerXZ: Object.freeze([-0.012, -0.03]),
            sizeSceneUnits: Object.freeze([0.014, 0.006, 0.010]),
        }),
        Object.freeze({
            objectId: 'union-review-mid-white-box',
            centerXZ: Object.freeze([0.62, -3.6]),
            sizeSceneUnits: Object.freeze([0.42, 0.5, 0.42]),
        }),
        Object.freeze({
            objectId: 'union-review-far-orange-box',
            centerXZ: Object.freeze([-1.3, -8.2]),
            sizeSceneUnits: Object.freeze([0.9, 0.9, 0.9]),
        }),
        Object.freeze({
            objectId: 'union-review-distant-cyan-box',
            centerXZ: Object.freeze([18.0, -60.0]),
            sizeSceneUnits: Object.freeze([6.0, 5.0, 6.0]),
        }),
        Object.freeze({
            objectId: 'union-review-denali-200km-orange-box',
            centerXZ: Object.freeze([100.0, -250.0]),
            sizeSceneUnits: Object.freeze([50.0, 6.2, 100.0]),
        }),
    ]),
});
