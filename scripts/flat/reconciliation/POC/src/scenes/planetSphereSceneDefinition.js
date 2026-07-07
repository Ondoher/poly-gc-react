// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M3 planet-sphere scene parity.
// - scripts/flat/reconciliation/POC/src/scenes/planetSphereSceneFacts.js, shared scene material/runtime facts.

export const PLANET_SPHERE_SCENE_OBJECT_NAMES = Object.freeze({
    distantSunLight: 'distant-sun-light',
    nearRedBox: 'near-red-box',
    nearGreenBox: 'near-green-box',
    middleGreenBox: 'middle-green-box',
    middleYellowBox: 'middle-yellow-box',
    farBlueBox: 'far-blue-box',
    farCyanBox: 'far-cyan-box',
    farGreenBox: 'far-green-box',
    veryFarMagentaBox: 'very-far-magenta-box',
    veryFarGreenBox: 'very-far-green-box',
    unionNearYellowBox: 'union-review-near-yellow-box',
    unionMidWhiteBox: 'union-review-mid-white-box',
    unionFarOrangeBox: 'union-review-far-orange-box',
    unionDistantCyanBox: 'union-review-distant-cyan-box',
    unionDenaliOrangeBox: 'union-review-denali-200km-orange-box',
    unionCloseSingleStoryBuildingBox: 'union-review-close-single-story-building-box',
});

const PLANET_SPHERE_SCENE_OBJECT_SPECS = Object.freeze({
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.nearRedBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([-0.65, -2.0]),
        sizeSceneUnits: 0.35,
        displayRgba: Object.freeze([190, 32, 24, 255]),
        spectralCoverageHint: 'long-wavelength-red',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.nearGreenBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([0.1, -2.8]),
        sizeSceneUnits: 0.35,
        displayRgba: Object.freeze([0, 170, 40, 255]),
        spectralCoverageHint: 'middle-wavelength-green',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.middleGreenBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([1.4, -8.0]),
        sizeSceneUnits: 0.9,
        displayRgba: Object.freeze([0, 170, 40, 255]),
        spectralCoverageHint: 'middle-wavelength-green',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.middleYellowBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([-1.8, -11.0]),
        sizeSceneUnits: 0.75,
        displayRgba: Object.freeze([205, 170, 22, 255]),
        spectralCoverageHint: 'red-plus-green-yellow',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.farBlueBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([2.6, -6.0]),
        sizeSceneUnits: 0.6,
        displayRgba: Object.freeze([38, 88, 210, 255]),
        spectralCoverageHint: 'short-wavelength-blue',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.farCyanBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([-3.4, -24.0]),
        sizeSceneUnits: 2.0,
        displayRgba: Object.freeze([32, 178, 190, 255]),
        spectralCoverageHint: 'green-plus-blue-cyan',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.farGreenBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([-5.5, -32.0]),
        sizeSceneUnits: 2.0,
        displayRgba: Object.freeze([0, 170, 40, 255]),
        spectralCoverageHint: 'middle-wavelength-green',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.veryFarMagentaBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([3.15, -10.0]),
        sizeSceneUnits: 0.7,
        displayRgba: Object.freeze([178, 48, 190, 255]),
        spectralCoverageHint: 'red-plus-blue-magenta',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.veryFarGreenBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([9.0, -70.0]),
        sizeSceneUnits: 4.0,
        displayRgba: Object.freeze([0, 170, 40, 255]),
        spectralCoverageHint: 'middle-wavelength-green',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.unionNearYellowBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([-0.26, -1.6]),
        sizeSceneUnits: Object.freeze([0.18, 0.22, 0.18]),
        displayRgba: Object.freeze([226, 178, 34, 255]),
        spectralCoverageHint: 'red-plus-green-yellow-review',
        shadowRegion: 'camera-local',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.unionMidWhiteBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([0.62, -3.6]),
        sizeSceneUnits: Object.freeze([0.42, 0.5, 0.42]),
        displayRgba: Object.freeze([220, 214, 190, 255]),
        spectralCoverageHint: 'broad-neutral-white-review',
        shadowRegion: 'camera-local',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.unionFarOrangeBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([-1.3, -8.2]),
        sizeSceneUnits: Object.freeze([0.9, 0.9, 0.9]),
        displayRgba: Object.freeze([218, 95, 28, 255]),
        spectralCoverageHint: 'long-wavelength-orange-review',
        shadowRegion: 'camera-local',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.unionDistantCyanBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([18.0, -60.0]),
        sizeSceneUnits: Object.freeze([6.0, 5.0, 6.0]),
        displayRgba: Object.freeze([42, 170, 188, 255]),
        spectralCoverageHint: 'green-plus-blue-cyan-review',
        shadowRegion: 'distant-reference',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.unionDenaliOrangeBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([100.0, -250.0]),
        sizeSceneUnits: Object.freeze([50.0, 6.2, 100.0]),
        displayRgba: Object.freeze([224, 95, 32, 255]),
        spectralCoverageHint: 'denali-scale-orange-review',
        shadowRegion: 'distant-reference',
    }),
    [PLANET_SPHERE_SCENE_OBJECT_NAMES.unionCloseSingleStoryBuildingBox]: Object.freeze({
        kind: 'diagnostic-color-box',
        centerXZ: Object.freeze([-0.012, -0.03]),
        sizeSceneUnits: Object.freeze([0.014, 0.006, 0.010]),
        displayRgba: Object.freeze([28, 105, 185, 255]),
        spectralCoverageHint: 'near-blue-field-building-review',
        shadowRegion: 'camera-local',
    }),
});

