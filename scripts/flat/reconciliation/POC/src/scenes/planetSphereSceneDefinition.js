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

export const PLANET_SPHERE_SCENE_PRESETS = Object.freeze({
    [PLANET_SPHERE_GROUND_UNLIT_SCENE.name]: PLANET_SPHERE_GROUND_UNLIT_SCENE,
    [PLANET_SPHERE_GROUND_LIT_SCENE.name]: PLANET_SPHERE_GROUND_LIT_SCENE,
    [PLANET_SPHERE_GROUND_SHADOWED_SCENE.name]: PLANET_SPHERE_GROUND_SHADOWED_SCENE,
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