const PLANET_SPHERE_COLOR_BOX_OBJECT_NAMES = Object.freeze([
    PLANET_SPHERE_SCENE_OBJECT_NAMES.nearRedBox,
    PLANET_SPHERE_SCENE_OBJECT_NAMES.nearGreenBox,
    PLANET_SPHERE_SCENE_OBJECT_NAMES.middleGreenBox,
    PLANET_SPHERE_SCENE_OBJECT_NAMES.middleYellowBox,
    PLANET_SPHERE_SCENE_OBJECT_NAMES.farBlueBox,
    PLANET_SPHERE_SCENE_OBJECT_NAMES.farCyanBox,
    PLANET_SPHERE_SCENE_OBJECT_NAMES.veryFarMagentaBox,
]);

export const PLANET_SPHERE_GROUND_UNLIT_SCENE = Object.freeze({
    name: 'planet-sphere-ground-solar-noon-unlit',
    objectNames: PLANET_SPHERE_COLOR_BOX_OBJECT_NAMES,
    objectSpecs: PLANET_SPHERE_SCENE_OBJECT_SPECS,
    groundPolicy: 'geometry-owned-spherical-ground',
    lightingPolicy: 'unlit-endpoint-color',
    shadowPolicy: 'shadows-disabled',
});

export const PLANET_SPHERE_GROUND_LIT_SCENE = Object.freeze({
    name: 'planet-sphere-ground-solar-noon-lit',
    objectNames: Object.freeze([
        PLANET_SPHERE_SCENE_OBJECT_NAMES.distantSunLight,
        ...PLANET_SPHERE_COLOR_BOX_OBJECT_NAMES,
    ]),
    objectSpecs: PLANET_SPHERE_SCENE_OBJECT_SPECS,
    groundPolicy: 'geometry-owned-spherical-ground',
    lightingPolicy: 'directional-light-from-distant-sun',
    shadowPolicy: 'shadows-disabled',
});

export const PLANET_SPHERE_GROUND_SHADOWED_SCENE = Object.freeze({
    name: 'planet-sphere-ground-solar-noon-shadowed',
    objectNames: Object.freeze([
        PLANET_SPHERE_SCENE_OBJECT_NAMES.distantSunLight,
        ...PLANET_SPHERE_COLOR_BOX_OBJECT_NAMES,
    ]),
    objectSpecs: PLANET_SPHERE_SCENE_OBJECT_SPECS,
    groundPolicy: 'geometry-owned-spherical-ground',
    lightingPolicy: 'directional-light-from-distant-sun',
    shadowPolicy: 'raycast-shadows-from-distant-sun',
});

export const PLANET_SPHERE_UNION_REVIEW_SHADOWED_SCENE = Object.freeze({
    name: 'planet-sphere-union-review-shadowed',
    objectNames: Object.freeze([
        PLANET_SPHERE_SCENE_OBJECT_NAMES.distantSunLight,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionNearYellowBox,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionCloseSingleStoryBuildingBox,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionMidWhiteBox,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionFarOrangeBox,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionDistantCyanBox,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionDenaliOrangeBox,
    ]),
    objectSpecs: PLANET_SPHERE_SCENE_OBJECT_SPECS,
    groundPolicy: 'geometry-owned-spherical-ground',
    lightingPolicy: 'directional-light-from-distant-sun',
    shadowPolicy: 'raycast-shadows-from-distant-sun',
});

export const PLANET_SPHERE_UNION_REVIEW_UNLIT_SCENE = Object.freeze({
    name: 'planet-sphere-union-review-unlit',
    objectNames: Object.freeze([
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionNearYellowBox,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionCloseSingleStoryBuildingBox,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionMidWhiteBox,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionFarOrangeBox,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionDistantCyanBox,
        PLANET_SPHERE_SCENE_OBJECT_NAMES.unionDenaliOrangeBox,
    ]),
    objectSpecs: PLANET_SPHERE_SCENE_OBJECT_SPECS,
    groundPolicy: 'geometry-owned-spherical-ground',
    lightingPolicy: 'unlit-endpoint-color',
    shadowPolicy: 'shadows-disabled',
});

export const PLANET_SPHERE_SCENE_PRESETS = Object.freeze({
    [PLANET_SPHERE_GROUND_UNLIT_SCENE.name]: PLANET_SPHERE_GROUND_UNLIT_SCENE,
    [PLANET_SPHERE_GROUND_LIT_SCENE.name]: PLANET_SPHERE_GROUND_LIT_SCENE,
    [PLANET_SPHERE_GROUND_SHADOWED_SCENE.name]: PLANET_SPHERE_GROUND_SHADOWED_SCENE,
    [PLANET_SPHERE_UNION_REVIEW_SHADOWED_SCENE.name]: PLANET_SPHERE_UNION_REVIEW_SHADOWED_SCENE,
    [PLANET_SPHERE_UNION_REVIEW_UNLIT_SCENE.name]: PLANET_SPHERE_UNION_REVIEW_UNLIT_SCENE,
});

export function planetSphereSceneDefinitionByName(name) {
    const scene = PLANET_SPHERE_SCENE_PRESETS[name];
    if (!scene) {
        throw new Error(`Unknown planet sphere scene preset: ${name}`);
    }

    return scene;
}

export function planetSphereSceneDefinitionWithRenderOptions(sceneDefinition, {
    allowShading = false,
    withShadows = false,
} = {}) {
    const shadowsEnabled = withShadows || sceneDefinition.shadowPolicy === 'raycast-shadows-from-distant-sun';
    const shadingEnabled = shadowsEnabled
        || allowShading
        || sceneDefinition.lightingPolicy === 'directional-light-from-distant-sun';

    if (!shadingEnabled && !shadowsEnabled) {
        return sceneDefinition.shadowPolicy
            ? sceneDefinition
            : Object.freeze({ ...sceneDefinition, shadowPolicy: 'shadows-disabled' });
    }

    const objectNames = sceneDefinition.objectNames.includes(PLANET_SPHERE_SCENE_OBJECT_NAMES.distantSunLight)
        ? sceneDefinition.objectNames
        : Object.freeze([
            PLANET_SPHERE_SCENE_OBJECT_NAMES.distantSunLight,
            ...sceneDefinition.objectNames,
        ]);
    const suffix = shadowsEnabled ? 'shadowed' : 'shaded';
    const name = sceneDefinition.name.endsWith(`-${suffix}`)
        ? sceneDefinition.name
        : `${sceneDefinition.name}-${suffix}`;

    return Object.freeze({
        ...sceneDefinition,
        name,
        objectNames,
        lightingPolicy: 'directional-light-from-distant-sun',
        shadowPolicy: shadowsEnabled ? 'raycast-shadows-from-distant-sun' : 'shadows-disabled',
    });
}

export default PLANET_SPHERE_GROUND_UNLIT_SCENE;
